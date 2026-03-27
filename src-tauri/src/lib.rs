use tauri_plugin_shell::ShellExt;
#[cfg(target_os = "windows")]
use tokio::process::Command;
use chrono::Local;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton},
    Manager, Emitter,
};
use tauri_plugin_dialog::DialogExt;
use std::sync::Mutex;
use std::path::PathBuf;

#[derive(serde::Serialize, Debug)]
struct AppContext {
    cache_path: String,
    config_path: String,
    user_home: String,
}

// State to store a custom path for the gower binary if it's not found automatically
struct GowerState {
    custom_path: Mutex<Option<PathBuf>>,
}

#[tauri::command]
async fn get_app_context(app: tauri::AppHandle) -> Result<AppContext, String> {
    // println!("[{}] Tauri Command: get_app_context", Local::now().format("%Y-%m-%d %H:%M:%S"));
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    
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

    // Ensure directories exist to prevent "Path not found" errors
    if let Err(e) = std::fs::create_dir_all(&config_path) {
        println!("[ERROR] Failed to create config directory: {}", e);
    }
    if let Err(e) = std::fs::create_dir_all(&cache_path) {
        println!("[ERROR] Failed to create cache directory: {}", e);
    }

    let context = AppContext {
        cache_path: cache_path.to_string_lossy().to_string(),
        config_path: config_path.to_string_lossy().to_string(),
        user_home: home.to_string_lossy().to_string(),
    };
    
    Ok(context)
}

async fn resolve_gower_path(app: &tauri::AppHandle) -> Result<tauri_plugin_shell::process::Command, String> { // Make this async
    let state = app.state::<GowerState>();
    let custom_path_option = {
        let custom_path_guard = state.custom_path.lock().unwrap();
        custom_path_guard.clone() // Clone the PathBuf out of the MutexGuard
    }; // MutexGuard is dropped here
    
    // If we have a custom path, use it as a regular command
    if let Some(path) = custom_path_option {
        // println!("[DEBUG] Using custom gower path: {:?}", path);
        return Ok(app.shell().command(path.to_string_lossy().to_string()));
    }

    // Try to find 'gower' in the system's PATH
    // println!("[DEBUG] Attempting to find 'gower' in system PATH...");
    // Create a command instance for "gower" (this is a new Command, not the one from custom_path)
    let system_gower_cmd_check = app.shell().command("gower");
    // Try to run a simple, non-destructive command like "version" or "help"
    // We only care if the command *can be executed* by the OS, not its exit status.
    // If `output()` returns `Ok`, it means the OS found the executable.
    match system_gower_cmd_check.args(&["--version"]).output().await {
        Ok(_) => {
            // println!("[DEBUG] 'gower' found in system PATH and is executable.");
            // If successful, return a new Command instance for "gower" without the "--version" arg
            return Ok(app.shell().command("gower"));
        },
        Err(_e) => {
            // println!("[DEBUG] 'gower' not found in system PATH or execution failed: {}", e);
        }
    }

    // Try to find it as a sidecar
    // println!("[DEBUG] Attempting to find bundled sidecar 'gower'...");
    let sidecar_command = app.shell().sidecar("gower")
        .map_err(|e| {
            let exe_dir = app.path().executable_dir().unwrap_or_else(|_| PathBuf::from("."));
            let platform = if cfg!(target_os = "windows") { "x86_64-pc-windows-msvc.exe" } else { "x86_64-unknown-linux-gnu" };
            let expected_name = format!("gower-{}", platform);
            
            let err_msg = format!(
                "Error: No se encontró el motor 'gower'.\n\
                Buscando en: {:?}\n\
                Nombre esperado: {}\n\n\
                Error de Tauri: {}", 
                exe_dir, expected_name, e
            );
            // println!("[ERROR] {}", err_msg);
            err_msg
        })?;
    Ok(sidecar_command)
}

