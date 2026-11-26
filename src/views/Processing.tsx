import { useEffect, useState } from "react";
import { mockAnime } from "../lib/mock";
import { recognizeReceipt } from "../lib/ocr";
import { cutoutProduct } from "../lib/cutout";
import { hasVision, refineReceiptWithVision } from "../lib/vision";
import { getFlow, setFlow } from "../lib/flow";
import { navigate } from "../lib/router";

export default function Processing() {
  const mode = getFlow().mode;
  const imagePath = getFlow().imagePaths[0];
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setNote("");
    setProgress(0);
    setDone(false);

    const run = async () => {
      try {
        if (mode === "receipt") {
          if (!imagePath) throw new Error("没有待识别的小票图片");
          setPhase("正在准备本地 OCR…");
          const local = await recognizeReceipt(imagePath, (p) => {
            if (!cancelled) {
              setPhase(p < 100 ? "正在读小票上的字…" : "本地字读完了…");
              setProgress(5 + Math.round(p * 0.5));
            }
          });
          if (cancelled) return;
          setProgress(58);
          let ocr = local;
          if (hasVision()) {
            setPhase("正在让视觉模型核对…");
            try {
              ocr = await refineReceiptWithVision(imagePath, local);
            } catch (err) {
              if (cancelled) return;
              const reason = err instanceof Error ? err.message : "";
              setNote(
                /failed to fetch|network|load failed/i.test(reason)
                  ? "视觉接口没连上（可能是跨域或网络问题），先用本地 OCR 的结果。"
                  : `视觉模型没核对成功，先用本地 OCR 的结果${reason ? `：${reason}` : ""}`
              );
            }
          }
          if (cancelled) return;
          setFlow({ ocr });
          setProgress(100);
          setPhase("识别完成");
        } else {
          if (!imagePath) throw new Error("没有待处理的商品图片");
          const cutout = await cutoutProduct(
            imagePath,
            (ratio) => {
              if (cancelled) return;
              setProgress(5 + Math.round(ratio * 85));
            },
            (text) => {
              if (!cancelled) setPhase(text);
            }
          );
          if (cancelled) return;
          setProgress(94);
          setPhase("正在生成画风…");
          const anime = await mockAnime("cute");
          if (cancelled) return;
          setFlow({
            segment: {
              cutoutFileId: cutout || imagePath,
              whiteBorder: false,
              provider: cutout ? "birefnet-lite" : "original",
            },
            anime,
          });
          setProgress(100);
          setPhase("贴纸准备好了");
        }
        setDone(true);
        window.setTimeout(() => {
          if (cancelled) return;
          navigate(mode === "receipt" ? "/receipt-confirm" : "/product-confirm");
        }, 360);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "处理失败";
        setError(
          /failed to fetch|network|load failed/i.test(message)
            ? mode === "receipt"
              ? "本地 OCR 模型没下载下来，检查网络后再试一次。小票图片没有上传。"
              : "抠图模型没下载下来，检查网络后再试一次。图片没有上传。"
            : message
        );
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [attempt, mode, imagePath]);

  const status = error ? "处理没有成功" : done ? "处理完成，正在跳转…" : phase || "准备中…";

  return (
    <div className="page processing">
      <div className="progress-ring" style={{ ["--p" as string]: `${progress}%` }}>
        <div className="progress-inner">
          <strong>{progress}%</strong>
          <small>{mode === "receipt" ? "识别中" : "处理中"}</small>
        </div>
      </div>

      <h2>{status}</h2>
      {error && <p className="error-text">{error}</p>}
      {!error && note && <p className="muted small">{note}</p>}

      {imagePath && <img className="processing-thumb" src={imagePath} alt="待处理图片" />}

      <div className="progress-bar">
        <div style={{ width: `${progress}%` }} />
      </div>

      {error ? (
        <div className="sheet-actions">
          <button className="btn ghost" onClick={() => navigate("/capture")}>
            重新选图
          </button>
          <button className="btn primary" onClick={() => setAttempt((a) => a + 1)}>
            再试一次
          </button>
        </div>
      ) : (
        <p className="muted small">
          {mode === "receipt"
            ? hasVision()
              ? "本地 OCR + 视觉模型核对"
              : "本地 OCR，图片不出这台设备"
            : "本地 BiRefNet 抠图，图片不出这台设备"}
        </p>
      )}
    </div>
  );
}
