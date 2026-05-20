use std::process::Command;
use crate::zellij::types::{ZellijSession, ZellijTab, ZellijInfo};

/// Check if zellij is installed locally
pub fn is_installed() -> bool {
    Command::new("which")
        .arg("zellij")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// List local zellij sessions
pub fn list_sessions() -> Result<Vec<ZellijSession>, String> {
    let output = Command::new("zellij")
        .args(["list-sessions", "-n", "-s"])
        .output()
        .map_err(|e| format!("Failed to run zellij: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    // "no sessions" is not an error
    if stderr.contains("no sessions") || stderr.contains("No sessions") {
        return Ok(Vec::new());
    }

    // -s flag gives just session names, one per line
    let names: Vec<&str> = stdout.lines().filter(|l| !l.trim().is_empty()).collect();

    if names.is_empty() {
        // Try without -s to get full info for parsing
        return list_sessions_detailed();
    }

    // Get full info for attached status
    let detailed = list_sessions_detailed().unwrap_or_default();
    let mut sessions = Vec::new();

    for name in &names {
        let trimmed = name.trim();
        if trimmed.is_empty() { continue; }
        if let Some(d) = detailed.iter().find(|s| s.name == trimmed) {
            sessions.push(d.clone());
        } else {
            sessions.push(ZellijSession {
                name: trimmed.to_string(),
                tabs: 0,
                created: String::new(),
                attached: false,
            });
        }
    }

    Ok(sessions)
}

/// Parse detailed session list output
fn list_sessions_detailed() -> Result<Vec<ZellijSession>, String> {
    let output = Command::new("zellij")
        .args(["list-sessions", "-n"])
        .output()
        .map_err(|e| format!("Failed to run zellij: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("no sessions") || stderr.contains("No sessions") {
            return Ok(Vec::new());
        }
        return Err(format!("zellij list-sessions failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut sessions = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }

        // Format: "SESSION_NAME [Created X ago]" or "SESSION_NAME (Attached) [Created X ago]"
        let attached = line.contains("(Attached)") || line.contains("[Attached]");
        let name = line.split_whitespace().next().unwrap_or("").to_string();

        if !name.is_empty() {
            // Try to get tab count via action list-tabs
            let tabs = count_session_tabs(&name);
            sessions.push(ZellijSession {
                name,
                tabs,
                created: String::new(),
                attached,
            });
        }
    }

    Ok(sessions)
}

/// Count tabs in a session by setting ZELLIJ_SESSION_NAME and running list-tabs
fn count_session_tabs(session_name: &str) -> usize {
    list_tabs(session_name).map(|t| t.len()).unwrap_or(0)
}

/// List tabs in a zellij session
pub fn list_tabs(session_name: &str) -> Result<Vec<ZellijTab>, String> {
    let output = Command::new("zellij")
        .args(["action", "list-tabs", "--json"])
        .env("ZELLIJ_SESSION_NAME", session_name)
        .output()
        .map_err(|e| format!("Failed to run zellij: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("zellij action list-tabs failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse JSON output
    #[derive(serde::Deserialize)]
    struct TabInfo {
        position: usize,
        name: String,
        active: bool,
    }

    match serde_json::from_str::<Vec<TabInfo>>(&stdout) {
        Ok(tabs) => Ok(tabs
            .into_iter()
            .map(|t| ZellijTab {
                position: t.position,
                name: t.name,
                active: t.active,
            })
            .collect()),
        Err(e) => Err(format!("Failed to parse zellij tab list: {e}")),
    }
}

/// Create a new detached zellij session
pub fn create_session(name: &str) -> Result<(), String> {
    let status = Command::new("zellij")
        .args(["-s", name])
        .arg("--")
        .arg("true") // Run `true` so the session starts and stays alive in detached mode
        .env("ZELLIJ_AUTO_ATTACH", "0")
        .spawn()
        .map_err(|e| format!("Failed to run zellij: {e}"))?;

    // We spawn without waiting — zellij creates a session and the `true` command keeps it alive briefly
    // For a persistent detached session, we use a different approach
    drop(status);

    // Actually, use zellij attach --create-background approach or just start with nohup
    // The simplest: start a session in background
    let status = Command::new("zellij")
        .args(["attach", name, "-b"])
        .status()
        .map_err(|e| format!("Failed to run zellij: {e}"))?;

    if !status.success() {
        return Err(format!("Failed to create zellij session: {name}"));
    }
    Ok(())
}

/// Kill a zellij session
pub fn kill_session(name: &str) -> Result<(), String> {
    let status = Command::new("zellij")
        .args(["kill-session", name])
        .status()
        .map_err(|e| format!("Failed to run zellij: {e}"))?;

    if !status.success() {
        return Err(format!("Failed to kill zellij session: {name}"));
    }
    Ok(())
}

/// Create a new tab in a zellij session
pub fn new_tab(session_name: &str, tab_name: Option<&str>) -> Result<(), String> {
    let mut cmd = Command::new("zellij");
    cmd.args(["action", "new-tab"]);
    if let Some(name) = tab_name {
        cmd.args(["-n", name]);
    }
    cmd.env("ZELLIJ_SESSION_NAME", session_name);

    let status = cmd
        .status()
        .map_err(|e| format!("Failed to run zellij: {e}"))?;

    if !status.success() {
        return Err("Failed to create zellij tab".to_string());
    }
    Ok(())
}

/// Close a tab in a zellij session
pub fn close_tab(session_name: &str, tab_position: usize) -> Result<(), String> {
    let status = Command::new("zellij")
        .args(["action", "close-tab"])
        .env("ZELLIJ_SESSION_NAME", session_name)
        .status()
        .map_err(|e| format!("Failed to run zellij: {e}"))?;

    if !status.success() {
        return Err(format!("Failed to close zellij tab at position {tab_position}"));
    }
    Ok(())
}

/// Go to (select) a tab in a zellij session
pub fn go_to_tab(session_name: &str, tab_position: usize) -> Result<(), String> {
    let status = Command::new("zellij")
        .args(["action", "go-to-tab"])
        .arg(tab_position.to_string())
        .env("ZELLIJ_SESSION_NAME", session_name)
        .status()
        .map_err(|e| format!("Failed to run zellij: {e}"))?;

    if !status.success() {
        return Err(format!("Failed to switch to zellij tab {tab_position}"));
    }
    Ok(())
}

/// Rename a tab in a zellij session
pub fn rename_tab(session_name: &str, tab_position: usize, name: &str) -> Result<(), String> {
    // First go to the tab, then rename it
    go_to_tab(session_name, tab_position)?;

    let status = Command::new("zellij")
        .args(["action", "rename-tab"])
        .arg(name)
        .env("ZELLIJ_SESSION_NAME", session_name)
        .status()
        .map_err(|e| format!("Failed to run zellij: {e}"))?;

    if !status.success() {
        return Err(format!("Failed to rename zellij tab {tab_position}"));
    }
    Ok(())
}

/// Get full zellij info (installed, sessions)
pub fn get_info() -> ZellijInfo {
    let installed = is_installed();
    let sessions = if installed {
        list_sessions().unwrap_or_default()
    } else {
        Vec::new()
    };
    ZellijInfo {
        installed,
        sessions,
    }
}
