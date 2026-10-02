(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * DNA Sequence — Scrolling DNA base pair visualization like a genome browser.
 * Color-coded nucleotides (A=green, T=red, C=blue, G=yellow) flow across screen.
 * Different from existing dna-helix (rotating structure) — this is about SEQUENCING DATA.
 * Bass = scroll speed, treble = mutation rate (color glitches), mid = read depth,
 * beat = gene highlight flash, rms = signal quality.
 */
class DnaSequencePreset extends BasePreset {
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
        preset._time += 0.008 + preset.audio.bass * 0.03;
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

      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }

      // Pseudo-random base selection (0-3 = ATCG)
      float base(vec2 cell) {
        return floor(hash(cell) * 4.0);
      }

      // Base pair colors
      vec3 baseColor(float b) {
        if (b < 1.0) return vec3(0.2, 0.9, 0.3);  // A = green
        if (b < 2.0) return vec3(0.9, 0.2, 0.2);  // T = red
        if (b < 3.0) return vec3(0.2, 0.4, 1.0);  // C = blue
        return vec3(0.9, 0.8, 0.1);                 // G = yellow
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

        // Scroll speed — bass drives
        float scrollSpeed = 1.0 + u_bass * 5.0;

        // Multiple read lanes — mid = depth (number of lanes)
        float lanes = 8.0 + u_mid * 16.0;
        float laneH = 1.0 / lanes;
        float laneIdx = floor(uv.y / laneH);
        float laneY = fract(uv.y / laneH);

        // Base position in sequence
        float baseWidth = 0.008 + u_rms * 0.004; // Signal quality affects resolution
        float seqPos = floor((uv.x + t * scrollSpeed * 0.1 + laneIdx * 0.37) / baseWidth);

        // Get base value
        float b = base(vec2(seqPos, laneIdx));

        // Mutation — treble causes random base changes
        float mutationChance = u_treble * 0.15;
        float mutRand = hash(vec2(seqPos * 0.01 + t * 0.5, laneIdx + 100.0));
        if (mutRand < mutationChance) {
          b = mod(b + 1.0 + floor(mutRand * 4.0), 4.0);
        }

        vec3 bCol = baseColor(b);

        // Lane separation
        float laneBorder = smoothstep(0.02, 0.05, laneY) * smoothstep(0.98, 0.95, laneY);

        // Base cell border
        float cellX = fract((uv.x + t * scrollSpeed * 0.1 + laneIdx * 0.37) / baseWidth);
        float cellBorder = smoothstep(0.05, 0.1, cellX) * smoothstep(0.95, 0.9, cellX);

        // Intensity
        float intensity = laneBorder * cellBorder;

        // Read depth visualization — some lanes brighter based on mid
        float laneDepth = 0.5 + 0.5 * sin(laneIdx * 1.7 + u_mid * 3.0);
        intensity *= 0.4 + laneDepth * 0.6;

        // Signal quality — rms affects noise
        float signalNoise = hash(vec2(seqPos + t * 10.0, laneIdx * 7.0)) * (1.0 - u_rms) * 0.3;
        intensity *= 1.0 - signalNoise;

        // Gene highlight on beat — bright band sweeps across
        float geneHighlight = exp(-pow(uv.x - 0.5, 2.0) * 8.0) * u_beat * 2.0;

        // Combine
        vec3 col = bCol * intensity * (0.5 + u_rms * 0.8);

        // Beat highlight — white/cyan overlay on center region
        col += vec3(0.3, 0.8, 1.0) * geneHighlight * intensity;

        // Coverage graph at bottom of each lane
        float coverageY = smoothstep(0.0, 0.15, laneY);
        float coverage = hash(vec2(seqPos * 0.1, laneIdx)) * u_mid;
        float coverageBar = step(laneY, coverage * 0.12 + 0.01);
        col += vec3(0.1, 0.3, 0.2) * coverageBar * 0.3;

        // Background
        vec3 bg = vec3(0.02, 0.02, 0.04);
        col = max(col, bg);

        // Global beat flash
        col += vec3(0.05, 0.1, 0.08) * u_beat * 0.5;

        // Treble mutation flash — red flicker on mutated bases
        if (mutRand < mutationChance) {
          col += vec3(0.5, 0.0, 0.0) * u_treble * 0.5;
        }

        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }`;
    try { return p.createShader(vert, frag); } catch(_) { return null; }
  }

  updateAudio(d){this.audio.bass=d.bass||0;this.audio.mid=d.mid||0;this.audio.treble=d.treble||0;this.audio.rms=d.rms||0;}
  onBeat(s){this.beatPulse=Math.min(1,s);}
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['dna-sequence'] = DnaSequencePreset;
})();
