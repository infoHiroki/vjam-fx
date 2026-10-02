(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class Worm3dPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._wormOffset = 0;
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      p.setup = () => {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        p.createCanvas(w, h, p.WEBGL);
        p.pixelDensity(1);
      };
      p.draw = () => {
        p.background(0);
        preset.beatPulse *= 0.9;

        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const treble = preset.audio.treble;
        const fc = p.frameCount;
        const scale = Math.min(p.width, p.height);
        p.camera(0, 0, (scale / 2) / Math.tan(Math.PI / 6) * 1.3, 0, 0, 0, 0, 1, 0);
        preset._wormOffset += 0.03 + bass * 0.06 + preset.beatPulse * 0.15;
        const t = preset._wormOffset;

        const ringCount = 35;
        const tunnelLen = scale * 2.0;
        const maxR = scale * 0.65;
        const pts = 24;

        p.colorMode(p.HSB, 360, 100, 100, 255);

        // Warp streaks
        p.noFill();
        const streakCount = 60;
        for (let i = 0; i < streakCount; i++) {
          const sa = (i / streakCount) * Math.PI * 2 + t * 0.3;
          const sr = maxR * (0.3 + (i % 7) * 0.1);
          const sx = Math.cos(sa) * sr;
          const sy = Math.sin(sa) * sr;
          const sz1 = ((t * 80 + i * 57) % tunnelLen) - tunnelLen;
          const sz2 = sz1 + 30 + bass * 40 + preset.beatPulse * 60;
          const sHue = (i * 17 + fc * 0.8) % 360;
          const sAlpha = 100 + preset.beatPulse * 100 + bass * 55;
          p.strokeWeight(1.0 + preset.beatPulse * 1.5);
          p.stroke(sHue, 50, 95, sAlpha);
          p.line(sx, sy, sz1, sx, sy, sz2);
        }

        // Tunnel rings
        for (let r = 0; r < ringCount; r++) {
          const rawZ = ((t * 60 + r * (tunnelLen / ringCount)) % tunnelLen) - tunnelLen;
          const zNorm = 1 - (rawZ + tunnelLen) / tunnelLen;

          const ringR = maxR * (0.15 + (1 - zNorm) * 0.85);
          const distort = bass * 0.3 + preset.beatPulse * 0.4;
          const hue = (r * 25 + fc * 0.6 + treble * 80) % 360;
          const bright = 70 + (1 - zNorm) * 30 + preset.beatPulse * 20;
          const alpha = 50 + (1 - zNorm) * 180 + preset.beatPulse * 25;
          const sw = 1.5 + (1 - zNorm) * 2.5 + preset.beatPulse * 2;

          p.strokeWeight(sw);
          p.stroke(hue, 70 + mid * 20, bright, alpha);
          p.noFill();

          const spin = t * 0.8 + r * 0.15;
          p.beginShape();
          for (let i = 0; i <= pts; i++) {
            const a = (i / pts) * Math.PI * 2 + spin;
            const noise = Math.sin(a * 3 + t * 2 + r) * distort +
                          Math.sin(a * 5 + t * 3) * distort * 0.5;
            const cr = ringR * (1 + noise);
            p.vertex(Math.cos(a) * cr, Math.sin(a) * cr, rawZ);
          }
          p.endShape(p.CLOSE);

          // Beat double ring
          if (preset.beatPulse > 0.1 && zNorm < 0.7) {
            p.strokeWeight(sw * 0.5);
            p.stroke(hue, 40, 100, alpha * 0.5);
            p.beginShape();
            for (let i = 0; i <= pts; i++) {
              const a = (i / pts) * Math.PI * 2 - spin;
              const cr = ringR * 0.6;
              p.vertex(Math.cos(a) * cr, Math.sin(a) * cr, rawZ);
            }
            p.endShape(p.CLOSE);
          }
        }

        // Center glow
        p.push();
        p.translate(0, 0, -tunnelLen);
        p.noStroke();
        const glowR = scale * (0.06 + preset.beatPulse * 0.08 + bass * 0.04);
        p.emissiveMaterial(255, 220, 255);
        p.sphere(glowR);
        p.pop();

        p.colorMode(p.RGB, 255);
      };
      p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
    }, container);
  }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
  }

  onBeat(strength) {
    if (strength > 0.2) this.beatPulse = Math.min(1, strength);
  }

  destroy() {
    this._wormOffset = 0;
    super.destroy();
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['3d-worm'] = Worm3dPreset;
})();
