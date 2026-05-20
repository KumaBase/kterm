use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize, Clone)]
pub struct ImportedProfile {
    pub name: String,
    pub shell: String,
    pub args: Vec<String>,
    pub cwd: Option<String>,
}

#[cfg(target_os = "windows")]
pub fn import_windows_terminal_profiles() -> Vec<ImportedProfile> {
    let Some(settings_path) = find_settings_json() else {
        return Vec::new();
    };

    let Ok(content) = std::fs::read_to_string(&settings_path) else {
        return Vec::new();
    };

    let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) else {
        return Vec::new();
    };

    let mut profiles = Vec::new();

    // Collect profiles from both profiles.list array and top-level defaults
    if let Some(profiles_value) = json.get("profiles") {
        // profiles can be an object with "list" or directly an array
        let list = if let Some(list) = profiles_value.get("list") {
            list.as_array()
        } else {
            profiles_value.as_array()
        };

        if let Some(list) = list {
            for entry in list {
                if let Some(p) = parse_profile_entry(entry) {
                    profiles.push(p);
                }
            }
        }
    }

    profiles
}

#[cfg(target_os = "windows")]
fn find_settings_json() -> Option<PathBuf> {
    let local_app_data = std::env::var("LOCALAPPDATA").ok()?;

    // Store version (Microsoft Store install)
    let store_path = PathBuf::from(&local_app_data)
        .join("Packages")
        .join("Microsoft.WindowsTerminal_8wekyb3d8bbwe")
        .join("LocalState")
        .join("settings.json");

    if store_path.exists() {
        return Some(store_path);
    }

    // Standalone version (GitHub releases)
    let standalone_path = PathBuf::from(&local_app_data)
        .join("Microsoft")
        .join("Windows Terminal")
        .join("settings.json");

    if standalone_path.exists() {
        return Some(standalone_path);
    }

    None
}

#[cfg(target_os = "windows")]
fn parse_profile_entry(entry: &serde_json::Value) -> Option<ImportedProfile> {
    let obj = entry.as_object()?;

    // Skip hidden profiles
    if obj.get("hidden").and_then(|v| v.as_bool()).unwrap_or(false) {
        return None;
    }

    // Skip Azure Cloud Shell
    if obj
        .get("source")
        .and_then(|v| v.as_str())
        .is_some_and(|s| s == "Windows.Terminal.Azure")
    {
        return None;
    }

    let name = obj
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();

    // Handle WSL profiles
    if let Some(source) = obj.get("source").and_then(|v| v.as_str()) {
        if source == "Windows.Terminal.Wsl" {
            let distro_name = obj
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let shell = "wsl.exe".to_string();
            let args = vec!["-d".to_string(), distro_name.to_string()];

            // Verify wsl.exe exists
            if which::which(&shell).is_ok() {
                return Some(ImportedProfile {
                    name,
                    shell,
                    args,
                    cwd: None,
                });
            }
        }
        return None;
    }

    // Get commandline, falling back to command
    let commandline = obj
        .get("commandline")
        .or_else(|| obj.get("command"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if commandline.is_empty() {
        return None;
    }

    let expanded = expand_env_vars(commandline);
    let (shell, args) = parse_commandline(&expanded);

    // Verify the shell executable exists
    let shell_exists = std::path::Path::new(&shell).exists()
        || which::which(&shell).is_ok();

    if !shell_exists {
        return None;
    }

    let cwd = obj
        .get("startingDirectory")
        .and_then(|v| v.as_str())
        .map(|s| expand_env_vars(s));

    Some(ImportedProfile {
        name,
        shell,
        args,
        cwd,
    })
}

#[cfg(target_os = "windows")]
fn parse_commandline(input: &str) -> (String, Vec<String>) {
    let input = input.trim();
    if input.is_empty() {
        return (String::new(), Vec::new());
    }

    let mut parts = Vec::new();
    let mut current = String::new();
    let mut in_quote = false;
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        match ch {
            '"' => {
                in_quote = !in_quote;
            }
            '\\' if in_quote && chars.peek() == Some(&'"') => {
                // Escaped quote inside quoted string
                current.push('"');
                chars.next();
            }
            ' ' | '\t' if !in_quote => {
                if !current.is_empty() {
                    parts.push(std::mem::take(&mut current));
                }
            }
            _ => {
                current.push(ch);
            }
        }
    }

    if !current.is_empty() {
        parts.push(current);
    }

    if parts.is_empty() {
        return (String::new(), Vec::new());
    }

    let shell = parts.remove(0);
    (shell, parts)
}

#[cfg(target_os = "windows")]
fn expand_env_vars(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '%' {
            let mut var_name = String::new();
            let mut found_end = false;

            while let Some(&next) = chars.peek() {
                if next == '%' {
                    chars.next();
                    found_end = true;
                    break;
                }
                var_name.push(next);
                chars.next();
            }

            if found_end && !var_name.is_empty() {
                if let Ok(val) = std::env::var(&var_name) {
                    result.push_str(&val);
                } else {
                    // Variable not found, keep as-is
                    result.push('%');
                    result.push_str(&var_name);
                    result.push('%');
                }
            } else if !var_name.is_empty() {
                // No closing %, keep as-is
                result.push('%');
                result.push_str(&var_name);
            } else {
                result.push('%');
            }
        } else {
            result.push(ch);
        }
    }

    result
}

#[cfg(not(target_os = "windows"))]
pub fn import_windows_terminal_profiles() -> Vec<ImportedProfile> {
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_commandline_simple() {
        let (shell, args) = parse_commandline("C:\\Windows\\System32\\cmd.exe");
        assert_eq!(shell, "C:\\Windows\\System32\\cmd.exe");
        assert!(args.is_empty());
    }

    #[test]
    fn test_parse_commandline_with_args() {
        let (shell, args) = parse_commandline("wsl.exe -d Ubuntu-20.04");
        assert_eq!(shell, "wsl.exe");
        assert_eq!(args, vec!["-d", "Ubuntu-20.04"]);
    }

    #[test]
    fn test_parse_commandline_quoted_path() {
        let (shell, args) = parse_commandline("\"C:\\Program Files\\Git\\bin\\bash.exe\" --login -i");
        assert_eq!(shell, "C:\\Program Files\\Git\\bin\\bash.exe");
        assert_eq!(args, vec!["--login", "-i"]);
    }

    #[test]
    fn test_expand_env_vars() {
        std::env::set_var("TESTVAR_KTERM", "hello");
        let result = expand_env_vars("prefix_%TESTVAR_KTERM%_suffix");
        assert_eq!(result, "prefix_hello_suffix");
    }

    #[test]
    fn test_expand_env_vars_unknown() {
        let result = expand_env_vars("%NONEXISTENT_VAR_XYZ_123%");
        assert_eq!(result, "%NONEXISTENT_VAR_XYZ_123%");
    }

    #[test]
    fn test_expand_env_vars_no_vars() {
        let result = expand_env_vars("plain text");
        assert_eq!(result, "plain text");
    }
}
