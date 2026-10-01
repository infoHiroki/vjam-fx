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
  // 白背景では screen/lighten/color-dodge が白のまま＝見えないので、ランダムはこの2つだけ
  const LIGHT_PAGE_BLEND_MODES = ['difference', 'exclusion'];

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

  // Rnd の候補が渡らないとき(SW のページ遷移復帰・プールが読めないとき)の filter。
  // invert はオーバーレイの黒を白にしてページを潰し、blur は iPad で重いので外す
  const FALLBACK_RND_FILTERS = ['hue-rotate', 'grayscale', 'saturate', 'brightness', 'contrast', 'sepia'].map(n => FILTER_VALUES[n]);

  // VJam 本体と同じ回し方: 拍で数えて切り替え、blend は 90%・filter は 60% で変え、4〜6 回に 1 回 0.5 秒休む
  const SWITCH_BEATS = 16;
  const BLEND_CHANGE_RATE = 0.9;
  const FILTER_CHANGE_RATE = 0.6;
  const REST_MS = 500;

  // 45fps を 2 秒続けて割ったら p5 を 30fps に落とす
  const LOW_FPS = 45;
  const LOW_FPS_SECONDS = 2;
  const THROTTLED_FPS = 30;

  // iPad / iPhone(iPadOS は Mac の UA を名乗るのでタッチ点の数で見分ける)
  function isIOS() {
    const ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }

  function pickOne(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // プールの filters(CSS の filter 文字列)。空・不正なら既定
  function poolFilters(pool) {
    const list = pool && Array.isArray(pool.filters) ? pool.filters.filter(f => typeof f === 'string' && f) : [];
    return list.length ? list : FALLBACK_RND_FILTERS;
  }

  // プールの blends(使えるものだけ)。空なら全部
  function poolBlends(pool) {
    const list = pool && Array.isArray(pool.blends) ? pool.blends.filter(b => VALID_BLEND_MODES.includes(b)) : [];
    return list.length ? list : VALID_BLEND_MODES;
  }

  // 背景色の rgb(数値の配列)。透明(alpha 0)なら null
  function backgroundRgb(el) {
    const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
    return (!m || (m.length === 4 && Number(m[3]) === 0)) ? null : m;
  }

  // 背景に何も塗られていない(色が透明で画像も無い)
  function hasNoBackground(el) {
    const img = getComputedStyle(el).backgroundImage;
    return !backgroundRgb(el) && (!img || img === 'none');
  }

  function isLightPage() {
    // body が透明なら html を見る。背景未指定のページは createOverlay が html に Canvas を入れるので、その実際の色で決まる
    const els = [document.body, document.documentElement];
    for (let i = 0; i < els.length; i++) {
      if (!els[i]) continue;
      const m = backgroundRgb(els[i]);
      if (m) return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255 > 0.5;
    }
    // 背景画像だけのページなど、色が取れないときは明るい扱い
    return true;
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
      this._savedRootBg = null; // createOverlay で html に Canvas を入れる前のインラインの値(入れていなければ null)
      this.audioEnabled = true;
      this._externalAudioData = null;
      this._rafId = null;

      // Multi-layer support
      this.activeLayers = new Map(); // name → { preset, container }
      this.activeFilters = new Set();
      this._rndFilter = ''; // Rnd が選んだ filter(CSS 文字列 1 つ)。activeFilters(手動のボタン)とは別に持つ
      this._maxLayers = isIOS() ? 3 : 5;

      // 軽さ: 45fps を割り続けたら p5 を 30fps に落とす(OFF にするまで戻さない)
      this._fpsThrottled = false;
      this._fpsMeter = null;

      // MSE タップの BPM(Auto / Rnd の間隔用。取れていなければ 0)
      this._mseBpm = 0;

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
          // Pause/resume tabCapture during fullscreen (recording indicator blocks fullscreen)
          var origin = window.location.origin || '*';
          if (fsEl) {
            window.postMessage({ source: 'vjam-fx-engine', type: 'pauseTabCapture' }, origin);
          } else {
            window.postMessage({ source: 'vjam-fx-engine', type: 'resumeTabCapture' }, origin);
          }
        };
        document.addEventListener('fullscreenchange', this._onFullscreenChange);
      }
    }

    // --- Media Audio Capture (createMediaElementSource) ---

    _startVideoAudio() {
      // Safari(mse-tap あり): 音は MSE タップから取る。<video> は Web Audio に通さない
      // (iPad Safari では MSE / 標準 HLS とも無音しか返らず、動画の音がグラフに吸い込まれて消音になるリスクだけ残る)
      if (window.__vjamMse) return;
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
      if (window.__vjamMse) return; // Safari: createMediaElementSource は張らない(_startVideoAudio 参照)
      // Skip if already connected to this element
      if (this._videoAudioMedia === media && this._videoAudioCtx) return;
      // Close old AudioContext if switching to a different element
      if (this._videoAudioCtx && this._videoAudioCtx.state !== 'closed') {
        if (this._videoAudioAnalyser) { this._videoAudioAnalyser.disconnect(); this._videoAudioAnalyser = null; }
        if (this._videoAudioSource) { this._videoAudioSource.disconnect(); this._videoAudioSource = null; }
        this._videoAudioCtx.close().catch(function() {});
        this._videoAudioCtx = null;
      }
      this._videoAudioMedia = media;
      try {
        var ctx = new AudioContext();
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
        if (self._silenceCheckTimer) clearInterval(self._silenceCheckTimer);
        var startSilenceCheck = function() {
          var checkCount = 0;
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
              window.postMessage({ source: 'vjam-fx-engine', type: 'stopTabCapture' }, window.location.origin || '*');
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
        };
        // Wait for AudioContext to resume before starting silence check
        if (ctx.state === 'suspended') {
          ctx.resume().then(startSilenceCheck).catch(startSilenceCheck);
        } else {
          startSilenceCheck();
        }
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

    // --- MSE tap (Safari: content/mse-tap.js が document_start で window.__vjamMse を入れる) ---

    // 再生時刻を読む要素。mse-tap が本編を選べるならそれ(再生中で一番大きいもの。広告や幅 0 のダミーを避ける)、
    // 選べない版なら再生中のものを優先
    _mseMedia() {
      var mse = window.__vjamMse;
      if (mse && typeof mse.media === 'function') return mse.media();
      var list = document.querySelectorAll('video, audio');
      for (var i = 0; i < list.length; i++) {
        if (!list[i].paused) return list[i];
      }
      return list[0] || null;
    }

    // 今の再生位置の MSE 解析。__vjamMse が無い(Chrome)・データが無い・一時停止中は null
    _readMseAudioData() {
      this._mseBpm = 0;
      var mse = window.__vjamMse;
      if (!mse || typeof mse.frameAt !== 'function') return null;
      var media = this._mseMedia();
      if (!media || media.paused) return null;
      var f = mse.frameAt(media.currentTime);
      if (!f) return null;
      this._mseBpm = f.bpm > 0 ? f.bpm : 0;
      var sens = this._audioSensitivity;
      return { beat: !!f.beat, bpm: f.bpm, strength: Math.min(1, f.strength * sens), rms: f.rms * sens, bass: Math.min(1, f.bass * sens), mid: Math.min(1, f.mid * sens), treble: Math.min(1, f.treble * sens) };
    }

    createOverlay() {
      if (this.overlay) return this.overlay;

      // 背景が透明なページでは、ブラウザが既定で塗る白は mix-blend-mode の相手にならず、黒いキャンバスがそのまま覆う。
      // html に Canvas(ブラウザ既定の背景と同じ色。ダークモードにも追従)を入れて、合成の相手を作る。見た目は変わらない
      const root = document.documentElement;
      if (hasNoBackground(document.body) && hasNoBackground(root)) {
        this._savedRootBg = root.style.backgroundColor;
        root.style.backgroundColor = 'Canvas';
      }

      // Auto-detect page brightness (default screen → difference on light pages)
      this.isLightPage = isLightPage();

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
        `mix-blend-mode: ${this._effectiveBlendMode()}`,
      ].join('; ');

      document.body.appendChild(overlay);
      this.overlay = overlay;

      return overlay;
    }

    // createOverlay で html に入れた Canvas を、元のインラインの値に戻す(その後ページが書き換えていたら触らない)
    _restoreRootBackground() {
      if (this._savedRootBg === null) return;
      const root = document.documentElement;
      if (root.style.backgroundColor.toLowerCase() === 'canvas') root.style.backgroundColor = this._savedRootBg;
      this._savedRootBg = null;
    }

    setBlendMode(mode) {
      if (!VALID_BLEND_MODES.includes(mode)) return;
      this.blendMode = mode;
      if (this.overlay) {
        mode = this._effectiveBlendMode();
        this.overlay.style.mixBlendMode = mode;
        const canvases = this.overlay.querySelectorAll('canvas');
        for (let i = 0; i < canvases.length; i++) {
          canvases[i].style.mixBlendMode = mode;
        }
      }
    }

    // 実際に CSS に掛ける blend。既定の screen はライトページでは見えないので difference で描く
    // (this.blendMode は popup/SW に返すユーザー側の値のまま)
    _effectiveBlendMode() {
      return (this.blendMode === 'screen' && this.isLightPage) ? 'difference' : this.blendMode;
    }

    // プールの blends から 1 つ。ライトページは difference / exclusion に限る(プールに無ければその 2 つから)
    _randomBlendMode(pool) {
      let modes = poolBlends(pool);
      if (this.isLightPage) {
        const visible = modes.filter(m => LIGHT_PAGE_BLEND_MODES.includes(m));
        modes = visible.length ? visible : LIGHT_PAGE_BLEND_MODES;
      }
      return pickOne(modes);
    }

    // Rnd の blend。force でなければ 90% で変える
    _randomizeBlend(pool, force) {
      if (!force && Math.random() >= BLEND_CHANGE_RATE) return;
      this.setBlendMode(this._randomBlendMode(pool));
    }

    // Rnd の filter。プールから 1 つだけ選んで掛ける(重ね掛けしない)。force でなければ 60% で変え、それ以外は「なし」も含めて維持
    _randomizeFilter(pool, force) {
      if (!force && Math.random() >= FILTER_CHANGE_RATE) return;
      this.activeFilters.clear();
      this._rndFilter = pickOne(poolFilters(pool));
      this._applyFilters();
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
      let preset;
      try {
        preset = new PresetClass();
        preset.setup(layerDiv);
      } catch (e) {
        console.warn('VJam FX: preset setup failed', presetName, e);
        layerDiv.remove();
        return;
      }

      // Apply blend mode to new canvas
      const canvas = layerDiv.querySelector('canvas');
      if (canvas) {
        canvas.style.mixBlendMode = this._effectiveBlendMode();
      }
      if (this._fpsThrottled) this._setLayerFps(preset, THROTTLED_FPS);

      this.activeLayers.set(presetName, { preset: preset, container: layerDiv });

      // レイヤー上限(iPad / iPhone は 3、それ以外は 5)。超えたら古いものから外す
      while (this.activeLayers.size > this._maxLayers) {
        this._removeLayer(this.activeLayers.keys().next().value);
      }

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
        // Priority: MSE tap (Safari) → video audio (createMediaElementSource) → external bridge (offscreen)
        var audioData = null;
        if (self.audioEnabled && timestamp - lastAudioTime >= AUDIO_INTERVAL) {
          var mseData = self._readMseAudioData();
          if (mseData) {
            audioData = mseData;
            // MSE が取れている間は analyser を外す(source→destination は維持)
            if (self._videoAudioAnalyser) self._stopVideoAudio();
          } else if (self._videoAudioAnalyser) {
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
        if (audioData && audioData.beat) self._onBeat();
        self._trackFps(timestamp);

        self._rafId = requestAnimationFrame(loop);
      };

      this._rafId = requestAnimationFrame(loop);
    }

    // 1 秒ごとの fps を見て、45fps を 2 秒続けて割ったら全レイヤーの p5 を 30fps に落とす
    _trackFps(now) {
      if (this._fpsThrottled) return;
      const m = this._fpsMeter;
      // 初回・タブが裏にいた(rAF が止まっていた)ときは数え直す
      if (!m || now - m.last > 1000) {
        this._fpsMeter = { start: now, last: now, frames: 0, low: 0 };
        return;
      }
      m.last = now;
      m.frames++;
      if (now - m.start < 1000) return;
      const fps = m.frames * 1000 / (now - m.start);
      m.low = fps < LOW_FPS ? m.low + 1 : 0;
      m.start = now;
      m.frames = 0;
      if (m.low >= LOW_FPS_SECONDS) {
        this._fpsThrottled = true;
        for (const [, layer] of this.activeLayers) this._setLayerFps(layer.preset, THROTTLED_FPS);
      }
    }

    _setLayerFps(preset, fps) {
      if (preset && preset.p5 && typeof preset.p5.frameRate === 'function') preset.p5.frameRate(fps);
    }

    stop() {
      this.active = false;
      this._stopAutoCycle();
      this._stopAutoFX();

      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }

      // Destroy all layers (continue even if one fails)
      for (const [, layer] of this.activeLayers) {
        try { layer.preset.destroy(); } catch (e) { console.warn('VJam FX: layer destroy error', e); }
        try { layer.container.remove(); } catch (e) { /* ignore */ }
      }
      this.activeLayers.clear();

      this.currentPreset = null;
      this.currentPresetName = null;

      // OFF にしたら fps の制限を解く(次に ON にしたときは 60fps から測り直す)
      this._fpsThrottled = false;
      this._fpsMeter = null;
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
      this._restoreRootBackground();

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
      this._rndFilter = '';

      // Allow re-injection by clearing singleton reference
      window._vjamFxEngine = null;
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
      this._rndFilter = '';
      this._applyFilters();
    }

    _applyFilters() {
      if (!this.overlay) return;
      const parts = [...this.activeFilters].map(f => FILTER_VALUES[f]).filter(Boolean);
      if (this._rndFilter && this._rndFilter !== 'none') parts.push(this._rndFilter);
      this.overlay.style.filter = parts.join(' ') || 'none';
    }

    /**
     * Kill all layers but keep engine alive (quick reset)
     */
    kill(options) {
      var locks = (options && options.locks) || {};
      // Immediately destroy all layers (no fade) unless effect locked
      if (!locks.effect) {
        for (const [, layer] of this.activeLayers) {
          try { layer.preset.destroy(); } catch (e) { console.warn('VJam FX: kill destroy error', e); }
          try { layer.container.remove(); } catch (e) { /* ignore */ }
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
     * Randomize blend mode + filter (options.pool: { filters, blends })
     * 呼ばれたら必ず変える。blend も filter もプールから 1 つ
     */
    randomizeFX(options) {
      const pool = options && options.pool;
      if (!(options && options.skipBlend)) this._randomizeBlend(pool, true);
      this._randomizeFilter(pool, true);
    }

    // N 拍ぶんの長さ(4〜15 秒にクランプ)。BPM が取れなければ base
    _beatsInterval(beats, base) {
      const bpm = this._tempoBpm();
      if (!(bpm > 0)) return base;
      return Math.max(4000, Math.min(15000, (60 / bpm) * beats * 1000));
    }

    // 今の BPM。音声ループと同じ優先順(MSE タップ → analyser → bridge)。取れなければ 0
    _tempoBpm() {
      if (this._mseBpm > 0) return this._mseBpm;
      if (this._videoAudioAnalyser && this._videoAudioTempo > 0) return this._videoAudioTempo;
      if (this._externalAudioData && this._externalAudioData.bpm > 0) return this._externalAudioData.bpm;
      return 0;
    }

    // 音声ループで拍が来るたびに呼ぶ。Auto / Rnd の拍を数え、届いたら切り替える
    _onBeat() {
      if (this._autoCycleTimer && ++this._autoCycleBeats >= this._barsPerCycle) this._autoSwitch();
      if (this._autoFXTimer && ++this._autoFXBeats >= SWITCH_BEATS) {
        this._autoFXTick();
        this._scheduleAutoFX();
      }
    }

    // --- Auto-Cycle ---
    // 拍で数えて切り替える(barsPerCycle 拍、既定 16)。拍が取れないときは時間の fallback(同じ拍数ぶん、4〜15 秒)。
    // 4〜6 回に 1 回は休む(外して 0.5 秒後に切り替え)

    startAutoCycle(presetNames, intervalMs, options) {
      this._stopAutoCycle();
      if (!presetNames || presetNames.length === 0) return;

      this._autoCyclePresets = presetNames;
      this._autoCycleBaseInterval = intervalMs || 8000;
      this._autoBlend = !!(options && options.autoBlend);
      this._autoFilters = !!(options && options.autoFilters);
      this._barsPerCycle = (options && options.barsPerCycle) || SWITCH_BEATS;
      this._autoCycleLocks = (options && options.locks) || {};
      this._autoCyclePool = (options && options.pool) || null;
      this._autoSwitchCount = 0;
      this._autoRestAt = 4 + Math.floor(Math.random() * 3);

      // Skip first tick when only updating options (e.g. toggling Auto Blend/Filter)
      if (!(options && options.skipFirstTick)) {
        this._autoCycleTick();
      }
      this._scheduleAutoCycle();
    }

    // 拍を数え直し、拍が取れないときの時間 fallback を張り直す。切り替えるたびに呼ぶ
    _scheduleAutoCycle() {
      clearTimeout(this._autoCycleTimer);
      this._autoCycleBeats = 0;
      const timerId = setTimeout(() => {
        // Guard: don't tick if cycle was stopped between schedule and fire
        if (this._autoCycleTimer !== timerId) return;
        this._autoSwitch();
      }, this._beatsInterval(this._barsPerCycle, this._autoCycleBaseInterval));
      this._autoCycleTimer = timerId;
    }

    _autoSwitch() {
      this._autoSwitchCount++;
      if (this._autoSwitchCount < this._autoRestAt) {
        this._autoCycleTick();
        this._scheduleAutoCycle();
        return;
      }
      // 休み: 外して 0.5 秒後に普通の切り替え(その間の拍では切り替えない)
      this._autoSwitchCount = 0;
      this._autoRestAt = 4 + Math.floor(Math.random() * 3);
      this._autoCycleRest();
      clearTimeout(this._autoCycleTimer);
      this._autoCycleBeats = -Infinity;
      const timerId = setTimeout(() => {
        if (this._autoCycleTimer !== timerId) return;
        this._autoCycleTick();
        this._scheduleAutoCycle();
      }, REST_MS);
      this._autoCycleTimer = timerId;
    }

    // 休み: ロックされていないレイヤーを外し、Rnd が回している blend / filter を既定(screen / なし)に戻す
    _autoCycleRest() {
      const locks = this._autoCycleLocks || {};
      if (!locks.effect) {
        for (const name of [...this.activeLayers.keys()]) this._removeLayer(name);
      }
      if (this._autoBlend && !locks.blend) this.setBlendMode('screen');
      if (this._autoFilters && !locks.filter) this.clearFilters();
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
        const shuffled = presets.slice();
        for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t; }
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

      // Auto-blend / Auto-filters: プールから(unless locked)
      if (this._autoBlend && !locks.blend) this._randomizeBlend(this._autoCyclePool);
      if (this._autoFilters && !locks.filter) this._randomizeFilter(this._autoCyclePool);
    }

    _stopAutoCycle() {
      if (this._autoCycleTimer) {
        clearTimeout(this._autoCycleTimer);
        this._autoCycleTimer = null;
      }
    }

    // --- Standalone Auto Blend/Filter (without preset Auto-Cycle) ---
    // 16 拍ごと(拍が取れないときは 16 拍ぶんの時間、4〜15 秒)

    startAutoFX(options) {
      this._stopAutoFX();
      this._autoFXBlend = !!(options && options.autoBlend);
      this._autoFXFilters = !!(options && options.autoFilters);
      this._autoFXPool = (options && options.pool) || null;
      if (!this._autoFXBlend && !this._autoFXFilters) return;
      this._scheduleAutoFX();
    }

    _scheduleAutoFX() {
      clearTimeout(this._autoFXTimer);
      this._autoFXBeats = 0;
      const timerId = setTimeout(() => {
        if (this._autoFXTimer !== timerId) return;
        this._autoFXTick();
        this._scheduleAutoFX();
      }, this._beatsInterval(SWITCH_BEATS, 8000));
      this._autoFXTimer = timerId;
    }

    _autoFXTick() {
      if (this._autoFXBlend) this._randomizeBlend(this._autoFXPool);
      if (this._autoFXFilters) this._randomizeFilter(this._autoFXPool);
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
          this._restoreRootBackground();
          this.activeFilters.clear();
          this._rndFilter = '';
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
          if (!this.audioEnabled) { this._externalAudioData = null; this._mseBpm = 0; }
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
          this.randomizeFX({ skipBlend: !!msg.skipBlend, pool: msg.pool });
          break;
        case 'setFadeDuration': {
          var fd = msg.duration != null ? msg.duration : 1.5;
          this._fadeDuration = (isFinite(fd) && fd >= 0) ? fd : 1.5;
          break;
        }
        case 'setAudioSensitivity': {
          var as = msg.sensitivity != null ? msg.sensitivity : 1.0;
          this._audioSensitivity = (isFinite(as) && as > 0) ? as : 1.0;
          break;
        }
        case 'startAutoCycle':
          this.startAutoCycle(msg.presets, msg.interval, { autoBlend: msg.autoBlend, autoFilters: msg.autoFilters, barsPerCycle: msg.barsPerCycle, locks: msg.locks, skipFirstTick: msg.skipFirstTick, pool: msg.pool });
          break;
        case 'stopAutoCycle':
          this._stopAutoCycle();
          break;
        case 'updateAutoCycleOptions':
          this.updateAutoCycleOptions({ autoBlend: msg.autoBlend, autoFilters: msg.autoFilters, locks: msg.locks });
          break;
        case 'startAutoFX':
          this.startAutoFX({ autoBlend: msg.autoBlend, autoFilters: msg.autoFilters, pool: msg.pool });
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
