use std::env;
use std::path::PathBuf;

pub fn detect_default_shell() -> String {
    if cfg!(target_os = "windows") {
        env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    } else {
        env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    }
}

#[cfg(not(target_os = "windows"))]
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

#[cfg(target_os = "windows")]
pub fn detect_shells() -> Vec<String> {
    let mut shells = Vec::new();
    let system_root = env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());

    // 1. cmd.exe (from COMSPEC)
    let comspec = env::var("COMSPEC")
        .unwrap_or_else(|_| format!("{}\\System32\\cmd.exe", system_root));
    if std::path::Path::new(&comspec).exists() {
        shells.push(comspec);
    }

    // 2. Windows PowerShell 5.x
    let ps_path = format!(
        "{}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        system_root
    );
    if std::path::Path::new(&ps_path).exists() {
        shells.push(ps_path);
    }

    // 3. PowerShell Core 7+ (pwsh.exe) via where.exe
    if let Ok(output) = std::process::Command::new("where.exe")
        .args(["pwsh.exe"])
        .output()
    {
        if output.status.success() {
            for line in String::from_utf8_lossy(&output.stdout).lines() {
                let path = line.trim().to_string();
                if !path.is_empty() && std::path::Path::new(&path).exists() {
                    shells.push(path);
                }
            }
        }
    }

    // 4. WSL
    let wsl_path = format!("{}\\System32\\wsl.exe", system_root);
    if std::path::Path::new(&wsl_path).exists() {
        shells.push(wsl_path);
    }

    // 5. Git Bash (common install paths)
    let git_bash_paths = [
        "C:\\Program Files\\Git\\bin\\bash.exe",
        "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    ];
    for path in &git_bash_paths {
        if std::path::Path::new(path).exists() {
            shells.push(path.to_string());
            break;
        }
    }

    // 6. bash.exe via where.exe (Cygwin, MSYS2, etc.)
    if let Ok(output) = std::process::Command::new("where.exe")
        .args(["bash.exe"])
        .output()
    {
        if output.status.success() {
            for line in String::from_utf8_lossy(&output.stdout).lines() {
                let path = line.trim().to_string();
                if !path.is_empty()
                    && std::path::Path::new(&path).exists()
                    && !shells.iter().any(|s| s.eq_ignore_ascii_case(&path))
                {
                    shells.push(path);
                }
            }
        }
    }

    // 7. Nushell via where.exe
    if let Ok(output) = std::process::Command::new("where.exe")
        .args(["nu.exe"])
        .output()
    {
        if output.status.success() {
            for line in String::from_utf8_lossy(&output.stdout).lines() {
                let path = line.trim().to_string();
                if !path.is_empty() && std::path::Path::new(&path).exists() {
                    shells.push(path);
                }
            }
        }
    }

    if shells.is_empty() {
        shells.push("cmd.exe".to_string());
    }

    shells
}

pub fn get_home_dir() -> Option<PathBuf> {
    dirs::home_dir()
}
