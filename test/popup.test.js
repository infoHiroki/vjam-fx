import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PopupController } from '../popup/popup.js';

describe('PopupController', () => {
  let controller;
  let container;

  beforeEach(() => {
    // Set up minimal popup DOM
    container = document.createElement('div');
    container.innerHTML = `
      <input type="checkbox" id="toggle" />
      <div id="preset-list"></div>
      <select id="blend-mode">
        <option value="screen">Screen</option>
        <option value="lighten">Lighten</option>
        <option value="difference">Difference</option>
        <option value="exclusion">Exclusion</option>
      </select>
      <button id="mic-toggle">Mic OFF</button>
      <a id="vjam-link" href="#">Get VJam</a>
    `;
    document.body.appendChild(container);
    controller = new PopupController();
    controller._tabId = 1; // Mock tab ID for message sending
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
    it('should send start message on toggle ON', async () => {
      controller.selectedPreset = 'neon-tunnel';
      await controller.toggleEffect(true);
      expect(chrome.scripting.executeScript).toHaveBeenCalled();
    });

    it('should send stop message on toggle OFF', async () => {
      controller.isActive = true;
      await controller.toggleEffect(false);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({ action: 'stop' })
      );
    });
  });

  describe('blend mode', () => {
    it('should send setBlendMode message on change', async () => {
      controller.isActive = true;
      await controller.changeBlendMode('difference');
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({ action: 'setBlendMode', blendMode: 'difference' })
      );
    });

    it('should only allow valid blend modes', () => {
      const valid = ['screen', 'lighten', 'difference', 'exclusion'];
      expect(controller.validBlendModes).toEqual(valid);
    });
  });

  describe('preset switching', () => {
    it('should send switchPreset when changing preset while active', async () => {
      controller.isActive = true;
      await controller.switchPreset('mandala');
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({ action: 'switchPreset', preset: 'mandala' })
      );
    });
  });
});
