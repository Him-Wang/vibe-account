import { getSettings } from "./settings";

export const ASR_PRESETS = [
  { id: "off", label: "不启用（用浏览器语音）", baseUrl: "", model: "" },
  {
    id: "openai",
    label: "OpenAI Whisper",
    baseUrl: "https://api.openai.com/v1",
    model: "whisper-1",
  },
  {
    id: "custom",
    label: "自定义转写接口",
    baseUrl: "",
    model: "",
  },
];

export function hasAsr(): boolean {
  const s = getSettings();
  return Boolean(
    s.asrPreset !== "off" &&
      s.asrBaseUrl.trim() &&
      s.asrModel.trim() &&
      s.asrApiKey.trim()
  );
}

export function recordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export interface Recorder {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

/** Click once to start, click again to stop — the caller owns that toggle. */
export async function startRecording(): Promise<Recorder> {
  if (!recordingSupported()) {
    throw new Error("这个浏览器不能录音，换 Chrome / Edge 或直接打字");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start();

  let stopped = false;
  const cleanup = () => {
    stream.getTracks().forEach((track) => track.stop());
  };
  const stop = () =>
    new Promise<Blob>((resolve, reject) => {
      if (stopped) {
        reject(new Error("录音已经结束"));
        return;
      }
      stopped = true;
      recorder.onstop = () => {
        cleanup();
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) reject(new Error("没有录到声音，再说一次"));
        else resolve(blob);
      };
      recorder.stop();
    });
  const cancel = () => {
    stopped = true;
    try {
      recorder.stop();
    } catch {
      /* ignore */
    }
    cleanup();
  };
  return { stop, cancel };
}

/** OpenAI-compatible /audio/transcriptions. Only used when an ASR key is set. */
export async function transcribeAudio(blob: Blob): Promise<string> {
  const s = getSettings();
  if (!hasAsr()) throw new Error("还没有配置转写接口");
  const form = new FormData();
  form.append("file", blob, "voice.webm");
  form.append("model", s.asrModel);
  form.append("language", "zh");
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(`${s.asrBaseUrl.replace(/\/+$/, "")}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${s.asrApiKey}` },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`转写接口返回 ${res.status}${body ? `：${body.slice(0, 160)}` : ""}`);
    }
    const json = (await res.json()) as { text?: string };
    const text = (json.text || "").trim();
    if (!text) throw new Error("没有转出文字，再说一次");
    return text;
  } finally {
    window.clearTimeout(timer);
  }
}
