// iPhone シミュレータの Safari で:ページを開く → MSE タップを入れる → ミュート再生 → エンジン無しで待つ → エンジンを入れて音の反応を見る(常にミュート)
// 拡張は入れない(シミュレータで拡張をオンにするには設定の画面操作が要るので)。タップは document_start ではなく後から入れる:
//   標準の HLS はそれで足りる。MediaSource 系は、ページ側が待てる www/mms.html?wait で試す
// usage: [WAIT=10] node tools/ios-sim/run.mjs <url> [seconds=20] [presets=neon-rain,sonar-ping]
//   WAIT 秒はエンジンを入れずに待つ(frameAt を呼ばない。タップはデコードしないので decoded は 0 のまま、MediaSource なら held が増える)
//   エンジンを入れてから、デコードが始まる・音が取れる・BPM のグリッドが出るまでの秒数を出す
//   先に bash scripts/build-safari-ext.sh(build/safari-ext を読む)
import { connect, openPage, startEngine, sleep } from './sim.mjs';
const [url, secs = '20', presetArg = 'neon-rain,sonar-ping'] = process.argv.slice(2);
const wait = +(process.env.WAIT || 10);
const c = await connect();
const { ev } = c;

// タップの数を読むだけ(frameAt は呼ばない)
const tapStats = `(() => { const s = window.__vjamMse && window.__vjamMse.stats, v = document.querySelector('video');
  return s && { t: v && +v.currentTime.toFixed(1), appends: s.appends, segments: s.segments, held: s.held, decoded: s.decoded,
    hls: s.hlsSegments, mode: s.mode, bpm: Math.round(s.bpm || 0), err: s.lastErr }; })()`;

// 1. ページを開いて、タップを入れてミュート再生
await openPage(c, url);
// 2. エンジン無しで待つ
for (let i = 0; i < wait / 2; i++) {
  await sleep(2000);
  console.log('wait', JSON.stringify(await ev(tapStats).catch(e => 'err ' + e.message)));
}
// 3. エンジン。入れてから decoded が増える・音が取れる(mode が付く)・グリッドの BPM が出るまでを計る
await startEngine(c, presetArg.split(','));
const t0 = Date.now(), at = {};
while (Date.now() - t0 < 30000 && !at.grid) {
  const s = await ev(tapStats).catch(() => null);
  const sec = +((Date.now() - t0) / 1000).toFixed(1);
  if (s && s.decoded > 0 && at.decoded === undefined) at.decoded = sec;
  if (s && s.mode && at.frames === undefined) at.frames = sec;
  if (s && s.mode === 'grid') { at.grid = sec; at.bpm = s.bpm; }
  await sleep(200);
}
console.log('since engine start (s):', JSON.stringify(at));
// 4. 見る
for (let i = 0; i < +secs / 4; i++) {
  await sleep(4000);
  console.log(await ev(`JSON.stringify((() => { const s = window.__vjamMse, v = document.querySelector('video'), e = window._vjamFxEngine;
    return { t: v && +v.currentTime.toFixed(1), paused: v && v.paused, src: v && (v.currentSrc||'').slice(0,30),
      tap: s && { decoded: s.stats.decoded, held: s.stats.held, hls: s.stats.hlsSegments, mode: s.stats.mode, bpm: Math.round(s.stats.bpm||0), err: s.stats.lastErr },
      frame: s && v && (() => { const f = s.frameAt(v.currentTime); return f && { rms: +f.rms.toFixed(3), bass: +f.bass.toFixed(2), beat: f.beat }; })(),
      layers: e && e.getActiveLayerNames(), canvases: e && (e.overlay.shadowRoot || e.overlay).querySelectorAll('canvas').length };
  })())`).catch(e => 'err ' + e.message));
}
c.close();
