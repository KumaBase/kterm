use chrono::Utc;
use uuid::Uuid;
use crate::config::snippets_config::{Snippet, SnippetsConfig};

#[tauri::command]
pub fn snippets_load() -> Result<SnippetsConfig, String> {
    SnippetsConfig::load()
}

#[tauri::command]
pub fn snippets_save(config: SnippetsConfig) -> Result<(), String> {
    config.save()
}

#[tauri::command]
pub fn snippet_create(name: String, content: String, tags: Vec<String>) -> Result<Snippet, String> {
    let mut config = SnippetsConfig::load()?;
    let now = Utc::now().to_rfc3339();
    let snippet = Snippet {
        id: Uuid::new_v4().to_string(),
        name,
        content,
        tags,
        created_at: now.clone(),
        updated_at: now,
    };
    config.snippets.push(snippet.clone());
    config.save()?;
    Ok(snippet)
}

#[tauri::command]
pub fn snippet_update(
    id: String,
    name: String,
    content: String,
    tags: Vec<String>,
) -> Result<Snippet, String> {
    let mut config = SnippetsConfig::load()?;
    let snippet = config
        .snippets
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("Snippet not found: {id}"))?;
    snippet.name = name;
    snippet.content = content;
    snippet.tags = tags;
    snippet.updated_at = Utc::now().to_rfc3339();
    let updated = snippet.clone();
    config.save()?;
    Ok(updated)
}

#[tauri::command]
pub fn snippet_delete(id: String) -> Result<(), String> {
    let mut config = SnippetsConfig::load()?;
    let len_before = config.snippets.len();
    config.snippets.retain(|s| s.id != id);
    if config.snippets.len() == len_before {
        return Err(format!("Snippet not found: {id}"));
    }
    config.save()
}
