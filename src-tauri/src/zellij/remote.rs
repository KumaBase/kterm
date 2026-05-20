use crate::zellij::types::{ZellijSession, ZellijTab, ZellijInfo};

/// Parse zellij list-sessions -n output from remote SSH exec
pub fn parse_remote_sessions(raw: &str) -> Vec<ZellijSession> {
    let mut sessions = Vec::new();
    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }

        let attached = line.contains("(Attached)") || line.contains("[Attached]");
        let name = line.split_whitespace().next().unwrap_or("").to_string();

        if !name.is_empty() {
            sessions.push(ZellijSession {
                name,
                tabs: 0, // Tab count not available from simple session list
                created: String::new(),
                attached,
            });
        }
    }
    sessions
}

/// Parse zellij action list-tabs --json output from remote SSH exec
pub fn parse_remote_tabs(raw: &str) -> Vec<ZellijTab> {
    #[derive(serde::Deserialize)]
    struct TabInfo {
        position: usize,
        name: String,
        active: bool,
    }

    match serde_json::from_str::<Vec<TabInfo>>(raw.trim()) {
        Ok(tabs) => tabs
            .into_iter()
            .map(|t| ZellijTab {
                position: t.position,
                name: t.name,
                active: t.active,
            })
            .collect(),
        Err(_) => Vec::new(),
    }
}

pub fn remote_info_from_sessions(sessions: Vec<ZellijSession>) -> ZellijInfo {
    ZellijInfo {
        installed: true,
        sessions,
    }
}
