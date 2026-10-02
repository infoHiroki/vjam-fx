// iPhone シミュレータの Safari で:ページを開く → MSE タップを入れる → ミュート再生 → エンジンを入れて音の反応を見る(常にミュート)
// 拡張は入れない(シミュレータで拡張をオンにするには設定の画面操作が要るので)。タップは document_start ではなく後から入れる:
//   標準の HLS はそれで足りる。MediaSource 系は、ページ側が待てる www/mms.html?wait で試す
// usage: node tools/ios-sim/run.mjs <url> [seconds=20] [presets=neon-rain,sonar-ping]
//   先に bash scripts/build-safari-ext.sh(build/safari-ext を読む)
import { connect, openPage, startEngine, sleep } from './sim.mjs';
const [url, secs = '20', presetArg = 'neon-rain,sonar-ping'] = process.argv.slice(2);
const c = await connect();
const { ev } = c;

// 1. ページを開いて、タップを入れてミュート再生
await openPage(c, url);
// 2. エンジン
await startEngine(c, presetArg.split(','));
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
c.close();
