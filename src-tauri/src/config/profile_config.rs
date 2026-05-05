use serde::{Deserialize, Serialize};
use std::fs;
use crate::config::paths::config_dir;

fn profiles_file_path() -> std::path::PathBuf {
    config_dir().join("shell-profiles.toml")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellProfile {
    pub id: String,
    pub name: String,
    pub shell: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub cwd: Option<String>,
    #[serde(default)]
    pub env: Vec<(String, String)>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ShellProfilesConfig {
    #[serde(default)]
    pub profiles: Vec<ShellProfile>,
    pub default_profile_id: Option<String>,
}

impl ShellProfilesConfig {
    pub fn load() -> Result<Self, String> {
        let path = profiles_file_path();
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read shell profiles: {e}"))?;
        let config: Self = toml::from_str(&content)
            .map_err(|e| format!("Failed to parse shell profiles: {e}"))?;
        Ok(config)
    }

    pub fn save(&self) -> Result<(), String> {
        let dir = config_dir();
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create config dir: {e}"))?;
        let content = toml::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize shell profiles: {e}"))?;
        fs::write(profiles_file_path(), content)
            .map_err(|e| format!("Failed to write shell profiles: {e}"))?;
        Ok(())
    }
}
