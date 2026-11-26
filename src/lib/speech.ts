type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechResultLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechResultLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { isFinal: boolean; 0: { transcript: string } };
  };
};

function ctor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function speechSupported(): boolean {
  return ctor() !== null;
}

let active: SpeechRecognitionLike | null = null;

export function stopSpeech(): void {
  try {
    active?.stop();
  } catch {
    /* ignore */
  }
  active = null;
}

/**
 * Record one utterance with the browser's Web Speech API.
 * Resolves with the final transcript (or rejects with a Chinese message).
 */
export function listenOnce(onPartial?: (text: string) => void): Promise<string> {
  const Ctor = ctor();
  if (!Ctor) {
    return Promise.reject(new Error("当前浏览器不支持语音识别，请直接用文字输入"));
  }
  stopSpeech();
  const rec = new Ctor();
  active = rec;
  rec.lang = "zh-CN";
  rec.continuous = false;
  rec.interimResults = true;

  return new Promise((resolve, reject) => {
    let finalText = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      active = null;
      fn();
    };

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      onPartial?.((finalText + interim).trim());
    };
    rec.onerror = (event) => {
      const map: Record<string, string> = {
        "not-allowed": "麦克风权限被拒绝，请在浏览器里允许麦克风",
        "service-not-allowed": "浏览器未开放语音识别服务",
        "no-speech": "没有听到声音，再试一次",
        "audio-capture": "没有找到麦克风",
        network: "语音识别服务连接失败",
      };
      finish(() => reject(new Error(map[event.error] || `语音识别失败：${event.error}`)));
    };
    rec.onend = () => {
      const text = finalText.trim();
      if (!text) finish(() => reject(new Error("没有听清，再说一次试试")));
      else finish(() => resolve(text));
    };
    try {
      rec.start();
    } catch (err) {
      finish(() =>
        reject(new Error(err instanceof Error ? err.message : "无法启动语音识别"))
      );
    }
  });
}
