use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter};
use crate::pty::types::{PtySpawnParams, SessionOutput, SessionOutputKind};

pub struct PtySession {
    pub id: String,
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
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

        let _child = pair
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

        let running = Arc::new(AtomicBool::new(true));
        let session_id = params.session_id.clone();
        let handle = app_handle.clone();

        std::thread::spawn(move || {
            let mut reader = reader;
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        let _ = handle.emit("session:output", SessionOutput {
                            session_id: session_id.clone(),
                            kind: SessionOutputKind::exited(0),
                        });
                        break;
                    }
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = handle.emit("session:output", SessionOutput {
                            session_id: session_id.clone(),
                            kind: SessionOutputKind::stdout(data),
                        });
                    }
                    Err(_) => {
                        let _ = handle.emit("session:output", SessionOutput {
                            session_id: session_id.clone(),
                            kind: SessionOutputKind::exited(1),
                        });
                        break;
                    }
                }
            }
        });

        Ok(Self {
            id: params.session_id,
            master: Mutex::new(pair.master),
            writer: Mutex::new(writer),
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
    }
}

impl Drop for PtySession {
    fn drop(&mut self) {
        self.kill();
    }
}
