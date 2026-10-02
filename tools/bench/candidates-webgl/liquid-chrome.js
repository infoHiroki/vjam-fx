(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class LiquidChromePreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
    this.beatPulse = 0;
    this._shader = null;
    this._time = 0;
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
        preset._time += 0.015 + preset.audio.mid * 0.025;
        preset.beatPulse *= 0.92;
        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
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

      // Hash and noise functions
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }

      // FBM with 4 octaves
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.07; a *= 0.48; }
        return v;
      }

      // Fake environment map reflection
      vec3 envMap(vec3 n) {
        float t = u_time * 0.3;
        vec2 envUv = n.xy * 0.5 + 0.5;
        float e1 = fbm(envUv * 3.0 + vec2(t * 0.2, t * 0.15));
        float e2 = fbm(envUv * 5.0 - vec2(t * 0.1, t * 0.25));
        float e = e1 * 0.6 + e2 * 0.4;

        // Chrome base: silver-white with high contrast
        vec3 chrome = vec3(0.85 + e * 0.15);

        // Subtle iridescence — rainbow tint at extremes
        float irid = n.x * 2.0 + n.y + u_time * 0.1;
        vec3 rainbow = 0.5 + 0.5 * cos(6.28 * (irid * 0.3 + vec3(0.0, 0.33, 0.67)));
        chrome = mix(chrome, rainbow, 0.12 + u_treble * 0.08);

        return chrome;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        vec2 centeredUv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        float t = u_time;

        // Surface distortion — bass drives amplitude
        float distAmp = 0.4 + u_bass * 0.6;
        vec2 distUv = centeredUv * 2.5;

        // Multiple noise layers for liquid surface
        float n1 = fbm(distUv + vec2(t * 0.15, t * 0.12));
        float n2 = fbm(distUv * 1.5 - vec2(t * 0.1, t * 0.18) + n1 * 0.5);
        float n3 = fbm(distUv * 0.8 + vec2(n2 * 0.4, t * 0.08));

        // Combined surface height
        float surface = n1 * 0.4 + n2 * 0.35 + n3 * 0.25;

        // Beat ripple — radial splash
        float dist = length(centeredUv);
        float ripple = sin(dist * 20.0 - u_beat * 8.0) * u_beat * 0.15;
        surface += ripple;

        // Compute fake surface normal from height differences
        float eps = 0.008;
        float hL = fbm(distUv + vec2(-eps, 0.0) + vec2(t * 0.15, t * 0.12)) * 0.4
             + fbm((distUv + vec2(-eps, 0.0)) * 1.5 - vec2(t * 0.1, t * 0.18)) * 0.35;
        float hR = fbm(distUv + vec2(eps, 0.0) + vec2(t * 0.15, t * 0.12)) * 0.4
             + fbm((distUv + vec2(eps, 0.0)) * 1.5 - vec2(t * 0.1, t * 0.18)) * 0.35;
        float hD = fbm(distUv + vec2(0.0, -eps) + vec2(t * 0.15, t * 0.12)) * 0.4
             + fbm((distUv + vec2(0.0, -eps)) * 1.5 - vec2(t * 0.1, t * 0.18)) * 0.35;
        float hU = fbm(distUv + vec2(0.0, eps) + vec2(t * 0.15, t * 0.12)) * 0.4
             + fbm((distUv + vec2(0.0, eps)) * 1.5 - vec2(t * 0.1, t * 0.18)) * 0.35;

        vec3 normal = normalize(vec3(
          (hL - hR) * distAmp * 6.0,
          (hD - hU) * distAmp * 6.0,
          1.0
        ));

        // View direction (towards screen)
        vec3 viewDir = normalize(vec3(centeredUv * 0.5, 1.0));

        // Reflection vector
        vec3 refl = reflect(-viewDir, normal);

        // Chrome reflection color from fake env map
        vec3 col = envMap(refl);

        // Fresnel-like edge highlight
        float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
        fresnel = pow(fresnel, 2.5);
        col += fresnel * vec3(0.9, 0.92, 1.0) * (0.6 + u_treble * 0.3);

        // Dark creases in concave areas
        float cavity = smoothstep(0.35, 0.55, surface);
        col *= 0.5 + cavity * 0.5;

        // Specular highlights — bright spots on peaks
        float spec = pow(max(refl.z, 0.0), 16.0);
        col += spec * vec3(1.0, 0.98, 0.95) * (0.8 + u_bass * 0.4);

        // Beat: bright flash in center
        col += exp(-dist * 4.0) * u_beat * 0.6 * vec3(1.0, 0.97, 0.92);

        // Overall brightness from audio
        col *= 0.85 + u_bass * 0.15 + u_mid * 0.1;

        // Tone mapping to prevent blowout
        col = col / (col + vec3(0.5));
        col = pow(col, vec3(0.9));

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['liquid-chrome'] = LiquidChromePreset;
})();
