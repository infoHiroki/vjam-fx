(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ThermiteReactionPreset extends BasePreset {
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

        preset._time += 0.012 + preset.audio.bass * 0.02 + preset.audio.treble * 0.005;
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
        for (int i = 0; i < 5; i++) {
          v += noise(p) * a;
          p *= 2.03;
          a *= 0.52;
        }
        return v;
      }

      vec2 rotate(vec2 p, float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c) * p;
      }

      float sparkField(vec2 p, float t, float seed) {
        vec2 cell = floor(p);
        vec2 f = fract(p) - 0.5;
        float id = hash(cell + seed);
        vec2 drift = vec2(
          sin(t * (3.0 + u_treble * 8.0) + id * 6.2831),
          cos(t * (4.0 + u_treble * 11.0) + id * 6.2831)
        );
        drift *= 0.22 + u_treble * 0.45 + u_beat * 0.3;
        float d = length(f - drift);
        return smoothstep(0.18 - u_treble * 0.08, 0.0, d);
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
        float reaction = 1.0 + u_bass * 1.7 + u_beat * 0.8;
        vec2 flowUv = rotate(uv, (u_mid - 0.5) * 0.35 + sin(t * 0.2) * 0.08);
        vec2 moltenUv = flowUv * (2.5 + u_bass * 1.2) + vec2(0.0, t * (0.6 + u_bass * 1.8));
        vec2 slagUv = rotate(flowUv * (4.0 + u_mid * 2.0), u_mid * 0.9 + t * 0.05);

        float molten = fbm(moltenUv + vec2(fbm(moltenUv + 4.0), fbm(moltenUv - 6.0)) * (0.5 + u_mid * 0.8));
        molten += fbm(moltenUv * 1.8 - vec2(t * 0.35, -t * 0.22)) * (0.35 + u_mid * 0.45);
        float river = smoothstep(0.35 - u_mid * 0.12, 0.98 + u_bass * 0.18, molten);

        vec2 ignitionA = vec2(sin(t * 0.6), cos(t * 0.43)) * (0.18 + u_bass * 0.15);
        vec2 ignitionB = vec2(cos(t * 0.32 + 2.0), sin(t * 0.51 + 1.4)) * (0.26 + u_mid * 0.18);
        vec2 ignitionC = vec2(sin(t * 0.21 + 4.0), cos(t * 0.29 + 3.2)) * (0.34 + u_beat * 0.22);
        float ignite = exp(-length(uv - ignitionA) * (10.0 - u_bass * 2.5));
        ignite += exp(-length(uv - ignitionB) * (11.5 - u_mid * 2.0));
        ignite += exp(-length(uv - ignitionC) * (14.0 - u_beat * 6.0));
        ignite *= 0.45 + u_bass * 0.9 + u_beat * 1.1;

        float sparks = sparkField(flowUv * (18.0 + u_treble * 42.0) + vec2(t * 3.4, -t * 2.8), t, 13.0);
        sparks += sparkField(rotate(flowUv, 1.2) * (25.0 + u_treble * 56.0) + vec2(-t * 4.2, t * 2.6), t * 1.3, 91.0);
        sparks *= 0.3 + u_treble * 1.6 + u_beat * 0.6;

        float slag = fbm(slagUv - vec2(0.0, t * (0.22 + u_mid * 0.55)));
        slag = smoothstep(0.42, 0.82 + u_mid * 0.08, slag) * (1.0 - smoothstep(-0.3, 0.8, uv.y));

        float beatFront = sin(length(uv - ignitionC) * (16.0 + u_bass * 10.0) - t * (8.0 + u_bass * 12.0));
        beatFront = smoothstep(0.58 - u_beat * 0.25, 0.95, beatFront) * u_beat;

        float soot = fbm(flowUv * (6.0 + u_rms * 2.0) + t * 0.08);
        vec3 baseRock = mix(vec3(0.03, 0.02, 0.015), vec3(0.18, 0.08, 0.03), river * 0.25 + slag * 0.35);
        baseRock += soot * vec3(0.05, 0.02, 0.01) * (0.5 + u_rms * 0.5);

        vec3 heatLow = vec3(0.65, 0.08, 0.01);
        vec3 heatMid = vec3(1.0, 0.38, 0.04);
        vec3 heatHigh = vec3(1.0, 0.96, 0.78);
        vec3 moltenColor = mix(heatLow, heatMid, clamp(molten * 1.2 + u_mid * 0.25, 0.0, 1.0));
        moltenColor = mix(moltenColor, heatHigh, clamp(u_rms * 0.8 + river * 0.4 + u_beat * 0.25, 0.0, 1.0));

        vec3 col = baseRock;
        col += moltenColor * river * (0.5 + reaction);
        col += mix(vec3(1.0, 0.4, 0.08), vec3(1.0, 0.95, 0.55), u_rms) * ignite;
        col += vec3(1.0, 0.9, 0.7) * sparks;
        col += vec3(1.0, 0.55, 0.12) * beatFront * (0.7 + u_bass * 0.5);
        col *= 0.86 + u_rms * 0.55;

        float structureMask = smoothstep(0.06, 0.55 + u_beat * 0.45, river + slag * 0.6 + beatFront);
        col = mix(col * (0.65 + u_bass * 0.18), col + vec3(0.7, 0.22, 0.05) * structureMask, 0.35 + u_beat * 0.45);

        float vignette = 1.0 - smoothstep(0.65, 1.35, length(uv * vec2(0.92, 1.08)));
        col *= vignette;
        col = 1.0 - exp(-col * (1.1 + u_rms * 0.7 + u_bass * 0.45));

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
window.VJamFX.presets['thermite-reaction'] = ThermiteReactionPreset;
})();
