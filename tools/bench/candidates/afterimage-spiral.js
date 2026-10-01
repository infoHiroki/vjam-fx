(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class AfterimageSpiral extends BasePreset {
  constructor() {
    super();
    this.params = { arms: 6, speed: 1 };
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this.rotationSpeed = 0.02;
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
      };

      p.draw = () => {
        // Semi-transparent black for trailing afterimage effect
        p.background(0, 35);
        preset.beatPulse *= 0.92;

        const cx = p.width / 2;
        const cy = p.height / 2;
        const maxR = Math.min(p.width, p.height) * 0.45;
        const time = p.frameCount * preset.rotationSpeed * preset.params.speed;
        const arms = preset.params.arms;

        // Beat bursts rotation speed temporarily
        const speedBoost = 1 + preset.beatPulse * 4;
        const bassThick = 3 + preset.audio.bass * 12;

        // Draw multiple spiral layers at different rotation speeds
        for (let layer = 0; layer < 3; layer++) {
          const layerSpeed = (1 + layer * 0.6) * speedBoost;
          const layerDir = layer % 2 === 0 ? 1 : -1;
          const rotation = time * layerSpeed * layerDir;

          // Color per layer: white core, colored outer layers
          const hueShift = p.frameCount * 0.3 + layer * 120;

          for (let arm = 0; arm < arms; arm++) {
            const armOffset = (arm / arms) * p.TWO_PI;

            // Archimedean spiral: r = a + b*theta
            const segments = 120;
            const maxTheta = p.TWO_PI * 3.5;

            p.noFill();

            for (let i = 1; i < segments; i++) {
              const t = i / segments;
              const theta = t * maxTheta + rotation + armOffset;
              const r = t * maxR;

              const tPrev = (i - 1) / segments;
              const thetaPrev = tPrev * maxTheta + rotation + armOffset;
              const rPrev = tPrev * maxR;

              const x1 = cx + Math.cos(thetaPrev) * rPrev;
              const y1 = cy + Math.sin(thetaPrev) * rPrev;
              const x2 = cx + Math.cos(theta) * r;
              const y2 = cy + Math.sin(theta) * r;

              // Thickness: thicker toward outside, bass amplifies
              const thickness = (0.5 + t * bassThick) * (1 + preset.beatPulse * 2);

              // Color: bright white/cyan for layer 0, shifting hues for others
              if (layer === 0) {
                const brightness = 200 + preset.audio.treble * 55;
                p.stroke(brightness, brightness, 255, 180 + preset.beatPulse * 75);
              } else {
                const h = (hueShift + t * 60) % 360;
                const s = 60 + preset.audio.mid * 40;
                const bright = 180 + t * 75;
                // Convert HSB-ish to RGB manually for performance
                const c = hsbToRgb(h, s / 100, bright / 255);
                p.stroke(c[0], c[1], c[2], 140 + preset.beatPulse * 60);
              }

              p.strokeWeight(thickness);
              p.line(x1, y1, x2, y2);
            }
          }
        }

        // Center glow pulse
        const glowSize = 20 + preset.audio.rms * 40 + preset.beatPulse * 30;
        p.noStroke();
        for (let g = 3; g > 0; g--) {
          const alpha = 30 * g + preset.beatPulse * 40;
          p.fill(200, 220, 255, alpha);
          p.ellipse(cx, cy, glowSize * g, glowSize * g);
        }
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
    this.beatPulse = strength;
  }
}

// Simple HSB to RGB (h: 0-360, s: 0-1, b: 0-1)
function hsbToRgb(h, s, b) {
  h = ((h % 360) + 360) % 360;
  const c = b * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = b - c;
  let r, g, bl;
  if (h < 60) { r = c; g = x; bl = 0; }
  else if (h < 120) { r = x; g = c; bl = 0; }
  else if (h < 180) { r = 0; g = c; bl = x; }
  else if (h < 240) { r = 0; g = x; bl = c; }
  else if (h < 300) { r = x; g = 0; bl = c; }
  else { r = c; g = 0; bl = x; }
  return [(r + m) * 255, (g + m) * 255, (bl + m) * 255];
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['afterimage-spiral'] = AfterimageSpiral;
})();
