import type { Category } from "../types";
import { getSettings, hasApiKey } from "./settings";
import { categoryService } from "./categories";
import { today, formatDate } from "./format";

export interface ParsedBill {
  amount_cents: number;
  category: string;
  note: string;
  date: string;
  merchant?: string;
}

const KEYWORDS: { name: string; words: string[] }[] = [
  { name: "餐饮", words: ["吃", "饭", "早餐", "午餐", "晚餐", "夜宵", "咖啡", "奶茶", "火锅", "烧烤", "外卖", "面", "粉", "汉堡", "披萨", "甜品", "蛋糕", "零食", "水果", "食堂", "探店", "喝了", "饮料"] },
  { name: "交通", words: ["打车", "地铁", "公交", "高铁", "火车", "机票", "飞机", "滴滴", "加油", "停车", "过路费", "共享单车", "骑车", "出租车", "网约车"] },
  { name: "购物", words: ["买", "衣服", "鞋", "裤", "包", "化妆品", "护肤", "口红", "数码", "耳机", "充电", "淘宝", "京东", "拼多多", "超市", "日用品", "逛"] },
  { name: "娱乐", words: ["电影", "游戏", "唱歌", "ktv", "演出", "演唱会", "门票", "会员", "视频", "音乐", "桌游", "剧本杀", "旅游", "景点"] },
  { name: "居住", words: ["房租", "水费", "电费", "燃气", "物业", "宽带", "话费", "家居", "家具", "清洁", "洗衣", "修理", "快递"] },
  { name: "医疗", words: ["药", "医院", "挂号", "体检", "看病", "牙", "诊所", "疫苗", "医保"] },
  { name: "教育", words: ["书", "教材", "课程", "学费", "培训", "考试", "网课", "文具", "打印"] },
  { name: "其他", words: ["红包", "礼物", "份子", "请客", "转账", "孝敬", "随礼"] },
];

const DATE_WORDS: { word: string; offset: number }[] = [
  { word: "大前天", offset: -3 },
  { word: "前天", offset: -2 },
  { word: "昨天", offset: -1 },
  { word: "今天", offset: 0 },
];

function shiftDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function pickDate(segment: string): string {
  for (const item of DATE_WORDS) {
    if (segment.includes(item.word)) return shiftDate(item.offset);
  }
  const m = segment.match(/(\d{1,2})月(\d{1,2})[日号]/);
  if (m) {
    const year = new Date().getFullYear();
    return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return today();
}

function pickCategory(segment: string): string {
  const lower = segment.toLowerCase();
  for (const group of KEYWORDS) {
    if (group.words.some((w) => lower.includes(w))) return group.name;
  }
  return "其他";
}

function pickAmount(segment: string): number | null {
  const withUnit = /(\d+(?:\.\d+)?)\s*(?:元|块钱|块|圆|rmb|¥|￥)/i.exec(segment);
  if (withUnit) return Math.round(Number(withUnit[1]) * 100);
  const list = Array.from(segment.matchAll(/(\d+(?:\.\d+)?)/g)).map((m) => Number(m[1]));
  if (list.length === 0) return null;
  // "12块5" style: first number is the yuan part
  const first = list[0];
  if (/^(?:块|元)?\s*[0-9]$/.test(segment.slice(segment.indexOf(String(first)) + String(first).length))) {
    return Math.round(first * 100) + list[1] * 10;
  }
  return Math.round(list[list.length - 1] * 100);
}

function cleanNote(segment: string): string {
  return segment
    .replace(/\d+(?:\.\d+)?\s*(?:元|块钱|块|圆|rmb|¥|￥)?/gi, " ")
    .replace(/(?:今天|昨天|前天|大前天)/g, " ")
    .replace(/[，,。；;、\s]+/g, " ")
    .trim();
}

/** Local, offline fallback parser: splits a Chinese sentence into expenses. */
export function heuristicParse(text: string): ParsedBill[] {
  const segments = text
    .split(/[，,。；;\n]+|(?<=\d)\s*和\s*|\s+和\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const result: ParsedBill[] = [];
  for (const segment of segments) {
    const cents = pickAmount(segment);
    if (cents === null || cents <= 0) continue;
    const category = pickCategory(segment);
    const note = cleanNote(segment) || category;
    result.push({
      amount_cents: cents,
      category,
      note,
      date: pickDate(segment),
    });
  }
  if (result.length === 0) {
    const cents = pickAmount(text);
    if (cents && cents > 0) {
      result.push({
        amount_cents: cents,
        category: pickCategory(text),
        note: cleanNote(text) || "一笔支出",
        date: pickDate(text),
      });
    }
  }
  return result;
}

interface LlmRow {
  amount?: number | string;
  amount_cents?: number | string;
  category?: string;
  note?: string;
  date?: string;
  merchant?: string;
}

function stripFence(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  return fence ? fence[1].trim() : trimmed;
}

async function llmParse(text: string): Promise<ParsedBill[]> {
  const { baseUrl, model, apiKey } = getSettings();
  const system = [
    "你是记账助手。把用户的一句话拆成若干笔支出，只输出 JSON 数组，不要任何解释。",
    '每一项格式：{"amount": 金额(元, 数字), "category": "类别", "note": "简短备注", "date": "YYYY-MM-DD"}',
    "类别只能从以下选：餐饮、交通、购物、娱乐、居住、医疗、教育、其他。",
    `今天是 ${today()}。用户没提日期就用今天；提了「昨天/前天」要换算成具体日期。`,
    "金额是支出金额，不要输出负数或货币符号。",
  ].join("\n");

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`模型接口返回 ${res.status}${body ? `：${body.slice(0, 160)}` : ""}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("模型没有返回内容");
    const parsed = JSON.parse(stripFence(content)) as LlmRow[];
    if (!Array.isArray(parsed)) throw new Error("模型返回的不是数组");
    const rows: ParsedBill[] = [];
    for (const row of parsed) {
      const yuan = Number(row.amount_cents ?? row.amount ?? 0);
      const cents = row.amount_cents != null ? Math.round(yuan) : Math.round(yuan * 100);
      if (!Number.isFinite(cents) || cents <= 0) continue;
      rows.push({
        amount_cents: cents,
        category: (row.category || "其他").trim(),
        note: (row.note || "").trim() || "一笔支出",
        date: /^\d{4}-\d{2}-\d{2}$/.test(row.date || "") ? (row.date as string) : today(),
        merchant: (row.merchant || "").trim(),
      });
    }
    if (rows.length === 0) throw new Error("模型没有解析出金额");
    return rows;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Parse free text into expenses: use the configured LLM when available,
 * otherwise fall back to the offline heuristic parser.
 * Returns the parser used so the UI can tell the user what happened.
 */
export async function parseExpenses(
  text: string
): Promise<{ items: ParsedBill[]; via: "llm" | "local"; warning?: string }> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("先说一句话，或者写一句话");
  if (hasApiKey()) {
    try {
      return { items: await llmParse(trimmed), via: "llm" };
    } catch (err) {
      const local = heuristicParse(trimmed);
      if (local.length === 0) throw err;
      return {
        items: local,
        via: "local",
        warning: `模型解析失败，已用本地规则${err instanceof Error ? `（${err.message}）` : ""}`,
      };
    }
  }
  const local = heuristicParse(trimmed);
  if (local.length === 0) {
    throw new Error("没识别出金额，换个说法试试，比如「午饭 35，打车 18」");
  }
  return { items: local, via: "local" };
}

export function resolveCategory(name: string, categories: Category[]): Category {
  const exact = categories.find((c) => c.name === name);
  if (exact) return exact;
  const partial = categories.find((c) => name.includes(c.name) || c.name.includes(name));
  if (partial) return partial;
  const other = categories.find((c) => c.name === "其他");
  if (other) return other;
  return (
    categories[0] || {
      _id: "cat-other",
      kind: "product",
      name: "其他",
      icon: "📦",
      color: "#9B958F",
      sort: 99,
      isSystem: true,
      hidden: false,
    }
  );
}

export function describeParsed(items: ParsedBill[]): string {
  return items
    .map((i) => `${i.note} ¥${(i.amount_cents / 100).toFixed(2)}（${formatDate(i.date)}）`)
    .join("、");
}
