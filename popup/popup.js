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
    { id: 'chrome-wave', name: 'Chrome Wave' },
    { id: 'sunset-drive', name: 'Sunset Drive' },
    { id: 'neon-highway', name: 'Neon Highway' },
    { id: 'dna-aurora', name: 'DNA Aurora' },
    { id: 'plasma-ball', name: 'Plasma Ball' },
    { id: 'hologram', name: 'Hologram' },
  ]},
  { label: 'Frames & Film', presets: [
    { id: 'neon-frame', name: 'Neon Frame' },
    { id: 'light-leak', name: 'Light Leak' },
    { id: 'film-burn', name: 'Film Burn' },
    { id: 'film-scratch', name: 'Film Scratch' },
    { id: 'scan-line', name: 'Scan Line' },
    { id: 'vhs-noise', name: 'VHS Noise' },
    { id: 'vhs-tracking', name: 'VHS Tracking' },
    { id: 'film-grain', name: 'Film Grain' },
    { id: 'film-countdown', name: 'Film Countdown' },
    { id: 'film-reel', name: 'Film Reel' },
    { id: 'vhs-rewind', name: 'VHS Rewind' },
    { id: 'polaroid-flash', name: 'Polaroid Flash' },
    { id: 'tape-distort', name: 'Tape Distort' },
  ]},
  { label: 'Patterns', presets: [
    { id: 'kaleidoscope', name: 'Kaleidoscope' },
    { id: 'mandala', name: 'Mandala' },
    { id: 'sacred-geometry', name: 'Sacred Geometry' },
    { id: 'moire', name: 'Moire' },
    { id: 'prism', name: 'Prism' },
    { id: 'barcode', name: 'Barcode' },
    { id: 'spirograph', name: 'Spirograph' },
    { id: 'cyber-mandala', name: 'Cyber Mandala' },
    { id: 'penrose-tile', name: 'Penrose Tile' },
    { id: 'checker-wave', name: 'Checker Wave' },
    { id: 'hermann-grid', name: 'Hermann Grid' },
    { id: 'op-art', name: 'Op Art' },
    { id: 'stained-glass', name: 'Stained Glass' },
    { id: 'dot-halftone', name: 'Dot Halftone' },
    { id: 'wave-rings', name: 'Wave Rings' },
    { id: 'pendulum-wave', name: 'Pendulum Wave' },
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
    { id: 'bioluminescence', name: 'Bioluminescence' },
    { id: 'ink-blot', name: 'Ink Blot' },
    { id: 'ink-wash', name: 'Ink Wash' },
    { id: 'lava-lamp', name: 'Lava Lamp' },
    { id: 'lava-rise', name: 'Lava Rise' },
    { id: 'bubble-float', name: 'Bubble Float' },
    { id: 'growth-spiral', name: 'Growth Spiral' },
    { id: 'mycelium', name: 'Mycelium' },
    { id: 'fungal-web', name: 'Fungal Web' },
  ]},
  { label: 'Nature', presets: [
    { id: 'fractal-tree', name: 'Fractal Tree' },
    { id: 'flower-bloom', name: 'Flower Bloom' },
    { id: 'autumn-fall', name: 'Autumn Fall' },
    { id: 'dandelion-seeds', name: 'Dandelion Seeds' },
    { id: 'petal-storm', name: 'Petal Storm' },
    { id: 'meadow-breeze', name: 'Meadow Breeze' },
    { id: 'leaf-vein', name: 'Leaf Vein' },
    { id: 'vine-growth', name: 'Vine Growth' },
    { id: 'neon-vines', name: 'Neon Vines' },
    { id: 'forest-canopy', name: 'Forest Canopy' },
    { id: 'northern-forest', name: 'Northern Forest' },
    { id: 'seed-burst', name: 'Seed Burst' },
    { id: 'pollen-cloud', name: 'Pollen Cloud' },
    { id: 'tree-ring', name: 'Tree Ring' },
    { id: 'moss-carpet', name: 'Moss Carpet' },
    { id: 'lichen-spread', name: 'Lichen Spread' },
    { id: 'spore-drift', name: 'Spore Drift' },
  ]},
  { label: 'Water', presets: [
    { id: 'water-surface', name: 'Water Surface' },
    { id: 'river-stream', name: 'River Stream' },
    { id: 'waterfall-mist', name: 'Waterfall Mist' },
    { id: 'tide-wave', name: 'Tide Wave' },
    { id: 'tide-pool', name: 'Tide Pool' },
    { id: 'rain-puddles', name: 'Rain Puddles' },
    { id: 'pond-life', name: 'Pond Life' },
    { id: 'kelp-forest', name: 'Kelp Forest' },
    { id: 'ice-formation', name: 'Ice Formation' },
    { id: 'erosion-line', name: 'Erosion Line' },
  ]},
  { label: 'Grid & Tech', presets: [
    { id: 'glitch-grid', name: 'Glitch Grid' },
    { id: 'hexgrid-pulse', name: 'Hexgrid Pulse' },
    { id: 'grid-warp', name: 'Grid Warp' },
    { id: 'circuit-board', name: 'Circuit Board' },
    { id: 'crt-monitor', name: 'CRT Monitor' },
    { id: 'retro-terminal', name: 'Retro Terminal' },
    { id: 'circuit-trace', name: 'Circuit Trace' },
    { id: 'cyber-grid', name: 'Cyber Grid' },
    { id: 'hex-network', name: 'Hex Network' },
    { id: 'led-matrix', name: 'LED Matrix' },
    { id: 'dot-matrix', name: 'Dot Matrix' },
    { id: 'neural-net', name: 'Neural Net' },
    { id: 'isometric-city', name: 'Isometric City' },
    { id: 'wireframe-city', name: 'Wireframe City' },
    { id: 'floating-ui', name: 'Floating UI' },
    { id: 'data-stream', name: 'Data Stream' },
    { id: 'data-cascade', name: 'Data Cascade' },
    { id: 'data-sprites', name: 'Data Sprites' },
    { id: 'matrix-code', name: 'Matrix Code' },
    { id: 'matrix-rain', name: 'Matrix Rain' },
  ]},
  { label: 'Space', presets: [
    { id: 'starfield', name: 'Starfield' },
    { id: 'constellation', name: 'Constellation' },
    { id: 'bokeh', name: 'Bokeh' },
    { id: 'terrain', name: 'Terrain' },
    { id: 'meteor-shower', name: 'Meteor Shower' },
    { id: 'orbits', name: 'Orbits' },
    { id: 'cyber-sun', name: 'Cyber Sun' },
    { id: 'dna-helix', name: 'DNA Helix' },
    { id: 'crystal-lattice', name: 'Crystal Lattice' },
    { id: 'radar', name: 'Radar' },
    { id: 'sand-dunes', name: 'Sand Dunes' },
  ]},
  { label: 'Neon & Glow', presets: [
    { id: 'neon-80s', name: 'Neon 80s' },
    { id: 'neon-bars', name: 'Neon Bars' },
    { id: 'neon-dust', name: 'Neon Dust' },
    { id: 'neon-jellyfish', name: 'Neon Jellyfish' },
    { id: 'neon-smoke', name: 'Neon Smoke' },
    { id: 'electric-arc', name: 'Electric Arc' },
    { id: 'electric-city', name: 'Electric City' },
    { id: 'electric-fence', name: 'Electric Fence' },
    { id: 'lightning', name: 'Lightning' },
    { id: 'light-swarm', name: 'Light Swarm' },
    { id: 'fireflies', name: 'Fireflies' },
    { id: 'ember-drift', name: 'Ember Drift' },
    { id: 'cathode-glow', name: 'Cathode Glow' },
    { id: 'fire-wall', name: 'Fire Wall' },
    { id: 'paper-lantern', name: 'Paper Lantern' },
  ]},
  { label: 'Glitch & Retro', presets: [
    { id: 'glitch-8bit', name: 'Glitch 8bit' },
    { id: 'glitch-wave', name: 'Glitch Wave' },
    { id: 'cyber-glitch', name: 'Cyber Glitch' },
    { id: 'digital-noise', name: 'Digital Noise' },
    { id: 'static-burst', name: 'Static Burst' },
    { id: 'static-snow', name: 'Static Snow' },
    { id: 'radio-static', name: 'Radio Static' },
    { id: 'scramble-channel', name: 'Scramble Channel' },
    { id: 'flicker-strobe', name: 'Flicker Strobe' },
    { id: 'old-tv', name: 'Old TV' },
    { id: 'crt-scan', name: 'CRT Scan' },
    { id: 'retro-arcade', name: 'Retro Arcade' },
    { id: 'retro-wave', name: 'Retro Wave' },
    { id: 'arcade-blocks', name: 'Arcade Blocks' },
    { id: 'pixel-cascade', name: 'Pixel Cascade' },
    { id: 'pixel-mosaic', name: 'Pixel Mosaic' },
    { id: 'pixel-rain', name: 'Pixel Rain' },
    { id: 'pixel-sort-b', name: 'Pixel Sort' },
    { id: 'ascii-art', name: 'ASCII Art' },
  ]},
  { label: 'Audio Reactive', presets: [
    { id: 'frequency-rings', name: 'Frequency Rings' },
    { id: 'equalizer', name: 'Equalizer' },
    { id: 'sine-waves', name: 'Sine Waves' },
    { id: 'gradient-sweep', name: 'Gradient Sweep' },
    { id: 'wireframe-sphere', name: 'Wireframe Sphere' },
    { id: 'analog-wave', name: 'Analog Wave' },
    { id: 'audio-mesh', name: 'Audio Mesh' },
    { id: 'boombox-meter', name: 'Boombox Meter' },
    { id: 'dial-tone', name: 'Dial Tone' },
    { id: 'oscilloscope', name: 'Oscilloscope' },
    { id: 'pulse-ring', name: 'Pulse Ring' },
    { id: 'radial-burst', name: 'Radial Burst' },
    { id: 'synth-wave', name: 'Synth Wave' },
    { id: 'vinyl-groove', name: 'Vinyl Groove' },
    { id: 'cassette-reel', name: 'Cassette Reel' },
    { id: 'honeycomb-pulse', name: 'Honeycomb Pulse' },
  ]},
  { label: 'Particles', presets: [
    { id: 'snowfall', name: 'Snowfall' },
    { id: 'confetti-burst', name: 'Confetti Burst' },
    { id: 'particle-storm', name: 'Particle Storm' },
    { id: 'dust-motes', name: 'Dust Motes' },
    { id: 'bird-murmuration', name: 'Bird Murmuration' },
    { id: 'smoke-stack', name: 'Smoke Stack' },
    { id: 'fog-bank', name: 'Fog Bank' },
    { id: 'wind-ripple', name: 'Wind Ripple' },
  ]},
  { label: 'Weather', presets: [
    { id: 'rain', name: 'Rain' },
    { id: 'neon-rain', name: 'Neon Rain' },
    { id: 'cyber-rain-heavy', name: 'Cyber Rain' },
    { id: 'ceiling-drip', name: 'Ceiling Drip' },
  ]},
];

