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

    // Read from /etc/shells (macOS / Linux standard)
    if let Ok(contents) = std::fs::read_to_string("/etc/shells") {
        for line in contents.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if std::path::Path::new(line).exists() {
                shells.push(line.to_string());
            }
        }
    }

    // Fallback: ensure $SHELL is included
    let default = detect_default_shell();
    if !shells.iter().any(|s| *s == default) && std::path::Path::new(&default).exists() {
        shells.push(default);
    }

    // Last resort
    if shells.is_empty() {
        shells.push("/bin/sh".to_string());
    }

    shells
}

pub fn get_home_dir() -> Option<PathBuf> {
    dirs::home_dir()
}
