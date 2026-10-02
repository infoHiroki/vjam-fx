import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// iPhone: フルスクリーンの代わりに画面いっぱい表示(#51)
const baseCode = readFileSync(resolve(__dirname, '../content/base-preset.js'), 'utf-8');
const engineCode = readFileSync(resolve(__dirname, '../content/content.js'), 'utf-8');

describe('iPhone full view (#51)', () => {
  let VJamFXEngine;
  let engine;
  let originalEnter;
  let video;

  beforeAll(() => {
    window.VJamFX = { presets: {} };
    eval(baseCode);
    delete window._vjamFxEngine;
    eval(engineCode);
    VJamFXEngine = window.VJamFXEngine;
  });

  // iPhone の Safari と同じ: 要素のフルスクリーンが無く、video の webkitEnterFullscreen だけ
  function asIPhone() {
    originalEnter = vi.fn();
    HTMLVideoElement.prototype.webkitEnterFullscreen = originalEnter;
    HTMLVideoElement.prototype.webkitExitFullscreen = vi.fn();
  }

  // 再生中か・iPhone 専用のプレーヤーに出ているかを、テストから動かせる video
  function makeVideo(parent) {
    const v = document.createElement('video');
    const state = { paused: false, native: false };
    Object.defineProperty(v, 'paused', { get: () => state.paused, configurable: true });
    Object.defineProperty(v, 'webkitDisplayingFullscreen', { get: () => state.native, configurable: true });
    v.play = vi.fn(() => { state.paused = false; return Promise.resolve(); });
    v.webkitExitFullscreen = vi.fn(() => { state.native = false; });
    v._state = state;
    (parent || document.body).appendChild(v);
    return v;
  }

  // 標準のコントロールの全画面ボタンで iPhone 専用のプレーヤーに入った(webkitbeginfullscreen は泡立たない)
  function enterNative(v) {
    v._state.native = true;
    v.dispatchEvent(new Event('webkitbeginfullscreen'));
  }

  const exitButton = () => engine.overlay && engine.overlay.shadowRoot.querySelector('[data-vjam-fill-exit]');
  const isFilled = (v) => v.style.position === 'fixed' && v.style.width === '100vw';

  beforeEach(() => {
    document.body.style.backgroundColor = 'rgb(17, 17, 17)';
    engine = new VJamFXEngine();
  });

  afterEach(() => {
    vi.useRealTimers();
    engine.destroy();
    document.querySelectorAll('[data-vjam-fx]').forEach(el => el.remove());
    if (video) video.remove();
    video = null;
    document.body.innerHTML = '';
    document.body.style.backgroundColor = '';
    for (const name of ['webkitEnterFullscreen', 'webkitEnterFullScreen', 'webkitExitFullscreen']) delete HTMLVideoElement.prototype[name];
    delete Element.prototype.requestFullscreen;
    delete Element.prototype.webkitRequestFullscreen;
  });

  describe('only on iPhone', () => {
    it('does nothing in Chrome (no webkitEnterFullscreen)', () => {
      video = makeVideo();
      engine.createOverlay();
      expect(engine._fillHooks).toBeNull();
      enterNative(video);
      expect(video.webkitExitFullscreen).not.toHaveBeenCalled();
      expect(video.getAttribute('style')).toBeNull();
    });

    it('does nothing on iPad (requestFullscreen exists)', () => {
      asIPhone();
      Element.prototype.requestFullscreen = vi.fn();
      video = makeVideo();
      engine.createOverlay();
      expect(engine._fillHooks).toBeNull();
      expect(HTMLVideoElement.prototype.webkitEnterFullscreen).toBe(originalEnter);
      enterNative(video);
      expect(video.webkitExitFullscreen).not.toHaveBeenCalled();
      expect(video.getAttribute('style')).toBeNull();
    });

    it('does nothing with webkitRequestFullscreen (older iPad)', () => {
      asIPhone();
      Element.prototype.webkitRequestFullscreen = vi.fn();
      engine.createOverlay();
      expect(engine._fillHooks).toBeNull();
      expect(HTMLVideoElement.prototype.webkitEnterFullscreen).toBe(originalEnter);
    });

    it('replaces webkitEnterFullscreen only while the overlay exists', () => {
      asIPhone();
      HTMLVideoElement.prototype.webkitEnterFullScreen = originalEnter;
      expect(HTMLVideoElement.prototype.webkitEnterFullscreen).toBe(originalEnter);
      engine.createOverlay();
      expect(HTMLVideoElement.prototype.webkitEnterFullscreen).not.toBe(originalEnter);
      expect(HTMLVideoElement.prototype.webkitEnterFullScreen).not.toBe(originalEnter);
      engine.handleMessage({ action: 'stop' });
      expect(HTMLVideoElement.prototype.webkitEnterFullscreen).toBe(originalEnter);
      expect(HTMLVideoElement.prototype.webkitEnterFullScreen).toBe(originalEnter);
    });
  });

  describe('webkitEnterFullscreen from the page', () => {
    beforeEach(() => {
      asIPhone();
      video = makeVideo();
      engine.createOverlay();
    });

    it('fills the screen instead of the native player', () => {
      video.webkitEnterFullscreen();
      expect(originalEnter).not.toHaveBeenCalled();
      expect(video.style.position).toBe('fixed');
      expect(video.style.top).toBe('0px');
      expect(video.style.left).toBe('0px');
      expect(video.style.width).toBe('100vw');
      expect(video.style.height).toBe('100dvh');
      expect(video.style.getPropertyPriority('width')).toBe('important');
      expect(video.style.getPropertyPriority('height')).toBe('important');
      expect(video.style.objectFit).toBe('contain');
      expect(video.style.backgroundColor).toBe('black');
      // overlay(エフェクト)の 1 つ下
      expect(video.style.zIndex).toBe('2147483646');
      expect(Number(video.style.zIndex)).toBeLessThan(Number(engine.overlay.style.zIndex));
    });

    it('shows the × in the shadow root, outside the dip stage, as a 44px thin-line svg', () => {
      video.webkitEnterFullscreen();
      const button = exitButton();
      expect(button).not.toBeNull();
      expect(engine._stage.contains(button)).toBe(false);
      expect(document.querySelector('[data-vjam-fill-exit]')).toBeNull(); // ページの DOM には出ない
      expect(button.style.width).toBe('44px');
      expect(button.style.height).toBe('44px');
      expect(button.style.pointerEvents).toBe('auto');
      expect(button.querySelector('svg path').getAttribute('d')).toBeTruthy();
      expect(button.querySelector('svg').getAttribute('fill')).toBe('none');
    });

    it('× restores the inline style exactly', () => {
      video.setAttribute('style', 'width: 50%; margin: 0px auto; position: relative; z-index: 3;');
      const before = video.style.cssText;
      video.webkitEnterFullscreen();
      expect(isFilled(video)).toBe(true);
      const onPageClick = vi.fn();
      document.addEventListener('click', onPageClick);
      exitButton().click();
      document.removeEventListener('click', onPageClick);
      expect(video.style.cssText).toBe(before);
      expect(exitButton()).toBeNull();
      expect(engine._fill).toBeNull();
      // ページのクリックの処理には渡さない
      expect(onPageClick).not.toHaveBeenCalled();
    });

    it('removes the style attribute when there was none', () => {
      expect(video.hasAttribute('style')).toBe(false);
      video.webkitEnterFullscreen();
      exitButton().click();
      expect(video.hasAttribute('style')).toBe(false);
    });

    it('can fill again after ×', () => {
      video.webkitEnterFullscreen();
      exitButton().click();
      video.webkitEnterFullscreen();
      expect(isFilled(video)).toBe(true);
      expect(exitButton()).not.toBeNull();
    });

    it('calling it again on the same video keeps one ×', () => {
      video.webkitEnterFullscreen();
      video.webkitEnterFullscreen();
      expect(engine.overlay.shadowRoot.querySelectorAll('[data-vjam-fill-exit]').length).toBe(1);
    });

    it('switching to another video restores the first one', () => {
      const other = makeVideo();
      video.webkitEnterFullscreen();
      other.webkitEnterFullscreen();
      expect(video.hasAttribute('style')).toBe(false);
      expect(isFilled(other)).toBe(true);
      expect(engine.overlay.shadowRoot.querySelectorAll('[data-vjam-fill-exit]').length).toBe(1);
      other.remove();
    });

    it('ignores a video that is not in the document', () => {
      const detached = document.createElement('video');
      detached.webkitEnterFullscreen();
      expect(detached.hasAttribute('style')).toBe(false);
      expect(exitButton()).toBeNull();
    });

    it('keeps the full view when the page rewrites the style, and restores the page value', async () => {
      video.setAttribute('style', 'width: 50%;');
      video.webkitEnterFullscreen();
      // プレーヤーが大きさを書き直す(向きの変化など)
      video.style.width = '360px';
      video.style.left = '12px';
      await Promise.resolve();
      expect(video.style.width).toBe('100vw');
      expect(video.style.left).toBe('0px');
      exitButton().click();
      expect(video.style.width).toBe('360px');
      expect(video.style.left).toBe('12px');
    });

    it('keeps what the page wrote to other properties, even right before ×', () => {
      video.setAttribute('style', 'width: 50%;');
      video.webkitEnterFullscreen();
      // 監視の通知が届く前に戻す
      video.style.opacity = '0.5';
      exitButton().click();
      expect(video.style.opacity).toBe('0.5');
      expect(video.style.width).toBe('50%');
      expect(video.style.position).toBe('');
    });

    it('keeps the blend as it was (light page stays difference over the black video)', () => {
      engine.handleMessage({ action: 'stop' });
      document.body.style.backgroundColor = 'rgb(255, 255, 255)';
      engine.createOverlay();
      const blend = engine.overlay.style.mixBlendMode;
      expect(blend).toBe('difference');
      video.webkitEnterFullscreen();
      expect(engine.overlay.style.mixBlendMode).toBe(blend);
      expect(engine.blendMode).toBe('screen');
    });
  });

  describe('ancestors', () => {
    beforeEach(() => {
      asIPhone();
    });

    it('lifts what would trap position: fixed or the stacking, and restores it', () => {
      const style = document.createElement('style');
      style.textContent = '.player { filter: blur(1px); will-change: transform; }';
      document.head.appendChild(style);
      const outer = document.createElement('div');
      outer.className = 'player';
      outer.setAttribute('style', 'transform: translateX(10px); position: relative; z-index: 1;');
      const plain = document.createElement('div');
      outer.appendChild(plain);
      document.body.appendChild(outer);
      video = makeVideo(plain);
      const before = outer.style.cssText;
      engine.createOverlay();
      video.webkitEnterFullscreen();
      // (jsdom は transform などの !important を保持しないので値だけ見る)
      expect(outer.style.transform).toBe('none');
      expect(outer.style.filter).toBe('none');
      expect(outer.style.willChange).toBe('auto');
      expect(outer.style.zIndex).toBe('2147483646');
      // 何も無い祖先には触らない
      expect(plain.hasAttribute('style')).toBe(false);
      exitButton().click();
      expect(outer.style.cssText).toBe(before);
      expect(plain.hasAttribute('style')).toBe(false);
      style.remove();
    });

    it('raises a sticky ancestor above the page', () => {
      const sticky = document.createElement('div');
      sticky.style.position = 'sticky';
      document.body.appendChild(sticky);
      video = makeVideo(sticky);
      engine.createOverlay();
      video.webkitEnterFullscreen();
      expect(sticky.style.zIndex).toBe('2147483646');
      engine.handleMessage({ action: 'stop' });
      expect(sticky.style.cssText).toBe('position: sticky;');
    });
  });

  describe('native player (the standard fullscreen button)', () => {
    beforeEach(() => {
      asIPhone();
      video = makeVideo();
      engine.createOverlay();
    });

    it('exits it and fills the screen', () => {
      enterNative(video);
      expect(video.webkitExitFullscreen).toHaveBeenCalled();
      expect(video.webkitDisplayingFullscreen).toBe(false);
      expect(isFilled(video)).toBe(true);
      expect(exitButton()).not.toBeNull();
    });

    it('keeps playing when leaving it pauses the video', () => {
      enterNative(video);
      expect(video.play).not.toHaveBeenCalled();
      // 抜けると少し後に止まる
      video._state.paused = true;
      video.dispatchEvent(new Event('pause'));
      expect(video.play).toHaveBeenCalledTimes(1);
      expect(video.paused).toBe(false);
    });

    it('does not start a paused video', () => {
      video._state.paused = true;
      enterNative(video);
      video.dispatchEvent(new Event('pause'));
      expect(video.play).not.toHaveBeenCalled();
      expect(isFilled(video)).toBe(true);
    });

    it('stops watching for the pause after a while', () => {
      vi.useFakeTimers();
      enterNative(video);
      vi.advanceTimersByTime(2000);
      video._state.paused = true;
      video.dispatchEvent(new Event('pause'));
      expect(video.play).not.toHaveBeenCalled();
    });

    it('retries until the enter transition is over', () => {
      vi.useFakeTimers();
      let refuse = 3;
      video.webkitExitFullscreen = vi.fn(() => { if (refuse-- <= 0) video._state.native = false; });
      enterNative(video);
      expect(video.webkitExitFullscreen).toHaveBeenCalledTimes(1);
      expect(isFilled(video)).toBe(false);
      vi.advanceTimersByTime(300);
      expect(video.webkitExitFullscreen).toHaveBeenCalledTimes(4);
      expect(video.webkitDisplayingFullscreen).toBe(false);
      expect(isFilled(video)).toBe(true);
    });

    it('stops retrying when the engine is turned OFF', () => {
      vi.useFakeTimers();
      video.webkitExitFullscreen = vi.fn();
      enterNative(video);
      engine.handleMessage({ action: 'stop' });
      vi.advanceTimersByTime(5000);
      expect(video.webkitExitFullscreen).toHaveBeenCalledTimes(1);
      expect(video.hasAttribute('style')).toBe(false);
    });

    it('gives up after a few seconds if it cannot leave', () => {
      vi.useFakeTimers();
      video.webkitExitFullscreen = vi.fn();
      enterNative(video);
      vi.advanceTimersByTime(10000);
      expect(video.webkitExitFullscreen).toHaveBeenCalledTimes(30);
      expect(isFilled(video)).toBe(false);
    });

    it('is caught in the capture phase even though it does not bubble', () => {
      const inner = document.createElement('div');
      document.body.appendChild(inner);
      const nested = makeVideo(inner);
      enterNative(nested);
      expect(isFilled(nested)).toBe(true);
      exitButton().click();
    });
  });

  describe('engine OFF', () => {
    beforeEach(() => {
      asIPhone();
      video = makeVideo();
      video.setAttribute('style', 'width: 80%;');
      engine.createOverlay();
      video.webkitEnterFullscreen();
    });

    it('stop exits the full view and restores everything', () => {
      engine.handleMessage({ action: 'stop' });
      expect(video.style.cssText).toBe('width: 80%;');
      expect(engine._fill).toBeNull();
      expect(engine._fillHooks).toBeNull();
      expect(HTMLVideoElement.prototype.webkitEnterFullscreen).toBe(originalEnter);
      // 標準のボタンも拾わない
      enterNative(video);
      expect(video.webkitExitFullscreen).not.toHaveBeenCalled();
    });

    it('destroy exits the full view and restores everything', () => {
      engine.destroy();
      expect(video.style.cssText).toBe('width: 80%;');
      expect(HTMLVideoElement.prototype.webkitEnterFullscreen).toBe(originalEnter);
    });

    it('kill (Reset) keeps the full view (the overlay stays)', () => {
      engine.kill({});
      expect(isFilled(video)).toBe(true);
      expect(exitButton()).not.toBeNull();
    });

    it('the page wrapping our method passes through to the original after OFF', () => {
      const ours = HTMLVideoElement.prototype.webkitEnterFullscreen;
      HTMLVideoElement.prototype.webkitEnterFullscreen = function() { return ours.apply(this, arguments); };
      engine.handleMessage({ action: 'stop' });
      video.webkitEnterFullscreen();
      expect(originalEnter).toHaveBeenCalledTimes(1);
      expect(video.style.cssText).toBe('width: 80%;');
    });

    it('fills again after the next start', () => {
      engine.handleMessage({ action: 'stop' });
      engine.createOverlay();
      video.webkitEnterFullscreen();
      expect(isFilled(video)).toBe(true);
      expect(originalEnter).not.toHaveBeenCalled();
    });
  });
});
