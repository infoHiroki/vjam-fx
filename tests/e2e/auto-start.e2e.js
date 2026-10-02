/**
 * トグル ON で Auto を始める(#29)。既定の設定なら、トグル ON だけで描画と Auto・Blend Rnd・Filter Rnd が始まる。
 * 設定 OFF なら今まで通り(neon-tunnel 1 本、Auto / Rnd なし)
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { startSite, launchWithExtension, openPopup, readState, readAuto, isAudioPlaying, diffScore } from './helpers.js';

const POOL = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../content/default-pool.json'), 'utf8')).presets;
const VISIBLE_DIFF = 0.1; // smoke.e2e.js と同じ(ベースラインとの差がこれを超えたら「見えている」)
const MOVING_DIFF = 0.05; // 同じ(1 秒あけた 2 枚の差がこれを超えたら「動いている」)

test.describe.serial('トグル ON だけで Auto が始まる(既定の設定)', () => {
  let site, ext, page, popup, baseline, drawn;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test('popup の設定は既定で ON', async () => {
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.goto(`${site.base}/index.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);
    baseline = await page.screenshot();

    popup = await openPopup(ext, site.base);
    await expect(popup.locator('#setting-auto-start')).toHaveValue('on');
    await expect(popup.locator('#toggle')).not.toBeChecked();
    expect((await readState(page)).engine).toBe(false);
  });

  test('トグル ON → プールの 1〜3 本で描き始める', async () => {
    await popup.click('.toggle-switch');
    await expect.poll(async () => {
      const s = await readState(page);
      return s.active && s.canvases >= 1 && s.layers.length >= 1;
    }, { timeout: 15_000 }).toBe(true);
    const { layers } = await readState(page);
    expect(layers.length).toBeLessThanOrEqual(3);
    for (const id of layers) expect(POOL).toContain(id);

    await expect.poll(async () => {
      drawn = await page.screenshot();
      return diffScore(baseline, drawn);
    }, { timeout: 10_000 }).toBeGreaterThan(VISIBLE_DIFF);
    await page.waitForTimeout(1000);
    expect(diffScore(drawn, await page.screenshot())).toBeGreaterThan(MOVING_DIFF);
  });

  test('エンジンの Auto と Blend Rnd・Filter Rnd が動き出す(プール付き)', async () => {
    await expect.poll(() => readAuto(page), { timeout: 20_000 }).toMatchObject({
      cycling: true, presets: POOL.length, pool: true, blend: true, filters: true,
    });
    // Auto が切り替えるたびに Rnd が blend / filter を選び直すのを数える
    await page.evaluate(() => {
      const e = window._vjamFxEngine;
      window.__vjRnd = { blend: 0, filter: 0 };
      const blend = e._randomizeBlend.bind(e);
      const filter = e._randomizeFilter.bind(e);
      e._randomizeBlend = (...a) => { window.__vjRnd.blend++; return blend(...a); };
      e._randomizeFilter = (...a) => { window.__vjRnd.filter++; return filter(...a); };
    });
  });

  test('popup のボタンも Auto・Rnd が ON', async () => {
    await expect(popup.locator('#toggle')).toBeChecked();
    await expect(popup.locator('#btn-auto-cycle')).toHaveClass(/\bactive\b/);
    await expect(popup.locator('#auto-blend')).toHaveClass(/\bactive\b/);
    await expect(popup.locator('#auto-filters')).toHaveClass(/\bactive\b/);
  });

  test('Auto でプリセットが入れ替わり、Rnd が blend / filter を選び直す', async () => {
    const layersNow = async () => (await readState(page)).layers.join(',');
    const before = await layersNow();
    // 最初の場面(トグル ON で選んだレイヤー)の次から、拍(16 拍)か時間の fallback(4〜15 秒)で切り替わる
    await expect.poll(layersNow, { timeout: 25_000 }).not.toBe(before);
    await expect.poll(() => page.evaluate(() => window.__vjRnd.blend > 0 && window.__vjRnd.filter > 0)).toBe(true);
  });
});

test.describe.serial('設定 OFF ならトグル ON は今まで通り', () => {
  let site, ext, page, popup;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test('設定を OFF にすると保存される', async () => {
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.goto(`${site.base}/index.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);

    popup = await openPopup(ext, site.base);
    await popup.click('#btn-settings');
    await popup.selectOption('#setting-auto-start', 'off');
    await popup.close();
    popup = await openPopup(ext, site.base);
    await expect(popup.locator('#setting-auto-start')).toHaveValue('off');
  });

  test('トグル ON → neon-tunnel だけで、Auto / Rnd は始まらない', async () => {
    await popup.click('.toggle-switch');
    await expect.poll(async () => {
      const s = await readState(page);
      return s.active && s.canvases >= 1 ? s.layers : null;
    }, { timeout: 15_000 }).toEqual(['neon-tunnel']);
    // popup の起動処理(Auto は最後に送る)が終わるのを待ってから見る
    await page.waitForTimeout(3000);
    expect(await readAuto(page)).toMatchObject({ cycling: false, fx: false });
    expect((await readState(page)).layers).toEqual(['neon-tunnel']);
    await expect(popup.locator('#btn-auto-cycle')).not.toHaveClass(/\bactive\b/);
    await expect(popup.locator('#auto-blend')).not.toHaveClass(/\bactive\b/);
    await expect(popup.locator('#auto-filters')).not.toHaveClass(/\bactive\b/);
  });
});
