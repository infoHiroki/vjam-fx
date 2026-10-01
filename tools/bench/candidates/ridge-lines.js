(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class RidgeLinesPreset extends BasePreset {
  constructor() {
    super();
    this.params = { speed: 1 };
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      const LINE_COUNT = 40;
      const POINTS = 120;

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
      };

      p.draw = () => {
        p.background(0);
        const pulse = preset.beatPulse;
        preset.beatPulse *= 0.92;

        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const treble = preset.audio.treble;

        const t = p.frameCount * 0.008 * preset.params.speed;
        const marginX = p.width * 0.1;
        const marginY = p.height * 0.08;
        const drawW = p.width - marginX * 2;
        const drawH = p.height - marginY * 2;
        // Density: mid controls visible lines (20..40)
        const visibleLines = Math.floor(20 + mid * 20);
        const lineSpacing = drawH / visibleLines;

        // Stroke weight: thicker on beat
        const baseWeight = 1.2 + pulse * 2.5;

        // Flash on beat: brief white overlay
        if (pulse > 0.5) {
          p.fill(255, pulse * 40);
          p.noStroke();
          p.rect(0, 0, p.width, p.height);
        }

        // Draw lines back-to-front (top to bottom)
        for (let line = 0; line < visibleLines; line++) {
          const lineY = marginY + line * lineSpacing;
          const lineFrac = line / visibleLines; // 0=top, 1=bottom

          // Amplitude: stronger in center rows, bass-reactive
          const centerDist = Math.abs(lineFrac - 0.4);
          const ampBase = (1 - centerDist * 1.8) * drawH * 0.25;
          const amp = Math.max(0, ampBase) * (0.5 + bass * 1.5);

          // Build polyline points
          const xs = [];
          const ys = [];
          for (let i = 0; i <= POINTS; i++) {
            const frac = i / POINTS;
            const x = marginX + frac * drawW;

            // Perlin noise displacement
            const n1 = p.noise(frac * 3 + line * 0.3, t + line * 0.15);
            const n2 = p.noise(frac * 8 + line * 0.5, t * 2);
            // High-freq noise from treble
            const hiFreq = treble * p.noise(frac * 20, line * 0.8, t * 3) * 0.3;

            // Mountain shape: taper at edges
            const edgeTaper = Math.sin(frac * Math.PI);
            const displacement = (n1 * 0.7 + n2 * 0.3 + hiFreq) * amp * edgeTaper;

            xs[i] = x;
            ys[i] = lineY - displacement;
          }

          // Occlusion fill: fill area below line with black
          p.noStroke();
          p.fill(0);
          p.beginShape();
          for (let i = 0; i <= POINTS; i++) {
            p.vertex(xs[i], ys[i]);
          }
          // Close at bottom
          p.vertex(marginX + drawW, lineY + lineSpacing + 2);
          p.vertex(marginX, lineY + lineSpacing + 2);
          p.endShape(p.CLOSE);

          // Draw the line itself
          const brightness = 200 + pulse * 55;
          p.stroke(brightness);
          p.strokeWeight(baseWeight);
          p.noFill();
          p.beginShape();
          for (let i = 0; i <= POINTS; i++) {
            p.vertex(xs[i], ys[i]);
          }
          p.endShape();
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

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['ridge-lines'] = RidgeLinesPreset;
})();
