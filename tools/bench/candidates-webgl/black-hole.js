(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class BlackHolePreset extends BasePreset {
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

      // --- Hash / noise helpers ---
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float hash1(float n) {
        return fract(sin(n) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i),             hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
        return v;
      }

      // --- Star field (distorted by gravitational lensing) ---
      // Returns star brightness at lensed UV position
      float starField(vec2 uv, float t) {
        float stars = 0.0;
        // Two layers of stars at different densities
        for (int i = 0; i < 2; i++) {
          float scale = 80.0 + float(i) * 60.0;
          vec2 g = floor(uv * scale);
          vec2 f = fract(uv * scale) - 0.5;
          float h = hash(g + float(i) * 17.3);
          // Only bright enough hash values become stars
          float brightness = smoothstep(0.97, 1.0, h);
          // Twinkle driven by treble
          float twinkle = 1.0 + 0.5 * sin(t * (3.0 + h * 5.0)) * (0.3 + u_treble * 0.7);
          float d = length(f);
          stars += brightness * twinkle * exp(-d * d * 300.0);
        }
        return clamp(stars, 0.0, 1.0);
      }

      // --- Accretion disk ---
      // diskMask: 1 inside disk annulus, 0 outside
      // diskColor: heat-gradient col from inner (white-hot) to outer (red)
      float diskMask(float r, float innerR, float outerR) {
        return smoothstep(innerR - 0.01, innerR + 0.02, r) *
           smoothstep(outerR + 0.01, outerR - 0.02, r);
      }

      vec3 diskHeatColor(float t) {
        // t=0 outer (red), t=1 inner (white-hot)
        vec3 red    = vec3(0.9,  0.15, 0.02);
        vec3 orange = vec3(1.0,  0.45, 0.05);
        vec3 yellow = vec3(1.0,  0.85, 0.30);
        vec3 white  = vec3(1.0,  0.95, 0.85);
        if (t < 0.33) return mix(red, orange, t / 0.33);
        if (t < 0.66) return mix(orange, yellow, (t - 0.33) / 0.33);
        return mix(yellow, white, (t - 0.66) / 0.34);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        float r   = length(uv);
        float phi = atan(uv.y, uv.x);

        // ---- Schwarzschild radius ----
        float rs = 0.15 + u_bass * 0.03;

        // ---- Gravitational lensing (stronger, Interstellar-like) ----
        float lensStrength = rs * rs / max(r * r, 0.0005);
        vec2 lensedUV = uv + normalize(uv + 0.0001) * lensStrength * 0.8;

        // ---- Accretion disk: thin, tilted (Gargantua style) ----
        // Near edge-on tilt to see the Einstein ring wrap
        float tiltAngle = 0.75;  // high tilt for dramatic ring
        float diskInner = rs * 1.5;
        float diskOuter = rs * 6.0 + u_bass * rs * 1.5;

        // Front disk (equatorial plane, tilted)
        float diskY_front = uv.y / (1.0 - tiltAngle + 0.001);
        float diskR_front = sqrt(uv.x * uv.x + diskY_front * diskY_front);
        float diskPhi_front = atan(diskY_front, uv.x);

        // Einstein ring: disk wraps OVER the top and bottom of the hole
        // This is the back side of the disk, gravitationally lensed above/below
        float wrapY = (abs(uv.y) - rs * 0.5) / (1.0 - tiltAngle + 0.001);
        float wrapR = sqrt(uv.x * uv.x + wrapY * wrapY);
        float wrapPhi = atan(wrapY, uv.x);
        // Only visible near the hole, above/below the equatorial plane
        float wrapMask = smoothstep(rs * 2.5, rs * 0.8, r) * smoothstep(0.0, rs * 0.3, abs(uv.y));

        // ---- Disk rotation (Keplerian) ----
        float omega = 0.3 + u_mid * 0.5;

        // Front disk
        float kepler_f = pow(max(diskR_front / diskInner, 1.0), -1.5);
        float rotA_f = u_time * omega * kepler_f;
        vec2 dUV_f = vec2(cos(diskPhi_front + rotA_f), sin(diskPhi_front + rotA_f)) * diskR_front;
        float dNoise_f = fbm(dUV_f * 14.0 + vec2(u_time * 0.08, 0.0));

        // Back (wrapped) disk
        float kepler_w = pow(max(wrapR / diskInner, 1.0), -1.5);
        float rotA_w = u_time * omega * kepler_w + 3.14159;
        vec2 dUV_w = vec2(cos(wrapPhi + rotA_w), sin(wrapPhi + rotA_w)) * wrapR;
        float dNoise_w = fbm(dUV_w * 14.0 - vec2(u_time * 0.06, 0.0));

        // ---- Disk masks ----
        float dMask_f = diskMask(diskR_front, diskInner, diskOuter) * step(rs, r);
        float dMask_w = diskMask(wrapR, diskInner, diskOuter * 0.7) * wrapMask * step(rs, r);

        // ---- Heat gradient ----
        float heat_f = 1.0 - smoothstep(diskInner, diskOuter, diskR_front);
        float heat_w = 1.0 - smoothstep(diskInner, diskOuter * 0.7, wrapR);

        // ---- Doppler beaming (approaching side brighter) ----
        float doppler_f = 0.5 + 0.5 * sin(diskPhi_front + rotA_f);
        float doppler_w = 0.5 + 0.5 * sin(wrapPhi + rotA_w);
        float dBoost_f = mix(0.35, 1.8, doppler_f);
        float dBoost_w = mix(0.35, 1.8, doppler_w);

        // ---- Disk colors ----
        float diskBr_f = (0.7 + u_bass * 0.8) * dBoost_f * (0.7 + dNoise_f * 0.5);
        float diskBr_w = (0.5 + u_bass * 0.6) * dBoost_w * (0.7 + dNoise_w * 0.5);

        // Treble hotspots
        float hot_f = smoothstep(0.4, 0.7, dNoise_f) * u_treble * 1.2;
        float hot_w = smoothstep(0.4, 0.7, dNoise_w) * u_treble * 1.0;

        vec3 diskCol_f = diskHeatColor(heat_f + hot_f * 0.2) * diskBr_f;
        vec3 diskCol_w = diskHeatColor(heat_w + hot_w * 0.2) * diskBr_w;

        // Inner glow at ISCO
        float iglow_f = exp(-(diskR_front - rs * 1.2) * 20.0) * (0.8 + u_bass * 0.5);
        float iglow_w = exp(-(wrapR - rs * 1.2) * 20.0) * (0.6 + u_bass * 0.4);
        diskCol_f += vec3(1.0, 0.85, 0.55) * iglow_f * 0.5;
        diskCol_w += vec3(1.0, 0.85, 0.55) * iglow_w * 0.4;

        // ---- Star field (lensed) ----
        float starBright = starField(lensedUV, u_time);
        float shadowMask = smoothstep(rs, rs * 3.0, r);
        vec3 starCol = vec3(0.85, 0.90, 1.00) * starBright * shadowMask * 0.7;

        // ---- Background ----
        float nebula = fbm(uv * 3.0 + vec2(u_time * 0.008, 0.0)) * 0.06;
        vec3 bgCol = vec3(0.008, 0.008, 0.02) + vec3(0.03, 0.015, 0.06) * nebula;

        // ---- Event horizon ----
        float ehMask = smoothstep(rs + 0.008, rs - 0.004, r);

        // ---- Photon sphere ring (bright Einstein ring glow) ----
        float photonR = rs * 1.5;
        float photonGlow = exp(-abs(r - photonR) * 60.0) * (0.7 + u_bass * 0.5);
        // Broader secondary ring at ~2.5 rs
        float ring2 = exp(-abs(r - rs * 2.6) * 30.0) * 0.25;
        vec3 photonCol = vec3(1.0, 0.88, 0.60) * (photonGlow + ring2);

        // ---- Thin bright edge ring at event horizon ----
        float edgeRing = exp(-abs(r - rs) * 200.0) * (0.4 + u_beat * 0.8);
        vec3 edgeCol = vec3(1.0, 0.7, 0.3) * edgeRing;

        // ---- Compose ----
        vec3 col = bgCol;
        col += starCol;
        col += photonCol * (1.0 - ehMask);
        col += edgeCol * (1.0 - ehMask);
        // Front disk
        col = mix(col, diskCol_f, dMask_f * (1.0 - ehMask));
        // Back disk (Einstein ring wrap)
        col += diskCol_w * dMask_w * (1.0 - ehMask) * 0.8;
        // Event horizon: pure black
        col = mix(col, vec3(0.0), ehMask);

        // ---- Beat: disk flare burst ----
        float flareMask = smoothstep(rs * 4.0, rs * 1.2, r) * (1.0 - ehMask);
        col += vec3(1.0, 0.8, 0.4) * u_beat * flareMask * 0.5;

        // ---- Vignette ----
        float vig = 1.0 - 0.4 * dot(uv, uv);
        col *= max(vig, 0.0);

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
window.VJamFX.presets['black-hole'] = BlackHolePreset;
})();
