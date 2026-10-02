(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FlameFrameGpuPreset extends BasePreset {
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

      // Hash-based noise
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

      // Fire color ramp: black -> deep red -> orange -> yellow -> white
      vec3 fireColor(float t) {
        t = clamp(t, 0.0, 1.0);
        vec3 c;
        if (t < 0.25) {
          c = mix(vec3(0.0), vec3(0.5, 0.0, 0.0), t * 4.0);
        } else if (t < 0.5) {
          c = mix(vec3(0.5, 0.0, 0.0), vec3(1.0, 0.4, 0.0), (t - 0.25) * 4.0);
        } else if (t < 0.75) {
          c = mix(vec3(1.0, 0.4, 0.0), vec3(1.0, 0.9, 0.2), (t - 0.5) * 4.0);
        } else {
          c = mix(vec3(1.0, 0.9, 0.2), vec3(1.0, 1.0, 0.9), (t - 0.75) * 4.0);
        }
        return c;
      }

      // Flame shape from a given edge
      float flameShape(vec2 uv, float flameDir, float baseHeight, float time, float bass, float mid, float beat) {
        // flameDir: distance from edge (0 = at edge, 1 = far away)
        float height = baseHeight * (1.0 + bass * 0.6 + beat * 0.8);

        // Noise-based flame distortion
        float speed = 3.0 + mid * 4.0;
        float n = fbm(vec2(uv.x * 4.0, uv.y * 3.0 - time * speed));
        float n2 = fbm(vec2(uv.x * 8.0 + 50.0, uv.y * 6.0 - time * speed * 1.3));

        // Combine noises for flame shape
        float shape = n * 0.7 + n2 * 0.3;
        shape *= height;

        // Flame intensity falls off with distance from edge
        float flame = shape - flameDir;
        flame = smoothstep(0.0, height * 0.5, flame);

        return flame;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        vec3 col = vec3(0.0);

        float time = u_time;
        float bass = u_bass;
        float mid = u_mid;
        float beat = u_beat;

        // === Bottom flames (main) ===
        float bottomDist = uv.y; // 0 at bottom, 1 at top
        float bottomFlame = flameShape(
          vec2(uv.x * 3.0, bottomDist),
          bottomDist,
          0.25,
          time,
          bass, mid, beat
        );

        // Heat shimmer near flame tips
        float shimmer = fbm(vec2(uv.x * 12.0, uv.y * 12.0 - time * 2.0)) * 0.15;
        float shimmerZone = smoothstep(0.15, 0.25, bottomDist) * smoothstep(0.35, 0.25, bottomDist);
        bottomFlame += shimmer * shimmerZone * (0.5 + bass * 0.5);

        vec3 bottomColor = fireColor(bottomFlame * 1.2);
        col += bottomColor * bottomFlame;

        // === Left flames ===
        float leftDist = uv.x; // 0 at left edge
        float leftFlame = flameShape(
          vec2(uv.y * 3.0, leftDist),
          leftDist,
          0.15,
          time * 1.1 + 10.0,
          bass, mid, beat
        );
        vec3 leftColor = fireColor(leftFlame * 1.2);
        col += leftColor * leftFlame;

        // === Right flames ===
        float rightDist = 1.0 - uv.x; // 0 at right edge
        float rightFlame = flameShape(
          vec2(uv.y * 3.0, rightDist),
          rightDist,
          0.15,
          time * 0.9 + 20.0,
          bass, mid, beat
        );
        vec3 rightColor = fireColor(rightFlame * 1.2);
        col += rightColor * rightFlame;

        // === Beat burst: tall flame spike from bottom ===
        if (beat > 0.05) {
          float burstN = fbm(vec2(uv.x * 6.0, bottomDist * 2.0 - time * 6.0));
          float burstHeight = 0.4 * beat;
          float burst = burstN * burstHeight - bottomDist;
          burst = smoothstep(0.0, burstHeight * 0.4, burst);
          col += fireColor(burst * 1.5) * burst * beat;
        }

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
window.VJamFX.presets['flame-frame-gpu'] = FlameFrameGpuPreset;
})();
