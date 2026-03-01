/**
 * VJam FX — Content Script Engine
 * Injected into page's MAIN world via chrome.scripting.executeScript
 * Uses IIFE pattern (no ESM) for CSP compatibility
 *
 * Features:
 * - Multi-layer: multiple presets can run simultaneously
 * - CSS filters: invert, hue-rotate, grayscale, saturate, brightness, contrast, sepia, blur
 * - Blend modes: screen, lighten, difference, exclusion
 * - Audio: createMediaElementSource (video/audio要素) → tabCapture fallback
 */
(function() {
  'use strict';

  // Guard against double-injection
  if (window._vjamFxEngine) return;

  function logWarn(context, e) {
    console.warn('VJam FX [' + context + ']:', e && e.message ? e.message : e);
  }

  const VALID_BLEND_MODES = ['screen', 'lighten', 'difference', 'exclusion', 'color-dodge'];

  const FILTER_VALUES = {
    'invert':     'invert(1)',
    'hue-rotate': 'hue-rotate(180deg)',
    'grayscale':  'grayscale(1)',
    'saturate':   'saturate(2.5)',
    'brightness': 'brightness(1.4)',
    'contrast':   'contrast(1.5)',
    'sepia':      'sepia(1)',
    'blur':       'blur(3px)',
  };

  function isLightPage() {
    const bg = getComputedStyle(document.body).backgroundColor;
    const m = bg.match(/\d+/g);
    if (!m) return true; // no bg = likely white
    return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255 > 0.5;
  }

  class VJamFXEngine {
    constructor() {
      this.active = false;
      this.blendMode = 'screen';
      this.opacity = 1.0;
      this.isLightPage = false;
      this.currentPreset = null;
      this.currentPresetName = null;
      this.overlay = null;
      this.audioEnabled = true;
      this._externalAudioData = null;
      this._rafId = null;

      // Multi-layer support
      this.activeLayers = new Map(); // name → { preset, container }
      this.activeFilters = new Set();
      this._osdEl = null;
      this._osdTimer = null;

      // Video audio capture (delegated to VideoAudioCapture)
      this._videoAudio = (window.VJamFX && window.VJamFX.VideoAudioCapture)
        ? new window.VJamFX.VideoAudioCapture()
        : null;

      // Text overlay
      this._textOverlay = null;

      // Settings
      this._fadeDuration = 1.5; // seconds for layer fade in/out
      this._audioSensitivity = 1.0; // multiplier for audio levels
      this._zoom = 1.0; // overlay scale
      this._osdEnabled = true;

      this._onBridgeMessage = null;
      this._onFullscreenChange = null;
      this._ensureListeners();
    }

    /**
     * Register bridge + fullscreen listeners if not already present.
     * Called from constructor and before starting presets (safety net after stop).
     */
    _ensureListeners() {
      if (!this._onBridgeMessage) {
        this._onBridgeMessage = (event) => {
          if (event.data && event.data.source === 'vjam-fx-bridge' && event.data.type === 'audioData') {
            this._externalAudioData = event.data.data;
          }
        };
        window.addEventListener('message', this._onBridgeMessage);
      }

      if (!this._onFullscreenChange) {
        this._onFullscreenChange = () => {
          if (!this.overlay) return;
          const fsEl = document.fullscreenElement;
          const targetParent = fsEl || document.body;
          // Re-attach overlay (may have been detached by requestFullscreen patch)
          if (!this.overlay.parentNode || this.overlay.parentNode !== targetParent) {
            targetParent.appendChild(this.overlay);
          }
        };
        document.addEventListener('fullscreenchange', this._onFullscreenChange);
      }

      if (!this._onBeforeUnload) {
        this._onBeforeUnload = () => { this.destroy(); };
        window.addEventListener('beforeunload', this._onBeforeUnload);
      }
    }

    // --- Media Audio Capture (delegated to VideoAudioCapture) ---

    _startVideoAudio() {
      if (this._videoAudio) this._videoAudio.start();
    }

    _stopVideoAudio() {
      if (this._videoAudio) this._videoAudio.stop();
    }

    _destroyVideoAudio() {
      if (this._videoAudio) this._videoAudio.destroy();
    }

    _readVideoAudioData() {
      if (!this._videoAudio) return null;
      return this._videoAudio.readData(this._audioSensitivity);
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

      // Auto-detect page brightness and switch blend mode
      this.isLightPage = isLightPage();
      if (this.isLightPage && this.blendMode === 'screen') {
        this.setBlendMode('difference');
      }

      return overlay;
    }

    setBlendMode(mode) {
      if (!VALID_BLEND_MODES.includes(mode)) return;
      this.blendMode = mode;
      if (this.overlay) {
        this.overlay.style.mixBlendMode = mode;
        const canvases = this.overlay.querySelectorAll('canvas');
        for (let i = 0; i < canvases.length; i++) {
          canvases[i].style.mixBlendMode = mode;
        }
      }
    }

    setOpacity(value) {
      this.opacity = Math.max(0, Math.min(1, value));
      if (this.overlay) {
        this.overlay.style.opacity = this.opacity;
      }
    }

    setZoom(value) {
      this._zoom = Math.max(0.5, Math.min(3, value));
      if (this.overlay) {
        this.overlay.style.transform = this._zoom === 1 ? '' : 'scale(' + this._zoom + ')';
      }
    }

    /**
     * Add/toggle a layer. If already active, remove it. If not, add it.
     */
    toggleLayer(presetName) {
      if (this.activeLayers.has(presetName)) {
        this._removeLayer(presetName);
      } else {
        this._addLayer(presetName);
      }
    }

    _addLayer(presetName) {
      if (typeof p5 !== 'function') {
        console.warn('VJam FX: p5 not loaded, cannot add layer', presetName);
        return;
      }
      if (!window.VJamFX || !window.VJamFX.presets[presetName]) return;

      this._ensureListeners();
      this.createOverlay();

      // Create a container div for this layer's canvas
      const layerDiv = document.createElement('div');
      layerDiv.setAttribute('data-vjam-layer', presetName);
      const fadeSec = this._fadeDuration > 0 ? this._fadeDuration + 's' : '0s';
      layerDiv.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;transition:opacity ' + fadeSec + ' ease-in;';
      this.overlay.appendChild(layerDiv);

      const PresetClass = window.VJamFX.presets[presetName];
      const preset = new PresetClass();
      preset.setup(layerDiv);

      // Apply blend mode to new canvas
      const canvas = layerDiv.querySelector('canvas');
      if (canvas) {
        canvas.style.mixBlendMode = this.blendMode;
      }

      this.activeLayers.set(presetName, { preset: preset, container: layerDiv });

      // Fade in on next frame
      requestAnimationFrame(() => { layerDiv.style.opacity = '1'; });

      this.showOSD('+ ' + presetName);
    }

    _removeLayer(presetName) {
      const layer = this.activeLayers.get(presetName);
      if (!layer) return;

      this.activeLayers.delete(presetName);
      this.showOSD('- ' + presetName);

      // Fade out then remove
      const container = layer.container;
      // Guard: if container is already detached, just destroy the preset
      if (!container.parentNode) {
        try { layer.preset.destroy(); } catch (e) { console.warn('VJam FX: destroy error', e); }
        return;
      }
      const fadeSec = this._fadeDuration > 0 ? this._fadeDuration : 0;
      if (fadeSec === 0) {
        layer.preset.destroy();
        container.remove();
        return;
      }
      container.style.transition = 'opacity ' + fadeSec + 's ease-out';
      container.style.opacity = '0';
      let cleaned = false;
      const onEnd = () => {
        if (cleaned) return;
        cleaned = true;
        try { layer.preset.destroy(); } catch (e) { console.warn('VJam FX: destroy error', e); }
        container.remove();
      };
      container.addEventListener('transitionend', onEnd, { once: true });
      // Fallback: force remove after fade + 200ms
      setTimeout(onEnd, (fadeSec * 1000) + 200);
    }

    /**
     * Start a single preset (legacy single-layer mode, also adds as a layer)
     */
    startPreset(presetName) {
      this._ensureListeners();
      this.createOverlay();

      // Stop current single preset if any
      if (this.currentPreset) {
        this._removeLayer(this.currentPresetName);
        this.currentPreset = null;
      }

      this.currentPresetName = presetName;
      this.active = true;

      // Add as layer
      this._addLayer(presetName);
      const layer = this.activeLayers.get(presetName);
      if (layer) {
        this.currentPreset = layer.preset;
      }

      this._startLoop();
    }

    _startLoop() {
      if (this._rafId) return;

      const self = this;
      let lastAudioTime = 0;
      const AUDIO_INTERVAL = 66; // ~15Hz audio update (sufficient for smoothed data)

      const loop = (timestamp) => {
        if (!self.active) {
          self._rafId = null;
          return;
        }

        // Feed audio to ALL active layers (throttled to 15Hz)
        // Priority: video audio (createMediaElementSource) → external bridge (offscreen)
        var audioData = null;
        if (self.audioEnabled && timestamp - lastAudioTime >= AUDIO_INTERVAL) {
          if (self._videoAudio && self._videoAudio.hasAnalyser()) {
            audioData = self._readVideoAudioData();
          } else if (self._externalAudioData) {
            audioData = self._externalAudioData;
            self._externalAudioData = null; // consume once
          }
        }
        if (audioData) {
          lastAudioTime = timestamp;
          for (const [, layer] of self.activeLayers) {
            if (typeof layer.preset.updateAudio === 'function') layer.preset.updateAudio(audioData);
            if (audioData.beat && typeof layer.preset.onBeat === 'function') {
              layer.preset.onBeat(audioData.strength);
            }
          }
          if (self._textOverlay) {
            self._textOverlay.updateAudio(audioData);
            if (audioData.beat) self._textOverlay.onBeat(audioData.strength);
          }
        }
        if (self._textOverlay) self._textOverlay.tick();

        self._rafId = requestAnimationFrame(loop);
      };

      this._rafId = requestAnimationFrame(loop);
    }

    stop() {
      this.active = false;
      this._stopAutoCycle();
      this._stopAutoFX();

      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }

      // Clear OSD timer and element
      if (this._osdTimer) {
        clearTimeout(this._osdTimer);
        this._osdTimer = null;
      }
      if (this._osdEl) {
        this._osdEl.remove();
        this._osdEl = null;
      }

      // Destroy all layers
      for (const [, layer] of this.activeLayers) {
        layer.preset.destroy();
        layer.container.remove();
      }
      this.activeLayers.clear();

      this.currentPreset = null;
      this.currentPresetName = null;
    }

    destroy() {
      this._stopAutoCycle();
      this._destroyVideoAudio();
      if (this._textOverlay) { this._textOverlay.destroy(); this._textOverlay = null; }
      this.stop();

      if (this.overlay) {
        this.overlay.remove();
        this.overlay = null;
      }

      if (this._onBridgeMessage) {
        window.removeEventListener('message', this._onBridgeMessage);
        this._onBridgeMessage = null;
      }

      if (this._onFullscreenChange) {
        document.removeEventListener('fullscreenchange', this._onFullscreenChange);
        this._onFullscreenChange = null;
      }

      if (this._onBeforeUnload) {
        window.removeEventListener('beforeunload', this._onBeforeUnload);
        this._onBeforeUnload = null;
      }

      this._externalAudioData = null;
      this.activeFilters.clear();
    }

    // --- CSS Filters ---

    setFilter(name, enabled) {
      if (!FILTER_VALUES[name]) return;
      if (enabled) {
        this.activeFilters.add(name);
      } else {
        this.activeFilters.delete(name);
      }
      this._applyFilters();
    }

    toggleFilter(name) {
      if (!FILTER_VALUES[name]) return;
      if (this.activeFilters.has(name)) {
        this.activeFilters.delete(name);
      } else {
        this.activeFilters.add(name);
      }
      this._applyFilters();
    }

    clearFilters() {
      this.activeFilters.clear();
      this._applyFilters();
    }

    _applyFilters() {
      if (!this.overlay) return;
      const css = [...this.activeFilters].map(f => FILTER_VALUES[f]).filter(Boolean).join(' ') || 'none';
      this.overlay.style.filter = css;
    }

    /**
     * Kill all layers but keep engine alive (quick reset)
     */
    kill(options) {
      var locks = (options && options.locks) || {};
      // Immediately destroy all layers (no fade) unless effect locked
      if (!locks.effect) {
        for (const [, layer] of this.activeLayers) {
          layer.preset.destroy();
          layer.container.remove();
        }
        this.activeLayers.clear();
        this.currentPreset = null;
        this.currentPresetName = null;
      }
      if (!locks.filter) {
        this.clearFilters();
      }
      if (!locks.blend) {
        this.setBlendMode('screen');
      }
      this.setOpacity(1.0);
      this._stopAutoCycle();
      this._stopAutoFX();
      this.showOSD('RESET');
    }

    /**
     * Randomize blend mode + filters
     */
    randomizeFX(options) {
      const skipBlend = options && options.skipBlend;

      // Random blend mode (unless skipped)
      if (!skipBlend) {
        const mode = VALID_BLEND_MODES[Math.floor(Math.random() * VALID_BLEND_MODES.length)];
        this.setBlendMode(mode);
      }

      // Random filters (each 30% chance)
      this.activeFilters.clear();
      const filterNames = Object.keys(FILTER_VALUES);
      for (let i = 0; i < filterNames.length; i++) {
        if (Math.random() < 0.3) {
          this.activeFilters.add(filterNames[i]);
        }
      }
      this._applyFilters();

      const filterList = [...this.activeFilters].join(', ') || 'none';
      this.showOSD(this.blendMode + ' | ' + filterList);
    }

    // --- Auto-Cycle ---

    startAutoCycle(presetNames, intervalMs, options) {
      this._stopAutoCycle();
      if (!presetNames || presetNames.length === 0) return;

      this._autoCyclePresets = presetNames;
      this._autoCycleBaseInterval = intervalMs || 8000;
      this._autoBlend = !!(options && options.autoBlend);
      this._autoFilters = !!(options && options.autoFilters);
      this._barsPerCycle = (options && options.barsPerCycle) || 4;
      this._autoCycleLocks = (options && options.locks) || {};

      const self = this;
      const scheduleNext = () => {
        // Use BPM from audio to set interval (or fallback to base interval)
        // Priority: video audio tempo → external bridge data
        let interval = self._autoCycleBaseInterval;
        let bpm = 0;
        if (self._videoAudio && self._videoAudio.hasAnalyser() && self._videoAudio.getTempo() > 0) {
          bpm = self._videoAudio.getTempo();
        } else if (self._externalAudioData && self._externalAudioData.bpm > 0) {
          bpm = self._externalAudioData.bpm;
        }
        if (bpm > 0) {
          interval = (60 / bpm) * (self._barsPerCycle || 4) * 1000; // beats in ms
          interval = Math.max(4000, Math.min(15000, interval)); // Clamp 4-15 seconds
        }
        self._autoCycleTimer = setTimeout(() => {
          self._autoCycleTick();
          scheduleNext();
        }, interval);
      };

      // Skip first tick when only updating options (e.g. toggling Auto Blend/Filter)
      if (!(options && options.skipFirstTick)) {
        this._autoCycleTick();
      }
      scheduleNext();
    }

    updateAutoCycleOptions(options) {
      if (!this._autoCyclePresets) return;
      if (options.autoBlend !== undefined) this._autoBlend = !!options.autoBlend;
      if (options.autoFilters !== undefined) this._autoFilters = !!options.autoFilters;
      if (options.locks !== undefined) this._autoCycleLocks = options.locks;
    }

    _autoCycleTick() {
      const presets = this._autoCyclePresets;
      if (!presets || presets.length === 0) return;
      const locks = this._autoCycleLocks || {};

      // Choose 1-3 random layers (unless effect locked)
      let chosen;
      if (locks.effect) {
        chosen = [...this.activeLayers.keys()];
        if (chosen.length === 0) {
          // Fallback: pick random if nothing active
          chosen = [presets[Math.floor(Math.random() * presets.length)]];
        }
      } else {
        const count = 1 + Math.floor(Math.random() * Math.min(3, presets.length));
        const shuffled = presets.slice().sort(() => Math.random() - 0.5);
        chosen = shuffled.slice(0, count);

        // Remove layers not in chosen set
        for (const name of this.activeLayers.keys()) {
          if (!chosen.includes(name)) {
            this._removeLayer(name);
          }
        }

        // Add missing layers
        for (const name of chosen) {
          if (!this.activeLayers.has(name)) {
            this._addLayer(name);
          }
        }
      }

      // Auto-blend: randomize blend mode (unless blend locked)
      if (this._autoBlend && !locks.blend) {
        const mode = VALID_BLEND_MODES[Math.floor(Math.random() * VALID_BLEND_MODES.length)];
        this.setBlendMode(mode);
      }

      // Auto-filters: randomize filters (unless filter locked)
      if (this._autoFilters && !locks.filter) {
        this.activeFilters.clear();
        const filterNames = Object.keys(FILTER_VALUES);
        for (let i = 0; i < filterNames.length; i++) {
          if (Math.random() < 0.3) {
            this.activeFilters.add(filterNames[i]);
          }
        }
        this._applyFilters();
      }

      // OSD shows active layers
      const names = chosen.join(' + ');
      this.showOSD('Auto: ' + names);
    }

    _stopAutoCycle() {
      if (this._autoCycleTimer) {
        clearTimeout(this._autoCycleTimer);
        this._autoCycleTimer = null;
      }
    }

    // --- Standalone Auto Blend/Filter (without preset Auto-Cycle) ---

    startAutoFX(options) {
      this._stopAutoFX();
      this._autoFXBlend = !!(options && options.autoBlend);
      this._autoFXFilters = !!(options && options.autoFilters);
      if (!this._autoFXBlend && !this._autoFXFilters) return;

      const self = this;
      const scheduleNext = () => {
        let interval = 8000;
        let bpm = 0;
        if (self._videoAudio && self._videoAudio.hasAnalyser() && self._videoAudio.getTempo() > 0) {
          bpm = self._videoAudio.getTempo();
        } else if (self._externalAudioData && self._externalAudioData.bpm > 0) {
          bpm = self._externalAudioData.bpm;
        }
        if (bpm > 0) {
          interval = (60 / bpm) * 4 * 1000;
          interval = Math.max(4000, Math.min(15000, interval));
        }
        self._autoFXTimer = setTimeout(() => {
          self._autoFXTick();
          scheduleNext();
        }, interval);
      };
      scheduleNext();
    }

    _autoFXTick() {
      if (this._autoFXBlend) {
        const mode = VALID_BLEND_MODES[Math.floor(Math.random() * VALID_BLEND_MODES.length)];
        this.setBlendMode(mode);
      }
      if (this._autoFXFilters) {
        this.activeFilters.clear();
        const filterNames = Object.keys(FILTER_VALUES);
        for (let i = 0; i < filterNames.length; i++) {
          if (Math.random() < 0.3) {
            this.activeFilters.add(filterNames[i]);
          }
        }
        this._applyFilters();
      }
    }

    _stopAutoFX() {
      if (this._autoFXTimer) {
        clearTimeout(this._autoFXTimer);
        this._autoFXTimer = null;
      }
    }

    // --- OSD Feedback ---

    showOSD(text) {
      if (!this.overlay || !this._osdEnabled) return;
      if (!this._osdEl) {
        this._osdEl = document.createElement('div');
        this._osdEl.style.cssText = [
          'position:absolute', 'bottom:20px', 'left:50%', 'transform:translateX(-50%)',
          'background:rgba(0,0,0,0.7)', 'color:#fff', 'padding:6px 16px',
          'border-radius:4px', 'font:13px/1.4 -apple-system,sans-serif',
          'white-space:nowrap', 'pointer-events:none', 'z-index:1',
          'transition:opacity 0.3s', 'opacity:0',
        ].join(';');
        this.overlay.appendChild(this._osdEl);
      }
      this._osdEl.textContent = text;
      this._osdEl.style.opacity = '1';
      clearTimeout(this._osdTimer);
      this._osdTimer = setTimeout(() => {
        if (this._osdEl) this._osdEl.style.opacity = '0';
      }, 2000);
    }

    getActiveLayerNames() {
      return [...this.activeLayers.keys()];
    }

    handleMessage(msg) {
      if (!msg || typeof msg.action !== 'string') return;
      switch (msg.action) {
        case 'start':
          this.startPreset(msg.preset);
          if (msg.blendMode) this.setBlendMode(msg.blendMode);
          break;
        case 'stop':
          this.stop();
          if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
          }
          this.activeFilters.clear();
          break;
        case 'switchPreset':
          this.startPreset(msg.preset);
          break;
        case 'setBlendMode':
          this.setBlendMode(msg.blendMode);
          break;
        case 'setOpacity':
          this.setOpacity(msg.opacity);
          break;
        case 'setAudioEnabled':
          this.audioEnabled = !!msg.enabled;
          if (!this.audioEnabled) this._externalAudioData = null;
          break;
        case 'addLayer':
          if (typeof msg.preset !== 'string') break;
          if (!this.activeLayers.has(msg.preset)) {
            this._addLayer(msg.preset);
          }
          break;
        case 'removeLayer':
          if (typeof msg.preset !== 'string') break;
          this._removeLayer(msg.preset);
          break;
        case 'toggleLayer':
          if (typeof msg.preset !== 'string') break;
          this.toggleLayer(msg.preset);
          break;
        case 'setFilter':
          this.setFilter(msg.filter, msg.enabled);
          break;
        case 'toggleFilter':
          this.toggleFilter(msg.filter);
          break;
        case 'clearFilters':
          this.clearFilters();
          break;
        case 'kill':
          this.kill({ locks: msg.locks });
          break;
        case 'randomizeFX':
          this.randomizeFX({ skipBlend: !!msg.skipBlend });
          break;
        case 'setFadeDuration':
          this._fadeDuration = msg.duration != null ? msg.duration : 1.5;
          break;
        case 'setAudioSensitivity':
          this._audioSensitivity = msg.sensitivity != null ? msg.sensitivity : 1.0;
          break;
        case 'setZoom':
          this.setZoom(msg.zoom != null ? msg.zoom : 1.0);
          break;
        case 'setOsdEnabled':
          this._osdEnabled = msg.enabled !== false;
          break;
        case 'startAutoCycle':
          if (!Array.isArray(msg.presets)) break;
          this.startAutoCycle(msg.presets, msg.interval, { autoBlend: msg.autoBlend, autoFilters: msg.autoFilters, barsPerCycle: msg.barsPerCycle, locks: msg.locks, skipFirstTick: msg.skipFirstTick });
          break;
        case 'stopAutoCycle':
          this._stopAutoCycle();
          break;
        case 'updateAutoCycleOptions':
          this.updateAutoCycleOptions({ autoBlend: msg.autoBlend, autoFilters: msg.autoFilters, locks: msg.locks });
          break;
        case 'startAutoFX':
          this.startAutoFX({ autoBlend: msg.autoBlend, autoFilters: msg.autoFilters });
          break;
        case 'stopAutoFX':
          this._stopAutoFX();
          break;
        case 'startVideoAudio':
          this._startVideoAudio();
          break;
        case 'stopVideoAudio':
          this._stopVideoAudio();
          break;
        case 'textSetParams':
          this._ensureTextOverlay();
          if (this._textOverlay) this._textOverlay.setParams(msg.params || {});
          break;
        case 'textDisplay':
          if (typeof msg.text !== 'string' || msg.text.length > 200) break;
          this._ensureTextOverlay();
          if (this._textOverlay) this._textOverlay.displayText(msg.text, msg.effect, msg.position);
          break;
        case 'textClear':
          if (this._textOverlay) this._textOverlay.clearAll();
          break;
        case 'textAutoStart':
          if (typeof msg.text !== 'string' || msg.text.length > 200) break;
          this._ensureTextOverlay();
          if (this._textOverlay) this._textOverlay.startAutoText(msg.text);
          break;
        case 'textAutoStop':
          if (this._textOverlay) this._textOverlay.stopAutoText();
          break;
        case 'setPresetParam': {
          const layer = this.activeLayers.get(msg.preset);
          if (layer && layer.preset && typeof layer.preset.setParam === 'function') {
            layer.preset.setParam(msg.key, msg.value);
          }
          break;
        }
      }
    }

    handleBatch(messages) {
      if (!Array.isArray(messages)) return;
      for (let i = 0; i < messages.length; i++) {
        this.handleMessage(messages[i]);
      }
    }

    _ensureTextOverlay() {
      if (this._textOverlay) return;
      if (!window.VJamFX || !window.VJamFX.TextOverlay) return;
      this.createOverlay();
      this._textOverlay = new window.VJamFX.TextOverlay(this.overlay);
      this._textOverlay.init();
    }
  }

  window._vjamFxEngine = new VJamFXEngine();
  window.VJamFXEngine = VJamFXEngine;
})();
