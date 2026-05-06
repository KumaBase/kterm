mod commands;
mod config;
mod state;
mod error;
mod pty;
mod session;
mod ssh;
mod tmux;

use state::AppState;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::config::config_load,
            commands::config::config_save,
            commands::app::app_info,
            commands::profiles::shell_profiles_load,
            commands::profiles::shell_profiles_save,
            commands::profiles::shell_profile_create,
            commands::profiles::shell_profile_update,
            commands::profiles::shell_profile_delete,
            commands::profiles::shell_profile_set_default,
            commands::profiles::shell_detect_available,
            commands::pty::pty_spawn,
            commands::pty::session_write,
            commands::pty::session_resize,
            commands::pty::session_kill,
            commands::pty::session_list,
            commands::pty::session_get_cwd,
            commands::ssh::ssh_connect,
            commands::ssh::ssh_disconnect,
            commands::ssh::ssh_load_profiles,
            commands::ssh::ssh_save_profiles,
            commands::ssh::ssh_confirm_host_key,
            commands::ssh::ssh_load_system_config,
            commands::snippets::snippets_load,
            commands::snippets::snippets_save,
            commands::snippets::snippet_create,
            commands::snippets::snippet_update,
            commands::snippets::snippet_delete,
            commands::tmux::tmux_local_info,
            commands::tmux::tmux_local_sessions,
            commands::tmux::tmux_local_windows,
            commands::tmux::tmux_local_create,
            commands::tmux::tmux_local_kill,
            commands::tmux::tmux_local_detach,
            commands::tmux::tmux_local_select_window,
            commands::tmux::tmux_remote_exec,
            commands::tmux::tmux_session_attach,
            commands::tmux::tmux_session_switch,
            commands::tmux::tmux_local_new_window,
            commands::tmux::tmux_local_kill_window,
            commands::tmux::tmux_local_rename_window,
            commands::font::font_list,
        ])
        .setup(|app| {
            let settings = MenuItemBuilder::with_id("settings", "Settings...")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;
            let about = MenuItemBuilder::with_id("about", "About kTerm")
                .build(app)?;

            let new_tab = MenuItemBuilder::with_id("new_tab", "New Tab")
                .accelerator("CmdOrCtrl+T")
                .build(app)?;
            let close_tab = MenuItemBuilder::with_id("close_tab", "Close Tab")
                .accelerator("CmdOrCtrl+W")
                .build(app)?;

            let toggle_sidebar = MenuItemBuilder::with_id("toggle_sidebar", "Toggle Sidebar")
                .accelerator("CmdOrCtrl+B")
                .build(app)?;

            let toggle_snippets = MenuItemBuilder::with_id("toggle_snippets", "Toggle Snippets")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?;

            let app_menu = SubmenuBuilder::new(app, "kTerm")
                .item(&about)
                .separator()
                .item(&settings)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&new_tab)
                .item(&close_tab)
                .build()?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&toggle_sidebar)
                .item(&toggle_snippets)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&file_menu)
                .item(&view_menu)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                let id = event.id().as_ref();
                if id != "about" {
                    let _ = app_handle.emit("menu-event", id);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running kTerm");
}
