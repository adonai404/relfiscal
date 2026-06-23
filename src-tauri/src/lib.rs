use std::path::PathBuf;
use tauri::webview::DownloadEvent;
use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_notification::NotificationExt;

/// Grava texto num caminho do disco. Usado p/ baixar o resultado da IA depois
/// que o usuário escolhe o destino no diálogo "Salvar como". Feito em Rust p/
/// não precisar abrir escopo amplo do plugin fs.
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

/// Grava dados binários (ex: XLSX, PDF) num caminho do disco. No desktop, o usuário
/// escolhe o destino com "Salvar como" e aqui grava via comando Rust.
#[tauri::command]
fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, data).map_err(|e| e.to_string())
}

/// Abre um site numa janela interna do app (navegador embutido). Se `dir` for
/// informado, TODO download feito nessa janela é salvo automaticamente nessa
/// pasta — sem o diálogo "Salvar como" (regra "site X -> pasta Y").
///
/// IMPORTANTE: precisa ser `async`. No Windows, criar uma WebviewWindow dentro
/// de um comando SÍNCRONO trava o main thread e a janela abre em branco. Async
/// roda fora do main thread e o WebView2 consegue inicializar a navegação.
#[tauri::command]
async fn open_internal_browser(
    app: tauri::AppHandle,
    url: String,
    label: String,
    dir: Option<String>,
) -> Result<(), String> {
    let parsed: tauri::Url = url.parse().map_err(|e| format!("URL inválida: {e}"))?;
    let download_dir = dir.map(PathBuf::from);

    WebviewWindowBuilder::new(&app, label, WebviewUrl::External(parsed))
        .title("Imperial App")
        .inner_size(1100.0, 800.0)
        .on_download(move |webview, event| match event {
            DownloadEvent::Requested { destination, .. } => {
                // Com regra de pasta → salva direto (sem diálogo).
                if let Some(d) = download_dir.as_ref() {
                    if let Some(name) = destination.file_name().map(|n| n.to_os_string()) {
                        *destination = d.join(name);
                    }
                    return true;
                }
                // Sem regra → abre "Salvar como" numa thread separada (rfd),
                // para não travar o callback no main thread.
                let name = destination
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(String::from);
                let start_dir = destination.parent().map(|p| p.to_path_buf());
                let (tx, rx) = std::sync::mpsc::channel();
                std::thread::spawn(move || {
                    let mut fd = rfd::FileDialog::new();
                    if let Some(n) = name {
                        fd = fd.set_file_name(n);
                    }
                    if let Some(d) = start_dir {
                        fd = fd.set_directory(d);
                    }
                    let _ = tx.send(fd.save_file());
                });
                match rx.recv() {
                    Ok(Some(path)) => {
                        *destination = path;
                        true
                    }
                    _ => false, // usuário cancelou → cancela o download
                }
            }
            // Download concluído → notificação nativa.
            DownloadEvent::Finished { path, success, .. } => {
                if success {
                    let name = path
                        .as_ref()
                        .and_then(|p| p.file_name())
                        .and_then(|n| n.to_str())
                        .unwrap_or("Arquivo")
                        .to_string();
                    let _ = webview
                        .notification()
                        .builder()
                        .title("Download concluído")
                        .body(format!("{name} foi salvo."))
                        .show();
                }
                true
            }
            _ => true,
        })
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            write_text_file,
            write_binary_file,
            open_internal_browser
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
