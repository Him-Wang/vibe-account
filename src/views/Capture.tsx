import { useRef, useState } from "react";
import { BUILTIN_PRODUCTS } from "../lib/mock";
import { resetFlow, setFlow } from "../lib/flow";
import { navigate, useRoute } from "../lib/router";
import { formatFen } from "../lib/format";
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
    const urls = Array.from(files)
      .slice(0, 4)
      .map((file) => URL.createObjectURL(file));
    setPicked(urls);
    resetFlow();
    setFlow({ mode, imagePaths: urls });
    navigate("/processing");
  };

  const pickBuiltin = (item: BuiltinProduct) => {
    resetFlow();
    setFlow({ mode: "product", imagePaths: [], builtin: item });
    navigate("/product-confirm");
  };

  return (
    <div className="page">
      <NavBar title={mode === "receipt" ? "拍小票" : "拍商品"} sub="拍照或从相册选图，AI 自动处理" />

      <section className="capture-actions">
        <button className="capture-card" onClick={() => cameraRef.current?.click()}>
          <span className="capture-icon">
            <CameraIcon size={26} />
          </span>
          <strong>拍一张</strong>
          <small>{mode === "receipt" ? "拍整张消费小票" : "拍想变成贴纸的东西"}</small>
        </button>
        <button className="capture-card" onClick={() => albumRef.current?.click()}>
          <span className="capture-icon">
            <ImageIcon size={26} />
          </span>
          <strong>从相册选</strong>
          <small>{mode === "receipt" ? "一次最多 4 张" : "选一张清楚的图"}</small>
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
          <li>图片只在本机处理与保存，不会上传到服务器。</li>
          <li>
            {mode === "product"
              ? "没有真实商品也可以直接选下面的内置图库体验。"
              : "没有真实小票也没关系，随便选一张图片就能体验识别流程。"}
          </li>
        </ul>
      </section>

      {mode === "product" && (
        <section className="section">
          <div className="section-head">
            <h2>内置图库</h2>
            <span className="muted small">点一下直接记账</span>
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
