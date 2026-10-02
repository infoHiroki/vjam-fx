(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class WaveInterference3dPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this._shader = null;
  }

  setup(container) {
    this.destroy();
    this.beatPulse = 0;
    this._time = 0;
    this._shader = null;
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

        preset._time += 0.012 + preset.audio.mid * 0.008 + preset.audio.treble * 0.004;
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
      uniform vec2 u_resolution;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;

      float waveHeight(vec2 p, vec2 src, float wavelength, float speed, float pulse) {
        float d = length(p - src);
        float k = 6.2831853 / wavelength;
        return sin(d * k - speed) * exp(-d * (0.8 + pulse));
      }

      vec3 normalFromHeight(vec2 p, vec2 srcA, vec2 srcB, float wavelength, float speed, float pulse, float amp) {
        float e = 0.01;
        float h = (waveHeight(p, srcA, wavelength, speed, pulse) + waveHeight(p, srcB, wavelength, speed, pulse)) * amp;
        float hx = (waveHeight(p + vec2(e, 0.0), srcA, wavelength, speed, pulse) + waveHeight(p + vec2(e, 0.0), srcB, wavelength, speed, pulse)) * amp;
        float hy = (waveHeight(p + vec2(0.0, e), srcA, wavelength, speed, pulse) + waveHeight(p + vec2(0.0, e), srcB, wavelength, speed, pulse)) * amp;
        return normalize(vec3(h - hx, h - hy, e * 3.0));
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
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
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
        float beatGate = smoothstep(0.15, 0.8, u_beat);

        float amp = 0.12 + u_bass * 0.5 + u_bass * u_bass * 0.25 + beatGate * 0.25;
        float wavelength = 0.18 + (1.0 - u_treble) * 0.32 + 0.04 * sin(t * 0.2);
        float spacing = 0.22 + u_mid * 0.55 + beatGate * 0.06;
        float viscosity = 0.25 + u_rms * 1.5;
        float speed = t * (3.0 + u_treble * 10.0);

        vec2 srcA = vec2(-spacing, sin(t * 0.4 + u_mid * 2.5) * 0.04);
        vec2 srcB = vec2(spacing, -sin(t * 0.45 + u_mid * 2.0) * 0.04);
        float hA = waveHeight(uv, srcA, wavelength, speed, viscosity);
        float hB = waveHeight(uv, srcB, wavelength, speed, viscosity);
        float pulseA = waveHeight(uv, srcA + vec2(0.0, 0.24 * beatGate), wavelength * 0.7, speed * 1.35, viscosity * 0.7);
        float pulseB = waveHeight(uv, srcB - vec2(0.0, 0.24 * beatGate), wavelength * 0.7, speed * 1.35, viscosity * 0.7);
        float height = (hA + hB) * amp + (pulseA + pulseB) * beatGate * amp * 0.65;
        height += sin(length(uv) * 16.0 - speed * 1.2 + u_beat * 4.0) * u_beat * 0.03;

        vec3 n = normalFromHeight(uv, srcA, srcB, wavelength, speed, viscosity, amp);
        vec3 lightDir = normalize(vec3(-0.4, 0.55, 0.8));
        float diff = max(dot(n, lightDir), 0.0);
        float spec = pow(max(dot(reflect(-lightDir, n), normalize(vec3(uv, 1.4))), 0.0), 18.0 - u_rms * 8.0);

        float contour = smoothstep(0.025 + u_rms * 0.012, 0.0, abs(fract(height * (8.0 + u_bass * 4.0)) - 0.5));
        float interference = smoothstep(0.08 + u_rms * 0.04, 0.0, abs(hA + hB));
        float nodes = smoothstep(0.04 + u_rms * 0.02, 0.0, abs(hA - hB));

        vec3 col = vec3(0.015, 0.02, 0.05);
        col += vec3(0.05, 0.15, 0.3) * (diff * 0.7 + 0.2);
        col += vec3(0.18, 0.6, 1.0) * contour * (0.2 + u_treble * 0.5);
        col += vec3(1.0, 0.68, 0.28) * interference * (0.1 + u_bass * 0.5);
        col += vec3(0.8, 0.95, 1.0) * nodes * (0.08 + u_mid * 0.2 + beatGate * 0.3);
        col += vec3(1.0) * spec * (0.12 + u_rms * 0.6);

        float sourceGlow = smoothstep(0.11 + beatGate * 0.1, 0.0, length(uv - srcA));
        sourceGlow += smoothstep(0.11 + beatGate * 0.1, 0.0, length(uv - srcB));
        col += vec3(0.95, 0.98, 1.0) * sourceGlow * (0.08 + u_beat * 0.8 + u_treble * 0.1);

        float horizon = smoothstep(-0.85, 0.4, uv.y + height * 0.22);
        col *= horizon;

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

  onBeat(strength) {
    this.beatPulse = Math.min(1, strength);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['wave-interference-3d'] = WaveInterference3dPreset;
})();
