/**
 * VJam FX — Offscreen Document for Tab Audio Capture
 * Receives tab audio stream, performs beat detection, sends audioData to SW.
 */
(function() {
  'use strict';

  let audioCtx = null;
  let source = null;
  let analyser = null;
  let stream = null;
  let intervalId = null;
  let freqData = null;
  let timeData = null;

  // Frequency band boundaries
  let bassLow = 0, bassHigh = 0, midHigh = 0, trebleHigh = 0;

  // Running max normalization (decay 0.995)
  let bassMax = 1e-6, midMax = 1e-6, trebleMax = 1e-6;
  const DECAY = 0.995;

  // RMS spike detection
  const rmsHistory = [];
  const RMS_HISTORY_MAX = 30;
  const SPIKE_RATIO = 1.3;

  // Spectral flux detection
  let prevSpectrum = null;
  let spectrum = null;
  const fluxHistory = [];
  const FLUX_HISTORY_MAX = 30;
  const FLUX_RATIO = 1.4;

  // Bass onset detection
  const bassHistory = [];
  const BASS_HISTORY_MAX = 30;
  const BASS_RATIO = 1.2;

  // Beat timing
  let lastBeatTime = -1;
  const MIN_BEAT_INTERVAL = 0.25; // 240 BPM upper limit
  const MIN_RMS_FOR_BEAT = 0.01;

  // BPM estimation
  const onsetTimes = [];
  const ONSET_TIMES_MAX = 100;
  let tempo = 120;
  const TEMPO_SMOOTH = 0.7;

  function computeRms(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  function computeFrequencyBands() {
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
    if (!isFinite(bassRaw)) bassRaw = 0;
    if (!isFinite(midRaw)) midRaw = 0;
    if (!isFinite(trebleRaw)) trebleRaw = 0;

    bassMax *= DECAY;
    midMax *= DECAY;
    trebleMax *= DECAY;
    bassMax = Math.max(bassMax, bassRaw, 1e-6);
    midMax = Math.max(midMax, midRaw, 1e-6);
    trebleMax = Math.max(trebleMax, trebleRaw, 1e-6);

    return {
      bass: bassRaw / bassMax,
      mid: midRaw / midMax,
      treble: trebleRaw / trebleMax,
      bassRaw,
    };
  }

  function detectBeat(rms, bassEnergy) {
    const now = performance.now() / 1000;

    // RMS spike
    let rmsBeat = false;
    if (rmsHistory.length >= 3) {
      let avg = 0;
      for (let i = 0; i < rmsHistory.length; i++) avg += rmsHistory[i];
      avg /= rmsHistory.length;
      if (avg > 0 && rms > avg * SPIKE_RATIO) rmsBeat = true;
    }

    // Spectral flux
    if (!spectrum || spectrum.length !== freqData.length) {
      spectrum = new Float32Array(freqData.length);
    }
    for (let i = 0; i < freqData.length; i++) {
      spectrum[i] = Math.pow(10, freqData[i] / 20);
    }

    let fluxBeat = false;
    if (prevSpectrum && prevSpectrum.length === spectrum.length) {
      let flux = 0;
      for (let i = 0; i < spectrum.length; i++) {
        const diff = spectrum[i] - prevSpectrum[i];
        if (diff > 0) flux += diff;
      }
      if (isFinite(flux) && fluxHistory.length >= 3) {
        let avg = 0;
        for (let i = 0; i < fluxHistory.length; i++) avg += fluxHistory[i];
        avg /= fluxHistory.length;
        if (avg > 0 && flux > avg * FLUX_RATIO) fluxBeat = true;
      }
      if (isFinite(flux)) {
        fluxHistory.push(flux);
        if (fluxHistory.length > FLUX_HISTORY_MAX) fluxHistory.shift();
      }
    }
    if (!prevSpectrum || prevSpectrum.length !== spectrum.length) {
      prevSpectrum = new Float32Array(spectrum);
    } else {
      prevSpectrum.set(spectrum);
    }

    // Bass onset
    let bassBeat = false;
    if (bassHistory.length >= 3) {
      let avg = 0;
      for (let i = 0; i < bassHistory.length; i++) avg += bassHistory[i];
      avg /= bassHistory.length;
      if (avg > 0 && bassEnergy > avg * BASS_RATIO) bassBeat = true;
    }
    bassHistory.push(bassEnergy);
    if (bassHistory.length > BASS_HISTORY_MAX) bassHistory.shift();

    rmsHistory.push(rms);
    if (rmsHistory.length > RMS_HISTORY_MAX) rmsHistory.shift();

    if ((rmsBeat || fluxBeat || bassBeat) && now - lastBeatTime >= MIN_BEAT_INTERVAL) {
      lastBeatTime = now;
      onsetTimes.push(now);
      if (onsetTimes.length > ONSET_TIMES_MAX) onsetTimes.shift();
      const cutoff = now - 10;
      while (onsetTimes.length > 0 && onsetTimes[0] < cutoff) onsetTimes.shift();
      estimateBpm();
      return true;
    }
    return false;
  }

  function estimateBpm() {
    if (onsetTimes.length < 4) return;
    const start = Math.max(0, onsetTimes.length - 10);
    const intervals = [];
    for (let i = start + 1; i < onsetTimes.length; i++) {
      const iv = onsetTimes[i] - onsetTimes[i - 1];
      if (iv > 0.25 && iv < 1.2) intervals.push(iv);
    }
    if (intervals.length === 0) return;
    intervals.sort((a, b) => a - b);
    const mid = Math.floor(intervals.length / 2);
    const median = intervals.length % 2 === 0
      ? (intervals[mid - 1] + intervals[mid]) / 2
      : intervals[mid];
    const newTempo = 60 / median;
    tempo = TEMPO_SMOOTH * tempo + (1 - TEMPO_SMOOTH) * newTempo;
    tempo = Math.max(60, Math.min(180, tempo));
  }

  function getAudioData() {
    analyser.getFloatTimeDomainData(timeData);
    const rms = computeRms(timeData);
    analyser.getFloatFrequencyData(freqData);
    const { bass, mid, treble, bassRaw } = computeFrequencyBands();
    const beat = rms >= MIN_RMS_FOR_BEAT ? detectBeat(rms, bassRaw) : false;
    const now = performance.now() / 1000;
    const timeSinceBeat = now - lastBeatTime;
    const strength = (rms >= MIN_RMS_FOR_BEAT && timeSinceBeat < 0.2) ? 1.0 - (timeSinceBeat / 0.2) : 0;
    return { beat, bpm: tempo, strength, rms, bass, mid, treble };
  }

  async function startCapture(streamId) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId,
          },
        },
      });

      audioCtx = new AudioContext();
      source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      // Pass audio through to destination so the tab's sound keeps playing
      source.connect(audioCtx.destination);

      const binCount = analyser.frequencyBinCount;
      freqData = new Float32Array(binCount);
      timeData = new Float32Array(analyser.fftSize);

      const freqPerBin = audioCtx.sampleRate / analyser.fftSize;
      bassLow = Math.min(Math.floor(20 / freqPerBin), binCount);
      bassHigh = Math.min(Math.floor(250 / freqPerBin), binCount);
      midHigh = Math.min(Math.floor(4000 / freqPerBin), binCount);
      trebleHigh = Math.min(Math.floor(16000 / freqPerBin), binCount);

      // Send audio data at ~15Hz
      intervalId = setInterval(() => {
        const data = getAudioData();
        chrome.runtime.sendMessage({ type: 'audioData', data });
      }, 66);

      return true;
    } catch (e) {
      console.warn('VJam FX Offscreen: capture failed', e);
      stopCapture();
      return false;
    }
  }

  function stopCapture() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (source) { source.disconnect(); source = null; }
    if (analyser) { analyser.disconnect(); analyser = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (audioCtx && audioCtx.state !== 'closed') { audioCtx.close(); audioCtx = null; }

    // Reset state
    bassMax = midMax = trebleMax = 1e-6;
    rmsHistory.length = 0;
    fluxHistory.length = 0;
    bassHistory.length = 0;
    onsetTimes.length = 0;
    prevSpectrum = null;
    spectrum = null;
    lastBeatTime = -1;
    tempo = 120;
    freqData = null;
    timeData = null;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'startCapture') {
      startCapture(msg.streamId).then(ok => sendResponse({ ok }));
      return true; // async response
    }
    if (msg.type === 'stopCapture') {
      stopCapture();
      sendResponse({ ok: true });
    }
    return false;
  });

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { startCapture, stopCapture, getAudioData, computeRms, detectBeat, estimateBpm };
  }
})();
