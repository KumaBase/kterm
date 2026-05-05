use fontdb::Database;

#[tauri::command]
pub fn font_list() -> Result<Vec<String>, String> {
    let mut db = Database::new();
    db.load_system_fonts();

    let face_count = db.faces().count();
    println!("[kterm] fontdb found {} font faces", face_count);

    let mut families: Vec<String> = Vec::new();
    for face in db.faces() {
        if let Some((family, _)) = face.families.first() {
            if !family.starts_with('.') {
                families.push(family.clone());
            }
        }
    }
    families.sort();
    families.dedup();
    println!("[kterm] Returning {} font families", families.len());
    Ok(families)
}
