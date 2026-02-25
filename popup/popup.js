/**
 * VJam FX — Popup Controller
 * Communicates with MAIN world engine via chrome.scripting.executeScript
 * Syncs state with Service Worker for navigation persistence
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
    this.selectedBlendMode = 'screen';
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

    // Restore state from Service Worker first, then check page
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

    // First check Service Worker state (persists across navigations)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'getState',
        tabId: this._tabId,
      });
      if (response && response.state && response.state.active) {
        this.isActive = true;
        this.selectedPreset = response.state.preset || 'neon-tunnel';
        this.selectedBlendMode = response.state.blendMode || 'screen';
        this.micEnabled = response.state.micEnabled !== false;
        this._updateUI();
        return;
      }
    } catch (e) {
      // Service Worker not available — fall back to page check
    }

    // Fall back: check if engine is running on page
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
        this.selectedBlendMode = result.blendMode || 'screen';
        this._updateUI();
      }
    } catch (e) {
      // Tab might not allow scripting
    }
  }

  _updateUI() {
    const toggle = document.getElementById('toggle');
    if (toggle) toggle.checked = this.isActive;

    const radio = document.querySelector(`input[value="${this.selectedPreset}"]`);
    if (radio) radio.checked = true;

    const blendSelect = document.getElementById('blend-mode');
    if (blendSelect) blendSelect.value = this.selectedBlendMode;

    const micBtn = document.getElementById('mic-toggle');
    if (micBtn) {
      micBtn.textContent = this.micEnabled ? 'ON' : 'OFF';
      micBtn.classList.toggle('on', this.micEnabled);
    }
  }

  /**
   * Save current state to Service Worker for navigation persistence
   */
  async _saveState() {
    if (!this._tabId) return;
    try {
      await chrome.runtime.sendMessage({
        type: this.isActive ? 'setState' : 'clearState',
        tabId: this._tabId,
        state: {
          active: this.isActive,
          preset: this.selectedPreset,
          blendMode: this.selectedBlendMode,
          micEnabled: this.micEnabled,
        },
      });
    } catch (e) {
      // Service Worker not available
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
        this.selectedBlendMode = e.target.value;
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
          this._saveState();
        }
      });
    }
  }

  async toggleEffect(on) {
    if (!this._tabId) return;

    if (on) {
      try {
        this.isActive = true;

        // Inject all scripts into MAIN world (CSP-safe, no dynamic import)
        // Order: p5.js → base-preset → audio-analyzer → selected preset → engine
        const presetFile = `content/presets/${this.selectedPreset}.js`;
        const scripts = [
          'lib/p5.min.js',
          'content/base-preset.js',
          'content/audio-analyzer.js',
          presetFile,
          'content/content.js',
        ];

        for (const file of scripts) {
          await chrome.scripting.executeScript({
            target: { tabId: this._tabId },
            world: 'MAIN',
            files: [file],
          });
        }

        // Send start command
        this.selectedBlendMode = document.getElementById('blend-mode')?.value || 'screen';
        await this._sendCommand({
          action: 'start',
          preset: this.selectedPreset,
          blendMode: this.selectedBlendMode,
          mic: this.micEnabled,
        });

        // Persist state to Service Worker
        await this._saveState();
      } catch (e) {
        this.isActive = false;
        const toggle = document.getElementById('toggle');
        if (toggle) toggle.checked = false;
        console.warn('VJam FX: Failed to inject', e);
      }
    } else {
      await this._sendCommand({ action: 'stop' });
      this.isActive = false;
      await this._saveState();
    }
  }

  async switchPreset(presetName) {
    this.selectedPreset = presetName;
    // Inject the preset file if not already loaded
    try {
      await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        files: [`content/presets/${presetName}.js`],
      });
    } catch (e) {
      // Already injected or failed — engine will use cached
    }
    await this._sendCommand({ action: 'switchPreset', preset: presetName });
    await this._saveState();
  }

  async changeBlendMode(mode) {
    if (!this.validBlendModes.includes(mode)) return;
    this.selectedBlendMode = mode;
    await this._sendCommand({ action: 'setBlendMode', blendMode: mode });
    await this._saveState();
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
