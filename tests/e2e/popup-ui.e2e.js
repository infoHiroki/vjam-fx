/**
 * popup の作り直し(#47):Auto が主役。実物の popup で、ステージ(AUTO / MANUAL / OFF・BPM・レイヤー名)、
 * 手動の開け閉め(次に開いたときも同じ)、重ねられないページの表示を見る。幅は 280px からはみ出さない
 */
import { test, expect } from '@playwright/test';
import { startSite, launchWithExtension, openPopup, readState, isAudioPlaying } from './helpers.js';

const POPUP_WIDTH = 280;

// popup の中身が横にはみ出していない
const fitsWidth = (popup) => popup.evaluate(() => document.body.scrollWidth);

test.describe.serial('popup の画面(#47)', () => {
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

  test('OFF:ステージは OFF と始め方のひとこと。手動は畳んである', async () => {
    popup = await openPopup(ext, site.base);
    await expect(popup.locator('.header img.logo')).toBeVisible();
    await expect(popup.locator('#stage-mode')).toHaveText('OFF');
    await expect(popup.locator('#off-hint')).toBeVisible();
    await expect(popup.locator('#off-hint')).toContainText('Auto');
    await expect(popup.locator('#stage-bpm')).toBeHidden();
    await expect(popup.locator('#btn-next')).toBeVisible();
    await expect(popup.locator('#btn-auto-cycle .label')).toHaveText('Auto');
    await expect(popup.locator('#manual-section')).toBeHidden();
    await expect(popup.locator('#heavy-skipped')).toBeHidden(); // 0 本のときは出さない
    await expect(popup.locator('#vjam-link')).toBeVisible();
    expect(await fitsWidth(popup)).toBeLessThanOrEqual(POPUP_WIDTH);
  });

  test('ON:AUTO と、エンジンで出ているレイヤーの名前・BPM・脈打つ点', async () => {
    await popup.click('.toggle-switch');
    await expect(popup.locator('#stage-mode')).toHaveText('AUTO');
    await expect(popup.locator('#btn-auto-cycle .label')).toHaveText('Stop Auto');
    await expect(popup.locator('#off-hint')).toBeHidden();
    await expect.poll(async () => (await readState(page)).layers.length, { timeout: 15_000 }).toBeGreaterThan(0);
    // 名前はエンジンから読み直す(Auto が入れ替えても追いつく)
    await expect.poll(async () => {
      const shown = await popup.locator('#layer-names li').count();
      return shown > 0 && shown === Math.min((await readState(page)).layers.length, 5);
    }, { timeout: 10_000 }).toBe(true);
    // テストの音は 120 BPM のキック。拍を拾ったら出る
    await expect(popup.locator('#stage-bpm')).toHaveText(/^\d+ BPM$/, { timeout: 20_000 });
    const bpm = parseInt(await popup.locator('#stage-bpm').textContent(), 10);
    expect(bpm).toBeGreaterThanOrEqual(60);
    expect(bpm).toBeLessThanOrEqual(180);
    const beat = await popup.locator('#stage-beat').evaluate((el) => ({
      name: getComputedStyle(el).animationName, duration: parseFloat(getComputedStyle(el).animationDuration),
    }));
    expect(beat.name).toBe('beat');
    expect(beat.duration).toBeCloseTo(60 / bpm, 2);
  });

  test('Stop Auto で MANUAL', async () => {
    await popup.click('#btn-auto-cycle');
    await expect(popup.locator('#stage-mode')).toHaveText('MANUAL');
    await expect(popup.locator('#btn-auto-cycle .label')).toHaveText('Auto');
    expect((await readState(page)).active).toBe(true);
  });

  test('Manual を開くと手動の操作が出て、次に開いたときも同じ', async () => {
    await popup.click('#btn-manual');
    await expect(popup.locator('#manual-section')).toBeVisible();
    for (const sel of ['#preset-search', '#preset-list', '#filter-grid', '#blend-grid', '#scene-grid', '#text-input', '#btn-reset', '#audio-toggle']) {
      await expect(popup.locator(sel)).toBeVisible();
    }
    expect(await fitsWidth(popup)).toBeLessThanOrEqual(POPUP_WIDTH);

    await popup.close();
    popup = await openPopup(ext, site.base);
    await expect(popup.locator('#manual-section')).toBeVisible();
    await expect(popup.locator('#stage-mode')).toHaveText('MANUAL');

    await popup.click('#btn-manual');
    await expect(popup.locator('#manual-section')).toBeHidden();
    await popup.close();
    popup = await openPopup(ext, site.base);
    await expect(popup.locator('#manual-section')).toBeHidden();
  });

  test('手動の Rnd とチップは同じもの', async () => {
    const chip = popup.locator('#auto-blend');
    const manualRnd = popup.locator('#manual-section [data-rnd="blend"]');
    const engineBlendRnd = () => page.evaluate(() => !!(window._vjamFxEngine._autoFXTimer && window._vjamFxEngine._autoFXBlend));
    await popup.click('#btn-manual');
    // Auto を止めても Blend Rnd は単独で続く
    await expect(chip).toHaveClass(/\bactive\b/);
    await expect(manualRnd).toHaveClass(/\bactive\b/);
    await manualRnd.click();
    await expect(chip).not.toHaveClass(/\bactive\b/);
    await expect.poll(engineBlendRnd).toBe(false);
    await chip.click();
    await expect(manualRnd).toHaveClass(/\bactive\b/);
    await expect.poll(engineBlendRnd).toBe(true);
  });

  test('重ねられないページ:ロゴ・マーク・ひとことだけ', async () => {
    const blocked = await openPopup(ext, site.base, { tab: { id: 999999, url: 'chrome://extensions/' } });
    await expect(blocked.locator('#blocked-msg')).toHaveText("This page can't be overlaid");
    await expect(blocked.locator('.header img.logo')).toBeVisible();
    await expect(blocked.locator('#blocked img.mark')).toBeVisible();
    for (const sel of ['.toggle-switch', '#btn-settings', '#stage', '#btn-next', '#btn-manual', '.footer']) {
      await expect(blocked.locator(sel)).toBeHidden();
    }
    await blocked.close();
  });
});
