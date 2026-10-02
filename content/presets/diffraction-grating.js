(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class DiffractionGratingPreset extends BasePreset {
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

        preset.beatPulse *= 0.9;
        preset._time += 0.01 + preset.audio.treble * 0.01 + preset.audio.rms * 0.004;

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

      mat2 rot(float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c);
      }

      vec3 spectral(float x, float shift) {
        return 0.55 + 0.45 * cos(6.28318 * (x + shift + vec3(0.0, 0.18, 0.42)));
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
        vec2 audioDrift = vec2(fract(u_time * 0.1) * 3.0, fract(u_time * 0.08) * 3.0);
        uv += (audioDrift - 1.5) * 0.12;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float beatMorph = smoothstep(0.08, 0.85, u_beat);
        float slitSpacing = mix(22.0, 7.0, clamp(u_bass, 0.0, 1.0));
        float incidence = sin(u_time * (0.5 + u_treble * 2.8) + uv.y * 2.0) * (0.08 + u_treble * 0.45);
        float gratingRot = u_mid * 1.4 + sin(u_time * 0.3 + u_mid * 4.0) * 0.15 + beatMorph * 0.35;
        vec2 q = rot(gratingRot) * uv;

        float slitMask = 1.0 - smoothstep(0.18 + u_bass * 0.2, 0.4 + u_bass * 0.28, abs(fract(q.x * slitSpacing) - 0.5));
        slitMask *= 0.7 + u_rms * 0.9;

        float phaseA = q.x * slitSpacing + incidence * 14.0 + u_time * (0.4 + u_treble * 1.6);
        float phaseB = q.x * slitSpacing * (1.4 + u_mid * 0.8) - q.y * (4.0 + u_bass * 8.0);
        float phaseC = length(q) * (18.0 + u_mid * 9.0 + beatMorph * 10.0) - u_time * (0.8 + u_treble * 2.2);

        float fringes = cos(phaseA) + 0.65 * cos(phaseB) + 0.35 * cos(phaseC);
        float diffraction = exp(-abs(q.y - incidence * 0.35) * (4.0 + u_bass * 7.0)) * (0.45 + 0.55 * fringes);
        diffraction += exp(-abs(q.y + incidence * 0.28) * (6.0 + u_treble * 12.0)) * 0.2 * sin(phaseC);

        float chromaIndex = fringes * 0.12 + q.y * (0.8 + u_treble * 0.9) + u_time * 0.06;
        vec3 rainbow = spectral(chromaIndex, u_mid * 0.16 + beatMorph * 0.08);
        vec3 whiteFlash = vec3(1.0) * u_beat * (0.4 + slitMask * 1.1 + u_rms * 0.6);

        vec3 source = vec3(0.9, 0.96, 1.0) * exp(-length(uv - vec2(0.0, incidence * 0.15)) * (7.0 - u_bass * 3.5));
        source *= 0.3 + u_rms * 1.6 + u_beat * 0.5;

        vec3 beam = rainbow * diffraction * slitMask;
        beam *= 0.6 + u_rms * 1.4;
        beam += rainbow * pow(max(fringes, 0.0), 2.0) * (0.12 + u_treble * 0.35);
        beam += rainbow * beatMorph * exp(-abs(q.x) * (3.0 + u_mid * 4.0)) * 0.35;

        vec3 housing = vec3(0.01, 0.015, 0.03);
        housing += vec3(0.05, 0.08, 0.12) * exp(-abs(q.x) * (10.0 + u_bass * 6.0)) * (0.2 + u_mid * 0.4);
        housing += vec3(0.15, 0.17, 0.2) * (1.0 - slitMask) * 0.08;

        vec3 col = housing + source + beam + whiteFlash;
        col += rainbow * u_bass * exp(-abs(q.y) * 9.0) * 0.15;
        col *= 1.0 - smoothstep(0.9, 1.35, length(uv));
        col = pow(max(col, 0.0), vec3(0.92));

        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
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

  onBeat(strength) {
    this.beatPulse = Math.min(1, strength);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['diffraction-grating'] = DiffractionGratingPreset;
})();
