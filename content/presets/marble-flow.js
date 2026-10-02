(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class MarbleFlowPreset extends BasePreset {
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
        preset._sBass   += (preset.audio.bass   - preset._sBass)   * k;
        preset._sMid    += (preset.audio.mid    - preset._sMid)    * k;
        preset._sTreble += (preset.audio.treble - preset._sTreble) * k;
        preset._time += 0.008 + preset._sBass * 0.012;
        preset.beatPulse *= 0.88;
        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time',       preset._time);
          preset._shader.setUniform('u_bass',       preset._sBass);
          preset._shader.setUniform('u_mid',        preset._sMid);
          preset._shader.setUniform('u_treble',     preset._sTreble);
          preset._shader.setUniform('u_beat',       preset.beatPulse);
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
      uniform vec2  u_resolution;

      // ----------------------------------------------------------------
      // Value noise helpers
      // ----------------------------------------------------------------
      float hash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i),               hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      // ----------------------------------------------------------------
      // FBM — fractal Brownian motion (6 octaves for rich veining)
      // ----------------------------------------------------------------
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(1.6,  1.2, -1.2, 1.6); // each octave rotated + scaled
        for (int i = 0; i < 6; i++) {
          v += a * vnoise(p);
          p = rot * p;
          a *= 0.5;
        }
        return v;
      }

      // ----------------------------------------------------------------
      // Domain-warped FBM — gives the liquid-marble look
      // ----------------------------------------------------------------
      float marbleFbm(vec2 p, float warpStrength) {
        // First warp pass: compute displacement field
        vec2 q = vec2(
          fbm(p + vec2(0.0, 0.0)),
          fbm(p + vec2(5.2, 1.3))
        );
        // Second warp pass: add temporal drift
        vec2 r = vec2(
          fbm(p + 4.0 * q + vec2(1.7, 9.2) + u_time * 0.04),
          fbm(p + 4.0 * q + vec2(8.3, 2.8) + u_time * 0.04)
        );
        // Final sample with combined warps (mid controls warp amount)
        float w = warpStrength * (0.6 + u_mid * 0.8);
        return fbm(p + w * r);
      }

      // ----------------------------------------------------------------
      // Vein extraction from FBM value
      // Returns vein brightness (0 = background, 1 = bright vein)
      // ----------------------------------------------------------------
      float vein(float f, float thickness) {
        // Sine-based banding, sharpened with smoothstep
        float band = abs(sin(f * 8.0 * 3.14159));
        return smoothstep(1.0 - thickness, 1.0, band);
      }

      // ----------------------------------------------------------------
      // Marble colour palette
      // ----------------------------------------------------------------
      // Dark charcoal base
      vec3 BASE_COLOR       = vec3(0.08, 0.08, 0.09);
      // White / light-grey vein
      vec3 WHITE_VEIN       = vec3(0.90, 0.90, 0.88);
      // Mid-grey vein (secondary)
      vec3 GREY_VEIN        = vec3(0.55, 0.54, 0.52);
      // Gold accent on bright vein highlights
      vec3 GOLD_ACCENT      = vec3(0.95, 0.78, 0.30);
      // Deep green tint (rare vein layer)
      vec3 GREEN_VEIN       = vec3(0.14, 0.28, 0.18);
      // Burgundy tint (rare vein layer)
      vec3 BURGUNDY_VEIN    = vec3(0.38, 0.07, 0.10);

      void main() {
        // Normalised coords: centre = (0,0), height = 1
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // -----------------------------------------------------------
        // Layer 1 — primary marble (large, slow flow)
        // -----------------------------------------------------------
        vec2 p1 = uv * 2.8 + vec2(u_time * 0.015, u_time * 0.008);
        float f1 = marbleFbm(p1, 1.8);

        // Bass controls vein thickness
        float thick1 = 0.28 + u_bass * 0.28;
        float v1     = vein(f1, thick1);

        // -----------------------------------------------------------
        // Layer 2 — secondary marble (finer, faster)
        // -----------------------------------------------------------
        vec2 p2 = uv * 4.5 + vec2(-u_time * 0.022, u_time * 0.013) + vec2(3.1, 7.4);
        float f2 = marbleFbm(p2, 1.2);
        float thick2 = 0.18 + u_bass * 0.18;
        float v2     = vein(f2, thick2);

        // -----------------------------------------------------------
        // Layer 3 — rare accent veins (deep colour, very fine)
        // -----------------------------------------------------------
        vec2 p3 = uv * 7.0 + vec2(u_time * 0.031, -u_time * 0.009) + vec2(11.5, 2.3);
        float f3 = marbleFbm(p3, 0.7);
        float thick3 = 0.10 + u_bass * 0.10;
        float v3     = vein(f3, thick3);

        // -----------------------------------------------------------
        // Decide rare colour accent from hash of position
        // -----------------------------------------------------------
        float accentSel = hash(floor(uv * 3.0));
        vec3 rareVeinColor = accentSel < 0.5 ? GREEN_VEIN : BURGUNDY_VEIN;

        // -----------------------------------------------------------
        // Depth / sub-surface scattering illusion
        // Simulate light catching on vein edges by evaluating thin border
        // -----------------------------------------------------------
        float edgeMask1  = vein(f1, thick1 + 0.04) - v1;   // thin rim around vein
        float edgeMask2  = vein(f2, thick2 + 0.03) - v2;
        float edgeMask   = max(edgeMask1, edgeMask2);

        // Light direction: slow circular orbit
        float lt  = u_time * 0.25;
        vec2  ldir = vec2(cos(lt), sin(lt * 0.7));
        float lightCatch = max(0.0, dot(normalize(uv + 0.001), ldir));
        float edgeGlow   = edgeMask * lightCatch * (0.5 + u_treble * 1.2);

        // -----------------------------------------------------------
        // Gold shimmer on vein highlights (treble)
        // Fine-grain specular on brightest vein areas
        // -----------------------------------------------------------
        float specNoise = vnoise(uv * 22.0 + u_time * 0.6);
        float goldShimmer = v1 * specNoise * specNoise * u_treble * 2.0;

        // -----------------------------------------------------------
        // Beat pulse: all veins flare brighter briefly
        // -----------------------------------------------------------
        float beatBoost = u_beat * 0.55;

        // -----------------------------------------------------------
        // Compose colour
        // -----------------------------------------------------------
        // Start: charcoal base
        vec3 col = BASE_COLOR;

        // Add secondary grey veins (lower layer)
        col = mix(col, GREY_VEIN, v2 * 0.55);

        // Rare accent veins (lowest opacity, occasional colour)
        col = mix(col, rareVeinColor, v3 * 0.40);

        // Primary white veins (dominant, semi-opaque for depth)
        col = mix(col, WHITE_VEIN, v1 * (0.75 + beatBoost));

        // Edge depth lighting (creates illusion of 3D veins)
        col += edgeGlow * GREY_VEIN * 0.35;

        // Gold shimmer on treble
        col += goldShimmer * GOLD_ACCENT;

        // Beat: veins flash bright white overall
        col += u_beat * v1 * 0.35 * vec3(1.0, 0.97, 0.92);

        // -----------------------------------------------------------
        // Subtle surface polish — specular hotspot from orbiting light
        // -----------------------------------------------------------
        float polish = exp(-length(uv - ldir * 0.4) * 4.5) * (0.04 + u_treble * 0.08);
        col += polish * vec3(0.98, 0.96, 0.88);

        // -----------------------------------------------------------
        // Vignette — darken edges for stone slab depth
        // -----------------------------------------------------------
        float vig = 1.0 - dot(uv * 0.95, uv * 0.95);
        vig = clamp(vig, 0.0, 1.0);
        vig = pow(vig, 1.2);
        col *= 0.60 + 0.40 * vig;

        // -----------------------------------------------------------
        // Tone / gamma — slight warm push on highlights
        // -----------------------------------------------------------
        col = pow(max(col, vec3(0.0)), vec3(1.05, 1.08, 1.12));

        col = clamp(col, 0.0, 1.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) {
    this.audio.bass   = d.bass   || 0;
    this.audio.mid    = d.mid    || 0;
    this.audio.treble = d.treble || 0;
    this.audio.rms    = d.rms    || 0;
  }

  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['marble-flow'] = MarbleFlowPreset;
})();
