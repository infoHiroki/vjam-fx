(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ElectricStormPreset extends BasePreset {
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

      // Hash functions for noise
      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }

      float hash1(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      // Value noise
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash1(i);
        float b = hash1(i + vec2(1.0, 0.0));
        float c = hash1(i + vec2(0.0, 1.0));
        float d = hash1(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // FBM for discharge branching
      float fbm(vec2 p, int octaves) {
        float val = 0.0;
        float amp = 0.5;
        float freq = 1.0;
        for (int i = 0; i < 6; i++) {
          if (i >= octaves) break;
          val += amp * noise(p * freq);
          freq *= 2.0;
          amp *= 0.5;
        }
        return val;
      }

      // Voronoi distance to nearest edge (for lightning bolt paths)
      float voronoiEdge(vec2 p, float t) {
        vec2 ip = floor(p);
        vec2 fp = fract(p);

        float d1 = 8.0; // nearest
        float d2 = 8.0; // second nearest

        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 nb = vec2(float(x), float(y));
            vec2 o = hash2(ip + nb);
            o = 0.5 + 0.5 * sin(t * 0.7 + 6.2831 * o);
            vec2 diff = nb + o - fp;
            float d = dot(diff, diff);
            if (d < d1) {
              d2 = d1;
              d1 = d;
            } else if (d < d2) {
              d2 = d;
            }
          }
        }
        return d2 - d1;
      }

      // Lightning bolt function
      float lightning(vec2 uv, float t, float seed, float thickness) {
        // Main bolt path using distorted line
        float x = uv.x + seed;
        float yOff = fbm(vec2(x * 3.0 + seed, t * 1.5), 4) * 0.6;
        float dist = abs(uv.y - yOff);
        // Add jitter for electric feel
        dist += fbm(vec2(uv.x * 8.0 + seed * 3.0, t * 3.0 + seed), 3) * 0.05;
        float bolt = thickness / (dist + 0.01);
        return clamp(bolt, 0.0, 1.0);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        float t = u_time;

        // Audio-reactive parameters
        float thickness = 0.008 + u_bass * 0.015;
        float branchOctaves = 3.0 + u_mid * 3.0;
        int octaves = int(branchOctaves);
        float flickerRate = 1.0 + u_treble * 4.0;
        float beatFlash = u_beat;

        // Dark storm background (deep purple/navy gradient)
        vec3 bgColor = mix(
          vec3(0.02, 0.01, 0.06),  // deep purple
          vec3(0.01, 0.02, 0.08),  // dark navy
          uv.y * 0.5 + 0.5
        );
        // Subtle storm clouds via fbm
        float clouds = fbm(uv * 2.0 + vec2(t * 0.05, 0.0), 4);
        bgColor += vec3(0.03, 0.02, 0.06) * clouds;

        // === Voronoi lightning network ===
        float scale = 3.0 + u_mid * 2.0;
        float edge = voronoiEdge(uv * scale + vec2(t * 0.3, t * 0.15), t);
        // Sharp edges become lightning paths
        float edgeLine = smoothstep(0.08 + u_bass * 0.06, 0.0, edge);
        // Flicker the voronoi network
        float flicker = 0.5 + 0.5 * sin(t * flickerRate * 6.2831 + hash1(floor(uv * scale)) * 6.28);
        flicker = mix(0.3, 1.0, flicker);
        edgeLine *= flicker;

        // === Fractal discharge bolts ===
        float bolt1 = lightning(uv, t, 0.0, thickness);
        float bolt2 = lightning(uv * 1.3 + vec2(0.5, -0.3), t * 1.1, 3.7, thickness * 0.7);
        float bolt3 = lightning(uv * 0.8 + vec2(-0.4, 0.2), t * 0.9, 7.3, thickness * 0.5);

        // Vertical bolts
        vec2 uvR = vec2(uv.y, uv.x); // rotate 90 degrees
        float bolt4 = lightning(uvR * 1.2, t * 0.8, 11.1, thickness * 0.6);

        float bolts = bolt1 + bolt2 * 0.7 + bolt3 * 0.5 + bolt4 * 0.4;
        bolts = clamp(bolts, 0.0, 1.0);

        // Flicker bolts with treble
        float boltFlicker = 0.6 + 0.4 * sin(t * flickerRate * 12.0 + uv.x * 5.0);
        bolts *= boltFlicker;

        // === Branching sparks (small fractal detail) ===
        float sparks = fbm(uv * 12.0 + vec2(t * 2.0, t * 1.5), octaves);
        sparks = pow(sparks, 3.0) * 2.0;
        sparks *= (0.5 + 0.5 * sin(t * flickerRate * 20.0));
        sparks *= u_treble * 0.8;

        // === Combine lightning elements ===
        float totalLight = edgeLine * 0.6 + bolts + sparks * 0.3;

        // Electric color: blue core → cyan → white at bright spots
        vec3 elecColor1 = vec3(0.2, 0.4, 1.0);   // electric blue
        vec3 elecColor2 = vec3(0.3, 0.8, 1.0);    // cyan
        vec3 elecColor3 = vec3(0.9, 0.95, 1.0);   // near white

        vec3 lightning_color = mix(elecColor1, elecColor2, clamp(totalLight, 0.0, 1.0));
        lightning_color = mix(lightning_color, elecColor3, clamp(totalLight - 0.5, 0.0, 1.0));

        // Glow around lightning
        float glow = totalLight * 0.3;
        vec3 glowColor = vec3(0.1, 0.2, 0.6) * glow;

        // === Beat discharge flash ===
        vec3 flashColor = vec3(0.7, 0.85, 1.0) * beatFlash * 0.6;
        // Radial flash burst on beat
        float radial = length(uv);
        float burstRing = smoothstep(0.3, 0.0, abs(radial - beatFlash * 2.0)) * beatFlash;
        flashColor += vec3(0.4, 0.6, 1.0) * burstRing;

        // === Final composition ===
        vec3 color = bgColor + glowColor;
        color += lightning_color * totalLight;
        color += flashColor;

        // Bass-reactive ambient pulse
        color += vec3(0.05, 0.03, 0.12) * u_bass * 0.5;

        // Vignette
        float vig = 1.0 - dot(uv * 0.7, uv * 0.7);
        color *= clamp(vig, 0.0, 1.0);

        gl_FragColor = vec4(color, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['electric-storm'] = ElectricStormPreset;
})();
