(function() {
  'use strict';
  window.VJamFX = window.VJamFX || { presets: {} };
  const BasePreset = window.VJamFX.BasePreset;

  class CoralReefPreset extends BasePreset {
    constructor() {
      super();
      this.params = { speed: 1 };
      this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
      this.beatPulse = 0;
      this.corals = [];
      this.bubbles = [];
    }

    setup(container) {
      this.destroy();
      this.corals = [];
      this.bubbles = [];
      const preset = this;

      this.p5 = new p5((p) => {
        let pg;

        p.setup = () => {
          p.createCanvas(container.clientWidth, container.clientHeight);
          p.pixelDensity(1);
          pg = p.createGraphics(p.width, p.height);
          pg.colorMode(p.HSB, 360, 100, 100, 100);
          pg.background(200, 60, 8);
          for (let i = 0; i < 5; i++) {
            preset._addCoral(p);
          }
        };

        p.draw = () => {
          const speed = preset.params.speed;
          const pulse = preset.beatPulse;
          preset.beatPulse *= 0.93;

          for (let i = preset.corals.length - 1; i >= 0; i--) {
            const c = preset.corals[i];
            if (!c.growing) continue;
            const prevX = c.x;
            const prevY = c.y;
            const wobble = p.noise(c.x * 0.01, c.y * 0.01, p.frameCount * 0.005 * speed) - 0.5;
            c.angle += wobble * 0.15;
            c.x += Math.cos(c.angle) * c.speed * speed;
            c.y += Math.sin(c.angle) * c.speed * speed;
            c.segments++;
            const thickness = Math.max(1, c.thickness * (1 - c.segments / c.maxSegments * 0.7));
            pg.strokeWeight(thickness);
            pg.stroke(c.hue, c.sat, c.bri, 80);
            pg.line(prevX, prevY, c.x, c.y);
            if (c.segments > 5 && Math.random() < 0.03 + pulse * 0.03 && c.depth < 4) {
              const branchAngle = c.angle + (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.5);
              preset.corals.push({
                x: c.x, y: c.y, angle: branchAngle, speed: c.speed * 0.85,
                thickness: thickness * 0.7, hue: (c.hue + Math.random() * 20 - 10 + 360) % 360,
                sat: c.sat, bri: c.bri + Math.random() * 10, segments: 0,
                maxSegments: c.maxSegments * 0.6, depth: c.depth + 1, growing: true,
              });
            }
            if (c.segments >= c.maxSegments || c.y < 20 || c.x < 0 || c.x > p.width) {
              c.growing = false;
              pg.noStroke();
              pg.fill((c.hue + 30) % 360, 70, 90, 60);
              pg.ellipse(c.x, c.y, thickness * 3, thickness * 3);
            }
          }
          if (preset.corals.length > 500) {
            preset.corals = preset.corals.filter(c => c.growing);
          }
          if (p.frameCount % 120 === 0) {
            pg.fill(200, 60, 8, 3);
            pg.noStroke();
            pg.rect(0, 0, pg.width, pg.height);
          }
          if (pulse > 0.3) preset._addCoral(p);
          if (!preset.corals.some(c => c.growing)) {
            for (let i = 0; i < 3; i++) preset._addCoral(p);
          }
          p.image(pg, 0, 0);
          if (Math.random() < 0.1 + preset.audio.treble * 0.3) {
            preset.bubbles.push({ x: Math.random() * p.width, y: p.height + 5, size: 2 + Math.random() * 6, speed: 0.5 + Math.random() * 1.5 });
          }
          p.noFill();
          let w = 0;
          for (let i = 0; i < preset.bubbles.length; i++) {
            const b = preset.bubbles[i];
            b.y -= b.speed;
            b.x += Math.sin(b.y * 0.02) * 0.5;
            if (b.y < -10) continue;
            p.stroke(190, 20, 90, 30);
            p.strokeWeight(0.5);
            p.ellipse(b.x, b.y, b.size, b.size);
            preset.bubbles[w++] = b;
          }
          preset.bubbles.length = Math.min(w, 60);
        };

        p.windowResized = () => {
          p.resizeCanvas(container.clientWidth, container.clientHeight);
          const oldPg = pg;
          pg = p.createGraphics(p.width, p.height);
          pg.colorMode(p.HSB, 360, 100, 100, 100);
          pg.image(oldPg, 0, 0, p.width, p.height);
          oldPg.remove();
        };
      }, container);
    }

    _addCoral(p) {
      const x = 50 + Math.random() * (p.width - 100);
      const hueOptions = [0, 10, 20, 330, 340, 350];
      const hue = hueOptions[Math.floor(Math.random() * hueOptions.length)] + Math.random() * 15;
      this.corals.push({
        x, y: p.height - 10, angle: -Math.PI / 2 + (Math.random() - 0.5) * 0.6,
        speed: 0.8 + Math.random() * 1, thickness: 3 + Math.random() * 4, hue,
        sat: 60 + Math.random() * 30, bri: 50 + Math.random() * 30, segments: 0,
        maxSegments: 40 + Math.floor(Math.random() * 60), depth: 0, growing: true,
      });
    }

    updateAudio(audioData) {
      this.audio.bass = audioData.bass || 0;
      this.audio.mid = audioData.mid || 0;
      this.audio.treble = audioData.treble || 0;
      this.audio.rms = audioData.rms || 0;
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) { this.beatPulse = strength; }
  }

  window.VJamFX.presets['coral-reef'] = CoralReefPreset;
})();
