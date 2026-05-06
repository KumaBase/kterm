use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SshConfigEntry {
    pub host_alias: String,
    pub host_name: Option<String>,
    pub user: Option<String>,
    pub port: u16,
    pub identity_file: Option<String>,
}

pub fn load_system_ssh_config() -> Result<Vec<SshConfigEntry>, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let config_path = home.join(".ssh/config");

    if !config_path.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read ~/.ssh/config: {e}"))?;

    parse_ssh_config(&content, &home)
}

fn parse_ssh_config(content: &str, home: &std::path::Path) -> Result<Vec<SshConfigEntry>, String> {
    let mut entries: Vec<SshConfigEntry> = Vec::new();
    let mut current: Option<SshConfigEntry> = None;

    for line in content.lines() {
        let trimmed = line.trim();

        // Skip empty lines and comments
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let parts: Vec<&str> = trimmed.splitn(2, char::is_whitespace).collect();
        if parts.len() < 2 {
            continue;
        }

        let key = parts[0].to_lowercase();
        let value = parts[1].trim();

        match key.as_str() {
            "host" => {
                // Push the previous entry if any
                if let Some(entry) = current.take() {
                    entries.push(entry);
                }

                // Skip wildcard patterns
                if value.contains('*') || value.contains('?') {
                    // Still need to track so we can skip its directives
                    current = None;
                    continue;
                }

                current = Some(SshConfigEntry {
                    host_alias: value.to_string(),
                    host_name: None,
                    user: None,
                    port: 22,
                    identity_file: None,
                });
            }
            "hostname" => {
                if let Some(ref mut entry) = current {
                    entry.host_name = Some(value.to_string());
                }
            }
            "user" => {
                if let Some(ref mut entry) = current {
                    entry.user = Some(value.to_string());
                }
            }
            "port" => {
                if let Some(ref mut entry) = current {
                    if let Ok(port) = value.parse::<u16>() {
                        entry.port = port;
                    }
                }
            }
            "identityfile" => {
                if let Some(ref mut entry) = current {
                    let expanded = if value.starts_with("~/") {
                        home.join(&value[2..]).to_string_lossy().to_string()
                    } else {
                        value.to_string()
                    };
                    entry.identity_file = Some(expanded);
                }
            }
            _ => {}
        }
    }

    // Push the last entry
    if let Some(entry) = current {
        entries.push(entry);
    }

    Ok(entries)
}
