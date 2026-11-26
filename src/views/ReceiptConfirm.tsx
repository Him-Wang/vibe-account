import { useMemo, useState } from "react";
import { billService } from "../lib/bills";
import { categoryService } from "../lib/categories";
import { getFlow, resetFlow } from "../lib/flow";
import { fenToYuan, formatFen, today, yuanToFen } from "../lib/format";
import { replace } from "../lib/router";
import { promptDialog, toast } from "../lib/ui";
import { NavBar, Sheet } from "../components/ui";
import type { Category } from "../types";

interface Row {
  key: string;
  name: string;
  qty: number;
  unitPrice: number;
  unitText: string;
}

let rowSeq = 0;

export default function ReceiptConfirm() {
  const flow = getFlow();
  const ocr = flow.ocr;
  const categories = useMemo(() => categoryService.list("product"), []);
  const defaultCat =
    categories.find((c) => c.name === "餐饮") || categories[0];

  const [merchant, setMerchant] = useState(ocr?.parsed.merchant || "");
  const [date, setDate] = useState(ocr?.parsed.date || today());
  const [category, setCategory] = useState<Category | undefined>(defaultCat);
  const [rows, setRows] = useState<Row[]>(() =>
    (ocr?.parsed.items || []).map((item) => ({
      key: `r${rowSeq++}`,
      name: item.name,
      qty: item.qty || 1,
      unitPrice: item.unitPrice || item.amount,
      unitText: fenToYuan(item.unitPrice || item.amount).toFixed(2),
    }))
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!ocr) {
    return (
      <div className="page">
        <NavBar title="核对小票" />
        <p className="muted">没有识别结果，回去重新拍一张吧。</p>
      </div>
    );
  }

  const total = rows.reduce((sum, r) => sum + Math.round(r.unitPrice * r.qty), 0);
  const providerLabel = ocr.provider.startsWith("vision:")
    ? "视觉模型核对"
    : ocr.provider === "local-ocr"
      ? "本地 OCR"
      : "演示识别";

  const setUnit = (index: number, text: string) => {
    const next = [...rows];
    const cents = yuanToFen(Number(text));
    next[index] = { ...next[index], unitText: text, unitPrice: cents };
    setRows(next);
  };

  const rename = async (index: number) => {
    const value = await promptDialog({
      title: "改个名字",
      value: rows[index].name,
      placeholder: "商品名称",
    });
    if (!value) return;
    const next = [...rows];
    next[index] = { ...next[index], name: value };
    setRows(next);
  };

  const addRow = () => {
    setRows([
      ...rows,
      { key: `r${rowSeq++}`, name: "新项目", qty: 1, unitPrice: 0, unitText: "0.00" },
    ]);
  };

  const save = () => {
    if (!category) {
      toast("先选一个分类");
      return;
    }
    if (total <= 0) {
      toast("合计金额要大于 0");
      return;
    }
    billService.create({
      amount: total,
      date,
      merchant,
      note: rows.map((r) => r.name).join("、"),
      categoryId: category._id,
      categoryName: category.name,
      categoryIcon: category.icon,
      categoryColor: category.color,
      source: "receipt",
      items: rows.map((r) => ({
        name: r.name,
        qty: r.qty,
        unitPrice: r.unitPrice,
        amount: Math.round(r.unitPrice * r.qty),
      })),
    });
    resetFlow();
    toast("记好了");
    window.setTimeout(() => replace("/bills"), 300);
  };

  return (
    <div className="page">
      <NavBar title="核对小票" sub="认错了就改，别客气" />

      <section className="receipt-preview card">
        {flow.imagePaths[0] ? (
          <img src={flow.imagePaths[0]} alt="小票原图" />
        ) : (
          <div className="receipt-placeholder">🧾</div>
        )}
        <div className="receipt-meta">
          <span className="pill">置信度 {Math.round((ocr.confidence || 0) * 100)}%</span>
          <span className="pill muted-pill">{providerLabel}</span>
        </div>
      </section>

      {ocr.rawText && (
        <details className="ocr-raw">
          <summary>看识别原文</summary>
          <pre>{ocr.rawText}</pre>
        </details>
      )}

      <section className="card form">
        <label className="field">
          <span className="field-label">商家</span>
          <input
            className="input"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="商家名称"
          />
        </label>
        <label className="field">
          <span className="field-label">日期</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="field field-button" onClick={() => setPickerOpen(true)}>
          <span className="field-label">分类</span>
          <span className="field-value">
            {category ? `${category.icon} ${category.name}` : "选择分类"}
            <span className="go-arrow">›</span>
          </span>
        </button>
      </section>

      <section className="card">
        <div className="section-head">
          <h3 className="card-title">这一单买了什么</h3>
          <button className="icon-link" onClick={addRow}>
            ＋ 加一项
          </button>
        </div>
        <div className="items">
          {rows.map((row, index) => (
            <div className="receipt-row" key={row.key}>
              <button className="receipt-name" onClick={() => rename(index)}>
                {row.name}
              </button>
              <div className="stepper">
                <button onClick={() => {
                  const next = [...rows];
                  next[index] = { ...row, qty: Math.max(1, row.qty - 1) };
                  setRows(next);
                }}>
                  −
                </button>
                <span>{row.qty}</span>
                <button onClick={() => {
                  const next = [...rows];
                  next[index] = { ...row, qty: row.qty + 1 };
                  setRows(next);
                }}>
                  ＋
                </button>
              </div>
              <input
                className="receipt-price"
                value={row.unitText}
                inputMode="decimal"
                onChange={(e) => setUnit(index, e.target.value)}
              />
              <button
                className="icon-btn tiny"
                onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                aria-label="删除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="total-bar">
        <span>
          合计 <strong>¥{formatFen(total)}</strong>
        </span>
        <button className="btn primary" onClick={save}>
          收进流水
        </button>
      </div>

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="选择分类">
        <div className="cat-grid">
          {categories.map((c) => (
            <button
              key={c._id}
              className={category?._id === c._id ? "cat-cell active" : "cat-cell"}
              onClick={() => {
                setCategory(c);
                setPickerOpen(false);
              }}
            >
              <span className="cat-cell-icon" style={{ background: c.color + "26", color: c.color }}>
                {c.icon}
              </span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
