import { getSettings, hasImageGen } from "./settings";

export const IMAGE_PRESETS = [
  { id: "off", label: "不启用", baseUrl: "https://api.openai.com/v1", model: "gpt-image-1" },
  { id: "openai", label: "OpenAI 图片", baseUrl: "https://api.openai.com/v1", model: "gpt-image-1" },
  { id: "custom", label: "自定义接口", baseUrl: "https://api.openai.com/v1", model: "gpt-image-1" },
] as const;

const STYLE_PROMPT: Record<string, string> = {
  cute: "a soft cute sticker illustration, rounded shapes, pastel colors, clean transparent background",
  comic: "a bold comic book sticker illustration, thick ink lines, halftone dots, clean transparent background",
  oil: "an expressive oil painting sticker, visible brush strokes, warm light, clean transparent background",
  sketch: "a delicate pencil sketch sticker, cross-hatching, paper texture, clean transparent background",
};

/** 把商品照片按所选画风交给 OpenAI 兼容的 /images/edits 接口。 */
export async function stylizeProduct(image: string, style: string): Promise<string> {
  if (!hasImageGen()) throw new Error("还没有配置图片生成接口");
  const settings = getSettings();
  const base = settings.imageBaseUrl.replace(/\/+$/, "");
  const source = await fetch(image).then((r) => r.blob());
  const form = new FormData();
  form.append("model", settings.imageModel.trim());
  form.append("image", source, "product.png");
  form.append(
    "prompt",
    `Turn this product photo into ${STYLE_PROMPT[style] || STYLE_PROMPT.cute}. Keep the product recognizable, no text, no watermark.`
  );
  form.append("size", "1024x1024");
  form.append("response_format", "b64_json");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const res = await fetch(`${base}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.imageApiKey.trim()}` },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`图片接口返回 ${res.status}${detail ? `：${detail.slice(0, 100)}` : ""}`);
    }
    const data = (await res.json()) as {
      data?: { b64_json?: string; url?: string }[];
    };
    const first = data.data?.[0];
    if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
    if (first?.url) return first.url;
    throw new Error("图片接口没有返回图片");
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("图片生成超时了，再试一次");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
