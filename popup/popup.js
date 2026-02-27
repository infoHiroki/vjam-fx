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
  { label: 'Image FX', presets: [
    { id: 'image-cycle', name: 'Image Cycle' },
    { id: 'image-glitch', name: 'Image Glitch' },
    { id: 'image-cyber', name: 'Image Cyber' },
  ]},
];

// Flat list for compatibility
const ALL_PRESETS = PRESET_CATEGORIES.flatMap(c => c.presets);

const FILTER_NAMES = ['invert', 'hue-rotate', 'grayscale', 'saturate', 'brightness', 'contrast', 'sepia', 'blur'];
const VALID_BLEND_MODES = ['screen', 'lighten', 'difference', 'exclusion', 'color-dodge'];

const DEFAULT_SETTINGS = {
  fadeDuration: 1.5,
  barsPerCycle: 16,
  sensitivity: 'mid',
  zoom: 1.0,
  osdEnabled: true,
};

const SENSITIVITY_MAP = { lo: 0.5, mid: 1.0, hi: 2.0 };

class PopupController {
  constructor() {
    this.presets = ALL_PRESETS;
    this.activeLayers = new Set();  // preset IDs currently active
    this.activeFilters = new Set();
    this.selectedBlendMode = 'screen';
    this.opacity = 1.0;
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
    await this._loadImages();
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
    if (autoBlendBtn) {
      autoBlendBtn.classList.toggle('active', this.autoBlend);
      autoBlendBtn.classList.toggle('disabled', !this.autoCycleActive);
    }
    const autoFiltersBtn = document.getElementById('auto-filters');
    if (autoFiltersBtn) {
      autoFiltersBtn.classList.toggle('active', this.autoFilters);
      autoFiltersBtn.classList.toggle('disabled', !this.autoCycleActive);
    }

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
      const btnTextOn = document.getElementById('btn-text-on');
      if (btnTextOn) btnTextOn.classList.toggle('active', !!this.textState.autoText);
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
      btn.classList.toggle('saved', this.scenes[slot] != null);
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
    if (!scene) return;

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

    // Start audio if enabled
    if (this.audioEnabled) {
      await this._sendCommand({ action: 'startVideoAudio' });
      chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId });
    }

    this._updateUI();
    this._saveState();
  }

  _clearScene(slot) {
    this.scenes[slot] = null;
    this._saveScenes();
  }

  async _loadImages() {
    try {
      const result = await chrome.storage.local.get('vjamfx_images');
      if (result.vjamfx_images && Array.isArray(result.vjamfx_images)) {
        this._imageDataUrls = result.vjamfx_images;
      }
    } catch (e) { /* storage not available */ }
    this._updateImageCount();
  }

  async _saveImages() {
    try {
      await chrome.storage.local.set({ vjamfx_images: this._imageDataUrls || [] });
    } catch (e) { /* storage not available */ }
  }

  _updateImageCount() {
    const el = document.getElementById('image-count');
    if (el) el.textContent = `${(this._imageDataUrls || []).length}/5`;
  }

  _readFileAsDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  _updateSettingsUI() {
    const fadeEl = document.getElementById('setting-fade');
    if (fadeEl) fadeEl.value = String(this.settings.fadeDuration);
    const cycleEl = document.getElementById('setting-cycle');
    if (cycleEl) cycleEl.value = String(this.settings.barsPerCycle);
    const sensEl = document.getElementById('setting-sensitivity');
    if (sensEl) sensEl.value = this.settings.sensitivity;
    const zoomEl = document.getElementById('setting-zoom');
    if (zoomEl) zoomEl.value = Math.round(this.settings.zoom * 100);
    const zoomVal = document.getElementById('zoom-value');
    if (zoomVal) zoomVal.textContent = this.settings.zoom + 'x';
    const osdBtn = document.getElementById('setting-osd');
    if (osdBtn) {
      osdBtn.textContent = this.settings.osdEnabled ? 'ON' : 'OFF';
      osdBtn.classList.toggle('on', this.settings.osdEnabled);
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
        this.settings.fadeDuration = parseFloat(fadeEl.value);
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
        this.settings.barsPerCycle = parseInt(cycleEl.value, 10);
        this._saveSettings();
        // Re-send auto-cycle with updated bars if active
        if (this.autoCycleActive) {
          const allIds = this.presets.map(p => p.id);
          this._sendCommand({ action: 'startAutoCycle', presets: allIds, interval: 8000, autoBlend: this.autoBlend, autoFilters: this.autoFilters, barsPerCycle: this.settings.barsPerCycle });
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

    // Settings: Zoom
    const zoomEl = document.getElementById('setting-zoom');
    const zoomVal = document.getElementById('zoom-value');
    if (zoomEl) {
      zoomEl.addEventListener('input', () => {
        this.settings.zoom = parseInt(zoomEl.value, 10) / 100;
        if (zoomVal) zoomVal.textContent = this.settings.zoom + 'x';
        if (this.isActive) {
          this._sendCommand({ action: 'setZoom', zoom: this.settings.zoom });
        }
      });
      zoomEl.addEventListener('change', () => {
        this._saveSettings();
      });
    }

    // Settings: OSD toggle
    const osdBtn = document.getElementById('setting-osd');
    if (osdBtn) {
      osdBtn.addEventListener('click', () => {
        this.settings.osdEnabled = !this.settings.osdEnabled;
        osdBtn.textContent = this.settings.osdEnabled ? 'ON' : 'OFF';
        osdBtn.classList.toggle('on', this.settings.osdEnabled);
        this._saveSettings();
        if (this.isActive) {
          this._sendCommand({ action: 'setOsdEnabled', enabled: this.settings.osdEnabled });
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

    // Text section toggle
    const textToggleBtn = document.getElementById('btn-text-toggle');
    const textSection = document.getElementById('text-section');
    if (textToggleBtn && textSection) {
      textToggleBtn.addEventListener('click', () => {
        const isOpen = textSection.style.display !== 'none';
        textSection.style.display = isOpen ? 'none' : '';
        textToggleBtn.textContent = isOpen ? '\u25BC' : '\u25B2';
      });
    }

    // Text ON
    const btnTextOn = document.getElementById('btn-text-on');
    if (btnTextOn) {
      btnTextOn.addEventListener('click', async () => {
        const textInput = document.getElementById('text-input');
        const text = textInput ? textInput.value.trim() : '';
        if (!text) return;
        if (!this.isActive) {
          this.isActive = true;
          const toggle = document.getElementById('toggle');
          if (toggle) toggle.checked = true;
          await this._injectCore();
        }
        await this._sendCommand({ action: 'textAutoStart', text: text });
        btnTextOn.classList.add('active');
        this.textState = { text, autoText: true };

        this._saveState();
      });
    }

    // Text OFF
    const btnTextOff = document.getElementById('btn-text-off');
    if (btnTextOff) {
      btnTextOff.addEventListener('click', async () => {
        await this._sendCommand({ action: 'textClear' });
        await this._sendCommand({ action: 'textAutoStop' });
        const btnOn = document.getElementById('btn-text-on');
        if (btnOn) btnOn.classList.remove('active');
        this.textState = null;

        this._saveState();
      });
    }

    // Images toggle
    const imagesToggleBtn = document.getElementById('btn-images-toggle');
    const imagesSection = document.getElementById('images-section');
    if (imagesToggleBtn && imagesSection) {
      imagesToggleBtn.addEventListener('click', () => {
        const isOpen = imagesSection.style.display !== 'none';
        imagesSection.style.display = isOpen ? 'none' : '';
        imagesToggleBtn.textContent = isOpen ? '\u25BC' : '\u25B2';
      });
    }

    // Image Upload
    const btnImageUpload = document.getElementById('btn-image-upload');
    const imageFile = document.getElementById('image-file');
    if (btnImageUpload && imageFile) {
      btnImageUpload.addEventListener('click', () => imageFile.click());
      imageFile.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        const existing = this._imageDataUrls || [];
        const remaining = 5 - existing.length;
        const toAdd = files.slice(0, remaining);
        for (const file of toAdd) {
          if (file.size > 1024 * 1024) continue; // 1MB max per image
          const dataUrl = await this._readFileAsDataUrl(file);
          if (dataUrl) existing.push(dataUrl);
        }
        this._imageDataUrls = existing.slice(0, 5);
        this._updateImageCount();
        this._saveImages();
        imageFile.value = '';
      });
    }

    // Image Apply
    const btnImageApply = document.getElementById('btn-image-apply');
    if (btnImageApply) {
      btnImageApply.addEventListener('click', async () => {
        if (!this._imageDataUrls || this._imageDataUrls.length === 0) return;
        const modeSelect = document.getElementById('image-mode');
        const mode = modeSelect ? modeSelect.value : 'image-cycle';
        // Ensure the image preset is active as a layer
        if (!this.activeLayers.has(mode)) {
          if (!this.isActive) {
            this.isActive = true;
            const toggle = document.getElementById('toggle');
            if (toggle) toggle.checked = true;
            await this._injectCore();
          }
          await this._injectPreset(mode);
          await this._sendCommand({ action: 'addLayer', preset: mode });
          this.activeLayers.add(mode);
          this._updateUI();
        }
        // Send images to the preset
        await this._sendCommand({ action: 'setPresetParam', preset: mode, key: 'localImages', value: this._imageDataUrls });
        this._saveState();
      });
    }

    // Image Clear
    const btnImageClear = document.getElementById('btn-image-clear');
    if (btnImageClear) {
      btnImageClear.addEventListener('click', async () => {
        this._imageDataUrls = [];
        this._updateImageCount();
        this._saveImages();
        // Remove all image presets from layers
        for (const id of ['image-cycle', 'image-glitch', 'image-cyber']) {
          if (this.activeLayers.has(id)) {
            await this._sendCommand({ action: 'removeLayer', preset: id });
            this.activeLayers.delete(id);
          }
        }
        this._updateUI();
        this._saveState();
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
          await this._sendCommand({ action: 'startVideoAudio' });
          chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId });
          if (this.isActive) {
            this._sendCommand({ action: 'setAudioEnabled', enabled: true });
          }
        } else {
          await this._sendCommand({ action: 'stopVideoAudio' });
          chrome.runtime.sendMessage({ type: 'stopTabAudio', tabId: this._tabId });
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
        await this._sendCommand({ action: 'stopVideoAudio' });
        chrome.runtime.sendMessage({ type: 'stopTabAudio', tabId: this._tabId });
        // Send kill with lock info so engine preserves locked state
        await this._sendCommand({ action: 'kill', locks: this.locks });
        if (!this.locks.effect) {
          this.activeLayers.clear();
        }
        if (!this.locks.filter) {
          this.activeFilters.clear();
        }
        this.autoCycleActive = false;
        this.autoBlend = false;
        this.autoFilters = false;
        if (!this.locks.blend) {
          this.selectedBlendMode = 'screen';
        }
        this.opacity = 1.0;
        this.audioEnabled = true;
        this.isActive = false;
        this._coreInjected = false;
        this._injectedPresets.clear();
        // Reset UI (respecting locks)
        const toggle = document.getElementById('toggle');
        if (toggle) toggle.checked = false;
        if (!this.locks.effect) {
          document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        }
        if (!this.locks.filter) {
          document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        }
        const opacitySlider = document.getElementById('opacity-slider');
        if (opacitySlider) opacitySlider.value = 100;
        const audioBtn = document.getElementById('audio-toggle');
        if (audioBtn) { audioBtn.textContent = 'ON'; audioBtn.classList.add('on'); }
        if (!this.locks.blend) {
          document.querySelectorAll('.blend-btn').forEach(btn => btn.classList.remove('active'));
        }
        const autoBtn = document.getElementById('btn-auto-cycle');
        if (autoBtn) autoBtn.classList.remove('active');
        const autoBlendBtn = document.getElementById('auto-blend');
        if (autoBlendBtn) { autoBlendBtn.classList.remove('active'); autoBlendBtn.classList.add('disabled'); }
        const autoFiltersBtn = document.getElementById('auto-filters');
        if (autoFiltersBtn) { autoFiltersBtn.classList.remove('active'); autoFiltersBtn.classList.add('disabled'); }
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
          await this._sendCommand({ action: 'stopAutoCycle' });
        }
        // Start video audio if needed
        if (this.audioEnabled) {
          await this._sendCommand({ action: 'startVideoAudio' });
          chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId });
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
        // Update auto-blend/filter button disabled state
        const autoBlendBtn = document.getElementById('auto-blend');
        if (autoBlendBtn) autoBlendBtn.classList.toggle('disabled', !this.autoCycleActive);
        const autoFiltersBtn = document.getElementById('auto-filters');
        if (autoFiltersBtn) autoFiltersBtn.classList.toggle('disabled', !this.autoCycleActive);
        if (this.autoCycleActive) {
          if (!this.isActive) {
            const toggle = document.getElementById('toggle');
            if (toggle) toggle.checked = true;
            await this._startAll();
          }
          await this._injectAllPresets();
          const allIds = this.presets.map(p => p.id);
          await this._sendCommand({ action: 'startAutoCycle', presets: allIds, interval: 8000, autoBlend: this.autoBlend, autoFilters: this.autoFilters, barsPerCycle: this.settings.barsPerCycle, locks: this.locks });
        } else {
          await this._sendCommand({ action: 'stopAutoCycle' });
        }
        this._saveState();
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

    // Auto-blend toggle
    const autoBlendBtn = document.getElementById('auto-blend');
    if (autoBlendBtn) {
      autoBlendBtn.addEventListener('click', async () => {
        if (!this.autoCycleActive) return;
        this.autoBlend = !this.autoBlend;
        autoBlendBtn.classList.toggle('active', this.autoBlend);
        // Re-send startAutoCycle with updated flags
        const allIds = this.presets.map(p => p.id);
        await this._sendCommand({ action: 'startAutoCycle', presets: allIds, interval: 8000, autoBlend: this.autoBlend, autoFilters: this.autoFilters, barsPerCycle: this.settings.barsPerCycle, locks: this.locks });
        this._saveState();
      });
    }

    // Auto-filters toggle
    const autoFiltersBtn = document.getElementById('auto-filters');
    if (autoFiltersBtn) {
      autoFiltersBtn.addEventListener('click', async () => {
        if (!this.autoCycleActive) return;
        this.autoFilters = !this.autoFilters;
        autoFiltersBtn.classList.toggle('active', this.autoFilters);
        // Re-send startAutoCycle with updated flags
        const allIds = this.presets.map(p => p.id);
        await this._sendCommand({ action: 'startAutoCycle', presets: allIds, interval: 8000, autoBlend: this.autoBlend, autoFilters: this.autoFilters, barsPerCycle: this.settings.barsPerCycle, locks: this.locks });
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
    for (const file of ['content/base-preset.js', 'content/text-overlay.js', 'content/image-effects.js', 'content/content.js']) {
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
        this._injectPreset(p.id).catch(() => {})
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
        chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId });
      }

      // Apply settings to engine
      await this._sendCommand({ action: 'setFadeDuration', duration: this.settings.fadeDuration });
      await this._sendCommand({ action: 'setAudioSensitivity', sensitivity: SENSITIVITY_MAP[this.settings.sensitivity] || 1.0 });
      await this._sendCommand({ action: 'setZoom', zoom: this.settings.zoom });
      await this._sendCommand({ action: 'setOsdEnabled', enabled: this.settings.osdEnabled });

      await this._saveState();
    } catch (e) {
      this.isActive = false;
      this._coreInjected = false;
      const toggle = document.getElementById('toggle');
      if (toggle) toggle.checked = false;
      console.warn('VJam FX: Failed to inject', e);
    } finally {
      this._busy = false;
    }
  }

  async _stopAll() {
    if (this._busy) return;
    this._busy = true;
    try {
    await this._sendCommand({ action: 'stopVideoAudio' });
    chrome.runtime.sendMessage({ type: 'stopTabAudio', tabId: this._tabId });
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
      this._saveState();
    } catch (e) {
      console.warn('VJam FX: Failed to add layer', e);
    }
  }

  async _removeLayer(presetId) {
    await this._sendCommand({ action: 'removeLayer', preset: presetId });
    this._saveState();
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
