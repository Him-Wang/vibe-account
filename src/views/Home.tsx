import { useEffect, useMemo, useState } from "react";
import { billService } from "../lib/bills";
import { categoryService } from "../lib/categories";
import { parseExpenses, resolveCategory, type ParsedBill } from "../lib/ai";
import { listenOnce, speechSupported } from "../lib/speech";
import { currentMonth, dayLabel, formatFen, monthLabel, today, yuanToFen } from "../lib/format";
import { toast } from "../lib/ui";
import { navigate } from "../lib/router";
import { Empty, Sheet } from "../components/ui";
import { CartIcon, MicIcon, PencilIcon, ReceiptIcon, SendIcon } from "../components/icons";
import type { Category } from "../types";

interface EditRow extends ParsedBill {
  key: string;
  amountText: string;
}

const MIC_TIP = "点一下说话，比如「午饭 35，打车 18」";

export default function Home() {
  const month = useMemo(() => currentMonth(), []);
  const [summary, setSummary] = useState(() => billService.monthSummary(month));
  const [todayTotal, setTodayTotal] = useState(() => billService.dayTotal(today()));
  const [recent, setRecent] = useState(() => billService.list().slice(0, 5));
  const [text, setText] = useState("");
  const [live, setLive] = useState("");
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
    if (h < 6) return "还没睡呀";
    if (h < 11) return "早上好";
    if (h < 14) return "中午好";
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
    if (busy) return;
    if (!speechSupported()) {
      toast("这个浏览器不支持语音，先用文字记吧");
      return;
    }
    setListening(true);
    setLive("");
    try {
      const transcript = await listenOnce((partial) => setLive(partial));
      setText(transcript);
      setLive("");
      await startParse(transcript, "voice");
    } catch (err) {
      toast(err instanceof Error ? err.message : "语音识别失败");
    } finally {
      setListening(false);
      setLive("");
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
        merchant: row.merchant || "",
        note: row.note,
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

  const transcript = listening ? live : text;
  const showPlaceholder = !transcript && !listening && !busy;

  return (
    <div className="page">
      <header className="home-top">
        <span className="wordmark">Vibe Account</span>
        <div className="home-top-right">
          <div className="mini-total">
            <strong>¥{formatFen(summary.total)}</strong>
            <small>{monthLabel(month)} 支出</small>
          </div>
          <button className="avatar" onClick={() => navigate("/mine")} aria-label="我的">
            V
          </button>
        </div>
      </header>

      <div className="greeting">
        <h1>{greet()}</h1>
        <p>
          {summary.count > 0
            ? `${monthLabel(month)}记了 ${summary.count} 笔，今天 ¥${formatFen(todayTotal)}`
            : "说一句话，账就记好了"}
        </p>
      </div>

      <section className="stage">
        <div className="stage-glow" />
        <p className={showPlaceholder ? "transcript placeholder" : "transcript"}>
          {listening
            ? live || "我在听…"
            : busy
              ? "稍微等我拆一下…"
              : text || "说一句话，我帮你拆成每一笔"}
        </p>

        <div className="orb-wrap">
          {listening && (
            <div className="rings" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          )}
          <button
            className={`orb${listening ? " listening" : ""}${busy ? " thinking" : ""}`}
            onClick={speak}
            aria-label={listening ? "正在听" : "开始语音记账"}
          >
            <MicIcon size={44} />
          </button>
          {listening && (
            <div className="wave" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
        </div>

        <p className="voice-hint">
          {listening
            ? "说完稍等一下，自动帮你拆成多笔"
            : busy
              ? "正在理解这句话…"
              : speechSupported()
                ? MIC_TIP
                : "当前浏览器不支持语音，可以直接打字"}
        </p>
      </section>

      <div className="composer">
        <textarea
          className="composer-input"
          rows={1}
          value={text}
          placeholder="也可以打字：午饭 35，打车 18"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!busy) startParse(text, "text");
            }
          }}
        />
        <button
          className="send"
          onClick={() => startParse(text, "text")}
          disabled={busy || !text.trim()}
          aria-label="解析并记账"
        >
          <SendIcon />
        </button>
      </div>

      <div className="quick-row">
        <button className="quick" onClick={() => navigate("/capture?mode=receipt")}>
          <ReceiptIcon size={17} />
          拍小票
        </button>
        <button className="quick" onClick={() => navigate("/capture?mode=product")}>
          <CartIcon size={17} />
          拍商品
        </button>
        <button className="quick" onClick={() => navigate("/bills/edit")}>
          <PencilIcon size={17} />
          手写一笔
        </button>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>最近记录</h2>
          <button className="icon-link" onClick={() => navigate("/bills")}>
            全部 ›
          </button>
        </div>
        {recent.length === 0 ? (
          <Empty icon={<MicIcon size={26} />} text="还没有记录，说句话试试" />
        ) : (
          <div className="timeline">
            {recent.map((bill) => (
              <button key={bill._id} className="trow" onClick={() => navigate(`/bills/${bill._id}`)}>
                <span
                  className="trow-icon"
                  style={{ background: bill.categoryColor + "26", color: bill.categoryColor }}
                >
                  {bill.categoryIcon}
                </span>
                <span className="trow-main">
                  <strong>{bill.note || bill.merchant || bill.categoryName}</strong>
                  <small>
                    {dayLabel(bill.date)} · {bill.categoryName}
                    {bill.source === "voice" ? " · 语音" : ""}
                  </small>
                </span>
                <span className="trow-amount">-¥{formatFen(bill.amount)}</span>
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
                aria-label="金额"
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, amountText: e.target.value };
                  setRows(next);
                }}
              />
              <input
                className="parse-note"
                value={row.note}
                aria-label="备注"
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, note: e.target.value };
                  setRows(next);
                }}
              />
              <select
                className="parse-cat"
                value={row.category}
                aria-label="分类"
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
        <p className="muted small" style={{ marginTop: 10 }}>
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
