import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load IIFE scripts in order (same as Chrome injection)
const baseCode = readFileSync(resolve(__dirname, '../content/base-preset.js'), 'utf-8');
const analyzerCode = readFileSync(resolve(__dirname, '../content/audio-analyzer.js'), 'utf-8');
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
    eval(analyzerCode);
    eval(neonCode);
    // Clear any previous engine
    delete window._vjamFxEngine;
    eval(engineCode);
    VJamFXEngine = window.VJamFXEngine;
  });

  beforeEach(() => {
    // Create fresh engine for each test
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

    it('should start audio analyzer when mic enabled', () => {
      engine.startPreset('neon-tunnel');
      expect(engine.audioAnalyzer).not.toBeNull();
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

    it('should clean up audio analyzer', () => {
      engine.startPreset('neon-tunnel');
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
      engine.startPreset('neon-tunnel');
      engine.setMic(false);
      expect(engine.audioAnalyzer).toBeNull();
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

    it('should handle setMic message', () => {
      engine.handleMessage({ action: 'setMic', enabled: false });
      expect(engine.micEnabled).toBe(false);
    });

    it('should handle start with blendMode and mic', () => {
      engine.createOverlay();
      engine.handleMessage({ action: 'start', preset: 'neon-tunnel', blendMode: 'difference', mic: false });
      expect(engine.blendMode).toBe('difference');
      expect(engine.micEnabled).toBe(false);
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
});
