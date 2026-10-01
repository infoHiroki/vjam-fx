(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class NeonHorizonPreset extends BasePreset {
  constructor() {
    super();
    this.params = { speed: 1 };
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this.hueShift = 0;
    // Fixed-size pillar pool (no splice)
    this.pillars = new Array(20);
    this.pillarCount = 0;
    for (let i = 0; i < 20; i++) {
      this.pillars[i] = { x: 0, z: 0, h: 0, hue: 0, active: false };
    }
    this.spawnTimer = 0;
  }

  setup(container) {
    this.destroy();
    this.beatPulse = 0;
    this.hueShift = 0;
    this.pillarCount = 0;
    this.spawnTimer = 0;
    for (let i = 0; i < 20; i++) this.pillars[i].active = false;
    const preset = this;

    this.p5 = new p5((p) => {
      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.colorMode(p.HSB, 360, 100, 100, 100);
        p.background(0);
      };

      p.draw = () => {
        p.background(0);
        preset.beatPulse *= 0.88;

        const w = p.width;
        const h = p.height;
        const horizon = h * 0.45;
        const t = p.frameCount * 0.015 * preset.params.speed;
        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const treble = preset.audio.treble;

        // Camera shake on beat
        if (preset.beatPulse > 0.1) {
          const shake = preset.beatPulse * 3;
          p.translate(
            (Math.random() - 0.5) * shake,
            (Math.random() - 0.5) * shake
          );
        }

        // Hue shift from treble
        preset.hueShift = (preset.hueShift + treble * 0.8) % 360;
        const baseHue = (200 + preset.hueShift) % 360;

        // === Upper half: star field ===
        p.noStroke();
        for (let i = 0; i < 40; i++) {
          const sx = (i * 173.7 + t * 3) % w;
          const sy = (i * 67.3 + Math.sin(i * 2.1) * 20) % (horizon * 0.9);
          const twinkle = Math.sin(t * 4 + i * 1.7) * 0.5 + 0.5;
          p.fill(0, 0, 100, twinkle * 50);
          p.circle(sx, sy, 1.5 + twinkle);
        }

        // === Sun/Moon on horizon ===
        const sunX = w * 0.5;
        const sunY = horizon - 5;
        const sunBase = 60 + bass * 40;
        const sunPulse = 1 + preset.beatPulse * 0.4;
        // Outer glow
        for (let r = sunBase * sunPulse; r > 0; r -= 4) {
          const frac = r / (sunBase * sunPulse);
          const alpha = (1 - frac) * 40;
          p.noStroke();
          p.fill((baseHue + 40 * frac) % 360, 80, 90, alpha);
          p.ellipse(sunX, sunY, r * 2, r * 1.3);
        }
        // Core
        p.fill((baseHue + 20) % 360, 60, 100, 70);
        p.ellipse(sunX, sunY, sunBase * 0.4 * sunPulse, sunBase * 0.25 * sunPulse);

        // Horizon stripe bands (behind sun)
        for (let i = 0; i < 6; i++) {
          const bandY = sunY + 10 + i * 8;
          if (bandY > horizon + 5) break;
          const bandH = 3 - i * 0.4;
          if (bandH <= 0) break;
          p.fill(0, 0, 0, 60);
          p.rect(sunX - sunBase * sunPulse, bandY, sunBase * sunPulse * 2, bandH);
        }

        // === Perspective grid (lower half) ===
        const gridSpeed = 0.3 + bass * 0.7;
        const vanishX = w * 0.5;

        // Vertical lines (converging to vanishing point)
        const numVLines = 16;
        for (let i = -numVLines / 2; i <= numVLines / 2; i++) {
          const x = vanishX + i * (w / numVLines);
          const alpha = 25 + Math.abs(i) * 2;
          p.stroke(baseHue, 60, 50 + preset.beatPulse * 30, alpha);
          p.strokeWeight(0.8);
          p.line(vanishX, horizon, x, h);
        }

        // Horizontal lines (perspective: closer = sparser)
        const numHLines = 22;
        for (let i = 0; i < numHLines; i++) {
          const frac = i / numHLines;
          const scrolled = (frac + t * gridSpeed * 0.15) % 1.0;
          const y = horizon + (h - horizon) * scrolled * scrolled;
          const spread = 0.05 + scrolled * 0.95;
          const lx = vanishX - w * spread * 0.55;
          const rx = vanishX + w * spread * 0.55;
          const alpha = 15 + scrolled * 35 + preset.beatPulse * 20;
          p.stroke(baseHue, 50, 60 + preset.beatPulse * 30, alpha);
          p.strokeWeight(0.5 + scrolled * 1.0);
          p.line(lx, y, rx, y);
        }

        // Horizon glow line
        p.noStroke();
        for (let i = 0; i < 4; i++) {
          p.fill(baseHue, 70, 80, 12 - i * 2);
          const glowH = 4 + i * 6 + bass * 8;
          p.rect(0, horizon - glowH / 2, w, glowH);
        }

        // === Neon pillars ===
        // Spawn pillars
        preset.spawnTimer++;
        if (preset.spawnTimer >= 12) {
          preset.spawnTimer = 0;
          preset._spawnPillar();
        }

        // Update and sort active pillars by z (far to near)
        const sortBuf = [];
        for (let i = 0; i < 20; i++) {
          const pl = preset.pillars[i];
          if (!pl.active) continue;
          pl.z -= (0.008 + bass * 0.015) * preset.params.speed;
          if (pl.z <= 0.01) { pl.active = false; continue; }
          sortBuf.push(i);
        }
        // Simple insertion sort by z descending (far first)
        for (let i = 1; i < sortBuf.length; i++) {
          const key = sortBuf[i];
          let j = i - 1;
          while (j >= 0 && preset.pillars[sortBuf[j]].z < preset.pillars[key].z) {
            sortBuf[j + 1] = sortBuf[j];
            j--;
          }
          sortBuf[j + 1] = key;
        }

        // Draw pillars
        p.rectMode(p.CENTER);
        for (let si = 0; si < sortBuf.length; si++) {
          const pl = preset.pillars[sortBuf[si]];
          const perspective = 1 / pl.z;
          const screenX = vanishX + (pl.x - vanishX) * perspective * 0.15;
          const screenY = horizon + (h - horizon) * (1 - pl.z) * (1 - pl.z);
          const pillarW = 8 * perspective * 0.2;
          const pillarH = (pl.h + mid * 40) * perspective * 0.25;

          if (screenY - pillarH < 0 || screenX < -50 || screenX > w + 50) continue;

          // Glow
          p.noStroke();
          p.fill(pl.hue, 60, 80, 15 * perspective * 0.3);
          p.rect(screenX, screenY - pillarH / 2, pillarW * 3, pillarH * 1.2);
          // Main pillar
          p.fill(pl.hue, 70, 90, 50 + mid * 30);
          p.rect(screenX, screenY - pillarH / 2, pillarW, pillarH);
          // Bright edge
          p.fill(pl.hue, 30, 100, 60);
          p.rect(screenX, screenY - pillarH / 2, pillarW * 0.3, pillarH);
        }
        p.rectMode(p.CORNER);

        // Beat flash overlay
        if (preset.beatPulse > 0.3) {
          p.fill(baseHue, 30, 100, preset.beatPulse * 8);
          p.rect(0, 0, w, h);
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
        p.background(0);
      };
    }, container);
  }

  _spawnPillar() {
    // Find inactive slot
    let slot = -1;
    for (let i = 0; i < 20; i++) {
      if (!this.pillars[i].active) { slot = i; break; }
    }
    if (slot === -1) return;
    const pl = this.pillars[slot];
    const w = this.p5 ? this.p5.width : 400;
    pl.x = (Math.random() - 0.5) * w * 3 + w * 0.5;
    pl.z = 0.9 + Math.random() * 0.1;
    pl.h = 30 + Math.random() * 50;
    pl.hue = (200 + this.hueShift + Math.random() * 60) % 360;
    pl.active = true;
  }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
  }

  onBeat(strength) {
    this.beatPulse = strength;
    // Spawn extra pillars on beat
    this._spawnPillar();
    this._spawnPillar();
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['neon-horizon'] = NeonHorizonPreset;
})();
