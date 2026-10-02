(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class StainedGlassGpuPreset extends BasePreset {
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

      // Hash functions for voronoi and noise
      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }

      float hash1(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      // Simple value noise for glass texture
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash1(i);
        float b = hash1(i + vec2(1.0, 0.0));
        float c = hash1(i + vec2(0.0, 1.0));
        float d = hash1(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // Voronoi with distance to nearest edge
      vec3 voronoi(vec2 x, float t) {
        vec2 n = floor(x);
        vec2 f = fract(x);

        float md = 8.0;   // min distance to cell center
        float md2 = 8.0;  // second min distance
        vec2 mg;          // cell center offset
        vec2 mr;          // vector to nearest center

        // Find nearest cell center
        for (int j = -1; j <= 1; j++)
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = hash2(n + g);
          // Animate seed points slowly
          o = 0.5 + 0.4 * sin(t * 0.3 + 6.2831 * o);
          vec2 r = g + o - f;
          float d = dot(r, r);
          if (d < md) {
            md2 = md;
            md = d;
            mr = r;
            mg = g;
          } else if (d < md2) {
            md2 = d;
          }
        }

        // Edge detection: distance to voronoi edge
        md = 8.0;
        for (int j = -2; j <= 2; j++)
        for (int i = -2; i <= 2; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = hash2(n + g);
          o = 0.5 + 0.4 * sin(t * 0.3 + 6.2831 * o);
          vec2 r = g + o - f;
          if (dot(r - mr, r - mr) > 0.00001) {
            md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
          }
        }

        // Return: cellID hash, distance to center, distance to edge
        float cellId = hash1(n + mg);
        return vec3(cellId, sqrt(md2) - sqrt(md), md);
      }

      // Jewel tone palette: ruby, sapphire, emerald, amber, amethyst
      vec3 jewelColor(float id, float hueShift) {
        float h = id * 5.0;
        float idx = floor(h);
        float f = fract(h);

        vec3 c;
        if (idx < 1.0) {
          c = mix(vec3(0.72, 0.05, 0.12), vec3(0.85, 0.10, 0.15), f); // ruby
        } else if (idx < 2.0) {
          c = mix(vec3(0.08, 0.15, 0.70), vec3(0.12, 0.25, 0.85), f); // sapphire
        } else if (idx < 3.0) {
          c = mix(vec3(0.05, 0.55, 0.18), vec3(0.10, 0.70, 0.25), f); // emerald
        } else if (idx < 4.0) {
          c = mix(vec3(0.85, 0.60, 0.08), vec3(0.95, 0.75, 0.12), f); // amber
        } else {
          c = mix(vec3(0.50, 0.10, 0.65), vec3(0.65, 0.18, 0.80), f); // amethyst
        }

        // Apply hue shift from mid audio
        float angle = hueShift * 0.5;
        float cosA = cos(angle);
        float sinA = sin(angle);
        vec3 k = vec3(0.577);
        c = c * cosA + cross(k, c) * sinA + k * dot(k, c) * (1.0 - cosA);

        return clamp(c, 0.0, 1.0);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Scale for cell density
        vec2 st = uv * 5.0;

        // Voronoi
        vec3 vor = voronoi(st, u_time);
        float cellId = vor.x;
        float edgeDist = vor.z; // distance to edge

        // Cell color - rich jewel tones
        float sat = 0.8 + u_mid * 0.2;
        vec3 cellColor = jewelColor(cellId, u_mid * 2.0);
        cellColor = mix(vec3(dot(cellColor, vec3(0.299, 0.587, 0.114))), cellColor, sat);

        // Glass texture - subtle noise imperfection
        float tex = vnoise(st * 8.0 + cellId * 10.0) * 0.15 + 0.85;
        cellColor *= tex;

        // Moving light source
        float lt = u_time * 0.4;
        vec2 lightPos = vec2(sin(lt) * 0.6, cos(lt * 0.7) * 0.4);
        float lightDist = length(uv - lightPos);
        float lightIntensity = 1.0 / (1.0 + lightDist * 3.0);
        lightIntensity *= (0.6 + u_bass * 0.8);

        // Apply light to cells
        cellColor *= (0.5 + lightIntensity * 1.2);

        // Lead outlines between cells
        float leadWidth = 0.04;
        float lead = smoothstep(leadWidth, leadWidth + 0.02, edgeDist);

        // Lead color: dark with subtle treble glow
        vec3 leadColor = vec3(0.02, 0.02, 0.03);
        float leadGlow = u_treble * 0.4;
        leadColor += vec3(0.15, 0.12, 0.08) * leadGlow;

        // Combine cell and lead
        vec3 col = mix(leadColor, cellColor, lead);

        // Beat flash - sunlight burst
        float flash = u_beat * 0.7;
        col += vec3(1.0, 0.95, 0.8) * flash * lightIntensity;

        // Warm cathedral ambient
        col += vec3(0.06, 0.03, 0.01);

        // Slight vignette for depth
        float vig = 1.0 - dot(uv, uv) * 0.4;
        col *= vig;

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
window.VJamFX.presets['stained-glass-gpu'] = StainedGlassGpuPreset;
})();
