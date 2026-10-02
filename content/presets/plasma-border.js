(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PlasmaBorderPreset extends BasePreset {
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
        preset._time += 0.02 + preset.audio.mid * 0.03;
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

      // Hash for noise
      float hash(vec2 p) {
        p = fract(p * vec2(443.897, 441.423));
        p += dot(p, p + 19.19);
        return fract(p.x * p.y);
      }

      // Value noise
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

      // FBM - 3 octaves for performance
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        mat2 rot = mat2(0.866, 0.5, -0.5, 0.866);
        for (int i = 0; i < 3; i++) {
          v += a * noise(p);
          p = rot * p * 2.0 + shift;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;

        // Distance from each edge (0 at edge, 0.5 at center)
        float dLeft = uv.x;
        float dRight = 1.0 - uv.x;
        float dBottom = uv.y;
        float dTop = 1.0 - uv.y;
        float edgeDist = min(min(dLeft, dRight), min(dBottom, dTop));

        // Border mask: strong at edges, fades to 0 toward center
        // ~20% from edge = borderWidth 0.2
        float borderWidth = 0.18 + u_beat * 0.04;
        float mask = smoothstep(borderWidth, 0.0, edgeDist);
        // Extra falloff for clean center
        mask *= mask;

        // Early out if center (no effect)
        if (mask < 0.001) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }

        // Plasma coordinates - flow along borders
        float flowSpeed = 0.8 + u_mid * 1.2;
        vec2 pCoord = uv * 6.0;

        // Primary plasma layer - large flowing tendrils
        float plasma1 = fbm(pCoord + vec2(u_time * flowSpeed * 0.3, u_time * flowSpeed * 0.2));

        // Secondary plasma layer - finer detail, different direction
        float plasma2 = fbm(pCoord * 1.8 + vec2(-u_time * flowSpeed * 0.4, u_time * flowSpeed * 0.15) + 50.0);

        // Tertiary layer - adds electric crackling
        float plasma3 = fbm(pCoord * 3.0 + vec2(u_time * flowSpeed * 0.5, -u_time * flowSpeed * 0.3) + 150.0);

        // Combine plasma layers
        float plasma = plasma1 * 0.5 + plasma2 * 0.3 + plasma3 * 0.2;

        // Electric arcs - sharp bright lines along edges
        float arc = pow(plasma, 3.0) * 4.0;

        // Tendril effect - plasma reaches inward from edges
        float tendril = fbm(pCoord * 2.0 + vec2(u_time * 0.6, 0.0) + edgeDist * 8.0);
        tendril = pow(tendril, 2.0) * mask;

        // Intensity driven by bass
        float intensity = 0.6 + u_bass * 0.8;

        // Beat surge - bright flash along all borders
        float surge = u_beat * 2.0;

        // Flickering/pulsing
        float flicker = 0.85 + 0.15 * sin(u_time * 8.0 + plasma1 * 6.28);
        float pulse = 0.9 + 0.1 * sin(u_time * 3.0);

        // Combine all effects
        float brightness = (plasma * 1.2 + arc * 0.5 + tendril * 0.8) * intensity * flicker * pulse;
        brightness += surge;
        brightness *= mask;

        // Color: electric blue and purple with white-hot highlights
        vec3 blue = vec3(0.1, 0.4, 1.0);
        vec3 purple = vec3(0.6, 0.1, 0.9);
        vec3 white = vec3(0.9, 0.9, 1.0);

        // Mix colors based on plasma pattern
        float colorMix = plasma1 * 1.5 + u_treble * 0.3;
        vec3 plasmaColor = mix(blue, purple, sin(colorMix * 3.14) * 0.5 + 0.5);

        // Add white-hot highlights on bright spots
        float hotSpot = smoothstep(0.6, 1.0, brightness);
        plasmaColor = mix(plasmaColor, white, hotSpot * 0.7);

        // Final color
        vec3 col = plasmaColor * brightness;

        // Extra glow on beat
        col += vec3(0.3, 0.5, 1.0) * surge * mask * 0.3;

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
window.VJamFX.presets['plasma-border'] = PlasmaBorderPreset;
})();
