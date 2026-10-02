(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class StainedGlassNeonPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
    this.beatPulse = 0;
    this._shader = null;
    this._time = 0;
    this._sBass = 0;
    this._sMid = 0;
    this._sTreble = 0;
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
        const k = 0.12;
        preset._sBass += (preset.audio.bass - preset._sBass) * k;
        preset._sMid += (preset.audio.mid - preset._sMid) * k;
        preset._sTreble += (preset.audio.treble - preset._sTreble) * k;
        preset._time += 0.016 + preset._sMid * 0.02;
        preset.beatPulse *= 0.85;
        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset._sBass);
          preset._shader.setUniform('u_mid', preset._sMid);
          preset._shader.setUniform('u_treble', preset._sTreble);
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

      // Hash functions
      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }

      float hash1(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      float hash1f(float n) {
        return fract(sin(n) * 43758.5453);
      }

      // Voronoi returning (cellId, dist-to-center, dist-to-edge)
      vec3 voronoi(vec2 x, float t) {
        vec2 n = floor(x);
        vec2 f = fract(x);

        float md = 8.0;
        float md2 = 8.0;
        vec2 mg;
        vec2 mr;

        for (int j = -1; j <= 1; j++)
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = hash2(n + g);
          // Mid drives slow morphing of cell positions
          o = 0.5 + 0.45 * sin(t * (0.2 + u_mid * 0.15) + 6.2831 * o);
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

        // Edge distance pass
        float edgeDist = 8.0;
        for (int j = -2; j <= 2; j++)
        for (int i = -2; i <= 2; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = hash2(n + g);
          o = 0.5 + 0.45 * sin(t * (0.2 + u_mid * 0.15) + 6.2831 * o);
          vec2 r = g + o - f;
          if (dot(r - mr, r - mr) > 0.00001) {
            edgeDist = min(edgeDist, dot(0.5 * (mr + r), normalize(r - mr)));
          }
        }

        float cellId = hash1(n + mg);
        return vec3(cellId, sqrt(md2) - sqrt(md), edgeDist);
      }

      // Neon color palette: hot pink, cyan, electric purple, lime green
      vec3 neonColor(float id) {
        float h = fract(id * 4.13 + 0.1);
        vec3 c;
        if (h < 0.25) {
          // Hot pink
          c = vec3(1.0, 0.07, 0.57);
        } else if (h < 0.5) {
          // Cyan
          c = vec3(0.0, 1.0, 0.95);
        } else if (h < 0.75) {
          // Electric purple
          c = vec3(0.72, 0.0, 1.0);
        } else {
          // Lime green
          c = vec3(0.18, 1.0, 0.08);
        }
        return c;
      }

      // Simple value noise for crackle texture
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

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Scale for cell density
        vec2 st = uv * 4.5;

        // Voronoi
        vec3 vor = voronoi(st, u_time);
        float cellId = vor.x;
        float edgeDist = vor.z;

        // Neon color for this cell's border
        vec3 neon = neonColor(cellId);

        // Glass panes: nearly black interior
        vec3 paneColor = vec3(0.01, 0.01, 0.015);
        // Faint tint of neon color leaks into pane interior
        paneColor += neon * 0.04;

        // Border glow width: bass makes it thicker/brighter
        float baseWidth = 0.06;
        float glowWidth = baseWidth + u_bass * 0.08;

        // Smooth edge mask: 0 = at edge, 1 = deep in pane
        float edgeMask = smoothstep(0.0, glowWidth, edgeDist);

        // Glow falloff from edge
        float glowIntensity = exp(-edgeDist * (6.0 - u_bass * 3.0));
        glowIntensity = clamp(glowIntensity, 0.0, 1.0);

        // Pulsing neon glow: bass drives brightness
        float neonBrightness = 1.5 + u_bass * 2.5;

        // Treble crackle/flicker on edges
        float crackleFreq = 30.0 + u_treble * 20.0;
        float crackle = vnoise(st * crackleFreq + u_time * 8.0 * u_treble);
        crackle = pow(crackle, 2.0);
        float flickerAmp = u_treble * 1.2;
        float edgeFlicker = 1.0 + crackle * flickerAmp * (1.0 - edgeMask);

        // Neon border color: bright neon glow
        vec3 borderColor = neon * neonBrightness * glowIntensity * edgeFlicker;

        // Combine: pane interior + neon border glow on top
        vec3 col = paneColor * edgeMask + borderColor * (1.0 - edgeMask * 0.95);
        col += neon * glowIntensity * 0.3 * (1.0 - edgeMask);

        // Beat: neon flash ripple from center outward
        float beatRipple = 0.0;
        if (u_beat > 0.01) {
          float dist = length(uv);
          // Ripple front expands outward over time
          float ripplePos = u_beat * 1.5;
          float ripple = exp(-pow(dist - ripplePos, 2.0) * 30.0);
          beatRipple = ripple * u_beat * 3.0;
        }
        col += neon * beatRipple * glowIntensity;
        // Beat also causes a global neon flash that fades
        col += neon * u_beat * 0.4 * glowIntensity;

        // Thin hot core line at exact edge (very bright)
        float coreWidth = 0.012 + u_bass * 0.01;
        float core = smoothstep(coreWidth, 0.0, edgeDist);
        col += neon * core * (2.0 + u_bass * 3.0) * edgeFlicker;

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
window.VJamFX.presets['stained-glass-neon'] = StainedGlassNeonPreset;
})();
