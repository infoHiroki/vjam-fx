(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class HilmaAltarPreset extends BasePreset {
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
        preset._time += 0.012 + preset._sBass * 0.015;
        preset.beatPulse *= 0.88;
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
      precision highp float;
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      // --- helpers ---
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      // Smooth triangle SDF (upward-pointing)
      // Returns negative inside, positive outside
      float triangleSDF(vec2 p, float r) {
        // equilateral triangle centered at origin, pointing up
        float k = sqrt(3.0);
        p.x = abs(p.x) - r;
        p.y = p.y + r / k;
        if (p.x + k * p.y > 0.0) { p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0; }
        p.x -= clamp(p.x, -2.0 * r, 0.0);
        return -length(p) * sign(p.y);
      }

      float circleSDF(vec2 p, float r) { return length(p) - r; }

      // Rainbow hue-to-RGB
      vec3 hue2rgb(float h) {
        h = mod(h, 1.0);
        float r = abs(h * 6.0 - 3.0) - 1.0;
        float g = 2.0 - abs(h * 6.0 - 2.0);
        float b = 2.0 - abs(h * 6.0 - 4.0);
        return clamp(vec3(r, g, b), 0.0, 1.0);
      }

      // Soft glow band
      float band(float d, float w) { return smoothstep(w, 0.0, abs(d)); }

      void main() {
        // Centered, aspect-corrected UV
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        float t = u_time;

        // Bass drives breathing scale of the whole composition
        float scale = 0.34 + u_bass * 0.08 + u_beat * 0.06;
        vec2 p = uv / scale;

        // ---- Deep indigo background ----
        vec3 bg = vec3(0.04, 0.04, 0.18);
        // Subtle radial dark vignette
        bg += vec3(0.0, 0.0, 0.06) * exp(-length(uv) * 2.5);

        // ---- Central triangle (upward pointing) ----
        // Shift centroid slightly upward for spiritual composition
        vec2 triCenter = vec2(0.0, 0.04);
        float triSize = 0.38;
        float dTri = triangleSDF(p - triCenter / scale, triSize);

        // ---- Inscribed / overlapping circle ----
        // Circle centered at triangle centroid, radius = inradius
        float circR = triSize * 0.5;
        float dCirc = circleSDF(p - triCenter / scale, circR);

        // ---- Vertical symmetry: fold x ----
        vec2 symP = vec2(abs(p.x), p.y);

        // ---- Rainbow gradient phase controlled by mid ----
        float hueBase = t * 0.04 + u_mid * 0.6;
        // Radial + vertical hue variation for flowing spectrum
        float hueField = hueBase + length(p) * 0.18 + (p.y + 0.3) * 0.25;

        // ---- Layered fill colors inside shapes ----
        vec3 col = bg;

        // Fill triangle interior with semi-transparent rainbow
        float triMask = smoothstep(0.012, -0.012, dTri);
        vec3 rainbowTri = hue2rgb(hueField + 0.1) * 0.65 + vec3(0.1, 0.05, 0.2) * 0.35;
        // Second layer shifted hue for depth
        vec3 rainbowTri2 = hue2rgb(hueField + 0.45) * 0.4;
        float innerGlow = exp(-max(dTri, 0.0) * 8.0) * 0.7;
        col = mix(col, rainbowTri + rainbowTri2 * 0.5, triMask * 0.72);
        col += rainbowTri * innerGlow * triMask;

        // Fill circle interior with complementary rainbow, semi-transparent overlay
        float circMask = smoothstep(0.012, -0.012, dCirc);
        vec3 rainbowCirc = hue2rgb(hueField + 0.55) * 0.7 + vec3(0.05, 0.0, 0.15) * 0.3;
        col = mix(col, rainbowCirc, circMask * 0.6);

        // Luminous center spot — spiritual "light source"
        float centerGlow = exp(-length(p - triCenter / scale) * 5.5) * (0.6 + u_bass * 0.3 + u_beat * 0.5);
        col += vec3(0.95, 0.92, 0.85) * centerGlow * 0.55;

        // ---- Gold outlines ----
        vec3 gold = vec3(1.0, 0.82, 0.22);
        // Triangle outline
        float triEdge = band(dTri, 0.007);
        col += gold * triEdge * (0.9 + u_treble * 0.4);
        // Outer thick gold glow on triangle edge
        float triGlow = exp(-abs(dTri) * 18.0) * 0.35;
        col += gold * triGlow * (0.5 + u_treble * 0.3);

        // Circle outline
        float circEdge = band(dCirc, 0.006);
        col += gold * circEdge * (0.85 + u_treble * 0.4);
        float circGlow = exp(-abs(dCirc) * 20.0) * 0.28;
        col += gold * circGlow * (0.45 + u_treble * 0.3);

        // ---- Gold shimmer/light rays driven by treble ----
        // Radiating lines from center — Hilma's spiritual rays
        float angle = atan(uv.y - 0.04 * scale, uv.x);
        float rayPattern = abs(sin(angle * 12.0 + t * 0.3));
        float rayMask = pow(rayPattern, 6.0) * exp(-length(uv) * 3.5);
        col += gold * rayMask * u_treble * 0.6;

        // Secondary finer rays
        float rayPattern2 = abs(sin(angle * 24.0 - t * 0.5));
        float rayMask2 = pow(rayPattern2, 8.0) * exp(-length(uv) * 5.0);
        col += vec3(1.0, 0.95, 0.7) * rayMask2 * u_treble * 0.35;

        // ---- Concentric halos (spiritual aura rings) ----
        float r = length(p - triCenter / scale);
        for (int i = 1; i <= 4; i++) {
          float ringR = 0.25 + float(i) * 0.18;
          float ring = exp(-abs(r - ringR) * 14.0) * 0.08;
          vec3 ringCol = hue2rgb(hueField + float(i) * 0.15 + 0.2);
          col += ringCol * ring * (0.4 + u_mid * 0.3);
        }

        // ---- Beat radiant burst from center ----
        float burstR = exp(-length(uv) * (3.0 - u_beat * 2.2)) * u_beat;
        col += vec3(1.0, 0.92, 0.75) * burstR * 0.9;
        // Beat also brightens outlines briefly
        col += gold * burstR * triEdge * 1.5;
        col += gold * burstR * circEdge * 1.5;

        // ---- Overall luminance lift and soft clamp ----
        col *= 0.92 + u_bass * 0.12;
        col = pow(max(col, vec3(0.0)), vec3(0.92)); // slight gamma lift for glow

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['hilma-altar'] = HilmaAltarPreset;
})();
