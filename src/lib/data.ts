import type { Bill, Category, JournalBook, JournalPage, Sticker } from "../types";
import { collection } from "./db";
import { categoryService } from "./categories";
import { resetSettings } from "./settings";

export interface Backup {
  app: "vibe-account";
  version: 1;
  exportedAt: string;
  bills: Bill[];
  categories: Category[];
  stickers: Sticker[];
  journalBooks: JournalBook[];
  journals: JournalPage[];
}

const NAMES = ["bills", "categories", "stickers", "journalBooks", "journals"] as const;

export const dataService = {
  exportAll(): string {
    const payload: Backup = {
      app: "vibe-account",
      version: 1,
      exportedAt: new Date().toISOString(),
      bills: collection<Bill>("bills").all(),
      categories: collection<Category>("categories").all(),
      stickers: collection<Sticker>("stickers").all(),
      journalBooks: collection<JournalBook>("journalBooks").all(),
      journals: collection<JournalPage>("journals").all(),
    };
    return JSON.stringify(payload, null, 2);
  },

  /** Merge a backup into local data, skipping rows whose _id already exists. */
  importAll(json: string): number {
    const parsed = JSON.parse(json) as Partial<Backup>;
    if (!parsed || typeof parsed !== "object") throw new Error("文件格式不正确");
    let added = 0;
    const merge = <T extends { _id: string }>(name: string, incoming?: T[]) => {
      if (!Array.isArray(incoming)) return;
      const rows = collection<T>(name).all();
      const ids = new Set(rows.map((r) => r._id));
      for (const row of incoming) {
        if (!row || typeof row._id !== "string" || ids.has(row._id)) continue;
        rows.push(row);
        ids.add(row._id);
        added += 1;
      }
      collection<T>(name).write(rows);
    };
    merge<Bill>("bills", parsed.bills);
    merge<Category>("categories", parsed.categories);
    merge<Sticker>("stickers", parsed.stickers);
    merge<JournalBook>("journalBooks", parsed.journalBooks);
    merge<JournalPage>("journals", parsed.journals);
    categoryService.ensureSeeded();
    return added;
  },

  clearAll(): void {
    for (const name of NAMES) collection(name).write([]);
    resetSettings();
    categoryService.ensureSeeded();
  },

  async copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  },
};
