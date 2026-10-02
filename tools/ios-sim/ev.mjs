// シミュレータの Safari の表示中タブで JS を評価する
// usage: node ev.mjs '<expr>' [gesture=0] [timeoutMs]   (stdin で式を渡すときは '-')
import { readFileSync } from 'fs';
const PORT = process.env.SIMPORT || 9422;
let [expr, gesture = '0', to = '30000'] = process.argv.slice(2);
if (expr === '-') expr = readFileSync(0, 'utf8');
async function evalOn(wsUrl, expr, timeoutMs, gesture) {
  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, timeoutMs);
    let sent = false;
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Target.targetCreated' && !sent) {
        sent = true;
        ws.send(JSON.stringify({ id: 1, method: 'Target.sendMessageToTarget', params: { targetId: msg.params.targetInfo.targetId,
          message: JSON.stringify({ id: 100, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, emulateUserGesture: gesture } }) } }));
      } else if (msg.method === 'Target.dispatchMessageFromTarget') {
        const inner = JSON.parse(msg.params.message);
        if (inner.id !== 100) return;
        clearTimeout(timer); ws.close();
        if (inner.error) reject(new Error(JSON.stringify(inner.error)));
        else if (inner.result.wasThrown) reject(new Error(JSON.stringify(inner.result.result).slice(0, 400)));
        else resolve(inner.result.result.value);
      }
    };
    ws.onerror = (e) => { clearTimeout(timer); reject(new Error('ws ' + e.message)); };
  });
}
const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
let out = null;
for (const p of list) {
  const v = await evalOn(p.webSocketDebuggerUrl, 'document.visibilityState', 4000, false).catch(() => null);
  if (v === 'visible') { out = await evalOn(p.webSocketDebuggerUrl, expr, +to, gesture === '1'); break; }
}
console.log(typeof out === 'string' ? out : JSON.stringify(out));
