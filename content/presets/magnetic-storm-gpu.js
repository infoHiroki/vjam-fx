(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class MagneticStormGpuPreset extends BasePreset {
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

        preset._time += 0.013 + preset.audio.mid * 0.007 + preset.audio.treble * 0.006;
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
      float noise(vec2 p){
        vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }

      vec2 rotate(vec2 p, float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c) * p;
      }

      vec2 currentCenter(float idx, float t) {
        float phase = idx * 2.09439510239;
        vec2 c = vec2(cos(t * 0.23 + phase), sin(t * 0.19 + phase * 1.3));
        c *= 0.22 + u_mid * 0.28;
        c += vec2(sin(t * 0.41 + phase * 1.7), cos(t * 0.37 - phase)) * (0.05 + u_mid * 0.08);
        return c;
      }

      vec2 oerstedField(vec2 p, vec2 c, float currentSign) {
        vec2 d = p - c;
        float r2 = dot(d, d) + 0.004;
        vec2 tangent = vec2(-d.y, d.x) / sqrt(r2);
        float amp = currentSign / r2;
        return tangent * amp;
      }

      float traceLine(vec2 uv, float t) {
        vec2 p = uv;
        float glow = 0.0;
        for (int i = 0; i < 24; i++) {
          float fi = float(i);
          vec2 f = vec2(0.0);
          for (int j = 0; j < 3; j++) {
            float fj = float(j);
            vec2 c = currentCenter(fj, t);
            float sgn = (j == 1) ? -1.0 : 1.0;
            f += oerstedField(p, c, sgn) * (0.012 + u_bass * 0.03);
          }
          f += normalize(p + vec2(0.001)) * (0.002 + u_rms * 0.003);
          p += f * (0.06 + u_treble * 0.04 + u_beat * 0.02);
          glow += exp(-dot(p - uv, p - uv) * (60.0 + u_treble * 70.0)) * (0.08 + u_rms * 0.12 + u_beat * 0.08);
          p = rotate(p, 0.01 * sin(t * 0.7 + fi));
        }
        return glow;
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
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
        float audioHue = u_time * 0.1 + u_treble * 0.5;
        vec2 audioDrift = vec2(fract(u_time * 0.1) * 3.0, fract(u_time * 0.08) * 3.0);
        uv += (audioDrift - 1.5) * 0.12;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float t = u_time;

        vec3 bg = mix(vec3(0.01, 0.015, 0.04), vec3(0.01, 0.03, 0.08), 0.5 + 0.5 * uv.y);
        bg += vec3(0.02, 0.06, 0.08) * exp(-length(uv) * 2.5) * (0.2 + u_rms * 0.4);

        float fieldA = traceLine(uv, t);
        float fieldB = traceLine(rotate(uv * 1.18, 0.7), t + 1.7);
        float fieldC = traceLine(rotate(uv * 1.35, -0.9), t - 1.2);
        float auric = fieldA * 0.55 + fieldB * 0.28 + fieldC * 0.17;

        vec2 accelUv = uv * (2.0 + u_treble * 2.5);
        float accelerator = sin(length(accelUv) * (18.0 + u_treble * 25.0) - t * (6.0 + u_treble * 12.0));
        accelerator = 0.5 + 0.5 * accelerator;

        float plasma = hash(floor((uv + vec2(t * 0.06, -t * 0.04)) * (110.0 + u_treble * 180.0)));
        plasma = step(0.992 - u_treble * 0.015, plasma) * exp(-length(fract((uv + 0.5) * 16.0) - 0.5) * 4.5);

        vec2 reconPos = vec2(0.22 * sin(t * 0.3 + u_mid * 2.0), 0.16 * cos(t * 0.37 - u_mid * 1.4));
        float reconnect = exp(-length(uv - reconPos) * (16.0 - u_bass * 4.0));
        reconnect *= u_beat * (1.0 + u_rms);

        vec3 storm = mix(vec3(0.08, 0.6, 1.0), vec3(0.9, 0.25, 1.0), 0.5 + 0.5 * sin(u_mid * 5.0 + uv.y * 3.0));
        storm += vec3(0.25, 0.3, 0.45) * u_mid;
        storm *= 0.35 + u_bass * 1.2;

        vec3 col = bg;
        col += storm * auric * (0.8 + accelerator * (0.4 + u_treble * 0.8));
        col += vec3(0.5, 0.85, 1.0) * plasma * (0.12 + u_treble * 0.7);
        col += vec3(1.0, 0.8, 0.95) * reconnect;
        col += vec3(0.35, 0.7, 1.0) * u_beat * auric * 0.2;
        col += vec3(0.08, 0.15, 0.25) * u_rms;
        col *= 1.0 - smoothstep(0.9, 1.45, length(uv * vec2(0.95, 1.1))) * 0.28;
        col = 1.0 - exp(-col * (1.1 + u_rms * 0.6 + u_bass * 0.2));
        col = pow(col, vec3(0.92));

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
window.VJamFX.presets['magnetic-storm-gpu'] = MagneticStormGpuPreset;
})();
