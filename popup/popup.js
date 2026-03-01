/**
 * VJam FX — Popup Controller
 * Multi-layer presets, CSS filters, blend modes
 * Syncs state with Service Worker for navigation persistence
 */

import { PRESET_CATEGORIES, ALL_PRESETS } from './preset-catalog.js';


const FILTER_NAMES = ['invert', 'hue-rotate', 'grayscale', 'saturate', 'brightness', 'contrast', 'sepia', 'blur'];
const VALID_BLEND_MODES = ['screen', 'lighten', 'difference', 'exclusion', 'color-dodge'];

const DEFAULT_SETTINGS = {
  fadeDuration: 1.5,
  barsPerCycle: 4,
  sensitivity: 'mid',
  zoom: 1.0,
  osdEnabled: true,
};

const SENSITIVITY_MAP = { lo: 0.5, mid: 1.0, hi: 2.0 };

function logWarn(context, e) {
  console.warn('VJam FX [' + context + ']:', e && e.message ? e.message : e);
}

function _throttle(fn, ms) {
  let last = 0;
  let timer = null;
  return function(...args) {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn.apply(this, args);
    } else {
      clearTimeout(timer);
      timer = setTimeout(() => {
        last = Date.now();
        fn.apply(this, args);
      }, ms - (now - last));
    }
  };
}

