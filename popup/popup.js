/**
 * VJam FX — Popup Controller
 * Communicates with MAIN world engine via chrome.scripting.executeScript
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
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      this._tabId = tabs[0].id;
      this._tabUrl = tabs[0].url || '';
    }

    // Check if current page supports injection
    if (this._isRestrictedPage()) {
      this._showError('Cannot run on this page');
      return;
    }

    // Check if engine is already active on this tab
    await this._syncState();

    this._bindEvents();
  }

  _isRestrictedPage() {
    const url = this._tabUrl;
    return !url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')
      || url.startsWith('edge://') || url.startsWith('about:') || url.startsWith('devtools://');
  }

  _showError(msg) {
    const popup = document.querySelector('.popup');
    if (popup) {
      popup.innerHTML = `<div style="padding:20px;text-align:center;color:#888">${msg}</div>`;
    }
  }

  async _syncState() {
    if (!this._tabId) return;
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        func: () => {
          if (!window._vjamFxEngine) return null;
          return {
            active: window._vjamFxEngine.active,
            preset: window._vjamFxEngine.currentPresetName,
            blendMode: window._vjamFxEngine.blendMode,
          };
        },
      });
      if (result && result.active) {
        this.isActive = true;
        this.selectedPreset = result.preset || 'neon-tunnel';
        // Update UI
        const toggle = document.getElementById('toggle');
        if (toggle) toggle.checked = true;
        const radio = document.querySelector(`input[value="${this.selectedPreset}"]`);
        if (radio) radio.checked = true;
        const blendSelect = document.getElementById('blend-mode');
        if (blendSelect) blendSelect.value = result.blendMode || 'screen';
      }
    } catch (e) {
      // Tab might not allow scripting (chrome:// pages etc.)
    }
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
          this._sendCommand({ action: 'setMic', enabled: this.micEnabled });
        }
      });
    }
  }

  async toggleEffect(on) {
    if (!this._tabId) return;

    if (on) {
      try {
      this.isActive = true;

      // Step 1: Inject p5.js into MAIN world (classic script)
      await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        files: ['lib/p5.min.js'],
      });

      // Step 2: Import content.js as ESM module in MAIN world
      const engineUrl = chrome.runtime.getURL('content/content.js');
      await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        func: (url) => {
          if (window._vjamFxEngine) return;
          return import(url);
        },
        args: [engineUrl],
      });

      // Step 3: Send start command
      const blendMode = document.getElementById('blend-mode')?.value || 'screen';
      await this._sendCommand({
        action: 'start',
        preset: this.selectedPreset,
        blendMode: blendMode,
        mic: this.micEnabled,
      });
      } catch (e) {
        this.isActive = false;
        const toggle = document.getElementById('toggle');
        if (toggle) toggle.checked = false;
        console.warn('VJam FX: Failed to inject', e);
      }
    } else {
      await this._sendCommand({ action: 'stop' });
      this.isActive = false;
    }
  }

  async switchPreset(presetName) {
    this.selectedPreset = presetName;
    await this._sendCommand({ action: 'switchPreset', preset: presetName });
  }

  async changeBlendMode(mode) {
    if (!this.validBlendModes.includes(mode)) return;
    await this._sendCommand({ action: 'setBlendMode', blendMode: mode });
  }

  async _sendCommand(msg) {
    if (!this._tabId) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        func: (message) => {
          if (window._vjamFxEngine) {
            window._vjamFxEngine.handleMessage(message);
          }
        },
        args: [msg],
      });
    } catch (e) {
      console.warn('VJam FX: Failed to send command', e);
    }
  }
}

export { PopupController };

// Auto-init in popup context
if (typeof document !== 'undefined' && document.getElementById) {
  document.addEventListener('DOMContentLoaded', () => {
    const controller = new PopupController();
    controller.init();
  });
}
