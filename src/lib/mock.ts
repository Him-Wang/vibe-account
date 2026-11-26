import type {
  AnimeResult,
  BuiltinProduct,
  Category,
  OcrResult,
  SegmentResult,
} from "../types";
import { getSettings } from "./settings";
import { today } from "./format";

export const DEFAULT_CATEGORIES: Omit<Category, "_id" | "hidden" | "isSystem">[] = [
  { kind: "product", name: "餐饮", icon: "🍜", color: "#E86A4A", sort: 1 },
  { kind: "product", name: "交通", icon: "🚇", color: "#F0A24A", sort: 2 },
  { kind: "product", name: "购物", icon: "🛍️", color: "#E05B5B", sort: 3 },
  { kind: "product", name: "娱乐", icon: "🎮", color: "#5BB98C", sort: 4 },
  { kind: "product", name: "居住", icon: "🏠", color: "#6B9BE0", sort: 5 },
  { kind: "product", name: "医疗", icon: "💊", color: "#B08BD8", sort: 6 },
  { kind: "product", name: "教育", icon: "📚", color: "#5BC0C4", sort: 7 },
  { kind: "product", name: "其他", icon: "📦", color: "#9B958F", sort: 8 },
  { kind: "date", name: "工作日", icon: "💼", color: "#6B9BE0", sort: 1 },
  { kind: "date", name: "周末", icon: "🌴", color: "#5BB98C", sort: 2 },
  { kind: "date", name: "节日", icon: "🎉", color: "#E86A4A", sort: 3 },
  { kind: "date", name: "旅行", icon: "✈️", color: "#B08BD8", sort: 4 },
];

export const BUILTIN_PRODUCTS: BuiltinProduct[] = [
  { name: "美式咖啡", emoji: "☕", categoryName: "餐饮", price: 2200, color: "#E86A4A" },
  { name: "拿铁", emoji: "🥛", categoryName: "餐饮", price: 2800, color: "#F0A24A" },
  { name: "面包", emoji: "🥐", categoryName: "餐饮", price: 1200, color: "#E8B04A" },
  { name: "地铁票", emoji: "🚇", categoryName: "交通", price: 500, color: "#6B9BE0" },
  { name: "出租车", emoji: "🚕", categoryName: "交通", price: 3200, color: "#F0A24A" },
  { name: "公交卡", emoji: "🚌", categoryName: "交通", price: 200, color: "#5BB98C" },
  { name: "口红", emoji: "💄", categoryName: "购物", price: 19900, color: "#E05B5B" },
  { name: "帆布包", emoji: "👜", categoryName: "购物", price: 8900, color: "#B08BD8" },
  { name: "耳机", emoji: "🎧", categoryName: "购物", price: 39900, color: "#5B7BE0" },
  { name: "电影票", emoji: "🎬", categoryName: "娱乐", price: 4500, color: "#5BB98C" },
  { name: "游戏皮肤", emoji: "🎮", categoryName: "娱乐", price: 6800, color: "#B08BD8" },
  { name: "演唱会票", emoji: "🎤", categoryName: "娱乐", price: 38000, color: "#E05B5B" },
  { name: "洗衣液", emoji: "🧴", categoryName: "居住", price: 3990, color: "#6B9BE0" },
  { name: "绿植", emoji: "🪴", categoryName: "居住", price: 2500, color: "#5BB98C" },
  { name: "感冒药", emoji: "💊", categoryName: "医疗", price: 1800, color: "#B08BD8" },
  { name: "教材", emoji: "📚", categoryName: "教育", price: 4990, color: "#5BC0C4" },
  { name: "奶茶", emoji: "🧋", categoryName: "餐饮", price: 1500, color: "#E8B04A" },
  { name: "纸巾", emoji: "🧻", categoryName: "其他", price: 990, color: "#9B958F" },
];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

async function gate(): Promise<void> {
  await sleep(600);
  const mode = getSettings().aiMockMode;
  if (mode === "fail") {
    throw new Error("AI 处理失败（Mock 演示）");
  }
  if (mode === "timeout") {
    throw new Error("AI 处理超时（Mock 演示）");
  }
}

export async function mockOcr(): Promise<OcrResult> {
  await gate();
  return {
    rawText: "街角咖啡\n美式咖啡 1 x 22.00 22.00\n拿铁咖啡 1 x 28.00 28.00\n合计 50.00",
    parsed: {
      merchant: "街角咖啡",
      date: today(),
      items: [
        { name: "美式咖啡", qty: 1, unitPrice: 2200, amount: 2200 },
        { name: "拿铁咖啡", qty: 1, unitPrice: 2800, amount: 2800 },
      ],
      totalAmount: 5000,
    },
    confidence: 0.96,
    provider: "mock",
  };
}

export async function mockSegment(): Promise<SegmentResult> {
  await gate();
  return { cutoutFileId: "", whiteBorder: true, provider: "mock" };
}

export async function mockAnime(style: string): Promise<AnimeResult> {
  await gate();
  return { animeFileId: "", style, provider: "mock" };
}

export function simulateProgress(
  onProgress: (p: number) => void,
  duration = 1500
): Promise<void> {
  const steps = 14;
  const interval = duration / steps;
  return new Promise((resolve) => {
    let p = 0;
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      p = Math.min(100, p + Math.random() * 16 + 6);
      if (i >= steps) {
        window.clearInterval(timer);
        onProgress(100);
        resolve();
        return;
      }
      onProgress(Math.round(p));
    }, interval);
  });
}
