(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * torii-gates — 千本鳥居。朱の鳥居が無限に続く夜の参道を歩き続ける。
 *
 * kathmandu-alley と同じ「空間の中を旅する」レイマーチ。
 * 朱塗りの鳥居 (柱 + 反りの笠木 + 島木 + 貫) が z 周期で無限反復、
 * 参道は蛇行と坂を繰り返す。朧月と手元の灯りだけが闇を照らす
 * (カメラ z は JS 側で wrap して精度を保つ)。
 * 鳥居は 1 基ごとに傾き・木目・朱の剥げが違う (古い参道の経年)。
 *
 * 音 → 映像:
 *   beat   → 金色の光の帯が参道の奥へ駆け抜ける + 歩みが加速
 *   bass   → 鳥居の間口が狭まる (朱が迫る) + 手元の灯りが燃え上がる
 *   treble → 朧月の暈の明滅
 *   rms    → 歩行速度 + 空気のグロー
 *
 * 技術:
 *   - DE = 柱 (内転びの円柱) + 笠木 (端が反る box) + 島木 + 貫 + 石畳
 *   - JS 側にも回廊 DE (保守版) を実装しカメラが柱を避ける (空間型の規律)
 *   - 光は琥珀系統に統一 (朧月 0.115 / 手元の灯り 0.085)、
 *     月光の藍は微弱アンビエントのみ。朱はアルベドなので加算で濁らない
 *   - 柱の墨書き (奉納文字風の縦列) はアルベドの縞ハッシュで擬装
 *   - フィルミックトーンマップ 1-exp(-col) で白飛びを構造的に排除
 */
class ToriiGatesPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this._shader = null;
    this._time = 0;
    this._z = 0;            // カメラ前進距離 (wrap する)
    this._offX = 0;         // 衝突回避の横オフセット
    this._offY = 0;
    this._pulses = [-1e5, -1e5, -1e5]; // 拍パルスの z 位置 (新しい順)
    this._widthPhase = 0;
    this.smoothBass = 0;
    this.smoothTreble = 0;
    this.kick = 0;
    this.beat = 0;
  }

  // shader と同じ参道の蛇行 (S 字カーブ。周期 40 + 20 の重ね = wrap 40 とシームレス)
  _bend(z) {
    return 1.3 * Math.sin(z * 0.15708) + 0.5 * Math.sin(z * 0.31415926 + 2.1);
  }

  // shader と同じ縦のうねり (参道の登り下り)
  _bendY(z) {
    return 0.50 * Math.sin(z * 0.15708 + 0.7) + 0.16 * Math.sin(z * 0.31415926 + 2.9);
  }

  // GPU と同じ回廊 DE の保守版 (柱の膨らみは無視 = 常に安全側) をカメラ衝突回避に使う
  _de(x, y, z, w) {
    const X = x - this._bend(z);
    const Y = y - this._bendY(z);
    return Math.min(w - Math.abs(X), Y - 0.05);
  }

  // 目標位置が柱・地面に近すぎたら勾配 (数値微分) 方向へ押し出す
  _avoidWalls(bx, by, z, w) {
    const R = 0.18;   // カメラの安全半径 (柱の内面 w-0.062 より内側に収める)
    let cx = bx + this._offX, cy = by + this._offY;
    for (let it = 0; it < 3; it++) {
      const d = this._de(cx, cy, z, w);
      if (d > R) break;
      const e = 0.01;
      const gx = this._de(cx + e, cy, z, w) - this._de(cx - e, cy, z, w);
      const gy = this._de(cx, cy + e, z, w) - this._de(cx, cy - e, z, w);
      const gl = Math.hypot(gx, gy) || 1;
      const push = (R - d) + 0.02;
      cx += (gx / gl) * push;
      cy += (gy / gl) * push;
    }
    this._offX = Math.max(-0.5, Math.min(0.5, this._offX + (cx - bx - this._offX) * 0.25));
    this._offY = Math.max(-0.5, Math.min(0.5, this._offY + (cy - by - this._offY) * 0.25));
    return [bx + this._offX, by + this._offY];
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      p.setup = () => {
        p.createCanvas(container.clientWidth || window.innerWidth,
                       container.clientHeight || window.innerHeight, p.WEBGL);
        p.pixelDensity(1); // レイマーチは画素数比例で重い。DPR 1 固定
      };

      p.draw = () => {
        if (!preset._shader) { preset._shader = preset._initShader(p); if (!preset._shader) return; }

        const dt = 0.016;
        preset._time += dt;
        preset._widthPhase += 0.004;
        preset.smoothBass += (preset.audio.bass - preset.smoothBass) * 0.1;
        preset.smoothTreble += (preset.audio.treble - preset.smoothTreble) * 0.3;
        preset.kick *= 0.90;   // 速めの減衰 = 拍ごとに「一歩踏み込む」歩感
        preset.beat *= 0.88;

        // 前進: 駆け足 + rms + 拍で一歩踏み込む (拍同期)。無音でも歩みは続く (自律)
        preset._z += dt * (1.15 + preset.audio.rms * 0.6 + preset.kick * 2.2);
        for (let i = 0; i < 3; i++) preset._pulses[i] += dt * 4.5;
        // 全パターンの周期は 40 の約数に揃えてあるので z を 40 で wrap (精度維持)
        if (preset._z > 40) {
          preset._z -= 40;
          for (let i = 0; i < 3; i++) preset._pulses[i] -= 40;
        }

        // 鳥居の間口半幅: ゆっくり呼吸 + bass で朱が迫る
        const w = 0.55 + Math.sin(preset._widthPhase) * 0.02 - preset.smoothBass * 0.08;

        // カメラ: 参道の蛇行軸を追従 + 歩行の上下動 → 柱を検知して避ける (CPU 側 DE)
        const t0 = preset._time;
        const zc = preset._z;
        const bx = preset._bend(zc) + Math.sin(t0 * 0.23) * 0.10;
        const by = 0.54 + preset._bendY(zc) + Math.sin(t0 * 1.8) * 0.015 + preset.kick * 0.03;
        const [cx, cy] = preset._avoidWalls(bx, by, zc, w);
        // 視線はカーブと坂の先を追う (= 曲がり込み・登り下りの体感)
        const tx = preset._bend(zc + 1.5) + Math.sin((t0 + 2.5) * 0.23) * 0.08 + preset._offX * 0.6;
        const ty = 0.60 + preset._bendY(zc + 1.5) + Math.sin(t0 * 0.11) * 0.05 + preset._offY * 0.6;
        // カーブの傾き → バンク (曲がりに体を傾ける)
        const bank = (preset._bend(zc + 1.2) - preset._bend(zc - 1.2)) / 2.4;

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_ro', [cx, cy, preset._z]);
          preset._shader.setUniform('u_ta', [tx, ty, preset._z + 1.5]);
          preset._shader.setUniform('u_width', w);
          preset._shader.setUniform('u_bass', preset.smoothBass);
          preset._shader.setUniform('u_treble', preset.smoothTreble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_beat', preset.beat);
          preset._shader.setUniform('u_bank', bank);
          preset._shader.setUniform('u_pulseZ', preset._pulses);
          p.noStroke();
          p.quad(-1, -1, 1, -1, 1, 1, -1, 1);
        } catch (e) { /* shader 失敗時は無視 */ } finally { p.resetShader(); }
      };

      p.windowResized = () =>
        p.resizeCanvas(container.clientWidth, container.clientHeight);
    }, container);
  }

  _initShader(p) {
    const vert = `
      attribute vec3 aPosition;
      void main() {
        vec4 pos = vec4(aPosition, 1.0);
        pos.xy = pos.xy * 2.0 - 1.0;
        gl_Position = pos;
      }
    `;
    const frag = `
      precision highp float;
      uniform vec2  u_resolution;
      uniform float u_time;
      uniform vec3  u_ro;
      uniform vec3  u_ta;
      uniform float u_width;
      uniform float u_bass;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;
      uniform float u_bank;
      uniform float u_pulseZ[3];

      float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453123); }
      float hash(vec3 q) { return fract(sin(dot(q, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }

      // value noise + fbm (汚し用: 漆の褪せ・雨だれ)
      float vnoise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i),                    hash(i + vec3(1., 0., 0.)), f.x),
              mix(hash(i + vec3(0., 1., 0.)), hash(i + vec3(1., 1., 0.)), f.x), f.y),
          mix(mix(hash(i + vec3(0., 0., 1.)), hash(i + vec3(1., 0., 1.)), f.x),
              mix(hash(i + vec3(0., 1., 1.)), hash(i + vec3(1., 1., 1.)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 3; i++) { v += a * vnoise(p); p *= 2.1; a *= 0.5; }
        return v;
      }

      // HSB → RGB (実証済みの発色)
      vec3 hsb(float h, float s, float b) {
        vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return b * mix(vec3(1.0), rgb, s);
      }

      float sdBox(vec3 p, vec3 b) {
        vec3 q = abs(p) - b;
        return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
      }

      float smax(float a, float b, float k) {
        float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) + k * h * (1.0 - h);
      }

      float g_mat;   // 0=朱 (柱・貫) 1=石畳 2=黒漆 (笠木・島木)

      // 参道の軸の蛇行 (周期 40 + 20 の重ね = wrap 40 とシームレス)
      float bendX(float z) {
        return 1.3 * sin(z * 0.15708) + 0.5 * sin(z * 0.31415926 + 2.1);
      }
      // 縦のうねり (参道の登り下り)
      float bendY(float z) {
        return 0.50 * sin(z * 0.15708 + 0.7) + 0.16 * sin(z * 0.31415926 + 2.9);
      }

      // ※ z 依存パターンの周期はすべて 40 の約数 (JS 側 wrap=40 とシームレス)
      // 鳥居: 周期 0.8 (50 基/wrap)
      float map(vec3 p, float t) {
        // 参道の軸に沿った座標へ (鳥居・石畳全部がカーブと坂に追従する)
        float X = p.x - bendX(p.z);
        float Y = p.y - bendY(p.z);
        float ax = abs(X);
        float W = u_width;

        // ── 鳥居 (周期 0.8) ──
        float zq = mod(p.z, 0.8) - 0.4;
        // 1 基ごとに僅かに傾く (古参道の不揃い。セル境界は鳥居の無い隙間なので不連続でも安全)
        float gidM = floor(p.z / 0.8);
        float leanM = (hash(vec2(mod(gidM, 50.0), 41.0)) - 0.5) * 0.05;
        float Xg = X - leanM * Y;
        float axg = abs(Xg);
        // 柱: 内転び (上ほど僅かに内側へ) の円柱
        float dpil = length(vec2(axg - (W - Y * 0.028), zq)) - 0.062;
        dpil = max(dpil, Y - 1.52);
        // 笠木: 端が反り上がる (明神鳥居)。黒漆
        float xr = clamp(Xg * Xg / ((W + 0.22) * (W + 0.22)), 0.0, 1.0);
        float dkas = sdBox(vec3(Xg, Y - (1.60 + 0.055 * xr), zq), vec3(W + 0.22, 0.048, 0.066));
        // 島木: 笠木の下の副梁。黒漆
        float dshi = sdBox(vec3(Xg, Y - 1.50, zq), vec3(W + 0.15, 0.034, 0.056));
        // 貫: 柱を貫く横木。朱
        float dnuki = sdBox(vec3(Xg, Y - 1.12, zq), vec3(W + 0.11, 0.042, 0.034));

        // ── 石畳 (細かい石板 + シャープな目地。周期: 40*3.5=140 セルで wrap とシームレス) ──
        vec2 sc = vec2(X * 3.5, p.z * 3.5);
        sc.x += 0.5 * mod(floor(sc.y), 2.0);      // 段違い (running bond)
        vec2 scf = fract(sc) - 0.5;
        float sh = hash(vec2(mod(floor(sc.y), 140.0), floor(sc.x)));
        float joint = smoothstep(0.42, 0.5, max(abs(scf.x), abs(scf.y)));
        float rough = (vnoise(vec3(X * 22.0, 0.0, p.z * 22.0)) - 0.5) * 0.008;
        float dg = Y - ((sh * 0.018 + rough) * (1.0 - joint) - joint * 0.006);

        float d = dg; g_mat = 1.0;
        float dv = min(dpil, dnuki);            // 朱の部材
        float dk = min(dkas, dshi);             // 黒漆の部材
        if (dv < d) { d = dv; g_mat = 0.0; }
        if (dk < d) { d = dk; g_mat = 2.0; }
        // 保険の小さな削り (JS 側の衝突回避が主)
        return smax(d, 0.10 - t, 0.05);
      }

      vec3 calcNormal(vec3 pos, float t) {
        const float e = 0.001;
        vec2 k = vec2(1.0, -1.0);
        return normalize(
          k.xyy * map(pos + k.xyy * e, t) +
          k.yyx * map(pos + k.yyx * e, t) +
          k.yxy * map(pos + k.yxy * e, t) +
          k.xxx * map(pos + k.xxx * e, t));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        vec3 ro = u_ro;
        vec3 fw = normalize(u_ta - ro);
        // カーブでバンク (カメラが曲がりに傾く = 歩きの体感)
        vec3 wup = normalize(vec3(-u_bank * 0.4, 1.0, 0.0));
        vec3 rt = normalize(cross(wup, fw));
        vec3 up = cross(fw, rt);
        vec3 rd = normalize(fw * 1.3 + uv.x * rt + uv.y * up);

        // レイマーチ + 夜気のグローの蓄積
        float t = hash(gl_FragCoord.xy) * 0.02;
        float glowAcc = 0.0;
        float stepsF = 0.0;
        bool hit = false;
        vec3 pos = ro;
        for (int i = 0; i < 100; i++) {
          pos = ro + rd * t;
          float d = map(pos, t);
          glowAcc += exp(-d * 45.0) * 0.0028;
          if (d < 0.001 * (1.0 + t)) { hit = true; break; }
          t += d * 0.75; // 笠木の反りで DE が非厳密なので控えめに進む
          stepsF += 1.0;
          if (t > 16.0) break;
        }
        // calcNormal が map のグローバルを上書きするので先に確保
        float mat = g_mat;

        // フォグ到達色 = miss 色 (消失点のシルエット虫を防ぐ)
        vec3 nightFog = vec3(0.012, 0.009, 0.022);
        vec3 col = vec3(0.0);

        if (hit) {
          vec3 n = calcNormal(pos, t);
          vec3 toCam = normalize(ro - pos);
          float lx = pos.x - bendX(pos.z);
          float ly = pos.y - bendY(pos.z);   // 参道ローカルの高さ (坂に追従)
          float axl = abs(lx);

          // ── 汚し (グランジ) ──
          // ※細い円柱上では fbm が y 1 次元に退化して横縞になる。柱への効きは弱く保つ
          float stain  = fbm(pos * vec3(4.0, 2.2, 4.0));                      // 漆の褪せムラ
          float grit   = vnoise(pos * 40.0);                                   // 細かいザラつき
          float mnc = map(pos + n * 0.04, t) / 0.04;
          float crev = clamp(1.0 - mnc, 0.0, 1.0);
          // バンプ: 石畳は粗く、木部・漆は薄く (完全な平滑面は CG 臭くなる)
          if (mat < 2.5) {
            float bAmp = (mat > 0.5 && mat < 1.5) ? 0.22 : 0.10;
            n = normalize(n + (vec3(vnoise(pos * 34.0),
                                    vnoise(pos * 34.0 + 7.7),
                                    vnoise(pos * 34.0 + 15.3)) - 0.5) * bAmp);
          }

          // 光は琥珀系統に統一。月光の藍は微弱アンビエントのみ
          // (方向は空に見える朧月と一致。低い月を参道の先に置く = 月に向かって歩く)
          vec3 moonDir = normalize(vec3(0.18, 0.18, 0.65));
          float moon = max(dot(n, moonDir), 0.0) * 0.20;
          float skyAmb = (n.y * 0.5 + 0.5) * 0.055;
          // 手元の灯り: 唯一の近接光源。bass で燃え上がる
          float head = 0.55 / (1.0 + t * t * 1.2) * (1.0 + u_bass * 0.7);
          float dif = max(dot(n, toCam), 0.0) * head;
          // 歩数 AO は控えめに: 手前の梁をかすめたレイの余剰ステップが
          // 奥の柱に「偽の影の帯」を落とす (バンディングの正体)。溝の影は crev が担う
          float aoBase = clamp(1.0 - stepsF / 140.0, 0.0, 1.0);
          float ao = 0.55 + 0.45 * aoBase;
          if (mat < 0.5) ao = 0.80 + 0.20 * aoBase;   // 滑らかな朱柱は帯が最も目立つ

          float gid = floor(pos.z / 0.8);
          float gh = hash(vec2(mod(gid, 50.0), 2.0));

          vec3 alb;
          if (mat < 0.5) {
            // 朱の柱・貫: 鳥居ごとに褪せ具合が違う (新しい朱と風化した朱が混ざる)
            float hue = 0.028 + gh * 0.016 + sin(pos.z * 0.15708) * 0.006;
            alb = hsb(fract(hue), 0.86, 0.50 + gh * 0.32);
            alb *= 0.86 + 0.20 * stain;
            // 褪せ: 古い鳥居は彩度が抜ける
            alb = mix(alb, vec3(dot(alb, vec3(0.34))) * 0.9, gh * gh * 0.35);
            // 木目: 柱は縦に、貫は横に走る筋 (周方向を高周波にすると縦筋になる)
            float grain = (ly < 1.06)
              ? vnoise(vec3(lx * 46.0, ly * 2.4, pos.z * 46.0))
              : vnoise(vec3(lx * 2.6, ly * 34.0, pos.z * 34.0));
            alb *= 0.80 + 0.34 * grain;
            // 剥げ: 朱が剥がれて下地の木肌が覗く (古い鳥居ほど広く剥げる)
            float peel = fbm(vec3(lx * 12.0, ly * 5.0, pos.z * 12.0));
            float peelAmt = smoothstep(0.62 - gh * 0.22, 0.78 - gh * 0.18, peel);
            vec3 wood = hsb(0.075, 0.40, 0.13 + 0.10 * grain);
            alb = mix(alb, wood, peelAmt * 0.9);
            // 根巻き: 柱の根本の黒帯
            float band = 1.0 - smoothstep(0.13, 0.20, ly);
            alb = mix(alb, vec3(0.040, 0.034, 0.034), band * 0.92);
            // 奉納の墨書き: カメラを向いた柱面だけ、細い破線の縦列
            // (面の向きでフェードさせないと縞が柱を一周してバンディングになる)
            float inkFace = smoothstep(0.15, 0.45, -n.z);
            if (inkFace > 0.01 && ly > 0.34 && ly < 1.04 && axl > u_width - 0.15) {
              float segId = floor(ly * 14.0);
              float si = hash(vec2(mod(gid, 50.0), segId + 31.0));
              float gsel = hash(vec2(mod(gid, 50.0), 17.0));
              if (gsel > 0.45 && si > 0.45) {
                float seg = fract(ly * 14.0);
                float ink = smoothstep(0.25, 0.38, seg) * (1.0 - smoothstep(0.62, 0.75, seg));
                alb *= 1.0 - ink * inkFace * 0.6 * (1.0 - peelAmt);   // 剥げた所は墨も消える
              }
            }
          } else if (mat < 1.5) {
            // 石畳: 低彩度の暖灰。参道の外は苔むした闇に沈む
            vec2 scS = vec2(lx * 3.5, pos.z * 3.5);
            scS.x += 0.5 * mod(floor(scS.y), 2.0);
            float th = hash(vec2(mod(floor(scS.y), 140.0), floor(scS.x)));
            alb = hsb(0.08 + th * 0.02, 0.20, 0.13 + th * 0.10);
            float jm = smoothstep(0.42, 0.5, max(abs(fract(scS.x) - 0.5), abs(fract(scS.y) - 0.5)));
            alb *= 1.0 - jm * 0.55;
            alb *= 0.85 + 0.30 * vnoise(vec3(lx * 22.0, 0.0, pos.z * 22.0));
            // 参道の縁の外 = 苔と落ち葉の闇
            float outEdge = smoothstep(u_width + 0.02, u_width + 0.4, axl);
            alb = mix(alb, hsb(0.30, 0.35, 0.045), outEdge * 0.85);
          } else {
            // 笠木・島木: 黒漆 (僅かに照る)
            alb = vec3(0.038, 0.032, 0.034) * (0.8 + 0.4 * stain);
          }

          col = alb * (moon * hsb(0.60, 0.35, 1.0)
                     + skyAmb * hsb(0.65, 0.55, 1.0) * 2.0
                     + dif * hsb(0.085, 0.50, 1.0)) * ao;
          col *= 1.0 - crev * 0.35;
          col *= 0.88 + 0.24 * grit;

          // 黒漆の月明かりハイライト (夜の漆は稜線だけ照る)
          if (mat > 1.5 && mat < 2.5) {
            float ms = pow(max(dot(reflect(rd, n), moonDir), 0.0), 24.0);
            col += hsb(0.60, 0.25, 1.0) * ms * 0.12;
          }

          // 朱の縁光り (手元の灯りの照り返し。同系色相、控えめ)
          if (mat < 0.5) {
            float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
            col += hsb(0.07, 0.75, 1.0) * rim * 0.09;
          }

          // 拍の光パルス: 金色の帯が参道の奥へ駆け抜ける
          // (アルベドに乗算 = 照明として当てる。生加算だと白に洗われる)
          for (int j = 0; j < 3; j++) {
            float pb = exp(-abs(u_pulseZ[j] - pos.z) * 2.2);
            col += alb * hsb(0.10, 0.55, 1.0) * pb * 2.0;
          }

          // 遠くは闇に沈む (参道の奥は見えないから神秘で良い)
          col = mix(col, nightFog, 1.0 - exp(-t * 0.11));
        } else {
          // 鳥居の隙間から見える夜空 (地平方向はフォグ到達色に一致させる)
          float h = clamp(rd.y * 1.6 + 0.1, 0.0, 1.0);
          col = mix(nightFog, hsb(0.66, 0.60, 0.055), h);
          // 朧月: 照明の moonDir と同じ方角、参道の先の低い空に懸かる金色の満月
          float md = dot(rd, normalize(vec3(0.18, 0.18, 0.65)));
          float disc = smoothstep(0.99855, 0.99925, md);
          float mare = 0.86 + 0.14 * vnoise(rd * 40.0 + 3.0);   // 月の海のまだら
          col += hsb(0.115, 0.20, 1.0) * disc * mare * 1.7;
          // 月暈: treble で息づく
          float halo = pow(max(md, 0.0), 70.0);
          col += hsb(0.110, 0.45, 1.0) * halo * (0.08 + u_treble * 0.35);
          // 星: 頭上の梢の隙間にだけ瞬く
          float st = hash(floor(rd.xy * 90.0) + vec2(0.5));
          col += vec3(0.75, 0.8, 1.0) * smoothstep(0.994, 1.0, st)
               * smoothstep(0.20, 0.45, rd.y) * (0.5 + 0.5 * sin(u_time * 3.0 + st * 40.0)) * 0.35;
        }

        // 夜気のグロー (rms と拍で舞い上がる)
        col += hsb(0.10, 0.60, 1.0) * min(glowAcc, 0.35) * (0.15 + u_rms * 0.5 + u_beat * 0.7);

        // フィルミックトーンマップ (白飛びを構造的に防ぐ) + グレイン + ビネット + ガンマ
        col = 1.0 - exp(-max(col, 0.0) * 1.25);
        col *= 1.0 + (hash(gl_FragCoord.xy + fract(u_time * 7.13) * 61.7) - 0.5) * 0.12;
        col *= 1.0 - 0.38 * dot(uv, uv);
        col = pow(col, vec3(0.95));
        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) {
    this.audio.bass = d.bass || 0;
    this.audio.mid = d.mid || 0;
    this.audio.treble = d.treble || 0;
    this.audio.rms = d.rms || 0;
  }

  // 拍 = 光パルスを前方へ放つ + 歩みの加速
  onBeat(strength) {
    const st = Math.min(1, strength);
    this.beat = Math.min(1, this.beat + 0.5 + st * 0.5);
    this.kick = Math.min(1.3, this.kick + 0.3 + st * 0.5);
    this._pulses.pop();
    this._pulses.unshift(this._z + 0.4);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['torii-gates'] = ToriiGatesPreset;
})();
