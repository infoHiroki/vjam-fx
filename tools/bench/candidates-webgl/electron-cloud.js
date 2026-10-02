(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Electron Cloud — Quantum probability orbital visualization.
 * Hydrogen-like electron orbitals (s, p, d shapes) morph with audio.
 * Bass = principal quantum number (orbital size), treble = angular momentum (shape complexity),
 * mid = magnetic quantum number (orientation), beat = electron transition (orbital jump),
 * rms = probability density brightness.
 */
class ElectronCloudPreset extends BasePreset {
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
        preset._time += 0.008 + preset.audio.rms * 0.012;
        preset.beatPulse *= 0.85;
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

      #define PI 3.14159265

      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }

      // Spherical harmonic-inspired shapes
      float orbital(vec2 uv, float n, float l, float m, float t) {
        float r = length(uv);
        float theta = atan(uv.y, uv.x);

        // Radial part — exponential decay with nodes
        float radial = exp(-r * (2.0 / max(n, 0.5)));
        // Add radial nodes
        float nodes = abs(sin(r * PI * n * 0.5 + t * 0.5));
        radial *= nodes;

        // Angular part — lobes
        float angular = 1.0;
        if (l > 0.5) {
          angular = pow(abs(cos(theta * l + t * 0.3)), max(0.5, 2.0 - l * 0.3));
          // m splits the lobes
          angular *= (0.5 + 0.5 * cos(theta * m * 2.0 + t * 0.2));
        }

        return radial * angular;
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

        // Quantum numbers driven by audio
        float n = 1.0 + u_bass * 4.0; // Principal (1-5): orbital size
        float l = u_treble * 3.0; // Angular momentum (0-3): shape complexity
        float m = u_mid * 2.0 - 1.0; // Magnetic (-1 to 1): orientation

        // Slow rotation
        float angle = t * 0.15 + u_mid * 0.5;
        float ca = cos(angle), sa = sin(angle);
        vec2 ruv = vec2(uv.x * ca - uv.y * sa, uv.x * sa + uv.y * ca);

        // Scale with n
        ruv *= 2.0 + n * 0.5;

        // Calculate probability density
        float psi = orbital(ruv, n, l, m, t);

        // Second orbital for transition effect on beat
        float n2 = n + 1.0 + u_beat * 2.0;
        float l2 = l + u_beat;
        float psi2 = orbital(ruv, n2, l2, m, t + 1.0);
        float prob = mix(psi, psi2, u_beat * 0.6);
        prob = prob * prob; // |ψ|²

        // Normalize and apply rms brightness
        prob *= (0.5 + u_rms * 2.0);

        // Color: phase → hue, probability → brightness
        float phase = atan(ruv.y, ruv.x) + t * 0.3;
        vec3 posColor = vec3(0.2, 0.4, 0.9); // Positive phase
        vec3 negColor = vec3(0.9, 0.2, 0.3); // Negative phase
        float phaseSign = sin(phase * (1.0 + l) + t * 0.5);

        vec3 orbitalColor = mix(negColor, posColor, phaseSign * 0.5 + 0.5);

        // Treble adds iridescence
        orbitalColor += vec3(
          sin(phase * 2.0 + t) * 0.15,
          sin(phase * 2.0 + t + 2.1) * 0.15,
          sin(phase * 2.0 + t + 4.2) * 0.15
        ) * u_treble * 2.0;

        vec3 col = orbitalColor * prob;

        // Nucleus glow at center
        float nucleus = exp(-length(uv) * 30.0) * (0.5 + u_bass * 1.0 + u_beat * 1.5);
        col += vec3(1.0, 0.9, 0.7) * nucleus;

        // Beat: transition flash — photon emission
        float emissionRing = exp(-pow(length(uv) - u_beat * 1.5, 2.0) * 30.0) * u_beat;
        col += vec3(0.3, 0.8, 1.0) * emissionRing * 2.0;

        // Background: very subtle atomic grid
        float grid = smoothstep(0.005, 0.0, abs(fract(uv.x * 4.0) - 0.5) - 0.49) +
                     smoothstep(0.005, 0.0, abs(fract(uv.y * 4.0) - 0.5) - 0.49);
        col += vec3(0.02, 0.03, 0.04) * grid * 0.3;

        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }`;
    try { return p.createShader(vert, frag); } catch(_) { return null; }
  }

  updateAudio(d){this.audio.bass=d.bass||0;this.audio.mid=d.mid||0;this.audio.treble=d.treble||0;this.audio.rms=d.rms||0;}
  onBeat(s){this.beatPulse=Math.min(1,s);}
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['electron-cloud'] = ElectronCloudPreset;
})();
