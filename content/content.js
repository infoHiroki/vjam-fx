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

  // Rnd / Auto で blend・filter を変えるときの dip: オーバーレイ全体をこの時間で 0 へ下げ、変えてから同じ時間で戻す
  const DIP_MS = 300;

  // 45fps を 2 秒続けて割ったら p5 を 30fps に落とす
  const LOW_FPS = 45;
  const LOW_FPS_SECONDS = 2;
  const THROTTLED_FPS = 30;

  // 重いプリセットを飛ばす(#40): 全体の fps が HEAVY_FPS を HEAVY_SECONDS 秒続けて割ったら、一番重いレイヤーを入れ替える。
  // 全体の fps は描画ループ(_startLoop)の rAF で測る。30fps 落としは p5 の描画を間引くだけで rAF は画面の更新どおり回るので、
  // 落とし中でも描画が 30fps に収まっていれば下がらない。下がるのは描画 1 回が 1 フレームに収まらないときだけ(しきい値は 30 の 8 割)
  // レイヤーを足した・外したら、フェードが終わって HEAVY_SETTLE_MS たつまで数えない。
  // 端末に覚えるのは、外したあとの HEAVY_SECONDS 秒が HEAVY_FPS 以上に戻ったとき(本当に軽くなったとき)だけ。
  // 戻らなければページ自体が重い(外したレイヤーは無実)ので、入れ替えだけで終わり、そのページ(このエンジン)ではもう飛ばさない
  const HEAVY_FPS = 24;
  const HEAVY_SECONDS = 3;
  const HEAVY_SETTLE_MS = 2000;

  // iPad / iPhone(iPadOS は Mac の UA を名乗るのでタッチ点の数で見分ける)
  function isIOS() {
    const ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }

  function pickOne(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // Auto の抽選: names からランダムに count 本。webgl(WebGL のプリセット名の Set)は 1 本まで。
  // WebGL のレイヤーは同時に 1 枚までなので(_removeOtherWebglLayers)、2 本引くと 1 本がすぐ消えてその回のレイヤーが減る
  function pickLayers(names, count, webgl) {
    const shuffled = names.slice();
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t; }
    const chosen = [];
    let hasWebgl = false;
    for (let i = 0; i < shuffled.length && chosen.length < count; i++) {
      if (webgl.has(shuffled[i])) {
        if (hasWebgl) continue;
        hasWebgl = true;
      }
      chosen.push(shuffled[i]);
    }
    return chosen;
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

  // p5 の WEBGL で描くプリセット(setup がページの load 待ちでまだのものは分からないので false)
  function isWebglPreset(preset) {
    const renderer = preset && preset.p5 && preset.p5._renderer;
    return !!(renderer && renderer.isP3D);
  }

  // --- iPhone: フルスクリーンの代わりに画面いっぱい表示(#51) ---
  // iPhone の Safari には要素のフルスクリーンが無く、video.webkitEnterFullscreen は iPhone 専用のプレーヤーに切り替わって
  // ページの上のもの(エフェクト)が見えなくなる。そこでは video を画面いっぱいに広げて、エフェクトを重ねたままにする

  const FILL_ENTER_METHODS = ['webkitEnterFullscreen', 'webkitEnterFullScreen']; // 後ろは古い綴り(同じもの)
  const FILL_Z = '2147483646'; // overlay の 1 つ下
  // 画面いっぱいの video に !important で掛けるもの。戻すときは 1 つずつ元の値に戻すので、margin などは個別のプロパティで持つ
  const FILL_VIDEO_STYLES = [
    ['display', 'block'], ['visibility', 'visible'], ['position', 'fixed'],
    ['top', '0'], ['left', '0'], ['right', 'auto'], ['bottom', 'auto'], ['width', '100vw'], ['height', '100dvh'],
    ['min-width', '0'], ['min-height', '0'], ['max-width', 'none'], ['max-height', 'none'],
    ['margin-top', '0'], ['margin-right', '0'], ['margin-bottom', '0'], ['margin-left', '0'],
    ['transform', 'none'], ['translate', 'none'], ['rotate', 'none'], ['scale', 'none'],
    ['object-fit', 'contain'], ['background-color', 'black'], ['z-index', FILL_Z],
  ];
  // 祖先にこれがあると position: fixed の基準がその祖先になって画面いっぱいにならないので、画面いっぱいの間だけ外す
  const FILL_ANCESTOR_TRAPS = [
    ['transform', 'none'], ['translate', 'none'], ['rotate', 'none'], ['scale', 'none'], ['perspective', 'none'],
    ['filter', 'none'], ['backdrop-filter', 'none'], ['-webkit-backdrop-filter', 'none'], ['contain', 'none'], ['will-change', 'auto'],
  ];
  // 標準のコントロールの全画面ボタンで入った iPhone 専用のプレーヤーは、入る遷移が終わるまで抜けられない。抜けるまで呼び直す
  const FILL_EXIT_RETRY_MS = 100;
  const FILL_EXIT_TRIES = 30;
  // 抜けると少し後に動画が止まる(pause)。その間に止まったら再生し直す
  const FILL_RESUME_MS = 2000;

  // 要素のフルスクリーンが無く、video の webkitEnterFullscreen だけがある(iPhone の Safari)。iPad・Chrome は false
  function needsVideoFill() {
    const E = window.Element && Element.prototype;
    const V = window.HTMLVideoElement && HTMLVideoElement.prototype;
    return !!(E && V && !E.requestFullscreen && !E.webkitRequestFullscreen && typeof V.webkitEnterFullscreen === 'function');
  }

  // 描画上の親(slot に入っている要素は slot、shadow root の直下はホスト)
  function layoutParent(el) {
    return el.assignedSlot || el.parentElement || (el.parentNode && el.parentNode.host) || null;
  }

  // 祖先 el で外すもの: 画面いっぱいを止めるもの(FILL_ANCESTOR_TRAPS)と、重なり順を閉じ込めるもの(z-index・fixed / sticky)。
  // 重なり順は z-index を FILL_Z に上げる(低い z-index の祖先の中にあると、ページのほかの要素が動画の上に来る)
  function fillAncestorStyles(el) {
    const cs = getComputedStyle(el);
    const out = [];
    for (let i = 0; i < FILL_ANCESTOR_TRAPS.length; i++) {
      const value = cs.getPropertyValue(FILL_ANCESTOR_TRAPS[i][0]);
      if (value && value !== FILL_ANCESTOR_TRAPS[i][1]) out.push(FILL_ANCESTOR_TRAPS[i]);
    }
    if (cs.position === 'fixed' || cs.position === 'sticky' || (cs.zIndex && cs.zIndex !== 'auto')) out.push(['z-index', FILL_Z]);
    return out;
  }

  // el の inline の style に styles([プロパティ, 値])を !important で掛け、戻す関数を返す。
  // 戻すとき、ページが style を触っていなければ元の style をそのまま戻す(元から style 属性が無ければ属性ごと消す)。
  // 掛けている間にページが style を書き換えたら(プレーヤーが向きの変化で width を書くなど)、掛けたプロパティならその値を戻す値にして
  // 掛け直す。そのときは戻すときも掛けたプロパティだけを戻す値(!important の有無も)に戻し、ページが書いたほかのものは残す
  function pinStyle(el, styles) {
    const original = el.hasAttribute('style') ? el.style.cssText : null;
    const saved = {};
    const pinned = {}; // 掛けた直後に読み戻した値(ブラウザが整えた形)。これと違えばページが書き換えた
    let ours = ''; // 掛け終えたときの cssText
    let touched = false;
    const apply = () => {
      for (let i = 0; i < styles.length; i++) {
        const prop = styles[i][0];
        const value = el.style.getPropertyValue(prop);
        const priority = el.style.getPropertyPriority(prop);
        if (pinned[prop] && pinned[prop][0] === value && pinned[prop][1] === priority) continue;
        saved[prop] = [value, priority];
        el.style.setProperty(prop, styles[i][1], 'important');
        pinned[prop] = [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)];
      }
      ours = el.style.cssText;
    };
    apply();
    const observer = new MutationObserver(() => {
      if (el.style.cssText === ours) return; // 自分で掛けた分
      touched = true;
      apply();
    });
    observer.observe(el, { attributes: true, attributeFilter: ['style'] });
    // WebKit は CSSOM で変えた style を属性へ遅れて書き戻す。書き戻す前に属性を消すと、後から空の style="" ができるので、読んで書き戻させてから消す
    const removeAttr = () => {
      el.getAttribute('style');
      el.removeAttribute('style');
    };
    return () => {
      observer.disconnect();
      if (!touched && el.style.cssText === ours) {
        if (original === null) removeAttr();
        else el.style.cssText = original;
        return;
      }
      for (const prop in saved) {
        if (saved[prop][0]) el.style.setProperty(prop, saved[prop][0], saved[prop][1]);
        else el.style.removeProperty(prop);
      }
      if (original === null && !el.style.cssText) removeAttr();
    };
  }

  class VJamFXEngine {
    constructor() {
      this.active = false;
      this.blendMode = 'screen';
      this.opacity = 1.0;
      this.isLightPage = false;
      this.currentPreset = null;
      this.currentPresetName = null;
      this.overlay = null; // ホストの div(document.body の直下)
      this._stage = null; // overlay の shadow root の中の入れ物。レイヤーとテキストのキャンバスはここに入れる
      this._savedRootBg = null; // createOverlay で html に Canvas を入れる前のインラインの値(入れていなければ null)
      // iPhone の画面いっぱい表示(#51)。_fillHooks は overlay がある間の差し替え、_fill は画面いっぱいにしている video
      this._fillHooks = null;
      this._fill = null;
      this._fillExitTimer = null;
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

      // 重いプリセット(#40)。_heavyPresets はこのページで重いと分かったもの(Auto / 入れ替えで選ばない)
      this._heavyPresets = new Set();
      this._heavyMeter = null;
      this._heavyHoldMs = 0; // 次のフレームから数えない時間(レイヤーを足した・外した)
      this._heavyHoldUntil = 0;
      this._poolPresets = null; // 入れ替え先を選ぶプール(Auto / Next が渡す)
      this._webglPresets = new Set(); // WebGL のプリセット名(Auto はプールの webgl、Next は webgl で渡す)。抽選では 1 回に 1 本まで
      this._effectLock = false; // エフェクトのロック(Auto / Next が渡す)。ロック中は入れ替えない
      this._pendingPreset = null; // SW に読み込みを頼んだ入れ替え先
      this._heavyPending = null; // 外したあと、本当に軽くなったかを見ているもの { name, fps, replacement, samples }
      this._heavySkipOff = false; // 外しても軽くならなかった(ページ自体が重い)。このエンジンではもう自動で飛ばさない(OFF でも戻さない)
      this._autoResting = false; // Auto の休み中

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

      // dip の段階(_dip 参照)。下げている間は _dipDownTimer、戻している間は _dipUpTimer
      this._dipDownTimer = null;
      this._dipUpTimer = null;

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
          // SW が入れ替え先のプリセットを読み込んだ(_addReplacement)
          if (event.data && event.data.source === 'vjam-fx-bridge' && event.data.type === 'presetInjected') {
            this._onPresetInjected(event.data.name);
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
      // 位置と重なり順は !important で固定する。サイトの CSS に潰されないように
      // (動画サイトの「フルサイズ」表示で、プレイヤー以外を z-index: 0 / right: 100000px にして画面の外へ飛ばすものがある)
      // opacity / mix-blend-mode / filter は実行中に変えるので固定しない
      const pinned = [
        ['display', 'block'], ['visibility', 'visible'], ['position', 'fixed'],
        ['top', '0'], ['left', '0'], ['right', 'auto'], ['bottom', 'auto'], ['width', '100vw'], ['height', '100vh'],
        ['margin', '0'], ['transform', 'none'], ['z-index', '2147483647'], ['pointer-events', 'none'],
      ];
      for (let i = 0; i < pinned.length; i++) overlay.style.setProperty(pinned[i][0], pinned[i][1], 'important');
      overlay.style.mixBlendMode = this._effectiveBlendMode();

      // 中身(レイヤーの div・キャンバス・テキスト)は Shadow DOM に入れる。ページの CSS は shadow root の中に届かない
      const shadow = overlay.attachShadow({ mode: 'open' });
      const stage = document.createElement('div');
      stage.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
      shadow.appendChild(stage);
      // p5 は setup の後、document の canvas だけを探して visibility: hidden を外す(shadow root の中は見えない)ので、同じことをここでする
      // (<style> はページの CSP で止まることがあるので使わない。setup がページの load 待ちで後になっても拾えるよう、入ってきた時に外す)
      new MutationObserver(() => {
        const hidden = stage.querySelectorAll('canvas[data-hidden="true"]');
        for (let i = 0; i < hidden.length; i++) {
          hidden[i].style.visibility = '';
          delete hidden[i].dataset.hidden;
        }
      }).observe(stage, { childList: true, subtree: true });

      document.body.appendChild(overlay);
      this.overlay = overlay;
      this._stage = stage;
      this._startVideoFill();

      return overlay;
    }

    _removeOverlay() {
      if (!this.overlay) return;
      this._stopVideoFill();
      this._cancelDip();
      this.overlay.remove();
      this.overlay = null;
      this._stage = null;
    }

    // createOverlay で html に入れた Canvas を、元のインラインの値に戻す(その後ページが書き換えていたら触らない)
    _restoreRootBackground() {
      if (this._savedRootBg === null) return;
      const root = document.documentElement;
      if (root.style.backgroundColor.toLowerCase() === 'canvas') root.style.backgroundColor = this._savedRootBg;
      this._savedRootBg = null;
    }

    // --- iPhone: 画面いっぱい表示(#51) ---

    // overlay を作ったとき(iPhone だけ): ページの JS の webkitEnterFullscreen を画面いっぱい表示に差し替え(元は取っておく)、
    // 標準のコントロールの全画面ボタン(JS からは止められない)は webkitbeginfullscreen で拾う
    _startVideoFill() {
      if (this._fillHooks || !needsVideoFill()) return;
      const self = this;
      const proto = HTMLVideoElement.prototype;
      const hooks = { methods: [], onBegin: null };
      for (let i = 0; i < FILL_ENTER_METHODS.length; i++) {
        const name = FILL_ENTER_METHODS[i];
        const original = proto[name];
        if (typeof original !== 'function') continue;
        // ページがこれをさらに包んでいて戻せなかったときは、外したあと元のメソッドに通す
        const patched = function() {
          if (self._fillHooks === hooks) self._fillVideo(this);
          else return original.apply(this, arguments);
        };
        proto[name] = patched;
        hooks.methods.push({ name: name, original: original, patched: patched });
      }
      // webkitbeginfullscreen は泡立たないので capture で拾う
      hooks.onBegin = (e) => {
        const video = e.target;
        if (video && video.nodeName === 'VIDEO') this._leaveNativeFullscreen(video, !video.paused);
      };
      document.addEventListener('webkitbeginfullscreen', hooks.onBegin, true);
      this._fillHooks = hooks;
    }

    // overlay を外すとき: 画面いっぱい表示をやめて、差し替えを全部戻す
    _stopVideoFill() {
      this._exitVideoFill();
      clearTimeout(this._fillExitTimer);
      this._fillExitTimer = null;
      const hooks = this._fillHooks;
      if (!hooks) return;
      this._fillHooks = null;
      const proto = HTMLVideoElement.prototype;
      for (let i = 0; i < hooks.methods.length; i++) {
        const m = hooks.methods[i];
        if (proto[m.name] === m.patched) proto[m.name] = m.original;
      }
      document.removeEventListener('webkitbeginfullscreen', hooks.onBegin, true);
    }

    // iPhone 専用のプレーヤーに入った(標準のボタン・差し替える前に取られた元のメソッド)。すぐ抜けて画面いっぱい表示にする。
    // 入る遷移の間は抜けられないので、抜けるまで呼び直す。抜けると動画が止まるので、再生中だったら続ける
    _leaveNativeFullscreen(video, playing) {
      clearTimeout(this._fillExitTimer);
      let tries = 0;
      const tryExit = () => {
        this._fillExitTimer = null;
        if (!this._fillHooks) return;
        if (video.webkitDisplayingFullscreen) video.webkitExitFullscreen();
        if (video.webkitDisplayingFullscreen) {
          if (++tries < FILL_EXIT_TRIES) this._fillExitTimer = setTimeout(tryExit, FILL_EXIT_RETRY_MS);
          return;
        }
        this._fillVideo(video);
        if (playing) this._keepPlaying(video);
      };
      tryExit();
    }

    // 抜けたあとの pause(FILL_RESUME_MS の間に 1 回)で再生し直す。もう止まっていたらすぐ再生
    _keepPlaying(video) {
      const play = () => {
        const p = video.play();
        if (p && p.catch) p.catch(() => {});
      };
      if (video.paused) play();
      video.addEventListener('pause', play, { once: true });
      setTimeout(() => video.removeEventListener('pause', play), FILL_RESUME_MS);
    }

    // video を画面いっぱいに(エフェクトはその上)。別の video が画面いっぱいなら、それは戻す
    _fillVideo(video) {
      if (!this._fillHooks || !this.overlay || !video.isConnected) return;
      if (this._fill) {
        if (this._fill.video === video) return;
        this._exitVideoFill();
      }
      const restores = [pinStyle(video, FILL_VIDEO_STYLES)];
      for (let el = layoutParent(video); el; el = layoutParent(el)) {
        const styles = fillAncestorStyles(el);
        if (styles.length) restores.push(pinStyle(el, styles));
      }
      this._fill = { video: video, restores: restores, button: this._addFillExitButton() };
    }

    // 画面いっぱい表示をやめる(×・エンジンを OFF)。video と祖先の inline の style を元に戻す
    _exitVideoFill() {
      const fill = this._fill;
      if (!fill) return;
      this._fill = null;
      for (let i = fill.restores.length - 1; i >= 0; i--) fill.restores[i]();
      if (fill.button) fill.button.remove();
    }

    // 抜ける「×」。エフェクトの右上(shadow root の中で stage の外。dip で消えない)。細い線の SVG、押せる大きさは 44px。
    // ホストは pointer-events: none なので、ボタンだけ押せるようにする
    _addFillExitButton() {
      const shadow = this.overlay && this.overlay.shadowRoot;
      if (!shadow) return null;
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-vjam-fill-exit', '');
      button.setAttribute('aria-label', 'Exit full view');
      button.style.cssText = 'position:absolute;top:8px;right:8px;width:44px;height:44px;margin:0;padding:0;border:0;border-radius:50%;'
        + 'background-color:rgba(0,0,0,0.4);color:#fff;display:flex;align-items:center;justify-content:center;'
        + 'pointer-events:auto;cursor:pointer;-webkit-tap-highlight-color:transparent;';
      // ノッチを避ける(viewport-fit=cover のページだけ値が入る)。読めないブラウザでは上の 8px のまま
      button.style.setProperty('top', 'calc(env(safe-area-inset-top, 0px) + 8px)');
      button.style.setProperty('right', 'calc(env(safe-area-inset-right, 0px) + 8px)');
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      const attrs = { width: '20', height: '20', viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' };
      for (const k in attrs) svg.setAttribute(k, attrs[k]);
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', 'M4 4L16 16M16 4L4 16');
      svg.appendChild(path);
      button.appendChild(svg);
      // ページのクリックの処理(プレーヤーのコントロールの出し入れなど)には渡さない
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this._exitVideoFill();
      });
      shadow.appendChild(button);
      return button;
    }

    // smooth: Rnd / Auto の切り替え。dip で暗くしている間に掛ける(手動のボタンはすぐ掛ける)
    setBlendMode(mode, smooth) {
      if (!VALID_BLEND_MODES.includes(mode)) return;
      this.blendMode = mode;
      if (!smooth || !this._dip()) this._applyBlendMode();
    }

    _applyBlendMode() {
      if (!this.overlay) return;
      const mode = this._effectiveBlendMode();
      this.overlay.style.mixBlendMode = mode;
      const canvases = this._stage.querySelectorAll('canvas');
      for (let i = 0; i < canvases.length; i++) {
        canvases[i].style.mixBlendMode = mode;
      }
    }

    // Rnd / Auto の blend・filter の切り替えを目立たせない(dip): オーバーレイの中身(shadow root の入れ物)を DIP_MS で 0 まで下げ、
    // 下がりきったら今の blend / filter を CSS に掛けて、DIP_MS で戻す。人が設定した不透明度(ホストの opacity)には触らない。
    // 下げている途中に来た切り替えは同じ dip に乗る。フェード時間 0・オーバーレイが無いときは dip しない(false。呼び出し側がすぐ掛ける)
    _dip() {
      if (!(this._fadeDuration > 0) || !this._stage) return false;
      if (this._dipDownTimer) return true;
      clearTimeout(this._dipUpTimer);
      this._dipUpTimer = null;
      const stage = this._stage;
      stage.style.transition = 'opacity ' + DIP_MS + 'ms linear';
      stage.style.opacity = '0';
      this._dipDownTimer = setTimeout(() => {
        this._dipDownTimer = null;
        this._applyBlendMode();
        this._applyFilters();
        stage.style.opacity = '1';
        this._dipUpTimer = setTimeout(() => {
          this._dipUpTimer = null;
          stage.style.transition = '';
          stage.style.opacity = '';
        }, DIP_MS);
      }, DIP_MS);
      return true;
    }

    // dip をやめて、今の blend / filter をすぐ掛ける(kill・オーバーレイを外すとき)
    _cancelDip() {
      if (!this._dipDownTimer && !this._dipUpTimer) return;
      clearTimeout(this._dipDownTimer);
      clearTimeout(this._dipUpTimer);
      this._dipDownTimer = null;
      this._dipUpTimer = null;
      if (this._stage) {
        this._stage.style.transition = '';
        this._stage.style.opacity = '';
      }
      this._applyBlendMode();
      this._applyFilters();
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

    // Rnd の blend。force でなければ 90% で変える。dip で掛ける
    _randomizeBlend(pool, force) {
      if (!force && Math.random() >= BLEND_CHANGE_RATE) return;
      this.setBlendMode(this._randomBlendMode(pool), true);
    }

    // Rnd の filter。プールから 1 つだけ選んで掛ける(重ね掛けしない)。force でなければ 60% で変え、それ以外は「なし」も含めて維持。dip で掛ける
    _randomizeFilter(pool, force) {
      if (!force && Math.random() >= FILTER_CHANGE_RATE) return;
      this.activeFilters.clear();
      this._rndFilter = pickOne(poolFilters(pool));
      if (!this._dip()) this._applyFilters();
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

    // auto: Auto / Next が選んだレイヤー(重いときに入れ替えてよい)。手で選んだものは false
    _addLayer(presetName, auto) {
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
      this._stage.appendChild(layerDiv);

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

      // WEBGL の p5 は、先に作った既定の 2D キャンバスを document.getElementById で探して外す。shadow root の中では見つからずに残り、
      // WebGL のキャンバスがその下にずれる(blend もそちらに掛かる)ので、ここで外す(同じ id の、p5 が描いていない方)
      const webgl = isWebglPreset(preset);
      const main = webgl ? preset.p5.canvas : null;
      if (main && main.id) {
        const left = layerDiv.querySelectorAll('canvas');
        for (let i = 0; i < left.length; i++) {
          if (left[i] !== main && left[i].id === main.id) left[i].remove();
        }
      }

      // Apply blend mode to new canvas(WebGL は p5 が描いているキャンバス)
      const canvas = main || layerDiv.querySelector('canvas');
      if (canvas) {
        canvas.style.mixBlendMode = this._effectiveBlendMode();
      }
      if (this._fpsThrottled) this._setLayerFps(preset, THROTTLED_FPS);

      const layer = { preset: preset, container: layerDiv, auto: !!auto, drawMs: 0, draws: 0 };
      this._timeLayer(layer);
      this.activeLayers.set(presetName, layer);
      this._holdHeavyCheck();
      if (webgl) this._removeOtherWebglLayers(presetName);

      // レイヤー上限(iPad / iPhone は 3、それ以外は 5)。超えたら古いものから外す
      while (this.activeLayers.size > this._maxLayers) {
        this._removeLayer(this.activeLayers.keys().next().value);
      }

      // Fade in on next frame
      requestAnimationFrame(() => { layerDiv.style.opacity = '1'; });

    }

    // WebGL のレイヤーは同時に 1 枚まで(#42): keep のほかの WebGL のレイヤーをフェードで外す。
    // ページあたりの WebGL コンテキストの数には上限があり、iPad では 1 枚でも重い
    _removeOtherWebglLayers(keep) {
      for (const [name, layer] of [...this.activeLayers]) {
        if (name === keep || !isWebglPreset(layer.preset)) continue;
        this._removeLayer(name);
        if (this.currentPresetName === name) {
          this.currentPreset = null;
          this.currentPresetName = null;
        }
      }
    }

    _removeLayer(presetName) {
      const layer = this.activeLayers.get(presetName);
      if (!layer) return;

      this.activeLayers.delete(presetName);
      this._holdHeavyCheck();

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
     * auto: Auto が選んだもの(popup のトグル ON で Auto を始めるとき)
     */
    startPreset(presetName, auto) {
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
      this._addLayer(presetName, auto);
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
        self._trackHeavy(timestamp);

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

    // --- 重いプリセット(#40) ---

    // レイヤーの p5 の redraw を包んで、1 フレームを描く時間を貯める(どのレイヤーが重いかを決める)
    _timeLayer(layer) {
      const p = layer.preset && layer.preset.p5;
      if (!p || typeof p.redraw !== 'function') return;
      const redraw = p.redraw;
      p.redraw = function() {
        const t = performance.now();
        try {
          return redraw.apply(this, arguments);
        } finally {
          layer.drawMs += performance.now() - t;
          layer.draws++;
        }
      };
    }

    _resetDrawTimes() {
      for (const [, layer] of this.activeLayers) {
        layer.drawMs = 0;
        layer.draws = 0;
      }
    }

    // レイヤーを足した・外したとき: フェードが終わって HEAVY_SETTLE_MS たつまで数えない(次のフレームの時刻から)
    _holdHeavyCheck() {
      const fadeMs = this._fadeDuration > 0 ? this._fadeDuration * 1000 : 0;
      this._heavyHoldMs = Math.max(this._heavyHoldMs, fadeMs + HEAVY_SETTLE_MS);
    }

    // 1 秒ごとの fps を見て、HEAVY_FPS を HEAVY_SECONDS 秒続けて割ったら _skipHeavy。
    // タブが裏・フェード中(とその後)・dip 中・Auto の休み中は数えず、続けて割った秒数も数え直す
    _trackHeavy(now) {
      if (this._heavySkipOff) return;
      if (this._heavyHoldMs > 0) {
        this._heavyHoldUntil = Math.max(this._heavyHoldUntil, now + this._heavyHoldMs);
        this._heavyHoldMs = 0;
      }
      if (document.hidden || now < this._heavyHoldUntil || this._dipDownTimer || this._dipUpTimer
        || this._autoResting || this.activeLayers.size === 0) {
        this._heavyMeter = null;
        return;
      }
      const m = this._heavyMeter;
      // 初回・rAF が止まっていた(タブが裏にいた)ときは数え直す(外したあとの確かめも続けた 3 秒で見直す)
      if (!m || now - m.last > 1000) {
        this._heavyMeter = { start: now, last: now, frames: 0, low: 0, lowFps: 0 };
        this._resetDrawTimes();
        if (this._heavyPending) this._heavyPending.samples = [];
        return;
      }
      m.last = now;
      m.frames++;
      if (now - m.start < 1000) return;
      const fps = m.frames * 1000 / (now - m.start);
      m.start = now;
      m.frames = 0;
      if (this._heavyPending) this._confirmHeavy(fps);
      if (this._heavySkipOff) return;
      if (fps >= HEAVY_FPS) {
        // 描く時間は、割り続けている間の分だけで比べる
        m.low = 0;
        m.lowFps = 0;
        this._resetDrawTimes();
        return;
      }
      m.low++;
      m.lowFps += fps;
      if (m.low >= HEAVY_SECONDS) {
        this._heavyMeter = null;
        this._skipHeavy(m.lowFps / m.low);
      }
    }

    // 1 フレームを描く時間が一番長いレイヤー(1 枚ならそれ)
    _heaviestLayer() {
      let heaviest = null;
      let worst = -1;
      for (const [name, layer] of this.activeLayers) {
        const ms = layer.draws > 0 ? layer.drawMs / layer.draws : 0;
        if (ms > worst) {
          heaviest = name;
          worst = ms;
        }
      }
      return heaviest;
    }

    // 一番重いレイヤーをフェードで外して、プールの別のものに入れ替える。端末に覚えるかは外したあとの fps で決める(_confirmHeavy)。
    // 手で選んだレイヤー・エフェクトのロック中は外さない(覚えもしない)
    _skipHeavy(fps) {
      const name = this._heaviestLayer();
      const layer = name && this.activeLayers.get(name);
      if (!layer || !layer.auto || this._effectLock) return;
      this._heavyPresets.add(name);
      const replacement = this._pickReplacement(name);
      this._removeLayer(name);
      if (this.currentPresetName === name) {
        this.currentPreset = null;
        this.currentPresetName = null;
      }
      if (replacement) this._addReplacement(replacement);
      this._heavyPending = { name: name, fps: Math.round(fps * 10) / 10, replacement: replacement || null, samples: [] };
    }

    // 外したあとの HEAVY_SECONDS 秒(フェードが終わって HEAVY_SETTLE_MS たってから続けて)の平均が HEAVY_FPS 以上なら、
    // SW に知らせて端末に覚えてもらう(bridge 経由)。割ったままならページ自体が重いので覚えない(このページでも選び直してよい)。
    // そのときは、外しても軽くならないので、このエンジンではもう飛ばさない(入れ替え続けない)
    _confirmHeavy(fps) {
      const pending = this._heavyPending;
      pending.samples.push(fps);
      if (pending.samples.length < HEAVY_SECONDS) return;
      this._heavyPending = null;
      const avg = pending.samples.reduce((sum, v) => sum + v, 0) / pending.samples.length;
      if (avg < HEAVY_FPS) {
        this._heavyPresets.delete(pending.name);
        this._heavySkipOff = true;
        this._heavyMeter = null;
        return;
      }
      window.postMessage({
        source: 'vjam-fx-engine', type: 'heavyPreset',
        name: pending.name, fps: pending.fps, replacement: pending.replacement,
      }, window.location.origin || '*');
    }

    // 入れ替え先: プールから、出ているもの・このページで重いと分かったものを除いて 1 つ。読み込み済みのものを優先。
    // 外すもの(replacing)のほかに WebGL のレイヤーが残るなら WebGL は選ばない(足すと残っている方が消える)
    _pickReplacement(replacing) {
      let webglLeft = false;
      for (const [name, layer] of this.activeLayers) {
        if (name !== replacing && isWebglPreset(layer.preset)) webglLeft = true;
      }
      const pool = (this._poolPresets || []).filter(n => !this.activeLayers.has(n) && !this._heavyPresets.has(n)
        && !(webglLeft && this._webglPresets.has(n)));
      if (pool.length === 0) return null;
      const ready = pool.filter(n => window.VJamFX && window.VJamFX.presets[n]);
      return pickOne(ready.length ? ready : pool);
    }

    // 読み込み済みならすぐ足す。Next で選んだものしか読み込んでいないときは、SW に読み込んでもらってから足す(_onPresetInjected)
    _addReplacement(name) {
      if (window.VJamFX && window.VJamFX.presets[name]) {
        this._addLayer(name, true);
        return;
      }
      this._pendingPreset = name;
      window.postMessage({ source: 'vjam-fx-engine', type: 'injectPreset', name: name }, window.location.origin || '*');
    }

    // 頼んだ入れ替え先が読み込まれた。その間に Auto / Next / OFF で入れ替わっていたら(_pendingPreset が消えていたら)足さない
    _onPresetInjected(name) {
      if (!name || name !== this._pendingPreset) return;
      this._pendingPreset = null;
      if (this.active && !this.activeLayers.has(name)) this._addLayer(name, true);
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
      this._heavyMeter = null;
      this._heavyHoldMs = 0;
      this._heavyHoldUntil = 0;
      this._pendingPreset = null;
      // 確かめ終わっていないものは覚えない
      if (this._heavyPending) {
        this._heavyPresets.delete(this._heavyPending.name);
        this._heavyPending = null;
      }
    }

    destroy() {
      this._stopAutoCycle();
      this._destroyVideoAudio();
      if (this._textOverlay) { this._textOverlay.destroy(); this._textOverlay = null; }
      this.stop();

      this._removeOverlay();
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

    // smooth: Auto の休みで戻すとき(dip で掛ける)
    clearFilters(smooth) {
      this.activeFilters.clear();
      this._rndFilter = '';
      if (!smooth || !this._dip()) this._applyFilters();
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
      this._cancelDip();
      // Immediately destroy all layers (no fade) unless effect locked
      if (!locks.effect) {
        for (const [, layer] of this.activeLayers) {
          try { layer.preset.destroy(); } catch (e) { console.warn('VJam FX: kill destroy error', e); }
          try { layer.container.remove(); } catch (e) { /* ignore */ }
        }
        this.activeLayers.clear();
        this.currentPreset = null;
        this.currentPresetName = null;
        this._pendingPreset = null;
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
     * Next: 今のレイヤーをフェードアウトして、presetNames をフェードインする(kill + start のフェード版)。
     * ロックしていない filter は外し、blend は options.blendMode(無ければ screen)にする。どちらもすぐ掛ける(押した反応)。
     * 不透明度は人が設定した値のまま。Auto / Rnd のタイマーは止める(popup が必要なら送り直す)
     * options.poolPresets: Next が選んだプール(入れたレイヤーが重かったときの入れ替え先)
     * options.webgl: WebGL のプリセット名(入れ替え先で WebGL を 2 枚にしない)
     */
    crossfade(presetNames, options) {
      const locks = (options && options.locks) || {};
      this._stopAutoCycle();
      this._stopAutoFX();
      if (!locks.filter) this.clearFilters();
      if (!locks.blend) this.setBlendMode((options && options.blendMode) || 'screen');
      this._effectLock = !!locks.effect;
      if (options && Array.isArray(options.poolPresets)) this._poolPresets = options.poolPresets;
      if (options && Array.isArray(options.webgl)) this._webglPresets = new Set(options.webgl);
      if (locks.effect) return;

      for (const name of [...this.activeLayers.keys()]) this._removeLayer(name);
      this.currentPreset = null;
      this.currentPresetName = null;
      this._pendingPreset = null;
      if (!presetNames || presetNames.length === 0) return;

      this._ensureListeners();
      for (const name of presetNames) this._addLayer(name, true);
      this.currentPresetName = presetNames[0];
      const first = this.activeLayers.get(presetNames[0]);
      if (first) this.currentPreset = first.preset;
      this.active = true;
      this._startLoop();
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
    // 4〜6 回に 1 回は休む(フェードアウトして、消えてから 0.5 秒後に切り替え)

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
      this._poolPresets = presetNames;
      // プールの webgl: WebGL のプリセット名(popup がカタログから入れる。SW もプールごと渡す)
      if (this._autoCyclePool && Array.isArray(this._autoCyclePool.webgl)) this._webglPresets = new Set(this._autoCyclePool.webgl);
      this._effectLock = !!this._autoCycleLocks.effect;
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
      // 休み(その間の拍では切り替えない)
      this._autoSwitchCount = 0;
      this._autoRestAt = 4 + Math.floor(Math.random() * 3);
      this._autoCycleBeats = -Infinity;
      this._autoCycleRest();
    }

    // 休み: ロックされていないレイヤーをフェードアウトし、消えたら Rnd が回している blend / filter を既定(screen / なし)に戻す。
    // その 0.5 秒後に普通の切り替え(次のセットがフェードイン)。エフェクトのロック中はレイヤーが残るので、待たずに dip で戻す
    _autoCycleRest() {
      const locks = this._autoCycleLocks || {};
      this._autoResting = true;
      if (!locks.effect) {
        for (const name of [...this.activeLayers.keys()]) this._removeLayer(name);
      }
      this._autoCycleLater(locks.effect ? 0 : this._fadeDuration * 1000, () => {
        if (this._autoBlend && !locks.blend) this.setBlendMode('screen', locks.effect);
        if (this._autoFilters && !locks.filter) this.clearFilters(locks.effect);
        this._autoCycleLater(REST_MS, () => {
          this._autoResting = false;
          this._autoCycleTick();
          this._scheduleAutoCycle();
        });
      });
    }

    // Auto のタイマーで ms 後に fn(0 ならすぐ)。その前に Auto を止めたら(_stopAutoCycle)呼ばない
    _autoCycleLater(ms, fn) {
      clearTimeout(this._autoCycleTimer);
      if (!(ms > 0)) {
        fn();
        return;
      }
      const timerId = setTimeout(() => {
        if (this._autoCycleTimer !== timerId) return;
        fn();
      }, ms);
      this._autoCycleTimer = timerId;
    }

    updateAutoCycleOptions(options) {
      if (!this._autoCyclePresets) return;
      if (options.autoBlend !== undefined) this._autoBlend = !!options.autoBlend;
      if (options.autoFilters !== undefined) this._autoFilters = !!options.autoFilters;
      if (options.locks !== undefined) {
        this._autoCycleLocks = options.locks || {};
        this._effectLock = !!this._autoCycleLocks.effect;
      }
      // プールを差し替える(popup で重いものを戻したとき)
      if (Array.isArray(options.presets) && options.presets.length > 0) {
        this._autoCyclePresets = options.presets;
        this._poolPresets = options.presets;
      }
    }

    _autoCycleTick() {
      if (!this._autoCyclePresets || this._autoCyclePresets.length === 0) return;
      // このページで重いと分かったものは選ばない(全部重ければプールのまま)
      const usable = this._autoCyclePresets.filter(n => !this._heavyPresets.has(n));
      const presets = usable.length ? usable : this._autoCyclePresets;
      const locks = this._autoCycleLocks || {};

      // Choose 1-3 random layers (unless effect locked)。WebGL は 1 本まで
      let chosen;
      if (locks.effect) {
        chosen = [...this.activeLayers.keys()];
        if (chosen.length === 0) {
          // Fallback: pick random if nothing active
          chosen = [presets[Math.floor(Math.random() * presets.length)]];
        }
      } else {
        const count = 1 + Math.floor(Math.random() * Math.min(3, presets.length));
        chosen = pickLayers(presets, count, this._webglPresets);

        // Remove layers not in chosen set
        for (const name of this.activeLayers.keys()) {
          if (!chosen.includes(name)) {
            this._removeLayer(name);
          }
        }

        // Add missing layers(残したものも Auto が選んだもの)
        for (const name of chosen) {
          if (!this.activeLayers.has(name)) {
            this._addLayer(name, true);
          } else {
            this.activeLayers.get(name).auto = true;
          }
        }
        this._pendingPreset = null;
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
      this._autoResting = false;
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
          this.startPreset(msg.preset, msg.auto);
          if (msg.blendMode) this.setBlendMode(msg.blendMode);
          break;
        case 'stop':
          this.stop();
          this._removeOverlay();
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
            this._addLayer(msg.preset, msg.auto);
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
        case 'crossfade':
          this.crossfade(msg.presets, { blendMode: msg.blendMode, locks: msg.locks, poolPresets: msg.poolPresets, webgl: msg.webgl });
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
          this.updateAutoCycleOptions({ autoBlend: msg.autoBlend, autoFilters: msg.autoFilters, locks: msg.locks, presets: msg.presets });
          break;
        case 'clearHeavyPresets':
          this._heavyPresets.clear();
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
      this._textOverlay = new window.VJamFX.TextOverlay(this._stage);
      this._textOverlay.init();
    }
  }

  window._vjamFxEngine = new VJamFXEngine();
  window.VJamFXEngine = VJamFXEngine;
})();
