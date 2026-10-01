(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SilkFlowPreset extends BasePreset {
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
      const ribbons = [];    // { points[], hue, alpha, width, speed, depth }
      let hueBase = 0;
      const MAX_RIBBONS = 50;

      function spawnRibbon(strength) {
        if (ribbons.length >= MAX_RIBBONS) return;
        const startY = p.random(p.height * 0.1, p.height * 0.9);
        const dir = p.random() > 0.5 ? 1 : -1;
        const startX = dir > 0 ? -50 : p.width + 50;
        const numPoints = 12;
        const pts = [];
        for (let i = 0; i < numPoints; i++) {
          pts.push({
            x: startX + dir * i * (p.width / numPoints) * 0.3,
            y: startY + p.random(-30, 30),
            baseY: startY + p.random(-30, 30),
            phase: p.random(p.TWO_PI)
          });
        }
        ribbons.push({
          points: pts,
          hue: (hueBase + p.random(-30, 30)) % 360,
          alpha: 40 + strength * 40,
          width: 8 + p.random(20) + strength * 15,
          speed: (1.5 + p.random(2) + strength * 2) * dir,
          depth: p.random(0.3, 1),
          life: 1,
          waveAmp: 20 + p.random(40)
        });
      }

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.colorMode(p.HSB, 360, 100, 100, 100);
        // Spawn initial ribbons
        for (let i = 0; i < 15; i++) spawnRibbon(0.3);
      };

      p.draw = () => {
        // Background with subtle gradient
        p.background(0, 0, 0, 20);
        preset.beatPulse *= 0.9;

        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const treble = preset.audio.treble;
        const t = p.frameCount * 0.015;

        // Drain beats → spawn ribbon bursts
        for (let b = 0; b < preset.pendingBeats.length; b++) {
          const str = preset.pendingBeats[b].strength;
          hueBase = (hueBase + 30 + str * 40) % 360;
          const count = (3 + str * 5) | 0;
          for (let i = 0; i < count; i++) spawnRibbon(str);
        }
        preset.pendingBeats.length = 0;

        // Ambient spawn
        if (p.frameCount % 30 === 0 && ribbons.length < 20) {
          spawnRibbon(0.2 + preset.audio.rms * 0.3);
        }

        // Sort by depth for layering
        ribbons.sort((a, b) => a.depth - b.depth);

        // Update and draw ribbons
        p.noFill();
        let w = 0;
        for (let i = 0; i < ribbons.length; i++) {
          const r = ribbons[i];
          r.life -= 0.002;
          if (r.life <= 0) continue;

          // Move points
          const waveStr = r.waveAmp * (1 + bass * 2);
          for (let j = 0; j < r.points.length; j++) {
            const pt = r.points[j];
            pt.x += r.speed * r.depth;
            pt.y = pt.baseY + Math.sin(t * 2 + pt.phase + j * 0.5) * waveStr * r.depth;
          }

          // Check if off screen
          const head = r.points[0];
          const tail = r.points[r.points.length - 1];
          if (r.speed > 0 && head.x > p.width + 200) { continue; }
          if (r.speed < 0 && head.x < -200) { continue; }

          // Draw ribbon with width variation
          const ribbonWidth = r.width * (0.5 + mid * 0.8) * r.depth;
          const alpha = r.alpha * r.life * (0.4 + treble * 0.6);

          // Glow pass
          p.strokeWeight(ribbonWidth * 1.8);
          p.stroke(r.hue, 50, 70, alpha * 0.2 * r.depth);
          p.beginShape();
          for (let j = 0; j < r.points.length; j++) {
            p.curveVertex(r.points[j].x, r.points[j].y);
          }
          p.endShape();

          // Core pass
          p.strokeWeight(ribbonWidth * 0.6);
          p.stroke(r.hue, 60, 90, alpha * r.depth);
          p.beginShape();
          for (let j = 0; j < r.points.length; j++) {
            p.curveVertex(r.points[j].x, r.points[j].y);
          }
          p.endShape();

          // Shimmer highlights (treble)
          if (treble > 0.3) {
            const shimIdx = (p.frameCount + i * 3) % r.points.length;
            const sp = r.points[shimIdx];
            p.noStroke();
            p.fill(r.hue, 20, 100, treble * 50 * r.life);
            p.ellipse(sp.x, sp.y, ribbonWidth * 0.5, ribbonWidth * 0.5);
          }

          ribbons[w++] = r;
        }
        ribbons.length = w;
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
window.VJamFX.presets['silk-flow'] = SilkFlowPreset;
})();
