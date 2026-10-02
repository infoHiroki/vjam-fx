(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Solar Corona — Sun's corona during eclipse. Plasma streamers extend outward.
 * Bass = coronal mass ejection (streamer length), treble = magnetic loop vibration,
 * mid = corona rotation, beat = solar flare, rms = overall luminosity.
 */
class SolarCoronaPreset extends BasePreset {
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
        preset._time += 0.006 + preset.audio.rms * 0.012;
        preset.beatPulse *= 0.88;
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
      float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=noise(p)*a;p*=2.1;a*=0.5;}return v;}
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
        uv += vec2(sin(u_time * 0.15), cos(u_time * 0.12)) * 0.06;
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

        // Solar disk — dark during eclipse
        float diskRadius = 0.15;
        float disk = smoothstep(diskRadius + 0.01, diskRadius - 0.01, dist);

        // Corona streamers — extend outward, bass controls length
        float streamerLen = 0.5 + u_bass * 1.2 + u_beat * 0.8;

        // Multiple streamer arms with rotation (mid)
        float rotation = t * 0.05 + u_mid * 0.5;
        float streamerAngle = angle + rotation;

        // Asymmetric streamers using noise
        float arms = 0.0;
        for (int i = 0; i < 6; i++) {
          float a = streamerAngle + float(i) * 1.047; // 60 degree spacing
          float armNoise = fbm(vec2(a * 2.0, t * 0.3 + float(i)));
          float armWidth = 0.15 + armNoise * 0.1 + u_treble * 0.08;
          float armShape = exp(-pow(mod(a, 1.047) - 0.5236, 2.0) / (armWidth * armWidth));
          float armFalloff = exp(-dist * (1.5 - u_bass * 0.8) / streamerLen);
          arms += armShape * armFalloff * (0.4 + armNoise * 0.6);
        }

        // Fine magnetic loops — treble drives vibration
        float loops = 0.0;
        for (int i = 0; i < 4; i++) {
          float loopAngle = streamerAngle * (2.0 + float(i)) + t * (0.2 + u_treble * 0.5);
          float loopR = 0.2 + float(i) * 0.08 + u_treble * 0.1;
          float loopDist = abs(dist - loopR);
          loops += exp(-loopDist * (20.0 - u_treble * 10.0)) * sin(loopAngle * 3.0) * 0.5;
        }
        loops *= (0.3 + u_treble * 1.5) * smoothstep(0.5, 0.15, dist);

        // Plasma turbulence
        float plasma = fbm(vec2(angle * 3.0 + t * 0.4, dist * 5.0 - t * 0.6)) *
                       exp(-dist * 1.5) * (0.3 + u_rms * 0.8 + u_bass * 0.5);

        // Total corona intensity
        float corona = arms + abs(loops) + plasma;
        corona *= smoothstep(diskRadius - 0.02, diskRadius + 0.05, dist); // Mask inside disk

        // Color — white core → orange/red outer → deep red tips
        vec3 innerCol = vec3(1.0, 0.95, 0.85);
        vec3 midCol = vec3(1.0, 0.5, 0.15);
        vec3 outerCol = vec3(0.6, 0.1, 0.05);

        float colorDist = smoothstep(diskRadius, diskRadius + streamerLen, dist);
        vec3 coronaCol = mix(mix(innerCol, midCol, colorDist * 2.0), outerCol, max(0.0, colorDist * 2.0 - 1.0));
        coronaCol *= corona;

        // Beat: solar flare — bright eruption
        float flareAngle = t * 0.3; // Flare direction
        float flareDot = dot(normalize(uv), vec2(cos(flareAngle), sin(flareAngle)));
        float flare = pow(max(0.0, flareDot), 4.0) * u_beat * 2.0 * exp(-dist * 1.5);
        coronaCol += vec3(1.0, 0.8, 0.4) * flare;

        // Prominences — arcs of plasma (rms driven)
        float prom = sin(angle * 5.0 + t * 0.8) * exp(-abs(dist - 0.2 - u_rms * 0.1) * 15.0);
        coronaCol += vec3(1.0, 0.3, 0.1) * max(0.0, prom) * (0.2 + u_rms * 1.0);

        // Dark disk
        vec3 col = coronaCol;
        col = mix(col, vec3(0.01), disk);

        // Chromosphere rim — thin red ring at disk edge
        float rim = exp(-pow(dist - diskRadius, 2.0) * 2000.0);
        col += vec3(0.8, 0.15, 0.05) * rim * (0.5 + u_rms * 1.0 + u_beat * 1.0);

        // Background stars
        float stars = step(0.998, hash(floor(gl_FragCoord.xy * 0.4)));
        col += vec3(stars) * 0.2 * (1.0 - corona * 2.0);

        // Overall luminosity with rms
        col *= 0.5 + u_rms * 1.2;

        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }`;
    try { return p.createShader(vert, frag); } catch(_) { return null; }
  }

  updateAudio(d){this.audio.bass=d.bass||0;this.audio.mid=d.mid||0;this.audio.treble=d.treble||0;this.audio.rms=d.rms||0;}
  onBeat(s){this.beatPulse=Math.min(1,s);}
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['solar-corona'] = SolarCoronaPreset;
})();
