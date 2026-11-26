import { createWorker } from "tesseract.js";
import type { OcrItem, OcrResult } from "../types";
import { today } from "./format";

type Worker = Awaited<ReturnType<typeof createWorker>>;

let workerPromise: Promise<Worker> | null = null;
let progressSink: ((p: number) => void) | null = null;

/**
 * One worker shared by every scan. The traineddata is cached by the browser
 * after the first load, so the second receipt is much quicker.
 */
function getWorker(onProgress?: (p: number) => void): Promise<Worker> {
  progressSink = onProgress || null;
  if (!workerPromise) {
    workerPromise = createWorker(["chi_sim", "eng"], 1, {
      logger: (message) => {
        if (
          progressSink &&
          typeof message.progress === "number" &&
          /recognizing|loading language/i.test(message.status || "")
        ) {
          progressSink(Math.round(message.progress * 100));
        }
      },
    }).catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

function cleanLine(line: string): string {
  return line
    .replace(/[|｜]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** OCR often inserts spaces between Chinese characters; glue them back. */
function tidyName(name: string): string {
  return name
    .replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, "$1")
    .replace(/[.·…]+$/g, "")
    .trim();
}

function toCents(value: string): number {
  return Math.round(Number(value.replace(/[^\d.]/g, "")) * 100);
}

function money(value: string): number | null {
  const m = /(\d+(?:\.\d{1,2})?)/.exec(value);
  if (!m) return null;
  const cents = toCents(m[1]);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

function normalizeDate(text: string): string {
  const full = /(20\d{2})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})/.exec(text);
  if (full) {
    return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
  }
  const short = /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/.exec(text);
  if (short) {
    const year = new Date().getFullYear();
    return `${year}-${short[1].padStart(2, "0")}-${short[2].padStart(2, "0")}`;
  }
  return today();
}

const SKIP =
  /(合计|总计|小计|应付|实付|支付|付款|找零|优惠|折扣|会员|发票|税额|数量|单价|商品名称|品名|二维码|电话|地址|单号|流水号|收银|欢迎|谢谢|小票|订单|\b(?:TOTAL|SUBTOTAL|AMOUNT|TAX|CASH|CHANGE|THANK|TEL|ADDRESS|RECEIPT|ORDER|INVOICE|QTY|PRICE|ITEM|CARD|VISA|MASTERCARD|DISCOUNT)\b)/i;

function parseItemLine(line: string): OcrItem | null {
  if (SKIP.test(line)) return null;
  // 美式咖啡 1 x 22.00 22.00  /  美式咖啡 1X22.00
  const qty = /^(.{2,40}?)\s+(\d{1,3})\s*[xX×*]\s*(\d+(?:\.\d{1,2})?)(?:\s+(\d+(?:\.\d{1,2})?))?$/.exec(line);
  if (qty) {
    const unit = toCents(qty[3]);
    const amount = qty[4] ? toCents(qty[4]) : unit * Number(qty[2]);
    const name = tidyName(qty[1]);
    if (!name || amount <= 0) return null;
    return { name, qty: Number(qty[2]) || 1, unitPrice: unit, amount };
  }
  // 美式咖啡 22.00
  const simple = /^(.{2,40}?)\s+[¥￥]?\s*(\d+(?:\.\d{1,2})?)\s*[元]?$/.exec(line);
  if (simple) {
    const amount = toCents(simple[2]);
    const name = tidyName(simple[1]);
    if (!name || amount <= 0) return null;
    if (!/[\u4e00-\u9fa5A-Za-z]/.test(name)) return null;
    return { name, qty: 1, unitPrice: amount, amount };
  }
  return null;
}

/**
 * Turn raw OCR text into the editable receipt shape used by ReceiptConfirm.
 * Handles the common "name qty x unit amount" and "name amount" layouts.
 */
export function parseReceiptText(rawText: string, confidence = 0, provider = "local-ocr"): OcrResult {
  const lines = rawText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  const merchantLine =
    lines.find((line) => !/\d{2,}/.test(line) && line.length <= 24 && !SKIP.test(line)) ||
    lines[0] ||
    "小票";
  const merchant =
    tidyName(merchantLine.replace(/[（(].*?[)）]/g, "").replace(/小票|发票/g, "")) || "小票";

  const dateLine = lines.find((line) => /(20\d{2}|\d{1,2}\s*月)\s*[年./-]?\s*\d{1,2}/.test(line));
  const date = normalizeDate(dateLine || rawText);

  let total = 0;
  for (const line of lines) {
    if (/合计|总计|小计|应付|实付|金额|\bTOTAL\b|\bAMOUNT\b/i.test(line)) {
      // A total row can contain "3 件 50.00"; the amount is the last number.
      const values = Array.from(line.matchAll(/(\d+(?:\.\d{1,2})?)/g)).map((m) => toCents(m[1]));
      const value = values.filter((n) => n > 0).pop() || 0;
      if (value > total) total = value;
    }
  }

  const items: OcrItem[] = [];
  for (const line of lines) {
    const item = parseItemLine(line);
    if (item) items.push(item);
  }

  if (items.length === 0) {
    if (total <= 0) {
      throw new Error("没在小票上读到金额，换一张清楚点的照片试试");
    }
    items.push({ name: merchant || "小票合计", qty: 1, unitPrice: total, amount: total });
  }
  const sum = items.reduce((s, item) => s + item.amount, 0);
  if (total <= 0) total = sum;

  return {
    rawText,
    parsed: { merchant, date, items, totalAmount: total },
    confidence: Math.max(0, Math.min(1, confidence / 100)),
    provider,
  };
}

/** OCR one receipt locally. The image never leaves the browser. */
export async function recognizeReceipt(
  image: string,
  onProgress?: (p: number) => void
): Promise<OcrResult> {
  if (!image) throw new Error("没有待识别的小票图片");
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(image);
  const text = (data.text || "").trim();
  if (!text) throw new Error("这张图里没读到字，换一张更清楚的试试");
  return parseReceiptText(text, data.confidence ?? 0);
}
