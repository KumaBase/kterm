use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::AppHandle;
use crate::ssh::auth::HostKeyConfirmations;
use crate::ssh::session::SshSession;
use crate::ssh::types::SshConnectParams;

pub struct SshManager {
    sessions: Arc<RwLock<HashMap<String, Arc<SshSession>>>>,
}

impl SshManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn connect(
        &self,
        params: SshConnectParams,
        app_handle: &AppHandle,
        pending: HostKeyConfirmations,
    ) -> Result<String, String> {
        let session_id = params.session_id.clone();
        let session = SshSession::connect(params, app_handle, pending).await?;
        self.sessions.write().await.insert(session_id.clone(), Arc::new(session));
        Ok(session_id)
    }

    pub async fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("SSH session not found: {session_id}"))?;
        session.write(data).await
    }

    pub async fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("SSH session not found: {session_id}"))?;
        session.resize(cols, rows).await
    }

    pub async fn disconnect(&self, session_id: &str) -> Result<(), String> {
        if let Some(session) = self.sessions.write().await.remove(session_id) {
            session.kill();
        }
        Ok(())
    }
}
