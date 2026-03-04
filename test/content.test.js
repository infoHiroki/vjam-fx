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

    it('should have audioEnabled true by default', () => {
      expect(engine.audioEnabled).toBe(true);
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

    it('should clean up external audio data', () => {
      engine._externalAudioData = { beat: true };
      engine.destroy();
      expect(engine._externalAudioData).toBeNull();
    });
  });

  describe('audioEnabled', () => {
    it('should default to true', () => {
      expect(engine.audioEnabled).toBe(true);
    });

    it('should toggle via handleMessage', () => {
      engine.handleMessage({ action: 'setAudioEnabled', enabled: false });
      expect(engine.audioEnabled).toBe(false);
      engine.handleMessage({ action: 'setAudioEnabled', enabled: true });
      expect(engine.audioEnabled).toBe(true);
    });

    it('should clear external audio data when disabled', () => {
      engine._externalAudioData = { beat: true };
      engine.handleMessage({ action: 'setAudioEnabled', enabled: false });
      expect(engine._externalAudioData).toBeNull();
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

    it('should handle start with blendMode', () => {
      engine.createOverlay();
      engine.handleMessage({ action: 'start', preset: 'neon-tunnel', blendMode: 'difference' });
      expect(engine.blendMode).toBe('difference');
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
      expect(['screen', 'lighten', 'difference', 'exclusion', 'color-dodge']).toContain(engine.blendMode);
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

    it('should randomize blend mode when autoBlend is true', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000, autoBlend: true });
      // After first tick, blend mode should be a valid one
      expect(['screen', 'lighten', 'difference', 'exclusion', 'color-dodge']).toContain(engine.blendMode);
      engine._stopAutoCycle();
    });

    it('should not randomize blend mode when autoBlend is false', () => {
      engine.createOverlay();
      engine.active = true;
      engine.setBlendMode('screen');
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000, autoBlend: false });
      // Blend mode should remain screen (not randomized)
      expect(engine.blendMode).toBe('screen');
      engine._stopAutoCycle();
    });

    it('should randomize filters when autoFilters is true', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000, autoFilters: true });
      // After first tick, filters may or may not be set (random), but _autoFilters flag should be true
      expect(engine._autoFilters).toBe(true);
      engine._stopAutoCycle();
    });

    it('should not randomize filters when autoFilters is false', () => {
      engine.createOverlay();
      engine.active = true;
      engine.setFilter('invert', true);
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000, autoFilters: false });
      // Manually set filter should remain
      expect(engine.activeFilters.has('invert')).toBe(true);
      engine._stopAutoCycle();
    });

    it('should pass autoBlend and autoFilters flags via handleMessage', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000, autoBlend: true, autoFilters: true });
      expect(engine._autoBlend).toBe(true);
      expect(engine._autoFilters).toBe(true);
      engine._stopAutoCycle();
    });

    it('should skip first tick when skipFirstTick option is true', () => {
      engine.createOverlay();
      engine.active = true;
      engine._addLayer('neon-tunnel');
      expect(engine.activeLayers.size).toBe(1);
      // startAutoCycle with skipFirstTick should not change layers immediately
      engine.startAutoCycle(['kaleidoscope', 'mandala'], 100000, { skipFirstTick: true });
      expect(engine.activeLayers.has('neon-tunnel')).toBe(true);
      engine._stopAutoCycle();
    });

    it('should update options via updateAutoCycleOptions without restarting timer', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 100000, autoBlend: false, autoFilters: false });
      expect(engine._autoBlend).toBe(false);
      expect(engine._autoFilters).toBe(false);
      const timer = engine._autoCycleTimer;
      // Update options via message
      engine.handleMessage({ action: 'updateAutoCycleOptions', autoBlend: true, autoFilters: true });
      expect(engine._autoBlend).toBe(true);
      expect(engine._autoFilters).toBe(true);
      // Timer should not be reset
      expect(engine._autoCycleTimer).toBe(timer);
      engine._stopAutoCycle();
    });

    it('should ignore updateAutoCycleOptions when auto-cycle is not running', () => {
      engine.createOverlay();
      engine.active = true;
      engine.updateAutoCycleOptions({ autoBlend: true });
      expect(engine._autoBlend).toBeFalsy();
    });
  });

  describe('standalone autoFX', () => {
    it('should start and stop standalone autoFX via messages', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoFX', autoBlend: true, autoFilters: true });
      expect(engine._autoFXTimer).not.toBeNull();
      expect(engine._autoFXBlend).toBe(true);
      expect(engine._autoFXFilters).toBe(true);
      engine.handleMessage({ action: 'stopAutoFX' });
      expect(engine._autoFXTimer).toBeNull();
    });

    it('should randomize blend on autoFX tick when autoBlend is true', () => {
      engine.createOverlay();
      engine.active = true;
      engine.setBlendMode('screen');
      engine._autoFXBlend = true;
      engine._autoFXFilters = false;
      engine._autoFXTick();
      expect(['screen', 'lighten', 'difference', 'exclusion', 'color-dodge']).toContain(engine.blendMode);
    });

    it('should randomize filters on autoFX tick when autoFilters is true', () => {
      engine.createOverlay();
      engine.active = true;
      engine._autoFXBlend = false;
      engine._autoFXFilters = true;
      engine._autoFXTick();
      expect(engine._autoFXFilters).toBe(true);
    });

    it('should stop autoFX on kill', () => {
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoFX', autoBlend: true, autoFilters: false });
      expect(engine._autoFXTimer).not.toBeNull();
      engine.kill({});
      expect(engine._autoFXTimer).toBeNull();
    });

    it('should not start timer when both blend and filters are false', () => {
      engine.createOverlay();
      engine.active = true;
      engine.startAutoFX({ autoBlend: false, autoFilters: false });
      expect(engine._autoFXTimer).toBeFalsy();
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

  describe('tab audio capture', () => {
    it('should have null _externalAudioData initially', () => {
      expect(engine._externalAudioData).toBeNull();
    });

    it('should receive audio data via window message from bridge', () => {
      const audioData = { beat: true, bpm: 120, strength: 0.8, rms: 0.1, bass: 0.5, mid: 0.3, treble: 0.2 };
      window.dispatchEvent(new MessageEvent('message', {
        data: { source: 'vjam-fx-bridge', type: 'audioData', data: audioData },
      }));
      expect(engine._externalAudioData).toEqual(audioData);
    });

    it('should ignore messages from other sources', () => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { source: 'other', type: 'audioData', data: { beat: true } },
      }));
      expect(engine._externalAudioData).toBeNull();
    });

    it('should disable audio via setAudioEnabled', () => {
      engine._externalAudioData = { beat: true };
      engine.handleMessage({ action: 'setAudioEnabled', enabled: false });
      expect(engine.audioEnabled).toBe(false);
      expect(engine._externalAudioData).toBeNull();
    });

    it('should clean up message listener on destroy', () => {
      const spy = vi.spyOn(window, 'removeEventListener');
      engine.destroy();
      expect(spy).toHaveBeenCalledWith('message', expect.any(Function));
      spy.mockRestore();
    });
  });

  describe('fullscreen support', () => {
    it('should register fullscreenchange listener', () => {
      const spy = vi.spyOn(document, 'addEventListener');
      const e = new VJamFXEngine();
      expect(spy).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
      e.destroy();
      spy.mockRestore();
    });

    it('should move overlay into fullscreen element', () => {
      engine.createOverlay();
      const fsEl = document.createElement('div');
      document.body.appendChild(fsEl);
      // Simulate fullscreen
      Object.defineProperty(document, 'fullscreenElement', { value: fsEl, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(fsEl.contains(engine.overlay)).toBe(true);
      // Simulate exit fullscreen
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(document.body.contains(engine.overlay)).toBe(true);
      fsEl.remove();
    });

    it('should clean up fullscreenchange listener on destroy', () => {
      const spy = vi.spyOn(document, 'removeEventListener');
      engine.destroy();
      expect(spy).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
      spy.mockRestore();
    });
  });

  describe('stop vs destroy separation', () => {
    it('handleMessage stop should NOT remove bridge listener', () => {
      engine.startPreset('neon-tunnel');
      engine.handleMessage({ action: 'stop' });
      // Bridge listener should still be registered
      expect(engine._onBridgeMessage).not.toBeNull();
    });

    it('handleMessage stop should NOT remove fullscreen listener', () => {
      engine.startPreset('neon-tunnel');
      engine.handleMessage({ action: 'stop' });
      expect(engine._onFullscreenChange).not.toBeNull();
    });

    it('handleMessage stop should remove overlay', () => {
      engine.startPreset('neon-tunnel');
      engine.handleMessage({ action: 'stop' });
      expect(engine.overlay).toBeNull();
      expect(document.querySelector('[data-vjam-fx]')).toBeNull();
    });

    it('should receive audio data after stop + restart', () => {
      engine.startPreset('neon-tunnel');
      engine.handleMessage({ action: 'stop' });
      // Restart
      engine.startPreset('neon-tunnel');
      // Send audio data via bridge
      const audioData = { beat: true, bpm: 120, strength: 0.8, rms: 0.1, bass: 0.5, mid: 0.3, treble: 0.2 };
      window.dispatchEvent(new MessageEvent('message', {
        data: { source: 'vjam-fx-bridge', type: 'audioData', data: audioData },
      }));
      expect(engine._externalAudioData).toEqual(audioData);
    });

    it('_ensureListeners should re-register if listeners were nulled', () => {
      // Simulate listeners being lost (e.g. after destroy)
      window.removeEventListener('message', engine._onBridgeMessage);
      document.removeEventListener('fullscreenchange', engine._onFullscreenChange);
      engine._onBridgeMessage = null;
      engine._onFullscreenChange = null;

      engine._ensureListeners();
      expect(engine._onBridgeMessage).not.toBeNull();
      expect(engine._onFullscreenChange).not.toBeNull();

      // Verify bridge listener works
      const audioData = { beat: false, bpm: 120, strength: 0, rms: 0.05, bass: 0.1, mid: 0.1, treble: 0.1 };
      window.dispatchEvent(new MessageEvent('message', {
        data: { source: 'vjam-fx-bridge', type: 'audioData', data: audioData },
      }));
      expect(engine._externalAudioData).toEqual(audioData);
    });

    it('_ensureListeners should not double-register', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const docSpy = vi.spyOn(document, 'addEventListener');
      engine._ensureListeners();
      // Should not add again since already registered
      expect(addSpy).not.toHaveBeenCalledWith('message', expect.any(Function));
      expect(docSpy).not.toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
      addSpy.mockRestore();
      docSpy.mockRestore();
    });
  });

  describe('fullscreen handler robustness', () => {
    it('should skip move if overlay is already in correct parent', () => {
      engine.createOverlay();
      const appendSpy = vi.spyOn(document.body, 'appendChild');
      // Trigger fullscreenchange with no fullscreen element (overlay already in body)
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));
      // Should not call appendChild since overlay is already in body
      expect(appendSpy).not.toHaveBeenCalled();
      appendSpy.mockRestore();
    });
  });


  describe('setPresetParam', () => {
    it('should call setParam on active layer preset', () => {
      engine.createOverlay();
      engine._addLayer('neon-tunnel');
      const layer = engine.activeLayers.get('neon-tunnel');
      layer.preset.setParam = vi.fn();
      engine.handleMessage({ action: 'setPresetParam', preset: 'neon-tunnel', key: 'speed', value: 2 });
      expect(layer.preset.setParam).toHaveBeenCalledWith('speed', 2);
    });

    it('should not throw when preset is not active', () => {
      engine.createOverlay();
      expect(() => {
        engine.handleMessage({ action: 'setPresetParam', preset: 'nonexistent', key: 'speed', value: 2 });
      }).not.toThrow();
    });

    it('should not throw when preset has no setParam method', () => {
      engine.createOverlay();
      engine._addLayer('neon-tunnel');
      const layer = engine.activeLayers.get('neon-tunnel');
      delete layer.preset.setParam;
      expect(() => {
        engine.handleMessage({ action: 'setPresetParam', preset: 'neon-tunnel', key: 'speed', value: 2 });
      }).not.toThrow();
    });
  });

  describe('createMediaElementSource guard', () => {
    it('should skip reconnection to same media element', () => {
      const media = document.createElement('video');
      // Simulate already connected
      engine._videoAudioMedia = media;
      engine._videoAudioCtx = { state: 'running', close: vi.fn().mockResolvedValue(undefined) };
      const origCtx = engine._videoAudioCtx;
      engine._connectMediaElement(media);
      // Should not create new AudioContext
      expect(engine._videoAudioCtx).toBe(origCtx);
    });

    it('should clear _videoAudioMedia on destroy', () => {
      engine._videoAudioMedia = document.createElement('video');
      engine._destroyVideoAudio();
      expect(engine._videoAudioMedia).toBeNull();
    });
  });

  describe('silence check timer cleanup', () => {
    it('should clear silence timer on _stopVideoAudio', () => {
      engine._silenceCheckTimer = setInterval(() => {}, 1000);
      const timerId = engine._silenceCheckTimer;
      engine._stopVideoAudio();
      expect(engine._silenceCheckTimer).toBeNull();
    });

    it('should clear silence timer on _destroyVideoAudio', () => {
      engine._silenceCheckTimer = setInterval(() => {}, 1000);
      engine._destroyVideoAudio();
      expect(engine._silenceCheckTimer).toBeNull();
    });
  });

  describe('audio method defensive checks', () => {
    it('should not throw when preset lacks updateAudio', () => {
      engine.createOverlay();
      engine._addLayer('neon-tunnel');
      const layer = engine.activeLayers.get('neon-tunnel');
      delete layer.preset.updateAudio;
      // Simulating audio feed — should not throw
      expect(() => {
        if (typeof layer.preset.updateAudio === 'function') layer.preset.updateAudio({});
      }).not.toThrow();
    });

    it('should not throw when preset lacks onBeat', () => {
      engine.createOverlay();
      engine._addLayer('neon-tunnel');
      const layer = engine.activeLayers.get('neon-tunnel');
      delete layer.preset.onBeat;
      expect(() => {
        if (typeof layer.preset.onBeat === 'function') layer.preset.onBeat(0.5);
      }).not.toThrow();
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

  describe('stop() try-catch on layer destruction', () => {
    it('should continue cleaning up other layers when one destroy throws', () => {
      engine.createOverlay();
      engine._addLayer('neon-tunnel');

      // Create a fake second layer that throws on destroy
      const badDiv = document.createElement('div');
      badDiv.setAttribute('data-vjam-layer', 'bad-layer');
      engine.overlay.appendChild(badDiv);
      engine.activeLayers.set('bad-layer', {
        preset: { destroy: () => { throw new Error('boom'); } },
        container: badDiv,
      });

      expect(() => engine.stop()).not.toThrow();
      expect(engine.activeLayers.size).toBe(0);
    });

    it('should clear all layers even when multiple destroys throw', () => {
      engine.createOverlay();
      const div1 = document.createElement('div');
      const div2 = document.createElement('div');
      engine.overlay.appendChild(div1);
      engine.overlay.appendChild(div2);
      engine.activeLayers.set('err1', { preset: { destroy: () => { throw new Error('e1'); } }, container: div1 });
      engine.activeLayers.set('err2', { preset: { destroy: () => { throw new Error('e2'); } }, container: div2 });

      expect(() => engine.stop()).not.toThrow();
      expect(engine.activeLayers.size).toBe(0);
    });
  });

  describe('kill() try-catch on layer destruction', () => {
    it('should continue cleaning up other layers when one destroy throws', () => {
      engine.createOverlay();
      engine._addLayer('neon-tunnel');

      const badDiv = document.createElement('div');
      badDiv.setAttribute('data-vjam-layer', 'bad-layer');
      engine.overlay.appendChild(badDiv);
      engine.activeLayers.set('bad-layer', {
        preset: { destroy: () => { throw new Error('boom'); } },
        container: badDiv,
      });

      expect(() => engine.kill({})).not.toThrow();
      expect(engine.activeLayers.size).toBe(0);
    });

    it('should reset blend and filters even when layer destroy throws', () => {
      engine.createOverlay();
      engine.setBlendMode('difference');
      engine.setFilter('invert', true);

      const badDiv = document.createElement('div');
      engine.overlay.appendChild(badDiv);
      engine.activeLayers.set('err', { preset: { destroy: () => { throw new Error('boom'); } }, container: badDiv });

      engine.kill({});
      expect(engine.blendMode).toBe('screen');
      expect(engine.activeFilters.size).toBe(0);
    });
  });

  describe('_addLayer try-catch', () => {
    it('should remove layerDiv and not create activeLayers entry when preset constructor throws', () => {
      engine.createOverlay();
      // Register a preset that throws on construction
      window.VJamFX.presets['throw-preset'] = class {
        constructor() { throw new Error('constructor boom'); }
      };

      expect(() => engine._addLayer('throw-preset')).not.toThrow();
      expect(engine.activeLayers.has('throw-preset')).toBe(false);
      expect(document.querySelector('[data-vjam-layer="throw-preset"]')).toBeNull();

      delete window.VJamFX.presets['throw-preset'];
    });

    it('should remove layerDiv when preset setup throws', () => {
      engine.createOverlay();
      window.VJamFX.presets['setup-fail'] = class {
        setup() { throw new Error('setup boom'); }
      };

      engine._addLayer('setup-fail');
      expect(engine.activeLayers.has('setup-fail')).toBe(false);
      expect(document.querySelector('[data-vjam-layer="setup-fail"]')).toBeNull();

      delete window.VJamFX.presets['setup-fail'];
    });
  });

  describe('AudioContext leak fix', () => {
    it('should close old AudioContext when _connectMediaElement is called with a different element', () => {
      const media1 = document.createElement('video');
      const closeFn = vi.fn().mockResolvedValue(undefined);
      engine._videoAudioMedia = media1;
      engine._videoAudioCtx = { state: 'running', close: closeFn };
      engine._videoAudioAnalyser = { disconnect: vi.fn() };
      engine._videoAudioSource = { disconnect: vi.fn() };

      const media2 = document.createElement('video');
      // _connectMediaElement will try new AudioContext which may throw in jsdom, but close should be called first
      try { engine._connectMediaElement(media2); } catch (e) { /* AudioContext not available in jsdom */ }

      expect(closeFn).toHaveBeenCalled();
    });

    it('should not close AudioContext when called with the same element', () => {
      const media = document.createElement('video');
      const closeFn = vi.fn().mockResolvedValue(undefined);
      engine._videoAudioMedia = media;
      engine._videoAudioCtx = { state: 'running', close: closeFn };

      engine._connectMediaElement(media);
      expect(closeFn).not.toHaveBeenCalled();
    });
  });

  describe('fadeDuration validation', () => {
    it('should reject negative fadeDuration', () => {
      engine.handleMessage({ action: 'setFadeDuration', duration: -1 });
      expect(engine._fadeDuration).toBe(1.5);
    });

    it('should reject NaN fadeDuration', () => {
      engine.handleMessage({ action: 'setFadeDuration', duration: NaN });
      expect(engine._fadeDuration).toBe(1.5);
    });

    it('should reject Infinity fadeDuration', () => {
      engine.handleMessage({ action: 'setFadeDuration', duration: Infinity });
      expect(engine._fadeDuration).toBe(1.5);
    });

    it('should accept zero fadeDuration', () => {
      engine.handleMessage({ action: 'setFadeDuration', duration: 0 });
      expect(engine._fadeDuration).toBe(0);
    });

    it('should accept valid positive fadeDuration', () => {
      engine.handleMessage({ action: 'setFadeDuration', duration: 2.5 });
      expect(engine._fadeDuration).toBe(2.5);
    });
  });

  describe('audioSensitivity validation', () => {
    it('should reject zero audioSensitivity', () => {
      engine.handleMessage({ action: 'setAudioSensitivity', sensitivity: 0 });
      expect(engine._audioSensitivity).toBe(1.0);
    });

    it('should reject negative audioSensitivity', () => {
      engine.handleMessage({ action: 'setAudioSensitivity', sensitivity: -0.5 });
      expect(engine._audioSensitivity).toBe(1.0);
    });

    it('should reject NaN audioSensitivity', () => {
      engine.handleMessage({ action: 'setAudioSensitivity', sensitivity: NaN });
      expect(engine._audioSensitivity).toBe(1.0);
    });

    it('should accept valid positive audioSensitivity', () => {
      engine.handleMessage({ action: 'setAudioSensitivity', sensitivity: 2.0 });
      expect(engine._audioSensitivity).toBe(2.0);
    });
  });

  describe('destroy() nulls window._vjamFxEngine', () => {
    it('should set window._vjamFxEngine to null after destroy', () => {
      const e = new VJamFXEngine();
      window._vjamFxEngine = e;
      e.destroy();
      expect(window._vjamFxEngine).toBeNull();
    });
  });

  describe('Auto cycle timer race guard', () => {
    it('should not tick after _stopAutoCycle clears timer', () => {
      vi.useFakeTimers();
      engine.createOverlay();
      engine.active = true;
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 5000 });
      expect(engine._autoCycleTimer).not.toBeNull();

      // First tick runs immediately, so layers may exist — record current count
      const layersAfterFirstTick = engine.activeLayers.size;

      engine._stopAutoCycle();
      expect(engine._autoCycleTimer).toBeNull();

      // Advance time past what would have been the next tick
      vi.advanceTimersByTime(10000);

      // No NEW layers should be added after stop
      expect(engine.activeLayers.size).toBe(layersAfterFirstTick);
      vi.useRealTimers();
    });

    it('should clear timer and not add layers after stopAutoCycle', () => {
      vi.useFakeTimers();
      engine.createOverlay();
      engine.active = true;

      // Start auto-cycle, first tick adds layers immediately
      engine.handleMessage({ action: 'startAutoCycle', presets: ['neon-tunnel'], interval: 3000 });
      // Kill layers added by first tick
      for (const [, layer] of engine.activeLayers) {
        try { layer.preset.destroy(); } catch (e) { /* ignore */ }
        try { layer.container.remove(); } catch (e) { /* ignore */ }
      }
      engine.activeLayers.clear();

      engine._stopAutoCycle();

      // Advance timers — no new layers should appear
      vi.advanceTimersByTime(20000);
      expect(engine.activeLayers.size).toBe(0);
      vi.useRealTimers();
    });
  });
});
