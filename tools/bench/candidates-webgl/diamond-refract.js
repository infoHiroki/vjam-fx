(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class DiamondRefractPreset extends BasePreset {
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

      #define PI 3.14159265
      #define TAU 6.28318530

      // Rotation matrix
      mat2 rot(float a) {
        float c = cos(a), s = sin(a);
        return mat2(c, -s, s, c);
      }

      // Hexagonal distance for crystal facets
      float hexDist(vec2 p) {
        p = abs(p);
        return max(p.x * 0.866025 + p.y * 0.5, p.y);
      }

      // Triangular facet SDF
      float triDist(vec2 p) {
        float k = sqrt(3.0);
        p.x = abs(p.x) - 1.0;
        p.y = p.y + 1.0 / k;
        if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) * 0.5;
        p.x -= clamp(p.x, -2.0, 0.0);
        return -length(p) * sign(p.y);
      }

      // Diamond SDF: combination of triangular facets
      float diamondSDF(vec2 p, float size) {
        float d = 1e9;
        // Crown facets (top)
        d = min(d, hexDist(p / size) - 1.0);
        // Table facet
        d = min(d, length(p) / size - 0.4);
        // Pavilion facets using rotated triangles
        for (int i = 0; i < 6; i++) {
          float a = float(i) * TAU / 6.0;
          vec2 rp = p * rot(a);
          d = min(d, abs(rp.x / size) + abs(rp.y / size) * 0.7 - 0.8);
        }
        return d;
      }

      // Rainbow spectrum from wavelength-like parameter
      vec3 spectrum(float t) {
        vec3 c;
        t = fract(t);
        if (t < 0.167) c = mix(vec3(1.0, 0.0, 0.2), vec3(1.0, 0.3, 0.0), t / 0.167);
        else if (t < 0.333) c = mix(vec3(1.0, 0.3, 0.0), vec3(1.0, 1.0, 0.0), (t - 0.167) / 0.166);
        else if (t < 0.5) c = mix(vec3(1.0, 1.0, 0.0), vec3(0.0, 1.0, 0.2), (t - 0.333) / 0.167);
        else if (t < 0.667) c = mix(vec3(0.0, 1.0, 0.2), vec3(0.0, 0.5, 1.0), (t - 0.5) / 0.167);
        else if (t < 0.833) c = mix(vec3(0.0, 0.5, 1.0), vec3(0.3, 0.0, 1.0), (t - 0.667) / 0.166);
        else c = mix(vec3(0.3, 0.0, 1.0), vec3(1.0, 0.0, 0.2), (t - 0.833) / 0.167);
        return c;
      }

      // Internal reflection / kaleidoscope fold
      vec2 kaleidoFold(vec2 p, float n) {
        float angle = TAU / n;
        float a = atan(p.y, p.x);
        a = mod(a, angle) - angle * 0.5;
        return length(p) * vec2(cos(a), abs(sin(a)));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        vec3 col = vec3(0.0);

        float crystalSize = 0.28 + u_bass * 0.1;
        float rotSpeed = u_time * (0.3 + u_bass * 0.5);
        float dispersion = 0.06 + u_mid * 0.12;
        float sparkle = u_treble;
        float beatFlash = u_beat;

        // Tumbling crystal rotation
        vec2 ruv = uv * rot(rotSpeed * 0.7);
        ruv *= rot(sin(u_time * 0.4) * 0.5);

        // Kaleidoscopic internal reflections
        vec2 kuv = kaleidoFold(ruv, 6.0);

        // Diamond facet pattern
        float diam = diamondSDF(kuv, crystalSize);
        float facetEdge = smoothstep(0.015, 0.0, abs(diam));

        // Chromatic dispersion: stronger split for vivid RGB separation
        vec2 rUv = kuv * rot(dispersion * 1.5);
        vec2 gUv = kuv * rot(-dispersion * 0.2);
        vec2 bUv = kuv * rot(-dispersion * 1.8);

        float rDiam = diamondSDF(rUv, crystalSize * 0.92);
        float gDiam = diamondSDF(gUv, crystalSize);
        float bDiam = diamondSDF(bUv, crystalSize * 1.08);

        float rChannel = smoothstep(0.05, -0.15, rDiam);
        float gChannel = smoothstep(0.05, -0.15, gDiam);
        float bChannel = smoothstep(0.05, -0.15, bDiam);

        col = vec3(rChannel, gChannel, bChannel);

        // Rainbow spectrum bands: saturated, high contrast
        float specAngle = atan(ruv.y, ruv.x) / TAU + 0.5;
        float specDist = length(ruv) / crystalSize;
        float specT = specAngle * 2.0 + specDist * 1.5 + u_time * 0.12;
        vec3 specCol = spectrum(specT);
        specCol = pow(specCol, vec3(0.7)) * 1.4; // boost saturation

        // Internal caustic patterns
        float caustic = 0.0;
        vec2 cuv = kuv * 5.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          vec2 cp = cuv * rot(fi * 1.047 + u_time * 0.3);
          caustic += sin(cp.x * 5.0 + u_time) * sin(cp.y * 5.0 - u_time * 0.7) * 0.35;
        }
        caustic = abs(caustic);

        // Combine: strong chromatic split + vivid spectrum + caustics
        float insideDiamond = smoothstep(0.03, -0.08, diam);
        col = col * 0.6 + specCol * insideDiamond * (0.5 + caustic * 0.5);
        col += vec3(caustic * 0.1) * insideDiamond;

        // Facet edge highlights (bright white)
        col += vec3(1.0) * facetEdge * (0.6 + sparkle * 1.5);

        // Sparkle on facet intersections
        float facetSpark = 0.0;
        for (int i = 0; i < 6; i++) {
          float a = float(i) * TAU / 6.0 + rotSpeed * 0.3;
          vec2 dir = vec2(cos(a), sin(a));
          float line = abs(dot(ruv, dir));
          facetSpark += smoothstep(0.008, 0.0, line) * smoothstep(crystalSize * 1.2, 0.0, length(ruv));
        }
        col += vec3(1.0, 0.95, 0.9) * facetSpark * (0.4 + sparkle * 2.5);

        // Dispersed light rays outside crystal
        float outsideDiamond = 1.0 - insideDiamond;
        float rayAngle = atan(ruv.y, ruv.x);
        float rays = 0.0;
        for (int i = 0; i < 6; i++) {
          float a = float(i) * TAU / 6.0 + rotSpeed * 0.2;
          float diff = abs(mod(rayAngle - a + PI, TAU) - PI);
          rays += smoothstep(0.15, 0.0, diff) * exp(-max(diam, 0.0) * 4.0);
        }
        col += spectrum(specT + 0.5) * rays * outsideDiamond * 0.6;

        // Beat flash
        col += specCol * beatFlash * 2.0 * insideDiamond;
        col += vec3(1.0, 0.95, 0.9) * beatFlash * 0.5 * exp(-length(uv) * 4.0);

        // Outer glow (tighter, more colorful)
        float outerGlow = exp(-max(diam, 0.0) * 8.0);
        col += spectrum(specT + 0.3) * outerGlow * 0.2;

        // Dark background
        col *= smoothstep(1.2, 0.0, length(uv));

        // Tone mapping: preserve saturation
        col = col / (col + vec3(0.8));
        col = pow(col, vec3(0.85));

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['diamond-refract'] = DiamondRefractPreset;
})();