#[tauri::command]
async fn run_gower_command(app: tauri::AppHandle, args: Vec<String>, background: Option<bool>) -> Result<String, String> {
    let _now = Local::now().format("%Y-%m-%d %H:%M:%S");
    let is_bg = background.unwrap_or(false);
    
    let cmd_result = resolve_gower_path(&app).await;
    
    // If the sidecar is missing, show a file picker
    if let Err(err) = cmd_result {
        let app_handle = app.clone();
        
        // Show dialog on the main thread (blocking for user input)
        let file_path = app.dialog()
            .file()
            .set_title("Selecciona el ejecutable de Gower")
            .add_filter("Ejecutable", &["exe", "bin", ""])
            .blocking_pick_file();

        if let Some(path) = file_path {
            let state = app_handle.state::<GowerState>();
            // En Tauri 2.x, FilePath se puede convertir a PathBuf de forma segura
            let path_buf = PathBuf::from(path.to_string());
            *state.custom_path.lock().unwrap() = Some(path_buf);
            // Retry resolving after setting custom path
            return Box::pin(run_gower_command(app_handle, args, background)).await;
        }
        
        return Err(err);
    }

    let mut cmd = cmd_result.unwrap();
    
    // Debug log to see exactly what Tauri is doing
    // println!("[{}] Tauri Command (is_bg={}): {:?} args: {:?}", now, is_bg, cmd, args);
    
    cmd = cmd.args(&args);

    if is_bg {
        let app_handle = app.clone();
        let args_clone = args.clone();
        
        tokio::spawn(async move {
            let _now_bg = Local::now().format("%Y-%m-%d %H:%M:%S");
            // println!("[{}] Executing BG sidecar command: {:?}", now_bg, args_clone);
            
            let output = cmd.output().await;
            
            if let Ok(out) = output {
                let success = out.status.success();
                let _now_done = Local::now().format("%Y-%m-%d %H:%M:%S");
                // println!("[{}] BG command finished (success={}): {:?}", now_done, success, args_clone);

                let _stdout = String::from_utf8_lossy(&out.stdout).to_string();
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                
                // Solo loguear STDOUT/STDERR para comandos de favoritos en segundo plano
                if args_clone.contains(&"favorites".to_string()) {
                    // println!("[{}] BG Command STDOUT: {}", _now_done, _stdout);
                    // eprintln!("[{}] BG Command STDERR: {}", _now_done, stderr);
                }

                if success || stderr.contains("already in favorites") { // Treat "already in favorites" as a success for UI refresh
                    let _ = app_handle.emit("gower-command-finished", args_clone);
                }
            } else if let Err(_e) = output {
                 // println!("[{}] [ERROR] BG command failed: {}", now_bg, e);
            }
        });
        
        return Ok("Backgrounded".to_string());
    }

    // println!("[{}] Executing sidecar command with args: {:?}", now, args);

    let output = cmd.output().await
        .map_err(|e| format!("Sidecar execution failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    // Imprimir la salida de stdout y stderr para comandos en primer plano
    // println!("[{}] Command STDOUT: {}", now, stdout);
    // eprintln!("[{}] Command STDERR: {}", now, stderr);
    if output.status.success() {
        // Prioritize stdout for expected data, fall back to stderr if stdout is empty
        // This assumes gower might eventually output JSON to stdout.
        // For now, if stdout is empty, stderr contains the JSON output.
        if !stdout.is_empty() { Ok(stdout) }
        else { Ok(stderr) }
    } else {
        Err(if stderr.is_empty() { "Command failed with empty stderr".to_string() } else { stderr })
    }
}

#[tauri::command]
async fn check_battery() -> Result<bool, String> {
    // println!("[{}] Tauri Command: check_battery", Local::now().format("%Y-%m-%d %H:%M:%S"));
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

    // Fix for EGL_BAD_PARAMETER / Hardware Acceleration issues on some Linux environments
    #[cfg(target_os = "linux")]
    {
        // Disable DMABUF renderer which is the main cause of EGL_BAD_PARAMETER in WebKitGTK 2.42+
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        // Fallback for composting mode if hardware acceleration fails
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        // Force X11 backend as a fallback if Wayland EGL fails
        std::env::set_var("GDK_BACKEND", "x11");
    }

    tauri::Builder::default()
        .manage(GowerState { custom_path: Mutex::new(None) })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
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
                        position,
                        ..
                    } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            // Obtener el tamaño de la ventana para centrarla un poco respecto al clic
                            if let Ok(size) = window.outer_size() {
                                let x = position.x as i32 - (size.width as i32 / 2);
                                let y = position.y as i32;
                                
                                // Mover la ventana a la posición del tray
                                let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
                            }

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
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = window.hide();
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    // Tests are currently disabled as they require a mocked AppHandle
}
