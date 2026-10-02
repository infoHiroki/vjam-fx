(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;
class HoloDisplayPreset extends BasePreset {
  constructor() { super(); this.audio={bass:0,mid:0,treble:0,rms:0}; this.beatPulse=0; this._time=0; this._shader=null; }
  setup(container) {
    this.destroy(); const preset=this;
    this.p5=new p5((p)=>{
      p.setup=()=>{p.createCanvas(container.clientWidth,container.clientHeight,p.WEBGL);p.pixelDensity(1);};
      p.draw=()=>{
        if(!preset._shader){preset._shader=preset._initShader(p);if(!preset._shader)return;}
        preset._time+=0.008+preset.audio.rms*0.015; preset.beatPulse*=0.86;
        try{p.shader(preset._shader);
          preset._shader.setUniform('u_time',preset._time);
          preset._shader.setUniform('u_bass',preset.audio.bass);
          preset._shader.setUniform('u_mid',preset.audio.mid);
          preset._shader.setUniform('u_treble',preset.audio.treble);
          preset._shader.setUniform('u_rms',preset.audio.rms);
          preset._shader.setUniform('u_beat',preset.beatPulse);
          preset._shader.setUniform('u_resolution',[p.width,p.height]);
          p.noStroke();p.quad(-1,-1,1,-1,1,1,-1,1);
        }catch(e){}finally{p.resetShader();}
      };
      p.windowResized=()=>{p.resizeCanvas(container.clientWidth,container.clientHeight);};
    },container);
  }
  _initShader(p){
    const vert=`attribute vec3 aPosition;attribute vec2 aTexCoord;varying vec2 vUv;
      void main(){vUv=aTexCoord;vec4 pos=vec4(aPosition,1.0);pos.xy=pos.xy*2.0-1.0;gl_Position=pos;}`;
    const frag=`precision highp float;varying vec2 vUv;
      uniform float u_time,u_bass,u_mid,u_treble,u_rms,u_beat;uniform vec2 u_resolution;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
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
        vec2 uv=(gl_FragCoord.xy-u_resolution*0.5)/min(u_resolution.x,u_resolution.y);
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
        float t=u_time;
        float scan=sin(gl_FragCoord.y*2.0+t*5.0)*0.5+0.5;
        float holoNoise=fbm(uv*3.0+t*0.2)*(0.5+u_bass*1.0);
        float grid=max(smoothstep(0.48,0.5,abs(fract(uv.x*8.0+u_mid)-0.5)),
                      smoothstep(0.48,0.5,abs(fract(uv.y*8.0)-0.5)));
        float shape=smoothstep(0.4+u_bass*0.1,0.35,length(uv));
        shape*=1.0+sin(atan(uv.y,uv.x)*6.0+t+u_treble*5.0)*0.3*u_treble;
        vec3 holoCol=vec3(0.1,0.6,0.9)*(0.5+u_rms);
        holoCol+=vec3(0.0,0.3,0.1)*grid*0.5;
        holoCol*=shape;holoCol*=0.8+scan*0.4;
        holoCol+=holoNoise*vec3(0.1,0.2,0.3)*u_treble;
        holoCol+=vec3(0.5,0.8,1.0)*u_beat*0.5*shape;
        float flicker=0.9+0.1*sin(t*30.0)*u_treble;
        holoCol*=flicker;holoCol*=0.5+u_rms*1.5;
        gl_FragColor=vec4(audioReactiveFinalize(holoCol, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }`;
    try{return p.createShader(vert,frag);}catch(_){return null;}
  }
  updateAudio(d){this.audio.bass=d.bass||0;this.audio.mid=d.mid||0;this.audio.treble=d.treble||0;this.audio.rms=d.rms||0;}
  onBeat(s){this.beatPulse=Math.min(1,s);}
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['holo-display'] = HoloDisplayPreset;
})();
