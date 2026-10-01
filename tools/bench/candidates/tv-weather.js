(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// tv-weather — 偽TV放送シリーズ第1弾「深夜の天気予報」。
// 偽の天気図に実信号を気象データとして流す:
// bass=低気圧(等圧線が締まる・嵐が育つ) / mid=嵐の回転・雲 / treble=雨 /
// beat=落雷+アイコン切替 / 強拍=特別警報テロップ / rms=ティッカー速度。

const SEA = [10, 18, 48];
const LAND = [22, 64, 44];
const COAST = [90, 200, 180];
const GRIDC = [70, 130, 200];
const AMBER = [255, 190, 60];
const REDW = [210, 40, 40];

const TICKER =
  '◆ STRONG BASS ADVISORY UNTIL 04:00 ◆ EXPECT HEAVY DROPS IN ALL AREAS ◆ VISIBILITY: STROBE ◆ WIND: BPM GUSTS ◆ STAY ON THE FLOOR ◆ ';

const fract = (v) => v - Math.floor(v);
const hash2 = (a, b) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

class TvWeatherPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, bpm: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this._strongBeat = false;
    this._warnUntil = -10;
    this._lastWarn = -10;
    this._bolt = null;
    this._kick = 0;
    this.storm = null;
    this._iconSeed = 0;
    this._lastIconCycle = 0;
    this._tickerX = 0;
    this._smooth = { bass: 0, mid: 0, treble: 0, rms: 0 };
  }

  updateAudio(d) {
    this.audio.bass = d.bass || 0;
    this.audio.mid = d.mid || 0;
    this.audio.treble = d.treble || 0;
    this.audio.rms = d.rms || 0;
    this.audio.bpm = d.bpm || 0;
  }

  onBeat(s) {
    this.beatPulse = Math.min(1, s || 0.5);
    this._wantBolt = true;
    this._kick = Math.max(this._kick, Math.min(1, s || 0.5));
    if ((s || 0) > 0.85) this._strongBeat = true;
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      let L = null;

      const layout = () => {
        const W = p.width, H = p.height;
        const fs = Math.max(11, Math.floor(H * 0.024));
        L = {
          fs,
          topH: Math.floor(H * 0.075),
          tickerY: Math.floor(H * 0.92),
          panel: { x: W * 0.735, y: H * 0.13, w: W * 0.235 },
          spots: [
            { x: W * 0.16, y: H * 0.30 },
            { x: W * 0.38, y: H * 0.20 },
            { x: W * 0.55, y: H * 0.42 },
            { x: W * 0.22, y: H * 0.62 },
            { x: W * 0.48, y: H * 0.72 },
            { x: W * 0.64, y: H * 0.24 },
          ],
        };
        preset.storm = { x: W * 0.40, y: H * 0.45, vx: 0, vy: 0 };
      };

      // ノイズ輪郭の島
      const island = (cx, cy, r, seed, squish) => {
        p.beginShape();
        for (let a = 0; a < Math.PI * 2; a += 0.22) {
          const n = p.noise(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3 + seed);
          const rr = r * (0.55 + n * 0.7);
          p.vertex(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * squish);
        }
        p.endShape(p.CLOSE);
      };

      const drawMap = () => {
        const W = p.width, H = p.height;
        p.noStroke();
        p.fill(SEA[0], SEA[1], SEA[2]);
        p.rect(0, 0, W, H);
        // 経緯線
        p.stroke(GRIDC[0], GRIDC[1], GRIDC[2], 36);
        p.strokeWeight(1);
        for (let x = 0; x < W; x += W * 0.11) p.line(x, 0, x, H);
        for (let y = 0; y < H; y += H * 0.16) p.line(0, y, W, y);
        // 島(海岸線つき)
        p.stroke(COAST[0], COAST[1], COAST[2], 130);
        p.strokeWeight(1.5);
        p.fill(LAND[0], LAND[1], LAND[2]);
        island(W * 0.30, H * 0.42, W * 0.17, 3.7, 0.85);
        island(W * 0.58, H * 0.66, W * 0.10, 8.1, 0.7);
        island(W * 0.52, H * 0.18, W * 0.07, 12.9, 0.8);
        p.noStroke();
      };

      // 低気圧: 等圧線 + 渦マーク。bass で締まり、mid で回る
      const drawStorm = () => {
        const W = p.width, H = p.height;
        const t = preset._time;
        // 台風の進路物理: キックで突進 → 摩擦で減速 → 画面端でバウンド
        const st = preset.storm;
        const dt = (p.deltaTime || 16.7) / 1000;
        const heading = p.noise(t * 0.07) * Math.PI * 4; // 徘徊方位(無音時の這い用)
        if (preset._kick > 0) {
          // キックごとに黄金角で方向を回す(同方向連打で壁に張り付くのを防ぐ)
          preset._kickDir = (preset._kickDir || 0) + 2.4;
          const k = W * (0.12 + preset._kick * 0.35);
          st.vx += Math.cos(preset._kickDir) * k;
          st.vy += Math.sin(preset._kickDir) * k * 0.7;
          preset._kick = 0;
        }
        st.vx *= Math.pow(0.05, dt); // 摩擦(1秒で5%まで減衰)
        st.vy *= Math.pow(0.05, dt);
        st.x += (st.vx + Math.cos(heading) * W * 0.015) * dt; // 無音時も這う
        st.y += (st.vy + Math.sin(heading) * W * 0.012) * dt;
        const xMin = W * 0.14, xMax = W * 0.62, yMin = H * 0.20, yMax = H * 0.72;
        if (st.x < xMin) { st.x = xMin; st.vx = Math.abs(st.vx) * 0.6; }
        if (st.x > xMax) { st.x = xMax; st.vx = -Math.abs(st.vx) * 0.6; }
        if (st.y < yMin) { st.y = yMin; st.vy = Math.abs(st.vy) * 0.6; }
        if (st.y > yMax) { st.y = yMax; st.vy = -Math.abs(st.vy) * 0.6; }
        const sx = st.x, sy = st.y;
        const bass = preset._smooth.bass;
        const rings = 6;
        const gap = (W * 0.055) * (1.15 - bass * 0.55); // bass で等圧線が詰まる
        // 等圧線は波紋のように外へ放射し続ける(bass で噴出が加速)
        preset._radiate = (preset._radiate || 0) + (p.deltaTime || 16.7) / 1000 * (0.25 + preset.audio.bass * 2.2);
        const phase = fract(preset._radiate) * gap;
        p.noFill();
        for (let i = 0; i <= rings; i++) {
          const base = gap * i + phase;
          const alpha = 110 * (1 - base / (gap * (rings + 1)));
          if (alpha <= 4) continue;
          p.stroke(235, 235, 235, alpha);
          p.strokeWeight(1.4);
          p.beginShape();
          for (let a = 0; a < Math.PI * 2; a += 0.26) {
            const wob = p.noise(Math.cos(a) + i * 2.3, Math.sin(a) + t * 0.15) * gap * 0.8;
            const rr = base + wob;
            p.vertex(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr * 0.82);
          }
          p.endShape(p.CLOSE);
        }
        // 渦(2本腕の台風スパイラル: 長く巻いて先細り、mid で高速回転)
        const rot = t * (1.4 + preset._smooth.mid * 4.5);
        const steps = 22;
        for (let arm = 0; arm < 2; arm++) {
          let lx = 0, ly = 0;
          for (let s = 0; s <= steps; s++) {
            const f = s / steps;
            const a = rot + arm * Math.PI + f * 4.4;
            const rr = W * 0.06 * (0.22 + f * 1.45) * (0.9 + preset.audio.bass * 0.6); // 生 bass でドクドク脈打つ
            const x = sx + Math.cos(a) * rr;
            const y = sy + Math.sin(a) * rr * 0.82;
            if (s > 0) {
              p.stroke(255, 255, 255, 230 * (1 - f * 0.75));
              p.strokeWeight(3.2 * (1 - f * 0.65));
              p.line(lx, ly, x, y);
            }
            lx = x; ly = y;
          }
        }
        p.noStroke();
        // 中心マーク L + hPa 表示(bass で気圧が下がる)
        p.fill(REDW[0], REDW[1], REDW[2]);
        p.circle(sx, sy, L.fs * 1.5);
        p.fill(255);
        p.textSize(L.fs);
        p.textAlign(p.CENTER, p.CENTER);
        p.text('L', sx, sy);
        const hpa = Math.round(1000 - bass * 60);
        p.fill(255, 240);
        p.textSize(L.fs * 0.95);
        p.text(`${hpa}hPa`, sx, sy + L.fs * 1.6);
      };

      // 天気アイコン(beat で種類が巡回)
      const drawIcon = (x, y, kind, s) => {
        p.noStroke();
        if (kind === 0) { // 晴れ
          p.fill(AMBER[0], AMBER[1], AMBER[2]);
          p.circle(x, y, s);
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + preset._time * 0.5;
            p.rect(x + Math.cos(a) * s * 0.75 - 1.5, y + Math.sin(a) * s * 0.75 - 1.5, 3, 3);
          }
        } else if (kind === 1) { // 曇り
          p.fill(190, 195, 205);
          p.circle(x - s * 0.3, y, s * 0.7);
          p.circle(x + s * 0.25, y - s * 0.12, s * 0.8);
          p.circle(x + s * 0.5, y + s * 0.15, s * 0.55);
        } else if (kind === 2) { // 雨
          p.fill(160, 170, 185);
          p.circle(x - s * 0.25, y - s * 0.2, s * 0.65);
          p.circle(x + s * 0.3, y - s * 0.25, s * 0.7);
          p.fill(GRIDC[0], GRIDC[1] + 60, 230);
          for (let i = 0; i < 3; i++) {
            const dy = fract(preset._time * 1.8 + i * 0.33) * s * 0.8;
            p.rect(x - s * 0.3 + i * s * 0.3, y + s * 0.1 + dy, 2, s * 0.22);
          }
        } else { // 雷
          p.fill(150, 150, 165);
          p.circle(x - s * 0.2, y - s * 0.25, s * 0.65);
          p.circle(x + s * 0.3, y - s * 0.28, s * 0.6);
          p.fill(AMBER[0], AMBER[1], AMBER[2]);
          p.triangle(x - s * 0.05, y - s * 0.05, x + s * 0.22, y - s * 0.05, x - s * 0.12, y + s * 0.45);
          p.triangle(x + s * 0.16, y + s * 0.02, x - s * 0.06, y + s * 0.02, x + s * 0.2, y + s * 0.5);
        }
      };

      const drawIcons = () => {
        const s = Math.max(14, p.height * 0.045);
        for (let i = 0; i < L.spots.length; i++) {
          const sp = L.spots[i];
          const kind = Math.floor(hash2(i, preset._iconSeed) * 4);
          const bob = Math.sin(preset._time * 1.4 + i * 1.9) * 2.5;
          drawIcon(sp.x, sp.y + bob, kind, s);
        }
      };

      // 落雷(beat): 地図上にジグザグ
      const drawBolt = () => {
        if (preset._wantBolt) {
          const i = Math.floor(hash2(Math.floor(preset._time * 13), 4.4) * L.spots.length);
          preset._bolt = { x: L.spots[i].x, y: L.spots[i].y, born: preset._time };
          preset._wantBolt = false;
        }
        const b = preset._bolt;
        if (!b || preset._time - b.born > 0.14) return;
        p.stroke(255, 255, 230, 240);
        p.strokeWeight(2.5);
        let x = b.x, y = b.y - p.height * 0.16;
        p.noFill();
        p.beginShape();
        for (let s = 0; s < 6; s++) {
          p.vertex(x, y);
          x += (hash2(s, b.born) - 0.5) * p.width * 0.03;
          y += p.height * 0.03;
        }
        p.vertex(b.x, b.y);
        p.endShape();
        p.noStroke();
        p.fill(255, 255, 230, 90);
        p.circle(b.x, b.y, p.height * 0.05);
      };

      // 雨のオーバーレイ(treble、斜線ではっきり)
      const drawRain = () => {
        const n = preset.audio.treble * 200;
        p.stroke(150, 195, 240, 150);
        p.strokeWeight(1.5);
        for (let i = 0; i < n; i++) {
          const x = hash2(i, 7.7) * p.width;
          const y = fract(preset._time * (0.9 + hash2(i, 2.1) * 0.7) + hash2(i, 5.2)) * p.height;
          const len = 9 + hash2(i, 3.3) * 9;
          p.line(x, y, x - len * 0.35, y + len);
        }
        p.noStroke();
      };

      // 上部バー + 右パネル + ティッカー
      const drawChrome = () => {
        const W = p.width, H = p.height;
        const fs = L.fs;
        // 上部バー
        p.noStroke();
        p.fill(8, 10, 26, 235);
        p.rect(0, 0, W, L.topH);
        p.fill(255);
        p.textSize(fs * 1.25);
        p.textAlign(p.LEFT, p.CENTER);
        p.text('VJAM WEATHER', fs, L.topH / 2);
        // 深夜の時刻(コロン明滅)
        const colon = Math.floor(preset._time * 2) % 2 === 0 ? ':' : ' ';
        p.textAlign(p.RIGHT, p.CENTER);
        p.textSize(fs * 1.1);
        p.fill(AMBER[0], AMBER[1], AMBER[2]);
        p.text(`FRI 25${colon}00`, W - fs * 6, L.topH / 2);
        p.stroke(255, 160);
        p.strokeWeight(1.5);
        p.noFill();
        p.rect(W - fs * 4.8, L.topH * 0.22, fs * 3.6, L.topH * 0.56);
        p.noStroke();
        p.fill(255);
        p.textAlign(p.CENTER, p.CENTER);
        p.text('CH 5', W - fs * 3, L.topH / 2);
        // 右パネル: 実信号を気温として表示(シリーズの署名)
        const rows = [
          ['BASS CITY ', preset.audio.bass],
          ['MID TOWN  ', preset.audio.mid],
          ['TREBLE BAY', preset.audio.treble],
          ['RMS PORT  ', preset.audio.rms],
        ];
        const lh = fs * 1.75;
        const ph = lh * rows.length + fs * 1.6;
        const b = L.panel;
        p.fill(8, 10, 26, 215);
        p.rect(b.x, b.y, b.w, ph);
        p.fill(AMBER[0], AMBER[1], AMBER[2]);
        p.textSize(fs * 0.95);
        p.textAlign(p.LEFT, p.TOP);
        p.text('TONIGHT / 今夜', b.x + fs * 0.6, b.y + fs * 0.4);
        p.textSize(fs);
        for (let i = 0; i < rows.length; i++) {
          const y = b.y + fs * 1.6 + i * lh;
          p.fill(235);
          p.text(rows[i][0], b.x + fs * 0.6, y);
          const temp = Math.round(rows[i][1] * 40);
          p.fill(temp > 28 ? [255, 120, 90] : [140, 200, 255]);
          p.textAlign(p.RIGHT, p.TOP);
          p.text(`${temp}°`, b.x + b.w - fs * 0.6, y);
          p.textAlign(p.LEFT, p.TOP);
          p.fill(GRIDC[0], GRIDC[1], GRIDC[2], 180);
          p.rect(b.x + fs * 0.6, y + fs * 1.1, (b.w - fs * 1.2) * Math.min(1, rows[i][1]), 3);
        }
        // ティッカー
        p.fill(8, 10, 26, 240);
        p.rect(0, L.tickerY, W, H - L.tickerY);
        p.fill(AMBER[0], AMBER[1], AMBER[2]);
        p.textSize(fs * 1.05);
        p.textAlign(p.LEFT, p.CENTER);
        const tw = p.textWidth(TICKER);
        preset._tickerX -= 1.2 + preset._smooth.rms * 3.5;
        if (preset._tickerX < -tw) preset._tickerX += tw;
        const ty = L.tickerY + (H - L.tickerY) / 2;
        p.text(TICKER + TICKER, preset._tickerX, ty);
        // BPM(取れる時だけ左上バー下に)
        if (preset.audio.bpm > 0) {
          p.fill(235, 200);
          p.textSize(fs * 0.9);
          p.textAlign(p.LEFT, p.TOP);
          p.text(`WIND ${Math.round(preset.audio.bpm)} BPM`, fs, L.topH + fs * 0.4);
        }
      };

      // 特別警報(強拍でスライドイン)
      const drawWarning = () => {
        if (preset._strongBeat && preset._time - preset._lastWarn > 6) {
          preset._warnUntil = preset._time + 2.5;
          preset._lastWarn = preset._time;
        }
        preset._strongBeat = false;
        const remain = preset._warnUntil - preset._time;
        if (remain <= 0) return;
        // 警報中は画面全体が赤く明滅
        const rBlink = Math.floor(preset._time * 4) % 2 === 0;
        p.noStroke();
        p.fill(REDW[0], REDW[1], REDW[2], rBlink ? 34 : 14);
        p.rect(0, 0, p.width, p.height);
        const slide = Math.min(1, (2.5 - remain) * 6, remain * 6);
        const bh = L.fs * 2.4;
        const y = L.topH - bh + bh * slide;
        p.noStroke();
        p.fill(REDW[0], REDW[1], REDW[2], 245);
        p.rect(0, y, p.width, bh);
        p.fill(255);
        p.textSize(L.fs * 1.15);
        p.textAlign(p.CENTER, p.CENTER);
        const blink = Math.floor(preset._time * 4) % 2 === 0;
        const mark = blink ? '!!' : '  ';
        p.text(`${mark} SEVERE BASS WARNING - TAKE SHELTER ON THE DANCEFLOOR ${mark}`, p.width / 2, y + bh / 2);
      };

      // 走査線
      const drawScanlines = () => {
        p.noStroke();
        p.fill(0, 0, 0, 34);
        for (let y = 0; y < p.height; y += 4) p.rect(0, y, p.width, 1.5);
      };

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        p.textFont('monospace');
        layout();
      };

      p.draw = () => {
        p.background(0);
        preset._time += (p.deltaTime || 16.7) / 1000;
        preset.beatPulse *= 0.93;
        for (const k of ['bass', 'mid', 'treble', 'rms']) {
          preset._smooth[k] += (preset.audio[k] - preset._smooth[k]) * 0.12;
        }
        // beat でアイコン切替(無音時も 3s ごと)
        if (preset.beatPulse > 0.55 && preset._time - preset._lastIconCycle > 0.8) {
          preset._iconSeed++;
          preset._lastIconCycle = preset._time;
        }
        if (preset._time - preset._lastIconCycle > 3) {
          preset._iconSeed++;
          preset._lastIconCycle = preset._time;
        }

        // カメラパンチ: beat で地図だけズームパルス(放送UIは固定)
        p.push();
        p.translate(p.width / 2, p.height / 2);
        p.scale(1 + preset.beatPulse * 0.05);
        p.translate(-p.width / 2, -p.height / 2);
        drawMap();
        drawStorm();
        drawIcons();
        drawBolt();
        drawRain();
        p.pop();
        // beat の白フラッシュ(雷が画面全体を照らす)
        if (preset.beatPulse > 0.08) {
          p.noStroke();
          p.fill(255, 255, 240, preset.beatPulse * 42);
          p.rect(0, 0, p.width, p.height);
        }
        drawChrome();
        drawWarning();
        drawScanlines();
      };
    }, container);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['tv-weather'] = TvWeatherPreset;
})();
