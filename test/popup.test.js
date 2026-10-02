import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
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
    it('should have 212 presets available', () => {
      expect(controller.presets.length).toBe(212);
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
      expect(call[0].state.autoCyclePresets.length).toBe(212);
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

    // SW がページ遷移後に Auto / Rnd を再開するとき、同じ拍数で回す
    it('should include barsPerCycle in saved state', async () => {
      controller.isActive = true;
      controller.settings.barsPerCycle = 32;
      await controller._saveState();
      const call = chrome.runtime.sendMessage.mock.calls[0];
      expect(call[0].state.barsPerCycle).toBe(32);
    });

    it('should save state when barsPerCycle is changed while active', async () => {
      const cycleEl = document.createElement('input');
      cycleEl.id = 'setting-cycle';
      container.querySelector('.popup').appendChild(cycleEl);
      controller._bindEvents();
      controller.isActive = true;

      cycleEl.value = '8';
      cycleEl.dispatchEvent(new Event('change'));
      await vi.waitFor(() => expect(chrome.runtime.sendMessage.mock.calls.some(c => c[0].type === 'setState')).toBe(true));
      const call = chrome.runtime.sendMessage.mock.calls.find(c => c[0].type === 'setState');
      expect(call[0].state.barsPerCycle).toBe(8);
    });

    it('should not save state when barsPerCycle is changed while inactive', async () => {
      const cycleEl = document.createElement('input');
      cycleEl.id = 'setting-cycle';
      container.querySelector('.popup').appendChild(cycleEl);
      controller._bindEvents();
      controller.isActive = false;

      cycleEl.value = '8';
      cycleEl.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 0));
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    // SW がページ遷移後にフェード時間・音の感度をエンジンへ戻す
    it('should include fadeDuration and audioSensitivity (engine multiplier) in saved state', async () => {
      controller.isActive = true;
      controller.settings.fadeDuration = 3;
      controller.settings.sensitivity = 'hi';
      await controller._saveState();
      const call = chrome.runtime.sendMessage.mock.calls[0];
      expect(call[0].state.fadeDuration).toBe(3);
      expect(call[0].state.audioSensitivity).toBe(2.0);
    });

    for (const [id, value, key, expected] of [
      ['setting-fade', '0', 'fadeDuration', 0],
      ['setting-sensitivity', 'lo', 'audioSensitivity', 0.5],
    ]) {
      it(`should save state when ${id} is changed while active`, async () => {
        const el = document.createElement('input');
        el.id = id;
        container.querySelector('.popup').appendChild(el);
        controller._bindEvents();
        controller.isActive = true;

        el.value = value;
        el.dispatchEvent(new Event('change'));
        await vi.waitFor(() => expect(chrome.runtime.sendMessage.mock.calls.some(c => c[0].type === 'setState')).toBe(true));
        const call = chrome.runtime.sendMessage.mock.calls.find(c => c[0].type === 'setState');
        expect(call[0].state[key]).toBe(expected);
      });

      it(`should not save state when ${id} is changed while inactive`, async () => {
        const el = document.createElement('input');
        el.id = id;
        container.querySelector('.popup').appendChild(el);
        controller._bindEvents();
        controller.isActive = false;

        el.value = value;
        el.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 0));
        expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      });
    }
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

    it('should reject NaN barsPerCycle and use default 16', () => {
      const cycleEl = document.createElement('input');
      cycleEl.id = 'setting-cycle';
      container.querySelector('.popup').appendChild(cycleEl);

      controller._bindEvents();

      cycleEl.value = 'not-a-number';
      cycleEl.dispatchEvent(new Event('change'));

      expect(controller.settings.barsPerCycle).toBe(16);
    });

    it('should reject barsPerCycle < 1 and use default 16', () => {
      const cycleEl = document.createElement('input');
      cycleEl.id = 'setting-cycle';
      container.querySelector('.popup').appendChild(cycleEl);

      controller._bindEvents();

      cycleEl.value = '0';
      cycleEl.dispatchEvent(new Event('change'));

      expect(controller.settings.barsPerCycle).toBe(16);
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

  // デフォルトプール(#6): Next / Auto / Rnd の抽選対象。手動の一覧は全部のまま
  describe('default pool', () => {
    const POOL = {
      version: 1,
      presets: ['rain', 'neon-tunnel', 'no-such-preset'],
      filters: ['saturate(2)', 'hue-rotate(90deg) saturate(2)'],
      blends: ['screen', 'difference'],
    };

    // executeScript に渡ったコマンド(_sendCommand の args[0])
    const sentCommands = () => chrome.scripting.executeScript.mock.calls
      .map(c => c[0].args && c[0].args[0])
      .filter(m => m && m.action);

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('loads presets / filters / blends from content/default-pool.json (unknown ids are ignored)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve(POOL) });
      vi.stubGlobal('fetch', fetchMock);
      await controller._loadPool();
      expect(fetchMock).toHaveBeenCalledWith('/content/default-pool.json');
      expect(controller.poolPresets.map(p => p.id).sort()).toEqual(['neon-tunnel', 'rain']);
      expect(controller.pool).toEqual({ filters: POOL.filters, blends: POOL.blends });
      // 手動の一覧は全部
      expect(controller.presets.length).toBe(212);
    });

    it('falls back to all presets when the pool cannot be read', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('not found')));
      await controller._loadPool();
      expect(controller.poolPresets.length).toBe(212);
      expect(controller.pool).toBeNull();
    });

    it('falls back to all presets when the pool has no known preset', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ...POOL, presets: ['no-such-preset'] }) }));
      await controller._loadPool();
      expect(controller.poolPresets.length).toBe(212);
    });

    it('Next picks presets only from the pool', async () => {
      const btn = document.createElement('button');
      btn.id = 'btn-next';
      container.querySelector('.popup').appendChild(btn);
      controller._bindEvents();
      controller.isActive = true;
      controller._coreInjected = true;
      controller.poolPresets = controller.presets.filter(p => p.id === 'rain');

      for (let i = 0; i < 5; i++) {
        btn.click();
        await new Promise(r => setTimeout(r, 0));
        await vi.waitFor(() => expect(controller._busy).toBe(false));
      }
      const picked = sentCommands().filter(m => m.action === 'start' || m.action === 'addLayer').map(m => m.preset);
      expect(picked.length).toBeGreaterThan(0);
      expect(new Set(picked)).toEqual(new Set(['rain']));
      expect([...controller.activeLayers]).toEqual(['rain']);
    });

    it('Auto sends the pool presets and the pool to the engine', async () => {
      const btn = document.createElement('button');
      btn.id = 'btn-auto-cycle';
      container.querySelector('.popup').appendChild(btn);
      controller._bindEvents();
      controller.isActive = true;
      controller._coreInjected = true;
      controller.poolPresets = controller.presets.filter(p => p.id === 'rain' || p.id === 'neon-tunnel');
      controller.pool = { filters: POOL.filters, blends: POOL.blends };

      btn.click();
      await vi.waitFor(() => expect(sentCommands().some(m => m.action === 'startAutoCycle')).toBe(true));
      const cmd = sentCommands().find(m => m.action === 'startAutoCycle');
      expect(cmd.presets.sort()).toEqual(['neon-tunnel', 'rain']);
      expect(cmd.pool).toEqual(controller.pool);
      expect(cmd.barsPerCycle).toBe(16);
      // Auto 用の inject もプールの分だけ
      const injected = chrome.scripting.executeScript.mock.calls
        .map(c => c[0].files && c[0].files[0])
        .filter(f => f && f.startsWith('content/presets/'));
      expect(injected.sort()).toEqual(['content/presets/neon-tunnel.js', 'content/presets/rain.js']);
    });

    it('Rnd sends the pool to the engine', async () => {
      const btn = document.createElement('button');
      btn.id = 'auto-filters';
      container.querySelector('.popup').appendChild(btn);
      controller._bindEvents();
      controller.pool = { filters: POOL.filters, blends: POOL.blends };

      btn.click();
      await vi.waitFor(() => expect(sentCommands().some(m => m.action === 'startAutoFX')).toBe(true));
      const cmd = sentCommands().find(m => m.action === 'startAutoFX');
      expect(cmd).toEqual({ action: 'startAutoFX', autoBlend: false, autoFilters: true, pool: controller.pool });
    });

    it('saves the pool presets as autoCyclePresets (SW re-injects them after navigation)', async () => {
      controller.isActive = true;
      controller.autoCycleActive = true;
      controller.poolPresets = controller.presets.filter(p => p.id === 'rain');
      await controller._saveState();
      const call = chrome.runtime.sendMessage.mock.calls[0];
      expect(call[0].state.autoCyclePresets).toEqual(['rain']);
    });

    it('saves the pool filters / blends (SW passes them to the engine after navigation)', async () => {
      controller.isActive = true;
      controller.autoCycleActive = true;
      controller.pool = { filters: POOL.filters, blends: POOL.blends };
      await controller._saveState();
      const call = chrome.runtime.sendMessage.mock.calls[0];
      expect(call[0].state.pool).toEqual({ filters: POOL.filters, blends: POOL.blends });
    });

    it('saves a null pool when the pool could not be loaded (engine falls back)', async () => {
      controller.isActive = true;
      controller.autoCycleActive = true;
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no file')));
      await controller._loadPool();
      await controller._saveState();
      const call = chrome.runtime.sendMessage.mock.calls[0];
      expect(call[0].state.pool).toBeNull();
    });
  });

  // エンジンのレイヤー上限(iPad / iPhone は 3、それ以外は 5)で外れたレイヤーは、popup のチェックも外す
  describe('layer cap sync', () => {
    it('unchecks the layers the engine dropped', async () => {
      const list = document.getElementById('preset-list');
      for (const id of ['rain', 'neon-tunnel']) {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = id;
        cb.checked = true;
        list.appendChild(cb);
      }
      controller.activeLayers.add('rain');
      controller.activeLayers.add('neon-tunnel');
      chrome.scripting.executeScript.mockResolvedValueOnce([{ result: ['rain'] }]);

      await controller._sendAddLayer('neon-tunnel');

      expect([...controller.activeLayers]).toEqual(['neon-tunnel']);
      expect(list.querySelector('input[value="rain"]').checked).toBe(false);
      expect(list.querySelector('input[value="neon-tunnel"]').checked).toBe(true);
    });

    it('runs addLayer in the engine and returns what was dropped', async () => {
      await controller._sendAddLayer('rain');
      const { func, args } = chrome.scripting.executeScript.mock.calls[0][0];
      expect(args).toEqual(['rain']);
      const engine = {
        layers: ['a', 'b'],
        getActiveLayerNames() { return this.layers.slice(); },
        handleMessage(msg) { this.layers.push(msg.preset); this.layers.shift(); },
      };
      window._vjamFxEngine = engine;
      expect(func('rain')).toEqual(['a']);
      delete window._vjamFxEngine;
    });
  });

  // トグル ON で Auto を始める(#29)。設定 ON(既定)なら Auto・Blend Rnd・Filter Rnd を ON で始める
  describe('auto on start', () => {
    const sentCommands = () => chrome.scripting.executeScript.mock.calls
      .map(c => c[0].args && c[0].args[0])
      .filter(m => m && m.action);
    const actions = () => sentCommands().map(m => m.action);
    // 始めたレイヤー: 1 本目は start、2 本目からは _sendAddLayer(args がプリセット ID)
    const startedLayers = () => chrome.scripting.executeScript.mock.calls.flatMap(c => {
      const a = c[0].args && c[0].args[0];
      if (typeof a === 'string') return [a];
      return a && (a.action === 'start' || a.action === 'addLayer') ? [a.preset] : [];
    });
    const isActive = (id) => document.getElementById(id).classList.contains('active');

    let toggle;

    beforeEach(() => {
      container.querySelector('.popup').insertAdjacentHTML('beforeend', `
        <select id="setting-auto-start"><option value="on">ON</option><option value="off">OFF</option></select>
        <button id="btn-auto-cycle"></button>
        <button id="auto-blend"></button>
        <button id="auto-filters"></button>
        <button id="btn-next"></button>
        <button class="blend-btn" data-blend="difference"></button>
      `);
      controller._buildPresetList();
      controller.poolPresets = controller.presets.filter(p => p.id === 'rain' || p.id === 'radar');
      controller.pool = { filters: ['saturate(2)'], blends: ['screen', 'difference'] };
      controller._bindEvents();
      toggle = document.getElementById('toggle');
    });

    const setToggle = async (on) => {
      toggle.checked = on;
      toggle.dispatchEvent(new Event('change'));
      await vi.waitFor(() => expect(controller._busy).toBe(false));
    };

    it('is ON by default (also when saved settings predate it)', async () => {
      expect(controller.settings.autoOnStart).toBe(true);
      chrome.storage.local.get.mockResolvedValueOnce({ vjamfx_settings: { fadeDuration: 3 } });
      await controller._loadSettings();
      expect(controller.settings.autoOnStart).toBe(true);
      expect(document.getElementById('setting-auto-start').value).toBe('on');
    });

    it('saves the setting from the settings panel', () => {
      const el = document.getElementById('setting-auto-start');
      el.value = 'off';
      el.dispatchEvent(new Event('change'));
      expect(controller.settings.autoOnStart).toBe(false);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ vjamfx_settings: expect.objectContaining({ autoOnStart: false }) });
    });

    it('setting ON: toggle ON starts 1-3 pool presets (not neon-tunnel) and Auto + Rnd with the pool', async () => {
      // 前に手で選んでいた表示(ランダムに委ねるので外れる)
      document.querySelector('.blend-btn').classList.add('active');
      await setToggle(true);

      const picked = startedLayers();
      expect(picked.length).toBeGreaterThanOrEqual(1);
      expect(picked.length).toBeLessThanOrEqual(2); // プールが 2 本
      for (const id of picked) expect(['rain', 'radar']).toContain(id);
      expect([...controller.activeLayers].sort()).toEqual([...picked].sort());

      const cmd = sentCommands().find(m => m.action === 'startAutoCycle');
      expect(cmd).toBeDefined();
      expect(cmd.presets.sort()).toEqual(['radar', 'rain']);
      expect(cmd.pool).toEqual(controller.pool);
      expect(cmd.autoBlend).toBe(true);
      expect(cmd.autoFilters).toBe(true);
      // 選んだレイヤーを最初の場面として見せる(すぐ差し替えない)
      expect(cmd.skipFirstTick).toBe(true);
      expect(actions().indexOf('start')).toBeLessThan(actions().indexOf('startAutoCycle'));

      expect(controller.isActive).toBe(true);
      expect(controller.autoCycleActive).toBe(true);
      expect(controller.autoBlend).toBe(true);
      expect(controller.autoFilters).toBe(true);
      // 見た目は Auto ボタンを押したときと同じ
      expect(isActive('btn-auto-cycle')).toBe(true);
      expect(isActive('auto-blend')).toBe(true);
      expect(isActive('auto-filters')).toBe(true);
      expect(document.querySelector('.blend-btn').classList.contains('active')).toBe(false);
      expect(document.querySelectorAll('#preset-list input:checked').length).toBe(0);

      // SW にも Auto / Rnd で保存(ページ遷移の後も回す)
      const saved = chrome.runtime.sendMessage.mock.calls.map(c => c[0]).filter(m => m.type === 'setState').pop();
      expect(saved.state.autoCyclePresets.sort()).toEqual(['radar', 'rain']);
      expect(saved.state.autoBlend).toBe(true);
      expect(saved.state.autoFilters).toBe(true);
    });

    it('setting ON: starts with the layers already selected', async () => {
      controller.activeLayers.add('kaleidoscope');
      await setToggle(true);
      const picked = startedLayers();
      expect(picked).toEqual(['kaleidoscope']);
      expect(actions()).toContain('startAutoCycle');
    });

    it('setting OFF: toggle ON works as before (neon-tunnel, no Auto / Rnd)', async () => {
      const el = document.getElementById('setting-auto-start');
      el.value = 'off';
      el.dispatchEvent(new Event('change'));
      await setToggle(true);

      const picked = startedLayers();
      expect(picked).toEqual(['neon-tunnel']);
      expect(actions()).not.toContain('startAutoCycle');
      expect(actions()).not.toContain('startAutoFX');
      expect(controller.isActive).toBe(true);
      expect(controller.autoCycleActive).toBe(false);
      expect(controller.autoBlend).toBe(false);
      expect(controller.autoFilters).toBe(false);
      expect(isActive('btn-auto-cycle')).toBe(false);
      expect(isActive('auto-blend')).toBe(false);
      expect(isActive('auto-filters')).toBe(false);
    });

    it('checking a preset while OFF starts only that preset (Auto starts from the toggle only)', async () => {
      const cb = document.querySelector('#preset-list input[value="rain"]');
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
      await vi.waitFor(() => expect(controller._busy).toBe(false));

      expect(sentCommands().find(m => m.action === 'start').preset).toBe('rain');
      expect(actions()).not.toContain('startAutoCycle');
      expect(controller.autoCycleActive).toBe(false);
    });

    it('does not turn Auto / Rnd back on after the user turned them off while running', async () => {
      await setToggle(true);

      // 手で Filter Rnd と Auto を切る
      document.getElementById('auto-filters').click();
      await vi.waitFor(() => expect(actions()).toContain('updateAutoCycleOptions'));
      document.getElementById('btn-auto-cycle').click();
      // Auto を切ると、残っている Blend Rnd が単独で回り出す
      await vi.waitFor(() => expect(actions()).toContain('startAutoFX'));
      expect(actions()).toContain('stopAutoCycle');
      expect(controller.autoCycleActive).toBe(false);
      expect(controller.autoFilters).toBe(false);

      // その後の Next は、残っている Blend Rnd だけを続ける
      chrome.scripting.executeScript.mockClear();
      document.getElementById('btn-next').click();
      await vi.waitFor(() => expect(actions()).toContain('startAutoFX'));
      await vi.waitFor(() => expect(controller._busy).toBe(false));
      expect(actions()).not.toContain('startAutoCycle');
      expect(sentCommands().find(m => m.action === 'startAutoFX')).toMatchObject({ autoBlend: true, autoFilters: false });
      expect(controller.autoCycleActive).toBe(false);
      expect(controller.autoBlend).toBe(true);
      expect(controller.autoFilters).toBe(false);
      expect(isActive('btn-auto-cycle')).toBe(false);
      expect(isActive('auto-filters')).toBe(false);
    });

    it('toggle OFF → ON starts Auto + Rnd again (each ON is a new session)', async () => {
      await setToggle(true);
      document.getElementById('btn-auto-cycle').click();
      await vi.waitFor(() => expect(actions()).toContain('startAutoFX'));
      await setToggle(false);

      chrome.scripting.executeScript.mockClear();
      await setToggle(true);
      const cmd = sentCommands().find(m => m.action === 'startAutoCycle');
      expect(cmd).toMatchObject({ autoBlend: true, autoFilters: true, skipFirstTick: true });
      expect(isActive('btn-auto-cycle')).toBe(true);
    });
  });
  // 全タブで ON(#30): 設定パネルのボタン。ON にするクリックの中で <all_urls> の許可を 1 回だけ求める
  describe('all tabs setting', () => {
    let btn;
    const savedSettings = () => chrome.storage.local.set.mock.calls
      .map(c => c[0].vjamfx_settings).filter(Boolean).pop();
    const setStates = () => chrome.runtime.sendMessage.mock.calls.map(c => c[0]).filter(m => m.type === 'setState');
    const click = async () => {
      btn.click();
      await new Promise(r => setTimeout(r, 0));
    };

    beforeEach(() => {
      container.querySelector('.popup').insertAdjacentHTML('beforeend', `
        <button id="setting-all-tabs" class="audio-btn">OFF</button>
        <button id="btn-reset"></button>
      `);
      chrome.permissions = { request: vi.fn().mockResolvedValue(true) };
      controller._bindEvents();
      btn = document.getElementById('setting-all-tabs');
    });

    afterEach(() => {
      delete chrome.permissions;
    });

    it('is OFF by default (also when saved settings predate it)', async () => {
      expect(controller.settings.allTabs).toBe(false);
      chrome.storage.local.get.mockResolvedValueOnce({ vjamfx_settings: { fadeDuration: 3 } });
      await controller._loadSettings();
      expect(controller.settings.allTabs).toBe(false);
      expect(btn.textContent).toBe('OFF');
      expect(btn.classList.contains('on')).toBe(false);
    });

    it('shows the saved ON', async () => {
      chrome.storage.local.get.mockResolvedValueOnce({ vjamfx_settings: { allTabs: true } });
      await controller._loadSettings();
      expect(btn.textContent).toBe('ON');
      expect(btn.classList.contains('on')).toBe(true);
    });

    it('asks for <all_urls> in the click and saves ON when granted', async () => {
      await click();
      expect(chrome.permissions.request).toHaveBeenCalledTimes(1);
      expect(chrome.permissions.request).toHaveBeenCalledWith({ origins: ['<all_urls>'] });
      expect(controller.settings.allTabs).toBe(true);
      expect(savedSettings()).toMatchObject({ allTabs: true });
      expect(btn.textContent).toBe('ON');
      expect(btn.classList.contains('on')).toBe(true);
    });

    it('stays OFF when the permission is denied', async () => {
      chrome.permissions.request.mockResolvedValueOnce(false);
      await click();
      expect(controller.settings.allTabs).toBe(false);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
      expect(btn.textContent).toBe('OFF');
    });

    it('stays OFF when the permission cannot be asked (error / no API)', async () => {
      chrome.permissions.request.mockRejectedValueOnce(new Error('This function must be called during a user gesture'));
      await click();
      expect(controller.settings.allTabs).toBe(false);
      delete chrome.permissions;
      await click();
      expect(controller.settings.allTabs).toBe(false);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
      expect(btn.textContent).toBe('OFF');
    });

    it('turning it ON while running hands the current state to the SW (the state other tabs get)', async () => {
      controller.isActive = true;
      controller.activeLayers.add('rain');
      await click();
      const saved = setStates().pop();
      expect(saved.tabId).toBe(1);
      expect(saved.state).toMatchObject({ active: true, layers: ['rain'] });
    });

    it('turning it ON while OFF sends no state', async () => {
      await click();
      expect(setStates()).toEqual([]);
    });

    it('a second click turns it OFF without asking', async () => {
      await click();
      chrome.permissions.request.mockClear();
      await click();
      expect(chrome.permissions.request).not.toHaveBeenCalled();
      expect(controller.settings.allTabs).toBe(false);
      expect(savedSettings()).toMatchObject({ allTabs: false });
      expect(btn.textContent).toBe('OFF');
    });

    it('Reset turns it OFF with the other settings', async () => {
      await click();
      document.getElementById('btn-reset').click();
      await vi.waitFor(() => expect(savedSettings()).toMatchObject({ allTabs: false }));
      await vi.waitFor(() => expect(btn.textContent).toBe('OFF'));
      expect(controller.settings.allTabs).toBe(false);
    });
  });

  // SW が入れたタブ(ページ遷移・全タブで ON)で popup を開いたとき、エンジンから読めない分(不透明度・ロック・テキスト)を SW の状態で埋める
  describe('sync state of a tab the SW injected', () => {
    const LIVE = { active: true, layers: ['radar'], blendMode: 'screen', filters: ['sepia'], autoCycle: true, autoBlend: true, autoFilters: true, isLightPage: false };

    it('takes the layers / Auto / Rnd from the engine and opacity / locks / text from the SW', async () => {
      chrome.scripting.executeScript.mockResolvedValueOnce([{ result: LIVE }]);
      chrome.runtime.sendMessage.mockResolvedValueOnce({ state: {
        active: true, layers: ['rain'], blendMode: 'difference', filters: [], opacity: 0.5, audioEnabled: false,
        autoCyclePresets: ['rain', 'radar'], autoBlend: true, autoFilters: true,
        locks: { effect: true, blend: false, filter: false }, textState: { text: 'hi', autoText: true }, autoInjected: true,
      } });
      await controller._syncState();

      expect(controller.isActive).toBe(true);
      expect([...controller.activeLayers]).toEqual(['radar']);
      expect(controller.selectedBlendMode).toBe('screen');
      expect([...controller.activeFilters]).toEqual(['sepia']);
      expect(controller.autoCycleActive).toBe(true);
      expect(controller.autoBlend).toBe(true);
      expect(controller.autoFilters).toBe(true);
      expect(controller.opacity).toBe(0.5);
      expect(controller.audioEnabled).toBe(false);
      expect(controller.locks.effect).toBe(true);
      expect(controller.textState).toEqual({ text: 'hi', autoText: true });
    });

    it('uses the engine alone when the SW has no state', async () => {
      chrome.scripting.executeScript.mockResolvedValueOnce([{ result: LIVE }]);
      chrome.runtime.sendMessage.mockResolvedValueOnce({ state: null });
      await controller._syncState();
      expect(controller.isActive).toBe(true);
      expect([...controller.activeLayers]).toEqual(['radar']);
      expect(controller.autoCycleActive).toBe(true);
      expect(controller.autoBlend).toBe(true);
      expect(controller.autoFilters).toBe(true);
      expect(controller.opacity).toBe(0.8);
    });

    it('uses the SW state when the engine is not running (as before)', async () => {
      chrome.scripting.executeScript.mockResolvedValueOnce([{ result: null }]);
      chrome.runtime.sendMessage.mockResolvedValueOnce({ state: { active: true, layers: ['rain'], autoBlend: true } });
      await controller._syncState();
      expect([...controller.activeLayers]).toEqual(['rain']);
      expect(controller.autoBlend).toBe(true);
    });

    it('stays OFF when neither is running', async () => {
      chrome.scripting.executeScript.mockResolvedValueOnce([{ result: null }]);
      chrome.runtime.sendMessage.mockResolvedValueOnce({ state: null });
      await controller._syncState();
      expect(controller.isActive).toBe(false);
    });
  });

  // filter のボタンは VJam 本体と同じ 5 個(#35)。Bright / Sepia / Blur はボタンだけ隠し、保存済みのシーン・状態のために残す
  describe('filter buttons (VJam style)', () => {
    const html = readFileSync(resolve(__dirname, '../popup/popup.html'), 'utf-8');
    const grid = new DOMParser().parseFromString(html, 'text/html').getElementById('filter-grid');
    const activeButtons = () => [...document.querySelectorAll('.filter-btn.active')].map(b => b.dataset.filter);

    beforeEach(() => {
      // テスト用の DOM の filter ボタンを popup.html のものに差し替える
      container.querySelectorAll('.filter-btn').forEach(b => b.remove());
      container.querySelector('.popup').insertAdjacentHTML('beforeend', grid.outerHTML);
    });

    it('popup.html shows the 5 filters of VJam (no Bright / Sepia / Blur)', () => {
      const filters = [...grid.querySelectorAll('.filter-btn')].map(b => b.dataset.filter);
      expect(filters).toEqual(['invert', 'hue-rotate', 'saturate', 'grayscale', 'contrast']);
    });

    it('restores an old state with Bright / Sepia / Blur ON without breaking', async () => {
      chrome.scripting.executeScript.mockResolvedValueOnce([{ result: null }]);
      chrome.runtime.sendMessage.mockResolvedValueOnce({ state: {
        active: true, layers: ['rain'], blendMode: 'screen', filters: ['brightness', 'invert', 'sepia', 'blur'],
      } });
      await controller._syncState();
      expect(activeButtons()).toEqual(['invert']);
      // 隠したものも落とさない(保存し直しても残る)
      expect([...controller.activeFilters]).toEqual(['brightness', 'invert', 'sepia', 'blur']);
      chrome.runtime.sendMessage.mockClear();
      await controller._saveState();
      expect(chrome.runtime.sendMessage.mock.calls[0][0].state.filters).toEqual(['brightness', 'invert', 'sepia', 'blur']);
      // 見えるボタンはそのまま使える
      controller._bindEvents();
      document.querySelector('.filter-btn[data-filter="saturate"]').click();
      expect(activeButtons()).toEqual(['invert', 'saturate']);
      expect(controller.activeFilters.has('saturate')).toBe(true);
    });

    it('loads an old scene with Bright ON and still sends it to the engine', async () => {
      controller.isActive = true;
      controller.scenes[0] = { layers: ['rain'], blendMode: 'screen', filters: ['brightness', 'contrast'], opacity: 0.8 };
      const sent = [];
      controller._sendCommand = vi.fn(async (msg) => { sent.push(msg); });
      await controller._loadScene(0);
      expect(sent.filter(m => m.action === 'setFilter')).toEqual([
        { action: 'setFilter', filter: 'brightness', enabled: true },
        { action: 'setFilter', filter: 'contrast', enabled: true },
      ]);
      expect(activeButtons()).toEqual(['contrast']);
      expect(controller._busy).toBe(false);
    });
  });

  // 動いているタブで popup を開き直したとき、Auto / Rnd のボタンがエンジンと合う(#33)。
  // Auto / Rnd はエンジンの状態を優先(SW の状態は拡張の更新・再読み込みで消える。エンジンはページに残って回り続ける)
  describe('sync Auto / Rnd from the engine on reopen', () => {
    const isActive = (id) => document.getElementById(id).classList.contains('active');
    const buttons = () => ({ auto: isActive('btn-auto-cycle'), blend: isActive('auto-blend'), filters: isActive('auto-filters') });
    // _syncState がページで走らせる func を、この偽エンジンを置いた window で実際に走らせる
    const reopen = async (engine, swState = null) => {
      window._vjamFxEngine = {
        active: true, blendMode: 'screen', activeFilters: new Set(), isLightPage: false,
        getActiveLayerNames: () => ['rain'],
        _autoCycleTimer: null, _autoFXTimer: null,
        ...engine,
      };
      chrome.scripting.executeScript.mockImplementationOnce(async ({ func, args }) => [{ result: func(...(args || [])) }]);
      chrome.runtime.sendMessage.mockResolvedValueOnce({ state: swState });
      try {
        await controller._syncState();
      } finally {
        delete window._vjamFxEngine;
      }
    };

    beforeEach(() => {
      container.querySelector('.popup').insertAdjacentHTML('beforeend', `
        <button id="btn-auto-cycle"></button>
        <button id="auto-blend"></button>
        <button id="auto-filters"></button>
      `);
    });

    it('Auto running: Auto / Blend Rnd / Filter Rnd are ON', async () => {
      await reopen({ _autoCycleTimer: 1, _autoBlend: true, _autoFilters: true });
      expect(buttons()).toEqual({ auto: true, blend: true, filters: true });
      expect(controller).toMatchObject({ isActive: true, autoCycleActive: true, autoBlend: true, autoFilters: true });
    });

    it('Auto running with Blend Rnd only: Filter Rnd stays OFF', async () => {
      await reopen({ _autoCycleTimer: 1, _autoBlend: true, _autoFilters: false });
      expect(buttons()).toEqual({ auto: true, blend: true, filters: false });
    });

    it('Rnd only (Auto stopped): Auto is OFF, Rnd is ON', async () => {
      // Auto を止めても _autoBlend / _autoFilters は残る(Auto の値ではなく単独の Rnd を見る)
      await reopen({ _autoBlend: true, _autoFilters: true, _autoFXTimer: 2, _autoFXBlend: true, _autoFXFilters: true });
      expect(buttons()).toEqual({ auto: false, blend: true, filters: true });
      expect(controller).toMatchObject({ autoCycleActive: false, autoBlend: true, autoFilters: true });
    });

    it('both OFF: everything is OFF even with leftover values', async () => {
      await reopen({ _autoBlend: true, _autoFilters: true, _autoFXBlend: true, _autoFXFilters: true });
      expect(buttons()).toEqual({ auto: false, blend: false, filters: false });
      expect(controller).toMatchObject({ isActive: true, autoCycleActive: false, autoBlend: false, autoFilters: false });
    });

    it('the engine wins over the SW state', async () => {
      // SW の状態は Auto・Rnd ON のまま、エンジンでは止まっている
      await reopen({}, { active: true, layers: ['rain'], autoCyclePresets: ['rain'], autoBlend: true, autoFilters: true, opacity: 0.5 });
      expect(buttons()).toEqual({ auto: false, blend: false, filters: false });
      expect(controller.opacity).toBe(0.5); // エンジンから読まない分は SW から
    });

    it('SW state lost (extension updated / reloaded): Auto and Rnd still come from the engine', async () => {
      await reopen({ _autoCycleTimer: 1, _autoBlend: true, _autoFilters: true }, null);
      expect(buttons()).toEqual({ auto: true, blend: true, filters: true });
    });
  });
});
