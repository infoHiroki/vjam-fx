(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class RidgeSilhouettePreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._shader = null;
    this._time = 0;
    this._shapeIndex = 0;
    this._morphProgress = 1.0;
  }

  setup(container) {
    this.destroy();
    const preset = this;
    this.p5 = new p5((p) => {
      p.setup = () => {
        p.createCanvas(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight, p.WEBGL);
        p.pixelDensity(1);
      };
      p.draw = () => {
        if (!preset._shader) { preset._shader = preset._initShader(p); if (!preset._shader) return; }
        preset._time += 0.008 + preset.audio.bass * 0.004;
        preset.beatPulse *= 0.88;
        if (preset._morphProgress < 1.0) {
          preset._morphProgress = Math.min(1.0, preset._morphProgress + 0.018 + preset.audio.bass * 0.01);
        }
        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_shape', preset._shapeIndex);
          preset._shader.setUniform('u_prevShape', (preset._shapeIndex + 4) % 5);
          preset._shader.setUniform('u_morph', preset._morphProgress);
          p.noStroke();
          p.quad(-1, -1, 1, -1, 1, 1, -1, 1);
        } catch (e) {} finally { p.resetShader(); }
      };
      p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
    }, container);
  }

  _initShader(p) {
    const vert = `
      attribute vec3 aPosition;
      void main() { vec4 pos = vec4(aPosition, 1.0); pos.xy = pos.xy * 2.0 - 1.0; gl_Position = pos; }
    `;
    const frag = `
      precision mediump float;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform float u_rms;
      uniform vec2 u_resolution;
      uniform int u_shape;
      uniform int u_prevShape;
      uniform float u_morph;

      #define PI 3.14159265
      #define TAU 6.28318530

      // ---- SDF shapes ----
      float sdCircle(vec2 p, float r) {
        return length(p) - r;
      }
      float sdStar(vec2 p, float r, int n, float inset) {
        float an = PI / float(n);
        float a = atan(p.y, p.x);
        float seg = mod(a, 2.0 * an) - an;
        vec2 q = vec2(cos(seg), abs(sin(seg))) * length(p);
        float d1 = q.x - r;
        float d2 = (q.x - r * inset) * 0.7 + q.y * 0.7;
        return max(d1, d2) * 0.8;
      }
      float sdFlower(vec2 p, float r, float petals, float depth) {
        float a = atan(p.y, p.x);
        return length(p) - (r + depth * cos(petals * a));
      }
      float sdDiamond(vec2 p, float r) {
        vec2 q = abs(p);
        return (q.x + q.y - r) * 0.707;
      }
      float sdBlob(vec2 p, float r, float t) {
        float a = atan(p.y, p.x);
        float mod_r = r
          + 0.06 * sin(3.0 * a + t * 2.0)
          + 0.04 * sin(5.0 * a - t * 3.0)
          + 0.03 * sin(7.0 * a + t * 5.0);
        return length(p) - mod_r;
      }

      float getShape(vec2 p, int idx, float t) {
        if (idx == 0) return sdCircle(p, 0.38);
        if (idx == 1) return sdStar(p, 0.40, 5, 0.4);
        if (idx == 2) return sdFlower(p, 0.30, 6.0, 0.10);
        if (idx == 3) return sdDiamond(p, 0.48);
        return sdBlob(p, 0.36, t);
      }

      // Noise
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 3; i++) {
          v += a * noise(p);
          p *= 2.1;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        float aspect = u_resolution.x / u_resolution.y;

        float LINE_COUNT = 50.0 + u_mid * 15.0;
        float lineWidth = 1.0 / u_resolution.y;

        // KEY: rms drives how much the shape appears
        // No sound = flat lines. Loud = full shape displacement
        float intensity = u_rms * 2.5 + u_beat * 0.5;
        intensity = clamp(intensity, 0.0, 1.0);
        float maxDisp = 0.45 * intensity;

        // Slow rotation
        float rot = u_time * 0.12;
        float cosR = cos(rot), sinR = sin(rot);

        vec3 col = vec3(0.0);

        for (float i = 0.0; i < 70.0; i++) {
          if (i >= LINE_COUNT) break;

          float lineFrac = i / LINE_COUNT;
          float lineY = 0.93 - lineFrac * 0.86;

          // SDF space
          float sdfX = (uv.x - 0.5) * aspect * 1.4;
          float sdfY = (lineY - 0.5) * 1.4;
          vec2 sdfP = vec2(
            sdfX * cosR - sdfY * sinR,
            sdfX * sinR + sdfY * cosR
          );

          // Morphed SDF
          float d1 = getShape(sdfP, u_prevShape, u_time);
          float d2 = getShape(sdfP, u_shape, u_time);
          float morph = u_morph * u_morph * (3.0 - 2.0 * u_morph);
          float sdf = mix(d1, d2, morph);

          float inside = smoothstep(0.03, -0.15, sdf);
          float edge = smoothstep(0.04, 0.0, abs(sdf));

          // Noise (subtle)
          float n1 = fbm(vec2(uv.x * 5.0 + i * 0.3, u_time * 0.4 + i * 0.12));
          float hiFreq = u_treble * noise(vec2(uv.x * 20.0, i * 0.6 + u_time * 1.5)) * 0.15;

          // Displacement: driven entirely by audio intensity
          float shapeDisp = inside * maxDisp * (0.6 + n1 * 0.3 + hiFreq);
          shapeDisp += edge * 0.04 * intensity * (1.0 + u_beat * 2.0);

          // Outside: very subtle noise only when there's sound
          float baseNoise = noise(vec2(uv.x * 2.5 + i * 0.15, u_time * 0.2)) * 0.002 * intensity;

          float disp = shapeDisp / LINE_COUNT * 5.0 + baseNoise;

          float displacedY = lineY + disp;
          float dist = abs(uv.y - displacedY);

          // Occlusion
          float spacing = 0.86 / LINE_COUNT;
          if (uv.y < displacedY && uv.y > displacedY - spacing * 1.2) {
            col *= 0.0;
          }

          // Line thickness: thin when flat, thick when displaced
          float thickMult = 1.0 + inside * intensity * 1.5 + edge * intensity * 2.0;
          float lw = lineWidth * thickMult;
          float lineAlpha = smoothstep(lw * 2.0, 0.0, dist);

          // Color: flat lines are dim, shape lines are bright
          float brightness = 0.4 + inside * intensity * 0.5 + u_beat * 0.1;
          vec3 lineCol = vec3(brightness);

          // Edge color
          float hueShift = float(u_shape) * 0.2 + u_time * 0.05;
          vec3 edgeCol = vec3(
            0.4 + 0.3 * sin(hueShift * TAU),
            0.5 + 0.3 * sin(hueShift * TAU + 2.094),
            0.8 + 0.2 * sin(hueShift * TAU + 4.189)
          );
          lineCol = mix(lineCol, edgeCol, edge * intensity * 0.6);

          col += lineCol * lineAlpha;
        }

        // Vignette
        float vig = 1.0 - 0.3 * length((uv - 0.5) * 1.5);
        col *= vig;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (e) { return null; }
  }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
  }

  onBeat(strength) {
    this.beatPulse = strength;
    if (strength > 0.5 && this._morphProgress >= 1.0) {
      this._shapeIndex = (this._shapeIndex + 1) % 5;
      this._morphProgress = 0.0;
    }
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['ridge-silhouette'] = RidgeSilhouettePreset;
})();
