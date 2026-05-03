use tauri::State;
use uuid::Uuid;
use crate::state::AppState;
use crate::ssh::types::{SshConnectParams, SshAuthMethod, SshProfile};
use crate::session::types::{SessionInfo, SessionKind};
use serde::{Deserialize, Serialize};

/// Set file permissions to owner-only (0600 on Unix)
#[cfg(unix)]
fn set_private_permissions(path: &std::path::Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
        .map_err(|e| format!("Failed to set permissions: {e}"))
}

#[cfg(not(unix))]
fn set_private_permissions(_path: &std::path::Path) -> Result<(), String> {
    Ok(())
}

/// Wrapper for TOML serialization (top-level Vec is not supported by toml crate)
#[derive(Serialize, Deserialize)]
struct SshProfilesFile {
    #[serde(default)]
    profiles: Vec<SshProfile>,
}

/// Legacy profile format that may contain secrets (for migration)
#[derive(Deserialize)]
struct LegacySshProfile {
    id: String,
    name: String,
    host: String,
    port: u16,
    user: String,
    #[allow(dead_code)]
    auth: toml::Value,
    last_connected: Option<String>,
}

/// Legacy wrapper for migration
#[derive(Deserialize)]
struct LegacySshProfilesFile {
    #[serde(default)]
    profiles: Vec<LegacySshProfile>,
}

fn profiles_path() -> std::path::PathBuf {
    crate::config::config_dir().join("ssh-profiles.toml")
}

#[tauri::command]
pub async fn ssh_connect(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    host: String,
    port: u16,
    user: String,
    auth: SshAuthMethod,
    cols: u16,
    rows: u16,
) -> Result<SessionInfo, String> {
    if host.trim().is_empty() {
        return Err("Host cannot be empty".to_string());
    }
    if !(1..=500).contains(&cols) || !(1..=200).contains(&rows) {
        return Err(format!("Invalid terminal dimensions: {cols}x{rows}"));
    }

    // Atomically reserve a slot before expensive SSH handshake
    state.sessions.reserve()?;

    let session_id = Uuid::new_v4().to_string();
    let params = SshConnectParams {
        session_id: session_id.clone(),
        host: host.clone(),
        port,
        user: user.clone(),
        auth,
        cols,
        rows,
    };

    if let Err(e) = state.sessions.ssh_manager()
        .connect(params, &app_handle, state.host_key_confirmations.clone())
        .await
    {
        state.sessions.release_reserve();
        return Err(e);
    }

    let title = format!("{}@{}:{}", user, host, port);
    let info = SessionInfo {
        id: session_id,
        kind: SessionKind::Ssh { host, port, user },
        title,
        created_at: chrono::Local::now().to_rfc3339(),
    };

    if let Err(e) = state.sessions.register(info.clone()) {
        // Rollback: disconnect the SSH session and release reservation
        let _ = state.sessions.ssh_manager().disconnect(&info.id).await;
        state.sessions.release_reserve();
        return Err(e);
    }
    Ok(info)
}

#[tauri::command]
pub async fn ssh_disconnect(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    state.sessions.ssh_manager().disconnect(&session_id).await?;
    state.sessions.unregister(&session_id);
    Ok(())
}

#[tauri::command]
pub fn ssh_load_profiles() -> Result<Vec<SshProfile>, String> {
    let path = profiles_path();
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read SSH profiles: {e}"))?;

    // Try new format first
    if let Ok(file) = toml::from_str::<SshProfilesFile>(&content) {
        return Ok(file.profiles);
    }

    // Legacy format with secrets — migrate by stripping secrets
    let legacy: LegacySshProfilesFile = toml::from_str(&content)
        .map_err(|e| format!("Failed to parse SSH profiles: {e}"))?;

    let migrated: Vec<SshProfile> = legacy.profiles.into_iter().map(|p| {
        let auth = match p.auth.get("type").and_then(|v| v.as_str()) {
            Some("Password") => crate::ssh::types::SshStoredAuth::Password,
            Some("PrivateKey") => {
                let key_path = p.auth.get("key_path")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                crate::ssh::types::SshStoredAuth::PrivateKey { key_path }
            }
            _ => crate::ssh::types::SshStoredAuth::Agent,
        };
        SshProfile {
            id: p.id,
            name: p.name,
            host: p.host,
            port: p.port,
            user: p.user,
            auth,
            last_connected: p.last_connected,
        }
    }).collect();

    // Overwrite with sanitized version
    let file = SshProfilesFile { profiles: migrated };
    let sanitized = toml::to_string_pretty(&file)
        .map_err(|e| format!("Failed to serialize migrated profiles: {e}"))?;
    std::fs::write(&path, &sanitized)
        .map_err(|e| format!("Failed to write migrated profiles: {e}"))?;
    let _ = set_private_permissions(&path);

    Ok(file.profiles)
}

#[tauri::command]
pub fn ssh_save_profiles(profiles: Vec<SshProfile>) -> Result<(), String> {
    let path = profiles_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir: {e}"))?;
    }
    let file = SshProfilesFile { profiles };
    let content = toml::to_string_pretty(&file)
        .map_err(|e| format!("Failed to serialize SSH profiles: {e}"))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write SSH profiles: {e}"))?;
    set_private_permissions(&path)?;
    Ok(())
}

/// Called by frontend after user responds to host key verification dialog
#[tauri::command]
pub fn ssh_confirm_host_key(
    state: State<'_, AppState>,
    confirmation_id: String,
    confirmed: bool,
) -> Result<(), String> {
    if let Some(tx) = state.host_key_confirmations.write().remove(&confirmation_id) {
        let _: Result<(), bool> = tx.send(confirmed);
    }
    Ok(())
}
