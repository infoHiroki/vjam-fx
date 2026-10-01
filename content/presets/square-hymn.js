(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// Josef Albers「Homage to the Square」inspired
// Curated color palettes with smooth transitions

// 8 palettes: each is 4 colors [outer→inner] as {h, s, b} (HSB 360/100/100)
const PALETTES = [
  // Warm autumn
  [{ h: 20, s: 45, b: 30 }, { h: 30, s: 55, b: 48 }, { h: 42, s: 60, b: 65 }, { h: 50, s: 45, b: 82 }],
  // Cool blue
  [{ h: 215, s: 35, b: 28 }, { h: 220, s: 50, b: 42 }, { h: 200, s: 55, b: 58 }, { h: 190, s: 40, b: 78 }],
  // Earth & sky
  [{ h: 30, s: 50, b: 32 }, { h: 25, s: 60, b: 48 }, { h: 200, s: 40, b: 56 }, { h: 50, s: 45, b: 75 }],
  // Sunset glow
  [{ h: 345, s: 45, b: 35 }, { h: 10, s: 55, b: 52 }, { h: 30, s: 58, b: 70 }, { h: 50, s: 48, b: 85 }],
  // Forest depth
  [{ h: 130, s: 40, b: 25 }, { h: 100, s: 50, b: 40 }, { h: 70, s: 55, b: 58 }, { h: 85, s: 38, b: 72 }],
  // Royal violet
  [{ h: 270, s: 42, b: 30 }, { h: 280, s: 52, b: 45 }, { h: 300, s: 48, b: 62 }, { h: 260, s: 35, b: 78 }],
  // Warm mono
  [{ h: 35, s: 30, b: 25 }, { h: 35, s: 42, b: 42 }, { h: 35, s: 50, b: 58 }, { h: 35, s: 32, b: 75 }],
  // Complementary fire-ice
  [{ h: 5, s: 45, b: 30 }, { h: 200, s: 40, b: 42 }, { h: 355, s: 50, b: 60 }, { h: 185, s: 42, b: 78 }],
];

function lerpColor(a, b, t) {
  // Shortest-path hue interpolation
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return {
    h: (a.h + dh * t + 360) % 360,
    s: a.s + (b.s - a.s) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

class SquareHymnPreset extends BasePreset {
  constructor() {
    super();
    this.params = { speed: 1 };
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    // Palette state
    this.paletteIdx = 0;
    this.targetIdx = 0;
    this.transition = 1; // 1 = fully arrived
    // Current interpolated colors (avoid allocation in draw)
    this.colors = [
      { h: 0, s: 0, b: 0 }, { h: 0, s: 0, b: 0 },
      { h: 0, s: 0, b: 0 }, { h: 0, s: 0, b: 0 },
    ];
    this._applyPalette(0);
    // Echo compositions (4 corner positions)
    this.echoes = new Array(4);
    for (let i = 0; i < 4; i++) {
      this.echoes[i] = { palIdx: 0, life: 0, active: false };
    }
    this.echoTimer = 0;
  }

  _applyPalette(idx) {
    const pal = PALETTES[idx];
    for (let i = 0; i < 4; i++) {
      this.colors[i].h = pal[i].h;
      this.colors[i].s = pal[i].s;
      this.colors[i].b = pal[i].b;
    }
  }

  setup(container) {
    this.destroy();
    this.beatPulse = 0;
    this.paletteIdx = Math.floor(Math.random() * PALETTES.length);
    this.targetIdx = this.paletteIdx;
    this.transition = 1;
    this._applyPalette(this.paletteIdx);
    this.echoTimer = 0;
    for (let i = 0; i < 4; i++) this.echoes[i].active = false;
    const preset = this;

    this.p5 = new p5((p) => {
      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.colorMode(p.HSB, 360, 100, 100, 100);
        p.noStroke();
      };

      p.draw = () => {
        preset.beatPulse *= 0.9;
        const w = p.width;
        const h = p.height;
        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const treble = preset.audio.treble;

        // Palette transition
        if (preset.transition < 1) {
          preset.transition = Math.min(1, preset.transition + 0.012 * preset.params.speed);
          const src = PALETTES[preset.paletteIdx];
          const dst = PALETTES[preset.targetIdx];
          const t = preset.transition;
          // Ease-in-out
          const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) * (-2 * t + 2) / 2;
          for (let i = 0; i < 4; i++) {
            const c = lerpColor(src[i], dst[i], ease);
            preset.colors[i].h = c.h;
            preset.colors[i].s = c.s;
            preset.colors[i].b = c.b;
          }
          if (preset.transition >= 1) {
            preset.paletteIdx = preset.targetIdx;
          }
        }

        // Audio-driven color modulation (subtle)
        const satBoost = mid * 12;
        const briBoost = mid * 8;
        const hueShift = treble * 8;

        // Solid background (outer square color)
        const outerC = preset.colors[0];
        p.background(
          (outerC.h + hueShift) % 360,
          outerC.s + satBoost,
          outerC.b + briBoost
        );

        // === Main Albers composition ===
        const minDim = Math.min(w, h);
        const cx = w * 0.5;
        const cy = h * 0.5 + minDim * 0.02;
        const baseSize = minDim * 0.72;

        // Scale pulse: bass breathing + beat punch
        const breathe = 1 + Math.sin(p.frameCount * 0.015) * 0.008
          + bass * 0.04 + preset.beatPulse * 0.06;

        // Layer fractions (Albers proportions: each inner square is offset downward)
        const fracs = [0.82, 0.62, 0.42];

        p.rectMode(p.CENTER);

        for (let i = 0; i < 3; i++) {
          const c = preset.colors[i + 1]; // layers 1-3 (0 is background)
          const frac = fracs[i];
          const s = baseSize * frac * breathe;
          // Albers downward offset: each inner layer drops more
          const yOff = (1 - frac) * baseSize * 0.07;
          const hue = (c.h + hueShift) % 360;
          const sat = Math.min(100, c.s + satBoost);
          const bri = Math.min(100, c.b + briBoost);

          p.fill(hue, sat, bri);
          p.rect(cx, cy + yOff, s, s);
        }

        // Beat glow: inner luminous square
        if (preset.beatPulse > 0.15) {
          const innerC = preset.colors[3];
          const glowS = baseSize * 0.28 * breathe;
          const yOff = (1 - 0.42) * baseSize * 0.07;
          p.fill(
            (innerC.h + 30) % 360,
            innerC.s * 0.6,
            Math.min(100, innerC.b + 25),
            preset.beatPulse * 40
          );
          p.rect(cx, cy + yOff, glowS, glowS);
        }

        // === Corner echo compositions ===
        preset.echoTimer++;
        if (preset.echoTimer >= 80) {
          preset.echoTimer = 0;
          preset._spawnEcho();
        }

        // Corner positions (avoid center)
        const echoSize = minDim * 0.18;
        const margin = minDim * 0.14;
        const echoPos = [
          { x: margin + echoSize * 0.5, y: margin + echoSize * 0.5 },
          { x: w - margin - echoSize * 0.5, y: margin + echoSize * 0.5 },
          { x: margin + echoSize * 0.5, y: h - margin - echoSize * 0.5 },
          { x: w - margin - echoSize * 0.5, y: h - margin - echoSize * 0.5 },
        ];

        for (let i = 0; i < 4; i++) {
          const echo = preset.echoes[i];
          if (!echo.active) continue;
          echo.life -= 0.003;
          if (echo.life <= 0) { echo.active = false; continue; }

          const epal = PALETTES[echo.palIdx];
          const alpha = echo.life * 65;
          const pos = echoPos[i];
          const es = echoSize * (0.7 + echo.life * 0.3);

          // 3 nested squares (skip outermost as it blends with bg)
          for (let j = 0; j < 3; j++) {
            const frac = 1 - j * 0.28;
            const c = epal[j + 1];
            const yOff = (1 - frac) * es * 0.05;
            p.fill(
              (c.h + hueShift) % 360,
              c.s + satBoost * 0.5,
              c.b + briBoost * 0.5,
              alpha
            );
            p.rect(pos.x, pos.y + yOff, es * frac, es * frac);
          }
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
      };
    }, container);
  }

  _spawnEcho() {
    // Find inactive slot
    for (let i = 0; i < 4; i++) {
      if (!this.echoes[i].active) {
        this.echoes[i].palIdx = Math.floor(Math.random() * PALETTES.length);
        this.echoes[i].life = 1.0;
        this.echoes[i].active = true;
        return;
      }
    }
  }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
  }

  onBeat(strength) {
    this.beatPulse = strength;
    // Palette shift on beat
    if (this.transition >= 0.8) {
      let next;
      do { next = Math.floor(Math.random() * PALETTES.length); }
      while (next === this.targetIdx && PALETTES.length > 1);
      this.targetIdx = next;
      this.transition = 0;
    }
    // Strong beat spawns echo
    if (strength > 0.4) {
      this._spawnEcho();
    }
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['square-hymn'] = SquareHymnPreset;
})();
