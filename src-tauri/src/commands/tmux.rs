use tauri::State;
use crate::state::AppState;
use crate::tmux::types::{TmuxInfo, TmuxSession, TmuxWindow};

/// Get local tmux info (installed, sessions, double-tmux warning)
#[tauri::command]
pub fn tmux_local_info() -> TmuxInfo {
    crate::tmux::local::get_info()
}

/// List local tmux sessions
#[tauri::command]
pub fn tmux_local_sessions() -> Result<Vec<TmuxSession>, String> {
    crate::tmux::local::list_sessions()
}

/// List windows in a local tmux session
#[tauri::command]
pub fn tmux_local_windows(session: String) -> Result<Vec<TmuxWindow>, String> {
    crate::tmux::local::list_windows(&session)
}

/// Create a local tmux session
#[tauri::command]
pub fn tmux_local_create(name: String) -> Result<(), String> {
    crate::tmux::local::create_session(&name)
}

/// Kill a local tmux session
#[tauri::command]
pub fn tmux_local_kill(session: String) -> Result<(), String> {
    crate::tmux::local::kill_session(&session)
}

/// Detach from a local tmux session (keeps session alive)
#[tauri::command]
pub fn tmux_local_detach(session: String) -> Result<(), String> {
    crate::tmux::local::detach_session(&session)
}

/// Execute a tmux command on a remote SSH session and capture the output.
/// Uses russh exec channel for clean output (no terminal escape codes).
#[tauri::command]
pub async fn tmux_remote_exec(
    state: State<'_, AppState>,
    session_id: String,
    command: String,
) -> Result<String, String> {
    state.sessions.ssh_exec(&session_id, &command).await
}

/// Write a tmux attach/switch command to a session (PTY or SSH)
#[tauri::command]
pub async fn tmux_session_attach(
    state: State<'_, AppState>,
    session_id: String,
    tmux_session: String,
) -> Result<(), String> {
    let cmd = format!("tmux attach-session -t {}\n", tmux_session);
    state.sessions.write(&session_id, cmd.as_bytes()).await
}

/// Write a tmux switch-client command to a session
#[tauri::command]
pub async fn tmux_session_switch(
    state: State<'_, AppState>,
    session_id: String,
    tmux_session: String,
) -> Result<(), String> {
    let cmd = format!("tmux switch-client -t {}\n", tmux_session);
    state.sessions.write(&session_id, cmd.as_bytes()).await
}

/// Select (switch to) a window in a local tmux session
#[tauri::command]
pub fn tmux_local_select_window(session: String, window_index: usize) -> Result<(), String> {
    crate::tmux::local::select_window(&session, window_index)
}

/// Create a new window in a local tmux session
#[tauri::command]
pub fn tmux_local_new_window(session: String) -> Result<(), String> {
    crate::tmux::local::new_window(&session)
}

/// Kill a window in a local tmux session
#[tauri::command]
pub fn tmux_local_kill_window(session: String, window_index: usize) -> Result<(), String> {
    crate::tmux::local::kill_window(&session, window_index)
}

/// Rename a window in a local tmux session
#[tauri::command]
pub fn tmux_local_rename_window(session: String, window_index: usize, name: String) -> Result<(), String> {
    crate::tmux::local::rename_window(&session, window_index, &name)
}
