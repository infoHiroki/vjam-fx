(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

/**
 * Microscope Diatom — Diatom (珪藻) patterns under microscope.
 * Radially symmetric silica shells with intricate nanopore patterns.
 * Different from existing cellular (random blobs) — diatoms have precise geometric symmetry.
 * Bass = pore size, treble = fine structure detail, mid = specimen rotation,
 * beat = focus plane shift (different diatom), rms = illumination.
 */
class MicroscopeDiatomPreset extends BasePreset {
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
        preset._time += 0.006 + preset.audio.rms * 0.01;
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

      #define PI 3.14159265
      #define TAU 6.28318530

      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
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
        vec2 audioDrift = vec2(sin(u_time * 0.3) * 1.5 + 1.5, sin(u_time * 0.23) * 1.5 + 1.5);
        uv += vec2(sin(u_time * 0.2), cos(u_time * 0.17)) * 0.08;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float t = u_time;

        // Rotate specimen
        float rot = t * 0.1 + u_mid * 0.8;
        float cr = cos(rot), sr = sin(rot);
        uv = vec2(uv.x * cr - uv.y * sr, uv.x * sr + uv.y * cr);

        float dist = length(uv);
        float angle = atan(uv.y, uv.x);

        // Diatom symmetry order — beat shifts it
        float symOrder = 6.0 + floor(u_beat * 4.0 + sin(t * 0.2) * 2.0);
        float symAngle = mod(angle, TAU / symOrder) - PI / symOrder;

        // Radial zones with pore patterns
        float zone1 = smoothstep(0.35 + u_bass * 0.15, 0.33, dist); // Outer wall
        float zone2 = smoothstep(0.28 + u_bass * 0.1, 0.26, dist);  // Mid zone
        float zone3 = smoothstep(0.15, 0.13, dist);                   // Center

        // Pore pattern — hexagonal grid mapped to polar coords
        float poreScale = 30.0 + u_treble * 40.0;
        vec2 poreUV = vec2(symAngle * poreScale, dist * poreScale);
        vec2 poreCell = floor(poreUV);
        vec2 poreFrac = fract(poreUV) - 0.5;

        // Hexagonal packing offset
        if (mod(poreCell.y, 2.0) > 0.5) poreFrac.x += 0.5;

        float poreDist = length(poreFrac);
        float poreSize = 0.25 + u_bass * 0.15;
        float pore = smoothstep(poreSize + 0.05, poreSize, poreDist);

        // Fine structure — treble adds inner detail
        float fineDetail = 0.0;
        if (u_treble > 0.1) {
          float fineScale = poreScale * 3.0;
          vec2 fineUV = vec2(symAngle * fineScale, dist * fineScale);
          vec2 fineCell = floor(fineUV);
          vec2 fineFrac = fract(fineUV) - 0.5;
          fineDetail = smoothstep(0.35, 0.3, length(fineFrac)) * u_treble * 0.5;
        }

        // Radial ribs — structural support beams
        float ribs = abs(sin(symAngle * symOrder * 0.5)) ;
        ribs = smoothstep(0.95, 1.0, ribs) * 0.3 * (1.0 + u_bass * 0.5);

        // Combine structure
        float structure = (zone1 - zone2 * 0.3) * (1.0 - pore * 0.6) + fineDetail + ribs;
        structure *= smoothstep(0.45 + u_bass * 0.15, 0.42, dist); // Outer boundary

        // Color — microscope illumination (DIC/phase contrast look)
        // Bass = warm (transmitted light), treble = cool (fluorescence)
        vec3 warmLight = vec3(0.9, 0.85, 0.5);
        vec3 coolFluor = vec3(0.2, 0.8, 0.5);
        vec3 silicaCol = mix(warmLight, coolFluor, u_treble * 0.7);

        // Depth of field — distance from focus creates color fringing
        float dof = smoothstep(0.0, 0.4, dist) * 0.15;
        vec3 col = silicaCol * structure * (0.5 + u_rms * 1.5);

        // Chromatic aberration at edges
        col.r *= 1.0 + dof * (1.0 + u_beat);
        col.b *= 1.0 - dof * 0.5;

        // Central raphe (diatom spine)
        float raphe = exp(-pow(abs(symAngle), 2.0) * 200.0) * smoothstep(0.3, 0.05, dist);
        col += vec3(0.4, 0.3, 0.15) * raphe * (0.5 + u_rms);

        // Beat: focus shift — background brightens, structure intensity changes
        col += vec3(0.15, 0.12, 0.05) * u_beat * 0.5;
        col *= 1.0 + u_beat * 0.5 * sin(dist * 20.0); // Interference rings on focus shift

        // Microscope circular aperture
        float aperture = smoothstep(0.48, 0.45, dist);
        col *= aperture;

        // Dark background outside aperture
        col += vec3(0.01, 0.01, 0.02) * (1.0 - aperture);

        // Kondensor light halo
        float halo = exp(-dist * dist * 8.0) * (0.1 + u_rms * 0.2);
        col += vec3(0.2, 0.18, 0.1) * halo;

        gl_FragColor = vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }`;
    try { return p.createShader(vert, frag); } catch(_) { return null; }
  }

  updateAudio(d){this.audio.bass=d.bass||0;this.audio.mid=d.mid||0;this.audio.treble=d.treble||0;this.audio.rms=d.rms||0;}
  onBeat(s){this.beatPulse=Math.min(1,s);}
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['microscope-diatom'] = MicroscopeDiatomPreset;
})();
