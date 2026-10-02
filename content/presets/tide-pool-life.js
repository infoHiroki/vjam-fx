(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class TidePoolLifePreset extends BasePreset {
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

        preset._time += 0.01 + preset.audio.mid * 0.009 + preset.audio.bass * 0.006;
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

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 m = mat2(1.7, 1.2, -1.2, 1.7);
        for (int i = 0; i < 6; i++) {
          v += a * noise(p);
          p = m * p;
          a *= 0.55;
        }
        return v;
      }

      float kelp(vec2 p, float t, float offset) {
        p.x += sin(p.y * (4.0 + u_bass * 5.0) + t * (0.7 + u_mid * 1.4) + offset) * (0.08 + u_bass * 0.2);
        float spine = abs(p.x);
        float blade = exp(-spine * (26.0 - u_bass * 6.0)) * smoothstep(-0.7, 0.35, p.y) * (1.0 - smoothstep(0.35, 1.2, p.y));
        blade *= 0.5 + 0.5 * sin(p.y * 18.0 + offset * 3.0 + t * (1.1 + u_mid));
        return max(0.0, blade);
      }

      float creature(vec2 p, float t, float seed) {
        vec2 q = p;
        q.x += sin(t * (2.0 + u_treble * 6.0) + seed * 10.0 + p.y * 4.0) * (0.04 + u_treble * 0.08);
        q.y += cos(t * (1.5 + u_treble * 5.0) + seed * 7.0 + p.x * 3.0) * (0.03 + u_treble * 0.06);
        float body = exp(-length(q * vec2(1.8, 1.0)) * (8.0 + seed * 5.0));
        float tail = exp(-length((q + vec2(0.06 + seed * 0.07, 0.0)) * vec2(5.0, 2.2)) * 6.0);
        return body + tail * 0.5;
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
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
        float audioHue = u_time * 0.1 + u_treble * 0.5;
        vec2 audioDrift = vec2(fract(u_time * 0.1) * 3.0, fract(u_time * 0.08) * 3.0);
        uv += (audioDrift - 1.5) * 0.12;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float t = u_time;
        float surfWarp = fbm(uv * vec2(3.2 + u_mid * 2.2, 2.6) - vec2(t * (0.18 + u_mid * 0.2), -t * 0.05));
        float wave = sin(uv.x * (8.0 + u_bass * 10.0) + t * (2.0 + u_bass * 4.2));
        wave += sin(uv.x * 14.0 - t * (1.2 + u_bass * 2.1) + uv.y * 3.0) * 0.5;
        float splash = exp(-abs(uv.y + 0.1 + surfWarp * 0.22) * (10.0 - u_bass * 3.0)) * u_beat;

        vec2 refractOffset = vec2(
          sin(uv.y * (12.0 + u_mid * 18.0) + t * (0.8 + u_mid * 2.4) + surfWarp * 6.0),
          cos(uv.x * (10.0 + u_mid * 15.0) - t * (0.7 + u_mid * 1.8) + surfWarp * 5.0)
        ) * (0.015 + u_mid * 0.05 + u_beat * 0.025);

        vec2 sceneUv = uv + refractOffset;
        float depth = smoothstep(-0.55, 0.8, sceneUv.y + fbm(sceneUv * 2.0) * 0.1);

        vec3 sand = mix(vec3(0.34, 0.23, 0.12), vec3(0.55, 0.42, 0.22), depth);
        sand += vec3(0.09, 0.07, 0.03) * fbm(sceneUv * 12.0 + surfWarp * 3.0);

        float kelpA = kelp(sceneUv + vec2(0.35, 0.55), t, 0.2);
        float kelpB = kelp(sceneUv + vec2(-0.12, 0.62), t, 1.4);
        float kelpC = kelp(sceneUv + vec2(-0.42, 0.57), t, 2.6);
        float fronds = kelpA + kelpB * 0.8 + kelpC * 0.7;

        vec2 creatureUv1 = sceneUv - vec2(0.18 + sin(t * (0.5 + u_bass) + u_beat) * 0.08, -0.05);
        vec2 creatureUv2 = sceneUv - vec2(-0.28 + cos(t * (0.6 + u_treble * 2.0)) * 0.06, 0.12);
        float critterA = creature(creatureUv1, t, 0.23);
        float critterB = creature(creatureUv2, t, 0.71);
        float critters = critterA * (0.7 + u_treble) + critterB * (0.5 + u_treble * 0.9);

        float caustics = fbm((sceneUv + refractOffset * 5.0) * (8.0 + u_mid * 5.0) + vec2(t * (0.6 + u_bass), -t * 0.24));
        caustics += wave * 0.18 + splash * 0.4;
        caustics = smoothstep(0.45, 0.88, caustics);

        vec3 water = mix(vec3(0.02, 0.14, 0.18), vec3(0.04, 0.28, 0.31), 0.5 + 0.5 * wave);
        water += vec3(0.02, 0.08, 0.12) * u_bass;

        vec3 kelpCol = mix(vec3(0.05, 0.16, 0.08), vec3(0.18, 0.4, 0.16), fronds);
        kelpCol += vec3(0.08, 0.12, 0.06) * u_mid * fronds;

        vec3 critterCol = mix(vec3(0.92, 0.44, 0.18), vec3(0.28, 0.82, 0.88), 0.5 + 0.5 * sin(t * (0.8 + u_treble * 4.0)));
        critterCol *= 0.45 + u_treble * 0.9 + u_rms * 0.3;

        vec3 col = mix(sand, water, 0.65 + u_mid * 0.12);
        col = mix(col, kelpCol, clamp(fronds, 0.0, 1.0));
        col += critterCol * critters;
        col += vec3(0.7, 0.85, 0.52) * caustics * (0.18 + u_rms * 0.65);
        col += vec3(1.0, 0.95, 0.7) * splash * (0.25 + u_rms * 0.4);

        float sunBeams = exp(-abs(sceneUv.x + sin(t * 0.13) * 0.2) * (5.0 - u_rms * 2.0));
        sunBeams *= smoothstep(-0.65, 0.2, -sceneUv.y);
        col += vec3(1.0, 0.88, 0.62) * sunBeams * (0.08 + u_rms * 0.45 + u_beat * 0.12);

        float vignette = 1.0 - smoothstep(0.72, 1.4, length(uv * vec2(0.96, 1.08)));
        col *= vignette + 0.16;
        col = 1.0 - exp(-col * (1.1 + u_rms * 0.7 + u_bass * 0.2));

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
window.VJamFX.presets['tide-pool-life'] = TidePoolLifePreset;
})();
