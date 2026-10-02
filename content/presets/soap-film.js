(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SoapFilmPreset extends BasePreset {
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
        p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL);
        p.pixelDensity(1);
      };

      p.draw = () => {
        if (!preset._shader) {
          preset._shader = preset._initShader(p);
          if (!preset._shader) return;
        }

        preset._time += 0.012 + preset.audio.treble * 0.015 + preset.audio.bass * 0.005;
        preset.beatPulse *= 0.88;

        try {
          p.background(0);
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

      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = p * 2.03 + vec2(7.0, 17.0);
          a *= 0.53;
        }
        return v;
      }

      vec3 spectral(float x) {
        vec3 phase = vec3(0.0, 0.33, 0.67);
        return 0.45 + 0.55 * cos(6.28318 * (x + phase));
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
        float t = u_time;

        float bubbleRadius = 0.88 + u_mid * 0.12 + u_beat * 0.08;
        float radial = length(uv);
        vec2 warp = uv;
        warp += uv * (fbm(uv * 3.0 + t * 0.2) - 0.5) * (0.12 + u_mid * 0.22);
        warp += vec2(
          sin(t * 0.6 + uv.y * 5.0),
          cos(t * 0.45 + uv.x * 4.0)
        ) * (0.03 + u_mid * 0.07);

        float thickness = 0.0;
        thickness += fbm(warp * (2.5 + u_bass * 3.0) + vec2(0.0, t * (0.25 + u_bass * 0.8)));
        thickness += 0.55 * fbm(warp.yx * 5.0 - vec2(t * 0.22, 0.0));
        thickness += 0.25 * sin(warp.x * 11.0 + t * (1.8 + u_treble * 9.0));
        thickness += 0.25 * cos(warp.y * 9.0 - t * (1.2 + u_treble * 8.0));
        thickness += radial * (0.25 + u_bass * 0.45);
        thickness += u_bass * 0.35;

        float interference = thickness * (1.2 + u_rms * 2.2);
        interference += u_treble * 0.8 * sin(thickness * 6.0 + t * (6.0 + u_treble * 14.0));
        interference += u_rms * 0.55 * cos(radial * 14.0 - t * 1.7);

        float filmBreak = smoothstep(0.08, 0.72, u_beat);
        float crackNoise = fbm(uv * 8.0 + vec2(t * 0.8, -t * 0.3) + u_beat * 4.0);
        float shards = smoothstep(0.56, 0.8, crackNoise + sin(atan(uv.y, uv.x) * (8.0 + u_beat * 18.0)) * 0.18);
        float reform = smoothstep(0.95, 0.2, u_beat);

        float lightAngle = t * 0.18 + u_rms * 2.5 + u_mid * 0.7;
        vec3 lightDir = normalize(vec3(cos(lightAngle), sin(lightAngle * 0.8), 1.3 + u_rms * 1.2));
        // Fake normal via analytic derivatives of main thickness terms
        float dx = cos(warp.x * 11.0 + t * (1.8 + u_treble * 9.0)) * 11.0 * 0.25;
        float dy = -sin(warp.y * 9.0 - t * (1.2 + u_treble * 8.0)) * 9.0 * 0.25;
        vec3 normal = normalize(vec3(
          dx * 0.02 * (1.0 + u_mid * 2.0),
          dy * 0.02 * (1.0 + u_mid * 2.0),
          1.0
        ));

        float fresnel = pow(1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 1.6 - u_rms * 0.5);
        float specular = pow(max(dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0)), 0.0), 18.0 + u_treble * 42.0);
        float facing = max(dot(normal, lightDir), 0.0);

        vec3 iridescence = spectral(interference * 0.35 + u_treble * 0.2 + u_rms * 0.12);
        iridescence += spectral(interference * 0.62 + radial * 0.9 + u_bass * 0.1) * 0.5;
        iridescence *= 0.4 + facing * (0.7 + u_rms * 0.5);

        vec3 base = mix(vec3(0.02, 0.03, 0.05), vec3(0.08, 0.1, 0.14), fresnel);
        base += iridescence;
        base += vec3(1.0, 0.97, 0.92) * specular * (0.4 + u_treble * 0.6 + u_rms * 0.4);
        base += vec3(0.2, 0.25, 0.3) * fresnel * (0.4 + u_rms);

        float membrane = smoothstep(bubbleRadius, bubbleRadius - 0.06 - u_mid * 0.03, radial);
        float rim = smoothstep(bubbleRadius + 0.02, bubbleRadius - 0.1, radial);
        vec3 col = base * membrane;
        col += vec3(0.7, 0.8, 0.95) * pow(rim, 3.0) * (0.2 + u_rms * 0.8);

        float burstMask = mix(1.0, 1.0 - shards, filmBreak);
        burstMask = mix(burstMask, membrane, reform);
        col *= burstMask;

        float cavity = smoothstep(0.35, 0.85, filmBreak) * shards;
        col += vec3(1.0, 0.92, 0.85) * cavity * u_beat * (0.5 + u_treble * 0.5);

        float backgroundSheen = fbm(uv * 2.2 - vec2(t * 0.06, -t * 0.04));
        col += vec3(0.02, 0.03, 0.05) * backgroundSheen * u_rms;

        gl_FragColor = vec4(audioReactiveFinalize(max(col, 0.0), uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }
    `;

    try {
      return p.createShader(vert, frag);
    } catch (_) {
      return null;
    }
  }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
  }

  onBeat(strength) {
    this.beatPulse = Math.min(1, strength);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['soap-film'] = SoapFilmPreset;
})();
