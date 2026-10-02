(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class MicrochipDiePreset extends BasePreset {
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

        preset._time += 0.013 + preset.audio.treble * 0.01 + preset.audio.mid * 0.006;
        preset.beatPulse *= 0.9;

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

      vec2 hash22(vec2 p) {
        float n = sin(dot(p, vec2(41.0, 289.0)));
        return fract(vec2(262144.0, 32768.0) * n);
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
          p = p * 2.0 + vec2(11.3, 7.1);
          a *= 0.52;
        }
        return v;
      }

      float lineBand(float x, float w) {
        return smoothstep(w, 0.0, abs(x));
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

        float zoom = mix(1.8, 4.5, 0.25 + u_mid * 0.75);
        zoom *= 1.0 + 0.18 * sin(t * 0.17 + u_mid * 4.0);
        zoom += u_mid * u_mid * 0.7;

        vec2 scanOffset = vec2(
          sin(t * (0.2 + u_bass * 0.35) + u_mid * 3.0),
          cos(t * (0.14 + u_mid * 0.2) + u_bass * 5.0)
        ) * (0.08 + 0.1 * u_mid);

        vec2 chipUv = (uv + scanOffset) * zoom;
        vec2 tileId = floor(chipUv);
        vec2 tileUv = fract(chipUv) - 0.5;

        float busPitch = mix(6.0, 14.0, u_treble);
        float clockWaveA = sin((chipUv.x + chipUv.y * 0.35) * busPitch + t * (5.0 + u_treble * 14.0));
        float clockWaveB = sin(chipUv.y * (10.0 + u_treble * 18.0) - t * (4.0 + u_treble * 10.0) + u_bass * 6.0);
        float clockPulse = smoothstep(0.25 - u_treble * 0.08, 0.95, 0.55 + 0.45 * clockWaveA * clockWaveB);

        float powerRail = 0.0;
        powerRail += lineBand(tileUv.x, 0.045 + u_bass * 0.06);
        powerRail += lineBand(tileUv.y, 0.05 + u_bass * 0.04);
        powerRail += lineBand(abs(tileUv.x) - 0.28, 0.028 + u_bass * 0.03);
        powerRail += lineBand(abs(tileUv.y) - 0.23, 0.024 + u_bass * 0.025);

        vec2 viaUv = fract(chipUv * (2.0 + floor(u_mid * 4.0))) - 0.5;
        float via = smoothstep(0.15, 0.0, length(viaUv) - (0.03 + 0.025 * u_bass + 0.015 * u_mid));

        float routing = fbm(chipUv * 0.7 + vec2(t * 0.2, -t * 0.13 + u_treble * 2.0));
        float blockMask = smoothstep(0.15, 0.75, fbm(tileId * 0.8 + u_beat * 7.0));
        float sramMask = smoothstep(0.1, 0.03, abs(abs(tileUv.x) - abs(tileUv.y)) - 0.08 - u_mid * 0.03);

        float hotspotBeat = smoothstep(0.42, 0.99, fbm(chipUv * 1.9 + vec2(u_beat * 12.0, t * 0.9)));
        hotspotBeat *= smoothstep(0.08, 0.7, u_beat);
        float hotspotBass = smoothstep(0.55, 0.92, fbm(chipUv * (1.3 + u_bass) - t * 0.6));
        float hotspot = max(hotspotBeat, hotspotBass * (0.35 + u_bass * 0.65));

        float metal = clamp(powerRail * (0.5 + u_bass * 1.3) + via * (0.5 + u_mid) + sramMask * (0.2 + u_treble), 0.0, 1.0);
        float circuitry = max(metal, blockMask * routing * (0.45 + u_mid * 0.7));
        circuitry += clockPulse * (0.12 + u_treble * 0.4) * powerRail;

        vec3 silicon = mix(vec3(0.03, 0.08, 0.09), vec3(0.05, 0.14, 0.12), routing);
        silicon += vec3(0.02, 0.015, 0.0) * u_rms;
        silicon += vec3(0.0, 0.03, 0.05) * u_mid;

        vec3 metalCol = mix(vec3(0.1, 0.45, 0.38), vec3(0.38, 0.95, 0.8), clockPulse);
        metalCol *= 0.55 + u_bass * 0.9 + u_rms * 0.4;
        metalCol += vec3(0.1, 0.15, 0.22) * u_treble;

        vec3 powerCol = mix(vec3(0.2, 0.08, 0.03), vec3(0.9, 0.35, 0.1), u_rms);
        powerCol += vec3(0.7, 0.25, 0.05) * hotspot * (0.5 + u_beat);
        powerCol += vec3(0.12, 0.05, 0.01) * u_bass;

        vec3 col = silicon;
        col = mix(col, metalCol, clamp(circuitry, 0.0, 1.0));
        col += powerCol * hotspot * (0.3 + u_rms * 1.3);
        col += metalCol * powerRail * clockPulse * (0.25 + u_treble * 0.7);

        float beatGrid = smoothstep(0.018, 0.0, abs(fract(chipUv.x * 0.5 + u_beat * 0.4) - 0.5) - (0.06 + u_beat * 0.12));
        beatGrid += smoothstep(0.018, 0.0, abs(fract(chipUv.y * 0.5 - u_beat * 0.3) - 0.5) - (0.05 + u_beat * 0.12));
        col += vec3(0.8, 0.5, 0.2) * beatGrid * u_beat * (0.4 + u_rms);

        float vignette = 1.0 - dot(uv, uv) * (0.75 - u_rms * 0.18);
        col *= max(0.0, vignette);
        col = pow(max(col, 0.0), vec3(0.92 - u_rms * 0.12));

        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
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
window.VJamFX.presets['microchip-die'] = MicrochipDiePreset;
})();
