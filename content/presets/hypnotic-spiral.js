(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class HypnoticSpiralPreset extends BasePreset {
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
      precision mediump float;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      // Simple hash-based noise
      float hash(vec2 p) {
        float h = dot(p, vec2(127.1, 311.7));
        return fract(sin(h) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Polar coordinates
        float r = length(uv);
        float angle = atan(uv.y, uv.x);

        // Noise distortion on edges for organic feel
        float n = noise(uv * 4.0 + u_time * 0.3) * 0.15;
        angle += n * smoothstep(0.0, 0.8, r);

        // Number of spiral arms: 3 base, mid adds up to 2 more
        float arms = 3.0 + floor(u_mid * 2.99);

        // Logarithmic spiral: angle + log(r) creates spiral shape
        // Rotation speed driven by time and bass
        float rotSpeed = u_time * (1.2 + u_bass * 2.0);

        // Beat causes direction reversal pulse
        float directionMod = 1.0 - u_beat * 2.0;

        // Expansion/contraction pulsation
        float expansion = sin(u_time * 0.8 + u_bass * 3.0) * (0.5 + u_bass * 1.0);
        expansion += u_beat * 3.0; // beat zoom pulse

        // Core spiral pattern
        float logSpiral = log(max(r, 0.001)) * 3.0;
        float spiral = sin(angle * arms + logSpiral * (4.0 + expansion) - rotSpeed * directionMod);

        // Sharpen for high contrast B&W bands
        float band = smoothstep(-0.1, 0.1, spiral);

        // Secondary spiral layer for depth
        float spiral2 = sin(angle * (arms + 1.0) - logSpiral * 3.5 + rotSpeed * 0.7);
        float band2 = smoothstep(-0.15, 0.15, spiral2);

        // Combine layers
        float pattern = mix(band, band2, 0.25);

        // Center glow
        float glow = exp(-r * 3.0) * 0.3;
        pattern += glow;

        // Vignette
        float vignette = 1.0 - smoothstep(0.3, 1.4, r);
        pattern *= vignette;

        // Base B&W color
        vec3 color = vec3(pattern);

        // Treble-driven color tinting
        if (u_treble > 0.05) {
          float tintAmount = u_treble;
          vec3 tint1 = vec3(0.6, 0.1, 0.9); // purple
          vec3 tint2 = vec3(0.1, 0.8, 0.7); // cyan
          vec3 tintColor = mix(tint1, tint2, sin(angle * 2.0 + u_time) * 0.5 + 0.5);
          color = mix(color, tintColor * pattern, tintAmount * 0.7);
        }

        // Beat flash
        color += vec3(u_beat * 0.3);

        gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['hypnotic-spiral'] = HypnoticSpiralPreset;
})();
