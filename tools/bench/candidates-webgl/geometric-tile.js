(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class GeometricTilePreset extends BasePreset {
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

      #define PI 3.14159265359
      #define TAU 6.28318530718

      // Rotate 2D point
      vec2 rot(vec2 p, float a) {
        float c = cos(a), s = sin(a);
        return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
      }

      // Hexagonal tiling: returns cell center and local coords
      vec4 hexTile(vec2 p) {
        vec2 a = mod(p, vec2(1.5, sqrt(3.0))) - vec2(0.75, sqrt(3.0) * 0.5);
        vec2 b = mod(p + vec2(0.75, sqrt(3.0) * 0.5), vec2(1.5, sqrt(3.0))) - vec2(0.75, sqrt(3.0) * 0.5);
        vec2 g = length(a) < length(b) ? a : b;
        vec2 id = p - g;
        return vec4(g, id);
      }

      // 6-fold angular symmetry
      vec2 fold6(vec2 p) {
        float a = atan(p.y, p.x);
        a = mod(a, PI / 3.0) - PI / 6.0;
        return length(p) * vec2(cos(a), abs(sin(a)));
      }

      // Star/rosette SDF within a hex cell
      float starSDF(vec2 p, float r1, float r2, int n) {
        float an = PI / float(n);
        float a = atan(p.y, p.x);
        float sector = mod(a, 2.0 * an) - an;
        vec2 q = length(p) * vec2(cos(sector), abs(sin(sector)));
        // Line from (r1,0) to (r2*cos(an), r2*sin(an))
        vec2 A = vec2(r1, 0.0);
        vec2 B = r2 * vec2(cos(an), sin(an));
        vec2 ab = B - A;
        float t = clamp(dot(q - A, ab) / dot(ab, ab), 0.0, 1.0);
        return length(q - A - ab * t);
      }

      // Geometric interlocking line pattern
      float geometricLines(vec2 p, float scale) {
        vec2 sp = p * scale;

        // Apply slow rotation
        sp = rot(sp, u_time * 0.05);

        vec4 hex = hexTile(sp);
        vec2 lp = hex.xy; // local position in cell

        // 6-fold symmetry within cell
        vec2 fp = fold6(lp);

        // Multiple concentric star layers
        float d = 1.0;

        // Outer star frame
        float s1 = starSDF(lp, 0.45, 0.25, 6);
        d = min(d, s1);

        // Inner rosette
        float s2 = starSDF(lp, 0.25, 0.15, 6);
        d = min(d, s2);

        // Connecting lines between cells (interlocking weave)
        float line1 = abs(fp.y - fp.x * 0.577) - 0.008; // 30-degree lines
        float line2 = abs(fp.x - 0.35) - 0.008;
        float weave = min(line1, line2);
        d = min(d, weave * 0.7);

        // Radial spokes
        float spoke = abs(fp.y) - 0.006;
        d = min(d, spoke * 0.8);

        return d;
      }

      // Jewel tone palette: gold, deep blue, emerald, ruby
      vec3 jewelColor(float t) {
        // 4 jewel colors
        vec3 gold    = vec3(0.85, 0.68, 0.15);
        vec3 blue    = vec3(0.08, 0.15, 0.55);
        vec3 emerald = vec3(0.05, 0.55, 0.30);
        vec3 ruby    = vec3(0.70, 0.05, 0.15);

        t = mod(t, 4.0);
        if (t < 1.0) return mix(gold, blue, t);
        if (t < 2.0) return mix(blue, emerald, t - 1.0);
        if (t < 3.0) return mix(emerald, ruby, t - 2.0);
        return mix(ruby, gold, t - 3.0);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Pattern scale reacts to bass
        float scale = 4.0 + u_bass * 2.0;

        // Get geometric pattern distance
        float d = geometricLines(uv, scale);

        // Beat pulse: radial wave
        float dist = length(uv);
        float pulse = smoothstep(0.02, 0.0, abs(dist - u_beat * 1.5)) * u_beat;

        // Line rendering with glow
        float lineWidth = 0.012;
        float glowWidth = 0.06 + u_treble * 0.04;
        float line = smoothstep(lineWidth, 0.0, d);
        float glow = exp(-d * (15.0 - u_treble * 5.0)) * (0.4 + u_treble * 0.6);

        // Color cycling controlled by mid
        float colorSpeed = 0.3 + u_mid * 0.5;
        float colorPhase = u_time * colorSpeed;

        // Different color per region using angle and distance
        float angle = atan(uv.y, uv.x);
        float regionColor = colorPhase + angle / TAU * 2.0 + dist * 1.5;

        vec3 lineColor = jewelColor(regionColor);
        vec3 glowColor = jewelColor(regionColor + 1.0) * 0.6;

        // Fill regions with subtle color
        float fillPhase = colorPhase + dist * 2.0 + angle / TAU;
        vec3 fillColor = jewelColor(fillPhase + 2.0) * 0.08;

        // Compose: dark background + colored fill + glowing lines
        vec3 bg = vec3(0.02, 0.01, 0.03);
        vec3 col = bg + fillColor;

        // Add line glow
        col += glowColor * glow;

        // Add bright line core
        col += lineColor * line * (1.0 + u_treble * 0.5);

        // Beat pulse overlay
        vec3 pulseColor = jewelColor(colorPhase + 3.0);
        col += pulseColor * pulse * 0.8;

        // Subtle vignette
        float vig = 1.0 - dot(uv, uv) * 0.4;
        col *= vig;

        // Clamp output
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
window.VJamFX.presets['geometric-tile'] = GeometricTilePreset;
})();
