(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SandstormPreset extends BasePreset {
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

        preset._time += 0.011 + preset.audio.bass * 0.02 + preset.audio.mid * 0.006;
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
          v += noise(p) * a;
          p = m * p;
          a *= 0.54;
        }
        return v;
      }

      float duneLayer(vec2 p, float t, float ridgeScale) {
        float ridge = abs(fbm(p * ridgeScale + vec2(t * 0.08, -t * 0.03)) - 0.5);
        ridge += abs(fbm(p * ridgeScale * 1.9 - vec2(t * 0.04, t * 0.06)) - 0.5) * 0.6;
        return ridge;
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

        float gust = pow(u_beat, 0.75);
        float windSpeed = 0.45 + u_bass * 1.9 + gust * 1.5;
        float directionShift = sin(t * (0.4 + u_mid * 2.3) + uv.y * 2.7) * (0.2 + u_mid * 1.1);
        float beatTurn = gust > 0.12 ? sign(sin(t * 0.7 + gust * 8.0)) : 0.0;
        float windAngle = 0.18 + directionShift + beatTurn * 0.75 * gust + sin(t * 0.11) * 0.15;
        vec2 windDir = normalize(vec2(cos(windAngle), sin(windAngle) * 0.42 + 0.1));
        vec2 crossDir = vec2(-windDir.y, windDir.x);

        float grainFreq = mix(24.0, 140.0, clamp(u_treble * 0.9 + gust * 0.35, 0.0, 1.0));
        float grainShape = mix(0.18, 0.9, u_treble);
        float visibility = mix(1.6, 0.18, clamp(u_rms * 0.95 + gust * 0.25, 0.0, 1.0));

        vec2 advectA = uv * vec2(1.9 + u_rms * 0.6, 1.35 + u_bass * 0.4);
        advectA += windDir * t * windSpeed;
        advectA += crossDir * sin(t * (0.6 + u_mid * 1.7) + uv.x * 3.1) * (0.09 + u_mid * 0.22);

        vec2 advectB = uv * (grainFreq * (0.45 + u_treble * 0.55));
        advectB += windDir * t * (2.4 + u_bass * 4.5 + gust * 3.0);
        advectB += crossDir * fbm(uv * 5.0 + vec2(t * 0.3, -t * 0.5)) * (1.0 + u_mid * 1.4);

        float dunes = duneLayer(advectA, t, 2.0 + u_bass * 1.6);
        float grainNoise = fbm(advectB);
        float grainBand = noise(advectB * (1.5 + u_treble * 1.8) + grainNoise * 3.0);
        float pebble = smoothstep(1.0 - grainShape * 0.38, 1.0, grainBand + grainNoise * 0.15);

        float wall = fbm(uv * vec2(5.0 + u_bass * 4.0, 2.4 + u_mid * 2.0) + windDir * t * (0.9 + u_bass * 1.4));
        wall += fbm(uv * vec2(12.0 + u_treble * 10.0, 4.0) - windDir.yx * t * (1.8 + gust * 2.5)) * 0.45;
        float sheet = smoothstep(0.35 - gust * 0.08, 0.95, wall + pebble * 0.6 + u_rms * 0.2);
        sheet = mix(sheet, smoothstep(0.18, 0.92, wall + pebble), u_beat * 0.35);

        float streaks = abs(sin(dot(uv, windDir * 55.0) + t * (16.0 + u_bass * 25.0)));
        streaks = pow(streaks, mix(6.0, 2.0, u_treble));
        streaks *= 0.15 + u_bass * 0.3 + gust * 0.35;

        float horizon = smoothstep(-0.5, 0.3 + u_rms * 0.25, uv.y + dunes * 0.35);
        float occlusion = clamp(sheet * 0.9 + pebble * 0.8 + streaks + gust * 0.2, 0.0, 1.4);
        occlusion *= mix(0.85, 1.35, 1.0 - visibility);

        vec3 duneCol = mix(vec3(0.18, 0.11, 0.05), vec3(0.72, 0.51, 0.24), horizon);
        duneCol += vec3(0.22, 0.14, 0.05) * dunes * (0.4 + u_bass * 0.45);

        vec3 stormCol = mix(vec3(0.36, 0.27, 0.15), vec3(0.92, 0.82, 0.6), grainNoise * 0.55 + u_rms * 0.3);
        stormCol += vec3(0.18, 0.13, 0.08) * u_bass;
        stormCol += vec3(0.16, 0.08, 0.03) * gust;
        stormCol += vec3(0.22, 0.18, 0.08) * u_beat * streaks;
        stormCol *= 0.8 + u_rms * 0.7;

        float burstFront = smoothstep(0.15, 0.95, fbm(uv * 3.3 + windDir * t * (3.0 + u_bass * 6.0) + gust * 2.0));
        float whiteout = gust * burstFront * (0.5 + u_rms * 0.8);
        vec3 col = mix(duneCol, stormCol, clamp(occlusion, 0.0, 1.0));
        col = mix(col, vec3(0.96, 0.88, 0.67), whiteout);
        col += vec3(0.12, 0.08, 0.03) * u_beat * (1.0 - visibility);

        float vignette = 1.0 - smoothstep(0.55, 1.35, length(uv * vec2(1.0, 0.8)));
        col *= vignette * visibility + 0.12;
        col += vec3(0.08, 0.05, 0.02) * u_mid * (0.4 + dunes);
        col = 1.0 - exp(-col * (1.15 + u_bass * 0.4 + u_rms * 0.8));

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
window.VJamFX.presets['sandstorm'] = SandstormPreset;
})();
