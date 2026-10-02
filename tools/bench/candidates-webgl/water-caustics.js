(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class WaterCausticsPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
    this.beatPulse = 0;
    this._shader = null;
    this._time = 0;
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
        preset._time += 0.025 + preset.audio.bass * 0.04;
        preset.beatPulse *= 0.88;
        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
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
      attribute vec2 aTexCoord;
      varying vec2 vUv;
      void main() { vUv = aTexCoord; vec4 pos = vec4(aPosition, 1.0); pos.xy = pos.xy * 2.0 - 1.0; gl_Position = pos; }
    `;
    const frag = `
      precision highp float;
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      // Compact hash for caustic cell generation
      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }

      // Single caustic layer using voronoi distance field
      float causticLayer(vec2 uv, float time, float scale) {
        uv *= scale;
        vec2 i = floor(uv);
        vec2 f = fract(uv);

        float minDist = 1.0;
        float secondDist = 1.0;

        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = hash2(i + neighbor);
            // Animate cell centers with time
            point = 0.5 + 0.5 * sin(time * 0.8 + 6.2831 * point);
            vec2 diff = neighbor + point - f;
            float d = dot(diff, diff);
            if (d < minDist) {
              secondDist = minDist;
              minDist = d;
            } else if (d < secondDist) {
              secondDist = d;
            }
          }
        }

        // Caustic brightness from edge proximity between cells
        return smoothstep(0.0, 0.15, secondDist - minDist);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        float t = u_time;
        float rippleScale = 1.0 + u_mid * 0.5;

        // Three overlapping caustic layers at different scales and speeds
        float c1 = causticLayer(uv + vec2(t * 0.03, t * 0.02), t * (0.8 + u_mid * 0.3), 3.0 * rippleScale);
        float c2 = causticLayer(uv + vec2(-t * 0.02, t * 0.04), t * (1.1 + u_mid * 0.2), 5.0 * rippleScale);
        float c3 = causticLayer(uv + vec2(t * 0.01, -t * 0.03), t * (1.5 + u_mid * 0.4), 8.0 * rippleScale);

        // Combine layers: large soft caustics + medium + fine detail
        float caustic = c1 * 0.5 + c2 * 0.35 + c3 * 0.15 * (1.0 + u_treble * 2.0);

        // Fine shimmer from treble
        float shimmer = causticLayer(uv * 1.5 + vec2(t * 0.05), t * 2.0, 12.0);
        caustic += shimmer * 0.12 * (0.3 + u_treble * 1.5);

        // Bass boosts overall caustic intensity
        float intensity = 0.7 + u_bass * 0.6 + u_beat * 0.8;
        caustic *= intensity;

        // Deep water base color: dark blue gradient
        float depth = length(uv) * 0.3;
        vec3 deepColor = vec3(0.01, 0.04, 0.12);
        vec3 midColor = vec3(0.02, 0.10, 0.22);
        vec3 baseColor = mix(midColor, deepColor, depth);

        // Caustic light color: cyan/teal with bright white peaks
        vec3 causticColorLow = vec3(0.05, 0.35, 0.45);
        vec3 causticColorHigh = vec3(0.4, 0.85, 0.9);
        vec3 causticWhite = vec3(0.95, 0.98, 1.0);

        vec3 lightColor = mix(causticColorLow, causticColorHigh, smoothstep(0.2, 0.6, caustic));
        lightColor = mix(lightColor, causticWhite, smoothstep(0.65, 0.9, caustic));

        // Combine base water with caustic lighting
        vec3 col = baseColor + lightColor * caustic * 0.9;

        // Beat flash: bright white pulse across the entire surface
        col += vec3(0.5, 0.7, 0.8) * u_beat * 0.6;

        // Subtle surface ripple darkening at edges
        float vignette = 1.0 - smoothstep(0.4, 1.2, length(uv));
        col *= 0.7 + vignette * 0.3;

        col = clamp(col, 0.0, 1.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['water-caustics'] = WaterCausticsPreset;
})();
