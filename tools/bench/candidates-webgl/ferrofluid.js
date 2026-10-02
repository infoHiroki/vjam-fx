(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FerrofluidPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this._shader = null;
    this._poles = [
      { x: 0.32, y: 0.48 },
      { x: 0.62, y: 0.55 },
      { x: 0.48, y: 0.34 },
    ];
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

        preset.beatPulse *= 0.92;
        preset._time += 0.014 + preset.audio.mid * 0.012 + preset.audio.rms * 0.01;
        preset._updatePoles();

        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          preset._shader.setUniform('u_pole0', [preset._poles[0].x, preset._poles[0].y]);
          preset._shader.setUniform('u_pole1', [preset._poles[1].x, preset._poles[1].y]);
          preset._shader.setUniform('u_pole2', [preset._poles[2].x, preset._poles[2].y]);
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

  _updatePoles() {
    const t = this._time;
    const bassLift = this.audio.bass * 0.22;
    const midDrift = 0.12 + this.audio.mid * 0.22;
    const beatKick = this.beatPulse * 0.35;

    // Poles orbit closer to center (0.5) with larger amplitude so they nearly touch then bounce apart
    this._poles[0].x = 0.5 + Math.sin(t * 1.2) * midDrift - 0.06;
    this._poles[0].y = 0.5 + Math.cos(t * 0.9) * 0.16 - bassLift + Math.sin(t * 2.1) * beatKick;

    this._poles[1].x = 0.5 + Math.cos(t * 1.1 + 1.8) * (midDrift + beatKick * 0.6) + 0.06;
    this._poles[1].y = 0.5 + Math.sin(t * 1.4 + 2.4) * 0.14 - bassLift * 0.8 + Math.cos(t * 2.3) * beatKick * 0.5;

    this._poles[2].x = 0.5 + Math.sin(t * 1.6 + 0.7) * (0.14 + beatKick);
    this._poles[2].y = 0.5 + Math.cos(t * 1.3 + 1.1) * 0.15 - bassLift * 1.2 - 0.08;
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
      uniform vec2 u_pole0;
      uniform vec2 u_pole1;
      uniform vec2 u_pole2;

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
          p *= 2.03;
          a *= 0.5;
        }
        return v;
      }

      float poleField(vec2 uv, vec2 pole, float scale) {
        vec2 q = uv - pole;
        float d = dot(q, q) + 0.002;
        return scale / d;
      }

      float heightField(vec2 uv) {
        float t = u_time;
        vec2 flow = uv * (2.5 + u_mid * 1.6);
        flow += vec2(
          fbm(flow * 1.6 + vec2(t * 0.18, -t * 0.12)),
          fbm(flow * 1.4 + vec2(-t * 0.14, t * 0.16))
        ) * 0.12;

        float field = 0.0;
        field += poleField(uv, u_pole0, 0.010 + u_bass * 0.025);
        field += poleField(uv, u_pole1, 0.012 + u_bass * 0.028);
        field += poleField(uv, u_pole2, 0.009 + u_bass * 0.035 + u_beat * 0.02);

        float ridge = max(field - (1.8 - u_bass * 1.2), 0.0);
        ridge = pow(ridge, 1.2 + u_bass * 1.5);

        float macro = fbm(flow + vec2(t * 0.1, -t * 0.08));
        float micro = sin((uv.x + macro * 0.15) * (48.0 + u_treble * 140.0) + t * 6.0)
                    * sin((uv.y - macro * 0.12) * (54.0 + u_treble * 160.0) - t * 7.0);
        float tremor = sin(length(uv - vec2(0.5)) * 45.0 - t * (10.0 + u_treble * 20.0));
        float ripple = micro * (0.05 + u_treble * 0.18) + tremor * u_beat * 0.15;

        float basin = smoothstep(0.92, 0.18, length((uv - vec2(0.5)) * vec2(1.0, 1.15)));
        return basin * (ridge * (0.75 + u_bass * 1.4) + macro * 0.10 + ripple);
      }

      vec3 iridescence(float fresnel, float phase) {
        vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (phase + vec3(0.0, 0.33, 0.67)));
        return rainbow * fresnel;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 centered = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

        float eps = 0.003;
        float h = heightField(uv);
        float hx = heightField(uv + vec2(eps, 0.0)) - heightField(uv - vec2(eps, 0.0));
        float hy = heightField(uv + vec2(0.0, eps)) - heightField(uv - vec2(0.0, eps));
        vec3 normal = normalize(vec3(-hx * 7.5, -hy * 7.5, 1.0));

        vec3 viewDir = normalize(vec3(centered.xy * 0.7, 1.2));
        vec3 lightDir = normalize(vec3(-0.45, -0.6, 0.8));
        vec3 halfDir = normalize(lightDir + viewDir);

        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.8);
        float spec = pow(max(dot(normal, halfDir), 0.0), 64.0) * (0.4 + u_bass * 0.6);
        float sheen = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 18.0);

        float phase = h * 0.8 + centered.x * 0.25 - centered.y * 0.2 + u_time * (0.08 + u_treble * 0.1);
        vec3 liquid = vec3(0.01, 0.012, 0.014);
        liquid += vec3(h * 0.03);

        vec3 rainbow = iridescence(fresnel * (0.8 + u_treble * 1.2), phase);
        vec3 specCol = vec3(0.9, 0.95, 1.0) * spec * (1.0 + u_beat * 2.0);
        vec3 oilCol = rainbow * (0.4 + u_treble * 0.6) + specCol + sheen * vec3(0.2, 0.3, 0.35);

        float edge = smoothstep(1.18, 0.12, length(centered * vec2(0.95, 1.2)));
        vec3 bg = vec3(0.0);
        bg += vec3(0.01, 0.012, 0.018) * exp(-length(centered - vec2(0.0, -0.08)) * 4.5) * (0.4 + u_mid * 0.5);
        bg += vec3(0.06, 0.08, 0.10) * u_beat * exp(-length(centered) * 3.0);

        vec3 col = mix(bg, liquid + oilCol, clamp(h * 2.0 + edge * 0.45, 0.0, 1.0));
        col += rainbow * u_beat * 0.6;
        col = pow(col, vec3(0.92));

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

  onBeat(s) {
    this.beatPulse = Math.min(1, s);
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['ferrofluid'] = FerrofluidPreset;
})();
