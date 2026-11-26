import type { Bill } from "../types";
import { billService } from "./bills";
import { formatFen, monthLabel, shiftMonth } from "./format";
import { getSettings, hasApiKey } from "./settings";

export interface InsightStats {
  month: string;
  total: number;
  count: number;
  avg: number;
  days: number;
  categories: { name: string; total: number; share: number }[];
  merchants: { name: string; total: number; count: number }[];
  biggest?: { note: string; amount: number; date: string };
  busiest?: { date: string; total: number };
  previousTotal: number;
  trend: number | null;
}

export interface AiInsight {
  headline: string;
  findings: string[];
  tips: { title: string; detail: string }[];
}

function nameOf(bill: Bill): string {
  return bill.note || bill.merchant || bill.categoryName || "一笔";
}

export function buildInsight(month: string): InsightStats {
  const bills = billService.list(month);
  const total = bills.reduce((sum, b) => sum + b.amount, 0);
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();

  const catMap = new Map<string, number>();
  const merchantMap = new Map<string, { total: number; count: number }>();
  const dayMap = new Map<string, number>();
  for (const bill of bills) {
    const cat = bill.categoryName || "其他";
    catMap.set(cat, (catMap.get(cat) || 0) + bill.amount);
    const merchant = (bill.merchant || "").trim();
    if (merchant) {
      const row = merchantMap.get(merchant) || { total: 0, count: 0 };
      row.total += bill.amount;
      row.count += 1;
      merchantMap.set(merchant, row);
    }
    dayMap.set(bill.date, (dayMap.get(bill.date) || 0) + bill.amount);
  }

  const categories = [...catMap.entries()]
    .map(([name, value]) => ({ name, total: value, share: total ? value / total : 0 }))
    .sort((a, b) => b.total - a.total);

  const merchants = [...merchantMap.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const biggest = bills
    .slice()
    .sort((a, b) => b.amount - a.amount)[0];

  const busiest = [...dayMap.entries()]
    .map(([date, value]) => ({ date, total: value }))
    .sort((a, b) => b.total - a.total)[0];

  const previous = billService.monthSummary(shiftMonth(month, -1)).total;
  const trend = previous > 0 ? (total - previous) / previous : null;

  return {
    month,
    total,
    count: bills.length,
    avg: bills.length ? Math.round(total / Math.max(1, bills.length)) : 0,
    days,
    categories,
    merchants,
    biggest: biggest
      ? { note: nameOf(biggest), amount: biggest.amount, date: biggest.date }
      : undefined,
    busiest,
    previousTotal: previous,
    trend,
  };
}

function roundYuan(fen: number): string {
  return `¥${formatFen(fen)}`;
}

/** 本地也能看的几条结论，不依赖任何接口。 */
export function localFindings(stats: InsightStats): string[] {
  const out: string[] = [];
  const top = stats.categories[0];
  if (top) {
    out.push(
      `${top.name}占了 ${Math.round(top.share * 100)}%，一共 ${roundYuan(top.total)}。` +
        (top.share >= 0.4 ? "先盯住这一项，比到处省更容易见效。" : "目前还算分散。")
    );
  }
  if (stats.biggest) {
    out.push(`最大的一笔是「${stats.biggest.note}」，${roundYuan(stats.biggest.amount)}。`);
  }
  if (stats.merchants[0]) {
    const m = stats.merchants[0];
    out.push(`去得最多的是 ${m.name}，${m.count} 次共 ${roundYuan(m.total)}。`);
  }
  if (stats.trend !== null) {
    out.push(
      stats.trend > 0.1
        ? `比上个月多花了 ${Math.round(stats.trend * 100)}%，值得看一眼。`
        : stats.trend < -0.1
          ? `比上个月少花 ${Math.round(Math.abs(stats.trend) * 100)}%，保持住。`
          : "和上个月差不多。"
    );
  }
  return out.slice(0, 3);
}

function parseAi(text: string): AiInsight {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 没按格式回答");
  const data = JSON.parse(cleaned.slice(start, end + 1)) as Partial<AiInsight> & {
    choices?: { message?: { content?: string } }[];
  };
  // 有些 OpenAI 兼容网关会把上游响应再包一层，取里面真正的回答。
  const nested = data.choices?.[0]?.message?.content;
  if (nested && typeof nested === "string") {
    return parseAi(nested);
  }
  const headline = String(data.headline || "").trim();
  const findings = Array.isArray(data.findings)
    ? data.findings.map((x) => String(x).trim()).filter(Boolean).slice(0, 4)
    : [];
  const tips = Array.isArray(data.tips)
    ? data.tips
        .map((x) => ({
          title: String(x?.title || "").trim(),
          detail: String(x?.detail || "").trim(),
        }))
        .filter((x) => x.title && x.detail)
        .slice(0, 3)
    : [];
  if (!headline || findings.length === 0) throw new Error("AI 没给出结论");
  return { headline, findings, tips };
}

export async function analyzeWithAI(stats: InsightStats): Promise<AiInsight> {
  if (!hasApiKey()) throw new Error("还没有配置解析接口");
  const settings = getSettings();
  const base = settings.baseUrl.replace(/\/+$/, "");

  const payload = {
    month: monthLabel(stats.month),
    total: stats.total / 100,
    count: stats.count,
    average_per_bill: stats.avg / 100,
    previous_month_total: stats.previousTotal / 100,
    categories: stats.categories.slice(0, 6).map((c) => ({
      name: c.name,
      amount: c.total / 100,
      share: Math.round(c.share * 100),
    })),
    merchants: stats.merchants.map((m) => ({ name: m.name, amount: m.total / 100, count: m.count })),
    biggest: stats.biggest
      ? { note: stats.biggest.note, amount: stats.biggest.amount / 100, date: stats.biggest.date }
      : null,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey.trim()}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.5,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "你是一个不评判、不唠叨的记账助手。你只根据给出的汇总数字说话，不要编造消费记录。" +
              "语气像一个懂生活的朋友，短句，具体，可执行。用中文回答。",
          },
          {
            role: "user",
            content:
              `这是我 ${monthLabel(stats.month)} 的账单汇总：\n` +
              JSON.stringify(payload) +
              "\n\n请只返回 JSON，不要解释：\n" +
              '{"headline":"一句不超过28字的总结",' +
              '"findings":["2-3条具体观察，每条不超过40字"],' +
              '"tips":[{"title":"不超过10字的动作","detail":"不超过50字，最好带一个可执行的数字或场景"}]}' +
              "\ntips 必须正好 3 条。不要建议记账，不要建议取消所有娱乐。",
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`AI 接口返回 ${res.status}${detail ? `：${detail.slice(0, 120)}` : ""}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI 没有返回内容");
    return parseAi(content);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("AI 想太久超时了，再试一次");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
