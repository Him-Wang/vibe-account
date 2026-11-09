import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import type { Config, Draft, Expense } from "./types";

const CATEGORIES = ["餐饮", "交通", "购物", "娱乐", "居家", "医疗", "教育", "人情", "其他"];

const CAT_COLOR: Record<string, string> = {
  餐饮: "#ffb86b",
  交通: "#6ea8ff",
  购物: "#a78bfa",
  娱乐: "#ff8fb1",
  居家: "#59d6e8",
  医疗: "#ff9a6b",
  教育: "#b3a1ff",
  人情: "#ffc2d4",
  其他: "#a9b0c8",
};

const pad = (n: number) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fmt = (cents: number) =>
  (cents / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const errText = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "string" ? e : "操作失败，请重试";

type DraftForm = { amount: string; category: string; note: string; date: string };

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cfg, setCfg] = useState<Config>({ base_url: "", model: "", glass: true });
  const [hasKey, setHasKey] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ base_url: "", model: "", apiKey: "" });
  const [editing, setEditing] = useState<Expense | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<DraftForm>({
    amount: "",
    category: "餐饮",
    note: "",
    date: todayStr(),
  });
  const toastTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3800);
  }, []);

  const reload = useCallback(async () => {
    const s = await api.loadState();
    setExpenses(s.expenses);
    setCfg(s.config);
    setHasKey(s.has_key);
    document.documentElement.dataset.glass = s.config.glass ? "on" : "off";
  }, []);

  useEffect(() => {
    reload().catch((e) => notify(errText(e)));
  }, [reload, notify]);

  const today = todayStr();
  const total = useMemo(
    () => expenses.filter((e) => e.date === today).reduce((a, e) => a + e.amount_cents, 0),
    [expenses, today]
  );
  const shown = useMemo(
    () => (showAll ? expenses : expenses.filter((e) => e.date === today)),
    [expenses, showAll, today]
  );

  async function submit() {
    if (!text.trim() || busy) return;
    if (!hasKey) {
      openSettings();
      notify("请先在设置里填写 API Key");
      return;
    }
    setBusy(true);
    try {
      const added = await api.parseAndAdd(text.trim());
      await reload();
      setText("");
      const sum = added.reduce((a, e) => a + e.amount_cents, 0);
      notify(added.length ? `已记 ${added.length} 笔，合计 ¥${fmt(sum)}` : "没有新增记录");
    } catch (e) {
      notify(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function startVoice() {
    if (listening) return;
    setListening(true);
    try {
      const t = await api.recognizeSpeech();
      setText((prev) => (prev ? `${prev}，${t}` : t));
      notify("已转成文字，确认后点「解析并记账」");
    } catch (e) {
      notify(errText(e));
    } finally {
      setListening(false);
    }
  }

  function openSettings() {
    setSettingsForm({
      base_url: cfg.base_url || "https://api.deepseek.com/v1",
      model: cfg.model || "deepseek-chat",
      apiKey: "",
    });
    setSettingsOpen(true);
  }

  async function saveSettings() {
    const base_url = settingsForm.base_url.trim();
    const model = settingsForm.model.trim();
    if (!base_url || !model) {
      notify("Base URL 和模型名不能为空");
      return;
    }
    try {
      if (settingsForm.apiKey.trim()) await api.saveKey(settingsForm.apiKey.trim());
      await api.saveConfig({ base_url, model, glass: cfg.glass });
      await reload();
      setSettingsOpen(false);
      notify("设置已保存");
    } catch (e) {
      notify(errText(e));
    }
  }

  async function toggleGlass() {
    const next = { ...cfg, glass: !cfg.glass };
    try {
      await api.saveConfig(next);
      setCfg(next);
      document.documentElement.dataset.glass = next.glass ? "on" : "off";
      notify(next.glass ? "毛玻璃已开启" : "毛玻璃已关闭 · 性能模式");
    } catch (e) {
      notify(errText(e));
    }
  }

  function openManual() {
    setEditing(null);
    setForm({ amount: "", category: "餐饮", note: "", date: todayStr() });
    setAdding(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      amount: (e.amount_cents / 100).toFixed(2),
      category: e.category,
      note: e.note,
      date: e.date,
    });
    setAdding(true);
  }

  async function saveForm() {
    const amount = Number(form.amount.replace(/[^\d.]/g, ""));
    const cents = Math.round(amount * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      notify("请输入有效金额");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      notify("日期格式应为 YYYY-MM-DD");
      return;
    }
    try {
      if (editing) {
        await api.updateExpense({
          ...editing,
          amount_cents: cents,
          category: form.category,
          note: form.note.trim(),
          date: form.date,
        });
        notify("已保存修改");
      } else {
        await api.addExpenses([
          {
            amount_cents: cents,
            category: form.category,
            note: form.note.trim() || "手动记录",
            date: form.date,
          },
        ]);
        notify("已添加一笔");
      }
      await reload();
      setAdding(false);
    } catch (e) {
      notify(errText(e));
    }
  }

  async function remove(e: Expense) {
    if (!window.confirm(`删除「${e.note || e.category}」¥${fmt(e.amount_cents)}？`)) return;
    try {
      await api.deleteExpense(e.id);
      await reload();
      notify("已删除");
    } catch (err) {
      notify(errText(err));
    }
  }

  async function exportJson() {
    try {
      const json = await api.exportJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vibe-account-${today}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify("已导出 JSON（不含 API Key）");
    } catch (e) {
      notify(errText(e));
    }
  }

  async function onImport(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    try {
      const n = await api.importJson(await file.text());
      await reload();
      notify(`导入 ${n} 笔${n === 0 ? "（都已存在）" : ""}`);
    } catch (e) {
      notify(errText(e));
    }
  }

  return (
    <div className="app">
      <div className="aurora" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>

      <header className="topbar glass">
        <div className="brand">
          <div className="mark">¥</div>
          <div>
            <h1>Vibe Account</h1>
            <p>说一句话，自动拆成多笔</p>
          </div>
        </div>
        <div className="top-actions">
          <button className="btn ghost" onClick={exportJson} title="导出全部记录为 JSON">
            导出
          </button>
          <label className="btn ghost file-btn" title="从 JSON 导入记录">
            导入
            <input type="file" accept=".json,application/json" onChange={onImport} hidden />
          </label>
          <button className="btn ghost" onClick={openSettings}>
            设置
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="card glass composer">
          <div className="card-head">
            <h2>今天花了什么？</h2>
            <span className="pill">{listening ? "正在听…" : "语音 / 文字"}</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
            }}
            placeholder={"例如：今天早饭12，打车25，中午请同事吃饭180，下午咖啡18"}
            rows={4}
            spellCheck={false}
          />
          <div className="composer-actions">
            <button
              className={`btn mic ${listening ? "listening" : ""}`}
              onClick={startVoice}
              disabled={listening || busy}
            >
              {listening ? (
                <>
                  <span className="pulse" /> 正在聆听…
                </>
              ) : (
                <>
                  <MicIcon /> 说一句
                </>
              )}
            </button>
            <button className="btn primary" onClick={submit} disabled={busy || !text.trim()}>
              {busy ? "解析中…" : "解析并记账"}
            </button>
            <button className="btn ghost" onClick={openManual}>
              手动添加
            </button>
          </div>
          <p className="hint">
            语音识别使用 Windows 内置能力（离线，无需联网）· 识别失败时可直接打字 · Ctrl + Enter 快速记账
          </p>
        </section>

        <section className="card glass ledger">
          <div className="ledger-head">
            <div>
              <span className="eyebrow">{showAll ? "全部记录" : "今日支出"}</span>
              <div className="total">
                <span className="cur">¥</span>
                {fmt(total)}
              </div>
            </div>
            <div className="seg">
              <button className={!showAll ? "active" : ""} onClick={() => setShowAll(false)}>
                今天
              </button>
              <button className={showAll ? "active" : ""} onClick={() => setShowAll(true)}>
                全部
              </button>
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="empty">
              <div className="empty-mark">¥</div>
              <p>{showAll ? "还没有任何记录" : "今天还没有记录"}</p>
              <span>试着说一句：今天早饭12，打车25…</span>
            </div>
          ) : (
            <ul className="rows">
              {shown.map((e) => (
                <li className="row" key={e.id}>
                  <span
                    className="dot"
                    style={{ background: CAT_COLOR[e.category] ?? CAT_COLOR["其他"] }}
                  />
                  <div className="row-main">
                    <span className="row-note">{e.note || e.category}</span>
                    <span className="row-meta">
                      {e.category} · {e.date === today ? "今天" : e.date.slice(5)}
                      {showAll && e.date !== today ? "" : ""}
                    </span>
                  </div>
                  <span className="row-amount">¥{fmt(e.amount_cents)}</span>
                  <div className="row-actions">
                    <button className="icon-btn" title="编辑" onClick={() => openEdit(e)}>
                      <EditIcon />
                    </button>
                    <button className="icon-btn danger" title="删除" onClick={() => remove(e)}>
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="foot">数据只存在本机 · 无云端同步 · API Key 仅本机保存，不写入导出文件</footer>

      {toast && <div className="toast glass">{toast}</div>}

      {settingsOpen && (
        <div className="overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h3>设置</h3>
            <p className="modal-sub">兼容 OpenAI 格式的接口，例如 DeepSeek、通义、智谱、Ollama 等。</p>
            <label className="field">
              <span>Base URL</span>
              <input
                value={settingsForm.base_url}
                onChange={(e) => setSettingsForm({ ...settingsForm, base_url: e.target.value })}
                placeholder="https://api.deepseek.com/v1"
                spellCheck={false}
              />
            </label>
            <label className="field">
              <span>模型</span>
              <input
                value={settingsForm.model}
                onChange={(e) => setSettingsForm({ ...settingsForm, model: e.target.value })}
                placeholder="deepseek-chat"
                spellCheck={false}
              />
            </label>
            <label className="field">
              <span>API Key</span>
              <input
                type="password"
                value={settingsForm.apiKey}
                onChange={(e) => setSettingsForm({ ...settingsForm, apiKey: e.target.value })}
                placeholder={hasKey ? "已保存，留空则不修改" : "sk-..."}
                spellCheck={false}
              />
            </label>
            <p className="modal-note">
              Key 以明文保存在当前 Windows 用户的数据目录中，仅本机可读；不会写入日志，也不会随 JSON
              导出。
            </p>
            <div className="setting-row">
              <div>
                <strong>毛玻璃</strong>
                <span>半透明模糊与光影效果；低配设备关闭后可提升流畅度</span>
              </div>
              <button
                className={`btn toggle ${cfg.glass ? "on" : ""}`}
                onClick={toggleGlass}
                title={cfg.glass ? "关闭毛玻璃（性能模式）" : "开启毛玻璃"}
                aria-pressed={cfg.glass}
                aria-label="毛玻璃开关"
              >
                <span className="switch" />
              </button>
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setSettingsOpen(false)}>
                取消
              </button>
              <button className="btn primary" onClick={saveSettings}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {adding && (
        <div className="overlay" onClick={() => setAdding(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "编辑记录" : "手动添加"}</h3>
            <label className="field">
              <span>金额（元）</span>
              <input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                autoFocus
              />
            </label>
            <label className="field">
              <span>类别</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>备注</span>
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="例如：午饭"
              />
            </label>
            <label className="field">
              <span>日期</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setAdding(false)}>
                取消
              </button>
              <button className="btn primary" onClick={saveForm}>
                {editing ? "保存" : "添加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M9 7V5h6v2M6.5 7l.8 12h9.4l.8-12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
