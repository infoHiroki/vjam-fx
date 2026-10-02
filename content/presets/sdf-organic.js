(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SdfOrganicPreset extends BasePreset {
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
        // Time advances slowly; bass and mid speed it up slightly
        preset._time += 0.006 + preset._sBass * 0.008 + preset._sMid * 0.004;
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
      // Smooth union (polynomial) — the key op for lava-lamp blending
      // ----------------------------------------------------------------
      float smin(float a, float b, float k) {
        float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) - k * h * (1.0 - h);
      }

      // ----------------------------------------------------------------
      // Sphere SDF
      // ----------------------------------------------------------------
      float sdSphere(vec3 p, float r) { return length(p) - r; }

      // ----------------------------------------------------------------
      // Scene: 4 organic blobs that slowly drift and merge/split
      // ----------------------------------------------------------------
      float scene(vec3 p) {
        float t = u_time;
        // Morph speed driven by mid
        float ms = 1.0 + u_mid * 2.0;

        // Bass + beat pulse radius scale
        float bassScale = 1.0 + u_bass * 0.28 + u_beat * 0.18;

        // Blob 1 — primary, large, slow drift
        vec3 c1 = vec3(
          sin(t * 0.31 * ms) * 0.55,
          cos(t * 0.23 * ms) * 0.40,
          sin(t * 0.17 * ms) * 0.30
        );
        float r1 = (0.52 + sin(t * 0.41 * ms) * 0.07) * bassScale;
        float b1 = sdSphere(p - c1, r1);

        // Blob 2 — secondary, orbits blob 1 at medium distance
        vec3 c2 = vec3(
          cos(t * 0.37 * ms) * 0.65,
          sin(t * 0.29 * ms) * 0.50,
          cos(t * 0.21 * ms) * 0.35
        );
        float r2 = (0.42 + cos(t * 0.53 * ms) * 0.06) * bassScale;
        float b2 = sdSphere(p - c2, r2);

        // Blob 3 — tertiary, faster, more elliptical path
        vec3 c3 = vec3(
          sin(t * 0.47 * ms + 2.1) * 0.50,
          cos(t * 0.38 * ms + 1.0) * 0.55,
          sin(t * 0.28 * ms + 0.5) * 0.40
        );
        float r3 = (0.36 + sin(t * 0.62 * ms) * 0.05) * bassScale;
        float b3 = sdSphere(p - c3, r3);

        // Blob 4 — small accent, bounces around quickly
        vec3 c4 = vec3(
          cos(t * 0.56 * ms + 3.7) * 0.72,
          sin(t * 0.44 * ms + 2.5) * 0.60,
          cos(t * 0.33 * ms + 1.8) * 0.45
        );
        float r4 = (0.28 + cos(t * 0.74 * ms) * 0.04) * bassScale;
        float b4 = sdSphere(p - c4, r4);

        // Smooth-union blend — softness increases with bass so blobs
        // merge more on heavy beats
        float sk = 0.45 + u_bass * 0.35 + u_beat * 0.25;
        float d = smin(b1, b2, sk);
        d = smin(d, b3, sk);
        d = smin(d, b4, sk * 0.7);
        return d;
      }

      // ----------------------------------------------------------------
      // Normal via central differences
      // ----------------------------------------------------------------
      vec3 calcNormal(vec3 p) {
        const float e = 0.002;
        return normalize(vec3(
          scene(p + vec3(e, 0.0, 0.0)) - scene(p - vec3(e, 0.0, 0.0)),
          scene(p + vec3(0.0, e, 0.0)) - scene(p - vec3(0.0, e, 0.0)),
          scene(p + vec3(0.0, 0.0, e)) - scene(p - vec3(0.0, 0.0, e))
        ));
      }

      // ----------------------------------------------------------------
      // Iridescent / thin-film palette
      // Maps a surface angle to warm-sunset hues with iridescent shift
      // ----------------------------------------------------------------
      vec3 iridColor(float ndotv, float t, float treble) {
        // Base sunset palette: orange → magenta → gold → coral
        // Driven by view angle so the sheen shifts as camera moves
        float phase = ndotv * 3.14159 + t * 0.4;
        vec3 warm = vec3(
          0.5 + 0.5 * cos(phase + 0.0),   // orange-red channel
          0.3 + 0.3 * cos(phase + 1.2),   // gold-green channel
          0.2 + 0.4 * cos(phase + 2.5)    // magenta-blue channel
        );

        // Treble adds a rapid iridescent shimmer offset
        float shimmerOff = treble * sin(t * 8.0 + ndotv * 12.0) * 0.25;
        vec3 shimmer = vec3(
          0.5 + 0.5 * cos(phase + shimmerOff + 0.0),
          0.5 + 0.5 * cos(phase + shimmerOff + 2.1),
          0.5 + 0.5 * cos(phase + shimmerOff + 4.2)
        );

        // Blend: low treble = warm sunset, high treble = iridescent
        return mix(warm, shimmer, treble * 0.6);
      }

      void main() {
        // Centred, aspect-correct UV from gl_FragCoord (avoids p5.js vUv issue)
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Camera: gentle slow orbit, pulls back slightly on beat
        float camAngle = u_time * 0.11;
        float camDist  = 4.5 - u_beat * 0.15;
        vec3 ro = vec3(cos(camAngle) * camDist, sin(u_time * 0.09) * 0.5, sin(camAngle) * camDist);
        vec3 ta = vec3(0.0);
        vec3 ww = normalize(ta - ro);
        vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
        vec3 vv = cross(uu, ww);
        vec3 rd = normalize(uv.x * uu + uv.y * vv + 2.2 * ww);

        // Ray march — 60 steps
        float tm = 0.0;
        float dd;
        for (int i = 0; i < 60; i++) {
          dd = scene(ro + rd * tm);
          if (dd < 0.001 || tm > 12.0) break;
          tm += dd;
        }

        // Background: deep dark purple-brown with subtle warm gradient
        vec3 bgBase = vec3(0.04, 0.02, 0.03);
        vec3 bgWarm = bgBase + vec3(0.06, 0.03, 0.01) * max(0.0, -rd.y);
        vec3 col    = bgWarm;

        if (tm < 12.0) {
          vec3 pos = ro + rd * tm;
          vec3 nor = calcNormal(pos);

          // View dot normal for Fresnel and sheen
          float ndotv = clamp(dot(nor, -rd), 0.0, 1.0);

          // --- Two-light setup ---
          // Key light: warm golden from top-right
          vec3 lKey = normalize(vec3(1.2, 1.5, -0.8));
          float diff = max(dot(nor, lKey), 0.0);

          // Fill light: cool magenta from bottom-left (gives sunset feel)
          vec3 lFill = normalize(vec3(-0.8, -0.6, 1.2));
          float diffFill = max(dot(nor, lFill), 0.0) * 0.35;

          // Specular highlights — tight for glassy look, driven by treble
          float specExp = 48.0 + u_treble * 80.0;
          vec3  refl    = reflect(-lKey, nor);
          float spec    = pow(max(dot(refl, -rd), 0.0), specExp);

          // Secondary spec from fill light (softer, cooler)
          vec3  reflFill = reflect(-lFill, nor);
          float specFill = pow(max(dot(reflFill, -rd), 0.0), 16.0) * 0.3;

          // Fresnel rim — intensifies on grazing angles (semi-transparent feel)
          float fres = pow(1.0 - ndotv, 3.5);

          // --- Iridescent surface colour ---
          vec3 irid = iridColor(ndotv, u_time, u_treble);

          // Base sunset body tones (orange, coral, gold)
          vec3 bodyOrange = vec3(0.95, 0.42, 0.08);
          vec3 bodyMag    = vec3(0.88, 0.18, 0.55);
          vec3 bodyGold   = vec3(0.98, 0.72, 0.12);
          vec3 bodyCoral  = vec3(0.98, 0.50, 0.30);

          // Blend body tones along normal direction for position-based colour
          float tCol = 0.5 + 0.5 * nor.y;
          vec3 bodyA  = mix(bodyOrange, bodyMag,  tCol);
          vec3 bodyB  = mix(bodyGold,   bodyCoral, tCol);
          float tCol2 = 0.5 + 0.5 * nor.x;
          vec3 body   = mix(bodyA, bodyB, tCol2);

          // Compose surface colour
          col  = body * (diff * 0.75 + diffFill + 0.15);   // diffuse
          col += irid * fres * (0.55 + u_treble * 0.45);  // iridescent rim
          col += vec3(1.0, 0.85, 0.60) * spec * (0.7 + u_treble * 0.5); // key specular
          col += vec3(0.85, 0.25, 0.70) * specFill;       // fill specular (magenta)

          // Semi-transparency illusion: blend a thin back-lit halo at rim
          vec3 backlit = vec3(1.0, 0.55, 0.15) * 0.5;
          col = mix(col, backlit, fres * 0.3);

          // Beat: brief bright expansion flash on surface
          col += vec3(1.0, 0.60, 0.20) * u_beat * fres * 1.2;
          col += body * u_beat * 0.25;

          // AO approximation — darken self-shadowed areas
          float ao = clamp(scene(pos + nor * 0.15) / 0.15, 0.0, 1.0);
          col *= 0.65 + 0.35 * ao;
        }

        // --- Background warm glow on beat ---
        col += vec3(0.5, 0.15, 0.05) * u_beat * 0.18;

        // Vignette
        float vig = 1.0 - dot(uv * 0.8, uv * 0.8);
        col *= clamp(vig, 0.0, 1.0);

        // Gamma and tone
        col = pow(max(col, vec3(0.0)), vec3(0.88));
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
window.VJamFX.presets['sdf-organic'] = SdfOrganicPreset;
})();
