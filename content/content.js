/**
 * VJam FX — Content Script Engine
 * Injected into page's MAIN world via chrome.scripting.executeScript
 * Uses IIFE pattern (no ESM) for CSP compatibility
 *
 * Features:
 * - Multi-layer: multiple presets can run simultaneously
 * - CSS filters: invert, hue-rotate, grayscale, saturate, brightness, contrast, sepia, blur
 * - Blend modes: screen, lighten, difference, exclusion
 */
(function() {
  'use strict';

  // Guard against double-injection
  if (window._vjamFxEngine) return;

  const VALID_BLEND_MODES = ['screen', 'lighten', 'difference', 'exclusion'];

  const FILTER_VALUES = {
    'invert':     'invert(1)',
    'hue-rotate': 'hue-rotate(180deg)',
    'grayscale':  'grayscale(1)',
    'saturate':   'saturate(2.5)',
    'brightness': 'brightness(1.4)',
    'contrast':   'contrast(1.5)',
    'sepia':      'sepia(1)',
    'blur':       'blur(3px)',
  };

  class VJamFXEngine {
    constructor() {
      this.active = false;
      this.blendMode = 'screen';
      this.currentPreset = null;
      this.currentPresetName = null;
      this.overlay = null;
      this.audioAnalyzer = null;
      this.micEnabled = true;
      this._rafId = null;

      // Multi-layer support
      this.activeLayers = new Map(); // name → { preset, container }
      this.activeFilters = new Set();
    }

    createOverlay() {
      if (this.overlay) return this.overlay;

      const overlay = document.createElement('div');
      overlay.setAttribute('data-vjam-fx', 'overlay');
      overlay.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 100vw',
        'height: 100vh',
        'z-index: 2147483647',
        'pointer-events: none',
        `mix-blend-mode: ${this.blendMode}`,
      ].join('; ');

      document.body.appendChild(overlay);
      this.overlay = overlay;
      return overlay;
    }

    setBlendMode(mode) {
      if (!VALID_BLEND_MODES.includes(mode)) return;
      this.blendMode = mode;
      if (this.overlay) {
        this.overlay.style.mixBlendMode = mode;
        // Apply to all layer canvases
        const canvases = this.overlay.querySelectorAll('canvas');
        for (let i = 0; i < canvases.length; i++) {
          canvases[i].style.mixBlendMode = mode;
        }
      }
    }

    /**
     * Add/toggle a layer. If already active, remove it. If not, add it.
     */
    toggleLayer(presetName) {
      if (this.activeLayers.has(presetName)) {
        this._removeLayer(presetName);
      } else {
        this._addLayer(presetName);
      }
    }

    _addLayer(presetName) {
      if (!window.VJamFX || !window.VJamFX.presets[presetName]) return;

      this.createOverlay();

      // Create a container div for this layer's canvas
      const layerDiv = document.createElement('div');
      layerDiv.setAttribute('data-vjam-layer', presetName);
      layerDiv.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;transition:opacity 0.8s ease-in;';
      this.overlay.appendChild(layerDiv);

      const PresetClass = window.VJamFX.presets[presetName];
      const preset = new PresetClass();
      preset.setup(layerDiv);

      // Apply blend mode to new canvas
      const canvas = layerDiv.querySelector('canvas');
      if (canvas) {
        canvas.style.mixBlendMode = this.blendMode;
      }

      this.activeLayers.set(presetName, { preset: preset, container: layerDiv });

      // Fade in on next frame
      requestAnimationFrame(() => { layerDiv.style.opacity = '1'; });
    }

    _removeLayer(presetName) {
      const layer = this.activeLayers.get(presetName);
      if (!layer) return;

      this.activeLayers.delete(presetName);

      // Fade out then remove
      const container = layer.container;
      container.style.transition = 'opacity 0.6s ease-out';
      container.style.opacity = '0';
      const onEnd = () => {
        layer.preset.destroy();
        container.remove();
      };
      container.addEventListener('transitionend', onEnd, { once: true });
      // Fallback: force remove after 800ms
      setTimeout(onEnd, 800);
    }

    /**
     * Start a single preset (legacy single-layer mode, also adds as a layer)
     */
    startPreset(presetName) {
      this.createOverlay();

      // Stop current single preset if any
      if (this.currentPreset) {
        this._removeLayer(this.currentPresetName);
        this.currentPreset = null;
      }

      this.currentPresetName = presetName;
      this.active = true;

      // Add as layer
      this._addLayer(presetName);
      const layer = this.activeLayers.get(presetName);
      if (layer) {
        this.currentPreset = layer.preset;
      }

      // Start audio if mic enabled and analyzer available
      if (this.micEnabled && !this.audioAnalyzer && window.VJamFX && window.VJamFX.AudioAnalyzer) {
        this.audioAnalyzer = new window.VJamFX.AudioAnalyzer();
        this.audioAnalyzer.start();
      }

      this._startLoop();
    }

    _startLoop() {
      if (this._rafId) return;

      const self = this;
      const loop = () => {
        if (!self.active) {
          self._rafId = null;
          return;
        }

        // Feed audio to ALL active layers
        if (self.audioAnalyzer && self.audioAnalyzer.started) {
          const audioData = self.audioAnalyzer.getAudioData();
          for (const [, layer] of self.activeLayers) {
            layer.preset.updateAudio(audioData);
            if (audioData.beat) {
              layer.preset.onBeat(audioData.strength);
            }
          }
        }

        self._rafId = requestAnimationFrame(loop);
      };

      this._rafId = requestAnimationFrame(loop);
    }

    stop() {
      this.active = false;

      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }

      // Destroy all layers
      for (const [name] of this.activeLayers) {
        const layer = this.activeLayers.get(name);
        layer.preset.destroy();
        layer.container.remove();
      }
      this.activeLayers.clear();

      this.currentPreset = null;
      this.currentPresetName = null;
    }

    destroy() {
      this._stopAutoCycle();
      this.stop();

      if (this.audioAnalyzer) {
        this.audioAnalyzer.destroy();
        this.audioAnalyzer = null;
      }

      if (this.overlay) {
        this.overlay.remove();
        this.overlay = null;
      }

      this.activeFilters.clear();
    }

    setMic(enabled) {
      this.micEnabled = enabled;
      if (!enabled && this.audioAnalyzer) {
        this.audioAnalyzer.destroy();
        this.audioAnalyzer = null;
      } else if (enabled && !this.audioAnalyzer && this.active && window.VJamFX && window.VJamFX.AudioAnalyzer) {
        this.audioAnalyzer = new window.VJamFX.AudioAnalyzer();
        this.audioAnalyzer.start();
      }
    }

    // --- CSS Filters ---

    setFilter(name, enabled) {
      if (!FILTER_VALUES[name]) return;
      if (enabled) {
        this.activeFilters.add(name);
      } else {
        this.activeFilters.delete(name);
      }
      this._applyFilters();
    }

    toggleFilter(name) {
      if (!FILTER_VALUES[name]) return;
      if (this.activeFilters.has(name)) {
        this.activeFilters.delete(name);
      } else {
        this.activeFilters.add(name);
      }
      this._applyFilters();
    }

    clearFilters() {
      this.activeFilters.clear();
      this._applyFilters();
    }

    _applyFilters() {
      if (!this.overlay) return;
      const css = [...this.activeFilters].map(f => FILTER_VALUES[f]).filter(Boolean).join(' ') || 'none';
      this.overlay.style.filter = css;
    }

    /**
     * Kill all layers but keep engine alive (quick reset)
     */
    kill() {
      // Immediately destroy all layers (no fade)
      for (const [, layer] of this.activeLayers) {
        layer.preset.destroy();
        layer.container.remove();
      }
      this.activeLayers.clear();
      this.currentPreset = null;
      this.currentPresetName = null;
      this.clearFilters();
      this.setBlendMode('screen');
      this._stopAutoCycle();
    }

    /**
     * Randomize blend mode + filters
     */
    randomizeFX() {
      // Random blend mode
      const mode = VALID_BLEND_MODES[Math.floor(Math.random() * VALID_BLEND_MODES.length)];
      this.setBlendMode(mode);

      // Random filters (each 30% chance)
      this.activeFilters.clear();
      const filterNames = Object.keys(FILTER_VALUES);
      for (let i = 0; i < filterNames.length; i++) {
        if (Math.random() < 0.3) {
          this.activeFilters.add(filterNames[i]);
        }
      }
      this._applyFilters();
    }

    // --- Auto-Cycle ---

    startAutoCycle(presetNames, intervalMs) {
      this._stopAutoCycle();
      if (!presetNames || presetNames.length === 0) return;

      this._autoCyclePresets = presetNames;
      this._autoCycleInterval = intervalMs || 8000;
      this._autoCycleTimer = setInterval(() => {
        this._autoCycleTick();
      }, this._autoCycleInterval);
      // Immediate first tick
      this._autoCycleTick();
    }

    _autoCycleTick() {
      const presets = this._autoCyclePresets;
      if (!presets || presets.length === 0) return;

      // Choose 1-3 random layers
      const count = 1 + Math.floor(Math.random() * Math.min(3, presets.length));
      const shuffled = presets.slice().sort(() => Math.random() - 0.5);
      const chosen = shuffled.slice(0, count);

      // Remove layers not in chosen set
      for (const name of this.activeLayers.keys()) {
        if (!chosen.includes(name)) {
          this._removeLayer(name);
        }
      }

      // Add missing layers
      for (const name of chosen) {
        if (!this.activeLayers.has(name)) {
          this._addLayer(name);
        }
      }

      // Randomly change blend + filters
      this.randomizeFX();
    }

    _stopAutoCycle() {
      if (this._autoCycleTimer) {
        clearInterval(this._autoCycleTimer);
        this._autoCycleTimer = null;
      }
    }

    getActiveLayerNames() {
      return [...this.activeLayers.keys()];
    }

    handleMessage(msg) {
      switch (msg.action) {
        case 'start':
          if (msg.blendMode) this.setBlendMode(msg.blendMode);
          if (msg.mic !== undefined) this.micEnabled = msg.mic;
          this.startPreset(msg.preset);
          break;
        case 'stop':
          this.destroy();
          break;
        case 'switchPreset':
          this.startPreset(msg.preset);
          break;
        case 'setBlendMode':
          this.setBlendMode(msg.blendMode);
          break;
        case 'setMic':
          this.setMic(msg.enabled);
          break;
        case 'addLayer':
          if (!this.activeLayers.has(msg.preset)) {
            this._addLayer(msg.preset);
          }
          break;
        case 'removeLayer':
          this._removeLayer(msg.preset);
          break;
        case 'toggleLayer':
          this.toggleLayer(msg.preset);
          break;
        case 'setFilter':
          this.setFilter(msg.filter, msg.enabled);
          break;
        case 'toggleFilter':
          this.toggleFilter(msg.filter);
          break;
        case 'clearFilters':
          this.clearFilters();
          break;
        case 'kill':
          this.kill();
          break;
        case 'randomizeFX':
          this.randomizeFX();
          break;
        case 'startAutoCycle':
          this.startAutoCycle(msg.presets, msg.interval);
          break;
        case 'stopAutoCycle':
          this._stopAutoCycle();
          break;
      }
    }
  }

  window._vjamFxEngine = new VJamFXEngine();
  window.VJamFXEngine = VJamFXEngine;
})();
