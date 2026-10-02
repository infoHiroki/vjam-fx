(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ShockwavePreset extends BasePreset {
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
      const sources = [];    // { x, y, time, strength, hue }
      let hueRotation = 0;
      let shakeX = 0, shakeY = 0;

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.colorMode(p.HSB, 360, 100, 100, 100);
        // Start with one center source
        sources.push({
          x: p.width / 2,
          y: p.height / 2,
          time: 0,
          strength: 0.8,
          hue: 200
        });
      };

      p.draw = () => {
        p.background(0, 0, 2);
        preset.beatPulse *= 0.9;
        shakeX *= 0.85;
        shakeY *= 0.85;

        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const treble = preset.audio.treble;
        const maxDim = Math.max(p.width, p.height);

        hueRotation = (hueRotation + treble * 1.5) % 360;

        // Drain beats → new wave sources
        for (let b = 0; b < preset.pendingBeats.length; b++) {
          const str = preset.pendingBeats[b].strength;
          sources.push({
            x: p.width / 2 + p.random(-p.width * 0.3, p.width * 0.3),
            y: p.height / 2 + p.random(-p.height * 0.3, p.height * 0.3),
            time: 0,
            strength: str,
            hue: (hueRotation + p.random(-20, 20)) % 360
          });
          shakeX = p.random(-5, 5) * str;
          shakeY = p.random(-5, 5) * str;
        }
        preset.pendingBeats.length = 0;

        // Ambient source spawn
        if (sources.length < 2 && p.frameCount % 120 === 0) {
          sources.push({
            x: p.random(p.width * 0.2, p.width * 0.8),
            y: p.random(p.height * 0.2, p.height * 0.8),
            time: 0,
            strength: 0.4 + preset.audio.rms * 0.3,
            hue: (hueRotation + p.random(60)) % 360
          });
        }

        p.push();
        p.translate(shakeX, shakeY);

        // Render interference pattern using concentric rings
        const waveSpeed = 2 + bass * 3;
        const numRings = (6 + mid * 8) | 0;
        const ringSpacing = 25 - mid * 8;

        p.noFill();
        for (let si = sources.length - 1; si >= 0; si--) {
          const src = sources[si];
          src.time += waveSpeed;

          if (src.time > maxDim * 1.5) {
            sources.splice(si, 1);
            continue;
          }

          const fadeStart = maxDim * 0.8;
          const srcFade = src.time > fadeStart ? 1 - (src.time - fadeStart) / (maxDim * 0.7) : 1;
          if (srcFade <= 0) { sources.splice(si, 1); continue; }

          // Draw concentric rings
          for (let ring = 0; ring < numRings; ring++) {
            const r = src.time - ring * Math.max(ringSpacing, 12);
            if (r <= 0 || r > maxDim * 1.5) continue;

            const ringFade = Math.max(0, 1 - r / (maxDim * 1.2));
            const alpha = src.strength * ringFade * srcFade * 50;
            if (alpha < 1) continue;

            const hue = (src.hue + ring * 12 + hueRotation) % 360;
            const weight = (1.5 + src.strength * 2) * ringFade + preset.beatPulse;

            // Glow
            p.stroke(hue, 60, 80, alpha * 0.4);
            p.strokeWeight(weight * 3);
            p.ellipse(src.x, src.y, r * 2, r * 2);

            // Core ring
            p.stroke(hue, 50, 100, alpha);
            p.strokeWeight(weight);
            p.ellipse(src.x, src.y, r * 2, r * 2);
          }

          // Source glow
          if (src.time < 60) {
            p.noStroke();
            const glowAlpha = src.strength * 40 * (1 - src.time / 60);
            p.fill(src.hue, 40, 100, glowAlpha);
            p.ellipse(src.x, src.y, 30 + src.strength * 20, 30 + src.strength * 20);
          }
        }

        // Interference highlight dots at grid intersections
        if (sources.length >= 2) {
          p.noStroke();
          const step = 30;
          for (let x = 0; x < p.width; x += step) {
            for (let y = 0; y < p.height; y += step) {
              let interference = 0;
              for (let si = 0; si < sources.length; si++) {
                const src = sources[si];
                const dx = x - src.x;
                const dy = y - src.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                interference += Math.sin((d - src.time) * 0.1) * src.strength;
              }
              const bright = Math.abs(interference);
              if (bright > 0.8) {
                const hue = (hueRotation + interference * 60) % 360;
                p.fill((hue + 360) % 360, 50, 100, bright * 20);
                p.ellipse(x, y, 3, 3);
              }
            }
          }
        }

        p.pop();
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
window.VJamFX.presets['shockwave'] = ShockwavePreset;
})();
