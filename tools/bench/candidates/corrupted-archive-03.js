(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// corrupted-archive-03 — シリーズ第3弾「蛾と街灯」。
// アンバー/グリーンの夜。中央の縦長ブロックに街灯と群がる蛾、
// 雨のスペックルと地面の波紋。ディザ / 行グリッチ / 偽ダイアログ /
// デバッグパネルはシリーズ共通の署名。

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const AMBER = [250, 168, 50];
const GREEN = [52, 155, 70];
const DARKAMBER = [130, 78, 18];
const WHITE = [235, 235, 235];

const ALERT_MSGS = [
  'ARCHIVE 03: exposure damaged',
  'LIGHT SOURCE UNSTABLE',
  'MOTH COUNT EXCEEDED',
  'You have reached the limit.',
  'LAMP 07: flicker detected',
  'NIGHT MODE PERMANENT',
];

const fract = (v) => v - Math.floor(v);
const hash2 = (a, b) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

class CorruptedArchive03Preset extends BasePreset {
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
    this.moths = [];
    this.ripples = [];
    this._flickerUntil = -1;
    this._nextFlicker = 3;
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
    this._wantRipple = true;
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      let pg = null;
      const RES = 4;
      let L = null;

      const layout = () => {
        const W = p.width, H = p.height;
        L = {
          lamp: { x: W * 0.36, y: H * 0.05, w: W * 0.26, h: H * 0.78 },
          noise: { x: W * 0.67, y: H * 0.08, w: W * 0.22, h: H * 0.16 },
          strips: [
            { x: W * 0.70, y: H * 0.30, w: W * 0.18, h: H * 0.05 },
            { x: W * 0.74, y: H * 0.365, w: W * 0.13, h: H * 0.04 },
            { x: W * 0.68, y: H * 0.42, w: W * 0.16, h: H * 0.045 },
          ],
          debug: { x: W * 0.67, y: H * 0.60, w: W * 0.185 },
          win: { x: W * 0.05, y: H * 0.30, w: Math.min(W * 0.26, 400), h: Math.max(92, H * 0.17) },
          groundY: H * 0.895,
        };
        pg = p.createGraphics(
          Math.max(16, Math.floor(L.lamp.w / RES)),
          Math.max(16, Math.floor(L.lamp.h / RES))
        );
        pg.pixelDensity(1);
        preset.moths = [];
        for (let i = 0; i < 8; i++) {
          preset.moths.push({
            a: hash2(i, 1.3) * Math.PI * 2,
            r: 10 + hash2(i, 4.7) * 22,
            speed: 0.8 + hash2(i, 2.9) * 1.6,
            size: 2.2 + hash2(i, 8.3) * 1.8,
          });
        }
        preset.ripples = [];
      };

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

      // ---- 街灯ブロック: ランプ + 光錐 + 蛾(グレースケール → ディザ) ----
      const drawLamp = () => {
        const g = pg, t = preset._time;
        const W = g.width, H = g.height;
        g.background(0);
        g.noStroke();
        const cx = W * 0.5;
        const headY = H * 0.14;
        const groundY = H * 0.96;
        // フリッカー: たまに一瞬消える + beat で明るく
        if (t > preset._nextFlicker) {
          preset._flickerUntil = t + 0.05 + hash2(Math.floor(t * 7), 3.1) * 0.08;
          preset._nextFlicker = t + 2.5 + hash2(Math.floor(t), 6.7) * 4;
        }
        const off = t < preset._flickerUntil;
        const glow = off ? 0.12 : 0.75 + preset.beatPulse * 0.25 + preset.audio.bass * 0.15;
        // 光錐(下向き台形、うっすら)
        g.fill(68 * glow);
        g.triangle(cx - W * 0.05, headY, cx + W * 0.05, headY, cx + W * 0.30, groundY);
        g.triangle(cx - W * 0.05, headY, cx - W * 0.30, groundY, cx + W * 0.30, groundY);
        // 地面(光だまりの楕円)
        g.fill(135 * glow);
        g.ellipse(cx, groundY, W * 0.64, H * 0.05);
        // 柱と灯具
        g.fill(175);
        g.rect(cx - W * 0.025, headY, W * 0.05, groundY - headY);
        g.rect(cx - W * 0.13, headY - H * 0.014, W * 0.26, H * 0.014); // 腕
        g.fill(215);
        g.rect(cx - W * 0.08, headY - H * 0.05, W * 0.16, H * 0.042); // 笠
        // 電球(グロー同心円)
        for (let r = 5; r >= 1; r--) {
          g.fill((110 + (5 - r) * 36) * glow);
          g.circle(cx, headY + H * 0.005, W * 0.05 * r * 0.72);
        }
        // 蛾: ランプ周りを不規則に旋回(treble でジッタ)
        for (let i = 0; i < preset.moths.length; i++) {
          const m = preset.moths[i];
          m.a += (m.speed + preset.audio.treble * 2.5) * 0.03;
          const wob = Math.sin(t * 5 + i * 2.2) * 3;
          const mx = cx + Math.cos(m.a) * (m.r + wob) + Math.sin(t * 2.3 + i) * 2;
          const my = headY + H * 0.01 + Math.sin(m.a * 1.7) * (m.r * 0.55 + wob * 0.5);
          const flap = Math.sin(t * 22 + i * 3) * m.size;
          const bri = off ? 90 : 245;
          g.fill(bri);
          g.triangle(mx, my, mx - m.size * 1.6, my - flap, mx - m.size * 0.4, my + m.size * 0.8);
          g.triangle(mx, my, mx + m.size * 1.6, my - flap, mx + m.size * 0.4, my + m.size * 0.8);
        }
        const glitch = Math.min(1, preset.beatPulse * 0.9 + preset.audio.bass * 0.4);
        const n = W * H;
        if (!preset._gray || preset._gray.length !== n) preset._gray = new Float32Array(n);
        ditherTo(g, preset._gray, GREEN, AMBER, glitch);
        p.noStroke();
        p.fill(20, 14, 6); // 焦げ茶の下地
        p.rect(L.lamp.x, L.lamp.y, L.lamp.w, L.lamp.h);
        p.image(pg, L.lamp.x, L.lamp.y, L.lamp.w, L.lamp.h);
      };

      // ---- 雨(ブロックの背後に薄く) ----
      const drawRain = () => {
        const W = p.width, H = p.height;
        const n = 60 + preset.audio.treble * 100;
        p.noStroke();
        for (let i = 0; i < n; i++) {
          const seed = i * 13.7;
          const speed = 300 + hash2(i, 2.2) * 250;
          const x = hash2(i, 8.8) * W + Math.sin(preset._time * 0.5) * 10;
          const y = fract((preset._time * speed) / H + hash2(i, 5.5)) * H;
          if (y > L.groundY) continue;
          p.fill(90, 120, 90, 90);
          p.rect(x % W, y, 1.5, 8 + hash2(i, 3.9) * 8);
        }
      };

      // ---- 地面の波紋(beat で発生、ピクセル楕円リング) ----
      const drawRipples = () => {
        if (preset._wantRipple) {
          preset.ripples.push({
            x: hash2(preset._msgIdx + 7, Math.floor(preset._time * 5)) * p.width,
            born: preset._time,
          });
          if (preset.ripples.length > 6) preset.ripples.shift();
          preset._wantRipple = false;
        }
        p.noFill();
        for (const r of preset.ripples) {
          const age = preset._time - r.born;
          if (age > 1.6) continue;
          const rad = age * p.width * 0.06;
          const a = (1 - age / 1.6) * 190;
          p.stroke(AMBER[0], AMBER[1], AMBER[2], a);
          p.strokeWeight(2);
          p.ellipse(r.x, L.groundY + p.height * 0.04, rad * 2, rad * 0.5);
        }
        p.noStroke();
        // 地面ライン(緑の点線)
        p.fill(GREEN[0], GREEN[1], GREEN[2], 160);
        for (let x = 0; x < p.width; x += 8) {
          if (hash2(x, 1.1) < 0.7) p.rect(x, L.groundY + p.height * 0.04, 4, 2);
        }
      };

      // ---- アンバーノイズ矩形 / 白破損データ片 ----
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
            if (h < dens * 0.7) p.fill(AMBER[0], AMBER[1], AMBER[2]);
            else if (h < dens) p.fill(DARKAMBER[0], DARKAMBER[1], DARKAMBER[2]);
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

      // ---- デバッグパネル(シリーズ署名、03 は深緑地) ----
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
        p.fill(14, 88, 40, 235);
        p.rect(b.x, b.y, b.w, h);
        p.fill(240);
        p.textSize(fs);
        p.textAlign(p.LEFT, p.TOP);
        for (let i = 0; i < rows.length; i++) {
          p.text(`${rows[i][0]} : ${rows[i][1].toFixed(7)}`, b.x + fs * 0.7, b.y + fs * 0.5 + i * lh);
        }
      };

      // ---- 偽ダイアログ(03 は Alert / アンバー系) ----
      const spawnWindow = () => {
        const slot = preset._msgIdx % 4;
        const j = hash2(preset._msgIdx + 1, 3.7);
        preset.windows.push({
          x: L.win.x + slot * p.width * 0.032 + (j - 0.5) * p.width * 0.03,
          y: L.win.y + slot * p.height * 0.065,
          msg: ALERT_MSGS[preset._msgIdx % ALERT_MSGS.length],
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
          const w = Math.max(L.win.w, p.textWidth(win.msg) + fs * 4.5);
          const isTop = i === preset.windows.length - 1;
          const depth = (i + 1) / preset.windows.length;
          const appear = Math.min(1, (preset._time - win.born) * 8);
          const a = 255 * (0.35 + 0.65 * depth) * appear;
          let col = isTop ? AMBER : [110, 150, 90];
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
          p.text('Alert', win.x + fs * 0.7, win.y + bar * 0.52);
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
          p.fill(GREEN[0], GREEN[1], GREEN[2], a);
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

        drawRain();
        drawRipples();
        drawLamp();
        drawNoiseBlock();
        drawStrips();
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
window.VJamFX.presets['corrupted-archive-03'] = CorruptedArchive03Preset;
})();
