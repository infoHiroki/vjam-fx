/**
 * Auto を 1 手ずつ・1 枚から積み上げる(#59)を、実物の Chromium + 拡張で確かめる。
 * - トグル ON(既定で Auto)は 1 枚から。そこから時間を早送り(エンジンの Cycle を 2.5 秒・フェードを 0.4 秒に縮める)して、
 *   枚数の流れ 1 → 2 → 3 → 入れ替え(2〜4 手、一番古い 1 枚ずつ)→ ブレイク(新しい 1 枚)→ 2 … を見る
 * - Rnd(blend / filter)は積み上げの手では変えず、ブレイクで変える
 * - popup のステージ(出ているレイヤー名)にも 1 手ごとの枚数がそのまま出る
 * - Auto 中の Next: すぐ 1〜3 本のセットへクロスフェードし、Auto は切れずにそのセットから 1 手ずつ続く
 */
import { test, expect } from '@playwright/test';
import { startSite, launchWithExtension, openPopup, readState, readAuto, isAudioPlaying } from './helpers.js';

const STEP_MS = 2500;
const FADE_S = 0.4;

// Auto を早送りにして、手ごとの「出ているレイヤー」と、その手で Rnd を呼んだかを window.__vjSteps に貯める。
// 重いもの判定は止める(ヘッドレスの 3 枚で fps が落ちても、手の外で入れ替えないように)
function fastForward(page) {
  return page.evaluate(({ stepMs, fade }) => {
    const e = window._vjamFxEngine;
    e._heavySkipOff = true;
    e._fadeDuration = fade;
    e._autoCycleInterval = stepMs;
    e._autoRestAt = Infinity; // 休みは出さない(4〜6 回のブレイクに 1 回。unit で見ている)
    if (!e.__stepTapped) {
      e.__stepTapped = true;
      window.__vjSteps = [];
      let rnd = 0;
      const blend = e._randomizeBlend.bind(e);
      e._randomizeBlend = (...a) => { rnd++; return blend(...a); };
      const step = e._autoSwitch.bind(e);
      e._autoSwitch = () => {
        rnd = 0;
        step();
        window.__vjSteps.push({ names: e.getActiveLayerNames(), rnd: rnd > 0, at: performance.now() });
      };
    }
    e._scheduleAutoCycle(); // ここから数える
    return e.getActiveLayerNames();
  }, { stepMs: STEP_MS, fade: FADE_S });
}

const stepsSoFar = (page) => page.evaluate(() => window.__vjSteps || []);

test.describe.serial('Auto を 1 手ずつ・1 枚から積み上げる(#59)', () => {
  let site, ext, page, popup;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.goto(`${site.base}/index.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test('トグル ON(既定で Auto)は 1 枚から', async () => {
    popup = await openPopup(ext, site.base);
    await popup.click('.toggle-switch');
    await expect.poll(() => readAuto(page), { timeout: 20_000 }).toMatchObject({ cycling: true, blend: true, filters: true });
    expect((await readState(page)).layers).toHaveLength(1);
  });

  test('早送り: 1 → 2 → 3 → 入れ替え(一番古い 1 枚ずつ 2〜4 手)→ ブレイク(新しい 1 枚)→ 2。ステージも同じ枚数', async () => {
    test.setTimeout(90_000);
    const start = await fastForward(page);
    expect(start).toHaveLength(1);

    // ステージ(popup が 1 秒おきにエンジンから読む)に出た枚数を、手が進む間ずっと拾う
    const shown = new Set();
    let steps = [];
    const done = () => {
      const i = steps.findIndex((s, k) => k > 0 && s.names.length === 1); // ブレイク
      return i > 0 && steps.length > i + 1; // ブレイクの次の手(積み上げ直し)まで
    };
    const deadline = Date.now() + 70_000;
    while (!done() && Date.now() < deadline) {
      shown.add(await popup.locator('#layer-names li').count());
      steps = await stepsSoFar(page);
      await page.waitForTimeout(200);
    }
    expect(done()).toBe(true);

    const counts = [start.length, ...steps.map((s) => s.names.length)];
    console.log(`Auto の枚数の流れ: ${counts.join(' → ')}`);
    // 1 → 2 → 3 → 3(2〜4 手)→ 1 → 2
    const breakAt = counts.indexOf(1, 1);
    expect(counts.slice(0, 3)).toEqual([1, 2, 3]);
    const swaps = counts.slice(3, breakAt);
    expect(swaps.length).toBeGreaterThanOrEqual(2);
    expect(swaps.length).toBeLessThanOrEqual(4);
    for (const n of swaps) expect(n).toBe(3);
    expect(counts[breakAt + 1]).toBe(2);

    // 1 手で変わるのは 1 枚: 足す(前はそのまま)/ 入れ替え(一番古いものが抜けて 1 枚入る)/ ブレイク(一番新しいものだけ残る)
    let prev = start;
    steps.forEach(({ names }, i) => {
      const k = i + 1;
      if (k === breakAt) {
        expect(names).toEqual([prev[prev.length - 1]]);
      } else if (names.length > prev.length) {
        expect(names.slice(0, prev.length)).toEqual(prev);
        expect(names).toHaveLength(prev.length + 1);
      } else {
        expect(names.slice(0, 2)).toEqual(prev.slice(1));
        expect(prev).not.toContain(names[2]);
      }
      prev = names;
    });

    // Rnd は積み上げの手では変えず、ブレイクで変える
    expect(steps[0].rnd).toBe(false);
    expect(steps[1].rnd).toBe(false);
    expect(steps[breakAt - 1].rnd).toBe(true);

    // ステージにも 1 → 2 → 3 枚が出た
    for (const n of [1, 2, 3]) expect(shown).toContain(n);
  });

  test('Auto 中の Next: すぐセットへクロスフェードし、Auto は切れずにそのセットから 1 手ずつ続く', async () => {
    test.setTimeout(60_000);
    await page.evaluate(() => {
      const e = window._vjamFxEngine;
      window.__vjNext = null;
      const crossfade = e.crossfade.bind(e);
      e.crossfade = (names, options) => {
        window.__vjNext = names.slice();
        return crossfade(names, options);
      };
    });
    await popup.click('#btn-next');
    await expect.poll(() => page.evaluate(() => window.__vjNext), { timeout: 10_000 }).not.toBeNull();
    const set = await page.evaluate(() => window.__vjNext);
    expect(set.length).toBeGreaterThanOrEqual(1);
    expect(set.length).toBeLessThanOrEqual(3);
    // Auto はエンジンでも popup でも ON のまま(popup が出したセットから続けて送り直す)
    await expect.poll(() => readAuto(page), { timeout: 20_000 }).toMatchObject({ cycling: true, blend: true, filters: true });
    await expect(popup.locator('#btn-auto-cycle')).toHaveClass(/\bactive\b/);
    await expect(popup.locator('#stage-mode')).toHaveText('AUTO');
    await expect.poll(async () => (await readState(page)).layers).toEqual(set);

    // 送り直した Auto(Cycle は popup の 15 秒)を早送りにして、次の手を見る
    const before = (await stepsSoFar(page)).length;
    await fastForward(page);
    await expect.poll(async () => (await stepsSoFar(page)).length, { timeout: 15_000 }).toBeGreaterThan(before);
    const { names } = (await stepsSoFar(page))[before];
    if (set.length < 3) {
      // 足す
      expect(names.slice(0, set.length)).toEqual(set);
      expect(names).toHaveLength(set.length + 1);
    } else {
      // 入れ替え
      expect(names.slice(0, 2)).toEqual(set.slice(1));
      expect(set).not.toContain(names[2]);
    }
  });
});
