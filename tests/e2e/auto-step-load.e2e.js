/**
 * Auto を 1 手ずつ(#59)にして、切り替えが軽くなったか。CPU を 4 倍に絞って(tools/bench・fade-load.e2e.js と同じ)、
 * 3 枚出ているところからの切り替えの間のページの fps を、前の Auto(全部入れ替え: 3 枚 → 別の 3 枚)と
 * この Auto の入れ替えの手(一番古い 1 枚 → 新しい 1 枚)で比べる。フェードは既定の 5 秒。表は最後に出す(比べるのは PR で)
 */
import { test, expect } from '@playwright/test';
import { startSite, launchWithExtension, openPopup, readAuto, waitLayersFadedIn, isAudioPlaying } from './helpers.js';

// プールの 2D で、tools/bench の計測が中くらいに重いもの(1 フレーム 5〜10ms)。fade-load.e2e.js と同じ
const A = ['aurora', 'cellular', 'kaleidoscope'];
const B = ['fog-bank', 'kelp-forest', 'lava-lamp'];
const RUNS = 5;
const THROTTLE = 4;

const results = { all: [], step: [] };
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// 切り替えて、フェードの間(前半・後半)と、そのあとのページの fps を rAF で測る。
// all: 前の Auto と同じく全部入れ替える(出ていない 3 枚へ)。step: この Auto の入れ替えの手(_autoSwitch)
function switchFps(page, mode) {
  return page.evaluate(({ mode, pool }) => new Promise((resolve) => {
    const e = window._vjamFxEngine;
    const fadeMs = e._fadeDuration * 1000;
    const before = e.getActiveLayerNames();
    const times = [];
    let t0 = 0;
    const frame = (now) => {
      if (!t0) {
        t0 = now;
        if (mode === 'all') {
          e.crossfade(pool.filter((n) => !before.includes(n)), {});
        } else {
          e._autoCyclePresets = pool;
          e._autoSwapsLeft = 3; // 入れ替えの手(ブレイクにしない)
          e._autoSwitch();
          e._stopAutoCycle(); // 次の手は張らない
        }
      }
      times.push(now - t0);
      if (now - t0 < fadeMs + 2000) {
        requestAnimationFrame(frame);
        return;
      }
      const after = e.getActiveLayerNames();
      const fps = (from, until) => Math.round(times.filter((t) => t >= from && t < until).length * 10000 / (until - from)) / 10;
      resolve({
        fade: fps(0, fadeMs), first: fps(0, fadeMs / 2), second: fps(fadeMs / 2, fadeMs), after: fps(fadeMs + 500, fadeMs + 2000),
        changed: after.filter((n) => !before.includes(n)).length, count: after.length,
      });
    };
    requestAnimationFrame(frame);
  }), { mode, pool: [...A, ...B] });
}

test.describe.serial('1 手ずつの Auto の切り替えの重さ(#59)', () => {
  let site, ext, page, cdp;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.goto(`${site.base}/index.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);
    // トグル ON(Auto がプールを全部読み込む)。そのあと Auto / Rnd は止めて、手で切り替える
    const popup = await openPopup(ext, site.base);
    await popup.click('.toggle-switch');
    await expect.poll(() => readAuto(page), { timeout: 20_000 }).toMatchObject({ cycling: true });
    await popup.close();
    const loaded = await page.evaluate((names) => {
      const e = window._vjamFxEngine;
      e._stopAutoCycle();
      e._stopAutoFX();
      e._heavySkipOff = true; // 絞った CPU で重いもの判定が入れ替えないように
      e._presetCategories = null; // A / B のどれからでも選ぶ
      e._loudnessCap = () => 0; // 上限は 3 枚のまま
      e._autoBlend = false; // 入れ替えの手の 3 割の blend / filter(dip)を測りに入れない
      e._autoFilters = false;
      return names.filter((n) => window.VJamFX.presets[n]);
    }, [...A, ...B]);
    expect(loaded).toEqual([...A, ...B]);
    expect(await page.evaluate(() => window._vjamFxEngine._fadeDuration)).toBe(5);
    await page.evaluate((names) => window._vjamFxEngine.crossfade(names, {}), A);
    await waitLayersFadedIn(page);
    cdp = await ext.context.newCDPSession(page);
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test(`CPU ${THROTTLE} 倍の絞りで、切り替えの間の fps を「全部入れ替え(前の Auto)」と「1 手(この Auto)」で比べる`, async () => {
    test.setTimeout(240_000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    try {
      // 慣らし(30fps 落としが入るならここで入れておく)
      await switchFps(page, 'all');
      for (let i = 0; i < RUNS; i++) {
        for (const mode of i % 2 ? ['step', 'all'] : ['all', 'step']) {
          const r = await switchFps(page, mode);
          results[mode].push(r);
          expect(r.count).toBe(3);
          expect(r.changed).toBe(mode === 'all' ? 3 : 1);
          await page.waitForTimeout(1000);
        }
      }
    } finally {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
    for (const mode of ['all', 'step']) {
      for (const r of results[mode]) expect(r.fade).toBeGreaterThan(0);
    }
  });
});

test.afterAll(() => {
  if (results.all.length < RUNS || results.step.length < RUNS) return;
  const fmt = (rs, key) => `${median(rs.map((r) => r[key]))}(${rs.map((r) => r[key]).join(' / ')})`;
  const lines = [
    '',
    `CPU ${THROTTLE} 倍の絞り・3 枚出ているところからの切り替え(フェード 5 秒)の間のページの fps(中央値と ${RUNS} 回)`,
    '| | フェード全体 | 前半 | 後半 | フェードのあと(3 枚) |',
    '| --- | --- | --- | --- | --- |',
    ...[['all', '全部入れ替え(前の Auto)'], ['step', '1 枚だけ入れ替え(この Auto)']].map(([mode, label]) =>
      `| ${label} | ${fmt(results[mode], 'fade')} | ${fmt(results[mode], 'first')} | ${fmt(results[mode], 'second')} | ${fmt(results[mode], 'after')} |`),
    '',
  ];
  console.log(lines.join('\n'));
});
