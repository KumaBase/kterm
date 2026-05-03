use std::env;
use std::path::PathBuf;

pub fn detect_default_shell() -> String {
    if cfg!(target_os = "windows") {
        env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    } else {
        env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    }
}

pub fn detect_shells() -> Vec<String> {
    let mut shells = Vec::new();
    let candidates = ["/bin/zsh", "/bin/bash", "/bin/sh", "/usr/bin/fish", "/usr/local/bin/fish"];
    for path in candidates {
        if std::path::Path::new(path).exists() {
            shells.push(path.to_string());
        }
    }
    if shells.is_empty() {
        shells.push(detect_default_shell());
    }
    shells
}

pub fn get_home_dir() -> Option<PathBuf> {
    dirs::home_dir()
}
