(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class Wave3dPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._waveTime = 0;
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
        p.camera(0, 0, (Math.min(p.width, p.height) / 2) / Math.tan(Math.PI / 6) * 1.3, 0, 0, 0, 0, 1, 0);
        preset.beatPulse *= 0.9;

        const bass = preset.audio.bass;
        const treble = preset.audio.treble;
        preset._waveTime += 0.02 + bass * 0.03;
        const amp = 80 + bass * 120 + preset.beatPulse * 100;
        const freq = 0.03 + treble * 0.04;

        p.push();
        p.rotateX(-0.9);
        p.translate(0, 60, 0);

        p.noFill();
        p.colorMode(p.HSB, 360, 100, 100, 255);
        const hue = (p.frameCount * 0.5 + bass * 60) % 360;
        p.stroke(hue, 70, 90, 200 + preset.beatPulse * 55);
        p.strokeWeight(1.0 + preset.beatPulse * 2 + bass * 1.5);

        // Wave terrain
        const cols = 25, rows = 18;
        const cw = p.width * 1.6 / cols;
        const ch = p.height * 1.6 / rows;
        const ox = -p.width * 0.8;
        const oy = -p.height * 0.8;
        const wt = preset._waveTime;
        const grid = new Float32Array((cols + 1) * (rows + 1));
        for (let gy = 0; gy <= rows; gy++) {
          for (let gx = 0; gx <= cols; gx++) {
            const px = ox + gx * cw;
            const py = oy + gy * ch;
            const d = Math.sqrt(px * px + py * py);
            grid[gy * (cols + 1) + gx] = Math.sin(d * freq - wt) * amp;
          }
        }
        p.beginShape(p.TRIANGLES);
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const px0 = ox + x * cw, px1 = ox + (x + 1) * cw;
            const py0 = oy + y * ch, py1 = oy + (y + 1) * ch;
            const z00 = grid[y * (cols + 1) + x];
            const z10 = grid[y * (cols + 1) + x + 1];
            const z01 = grid[(y + 1) * (cols + 1) + x];
            const z11 = grid[(y + 1) * (cols + 1) + x + 1];
            p.vertex(px0, py0, z00); p.vertex(px1, py0, z10); p.vertex(px1, py1, z11);
            p.vertex(px0, py0, z00); p.vertex(px1, py1, z11); p.vertex(px0, py1, z01);
          }
        }
        p.endShape();

        p.colorMode(p.RGB, 255);
        p.pop();
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
    this._waveTime = 0;
    super.destroy();
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['3d-wave'] = Wave3dPreset;
})();
