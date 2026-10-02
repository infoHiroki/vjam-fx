(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Circuit Matrix — PCB traces and data flowing through circuits.
 * NOT like existing circuit-board (static traces). This is about DATA FLOW.
 * Signals race along paths, nodes light up on beat.
 * Bass = signal voltage (brightness), treble = clock speed, mid = routing complexity,
 * beat = chip activation pulse, rms = power rail hum.
 */
class CircuitMatrixPreset extends BasePreset {
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
        preset._time += 0.01 + preset.audio.treble * 0.03;
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

      // Grid-aligned trace pattern
      float trace(vec2 p, float width) {
        vec2 g = fract(p) - 0.5;
        float h = min(abs(g.x), abs(g.y));
        return smoothstep(width + 0.01, width, h);
      }

      // Node (chip/component) at grid intersections
      float node(vec2 p, float size) {
        vec2 g = fract(p) - 0.5;
        return smoothstep(size + 0.01, size, length(g));
      }

      // Data signal pulse traveling along traces
      float signal(vec2 p, float t, float speed) {
        vec2 g = fract(p) - 0.5;
        float onH = step(abs(g.y), 0.06); // on horizontal trace
        float onV = step(abs(g.x), 0.06); // on vertical trace

        // Pulse position along trace
        float pulseH = fract(p.x * 0.5 + t * speed);
        float pulseV = fract(p.y * 0.5 + t * speed * 0.7);

        float sigH = exp(-pow(fract(p.x) - pulseH, 2.0) * 80.0) * onH;
        float sigV = exp(-pow(fract(p.y) - pulseV, 2.0) * 80.0) * onV;

        return sigH + sigV;
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

        // Grid scale — mid increases complexity
        float gridScale = 6.0 + u_mid * 6.0;
        vec2 p = uv * gridScale + audioDrift;

        // Trace network
        float traceWidth = 0.04 + u_rms * 0.02;
        float traces = trace(p, traceWidth);

        // Secondary finer traces
        float fineTraces = trace(p * 2.0 + 0.25, traceWidth * 0.7) * 0.4;

        // Nodes at intersections
        float nodes = node(p, 0.08 + u_bass * 0.04);
        float fineNodes = node(p * 2.0 + 0.25, 0.06) * 0.3;

        // Data signals — treble = clock speed
        float clockSpeed = 0.3 + u_treble * 2.0;
        float sig1 = signal(p, t, clockSpeed);
        float sig2 = signal(p * 2.0 + 0.25, t, clockSpeed * 1.3) * 0.6;
        float sig3 = signal(p + vec2(hash(floor(p)) * 0.5), t, clockSpeed * 0.8) * 0.4;
        float totalSignal = sig1 + sig2 + sig3;

        // Signal voltage — bass drives brightness
        float voltage = 0.3 + u_bass * 1.5;
        totalSignal *= voltage;

        // Color
        vec3 pcbColor = vec3(0.0, 0.03, 0.01); // Dark green PCB
        vec3 copperColor = vec3(0.08, 0.06, 0.03) + vec3(0.02) * u_rms; // Copper traces
        vec3 signalColor = mix(
          vec3(0.0, 0.8, 0.3),  // Green signal
          vec3(0.2, 0.5, 1.0),  // Blue high-speed
          u_treble
        );
        vec3 nodeColor = vec3(0.1, 0.1, 0.1); // IC package

        // Beat: chip activation — nodes flash
        float nodeFlash = nodes * u_beat * 2.0;
        vec3 flashColor = mix(vec3(1.0, 0.8, 0.2), vec3(0.5, 1.0, 0.5), hash(floor(p)));

        // Combine layers
        vec3 col = pcbColor;
        col = mix(col, copperColor, (traces + fineTraces) * (0.6 + u_rms * 0.5));
        col = mix(col, nodeColor, (nodes + fineNodes));
        col += signalColor * totalSignal * (0.5 + u_bass * 0.8);
        col += flashColor * nodeFlash;

        // Power rail hum — rms
        float powerHum = sin(uv.y * 40.0 + t * 5.0) * 0.5 + 0.5;
        col += vec3(0.0, 0.05, 0.0) * powerHum * u_rms * 0.3;

        // Beat global pulse
        col += vec3(0.1, 0.2, 0.15) * u_beat * 0.3;

        // Solder mask reflection
        col += vec3(0.02, 0.04, 0.02) * (1.0 - dot(uv, uv)) * (0.3 + u_rms * 0.5);

        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }`;
    try { return p.createShader(vert, frag); } catch(_) { return null; }
  }

  updateAudio(d){this.audio.bass=d.bass||0;this.audio.mid=d.mid||0;this.audio.treble=d.treble||0;this.audio.rms=d.rms||0;}
  onBeat(s){this.beatPulse=Math.min(1,s);}
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['circuit-matrix'] = CircuitMatrixPreset;
})();
