use tauri::State;
use uuid::Uuid;
use crate::state::AppState;
use crate::pty::types::PtySpawnParams;
use crate::session::types::{SessionInfo, SessionKind};

#[tauri::command]
pub fn pty_spawn(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    shell: Option<String>,
    args: Option<Vec<String>>,
    cwd: Option<String>,
    env: Option<Vec<(String, String)>>,
    cols: u16,
    rows: u16,
) -> Result<SessionInfo, String> {
    // Validate dimensions before spawning
    if !(1..=500).contains(&cols) || !(1..=200).contains(&rows) {
        return Err(format!("Invalid terminal dimensions: {cols}x{rows}"));
    }

    // Atomically reserve a slot before expensive operation
    state.sessions.reserve()?;

    let session_id = Uuid::new_v4().to_string();
    let params = PtySpawnParams {
        session_id: session_id.clone(),
        shell: shell.clone(),
        args,
        cwd,
        env,
        cols,
        rows,
    };

    // Spawn PTY — rollback by killing if register fails
    if let Err(e) = state.sessions.pty_manager().spawn(params, &app_handle) {
        state.sessions.release_reserve();
        return Err(e);
    }

    let effective_shell = shell.unwrap_or_else(|| crate::pty::detect_default_shell());
    let title = format!("Terminal: {}", effective_shell);

    let info = SessionInfo {
        id: session_id,
        kind: SessionKind::Pty,
        title,
        created_at: chrono::Local::now().to_rfc3339(),
    };

    if let Err(e) = state.sessions.register(info.clone()) {
        // Rollback: kill the spawned PTY and release reservation
        let _ = state.sessions.pty_manager().kill(&info.id);
        state.sessions.release_reserve();
        return Err(e);
    }
    Ok(info)
}

#[tauri::command]
pub async fn session_write(
    state: State<'_, AppState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    state.sessions.write(&session_id, data.as_bytes()).await
}

#[tauri::command]
pub async fn session_resize(
    state: State<'_, AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.sessions.resize(&session_id, cols, rows).await
}

#[tauri::command]
pub async fn session_kill(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    state.sessions.kill(&session_id).await
}

#[tauri::command]
pub fn session_list(
    state: State<'_, AppState>,
) -> Vec<SessionInfo> {
    state.sessions.list()
}
