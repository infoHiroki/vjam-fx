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
    it('should have 370 presets available', () => {
      expect(controller.presets.length).toBe(370);
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

  // 前のヘッダーの「N layers」(#layer-count)の役目は、ステージのレイヤー名の一覧が持つ(#47)
  describe('layer names on the stage', () => {
    const names = () => [...document.querySelectorAll('#layer-names .nm')].map(el => el.textContent);

    beforeEach(() => {
      container.querySelector('.popup').insertAdjacentHTML('beforeend', '<ol id="layer-names"></ol>');
    });

    it('lists the names of the layers while ON', () => {
      controller.isActive = true;
      controller.activeLayers.add('neon-tunnel');
      controller.activeLayers.add('rain');
      controller._renderStage();
      expect(names()).toEqual(['Neon Tunnel', 'Rain']);
      expect([...document.querySelectorAll('#layer-names .ly')].map(el => el.textContent)).toEqual(['1', '2']);
    });

    it('is empty with 0 layers and while OFF', () => {
      controller.isActive = true;
      controller._renderStage();
      expect(names()).toEqual([]);
      controller.activeLayers.add('rain');
      controller.isActive = false;
      controller._renderStage();
      expect(names()).toEqual([]);
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
      expect(call[0].state.autoCyclePresets.length).toBe(370);
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
    // カタログで webgl: true のもの(#44)
    const WEBGL_IDS = new PopupController().presets.filter(p => p.webgl).map(p => p.id);

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
      // webgl: カタログの WebGL のプリセット(#44。エンジンが Auto の抽選で 1 回に 1 本までにする)
      expect(controller.pool).toEqual({ filters: POOL.filters, blends: POOL.blends, webgl: WEBGL_IDS });
      // 手動の一覧は全部
      expect(controller.presets.length).toBe(370);
    });

    it('falls back to all presets when the pool cannot be read', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('not found')));
      await controller._loadPool();
      expect(controller.poolPresets.length).toBe(370);
      expect(controller.pool).toBeNull();
    });

    it('falls back to all presets when the pool has no known preset', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ...POOL, presets: ['no-such-preset'] }) }));
      await controller._loadPool();
      expect(controller.poolPresets.length).toBe(370);
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
      const picked = sentCommands().filter(m => m.action === 'crossfade').flatMap(m => m.presets);
      expect(picked.length).toBeGreaterThan(0);
      expect(new Set(picked)).toEqual(new Set(['rain']));
      expect([...controller.activeLayers]).toEqual(['rain']);
    });

    // Next はエンジンでクロスフェードする(#38)。kill で一瞬で消さない
    it('Next crossfades in the engine (no kill)', async () => {
      const btn = document.createElement('button');
      btn.id = 'btn-next';
      container.querySelector('.popup').appendChild(btn);
      controller._bindEvents();
      controller.isActive = true;
      controller._coreInjected = true;
      controller.poolPresets = controller.presets.filter(p => p.id === 'rain' || p.id === 'radar');
      controller.selectedBlendMode = 'lighten';

      btn.click();
      await vi.waitFor(() => expect(controller._busy).toBe(false));
      const actions = sentCommands().map(m => m.action);
      expect(actions).not.toContain('kill');
      expect(actions).not.toContain('start');
      const cmd = sentCommands().find(m => m.action === 'crossfade');
      expect(cmd.presets.length).toBeGreaterThanOrEqual(1);
      for (const id of cmd.presets) expect(['rain', 'radar']).toContain(id);
      expect(cmd.blendMode).toBe('lighten');
      expect(cmd.locks).toEqual(controller.locks);
      expect([...controller.activeLayers].sort()).toEqual(cmd.presets.slice().sort());
      // 入れるプリセットは crossfade の前に inject しておく
      const calls = chrome.scripting.executeScript.mock.calls;
      const lastInject = calls.map(c => c[0].files && c[0].files[0]).lastIndexOf(`content/presets/${cmd.presets[cmd.presets.length - 1]}.js`);
      const crossfadeAt = calls.findIndex(c => c[0].args && c[0].args[0] && c[0].args[0].action === 'crossfade');
      expect(lastInject).toBeGreaterThanOrEqual(0);
      expect(lastInject).toBeLessThan(crossfadeAt);
    });

    it('Next with the effect lock keeps the layers (crossfade with no presets)', async () => {
      const btn = document.createElement('button');
      btn.id = 'btn-next';
      container.querySelector('.popup').appendChild(btn);
      controller._bindEvents();
      controller.isActive = true;
      controller._coreInjected = true;
      controller.locks = { effect: true, blend: false, filter: false };
      controller.activeLayers = new Set(['neon-tunnel']);

      btn.click();
      await vi.waitFor(() => expect(controller._busy).toBe(false));
      const cmd = sentCommands().find(m => m.action === 'crossfade');
      expect(cmd).toMatchObject({ presets: [], locks: { effect: true } });
      expect([...controller.activeLayers]).toEqual(['neon-tunnel']);
      const injected = chrome.scripting.executeScript.mock.calls
        .map(c => c[0].files && c[0].files[0])
        .filter(f => f && f.startsWith('content/presets/'));
      expect(injected).toEqual([]);
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
      expect(args).toEqual(['rain', false]);
      const sent = [];
      const engine = {
        layers: ['a', 'b'],
        getActiveLayerNames() { return this.layers.slice(); },
        handleMessage(msg) { sent.push(msg); this.layers.push(msg.preset); this.layers.shift(); },
      };
      window._vjamFxEngine = engine;
      expect(func('rain', false)).toEqual(['a']);
      expect(sent).toEqual([{ action: 'addLayer', preset: 'rain', auto: false }]);
      delete window._vjamFxEngine;
    });

    it('passes auto (picked by Auto) to the engine', async () => {
      await controller._sendAddLayer('rain', true);
      expect(chrome.scripting.executeScript.mock.calls[0][0].args).toEqual(['rain', true]);
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

  // 重いプリセット(#40): SW が覚えたものを Next / Auto のプールから除く。設定パネルに数と「戻す」
  describe('heavy presets (#40)', () => {
    const HEAVY = { rain: { fps: 5.6, at: '2026-10-02T00:00:00.000Z' } };
    const sentCommands = () => chrome.scripting.executeScript.mock.calls
      .map(c => c[0].args && c[0].args[0])
      .filter(m => m && m.action);
    const injectedPresets = () => chrome.scripting.executeScript.mock.calls
      .map(c => c[0].files && c[0].files[0])
      .filter(f => f && f.startsWith('content/presets/'))
      .sort();
    let onChanged;

    beforeEach(() => {
      const settingsHtml = readFileSync(resolve(__dirname, '../popup/popup.html'), 'utf-8');
      const settings = new DOMParser().parseFromString(settingsHtml, 'text/html').getElementById('settings-section');
      container.querySelector('.popup').insertAdjacentHTML('beforeend', settings.outerHTML + `
        <button id="btn-next"></button>
        <button id="btn-auto-cycle"></button>
        <button id="auto-blend"></button>
        <button id="auto-filters"></button>
      `);
      onChanged = [];
      chrome.storage.onChanged = { addListener: vi.fn((cb) => onChanged.push(cb)) };
      chrome.storage.local.remove = vi.fn().mockResolvedValue(undefined);
      controller.poolPresets = controller.presets.filter(p => ['rain', 'radar', 'neon-tunnel'].includes(p.id));
      controller.pool = { filters: ['saturate(2)'], blends: ['screen'] };
    });

    afterEach(() => {
      delete chrome.storage.onChanged;
      delete chrome.storage.local.remove;
    });

    const load = async (heavy) => {
      chrome.storage.local.get.mockResolvedValueOnce(heavy ? { heavyPresets: heavy } : {});
      await controller._loadHeavyPresets();
    };
    const count = () => document.getElementById('heavy-count').textContent;
    const restoreBtn = () => document.getElementById('btn-heavy-reset');

    it('popup.html has the count and the Restore button in the settings panel', () => {
      const html = readFileSync(resolve(__dirname, '../popup/popup.html'), 'utf-8');
      const settings = new DOMParser().parseFromString(html, 'text/html').getElementById('settings-section');
      expect(settings.querySelector('#heavy-count')).not.toBeNull();
      expect(settings.querySelector('#btn-heavy-reset')).not.toBeNull();
    });

    it('loads what the SW saved and shows how many', async () => {
      await load({ ...HEAVY, radar: { fps: 20, at: '' } });
      expect(chrome.storage.local.get).toHaveBeenCalledWith('heavyPresets');
      expect(controller.heavyPresets).toEqual({ ...HEAVY, radar: { fps: 20, at: '' } });
      expect(count()).toBe('2');
      expect(document.getElementById('heavy-count').title).toBe('rain, radar');
      expect(restoreBtn().disabled).toBe(false);
    });

    it('shows 0 and disables Restore when there is none', async () => {
      await load(null);
      expect(controller.heavyPresets).toEqual({});
      expect(count()).toBe('0');
      expect(restoreBtn().disabled).toBe(true);
    });

    it('follows what the engine finds while the popup is open (storage.onChanged)', async () => {
      await load(null);
      expect(onChanged).toHaveLength(1);
      onChanged[0]({ heavyPresets: { newValue: HEAVY } }, 'local');
      expect(controller.heavyPresets).toEqual(HEAVY);
      expect(count()).toBe('1');
      onChanged[0]({ vjamfx_settings: { newValue: {} } }, 'local'); // ほかのキーは見ない
      onChanged[0]({ heavyPresets: { newValue: {} } }, 'session');
      expect(count()).toBe('1');
      onChanged[0]({ heavyPresets: { oldValue: HEAVY } }, 'local'); // 消された
      expect(count()).toBe('0');
    });

    it('Next never picks a heavy one, and passes the pool without it for the engine to replace', async () => {
      await load(HEAVY);
      controller._bindEvents();
      controller.isActive = true;
      controller._coreInjected = true;
      for (let i = 0; i < 10; i++) {
        document.getElementById('btn-next').click();
        await vi.waitFor(() => expect(controller._busy).toBe(false));
      }
      const fades = sentCommands().filter(m => m.action === 'crossfade');
      expect(fades).toHaveLength(10);
      for (const cmd of fades) {
        expect(cmd.presets).not.toContain('rain');
        expect(cmd.poolPresets.sort()).toEqual(['neon-tunnel', 'radar']);
      }
      expect(injectedPresets()).not.toContain('content/presets/rain.js');
    });

    it('Auto gets the pool without it (also what is injected and saved for the SW)', async () => {
      await load(HEAVY);
      controller._bindEvents();
      controller.isActive = true;
      controller._coreInjected = true;
      document.getElementById('btn-auto-cycle').click();
      await vi.waitFor(() => expect(sentCommands().some(m => m.action === 'startAutoCycle')).toBe(true));
      expect(sentCommands().find(m => m.action === 'startAutoCycle').presets.sort()).toEqual(['neon-tunnel', 'radar']);
      expect(injectedPresets()).toEqual(['content/presets/neon-tunnel.js', 'content/presets/radar.js']);
      await vi.waitFor(() => expect(chrome.runtime.sendMessage.mock.calls.some(c => c[0].type === 'setState')).toBe(true));
      const saved = chrome.runtime.sendMessage.mock.calls.map(c => c[0]).filter(m => m.type === 'setState').pop();
      expect(saved.state.autoCyclePresets.sort()).toEqual(['neon-tunnel', 'radar']);
    });

    it('toggle ON (Auto start) picks no heavy one and tells the engine it picked them for Auto', async () => {
      await load(HEAVY);
      controller._buildPresetList();
      controller._bindEvents();
      const toggle = document.getElementById('toggle');
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));
      await vi.waitFor(() => expect(sentCommands().some(m => m.action === 'startAutoCycle')).toBe(true));
      const start = sentCommands().find(m => m.action === 'start');
      expect(start.auto).toBe(true);
      expect(start.preset).not.toBe('rain');
      const added = chrome.scripting.executeScript.mock.calls.map(c => c[0].args).filter(a => a && typeof a[0] === 'string');
      for (const args of added) {
        expect(args[0]).not.toBe('rain');
        expect(args[1]).toBe(true);
      }
    });

    it('a preset checked by hand is started as not-Auto (never skipped)', async () => {
      controller.settings.autoOnStart = false;
      controller.activeLayers.add('rain');
      await controller._startAll();
      expect(sentCommands().find(m => m.action === 'start')).toMatchObject({ preset: 'rain', auto: false });
    });

    it('uses the whole pool when every preset in it is heavy', async () => {
      await load({ rain: {}, radar: {}, 'neon-tunnel': {} });
      expect(controller._usablePool().map(p => p.id).sort()).toEqual(['neon-tunnel', 'radar', 'rain']);
    });

    it('Restore clears the list, tells the engine to forget, and lets Auto pick them again', async () => {
      await load(HEAVY);
      controller._bindEvents();
      controller.isActive = true;
      controller._coreInjected = true;
      controller.autoCycleActive = true;
      restoreBtn().click();
      await vi.waitFor(() => expect(chrome.runtime.sendMessage.mock.calls.some(c => c[0].type === 'setState')).toBe(true));
      expect(chrome.storage.local.remove).toHaveBeenCalledWith('heavyPresets');
      expect(controller.heavyPresets).toEqual({});
      expect(count()).toBe('0');
      expect(restoreBtn().disabled).toBe(true);
      const actions = sentCommands().map(m => m.action);
      expect(actions).toContain('clearHeavyPresets');
      expect(sentCommands().find(m => m.action === 'updateAutoCycleOptions').presets.sort()).toEqual(['neon-tunnel', 'radar', 'rain']);
      expect(injectedPresets()).toContain('content/presets/rain.js');
      const saved = chrome.runtime.sendMessage.mock.calls.map(c => c[0]).filter(m => m.type === 'setState').pop();
      expect(saved.state.autoCyclePresets.sort()).toEqual(['neon-tunnel', 'radar', 'rain']);
    });

    it('Restore while OFF only clears (and tells a stopped engine to forget)', async () => {
      await load(HEAVY);
      await controller._resetHeavyPresets();
      expect(chrome.storage.local.remove).toHaveBeenCalledWith('heavyPresets');
      expect(sentCommands().map(m => m.action)).toEqual(['clearHeavyPresets']);
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('Reset keeps the list (it is about this device, not a setting)', async () => {
      await load(HEAVY);
      container.querySelector('.popup').insertAdjacentHTML('beforeend', '<button id="btn-reset"></button>');
      controller._bindEvents();
      document.getElementById('btn-reset').click();
      await vi.waitFor(() => expect(chrome.storage.local.set).toHaveBeenCalled());
      expect(chrome.storage.local.remove).not.toHaveBeenCalled();
      expect(controller.heavyPresets).toEqual(HEAVY);
    });
  });

  // VJam 本体の WebGL のプリセット(#44)。エンジンは WebGL のレイヤーを同時に 1 枚までにする(#42)ので、
  // 抽選(Next / トグル ON の Auto)で 2 本引くと 1 本がすぐ消えてその回のレイヤーが減る。1 回に 1 本まで
  describe('WebGL presets (#44)', () => {
    const presetsDir = resolve(__dirname, '../content/presets');
    const usesWebgl = (id) => /createCanvas\([^;]*WEBGL/.test(readFileSync(resolve(presetsDir, `${id}.js`), 'utf-8'));
    const webglCount = (ids) => ids.filter(id => controller.presets.find(p => p.id === id).webgl).length;
    const pick = (ids) => ids.map(id => controller.presets.find(p => p.id === id));
    const sentCommands = () => chrome.scripting.executeScript.mock.calls
      .map(c => c[0].args && c[0].args[0])
      .filter(m => m && m.action);

    afterEach(() => {
      if (Math.random.mockRestore) Math.random.mockRestore();
      vi.unstubAllGlobals();
    });

    it('marks exactly the presets that draw with a WEBGL canvas (158)', () => {
      const marked = controller.presets.filter(p => p.webgl).map(p => p.id);
      expect(marked.length).toBe(158);
      for (const p of controller.presets) expect([p.id, usesWebgl(p.id)]).toEqual([p.id, !!p.webgl]);
    });

    it('Next picks at most one WebGL preset, and still 3 when 2D ones are left', () => {
      controller.poolPresets = pick(['3d-tunnel', 'fire-shader', 'mandelbulb', 'rain', 'radar']);
      const sizes = new Set();
      let withWebgl = 0;
      for (let i = 0; i < 300; i++) {
        const ids = controller._randomPoolPresets().map(p => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(webglCount(ids)).toBeLessThanOrEqual(1);
        sizes.add(ids.length);
        if (webglCount(ids) === 1) withWebgl++;
      }
      // 1〜3 本は今まで通り(WebGL を飛ばした分は 2D で埋める)
      expect([...sizes].sort()).toEqual([1, 2, 3]);
      expect(withWebgl).toBeGreaterThan(0);

      vi.spyOn(Math, 'random').mockReturnValue(0.99); // 3 本・並べ替えは元の順(WebGL が先頭に 3 本)
      expect(controller._randomPoolPresets().map(p => p.id)).toEqual(['3d-tunnel', 'rain', 'radar']);
    });

    it('Next picks one when the pool is all WebGL', () => {
      controller.poolPresets = pick(['3d-tunnel', 'fire-shader', 'mandelbulb']);
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      expect(controller._randomPoolPresets().length).toBe(1);
    });

    it('never picks two from the default pool (331)', async () => {
      const POOL = JSON.parse(readFileSync(resolve(__dirname, '../content/default-pool.json'), 'utf-8'));
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(POOL) }));
      await controller._loadPool();
      expect(controller.poolPresets.length).toBe(331);
      let withWebgl = 0;
      for (let i = 0; i < 1000; i++) {
        const ids = controller._randomPoolPresets().map(p => p.id);
        expect(webglCount(ids)).toBeLessThanOrEqual(1);
        if (webglCount(ids) === 1) withWebgl++;
      }
      expect(withWebgl).toBeGreaterThan(0);
    });

    it('Next tells the engine which presets are WebGL (it picks a replacement for a heavy layer)', async () => {
      const btn = document.createElement('button');
      btn.id = 'btn-next';
      container.querySelector('.popup').appendChild(btn);
      controller._bindEvents();
      controller.isActive = true;
      controller._coreInjected = true;
      controller.poolPresets = controller.presets.filter(p => ['3d-tunnel', 'rain'].includes(p.id));

      btn.click();
      await vi.waitFor(() => expect(controller._busy).toBe(false));
      const cmd = sentCommands().find(m => m.action === 'crossfade');
      expect(cmd.webgl.length).toBe(158);
      expect(cmd.webgl).toContain('3d-tunnel');
      expect(cmd.webgl).not.toContain('rain');
    });

    it('Auto gets the WebGL list in the pool (the SW passes the pool on after navigation too)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ version: 1, presets: ['3d-tunnel', 'rain'], filters: [], blends: [] }) }));
      await controller._loadPool();
      const cmd = controller._autoCycleCommand();
      expect(cmd.pool.webgl.length).toBe(158);
      expect(cmd.pool.webgl).toContain('3d-tunnel');
      controller.isActive = true;
      await controller._saveState();
      const saved = chrome.runtime.sendMessage.mock.calls.map(c => c[0]).filter(m => m.type === 'setState').pop();
      expect(saved.state.pool.webgl).toEqual(cmd.pool.webgl);
    });
  });

  // popup の作り直し(#47): Auto が主役。いつもの画面はステージ・Next / Auto・チップ・Opacity、手動は畳む
  describe('popup layout (#47)', () => {
    const html = readFileSync(resolve(__dirname, '../popup/popup.html'), 'utf-8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const $ = (id) => document.getElementById(id);
    const sentCommands = () => chrome.scripting.executeScript.mock.calls
      .map(c => c[0].args && c[0].args[0])
      .filter(m => m && m.action);

    // テスト用の DOM を popup.html の中身に差し替える
    const usePopupHtml = () => {
      container.innerHTML = doc.body.innerHTML.replace(/<script[\s\S]*?<\/script>/g, '');
    };

    describe('popup.html', () => {
      it('has the logo image in the header instead of the text title', () => {
        const logo = doc.querySelector('.header img.logo');
        expect(logo.getAttribute('src')).toBe('lockup.png');
        expect(logo.getAttribute('alt')).toBe('VJam FX');
        expect(doc.querySelector('h1')).toBeNull();
        expect(readFileSync(resolve(__dirname, '../popup/lockup.png')).length).toBeGreaterThan(0);
        expect(readFileSync(resolve(__dirname, '../popup/mark.png')).length).toBeGreaterThan(0);
      });

      it('keeps the ids the tests and e2e use', () => {
        for (const id of ['toggle', 'btn-settings', 'settings-section', 'setting-auto-start', 'setting-all-tabs', 'setting-fade',
          'setting-cycle', 'setting-sensitivity', 'heavy-count', 'btn-heavy-reset', 'btn-next', 'btn-auto-cycle', 'auto-blend',
          'auto-filters', 'opacity-slider', 'lock-effect', 'preset-search', 'preset-list', 'lock-filter', 'filter-grid', 'lock-blend',
          'blend-grid', 'btn-scene-save', 'btn-scenes-toggle', 'scenes-section', 'scene-grid', 'text-input', 'btn-text-toggle',
          'btn-reset', 'audio-toggle', 'vjam-link', 'cta-text']) {
          expect([id, doc.getElementById(id) != null]).toEqual([id, true]);
        }
        expect(doc.querySelector('.toggle-switch #toggle')).not.toBeNull();
      });

      it('puts the everyday controls outside Manual and the rest inside', () => {
        const manual = doc.getElementById('manual-section');
        expect(manual.hasAttribute('hidden')).toBe(true);
        for (const id of ['stage', 'btn-next', 'btn-auto-cycle', 'auto-blend', 'auto-filters', 'chip-all-tabs', 'opacity-slider', 'btn-manual']) {
          expect([id, manual.contains(doc.getElementById(id))]).toEqual([id, false]);
        }
        for (const id of ['preset-search', 'preset-list', 'lock-effect', 'filter-grid', 'lock-filter', 'blend-grid', 'lock-blend',
          'btn-scene-save', 'scene-grid', 'text-input', 'btn-reset', 'audio-toggle']) {
          expect([id, manual.contains(doc.getElementById(id))]).toEqual([id, true]);
        }
        // 手動の Filters / Blend にも Rnd(チップと同じもの)
        expect(manual.querySelector('[data-rnd="filters"]')).not.toBeNull();
        expect(manual.querySelector('[data-rnd="blend"]')).not.toBeNull();
      });

      it('draws icons with inline SVG (no emoji / symbol characters)', () => {
        expect(doc.querySelector('#btn-settings svg')).not.toBeNull();
        expect(doc.querySelector('#btn-next svg')).not.toBeNull();
        expect(doc.querySelector('#btn-auto-cycle svg')).not.toBeNull();
        expect(doc.querySelector('#btn-manual svg')).not.toBeNull();
        expect(doc.querySelector('.scene-del svg')).not.toBeNull();
        expect(html).not.toMatch(/&#9881;|&#9654;|&#9660;|&times;|[⚙▶▼▲×]/);
        for (const svg of doc.querySelectorAll('svg')) expect(svg.classList.contains('ic')).toBe(true);
      });
    });

    describe('stage', () => {
      beforeEach(() => {
        usePopupHtml();
      });

      it('shows OFF / MANUAL / AUTO', () => {
        controller._renderStage();
        expect($('stage-mode').textContent).toBe('OFF');
        expect($('stage').dataset.mode).toBe('off');
        controller.isActive = true;
        controller._renderStage();
        expect($('stage-mode').textContent).toBe('MANUAL');
        controller.autoCycleActive = true;
        controller._renderStage();
        expect($('stage-mode').textContent).toBe('AUTO');
        expect($('stage').dataset.mode).toBe('auto');
      });

      it('OFF: one line on how to start (depends on Auto start)', () => {
        controller._renderStage();
        expect($('off-hint').hidden).toBe(false);
        expect($('off-hint').textContent).toMatch(/Auto/);
        controller.settings.autoOnStart = false;
        controller._renderStage();
        expect($('off-hint').textContent).not.toMatch(/Auto/);
        controller.isActive = true;
        controller._renderStage();
        expect($('off-hint').hidden).toBe(true);
      });

      it('BPM: shown only when there is one, and the beat dot pulses at 60 / BPM', () => {
        controller.isActive = true;
        controller._renderStage();
        expect($('stage-bpm').hidden).toBe(true);
        expect($('stage-beat').classList.contains('pulse')).toBe(false);
        expect($('stage-beat').style.animationDuration).toBe('');

        controller._bpm = 120;
        controller._renderStage();
        expect($('stage-bpm').hidden).toBe(false);
        expect($('stage-bpm').textContent).toBe('120 BPM');
        expect($('stage-beat').classList.contains('pulse')).toBe(true);
        expect($('stage-beat').style.animationDuration).toBe('0.5s');
        expect($('stage-meter').style.animationDuration).toBe('0.5s');

        controller.isActive = false;
        controller._renderStage();
        expect($('stage-bpm').hidden).toBe(true);
        expect($('stage-beat').classList.contains('pulse')).toBe(false);
      });

      it('shows at most 5 layer names', () => {
        controller.isActive = true;
        controller._live = { layers: ['rain', 'radar', 'neon-tunnel', 'smoke', 'aurora', 'bokeh'], bpm: 0 };
        controller._renderStage();
        expect([...document.querySelectorAll('#layer-names .nm')].map(el => el.textContent))
          .toEqual(['Rain', 'Radar', 'Neon Tunnel', 'Smoke', 'Aurora']);
      });

      it('Auto button reads Stop Auto while Auto runs', () => {
        controller._updateAutoUI();
        expect($('btn-auto-cycle').querySelector('.label').textContent).toBe('Auto');
        controller.autoCycleActive = true;
        controller._updateAutoUI();
        expect($('btn-auto-cycle').querySelector('.label').textContent).toBe('Stop Auto');
        expect($('btn-auto-cycle').classList.contains('active')).toBe(true);
      });
    });

    // 名前と BPM は popup が開いている間、今ある executeScript の経路でエンジンから読み直す
    describe('reading the engine while open', () => {
      const poll = async (engine) => {
        window._vjamFxEngine = engine;
        chrome.scripting.executeScript.mockImplementationOnce(async ({ func, args }) => [{ result: func(...(args || [])) }]);
        try {
          await controller._pollLive();
        } finally {
          delete window._vjamFxEngine;
        }
      };
      const engine = (extra) => ({
        active: true, audioEnabled: true, getActiveLayerNames: () => ['rain', 'radar'], _tempoBpm: () => 0, ...extra,
      });

      beforeEach(() => {
        usePopupHtml();
        controller.isActive = true;
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('shows what the engine is running (Auto changes layers without the popup)', async () => {
        controller.activeLayers.add('neon-tunnel');
        await poll(engine({ _tempoBpm: () => 123.6 }));
        expect([...document.querySelectorAll('#layer-names .nm')].map(el => el.textContent)).toEqual(['Rain', 'Radar']);
        expect($('stage-bpm').textContent).toBe('124 BPM');
        // popup の状態(保存・シーン)は変えない
        expect([...controller.activeLayers]).toEqual(['neon-tunnel']);
      });

      it('no BPM from the engine: hidden (after a few misses, tabCapture data is read once per frame)', async () => {
        await poll(engine({ _tempoBpm: () => 128 }));
        expect($('stage-bpm').hidden).toBe(false);
        await poll(engine());
        await poll(engine());
        expect($('stage-bpm').hidden).toBe(false);
        await poll(engine());
        expect($('stage-bpm').hidden).toBe(true);
        expect($('stage-beat').classList.contains('pulse')).toBe(false);
      });

      it('the <video> analyser starts at 120 before it hears a beat: not shown until beats come', async () => {
        const now = performance.now() / 1000;
        for (let i = 0; i < 3; i++) await poll(engine({ _tempoBpm: () => 120, _videoAudioAnalyser: {}, _videoAudioLastBeatTime: -1 }));
        expect($('stage-bpm').hidden).toBe(true);
        await poll(engine({ _tempoBpm: () => 120, _videoAudioAnalyser: {}, _videoAudioLastBeatTime: now }));
        expect($('stage-bpm').textContent).toBe('120 BPM');
      });

      it('Audio OFF: no BPM', async () => {
        for (let i = 0; i < 3; i++) await poll(engine({ audioEnabled: false, _tempoBpm: () => 120 }));
        expect($('stage-bpm').hidden).toBe(true);
      });

      it('does not read while OFF', async () => {
        controller.isActive = false;
        await controller._pollLive();
        expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
        expect($('stage-mode').textContent).toBe('OFF');
      });

      it('reads about once a second while the popup is open', async () => {
        vi.useFakeTimers();
        controller._startLivePoll();
        await vi.advanceTimersByTimeAsync(3000);
        expect(chrome.scripting.executeScript.mock.calls.length).toBeGreaterThanOrEqual(3);
        expect(chrome.scripting.executeScript.mock.calls.length).toBeLessThanOrEqual(4);
        clearInterval(controller._livePollTimer);
      });
    });

    describe('Manual', () => {
      beforeEach(() => {
        usePopupHtml();
      });

      it('is folded by default and opens / folds with the row', async () => {
        await controller._loadManualOpen();
        expect($('manual-section').hidden).toBe(true);
        expect($('btn-manual').getAttribute('aria-expanded')).toBe('false');
        controller._bindEvents();
        $('btn-manual').click();
        expect($('manual-section').hidden).toBe(false);
        expect($('btn-manual').getAttribute('aria-expanded')).toBe('true');
        expect(chrome.storage.local.set).toHaveBeenCalledWith({ vjamfx_manual_open: true });
        $('btn-manual').click();
        expect($('manual-section').hidden).toBe(true);
        expect(chrome.storage.local.set).toHaveBeenLastCalledWith({ vjamfx_manual_open: false });
      });

      it('opens the way it was left last time', async () => {
        chrome.storage.local.get.mockResolvedValueOnce({ vjamfx_manual_open: true });
        await controller._loadManualOpen();
        expect(chrome.storage.local.get).toHaveBeenCalledWith('vjamfx_manual_open');
        expect($('manual-section').hidden).toBe(false);
      });

      it('is not a setting: Reset keeps it open', async () => {
        controller._bindEvents();
        $('btn-manual').click();
        $('btn-reset').click();
        await vi.waitFor(() => expect(chrome.storage.local.set).toHaveBeenCalledWith({ vjamfx_settings: expect.anything() }));
        expect($('manual-section').hidden).toBe(false);
      });

      it('scenes fold with an SVG chevron (aria-expanded)', () => {
        controller._bindEvents();
        $('btn-scenes-toggle').click();
        expect($('scenes-section').style.display).toBe('none');
        expect($('btn-scenes-toggle').getAttribute('aria-expanded')).toBe('false');
        expect($('btn-scenes-toggle').querySelector('svg')).not.toBeNull();
        $('btn-scenes-toggle').click();
        expect($('scenes-section').style.display).toBe('');
        expect($('btn-scenes-toggle').getAttribute('aria-expanded')).toBe('true');
      });
    });

    describe('chips', () => {
      const rnd = (kind) => [...document.querySelectorAll(`[data-rnd="${kind}"]`)].map(b => b.classList.contains('active'));

      beforeEach(() => {
        usePopupHtml();
        controller._bindEvents();
      });

      afterEach(() => {
        delete chrome.permissions;
      });

      it('Rnd in Manual and the chip are the same switch', async () => {
        document.querySelector('#manual-section [data-rnd="blend"]').click();
        await vi.waitFor(() => expect(sentCommands().map(m => m.action)).toContain('startAutoFX'));
        expect(controller.autoBlend).toBe(true);
        expect(rnd('blend')).toEqual([true, true]);
        expect(rnd('filters')).toEqual([false, false]);
        $('auto-blend').click();
        await vi.waitFor(() => expect(sentCommands().map(m => m.action)).toContain('stopAutoFX'));
        expect(controller.autoBlend).toBe(false);
        expect(rnd('blend')).toEqual([false, false]);
      });

      it('Auto turns both Rnd chips on', async () => {
        $('btn-auto-cycle').click();
        await vi.waitFor(() => expect(sentCommands().map(m => m.action)).toContain('startAutoCycle'));
        expect(rnd('blend')).toEqual([true, true]);
        expect(rnd('filters')).toEqual([true, true]);
        expect($('stage-mode').textContent).toBe('AUTO');
      });

      it('All tabs chip is the same as the setting (asks for <all_urls> in the click)', async () => {
        chrome.permissions = { request: vi.fn().mockResolvedValue(true) };
        $('chip-all-tabs').click();
        await vi.waitFor(() => expect(controller.settings.allTabs).toBe(true));
        expect(chrome.permissions.request).toHaveBeenCalledWith({ origins: ['<all_urls>'] });
        expect($('chip-all-tabs').classList.contains('active')).toBe(true);
        expect($('setting-all-tabs').textContent).toBe('ON');
        $('setting-all-tabs').click();
        await vi.waitFor(() => expect(controller.settings.allTabs).toBe(false));
        expect($('chip-all-tabs').classList.contains('active')).toBe(false);
      });
    });

    describe('footer and opacity', () => {
      beforeEach(() => {
        usePopupHtml();
      });

      it('N skipped: hidden at 0', async () => {
        chrome.storage.local.get.mockResolvedValueOnce({});
        await controller._loadHeavyPresets();
        expect($('heavy-skipped').hidden).toBe(true);
        chrome.storage.local.get.mockResolvedValueOnce({ heavyPresets: { rain: { fps: 5 }, radar: { fps: 9 } } });
        await controller._loadHeavyPresets();
        expect($('heavy-skipped').hidden).toBe(false);
        expect($('heavy-skipped').textContent).toBe('2 skipped');
        expect($('heavy-skipped').title).toBe('rain, radar');
      });

      it('Opacity shows the value', () => {
        controller._bindEvents();
        const slider = $('opacity-slider');
        slider.value = '40';
        slider.dispatchEvent(new Event('input'));
        expect($('opacity-value').textContent).toBe('40%');
        expect(slider.style.getPropertyValue('--v')).toBe('40%');
        controller.opacity = 0.8;
        controller._updateUI();
        expect(slider.value).toBe('80');
        expect($('opacity-value').textContent).toBe('80%');
      });
    });

    // chrome:// やストアなど: ロゴ・マーク・ひとことだけ
    describe('pages it cannot run on', () => {
      beforeEach(() => {
        usePopupHtml();
      });

      it('shows only the logo, the mark and "This page can\'t be overlaid"', async () => {
        chrome.tabs.query.mockResolvedValueOnce([{ id: 7, url: 'chrome://extensions/' }]);
        await controller.init();
        expect(document.querySelector('.popup').classList.contains('is-blocked')).toBe(true);
        expect($('blocked').hidden).toBe(false);
        expect($('blocked-msg').textContent).toBe("This page can't be overlaid");
        expect($('blocked').querySelector('img.mark').getAttribute('src')).toBe('mark.png');
        // 操作は付けない・エンジンも読まない
        expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
        expect(controller._livePollTimer).toBeNull();
      });
    });
  });
});
