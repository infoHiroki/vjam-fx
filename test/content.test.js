import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// content.js exposes VJamFXEngine on window
// We'll import it as a module for testing
import { VJamFXEngine } from '../content/content.js';

describe('VJamFXEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new VJamFXEngine();
    vi.clearAllMocks();
  });

  afterEach(() => {
    engine.destroy();
    // Clean up any DOM elements
    document.querySelectorAll('[data-vjam-fx]').forEach(el => el.remove());
  });

  describe('constructor', () => {
    it('should initialize as inactive', () => {
      expect(engine.active).toBe(false);
    });

    it('should have default blendMode of screen', () => {
      expect(engine.blendMode).toBe('screen');
    });
  });

  describe('createOverlay', () => {
    it('should create a full-viewport canvas container', () => {
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

    it('should only accept valid blend modes', () => {
      engine.createOverlay();
      engine.setBlendMode('multiply'); // not allowed
      const overlay = document.querySelector('[data-vjam-fx]');
      expect(overlay.style.mixBlendMode).toBe('screen'); // unchanged
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
  });

  describe('destroy', () => {
    it('should remove overlay from DOM', () => {
      engine.createOverlay();
      engine.destroy();
      const overlay = document.querySelector('[data-vjam-fx]');
      expect(overlay).toBeNull();
    });

    it('should handle destroy when no overlay exists', () => {
      expect(() => engine.destroy()).not.toThrow();
    });
  });

  describe('message handling', () => {
    it('should handle start message', async () => {
      engine.handleMessage({ action: 'start', preset: 'starfield' });
      // startPreset is async, but handleMessage fires it
      // active is set synchronously at the start of startPreset
      expect(engine.currentPresetName).toBe('starfield');
      // Wait for async completion
      await vi.waitFor(() => expect(engine.active).toBe(true));
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
      expect(engine.currentPresetName).toBe('mandala');
      // Wait for async completion
      await vi.waitFor(() => expect(engine.currentPresetName).toBe('mandala'));
    });
  });
});
