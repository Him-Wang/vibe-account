# serverless 代理（可选）

只解决一件事：让网页能调视觉 / 转写接口，同时不把上游 Key 暴露在浏览器里。

```
网页 ──Authorization: Bearer <PROXY_TOKEN>──▶ Worker ──Authorization: Bearer <UPSTREAM_KEY>──▶ OpenAI 兼容接口
```

Worker 只放行两条路径：

- `POST /v1/chat/completions`（视觉核对）
- `POST /v1/audio/transcriptions`（语音转写）

## 1. 装一次 wrangler

```bash
cd serverless
npx wrangler login
```

## 2. 配密钥

```bash
npx wrangler secret put PROXY_TOKEN    # 自己定一个口令，网页里会填它
npx wrangler secret put UPSTREAM_KEY   # 真正的上游 Key，例如 sk-...
```

上游地址在 `wrangler.toml` 的 `UPSTREAM_BASE`，默认 OpenAI。要换通义千问，把它改成：

```toml
UPSTREAM_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1"
```

如果视觉和语音不是同一家，再加一个 `UPSTREAM_BASE_ASR` 变量，Worker 会按路径分流。

## 3. 部署

```bash
npx wrangler deploy
```

会得到一个类似 `https://suikouji-proxy.<你的账号>.workers.dev` 的地址。

## 4. 填进随口记

「本机 → 偏好」里两处都选 **自定义**：

| 字段 | 视觉核对 | 语音输入 |
| --- | --- | --- |
| 接口地址 | `https://suikouji-proxy.xxx.workers.dev/v1` | 同上 |
| 模型 | `gpt-4o-mini` | `whisper-1` |
| API Key | 填 `PROXY_TOKEN` | 同一个 `PROXY_TOKEN` |

网页会把 `PROXY_TOKEN` 当 Bearer 发给 Worker；Worker 校验通过后，换成真正的上游 Key 再转发，所以浏览器里永远看不到 `UPSTREAM_KEY`。

## 另一版：不用上游 Key，直接用 Cloudflare Workers AI

`worker-ai.mjs` 自带文本模型和视觉模型，不需要 OpenAI Key。适合只在国内部署、想把 Key 问题彻底省掉的场景。它用单独的 `wrangler.ai.toml`：

```bash
npx wrangler secret put PROXY_TOKEN --config wrangler.ai.toml
npx wrangler deploy --config wrangler.ai.toml
```

网页端只填 `https://<worker>.workers.dev/v1` 和 `PROXY_TOKEN` 即可；模型可以随便填（Worker 会用自己的模型），视觉核对和看账都走 Workers AI 的免费额度。注意 Workers AI 的模型能力和额度会随 Cloudflare 政策变化，正式用之前先看控制台的用量。

## 安全提醒

- `ALLOW_ORIGIN` 建议改成你的 Pages 域名，而不是 `*`。CORS 不是鉴权，只是减少被别的网站直接调用的机会。
- `PROXY_TOKEN` 是唯一的口令，泄露了就等于泄露额度；换口令后记得在网页里同步改。
- 这是个人/小范围使用的代理，没有做限流。公开部署前可以在 Cloudflare 侧加 Rate Limiting，或在 Worker 里按 IP 计数。
- 浏览器直连第三方接口如果对方允许 CORS，也可以不搭代理；代理的价值是「绕 CORS + 藏 Key + 统一出口」。

## 本地试跑

```bash
cp .dev.vars.example .dev.vars   # 填上测试值
npx wrangler dev
```

然后网页接口地址填 `http://127.0.0.1:8787/v1`。
