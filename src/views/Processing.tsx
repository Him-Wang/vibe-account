import { useEffect, useState } from "react";
import { mockAnime, mockOcr, mockSegment, simulateProgress } from "../lib/mock";
import { getFlow, setFlow } from "../lib/flow";
import { navigate } from "../lib/router";

export default function Processing() {
  const mode = getFlow().mode;
  const imagePath = getFlow().imagePaths[0];
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setProgress(0);
    setDone(false);

    const run = async () => {
      try {
        if (mode === "receipt") {
          const [ocr] = await Promise.all([mockOcr(), simulateProgress(setProgress, 1800)]);
          if (cancelled) return;
          setFlow({ ocr });
        } else {
          const [segment, anime] = await Promise.all([
            mockSegment(),
            mockAnime("cute"),
            simulateProgress(setProgress, 1800),
          ]);
          if (cancelled) return;
          setFlow({ segment, anime });
        }
        setProgress(100);
        setDone(true);
        window.setTimeout(() => {
          if (cancelled) return;
          navigate(mode === "receipt" ? "/receipt-confirm" : "/product-confirm");
        }, 320);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "处理失败");
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [attempt, mode]);

  const status = (() => {
    if (done) return "处理完成，正在跳转…";
    if (mode === "receipt") {
      if (progress < 40) return "正在识别小票文字…";
      if (progress < 80) return "正在解析金额…";
      return "即将完成…";
    }
    if (progress < 40) return "正在抠出商品主体…";
    if (progress < 80) return "正在动漫化…";
    return "即将完成…";
  })();

  return (
    <div className="page processing">
      <div className="progress-ring" style={{ ["--p" as string]: `${progress}%` }}>
        <div className="progress-inner">
          <strong>{progress}%</strong>
          <small>{mode === "receipt" ? "识别中" : "处理中"}</small>
        </div>
      </div>

      <h2>{error ? "处理没有成功" : status}</h2>
      {error && <p className="error-text">{error}</p>}

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
        <p className="muted small">AI 演示模式，可随时返回</p>
      )}
    </div>
  );
}


