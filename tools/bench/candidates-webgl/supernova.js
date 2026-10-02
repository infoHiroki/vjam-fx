(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SupernovaPreset extends BasePreset {
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
        preset._time += 0.01 + preset.audio.rms * 0.02;
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
      float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=noise(p)*a;p*=2.1;a*=0.5;}return v;}

      void main(){
        vec2 uv=(gl_FragCoord.xy-u_resolution*0.5)/min(u_resolution.x,u_resolution.y);
        float t=u_time;
        float dist=length(uv);

        // Core — bright with bass
        float core=exp(-dist*(4.0-u_bass*3.0))*(1.5+u_bass*2.0+u_beat*1.5);

        // Shockwave rings — expand with time, beat spawns new ones
        float ring1=abs(dist-fract(t*0.3+u_beat*0.5)*1.5);
        float ring2=abs(dist-fract(t*0.2+0.5)*1.2);
        float ring3=abs(dist-fract(t*0.15+0.3)*1.8);
        float rings=exp(-ring1*(15.0-u_mid*8.0))+exp(-ring2*(12.0-u_mid*6.0))+exp(-ring3*(18.0-u_treble*10.0));
        rings*=0.5+u_rms*1.0;

        // Nebula gas — treble drives turbulence
        float angle=atan(uv.y,uv.x);
        float nebula=fbm(vec2(angle*2.0+t*0.3,dist*4.0-t*0.5)*1.5);
        nebula+=fbm(vec2(angle*3.0-t*0.2,dist*6.0+t*0.3))*0.5*u_treble;
        float nebulaGlow=nebula*exp(-dist*1.5)*(0.4+u_treble*1.2);

        // Debris jets — mid drives asymmetry
        float jet1=exp(-abs(uv.y-uv.x*u_mid*0.5)*(8.0-u_mid*4.0))*exp(-dist*2.0);
        float jet2=exp(-abs(uv.y+uv.x*u_mid*0.5)*(8.0-u_mid*4.0))*exp(-dist*2.0);
        float jets=(jet1+jet2)*(0.3+u_mid*1.0+u_beat*0.5);

        // Color
        vec3 coreCol=mix(vec3(1.0,0.95,0.8),vec3(1.0,0.5,0.2),dist*2.0)*core;
        vec3 ringCol=mix(vec3(0.3,0.5,1.0),vec3(0.8,0.3,0.9),u_treble)*rings;
        vec3 nebulaCol=mix(vec3(0.8,0.2,0.1),vec3(0.2,0.1,0.6),nebula)*nebulaGlow;
        vec3 jetCol=vec3(0.9,0.7,0.3)*jets;

        vec3 col=coreCol+ringCol+nebulaCol+jetCol;

        // Beat flash
        col+=vec3(1.0,0.9,0.7)*u_beat*0.4*exp(-dist*3.0);

        // Star field background — drifting and twinkling
        vec2 starUv=gl_FragCoord.xy*0.5;
        starUv+=vec2(sin(t*0.12)*8.0, cos(t*0.09)*6.0); // slow drift
        float stars=step(0.997,hash(floor(starUv)));
        float twinkle=0.5+0.5*sin(hash(floor(starUv))*100.0+t*3.0); // per-star twinkle
        col+=vec3(stars)*twinkle*(0.4+u_rms*0.6);

        gl_FragColor=vec4(col,1.0);
      }`;
    try{return p.createShader(vert,frag);}catch(_){return null;}
  }

  updateAudio(d){this.audio.bass=d.bass||0;this.audio.mid=d.mid||0;this.audio.treble=d.treble||0;this.audio.rms=d.rms||0;}
  onBeat(s){this.beatPulse=Math.min(1,s);}
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['supernova'] = SupernovaPreset;
})();
