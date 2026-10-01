(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// desktop-meltdown — 偽レトロOSデスクトップ。
// アイコン / System Monitor(実信号を CPU/MEM/NET に偽装) / 偽ターミナル /
// beat で増殖する Error ダイアログ / タスクバー(ライブ BPM) / 自走カーソル。
// 強拍でごく短い BSOD フラッシュ。

const GRAY = [185, 185, 190];
const DESK = [6, 42, 42];
const TITLE_ACTIVE = [24, 36, 165];
const TITLE_IDLE = [90, 95, 110];
const TERM_GREEN = [80, 230, 110];

const ERROR_MSGS = [
  'You have reached the limit.',
  'SIGNAL LOST: deck B',
  'BUFFER OVERRUN AT 0xBEEF',
  'MEMORY PARITY ERROR',
  'beat_clk.dll not found',
  'DECODE FAILED: frame 0x00FF',
  'Track has stopped responding.',
  'GENERAL PROTECTION FAULT',
];

const TERM_CMDS = [
  '> scan /dev/audio ... OK',
  '> mount deck_a',
  '> beat_clk sync',
  '> decode frame 0x00FF',
  '> WARN: buffer underrun',
  '> render pass 2/2 done',
  '> ping projector ... 2ms',
  '> alloc 4096 @ 0x7FFF',
  '> flush /tmp/vj_cache',
  '> vu meter calibrate',
  '> ERR: archive corrupted',
  '> retry sector 7 ... OK',
];

const fract = (v) => v - Math.floor(v);
const hash2 = (a, b) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

class DesktopMeltdownPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, bpm: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this.dialogs = [];
    this._lastSpawn = 0;
    this._msgIdx = 0;
    this._wantDialog = false;
    this._strongBeat = false;
    this._bsodUntil = -1;
    this._lastBsod = -10;
    this._selIcon = 0;
    this._termLines = ['> boot vjam-os v2.6'];
    this._termNext = 0;
    this._termIdx = 0;
    this._rmsHist = [];
    this._cursor = { x: 0, y: 0, tx: 0, ty: 0, next: 0 };
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
    this._wantDialog = true;
    if ((s || 0) > 0.85) this._strongBeat = true;
    this._selIcon = (this._selIcon + 1) % 4;
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      let L = null;

      const layout = () => {
        const W = p.width, H = p.height;
        const fs = Math.max(10, Math.floor(H * 0.019));
        const bar = Math.floor(fs * 2.2);
        L = {
          fs,
          titleH: Math.floor(fs * 1.5),
          taskH: bar,
          taskY: H - bar,
          icons: [
            { x: W * 0.035, y: H * 0.05, label: 'archive_01', kind: 'folder' },
            { x: W * 0.035, y: H * 0.21, label: 'bass.wav', kind: 'file' },
            { x: W * 0.035, y: H * 0.37, label: 'C: deck', kind: 'drive' },
            { x: W * 0.035, y: H * 0.53, label: 'trash', kind: 'trash' },
          ],
          iconSize: Math.max(24, Math.floor(H * 0.055)),
          term: { x: W * 0.14, y: H * 0.47, w: W * 0.33, h: H * 0.36 },
          mon: { x: W * 0.60, y: H * 0.08, w: W * 0.30, h: H * 0.42 },
          dlg: { x: W * 0.28, y: H * 0.12, w: Math.min(W * 0.26, 400), h: Math.max(84, H * 0.15) },
        };
        preset._cursor.x = W * 0.5;
        preset._cursor.y = H * 0.5;
      };

      // 立体ベベル(raised=false で凹み)
      const bevel = (x, y, w, h, raised, col) => {
        const c = col || GRAY;
        p.noStroke();
        p.fill(c[0], c[1], c[2]);
        p.rect(x, y, w, h);
        const hi = raised ? 240 : 55, lo = raised ? 55 : 240;
        p.fill(hi, hi, hi);
        p.rect(x, y, w, 2);
        p.rect(x, y, 2, h);
        p.fill(lo, lo, lo);
        p.rect(x, y + h - 2, w, 2);
        p.rect(x + w - 2, y, 2, h);
      };

      // ウィンドウ枠を描いてコンテンツ領域を返す
      const windowFrame = (x, y, w, h, title, active) => {
        bevel(x, y, w, h, true);
        const tb = L.titleH;
        const tc = active ? TITLE_ACTIVE : TITLE_IDLE;
        p.noStroke();
        p.fill(tc[0], tc[1], tc[2]);
        p.rect(x + 3, y + 3, w - 6, tb);
        p.fill(255);
        p.textSize(L.fs);
        p.textAlign(p.LEFT, p.CENTER);
        p.text(title, x + L.fs * 0.6, y + 3 + tb / 2);
        // _ □ x ボタン
        const bs = tb - 6;
        for (let i = 0; i < 3; i++) {
          const bx = x + w - 6 - (3 - i) * (bs + 2);
          bevel(bx, y + 6, bs, bs, true);
          p.fill(30);
          p.textAlign(p.CENTER, p.CENTER);
          p.text(['_', 'o', 'x'][i], bx + bs / 2, y + 6 + bs / 2);
        }
        return { cx: x + 4, cy: y + 3 + tb + 3, cw: w - 8, ch: h - tb - 10 };
      };

      const drawIcons = () => {
        const s = L.iconSize;
        p.textSize(L.fs);
        for (let i = 0; i < L.icons.length; i++) {
          const ic = L.icons[i];
          const sel = i === preset._selIcon;
          const jig = ic.kind === 'trash' ? Math.sin(preset._time * 30) * preset.audio.bass * 3 : 0;
          const x = ic.x + jig, y = ic.y;
          p.noStroke();
          if (ic.kind === 'folder') {
            p.fill(200, 170, 90);
            p.rect(x, y + s * 0.2, s, s * 0.7);
            p.rect(x, y + s * 0.08, s * 0.45, s * 0.2);
            p.fill(230, 205, 130);
            p.rect(x + 2, y + s * 0.28, s - 4, s * 0.15);
          } else if (ic.kind === 'file') {
            p.fill(235);
            p.rect(x + s * 0.12, y, s * 0.76, s * 0.9);
            p.fill(150);
            for (let l = 0; l < 4; l++) p.rect(x + s * 0.22, y + s * (0.18 + l * 0.16), s * 0.5, 2);
          } else if (ic.kind === 'drive') {
            p.fill(170);
            p.rect(x, y + s * 0.25, s, s * 0.45);
            const led = preset.beatPulse > 0.25 ? [90, 255, 110] : [30, 110, 45];
            p.fill(led[0], led[1], led[2]);
            p.rect(x + s * 0.78, y + s * 0.52, s * 0.1, s * 0.1);
          } else {
            p.fill(160);
            p.quad(x + s * 0.2, y + s * 0.25, x + s * 0.8, y + s * 0.25, x + s * 0.7, y + s * 0.9, x + s * 0.3, y + s * 0.9);
            p.rect(x + s * 0.15, y + s * 0.15, s * 0.7, s * 0.08);
          }
          // ラベル(選択中は青地)
          p.textAlign(p.CENTER, p.TOP);
          if (sel) {
            const tw = p.textWidth(ic.label) + 6;
            p.fill(TITLE_ACTIVE[0], TITLE_ACTIVE[1], TITLE_ACTIVE[2]);
            p.rect(x + s / 2 - tw / 2, y + s + 3, tw, L.fs + 4);
          }
          p.fill(235);
          p.text(ic.label, x + s / 2, y + s + 5);
        }
      };

      const drawTerminal = () => {
        const t = L.term;
        const c = windowFrame(t.x, t.y, t.w, t.h, 'term.exe', false);
        p.noStroke();
        p.fill(8, 14, 10);
        p.rect(c.cx, c.cy, c.cw, c.ch);
        // treble が強いほど速くスクロール
        if (preset._time > preset._termNext) {
          preset._termLines.push(TERM_CMDS[preset._termIdx % TERM_CMDS.length]);
          preset._termIdx++;
          const maxLines = Math.floor((c.ch - 8) / (L.fs * 1.25)) - 1;
          while (preset._termLines.length > maxLines) preset._termLines.shift();
          preset._termNext = preset._time + 0.9 - Math.min(0.75, preset.audio.treble * 0.9);
        }
        p.fill(TERM_GREEN[0], TERM_GREEN[1], TERM_GREEN[2]);
        p.textSize(L.fs);
        p.textAlign(p.LEFT, p.TOP);
        for (let i = 0; i < preset._termLines.length; i++) {
          p.text(preset._termLines[i], c.cx + 6, c.cy + 4 + i * L.fs * 1.25);
        }
        // カーソル明滅
        if (Math.floor(preset._time * 2.5) % 2 === 0) {
          p.rect(c.cx + 6, c.cy + 4 + preset._termLines.length * L.fs * 1.25, L.fs * 0.55, L.fs);
        }
      };

      const drawMonitor = () => {
        const m = L.mon;
        const c = windowFrame(m.x, m.y, m.w, m.h, 'System Monitor', true);
        const rows = [
          ['CPU', preset.audio.bass, [90, 230, 110]],
          ['MEM', preset.audio.mid, [230, 200, 80]],
          ['NET', preset.audio.treble, [90, 180, 240]],
        ];
        const rh = L.fs * 1.9;
        p.textSize(L.fs);
        for (let i = 0; i < rows.length; i++) {
          const [label, vRaw, col] = rows[i];
          const v = Math.min(1, vRaw + Math.sin(preset._time * 1.7 + i * 2) * 0.03 + 0.03);
          const y = c.cy + 8 + i * rh;
          p.fill(40);
          p.textAlign(p.LEFT, p.CENTER);
          p.text(label, c.cx + 8, y + rh * 0.35);
          const bx = c.cx + L.fs * 3.2, bw = c.cw - L.fs * 7, bh = L.fs;
          bevel(bx, y, bw, bh, false, [140, 140, 145]);
          // セグメント LED
          const segW = Math.max(4, Math.floor(bw / 24));
          const nSeg = Math.floor((bw - 6) / (segW + 2));
          const lit = Math.round(v * nSeg);
          for (let s2 = 0; s2 < lit; s2++) {
            p.fill(col[0], col[1], col[2]);
            p.rect(bx + 3 + s2 * (segW + 2), y + 3, segW, bh - 6);
          }
          p.fill(40);
          p.textAlign(p.RIGHT, p.CENTER);
          p.text(`${Math.round(v * 100)}%`, c.cx + c.cw - 8, y + rh * 0.35);
        }
        // rms 履歴グラフ
        preset._rmsHist.push(preset.audio.rms);
        if (preset._rmsHist.length > 120) preset._rmsHist.shift();
        const gy = c.cy + 8 + rows.length * rh + 4;
        const gh = c.cy + c.ch - gy - 6;
        if (gh > L.fs) {
          bevel(c.cx + 6, gy, c.cw - 12, gh, false, [20, 28, 24]);
          p.stroke(TERM_GREEN[0], TERM_GREEN[1], TERM_GREEN[2]);
          p.strokeWeight(1.5);
          p.noFill();
          p.beginShape();
          const n = preset._rmsHist.length;
          for (let i = 0; i < n; i++) {
            const gx = c.cx + 8 + ((c.cw - 16) * i) / 119;
            p.vertex(gx, gy + gh - 4 - preset._rmsHist[i] * (gh - 8));
          }
          p.endShape();
          p.noStroke();
        }
      };

      const spawnDialog = () => {
        const slot = preset._msgIdx % 6;
        const j = hash2(preset._msgIdx + 1, 5.3);
        preset.dialogs.push({
          x: L.dlg.x + slot * p.width * 0.045 + (j - 0.5) * p.width * 0.03,
          y: L.dlg.y + slot * p.height * 0.075,
          msg: ERROR_MSGS[preset._msgIdx % ERROR_MSGS.length],
          born: preset._time,
        });
        preset._msgIdx++;
        if (preset.dialogs.length > 6) preset.dialogs.shift();
        preset._lastSpawn = preset._time;
      };

      const drawDialogs = () => {
        const h = L.dlg.h;
        const life = 6;
        preset.dialogs = preset.dialogs.filter((d) => preset._time - d.born < life);
        p.textSize(L.fs);
        for (let i = 0; i < preset.dialogs.length; i++) {
          const d = preset.dialogs[i];
          const isTop = i === preset.dialogs.length - 1;
          const w = Math.max(L.dlg.w, p.textWidth(d.msg) + L.fs * 4.5); // 長文はみ出し防止
          bevel(d.x, d.y, w, h, true);
          const tb = L.titleH;
          const tc = isTop ? [165, 30, 30] : TITLE_IDLE;
          p.noStroke();
          p.fill(tc[0], tc[1], tc[2]);
          p.rect(d.x + 3, d.y + 3, w - 6, tb);
          p.fill(255);
          p.textSize(L.fs);
          p.textAlign(p.LEFT, p.CENTER);
          p.text('Error', d.x + L.fs * 0.6, d.y + 3 + tb / 2);
          p.textAlign(p.CENTER, p.CENTER);
          p.text('x', d.x + w - 3 - tb * 0.55, d.y + 3 + tb / 2);
          // 赤丸 x + メッセージ
          const cy = d.y + tb + (h - tb) * 0.38;
          p.fill(195, 40, 40);
          p.circle(d.x + L.fs * 1.8, cy, L.fs * 1.7);
          p.fill(255);
          p.text('x', d.x + L.fs * 1.8, cy);
          p.fill(25);
          p.textAlign(p.LEFT, p.CENTER);
          p.text(d.msg, d.x + L.fs * 3.2, cy);
          // OK ボタン(最前面は beat でフラッシュ)
          const bw = L.fs * 5, bh = L.fs * 1.6;
          const bx = d.x + (w - bw) / 2, by = d.y + h - bh - L.fs * 0.5;
          bevel(bx, by, bw, bh, !(isTop && preset.beatPulse > 0.4));
          p.fill(25);
          p.textAlign(p.CENTER, p.CENTER);
          p.text('OK', bx + bw / 2, by + bh / 2);
        }
      };

      const drawTaskbar = () => {
        const y = L.taskY, W = p.width;
        bevel(0, y, W, L.taskH, true);
        // スタートボタン
        const sw = L.fs * 5;
        bevel(4, y + 4, sw, L.taskH - 8, true);
        p.fill(25);
        p.textSize(L.fs);
        p.textAlign(p.CENTER, p.CENTER);
        p.text('* VJAM', 4 + sw / 2, y + L.taskH / 2);
        // タスクボタン(開いてるダイアログ分)
        let tx = sw + 12;
        const tw = L.fs * 6;
        const tasks = ['term.exe', 'monitor'].concat(preset.dialogs.map(() => 'Error'));
        for (const label of tasks) {
          if (tx + tw > W - L.fs * 8) break;
          bevel(tx, y + 4, tw, L.taskH - 8, label !== 'Error');
          p.fill(label === 'Error' ? [140, 25, 25] : [25, 25, 25]);
          p.textAlign(p.LEFT, p.CENTER);
          p.text(label, tx + 6, y + L.taskH / 2);
          tx += tw + 4;
        }
        // トレイ: ライブ BPM
        const trw = L.fs * 7;
        bevel(W - trw - 4, y + 4, trw, L.taskH - 8, false);
        p.fill(25);
        p.textAlign(p.CENTER, p.CENTER);
        let tray;
        if (preset.audio.bpm > 0) {
          tray = `${Math.round(preset.audio.bpm)} BPM`;
        } else {
          const sec = Math.floor(preset._time);
          tray = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
        }
        p.text(tray, W - trw / 2 - 4, y + L.taskH / 2);
      };

      const drawCursor = () => {
        const c = preset._cursor;
        // 2〜4 秒ごとに次の目的地(アイコン / 最前面 OK / モニタ)へ
        if (preset._time > c.next) {
          const spots = L.icons.map((ic) => [ic.x + L.iconSize / 2, ic.y + L.iconSize / 2]);
          spots.push([L.mon.x + L.mon.w * 0.5, L.mon.y + L.titleH * 0.5 + 3]);
          if (preset.dialogs.length) {
            const d = preset.dialogs[preset.dialogs.length - 1];
            spots.push([d.x + L.dlg.w / 2, d.y + L.dlg.h - L.fs * 1.3]);
            spots.push([d.x + L.dlg.w / 2, d.y + L.dlg.h - L.fs * 1.3]); // ダイアログ優先で重み付け
          }
          const pick = spots[Math.floor(hash2(preset._msgIdx + 3, Math.floor(preset._time)) * spots.length) % spots.length];
          c.tx = pick[0];
          c.ty = pick[1];
          c.next = preset._time + 2 + hash2(Math.floor(preset._time), 9) * 2;
        }
        const ease = 0.05 + preset.audio.rms * 0.08;
        c.x += (c.tx - c.x) * ease;
        c.y += (c.ty - c.y) * ease;
        // beat クリックの波紋
        if (preset.beatPulse > 0.3) {
          const r = (1 - preset.beatPulse) * L.fs * 2.5;
          p.noFill();
          p.stroke(255, preset.beatPulse * 200);
          p.strokeWeight(2);
          p.rect(c.x - r / 2, c.y - r / 2, r, r);
          p.noStroke();
        }
        const s = Math.max(1.1, p.height / 700);
        p.push();
        p.translate(c.x, c.y);
        p.scale(s);
        p.fill(255);
        p.stroke(0);
        p.strokeWeight(1);
        p.beginShape();
        p.vertex(0, 0);
        p.vertex(0, 14);
        p.vertex(3.5, 10.5);
        p.vertex(6, 15);
        p.vertex(8, 14);
        p.vertex(5.5, 9.5);
        p.vertex(10, 9);
        p.endShape(p.CLOSE);
        p.pop();
        p.noStroke();
      };

      const drawBsod = () => {
        if (preset._time > preset._bsodUntil) return;
        p.noStroke();
        p.fill(12, 12, 175, 235);
        p.rect(0, 0, p.width, p.height);
        p.fill(240);
        p.textSize(L.fs * 1.2);
        p.textAlign(p.CENTER, p.CENTER);
        const cy = p.height * 0.30;
        const lh = L.fs * 2;
        // タイトル(白地に青文字の反転バー)
        p.fill(200, 200, 210);
        const tw = L.fs * 8;
        p.rect(p.width / 2 - tw / 2, cy - lh * 0.7, tw, lh * 1.2);
        p.fill(12, 12, 175);
        p.text('VJAM OS', p.width / 2, cy);
        p.fill(240);
        p.text('A fatal exception 0E has occurred at 0028:C0011E36.', p.width / 2, cy + lh * 2);
        p.text('The current beat will be terminated.', p.width / 2, cy + lh * 3);
        p.text('* Press any key to drop the bass', p.width / 2, cy + lh * 5);
        p.text('* Press CTRL+ALT+DEL again to restart the set', p.width / 2, cy + lh * 6);
        if (Math.floor(preset._time * 2.5) % 2 === 0) {
          p.text('Press any key to continue _', p.width / 2, cy + lh * 8);
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

        // デスクトップ地(暗ティール)+ rms スペックル
        p.noStroke();
        p.fill(DESK[0], DESK[1], DESK[2]);
        p.rect(0, 0, p.width, p.height);
        const nSpeck = 10 + preset.audio.rms * 60;
        for (let i = 0; i < nSpeck; i++) {
          p.fill(120, 180, 180, 40);
          p.rect(Math.random() * p.width, Math.random() * p.height, 2, 2);
        }

        // 壁紙ロゴ(右下、薄く)
        p.fill(28, 82, 82);
        p.textSize(L.fs * 2.6);
        p.textAlign(p.RIGHT, p.BOTTOM);
        p.text('VJAM OS 2.6', p.width - L.fs * 1.5, L.taskY - L.fs * 0.8);

        drawIcons();
        drawTerminal();
        drawMonitor();

        // ダイアログ: beat で出現(0.4s スロットル)、無音時も 3.5s ごとに自走
        if (preset._wantDialog && preset._time - preset._lastSpawn > 0.4) spawnDialog();
        preset._wantDialog = false;
        if (preset._time - preset._lastSpawn > 3.5) spawnDialog();
        drawDialogs();

        drawTaskbar();
        drawCursor();

        // BSOD: 強拍で 1 秒表示(5s クールダウン)
        if (preset._strongBeat && preset._time - preset._lastBsod > 5) {
          preset._bsodUntil = preset._time + 1.0;
          preset._lastBsod = preset._time;
        }
        preset._strongBeat = false;
        drawBsod();
      };
    }, container);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['desktop-meltdown'] = DesktopMeltdownPreset;
})();
