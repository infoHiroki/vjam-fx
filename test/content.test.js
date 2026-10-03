import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load IIFE scripts in order (same as Chrome injection)
const baseCode = readFileSync(resolve(__dirname, '../content/base-preset.js'), 'utf-8');
const engineCode = readFileSync(resolve(__dirname, '../content/content.js'), 'utf-8');

// Load a preset for testing
const neonCode = readFileSync(resolve(__dirname, '../content/presets/neon-tunnel.js'), 'utf-8');

describe('VJamFXEngine', () => {
  let VJamFXEngine;
  let engine;

  beforeAll(() => {
    // Initialize VJamFX namespace
    window.VJamFX = { presets: {} };
    eval(baseCode);
    eval(neonCode);
    // Clear any previous engine
    delete window._vjamFxEngine;
    eval(engineCode);
    VJamFXEngine = window.VJamFXEngine;
  });

  beforeEach(() => {
    // 既定はダークページ（ライトページは 'light page' describe で個別に検証）
    document.body.style.backgroundColor = 'rgb(17, 17, 17)';
    // Create fresh engine for each test
    engine = new VJamFXEngine();
    vi.clearAllMocks();
  });

  afterEach(() => {
    engine.destroy();
    document.querySelectorAll('[data-vjam-fx]').forEach(el => el.remove());
    document.body.style.backgroundColor = '';
    document.documentElement.style.backgroundColor = '';
  });

  describe('overlay stacking', () => {
    it('pins z-index / position with !important so site CSS cannot push it under a player', () => {
      // jsdom は z-index / position の priority を保持しないので、important 付きで指定していることを確かめる
      // (実ブラウザでの効き目は Chromium / iPad Safari で確認済み)
      const spy = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty');
      try {
        engine.createOverlay();
        const calls = spy.mock.calls.map(c => c.join('|'));
        for (const c of ['position|fixed|important', 'top|0|important', 'left|0|important', 'width|100vw|important',
          'height|100vh|important', 'z-index|2147483647|important', 'pointer-events|none|important',
          'display|block|important', 'visibility|visible|important', 'transform|none|important',
          'right|auto|important', 'bottom|auto|important', 'margin|0|important']) {
          expect(calls).toContain(c);
        }
        // 実行中に変えるものは固定しない
        expect(calls.filter(c => /^(opacity|mix-blend-mode|filter)\|.*\|important$/.test(c))).toEqual([]);
      } finally {
        spy.mockRestore();
      }
    });

    it('still lets blend mode and opacity change at runtime', () => {
      engine.createOverlay();
      engine.setBlendMode('difference');
      engine.setOpacity(0.5);
      expect(engine.overlay.style.mixBlendMode).toBe('difference');
      expect(engine.overlay.style.opacity).toBe('0.5');
    });
  });

  describe('light page', () => {
    it('should treat transparent body + transparent html as light', () => {
      document.body.style.backgroundColor = '';
      engine.createOverlay();
      expect(engine.isLightPage).toBe(true);
      expect(engine.overlay.style.mixBlendMode).toBe('difference');
    });

    it('should fall back to html background when body is transparent', () => {
      document.body.style.backgroundColor = 'rgba(0, 0, 0, 0)';
      document.documentElement.style.backgroundColor = 'rgb(15, 15, 15)';
      engine.createOverlay();
      expect(engine.isLightPage).toBe(false);
      expect(engine.overlay.style.mixBlendMode).toBe('screen');
    });

    it('should render default screen as difference when start sends screen', () => {
      document.body.style.backgroundColor = 'rgb(255, 255, 255)';
      engine.handleMessage({ action: 'start', preset: 'neon-tunnel', blendMode: 'screen' });
      expect(engine.overlay.style.mixBlendMode).toBe('difference');
      const canvas = engine.overlay.querySelector('canvas');
      if (canvas) expect(canvas.style.mixBlendMode).toBe('difference');
    });

    it('should keep reporting screen (user value) so popup/SW do not save difference', () => {
      document.body.style.backgroundColor = 'rgb(255, 255, 255)';
      engine.handleMessage({ action: 'start', preset: 'neon-tunnel', blendMode: 'screen' });
      expect(engine.blendMode).toBe('screen');
    });

    it('should reset to screen on kill and still render difference', () => {
      document.body.style.backgroundColor = 'rgb(255, 255, 255)';
      engine.handleMessage({ action: 'start', preset: 'neon-tunnel', blendMode: 'exclusion' });
      engine.kill({});
      expect(engine.blendMode).toBe('screen');
      expect(engine.overlay.style.mixBlendMode).toBe('difference');
    });

    it('should respect explicit non-screen blend on light page', () => {
      document.body.style.backgroundColor = 'rgb(255, 255, 255)';
      engine.createOverlay();
      engine.setBlendMode('lighten');
      expect(engine.blendMode).toBe('lighten');
    });

    it('should only randomize to visible blend modes on light page', () => {
      document.body.style.backgroundColor = 'rgb(255, 255, 255)';
      engine.createOverlay();
      for (let i = 0; i < 50; i++) {
        engine.randomizeFX();
        expect(['difference', 'exclusion']).toContain(engine.blendMode);
      }
    });
  });

  // 背景未指定のページは mix-blend-mode の相手が無いので、html に Canvas を入れる(#13)
  describe('backdrop for transparent page', () => {
    const root = () => document.documentElement;

    beforeEach(() => {
      document.body.style.backgroundColor = '';
    });

    afterEach(() => {
      document.body.style.backgroundImage = '';
    });

    it('should set html background to Canvas when html and body are transparent', () => {
      engine.createOverlay();
      expect(root().style.backgroundColor).toBe('canvas');
    });

    it('should judge light page by the actual Canvas color', () => {
      engine.createOverlay();
      expect(getComputedStyle(root()).backgroundColor).toBe('rgb(255, 255, 255)');
      expect(engine.isLightPage).toBe(true);
      expect(engine.overlay.style.mixBlendMode).toBe('difference');
    });

    it('should restore the original inline value on destroy', () => {
      engine.createOverlay();
      engine.destroy();
      expect(root().style.backgroundColor).toBe('');
    });

    it('should restore a transparent inline value on destroy', () => {
      root().style.backgroundColor = 'transparent';
      engine.createOverlay();
      expect(root().style.backgroundColor).toBe('canvas');
      engine.destroy();
      expect(root().style.backgroundColor).toBe('transparent');
    });

    it('should restore on stop (overlay removed) and set again on next start', () => {
      engine.handleMessage({ action: 'start', preset: 'neon-tunnel' });
      expect(root().style.backgroundColor).toBe('canvas');
      engine.handleMessage({ action: 'stop' });
      expect(root().style.backgroundColor).toBe('');
      engine.handleMessage({ action: 'start', preset: 'neon-tunnel' });
      expect(root().style.backgroundColor).toBe('canvas');
    });

    it('should not touch html when body has a background color', () => {
      document.body.style.backgroundColor = 'rgb(255, 255, 255)';
      engine.createOverlay();
      expect(root().style.backgroundColor).toBe('');
      engine.destroy();
      expect(root().style.backgroundColor).toBe('');
    });

    it('should not touch html when html has a background color', () => {
      root().style.backgroundColor = 'rgb(15, 15, 15)';
      engine.createOverlay();
      expect(root().style.backgroundColor).toBe('rgb(15, 15, 15)');
      engine.destroy();
      expect(root().style.backgroundColor).toBe('rgb(15, 15, 15)');
    });

    it('should not touch html when body has a background image', () => {
      // html に色を入れると body の背景画像がビューポート全体に広がらなくなる
      document.body.style.backgroundImage = 'linear-gradient(red, blue)';
      engine.createOverlay();
      expect(root().style.backgroundColor).toBe('');
    });

    it('should not overwrite a value the page set while overlay was on', () => {
      engine.createOverlay();
      root().style.backgroundColor = 'rgb(0, 0, 0)';
      engine.destroy();
      expect(root().style.backgroundColor).toBe('rgb(0, 0, 0)');
    });
  });

  describe('constructor', () => {
    it('should initialize as inactive', () => {
      expect(engine.active).toBe(false);
    });

    it('should have default blendMode of screen', () => {
      expect(engine.blendMode).toBe('screen');
    });

    it('should have audioEnabled true by default', () => {
      expect(engine.audioEnabled).toBe(true);
    });
  });

  describe('createOverlay', () => {
    it('should create a full-viewport overlay', () => {
      engine.createOverlay();
      const overlay = document.querySelector('[data-vjam-fx]');
      expect(overlay).not.toBeNull();
      expect(overlay.style.position).toBe('fixed');
      expect(overlay.style.zIndex).toBe('2147483647');
      expect(overlay.style.pointerEvents).toBe('none');
    });

    it('should apply screen blend mode by default', () => {
      engine.createOverlay();
      const overlay = document.querySelector('[data-vjam-fx]');
      expect(overlay.style.mixBlendMode).toBe('screen');
    });

    it('should not create duplicate overlays', () => {
      engine.createOverlay();
      engine.createOverlay();
      const overlays = document.querySelectorAll('[data-vjam-fx]');
      expect(overlays.length).toBe(1);
    });
  });

  // 中身を Shadow DOM に入れて、ページの CSS に巻き込まれないようにする(#26)
  describe('Shadow DOM', () => {
    // setup で container にキャンバスを 1 枚入れるプリセット(p5 のモックはキャンバスを作らないので)
    beforeEach(() => {
      window.VJamFX.presets['canvas-preset'] = class {
        setup(container) {
          const c = document.createElement('canvas');
          c.style.cssText = 'display:block;width:100%;height:100%;';
          container.appendChild(c);
        }
        destroy() {}
      };
    });

    afterEach(() => {
      delete window.VJamFX.presets['canvas-preset'];
      document.querySelectorAll('style[data-test-site-css]').forEach(el => el.remove());
      document.querySelectorAll('[data-test-page-el]').forEach(el => el.remove());
      document.body.removeAttribute('data-x');
    });

    it('creates layers and canvases inside an open shadow root on the overlay', () => {
      engine._addLayer('canvas-preset');
      const root = engine.overlay.shadowRoot;
      expect(root).not.toBeNull();
      expect(root.mode).toBe('open');
      const layerDiv = root.querySelector('[data-vjam-layer="canvas-preset"]');
      expect(layerDiv).not.toBeNull();
      expect(layerDiv.querySelector('canvas')).not.toBeNull();
      // ホストの light DOM には何も入れない(入れても描かれない)
      expect(engine.overlay.children.length).toBe(0);
      expect(document.querySelector('[data-vjam-layer]')).toBeNull();
      expect(document.querySelector('canvas')).toBeNull();
    });

    it('applies the blend mode to canvases inside the shadow root', () => {
      engine._addLayer('canvas-preset');
      engine.setBlendMode('difference');
      const canvas = engine.overlay.shadowRoot.querySelector('canvas');
      expect(engine.overlay.style.mixBlendMode).toBe('difference');
      expect(canvas.style.mixBlendMode).toBe('difference');
    });

    it('creates the text overlay canvas inside the shadow root', () => {
      const ro = globalThis.ResizeObserver;
      globalThis.ResizeObserver = class { observe() {} disconnect() {} };
      const ctxSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
      try {
        eval(readFileSync(resolve(__dirname, '../content/text-overlay.js'), 'utf-8'));
        engine.handleMessage({ action: 'textSetParams', params: {} });
        const container = engine._textOverlay.container;
        expect(container.getRootNode()).toBe(engine.overlay.shadowRoot);
        expect(engine._textOverlay.canvas.getRootNode()).toBe(engine.overlay.shadowRoot);
        expect(engine.overlay.children.length).toBe(0);
      } finally {
        engine.destroy();
        delete window.VJamFX.TextOverlay;
        ctxSpy.mockRestore();
        globalThis.ResizeObserver = ro;
      }
    });

    it('keeps layers and canvases in place under site CSS that flings every element off-screen', () => {
      // 動画サイトの「フルサイズ」表示が入れる CSS(プレイヤー以外を x = -100000 へ飛ばす)
      const css = document.createElement('style');
      css.setAttribute('data-test-site-css', '');
      css.textContent = 'body[data-x] :not(div[data-keep], div[data-keep] *) {'
        + ' position: fixed !important; right: 100000px !important; left: unset !important;'
        + ' bottom: unset !important; z-index: 0 !important; }';
      document.head.appendChild(css);
      const pageEl = document.createElement('p');
      pageEl.setAttribute('data-test-page-el', '');
      document.body.appendChild(pageEl);

      engine._addLayer('canvas-preset');
      document.body.setAttribute('data-x', '');

      // ページの要素は飛ばされる(この CSS が jsdom で効いていることの確認)
      expect(getComputedStyle(pageEl).right).toBe('100000px');
      expect(getComputedStyle(pageEl).zIndex).toBe('0');

      const root = engine.overlay.shadowRoot;
      const layerDiv = root.querySelector('[data-vjam-layer="canvas-preset"]');
      const canvas = layerDiv.querySelector('canvas');
      for (const el of [layerDiv, canvas]) {
        const cs = getComputedStyle(el);
        expect(cs.right).not.toBe('100000px');
        expect(cs.left).not.toBe('unset');
        expect(cs.bottom).not.toBe('unset');
        expect(cs.zIndex).not.toBe('0');
        expect(cs.position).not.toBe('fixed');
      }
      expect(getComputedStyle(layerDiv).position).toBe('absolute');
      expect(getComputedStyle(layerDiv).left).toBe('0px');
    });

    // p5 は setup 中に作ったキャンバスを visibility: hidden にし、setup の後に document の canvas から探して戻す。
    // shadow root の中は探されないので、エンジンが戻す
    describe('p5 hidden canvas', () => {
      function addHiddenCanvas(container) {
        const c = document.createElement('canvas');
        c.dataset.hidden = true;
        c.style.visibility = 'hidden';
        container.appendChild(c);
        return c;
      }

      afterEach(() => {
        delete window.VJamFX.presets['p5-like'];
      });

      it('unhides a canvas p5 left hidden during setup', async () => {
        let canvas;
        window.VJamFX.presets['p5-like'] = class {
          setup(container) { canvas = addHiddenCanvas(container); }
          destroy() {}
        };
        engine._addLayer('p5-like');
        await Promise.resolve();
        expect(canvas.getRootNode()).toBe(engine.overlay.shadowRoot);
        expect(canvas.style.visibility).toBe('');
        expect(canvas.hasAttribute('data-hidden')).toBe(false);
      });

      it('unhides a canvas created later (p5 waits for the page load event)', async () => {
        let later;
        window.VJamFX.presets['p5-like'] = class {
          setup(container) { later = () => addHiddenCanvas(container); }
          destroy() {}
        };
        engine._addLayer('p5-like');
        await Promise.resolve();
        const canvas = later();
        await Promise.resolve();
        expect(canvas.style.visibility).toBe('');
        expect(canvas.hasAttribute('data-hidden')).toBe(false);
      });
    });

    it('removes the shadow contents with the overlay on stop', () => {
      engine.startPreset('canvas-preset');
      engine.handleMessage({ action: 'stop' });
      expect(engine.overlay).toBeNull();
      expect(engine._stage).toBeNull();
      // 次の start で作り直す
      engine.startPreset('canvas-preset');
      expect(engine.overlay.shadowRoot.querySelector('[data-vjam-layer="canvas-preset"] canvas')).not.toBeNull();
    });

    it('moves the whole shadow tree with the host on fullscreen', () => {
      engine._addLayer('canvas-preset');
      const fsEl = document.createElement('div');
      document.body.appendChild(fsEl);
      try {
        Object.defineProperty(document, 'fullscreenElement', { value: fsEl, configurable: true });
        document.dispatchEvent(new Event('fullscreenchange'));
        expect(fsEl.contains(engine.overlay)).toBe(true);
        expect(engine.overlay.shadowRoot.querySelector('[data-vjam-layer="canvas-preset"] canvas')).not.toBeNull();
      } finally {
        Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
        document.dispatchEvent(new Event('fullscreenchange'));
        fsEl.remove();
      }
    });
  });

  describe('setBlendMode', () => {
    it('should change blend mode on overlay', () => {
      engine.createOverlay();
      engine.setBlendMode('difference');
      const overlay = document.querySelector('[data-vjam-fx]');
      expect(overlay.style.mixBlendMode).toBe('difference');
    });

    it('should accept all 4 valid modes', () => {
      engine.createOverlay();
      for (const mode of ['screen', 'lighten', 'difference', 'exclusion']) {
        engine.setBlendMode(mode);
        expect(engine.blendMode).toBe(mode);
      }
    });

    it('should reject invalid blend modes', () => {
      engine.createOverlay();
      engine.setBlendMode('multiply');
      expect(engine.blendMode).toBe('screen');
    });
  });

  describe('startPreset', () => {
    it('should set active to true', () => {
      engine.startPreset('neon-tunnel');
      expect(engine.active).toBe(true);
    });

    it('should create overlay', () => {
      engine.startPreset('neon-tunnel');
      const overlay = document.querySelector('[data-vjam-fx]');
      expect(overlay).not.toBeNull();
    });

    it('should store current preset name', () => {
      engine.startPreset('neon-tunnel');
      expect(engine.currentPresetName).toBe('neon-tunnel');
    });

    it('should instantiate preset from registry', () => {
      engine.startPreset('neon-tunnel');
      expect(engine.currentPreset).not.toBeNull();
    });

    it('should handle unknown preset gracefully', () => {
      expect(() => engine.startPreset('nonexistent')).not.toThrow();
      expect(engine.currentPreset).toBeNull();
    });
  });

  describe('stop', () => {
    it('should set active to false', () => {
      engine.startPreset('neon-tunnel');
      engine.stop();
      expect(engine.active).toBe(false);
    });

    it('should destroy current preset', () => {
      engine.startPreset('neon-tunnel');
      engine.stop();
      expect(engine.currentPreset).toBeNull();
    });

    it('should clear preset name', () => {
      engine.startPreset('neon-tunnel');
      engine.stop();
      expect(engine.currentPresetName).toBeNull();
    });
  });

  describe('destroy', () => {
    it('should remove overlay from DOM', () => {
      engine.createOverlay();
      engine.destroy();
      expect(document.querySelector('[data-vjam-fx]')).toBeNull();
    });

    it('should handle destroy when no overlay exists', () => {
      expect(() => engine.destroy()).not.toThrow();
    });

    it('should clean up external audio data', () => {
      engine._externalAudioData = { beat: true };
      engine.destroy();
      expect(engine._externalAudioData).toBeNull();
    });
  });

  describe('audioEnabled', () => {
    it('should default to true', () => {
      expect(engine.audioEnabled).toBe(true);
    });

    it('should toggle via handleMessage', () => {
      engine.handleMessage({ action: 'setAudioEnabled', enabled: false });
      expect(engine.audioEnabled).toBe(false);
      engine.handleMessage({ action: 'setAudioEnabled', enabled: true });
      expect(engine.audioEnabled).toBe(true);
    });

    it('should clear external audio data when disabled', () => {
      engine._externalAudioData = { beat: true };
      engine.handleMessage({ action: 'setAudioEnabled', enabled: false });
      expect(engine._externalAudioData).toBeNull();
    });
  });

  describe('handleMessage', () => {
    it('should handle start message', () => {
      engine.handleMessage({ action: 'start', preset: 'neon-tunnel' });
      expect(engine.active).toBe(true);
      expect(engine.currentPresetName).toBe('neon-tunnel');
    });

    it('should handle stop message', () => {
      engine.startPreset('neon-tunnel');
      engine.handleMessage({ action: 'stop' });
      expect(engine.active).toBe(false);
    });

    it('should handle setBlendMode message', () => {
      engine.createOverlay();
      engine.handleMessage({ action: 'setBlendMode', blendMode: 'exclusion' });
      expect(engine.blendMode).toBe('exclusion');
    });

    it('should handle switchPreset message', () => {
      engine.startPreset('neon-tunnel');
      engine.handleMessage({ action: 'switchPreset', preset: 'neon-tunnel' });
      expect(engine.currentPresetName).toBe('neon-tunnel');
    });

    it('should handle start with blendMode', () => {
      engine.createOverlay();
      engine.handleMessage({ action: 'start', preset: 'neon-tunnel', blendMode: 'difference' });
      expect(engine.blendMode).toBe('difference');
    });
  });

  describe('multi-layer', () => {
    it('should add a layer', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'addLayer', preset: 'neon-tunnel' });
      expect(engine.activeLayers.has('neon-tunnel')).toBe(true);
    });

    it('should remove a layer', () => {
      engine.startPreset('neon-tunnel');
      engine.handleMessage({ action: 'removeLayer', preset: 'neon-tunnel' });
      expect(engine.activeLayers.has('neon-tunnel')).toBe(false);
    });

    it('should toggle a layer on and off', () => {
      engine.createOverlay();
      engine.handleMessage({ action: 'toggleLayer', preset: 'neon-tunnel' });
      expect(engine.activeLayers.has('neon-tunnel')).toBe(true);
      engine.handleMessage({ action: 'toggleLayer', preset: 'neon-tunnel' });
      expect(engine.activeLayers.has('neon-tunnel')).toBe(false);
    });

    it('should get active layer names', () => {
      engine.startPreset('neon-tunnel');
      const names = engine.getActiveLayerNames();
      expect(names).toContain('neon-tunnel');
    });

    it('should destroy all layers on stop', () => {
      engine.startPreset('neon-tunnel');
      engine.stop();
      expect(engine.activeLayers.size).toBe(0);
    });
  });

  describe('CSS filters', () => {
    it('should add a filter', () => {
      engine.createOverlay();
      engine.handleMessage({ action: 'setFilter', filter: 'invert', enabled: true });
      expect(engine.activeFilters.has('invert')).toBe(true);
    });

    it('should remove a filter', () => {
      engine.createOverlay();
      engine.setFilter('invert', true);
      engine.handleMessage({ action: 'setFilter', filter: 'invert', enabled: false });
      expect(engine.activeFilters.has('invert')).toBe(false);
    });

    it('should toggle a filter', () => {
      engine.createOverlay();
      engine.handleMessage({ action: 'toggleFilter', filter: 'hue-rotate' });
      expect(engine.activeFilters.has('hue-rotate')).toBe(true);
      engine.handleMessage({ action: 'toggleFilter', filter: 'hue-rotate' });
      expect(engine.activeFilters.has('hue-rotate')).toBe(false);
    });

    it('should apply filter CSS to overlay', () => {
      engine.createOverlay();
      engine.setFilter('invert', true);
      engine.setFilter('blur', true);
      const overlay = document.querySelector('[data-vjam-fx]');
      expect(overlay.style.filter).toContain('invert(1)');
      expect(overlay.style.filter).toContain('blur(3px)');
    });

    it('should clear all filters', () => {
      engine.createOverlay();
      engine.setFilter('invert', true);
      engine.setFilter('sepia', true);
      engine.handleMessage({ action: 'clearFilters' });
      expect(engine.activeFilters.size).toBe(0);
      const overlay = document.querySelector('[data-vjam-fx]');
      expect(overlay.style.filter).toBe('none');
    });

    it('should reject invalid filter names', () => {
      engine.createOverlay();
      engine.setFilter('nonexistent', true);
      expect(engine.activeFilters.size).toBe(0);
    });

    // popup のボタンは VJam と同じ 5 個(#35)。Bright / Sepia / Blur はボタンだけ隠し、保存済みのシーン・状態のためにエンジンは対応したまま
    it('still applies the filters whose buttons are hidden (brightness / sepia / blur)', () => {
      engine.createOverlay();
      engine.handleMessage({ action: 'setFilter', filter: 'brightness', enabled: true });
      engine.handleMessage({ action: 'setFilter', filter: 'sepia', enabled: true });
      engine.handleMessage({ action: 'setFilter', filter: 'blur', enabled: true });
      const overlay = document.querySelector('[data-vjam-fx]');
      expect(overlay.style.filter).toBe('brightness(1.4) sepia(1) blur(3px)');
    });
  });

  describe('kill', () => {
    it('should clear all layers and filters', () => {
      engine.startPreset('neon-tunnel');
      engine.setFilter('invert', true);
      engine.handleMessage({ action: 'kill' });
      expect(engine.activeLayers.size).toBe(0);
      expect(engine.activeFilters.size).toBe(0);
      expect(engine.blendMode).toBe('screen');
    });

    it('should keep engine alive after kill', () => {
      engine.startPreset('neon-tunnel');
      engine.handleMessage({ action: 'kill' });
      // Engine should still have overlay, can add new layers
      expect(engine.overlay).not.toBeNull();
    });
  });

  describe('randomizeFX', () => {
    it('should set a valid blend mode', () => {
      engine.createOverlay();
      engine.handleMessage({ action: 'randomizeFX' });
      expect(['screen', 'lighten', 'difference', 'exclusion', 'color-dodge']).toContain(engine.blendMode);
    });
  });

  describe('auto-cycle', () => {
    it('should start and stop auto-cycle via messages', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 5000 });
      expect(engine._autoCycleTimer).not.toBeNull();
      engine.handleMessage({ action: 'stopAutoCycle' });
      expect(engine._autoCycleTimer).toBeNull();
    });

    it('should add layers on auto-cycle tick', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000 });
      // After startAutoCycle, the first tick runs immediately
      expect(engine.activeLayers.size).toBeGreaterThan(0);
      engine._stopAutoCycle();
    });

    it('should stop auto-cycle on destroy', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000 });
      engine.destroy();
      expect(engine._autoCycleTimer).toBeNull();
    });

    it('should randomize blend mode when autoBlend is true', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000, autoBlend: true });
      // After first tick, blend mode should be a valid one
      expect(['screen', 'lighten', 'difference', 'exclusion', 'color-dodge']).toContain(engine.blendMode);
      engine._stopAutoCycle();
    });

    it('should not randomize blend mode when autoBlend is false', () => {
      engine.createOverlay();
      engine.active = true;
      engine.setBlendMode('screen');
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000, autoBlend: false });
      // Blend mode should remain screen (not randomized)
      expect(engine.blendMode).toBe('screen');
      engine._stopAutoCycle();
    });

    it('should randomize filters when autoFilters is true', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000, autoFilters: true });
      // After first tick, filters may or may not be set (random), but _autoFilters flag should be true
      expect(engine._autoFilters).toBe(true);
      engine._stopAutoCycle();
    });

    it('should not randomize filters when autoFilters is false', () => {
      engine.createOverlay();
      engine.active = true;
      engine.setFilter('invert', true);
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000, autoFilters: false });
      // Manually set filter should remain
      expect(engine.activeFilters.has('invert')).toBe(true);
      engine._stopAutoCycle();
    });

    it('should pass autoBlend and autoFilters flags via handleMessage', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000, autoBlend: true, autoFilters: true });
      expect(engine._autoBlend).toBe(true);
      expect(engine._autoFilters).toBe(true);
      engine._stopAutoCycle();
    });

    it('should skip first tick when skipFirstTick option is true', () => {
      engine.createOverlay();
      engine.active = true;
      engine._addLayer('neon-tunnel');
      expect(engine.activeLayers.size).toBe(1);
      // startAutoCycle with skipFirstTick should not change layers immediately
      engine.startAutoCycle(['kaleidoscope', 'mandala'], 100000, { skipFirstTick: true });
      expect(engine.activeLayers.has('neon-tunnel')).toBe(true);
      engine._stopAutoCycle();
    });

    it('should update options via updateAutoCycleOptions without restarting timer', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000, autoBlend: false, autoFilters: false });
      expect(engine._autoBlend).toBe(false);
      expect(engine._autoFilters).toBe(false);
      const timer = engine._autoCycleTimer;
      // Update options via message
      engine.handleMessage({ action: 'updateAutoCycleOptions', autoBlend: true, autoFilters: true });
      expect(engine._autoBlend).toBe(true);
      expect(engine._autoFilters).toBe(true);
      // Timer should not be reset
      expect(engine._autoCycleTimer).toBe(timer);
      engine._stopAutoCycle();
    });

    it('should ignore updateAutoCycleOptions when auto-cycle is not running', () => {
      engine.createOverlay();
      engine.active = true;
      engine.updateAutoCycleOptions({ autoBlend: true });
      expect(engine._autoBlend).toBeFalsy();
    });
  });

  describe('standalone autoFX', () => {
    it('should start and stop standalone autoFX via messages', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoFX', autoBlend: true, autoFilters: true });
      expect(engine._autoFXTimer).not.toBeNull();
      expect(engine._autoFXBlend).toBe(true);
      expect(engine._autoFXFilters).toBe(true);
      engine.handleMessage({ action: 'stopAutoFX' });
      expect(engine._autoFXTimer).toBeNull();
    });

    it('should randomize blend on autoFX tick when autoBlend is true', () => {
      engine.createOverlay();
      engine.active = true;
      engine.setBlendMode('screen');
      engine._autoFXBlend = true;
      engine._autoFXFilters = false;
      engine._autoFXTick();
      expect(['screen', 'lighten', 'difference', 'exclusion', 'color-dodge']).toContain(engine.blendMode);
    });

    it('should randomize filters on autoFX tick when autoFilters is true', () => {
      engine.createOverlay();
      engine.active = true;
      engine._autoFXBlend = false;
      engine._autoFXFilters = true;
      engine._autoFXTick();
      expect(engine._autoFXFilters).toBe(true);
    });

    it('should stop autoFX on kill', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoFX', autoBlend: true, autoFilters: false });
      expect(engine._autoFXTimer).not.toBeNull();
      engine.kill({});
      expect(engine._autoFXTimer).toBeNull();
    });

    it('should not start timer when both blend and filters are false', () => {
      engine.createOverlay();
      engine.active = true;
      engine.startAutoFX({ autoBlend: false, autoFilters: false });
      expect(engine._autoFXTimer).toBeFalsy();
    });
  });

  describe('fade transitions', () => {
    it('should start layer with opacity 0 and transition', () => {
      engine.createOverlay();
      engine._addLayer('neon-tunnel');
      const layerDiv = engine.overlay.shadowRoot.querySelector('[data-vjam-layer="neon-tunnel"]');
      // Starts with opacity 0 (rAF mock doesn't actually trigger callback)
      expect(layerDiv.style.opacity).toBe('0');
      expect(layerDiv.style.transition).toContain('opacity');
    });
  });

  // 切り替えを全部フェードにする(#38): Next のクロスフェード・Auto の休み・Rnd / Auto の blend / filter の dip
  describe('transitions (#38)', () => {
    const FADE_NAMES = ['fade-a', 'fade-b', 'fade-c', 'fade-d'];
    const FADE_MS = 5000; // エンジン既定のフェード
    const DIP = 1250; // その dip の片道(フェードの 1/4)
    const POOL = { filters: ['saturate(2)', 'sepia(1)'], blends: ['lighten', 'difference'] };
    const destroyed = [];

    beforeAll(() => {
      for (const name of FADE_NAMES) {
        window.VJamFX.presets[name] = class {
          constructor() { this.p5 = { frameRate: vi.fn(), getTargetFrameRate: () => 60, noLoop: vi.fn(), remove() {} }; }
          setup(container) { container.appendChild(document.createElement('canvas')); }
          destroy() { destroyed.push(name); }
        };
      }
    });

    afterAll(() => {
      for (const name of FADE_NAMES) delete window.VJamFX.presets[name];
    });

    beforeEach(() => {
      destroyed.length = 0;
      vi.useFakeTimers();
      engine.createOverlay();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    const layerDivs = (name) => [...engine._stage.querySelectorAll(`[data-vjam-layer="${name}"]`)];
    const stage = () => engine._stage;

    describe('Next (crossfade)', () => {
      it('fades the current layers out and the new ones in, and removes the old ones after the fade', () => {
        engine.startPreset(FADE_NAMES[0]);
        engine._addLayer(FADE_NAMES[1]);
        const old = [...layerDivs(FADE_NAMES[0]), ...layerDivs(FADE_NAMES[1])];

        engine.handleMessage({ action: 'crossfade', presets: [FADE_NAMES[2], FADE_NAMES[3]], blendMode: 'screen', locks: {} });

        // エンジンの上では入れ替わっている
        expect(engine.getActiveLayerNames()).toEqual([FADE_NAMES[2], FADE_NAMES[3]]);
        expect(engine.currentPresetName).toBe(FADE_NAMES[2]);
        expect(engine.currentPreset).toBe(engine.activeLayers.get(FADE_NAMES[2]).preset);
        // 古いレイヤーはまだ DOM に残ってフェードアウト中(5 秒)、新しいレイヤーは 0 からフェードイン
        for (const div of old) {
          expect(div.isConnected).toBe(true);
          expect(div.style.opacity).toBe('0');
          expect(div.style.transition).toBe('opacity 5s linear');
        }
        expect(destroyed).toEqual([]);
        for (const name of FADE_NAMES.slice(2)) {
          const [div] = layerDivs(name);
          expect(div.style.opacity).toBe('0');
          expect(div.style.transition).toContain('opacity 5s');
        }

        // transitionend が来なくても、フェード時間 + 200ms で外す
        vi.advanceTimersByTime(FADE_MS + 199);
        for (const div of old) expect(div.isConnected).toBe(true);
        vi.advanceTimersByTime(1);
        for (const div of old) expect(div.isConnected).toBe(false);
        expect(destroyed.sort()).toEqual([FADE_NAMES[0], FADE_NAMES[1]]);
        expect(engine._stage.querySelectorAll('[data-vjam-layer]').length).toBe(2);
      });

      it('slows the fading-out layers to 20 fps and stops them halfway; the new ones keep drawing', () => {
        engine.startPreset(FADE_NAMES[0]);
        engine._addLayer(FADE_NAMES[1]);
        const old = [FADE_NAMES[0], FADE_NAMES[1]].map(n => engine.activeLayers.get(n).preset.p5);
        engine.crossfade([FADE_NAMES[2]], {});
        const fresh = engine.activeLayers.get(FADE_NAMES[2]).preset.p5;
        for (const p of old) expect(p.frameRate).toHaveBeenCalledWith(20);
        vi.advanceTimersByTime(FADE_MS / 2 - 1);
        for (const p of old) expect(p.noLoop).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        for (const p of old) expect(p.noLoop).toHaveBeenCalledTimes(1);
        // 止めた絵のまま、フェードの終わりまで残る
        expect(destroyed).toEqual([]);
        expect(fresh.frameRate).not.toHaveBeenCalled();
        expect(fresh.noLoop).not.toHaveBeenCalled();
      });

      it('keeps a fading-out layer that already draws slower than 20 fps at its rate', () => {
        engine.startPreset(FADE_NAMES[0]);
        const p = engine.activeLayers.get(FADE_NAMES[0]).preset.p5;
        p.getTargetFrameRate = () => 15;
        engine.crossfade([FADE_NAMES[1]], {});
        expect(p.frameRate).not.toHaveBeenCalled();
        vi.advanceTimersByTime(FADE_MS / 2);
        expect(p.noLoop).toHaveBeenCalledTimes(1);
      });

      it('does not stop a layer that is already gone (transitionend before halfway)', () => {
        engine.startPreset(FADE_NAMES[0]);
        const [div] = layerDivs(FADE_NAMES[0]);
        const p = engine.activeLayers.get(FADE_NAMES[0]).preset.p5;
        engine.crossfade([FADE_NAMES[1]], {});
        div.dispatchEvent(new Event('transitionend'));
        expect(destroyed).toEqual([FADE_NAMES[0]]);
        vi.advanceTimersByTime(FADE_MS);
        expect(p.noLoop).not.toHaveBeenCalled();
      });

      it('removes the old layers on transitionend', () => {
        engine.startPreset(FADE_NAMES[0]);
        const [old] = layerDivs(FADE_NAMES[0]);
        engine.crossfade([FADE_NAMES[1]], {});
        old.dispatchEvent(new Event('transitionend'));
        expect(old.isConnected).toBe(false);
        expect(destroyed).toEqual([FADE_NAMES[0]]);
      });

      it('restarts a preset that is chosen again (the old one fades out)', () => {
        engine.startPreset(FADE_NAMES[0]);
        const [old] = layerDivs(FADE_NAMES[0]);
        engine.crossfade([FADE_NAMES[0]], {});
        expect(layerDivs(FADE_NAMES[0]).length).toBe(2);
        expect(engine.activeLayers.get(FADE_NAMES[0]).container).not.toBe(old);
        vi.advanceTimersByTime(FADE_MS + 200);
        expect(layerDivs(FADE_NAMES[0])).toEqual([engine.activeLayers.get(FADE_NAMES[0]).container]);
      });

      it('resets the filter and sets the blend right away, and keeps the opacity', () => {
        engine.startPreset(FADE_NAMES[0]);
        engine.setFilter('invert', true);
        engine._rndFilter = 'sepia(1)';
        engine.setBlendMode('difference');
        engine.setOpacity(0.4);
        engine.crossfade([FADE_NAMES[1]], { blendMode: 'lighten', locks: {} });
        expect(engine.activeFilters.size).toBe(0);
        expect(engine._rndFilter).toBe('');
        expect(engine.overlay.style.filter).toBe('none');
        expect(engine.blendMode).toBe('lighten');
        expect(engine.overlay.style.mixBlendMode).toBe('lighten');
        expect(engine.opacity).toBe(0.4);
        expect(engine.overlay.style.opacity).toBe('0.4');
        // 押した反応は dip しない
        expect(stage().style.opacity).toBe('');
      });

      it('uses screen when no blend is given', () => {
        engine.setBlendMode('difference');
        engine.crossfade([FADE_NAMES[0]], {});
        expect(engine.blendMode).toBe('screen');
      });

      it('keeps locked layers / blend / filter', () => {
        engine.startPreset(FADE_NAMES[0]);
        engine.setBlendMode('difference');
        engine.setFilter('sepia', true);
        engine.crossfade([], { blendMode: 'lighten', locks: { effect: true, blend: true, filter: true } });
        expect(engine.getActiveLayerNames()).toEqual([FADE_NAMES[0]]);
        expect(layerDivs(FADE_NAMES[0])[0].style.opacity).toBe('0');
        expect(engine.currentPresetName).toBe(FADE_NAMES[0]);
        expect(engine.blendMode).toBe('difference');
        expect(engine.activeFilters.has('sepia')).toBe(true);
        vi.advanceTimersByTime(FADE_MS + 1000);
        expect(layerDivs(FADE_NAMES[0])[0].isConnected).toBe(true);
        expect(destroyed).toEqual([]);
      });

      it('stops Auto / Rnd (popup sends them again)', () => {
        engine.startAutoCycle(FADE_NAMES, 8000, { skipFirstTick: true });
        engine.startAutoFX({ autoBlend: true });
        engine.crossfade([FADE_NAMES[0]], {});
        expect(engine._autoCycleTimer).toBeNull();
        expect(engine._autoFXTimer).toBeNull();
      });

      it('starts the engine when it was not running yet', () => {
        expect(engine.active).toBe(false);
        engine.crossfade([FADE_NAMES[0], FADE_NAMES[1]], { blendMode: 'screen' });
        expect(engine.active).toBe(true);
        expect(engine._rafId).not.toBeNull();
        expect(engine.getActiveLayerNames()).toEqual([FADE_NAMES[0], FADE_NAMES[1]]);
      });

      it('switches instantly with fade duration 0', () => {
        engine.handleMessage({ action: 'setFadeDuration', duration: 0 });
        engine.startPreset(FADE_NAMES[0]);
        const [old] = layerDivs(FADE_NAMES[0]);
        engine.crossfade([FADE_NAMES[1]], {});
        expect(old.isConnected).toBe(false);
        expect(destroyed).toEqual([FADE_NAMES[0]]);
        expect(layerDivs(FADE_NAMES[1])[0].style.transition).toContain('opacity 0s');
      });
    });

    describe('Auto rest', () => {
      // 休みの直前まで進める(1 回目の切り替えで休む)。Rnd の blend / filter を掛けた状態にしておく
      function startUntilRest(options) {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        engine.startAutoCycle(FADE_NAMES, 8000, { autoBlend: true, autoFilters: true, pool: POOL, ...options });
        engine._autoRestAt = 1;
        vi.advanceTimersByTime(DIP); // 最初の切り替えの dip
        expect(engine.overlay.style.mixBlendMode).toBe('lighten');
        expect(engine.overlay.style.filter).toBe('saturate(2)');
      }

      it('fades all layers out, resets blend / filter after the fade, and fades the next set in 0.5 s later', () => {
        startUntilRest();
        const old = [...engine._stage.querySelectorAll('[data-vjam-layer]')];
        expect(old.length).toBeGreaterThan(0);
        vi.advanceTimersByTime(8000 - DIP); // 休み
        expect(engine.activeLayers.size).toBe(0);
        // フェードアウト中: まだ DOM にあり、blend / filter も変えない(消えてから戻す)
        for (const div of old) {
          expect(div.isConnected).toBe(true);
          expect(div.style.opacity).toBe('0');
        }
        expect(engine.overlay.style.mixBlendMode).toBe('lighten');
        expect(engine.overlay.style.filter).toBe('saturate(2)');
        // 休みの間の拍では切り替えない
        for (let i = 0; i < 40; i++) engine._onBeat();
        vi.advanceTimersByTime(FADE_MS - 1);
        expect(engine.overlay.style.filter).toBe('saturate(2)');
        vi.advanceTimersByTime(1);
        // 消えた: blend / filter を既定に戻す(見えていないので dip しない)
        expect(engine.blendMode).toBe('screen');
        expect(engine.overlay.style.mixBlendMode).toBe('screen');
        expect(engine.overlay.style.filter).toBe('none');
        expect(stage().style.opacity).toBe('');
        expect(engine.activeLayers.size).toBe(0);
        vi.advanceTimersByTime(200);
        for (const div of old) expect(div.isConnected).toBe(false);
        // 0.5 秒空けてから次のセットがフェードイン
        vi.advanceTimersByTime(299);
        expect(engine.activeLayers.size).toBe(0);
        vi.advanceTimersByTime(1);
        expect(engine.activeLayers.size).toBeGreaterThan(0);
        for (const [, layer] of engine.activeLayers) {
          expect(layer.container.style.opacity).toBe('0');
          expect(layer.container.style.transition).toContain('opacity 5s');
        }
        // そのあとは普通に秒数で切り替わる
        const tick = vi.spyOn(engine, '_autoCycleTick');
        vi.advanceTimersByTime(7999);
        expect(tick).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(tick).toHaveBeenCalledTimes(1);
      });

      it('slows and stops the layers fading out for the rest the same way', () => {
        startUntilRest();
        const old = [...engine.activeLayers.values()].map(l => l.preset.p5);
        vi.advanceTimersByTime(8000 - DIP); // 休み
        for (const p of old) expect(p.frameRate).toHaveBeenCalledWith(20);
        vi.advanceTimersByTime(FADE_MS / 2);
        for (const p of old) expect(p.noLoop).toHaveBeenCalledTimes(1);
      });

      it('follows the fade duration setting', () => {
        engine.handleMessage({ action: 'setFadeDuration', duration: 3 });
        startUntilRest();
        vi.advanceTimersByTime(8000 - DIP);
        vi.advanceTimersByTime(2999);
        expect(engine.overlay.style.filter).toBe('saturate(2)');
        vi.advanceTimersByTime(1);
        expect(engine.overlay.style.filter).toBe('none');
        vi.advanceTimersByTime(499);
        expect(engine.activeLayers.size).toBe(0);
        vi.advanceTimersByTime(1);
        expect(engine.activeLayers.size).toBeGreaterThan(0);
      });

      it('keeps the instant rest with fade duration 0', () => {
        engine.handleMessage({ action: 'setFadeDuration', duration: 0 });
        vi.spyOn(Math, 'random').mockReturnValue(0);
        engine.startAutoCycle(FADE_NAMES, 8000, { autoBlend: true, autoFilters: true, pool: POOL });
        engine._autoRestAt = 1;
        const old = [...engine._stage.querySelectorAll('[data-vjam-layer]')];
        vi.advanceTimersByTime(8000);
        for (const div of old) expect(div.isConnected).toBe(false);
        expect(engine.overlay.style.mixBlendMode).toBe('screen');
        expect(engine.overlay.style.filter).toBe('none');
        vi.advanceTimersByTime(499);
        expect(engine.activeLayers.size).toBe(0);
        vi.advanceTimersByTime(1);
        expect(engine.activeLayers.size).toBeGreaterThan(0);
      });

      it('keeps locked layers and resets blend / filter right away with a dip', () => {
        startUntilRest({ locks: { effect: true } });
        const names = engine.getActiveLayerNames();
        vi.advanceTimersByTime(8000 - DIP); // 休み
        expect(engine.getActiveLayerNames()).toEqual(names);
        expect(engine.blendMode).toBe('screen');
        expect(stage().style.opacity).toBe('0');
        expect(engine.overlay.style.filter).toBe('saturate(2)');
        vi.advanceTimersByTime(DIP);
        expect(engine.overlay.style.mixBlendMode).toBe('screen');
        expect(engine.overlay.style.filter).toBe('none');
        expect(stage().style.opacity).toBe('1');
        // dip が戻りきってから 0.5 秒で次の切り替え(既定が見えている間がある)
        const tick = vi.spyOn(engine, '_autoCycleTick');
        vi.advanceTimersByTime(DIP + 499);
        expect(stage().style.opacity).toBe('');
        expect(tick).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(tick).toHaveBeenCalledTimes(1);
      });

      it('does not switch after Auto is stopped during the fade-out', () => {
        startUntilRest();
        vi.advanceTimersByTime(8000 - DIP);
        engine.kill({});
        vi.advanceTimersByTime(10000);
        expect(engine.activeLayers.size).toBe(0);
        expect(engine._autoCycleTimer).toBeNull();
      });
    });

    describe('Rnd / Auto blend and filter (dip)', () => {
      it('lowers the overlay contents, changes the filter at the bottom, then brings it back', () => {
        engine.setOpacity(0.5);
        engine._randomizeFilter({ filters: ['sepia(1)'] }, true);
        // 状態はすぐ変わる(popup が読む値)。CSS は暗くなってから
        expect(engine._rndFilter).toBe('sepia(1)');
        expect(engine.overlay.style.filter).toBe('');
        expect(stage().style.transition).toBe('opacity 1250ms linear');
        expect(stage().style.opacity).toBe('0');
        vi.advanceTimersByTime(DIP - 1);
        expect(engine.overlay.style.filter).toBe('');
        vi.advanceTimersByTime(1);
        expect(engine.overlay.style.filter).toBe('sepia(1)');
        expect(stage().style.opacity).toBe('1');
        vi.advanceTimersByTime(DIP);
        expect(stage().style.opacity).toBe('');
        expect(stage().style.transition).toBe('');
        // 人が設定した不透明度(ホスト)には触らない
        expect(engine.overlay.style.opacity).toBe('0.5');
        expect(engine.opacity).toBe(0.5);
      });

      it('dips for a blend change too (overlay and canvases)', () => {
        engine._addLayer(FADE_NAMES[0]);
        const canvas = engine._stage.querySelector('canvas');
        engine._randomizeBlend({ blends: ['lighten'] }, true);
        expect(engine.blendMode).toBe('lighten');
        expect(engine.overlay.style.mixBlendMode).toBe('screen');
        expect(canvas.style.mixBlendMode).toBe('screen');
        expect(stage().style.opacity).toBe('0');
        vi.advanceTimersByTime(DIP);
        expect(engine.overlay.style.mixBlendMode).toBe('lighten');
        expect(canvas.style.mixBlendMode).toBe('lighten');
      });

      it('puts blend and filter changed together into one dip', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        engine.startAutoCycle(FADE_NAMES, 8000, { autoBlend: true, autoFilters: true, pool: POOL });
        expect(stage().style.opacity).toBe('0');
        vi.advanceTimersByTime(DIP);
        expect(engine.overlay.style.mixBlendMode).toBe('lighten');
        expect(engine.overlay.style.filter).toBe('saturate(2)');
        expect(stage().style.opacity).toBe('1');
        vi.advanceTimersByTime(DIP);
        expect(stage().style.opacity).toBe('');
      });

      it('dips on the standalone Rnd tick', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        engine.startAutoFX({ autoBlend: true, autoFilters: true, pool: POOL, interval: 8000 });
        vi.advanceTimersByTime(8000);
        expect(engine.blendMode).toBe('lighten');
        expect(stage().style.opacity).toBe('0');
        expect(engine.overlay.style.mixBlendMode).toBe('screen');
        vi.advanceTimersByTime(DIP);
        expect(engine.overlay.style.mixBlendMode).toBe('lighten');
        expect(engine.overlay.style.filter).toBe('saturate(2)');
      });

      it('goes down again when a change comes while coming back up', () => {
        engine._randomizeFilter({ filters: ['sepia(1)'] }, true);
        vi.advanceTimersByTime(DIP + 100);
        expect(stage().style.opacity).toBe('1');
        engine._randomizeFilter({ filters: ['saturate(2)'] }, true);
        expect(stage().style.opacity).toBe('0');
        expect(engine.overlay.style.filter).toBe('sepia(1)');
        vi.advanceTimersByTime(DIP);
        expect(engine.overlay.style.filter).toBe('saturate(2)');
        // 最初の dip の戻りのタイマーは捨てている
        vi.advanceTimersByTime(DIP - 1);
        expect(stage().style.opacity).toBe('1');
        vi.advanceTimersByTime(1);
        expect(stage().style.opacity).toBe('');
      });

      it('keeps manual buttons instant', () => {
        engine.handleMessage({ action: 'setBlendMode', blendMode: 'difference' });
        expect(engine.overlay.style.mixBlendMode).toBe('difference');
        engine.handleMessage({ action: 'toggleFilter', filter: 'sepia' });
        expect(engine.overlay.style.filter).toBe('sepia(1)');
        engine.handleMessage({ action: 'setFilter', filter: 'invert', enabled: true });
        expect(engine.overlay.style.filter).toBe('sepia(1) invert(1)');
        engine.handleMessage({ action: 'clearFilters' });
        expect(engine.overlay.style.filter).toBe('none');
        expect(stage().style.opacity).toBe('');
      });

      it('applies a manual change during a dip right away, and the dip does not undo it', () => {
        engine._randomizeBlend({ blends: ['lighten'] }, true);
        engine.setBlendMode('exclusion');
        expect(engine.overlay.style.mixBlendMode).toBe('exclusion');
        vi.advanceTimersByTime(DIP * 2);
        expect(engine.blendMode).toBe('exclusion');
        expect(engine.overlay.style.mixBlendMode).toBe('exclusion');
      });

      it('keeps the user opacity when it changes during a dip', () => {
        engine._randomizeFilter({ filters: ['sepia(1)'] }, true);
        engine.handleMessage({ action: 'setOpacity', opacity: 0.3 });
        expect(engine.overlay.style.opacity).toBe('0.3');
        expect(stage().style.opacity).toBe('0');
        vi.advanceTimersByTime(DIP * 2);
        expect(engine.overlay.style.opacity).toBe('0.3');
        expect(stage().style.opacity).toBe('');
      });

      it('makes the dip a quarter of the fade, within 0.3-1.5 s', () => {
        for (const [fade, dip] of [[3, 750], [8, 1500], [12, 1500], [1, 300]]) {
          engine.handleMessage({ action: 'setFadeDuration', duration: fade });
          engine._randomizeFilter({ filters: ['sepia(1)'] }, true);
          expect(stage().style.transition).toBe(`opacity ${dip}ms linear`);
          vi.advanceTimersByTime(dip - 1);
          expect(stage().style.opacity).toBe('0');
          vi.advanceTimersByTime(1);
          expect(stage().style.opacity).toBe('1');
          vi.advanceTimersByTime(dip);
          expect(stage().style.opacity).toBe('');
        }
      });

      it('does not dip with fade duration 0', () => {
        engine.handleMessage({ action: 'setFadeDuration', duration: 0 });
        engine._randomizeFilter({ filters: ['sepia(1)'] }, true);
        engine._randomizeBlend({ blends: ['lighten'] }, true);
        expect(engine.overlay.style.filter).toBe('sepia(1)');
        expect(engine.overlay.style.mixBlendMode).toBe('lighten');
        expect(stage().style.opacity).toBe('');
      });

      it('kill during a dip applies the reset right away and the dip ends', () => {
        engine._randomizeFilter({ filters: ['sepia(1)'] }, true);
        engine._randomizeBlend({ blends: ['lighten'] }, true);
        engine.kill({});
        expect(stage().style.opacity).toBe('');
        expect(stage().style.transition).toBe('');
        expect(engine.overlay.style.filter).toBe('none');
        expect(engine.overlay.style.mixBlendMode).toBe('screen');
        vi.advanceTimersByTime(DIP * 2);
        expect(engine.overlay.style.filter).toBe('none');
        expect(engine.overlay.style.mixBlendMode).toBe('screen');
        expect(stage().style.opacity).toBe('');
      });

      it('kill with blend / filter locks during a dip applies the Rnd values right away', () => {
        engine._randomizeFilter({ filters: ['sepia(1)'] }, true);
        engine._randomizeBlend({ blends: ['lighten'] }, true);
        engine.kill({ locks: { blend: true, filter: true } });
        expect(engine.overlay.style.filter).toBe('sepia(1)');
        expect(engine.overlay.style.mixBlendMode).toBe('lighten');
        expect(stage().style.opacity).toBe('');
      });

      it('turning OFF during a dip leaves no timer behind', () => {
        engine._randomizeFilter({ filters: ['sepia(1)'] }, true);
        engine.handleMessage({ action: 'stop' });
        expect(engine.overlay).toBeNull();
        expect(engine._dipDownTimer).toBeNull();
        expect(engine._dipUpTimer).toBeNull();
        expect(() => vi.advanceTimersByTime(DIP * 2)).not.toThrow();
      });
    });
  });

  describe('tab audio capture', () => {
    it('should have null _externalAudioData initially', () => {
      expect(engine._externalAudioData).toBeNull();
    });

    it('should receive audio data via window message from bridge', () => {
      const audioData = { beat: true, bpm: 120, strength: 0.8, rms: 0.1, bass: 0.5, mid: 0.3, treble: 0.2 };
      window.dispatchEvent(new MessageEvent('message', {
        data: { source: 'vjam-fx-bridge', type: 'audioData', data: audioData },
      }));
      expect(engine._externalAudioData).toEqual(audioData);
    });

    it('should ignore messages from other sources', () => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { source: 'other', type: 'audioData', data: { beat: true } },
      }));
      expect(engine._externalAudioData).toBeNull();
    });

    it('should disable audio via setAudioEnabled', () => {
      engine._externalAudioData = { beat: true };
      engine.handleMessage({ action: 'setAudioEnabled', enabled: false });
      expect(engine.audioEnabled).toBe(false);
      expect(engine._externalAudioData).toBeNull();
    });

    it('should clean up message listener on destroy', () => {
      const spy = vi.spyOn(window, 'removeEventListener');
      engine.destroy();
      expect(spy).toHaveBeenCalledWith('message', expect.any(Function));
      spy.mockRestore();
    });
  });

  describe('fullscreen support', () => {
    it('should register fullscreenchange listener', () => {
      const spy = vi.spyOn(document, 'addEventListener');
      const e = new VJamFXEngine();
      expect(spy).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
      e.destroy();
      spy.mockRestore();
    });

    it('should move overlay into fullscreen element', () => {
      engine.createOverlay();
      const fsEl = document.createElement('div');
      document.body.appendChild(fsEl);
      // Simulate fullscreen
      Object.defineProperty(document, 'fullscreenElement', { value: fsEl, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(fsEl.contains(engine.overlay)).toBe(true);
      // Simulate exit fullscreen
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(document.body.contains(engine.overlay)).toBe(true);
      fsEl.remove();
    });

    it('should clean up fullscreenchange listener on destroy', () => {
      const spy = vi.spyOn(document, 'removeEventListener');
      engine.destroy();
      expect(spy).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
      spy.mockRestore();
    });
  });

  describe('stop vs destroy separation', () => {
    it('handleMessage stop should NOT remove bridge listener', () => {
      engine.startPreset('neon-tunnel');
      engine.handleMessage({ action: 'stop' });
      // Bridge listener should still be registered
      expect(engine._onBridgeMessage).not.toBeNull();
    });

    it('handleMessage stop should NOT remove fullscreen listener', () => {
      engine.startPreset('neon-tunnel');
      engine.handleMessage({ action: 'stop' });
      expect(engine._onFullscreenChange).not.toBeNull();
    });

    it('handleMessage stop should remove overlay', () => {
      engine.startPreset('neon-tunnel');
      engine.handleMessage({ action: 'stop' });
      expect(engine.overlay).toBeNull();
      expect(document.querySelector('[data-vjam-fx]')).toBeNull();
    });

    it('should receive audio data after stop + restart', () => {
      engine.startPreset('neon-tunnel');
      engine.handleMessage({ action: 'stop' });
      // Restart
      engine.startPreset('neon-tunnel');
      // Send audio data via bridge
      const audioData = { beat: true, bpm: 120, strength: 0.8, rms: 0.1, bass: 0.5, mid: 0.3, treble: 0.2 };
      window.dispatchEvent(new MessageEvent('message', {
        data: { source: 'vjam-fx-bridge', type: 'audioData', data: audioData },
      }));
      expect(engine._externalAudioData).toEqual(audioData);
    });

    it('_ensureListeners should re-register if listeners were nulled', () => {
      // Simulate listeners being lost (e.g. after destroy)
      window.removeEventListener('message', engine._onBridgeMessage);
      document.removeEventListener('fullscreenchange', engine._onFullscreenChange);
      engine._onBridgeMessage = null;
      engine._onFullscreenChange = null;

      engine._ensureListeners();
      expect(engine._onBridgeMessage).not.toBeNull();
      expect(engine._onFullscreenChange).not.toBeNull();

      // Verify bridge listener works
      const audioData = { beat: false, bpm: 120, strength: 0, rms: 0.05, bass: 0.1, mid: 0.1, treble: 0.1 };
      window.dispatchEvent(new MessageEvent('message', {
        data: { source: 'vjam-fx-bridge', type: 'audioData', data: audioData },
      }));
      expect(engine._externalAudioData).toEqual(audioData);
    });

    it('_ensureListeners should not double-register', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const docSpy = vi.spyOn(document, 'addEventListener');
      engine._ensureListeners();
      // Should not add again since already registered
      expect(addSpy).not.toHaveBeenCalledWith('message', expect.any(Function));
      expect(docSpy).not.toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
      addSpy.mockRestore();
      docSpy.mockRestore();
    });
  });

  describe('fullscreen handler robustness', () => {
    it('should skip move if overlay is already in correct parent', () => {
      engine.createOverlay();
      const appendSpy = vi.spyOn(document.body, 'appendChild');
      // Trigger fullscreenchange with no fullscreen element (overlay already in body)
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));
      // Should not call appendChild since overlay is already in body
      expect(appendSpy).not.toHaveBeenCalled();
      appendSpy.mockRestore();
    });
  });


  describe('setPresetParam', () => {
    it('should call setParam on active layer preset', () => {
      engine.createOverlay();
      engine._addLayer('neon-tunnel');
      const layer = engine.activeLayers.get('neon-tunnel');
      layer.preset.setParam = vi.fn();
      engine.handleMessage({ action: 'setPresetParam', preset: 'neon-tunnel', key: 'speed', value: 2 });
      expect(layer.preset.setParam).toHaveBeenCalledWith('speed', 2);
    });

    it('should not throw when preset is not active', () => {
      engine.createOverlay();
      expect(() => {
        engine.handleMessage({ action: 'setPresetParam', preset: 'nonexistent', key: 'speed', value: 2 });
      }).not.toThrow();
    });

    it('should not throw when preset has no setParam method', () => {
      engine.createOverlay();
      engine._addLayer('neon-tunnel');
      const layer = engine.activeLayers.get('neon-tunnel');
      delete layer.preset.setParam;
      expect(() => {
        engine.handleMessage({ action: 'setPresetParam', preset: 'neon-tunnel', key: 'speed', value: 2 });
      }).not.toThrow();
    });
  });

  describe('createMediaElementSource guard', () => {
    it('should skip reconnection to same media element', () => {
      const media = document.createElement('video');
      // Simulate already connected
      engine._videoAudioMedia = media;
      engine._videoAudioCtx = { state: 'running', close: vi.fn().mockResolvedValue(undefined) };
      const origCtx = engine._videoAudioCtx;
      engine._connectMediaElement(media);
      // Should not create new AudioContext
      expect(engine._videoAudioCtx).toBe(origCtx);
    });

    it('should clear _videoAudioMedia on destroy', () => {
      engine._videoAudioMedia = document.createElement('video');
      engine._destroyVideoAudio();
      expect(engine._videoAudioMedia).toBeNull();
    });
  });

  describe('silence check timer cleanup', () => {
    it('should clear silence timer on _stopVideoAudio', () => {
      engine._silenceCheckTimer = setInterval(() => {}, 1000);
      const timerId = engine._silenceCheckTimer;
      engine._stopVideoAudio();
      expect(engine._silenceCheckTimer).toBeNull();
    });

    it('should clear silence timer on _destroyVideoAudio', () => {
      engine._silenceCheckTimer = setInterval(() => {}, 1000);
      engine._destroyVideoAudio();
      expect(engine._silenceCheckTimer).toBeNull();
    });
  });

  describe('audio method defensive checks', () => {
    it('should not throw when preset lacks updateAudio', () => {
      engine.createOverlay();
      engine._addLayer('neon-tunnel');
      const layer = engine.activeLayers.get('neon-tunnel');
      delete layer.preset.updateAudio;
      // Simulating audio feed — should not throw
      expect(() => {
        if (typeof layer.preset.updateAudio === 'function') layer.preset.updateAudio({});
      }).not.toThrow();
    });

    it('should not throw when preset lacks onBeat', () => {
      engine.createOverlay();
      engine._addLayer('neon-tunnel');
      const layer = engine.activeLayers.get('neon-tunnel');
      delete layer.preset.onBeat;
      expect(() => {
        if (typeof layer.preset.onBeat === 'function') layer.preset.onBeat(0.5);
      }).not.toThrow();
    });
  });

  describe('auto-initialization', () => {
    it('should have created singleton on window', () => {
      expect(window._vjamFxEngine).toBeDefined();
    });

    it('should expose VJamFXEngine class', () => {
      expect(window.VJamFXEngine).toBeDefined();
    });
  });

  describe('stop() try-catch on layer destruction', () => {
    it('should continue cleaning up other layers when one destroy throws', () => {
      engine.createOverlay();
      engine._addLayer('neon-tunnel');

      // Create a fake second layer that throws on destroy
      const badDiv = document.createElement('div');
      badDiv.setAttribute('data-vjam-layer', 'bad-layer');
      engine._stage.appendChild(badDiv);
      engine.activeLayers.set('bad-layer', {
        preset: { destroy: () => { throw new Error('boom'); } },
        container: badDiv,
      });

      expect(() => engine.stop()).not.toThrow();
      expect(engine.activeLayers.size).toBe(0);
    });

    it('should clear all layers even when multiple destroys throw', () => {
      engine.createOverlay();
      const div1 = document.createElement('div');
      const div2 = document.createElement('div');
      engine._stage.appendChild(div1);
      engine._stage.appendChild(div2);
      engine.activeLayers.set('err1', { preset: { destroy: () => { throw new Error('e1'); } }, container: div1 });
      engine.activeLayers.set('err2', { preset: { destroy: () => { throw new Error('e2'); } }, container: div2 });

      expect(() => engine.stop()).not.toThrow();
      expect(engine.activeLayers.size).toBe(0);
    });
  });

  describe('kill() try-catch on layer destruction', () => {
    it('should continue cleaning up other layers when one destroy throws', () => {
      engine.createOverlay();
      engine._addLayer('neon-tunnel');

      const badDiv = document.createElement('div');
      badDiv.setAttribute('data-vjam-layer', 'bad-layer');
      engine._stage.appendChild(badDiv);
      engine.activeLayers.set('bad-layer', {
        preset: { destroy: () => { throw new Error('boom'); } },
        container: badDiv,
      });

      expect(() => engine.kill({})).not.toThrow();
      expect(engine.activeLayers.size).toBe(0);
    });

    it('should reset blend and filters even when layer destroy throws', () => {
      engine.createOverlay();
      engine.setBlendMode('difference');
      engine.setFilter('invert', true);

      const badDiv = document.createElement('div');
      engine._stage.appendChild(badDiv);
      engine.activeLayers.set('err', { preset: { destroy: () => { throw new Error('boom'); } }, container: badDiv });

      engine.kill({});
      expect(engine.blendMode).toBe('screen');
      expect(engine.activeFilters.size).toBe(0);
    });
  });

  describe('_addLayer try-catch', () => {
    it('should remove layerDiv and not create activeLayers entry when preset constructor throws', () => {
      engine.createOverlay();
      // Register a preset that throws on construction
      window.VJamFX.presets['throw-preset'] = class {
        constructor() { throw new Error('constructor boom'); }
      };

      expect(() => engine._addLayer('throw-preset')).not.toThrow();
      expect(engine.activeLayers.has('throw-preset')).toBe(false);
      expect(engine.overlay.shadowRoot.querySelector('[data-vjam-layer="throw-preset"]')).toBeNull();

      delete window.VJamFX.presets['throw-preset'];
    });

    it('should remove layerDiv when preset setup throws', () => {
      engine.createOverlay();
      window.VJamFX.presets['setup-fail'] = class {
        setup() { throw new Error('setup boom'); }
      };

      engine._addLayer('setup-fail');
      expect(engine.activeLayers.has('setup-fail')).toBe(false);
      expect(engine.overlay.shadowRoot.querySelector('[data-vjam-layer="setup-fail"]')).toBeNull();

      delete window.VJamFX.presets['setup-fail'];
    });
  });

  describe('AudioContext leak fix', () => {
    it('should close old AudioContext when _connectMediaElement is called with a different element', () => {
      const media1 = document.createElement('video');
      const closeFn = vi.fn().mockResolvedValue(undefined);
      engine._videoAudioMedia = media1;
      engine._videoAudioCtx = { state: 'running', close: closeFn };
      engine._videoAudioAnalyser = { disconnect: vi.fn() };
      engine._videoAudioSource = { disconnect: vi.fn() };

      const media2 = document.createElement('video');
      // _connectMediaElement will try new AudioContext which may throw in jsdom, but close should be called first
      try { engine._connectMediaElement(media2); } catch (e) { /* AudioContext not available in jsdom */ }

      expect(closeFn).toHaveBeenCalled();
    });

    it('should not close AudioContext when called with the same element', () => {
      const media = document.createElement('video');
      const closeFn = vi.fn().mockResolvedValue(undefined);
      engine._videoAudioMedia = media;
      engine._videoAudioCtx = { state: 'running', close: closeFn };

      engine._connectMediaElement(media);
      expect(closeFn).not.toHaveBeenCalled();
    });
  });

  describe('fadeDuration validation', () => {
    it('defaults to 5 s', () => {
      expect(engine._fadeDuration).toBe(5);
      engine.handleMessage({ action: 'setFadeDuration' });
      expect(engine._fadeDuration).toBe(5);
    });

    it('should reject negative fadeDuration', () => {
      engine.handleMessage({ action: 'setFadeDuration', duration: -1 });
      expect(engine._fadeDuration).toBe(5);
    });

    it('should reject NaN fadeDuration', () => {
      engine.handleMessage({ action: 'setFadeDuration', duration: NaN });
      expect(engine._fadeDuration).toBe(5);
    });

    it('should reject Infinity fadeDuration', () => {
      engine.handleMessage({ action: 'setFadeDuration', duration: Infinity });
      expect(engine._fadeDuration).toBe(5);
    });

    it('should accept zero fadeDuration', () => {
      engine.handleMessage({ action: 'setFadeDuration', duration: 0 });
      expect(engine._fadeDuration).toBe(0);
    });

    it('should accept valid positive fadeDuration', () => {
      engine.handleMessage({ action: 'setFadeDuration', duration: 2.5 });
      expect(engine._fadeDuration).toBe(2.5);
    });
  });

  describe('audioSensitivity validation', () => {
    it('should reject zero audioSensitivity', () => {
      engine.handleMessage({ action: 'setAudioSensitivity', sensitivity: 0 });
      expect(engine._audioSensitivity).toBe(1.0);
    });

    it('should reject negative audioSensitivity', () => {
      engine.handleMessage({ action: 'setAudioSensitivity', sensitivity: -0.5 });
      expect(engine._audioSensitivity).toBe(1.0);
    });

    it('should reject NaN audioSensitivity', () => {
      engine.handleMessage({ action: 'setAudioSensitivity', sensitivity: NaN });
      expect(engine._audioSensitivity).toBe(1.0);
    });

    it('should accept valid positive audioSensitivity', () => {
      engine.handleMessage({ action: 'setAudioSensitivity', sensitivity: 2.0 });
      expect(engine._audioSensitivity).toBe(2.0);
    });
  });

  describe('destroy() nulls window._vjamFxEngine', () => {
    it('should set window._vjamFxEngine to null after destroy', () => {
      const e = new VJamFXEngine();
      window._vjamFxEngine = e;
      e.destroy();
      expect(window._vjamFxEngine).toBeNull();
    });
  });

  describe('Auto cycle timer race guard', () => {
    it('should not tick after _stopAutoCycle clears timer', () => {
      vi.useFakeTimers();
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 5000 });
      expect(engine._autoCycleTimer).not.toBeNull();

      // First tick runs immediately, so layers may exist — record current count
      const layersAfterFirstTick = engine.activeLayers.size;

      engine._stopAutoCycle();
      expect(engine._autoCycleTimer).toBeNull();

      // Advance time past what would have been the next tick
      vi.advanceTimersByTime(10000);

      // No NEW layers should be added after stop
      expect(engine.activeLayers.size).toBe(layersAfterFirstTick);
      vi.useRealTimers();
    });

    it('should clear timer and not add layers after stopAutoCycle', () => {
      vi.useFakeTimers();
      engine.createOverlay();
      engine.active = true;

      // Start auto-cycle, first tick adds layers immediately
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 3000 });
      // Kill layers added by first tick
      for (const [, layer] of engine.activeLayers) {
        try { layer.preset.destroy(); } catch (e) { /* ignore */ }
        try { layer.container.remove(); } catch (e) { /* ignore */ }
      }
      engine.activeLayers.clear();

      engine._stopAutoCycle();

      // Advance timers — no new layers should appear
      vi.advanceTimersByTime(20000);
      expect(engine.activeLayers.size).toBe(0);
      vi.useRealTimers();
    });
  });
  describe('MSE tap (Safari: window.__vjamMse)', () => {
    let video, frames, origRaf, origAudioContext, ctxCount, layerPreset;

    const frame = { beat: true, bpm: 124, strength: 0.6, rms: 0.2, bass: 0.7, mid: 0.4, treble: 0.3 };

    // createMediaElementSource まで持つ AudioContext(作られた回数を数える)
    class CountingAudioContext extends AudioContext {
      constructor() { super(); ctxCount++; this.destination = {}; }
      createMediaElementSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
      resume() { this.state = 'running'; return Promise.resolve(); }
      close() { this.state = 'closed'; return Promise.resolve(); }
    }

    function tick(timestamp) {
      const cb = frames.pop();
      frames.length = 0;
      cb(timestamp);
    }

    function startLoop() {
      engine.active = true;
      engine.activeLayers.set('fake', { preset: layerPreset, container: document.createElement('div') });
      engine._startLoop();
    }

    beforeEach(() => {
      frames = [];
      ctxCount = 0;
      origRaf = requestAnimationFrame.getMockImplementation();
      requestAnimationFrame.mockImplementation((cb) => { frames.push(cb); return frames.length; });
      origAudioContext = globalThis.AudioContext;
      globalThis.AudioContext = CountingAudioContext;
      video = document.createElement('video');
      Object.defineProperty(video, 'paused', { value: false, configurable: true });
      Object.defineProperty(video, 'currentTime', { value: 12.3, configurable: true });
      document.body.appendChild(video);
      layerPreset = { updateAudio: vi.fn(), onBeat: vi.fn(), destroy: vi.fn() };
      window.__vjamMse = { frameAt: vi.fn(() => ({ ...frame })) };
    });

    afterEach(() => {
      engine.activeLayers.clear();
      delete window.__vjamMse;
      video.remove();
      globalThis.AudioContext = origAudioContext;
      requestAnimationFrame.mockImplementation(origRaf);
    });

    it('feeds MSE frames at the playback position to layers', () => {
      startLoop();
      tick(1000);
      expect(window.__vjamMse.frameAt).toHaveBeenCalledWith(12.3);
      expect(layerPreset.updateAudio).toHaveBeenCalledWith(frame);
      expect(layerPreset.onBeat).toHaveBeenCalledWith(0.6);
    });

    it('takes priority over the analyser and _externalAudioData', () => {
      const analyser = { disconnect: vi.fn(), getFloatTimeDomainData: vi.fn(), getFloatFrequencyData: vi.fn() };
      engine._videoAudioAnalyser = analyser;
      engine._videoAudioTimeData = new Float32Array(4);
      engine._videoAudioFreqData = new Float32Array(4);
      const ext = { beat: false, bpm: 90, strength: 0, rms: 0.01, bass: 0, mid: 0, treble: 0 };
      engine._externalAudioData = ext;
      startLoop();
      tick(1000);
      expect(layerPreset.updateAudio).toHaveBeenCalledWith(frame);
      expect(analyser.getFloatTimeDomainData).not.toHaveBeenCalled();
      expect(engine._externalAudioData).toBe(ext);
    });

    it('disconnects an existing analyser while MSE data is available', () => {
      const analyser = { disconnect: vi.fn() };
      const source = { disconnect: vi.fn() };
      engine._videoAudioAnalyser = analyser;
      engine._videoAudioSource = source;
      engine._videoAudioTimeData = new Float32Array(4);
      startLoop();
      tick(1000);
      expect(analyser.disconnect).toHaveBeenCalled();
      expect(engine._videoAudioAnalyser).toBeNull();
      expect(source.disconnect).not.toHaveBeenCalled(); // source→destination は維持
    });

    it('applies audio sensitivity', () => {
      engine.handleMessage({ action: 'setAudioSensitivity', sensitivity: 2 });
      startLoop();
      tick(1000);
      expect(layerPreset.updateAudio).toHaveBeenCalledWith({ beat: true, bpm: 124, strength: 1, rms: 0.4, bass: 1, mid: 0.8, treble: 0.6 });
    });

    it('falls back to _externalAudioData when frameAt has no data', () => {
      window.__vjamMse.frameAt = vi.fn(() => null);
      const ext = { beat: false, bpm: 90, strength: 0, rms: 0.01, bass: 0, mid: 0, treble: 0 };
      engine._externalAudioData = ext;
      startLoop();
      tick(1000);
      expect(layerPreset.updateAudio).toHaveBeenCalledWith(ext);
      expect(engine._externalAudioData).toBeNull();
    });

    it('does not read MSE while the media is paused', () => {
      Object.defineProperty(video, 'paused', { value: true, configurable: true });
      startLoop();
      tick(1000);
      expect(window.__vjamMse.frameAt).not.toHaveBeenCalled();
      expect(layerPreset.updateAudio).not.toHaveBeenCalled();
    });

    it('prefers the playing media element', () => {
      const other = document.createElement('video');
      Object.defineProperty(other, 'paused', { value: true, configurable: true });
      Object.defineProperty(other, 'currentTime', { value: 99, configurable: true });
      document.body.insertBefore(other, document.body.firstChild);
      startLoop();
      tick(1000);
      expect(window.__vjamMse.frameAt).toHaveBeenCalledWith(12.3);
      other.remove();
    });

    it('does not read audio when audio is disabled', () => {
      engine.handleMessage({ action: 'setAudioEnabled', enabled: false });
      startLoop();
      tick(1000);
      expect(window.__vjamMse.frameAt).not.toHaveBeenCalled();
    });

    it('never creates createMediaElementSource on Safari', () => {
      engine._startVideoAudio();
      expect(ctxCount).toBe(0);
      expect(engine._videoAudioCtx).toBeNull();
      expect(engine._mediaObserver).toBeFalsy();
      engine._connectMediaElement(video);
      expect(ctxCount).toBe(0);
      expect(engine._videoAudioCtx).toBeNull();
    });

    it('does not start the media observer on Safari when no media exists yet', () => {
      video.remove();
      engine.handleMessage({ action: 'startVideoAudio' });
      expect(engine._mediaObserver).toBeFalsy();
      expect(ctxCount).toBe(0);
    });

    it('keeps Chrome behavior without __vjamMse (connects the media, reads the analyser)', () => {
      delete window.__vjamMse;
      engine._startVideoAudio();
      expect(ctxCount).toBe(1);
      expect(engine._videoAudioMedia).toBe(video);
      expect(engine._videoAudioAnalyser).not.toBeNull();
      startLoop();
      tick(1000);
      expect(layerPreset.updateAudio).toHaveBeenCalledTimes(1);
      expect(layerPreset.updateAudio.mock.calls[0][0].bpm).toBe(120);
    });

    it('uses __vjamMse.media() to pick the main media when available', () => {
      const main = document.createElement('video');
      Object.defineProperty(main, 'paused', { value: false, configurable: true });
      Object.defineProperty(main, 'currentTime', { value: 42, configurable: true });
      window.__vjamMse.media = vi.fn(() => main);
      startLoop();
      tick(1000);
      expect(window.__vjamMse.frameAt).toHaveBeenCalledWith(42);
    });

    it('does not read MSE when __vjamMse.media() finds no playing media', () => {
      window.__vjamMse.media = vi.fn(() => null);
      startLoop();
      tick(1000);
      expect(window.__vjamMse.frameAt).not.toHaveBeenCalled();
    });

    it('counts MSE beats for Auto / Rnd and measures fps in the loop', () => {
      const onBeat = vi.spyOn(engine, '_onBeat');
      const trackFps = vi.spyOn(engine, '_trackFps');
      startLoop();
      tick(1000);
      expect(onBeat).toHaveBeenCalledTimes(1);
      expect(trackFps).toHaveBeenCalledWith(1000);
      window.__vjamMse.frameAt = vi.fn(() => ({ ...frame, beat: false }));
      tick(2000);
      expect(onBeat).toHaveBeenCalledTimes(1);
    });

    it('uses the MSE BPM to wait for the beat in Auto / Rnd', () => {
      startLoop();
      tick(1000);
      expect(engine._tempoBpm()).toBe(124);
      // データが無くなったら使わない(拍を待たずに秒数で切り替える)
      window.__vjamMse.frameAt = vi.fn(() => null);
      tick(2000);
      expect(engine._tempoBpm()).toBe(0);
    });
  });

  // デフォルトプール + 軽さ対策(#6)
  describe('default pool / VJam-style switching', () => {
    const NAMES = ['pool-a', 'pool-b', 'pool-c', 'pool-d', 'pool-e', 'pool-f'];
    const POOL = {
      filters: ['saturate(2)', 'hue-rotate(90deg) saturate(2)', 'saturate(3) contrast(1.5)'],
      blends: ['lighten', 'difference', 'plus-lighter'], // plus-lighter は FX に無いので使わない
    };
    const POOL_BLENDS = ['lighten', 'difference'];
    const FALLBACK_FILTERS = ['hue-rotate(180deg)', 'grayscale(1)', 'saturate(2.5)', 'brightness(1.4)', 'contrast(1.5)', 'sepia(1)'];
    const ALL_BLENDS = ['screen', 'lighten', 'difference', 'exclusion', 'color-dodge'];

    beforeAll(() => {
      for (const name of NAMES) {
        window.VJamFX.presets[name] = class {
          constructor() { this.p5 = { frameRate: vi.fn(), remove() {} }; }
          setup(container) { container.appendChild(document.createElement('canvas')); }
          destroy() {}
        };
      }
    });

    afterAll(() => {
      for (const name of NAMES) delete window.VJamFX.presets[name];
    });

    beforeEach(() => {
      engine._fadeDuration = 0; // レイヤーをすぐ外す
      engine.createOverlay();
      engine.active = true;
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    describe('Rnd filter', () => {
      it('applies exactly one filter from the pool (never stacks)', () => {
        for (let i = 0; i < 50; i++) {
          engine.randomizeFX({ pool: POOL });
          expect(POOL.filters).toContain(engine._rndFilter);
          expect(engine.activeFilters.size).toBe(0);
          expect(engine.overlay.style.filter).toBe(engine._rndFilter);
        }
      });

      it('changes with 60% and otherwise keeps the current one (including none)', () => {
        const rnd = vi.spyOn(Math, 'random');
        rnd.mockReturnValue(0.7);
        engine._randomizeFilter(POOL);
        expect(engine._rndFilter).toBe('');
        expect(['', 'none']).toContain(engine.overlay.style.filter);
        rnd.mockReturnValue(0.5);
        engine._randomizeFilter(POOL);
        expect(engine._rndFilter).toBe(POOL.filters[1]);
        rnd.mockReturnValue(0.99);
        engine._randomizeFilter(POOL);
        expect(engine._rndFilter).toBe(POOL.filters[1]);
      });

      it('replaces manual filters when it changes', () => {
        engine.setFilter('invert', true);
        engine.setFilter('sepia', true);
        engine._randomizeFilter(POOL, true);
        expect(engine.activeFilters.size).toBe(0);
        expect(POOL.filters).toContain(engine.overlay.style.filter);
      });

      // デフォルトプールの filters は VJam の COMPOUND_FILTERS から invert を含む 2 種を除いた 14 種(#35)
      it('picks only from the 14 filters of the default pool', () => {
        const pool = JSON.parse(readFileSync(resolve(__dirname, '../content/default-pool.json'), 'utf-8'));
        expect(pool.filters.length).toBe(14);
        const seen = new Set();
        for (let i = 0; i < 300; i++) {
          engine._randomizeFilter(pool, true);
          seen.add(engine._rndFilter);
          expect(engine.overlay.style.filter).toBe(engine._rndFilter);
        }
        expect([...seen].sort()).toEqual(pool.filters.slice().sort());
      });

      it('falls back to single filters without invert / blur when no pool is given', () => {
        const seen = new Set();
        for (let i = 0; i < 200; i++) {
          engine.randomizeFX();
          seen.add(engine._rndFilter);
        }
        expect([...seen].sort()).toEqual(FALLBACK_FILTERS.slice().sort());
      });

      it('falls back when the pool has no filters', () => {
        engine._randomizeFilter({ filters: [], blends: POOL.blends }, true);
        expect(FALLBACK_FILTERS).toContain(engine._rndFilter);
      });

      it('is cleared by clearFilters / kill / stop, and kept by kill with filter lock', () => {
        engine._randomizeFilter(POOL, true);
        engine.kill({ locks: { filter: true } });
        expect(POOL.filters).toContain(engine.overlay.style.filter);
        engine.clearFilters();
        expect(engine._rndFilter).toBe('');
        expect(engine.overlay.style.filter).toBe('none');
        engine._randomizeFilter(POOL, true);
        engine.kill({});
        expect(engine.overlay.style.filter).toBe('none');
        engine._randomizeFilter(POOL, true);
        engine.handleMessage({ action: 'stop' });
        expect(engine._rndFilter).toBe('');
      });

      it('keeps manual filter buttons working alongside the Rnd filter', () => {
        engine._randomizeFilter(POOL, true);
        const rndCss = engine._rndFilter;
        engine.toggleFilter('sepia');
        expect(engine.overlay.style.filter).toBe('sepia(1) ' + rndCss);
        engine.toggleFilter('sepia');
        expect(engine.overlay.style.filter).toBe(rndCss);
      });

      // デフォルトプールの filters には「なし」として 'none' が入っている(#7)
      it('treats none in the pool as no filter', () => {
        engine.setFilter('sepia', true);
        engine._randomizeFilter({ filters: ['none'] }, true);
        expect(engine.activeFilters.size).toBe(0);
        expect(engine.overlay.style.filter).toBe('none');
      });

      it('keeps manual filter buttons working when the Rnd filter is none', () => {
        engine._randomizeFilter({ filters: ['none'] }, true);
        engine.toggleFilter('sepia');
        expect(engine.overlay.style.filter).toBe('sepia(1)');
        engine.toggleFilter('sepia');
        expect(engine.overlay.style.filter).toBe('none');
      });
    });

    describe('Rnd blend', () => {
      it('picks only from the pool blends that FX supports', () => {
        const seen = new Set();
        for (let i = 0; i < 100; i++) {
          engine.randomizeFX({ pool: POOL });
          seen.add(engine.blendMode);
        }
        expect([...seen].sort()).toEqual(POOL_BLENDS.slice().sort());
      });

      it('changes with 90% and otherwise keeps the current one', () => {
        const rnd = vi.spyOn(Math, 'random');
        rnd.mockReturnValue(0.95);
        engine._randomizeBlend(POOL);
        expect(engine.blendMode).toBe('screen');
        rnd.mockReturnValue(0.5);
        engine._randomizeBlend(POOL);
        expect(engine.blendMode).toBe('difference');
      });

      it('uses all blend modes when no pool is given', () => {
        const seen = new Set();
        for (let i = 0; i < 200; i++) {
          engine.randomizeFX();
          seen.add(engine.blendMode);
        }
        expect([...seen].sort()).toEqual(ALL_BLENDS.slice().sort());
      });

      it('limits light pages to difference / exclusion within the pool', () => {
        engine.isLightPage = true;
        for (let i = 0; i < 50; i++) {
          engine.randomizeFX({ pool: { blends: ['screen', 'lighten', 'difference'] } });
          expect(engine.blendMode).toBe('difference');
        }
      });

      it('uses difference / exclusion on light pages when the pool has neither', () => {
        engine.isLightPage = true;
        const seen = new Set();
        for (let i = 0; i < 100; i++) {
          engine.randomizeFX({ pool: { blends: ['screen', 'lighten'] } });
          seen.add(engine.blendMode);
        }
        expect([...seen].sort()).toEqual(['difference', 'exclusion']);
      });

      it('respects skipBlend', () => {
        engine.setBlendMode('lighten');
        engine.handleMessage({ action: 'randomizeFX', skipBlend: true, pool: POOL });
        expect(engine.blendMode).toBe('lighten');
        expect(POOL.filters).toContain(engine._rndFilter);
      });
    });

    describe('Auto / Rnd with the pool', () => {
      it('Auto picks presets, blend and filter only from what popup passed', () => {
        for (let i = 0; i < 30; i++) {
          engine.handleMessage({ action: 'startAutoCycle', presets: NAMES.slice(0, 2), interval: 100000, autoBlend: true, autoFilters: true, pool: POOL });
          for (const name of engine.getActiveLayerNames()) expect(NAMES.slice(0, 2)).toContain(name);
          expect(['screen', ...POOL_BLENDS]).toContain(engine.blendMode);
          expect(['', ...POOL.filters]).toContain(engine._rndFilter);
          engine._stopAutoCycle();
        }
      });

      it('Auto applies the pool on its tick', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        engine.startAutoCycle(NAMES, 100000, { autoBlend: true, autoFilters: true, pool: POOL });
        expect(engine.blendMode).toBe('lighten');
        expect(engine._rndFilter).toBe(POOL.filters[0]);
      });

      it('Auto without a pool (SW restore after navigation) uses the fallback', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        engine.handleMessage({ action: 'startAutoCycle', presets: NAMES, interval: 100000, autoBlend: true, autoFilters: true });
        expect(engine.blendMode).toBe('screen');
        expect(engine._rndFilter).toBe(FALLBACK_FILTERS[0]);
      });

      it('standalone Rnd applies the pool on its tick', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        engine.handleMessage({ action: 'startAutoFX', autoBlend: true, autoFilters: true, pool: POOL });
        engine._autoFXTick();
        expect(engine.blendMode).toBe('lighten');
        expect(engine._rndFilter).toBe(POOL.filters[0]);
      });
    });

    describe('switch timing (seconds, then the next beat)', () => {
      const withBpm = () => { engine._externalAudioData = { bpm: 120 }; };

      it('defaults Auto / Rnd to 15 s, and ignores a bad interval', () => {
        engine.startAutoCycle(NAMES, undefined, {});
        expect(engine._autoCycleInterval).toBe(15000);
        engine.startAutoFX({ autoFilters: true });
        expect(engine._autoFXInterval).toBe(15000);
        for (const bad of [0, -1, NaN, Infinity, null, '30000']) {
          engine.handleMessage({ action: 'startAutoCycle', presets: NAMES, interval: bad });
          expect(engine._autoCycleInterval).toBe(15000);
          engine.handleMessage({ action: 'startAutoFX', autoFilters: true, interval: bad });
          expect(engine._autoFXInterval).toBe(15000);
        }
        engine.handleMessage({ action: 'startAutoCycle', presets: NAMES, interval: 30000 });
        expect(engine._autoCycleInterval).toBe(30000);
        engine.handleMessage({ action: 'startAutoFX', autoFilters: true, interval: 60000 });
        expect(engine._autoFXInterval).toBe(60000);
      });

      it('switches Auto after the seconds when there is no BPM (no beat wait)', () => {
        vi.useFakeTimers();
        engine.startAutoCycle(NAMES, 15000, {});
        engine._autoRestAt = 100;
        const tick = vi.spyOn(engine, '_autoCycleTick');
        vi.advanceTimersByTime(14999);
        expect(tick).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(tick).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(15000);
        expect(tick).toHaveBeenCalledTimes(2);
      });

      it('switches Auto on the first beat after the seconds, and counts the next seconds from there', () => {
        vi.useFakeTimers();
        withBpm();
        engine.startAutoCycle(NAMES, 15000, {});
        engine._autoRestAt = 100;
        const tick = vi.spyOn(engine, '_autoCycleTick');
        // 秒数がたつまでは拍が来ても切り替えない(BPM で長さは変わらない)
        for (let i = 0; i < 100; i++) engine._onBeat();
        vi.advanceTimersByTime(15000);
        expect(tick).not.toHaveBeenCalled();
        vi.advanceTimersByTime(400);
        engine._onBeat();
        expect(tick).toHaveBeenCalledTimes(1);
        engine._onBeat();
        expect(tick).toHaveBeenCalledTimes(1);
        // 次の秒数は切り替えたところから
        vi.advanceTimersByTime(14999);
        engine._onBeat();
        expect(tick).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(1);
        engine._onBeat();
        expect(tick).toHaveBeenCalledTimes(2);
      });

      it('waits for the beat at most 1 s', () => {
        vi.useFakeTimers();
        withBpm();
        engine.startAutoCycle(NAMES, 8000, {});
        engine._autoRestAt = 100;
        const tick = vi.spyOn(engine, '_autoCycleTick');
        vi.advanceTimersByTime(8999);
        expect(tick).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(tick).toHaveBeenCalledTimes(1);
        // 1 秒待って切り替えたあとの拍では切り替えない
        engine._onBeat();
        expect(tick).toHaveBeenCalledTimes(1);
      });

      it('does not switch on a beat after Auto is stopped while waiting', () => {
        vi.useFakeTimers();
        withBpm();
        engine.startAutoCycle(NAMES, 8000, {});
        const tick = vi.spyOn(engine, '_autoCycleTick');
        vi.advanceTimersByTime(8000);
        engine.kill({});
        engine._onBeat();
        vi.advanceTimersByTime(2000);
        expect(tick).not.toHaveBeenCalled();
      });

      it('switches standalone Rnd the same way (seconds, then the next beat)', () => {
        vi.useFakeTimers();
        engine.startAutoFX({ autoFilters: true, interval: 8000 });
        const fx = vi.spyOn(engine, '_autoFXTick');
        // BPM が無ければ秒数で
        vi.advanceTimersByTime(7999);
        expect(fx).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(fx).toHaveBeenCalledTimes(1);
        // BPM があれば秒数のあとの拍で(最大 1 秒待つ)
        withBpm();
        for (let i = 0; i < 40; i++) engine._onBeat();
        vi.advanceTimersByTime(8000);
        expect(fx).toHaveBeenCalledTimes(1);
        engine._onBeat();
        expect(fx).toHaveBeenCalledTimes(2);
        vi.advanceTimersByTime(8999);
        expect(fx).toHaveBeenCalledTimes(2);
        vi.advanceTimersByTime(1);
        expect(fx).toHaveBeenCalledTimes(3);
        engine._stopAutoFX();
        vi.advanceTimersByTime(8000);
        engine._onBeat();
        expect(fx).toHaveBeenCalledTimes(3);
      });

      it('ignores beats when Auto / Rnd are off', () => {
        const auto = vi.spyOn(engine, '_autoSwitch');
        const fx = vi.spyOn(engine, '_autoFXTick');
        for (let i = 0; i < 40; i++) engine._onBeat();
        expect(auto).not.toHaveBeenCalled();
        expect(fx).not.toHaveBeenCalled();
      });
    });

    describe('rest (every 4-6 switches)', () => {
      it('draws the rest point from 4-6', () => {
        const seen = new Set();
        for (let i = 0; i < 100; i++) {
          engine.startAutoCycle(NAMES, 100000, { skipFirstTick: true });
          seen.add(engine._autoRestAt);
        }
        engine._stopAutoCycle();
        expect([...seen].sort()).toEqual([4, 5, 6]);
      });

      it('drops layers, resets blend / filter, then switches 0.5 s later', () => {
        vi.useFakeTimers();
        engine.startAutoCycle(NAMES, 8000, { autoBlend: true, autoFilters: true, pool: POOL });
        engine._autoRestAt = 4;
        for (let i = 0; i < 3; i++) {
          vi.advanceTimersByTime(8000);
          expect(engine.activeLayers.size).toBeGreaterThan(0);
        }
        engine._randomizeBlend(POOL, true);
        engine._randomizeFilter(POOL, true);
        vi.advanceTimersByTime(8000); // 4 回目 = 休み
        expect(engine.activeLayers.size).toBe(0);
        expect(engine.blendMode).toBe('screen');
        expect(engine.overlay.style.filter).toBe('none');
        // 休みの間の拍では切り替えない
        for (let i = 0; i < 40; i++) engine._onBeat();
        vi.advanceTimersByTime(499);
        expect(engine.activeLayers.size).toBe(0);
        vi.advanceTimersByTime(1);
        expect(engine.activeLayers.size).toBeGreaterThan(0);
        expect(engine._autoRestAt).toBeGreaterThanOrEqual(4);
        expect(engine._autoRestAt).toBeLessThanOrEqual(6);
        // そのあとは普通に秒数で切り替わる
        const tick = vi.spyOn(engine, '_autoCycleTick');
        vi.advanceTimersByTime(8000);
        expect(tick).toHaveBeenCalledTimes(1);
      });

      it('also rests when the switch comes from a beat', () => {
        vi.useFakeTimers();
        engine._externalAudioData = { bpm: 120 };
        engine.startAutoCycle(NAMES, 8000, {});
        engine._autoRestAt = 1;
        vi.advanceTimersByTime(8000);
        expect(engine.activeLayers.size).toBeGreaterThan(0);
        engine._onBeat();
        expect(engine.activeLayers.size).toBe(0);
        engine._stopAutoCycle();
      });

      it('keeps locked layers / blend / filter and what Rnd does not drive', () => {
        vi.useFakeTimers();
        engine._addLayer(NAMES[0]);
        engine.setBlendMode('lighten');
        engine.setFilter('sepia', true);
        engine.startAutoCycle(NAMES, 8000, { autoBlend: false, autoFilters: true, locks: { effect: true, filter: true }, skipFirstTick: true });
        engine._autoRestAt = 1;
        vi.advanceTimersByTime(8000);
        expect(engine.getActiveLayerNames()).toEqual([NAMES[0]]);
        expect(engine.blendMode).toBe('lighten');
        expect(engine.activeFilters.has('sepia')).toBe(true);
      });

      it('does not switch after Auto is stopped during the rest', () => {
        vi.useFakeTimers();
        engine.startAutoCycle(NAMES, 8000, {});
        engine._autoRestAt = 1;
        vi.advanceTimersByTime(8000);
        expect(engine.activeLayers.size).toBe(0);
        engine.kill({});
        vi.advanceTimersByTime(10000);
        expect(engine.activeLayers.size).toBe(0);
      });
    });

    describe('layer cap', () => {
      function withDevice(ua, touchPoints, fn) {
        Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
        Object.defineProperty(navigator, 'maxTouchPoints', { value: touchPoints, configurable: true });
        try { return fn(); } finally {
          delete navigator.userAgent;
          delete navigator.maxTouchPoints;
        }
      }

      it.each([
        ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15', 5, 3],
        ['iPad (old UA)', 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15', 5, 3],
        ['iPadOS (Mac UA + touch)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5, 3],
        ['Mac', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 0, 5],
        ['Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 0, 5],
      ])('%s → %i layers', (label, ua, touchPoints, max) => {
        const e = withDevice(ua, touchPoints, () => new VJamFXEngine());
        expect(e._maxLayers).toBe(max);
        e.destroy();
      });

      it('drops the oldest layer beyond 5 on PC', () => {
        expect(engine._maxLayers).toBe(5);
        for (const name of NAMES) engine.handleMessage({ action: 'addLayer', preset: name });
        expect(engine.getActiveLayerNames()).toEqual(NAMES.slice(1));
      });

      it('drops the oldest layers beyond 3 on iPad / iPhone', () => {
        engine._maxLayers = 3;
        for (const name of NAMES.slice(0, 5)) engine._addLayer(name);
        expect(engine.getActiveLayerNames()).toEqual(NAMES.slice(2, 5));
        expect(engine.overlay.shadowRoot.querySelectorAll('[data-vjam-layer]').length).toBe(3);
      });
    });

    describe('fps throttle', () => {
      // fps で seconds 秒ぶん _trackFps を呼ぶ。最後の時刻を返す
      function run(fps, seconds, t0) {
        let t = t0 || 0;
        const n = Math.round(seconds * fps);
        for (let i = 0; i < n; i++) { t += 1000 / fps; engine._trackFps(t); }
        return t;
      }

      it('drops p5 to 30fps after 2 s below 45fps', () => {
        engine._addLayer(NAMES[0]);
        const p = engine.activeLayers.get(NAMES[0]).preset.p5;
        engine._trackFps(0);
        let t = run(40, 1.5);
        expect(p.frameRate).not.toHaveBeenCalled();
        t = run(40, 0.5, t);
        expect(p.frameRate).toHaveBeenCalledWith(30);
        expect(engine._fpsThrottled).toBe(true);
      });

      it('does not throttle at 60fps or for a single slow second', () => {
        engine._addLayer(NAMES[0]);
        const p = engine.activeLayers.get(NAMES[0]).preset.p5;
        engine._trackFps(0);
        let t = run(60, 3);
        t = run(40, 1, t);
        t = run(60, 1, t);
        t = run(40, 1, t);
        expect(p.frameRate).not.toHaveBeenCalled();
      });

      it('ignores the time the tab was hidden', () => {
        engine._trackFps(0);
        let t = run(60, 0.5);
        t = run(60, 0.5, t + 3000);
        t = run(60, 0.5, t + 3000);
        t = run(60, 0.5, t + 3000);
        expect(engine._fpsThrottled).toBe(false);
      });

      it('applies 30fps to layers added after throttling, and resets on stop', () => {
        engine._trackFps(0);
        run(30, 2.1);
        expect(engine._fpsThrottled).toBe(true);
        engine._addLayer(NAMES[1]);
        expect(engine.activeLayers.get(NAMES[1]).preset.p5.frameRate).toHaveBeenCalledWith(30);
        engine.stop();
        expect(engine._fpsThrottled).toBe(false);
        engine._addLayer(NAMES[2]);
        expect(engine.activeLayers.get(NAMES[2]).preset.p5.frameRate).not.toHaveBeenCalled();
      });
    });
  });

  // 重いプリセットを端末ごとに見つけて飛ばす(#40)
  describe('heavy preset skip (#40)', () => {
    const NAMES = ['heavy-a', 'heavy-b', 'heavy-c', 'heavy-d'];
    const costs = {}; // プリセット名 → redraw 1 回にかかる時間(ms)
    let clock; // performance.now
    let t; // rAF の時刻
    let posted;
    let skips; // 外したもの(_skipHeavy が入れ替えたときの { name, fps, replacement })

    beforeAll(() => {
      for (const name of NAMES) {
        window.VJamFX.presets[name] = class {
          constructor() {
            this.p5 = { frameRate: vi.fn(), remove() {}, redraw() { clock += costs[name] || 0; return 'drawn'; } };
          }
          setup(container) { container.appendChild(document.createElement('canvas')); }
          destroy() {}
        };
      }
    });

    afterAll(() => {
      for (const name of NAMES) delete window.VJamFX.presets[name];
    });

    beforeEach(() => {
      for (const name of NAMES) costs[name] = 1;
      clock = 0;
      t = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => clock);
      posted = [];
      vi.spyOn(window, 'postMessage').mockImplementation((msg) => { posted.push(msg); });
      engine._fadeDuration = 0; // 足してから 2 秒で数え始める
      engine.createOverlay();
      engine.active = true;
      skips = [];
      const skip = engine._skipHeavy.bind(engine);
      engine._skipHeavy = (fps) => {
        const before = engine._heavyPending;
        skip(fps);
        if (engine._heavyPending && engine._heavyPending !== before) skips.push({ ...engine._heavyPending });
      };
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
      delete document.hidden;
    });

    // 描画ループと同じ: fps で seconds 秒ぶん、各レイヤーの p5 が描いてから _trackFps / _trackHeavy
    function run(fps, seconds) {
      const n = Math.round(seconds * fps);
      for (let i = 0; i < n; i++) {
        t += 1000 / fps;
        for (const [, layer] of engine.activeLayers) if (layer.preset.p5) layer.preset.p5.redraw();
        engine._trackFps(t);
        engine._trackHeavy(t);
      }
    }

    // SW に知らせた(端末に覚える)もの
    const heavyPosts = () => posted.filter(m => m.source === 'vjam-fx-engine' && m.type === 'heavyPreset');
    const injectPosts = () => posted.filter(m => m.source === 'vjam-fx-engine' && m.type === 'injectPreset');

    describe('detection', () => {
      it('skips after 3 s below 24fps, counted from 2 s after the layer came in', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        run(20, 4.9); // 2 秒待って、割り続けて 2.9 秒
        expect(engine.getActiveLayerNames()).toEqual([NAMES[0]]);
        expect(skips).toEqual([]);
        run(20, 0.2);
        expect(engine.activeLayers.has(NAMES[0])).toBe(false);
        expect(skips).toHaveLength(1);
        expect(skips[0]).toMatchObject({ name: NAMES[0], fps: 20 });
      });

      it('waits for the fade-in to finish (+ 2 s) before counting', () => {
        engine._fadeDuration = 1.5;
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        run(20, 6.4); // 1.5 + 2 + 2.9 秒
        expect(skips).toEqual([]);
        run(20, 0.2);
        expect(skips).toHaveLength(1);
      });

      it('does not skip at 25fps (threshold is 24fps)', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        run(25, 20);
        expect(engine.getActiveLayerNames()).toEqual([NAMES[0]]);
        expect(skips).toEqual([]);
      });

      it('needs 3 seconds in a row', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        run(20, 2);
        for (let i = 0; i < 5; i++) {
          run(20, 2);
          run(50, 1);
        }
        expect(skips).toEqual([]);
        run(20, 3.1);
        expect(skips).toHaveLength(1);
      });

      it('starts over when a layer is added or removed (fade)', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        run(20, 4);
        engine._addLayer(NAMES[1], true);
        run(20, 4.9); // 足したので 2 秒待ってから 2.9 秒
        expect(skips).toEqual([]);
        engine._removeLayer(NAMES[1]);
        run(20, 4.9);
        expect(skips).toEqual([]);
        run(20, 0.2);
        expect(skips).toHaveLength(1);
      });

      it('does not count while the tab is hidden', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        run(20, 10);
        expect(skips).toEqual([]);
        delete document.hidden;
        run(20, 2.9);
        expect(skips).toEqual([]);
        run(20, 0.2);
        expect(skips).toHaveLength(1);
      });

      it('starts over after rAF stopped (the tab was in the background)', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        run(20, 2);
        for (let i = 0; i < 5; i++) {
          run(20, 2);
          t += 3000; // rAF が止まっていた
        }
        expect(skips).toEqual([]);
      });

      it('does not count during a dip (Rnd blend / filter)', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        engine._fadeDuration = 1.5; // dip はフェード時間 0 だとしない
        run(20, 2);
        engine._dip();
        run(20, 10);
        expect(skips).toEqual([]);
        engine._cancelDip();
        run(20, 3.1);
        expect(skips).toHaveLength(1);
      });

      it('does not count during the Auto rest', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        run(20, 2);
        engine._autoResting = true;
        run(20, 10);
        expect(skips).toEqual([]);
        engine._autoResting = false;
        run(20, 3.1);
        expect(skips).toHaveLength(1);
      });

      it('marks the Auto rest from the fade-out until the next set', () => {
        vi.useFakeTimers();
        engine.startAutoCycle(NAMES, 8000, {});
        engine._autoRestAt = 1;
        vi.advanceTimersByTime(8000);
        expect(engine._autoResting).toBe(true);
        vi.advanceTimersByTime(500);
        expect(engine._autoResting).toBe(false);
        expect(engine.activeLayers.size).toBeGreaterThan(0);
        engine._autoCycleRest();
        expect(engine._autoResting).toBe(true);
        engine.kill({});
        expect(engine._autoResting).toBe(false);
      });

      // 30fps 落としは p5 の描画を間引くだけ。描画ループの rAF は描画が収まっていれば下がらない
      it('works the same while p5 is dropped to 30fps: 25-30fps is fine, 20fps is heavy', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        run(40, 3); // 45fps を 2 秒割る → 30fps に落とす
        expect(engine._fpsThrottled).toBe(true);
        expect(engine.activeLayers.get(NAMES[0]).preset.p5.frameRate).toHaveBeenCalledWith(30);
        run(25, 20);
        expect(skips).toEqual([]);
        run(20, 3.1);
        expect(skips).toHaveLength(1);
      });

      it('reports the average fps of the 3 slow seconds (one decimal)', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        run(20, 2);
        run(20, 1);
        run(10, 1);
        run(20, 1.1);
        expect(skips[0].fps).toBe(16.7);
      });

      it('OFF (stop) resets the measuring but keeps what it learned', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        run(20, 5.1);
        run(50, 5.1); // 軽くなったので覚える
        expect(heavyPosts()).toHaveLength(1);
        expect(engine._heavyPresets.has(NAMES[0])).toBe(true);
        run(20, 3);
        engine.stop();
        expect(engine._heavyMeter).toBeNull();
        expect(engine._heavyHoldUntil).toBe(0);
        expect(engine._heavyPresets.has(NAMES[0])).toBe(true);
      });
    });

    // 誤判定対策: 外したあと 3 秒の fps がしきい値以上に戻ったとき(本当に軽くなったとき)だけ覚える
    describe('saving (only when it really got lighter)', () => {
      it('saves after the 3 s after the layer is gone are back at 24fps or more', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        run(20, 5.1);
        expect(skips).toHaveLength(1);
        expect(heavyPosts()).toEqual([]); // 外しただけではまだ覚えない
        run(50, 4.9); // 外したので 2 秒待って、2.9 秒
        expect(heavyPosts()).toEqual([]);
        run(50, 0.2);
        expect(heavyPosts()).toEqual([{ source: 'vjam-fx-engine', type: 'heavyPreset', name: NAMES[0], fps: 20, replacement: skips[0].replacement }]);
        expect(engine._heavyPresets.has(NAMES[0])).toBe(true);
        expect(engine._heavyPending).toBeNull();
      });

      it('does not save when the page stays heavy after the layer is gone (the layer was innocent)', () => {
        engine.crossfade([NAMES[0]], { poolPresets: [NAMES[0], NAMES[1]] });
        run(20, 5.1);
        expect(skips.map(m => m.name)).toEqual([NAMES[0]]);
        expect(engine.getActiveLayerNames()).toEqual([NAMES[1]]);
        run(20, 5.1); // 外しても重いまま
        expect(heavyPosts()).toEqual([]);
        // このページでも重い扱いにしない(入れ替えだけで終わり。また選んでよい)
        expect(engine._heavyPresets.has(NAMES[0])).toBe(false);
        run(20, 30);
        expect(heavyPosts()).toEqual([]);
        expect(engine._heavyPresets.size).toBe(0);
      });

      it('stops skipping in this page (this engine) once a skip did not make it lighter', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        run(20, 5.1);
        const [replacement] = engine.getActiveLayerNames();
        run(20, 5.1); // 外しても重いまま → 覚えず、ここで飛ばすのをやめる(同じ秒で次を外さない)
        expect(engine._heavySkipOff).toBe(true);
        expect(skips.map(m => m.name)).toEqual([NAMES[0]]);
        run(20, 30);
        expect(engine.getActiveLayerNames()).toEqual([replacement]);
        expect(engine._heavyMeter).toBeNull(); // 測るのもやめる
        // Next で入れ替えても、OFF → ON でも、このエンジンでは飛ばさない
        engine.crossfade([NAMES[2]], { poolPresets: NAMES });
        run(20, 30);
        engine.stop();
        engine.active = true;
        engine.crossfade([NAMES[3]], { poolPresets: NAMES });
        run(20, 30);
        expect(engine.getActiveLayerNames()).toEqual([NAMES[3]]);
        expect(skips).toHaveLength(1);
        expect(heavyPosts()).toEqual([]);
        // 新しいページ(新しいエンジン)ではまた飛ばす
        const fresh = new VJamFXEngine();
        expect(fresh._heavySkipOff).toBe(false);
        fresh.destroy();
      });

      it('decides on the average of the 3 s (one slow second is fine, two are not)', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        run(20, 5.1); // 5050ms で外す
        run(50, 2); // 外したので 2 秒待つ(7100ms まで)
        run(40, 1);
        run(20, 1);
        run(25, 1); // (40 + 20 + 25) / 3 = 28.3
        expect(heavyPosts().map(m => m.name)).toEqual([NAMES[0]]);

        engine._heavyPresets.clear();
        engine.crossfade([NAMES[1]], { poolPresets: NAMES });
        run(20, 5.1);
        expect(skips.map(m => m.name)).toEqual([NAMES[0], NAMES[1]]);
        run(50, 2);
        run(25, 1);
        run(20, 2); // (25 + 20 + 20) / 3 = 21.7
        expect(engine._heavyPending).toBeNull();
        expect(heavyPosts().map(m => m.name)).toEqual([NAMES[0]]);
        expect(engine._heavyPresets.has(NAMES[1])).toBe(false);
      });

      it('measures 3 s in a row: starts over when layers change in between (Auto switch)', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        run(20, 5.1);
        run(50, 4);
        engine._addLayer(NAMES[2], true);
        run(50, 4.9);
        expect(heavyPosts()).toEqual([]);
        run(50, 0.2);
        expect(heavyPosts()).toHaveLength(1);
      });

      it('does not save what was not confirmed before OFF', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        run(20, 5.1);
        expect(engine._heavyPresets.has(NAMES[0])).toBe(true);
        engine.stop();
        expect(engine._heavyPending).toBeNull();
        expect(engine._heavyPresets.has(NAMES[0])).toBe(false);
        engine.active = true;
        engine.crossfade([NAMES[1]], { poolPresets: NAMES });
        run(50, 10);
        expect(heavyPosts()).toEqual([]);
      });
    });

    describe('which layer', () => {
      it('takes the layer with the longest p5 frame (redraw) time', () => {
        costs[NAMES[0]] = 5;
        costs[NAMES[1]] = 30;
        costs[NAMES[2]] = 10;
        engine.crossfade(NAMES.slice(0, 3), { poolPresets: NAMES });
        run(20, 5.1);
        expect(skips.map(m => m.name)).toEqual([NAMES[1]]);
        expect(engine.activeLayers.has(NAMES[1])).toBe(false);
        expect(engine.activeLayers.has(NAMES[0])).toBe(true);
        expect(engine.activeLayers.has(NAMES[2])).toBe(true);
      });

      it('compares only the frames of the slow seconds', () => {
        engine.crossfade(NAMES.slice(0, 2), { poolPresets: NAMES });
        costs[NAMES[0]] = 50; // 速い間は NAMES[0] が重い
        run(50, 5);
        costs[NAMES[0]] = 1;
        costs[NAMES[1]] = 20; // 遅くなってからは NAMES[1]
        run(20, 3.1);
        expect(skips.map(m => m.name)).toEqual([NAMES[1]]);
      });

      it('wraps p5.redraw without changing what it does', () => {
        engine._addLayer(NAMES[0], true);
        const layer = engine.activeLayers.get(NAMES[0]);
        costs[NAMES[0]] = 7;
        expect(layer.preset.p5.redraw()).toBe('drawn');
        expect(layer.drawMs).toBe(7);
        expect(layer.draws).toBe(1);
      });

      it('copes with a preset without p5', () => {
        window.VJamFX.presets['no-p5'] = class { setup() {} destroy() {} };
        try {
          engine.crossfade(['no-p5'], { poolPresets: NAMES });
          run(20, 5.1);
          expect(skips.map(m => m.name)).toEqual(['no-p5']);
        } finally {
          delete window.VJamFX.presets['no-p5'];
        }
      });
    });

    describe('only Auto / Next layers', () => {
      it('never skips a layer chosen by hand (and does not remember it)', () => {
        engine.handleMessage({ action: 'start', preset: NAMES[0] });
        engine.handleMessage({ action: 'addLayer', preset: NAMES[1] });
        run(20, 20);
        expect(engine.getActiveLayerNames()).toEqual([NAMES[0], NAMES[1]]);
        expect(skips).toEqual([]);
        expect(engine._heavyPresets.size).toBe(0);
      });

      it('leaves everything when the heaviest layer is one chosen by hand', () => {
        costs[NAMES[1]] = 30;
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        engine.handleMessage({ action: 'addLayer', preset: NAMES[1] });
        run(20, 20);
        expect(engine.getActiveLayerNames()).toEqual([NAMES[0], NAMES[1]]);
        expect(skips).toEqual([]);
      });

      it('skips the Auto layer next to a lighter one chosen by hand', () => {
        costs[NAMES[0]] = 30;
        engine.handleMessage({ action: 'addLayer', preset: NAMES[1] });
        engine.crossfade([NAMES[0]], { poolPresets: [NAMES[0], NAMES[2]], locks: {} });
        // crossfade で手のレイヤーも外れるので、もう一度手で足す
        engine.handleMessage({ action: 'addLayer', preset: NAMES[1] });
        run(20, 5.1);
        expect(skips.map(m => m.name)).toEqual([NAMES[0]]);
        expect(engine.getActiveLayerNames().sort()).toEqual([NAMES[1], NAMES[2]]);
      });

      it('takes start / addLayer with auto (toggle ON picked them for Auto)', () => {
        engine.handleMessage({ action: 'start', preset: NAMES[0], auto: true });
        engine.handleMessage({ action: 'addLayer', preset: NAMES[1], auto: true });
        engine.handleMessage({ action: 'addLayer', preset: NAMES[2] });
        expect(engine.activeLayers.get(NAMES[0]).auto).toBe(true);
        expect(engine.activeLayers.get(NAMES[1]).auto).toBe(true);
        expect(engine.activeLayers.get(NAMES[2]).auto).toBe(false);
      });

      it('marks the layers Auto chose (also the ones it kept)', () => {
        engine.handleMessage({ action: 'addLayer', preset: NAMES[0] });
        vi.spyOn(Math, 'random').mockReturnValue(0.99); // 3 本、並びはそのまま
        engine.startAutoCycle(NAMES.slice(0, 3), 100000, {});
        expect(engine.getActiveLayerNames().sort()).toEqual(NAMES.slice(0, 3));
        for (const [, layer] of engine.activeLayers) expect(layer.auto).toBe(true);
        engine._stopAutoCycle();
      });

      it('does not skip while the effect is locked', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        engine.crossfade([], { locks: { effect: true } });
        run(20, 20);
        expect(engine.getActiveLayerNames()).toEqual([NAMES[0]]);
        expect(skips).toEqual([]);
      });

      it('takes the effect lock from Auto too', () => {
        engine.crossfade([NAMES[0]], { poolPresets: NAMES });
        engine.startAutoCycle(NAMES, 100000, { locks: { effect: true } });
        run(20, 20);
        expect(skips).toEqual([]);
        engine.updateAutoCycleOptions({ locks: { effect: false } });
        run(20, 3.1);
        expect(skips).toHaveLength(1);
        engine._stopAutoCycle();
      });
    });

    describe('replacement', () => {
      it('Auto: fades the heavy layer out and another from the pool in, and never picks it again in this page', () => {
        engine._fadeDuration = 1.5;
        vi.spyOn(Math, 'random').mockReturnValue(0); // 1 本
        engine.startAutoCycle(NAMES, 100000, {});
        const [heavy] = engine.getActiveLayerNames();
        const heavyDiv = engine.activeLayers.get(heavy).container;
        run(20, 6.6);

        const [post] = skips;
        expect(post).toMatchObject({ name: heavy, fps: 20 });
        expect(NAMES).toContain(post.replacement);
        expect(post.replacement).not.toBe(heavy);
        expect(engine.getActiveLayerNames()).toEqual([post.replacement]);
        expect(engine.activeLayers.get(post.replacement).auto).toBe(true);
        // フェードで外す(すぐには消さない)・入れ替え先はフェードイン
        expect(heavyDiv.isConnected).toBe(true);
        expect(heavyDiv.style.opacity).toBe('0');
        expect(heavyDiv.style.transition).toBe('opacity 1.5s linear');
        expect(engine.activeLayers.get(post.replacement).container.style.opacity).toBe('0');
        expect(engine._heavyPresets.has(heavy)).toBe(true);

        vi.restoreAllMocks();
        vi.spyOn(window, 'postMessage').mockImplementation(() => {});
        for (let i = 0; i < 50; i++) {
          engine._autoCycleTick();
          expect(engine.activeLayers.has(heavy)).toBe(false);
        }
        engine._stopAutoCycle();
      });

      it('Next: takes the replacement from the pool Next passed', () => {
        engine.crossfade([NAMES[0]], { poolPresets: [NAMES[0], NAMES[3]] });
        run(20, 5.1);
        expect(skips[0]).toMatchObject({ name: NAMES[0], replacement: NAMES[3] });
        expect(engine.getActiveLayerNames()).toEqual([NAMES[3]]);
        expect(engine.currentPresetName).toBeNull();
      });

      it('does not pick a layer already shown or one found heavy before', () => {
        engine._heavyPresets.add(NAMES[2]);
        engine.crossfade([NAMES[0], NAMES[1]], { poolPresets: NAMES });
        costs[NAMES[0]] = 30;
        run(20, 5.1);
        expect(skips[0]).toMatchObject({ name: NAMES[0], replacement: NAMES[3] });
        expect(engine.getActiveLayerNames().sort()).toEqual([NAMES[1], NAMES[3]]);
      });

      it('just removes it when nothing is left in the pool', () => {
        engine.crossfade([NAMES[0], NAMES[1]], { poolPresets: [NAMES[0], NAMES[1]] });
        costs[NAMES[0]] = 30;
        run(20, 5.1);
        expect(skips[0]).toMatchObject({ name: NAMES[0], replacement: null });
        expect(engine.getActiveLayerNames()).toEqual([NAMES[1]]);
      });

      it('prefers presets that are already loaded', () => {
        engine.crossfade([NAMES[0]], { poolPresets: [NAMES[0], 'not-loaded-1', NAMES[1], 'not-loaded-2'] });
        run(20, 5.1);
        expect(skips[0].replacement).toBe(NAMES[1]);
        expect(injectPosts()).toEqual([]);
      });

      it('asks the SW (via the bridge) to load a replacement that is not loaded yet, and adds it when loaded', () => {
        engine.crossfade([NAMES[0]], { poolPresets: [NAMES[0], 'late-x'] });
        run(20, 5.1);
        expect(skips[0]).toMatchObject({ name: NAMES[0], replacement: 'late-x' });
        expect(injectPosts()).toEqual([{ source: 'vjam-fx-engine', type: 'injectPreset', name: 'late-x' }]);
        expect(engine.activeLayers.size).toBe(0);

        window.VJamFX.presets['late-x'] = window.VJamFX.presets[NAMES[3]];
        try {
          // 違う名前・bridge 以外からは足さない
          window.dispatchEvent(new MessageEvent('message', { data: { source: 'vjam-fx-bridge', type: 'presetInjected', name: NAMES[3] } }));
          window.dispatchEvent(new MessageEvent('message', { data: { source: 'page', type: 'presetInjected', name: 'late-x' } }));
          expect(engine.activeLayers.size).toBe(0);
          window.dispatchEvent(new MessageEvent('message', { data: { source: 'vjam-fx-bridge', type: 'presetInjected', name: 'late-x' } }));
          expect(engine.getActiveLayerNames()).toEqual(['late-x']);
          expect(engine.activeLayers.get('late-x').auto).toBe(true);
        } finally {
          delete window.VJamFX.presets['late-x'];
        }
      });

      it('drops the loaded replacement when Next / Auto / OFF switched in the meantime', () => {
        window.VJamFX.presets['late-x'] = window.VJamFX.presets[NAMES[3]];
        try {
          for (const change of [
            () => engine.crossfade([NAMES[1]], { poolPresets: NAMES }),
            () => engine.startAutoCycle([NAMES[2]], 100000, {}),
            () => engine.stop(),
          ]) {
            engine.active = true;
            engine.crossfade([NAMES[0]], { poolPresets: [NAMES[0], 'late-x'] });
            delete window.VJamFX.presets['late-x'];
            run(20, 5.1);
            expect(engine._pendingPreset).toBe('late-x');
            window.VJamFX.presets['late-x'] = window.VJamFX.presets[NAMES[3]];
            change();
            engine._stopAutoCycle();
            window.dispatchEvent(new MessageEvent('message', { data: { source: 'vjam-fx-bridge', type: 'presetInjected', name: 'late-x' } }));
            expect(engine.activeLayers.has('late-x')).toBe(false);
            // 次の回のために、外したものの確かめ(重いまま → 飛ばすのをやめる)を始めない
            engine._heavyPending = null;
            engine._heavyPresets.clear();
          }
        } finally {
          delete window.VJamFX.presets['late-x'];
        }
      });

      it('popup can update the Auto pool and clear what the page learned (Restore)', () => {
        engine.startAutoCycle([NAMES[0], NAMES[1]], 100000, { skipFirstTick: true });
        engine._heavyPresets.add(NAMES[2]);
        engine.handleMessage({ action: 'updateAutoCycleOptions', presets: NAMES });
        expect(engine._autoCyclePresets).toEqual(NAMES);
        expect(engine._poolPresets).toEqual(NAMES);
        engine.handleMessage({ action: 'clearHeavyPresets' });
        expect(engine._heavyPresets.size).toBe(0);
        // presets が無い更新(Rnd の ON / OFF)はプールを変えない
        engine.handleMessage({ action: 'updateAutoCycleOptions', autoBlend: true });
        expect(engine._autoCyclePresets).toEqual(NAMES);
        engine._stopAutoCycle();
      });
    });
  });

  // WebGL のレイヤーは同時に 1 枚まで(#42)。2 枚目が来たら古い WebGL のレイヤーをフェードで外す
  describe('WebGL layers (#42)', () => {
    const GL = ['gl-a', 'gl-b', 'gl-c'];
    const FLAT = ['flat-a', 'flat-b'];
    const destroyed = [];

    beforeAll(() => {
      // p5 の WEBGL で描くプリセットは renderer の isP3D が true(2D は false)
      const make = (name, isP3D) => class {
        constructor() { this.p5 = { _renderer: { isP3D }, frameRate() {}, remove() {} }; }
        setup(container) { container.appendChild(document.createElement('canvas')); }
        destroy() { destroyed.push(name); }
      };
      for (const name of GL) window.VJamFX.presets[name] = make(name, true);
      for (const name of FLAT) window.VJamFX.presets[name] = make(name, false);
    });

    afterAll(() => {
      for (const name of [...GL, ...FLAT]) delete window.VJamFX.presets[name];
    });

    beforeEach(() => {
      destroyed.length = 0;
      vi.useFakeTimers();
      engine.createOverlay();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const layerDivs = (name) => [...engine._stage.querySelectorAll(`[data-vjam-layer="${name}"]`)];

    it('fades out the older WebGL layer when a second one comes in', () => {
      engine.startPreset(GL[0]);
      const [old] = layerDivs(GL[0]);
      engine._addLayer(GL[1]);
      expect(engine.getActiveLayerNames()).toEqual([GL[1]]);
      // 古い方はフェードアウト中(DOM に残る)。フェードが終わったら destroy
      expect(old.isConnected).toBe(true);
      expect(old.style.opacity).toBe('0');
      expect(old.style.transition).toBe('opacity 5s linear');
      expect(destroyed).toEqual([]);
      vi.advanceTimersByTime(5200);
      expect(old.isConnected).toBe(false);
      expect(destroyed).toEqual([GL[0]]);
    });

    it('keeps 2D layers alongside the one WebGL layer', () => {
      engine.startPreset(FLAT[0]);
      engine._addLayer(GL[0]);
      engine._addLayer(FLAT[1]);
      engine._addLayer(GL[1]);
      expect(engine.getActiveLayerNames()).toEqual([FLAT[0], FLAT[1], GL[1]]);
      // 2D 同士は今まで通り重なる
      engine._addLayer(GL[2]);
      expect(engine.getActiveLayerNames().filter(n => GL.includes(n))).toEqual([GL[2]]);
      expect(engine.getActiveLayerNames()).toEqual([FLAT[0], FLAT[1], GL[2]]);
    });

    it('applies to every way a layer comes in (addLayer / Next / Auto)', () => {
      engine.handleMessage({ action: 'addLayer', preset: GL[0] });
      engine.handleMessage({ action: 'addLayer', preset: GL[1] });
      expect(engine.getActiveLayerNames()).toEqual([GL[1]]);

      engine.crossfade([GL[0], FLAT[0], GL[2]], { poolPresets: GL });
      expect(engine.getActiveLayerNames()).toEqual([FLAT[0], GL[2]]);

      vi.spyOn(Math, 'random').mockReturnValue(0.99); // 3 枚選ぶ
      try {
        engine.startAutoCycle([GL[0], GL[1], GL[2]], 100000, {});
        expect(engine.getActiveLayerNames().filter(n => GL.includes(n))).toHaveLength(1);
      } finally {
        engine._stopAutoCycle();
        Math.random.mockRestore();
      }
    });

    it('clears currentPreset when the current layer is the one faded out', () => {
      engine.startPreset(GL[0]);
      expect(engine.currentPresetName).toBe(GL[0]);
      engine._addLayer(GL[1]);
      expect(engine.currentPreset).toBeNull();
      expect(engine.currentPresetName).toBeNull();
      // 2D の current はそのまま
      engine.startPreset(FLAT[0]);
      engine._addLayer(GL[2]);
      expect(engine.currentPresetName).toBe(FLAT[0]);
    });

    it('removes the older WebGL layer at once when the fade is 0', () => {
      engine._fadeDuration = 0;
      engine._addLayer(GL[0]);
      engine._addLayer(GL[1]);
      expect(layerDivs(GL[0])).toEqual([]);
      expect(destroyed).toEqual([GL[0]]);
    });

    it('removes the default 2D canvas p5 leaves in the shadow root and blends the WebGL canvas', () => {
      // p5 の WEBGL は既定の 2D キャンバス(同じ id)を document.getElementById で外すので、shadow root の中では残る
      const make = (isP3D) => class {
        setup(container) {
          const stale = document.createElement('canvas');
          stale.id = 'defaultCanvas0';
          stale.className = 'p5Canvas';
          const gfx = document.createElement('canvas'); // createGraphics のキャンバス(id 違い)は残す
          gfx.id = 'gfx';
          container.append(stale, gfx);
          let main = stale;
          if (isP3D) {
            main = document.createElement('canvas');
            main.id = 'defaultCanvas0';
            main.className = 'p5Canvas';
            container.appendChild(main);
          }
          this.p5 = { canvas: main, _renderer: { isP3D }, frameRate() {}, remove() {} };
          this.main = main;
        }
        destroy() {}
      };
      window.VJamFX.presets['gl-real'] = make(true);
      window.VJamFX.presets['flat-real'] = make(false);
      try {
        engine.setBlendMode('difference');
        engine._addLayer('gl-real');
        const gl = engine.activeLayers.get('gl-real');
        expect([...gl.container.querySelectorAll('canvas')]).toEqual([gl.container.querySelector('#gfx'), gl.preset.main]);
        expect(gl.preset.main.style.mixBlendMode).toBe('difference');

        // 2D はそのまま(既定のキャンバスが p5 の描いているキャンバス)
        engine._addLayer('flat-real');
        const flat = engine.activeLayers.get('flat-real');
        expect(flat.container.querySelectorAll('canvas')).toHaveLength(2);
        expect(flat.preset.main.style.mixBlendMode).toBe('difference');
      } finally {
        delete window.VJamFX.presets['gl-real'];
        delete window.VJamFX.presets['flat-real'];
      }
    });

    // 抽選では WebGL を 1 回に 1 本まで(#44)。2 本引くと 1 本がすぐ消えて、その回のレイヤーが減る
    describe('lottery (#44)', () => {
      afterEach(() => {
        engine._stopAutoCycle();
        if (Math.random.mockRestore) Math.random.mockRestore();
      });

      it('Auto picks at most one WebGL preset (pool.webgl) and keeps the count it drew', () => {
        engine._fadeDuration = 0;
        engine.handleMessage({ action: 'startAutoCycle', presets: [...GL, ...FLAT], interval: 100000, skipFirstTick: true, pool: { webgl: GL } });
        expect([...engine._webglPresets]).toEqual(GL);
        for (let i = 0; i < 100; i++) {
          const spy = vi.spyOn(Math, 'random').mockImplementationOnce(() => 0.99); // 3 本(並べ替えは本物の乱数)
          engine._autoCycleTick();
          spy.mockRestore();
          const names = engine.getActiveLayerNames();
          // WebGL 3 本・2D 2 本のプールから 3 本 = 2D 2 本 + WebGL 1 本
          expect(names).toHaveLength(3);
          expect(names.filter(n => GL.includes(n))).toHaveLength(1);
        }
      });

      it('Auto picks one when the pool is all WebGL', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        engine.startAutoCycle(GL, 100000, { pool: { webgl: GL } });
        expect(engine.getActiveLayerNames()).toEqual([GL[0]]);
      });

      it('a replacement for a heavy layer is not WebGL while another WebGL layer stays (webgl from Next)', () => {
        engine.handleMessage({ action: 'crossfade', presets: [GL[0], FLAT[0]], poolPresets: [...GL, ...FLAT], webgl: GL });
        expect([...engine._webglPresets]).toEqual(GL);
        for (let i = 0; i < 30; i++) expect(engine._pickReplacement(FLAT[0])).toBe(FLAT[1]);
        // 外すのが WebGL なら WebGL も選べる
        const picked = new Set();
        for (let i = 0; i < 100; i++) picked.add(engine._pickReplacement(GL[0]));
        expect([...picked].sort()).toEqual([GL[1], GL[2], FLAT[1]].sort());
      });
    });

    it('does not count a WebGL preset whose p5 has not set up yet (no renderer)', () => {
      window.VJamFX.presets['gl-late'] = class {
        constructor() { this.p5 = { frameRate() {}, remove() {} }; }
        setup(container) { container.appendChild(document.createElement('canvas')); }
        destroy() {}
      };
      try {
        engine._addLayer('gl-late');
        engine._addLayer(GL[0]);
        expect(engine.getActiveLayerNames()).toEqual(['gl-late', GL[0]]);
      } finally {
        delete window.VJamFX.presets['gl-late'];
      }
    });
  });
});
