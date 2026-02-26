/**
 * VJam FX — Popup Controller
 * Multi-layer presets, CSS filters, blend modes
 * Syncs state with Service Worker for navigation persistence
 */

const PRESET_CATEGORIES = [
  { label: 'Tunnels & Zoom', presets: [
    { id: 'neon-tunnel', name: 'Neon Tunnel' },
    { id: 'laser-tunnel', name: 'Laser Tunnel' },
    { id: 'infinite-zoom', name: 'Infinite Zoom' },
    { id: 'hypnotic', name: 'Hypnotic' },
  ]},
  { label: 'Patterns', presets: [
    { id: 'kaleidoscope', name: 'Kaleidoscope' },
    { id: 'mandala', name: 'Mandala' },
    { id: 'sacred-geometry', name: 'Sacred Geometry' },
    { id: 'moire', name: 'Moire' },
    { id: 'prism', name: 'Prism' },
    { id: 'barcode', name: 'Barcode' },
  ]},
  { label: 'Organic', presets: [
    { id: 'cellular', name: 'Cellular' },
    { id: 'liquid', name: 'Liquid' },
    { id: 'voronoi', name: 'Voronoi' },
    { id: 'smoke', name: 'Smoke' },
    { id: 'oil-spill', name: 'Oil Spill' },
    { id: 'coral-reef', name: 'Coral Reef' },
    { id: 'flow-field', name: 'Flow Field' },
    { id: 'ant-colony', name: 'Ant Colony' },
  ]},
  { label: 'Grid & Tech', presets: [
    { id: 'glitch-grid', name: 'Glitch Grid' },
    { id: 'hexgrid-pulse', name: 'Hexgrid Pulse' },
    { id: 'grid-warp', name: 'Grid Warp' },
    { id: 'circuit-board', name: 'Circuit Board' },
    { id: 'crt-monitor', name: 'CRT Monitor' },
    { id: 'retro-terminal', name: 'Retro Terminal' },
  ]},
  { label: 'Space & Nature', presets: [
    { id: 'starfield', name: 'Starfield' },
    { id: 'constellation', name: 'Constellation' },
    { id: 'bokeh', name: 'Bokeh' },
    { id: 'terrain', name: 'Terrain' },
    { id: 'fractal-tree', name: 'Fractal Tree' },
    { id: 'snowfall', name: 'Snowfall' },
  ]},
  { label: 'Audio Reactive', presets: [
    { id: 'frequency-rings', name: 'Frequency Rings' },
    { id: 'equalizer', name: 'Equalizer' },
    { id: 'sine-waves', name: 'Sine Waves' },
    { id: 'gradient-sweep', name: 'Gradient Sweep' },
    { id: 'wireframe-sphere', name: 'Wireframe Sphere' },
  ]},
  { label: 'Weather', presets: [
    { id: 'rain', name: 'Rain' },
    { id: 'neon-rain', name: 'Neon Rain' },
    { id: 'cyber-rain-heavy', name: 'Cyber Rain' },
  ]},
];

// Flat list for compatibility
const ALL_PRESETS = PRESET_CATEGORIES.flatMap(c => c.presets);

const FILTER_NAMES = ['invert', 'hue-rotate', 'grayscale', 'saturate', 'brightness', 'contrast', 'sepia', 'blur'];
const VALID_BLEND_MODES = ['screen', 'lighten', 'difference', 'exclusion'];

class PopupController {
  constructor() {
    this.presets = ALL_PRESETS;
    this.validBlendModes = VALID_BLEND_MODES;
    this.activeLayers = new Set();  // preset IDs currently active
    this.activeFilters = new Set();
    this.selectedBlendMode = 'screen';
    this.isActive = false;
    this.micEnabled = true;
    this.autoCycleActive = false;
    this._tabId = null;
    this._injectedPresets = new Set(); // track which preset files have been injected
    this._coreInjected = false;
    this._currentIndex = 0; // for prev/next navigation
  }

