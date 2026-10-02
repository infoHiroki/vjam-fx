(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class MagneticPendulumPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this._shader = null;
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL);
        p.pixelDensity(1);
      };

      p.draw = () => {
        p.background(0);
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }

        preset._time += 0.011 + preset.audio.bass * 0.016 + preset.audio.mid * 0.004;
        preset.beatPulse *= 0.9;

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          p.noStroke();
          p.quad(-1, -1, 1, -1, 1, 1, -1, 1);
        } catch (_) {
        } finally {
          p.resetShader();
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
      };
    }, container);
  }

  _initShader(p) {
    const vert = `
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vUv;

void main() {
        vUv = aTexCoord;
        vec4 pos = vec4(aPosition, 1.0);
        pos.xy = pos.xy * 2.0 - 1.0;
        gl_Position = pos;
      }
    `;

    const frag = `
      precision highp float;
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;
      uniform vec2 u_resolution;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p){
        vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }

      vec2 rotate(vec2 p, float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c) * p;
      }

      // Simulate pendulum trajectory over magnets, returning accumulated trail glow
      float trailFlower(vec2 uv, float t, vec2 m1, vec2 m2, vec2 m3, float startAngle, float energy) {
        // Start from different angles around center to create flower pattern
        vec2 pos = vec2(cos(startAngle), sin(startAngle)) * (0.5 + energy * 0.15);
        vec2 vel = vec2(-sin(startAngle), cos(startAngle)) * (0.08 + u_bass * 0.2 + energy * 0.1);
        float glow = 0.0;

        for (int i = 0; i < 64; i++) {
          float fi = float(i);
          vec2 d1 = m1 - pos;
          vec2 d2 = m2 - pos;
          vec2 d3 = m3 - pos;

          // Magnetic pull with stronger attraction
          vec2 pull = d1 / (dot(d1, d1) + 0.02 + u_treble * 0.03);
          pull += d2 / (dot(d2, d2) + 0.02 + u_treble * 0.03);
          pull += d3 / (dot(d3, d3) + 0.02 + u_treble * 0.03);
          pull *= 0.012 + u_treble * 0.02 + u_bass * 0.006;

          // Central restoring force for flower-like orbits
          pull -= pos * (0.015 + u_mid * 0.008);

          vel += pull;
          vel *= 0.985 - u_rms * 0.04;
          pos += vel;

          // Glow along trail with fading intensity
          float fade = 1.0 - fi / 64.0;
          float seg = exp(-length(uv - pos) * (16.0 + u_rms * 12.0));
          glow += seg * fade * (0.06 + fi * 0.0008);
        }
        return glow;
      }

      vec3 audioReactiveFinalize(vec3 inCol, vec2 uv, float hue, vec2 reactCenter, float reactScatter, float reactPulse) {
        vec3 hueCycle = 0.5 + 0.5 * cos(6.2831853 * (hue + vec3(0.0, 0.33, 0.67)));
        vec3 baseGlow = hueCycle * (0.16 + 0.14 * reactScatter);
        baseGlow += hueCycle * reactPulse * (0.18 + u_rms * 0.4 + u_beat * 0.25);
        baseGlow += vec3(0.06, 0.07, 0.09) * (0.6 + reactScatter * 0.8);
        baseGlow *= 0.75 + 0.25 * exp(-length(uv - reactCenter) * 2.8);
        inCol = mix(inCol, inCol * hueCycle, 0.2 + 0.15 * reactScatter);
        inCol += baseGlow;
        return max(inCol, vec3(0.02, 0.02, 0.03));
      }
void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        float audioHue = u_time * 0.1 + u_treble * 0.5;
        vec2 audioDrift = vec2(sin(u_time * 0.3) * 1.5 + 1.5, sin(u_time * 0.23) * 1.5 + 1.5);
        uv += vec2(sin(u_time * 0.15), cos(u_time * 0.12)) * 0.06;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float t = u_time;

        // 3 magnets rotating slowly — triangle arrangement
        float a = 2.0943951;
        float magRadius = 0.3 + u_mid * 0.08;
        float magRot = t * 0.12 + u_bass * 0.3;
        vec2 m1 = vec2(cos(magRot), sin(magRot)) * magRadius;
        vec2 m2 = vec2(cos(magRot + a), sin(magRot + a)) * magRadius;
        vec2 m3 = vec2(cos(magRot + a * 2.0), sin(magRot + a * 2.0)) * magRadius;

        // Multiple pendulum trails from different starting angles — creates mandala/flower
        float totalTrail = 0.0;
        vec3 trailColor = vec3(0.0);

        for (int k = 0; k < 6; k++) {
          float fk = float(k);
          float startAngle = fk * 1.0472 + t * (0.15 + u_mid * 0.2);
          float energy = 0.5 + u_bass * 0.5 + sin(t * 0.3 + fk) * 0.2;

          float trail = trailFlower(uv, t, m1, m2, m3, startAngle, energy);
          totalTrail += trail;

          // Each trail has its own color
          vec3 tint = 0.5 + 0.5 * cos(6.2831 * (fk * 0.16 + t * 0.05 + vec3(0.0, 0.33, 0.67)));
          trailColor += tint * trail;
        }

        // Magnet glow — colored dots with halos
        float mag1 = exp(-length(uv - m1) * (14.0 + u_treble * 8.0));
        float mag2 = exp(-length(uv - m2) * (14.0 + u_treble * 8.0));
        float mag3 = exp(-length(uv - m3) * (14.0 + u_treble * 8.0));
        // Outer halo
        float halo1 = exp(-length(uv - m1) * 5.0) * 0.3;
        float halo2 = exp(-length(uv - m2) * 5.0) * 0.3;
        float halo3 = exp(-length(uv - m3) * 5.0) * 0.3;

        // Magnetic field lines (contour visualization)
        float field = 0.0;
        vec2 d1 = uv - m1;
        vec2 d2 = uv - m2;
        vec2 d3 = uv - m3;
        float pot = 1.0 / (length(d1) + 0.05) + 1.0 / (length(d2) + 0.05) + 1.0 / (length(d3) + 0.05);
        // Contour lines from the potential
        field = smoothstep(0.06, 0.0, abs(fract(pot * 0.08) - 0.5)) * 0.15;

        // Beat: expanding ring from center
        float releaseRing = abs(length(uv) - (0.1 + u_beat * 0.7));
        releaseRing = smoothstep(0.05, 0.0, releaseRing) * u_beat;

        // Symmetry mirror for mandala effect
        float symmetryGlow = 0.0;
        for (int s = 0; s < 3; s++) {
          float fs = float(s);
          vec2 muv = rotate(uv, fs * 2.0944);
          float radial = abs(fract(atan(muv.y, muv.x) * 3.0 / 6.2831 + t * 0.04) - 0.5);
          symmetryGlow += smoothstep(0.08, 0.0, radial) * totalTrail * 0.15;
        }

        // Compose
        vec3 bg = mix(vec3(0.01, 0.01, 0.02), vec3(0.03, 0.01, 0.05), 0.5 + 0.5 * uv.y);
        vec3 col = bg;

        // Field contours
        col += vec3(0.08, 0.12, 0.2) * field * (0.5 + u_treble * 0.8);

        // Trail flower — the main visual
        col += trailColor * (0.6 + u_rms * 0.8);
        col += vec3(0.3, 0.5, 0.8) * symmetryGlow;

        // Magnet dots
        col += vec3(1.0, 0.2, 0.35) * (mag1 + halo1);
        col += vec3(0.2, 1.0, 0.45) * (mag2 + halo2);
        col += vec3(0.25, 0.4, 1.0) * (mag3 + halo3);

        // Beat ring
        col += vec3(0.9, 0.85, 1.0) * releaseRing;
        // Beat flash
        col += vec3(0.15, 0.1, 0.25) * u_beat;

        float vignette = 1.0 - smoothstep(0.72, 1.35, length(uv * vec2(0.94, 1.08)));
        col *= vignette;
        col = 1.0 - exp(-col * (1.15 + u_rms * 0.7 + u_bass * 0.25));

        gl_FragColor = vec4(audioReactiveFinalize(clamp(col, 0.0, 1.0), uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }
    `;

    try {
      return p.createShader(vert, frag);
    } catch (_) {
      return null;
    }
  }

  updateAudio(d) {
    this.audio.bass = d.bass || 0;
    this.audio.mid = d.mid || 0;
    this.audio.treble = d.treble || 0;
    this.audio.rms = d.rms || 0;
  }

  onBeat(s) {
    this.beatPulse = Math.min(1, s);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['magnetic-pendulum'] = MagneticPendulumPreset;
})();
