import fs from "node:fs";
const t = await (await fetch("http://127.0.0.1:9227/json")).json();
const page = t.find(x => x.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const q = pend.get(m.id); pend.delete(m.id); m.error ? q.reject(m.error) : q.resolve(m.result); } };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async x => (await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true })).result?.value;
await new Promise(r => setTimeout(r, 1500));
console.log("status:", JSON.stringify(await ev(`__TAURI_INTERNALS__.invoke('whisper_status')`)));
console.log("hint:", await ev(`document.querySelector('.hint')?.textContent`));
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 4000));
  const st = await ev(`__TAURI_INTERNALS__.invoke('whisper_status')`);
  console.log(i, JSON.stringify(st));
  if (st.model_present) break;
}
const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync("whisper-download.png", Buffer.from(shot.data, "base64"));
ws.close();