// Flat list for compatibility
const ALL_PRESETS = PRESET_CATEGORIES.flatMap(c => c.presets);

const FILTER_NAMES = ['invert', 'hue-rotate', 'grayscale', 'saturate', 'brightness', 'contrast', 'sepia', 'blur'];
const VALID_BLEND_MODES = ['screen', 'lighten', 'difference', 'exclusion', 'color-dodge'];

const DEFAULT_SETTINGS = {
  fadeDuration: 1.5,
  barsPerCycle: 8,
  sensitivity: 'mid',
};

const SENSITIVITY_MAP = { lo: 0.5, mid: 1.0, hi: 2.0 };

class PopupController {
  constructor() {
    this.presets = ALL_PRESETS;
    this.activeLayers = new Set();  // preset IDs currently active
    this.activeFilters = new Set();
    this.selectedBlendMode = 'screen';
    this.opacity = 0.8;
    this.isActive = false;
    this.audioEnabled = true;
    this.autoCycleActive = false;
    this.autoBlend = false;
    this.autoFilters = false;
    this._tabId = null;
    this._injectedPresets = new Set(); // track which preset files have been injected
    this._coreInjected = false;
    this._busy = false; // concurrency guard for async operations
    this.settings = { ...DEFAULT_SETTINGS };
    this.locks = { effect: false, blend: false, filter: false };
    this.scenes = new Array(12).fill(null); // 12 scene slots
    this.textState = null; // { text, autoText }
    this.sceneSaveMode = false;
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

    await this._loadSettings();
    await this._loadScenes();
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
      popup.textContent = '';
      const div = document.createElement('div');
      div.style.cssText = 'padding:20px;text-align:center;color:#888';
      div.textContent = msg;
      popup.appendChild(div);
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
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = 'preset';
        input.value = p.id;
        const span = document.createElement('span');
        span.textContent = p.name;
        label.appendChild(input);
        label.appendChild(span);
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
    if (state.autoCycle || (state.autoCyclePresets && state.autoCyclePresets.length > 0)) {
      this.autoCycleActive = true;
    }
    if (state.autoBlend) this.autoBlend = true;
    if (state.autoFilters) this.autoFilters = true;
    if (state.locks) this.locks = { ...this.locks, ...state.locks };
    if (state.textState) this.textState = state.textState;
    this._updateUI();
  }

