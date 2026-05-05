use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TmuxSession {
    pub name: String,
    pub windows: usize,
    pub created: i64,
    pub attached: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TmuxWindow {
    pub index: usize,
    pub name: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TmuxInfo {
    pub installed: bool,
    pub double_tmux: bool,
    pub sessions: Vec<TmuxSession>,
}
