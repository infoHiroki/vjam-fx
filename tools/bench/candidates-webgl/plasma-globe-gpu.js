(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PlasmaGlobeGpuPreset extends BasePreset {
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

        preset.beatPulse *= 0.92;
        preset._time += 0.011 + preset.audio.mid * 0.009 + preset.audio.rms * 0.003;

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
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_rms;
      uniform float u_beat;

      mat2 rot(float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c);
      }

      float bolt(vec2 p, vec2 start, vec2 end, float seed) {
        vec2 d = end - start;
        float len = max(length(d), 0.001);
        vec2 dir = d / len;
        vec2 n = vec2(-dir.y, dir.x);
        float t = clamp(dot(p - start, dir) / len, 0.0, 1.0);
        float branch = sin(t * (12.0 + seed * 3.7) + u_time * (3.0 + u_treble * 5.0) + seed * 4.0);
        branch += 0.55 * sin(t * (27.0 + u_treble * 18.0) - u_time * (4.0 + seed));
        branch += 0.25 * sin(t * (55.0 + u_beat * 25.0) + seed * 8.0);
        float waviness = (0.015 + u_treble * 0.03 + u_beat * 0.012) * branch;
        vec2 center = start + dir * (t * len) + n * waviness;
        float core = exp(-length(p - center) * (120.0 - u_bass * 45.0));
        float aura = exp(-length(p - center) * (25.0 - u_rms * 8.0));
        // Remove tip fadeout so bolts extend fully to edges
        float tip = smoothstep(0.0, 0.08, t);
        return (core * (0.9 + u_bass * 1.3) + aura * (0.2 + u_rms * 0.7)) * tip;
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
        // No UV drift - keep center fixed for plasma globe
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float globeR = 0.72;
        float r = length(uv);
        float sphere = smoothstep(globeR + 0.01, globeR - 0.01, r);

        float targetAngle = u_time * (0.35 + u_mid * 0.8) + u_mid * 4.5;
        // Extend bolt targets further to reach screen edges
        vec2 target = vec2(cos(targetAngle), sin(targetAngle)) * (0.95 + u_rms * 0.15);
        vec2 core = vec2(0.0);

        float field = 0.0;
        field += bolt(uv, core, target, 0.0);
        field += bolt(uv, core, target * 0.93 * rot(0.12 + u_treble * 0.25), 1.0) * (0.65 + u_treble * 0.4);
        field += bolt(uv, core, target * 0.88 * rot(-0.15 - u_treble * 0.2), 2.0) * (0.45 + u_treble * 0.35);
        // Additional bolts for fuller coverage
        float targetAngle2 = targetAngle + 2.094; // +120 degrees
        vec2 target2 = vec2(cos(targetAngle2), sin(targetAngle2)) * (0.9 + u_rms * 0.12);
        field += bolt(uv, core, target2, 3.0) * (0.5 + u_mid * 0.3);
        float targetAngle3 = targetAngle + 4.189; // +240 degrees
        vec2 target3 = vec2(cos(targetAngle3), sin(targetAngle3)) * (0.85 + u_rms * 0.1);
        field += bolt(uv, core, target3, 4.0) * (0.4 + u_mid * 0.25);

        if (u_beat > 0.01) {
          for (int i = 0; i < 6; i++) {
            float fi = float(i);
            float a = fi / 6.0 * 6.28318 + u_time * 0.2;
            vec2 omni = vec2(cos(a), sin(a)) * (0.9 + u_rms * 0.1);
            field += bolt(uv, core, omni, fi + 3.0) * u_beat * 0.9;
          }
        }

        float gas = exp(-r * (2.8 - u_rms * 0.8));
        gas += 0.25 * sin(r * (18.0 + u_bass * 10.0) - u_time * (2.0 + u_mid * 2.0));
        gas += 0.18 * sin(uv.x * 9.0 + u_time * 1.3 + u_treble * 5.0);
        gas = max(gas, 0.0) * sphere;

        float electrode = exp(-r * (40.0 - u_bass * 15.0));
        vec3 glow = vec3(0.3, 0.08, 0.75) * gas * (0.25 + u_rms * 0.8);
        // Bolts render beyond sphere (no sphere multiply on field)
        glow += vec3(0.9, 0.2, 1.0) * field * (0.6 + u_treble * 0.8);
        glow += vec3(1.0, 0.72, 0.95) * electrode * (0.6 + u_bass * 1.2);
        glow += vec3(0.45, 0.65, 1.0) * field * u_beat * 0.4;

        float rim = exp(-abs(r - globeR) * 80.0);
        vec3 glass = vec3(0.09, 0.14, 0.22) * rim * (0.8 + u_rms * 0.4);
        glass += vec3(0.35, 0.55, 0.95) * rim * u_beat * 0.5;

        vec3 bg = vec3(0.0);
        bg += vec3(0.015, 0.01, 0.03) * exp(-r * 3.0);
        bg += vec3(0.03, 0.02, 0.06) * u_beat * exp(-r * 4.5);

        vec3 col = bg + glow + glass;
        col *= 0.9 + 0.2 * sin(u_time + r * 8.0);
        col = pow(max(col, 0.0), vec3(0.88));
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
window.VJamFX.presets['plasma-globe-gpu'] = PlasmaGlobeGpuPreset;
})();
