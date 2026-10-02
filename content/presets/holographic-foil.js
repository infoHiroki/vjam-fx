(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class HolographicFoilPreset extends BasePreset {
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
        preset._time += 0.01 + preset.audio.treble * 0.012 + preset.audio.mid * 0.003;

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
          p *= 2.07;
          a *= 0.5;
        }
        return v;
      }

      vec3 spectrum(float phase) {
        return 0.5 + 0.5 * cos(6.28318 * (phase + vec3(0.0, 0.25, 0.5)));
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
        float beatMorph = smoothstep(0.04, 0.85, u_beat);

        vec2 foldUv = uv;
        foldUv.x += sin(uv.y * (5.0 + beatMorph * 9.0) + u_time * (0.6 + u_mid * 1.4)) * beatMorph * 0.22;
        foldUv.y += cos(uv.x * (4.0 + beatMorph * 7.0) - u_time * (0.5 + u_mid * 1.2)) * beatMorph * 0.18;

        float emboss = fbm(foldUv * (7.0 + u_bass * 8.0) + vec2(0.0, u_time * 0.12));
        emboss += fbm(foldUv * (16.0 + u_bass * 18.0) - vec2(u_time * 0.24, 0.0)) * 0.35;
        emboss += sin((foldUv.x + foldUv.y) * (22.0 + u_bass * 26.0) + u_time * 0.8) * (0.05 + u_bass * 0.12);

        float angle = u_mid * 1.8 + sin(u_time * 0.35) * 0.3 + foldUv.x * 0.6;
        vec3 viewDir = normalize(vec3(sin(angle), cos(angle * 0.7), 1.2));

        float eps = 0.003;
        float hx = fbm((foldUv + vec2(eps, 0.0)) * (8.0 + u_bass * 8.0)) - fbm((foldUv - vec2(eps, 0.0)) * (8.0 + u_bass * 8.0));
        float hy = fbm((foldUv + vec2(0.0, eps)) * (8.0 + u_bass * 8.0)) - fbm((foldUv - vec2(0.0, eps)) * (8.0 + u_bass * 8.0));
        vec3 normal = normalize(vec3(-hx * (3.0 + u_bass * 6.0), -hy * (3.0 + u_bass * 6.0), 1.0));

        vec3 lightDir = normalize(vec3(-0.4 + u_mid * 0.6, -0.2, 0.95));
        vec3 halfDir = normalize(viewDir + lightDir);
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);
        float spec = pow(max(dot(normal, halfDir), 0.0), 50.0 + u_rms * 40.0) * (0.3 + u_rms * 1.4);
        float sheen = max(dot(reflect(-lightDir, normal), viewDir), 0.0);

        float phase = emboss * 0.7 + dot(normal.xy, viewDir.xy) * 0.8 + u_time * (0.08 + u_treble * 0.28);
        vec3 holo = spectrum(phase + foldUv.x * 0.2 - foldUv.y * 0.15);
        holo *= 0.5 + u_treble * 1.1 + fresnel * 0.9;

        float groove = sin((foldUv.x - foldUv.y) * (32.0 + u_treble * 40.0) + u_time * (1.6 + u_treble * 5.0));
        float microFacet = smoothstep(0.45, 1.0, fbm(foldUv * (30.0 + u_treble * 26.0) + u_time * 0.25));

        vec3 foilBase = vec3(0.07, 0.08, 0.1) + emboss * vec3(0.1, 0.11, 0.12);
        vec3 env = vec3(0.35, 0.34, 0.32) * (0.2 + u_rms * 1.2);
        vec3 sparkle = vec3(1.0, 0.98, 0.9) * spec;
        sparkle += holo * max(groove, 0.0) * (0.15 + u_treble * 0.45);
        sparkle += holo * microFacet * fresnel * (0.2 + u_rms * 0.3);

        vec3 foldLight = vec3(0.85, 0.9, 1.0) * beatMorph * exp(-abs(foldUv.x * foldUv.y) * (6.0 + u_beat * 8.0));

        vec3 col = foilBase * env + holo + sparkle + foldLight;
        col += vec3(sheen) * (0.08 + u_rms * 0.2);
        col += vec3(0.12, 0.16, 0.22) * u_mid * exp(-length(uv) * 2.8);
        col *= 1.0 - smoothstep(1.0, 1.42, length(uv));
        col = pow(max(col, 0.0), vec3(0.94));

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
window.VJamFX.presets['holographic-foil'] = HolographicFoilPreset;
})();
