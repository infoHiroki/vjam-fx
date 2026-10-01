(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SolarFlarePreset extends BasePreset {
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
      const flares = [];     // { angle, speed, length, life, maxLife, hue }
      const particles = [];  // { x, y, vx, vy, life, hue, size }
      let partW = 0;
      let coronaPulse = 0;
      let surfaceTime = 0;
      let hueShift = 0;

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.colorMode(p.HSB, 360, 100, 100, 100);
      };

      p.draw = () => {
        p.background(0, 0, 0, 15);
        preset.beatPulse *= 0.9;
        coronaPulse *= 0.95;

        const cx = p.width / 2;
        const cy = p.height / 2;
        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const treble = preset.audio.treble;
        const baseRadius = Math.min(p.width, p.height) * 0.15;
        const radius = baseRadius * (1 + bass * 0.3 + coronaPulse * 0.2);

        surfaceTime += 0.008 + mid * 0.01;
        hueShift += treble * 0.5;

        // Drain beats → CME events
        for (let b = 0; b < preset.pendingBeats.length; b++) {
          const str = preset.pendingBeats[b].strength;
          coronaPulse = Math.max(coronaPulse, str);
          // Spawn flare arc
          const angle = p.random(p.TWO_PI);
          flares.push({
            angle: angle,
            speed: p.random(2, 5) * str,
            length: 0,
            life: 1,
            maxLife: p.random(40, 80),
            hue: (30 + hueShift + p.random(-10, 10)) % 360
          });
          // Ejected particles
          const count = (15 + str * 25) | 0;
          for (let i = 0; i < count && particles.length < 500; i++) {
            const a = angle + p.random(-0.4, 0.4);
            const spd = p.random(2, 7) * str;
            particles.push({
              x: cx + Math.cos(a) * radius,
              y: cy + Math.sin(a) * radius,
              vx: Math.cos(a) * spd,
              vy: Math.sin(a) * spd,
              life: 1,
              hue: (35 + hueShift + p.random(-15, 15)) % 360,
              size: p.random(2, 5)
            });
          }
        }
        preset.pendingBeats.length = 0;

        // Corona glow layers
        p.noStroke();
        for (let layer = 4; layer >= 0; layer--) {
          const lr = radius * (1.3 + layer * 0.25 + coronaPulse * 0.3);
          const alpha = (8 - layer * 1.5) + coronaPulse * 5;
          const hue = (30 + hueShift + layer * 5) % 360;
          p.fill(hue, 80, 80, Math.max(alpha, 0));
          p.ellipse(cx, cy, lr * 2, lr * 2);
        }

        // Sun surface (perlin noise texture)
        const segments = 60;
        for (let ring = 0; ring < 5; ring++) {
          const r = radius * (1 - ring * 0.18);
          if (r <= 0) continue;
          const hue = (25 + hueShift + ring * 8) % 360;
          const sat = 90 - ring * 10;
          const bright = 100 - ring * 5;
          p.noStroke();
          p.beginShape();
          for (let i = 0; i <= segments; i++) {
            const a = (i / segments) * p.TWO_PI;
            const nv = p.noise(Math.cos(a) * 2 + surfaceTime + ring, Math.sin(a) * 2 + surfaceTime * 0.7, ring * 0.5);
            const dr = r * (0.9 + nv * 0.2 + bass * 0.15);
            const px = cx + Math.cos(a) * dr;
            const py = cy + Math.sin(a) * dr;
            p.fill(hue, sat, bright, 30 + ring * 10);
            p.vertex(px, py);
          }
          p.endShape(p.CLOSE);
        }

        // Prominence arcs
        p.noFill();
        for (let i = flares.length - 1; i >= 0; i--) {
          const f = flares[i];
          f.length += f.speed;
          f.life -= 1 / f.maxLife;
          if (f.life <= 0) { flares.splice(i, 1); continue; }

          const arcLen = f.length;
          const steps = 20;
          p.strokeWeight(2 + f.life * 3);
          p.beginShape();
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const dist = radius + arcLen * Math.sin(t * Math.PI) * (0.5 + bass * 0.5);
            const arcAngle = f.angle + (t - 0.5) * 0.8;
            const px = cx + Math.cos(arcAngle) * dist;
            const py = cy + Math.sin(arcAngle) * dist;
            const alpha = f.life * 70 * (1 - Math.abs(t - 0.5) * 1.5);
            p.stroke(f.hue, 80, 100, Math.max(alpha, 0));
            p.vertex(px, py);
          }
          p.endShape();
        }

        // Ejected particles
        p.noStroke();
        partW = 0;
        for (let i = 0; i < particles.length; i++) {
          const pt = particles[i];
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.vx *= 0.99;
          pt.vy *= 0.99;
          pt.life -= 0.012;
          if (pt.life <= 0) continue;
          p.fill(pt.hue, 70, 100, pt.life * 60);
          p.ellipse(pt.x, pt.y, pt.size * pt.life, pt.size * pt.life);
          particles[partW++] = pt;
        }
        particles.length = partW;

        // Center bright core
        p.noStroke();
        p.fill((30 + hueShift) % 360, 30, 100, 60);
        p.ellipse(cx, cy, radius * 1.2, radius * 1.2);
        p.fill((35 + hueShift) % 360, 10, 100, 80);
        p.ellipse(cx, cy, radius * 0.7, radius * 0.7);
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
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
window.VJamFX.presets['solar-flare'] = SolarFlarePreset;
})();
