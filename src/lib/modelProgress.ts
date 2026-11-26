/**
 * Shared helpers for transformers.js v4 model loading.
 *
 * transformers.js emits several statuses while loading a model. The important
 * one for a usable progress bar is `progress_total`: it is the aggregate of all
 * files (per-file `progress` events alone sit at 0% for most of the download).
 * These helpers turn that noisy stream into a single 0..1 ratio and make sure a
 * stalled download cannot hang the UI forever.
 */

export interface ModelProgressInfo {
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

interface Handlers {
  onProgress?: (ratio: number) => void;
  onPhase?: (phase: string) => void;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Build a transformers.js `progress_callback` that reports a real 0..1 ratio. */
export function makeModelProgress({ onProgress, onPhase }: Handlers) {
  let sawAggregate = false;
  let lastRatio = 0;

  return (info: ModelProgressInfo) => {
    if (!info) return;
    const value = typeof info.progress === "number" && Number.isFinite(info.progress)
      ? info.progress
      : null;

    switch (info.status) {
      case "initiate":
      case "download":
        onPhase?.("正在下载模型…");
        break;
      case "progress_total":
        // Aggregate across all files -- the only trustworthy download ratio.
        if (value !== null) {
          sawAggregate = true;
          lastRatio = clamp(value / 100);
          onProgress?.(lastRatio * 0.9);
        }
        break;
      case "progress":
        // Per-file bytes. Only useful when metadata prefetch failed and no
        // aggregate event is emitted at all.
        if (value !== null && !sawAggregate) {
          lastRatio = clamp(value / 100);
          onProgress?.(lastRatio * 0.9);
        }
        break;
      case "done":
        onPhase?.("模型已下载，正在加载…");
        onProgress?.(0.92);
        break;
      case "ready":
        onProgress?.(0.98);
        break;
      default:
        break;
    }
  };
}

/**
 * A promise that rejects if nothing "kicks" it for `timeoutMs`. Call `kick()`
 * on every progress event so slow-but-moving downloads survive, while a truly
 * stalled one surfaces a clear error instead of freezing the UI at 0%.
 */
export function createDeadline(timeoutMs: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let rejectDeadline: ((reason: Error) => void) | null = null;
  const promise = new Promise<never>((_, reject) => {
    rejectDeadline = reject;
  });

  const kick = () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => rejectDeadline?.(new Error(message)), timeoutMs);
  };
  kick();

  return {
    promise,
    kick,
    cancel: () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
