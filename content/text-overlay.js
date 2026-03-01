(function() {
'use strict';

if (window.VJamFX && window.VJamFX.TextOverlay) return;
window.VJamFX = window.VJamFX || { presets: {} };

// --- Text Effects ---

const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:<>?/~`01';

const EFFECTS = {
  'big-flash': {
    setup(text, opts, state) { state.scale = 1; },
    draw(ctx, w, h, text, params, audio, state) {
      var DURATION = 3.0;
      var elapsed = params.elapsed, color = params.color, fontSize = params.fontSize, beat = params.beat, cx = params.cx, cy = params.cy;
      if (elapsed > DURATION) return true;
      var t = elapsed / DURATION;
      var popIn = elapsed < 0.15 ? 1.0 + (1 - elapsed / 0.15) * 0.4 : 1.0;
      state.scale = popIn * (1 + beat * 0.15);
      var alpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      var size = fontSize * state.scale;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = '900 ' + size + 'px ' + params.fontFamily;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = color; ctx.shadowBlur = 30 + beat * 40;
      ctx.fillStyle = color; ctx.fillText(text, cx, cy);
      ctx.shadowBlur = 10; ctx.fillText(text, cx, cy);
      ctx.restore();
      return false;
    },
  },
  'neon-sign': {
    setup(text, opts, state) { state.flickerTimer = 0; state.flickerState = true; },
    draw(ctx, w, h, text, params, audio, state) {
      var DURATION = 8.0;
      var elapsed = params.elapsed, color = params.color, fontSize = params.fontSize, beat = params.beat, cx = params.cx, cy = params.cy;
      if (elapsed > DURATION) return true;
      state.flickerTimer += 0.016;
      if (state.flickerTimer > 0.08 + Math.random() * 0.3) { state.flickerTimer = 0; state.flickerState = Math.random() > 0.15; }
      var alpha = 1;
      if (elapsed < 0.5) alpha = elapsed / 0.5;
      else if (elapsed > DURATION - 1.5) alpha = (DURATION - elapsed) / 1.5;
      if (!state.flickerState && elapsed > 0.3) alpha *= 0.2;
      var beatGlow = 1 + beat * 0.6;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = 'bold ' + fontSize + 'px ' + params.fontFamily;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = color; ctx.shadowBlur = 40 * beatGlow;
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeText(text, cx, cy);
      ctx.shadowBlur = 15 * beatGlow; ctx.fillStyle = '#fff'; ctx.fillText(text, cx, cy);
      ctx.shadowBlur = 0; ctx.globalAlpha = Math.max(0, alpha * 0.7);
      ctx.fillStyle = color; ctx.fillText(text, cx, cy);
      ctx.restore();
      return false;
    },
  },
  'typewriter': {
    setup(text, opts, state) { state.cursorBlink = 0; },
    draw(ctx, w, h, text, params, audio, state) {
      var CHAR_DELAY = 0.08, HOLD_TIME = 3.0;
      var elapsed = params.elapsed, color = params.color, fontSize = params.fontSize, beat = params.beat, cx = params.cx, cy = params.cy;
      var typingDuration = text.length * CHAR_DELAY;
      var totalDuration = typingDuration + HOLD_TIME + 1.0;
      if (elapsed > totalDuration) return true;
      var charsShown = Math.min(text.length, Math.floor(elapsed / CHAR_DELAY));
      var displayText = text.substring(0, charsShown);
      var alpha = 1;
      if (elapsed > totalDuration - 1.0) alpha = (totalDuration - elapsed) / 1.0;
      state.cursorBlink += 0.016;
      var showCursor = charsShown < text.length || Math.sin(state.cursorBlink * 6) > 0;
      var size = fontSize * (1 + beat * 0.05);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = 'bold ' + size + 'px ' + params.fontFamily;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = color; ctx.shadowBlur = 8 + beat * 20;
      ctx.fillStyle = color;
      ctx.fillText(displayText + (showCursor ? '_' : ''), cx, cy);
      ctx.restore();
      return false;
    },
  },
  'scroll-h': {
    setup(text, opts, state) {},
    draw(ctx, w, h, text, params, audio, state) {
      var SPEED = 150, DURATION = 15.0;
      var elapsed = params.elapsed, color = params.color, fontSize = params.fontSize, beat = params.beat, cy = params.cy;
      if (elapsed > DURATION) return true;
      var size = fontSize * (1 + beat * 0.08);
      ctx.save();
      ctx.font = '900 ' + size + 'px ' + params.fontFamily;
      ctx.textBaseline = 'middle';
      var textWidth = ctx.measureText(text).width;
      var x = w - elapsed * SPEED;
      var alpha = 1;
      if (elapsed < 0.3) alpha = elapsed / 0.3;
      if (elapsed > DURATION - 0.5) alpha = (DURATION - elapsed) / 0.5;
      var loopX = ((x % (textWidth + w)) + textWidth + w) % (textWidth + w) - textWidth;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.shadowColor = color; ctx.shadowBlur = 12 + beat * 25;
      ctx.fillStyle = color; ctx.fillText(text, loopX, cy);
      ctx.restore();
      return false;
    },
  },
  'glitch-text': {
    setup(text, opts, state) {},
    draw(ctx, w, h, text, params, audio, state) {
      var DURATION = 5.0;
      var elapsed = params.elapsed, color = params.color, fontSize = params.fontSize, beat = params.beat, cx = params.cx, cy = params.cy;
      if (elapsed > DURATION) return true;
      var alpha = 1;
      if (elapsed < 0.1) alpha = elapsed / 0.1;
      if (elapsed > DURATION - 0.8) alpha = (DURATION - elapsed) / 0.8;
      var glitchIntensity = 0.3 + beat * 0.7;
      var displayText = '';
      for (var i = 0; i < text.length; i++) {
        displayText += Math.random() < glitchIntensity * 0.15 ? GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)] : text[i];
      }
      var offsetX = (Math.random() - 0.5) * glitchIntensity * 8;
      var offsetY = (Math.random() - 0.5) * glitchIntensity * 4;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = '900 ' + fontSize + 'px ' + params.fontFamily;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var px = cx + offsetX, py = cy + offsetY;
      var rgbOffset = glitchIntensity * 6;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,0,0,' + alpha * 0.8 + ')'; ctx.fillText(displayText, px - rgbOffset, py);
      ctx.fillStyle = 'rgba(0,255,0,' + alpha * 0.8 + ')'; ctx.fillText(displayText, px + rgbOffset * 0.5, py - rgbOffset * 0.3);
      ctx.fillStyle = 'rgba(0,100,255,' + alpha * 0.8 + ')'; ctx.fillText(displayText, px + rgbOffset * 0.3, py + rgbOffset * 0.5);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.max(0, alpha * 0.5);
      ctx.fillStyle = '#fff'; ctx.fillText(displayText, px, py);
      ctx.restore();
      return false;
    },
  },
  'wave-text': {
    setup(text, opts, state) {},
    draw(ctx, w, h, text, params, audio, state) {
      var DURATION = 6.0, WAVE_SPEED = 4, WAVE_AMP = 20;
      var elapsed = params.elapsed, color = params.color, fontSize = params.fontSize, beat = params.beat, cx = params.cx, cy = params.cy;
      if (elapsed > DURATION) return true;
      var alpha = 1;
      if (elapsed < 0.3) alpha = elapsed / 0.3;
      if (elapsed > DURATION - 1.0) alpha = (DURATION - elapsed) / 1.0;
      var size = fontSize * (1 + beat * 0.08);
      var amp = WAVE_AMP * (1 + beat * 1.5);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = 'bold ' + size + 'px ' + params.fontFamily;
      ctx.textBaseline = 'middle';
      var totalWidth = ctx.measureText(text).width;
      var x = cx - totalWidth / 2;
      ctx.shadowColor = color; ctx.shadowBlur = 10 + beat * 20;
      ctx.fillStyle = color;
      for (var i = 0; i < text.length; i++) {
        var charWidth = ctx.measureText(text[i]).width;
        var yOffset = Math.sin(elapsed * WAVE_SPEED + i * 0.5) * amp;
        ctx.fillText(text[i], x, cy + yOffset);
        x += charWidth;
      }
      ctx.restore();
      return false;
    },
  },
  'bounce-in': {
    setup(text, opts, state) {},
    draw(ctx, w, h, text, params, audio, state) {
      var CHAR_DELAY = 0.12, HOLD_TIME = 3.0, BOUNCE_HEIGHT = 200;
      var elapsed = params.elapsed, color = params.color, fontSize = params.fontSize, beat = params.beat, cx = params.cx, cy = params.cy;
      var animDuration = text.length * CHAR_DELAY + 0.6;
      var totalDuration = animDuration + HOLD_TIME + 1.0;
      if (elapsed > totalDuration) return true;
      var alpha = 1;
      if (elapsed > totalDuration - 1.0) alpha = (totalDuration - elapsed) / 1.0;
      var size = fontSize * (1 + beat * 0.05);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = '900 ' + size + 'px ' + params.fontFamily;
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color; ctx.shadowBlur = 8 + beat * 15;
      ctx.fillStyle = color;
      var totalWidth = ctx.measureText(text).width;
      var x = cx - totalWidth / 2;
      for (var i = 0; i < text.length; i++) {
        var charWidth = ctx.measureText(text[i]).width;
        var charElapsed = elapsed - i * CHAR_DELAY;
        if (charElapsed <= 0) { x += charWidth; continue; }
        var bounceT = Math.min(1, charElapsed / 0.6);
        var t2 = bounceT;
        var bounceVal;
        if (t2 < 1/2.75) bounceVal = 7.5625*t2*t2;
        else if (t2 < 2/2.75) { t2-=1.5/2.75; bounceVal=7.5625*t2*t2+0.75; }
        else if (t2 < 2.5/2.75) { t2-=2.25/2.75; bounceVal=7.5625*t2*t2+0.9375; }
        else { t2-=2.625/2.75; bounceVal=7.5625*t2*t2+0.984375; }
        var bounceY = (1 - bounceVal) * BOUNCE_HEIGHT;
        var charAlpha = Math.min(1, charElapsed / 0.1);
        ctx.globalAlpha = Math.max(0, alpha * charAlpha);
        ctx.fillText(text[i], x, cy - bounceY);
        x += charWidth;
      }
      ctx.restore();
      return false;
    },
  },
  'rain-text': {
    setup(text, opts, state) {
      state.drops = [];
      var w = opts.w, h = opts.h, fontSize = opts.fontSize;
      var count = Math.min(60, text.length * 3);
      for (var i = 0; i < count; i++) {
        state.drops.push({
          char: text[Math.floor(Math.random() * text.length)],
          x: Math.random() * w, y: Math.random() * h,
          speed: 100 + Math.random() * 200,
          size: fontSize * (0.5 + Math.random() * 0.8),
          alpha: 0.4 + Math.random() * 0.6,
          rotation: (Math.random() - 0.5) * 0.3,
        });
      }
    },
    draw(ctx, w, h, text, params, audio, state) {
      var DURATION = 8.0;
      var elapsed = params.elapsed, color = params.color, fontSize = params.fontSize, beat = params.beat;
      if (elapsed > DURATION) return true;
      var alpha = 1;
      if (elapsed < 0.3) alpha = elapsed / 0.3;
      if (elapsed > DURATION - 1.5) alpha = (DURATION - elapsed) / 1.5;
      var spawnRate = 2 + beat * 5;
      for (var s = 0; s < spawnRate && state.drops.length < 60; s++) {
        state.drops.push({
          char: text[Math.floor(Math.random() * text.length)],
          x: Math.random() * w, y: -fontSize,
          speed: 100 + Math.random() * 200,
          size: fontSize * (0.5 + Math.random() * 0.8),
          alpha: 0.4 + Math.random() * 0.6,
          rotation: (Math.random() - 0.5) * 0.3,
        });
      }
      ctx.save();
      var speedMult = 1 + beat * 0.5;
      for (var i = state.drops.length - 1; i >= 0; i--) {
        var d = state.drops[i];
        d.y += d.speed * speedMult * 0.016;
        if (d.y > h + d.size) { state.drops.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, d.alpha * alpha);
        ctx.font = 'bold ' + d.size + 'px ' + params.fontFamily;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = color; ctx.shadowBlur = 6 + beat * 12;
        ctx.fillStyle = color;
        ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rotation);
        ctx.fillText(d.char, 0, 0); ctx.restore();
      }
      ctx.restore();
      return false;
    },
  },
};

var TEXT_EFFECT_NAMES = Object.keys(EFFECTS);

// --- Fonts ---

var FONTS = {
  'sans': '"Helvetica Neue", Arial, sans-serif',
  'bebas': '"Bebas Neue", sans-serif',
  'space': '"Space Grotesk", sans-serif',
  'righteous': '"Righteous", sans-serif',
  'space-mono': '"Space Mono", monospace',
  'vt323': '"VT323", monospace',
  'orbitron': '"Orbitron", sans-serif',
  'press-start': '"Press Start 2P", monospace',
  'monoton': '"Monoton", sans-serif',
  'bangers': '"Bangers", sans-serif',
};

var TEXT_FONT_NAMES = Object.keys(FONTS);

var _loadedFonts = {};
function loadGoogleFont(fontKey) {
  if (_loadedFonts[fontKey] || fontKey === 'sans') return;
  _loadedFonts[fontKey] = true;
  var familyMap = {
    'bebas': 'Bebas+Neue', 'space': 'Space+Grotesk:wght@700',
    'righteous': 'Righteous', 'space-mono': 'Space+Mono:wght@700',
    'vt323': 'VT323', 'orbitron': 'Orbitron:wght@900',
    'press-start': 'Press+Start+2P', 'monoton': 'Monoton',
    'bangers': 'Bangers',
  };
  var family = familyMap[fontKey];
  if (!family) return;
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=' + family + '&display=swap';
  document.head.appendChild(link);
}

// --- Position ---

var POSITION_PRESETS = {
  center: { rx: 0.5, ry: 0.5 }, top: { rx: 0.5, ry: 0.2 },
  bottom: { rx: 0.5, ry: 0.8 }, left: { rx: 0.25, ry: 0.5 }, right: { rx: 0.75, ry: 0.5 },
};

function resolvePosition(pos) {
  if (pos === 'random') return { rx: 0.15 + Math.random() * 0.7, ry: 0.15 + Math.random() * 0.7 };
  return POSITION_PRESETS[pos] || POSITION_PRESETS.center;
}

// --- TextOverlay Class ---

var MAX_INSTANCES = 8;

class TextOverlay {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.ctx = null;
    this.resizeObserver = null;
    this.instances = [];
    this.pendingEffect = 'big-flash';
    this.pendingPosition = 'center';
    this.pendingFont = 'sans';
    this.fontSize = 80;
    this.color = '#ffffff';
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
    this.beatStrength = 0;
    this.beatDecay = 0;
    this.autoTextEnabled = false;
    this._autoTextTimer = null;
  }

  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.container.clientWidth || window.innerWidth;
    this.canvas.height = this.container.clientHeight || window.innerHeight;
    this.canvas.style.cssText = 'display:block;pointer-events:none;position:absolute;top:0;left:0;width:100%;height:100%;';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.resizeObserver = new ResizeObserver(function() {
      this.canvas.width = this.container.clientWidth;
      this.canvas.height = this.container.clientHeight;
    }.bind(this));
    this.resizeObserver.observe(this.container);
  }

  destroy() {
    this.stopAutoText();
    if (this.resizeObserver) { this.resizeObserver.disconnect(); this.resizeObserver = null; }
    if (this.canvas) { this.canvas.remove(); this.canvas = null; }
    this.ctx = null;
    this.instances = [];
  }

  setParams(params) {
    if (params.fontSize !== undefined) this.fontSize = Math.max(20, Math.min(300, params.fontSize));
    if (params.color !== undefined) this.color = params.color;
    if (params.effect !== undefined && EFFECTS[params.effect]) this.pendingEffect = params.effect;
    if (params.font !== undefined && FONTS[params.font]) { this.pendingFont = params.font; loadGoogleFont(params.font); }
    if (params.position !== undefined) this.pendingPosition = params.position;
  }

  displayText(text, effectName, position) {
    if (!text) return;
    var eName = (effectName && EFFECTS[effectName]) ? effectName : this.pendingEffect;
    var pos = position || this.pendingPosition;
    var resolved = resolvePosition(pos);
    var state = {};
    var effect = EFFECTS[eName];
    if (effect && effect.setup) {
      effect.setup(text, { fontSize: this.fontSize, color: this.color, w: this.canvas.width, h: this.canvas.height }, state);
    }
    this.instances.push({
      text: text, effectName: eName, fontSize: this.fontSize, color: this.color,
      fontFamily: FONTS[this.pendingFont] || FONTS['sans'],
      rx: resolved.rx, ry: resolved.ry, startTime: performance.now(), state: state, beatDecay: 0,
    });
    while (this.instances.length > MAX_INSTANCES) this.instances.shift();
  }

  clearAll() { this.instances = []; }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
    this.audio.strength = audioData.strength || 0;
  }

  onBeat(strength) {
    this.beatStrength = strength;
    this.beatDecay = 1.0;
    for (var i = 0; i < this.instances.length; i++) this.instances[i].beatDecay = 1.0;
  }

  tick() {
    var ctx = this.ctx;
    if (!ctx) return;
    var w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    this.beatDecay *= 0.92;
    var writeIdx = 0;
    for (var i = 0; i < this.instances.length; i++) {
      var inst = this.instances[i];
      inst.beatDecay *= 0.92;
      var effect = EFFECTS[inst.effectName];
      if (!effect) continue;
      var elapsed = (performance.now() - inst.startTime) / 1000;
      var done = effect.draw(ctx, w, h, inst.text, {
        fontSize: inst.fontSize, color: inst.color, fontFamily: inst.fontFamily,
        elapsed: elapsed, beat: inst.beatDecay, beatStrength: this.beatStrength,
        cx: inst.rx * w, cy: inst.ry * h,
      }, this.audio, inst.state);
      if (!done) this.instances[writeIdx++] = inst;
    }
    this.instances.length = writeIdx;
  }

  startAutoText(text) {
    this.stopAutoText();
    if (!text) return;
    this.autoTextEnabled = true;
    var self = this;
    var autoTick = function() {
      var effectNames = TEXT_EFFECT_NAMES;
      var effect = effectNames[Math.floor(Math.random() * effectNames.length)];
      var colors = ['#ffffff','#00ff88','#ff0066','#00ccff','#ffcc00','#ff6600','#cc00ff'];
      self.color = colors[Math.floor(Math.random() * colors.length)];
      var fontKey = TEXT_FONT_NAMES[Math.floor(Math.random() * TEXT_FONT_NAMES.length)];
      self.pendingFont = fontKey;
      loadGoogleFont(fontKey);
      self.fontSize = 40 + Math.floor(Math.random() * 100);
      self.displayText(text, effect, 'random');
      var interval = 3000 + Math.random() * 4000;
      if (self.audio.bpm > 0) {
        interval = (60 / self.audio.bpm) * 8 * 1000;
        interval = Math.max(2000, Math.min(8000, interval));
      }
      self._autoTextTimer = setTimeout(autoTick, interval);
    };
    autoTick();
  }

  stopAutoText() {
    this.autoTextEnabled = false;
    if (this._autoTextTimer) { clearTimeout(this._autoTextTimer); this._autoTextTimer = null; }
  }
}

window.VJamFX.TextOverlay = TextOverlay;
window.VJamFX.TEXT_EFFECT_NAMES = TEXT_EFFECT_NAMES;
window.VJamFX.TEXT_FONT_NAMES = TEXT_FONT_NAMES;
})();
