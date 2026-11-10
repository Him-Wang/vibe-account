import { invoke } from "@tauri-apps/api/core";
import type { AppState, Config, Draft, Expense, WhisperStatus } from "./types";

export const api = {
  loadState: () => invoke<AppState>("load_state"),
  parseAndAdd: (text: string) => invoke<Expense[]>("parse_and_add", { text }),
  addExpenses: (drafts: Draft[]) => invoke<Expense[]>("add_expenses", { drafts }),
  updateExpense: (expense: Expense) => invoke<void>("update_expense", { expense }),
  deleteExpense: (id: string) => invoke<void>("delete_expense", { id }),
  recognizeSpeech: () => invoke<string>("recognize_speech"),
  recognizeLocal: () => invoke<string>("recognize_local"),
  stopListening: () => invoke<void>("stop_listening"),
  whisperStatus: () => invoke<WhisperStatus>("whisper_status"),
  downloadWhisperModel: () => invoke<void>("download_whisper_model"),
  saveConfig: (config: Config) => invoke<void>("save_config", { config }),
  saveKey: (key: string) => invoke<void>("save_key", { key }),
  exportJson: () => invoke<string>("export_json"),
  importJson: (json: string) => invoke<number>("import_json", { json }),
};
