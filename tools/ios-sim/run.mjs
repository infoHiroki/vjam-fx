// iPhone シミュレータの Safari で:ページを開く → MSE タップを入れる → ミュート再生 → エンジンを入れて音の反応を見る(常にミュート)
// 拡張は入れない(シミュレータで拡張をオンにするには設定の画面操作が要るので)。タップは document_start ではなく後から入れる:
//   標準の HLS はそれで足りる。MediaSource 系は、ページ側が待てる www/mms.html?wait で試す
// usage: node tools/ios-sim/run.mjs <url> [seconds=20] [presets=neon-rain,sonar-ping]
//   先に bash scripts/build-safari-ext.sh(build/safari-ext を読む)
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
const [url, secs = '20', presetArg = 'neon-rain,sonar-ping'] = process.argv.slice(2);
const B = fileURLToPath(new URL('../../build/safari-ext', import.meta.url));
const PORT = process.env.SIMPORT || 9422;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
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
const ev = async (expr, gesture = false) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, emulateUserGesture: gesture });
  if (r.wasThrown) throw new Error(JSON.stringify(r.result).slice(0, 300)); return r.result.value; };

// 1. タップを document_start に(拡張の content_scripts と同じ位置)
const tap = readFileSync(`${B}/content/mse-tap.js`, 'utf8');
const mute = `;(function(){const P=HTMLMediaElement.prototype;const op=P.play;P.play=function(){this.muted=true;this.volume=0;return op.apply(this,arguments)};})();`;
// 別のオリジンへ移るとターゲット(プロセス)が替わって仕込みが消えるので、先に移ってから仕込んで再読み込み
const here = await ev('location.href').catch(() => '');
if (here !== url) { await ev(`location.href = ${JSON.stringify(url)}; 'nav'`).catch(() => {}); await sleep(5000); }
await send('Page.reload', {}).catch(() => {});
await sleep(6000);
// リモートの inspector では Page.setBootstrapScript が効かなかったので、読み込み後に入れる。mms.html?wait は __go() まで hls.js を待つ
if (!(await ev('!!window.__vjamMse').catch(() => false))) await ev(mute + tap + `\n;'tap'`);
await ev(`window.__go && window.__go(); 'go'`).catch(() => {});
await sleep(3000);
console.log('tap present:', await ev(`!!window.__vjamMse`).catch(e => 'err ' + e.message));
console.log('play:', await ev(`(() => { const v = document.querySelector('video'); if (!v) return 'no video'; v.muted = true; v.play().catch(()=>{}); return 'ok ' + (v.currentSrc||'').slice(0,60); })()`, true));
await sleep(4000);
// 2. エンジン
const core = 'window.VJamFX = window.VJamFX || { presets: {} };\n' + readFileSync(`${B}/lib/p5.min.js`, 'utf8') + '\n' +
  readFileSync(`${B}/content/base-preset.js`, 'utf8') + '\n' + readFileSync(`${B}/content/content.js`, 'utf8') + '\n' +
  presetArg.split(',').map(n => readFileSync(`${B}/content/presets/${n}.js`, 'utf8')).join('\n') + `\n;'core'`;
console.log('inject:', await ev(core).catch(e => 'ERR ' + e.message));
console.log('start:', await ev(`(() => { const e = window._vjamFxEngine; for (const n of ${JSON.stringify(presetArg.split(','))}) e.handleMessage({ action: 'addLayer', preset: n }); return e.getActiveLayerNames(); })()`));
// 3. 見る
for (let i = 0; i < +secs / 4; i++) {
  await sleep(4000);
  console.log(await ev(`JSON.stringify((() => { const s = window.__vjamMse, v = document.querySelector('video'), e = window._vjamFxEngine;
    const ad = e && e._lastAudioData || e && e.audioData;
    return { t: v && +v.currentTime.toFixed(1), paused: v && v.paused, src: v && (v.currentSrc||'').slice(0,30),
      tap: s && { decoded: s.stats.decoded, hls: s.stats.hlsSegments, mode: s.stats.mode, bpm: Math.round(s.stats.bpm||0), err: s.stats.errors },
      frame: s && v && (() => { const f = s.frameAt(v.currentTime); return f && { rms: +f.rms.toFixed(3), bass: +f.bass.toFixed(2), beat: f.beat }; })(),
      layers: e && e.getActiveLayerNames(), canvases: e && (e.overlay.shadowRoot || e.overlay).querySelectorAll('canvas').length };
  })())`).catch(e => 'err ' + e.message));
}
ws.close();
