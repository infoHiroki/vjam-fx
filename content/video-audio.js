/**
 * VJam FX — Video Audio Capture
 * Extracted from VJamFXEngine: createMediaElementSource audio capture,
 * frequency analysis, beat detection, BPM estimation.
 * IIFE pattern for CSP compatibility.
 */
(function() {
  'use strict';

  if (!window.VJamFX) window.VJamFX = {};
  if (window.VJamFX.VideoAudioCapture) return;

  function logWarn(context, e) {
    console.warn('VJam FX [' + context + ']:', e && e.message ? e.message : e);
  }

  class VideoAudioCapture {
    constructor() {
      this._media = null;
      this._ctx = null;
      this._source = null;
      this._analyser = null;
      this._freqData = null;
      this._timeData = null;
      this._bassLow = 0;
      this._bassHigh = 0;
      this._midHigh = 0;
      this._trebleHigh = 0;
      this._bassMax = 1e-6;
      this._midMax = 1e-6;
      this._trebleMax = 1e-6;
      this._rmsHistory = [];
      this._lastBeatTime = -1;
      this._onsetTimes = [];
      this._tempo = 120;
      this._silenceCheckTimer = null;
      this._mediaObserver = null;
    }

    /** True if analyser is connected and producing data */
    hasAnalyser() {
      return !!this._analyser;
    }

    /** Current estimated tempo (BPM) */
    getTempo() {
      return this._tempo;
    }

    start() {
      // Already connected — just reconnect analyser
      if (this._ctx && this._source) {
        if (this._ctx.state === 'suspended') {
          this._ctx.resume().catch(function(e) { logWarn('audioCtx', e); });
        }
        if (this._analyser) return;
        // Recreate analyser and reconnect
        var analyserNode = this._ctx.createAnalyser();
        analyserNode.fftSize = 2048;
        analyserNode.smoothingTimeConstant = 0;
        this._source.connect(analyserNode);
        this._analyser = analyserNode;
        var binCount = analyserNode.frequencyBinCount;
        this._freqData = new Float32Array(binCount);
        this._timeData = new Float32Array(analyserNode.fftSize);
        return;
      }

      var media = document.querySelector('video, audio');
      if (media) {
        this._connectMediaElement(media);
      } else {
        this._startMediaObserver();
      }
    }

    _connectMediaElement(media) {
      this._stopMediaObserver();
      if (this._media === media && this._ctx) return;
      this._media = media;
      var ctx;
      try {
        ctx = new AudioContext();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(function(e) { logWarn('audioCtx', e); });
        }
        var src = ctx.createMediaElementSource(media);
        var newAnalyser = ctx.createAnalyser();
        newAnalyser.fftSize = 2048;
        newAnalyser.smoothingTimeConstant = 0;
        src.connect(newAnalyser);
        src.connect(ctx.destination);

        var binCount = newAnalyser.frequencyBinCount;
        var freqPerBin = ctx.sampleRate / newAnalyser.fftSize;
        this._ctx = ctx;
        this._source = src;
        this._analyser = newAnalyser;
        this._freqData = new Float32Array(binCount);
        this._timeData = new Float32Array(newAnalyser.fftSize);
        this._bassLow = Math.min(Math.floor(20 / freqPerBin), binCount);
        this._bassHigh = Math.min(Math.floor(250 / freqPerBin), binCount);
        this._midHigh = Math.min(Math.floor(4000 / freqPerBin), binCount);
        this._trebleHigh = Math.min(Math.floor(16000 / freqPerBin), binCount);
        this._bassMax = 1e-6;
        this._midMax = 1e-6;
        this._trebleMax = 1e-6;
        this._rmsHistory = [];
        this._lastBeatTime = -1;
        this._onsetTimes = [];
        this._tempo = 120;

        var self = this;
        var checkCount = 0;
        if (self._silenceCheckTimer) clearInterval(self._silenceCheckTimer);
        var checkTimer = self._silenceCheckTimer = setInterval(function() {
          checkCount++;
          if (!self._analyser) { clearInterval(checkTimer); return; }
          var testData = new Float32Array(self._analyser.fftSize);
          self._analyser.getFloatTimeDomainData(testData);
          var hasSignal = false;
          for (var i = 0; i < testData.length; i++) {
            if (testData[i] !== 0) { hasSignal = true; break; }
          }
          if (hasSignal) {
            window.postMessage({ source: 'vjam-fx-engine', type: 'stopTabCapture' }, '*');
            clearInterval(checkTimer);
          } else if (checkCount >= 10) {
            if (self._analyser) { self._analyser.disconnect(); self._analyser = null; }
            self._freqData = null;
            self._timeData = null;
            clearInterval(checkTimer);
          }
        }, 200);
      } catch (e) {
        if (ctx && ctx.state !== 'closed') ctx.close().catch(function(e) { logWarn('audioCtx', e); });
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

    /** Disconnect analyser only — keep source→destination so audio keeps playing */
    stop() {
      this._stopMediaObserver();
      if (this._silenceCheckTimer) { clearInterval(this._silenceCheckTimer); this._silenceCheckTimer = null; }
      if (this._analyser) {
        this._analyser.disconnect();
        this._analyser = null;
      }
      this._freqData = null;
      this._timeData = null;
    }

    /** Full teardown: context, source, analyser */
    destroy() {
      this._stopMediaObserver();
      if (this._silenceCheckTimer) { clearInterval(this._silenceCheckTimer); this._silenceCheckTimer = null; }
      if (this._source) { this._source.disconnect(); this._source = null; }
      if (this._analyser) { this._analyser.disconnect(); this._analyser = null; }
      if (this._ctx && this._ctx.state !== 'closed') {
        this._ctx.close().catch(function(e) { logWarn('audioCtx', e); });
      }
      this._ctx = null;
      this._media = null;
      this._freqData = null;
      this._timeData = null;
    }

    /**
     * Read and analyze audio data.
     * @param {number} sensitivity - multiplier for audio levels (default 1.0)
     * @returns {object|null} { beat, bpm, strength, rms, bass, mid, treble }
     */
    readData(sensitivity) {
      if (!this._analyser || !this._timeData) return null;
      var sens = sensitivity || 1.0;

      var analyserNode = this._analyser;
      var timeData = this._timeData;
      var freqData = this._freqData;

      analyserNode.getFloatTimeDomainData(timeData);
      analyserNode.getFloatFrequencyData(freqData);

      // RMS
      var sum = 0;
      for (var i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
      var rms = Math.sqrt(sum / timeData.length);

      // Frequency bands
      var DECAY = 0.995;
      var bassRaw = 0, midRaw = 0, trebleRaw = 0;
      for (var j = this._bassLow; j < this._bassHigh; j++) {
        bassRaw += Math.pow(10, freqData[j] / 20);
      }
      for (var k = this._bassHigh; k < this._midHigh; k++) {
        midRaw += Math.pow(10, freqData[k] / 20);
      }
      for (var m = this._midHigh; m < this._trebleHigh; m++) {
        trebleRaw += Math.pow(10, freqData[m] / 20);
      }
      if (!isFinite(bassRaw)) bassRaw = 0;
      if (!isFinite(midRaw)) midRaw = 0;
      if (!isFinite(trebleRaw)) trebleRaw = 0;

      this._bassMax *= DECAY;
      this._midMax *= DECAY;
      this._trebleMax *= DECAY;
      this._bassMax = Math.max(this._bassMax, bassRaw, 1e-6);
      this._midMax = Math.max(this._midMax, midRaw, 1e-6);
      this._trebleMax = Math.max(this._trebleMax, trebleRaw, 1e-6);

      var bass = bassRaw / this._bassMax;
      var mid = midRaw / this._midMax;
      var treble = trebleRaw / this._trebleMax;

      // Beat detection: RMS spike
      var beat = false;
      var MIN_RMS_FOR_BEAT = 0.01;
      var SPIKE_RATIO = 1.3;
      var MIN_BEAT_INTERVAL = 0.25;
      var now = performance.now() / 1000;

      if (rms >= MIN_RMS_FOR_BEAT && this._rmsHistory.length >= 3) {
        var avg = 0;
        for (var h = 0; h < this._rmsHistory.length; h++) avg += this._rmsHistory[h];
        avg /= this._rmsHistory.length;
        if (avg > 0 && rms > avg * SPIKE_RATIO && now - this._lastBeatTime >= MIN_BEAT_INTERVAL) {
          beat = true;
          this._lastBeatTime = now;
          this._onsetTimes.push(now);
          if (this._onsetTimes.length > 100) this._onsetTimes.shift();
          var cutoff = now - 10;
          while (this._onsetTimes.length > 0 && this._onsetTimes[0] < cutoff) this._onsetTimes.shift();
          // BPM estimation
          if (this._onsetTimes.length >= 4) {
            var start = Math.max(0, this._onsetTimes.length - 10);
            var intervals = [];
            for (var t = start + 1; t < this._onsetTimes.length; t++) {
              var iv = this._onsetTimes[t] - this._onsetTimes[t - 1];
              if (iv > 0.25 && iv < 1.2) intervals.push(iv);
            }
            if (intervals.length > 0) {
              intervals.sort(function(a, b) { return a - b; });
              var midIdx = Math.floor(intervals.length / 2);
              var median = intervals.length % 2 === 0
                ? (intervals[midIdx - 1] + intervals[midIdx]) / 2
                : intervals[midIdx];
              var newTempo = 60 / median;
              this._tempo = 0.7 * this._tempo + 0.3 * newTempo;
              this._tempo = Math.max(60, Math.min(180, this._tempo));
            }
          }
        }
      }
      this._rmsHistory.push(rms);
      if (this._rmsHistory.length > 30) this._rmsHistory.shift();

      var timeSinceBeat = now - this._lastBeatTime;
      var strength = (rms >= MIN_RMS_FOR_BEAT && timeSinceBeat < 0.2) ? 1.0 - (timeSinceBeat / 0.2) : 0;

      return { beat: beat, bpm: this._tempo, strength: Math.min(1, strength * sens), rms: rms * sens, bass: Math.min(1, bass * sens), mid: Math.min(1, mid * sens), treble: Math.min(1, treble * sens) };
    }
  }

  window.VJamFX.VideoAudioCapture = VideoAudioCapture;
})();
