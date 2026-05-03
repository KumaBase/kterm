use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionOutputEvent {
    pub session_id: String,
    pub kind: SessionOutputKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum SessionOutputKind {
    stdout(String),
    exited(u32),
}
