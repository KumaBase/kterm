use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyBinding {
    pub key: String,
    pub modifiers: Vec<String>,
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeybindConfig {
    #[serde(flatten)]
    pub bindings: HashMap<String, KeyBinding>,
}

impl Default for KeybindConfig {
    fn default() -> Self {
        let mut bindings = HashMap::new();
        bindings.insert("new_tab".to_string(), KeyBinding {
            key: "t".to_string(),
            modifiers: vec!["CmdOrCtrl".to_string()],
            action: "new_tab".to_string(),
        });
        bindings.insert("close_tab".to_string(), KeyBinding {
            key: "w".to_string(),
            modifiers: vec!["CmdOrCtrl".to_string()],
            action: "close_tab".to_string(),
        });
        bindings.insert("toggle_sidebar".to_string(), KeyBinding {
            key: "b".to_string(),
            modifiers: vec!["CmdOrCtrl".to_string()],
            action: "toggle_sidebar".to_string(),
        });
        bindings.insert("settings".to_string(), KeyBinding {
            key: ",".to_string(),
            modifiers: vec!["CmdOrCtrl".to_string()],
            action: "settings".to_string(),
        });
        bindings.insert("quick_connect".to_string(), KeyBinding {
            key: "k".to_string(),
            modifiers: vec!["CmdOrCtrl".to_string(), "Shift".to_string()],
            action: "quick_connect".to_string(),
        });
        bindings.insert("split_horizontal".to_string(), KeyBinding {
            key: "d".to_string(),
            modifiers: vec!["CmdOrCtrl".to_string()],
            action: "split_horizontal".to_string(),
        });
        bindings.insert("split_vertical".to_string(), KeyBinding {
            key: "d".to_string(),
            modifiers: vec!["CmdOrCtrl".to_string(), "Shift".to_string()],
            action: "split_vertical".to_string(),
        });
        Self { bindings }
    }
}

impl KeybindConfig {
    pub fn load() -> Result<Self, String> {
        let path = crate::config::paths::config_dir().join("keybindings.toml");
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read keybindings: {e}"))?;
        toml::from_str(&content)
            .map_err(|e| format!("Failed to parse keybindings: {e}"))
    }

    pub fn save(&self) -> Result<(), String> {
        let dir = crate::config::paths::config_dir();
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create config dir: {e}"))?;
        let content = toml::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize keybindings: {e}"))?;
        std::fs::write(dir.join("keybindings.toml"), content)
            .map_err(|e| format!("Failed to write keybindings: {e}"))?;
        Ok(())
    }
}
