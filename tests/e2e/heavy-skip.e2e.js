/**
 * 重いプリセットを端末ごとに見つけて飛ばす(#40)を、実物の Chromium + 拡張で確かめる。
 * テスト用の拡張のコピーで、プールを 3 本にし、そのうち film-grain を「draw の中で 60ms 回す」わざと重いものに差し替える
 * (radar / sonar-ping は軽いものに差し替え)。
 * - Auto を回して film-grain が出ると、フェードイン + 2 秒 + 3 秒で飛ばされる。外したあと fps が戻った(本当に軽くなった)のを
 *   確かめてから、SW が storage.local の heavyPresets に入れる
 * - 次の Next では選ばれない(popup はプールから除いて渡す)。popup の設定パネルに数が出て、Restore で戻る
 * - Next 直後の重いレイヤーも飛ばす。入れ替え先がまだ読み込まれていなければ、SW が読み込んでから入る
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { startSite, launchWithExtension, openPopup, readState, readAuto, isAudioPlaying } from './helpers.js';

const HEAVY = 'film-grain';
const LIGHT = ['radar', 'sonar-ping'];
const REAL_POOL = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../content/default-pool.json'), 'utf8'));

// わざと重いプリセット: draw の中で 60ms 回す(rAF は 16fps くらいまで落ちる)
const HEAVY_PRESET = `(function() {
  'use strict';
  class HeavyTestPreset extends window.VJamFX.BasePreset {
    setup(container) {
      this.destroy();
      this.p5 = new p5((p) => {
        p.setup = () => { p.createCanvas(container.clientWidth, container.clientHeight); };
        p.draw = () => {
          const end = performance.now() + 60;
          while (performance.now() < end) { /* busy */ }
          p.clear();
          p.noStroke();
          p.fill(255, 60, 60);
          p.circle(p.width / 2, p.height / 2, 120);
        };
      }, container);
    }
  }
  window.VJamFX.presets[${JSON.stringify(HEAVY)}] = HeavyTestPreset;
})();`;

// 軽いプリセット: 円を 1 つ動かすだけ
const lightPreset = (name) => `(function() {
  'use strict';
  class LightTestPreset extends window.VJamFX.BasePreset {
    setup(container) {
      this.destroy();
      this.p5 = new p5((p) => {
        p.setup = () => { p.createCanvas(container.clientWidth, container.clientHeight); };
        p.draw = () => {
          p.clear();
          p.noStroke();
          p.fill(60, 200, 255);
          p.circle((p.frameCount * 4) % p.width, p.height / 3, 80);
        };
      }, container);
    }
  }
  window.VJamFX.presets[${JSON.stringify(name)}] = LightTestPreset;
})();`;

const FILES = {
  'content/default-pool.json': JSON.stringify({ ...REAL_POOL, presets: [HEAVY, ...LIGHT] }),
  [`content/presets/${HEAVY}.js`]: HEAVY_PRESET,
  ...Object.fromEntries(LIGHT.map((name) => [`content/presets/${name}.js`, lightPreset(name)])),
};

// SW が覚えたもの
function heavyPresets(ext) {
  return ext.sw.evaluate(() => chrome.storage.local.get('heavyPresets').then((r) => r.heavyPresets || null));
}

const layersOf = async (page) => (await readState(page)).layers;

// ページに残っているレイヤーの div(フェードアウト中も含む)
function layerDivs(page, name) {
  return page.evaluate((n) => {
    const e = window._vjamFxEngine;
    const root = e && e.overlay && e.overlay.shadowRoot;
    return root ? root.querySelectorAll(`[data-vjam-layer="${n}"]`).length : 0;
  }, name);
}

test.describe.serial('重いプリセットを飛ばす(#40)', () => {
  let site, ext, page, popup;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless, files: FILES });
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test('トグル ON で Auto を回し、わざと重いプリセットが出るまで選び直す', async () => {
    test.setTimeout(120_000);
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.goto(`${site.base}/index.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);

    popup = await openPopup(ext, `${site.base}/index.html`);
    expect(await heavyPresets(ext)).toBeNull();
    // 切り替えを 32 拍(120 BPM で 16 秒)にして、重さを測る間(フェード 1.5 + 2 + 3 秒)に入れ替わらないようにする
    await popup.click('#btn-settings');
    await expect(popup.locator('#heavy-count')).toHaveText('0');
    await expect(popup.locator('#btn-heavy-reset')).toBeDisabled();
    await popup.selectOption('#setting-cycle', '32');
    await popup.click('.toggle-switch');
    await expect.poll(() => readAuto(page), { timeout: 20_000 }).toMatchObject({ cycling: true, presets: 3 });

    // 出ていなければ Auto を入れ直す(ON にした瞬間に選び直す)
    for (let i = 0; i < 10 && !(await layersOf(page)).includes(HEAVY); i++) {
      await popup.click('#btn-auto-cycle');
      await expect.poll(() => readAuto(page)).toMatchObject({ cycling: false });
      await popup.click('#btn-auto-cycle');
      await expect.poll(() => readAuto(page), { timeout: 20_000 }).toMatchObject({ cycling: true });
    }
    expect(await layersOf(page)).toContain(HEAVY);
  });

  test('3 秒続けて 24fps を割ると飛ばされ、軽くなったのを確かめてから SW が heavyPresets に入れる', async () => {
    test.setTimeout(60_000);
    // 足してから: フェードイン 1.5 秒 + 2 秒待って + 3 秒で外す
    await expect.poll(() => layersOf(page), { timeout: 20_000, intervals: [200] }).not.toContain(HEAVY);
    // 外しただけではまだ覚えない(外したあと: フェードアウト 1.5 秒 + 2 秒待って + 3 秒の fps で決める)
    expect(await heavyPresets(ext)).toBeNull();
    await expect.poll(() => heavyPresets(ext), { timeout: 15_000, intervals: [500] }).not.toBeNull();
    const heavy = await heavyPresets(ext);
    expect(Object.keys(heavy)).toEqual([HEAVY]);
    expect(heavy[HEAVY].fps).toBeGreaterThan(0);
    expect(heavy[HEAVY].fps).toBeLessThan(24);
    expect(Date.now() - Date.parse(heavy[HEAVY].at)).toBeLessThan(60_000);

    // エンジンからは外れ、フェードアウトしてから消える。ほかの(または入れ替えた)軽いものが出ている
    const layers = await layersOf(page);
    expect(layers).not.toContain(HEAVY);
    expect(layers.length).toBeGreaterThanOrEqual(1);
    for (const name of layers) expect(LIGHT).toContain(name);
    await expect.poll(() => layerDivs(page, HEAVY), { timeout: 5_000 }).toBe(0);
    expect(await page.evaluate((n) => window._vjamFxEngine._heavyPresets.has(n), HEAVY)).toBe(true);
    // Auto は回り続ける
    expect(await readAuto(page)).toMatchObject({ cycling: true });

    // 開いている popup にも出る(storage.onChanged)
    await expect(popup.locator('#heavy-count')).toHaveText('1');
    await expect(popup.locator('#btn-heavy-reset')).toBeEnabled();
  });

  test('次の Next では選ばれない(入れ替え先のプールにも入らない)', async () => {
    test.setTimeout(60_000);
    // Next がエンジンに渡したものを記録する
    await page.evaluate(() => {
      const e = window._vjamFxEngine;
      window.__vjNext = [];
      const crossfade = e.crossfade.bind(e);
      e.crossfade = (names, options) => {
        window.__vjNext.push({ names, pool: options && options.poolPresets });
        return crossfade(names, options);
      };
    });
    for (let i = 1; i <= 5; i++) {
      await popup.click('#btn-next');
      await expect.poll(() => page.evaluate(() => window.__vjNext.length), { timeout: 10_000 }).toBe(i);
      await page.waitForTimeout(800); // popup の Next の残り(音・状態の保存)が終わるのを待つ
    }
    const nexts = await page.evaluate(() => window.__vjNext);
    for (const { names, pool } of nexts) {
      expect(names.length).toBeGreaterThanOrEqual(1);
      for (const name of names) expect(LIGHT).toContain(name);
      expect([...pool].sort()).toEqual([...LIGHT].sort());
    }
    expect(await layersOf(page)).not.toContain(HEAVY);
  });

  test('popup を開き直すと数が出て、Restore で全部戻る', async () => {
    await popup.close();
    popup = await openPopup(ext, `${site.base}/index.html`);
    await popup.click('#btn-settings');
    await expect(popup.locator('#heavy-count')).toHaveText('1');
    await popup.click('#btn-heavy-reset');
    await expect(popup.locator('#heavy-count')).toHaveText('0');
    await expect(popup.locator('#btn-heavy-reset')).toBeDisabled();
    await expect.poll(() => heavyPresets(ext)).toBeNull();
    await expect.poll(() => page.evaluate(() => window._vjamFxEngine._heavyPresets.size)).toBe(0);
  });

  test('Next 直後の重いレイヤーも飛ばす。入れ替え先がまだ読み込まれていなければ SW が読み込む', async () => {
    test.setTimeout(60_000);
    // 新しいタブ: Next で選んだものしか読み込まれない
    const page2 = await ext.context.newPage();
    await page2.goto(`${site.base}/page2.html`);
    await page2.bringToFront();
    await expect.poll(() => isAudioPlaying(page2)).toBe(true);
    const popup2 = await openPopup(ext, `${site.base}/page2.html`);
    // Next の抽選を決める: 1 本(1 回目の乱数 0)、並べ替えなし(以降 0.999)= プールの先頭の film-grain
    await popup2.evaluate(() => {
      let n = 0;
      Math.random = () => (n++ === 0 ? 0 : 0.999);
    });
    await popup2.click('#btn-next');
    await expect.poll(() => layersOf(page2), { timeout: 15_000 }).toEqual([HEAVY]);
    const loaded = await page2.evaluate((names) => names.filter((n) => window.VJamFX.presets[n]), LIGHT);
    expect(loaded).toEqual([]);

    await expect.poll(() => heavyPresets(ext), { timeout: 30_000, intervals: [500] }).not.toBeNull();
    expect(Object.keys(await heavyPresets(ext))).toEqual([HEAVY]);
    // 入れ替え先は SW が読み込んでから入る
    await expect.poll(() => layersOf(page2), { timeout: 5_000 }).toHaveLength(1);
    const [replacement] = await layersOf(page2);
    expect(LIGHT).toContain(replacement);
    expect(await page2.evaluate((n) => !!window.VJamFX.presets[n], replacement)).toBe(true);
    await expect.poll(() => layerDivs(page2, HEAVY), { timeout: 5_000 }).toBe(0);
    await popup2.close();
  });
});
