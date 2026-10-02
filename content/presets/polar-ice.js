(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PolarIcePreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
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
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }
        preset._time += 0.012 + preset.audio.mid * 0.02 + preset.audio.bass * 0.006;
        preset.beatPulse *= 0.9;
        p.background(0);
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
        } catch (_) {} finally {
          p.resetShader();
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
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
        for (int i = 0; i < 5; i++) {
          v += noise(p) * a;
          p = p * 2.03 + vec2(1.7, -2.4);
          a *= 0.52;
        }
        return v;
      }

      vec2 voronoi(vec2 p) {
        vec2 g = floor(p);
        vec2 f = fract(p);
        float md = 8.0;
        float sd = 8.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 o = vec2(float(x), float(y));
            vec2 cell = g + o;
            vec2 jitter = vec2(hash(cell), hash(cell + 91.7));
            jitter = 0.5 + 0.45 * sin(u_time * (0.15 + u_mid * 0.35) + 6.2831 * jitter);
            float d = length(o + jitter - f);
            if (d < md) {
              sd = md;
              md = d;
            } else if (d < sd) {
              sd = d;
            }
          }
        }
        return vec2(md, sd);
      }

      float crystalSparkle(vec2 uv, float beatCollapse) {
        vec2 g = uv * (70.0 + u_treble * 80.0 + u_beat * 25.0);
        float n = hash(floor(g) + floor(u_time * (4.0 + u_treble * 10.0)));
        float twinkle = sin(u_time * (14.0 + u_treble * 24.0) + n * 22.0);
        float gate = step(0.982 - u_treble * 0.05 - u_beat * 0.03, n);
        return gate * (0.4 + 0.6 * twinkle * twinkle) * (1.0 + beatCollapse * 0.8);
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
        vec2 audioDrift = vec2(fract(u_time * 0.1) * 3.0, fract(u_time * 0.08) * 3.0);
        uv += (audioDrift - 1.5) * 0.12;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float radius = length(uv);
        float beatCollapse = smoothstep(0.08, 0.95, u_beat);

        vec2 drift = vec2(
          sin(u_time * (0.45 + u_mid * 0.8) + uv.y * 2.2),
          cos(u_time * (0.28 + u_mid * 0.55) - uv.x * 2.6)
        );
        vec2 iceUv = uv * (2.6 + u_mid * 0.9 - u_beat * 0.5);
        iceUv += drift * (0.12 + u_mid * 0.26 + u_rms * 0.04);
        iceUv += uv * beatCollapse * 0.3;

        vec2 cells = voronoi(iceUv);
        float edge = cells.y - cells.x;
        float crackWidth = 0.028 + u_bass * 0.15 + u_beat * 0.08;
        float cracks = 1.0 - smoothstep(0.0, crackWidth, edge);

        float splitNoise = fbm(iceUv * 2.2 + vec2(0.0, u_time * 0.06));
        float branch = 1.0 - smoothstep(0.12, 0.38 + u_bass * 0.18, abs(edge - splitNoise * 0.18));
        cracks = max(cracks, branch * (0.35 + u_bass * 0.65));

        float oceanMask = smoothstep(0.2, 0.85 + u_bass * 0.2 + beatCollapse * 0.25, cracks + beatCollapse * 0.15);
        float currentA = fbm(uv * (3.8 + u_mid * 4.0) + vec2(u_time * (0.25 + u_mid), -u_time * 0.18));
        float currentB = fbm(uv.yx * (5.4 + u_mid * 3.6) - vec2(u_time * 0.12, u_time * (0.4 + u_mid * 0.8)));
        float current = currentA * 0.6 + currentB * 0.4;

        vec3 coldDeep = vec3(0.02, 0.12, 0.22);
        vec3 coldLight = vec3(0.75, 0.9, 0.98);
        vec3 tempTint = mix(vec3(0.12, 0.3, 0.58), vec3(0.96, 0.98, 1.0), clamp(u_rms * 1.15, 0.0, 1.0));
        vec3 iceBase = mix(vec3(0.08, 0.2, 0.34), tempTint, 0.45 + u_rms * 0.45);
        iceBase += (fbm(uv * 12.0 - drift * 2.0) - 0.5) * 0.12;
        iceBase += vec3(0.05, 0.08, 0.1) * (1.0 - radius);

        vec3 ocean = mix(coldDeep, coldLight, current * 0.55 + u_mid * 0.15);
        ocean += vec3(0.0, 0.2, 0.25) * u_mid;
        ocean += vec3(0.08, 0.15, 0.18) * beatCollapse;

        float sparkle = crystalSparkle(uv + drift * 0.3, beatCollapse);
        vec3 crackGlow = mix(vec3(0.25, 0.5, 0.78), vec3(0.95, 0.98, 1.0), u_rms * 0.8 + u_treble * 0.2);
        crackGlow += sparkle * vec3(0.8, 0.95, 1.0) * (0.35 + u_treble * 1.8);

        float berg = smoothstep(0.72, 0.18, abs(uv.y + 0.18 + sin(uv.x * 4.0 + u_time * 0.5) * (0.05 + u_beat * 0.08)));
        berg *= smoothstep(0.9, 0.15, radius);
        berg *= beatCollapse;

        vec3 col = mix(iceBase, ocean, oceanMask * 0.92);
        col = mix(col, crackGlow, cracks * (0.5 + u_bass * 0.55 + u_beat * 0.2));
        col += sparkle * vec3(0.8, 0.95, 1.0) * (0.25 + u_treble * 0.9);
        col += vec3(0.45, 0.6, 0.72) * berg;
        col += vec3(0.1, 0.14, 0.18) * u_rms;

        float collapseRing = exp(-22.0 * abs(radius - (0.26 + beatCollapse * 0.28)));
        col += vec3(0.7, 0.88, 1.0) * collapseRing * u_beat * (0.4 + cracks);

        float vignette = 1.0 - smoothstep(0.45, 1.2, radius);
        col *= 0.6 + vignette * 0.5;
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
    this.beatPulse = Math.min(1, strength);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['polar-ice'] = PolarIcePreset;
})();
