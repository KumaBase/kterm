use std::collections::HashMap;
use parking_lot::RwLock;
use tauri::AppHandle;
use crate::pty::{PtySession, PtySpawnParams};

pub struct PtyManager {
    sessions: RwLock<HashMap<String, PtySession>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
        }
    }

    pub fn spawn(&self, params: PtySpawnParams, app_handle: &AppHandle) -> Result<String, String> {
        let session_id = params.session_id.clone();
        let session = PtySession::spawn(params, app_handle)?;
        self.sessions.write().insert(session_id.clone(), session);
        Ok(session_id)
    }

    pub fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let sessions = self.sessions.read();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session not found: {session_id}"))?;
        session.write(data)
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.read();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session not found: {session_id}"))?;
        session.resize(cols, rows)
    }

    pub fn kill(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.write();
        if let Some(session) = sessions.remove(session_id) {
            session.kill();
        }
        Ok(())
    }
}
