(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SynapseFirePreset extends BasePreset {
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

        preset._time += 0.01 + preset.audio.treble * 0.018 + preset.audio.bass * 0.012;
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

      float hash(float n) {
        return fract(sin(n) * 43758.5453123);
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

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 m = mat2(1.7, 1.2, -1.2, 1.6);
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = m * p;
          a *= 0.5;
        }
        return v;
      }

      vec2 neuron(vec2 uv, vec2 id, float t, float gridScale, float morph) {
        vec2 cell = id + 0.5;
        vec2 jitter = vec2(
          sin(t * (0.4 + u_bass * 2.4) + hash21(id) * 6.2831),
          cos(t * (0.35 + u_mid * 2.0) + hash21(id + 4.1) * 6.2831)
        ) * (0.12 + 0.08 * u_rms + 0.1 * morph);
        vec2 beatOffset = vec2(
          sin(t * (2.0 + u_beat * 8.0) + id.x * 0.9),
          cos(t * (1.7 + u_beat * 7.0) + id.y * 0.7)
        ) * u_beat * 0.18;
        cell += jitter + beatOffset;
        return (cell / gridScale) * 2.0 - 1.0;
      }

      float sparkLine(vec2 uv, vec2 a, vec2 b, float width) {
        vec2 pa = uv - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        float d = length(pa - ba * h);
        return exp(-d * width) * smoothstep(0.0, 0.08, h) * smoothstep(1.0, 0.92, h);
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
        float t = u_time;
        float beatMorph = smoothstep(0.18, 0.82, u_beat);
        float gridScale = mix(5.5 + u_mid * 4.5, 9.0 + u_mid * 7.0, beatMorph);

        vec2 g = (uv * 0.5 + 0.5) * gridScale;
        vec2 id = floor(g);
        vec2 f = fract(g) - 0.5;

        float webNoise = fbm(uv * (2.4 + u_mid * 4.0) + vec2(t * 0.08, -t * 0.05));
        float seizure = sin((uv.x + uv.y) * (12.0 + u_beat * 22.0) + t * (10.0 + u_beat * 20.0));
        vec3 col = vec3(0.01, 0.012, 0.02) + vec3(0.02, 0.01, 0.04) * webNoise;
        col += vec3(0.05, 0.01, 0.09) * max(seizure, 0.0) * u_beat * 0.25;

        float soma = 0.0;
        float axons = 0.0;
        float charge = 0.0;

        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 nid = id + vec2(float(i), float(j));
            vec2 center = neuron(uv, nid, t, gridScale, beatMorph);
            vec2 right = neuron(uv, nid + vec2(1.0, 0.0), t, gridScale, beatMorph);
            vec2 up = neuron(uv, nid + vec2(0.0, 1.0), t, gridScale, beatMorph);

            float n = hash21(nid);
            float densityGate = step(0.28 - u_mid * 0.18 - u_beat * 0.08, n);
            float core = exp(-length(uv - center) * (15.0 + u_mid * 14.0 + u_bass * 7.0));
            soma += core * densityGate;

            float firePhase = fract(n * 7.31 + t * (0.14 + u_bass * 0.7) + fbm(center * 2.0) * 0.2);
            float burst = smoothstep(0.82 - u_bass * 0.3 - u_beat * 0.22, 1.0, firePhase);
            charge += core * burst * (1.0 + u_rms * 2.0);

            float connectA = step(0.36 - u_mid * 0.2 + u_beat * 0.06, hash21(nid + 1.37));
            float connectB = step(0.42 - u_mid * 0.22 + u_beat * 0.05, hash21(nid + 5.71));
            float width = 55.0 - u_treble * 26.0 + u_beat * 10.0;
            float lineA = sparkLine(uv, center, right, width) * connectA;
            float lineB = sparkLine(uv, center, up, width) * connectB;

            float waveA = sin(t * (4.0 + u_treble * 12.0) - length(uv - center) * (22.0 + u_treble * 28.0) + n * 6.2831);
            float waveB = sin(t * (3.0 + u_treble * 10.0) - length(uv - right) * (18.0 + u_treble * 25.0) + n * 4.2);
            axons += (lineA + lineB) * (0.45 + 0.55 * burst);
            charge += max(waveA, 0.0) * lineA * (0.4 + u_treble * 1.4);
            charge += max(waveB, 0.0) * lineB * (0.25 + u_treble * 1.2);
          }
        }

        float transmitter = charge * (0.4 + u_rms * 2.2);
        vec3 synapseCol = mix(vec3(0.08, 0.24, 0.95), vec3(1.0, 0.35, 0.12), transmitter);
        synapseCol = mix(synapseCol, vec3(0.4, 1.0, 0.82), 0.35 + u_rms * 0.45);
        synapseCol += vec3(0.2, 0.1, 0.35) * u_rms;

        float tissue = fbm(uv * (8.0 + u_mid * 9.0) + t * 0.03);
        col += vec3(0.03, 0.01, 0.05) * tissue * (0.5 + u_rms);
        col += synapseCol * axons * (0.45 + u_mid * 0.7);
        col += vec3(1.0, 0.95, 0.75) * transmitter * (0.5 + u_bass * 0.9);
        col += vec3(0.6, 0.9, 1.0) * soma * (0.12 + u_treble * 0.28);
        col += vec3(1.0, 0.3, 0.5) * u_beat * max(seizure, 0.0) * 0.22;

        float vignette = 1.0 - smoothstep(0.6, 1.35, length(uv * vec2(0.92, 1.08)));
        col *= vignette;
        col = 1.0 - exp(-col * (1.4 + u_bass * 0.8 + u_rms * 0.8));
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
window.VJamFX.presets['synapse-fire'] = SynapseFirePreset;
})();
