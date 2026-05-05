use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use parking_lot::RwLock;
use crate::session::types::{SessionId, SessionKind, SessionInfo};
use crate::pty::PtyManager;
use crate::ssh::SshManager;

/// Maximum number of concurrent sessions
const MAX_SESSIONS: usize = 50;
/// Maximum single write size (1 MiB)
const MAX_WRITE_SIZE: usize = 1024 * 1024;
/// Terminal dimension bounds
const MIN_DIM: u16 = 1;
const MAX_COLS: u16 = 500;
const MAX_ROWS: u16 = 200;

pub struct SessionRegistry {
    pty_manager: PtyManager,
    ssh_manager: SshManager,
    sessions: RwLock<HashMap<SessionId, SessionInfo>>,
    /// Atomic counter for reserving session slots before expensive spawn/connect
    reserved: AtomicUsize,
}

impl SessionRegistry {
    pub fn new() -> Self {
        Self {
            pty_manager: PtyManager::new(),
            ssh_manager: SshManager::new(),
            sessions: RwLock::new(HashMap::new()),
            reserved: AtomicUsize::new(0),
        }
    }

    pub fn pty_manager(&self) -> &PtyManager {
        &self.pty_manager
    }

    pub fn ssh_manager(&self) -> &SshManager {
        &self.ssh_manager
    }

    /// Atomically reserve a session slot. Call before spawn/connect.
    /// Returns Err if limit reached. Must call `release_reserve()` on failure
    /// or `register()` on success (which consumes the reservation).
    pub fn reserve(&self) -> Result<(), String> {
        loop {
            let current = self.reserved.load(Ordering::Relaxed);
            if current >= MAX_SESSIONS {
                return Err(format!("Maximum session count ({MAX_SESSIONS}) reached"));
            }
            if self.reserved.compare_exchange_weak(current, current + 1, Ordering::Acquire, Ordering::Relaxed).is_ok() {
                return Ok(());
            }
        }
    }

    /// Release a previously reserved slot (call on spawn/connect failure)
    pub fn release_reserve(&self) {
        self.reserved.fetch_sub(1, Ordering::Release);
    }

    pub fn register(&self, info: SessionInfo) -> Result<(), String> {
        let mut sessions = self.sessions.write();
        sessions.insert(info.id.clone(), info);
        // Reservation is consumed — no need to decrement reserved counter
        // since the actual session count now matches.
        Ok(())
    }

    pub fn unregister(&self, session_id: &str) {
        let removed = {
            let mut sessions = self.sessions.write();
            sessions.remove(session_id).is_some()
        };
        if removed {
            self.reserved.fetch_sub(1, Ordering::Release);
        }
    }

    pub fn get(&self, session_id: &str) -> Option<SessionInfo> {
        self.sessions.read().get(session_id).cloned()
    }

    pub fn list(&self) -> Vec<SessionInfo> {
        self.sessions.read().values().cloned().collect()
    }

    /// Route write to the correct backend (PTY or SSH) based on session kind
    pub async fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        if data.len() > MAX_WRITE_SIZE {
            return Err(format!("Write data exceeds maximum size ({MAX_WRITE_SIZE} bytes)"));
        }
        let kind = self.sessions.read().get(session_id).map(|s| s.kind.clone());
        match kind {
            Some(SessionKind::Pty) => self.pty_manager.write(session_id, data),
            Some(SessionKind::Ssh { .. }) => self.ssh_manager.write(session_id, data).await,
            None => Err(format!("Session not found: {session_id}")),
        }
    }

    /// Route resize to the correct backend (PTY or SSH) based on session kind
    pub async fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        if !(MIN_DIM..=MAX_COLS).contains(&cols) || !(MIN_DIM..=MAX_ROWS).contains(&rows) {
            return Err(format!("Invalid terminal dimensions: {cols}x{rows}"));
        }
        let kind = self.sessions.read().get(session_id).map(|s| s.kind.clone());
        match kind {
            Some(SessionKind::Pty) => self.pty_manager.resize(session_id, cols, rows),
            Some(SessionKind::Ssh { .. }) => self.ssh_manager.resize(session_id, cols, rows).await,
            None => Err(format!("Session not found: {session_id}")),
        }
    }

    /// Route kill to the correct backend, also unregisters the session
    pub async fn kill(&self, session_id: &str) -> Result<(), String> {
        let kind = self.sessions.read().get(session_id).map(|s| s.kind.clone());
        match kind {
            Some(SessionKind::Pty) => {
                self.pty_manager.kill(session_id)?;
            }
            Some(SessionKind::Ssh { .. }) => {
                self.ssh_manager.disconnect(session_id).await?;
            }
            None => return Err(format!("Session not found: {session_id}")),
        }
        self.unregister(session_id);
        Ok(())
    }

    /// Execute a command on a remote SSH session via exec channel
    pub async fn ssh_exec(&self, session_id: &str, command: &str) -> Result<String, String> {
        let kind = self.sessions.read().get(session_id).map(|s| s.kind.clone());
        match kind {
            Some(SessionKind::Ssh { .. }) => self.ssh_manager.exec(session_id, command).await,
            _ => Err(format!("Session {session_id} is not an SSH session")),
        }
    }
}
