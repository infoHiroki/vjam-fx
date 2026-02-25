/**
 * AudioAnalyzer -- Web Audio API audio analysis
 * Outputs { beat, bpm, strength, rms, bass, mid, treble }
 */

class AudioAnalyzer {
  constructor() {
    this._ctx = null;
    this._stream = null;
    this._source = null;
    this._analyser = null;
    this._freqData = null;
    this._timeData = null;
    this._started = false;

    // Frequency band boundaries (cached in start())
    this._bassLow = 0;
    this._bassHigh = 0;
    this._midHigh = 0;
    this._trebleHigh = 0;

    // Running max normalization (decay 0.995)
    this._bassMax = 1e-6;
    this._midMax = 1e-6;
    this._trebleMax = 1e-6;
    this._decay = 0.995;

    // RMS spike detection (fast path)
    this._rmsHistory = [];
    this._rmsHistoryMax = 30;
    this._spikeRatio = 1.3;

    // Spectral flux detection (fast path)
    this._prevSpectrum = null;
    this._fluxHistory = [];
    this._fluxHistoryMax = 30;
    this._fluxRatio = 1.4;

    // Bass onset detection
    this._bassHistory = [];
    this._bassHistoryMax = 30;
    this._bassRatio = 1.2;

    // Reusable buffer for spectral flux (avoid per-frame allocation)
    this._spectrum = null;

    // Beat timing
    this._lastBeatTime = -1;
    this._minBeatInterval = 0.25; // 240 BPM upper limit
    this._minRmsForBeat = 0.01; // Minimum RMS to consider beat (noise gate)

    // BPM estimation from onset intervals
    this._onsetTimes = [];
    this._onsetTimesMax = 100;
    this._tempo = 120;
    this._tempoSmooth = 0.7; // EMA weight for old value
  }

