// ライブプレビュー: iframe の記事ページに p5 → base-preset → プリセット → エンジン → harness を順に読み込んで動かす
// (計測の bench_fx.py と同じ組み立て。curate.html はリポのルートから配信する前提)

const PAGE = 'bench/site/article.html';
const PRESET_DIR = { fx: '../content/presets/', candidates: 'bench/candidates/' };
const url = p => new URL(p, location.href).href;

let token = 0;

function loadFrame(frame) {
  return new Promise((res) => {
    frame.addEventListener('load', res, { once: true });
    frame.src = url(PAGE) + '?t=' + Date.now();
  });
}

function addScript(doc, src) {
  return new Promise((res, rej) => {
    const s = doc.createElement('script');
    s.src = url(src);
    s.onload = res;
    s.onerror = () => rej(new Error('読めない: ' + src));
    doc.head.appendChild(s);
  });
}

function harness(frame) {
  return frame.contentWindow && frame.contentWindow.__vjamBench;
}

/** プリセットを読み込み直して動かす。後から呼ばれたら前の読み込みは捨てる */
export async function startPreview(frame, { name, source }, opts) {
  const my = ++token;
  await loadFrame(frame);
  if (my !== token) return false;
  const w = frame.contentWindow, doc = w.document;
  const srcs = ['../lib/p5.min.js', '../content/base-preset.js', PRESET_DIR[source] + name + '.js', '../content/content.js', 'bench/site/harness.js'];
  for (const src of srcs) {
    await addScript(doc, src);
    if (my !== token) return false;
  }
  const e = w._vjamFxEngine;
  e._fadeDuration = 0;
  e.startPreset(name);
  applyPreview(frame, opts);
  return true;
}

/** 白・暗 / blend / filter / 音を切り替える(読み込み直さない) */
export function applyPreview(frame, { theme, blend, filter, music }) {
  const H = harness(frame);
  if (!H) return;
  H.setTheme(theme === 'dark');
  H.setBlend(blend);
  H.setFilter(filter);
  H.setMode(music ? 'music' : 'silent');
}

export function stopPreview(frame) {
  token++;
  frame.src = 'about:blank';
}
