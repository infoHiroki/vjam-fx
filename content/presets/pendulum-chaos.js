(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PendulumChaosPreset extends BasePreset {
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

        preset.beatPulse *= 0.91;
        preset._time += 0.013 + preset.audio.bass * 0.008 + preset.audio.mid * 0.005;

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_beat', preset.beatPulse);
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
      uniform vec2 u_resolution;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;

      // Double pendulum derivatives
      vec4 deriv(vec4 s, float g, float damping) {
        float t1 = s.x;
        float t2 = s.y;
        float w1 = s.z;
        float w2 = s.w;
        float delta = t1 - t2;
        float den = 2.0 - cos(2.0 * delta);
        float a1 = (
          -g * (2.0 * sin(t1) + sin(t1 - 2.0 * t2))
          - 2.0 * sin(delta) * (w2 * w2 + w1 * w1 * cos(delta))
        ) / den - damping * w1;
        float a2 = (
          2.0 * sin(delta) * (2.0 * w1 * w1 + 2.0 * g * cos(t1) + w2 * w2 * cos(delta))
        ) / den - damping * w2;
        return vec4(w1, w2, a1, a2);
      }

      vec4 rk4(vec4 s, float dt, float g, float damping) {
        vec4 k1 = deriv(s, g, damping);
        vec4 k2 = deriv(s + 0.5 * dt * k1, g, damping);
        vec4 k3 = deriv(s + 0.5 * dt * k2, g, damping);
        vec4 k4 = deriv(s + dt * k3, g, damping);
        return s + dt * (k1 + 2.0 * k2 + 2.0 * k3 + k4) / 6.0;
      }

      // Get both joint positions
      vec2 joint1(vec4 s) {
        return vec2(sin(s.x), -cos(s.x));
      }
      vec2 endpoint(vec4 s) {
        vec2 p1 = vec2(sin(s.x), -cos(s.x));
        vec2 p2 = p1 + vec2(sin(s.y), -cos(s.y));
        return p2;
      }

      float trailField(vec2 uv, float seedOffset) {
        // High gravity for wide swings, very low damping for sustained motion
        float g = 5.0 + u_bass * 8.0 + u_beat * 3.0;
        float damping = max(0.001, 0.02 - u_rms * 0.015);

        // Start with large angles for big arcs
        float baseA = 2.8 + sin(seedOffset * 1.7 + u_time * 0.1) * 0.5 + u_mid * 0.8;
        float baseB = 1.5 + cos(seedOffset * 2.3 + u_time * 0.08) * 0.6 + u_bass * 0.6;
        // Give initial angular velocity for dynamic motion
        float initW1 = sin(u_time * 0.2 + seedOffset * 3.0) * 2.0;
        float initW2 = cos(u_time * 0.15 + seedOffset * 2.0) * 3.0;
        vec4 s = vec4(baseA, baseB, initW1, initW2);

        float density = 0.0;
        float dt = 0.028 + u_rms * 0.015;
        float t0 = mod(u_time * (0.7 + u_mid * 0.4) + seedOffset * 1.5, 12.0);

        // Scale: pendulum arm length in screen space
        float armScale = 0.28 + u_bass * 0.04;

        for (int i = 0; i < 50; i++) {
          float fi = float(i);
          if (fi * dt > t0) break;
          s = rk4(s, dt, g, damping);

          // Draw both joints for the classic double pendulum wave pattern
          vec2 p1 = joint1(s) * armScale;
          vec2 p2 = endpoint(s) * armScale;

          // Joint 1 - dimmer inner trail
          float d1 = length(uv - p1);
          float glow1 = exp(-d1 * (20.0 + u_treble * 25.0));
          density += glow1 * 0.03;

          // Joint 2 - bright outer trail (the chaotic endpoint)
          float d2 = length(uv - p2);
          float glow2 = exp(-d2 * (22.0 + u_treble * 35.0));
          float ring = exp(-abs(d2 - 0.02) * (60.0 - u_treble * 15.0));
          density += glow2 * (0.08 + u_treble * 0.15) + ring * 0.04;

          // Rod connecting joints
          vec2 rodDir = p2 - p1;
          float rodLen = length(rodDir);
          if (rodLen > 0.001) {
            vec2 rodN = rodDir / rodLen;
            float proj = clamp(dot(uv - p1, rodN), 0.0, rodLen);
            vec2 closest = p1 + rodN * proj;
            float rodDist = length(uv - closest);
            density += exp(-rodDist * 60.0) * 0.015;
          }
        }
        return density;
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

        // Multiple pendulums with different initial conditions
        float field = 0.0;
        vec3 colAccum = vec3(0.0);

        for (int k = 0; k < 5; k++) {
          float fk = float(k);
          float offset = fk * 1.1;
          float trail = trailField(uv, offset);
          field += trail;

          // Each pendulum gets a different color
          vec3 tint = 0.5 + 0.5 * cos(6.2831 * (fk * 0.2 + u_time * 0.03 + vec3(0.0, 0.33, 0.67)));
          colAccum += tint * trail;
        }

        // Pivot point glow
        float pivot = exp(-length(uv - vec2(0.0, 0.28)) * 15.0);

        float chaos = sin(field * (1.8 + u_treble * 2.0) + u_time * (0.6 + u_mid)) * 0.5 + 0.5;
        vec3 chaosCol = mix(vec3(0.02, 0.01, 0.04), vec3(0.12, 0.3, 0.85), chaos);

        vec3 col = vec3(0.0);
        // Background ambience
        col += vec3(0.01, 0.008, 0.015) * exp(-length(uv) * 1.5);
        col += vec3(0.015, 0.02, 0.04) * exp(-abs(uv.y + 0.3) * 5.0) * (0.3 + u_rms * 0.5);

        // Main trail color
        col += colAccum * (0.5 + u_rms * 1.0);
        col += chaosCol * field * 0.2;

        // Beat energy burst
        col += vec3(1.0, 0.85, 0.6) * u_beat * smoothstep(0.3, 1.2, field);

        // Pivot
        col += vec3(0.8, 0.85, 0.9) * pivot * 0.3;

        col *= 0.85 + 0.35 * exp(-length(uv) * 1.5) + 0.2 * u_mid;
        col = pow(max(col, 0.0), vec3(0.88));
        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
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

  onBeat(strength) {
    this.beatPulse = Math.min(1, strength || 0);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['pendulum-chaos'] = PendulumChaosPreset;
})();
