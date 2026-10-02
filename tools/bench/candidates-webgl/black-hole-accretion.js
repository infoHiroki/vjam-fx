(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Black Hole Accretion — Accretion disk around a black hole with gravitational lensing.
 * Different from existing black-hole (simple gravity well) — this has:
 * - Doppler-shifted accretion disk (approaching side brighter)
 * - Gravitational lensing of background stars
 * - Relativistic jet on beat
 * Bass = mass (disk size/lensing), treble = disk temperature, mid = spin rate,
 * beat = relativistic jet burst, rms = accretion rate.
 */
class BlackHoleAccretionPreset extends BasePreset {
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
        preset.beatPulse *= 0.86;
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
      float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=noise(p)*a;p*=2.1;a*=0.5;}return v;}
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
        vec2 audioDrift = vec2(sin(u_time * 0.3) * 1.5 + 1.5, sin(u_time * 0.23) * 1.5 + 1.5);
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float t = u_time;
        float dist = length(uv);
        float angle = atan(uv.y, uv.x);

        // Black hole parameters
        float mass = 0.12 + u_bass * 0.08; // Schwarzschild radius
        float spin = 0.3 + u_mid * 1.5; // Spin rate

        // Gravitational lensing — distort UV
        float lensStrength = mass * 2.0 / (dist * dist + mass);
        vec2 lensed = uv + normalize(uv) * lensStrength * 0.1;

        // Event horizon
        float horizon = smoothstep(mass + 0.01, mass - 0.01, dist);

        // Photon sphere ring
        float photonSphere = exp(-pow(dist - mass * 1.5, 2.0) * 500.0) * (0.5 + u_rms * 1.0);

        // Accretion disk — tilted ellipse
        float diskTilt = 0.3; // Inclination
        vec2 diskUV = vec2(uv.x, uv.y / diskTilt);
        float diskDist = length(diskUV);
        float diskAngle = atan(diskUV.y, diskUV.x) + t * spin;

        // Disk extent
        float innerEdge = mass * 3.0;
        float outerEdge = mass * (8.0 + u_bass * 6.0 + u_rms * 3.0);
        float inDisk = smoothstep(innerEdge - 0.02, innerEdge + 0.02, diskDist) *
                       smoothstep(outerEdge + 0.02, outerEdge - 0.02, diskDist);

        // Disk structure — spiral arms with turbulence
        float diskPattern = fbm(vec2(diskAngle * 3.0 + t * 0.5, diskDist * 10.0));
        diskPattern += sin(diskAngle * 6.0 + t * spin * 3.0) * 0.3;
        float diskBrightness = inDisk * (0.5 + diskPattern * 0.5);

        // Doppler beaming — approaching side (left) brighter
        float doppler = 1.0 + 0.5 * sin(diskAngle) * spin * 0.3;
        diskBrightness *= doppler;

        // Disk temperature — treble = hotter
        vec3 coolDisk = vec3(0.6, 0.15, 0.05); // Red
        vec3 hotDisk = vec3(0.3, 0.5, 1.0); // Blue-white
        vec3 diskColor = mix(coolDisk, hotDisk, u_treble * 0.8 + diskBrightness * 0.3);
        diskColor *= diskBrightness * (1.0 + u_rms * 1.5 + u_bass * 0.8);

        // Relativistic jet — beat triggers
        float jetWidth = 0.04 + u_beat * 0.06;
        float jet1 = exp(-pow(uv.x, 2.0) / (jetWidth * jetWidth)) *
                      smoothstep(0.0, 0.15, uv.y) * exp(-uv.y * 2.0);
        float jet2 = exp(-pow(uv.x, 2.0) / (jetWidth * jetWidth)) *
                      smoothstep(0.0, 0.15, -uv.y) * exp(uv.y * 2.0);
        float jets = (jet1 + jet2) * u_beat * 3.0;

        // Jet internal structure
        float jetNoise = fbm(vec2(uv.x * 20.0, abs(uv.y) * 5.0 - t * 3.0));
        jets *= 0.5 + jetNoise;

        vec3 jetColor = mix(vec3(0.3, 0.5, 1.0), vec3(0.8, 0.3, 1.0), abs(uv.y) * 2.0) * jets;

        // Background stars (lensed)
        float stars = step(0.997, hash(floor(lensed * 80.0)));
        float starBright = hash(floor(lensed * 80.0) + 0.5);
        vec3 starColor = vec3(stars) * (0.3 + starBright * 0.5);

        // Combine
        vec3 col = starColor;
        col += diskColor;
        col += vec3(0.9, 0.8, 1.0) * photonSphere;
        col += jetColor;

        // Event horizon — black
        col *= (1.0 - horizon);

        // Hawking radiation glow at horizon edge
        float hawking = exp(-pow(dist - mass, 2.0) * 800.0) * (0.2 + u_rms * 0.3);
        col += vec3(0.5, 0.3, 0.1) * hawking;

        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }`;
    try { return p.createShader(vert, frag); } catch(_) { return null; }
  }

  updateAudio(d){this.audio.bass=d.bass||0;this.audio.mid=d.mid||0;this.audio.treble=d.treble||0;this.audio.rms=d.rms||0;}
  onBeat(s){this.beatPulse=Math.min(1,s);}
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['black-hole-accretion'] = BlackHoleAccretionPreset;
})();
