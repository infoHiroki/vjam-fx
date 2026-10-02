(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class NeonTunnelSlowPreset extends BasePreset {
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
        preset._time += 0.006 + preset.audio.mid * 0.012;
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
      precision mediump float;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_beat;
      uniform vec2 u_resolution;

      vec3 hsv2rgb(float h, float s, float v) {
        vec3 c = vec3(h, s, v);
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        vec2 p = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

        float angle = atan(p.y, p.x);
        float radius = length(p);
        float depth = 1.0 / max(radius, 0.001);

        // Slow drift speed
        float speed = u_time * (0.4 + u_mid * 0.8);

        // Wider ring spacing for dreamy look
        float ringSpacing = 1.6;
        float z = depth * ringSpacing - speed;
        float ringZ = fract(z);
        float ringID = floor(z);

        float ringDist = abs(ringZ - 0.5);

        // Thicker, softer rings
        float thickness = 0.06 + u_bass * 0.04;
        float ring = smoothstep(thickness, thickness * 0.1, ringDist);

        // Wide glow for ambient feel
        float glowWidth = 0.22 + u_bass * 0.08;
        float glow = exp(-ringDist * ringDist / (glowWidth * glowWidth)) * 0.7;

        float depthFade = smoothstep(0.0, 0.12, radius) * smoothstep(1.8, 0.25, radius);

        // Smooth hue cycling (no quantization for softer palette)
        float hue = fract(ringID * 0.08 + u_time * 0.03);
        vec3 ringColor = hsv2rgb(hue, 0.65, 1.0);

        // Gentle shimmer
        float shimmer = 0.85 + 0.15 * sin(angle * 5.0 + ringID * 1.8 + u_time * 1.5) * (0.3 + u_treble * 0.7);

        float intensity = (ring * 0.8 + glow) * depthFade * shimmer;

        // Subtle beat pulse
        float beatRing = u_beat * 0.5 * smoothstep(0.35, 0.05, ringDist)
                 * smoothstep(0.0, 0.25, radius);
        vec3 beatColor = vec3(1.0, 0.95, 0.9);

        // Center ambient glow
        float edgeGlow = exp(-radius * radius * 1.5) * 0.08 * (1.0 + u_bass * 0.5);

        vec3 col = vec3(0.0);
        col += ringColor * intensity;
        col += beatColor * beatRing * 0.6;
        col += vec3(0.08, 0.04, 0.12) * edgeGlow;

        // Second layer - slower, offset
        float z2 = depth * ringSpacing * 0.6 - speed * 0.5;
        float ringZ2 = fract(z2);
        float ringID2 = floor(z2);
        float ringDist2 = abs(ringZ2 - 0.5);
        float glow2 = exp(-ringDist2 * ringDist2 / (glowWidth * glowWidth)) * 0.35;
        float hue2 = fract(ringID2 * 0.11 + u_time * 0.02 + 0.5);
        vec3 ringColor2 = hsv2rgb(hue2, 0.55, 0.85);
        float ring2 = smoothstep(thickness * 1.3, thickness * 0.2, ringDist2);
        col += ringColor2 * (ring2 * 0.4 + glow2) * depthFade;

        // Soft vignette
        float vig = 1.0 - 0.25 * dot(p, p);
        col *= vig;

        col = clamp(col, 0.0, 1.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `;
    try { return p.createShader(vert, frag); } catch (_) { return null; }
  }

  updateAudio(d) { this.audio.bass = d.bass||0; this.audio.mid = d.mid||0; this.audio.treble = d.treble||0; this.audio.rms = d.rms||0; }
  onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['neon-tunnel-slow'] = NeonTunnelSlowPreset;
})();
