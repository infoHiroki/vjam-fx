(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class NebulaCloudPreset extends BasePreset {
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
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      // Hash for star field
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      // Smooth noise
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

      // FBM with rotation between octaves
      float fbm(vec2 p) {
        float val = 0.0;
        float amp = 0.5;
        float freq = 1.0;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 5; i++) {
          val += amp * noise(p * freq);
          p = rot * p;
          freq *= 2.1;
          amp *= 0.5;
        }
        return val;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Beat expansion
        float beatScale = 1.0 - u_beat * 0.15;
        uv *= beatScale;

        // Slow swirl motion
        float t = u_time * 0.15;
        float angle = length(uv) * 0.5 + t * 0.3;
        mat2 swirl = mat2(cos(angle * 0.1), -sin(angle * 0.1), sin(angle * 0.1), cos(angle * 0.1));
        vec2 swirlUv = swirl * uv;

        // Multi-layer nebula using domain-warped FBM
        vec2 q = vec2(
          fbm(swirlUv + vec2(0.0, 0.0) + t * 0.4),
          fbm(swirlUv + vec2(5.2, 1.3) + t * 0.3)
        );
        vec2 r = vec2(
          fbm(swirlUv + 4.0 * q + vec2(1.7, 9.2) + t * 0.2),
          fbm(swirlUv + 4.0 * q + vec2(8.3, 2.8) + t * 0.25)
        );
        float f = fbm(swirlUv + 3.5 * r);

        // Nebula density with bass boost
        float density = f * f * (1.2 + u_bass * 0.8);

        // Color palette with mid-driven hue shift
        float hueShift = u_mid * 1.5;
        vec3 col1 = vec3(0.15, 0.05, 0.35);   // deep purple
        vec3 col2 = vec3(0.1, 0.15, 0.55);     // deep blue
        vec3 col3 = vec3(0.6, 0.1, 0.5);       // magenta
        vec3 col4 = vec3(0.9, 0.4, 0.2);       // warm orange
        vec3 col5 = vec3(0.95, 0.55, 0.6);     // pink highlight

        // Rotate palette colors based on mid
        float h = hueShift;
        col1 = mix(col1, col3, sin(h) * 0.5 + 0.5);
        col2 = mix(col2, vec3(0.2, 0.05, 0.5), sin(h * 0.7) * 0.5 + 0.5);
        col4 = mix(col4, col5, sin(h * 1.3) * 0.5 + 0.5);

        // Build color from density layers
        vec3 color = col1;
        color = mix(color, col2, smoothstep(0.1, 0.4, density));
        color = mix(color, col3, smoothstep(0.3, 0.6, density));
        color = mix(color, col4, smoothstep(0.5, 0.8, density));
        color = mix(color, col5, smoothstep(0.7, 1.0, density));

        // Core glow emission
        float core = exp(-length(uv) * 2.5) * (0.4 + u_bass * 0.6 + u_beat * 0.5);
        color += vec3(0.6, 0.3, 0.7) * core;

        // Secondary glow hotspots
        float glow1 = exp(-length(uv - vec2(0.3, 0.2)) * 4.0) * density;
        float glow2 = exp(-length(uv + vec2(0.2, 0.3)) * 4.0) * density;
        color += vec3(0.4, 0.15, 0.5) * glow1 * 0.6;
        color += vec3(0.2, 0.3, 0.6) * glow2 * 0.6;

        // Star field
        vec2 starUv = gl_FragCoord.xy / 3.0;
        float star = hash(floor(starUv));
        float starBright = step(0.985, star);
        // Twinkle based on treble
        float twinkle = sin(star * 100.0 + u_time * 3.0) * 0.5 + 0.5;
        twinkle = mix(0.3, 1.0, twinkle);
        starBright *= twinkle * (0.5 + u_treble * 1.5);
        // Dim stars where nebula is bright
        starBright *= (1.0 - smoothstep(0.2, 0.6, density));
        color += vec3(0.9, 0.9, 1.0) * starBright;

        // Overall brightness with bass
        color *= 0.9 + u_bass * 0.3;

        // Gentle vignette
        float vig = 1.0 - length(uv) * 0.6;
        vig = clamp(vig, 0.0, 1.0);
        color *= vig;

        // Clamp output
        color = clamp(color, 0.0, 1.0);

        gl_FragColor = vec4(color, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['nebula-cloud'] = NebulaCloudPreset;
})();
