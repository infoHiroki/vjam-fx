(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// corrupted-archive-02 — シリーズ第2弾。01(黄/青の植物)の左右反転構図。
// CGA 風マゼンタ/シアンで「月 + 水槽の魚」。ディザ / 行グリッチ / 偽ダイアログ /
// ライブ信号デバッグパネルはシリーズ共通の署名。

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const MAGENTA = [225, 70, 215];
const CYAN = [80, 220, 230];
const DARKMAG = [140, 28, 138];
const WHITE = [235, 235, 235];

const WARN_MSGS = [
  'ARCHIVE 02: checksum mismatch',
  'SPECIMEN NOT FOUND',
  'WATER LEVEL CRITICAL',
  'You have reached the limit.',
  'FLOW INTERRUPTED: tank B',
  'RESTORE FAILED (02)',
];

const fract = (v) => v - Math.floor(v);
const hash2 = (a, b) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

class CorruptedArchive02Preset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this.windows = [];
    this._lastSpawn = 0;
    this._msgIdx = 0;
    this._wantWindow = false;
    this._lag = { bass: 0, mid: 0, treble: 0 };
    this._gray = null;
    this._grayMoon = null;
    this.fish = [];
    this.bubbles = [];
  }

  updateAudio(d) {
    this.audio.bass = d.bass || 0;
    this.audio.mid = d.mid || 0;
    this.audio.treble = d.treble || 0;
    this.audio.rms = d.rms || 0;
  }

  onBeat(s) {
    this.beatPulse = Math.min(1, s || 0.5);
    this._wantWindow = true;
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      let pg = null;   // 水槽ブロック
      let pgm = null;  // 月
      const RES = 4;
      let L = null;

      const layout = () => {
        const W = p.width, H = p.height;
        L = {
          tank: { x: W * 0.65, y: H * 0.06, w: W * 0.30, h: H * 0.76 },
          moon: { x: W * 0.10, y: H * 0.08, d: H * 0.26 },
          noise: { x: W * 0.50, y: H * 0.58, w: W * 0.22, h: H * 0.20 },
          strips: [
            { x: W * 0.22, y: H * 0.06, w: W * 0.18, h: H * 0.05 },
            { x: W * 0.27, y: H * 0.125, w: W * 0.13, h: H * 0.04 },
            { x: W * 0.19, y: H * 0.18, w: W * 0.16, h: H * 0.045 },
          ],
          debug: { x: W * 0.755, y: H * 0.665, w: W * 0.185 },
          win: { x: W * 0.13, y: H * 0.34, w: Math.min(W * 0.28, 420), h: Math.max(92, H * 0.17) },
          waterY: H * 0.87,
        };
        pg = p.createGraphics(
          Math.max(16, Math.floor(L.tank.w / RES)),
          Math.max(16, Math.floor(L.tank.h / RES))
        );
        pg.pixelDensity(1);
        const md = Math.max(16, Math.floor(L.moon.d / RES));
        pgm = p.createGraphics(md, md);
        pgm.pixelDensity(1);
        // 魚とバブルの初期化(pg 座標系)
        preset.fish = [];
        for (let i = 0; i < 3; i++) {
          preset.fish.push({
            x: hash2(i, 1.7) * pg.width,
            y: pg.height * (0.20 + i * 0.20),
            len: pg.width * (0.52 - i * 0.09),
            dir: i % 2 === 0 ? 1 : -1,
            tone: i % 2 === 0 ? 230 : 150, // 明=シアン寄り / 中=マゼンタ寄り
            speed: 0.25 + hash2(i, 3.3) * 0.2,
          });
        }
        preset.bubbles = [];
        for (let i = 0; i < 10; i++) {
          preset.bubbles.push({
            x: hash2(i, 7.1) * pg.width,
            y: hash2(i, 9.4) * pg.height,
            r: 1 + hash2(i, 4.2) * 2.5,
          });
        }
      };

      // 共通ディザ: グレースケール pg → 3値(黒 / 中間色 / 明色)
      const ditherTo = (g, grayBuf, colMid, colHi, glitch) => {
        g.loadPixels();
        const px = g.pixels;
        const W = g.width, H = g.height;
        const t = preset._time;
        const n = W * H;
        for (let i = 0; i < n; i++) grayBuf[i] = px[i * 4];
        const tSeed = Math.floor(t * 9);
        for (let y = 0; y < H; y++) {
          let shift = 0;
          const hr = hash2(y + 1, tSeed);
          if (hr < glitch * 0.30) shift = Math.floor((fract(hr * 57.31) - 0.5) * W * 0.30 * glitch);
          for (let x = 0; x < W; x++) {
            const sx = (((x + shift) % W) + W) % W;
            let gv = grayBuf[y * W + sx] / 255;
            const band = 0.80 + 0.42 * Math.sin(y * 0.95 + Math.sin(x * 0.07 + t * 0.9) * 1.6 + t * 1.4);
            gv *= band;
            const th = (BAYER4[y & 3][x & 3] + 0.5) / 16;
            const v = gv + (th - 0.5) * 0.55;
            const o = (y * W + x) * 4;
            let c = null;
            if (v > 0.62) c = colHi;
            else if (v > 0.30) c = colMid;
            if (c) { px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; }
            else { px[o] = 0; px[o + 1] = 0; px[o + 2] = 0; }
            px[o + 3] = 255;
          }
        }
        g.updatePixels();
      };

      // ---- 水槽: 水面 + 魚 + バブルをグレースケールで描く ----
      const drawTank = () => {
        const g = pg, t = preset._time;
        const W = g.width, H = g.height;
        g.background(0);
        g.noStroke();
        // 水面(上端の波線)
        g.fill(230);
        for (let x = 0; x < W; x++) {
          const ys = 4 + Math.sin(x * 0.35 + t * 2.2) * (1.5 + preset.audio.mid * 3);
          g.rect(x, ys, 1, 2);
        }
        // 水中のうっすらした地(下ほど暗い層)
        for (let i = 0; i < 4; i++) {
          g.fill(72 - i * 12);
          g.rect(0, H * (0.25 + i * 0.19), W, H * 0.19);
        }
        // 海藻(底から揺れる帯、mid で大きくなびく)
        for (let k = 0; k < 5; k++) {
          const bx = W * (0.12 + k * 0.19);
          const kh = H * (0.30 + hash2(k, 2.9) * 0.25);
          const tone = 95 + hash2(k, 6.1) * 45;
          g.fill(tone);
          const seg = 8;
          for (let s = 0; s < seg; s++) {
            const f2 = s / seg;
            const sway = Math.sin(t * 1.1 + k * 1.8 + f2 * 2.4) * (2 + preset.audio.mid * 6) * f2;
            const ww = W * 0.045 * (1 - f2 * 0.6);
            g.rect(bx + sway - ww / 2, H - kh * f2 - kh / seg, ww, kh / seg + 1);
          }
        }
        // 魚
        for (const f of preset.fish) {
          f.x += f.dir * (f.speed + preset.audio.mid * 0.9);
          if (f.x > W + f.len) f.x = -f.len;
          if (f.x < -f.len) f.x = W + f.len;
          const y = f.y + Math.sin(t * 1.6 + f.x * 0.08) * 2.5;
          const wag = Math.sin(t * 9 + f.x * 0.5) * f.len * 0.14;
          g.fill(f.tone);
          g.ellipse(f.x, y, f.len, f.len * 0.38);
          g.triangle(
            f.x - f.dir * f.len * 0.48, y,
            f.x - f.dir * f.len * 0.75, y - f.len * 0.18 + wag,
            f.x - f.dir * f.len * 0.75, y + f.len * 0.18 + wag
          );
          g.fill(f.tone * 0.55);
          g.triangle(f.x, y - f.len * 0.12, f.x + f.dir * f.len * 0.12, y - f.len * 0.34, f.x - f.dir * f.len * 0.08, y - f.len * 0.30);
          g.fill(0);
          g.circle(f.x + f.dir * f.len * 0.32, y - f.len * 0.04, Math.max(1.5, f.len * 0.07));
        }
        // バブル(treble で速く)
        g.fill(130);
        for (const b of preset.bubbles) {
          b.y -= 0.3 + preset.audio.treble * 1.4;
          if (b.y < 6) { b.y = H + 2; b.x = hash2(Math.floor(t * 3), b.x) * W; }
          g.circle(b.x + Math.sin(t * 3 + b.y * 0.2) * 1.5, b.y, b.r);
        }
        const glitch = Math.min(1, preset.beatPulse * 0.9 + preset.audio.bass * 0.4);
        const n = W * H;
        if (!preset._gray || preset._gray.length !== n) preset._gray = new Float32Array(n);
        ditherTo(g, preset._gray, DARKMAG, CYAN, glitch);
        p.noStroke();
        p.fill(10, 6, 30); // 紺の下地
        p.rect(L.tank.x, L.tank.y, L.tank.w, L.tank.h);
        p.image(pg, L.tank.x, L.tank.y, L.tank.w, L.tank.h);
      };

      // ---- 月: クレーター入りの円をディザ(マゼンタ/白) ----
      const drawMoon = () => {
        const g = pgm, t = preset._time;
        const W = g.width;
        g.background(0);
        g.noStroke();
        const r = W * 0.46;
        g.fill(215);
        g.circle(W / 2, W / 2, r * 2);
        // クレーター(固定ハッシュ配置)
        for (let i = 0; i < 7; i++) {
          const a = hash2(i, 2.3) * Math.PI * 2;
          const dr = hash2(i, 6.8) * r * 0.62;
          const cr = r * (0.10 + hash2(i, 8.9) * 0.16);
          g.fill(120 + hash2(i, 5.1) * 40);
          g.circle(W / 2 + Math.cos(a) * dr, W / 2 + Math.sin(a) * dr, cr * 2);
        }
        // 欠け(暗い円を重ねて三日月化、ゆっくり満ち欠け)
        const ph = Math.sin(t * 0.05) * r * 1.1;
        g.fill(28);
        g.circle(W / 2 + r * 0.9 + ph, W / 2 - r * 0.2, r * 1.7);
        const n = W * W;
        if (!preset._grayMoon || preset._grayMoon.length !== n) preset._grayMoon = new Float32Array(n);
        ditherTo(g, preset._grayMoon, MAGENTA, WHITE, Math.min(0.5, preset.beatPulse * 0.5));
        p.image(pgm, L.moon.x, L.moon.y, L.moon.d, L.moon.d);
      };

      // ---- マゼンタノイズ矩形 / 白破損データ片 ----
      const drawNoiseBlock = () => {
        const b = L.noise;
        const cell = Math.max(4, Math.floor(p.width / 220));
        const tt = Math.floor(preset._time * (6 + preset.audio.treble * 18));
        p.noStroke();
        p.fill(0);
        p.rect(b.x, b.y, b.w, b.h);
        const dens = 0.5 + preset.audio.treble * 0.35;
        for (let yy = 0; yy < b.h - cell; yy += cell) {
          for (let xx = 0; xx < b.w - cell; xx += cell) {
            const h = hash2(xx * 0.37 + 1, yy * 0.61 + tt * 0.173);
            if (h < dens * 0.7) p.fill(MAGENTA[0], MAGENTA[1], MAGENTA[2]);
            else if (h < dens) p.fill(DARKMAG[0], DARKMAG[1], DARKMAG[2]);
            else continue;
            p.rect(b.x + xx, b.y + yy, cell, cell);
          }
        }
      };

      const drawStrips = () => {
        const cell = Math.max(3, Math.floor(p.width / 320));
        const tt = Math.floor(preset._time * 4);
        p.noStroke();
        for (let s = 0; s < L.strips.length; s++) {
          const b = L.strips[s];
          const dens = 0.32 + preset.audio.treble * 0.25;
          for (let yy = 0; yy < b.h - cell; yy += cell) {
            for (let xx = 0; xx < b.w - cell; xx += cell) {
              const h = hash2(xx * 0.53 + s * 91, yy * 0.71 + tt * 0.219);
              if (h > dens) continue;
              const v = 180 + Math.floor(h * 200);
              p.fill(v, v, v);
              p.rect(b.x + xx, b.y + yy, cell, cell);
            }
          }
        }
      };

      // ---- 水面フッター: シアンの波バー + 白い泡先端 ----
      const drawWater = () => {
        const W = p.width, H = p.height;
        const pitch = Math.max(4, Math.floor(W / 200));
        const maxH = H - L.waterY;
        p.noStroke();
        for (let x = 0; x < W; x += pitch) {
          if (p.noise(x * 0.004 + 90) < 0.34) continue;
          const nz = p.noise(x * 0.015, preset._time * 0.7);
          let hgt = (nz * 0.5 + preset.audio.mid * 0.8) * maxH * 1.5;
          hgt = Math.max(pitch, Math.floor(hgt / 4) * 4);
          const shade = 0.45 + hash2(x, 13) * 0.5;
          p.fill(CYAN[0] * shade, CYAN[1] * shade, CYAN[2] * shade);
          p.rect(x, H - hgt, pitch - 1, hgt);
          if (hash2(x, Math.floor(preset._time * 2)) < 0.06) {
            p.fill(WHITE[0], WHITE[1], WHITE[2]);
            p.rect(x, H - hgt - pitch, pitch - 1, pitch - 1);
          }
        }
      };

      // ---- デバッグパネル(シリーズ署名、02 はマゼンタ地) ----
      const drawDebugPanel = () => {
        const b = L.debug;
        const fs = Math.max(9, Math.floor(p.height * 0.018));
        const lh = fs * 1.4;
        const rows = [
          ['deck1_low ', preset.audio.bass],
          ['deck1_mid ', preset.audio.mid],
          ['deck1_high', preset.audio.treble],
          ['deck2_low ', preset._lag.bass],
          ['deck2_mid ', preset._lag.mid],
          ['deck2_high', preset._lag.treble],
        ];
        const h = lh * rows.length + fs;
        p.noStroke();
        p.fill(120, 16, 110, 235);
        p.rect(b.x, b.y, b.w, h);
        p.fill(240);
        p.textSize(fs);
        p.textAlign(p.LEFT, p.TOP);
        for (let i = 0; i < rows.length; i++) {
          p.text(`${rows[i][0]} : ${rows[i][1].toFixed(7)}`, b.x + fs * 0.7, b.y + fs * 0.5 + i * lh);
        }
      };

      // ---- 偽ダイアログ(02 は Warning / シアン系) ----
      const spawnWindow = () => {
        const slot = preset._msgIdx % 4;
        const j = hash2(preset._msgIdx + 1, 3.7);
        preset.windows.push({
          x: L.win.x + slot * p.width * 0.032 + (j - 0.5) * p.width * 0.03,
          y: L.win.y + slot * p.height * 0.065,
          msg: WARN_MSGS[preset._msgIdx % WARN_MSGS.length],
          born: preset._time,
        });
        preset._msgIdx++;
        if (preset.windows.length > 4) preset.windows.shift();
        preset._lastSpawn = preset._time;
      };

      const drawWindows = () => {
        const fs = Math.max(10, Math.floor(p.height * 0.021));
        const bar = fs * 1.5;
        const h = L.win.h;
        p.textSize(fs);
        for (let i = 0; i < preset.windows.length; i++) {
          const win = preset.windows[i];
          const w = Math.max(L.win.w, p.textWidth(win.msg) + fs * 4.5); // 長文はみ出し防止
          const isTop = i === preset.windows.length - 1;
          const depth = (i + 1) / preset.windows.length;
          const appear = Math.min(1, (preset._time - win.born) * 8);
          const a = 255 * (0.35 + 0.65 * depth) * appear;
          let col = isTop ? CYAN : [150, 70, 145];
          if (isTop && preset.beatPulse > 0.05) {
            const k = preset.beatPulse * 0.6;
            col = [col[0] + (255 - col[0]) * k, col[1] + (255 - col[1]) * k, col[2] + (255 - col[2]) * k];
          }
          p.stroke(col[0], col[1], col[2], a);
          p.strokeWeight(2);
          p.fill(0, 0, 0, 235 * appear);
          p.rect(win.x, win.y, w, h);
          p.line(win.x, win.y + bar, win.x + w, win.y + bar);
          p.noStroke();
          p.fill(col[0], col[1], col[2], a);
          p.textSize(fs);
          p.textAlign(p.LEFT, p.CENTER);
          p.text('Warning', win.x + fs * 0.7, win.y + bar * 0.52);
          const xb = fs * 1.1;
          p.stroke(col[0], col[1], col[2], a);
          p.noFill();
          p.rect(win.x + w - xb - fs * 0.5, win.y + (bar - xb) / 2, xb, xb);
          p.noStroke();
          p.fill(col[0], col[1], col[2], a);
          p.textAlign(p.CENTER, p.CENTER);
          p.text('x', win.x + w - xb * 0.5 - fs * 0.5, win.y + bar * 0.5);
          const cy = win.y + bar + (h - bar) * 0.38;
          const r = fs * 0.9;
          p.fill(MAGENTA[0], MAGENTA[1], MAGENTA[2], a);
          p.circle(win.x + fs * 1.6, cy, r * 2);
          p.fill(0, 0, 0, a);
          p.text('!', win.x + fs * 1.6, cy);
          p.fill(235, 235, 235, a);
          p.textAlign(p.LEFT, p.CENTER);
          p.text(win.msg, win.x + fs * 3.0, cy);
          const bw = fs * 5, bh = fs * 1.6;
          const bx = win.x + (w - bw) / 2, by = win.y + h - bh - fs * 0.5;
          p.stroke(col[0], col[1], col[2], a);
          if (isTop && preset.beatPulse > 0.4) p.fill(col[0], col[1], col[2], a * 0.4);
          else p.noFill();
          p.rect(bx, by, bw, bh);
          p.noStroke();
          p.fill(col[0], col[1], col[2], a);
          p.textAlign(p.CENTER, p.CENTER);
          p.text('Yes', bx + bw / 2, by + bh / 2);
        }
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
        for (const k of ['bass', 'mid', 'treble']) {
          preset._lag[k] += (preset.audio[k] - preset._lag[k]) * 0.03;
        }

        // 背景スペックル(星)
        p.noStroke();
        const nSpeck = 30 + preset.audio.rms * 120;
        for (let i = 0; i < nSpeck; i++) {
          p.fill(200, 55);
          p.rect(Math.random() * p.width, Math.random() * p.height, 2, 2);
        }

        drawMoon();
        drawTank();
        drawNoiseBlock();
        drawStrips();
        drawWater();
        drawDebugPanel();

        if (preset._wantWindow && preset._time - preset._lastSpawn > 0.5) spawnWindow();
        preset._wantWindow = false;
        if (preset._time - preset._lastSpawn > 4) spawnWindow();
        drawWindows();
      };
    }, container);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['corrupted-archive-02'] = CorruptedArchive02Preset;
})();
