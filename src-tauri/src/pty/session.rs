use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter, Manager};
use crate::pty::types::{PtySpawnParams, SessionOutput, SessionOutputKind};

/// Find the boundary of the last complete UTF-8 character in the data.
/// Returns the index where data can be safely split into valid UTF-8.
fn find_utf8_boundary(data: &[u8]) -> usize {
    if data.is_empty() {
        return 0;
    }
    let mut i = data.len();
    while i > 0 {
        i -= 1;
        if data[i] & 0xC0 != 0x80 {
            let needed = match data[i] {
                b if b < 0x80 => 1,
                b if b < 0xE0 => 2,
                b if b < 0xF0 => 3,
                _ => 4,
            };
            let have = data.len() - i;
            if have < needed {
                return i;
            }
            break;
        }
    }
    data.len()
}

pub struct PtySession {
    pub id: String,
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Arc<Mutex<Option<Box<dyn Child + Send + Sync>>>>,
    running: Arc<AtomicBool>,
}

impl PtySession {
    pub fn spawn(
        params: PtySpawnParams,
        app_handle: &AppHandle,
    ) -> Result<Self, String> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: params.rows,
                cols: params.cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {e}"))?;

        let shell = params.shell.clone().unwrap_or_else(|| crate::pty::detect_default_shell());
        let mut cmd = CommandBuilder::new(&shell);

        if let Some(args) = &params.args {
            cmd.args(args);
        }

        if let Some(cwd) = &params.cwd {
            cmd.cwd(cwd);
        } else if let Some(home) = dirs::home_dir() {
            cmd.cwd(home);
        }

        if let Some(env_vars) = &params.env {
            for (key, value) in env_vars {
                cmd.env(key, value);
            }
        }

        cmd.env("TERM", "xterm-256color");

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {e}"))?;

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {e}"))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take writer: {e}"))?;

        let child = Arc::new(Mutex::new(Some(child)));
        let child_reader = child.clone();
        let running = Arc::new(AtomicBool::new(true));
        let session_id = params.session_id.clone();
        let handle = app_handle.clone();

        std::thread::spawn(move || {
            let mut reader = reader;
            let mut buf = [0u8; 8192];
            let mut pending: Vec<u8> = Vec::new();

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        // Flush remaining pending bytes
                        if !pending.is_empty() {
                            let data = String::from_utf8_lossy(&pending).to_string();
                            let _ = handle.emit("session:output", SessionOutput {
                                session_id: session_id.clone(),
                                kind: SessionOutputKind::stdout(data),
                            });
                        }
                        // Get real exit code from child process
                        let exit_code = {
                            let mut child_lock = child_reader.lock().unwrap();
                            if let Some(ref mut c) = *child_lock {
                                c.wait()
                                    .ok()
                                    .map(|s| s.exit_code())
                                    .unwrap_or(0) as u32
                            } else {
                                0
                            }
                        };
                        let _ = handle.emit("session:output", SessionOutput {
                            session_id: session_id.clone(),
                            kind: SessionOutputKind::exited(exit_code),
                        });
                        // Cleanup: unregister session from registry
                        if let Some(state) = handle.try_state::<crate::state::AppState>() {
                            state.sessions.unregister(&session_id);
                        }
                        break;
                    }
                    Ok(n) => {
                        let mut data = Vec::with_capacity(pending.len() + n);
                        data.extend_from_slice(&pending);
                        data.extend_from_slice(&buf[..n]);
                        pending.clear();

                        let boundary = find_utf8_boundary(&data);
                        if boundary < data.len() {
                            pending.extend_from_slice(&data[boundary..]);
                        }

                        let text = String::from_utf8_lossy(&data[..boundary]).to_string();
                        if !text.is_empty() {
                            let _ = handle.emit("session:output", SessionOutput {
                                session_id: session_id.clone(),
                                kind: SessionOutputKind::stdout(text),
                            });
                        }
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::Interrupted => {
                        continue;
                    }
                    Err(e) => {
                        tracing::debug!("PTY read error for {}: {e}", session_id);
                        if !pending.is_empty() {
                            let data = String::from_utf8_lossy(&pending).to_string();
                            let _ = handle.emit("session:output", SessionOutput {
                                session_id: session_id.clone(),
                                kind: SessionOutputKind::stdout(data),
                            });
                        }
                        let exit_code = {
                            let mut child_lock = child_reader.lock().unwrap();
                            if let Some(ref mut c) = *child_lock {
                                c.wait()
                                    .ok()
                                    .map(|s| s.exit_code())
                                    .unwrap_or(1) as u32
                            } else {
                                1
                            }
                        };
                        let _ = handle.emit("session:output", SessionOutput {
                            session_id: session_id.clone(),
                            kind: SessionOutputKind::exited(exit_code),
                        });
                        if let Some(state) = handle.try_state::<crate::state::AppState>() {
                            state.sessions.unregister(&session_id);
                        }
                        break;
                    }
                }
            }
        });

        Ok(Self {
            id: params.session_id,
            master: Mutex::new(pair.master),
            writer: Mutex::new(writer),
            child,
            running,
        })
    }

    pub fn write(&self, data: &[u8]) -> Result<(), String> {
        let mut writer = self.writer.lock().map_err(|e| format!("Lock error: {e}"))?;
        writer.write_all(data).map_err(|e| format!("Write error: {e}"))?;
        writer.flush().map_err(|e| format!("Flush error: {e}"))?;
        Ok(())
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        let master = self.master.lock().map_err(|e| format!("Lock error: {e}"))?;
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Resize error: {e}"))
    }

    pub fn kill(&self) {
        self.running.store(false, Ordering::Relaxed);
        if let Ok(mut child) = self.child.lock() {
            if let Some(ref mut c) = *child {
                let _ = c.kill();
            }
        }
    }
}

impl Drop for PtySession {
    fn drop(&mut self) {
        self.kill();
    }
}
