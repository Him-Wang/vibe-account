import { useEffect, useMemo, useRef, useState } from "react";
import { billService } from "../lib/bills";
import { categoryService } from "../lib/categories";
import { parseExpenses, resolveCategory, type ParsedBill } from "../lib/ai";
import { listenOnce, speechSupported } from "../lib/speech";
import {
  hasAsr,
  recordingSupported,
  startRecording,
  transcribeAudio,
  type Recorder,
} from "../lib/asr";
import { currentMonth, dayLabel, formatFen, monthLabel, today, yuanToFen } from "../lib/format";
import { toast } from "../lib/ui";
import { navigate } from "../lib/router";
import { Sheet } from "../components/ui";
import { AiStrip } from "../components/AiStrip";
import { LogoMark } from "../components/Logo";
import { CartIcon, MicIcon, PencilIcon, ReceiptIcon, SendIcon } from "../components/icons";
import type { Category } from "../types";

interface EditRow extends ParsedBill {
  key: string;
  amountText: string;
}

export default function Home() {
  const month = useMemo(() => currentMonth(), []);
  const [summary, setSummary] = useState(() => billService.monthSummary(month));
  const [todayTotal, setTodayTotal] = useState(() => billService.dayTotal(today()));
  const [recent, setRecent] = useState(() => billService.list().slice(0, 3));
  const [text, setText] = useState("");
  const [live, setLive] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [origin, setOrigin] = useState<"text" | "voice">("text");
  const categories = useMemo(() => categoryService.list("product"), []);
  const recorderRef = useRef<Recorder | null>(null);

  const reload = () => {
    setSummary(billService.monthSummary(month));
    setTodayTotal(billService.dayTotal(today()));
    setRecent(billService.list().slice(0, 3));
  };

  useEffect(() => {
    categoryService.ensureSeeded();
    return () => {
      recorderRef.current?.cancel();
      recorderRef.current = null;
    };
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
      toast(err instanceof Error ? err.message : "没拆明白，再试一次");
    } finally {
      setBusy(false);
    }
  };

  const speak = async () => {
    if (busy) return;

    // Configured Whisper-style endpoint: record on the first tap, stop and
    // transcribe on the second. Works in browsers without SpeechRecognition.
    if (hasAsr()) {
      if (!recordingSupported()) {
        toast("这个浏览器不能录音，先用文字记吧");
        return;
      }
      if (recorderRef.current) {
        const recorder = recorderRef.current;
        recorderRef.current = null;
        setListening(false);
        setBusy(true);
        setLive("正在转成文字…");
        try {
          const blob = await recorder.stop();
          const transcript = await transcribeAudio(blob);
          setText(transcript);
          setLive("");
          await startParse(transcript, "voice");
        } catch (err) {
          toast(err instanceof Error ? err.message : "转写失败");
        } finally {
          setBusy(false);
          setLive("");
        }
        return;
      }
      try {
        const recorder = await startRecording();
        recorderRef.current = recorder;
        setListening(true);
        setLive("正在录音，说完再点一下");
      } catch (err) {
        toast(err instanceof Error ? err.message : "无法开始录音");
      }
      return;
    }

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
  const heroLine = listening
    ? live || "我在听，慢慢说…"
    : busy
      ? "稍微等我拆一下…"
      : text || "不翻表格，不背分类。随口一讲，我把它拆成清清楚楚的每一笔。";
  const now = new Date();
  const dateChip = `${now.getMonth() + 1}.${String(now.getDate()).padStart(2, "0")} 周${
    "日一二三四五六"[now.getDay()]
  }`;

  return (
    <div className="page home">
      <header className="home-top">
        <div className="brand">
          <LogoMark size={36} className="brand-mark" />
          <div className="brand-text">
            <strong className="wordmark">随口记</strong>
            <small>VOICE LEDGER</small>
          </div>
        </div>
        <span className="date-chip">{dateChip}</span>
      </header>

      <section className={listening ? "hero-card is-listening" : "hero-card"}>
        <span className="spark s1" aria-hidden="true">✦</span>
        <span className="hello-chip">{greet()}</span>
        <h1>
          说一句，
          <br />
          <mark>账就记好了。</mark>
        </h1>
        <p className={transcript || listening || busy ? "hero-line is-live" : "hero-line"}>
          {heroLine}
        </p>
        {!listening && (
          <span className="hero-hint">
            {hasAsr()
              ? "点一下开始录音，再点一下结束"
              : speechSupported()
                ? "点右下角，说一句"
                : "当前浏览器不支持语音，直接打字"}
          </span>
        )}
        <button
          className={listening ? "hero-mic listening" : "hero-mic"}
          onClick={speak}
          aria-label={listening ? "正在听" : "开始说话"}
        >
          <MicIcon size={26} />
        </button>
      </section>

      <section className="chips">
        <button className="chip" onClick={() => navigate("/bills")}>
          <span>今天花掉</span>
          <strong>¥{formatFen(todayTotal)}</strong>
        </button>
        <button className="chip" onClick={() => navigate("/bills")}>
          <span>
            本月 / {summary.count} 笔
          </span>
          <strong>¥{formatFen(summary.total)}</strong>
        </button>
      </section>

      <AiStrip />

      <div className="composer">
        <textarea
          className="composer-input"
          rows={1}
          value={text}
          placeholder="也可以打字：午饭 35，打车 18"
          aria-label="输入账单"
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
          aria-label="拆成账单"
        >
          <SendIcon />
        </button>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>
            顺手记
            <span className="tape">TOOLS</span>
          </h2>
          <span className="link-quiet">都能用</span>
        </div>
        <div className="tools">
          <button className="tool big" onClick={() => navigate("/capture?mode=receipt")}>
            <span className="tag">常用</span>
            <span className="tool-icon">
              <ReceiptIcon size={19} />
            </span>
            <span className="tool-text">
              <strong>扫票</strong>
              <small>拍下小票，自动认明细</small>
            </span>
          </button>
          <button className="tool tone-butter" onClick={() => navigate("/capture?mode=product")}>
            <span className="tool-icon">
              <CartIcon size={18} />
            </span>
            <span className="tool-text">
              <strong>拍物</strong>
              <small>收进图鉴</small>
            </span>
          </button>
          <button className="tool tone-sky" onClick={() => navigate("/bills/edit")}>
            <span className="tool-icon">
              <PencilIcon size={18} />
            </span>
            <span className="tool-text">
              <strong>手记</strong>
              <small>自己慢慢填</small>
            </span>
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>刚刚记的</h2>
          <button className="link" onClick={() => navigate("/bills")}>
            全部流水 →
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="ticket-empty">
            <span className="ticket-empty-icon">
              <MicIcon size={22} />
            </span>
            <p>还没有账，说一句试试</p>
          </div>
        ) : (
          <div className="tickets">
            {recent.map((bill) => (
              <button
                key={bill._id}
                className="ticket"
                onClick={() => navigate(`/bills/${bill._id}`)}
              >
                <span className="ticket-tile">
                  {bill.categoryIcon}
                </span>
                <span className="what">
                  <strong>{bill.note || bill.merchant || bill.categoryName}</strong>
                  <small>
                    {dayLabel(bill.date)} · {bill.categoryName}
                    {bill.source === "voice" ? " · 说一句" : ""}
                  </small>
                </span>
                <span className="money">-¥{formatFen(bill.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="核对这几笔">
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
            再改改
          </button>
          <button className="btn primary" onClick={saveRows}>
            记下 {rows.length} 笔
          </button>
        </div>
      </Sheet>
    </div>
  );
}
