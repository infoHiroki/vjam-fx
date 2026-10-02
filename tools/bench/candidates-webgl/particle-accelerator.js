(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ParticleAcceleratorPreset extends BasePreset {
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

        preset._time += 0.014 + preset.audio.mid * 0.012 + preset.audio.bass * 0.003;
        preset.beatPulse *= 0.89;

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

      #define TRAILS 28

      float hash(float n) {
        return fract(sin(n) * 43758.5453123);
      }
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p){
        vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }

      float beamPoint(vec2 uv, vec2 p, float r) {
        return smoothstep(r, r * 0.18, length(uv - p));
      }

      float ring(vec2 uv, float r, float w) {
        return smoothstep(w, w * 0.28, abs(length(uv) - r));
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

        float energy = 0.4 + u_bass * 1.5;
        float orbitSpeed = 0.5 + u_mid * 3.8;
        float sync = 0.2 + u_treble * 1.4;
        float intensity = 0.25 + u_rms * 1.1;
        float collision = smoothstep(0.04, 0.98, u_beat);

        float radiusA = 0.34 + 0.03 * sin(t * 0.7) + u_bass * 0.05;
        float radiusB = 0.5 + 0.05 * cos(t * 0.9) + u_bass * 0.08;

        vec3 col = vec3(0.02, 0.03, 0.05);
        col += vec3(0.02, 0.04, 0.08) * exp(-length(uv) * 2.8) * intensity;

        float tunnel = exp(-abs(uv.y) * (6.0 + u_mid * 4.0 + u_beat * 3.0)) * 0.12;
        col += vec3(0.03, 0.08, 0.16) * tunnel;

        float ringA = ring(uv, radiusA, 0.014 + u_rms * 0.008);
        float ringB = ring(uv, radiusB, 0.018 + u_rms * 0.01);
        col += vec3(0.1, 0.6, 1.0) * ringA * (0.3 + energy * 0.25 + u_beat * 0.2);
        col += vec3(1.0, 0.35, 0.12) * ringB * (0.25 + energy * 0.35 + u_beat * 0.18);

        vec2 beamA = vec2(cos(t * orbitSpeed), sin(t * orbitSpeed * (0.95 + u_mid * 0.1))) * radiusA;
        vec2 beamB = vec2(cos(-t * orbitSpeed * 1.08 + 1.57), sin(-t * orbitSpeed * 1.02 + 1.57)) * radiusB;

        for (int i = 0; i < TRAILS; i++) {
          float fi = float(i);
          float lag = fi / float(TRAILS - 1);
          float trailTimeA = t - lag * (0.45 + energy * 0.22);
          float trailTimeB = t - lag * (0.38 + energy * 0.18);

          vec2 posA = vec2(cos(trailTimeA * orbitSpeed), sin(trailTimeA * orbitSpeed * (0.95 + u_mid * 0.1))) * radiusA;
          vec2 posB = vec2(cos(-trailTimeB * orbitSpeed * 1.08 + 1.57), sin(-trailTimeB * orbitSpeed * 1.02 + 1.57)) * radiusB;

          float glowA = beamPoint(uv, posA, mix(0.028, 0.004, lag));
          float glowB = beamPoint(uv, posB, mix(0.03, 0.005, lag));
          float radiationA = exp(-length(uv - posA) * (20.0 + u_treble * 18.0)) * sin(fi * 0.8 + t * (6.0 + u_treble * 20.0)) * 0.5 + 0.5;
          float radiationB = exp(-length(uv - posB) * (20.0 + u_treble * 18.0)) * sin(fi * 0.9 - t * (5.0 + u_treble * 18.0)) * 0.5 + 0.5;

          col += vec3(0.1, 0.75, 1.0) * glowA * (1.1 - lag) * energy;
          col += vec3(1.0, 0.42, 0.08) * glowB * (1.1 - lag) * energy;
          col += vec3(0.7, 0.95, 1.0) * radiationA * glowA * sync * 0.18;
          col += vec3(1.0, 0.85, 0.45) * radiationB * glowB * sync * 0.18;
        }

        vec2 collisionPoint = mix(beamA, beamB, 0.5) * (1.0 - collision * 0.7);
        float blast = exp(-length(uv - collisionPoint) * (16.0 - u_beat * 12.0)) * collision;
        float jets = exp(-abs(dot(normalize(vec2(1.0, 1.0)), uv - collisionPoint)) * (24.0 + u_treble * 20.0)) * blast;
        jets += exp(-abs(dot(normalize(vec2(-1.0, 1.0)), uv - collisionPoint)) * (24.0 + u_treble * 20.0)) * blast;
        col += vec3(1.0, 0.95, 0.82) * blast * (0.8 + energy * 0.6);
        col += vec3(0.85, 0.95, 1.0) * jets * (0.3 + u_treble * 0.5);

        float grid = sin(uv.x * (60.0 + u_mid * 50.0)) * sin(uv.y * (60.0 + u_mid * 50.0));
        col += vec3(0.08, 0.15, 0.2) * (grid * 0.5 + 0.5) * 0.04 * intensity * (1.0 + u_beat * 0.4);
        col *= 1.0 - smoothstep(1.05, 1.55, length(uv)) * 0.42;
        col = 1.0 - exp(-col * (1.2 + u_bass * 0.5 + u_rms * 0.4));

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
window.VJamFX.presets['particle-accelerator'] = ParticleAcceleratorPreset;
})();
