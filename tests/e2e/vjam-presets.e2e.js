/**
 * VJam 由来で取り込んだ 14 本(#35)が popup から動く。一覧で 1 本ずつ選んで、レイヤーが乗る・見える・動く・ページのエラーが無いことを見る。
 * あわせて Filter を VJam 方式にしたもの(手動のボタン 5 個、Filter Rnd はプールの 14 種)を実物で確かめる
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { startSite, launchWithExtension, openPopup, openManual, readState, readCanvases, waitLayersFadedIn, isAudioPlaying, diffScore } from './helpers.js';

const IMPORTED = [
  'corrupted-archive', 'deep-nebula', 'desktop-meltdown', 'gravity-cloth', 'hanabi-dusk',
  'neon-horizon', 'oscilloscope-xy', 'ridge-lines', 'shockwave',
  'silk-flow', 'test-pattern', 'tv-testcard', 'tv-weather', 'voronoi-rk',
];
const POOL = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../content/default-pool.json'), 'utf8'));
const VISIBLE_DIFF = 0.1; // smoke.e2e.js と同じ(ベースラインとの差がこれを超えたら「見えている」)
const MOVING_DIFF = 0.05; // 同じ(1 秒あけた 2 枚の差がこれを超えたら「動いている」)

test.describe.serial('VJam 由来の 14 本が popup から動く', () => {
  let site, ext, page, popup, baseline;
  let errors = [];
  let prev = null;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${site.base}/index.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);
    baseline = await page.screenshot();
    popup = await openPopup(ext, site.base);
    popup.on('pageerror', (e) => errors.push(`[popup] ${e}`));
    await openManual(popup);
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  for (const id of IMPORTED) {
    test(id, async () => {
      errors = [];
      // 新しい方を足してから前の方を外す(最後の 1 本を外すとエンジンが止まるので)
      await popup.locator(`#preset-list input[value="${id}"]`).check();
      if (prev) await popup.locator(`#preset-list input[value="${prev}"]`).uncheck();
      prev = id;
      await expect.poll(async () => (await readState(page)).layers, { timeout: 15_000 }).toEqual([id]);
      await waitLayersFadedIn(page);

      const canvases = await readCanvases(page);
      expect(canvases.length).toBeGreaterThanOrEqual(1);
      for (const c of canvases) expect(c.visibility).toBe('visible');

      let drawn;
      await expect.poll(async () => {
        drawn = await page.screenshot();
        return diffScore(baseline, drawn);
      }, { timeout: 10_000 }).toBeGreaterThan(VISIBLE_DIFF);
      await page.waitForTimeout(1000);
      expect(diffScore(drawn, await page.screenshot())).toBeGreaterThan(MOVING_DIFF);
      expect(errors).toEqual([]);
    });
  }
});

test.describe.serial('Filter を VJam 方式にする', () => {
  let site, ext, page, popup;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test('手動の filter ボタンは VJam と同じ 5 個で、1 列に収まる', async () => {
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.goto(`${site.base}/index.html`);
    popup = await openPopup(ext, site.base);
    await openManual(popup);
    const buttons = popup.locator('#filter-grid .filter-btn');
    expect(await buttons.evaluateAll((els) => els.map((b) => b.dataset.filter)))
      .toEqual(['invert', 'hue-rotate', 'saturate', 'grayscale', 'contrast']);
    const boxes = await buttons.evaluateAll((els) => els.map((b) => ({
      top: b.getBoundingClientRect().top, fits: b.scrollWidth <= b.clientWidth, height: b.clientHeight,
    })));
    for (const b of boxes) {
      expect(b.top).toBe(boxes[0].top);
      expect(b.fits).toBe(true);
      expect(b.height).toBe(boxes[0].height); // 折り返して 2 行になっていない
    }
  });

  test('Filter Rnd はプールの 14 種(invert なし)からだけ選ぶ', async () => {
    await popup.locator('#preset-list input[value="radar"]').check();
    await expect.poll(async () => (await readState(page)).layers, { timeout: 15_000 }).toEqual(['radar']);
    await popup.click('#auto-filters');
    // popup が読んだ default-pool.json がエンジンに渡る
    await expect.poll(() => page.evaluate(() => {
      const e = window._vjamFxEngine;
      return e._autoFXFilters && e._autoFXPool ? e._autoFXPool.filters : null;
    })).toEqual(POOL.filters);
    expect(POOL.filters.length).toBe(14);
    // 実物のエンジンで何度も引いて、選ばれる filter を集める(CSS に掛かるのは dip で暗くなってから。#38)
    const seen = await page.evaluate(() => {
      const e = window._vjamFxEngine;
      const out = new Set();
      for (let i = 0; i < 300; i++) {
        e._randomizeFilter(e._autoFXPool, true);
        out.add(e._rndFilter);
      }
      return [...out];
    });
    expect(seen.sort()).toEqual(POOL.filters.slice().sort());
    // 最後に選んだものが掛かる
    await expect.poll(() => page.evaluate(() => {
      const e = window._vjamFxEngine;
      return !e._dipDownTimer && e.overlay.style.filter === e._rndFilter;
    })).toBe(true);
  });
});
