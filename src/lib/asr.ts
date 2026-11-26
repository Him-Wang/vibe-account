import { getSettings } from "./settings";
import { createDeadline, makeModelProgress } from "./modelProgress";

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

type LocalTranscriber = (
  audio: Float32Array,
  options?: { language?: string; task?: string }
) => Promise<{ text?: string }>;

let transcriberPromise: Promise<LocalTranscriber> | null = null;

async function loadLocalTranscriber(
  onProgress?: (ratio: number) => void,
  onPhase?: (phase: string) => void
): Promise<LocalTranscriber> {
  const mod = await import("@huggingface/transformers");
  const env = mod.env as { remoteHost?: string };
  let lastError: unknown;
  for (const host of ["https://hf-mirror.com", "https://huggingface.co"]) {
    const deadline = createDeadline(180_000, "本地语音模型下载超时，检查网络后再试一次");
    const progress = makeModelProgress({ onProgress, onPhase });
    try {
      env.remoteHost = host;
      const loadedPromise = mod.pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
        dtype: "q8",
        device: "wasm",
        progress_callback: (info) => {
          progress(info);
          deadline.kick();
        },
      });
      loadedPromise.catch(() => undefined);
      const loaded = await Promise.race([loadedPromise, deadline.promise]);
      deadline.cancel();
      onProgress?.(1);
      return loaded as unknown as LocalTranscriber;
    } catch (err) {
      deadline.cancel();
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("本地语音模型没加载下来");
}

function getLocalTranscriber(
  onProgress?: (ratio: number) => void,
  onPhase?: (phase: string) => void
): Promise<LocalTranscriber> {
  if (!transcriberPromise) {
    transcriberPromise = loadLocalTranscriber(onProgress, onPhase).catch((err) => {
      transcriberPromise = null;
      throw err;
    });
  }
  return transcriberPromise;
}

function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const length = Math.max(1, Math.round((input.length * to) / from));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const pos = (i * from) / to;
    const i0 = Math.floor(pos);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const frac = pos - i0;
    output[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return output;
}

function mono(buffer: AudioBuffer): Float32Array {
  const left = buffer.getChannelData(0);
  if (buffer.numberOfChannels === 1) return new Float32Array(left);
  const right = buffer.getChannelData(1);
  const out = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) {
    out[i] = (Math.SQRT2 * (left[i] + right[i])) / 2;
  }
  return out;
}

async function blobToAudio(blob: Blob): Promise<Float32Array> {
  const Ctor = window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error("这个浏览器不能解码录音，换 Chrome / Edge 试试");
  const bytes = await blob.arrayBuffer();
  // iOS Safari rejects a forced 16kHz context; fall back to the native rate
  // and resample to the 16kHz Whisper expects.
  let ctx: AudioContext;
  try {
    ctx = new Ctor({ sampleRate: 16000 });
  } catch {
    ctx = new Ctor();
  }
  try {
    const buffer = await ctx.decodeAudioData(bytes);
    return resample(mono(buffer), buffer.sampleRate, 16000);
  } finally {
    void ctx.close();
  }
}

/** Offline fallback: runs Whisper-tiny (q8) locally, no API key or upload. */
export async function transcribeLocal(
  blob: Blob,
  onProgress?: (ratio: number) => void,
  onPhase?: (phase: string) => void
): Promise<string> {
  const transcriber = await getLocalTranscriber(onProgress, onPhase);
  onPhase?.("正在本地识别语音…");
  onProgress?.(1);
  const audio = await blobToAudio(blob);
  const result = await transcriber(audio, { language: "chinese", task: "transcribe" });
  const text = (result?.text || "").trim();
  if (!text) throw new Error("没有听清，再说一次");
  return text;
}
