/**
 * Bridge to the on-device native cutout engine in the Android / iOS apps.
 *
 * On the web this is a no-op: Capacitor.isNativePlatform() is false and
 * nativeCutout() returns null, so the existing WASM pipeline runs unchanged.
 * Inside the packaged apps the CutoutPlugin performs inference with a model
 * bundled in the installer — no network download at runtime.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

interface CutoutPlugin {
  cutout(options: { image: string }): Promise<{ image: string }>;
}

let plugin: CutoutPlugin | null | undefined;

export function nativeCutoutAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Returns a PNG data URL produced by the native engine, or null when the
 * native engine is unavailable / failed (caller then falls back to WASM).
 */
export async function nativeCutout(
  image: string,
  onPhase?: (phase: string) => void
): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    if (plugin === undefined) {
      plugin = registerPlugin<CutoutPlugin>("CutoutPlugin");
    }
    onPhase?.("正在用内置模型抠图…");
    const result = await plugin!.cutout({ image });
    const data = result?.image;
    if (!data || typeof data !== "string") return null;
    if (data.startsWith("data:image")) return data;
    // Native side may return raw base64 without the data-URL prefix.
    return `data:image/png;base64,${data}`;
  } catch {
    // Plugin missing or inference failed — fall back to the WASM path.
    return null;
  }
}