  _updateUI() {
    const toggle = document.getElementById('toggle');
    if (toggle) toggle.checked = this.isActive;

    document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => {
      cb.checked = this.activeLayers.has(cb.value);
    });

    document.querySelectorAll('.blend-btn').forEach(btn => {
      btn.classList.toggle('active', this.selectedBlendMode !== 'screen' && btn.dataset.blend === this.selectedBlendMode);
    });

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

    const autoBlendBtn = document.getElementById('auto-blend');
    if (autoBlendBtn) autoBlendBtn.classList.toggle('active', this.autoBlend);
    const autoFiltersBtn = document.getElementById('auto-filters');
    if (autoFiltersBtn) autoFiltersBtn.classList.toggle('active', this.autoFilters);

    // Lock buttons
    for (const key of ['effect', 'blend', 'filter']) {
      const lockBtn = document.getElementById('lock-' + key);
      if (lockBtn) {
        lockBtn.classList.toggle('locked', this.locks[key]);
        lockBtn.textContent = this.locks[key] ? 'Locked' : 'Lock';
      }
    }

    // Text state
    if (this.textState) {
      const textInput = document.getElementById('text-input');
      if (textInput && this.textState.text) textInput.value = this.textState.text;
      const btnTextToggle = document.getElementById('btn-text-toggle');
      if (btnTextToggle && this.textState.autoText) {
        btnTextToggle.classList.add('active');
        btnTextToggle.textContent = 'OFF';
      }
    }

