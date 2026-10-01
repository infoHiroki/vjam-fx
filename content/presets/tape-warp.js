(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class TapeWarpPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this.trackingBurst = 0;
    this.trackingAge = 999;
    this.wowPhase = Math.random() * Math.PI * 2;
    this.flutterPhase = Math.random() * Math.PI * 2;
    this.jitterSeed = Math.random() * 1000;
    this.bandSeed = Math.random() * 1000;
    this._hueTime = 0;
  }

  setup(container) {
    this.destroy();
    this.beatPulse = 0;
    this.trackingBurst = 0;
    this.trackingAge = 999;
    this.wowPhase = Math.random() * Math.PI * 2;
    this.flutterPhase = Math.random() * Math.PI * 2;
    const preset = this;

    this.p5 = new p5((p) => {
      let pg;
      const RES = 4;

      const buildBuffer = () => {
        pg = p.createGraphics(
          Math.max(80, Math.ceil(p.width / RES)),
          Math.max(60, Math.ceil(p.height / RES))
        );
        pg.pixelDensity(1);
        pg.noSmooth();
      };

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.noSmooth();
        buildBuffer();
      };

      p.draw = () => {
        preset.beatPulse *= 0.9;
        preset.trackingBurst *= 0.88;
        preset.trackingAge += 1;
        preset.wowPhase += 0.012 + preset.audio.bass * 0.08 + preset.audio.rms * 0.03;
        preset.flutterPhase += 0.06 + preset.audio.treble * 0.35;
        preset._hueTime += 0.008 + preset.audio.rms * 0.015;

        p.background(0);
        preset._drawSignal(pg, p);
        preset._renderWarpedFrame(p, pg);
        preset._drawOverlays(p);
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
        if (pg) pg.remove();
        buildBuffer();
      };
    }, container);
  }

  _drawSignal(pg, p) {
    const t = p.frameCount;
    const bass = this.audio.bass;
    const mid = this.audio.mid;
    const treble = this.audio.treble;
    const rms = this.audio.rms;
    const scanDrift = Math.sin(this.wowPhase * 0.5) * 0.18;
    const ht = this._hueTime;

    pg.background(0);
    pg.noStroke();

    for (let y = 0; y < pg.height; y += 2) {
      const n = pg.noise(this.bandSeed, y * 0.05, t * 0.015);
      const glow = 10 + n * 18 + bass * 28;
      const hr = 0.5 + 0.5 * Math.cos(6.28318 * (ht * 0.12 + 0.0));
      const hg = 0.5 + 0.5 * Math.cos(6.28318 * (ht * 0.12 + 0.33));
      const hb = 0.5 + 0.5 * Math.cos(6.28318 * (ht * 0.12 + 0.67));
      pg.fill(glow * (0.6 + hr * 0.6), glow * (0.5 + hg * 0.6), glow * (0.7 + hb * 0.6));
      pg.rect(0, y, pg.width, 2);
    }

    const cols = 9;
    for (let i = 0; i < cols; i++) {
      const x = (i / (cols - 1)) * pg.width;
      const sway = Math.sin(this.wowPhase + i * 0.6) * (2 + bass * 4);
      const hueShift = 0.45 + 0.55 * Math.sin(t * 0.03 + i * 0.8);
      const cr = 0.5 + 0.5 * Math.cos(6.28318 * (ht * 0.1 + i * 0.08 + 0.0));
      const cg = 0.5 + 0.5 * Math.cos(6.28318 * (ht * 0.1 + i * 0.08 + 0.33));
      const cb = 0.5 + 0.5 * Math.cos(6.28318 * (ht * 0.1 + i * 0.08 + 0.67));
      pg.fill(
        (35 + hueShift * 95 + mid * 80) * (0.5 + cr * 0.7),
        (25 + hueShift * 70) * (0.5 + cg * 0.7),
        (55 + hueShift * 110 + treble * 60) * (0.5 + cb * 0.7),
        160
      );
      pg.rect(x + sway, 0, 2 + mid * 2, pg.height);
    }

    for (let i = 0; i < 6; i++) {
      const stripeY = (i / 5) * pg.height;
      const h = 1 + ((i + t) % 2);
      const band = 30 + i * 20 + rms * 80;
      const sr = 0.5 + 0.5 * Math.cos(6.28318 * (ht * 0.08 + i * 0.12 + 0.0));
      const sg = 0.5 + 0.5 * Math.cos(6.28318 * (ht * 0.08 + i * 0.12 + 0.33));
      const sb = 0.5 + 0.5 * Math.cos(6.28318 * (ht * 0.08 + i * 0.12 + 0.67));
      pg.fill(band * (0.6 + sr * 0.6), band * (0.5 + sg * 0.6), band * (0.7 + sb * 0.6), 170);
      pg.rect(0, stripeY + scanDrift * pg.height * 0.08, pg.width, h);
    }

    const centerBand = pg.height * (0.3 + 0.35 * Math.sin(this.wowPhase * 0.4));
    const ccr = 0.5 + 0.5 * Math.cos(6.28318 * (ht * 0.15 + 0.0));
    const ccg = 0.5 + 0.5 * Math.cos(6.28318 * (ht * 0.15 + 0.33));
    const ccb = 0.5 + 0.5 * Math.cos(6.28318 * (ht * 0.15 + 0.67));
    pg.fill(
      (180 + bass * 55) * (0.5 + ccr * 0.7),
      (180 + mid * 35) * (0.5 + ccg * 0.7),
      (210 + treble * 35) * (0.5 + ccb * 0.7),
      50 + this.beatPulse * 50
    );
    pg.rect(0, centerBand, pg.width, 3 + bass * 5);

    const trackingBandY = ((t * (0.7 + bass * 2.2)) % (pg.height + 18)) - 9;
    for (let y = -4; y <= 4; y++) {
      const dist = Math.abs(y) / 4;
      const bandAlpha = (1 - dist) * (30 + bass * 45 + this.trackingBurst * 120);
      const bandBright = 120 + (1 - dist) * 90 + treble * 60;
      pg.fill(bandBright, bandBright, bandBright, bandAlpha);
      pg.rect(0, trackingBandY + y, pg.width, 1.2);
    }

    const sparkleCount = 12 + Math.floor(treble * 34 + this.beatPulse * 24);
    for (let i = 0; i < sparkleCount; i++) {
      const px = Math.random() * pg.width;
      const py = Math.random() * pg.height;
      const luma = 100 + Math.random() * 140;
      pg.fill(luma, luma, luma, 80 + treble * 60);
      pg.rect(px, py, 1, 1);
    }
  }

  _renderWarpedFrame(p, pg) {
    const h = p.height;
    const rowH = Math.max(2, Math.floor(h / 120));
    const bass = this.audio.bass;
    const treble = this.audio.treble;
    const mid = this.audio.mid;
    const rms = this.audio.rms;
    const wobbleAmp = p.width * (0.02 + bass * 0.18 + this.trackingBurst * 0.1);
    const flutterAmp = p.width * (0.004 + treble * 0.05);
    const beatKink = this.trackingBurst * p.width * 0.15;
    const windowCenter = 0.34 + 0.32 * Math.sin(this.wowPhase * 0.9 + mid * 2.7);
    const windowSize = 0.08 + this.trackingBurst * 0.14;

    p.noSmooth();
    for (let y = 0; y < h; y += rowH) {
      const yn = y / Math.max(1, h - 1);
      const srcY = Math.floor(yn * (pg.height - 1));
      const wow = Math.sin(yn * 6.5 + this.wowPhase) * wobbleAmp;
      const flutter = Math.sin(yn * 58 + this.flutterPhase * 2.7) * flutterAmp;
      const jitterNoise = p.noise(this.jitterSeed + yn * 9, p.frameCount * (0.04 + treble * 0.06));
      const jitter = (jitterNoise - 0.5) * p.width * (0.004 + treble * 0.018);
      const trackDelta = Math.abs(yn - windowCenter);
      const trackMask = Math.max(0, 1 - trackDelta / Math.max(0.001, windowSize));
      const kink = Math.sin(yn * 120 + this.flutterPhase * 4.2) * beatKink * trackMask;
      const stretch = 1 + bass * 0.08 + trackMask * this.trackingBurst * 0.28 + rms * 0.03;
      const dx = wow + flutter + jitter + kink;
      const dw = p.width * stretch;
      const offsetX = (p.width - dw) * 0.5 + dx;
      p.image(pg, offsetX, y, dw, rowH + 1, 0, srcY, pg.width, 1);
    }
  }

  _drawOverlays(p) {
    const t = p.frameCount;
    const pulse = this.beatPulse;
    const grit = 8 + this.audio.treble * 18;

    p.noStroke();
    p.fill(255, 255, 255, 10 + pulse * 20);
    for (let i = 0; i < grit; i++) {
      const x = Math.random() * p.width;
      const y = Math.random() * p.height;
      p.rect(x, y, 1, 1);
    }

    p.fill(255, 255, 255, 8 + this.trackingBurst * 35);
    const head = (t * 7) % p.height;
    p.rect(0, head, p.width, 1 + this.audio.bass * 2);

    p.fill(0, 0, 0, 70);
    for (let y = 0; y < p.height; y += 4) {
      p.rect(0, y, p.width, 1);
    }
  }

  updateAudio(data) {
    this.audio.bass = data.bass || 0;
    this.audio.mid = data.mid || 0;
    this.audio.treble = data.treble || 0;
    this.audio.rms = data.rms || 0;
  }

  onBeat(strength) {
    this.beatPulse = Math.max(this.beatPulse, strength);
    this.trackingBurst = Math.max(this.trackingBurst, 0.55 + strength * 0.8);
    this.trackingAge = 0;
    this.wowPhase += 0.6 + strength * 1.4;
    this.flutterPhase += 1.2 + strength * 1.8;
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['tape-warp'] = TapeWarpPreset;
})();
