/**
 * VJam FX — Popup Controller
 */

class PopupController {
  constructor() {
    this.presets = [
      { id: 'neon-tunnel', name: 'Neon Tunnel' },
      { id: 'kaleidoscope', name: 'Kaleidoscope' },
      { id: 'mandala', name: 'Mandala' },
      { id: 'sine-waves', name: 'Sine Waves' },
      { id: 'gradient-sweep', name: 'Gradient Sweep' },
      { id: 'moire', name: 'Moire' },
      { id: 'hypnotic', name: 'Hypnotic' },
      { id: 'starfield', name: 'Starfield' },
      { id: 'rain', name: 'Rain' },
      { id: 'barcode', name: 'Barcode' },
    ];

    this.validBlendModes = ['screen', 'lighten', 'difference', 'exclusion'];
    this.selectedPreset = 'neon-tunnel';
    this.isActive = false;
    this.micEnabled = true;
    this._tabId = null;
  }

  async init() {
    // Get current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      this._tabId = tabs[0].id;
    }

    // Bind DOM events
    this._bindEvents();
  }

  _bindEvents() {
    const toggle = document.getElementById('toggle');
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        this.toggleEffect(e.target.checked);
      });
    }

    const presetRadios = document.querySelectorAll('input[name="preset"]');
    for (const radio of presetRadios) {
      radio.addEventListener('change', (e) => {
        this.selectedPreset = e.target.value;
        if (this.isActive) {
          this.switchPreset(e.target.value);
        }
      });
    }

    const blendSelect = document.getElementById('blend-mode');
    if (blendSelect) {
      blendSelect.addEventListener('change', (e) => {
        if (this.isActive) {
          this.changeBlendMode(e.target.value);
        }
      });
    }

    const micBtn = document.getElementById('mic-toggle');
    if (micBtn) {
      micBtn.addEventListener('click', () => {
        this.micEnabled = !this.micEnabled;
        micBtn.textContent = this.micEnabled ? 'ON' : 'OFF';
        micBtn.classList.toggle('on', this.micEnabled);
        if (this.isActive) {
          this._sendMessage({ action: 'setMic', enabled: this.micEnabled });
        }
      });
    }
  }

  async toggleEffect(on) {
    if (on) {
      this.isActive = true;
      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        files: ['content/content.js'],
      });
      // Send start message
      await this._sendMessage({
        action: 'start',
        preset: this.selectedPreset,
        blendMode: document.getElementById('blend-mode')?.value || 'screen',
        mic: this.micEnabled,
      });
    } else {
      await this._sendMessage({ action: 'stop' });
      this.isActive = false;
    }
  }

  async switchPreset(presetName) {
    this.selectedPreset = presetName;
    await this._sendMessage({ action: 'switchPreset', preset: presetName });
  }

  async changeBlendMode(mode) {
    if (!this.validBlendModes.includes(mode)) return;
    await this._sendMessage({ action: 'setBlendMode', blendMode: mode });
  }

  async _sendMessage(msg) {
    if (!this._tabId) return;
    try {
      await chrome.tabs.sendMessage(this._tabId, msg);
    } catch (e) {
      console.warn('VJam FX: Failed to send message', e);
    }
  }
}

// ESM export for tests
if (typeof module !== 'undefined' || typeof exports !== 'undefined') {
  // CommonJS
} else if (typeof window !== 'undefined') {
  // Browser popup context - auto-init
  document.addEventListener('DOMContentLoaded', () => {
    const controller = new PopupController();
    controller.init();
  });
}

// Named export for vitest
export { PopupController };
