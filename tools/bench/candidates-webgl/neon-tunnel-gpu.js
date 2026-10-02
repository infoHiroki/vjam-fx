(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class NeonTunnelGpuPreset extends BasePreset {
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
        preset._time += 0.02 + preset.audio.mid * 0.06;
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

      // HSV to RGB
      vec3 hsv2rgb(float h, float s, float v) {
        vec3 c = vec3(h, s, v);
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        vec2 p = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

        // Polar coordinates from center
        float angle = atan(p.y, p.x);
        float radius = length(p);

        // Fake depth: z = 1/r (small radius = far away)
        // Avoid division by zero
        float depth = 1.0 / max(radius, 0.001);

        // Flight speed controlled by mid + base speed
        float speed = u_time * (1.5 + u_mid * 3.0);

        // Ring placement along the tunnel depth
        float ringSpacing = 1.2;
        float z = depth * ringSpacing - speed;
        float ringZ = fract(z);      // position within ring cell
        float ringID = floor(z);      // which ring

        // Ring shape: thin band at certain depth positions
        // Distance from ring center (in depth space)
        float ringDist = abs(ringZ - 0.5);

        // Ring thickness varies with bass
        float thickness = 0.04 + u_bass * 0.06;
        float ring = smoothstep(thickness, thickness * 0.2, ringDist);

        // Glow around ring (soft bloom)
        float glowWidth = 0.15 + u_bass * 0.1;
        float glow = exp(-ringDist * ringDist / (glowWidth * glowWidth)) * 0.6;

        // Fade rings in the distance (large depth = far = small radius on screen)
        float depthFade = smoothstep(0.0, 0.15, radius) * smoothstep(2.0, 0.3, radius);

        // Color: cycling hue per ring
        float hue = fract(ringID * 0.13 + u_time * 0.1);
        // Snap to neon palette: cyan, magenta, green, yellow
        float hueSlot = floor(hue * 4.0);
        float neonHue;
        if (hueSlot < 1.0) neonHue = 0.5;        // cyan
        else if (hueSlot < 2.0) neonHue = 0.83;   // magenta
        else if (hueSlot < 3.0) neonHue = 0.33;   // green
        else neonHue = 0.16;                        // yellow

        vec3 ringColor = hsv2rgb(neonHue, 0.8, 1.0);

        // Treble adds shimmer variation along angle
        float shimmer = 0.8 + 0.2 * sin(angle * 8.0 + ringID * 2.5 + u_time * 3.0) * u_treble;

        // Combine ring + glow
        float intensity = (ring * 1.2 + glow) * depthFade * shimmer;

        // Beat burst: bright ring at near distance (large radius on screen)
        float beatRing = u_beat * smoothstep(0.3, 0.05, abs(ringZ - 0.5))
                 * smoothstep(0.0, 0.3, radius);
        vec3 beatColor = vec3(1.0, 1.0, 1.0);

        // Tunnel edge glow (subtle light at the edges)
        float edgeGlow = exp(-radius * radius * 2.0) * 0.05 * (1.0 + u_bass);

        // Dark background
        vec3 col = vec3(0.0);

        // Add rings
        col += ringColor * intensity;

        // Add beat burst
        col += beatColor * beatRing * 0.8;

        // Add center ambient glow
        col += vec3(0.1, 0.05, 0.15) * edgeGlow;

        // Second ring layer offset for density
        float z2 = depth * ringSpacing * 0.7 - speed * 0.8;
        float ringZ2 = fract(z2);
        float ringID2 = floor(z2);
        float ringDist2 = abs(ringZ2 - 0.5);
        float glow2 = exp(-ringDist2 * ringDist2 / (glowWidth * glowWidth)) * 0.3;
        float hue2 = fract(ringID2 * 0.17 + u_time * 0.07 + 0.5);
        float hueSlot2 = floor(hue2 * 4.0);
        float neonHue2;
        if (hueSlot2 < 1.0) neonHue2 = 0.5;
        else if (hueSlot2 < 2.0) neonHue2 = 0.83;
        else if (hueSlot2 < 3.0) neonHue2 = 0.33;
        else neonHue2 = 0.16;
        vec3 ringColor2 = hsv2rgb(neonHue2, 0.7, 0.8);
        float ring2 = smoothstep(thickness * 1.2, thickness * 0.3, ringDist2);
        col += ringColor2 * (ring2 * 0.5 + glow2) * depthFade;

        // Vignette
        float vig = 1.0 - 0.3 * dot(p, p);
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
window.VJamFX.presets['neon-tunnel-gpu'] = NeonTunnelGpuPreset;
})();
