(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CircuitSchematicPreset extends BasePreset {
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

        preset.beatPulse *= 0.89;
        preset._time += 0.011 + preset.audio.treble * 0.009 + preset.audio.mid * 0.004;

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

      float segment(vec2 p, vec2 a, vec2 b, float w) {
        vec2 pa = p - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
        return 1.0 - smoothstep(w, w + 0.01, length(pa - ba * h));
      }

      float resistor(vec2 p, float w) {
        float body = 0.0;
        body += segment(p, vec2(-0.34, 0.0), vec2(-0.22, 0.0), w);
        body += segment(p, vec2(0.22, 0.0), vec2(0.34, 0.0), w);
        vec2 prev = vec2(-0.22, 0.0);
        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          vec2 next = vec2(-0.18 + fi * 0.06, mod(fi, 2.0) < 0.5 ? -0.09 : 0.09);
          body += segment(p, prev, next, w);
          prev = next;
        }
        body += segment(p, prev, vec2(0.22, 0.0), w);
        return body;
      }

      float capacitor(vec2 p, float w) {
        float v = 0.0;
        v += segment(p, vec2(-0.32, 0.0), vec2(-0.08, 0.0), w);
        v += segment(p, vec2(0.08, 0.0), vec2(0.32, 0.0), w);
        v += segment(p, vec2(-0.05, -0.15), vec2(-0.05, 0.15), w);
        v += segment(p, vec2(0.05, -0.15), vec2(0.05, 0.15), w);
        return v;
      }

      float diode(vec2 p, float w) {
        float v = 0.0;
        v += segment(p, vec2(-0.34, 0.0), vec2(-0.16, 0.0), w);
        v += segment(p, vec2(0.16, 0.0), vec2(0.34, 0.0), w);
        v += segment(p, vec2(-0.16, -0.14), vec2(-0.16, 0.14), w);
        v += segment(p, vec2(-0.16, -0.14), vec2(0.08, 0.0), w);
        v += segment(p, vec2(-0.16, 0.14), vec2(0.08, 0.0), w);
        v += segment(p, vec2(0.12, -0.16), vec2(0.12, 0.16), w);
        return v;
      }

      mat2 rot(float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c);
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
        float beatMorph = smoothstep(0.05, 0.8, u_beat);
        float complexity = 4.0 + floor(u_mid * 5.0 + beatMorph * 2.0);
        vec2 gridUv = uv * (3.0 + u_mid * 3.0 + beatMorph * 1.5);
        vec2 cell = floor(gridUv);
        vec2 local = fract(gridUv) - 0.5;

        float orientationSeed = hash(cell + floor(u_time * 0.12 + u_mid * 5.0));
        float orientation = floor(orientationSeed * 4.0) * 1.5707963;
        local = rot(orientation) * local;

        float typeSeed = hash(cell * 1.37 + vec2(complexity, floor(u_time * 0.08) + beatMorph * 7.0));
        float wireWidth = 0.014 + u_bass * 0.04 + u_rms * 0.015;
        float symbol = 0.0;
        if (typeSeed < 0.33) {
          symbol = resistor(local, wireWidth);
        } else if (typeSeed < 0.66) {
          symbol = capacitor(local, wireWidth);
        } else {
          symbol = diode(local, wireWidth);
        }

        float busA = segment(local, vec2(-0.5, 0.0), vec2(0.5, 0.0), wireWidth * (1.1 + u_bass));
        float busB = segment(local, vec2(0.0, -0.5), vec2(0.0, 0.5), wireWidth * (0.9 + u_mid * 0.6));
        float gridLines = max(
          1.0 - smoothstep(0.0, 0.01, abs(fract(gridUv.x) - 0.5) - 0.47),
          1.0 - smoothstep(0.0, 0.01, abs(fract(gridUv.y) - 0.5) - 0.47)
        );

        float clock = sin((gridUv.x + gridUv.y) * (4.0 + u_treble * 18.0) + u_time * (4.0 + u_treble * 32.0));
        float current = smoothstep(0.1, 0.95, sin(gridUv.x * 2.5 + u_time * (2.0 + u_treble * 10.0) + orientationSeed * 6.28318) * 0.5 + 0.5);
        current *= 0.35 + u_bass * 1.1 + u_rms * 0.35;

        float heat = symbol * (u_rms * 1.1 + u_bass * 0.3);
        float sparkField = hash(cell + floor(u_time * (1.0 + u_treble * 4.0)));
        float spark = smoothstep(0.94 - u_beat * 0.28, 1.0, sparkField) * beatMorph;
        spark *= exp(-length(local) * (10.0 - u_bass * 4.0));

        float shortBurst = sin(length(local) * (30.0 + u_bass * 24.0) - u_time * (18.0 + u_treble * 45.0));
        shortBurst = max(shortBurst, 0.0) * spark * (1.0 + u_beat * 2.5);

        vec3 bg = vec3(0.0, 0.025, 0.012) + vec3(0.01, 0.04, 0.02) * gridLines * 0.6;
        vec3 traceCol = mix(vec3(0.2, 1.0, 0.62), vec3(1.0, 0.55, 0.14), heat);
        vec3 pulseCol = mix(vec3(0.12, 0.8, 1.0), vec3(0.95, 1.0, 0.7), current + 0.2 * clock);
        vec3 sparkCol = mix(vec3(1.0, 0.4, 0.05), vec3(1.0, 0.95, 0.7), shortBurst);

        vec3 col = bg;
        col += traceCol * max(symbol, max(busA, busB)) * (0.5 + current);
        col += pulseCol * (busA + busB) * current * (0.6 + u_treble * 0.8);
        col += vec3(0.4, 0.15, 0.05) * heat;
        col += sparkCol * (spark + shortBurst);
        col += vec3(0.25, 0.9, 0.5) * u_mid * gridLines * 0.12;
        col *= 1.0 - smoothstep(1.15, 1.45, length(uv));
        col = pow(max(col, 0.0), vec3(0.95));

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
window.VJamFX.presets['circuit-schematic'] = CircuitSchematicPreset;
})();
