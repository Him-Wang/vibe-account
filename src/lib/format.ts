export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentMonth(): string {
  return today().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}年${m}月`;
}

export function formatDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}月${Number(d)}日`;
}

/** Human friendly label for a bill date: 今天 / 昨天 / 3月5日 */
export function dayLabel(date: string): string {
  const t = today();
  if (date === t) return "今天";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yStr = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
  if (date === yStr) return "昨天";
  return formatDate(date);
}

export function fenToYuan(fen: number): number {
  return (fen || 0) / 100;
}

export function yuanToFen(yuan: number): number {
  if (!Number.isFinite(yuan)) return 0;
  return Math.round(yuan * 100);
}

export function formatFen(fen: number): string {
  return ((fen || 0) / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
