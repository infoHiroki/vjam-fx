(function() {
  'use strict';
  window.VJamFX = window.VJamFX || { presets: {} };
  const BasePreset = window.VJamFX.BasePreset;

  class CyberRainHeavyPreset extends BasePreset {
    constructor() {
      super();
      this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
      this.beatPulse = 0;
      this.drops = [];
      this.puddles = [];
      this.lightning = null;
      this.thunderFlash = 0;
    }

    setup(container) {
      this.destroy();
      this.drops = [];
      this.puddles = [];
      this.lightning = null;
      this.thunderFlash = 0;
      const preset = this;

      this.p5 = new p5((p) => {
        p.setup = () => {
          p.createCanvas(container.clientWidth, container.clientHeight);
          p.pixelDensity(1);
          for (let i = 0; i < 400; i++) {
            preset.drops.push(preset._createDrop(p));
          }
        };

        p.draw = () => {
          const flashAmt = preset.thunderFlash * 40;
          p.background(5 + flashAmt, 5 + flashAmt * 0.7, 15 + flashAmt * 0.5);
          preset.beatPulse *= 0.92;
          preset.thunderFlash *= 0.85;
          const windAngle = Math.sin(p.frameCount * 0.005) * 0.4;
          for (const drop of preset.drops) {
            preset._updateDrop(p, drop, windAngle);
            preset._drawDrop(p, drop, windAngle);
          }
          let w = 0;
          for (let i = 0; i < preset.puddles.length; i++) {
            const puddle = preset.puddles[i];
            puddle.radius += 1.5;
            puddle.alpha -= 4;
            if (puddle.alpha <= 0) continue;
            p.noFill();
            p.stroke(0, 255, 255, puddle.alpha);
            p.strokeWeight(1);
            p.ellipse(puddle.x, puddle.y, puddle.radius * 2, puddle.radius * 0.5);
            preset.puddles[w++] = puddle;
          }
          preset.puddles.length = w;
          if (preset.lightning) {
            preset._drawLightning(p, preset.lightning);
            preset.lightning.life--;
            if (preset.lightning.life <= 0) preset.lightning = null;
          }
        };

        p.windowResized = () => {
          p.resizeCanvas(container.clientWidth, container.clientHeight);
        };
      }, container);
    }

    _createDrop(p) {
      return {
        x: Math.random() * (p.width || 800) * 1.4 - (p.width || 800) * 0.2,
        y: Math.random() * (p.height || 600),
        speed: 8 + Math.random() * 12, len: 10 + Math.random() * 20,
        bright: 150 + Math.random() * 105,
      };
    }

    _updateDrop(p, drop, windAngle) {
      drop.y += drop.speed;
      drop.x += Math.sin(windAngle) * drop.speed * 0.5;
      if (drop.y > p.height) {
        if (Math.random() < 0.05) {
          this.puddles.push({ x: drop.x, y: p.height - 2, radius: 2, alpha: 180 });
        }
        drop.y = -drop.len;
        drop.x = Math.random() * p.width * 1.4 - p.width * 0.2;
      }
    }

    _drawDrop(p, drop, windAngle) {
      const dx = Math.sin(windAngle) * drop.len * 0.5;
      p.stroke(0, 255, 255, drop.bright);
      p.strokeWeight(1);
      p.line(drop.x, drop.y, drop.x + dx, drop.y + drop.len);
    }

    _generateLightning(p) {
      const x = Math.random() * p.width;
      const points = [{ x: x, y: 0 }];
      let cx = x, cy = 0;
      const segments = 8 + Math.floor(Math.random() * 8);
      const stepY = p.height / segments;
      for (let i = 0; i < segments; i++) {
        cx += (Math.random() - 0.5) * 120;
        cy += stepY;
        points.push({ x: cx, y: cy });
      }
      return { points, life: 6, branches: this._generateBranches(points) };
    }

    _generateBranches(mainPoints) {
      const branches = [];
      for (let i = 2; i < mainPoints.length - 1; i++) {
        if (Math.random() < 0.4) {
          const pt = mainPoints[i];
          const dir = Math.random() < 0.5 ? -1 : 1;
          const bPoints = [{ x: pt.x, y: pt.y }];
          let bx = pt.x, by = pt.y;
          const bLen = 2 + Math.floor(Math.random() * 3);
          for (let j = 0; j < bLen; j++) {
            bx += dir * (20 + Math.random() * 30);
            by += 15 + Math.random() * 25;
            bPoints.push({ x: bx, y: by });
          }
          branches.push(bPoints);
        }
      }
      return branches;
    }

    _drawLightning(p, bolt) {
      const alpha = bolt.life / 6 * 255;
      p.stroke(150, 100, 255, alpha * 0.3);
      p.strokeWeight(6);
      p.noFill();
      p.beginShape();
      for (const pt of bolt.points) p.vertex(pt.x, pt.y);
      p.endShape();
      p.stroke(200, 220, 255, alpha);
      p.strokeWeight(2.5);
      p.beginShape();
      for (const pt of bolt.points) p.vertex(pt.x, pt.y);
      p.endShape();
      p.strokeWeight(1.5);
      p.stroke(180, 200, 255, alpha * 0.7);
      for (const branch of bolt.branches) {
        p.beginShape();
        for (const pt of branch) p.vertex(pt.x, pt.y);
        p.endShape();
      }
    }

    updateAudio(audioData) {
      this.audio.bass = audioData.bass || 0;
      this.audio.mid = audioData.mid || 0;
      this.audio.treble = audioData.treble || 0;
      this.audio.rms = audioData.rms || 0;
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) {
      this.beatPulse = strength;
      this.thunderFlash = strength;
      if (this.p5) this.lightning = this._generateLightning(this.p5);
    }
  }

  window.VJamFX.presets['cyber-rain-heavy'] = CyberRainHeavyPreset;
})();
