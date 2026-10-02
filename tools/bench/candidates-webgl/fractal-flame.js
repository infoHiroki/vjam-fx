(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FractalFlamePreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._shader = null;
    this._time = 0;
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
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }

        preset._time += 0.014 + preset.audio.treble * 0.012 + preset.audio.bass * 0.004;
        preset.beatPulse *= 0.89;

        try {
          p.background(0);
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

      mat2 rot(float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c);
      }

      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      vec2 variation(vec2 p, float mode, float strength) {
        vec2 outP = p;
        if (mode < 0.5) {
          outP = vec2(sin(p.x), sin(p.y)) * (0.9 + strength);
        } else if (mode < 1.5) {
          float r2 = dot(p, p) + 0.18;
          outP = vec2(p.x / r2, p.y / r2) * (0.8 + strength * 1.4);
        } else {
          float r = length(p) + 0.0001;
          float a = atan(p.y, p.x);
          outP = vec2(sin(a * 3.0), cos(r * 5.0 - a)) * (0.55 + strength * 1.2);
        }
        return outP;
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

        float beatMode = floor(clamp(u_beat * 3.2, 0.0, 2.999));
        float scaleA = mix(1.2, 2.4, u_bass) + u_bass * 0.8;
        float scaleB = mix(0.8, 1.9, u_bass) + u_beat * 0.6;
        float rotateA = t * (0.25 + u_treble * 0.9) + u_treble * 2.5;
        float rotateB = -t * (0.18 + u_treble * 1.1) + u_beat * 1.7;
        float nonLinear = 0.1 + u_mid * 0.95 + u_mid * u_mid * 0.55;

        vec2 p = uv * (1.5 + scaleA) + audioDrift;
        p *= rot(rotateA);
        p += vec2(sin(t * 0.4 + u_mid * 4.0), cos(t * 0.3 + u_bass * 3.0)) * 0.12;

        vec3 accum = vec3(0.0);
        float weight = 0.0;
        vec2 z = p;
        float glow = 0.0;

        for (int i = 0; i < 24; i++) {
          float fi = float(i);
          float chooser = mod(fi + beatMode, 3.0);
          z *= rot(rotateB + fi * (0.07 + u_treble * 0.03));
          z = variation(z * (0.7 + scaleB * 0.35), chooser, nonLinear);
          z += vec2(
            sin(fi * 1.7 + t * 0.6 + u_bass * 5.0),
            cos(fi * 1.3 - t * 0.5 + u_mid * 4.0)
          ) * (0.04 + u_mid * 0.08);

          float dens = exp(-dot(z, z) * (0.8 + u_bass * 0.9));
          float spark = noise(z * (4.0 + u_treble * 6.0) + fi + t * (0.5 + u_treble * 0.8));
          float flame = dens * (0.45 + u_rms * 1.8) + spark * dens * (0.2 + u_treble * 0.7);

          vec3 palette = mix(vec3(0.22, 0.04, 0.02), vec3(1.0, 0.38, 0.08), flame);
          palette = mix(palette, vec3(1.0, 0.9, 0.45), dens * (0.4 + u_rms * 0.7));
          palette += vec3(0.15, 0.02, 0.25) * u_mid * spark;

          accum += palette * flame;
          weight += flame;
          glow += dens * (0.05 + u_bass * 0.08 + u_rms * 0.08);
        }

        vec3 col = accum / max(weight, 0.001);
        col *= 0.45 + u_rms * 1.3;
        col += vec3(1.0, 0.7, 0.3) * glow * (0.2 + u_rms * 0.8);

        float radial = length(uv);

        col *= smoothstep(1.25 + u_bass * 0.25, 0.02, radial);
        col = pow(max(col, 0.0), vec3(0.9 - u_rms * 0.15));

        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }
    `;

    try {
      return p.createShader(vert, frag);
    } catch (_) {
      return null;
    }
  }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
  }

  onBeat(strength) {
    this.beatPulse = Math.min(1, strength);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['fractal-flame'] = FractalFlamePreset;
})();
