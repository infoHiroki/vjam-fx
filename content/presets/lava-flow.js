(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class LavaFlowPreset extends BasePreset {
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
      precision mediump float;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      // Hash-based noise (no texture lookups, mobile-friendly)
      float hash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // FBM with 5 octaves for lava texture
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = rot * p * 2.0 + shift;
          a *= 0.5;
        }
        return v;
      }

      // Temperature-based lava color
      vec3 lavaColor(float temp) {
        // Black crust -> dark red -> orange -> yellow -> white hot
        vec3 col = vec3(0.0);
        col = mix(col, vec3(0.2, 0.02, 0.0), smoothstep(0.0, 0.2, temp));    // dark crust
        col = mix(col, vec3(0.6, 0.1, 0.0), smoothstep(0.2, 0.4, temp));      // dark red
        col = mix(col, vec3(1.0, 0.3, 0.0), smoothstep(0.4, 0.6, temp));      // orange
        col = mix(col, vec3(1.0, 0.7, 0.1), smoothstep(0.6, 0.8, temp));      // yellow-orange
        col = mix(col, vec3(1.0, 0.95, 0.7), smoothstep(0.8, 1.0, temp));     // white hot
        return col;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        float flowSpeed = 0.3 + u_mid * 0.5;
        float t = u_time * flowSpeed;

        // Slow flowing displacement
        vec2 flow = vec2(
          fbm(uv * 2.0 + vec2(t * 0.3, t * 0.1)),
          fbm(uv * 2.0 + vec2(-t * 0.2, t * 0.25) + 50.0)
        );

        // Domain warping: feed fbm output back as input for organic look
        float warp1 = fbm(uv * 3.0 + flow * 1.5 + t * 0.1);
        float warp2 = fbm(uv * 3.0 + flow * 1.2 + vec2(warp1 * 0.8) + t * 0.08);

        // Crack pattern: sharp transitions between cooled and molten areas
        float crackDetail = 3.0 + u_treble * 4.0;
        float cracks = fbm(uv * crackDetail + flow * 0.8 + vec2(warp2 * 1.5));
        // Sharpen cracks: push values toward 0 or 1
        cracks = smoothstep(0.35, 0.55, cracks);

        // Base temperature from domain-warped FBM
        float temp = warp2 * 0.6 + cracks * 0.5;

        // Bass raises overall temperature (more molten)
        temp += u_bass * 0.25;

        // Beat eruption: bright pulse from cracks
        float eruption = u_beat * cracks * 1.5;
        temp += eruption;

        // Clamp and shape
        temp = clamp(temp, 0.0, 1.0);

        // Color from temperature gradient
        vec3 col = lavaColor(temp);

        // Subtle glow in hot areas
        col += vec3(0.3, 0.05, 0.0) * smoothstep(0.5, 0.9, temp) * 0.3;

        // Beat flash: warm white pulse
        col += vec3(0.8, 0.4, 0.1) * eruption * 0.5;

        // Darken edges slightly for depth
        float vignette = 1.0 - dot(uv, uv) * 0.3;
        col *= vignette;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['lava-flow'] = LavaFlowPreset;
})();
