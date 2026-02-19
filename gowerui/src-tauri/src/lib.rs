use tokio::process::Command;
use chrono::Local;
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
async fn get_app_context(app: tauri::AppHandle) -> Result<AppContext, String> {
    println!("[{}] Tauri Command: get_app_context", Local::now().format("%Y-%m-%d %H:%M:%S"));
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

fn resolve_gower_path(home: std::path::PathBuf) -> (String, bool) {
    let candidates = vec![
        home.join("go/bin/gower").to_string_lossy().to_string(),
        "gower".to_string(),
        "/usr/local/bin/gower".to_string(),
        "/usr/bin/gower".to_string(),
    ];

    for candidate in &candidates {
        if candidate == "gower" { continue; }
        if std::path::Path::new(candidate).exists() {
            return (candidate.clone(), true);
        }
    }
    ("gower".to_string(), false)
}

#[tauri::command]
async fn run_gower_command(app: tauri::AppHandle, args: Vec<String>, background: Option<bool>) -> Result<String, String> {
    let now = Local::now().format("%Y-%m-%d %H:%M:%S");
    let is_bg = background.unwrap_or(false);
    
    if is_bg {
        println!("[{}] Tauri Command (BG): run_gower_command {:?}", now, args);
    } else {
        println!("[{}] Tauri Command: run_gower_command {:?}", now, args);
    }
    
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let (cmd_to_run, found) = resolve_gower_path(home);

    if found {
        println!("[{}] Found gower binary at: {}", now, cmd_to_run);
    } else {
        println!("[{}] gower binary not found in known paths, using 'gower' from PATH", now);
    }
    
    if is_bg {
        let cmd_bin_clone = cmd_to_run.clone();
        let args_clone = args.clone();
        let app_handle = app.clone();
        
        tokio::spawn(async move {
            let now_bg = Local::now().format("%Y-%m-%d %H:%M:%S");
            println!("[{}] Executing BG external command: {} {:?}", now_bg , cmd_bin_clone, args_clone);
            
            let output = Command::new(&cmd_bin_clone)
                .envs(std::env::vars())
                .args(&args_clone)
                .output()
                .await;
            
            if let Ok(out) = output {
                let success = out.status.success();
                let now_done = Local::now().format("%Y-%m-%d %H:%M:%S");
                println!("[{}] BG command finished (success={}): {:?}", now_done, success, args_clone);
                
                if success {
                    let _ = app_handle.emit("gower-command-finished", args_clone);
                }
            } else if let Err(e) = output {
                 println!("[{}] BG command failed to start: {}", now_bg, e);
            }
        });
        
        return Ok("Backgrounded".to_string());
    }

    println!("[{}] Executing external command: {} {:?}", now, cmd_to_run, args);

    let output: std::process::Output = Command::new(&cmd_to_run)
        .envs(std::env::vars())
        .args(&args)
        .output()
        .await
        .map_err(|e| {
            format!("Command execution failed: {}. Path attempted: {}", e, cmd_to_run)
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(format!("{}{}", stdout, stderr))
    } else {
        Err(if stderr.is_empty() { "Command failed with empty stderr".to_string() } else { stderr })
    }
}

#[tauri::command]
async fn check_battery() -> Result<bool, String> {
    println!("[{}] Tauri Command: check_battery", Local::now().format("%Y-%m-%d %H:%M:%S"));
    #[cfg(target_os = "linux")]
    {
        if let Ok(entries) = std::fs::read_dir("/sys/class/power_supply/") {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("BAT") {
                    return Ok(true);
                }
            }
        }
        Ok(false)
    }
    #[cfg(target_os = "windows")]
    {
        // Use PowerShell to check for battery status
        let output = Command::new("powershell")
            .args(&["-NoProfile", "-Command", "Get-WmiObject Win32_Battery | Measure-Object | Select-Object -ExpandProperty Count"])
            .output()
            .await
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            let count_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if let Ok(count) = count_str.parse::<i32>() {
                return Ok(count > 0);
            }
        }
        Ok(false) // Fallback or no battery found
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        Ok(true) // Assume true for other OSs (like macOS) for now or implement equivalent
    }
}

#[tauri::command]
async fn check_file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("[{}] Starting Gower GUI...", Local::now().format("%Y-%m-%d %H:%M:%S"));
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![run_gower_command, get_app_context, check_battery, check_file_exists])
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_resolve_gower_path_fallback() {
        let home = PathBuf::from("/non/existent/home");
        let (path, found) = resolve_gower_path(home);
        assert_eq!(path, "gower");
        assert!(!found);
    }
}
