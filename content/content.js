/**
 * VJam FX — Content Script Engine
 * Injected into page's MAIN world via chrome.scripting.executeScript
 * Uses IIFE pattern (no ESM) for CSP compatibility
 *
 * Features:
 * - Multi-layer: multiple presets can run simultaneously
 * - CSS filters: invert, hue-rotate, grayscale, saturate, brightness, contrast, sepia, blur
 * - Blend modes: screen, lighten, difference, exclusion
 * - Tab audio capture for beat detection (via offscreen document)
 */
(function() {
  'use strict';

  // Guard against double-injection
  if (window._vjamFxEngine) return;

  const VALID_BLEND_MODES = ['screen', 'lighten', 'difference', 'exclusion'];

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

      // Video audio capture
      this._videoAudioCtx = null;
      this._videoAudioSource = null;
      this._videoAudioAnalyser = null;
      this._videoAudioFreqData = null;
      this._videoAudioTimeData = null;
      this._videoAudioBassLow = 0;
      this._videoAudioBassHigh = 0;
      this._videoAudioMidHigh = 0;
      this._videoAudioTrebleHigh = 0;
      this._videoAudioBassMax = 1e-6;
      this._videoAudioMidMax = 1e-6;
      this._videoAudioTrebleMax = 1e-6;
      this._videoAudioRmsHistory = [];
      this._videoAudioLastBeatTime = -1;
      this._videoAudioOnsetTimes = [];
      this._videoAudioTempo = 120;

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
    }

    // --- Video Audio Capture (createMediaElementSource) ---

    _startVideoAudio() {
      this._stopVideoAudio();
      var video = document.querySelector('video');
      if (!video) return;
      try {
        var ctx = new AudioContext();
        // AudioContext may be suspended due to autoplay policy
        if (ctx.state === 'suspended') {
          ctx.resume().catch(function() {});
        }
        var src = ctx.createMediaElementSource(video);
        var analyserNode = ctx.createAnalyser();
        analyserNode.fftSize = 2048;
        analyserNode.smoothingTimeConstant = 0;
        src.connect(analyserNode);
        src.connect(ctx.destination); // keep audio playing

        var binCount = analyserNode.frequencyBinCount;
        var freqPerBin = ctx.sampleRate / analyserNode.fftSize;
        this._videoAudioCtx = ctx;
        this._videoAudioSource = src;
        this._videoAudioAnalyser = analyserNode;
        this._videoAudioFreqData = new Float32Array(binCount);
        this._videoAudioTimeData = new Float32Array(analyserNode.fftSize);
        this._videoAudioBassLow = Math.min(Math.floor(20 / freqPerBin), binCount);
        this._videoAudioBassHigh = Math.min(Math.floor(250 / freqPerBin), binCount);
        this._videoAudioMidHigh = Math.min(Math.floor(4000 / freqPerBin), binCount);
        this._videoAudioTrebleHigh = Math.min(Math.floor(16000 / freqPerBin), binCount);
        this._videoAudioBassMax = 1e-6;
        this._videoAudioMidMax = 1e-6;
        this._videoAudioTrebleMax = 1e-6;
        this._videoAudioRmsHistory = [];
        this._videoAudioLastBeatTime = -1;
        this._videoAudioOnsetTimes = [];
        this._videoAudioTempo = 120;
      } catch (e) {
        // createMediaElementSource can only be called once per element
        this._stopVideoAudio();
      }
    }

    _stopVideoAudio() {
      if (this._videoAudioSource) { this._videoAudioSource.disconnect(); this._videoAudioSource = null; }
      if (this._videoAudioAnalyser) { this._videoAudioAnalyser.disconnect(); this._videoAudioAnalyser = null; }
      if (this._videoAudioCtx && this._videoAudioCtx.state !== 'closed') {
        this._videoAudioCtx.close().catch(function() {});
      }
      this._videoAudioCtx = null;
      this._videoAudioFreqData = null;
      this._videoAudioTimeData = null;
    }

    _readVideoAudioData() {
      if (!this._videoAudioAnalyser || !this._videoAudioTimeData) return null;

      var analyserNode = this._videoAudioAnalyser;
      var timeData = this._videoAudioTimeData;
      var freqData = this._videoAudioFreqData;

      analyserNode.getFloatTimeDomainData(timeData);
      analyserNode.getFloatFrequencyData(freqData);

      // RMS
      var sum = 0;
      for (var i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
      var rms = Math.sqrt(sum / timeData.length);

      // Frequency bands
      var DECAY = 0.995;
      var bassRaw = 0, midRaw = 0, trebleRaw = 0;
      for (var j = this._videoAudioBassLow; j < this._videoAudioBassHigh; j++) {
        bassRaw += Math.pow(10, freqData[j] / 20);
      }
      for (var k = this._videoAudioBassHigh; k < this._videoAudioMidHigh; k++) {
        midRaw += Math.pow(10, freqData[k] / 20);
      }
      for (var m = this._videoAudioMidHigh; m < this._videoAudioTrebleHigh; m++) {
        trebleRaw += Math.pow(10, freqData[m] / 20);
      }
      if (!isFinite(bassRaw)) bassRaw = 0;
      if (!isFinite(midRaw)) midRaw = 0;
      if (!isFinite(trebleRaw)) trebleRaw = 0;

      this._videoAudioBassMax *= DECAY;
      this._videoAudioMidMax *= DECAY;
      this._videoAudioTrebleMax *= DECAY;
      this._videoAudioBassMax = Math.max(this._videoAudioBassMax, bassRaw, 1e-6);
      this._videoAudioMidMax = Math.max(this._videoAudioMidMax, midRaw, 1e-6);
      this._videoAudioTrebleMax = Math.max(this._videoAudioTrebleMax, trebleRaw, 1e-6);

      var bass = bassRaw / this._videoAudioBassMax;
      var mid = midRaw / this._videoAudioMidMax;
      var treble = trebleRaw / this._videoAudioTrebleMax;

      // Beat detection: RMS spike
      var beat = false;
      var MIN_RMS_FOR_BEAT = 0.01;
      var SPIKE_RATIO = 1.3;
      var MIN_BEAT_INTERVAL = 0.25;
      var now = performance.now() / 1000;

      if (rms >= MIN_RMS_FOR_BEAT && this._videoAudioRmsHistory.length >= 3) {
        var avg = 0;
        for (var h = 0; h < this._videoAudioRmsHistory.length; h++) avg += this._videoAudioRmsHistory[h];
        avg /= this._videoAudioRmsHistory.length;
        if (avg > 0 && rms > avg * SPIKE_RATIO && now - this._videoAudioLastBeatTime >= MIN_BEAT_INTERVAL) {
          beat = true;
          this._videoAudioLastBeatTime = now;
          this._videoAudioOnsetTimes.push(now);
          if (this._videoAudioOnsetTimes.length > 100) this._videoAudioOnsetTimes.shift();
          var cutoff = now - 10;
          while (this._videoAudioOnsetTimes.length > 0 && this._videoAudioOnsetTimes[0] < cutoff) this._videoAudioOnsetTimes.shift();
          // BPM estimation
          if (this._videoAudioOnsetTimes.length >= 4) {
            var start = Math.max(0, this._videoAudioOnsetTimes.length - 10);
            var intervals = [];
            for (var t = start + 1; t < this._videoAudioOnsetTimes.length; t++) {
              var iv = this._videoAudioOnsetTimes[t] - this._videoAudioOnsetTimes[t - 1];
              if (iv > 0.25 && iv < 1.2) intervals.push(iv);
            }
            if (intervals.length > 0) {
              intervals.sort(function(a, b) { return a - b; });
              var midIdx = Math.floor(intervals.length / 2);
              var median = intervals.length % 2 === 0
                ? (intervals[midIdx - 1] + intervals[midIdx]) / 2
                : intervals[midIdx];
              var newTempo = 60 / median;
              this._videoAudioTempo = 0.7 * this._videoAudioTempo + 0.3 * newTempo;
              this._videoAudioTempo = Math.max(60, Math.min(180, this._videoAudioTempo));
            }
          }
        }
      }
      this._videoAudioRmsHistory.push(rms);
      if (this._videoAudioRmsHistory.length > 30) this._videoAudioRmsHistory.shift();

      var timeSinceBeat = now - this._videoAudioLastBeatTime;
      var strength = (rms >= MIN_RMS_FOR_BEAT && timeSinceBeat < 0.2) ? 1.0 - (timeSinceBeat / 0.2) : 0;

      return { beat: beat, bpm: this._videoAudioTempo, strength: strength, rms: rms, bass: bass, mid: mid, treble: treble };
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
      layerDiv.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;transition:opacity 0.8s ease-in;';
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
      container.style.transition = 'opacity 0.6s ease-out';
      container.style.opacity = '0';
      let cleaned = false;
      const onEnd = () => {
        if (cleaned) return;
        cleaned = true;
        layer.preset.destroy();
        container.remove();
      };
      container.addEventListener('transitionend', onEnd, { once: true });
      // Fallback: force remove after 800ms
      setTimeout(onEnd, 800);
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
          if (self._videoAudioAnalyser) {
            audioData = self._readVideoAudioData();
          } else if (self._externalAudioData) {
            audioData = self._externalAudioData;
            self._externalAudioData = null; // consume once
          }
        }
        if (audioData) {
          lastAudioTime = timestamp;
          for (const [, layer] of self.activeLayers) {
            layer.preset.updateAudio(audioData);
            if (audioData.beat) {
              layer.preset.onBeat(audioData.strength);
            }
          }
        }

        self._rafId = requestAnimationFrame(loop);
      };

      this._rafId = requestAnimationFrame(loop);
    }

    stop() {
      this.active = false;
      this._stopAutoCycle();

      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }

      // Destroy all layers
      for (const [name] of this.activeLayers) {
        const layer = this.activeLayers.get(name);
        layer.preset.destroy();
        layer.container.remove();
      }
      this.activeLayers.clear();

      this.currentPreset = null;
      this.currentPresetName = null;
    }

    destroy() {
      this._stopAutoCycle();
      this._stopVideoAudio();
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
    kill() {
      // Immediately destroy all layers (no fade)
      for (const [, layer] of this.activeLayers) {
        layer.preset.destroy();
        layer.container.remove();
      }
      this.activeLayers.clear();
      this.currentPreset = null;
      this.currentPresetName = null;
      this.clearFilters();
      this.setBlendMode('screen');
      this.setOpacity(1.0);
      this._stopAutoCycle();
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

      const self = this;
      const scheduleNext = () => {
        // Use BPM from external audio to set interval (or fallback to base interval)
        let interval = self._autoCycleBaseInterval;
        if (self._externalAudioData && self._externalAudioData.bpm > 0) {
          interval = (60 / self._externalAudioData.bpm) * 16 * 1000; // 16 beats in ms
          interval = Math.max(4000, Math.min(15000, interval)); // Clamp 4-15 seconds
        }
        self._autoCycleTimer = setTimeout(() => {
          self._autoCycleTick();
          scheduleNext();
        }, interval);
      };

      // Immediate first tick
      this._autoCycleTick();
      scheduleNext();
    }

    _autoCycleTick() {
      const presets = this._autoCyclePresets;
      if (!presets || presets.length === 0) return;

      // Choose 1-3 random layers
      const count = 1 + Math.floor(Math.random() * Math.min(3, presets.length));
      const shuffled = presets.slice().sort(() => Math.random() - 0.5);
      const chosen = shuffled.slice(0, count);

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

      // Auto-blend: randomize blend mode
      if (this._autoBlend) {
        const mode = VALID_BLEND_MODES[Math.floor(Math.random() * VALID_BLEND_MODES.length)];
        this.setBlendMode(mode);
      }

      // Auto-filters: randomize filters (each 30% chance)
      if (this._autoFilters) {
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

    // --- OSD Feedback ---

    showOSD(text) {
      if (!this.overlay) return;
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
          if (!this.activeLayers.has(msg.preset)) {
            this._addLayer(msg.preset);
          }
          break;
        case 'removeLayer':
          this._removeLayer(msg.preset);
          break;
        case 'toggleLayer':
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
          this.kill();
          break;
        case 'randomizeFX':
          this.randomizeFX({ skipBlend: !!msg.skipBlend });
          break;
        case 'startAutoCycle':
          this.startAutoCycle(msg.presets, msg.interval, { autoBlend: msg.autoBlend, autoFilters: msg.autoFilters });
          break;
        case 'stopAutoCycle':
          this._stopAutoCycle();
          break;
        case 'startVideoAudio':
          this._startVideoAudio();
          break;
        case 'stopVideoAudio':
          this._stopVideoAudio();
          break;
      }
    }
  }

  window._vjamFxEngine = new VJamFXEngine();
  window.VJamFXEngine = VJamFXEngine;
})();
