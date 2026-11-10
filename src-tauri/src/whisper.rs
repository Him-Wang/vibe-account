//! Local, offline speech-to-text via a bundled whisper.cpp binary and model.
//!
//! The `ggml-base-q5_1` model ships inside the installer (next to the binary).
//! If a build omits it, the model is downloaded once and cached under the app
//! data directory instead; recognition itself never touches the network.

use serde::Serialize;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

const MODEL_FILE: &str = "ggml-base-q5_1.bin";
const MODEL_URLS: [&str; 2] = [
    "https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin",
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin",
];

static DOWNLOADING: AtomicBool = AtomicBool::new(false);
static DOWNLOADED: AtomicU64 = AtomicU64::new(0);
static DOWNLOAD_TOTAL: AtomicU64 = AtomicU64::new(0);
static STOP_REQUESTED: AtomicBool = AtomicBool::new(false);

#[derive(Serialize)]
pub struct WhisperStatus {
    model_present: bool,
    binary_present: bool,
    downloading: bool,
    downloaded: u64,
    total: u64,
    model_size: u64,
}

fn bundled_model_path(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(dir) = app.path().resource_dir() {
        candidates.push(dir.join("whisper").join("models").join(MODEL_FILE));
        candidates.push(dir.join("models").join(MODEL_FILE));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(parent.join("whisper").join("models").join(MODEL_FILE));
            candidates.push(parent.join("models").join(MODEL_FILE));
        }
    }
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("whisper")
            .join("models")
            .join(MODEL_FILE),
    );
    candidates
        .into_iter()
        .find(|p| fs::metadata(p).map(|m| m.len() > 1_000_000).unwrap_or(false))
}

pub fn model_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(p) = bundled_model_path(app) {
        return Ok(p);
    }
    Ok(crate::storage::data_dir(app)?
        .join("models")
        .join(MODEL_FILE))
}

fn binary_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(p) = std::env::var("VIBE_WHISPER_BIN") {
        if !p.trim().is_empty() {
            let p = PathBuf::from(p);
            if p.is_file() {
                return Ok(p);
            }
        }
    }

    if let Ok(dir) = app.path().resource_dir() {
        for cand in [
            dir.join("whisper").join("whisper-cli.exe"),
            dir.join("whisper-cli.exe"),
        ] {
            if cand.is_file() {
                return Ok(cand);
            }
        }
    }

    let exe = std::env::current_exe().map_err(|e| format!("无法定位程序位置：{e}"))?;
    let dir = exe.parent().ok_or_else(|| "无法定位程序目录".to_string())?;
    for cand in [
        dir.join("whisper").join("whisper-cli.exe"),
        dir.join("whisper-cli.exe"),
    ] {
        if cand.is_file() {
            return Ok(cand);
        }
    }

    // Development fallback: the source tree next to src-tauri.
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("whisper")
        .join("whisper-cli.exe");
    if dev.is_file() {
        return Ok(dev);
    }

    Err("本地语音组件缺失。请重装应用，或先用 Windows 语音/文字输入。".to_string())
}

#[tauri::command]
pub fn whisper_status(app: AppHandle) -> Result<WhisperStatus, String> {
    let model = model_path(&app)?;
    let size = fs::metadata(&model).map(|m| m.len()).unwrap_or(0);
    Ok(WhisperStatus {
        model_present: size > 1_000_000,
        binary_present: binary_path(&app).is_ok(),
        downloading: DOWNLOADING.load(Ordering::Relaxed),
        downloaded: DOWNLOADED.load(Ordering::Relaxed),
        total: DOWNLOAD_TOTAL.load(Ordering::Relaxed),
        model_size: size,
    })
}

#[tauri::command]
pub async fn download_whisper_model(app: AppHandle) -> Result<(), String> {
    if DOWNLOADING.swap(true, Ordering::SeqCst) {
        return Err("模型已经在下载中。".to_string());
    }
    let result = download_inner(&app).await;
    DOWNLOADING.store(false, Ordering::SeqCst);
    result
}

