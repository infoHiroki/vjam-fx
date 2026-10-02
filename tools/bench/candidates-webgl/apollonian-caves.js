(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * apollonian-caves — アポロニウス充填フラクタルの洞窟を飛び続ける。
 *
 * Mandelbulb (物体を外から見る) に対して、これは「空間の中を旅する」レイマーチ。
 * 泡が無限に詰まった洞窟をカメラが前進し続け、終わりは来ない
 * (構造は周期 2 で無限反復、カメラ z は JS 側で wrap して精度を保つ)。
 *
 * 音 → 映像:
 *   beat   → 光のパルスがカメラを追い越して洞窟の奥へ駆け抜ける + 前進が加速
 *   bass   → フラクタルのスケールが呼吸し、泡の細胞が膨縮 + 細胞核の発光
 *   treble → パレットの色相シフト
 *   rms    → 巡航速度
 *
 * 技術:
 *   - 距離推定 = fract 折りたたみ 8 反復の Apollonian gasket (iq)
 *   - **JS 側にも同じ DE を実装し、カメラが壁を検知して勾配方向に避ける**
 *     (フラクタル内フライスルーの衝突回避。GPU と同じ数式を CPU でも評価)
 *   - orbit trap → IQ cosine palette / 歩数 AO / ヘッドライト / グロー蓄積
 *   - フィルミックトーンマップ 1-exp(-col) で白飛びを構造的に排除
 */
class ApollonianCavesPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this._shader = null;
    this._time = 0;
    this._z = 0;            // カメラ前進距離 (wrap する)
    this._offX = 0;         // 衝突回避の横オフセット (滑らかに追従)
    this._offY = 0;
    this._pulses = [-1e5, -1e5, -1e5]; // 拍パルスの z 位置 (新しい順)
    this._powPhase = 0;
    this.smoothBass = 0;
    this.kick = 0;
    this.beat = 0;
  }

  // GPU と同じ Apollonian DE を CPU でも評価 (カメラ衝突回避用)
  _de(x, y, z, s) {
    let scale = 1.0;
    for (let i = 0; i < 8; i++) {
      x = -1 + 2 * (x * 0.5 + 0.5 - Math.floor(x * 0.5 + 0.5));
      y = -1 + 2 * (y * 0.5 + 0.5 - Math.floor(y * 0.5 + 0.5));
      z = -1 + 2 * (z * 0.5 + 0.5 - Math.floor(z * 0.5 + 0.5));
      const r2 = Math.max(x * x + y * y + z * z, 1e-5);
      const k = s / r2;
      x *= k; y *= k; z *= k;
      scale *= k;
    }
    return 0.25 * Math.abs(y) / scale;
  }

  // 目標位置が壁に近すぎたら勾配 (数値微分) 方向へ押し出す
  _avoidWalls(bx, by, z, s) {
    const R = 0.15;   // カメラの安全半径
    let cx = bx + this._offX, cy = by + this._offY;
    for (let it = 0; it < 3; it++) {
      const d = this._de(cx, cy, z, s);
      if (d > R) break;
      const e = 0.01;
      const gx = this._de(cx + e, cy, z, s) - this._de(cx - e, cy, z, s);
      const gy = this._de(cx, cy + e, z, s) - this._de(cx, cy - e, z, s);
      const gl = Math.hypot(gx, gy) || 1;
      const push = (R - d) + 0.02;
      cx += (gx / gl) * push;
      cy += (gy / gl) * push;
    }
    // オフセットを滑らかに追従 (急ハンドルで酔わせない) + 暴走クランプ
    this._offX = Math.max(-0.8, Math.min(0.8, this._offX + (cx - bx - this._offX) * 0.25));
    this._offY = Math.max(-0.8, Math.min(0.8, this._offY + (cy - by - this._offY) * 0.25));
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
        preset._powPhase += 0.003;
        preset.smoothBass = preset.smoothBass + (preset.audio.bass - preset.smoothBass) * 0.1;
        preset.kick *= 0.94;
        preset.beat *= 0.88;

        // 前進: 巡航 + rms + 拍の加速。無音でも旅は続く (自律)
        preset._z += dt * (0.28 + preset.audio.rms * 0.22 + preset.kick * 0.8);
        for (let i = 0; i < 3; i++) preset._pulses[i] += dt * 1.7;
        // 周期 2 の構造なので z を 100 単位で wrap (精度維持、パルスも一緒に)
        if (preset._z > 100) {
          preset._z -= 100;
          for (let i = 0; i < 3; i++) preset._pulses[i] -= 100;
        }

        // フラクタルスケール: ゆっくり脈動 + bass で泡が膨縮
        const scale = 1.35 + Math.sin(preset._powPhase) * 0.08 + preset.smoothBass * 0.15;

        // カメラ: 蛇行する基準パス → 壁を検知して横に避ける (CPU 側 DE)
        const t0 = preset._time;
        const bx = 0.5 + Math.sin(t0 * 0.26) * 0.25;
        const by = 0.5 + Math.cos(t0 * 0.21) * 0.20;
        const [cx, cy] = preset._avoidWalls(bx, by, preset._z, scale);
        // 視線: やや先の基準パス (現在のオフセットを引き継いで滑らかに)
        const tx = 0.5 + Math.sin(t0 * 0.26 + 1.0) * 0.20 + preset._offX * 0.6;
        const ty = 0.5 + Math.cos(t0 * 0.21 + 0.8) * 0.16 + preset._offY * 0.6;

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_ro', [cx, cy, preset._z]);
          preset._shader.setUniform('u_ta', [tx, ty, preset._z + 1.4]);
          preset._shader.setUniform('u_scale', scale);
          preset._shader.setUniform('u_bass', preset.smoothBass);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_beat', preset.beat);
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
      uniform float u_scale;
      uniform float u_bass;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;
      uniform float u_pulseZ[3];

      float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453123); }

      // HSB → RGB (#391 mandelbulb で実証済みの発色。cosine palette は濁った)
      vec3 hsb(float h, float s, float b) {
        vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return b * mix(vec3(1.0), rgb, s);
      }

      float smax(float a, float b, float k) {
        float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) + k * h * (1.0 - h);
      }

      float g_trap; // orbit trap (map が書く)

      // Apollonian gasket 距離推定 (iq)。fract 折りたたみで空間ごと無限反復
      float map(vec3 q, float t) {
        vec3 z = q;
        float scale = 1.0;
        float tr = 1e5;
        for (int i = 0; i < 8; i++) {
          z = -1.0 + 2.0 * fract(0.5 * z + 0.5);
          float r2 = dot(z, z);
          tr = min(tr, r2);
          float k = u_scale / max(r2, 1e-5);
          z *= k;
          scale *= k;
        }
        g_trap = tr;
        float d = 0.25 * abs(z.y) / scale;
        // 保険の小さな削り (JS 側の衝突回避が主、これは残り香程度)
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
        vec3 wup = normalize(vec3(sin(u_time * 0.07) * 0.2, 1.0, 0.0)); // ゆるいロール
        vec3 rt = normalize(cross(wup, fw));
        vec3 up = cross(fw, rt);
        vec3 rd = normalize(fw * 1.25 + uv.x * rt + uv.y * up);

        // レイマーチ + グロー蓄積 (通過した薄い縁が光る)
        float t = hash(gl_FragCoord.xy) * 0.02;
        float glowAcc = 0.0;
        float stepsF = 0.0;
        bool hit = false;
        vec3 pos = ro;
        for (int i = 0; i < 90; i++) {
          pos = ro + rd * t;
          float d = map(pos, t);
          glowAcc += exp(-d * 55.0) * 0.012;
          if (d < 0.0008 * (1.0 + t)) { hit = true; break; }
          t += d * 0.9;
          stepsF += 1.0;
          if (t > 9.0) break;
        }
        glowAcc = min(glowAcc, 1.1);

        float hueShift = u_time * 0.015 + u_treble * 0.12;
        vec3 col = vec3(0.0);

        if (hit) {
          float trap = clamp(g_trap * 3.0, 0.0, 1.0);
          vec3 n = calcNormal(pos, t);

          // ヘッドライト (カメラ光源、距離減衰) + 弱い環境キーライト
          vec3 toCam = normalize(ro - pos);
          float head = 1.05 / (1.0 + t * t * 2.0);
          float dif = max(dot(n, toCam), 0.0) * head;
          float key = max(dot(n, normalize(vec3(0.4, 0.8, -0.3))), 0.0) * 0.2;
          float spe = pow(max(dot(reflect(rd, n), toCam), 0.0), 24.0) * head * 0.5;
          float ao = 0.2 + 0.8 * clamp(1.0 - stepsF / 90.0, 0.0, 1.0);

          // 色相 = trap + 空間位置 (単色に寄らせない: 進むと色域が移り変わる)
          float hue = fract(hueShift + trap * 0.5 + pos.z * 0.13
                            + dot(sin(pos.xy * 2.3), vec2(0.05)));
          vec3 base = hsb(hue, 0.9, 1.0);
          // 拡散は控えめの下地。主役は下の emissive (暗い洞窟 + 発光する脈)
          col = base * (dif + key) * ao + vec3(spe);
          // 細胞の核 (trap が小さい所) が発光する。bass で燃え上がる
          // ※発光とリムは基調色の同系統に揃える。補色を重ねると和が白に濁る
          col += hsb(fract(hue + 0.07), 0.9, 1.0) * pow(1.0 - trap, 3.0) * (0.45 + u_bass * 1.8);
          // エッジのネオンリム (輪郭が縁光りする)
          float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
          col += hsb(fract(hue + 0.14), 0.85, 1.0) * rim * 0.7;

          // 拍の光パルス: 色付きの光の帯が洞窟の奥へ駆け抜ける (白だと全部を洗う)
          for (int j = 0; j < 3; j++) {
            float pb = exp(-abs(u_pulseZ[j] - pos.z) * 2.6);
            col += hsb(fract(hueShift + 0.2), 0.55, 1.0) * pb * 0.5;
          }
        }

        // グロー (通過縁のネオン) + 距離フォグ (奥は黒でなく深い色の靄へ沈む)
        col += hsb(fract(hueShift + 0.15), 0.9, 1.0) * glowAcc * (0.9 + u_rms * 0.7 + u_beat * 0.7);
        vec3 fogCol = hsb(fract(hueShift + 0.6), 0.95, 1.0) * 0.12;
        col = mix(col, fogCol, 1.0 - exp(-t * 0.40));

        // フィルミックトーンマップ (白飛びを構造的に防ぐ) + ビネット + ガンマ
        col = 1.0 - exp(-max(col, 0.0) * 1.35);
        col *= 1.0 - 0.32 * dot(uv, uv);
        col = pow(col, vec3(0.9));
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

  // 拍 = 光パルスを前方へ放つ + 前進の加速
  onBeat(strength) {
    const st = Math.min(1, strength);
    this.beat = Math.min(1, this.beat + 0.5 + st * 0.5);
    this.kick = Math.min(1.3, this.kick + 0.3 + st * 0.5);
    this._pulses.pop();
    this._pulses.unshift(this._z + 0.4);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['apollonian-caves'] = ApollonianCavesPreset;
})();
