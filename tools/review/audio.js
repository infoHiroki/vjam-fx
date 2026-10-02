// プレビューの音: 擬似の 120 BPM か、実際の曲から作った音の反応データ(tools/traces/*.json)を、エンジンの音声データの形にする

// 擬似の 120 BPM(tools/bench/site/harness.js と同じ式。ビートで低音が跳ねる)
export function pseudoLevels(t) {
  const env = Math.exp(-(t % 0.5) * 8);
  return { bpm: 120, strength: env, rms: 0.15 + 0.2 * env, bass: 0.3 + 0.7 * env,
    mid: 0.4 + 0.2 * Math.sin(t * 3), treble: 0.3 + 0.2 * Math.sin(t * 7) };
}

/**
 * traces/*.json を読める形にする。形が違えば null
 * { name, source, bpm, fps, frames: [[rms, bass, mid, treble, beat, strength], ...] }
 */
export function parseTrace(json, fallbackName) {
  if (!json || !Array.isArray(json.frames)) return null;
  const frames = json.frames.filter(f => Array.isArray(f) && f.length >= 6 && f.slice(0, 6).every(Number.isFinite));
  if (!frames.length) return null;
  return {
    name: typeof json.name === 'string' && json.name ? json.name : fallbackName,
    source: typeof json.source === 'string' ? json.source : '',
    bpm: Number.isFinite(json.bpm) && json.bpm > 0 ? json.bpm : 0,
    fps: Number.isFinite(json.fps) && json.fps > 0 ? json.fps : 30,
    frames,
  };
}

function traceLevels(trace, i) {
  const [rms, bass, mid, treble, , strength] = trace.frames[i];
  return { bpm: trace.bpm, strength, rms, bass, mid, treble };
}

/**
 * 音の時計。advance(秒) で進め、その時点の音声データ({ beat, bpm, strength, rms, bass, mid, treble })を返す
 * - trace は頭から fps で流し、終わったら頭に戻る
 * - beat は、前に進めたときから今までの間にビートを跨いだら true(間引いて読んでもビートを落とさない)
 */
export function createFeed(trace = null) {
  let t = 0;
  let last = -1; // 前に返した位置(擬似はビートの番号、trace はフレームの番号。通しで数える)
  return {
    get trace() { return trace; },
    get time() { return t; },
    advance(dt) {
      if (dt > 0) t += dt;
      if (!trace) {
        const k = Math.floor(t / 0.5);
        const beat = k !== last;
        last = k;
        return { beat, ...pseudoLevels(t) };
      }
      const n = trace.frames.length;
      const idx = Math.floor(t * trace.fps);
      let beat = false;
      // 一周以上飛んだら最後の一周だけ見る
      for (let j = Math.max(last + 1, idx - n + 1); j <= idx; j++) {
        if (trace.frames[j % n][4]) { beat = true; break; }
      }
      last = idx;
      return { beat, ...traceLevels(trace, idx % n) };
    },
  };
}

// エンジンに渡す。エンジンが読む(15Hz で読んで消す)前のビートは消さない
export function mergeUnread(prev, data) {
  return { ...data, beat: !!data.beat || !!(prev && prev.beat) };
}
