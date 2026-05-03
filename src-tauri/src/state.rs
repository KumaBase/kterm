use std::sync::Arc;
use parking_lot::RwLock;
use crate::config::AppConfig;
use crate::session::SessionRegistry;
use crate::ssh::auth::HostKeyConfirmations;

pub struct AppState {
    pub config: Arc<RwLock<AppConfig>>,
    pub sessions: SessionRegistry,
    /// Pending host key confirmations: confirmation_id → oneshot sender
    pub host_key_confirmations: HostKeyConfirmations,
}

impl AppState {
    pub fn new() -> Self {
        let config = AppConfig::load().unwrap_or_default();
        Self {
            config: Arc::new(RwLock::new(config)),
            sessions: SessionRegistry::new(),
            host_key_confirmations: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }
}
