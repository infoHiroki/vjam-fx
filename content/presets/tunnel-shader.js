(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class TunnelShaderPreset extends BasePreset {
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

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

        // Mid warps tunnel into oval shape
        uv.x *= 1.0 + u_mid * 0.3;

        // Polar coordinates
        float r = length(uv);
        float angle = atan(uv.y, uv.x);

        // Tunnel mapping: depth from inverse radius
        float depth = 1.0 / (r + 0.05);

        // Forward motion: time drives depth offset, bass increases speed
        float speed = u_time * 2.0 + u_bass * u_time * 0.5;

        // Beat causes speed burst
        depth += u_beat * 0.5;

        // Tunnel texture coordinates
        float tx = angle / 3.14159265;
        float ty = depth + speed;

        // Checkerboard / grid pattern on walls
        float gridScale = 6.0 + u_treble * 4.0;
        float cx = fract(tx * gridScale);
        float cy = fract(ty * gridScale * 0.5);

        // Grid lines
        float lineWidth = 0.04 + u_treble * 0.03;
        float gridX = smoothstep(lineWidth, 0.0, abs(cx - 0.5) - 0.45);
        float gridY = smoothstep(lineWidth, 0.0, abs(cy - 0.5) - 0.45);
        float grid = max(gridX, gridY);

        // Checkerboard fill
        float checker = step(0.5, fract(floor(tx * gridScale) * 0.5 + floor(ty * gridScale * 0.5) * 0.5));
        float pattern = mix(checker * 0.3, 1.0, grid);

        // Color shifts along depth for psychedelic feel
        vec3 col1 = vec3(0.1, 0.4, 0.9);
        vec3 col2 = vec3(0.9, 0.1, 0.5);
        vec3 col3 = vec3(0.1, 0.9, 0.4);
        float colorPhase = depth * 0.3 + u_time * 0.5;
        vec3 tunnelColor = mix(col1, col2, sin(colorPhase) * 0.5 + 0.5);
        tunnelColor = mix(tunnelColor, col3, sin(colorPhase * 0.7 + 2.0) * 0.5 + 0.5);

        // Apply pattern to color
        vec3 col = tunnelColor * pattern;

        // Depth fog: fade with distance (attenuate by r)
        float fog = 1.0 - smoothstep(0.0, 0.8, r);
        col *= depth * 0.15;
        col = mix(col * 0.2, col, fog);

        // Center glow: bright vanishing point
        float centerGlow = exp(-r * r * 8.0);
        vec3 glowColor = mix(vec3(1.0, 0.8, 0.5), vec3(0.5, 0.8, 1.0), sin(u_time * 0.3) * 0.5 + 0.5);
        col += glowColor * centerGlow * (0.6 + u_beat * 0.8);

        // Beat pulse: tunnel diameter throb (brighten walls)
        col *= 1.0 + u_beat * 0.5;

        // Bass enhances overall brightness
        col *= 1.0 + u_bass * 0.3;

        // Edge vignette
        float vignette = 1.0 - smoothstep(0.3, 1.2, r);
        col *= vignette;

        // Clamp output
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
window.VJamFX.presets['tunnel-shader'] = TunnelShaderPreset;
})();
