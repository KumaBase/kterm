use serde::{Deserialize, Serialize};
use std::fs;
use crate::config::paths::config_dir;

fn color_themes_file_path() -> std::path::PathBuf {
    config_dir().join("color-themes.toml")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalColorTheme {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub source: String, // "builtin" | "custom" | "iterm2"
    pub background: String,
    pub foreground: String,
    pub cursor: String,
    pub selection_background: String,
    pub black: String,
    pub red: String,
    pub green: String,
    pub yellow: String,
    pub blue: String,
    pub magenta: String,
    pub cyan: String,
    pub white: String,
    pub bright_black: String,
    pub bright_red: String,
    pub bright_green: String,
    pub bright_yellow: String,
    pub bright_blue: String,
    pub bright_magenta: String,
    pub bright_cyan: String,
    pub bright_white: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ColorThemesConfig {
    #[serde(default)]
    pub themes: Vec<TerminalColorTheme>,
}

impl ColorThemesConfig {
    pub fn load() -> Result<Self, String> {
        let path = color_themes_file_path();
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read color themes: {e}"))?;
        let config: Self = toml::from_str(&content)
            .map_err(|e| format!("Failed to parse color themes: {e}"))?;
        Ok(config)
    }

    pub fn save(&self) -> Result<(), String> {
        let dir = config_dir();
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create config dir: {e}"))?;
        let content = toml::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize color themes: {e}"))?;
        fs::write(color_themes_file_path(), content)
            .map_err(|e| format!("Failed to write color themes: {e}"))?;
        Ok(())
    }
}
