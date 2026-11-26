import type { OcrItem, OcrResult } from "../types";
import { getSettings } from "./settings";
import { today } from "./format";

export const VISION_PRESETS = [
  { id: "off", label: "不启用", baseUrl: "", model: "" },
  {
    id: "openai",
    label: "OpenAI 视觉",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  {
    id: "dashscope",
    label: "通义千问 VL",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-vl-plus",
  },
  { id: "custom", label: "自定义", baseUrl: "", model: "" },
];

export function hasVision(): boolean {
  const s = getSettings();
  return Boolean(
    s.visionPreset !== "off" &&
      s.visionBaseUrl.trim() &&
      s.visionModel.trim() &&
      s.visionApiKey.trim()
  );
}

function stripFence(raw: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(raw.trim());
  return fence ? fence[1].trim() : raw.trim();
}

/** Shrink a phone photo before sending it, so the request stays small. */
export async function downscaleImage(dataUrl: string, max = 1400): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl;
  const image = new Image();
  image.src = dataUrl;
  await image.decode().catch(() => undefined);
  if (!image.naturalWidth) return dataUrl;
  const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
  if (scale >= 1) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

interface VisionItem {
  name?: string;
  qty?: number | string;
  unitPrice?: number | string;
  amount?: number | string;
}

interface VisionPayload {
  merchant?: string;
  date?: string;
  items?: VisionItem[];
  totalAmount?: number | string;
}

function cents(value: number | string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

/**
 * Send the receipt image + the local OCR text to a vision model.
 * The model is asked to correct OCR mistakes, not to invent items.
 */
export async function refineReceiptWithVision(image: string, local: OcrResult): Promise<OcrResult> {
  const s = getSettings();
  if (!hasVision()) return local;
  const dataUrl = await downscaleImage(image);
  const system = [
    "你在核对一张中国消费小票。图片是原图，另有一段本地 OCR 文本。",
    "请以图片为准，修正 OCR 的错字和错位，不要编造没有出现的商品。",
    "只输出 JSON，不要解释，格式：",
    '{"merchant":"商家","date":"YYYY-MM-DD","items":[{"name":"商品","qty":1,"unitPrice":22.00}],"totalAmount":50.00}',
    "金额单位是元，保留两位小数；qty 默认 1。",
    `今天是 ${today()}，小票上没写日期就用今天。`,
  ].join("\n");

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(`${s.visionBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${s.visionApiKey}`,
      },
      body: JSON.stringify({
        model: s.visionModel,
        temperature: 0.1,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `本地 OCR 文本：\n${local.rawText.slice(0, 4000)}`,
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`视觉接口返回 ${res.status}${body ? `：${body.slice(0, 160)}` : ""}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("视觉模型没有返回内容");
    const payload = JSON.parse(stripFence(content)) as VisionPayload;
    const items: OcrItem[] = (payload.items || [])
      .map((item) => {
        const qty = Math.max(1, Math.round(Number(item.qty) || 1));
        const unit = cents(item.unitPrice) || cents(item.amount);
        return {
          name: String(item.name || "").trim() || "小票商品",
          qty,
          unitPrice: unit,
          amount: cents(item.amount) || unit * qty,
        };
      })
      .filter((item) => item.amount > 0);
    const total = cents(payload.totalAmount) || items.reduce((sum, item) => sum + item.amount, 0);
    if (items.length === 0 || total <= 0) throw new Error("视觉模型没有读出商品");
    return {
      rawText: local.rawText,
      parsed: {
        merchant: String(payload.merchant || local.parsed.merchant || "").trim(),
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(payload.date))
          ? String(payload.date)
          : local.parsed.date,
        items,
        totalAmount: total,
      },
      confidence: Math.max(local.confidence, 0.9),
      provider: `vision:${s.visionModel}`,
    };
  } finally {
    window.clearTimeout(timer);
  }
}
