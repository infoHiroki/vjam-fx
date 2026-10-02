(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ButterflyEffectPreset extends BasePreset {
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

        preset.beatPulse *= 0.88;
        preset._time += 0.012 + preset.audio.treble * 0.01 + preset.audio.rms * 0.006;

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
      float noise(vec2 p){
        vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(dot(i,vec2(1.0,157.0))),hash(dot(i+vec2(1,0),vec2(1.0,157.0))),f.x),
                   mix(hash(dot(i+vec2(0,1),vec2(1.0,157.0))),hash(dot(i+vec2(1,1),vec2(1.0,157.0))),f.x),f.y);
      }

      mat2 rot(float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c);
      }

      // Lorenz attractor step
      vec3 lorenz(vec3 pt, float sigma, float rho, float beta) {
        return vec3(
          sigma * (pt.y - pt.x),
          pt.x * (rho - pt.z) - pt.y,
          pt.x * pt.y - beta * pt.z
        );
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
        float beatMorph = smoothstep(0.04, 0.78, u_beat);

        // Lorenz attractor parameters — audio reactive
        float sigma = 10.0 + u_bass * 4.0;
        float rho = 28.0 + u_mid * 8.0 + beatMorph * 6.0;
        float beta = 2.6667 + u_treble * 1.0;
        float dt = 0.004 + u_rms * 0.002;

        vec3 col = vec3(0.0);

        // Trace multiple Lorenz trajectories
        for (int t = 0; t < 6; t++) {
          float ft = float(t);
          float seed = ft * 2.17 + u_time * 0.05;
          // Start near the attractor
          vec3 pt = vec3(
            0.1 + sin(seed) * 2.0,
            0.1 + cos(seed * 1.3) * 2.0,
            25.0 + sin(seed * 0.7) * 3.0
          );

          float trailHue = ft * 0.15 + u_time * 0.04;

          for (int i = 0; i < 200; i++) {
            vec3 dp = lorenz(pt, sigma, rho, beta);
            pt += dp * dt;

            // Project Lorenz XZ onto screen (classic butterfly view)
            vec2 projected = vec2(pt.x, pt.z - 25.0) * 0.032;
            // Rotate slowly
            projected = rot(u_time * 0.08 + ft * 0.5) * projected;

            float dist = length(uv - projected);

            // Trail glow
            float glow = exp(-dist * (25.0 + u_treble * 15.0));
            // Brighter core
            float core = exp(-dist * (80.0 + u_rms * 40.0));

            // Color varies along trajectory
            float fi = float(i);
            float hue = trailHue + fi * 0.003 + pt.x * 0.01;
            vec3 tint = 0.5 + 0.5 * cos(6.2831 * (hue + vec3(0.0, 0.33, 0.67)));
            // Warm up the colors
            tint *= vec3(1.0 + u_bass * 0.3, 0.8 + u_mid * 0.4, 0.9 + u_treble * 0.5);

            col += tint * glow * 0.012;
            col += vec3(1.0, 0.95, 0.9) * core * 0.008;
          }
        }

        // Beat flash at attractor centers (the two lobes)
        vec2 lobe1 = vec2(-0.28, 0.0) * rot(u_time * 0.08);
        vec2 lobe2 = vec2(0.28, 0.0) * rot(u_time * 0.08);
        float flash1 = exp(-length(uv - lobe1) * (8.0 + u_beat * 12.0));
        float flash2 = exp(-length(uv - lobe2) * (8.0 + u_beat * 12.0));
        col += vec3(0.8, 0.5, 1.0) * (flash1 + flash2) * beatMorph * 0.6;

        // Subtle fog
        vec3 fog = vec3(0.01, 0.012, 0.025);
        fog += vec3(0.06, 0.04, 0.1) * exp(-length(uv) * 2.0);
        col += fog;

        // Vignette
        col *= 1.0 - smoothstep(0.9, 1.5, length(uv));
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
window.VJamFX.presets['butterfly-effect'] = ButterflyEffectPreset;
})();
