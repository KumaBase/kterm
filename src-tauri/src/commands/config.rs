use tauri::State;
use crate::state::AppState;
use crate::config::AppConfig;

#[tauri::command]
pub fn config_load(state: State<'_, AppState>) -> Result<AppConfig, String> {
    let config = state.config.read();
    Ok(config.clone())
}

#[tauri::command]
pub fn config_save(state: State<'_, AppState>, config: AppConfig) -> Result<(), String> {
    config.save()?;
    let mut current = state.config.write();
    *current = config;
    Ok(())
}
