import type { BuiltinProduct } from "../types";

/**
 * Builtin samples have no photo, so draw a small sticker sheet instead.
 * Stored as a data URL in the sticker record — no upload, no missing image.
 */
export function builtinStickerDataUrl(item: BuiltinProduct): string {
  const color = item.color || "#C4B3D6";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <rect width="240" height="240" rx="34" fill="${color}"/>
  <rect x="10" y="10" width="220" height="220" rx="28" fill="#FFFDF7" opacity=".55"/>
  <circle cx="120" cy="112" r="72" fill="#FFFDF7" opacity=".7"/>
  <text x="120" y="142" font-size="92" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif">${item.emoji}</text>
  <text x="120" y="206" font-size="17" text-anchor="middle" fill="#2B2A4C" font-family="system-ui, sans-serif" font-weight="700">${escapeXml(
    item.name
  )}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
