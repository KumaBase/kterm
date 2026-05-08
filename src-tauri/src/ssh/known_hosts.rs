use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use crate::config::paths::config_dir;

pub struct KnownHosts {
    entries: HashMap<String, String>,
    path: PathBuf,
}

impl KnownHosts {
    pub fn load() -> Self {
        let path = config_dir().join("known_hosts");
        let mut entries = HashMap::new();

        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                for line in content.lines() {
                    let line = line.trim();
                    if line.is_empty() || line.starts_with('#') {
                        continue;
                    }
                    if let Some((host, key)) = line.split_once(' ') {
                        entries.insert(host.to_string(), key.to_string());
                    }
                }
            }
        }

        Self { entries, path }
    }

    pub fn check(&self, host_key: &str, server_key: &str) -> KnownHostStatus {
        match self.entries.get(host_key) {
            Some(known_key) if known_key == server_key => KnownHostStatus::Trusted,
            Some(_) => KnownHostStatus::Changed,
            None => KnownHostStatus::Unknown,
        }
    }

    pub fn add(&mut self, host_key: &str, server_key: &str) -> Result<(), String> {
        self.entries.insert(host_key.to_string(), server_key.to_string());
        self.save()
    }

    fn save(&self) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let content: String = self
            .entries
            .iter()
            .map(|(host, key)| format!("{host} {key}"))
            .collect::<Vec<_>>()
            .join("\n");
        fs::write(&self.path, &content).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Err(e) = fs::set_permissions(&self.path, fs::Permissions::from_mode(0o600)) {
                tracing::warn!("Failed to set permissions on {}: {e}", self.path.display());
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum KnownHostStatus {
    Trusted,
    Changed,
    Unknown,
}
