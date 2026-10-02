(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// hanabi-dusk — 夕暮れの丘の向こうから上がる打ち上げ花火。
// 打ち上げは自律で先行し、beat の瞬間に頂点付近の玉が開花する(玉が無ければ即席開花)。
// 強拍=冠菊の大玉+全画面閃光(丘と電線が照る)+衝撃波の微シェイク /
// bass=残光の尾が消えにくくなる+空の照り返し / mid=打ち上げ頻度 /
// treble=消え際の火の粉の瞬き / rms=空全体の明るさ。
// 技術: 半解像度の加算グローバッファ(destination-out で残光を侵食)、
// 球殻爆発の2D投影(v·√(1-u²) 分布で縁が濃い本物の菊の見え方)。

const PALETTES = [
  { name: 'gold', c: [255, 196, 110] },
  { name: 'crimson', c: [255, 96, 100] },
  { name: 'emerald', c: [116, 235, 152] },
  { name: 'blue', c: [130, 175, 255] },
  { name: 'pink', c: [255, 152, 198] },
  { name: 'white', c: [255, 240, 214] },
];
const MAX_STARS = 3200;
const MAX_SHELLS = 6;

class HanabiDuskPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this._smooth = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this._skyPhase = Math.random() * 100;
    this._shells = [];   // 打ち上げ中の玉
    this._stars = [];    // 開花後の星
    this._wantBurst = 0; // beat: 開花要求(strength)
    this._flash = 0;     // 開花の閃光 0..1
    this._shake = 0;     // 大玉の衝撃波
  }

  updateAudio(d) {
    this.audio.bass = d.bass || 0;
    this.audio.mid = d.mid || 0;
    this.audio.treble = d.treble || 0;
    this.audio.rms = d.rms || 0;
  }

  onBeat(s) {
    this.beatPulse = Math.min(1, s || 0.5);
    this._wantBurst = Math.max(this._wantBurst, s || 0.5);
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      let horizon = null;   // 地平線シルエット(1回だけ焼く)
      let gb = null;        // 半解像度の加算グローバッファ(花火の残光)
      let horizonY = 0;

      // ---- 地平線シルエット(丘 + 木立 + 電柱と電線) ----
      const bakeHorizon = () => {
        const W = p.width, H = p.height;
        horizonY = H * 0.82;
        if (horizon) horizon.remove();
        horizon = p.createGraphics(W, H);
        const g = horizon;
        g.pixelDensity(1);
        g.clear();
        g.noStroke();
        g.fill(34, 20, 46);
        g.beginShape();
        g.vertex(0, H);
        for (let x = 0; x <= W; x += W / 24) {
          g.vertex(x, horizonY - H * 0.02 - Math.abs(Math.sin(x * 0.004 + 2)) * H * 0.035);
        }
        g.vertex(W, H);
        g.endShape(g.CLOSE);
        g.fill(16, 9, 24);
        g.beginShape();
        g.vertex(0, H);
        for (let x = 0; x <= W; x += W / 60) {
          const tree = Math.random() < 0.3 ? Math.random() * H * 0.03 : 0;
          g.vertex(x, horizonY + Math.sin(x * 0.01) * H * 0.008 - tree);
        }
        g.vertex(W, H);
        g.endShape(g.CLOSE);
        g.stroke(16, 9, 24);
        for (const fx of [0.22, 0.55]) {
          const x0 = W * fx, topY = horizonY - H * 0.13;
          g.strokeWeight(Math.max(2, W * 0.004));
          g.line(x0, horizonY + H * 0.02, x0, topY);
          g.strokeWeight(Math.max(1.5, W * 0.0025));
          g.line(x0 - W * 0.018, topY + H * 0.012, x0 + W * 0.018, topY + H * 0.012);
        }
        g.strokeWeight(Math.max(1, H * 0.0015));
        g.noFill();
        const y1 = horizonY - H * 0.118;
        // 電線は画面の左端から右端まで(電柱で「終わる」電線は不自然)
        g.bezier(-W * 0.02, y1 - H * 0.012, W * 0.08, y1 + H * 0.028, W * 0.15, y1 + H * 0.032, W * 0.22, y1);
        g.bezier(W * 0.22, y1, W * 0.35, y1 + H * 0.035, W * 0.42, y1 + H * 0.035, W * 0.55, y1);
        g.bezier(W * 0.55, y1, W * 0.75, y1 + H * 0.045, W * 0.85, y1 + H * 0.03, W * 1.02, y1 - H * 0.01);
        g.noStroke();
      };

      const layout = () => {
        if (gb) gb.remove();
        gb = p.createGraphics(Math.max(160, Math.floor(p.width / 2)), Math.max(90, Math.floor(p.height / 2)));
        gb.pixelDensity(1);
        bakeHorizon();
      };

      // ---- 夕空(光の強弱を音に乗せる) ----
      const drawSky = () => {
        const W = p.width, H = p.height;
        const s = preset._smooth;
        const ph = preset._skyPhase + preset._time * 0.012;
        const warm = 0.5 + Math.sin(ph) * 0.5;
        // rms で全体、開花の閃光で一気に持ち上がる
        const lift = s.rms * 30 + preset._flash * 70 + preset.beatPulse * 8;
        const ctx = p.drawingContext;
        const grad = ctx.createLinearGradient(0, 0, 0, horizonY * 1.04);
        const c = (r, g2, b) => `rgb(${Math.round(Math.min(255, r))},${Math.round(Math.min(255, g2))},${Math.round(Math.min(255, b))})`;
        grad.addColorStop(0, c(24 + warm * 20 + lift * 0.5, 19 + warm * 11 + lift * 0.4, 58 + warm * 13 + lift * 0.5));
        grad.addColorStop(0.55, c(104 + warm * 38 + lift, 45 + warm * 20 + lift * 0.7, 56 + warm * 9 + lift * 0.5));
        grad.addColorStop(1, c(196 + warm * 24 + lift, 116 + warm * 25 + lift * 0.8, 52 + warm * 13));
        ctx.fillStyle = grad;
        ctx.fillRect(-W * 0.02, -H * 0.02, W * 1.04, H * 1.04);
        // 沈む太陽(bass で呼吸)
        const sunX = W * 0.62, sunY = horizonY - H * 0.045;
        const sunR = H * (0.05 + s.bass * 0.022 + preset._flash * 0.01);
        const reach = 3.8 + s.bass * 1.5;
        const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * reach);
        sun.addColorStop(0, `rgba(255,214,150,${0.8 + s.bass * 0.2})`);
        sun.addColorStop(0.18, `rgba(255,178,96,${0.42 + s.bass * 0.22})`);
        sun.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = sun;
        ctx.fillRect(sunX - sunR * reach, sunY - sunR * reach, sunR * reach * 2, sunR * reach * 2);
        // 地平線の残光帯(bass + 閃光で燃える)
        const bandH = H * 0.15;
        const band = ctx.createLinearGradient(0, horizonY - bandH, 0, horizonY + H * 0.02);
        band.addColorStop(0, 'rgba(255,170,80,0)');
        band.addColorStop(1, `rgba(255,176,88,${0.10 + s.bass * 0.24 + preset._flash * 0.30})`);
        ctx.fillStyle = band;
        ctx.fillRect(0, horizonY - bandH, W, bandH + H * 0.02);
      };

      // ---- 打ち上げ ----
      const launch = () => {
        if (preset._shells.length >= MAX_SHELLS) return;
        const W = p.width, H = p.height;
        const apexY = H * (0.16 + Math.random() * 0.28);
        const y0 = horizonY - p.height * 0.02;
        const g = H * 0.00030;                      // 重力(px/frame^2)
        const vy0 = -Math.sqrt(2 * g * (y0 - apexY)); // 頂点でちょうど失速する初速
        preset._shells.push({
          x: W * (0.14 + Math.random() * 0.72),
          y: y0,
          vx: (Math.random() - 0.5) * H * 0.0012,
          vy: vy0,
          g,
          wob: Math.random() * 10,
          pal: PALETTES[Math.floor(Math.random() * PALETTES.length)],
        });
      };

      // ---- 開花: 球殻の2D投影(縁が濃い) ----
      const burst = (x, y, strength, forceKamuro) => {
        const H = p.height;
        const s = preset._smooth;
        const big = forceKamuro || strength > 0.85;
        const size = big ? 1.0 : 0.35 + strength * 0.55;
        const kamuro = big;
        const pal = kamuro ? PALETTES[0] : PALETTES[Math.floor(Math.random() * PALETTES.length)];
        const pistil = !kamuro && Math.random() < 0.4;
        const pal2 = pistil ? PALETTES[Math.floor(Math.random() * PALETTES.length)] : null;
        const ring = !kamuro && Math.random() < 0.15;
        const n = Math.floor((kamuro ? 190 : 80) + size * 130);
        const v0 = H * (0.055 + size * 0.075) * 0.10;   // 初速(px/frame)
        const room = MAX_STARS - preset._stars.length;
        const count = Math.min(n, Math.max(0, room));
        for (let i = 0; i < count; i++) {
          const th = Math.random() * Math.PI * 2;
          // 球殻の投影: 奥行き成分 u を振ると、投影速度が縁に密集する(菊のリング)
          const u = ring ? 0 : Math.random() * 2 - 1;
          const vv = v0 * Math.sqrt(1 - u * u) * (0.92 + Math.random() * 0.16);
          const inner = pistil && Math.random() < 0.3;
          const cc = inner ? pal2.c : pal.c;
          preset._stars.push({
            x, y,
            vx: Math.cos(th) * vv * (inner ? 0.42 : 1),
            vy: Math.sin(th) * vv * (inner ? 0.42 : 1),
            life: 1,
            decay: (kamuro ? 0.24 : 0.42) * (0.85 + Math.random() * 0.5),
            r: cc[0], g: cc[1], b: cc[2],
            kamuro,
          });
        }
        preset._flash = Math.min(1, preset._flash + (kamuro ? 0.85 : 0.25 + size * 0.3));
        if (kamuro) preset._shake = 1;
      };

      // ---- 花火の更新 + グローバッファへの描画 ----
      const updateFireworks = (dt) => {
        const W = p.width, H = p.height;
        const s = preset._smooth;
        const f = dt * 60;
        const gctx = gb.drawingContext;

        // 残光の侵食(bass が深いほど尾が長く残る)
        gctx.setTransform(1, 0, 0, 1, 0, 0);
        gctx.globalCompositeOperation = 'destination-out';
        gctx.fillStyle = `rgba(0,0,0,${Math.max(0.05, 0.17 - s.bass * 0.10)})`;
        gctx.fillRect(0, 0, gb.width, gb.height);
        // 以降は加算合成 + フル解像度座標で描く(バッファは半解像度)
        gctx.globalCompositeOperation = 'lighter';
        gctx.setTransform(gb.width / W, 0, 0, gb.height / H, 0, 0);
        gctx.lineCap = 'round';

        // 自律打ち上げ(mid で頻度が上がる)
        if (Math.random() < dt * (0.5 + s.mid * 2.2)) launch();

        // beat: 頂点にいちばん近い玉を開花。無ければ即席で空中に開花
        if (preset._wantBurst > 0) {
          let best = -1, bestVy = -Infinity;
          for (let i = 0; i < preset._shells.length; i++) {
            const sh = preset._shells[i];
            if (sh.vy > bestVy && sh.y < horizonY - H * 0.25) { bestVy = sh.vy; best = i; }
          }
          if (best >= 0) {
            const sh = preset._shells.splice(best, 1)[0];
            burst(sh.x, sh.y, preset._wantBurst, preset._wantBurst > 0.85);
          } else {
            burst(W * (0.2 + Math.random() * 0.6), H * (0.18 + Math.random() * 0.24), preset._wantBurst, preset._wantBurst > 0.85);
          }
          preset._wantBurst = 0;
        }

        // 玉の上昇(彗星: 明るい頭 + 短い尾 + 火の粉)
        for (let i = preset._shells.length - 1; i >= 0; i--) {
          const sh = preset._shells[i];
          sh.wob += dt * 7;
          sh.vy += sh.g * f;
          sh.x += (sh.vx + Math.sin(sh.wob) * H * 0.0004) * f;
          sh.y += sh.vy * f;
          if (sh.vy >= -H * 0.0002) {
            // 頂点に達した(beat に拾われなかった玉は自然開花)
            preset._shells.splice(i, 1);
            burst(sh.x, sh.y, 0.45 + Math.random() * 0.25, false);
            continue;
          }
          gctx.strokeStyle = 'rgba(255,214,150,0.85)';
          gctx.lineWidth = H * 0.0032;
          gctx.beginPath();
          gctx.moveTo(sh.x - sh.vx * f * 3, sh.y - sh.vy * f * 3.2);
          gctx.lineTo(sh.x, sh.y);
          gctx.stroke();
          // 上昇中に散る火の粉
          if (Math.random() < f * 0.5 && preset._stars.length < MAX_STARS) {
            preset._stars.push({
              x: sh.x, y: sh.y,
              vx: (Math.random() - 0.5) * H * 0.0012,
              vy: Math.random() * H * 0.0006,
              life: 0.35, decay: 1.4,
              r: 255, g: 200, b: 130, kamuro: false,
            });
          }
        }

        // 星(開花後)の物理 + 描画
        const drag = 0.945;
        const grav = H * 0.000155;
        const flickerP = 0.30 + s.treble * 0.35;   // treble で消え際が瞬く
        for (let i = preset._stars.length - 1; i >= 0; i--) {
          const st = preset._stars[i];
          st.life -= st.decay * dt;
          if (st.life <= 0) { preset._stars.splice(i, 1); continue; }
          st.vx *= Math.pow(drag, f);
          st.vy = st.vy * Math.pow(drag, f) + grav * f * (st.kamuro ? 1.8 : 1);
          st.x += st.vx * f;
          st.y += st.vy * f;
          let a = Math.min(1, st.life * 1.6);
          if (st.life < 0.32) {
            // 消え際: 火の粉のストロボ
            a *= Math.random() < flickerP ? 1.25 : 0.12;
          }
          if (a < 0.02) continue;
          gctx.strokeStyle = `rgba(${st.r},${st.g},${st.b},${a.toFixed(3)})`;
          gctx.lineWidth = H * (st.kamuro ? 0.0042 : 0.0034);
          const k = st.kamuro ? 2.6 : 1.7;
          gctx.beginPath();
          gctx.moveTo(st.x - st.vx * f * k, st.y - st.vy * f * k);
          gctx.lineTo(st.x, st.y);
          gctx.stroke();
        }
        gctx.setTransform(1, 0, 0, 1, 0, 0);
      };

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        layout();
      };

      p.draw = () => {
        p.background(0);
        const dt = Math.min(0.05, (p.deltaTime || 16.7) / 1000);
        preset._time += dt;
        preset.beatPulse *= 0.9;
        preset._flash *= Math.pow(0.82, dt * 60);
        preset._shake *= Math.pow(0.86, dt * 60);
        for (const k of ['bass', 'mid', 'treble', 'rms']) {
          preset._smooth[k] += (preset.audio[k] - preset._smooth[k]) * 0.12;
        }

        const ctx = p.drawingContext;
        ctx.save();
        // 大玉の衝撃波(ごく小さく画面が揺れる)
        if (preset._shake > 0.02) {
          ctx.translate(
            (Math.random() - 0.5) * preset._shake * p.height * 0.010,
            (Math.random() - 0.5) * preset._shake * p.height * 0.007
          );
        }

        drawSky();
        updateFireworks(dt);
        // 花火(加算合成で空に乗せる) → その上に丘のシルエット
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(gb.elt, 0, 0, p.width, p.height);
        ctx.globalCompositeOperation = 'source-over';
        p.image(horizon, 0, 0);
        // 開花の閃光が丘と電線も照らす
        if (preset._flash > 0.02) {
          ctx.fillStyle = `rgba(255,222,180,${(preset._flash * 0.16).toFixed(3)})`;
          ctx.fillRect(-p.width * 0.02, -p.height * 0.02, p.width * 1.04, p.height * 1.04);
        }
        ctx.restore();
      };
    }, container);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['hanabi-dusk'] = HanabiDuskPreset;
})();
