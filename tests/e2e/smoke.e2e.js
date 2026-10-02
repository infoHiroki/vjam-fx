/**
 * VJam FX 実機スモーク:Chromium に拡張を読み込み、実物の popup を操作してページ側のエンジンを確かめる。
 * jsdom では拡張の注入や MAIN world が再現できないので、ここで本番に近い形を見る。
 */
import { test, expect } from '@playwright/test';
import {
  startSite, launchWithExtension, openPopup, openManual, readState, readCanvases, waitLayersFadedIn, tapAudio, isAudioPlaying, diffScore,
} from './helpers.js';

// スクショ差分(RGB 平均 0〜255)のしきい値。エフェクト無しのノイズは 0.004 前後(audio の時刻表示)。
// Next はランダムで、地味なプリセット(ceiling-drip / dust-motes)だと「見える」0.36〜、「動く」0.44〜しか出ない
const VISIBLE_DIFF = 0.1;  // ベースラインとの差がこれを超えたら「見えている」
const MOVING_DIFF = 0.05;  // 1 秒あけた 2 枚の差がこれを超えたら「動いている」
const SAME_DIFF = 0.01;    // 止めた絵の 2 枚の差がこれ未満なら「同じ見え方」
const VIEWPORT = { width: 1280, height: 800 }; // launchWithExtension の viewport

