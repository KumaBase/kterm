use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter};
use crate::ssh::auth::HostKeyConfirmations;
use crate::ssh::client::{SshClient, SshClientWithOutput};
use crate::ssh::types::SshConnectParams;
use crate::session::events::{SessionOutputEvent, SessionOutputKind};

pub struct SshSession {
    pub id: String,
    client: Arc<Mutex<SshClient>>,
    running: Arc<tokio::sync::watch::Sender<bool>>,
}

impl SshSession {
    pub async fn connect(
        params: SshConnectParams,
        app_handle: &AppHandle,
        pending: HostKeyConfirmations,
    ) -> Result<Self, String> {
        let session_id = params.session_id.clone();
        let SshClientWithOutput { client, output_rx } = SshClient::connect(&params, app_handle.clone(), pending).await?;
        let client = Arc::new(Mutex::new(client));

        let (tx, rx) = tokio::sync::watch::channel(true);
        let running = Arc::new(tx);

        let handle = app_handle.clone();
        let sid = session_id.clone();

        // Output forwarding loop
        tokio::spawn(async move {
            let mut output_rx = output_rx;
            loop {
                if !*rx.borrow() {
                    break;
                }

                tokio::select! {
                    data = output_rx.recv() => {
                        match data {
                            Some(bytes) => {
                                let output = String::from_utf8_lossy(&bytes);
                                let event = SessionOutputEvent {
                                    session_id: sid.clone(),
                                    kind: SessionOutputKind::stdout(output.into_owned()),
                                };
                                let _ = handle.emit("session:output", &event);
                            }
                            None => {
                                // Channel closed - SSH session ended
                                let event = SessionOutputEvent {
                                    session_id: sid.clone(),
                                    kind: SessionOutputKind::exited(0),
                                };
                                let _ = handle.emit("session:output", &event);
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

    pub fn kill(&self) {
        let _ = self.running.send(false);
    }
}

impl Drop for SshSession {
    fn drop(&mut self) {
        self.kill();
    }
}
