use serde::{Deserialize, Serialize};

pub type SessionId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SessionKind {
    Pty,
    Ssh { host: String, port: u16, user: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: SessionId,
    pub kind: SessionKind,
    pub title: String,
    pub created_at: String,
}
