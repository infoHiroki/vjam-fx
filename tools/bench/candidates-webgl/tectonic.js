(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Tectonic — Continental plates grinding and splitting.
 * Bass drives plate movement, beat triggers quakes with lava eruptions.
 * Treble controls magma glow intensity. Cracks widen with rms.
 */
class TectonicPreset extends BasePreset {
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
        preset._time += 0.01 + preset.audio.bass * 0.02;
        preset.beatPulse *= 0.88;

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
        for (int i = 0; i < 5; i++) { v += noise(p) * a; p *= 2.1; a *= 0.5; }
        return v;
      }

      // Voronoi for plate boundaries
      vec2 voronoi(vec2 p) {
        vec2 n = floor(p);
        float md = 8.0, md2 = 8.0;
        for (int j = -1; j <= 1; j++)
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = vec2(hash(n + g), hash(n + g + 99.0));
          o = 0.5 + 0.5 * sin(u_time * 0.3 + 6.28 * o + u_bass * 0.5);
          float d = length(p - n - g - o);
          if (d < md) { md2 = md; md = d; }
          else if (d < md2) { md2 = d; }
        }
        return vec2(md, md2);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

        // Scale for plate size
        vec2 p = uv * (3.0 + u_mid);

        // Plate drift with bass
        p += vec2(sin(u_time * 0.2) * u_bass * 0.3, cos(u_time * 0.15) * u_bass * 0.2);

        vec2 v = voronoi(p);
        float edge = v.y - v.x; // Distance between nearest boundaries
        float crack = smoothstep(0.05 + u_rms * 0.08, 0.0, edge); // Crack width from rms

        // Plate surface — dark rock with noise texture
        float rock = fbm(p * 4.0 + u_time * 0.05);
        vec3 plateCol = vec3(0.06, 0.05, 0.04) + rock * vec3(0.04, 0.03, 0.03);
        plateCol += fbm(p * 8.0) * 0.03; // fine grain

        // Hue cycling for color variation
        float hueShift = u_time * 0.1;
        vec3 hueA = 0.5 + 0.5 * cos(6.28318 * (hueShift + vec3(0.0, 0.33, 0.67)));
        vec3 hueB = 0.5 + 0.5 * cos(6.28318 * (hueShift + 0.15 + vec3(0.0, 0.33, 0.67)));

        // Magma in cracks — treble drives glow
        float magmaIntensity = crack * (0.6 + u_treble * 1.5 + u_beat * 2.0);
        float magmaFlow = fbm(p * 6.0 - vec2(u_time * 0.8, u_time * 0.5));
        vec3 magmaBase = mix(
          vec3(0.8, 0.1, 0.0),   // deep red
          vec3(1.0, 0.7, 0.1),   // bright orange-yellow
          magmaFlow * 0.7 + u_treble * 0.3
        );
        vec3 magmaCol = magmaBase * (0.5 + hueA * 0.8);
        magmaCol *= magmaIntensity;

        // Earthquake pulse on beat — ripple from cracks
        float quake = u_beat * sin(edge * 40.0 - u_time * 15.0) * 0.08;
        plateCol += quake;

        // Combine
        vec3 col = mix(plateCol, magmaCol, crack * 0.9);

        // Global lava glow from below — hue shifted
        col += hueB * vec3(0.2, 0.08, 0.03) * u_bass * 0.8;

        // Beat flash — hue shifted
        col += hueA * vec3(1.2, 0.6, 0.15) * u_beat * crack * 0.5;

        // Vignette
        float vig = 1.0 - dot(uv, uv) * 0.6;
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
window.VJamFX.presets['tectonic'] = TectonicPreset;
})();
