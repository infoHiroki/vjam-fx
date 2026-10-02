(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class DeepCausticsPreset extends BasePreset {
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
        preset._time += 0.018 + preset._sMid * 0.03;
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
      uniform vec2 u_resolution;

      // --- Hash / noise utilities ---
      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }

      float hash1(vec2 p) {
        p = fract(p * vec2(234.31, 851.73));
        p += dot(p, p + 47.31);
        return fract(p.x * p.y);
      }

      // FBM-style value noise for water warp
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash1(i);
        float b = hash1(i + vec2(1.0, 0.0));
        float c = hash1(i + vec2(0.0, 1.0));
        float d = hash1(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      // Domain-warped FBM — used to distort caustic UVs like actual water surface
      float fbm(vec2 p, int octaves) {
        float v = 0.0;
        float amp = 0.5;
        float freq = 1.0;
        for (int i = 0; i < 5; i++) {
          if (i >= octaves) break;
          v += amp * noise(p * freq);
          freq *= 2.1;
          amp *= 0.45;
        }
        return v;
      }

      // Voronoi caustic layer — returns edge-proximity brightness
      float causticLayer(vec2 uv, float timeOff, float scale) {
        uv *= scale;
        vec2 i = floor(uv);
        vec2 f = fract(uv);
        float d1 = 1.0, d2 = 1.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 nb = vec2(float(x), float(y));
            vec2 pt = hash2(i + nb);
            pt = 0.5 + 0.5 * sin(timeOff + 6.2831 * pt);
            vec2 diff = nb + pt - f;
            float d = dot(diff, diff);
            if (d < d1) { d2 = d1; d1 = d; }
            else if (d < d2) { d2 = d; }
          }
        }
        return smoothstep(0.0, 0.12, d2 - d1);
      }

      void main() {
        // UV centred, aspect-correct
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        float t = u_time;

        // --- Deep-ocean depth gradient ---
        // Y goes up → shallower (brighter from the surface above)
        float depthY = uv.y * 0.5 + 0.5;          // 0 = bottom, 1 = top/surface
        vec3 abyssColor  = vec3(0.00, 0.01, 0.06); // pitch-black abyss
        vec3 deepColor   = vec3(0.01, 0.04, 0.14); // deep navy
        vec3 midColor    = vec3(0.01, 0.08, 0.22); // mid-water teal-blue
        vec3 baseColor   = mix(abyssColor, midColor, depthY * depthY);

        // --- Domain warp: simulates the moving water surface above ---
        float bassWarp = 0.08 + u_bass * 0.18;
        vec2 warpOff = vec2(
          fbm(uv * 2.5 + vec2(t * 0.07,  t * 0.04), 3),
          fbm(uv * 2.5 + vec2(t * 0.04, -t * 0.06), 3)
        ) * bassWarp;
        vec2 warpedUV = uv + warpOff;

        // --- Four caustic layers at different depths / scales / speeds ---
        float midSpeed = 0.7 + u_mid * 0.5;
        float c1 = causticLayer(warpedUV + vec2( t * 0.025,  t * 0.015), t * (0.6 * midSpeed), 2.5);
        float c2 = causticLayer(warpedUV + vec2(-t * 0.018,  t * 0.032), t * (0.9 * midSpeed), 4.2);
        float c3 = causticLayer(warpedUV + vec2( t * 0.012, -t * 0.028), t * (1.2 * midSpeed), 7.0);
        float c4 = causticLayer(warpedUV + vec2(-t * 0.022,  t * 0.011), t * (1.6 * midSpeed), 11.0);

        // Deeper layers attenuated — only the upper layers receive strong light
        float surfaceMask = smoothstep(-0.6, 0.5, uv.y); // light fades toward bottom
        float caustic = (c1 * 0.42 + c2 * 0.30 + c3 * 0.18 + c4 * 0.10) * surfaceMask;

        // Bass controls caustic brightness
        float caustBright = 0.5 + u_bass * 0.9;
        caustic *= caustBright;

        // --- Caustic coloring: dark teal base → bright cyan peak ---
        vec3 causticLow  = vec3(0.02, 0.22, 0.32);
        vec3 causticMid  = vec3(0.04, 0.55, 0.70);
        vec3 causticHigh = vec3(0.55, 0.95, 1.00);
        vec3 lightCol = mix(causticLow, causticMid,  smoothstep(0.15, 0.50, caustic));
        lightCol       = mix(lightCol,  causticHigh, smoothstep(0.55, 0.85, caustic));

        // Combine water base + caustic light
        vec3 col = baseColor + lightCol * caustic * 0.95;

        // --- God rays from the surface (top-down shafts) ---
        // Two diagonal shafts that sway with time
        float rayAngle1 = sin(t * 0.11) * 0.3;
        float rayAngle2 = cos(t * 0.09) * 0.25 + 0.5;
        float ray1 = max(0.0, 1.0 - abs(uv.x * cos(rayAngle1) - uv.y * sin(rayAngle1)) * 3.5);
        float ray2 = max(0.0, 1.0 - abs((uv.x - 0.2) * cos(rayAngle2) - uv.y * sin(rayAngle2)) * 4.0);
        float rays = (pow(ray1, 3.0) + pow(ray2, 3.0)) * 0.14 * surfaceMask;
        col += vec3(0.05, 0.30, 0.45) * rays * (0.4 + u_bass * 0.6);

        // --- Bioluminescent plankton/spots ---
        // Sparse bright-cyan dots that pulse with treble
        float bioGrid = 28.0;
        vec2 bioCell = floor(uv * bioGrid + vec2(t * 0.4, t * 0.2));
        float bioRnd  = hash1(bioCell);
        // Only ~8% of cells glow
        float bioMask = step(0.92, bioRnd);
        vec2  bioFrac = fract(uv * bioGrid + vec2(t * 0.4, t * 0.2)) - 0.5;
        float bioDist = length(bioFrac);
        // Pulsation unique per cell
        float bioPulse = 0.5 + 0.5 * sin(t * (3.0 + bioRnd * 5.0) + bioRnd * 6.28);
        // Treble drives overall sparkle intensity
        float bioIntensity = (0.3 + u_treble * 1.4) * bioPulse * bioMask;
        float bioSpot = smoothstep(0.18, 0.0, bioDist) * bioIntensity;
        col += vec3(0.0, 0.8, 1.0) * bioSpot * 0.7;
        // Tiny bright core
        col += vec3(0.7, 1.0, 1.0) * smoothstep(0.06, 0.0, bioDist) * bioIntensity * 1.4;

        // --- Drifting particles / micro-plankton ---
        // Second finer grid — slower drift, dimmer
        float pGrid = 55.0;
        vec2 drift   = vec2(sin(t * 0.07) * 0.3, t * 0.06);
        vec2 pCell   = floor(uv * pGrid + drift);
        float pRnd   = hash1(pCell + 13.7);
        float pMask  = step(0.88, pRnd);
        vec2 pFrac   = fract(uv * pGrid + drift) - 0.5;
        float pDist  = length(pFrac);
        float pGlow  = smoothstep(0.12, 0.0, pDist) * pMask * (0.15 + u_treble * 0.5);
        col += vec3(0.1, 0.6, 0.9) * pGlow;

        // --- Beat: a bright pulse of light descending from the surface ---
        // Horizontal band that decays quickly with depth
        float beatShaft = u_beat * smoothstep(-0.1, 0.6, uv.y);
        col += vec3(0.4, 0.85, 1.0) * beatShaft * 0.9;
        // Caustic flare on beat
        col += lightCol * caustic * u_beat * 0.8;
        // Global flash tint (deep blue-white)
        col += vec3(0.1, 0.3, 0.5) * u_beat * 0.4;

        // --- Edge vignette to frame the deep ocean look ---
        float vig = 1.0 - smoothstep(0.45, 1.3, length(uv * vec2(0.9, 1.1)));
        col *= 0.55 + vig * 0.45;

        // Reinhard tone-map + mild gamma
        col = col / (col + vec3(0.9));
        col = pow(col, vec3(0.88));

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['deep-caustics'] = DeepCausticsPreset;
})();
