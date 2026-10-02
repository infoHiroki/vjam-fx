(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class BrainScanPreset extends BasePreset {
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

        preset._time += 0.01 + preset.audio.mid * 0.01 + preset.audio.treble * 0.004;
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
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;

      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(211.7, 91.3))) * 43758.5453);
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

      float ellipseMask(vec2 p, vec2 r) {
        return smoothstep(1.0, 0.96, 1.0 - dot(p / r, p / r));
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
        float beatGate = smoothstep(0.12, 0.75, u_beat);

        vec3 col = vec3(0.01, 0.01, 0.015);
        float scan = smoothstep(0.02, 0.0, abs(fract((uv.y + t * (0.2 + u_mid * 0.4)) * 16.0) - 0.5));
        col += vec3(0.05, 0.09, 0.11) * scan * (0.25 + u_rms * 0.6);

        float hemiShift = (u_mid - 0.5) * 0.06;
        float leftMask = ellipseMask(uv + vec2(0.22 + hemiShift, 0.0), vec2(0.34, 0.43));
        float rightMask = ellipseMask(uv - vec2(0.22 - hemiShift, 0.0), vec2(0.34, 0.43));
        float cerebellum = ellipseMask(uv - vec2(0.0, 0.42), vec2(0.24, 0.14));
        float brain = max(max(leftMask, rightMask), cerebellum);

        float cortical = 0.0;
        for (int i = 0; i < 7; i++) {
          float fi = float(i) / 6.0;
          vec2 l = vec2(-0.26 + fi * 0.09, -0.16 + sin(fi * 8.0 + t * 0.6) * 0.1);
          vec2 r = vec2(0.26 - fi * 0.09, -0.1 + cos(fi * 7.0 + t * 0.5) * 0.12);
          float pulseL = smoothstep(0.12 + u_bass * 0.08, 0.0, length(uv - l));
          float pulseR = smoothstep(0.12 + u_bass * 0.08, 0.0, length(uv - r));
          cortical += pulseL * (0.25 + u_bass * 0.9);
          cortical += pulseR * (0.25 + u_bass * 0.9);
        }

        float cerebellar = 0.0;
        for (int i = 0; i < 5; i++) {
          float fi = float(i) / 4.0;
          vec2 c = vec2(-0.1 + fi * 0.05, 0.38 + sin(fi * 13.0 + t * (1.2 + u_treble * 2.0)) * 0.04);
          cerebellar += smoothstep(0.09 + u_treble * 0.02, 0.0, length(uv - c)) * (0.3 + u_treble * 1.2);
          c.x = -c.x;
          cerebellar += smoothstep(0.09 + u_treble * 0.02, 0.0, length(uv - c)) * (0.3 + u_treble * 1.2);
        }

        float hemispheric = smoothstep(-0.08, 0.08, uv.x * (u_mid * 2.0 - 1.0));
        float vessels = noise(uv * (22.0 + u_rms * 8.0) + t * 0.05);
        vessels = smoothstep(0.62 - u_rms * 0.12, 0.95, vessels) * brain;

        float globalBurst = exp(-length(uv) * (3.0 - beatGate * 1.5)) * beatGate;
        float rings = exp(-abs(length(uv) - (0.16 + beatGate * 0.5)) * (24.0 - beatGate * 10.0)) * beatGate;

        vec3 baseline = mix(vec3(0.03, 0.08, 0.15), vec3(0.08, 0.18, 0.25), u_rms);
        vec3 hot = vec3(1.0, 0.36, 0.12);
        vec3 cool = vec3(0.12, 0.85, 1.0);

        col += baseline * brain * (0.3 + u_rms * 0.9);
        col += mix(cool, hot, hemispheric) * cortical * 0.35;
        col += mix(hot, cool, hemispheric) * cerebellar * 0.28;
        col += vec3(0.8, 0.92, 1.0) * vessels * (0.1 + u_rms * 0.4);
        col += vec3(1.0, 0.6, 0.18) * globalBurst * (0.15 + u_beat * 0.7 + u_bass * 0.15);
        col += vec3(0.6, 0.8, 1.0) * rings * (0.08 + u_beat * 0.5 + u_treble * 0.15);

        float frame = smoothstep(0.96, 0.78, max(abs(uv.x), abs(uv.y)));
        col *= frame;
        col += vec3(0.1, 0.16, 0.18) * smoothstep(0.98, 0.96, max(abs(uv.x), abs(uv.y)));

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
window.VJamFX.presets['brain-scan'] = BrainScanPreset;
})();
