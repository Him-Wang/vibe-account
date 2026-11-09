use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    pub base_url: String,
    pub model: String,
    pub glass: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            base_url: "https://api.deepseek.com/v1".to_string(),
            model: "deepseek-chat".to_string(),
            glass: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Expense {
    pub id: String,
    pub amount_cents: i64,
    pub category: String,
    pub note: String,
    pub date: String,
    pub created_at: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct DataFile {
    pub expenses: Vec<Expense>,
}

pub fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    // Explicit override (tests, portable setups, locked-down machines).
    if let Ok(custom) = std::env::var("VIBE_DATA_DIR") {
        if !custom.trim().is_empty() {
            let p = PathBuf::from(custom);
            fs::create_dir_all(&p).map_err(|e| format!("无法创建数据目录：{e}"))?;
            return Ok(p);
        }
    }

    // Standard location: %APPDATA%\com.vibeaccount.app
    if let Ok(dir) = app.path().app_data_dir() {
        if fs::create_dir_all(&dir).is_ok() {
            return Ok(dir);
        }
    }

    // Portable fallback: a `data` folder next to the executable.
    let exe = std::env::current_exe().map_err(|e| format!("无法定位程序位置：{e}"))?;
    let dir = exe
        .parent()
        .ok_or_else(|| "无法定位程序目录".to_string())?
        .join("data");
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建数据目录：{e}"))?;
    Ok(dir)
}

fn read_json<T: DeserializeOwned + Default>(path: &Path, label: &str) -> Result<T, String> {
    match fs::read_to_string(path) {
        Ok(s) => {
            if s.trim().is_empty() {
                return Ok(T::default());
            }
            serde_json::from_str(&s).map_err(|e| format!("{label}损坏，无法读取：{e}"))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(T::default()),
        Err(e) => Err(format!("{label}读取失败：{e}")),
    }
}

fn write_json<T: Serialize>(path: &Path, value: &T, label: &str) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value).map_err(|e| format!("{label}序列化失败：{e}"))?;
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, text.as_bytes()).map_err(|e| format!("{label}保存失败：{e}"))?;
    fs::rename(&tmp, path).map_err(|e| format!("{label}保存失败：{e}"))?;
    Ok(())
}

pub fn read_data(app: &AppHandle) -> Result<DataFile, String> {
    read_json(&data_dir(app)?.join("data.json"), "账目文件")
}

pub fn write_data(app: &AppHandle, data: &DataFile) -> Result<(), String> {
    write_json(&data_dir(app)?.join("data.json"), data, "账目文件")
}

pub fn read_config(app: &AppHandle) -> Result<Config, String> {
    read_json(&data_dir(app)?.join("config.json"), "配置文件")
}

pub fn write_config(app: &AppHandle, config: &Config) -> Result<(), String> {
    write_json(&data_dir(app)?.join("config.json"), config, "配置文件")
}

pub fn read_key(app: &AppHandle) -> Result<String, String> {
    let path = data_dir(app)?.join("credentials.txt");
    match fs::read_to_string(path) {
        Ok(s) => Ok(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(format!("读取 API Key 失败：{e}")),
    }
}

pub fn write_key(app: &AppHandle, key: &str) -> Result<(), String> {
    let path = data_dir(app)?.join("credentials.txt");
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, key.trim().as_bytes()).map_err(|e| format!("保存 API Key 失败：{e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("保存 API Key 失败：{e}"))?;
    Ok(())
}
