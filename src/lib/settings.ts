import { useSyncExternalStore } from "react";
import type { Settings } from "../types";
import { readKey, removeKey, writeKey } from "./storage";

// 公开演示用的 Workers AI 中转。它只能调用这台 Worker 上的免费模型，
// 口令会出现在前端里，等于“公开的演示额度”，不要把它当成私密 Key。
const PUBLIC_WORKER_BASE = "https://suikouji-ai.crushlens.workers.dev/v1";
const PUBLIC_WORKER_MODEL = "workers-ai";
const PUBLIC_WORKER_TOKEN = "27802adcfda14cc398930f31d286fc6f";

const DEFAULTS: Settings = {
  baseUrl: PUBLIC_WORKER_BASE,
  model: PUBLIC_WORKER_MODEL,
  apiKey: PUBLIC_WORKER_TOKEN,
  glass: true,
  aiMockMode: "auto",
  visionPreset: "off",
  visionBaseUrl: "https://api.openai.com/v1",
  visionModel: "gpt-4o-mini",
  visionApiKey: "",
  asrPreset: "off",
  asrBaseUrl: "https://api.openai.com/v1",
  asrModel: "whisper-1",
  asrApiKey: "",
  imagePreset: "off",
  imageBaseUrl: "https://api.openai.com/v1",
  imageModel: "gpt-image-1",
  imageApiKey: "",
};

let state: Settings = { ...DEFAULTS, ...readKey<Partial<Settings>>("settings", {}) };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function applyGlass() {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.glass = state.glass ? "on" : "off";
  }
}

applyGlass();

export function getSettings(): Settings {
  return state;
}

export function saveSettings(patch: Partial<Settings>): void {
  state = { ...state, ...patch };
  writeKey("settings", state);
  applyGlass();
  emit();
}

/** 清空本机数据时一起抹掉接口与 Key，避免“删了全部”还残留配置。 */
export function resetSettings(): void {
  state = { ...DEFAULTS };
  removeKey("settings");
  applyGlass();
  emit();
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => state,
    () => state
  );
}

export function hasApiKey(): boolean {
  return state.apiKey.trim().length > 0;
}

export function hasImageGen(): boolean {
  return (
    state.imagePreset !== "off" &&
    state.imageBaseUrl.trim().length > 0 &&
    state.imageModel.trim().length > 0 &&
    state.imageApiKey.trim().length > 0
  );
}
