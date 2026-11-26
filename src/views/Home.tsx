import { useEffect, useMemo, useState } from "react";
import { billService } from "../lib/bills";
import { categoryService } from "../lib/categories";
import { parseExpenses, resolveCategory, type ParsedBill } from "../lib/ai";
import { listenOnce, speechSupported } from "../lib/speech";
import { currentMonth, dayLabel, formatFen, monthLabel, today, yuanToFen } from "../lib/format";
import { toast } from "../lib/ui";
import { navigate } from "../lib/router";
import { Empty, Sheet } from "../components/ui";
import { BillsIcon, CartIcon, JournalIcon, ReceiptIcon } from "../components/icons";
import type { Category } from "../types";

interface EditRow extends ParsedBill {
  key: string;
  amountText: string;
}

export default function Home() {
  const month = useMemo(() => currentMonth(), []);
  const [summary, setSummary] = useState(() => billService.monthSummary(month));
  const [todayTotal, setTodayTotal] = useState(() => billService.dayTotal(today()));
  const [recent, setRecent] = useState(() => billService.list().slice(0, 5));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [origin, setOrigin] = useState<"text" | "voice">("text");
  const categories = useMemo(() => categoryService.list("product"), []);

  const reload = () => {
    setSummary(billService.monthSummary(month));
    setTodayTotal(billService.dayTotal(today()));
    setRecent(billService.list().slice(0, 5));
  };

  useEffect(() => {
    categoryService.ensureSeeded();
  }, []);

  const greet = () => {
    const h = new Date().getHours();
    if (h < 6) return "夜深了";
    if (h < 12) return "早上好";
    if (h < 18) return "下午好";
    return "晚上好";
  };

  const startParse = async (raw: string, from: "text" | "voice") => {
    const value = raw.trim();
    if (!value) {
      toast("先说一句，比如「午饭 35，打车 18」");
      return;
    }
    setBusy(true);
    try {
      const result = await parseExpenses(value);
      if (result.warning) toast(result.warning);
      setOrigin(from);
      setRows(
        result.items.map((item, i) => ({
          ...item,
          key: `${i}-${item.amount_cents}`,
          amountText: (item.amount_cents / 100).toFixed(2),
        }))
      );
      setSheetOpen(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : "解析失败");
    } finally {
      setBusy(false);
    }
  };

  const speak = async () => {
    if (!speechSupported()) {
      toast("这个浏览器不支持语音，先用文字记吧");
      return;
    }
    setListening(true);
    try {
      const transcript = await listenOnce();
      setText(transcript);
      await startParse(transcript, "voice");
    } catch (err) {
      toast(err instanceof Error ? err.message : "语音识别失败");
    } finally {
      setListening(false);
    }
  };

  const saveRows = () => {
    const valid = rows
      .map((r) => ({ ...r, cents: yuanToFen(Number(r.amountText)) }))
      .filter((r) => r.cents > 0);
    if (valid.length === 0) {
      toast("金额都不大于 0，先改一下");
      return;
    }
    for (const row of valid) {
      const cat: Category = resolveCategory(row.category, categories);
      billService.create({
        amount: row.cents,
        date: row.date || today(),
        note: row.note,
        merchant: row.merchant || "",
        categoryId: cat._id,
        categoryName: cat.name,
        categoryIcon: cat.icon,
        categoryColor: cat.color,
        source: origin === "voice" ? "voice" : "manual",
      });
    }
    toast(`记好了 ${valid.length} 笔，共 ¥${formatFen(valid.reduce((s, r) => s + r.cents, 0))}`);
    setSheetOpen(false);
    setRows([]);
    if (origin === "voice") setText("");
    reload();
  };

  return (
    <div className="page">
      <header className="home-head">
        <div>
          <p className="muted small">{monthLabel(month)} · 拾光账本</p>
          <h1>{greet()}，拾光用户</h1>
        </div>
        <button className="avatar" onClick={() => navigate("/mine")}>
          拾
        </button>
      </header>

      <section className="hero">
        <div className="hero-glow" />
        <p className="hero-label">本月支出</p>
        <div className="hero-amount">
          <span>¥</span>
          {formatFen(summary.total)}
        </div>
        <p className="hero-sub">
          共 {summary.count} 笔 · 今日 ¥{formatFen(todayTotal)}
        </p>
      </section>

      <section className="card composer">
        <div className="composer-head">
          <strong>说一句话，自动拆成多笔</strong>
          <span className="pill">{speechSupported() ? "支持语音" : "文字输入"}</span>
        </div>
        <textarea
          className="composer-input"
          rows={2}
          value={text}
          placeholder="例如：午饭 35，打车 18，买咖啡 22"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) startParse(text, "text");
          }}
        />
        <div className="composer-actions">
          <button
            className={listening ? "btn mic listening" : "btn mic"}
            onClick={speak}
            disabled={busy || listening}
          >
            {listening ? "正在听…" : "🎙 说一句"}
          </button>
          <button className="btn primary" onClick={() => startParse(text, "text")} disabled={busy}>
            {busy ? "解析中…" : "记一笔"}
          </button>
          <button className="icon-link" onClick={() => navigate("/bills/edit")}>
            手动添加
          </button>
        </div>
      </section>

      <section className="quick-grid">
        <button className="quick" onClick={() => navigate("/capture?mode=receipt")}>
          <span className="quick-icon">
            <ReceiptIcon />
          </span>
          <strong>拍小票</strong>
          <small>识别明细</small>
        </button>
        <button className="quick" onClick={() => navigate("/capture?mode=product")}>
          <span className="quick-icon">
            <CartIcon />
          </span>
          <strong>拍商品</strong>
          <small>生成贴纸</small>
        </button>
        <button className="quick" onClick={() => navigate("/bills")}>
          <span className="quick-icon">
            <BillsIcon />
          </span>
          <strong>账单</strong>
          <small>按月查看</small>
        </button>
        <button className="quick" onClick={() => navigate("/journal")}>
          <span className="quick-icon">
            <JournalIcon />
          </span>
          <strong>手账</strong>
          <small>写一页</small>
        </button>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>最近账单</h2>
          <button className="icon-link" onClick={() => navigate("/bills")}>
            全部 ›
          </button>
        </div>
        {recent.length === 0 ? (
          <Empty icon="📭" text="还没有账单，说一句话试试" />
        ) : (
          <div className="card list">
            {recent.map((bill) => (
              <button key={bill._id} className="bill-row" onClick={() => navigate(`/bills/${bill._id}`)}>
                <span
                  className="bill-icon"
                  style={{ background: bill.categoryColor + "26", color: bill.categoryColor }}
                >
                  {bill.categoryIcon}
                </span>
                <span className="bill-main">
                  <strong>{bill.note || bill.merchant || bill.categoryName}</strong>
                  <small>
                    {dayLabel(bill.date)} · {bill.categoryName}
                  </small>
                </span>
                <span className="bill-amount">-¥{formatFen(bill.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="确认这几笔">
        <div className="parse-list">
          {rows.map((row, index) => (
            <div className="parse-row" key={row.key}>
              <input
                className="parse-amount"
                value={row.amountText}
                inputMode="decimal"
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, amountText: e.target.value };
                  setRows(next);
                }}
              />
              <input
                className="parse-note"
                value={row.note}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, note: e.target.value };
                  setRows(next);
                }}
              />
              <select
                className="parse-cat"
                value={row.category}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, category: e.target.value };
                  setRows(next);
                }}
              >
                {categories.map((c) => (
                  <option key={c._id} value={c.name}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
              <button
                className="icon-btn tiny"
                onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                aria-label="删除这一笔"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <p className="muted small">
          合计 ¥
          {formatFen(rows.reduce((s, r) => s + Math.max(0, yuanToFen(Number(r.amountText))), 0))}
        </p>
        <div className="sheet-actions">
          <button className="btn ghost" onClick={() => setSheetOpen(false)}>
            取消
          </button>
          <button className="btn primary" onClick={saveRows}>
            保存 {rows.length} 笔
          </button>
        </div>
      </Sheet>
    </div>
  );
}
