(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Spectral Analysis — Real-time spectrogram waterfall display.
 * Horizontal frequency bands scroll vertically, color = intensity.
 * Like looking at a scientific instrument. Bass/mid/treble directly map to frequency regions.
 * Beat creates bright horizontal bands. rms controls overall gain.
 */
class SpectralAnalysisPreset extends BasePreset {
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
        preset._time += 0.015 + preset.audio.rms * 0.02;
        preset.beatPulse *= 0.82;
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

      // Spectrogram colormap (black→blue→cyan→green→yellow→red→white)
      vec3 spectroColor(float v) {
        v = clamp(v, 0.0, 1.0);
        vec3 c;
        if (v < 0.2) c = mix(vec3(0.0), vec3(0.0, 0.0, 0.5), v / 0.2);
        else if (v < 0.35) c = mix(vec3(0.0, 0.0, 0.5), vec3(0.0, 0.6, 0.8), (v - 0.2) / 0.15);
        else if (v < 0.5) c = mix(vec3(0.0, 0.6, 0.8), vec3(0.0, 0.8, 0.2), (v - 0.35) / 0.15);
        else if (v < 0.65) c = mix(vec3(0.0, 0.8, 0.2), vec3(0.9, 0.9, 0.0), (v - 0.5) / 0.15);
        else if (v < 0.8) c = mix(vec3(0.9, 0.9, 0.0), vec3(1.0, 0.2, 0.0), (v - 0.65) / 0.15);
        else c = mix(vec3(1.0, 0.2, 0.0), vec3(1.0, 1.0, 1.0), (v - 0.8) / 0.2);
        return c;
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
        vec2 uv = gl_FragCoord.xy / u_resolution;
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

        // X = frequency (left=low, right=high)
        // Y = time (scrolling down)
        float freq = uv.x;
        float timePos = uv.y;

        // Simulated spectrum based on audio bands
        // Bass region (0-0.3), mid (0.3-0.6), treble (0.6-1.0)
        float bassEnv = exp(-pow(freq - 0.15, 2.0) * 30.0) * u_bass * 2.5;
        float midEnv = exp(-pow(freq - 0.45, 2.0) * 20.0) * u_mid * 2.0;
        float trebleEnv = exp(-pow(freq - 0.75, 2.0) * 25.0) * u_treble * 2.2;

        // Harmonic overtones
        float harmonics = 0.0;
        for (int h = 1; h <= 5; h++) {
          float hFreq = freq * float(h);
          harmonics += exp(-pow(fract(hFreq) - 0.5, 2.0) * 50.0) * u_bass * 0.3 / float(h);
        }

        // Combine spectrum
        float spectrum = bassEnv + midEnv + trebleEnv + harmonics;

        // RMS gain
        spectrum *= 0.4 + u_rms * 1.5;

        // Waterfall scroll — modulate with time for variation
        float scrolledTime = timePos + t * 0.5;
        float timeNoise = noise(vec2(freq * 20.0, scrolledTime * 3.0));
        spectrum *= 0.5 + timeNoise;

        // Beat creates bright horizontal streak
        float beatLine = exp(-pow(timePos - fract(t * 0.5), 2.0) * 200.0) * u_beat * 2.0;
        spectrum += beatLine;

        // Spectral leakage / windowing artifacts
        spectrum += noise(vec2(freq * 50.0, scrolledTime * 8.0)) * 0.05 * (1.0 + u_treble);

        // Apply colormap
        vec3 col = spectroColor(spectrum);

        // Frequency axis markers
        float freqGrid = smoothstep(0.005, 0.0, abs(fract(freq * 10.0) - 0.5) - 0.48);
        col += vec3(0.1) * freqGrid * 0.3;

        // Time markers
        float timeGrid = smoothstep(0.002, 0.0, abs(fract(scrolledTime * 5.0) - 0.5) - 0.49);
        col += vec3(0.1) * timeGrid * 0.2;

        // Glow on active frequencies
        col += vec3(0.1, 0.15, 0.2) * spectrum * 0.3;

        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }`;
    try { return p.createShader(vert, frag); } catch(_) { return null; }
  }

  updateAudio(d){this.audio.bass=d.bass||0;this.audio.mid=d.mid||0;this.audio.treble=d.treble||0;this.audio.rms=d.rms||0;}
  onBeat(s){this.beatPulse=Math.min(1,s);}
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['spectral-analysis'] = SpectralAnalysisPreset;
})();
