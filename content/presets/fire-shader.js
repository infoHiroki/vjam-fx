(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FireShaderPreset extends BasePreset {
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
        preset._time += 0.025 + preset.audio.bass * 0.04;
        preset.beatPulse *= 0.88;
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
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
        return v;
      }

      vec3 fireColor(float temp) {
        // Temperature gradient: black -> dark red -> orange -> yellow -> white
        vec3 c = vec3(0.0);
        c = mix(c, vec3(0.5, 0.0, 0.0), smoothstep(0.0, 0.2, temp));       // black -> dark red
        c = mix(c, vec3(0.9, 0.2, 0.0), smoothstep(0.2, 0.4, temp));       // dark red -> red-orange
        c = mix(c, vec3(1.0, 0.6, 0.0), smoothstep(0.4, 0.6, temp));       // red-orange -> orange
        c = mix(c, vec3(1.0, 0.9, 0.2), smoothstep(0.6, 0.8, temp));       // orange -> yellow
        c = mix(c, vec3(1.0, 1.0, 0.9), smoothstep(0.8, 1.0, temp));       // yellow -> white-hot
        return c;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        float t = u_time;

        // Flame height: bass increases, beat causes burst
        float flameHeight = 0.6 + u_bass * 0.4 + u_beat * 0.5;

        // Turbulence width: mid affects horizontal spread
        float turbulence = 1.0 + u_mid * 0.8;

        // Distort UVs upward for rising flame motion
        vec2 fireUv = uv;
        fireUv.y += 0.5;  // shift origin to bottom of screen
        fireUv.x *= turbulence;

        // Rising motion: offset Y by time
        fireUv.y -= t * 0.8;

        // FBM noise for flame shape
        float n1 = fbm(fireUv * 3.0 + vec2(0.0, t * 0.5));
        float n2 = fbm(fireUv * 5.0 + vec2(t * 0.3, t * 0.7));
        float n3 = fbm(fireUv * 8.0 + vec2(-t * 0.2, t * 1.0));

        // Combine noise layers for organic flame shape
        float flame = n1 * 0.5 + n2 * 0.35 + n3 * 0.15;

        // Vertical gradient: flames strong at bottom, fade at top
        float yNorm = (uv.y + 0.5);  // 0 at bottom, 1 at top
        float verticalFade = 1.0 - smoothstep(0.0, flameHeight, yNorm);

        // Horizontal falloff: narrower at top, wider at base
        float horizFade = 1.0 - smoothstep(0.0, 0.4 + (1.0 - yNorm) * 0.3, abs(uv.x));

        // Combine into temperature value
        float temp = flame * verticalFade * horizFade;

        // Boost intensity with bass and beat
        temp *= 1.0 + u_bass * 0.3 + u_beat * 0.4;
        temp = clamp(temp, 0.0, 1.0);

        // Apply fire color gradient
        vec3 col = fireColor(temp);

        // Sparks/embers from treble: high-frequency noise dots
        float sparkNoise = hash(floor(gl_FragCoord.xy * 0.3) + vec2(t * 7.0, t * 5.0));
        float sparkMask = step(0.97 - u_treble * 0.03, sparkNoise);
        // Sparks only in flame region, rising upward
        float sparkRegion = smoothstep(0.0, 0.7, verticalFade) * horizFade;
        float sparkFlicker = sin(t * 20.0 + sparkNoise * 50.0) * 0.5 + 0.5;
        vec3 sparkColor = vec3(1.0, 0.8, 0.3) * sparkMask * sparkRegion * sparkFlicker * (0.3 + u_treble * 0.7);
        col += sparkColor;

        // Subtle ambient glow at bottom
        float glow = exp(-yNorm * 3.0) * 0.08 * (1.0 + u_bass * 0.5);
        col += vec3(0.4, 0.05, 0.0) * glow;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['fire-shader'] = FireShaderPreset;
})();
