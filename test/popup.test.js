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
        <button id="mic-toggle" class="mic-btn on">ON</button>
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
    it('should have 38 presets available', () => {
      expect(controller.presets.length).toBe(38);
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
    it('should only allow valid blend modes', () => {
      const valid = ['screen', 'lighten', 'difference', 'exclusion'];
      expect(controller.validBlendModes).toEqual(valid);
    });
  });

  describe('_sendCommand', () => {
    it('should not send if no tabId', async () => {
      controller._tabId = null;
      await controller._sendCommand({ action: 'stop' });
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    it('should have _currentIndex starting at 0', () => {
      expect(controller._currentIndex).toBe(0);
    });

    it('should track autoCycleActive state', () => {
      expect(controller.autoCycleActive).toBe(false);
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
      expect(call[0].state.autoCyclePresets.length).toBe(38);
    });

    it('should have null autoCyclePresets when not cycling', async () => {
      controller.isActive = true;
      controller.autoCycleActive = false;
      await controller._saveState();
      const call = chrome.runtime.sendMessage.mock.calls[0];
      expect(call[0].state.autoCyclePresets).toBeNull();
    });
  });
});
