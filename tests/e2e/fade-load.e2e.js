/**
 * 長いフェード(#58)を軽くする: 消えていくレイヤーは p5 を 20fps に落とし、フェードの半分で止める(最後の絵のまま opacity で消える)。
 * - 見た目: 止めたレイヤーは最後の絵のまま消えていき、入ってくるレイヤーは描き続ける。フェードの途中のコマを outputDir に残す
 * - 効果: CPU を 4 倍に絞って(tools/bench と同じ。iPad 第 9 世代くらい)、Next のクロスフェード(3 枚 → 3 枚、5 秒)の間の
 *   ページの fps を「描き続ける(今まで)」と「止める」で比べる。表は最後に出す(比べるのは PR で)
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { startSite, launchWithExtension, openPopup, readAuto, waitLayersFadedIn, isAudioPlaying } from './helpers.js';

// プールの 2D で、tools/bench の計測が中くらいに重いもの(1 フレーム 5〜10ms)
const A = ['aurora', 'cellular', 'kaleidoscope'];
const B = ['fog-bank', 'kelp-forest', 'lava-lamp'];
const RUNS = 3;
const THROTTLE = 4;

const results = { keep: [], stop: [] };
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// to にクロスフェードして、フェードの間(前半・後半)と、そのあと(to だけ)のページの fps を rAF で測る。
// keep: 今までどおり消えていく方も描き続ける(_calmFadingLayer を外す)
function crossfadeFps(page, to, keep) {
  return page.evaluate(({ to, keep }) => new Promise((resolve) => {
    const e = window._vjamFxEngine;
    const fadeMs = e._fadeDuration * 1000;
    const calm = e._calmFadingLayer;
    const old = [...e.activeLayers.values()].map((l) => l.preset.p5);
    const times = [];
    let t0 = 0;
    let stopped = null;
    const frame = (now) => {
      if (!t0) {
        t0 = now;
        if (keep) e._calmFadingLayer = () => null;
        e.crossfade(to, {});
        e._calmFadingLayer = calm;
      }
      times.push(now - t0);
      if (stopped === null && now - t0 > fadeMs * 0.6) stopped = old.every((p) => !p.isLooping());
      if (now - t0 < fadeMs + 2000) {
        requestAnimationFrame(frame);
        return;
      }
      const fps = (from, until) => Math.round(times.filter((t) => t >= from && t < until).length * 10000 / (until - from)) / 10;
      resolve({ fade: fps(0, fadeMs), first: fps(0, fadeMs / 2), second: fps(fadeMs / 2, fadeMs), after: fps(fadeMs + 500, fadeMs + 2000), stopped });
    };
    requestAnimationFrame(frame);
  }), { to, keep });
}

test.describe.serial('長いフェードを軽くする(#58)', () => {
  let site, ext, page, cdp;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.goto(`${site.base}/index.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);
    // トグル ON(Auto がプールを全部読み込む)。そのあと Auto / Rnd は止めて、手でクロスフェードする
    const popup = await openPopup(ext, site.base);
    await popup.click('.toggle-switch');
    await expect.poll(() => readAuto(page), { timeout: 20_000 }).toMatchObject({ cycling: true });
    await popup.close();
    const loaded = await page.evaluate((names) => {
      const e = window._vjamFxEngine;
      e._stopAutoCycle();
      e._stopAutoFX();
      e._heavySkipOff = true; // 絞った CPU で重いもの判定が入れ替えないように
      return names.filter((n) => window.VJamFX.presets[n]);
    }, [...A, ...B]);
    expect(loaded).toEqual([...A, ...B]);
    expect(await page.evaluate(() => window._vjamFxEngine._fadeDuration)).toBe(5);
    cdp = await ext.context.newCDPSession(page);
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test('見た目: 消えていく方は半分で止まり、その絵のまま消える。入ってくる方は描き続ける', async () => {
    test.setTimeout(60_000);
    await page.evaluate((names) => window._vjamFxEngine.crossfade(names, {}), A);
    await waitLayersFadedIn(page);
    // フェードの途中のコマを残す(PR で見る)。キャンバスの中身が変わっているかも見る
    const dir = test.info().outputPath('frames');
    fs.mkdirSync(dir, { recursive: true });
    const frames = [];
    cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
      frames.push(data);
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 640, everyNthFrame: 2 });
    const changes = await page.evaluate((to) => new Promise((resolve) => {
      const e = window._vjamFxEngine;
      const fadeMs = e._fadeDuration * 1000;
      const old = [...e.activeLayers.values()].map((l) => l.container.querySelector('canvas'));
      e.crossfade(to, {});
      const fresh = [...e.activeLayers.values()].map((l) => l.container.querySelector('canvas'));
      const snap = (canvases) => canvases.map((c) => c.toDataURL());
      const changed = (a, b) => a.filter((x, i) => x !== b[i]).length;
      const at = (ms) => new Promise((r) => setTimeout(r, ms));
      (async () => {
        await at(fadeMs * 0.2);
        const o1 = snap(old);
        const f1 = snap(fresh);
        await at(fadeMs * 0.15);
        const o2 = snap(old);
        await at(fadeMs * 0.25); // 半分を過ぎた(0.6)
        const o3 = snap(old);
        const f3 = snap(fresh);
        await at(fadeMs * 0.25); // 0.85
        const o4 = snap(old);
        resolve({ beforeHalf: changed(o1, o2), afterHalf: changed(o3, o4), fresh: changed(f1, f3), count: old.length });
      })();
    }), B);
    await page.waitForTimeout(1500);
    await cdp.send('Page.stopScreencast');
    frames.forEach((data, i) => fs.writeFileSync(`${dir}/${String(i).padStart(3, '0')}.jpg`, Buffer.from(data, 'base64')));
    console.log(`fade frames: ${frames.length} → ${dir}`);
    // 半分までは(20fps で)描いている。半分を過ぎたら止まっている。入ってくる方は描いている
    expect(changes.beforeHalf).toBeGreaterThan(0);
    expect(changes.afterHalf).toBe(0);
    expect(changes.fresh).toBeGreaterThan(0);
  });

  test(`CPU ${THROTTLE} 倍の絞りで、クロスフェード中の fps を「描き続ける」と「止める」で比べる`, async () => {
    test.setTimeout(240_000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    try {
      // 慣らし(30fps 落としが入るならここで入れておく)
      await crossfadeFps(page, A, false);
      let to = B;
      for (let i = 0; i < RUNS; i++) {
        for (const mode of i % 2 ? ['stop', 'keep'] : ['keep', 'stop']) {
          const r = await crossfadeFps(page, to, mode === 'keep');
          results[mode].push(r);
          expect(r.stopped).toBe(mode === 'stop');
          to = to === A ? B : A;
          await page.waitForTimeout(1000);
        }
      }
    } finally {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
    for (const mode of ['keep', 'stop']) {
      for (const r of results[mode]) expect(r.fade).toBeGreaterThan(0);
    }
  });
});

test.afterAll(() => {
  if (results.keep.length < RUNS || results.stop.length < RUNS) return;
  const fmt = (rs, key) => `${median(rs.map((r) => r[key]))}(${rs.map((r) => r[key]).join(' / ')})`;
  const lines = [
    '',
    `CPU ${THROTTLE} 倍の絞り・3 枚 → 3 枚のクロスフェード(5 秒)の間のページの fps(中央値と ${RUNS} 回)`,
    '| | フェード全体 | 前半 | 後半 | フェードのあと(入った 3 枚だけ) |',
    '| --- | --- | --- | --- | --- |',
    ...[['keep', '描き続ける(今まで)'], ['stop', '20fps → 半分で止める']].map(([mode, label]) =>
      `| ${label} | ${fmt(results[mode], 'fade')} | ${fmt(results[mode], 'first')} | ${fmt(results[mode], 'second')} | ${fmt(results[mode], 'after')} |`),
    '',
  ];
  console.log(lines.join('\n'));
});
