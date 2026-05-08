use russh_keys::key::PrivateKeyWithHashAlg;
use russh_keys::{decode_secret_key, load_secret_key};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot};
use tauri::{AppHandle, Emitter};
use parking_lot::RwLock;
use crate::ssh::known_hosts::{KnownHosts, KnownHostStatus};

/// Wrapper to satisfy russh Handler Error bound (needs From<russh::Error>)
#[derive(Debug)]
pub struct SshHandlerError(pub String);

impl From<russh::Error> for SshHandlerError {
    fn from(err: russh::Error) -> Self {
        SshHandlerError(format!("{err:?}"))
    }
}

impl std::fmt::Display for SshHandlerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// State for pending host key confirmations, passed to SshAuth
pub type HostKeyConfirmations = Arc<RwLock<HashMap<String, oneshot::Sender<bool>>>>;

/// Shared tracker for the shell channel ID.
/// The handler only forwards data from this channel to the terminal (not exec channels).
pub type ShellChannelTracker = Arc<parking_lot::Mutex<Option<russh::ChannelId>>>;

pub struct SshAuth {
    output_tx: mpsc::UnboundedSender<Vec<u8>>,
    shell_channel: ShellChannelTracker,
    host_key_id: String,
    known_hosts: KnownHosts,
    app_handle: AppHandle,
    pending: HostKeyConfirmations,
}

impl SshAuth {
    pub fn new(
        output_tx: mpsc::UnboundedSender<Vec<u8>>,
        host: &str,
        port: u16,
        app_handle: AppHandle,
        pending: HostKeyConfirmations,
        shell_channel: ShellChannelTracker,
    ) -> Self {
        let host_key_id = if port == 22 {
            host.to_string()
        } else {
            format!("[{host}]:{port}")
        };
        Self {
            output_tx,
            shell_channel,
            host_key_id,
            known_hosts: KnownHosts::load(),
            app_handle,
            pending,
        }
    }
}

#[derive(serde::Serialize, Clone)]
struct HostKeyVerifyPayload {
    confirmation_id: String,
    host: String,
    key: String,
}

#[async_trait::async_trait]
impl russh::client::Handler for SshAuth {
    type Error = SshHandlerError;

    async fn check_server_key(
        &mut self,
        server_public_key: &russh_keys::ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        let key_str = server_public_key
            .to_openssh()
            .map_err(|e| SshHandlerError(format!("Failed to serialize host key: {e}")))?;

        match self.known_hosts.check(&self.host_key_id, &key_str) {
            KnownHostStatus::Trusted => Ok(true),
            KnownHostStatus::Unknown => {
                // Create oneshot channel for frontend response
                let (tx, rx) = oneshot::channel();
                let confirmation_id = uuid::Uuid::new_v4().to_string();

                self.pending.write().insert(confirmation_id.clone(), tx);

                // Ask frontend to show confirmation dialog
                let payload = HostKeyVerifyPayload {
                    confirmation_id: confirmation_id.clone(),
                    host: self.host_key_id.clone(),
                    key: key_str.clone(),
                };
                if let Err(e) = self.app_handle.emit("ssh:host-key-verify", &payload) {
                    tracing::warn!("Failed to emit host-key-verify for {}: {e}", self.host_key_id);
                }

                // Wait for user response (with 60s timeout)
                let confirmed = tokio::time::timeout(
                    std::time::Duration::from_secs(60),
                    rx,
                )
                .await
                .unwrap_or(Ok(false))
                .unwrap_or(false);

                // Clean up
                self.pending.write().remove(&confirmation_id);

                if confirmed {
                    self.known_hosts
                        .add(&self.host_key_id, &key_str)
                        .map_err(|e| SshHandlerError(format!("Failed to save host key: {e}")))?;
                    Ok(true)
                } else {
                    Ok(false)
                }
            }
            KnownHostStatus::Changed => {
                eprintln!(
                    "SECURITY: Host key changed for {} — possible MITM attack. Rejecting.",
                    self.host_key_id
                );
                Ok(false)
            }
        }
    }

    async fn data(
        &mut self,
        channel: russh::ChannelId,
        data: &[u8],
        _session: &mut russh::client::Session,
    ) -> Result<(), Self::Error> {
        let shell_id = self.shell_channel.lock();
        if shell_id.map_or(false, |id| id == channel) {
            if let Err(e) = self.output_tx.send(data.to_vec()) {
                tracing::debug!("Failed to send data to output channel: {e}");
            }
        }
        Ok(())
    }

    async fn extended_data(
        &mut self,
        channel: russh::ChannelId,
        _ext: u32,
        data: &[u8],
        _session: &mut russh::client::Session,
    ) -> Result<(), Self::Error> {
        let shell_id = self.shell_channel.lock();
        if shell_id.map_or(false, |id| id == channel) {
            if let Err(e) = self.output_tx.send(data.to_vec()) {
                tracing::debug!("Failed to send extended data to output channel: {e}");
            }
        }
        Ok(())
    }
}

pub fn load_private_key(
    key_path: &str,
    passphrase: Option<&str>,
) -> Result<PrivateKeyWithHashAlg, String> {
    let path = Path::new(key_path);
    if !path.exists() {
        return Err(format!("Key file not found: {key_path}"));
    }

    let private_key = match passphrase {
        Some(pass) => decode_secret_key(
            &std::fs::read_to_string(path).map_err(|e| e.to_string())?,
            Some(pass),
        ).map_err(|e| format!("Failed to decode key: {e}"))?,
        None => load_secret_key(key_path, None).map_err(|e| format!("Failed to load key: {e}"))?,
    };

    PrivateKeyWithHashAlg::new(Arc::new(private_key), None)
        .map_err(|e| format!("Failed to create key: {e}"))
}
