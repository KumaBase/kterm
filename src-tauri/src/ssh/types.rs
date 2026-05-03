use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConnectParams {
    pub session_id: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub auth: SshAuthMethod,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SshAuthMethod {
    Password { password: String },
    PrivateKey { key_path: String, passphrase: Option<String> },
    Agent,
}

/// Auth type stored in profile files — secrets are excluded.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SshStoredAuth {
    Password,
    PrivateKey { key_path: String },
    Agent,
}

impl From<&SshAuthMethod> for SshStoredAuth {
    fn from(auth: &SshAuthMethod) -> Self {
        match auth {
            SshAuthMethod::Password { .. } => SshStoredAuth::Password,
            SshAuthMethod::PrivateKey { key_path, .. } => SshStoredAuth::PrivateKey {
                key_path: key_path.clone(),
            },
            SshAuthMethod::Agent => SshStoredAuth::Agent,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshProfile {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub auth: SshStoredAuth,
    pub last_connected: Option<String>,
}
