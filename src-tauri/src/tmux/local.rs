use std::process::Command;
use crate::tmux::types::{TmuxSession, TmuxWindow, TmuxInfo};

/// Check if tmux is installed locally
pub fn is_installed() -> bool {
    Command::new("which")
        .arg("tmux")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Check if we are running inside tmux ($TMUX is set)
pub fn is_inside_tmux() -> bool {
    std::env::var("TMUX").is_ok()
}

/// List local tmux sessions
pub fn list_sessions() -> Result<Vec<TmuxSession>, String> {
    let output = Command::new("tmux")
        .args(["list-sessions", "-F", "#{session_name}\t#{session_windows}\t#{session_created}\t#{session_attached}"])
        .output()
        .map_err(|e| format!("Failed to run tmux: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // "no server running" means no sessions — not an error
        if stderr.contains("no server running") || stderr.contains("no sessions") {
            return Ok(Vec::new());
        }
        return Err(format!("tmux list-sessions failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut sessions = Vec::new();
    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(4, '\t').collect();
        if parts.len() == 4 {
            sessions.push(TmuxSession {
                name: parts[0].to_string(),
                windows: parts[1].parse().unwrap_or(0),
                created: parts[2].parse().unwrap_or(0),
                attached: parts[3] == "1",
            });
        }
    }
    Ok(sessions)
}

/// List windows in a tmux session
pub fn list_windows(session_name: &str) -> Result<Vec<TmuxWindow>, String> {
    let output = Command::new("tmux")
        .args([
            "list-windows",
            "-t", session_name,
            "-F", "#{window_index}\t#{window_name}\t#{window_active}",
        ])
        .output()
        .map_err(|e| format!("Failed to run tmux: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("tmux list-windows failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut windows = Vec::new();
    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(3, '\t').collect();
        if parts.len() == 3 {
            windows.push(TmuxWindow {
                index: parts[0].parse().unwrap_or(0),
                name: parts[1].to_string(),
                active: parts[2] == "1",
            });
        }
    }
    Ok(windows)
}

/// Create a new detached tmux session
pub fn create_session(name: &str) -> Result<(), String> {
    let status = Command::new("tmux")
        .args(["new-session", "-d", "-s", name])
        .status()
        .map_err(|e| format!("Failed to run tmux: {e}"))?;

    if !status.success() {
        return Err(format!("Failed to create tmux session: {name}"));
    }
    Ok(())
}

/// Detach all clients from a tmux session (keeps session alive)
pub fn detach_session(name: &str) -> Result<(), String> {
    let status = Command::new("tmux")
        .args(["detach-client", "-t", name])
        .status()
        .map_err(|e| format!("Failed to run tmux: {e}"))?;

    if !status.success() {
        return Err(format!("Failed to detach tmux session: {name}"));
    }
    Ok(())
}

/// Kill a tmux session
pub fn kill_session(name: &str) -> Result<(), String> {
    let status = Command::new("tmux")
        .args(["kill-session", "-t", name])
        .status()
        .map_err(|e| format!("Failed to run tmux: {e}"))?;

    if !status.success() {
        return Err(format!("Failed to kill tmux session: {name}"));
    }
    Ok(())
}

/// Create a new window in a tmux session
pub fn new_window(session: &str) -> Result<(), String> {
    let status = Command::new("tmux")
        .args(["new-window", "-t", session])
        .status()
        .map_err(|e| format!("Failed to run tmux: {e}"))?;

    if !status.success() {
        return Err("Failed to create tmux window".to_string());
    }
    Ok(())
}

/// Kill a window in a tmux session
pub fn kill_window(session: &str, window_index: usize) -> Result<(), String> {
    let target = format!("{}:{}", session, window_index);
    let status = Command::new("tmux")
        .args(["kill-window", "-t", &target])
        .status()
        .map_err(|e| format!("Failed to run tmux: {e}"))?;

    if !status.success() {
        return Err(format!("Failed to kill tmux window: {target}"));
    }
    Ok(())
}

/// Select (switch to) a window in a tmux session
pub fn select_window(session: &str, window_index: usize) -> Result<(), String> {
    let target = format!("{}:{}", session, window_index);
    let status = Command::new("tmux")
        .args(["select-window", "-t", &target])
        .status()
        .map_err(|e| format!("Failed to run tmux: {e}"))?;

    if !status.success() {
        return Err(format!("Failed to select tmux window: {target}"));
    }
    Ok(())
}

/// Rename a window in a tmux session
pub fn rename_window(session: &str, window_index: usize, name: &str) -> Result<(), String> {
    let target = format!("{}:{}", session, window_index);
    let status = Command::new("tmux")
        .args(["rename-window", "-t", &target, name])
        .status()
        .map_err(|e| format!("Failed to run tmux: {e}"))?;

    if !status.success() {
        return Err(format!("Failed to rename tmux window: {target}"));
    }
    Ok(())
}

/// Get full tmux info (installed, double_tmux, sessions)
pub fn get_info() -> TmuxInfo {
    let installed = is_installed();
    let double_tmux = installed && is_inside_tmux();
    let sessions = if installed {
        list_sessions().unwrap_or_default()
    } else {
        Vec::new()
    };
    TmuxInfo {
        installed,
        double_tmux,
        sessions,
    }
}
