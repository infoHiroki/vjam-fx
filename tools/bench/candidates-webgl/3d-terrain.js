(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class Terrain3dPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._terrainOffset = 0;
    this._terrainQuake = 0;
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
        preset._terrainQuake *= 0.8;
        preset._terrainQuake += preset.beatPulse * 120;
        preset._terrainOffset += 0.02 + mid * 0.06 + bass * 0.02;

        const cols = 35;
        const rows = 25;
        const scl = Math.min(p.width, p.height) * 0.055;
        p.camera(0, 0, (Math.min(p.width, p.height) / 2) / Math.tan(Math.PI / 6) * 1.3, 0, 0, 0, 0, 1, 0);
        const halfW = cols * scl * 0.5;
        const halfH = rows * scl * 0.5;
        const ampBase = 80 + bass * 200 + preset._terrainQuake;

        p.push();
        p.rotateX(-1.05);
        p.translate(0, 100, 0);

        p.colorMode(p.HSB, 360, 100, 100, 255);

        const heights = new Float32Array((cols + 1) * (rows + 1));
        for (let y = 0; y <= rows; y++) {
          for (let x = 0; x <= cols; x++) {
            const nx = x * 0.1;
            const nz = (y + preset._terrainOffset * 12) * 0.1;
            const n = p.noise(nx, nz);
            heights[y * (cols + 1) + x] = (n - 0.3) * ampBase;
          }
        }

        // Filled faces (dark neon gradient)
        p.noStroke();
        const hueBase = p.frameCount * 0.4 + mid * 60;
        p.beginShape(p.TRIANGLES);
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const px0 = x * scl - halfW;
            const px1 = (x + 1) * scl - halfW;
            const py0 = y * scl - halfH;
            const py1 = (y + 1) * scl - halfH;
            const z00 = heights[y * (cols + 1) + x];
            const z10 = heights[y * (cols + 1) + x + 1];
            const z01 = heights[(y + 1) * (cols + 1) + x];
            const z11 = heights[(y + 1) * (cols + 1) + x + 1];

            const avgH = (z00 + z10 + z11) / 3;
            const hN = Math.max(0, Math.min(1, (avgH + ampBase * 0.3) / (ampBase * 1.2)));
            const hue = (hueBase + hN * 200) % 360;
            p.fill(hue, 75 - hN * 20, 25 + hN * 55, 200);
            p.vertex(px0, py0, z00);
            p.vertex(px1, py0, z10);
            p.vertex(px1, py1, z11);

            const avgH2 = (z00 + z11 + z01) / 3;
            const hN2 = Math.max(0, Math.min(1, (avgH2 + ampBase * 0.3) / (ampBase * 1.2)));
            const hue2 = (hueBase + hN2 * 200) % 360;
            p.fill(hue2, 75 - hN2 * 20, 25 + hN2 * 55, 200);
            p.vertex(px0, py0, z00);
            p.vertex(px1, py1, z11);
            p.vertex(px0, py1, z01);
          }
        }
        p.endShape();

        // Wireframe overlay (Tron-style grid)
        const wireAlpha = 100 + treble * 80 + preset.beatPulse * 100;
        const wireHue = (180 + p.frameCount * 0.3) % 360;
        p.stroke(wireHue, 80, 90, wireAlpha);
        p.strokeWeight(0.6 + preset.beatPulse * 1.0);
        p.noFill();
        // Horizontal lines
        for (let y = 0; y <= rows; y += 2) {
          p.beginShape();
          for (let x = 0; x <= cols; x++) {
            const px = x * scl - halfW;
            const py = y * scl - halfH;
            const z = heights[y * (cols + 1) + x];
            p.vertex(px, py, z + 1);
          }
          p.endShape();
        }
        // Vertical lines
        for (let x = 0; x <= cols; x += 2) {
          p.beginShape();
          for (let y = 0; y <= rows; y++) {
            const px = x * scl - halfW;
            const py = y * scl - halfH;
            const z = heights[y * (cols + 1) + x];
            p.vertex(px, py, z + 1);
          }
          p.endShape();
        }

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
    this._terrainOffset = 0;
    this._terrainQuake = 0;
    super.destroy();
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['3d-terrain'] = Terrain3dPreset;
})();
