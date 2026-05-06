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

    pub fn get_cwd(&self, session_id: &str) -> Result<Option<String>, String> {
        let sessions = self.sessions.read();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session not found: {session_id}"))?;

        let pid = session
            .child_pid()
            .ok_or("Cannot determine process ID")?;

        let output = std::process::Command::new("lsof")
            .args(["-p", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to run lsof: {e}"))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines().skip(1) {
            let fields: Vec<&str> = line.split_whitespace().collect();
            if fields.len() >= 3 && fields[3] == "cwd" {
                return Ok(Some(fields[fields.len() - 1].to_string()));
            }
        }
        Ok(None)
    }

    pub fn kill(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.write();
        if let Some(session) = sessions.remove(session_id) {
            session.kill();
        }
        Ok(())
    }
}
