use russh::client;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tauri::AppHandle;
use crate::ssh::auth::{SshAuth, HostKeyConfirmations};
use crate::ssh::types::SshConnectParams;

pub struct SshClient {
    handle: client::Handle<SshAuth>,
    channel: russh::Channel<client::Msg>,
}

/// Result of an exec command on a remote SSH host
pub struct ExecResult {
    pub stdout: String,
    pub exit_code: i32,
}

pub struct SshClientWithOutput {
    pub client: SshClient,
    pub output_rx: mpsc::UnboundedReceiver<Vec<u8>>,
}

impl SshClient {
    pub async fn connect(params: &SshConnectParams, app_handle: AppHandle, pending: HostKeyConfirmations) -> Result<SshClientWithOutput, String> {
        let config = client::Config {
            ..Default::default()
        };

        let (output_tx, output_rx) = mpsc::unbounded_channel();
        let handler = SshAuth::new(output_tx, &params.host, params.port, app_handle, pending);
        let host = params.host.clone();
        let port = params.port;

        let mut session = tokio::time::timeout(
            Duration::from_secs(30),
            client::connect(Arc::new(config), (host.as_str(), port), handler),
        )
        .await
        .map_err(|_| "Connection timed out after 30 seconds".to_string())?
        .map_err(|e| format!("Connection failed: {e}"))?;

        // Authenticate
        let auth_result = match &params.auth {
            crate::ssh::types::SshAuthMethod::Password { password } => {
                session
                    .authenticate_password(params.user.clone(), password.clone())
                    .await
                    .map_err(|e| format!("Password auth failed: {e}"))?
            }
            crate::ssh::types::SshAuthMethod::PrivateKey { key_path, passphrase } => {
                let key = crate::ssh::auth::load_private_key(
                    key_path,
                    passphrase.as_deref(),
                )?;
                session
                    .authenticate_publickey(
                        params.user.clone(),
                        key,
                    )
                    .await
                    .map_err(|e| format!("Public key auth failed: {e}"))?
            }
            crate::ssh::types::SshAuthMethod::Agent => {
                let default_key = dirs::home_dir()
                    .map(|h| h.join(".ssh").join("id_ed25519"))
                    .filter(|p| p.exists())
                    .or_else(|| {
                        dirs::home_dir()
                            .map(|h| h.join(".ssh").join("id_rsa"))
                            .filter(|p| p.exists())
                    });

                match default_key {
                    Some(key_path) => {
                        let key = crate::ssh::auth::load_private_key(
                            key_path.to_str().unwrap_or(""),
                            None,
                        )?;
                        session
                            .authenticate_publickey(
                                params.user.clone(),
                                key,
                            )
                            .await
                            .map_err(|e| format!("Agent auth failed: {e}"))?
                    }
                    None => {
                        return Err("No SSH key found for agent authentication".to_string());
                    }
                }
            }
        };

        if !auth_result {
            return Err("Authentication failed".to_string());
        }

        // Open shell channel
        let channel = session
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open channel: {e}"))?;

        // Request PTY and shell
        channel
            .request_pty(
                false,
                "xterm-256color",
                params.cols as u32,
                params.rows as u32,
                0,
                0,
                &[],
            )
            .await
            .map_err(|e| format!("Failed to request PTY: {e}"))?;

        channel
            .request_shell(false)
            .await
            .map_err(|e| format!("Failed to request shell: {e}"))?;

        Ok(SshClientWithOutput {
            client: SshClient {
                handle: session,
                channel,
            },
            output_rx,
        })
    }

    pub async fn write(&self, data: &[u8]) -> Result<(), String> {
        self.channel
            .data(std::io::Cursor::new(data))
            .await
            .map_err(|e| format!("Write error: {e}"))?;
        Ok(())
    }

    pub async fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        self.channel
            .window_change(cols as u32, rows as u32, 0, 0)
            .await
            .map_err(|e| format!("Resize error: {e}"))?;
        Ok(())
    }

    /// Execute a command on the remote host via a new exec channel.
    /// Returns stdout and exit code. Does not affect the shell channel.
    pub async fn exec(&self, command: &str) -> Result<ExecResult, String> {
        let mut channel = self.handle
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open exec channel: {e}"))?;

        channel
            .exec(true, command)
            .await
            .map_err(|e| format!("Failed to exec command: {e}"))?;

        let mut stdout = Vec::new();
        let mut exit_code = 0;

        loop {
            match channel.wait().await {
                Some(russh::ChannelMsg::Data { data }) => {
                    stdout.extend_from_slice(&data);
                }
                Some(russh::ChannelMsg::ExitStatus { exit_status }) => {
                    exit_code = exit_status as i32;
                }
                Some(russh::ChannelMsg::Eof) | None => {
                    break;
                }
                _ => {}
            }
        }

        Ok(ExecResult {
            stdout: String::from_utf8_lossy(&stdout).into_owned(),
            exit_code,
        })
    }
}
