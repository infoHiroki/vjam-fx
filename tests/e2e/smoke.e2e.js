/**
 * VJam FX 実機スモーク:Chromium に拡張を読み込み、実物の popup を操作してページ側のエンジンを確かめる。
 * jsdom では拡張の注入や MAIN world が再現できないので、ここで本番に近い形を見る。
 */
import { test, expect } from '@playwright/test';
import {
  startSite, launchWithExtension, openPopup, readState, tapAudio, isAudioPlaying, diffScore,
} from './helpers.js';

// スクショ差分(RGB 平均 0〜255)のしきい値。エフェクト無しのノイズは 0.004 前後(audio の時刻表示)。
// Next はランダムで、地味なプリセット(ceiling-drip / dust-motes)だと「見える」0.36〜、「動く」0.44〜しか出ない
const VISIBLE_DIFF = 0.1;  // ベースラインとの差がこれを超えたら「見えている」
const MOVING_DIFF = 0.05;  // 1 秒あけた 2 枚の差がこれを超えたら「動いている」

function collectLogs(page, tag, logs) {
  page.on('console', (m) => logs.push(`[${tag}:${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[${tag}:pageerror] ${e}`));
}

test.describe.serial('ダークページ → ライトページ遷移', () => {
  let site, ext, page, popup, baseline, afterNext;
  const logs = [];

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('console', { body: logs.join('\n'), contentType: 'text/plain' });
    }
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test('service worker が起動する', () => {
    expect(ext.sw.url()).toMatch(/^chrome-extension:\/\/[a-p]{32}\/background\/service-worker\.js$/);
  });

  test('テスト音声が鳴っている', async () => {
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    collectLogs(page, 'page', logs);
    await page.goto(`${site.base}/index.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);
    baseline = await page.screenshot();
  });

  test('popup が対象タブを掴む(Cannot run が出ない)', async () => {
    popup = await openPopup(ext, site.base);
    collectLogs(popup, 'popup', logs);
    await expect(popup.locator('#btn-next')).toBeVisible();
    await expect(popup.locator('.popup')).not.toContainText('Cannot run');
  });

  test('プリセット一覧ができる', async () => {
    await expect.poll(() => popup.locator('#preset-list input[name=preset]').count()).toBeGreaterThanOrEqual(150);
  });

  test('Next → エンジンが動いてレイヤーが乗る', async () => {
    await popup.click('#btn-next');
    await expect.poll(async () => {
      const s = await readState(page);
      return s.active && s.layers.length >= 1;
    }, { timeout: 15_000 }).toBe(true);
  });

  test('overlay の canvas が DOM にある', async () => {
    await expect.poll(async () => {
      const s = await readState(page);
      return s.overlay && s.canvases >= 1;
    }).toBe(true);
  });

  test('エフェクトが見える(ベースラインとの差)', async () => {
    await expect.poll(async () => {
      afterNext = await page.screenshot();
      return diffScore(baseline, afterNext);
    }, { timeout: 10_000 }).toBeGreaterThan(VISIBLE_DIFF);
  });

  test('アニメーションが動いている', async () => {
    await page.waitForTimeout(1000);
    expect(diffScore(afterNext, await page.screenshot())).toBeGreaterThan(MOVING_DIFF);
  });

  test('<audio> に analyser がつながる', async () => {
    await tapAudio(page);
    await expect.poll(async () => (await readState(page)).analyser).toBe(true);
  });

  test('音声データが流れる', async () => {
    await expect.poll(async () => {
      const vj = await page.evaluate(() => window.__vj);
      return vj.frames > 20 && vj.maxRms > 0.01;
    }, { timeout: 10_000 }).toBe(true);
  });

  test('拍を検出する', async () => {
    await expect.poll(() => page.evaluate(() => window.__vj.beats), { timeout: 10_000 }).toBeGreaterThanOrEqual(4);
  });

  test('フックした後もページの音声が鳴り続ける', async () => {
    expect(await isAudioPlaying(page)).toBe(true);
  });

  test('blend ボタンが効く', async () => {
    await popup.locator('#blend-grid button[data-blend="difference"]').click();
    await expect.poll(async () => (await readState(page)).overlayBlend).toBe('difference');
    expect((await readState(page)).blend).toBe('difference');
  });

  test('filter ボタンが効く', async () => {
    await popup.locator('#filter-grid button[data-filter="invert"]').click();
    await expect.poll(async () => (await readState(page)).filters).toContain('invert');
    expect((await readState(page)).overlayFilter).toContain('invert(1)');
  });

  test('不透明度スライダーが効く', async () => {
    await popup.locator('#opacity-slider').fill('40');
    await expect.poll(async () => (await readState(page)).opacity).toBeCloseTo(0.4, 2);
  });

  test('Auto でプリセットが入れ替わる', async () => {
    const layersNow = async () => (await readState(page)).layers.join(',');
    const before = await layersNow();
    await popup.click('#btn-auto-cycle');
    // 押した直後に 1 回入れ替わり、その後はタイマー(BPM 連動、4〜15 秒)で入れ替わる
    let first;
    await expect.poll(async () => (first = await layersNow()), { timeout: 15_000 }).not.toBe(before);
    await expect.poll(layersNow, { timeout: 20_000 }).not.toBe(first);
  });

  test('ページ遷移の後に状態が戻る', async () => {
    await page.goto(`${site.base}/page2.html`);
    await expect.poll(async () => {
      const s = await readState(page);
      return s.active && s.overlay && s.layers.length >= 1;
    }, { timeout: 15_000 }).toBe(true);
  });

  test('ライトページを判定する', async () => {
    expect((await readState(page)).isLight).toBe(true);
  });

  test('Reset でレイヤーとフィルタが消える', async () => {
    await popup.close();
    popup = await openPopup(ext, site.base);
    collectLogs(popup, 'popup', logs);
    await popup.click('#btn-reset');
    await expect.poll(async () => {
      const s = await readState(page);
      return s.layers.length + s.filters.length;
    }).toBe(0);
  });

  test('Reset の後の Next も動く', async () => {
    await popup.click('#btn-next');
    await expect.poll(async () => {
      const s = await readState(page);
      return s.active && s.layers.length >= 1;
    }, { timeout: 15_000 }).toBe(true);
    await expect(popup.locator('#toggle')).toBeChecked();
  });

  test('トグル OFF でエンジンが止まる', async () => {
    await popup.click('.toggle-switch');
    await expect.poll(async () => {
      const s = await readState(page);
      return !s.active || !s.overlay;
    }).toBe(true);
  });

  test('トグル ON で再開する', async () => {
    await popup.click('.toggle-switch');
    await expect.poll(async () => {
      const s = await readState(page);
      return s.active && s.overlay;
    }, { timeout: 15_000 }).toBe(true);
  });
});

test.describe.serial('背景未指定のライトページ', () => {
  let site, ext;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test('Next でエフェクトが見える(ベースラインとの差)', async () => {
    const page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.goto(`${site.base}/page3.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);
    const baseline = await page.screenshot();

    const popup = await openPopup(ext, site.base);
    await popup.click('#btn-next');
    await expect.poll(async () => {
      const s = await readState(page);
      return s.active && s.canvases >= 1;
    }, { timeout: 15_000 }).toBe(true);
    expect((await readState(page)).isLight).toBe(true);

    await expect.poll(async () => diffScore(baseline, await page.screenshot()), { timeout: 10_000 })
      .toBeGreaterThan(VISIBLE_DIFF);
  });
});