  async init() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      this._tabId = tabs[0].id;
      this._tabUrl = tabs[0].url || '';
    }

    if (this._isRestrictedPage()) {
      this._showError('Cannot run on this page');
      return;
    }

    this._buildPresetList();
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

  /**
   * Build checkbox list of presets dynamically
   */
  _buildPresetList() {
    const list = document.getElementById('preset-list');
    if (!list) return;
    list.innerHTML = '';
    for (const cat of PRESET_CATEGORIES) {
      const header = document.createElement('div');
      header.className = 'category-header';
      header.textContent = cat.label;
      list.appendChild(header);
      for (const p of cat.presets) {
        const label = document.createElement('label');
        label.className = 'preset-item';
        label.innerHTML = `<input type="checkbox" name="preset" value="${p.id}"><span>${p.name}</span>`;
        list.appendChild(label);
      }
    }
  }

  async _syncState() {
    if (!this._tabId) return;

    // Check Service Worker state first
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'getState',
        tabId: this._tabId,
      });
      if (response && response.state && response.state.active) {
        this.isActive = true;
        this.selectedBlendMode = response.state.blendMode || 'screen';
        this.micEnabled = response.state.micEnabled !== false;
        if (response.state.layers) {
          for (const id of response.state.layers) this.activeLayers.add(id);
        } else if (response.state.preset) {
          this.activeLayers.add(response.state.preset);
        }
        if (response.state.filters) {
          for (const f of response.state.filters) this.activeFilters.add(f);
        }
        this._updateUI();
        return;
      }
    } catch (e) { /* SW not available */ }

    // Fallback: check page engine
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        func: () => {
          if (!window._vjamFxEngine) return null;
          return {
            active: window._vjamFxEngine.active,
            layers: window._vjamFxEngine.getActiveLayerNames(),
            blendMode: window._vjamFxEngine.blendMode,
            filters: [...window._vjamFxEngine.activeFilters],
          };
        },
      });
      if (result && result.active) {
        this.isActive = true;
        this.selectedBlendMode = result.blendMode || 'screen';
        if (result.layers) {
          for (const id of result.layers) this.activeLayers.add(id);
        }
        if (result.filters) {
          for (const f of result.filters) this.activeFilters.add(f);
        }
        this._updateUI();
      }
    } catch (e) { /* scripting failed */ }
  }

  _updateUI() {
    const toggle = document.getElementById('toggle');
    if (toggle) toggle.checked = this.isActive;

    // Check active layers
    for (const id of this.activeLayers) {
      const cb = document.querySelector(`input[value="${id}"]`);
      if (cb) cb.checked = true;
    }

    const blendSelect = document.getElementById('blend-mode');
    if (blendSelect) blendSelect.value = this.selectedBlendMode;

    const micBtn = document.getElementById('mic-toggle');
    if (micBtn) {
      micBtn.textContent = this.micEnabled ? 'ON' : 'OFF';
      micBtn.classList.toggle('on', this.micEnabled);
    }

    // Update filter buttons
    for (const f of this.activeFilters) {
      const btn = document.querySelector(`.filter-btn[data-filter="${f}"]`);
      if (btn) btn.classList.add('active');
    }
  }

  async _saveState() {
    if (!this._tabId) return;
    try {
      await chrome.runtime.sendMessage({
        type: this.isActive ? 'setState' : 'clearState',
        tabId: this._tabId,
        state: {
          active: this.isActive,
          layers: [...this.activeLayers],
          blendMode: this.selectedBlendMode,
          micEnabled: this.micEnabled,
          filters: [...this.activeFilters],
          autoCyclePresets: this.autoCycleActive ? this.presets.map(p => p.id) : null,
        },
      });
    } catch (e) { /* SW not available */ }
  }

  _bindEvents() {
    // Master toggle
    const toggle = document.getElementById('toggle');
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          this._startAll();
        } else {
          this._stopAll();
        }
      });
    }

    // Preset checkboxes — toggle layers
    const list = document.getElementById('preset-list');
    if (list) {
      list.addEventListener('change', (e) => {
        if (e.target.type !== 'checkbox') return;
        const presetId = e.target.value;
        if (e.target.checked) {
          this.activeLayers.add(presetId);
          if (this.isActive) {
            this._addLayer(presetId);
          }
        } else {
          this.activeLayers.delete(presetId);
          if (this.isActive) {
            this._removeLayer(presetId);
          }
        }
        // Stop auto-cycle on manual preset change
        if (this.autoCycleActive) {
          this.autoCycleActive = false;
          const autoBtn = document.getElementById('btn-auto-cycle');
          if (autoBtn) autoBtn.classList.remove('active');
          this._sendCommand({ action: 'stopAutoCycle' });
        }
        this._saveState();
      });
    }

    // Blend mode
    const blendSelect = document.getElementById('blend-mode');
    if (blendSelect) {
      blendSelect.addEventListener('change', (e) => {
        this.selectedBlendMode = e.target.value;
        if (this.isActive) {
          this._sendCommand({ action: 'setBlendMode', blendMode: e.target.value });
        }
        this._saveState();
      });
    }

    // Mic toggle
    const micBtn = document.getElementById('mic-toggle');
    if (micBtn) {
      micBtn.addEventListener('click', () => {
        this.micEnabled = !this.micEnabled;
        micBtn.textContent = this.micEnabled ? 'ON' : 'OFF';
        micBtn.classList.toggle('on', this.micEnabled);
        if (this.isActive) {
          this._sendCommand({ action: 'setMic', enabled: this.micEnabled });
        }
        this._saveState();
      });
    }

    // Prev/Next
    const btnPrev = document.getElementById('btn-prev');
    if (btnPrev) btnPrev.addEventListener('click', () => this._navigate(-1));
    const btnNext = document.getElementById('btn-next');
    if (btnNext) btnNext.addEventListener('click', () => this._navigate(1));

    // Kill
    const btnKill = document.getElementById('btn-kill');
    if (btnKill) {
      btnKill.addEventListener('click', async () => {
        await this._sendCommand({ action: 'kill' });
        this.activeLayers.clear();
        this.activeFilters.clear();
        this.autoCycleActive = false;
        this.selectedBlendMode = 'screen';
        // Uncheck all
        document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        const blendSelect = document.getElementById('blend-mode');
        if (blendSelect) blendSelect.value = 'screen';
        const autoBtn = document.getElementById('btn-auto-cycle');
        if (autoBtn) autoBtn.classList.remove('active');
        this._saveState();
      });
    }

    // Randomize FX
    const btnRandomFX = document.getElementById('btn-random-fx');
    if (btnRandomFX) {
      btnRandomFX.addEventListener('click', async () => {
        if (!this.isActive) return;
        await this._sendCommand({ action: 'randomizeFX' });
        // Sync back state from engine
        this._syncFXState();
      });
    }

    // Auto-cycle
    const btnAutoCycle = document.getElementById('btn-auto-cycle');
    if (btnAutoCycle) {
      btnAutoCycle.addEventListener('click', async () => {
        this.autoCycleActive = !this.autoCycleActive;
        btnAutoCycle.classList.toggle('active', this.autoCycleActive);
        if (this.autoCycleActive) {
          if (!this.isActive) {
            // Auto-start with all presets available
            const toggle = document.getElementById('toggle');
            if (toggle) toggle.checked = true;
            await this._startAll();
          }
          // Inject all presets for auto-cycle
          for (const p of this.presets) {
            await this._injectPreset(p.id);
          }
          const allIds = this.presets.map(p => p.id);
          await this._sendCommand({ action: 'startAutoCycle', presets: allIds, interval: 8000 });
        } else {
          await this._sendCommand({ action: 'stopAutoCycle' });
        }
      });
    }

    // Filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    for (const btn of filterBtns) {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        btn.classList.toggle('active');
        if (this.activeFilters.has(filter)) {
          this.activeFilters.delete(filter);
        } else {
          this.activeFilters.add(filter);
        }
        if (this.isActive) {
          this._sendCommand({ action: 'toggleFilter', filter: filter });
        }
        this._saveState();
      });
    }
  }

  /**
   * Inject core scripts (p5, base-preset, audio-analyzer, engine)
   */
  async _injectCore() {
    if (this._coreInjected) return;
    const coreScripts = [
      'lib/p5.min.js',
      'content/base-preset.js',
      'content/audio-analyzer.js',
      'content/content.js',
    ];
    for (const file of coreScripts) {
      await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        files: [file],
      });
    }
    this._coreInjected = true;
  }

  /**
   * Inject a preset file if not already injected
   */
  async _injectPreset(presetId) {
    if (this._injectedPresets.has(presetId)) return;
    await chrome.scripting.executeScript({
      target: { tabId: this._tabId },
      world: 'MAIN',
      files: [`content/presets/${presetId}.js`],
    });
    this._injectedPresets.add(presetId);
  }

  /**
   * Start all selected layers
   */
  async _startAll() {
    if (!this._tabId) return;

    // Need at least one preset selected
    if (this.activeLayers.size === 0) {
      // Default to first preset
      this.activeLayers.add('neon-tunnel');
      const cb = document.querySelector('input[value="neon-tunnel"]');
      if (cb) cb.checked = true;
    }

    try {
      this.isActive = true;

      await this._injectCore();

      // Inject and start each layer
      const layers = [...this.activeLayers];
      for (const presetId of layers) {
        await this._injectPreset(presetId);
      }

      // Start first layer with full config, add rest as layers
      const first = layers[0];
      await this._sendCommand({
        action: 'start',
        preset: first,
        blendMode: this.selectedBlendMode,
        mic: this.micEnabled,
      });

      // Add remaining layers
      for (let i = 1; i < layers.length; i++) {
        await this._sendCommand({ action: 'addLayer', preset: layers[i] });
      }

      // Restore filters
      for (const f of this.activeFilters) {
        await this._sendCommand({ action: 'setFilter', filter: f, enabled: true });
      }

      await this._saveState();
    } catch (e) {
      this.isActive = false;
      this._coreInjected = false;
      const toggle = document.getElementById('toggle');
      if (toggle) toggle.checked = false;
      console.warn('VJam FX: Failed to inject', e);
    }
  }

  async _stopAll() {
    await this._sendCommand({ action: 'stop' });
    this.isActive = false;
    this._coreInjected = false;
    this._injectedPresets.clear();
    await this._saveState();
  }

  async _addLayer(presetId) {
    try {
      await this._injectCore();
      await this._injectPreset(presetId);
      await this._sendCommand({ action: 'addLayer', preset: presetId });
      this._saveState();
    } catch (e) {
      console.warn('VJam FX: Failed to add layer', e);
    }
  }

  async _removeLayer(presetId) {
    await this._sendCommand({ action: 'removeLayer', preset: presetId });
    this._saveState();
  }

  /**
   * Navigate prev/next through preset list (single-layer mode)
   */
  async _navigate(direction) {
    this._currentIndex = (this._currentIndex + direction + this.presets.length) % this.presets.length;
    const preset = this.presets[this._currentIndex];

    // Clear all checkboxes, check only the navigated one
    document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    const cb = document.querySelector(`input[value="${preset.id}"]`);
    if (cb) cb.checked = true;

    // Kill current layers, start this one
    this.activeLayers.clear();
    this.activeLayers.add(preset.id);

    if (this.isActive) {
      await this._sendCommand({ action: 'kill' });
      await this._injectPreset(preset.id);
      await this._sendCommand({ action: 'start', preset: preset.id, blendMode: this.selectedBlendMode, mic: this.micEnabled });
      // Restore filters
      for (const f of this.activeFilters) {
        await this._sendCommand({ action: 'setFilter', filter: f, enabled: true });
      }
    } else {
      // Auto-start
      const toggle = document.getElementById('toggle');
      if (toggle) toggle.checked = true;
      await this._startAll();
    }

    // Stop auto-cycle when manually navigating
    this.autoCycleActive = false;
    const autoBtn = document.getElementById('btn-auto-cycle');
    if (autoBtn) autoBtn.classList.remove('active');
    await this._sendCommand({ action: 'stopAutoCycle' });

    this._saveState();
  }

  /**
   * Sync blend mode and filter state back from engine after randomize
   */
  async _syncFXState() {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        func: () => {
          if (!window._vjamFxEngine) return null;
          return {
            blendMode: window._vjamFxEngine.blendMode,
            filters: [...window._vjamFxEngine.activeFilters],
          };
        },
      });
      if (result) {
        this.selectedBlendMode = result.blendMode;
        this.activeFilters.clear();
        for (const f of result.filters) this.activeFilters.add(f);

        // Update UI
        const blendSelect = document.getElementById('blend-mode');
        if (blendSelect) blendSelect.value = result.blendMode;
        document.querySelectorAll('.filter-btn').forEach(btn => {
          btn.classList.toggle('active', this.activeFilters.has(btn.dataset.filter));
        });
        this._saveState();
      }
    } catch (e) { /* ignore */ }
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
