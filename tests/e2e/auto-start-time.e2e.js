/**
 * Auto の起動が、プールを 331 本(WebGL 158 本込み。#44)にして遅くならないか。173 本(2D だけ。#35 の時点)と比べる。
 * Auto はプールを全部 inject してから回り出す(_injectAllPresets は 20 本ずつ並列)ので、本数が効くのはそこ。
 * - トグル ON(既定の設定で Auto も始まる): 最初のレイヤーが出るまで(プールから選んだ 1〜3 本だけ先に入れる)と、Auto が回り出すまで
 * - トグル ON のまま Auto ボタン: Auto の最初のレイヤーが出るまで(全部入れてから最初の切り替え)
 * 時間は popup を押す直前から、ページ側で条件がそろった瞬間まで(どちらも壁時計の Date.now)。3 回ずつの中央値を出す
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { startSite, launchWithExtension, openPopup, readState, isAudioPlaying } from './helpers.js';

const PRESETS_DIR = path.resolve(__dirname, '../../content/presets');
const POOL = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../content/default-pool.json'), 'utf8'));
const usesWebgl = (id) => /createCanvas\([^;]*WEBGL/.test(fs.readFileSync(path.join(PRESETS_DIR, `${id}.js`), 'utf8'));
const POOL_2D = { ...POOL, presets: POOL.presets.filter((id) => !usesWebgl(id)) };
const RUNS = 3;
const LIMIT_MS = 20_000; // これを超えたら明らかにおかしい(比べるのは PR で)

const results = {}; // プールの本数 → { toggleLayer: [], toggleAuto: [], autoButton: [] }(ms)

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// ページ側で条件がそろった瞬間の Date.now()(rAF ごとに見る)
async function timeWhen(page, cond) {
  const handle = await page.waitForFunction(cond, null, { polling: 'raf', timeout: LIMIT_MS });
  return handle.jsonValue();
}

const firstLayer = () => {
  const e = window._vjamFxEngine;
  return e && e.activeLayers.size > 0 ? Date.now() : false;
};
// Auto が回り出したときには、プールが全部読み込まれている(popup は _injectAllPresets を待ってから Auto を送る)
const loadedPresets = (page) => page.evaluate(() => Object.keys(window.VJamFX.presets).length);
const autoRunning = () => {
  const e = window._vjamFxEngine;
  return e && e._autoCycleTimer ? Date.now() : false;
};

for (const [label, pool] of [['173', POOL_2D], ['331', POOL]]) {
  test.describe.serial(`Auto の起動時間(プール ${label} 本)`, () => {
    let site, ext;
    const r = (results[label] = { toggleLayer: [], toggleAuto: [], autoButton: [] });

    test.beforeAll(async ({ headless }) => {
      expect(pool.presets.length).toBe(Number(label));
      site = await startSite();
      ext = await launchWithExtension({ headless, files: { 'content/default-pool.json': JSON.stringify(pool) } });
    });

    test.afterAll(async () => {
      await ext?.close();
      await site?.close();
    });

    // 毎回ページを読み直して(inject したものを消す)、新しい popup で始める
    async function fresh() {
      const page = ext.context.pages()[0] ?? await ext.context.newPage();
      await page.goto(`${site.base}/index.html`);
      await expect.poll(() => isAudioPlaying(page)).toBe(true);
      expect((await readState(page)).engine).toBe(false);
      const popup = await openPopup(ext, site.base);
      await expect(popup.locator('#toggle')).not.toBeChecked();
      return { page, popup };
    }

    // トグル OFF。SW の状態が消えるまで待つ(残っていると、次に読み直したときに SW が入れ直す)
    async function stop(page, popup) {
      await popup.click('.toggle-switch');
      await expect(popup.locator('#toggle')).not.toBeChecked();
      await expect.poll(async () => (await readState(page)).active).toBe(false);
      await expect.poll(() => ext.sw.evaluate(() => chrome.storage.session.get(null)
        .then((all) => Object.keys(all).filter((k) => k.startsWith('tab_')).length))).toBe(0);
      await popup.close();
    }

    test('トグル ON(既定で Auto も始まる)', async () => {
      test.setTimeout(RUNS * 40_000);
      for (let i = 0; i < RUNS; i++) {
        const { page, popup } = await fresh();
        const t0 = Date.now();
        await popup.click('.toggle-switch');
        r.toggleLayer.push((await timeWhen(page, firstLayer)) - t0);
        r.toggleAuto.push((await timeWhen(page, autoRunning)) - t0);
        expect(await loadedPresets(page)).toBeGreaterThanOrEqual(pool.presets.length);
        await stop(page, popup);
      }
    });

    test('トグル ON のまま Auto ボタン', async () => {
      test.setTimeout(RUNS * 40_000);
      // トグル ON で Auto を始めない設定にして、neon-tunnel だけの状態から Auto を押す
      {
        const { popup } = await fresh();
        await popup.click('#btn-settings');
        await popup.selectOption('#setting-auto-start', 'off');
        await popup.close();
      }
      for (let i = 0; i < RUNS; i++) {
        const { page, popup } = await fresh();
        await popup.click('.toggle-switch');
        await timeWhen(page, firstLayer);
        // popup の起動処理(音声・設定の送り)が終わるまで待つ(Auto ボタンは _busy の間は効かない)
        await page.waitForTimeout(1000);
        const t0 = Date.now();
        await popup.click('#btn-auto-cycle');
        r.autoButton.push((await timeWhen(page, autoRunning)) - t0);
        expect(await loadedPresets(page)).toBeGreaterThanOrEqual(pool.presets.length);
        await stop(page, popup);
      }
    });
  });
}

test.afterAll(() => {
  const rows = Object.entries(results).filter(([, r]) => r.autoButton.length === RUNS);
  if (rows.length === 0) return;
  const fmt = (xs) => `${median(xs)} ms(${xs.join(' / ')})`;
  const lines = [
    '',
    '| プール | トグル ON → 最初のレイヤー | トグル ON → Auto が回り出す | Auto ボタン → Auto の最初のレイヤー |',
    '| --- | --- | --- | --- |',
    ...rows.map(([label, r]) => `| ${label} 本 | ${fmt(r.toggleLayer)} | ${fmt(r.toggleAuto)} | ${fmt(r.autoButton)} |`),
    '',
  ];
  console.log(lines.join('\n'));
});
