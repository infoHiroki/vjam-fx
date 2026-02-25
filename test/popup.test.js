import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PopupController } from '../popup/popup.js';

describe('PopupController', () => {
  let controller;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <input type="checkbox" id="toggle" />
      <div id="preset-list">
        <input type="radio" name="preset" value="neon-tunnel" checked>
      </div>
      <select id="blend-mode">
        <option value="screen">Screen</option>
        <option value="lighten">Lighten</option>
        <option value="difference">Difference</option>
        <option value="exclusion">Exclusion</option>
      </select>
      <button id="mic-toggle" class="mic-btn on">ON</button>
      <a id="vjam-link" href="#">Get VJam</a>
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
    it('should have 10 presets available', () => {
      expect(controller.presets.length).toBe(10);
    });

    it('should have preset names matching expected list', () => {
      const names = controller.presets.map(p => p.id);
      expect(names).toContain('neon-tunnel');
      expect(names).toContain('kaleidoscope');
      expect(names).toContain('mandala');
      expect(names).toContain('sine-waves');
      expect(names).toContain('gradient-sweep');
      expect(names).toContain('moire');
      expect(names).toContain('hypnotic');
      expect(names).toContain('starfield');
      expect(names).toContain('rain');
      expect(names).toContain('barcode');
    });
  });

  describe('toggle', () => {
    it('should inject scripts and send start on toggle ON', async () => {
      controller.selectedPreset = 'neon-tunnel';
      await controller.toggleEffect(true);
      // Should call executeScript: p5 + base-preset + audio-analyzer + preset + engine + start command = 6
      expect(chrome.scripting.executeScript).toHaveBeenCalled();
      expect(controller.isActive).toBe(true);
    });

    it('should send stop command on toggle OFF', async () => {
      controller.isActive = true;
      await controller.toggleEffect(false);
      expect(chrome.scripting.executeScript).toHaveBeenCalled();
      expect(controller.isActive).toBe(false);
    });
  });

  describe('blend mode', () => {
    it('should send setBlendMode command on change', async () => {
      controller.isActive = true;
      await controller.changeBlendMode('difference');
      expect(chrome.scripting.executeScript).toHaveBeenCalled();
    });

    it('should only allow valid blend modes', () => {
      const valid = ['screen', 'lighten', 'difference', 'exclusion'];
      expect(controller.validBlendModes).toEqual(valid);
    });

    it('should reject invalid blend modes', async () => {
      controller.isActive = true;
      await controller.changeBlendMode('multiply');
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });
  });

  describe('preset switching', () => {
    it('should send switchPreset command while active', async () => {
      controller.isActive = true;
      await controller.switchPreset('mandala');
      expect(chrome.scripting.executeScript).toHaveBeenCalled();
      expect(controller.selectedPreset).toBe('mandala');
    });
  });

  describe('mic toggle', () => {
    it('should toggle mic state', () => {
      expect(controller.micEnabled).toBe(true);
      controller.micEnabled = false;
      expect(controller.micEnabled).toBe(false);
    });
  });

  describe('_sendCommand', () => {
    it('should not send if no tabId', async () => {
      controller._tabId = null;
      await controller._sendCommand({ action: 'stop' });
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });
  });
});
