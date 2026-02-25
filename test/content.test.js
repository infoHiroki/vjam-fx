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

  describe('multi-layer', () => {
    it('should add a layer', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'addLayer', preset: 'neon-tunnel' });
      expect(engine.activeLayers.has('neon-tunnel')).toBe(true);
    });

    it('should remove a layer', () => {
      engine.startPreset('neon-tunnel');
      engine.handleMessage({ action: 'removeLayer', preset: 'neon-tunnel' });
      expect(engine.activeLayers.has('neon-tunnel')).toBe(false);
    });

    it('should toggle a layer on and off', () => {
      engine.createOverlay();
      engine.handleMessage({ action: 'toggleLayer', preset: 'neon-tunnel' });
      expect(engine.activeLayers.has('neon-tunnel')).toBe(true);
      engine.handleMessage({ action: 'toggleLayer', preset: 'neon-tunnel' });
      expect(engine.activeLayers.has('neon-tunnel')).toBe(false);
    });

    it('should get active layer names', () => {
      engine.startPreset('neon-tunnel');
      const names = engine.getActiveLayerNames();
      expect(names).toContain('neon-tunnel');
    });

    it('should destroy all layers on stop', () => {
      engine.startPreset('neon-tunnel');
      engine.stop();
      expect(engine.activeLayers.size).toBe(0);
    });
  });

  describe('CSS filters', () => {
    it('should add a filter', () => {
      engine.createOverlay();
      engine.handleMessage({ action: 'setFilter', filter: 'invert', enabled: true });
      expect(engine.activeFilters.has('invert')).toBe(true);
    });

    it('should remove a filter', () => {
      engine.createOverlay();
      engine.setFilter('invert', true);
      engine.handleMessage({ action: 'setFilter', filter: 'invert', enabled: false });
      expect(engine.activeFilters.has('invert')).toBe(false);
    });

    it('should toggle a filter', () => {
      engine.createOverlay();
      engine.handleMessage({ action: 'toggleFilter', filter: 'hue-rotate' });
      expect(engine.activeFilters.has('hue-rotate')).toBe(true);
      engine.handleMessage({ action: 'toggleFilter', filter: 'hue-rotate' });
      expect(engine.activeFilters.has('hue-rotate')).toBe(false);
    });

    it('should apply filter CSS to overlay', () => {
      engine.createOverlay();
      engine.setFilter('invert', true);
      engine.setFilter('blur', true);
      const overlay = document.querySelector('[data-vjam-fx]');
      expect(overlay.style.filter).toContain('invert(1)');
      expect(overlay.style.filter).toContain('blur(3px)');
    });

    it('should clear all filters', () => {
      engine.createOverlay();
      engine.setFilter('invert', true);
      engine.setFilter('sepia', true);
      engine.handleMessage({ action: 'clearFilters' });
      expect(engine.activeFilters.size).toBe(0);
      const overlay = document.querySelector('[data-vjam-fx]');
      expect(overlay.style.filter).toBe('none');
    });

    it('should reject invalid filter names', () => {
      engine.createOverlay();
      engine.setFilter('nonexistent', true);
      expect(engine.activeFilters.size).toBe(0);
    });
  });

  describe('kill', () => {
    it('should clear all layers and filters', () => {
      engine.startPreset('neon-tunnel');
      engine.setFilter('invert', true);
      engine.handleMessage({ action: 'kill' });
      expect(engine.activeLayers.size).toBe(0);
      expect(engine.activeFilters.size).toBe(0);
      expect(engine.blendMode).toBe('screen');
    });

    it('should keep engine alive after kill', () => {
      engine.startPreset('neon-tunnel');
      engine.handleMessage({ action: 'kill' });
      // Engine should still have overlay, can add new layers
      expect(engine.overlay).not.toBeNull();
    });
  });

  describe('randomizeFX', () => {
    it('should set a valid blend mode', () => {
      engine.createOverlay();
      engine.handleMessage({ action: 'randomizeFX' });
      expect(['screen', 'lighten', 'difference', 'exclusion']).toContain(engine.blendMode);
    });
  });

  describe('auto-cycle', () => {
    it('should start and stop auto-cycle via messages', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 5000 });
      expect(engine._autoCycleTimer).not.toBeNull();
      engine.handleMessage({ action: 'stopAutoCycle' });
      expect(engine._autoCycleTimer).toBeNull();
    });

    it('should add layers on auto-cycle tick', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000 });
      // After startAutoCycle, the first tick runs immediately
      expect(engine.activeLayers.size).toBeGreaterThan(0);
      engine._stopAutoCycle();
    });

    it('should stop auto-cycle on destroy', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000 });
      engine.destroy();
      expect(engine._autoCycleTimer).toBeNull();
    });
  });

  describe('fade transitions', () => {
    it('should start layer with opacity 0 and transition', () => {
      engine.createOverlay();
      engine._addLayer('neon-tunnel');
      const layerDiv = document.querySelector('[data-vjam-layer="neon-tunnel"]');
      // Starts with opacity 0 (rAF mock doesn't actually trigger callback)
      expect(layerDiv.style.opacity).toBe('0');
      expect(layerDiv.style.transition).toContain('opacity');
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
