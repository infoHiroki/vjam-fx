(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class IceCrystalPreset extends BasePreset {
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
        preset._time += 0.018 + preset._sBass * 0.025;
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

      // --- Hashing ---
      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }

      float hash1(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      // --- Voronoi returning (minDist, secondDist, cellID) ---
      vec3 voronoi(vec2 uv) {
        vec2 i = floor(uv);
        vec2 f = fract(uv);
        float minD = 8.0, secD = 8.0;
        float cellID = 0.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 nb = vec2(float(x), float(y));
            vec2 pt = hash2(i + nb);
            // slow drift driven by mid audio
            pt = 0.5 + 0.5 * sin(u_time * (0.3 + u_mid * 0.4) + 6.2831 * pt);
            vec2 diff = nb + pt - f;
            float d = dot(diff, diff);
            if (d < minD) {
              secD   = minD;
              minD   = d;
              cellID = hash1(i + nb);
            } else if (d < secD) {
              secD = d;
            }
          }
        }
        return vec3(sqrt(minD), sqrt(secD), cellID);
      }

      // --- Single ice fracture layer ---
      // Returns crack brightness (bright at cell boundaries) + cell shading
      vec2 iceLayer(vec2 uv, float scale, float time, float crackWidth) {
        vec3 v = voronoi(uv * scale);
        // crack = thin bright line at cell boundary
        float edge = v.y - v.x;                      // distance difference
        float crack = 1.0 - smoothstep(0.0, crackWidth, edge);
        // per-cell facet shading: slight variation in brightness
        float facet = 0.5 + 0.5 * sin(v.z * 17.3 + time * 0.2);
        return vec2(crack, facet);
      }

      // --- Value noise for frost texture ---
      float frostNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash1(i);
        float b = hash1(i + vec2(1.0, 0.0));
        float c = hash1(i + vec2(0.0, 1.0));
        float d = hash1(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbmFrost(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * frostNoise(p);
          p  = p * 2.1 + vec2(1.7, 9.2);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // crack width grows with bass
        float crackW = 0.04 + u_bass * 0.09;

        // --- Layer 1: large structural fractures ---
        vec2 uv1 = uv + vec2(u_time * 0.008, u_time * 0.005);
        vec2 l1 = iceLayer(uv1, 2.8, u_time, crackW);

        // --- Layer 2: medium secondary fractures ---
        vec2 uv2 = uv + vec2(-u_time * 0.012, u_time * 0.009);
        vec2 l2 = iceLayer(uv2, 5.5, u_time * 1.15, crackW * 0.75);

        // --- Layer 3: fine micro-fractures ---
        vec2 uv3 = uv + vec2(u_time * 0.006, -u_time * 0.011);
        vec2 l3 = iceLayer(uv3, 11.0, u_time * 1.4, crackW * 0.5);

        // combined crack brightness
        float cracks = l1.x * 0.55 + l2.x * 0.30 + l3.x * 0.15;

        // where multiple layers crack simultaneously = light refraction bright spot
        float alignment = l1.x * l2.x;
        float refractSpot = alignment * (0.6 + u_treble * 1.2);

        // --- Frost texture overlay ---
        float frost = fbmFrost(uv * 18.0 + vec2(u_time * 0.04));
        float frostDetail = fbmFrost(uv * 40.0 - vec2(u_time * 0.02, 0.0));
        float frostTex = frost * 0.6 + frostDetail * 0.4;

        // --- Base ice color: deep sapphire gradient ---
        float radial = length(uv);
        vec3 deepIce   = vec3(0.04, 0.08, 0.22);   // deep sapphire
        vec3 midIce    = vec3(0.12, 0.22, 0.48);   // cool blue
        vec3 shallowIce= vec3(0.55, 0.78, 0.92);   // pale ice blue
        // l1.y = large cell facet shading
        float facetMix = l1.y * 0.5 + l2.y * 0.3 + 0.2;
        vec3 baseCol = mix(deepIce, midIce, facetMix);
        baseCol = mix(baseCol, shallowIce, smoothstep(0.5, 1.1, radial) * 0.4);

        // --- Crack coloring ---
        // cracks themselves: very pale blue-white with deep sapphire at edges
        vec3 crackDeep  = vec3(0.08, 0.14, 0.45);  // sapphire crack interior
        vec3 crackLight = vec3(0.82, 0.92, 1.00);  // ice-white crack edge
        vec3 crackCol   = mix(crackDeep, crackLight, smoothstep(0.2, 0.8, cracks));

        vec3 col = mix(baseCol, crackCol, cracks * (0.7 + u_bass * 0.4));

        // --- Refraction bright spots where layers align ---
        vec3 refractCol = vec3(0.90, 0.96, 1.00);  // near white with cool tint
        col += refractCol * refractSpot * 0.7;

        // --- Frost overlay: adds a milky white matte surface texture ---
        col = mix(col, vec3(0.88, 0.94, 1.00), frostTex * 0.13);

        // --- Treble sparkle: tiny bright glints on surface ---
        // Use high-frequency noise as sparkle mask
        float sparkleNoise = hash1(uv * 220.0 + vec2(u_time * 3.7));
        float sparkle = step(0.96, sparkleNoise) * (0.4 + u_treble * 1.4);
        // Animate sparkle brightness with treble
        sparkle *= 0.5 + 0.5 * sin(u_time * 8.0 + sparkleNoise * 40.0);
        col += vec3(0.85, 0.93, 1.00) * sparkle;

        // --- Beat: crack propagation flash ---
        // Brief full-surface white-blue pulse, stronger along existing cracks
        float beatFlash = u_beat * u_beat;
        col += vec3(0.6, 0.78, 1.00) * beatFlash * (0.5 + cracks * 0.8);
        // sharp crack highlight on beat
        col += vec3(1.00, 1.00, 1.00) * cracks * beatFlash * 0.9;

        // --- Vignette: darken corners for depth ---
        float vignette = 1.0 - smoothstep(0.5, 1.3, radial);
        col *= 0.65 + vignette * 0.35;

        // --- Tone map and gamma ---
        col = col / (col + vec3(1.0));
        col = pow(col, vec3(0.88));

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['ice-crystal'] = IceCrystalPreset;
})();
