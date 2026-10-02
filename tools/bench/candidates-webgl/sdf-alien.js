(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SdfAlienPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
    this.beatPulse = 0;
    this._shader = null;
    this._time = 0;
    // EMA smoothed audio
    this._sBass = 0;
    this._sMid = 0;
    this._sTreble = 0;
  }

  setup(container) {
    this.destroy();
    const preset = this;
    this.p5 = new p5((p) => {
      p.setup = () => {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        p.createCanvas(w, h, p.WEBGL);
        p.pixelDensity(1);
      };

      p.draw = () => {
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }

        // EMA smoothing k=0.12
        const k = 0.12;
        preset._sBass   += k * (preset.audio.bass   - preset._sBass);
        preset._sMid    += k * (preset.audio.mid    - preset._sMid);
        preset._sTreble += k * (preset.audio.treble - preset._sTreble);

        preset._time += 0.016 + preset._sBass * 0.02;
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
        } catch (e) {
          // noop
        } finally {
          p.resetShader();
        }
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
      void main() {
        vUv = aTexCoord;
        vec4 pos = vec4(aPosition, 1.0);
        pos.xy = pos.xy * 2.0 - 1.0;
        gl_Position = pos;
      }
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

      // ---- Noise ----
      vec3 hash3(vec3 p) {
        p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
            dot(p, vec3(269.5, 183.3, 246.1)),
            dot(p, vec3(113.5, 271.9, 124.6)));
        return fract(sin(p) * 43758.5453123);
      }

      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(dot(hash3(i + vec3(0,0,0)) * 2.0 - 1.0, f - vec3(0,0,0)),
              dot(hash3(i + vec3(1,0,0)) * 2.0 - 1.0, f - vec3(1,0,0)), u.x),
            mix(dot(hash3(i + vec3(0,1,0)) * 2.0 - 1.0, f - vec3(0,1,0)),
              dot(hash3(i + vec3(1,1,0)) * 2.0 - 1.0, f - vec3(1,1,0)), u.x), u.y),
          mix(mix(dot(hash3(i + vec3(0,0,1)) * 2.0 - 1.0, f - vec3(0,0,1)),
              dot(hash3(i + vec3(1,0,1)) * 2.0 - 1.0, f - vec3(1,0,1)), u.x),
            mix(dot(hash3(i + vec3(0,1,1)) * 2.0 - 1.0, f - vec3(0,1,1)),
              dot(hash3(i + vec3(1,1,1)) * 2.0 - 1.0, f - vec3(1,1,1)), u.x), u.y), u.z);
      }

      // FBM — 2 octaves only (called inside scene per ray step)
      float fbm2(vec3 p) {
        return noise(p) * 0.5 + noise(p * 2.1) * 0.25;
      }
      // FBM — 3 octaves for vein pattern (called once per pixel)
      float fbm3(vec3 p) {
        float v = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 3; i++) {
          v += amp * noise(p);
          p *= 2.1;
          amp *= 0.5;
        }
        return v;
      }

      // ---- Rotation ----
      mat2 rot2(float a) {
        float c = cos(a), s = sin(a);
        return mat2(c, -s, s, c);
      }

      // ---- SDF primitives ----
      float sdSphere(vec3 p, float r) {
        return length(p) - r;
      }

      float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
        vec3 pa = p - a, ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        return length(pa - ba * h) - r;
      }

      float sdEllipsoid(vec3 p, vec3 r) {
        float k0 = length(p / r);
        float k1 = length(p / (r * r));
        return k0 * (k0 - 1.0) / k1;
      }

      // Smooth min (polynomial)
      float smin(float a, float b, float k) {
        float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) - k * h * (1.0 - h);
      }

      // ---- Tentacle twist displacement ----
      vec3 twistY(vec3 p, float amount) {
        float angle = p.y * amount;
        p.xz *= rot2(angle);
        return p;
      }

      vec3 twistZ(vec3 p, float amount) {
        float angle = p.z * amount;
        p.xy *= rot2(angle);
        return p;
      }

      // Cheap sin-based displacement (NO noise in SDF)
      float cheapDisp(vec3 p, float t) {
        return sin(p.x * 3.0 + t) * sin(p.y * 2.7 + t * 0.8) * sin(p.z * 3.3 + t * 1.1) * 0.08;
      }

      // ---- Scene SDF (no noise calls!) ----
      float scene(vec3 p) {
        float t = u_time;
        float twistSpeed = 1.2 + u_mid * 2.5;
        float undulate = 0.4 + u_mid * 0.8;

        // Core blob
        float coreR = 0.38 + u_bass * 0.22 + u_beat * 0.12;
        float core = sdSphere(p, coreR + cheapDisp(p, t * 0.4) * (1.0 + u_bass * 0.5));

        // Tentacle 1
        vec3 t1p = p - vec3(0.0, 0.5 + sin(t * 0.7) * undulate, 0.0);
        t1p = twistY(t1p, sin(t * twistSpeed * 0.5) * 1.5);
        float r1 = 0.12 + u_bass * 0.06;
        float tent1 = sdCapsule(t1p, vec3(0.0), vec3(sin(t * 0.6) * 0.3, 0.8, cos(t * 0.5) * 0.2), r1);

        // Tentacle 2
        vec3 t2p = p - vec3(0.6 + sin(t * 0.9) * undulate * 0.5, 0.0, 0.0);
        t2p = twistZ(t2p, sin(t * twistSpeed * 0.7 + 1.0) * 1.2);
        float r2 = 0.1 + u_bass * 0.05;
        float tent2 = sdCapsule(t2p, vec3(0.0), vec3(0.7, sin(t * 0.8) * 0.35, cos(t * 0.6) * 0.3), r2);

        // Tentacle 3
        vec3 t3p = p - vec3(-0.3, -0.6 + cos(t * 0.8) * undulate * 0.4, 0.2);
        t3p = twistY(t3p, cos(t * twistSpeed * 0.4 + 2.0) * 2.0);
        float r3 = 0.11 + u_bass * 0.04;
        float tent3 = sdCapsule(t3p, vec3(0.0), vec3(-0.4, -0.7, sin(t * 0.7) * 0.4), r3);

        // Organ blob
        vec3 op = p - vec3(cos(t * 0.3) * 0.2, -0.1, sin(t * 0.35) * 0.2);
        float organR = 0.28 + u_mid * 0.12 + u_beat * 0.08;
        float organ = sdEllipsoid(op, vec3(organR, organR * 0.9, organR * 1.1));

        // Smooth union
        float blobK = 0.25 + u_bass * 0.35 + u_beat * 0.2;
        float d = smin(core, tent1, blobK);
        d = smin(d, tent2, blobK);
        d = smin(d, tent3, blobK * 0.8);
        d = smin(d, organ, blobK * 1.2);

        return d;
      }

      vec3 calcNormal(vec3 p) {
        const float e = 0.001;
        return normalize(vec3(
          scene(p + vec3(e, 0.0, 0.0)) - scene(p - vec3(e, 0.0, 0.0)),
          scene(p + vec3(0.0, e, 0.0)) - scene(p - vec3(0.0, e, 0.0)),
          scene(p + vec3(0.0, 0.0, e)) - scene(p - vec3(0.0, 0.0, e))
        ));
      }

      // ---- Bioluminescent palette ----
      vec3 alienColor(vec3 pos, vec3 nor, float t) {
        // Base hue: alien green to toxic purple gradient by Y
        vec3 green   = vec3(0.08, 0.95, 0.30);
        vec3 purple  = vec3(0.55, 0.05, 0.90);
        vec3 cyan    = vec3(0.05, 0.90, 0.85);

        float h = clamp(pos.y * 0.8 + 0.5, 0.0, 1.0);
        vec3 base = mix(purple, green, h);
        base = mix(base, cyan, 0.25 + sin(pos.z * 2.0 + t * 0.5) * 0.2);
        return base;
      }

      // Vein pattern: thin bright lines via ridged noise
      float veinPattern(vec3 pos, float t, float treble) {
        float n1 = fbm3(pos * 4.5 + t * 0.6);
        float n2 = fbm3(pos * 9.0 - t * 0.4);
        // Ridge: bright where noise crosses 0
        float ridge = 1.0 - abs(n1 * 2.0 - 1.0);
        ridge = pow(ridge, 4.0 + 2.0 * (1.0 - treble));
        float ridge2 = 1.0 - abs(n2 * 2.0 - 1.0);
        ridge2 = pow(ridge2, 6.0);
        return ridge * 0.7 + ridge2 * 0.3;
      }

      void main() {
        // gl_FragCoord UV (bypasses p5.js vUv issues)
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Camera slow orbit
        float camA = u_time * 0.18;
        float camDist = 3.2 + sin(u_time * 0.12) * 0.4;
        float camY = sin(u_time * 0.09) * 0.6;
        vec3 ro = vec3(cos(camA) * camDist, camY, sin(camA) * camDist);
        vec3 ta = vec3(0.0, -0.1, 0.0);
        vec3 ww = normalize(ta - ro);
        vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
        vec3 vv = cross(uu, ww);
        vec3 rd = normalize(uv.x * uu + uv.y * vv + 2.0 * ww);

        // Ray march — 48 steps
        float tm = 0.0;
        float d;
        float minD = 999.0;
        for (int i = 0; i < 48; i++) {
          d = scene(ro + rd * tm);
          minD = min(minD, d);
          if (d < 0.001 || tm > 12.0) break;
          tm += d * 0.9;
        }

        vec3 col = vec3(0.0);

        if (tm < 12.0) {
          vec3 pos = ro + rd * tm;
          vec3 nor = calcNormal(pos);

          // -- Base bioluminescent color --
          vec3 baseCol = alienColor(pos, nor, u_time);

          // -- Vein pattern (treble controls intensity) --
          float vein = veinPattern(pos, u_time, u_treble);
          vec3 veinCol = vec3(0.2, 1.0, 0.6) * vein * (0.6 + u_treble * 1.4);

          // -- Diffuse shading --
          // Two lights: key (top-back) + alien fill (bottom-front, toxic purple)
          vec3 keyLight = normalize(vec3(-0.5, 1.2, -1.0));
          vec3 fillLight = normalize(vec3(0.6, -0.8, 0.8));
          float diff  = max(dot(nor, keyLight), 0.0);
          float fill  = max(dot(nor, fillLight), 0.0) * 0.35;

          col = baseCol * (diff * 0.55 + fill + 0.15);
          col += veinCol;

          // -- Subsurface scattering glow --
          // Approximated: back-lit fresnel + thickness proxy
          float backDot = max(dot(-rd, keyLight), 0.0);
          float sss = pow(backDot, 3.0) * 0.6 + pow(backDot, 8.0) * 0.3;
          // Thin areas scatter more (fresnel)
          float fres = pow(1.0 - abs(dot(nor, -rd)), 2.5);
          vec3 sssCol = vec3(0.15, 0.85, 0.40) * sss * (0.4 + u_bass * 0.6);
          col += sssCol;
          col += baseCol * fres * 0.3;

          // -- Strong rim lighting (backlit alien glow) --
          // Rim = fresnel at silhouette edges
          float rim = pow(1.0 - max(dot(nor, -rd), 0.0), 4.0);
          // Rim color cycles between cyan and purple
          vec3 rimCycleA = vec3(0.05, 0.95, 0.80); // cyan
          vec3 rimCycleB = vec3(0.70, 0.05, 1.00); // purple
          vec3 rimCol = mix(rimCycleA, rimCycleB, 0.5 + 0.5 * sin(u_time * 0.4 + pos.y * 1.5));
          col += rimCol * rim * (1.2 + u_treble * 0.8);

          // -- Specular (wet surface) --
          vec3 refl = reflect(-keyLight, nor);
          float spec = pow(max(dot(refl, -rd), 0.0), 48.0);
          col += vec3(0.5, 1.0, 0.7) * spec * 0.5;

          // -- Ambient occlusion approximation --
          float ao = clamp(scene(pos + nor * 0.12) / 0.12, 0.0, 1.0);
          col *= 0.55 + 0.45 * ao;

          // -- Beat: bioluminescent flash burst --
          // Entire surface lights up in toxic green/cyan
          vec3 flashCol = mix(vec3(0.1, 1.0, 0.4), vec3(0.0, 0.8, 1.0), fres);
          col = mix(col, flashCol * 2.5, u_beat * 0.65);
          // Extra rim burst on beat
          col += rimCol * rim * u_beat * 2.5;
        }

        // -- Background: deep void with faint nebula --
        vec3 bg = vec3(0.0, 0.008, 0.012);
        bg += vec3(0.02, 0.0, 0.04) * smoothstep(-0.3, 0.3, rd.y);
        // Subtle star-like noise in background
        float starNoise = noise(rd * 12.0 + u_time * 0.02);
        bg += vec3(0.0, 0.06, 0.03) * pow(max(starNoise, 0.0), 6.0) * 0.4;

        float hit = step(0.0001, 12.0 - tm);
        col = mix(bg, col, hit);

        // -- Glow halo (from minD tracked during main march) --
        if (tm >= 12.0) {
          float glow = exp(-max(minD, 0.0) * 4.5);
          vec3 glowCol = vec3(0.05, 0.80, 0.35) * glow * (0.5 + u_bass * 0.5);
          glowCol += vec3(0.40, 0.0, 0.80) * glow * glow * 0.4;
          col += glowCol;
        }

        // -- Overall luminance boost (bioluminescence is self-lit) --
        col *= 1.1 + u_bass * 0.25;

        // Tone map: soft clamp to preserve highlights
        col = col / (col + 0.8);
        col = pow(col, vec3(0.85)); // slight gamma lift

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    try {
      return p.createShader(vert, frag);
    } catch (_) {
      return null;
    }
  }

  updateAudio(audioData) {
    this.audio.bass    = audioData.bass    || 0;
    this.audio.mid     = audioData.mid     || 0;
    this.audio.treble  = audioData.treble  || 0;
    this.audio.rms     = audioData.rms     || 0;
    this.audio.strength = audioData.strength || 0;
  }

  onBeat(strength) {
    this.beatPulse = strength;
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['sdf-alien'] = SdfAlienPreset;
})();
