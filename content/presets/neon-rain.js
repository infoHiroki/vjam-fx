(function() {
  'use strict';
  window.VJamFX = window.VJamFX || { presets: {} };
  const BasePreset = window.VJamFX.BasePreset;

  class NeonRainPreset extends BasePreset {
    constructor() {
      super();
      this.params = { speed: 1 };
      this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
      this.beatPulse = 0;
      this.drops = [];
      this.ripples = [];
    }

    setup(container) {
      this.destroy();
      this.drops = [];
      this.ripples = [];
      const preset = this;

      this.p5 = new p5((p) => {
        p.setup = () => {
          p.createCanvas(container.clientWidth, container.clientHeight);
          p.pixelDensity(1);
          p.colorMode(p.RGB, 255);
          for (let i = 0; i < 200; i++) {
            preset.drops.push(preset._makeDrop(p));
          }
        };

        p.draw = () => {
          p.background(5, 5, 15, 40);
          preset.beatPulse *= 0.92;
          const rms = preset.audio.rms;
          const speedMul = 1 + rms * 2;
          p.noStroke();
          for (const d of preset.drops) {
            d.y += d.speed * speedMul;
            const glowAlpha = 30 + preset.beatPulse * 40;
            p.fill(d.cr, d.cg, d.cb, glowAlpha);
            p.ellipse(d.x, d.y, d.w * 3, d.len * 1.5);
            const coreAlpha = 140 + preset.beatPulse * 80;
            p.fill(d.cr, d.cg, d.cb, coreAlpha);
            p.rect(d.x - d.w * 0.5, d.y, d.w, d.len);
            p.fill(255, 255, 255, 160 + preset.beatPulse * 60);
            p.ellipse(d.x, d.y, d.w * 1.5, d.w * 1.5);
            if (d.y > p.height) {
              if (Math.random() < 0.4) {
                preset.ripples.push({
                  x: d.x, y: p.height - 2, radius: 0, maxRadius: 15 + Math.random() * 20,
                  life: 1, cr: d.cr, cg: d.cg, cb: d.cb,
                });
              }
              Object.assign(d, preset._makeDrop(p));
              d.y = -20 - Math.random() * 40;
            }
          }
          p.noFill();
          let w = 0;
          for (let i = 0; i < preset.ripples.length; i++) {
            const r = preset.ripples[i];
            r.radius += 1.2;
            r.life -= 0.025;
            if (r.life <= 0 || r.radius > r.maxRadius) continue;
            const a = r.life * 120;
            p.stroke(r.cr, r.cg, r.cb, a);
            p.strokeWeight(1.5);
            p.ellipse(r.x, r.y, r.radius * 2, r.radius * 0.4);
            p.stroke(r.cr, r.cg, r.cb, a * 0.4);
            p.strokeWeight(3);
            p.ellipse(r.x, r.y, r.radius * 2.5, r.radius * 0.5);
            preset.ripples[w++] = r;
          }
          preset.ripples.length = Math.min(w, 80);
        };

        p.windowResized = () => {
          p.resizeCanvas(container.clientWidth, container.clientHeight);
        };
      }, container);
    }

    _makeDrop(p) {
      const isCyan = Math.random() > 0.5;
      return {
        x: Math.random() * p.width, y: Math.random() * p.height,
        speed: 3 + Math.random() * 7, len: 10 + Math.random() * 20,
        w: 1 + Math.random() * 2, cr: isCyan ? 0 : 255, cg: isCyan ? 255 : 0, cb: 255,
      };
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

  window.VJamFX.presets['neon-rain'] = NeonRainPreset;
})();
