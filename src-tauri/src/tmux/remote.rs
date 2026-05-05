use crate::tmux::types::{TmuxSession, TmuxWindow, TmuxInfo};

/// Parse tmux list-sessions output
fn parse_sessions(output: &str) -> Vec<TmuxSession> {
    let mut sessions = Vec::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.splitn(4, ':').collect();
        if parts.len() == 4 {
            sessions.push(TmuxSession {
                name: parts[0].to_string(),
                windows: parts[1].parse().unwrap_or(0),
                created: parts[2].parse().unwrap_or(0),
                attached: parts[3] == "1",
            });
        }
    }
    sessions
}

/// Parse tmux list-windows output
fn parse_windows(output: &str) -> Vec<TmuxWindow> {
    let mut windows = Vec::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.splitn(3, ':').collect();
        if parts.len() == 3 {
            windows.push(TmuxWindow {
                index: parts[0].parse().unwrap_or(0),
                name: parts[1].to_string(),
                active: parts[2] == "1",
            });
        }
    }
    windows
}

/// Parse remote tmux output — used by the command handler to interpret
/// SSH exec results.
pub fn parse_remote_sessions(raw: &str) -> Vec<TmuxSession> {
    parse_sessions(raw)
}

pub fn parse_remote_windows(raw: &str) -> Vec<TmuxWindow> {
    parse_windows(raw)
}

pub fn remote_info_from_sessions(sessions: Vec<TmuxSession>) -> TmuxInfo {
    TmuxInfo {
        installed: true, // If we got sessions, tmux is installed
        double_tmux: false, // Can't easily detect remotely; defaults to false
        sessions,
    }
}
