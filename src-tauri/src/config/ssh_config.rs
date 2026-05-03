use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshHostConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub identity_file: Option<String>,
    pub proxy_command: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConfig {
    #[serde(flatten)]
    pub hosts: HashMap<String, SshHostConfig>,
}

impl Default for SshConfig {
    fn default() -> Self {
        Self {
            hosts: HashMap::new(),
        }
    }
}

impl SshConfig {
    pub fn load() -> Result<Self, String> {
        let path = crate::config::paths::config_dir().join("ssh-config.toml");
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read SSH config: {e}"))?;
        toml::from_str(&content)
            .map_err(|e| format!("Failed to parse SSH config: {e}"))
    }

    pub fn save(&self) -> Result<(), String> {
        let dir = crate::config::paths::config_dir();
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create config dir: {e}"))?;
        let content = toml::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize SSH config: {e}"))?;
        std::fs::write(dir.join("ssh-config.toml"), content)
            .map_err(|e| format!("Failed to write SSH config: {e}"))?;
        Ok(())
    }
}
