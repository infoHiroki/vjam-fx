(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * quaternion-julia — 4 次元 Julia 集合。うねり続ける生命体のような塊。
 *
 * mandelbulb と同じ「物体を外から眺める」レイマーチ。
 * 四元数の z → z² + c を反復した集合の 3D 断面。Julia 定数 c が
 * ゆっくり軌道を描き、bass が c を押すことで形そのものが常時 morph する
 * (「形が変わるのが一番伝わる」の極致)。
 *
 * 音 → 映像:
 *   bass   → Julia 定数 c が動き、塊が伸び・ちぎれ・融合する
 *   beat   → カメラが突っ込む (ドリーパンチ) + リムライト閃光
 *   treble → c の軌道速度 + 色相の揺らぎ
 *   rms    → シルエットの光輪 (glow)
 *
 * 技術:
 *   - DE = 0.25·|z|·log|z²|/|z'| (iq の quaternion Julia 距離推定)
 *   - c は「肥えた」領域 (-0.28, 0.42, 0.28, 0.10) を小半径で周回 —
 *     集合が塵に痩せて画面が空になるのを防ぐ
 *   - orbit trap (反復中の最小 |z|²) → マゼンタ〜バイオレット帯の彩色
 *   - 光は同系統に統一 (拡散 0.88 / 発光 0.93 / リム 0.80)
 *   - フィルミックトーンマップ 1-exp(-col) で白飛びを構造的に排除
 */
class QuaternionJuliaPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this._shader = null;
    this._time = 0;
    this._yaw = 0;
    this._cPhase = 0;   // c の軌道位相 (積分)
    this.smoothBass = 0;
    this.beat = 0;   // リム閃光 (速い減衰)
    this.kick = 0;   // ドリーパンチ (遅い減衰)
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

        // 自律: 無音でも公転し、c も軌道を描き続ける
        preset._time += 0.016;
        preset._yaw += 0.0045;
        preset._cPhase += 0.0016 * (1.0 + preset.audio.treble * 1.5);
        preset.smoothBass += (preset.audio.bass - preset.smoothBass) * 0.08;
        preset.beat *= 0.88;
        preset.kick *= 0.93;

        // Julia 定数: 肥えた領域を小半径で周回 + bass が押して形が morph
        const ph = preset._cPhase;
        const c = [
          -0.28 + Math.sin(ph * 1.00) * 0.10 + preset.smoothBass * 0.12,
           0.42 + Math.cos(ph * 0.77) * 0.10,
           0.28 + Math.sin(ph * 0.53) * 0.09 - preset.smoothBass * 0.10,
           0.10 + Math.cos(ph * 1.31) * 0.07,
        ];
        const pitch = Math.sin(preset._time * 0.12) * 0.38 + 0.05;
        const camR = Math.max(2.0, 2.9 - preset.kick * 0.6);

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_yaw', preset._yaw);
          preset._shader.setUniform('u_pitch', pitch);
          preset._shader.setUniform('u_camR', camR);
          preset._shader.setUniform('u_c', c);
          preset._shader.setUniform('u_bass', preset.smoothBass);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_beat', preset.beat);
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
      uniform float u_yaw;
      uniform float u_pitch;
      uniform float u_camR;
      uniform vec4  u_c;
      uniform float u_bass;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;

      float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453123); }

      vec3 hsb(float h, float s, float b) {
        vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return b * mix(vec3(1.0), rgb, s);
      }

      // 四元数の 2 乗
      vec4 qsqr(vec4 a) {
        return vec4(a.x * a.x - dot(a.yzw, a.yzw), 2.0 * a.x * a.yzw);
      }

      // quaternion Julia 距離推定 (iq)。trap = 反復中の最小 |z|²
      float mapDE(vec3 pos, out float trap) {
        // 本体をゆっくり自転 (公転とは別軸)
        float ca = cos(u_time * 0.05), sa = sin(u_time * 0.05);
        pos = vec3(pos.x * ca - pos.z * sa, pos.y, pos.x * sa + pos.z * ca);

        vec4 z = vec4(pos, 0.0);
        float md2 = 1.0;
        float mz2 = dot(z, z);
        trap = mz2;
        for (int i = 0; i < 9; i++) {
          md2 *= 4.0 * mz2;      // z' = 2·z·z' → |z'|² 更新
          z = qsqr(z) + u_c;
          mz2 = dot(z, z);
          trap = min(trap, mz2);
          if (mz2 > 4.0) break;
        }
        return 0.25 * sqrt(mz2 / max(md2, 1e-20)) * log(max(mz2, 1e-8));
      }

      // 法線: 四面体サンプリング (dFdx が使えない WebGL1 の定番)
      vec3 calcNormal(vec3 pos) {
        float t;
        const float e = 0.0015;
        vec2 k = vec2(1.0, -1.0);
        return normalize(
          k.xyy * mapDE(pos + k.xyy * e, t) +
          k.yyx * mapDE(pos + k.yyx * e, t) +
          k.yxy * mapDE(pos + k.yxy * e, t) +
          k.xxx * mapDE(pos + k.xxx * e, t));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // カメラ: 塊を公転。beat のドリーパンチは u_camR (JS 側) が担う
        float cp = cos(u_pitch), sp = sin(u_pitch);
        vec3 ro = vec3(cos(u_yaw) * cp, sp, sin(u_yaw) * cp) * u_camR;
        vec3 fw = normalize(-ro);
        vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
        vec3 up = cross(fw, rt);
        vec3 rd = normalize(fw * 1.4 + uv.x * rt + uv.y * up);

        // レイマーチ: 縞防止に開始距離をディザ
        float t = hash(gl_FragCoord.xy) * 0.02;
        float trap = 1e5;
        float minD = 1e5;
        float stepsF = 0.0;
        bool hit = false;
        vec3 pos = ro;
        for (int i = 0; i < 72; i++) {
          pos = ro + rd * t;
          float tr;
          float d = mapDE(pos, tr);
          minD = min(minD, d);
          if (d < 0.0014) { trap = tr; hit = true; break; }
          t += d * 0.9; // Julia の DE はやや楽観的なので控えめに進む
          stepsF += 1.0;
          if (t > 6.0) break;
        }

        vec3 col = vec3(0.0);
        float hueDrift = sin(u_time * 0.04) * 0.04 + u_treble * 0.06;

        if (hit) {
          vec3 n = calcNormal(pos);
          vec3 lig = normalize(vec3(0.55, 0.7, -0.4));
          float dif = max(dot(n, lig), 0.0);
          float bac = max(dot(n, -lig), 0.0) * 0.22;
          float spe = pow(max(dot(reflect(rd, n), lig), 0.0), 28.0);
          float ao = 0.30 + 0.70 * clamp(1.0 - stepsF / 72.0, 0.0, 1.0);
          float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);

          // orbit trap → マゼンタ〜バイオレット帯 (0.78-0.98)。treble で揺らぐ
          float hue = fract(0.78 + clamp(trap, 0.0, 1.0) * 0.20 + hueDrift);
          vec3 base = hsb(hue, 0.75, 1.0);
          col = base * (0.24 + 0.85 * dif) * ao
              + base * bac
              + vec3(spe) * 0.7;
          // 襞の深部 (trap 小) が内側から発光。bass で燃え上がる (同系 +0.05)
          col += hsb(fract(hue + 0.05), 0.85, 1.0)
               * pow(clamp(1.0 - trap * 2.2, 0.0, 1.0), 3.0)
               * (0.35 + u_bass * 1.6);
          // リム: 拍で輪郭が閃光 (同系 −0.08 のバイオレット)
          col += hsb(fract(hue - 0.08), 0.7, 1.0) * rim * (0.35 + u_beat * 1.8);

          col = mix(col, vec3(0.0), 1.0 - exp(-t * 0.20)); // 距離フォグ (黒へ)
        } else {
          // 外れた光線: 光輪 (最接近距離が小さいほど明るい)
          float glow = pow(clamp(1.0 - minD * 2.4, 0.0, 1.0), 3.5);
          col += hsb(fract(0.88 + hueDrift), 0.8, 1.0) * glow
               * (0.30 + u_rms * 0.8 + u_beat * 0.7);
          // 背景: 淡い星 (格子 hash)。treble で瞬く
          vec2 sph = vec2(atan(rd.z, rd.x), asin(clamp(rd.y, -1.0, 1.0)));
          vec2 cell = floor(sph * 42.0);
          vec2 f = fract(sph * 42.0) - 0.5;
          float h = hash(cell);
          float star = smoothstep(0.07, 0.0, length(f)) * step(0.984, h);
          col += hsb(fract(0.82 + h * 0.15), 0.5, 1.0) * star
               * (0.35 + 0.65 * sin(u_time * 3.0 + h * 40.0))
               * (0.3 + u_treble * 0.8);
        }

        // フィルミックトーンマップ + ビネット + ガンマ
        col = 1.0 - exp(-max(col, 0.0) * 1.30);
        col *= 1.0 - 0.33 * dot(uv, uv);
        col = pow(col, vec3(0.87));
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

  // 拍 = カメラのドリーパンチ + リム閃光
  onBeat(strength) {
    const st = Math.min(1, strength);
    this.beat = Math.min(1, this.beat + 0.5 + st * 0.5);
    this.kick = Math.min(1.2, this.kick + 0.35 + st * 0.55);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['quaternion-julia'] = QuaternionJuliaPreset;
})();
