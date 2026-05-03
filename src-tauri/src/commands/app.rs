use serde::Serialize;

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

#[tauri::command]
pub fn app_info() -> AppInfo {
    AppInfo {
        name: "kTerm".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}
