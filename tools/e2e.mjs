// End-to-end verification through the WebView2 DevTools protocol.
const CDP = "http://127.0.0.1:9222";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  const res = await fetch(`${CDP}/json`);
  return res.json();
}

async function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  return { ws, send };
}

async function evaluate(send, expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

const list = await targets();
const page = list.find((t) => t.type === "page") || list[0];
if (!page) throw new Error("no page target");

const { ws, send } = await connect(page.webSocketDebuggerUrl);
await send("Runtime.enable");

const fill = await evaluate(
  send,
  `(() => {
    const ta = document.querySelector('textarea');
    if (!ta) return 'no-textarea';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, '今天早饭12，打车25，中午请同事吃饭180，下午咖啡18');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return ta.value;
  })()`
);
console.log("filled:", fill);
await sleep(400);

const clicked = await evaluate(
  send,
  `(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('解析并记账'));
    if (!b) return 'no-button';
    if (b.disabled) return 'disabled';
    b.click();
    return 'clicked';
  })()`
);
console.log("click:", clicked);
await sleep(3000);

const state = await evaluate(
  send,
  `(() => ({
    total: document.querySelector('.total')?.textContent?.trim() || '',
    rows: document.querySelectorAll('.rows .row').length,
    notes: [...document.querySelectorAll('.row-note')].map((n) => n.textContent),
    amounts: [...document.querySelectorAll('.row-amount')].map((n) => n.textContent),
    toast: document.querySelector('.toast')?.textContent || '',
    title: document.title,
  }))()`
);
console.log("state:", JSON.stringify(state, null, 2));

const shot = await send("Page.captureScreenshot", { format: "png" });
const fs = await import("node:fs");
fs.writeFileSync("ui-verified.png", Buffer.from(shot.data, "base64"));
console.log("screenshot written");

ws.close();
