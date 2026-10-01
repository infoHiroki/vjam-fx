(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SandMandalaPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this.rings = [];
    this.hueDrift = 34;
    this.autoBeat = 0;
    this._fadeOut = 0;
  }

  setup(container) {
    this.destroy();
    this.rings = [];
    this.hueDrift = 34;
    this.autoBeat = 0;
    this._fadeOut = 0;
    const preset = this;

    this.p5 = new p5((p) => {
      let pg;

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.colorMode(p.HSB, 360, 100, 100, 100);
        pg = p.createGraphics(p.width, p.height);
        pg.pixelDensity(1);
        pg.colorMode(p.HSB, 360, 100, 100, 100);
        pg.background(0);
        preset._addRing(p, true);
      };

      p.draw = () => {
        p.background(0);
        preset.beatPulse *= 0.94;
        preset.autoBeat++;
        preset.hueDrift = (preset.hueDrift + 0.08 + preset.audio.treble * 1.8) % 360;

        if (preset.autoBeat > 70) {
          preset.autoBeat = 0;
          preset.onBeat(0.45);
        }

        // Loop: when all rings are done, dissolve and restart
        const allDone = preset.rings.length > 0 && preset.rings.every(r => r.progress >= 1);
        if (allDone) {
          preset._fadeOut += 3;
          pg.fill(0, 0, 0, preset._fadeOut);
          pg.noStroke();
          pg.rect(0, 0, pg.width, pg.height);
          if (preset._fadeOut >= 100) {
            pg.background(0);
            preset.rings = [];
            preset._fadeOut = 0;
            preset._addRing(p, true);
          }
        } else {
          preset._fadeOut = 0;
        }

        for (let i = 0; i < preset.rings.length; i++) {
          preset._growRing(pg, p, preset.rings[i]);
        }

        p.image(pg, 0, 0);
        preset._drawBreath(p);
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
        const oldPg = pg;
        pg = p.createGraphics(p.width, p.height);
        pg.pixelDensity(1);
        pg.colorMode(p.HSB, 360, 100, 100, 100);
        pg.background(0);
        pg.image(oldPg, 0, 0, p.width, p.height);
        oldPg.remove();
      };
    }, container);
  }

  _growRing(pg, p, ring) {
    if (ring.progress >= 1) return;

    const drawBurst = Math.floor(12 + this.audio.rms * 40 + this.audio.bass * 35 + this.beatPulse * 50);
    const prev = ring.progress;
    ring.progress = Math.min(1, ring.progress + ring.growth * (0.5 + this.audio.bass * 2.0 + this.audio.rms * 1.5 + this.beatPulse * 1.0));
    ring.rotation += ring.rotSpeed * (0.5 + this.audio.mid * 3.0 + this.beatPulse * 2.0);

    for (let i = 0; i < drawBurst; i++) {
      const frac = prev + (ring.progress - prev) * ((i + 1) / drawBurst);
      const baseAngle = frac * p.TWO_PI + ring.rotation;
      this._stampSymmetry(pg, p, ring, baseAngle);
    }
  }

  _stampSymmetry(pg, p, ring, baseAngle) {
    const cx = p.width * 0.5;
    const cy = p.height * 0.5;
    const steps = ring.symmetry;
    const petalAmp = ring.radius * (0.04 + this.audio.mid * 0.08);
    const grainCount = Math.floor(3 + this.audio.rms * 4 + this.audio.treble * 6);

    for (let s = 0; s < steps; s++) {
      const angle = baseAngle + (s / steps) * p.TWO_PI;
      const flower = Math.sin(angle * ring.petals + ring.phase) * petalAmp;
      const contour = (p.noise(ring.noiseSeed, angle * 0.45, p.frameCount * 0.006) - 0.5) * ring.radius * 0.06;
      const radius = ring.radius + flower + contour;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const tangent = angle + p.HALF_PI;
      const hue = (ring.hue + this.hueDrift + Math.sin(angle * 2.0) * 12) % 360;

      for (let g = 0; g < grainCount; g++) {
        const spread = ring.width * (0.4 + this.audio.bass * 1.8 + this.beatPulse * 1.0);
        const jitterA = tangent + (Math.random() - 0.5) * 0.8;
        const jitterR = (Math.random() - 0.5) * spread + (Math.random() - 0.5) * spread * 0.5;
        const px = x + Math.cos(jitterA) * jitterR + Math.cos(angle) * (Math.random() - 0.5) * spread * 0.4;
        const py = y + Math.sin(jitterA) * jitterR + Math.sin(angle) * (Math.random() - 0.5) * spread * 0.4;
        const size = 1.0 + Math.random() * (1.5 + this.audio.treble * 2.5 + this.audio.bass * 1.5);
        const alpha = 25 + Math.random() * 40 + this.beatPulse * 35 + this.audio.rms * 25;

        pg.noStroke();
        pg.fill(hue, 65 + this.audio.treble * 30, 90 + Math.random() * 10, alpha);
        pg.ellipse(px, py, size, size);
      }

      if (Math.random() < 0.24 + this.audio.treble * 0.2) {
        const sparkleR = ring.width * (1.6 + Math.random() * 1.4);
        pg.stroke(hue, 35, 100, 9 + this.audio.treble * 14);
        pg.strokeWeight(0.6);
        pg.line(
          x - Math.cos(tangent) * sparkleR,
          y - Math.sin(tangent) * sparkleR,
          x + Math.cos(tangent) * sparkleR,
          y + Math.sin(tangent) * sparkleR
        );
      }
    }
  }

  _drawBreath(p) {
    const cx = p.width * 0.5;
    const cy = p.height * 0.5;
    const maxR = Math.min(p.width, p.height) * 0.46;
    const pulseR = maxR * (0.12 + this.beatPulse * 0.12 + this.audio.rms * 0.04);

    p.noFill();
    p.stroke((this.hueDrift + 24) % 360, 45, 100, 12 + this.audio.treble * 14);
    p.strokeWeight(1.2 + this.beatPulse * 1.2);
    p.ellipse(cx, cy, pulseR * 2.2, pulseR * 2.2);

    p.stroke((this.hueDrift + 180) % 360, 18, 100, 8);
    p.strokeWeight(1);
    for (let i = 0; i < 3; i++) {
      const r = maxR * (0.28 + i * 0.13) + Math.sin(p.frameCount * 0.01 + i) * 6;
      p.ellipse(cx, cy, r * 2, r * 2);
    }
  }

  _addRing(p, initial = false) {
    const limit = Math.min(p.width, p.height) * 0.52;
    const last = this.rings.length ? this.rings[this.rings.length - 1].radius : 0;
    const radius = initial ? 14 : Math.min(limit, last + 18 + Math.random() * 26);
    if (!initial && radius >= limit - 4) return;

    this.rings.push({
      radius,
      width: 8 + Math.random() * 14,
      symmetry: 6 + Math.floor(Math.random() * 6) * 2,
      petals: 2 + Math.floor(Math.random() * 6),
      hue: (this.hueDrift + Math.random() * 70) % 360,
      progress: 0,
      growth: 0.0015 + Math.random() * 0.003,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.02,
      phase: Math.random() * Math.PI * 2,
      noiseSeed: Math.random() * 1000,
    });

    if (this.rings.length > 28) {
      this.rings.splice(0, this.rings.length - 28);
    }
  }

  updateAudio(d) {
    this.audio.bass = d.bass || 0;
    this.audio.mid = d.mid || 0;
    this.audio.treble = d.treble || 0;
    this.audio.rms = d.rms || 0;
  }

  onBeat(s) {
    this.beatPulse = Math.min(1, s);
    this.autoBeat = 0;
    if (this.p5) this._addRing(this.p5);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['sand-mandala'] = SandMandalaPreset;
})();
