const t = await (await fetch("http://127.0.0.1:9234/json")).json();
const page = t.find(x => x.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const q = pend.get(m.id); pend.delete(m.id); m.error ? q.reject(m.error) : q.resolve(m.result); } };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async x => (await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true })).result?.value;
await ev(`window.__r = __TAURI_INTERNALS__.invoke('recognize_local').then(t=>'OK: '+t).catch(e=>'ERR: '+e)`);
await new Promise(r=>setTimeout(r,1500));
const t0 = Date.now();
await ev(`__TAURI_INTERNALS__.invoke('stop_listening')`);
let out = null;
for (let i=0;i<20;i++){ await new Promise(r=>setTimeout(r,300)); out = await ev(`window.__r`); if (out) break; }
console.log("stop->result", Date.now()-t0, "ms:", out);
ws.close();
