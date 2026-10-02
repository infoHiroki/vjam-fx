(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * menger-temple — 熾火を内包した黒曜石のメンガースポンジ神殿。
 *
 * mandelbulb と同じ「物体を外から眺める」レイマーチ。
 * 暗い石の立方体フラクタルを公転し、十字の穴の奥から
 * マグマ色の光が漏れる。bass で穴が侵食されて構造が組み変わる。
 *
 * 音 → 映像:
 *   bass   → 穴のサイズが連続 morph (構造が侵食される) + 熾火が燃え上がる
 *   beat   → カメラが突っ込む (ドリーパンチ) + リムライト閃光
 *   treble → 公転の速さ + 熾火の瞬き
 *   rms    → シルエットの光輪 (glow)
 *
 * 技術:
 *   - DE = 標準 Menger fold 5 反復。穴の太さ u_hole を uniform 化して
 *     bass で連続的に侵食 (iteration 切替でなくパラメータ morph なので滑らか)
 *   - orbit trap (fold セル中心への近さ) → 穴の縁ほど熾火が強い
 *   - 光は熾火系統に統一 (熾火 0.03-0.08 / リム 0.08)。石はほぼ無彩色の
 *     アルベドなので加算で濁らない
 *   - フィルミックトーンマップ 1-exp(-col) で白飛びを構造的に排除
 */
class MengerTemplePreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this._shader = null;
    this._time = 0;
    this._yaw = 0;
    this._holePhase = 0;
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

        // 自律: 無音でも公転し、穴もゆっくり脈動する
        preset._time += 0.016;
        preset._yaw += 0.0035 + preset.audio.treble * 0.004;
        preset._holePhase += 0.003;
        preset.smoothBass += (preset.audio.bass - preset.smoothBass) * 0.1;
        preset.beat *= 0.88;
        preset.kick *= 0.93;

        // 穴の太さ: ゆっくり脈動 + bass で侵食が進む (メンガー最大の見せ場)
        const hole = 1.02 + Math.sin(preset._holePhase) * 0.08 + preset.smoothBass * 0.30;
        const pitch = Math.sin(preset._time * 0.11) * 0.4 + 0.15;
        const camR = Math.max(3.6, 5.0 - preset.kick * 0.9);

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_yaw', preset._yaw);
          preset._shader.setUniform('u_pitch', pitch);
          preset._shader.setUniform('u_camR', camR);
          preset._shader.setUniform('u_hole', Math.min(hole, 1.42));
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
      uniform float u_hole;
      uniform float u_bass;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;

      float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453123); }

      vec3 hsb(float h, float s, float b) {
        vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return b * mix(vec3(1.0), rgb, s);
      }

      float sdBox(vec3 p, vec3 b) {
        vec3 q = abs(p) - b;
        return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
      }

      // Menger sponge DE。u_hole が十字の太さ = 侵食度。trap = fold セル軸への近さ
      float mapDE(vec3 pos, out float trap) {
        // 本体をゆっくり自転 (公転とは別軸)
        float ca = cos(u_time * 0.06), sa = sin(u_time * 0.06);
        pos = vec3(pos.x * ca - pos.z * sa, pos.y, pos.x * sa + pos.z * ca);
        float cb = cos(u_time * 0.041), sb = sin(u_time * 0.041);
        pos = vec3(pos.x, pos.y * cb - pos.z * sb, pos.y * sb + pos.z * cb);

        float d = sdBox(pos, vec3(1.0));
        float s = 1.0;
        trap = 1e5;
        for (int m = 0; m < 4; m++) {
          vec3 a = mod(pos * s, 2.0) - 1.0;
          s *= 3.0;
          vec3 r = abs(1.0 - 3.0 * abs(a));
          float da = max(r.x, r.y);
          float db = max(r.y, r.z);
          float dc = max(r.z, r.x);
          float cr = min(da, min(db, dc));
          trap = min(trap, cr);          // 穴の軸に近いほど小さい
          d = max(d, (cr - u_hole) / s); // u_hole で穴が連続的に侵食
        }
        return d;
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

        // カメラ: 神殿を公転。beat のドリーパンチは u_camR (JS 側) が担う
        float cp = cos(u_pitch), sp = sin(u_pitch);
        vec3 ro = vec3(cos(u_yaw) * cp, sp, sin(u_yaw) * cp) * u_camR;
        vec3 fw = normalize(-ro);
        vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
        vec3 up = cross(fw, rt);
        vec3 rd = normalize(fw * 1.5 + uv.x * rt + uv.y * up);

        // レイマーチ: 縞防止に開始距離をディザ
        float t = hash(gl_FragCoord.xy) * 0.02;
        float trap = 1e5;
        float minD = 1e5;   // 最接近距離 (外れた光線の光輪用)
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
          if (t > 7.0) break;
        }

        vec3 col = vec3(0.0);

        if (hit) {
          vec3 n = calcNormal(pos);
          vec3 lig = normalize(vec3(0.5, 0.8, -0.35));
          float dif = max(dot(n, lig), 0.0);
          float bac = max(dot(n, -lig), 0.0) * 0.15;
          float spe = pow(max(dot(reflect(rd, n), lig), 0.0), 32.0);
          float ao = 0.18 + 0.82 * clamp(1.0 - stepsF / 72.0, 0.0, 1.0); // 彫りの奥だけ暗く

          // 黒曜石: ほぼ無彩色の暗い石。trap でムラ (回転不変、穴の縁ほど明るい)
          vec3 alb = vec3(0.30, 0.27, 0.26) * (0.75 + clamp(trap, 0.0, 1.0) * 0.45);
          col = alb * (0.30 + 0.85 * dif) * ao + alb * bac * 1.6 + vec3(spe) * 0.35;

          // 熾火: 穴の軸に近い所 (trap 小) × 彫りの奥 (AO 低) が内側から燃える。
          // bass で燃え上がる (熾火・リムは同系色相 0.03-0.08。補色を重ねると白に濁る)
          float ember = pow(clamp(1.0 - trap, 0.0, 1.0), 3.0);
          float flick = 0.8 + 0.2 * sin(u_time * 7.0 + pos.x * 9.0 + pos.y * 7.0 + pos.z * 8.0);
          col += hsb(0.03 + trap * 0.05, 0.95, 1.0) * ember * flick
                 * (0.85 + u_bass * 2.2) * clamp(1.35 - ao, 0.0, 1.0);

          // リム: 拍で神殿の輪郭が閃光する
          float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
          col += hsb(0.08, 0.85, 1.0) * rim * (0.25 + u_beat * 1.6);

          col = mix(col, vec3(0.0), 1.0 - exp(-t * 0.14)); // 距離フォグ (黒へ)
        } else {
          // 外れた光線: 熾火色の光輪 (最接近距離が小さいほど明るい)
          float glow = pow(clamp(1.0 - minD * 2.0, 0.0, 1.0), 3.5);
          col += hsb(0.045, 0.9, 1.0) * glow * (0.30 + u_rms * 0.8 + u_beat * 0.8);
          // 背景: 舞い上がる火の粉 (格子 hash の星をゆっくり上へ流す)
          vec2 sph = vec2(atan(rd.z, rd.x), asin(clamp(rd.y, -1.0, 1.0)));
          sph.y -= u_time * 0.008; // 火の粉は上へ (視線座標では下へ流す)
          vec2 cell = floor(sph * 36.0);
          vec2 f = fract(sph * 36.0) - 0.5;
          float h = hash(cell);
          float spark = smoothstep(0.10, 0.0, length(f)) * step(0.975, h);
          col += hsb(0.05 + h * 0.04, 0.85, 1.0) * spark
               * (0.4 + 0.6 * sin(u_time * 2.5 + h * 40.0))
               * (0.35 + u_treble * 0.8);
        }

        // フィルミックトーンマップ + ビネット + ガンマ
        col = 1.0 - exp(-max(col, 0.0) * 1.30);
        col *= 1.0 - 0.34 * dot(uv, uv);
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
window.VJamFX.presets['menger-temple'] = MengerTemplePreset;
})();
