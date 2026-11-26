/**
 * 随口记 · 轻量 serverless 代理（Cloudflare Worker）
 *
 * 浏览器 → 这个 Worker → 上游 OpenAI 兼容接口。
 * - 上游 Key 只放在 Worker 的环境变量里，不下发到网页。
 * - 网页用 PROXY_TOKEN 当 Bearer，防止别人白嫖你的额度。
 * - 只转发两条固定路径：/v1/chat/completions 和 /v1/audio/transcriptions。
 */

const CORS_HEADERS = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
});

const ALLOWED_PATHS = new Set([
  "/v1/chat/completions",
  "/chat/completions",
  "/v1/audio/transcriptions",
  "/audio/transcriptions",
]);

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS(origin),
    },
  });
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOW_ORIGIN || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS(origin) });
    }

    if (request.method !== "POST") {
      return json({ error: "只接受 POST" }, 405, origin);
    }

    const url = new URL(request.url);
    if (!ALLOWED_PATHS.has(url.pathname)) {
      return json({ error: "不支持的路径" }, 404, origin);
    }

    const auth = request.headers.get("Authorization") || "";
    const expected = env.PROXY_TOKEN ? `Bearer ${env.PROXY_TOKEN}` : "";
    if (!expected || auth !== expected) {
      return json({ error: "代理口令不对" }, 401, origin);
    }

    if (!env.UPSTREAM_KEY) {
      return json({ error: "Worker 还没配置 UPSTREAM_KEY" }, 500, origin);
    }

    const isAudio = url.pathname.endsWith("/audio/transcriptions");
    const base = (
      (isAudio && env.UPSTREAM_BASE_ASR) ||
      env.UPSTREAM_BASE ||
      "https://api.openai.com/v1"
    ).replace(/\/+$/, "");

    // Strip the optional /v1 prefix, because the upstream base already has it.
    const target = `${base}${url.pathname.replace(/^\/v1/, "")}`;
    const body = await request.arrayBuffer();
    if (body.byteLength > 12 * 1024 * 1024) {
      return json({ error: "请求太大了" }, 413, origin);
    }

    const headers = new Headers();
    headers.set("Authorization", `Bearer ${env.UPSTREAM_KEY}`);
    const contentType = request.headers.get("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);

    let upstream;
    try {
      upstream = await fetch(target, { method: "POST", headers, body });
    } catch (err) {
      return json(
        { error: `连不上上游：${err instanceof Error ? err.message : "未知错误"}` },
        502,
        origin
      );
    }

    const out = new Headers();
    out.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
    for (const [key, value] of Object.entries(CORS_HEADERS(origin))) out.set(key, value);

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: out,
    });
  },
};
