(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * warp-helix — アシッドグリーンのネオン螺旋トンネルを疾走する。
 *
 * apollonian-caves 系の「空間の中を旅する」レイマーチ。
 * 蛇行するトンネルの壁に螺旋の溝が刻まれ、3 条のネオンストリップが
 * 奥へ流れ続ける。DE が円筒 + sin 溝だけなので本シリーズ最軽量
 * (モバイルでも安定して回る想定)。
 *
 * 音 → 映像:
 *   beat   → ライムの光リングが奥へ駆け抜ける + 疾走が加速
 *   bass   → トンネルが締まる (半径ポンプ) + ストリップが燃え上がる
 *   treble → ストリップの流速 + 明滅
 *   rms    → 巡航速度 + グロー
 *
 * 技術:
 *   - DE = 半径 R の円筒 − 蛇行軸 + 螺旋溝 (sin 2 項)。Lipschitz 補正 0.7
 *   - 軸の蛇行・溝・ストリップの z 周波数は全て 2π/40 の整数倍 → z は 40 で wrap
 *   - カメラは軸そのものを追従 (構造的に壁に当たらない) + CPU 側 DE の保険
 *   - 光はライム系統に統一 (壁 0.32 / ストリップ 0.30 / リム 0.40 / パルス 0.26)
 *   - フィルミックトーンマップ 1-exp(-col) で白飛びを構造的に排除
 */
class WarpHelixPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this._shader = null;
    this._time = 0;
    this._z = 0;            // カメラ前進距離 (wrap する)
    this._offX = 0;
    this._offY = 0;
    this._pulses = [-1e5, -1e5, -1e5]; // 拍パルスの z 位置
    this._radPhase = 0;
    this._flow = 0;         // ストリップの流れ位相 (積分)
    this.smoothBass = 0;
    this.kick = 0;
    this.beat = 0;
  }

  // shader と同じトンネル軸の蛇行 (周期 40)
  _bend(z) {
    return [
      0.8 * Math.sin(z * 0.15708) + 0.4 * Math.sin(z * 0.31416 + 1.7),
      0.5 * Math.sin(z * 0.15708 + 0.9) + 0.25 * Math.sin(z * 0.31416 + 2.3),
    ];
  }

  // GPU と同じ円筒 DE の保守版 (溝ぶん 0.1 のマージン) をカメラ保険に使う
  _de(x, y, z, radius) {
    const [bx, by] = this._bend(z);
    return radius - 0.1 - Math.hypot(x - bx, y - by);
  }

  _avoidWalls(bx, by, z, radius) {
    const R = 0.18;
    let cx = bx + this._offX, cy = by + this._offY;
    for (let it = 0; it < 3; it++) {
      const d = this._de(cx, cy, z, radius);
      if (d > R) break;
      const e = 0.01;
      const gx = this._de(cx + e, cy, z, radius) - this._de(cx - e, cy, z, radius);
      const gy = this._de(cx, cy + e, z, radius) - this._de(cx, cy - e, z, radius);
      const gl = Math.hypot(gx, gy) || 1;
      const push = (R - d) + 0.02;
      cx += (gx / gl) * push;
      cy += (gy / gl) * push;
    }
    this._offX = Math.max(-0.6, Math.min(0.6, this._offX + (cx - bx - this._offX) * 0.25));
    this._offY = Math.max(-0.6, Math.min(0.6, this._offY + (cy - by - this._offY) * 0.25));
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
        preset._radPhase += 0.004;
        preset.smoothBass += (preset.audio.bass - preset.smoothBass) * 0.1;
        preset.kick *= 0.93;
        preset.beat *= 0.88;
        // ストリップの流速: treble で速く (位相は積分)
        preset._flow += dt * (0.35 + preset.audio.treble * 0.9);

        // 前進: 疾走 + rms + 拍の加速
        preset._z += dt * (1.3 + preset.audio.rms * 0.8 + preset.kick * 1.8);
        for (let i = 0; i < 3; i++) preset._pulses[i] += dt * 4.0;
        // 全 z 周波数は 2π/40 の整数倍なので 40 で wrap
        if (preset._z > 40) {
          preset._z -= 40;
          for (let i = 0; i < 3; i++) preset._pulses[i] -= 40;
        }

        // トンネル半径: ゆっくり呼吸 + bass で締まる
        const radius = 1.05 + Math.sin(preset._radPhase) * 0.08 - preset.smoothBass * 0.22;

        // カメラ: 蛇行軸を追従 (構造的に壁の中に入らない) + わずかな遊び
        const t0 = preset._time;
        const zc = preset._z;
        const [ax, ay] = preset._bend(zc);
        const bx = ax + Math.sin(t0 * 0.31) * 0.16;
        const by = ay + Math.cos(t0 * 0.27) * 0.13;
        const [cx, cy] = preset._avoidWalls(bx, by, zc, radius);
        // 視線はカーブの先 (曲がり込みの体感)
        const [tx0, ty0] = preset._bend(zc + 2.2);
        const tx = tx0 + preset._offX * 0.5;
        const ty = ty0 + preset._offY * 0.5;

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_ro', [cx, cy, zc]);
          preset._shader.setUniform('u_ta', [tx, ty, zc + 2.2]);
          preset._shader.setUniform('u_radius', radius);
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
      uniform float u_radius;
      uniform float u_flow;
      uniform float u_bass;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;
      uniform float u_pulseZ[3];

      float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453123); }

      vec3 hsb(float h, float s, float b) {
        vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return b * mix(vec3(1.0), rgb, s);
      }

      // トンネル軸の蛇行 (JS 側と同じ式、周期 40)
      vec2 bend(float z) {
        return vec2(0.8 * sin(z * 0.15708) + 0.4 * sin(z * 0.31416 + 1.7),
                    0.5 * sin(z * 0.15708 + 0.9) + 0.25 * sin(z * 0.31416 + 2.3));
      }

      float g_theta; // 交点の周方向角 (彩色に使う)

      // 円筒トンネル + 螺旋溝。z 周波数は全て 2π/40 の整数倍
      float map(vec3 p) {
        vec2 c = p.xy - bend(p.z);
        float r = length(c);
        float theta = atan(c.y, c.x);
        g_theta = theta;
        float groove = 0.06 * sin(theta * 6.0 + p.z * 0.9425)
                     + 0.03 * sin(theta * 14.0 - p.z * 1.5708);
        return u_radius - r + groove;
      }

      vec3 calcNormal(vec3 pos) {
        const float e = 0.0015;
        vec2 k = vec2(1.0, -1.0);
        return normalize(
          k.xyy * map(pos + k.xyy * e) +
          k.yyx * map(pos + k.yyx * e) +
          k.yxy * map(pos + k.yxy * e) +
          k.xxx * map(pos + k.xxx * e));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        vec3 ro = u_ro;
        vec3 fw = normalize(u_ta - ro);
        vec3 wup = normalize(vec3(sin(u_time * 0.09) * 0.35, 1.0, 0.0)); // ゆるいロール
        vec3 rt = normalize(cross(wup, fw));
        vec3 up = cross(fw, rt);
        vec3 rd = normalize(fw * 1.15 + uv.x * rt + uv.y * up);

        // レイマーチ (DE が軽いので 70 歩でも十分に速い)
        float t = hash(gl_FragCoord.xy) * 0.03;
        float stepsF = 0.0;
        bool hit = false;
        vec3 pos = ro;
        for (int i = 0; i < 70; i++) {
          pos = ro + rd * t;
          float d = map(pos);
          if (d < 0.0012 * (1.0 + t)) { hit = true; break; }
          t += d * 0.7; // 蛇行 + 溝で DE が非厳密なので控えめに進む
          stepsF += 1.0;
          if (t > 14.0) break;
        }
        float theta = g_theta;

        vec3 col = vec3(0.0);
        float hueShift = sin(u_time * 0.06) * 0.03 + u_treble * 0.05;

        if (hit) {
          vec3 n = calcNormal(pos);
          vec3 toCam = normalize(ro - pos);

          float head = 0.9 / (1.0 + t * t * 0.28);
          float dif = max(dot(n, toCam), 0.0) * head;
          float ao = 0.25 + 0.75 * clamp(1.0 - stepsF / 70.0, 0.0, 1.0);

          // 壁: ほぼ黒に沈む深緑。ネオンの下地 (単色化は hue の空間項で防ぐ)
          float hue = fract(0.32 + hueShift
                            + sin(theta * 2.0) * 0.03
                            + sin(pos.z * 0.15708) * 0.03);
          vec3 base = hsb(hue, 0.75, 0.35);
          col = base * (dif * 0.4 + 0.03) * ao;

          // リブ線: 溝の稜線が細く光り、消失点へ収束する遠近の手掛かりになる
          float rib = smoothstep(0.85, 0.98, sin(theta * 14.0 - pos.z * 1.5708));
          col += hsb(fract(0.34 + hueShift), 0.9, 1.0) * rib * 0.14 * (0.4 + 0.6 * head);

          // ネオンストリップ: 3 条の螺旋が奥へ流れる。bass で燃え上がる
          // (ストリップ・リムは同系色相。補色を重ねると白に濁る)
          float sp = fract(theta * 0.47746 + pos.z * 0.15 - u_flow);
          float band = min(sp, 1.0 - sp);
          float strip = smoothstep(0.07, 0.02, band);
          float flick = 0.85 + 0.15 * sin(u_time * 11.0 + theta * 3.0);
          col += hsb(fract(0.30 + hueShift), 0.95, 1.0) * strip * flick
               * (0.45 + u_bass * 1.8) * (0.25 + 0.75 * head);

          // 溝のエッジリム (ティール寄り +0.08)
          float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
          col += hsb(fract(0.40 + hueShift), 0.8, 1.0) * rim * 0.35;

          // 拍の光リング: ライムの帯が奥へ駆け抜ける
          for (int j = 0; j < 3; j++) {
            float pb = exp(-abs(u_pulseZ[j] - pos.z) * 1.8);
            col += hsb(fract(0.26 + hueShift), 0.6, 1.0) * pb * 0.8;
          }

          // 奥は深い緑黒の靄へ (miss 色と同じ = 消失点もステップ枯渇も浮かない)
          col = mix(col, hsb(0.36, 0.9, 0.05), 1.0 - exp(-t * 0.30));
        } else {
          col = hsb(0.36, 0.9, 0.05); // トンネルの果て (フォグ到達色と一致)
        }

        // 全体グロー (rms と拍で空気が光る)
        col += hsb(fract(0.30 + hueShift), 0.85, 1.0)
             * (0.03 + u_rms * 0.05 + u_beat * 0.05);

        // フィルミックトーンマップ + ビネット + ガンマ
        col = 1.0 - exp(-max(col, 0.0) * 1.35);
        col *= 1.0 - 0.30 * dot(uv, uv);
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

  // 拍 = 光リングを前方へ放つ + 疾走の加速
  onBeat(strength) {
    const st = Math.min(1, strength);
    this.beat = Math.min(1, this.beat + 0.5 + st * 0.5);
    this.kick = Math.min(1.4, this.kick + 0.35 + st * 0.55);
    this._pulses.pop();
    this._pulses.unshift(this._z + 0.6);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['warp-helix'] = WarpHelixPreset;
})();
