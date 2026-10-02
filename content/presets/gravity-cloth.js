(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class GravityClothPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this.pendingBeats = [];
  }

  setup(container) {
    this.destroy();
    this.pendingBeats = [];
    const preset = this;

    this.p5 = new p5((p) => {
      const COLS = 40;
      const ROWS = 25;
      const nodes = [];      // flat array: [row * COLS + col]
      const ripples = [];    // { cx, cy, time, strength }
      const sparks = [];     // { x, y, vx, vy, life, hue }
      let sparkW = 0;
      let hueOffset = 0;
      let spacingX, spacingY;

      function initGrid() {
        nodes.length = 0;
        spacingX = p.width / (COLS - 1);
        spacingY = p.height / (ROWS - 1);
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            nodes.push({
              baseX: c * spacingX,
              baseY: r * spacingY,
              offsetZ: 0,
              vel: 0
            });
          }
        }
      }

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.colorMode(p.HSB, 360, 100, 100, 100);
        initGrid();
      };

      p.draw = () => {
        p.background(0);
        preset.beatPulse *= 0.92;

        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const treble = preset.audio.treble;

        // Drain beat queue → spawn ripples + sparks
        for (let b = 0; b < preset.pendingBeats.length; b++) {
          const str = preset.pendingBeats[b].strength;
          ripples.push({
            cx: p.random(COLS * 0.2, COLS * 0.8) | 0,
            cy: p.random(ROWS * 0.2, ROWS * 0.8) | 0,
            time: 0,
            strength: str
          });
          // Sparks burst
          const sx = p.random(p.width * 0.2, p.width * 0.8);
          const sy = p.random(p.height * 0.2, p.height * 0.8);
          const count = (8 + str * 12) | 0;
          for (let i = 0; i < count; i++) {
            const ang = p.random(p.TWO_PI);
            const spd = p.random(1, 4) * str;
            if (sparks.length < 300) {
              sparks.push({ x: sx, y: sy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1, hue: (hueOffset + p.random(60)) % 360 });
            }
          }
        }
        preset.pendingBeats.length = 0;

        // Propagate ripples → node offsets
        for (let i = ripples.length - 1; i >= 0; i--) {
          const rip = ripples[i];
          rip.time += 0.4 + bass * 0.3;
          if (rip.time > 30) { ripples.splice(i, 1); continue; }
          const radius = rip.time;
          const amp = rip.strength * 12 * Math.max(0, 1 - rip.time / 30);
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              const dx = c - rip.cx;
              const dy = r - rip.cy;
              const d = Math.sqrt(dx * dx + dy * dy);
              const wave = Math.sin((d - radius) * 0.8) * amp * Math.exp(-Math.abs(d - radius) * 0.15);
              nodes[r * COLS + c].vel += wave * 0.04;
            }
          }
        }

        // Bass ambient wave
        const t = p.frameCount * 0.02;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const n = nodes[r * COLS + c];
            const ambient = Math.sin(c * 0.3 + t) * Math.cos(r * 0.25 + t * 0.7) * (3 + bass * 15);
            n.vel += (ambient - n.offsetZ) * 0.03;
            n.vel *= 0.88;
            n.offsetZ += n.vel;
          }
        }

        // Hue shift from treble
        hueOffset = (hueOffset + treble * 2) % 360;

        // Draw glow lines (horizontal + vertical)
        p.noFill();
        const lineAlpha = 30 + mid * 50;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const idx = r * COLS + c;
            const n = nodes[idx];
            const x1 = n.baseX;
            const y1 = n.baseY + n.offsetZ;
            const hue = (hueOffset + n.offsetZ * 3 + c * 4) % 360;
            const bright = 50 + Math.abs(n.offsetZ) * 3 + mid * 30;

            // Horizontal line
            if (c < COLS - 1) {
              const n2 = nodes[idx + 1];
              const x2 = n2.baseX;
              const y2 = n2.baseY + n2.offsetZ;
              // Glow layer
              p.stroke(hue, 60, Math.min(bright, 100), lineAlpha * 0.3);
              p.strokeWeight(3 + preset.beatPulse * 2);
              p.line(x1, y1, x2, y2);
              // Core line
              p.stroke(hue, 50, Math.min(bright + 20, 100), lineAlpha);
              p.strokeWeight(1);
              p.line(x1, y1, x2, y2);
            }
            // Vertical line
            if (r < ROWS - 1) {
              const n2 = nodes[idx + COLS];
              const x2 = n2.baseX;
              const y2 = n2.baseY + n2.offsetZ;
              p.stroke(hue, 60, Math.min(bright, 100), lineAlpha * 0.3);
              p.strokeWeight(3 + preset.beatPulse * 2);
              p.line(x1, y1, x2, y2);
              p.stroke(hue, 50, Math.min(bright + 20, 100), lineAlpha);
              p.strokeWeight(1);
              p.line(x1, y1, x2, y2);
            }
          }
        }

        // Draw node dots
        p.noStroke();
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const n = nodes[r * COLS + c];
            const bright = 40 + Math.abs(n.offsetZ) * 4;
            const hue = (hueOffset + n.offsetZ * 3 + c * 4) % 360;
            p.fill(hue, 70, Math.min(bright + 30, 100), 60 + mid * 30);
            const sz = 2 + Math.abs(n.offsetZ) * 0.15 + preset.beatPulse * 2;
            p.ellipse(n.baseX, n.baseY + n.offsetZ, sz, sz);
          }
        }

        // Draw sparks
        sparkW = 0;
        for (let i = 0; i < sparks.length; i++) {
          const s = sparks[i];
          s.x += s.vx;
          s.y += s.vy;
          s.vy += 0.05;
          s.life -= 0.02;
          if (s.life <= 0) continue;
          p.fill(s.hue, 80, 100, s.life * 80);
          p.ellipse(s.x, s.y, s.life * 4, s.life * 4);
          sparks[sparkW++] = s;
        }
        sparks.length = sparkW;
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
        initGrid();
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
    this.pendingBeats.push({ strength });
    this.beatPulse = strength;
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['gravity-cloth'] = GravityClothPreset;
})();
