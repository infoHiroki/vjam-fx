import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VJamFXEngine } from '../content/content.js';

describe('VJamFXEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new VJamFXEngine();
    vi.clearAllMocks();
  });

  afterEach(() => {
    engine.destroy();
    document.querySelectorAll('[data-vjam-fx]').forEach(el => el.remove());
  });

  describe('constructor', () => {
    it('should initialize as inactive', () => {
      expect(engine.active).toBe(false);
    });

    it('should have default blendMode of screen', () => {
      expect(engine.blendMode).toBe('screen');
    });

    it('should have micEnabled true by default', () => {
      expect(engine.micEnabled).toBe(true);
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
    it('should set active to true', async () => {
      await engine.startPreset('neon-tunnel');
      expect(engine.active).toBe(true);
    });

    it('should create overlay if not exists', async () => {
      await engine.startPreset('neon-tunnel');
      const overlay = document.querySelector('[data-vjam-fx]');
      expect(overlay).not.toBeNull();
    });

    it('should store current preset name', async () => {
      await engine.startPreset('kaleidoscope');
      expect(engine.currentPresetName).toBe('kaleidoscope');
    });

    it('should destroy previous preset when switching', async () => {
      await engine.startPreset('rain');
      const firstPreset = engine.currentPreset;
      await engine.startPreset('mandala');
      expect(engine.currentPresetName).toBe('mandala');
    });
  });

  describe('stop', () => {
    it('should set active to false', async () => {
      await engine.startPreset('neon-tunnel');
      engine.stop();
      expect(engine.active).toBe(false);
    });

    it('should destroy current preset', async () => {
      await engine.startPreset('neon-tunnel');
      engine.stop();
      expect(engine.currentPreset).toBeNull();
    });

    it('should clear preset name', async () => {
      await engine.startPreset('neon-tunnel');
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

    it('should clean up audio analyzer', async () => {
      engine.audioAnalyzer = { destroy: vi.fn(), started: false };
      engine.destroy();
      expect(engine.audioAnalyzer).toBeNull();
    });
  });

  describe('setMic', () => {
    it('should update micEnabled flag', () => {
      engine.setMic(false);
      expect(engine.micEnabled).toBe(false);
    });

    it('should destroy audio analyzer when disabled', () => {
      const mockDestroy = vi.fn();
      engine.audioAnalyzer = { destroy: mockDestroy };
      engine.setMic(false);
      expect(mockDestroy).toHaveBeenCalled();
      expect(engine.audioAnalyzer).toBeNull();
    });
  });

  describe('handleMessage', () => {
    it('should handle start message', async () => {
      engine.handleMessage({ action: 'start', preset: 'starfield' });
      await vi.waitFor(() => expect(engine.active).toBe(true));
      expect(engine.currentPresetName).toBe('starfield');
    });

    it('should handle stop message', async () => {
      await engine.startPreset('starfield');
      engine.handleMessage({ action: 'stop' });
      expect(engine.active).toBe(false);
    });

    it('should handle setBlendMode message', () => {
      engine.createOverlay();
      engine.handleMessage({ action: 'setBlendMode', blendMode: 'exclusion' });
      expect(engine.blendMode).toBe('exclusion');
    });

    it('should handle switchPreset message', async () => {
      await engine.startPreset('rain');
      engine.handleMessage({ action: 'switchPreset', preset: 'mandala' });
      await vi.waitFor(() => expect(engine.currentPresetName).toBe('mandala'));
    });

    it('should handle setMic message', () => {
      engine.handleMessage({ action: 'setMic', enabled: false });
      expect(engine.micEnabled).toBe(false);
    });

    it('should handle start with blendMode and mic', () => {
      engine.createOverlay();
      engine.handleMessage({ action: 'start', preset: 'rain', blendMode: 'difference', mic: false });
      expect(engine.blendMode).toBe('difference');
      expect(engine.micEnabled).toBe(false);
    });
  });
});
