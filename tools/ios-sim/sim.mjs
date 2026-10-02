// run.mjs / fill.mjs の共通: シミュレータの Safari のページに ios_webkit_debug_proxy 経由でつなぎ、
// ページを開く → MSE タップを入れてミュート再生 → エンジンを入れる(拡張は入れない。常にミュート)
//   先に bash scripts/build-safari-ext.sh(build/safari-ext を読む)
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
const B = fileURLToPath(new URL('../../build/safari-ext', import.meta.url));
const PORT = process.env.SIMPORT || 9422;
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 一番新しいページにつなぐ。別のオリジンへ移るとターゲット(プロセス)が替わるので、替わった先を追う
export async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = list[list.length - 1];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let target = null, nextId = 1000; const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Target.targetCreated') target = msg.params.targetInfo.targetId;
    if (msg.method === 'Target.didCommitProvisionalTarget') target = msg.params.newTargetId;
    if (msg.method === 'Target.dispatchMessageFromTarget') {
      const inner = JSON.parse(msg.params.message);
      if (pending.has(inner.id)) { pending.get(inner.id)(inner); pending.delete(inner.id); }
    }
  };
  await new Promise(r => ws.onopen = r); while (!target) await sleep(50);
  const send = (method, params = {}, timeout = 30000) => new Promise((res, rej) => {
    const id = nextId++; const t = setTimeout(() => rej(new Error('timeout ' + method)), timeout);
    pending.set(id, (m) => { clearTimeout(t); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); });
    ws.send(JSON.stringify({ id: 1, method: 'Target.sendMessageToTarget', params: { targetId: target, message: JSON.stringify({ id, method, params }) } }));
  });
  // gesture: ユーザーの操作として評価する(webkitEnterFullscreen・音ありの play に要る)
  const ev = async (expr, gesture = false) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, emulateUserGesture: gesture });
    if (r.wasThrown) throw new Error(JSON.stringify(r.result).slice(0, 300)); return r.result.value; };
  return { send, ev, close: () => ws.close() };
}

// url を開き直して、タップを入れてミュート再生(mms.html?wait は __go() まで hls.js を待つ)
export async function openPage({ send, ev }, url) {
  const tap = readFileSync(`${B}/content/mse-tap.js`, 'utf8');
  const mute = `;(function(){const P=HTMLMediaElement.prototype;const op=P.play;P.play=function(){this.muted=true;this.volume=0;return op.apply(this,arguments)};})();`;
  // 別のオリジンへ移るとターゲット(プロセス)が替わって仕込みが消えるので、先に移ってから仕込んで再読み込み
  const here = await ev('location.href').catch(() => '');
  if (here !== url) { await ev(`location.href = ${JSON.stringify(url)}; 'nav'`).catch(() => {}); await sleep(5000); }
  await send('Page.reload', {}).catch(() => {});
  await sleep(6000);
  // リモートの inspector では Page.setBootstrapScript が効かなかったので、読み込み後に入れる
  if (!(await ev('!!window.__vjamMse').catch(() => false))) await ev(mute + tap + `\n;'tap'`);
  await ev(`window.__go && window.__go(); 'go'`).catch(() => {});
  await sleep(3000);
  console.log('tap present:', await ev(`!!window.__vjamMse`).catch(e => 'err ' + e.message));
  console.log('play:', await ev(`(() => { const v = document.querySelector('video'); if (!v) return 'no video'; v.muted = true; v.play().catch(()=>{}); return 'ok ' + (v.currentSrc||'').slice(0,60); })()`, true));
  await sleep(4000);
}

// エンジンとプリセットを入れて、レイヤーを足す
export async function startEngine({ ev }, presets) {
  const core = 'window.VJamFX = window.VJamFX || { presets: {} };\n' + readFileSync(`${B}/lib/p5.min.js`, 'utf8') + '\n' +
    readFileSync(`${B}/content/base-preset.js`, 'utf8') + '\n' + readFileSync(`${B}/content/content.js`, 'utf8') + '\n' +
    presets.map(n => readFileSync(`${B}/content/presets/${n}.js`, 'utf8')).join('\n') + `\n;'core'`;
  console.log('inject:', await ev(core).catch(e => 'ERR ' + e.message));
  console.log('start:', await ev(`(() => { const e = window._vjamFxEngine; for (const n of ${JSON.stringify(presets)}) e.handleMessage({ action: 'addLayer', preset: n }); return e.getActiveLayerNames(); })()`));
}
