(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// tv-testcard — 偽TV放送シリーズ第2弾「放送終了」。
// SMPTE カラーバーに偽装した7帯域イコライザー: 各色帯が音で伸び縮みする。
// 砂嵐(treble) / 時報リング(beat) / 水平同期の裂け(強め拍) /
// 強拍で画面が一瞬砂嵐に飲まれる / 「しばらくお待ちください」プレート。

const BARS = [
  [180, 180, 180], // white 75%
  [180, 180, 16],  // yellow
  [16, 180, 180],  // cyan
  [16, 180, 16],   // green
  [180, 16, 180],  // magenta
  [180, 16, 16],   // red
  [16, 16, 180],   // blue
];
const STRIP = [
  [16, 16, 180], [20, 20, 20], [180, 16, 180], [20, 20, 20], [16, 180, 180], [20, 20, 20], [180, 180, 180],
];

class TvTestcardPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this._levels = new Float32Array(7);
    this._ring = -10;
    this._swallowUntil = -10;
    this._lastSwallow = -10;
  }

  updateAudio(d) {
    this.audio.bass = d.bass || 0;
    this.audio.mid = d.mid || 0;
    this.audio.treble = d.treble || 0;
    this.audio.rms = d.rms || 0;
  }

  onBeat(s) {
    this.beatPulse = Math.min(1, s || 0.5);
    this._ring = this._time;
    if ((s || 0) > 0.85) this._wantSwallow = true;
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      let pgs = null; // 砂嵐バッファ(低解像を拡大)
      let L = null;

      const layout = () => {
        const H = p.height;
        L = {
          fs: Math.max(11, Math.floor(H * 0.024)),
          barBottom: H * 0.62,
          stripY: H * 0.62,
          stripH: H * 0.08,
          bottomY: H * 0.70,
        };
        pgs = p.createGraphics(200, Math.max(16, Math.floor(200 * p.height / p.width)));
        pgs.pixelDensity(1);
      };

      // ---- カラーバー = 7帯域イコライザー ----
      const drawBars = () => {
        const W = p.width;
        const a = preset.audio;
        // 7つの疑似帯域(左から低域→高域、末尾は拍)
        const targets = [
          a.rms,
          a.bass,
          a.bass * 0.6 + a.mid * 0.4,
          a.mid,
          a.mid * 0.5 + a.treble * 0.5,
          a.treble,
          preset.beatPulse,
        ];
        const bw = W / 7;
        for (let i = 0; i < 7; i++) {
          preset._levels[i] += (targets[i] - preset._levels[i]) * 0.3;
          const lv = Math.min(1, preset._levels[i]);
          const idle = 0.10 + 0.05 * Math.sin(preset._time * 1.1 + i * 0.9); // 無音でも呼吸
          const h = L.barBottom * Math.min(1, idle + lv * 0.92);
          const c = BARS[i];
          // 帯の全域は暗色、下から明色が伸びる(EQ 読み)
          p.noStroke();
          p.fill(c[0] * 0.22, c[1] * 0.22, c[2] * 0.22);
          p.rect(i * bw, 0, bw + 1, L.barBottom);
          p.fill(c[0], c[1], c[2]);
          p.rect(i * bw, L.barBottom - h, bw + 1, h);
          // 天面の白いピークライン
          p.fill(240, 240, 240, 200);
          p.rect(i * bw, L.barBottom - h - 2, bw + 1, 3);
        }
      };

      // ---- 中段の反転ストリップ + 下段(プレート・PLUGE) ----
      const drawLower = () => {
        const W = p.width, H = p.height;
        const sw = W / STRIP.length;
        p.noStroke();
        for (let i = 0; i < STRIP.length; i++) {
          const c = STRIP[i];
          const k = 1 + preset.beatPulse * 0.5; // 拍でわずかに明滅
          p.fill(Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k));
          p.rect(i * sw, L.stripY, sw + 1, L.stripH);
        }
        // 下段
        p.fill(24, 24, 26);
        p.rect(0, L.bottomY, W, H - L.bottomY);
        // PLUGE(右端の3段グレー)
        const pw = W * 0.06;
        for (let i = 0; i < 3; i++) {
          p.fill(10 + i * 14);
          p.rect(W - pw * (3 - i), L.bottomY + H * 0.05, pw, H * 0.16);
        }
        // -I / +Q 風ブロック(左)
        p.fill(40, 40, 90);
        p.rect(W * 0.03, L.bottomY + H * 0.05, W * 0.08, H * 0.16);
        p.fill(90, 40, 90);
        p.rect(W * 0.13, L.bottomY + H * 0.05, W * 0.08, H * 0.16);
        // 中央プレート「しばらくお待ちください」
        const plw = W * 0.42, plh = H * 0.13;
        const plx = (W - plw) / 2, ply = L.bottomY + (H - L.bottomY - plh) / 2;
        p.fill(225);
        p.rect(plx, ply, plw, plh, 6);
        p.fill(20);
        p.textFont('sans-serif');
        p.textSize(L.fs * 1.35);
        p.textAlign(p.CENTER, p.CENTER);
        p.text('しばらくお待ちください', plx + plw / 2, ply + plh * 0.42);
        p.textFont('monospace');
        p.textSize(L.fs * 0.8);
        p.text('PLEASE STAND BY', plx + plw / 2, ply + plh * 0.76);
        // OFF AIR(明滅) + 時計
        const blink = Math.floor(preset._time * 1.6) % 2 === 0;
        if (blink) {
          p.fill(200, 40, 40);
          p.circle(W * 0.045, H * 0.955, L.fs * 0.7);
        }
        p.fill(210);
        p.textSize(L.fs);
        p.textAlign(p.LEFT, p.CENTER);
        p.text('OFF AIR - VJAM TV', W * 0.065, H * 0.955);
        const sec = Math.floor(preset._time) % 60;
        p.textAlign(p.RIGHT, p.CENTER);
        p.text(`FRI 25:00:${String(sec).padStart(2, '0')}`, W * 0.97, H * 0.955);
      };

      // ---- 水平同期の裂け(強め拍で数本の帯が横ズレ) ----
      const drawTear = () => {
        if (preset.beatPulse < 0.45) return;
        const W = p.width;
        for (let i = 0; i < 3; i++) {
          const sy = Math.floor(Math.random() * L.barBottom);
          const sh = 8 + Math.floor(Math.random() * 26);
          const dx = Math.floor((Math.random() - 0.5) * W * 0.08 * preset.beatPulse);
          p.copy(0, sy, W, sh, dx, sy, W, sh);
        }
      };

      // ---- 砂嵐(低解像バッファを拡大、treble で濃く、強拍で飲み込む) ----
      const drawStatic = () => {
        const swallow = preset._time < preset._swallowUntil;
        const dens = swallow ? 0.85 : 0.05 + preset.audio.treble * 0.28;
        const g = pgs;
        g.loadPixels();
        const px = g.pixels;
        const n = g.width * g.height;
        for (let i = 0; i < n; i++) {
          const o = i * 4;
          if (Math.random() < dens) {
            const v = 60 + Math.random() * 195;
            px[o] = v; px[o + 1] = v; px[o + 2] = v;
            px[o + 3] = swallow ? 255 : 150;
          } else {
            px[o + 3] = 0;
          }
        }
        g.updatePixels();
        p.image(pgs, 0, 0, p.width, p.height);
      };

      // ---- 時報リング(beat で中心から広がる) ----
      const drawRing = () => {
        const age = preset._time - preset._ring;
        if (age > 0.45) return;
        const f = age / 0.45;
        p.noFill();
        p.stroke(255, 255, 255, 220 * (1 - f));
        p.strokeWeight(3.5 * (1 - f) + 1);
        p.circle(p.width / 2, p.height * 0.36, p.height * (0.12 + f * 0.75));
        p.noStroke();
      };

      // ---- CRT ロール + 走査線 ----
      const drawCrt = () => {
        const H = p.height, W = p.width;
        const rollY = ((preset._time * 40) % (H * 1.4)) - H * 0.2;
        p.noStroke();
        p.fill(255, 255, 255, 10);
        p.rect(0, rollY, W, H * 0.10);
        p.fill(0, 0, 0, 34);
        for (let y = 0; y < H; y += 4) p.rect(0, y, W, 1.5);
      };

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.noSmooth();
        p.textFont('monospace');
        layout();
      };

      p.draw = () => {
        p.background(0);
        preset._time += (p.deltaTime || 16.7) / 1000;
        preset.beatPulse *= 0.93;
        if (preset._wantSwallow && preset._time - preset._lastSwallow > 4) {
          preset._swallowUntil = preset._time + 0.35;
          preset._lastSwallow = preset._time;
        }
        preset._wantSwallow = false;

        drawBars();
        drawLower();
        drawTear();
        drawStatic();
        drawRing();
        drawCrt();
      };
    }, container);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['tv-testcard'] = TvTestcardPreset;
})();
