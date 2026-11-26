/**
 * 随口记 · Cloudflare Worker（Workers AI 版）
 *
 * 不需要外部 API Key：在 Worker 里绑定 Workers AI（变量名 AI），
 * 浏览器用 /v1/chat/completions 调它，Worker 再调用 Cloudflare 的模型。
 *
 * 环境变量：
 *   PROXY_TOKEN  必填。浏览器偏好里填同一个值当 API Key。
 *   ALLOW_ORIGIN 可选，默认 *。
 */

const TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) },
  });
}

function fail(message, status, origin) {
  return json({ error: { message } }, status, origin);
}

function openAI(content, origin) {
  return json(
    {
      id: "chatcmpl-proxy",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "workers-ai",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    },
    200,
    origin
  );
}

function dataUrlToBytes(url) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(url || "");
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function extractVision(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (!Array.isArray(msg.content)) continue;
    const text = msg.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    const image = msg.content.find((part) => part.type === "image_url");
    if (image) return { text, bytes: dataUrlToBytes(image.image_url?.url) };
  }
  return null;
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOW_ORIGIN || "*";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (request.method !== "POST") return fail("只接受 POST", 405, origin);

    const url = new URL(request.url);
    if (!/\/chat\/completions\/?$/.test(url.pathname)) {
      return fail("只提供 /v1/chat/completions", 404, origin);
    }

    if (!env.PROXY_TOKEN) return fail("Worker 还没设置 PROXY_TOKEN", 500, origin);
    const auth = request.headers.get("Authorization") || "";
    if (auth !== `Bearer ${env.PROXY_TOKEN}`) return fail("口令不对", 401, origin);
    if (!env.AI) return fail("Worker 还没绑定 Workers AI（变量名 AI）", 500, origin);

    let body;
    try {
      body = await request.json();
    } catch {
      return fail("请求体不是 JSON", 400, origin);
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const vision = extractVision(messages);
    const model = String(body.model || "").startsWith("@cf/")
      ? body.model
      : vision
        ? VISION_MODEL
        : TEXT_MODEL;

    try {
      let result;
      if (vision) {
        if (!vision.bytes) return fail("图片不是 data URL", 400, origin);
        result = await env.AI.run(model, {
          prompt: vision.text || "请读出这张小票上的内容，并尽量给出结构化信息。",
          image: [Array.from(vision.bytes)],
          max_tokens: Math.min(Number(body.max_tokens) || 900, 1600),
        });
      } else {
        result = await env.AI.run(model, {
          messages,
          max_tokens: Math.min(Number(body.max_tokens) || 900, 1600),
        });
      }
      const content =
        typeof result === "string"
          ? result
          : typeof result?.response === "string"
            ? result.response
            : result?.response && typeof result.response === "object"
              ? JSON.stringify(result.response)
              : typeof result?.choices?.[0]?.message?.content === "string"
                ? result.choices[0].message.content
                : JSON.stringify(result);
      return openAI(content, origin);
    } catch (err) {
      return fail(err instanceof Error ? err.message : "Workers AI 调用失败", 502, origin);
    }
  },
};
