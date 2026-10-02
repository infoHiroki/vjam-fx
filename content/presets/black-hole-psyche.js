(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class BlackHolePsychePreset extends BasePreset {
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
        preset._time += 0.016 + preset._sMid * 0.03;
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
      uniform vec2 u_resolution;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
        return v;
      }

      // Psychedelic rainbow palette
      vec3 psycheColor(float t) {
        return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        float r = length(uv);
        float phi = atan(uv.y, uv.x);

        // Event horizon — pulses with bass
        float rs = 0.13 + u_bass * 0.04 + u_beat * 0.03;

        // ---- Gravitational lensing: stronger, distorts colors ----
        float lensStr = rs * rs / max(r * r, 0.0003) * 1.2;
        vec2 lensedUV = uv + normalize(uv + 0.0001) * lensStr;

        // ---- Swirling accretion vortex ----
        // Everything spirals inward — polar coordinates warped
        float spiralSpeed = 1.5 + u_mid * 2.0;
        float spiralPhi = phi + lensStr * 3.0 + u_time * spiralSpeed * 0.3;
        // Spiral arms via sin modulation
        float spiral = sin(spiralPhi * 3.0 - r * 20.0 + u_time * spiralSpeed) * 0.5 + 0.5;
        float spiral2 = sin(spiralPhi * 5.0 + r * 15.0 - u_time * spiralSpeed * 0.7) * 0.5 + 0.5;

        // ---- Color: rainbow hue rotates with angle + time + distance ----
        float hue = phi / 6.28318 + u_time * 0.15 + r * 2.0 + lensStr * 0.5;
        // Treble shifts hue rapidly
        hue += u_treble * sin(u_time * 6.0 + r * 10.0) * 0.3;
        vec3 rainbowCol = psycheColor(hue);

        // Second hue layer for depth
        float hue2 = phi / 6.28318 - u_time * 0.1 + r * 3.5;
        vec3 rainbowCol2 = psycheColor(hue2 + 0.5);

        // ---- Disk structure ----
        float diskInner = rs * 1.4;
        float diskOuter = rs * 8.0 + u_bass * rs * 2.0;
        float diskMask = smoothstep(diskInner - 0.02, diskInner + 0.03, r) *
                smoothstep(diskOuter + 0.02, diskOuter - 0.05, r);
        diskMask *= step(rs, r);

        // Turbulent noise in swirl frame
        vec2 swirlUV = vec2(cos(spiralPhi), sin(spiralPhi)) * r;
        float turb = fbm(swirlUV * 10.0 + vec2(u_time * 0.15, 0.0));

        // ---- Disk color: psychedelic blend ----
        float heat = 1.0 - smoothstep(diskInner, diskOuter, r);
        vec3 diskCol = mix(rainbowCol, rainbowCol2, spiral * 0.6 + turb * 0.4);
        // Inner regions are brighter, white-hot core
        diskCol = mix(diskCol, vec3(1.0, 0.95, 0.9), heat * heat * 0.5);
        // Spiral arm brightness
        float armBright = spiral * 0.5 + spiral2 * 0.3 + 0.4;
        diskCol *= armBright * (0.8 + u_bass * 0.8);
        // Treble sparkle
        diskCol += rainbowCol * turb * u_treble * 0.8;

        // ---- Gravitational rainbow ring (photon sphere) ----
        float photonR = rs * 1.5;
        float ringGlow = exp(-abs(r - photonR) * 40.0) * (1.0 + u_bass * 0.6);
        float ringHue = phi / 6.28318 + u_time * 0.5;
        vec3 ringCol = psycheColor(ringHue) * ringGlow * 1.5;

        // Second ring
        float ring2Glow = exp(-abs(r - rs * 2.8) * 25.0) * 0.5;
        vec3 ring2Col = psycheColor(ringHue + 0.5) * ring2Glow;

        // ---- Edge glow ----
        float edgeGlow = exp(-abs(r - rs) * 150.0) * (0.5 + u_beat * 1.0);
        vec3 edgeCol = psycheColor(u_time * 0.3) * edgeGlow;

        // ---- Lensed star field (tinted psychedelic) ----
        float stars = 0.0;
        for (int i = 0; i < 2; i++) {
          float scale = 70.0 + float(i) * 55.0;
          vec2 g = floor(lensedUV * scale);
          vec2 f = fract(lensedUV * scale) - 0.5;
          float h = hash(g + float(i) * 13.7);
          float br = smoothstep(0.96, 1.0, h);
          float tw = 1.0 + 0.5 * sin(u_time * (3.0 + h * 5.0)) * (0.3 + u_treble * 0.7);
          stars += br * tw * exp(-dot(f, f) * 250.0);
        }
        float shadowMask = smoothstep(rs, rs * 3.0, r);
        // Stars are rainbow-tinted
        vec3 starCol = psycheColor(hash(floor(lensedUV * 80.0)) + u_time * 0.1) * stars * shadowMask * 0.6;

        // ---- Background: dark with psychedelic nebula ----
        float neb = fbm(uv * 2.5 + vec2(u_time * 0.01, u_time * 0.008));
        vec3 bgCol = vec3(0.01, 0.005, 0.02);
        bgCol += psycheColor(neb + u_time * 0.05) * neb * 0.08;

        // ---- Event horizon ----
        float ehMask = smoothstep(rs + 0.006, rs - 0.003, r);

        // ---- Compose ----
        vec3 col = bgCol;
        col += starCol;
        col += (ringCol + ring2Col) * (1.0 - ehMask);
        col += edgeCol * (1.0 - ehMask);
        col = mix(col, diskCol, diskMask * (1.0 - ehMask));
        // Event horizon: not pure black — deep pulsing void
        vec3 voidCol = psycheColor(u_time * 0.2) * 0.03 * (1.0 + u_beat * 2.0);
        col = mix(col, voidCol, ehMask);

        // ---- Beat: full-screen color flash ----
        float flareMask = smoothstep(rs * 5.0, rs * 1.0, r) * (1.0 - ehMask);
        col += psycheColor(u_time * 0.7) * u_beat * flareMask * 0.6;

        // ---- Vignette ----
        col *= max(1.0 - 0.35 * dot(uv, uv), 0.0);

        // Slight saturation boost
        col = pow(max(col, vec3(0.0)), vec3(0.9));
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
    this.audio.strength = d.strength || 0;
  }

  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['black-hole-psyche'] = BlackHolePsychePreset;
})();
