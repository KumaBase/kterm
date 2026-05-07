use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use crate::config::paths::{config_dir, config_file_path};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Theme {
    Dark,
    Light,
    System,
}

impl Default for Theme {
    fn default() -> Self {
        Theme::Dark
    }
}

fn default_line_height() -> f32 {
    1.2
}
fn default_padding() -> u16 {
    8
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSettings {
    pub font_family: String,
    pub font_size: u16,
    pub scrollback: u32,
    pub cursor_style: String,
    pub cursor_blink: bool,
    #[serde(default = "default_line_height")]
    pub line_height: f32,
    #[serde(default)]
    pub letter_spacing: i16,
    #[serde(default = "default_padding")]
    pub padding: u16,
    #[serde(default)]
    pub copy_on_select: bool,
}

impl Default for TerminalSettings {
    fn default() -> Self {
        Self {
            font_family: "'JetBrainsMono Nerd Font', 'JetBrains Mono', Menlo, 'Hiragino Sans', monospace".to_string(),
            font_size: 14,
            scrollback: 10000,
            cursor_style: "block".to_string(),
            cursor_blink: true,
            line_height: default_line_height(),
            letter_spacing: 0,
            padding: default_padding(),
            copy_on_select: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowSettings {
    pub width: f64,
    pub height: f64,
    pub remember_size: bool,
    pub remember_position: bool,
}

impl Default for WindowSettings {
    fn default() -> Self {
        Self {
            width: 1024.0,
            height: 768.0,
            remember_size: true,
            remember_position: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub theme: Theme,
    pub terminal: TerminalSettings,
    pub window: WindowSettings,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: Theme::default(),
            terminal: TerminalSettings::default(),
            window: WindowSettings::default(),
        }
    }
}

impl AppConfig {
    pub fn load() -> Result<Self, String> {
        let path = config_file_path();
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read config: {e}"))?;
        let config: Self = toml::from_str(&content)
            .map_err(|e| format!("Failed to parse config: {e}"))?;
        Ok(config)
    }

    pub fn save(&self) -> Result<(), String> {
        let dir = config_dir();
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create config dir: {e}"))?;
        let path = config_file_path();
        let content = toml::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {e}"))?;

        // Write to temp file first, then rename for atomicity
        let temp_path = path.with_extension("toml.tmp");
        fs::write(&temp_path, &content)
            .map_err(|e| format!("Failed to write config: {e}"))?;
        fs::rename(&temp_path, &path)
            .map_err(|e| {
                let _ = fs::remove_file(&temp_path);
                format!("Failed to rename config: {e}")
            })?;
        Ok(())
    }
}
