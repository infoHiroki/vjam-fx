(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Cymatics — Chladni plate vibration patterns
 * Simulates sand on a vibrating plate forming geometric patterns.
 * Audio directly controls the vibration modes (m,n parameters).
 */
class CymaticsPreset extends BasePreset {
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
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }
        preset._time += 0.008 + preset.audio.rms * 0.02;
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
        } catch (e) {} finally { p.resetShader(); }
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
      void main() { vUv = aTexCoord; vec4 pos = vec4(aPosition, 1.0); pos.xy = pos.xy * 2.0 - 1.0; gl_Position = pos; }
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

      // Chladni pattern: cos(m*pi*x)*cos(n*pi*y) - cos(n*pi*x)*cos(m*pi*y)
      float chladni(vec2 p, float m, float n) {
        float a = cos(m * 3.14159 * p.x) * cos(n * 3.14159 * p.y);
        float b = cos(n * 3.14159 * p.x) * cos(m * 3.14159 * p.y);
        return a - b;
      }

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

        // Audio-driven mode numbers — bass selects fundamental, treble adds harmonics
        float m1 = 2.0 + floor(u_bass * 4.0 + u_time * 0.3);
        float n1 = 3.0 + floor(u_mid * 3.0 + u_time * 0.2);
        float m2 = m1 + 2.0 + u_treble * 3.0;
        float n2 = n1 + 1.0 + u_treble * 2.0;

        // Slow rotation for visual interest
        float angle = u_time * 0.15 + u_bass * 0.3;
        float ca = cos(angle), sa = sin(angle);
        vec2 ruv = vec2(uv.x * ca - uv.y * sa, uv.x * sa + uv.y * ca);

        // Two overlapping Chladni patterns
        float c1 = chladni(ruv * (1.0 + u_rms * 0.5), m1, n1);
        float c2 = chladni(ruv * (1.2 + u_bass * 0.3), m2, n2);

        // Combine — "sand" accumulates near nodal lines (where pattern ≈ 0)
        float pattern = abs(c1) + abs(c2) * 0.6;

        // Sharp sand line threshold
        float sand = 1.0 - smoothstep(0.0, 0.08 + u_rms * 0.05, pattern);

        // Additional fine grain texture
        float grain = hash(floor(gl_FragCoord.xy * 0.5 + u_time * 10.0)) * 0.15;
        sand += grain * sand;

        // Beat: plate vibration flash
        float flash = u_beat * 0.4;

        // Color: warm sand on dark plate
        vec3 plateColor = vec3(0.02, 0.02, 0.04) + flash * vec3(0.1, 0.05, 0.15);
        vec3 sandColor = vec3(0.85, 0.78, 0.6);

        // Treble shifts sand color toward cyan
        sandColor = mix(sandColor, vec3(0.5, 0.9, 0.95), u_treble * 0.6);

        // Edge glow at nodal lines
        float edgeDist = smoothstep(0.12, 0.02, pattern);
        vec3 glowColor = mix(vec3(0.2, 0.4, 0.8), vec3(0.8, 0.3, 0.5), u_mid);
        vec3 glow = glowColor * edgeDist * (0.3 + u_rms * 0.5 + u_beat * 0.8);

        vec3 col = mix(plateColor, sandColor, sand) + glow;

        // Vignette (simple multiply, no loop)
        float vig = 1.0 - dot(uv, uv) * 0.8;
        col *= max(0.0, vig);

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = Math.min(1, s); }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['cymatics'] = CymaticsPreset;
})();
