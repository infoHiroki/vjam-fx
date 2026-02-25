/**
 * VJam FX — Content Script Engine
 * Loaded as ESM module in page's MAIN world via dynamic import()
 */

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

// Resolve base URL from module location (chrome-extension://id/content/)
const BASE_URL = typeof import.meta !== 'undefined' && import.meta.url
  ? new URL('.', import.meta.url).href
  : '';

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

  async startPreset(presetName) {
    this.createOverlay();

    // Stop existing preset
    if (this.currentPreset) {
      this.currentPreset.destroy();
      this.currentPreset = null;
    }

    this.currentPresetName = presetName;
    this.active = true;

    // Load preset module via ESM dynamic import
    try {
      const className = PRESET_MAP[presetName];
      if (className) {
        const mod = await import(`${BASE_URL}presets/${presetName}.js`);
        const PresetClass = mod[className];
        if (PresetClass) {
          this.currentPreset = new PresetClass();
          this.currentPreset.setup(this.overlay);
        }
      }
    } catch (e) {
      console.warn('VJam FX: Failed to load preset', presetName, e);
    }

    // Start audio if mic enabled
    if (this.micEnabled && !this.audioAnalyzer) {
      try {
        const { AudioAnalyzer } = await import(`${BASE_URL}audio-analyzer.js`);
        this.audioAnalyzer = new AudioAnalyzer();
        await this.audioAnalyzer.start();
      } catch (e) {
        console.warn('VJam FX: Audio analyzer unavailable', e);
      }
    }

    this._startLoop();
  }

  _startLoop() {
    if (this._rafId) return;

    const loop = () => {
      if (!this.active) {
        this._rafId = null;
        return;
      }

      if (this.audioAnalyzer && this.audioAnalyzer.started) {
        const audioData = this.audioAnalyzer.getAudioData();
        if (this.currentPreset) {
          this.currentPreset.updateAudio(audioData);
          if (audioData.beat) {
            this.currentPreset.onBeat(audioData.strength);
          }
        }
      }

      this._rafId = requestAnimationFrame(loop);
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

export { VJamFXEngine };

// Auto-initialize when loaded in MAIN world
if (typeof window !== 'undefined' && !window._vjamFxEngine) {
  window._vjamFxEngine = new VJamFXEngine();
}
