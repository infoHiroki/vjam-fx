/**
 * 全タブで ON(#30)。設定を ON にしてトグル ON → 2 つ目のタブを開いて切り替えると、そこでも同じ状態でエンジンが動く。
 * 裏に回ったタブは止まり(ページの音は鳴り続ける)、戻ると入れ直す。トグル OFF で全部止まり、設定 OFF なら今のタブだけそのまま
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { startSite, launchWithExtension, openPopup, readState, readAuto, tapAudio, isAudioPlaying } from './helpers.js';

const POOL = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../content/default-pool.json'), 'utf8')).presets;

// SW が持っている、ほかのタブへ持っていく状態
function allTabsState(ext) {
  return ext.sw.evaluate(() => chrome.storage.session.get('allTabsState').then((r) => r.allTabsState || null));
}

// SW が tabCapture を使ったタブを self.__vjCaptures に貯める
function spyTabCapture(ext) {
  return ext.sw.evaluate(() => {
    self.__vjCaptures = [];
    const orig = chrome.tabCapture.getMediaStreamId.bind(chrome.tabCapture);
    chrome.tabCapture.getMediaStreamId = (opts) => {
      self.__vjCaptures.push(opts.targetTabId);
      return orig(opts);
    };
  });
}

const running = async (page) => {
  const s = await readState(page);
  return s.active && s.overlay && s.canvases >= 1;
};

const stopped = async (page) => {
  const s = await readState(page);
  return s.engine && !s.active && !s.overlay && s.layers.length === 0;
};

test.describe.serial('全タブで ON', () => {
  let site, ext, page1, page2, page3, popup;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test('設定の All tabs は既定で OFF。押すと許可を求めて ON になり、保存される', async () => {
    page1 = ext.context.pages()[0] ?? await ext.context.newPage();
    await page1.goto(`${site.base}/index.html`);
    await expect.poll(() => isAudioPlaying(page1)).toBe(true);

    popup = await openPopup(ext, `${site.base}/index.html`);
    await popup.click('#btn-settings');
    await expect(popup.locator('#setting-all-tabs')).toHaveText('OFF');
    await popup.click('#setting-all-tabs');
    await expect(popup.locator('#setting-all-tabs')).toHaveText('ON');
    await expect(popup.locator('#setting-all-tabs')).toHaveClass(/\bon\b/);
    expect(await ext.sw.evaluate(() => chrome.storage.local.get('vjamfx_settings').then((r) => r.vjamfx_settings.allTabs))).toBe(true);
    expect(await ext.sw.evaluate(() => chrome.permissions.contains({ origins: ['<all_urls>'] }))).toBe(true);
  });

  test('トグル ON → 1 つ目のタブで動き、その状態を SW が持つ', async () => {
    await popup.click('.toggle-switch');
    await expect.poll(() => running(page1), { timeout: 15_000 }).toBe(true);
    // popup の起動処理の最後(Auto を始めた後)の状態まで待つ
    await expect.poll(async () => {
      const s = await allTabsState(ext);
      return !!(s && s.active && s.autoCyclePresets && s.autoBlend && s.autoFilters);
    }, { timeout: 20_000 }).toBe(true);
  });

  test('2 つ目のタブを開いて切り替えると、そこでもエンジンが同じ状態で動く', async () => {
    await spyTabCapture(ext);
    page2 = await ext.context.newPage();
    await page2.goto(`${site.base}/page2.html`);
    await page2.bringToFront();
    await expect.poll(() => running(page2), { timeout: 15_000 }).toBe(true);

    const state = await allTabsState(ext);
    // Auto・Blend Rnd・Filter Rnd(プール付き)と不透明度
    await expect.poll(() => readAuto(page2), { timeout: 10_000 }).toMatchObject({
      cycling: true, presets: POOL.length, pool: true, blend: true, filters: true,
    });
    expect((await readState(page2)).opacity).toBe(state.opacity);
    const ids = await page2.evaluate(() => [...window._vjamFxEngine.activeLayers.keys()]);
    for (const id of ids) expect(POOL).toContain(id);
  });

  test('2 つ目のタブの音は <audio> から取る(tabCapture は使わない)', async () => {
    await expect.poll(() => isAudioPlaying(page2)).toBe(true);
    await expect.poll(async () => (await readState(page2)).analyser, { timeout: 10_000 }).toBe(true);
    await tapAudio(page2);
    await expect.poll(() => page2.evaluate(() => window.__vj.frames > 0 && window.__vj.maxRms > 0), { timeout: 10_000 }).toBe(true);
    expect(await ext.sw.evaluate(() => self.__vjCaptures)).toEqual([]);
  });

  test('裏に回った 1 つ目のタブは止まる(ページの音は鳴り続ける)', async () => {
    await expect.poll(() => stopped(page1), { timeout: 10_000 }).toBe(true);
    expect(await isAudioPlaying(page1)).toBe(true);
    const t = await page1.evaluate(() => document.getElementById('a').currentTime);
    await expect.poll(() => page1.evaluate(() => document.getElementById('a').currentTime)).toBeGreaterThan(t);
  });

  test('1 つ目のタブに戻ると入れ直し、2 つ目は止まる', async () => {
    await page1.bringToFront();
    await expect.poll(() => running(page1), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => readAuto(page1), { timeout: 10_000 }).toMatchObject({ cycling: true, blend: true, filters: true });
    await expect.poll(() => stopped(page2), { timeout: 10_000 }).toBe(true);
  });

  test('トグル OFF → 全部止まり、タブを切り替えても入らない', async () => {
    await popup.click('.toggle-switch');
    await expect.poll(() => stopped(page1), { timeout: 10_000 }).toBe(true);
    await expect.poll(() => allTabsState(ext)).toBeNull();

    await page2.bringToFront();
    await page2.waitForTimeout(2000);
    expect(await stopped(page2)).toBe(true);
    expect(await stopped(page1)).toBe(true);
  });

  test('設定を OFF にすると、今のタブはそのままで、ほかのタブには入らない', async () => {
    // 2 つ目のタブで ON にし直してから、設定を OFF にする
    await popup.close();
    popup = await openPopup(ext, `${site.base}/page2.html`);
    await popup.click('.toggle-switch');
    await expect.poll(() => running(page2), { timeout: 15_000 }).toBe(true);
    await expect.poll(async () => !!(await allTabsState(ext)), { timeout: 20_000 }).toBe(true);
    await popup.click('#btn-settings');
    await popup.click('#setting-all-tabs');
    await expect(popup.locator('#setting-all-tabs')).toHaveText('OFF');

    page3 = await ext.context.newPage();
    await page3.goto(`${site.base}/page3.html`);
    await page3.bringToFront();
    await page3.waitForTimeout(3000);
    expect((await readState(page3)).engine).toBe(false);
    expect(await running(page2)).toBe(true);
    // 1 つ目に戻っても入らない
    await page1.bringToFront();
    await page1.waitForTimeout(2000);
    expect(await stopped(page1)).toBe(true);
  });
});
