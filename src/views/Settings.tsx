import { useState } from "react";
import { getSettings, saveSettings, useSettings } from "../lib/settings";
import { toast } from "../lib/ui";
import { Field, NavBar, Segmented } from "../components/ui";
import type { AiMockMode } from "../types";

export default function Settings() {
  const settings = useSettings();
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [showKey, setShowKey] = useState(false);

  const saveModel = () => {
    saveSettings({ baseUrl: baseUrl.trim(), model: model.trim(), apiKey: apiKey.trim() });
    toast("设置已保存");
  };

  const setMock = (mode: AiMockMode) => {
    saveSettings({ aiMockMode: mode });
    toast(
      mode === "auto" ? "AI 恢复正常" : mode === "fail" ? "AI 演示失败态" : "AI 演示超时态"
    );
  };

  return (
    <div className="page">
      <NavBar title="设置" sub="模型、外观与演示" />

      <section className="card form">
        <h3 className="card-title">语音与文字解析</h3>
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
          保存解析设置
        </button>
      </section>

      <section className="card form">
        <h3 className="card-title">外观</h3>
        <div className="field field-inline">
          <span className="field-label">毛玻璃</span>
          <button
            className={settings.glass ? "toggle on" : "toggle"}
            onClick={() => saveSettings({ glass: !settings.glass })}
            aria-label="切换毛玻璃"
          >
            <span />
          </button>
        </div>
        <p className="muted small">关掉后界面更省电，旧设备更流畅。</p>
      </section>

      <section className="card form">
        <h3 className="card-title">AI 演示模式</h3>
        <p className="muted small">没有真实识别服务时，可以用它体验失败与超时的样子。</p>
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

      <p className="muted small center">Vibe Account · 纯网页版 0.2.0</p>
    </div>
  );
}
