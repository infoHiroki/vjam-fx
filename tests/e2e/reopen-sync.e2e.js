/**
 * 動いているタブで popup を閉じて開き直したとき、Auto・Blend Rnd・Filter Rnd のボタンがエンジンと同じに見える(#33)。
 * Auto 中 → Rnd だけ ON → 両方 OFF の順に、開き直すたびに見る。
 * SW の状態が消えても(拡張の更新・再読み込みで storage.session が消える。エンジンはページに残って回り続ける)エンジンから戻る
 */
import { test, expect } from '@playwright/test';
import { startSite, launchWithExtension, openPopup, readState, readAuto, isAudioPlaying } from './helpers.js';

const ACTIVE = /\bactive\b/;

test.describe.serial('popup を開き直しても Auto / Rnd のボタンがエンジンと合う', () => {
  let site, ext, page, popup;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  const reopen = async () => {
    await popup.close();
    popup = await openPopup(ext, site.base);
  };

  // SW のタブの状態(メモリの tabState と storage.session)を消す。chrome.runtime.reload() はこの Chromium だと SW が戻らないので、中身だけ消す
  const wipeSwState = () => ext.sw.evaluate(async () => {
    tabState.clear();
    await chrome.storage.session.clear();
  });

  const expectButtons = async ({ auto, blend, filters }) => {
    await expect(popup.locator('#toggle')).toBeChecked();
    for (const [sel, on] of [['#btn-auto-cycle', auto], ['#auto-blend', blend], ['#auto-filters', filters]]) {
      if (on) await expect(popup.locator(sel)).toHaveClass(ACTIVE);
      else await expect(popup.locator(sel)).not.toHaveClass(ACTIVE);
    }
  };

  test('トグル ON(既定の設定)で Auto・Rnd が回り出す', async () => {
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.goto(`${site.base}/index.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);

    popup = await openPopup(ext, site.base);
    await popup.click('.toggle-switch');
    await expect.poll(() => readAuto(page), { timeout: 20_000 }).toMatchObject({
      cycling: true, blend: true, filters: true,
    });
    // popup の起動処理(_startAll の最後の _saveState)まで終わらせてから閉じる
    await page.waitForTimeout(1000);
  });

  test('Auto 中に開き直す → Auto・Blend Rnd・Filter Rnd が ON', async () => {
    await reopen();
    await expectButtons({ auto: true, blend: true, filters: true });
  });

  test('Auto 中、SW の状態が消えてから開き直す → それでも全部 ON', async () => {
    await popup.close();
    await wipeSwState();
    popup = await openPopup(ext, site.base);
    await expectButtons({ auto: true, blend: true, filters: true });
  });

  test('Auto だけ OFF にして開き直す → Auto は OFF、Rnd は ON のまま', async () => {
    await popup.click('#btn-auto-cycle');
    await expect.poll(() => readAuto(page)).toMatchObject({ cycling: false, fx: true });
    await reopen();
    await expectButtons({ auto: false, blend: true, filters: true });
  });

  test('Rnd だけのとき、SW の状態が消えてから開き直す → Rnd は ON', async () => {
    await popup.close();
    await wipeSwState();
    popup = await openPopup(ext, site.base);
    await expectButtons({ auto: false, blend: true, filters: true });
  });

  test('Rnd も両方 OFF にして開き直す → 全部 OFF(描画は続く)', async () => {
    await popup.click('#auto-blend');
    await popup.click('#auto-filters');
    await expect.poll(() => readAuto(page)).toMatchObject({ cycling: false, fx: false });
    await reopen();
    await expectButtons({ auto: false, blend: false, filters: false });
    expect((await readState(page)).active).toBe(true);
  });
});
