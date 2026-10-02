(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PixelGridPreset extends BasePreset {
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

      // Simple hash for noise
      float hash(vec2 p) {
        float h = dot(p, vec2(127.1, 311.7));
        return fract(sin(h) * 43758.5453);
      }

      // Value noise
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

      // Plasma pattern
      vec3 plasma(vec2 p, float t) {
        float speed = 1.0 + u_mid * 2.0;
        float v1 = sin(p.x * 3.0 + t * speed);
        float v2 = sin(p.y * 3.0 + t * speed * 0.7);
        float v3 = sin((p.x + p.y) * 2.0 + t * speed * 0.5);
        float v4 = sin(length(p) * 4.0 - t * speed * 0.8);
        float v = (v1 + v2 + v3 + v4) * 0.25;

        // Vibrant 8-bit palette
        vec3 col;
        col.r = sin(v * 3.14159 * 2.0) * 0.5 + 0.5;
        col.g = sin(v * 3.14159 * 2.0 + 2.094) * 0.5 + 0.5;
        col.b = sin(v * 3.14159 * 2.0 + 4.188) * 0.5 + 0.5;

        // Quantize colors to 8-bit levels
        col = floor(col * 6.0) / 5.0;

        return col;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Beat glitch offset
        float glitch = u_beat * 0.08;
        float glitchLine = step(0.97, hash(vec2(floor(gl_FragCoord.y * 0.05), floor(u_time * 30.0))));
        uv.x += glitch * glitchLine * (hash(vec2(floor(u_time * 60.0), 0.0)) * 2.0 - 1.0);

        // Pixel block size: bass makes it chunkier
        float blockSize = 8.0 + u_bass * 24.0;
        vec2 pixelUV = floor(gl_FragCoord.xy / blockSize) * blockSize;
        vec2 blockCenter = (pixelUV + blockSize * 0.5 - u_resolution * 0.5) / u_resolution.y;

        // Local coordinate within the block (0..1)
        vec2 localUV = fract(gl_FragCoord.xy / blockSize);

        // Get color from plasma for this block
        vec3 col = plasma(blockCenter * 3.0, u_time);

        // Add noise variation
        float n = noise(blockCenter * 5.0 + u_time * 0.3);
        col = mix(col, col * (0.7 + n * 0.6), 0.5);

        // --- CRT Phosphor Dot ---
        // Rounded dot within each pixel block
        vec2 dotUV = localUV * 2.0 - 1.0;
        float dotDist = length(dotUV);
        float dot = smoothstep(0.95, 0.5, dotDist);
        col *= dot;

        // --- RGB Subpixel Simulation ---
        // Split each dot into 3 vertical stripes for R, G, B
        float subX = localUV.x * 3.0;
        float subIdx = floor(subX);
        float subEdge = smoothstep(0.0, 0.15, fract(subX)) * smoothstep(1.0, 0.85, fract(subX));

        vec3 subpixel;
        if (subIdx < 1.0) {
          subpixel = vec3(col.r * 1.4, col.g * 0.2, col.b * 0.2);
        } else if (subIdx < 2.0) {
          subpixel = vec3(col.r * 0.2, col.g * 1.4, col.b * 0.2);
        } else {
          subpixel = vec3(col.r * 0.2, col.g * 0.2, col.b * 1.4);
        }
        col = mix(col * 0.6, subpixel, subEdge * 0.5);

        // --- CRT Scanlines ---
        float scanline = sin(gl_FragCoord.y * 3.14159) * 0.5 + 0.5;
        float scanIntensity = 0.15 + u_treble * 0.35;
        col *= 1.0 - scanIntensity * (1.0 - scanline);

        // Slight vignette
        vec2 screenUV = gl_FragCoord.xy / u_resolution;
        float vignette = 1.0 - 0.3 * length((screenUV - 0.5) * 1.5);
        col *= vignette;

        // Screen curvature effect (subtle barrel distortion darkening at edges)
        vec2 curved = (screenUV - 0.5) * 2.0;
        float curvature = 1.0 - 0.06 * (curved.x * curved.x + curved.y * curved.y);
        col *= curvature;

        // Brightness boost
        col *= 1.3;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['pixel-grid'] = PixelGridPreset;
})();
