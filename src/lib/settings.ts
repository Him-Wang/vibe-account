import { useSyncExternalStore } from "react";
import type { Settings } from "../types";
import { readKey, writeKey } from "./storage";

const DEFAULTS: Settings = {
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  apiKey: "",
  glass: true,
  aiMockMode: "auto",
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
