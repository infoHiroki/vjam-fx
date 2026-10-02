(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * mandelbulb — GPU レイマーチングによる 3D フラクタル (Mandelbulb)。
 *
 * 1 ピクセルごとに光線を飛ばし、距離推定 (DE) でフラクタル表面を探す
 * レイマーチング。ポリゴンは 1 枚も無い — 形は全て数式。
 *
 * 音 → 映像:
 *   bass   → フラクタルの次数 (power) が上がり、瘤が増殖して形が変わる
 *   beat   → カメラが突っ込む (ドリーパンチ) + リムライト閃光
 *   treble → 公転の速さ + 色相シフト + 背景の星の瞬き
 *   rms    → シルエットの光輪 (glow)
 *
 * WebGL1 制約対応: int ループ固定上限 / dFdx 不使用 (四面体サンプリング法線) /
 * hash は使用型ぶんオーバーロード定義。
 */
class MandelbulbPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this._shader = null;
    this._time = 0;
    this._yaw = 0;
    this._powPhase = 0;
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
        p.pixelDensity(1); // レイマーチは画素数に比例して重い。DPR 1 固定
      };

      p.draw = () => {
        if (!preset._shader) { preset._shader = preset._initShader(p); if (!preset._shader) return; }

        // 自律: 無音でも回り、power もゆっくり脈動する
        preset._time += 0.016;
        preset._yaw += 0.004 + preset.audio.treble * 0.004;
        preset._powPhase += 0.004;
        preset.smoothBass = preset.smoothBass + (preset.audio.bass - preset.smoothBass) * 0.1;
        preset.beat *= 0.88;
        preset.kick *= 0.93;

        // 次数: 8 を中心にゆっくり脈動 + bass で瘤が増える (Mandelbulb 最大の見せ場)
        const power = 8.0 + Math.sin(preset._powPhase) * 1.2 + preset.smoothBass * 1.8;
        const pitch = Math.sin(preset._time * 0.13) * 0.35 + 0.1;
        const camR = Math.max(2.15, 3.15 - preset.kick * 0.7);

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_yaw', preset._yaw);
          preset._shader.setUniform('u_pitch', pitch);
          preset._shader.setUniform('u_camR', camR);
          preset._shader.setUniform('u_power', power);
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
      uniform float u_power;
      uniform float u_bass;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;

      // hash: 使う型ぶんオーバーロード定義 (WebGL1 の掟)
      float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453123); }

      vec3 hsb(float h, float s, float b) {
        vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return b * mix(vec3(1.0), rgb, s);
      }

      // Mandelbulb 距離推定 (DE)。trap = 反復中の最小半径 (orbit trap、彩色に使う)
      float mapDE(vec3 pos, out float trap) {
        // 本体をゆっくり自転させる (カメラ公転と別軸)
        float ca = cos(u_time * 0.07), sa = sin(u_time * 0.07);
        pos = vec3(pos.x * ca - pos.z * sa, pos.y, pos.x * sa + pos.z * ca);

        vec3 z = pos;
        float dr = 1.0;
        float r = length(z);
        trap = r;
        for (int i = 0; i < 7; i++) {
          r = length(z);
          if (r > 2.0) break;
          trap = min(trap, r);
          float rr = max(r, 1e-4);
          float theta = acos(clamp(z.z / rr, -1.0, 1.0)) * u_power;
          float phi = atan(z.y, z.x) * u_power;
          float zr = pow(rr, u_power);
          dr = pow(rr, u_power - 1.0) * u_power * dr + 1.0;
          z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta)) + pos;
        }
        return 0.5 * log(max(r, 1e-4)) * r / dr;
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

        // カメラ: 原点の bulb を公転。beat のドリーパンチは u_camR (JS 側) が担う
        float cp = cos(u_pitch), sp = sin(u_pitch);
        vec3 ro = vec3(cos(u_yaw) * cp, sp, sin(u_yaw) * cp) * u_camR;
        vec3 fw = normalize(-ro);
        vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
        vec3 up = cross(fw, rt);
        vec3 rd = normalize(fw * 1.4 + uv.x * rt + uv.y * up);

        // レイマーチ: 縞防止に開始距離をディザ
        float t = hash(gl_FragCoord.xy) * 0.02;
        float trap = 1e5;
        float minD = 1e5;   // 最接近距離 (外れた光線の glow 用)
        float stepsF = 0.0;
        bool hit = false;
        vec3 pos = ro;
        for (int i = 0; i < 72; i++) {
          pos = ro + rd * t;
          float tr;
          float d = mapDE(pos, tr);
          minD = min(minD, d);
          if (d < 0.0012) { trap = tr; hit = true; break; }
          t += d;
          stepsF += 1.0;
          if (t > 6.0) break;
        }

        vec3 col = vec3(0.0);
        float baseHue = fract(u_time * 0.01);

        if (hit) {
          vec3 n = calcNormal(pos);
          vec3 lig = normalize(vec3(0.6, 0.7, -0.4));
          float dif = max(dot(n, lig), 0.0);
          float bac = max(dot(n, -lig), 0.0) * 0.2;              // 弱い逆光フィル
          float spe = pow(max(dot(reflect(rd, n), lig), 0.0), 24.0);
          float ao = 0.35 + 0.65 * clamp(1.0 - stepsF / 72.0, 0.0, 1.0); // 歩数 AO (襞の奥だけ暗く)
          float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);

          // orbit trap → 色相: 襞の深さで色が変わる (範囲広め)。treble でシフト
          float hue = fract(baseHue + trap * 0.7 + u_treble * 0.15);
          vec3 base = hsb(hue, 0.7, 1.0);
          col = base * (0.22 + 0.85 * dif) * ao
              + base * bac
              + vec3(1.0) * spe * 0.8
              + hsb(fract(hue + 0.5), 0.6, 1.0) * rim * (0.4 + u_beat * 1.8); // 拍でリム閃光
          col *= 1.15 + u_bass * 0.4;                              // bass で全体が息づく
          col = mix(col, vec3(0.0), 1.0 - exp(-t * 0.18));         // 距離フォグ
        } else {
          // 外れた光線: シルエットの光輪 (最接近距離が小さいほど明るい)
          float glow = pow(clamp(1.0 - minD * 2.2, 0.0, 1.0), 3.5);
          col += hsb(fract(baseHue + 0.08), 0.8, 1.0) * glow * (0.30 + u_rms * 0.8 + u_beat * 0.7);
          // 背景の星: 方向を格子化して hash。treble で瞬く
          vec2 sph = vec2(atan(rd.z, rd.x), asin(clamp(rd.y, -1.0, 1.0)));
          vec2 cell = floor(sph * 40.0);
          vec2 f = fract(sph * 40.0) - 0.5;
          float h = hash(cell);
          float star = smoothstep(0.08, 0.0, length(f)) * step(0.982, h);
          col += vec3(star) * (0.35 + 0.65 * sin(u_time * 3.0 + h * 40.0))
               * (0.35 + u_treble * 0.8);
        }

        // ビネット + ガンマで締める
        col *= 1.0 - 0.35 * dot(uv, uv);
        col = pow(max(col, 0.0), vec3(0.85));
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
window.VJamFX.presets['mandelbulb'] = MandelbulbPreset;
})();
