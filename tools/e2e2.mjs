// Second pass: export safety, edit, delete, glass toggle.
const t = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = t.find((x) => x.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(m.error) : p.resolve(m.result);
  }
};
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
const evalx = async (expr) =>
  (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }))
    .result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const exported = await evalx(
  `window.__TAURI_INTERNALS__.invoke('export_json').then(s => ({ len: s.length, hasKey: s.includes('test-key'), count: JSON.parse(s).expenses.length })).catch(e => ({ err: String(e) }))`
);
console.log("export:", JSON.stringify(exported));

// edit first row amount 18 -> 20
await evalx(`document.querySelector('.row .icon-btn').click()`);
await sleep(350);
await evalx(`(() => {
  const inp = document.querySelector('.modal input[inputmode="decimal"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, '20');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return inp.value;
})()`);
await sleep(200);
await evalx(`[...document.querySelectorAll('.modal-actions button')].find(b => b.textContent.trim() === '保存').click()`);
await sleep(900);
console.log("after edit:", await evalx(`document.querySelector('.total').textContent.trim()`));

// delete first row (confirm auto-accepted)
await evalx(`window.confirm = () => true`);
await evalx(`document.querySelector('.row .icon-btn.danger').click()`);
await sleep(900);
console.log("after delete:", await evalx(`JSON.stringify({ total: document.querySelector('.total').textContent.trim(), rows: document.querySelectorAll('.rows .row').length })`));

// glass toggle
const glassOn = await evalx(`document.documentElement.dataset.glass`);
await evalx(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('毛玻璃')).click()`);
await sleep(500);
const glassOff = await evalx(
  `JSON.stringify({ flag: document.documentElement.dataset.glass, blur: getComputedStyle(document.querySelector('.glass')).backdropFilter })`
);
console.log("glass:", glassOn, "->", glassOff);
await evalx(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('毛玻璃')).click()`);
await sleep(500);

const shot = await send("Page.captureScreenshot", { format: "png" });
const fs = await import("node:fs");
fs.writeFileSync("ui-after-edit.png", Buffer.from(shot.data, "base64"));
console.log("done");
ws.close();
