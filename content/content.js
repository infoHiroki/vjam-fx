/**
 * VJam FX — Content Script Engine
 * Injected into page's MAIN world via chrome.scripting.executeScript
 * Uses IIFE pattern (no ESM) for CSP compatibility
 */
(function() {
  'use strict';

  // Guard against double-injection
  if (window._vjamFxEngine) return;

  const VALID_BLEND_MODES = ['screen', 'lighten', 'difference', 'exclusion'];

  const PRESET_MAP = {
    'neon-tunnel': 'NeonTunnelPreset',
    'kaleidoscope': 'KaleidoscopePreset',
    'mandala': 'MandalaPreset',
    'sine-waves': 'SineWavesPreset',
    'gradient-sweep': 'GradientSweepPreset',
    'moire': 'MoirePreset',
    'hypnotic': 'HypnoticPreset',
    'starfield': 'StarfieldPreset',
    'rain': 'RainPreset',
    'barcode': 'BarcodePreset',
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
      }
    }

    startPreset(presetName) {
      this.createOverlay();

      if (this.currentPreset) {
        this.currentPreset.destroy();
        this.currentPreset = null;
      }

      this.currentPresetName = presetName;
      this.active = true;

      // Load preset from global registry
      const className = PRESET_MAP[presetName];
      if (className && window.VJamFX && window.VJamFX.presets[presetName]) {
        const PresetClass = window.VJamFX.presets[presetName];
        this.currentPreset = new PresetClass();
        this.currentPreset.setup(this.overlay);
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

        if (self.audioAnalyzer && self.audioAnalyzer.started) {
          const audioData = self.audioAnalyzer.getAudioData();
          if (self.currentPreset) {
            self.currentPreset.updateAudio(audioData);
            if (audioData.beat) {
              self.currentPreset.onBeat(audioData.strength);
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

      if (this.currentPreset) {
        this.currentPreset.destroy();
        this.currentPreset = null;
      }

      this.currentPresetName = null;
    }

    destroy() {
      this.stop();

      if (this.audioAnalyzer) {
        this.audioAnalyzer.destroy();
        this.audioAnalyzer = null;
      }

      if (this.overlay) {
        this.overlay.remove();
        this.overlay = null;
      }
    }

    setMic(enabled) {
      this.micEnabled = enabled;
      if (!enabled && this.audioAnalyzer) {
        this.audioAnalyzer.destroy();
        this.audioAnalyzer = null;
      }
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
      }
    }
  }

  window._vjamFxEngine = new VJamFXEngine();
  // Also expose class for testing
  window.VJamFXEngine = VJamFXEngine;
})();
