(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Fluid Dynamics — Navier-Stokes inspired fluid simulation.
 * Velocity field drives color advection. Audio injects forces at different points.
 * Bass = large vortex injection, treble = fine turbulence, mid = flow direction,
 * beat = pressure explosion, rms = viscosity (low rms = thick, high = thin).
 */
class FluidDynamicsPreset extends BasePreset {
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
      p.setup = () => { p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL); p.pixelDensity(1); };
      p.draw = () => {
        if (!preset._shader) { preset._shader = preset._initShader(p); if (!preset._shader) return; }
        preset._time += 0.008 + preset.audio.rms * 0.015;
        preset.beatPulse *= 0.87;
        try {
          p.shader(preset._shader);
          preset._shader.setUniform('u_time', preset._time);
          preset._shader.setUniform('u_bass', preset.audio.bass);
          preset._shader.setUniform('u_mid', preset.audio.mid);
          preset._shader.setUniform('u_treble', preset.audio.treble);
          preset._shader.setUniform('u_rms', preset.audio.rms);
          preset._shader.setUniform('u_beat', preset.beatPulse);
          preset._shader.setUniform('u_resolution', [p.width, p.height]);
          p.noStroke(); p.quad(-1,-1,1,-1,1,1,-1,1);
        } catch(e){} finally { p.resetShader(); }
      };
      p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
    }, container);
  }

  _initShader(p) {
    const vert = `attribute vec3 aPosition; attribute vec2 aTexCoord; varying vec2 vUv;

void main(){ vUv=aTexCoord; vec4 pos=vec4(aPosition,1.0); pos.xy=pos.xy*2.0-1.0; gl_Position=pos; }`;
    const frag = `
      precision highp float;
      varying vec2 vUv;
      uniform float u_time, u_bass, u_mid, u_treble, u_rms, u_beat;
      uniform vec2 u_resolution;

      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }

      // Curl noise for divergence-free velocity field
      vec2 curlNoise(vec2 p, float t) {
        float eps = 0.01;
        float n  = noise(p + vec2(0, eps) + t);
        float s  = noise(p - vec2(0, eps) + t);
        float e  = noise(p + vec2(eps, 0) + t);
        float w  = noise(p - vec2(eps, 0) + t);
        return vec2(n - s, -(e - w)) / (2.0 * eps);
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
void main(){
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);
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

        // Viscosity — rms makes fluid thinner (more detail)
        float viscosity = 0.5 - u_rms * 0.35;

        // Advect coordinate through velocity field
        vec2 p = uv + audioDrift;
        float scale = 3.0 + u_mid * 2.0;

        // Bass: large-scale vortex injection
        vec2 bassForce = curlNoise(p * scale * 0.5, t * 0.2) * (1.5 + u_bass * 4.0);

        // Treble: fine turbulence
        vec2 trebleForce = curlNoise(p * scale * 3.0, t * 0.8) * u_treble * 2.0;

        // Mid: directional flow
        float flowAngle = t * 0.1 + u_mid * 3.0;
        vec2 midFlow = vec2(cos(flowAngle), sin(flowAngle)) * u_mid * 0.5;

        // Beat: explosive radial force from center
        vec2 beatForce = normalize(uv + 0.001) * u_beat * 3.0 * exp(-length(uv) * 2.0);

        // Total velocity
        vec2 vel = bassForce + trebleForce + midFlow + beatForce;
        vel *= (1.0 - viscosity);

        // Advect through multiple steps for smoother result
        vec2 advected = p;
        for (int i = 0; i < 4; i++) {
          vec2 v = curlNoise(advected * scale, t * (0.15 + float(i) * 0.05));
          v += vel * 0.25;
          advected += v * 0.02;
        }

        // Color from advected position — separate channels for chromatic effect
        float r_val = noise(advected * 4.0 + vec2(t * 0.12, 0.0));
        float g_val = noise(advected * 4.0 + vec2(0.0, t * 0.15) + 5.0);
        float b_val = noise(advected * 4.0 + vec2(-t * 0.1, t * 0.08) + 10.0);

        // Audio-driven color mapping
        vec3 col;
        col.r = r_val * (0.3 + u_bass * 1.5 + u_beat * 0.8);
        col.g = g_val * (0.2 + u_mid * 1.2 + u_rms * 0.6);
        col.b = b_val * (0.3 + u_treble * 1.5 + u_beat * 0.5);

        // Vorticity visualization — bright edges where flow curls
        float vorticity = length(curlNoise(advected * scale, t * 0.2));
        col += vec3(0.8, 0.9, 1.0) * vorticity * (0.15 + u_rms * 0.4);

        // Speed visualization — fast flow glows
        float speed = length(vel);
        col += vec3(1.0, 0.6, 0.2) * speed * 0.08 * (1.0 + u_bass);

        // Beat: white pressure wave
        float pressureWave = exp(-abs(length(uv) - u_beat * 2.0) * 8.0) * u_beat;
        col += vec3(1.0) * pressureWave * 0.6;

        // Brightness with rms
        col *= 0.6 + u_rms * 1.0;

        // Subtle vignette
        col *= 1.0 - dot(uv, uv) * 0.3;

        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }`;
    try { return p.createShader(vert, frag); } catch(_) { return null; }
  }

  updateAudio(d){this.audio.bass=d.bass||0;this.audio.mid=d.mid||0;this.audio.treble=d.treble||0;this.audio.rms=d.rms||0;}
  onBeat(s){this.beatPulse=Math.min(1,s);}
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['fluid-dynamics'] = FluidDynamicsPreset;
})();
