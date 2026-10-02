(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class KaleidoscopeGpuPreset extends BasePreset {
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
        preset._time += 0.02 + preset.audio.bass * 0.03;
        preset.beatPulse *= 0.9;
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

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
        return v;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        float t = u_time;

        // Convert to polar
        float r = length(uv);
        float a = atan(uv.y, uv.x);

        // Kaleidoscope: mirror reflections
        float segments = 6.0 + floor(u_mid * 4.0); // 6-10 segments
        float segAngle = 3.14159 * 2.0 / segments;
        a = mod(a, segAngle);
        a = abs(a - segAngle * 0.5);

        // Back to cartesian (kaleidoscoped)
        vec2 kuv = vec2(cos(a), sin(a)) * r;

        // Animated source pattern
        kuv += t * 0.08;
        kuv *= 1.0 + u_bass * 0.1;

        // Multiple layered patterns (higher scale = more detail)
        float p1 = fbm(kuv * 5.0 + vec2(t * 0.12, t * 0.08));
        float p2 = fbm(kuv * 8.0 - vec2(t * 0.08, t * 0.15) + u_treble * 0.5);
        float p3 = sin(r * 12.0 - t * 1.5 + u_bass * 3.0) * 0.5 + 0.5;

        float pattern = p1 * 0.5 + p2 * 0.3 + p3 * 0.2;

        // Color palette
        vec3 col1 = vec3(0.9, 0.1, 0.4);
        vec3 col2 = vec3(0.1, 0.5, 0.9);
        vec3 col3 = vec3(0.9, 0.8, 0.1);
        vec3 col4 = vec3(0.1, 0.9, 0.6);

        float hueShift = t * 0.1;
        vec3 col = mix(col1, col2, smoothstep(0.2, 0.5, pattern + sin(hueShift) * 0.2));
        col = mix(col, col3, smoothstep(0.5, 0.7, pattern + cos(hueShift * 1.3) * 0.2));
        col = mix(col, col4, smoothstep(0.7, 0.9, pattern));

        // Center glow (subtle)
        float glow = exp(-r * 4.0) * 0.15;
        col += glow * (0.5 + 0.5 * cos(t * 0.5 + vec3(0, 2, 4)));

        // Radial fade (gentler, preserves more of the pattern)
        col *= smoothstep(1.3, 0.1, r);

        // Beat pulse from center
        col += exp(-r * (5.0 - u_beat * 3.0)) * u_beat * 0.5 * vec3(1.0, 0.8, 0.9);

        // Brightness
        col *= 0.9 + u_bass * 0.2;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['kaleidoscope-gpu'] = KaleidoscopeGpuPreset;
})();
