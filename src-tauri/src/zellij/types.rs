use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZellijSession {
    pub name: String,
    pub tabs: usize,
    pub created: String,
    pub attached: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZellijTab {
    pub position: usize,
    pub name: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZellijInfo {
    pub installed: bool,
    pub sessions: Vec<ZellijSession>,
}
