use tauri::State;
use crate::state::AppState;
use crate::zellij::types::{ZellijInfo, ZellijSession, ZellijTab};

/// Get local zellij info (installed, sessions)
#[tauri::command]
pub fn zellij_local_info() -> ZellijInfo {
    crate::zellij::local::get_info()
}

/// List local zellij sessions
#[tauri::command]
pub fn zellij_local_sessions() -> Result<Vec<ZellijSession>, String> {
    crate::zellij::local::list_sessions()
}

/// List tabs in a local zellij session
#[tauri::command]
pub fn zellij_local_tabs(session: String) -> Result<Vec<ZellijTab>, String> {
    crate::zellij::local::list_tabs(&session)
}

/// Create a local zellij session
#[tauri::command]
pub fn zellij_local_create(name: String) -> Result<(), String> {
    crate::zellij::local::create_session(&name)
}

/// Kill a local zellij session
#[tauri::command]
pub fn zellij_local_kill(session: String) -> Result<(), String> {
    crate::zellij::local::kill_session(&session)
}

/// Execute a zellij command on a remote SSH session and capture the output.
/// Uses russh exec channel for clean output (no terminal escape codes).
#[tauri::command]
pub async fn zellij_remote_exec(
    state: State<'_, AppState>,
    session_id: String,
    command: String,
) -> Result<String, String> {
    state.sessions.ssh_exec(&session_id, &command).await
}

/// Write a zellij attach command to a session (PTY or SSH)
#[tauri::command]
pub async fn zellij_session_attach(
    state: State<'_, AppState>,
    session_id: String,
    zellij_session: String,
) -> Result<(), String> {
    let cmd = format!("zellij attach {}\n", zellij_session);
    state.sessions.write(&session_id, cmd.as_bytes()).await
}

/// Select (switch to) a tab in a local zellij session
#[tauri::command]
pub fn zellij_local_go_to_tab(session: String, tab_position: usize) -> Result<(), String> {
    crate::zellij::local::go_to_tab(&session, tab_position)
}

/// Create a new tab in a local zellij session
#[tauri::command]
pub fn zellij_local_new_tab(session: String) -> Result<(), String> {
    crate::zellij::local::new_tab(&session, None)
}

/// Close a tab in a local zellij session
#[tauri::command]
pub fn zellij_local_close_tab(session: String, tab_position: usize) -> Result<(), String> {
    crate::zellij::local::close_tab(&session, tab_position)
}

/// Rename a tab in a local zellij session
#[tauri::command]
pub fn zellij_local_rename_tab(session: String, tab_position: usize, name: String) -> Result<(), String> {
    crate::zellij::local::rename_tab(&session, tab_position, &name)
}
