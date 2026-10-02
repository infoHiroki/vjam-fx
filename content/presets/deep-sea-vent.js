(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class DeepSeaVentPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this._shader = null;
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL);
        p.pixelDensity(1);
      };

      p.draw = () => {
        p.background(0);
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }

        preset._time += 0.009 + preset.audio.bass * 0.014 + preset.audio.mid * 0.004;
        preset.beatPulse *= 0.9;

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          p.noStroke();
          p.quad(-1, -1, 1, -1, 1, 1, -1, 1);
        } catch (_) {
        } finally {
          p.resetShader();
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
      };
    }, container);
  }

  _initShader(p) {
    const vert = `
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vUv;

void main() {
        vUv = aTexCoord;
        vec4 pos = vec4(aPosition, 1.0);
        pos.xy = pos.xy * 2.0 - 1.0;
        gl_Position = pos;
      }
    `;

    const frag = `
      precision highp float;
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;
      uniform vec2 u_resolution;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 8; i++) {
          v += noise(p) * a;
          p *= 2.04;
          a *= 0.51;
        }
        return v;
      }

      vec2 rotate(vec2 p, float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c) * p;
      }

      float chimney(vec2 p, vec2 c, float h, float w) {
        float body = smoothstep(w, w * 0.35, abs(p.x - c.x) - (0.06 + (p.y + 0.7) * 0.02));
        body *= smoothstep(-0.72, -0.18 - h, p.y);
        return body;
      }
      vec3 audioReactiveFinalize(vec3 inCol, vec2 uv, float hue, vec2 reactCenter, float reactScatter, float reactPulse) {
        vec3 hueCycle = 0.5 + 0.5 * cos(6.2831853 * (hue + vec3(0.0, 0.33, 0.67)));
        vec3 baseGlow = hueCycle * (0.16 + 0.14 * reactScatter);
        baseGlow += hueCycle * reactPulse * (0.18 + u_rms * 0.4 + u_beat * 0.25);
        baseGlow += vec3(0.06, 0.07, 0.09) * (0.6 + reactScatter * 0.8);
        baseGlow *= 0.75 + 0.25 * exp(-length(uv - reactCenter) * 2.8);
        inCol = mix(inCol, inCol * hueCycle, 0.2 + 0.15 * reactScatter);
        inCol += baseGlow;
        return max(inCol, vec3(0.02, 0.02, 0.03));
      }
void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        float audioHue = u_time * 0.1 + u_treble * 0.5;
        vec2 audioDrift = vec2(sin(u_time * 0.3) * 1.5 + 1.5, sin(u_time * 0.23) * 1.5 + 1.5);
        uv += vec2(sin(u_time * 0.15), cos(u_time * 0.12)) * 0.06;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float t = u_time;
        float currentAngle = (u_mid - 0.5) * 1.2 + sin(t * 0.14) * 0.16;
        vec2 currentDir = vec2(cos(currentAngle), sin(currentAngle));
        vec2 p = rotate(uv, currentAngle * 0.25);

        float depth = 0.55 + u_rms * 0.4;
        vec3 bg = mix(vec3(0.0, 0.02, 0.04), vec3(0.0, 0.08, 0.12), 0.5 + 0.5 * uv.y);
        bg *= 0.38 + (1.0 - u_rms) * 0.45;
        bg -= vec3(depth * 0.08, depth * 0.06, depth * 0.04);

        vec2 ventA = vec2(-0.24 - u_mid * 0.08, -0.62);
        vec2 ventB = vec2(0.08 + u_mid * 0.1, -0.64);
        vec2 ventC = vec2(0.32 + u_beat * 0.12, -0.66);

        float chimA = chimney(p, ventA, u_bass * 0.08, 0.11);
        float chimB = chimney(p, ventB, u_mid * 0.06, 0.12);
        float chimC = chimney(p, ventC, u_beat * 0.16, 0.09 + u_beat * 0.03);
        float chimneys = max(chimA, max(chimB, chimC));

        vec2 plumeUv = p * (3.5 + u_bass * 1.2);
        plumeUv -= currentDir * vec2(0.0, -1.0) * (0.1 + u_mid * 0.25);
        plumeUv += vec2(t * 0.013, -t * (0.28 + u_bass * 0.9));

        float plumeA = fbm(plumeUv + vec2(ventA.x * 3.0, 0.0) + vec2(fbm(plumeUv + 4.0), 0.0) * 0.4);
        float plumeB = fbm(plumeUv * 1.15 + vec2(ventB.x * 2.8, 1.5));
        float plumeC = fbm(rotate(plumeUv, 0.4 + u_beat * 0.6) * 1.3 + vec2(ventC.x * 2.4, 3.0));
        float smoke = smoothstep(0.32, 0.95, plumeA * 0.45 + plumeB * 0.35 + plumeC * 0.4);
        smoke *= smoothstep(-0.74, 0.3, p.y) * (0.45 + u_bass * 0.95 + u_beat * 0.3);

        float emissionA = exp(-length((p - ventA) * vec2(1.8, 5.5)) * (2.1 - u_bass * 0.7));
        float emissionB = exp(-length((p - ventB) * vec2(1.9, 5.0)) * (2.3 - u_bass * 0.8));
        float emissionC = exp(-length((p - ventC) * vec2(2.4, 6.2)) * (2.5 - u_beat * 1.1));
        float jets = emissionA + emissionB + emissionC;
        jets *= 0.25 + u_bass * 1.0 + u_beat * 0.9;

        float biolume = hash(floor((rotate(uv, -currentAngle) + vec2(t * 0.024, -t * 0.013)) * (80.0 + u_treble * 180.0)));
        biolume = smoothstep(0.985 - u_treble * 0.04, 1.0, biolume);
        biolume *= smoothstep(-0.1, 0.7, uv.y) * (0.2 + u_treble * 1.4 + u_beat * 0.2);

        float mineral = fbm(uv * (18.0 + u_rms * 6.0) + vec2(0.0, t * 0.032));
        mineral = smoothstep(0.55, 0.82, mineral) * smoothstep(-0.9, -0.42, uv.y);

        vec3 smokeCol = mix(vec3(0.02, 0.015, 0.012), vec3(0.16, 0.11, 0.07), smoke * 0.7 + jets * 0.3);
        vec3 mineralCol = mix(vec3(0.08, 0.07, 0.05), vec3(0.42, 0.34, 0.2), mineral + chimneys * 0.4);
        vec3 bioCol = mix(vec3(0.05, 0.2, 0.22), vec3(0.25, 0.95, 0.8), u_treble * 0.7 + u_beat * 0.15);

        vec3 col = bg;
        col += smokeCol * smoke;
        col += mineralCol * (chimneys + mineral * 0.35);
        col += vec3(0.65, 0.48, 0.18) * jets;
        col += bioCol * biolume;
        col += vec3(0.15, 0.22, 0.26) * u_mid * smoke * 0.4;

        float beatRestructure = step(0.14, u_beat);
        col = mix(col, col + vec3(0.3, 0.22, 0.08) * jets + smokeCol.zyx * 0.1, beatRestructure * 0.35);

        float vignette = 1.0 - smoothstep(0.72, 1.28, length(uv * vec2(0.92, 1.05)));
        col *= vignette;
        col = 1.0 - exp(-col * (1.15 + u_bass * 0.35 + u_rms * 0.45));

        gl_FragColor = vec4(audioReactiveFinalize(clamp(col, 0.0, 1.0), uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }
    `;

    try {
      return p.createShader(vert, frag);
    } catch (_) {
      return null;
    }
  }

  updateAudio(d) {
    this.audio.bass = d.bass || 0;
    this.audio.mid = d.mid || 0;
    this.audio.treble = d.treble || 0;
    this.audio.rms = d.rms || 0;
  }

  onBeat(s) {
    this.beatPulse = Math.min(1, s);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['deep-sea-vent'] = DeepSeaVentPreset;
})();
