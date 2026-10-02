(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * asteroid-belt — 小惑星帯を疾走する。岩塊をかわしながら星雲の中を飛ぶ。
 *
 * 開放空間型の GPU レイマーチ。ドメイン反復 (セル 4.0) にセルごとの
 * hash で岩 (ノイズ変位した球) を置き、ゆっくり自転させる。
 * 飛行軸に近いセルほど岩を小さくして安全回廊を作る —
 * 遠くに大岩、すぐ横を小石がかすめる (ニアミスの疾走感)。
 *
 * 音 → 映像:
 *   beat   → 光の波が前方へ走り、通過した岩が順に金色に光る + ブースト
 *   bass   → 飛行速度 + 太陽光の強さ
 *   treble → 星の瞬き
 *   rms    → 巡航速度 (無音でも自律で漂う)
 *
 * 技術:
 *   - セル境界の DE は「境界までの距離 + 隣セルの岩が境界に寄れない余白」で
 *     下界を取る (bounded-cell)。オーバーステップによるすり抜けを防ぐ
 *   - 自転する岩の表面ノイズは回転後の局所座標でサンプル (模様が表面に固定される)
 *   - z は JS 側で 64 (セル 16 個) wrap して float 精度を保つ
 *   - 光は太陽の暖色 + 星雲の寒色アンビエントの 2 系統、フィルミックトーンマップ
 */
class AsteroidBeltPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this._shader = null;
    this._time = 0;
    this._z = 0;
    this._pulses = [-1e5, -1e5, -1e5];
    this.smoothBass = 0;
    this.smoothTreble = 0;
    this.kick = 0;
    this.beat = 0;
    this._v = 9.0;   // 平滑化済みの飛行速度
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
        preset.smoothBass += (preset.audio.bass - preset.smoothBass) * 0.1;
        preset.smoothTreble += (preset.audio.treble - preset.smoothTreble) * 0.3;
        preset.kick *= 0.93;
        preset.beat *= 0.88;

        // 前進: 巡航 + rms + 拍のブースト。無音でも漂い続ける (自律)
        // 速度は平滑化して「加速感」にする (瞬間ジャンプさせるとカクつく)
        const vT = 9.0 + preset.audio.rms * 4.0 + preset.smoothBass * 5.0 + preset.kick * 14.0;
        preset._v += (vT - preset._v) * 0.07;
        const v = preset._v;
        preset._z += dt * v;
        for (let i = 0; i < 3; i++) preset._pulses[i] += dt * 30.0;
        // セル 4.0 × 16 = 64 で wrap (精度維持)
        if (preset._z > 64) {
          preset._z -= 64;
          for (let i = 0; i < 3; i++) preset._pulses[i] -= 64;
        }

        // カメラ: 軸まわりを緩やかにドリフト (回廊の内側に収まる振幅)
        const t0 = preset._time;
        const cx = Math.sin(t0 * 0.31) * 0.38 + Math.sin(t0 * 0.13 + 1.7) * 0.18;
        const cy = Math.sin(t0 * 0.23 + 0.9) * 0.30 + Math.sin(t0 * 0.11 + 2.3) * 0.15;
        const tx = Math.sin((t0 + 2.2) * 0.31) * 0.30;
        const ty = Math.sin((t0 + 2.2) * 0.23 + 0.9) * 0.24;
        const bank = Math.cos(t0 * 0.31) * 0.31 * 0.38 * 2.0; // 横ドリフトの微分 → バンク

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_ro', [cx, cy, preset._z]);
          preset._shader.setUniform('u_ta', [tx, ty, preset._z + 4.0]);
          preset._shader.setUniform('u_bass', preset.smoothBass);
          preset._shader.setUniform('u_treble', preset.smoothTreble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_beat', preset.beat);
          preset._shader.setUniform('u_bank', bank);
          preset._shader.setUniform('u_speed', v);
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
      uniform float u_bass;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;
      uniform float u_bank;
      uniform float u_speed;
      uniform float u_pulseZ[3];

      float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453123); }
      float hash(vec3 q) { return fract(sin(dot(q, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }

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
        for (int i = 0; i < 3; i++) { v += a * vnoise(p); p *= 2.13; a *= 0.5; }
        return v;
      }

      vec3 hsb(float h, float s, float b) {
        vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return b * mix(vec3(1.0), rgb, s);
      }

      vec2 rot2(vec2 v, float a) {
        float c = cos(a), s = sin(a);
        return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
      }

      float g_rockH;   // 岩の個体 hash (彩色用)
      vec3  g_rp;      // 岩ローカル座標 (回転済み。バンプ/模様を表面に固定するため)
      vec3  g_rpTmp;   // rockDE が書く作業用

      // 岩 1 個の DE: 楕円伸長 + 面取り + クレーター。回転済みローカル座標を g_rpTmp に残す
      // hash は 2 回だけ引き、残りのパラメータは fract 連鎖で導出 (コスト最重要)
      float rockDE(vec3 q, vec3 cidm, float h1, float rad, float offAmp, float wScale) {
        float hA = hash(cidm + 7.0);
        float hB = hash(cidm + 13.0);
        vec3 off = (vec3(hA, hB, fract(hA * 7.31)) - 0.5) * offAmp;
        vec3 rp0 = q - off;
        // 遠距離 LOD: バウンディング球の外 0.5 以上なら詳細 (回転・ノイズ・面取り) を省く
        // 面取りは材を削るだけなので球距離は常に安全側の下界
        float dFar = length(rp0) - rad * 1.6;
        if (dFar > 0.5) { g_rpTmp = rp0; return dFar * 0.9; }
        // 自転: セルごとの速度で 2 軸回転 (巨岩ほどゆっくり)。表面ノイズは回転後の座標で取る
        vec3 rp = rp0;
        float w1 = (fract(hA * 13.7) - 0.5) * 1.6 * wScale;
        float w2 = (fract(hB * 17.3) - 0.5) * 1.6 * wScale;
        rp.xy = rot2(rp.xy, u_time * w1 + h1 * 6.28);
        rp.yz = rot2(rp.yz, u_time * w2 + h1 * 4.0);
        // 楕円に伸長 (丸ジャガイモ化を防ぐ。イトカワ的な長細い岩も混ざる)
        vec3 ax3 = vec3(0.62 + fract(hA * 3.71) * 0.76,
                        0.62 + fract(hB * 5.13) * 0.76,
                        0.62 + fract(hA * 9.53) * 0.76);
        // ゴツゴツ: 方向ノイズで半径を変位。v2 は中周波の起伏とクレーターを兼用
        vec3 dir = rp / max(length(rp), 1e-4);
        float v2 = vnoise(dir * 6.0 + cidm * 2.9);
        float bump = vnoise(dir * 3.0 + cidm * 1.7) * 0.16
                   + v2 * 0.10
                   - smoothstep(0.62, 0.80, v2) * 0.24;
        float dR = (length(rp / ax3) - rad * (0.86 + bump)) * min(ax3.x, min(ax3.y, ax3.z));
        // 面取り: ランダム平面 2 枚で角張った岩塊にする
        float th1 = fract(hA * 23.9) * 6.2832, ph1 = fract(hB * 27.1) * 3.1416;
        dR = max(dR, dot(rp, vec3(sin(ph1) * cos(th1), sin(ph1) * sin(th1), cos(ph1)))
                    - rad * (0.58 + fract(hA * 31.7) * 0.26));
        float th2 = fract(hB * 37.3) * 6.2832, ph2 = fract(hA * 41.9) * 3.1416;
        dR = max(dR, dot(rp, vec3(sin(ph2) * cos(th2), sin(ph2) * sin(th2), cos(ph2)))
                    - rad * (0.58 + fract(hB * 43.7) * 0.26));
        g_rpTmp = rp;
        return dR * 0.85;   // 楕円化 + 面取りで DE が非厳密なので安全係数
      }

      // 2 レイヤのドメイン反復: 小岩 (セル 4.0) + 疎な巨岩 (セル 8.0)。
      // 各レイヤは「岩 or セル境界+余白」の下界を取る (オーバーステップ防止)
      // ※ z セル id は wrap 64 の約数で mod、x/y は視程内で非反復になる大きめの mod
      float map(vec3 p, float t) {
        // ── 小岩レイヤ (セル 4.0): サイズは pow 分布 = 小石多め + 時々大きめ ──
        vec3 cid = floor(p / 4.0);
        vec3 q = mod(p, 4.0) - 2.0;
        vec3 cidm = vec3(mod(cid.x, 64.0), mod(cid.y, 64.0), mod(cid.z, 16.0));
        float h1 = hash(cidm);
        float bx = 2.0 - abs(q.x), by = 2.0 - abs(q.y), bz = 2.0 - abs(q.z);
        float b1 = min(bx, min(by, bz)) + 0.2;
        float dR1 = 1e5;
        vec3 rp1 = vec3(0.0);
        if (h1 > 0.42) {
          vec2 cc = (cid.xy + 0.5) * 4.0;
          float sizeK = 0.12 + 0.88 * smoothstep(1.5, 7.0, length(cc));
          float hs = hash(cidm + 3.0);
          float rad = (0.06 + hs * hs * hs * 0.76) * sizeK;   // 3乗分布 = 塵〜小石が大半、稀に中岩
          dR1 = rockDE(q, cidm, h1, rad, 1.0, 1.0);
          rp1 = g_rpTmp;
        }

        // ── 巨岩レイヤ (セル 8.0、疎): 遠くをゆっくり過ぎていく主役級の岩塊 ──
        vec3 cid2 = floor(p / 8.0);
        vec3 q2 = mod(p, 8.0) - 4.0;
        vec3 cidm2 = vec3(mod(cid2.x, 32.0), mod(cid2.y, 32.0), mod(cid2.z, 8.0)) + 200.0;
        float h2 = hash(cidm2);
        float bx2 = 4.0 - abs(q2.x), by2 = 4.0 - abs(q2.y), bz2 = 4.0 - abs(q2.z);
        float b2 = min(bx2, min(by2, bz2)) + 0.3;
        float dR2 = 1e5;
        if (h2 > 0.78) {
          vec2 cc2 = (cid2.xy + 0.5) * 8.0;
          // クリアランス方式: サイズは縮めず、岩の到達半径 + 安全マージンぶん
          // 軸から離れたセルにだけフルサイズを置く → 真の巨岩がすぐ横を過ぎる
          float rad2 = 0.9 + hash(cidm2 + 3.0) * 1.1;
          if (length(cc2) > rad2 * 1.6 + 1.7) {
            dR2 = rockDE(q2, cidm2, h2, rad2, 1.0, 0.35);
          }
        }

        // 材質は「実際に近い方の岩」から拾う (hit 点で正しい岩の座標/hash になる)
        if (dR1 <= dR2) { g_rockH = h1; g_rp = rp1; }
        else            { g_rockH = h2; g_rp = g_rpTmp; }
        return min(min(dR1, b1), min(dR2, b2));
      }

      vec3 calcNormal(vec3 pos, float t) {
        const float e = 0.0015;
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
        vec3 wup = normalize(vec3(-u_bank * 0.6, 1.0, 0.0));
        vec3 rt = normalize(cross(wup, fw));
        vec3 up = cross(fw, rt);
        // 速度で FOV が広がる = 吸い込まれる引き込み
        // (u_speed は JS 側で平滑化済み。beat 直結にすると画角がポンと跳ねてカクつく)
        float fl = 1.25 - min(u_speed * 0.010, 0.22);
        vec3 rd = normalize(fw * fl + uv.x * rt + uv.y * up);

        // 太陽はほぼ正面 = 光に向かって飛ぶ (岩は逆光のシルエットで流れ去る)
        vec3 sunDir = normalize(vec3(0.15, 0.10, 0.90));

        // レイマーチ + 拍の光波が塵を照らすグロー蓄積
        float t = hash(gl_FragCoord.xy) * 0.15;
        float stepsF = 0.0;
        float pulseAir = 0.0;
        bool hit = false;
        vec3 pos = ro;
        for (int i = 0; i < 76; i++) {
          pos = ro + rd * t;
          float d = map(pos, t);
          for (int j = 0; j < 3; j++) {
            pulseAir += exp(-abs(u_pulseZ[j] - pos.z) * 0.55) * 0.0042 * exp(-t * 0.06);
          }
          if (d < 0.0012 * (1.0 + t * 0.5)) { hit = true; break; }
          t += d * 0.85;
          stepsF += 1.0;
          if (t > 58.0) break;
        }
        float rockH = g_rockH;
        vec3 rpL = g_rp;   // calcNormal がグローバルを上書きするので先に確保

        // フォグ到達色 = 星雲の暗部 (miss と一致させる)
        vec3 spaceDark = vec3(0.010, 0.012, 0.030);
        vec3 col;

        if (hit) {
          vec3 n = calcNormal(pos, t);
          float ao = 0.55 + 0.45 * clamp(1.0 - stepsF / 100.0, 0.0, 1.0);

          // レゴリスの微細バンプ: 回転済みローカル座標で取る = 模様が表面に固定
          // (これが無いとツルッとした CG になる)
          vec3 grit = vec3(vnoise(rpL * 16.0),
                           vnoise(rpL * 16.0 + 7.7),
                           vnoise(rpL * 16.0 + 15.3)) - 0.5;
          n = normalize(n + grit * 0.40);

          // 岩のアルベド: 赤茶 (酸化鉄のラスト色)。個体で錆の深さが違う
          float rh = hash(vec2(rockH * 91.7, 3.0));
          vec3 alb = hsb(0.028 + rh * 0.030, 0.44 + rh * 0.18, 0.20 + rockH * 0.18);
          alb *= 0.62 + 0.60 * vnoise(rpL * 9.0 + rockH * 19.0);
          alb *= 0.80 + 0.35 * vnoise(rpL * 30.0);

          // 宇宙の過酷な直射: 終端線は急峻に、影はほぼ黒 (アンビエント控えめ)
          float dif = pow(max(dot(n, sunDir), 0.0), 1.5);
          float amb = 0.5 + 0.5 * n.y;
          float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
          col = alb * (dif * hsb(0.09, 0.25, 1.0) * (1.6 + u_bass * 0.8)
                     + amb * hsb(0.62, 0.55, 1.0) * 0.10
                     + hsb(0.62, 0.45, 1.0) * 0.040) * ao;
          // 逆光構図なのでリムが主役 (太陽側の縁が焼ける)
          float sunRim = pow(max(dot(n, sunDir), 0.0), 2.0) * rim;
          col += hsb(0.60, 0.50, 1.0) * rim * 0.16;
          col += hsb(0.09, 0.40, 1.0) * sunRim * 0.9;

          // 拍の光の波: 前方へ走り、通過した岩を金色に照らす
          for (int j = 0; j < 3; j++) {
            float pb = exp(-abs(u_pulseZ[j] - pos.z) * 0.30);
            col += alb * hsb(0.10, 0.50, 1.0) * pb * 2.2;
          }

          // 距離フォグ (星雲に沈む)
          col = mix(col, spaceDark, 1.0 - exp(-t * 0.040));
        } else {
          // ── 星雲 ──
          float n1 = fbm(rd * 2.2 + vec3(3.7, 0.0, 1.2));
          float n2 = fbm(rd * 3.1 + vec3(9.2, 4.1, 0.0));
          float n3 = fbm(rd * 1.6 + vec3(0.0, 7.3, 5.1));
          col = spaceDark
              + hsb(0.63, 0.75, 1.0) * pow(n1, 2.8) * 0.60
              + hsb(0.85, 0.60, 1.0) * pow(n2, 3.4) * 0.42
              + hsb(0.52, 0.55, 1.0) * pow(n3, 3.6) * 0.24;

          // ── 星 2 層 (treble で瞬く)。セル中心からの減衰で点にする (無いと四角が出る) ──
          vec3 g1 = rd * 150.0;
          float s1 = hash(floor(g1) + vec3(0.5));
          float p1 = smoothstep(0.45, 0.05, length(fract(g1) - 0.5));
          vec3 g2 = rd * 60.0;
          float s2 = hash(floor(g2) + vec3(7.5));
          float p2 = smoothstep(0.40, 0.05, length(fract(g2) - 0.5));
          float tw = 0.6 + 0.4 * sin(u_time * 3.0 + s1 * 40.0);
          col += vec3(0.8, 0.85, 1.0) * smoothstep(0.986, 1.0, s1) * p1 * tw * (0.7 + u_treble * 1.4);
          col += vec3(1.0, 0.9, 0.8) * smoothstep(0.994, 1.0, s2) * p2 * (0.9 + u_treble * 0.9);

          // ── 太陽: 小さな白金のディスク + 広いグレア (beat で膨らむ) ──
          float sd = dot(rd, sunDir);
          col += hsb(0.10, 0.30, 1.0) * smoothstep(0.99965, 0.99985, sd) * 3.0;
          col += hsb(0.09, 0.45, 1.0) * pow(max(sd, 0.0), 180.0) * (0.5 + u_beat * 0.8);
          col += hsb(0.08, 0.50, 1.0) * pow(max(sd, 0.0), 24.0) * (0.07 + u_beat * 0.22 + u_bass * 0.08);
        }

        // 拍の光波: 岩の無い空間でも塵が波状に光る
        col += hsb(0.10, 0.45, 1.0) * min(pulseAir, 0.45) * (0.35 + u_beat * 0.55);

        // ワープ筋: 消失点から放射状に流れる塵のライン (速度で濃くなる)
        float rr = length(uv);
        vec2 nd = uv / max(rr, 1e-4);
        float ln = vnoise(vec3(nd * 3.5, rr * 6.0 - u_time * (2.0 + u_speed * 0.35)));
        float streak = smoothstep(0.70, 0.95, ln) * smoothstep(0.10, 0.65, rr);
        col += hsb(0.58, 0.22, 1.0) * streak * (0.02 + u_speed * 0.006 + u_beat * 0.10);

        // フィルミックトーンマップ + グレイン + ビネット
        col = 1.0 - exp(-max(col, 0.0) * 1.25);
        col *= 1.0 + (hash(gl_FragCoord.xy + fract(u_time * 7.13) * 61.7) - 0.5) * 0.10;
        col *= 1.0 - (0.32 + min(u_speed * 0.006, 0.14)) * dot(uv, uv);   // 速度でトンネル視野
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

  // 拍 = 光の波を前方へ放つ + ブースト
  onBeat(strength) {
    const st = Math.min(1, strength);
    this.beat = Math.min(1, this.beat + 0.5 + st * 0.5);
    this.kick = Math.min(1.4, this.kick + 0.4 + st * 0.5);
    this._pulses.pop();
    this._pulses.unshift(this._z + 2.0);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['asteroid-belt'] = AsteroidBeltPreset;
})();
