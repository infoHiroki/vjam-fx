(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class OscilloscopeXyPreset extends BasePreset {
  constructor() {
    super();
    this.params = { speed: 1 };
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this.curveIndex = 0;
    this.phase = 0;
    // XY independent kicks
    this.xKick = 0;
    this.yKick = 0;
    // Color cycling
    this.colorIndex = 0;
  }

  setup(container) {
    this.destroy();
    const preset = this;

    // Vivid phosphor palette
    const COLORS = [
      [40, 200, 255],  // cyan
      [30, 255, 80],   // green
      [255, 60, 120],  // hot pink
      [255, 180, 30],  // orange
      [120, 60, 255],  // violet
      [255, 255, 50],  // yellow
    ];

    this.p5 = new p5((p) => {
      const CURVES = [
        // 0: Lissajous 3:2 + bass→X harmonics, treble→Y harmonics
        (t, ph, a, sx, sy) => ({
          x: (Math.sin(3 * t + ph) + a.bass * 0.5 * Math.sin(9 * t)) * sx,
          y: (Math.sin(2 * t) + a.treble * 0.4 * Math.sin(6 * t)) * sy,
        }),
        // 1: Rose r=cos(5θ), bass→radial X, treble→radial Y
        (t, ph, a, sx, sy) => {
          const r = Math.cos(5 * t + ph * 0.5) * (0.5 + a.rms * 0.5);
          return { x: r * Math.cos(t) * sx, y: r * Math.sin(t) * sy };
        },
        // 2: Butterfly (Fay), bass→X scale, treble→Y scale
        (t, ph, a, sx, sy) => {
          const r = (Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t)
            + Math.pow(Math.sin(t / 12 + ph), 5)) * 0.28;
          return { x: Math.sin(t) * r * sx * (0.7 + a.bass * 0.5), y: Math.cos(t) * r * sy * (0.7 + a.treble * 0.5) };
        },
        // 3: Hypotrochoid, mid→shape param, bass/treble→XY
        (t, ph, a, sx, sy) => {
          const R = 5, r = 3, d = 3.5 + a.mid * 3;
          const s = t + ph;
          const div = R + d;
          return {
            x: ((R - r) * Math.cos(s) + d * Math.cos((R - r) / r * s)) / div * 0.95 * sx,
            y: ((R - r) * Math.sin(s) - d * Math.sin((R - r) / r * s)) / div * 0.95 * sy,
          };
        },
        // 4: Lissajous 5:4 with AM, bass→AM depth on X, treble→Y amp
        (t, ph, a, sx, sy) => {
          const am = 0.5 + 0.5 * Math.sin(t * 0.1 + ph) * (1 + a.bass);
          return {
            x: Math.sin(5 * t + ph) * am * sx,
            y: Math.sin(4 * t) * (0.5 + a.treble * 0.6) * sy,
          };
        },
        // 5: Rose r=sin(7θ/3), bass→X spread, rms→Y spread
        (t, ph, a, sx, sy) => {
          const r = Math.sin(7 / 3 * t + ph * 0.3) * (0.6 + a.rms * 0.4);
          return { x: r * Math.cos(t) * sx * (0.8 + a.bass * 0.4), y: r * Math.sin(t) * sy };
        },
        // 6: Lemniscate + treble→X harmonics, mid→Y harmonics
        (t, ph, a, sx, sy) => {
          const s = t + ph;
          const base = Math.sin(s) / (1 + Math.cos(s) * Math.cos(s) + 0.01);
          return {
            x: (base * Math.cos(s) + a.treble * 0.35 * Math.sin(5 * s)) * sx,
            y: (base * Math.sin(s) + a.mid * 0.25 * Math.cos(7 * s)) * sy,
          };
        },
        // 7: Epitrochoid, bass→shape, XY independent
        (t, ph, a, sx, sy) => {
          const R = 3, r = 7, d = 4 + a.bass * 3;
          const s = t + ph;
          const div = R + r + d;
          return {
            x: ((R + r) * Math.cos(s) - d * Math.cos((R + r) / r * s)) / div * 0.95 * sx,
            y: ((R + r) * Math.sin(s) - d * Math.sin((R + r) / r * s)) / div * 0.95 * sy,
          };
        },
        // 8: Lissajous 7:5, mid→X wobble, bass→Y wobble
        (t, ph, a, sx, sy) => ({
          x: Math.sin(7 * t + ph + a.mid * 1.5 * Math.sin(t * 0.3)) * sx,
          y: Math.cos(5 * t + a.bass * Math.sin(t * 0.2)) * sy,
        }),
        // 9: Superformula, rms→shape morph, XY independent
        (t, ph, a, sx, sy) => {
          const m = 6, n3 = 1 + a.rms * 4;
          const angle = t + ph * 0.4;
          const r0 = Math.pow(
            Math.pow(Math.abs(Math.cos(m * angle / 4)), 1) +
            Math.pow(Math.abs(Math.sin(m * angle / 4)), n3),
            -1
          ) * 0.7;
          return { x: r0 * Math.cos(angle) * sx, y: r0 * Math.sin(angle) * sy };
        },
      ];

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.background(0);
      };

      p.draw = () => {
        const pulse = preset.beatPulse;
        preset.beatPulse *= 0.84;

        const bass = preset.audio.bass;
        const treble = preset.audio.treble;
        const mid = preset.audio.mid;
        const rms = preset.audio.rms;
        const a = preset.audio;

        // XY kicks decay
        preset.xKick *= 0.83;
        preset.yKick *= 0.86;

        // Phosphor decay
        const fadeAlpha = 10 + treble * 22;
        p.fill(0, fadeAlpha);
        p.noStroke();
        p.rect(0, 0, p.width, p.height);

        const cx = p.width / 2;
        const cy = p.height / 2;
        const baseR = Math.min(p.width, p.height) * 0.38;

        // XY independent scaling: bass→X, treble→Y, kicks add asymmetric bounce
        const scaleX = 0.5 + bass * 0.6 + preset.xKick * 0.7;
        const scaleY = 0.5 + treble * 0.5 + preset.yKick * 0.6;

        preset.phase += 0.008 * preset.params.speed * (1 + mid * 2.5);

        const curveFn = CURVES[preset.curveIndex % CURVES.length];
        const steps = 1200;
        const loops = 8;

        const col = COLORS[preset.colorIndex % COLORS.length];
        const cr = col[0], cg = col[1], cb = col[2];

        // 3-pass glow
        const passes = [
          { weight: 6 + pulse * 5, alphaMul: 0.5, colorMul: 0.4 },
          { weight: 2.5 + pulse * 2, alphaMul: 1.0, colorMul: 0.7 },
          { weight: 0.8 + pulse * 0.5, alphaMul: 2.0, colorMul: 1.0 },
        ];

        for (const pass of passes) {
          p.noFill();
          p.strokeWeight(pass.weight);
          let prevX = null, prevY = null;

          for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * Math.PI * 2 * loops;
            const pt = curveFn(t, preset.phase, a, scaleX, scaleY);

            const x = cx + pt.x * baseR;
            const y = cy + pt.y * baseR;

            if (prevX !== null) {
              const dx = x - prevX;
              const dy = y - prevY;
              const vel = Math.sqrt(dx * dx + dy * dy);
              const velFactor = Math.max(0.3, Math.min(1.3, 2.0 / (vel + 0.5)));

              const al = (20 + pulse * 20 + rms * 30) * pass.alphaMul * velFactor;
              p.stroke(
                cr * pass.colorMul,
                cg * pass.colorMul,
                cb * pass.colorMul,
                Math.min(200, al)
              );
              p.line(prevX, prevY, x, y);
            }
            prevX = x;
            prevY = y;
          }
        }

        // Beam dot
        const beamT = (p.frameCount * 0.05) % (Math.PI * 2 * loops);
        const beamPt = curveFn(beamT, preset.phase, a, scaleX, scaleY);
        p.noStroke();
        p.fill(cr, cg, cb, 40 + pulse * 60);
        const dotSize = 4 + rms * 6 + pulse * 8;
        p.ellipse(cx + beamPt.x * baseR, cy + beamPt.y * baseR, dotSize, dotSize);

        // CRT scanlines
        p.stroke(0, 0, 0, 20);
        p.strokeWeight(1);
        for (let sy = 0; sy < p.height; sy += 3) {
          p.line(0, sy, p.width, sy);
        }

        // Vignette
        const ctx = p.drawingContext;
        const vigR = Math.max(p.width, p.height) * 0.7;
        const grad = ctx.createRadialGradient(cx, cy, vigR * 0.35, cx, cy, vigR);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, p.width, p.height);

        // Beat flash in current color
        if (pulse > 0.4) {
          p.fill(cr * 0.2, cg * 0.2, cb * 0.2, pulse * 15);
          p.noStroke();
          p.rect(0, 0, p.width, p.height);
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
        p.background(0);
      };
    }, container);
  }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
  }

  onBeat(strength) {
    this.beatPulse = strength;
    // Asymmetric XY kick
    if (Math.random() > 0.5) {
      this.xKick = strength;
      this.yKick = strength * 0.2;
    } else {
      this.xKick = strength * 0.2;
      this.yKick = strength;
    }
    // Next curve + color
    this.curveIndex = (this.curveIndex + 1) % 10;
    this.colorIndex++;
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['oscilloscope-xy'] = OscilloscopeXyPreset;
})();
