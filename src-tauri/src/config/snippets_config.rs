use serde::{Deserialize, Serialize};
use std::fs;
use crate::config::paths::config_dir;

fn snippets_file_path() -> std::path::PathBuf {
    config_dir().join("snippets.toml")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub name: String,
    pub content: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SnippetsConfig {
    #[serde(default)]
    pub snippets: Vec<Snippet>,
}

impl SnippetsConfig {
    pub fn load() -> Result<Self, String> {
        let path = snippets_file_path();
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read snippets: {e}"))?;
        let config: Self = toml::from_str(&content)
            .map_err(|e| format!("Failed to parse snippets: {e}"))?;
        Ok(config)
    }

    pub fn save(&self) -> Result<(), String> {
        let dir = config_dir();
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create config dir: {e}"))?;
        let content = toml::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize snippets: {e}"))?;
        fs::write(snippets_file_path(), content)
            .map_err(|e| format!("Failed to write snippets: {e}"))?;
        Ok(())
    }
}