  /**
   * Start microphone capture. Must be called from user gesture.
   * @returns {Promise<boolean>} true if started successfully
   */
  async start() {
    if (this._started) return true;

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this._stream = stream;
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._source = this._ctx.createMediaStreamSource(stream);
      this._analyser = this._ctx.createAnalyser();
      this._analyser.fftSize = 2048;
      this._analyser.smoothingTimeConstant = 0;
      this._source.connect(this._analyser);

      const binCount = this._analyser.frequencyBinCount; // 1024
      this._freqData = new Float32Array(binCount);
      this._timeData = new Float32Array(this._analyser.fftSize);

      // Cache frequency band boundaries (constant for lifetime)
      const freqPerBin = this._ctx.sampleRate / this._analyser.fftSize;
      this._bassLow = Math.min(Math.floor(20 / freqPerBin), binCount);
      this._bassHigh = Math.min(Math.floor(250 / freqPerBin), binCount);
      this._midHigh = Math.min(Math.floor(4000 / freqPerBin), binCount);
      this._trebleHigh = Math.min(Math.floor(16000 / freqPerBin), binCount);

      this._started = true;
      return true;
    } catch (e) {
      console.warn('AudioAnalyzer: microphone access denied or unavailable', e);
      // Cleanup on partial failure
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (this._source) this._source.disconnect();
      if (this._ctx && this._ctx.state !== 'closed') this._ctx.close();
      this._stream = null;
      this._source = null;
      this._ctx = null;
      return false;
    }
  }

  /** Resume AudioContext (call from user gesture if suspended) */
  resume() {
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
  }

  /** @returns {boolean} */
  get started() { return this._started; }

  /**
   * Get current audio analysis data.
   * Call this every frame from RAF loop.
   * @returns {{ beat: boolean, bpm: number, strength: number, rms: number, bass: number, mid: number, treble: number }}
   */
  getAudioData() {
    if (!this._started) {
      return { beat: false, bpm: this._tempo, strength: 0, rms: 0, bass: 0, mid: 0, treble: 0 };
    }

    const analyser = this._analyser;

    // Get time-domain data for RMS
    analyser.getFloatTimeDomainData(this._timeData);
    const rms = this._computeRms(this._timeData);

    // Get frequency data for bands + spectral flux
    analyser.getFloatFrequencyData(this._freqData);

    // Frequency bands
    const { bass, mid, treble, bassRaw } = this._computeFrequencyBands();

    // Beat detection (RMS spike + spectral flux + bass onset) -- noise gate
    const beat = rms >= this._minRmsForBeat ? this._detectBeat(rms, bassRaw) : false;

    // Beat strength (decays over 200ms)
    const now = performance.now() / 1000;
    const timeSinceBeat = now - this._lastBeatTime;
    const strength = (rms >= this._minRmsForBeat && timeSinceBeat < 0.2) ? 1.0 - (timeSinceBeat / 0.2) : 0;

    return { beat, bpm: this._tempo, strength, rms, bass, mid, treble };
  }

  // --- Private ---

  _computeRms(timeData) {
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      sum += timeData[i] * timeData[i];
    }
    return Math.sqrt(sum / timeData.length);
  }

  _computeFrequencyBands() {
    const freqData = this._freqData;
    const { _bassLow: bassLow, _bassHigh: bassHigh, _midHigh: midHigh, _trebleHigh: trebleHigh } = this;

    // freqData is in dB, convert to linear magnitude then sum
    let bassRaw = 0, midRaw = 0, trebleRaw = 0;
    for (let i = bassLow; i < bassHigh; i++) {
      bassRaw += Math.pow(10, freqData[i] / 20);
    }
    for (let i = bassHigh; i < midHigh; i++) {
      midRaw += Math.pow(10, freqData[i] / 20);
    }
    for (let i = midHigh; i < trebleHigh; i++) {
      trebleRaw += Math.pow(10, freqData[i] / 20);
    }

    // Guard NaN/Inf
    if (!isFinite(bassRaw)) bassRaw = 0;
    if (!isFinite(midRaw)) midRaw = 0;
    if (!isFinite(trebleRaw)) trebleRaw = 0;

    // Decay running max
    this._bassMax *= this._decay;
    this._midMax *= this._decay;
    this._trebleMax *= this._decay;

    // Update running max
    this._bassMax = Math.max(this._bassMax, bassRaw, 1e-6);
    this._midMax = Math.max(this._midMax, midRaw, 1e-6);
    this._trebleMax = Math.max(this._trebleMax, trebleRaw, 1e-6);

    return {
      bass: bassRaw / this._bassMax,
      mid: midRaw / this._midMax,
      treble: trebleRaw / this._trebleMax,
      bassRaw,
    };
  }

  _detectBeat(rms, bassEnergy) {
    const now = performance.now() / 1000;

    // RMS spike detection
    let rmsBeat = false;
    if (this._rmsHistory.length >= 3) {
      let avg = 0;
      for (let i = 0; i < this._rmsHistory.length; i++) avg += this._rmsHistory[i];
      avg /= this._rmsHistory.length;
      if (avg > 0 && rms > avg * this._spikeRatio) {
        rmsBeat = true;
      }
    }

    // Spectral flux detection: convert dB to linear magnitudes (reuse buffer)
    if (!this._spectrum || this._spectrum.length !== this._freqData.length) {
      this._spectrum = new Float32Array(this._freqData.length);
    }
    const spectrum = this._spectrum;
    for (let i = 0; i < this._freqData.length; i++) {
      spectrum[i] = Math.pow(10, this._freqData[i] / 20);
    }

    let fluxBeat = false;
    if (this._prevSpectrum && this._prevSpectrum.length === spectrum.length) {
      let flux = 0;
      for (let i = 0; i < spectrum.length; i++) {
        const diff = spectrum[i] - this._prevSpectrum[i];
        if (diff > 0) flux += diff; // Positive flux only (onset detection, not decay)
      }
      if (isFinite(flux) && this._fluxHistory.length >= 3) {
        let avg = 0;
        for (let i = 0; i < this._fluxHistory.length; i++) avg += this._fluxHistory[i];
        avg /= this._fluxHistory.length;
        if (avg > 0 && flux > avg * this._fluxRatio) {
          fluxBeat = true;
        }
      }
      if (isFinite(flux)) {
        this._fluxHistory.push(flux);
        if (this._fluxHistory.length > this._fluxHistoryMax) this._fluxHistory.shift();
      }
    }
    // Swap buffers: prevSpectrum <- current spectrum (copy into existing buffer)
    if (!this._prevSpectrum || this._prevSpectrum.length !== spectrum.length) {
      this._prevSpectrum = new Float32Array(spectrum);
    } else {
      this._prevSpectrum.set(spectrum);
    }

    // Bass onset detection
    let bassBeat = false;
    if (this._bassHistory.length >= 3) {
      let avg = 0;
      for (let i = 0; i < this._bassHistory.length; i++) avg += this._bassHistory[i];
      avg /= this._bassHistory.length;
      if (avg > 0 && bassEnergy > avg * this._bassRatio) bassBeat = true;
    }
    this._bassHistory.push(bassEnergy);
    if (this._bassHistory.length > this._bassHistoryMax) this._bassHistory.shift();

    // Always update RMS history
    this._rmsHistory.push(rms);
    if (this._rmsHistory.length > this._rmsHistoryMax) this._rmsHistory.shift();

    // Fire beat with cooldown
    if ((rmsBeat || fluxBeat || bassBeat) && now - this._lastBeatTime >= this._minBeatInterval) {
      this._lastBeatTime = now;

      // Record onset for BPM estimation
      this._onsetTimes.push(now);
      if (this._onsetTimes.length > this._onsetTimesMax) this._onsetTimes.shift();

      // Prune old onsets (older than 10s)
      const cutoff = now - 10;
      while (this._onsetTimes.length > 0 && this._onsetTimes[0] < cutoff) {
        this._onsetTimes.shift();
      }

      // Estimate BPM from recent onset intervals
      this._estimateBpm();

      return true;
    }

    return false;
  }

  _estimateBpm() {
    if (this._onsetTimes.length < 4) return;

    // Use last 10 onset intervals (index-based to avoid allocation)
    const start = Math.max(0, this._onsetTimes.length - 10);
    const intervals = [];
    for (let i = start + 1; i < this._onsetTimes.length; i++) {
      const iv = this._onsetTimes[i] - this._onsetTimes[i - 1];
      if (iv > 0.25 && iv < 1.2) intervals.push(iv);
    }
    if (intervals.length === 0) return;

    // Median interval
    intervals.sort((a, b) => a - b);
    const mid = Math.floor(intervals.length / 2);
    const median = intervals.length % 2 === 0
      ? (intervals[mid - 1] + intervals[mid]) / 2
      : intervals[mid];

    const newTempo = 60 / median;
    // EMA smoothing (0.7 old + 0.3 new)
    this._tempo = this._tempoSmooth * this._tempo + (1 - this._tempoSmooth) * newTempo;
    // Clamp to realistic range
    this._tempo = Math.max(60, Math.min(180, this._tempo));
  }

  /** Clean up resources */
  destroy() {
    if (this._analyser) this._analyser.disconnect();
    if (this._source) this._source.disconnect();
    if (this._stream) this._stream.getTracks().forEach(t => t.stop());
    if (this._ctx && this._ctx.state !== 'closed') this._ctx.close();
    this._started = false;
  }
}

export { AudioAnalyzer };
if (typeof window !== 'undefined') {
    window.VJamFX = window.VJamFX || { presets: {} };
    window.VJamFX.AudioAnalyzer = AudioAnalyzer;
}
