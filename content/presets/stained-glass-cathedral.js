(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class StainedGlassCathedralPreset extends BasePreset {
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

        preset.beatPulse *= 0.9;
        preset._time += 0.01 + preset.audio.mid * 0.01 + preset.audio.rms * 0.004;

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
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += noise(p) * a;
          p = p * 2.02 + 3.1;
          a *= 0.5;
        }
        return v;
      }

      float arch(vec2 p, vec2 scale) {
        vec2 q = abs(p);
        float body = max(q.x / scale.x, q.y / scale.y);
        float crown = length(vec2(q.x / scale.x, max(q.y - scale.y, 0.0) / (scale.y * 0.62)));
        return min(body, crown);
      }

      float leadMask(vec2 p) {
        vec2 g = vec2(0.34 + u_mid * 0.08, 0.24 + u_rms * 0.03);
        vec2 q = p;
        q.x += sin(q.y * 5.0 + u_time * (0.35 + u_mid * 0.45)) * 0.04;
        q.y += sin(q.x * 7.0 - u_time * (0.22 + u_mid * 0.3)) * 0.03;
        vec2 cell = abs(fract((q + 3.0) / g) - 0.5) * g;
        float mullion = min(cell.x, cell.y);
        float rose = abs(length(p - vec2(0.0, 0.12)) - (0.18 + u_beat * 0.05));
        float tracery = min(mullion, rose * 0.7);
        return 1.0 - smoothstep(0.008, 0.02 + u_rms * 0.01, tracery);
      }

      vec3 glassColor(vec2 p) {
        float bassWave = sin(p.y * 10.0 - u_time * (1.4 + u_bass * 2.6));
        float trebleWave = cos(p.x * 14.0 + u_time * (1.8 + u_treble * 4.0));
        float midWave = sin((p.x + p.y) * 9.0 + u_mid * 5.5 + u_time * (0.8 + u_mid * 1.5));
        float hue = fbm(p * (3.0 + u_treble * 2.0) + vec2(bassWave, trebleWave) * 0.3);
        hue += 0.12 * midWave + 0.08 * bassWave + 0.15 * u_beat;
        vec3 base = 0.5 + 0.5 * cos(6.28318 * (hue + vec3(0.0, 0.27, 0.58)));
        float sat = 0.55 + u_treble * 0.75 + u_beat * 0.25;
        base = mix(vec3(dot(base, vec3(0.3333))), base, sat);
        base *= 0.55 + 0.35 * bassWave + 0.25 * u_rms + 0.2 * midWave;
        return max(base, 0.0);
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
        vec2 p = uv + audioDrift;
        p.y += 0.2;

        float archShape = 1.0 - smoothstep(1.0, 1.03, arch(p, vec2(0.56, 0.74 + u_bass * 0.08 + u_beat * 0.1)));
        float rose = 1.0 - smoothstep(0.12, 0.14 + u_rms * 0.04, abs(length(p - vec2(0.0, 0.12)) - (0.2 + u_mid * 0.05)));
        float column = 1.0 - smoothstep(0.08, 0.1, abs(abs(p.x) - (0.28 + u_mid * 0.04)));
        float windowMask = max(archShape, rose * 0.9);
        windowMask *= 1.0 - 0.55 * column;

        vec3 glass = glassColor(p * (1.1 + u_mid * 0.2));
        float lead = leadMask(p * (1.0 + u_beat * 0.05));
        glass *= 0.8 + 0.45 * u_rms + 0.35 * u_bass;
        glass += vec3(0.9, 0.8, 0.6) * rose * (0.2 + 0.5 * u_treble);

        float sunAngle = -0.65 + sin(u_time * (0.22 + u_mid * 0.45)) * (0.55 + u_mid * 0.18) + u_beat * 0.1;
        vec2 dir = normalize(vec2(cos(sunAngle), -abs(sin(sunAngle)) - 0.25));
        float sun = exp(-abs(dot(uv - vec2(-0.35, 0.48), vec2(-dir.y, dir.x))) * (24.0 - u_bass * 8.0));
        sun *= exp(dot(uv, dir) * (2.2 + u_bass * 1.8));
        sun *= 0.3 + u_bass * 1.25 + u_beat * 1.8;

        vec2 floorUv = vec2(uv.x + dir.x * (0.35 - uv.y), max(-uv.y - 0.12, 0.0));
        float floorMask = smoothstep(-0.04, 0.18, -uv.y);
        vec3 caustic = glassColor(floorUv * (1.7 + u_treble * 1.2) + vec2(0.0, u_time * 0.08));
        caustic *= sun * floorMask * (0.35 + u_rms * 0.9);
        caustic *= 1.0 + 0.4 * sin(floorUv.x * 18.0 + u_time * 2.2 + u_mid * 4.0);

        float shadow = fbm(vec2(floorUv.x * 2.6, floorUv.y * 5.0 - u_time * 0.12));
        shadow = mix(0.45, 1.0, shadow);
        shadow *= 1.0 - 0.45 * u_bass * smoothstep(0.0, 0.8, floorUv.y);

        vec3 stone = vec3(0.028, 0.024, 0.03);
        stone += vec3(0.06, 0.055, 0.07) * fbm(uv * 6.0 + vec2(0.0, u_time * 0.03));
        stone *= 0.7 + 0.2 * shadow + 0.15 * u_rms;

        vec3 beam = vec3(1.0, 0.92, 0.78) * sun * (0.15 + u_bass * 0.35 + u_beat * 0.65);
        beam *= exp(-max(uv.y - 0.1, 0.0) * (5.0 - u_rms * 1.5));

        vec3 col = stone;
        col += caustic * shadow;
        col += beam;
        col = mix(col, glass * (0.7 + u_rms * 0.45 + u_treble * 0.3), windowMask);
        col = mix(col, vec3(0.03), lead * windowMask);
        col += vec3(0.9, 0.85, 0.72) * u_beat * rose * 0.3;

        float vignette = smoothstep(1.25, 0.2, length(uv * vec2(0.85, 1.15)));
        col *= vignette;
        col = pow(max(col, 0.0), vec3(0.9));
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
window.VJamFX.presets['stained-glass-cathedral'] = StainedGlassCathedralPreset;
})();
