(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Woodcut — Animated woodblock print aesthetic.
 * Bold black lines carve through the screen. Bass drives carving depth,
 * treble adds fine hatching, beat reveals new layers.
 */
class WoodcutPreset extends BasePreset {
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
        preset._time += 0.006 + preset.audio.mid * 0.015;
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

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 6; i++) { v += noise(p) * a; p *= 2.05; a *= 0.5; }
        return v;
      }

      // Hatching lines at angle
      float hatch(vec2 uv, float angle, float freq, float width) {
        float c = cos(angle), s = sin(angle);
        float projected = uv.x * c + uv.y * s;
        return smoothstep(width, 0.0, abs(fract(projected * freq) - 0.5));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);
        float t = u_time;

        // Base form — flowing landscape/figure shapes from fbm
        vec2 p = uv * 2.5;
        p += vec2(sin(t * 0.3), cos(t * 0.2)) * 0.3;
        float form = fbm(p + t * 0.1);
        float form2 = fbm(p * 1.5 + vec2(t * 0.15, -t * 0.1) + 5.0);

        // Depth layers — bass carves deeper
        float depth = form * (0.6 + u_bass * 0.8);
        depth += form2 * 0.3 * (1.0 + u_mid * 0.5);

        // Bold contour lines
        float contourFreq = 6.0 + u_bass * 4.0;
        float contour = smoothstep(0.04, 0.0, abs(fract(depth * contourFreq) - 0.5));
        contour *= 0.7 + u_bass * 0.3;

        // Cross-hatching — treble adds density
        float h1 = hatch(uv, 0.4 + t * 0.05, 20.0 + u_treble * 30.0, 0.15);
        float h2 = hatch(uv, -0.6 + t * 0.03, 25.0 + u_treble * 25.0, 0.12);
        float h3 = hatch(uv, 1.2 + sin(t) * 0.1, 35.0 + u_treble * 40.0, 0.08);

        // Hatching only in shadow areas
        float shadow = 1.0 - depth;
        float hatching = (h1 * 0.5 + h2 * 0.3 + h3 * 0.2 * u_treble) * shadow;
        hatching *= 0.4 + u_treble * 0.6;

        // Ink color — warm black on cream
        vec3 paper = vec3(0.92, 0.88, 0.78);
        vec3 ink = vec3(0.05, 0.04, 0.06);

        // Beat reveals different layer
        float reveal = u_beat * 0.5;
        float beatForm = fbm(p * 1.8 + 10.0 + t * 0.3);
        float beatContour = smoothstep(0.05, 0.0, abs(fract(beatForm * 8.0) - 0.5));

        float totalInk = max(contour, hatching) + beatContour * reveal;
        totalInk = clamp(totalInk, 0.0, 1.0);

        // Ink bleed on rms
        totalInk += fbm(uv * 30.0 + t) * u_rms * 0.15;

        vec3 col = mix(paper, ink, totalInk);

        // Slight aged paper tone
        col *= 0.95 + noise(gl_FragCoord.xy * 0.5) * 0.08;

        // Beat warm flash
        col += vec3(0.15, 0.08, 0.02) * u_beat * 0.4;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = Math.min(1, s); }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['woodcut'] = WoodcutPreset;
})();