    this._updateLayerCount();
  }

  _updateLayerCount() {
    const el = document.getElementById('layer-count');
    if (!el) return;
    const count = this.activeLayers.size;
    el.textContent = count > 0 ? `${count} layer${count > 1 ? 's' : ''}` : '';
  }

  async _loadSettings() {
    try {
      const result = await chrome.storage.local.get('vjamfx_settings');
      if (result.vjamfx_settings) {
        this.settings = { ...DEFAULT_SETTINGS, ...result.vjamfx_settings };
      }
    } catch (e) { /* storage not available */ }
    this._updateSettingsUI();
  }

  async _saveSettings() {
    try {
      await chrome.storage.local.set({ vjamfx_settings: this.settings });
    } catch (e) { /* storage not available */ }
  }

  async _loadScenes() {
    try {
      const result = await chrome.storage.local.get('vjamfx_scenes');
      if (result.vjamfx_scenes && Array.isArray(result.vjamfx_scenes)) {
        this.scenes = result.vjamfx_scenes;
      }
    } catch (e) { /* storage not available */ }
    this._updateSceneButtons();
  }

  async _saveScenes() {
    try {
      await chrome.storage.local.set({ vjamfx_scenes: this.scenes });
    } catch (e) { /* storage not available */ }
    this._updateSceneButtons();
  }

  _updateSceneButtons() {
    document.querySelectorAll('.scene-btn').forEach(btn => {
      const slot = parseInt(btn.dataset.slot, 10);
      const saved = this.scenes[slot] != null;
      btn.classList.toggle('saved', saved);
      const slotDiv = btn.closest('.scene-slot');
      if (slotDiv) slotDiv.classList.toggle('saved', saved);
    });
  }

  _saveScene(slot) {
    this.scenes[slot] = {
      layers: [...this.activeLayers],
      blendMode: this.selectedBlendMode,
      filters: [...this.activeFilters],
      opacity: this.opacity,
      locks: { ...this.locks },
    };
    this._saveScenes();
  }

  async _loadScene(slot) {
    const scene = this.scenes[slot];
    if (!scene || this._busy) return;
    // Validate scene has layers array
    if (!Array.isArray(scene.layers)) return;
    this._busy = true;

    try {
      // Ensure engine is running
      if (!this.isActive) {
        this.isActive = true;
        const toggle = document.getElementById('toggle');
        if (toggle) toggle.checked = true;
        await this._injectCore();
      }

      // Kill current state
      await this._sendCommand({ action: 'kill' });

      // Restore layers
      this.activeLayers.clear();
      for (const id of scene.layers) {
        this.activeLayers.add(id);
        await this._injectPreset(id);
      }
      const layers = [...this.activeLayers];
      if (layers.length > 0) {
        await this._sendCommand({ action: 'start', preset: layers[0], blendMode: scene.blendMode || 'screen' });
        for (let i = 1; i < layers.length; i++) {
          await this._sendCommand({ action: 'addLayer', preset: layers[i] });
        }
      } else {
        // Empty scene — deactivate
        this.isActive = false;
        const toggle = document.getElementById('toggle');
        if (toggle) toggle.checked = false;
      }

      // Restore blend, filters, opacity
      this.selectedBlendMode = scene.blendMode || 'screen';
      this.activeFilters.clear();
      if (scene.filters) {
        for (const f of scene.filters) {
          this.activeFilters.add(f);
          await this._sendCommand({ action: 'setFilter', filter: f, enabled: true });
        }
      }
      this.opacity = scene.opacity != null ? scene.opacity : 1.0;
      await this._sendCommand({ action: 'setOpacity', opacity: this.opacity });

      // Restore locks
      if (scene.locks) this.locks = { ...this.locks, ...scene.locks };

      // Re-apply current Auto/Rnd state (don't restore from scene — keep current popup state)
      if (this.autoCycleActive) {
        await this._injectAllPresets();
        const allIds = this.presets.map(p => p.id);
        await this._sendCommand({ action: 'startAutoCycle', presets: allIds, interval: 8000, autoBlend: this.autoBlend, autoFilters: this.autoFilters, barsPerCycle: this.settings.barsPerCycle, locks: this.locks, skipFirstTick: true });
      } else if (this.autoBlend || this.autoFilters) {
        await this._sendCommand({ action: 'startAutoFX', autoBlend: this.autoBlend, autoFilters: this.autoFilters });
      }

      // Start audio if enabled
      if (this.audioEnabled) {
        await this._sendCommand({ action: 'startVideoAudio' });
        chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId }).catch(() => {});
      }

      this._updateUI();
      await this._saveState();
    } finally {
      this._busy = false;
    }
  }

  _clearScene(slot) {
    this.scenes[slot] = null;
    this._saveScenes();
  }

  _updateSettingsUI() {
    const fadeEl = document.getElementById('setting-fade');
    if (fadeEl) fadeEl.value = String(this.settings.fadeDuration);
    const cycleEl = document.getElementById('setting-cycle');
    if (cycleEl) cycleEl.value = String(this.settings.barsPerCycle);
    const sensEl = document.getElementById('setting-sensitivity');
    if (sensEl) sensEl.value = this.settings.sensitivity;
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
          autoBlend: this.autoBlend,
          autoFilters: this.autoFilters,
          locks: this.locks,
          textState: this.textState,
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

    // Settings gear button
    const settingsBtn = document.getElementById('btn-settings');
    const settingsSection = document.getElementById('settings-section');
    if (settingsBtn && settingsSection) {
      settingsBtn.addEventListener('click', () => {
        const isOpen = settingsSection.style.display !== 'none';
        settingsSection.style.display = isOpen ? 'none' : '';
        settingsBtn.classList.toggle('active', !isOpen);
      });
    }

    // Settings: Fade duration
    const fadeEl = document.getElementById('setting-fade');
    if (fadeEl) {
      fadeEl.addEventListener('change', () => {
        const val = parseFloat(fadeEl.value);
        this.settings.fadeDuration = isNaN(val) ? 1.5 : Math.max(0, val);
        this._saveSettings();
        if (this.isActive) {
          this._sendCommand({ action: 'setFadeDuration', duration: this.settings.fadeDuration });
        }
      });
    }

    // Settings: Cycle bars
    const cycleEl = document.getElementById('setting-cycle');
    if (cycleEl) {
      cycleEl.addEventListener('change', () => {
        const val = parseInt(cycleEl.value, 10);
        this.settings.barsPerCycle = isNaN(val) || val < 1 ? 8 : val;
        this._saveSettings();
        // Re-send auto-cycle with updated bars if active
        if (this.autoCycleActive) {
          const allIds = this.presets.map(p => p.id);
          this._sendCommand({ action: 'startAutoCycle', presets: allIds, interval: 8000, autoBlend: this.autoBlend, autoFilters: this.autoFilters, barsPerCycle: this.settings.barsPerCycle, locks: this.locks });
        }
      });
    }

    // Settings: Sensitivity
    const sensEl = document.getElementById('setting-sensitivity');
    if (sensEl) {
      sensEl.addEventListener('change', () => {
        this.settings.sensitivity = sensEl.value;
        this._saveSettings();
        if (this.isActive) {
          this._sendCommand({ action: 'setAudioSensitivity', sensitivity: SENSITIVITY_MAP[this.settings.sensitivity] || 1.0 });
        }
      });
    }

    // Lock buttons
    for (const key of ['effect', 'blend', 'filter']) {
      const lockBtn = document.getElementById('lock-' + key);
      if (lockBtn) {
        lockBtn.addEventListener('click', () => {
          this.locks[key] = !this.locks[key];
          lockBtn.classList.toggle('locked', this.locks[key]);
          lockBtn.textContent = this.locks[key] ? 'Locked' : 'Lock';
          this._saveState();
        });
      }
    }

    // Scenes toggle
    const scenesToggleBtn = document.getElementById('btn-scenes-toggle');
    const scenesSection = document.getElementById('scenes-section');
    if (scenesToggleBtn && scenesSection) {
      scenesToggleBtn.addEventListener('click', () => {
        const isOpen = scenesSection.style.display !== 'none';
        scenesSection.style.display = isOpen ? 'none' : '';
        scenesToggleBtn.textContent = isOpen ? '\u25BC' : '\u25B2';
      });
    }

    // Scene Save button
    const sceneSaveBtn = document.getElementById('btn-scene-save');
    const sceneGrid = document.getElementById('scene-grid');
    if (sceneSaveBtn) {
      sceneSaveBtn.addEventListener('click', () => {
        this.sceneSaveMode = !this.sceneSaveMode;
        sceneSaveBtn.classList.toggle('active', this.sceneSaveMode);
        if (sceneGrid) sceneGrid.classList.toggle('save-mode', this.sceneSaveMode);
      });
    }

    // Scene buttons: save mode click = save, normal click = load, right-click = clear
    const sceneBtns = document.querySelectorAll('.scene-btn');
    for (const btn of sceneBtns) {
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const slot = parseInt(btn.dataset.slot, 10);
        if (this.scenes[slot] != null) {
          this._clearScene(slot);
  
        }
      });
      btn.addEventListener('click', () => {
        const slot = parseInt(btn.dataset.slot, 10);
        if (this.sceneSaveMode) {
          // Save mode: save to this slot
          this._saveScene(slot);
          this.sceneSaveMode = false;
          if (sceneSaveBtn) sceneSaveBtn.classList.remove('active');
          if (sceneGrid) sceneGrid.classList.remove('save-mode');

        } else if (this.scenes[slot] != null) {
          // Normal mode: load saved scene
          this._loadScene(slot);

        }
      });
    }

    // Scene delete buttons
    const sceneDelBtns = document.querySelectorAll('.scene-del');
    for (const btn of sceneDelBtns) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slot = parseInt(btn.dataset.slot, 10);
        this._clearScene(slot);
      });
    }

    // Text toggle
    const btnTextToggle = document.getElementById('btn-text-toggle');
    const textInput = document.getElementById('text-input');
    const textToggleOn = async () => {
      const text = textInput ? textInput.value.trim() : '';
      if (!text) return;
      if (!this.isActive) {
        this.isActive = true;
        const toggle = document.getElementById('toggle');
        if (toggle) toggle.checked = true;
        await this._injectCore();
      }
      await this._sendCommand({ action: 'textAutoStart', text: text });
      if (btnTextToggle) { btnTextToggle.classList.add('active'); btnTextToggle.textContent = 'OFF'; }
      this.textState = { text, autoText: true };
      this._saveState();
    };
    const textToggleOff = async () => {
      await this._sendCommand({ action: 'textClear' });
      await this._sendCommand({ action: 'textAutoStop' });
      if (btnTextToggle) { btnTextToggle.classList.remove('active'); btnTextToggle.textContent = 'GO'; }
      this.textState = null;
      this._saveState();
    };
    if (btnTextToggle) {
      btnTextToggle.addEventListener('click', () => {
        if (this.textState && this.textState.autoText) {
          textToggleOff();
        } else {
          textToggleOn();
        }
      });
    }
    if (textInput) {
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') textToggleOn();
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
          if (!this.isActive) {
            const toggle = document.getElementById('toggle');
            if (toggle) toggle.checked = true;
            this._startAll();
          } else {
            this._addLayer(presetId);
          }
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

    // Blend mode buttons (toggle on/off, default is screen)
    const blendBtns = document.querySelectorAll('.blend-btn');
    for (const btn of blendBtns) {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.blend;
        if (this.selectedBlendMode === mode) {
          // Toggle off → back to default
          this.selectedBlendMode = 'screen';
          btn.classList.remove('active');
        } else {
          this.selectedBlendMode = mode;
          blendBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
        if (this.isActive) {
          this._sendCommand({ action: 'setBlendMode', blendMode: this.selectedBlendMode });
        }
        this._saveState();
      });
    }

    // Opacity slider (throttled to avoid flooding executeScript)
    const opacitySlider = document.getElementById('opacity-slider');
    if (opacitySlider) {
      let opacityThrottleTimer = null;
      opacitySlider.addEventListener('input', (e) => {
        this.opacity = parseInt(e.target.value, 10) / 100;
        if (opacityThrottleTimer) return;
        opacityThrottleTimer = setTimeout(() => {
          opacityThrottleTimer = null;
          if (this.isActive) {
            this._sendCommand({ action: 'setOpacity', opacity: this.opacity });
          }
          this._saveState();
        }, 50);
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
          await this._sendCommand({ action: 'startVideoAudio' });
          chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId }).catch(() => {});
          if (this.isActive) {
            this._sendCommand({ action: 'setAudioEnabled', enabled: true });
          }
        } else {
          await this._sendCommand({ action: 'stopVideoAudio' });
          chrome.runtime.sendMessage({ type: 'stopTabAudio', tabId: this._tabId }).catch(() => {});
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
        if (this._busy) return;
        await this._sendCommand({ action: 'stopVideoAudio' });
        chrome.runtime.sendMessage({ type: 'stopTabAudio', tabId: this._tabId }).catch(() => {});
        // Full reset (no lock respect — reset everything except scenes)
        await this._sendCommand({ action: 'kill' });

        // Stop text
        await this._sendCommand({ action: 'textAutoStop' });
        await this._sendCommand({ action: 'textClear' });
        this.textState = null;

        // Reset all state
        this.activeLayers.clear();
        this.activeFilters.clear();
        this.autoCycleActive = false;
        this.autoBlend = false;
        this.autoFilters = false;
        this.selectedBlendMode = 'screen';
        this.opacity = 0.8;
        this.audioEnabled = true;
        this.isActive = false;
        this._coreInjected = false;
        this._injectedPresets.clear();
        this.locks = { effect: false, blend: false, filter: false };

        // Reset settings to defaults
        this.settings = { ...DEFAULT_SETTINGS };
        await this._saveSettings();
        await this._sendCommand({ action: 'setFadeDuration', duration: this.settings.fadeDuration });
        await this._sendCommand({ action: 'setAudioSensitivity', sensitivity: 1.0 });

        // Reset all UI
        const toggle = document.getElementById('toggle');
        if (toggle) toggle.checked = false;
        document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.blend-btn').forEach(btn => btn.classList.remove('active'));
        const opacitySlider = document.getElementById('opacity-slider');
        if (opacitySlider) opacitySlider.value = 80;
        const audioBtn = document.getElementById('audio-toggle');
        if (audioBtn) { audioBtn.textContent = 'ON'; audioBtn.classList.add('on'); }
        const autoBtn = document.getElementById('btn-auto-cycle');
        if (autoBtn) autoBtn.classList.remove('active');
        const autoBlendBtn = document.getElementById('auto-blend');
        if (autoBlendBtn) autoBlendBtn.classList.remove('active');
        const autoFiltersBtn = document.getElementById('auto-filters');
        if (autoFiltersBtn) autoFiltersBtn.classList.remove('active');
        // Reset lock UI
        for (const key of ['effect', 'blend', 'filter']) {
          const lockBtn = document.getElementById('lock-' + key);
          if (lockBtn) { lockBtn.classList.remove('locked'); lockBtn.textContent = 'Lock'; }
        }
        // Reset text UI
        const textInput = document.getElementById('text-input');
        if (textInput) textInput.value = '';
        const btnTextToggle = document.getElementById('btn-text-toggle');
        if (btnTextToggle) { btnTextToggle.classList.remove('active'); btnTextToggle.textContent = 'GO'; }
        // Reset settings UI
        this._updateSettingsUI();
        this._updateLayerCount();
        this._saveState();

      });
    }

    // Next
    const btnNext = document.getElementById('btn-next');
    if (btnNext) {
      btnNext.addEventListener('click', async () => {
        if (this._busy) return;
        this._busy = true;
        try {
        if (!this.isActive) {
          this.isActive = true;
          const toggle = document.getElementById('toggle');
          if (toggle) toggle.checked = true;
          await this._injectCore();
        }
        // Kill with locks so engine preserves locked state
        await this._sendCommand({ action: 'kill', locks: this.locks });
        if (!this.locks.effect) {
          const count = 1 + Math.floor(Math.random() * Math.min(3, this.presets.length));
          const shuffled = this.presets.slice().sort(() => Math.random() - 0.5);
          const chosen = shuffled.slice(0, count);
          // Only inject chosen presets (not all 204)
          for (const p of chosen) {
            await this._injectPreset(p.id);
          }
          const first = chosen[0];
          await this._sendCommand({ action: 'start', preset: first.id, blendMode: this.selectedBlendMode });
          for (let i = 1; i < chosen.length; i++) {
            await this._sendCommand({ action: 'addLayer', preset: chosen[i].id });
          }
          this.activeLayers.clear();
          for (const p of chosen) this.activeLayers.add(p.id);
        }
        if (!this.locks.filter) {
          for (const f of this.activeFilters) {
            await this._sendCommand({ action: 'setFilter', filter: f, enabled: true });
          }
        }
        document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => {
          cb.checked = this.activeLayers.has(cb.value);
        });
        this._updateLayerCount();
        if (this.autoCycleActive) {
          this.autoCycleActive = false;
          const autoBtn = document.getElementById('btn-auto-cycle');
          if (autoBtn) autoBtn.classList.remove('active');
        }
        // Re-start standalone Rnd if active (kill stops engine-side timers)
        if (this.autoBlend || this.autoFilters) {
          await this._sendCommand({ action: 'startAutoFX', autoBlend: this.autoBlend, autoFilters: this.autoFilters });
        }
        // Start video audio if needed
        if (this.audioEnabled) {
          await this._sendCommand({ action: 'startVideoAudio' });
          chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId }).catch(() => {});
        }
        this._saveState();

        } finally { this._busy = false; }
      });
    }

    // Auto-cycle
    const btnAutoCycle = document.getElementById('btn-auto-cycle');
    if (btnAutoCycle) {
      btnAutoCycle.addEventListener('click', async () => {
        if (this._busy) return;
        this.autoCycleActive = !this.autoCycleActive;
        btnAutoCycle.classList.toggle('active', this.autoCycleActive);
        if (this.autoCycleActive) {
          // Auto ON → also enable Auto Blend + Auto Filter
          this.autoBlend = true;
          this.autoFilters = true;
          const autoBlendBtn = document.getElementById('auto-blend');
          if (autoBlendBtn) autoBlendBtn.classList.add('active');
          const autoFiltersBtn = document.getElementById('auto-filters');
          if (autoFiltersBtn) autoFiltersBtn.classList.add('active');
          // Rnd ON → ブレンド/フィルターボタンのactive解除（ランダムに委ねる）
          document.querySelectorAll('.blend-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          // Stop standalone autoFX (auto-cycle handles blend/filter)
          await this._sendCommand({ action: 'stopAutoFX' });
          if (!this.isActive) {
            const toggle = document.getElementById('toggle');
            if (toggle) toggle.checked = true;
            await this._startAll();
          }
          await this._injectAllPresets();
          const allIds = this.presets.map(p => p.id);
          await this._sendCommand({ action: 'startAutoCycle', presets: allIds, interval: 8000, autoBlend: this.autoBlend, autoFilters: this.autoFilters, barsPerCycle: this.settings.barsPerCycle, locks: this.locks });
          // Clear preset checkboxes — auto-cycle manages presets automatically
          document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
          this._updateLayerCount();
        } else {
          await this._sendCommand({ action: 'stopAutoCycle' });
          // Blend Random / Filter Random が残っていれば独立動作を継続
          if (this.autoBlend || this.autoFilters) {
            await this._sendCommand({ action: 'startAutoFX', autoBlend: this.autoBlend, autoFilters: this.autoFilters });
          }
        }
        this._saveState();
      });
    }

    // Filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    for (const btn of filterBtns) {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        if (this.activeFilters.has(filter)) {
          this.activeFilters.delete(filter);
        } else {
          this.activeFilters.add(filter);
        }
        btn.classList.toggle('active', this.activeFilters.has(filter));
        if (this.isActive) {
          this._sendCommand({ action: 'toggleFilter', filter: filter });
        }
        this._saveState();
      });
    }

    // Auto-blend toggle
    const autoBlendBtn = document.getElementById('auto-blend');
    if (autoBlendBtn) {
      autoBlendBtn.addEventListener('click', async () => {
        this.autoBlend = !this.autoBlend;
        autoBlendBtn.classList.toggle('active', this.autoBlend);
        // Rnd ON → ブレンドボタンのactive解除（ランダムに委ねる）
        if (this.autoBlend) {
          document.querySelectorAll('.blend-btn').forEach(b => b.classList.remove('active'));
        }
        if (this.autoCycleActive) {
          await this._sendCommand({ action: 'updateAutoCycleOptions', autoBlend: this.autoBlend, autoFilters: this.autoFilters, locks: this.locks });
        } else if (this.autoBlend || this.autoFilters) {
          await this._sendCommand({ action: 'startAutoFX', autoBlend: this.autoBlend, autoFilters: this.autoFilters });
        } else {
          await this._sendCommand({ action: 'stopAutoFX' });
        }
        this._saveState();
      });
    }

    // Auto-filters toggle
    const autoFiltersBtn = document.getElementById('auto-filters');
    if (autoFiltersBtn) {
      autoFiltersBtn.addEventListener('click', async () => {
        this.autoFilters = !this.autoFilters;
        autoFiltersBtn.classList.toggle('active', this.autoFilters);
        // Rnd ON → フィルターボタンのactive解除（ランダムに委ねる）
        if (this.autoFilters) {
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        }
        if (this.autoCycleActive) {
          await this._sendCommand({ action: 'updateAutoCycleOptions', autoBlend: this.autoBlend, autoFilters: this.autoFilters, locks: this.locks });
        } else if (this.autoBlend || this.autoFilters) {
          await this._sendCommand({ action: 'startAutoFX', autoBlend: this.autoBlend, autoFilters: this.autoFilters });
        } else {
          await this._sendCommand({ action: 'stopAutoFX' });
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

    // Inject p5.js first
    await chrome.scripting.executeScript({
      target: { tabId: this._tabId },
      world: 'MAIN',
      files: ['lib/p5.min.js'],
    });

    // Verify p5 loaded (retry once if not)
    let [{ result: p5Ready }] = await chrome.scripting.executeScript({
      target: { tabId: this._tabId },
      world: 'MAIN',
      func: () => typeof window.p5 === 'function',
    });

    if (!p5Ready) {
      await new Promise(r => setTimeout(r, 200));
      await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        files: ['lib/p5.min.js'],
      });
    }

    // Inject base-preset and engine
    for (const file of ['content/base-preset.js', 'content/text-overlay.js', 'content/content.js']) {
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

  async _injectAllPresets() {
    const toInject = this.presets.filter(p => !this._injectedPresets.has(p.id));
    if (toInject.length === 0) return;
    const BATCH = 20;
    for (let i = 0; i < toInject.length; i += BATCH) {
      await Promise.all(toInject.slice(i, i + BATCH).map(p =>
        this._injectPreset(p.id).catch(e => console.warn('VJam FX: inject failed:', p.id, e))
      ));
    }
  }

  async _startAll() {
    if (!this._tabId || this._busy) return;
    this._busy = true;

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

      // Start video audio capture + tabCapture fallback
      if (this.audioEnabled) {
        await this._sendCommand({ action: 'startVideoAudio' });
        chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId }).catch(() => {});
      }

      // Apply settings to engine
      await this._sendCommand({ action: 'setFadeDuration', duration: this.settings.fadeDuration });
      await this._sendCommand({ action: 'setAudioSensitivity', sensitivity: SENSITIVITY_MAP[this.settings.sensitivity] || 1.0 });
      await this._sendCommand({ action: 'setOpacity', opacity: this.opacity });

      // Re-start Auto/Rnd if active
      if (this.autoCycleActive) {
        await this._injectAllPresets();
        const allIds = this.presets.map(p => p.id);
        await this._sendCommand({ action: 'startAutoCycle', presets: allIds, interval: 8000, autoBlend: this.autoBlend, autoFilters: this.autoFilters, barsPerCycle: this.settings.barsPerCycle, locks: this.locks });
      } else if (this.autoBlend || this.autoFilters) {
        await this._sendCommand({ action: 'startAutoFX', autoBlend: this.autoBlend, autoFilters: this.autoFilters });
      }

      await this._saveState();
    } catch (e) {
      this.isActive = false;
      this._coreInjected = false;
      const toggle = document.getElementById('toggle');
      if (toggle) toggle.checked = false;
      console.warn('VJam FX: Failed to inject', e);
    } finally {
      this._busy = false;
      if (this._pendingStop) {
        this._pendingStop = false;
        this._stopAll();
      }
    }
  }

  async _stopAll() {
    if (this._busy) { this._pendingStop = true; return; }
    this._busy = true;
    try {
      await this._sendCommand({ action: 'stopVideoAudio' });
      chrome.runtime.sendMessage({ type: 'stopTabAudio', tabId: this._tabId }).catch(() => {});
      await this._sendCommand({ action: 'stop' });
      this.isActive = false;
      this._coreInjected = false;
      this._injectedPresets.clear();
      await this._saveState();
    } finally {
      this._busy = false;
    }
  }

  async _addLayer(presetId) {
    try {
      await this._injectCore();
      await this._injectPreset(presetId);
      await this._sendCommand({ action: 'addLayer', preset: presetId });
      await this._saveState();
    } catch (e) {
      console.warn('VJam FX: Failed to add layer', e);
    }
  }

  async _removeLayer(presetId) {
    await this._sendCommand({ action: 'removeLayer', preset: presetId });
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

// CTA rotation — show a different value prop each time popup opens
const _ctaMessages = [
  'Take it to a party → VJam Full (HDMI output)',
  '270+ presets with GLSL shaders → VJam Full',
  'Beat detection from mic → VJam Full',
  'Works offline on any device → VJam Full',
];

// Auto-init in popup context
if (typeof document !== 'undefined' && document.getElementById) {
  document.addEventListener('DOMContentLoaded', () => {
    const controller = new PopupController();
    controller.init();
    const ctaEl = document.getElementById('cta-text');
    if (ctaEl) ctaEl.textContent = _ctaMessages[Math.floor(Math.random() * _ctaMessages.length)];
  });
}
