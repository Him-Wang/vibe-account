import { navigate } from "../lib/router";
import { hasApiKey, useSettings } from "../lib/settings";
import { hasVision } from "../lib/vision";
import { hasAsr } from "../lib/asr";
import { SparkIcon } from "./icons";

export function AiStrip() {
  useSettings();
  const text = hasApiKey();
  const vision = hasVision();
  const asr = hasAsr();
  const on = text || vision || asr;

  const hint = on
    ? [
        text ? "看账" : "",
        vision ? "核票" : "",
        asr ? "转写" : "",
      ].filter(Boolean).join(" · ")
    : "接上后能看账、核票、转写";

  return (
    <button
      className={on ? "ai-strip is-on" : "ai-strip"}
      onClick={() => navigate(on ? "/insights" : "/mine/settings")}
    >
      <span className="ai-strip-icon">
        <SparkIcon size={17} />
      </span>
      <span className="ai-strip-text">
        <strong>{on ? "AI 已接上" : "AI 还没接上"}</strong>
        <small>{hint}</small>
      </span>
      <span className="ai-strip-go">{on ? "看这个月 ›" : "去接上 ›"}</span>
    </button>
  );
}
