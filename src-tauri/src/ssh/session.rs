use std::sync::Arc;
use tokio::task::JoinHandle;
use tauri::{AppHandle, Emitter, Manager};
use crate::ssh::auth::HostKeyConfirmations;
use crate::ssh::client::{SshClient, SshClientWithOutput};
use crate::ssh::types::SshConnectParams;
use crate::session::events::{SessionOutputEvent, SessionOutputKind};

/// Find the boundary of the last complete UTF-8 character in the data.
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

pub struct SshSession {
    pub id: String,
    client: Arc<tokio::sync::Mutex<SshClient>>,
    running: Arc<tokio::sync::watch::Sender<bool>>,
    output_task: std::sync::Mutex<Option<JoinHandle<()>>>,
}

impl SshSession {
    pub async fn connect(
        params: SshConnectParams,
        app_handle: &AppHandle,
        pending: HostKeyConfirmations,
    ) -> Result<Self, String> {
        let session_id = params.session_id.clone();
        let SshClientWithOutput { client, output_rx } = SshClient::connect(&params, app_handle.clone(), pending).await?;
        let client = Arc::new(tokio::sync::Mutex::new(client));

        let (tx, rx) = tokio::sync::watch::channel(true);
        let running = Arc::new(tx);

        let handle = app_handle.clone();
        let sid = session_id.clone();

        // Output forwarding loop
        let output_task = tokio::spawn(async move {
            let mut output_rx = output_rx;
            let mut utf8_pending: Vec<u8> = Vec::new();
            loop {
                if !*rx.borrow() {
                    break;
                }

                tokio::select! {
                    data = output_rx.recv() => {
                        match data {
                            Some(bytes) => {
                                let mut combined = Vec::with_capacity(utf8_pending.len() + bytes.len());
                                combined.extend_from_slice(&utf8_pending);
                                combined.extend_from_slice(&bytes);
                                utf8_pending.clear();

                                let boundary = find_utf8_boundary(&combined);
                                if boundary < combined.len() {
                                    utf8_pending.extend_from_slice(&combined[boundary..]);
                                }

                                let text = String::from_utf8_lossy(&combined[..boundary]).to_string();
                                if !text.is_empty() {
                                    let event = SessionOutputEvent {
                                        session_id: sid.clone(),
                                        kind: SessionOutputKind::stdout(text),
                                    };
                                    if let Err(e) = handle.emit("session:output", &event) {
                                        tracing::debug!("Failed to emit SSH output for {}: {e}", sid);
                                    }
                                }
                            }
                            None => {
                                // Flush remaining bytes
                                if !utf8_pending.is_empty() {
                                    let text = String::from_utf8_lossy(&utf8_pending).to_string();
                                    let event = SessionOutputEvent {
                                        session_id: sid.clone(),
                                        kind: SessionOutputKind::stdout(text),
                                    };
                                    if let Err(e) = handle.emit("session:output", &event) {
                                        tracing::debug!("Failed to emit SSH pending flush for {}: {e}", sid);
                                    }
                                }
                                let event = SessionOutputEvent {
                                    session_id: sid.clone(),
                                    kind: SessionOutputKind::exited(0),
                                };
                                if let Err(e) = handle.emit("session:output", &event) {
                                    tracing::debug!("Failed to emit SSH exit for {}: {e}", sid);
                                }
                                // Cleanup: unregister session from registry
                                if let Some(state) = handle.try_state::<crate::state::AppState>() {
                                    state.sessions.unregister(&sid);
                                }
                                break;
                            }
                        }
                    }
                    _ = tokio::time::sleep(tokio::time::Duration::from_secs(1)) => {
                        // Periodic check if running flag changed
                        continue;
                    }
                }
            }
        });

        Ok(Self {
            id: session_id,
            client,
            running,
            output_task: std::sync::Mutex::new(Some(output_task)),
        })
    }

    pub async fn write(&self, data: &[u8]) -> Result<(), String> {
        let mut client = self.client.lock().await;
        client.write(data).await
    }

    pub async fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        let mut client = self.client.lock().await;
        client.resize(cols, rows).await
    }

    pub async fn exec(&self, command: &str) -> Result<String, String> {
        let client = self.client.lock().await;
        let result = client.exec(command).await?;
        if result.exit_code != 0 {
            return Err(format!("Command exited with code {}: {}", result.exit_code, result.stdout));
        }
        Ok(result.stdout)
    }

    pub fn kill(&self) {
        let _ = self.running.send(false);
        if let Ok(mut task) = self.output_task.lock() {
            if let Some(handle) = task.take() {
                handle.abort();
            }
        }
    }
}

impl Drop for SshSession {
    fn drop(&mut self) {
        self.kill();
    }
}
