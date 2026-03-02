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

      // Video audio capture
      this._videoAudioMedia = null;
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

      // Text overlay
      this._textOverlay = null;

      // Settings
      this._fadeDuration = 1.5; // seconds for layer fade in/out
      this._audioSensitivity = 1.0; // multiplier for audio levels

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

    // --- Media Audio Capture (createMediaElementSource) ---

    _startVideoAudio() {
      // Already connected — just reconnect analyser
      if (this._videoAudioCtx && this._videoAudioSource) {
        if (this._videoAudioCtx.state === 'suspended') {
          this._videoAudioCtx.resume().catch(function() {});
        }
        if (this._videoAudioAnalyser) {
          // Already fully connected
          return;
        }
        // Recreate analyser and reconnect
        var analyserNode = this._videoAudioCtx.createAnalyser();
        analyserNode.fftSize = 2048;
        analyserNode.smoothingTimeConstant = 0;
        this._videoAudioSource.connect(analyserNode);
        this._videoAudioAnalyser = analyserNode;
        var binCount = analyserNode.frequencyBinCount;
        this._videoAudioFreqData = new Float32Array(binCount);
        this._videoAudioTimeData = new Float32Array(analyserNode.fftSize);
        return;
      }

      var media = document.querySelector('video, audio');
      if (media) {
        this._connectMediaElement(media);
      } else {
        // No media element yet — watch for one to appear
        // tabCapture fallback is started by popup directly (sendMessage to SW)
        this._startMediaObserver();
      }
    }

    _connectMediaElement(media) {
      this._stopMediaObserver();
      // Skip if already connected to this element
      if (this._videoAudioMedia === media && this._videoAudioCtx) return;
      this._videoAudioMedia = media;
      try {
        var ctx = new AudioContext();
        // AudioContext may be suspended due to autoplay policy
        if (ctx.state === 'suspended') {
          ctx.resume().catch(function() {});
        }
        var src = ctx.createMediaElementSource(media);
        var newAnalyser = ctx.createAnalyser();
        newAnalyser.fftSize = 2048;
        newAnalyser.smoothingTimeConstant = 0;
        src.connect(newAnalyser);
        src.connect(ctx.destination); // keep audio playing

        var binCount = newAnalyser.frequencyBinCount;
        var freqPerBin = ctx.sampleRate / newAnalyser.fftSize;
        this._videoAudioCtx = ctx;
        this._videoAudioSource = src;
        this._videoAudioAnalyser = newAnalyser;
        this._videoAudioFreqData = new Float32Array(binCount);
        this._videoAudioTimeData = new Float32Array(newAnalyser.fftSize);
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
        // Delay stopTabCapture — verify analyser produces non-silent data first
        // (createMediaElementSource can "succeed" but return silence due to CORS/MSE)
        var self = this;
        var checkCount = 0;
        if (self._silenceCheckTimer) clearInterval(self._silenceCheckTimer);
        var checkTimer = self._silenceCheckTimer = setInterval(function() {
          checkCount++;
          if (!self._videoAudioAnalyser) { clearInterval(checkTimer); return; }
          var testData = new Float32Array(self._videoAudioAnalyser.fftSize);
          self._videoAudioAnalyser.getFloatTimeDomainData(testData);
          var hasSignal = false;
          for (var i = 0; i < testData.length; i++) {
            if (testData[i] !== 0) { hasSignal = true; break; }
          }
          if (hasSignal) {
            // Real audio confirmed — stop tabCapture fallback
            window.postMessage({ source: 'vjam-fx-engine', type: 'stopTabCapture' }, '*');
            clearInterval(checkTimer);
          } else if (checkCount >= 10) {
            // 2 seconds of silence — CORS/MSE restriction likely, keep tabCapture
            // Disconnect our silent analyser so engine falls through to _externalAudioData
            if (self._videoAudioAnalyser) { self._videoAudioAnalyser.disconnect(); self._videoAudioAnalyser = null; }
            self._videoAudioFreqData = null;
            self._videoAudioTimeData = null;
            clearInterval(checkTimer);
          }
        }, 200);
      } catch (e) {
        // createMediaElementSource failed (e.g. already called on this element)
        // Do NOT stop tabCapture — let it continue as fallback audio source
        if (ctx && ctx.state !== 'closed') ctx.close().catch(function() {});
      }
    }

    _startMediaObserver() {
      if (this._mediaObserver) return;
      var self = this;
      this._mediaObserver = new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
          for (var j = 0; j < mutations[i].addedNodes.length; j++) {
            var node = mutations[i].addedNodes[j];
            if (node.nodeName === 'VIDEO' || node.nodeName === 'AUDIO') {
              self._connectMediaElement(node);
              return;
            }
            // Check children of added subtree
            if (node.querySelector) {
              var media = node.querySelector('video, audio');
              if (media) {
                self._connectMediaElement(media);
                return;
              }
            }
          }
        }
      });
      this._mediaObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    _stopMediaObserver() {
      if (this._mediaObserver) {
        this._mediaObserver.disconnect();
        this._mediaObserver = null;
      }
    }

    _stopVideoAudio() {
      // Disconnect analyser only — keep source→destination so audio keeps playing
      this._stopMediaObserver();
      if (this._silenceCheckTimer) { clearInterval(this._silenceCheckTimer); this._silenceCheckTimer = null; }
      // tabCapture stop is handled by popup (sendMessage to SW directly)
      if (this._videoAudioAnalyser) {
        this._videoAudioAnalyser.disconnect();
        this._videoAudioAnalyser = null;
      }
      this._videoAudioFreqData = null;
      this._videoAudioTimeData = null;
    }

    _destroyVideoAudio() {
      this._stopMediaObserver();
      if (this._silenceCheckTimer) { clearInterval(this._silenceCheckTimer); this._silenceCheckTimer = null; }
      // tabCapture stop is handled by popup (sendMessage to SW directly)
      if (this._videoAudioSource) { this._videoAudioSource.disconnect(); this._videoAudioSource = null; }
      if (this._videoAudioAnalyser) { this._videoAudioAnalyser.disconnect(); this._videoAudioAnalyser = null; }
      if (this._videoAudioCtx && this._videoAudioCtx.state !== 'closed') {
        this._videoAudioCtx.close().catch(function() {});
      }
      this._videoAudioCtx = null;
      this._videoAudioMedia = null;
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

      var sens = this._audioSensitivity;
      return { beat: beat, bpm: this._videoAudioTempo, strength: Math.min(1, strength * sens), rms: rms * sens, bass: Math.min(1, bass * sens), mid: Math.min(1, mid * sens), treble: Math.min(1, treble * sens) };
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
      const fadeSec = this._fadeDuration > 0 ? this._fadeDuration + 's' : '0s';
      layerDiv.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;transition:opacity ' + fadeSec + ' linear;';
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

    }

    _removeLayer(presetName) {
      const layer = this.activeLayers.get(presetName);
      if (!layer) return;

      this.activeLayers.delete(presetName);

      // Fade out then remove
      const container = layer.container;
      const fadeSec = this._fadeDuration > 0 ? this._fadeDuration : 0;
      if (fadeSec === 0) {
        layer.preset.destroy();
        container.remove();
        return;
      }
      container.style.transition = 'opacity ' + fadeSec + 's linear';
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
        if (self._videoAudioAnalyser && self._videoAudioTempo > 0) {
          bpm = self._videoAudioTempo;
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
        if (self._videoAudioAnalyser && self._videoAudioTempo > 0) {
          bpm = self._videoAudioTempo;
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
        case 'startAutoCycle':
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
          this._ensureTextOverlay();
          if (this._textOverlay) this._textOverlay.displayText(msg.text, msg.effect, msg.position);
          break;
        case 'textClear':
          if (this._textOverlay) this._textOverlay.clearAll();
          break;
        case 'textAutoStart':
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
