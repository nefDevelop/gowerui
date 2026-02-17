use std::process::Command;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton},
    Manager, Emitter,
};

#[derive(serde::Serialize, Debug)]
struct AppContext {
    cache_path: String,
    config_path: String,
    user_home: String,
}

#[tauri::command]
fn get_app_context(app: tauri::AppHandle) -> Result<AppContext, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    
    // Simulating the path logic from the original Backend.qml
    let (config_path, cache_path) = if cfg!(target_os = "windows") {
        (
            home.join("AppData/Roaming/gower"),
            home.join("AppData/Local/gower/cache")
        )
    } else {
        (
            home.join(".config/gower"),
            home.join(".cache/gower")
        )
    };

    let context = AppContext {
        cache_path: cache_path.to_string_lossy().to_string(),
        config_path: config_path.to_string_lossy().to_string(),
        user_home: home.to_string_lossy().to_string(),
    };
    
    Ok(context)
}

#[tauri::command]
fn run_gower_command(app: tauri::AppHandle, args: Vec<String>) -> Result<String, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let gower_path = home.join("go/bin/gower");
    
    // Try full path first if it exists, otherwise fall back to PATH
    let (cmd_bin, _is_fallback) = if gower_path.exists() {
        (gower_path.to_string_lossy().to_string(), false)
    } else {
        ("gower".to_string(), true)
    };

    let output = Command::new(&cmd_bin)
        .envs(std::env::vars())
        .args(&args)
        .output()
        .map_err(|e| {
            format!("Command execution failed: {}. Path attempted: {}", e, cmd_bin)
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        // Return both combined because gower seems to be outputting JSON to stderr in some cases
        Ok(format!("{}{}", stdout, stderr))
    } else {
        Err(if stderr.is_empty() { "Command failed with empty stderr".to_string() } else { stderr })
    }
}

#[tauri::command]
fn check_battery() -> bool {
    #[cfg(target_os = "linux")]
    {
        if let Ok(entries) = std::fs::read_dir("/sys/class/power_supply/") {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("BAT") {
                    return true;
                }
            }
        }
        false
    }
    #[cfg(target_os = "windows")]
    {
        // Simple heuristic for now, or use winapi for real check
        true 
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        true
    }
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![run_gower_command, get_app_context, check_battery])
        .setup(|app| {
            let quit_i = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Abrir Gower", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu) 
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                             if let Some(window) = app.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("window-shown", "shown");
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("window-shown", "shown");
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
