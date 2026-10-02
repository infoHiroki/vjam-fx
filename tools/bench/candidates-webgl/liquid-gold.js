(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;
class LiquidGoldPreset extends BasePreset {
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
        uv += vec2(sin(u_time * 0.15), cos(u_time * 0.12)) * 0.06;
        vec2 reactSeed = uv * (2.4 + u_treble * 1.6) + audioDrift;
        float reactScatter = noise(reactSeed + vec2(u_bass * 1.7, u_mid * 1.3));
        vec2 reactCenter = 0.34 * vec2(
          sin(u_time * 0.31 + u_bass * 3.14159 + reactScatter * 6.2831),
          cos(u_time * 0.27 + u_mid * 2.71828 + noise(reactSeed.yx + 4.0) * 6.2831)
        );
        float reactPulse = exp(-length(uv - reactCenter - (reactScatter - 0.5) * 0.4) * (3.2 - min(u_rms, 1.0) * 1.2));
        float t=u_time;
        float bassX3=u_bass*3.0;float midX2=u_mid*2.5;float trebleX3=u_treble*3.0;float rmsX2=u_rms*2.0;float beatX2=u_beat*2.5;
        vec2 flow=uv+vec2(fbm(uv*2.0+t*0.2)*0.2,fbm(uv*2.0+t*0.15+5.0)*0.2)*(1.0+bassX3);
        float pattern=fbm(flow*3.0+t*0.1);
        float detail=fbm(flow*8.0-t*0.2)*trebleX3*0.27;
        float surface=pattern+detail;
        vec3 darkGold=vec3(0.3,0.2,0.05);
        vec3 brightGold=vec3(1.0,0.85,0.3);
        vec3 whiteHot=vec3(1.0,0.95,0.8);
        vec3 col=mix(darkGold,brightGold,surface*(0.5+bassX3*0.33));
        col=mix(col,whiteHot,pow(surface,3.0)*rmsX2);
        float spec=pow(max(0.0,fbm(flow*6.0+t*0.3)),4.0)*(0.5+trebleX3*0.5);
        col+=vec3(1.0,0.9,0.6)*spec;
        float ripplePhase=length(uv)*20.0-t*5.0+midX2*5.0;
        float ripple=sin(ripplePhase)*0.5+0.5;
        ripple=smoothstep(0.2,0.8,ripple)*2.0-1.0;
        col+=vec3(0.5,0.4,0.1)*ripple*0.08*midX2*0.4;
        col+=vec3(1.0,0.8,0.3)*beatX2*0.2*exp(-length(uv)*2.0);
        col*=0.4+rmsX2*0.6;col*=1.0-dot(uv,uv)*0.4;
        gl_FragColor=vec4(audioReactiveFinalize(col, uv, audioHue, reactCenter, reactScatter, reactPulse), 1.0);
      }`;
    try{return p.createShader(vert,frag);}catch(_){return null;}
  }
  updateAudio(d){this.audio.bass=d.bass||0;this.audio.mid=d.mid||0;this.audio.treble=d.treble||0;this.audio.rms=d.rms||0;}
  onBeat(s){this.beatPulse=Math.min(1,s);}
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['liquid-gold'] = LiquidGoldPreset;
})();
