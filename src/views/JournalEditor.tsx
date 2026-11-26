import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { journalService } from "../lib/journals";
import { stickerService } from "../lib/stickers";
import { genId } from "../lib/storage";
import { back, useRoute } from "../lib/router";
import { promptDialog, toast } from "../lib/ui";
import { NavBar, Sheet } from "../components/ui";
import { BrushIcon, DownloadIcon, PaletteIcon, StickerIcon, TextIcon, UndoIcon } from "../components/icons";
import type { PageElement, StickerElement, TextElement, DrawElement } from "../types";

const PAPERS = [
  "#FFFFFF",
  "#FFF7F2",
  "#FDF6E3",
  "#FDE9E2",
  "#EAF5EE",
  "#EAF2FB",
  "#F2EDFA",
  "#F7F5F2",
];

const EMOJI_STICKERS = [
  "🍊", "🍓", "🌸", "⭐", "🌙", "☀️", "🌈", "🍰", "🎀", "💐",
  "🦋", "🐻", "🐱", "🎈", "💫", "🧸", "🥑", "🍉", "🎨", "📚",
];

type Tool = "none" | "draw";
type Panel = "bg" | "sticker" | null;
type Tab = "emoji" | "saved" | "upload";

export default function JournalEditor() {
  const route = useRoute();
  const bookId = route.query.get("bookId") || "";
  const pageId = route.query.get("pageId") || "";
  const page = useMemo(() => (pageId ? journalService.getPage(pageId) : undefined), [pageId]);
  const book = journalService.getBook(bookId);

  const [background, setBackground] = useState(page?.background.value || PAPERS[0]);
  const [elements, setElements] = useState<PageElement[]>(page?.elements || []);
  const [tool, setTool] = useState<Tool>("none");
  const [panel, setPanel] = useState<Panel>(null);
  const [tab, setTab] = useState<Tab>("emoji");
  const [exportOpen, setExportOpen] = useState(false);
  const [size, setSize] = useState({ w: 340, h: 453 });
  const [tick, setTick] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useRef<Map<string, HTMLImageElement | null>>(new Map());
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const stroke = useRef<DrawElement | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ id: string; startDist: number; startW: number } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const savedStickers = useMemo(() => stickerService.list(), []);

  const getImage = useCallback((src: string) => {
    if (!src) return null;
    const cached = images.current.get(src);
    if (cached !== undefined) return cached;
    images.current.set(src, null);
    const img = new Image();
    img.onload = () => {
      images.current.set(src, img);
      setTick((t) => t + 1);
    };
    img.onerror = () => images.current.set(src, null);
    img.src = src;
    return null;
  }, []);

  const renderTo = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, scale = 1) => {
      ctx.save();
      ctx.scale(scale, scale);
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
      for (const el of elements) {
        ctx.save();
        if (el.type === "sticker") {
          if (el.emoji) {
            ctx.font = `${el.w}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(el.emoji, el.x + el.w / 2, el.y + el.h / 2);
          } else {
            const img = getImage(el.fileId);
            if (img) ctx.drawImage(img, el.x, el.y, el.w, el.h);
            else {
              ctx.fillStyle = "rgba(0,0,0,.06)";
              ctx.fillRect(el.x, el.y, el.w, el.h);
            }
          }
        } else if (el.type === "text") {
          ctx.fillStyle = el.color;
          ctx.font = `600 ${el.fontSize}px "PingFang SC","Noto Sans SC",sans-serif`;
          ctx.textBaseline = "top";
          const lines = el.text.split("\n");
          lines.forEach((line, i) => ctx.fillText(line, el.x, el.y + i * (el.fontSize * 1.35)));
        } else {
          if (el.points.length > 1) {
            ctx.strokeStyle = el.color;
            ctx.lineWidth = 6;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(el.points[0].x, el.points[0].y);
            for (const p of el.points.slice(1)) ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      ctx.restore();
    },
    [background, elements, getImage]
  );

  // Size the canvas to the available width, 3:4 portrait.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const w = Math.max(240, Math.min(wrap.clientWidth, 640));
      setSize({ w, h: Math.round((w * 4) / 3) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Paint
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderTo(ctx, size.w, size.h, 1);
  }, [size, renderTo, tick]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const hit = (p: { x: number; y: number }): PageElement | null => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (el.type === "draw") {
        for (const pt of el.points) {
          if (Math.abs(pt.x - p.x) < 12 && Math.abs(pt.y - p.y) < 12) return el;
        }
        continue;
      }
      if (p.x >= el.x - 8 && p.x <= el.x + el.w + 8 && p.y >= el.y - 8 && p.y <= el.y + el.h + 8) {
        return el;
      }
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    pointers.current.set(e.pointerId, p);

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const target = hit({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      if (target && target.type === "sticker") {
        pinch.current = {
          id: target._id,
          startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          startW: target.w,
        };
        drag.current = null;
      }
      return;
    }

    if (tool === "draw") {
      const el: DrawElement = {
        _id: genId(),
        type: "draw",
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        color: "#2C2A28",
        points: [p],
        zIndex: elements.length,
      };
      stroke.current = el;
      setElements((prev) => [...prev, el]);
      return;
    }

    const target = hit(p);
    if (target && target.type !== "draw") {
      drag.current = { id: (target as StickerElement | TextElement)._id, dx: p.x - target.x, dy: p.y - target.y };
    } else {
      drag.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = point(e);
    const had = pointers.current.has(e.pointerId);
    pointers.current.set(e.pointerId, p);

    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const ratio = dist / pinch.current.startDist;
      const width = Math.max(40, Math.min(600, pinch.current.startW * ratio));
      const id = pinch.current.id;
      setElements((prev) =>
        prev.map((el) =>
          el._id === id && el.type === "sticker" ? { ...el, w: width, h: width } : el
        )
      );
      return;
    }

    if (stroke.current) {
      const s = stroke.current;
      const nextPoints = [...s.points, p];
      stroke.current = { ...s, points: nextPoints };
      setElements((prev) => prev.map((el) => (el._id === s._id ? stroke.current! : el)));
      return;
    }

    if (drag.current && had) {
      const { id, dx, dy } = drag.current;
      setElements((prev) =>
        prev.map((el) =>
          el._id === id && el.type !== "draw" ? { ...el, x: p.x - dx, y: p.y - dy } : el
        )
      );
    }
  };

  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (stroke.current) {
      const s = stroke.current;
      const xs = s.points.map((p) => p.x);
      const ys = s.points.map((p) => p.y);
      const bounds = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys),
      };
      setElements((prev) => prev.map((el) => (el._id === s._id ? { ...el, ...bounds } : el)));
      stroke.current = null;
    }
    if (pointers.current.size === 0) drag.current = null;
  };

  const addSticker = (emoji: string, fileId = "") => {
    const w = fileId ? 180 : 140;
    const el: StickerElement = {
      _id: genId(),
      type: "sticker",
      x: (size.w - w) / 2,
      y: (size.h - w) / 2,
      w,
      h: w,
      emoji,
      fileId,
      zIndex: elements.length,
    };
    setElements((prev) => [...prev, el]);
    setPanel(null);
    setTool("none");
  };

  const addText = async () => {
    const text = await promptDialog({ title: "写点什么", placeholder: "今天也要好好吃饭" });
    if (!text) return;
    const fontSize = 34;
    const el: TextElement = {
      _id: genId(),
      type: "text",
      x: 32,
      y: size.h / 2,
      w: Math.min(size.w - 64, text.length * fontSize),
      h: fontSize * 1.4,
      text,
      color: "#2C2A28",
      fontSize,
      zIndex: elements.length,
    };
    setElements((prev) => [...prev, el]);
    setTool("none");
  };

  const undo = () => {
    setElements((prev) => prev.slice(0, -1));
  };

  const exportAt = (scale: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(size.w * scale);
    canvas.height = Math.round(size.h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderTo(ctx, size.w, size.h, scale);
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "suikouji-tieben.png";
    a.click();
    toast(`已导出 ${scale}x 图片`);
    setExportOpen(false);
  };

  const save = () => {
    if (!book) {
      toast("找不到这本贴册");
      return;
    }
    const payload = {
      width: Math.round(size.w),
      height: Math.round(size.h),
      background: { type: "color" as const, value: background },
      elements,
    };
    if (page) {
      journalService.updatePage(page._id, payload);
    } else {
      const pages = journalService.listPages(book._id);
      journalService.createPage(book._id, { index: pages.length, ...payload });
    }
    toast("这一页保存好了");
    window.setTimeout(() => back(), 320);
  };

  const onUpload = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    addSticker("", url);
  };

  return (
    <div className="page editor-page">
      <NavBar
        title={page ? `第 ${page.index + 1} 页` : "新贴页"}
        sub={book?.title || "贴册"}
        right={
          <button className="btn sm primary" onClick={save}>
            保存
          </button>
        }
      />

      <div className="canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className={tool === "draw" ? "paper drawing" : "paper"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
        />
      </div>

      <div className="editor-tools">
        <button className={panel === "bg" ? "tool active" : "tool"} onClick={() => setPanel(panel === "bg" ? null : "bg")}>
          <PaletteIcon size={19} />
          背景
        </button>
        <button
          className={panel === "sticker" ? "tool active" : "tool"}
          onClick={() => setPanel(panel === "sticker" ? null : "sticker")}
        >
          <StickerIcon size={19} />
          贴纸
        </button>
        <button className="tool" onClick={addText}>
          <TextIcon size={19} />
          文字
        </button>
        <button
          className={tool === "draw" ? "tool active" : "tool"}
          onClick={() => setTool(tool === "draw" ? "none" : "draw")}
        >
          <BrushIcon size={19} />
          画笔
        </button>
        <button className="tool" onClick={undo}>
          <UndoIcon size={19} />
          撤销
        </button>
        <button className="tool" onClick={() => setExportOpen(true)}>
          <DownloadIcon size={19} />
          导出
        </button>
      </div>

      <Sheet open={panel === "bg"} onClose={() => setPanel(null)} title="纸张颜色">
        <div className="paper-grid">
          {PAPERS.map((color) => (
            <button
              key={color}
              className={background === color ? "paper-swatch active" : "paper-swatch"}
              style={{ background: color }}
              onClick={() => {
                setBackground(color);
                setPanel(null);
              }}
              aria-label={color}
            />
          ))}
        </div>
      </Sheet>

      <Sheet open={panel === "sticker"} onClose={() => setPanel(null)} title="贴一张">
        <div className="tab-row">
          <button className={tab === "emoji" ? "tab-chip active" : "tab-chip"} onClick={() => setTab("emoji")}>
            内置
          </button>
          <button className={tab === "saved" ? "tab-chip active" : "tab-chip"} onClick={() => setTab("saved")}>
            我的贴纸
          </button>
          <button className={tab === "upload" ? "tab-chip active" : "tab-chip"} onClick={() => setTab("upload")}>
            上传图片
          </button>
        </div>

        {tab === "emoji" && (
          <div className="emoji-grid">
            {EMOJI_STICKERS.map((emoji) => (
              <button key={emoji} className="emoji-cell" onClick={() => addSticker(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        )}

        {tab === "saved" && (
          <div className="sticker-grid small">
            {savedStickers.length === 0 && <p className="muted small">还没有贴纸，去拍一件吧。</p>}
            {savedStickers.map((s) => (
              <button
                key={s._id}
                className="sticker-cell"
                onClick={() => (s.thumbFileId ? addSticker("", s.thumbFileId) : addSticker("📦"))}
              >
                {s.thumbFileId ? (
                  <img src={s.thumbFileId} alt={s.name} />
                ) : (
                  <span className="sticker-emoji">📦</span>
                )}
                <small>{s.name}</small>
              </button>
            ))}
          </div>
        )}

        {tab === "upload" && (
          <div className="upload-block">
            <button className="btn primary block" onClick={() => uploadRef.current?.click()}>
              从相册选一张
            </button>
            <p className="muted small">图片会作为贴纸放在画布中间，可以拖动缩放。</p>
          </div>
        )}
      </Sheet>

      <Sheet open={exportOpen} onClose={() => setExportOpen(false)} title="导出成图片">
        <div className="export-list">
          <button className="btn ghost block" onClick={() => exportAt(1)}>
            标准 · 1x
          </button>
          <button className="btn ghost block" onClick={() => exportAt(2)}>
            高清 · 2x
          </button>
          <button className="btn ghost block" onClick={() => exportAt(3)}>
            超清 · 3x
          </button>
        </div>
      </Sheet>

      <input ref={uploadRef} type="file" accept="image/*" hidden onChange={(e) => onUpload(e.target.files)} />
    </div>
  );
}
