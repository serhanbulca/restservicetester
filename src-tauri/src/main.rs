#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, Instant};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RequestPayload {
    method: String,
    url: String,
    body: Option<String>,
    custom_headers: Option<HashMap<String, String>>,
    timeout: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ResponsePayload {
    ok: bool,
    status: u16,
    status_text: String,
    time: u128,
    data: String,
    error: Option<String>,
}

fn get_projects_dir() -> PathBuf {
    let base_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let proj_dir = base_dir.join("modern-http-tester").join("projects");
    if !proj_dir.exists() {
        let _ = fs::create_dir_all(&proj_dir);
    }
    proj_dir
}

#[tauri::command]
async fn make_request(req: RequestPayload) -> ResponsePayload {
    let timeout_secs = req
        .timeout
        .as_deref()
        .unwrap_or("10")
        .parse::<u64>()
        .unwrap_or(10);

    let client = match reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(Duration::from_secs(timeout_secs))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return ResponsePayload {
                ok: false,
                status: 0,
                status_text: String::new(),
                time: 0,
                data: String::new(),
                error: Some(format!("İstemci oluşturulamadı: {}", e)),
            }
        }
    };

    let method = match reqwest::Method::from_bytes(req.method.as_bytes()) {
        Ok(m) => m,
        Err(e) => {
            return ResponsePayload {
                ok: false,
                status: 0,
                status_text: String::new(),
                time: 0,
                data: String::new(),
                error: Some(format!("Geçersiz HTTP Metodu: {}", e)),
            }
        }
    };

    let mut builder = client.request(method.clone(), &req.url);
    builder = builder.header("Content-Type", "application/json");

    if let Some(headers) = req.custom_headers {
        for (k, v) in headers {
            if !k.trim().is_empty() {
                builder = builder.header(k.trim(), v.trim());
            }
        }
    }

    if method != reqwest::Method::GET && method != reqwest::Method::HEAD {
        if let Some(body_str) = req.body {
            let trimmed = body_str.trim();
            if !trimmed.is_empty() && trimmed != "{\n  \n}" {
                builder = builder.body(body_str);
            }
        }
    }

    let start = Instant::now();
    match builder.send().await {
        Ok(res) => {
            let status = res.status().as_u16();
            let ok = res.status().is_success();
            let status_text = res.status().canonical_reason().unwrap_or("").to_string();
            let data = res.text().await.unwrap_or_default();
            let elapsed = start.elapsed().as_millis();

            ResponsePayload {
                ok,
                status,
                status_text,
                time: elapsed,
                data,
                error: None,
            }
        }
        Err(err) => {
            let error_msg = if err.is_timeout() {
                format!(
                    "Zaman aşımı! Sunucu {} saniye içinde yanıt vermedi.",
                    timeout_secs
                )
            } else {
                err.to_string()
            };

            ResponsePayload {
                ok: false,
                status: 0,
                status_text: String::new(),
                time: start.elapsed().as_millis(),
                data: String::new(),
                error: Some(error_msg),
            }
        }
    }
}

#[tauri::command]
fn get_projects() -> Vec<String> {
    let dir = get_projects_dir();
    let mut list = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    list.push(stem.to_string());
                }
            }
        }
    }
    list.sort();
    list
}

#[tauri::command]
fn create_project(name: String) -> Value {
    let file_path = get_projects_dir().join(format!("{}.json", name));
    if file_path.exists() {
        return json!({ "error": "Bu isimde bir proje zaten var!" });
    }
    let default_data = json!({ "endpoints": [], "requests": [] });
    match fs::write(
        file_path,
        serde_json::to_string_pretty(&default_data).unwrap(),
    ) {
        Ok(_) => json!({ "success": true }),
        Err(e) => json!({ "error": e.to_string() }),
    }
}

#[tauri::command]
fn load_project(name: String) -> Value {
    let file_path = get_projects_dir().join(format!("{}.json", name));
    if !file_path.exists() {
        return json!({ "endpoints": [], "requests": [] });
    }
    match fs::read_to_string(file_path) {
        Ok(content) => serde_json::from_str(&content)
            .unwrap_or_else(|_| json!({ "endpoints": [], "requests": [] })),
        Err(_) => json!({ "endpoints": [], "requests": [] }),
    }
}

#[tauri::command]
fn save_project(name: String, data: Value) -> Value {
    let file_path = get_projects_dir().join(format!("{}.json", name));
    match fs::write(
        file_path,
        serde_json::to_string_pretty(&data).unwrap_or_default(),
    ) {
        Ok(_) => json!({ "success": true }),
        Err(e) => json!({ "error": e.to_string() }),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            make_request,
            get_projects,
            create_project,
            load_project,
            save_project
        ])
        .run(tauri::generate_context!())
        .expect("Tauri uygulaması başlatılırken hata oluştu");
}
