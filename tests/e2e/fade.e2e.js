/**
 * 切り替えのフェード(#38)を実物の Chromium + 拡張で確かめる。
 * - Next: 押した直後は古いキャンバスが残ってフェードアウト中で、フェード時間(既定 1.5 秒)の後に消える
 * - Rnd / Auto の blend・filter: オーバーレイの中身が一度 0 近くまで下がり、暗い間に変わって、また戻る(dip)
 * フェードの途中の不透明度はページの rAF で毎フレーム getComputedStyle して記録する(CSS の transition が本当に動いているか)
 */
import { test, expect } from '@playwright/test';
import { startSite, launchWithExtension, openPopup, readState, waitLayersFadedIn, isAudioPlaying } from './helpers.js';

const FADE_MS = 1500; // popup の既定のフェード時間
const DIP_MS = 300;

test.describe.serial('切り替えのフェード', () => {
  let site, ext, page, popup;

  test.beforeAll(async ({ headless }) => {
    site = await startSite();
    ext = await launchWithExtension({ headless });
  });

  test.afterAll(async () => {
    await ext?.close();
    await site?.close();
  });

  test('Next でレイヤーが乗り、フェードインし終わる', async () => {
    page = ext.context.pages()[0] ?? await ext.context.newPage();
    await page.goto(`${site.base}/index.html`);
    await expect.poll(() => isAudioPlaying(page)).toBe(true);

    popup = await openPopup(ext, site.base);
    await popup.click('#btn-next');
    await expect.poll(async () => {
      const s = await readState(page);
      return s.active && s.layers.length >= 1 && s.canvases >= 1;
    }, { timeout: 15_000 }).toBe(true);
    await waitLayersFadedIn(page);
  });

  test('もう一度 Next: 古いキャンバスはフェードアウトしながら残り、フェード時間の後に消える', async () => {
    // 今のレイヤーの div を覚えて、Next の後を毎フレーム記録する
    await page.evaluate(() => {
      const e = window._vjamFxEngine;
      const root = e.overlay.shadowRoot;
      const old = [...root.querySelectorAll('[data-vjam-layer]')];
      const rec = window.__fade = { old: old.length, start: 0, end: 0, samples: [] };
      const frame = (now) => {
        // _removeLayer が opacity 0 を入れたら(= Next のコマンドが届いたら)記録を始める
        if (!rec.start && old.some((d) => d.style.opacity === '0')) rec.start = now;
        if (rec.start) {
          const alive = old.filter((d) => d.isConnected);
          const fresh = [...e.activeLayers.values()].map((l) => l.container);
          rec.samples.push({
            t: now - rec.start,
            alive: alive.length,
            oldCanvases: alive.reduce((n, d) => n + d.querySelectorAll('canvas').length, 0),
            oldOpacity: alive.length ? Number(getComputedStyle(alive[0]).opacity) : null,
            oldActive: old.some((d) => fresh.includes(d)),
            newCount: fresh.length,
            newOpacity: fresh.length ? Number(getComputedStyle(fresh[0]).opacity) : null,
          });
          if (alive.length === 0) {
            rec.end = now;
            return;
          }
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });

    await popup.click('#btn-next');
    await expect.poll(() => page.evaluate(() => window.__fade.end), { timeout: 15_000 }).toBeGreaterThan(0);
    const rec = await page.evaluate(() => window.__fade);
    const { samples } = rec;
    const fading = samples.filter((s) => s.alive > 0);

    // 押した直後: 古いキャンバスは全部まだある。エンジンの上ではもう新しいレイヤーに入れ替わっている
    expect(rec.old).toBeGreaterThanOrEqual(1);
    expect(samples[0].t).toBeLessThan(100);
    expect(samples[0].alive).toBe(rec.old);
    expect(samples[0].oldCanvases).toBeGreaterThanOrEqual(1);
    expect(samples[0].oldOpacity).toBeGreaterThan(0.9);
    expect(samples[0].oldActive).toBe(false);
    expect(samples[0].newCount).toBeGreaterThanOrEqual(1);

    // フェード中: 途中の不透明度を通って、だんだん下がる(一瞬で消えていない)
    const mid = fading.filter((s) => s.oldOpacity > 0.1 && s.oldOpacity < 0.9);
    expect(mid.length).toBeGreaterThanOrEqual(5);
    const half = fading.find((s) => s.t >= FADE_MS / 2);
    expect(half.oldOpacity).toBeGreaterThan(0.25);
    expect(half.oldOpacity).toBeLessThan(0.75);
    for (let i = 1; i < fading.length; i++) {
      expect(fading[i].oldOpacity).toBeLessThanOrEqual(fading[i - 1].oldOpacity + 0.01);
    }
    // 新しいレイヤーは同じ間にフェードイン
    expect(half.newOpacity).toBeGreaterThan(0.25);
    expect(half.newOpacity).toBeLessThan(0.75);

    // フェード時間の後に消える(transitionend。来なければ +200ms の保険)
    const gone = rec.end - rec.start;
    expect(gone).toBeGreaterThan(FADE_MS - 100);
    expect(gone).toBeLessThan(FADE_MS + 400);
    const s = await readState(page);
    expect(s.canvases).toBeGreaterThanOrEqual(1);
    expect(s.layers.length).toBeGreaterThanOrEqual(1);
  });

  test('Rnd の blend / filter は、オーバーレイの中身を一度下げて、暗い間に変えて戻す', async () => {
    await waitLayersFadedIn(page);
    const rec = await page.evaluate(() => new Promise((resolve) => {
      const e = window._vjamFxEngine;
      const stage = e._stage;
      const hostOpacity = e.overlay.style.opacity;
      const samples = [];
      const t0 = performance.now();
      // Rnd の切り替えと同じ呼び出し(force で必ず変える)。拍を待たずに済むよう直接呼ぶ。行き先が分かるよう候補は 1 つに絞る
      e.setBlendMode('screen');
      e.clearFilters();
      e._randomizeBlend({ blends: ['difference'] }, true);
      e._randomizeFilter({ filters: ['hue-rotate(90deg)'] }, true);
      const frame = (now) => {
        samples.push({
          t: now - t0,
          opacity: Number(getComputedStyle(stage).opacity),
          filter: e.overlay.style.filter,
          blend: e.overlay.style.mixBlendMode,
          host: e.overlay.style.opacity,
        });
        if (now - t0 < 900) requestAnimationFrame(frame);
        else resolve({ samples, hostOpacity, end: { opacity: getComputedStyle(stage).opacity, transition: stage.style.transition } });
      };
      requestAnimationFrame(frame);
    }));
    const { samples } = rec;

    // 下がって、戻る
    const low = Math.min(...samples.map((s) => s.opacity));
    expect(low).toBeLessThan(0.15);
    expect(samples.some((s) => s.opacity > 0.1 && s.opacity < 0.9)).toBe(true);
    expect(rec.end.opacity).toBe('1');
    expect(rec.end.transition).toBe('');

    // 変わったのは暗くなってから(最初は前の blend / filter のまま)
    expect(samples[0].filter).toBe('none');
    const changed = samples.find((s) => s.filter === 'hue-rotate(90deg)');
    expect(changed).toBeDefined();
    expect(changed.t).toBeGreaterThan(DIP_MS - 50);
    expect(changed.blend).toBe('difference');
    expect(changed.opacity).toBeLessThan(0.15);
    // 人が設定した不透明度(ホスト)には触らない
    for (const s of samples) expect(s.host).toBe(rec.hostOpacity);
  });
});
