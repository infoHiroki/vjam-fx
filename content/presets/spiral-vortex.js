(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SpiralVortexPreset extends BasePreset {
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
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
        return v;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        float t = u_time;

        // Polar coordinates
        float r = length(uv);
        float angle = atan(uv.y, uv.x);

        // Spiral parameters driven by audio
        float arms = 3.0 + u_mid * 2.0;
        float twist = 6.0 + u_bass * 4.0;
        float rotSpeed = 1.0 + u_beat * 3.0;

        // Beat causes direction burst
        float dir = 1.0 + u_beat * 2.0;

        // Spiral pattern: angle + radius * twist creates arms
        float spiral = angle * arms + r * twist - t * rotSpeed * dir;

        // Add noise displacement for organic feel
        float n = fbm(uv * 3.0 + t * 0.3) * 0.5;
        float fineNoise = noise(uv * 12.0 + t * 0.5) * u_treble * 0.4;
        spiral += n + fineNoise;

        // Create bands along the spiral
        float band = sin(spiral) * 0.5 + 0.5;
        band = smoothstep(0.1, 0.6, band);

        // Secondary spiral layer for depth
        float spiral2 = angle * (arms + 1.0) - r * twist * 0.7 + t * rotSpeed * 0.6;
        spiral2 += n * 0.8;
        float band2 = sin(spiral2) * 0.5 + 0.5;
        band2 = smoothstep(0.2, 0.7, band2) * 0.5;

        // Cosine palette for color
        float colorPhase = spiral * 0.3 + t * 0.2 + r * 2.0;
        vec3 col;
        col.r = 0.5 + 0.5 * cos(colorPhase);
        col.g = 0.5 + 0.5 * cos(colorPhase + 2.094);
        col.b = 0.5 + 0.5 * cos(colorPhase + 4.189);

        // Secondary color layer
        vec3 col2;
        float cp2 = spiral2 * 0.4 + t * 0.15;
        col2.r = 0.5 + 0.5 * cos(cp2 + 1.0);
        col2.g = 0.5 + 0.5 * cos(cp2 + 3.0);
        col2.b = 0.5 + 0.5 * cos(cp2 + 5.0);

        // Combine spiral bands with colors
        vec3 result = col * band + col2 * band2;

        // Center glow
        float glow = exp(-r * r * 4.0) * (0.8 + u_bass * 0.4);
        result += vec3(0.9, 0.7, 1.0) * glow;

        // Bass increases overall brightness and saturation
        result *= 0.9 + u_bass * 0.3;

        // Beat flash
        result += vec3(0.3, 0.2, 0.4) * u_beat * 0.5;

        // Ensure full screen coverage with background
        float bg = 0.08 + 0.04 * sin(angle * 2.0 + t * 0.1);
        result = max(result, vec3(bg * 0.5, bg * 0.3, bg * 0.6));

        gl_FragColor = vec4(result, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['spiral-vortex'] = SpiralVortexPreset;
})();
