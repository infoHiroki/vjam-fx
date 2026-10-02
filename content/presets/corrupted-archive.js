(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// corrupted-archive — コラージュ構図のレトロデジタル。
// 黒地に余白を残し、Bayer ディザの植物 / 青ノイズ矩形 / 破損データ片 /
// 偽 OS エラーダイアログ / ライブ信号のデバッグパネル / ピクセル草を非整列に配置。

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const YELLOW = [232, 216, 72];
const BLUE = [48, 48, 235];
const DARKBLUE = [16, 16, 110];
const ORANGE = [255, 150, 40];
const GREEN = [70, 210, 90];

const ERROR_MSGS = [
  'You have reached the limit.',
  'SIGNAL LOST: deck B',
  'ARCHIVE CORRUPTED (01)',
  'BUFFER OVERRUN AT 0xBEEF',
  'MEMORY PARITY ERROR',
  'DECODE FAILED: frame 0x00FF',
];

const fract = (v) => v - Math.floor(v);
const hash2 = (a, b) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

class CorruptedArchivePreset extends BasePreset {
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
      let pg = null;
      const RES = 4;
      let L = null; // layout

      const layout = () => {
        const W = p.width, H = p.height;
        L = {
          plant: { x: W * 0.05, y: H * 0.06, w: W * 0.30, h: H * 0.76 },
          noise: { x: W * 0.28, y: H * 0.10, w: W * 0.24, h: H * 0.20 },
          strips: [
            { x: W * 0.60, y: H * 0.05, w: W * 0.20, h: H * 0.05 },
            { x: W * 0.66, y: H * 0.115, w: W * 0.14, h: H * 0.04 },
            { x: W * 0.57, y: H * 0.17, w: W * 0.17, h: H * 0.045 },
          ],
          debug: { x: W * 0.065, y: H * 0.665, w: W * 0.185, h: 0 }, // h はフォントから算出
          win: { x: W * 0.42, y: H * 0.36, w: Math.min(W * 0.30, 430), h: Math.max(92, H * 0.17) },
          grassY: H * 0.86,
        };
        pg = p.createGraphics(
          Math.max(16, Math.floor(L.plant.w / RES)),
          Math.max(16, Math.floor(L.plant.h / RES))
        );
        pg.pixelDensity(1);
      };

      // ---- 植物: 低解像バッファに描いて Bayer ディザで黄/青/黒の3値に落とす ----
      const drawPlant = () => {
        const g = pg, t = preset._time;
        const W = g.width, H = g.height;
        g.background(0);
        g.noStroke();
        const sway = Math.sin(t * 0.7) * 0.05 + preset.audio.mid * 0.10;
        const NL = 9;
        for (let i = 0; i < NL; i++) {
          const f = i / (NL - 1);
          // 根元を横に散らし、葉はほぼ垂直に立てる(縦長シルエット)
          const ang = (f - 0.5) * 0.55 + sway * (0.3 + f * 0.7);
          const len = H * (0.55 + 0.42 * Math.sin(f * Math.PI + 0.4 + hash2(i, 11) * 1.2)) * (0.92 + preset.audio.bass * 0.10);
          const wb = W * 0.13 * (0.55 + 0.5 * Math.sin(f * Math.PI));
          const bri = 150 + 90 * Math.sin(f * Math.PI * 1.4 + t * 0.4 + i);
          g.push();
          g.translate(W * (0.5 + (f - 0.5) * 0.55), H * 0.99);
          g.rotate(ang + Math.sin(t * 1.3 + i * 2.1) * 0.03);
          g.fill(bri);
          g.beginShape();
          g.vertex(-wb / 2, 0);
          g.bezierVertex(-wb * 0.55, -len * 0.42, -wb * 0.22, -len * 0.78, 0, -len);
          g.bezierVertex(wb * 0.22, -len * 0.78, wb * 0.55, -len * 0.42, wb / 2, 0);
          g.endShape(p.CLOSE);
          g.pop();
        }

        // ディザ: 明帯(sin バンド)を乗せ、bass/beat で行ズレを起こす
        g.loadPixels();
        const px = g.pixels;
        const n = W * H;
        if (!preset._gray || preset._gray.length !== n) preset._gray = new Float32Array(n);
        const gray = preset._gray;
        for (let i = 0; i < n; i++) gray[i] = px[i * 4];
        const glitch = Math.min(1, preset.beatPulse * 0.9 + preset.audio.bass * 0.4);
        const tSeed = Math.floor(t * 9);
        for (let y = 0; y < H; y++) {
          let shift = 0;
          const hr = hash2(y + 1, tSeed);
          if (hr < glitch * 0.30) shift = Math.floor((fract(hr * 57.31) - 0.5) * W * 0.30 * glitch);
          for (let x = 0; x < W; x++) {
            const sx = (((x + shift) % W) + W) % W;
            let gv = gray[y * W + sx] / 255;
            const band = 0.80 + 0.42 * Math.sin(y * 0.95 + Math.sin(x * 0.07 + t * 0.9) * 1.6 + t * 1.4);
            gv *= band;
            const th = (BAYER4[y & 3][x & 3] + 0.5) / 16;
            const v = gv + (th - 0.5) * 0.55;
            const o = (y * W + x) * 4;
            let c = null;
            if (v > 0.62) c = YELLOW;
            else if (v > 0.30) c = BLUE;
            if (c) { px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; }
            else { px[o] = 0; px[o + 1] = 0; px[o + 2] = 0; }
            px[o + 3] = 255;
          }
        }
        g.updatePixels();
        p.noStroke();
        p.fill(8, 8, 34); // ブロックの紺下地(黒背景から「貼った」感を出す)
        p.rect(L.plant.x, L.plant.y, L.plant.w, L.plant.h);
        p.image(pg, L.plant.x, L.plant.y, L.plant.w, L.plant.h);
      };

      // ---- 青ノイズ矩形 / 白破損データ片: セル単位のハッシュ明滅 ----
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
            if (h < dens * 0.7) p.fill(BLUE[0], BLUE[1], BLUE[2]);
            else if (h < dens) p.fill(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
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

      // ---- ピクセル草: mid で丈が伸び、まれに黄色の花が点く ----
      const drawGrass = () => {
        const W = p.width, H = p.height;
        const pitch = Math.max(4, Math.floor(W / 200));
        const maxH = H - L.grassY;
        const slowT = Math.floor(preset._time * 2);
        p.noStroke();
        for (let x = 0; x < W; x += pitch) {
          if (p.noise(x * 0.004 + 50) < 0.36) continue; // 草むらの切れ目
          const nz = p.noise(x * 0.012, preset._time * 0.5);
          let hgt = (nz * 0.55 + preset.audio.mid * 0.75) * maxH * 1.5;
          hgt = Math.max(pitch, Math.floor(hgt / 4) * 4);
          const shade = 0.55 + hash2(x, 7) * 0.45;
          p.fill(GREEN[0] * shade, GREEN[1] * shade, GREEN[2] * shade);
          p.rect(x, H - hgt, pitch - 1, hgt);
          if (hash2(x, slowT) < 0.045) {
            p.fill(YELLOW[0], YELLOW[1], YELLOW[2]);
            p.rect(x, H - hgt - pitch, pitch - 1, pitch - 1);
          }
        }
      };

      // ---- デバッグパネル: ライブ信号値をそのまま表示(deck2 は遅延コピー) ----
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
        p.fill(28, 28, 190, 235);
        p.rect(b.x, b.y, b.w, h);
        p.fill(240);
        p.textSize(fs);
        p.textAlign(p.LEFT, p.TOP);
        for (let i = 0; i < rows.length; i++) {
          p.text(`${rows[i][0]} : ${rows[i][1].toFixed(7)}`, b.x + fs * 0.7, b.y + fs * 0.5 + i * lh);
        }
      };

      // ---- 偽 OS エラーダイアログ: beat でカスケード出現 ----
      const spawnWindow = () => {
        const slot = preset._msgIdx % 4; // 固定スロットでカスケード(length 基準だと shift 後に同座標へ重なる)
        const j = hash2(preset._msgIdx + 1, 3.7);
        preset.windows.push({
          x: L.win.x + slot * p.width * 0.032 + (j - 0.5) * p.width * 0.03,
          y: L.win.y + slot * p.height * 0.065,
          msg: ERROR_MSGS[preset._msgIdx % ERROR_MSGS.length],
          born: preset._time,
        });
        preset._msgIdx++;
        if (preset.windows.length > 4) preset.windows.shift();
        preset._lastSpawn = preset._time;
      };

      const drawWindows = () => {
        const fs = Math.max(10, Math.floor(p.height * 0.021));
        const bar = fs * 1.5;
        const w = L.win.w, h = L.win.h;
        for (let i = 0; i < preset.windows.length; i++) {
          const win = preset.windows[i];
          const isTop = i === preset.windows.length - 1;
          const depth = (i + 1) / preset.windows.length;
          const appear = Math.min(1, (preset._time - win.born) * 8);
          const a = 255 * (0.35 + 0.65 * depth) * appear;
          let col = isTop ? ORANGE : [90, 200, 120];
          if (isTop && preset.beatPulse > 0.05) {
            const k = preset.beatPulse * 0.6;
            col = [col[0] + (255 - col[0]) * k, col[1] + (255 - col[1]) * k, col[2] + (255 - col[2]) * k];
          }
          p.stroke(col[0], col[1], col[2], a);
          p.strokeWeight(2);
          p.fill(0, 0, 0, 235 * appear);
          p.rect(win.x, win.y, w, h);
          p.line(win.x, win.y + bar, win.x + w, win.y + bar);
          // タイトル + × ボタン
          p.noStroke();
          p.fill(col[0], col[1], col[2], a);
          p.textSize(fs);
          p.textAlign(p.LEFT, p.CENTER);
          p.text('Error', win.x + fs * 0.7, win.y + bar * 0.52);
          const xb = fs * 1.1;
          p.stroke(col[0], col[1], col[2], a);
          p.noFill();
          p.rect(win.x + w - xb - fs * 0.5, win.y + (bar - xb) / 2, xb, xb);
          p.textAlign(p.CENTER, p.CENTER);
          p.noStroke();
          p.fill(col[0], col[1], col[2], a);
          p.text('x', win.x + w - xb * 0.5 - fs * 0.5, win.y + bar * 0.5);
          // アイコン(緑丸に ×)+ メッセージ
          const cy = win.y + bar + (h - bar) * 0.38;
          const r = fs * 0.9;
          p.fill(GREEN[0], GREEN[1], GREEN[2], a);
          p.circle(win.x + fs * 1.6, cy, r * 2);
          p.fill(0, 0, 0, a);
          p.text('x', win.x + fs * 1.6, cy);
          p.fill(235, 235, 235, a);
          p.textAlign(p.LEFT, p.CENTER);
          p.text(win.msg, win.x + fs * 3.0, cy);
          // Yes ボタン
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

        // 背景スペックル(rms で密度)
        p.noStroke();
        const nSpeck = 30 + preset.audio.rms * 120;
        for (let i = 0; i < nSpeck; i++) {
          p.fill(200, 55);
          p.rect(Math.random() * p.width, Math.random() * p.height, 2, 2);
        }

        drawPlant();
        drawNoiseBlock();
        drawStrips();
        drawGrass();
        drawDebugPanel();

        // ダイアログ: beat で出現(0.5s スロットル)、無音時も 4s ごとに自走
        if (preset._wantWindow && preset._time - preset._lastSpawn > 0.5) {
          spawnWindow();
        }
        preset._wantWindow = false;
        if (preset._time - preset._lastSpawn > 4) spawnWindow();
        drawWindows();
      };
    }, container);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['corrupted-archive'] = CorruptedArchivePreset;
})();