async fn download_inner(app: &AppHandle) -> Result<(), String> {
    let dest = model_path(app)?;
    if fs::metadata(&dest).map(|m| m.len() > 1_000_000).unwrap_or(false) {
        return Ok(());
    }
    let dir = dest
        .parent()
        .ok_or_else(|| "模型目录无效".to_string())?
        .to_path_buf();
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建模型目录：{e}"))?;

    let part = dest.with_extension("download");
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30 * 60))
        .build()
        .map_err(|e| format!("初始化下载失败：{e}"))?;

    let mut last_err = String::new();
    for url in MODEL_URLS {
        let resp = match client.get(url).send().await {
            Ok(r) => r,
            Err(e) => {
                last_err = format!("连接下载服务器失败：{e}");
                continue;
            }
        };
        if !resp.status().is_success() {
            last_err = format!("下载服务器返回 HTTP {}", resp.status());
            continue;
        }
        DOWNLOAD_TOTAL.store(resp.content_length().unwrap_or(0), Ordering::Relaxed);
        DOWNLOADED.store(0, Ordering::Relaxed);

        let mut file = File::create(&part).map_err(|e| format!("无法写入模型文件：{e}"))?;
        let mut resp = resp;
        let mut failed: Option<String> = None;
        loop {
            match resp.chunk().await {
                Ok(Some(chunk)) => {
                    if let Err(e) = file.write_all(&chunk) {
                        failed = Some(format!("写入模型失败：{e}"));
                        break;
                    }
                    DOWNLOADED.fetch_add(chunk.len() as u64, Ordering::Relaxed);
                }
                Ok(None) => break,
                Err(e) => {
                    failed = Some(format!("下载中断：{e}"));
                    break;
                }
            }
        }
        drop(file);

        if let Some(e) = failed {
            let _ = fs::remove_file(&part);
            last_err = e;
            continue;
        }

        let size = fs::metadata(&part).map(|m| m.len()).unwrap_or(0);
        if size < 1_000_000 {
            let _ = fs::remove_file(&part);
            last_err = "下载到的模型文件不完整".to_string();
            continue;
        }

        fs::rename(&part, &dest).map_err(|e| format!("保存模型失败：{e}"))?;
        DOWNLOADED.store(size, Ordering::Relaxed);
        DOWNLOAD_TOTAL.store(size, Ordering::Relaxed);
        return Ok(());
    }

    Err(if last_err.is_empty() {
        "模型下载失败，请检查网络后重试。".to_string()
    } else {
        last_err
    })
}

#[tauri::command]
pub fn stop_listening() {
    STOP_REQUESTED.store(true, Ordering::Relaxed);
}

#[tauri::command]
pub async fn recognize_local(app: AppHandle) -> Result<String, String> {
    STOP_REQUESTED.store(false, Ordering::Relaxed);
    let model = model_path(&app)?;
    if fs::metadata(&model).map(|m| m.len() > 1_000_000).unwrap_or(false) == false {
        return Err("本地语音模型还没准备好。请稍等下载完成，或直接用文字输入。".to_string());
    }
    let bin = binary_path(&app)?;
    let cache = crate::storage::data_dir(&app)?.join("cache");
    fs::create_dir_all(&cache).map_err(|e| format!("无法创建缓存目录：{e}"))?;
    let wav = cache.join("record.wav");

    let wav_for_task = wav.clone();
    let wav_arg = wav.clone();
    tauri::async_runtime::spawn_blocking(move || record_wav(&wav_for_task))
        .await
        .map_err(|e| format!("录音线程异常：{e}"))??;

    let output = tauri::async_runtime::spawn_blocking(move || {
        std::process::Command::new(&bin)
            .arg("-m")
            .arg(&model)
            .arg("-f")
            .arg(&wav_arg)
            .arg("-l")
            .arg("zh")
            .arg("-nt")
            .arg("-t")
            .arg("4")
            .output()
    })
    .await
    .map_err(|e| format!("识别线程异常：{e}"))?
    .map_err(|e| format!("无法启动本地语音识别：{e}"))?;

    let _ = fs::remove_file(&wav);

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        let tail: String = err.lines().rev().take(3).collect::<Vec<_>>().join(" / ");
        return Err(format!("本地识别失败：{tail}"));
    }

    let text = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .filter(|l| !l.starts_with("whisper_") && !l.starts_with('['))
        .collect::<Vec<_>>()
        .join(" ");

    let text = text.trim().to_string();
    if text.is_empty() {
        return Err("没有听清。请靠近麦克风再说一次，或直接输入文字。".to_string());
    }
    Ok(text)
}

struct Sink {
    buf: Arc<Mutex<Vec<f32>>>,
    done: Arc<AtomicBool>,
    started: Arc<AtomicBool>,
    silent: usize,
    rate: u32,
    max: usize,
}

impl Sink {
    fn feed(&mut self, data: &[f32], channels: usize) {
        if self.done.load(Ordering::Relaxed) || data.is_empty() {
            return;
        }
        let ch = channels.max(1);
        let mut mono = Vec::with_capacity(data.len() / ch);
        for frame in data.chunks(ch) {
            mono.push(frame.iter().copied().sum::<f32>() / ch as f32);
        }
        if mono.is_empty() {
            return;
        }
        let rms = (mono.iter().map(|v| v * v).sum::<f32>() / mono.len() as f32).sqrt();
        if rms > 0.008 {
            self.started.store(true, Ordering::Relaxed);
            self.silent = 0;
        } else {
            self.silent += mono.len();
        }
        let mut b = self.buf.lock().unwrap();
        b.extend_from_slice(&mono);
        let enough = b.len() >= self.max;
        drop(b);
        let silence_done = self.started.load(Ordering::Relaxed)
            && self.silent > (self.rate as usize * 4 / 5).max(1);
        if enough || silence_done {
            self.done.store(true, Ordering::Relaxed);
        }
    }
}

