(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * gyroid-flux — ジャイロイド極小曲面の無限迷宮をエネルギーが流れる。
 *
 * apollonian-caves / kathmandu-alley と同じ「空間の中を旅する」レイマーチ。
 * ジャイロイド (sin·cos の三重和の零面) が作る規則格子の水路を前進し続ける。
 * 曲面上を第 2 ジャイロイドの零線 = 発光する脈が前方へ流れる。
 *
 * 音 → 映像:
 *   beat   → ティール色の光パルスが水路の奥へ駆け抜ける + 前進加速
 *   bass   → 曲面が厚くなり空間が締まる + 脈が燃え上がる
 *   treble → 色相シフト + 脈の流速
 *   rms    → 巡航速度 + グロー
 *
 * 技術:
 *   - DE = 0.7·(|gyroid(q)| − th)/K。q = p·2 で周期 π、z は 12π で wrap
 *   - q 空間の直線 (π/2, 0, z) 上では g ≡ 1 (恒等的に水路の深部) —
 *     world (π/4, 0) を基準パスに取り、蛇行 + CPU 側衝突回避で有機的に泳ぐ
 *   - 発光脈 = 倍周波の第 2 ジャイロイド |g2| < ε の零線。位相は積分で前進
 *   - 光は寒色系統に統一 (面 0.55 / 脈 0.48 / リム 0.62 / パルス 0.50)
 *   - フィルミックトーンマップ 1-exp(-col) で白飛びを構造的に排除
 */
class GyroidFluxPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this._shader = null;
    this._time = 0;
    this._z = 0;            // カメラ前進距離 (wrap する)
    this._offX = 0;         // 衝突回避オフセット
    this._offY = 0;
    this._pulses = [-1e5, -1e5, -1e5]; // 拍パルスの z 位置
    this._thPhase = 0;
    this._flow = 0;         // 脈の流れ位相 (積分)
    this.smoothBass = 0;
    this.kick = 0;
    this.beat = 0;
  }

  // GPU と同じジャイロイド DE を CPU でも評価 (カメラ衝突回避用)
  _de(x, y, z, th) {
    const K = 2.0;
    const qx = x * K, qy = y * K, qz = z * K;
    const g = Math.sin(qx) * Math.cos(qy)
            + Math.sin(qy) * Math.cos(qz)
            + Math.sin(qz) * Math.cos(qx);
    return 0.7 * (Math.abs(g) - th) / K;
  }

  // 目標位置が曲面に近すぎたら勾配 (数値微分) 方向へ押し出す
  _avoidWalls(bx, by, z, th) {
    const R = 0.15;   // カメラの安全半径
    let cx = bx + this._offX, cy = by + this._offY;
    for (let it = 0; it < 4; it++) {
      const d = this._de(cx, cy, z, th);
      if (d > R) break;
      const e = 0.01;
      const gx = this._de(cx + e, cy, z, th) - this._de(cx - e, cy, z, th);
      const gy = this._de(cx, cy + e, z, th) - this._de(cx, cy - e, z, th);
      const gl = Math.hypot(gx, gy) || 1;
      const push = (R - d) + 0.02;
      cx += (gx / gl) * push;
      cy += (gy / gl) * push;
    }
    this._offX = Math.max(-1.0, Math.min(1.0, this._offX + (cx - bx - this._offX) * 0.25));
    this._offY = Math.max(-1.0, Math.min(1.0, this._offY + (cy - by - this._offY) * 0.25));
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
        preset._thPhase += 0.0035;
        preset.smoothBass += (preset.audio.bass - preset.smoothBass) * 0.1;
        preset.kick *= 0.94;
        preset.beat *= 0.88;
        // 脈の流速: treble で速くなる (位相は積分、除算の余りで作らない)
        preset._flow += dt * (0.9 + preset.audio.treble * 1.6);

        // 前進: 巡航 + rms + 拍の加速。無音でも旅は続く (自律)
        preset._z += dt * (0.55 + preset.audio.rms * 0.40 + preset.kick * 0.85);
        for (let i = 0; i < 3; i++) preset._pulses[i] += dt * 2.0;
        // 構造周期 π (K=2)。z は 12π で wrap (整数倍なのでシームレス)
        const WRAP = 37.699112;
        if (preset._z > WRAP) {
          preset._z -= WRAP;
          for (let i = 0; i < 3; i++) preset._pulses[i] -= WRAP;
        }

        // 曲面の厚み: 薄い殻 = 隣のセルへ抜ける穴が多く、格子の奥行きが見える。
        // ゆっくり呼吸 + bass で厚くなり空間が締まる (通路が塞がらない上限)
        const th = 0.25 + Math.sin(preset._thPhase) * 0.05 + preset.smoothBass * 0.10;

        // カメラ: g≡1 の開水路 (q空間 x=π/2 → world x=π/4) を軸に蛇行 → 曲面を避ける
        const t0 = preset._time;
        const bx = 0.7854 + Math.sin(t0 * 0.19) * 0.15;
        const by = Math.cos(t0 * 0.16) * 0.12;
        const [cx, cy] = preset._avoidWalls(bx, by, preset._z, th);
        const tx = 0.7854 + Math.sin((t0 + 2.2) * 0.19) * 0.12 + preset._offX * 0.6;
        const ty = Math.cos((t0 + 1.8) * 0.16) * 0.10 + preset._offY * 0.6;

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_ro', [cx, cy, preset._z]);
          preset._shader.setUniform('u_ta', [tx, ty, preset._z + 1.6]);
          preset._shader.setUniform('u_th', th);
          preset._shader.setUniform('u_flow', preset._flow);
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
      uniform float u_th;
      uniform float u_flow;
      uniform float u_bass;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;
      uniform float u_pulseZ[3];

      float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453123); }

      // HSB → RGB (mandelbulb / apollonian で実証済みの発色)
      vec3 hsb(float h, float s, float b) {
        vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return b * mix(vec3(1.0), rgb, s);
      }

      float smax(float a, float b, float k) {
        float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) + k * h * (1.0 - h);
      }

      float gyroid(vec3 q) {
        return sin(q.x) * cos(q.y) + sin(q.y) * cos(q.z) + sin(q.z) * cos(q.x);
      }

      float g_val; // 交点でのジャイロイド値 (彩色に使う)

      // K = 2 → 周期 π。z は JS 側の 12π wrap とシームレス
      float map(vec3 p, float t) {
        vec3 q = p * 2.0;
        float g = gyroid(q);
        g_val = g;
        float d = 0.7 * (abs(g) - u_th) / 2.0;
        // 細かい二次うねり (膜の表情。q*3 = 周期 π/3 で wrap 整合、時間で漂う)
        d += 0.015 * gyroid(q * 3.0 + vec3(u_time * 0.10));
        // 保険の小さな削り (JS 側の衝突回避が主)
        return smax(d, 0.08 - t, 0.04);
      }

      vec3 calcNormal(vec3 pos, float t) {
        const float e = 0.0012;
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
        vec3 wup = normalize(vec3(sin(u_time * 0.06) * 0.25, 1.0, 0.0)); // ゆるいロール
        vec3 rt = normalize(cross(wup, fw));
        vec3 up = cross(fw, rt);
        vec3 rd = normalize(fw * 1.15 + uv.x * rt + uv.y * up);

        // レイマーチ + 通過グロー蓄積
        float t = hash(gl_FragCoord.xy) * 0.02;
        float glowAcc = 0.0;
        float stepsF = 0.0;
        bool hit = false;
        vec3 pos = ro;
        for (int i = 0; i < 80; i++) {
          pos = ro + rd * t;
          float d = map(pos, t);
          glowAcc += exp(-d * 50.0) * 0.002;
          if (d < 0.0009 * (1.0 + t)) { hit = true; break; }
          t += d * 0.85;
          stepsF += 1.0;
          if (t > 12.0) break;
        }
        glowAcc = min(glowAcc, 0.35); // かすめ光線の蓄積で空間が白く洗われるのを防ぐ
        float gHit = g_val;

        // 色相は寒色帯に留める (単調ドリフトだと 80 秒で全色相を一周して作品性が消える)
        float hueShift = sin(u_time * 0.05) * 0.05 + u_treble * 0.10;
        vec3 col = vec3(0.0);

        if (hit) {
          vec3 n = calcNormal(pos, t);
          vec3 toCam = normalize(ro - pos);

          // ヘッドライト (距離減衰は緩め = 奥のセルまで照らして網目を見せる) + キーライト
          float head = 0.8 / (1.0 + t * t * 0.5);
          float dif = max(dot(n, toCam), 0.0) * head;
          float key = max(dot(n, normalize(vec3(0.5, 0.7, -0.3))), 0.0) * 0.25;
          float spe = pow(max(dot(reflect(rd, n), toCam), 0.0), 20.0) * head * 0.5;
          float ao = 0.22 + 0.78 * clamp(1.0 - stepsF / 80.0, 0.0, 1.0);

          // 色相 = 基調 0.55 + g 値 + 空間項 (単色化を防ぐ。x,y ベースなので wrap 非依存)
          float hue = fract(0.55 + hueShift
                            + (1.5 - abs(gHit)) * 0.06
                            + sin(pos.x * 1.3 + pos.y * 1.7) * 0.04);
          // 拡散は暗めの下地。主役は下の発光脈 (暗い迷宮 + 流れるエネルギー)
          vec3 base = hsb(hue, 0.85, 1.0);
          col = base * (dif * 0.55 + key) * ao + vec3(spe) * 0.5;

          // 発光脈: 倍周波の第 2 ジャイロイド零線がエネルギーとして流れる
          // (発光は基調の同系色相 −0.07。補色を重ねると白に濁る)
          float g2 = gyroid(pos * 4.0 + vec3(0.0, 0.0, -u_flow));
          float vein = smoothstep(0.20, 0.02, abs(g2));
          col += hsb(fract(hue - 0.07), 0.85, 1.0) * vein * (0.60 + u_bass * 1.8) * ao;

          // エッジのリム (青紫側へ +0.07)
          float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
          col += hsb(fract(hue + 0.07), 0.75, 1.0) * rim * 0.55;

          // 拍の光パルス: ティールの光の帯が水路の奥へ駆け抜ける
          for (int j = 0; j < 3; j++) {
            float pb = exp(-abs(u_pulseZ[j] - pos.z) * 2.4);
            col += hsb(fract(hueShift + 0.50), 0.55, 1.0) * pb * 0.55;
          }
        }

        // 通過グロー + 距離フォグ (奥は深いインディゴの靄へ。網目が読める程度に薄く)
        col += hsb(fract(hueShift + 0.48), 0.85, 1.0) * glowAcc * (0.55 + u_rms * 0.7 + u_beat * 0.6);
        vec3 fogCol = hsb(fract(hueShift + 0.65), 0.9, 1.0) * 0.10;
        col = mix(col, fogCol, 1.0 - exp(-t * 0.17));

        // フィルミックトーンマップ + ビネット + ガンマ
        col = 1.0 - exp(-max(col, 0.0) * 1.35);
        col *= 1.0 - 0.32 * dot(uv, uv);
        col = pow(col, vec3(0.88));
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
window.VJamFX.presets['gyroid-flux'] = GyroidFluxPreset;
})();
