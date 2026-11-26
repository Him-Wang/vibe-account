import { useRef, useState } from "react";
import { BUILTIN_PRODUCTS } from "../lib/mock";
import { resetFlow, setFlow } from "../lib/flow";
import { navigate, useRoute } from "../lib/router";
import { formatFen } from "../lib/format";
import { hasVision } from "../lib/vision";
import { toast } from "../lib/ui";
import { NavBar } from "../components/ui";
import { CameraIcon, ImageIcon } from "../components/icons";
import type { BuiltinProduct } from "../types";

export default function Capture() {
  const route = useRoute();
  const mode = route.query.get("mode") === "product" ? "product" : "receipt";
  const albumRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const chosen = Array.from(files).slice(0, 4);
    // Read as data URLs: the local OCR and the optional vision model both need
    // bytes they can read, while blob: URLs only live in this tab.
    Promise.all(
      chosen.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("这张图片没读出来，换一张试试"));
            reader.readAsDataURL(file);
          })
      )
    )
      .then((urls) => {
        setPicked(urls);
        resetFlow();
        setFlow({ mode, imagePaths: urls });
        navigate("/processing");
      })
      .catch((err) => {
        toast(err instanceof Error ? err.message : "图片读取失败");
      });
  };

  const pickBuiltin = (item: BuiltinProduct) => {
    resetFlow();
    setFlow({ mode: "product", imagePaths: [], builtin: item });
    navigate("/product-confirm");
  };

  return (
    <div className="page">
      <NavBar title={mode === "receipt" ? "扫票" : "拍物"} sub="拍一张或者从相册挑，我来处理" />

      <section className="capture-actions">
        <button className="capture-card" onClick={() => cameraRef.current?.click()}>
          <span className="capture-icon">
            <CameraIcon size={26} />
          </span>
          <strong>拍一张</strong>
          <small>{mode === "receipt" ? "拍整张小票" : "拍想收进图鉴的东西"}</small>
        </button>
        <button className="capture-card" onClick={() => albumRef.current?.click()}>
          <span className="capture-icon">
            <ImageIcon size={26} />
          </span>
          <strong>从相册选</strong>
          <small>{mode === "receipt" ? "一次最多 4 张" : "挑一张清楚的"}</small>
        </button>
      </section>

      <input
        ref={albumRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {picked.length > 0 && (
        <div className="picked">
          {picked.map((url) => (
            <img key={url} src={url} alt="已选图片" />
          ))}
        </div>
      )}

      <section className="card">
        <h3 className="card-title">小提示</h3>
        <ul className="tips">
          <li>
            {mode === "product"
              ? "背景干净、商品完整入镜，抠出来更干净。"
              : "把小票放平，光线充足，文字越清楚识别越准。"}
          </li>
          <li>
            {mode === "product"
              ? "图片只在本机预览，抠图和画风目前是演示。"
              : hasVision()
                ? "本地 OCR 先读字，随后把小票图发给已配置的视觉模型核对。"
                : "图片只在本机用 OCR 读字，不会上传；配置视觉模型后才会上传核对。"}
          </li>
          <li>
            {mode === "product"
              ? "没有真实商品也可以直接选下面的样张体验。"
              : "没有真实小票也没关系，随便选一张图片就能体验识别流程。"}
          </li>
        </ul>
      </section>

      {mode === "product" && (
        <section className="section">
          <div className="section-head">
            <h2>样张</h2>
            <span className="muted small">点一下直接试</span>
          </div>
          <div className="builtin-grid">
            {BUILTIN_PRODUCTS.map((item) => (
              <button key={item.name} className="builtin" onClick={() => pickBuiltin(item)}>
                <span className="builtin-emoji" style={{ background: item.color + "26" }}>
                  {item.emoji}
                </span>
                <strong>{item.name}</strong>
                <small>¥{formatFen(item.price)}</small>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
