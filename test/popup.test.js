import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PopupController, _throttle, logWarn } from '../popup/popup.js';
import { PRESET_CATEGORIES, ALL_PRESETS } from '../popup/preset-catalog.js';

describe('PopupController', () => {
  let controller;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <div class="popup">
        <input type="checkbox" id="toggle" />
        <div id="preset-list"></div>
        <select id="blend-mode">
          <option value="screen">Screen</option>
          <option value="lighten">Lighten</option>
          <option value="difference">Difference</option>
          <option value="exclusion">Exclusion</option>
        </select>
        <button id="audio-toggle" class="audio-btn on">ON</button>
        <button class="filter-btn" data-filter="invert">Invert</button>
        <button class="filter-btn" data-filter="hue-rotate">Hue Rot</button>
        <button class="filter-btn" data-filter="blur">Blur</button>
        <a id="vjam-link" href="#">Get VJam</a>
      </div>
    `;
    document.body.appendChild(container);
    controller = new PopupController();
    controller._tabId = 1;
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
  });

  describe('preset list', () => {
    it('should have 191 presets available', () => {
      expect(controller.presets.length).toBe(191);
    });

    it('should have all expected preset names', () => {
      const ids = controller.presets.map(p => p.id);
      expect(ids).toContain('neon-tunnel');
      expect(ids).toContain('kaleidoscope');
      expect(ids).toContain('mandala');
      expect(ids).toContain('infinite-zoom');
      expect(ids).toContain('laser-tunnel');
      expect(ids).toContain('cellular');
      expect(ids).toContain('voronoi');
      expect(ids).toContain('fractal-tree');
      expect(ids).toContain('coral-reef');
      expect(ids).toContain('cyber-rain-heavy');
    });
  });

  describe('multi-layer', () => {
    it('should track active layers as a Set', () => {
      expect(controller.activeLayers).toBeInstanceOf(Set);
      expect(controller.activeLayers.size).toBe(0);
    });

    it('should add and remove layers', () => {
      controller.activeLayers.add('neon-tunnel');
      controller.activeLayers.add('rain');
      expect(controller.activeLayers.size).toBe(2);
      controller.activeLayers.delete('rain');
      expect(controller.activeLayers.size).toBe(1);
    });
  });

  describe('filters', () => {
    it('should track active filters as a Set', () => {
      expect(controller.activeFilters).toBeInstanceOf(Set);
      expect(controller.activeFilters.size).toBe(0);
    });
  });

  describe('toggle', () => {
    it('should inject scripts and send start on toggle ON', async () => {
      controller.activeLayers.add('neon-tunnel');
      await controller._startAll();
      expect(chrome.scripting.executeScript).toHaveBeenCalled();
      expect(controller.isActive).toBe(true);
    });

    it('should send stop command on toggle OFF', async () => {
      controller.isActive = true;
      await controller._stopAll();
      expect(chrome.scripting.executeScript).toHaveBeenCalled();
      expect(controller.isActive).toBe(false);
    });
  });

  describe('blend mode', () => {
    it('should default to screen blend mode', () => {
      expect(controller.selectedBlendMode).toBe('screen');
    });
  });

  describe('layer count display', () => {
    it('should update layer count text', () => {
      const el = document.createElement('span');
      el.id = 'layer-count';
      container.querySelector('.popup').appendChild(el);

      controller.activeLayers.add('neon-tunnel');
      controller.activeLayers.add('rain');
      controller._updateLayerCount();
      expect(el.textContent).toBe('2 layers');
    });

    it('should show empty text for 0 layers', () => {
      const el = document.createElement('span');
      el.id = 'layer-count';
      container.querySelector('.popup').appendChild(el);

      controller._updateLayerCount();
      expect(el.textContent).toBe('');
    });
  });

  describe('_sendCommand', () => {
    it('should not send if no tabId', async () => {
      controller._tabId = null;
      await controller._sendCommand({ action: 'stop' });
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });
  });

  describe('_sendBatch', () => {
    it('should not send if no tabId', async () => {
      controller._tabId = null;
      await controller._sendBatch([{ action: 'start' }]);
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });

    it('should not send if empty array', async () => {
      await controller._sendBatch([]);
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });

    it('should send N messages in 1 executeScript call', async () => {
      await controller._sendBatch([
        { action: 'start', preset: 'neon-tunnel' },
        { action: 'addLayer', preset: 'rain' },
        { action: 'setOpacity', opacity: 0.8 },
      ]);
      expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
    });

    it('should use handleBatch in the injected func', async () => {
      await controller._sendBatch([{ action: 'start', preset: 'neon-tunnel' }]);
      const call = chrome.scripting.executeScript.mock.calls[0][0];
      expect(call.world).toBe('MAIN');
      // The func should reference handleBatch
      const funcStr = call.func.toString();
      expect(funcStr).toContain('handleBatch');
    });
  });

  describe('_startAll batching', () => {
    it('should use fewer executeScript calls with batching', async () => {
      controller.activeLayers.add('neon-tunnel');
      controller.activeLayers.add('rain');
      controller.activeFilters.add('invert');
      await controller._startAll();
      // With batching: p5 inject + p5 check + core files (4) + 2 preset injects + 1 batch = 9
      // Without batching: p5 + check + core(4) + 2 presets + start + addLayer + filter + audio + 5 settings = 17+
      const callCount = chrome.scripting.executeScript.mock.calls.length;
      expect(callCount).toBeLessThanOrEqual(10);
    });
  });

  describe('action buttons', () => {
    it('should track autoCycleActive state', () => {
      expect(controller.autoCycleActive).toBe(false);
    });

    it('should not have _currentIndex (removed sequential nav)', () => {
      expect(controller._currentIndex).toBeUndefined();
    });
  });

  describe('_saveState', () => {
    it('should include autoCyclePresets when auto-cycle active', async () => {
      controller.isActive = true;
      controller.autoCycleActive = true;
      controller.activeLayers.add('neon-tunnel');
      await controller._saveState();
      const call = chrome.runtime.sendMessage.mock.calls[0];
      expect(call[0].state.autoCyclePresets).not.toBeNull();
      expect(call[0].state.autoCyclePresets.length).toBe(191);
    });

    it('should have null autoCyclePresets when not cycling', async () => {
      controller.isActive = true;
      controller.autoCycleActive = false;
      await controller._saveState();
      const call = chrome.runtime.sendMessage.mock.calls[0];
      expect(call[0].state.autoCyclePresets).toBeNull();
    });

    it('should include audioEnabled in saved state', async () => {
      controller.isActive = true;
      controller.audioEnabled = false;
      await controller._saveState();
      const call = chrome.runtime.sendMessage.mock.calls[0];
      expect(call[0].state.audioEnabled).toBe(false);
    });
  });

  describe('audio', () => {
    it('should default to audioEnabled true', () => {
      expect(controller.audioEnabled).toBe(true);
    });

    it('should toggle audioEnabled', () => {
      controller.audioEnabled = false;
      expect(controller.audioEnabled).toBe(false);
      controller.audioEnabled = true;
      expect(controller.audioEnabled).toBe(true);
    });
  });

  describe('scenes', () => {
    it('should save Auto state in scene', () => {
      controller.activeLayers.add('neon-tunnel');
      controller.selectedBlendMode = 'lighten';
      controller.autoCycleActive = true;
      controller.autoBlend = true;
      controller.autoFilters = false;
      controller._saveScene(0);
      const scene = controller.scenes[0];
      expect(scene.autoCycleActive).toBe(true);
      expect(scene.autoBlend).toBe(true);
      expect(scene.autoFilters).toBe(false);
      expect(scene.layers).toContain('neon-tunnel');
    });

    it('should save scene without Auto state', () => {
      controller.activeLayers.add('kaleidoscope');
      controller.autoCycleActive = false;
      controller._saveScene(1);
      const scene = controller.scenes[1];
      expect(scene.autoCycleActive).toBe(false);
      expect(scene.autoBlend).toBe(false);
      expect(scene.autoFilters).toBe(false);
    });

    it('should clear scene slot', () => {
      controller._saveScene(2);
      expect(controller.scenes[2]).not.toBeNull();
      controller._clearScene(2);
      expect(controller.scenes[2]).toBeNull();
    });

    it('should have 12 scene slots initialized to null', () => {
      expect(controller.scenes.length).toBe(12);
      for (const s of controller.scenes) {
        expect(s).toBeNull();
      }
    });
  });

  describe('_busy guard', () => {
    it('should block _startAll when busy', async () => {
      controller._busy = true;
      await controller._startAll();
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });

    it('should block _stopAll when busy', async () => {
      controller._busy = true;
      controller.isActive = true;
      await controller._stopAll();
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
      expect(controller.isActive).toBe(true);
    });

    it('should release _busy after _startAll completes', async () => {
      controller.activeLayers.add('neon-tunnel');
      await controller._startAll();
      expect(controller._busy).toBe(false);
    });

    it('should release _busy after _startAll fails', async () => {
      controller.activeLayers.add('neon-tunnel');
      chrome.scripting.executeScript.mockRejectedValueOnce(new Error('inject fail'));
      await controller._startAll();
      expect(controller._busy).toBe(false);
    });

    it('should release _busy after _loadScene even on error', async () => {
      controller.scenes[0] = { layers: ['neon-tunnel'], blendMode: 'screen', filters: [] };
      let callCount = 0;
      chrome.scripting.executeScript.mockImplementation(() => {
        callCount++;
        if (callCount > 5) return Promise.reject(new Error('fail'));
        return Promise.resolve([{ result: true }]);
      });
      try {
        await controller._loadScene(0);
      } catch (e) {
        // Expected
      }
      expect(controller._busy).toBe(false);
    });

    it('should not load scene when busy', async () => {
      controller._busy = true;
      controller.scenes[0] = { layers: ['neon-tunnel'], blendMode: 'screen', filters: [] };
      await controller._loadScene(0);
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });
  });

  describe('_throttle', () => {
    it('should call function immediately on first call', () => {
      const fn = vi.fn();
      const throttled = _throttle(fn, 50);
      throttled('a');
      expect(fn).toHaveBeenCalledWith('a');
    });

    it('should throttle subsequent calls within interval', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const throttled = _throttle(fn, 50);
      throttled('a');
      throttled('b');
      expect(fn).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('b');
      vi.useRealTimers();
    });
  });

  describe('logWarn', () => {
    it('should call console.warn with context', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logWarn('test', new Error('oops'));
      expect(spy).toHaveBeenCalledWith('VJam FX [test]:', 'oops');
      spy.mockRestore();
    });

    it('should handle string errors', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logWarn('ctx', 'string error');
      expect(spy).toHaveBeenCalledWith('VJam FX [ctx]:', 'string error');
      spy.mockRestore();
    });
  });

  describe('_showBanner', () => {
    it('should create error banner in popup', () => {
      controller._showBanner('Test error', 'error');
      const banner = document.querySelector('.vjam-banner');
      expect(banner).not.toBeNull();
      expect(banner.textContent).toBe('Test error');
      expect(banner.getAttribute('role')).toBe('alert');
    });

    it('should auto-remove banner after timeout', () => {
      vi.useFakeTimers();
      controller._showBanner('Temp error');
      expect(document.querySelector('.vjam-banner')).not.toBeNull();
      vi.advanceTimersByTime(3000);
      expect(document.querySelector('.vjam-banner')).toBeNull();
      vi.useRealTimers();
    });

    it('should replace existing banner', () => {
      controller._showBanner('First');
      controller._showBanner('Second');
      const banners = document.querySelectorAll('.vjam-banner');
      expect(banners.length).toBe(1);
      expect(banners[0].textContent).toBe('Second');
    });
  });

  describe('scene keyboard navigation', () => {
    it('should not throw on Delete key for empty scene slot', () => {
      const btn = document.createElement('button');
      btn.className = 'scene-btn';
      btn.dataset.slot = '0';
      container.querySelector('.popup').appendChild(btn);
      controller._bindEvents();
      const event = new KeyboardEvent('keydown', { key: 'Delete' });
      expect(() => btn.dispatchEvent(event)).not.toThrow();
    });
  });

  describe('accessibility', () => {
    it('should have aria-label on all interactive buttons', () => {
      const fs = require('fs');
      const html = fs.readFileSync(require('path').resolve(__dirname, '../popup/popup.html'), 'utf-8');
      expect(html).toContain('aria-label="Settings"');
      expect(html).toContain('aria-label="Reset all effects"');
      expect(html).toContain('aria-label="Toggle audio"');
    });
  });

  describe('preset catalog', () => {
    it('should have correct number of categories', () => {
      expect(PRESET_CATEGORIES.length).toBeGreaterThanOrEqual(13);
    });

    it('should have 191 total presets', () => {
      expect(ALL_PRESETS.length).toBe(191);
    });

    it('should match controller.presets', () => {
      expect(controller.presets.length).toBe(ALL_PRESETS.length);
    });

    it('should have unique preset IDs', () => {
      const ids = ALL_PRESETS.map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('text input maxlength', () => {
    it('should have maxlength attribute in HTML', () => {
      const fs = require('fs');
      const html = fs.readFileSync(require('path').resolve(__dirname, '../popup/popup.html'), 'utf-8');
      expect(html).toContain('maxlength="200"');
    });
  });
});