fn record_wav(path: &Path) -> Result<(), String> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "没有找到麦克风。请检查麦克风连接，或直接用文字输入。".to_string())?;
    let supported = device
        .default_input_config()
        .map_err(|e| format!("无法读取麦克风配置：{e}"))?;

    let format = supported.sample_format();
    let config: cpal::StreamConfig = supported.config();
    let rate = config.sample_rate.0;
    let channels = config.channels as usize;
    if rate == 0 || channels == 0 {
        return Err("麦克风配置异常。".to_string());
    }

    let buf: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::with_capacity(rate as usize * 8)));
    let done = Arc::new(AtomicBool::new(false));
    let started = Arc::new(AtomicBool::new(false));

    let make_sink = || Sink {
        buf: buf.clone(),
        done: done.clone(),
        started: started.clone(),
        silent: 0,
        rate,
        max: rate as usize * 15,
    };

    let stream = match format {
        cpal::SampleFormat::F32 => {
            let mut sink = make_sink();
            device.build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| sink.feed(data, channels),
                |e| eprintln!("录音错误：{e}"),
                None,
            )
        }
        cpal::SampleFormat::I16 => {
            let mut sink = make_sink();
            device.build_input_stream(
                &config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    let v: Vec<f32> = data.iter().map(|s| *s as f32 / 32768.0).collect();
                    sink.feed(&v, channels);
                },
                |e| eprintln!("录音错误：{e}"),
                None,
            )
        }
        other => return Err(format!("暂不支持这种麦克风格式：{other:?}")),
    }
    .map_err(|e| format!("无法打开麦克风：{e}。请在 设置 → 隐私 → 麦克风 中允许桌面应用访问。"))?;

    stream
        .play()
        .map_err(|e| format!("无法开始录音：{e}"))?;

    let start = Instant::now();
    while !done.load(Ordering::Relaxed)
        && !STOP_REQUESTED.load(Ordering::Relaxed)
        && start.elapsed() < Duration::from_secs(16)
    {
        std::thread::sleep(Duration::from_millis(80));
    }
    drop(stream);

    if !started.load(Ordering::Relaxed) {
        return Err("没有听到声音。请靠近麦克风再说一次，或直接输入文字。".to_string());
    }

    let samples = buf.lock().unwrap().clone();
    if samples.len() < rate as usize / 3 {
        return Err("录音太短。请说完一句再停顿，或直接输入文字。".to_string());
    }

    let pcm = resample(&samples, rate, 16_000);
    write_wav(path, &pcm, 16_000)
}

fn resample(input: &[f32], from: u32, to: u32) -> Vec<f32> {
    if from == to || input.is_empty() {
        return input.to_vec();
    }
    let ratio = from as f64 / to as f64;
    let out_len = (input.len() as f64 / ratio).round() as usize;
    let mut out = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let pos = i as f64 * ratio;
        let i0 = pos.floor() as usize;
        let i1 = (i0 + 1).min(input.len() - 1);
        let t = (pos - i0 as f64) as f32;
        out.push(input[i0] * (1.0 - t) + input[i1] * t);
    }
    out
}

fn write_wav(path: &Path, samples: &[f32], rate: u32) -> Result<(), String> {
    let mut f = File::create(path).map_err(|e| format!("无法写入录音文件：{e}"))?;
    let data_len = (samples.len() * 2) as u32;
    let byte_rate = rate * 2;
    f.write_all(b"RIFF").map_err(|e| e.to_string())?;
    f.write_all(&(36 + data_len).to_le_bytes())
        .map_err(|e| e.to_string())?;
    f.write_all(b"WAVEfmt ").map_err(|e| e.to_string())?;
    f.write_all(&16u32.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&1u16.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&1u16.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&rate.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&byte_rate.to_le_bytes())
        .map_err(|e| e.to_string())?;
    f.write_all(&2u16.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&16u16.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(b"data").map_err(|e| e.to_string())?;
    f.write_all(&data_len.to_le_bytes()).map_err(|e| e.to_string())?;
    let mut bytes = Vec::with_capacity(samples.len() * 2);
    for s in samples {
        let v = (s.clamp(-1.0, 1.0) * 32767.0) as i16;
        bytes.extend_from_slice(&v.to_le_bytes());
    }
    f.write_all(&bytes).map_err(|e| format!("写入录音失败：{e}"))?;
    Ok(())
}
