/**
 * Auto のエフェクト・フェードを長く(#58)を、実物の Chromium + 拡張で確かめる。
 * - 前の既定(フェード 1.5 秒・16 拍)のまま保存されていた設定は、popup を開くとフェード 5 秒・Cycle 15 秒になる
 * - トグル ON でエンジンに届くのは秒数(Auto 15 秒・フェード 5 秒)。Cycle を 8 秒にすると、フェードは半分の 4 秒・dip は 1 秒
 * - 切り替えは秒数がたった後の拍(テストの音は 120 BPM のキック。待つのは最大 1 秒)
 * - ページ遷移の後も同じ秒数で回る(SW)
 */
import { test, expect } from '@playwright/test';
import { startSite, launchWithExtension, openPopup, isAudioPlaying } from './helpers.js';

const OLD_SETTINGS = { autoOnStart: true, allTabs: false, fadeDuration: 1.5, barsPerCycle: 16, sensitivity: 'mid' };

// エンジンに届いている秒数
function readTiming(page) {
  return page.evaluate(() => {
    const e = window._vjamFxEngine;
    return e ? { cycle: e._autoCycleInterval, fade: e._fadeDuration, dip: e._dipMs(), cycling: !!e._autoCycleTimer } : null;
  });
}

test.describe.serial('Auto の切り替え・フェードを秒で(#58)', () => {
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

  test('前の既定のまま保存されていた設定は、フェード 5 秒・Cycle 15 秒で開く', async () => {
    await ext.sw.evaluate((saved) => chrome.storage.local.set({ vjamfx_settings: saved }), OLD_SETTINGS);
    popup = await openPopup(ext, site.base);
    await popup.click('#btn-settings');
    await expect(popup.locator('#setting-fade')).toHaveValue('5');
    await expect(popup.locator('#setting-cycle')).toHaveValue('15');
    expect(await popup.locator('#setting-cycle option').allTextContents()).toEqual(['8s', '15s', '30s', '60s']);
    expect(await popup.locator('#setting-fade option').allTextContents()).toEqual(['0s', '3s', '5s', '8s', '12s']);
  });

  test('トグル ON: エンジンは Auto 15 秒・フェード 5 秒・dip 1.25 秒', async () => {
    await popup.click('.toggle-switch');
    await expect.poll(() => readTiming(page), { timeout: 20_000 }).toEqual({ cycle: 15000, fade: 5, dip: 1250, cycling: true });
  });

  test('Cycle 8 秒: フェードは半分の 4 秒になり、設定は版つきで保存(昔の拍数は消える)', async () => {
    await popup.selectOption('#setting-cycle', '8');
    await expect.poll(() => readTiming(page)).toEqual({ cycle: 8000, fade: 4, dip: 1000, cycling: true });
    const saved = await ext.sw.evaluate(() => chrome.storage.local.get('vjamfx_settings').then((r) => r.vjamfx_settings));
    expect(saved).toMatchObject({ version: 2, fadeDuration: 5, cycleSeconds: 8 });
    expect(saved).not.toHaveProperty('barsPerCycle');
  });

  test('切り替えは 8 秒たった後の拍(待つのは最大 1 秒)', async () => {
    test.setTimeout(60_000);
    // 張り直した時刻から切り替えまでの長さと、拍で切り替えたかを記録する
    await page.evaluate(() => {
      const e = window._vjamFxEngine;
      const rec = window.__vjSwitch = { scheduledAt: 0, switches: [] };
      let inBeat = false;
      const onBeat = e._onBeat.bind(e);
      e._onBeat = () => {
        inBeat = true;
        try { onBeat(); } finally { inBeat = false; }
      };
      const schedule = e._scheduleAutoCycle.bind(e);
      e._scheduleAutoCycle = () => {
        rec.scheduledAt = performance.now();
        schedule();
      };
      const sw = e._autoSwitch.bind(e);
      e._autoSwitch = () => {
        if (rec.scheduledAt) rec.switches.push({ ms: performance.now() - rec.scheduledAt, beat: inBeat });
        rec.scheduledAt = 0;
        sw();
      };
      e._scheduleAutoCycle(); // ここから数える
    });
    await expect.poll(() => page.evaluate(() => window.__vjSwitch.switches.length), { timeout: 40_000, intervals: [500] })
      .toBeGreaterThanOrEqual(2);
    const { switches } = await page.evaluate(() => window.__vjSwitch);
    for (const s of switches) {
      expect(s.ms).toBeGreaterThanOrEqual(8000 - 50);
      expect(s.ms).toBeLessThan(9000 + 200);
    }
    // 120 BPM(0.5 秒おき)の音なので、1 秒待つ前に拍が来る
    expect(switches.some((s) => s.beat)).toBe(true);
  });

  test('ページ遷移の後も同じ秒数で回る(SW)', async () => {
    await page.goto(`${site.base}/page2.html`);
    await expect.poll(() => readTiming(page), { timeout: 20_000 }).toEqual({ cycle: 8000, fade: 4, dip: 1000, cycling: true });
  });
});
