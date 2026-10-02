(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SdfChromePreset extends BasePreset {
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
        preset._time += 0.016 + preset._sMid * 0.025;
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
      void main() {
        vUv = aTexCoord;
        vec4 pos = vec4(aPosition, 1.0);
        pos.xy = pos.xy * 2.0 - 1.0;
        gl_Position = pos;
      }
    `;
    const frag = `
      precision highp float;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2  u_resolution;

      // ---- Rotation helpers ----
      mat2 rot2(float a) {
        float c = cos(a), s = sin(a);
        return mat2(c, -s, s, c);
      }

      mat3 rotY(float a) {
        float c = cos(a), s = sin(a);
        return mat3(c, 0.0, s,  0.0, 1.0, 0.0,  -s, 0.0, c);
      }

      mat3 rotX(float a) {
        float c = cos(a), s = sin(a);
        return mat3(1.0, 0.0, 0.0,  0.0, c, -s,  0.0, s, c);
      }

      mat3 rotZ(float a) {
        float c = cos(a), s = sin(a);
        return mat3(c, -s, 0.0,  s, c, 0.0,  0.0, 0.0, 1.0);
      }

      // ---- SDF primitives ----
      float sdSphere(vec3 p, float r) {
        return length(p) - r;
      }

      // Smooth union (organic blob merge)
      float smin(float a, float b, float k) {
        float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) - k * h * (1.0 - h);
      }

      // ---- Scene: 3 metallic blobs ----
      // Returns distance to nearest surface
      float scene(vec3 p) {
        float t   = u_time;
        float spd = 0.4 + u_mid * 0.8;   // mid controls flow speed

        // Blob radii grow with bass
        float r0 = 0.55 + u_bass * 0.30;
        float r1 = 0.42 + u_bass * 0.22;
        float r2 = 0.38 + u_bass * 0.18;

        // Blob 0 — central, slow tumble
        vec3 p0 = p;
        p0 = rotY(t * spd * 0.37) * p0;
        p0 = rotX(t * spd * 0.23) * p0;
        float d0 = sdSphere(p0, r0);

        // Blob 1 — orbiting in XZ plane, displaced
        vec3 p1 = p;
        float a1 = t * spd * 0.51;
        p1 -= vec3(cos(a1) * 0.80, sin(t * spd * 0.29) * 0.35, sin(a1) * 0.80);
        p1 = rotZ(t * spd * 0.44) * p1;
        float d1 = sdSphere(p1, r1);

        // Blob 2 — orbiting in a tilted plane
        vec3 p2 = p;
        float a2 = t * spd * 0.38 + 2.1;
        p2 -= vec3(sin(a2) * 0.70, cos(t * spd * 0.47) * 0.40, cos(a2) * 0.60);
        p2 = rotX(t * spd * 0.33) * p2;
        float d2 = sdSphere(p2, r2);

        // Beat ripple: radial displacement on the merged surface
        // Applied as an additive sine wave on radius from origin
        float ripple = u_beat * 0.10 * sin(length(p) * 18.0 - u_time * 12.0);

        // Blob merge softness: wider when bass is heavy
        float k = 0.35 + u_bass * 0.40;
        float d = smin(d0, d1, k);
        d = smin(d, d2, k);
        return d + ripple;
      }

      // ---- Analytic normal via central differences ----
      vec3 calcNormal(vec3 p) {
        const float e = 0.0015;
        return normalize(vec3(
          scene(p + vec3(e,0,0)) - scene(p - vec3(e,0,0)),
          scene(p + vec3(0,e,0)) - scene(p - vec3(0,e,0)),
          scene(p + vec3(0,0,e)) - scene(p - vec3(0,0,e))
        ));
      }

      // ---- Fake environment map ----
      // Simulates a chrome-like sky: warm orange/gold below,
      // cool silver/blue above, with horizon band.
      vec3 envMap(vec3 dir) {
        // Rotate environment slowly so reflections shift over time
        float envRot = u_time * 0.08;
        dir.xz = rot2(envRot) * dir.xz;

        float y = dir.y;  // -1 (floor) to +1 (sky)

        // Sky gradient: deep chrome blue at top
        vec3 skyTop    = vec3(0.55, 0.72, 0.95);
        vec3 skyMid    = vec3(0.88, 0.92, 1.00);  // near-white horizon

        // Ground gradient: warm orange/gold at bottom
        vec3 groundMid = vec3(0.98, 0.85, 0.60);
        vec3 groundBot = vec3(0.70, 0.38, 0.10);

        vec3 env;
        if (y >= 0.0) {
          env = mix(skyMid, skyTop, y);
        } else {
          env = mix(skyMid, groundMid, -y * 1.5);
          env = mix(env, groundBot, clamp(-y - 0.5, 0.0, 1.0) * 2.0);
        }

        // Add a bright sun-like hotspot (warm specular source)
        vec3 sunDir = normalize(vec3(0.6, 0.45, -0.7));
        float sunDot = max(dot(dir, sunDir), 0.0);
        env += vec3(1.00, 0.92, 0.75) * pow(sunDot, 180.0) * 2.5;

        // Cool blue fill light (opposite side)
        vec3 fillDir = normalize(vec3(-0.5, 0.3, 0.8));
        float fillDot = max(dot(dir, fillDir), 0.0);
        env += vec3(0.50, 0.65, 1.00) * pow(fillDot, 60.0) * 0.6;

        return env;
      }

      void main() {
        // Centered aspect-corrected UV via gl_FragCoord
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Camera: slow orbit, slight vertical bob
        float camSpeed = 0.18 + u_mid * 0.12;
        float camAngle = u_time * camSpeed;
        float camDist  = 3.2 - u_bass * 0.25;
        vec3 ro = vec3(
          cos(camAngle) * camDist,
          0.30 + sin(u_time * 0.17) * 0.40,
          sin(camAngle) * camDist
        );
        vec3 ta  = vec3(0.0);
        vec3 ww  = normalize(ta - ro);
        vec3 uu  = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
        vec3 vv  = cross(uu, ww);
        vec3 rd  = normalize(uv.x * uu + uv.y * vv + 1.9 * ww);

        // ---- Ray march ----
        float t  = 0.02;
        float dist;
        int steps = 0;
        for (int i = 0; i < 60; i++) {
          dist = scene(ro + rd * t);
          if (dist < 0.001 || t > 12.0) break;
          t += dist * 0.9;
          steps = i;
        }

        // ---- Shading ----
        vec3 col;

        if (t < 12.0) {
          vec3 pos = ro + rd * t;
          vec3 nor = calcNormal(pos);

          // View vector and reflection
          vec3 viewDir = -rd;
          vec3 refl    = reflect(rd, nor);

          // --- Environment (chrome) reflection ---
          vec3 envCol = envMap(refl);

          // --- Fresnel: grazing angles get full chrome reflection ---
          float fresnelBase = 1.0 - max(dot(nor, viewDir), 0.0);
          float fresnel = pow(fresnelBase, 2.5);   // chrome Schlick approx
          // Chrome base: near-perfectly reflective, slight silver tint
          vec3 chromeBase = mix(vec3(0.78, 0.80, 0.82), envCol, 0.82);
          col = mix(chromeBase, envCol, fresnel);

          // --- Primary specular (sun key light) ---
          vec3 lightDir = normalize(vec3(0.6, 0.45, -0.7));
          vec3 halfVec  = normalize(lightDir + viewDir);
          // Treble sharpens the specular exponent (tight hot spot vs broad glow)
          float specExp  = 120.0 + u_treble * 380.0;
          float specular = pow(max(dot(nor, halfVec), 0.0), specExp);
          col += vec3(1.00, 0.97, 0.88) * specular * (0.9 + u_treble * 0.6);

          // --- Fill specular (cool blue) ---
          vec3 fillDir  = normalize(vec3(-0.5, 0.3, 0.8));
          vec3 halfFill = normalize(fillDir + viewDir);
          float specFill = pow(max(dot(nor, halfFill), 0.0), 60.0 + u_treble * 120.0);
          col += vec3(0.45, 0.60, 1.00) * specFill * 0.35;

          // --- Ambient occlusion approximation ---
          // Sample scene slightly above surface along normal
          float ao = clamp(scene(pos + nor * 0.12) / 0.12, 0.0, 1.0);
          col *= 0.65 + 0.35 * ao;

          // --- Beat surface ripple shimmer ---
          // Ripple distortion causes rapidly shifting highlights
          float rippleShimmer = sin(length(pos) * 20.0 - u_time * 15.0) * 0.5 + 0.5;
          col += vec3(0.80, 0.90, 1.00) * rippleShimmer * u_beat * 0.45;

          // --- Edge darkening for depth ---
          col *= 0.92 + 0.08 * dot(nor, viewDir);

        } else {
          // Background: dark with subtle environment reflection along ray direction
          vec3 bgEnv = envMap(rd);
          col = bgEnv * 0.05 + vec3(0.01, 0.01, 0.015);

          // Very faint edge glow where blobs almost blocked the ray
          float edgeGlow = pow(1.0 - clamp(dist * 4.0, 0.0, 1.0), 3.0);
          col += vec3(0.70, 0.80, 1.00) * edgeGlow * 0.25;
        }

        // ---- Global brightness modulation ----
        col *= 1.10 + u_bass * 0.25;

        // ---- Beat flash (brief white-silver wash) ----
        col = mix(col, vec3(0.95, 0.97, 1.00), u_beat * 0.22);

        // ---- Subtle vignette ----
        float vig = 1.0 - 0.35 * dot(uv, uv);
        col *= vig;

        col = clamp(col, 0.0, 1.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) {
    this.audio.bass     = d.bass     || 0;
    this.audio.mid      = d.mid      || 0;
    this.audio.treble   = d.treble   || 0;
    this.audio.rms      = d.rms      || 0;
    this.audio.strength = d.strength || 0;
  }

  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['sdf-chrome'] = SdfChromePreset;
})();
