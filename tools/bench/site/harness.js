// 計測とライブプレビューで共通: エンジンに擬似音声(120 BPM)を流し、ページの白・暗 / blend / filter を切り替える
// content.js の後に読む。beat はエンジンが読むまで消さない
(() => {
  const e = window._vjamFxEngine;
  const H = window.__vjamBench = { mode: 'silent', beatT0: performance.now() };
  let lastBeat = -1;
  // 素の重さを見たいので、エンジンの「45fps を割ったら p5 を 30fps に落とす」は止める(無いエンジンでは何もしない)
  e._trackFps = () => {};
  setInterval(() => {
    const prev = e._externalAudioData;
    if (H.mode === 'silent') {
      e._externalAudioData = { beat: false, bpm: 120, strength: 0, rms: 0, bass: 0, mid: 0, treble: 0 };
      return;
    }
    const t = (performance.now() - H.beatT0) / 1000, k = Math.floor(t / 0.5), ph = t % 0.5;
    const beat = k !== lastBeat; if (beat) lastBeat = k;
    const env = Math.exp(-ph * 8);
    e._externalAudioData = { beat: beat || !!(prev && prev.beat), bpm: 120, strength: env, rms: 0.15 + 0.2 * env,
      bass: 0.3 + 0.7 * env, mid: 0.4 + 0.2 * Math.sin(t * 3), treble: 0.3 + 0.2 * Math.sin(t * 7) };
  }, 33);

  // 'silent' | 'music'。music に入った時刻をビートの基準にする
  H.setMode = (m) => {
    if (m === 'music' && H.mode !== 'music') { H.beatT0 = performance.now(); lastBeat = -1; }
    H.mode = m;
  };
  // 白ページでは既定の screen を difference で描く(エンジンと同じ)
  H.setTheme = (dark) => {
    document.body.classList.toggle('dark', !!dark);
    e.isLightPage = !dark;
    e.setBlendMode(e.blendMode);
  };
  H.setBlend = (mode) => e.setBlendMode(mode);
  // 複合フィルタも試すので、エンジンのトグルを通さず overlay に直接掛ける
  H.setFilter = (css) => { if (e.overlay) e.overlay.style.filter = css || 'none'; };
})();
