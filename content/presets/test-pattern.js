(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class TestPatternPreset extends BasePreset {
  constructor() {
    super();
    this.params = { speed: 1 };
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.pendingBeats = 0;
    this.patternIndex = 0;
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      const PATTERNS = 4; // barcode, numbers, pulse-grid, glitch

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.textFont('monospace');
      };

      p.draw = () => {
        // Consume pending beats
        if (preset.pendingBeats > 0) {
          preset.pendingBeats--;
          preset.patternIndex = (preset.patternIndex + 1) % PATTERNS;
        }

        p.background(0);

        const bass = preset.audio.bass;
        const treble = preset.audio.treble;
        const rms = preset.audio.rms;
        const t = p.frameCount * 0.02 * preset.params.speed;

        // Treble flicker: random invert frames
        const flicker = treble > 0.3 && Math.random() < treble * 0.3;

        switch (preset.patternIndex) {
          case 0: drawBarcode(p, t, bass, flicker); break;
          case 1: drawNumbers(p, t, bass, treble, flicker); break;
          case 2: drawPulseGrid(p, t, bass, rms, flicker); break;
          case 3: drawGlitch(p, t, bass, treble, flicker); break;
        }

        // HUD timestamp overlay
        drawHUD(p, t);

        // Global flicker invert
        if (flicker) {
          p.blendMode(p.DIFFERENCE);
          p.fill(255);
          p.noStroke();
          p.rect(0, 0, p.width, p.height);
          p.blendMode(p.BLEND);
        }
      };

      function drawBarcode(p, t, bass, flicker) {
        const density = 0.3 + bass * 0.7;
        const barW = Math.max(1, Math.floor(p.width / (80 * density)));
        p.noStroke();
        for (let x = 0; x < p.width; x += barW) {
          const n = p.noise(x * 0.02, t * 0.5);
          const on = n > (0.5 - bass * 0.15);
          p.fill(on ? 255 : 0);
          p.rect(x, 0, barW, p.height);
        }
      }

      function drawNumbers(p, t, bass, treble, flicker) {
        const size = Math.max(10, Math.floor(14 + bass * 8));
        p.textSize(size);
        p.textAlign(p.LEFT, p.TOP);
        const cols = Math.floor(p.width / (size * 0.65));
        const rows = Math.floor(p.height / (size * 1.1));
        const scrollOffset = Math.floor(t * 8 * (1 + treble * 3)) % 10;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const val = (Math.floor(p.noise(c * 0.3, r * 0.3 + t * 0.2) * 10) + scrollOffset) % 10;
            const bright = p.noise(c * 0.5, r * 0.5, t) > 0.4 ? 255 : 60;
            p.fill(bright);
            p.noStroke();
            p.text(val, c * size * 0.65, r * size * 1.1);
          }
        }
      }

      function drawPulseGrid(p, t, bass, rms, flicker) {
        const cellSize = Math.max(8, Math.floor(20 + bass * 15));
        const cols = Math.ceil(p.width / cellSize);
        const rows = Math.ceil(p.height / cellSize);
        p.noStroke();

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cx = c * cellSize + cellSize / 2;
            const cy = r * cellSize + cellSize / 2;
            const dist = Math.sqrt((cx - p.width / 2) ** 2 + (cy - p.height / 2) ** 2);
            const wave = Math.sin(dist * 0.02 - t * 3) * 0.5 + 0.5;
            const on = wave > (0.5 - rms * 0.3);
            p.fill(on ? 255 : 0);
            p.rect(c * cellSize, r * cellSize, cellSize - 1, cellSize - 1);
          }
        }
      }

      function drawGlitch(p, t, bass, treble, flicker) {
        p.noStroke();
        // Horizontal scan bands
        const bandCount = 10 + Math.floor(bass * 30);
        for (let i = 0; i < bandCount; i++) {
          const y = Math.random() * p.height;
          const h = 1 + Math.random() * (8 + treble * 20);
          p.fill(Math.random() > 0.5 ? 255 : 0);
          p.rect(0, y, p.width, h);
        }
        // Vertical slices
        const sliceCount = 5 + Math.floor(treble * 15);
        for (let i = 0; i < sliceCount; i++) {
          const x = Math.random() * p.width;
          const w = 1 + Math.random() * (15 + bass * 30);
          p.fill(Math.random() > 0.5 ? 255 : 0);
          p.rect(x, 0, w, p.height);
        }
      }

      function drawHUD(p, t) {
        const ts = (t * 100).toFixed(0).padStart(8, '0');
        const display = `${ts.slice(0, 2)}:${ts.slice(2, 4)}:${ts.slice(4, 6)}.${ts.slice(6)}`;
        p.textSize(10);
        p.textAlign(p.RIGHT, p.BOTTOM);
        p.fill(120);
        p.noStroke();
        p.text(display, p.width - 8, p.height - 6);
      }

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
    this.pendingBeats++;
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['test-pattern'] = TestPatternPreset;
})();
