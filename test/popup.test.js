import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PopupController } from '../popup/popup.js';

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

    it('should auto-start when checkbox checked while inactive', async () => {
      controller._bindEvents();
      const list = document.getElementById('preset-list');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = 'neon-tunnel';
      list.appendChild(cb);

      expect(controller.isActive).toBe(false);
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait for async _startAll
      await new Promise(r => setTimeout(r, 50));

      expect(controller.isActive).toBe(true);
      expect(controller.activeLayers.has('neon-tunnel')).toBe(true);
      const toggle = document.getElementById('toggle');
      expect(toggle.checked).toBe(true);
    });

    it('should add layer normally when checkbox checked while active', async () => {
      controller._bindEvents();
      controller.isActive = true;
      const spy = vi.spyOn(controller, '_addLayer');

      const list = document.getElementById('preset-list');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = 'rain';
      list.appendChild(cb);

      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));

      expect(controller.activeLayers.has('rain')).toBe(true);
      expect(spy).toHaveBeenCalledWith('rain');
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
    it('should save scene without Auto/Rnd state (only layers, blend, filters, opacity, locks)', () => {
      controller.activeLayers.add('neon-tunnel');
      controller.selectedBlendMode = 'lighten';
      controller.autoCycleActive = true;
      controller.autoBlend = true;
      controller.autoFilters = false;
      controller._saveScene(0);
      const scene = controller.scenes[0];
      expect(scene.autoCycleActive).toBeUndefined();
      expect(scene.autoBlend).toBeUndefined();
      expect(scene.autoFilters).toBeUndefined();
      expect(scene.layers).toContain('neon-tunnel');
      expect(scene.blendMode).toBe('lighten');
    });

    it('should save scene with layers and defaults', () => {
      controller.activeLayers.add('kaleidoscope');
      controller.autoCycleActive = false;
      controller._saveScene(1);
      const scene = controller.scenes[1];
      expect(scene.autoCycleActive).toBeUndefined();
      expect(scene.layers).toContain('kaleidoscope');
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

  describe('bug fix: _busy guard on Next/Reset/Auto', () => {
    it('should block Next when _busy is true', async () => {
      // Add Next button to DOM
      const btn = document.createElement('button');
      btn.id = 'btn-next';
      container.querySelector('.popup').appendChild(btn);

      controller._bindEvents();
      controller._busy = true;
      controller.isActive = true;

      const callsBefore = chrome.scripting.executeScript.mock.calls.length;
      btn.click();
      await new Promise(r => setTimeout(r, 50));

      expect(chrome.scripting.executeScript.mock.calls.length).toBe(callsBefore);
    });

    it('should block Reset when _busy is true', async () => {
      const btn = document.createElement('button');
      btn.id = 'btn-reset';
      container.querySelector('.popup').appendChild(btn);

      controller._bindEvents();
      controller._busy = true;

      const callsBefore = chrome.scripting.executeScript.mock.calls.length;
      btn.click();
      await new Promise(r => setTimeout(r, 50));

      expect(chrome.scripting.executeScript.mock.calls.length).toBe(callsBefore);
    });

    it('should block Auto when _busy is true', async () => {
      const btn = document.createElement('button');
      btn.id = 'btn-auto-cycle';
      container.querySelector('.popup').appendChild(btn);

      controller._bindEvents();
      controller._busy = true;
      controller.autoCycleActive = false;

      btn.click();
      await new Promise(r => setTimeout(r, 50));

      // autoCycleActive should not have toggled
      expect(controller.autoCycleActive).toBe(false);
    });
  });

  describe('bug fix: _stopAll pendingStop', () => {
    it('should set _pendingStop when _stopAll called while _busy', async () => {
      controller._busy = true;
      controller._pendingStop = false;

      await controller._stopAll();

      expect(controller._pendingStop).toBe(true);
      // isActive should NOT have changed (stopAll was deferred)
    });

    it('should execute pending stop after _startAll finishes', async () => {
      controller.activeLayers.add('neon-tunnel');
      // Start _startAll which sets _busy
      const startPromise = controller._startAll();
      // While busy, call _stopAll which should defer
      controller._stopAll();
      expect(controller._pendingStop).toBe(true);

      await startPromise;
      // After _startAll finishes, _pendingStop triggers _stopAll
      await new Promise(r => setTimeout(r, 50));

      expect(controller._pendingStop).toBe(false);
      expect(controller.isActive).toBe(false);
    });
  });

  describe('bug fix: opacity slider throttle', () => {
    it('should throttle rapid opacity changes', async () => {
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.id = 'opacity-slider';
      slider.value = '80';
      container.querySelector('.popup').appendChild(slider);

      controller.isActive = true;
      controller._bindEvents();
      vi.clearAllMocks();

      // Fire multiple rapid input events
      for (let i = 50; i <= 90; i += 10) {
        slider.value = String(i);
        slider.dispatchEvent(new Event('input'));
      }

      // Immediately after rapid fires, only the first should schedule a send
      // The rest are throttled (opacityThrottleTimer is still pending)
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();

      // Wait for throttle timer (50ms)
      await new Promise(r => setTimeout(r, 100));

      // Should have sent exactly one command (the throttled batch)
      const opacityCalls = chrome.scripting.executeScript.mock.calls.filter(call => {
        const args = call[0];
        if (args && args.func) {
          return true; // executeScript was called
        }
        return false;
      });
      // Only 1 throttled send, not 5 separate sends
      expect(opacityCalls.length).toBeLessThanOrEqual(2); // setOpacity + saveState at most
    });
  });

  describe('bug fix: filter CSS/Set sync', () => {
    it('should sync classList active with activeFilters Set state', () => {
      controller._bindEvents();
      const btn = document.querySelector('.filter-btn[data-filter="invert"]');

      // Click to add filter
      btn.click();
      expect(controller.activeFilters.has('invert')).toBe(true);
      expect(btn.classList.contains('active')).toBe(true);

      // Click again to remove filter
      btn.click();
      expect(controller.activeFilters.has('invert')).toBe(false);
      expect(btn.classList.contains('active')).toBe(false);
    });

    it('should drive classList from Set state via _updateUI', () => {
      const btn = document.querySelector('.filter-btn[data-filter="invert"]');

      // Manually set filter in Set without clicking
      controller.activeFilters.add('invert');
      controller._updateUI();
      expect(btn.classList.contains('active')).toBe(true);

      // Remove from Set and update UI
      controller.activeFilters.delete('invert');
      controller._updateUI();
      expect(btn.classList.contains('active')).toBe(false);
    });

    it('should not have active class if filter not in Set after _updateUI', () => {
      const btn = document.querySelector('.filter-btn[data-filter="hue-rotate"]');

      // Manually add active class without updating Set
      btn.classList.add('active');
      expect(btn.classList.contains('active')).toBe(true);

      // _updateUI should remove it since Set doesn't have it
      controller._updateUI();
      expect(btn.classList.contains('active')).toBe(false);
    });
  });

  describe('bug fix: settings validation', () => {
    it('should reject NaN fadeDuration and use default 1.5', () => {
      const fadeEl = document.createElement('input');
      fadeEl.id = 'setting-fade';
      container.querySelector('.popup').appendChild(fadeEl);

      controller._bindEvents();

      fadeEl.value = 'abc';
      fadeEl.dispatchEvent(new Event('change'));

      expect(controller.settings.fadeDuration).toBe(1.5);
    });

    it('should reject NaN barsPerCycle and use default 8', () => {
      const cycleEl = document.createElement('input');
      cycleEl.id = 'setting-cycle';
      container.querySelector('.popup').appendChild(cycleEl);

      controller._bindEvents();

      cycleEl.value = 'not-a-number';
      cycleEl.dispatchEvent(new Event('change'));

      expect(controller.settings.barsPerCycle).toBe(8);
    });

    it('should reject barsPerCycle < 1 and use default 8', () => {
      const cycleEl = document.createElement('input');
      cycleEl.id = 'setting-cycle';
      container.querySelector('.popup').appendChild(cycleEl);

      controller._bindEvents();

      cycleEl.value = '0';
      cycleEl.dispatchEvent(new Event('change'));

      expect(controller.settings.barsPerCycle).toBe(8);
    });

    it('should clamp fadeDuration to minimum 0', () => {
      const fadeEl = document.createElement('input');
      fadeEl.id = 'setting-fade';
      container.querySelector('.popup').appendChild(fadeEl);

      controller._bindEvents();

      fadeEl.value = '-5';
      fadeEl.dispatchEvent(new Event('change'));

      expect(controller.settings.fadeDuration).toBe(0);
    });
  });

  describe('bug fix: scene load with empty layers', () => {
    it('should deactivate when scene has empty layers array', async () => {
      controller.isActive = true;
      controller.scenes[0] = { layers: [], blendMode: 'screen', filters: [], opacity: 1.0 };

      await controller._loadScene(0);

      expect(controller.isActive).toBe(false);
      const toggle = document.getElementById('toggle');
      expect(toggle.checked).toBe(false);
    });

    it('should skip scene with no layers array', async () => {
      controller.isActive = true;
      controller.scenes[0] = { blendMode: 'screen' }; // no layers property

      const activeBefore = controller.isActive;
      await controller._loadScene(0);

      // _loadScene returns early if !Array.isArray(scene.layers)
      expect(controller.isActive).toBe(activeBefore);
    });
  });

  describe('bug fix: _loadScene try/finally resets _busy', () => {
    it('should reset _busy even if error occurs during scene load', async () => {
      controller.scenes[0] = { layers: ['nonexistent-preset'], blendMode: 'screen' };

      // Force _sendCommand to throw
      const origSendCommand = controller._sendCommand.bind(controller);
      controller._sendCommand = vi.fn().mockRejectedValueOnce(new Error('inject fail'));

      controller._busy = false;
      try {
        await controller._loadScene(0);
      } catch (e) {
        // Error may or may not propagate depending on implementation
      }

      // _busy must be false after _loadScene completes (try/finally)
      expect(controller._busy).toBe(false);
    });

    it('should not stay busy after successful scene load', async () => {
      controller.scenes[0] = { layers: ['neon-tunnel'], blendMode: 'screen', filters: [], opacity: 0.8 };

      await controller._loadScene(0);

      expect(controller._busy).toBe(false);
    });

    it('should block concurrent _loadScene when _busy', async () => {
      controller.scenes[0] = { layers: ['neon-tunnel'], blendMode: 'screen', filters: [] };
      controller._busy = true;

      const activeBefore = controller.isActive;
      await controller._loadScene(0);

      // Should return early without changing state
      expect(controller.isActive).toBe(activeBefore);
    });
  });
});