class PopupController {
  constructor() {
    this.presets = ALL_PRESETS;
    this.activeLayers = new Set();  // preset IDs currently active
    this.activeFilters = new Set();
    this.selectedBlendMode = 'screen';
    this.opacity = 0.9;
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
      div.style.cssText = 'padding:20px;text-align:center;color:#bbb';
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
    } catch (e) { logWarn('syncState/scripting', e); }

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
      } catch (e) { logWarn('SW', e); }
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
    } catch (e) { logWarn('storage', e); }
    this._updateSettingsUI();
  }

  async _saveSettings() {
    try {
      await chrome.storage.local.set({ vjamfx_settings: this.settings });
    } catch (e) { logWarn('storage', e); }
  }

  async _loadScenes() {
    try {
      const result = await chrome.storage.local.get('vjamfx_scenes');
      if (result.vjamfx_scenes && Array.isArray(result.vjamfx_scenes)) {
        this.scenes = result.vjamfx_scenes;
      }
    } catch (e) { logWarn('storage', e); }
    this._updateSceneButtons();
  }

  async _saveScenes() {
    try {
      await chrome.storage.local.set({ vjamfx_scenes: this.scenes });
    } catch (e) { logWarn('storage', e); }
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
      autoCycleActive: this.autoCycleActive,
      autoBlend: this.autoBlend,
      autoFilters: this.autoFilters,
    };
    this._saveScenes();
  }

  async _loadScene(slot) {
    const scene = this.scenes[slot];
    if (!scene || this._busy) return;
    this._busy = true;
    try {
      // Ensure engine is running
      if (!this.isActive) {
        this.isActive = true;
        const toggle = document.getElementById('toggle');
        if (toggle) toggle.checked = true;
        await this._injectCore();
      }

      // Inject preset files first (separate executeScript calls per file)
      this.activeLayers.clear();
      for (const id of scene.layers) {
        this.activeLayers.add(id);
        await this._injectPreset(id);
      }

      // Build batch: kill + restore layers + filters + opacity + audio
      const sceneBatch = [{ action: 'kill' }];
      const layers = [...this.activeLayers];
      if (layers.length > 0) {
        sceneBatch.push({ action: 'start', preset: layers[0], blendMode: scene.blendMode || 'screen' });
        for (let i = 1; i < layers.length; i++) {
          sceneBatch.push({ action: 'addLayer', preset: layers[i] });
        }
      }

      // Restore blend, filters, opacity
      this.selectedBlendMode = scene.blendMode || 'screen';
      this.activeFilters.clear();
      if (scene.filters) {
        for (const f of scene.filters) {
          this.activeFilters.add(f);
          sceneBatch.push({ action: 'setFilter', filter: f, enabled: true });
        }
      }
      this.opacity = scene.opacity != null ? scene.opacity : 1.0;
      sceneBatch.push({ action: 'setOpacity', opacity: this.opacity });

      // Restore locks
      if (scene.locks) this.locks = { ...this.locks, ...scene.locks };

      // Restore Auto state
      this.autoCycleActive = !!scene.autoCycleActive;
      this.autoBlend = !!scene.autoBlend;
      this.autoFilters = !!scene.autoFilters;
      if (this.autoCycleActive) {
        await this._injectAllPresets();
        const allIds = this.presets.map(p => p.id);
        sceneBatch.push({ action: 'startAutoCycle', presets: allIds, interval: 8000, autoBlend: this.autoBlend, autoFilters: this.autoFilters, barsPerCycle: this.settings.barsPerCycle, locks: this.locks, skipFirstTick: true });
      }

      // Start audio if enabled
      if (this.audioEnabled) {
        sceneBatch.push({ action: 'startVideoAudio' });
      }

      await this._dispatch(sceneBatch);

      if (this.audioEnabled) {
        chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId }).catch(e => logWarn('loadScene/tabAudio', e));
      }

      this._updateUI();
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
    } catch (e) { logWarn('SW', e); }
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
          this._dispatch({ action: 'setFadeDuration', duration: this.settings.fadeDuration });
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
          this._dispatch({ action: 'startAutoCycle', presets: allIds, interval: 8000, autoBlend: this.autoBlend, autoFilters: this.autoFilters, barsPerCycle: this.settings.barsPerCycle, locks: this.locks });
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
          this._dispatch({ action: 'setAudioSensitivity', sensitivity: SENSITIVITY_MAP[this.settings.sensitivity] || 1.0 });
        }
      });
    }

    // Settings: Zoom
    const zoomEl = document.getElementById('setting-zoom');
    const zoomVal = document.getElementById('zoom-value');
    if (zoomEl) {
      const throttledZoom = _throttle((value) => {
        this.settings.zoom = value / 100;
        if (zoomVal) zoomVal.textContent = this.settings.zoom + 'x';
        if (this.isActive) {
          this._dispatch({ action: 'setZoom', zoom: this.settings.zoom });
        }
      }, 50);
      zoomEl.addEventListener('input', () => {
        throttledZoom(parseInt(zoomEl.value, 10));
      });
      zoomEl.addEventListener('change', () => {
        this.settings.zoom = parseInt(zoomEl.value, 10) / 100;
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
          this._dispatch({ action: 'setOsdEnabled', enabled: this.settings.osdEnabled });
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
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          const slot = parseInt(btn.dataset.slot, 10);
          if (this.scenes[slot] != null) {
            this._clearScene(slot);
          }
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

    // Text ON
    const btnTextOn = document.getElementById('btn-text-on');
    if (btnTextOn) {
      btnTextOn.addEventListener('click', async () => {
        if (this._busy) return;
        const textInput = document.getElementById('text-input');
        const text = textInput ? textInput.value.trim() : '';
        if (!text) return;
        this._busy = true;
        try {
          if (!this.isActive) {
            this.isActive = true;
            const toggle = document.getElementById('toggle');
            if (toggle) toggle.checked = true;
            await this._injectCore();
          }
          await this._dispatch({ action: 'textAutoStart', text: text });
          btnTextOn.classList.add('active');
          this.textState = { text, autoText: true };
        } finally {
          this._busy = false;
        }
      });
    }

    // Text OFF
    const btnTextOff = document.getElementById('btn-text-off');
    if (btnTextOff) {
      btnTextOff.addEventListener('click', async () => {
        if (this._busy) return;
        this._busy = true;
        try {
          await this._dispatch([{ action: 'textClear' }, { action: 'textAutoStop' }]);
          const btnOn = document.getElementById('btn-text-on');
          if (btnOn) btnOn.classList.remove('active');
          this.textState = null;
        } finally {
          this._busy = false;
        }
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
          this._dispatch({ action: 'stopAutoCycle' });
        }
        this._updateLayerCount();
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
          this._dispatch({ action: 'setBlendMode', blendMode: this.selectedBlendMode });
        }
      });
    }

    // Opacity slider (throttled input, save on change)
    const opacitySlider = document.getElementById('opacity-slider');
    if (opacitySlider) {
      const throttledOpacity = _throttle((value) => {
        this.opacity = value / 100;
        if (this.isActive) {
          this._dispatch({ action: 'setOpacity', opacity: this.opacity });
        }
      }, 50);
      opacitySlider.addEventListener('input', (e) => {
        throttledOpacity(parseInt(e.target.value, 10));
      });
      opacitySlider.addEventListener('change', () => {
        this.opacity = parseInt(opacitySlider.value, 10) / 100;
        this._dispatch({ action: 'setOpacity', opacity: this.opacity });
      });
    }

    // Audio toggle (tab audio capture ON/OFF)
    const audioBtn = document.getElementById('audio-toggle');
    if (audioBtn) {
      audioBtn.addEventListener('click', async () => {
        if (this._busy) return;
        this._busy = true;
        try {
          this.audioEnabled = !this.audioEnabled;
          audioBtn.textContent = this.audioEnabled ? 'ON' : 'OFF';
          audioBtn.classList.toggle('on', this.audioEnabled);

          if (this.audioEnabled) {
            const audioBatch = [{ action: 'startVideoAudio' }];
            if (this.isActive) audioBatch.push({ action: 'setAudioEnabled', enabled: true });
            await this._dispatch(audioBatch);
            chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId }).catch(e => logWarn('audio/startTab', e));
          } else {
            const audioBatch = [{ action: 'stopVideoAudio' }];
            if (this.isActive) audioBatch.push({ action: 'setAudioEnabled', enabled: false });
            await this._dispatch(audioBatch);
            chrome.runtime.sendMessage({ type: 'stopTabAudio', tabId: this._tabId }).catch(e => logWarn('audio/stopTab', e));
          }
        } finally {
          this._busy = false;
        }
      });
    }

    // Reset
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', async () => {
        if (this._busy) return;
        this._busy = true;
        try {
        // Dispatch all reset commands through SW
        await this._dispatch([
          { action: 'stopVideoAudio' },
          { action: 'kill' },
          { action: 'textAutoStop' },
          { action: 'textClear' },
          { action: 'setFadeDuration', duration: DEFAULT_SETTINGS.fadeDuration },
          { action: 'setZoom', zoom: 1.0 },
          { action: 'setOsdEnabled', enabled: true },
          { action: 'setAudioSensitivity', sensitivity: 1.0 },
          { action: 'stop' },
        ]);
        chrome.runtime.sendMessage({ type: 'stopTabAudio', tabId: this._tabId }).catch(e => logWarn('reset/tabAudio', e));
        this.textState = null;

        // Reset all state
        this.activeLayers.clear();
        this.activeFilters.clear();
        this.autoCycleActive = false;
        this.autoBlend = false;
        this.autoFilters = false;
        this.selectedBlendMode = 'screen';
        this.opacity = 0.9;
        this.audioEnabled = true;
        this.isActive = false;
        this._coreInjected = false;
        this._injectedPresets.clear();
        this.locks = { effect: false, blend: false, filter: false };

        // Reset settings to defaults
        this.settings = { ...DEFAULT_SETTINGS };
        await this._saveSettings();

        // Reset all UI
        const toggle = document.getElementById('toggle');
        if (toggle) toggle.checked = false;
        document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.blend-btn').forEach(btn => btn.classList.remove('active'));
        const opacitySlider = document.getElementById('opacity-slider');
        if (opacitySlider) opacitySlider.value = 90;
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
        const btnTextOn = document.getElementById('btn-text-on');
        if (btnTextOn) btnTextOn.classList.remove('active');
        // Reset settings UI
        this._updateSettingsUI();
        this._updateLayerCount();

        } finally {
          this._busy = false;
        }
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
          // Build batch: kill + new layers + filters + audio
          const nextBatch = [{ action: 'kill', locks: this.locks }];
          if (!this.locks.effect) {
            const count = 1 + Math.floor(Math.random() * Math.min(3, this.presets.length));
            const shuffled = this.presets.slice().sort(() => Math.random() - 0.5);
            const chosen = shuffled.slice(0, count);
            // Only inject chosen presets (not all 204)
            for (const p of chosen) {
              await this._injectPreset(p.id);
            }
            nextBatch.push({ action: 'start', preset: chosen[0].id, blendMode: this.selectedBlendMode });
            for (let i = 1; i < chosen.length; i++) {
              nextBatch.push({ action: 'addLayer', preset: chosen[i].id });
            }
            this.activeLayers.clear();
            for (const p of chosen) this.activeLayers.add(p.id);
          }
          if (!this.locks.filter) {
            for (const f of this.activeFilters) {
              nextBatch.push({ action: 'setFilter', filter: f, enabled: true });
            }
          }
          if (this.audioEnabled) {
            nextBatch.push({ action: 'startVideoAudio' });
          }
          await this._dispatch(nextBatch);
          if (this.audioEnabled) {
            chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId }).catch(e => logWarn('next/tabAudio', e));
          }
          document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => {
            cb.checked = this.activeLayers.has(cb.value);
          });
          this._updateLayerCount();
          if (this.autoCycleActive) {
            this.autoCycleActive = false;
            this.autoBlend = false;
            this.autoFilters = false;
            const autoBtn = document.getElementById('btn-auto-cycle');
            if (autoBtn) autoBtn.classList.remove('active');
            const abBtn = document.getElementById('auto-blend');
            if (abBtn) abBtn.classList.remove('active');
            const afBtn = document.getElementById('auto-filters');
            if (afBtn) afBtn.classList.remove('active');
          }
        } finally {
          this._busy = false;
        }
      });
    }

    // Auto-cycle
    const btnAutoCycle = document.getElementById('btn-auto-cycle');
    if (btnAutoCycle) {
      btnAutoCycle.addEventListener('click', async () => {
        if (this._busy) return;
        this._busy = true;
        try {
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
          // Stop standalone autoFX (auto-cycle handles blend/filter)
          await this._dispatch({ action: 'stopAutoFX' });
          if (!this.isActive) {
            const toggle = document.getElementById('toggle');
            if (toggle) toggle.checked = true;
            await this._startAll();
          }
          await this._injectAllPresets();
          const allIds = this.presets.map(p => p.id);
          await this._dispatch({ action: 'startAutoCycle', presets: allIds, interval: 8000, autoBlend: this.autoBlend, autoFilters: this.autoFilters, barsPerCycle: this.settings.barsPerCycle, locks: this.locks });
        } else {
          await this._dispatch({ action: 'stopAutoCycle' });
          // If blend/filter still on, start standalone autoFX
          if (this.autoBlend || this.autoFilters) {
            await this._dispatch({ action: 'startAutoFX', autoBlend: this.autoBlend, autoFilters: this.autoFilters });
          }
        }
        } finally {
          this._busy = false;
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
          this._dispatch({ action: 'toggleFilter', filter: filter });
        }
      });
    }

    // Auto-blend toggle
    const autoBlendBtn = document.getElementById('auto-blend');
    if (autoBlendBtn) {
      autoBlendBtn.addEventListener('click', async () => {
        this.autoBlend = !this.autoBlend;
        autoBlendBtn.classList.toggle('active', this.autoBlend);
        if (this.autoCycleActive) {
          await this._dispatch({ action: 'updateAutoCycleOptions', autoBlend: this.autoBlend, autoFilters: this.autoFilters, locks: this.locks });
        } else if (this.autoBlend || this.autoFilters) {
          await this._dispatch({ action: 'startAutoFX', autoBlend: this.autoBlend, autoFilters: this.autoFilters });
        } else {
          await this._dispatch({ action: 'stopAutoFX' });
        }
      });
    }

    // Auto-filters toggle
    const autoFiltersBtn = document.getElementById('auto-filters');
    if (autoFiltersBtn) {
      autoFiltersBtn.addEventListener('click', async () => {
        this.autoFilters = !this.autoFilters;
        autoFiltersBtn.classList.toggle('active', this.autoFilters);
        if (this.autoCycleActive) {
          await this._dispatch({ action: 'updateAutoCycleOptions', autoBlend: this.autoBlend, autoFilters: this.autoFilters, locks: this.locks });
        } else if (this.autoBlend || this.autoFilters) {
          await this._dispatch({ action: 'startAutoFX', autoBlend: this.autoBlend, autoFilters: this.autoFilters });
        } else {
          await this._dispatch({ action: 'stopAutoFX' });
        }
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

      // Build batch of all startup commands
      const batch = [];
      const first = layers[0];
      batch.push({ action: 'start', preset: first, blendMode: this.selectedBlendMode });
      for (let i = 1; i < layers.length; i++) {
        batch.push({ action: 'addLayer', preset: layers[i] });
      }
      for (const f of this.activeFilters) {
        batch.push({ action: 'setFilter', filter: f, enabled: true });
      }
      if (this.audioEnabled) {
        batch.push({ action: 'startVideoAudio' });
      }
      batch.push({ action: 'setFadeDuration', duration: this.settings.fadeDuration });
      batch.push({ action: 'setAudioSensitivity', sensitivity: SENSITIVITY_MAP[this.settings.sensitivity] || 1.0 });
      batch.push({ action: 'setZoom', zoom: this.settings.zoom });
      batch.push({ action: 'setOsdEnabled', enabled: this.settings.osdEnabled });
      batch.push({ action: 'setOpacity', opacity: this.opacity });
      await this._dispatch(batch);

      // Start tabCapture fallback (separate from dispatch — goes to SW directly)
      if (this.audioEnabled) {
        chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId }).catch(e => logWarn('startAll/tabAudio', e));
      }
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
      await this._dispatch([{ action: 'stopVideoAudio' }, { action: 'stop' }]);
      chrome.runtime.sendMessage({ type: 'stopTabAudio', tabId: this._tabId }).catch(e => logWarn('stopAll/tabAudio', e));
      this.isActive = false;
      this._coreInjected = false;
      this._injectedPresets.clear();
    } finally {
      this._busy = false;
    }
  }

  async _addLayer(presetId) {
    try {
      await this._injectCore();
      await this._injectPreset(presetId);
      await this._dispatch({ action: 'addLayer', preset: presetId });
    } catch (e) {
      console.warn('VJam FX: Failed to add layer', e);
    }
  }

  async _removeLayer(presetId) {
    await this._dispatch({ action: 'removeLayer', preset: presetId });
  }

  _showBanner(text, type = 'error') {
    const popup = document.querySelector('.popup');
    if (!popup) return;
    // Remove existing banner
    const old = popup.querySelector('.vjam-banner');
    if (old) old.remove();
    const banner = document.createElement('div');
    banner.className = 'vjam-banner';
    banner.style.cssText = 'padding:6px 10px;margin-bottom:8px;border-radius:4px;font-size:11px;text-align:center;' +
      (type === 'error' ? 'background:#441111;color:#ff6666;border:1px solid #663333;' : 'background:#114411;color:#66ff66;border:1px solid #336633;');
    banner.textContent = text;
    banner.setAttribute('role', 'alert');
    popup.insertBefore(banner, popup.firstChild);
    setTimeout(() => { if (banner.parentNode) banner.remove(); }, 3000);
  }

  /**
   * Dispatch actions through SW (single source of truth).
   * SW updates state, forwards to content, returns updated state.
   */
  async _dispatch(actions) {
    if (!this._tabId) return null;
    const arr = Array.isArray(actions) ? actions : [actions];
    if (arr.length === 0) return null;
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'command',
        tabId: this._tabId,
        actions: arr,
      });
      return response && response.state ? response.state : null;
    } catch (e) {
      logWarn('dispatch', e);
      this._showBanner('Effect command failed');
      return null;
    }
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
      logWarn('sendCommand', e);
      this._showBanner('Effect command failed');
    }
  }

  async _sendBatch(msgs) {
    if (!this._tabId || !msgs || msgs.length === 0) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        func: (messages) => {
          if (window._vjamFxEngine) {
            window._vjamFxEngine.handleBatch(messages);
          }
        },
        args: [msgs],
      });
    } catch (e) {
      logWarn('sendBatch', e);
      this._showBanner('Effect command failed');
    }
  }
}

export { PopupController, _throttle, logWarn };

// Auto-init in popup context
if (typeof document !== 'undefined' && document.getElementById) {
  document.addEventListener('DOMContentLoaded', () => {
    const controller = new PopupController();
    controller.init();
  });
}
