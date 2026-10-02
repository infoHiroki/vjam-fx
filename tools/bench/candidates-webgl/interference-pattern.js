(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class InterferencePatternPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this.autoBeat = 0;
    this._time = 0;
    this._shader = null;
    this._sources = [
      { x: 0.34, y: 0.48 },
      { x: 0.66, y: 0.52 },
    ];
    this._targetSources = [
      { x: 0.34, y: 0.48 },
      { x: 0.66, y: 0.52 },
    ];
    this._jumpMix = 0;
  }

  setup(container) {
    this.destroy();
    this.beatPulse = 0;
    this.autoBeat = 0;
    this._time = 0;
    this._shader = null;
    this._jumpMix = 0;
    this._sources[0].x = 0.34;
    this._sources[0].y = 0.48;
    this._sources[1].x = 0.66;
    this._sources[1].y = 0.52;
    this._targetSources[0].x = 0.34;
    this._targetSources[0].y = 0.48;
    this._targetSources[1].x = 0.66;
    this._targetSources[1].y = 0.52;
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

        preset.autoBeat++;
        preset.beatPulse *= 0.92;
        preset._jumpMix *= 0.88;
        preset._time += 0.012 + preset.audio.mid * 0.03 + preset.audio.rms * 0.012;

        if (preset.autoBeat > 90) {
          preset._jumpSources(0.5);
        }

        preset._updateSources();

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          preset._shader.setUniform('u_jump', preset._jumpMix);
          preset._shader.setUniform('u_sourceA', [preset._sources[0].x, preset._sources[0].y]);
          preset._shader.setUniform('u_sourceB', [preset._sources[1].x, preset._sources[1].y]);
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

  _jumpSources(strength) {
    this.autoBeat = 0;
    this.beatPulse = Math.max(this.beatPulse, Math.min(1, strength));
    this._jumpMix = 1;
    const spread = 0.14 + this.audio.bass * 0.18 + strength * 0.08;
    const centerY = 0.5 + (Math.random() - 0.5) * 0.2;
    this._targetSources[0].x = 0.5 - spread;
    this._targetSources[0].y = centerY + (Math.random() - 0.5) * 0.28;
    this._targetSources[1].x = 0.5 + spread;
    this._targetSources[1].y = centerY + (Math.random() - 0.5) * 0.28;
  }

  _updateSources() {
    const chase = 0.08 + this.audio.mid * 0.18 + this.audio.rms * 0.08;
    for (let i = 0; i < 2; i++) {
      const s = this._sources[i];
      const t = this._targetSources[i];
      s.x += (t.x - s.x) * chase;
      s.y += (t.y - s.y) * chase;
    }
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
      uniform float u_jump;
      uniform vec2 u_sourceA;
      uniform vec2 u_sourceB;

      float wave(vec2 uv, vec2 src, float wavelength, float phase, float flow) {
        float d = distance(uv, src);
        return sin(d * wavelength - phase + flow);
      }

      vec3 spectrum(float t) {
        return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.2, 0.45)));
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 centered = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

        float flow = u_time * (1.8 + u_mid * 3.0);
        vec2 drift = vec2(
          sin(flow * 0.63 + centered.y * 2.4),
          cos(flow * 0.48 - centered.x * 2.1)
        ) * (0.012 + u_rms * 0.035);

        vec2 a = u_sourceA + drift;
        vec2 b = u_sourceB - drift;
        float wavelength = 42.0 + u_treble * 180.0;
        float phaseGap = u_bass * 10.0 + u_beat * 8.0;
        float crestA = wave(uv, a, wavelength, u_time * (4.0 + u_mid * 2.2), flow * 0.4);
        float crestB = wave(uv, b, wavelength, u_time * (4.0 + u_mid * 2.2) + phaseGap, -flow * 0.36);
        float field = crestA + crestB;

        float stripes = 0.5 + 0.5 * sin(field * (5.5 + u_bass * 5.5) + u_jump * 4.0);
        float caustic = 0.5 + 0.5 * cos(field * (9.0 + u_treble * 8.0) - u_time * 3.5);
        float envelope = exp(-length(centered) * (1.6 - u_bass * 0.4));
        float bloom = smoothstep(0.58, 1.0, stripes) * (0.35 + u_rms * 0.9 + u_beat * 0.7);

        float huePhase = stripes * 0.65 + caustic * 0.35 + centered.x * 0.12 - centered.y * 0.08 + u_time * 0.05;
        vec3 rainbow = spectrum(huePhase);
        vec3 base = vec3(0.0, 0.0, 0.02);
        vec3 col = base;
        col += rainbow * stripes * envelope;
        col += spectrum(huePhase + 0.18) * caustic * 0.3;
        col += vec3(1.0) * bloom;

        float sourceGlowA = exp(-distance(uv, a) * (8.0 + u_beat * 9.0));
        float sourceGlowB = exp(-distance(uv, b) * (8.0 + u_beat * 9.0));
        col += vec3(0.8, 0.95, 1.0) * (sourceGlowA + sourceGlowB) * (0.18 + u_beat * 0.25);

        float vignette = smoothstep(1.1, 0.15, length(centered * vec2(1.0, 1.08)));
        col *= vignette;
        col = pow(col, vec3(0.9));

        gl_FragColor = vec4(col, 1.0);
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
    this._jumpSources(Math.min(1, strength || 0));
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['interference-pattern'] = InterferencePatternPreset;
})();
