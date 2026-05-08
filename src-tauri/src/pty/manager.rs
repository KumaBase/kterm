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

        get_process_cwd(pid)
    }

    /// Remove a session from the map without killing (used after natural exit).
    /// The PtySession's Drop impl will handle cleanup.
    pub fn remove(&self, session_id: &str) {
        self.sessions.write().remove(session_id);
    }

    pub fn kill(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.write();
        if let Some(session) = sessions.remove(session_id) {
            session.kill();
        }
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn get_process_cwd(pid: u32) -> Result<Option<String>, String> {
    unsafe {
        let mut info: libc::proc_vnodepathinfo = std::mem::zeroed();
        let size = libc::proc_pidinfo(
            pid as libc::pid_t,
            libc::PROC_PIDVNODEPATHINFO,
            0,
            &mut info as *mut _ as *mut libc::c_void,
            std::mem::size_of::<libc::proc_vnodepathinfo>() as libc::c_int,
        );
        if size <= 0 {
            return Ok(None);
        }
        let path = std::ffi::CStr::from_ptr(info.pvi_cdir.vip_path.as_ptr() as *const libc::c_char);
        match path.to_str() {
            Ok(s) if !s.is_empty() => Ok(Some(s.to_string())),
            _ => Ok(None),
        }
    }
}

#[cfg(target_os = "linux")]
fn get_process_cwd(pid: u32) -> Result<Option<String>, String> {
    let link = std::fs::read_link(format!("/proc/{pid}/cwd"))
        .map_err(|e| format!("Failed to read /proc/{pid}/cwd: {e}"))?;
    let path = link.to_string_lossy().to_string();
    Ok(if path.is_empty() { None } else { Some(path) })
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn get_process_cwd(_pid: u32) -> Result<Option<String>, String> {
    Ok(None)
}
