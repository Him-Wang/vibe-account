import { useMemo, useState } from "react";
import { billService } from "../lib/bills";
import { categoryService } from "../lib/categories";
import { stickerService } from "../lib/stickers";
import { getFlow, resetFlow } from "../lib/flow";
import { fenToYuan, formatFen, today, yuanToFen } from "../lib/format";
import { replace } from "../lib/router";
import { toast } from "../lib/ui";
import { builtinStickerDataUrl } from "../lib/stickerArt";
import { hasImageGen } from "../lib/settings";
import { stylizeProduct } from "../lib/imagegen";
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
  const [styleImage, setStyleImage] = useState("");
  const [styling, setStyling] = useState(false);
  const [category, setCategory] = useState<Category | undefined>(initialCat);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!builtin && flow.imagePaths.length === 0) {
    return (
      <div className="page">
        <NavBar title="收下这件" />
        <p className="muted">没有待确认的商品，回去重新拍一件吧。</p>
      </div>
    );
  }

  const unit = yuanToFen(Number(priceText));
  const total = unit * qty;
  // Builtin samples have no photo: generate a small sticker sheet locally so
  // the sticker record always has a readable image.
  const builtinImage = builtin ? builtinStickerDataUrl(builtin) : "";
  const image = flow.imagePaths[0] || builtinImage;
  const cutout = flow.segment?.cutoutFileId || image;

  const generateStyle = async (next: string) => {
    setStyle(next);
    setStyleImage("");
    if (!hasImageGen()) {
      toast("先到偏好里接上图片生成，画风才会真的生成");
      return;
    }
    setStyling(true);
    try {
      const out = await stylizeProduct(cutout || image, next);
      setStyleImage(out);
      toast("画风生成好了，看看右边");
    } catch (err) {
      toast(err instanceof Error ? err.message : "画风没生成出来");
    } finally {
      setStyling(false);
    }
  };

  const save = () => {
    if (!category) {
      toast("先选一个分类");
      return;
    }
    if (total <= 0) {
      toast("单价要大于 0");
      return;
    }
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
      cutoutFileId: cutout,
      animeFileId: styleImage || cutout,
      thumbFileId: styleImage || image,
      categoryName: category.name,
      billId: bill._id,
    });
    resetFlow();
    toast("记好了，图鉴里多一张");
    window.setTimeout(() => replace("/bills"), 320);
  };

  return (
    <div className="page">
      <NavBar title="收下这件" sub="看一眼，收进图鉴" />

      <section className="product-preview">
        <div className="product-shot">
          {builtinImage ? (
            <img src={builtinImage} alt={builtin?.name || "商品样张"} />
          ) : flow.imagePaths[0] ? (
            <img src={flow.imagePaths[0]} alt="商品原图" />
          ) : (
            <span className="product-emoji">🛍️</span>
          )}
          <span className="preview-badge">原图</span>
        </div>
        <div className="product-shot cutout">
          {builtinImage ? (
            <img src={builtinImage} alt={`${builtin?.name || "商品"}贴纸`} className="cutout-img" />
          ) : styleImage ? (
            <img src={styleImage} alt="画风生成预览" className="cutout-img" />
          ) : cutout ? (
            <img src={cutout} alt="本地抠图预览" className="cutout-img" />
          ) : (
            <span className="product-emoji">✨</span>
          )}
          <span className="preview-badge">
            {builtinImage
              ? "样张贴纸"
              : styleImage
                ? `画风 · ${ANIME_STYLES.find((s) => s.id === style)?.label || style}`
                : "本地抠图"}
          </span>
        </div>
      </section>

      <section className="style-row">
        {ANIME_STYLES.map((s) => (
          <button
            key={s.id}
            className={style === s.id ? "style-chip active" : "style-chip"}
            onClick={() => generateStyle(s.id)}
            disabled={styling}
          >
            <span>{s.emoji}</span>
            {s.label}
          </button>
        ))}
      </section>
      <p className="muted tiny style-note">
        {styling
          ? "正在按这个画风生成，可能要十几秒…"
          : hasImageGen()
            ? "点画风会调用你配置的图片接口，生成后再保存。"
            : "没配图片生成时先存抠图；接上图片接口后，画风才会真的生成。"}
      </p>

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
          <span className="field-label">单价</span>
          <input
            className="input"
            value={priceText}
            inputMode="decimal"
            onChange={(e) => setPriceText(e.target.value)}
          />
        </label>

        <div className="field field-inline">
          <span className="field-label">几件</span>
          <Stepper value={qty} onChange={setQty} />
        </div>
      </section>

      <div className="total-bar">
        <span>
          合计 <strong>¥{formatFen(total)}</strong>
        </span>
        <button className="btn primary" onClick={save}>
          记下并收进图鉴
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
