import { useSyncExternalStore } from "react";
import type { Settings } from "../types";
import { readKey, removeKey, writeKey } from "./storage";

const DEFAULTS: Settings = {
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  apiKey: "",
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
