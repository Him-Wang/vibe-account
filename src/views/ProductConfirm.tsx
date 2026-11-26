import { useMemo, useState } from "react";
import { billService } from "../lib/bills";
import { categoryService } from "../lib/categories";
import { stickerService } from "../lib/stickers";
import { getFlow, resetFlow } from "../lib/flow";
import { fenToYuan, formatFen, today, yuanToFen } from "../lib/format";
import { replace } from "../lib/router";
import { toast } from "../lib/ui";
import { NavBar, Sheet, Stepper } from "../components/ui";
import type { Category } from "../types";

const ANIME_STYLES = [
  { id: "cute", label: "可爱", emoji: "🐻" },
  { id: "comic", label: "漫画", emoji: "💥" },
  { id: "oil", label: "油画", emoji: "🎨" },
  { id: "sketch", label: "素描", emoji: "✏️" },
];

export default function ProductConfirm() {
  const flow = getFlow();
  const builtin = flow.builtin;
  const categories = useMemo(() => categoryService.list("product"), []);
  const initialCat =
    categories.find((c) => c.name === (builtin?.categoryName || "购物")) || categories[0];

  const [name, setName] = useState(builtin?.name || "小物件");
  const [priceText, setPriceText] = useState(
    builtin ? fenToYuan(builtin.price).toFixed(2) : "29.90"
  );
  const [qty, setQty] = useState(1);
  const [style, setStyle] = useState("cute");
  const [category, setCategory] = useState<Category | undefined>(initialCat);
  const [pickerOpen, setPickerOpen] = useState(false);

  const unit = yuanToFen(Number(priceText));
  const total = unit * qty;

  const save = () => {
    if (!category) {
      toast("先选一个分类");
      return;
    }
    if (total <= 0) {
      toast("单价要大于 0");
      return;
    }
    const image = flow.imagePaths[0] || "";
    const bill = billService.create({
      amount: total,
      date: today(),
      merchant: "",
      note: name,
      categoryId: category._id,
      categoryName: category.name,
      categoryIcon: category.icon,
      categoryColor: category.color,
      source: "product",
      items: [{ name, qty, unitPrice: unit, amount: total }],
    });
    stickerService.add({
      name,
      originalFileId: image,
      cutoutFileId: image,
      animeFileId: image,
      thumbFileId: image,
      categoryName: category.name,
      billId: bill._id,
    });
    resetFlow();
    toast("已记账，贴纸也收好了");
    window.setTimeout(() => replace("/bills"), 320);
  };

  return (
    <div className="page">
      <NavBar title="确认商品" sub="选个风格，存成贴纸" />

      <section className="product-preview">
        <div className="product-shot">
          {builtin ? (
            <span className="product-emoji">{builtin.emoji}</span>
          ) : flow.imagePaths[0] ? (
            <img src={flow.imagePaths[0]} alt="商品原图" />
          ) : (
            <span className="product-emoji">🛍️</span>
          )}
          <span className="preview-badge">原图</span>
        </div>
        <div className="product-shot cutout">
          {builtin ? (
            <span className="product-emoji">{builtin.emoji}</span>
          ) : flow.imagePaths[0] ? (
            <img src={flow.imagePaths[0]} alt="抠图预览" className="cutout-img" />
          ) : (
            <span className="product-emoji">✨</span>
          )}
          <span className="preview-badge">抠图 · Mock</span>
        </div>
      </section>

      <section className="style-row">
        {ANIME_STYLES.map((s) => (
          <button
            key={s.id}
            className={style === s.id ? "style-chip active" : "style-chip"}
            onClick={() => setStyle(s.id)}
          >
            <span>{s.emoji}</span>
            {s.label}
          </button>
        ))}
      </section>

      <section className="card form">
        <label className="field">
          <span className="field-label">名称</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <button className="field field-button" onClick={() => setPickerOpen(true)}>
          <span className="field-label">分类</span>
          <span className="field-value">
            {category ? `${category.icon} ${category.name}` : "选择分类"}
            <span className="go-arrow">›</span>
          </span>
        </button>

        <label className="field">
          <span className="field-label">单价（元）</span>
          <input
            className="input"
            value={priceText}
            inputMode="decimal"
            onChange={(e) => setPriceText(e.target.value)}
          />
        </label>

        <div className="field field-inline">
          <span className="field-label">数量</span>
          <Stepper value={qty} onChange={setQty} />
        </div>
      </section>

      <div className="total-bar">
        <span>
          合计 <strong>¥{formatFen(total)}</strong>
        </span>
        <button className="btn primary" onClick={save}>
          记账并生成贴纸
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
