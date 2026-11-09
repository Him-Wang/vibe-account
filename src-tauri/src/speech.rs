#[cfg(windows)]
pub fn recognize() -> Result<String, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(recognize_inner());
    });
    match rx.recv_timeout(std::time::Duration::from_secs(28)) {
        Ok(r) => r,
        Err(_) => Err("语音识别超时。请靠近麦克风再说一次，或直接用文字输入。".to_string()),
    }
}

#[cfg(windows)]
fn recognize_inner() -> Result<String, String> {
    use windows::Media::SpeechRecognition::{SpeechRecognitionResultStatus, SpeechRecognizer};
    use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};

    unsafe {
        let _ = RoInitialize(RO_INIT_MULTITHREADED);
    }

    let recognizer = SpeechRecognizer::new().map_err(|e| {
        format!("无法启动语音识别：{e}。请确认 Windows 已安装“中文(简体)”语音识别组件。")
    })?;

    let operation = recognizer.RecognizeAsync().map_err(|e| {
        format!("无法打开麦克风：{e}。请在 Windows 设置 → 隐私和安全性 → 麦克风中允许桌面应用访问。")
    })?;

    let result = operation
        .get()
        .map_err(|e| format!("等待语音识别结果失败：{e}"))?;

    let status = result
        .Status()
        .map_err(|e| format!("读取语音识别状态失败：{e}"))?;

    if status != SpeechRecognitionResultStatus::Success {
        return Err(match status {
            SpeechRecognitionResultStatus::UserCanceled => "已取消语音识别。".to_string(),
            SpeechRecognitionResultStatus::TopicLanguageNotSupported
            | SpeechRecognitionResultStatus::GrammarLanguageMismatch => {
                "Windows 没有中文语音识别组件。请到 设置 → 时间和语言 → 语言和区域 添加“中文(简体)”并安装语音包，或直接用文字输入。".to_string()
            }
            SpeechRecognitionResultStatus::MicrophoneUnavailable => {
                "麦克风不可用。请检查麦克风是否接好，并在 设置 → 隐私和安全性 → 麦克风 中允许桌面应用访问。".to_string()
            }
            SpeechRecognitionResultStatus::TimeoutExceeded
            | SpeechRecognitionResultStatus::AudioQualityFailure => {
                "没有听清（可能太吵或没说话）。请再说一遍，或直接输入文字。".to_string()
            }
            SpeechRecognitionResultStatus::NetworkFailure => {
                "语音识别需要联网，当前网络异常。可重试，或直接输入文字。".to_string()
            }
            _ => "语音识别失败。可重试，或直接输入文字。".to_string(),
        });
    }

    let text = result
        .Text()
        .map_err(|e| format!("读取识别文字失败：{e}"))?
        .to_string();

    if text.trim().is_empty() {
        return Err("没有识别到内容，请重试或手动输入。".to_string());
    }
    Ok(text)
}

#[cfg(not(windows))]
pub fn recognize() -> Result<String, String> {
    Err("当前版本仅支持 Windows 语音识别，请直接输入文字。".to_string())
}