// スクショの平均の明るさ(輝度 0〜255)。PNG のデコードはページの中で行う
function meanLuma(page, png) {
  return page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return sum / (d.length / 4);
  }, png.toString('base64'));
}

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

  test('popup が対象タブを掴む(重ねられないページの表示が出ない)', async () => {
    popup = await openPopup(ext, site.base);
    collectLogs(popup, 'popup', logs);
    await expect(popup.locator('#btn-next')).toBeVisible();
    await expect(popup.locator('#blocked')).toBeHidden();
    await expect(popup.locator('.popup')).not.toHaveClass(/\bis-blocked\b/);
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

  test('overlay の canvas が shadow root の中にある', async () => {
    await expect.poll(async () => {
      const s = await readState(page);
      return s.overlay && s.shadow && s.lightChildren === 0 && s.canvases >= 1;
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
    await openManual(popup);
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
    await openManual(popup);
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
  let site, ext, page, popup, baseline;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test('Next でエフェクトが見える(ベースラインとの差)', async () => {
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.goto(`${site.base}/page3.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);
    baseline = await page.screenshot();

    popup = await openPopup(ext, site.base);
    await popup.click('#btn-next');
    await expect.poll(async () => {
      const s = await readState(page);
      return s.active && s.canvases >= 1;
    }, { timeout: 15_000 }).toBe(true);
    expect((await readState(page)).isLight).toBe(true);

    await expect.poll(async () => diffScore(baseline, await page.screenshot()), { timeout: 10_000 })
      .toBeGreaterThan(VISIBLE_DIFF);
  });

  // 背景が透明だと mix-blend-mode の相手が無く、黒いキャンバスがそのまま覆う(#13)。
  // Next はランダムで透けるプリセットだと見逃すので、背景を黒で塗りつぶす radar で確かめる
  test('黒に潰れない(本文が読める明るさが残る)', async () => {
    await openManual(popup);
    await popup.click('#btn-reset');
    await expect.poll(async () => (await readState(page)).layers.length).toBe(0);
    await popup.locator('#preset-list input[value="radar"]').check();
    await expect.poll(async () => (await readState(page)).layers, { timeout: 15_000 }).toEqual(['radar']);
    // フェードイン(1.5 秒)が終わってから測る
    await waitLayersFadedIn(page);
    expect((await readState(page)).isLight).toBe(true);
    // 覆われると 0.2 倍前後まで落ちる。合成できていればほぼベースラインのまま
    expect(await meanLuma(page, await page.screenshot())).toBeGreaterThan(await meanLuma(page, baseline) * 0.5);
  });
});

// 動画サイトの「フルサイズ」表示は、プレイヤー以外の要素を全部 x = -100000 へ飛ばす CSS を入れる。
// overlay の中身は Shadow DOM に入れてあるので巻き込まれない(#26)
test.describe.serial('ページの要素をまとめて画面の外へ飛ばす CSS', () => {
  let site, ext, page, popup, baseline;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test('テストページの CSS がページの要素を画面の外へ飛ばしている', async () => {
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.goto(`${site.base}/fullsize.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);
    expect(await page.evaluate(() => document.getElementById('flung').getBoundingClientRect().right)).toBeLessThan(0);
    baseline = await page.screenshot();
  });

  test('Next でエフェクトが画面の中に描かれる', async () => {
    popup = await openPopup(ext, site.base);
    await popup.click('#btn-next');
    await expect.poll(async () => {
      const s = await readState(page);
      return s.active && s.shadow && s.canvases >= 1;
    }, { timeout: 15_000 }).toBe(true);
    await waitLayersFadedIn(page);

    const canvases = await readCanvases(page);
    expect(canvases.length).toBeGreaterThanOrEqual(1);
    for (const c of canvases) {
      expect(c.visibility).toBe('visible');
      expect(c.right - c.left).toBeGreaterThan(0);
      expect(c.left).toBeGreaterThanOrEqual(-1);
      expect(c.top).toBeGreaterThanOrEqual(-1);
      expect(c.right).toBeLessThanOrEqual(VIEWPORT.width + 1);
      expect(c.bottom).toBeLessThanOrEqual(VIEWPORT.height + 1);
    }
    await expect.poll(async () => diffScore(baseline, await page.screenshot()), { timeout: 10_000 })
      .toBeGreaterThan(VISIBLE_DIFF);
  });
});

// p5 が setup 中に隠したキャンバスは、shadow root の中だと p5 が戻さないのでエンジンが戻す。
// <style> 要素を使うと CSP の厳しいページで止まって何も見えなくなるので、そのページでも見えることを確かめる
test.describe.serial('CSP が厳しいページ', () => {
  let site, ext, page, popup, baseline;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test('Next でエフェクトが見える', async () => {
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.goto(`${site.base}/csp.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);
    baseline = await page.screenshot();

    popup = await openPopup(ext, site.base);
    await popup.click('#btn-next');
    await expect.poll(async () => {
      const s = await readState(page);
      return s.active && s.shadow && s.canvases >= 1;
    }, { timeout: 15_000 }).toBe(true);
    await waitLayersFadedIn(page);

    const canvases = await readCanvases(page);
    expect(canvases.length).toBeGreaterThanOrEqual(1);
    for (const c of canvases) expect(c.visibility).toBe('visible');
    await expect.poll(async () => diffScore(baseline, await page.screenshot()), { timeout: 10_000 })
      .toBeGreaterThan(VISIBLE_DIFF);
  });
});

// Shadow DOM に入れても、ホストと各キャンバスの mix-blend-mode の効き方は前(ホストの直下にレイヤー)と同じ
test.describe.serial('ブレンドの見た目', () => {
  let site, ext, page, popup;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test('shadow root の中と、前の作りに組み替えたものが同じ絵になる', async () => {
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.goto(`${site.base}/index.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);

    // 不透明な背景を塗るプリセットを 2 枚重ねて、キャンバス同士・ページとの両方で difference が効く状態にする
    popup = await openPopup(ext, site.base);
    await openManual(popup);
    await popup.locator('#preset-list input[value="radar"]').check();
    await expect.poll(async () => (await readState(page)).layers, { timeout: 15_000 }).toEqual(['radar']);
    await popup.locator('#preset-list input[value="neon-tunnel"]').check();
    await expect.poll(async () => (await readState(page)).layers, { timeout: 15_000 }).toEqual(['radar', 'neon-tunnel']);
    await popup.locator('#blend-grid button[data-blend="difference"]').click();
    await expect.poll(async () => (await readState(page)).overlayBlend).toBe('difference');
    await waitLayersFadedIn(page);

    // 絵を止める(p5 の描画と audio の時刻表示)
    await page.evaluate(() => {
      for (const [, layer] of window._vjamFxEngine.activeLayers) layer.preset.p5.noLoop();
      document.getElementById('a').pause();
    });
    await page.waitForTimeout(300);

    expect(await page.evaluate(() => getComputedStyle(window._vjamFxEngine.overlay).mixBlendMode)).toBe('difference');
    const canvases = await readCanvases(page);
    expect(canvases.length).toBe(2);
    for (const c of canvases) {
      expect(c.visibility).toBe('visible');
      expect(c.blend).toBe('difference');
    }

    const inShadow = await page.screenshot();
    expect(diffScore(inShadow, await page.screenshot())).toBeLessThan(SAME_DIFF);

    // 同じキャンバスを、前の作り(ホストの div の直下にレイヤーの div。Shadow DOM なし)に組み替える
    await page.evaluate(() => {
      const e = window._vjamFxEngine;
      const flat = document.createElement('div');
      flat.style.cssText = e.overlay.style.cssText;
      flat.append(...e._stage.children);
      e.overlay.replaceWith(flat);
      window.__vjFlat = flat;
    });
    await page.waitForTimeout(300);
    const flat = await page.screenshot();
    expect(diffScore(inShadow, flat)).toBeLessThan(SAME_DIFF);

    // この比べ方でブレンドの違いが拾えることの確認:キャンバス同士の blend を外しても、ホストの blend を外しても絵が変わる
    await page.evaluate(() => {
      window.__vjFlat.querySelectorAll('canvas').forEach((c) => { c.style.mixBlendMode = 'normal'; });
    });
    await page.waitForTimeout(300);
    expect(diffScore(flat, await page.screenshot())).toBeGreaterThan(VISIBLE_DIFF);
    await page.evaluate(() => { window.__vjFlat.style.mixBlendMode = 'normal'; });
    await page.waitForTimeout(300);
    expect(diffScore(flat, await page.screenshot())).toBeGreaterThan(VISIBLE_DIFF);
  });
});
