// ライブプレビュー: iframe の記事ページに p5 → base-preset → プリセット → エンジンを読み込んで動かす(review.html はリポのルートから配信する前提)
// 音はこの画面から 33ms ごとにエンジンへ渡す(擬似 120 BPM / traces)
import { createFeed, mergeUnread } from './audio.js';

const PAGE = 'bench/site/article.html';
const PRESET_DIR = { fx: '../content/presets/', candidates: 'bench/candidates/' };
const BASE = ['../lib/p5.min.js', '../content/base-preset.js'];
const ENGINE = '../content/content.js';
const BATCH = 20; // プリセットの読み込みを何本ずつ並べるか(popup の _injectAllPresets と同じ)
const FADE_AUTO = 1.5; // Auto で見るときのフェード(製品の既定)
const url = p => new URL(p, location.href).href;

function addScript(doc, src) {
  return new Promise((res, rej) => {
    const s = doc.createElement('script');
    s.src = url(src);
    s.onload = res;
    s.onerror = () => rej(new Error('読めない: ' + src));
    doc.head.appendChild(s);
  });
}

export function createStage(frame) {
  let token = 0;
  let loaded = ''; // 今読み込んでいるもの(同じなら読み込み直さない)
  let paused = false;
  let auto = null; // Auto で見ている間の startAutoCycle の中身
  let errors = [];
  let feed = createFeed();
  let lastTick = performance.now();

  const win = () => frame.contentWindow;
  const engine = () => { try { return win() && win()._vjamFxEngine; } catch (e) { return null; } };

  // 音: 一時停止中は時計を止めて何も渡さない
  setInterval(() => {
    const now = performance.now(), dt = (now - lastTick) / 1000;
    lastTick = now;
    const e = engine();
    if (!e || paused || !e.active) return;
    e._externalAudioData = mergeUnread(e._externalAudioData, feed.advance(dt));
  }, 33);

  function loadFrame() {
    return new Promise((res) => {
      frame.addEventListener('load', res, { once: true });
      frame.src = url(PAGE) + '?t=' + Date.now();
    });
  }

  /** 記事ページを読み直して presets([{ key, source }])とエンジンを読み込む。後から呼ばれたら false */
  async function load(presets) {
    const my = ++token;
    paused = false;
    errors = [];
    loaded = '';
    await loadFrame();
    if (my !== token) return false;
    const w = win(), doc = w.document;
    w.addEventListener('error', ev => { errors.push(String(ev.message || ev.error || 'error')); });
    for (const src of BASE) {
      await addScript(doc, src);
      if (my !== token) return false;
    }
    for (let i = 0; i < presets.length; i += BATCH) {
      await Promise.all(presets.slice(i, i + BATCH).map(p =>
        addScript(doc, PRESET_DIR[p.source] + p.key + '.js').catch(err => { errors.push(err.message); })));
      if (my !== token) return false;
    }
    await addScript(doc, ENGINE);
    if (my !== token) return false;
    // 素の重さを見たいので「45fps を割ったら 30fps に落とす」は止める(計測の harness.js と同じ)
    w._vjamFxEngine._trackFps = () => {};
    return true;
  }

  function setTheme(e, dark) {
    win().document.body.classList.toggle('dark', !!dark);
    e.isLightPage = !dark;
    e.setBlendMode(e.blendMode); // 白ページの screen は difference で描く(エンジンと同じ)
  }

  /** 白・暗 / blend / filter。Auto で見ている間の blend / filter はエンジンの Rnd に任せる */
  function apply({ theme, blend, filter }) {
    const e = engine();
    if (!e || !win().document.body) return; // 読み直しの途中
    setTheme(e, theme === 'dark');
    if (auto) return;
    e.setBlendMode(blend);
    // 複合フィルタも試すので、エンジンのトグルを通さず overlay に直接掛ける
    if (e.overlay) e.overlay.style.filter = filter || 'none';
  }

  /** presets を重ねて動かす(1 本ならそれだけ)。同じものを読み込み済みなら切り替えだけ */
  async function show(presets, opts) {
    const key = 'show:' + presets.map(p => p.source + '/' + p.key).join(',');
    if (key === loaded && !auto && engine()) {
      apply(opts);
      return true;
    }
    auto = null;
    if (!(await load(presets))) return false;
    const e = engine();
    e._fadeDuration = 0;
    win().document.body.classList.toggle('dark', opts.theme === 'dark');
    e.startPreset(presets[0].key);
    for (const p of presets.slice(1)) e.handleMessage({ action: 'addLayer', preset: p.key });
    loaded = key;
    apply(opts);
    if (paused) setPaused(true); // 読み込み中に一時停止を押されたとき
    return true;
  }

  /** 製品の Auto ON と同じ: プールのプリセットを 1〜3 枚重ねて拍で切り替え、blend / filter もプールから回す */
  async function startAuto(presets, pool, opts) {
    auto = { action: 'startAutoCycle', presets: presets.map(p => p.key), interval: 8000,
      autoBlend: true, autoFilters: true, barsPerCycle: 16, locks: {}, pool };
    const mine = auto;
    if (!(await load(presets)) || auto !== mine) return false;
    const e = engine();
    e._fadeDuration = FADE_AUTO;
    win().document.body.classList.toggle('dark', opts.theme === 'dark');
    e.startPreset(auto.presets[Math.floor(Math.random() * auto.presets.length)]);
    apply(opts);
    e.handleMessage(auto);
    loaded = 'auto';
    if (paused) setPaused(true);
    return true;
  }

  function setPaused(p) {
    const e = engine();
    paused = !!p;
    if (!e) return;
    for (const [, layer] of e.activeLayers) {
      const q = layer.preset && layer.preset.p5;
      if (q) paused ? q.noLoop() : q.loop();
    }
    if (auto) {
      // 止めている間に切り替わらないように。再開は今のレイヤーのまま、次の切り替えから
      if (paused) e.handleMessage({ action: 'stopAutoCycle' });
      else e.handleMessage({ ...auto, skipFirstTick: true });
    }
  }

  /** 音を切り替える(頭から流す) */
  function setAudio(trace) {
    feed = createFeed(trace);
  }

  /** 今の様子(Auto のレイヤー・blend・filter、読み込めなかったもの) */
  function status() {
    const e = engine();
    if (!e) return null;
    return {
      layers: [...e.activeLayers.keys()],
      blend: e.blendMode,
      drawnBlend: e.overlay ? e.overlay.style.mixBlendMode : e.blendMode, // 白ページの screen は difference
      filter: e.overlay ? e.overlay.style.filter || 'none' : 'none',
      errors: errors.slice(),
    };
  }

  function stop() {
    token++;
    auto = null;
    loaded = '';
    frame.src = 'about:blank';
  }

  return { show, startAuto, apply, setPaused, setAudio, status, stop,
    get paused() { return paused; }, get auto() { return !!auto; } };
}
