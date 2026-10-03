/**
 * Chrome ウェブストアのスクショ(store/screenshots/、1280×800)とプロモーション画像(store/promo-*.png)を撮る(#63)
 *   npx playwright test -c tests/e2e/store-screenshots.config.js
 * - 撮るのは自前の撮影ページ(store/appstore/demo/)だけ。Chrome は <audio> の m4a で音が取れるので、Safari 用の HLS は止めて m4a で流す
 * - Auto が引くものは撮影ページで見栄えのするものに絞る(拡張のコピーの default-pool.json だけ差し替え。本物は変えない)
 * - popup は別ウィンドウで開いて撮り、ページの右上に重ねる(Chrome の popup と同じく高さは 600px まで)
 * - プロモーション画像の背景は、黒いページに手動で決めた 2 枚(PROMO_PRESETS)
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { launchWithExtension, openPopup, openManual, readState, waitLayersFadedIn } from './helpers.js';

const ROOT = path.resolve(__dirname, '../..');
const DEMO = path.join(ROOT, 'store/appstore/demo');
const STORE = path.join(ROOT, 'store');
const SHOTS = path.join(STORE, 'screenshots');

const W = 1280, H = 800;
const POPUP_W = 280, POPUP_MAX_H = 600;
const PROMOS = [['small', 440, 280], ['marquee', 1400, 560]]; // store/promo-<名前>.png

// 止めた絵でも色が出るもの。どれも本物のデフォルトプールにある(WebGL は入れない)
const PRESETS = ['neon-tunnel', 'kaleidoscope', 'radial-burst', 'pulse-ring', 'synth-wave', 'fireflies', 'neon-frame'];
const PROMO_PRESETS = ['neon-tunnel', 'pulse-ring'];

const TYPES = { '.html': 'text/html; charset=utf-8', '.m4a': 'audio/mp4', '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t' };

// 中身の無い黒いページ(プロモーション画像の背景用。音は撮影ページと同じループ)
const STAGE_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>VJam FX</title>
<style>html, body { margin: 0; height: 100%; background: #000; }</style></head>
<body><button id="play" hidden></button><audio id="audio" src="audio/loop.m4a" loop></audio>
<script>document.getElementById('play').onclick = () => document.getElementById('audio').play();</script></body></html>`;

function startDemoSite() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/stage.html') {
      res.writeHead(200, { 'Content-Type': TYPES['.html'] });
      res.end(STAGE_HTML);
      return;
    }
    const file = path.join(DEMO, url === '/' ? 'index.html' : url);
    if (!file.startsWith(DEMO + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    const body = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': body.length });
    res.end(body);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  })));
}

// ページを開いて再生カードの Play を押す(クリックでページがスクロールしないように、ボタンを直接押す)
async function openAndPlay(page, url) {
  await page.goto(url);
  await page.evaluate(() => document.getElementById('play').click());
  await expect.poll(() => page.evaluate(() => document.getElementById('audio').currentTime)).toBeGreaterThan(0);
}

// エフェクトが出そろったところのページ(上までスクロールして)
async function pageShot(page) {
  await waitLayersFadedIn(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  return page.screenshot();
}

// popup の見えている部分(幅 280、高さは中身の高さで 600 まで)。top から下を切り出す
async function popupShot(popup, top = 0) {
  await popup.mouse.move(0, 0);
  const height = await popup.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
  const h = Math.min(height, POPUP_MAX_H);
  const y = Math.max(0, Math.min(top, height - h));
  return popup.screenshot({ fullPage: true, clip: { x: 0, y, width: POPUP_W, height: h } });
}

const dataUrl = (png) => `data:image/png;base64,${png.toString('base64')}`;
const pngSize = (png) => [png.readUInt32BE(16), png.readUInt32BE(20)];

// ページのスクショの右上に popup を重ねる
async function composite(context, bg, pop) {
  const page = await context.newPage();
  await page.setViewportSize({ width: W, height: H });
  await page.setContent(`<!doctype html><style>
    html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #000; }
    img { position: absolute; display: block; }
    .bg { inset: 0; width: ${W}px; height: ${H}px; }
    .pop { top: 12px; right: 16px; width: ${POPUP_W}px; border-radius: 10px;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, .14), 0 16px 48px rgba(0, 0, 0, .6), 0 2px 8px rgba(0, 0, 0, .45); }
  </style><img class="bg" src="${dataUrl(bg)}"><img class="pop" src="${dataUrl(pop)}">`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  const png = await page.screenshot();
  await page.close();
  return png;
}

// store/promo.html(#small / #marquee)に背景を入れて撮る
async function promoShot(context, name, w, h, bg) {
  const page = await context.newPage();
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`file://${path.join(STORE, 'promo.html')}#${name}`);
  await page.evaluate((src) => document.documentElement.style.setProperty('--fx', `url("${src}")`), dataUrl(bg));
  await page.waitForFunction(() => document.fonts.ready.then(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0)));
  await page.waitForTimeout(300);
  const png = await page.screenshot();
  await page.close();
  return png;
}

test('Chrome ウェブストアのスクショとプロモーション画像', async ({ headless }) => {
  const realPool = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/default-pool.json'), 'utf8'));
  for (const id of PRESETS) expect(realPool.presets).toContain(id);
  const pool = { ...realPool, presets: PRESETS };

  const site = await startDemoSite();
  const ext = await launchWithExtension({ headless, files: { 'content/default-pool.json': JSON.stringify(pool) } });
  try {
    const page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.route('**/*.m3u8', (route) => route.abort());
    await openAndPlay(page, `${site.base}/index.html#en`);

    // ON で Auto が始まる(設定の Auto start は既定 ON)。2 枚になって BPM が出るまで待つ
    let popup = await openPopup(ext, site.base);
    await popup.click('.toggle-switch');
    await expect(popup.locator('#stage-mode')).toHaveText('AUTO');
    await expect(popup.locator('#stage-bpm')).toHaveText(/^\d+ BPM$/, { timeout: 30_000 });
    await expect.poll(async () => (await readState(page)).layers.length, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(() => popup.locator('#layer-names li').count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(2);

    const shots = {};
    shots['01-effects.png'] = await pageShot(page);

    const autoPopup = await popupShot(popup);
    shots['02-popup-auto.png'] = [await pageShot(page), autoPopup];

    // Manual:Effect の一覧・Filters・Blend・Scenes が見えるところまで下げる。
    // 一覧のチェックは popup を開いたときにエンジンから読むので、開き直してから(Auto が足したものにチェックが付く)
    await popup.close();
    popup = await openPopup(ext, site.base);
    await openManual(popup);
    await expect(popup.locator('#preset-list input:checked')).not.toHaveCount(0);
    await popup.evaluate(() => {
      const list = document.getElementById('preset-list');
      const checked = list.querySelector('input:checked');
      if (checked) list.scrollTop = checked.closest('label').offsetTop - list.offsetTop - 48;
    });
    const manualTop = await popup.evaluate(() => Math.round(document.getElementById('btn-manual').getBoundingClientRect().top) + 1);
    const manualPopup = await popupShot(popup, manualTop);
    shots['04-manual.png'] = [await pageShot(page), manualPopup];
    await popup.click('#btn-manual'); // 畳んでおく(次に開いたときも畳んだまま)

    await popup.click('#btn-settings');
    await expect(popup.locator('#settings-section')).toBeVisible();
    const settingsPopup = await popupShot(popup);
    shots['05-settings.png'] = [await pageShot(page), settingsPopup];
    await popup.click('#btn-settings');
    await popup.close();

    // 明るいページ:移ったあとも同じレイヤーで続く。既定の screen は difference で描く
    await openAndPlay(page, `${site.base}/index.html?light#en-light`);
    await expect.poll(async () => {
      const s = await readState(page);
      return s.isLight === true && s.layers.length > 0;
    }, { timeout: 30_000 }).toBe(true);
    shots['03-light-page.png'] = await pageShot(page);

    // プロモーション画像の背景:中身の無い黒いページに、Reset してから PROMO_PRESETS だけ(blend は screen・filter なし)
    await page.setViewportSize({ width: 1400, height: 560 });
    await openAndPlay(page, `${site.base}/stage.html`);
    await expect.poll(async () => (await readState(page)).layers.length, { timeout: 30_000 }).toBeGreaterThan(0);
    popup = await openPopup(ext, site.base);
    await openManual(popup);
    await popup.click('#btn-reset');
    await expect.poll(async () => (await readState(page)).layers.length).toBe(0);
    for (const id of PROMO_PRESETS) await popup.locator(`#preset-list input[value="${id}"]`).check();
    await expect.poll(async () => (await readState(page)).layers.sort(), { timeout: 30_000 }).toEqual([...PROMO_PRESETS].sort());
    await popup.click('#btn-manual');
    await popup.close();
    const promoBg = await pageShot(page);

    // 重ねて書き出す(古いスクショは消す)
    for (const [name, value] of Object.entries(shots)) {
      if (Array.isArray(value)) shots[name] = await composite(ext.context, ...value);
      expect(pngSize(shots[name]), name).toEqual([W, H]);
    }
    const promos = {};
    for (const [name, w, h] of PROMOS) {
      promos[`promo-${name}.png`] = await promoShot(ext.context, name, w, h, promoBg);
      expect(pngSize(promos[`promo-${name}.png`]), name).toEqual([w, h]);
    }

    fs.rmSync(SHOTS, { recursive: true, force: true });
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const name of Object.keys(shots).sort()) fs.writeFileSync(path.join(SHOTS, name), shots[name]);
    for (const [name, png] of Object.entries(promos)) fs.writeFileSync(path.join(STORE, name), png);
  } finally {
    await ext.close();
    await site.close();
  }
});
