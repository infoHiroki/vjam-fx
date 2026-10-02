/**
 * e2e 用の道具:テスト用サイト、拡張のテスト用コピー、擬似音声、スクショ差分、popup の開き方
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(__dirname, '../..');
const EXT_ENTRIES = ['manifest.json', 'background', 'content', 'popup', 'offscreen', 'lib', 'icons'];

// --- 擬似音声:120 BPM のキック(16bit mono wav) ---

export function makeKickWav({ bpm = 120, seconds = 8, rate = 22050 } = {}) {
  const n = rate * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  const beat = 60 / bpm;
  const F0 = 120, F1 = 45, SWEEP = 30;
  for (let i = 0; i < n; i++) {
    const t = (i / rate) % beat;
    // 120Hz → 45Hz に落ちるサイン + 指数減衰(拍の間はほぼ無音)
    const phase = 2 * Math.PI * (F1 * t + (F0 - F1) * (1 - Math.exp(-SWEEP * t)) / SWEEP);
    const s = Math.sin(phase) * Math.exp(-12 * t) * 0.9;
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

// --- テスト用サイト(空きポートで立てる) ---

function html(title, style, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{${style}font:16px sans-serif;margin:40px}</style></head>
<body>${body}
<audio id="a" src="beat.wav" loop autoplay controls></audio>
<script>document.getElementById('a').play().catch(e => console.log('play fail', e))</script></body></html>`;
}

const PAGES = {
  '/index.html': html('VJam FX Test (dark)', 'background:#111;color:#ddd;',
    '<h1>VJam FX test page</h1><p>Dark page with an audio element playing 120 BPM kicks.</p>'),
  '/page2.html': html('VJam FX Test (light)', 'background:#fff;color:#222;',
    '<h1>Page 2 (light)</h1><p>Light page for navigation restore + light-page detection.</p>'),
  '/page3.html': html('VJam FX Test (no bg)', '',
    '<h1>Page 3 (no background set)</h1><p>Like most sites: body/html transparent, browser default white.</p>'),
  // 動画サイトの「フルサイズ」表示と同じ CSS:プレイヤー以外の要素を全部 x = -100000 へ飛ばす(#26)
  '/fullsize.html': html('VJam FX Test (full-size player)', 'background:#111;color:#ddd;',
    `<style>body[data-mgp-smm] :not(div[data-smm-container], div[data-smm-container] *) {
  position: fixed !important; right: 100000px !important; left: unset !important;
  bottom: unset !important; z-index: 0 !important; }</style>
<div data-smm-container style="width:640px;height:360px;background:#246;color:#fff"><h1>player</h1></div>
<h1 id="flung">Flung off-screen by the site CSS</h1>
<script>document.body.setAttribute('data-mgp-smm', '')</script>`),
  // CSP が厳しいページ(CSP は下の CSP_PAGES)。インラインの <style> / <script> は止まるので書かない
  '/csp.html': `<!doctype html><html><head><meta charset="utf-8"><title>VJam FX Test (strict CSP)</title></head>
<body><h1>Strict CSP page</h1><p>style-src 'self': inline &lt;style&gt; is blocked, CSSOM is not.</p>
<audio id="a" src="beat.wav" loop autoplay controls></audio></body></html>`,
};

const CSP_PAGES = {
  '/csp.html': "default-src 'self'; style-src 'self'",
};

export async function startSite() {
  const wav = makeKickWav();
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/beat.wav') {
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': wav.length });
      res.end(wav);
    } else if (PAGES[url]) {
      const headers = { 'Content-Type': 'text/html; charset=utf-8' };
      if (CSP_PAGES[url]) headers['Content-Security-Policy'] = CSP_PAGES[url];
      res.writeHead(200, headers);
      res.end(PAGES[url]);
    } else if (url === '/favicon.ico') {
      res.writeHead(204);
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// --- 拡張を読み込んだ Chromium ---

// activeTab はテストでは付与できないので、host_permissions を足したコピーを読み込む(本番の manifest は変えない)。
// files: コピーの中で差し替えるファイル({ 'content/default-pool.json': '...' } のように拡張のルートからの相対パス → 中身)
function makeExtensionCopy(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vjam-fx-ext-'));
  for (const entry of EXT_ENTRIES) {
    fs.cpSync(path.join(ROOT, entry), path.join(dir, entry), { recursive: true });
  }
  for (const [rel, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, rel), body);
  }
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.host_permissions = ['<all_urls>'];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return dir;
}

// 公式の Chrome(137 以降)は --load-extension を無視するので、Playwright の Chromium を使う
export async function launchWithExtension({ headless = true, files } = {}) {
  const extDir = makeExtensionCopy(files);
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${extDir}`,
      `--load-extension=${extDir}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return {
    context,
    sw,
    extId: new URL(sw.url()).host,
    close: async () => {
      await context.close();
      fs.rmSync(extDir, { recursive: true, force: true });
    },
  };
}

// popup は別の popup ウィンドウで開く(対象タブをアクティブのままにして rAF を止めない)。
// about:blank で開いてから init script で chrome.tabs.query を対象タブに向け、popup.html に移動する。
// init() はエンジンの状態を読んでからボタンにイベントを付けるので、付け終わるまで待ってから返す。
// tab: 対象タブの代わりにこのタブを返す({ id, url })。chrome:// などは拡張から URL が見えないので、重ねられないページはこれで開く
// (イベントを付けないページなので、読み込みだけ待つ)
export async function openPopup(ext, base, { tab } = {}) {
  const [popup] = await Promise.all([
    ext.context.waitForEvent('page'),
    ext.sw.evaluate(() => chrome.windows.create({ url: 'about:blank', type: 'popup', width: 320, height: 760 })),
  ]);
  await popup.addInitScript(({ target, fakeTab }) => {
    if (typeof chrome === 'undefined' || !chrome.tabs || location.protocol !== 'chrome-extension:') return;
    const query = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = (opts, cb) => {
      let r;
      if (opts && opts.active && opts.currentWindow) {
        r = fakeTab ? Promise.resolve([fakeTab]) : query({}).then((tabs) => tabs.filter((t) => t.url && t.url.startsWith(target)));
      } else {
        r = query(opts);
      }
      return cb ? r.then(cb) : r;
    };
    // _bindEvents() は同期で全部付けるので、#btn-reset に click が付いたら準備完了
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, ...rest) {
      if (type === 'click' && this.id === 'btn-reset') window.__vjPopupReady = true;
      return add.call(this, type, ...rest);
    };
  }, { target: base, fakeTab: tab || null });
  await popup.goto(`chrome-extension://${ext.extId}/popup/popup.html`);
  if (!tab) await popup.waitForFunction(() => window.__vjPopupReady === true);
  return popup;
}

// 手動(Effect・Filters・Blend・Scenes・Text・Reset・Audio)を開く。開いているかは覚えているので、閉じているときだけ押す
export async function openManual(popup) {
  const section = popup.locator('#manual-section');
  if (!(await section.isVisible())) await popup.click('#btn-manual');
  await section.waitFor({ state: 'visible' });
}

// --- ページ内のエンジンを覗く ---

export function readState(page) {
  return page.evaluate(() => {
    const e = window._vjamFxEngine;
    if (!e) return { engine: false, layers: [], filters: [] };
    return {
      engine: true,
      active: e.active,
      blend: e.blendMode,
      opacity: e.opacity,
      layers: [...e.activeLayers.keys()],
      filters: [...e.activeFilters],
      analyser: !!e._videoAudioAnalyser,
      overlay: !!(e.overlay && document.contains(e.overlay)),
      // 中身は overlay の shadow root の中(ホストの light DOM は空)
      shadow: !!(e.overlay && e.overlay.shadowRoot),
      lightChildren: e.overlay ? e.overlay.children.length : 0,
      canvases: e.overlay && e.overlay.shadowRoot ? e.overlay.shadowRoot.querySelectorAll('canvas').length : 0,
      isLight: e.isLightPage,
      overlayFilter: e.overlay ? e.overlay.style.filter : null,
      overlayBlend: e.overlay ? e.overlay.style.mixBlendMode : null,
    };
  });
}

// エンジンの Auto / Rnd の状態
export function readAuto(page) {
  return page.evaluate(() => {
    const e = window._vjamFxEngine;
    if (!e) return { engine: false };
    return {
      engine: true,
      cycling: !!e._autoCycleTimer,
      presets: e._autoCyclePresets ? e._autoCyclePresets.length : 0,
      pool: !!(e._autoCyclePool && e._autoCyclePool.filters && e._autoCyclePool.blends),
      blend: !!e._autoBlend,
      filters: !!e._autoFilters,
      fx: !!e._autoFXTimer,
    };
  });
}

// shadow root の中の、表示されているキャンバス(createGraphics の裏バッファは display: none)の位置と見え方
export function readCanvases(page) {
  return page.evaluate(() => {
    const e = window._vjamFxEngine;
    const root = e && e.overlay && e.overlay.shadowRoot;
    if (!root) return [];
    return [...root.querySelectorAll('canvas')]
      .filter((c) => getComputedStyle(c).display !== 'none')
      .map((c) => {
        const r = c.getBoundingClientRect();
        const cs = getComputedStyle(c);
        return {
          left: r.left, top: r.top, right: r.right, bottom: r.bottom,
          visibility: cs.visibility, blend: cs.mixBlendMode,
        };
      });
  });
}

// レイヤーのフェードイン(既定 1.5 秒)が終わるまで待つ
export function waitLayersFadedIn(page) {
  return page.waitForFunction(() => {
    const e = window._vjamFxEngine;
    const layers = e && e.overlay && e.overlay.shadowRoot
      ? [...e.overlay.shadowRoot.querySelectorAll('[data-vjam-layer]')] : [];
    return layers.length > 0 && layers.every((el) => getComputedStyle(el).opacity === '1');
  });
}

// _readVideoAudioData を包んで、フレーム数・拍数・最大 RMS を window.__vj に貯める
export function tapAudio(page) {
  return page.evaluate(() => {
    const e = window._vjamFxEngine;
    if (!e || e.__tapped) return;
    e.__tapped = true;
    window.__vj = { beats: 0, frames: 0, maxRms: 0, bpm: 0 };
    const orig = e._readVideoAudioData.bind(e);
    e._readVideoAudioData = function () {
      const d = orig();
      if (d) {
        const s = window.__vj;
        s.frames++;
        if (d.beat) s.beats++;
        s.maxRms = Math.max(s.maxRms, d.rms);
        s.bpm = d.bpm;
      }
      return d;
    };
  });
}

export function isAudioPlaying(page) {
  return page.evaluate(() => {
    const a = document.getElementById('a');
    return !a.paused && a.currentTime > 0;
  });
}

// --- スクショ差分(PNG を zlib で読む。8bit RGB/RGBA・非インターレースのみ) ---

function decodePng(buf) {
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported PNG (bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace})`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0;
      const b = y > 0 ? px[dst - stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[dst + x] = v & 255;
    }
  }
  return { width, height, bpp, px };
}

// RGB の差の平均(0〜255)
export function diffScore(pngA, pngB) {
  const a = decodePng(pngA), b = decodePng(pngB);
  if (a.width !== b.width || a.height !== b.height) throw new Error('screenshot size mismatch');
  let sum = 0;
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    const ia = i * a.bpp, ib = i * b.bpp;
    sum += Math.abs(a.px[ia] - b.px[ib]) + Math.abs(a.px[ia + 1] - b.px[ib + 1]) + Math.abs(a.px[ia + 2] - b.px[ib + 2]);
  }
  return sum / (n * 3);
}
