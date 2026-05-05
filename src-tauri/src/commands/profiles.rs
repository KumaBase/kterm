use uuid::Uuid;
use crate::config::profile_config::{ShellProfile, ShellProfilesConfig};

#[tauri::command]
pub fn shell_profiles_load() -> Result<ShellProfilesConfig, String> {
    ShellProfilesConfig::load()
}

#[tauri::command]
pub fn shell_profiles_save(config: ShellProfilesConfig) -> Result<(), String> {
    config.save()
}

#[tauri::command]
pub fn shell_profile_create(
    name: String,
    shell: String,
    args: Vec<String>,
    cwd: Option<String>,
    env: Vec<(String, String)>,
) -> Result<ShellProfile, String> {
    let mut config = ShellProfilesConfig::load()?;
    let profile = ShellProfile {
        id: Uuid::new_v4().to_string(),
        name,
        shell,
        args,
        cwd,
        env,
    };
    config.profiles.push(profile.clone());
    config.save()?;
    Ok(profile)
}

#[tauri::command]
pub fn shell_profile_update(
    id: String,
    name: String,
    shell: String,
    args: Vec<String>,
    cwd: Option<String>,
    env: Vec<(String, String)>,
) -> Result<ShellProfile, String> {
    let mut config = ShellProfilesConfig::load()?;
    let profile = config
        .profiles
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("Profile not found: {id}"))?;
    profile.name = name;
    profile.shell = shell;
    profile.args = args;
    profile.cwd = cwd;
    profile.env = env;
    let updated = profile.clone();
    config.save()?;
    Ok(updated)
}

#[tauri::command]
pub fn shell_profile_delete(id: String) -> Result<(), String> {
    let mut config = ShellProfilesConfig::load()?;
    let len_before = config.profiles.len();
    config.profiles.retain(|p| p.id != id);
    if config.profiles.len() == len_before {
        return Err(format!("Profile not found: {id}"));
    }
    // Clear default if deleted
    if config.default_profile_id.as_deref() == Some(id.as_str()) {
        config.default_profile_id = config.profiles.first().map(|p| p.id.clone());
    }
    config.save()
}

#[tauri::command]
pub fn shell_profile_set_default(id: String) -> Result<(), String> {
    let mut config = ShellProfilesConfig::load()?;
    if !config.profiles.iter().any(|p| p.id == id) {
        return Err(format!("Profile not found: {id}"));
    }
    config.default_profile_id = Some(id);
    config.save()
}

#[tauri::command]
pub fn shell_detect_available() -> Vec<String> {
    crate::pty::detect_shells()
}
