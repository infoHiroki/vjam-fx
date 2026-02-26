/**
 * VJam FX — Popup Controller
 * Multi-layer presets, CSS filters, blend modes
 * Syncs state with Service Worker for navigation persistence
 */

const PRESET_CATEGORIES = [
  { label: 'Immersive', presets: [
    { id: 'neon-tunnel', name: 'Neon Tunnel' },
    { id: 'laser-tunnel', name: 'Laser Tunnel' },
    { id: 'infinite-zoom', name: 'Infinite Zoom' },
    { id: 'hypnotic', name: 'Hypnotic' },
    { id: 'wormhole', name: 'Wormhole' },
    { id: 'warp-speed', name: 'Warp Speed' },
    { id: 'tunnel-zoom', name: 'Tunnel Zoom' },
    { id: 'root-tunnel', name: 'Root Tunnel' },
    { id: 'helix-tunnel', name: 'Helix Tunnel' },
    { id: 'deep-dive', name: 'Deep Dive' },
    { id: 'deep-ocean', name: 'Deep Ocean' },
    { id: 'portal-ring', name: 'Portal Ring' },
    { id: 'cyber-corridor', name: 'Cyber Corridor' },
    { id: 'time-warp', name: 'Time Warp' },
    { id: 'gravity-well', name: 'Gravity Well' },
    { id: 'plasma-wave', name: 'Plasma Wave' },
    { id: 'aurora', name: 'Aurora' },
    { id: 'northern-lights', name: 'Northern Lights' },
    { id: 'crystal-cave', name: 'Crystal Cave' },
  ]},
  { label: 'Frames & Film', presets: [
    { id: 'neon-frame', name: 'Neon Frame' },
    { id: 'light-leak', name: 'Light Leak' },
    { id: 'film-burn', name: 'Film Burn' },
    { id: 'film-scratch', name: 'Film Scratch' },
    { id: 'scan-line', name: 'Scan Line' },
    { id: 'vhs-noise', name: 'VHS Noise' },
    { id: 'vhs-tracking', name: 'VHS Tracking' },
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
    this.opacity = 1.0;
    this.isActive = false;
    this.audioEnabled = true;
    this.autoCycleActive = false;
    this._tabId = null;
    this._injectedPresets = new Set(); // track which preset files have been injected
    this._coreInjected = false;
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

    let liveState = null;
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        func: () => {
          if (!window._vjamFxEngine) return null;
          const e = window._vjamFxEngine;
          return {
            active: e.active,
            layers: e.getActiveLayerNames(),
            blendMode: e.blendMode,
            filters: [...e.activeFilters],
            autoCycle: !!e._autoCycleTimer,
            isLightPage: e.isLightPage,
          };
        },
      });
      liveState = result;
    } catch (e) { /* scripting failed */ }

    let state = null;
    if (liveState && liveState.active) {
      state = liveState;
    } else {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'getState',
          tabId: this._tabId,
        });
        if (response && response.state && response.state.active) {
          state = response.state;
        }
      } catch (e) { /* SW not available */ }
    }

    if (!state) return;

    this.isActive = true;
    this.selectedBlendMode = state.blendMode || 'screen';
    if (state.opacity !== undefined) this.opacity = state.opacity;
    if (state.audioEnabled !== undefined) this.audioEnabled = state.audioEnabled;
    if (state.layers) {
      for (const id of state.layers) this.activeLayers.add(id);
    } else if (state.preset) {
      this.activeLayers.add(state.preset);
    }
    if (state.filters) {
      for (const f of state.filters) this.activeFilters.add(f);
    }
    if (state.autoCycle) {
      this.autoCycleActive = true;
    }
    this._updateUI();
  }

  _updateUI() {
    const toggle = document.getElementById('toggle');
    if (toggle) toggle.checked = this.isActive;

    document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => {
      cb.checked = this.activeLayers.has(cb.value);
    });

    const blendSelect = document.getElementById('blend-mode');
    if (blendSelect) blendSelect.value = this.selectedBlendMode;

    const opacitySlider = document.getElementById('opacity-slider');
    if (opacitySlider) opacitySlider.value = Math.round(this.opacity * 100);

    const audioBtn = document.getElementById('audio-toggle');
    if (audioBtn) {
      audioBtn.textContent = this.audioEnabled ? 'ON' : 'OFF';
      audioBtn.classList.toggle('on', this.audioEnabled);
    }

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', this.activeFilters.has(btn.dataset.filter));
    });

    const autoBtn = document.getElementById('btn-auto-cycle');
    if (autoBtn) autoBtn.classList.toggle('active', this.autoCycleActive);

    this._updateLayerCount();
  }

  _updateLayerCount() {
    const el = document.getElementById('layer-count');
    if (!el) return;
    const count = this.activeLayers.size;
    el.textContent = count > 0 ? `${count} layer${count > 1 ? 's' : ''}` : '';
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
          opacity: this.opacity,
          audioEnabled: this.audioEnabled,
          filters: [...this.activeFilters],
          autoCyclePresets: this.autoCycleActive ? this.presets.map(p => p.id) : null,
        },
      });
    } catch (e) { /* SW not available */ }
  }

  _bindEvents() {
    // Preset search
    const searchInput = document.getElementById('preset-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const items = document.querySelectorAll('#preset-list .preset-item');
        const headers = document.querySelectorAll('#preset-list .category-header');

        if (!query) {
          items.forEach(el => { el.style.display = ''; });
          headers.forEach(el => { el.style.display = ''; });
          return;
        }

        items.forEach(el => {
          const name = el.textContent.toLowerCase();
          el.style.display = name.includes(query) ? '' : 'none';
        });

        headers.forEach(header => {
          let next = header.nextElementSibling;
          let hasVisible = false;
          while (next && !next.classList.contains('category-header')) {
            if (next.style.display !== 'none') hasVisible = true;
            next = next.nextElementSibling;
          }
          header.style.display = hasVisible ? '' : 'none';
        });
      });
    }

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

    // Preset checkboxes
    const list = document.getElementById('preset-list');
    if (list) {
      list.addEventListener('change', (e) => {
        if (e.target.type !== 'checkbox') return;
        const presetId = e.target.value;
        if (e.target.checked) {
          this.activeLayers.add(presetId);
          if (this.isActive) this._addLayer(presetId);
        } else {
          this.activeLayers.delete(presetId);
          if (this.isActive) this._removeLayer(presetId);
        }
        if (this.autoCycleActive) {
          this.autoCycleActive = false;
          const autoBtn = document.getElementById('btn-auto-cycle');
          if (autoBtn) autoBtn.classList.remove('active');
          this._sendCommand({ action: 'stopAutoCycle' });
        }
        this._updateLayerCount();
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

    // Opacity slider
    const opacitySlider = document.getElementById('opacity-slider');
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        this.opacity = parseInt(e.target.value, 10) / 100;
        if (this.isActive) {
          this._sendCommand({ action: 'setOpacity', opacity: this.opacity });
        }
        this._saveState();
      });
    }

    // Audio toggle (tab audio capture ON/OFF)
    const audioBtn = document.getElementById('audio-toggle');
    if (audioBtn) {
      audioBtn.addEventListener('click', async () => {
        this.audioEnabled = !this.audioEnabled;
        audioBtn.textContent = this.audioEnabled ? 'ON' : 'OFF';
        audioBtn.classList.toggle('on', this.audioEnabled);

        if (this.audioEnabled) {
          await chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId });
          if (this.isActive) {
            this._sendCommand({ action: 'setAudioEnabled', enabled: true });
          }
        } else {
          await chrome.runtime.sendMessage({ type: 'stopTabAudio', tabId: this._tabId });
          if (this.isActive) {
            this._sendCommand({ action: 'setAudioEnabled', enabled: false });
          }
        }
        this._saveState();
      });
    }

    // Reset
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ type: 'stopTabAudio', tabId: this._tabId });
        await this._sendCommand({ action: 'kill' });
        this.activeLayers.clear();
        this.activeFilters.clear();
        this.autoCycleActive = false;
        this.selectedBlendMode = 'screen';
        this.opacity = 1.0;
        this.audioEnabled = true;
        this.isActive = false;
        this._coreInjected = false;
        this._injectedPresets.clear();
        // Reset all UI
        const toggle = document.getElementById('toggle');
        if (toggle) toggle.checked = false;
        document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        const opacitySlider = document.getElementById('opacity-slider');
        if (opacitySlider) opacitySlider.value = 100;
        const audioBtn = document.getElementById('audio-toggle');
        if (audioBtn) { audioBtn.textContent = 'ON'; audioBtn.classList.add('on'); }
        const blendSelect = document.getElementById('blend-mode');
        if (blendSelect) blendSelect.value = 'screen';
        const autoBtn = document.getElementById('btn-auto-cycle');
        if (autoBtn) autoBtn.classList.remove('active');
        this._updateLayerCount();
        this._saveState();
      });
    }

    // Next
    const btnNext = document.getElementById('btn-next');
    if (btnNext) {
      btnNext.addEventListener('click', async () => {
        if (!this.isActive) {
          this.isActive = true;
          const toggle = document.getElementById('toggle');
          if (toggle) toggle.checked = true;
          await this._injectCore();
        }
        for (const p of this.presets) {
          await this._injectPreset(p.id);
        }
        await this._sendCommand({ action: 'kill' });
        const count = 1 + Math.floor(Math.random() * Math.min(3, this.presets.length));
        const shuffled = this.presets.slice().sort(() => Math.random() - 0.5);
        const chosen = shuffled.slice(0, count);
        const first = chosen[0];
        await this._sendCommand({ action: 'start', preset: first.id, blendMode: this.selectedBlendMode });
        for (let i = 1; i < chosen.length; i++) {
          await this._sendCommand({ action: 'addLayer', preset: chosen[i].id });
        }
        for (const f of this.activeFilters) {
          await this._sendCommand({ action: 'setFilter', filter: f, enabled: true });
        }
        this.activeLayers.clear();
        for (const p of chosen) this.activeLayers.add(p.id);
        document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => {
          cb.checked = this.activeLayers.has(cb.value);
        });
        this._updateLayerCount();
        if (this.autoCycleActive) {
          this.autoCycleActive = false;
          const autoBtn = document.getElementById('btn-auto-cycle');
          if (autoBtn) autoBtn.classList.remove('active');
          await this._sendCommand({ action: 'stopAutoCycle' });
        }
        // Start tab audio if needed
        if (this.audioEnabled) {
          await chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId });
        }
        this._saveState();
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
            const toggle = document.getElementById('toggle');
            if (toggle) toggle.checked = true;
            await this._startAll();
          }
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
   * Inject core scripts (p5, base-preset, engine)
   */
  async _injectCore() {
    if (this._coreInjected) return;
    const coreScripts = [
      'lib/p5.min.js',
      'content/base-preset.js',
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

  async _injectPreset(presetId) {
    if (this._injectedPresets.has(presetId)) return;
    await chrome.scripting.executeScript({
      target: { tabId: this._tabId },
      world: 'MAIN',
      files: [`content/presets/${presetId}.js`],
    });
    this._injectedPresets.add(presetId);
  }

  async _startAll() {
    if (!this._tabId) return;

    if (this.activeLayers.size === 0) {
      this.activeLayers.add('neon-tunnel');
      const cb = document.querySelector('input[value="neon-tunnel"]');
      if (cb) cb.checked = true;
    }

    try {
      this.isActive = true;

      await this._injectCore();

      const layers = [...this.activeLayers];
      for (const presetId of layers) {
        await this._injectPreset(presetId);
      }

      const first = layers[0];
      await this._sendCommand({
        action: 'start',
        preset: first,
        blendMode: this.selectedBlendMode,
      });

      for (let i = 1; i < layers.length; i++) {
        await this._sendCommand({ action: 'addLayer', preset: layers[i] });
      }

      for (const f of this.activeFilters) {
        await this._sendCommand({ action: 'setFilter', filter: f, enabled: true });
      }

      // Start tab audio capture
      if (this.audioEnabled) {
        await chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId });
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
    await chrome.runtime.sendMessage({ type: 'stopTabAudio', tabId: this._tabId });
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
