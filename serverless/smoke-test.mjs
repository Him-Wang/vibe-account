import http from "node:http";
import worker from "./worker.mjs";

const seen = [];
const upstream = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    seen.push({ url: req.url, auth: req.headers.authorization, body });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, path: req.url, received: body }));
  });
});

await new Promise((resolve) => upstream.listen(18999, "127.0.0.1", resolve));

const env = {
  PROXY_TOKEN: "p-token",
  UPSTREAM_KEY: "up-key",
  UPSTREAM_BASE: "http://127.0.0.1:18999/v1",
  ALLOW_ORIGIN: "https://example.com",
};

const call = (path, token, body = '{"model":"x"}') =>
  worker.fetch(
    new Request(`http://proxy.local${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    }),
    env
  );

const unauthorized = await call("/v1/chat/completions", "wrong");
if (unauthorized.status !== 401) throw new Error(`expected 401, got ${unauthorized.status}`);

const chat = await call("/v1/chat/completions", "p-token");
if (chat.status !== 200) throw new Error(`expected 200, got ${chat.status}`);
if (chat.headers.get("Access-Control-Allow-Origin") !== "https://example.com") {
  throw new Error("CORS header missing");
}
const payload = await chat.json();
if (payload.path !== "/v1/chat/completions") throw new Error(`bad upstream path ${payload.path}`);
if (seen[0]?.auth !== "Bearer up-key") throw new Error(`bad upstream auth ${seen[0]?.auth}`);

const audio = await call("/v1/audio/transcriptions", "p-token", "audio-bytes");
if (audio.status !== 200) throw new Error(`expected 200 audio, got ${audio.status}`);
if (seen[1]?.url !== "/v1/audio/transcriptions") throw new Error(`bad audio path ${seen[1]?.url}`);

const unknown = await call("/v1/models", "p-token");
if (unknown.status !== 404) throw new Error(`expected 404, got ${unknown.status}`);

console.log("proxy smoke test passed", seen);
upstream.close();
