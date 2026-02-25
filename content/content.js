/**
 * VJam FX — Content Script Engine
 * Injected into web pages to overlay VJ effects
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
    this._presetModules = {};
  }

  createOverlay() {
    if (this.overlay) return this.overlay;

    const overlay = document.createElement('div');
    overlay.setAttribute('data-vjam-fx', 'overlay');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483647;
      pointer-events: none;
      mix-blend-mode: ${this.blendMode};
    `.replace(/\s+/g, ' ').trim();

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
    // Create overlay if needed
    this.createOverlay();

    // Stop existing preset
    if (this.currentPreset) {
      this.currentPreset.destroy();
      this.currentPreset = null;
    }

    this.currentPresetName = presetName;
    this.active = true;

    // Load preset module
    try {
      const PresetClass = await this._loadPreset(presetName);
      if (PresetClass) {
        this.currentPreset = new PresetClass();
        this.currentPreset.setup(this.overlay);
      }
    } catch (e) {
      console.warn('VJam FX: Failed to load preset', presetName, e);
    }

    // Start audio if mic enabled
    if (this.micEnabled && !this.audioAnalyzer) {
      try {
        const { AudioAnalyzer } = await this._importModule('../content/audio-analyzer.js');
        this.audioAnalyzer = new AudioAnalyzer();
        await this.audioAnalyzer.start();
      } catch (e) {
        console.warn('VJam FX: Audio analyzer unavailable', e);
      }
    }

    // Start render loop
    this._startLoop();
  }

  async _loadPreset(presetName) {
    const className = PRESET_MAP[presetName];
    if (!className) return null;

    // Try dynamic import
    try {
      const mod = await this._importModule(`../content/presets/${presetName}.js`);
      return mod[className];
    } catch (e) {
      console.warn('VJam FX: Preset import failed', presetName, e);
      return null;
    }
  }

  async _importModule(path) {
    // In Chrome extension context, use chrome.runtime.getURL for module URLs
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      const url = chrome.runtime.getURL(path.replace('../', ''));
      return import(url);
    }
    // In test environment, import directly
    return import(path);
  }

  _startLoop() {
    if (this._rafId) return;

    const loop = () => {
      if (!this.active) {
        this._rafId = null;
        return;
      }

      // Get audio data
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
        this.startPreset(msg.preset);
        break;
      case 'stop':
        this.stop();
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

// Auto-initialize when loaded as content script
if (typeof window !== 'undefined' && !window._vjamFxEngine) {
  window._vjamFxEngine = new VJamFXEngine();

  // Listen for messages from popup
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.action) {
        window._vjamFxEngine.handleMessage(msg);
        sendResponse({ ok: true });
      }
    });
  }
}
