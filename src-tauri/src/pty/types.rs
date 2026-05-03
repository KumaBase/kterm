use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtySpawnParams {
    pub session_id: String,
    pub shell: Option<String>,
    pub cwd: Option<String>,
    pub env: Option<Vec<(String, String)>>,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyOutput {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionOutput {
    pub session_id: String,
    pub kind: SessionOutputKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum SessionOutputKind {
    stdout(String),
    exited(u32),
}
