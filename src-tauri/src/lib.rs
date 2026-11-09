mod llm;
mod speech;
mod storage;
mod whisper;

use serde::Serialize;
use std::path::PathBuf;
use storage::{Config, Expense};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use whisper::{download_whisper_model, recognize_local, whisper_status};

#[derive(Serialize)]
pub struct AppState {
    expenses: Vec<Expense>,
    config: Config,
    has_key: bool,
}

#[tauri::command]
fn load_state(app: AppHandle) -> Result<AppState, String> {
    let data = storage::read_data(&app)?;
    Ok(AppState {
        expenses: data.expenses,
        config: storage::read_config(&app)?,
        has_key: !storage::read_key(&app)?.trim().is_empty(),
    })
}

#[tauri::command]
fn save_config(app: AppHandle, config: Config) -> Result<(), String> {
    storage::write_config(&app, &config)
}

#[tauri::command]
fn save_key(app: AppHandle, key: String) -> Result<(), String> {
    storage::write_key(&app, &key)
}

#[tauri::command]
fn add_expenses(app: AppHandle, drafts: Vec<llm::Draft>) -> Result<Vec<Expense>, String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let mut data = storage::read_data(&app)?;
    let mut added = Vec::new();
    for draft in drafts {
        if let Some(expense) = llm::draft_to_expense(draft, &today) {
            data.expenses.insert(0, expense.clone());
            added.push(expense);
        }
    }
    if added.is_empty() {
        return Err("没有可保存的有效记录。".to_string());
    }
    storage::write_data(&app, &data)?;
    Ok(added)
}

#[tauri::command]
async fn parse_and_add(app: AppHandle, text: String) -> Result<Vec<Expense>, String> {
    let config = storage::read_config(&app)?;
    let key = storage::read_key(&app)?;
    if key.trim().is_empty() {
        return Err("还没有配置 API Key。点右上角「设置」填写后再试。".to_string());
    }
    let drafts = llm::parse(&config, key.trim(), &text).await?;
    add_expenses(app, drafts)
}

#[tauri::command]
fn update_expense(app: AppHandle, expense: Expense) -> Result<(), String> {
    let mut data = storage::read_data(&app)?;
    let pos = data
        .expenses
        .iter()
        .position(|e| e.id == expense.id)
        .ok_or_else(|| "这条记录不存在，可能已被删除。".to_string())?;
    data.expenses[pos] = expense;
    storage::write_data(&app, &data)
}

#[tauri::command]
fn delete_expense(app: AppHandle, id: String) -> Result<(), String> {
    let mut data = storage::read_data(&app)?;
    let before = data.expenses.len();
    data.expenses.retain(|e| e.id != id);
    if data.expenses.len() == before {
        return Err("这条记录不存在，可能已被删除。".to_string());
    }
    storage::write_data(&app, &data)
}

#[tauri::command]
async fn recognize_speech() -> Result<String, String> {
    match tauri::async_runtime::spawn_blocking(speech::recognize).await {
        Ok(result) => result,
        Err(e) => Err(format!("语音识别线程异常：{e}")),
    }
}

#[derive(Serialize)]
struct ExportFile<'a> {
    version: u32,
    exported_at: String,
    expenses: &'a [Expense],
}

#[tauri::command]
fn export_json(app: AppHandle) -> Result<String, String> {
    let data = storage::read_data(&app)?;
    serde_json::to_string_pretty(&ExportFile {
        version: 1,
        exported_at: chrono::Local::now().to_rfc3339(),
        expenses: &data.expenses,
    })
    .map_err(|e| format!("生成导出内容失败：{e}"))
}

#[tauri::command]
fn import_json(app: AppHandle, json: String) -> Result<usize, String> {
    let value: serde_json::Value =
        serde_json::from_str(&json).map_err(|_| "选择的文件不是合法 JSON。".to_string())?;

    let items = value
        .get("expenses")
        .and_then(|x| x.as_array())
        .or_else(|| value.as_array())
        .ok_or_else(|| "JSON 里找不到 expenses 数组。".to_string())?;

    let mut data = storage::read_data(&app)?;
    let mut count = 0usize;

    for item in items {
        let Some(cents) = item
            .get("amount_cents")
            .and_then(|x| x.as_i64())
            .or_else(|| {
                item.get("amount")
                    .and_then(|x| x.as_f64())
                    .map(|f| (f * 100.0).round() as i64)
            })
        else {
            continue;
        };
        if cents <= 0 || cents > 100_000_000 {
            continue;
        }

        let id = item
            .get("id")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        if data.expenses.iter().any(|e| e.id == id) {
            continue;
        }

        let category = item
            .get("category")
            .and_then(|x| x.as_str())
            .unwrap_or("其他")
            .to_string();
        let note = item
            .get("note")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let date = item
            .get("date")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let date = if chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d").is_ok() {
            date
        } else {
            chrono::Local::now().format("%Y-%m-%d").to_string()
        };
        let created_at = item
            .get("created_at")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| chrono::Local::now().to_rfc3339());

        data.expenses.push(Expense {
            id,
            amount_cents: cents,
            category,
            note,
            date,
            created_at,
        });
        count += 1;
    }

    data.expenses.sort_by(|a, b| b.date.cmp(&a.date));
    storage::write_data(&app, &data)?;
    Ok(count)
}

/// WebView2 user-data folder. Tauri otherwise forces `%LOCALAPPDATA%\<id>`;
/// an explicit folder keeps the app usable on locked-down machines and lets
/// the portable build keep everything self-contained.
fn webview_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(dir) = std::env::var("VIBE_WEBVIEW_DIR") {
        if !dir.trim().is_empty() {
            let p = PathBuf::from(dir);
            std::fs::create_dir_all(&p)
                .map_err(|e| format!("无法创建 WebView 数据目录：{e}"))?;
            return Ok(p);
        }
    }

    if let Ok(p) = app.path().app_local_data_dir() {
        if std::fs::create_dir_all(&p).is_ok() {
            return Ok(p);
        }
    }

    let exe = std::env::current_exe().map_err(|e| format!("无法定位程序位置：{e}"))?;
    let p = exe
        .parent()
        .ok_or_else(|| "无法定位程序目录".to_string())?
        .join("webview-data");
    std::fs::create_dir_all(&p).map_err(|e| format!("无法创建 WebView 数据目录：{e}"))?;
    Ok(p)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = webview_data_dir(app.handle());
            let data_dir = match data_dir {
                Ok(dir) => dir,
                Err(e) => {
                    eprintln!("{e}");
                    return Err(e.into());
                }
            };

            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Vibe Account")
                .inner_size(1180.0, 800.0)
                .min_inner_size(900.0, 620.0)
                .center()
                .data_directory(data_dir)
                .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_config,
            save_key,
            add_expenses,
            parse_and_add,
            update_expense,
            delete_expense,
            recognize_speech,
            whisper_status,
            download_whisper_model,
            recognize_local,
            export_json,
            import_json
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
