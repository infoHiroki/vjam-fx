/**
 * VJam 本体から取り込んだ WebGL のプリセット(#44)が popup から動く。一覧で 1 本ずつ選んで、レイヤーが乗る・WebGL で描いている・
 * 見える・動く・ページのエラーが無いことを見る(数本。ヘッドレスの WebGL は SwiftShader なので、計測で軽かったものから)。
 * あわせて、Next / Auto の抽選で WebGL が 1 回に 1 本までになっていること(引いた本数のレイヤーが残る・Auto は 3 枚まで積み上がる)を実物で確かめる
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { startSite, launchWithExtension, openPopup, openManual, readState, readAuto, readCanvases, waitLayersFadedIn, isAudioPlaying, diffScore } from './helpers.js';

// カテゴリがばらけるように(Immersive / Audio Reactive / Patterns / Particles / Space / Grid & Tech)
const PICKED = ['tunnel-shader', 'cymatics', 'stained-glass-rose', '3d-particles', 'supernova', 'digital-rain-gpu'];
const PRESETS_DIR = path.resolve(__dirname, '../../content/presets');
const POOL = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../content/default-pool.json'), 'utf8')).presets;
const WEBGL = new Set(POOL.filter((id) => /createCanvas\([^;]*WEBGL/.test(fs.readFileSync(path.join(PRESETS_DIR, `${id}.js`), 'utf8'))));
const VISIBLE_DIFF = 0.1; // smoke.e2e.js と同じ(ベースラインとの差がこれを超えたら「見えている」)
const MOVING_DIFF = 0.05; // 同じ(1 秒あけた 2 枚の差がこれを超えたら「動いている」)

// 出ているレイヤーが p5 の WEBGL で描いているか
function readWebglLayers(page) {
  return page.evaluate(() => {
    const e = window._vjamFxEngine;
    return e ? [...e.activeLayers].filter(([, l]) => l.preset.p5 && l.preset.p5._renderer && l.preset.p5._renderer.isP3D).map(([n]) => n) : [];
  });
}

test.describe.serial('VJam 本体の WebGL のプリセットが popup から動く', () => {
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

  test('一覧に WebGL の 158 本があり、選んだものは全部 WebGL', async () => {
    expect(WEBGL.size).toBe(158);
    for (const id of PICKED) expect(WEBGL.has(id)).toBe(true);
    const listed = await popup.locator('#preset-list input[type="checkbox"]').evaluateAll((els) => els.map((el) => el.value));
    for (const id of WEBGL) expect(listed).toContain(id);
  });

  for (const id of PICKED) {
    test(id, async () => {
      errors = [];
      // 足すだけ。WebGL のレイヤーは同時に 1 枚までなので、前の 1 本はエンジンが外し、popup のチェックも外れる(#42)
      await popup.locator(`#preset-list input[value="${id}"]`).check();
      await expect.poll(async () => (await readState(page)).layers, { timeout: 15_000 }).toEqual([id]);
      if (prev) await expect(popup.locator(`#preset-list input[value="${prev}"]`)).not.toBeChecked();
      prev = id;
      await waitLayersFadedIn(page);
      expect(await readWebglLayers(page)).toEqual([id]);

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

test.describe.serial('Next / Auto の抽選で WebGL は 1 回に 1 本まで', () => {
  let site, ext, page, popup;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.goto(`${site.base}/index.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);
    popup = await openPopup(ext, site.base);
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test('Next: 引いたものに WebGL は 1 本まで。引いた本数のレイヤーが残る', async () => {
    await popup.click('#btn-next');
    await expect.poll(async () => (await readState(page)).layers.length, { timeout: 15_000 }).toBeGreaterThan(0);
    // エンジンが受け取った Next を数える
    await page.evaluate(() => {
      const e = window._vjamFxEngine;
      window.__vjNext = [];
      const crossfade = e.crossfade.bind(e);
      e.crossfade = (names, options) => {
        const r = crossfade(names, options);
        window.__vjNext.push({ names: names.slice(), layers: [...e.activeLayers.keys()], webgl: e._webglPresets.size });
        return r;
      };
    });
    let withWebgl = 0;
    for (let i = 1; i <= 15; i++) {
      await popup.click('#btn-next');
      await expect.poll(() => page.evaluate(() => window.__vjNext.length), { timeout: 15_000 }).toBe(i);
    }
    const nexts = await page.evaluate(() => window.__vjNext);
    for (const { names, layers, webgl } of nexts) {
      expect(webgl).toBe(158);
      expect(names.length).toBeGreaterThanOrEqual(1);
      expect(names.length).toBeLessThanOrEqual(3);
      expect(names.filter((n) => WEBGL.has(n)).length).toBeLessThanOrEqual(1);
      expect(layers.sort()).toEqual(names.slice().sort());
      if (names.some((n) => WEBGL.has(n))) withWebgl++;
    }
    expect(withWebgl).toBeGreaterThan(0);
  });

  // Auto は 1 手ずつ(#59): WebGL が出ているときは 2D を足すので、WebGL が 2 枚になってレイヤーが減ることはない
  test('Auto: エンジンが WebGL の一覧を受け取り、1 手ずつ足しても WebGL は 1 本で 3 枚まで積み上がる', async () => {
    await popup.click('#btn-auto-cycle');
    // presets の数は見ない(この端末で重いと分かったものは popup がプールから除く)
    await expect.poll(() => readAuto(page), { timeout: 20_000 }).toMatchObject({ cycling: true, pool: true });
    const result = await page.evaluate(() => {
      const e = window._vjamFxEngine;
      e._stopAutoCycle(); // タイマーの切り替えと混ざらないように、ここからは手で回す
      e._fadeDuration = 0; // 外した WebGL のコンテキストをすぐ手放す
      e._heavySkipOff = true; // 手の外で入れ替えない
      e._loudnessCap = () => 0; // 上限は 3 枚
      e._autoRestAt = Infinity; // 休みは出さない
      const rounds = [];
      for (let round = 0; round < 6; round++) {
        e._autoBegin(); // 1 枚から
        const steps = [[...e.activeLayers.keys()]];
        for (let i = 0; i < 8; i++) {
          e._autoSwitch();
          steps.push([...e.activeLayers.keys()]);
        }
        rounds.push(steps);
      }
      e._stopAutoCycle();
      return { webgl: [...e._webglPresets], rounds };
    });
    expect(result.webgl.length).toBe(158);
    expect(new Set(result.webgl)).toEqual(WEBGL);
    let withWebgl = 0;
    for (const steps of result.rounds) {
      // 1 → 2 → 3(WebGL を引いても、ほかのレイヤーが消えない)
      expect(steps.slice(0, 3).map((l) => l.length)).toEqual([1, 2, 3]);
      for (const layers of steps) {
        expect(layers.length).toBeLessThanOrEqual(3);
        expect(layers.filter((n) => WEBGL.has(n)).length).toBeLessThanOrEqual(1);
        if (layers.some((n) => WEBGL.has(n))) withWebgl++;
      }
    }
    expect(withWebgl).toBeGreaterThan(0);
  });
});
