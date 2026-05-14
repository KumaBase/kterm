use crate::config::color_theme_config::{ColorThemesConfig, TerminalColorTheme};
use plist::{Dictionary, Value};
use std::path::Path;

#[tauri::command]
pub fn color_themes_load() -> Result<ColorThemesConfig, String> {
    ColorThemesConfig::load()
}

#[tauri::command]
pub fn color_theme_save(theme: TerminalColorTheme) -> Result<(), String> {
    let mut config = ColorThemesConfig::load()?;
    if let Some(existing) = config.themes.iter_mut().find(|t| t.id == theme.id) {
        *existing = theme;
    } else {
        config.themes.push(theme);
    }
    config.save()
}

#[tauri::command]
pub fn color_theme_delete(id: String) -> Result<(), String> {
    let mut config = ColorThemesConfig::load()?;
    let len_before = config.themes.len();
    config.themes.retain(|t| t.id != id);
    if config.themes.len() == len_before {
        return Err(format!("Color theme not found: {id}"));
    }
    config.save()
}

fn extract_color(dict: &Dictionary, key: &str) -> Result<String, String> {
    let color_dict = dict
        .get(key)
        .and_then(|v| v.as_dictionary())
        .ok_or_else(|| format!("Missing key: {key}"))?;

    let r = color_dict
        .get("Red Component")
        .and_then(|v| v.as_real())
        .unwrap_or(0.0);
    let g = color_dict
        .get("Green Component")
        .and_then(|v| v.as_real())
        .unwrap_or(0.0);
    let b = color_dict
        .get("Blue Component")
        .and_then(|v| v.as_real())
        .unwrap_or(0.0);

    let to_hex = |v: f64| -> String {
        format!("{:02x}", (v.clamp(0.0, 1.0) * 255.0).round() as u8)
    };

    Ok(format!("#{}{}{}", to_hex(r), to_hex(g), to_hex(b)))
}

fn extract_ansi_color(dict: &Dictionary, index: u8) -> Result<String, String> {
    extract_color(dict, &format!("Ansi {index} Color"))
}

#[tauri::command]
pub fn import_itermcolors(file_path: String) -> Result<TerminalColorTheme, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {file_path}"));
    }

    let file = std::fs::File::open(path)
        .map_err(|e| format!("Failed to open file: {e}"))?;

    let value = Value::from_reader(file)
        .map_err(|e| format!("Failed to parse plist: {e}"))?;

    let dict = value
        .as_dictionary()
        .ok_or("Invalid iTermColors file: expected dictionary at root")?;

    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Imported Theme")
        .to_string();

    let id = format!("iterm2:{}", uuid::Uuid::new_v4());

    let theme = TerminalColorTheme {
        id,
        name,
        source: "iterm2".to_string(),
        background: extract_color(dict, "Background Color")?,
        foreground: extract_color(dict, "Foreground Color")?,
        cursor: extract_color(dict, "Cursor Color")?,
        selection_background: extract_color(dict, "Selection Color")?,
        black: extract_ansi_color(dict, 0)?,
        red: extract_ansi_color(dict, 1)?,
        green: extract_ansi_color(dict, 2)?,
        yellow: extract_ansi_color(dict, 3)?,
        blue: extract_ansi_color(dict, 4)?,
        magenta: extract_ansi_color(dict, 5)?,
        cyan: extract_ansi_color(dict, 6)?,
        white: extract_ansi_color(dict, 7)?,
        bright_black: extract_ansi_color(dict, 8)?,
        bright_red: extract_ansi_color(dict, 9)?,
        bright_green: extract_ansi_color(dict, 10)?,
        bright_yellow: extract_ansi_color(dict, 11)?,
        bright_blue: extract_ansi_color(dict, 12)?,
        bright_magenta: extract_ansi_color(dict, 13)?,
        bright_cyan: extract_ansi_color(dict, 14)?,
        bright_white: extract_ansi_color(dict, 15)?,
    };

    let mut config = ColorThemesConfig::load()?;
    config.themes.push(theme.clone());
    config.save()?;

    Ok(theme)
}
