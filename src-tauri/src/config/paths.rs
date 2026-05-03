use std::path::PathBuf;

pub fn config_dir() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("kt")
}

pub fn config_file_path() -> PathBuf {
    config_dir().join("config.toml")
}
