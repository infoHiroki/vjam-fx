(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class StainedGlassDarkPreset extends BasePreset {
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
        preset._time += 0.025 + preset._sBass * 0.04;
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

      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2  u_resolution;

      // ----------------------------------------------------------------
      // Helpers
      // ----------------------------------------------------------------
      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }

      // 2-D Voronoi: returns (dist-to-border, dist-to-center, cell-id)
      vec3 voronoi(vec2 p) {
        vec2 ip = floor(p);
        vec2 fp = fract(p);

        float minDist = 8.0;
        vec2  minId   = vec2(0.0);
        vec2  minPos  = vec2(0.0);

        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 nb  = vec2(float(i), float(j));
            vec2 id  = ip + nb;
            vec2 rnd = hash2(id);
            // Slowly animated cell centres
            vec2 pt  = nb + rnd - fp;
            float d  = dot(pt, pt);
            if (d < minDist) {
              minDist = d;
              minId   = id;
              minPos  = pt;
            }
          }
        }

        // Border distance (second-nearest minus nearest)
        float border = 8.0;
        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 nb  = vec2(float(i), float(j));
            vec2 id  = ip + nb;
            if (all(equal(id, minId))) continue;
            vec2 rnd = hash2(id);
            vec2 pt  = nb + rnd - fp;
            vec2 mid = 0.5 * (minPos + pt);
            vec2 nor = normalize(pt - minPos);
            border = min(border, dot(mid, nor));
          }
        }

        return vec3(border, sqrt(minDist), hash2(minId).x);
      }

      // Simple 2-D value noise
      float noise(vec2 p) {
        vec2 ip = floor(p);
        vec2 fp = fract(p);
        fp = fp * fp * (3.0 - 2.0 * fp);
        float a = fract(sin(dot(ip,               vec2(127.1, 311.7))) * 43758.5453);
        float b = fract(sin(dot(ip + vec2(1,0),   vec2(127.1, 311.7))) * 43758.5453);
        float c = fract(sin(dot(ip + vec2(0,1),   vec2(127.1, 311.7))) * 43758.5453);
        float d = fract(sin(dot(ip + vec2(1,1),   vec2(127.1, 311.7))) * 43758.5453);
        return mix(mix(a, b, fp.x), mix(c, d, fp.x), fp.y);
      }

      // ----------------------------------------------------------------
      // Gothic colour palette (5 hues, cycle slowly with u_mid)
      // ----------------------------------------------------------------
      vec3 glassColor(float cellId, float midShift) {
        float idx = fract(cellId + midShift * 0.15);

        // Crimson red
        if (idx < 0.20) return mix(vec3(0.72, 0.04, 0.06), vec3(0.90, 0.08, 0.10), fract(idx * 5.0));
        // Royal blue
        if (idx < 0.40) return mix(vec3(0.04, 0.08, 0.70), vec3(0.10, 0.20, 0.90), fract(idx * 5.0));
        // Deep gold / amber
        if (idx < 0.60) return mix(vec3(0.75, 0.52, 0.02), vec3(0.95, 0.70, 0.05), fract(idx * 5.0));
        // Deep purple
        if (idx < 0.80) return mix(vec3(0.35, 0.02, 0.55), vec3(0.55, 0.05, 0.80), fract(idx * 5.0));
        // Emerald green
        return           mix(vec3(0.02, 0.40, 0.12), vec3(0.05, 0.65, 0.20), fract(idx * 5.0));
      }

      // ----------------------------------------------------------------
      // God-ray contribution at a pixel
      // A single ray: origin at top-centre, fanning outward
      // ----------------------------------------------------------------
      float godRay(vec2 uv, float rayAngle, float width, float falloff) {
        // Transform to ray-centric coords
        float c = cos(rayAngle), s = sin(rayAngle);
        vec2  d = vec2(c * uv.x + s * uv.y, -s * uv.x + c * uv.y);
        // Lateral Gaussian, depth attenuation
        float lat  = exp(-d.x * d.x / (width * width));
        float depth = clamp(1.0 - d.y * falloff, 0.0, 1.0);
        return lat * depth * step(0.0, d.y);
      }

      // ----------------------------------------------------------------
      void main() {
        vec2 fc  = gl_FragCoord.xy;
        vec2 res = u_resolution;

        // Normalise: (0,0) = centre, aspect-corrected
        vec2 uv = (fc - 0.5 * res) / res.y;

        // Screen-space UV for sampling (0..1)
        vec2 suv = fc / res;

        // ---- Voronoi pane layout -----------------------------------
        float scale = 5.5;
        vec2 vUV = uv * scale;

        // Gentle float animation on cell centres
        vUV += vec2(
          sin(u_time * 0.08 + vUV.y * 0.3) * 0.04,
          cos(u_time * 0.06 + vUV.x * 0.3) * 0.04
        );

        vec3 vor   = voronoi(vUV);
        float border  = vor.x;   // distance to nearest cell boundary
        float cellDist= vor.y;   // distance to cell centre
        float cellId  = vor.z;   // pseudo-random cell identifier

        // ---- Glass colour -----------------------------------------
        vec3 paneColor = glassColor(cellId, u_mid);

        // Internal colour variation (slight noise inside each pane)
        float inNoise = noise(vUV * 3.0 + cellId * 10.0);
        paneColor = mix(paneColor * 0.7, paneColor * 1.15, inNoise);

        // ---- Lead border (thick dark lines) -----------------------
        float leadThickness = 0.06;
        float leadMask = smoothstep(leadThickness, leadThickness + 0.015, border);
        // Lead: near-black with a faint blue-grey tint
        vec3 leadColor = vec3(0.04, 0.045, 0.06);

        vec3 glassColor2 = mix(leadColor, paneColor, leadMask);

        // ---- Ambient light through glass ---------------------------
        // Base: very dark cathedral interior
        float ambientBase = 0.08 + u_bass * 0.08;
        glassColor2 *= ambientBase + 0.25 * leadMask;

        // ---- God rays ---------------------------------------------
        // Rays originate from upper area (y > 0.1 in uv space)
        vec2 rayOrigin = vec2(0.0, 0.55);   // top-centre
        vec2 rayUV = uv - rayOrigin;

        float rays = 0.0;
        // 7 rays fanning across the window
        for (int i = 0; i < 7; i++) {
          float fi    = float(i) / 6.0;
          float angle = (fi - 0.5) * 1.4;                        // -0.7 .. +0.7 rad
          float w     = 0.04 + 0.03 * noise(vec2(fi * 3.7, u_time * 0.05));
          float ray   = godRay(rayUV, angle, w, 1.4);
          // Tint each ray with the dominant glass colours
          float tidx  = fract(fi + u_mid * 0.1);
          rays += ray * (0.4 + 0.6 * fi);
        }

        // Ray colour: warm golden-white
        vec3 rayColor = vec3(0.95, 0.88, 0.65);

        // Bass makes rays pulse brighter
        float rayStrength = 0.18 + u_bass * 0.45;
        // Beat: sudden flash
        float beatFlash = u_beat * 0.55;
        rayStrength += beatFlash;

        // Rays interact with the glass colour (tint by pane)
        vec3 rayContrib = rays * rayStrength * mix(rayColor, paneColor * 1.5, 0.35);

        // Add rays additively to the glass
        glassColor2 += rayContrib;

        // ---- Treble sparkle on lead edges -------------------------
        float edgeFactor = 1.0 - smoothstep(0.0, 0.04, border);
        float sparkleNoise = noise(vUV * 18.0 + u_time * 2.5);
        float sparkle = edgeFactor * sparkleNoise * sparkleNoise * u_treble * 1.8;
        // Sparkle: bright silvery-blue
        glassColor2 += sparkle * vec3(0.75, 0.85, 1.0);

        // ---- Beat flash (whole-window brightening) -----------------
        glassColor2 += u_beat * 0.20 * vec3(0.90, 0.80, 0.65);

        // ---- Vignette (darken corners, cathedral depth) -----------
        float vig = 1.0 - dot(uv * 1.1, uv * 1.1);
        vig = clamp(vig, 0.0, 1.0);
        vig = pow(vig, 1.4);
        glassColor2 *= 0.35 + 0.65 * vig;

        // ---- Subtle chromatic colour grading ----------------------
        // Very slight overall darkening to maintain gothic mood
        glassColor2 = pow(max(glassColor2, vec3(0.0)), vec3(1.1, 1.05, 0.95));

        gl_FragColor = vec4(glassColor2, 1.0);
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
window.VJamFX.presets['stained-glass-dark'] = StainedGlassDarkPreset;
})();
