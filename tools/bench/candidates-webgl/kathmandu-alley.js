(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * kathmandu-alley — カトマンズ旧市街の狭いレンガ路地を歩き続ける。
 *
 * apollonian-caves と同じ「空間の中を旅する」レイマーチ。
 * 両側にレンガ建物 (彫り窓 + 上階の張り出し)、頭上に経文旗 (タルチョ)、
 * 足元は石畳。薄暮の琥珀色の光の中を終わりなく進む
 * (構造は z 周期で無限反復、カメラ z は JS 側で wrap して精度を保つ)。
 *
 * 音 → 映像:
 *   beat   → バターランプ色の光の帯が路地の奥へ駆け抜ける + 歩みが加速
 *   bass   → 路地の幅が呼吸 (壁が迫る) + 窓明かりが燃え上がる
 *   treble → 経文旗のはためき振幅
 *   rms    → 歩行速度 + 埃っぽい空気の光
 *
 * 技術:
 *   - DE = 壁 (smoothstep で上階が張り出す) − 彫り窓 box 減算 + 石畳 + 旗 box
 *   - JS 側にも壁 DE を実装しカメラが壁を検知して避ける (空間型の規律)
 *   - 窓のくぼみ近傍 (orbit trap 相当) × 格子マスク = 窓明かりの発光
 *   - 光は琥珀系統に統一 (夕陽 0.06 / ヘッドライト・窓 0.085-0.09)、
 *     旗の 5 色はアルベド (表面色) なので加算で白に濁らない
 *   - フィルミックトーンマップ 1-exp(-col) で白飛びを構造的に排除
 */
class KathmanduAlleyPreset extends BasePreset {
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

  // shader と同じ路地軸の蛇行 (S 字カーブ)
  _bend(z) {
    return 0.7 * Math.sin(z * 0.15708) + 0.35 * Math.sin(z * 0.31415926 + 1.7);
  }

  // shader と同じ縦のうねり (坂の登り下り)
  _bendY(z) {
    return 0.30 * Math.sin(z * 0.15708 + 0.9) + 0.12 * Math.sin(z * 0.31415926 + 2.3);
  }

  // GPU と同じ壁 DE の保守版 (窓のくぼみは無視 = 常に安全側) をカメラ衝突回避に使う
  _de(x, y, z, w) {
    // shader と同じ蛇行 + 坂 + 幅のうねり (消失点級の狭窄部) を反映
    const X = x - this._bend(z);
    const Y = y - this._bendY(z);
    const W = w - 0.28 * (0.5 + 0.5 * Math.sin(z * 0.31415926));
    return Math.min(W - Math.abs(X), Y - 0.05);
  }

  // 目標位置が壁・地面に近すぎたら勾配 (数値微分) 方向へ押し出す
  _avoidWalls(bx, by, z, w) {
    const R = 0.16;   // カメラの安全半径
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
        preset.kick *= 0.94;
        preset.beat *= 0.88;

        // 前進: 歩行 + rms + 拍の加速。無音でも歩みは続く (自律)
        preset._z += dt * (0.55 + preset.audio.rms * 0.45 + preset.kick * 0.9);
        for (let i = 0; i < 3; i++) preset._pulses[i] += dt * 2.4;
        // 全パターンの周期は 40 の約数に揃えてあるので z を 40 で wrap (精度維持)
        if (preset._z > 40) {
          preset._z -= 40;
          for (let i = 0; i < 3; i++) preset._pulses[i] -= 40;
        }

        // 路地の半幅: ゆっくり呼吸 + bass で壁が迫る
        const w = 0.58 + Math.sin(preset._widthPhase) * 0.03 - preset.smoothBass * 0.10;

        // カメラ: 路地の蛇行軸を追従 + 歩行の上下動 → 壁を検知して避ける (CPU 側 DE)
        const t0 = preset._time;
        const zc = preset._z;
        const bx = preset._bend(zc) + Math.sin(t0 * 0.23) * 0.12;
        const by = 0.56 + preset._bendY(zc) + Math.sin(t0 * 1.8) * 0.015 + preset.kick * 0.03;
        const [cx, cy] = preset._avoidWalls(bx, by, zc, w);
        // 視線はカーブと坂の先を追う (= 曲がり込み・登り下りの体感)
        const tx = preset._bend(zc + 1.5) + Math.sin((t0 + 2.5) * 0.23) * 0.10 + preset._offX * 0.6;
        const ty = 0.62 + preset._bendY(zc + 1.5) + Math.sin(t0 * 0.11) * 0.06 + preset._offY * 0.6;
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

      // value noise + fbm (汚し用: 風化ムラ・雨だれ・濡れ)
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

      // HSB → RGB (mandelbulb / apollonian で実証済みの発色)
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

      float g_mat;   // 0=壁 1=石畳 2=旗
      float g_win;   // 窓のくぼみ近傍 (窓明かりマスク)
      float g_sid;   // 旗の紐 index (色サイクル用)

      // 路地の軸の蛇行 (S 字カーブ。周期 40 + 20 の重ね = wrap 40 とシームレス)
      float bendX(float z) {
        return 0.7 * sin(z * 0.15708) + 0.35 * sin(z * 0.31415926 + 1.7);
      }
      // 縦のうねり (坂の登り下り)。横より控えめ
      float bendY(float z) {
        return 0.30 * sin(z * 0.15708 + 0.9) + 0.12 * sin(z * 0.31415926 + 2.3);
      }

      // ※ z 依存パターンの周期はすべて 40 の約数 (JS 側 wrap=40 とシームレス)
      float map(vec3 p, float t) {
        // 路地の軸に沿った座標へ (壁・窓・旗・電線・ゴミ全部がカーブと坂に追従する)
        p.x -= bendX(p.z);
        p.y -= bendY(p.z);
        // 路地の幅は z 方向にうねる (消失点級の狭窄部。周期 20)
        float W = u_width - 0.28 * (0.5 + 0.5 * sin(p.z * 0.31415926));
        // 建物: 下層の壁 + 直角に張り出す上層 2 段 (カトマンズ旧市街の圧迫感)
        float ax = abs(p.x);
        float dwall = max(W - ax, p.y - 2.4);
        float dup1 = max(W - 0.18 - ax, max(1.12 - p.y, p.y - 2.4));
        float dup2 = max(W - 0.28 - ax, max(1.85 - p.y, p.y - 2.4));
        dwall = min(dwall, min(dup1, dup2));

        // 彫り窓: z 周期 0.8、下層と張り出し上層それぞれの壁面から減算
        float zq = mod(p.z, 0.8) - 0.4;
        float dw1 = sdBox(vec3(ax - W + 0.05, p.y - 0.60, zq), vec3(0.09, 0.17, 0.20));
        float dw2 = sdBox(vec3(ax - W + 0.18 + 0.05, p.y - 1.52, zq), vec3(0.09, 0.14, 0.17));
        float dwin = min(dw1, dw2);
        dwall = max(dwall, -dwin);

        // 石畳: 細かめの石板を段違いに組む + シャープな目地 + 表面の荒れ
        // (丸い枕石にしない。周期: 40*4.8=192 セルで wrap とシームレス)
        vec2 sc = vec2(p.x * 4.8, p.z * 4.8);
        sc.x += 0.5 * mod(floor(sc.y), 2.0);      // 段違い (running bond)
        vec2 scf = fract(sc) - 0.5;
        float sh = hash(vec2(mod(floor(sc.y), 192.0), floor(sc.x)));
        // 目地は細く鋭く (斜面を広げると石が枕クッションに見える)
        float joint = smoothstep(0.42, 0.5, max(abs(scf.x), abs(scf.y)));
        float rough = (vnoise(vec3(p.x * 26.0, 0.0, p.z * 26.0)) - 0.5) * 0.007;
        float dg = p.y - ((sh * 0.016 + rough) * (1.0 - joint) - joint * 0.006);

        // 経文旗 (タルチョ) ×2 本: たわんだ紐 + 上辺だけ固定された小さな布パネル。
        // ボロボロ: ちぎれて無いパネル / ジグザグに破れた裾 / 虫食い穴 / 褪せ差
        float Wf = W - 0.20;
        float xr = clamp(p.x * p.x / max(Wf * Wf, 1e-4), 0.0, 1.0);
        float drope = 1e5;
        float dflag = 1e5;
        float flagSid = 0.0;
        for (int L = 0; L < 2; L++) {
          float fL = float(L);
          float sid_ = mod(floor((p.z + 1.0 - fL) / 2.0), 20.0) + fL * 7.0;
          float fz_ = mod(p.z + 1.0 - fL, 2.0) - 1.0;
          float ropeY_ = (1.42 + fL * 0.17) - (0.10 - fL * 0.03) * (1.0 - xr)
                       + sin(u_time * (0.9 + fL * 0.3) + sid_ * 2.4) * 0.012;
          float dr = length(vec2(p.y - ropeY_, fz_)) - 0.005;
          drope = min(drope, max(dr, abs(p.x) - Wf - 0.02));
          // パネル: ピッチ 0.11 の小さな布 (実物の lung ta は掌サイズが密に並ぶ)
          float fxi = (p.x + 8.0) / 0.11;
          float pid = floor(fxi);
          float pxl = (fract(fxi) - 0.5) * 0.11;
          float ph = hash(vec2(mod(pid, 97.0), sid_));
          if (ph < 0.14) continue;   // ちぎれて無くなったパネル
          float dy = clamp(ropeY_ - p.y, 0.0, 0.11);
          float curl = pow(dy / 0.11, 1.6);
          float flap = sin(u_time * (2.2 + ph * 2.0) + ph * 6.2831 + p.x * 4.0)
                     * (0.03 + u_treble * 0.10);
          float dp = sdBox(vec3(pxl, p.y - (ropeY_ - 0.050), fz_ - curl * flap),
                           vec3(0.042, 0.050, 0.005));
          // 破れた裾: 縦の短冊ごとに裾の高さが違う (ジグザグの千切れ)
          float rag = hash(vec2(mod(floor(fxi * 5.0), 331.0), sid_ + 1.0)) * 0.040;
          dp = max(dp, (ropeY_ - 0.100 + rag) - p.y);
          // 虫食い穴 (古いパネルほど開いてる)
          if (ph < 0.45) {
            dp = max(dp, 0.016 - length(vec2(pxl - (ph - 0.3) * 0.05, p.y - (ropeY_ - 0.055))));
          }
          dp = max(dp, abs(p.x) - Wf);
          if (dp < dflag) { dflag = dp; flagSid = sid_; }
        }

        // 電線: カトマンズ名物の垂れた配線束。壁沿い 3 本 + 路地を横切る 2 本
        // (z 周期 2 / 4 = wrap 40 の約数でシームレス)
        // ※上階張り出し (ax > u_width-0.18, y > 1.12) に埋めない: 張り出し面より内側に吊る
        float sag1 = cos((mod(p.z, 2.0) - 1.0) * 1.5707963);
        float sag2 = cos((mod(p.z + 0.7, 2.0) - 1.0) * 1.5707963);
        float wx = max(W - 0.22, 0.05);   // 狭窄部で負になって反対側へ突き抜けない
        float dwire = length(vec2(p.x + wx, p.y - (1.58 - 0.10 * sag1))) - 0.013;
        dwire = min(dwire, length(vec2(p.x + wx + 0.03, p.y - (1.50 - 0.13 * sag2))) - 0.011);
        dwire = min(dwire, length(vec2(p.x - wx, p.y - (1.62 - 0.09 * sag2))) - 0.013);
        float xr2 = clamp(p.x * p.x / max(W * W, 1e-4), 0.0, 1.0);
        float cz1 = mod(p.z, 4.0) - 3.1;
        dwire = min(dwire, length(vec2(cz1, p.y - (1.60 + 0.12 * xr2))) - 0.014);
        float cz2 = mod(p.z + 1.8, 4.0) - 2.0;
        dwire = min(dwire, length(vec2(cz2, p.y - (1.72 + 0.10 * xr2))) - 0.012);

        // ゴミ・瓦礫: 壁際に転がる不定形の塊 (z 周期 1.3、ハッシュで有無・大きさ・側)
        float gcell = floor(p.z / 1.3);
        float gh = hash(vec2(mod(gcell, 31.0), 7.0));
        float dgomi = 1e5;
        // 狭窄部にはゴミを置かない (幅が細ると壁基準の配置が道の真ん中に来てしまう)
        if (gh > 0.35 && W > 0.44) {
          float gr = 0.018 + gh * 0.030;   // 小さめ (大きいと岩に見える)
          float side = gh > 0.67 ? 1.0 : -1.0;
          float gz = mod(p.z, 1.3) - 0.65;
          dgomi = length(vec3(p.x - side * (W - 0.07 - gh * 0.04), p.y - gr * 0.5, gz)) - gr;
        }

        float d = dg; g_mat = 1.0;
        if (dwall < d) { d = dwall; g_mat = 0.0; }
        if (dflag < d) { d = dflag; g_mat = 2.0; }
        if (dwire < d) { d = dwire; g_mat = 3.0; }
        if (drope < d) { d = drope; g_mat = 3.0; }   // 旗の紐 = 黒いコード
        if (dgomi < d) { d = dgomi; g_mat = 4.0; }
        g_win = 1.0 - smoothstep(0.0, 0.20, dwin);   // 広めに取る (滲みは shading 側で 2 段に整形)
        g_sid = flagSid;
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

        // レイマーチ + 埃っぽい空気のグロー蓄積
        float t = hash(gl_FragCoord.xy) * 0.02;
        float glowAcc = 0.0;
        float airLight = 0.0;
        float stepsF = 0.0;
        bool hit = false;
        vec3 pos = ro;
        for (int i = 0; i < 100; i++) {
          pos = ro + rd * t;
          float d = map(pos, t);
          glowAcc += exp(-d * 45.0) * 0.0045;
          // 窓帯の埃が窓明かりで光る (光芒の蓄積)
          float Wair = u_width - 0.28 * (0.5 + 0.5 * sin(pos.z * 0.31415926));
          float awz = abs(mod(pos.z, 0.8) - 0.4);
          float apx = Wair - abs(pos.x - bendX(pos.z));
          float lyA = pos.y - bendY(pos.z);   // 路地ローカルの高さ
          float aband = smoothstep(0.30, 0.55, lyA) * (1.0 - smoothstep(0.85, 1.1, lyA));
          // 灯りのある窓だけが光芒を作る (壁の窓明かりと同じハッシュ)
          float alit = hash(vec2(floor(pos.z / 0.8), 11.0));
          alit = alit < 0.35 ? 0.06 : 0.35 + 0.65 * alit;
          // 遠くの窓帯の蓄積は減衰させる (無限に足すと奥が明るい霞になる)
          airLight += exp(-awz * awz * 45.0) * exp(-apx * apx * 9.0) * aband * alit * 0.013 * exp(-t * 0.22);
          if (d < 0.001 * (1.0 + t)) { hit = true; break; }
          t += d * 0.75; // 張り出し・旗の波打ちで DE が非厳密なので控えめに進む
          stepsF += 1.0;
          if (t > 16.0) break;
        }
        // calcNormal が map のグローバルを上書きするので先に確保
        float mat = g_mat;
        float winGlow = g_win;
        float sid = g_sid;

        vec3 duskLow  = hsb(0.05, 0.78, 0.55); // 地平に残る燠火色 (日没後)
        vec3 duskHigh = hsb(0.66, 0.65, 0.16); // 天頂の藍 (夜が落ちてくる)
        vec3 col = vec3(0.0);

        if (hit) {
          vec3 n = calcNormal(pos, t);
          vec3 toCam = normalize(ro - pos);
          float ly = pos.y - bendY(pos.z);   // 路地ローカルの高さ (坂に追従)

          // ── 汚し (グランジ) ──
          float stain  = fbm(pos * vec3(5.0, 2.5, 5.0));                     // 大きな風化ムラ
          float streak = fbm(vec3(pos.x * 26.0, pos.y * 2.2, pos.z * 26.0)); // 雨だれ (縦に伸びる縞)
          float grit   = vnoise(pos * 42.0);                                  // 細かいザラつき
          // 曲率近似 (幾何法線で測る): 凹 = 溝にすすが溜まる
          float mnc = map(pos + n * 0.04, t) / 0.04;
          float crev = clamp(1.0 - mnc, 0.0, 1.0);
          // バンプ: 漆喰・石の凹凸でハイライトのプラスチック感を消す (壁・石畳のみ)
          if (mat < 1.5) {
            n = normalize(n + (vec3(vnoise(pos * 38.0),
                                    vnoise(pos * 38.0 + 7.7),
                                    vnoise(pos * 38.0 + 15.3)) - 0.5) * 0.22);
          }

          // 光は琥珀系統に統一。ただし狭い路地の谷底に夕陽は届かない —
          // 直射は上層の壁だけ、街路レベルは影 + 窓明かりが主役 (これが路地の暗さ)
          vec3 sunDir = normalize(vec3(0.3, 0.35, 0.6));
          float sunReach = smoothstep(1.3, 2.1, ly);       // 最後の残照は最上層だけ (坂に追従)
          float sun = max(dot(n, sunDir), 0.0) * 0.7 * sunReach;
          float skyAmb = (n.y * 0.5 + 0.5) * 0.11;
          float head = 0.32 / (1.0 + t * t * 1.2);
          float dif = max(dot(n, toCam), 0.0) * head;
          float ao = 0.25 + 0.75 * clamp(1.0 - stepsF / 100.0, 0.0, 1.0);

          vec3 alb;
          float wet = 0.0;
          if (mat < 0.5) {
            // 壁: レンガ (実物のカトマンズ煉瓦は細かい。粗いと石ブロックに見える)
            float rowY = floor(ly * 16.0);
            float bz = pos.z * 9.0 + mod(rowY, 2.0) * 0.5;
            float bh = hash(vec2(mod(floor(bz), 360.0), rowY));
            float hue = 0.030 + bh * 0.045 + sin(pos.z * 0.15708) * 0.012;
            alb = hsb(fract(hue), 0.62, 0.26 + bh * 0.28);   // 古煉瓦: 暗く彩度も抜けている
            // 目地: レンガ境界のモルタルを暗く
            float mx = smoothstep(0.0, 0.10, fract(bz)) * smoothstep(1.0, 0.92, fract(bz));
            float my = smoothstep(0.0, 0.12, fract(ly * 16.0)) * smoothstep(1.0, 0.88, fract(ly * 16.0));
            alb *= 0.6 + 0.4 * mx * my;
            // 全面の風化ムラ (均一な新築感を消す)
            alb *= 0.72 + 0.45 * stain;
            // 下部の泥はね・湿り: 暗く + 彩度が抜ける (路地の腰下は必ず汚い)
            float grime = (1.0 - smoothstep(0.05, 1.3, ly)) * (0.45 + 0.55 * stain);
            alb = mix(alb, vec3(dot(alb, vec3(0.34))) * 0.55, grime * 0.75);
            // 雨だれの縦筋
            alb *= 1.0 - smoothstep(0.45, 0.78, streak) * 0.45;
          } else if (mat < 1.5) {
            // 石畳: 低彩度の暖灰 (大きめの石、控えめのむら)
            // 石板セル (map の石畳と同じセル・同じハッシュで色と高さが揃う)
            float lx2 = pos.x - bendX(pos.z);
            vec2 scS = vec2(lx2 * 4.8, pos.z * 4.8);
            scS.x += 0.5 * mod(floor(scS.y), 2.0);   // 段違い (map と同じ)
            float th = hash(vec2(mod(floor(scS.y), 192.0), floor(scS.x)));
            alb = hsb(0.07 + th * 0.02, 0.25, 0.16 + th * 0.12);   // 夕暮れの石畳は暗い
            // 目地の影 (泥の溜まる溝、シャープに)
            float jm = smoothstep(0.42, 0.5, max(abs(fract(scS.x) - 0.5), abs(fract(scS.y) - 0.5)));
            alb *= 1.0 - jm * 0.55;
            // 石の面の細かい荒れ (摩耗ムラ)
            alb *= 0.85 + 0.30 * vnoise(vec3(lx2 * 26.0, 0.0, pos.z * 26.0));
            // 濡れ (水たまり跡): 石が暗くなる。照り返しは後段の鏡面で足す
            wet = smoothstep(0.5, 0.78, fbm(vec3(pos.x * 2.2, 0.0, pos.z * 2.2)));
            alb *= 1.0 - wet * 0.4;
          } else if (mat < 2.5) {
            // 経文旗: 5 色サイクル (青・白・赤・緑・黄)。アルベドなので白濁しない
            float lx = pos.x - bendX(pos.z);   // 蛇行に追従したローカル x
            float fx = (lx + 8.0) / 0.11;
            float pid5 = mod(floor(fx) + sid, 5.0);
            if      (pid5 < 0.5) alb = hsb(0.60, 0.80, 0.95);
            else if (pid5 < 1.5) alb = vec3(0.95);
            else if (pid5 < 2.5) alb = hsb(0.00, 0.85, 0.95);
            else if (pid5 < 3.5) alb = hsb(0.33, 0.80, 0.85);
            else                 alb = hsb(0.145, 0.88, 0.98);
            // 布の皺: 縦方向の細かい明暗 (めくれと同期した張り)
            alb *= 0.85 + 0.15 * sin(lx * 60.0 + pos.y * 8.0);
            // パネルごとの褪せ差: 新しい旗と何年も晒された旗が混ざる
            float phc = hash(vec2(mod(floor(fx), 97.0), 5.0));
            alb = mix(alb, vec3(0.48), 0.12 + 0.55 * phc) * (0.55 + 0.45 * stain);
          } else if (mat < 3.5) {
            // 電線: 薄暮に浮かぶ黒いシルエット
            alb = vec3(0.05, 0.045, 0.04);
          } else {
            // ゴミ・瓦礫: 路地の隅の転がり物 (暗い雑多な色)
            float gh2 = hash(vec2(floor(pos.z / 1.3), 3.0));
            alb = mix(vec3(0.05, 0.045, 0.04), vec3(0.16, 0.13, 0.09), gh2);
          }

          col = alb * (sun * hsb(0.045, 0.75, 1.0)
                     + skyAmb * duskHigh * 2.0
                     + dif * hsb(0.09, 0.50, 1.0)) * ao;
          col *= 1.0 - crev * 0.4;      // 溝のすす
          col *= 0.86 + 0.28 * grit;    // ざらつき
          // 濡れた石畳に夕陽が照り返す (リアリティの決定打)
          if (wet > 0.001) {
            float ws = pow(max(dot(reflect(rd, n), sunDir), 0.0), 30.0);
            col += hsb(0.06, 0.55, 1.0) * ws * wet * 1.1;
          }

          if (mat < 0.5) {
            // 窓明かり: くぼみ近傍 × 木格子マスク × バターランプの揺らぎ。bass で燃え上がる
            // 格子は柔らかく (硬い step だと切り絵になる)
            float lat = smoothstep(0.12, 0.38, fract(pos.z * 6.25)) * smoothstep(0.12, 0.38, fract(ly * 6.25));
            float flick = 0.82 + 0.18 * sin(u_time * 9.0 + pos.z * 4.71239);
            // 窓ごとの「灯りのある家・暗い家」: 全戸同じ明るさは団地。消えてる窓が路地を本物にする
            float lit = hash(vec2(floor(pos.z / 0.8), 11.0 + floor(ly)));
            lit = lit < 0.35 ? 0.06 : 0.35 + 0.65 * lit;
            // 2 段グロー: くっきりした芯 + 壁へ広く溢れる滲み (くっきりしすぎ対策)
            float core = pow(winGlow, 3.0) * (0.35 + 0.65 * lat);
            float halo = winGlow * winGlow * 0.5;
            col += hsb(0.075, 0.90, 1.0) * (core + halo) * flick * lit * (1.3 + u_bass * 1.7);
            // 夕陽の縁光り (同系色相、控えめ)
            float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
            col += hsb(0.075, 0.70, 1.0) * rim * 0.10;
          } else if (mat < 1.5) {
            // 窓明かりが石畳に落とす光だまり (暗い路地では床の光は窓由来が主役)
            float Wsh = u_width - 0.28 * (0.5 + 0.5 * sin(pos.z * 0.31415926));
            float wz = abs(mod(pos.z, 0.8) - 0.4);
            float px = Wsh - abs(pos.x - bendX(pos.z));
            float flick2 = 0.82 + 0.18 * sin(u_time * 9.0 + pos.z * 4.71239);
            float pool = exp(-wz * wz * 60.0) * exp(-px * px * 5.0);
            col += hsb(0.075, 0.85, 1.0) * pool * flick2 * (0.30 + u_bass * 0.7);
          } else {
            // 旗・電線の透過光 (薄い布は逆光で発色する)
            col += alb * 0.30;
          }

          // 拍の光パルス: バターランプ色の帯が路地の奥へ駆け抜ける
          // (アルベドに乗算 = 照明として当てる。生加算だと白に洗われる)
          for (int j = 0; j < 3; j++) {
            float pb = exp(-abs(u_pulseZ[j] - pos.z) * 2.2);
            col += alb * hsb(0.09, 0.55, 1.0) * pb * 0.9;
          }

          // 遠くは闇に沈む (夜の路地の奥は見えないから怖くて良い)
          col = mix(col, duskLow * 0.06, 1.0 - exp(-t * 0.10));
        } else {
          // 屋根の隙間から見える薄暮の空 / 路地の果ての夕焼け
          // (地平方向は壁のフォグ到達色に寄せて「果ての矩形」の浮きを消す)
          float h = clamp(rd.y * 1.8 + 0.15, 0.0, 1.0);
          col = mix(duskLow * 0.45, duskHigh, h);   // 空は相対的に明るく = 夕暮れのコントラスト
        }

        // 埃っぽい空気の光 (rms と拍で舞い上がる)
        col += hsb(0.08, 0.65, 1.0) * glowAcc * (0.20 + u_rms * 0.5 + u_beat * 0.5);
        // 窓明かりの光芒: 窓のそばの埃った空気が琥珀に光る
        float flickA = 0.85 + 0.15 * sin(u_time * 9.0);
        col += hsb(0.075, 0.85, 1.0) * min(airLight, 0.6) * flickA * (0.55 + u_bass * 0.8);

        // フィルミックトーンマップ (白飛びを構造的に防ぐ) + グレイン + ビネット + ガンマ
        col = 1.0 - exp(-max(col, 0.0) * 1.12);
        // フィルムグレイン: 毎フレーム揺れる微細ノイズ (デジタルの無菌感を消す)
        col *= 1.0 + (hash(gl_FragCoord.xy + fract(u_time * 7.13) * 61.7) - 0.5) * 0.14;
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
window.VJamFX.presets['kathmandu-alley'] = KathmanduAlleyPreset;
})();
