import { useState } from "react";
import { getSettings, hasApiKey, hasImageGen, saveSettings, useSettings } from "../lib/settings";
import { toast } from "../lib/ui";
import { Field, NavBar, Segmented } from "../components/ui";
import { VISION_PRESETS, hasVision } from "../lib/vision";
import { ASR_PRESETS, hasAsr } from "../lib/asr";
import { IMAGE_PRESETS } from "../lib/imagegen";
import { navigate } from "../lib/router";
import { SparkIcon } from "../components/icons";
import type { AiMockMode } from "../types";

export default function Settings() {
  const settings = useSettings();
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [visionPreset, setVisionPreset] = useState(settings.visionPreset);
  const [visionBaseUrl, setVisionBaseUrl] = useState(settings.visionBaseUrl);
  const [visionModel, setVisionModel] = useState(settings.visionModel);
  const [visionApiKey, setVisionApiKey] = useState(settings.visionApiKey);
  const [asrPreset, setAsrPreset] = useState(settings.asrPreset);
  const [asrBaseUrl, setAsrBaseUrl] = useState(settings.asrBaseUrl);
  const [asrModel, setAsrModel] = useState(settings.asrModel);
  const [asrApiKey, setAsrApiKey] = useState(settings.asrApiKey);
  const [imagePreset, setImagePreset] = useState(settings.imagePreset);
  const [imageBaseUrl, setImageBaseUrl] = useState(settings.imageBaseUrl);
  const [imageModel, setImageModel] = useState(settings.imageModel);
  const [imageApiKey, setImageApiKey] = useState(settings.imageApiKey);

  const pickVisionPreset = (id: string) => {
    setVisionPreset(id);
    const preset = VISION_PRESETS.find((p) => p.id === id);
    if (preset?.baseUrl) {
      setVisionBaseUrl(preset.baseUrl);
      setVisionModel(preset.model);
    }
  };

  const pickAsrPreset = (id: string) => {
    setAsrPreset(id);
    const preset = ASR_PRESETS.find((p) => p.id === id);
    if (preset?.baseUrl) {
      setAsrBaseUrl(preset.baseUrl);
      setAsrModel(preset.model);
    }
  };

  const saveVision = () => {
    const active =
      visionPreset !== "off" &&
      Boolean(visionBaseUrl.trim() && visionModel.trim() && visionApiKey.trim());
    saveSettings({
      visionPreset,
      visionBaseUrl: visionBaseUrl.trim(),
      visionModel: visionModel.trim(),
      visionApiKey: visionApiKey.trim(),
    });
    toast(active ? "视觉模型已接上" : "视觉模型已关闭，只用本地 OCR");
  };

  const saveAsr = () => {
    const active =
      asrPreset !== "off" &&
      Boolean(asrBaseUrl.trim() && asrModel.trim() && asrApiKey.trim());
    saveSettings({
      asrPreset,
      asrBaseUrl: asrBaseUrl.trim(),
      asrModel: asrModel.trim(),
      asrApiKey: asrApiKey.trim(),
    });
    toast(active ? "录音转写已接上" : "已切回本机语音");
  };

  const pickImagePreset = (id: string) => {
    setImagePreset(id);
    const preset = IMAGE_PRESETS.find((p) => p.id === id);
    if (preset?.baseUrl) {
      setImageBaseUrl(preset.baseUrl);
      setImageModel(preset.model);
    }
  };

  const saveImage = () => {
    const active =
      imagePreset !== "off" &&
      Boolean(imageBaseUrl.trim() && imageModel.trim() && imageApiKey.trim());
    saveSettings({
      imagePreset,
      imageBaseUrl: imageBaseUrl.trim(),
      imageModel: imageModel.trim(),
      imageApiKey: imageApiKey.trim(),
    });
    toast(active ? "画风生成已接上" : "画风生成已关闭，拍物先存抠图");
  };

  const saveModel = () => {
    saveSettings({ baseUrl: baseUrl.trim(), model: model.trim(), apiKey: apiKey.trim() });
    toast("存好了");
  };

  const setMock = (mode: AiMockMode) => {
    saveSettings({ aiMockMode: mode });
    toast(
      mode === "auto" ? "AI 恢复正常" : mode === "fail" ? "AI 演示失败态" : "AI 演示超时态"
    );
  };

  return (
    <div className="page">
      <NavBar title="偏好" sub="解析、视觉、语音与画风" />

      <p className="settings-note">
        下面四项都可以不填。不填也能扫票、说话、抠图、记账；只有想接外部 AI 时才需要填。
      </p>

      <section className="ai-status-card">
        <div className="ai-status-head">
          <span className="ai-card-icon">
            <SparkIcon size={17} />
          </span>
          <strong>AI 状态</strong>
          <small>
            {[hasApiKey(), hasVision(), hasAsr(), hasImageGen()].filter(Boolean).length}/4 已接
          </small>
        </div>
        <div className="ai-status-rows">
          <span className={hasApiKey() ? "on" : ""}>
            <i />
            文字解析
            <b>{hasApiKey() ? "已接" : "本机规则"}</b>
          </span>
          <span className={hasVision() ? "on" : ""}>
            <i />
            小票核对
            <b>{hasVision() ? "已接" : "本地 OCR"}</b>
          </span>
          <span className={hasAsr() ? "on" : ""}>
            <i />
            语音转写
            <b>{hasAsr() ? "已接" : "本机语音"}</b>
          </span>
          <span className={hasImageGen() ? "on" : ""}>
            <i />
            画风生成
            <b>{hasImageGen() ? "已接" : "本地抠图"}</b>
          </span>
        </div>
        {hasApiKey() && (
          <button className="btn small" onClick={() => navigate("/insights")}>
            去看这个月的账
          </button>
        )}
      </section>

      <section className="card form">
        <h3 className="card-title">语音与文字解析（可选）</h3>
        <p className="muted small">
          填一个 OpenAI 兼容接口，就能把整句话拆成多笔；不填则用本地规则解析。Key 只存在本机浏览器。
        </p>
        <Field label="接口地址">
          <input
            className="input"
            value={baseUrl}
            placeholder="https://api.deepseek.com/v1"
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </Field>
        <Field label="模型">
          <input
            className="input"
            value={model}
            placeholder="deepseek-chat"
            onChange={(e) => setModel(e.target.value)}
          />
        </Field>
        <Field label="API Key">
          <div className="key-row">
            <input
              className="input"
              type={showKey ? "text" : "password"}
              value={apiKey}
              placeholder="sk-..."
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button className="btn sm ghost" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "隐藏" : "显示"}
            </button>
          </div>
        </Field>
        <button className="btn primary block" onClick={saveModel}>
          存下解析设置
        </button>
      </section>

      <section className="card form">
        <h3 className="card-title">小票视觉核对（可选）</h3>
        <p className="muted small">
          先选预设并填 Key 才会启用；否则只用本地 OCR。启用后扫票会在本机读字，再把图和字交给视觉模型核对。
        </p>
        <Field label="预设">
          <select
            className="input"
            value={visionPreset}
            onChange={(e) => pickVisionPreset(e.target.value)}
          >
            {VISION_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="接口地址">
          <input
            className="input"
            value={visionBaseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={(e) => setVisionBaseUrl(e.target.value)}
          />
        </Field>
        <Field label="视觉模型">
          <input
            className="input"
            value={visionModel}
            placeholder="gpt-4o-mini"
            onChange={(e) => setVisionModel(e.target.value)}
          />
        </Field>
        <Field label="视觉 API Key">
          <div className="key-row">
            <input
              className="input"
              type={showKey ? "text" : "password"}
              value={visionApiKey}
              placeholder="sk-..."
              onChange={(e) => setVisionApiKey(e.target.value)}
            />
            <button className="btn sm ghost" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "隐藏" : "显示"}
            </button>
          </div>
        </Field>
        <button className="btn primary block" onClick={saveVision}>
          存下视觉设置
        </button>
      </section>

      <section className="card form">
        <h3 className="card-title">语音输入（可选）</h3>
        <p className="muted small">
          不填 Key 也能用：默认在手机浏览器里录音并用本地 Whisper 识别，不上传、不花钱（首次下载模型约 60MB）。
          填了 Key 则优先走云端转写；桌面 Chrome / Edge 也可用浏览器自带语音。
        </p>
        <Field label="预设">
          <select
            className="input"
            value={asrPreset}
            onChange={(e) => pickAsrPreset(e.target.value)}
          >
            {ASR_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="转写接口">
          <input
            className="input"
            value={asrBaseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={(e) => setAsrBaseUrl(e.target.value)}
          />
        </Field>
        <Field label="转写模型">
          <input
            className="input"
            value={asrModel}
            placeholder="whisper-1"
            onChange={(e) => setAsrModel(e.target.value)}
          />
        </Field>
        <Field label="转写 API Key">
          <input
            className="input"
            type={showKey ? "text" : "password"}
            value={asrApiKey}
            placeholder="sk-..."
            onChange={(e) => setAsrApiKey(e.target.value)}
          />
        </Field>
        <button className="btn primary block" onClick={saveAsr}>
          存下语音设置
        </button>
      </section>

      <section className="card form">
        <h3 className="card-title">图片生成（可选）</h3>
        <p className="muted small">
          配一个支持 /images/edits 的图片接口，拍物时才能真的把商品换成可爱、漫画、油画或素描。不配就只存抠图。
        </p>
        <Field label="预设">
          <select
            className="input"
            value={imagePreset}
            onChange={(e) => pickImagePreset(e.target.value)}
          >
            {IMAGE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="图片接口">
          <input
            className="input"
            value={imageBaseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={(e) => setImageBaseUrl(e.target.value)}
          />
        </Field>
        <Field label="图片模型">
          <input
            className="input"
            value={imageModel}
            placeholder="gpt-image-1"
            onChange={(e) => setImageModel(e.target.value)}
          />
        </Field>
        <Field label="图片 API Key">
          <div className="key-row">
            <input
              className="input"
              type={showKey ? "text" : "password"}
              value={imageApiKey}
              placeholder="sk-..."
              onChange={(e) => setImageApiKey(e.target.value)}
            />
            <button className="btn sm ghost" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "隐藏" : "显示"}
            </button>
          </div>
        </Field>
        <button className="btn primary block" onClick={saveImage}>
          存下图片设置
        </button>
      </section>

      <section className="card form">
        <h3 className="card-title">拍物演示模式</h3>
        <p className="muted small">只影响拍物：可以模拟失败和超时的样子。</p>
        <Segmented
          value={settings.aiMockMode}
          onChange={setMock}
          options={[
            { value: "auto", label: "正常" },
            { value: "fail", label: "失败" },
            { value: "timeout", label: "超时" },
          ]}
        />
      </section>

      <p className="muted small center">随口记 · 纯网页版 0.2.0</p>
    </div>
  );
}
