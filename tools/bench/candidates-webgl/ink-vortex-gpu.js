(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// ink-vortex-gpu — 本物の Navier-Stokes ソルバ(Stable Fluids / Jos Stam)で
// インクが音に渦巻く。リポジトリ初のマルチパス GPU プリセット。
//
// 毎フレームのパス構成(約30ドローコール、全て縮小解像度の float FBO):
//   ①速度の移流(semi-Lagrangian) → ②外力(スプラット+回転トルク+浮力)
//   → ③渦度強化(curl 計算 + confinement) → ④発散 → ⑤Jacobi 圧力解×22
//   → ⑥圧力勾配の減算(非圧縮化) → ⑦染料の移流 → ⑧染料スプラット → ⑨シェーディング描画
//
// 音: beat=軌道上を回る位置にインク射出(色相は黄金角で回る) /
// 強拍=中央大スプラット+色相ジャンプ+渦キック / bass=浮力(インクが立ち昇る)+射出量 /
// mid=全体の回転トルク / treble=渦度強化ε(小渦が鋭く) / rms=染料の残留(盛り上がると色が残る)。
// 染料は密度勾配から擬似法線を立ててインクの「照り」(スペキュラ)を出す。

const SIM_DIV = 4;    // 速度場の縮小率
const DYE_DIV = 2;    // 染料場の縮小率
const JACOBI = 22;    // 圧力反復回数

const VERT = `
precision highp float;
attribute vec3 aPosition;
void main() { gl_Position = vec4(aPosition, 1.0); }
`;

const FRAG_ADVECT = `
precision highp float;
uniform sampler2D u_vel;
uniform sampler2D u_src;
uniform vec2 u_texel;      // 書き込み先の texel
uniform vec2 u_simTexel;   // 速度場の texel(速度は「速度場texel/秒」単位)
uniform float u_dt;
uniform float u_diss;
void main() {
  vec2 uv = gl_FragCoord.xy * u_texel;
  vec2 vel = texture2D(u_vel, uv).xy;
  vec2 back = uv - vel * u_dt * u_simTexel;
  gl_FragColor = vec4(texture2D(u_src, back).rgb * u_diss, 1.0);
}
`;

const FRAG_FORCES = `
precision highp float;
uniform sampler2D u_vel;
uniform sampler2D u_dye;
uniform vec2 u_texel;
uniform float u_dt;
uniform float u_aspect;
uniform float u_swirl;     // mid: 中心まわりの回転トルク(符号で回転方向が変わる)
uniform float u_buoy;      // bass: 浮力
uniform vec2 u_buoyDir;    // 浮力の軸(ゆっくり彷徨い、強拍でジャンプ)
uniform float u_flow;      // 大規模カールノイズ流の強さ
uniform float u_time;
uniform int u_count;
uniform vec3 u_splat[4];   // xy=位置(uv) z=半径(uv)
uniform vec2 u_splatF[4];  // 力(速度texel/秒)
void main() {
  vec2 uv = gl_FragCoord.xy * u_texel;
  vec2 v = texture2D(u_vel, uv).xy;
  // 回転トルク(中心から離れると減衰)
  vec2 d = uv - vec2(0.5);
  d.x *= u_aspect;
  float r = length(d) + 1e-4;
  v += (vec2(-d.y, d.x) / r) * u_swirl * exp(-r * 2.2) * u_dt;
  // 大規模な多方向の流れ場(時間で向きが変わる大渦 = 一方向に流れ続けない)
  vec2 flow = vec2(
    sin(uv.y * 5.3 + u_time * 0.41 + sin(u_time * 0.10) * 2.2),
    cos(uv.x * 4.1 - u_time * 0.34 + sin(u_time * 0.13) * 2.2)
  );
  flow += 0.55 * vec2(
    sin(uv.y * 11.0 - u_time * 0.77 + 1.7),
    cos(uv.x * 9.0 + u_time * 0.66)
  );
  v += flow * u_flow * u_dt;
  // 浮力: 染料が濃いところが u_buoyDir の方へ流れ出す
  float rho = dot(texture2D(u_dye, uv).rgb, vec3(0.333));
  v += u_buoyDir * (u_buoy * min(rho, 1.5)) * u_dt;
  // スプラット(ガウス状の力)
  for (int i = 0; i < 4; i++) {
    if (i < u_count) {
      vec2 dd = uv - u_splat[i].xy;
      dd.x *= u_aspect;
      float g = exp(-dot(dd, dd) / (u_splat[i].z * u_splat[i].z));
      v += u_splatF[i] * g * u_dt;
    }
  }
  // 縁で減衰(壁に溜まらない)
  vec2 e = min(uv, 1.0 - uv);
  v *= mix(0.6, 1.0, smoothstep(0.0, 0.03, min(e.x, e.y)));
  gl_FragColor = vec4(v, 0.0, 1.0);
}
`;

const FRAG_CURL = `
precision highp float;
uniform sampler2D u_vel;
uniform vec2 u_texel;
void main() {
  vec2 uv = gl_FragCoord.xy * u_texel;
  float L = texture2D(u_vel, uv - vec2(u_texel.x, 0.0)).y;
  float R = texture2D(u_vel, uv + vec2(u_texel.x, 0.0)).y;
  float B = texture2D(u_vel, uv - vec2(0.0, u_texel.y)).x;
  float T = texture2D(u_vel, uv + vec2(0.0, u_texel.y)).x;
  gl_FragColor = vec4(0.5 * ((R - L) - (T - B)), 0.0, 0.0, 1.0);
}
`;

const FRAG_VORTICITY = `
precision highp float;
uniform sampler2D u_vel;
uniform sampler2D u_curl;
uniform vec2 u_texel;
uniform float u_dt;
uniform float u_eps;   // treble: confinement 強度
void main() {
  vec2 uv = gl_FragCoord.xy * u_texel;
  float L = abs(texture2D(u_curl, uv - vec2(u_texel.x, 0.0)).x);
  float R = abs(texture2D(u_curl, uv + vec2(u_texel.x, 0.0)).x);
  float B = abs(texture2D(u_curl, uv - vec2(0.0, u_texel.y)).x);
  float T = abs(texture2D(u_curl, uv + vec2(0.0, u_texel.y)).x);
  float C = texture2D(u_curl, uv).x;
  vec2 n = normalize(vec2(R - L, T - B) + 1e-5);
  vec2 force = u_eps * C * vec2(n.y, -n.x);
  vec2 v = texture2D(u_vel, uv).xy + force * u_dt;
  gl_FragColor = vec4(v, 0.0, 1.0);
}
`;

const FRAG_DIVERGENCE = `
precision highp float;
uniform sampler2D u_vel;
uniform vec2 u_texel;
void main() {
  vec2 uv = gl_FragCoord.xy * u_texel;
  float L = texture2D(u_vel, uv - vec2(u_texel.x, 0.0)).x;
  float R = texture2D(u_vel, uv + vec2(u_texel.x, 0.0)).x;
  float B = texture2D(u_vel, uv - vec2(0.0, u_texel.y)).y;
  float T = texture2D(u_vel, uv + vec2(0.0, u_texel.y)).y;
  gl_FragColor = vec4(0.5 * ((R - L) + (T - B)), 0.0, 0.0, 1.0);
}
`;

const FRAG_PRESSURE = `
precision highp float;
uniform sampler2D u_pre;
uniform sampler2D u_div;
uniform vec2 u_texel;
void main() {
  vec2 uv = gl_FragCoord.xy * u_texel;
  float L = texture2D(u_pre, uv - vec2(u_texel.x, 0.0)).x;
  float R = texture2D(u_pre, uv + vec2(u_texel.x, 0.0)).x;
  float B = texture2D(u_pre, uv - vec2(0.0, u_texel.y)).x;
  float T = texture2D(u_pre, uv + vec2(0.0, u_texel.y)).x;
  float div = texture2D(u_div, uv).x;
  gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}
`;

const FRAG_GRADSUB = `
precision highp float;
uniform sampler2D u_vel;
uniform sampler2D u_pre;
uniform vec2 u_texel;
void main() {
  vec2 uv = gl_FragCoord.xy * u_texel;
  float L = texture2D(u_pre, uv - vec2(u_texel.x, 0.0)).x;
  float R = texture2D(u_pre, uv + vec2(u_texel.x, 0.0)).x;
  float B = texture2D(u_pre, uv - vec2(0.0, u_texel.y)).x;
  float T = texture2D(u_pre, uv + vec2(0.0, u_texel.y)).x;
  vec2 v = texture2D(u_vel, uv).xy - 0.5 * vec2(R - L, T - B);
  gl_FragColor = vec4(v, 0.0, 1.0);
}
`;

const FRAG_SPLAT_DYE = `
precision highp float;
uniform sampler2D u_dye;
uniform vec2 u_texel;
uniform float u_aspect;
uniform int u_count;
uniform vec3 u_splat[4];   // xy=位置 z=半径
uniform vec3 u_splatC[4];  // 色(加算)
void main() {
  vec2 uv = gl_FragCoord.xy * u_texel;
  vec3 c = texture2D(u_dye, uv).rgb;
  for (int i = 0; i < 4; i++) {
    if (i < u_count) {
      vec2 dd = uv - u_splat[i].xy;
      dd.x *= u_aspect;
      float g = exp(-dot(dd, dd) / (u_splat[i].z * u_splat[i].z));
      c += u_splatC[i] * g;
    }
  }
  gl_FragColor = vec4(min(c, vec3(2.5)), 1.0);
}
`;

const FRAG_RENDER = `
precision highp float;
uniform sampler2D u_dye;
uniform vec2 u_texel;      // 画面の texel
uniform vec2 u_dyeTexel;
uniform float u_gain;      // beat の瞬間ゲイン
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy * u_texel;
  vec3 d = texture2D(u_dye, uv).rgb;
  float rho = dot(d, vec3(0.299, 0.587, 0.114));
  // 密度勾配 → 擬似法線 → インクの照り
  float rL = dot(texture2D(u_dye, uv - vec2(u_dyeTexel.x, 0.0)).rgb, vec3(0.333));
  float rR = dot(texture2D(u_dye, uv + vec2(u_dyeTexel.x, 0.0)).rgb, vec3(0.333));
  float rB = dot(texture2D(u_dye, uv - vec2(0.0, u_dyeTexel.y)).rgb, vec3(0.333));
  float rT = dot(texture2D(u_dye, uv + vec2(0.0, u_dyeTexel.y)).rgb, vec3(0.333));
  vec3 n = normalize(vec3((rL - rR) * 4.0, (rB - rT) * 4.0, 1.0));
  vec3 Ldir = normalize(vec3(-0.35, 0.55, 0.75));
  float diff = 0.55 + 0.45 * max(dot(n, Ldir), 0.0);
  float spec = pow(max(dot(reflect(-Ldir, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  // トーンマップ(HDR染料を滑らかに圧縮)
  vec3 col = (d * 1.55 / (1.0 + rho * 0.30)) * diff * u_gain;
  col += vec3(1.0, 0.98, 0.92) * spec * min(rho, 1.2) * 0.7;
  // 背景: ほぼ黒 + かすかな深い青の底光り
  vec2 c = uv - vec2(0.5);
  float vig = 1.0 - dot(c, c) * 0.9;
  vec3 bg = vec3(0.012, 0.014, 0.030) * (0.7 + 0.3 * sin(u_time * 0.11)) * vig;
  col = bg + col * vig;
  gl_FragColor = vec4(col, 1.0);
}
`;

class InkVortexGpuPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._time = 0;
    this._smooth = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this._hue = Math.random();
    this._orbit = Math.random() * Math.PI * 2;
    this._splats = [];        // {x,y,fx,fy,r,cr,cg,cb}
    this._ambientAt = 0;
    this._epsKick = 0;        // 強拍後の渦キック
    this._buoyAngle = Math.PI / 2;   // 浮力の軸(彷徨う)
    this._buoySpin = 0.15;
    this._swirlDir = 1;              // 回転方向(±1 へ滑らかに遷移)
    this._swirlTarget = 1;
    this._wanderAt = 0;
    this._failed = false;
  }

  updateAudio(d) {
    this.audio.bass = d.bass || 0;
    this.audio.mid = d.mid || 0;
    this.audio.treble = d.treble || 0;
    this.audio.rms = d.rms || 0;
  }

  onBeat(s) {
    const str = Math.min(1, s || 0.5);
    this.beatPulse = str;
    const strong = str > 0.85;
    // 色相は黄金角で回す(隣り合う色が濁らない)。強拍は大きくジャンプ
    this._hue = (this._hue + (strong ? 0.38 : 0.118)) % 1;
    this._orbit += 2.4;
    const [r, g, b] = hsb2rgb(this._hue, 0.9, 1.0);
    if (strong) {
      // 大爆発は浮力軸の方向へ吹く + 流れの向きがガラッと変わる
      const bx = Math.cos(this._buoyAngle), by = Math.sin(this._buoyAngle);
      this._splats.push({ x: 0.5, y: 0.42, fx: bx * 520, fy: by * 520, r: 0.13 + str * 0.05, cr: r * 3.6, cg: g * 3.6, cb: b * 3.6 });
      this._epsKick = 1.4;
      this._buoyAngle += (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.4);
      if (Math.random() < 0.6) this._swirlTarget *= -1;
    } else {
      // 補色ペアを軌道の対角に射出(混ざり際が濁らず燃える)
      const [r2, g2, b2] = hsb2rgb((this._hue + 0.5) % 1, 0.85, 0.95);
      const outX = Math.cos(this._orbit), outY = Math.sin(this._orbit);
      const F = 320 + str * 480;
      this._splats.push({
        x: 0.5 + outX * 0.24, y: 0.44 + outY * 0.20,
        fx: (outX * 0.4 - outY) * F, fy: (outY * 0.4 + outX) * F,
        r: 0.05 + str * 0.05,
        cr: r * 2.6, cg: g * 2.6, cb: b * 2.6,
      });
      this._splats.push({
        x: 0.5 - outX * 0.24, y: 0.44 - outY * 0.20,
        fx: -(outX * 0.4 - outY) * F * 0.8, fy: -(outY * 0.4 + outX) * F * 0.8,
        r: 0.04 + str * 0.04,
        cr: r2 * 1.8, cg: g2 * 1.8, cb: b2 * 1.8,
      });
    }
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      let sh = {};             // コンパイル済みシェーダー
      let vel, pre, dye;       // ping-pong FBO ペア
      let div, curl;           // 単発 FBO
      let simW, simH, dyeW, dyeH;

      const makeFbo = (w, h) => {
        // float → 半精度の順で試す(モバイル対策)
        for (const format of ['float', 'half-float']) {
          try {
            return p.createFramebuffer({
              width: w, height: h, format,
              textureFiltering: 'linear', depth: false, antialias: false, density: 1,
            });
          } catch (e) { /* 次の形式へ */ }
        }
        return null;
      };

      const makePair = (w, h) => {
        const a = makeFbo(w, h), b = makeFbo(w, h);
        if (!a || !b) return null;
        return { read: a, write: b, swap() { const t = this.read; this.read = this.write; this.write = t; } };
      };

      const layout = () => {
        const W = p.width, H = p.height;
        simW = Math.max(96, Math.round(W / SIM_DIV));
        simH = Math.max(54, Math.round(H / SIM_DIV));
        dyeW = Math.max(192, Math.round(W / DYE_DIV));
        dyeH = Math.max(108, Math.round(H / DYE_DIV));
        vel = makePair(simW, simH);
        pre = makePair(simW, simH);
        dye = makePair(dyeW, dyeH);
        div = makeFbo(simW, simH);
        curl = makeFbo(simW, simH);
        if (!vel || !pre || !dye || !div || !curl) preset._failed = true;
      };

      const compile = () => {
        try {
          sh.advect = p.createShader(VERT, FRAG_ADVECT);
          sh.forces = p.createShader(VERT, FRAG_FORCES);
          sh.curl = p.createShader(VERT, FRAG_CURL);
          sh.vort = p.createShader(VERT, FRAG_VORTICITY);
          sh.dive = p.createShader(VERT, FRAG_DIVERGENCE);
          sh.press = p.createShader(VERT, FRAG_PRESSURE);
          sh.grad = p.createShader(VERT, FRAG_GRADSUB);
          sh.splat = p.createShader(VERT, FRAG_SPLAT_DYE);
          sh.render = p.createShader(VERT, FRAG_RENDER);
        } catch (e) {
          preset._failed = true;
        }
      };

      // 1パス実行: shader を当てて target(FBO or 画面)に全面クアッドを描く
      const pass = (shader, target, uniforms) => {
        if (target) target.begin();
        p.shader(shader);
        for (const k in uniforms) shader.setUniform(k, uniforms[k]);
        p.noStroke();
        p.quad(-1, -1, 1, -1, 1, 1, -1, 1);
        if (target) target.end();
      };

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL);
        p.pixelDensity(1);
        compile();
        layout();
      };

      p.draw = () => {
        p.background(0);
        if (preset._failed) return;
        const dt = Math.min(0.033, (p.deltaTime || 16.7) / 1000);
        const f = dt * 60;
        preset._time += dt;
        preset.beatPulse *= Math.pow(0.90, f);
        preset._epsKick *= Math.pow(0.94, f);
        for (const k of ['bass', 'mid', 'treble', 'rms']) {
          preset._smooth[k] += (preset.audio[k] - preset._smooth[k]) * 0.12;
        }
        const s = preset._smooth;
        const aspect = p.width / p.height;
        const simTexel = [1 / simW, 1 / simH];
        const dyeTexel = [1 / dyeW, 1 / dyeH];

        // 流れの向きを彷徨わせる(数秒ごとに浮力軸の回転速度と渦の向きを引き直す)
        if (preset._time > preset._wanderAt) {
          preset._wanderAt = preset._time + 5 + Math.random() * 5;
          preset._buoySpin = (Math.random() - 0.5) * 0.9;
          if (Math.random() < 0.5) preset._swirlTarget = Math.random() < 0.5 ? -1 : 1;
        }
        preset._buoyAngle += preset._buoySpin * dt;
        preset._swirlDir += (preset._swirlTarget - preset._swirlDir) * Math.min(1, 0.02 * f);

        // 自律スプラット: 無音時は「消えない程度」に控えめ、音が入るほど活発に
        const act = Math.min(1, Math.max(s.rms, s.bass * 0.7));
        if (preset._time > preset._ambientAt) {
          preset._ambientAt = preset._time + (1.2 + Math.random() * 1.6) * (1.9 - act);
          const a = Math.random() * Math.PI * 2;
          const amp = 0.35 + act * 0.9;
          const [r, g, b] = hsb2rgb((preset._hue + Math.random() * 0.15) % 1, 0.85, 0.9);
          preset._splats.push({
            x: 0.5 + Math.cos(a) * (0.1 + Math.random() * 0.25),
            y: 0.35 + Math.random() * 0.3,
            fx: (Math.random() - 0.5) * 340 * amp,
            fy: (Math.random() - 0.3) * 340 * amp,
            r: 0.03 + Math.random() * 0.035,
            cr: r * 1.7 * amp, cg: g * 1.7 * amp, cb: b * 1.7 * amp,
          });
        }

        // 今フレームぶんのスプラット(最大4)を uniform 配列に詰める
        const batch = preset._splats.splice(0, 4);
        const splatPos = [], splatF = [], splatC = [];
        for (const q of batch) {
          splatPos.push(q.x, q.y, q.r);
          splatF.push(q.fx, q.fy);
          splatC.push(q.cr, q.cg, q.cb);
        }
        while (splatPos.length < 12) splatPos.push(0, 0, 1);
        while (splatF.length < 8) splatF.push(0, 0);
        while (splatC.length < 12) splatC.push(0, 0, 0);

        // ① 速度の移流
        pass(sh.advect, vel.write, {
          u_vel: vel.read, u_src: vel.read,
          u_texel: simTexel, u_simTexel: simTexel,
          u_dt: dt, u_diss: Math.pow(0.9990, f),
        });
        vel.swap();
        // ② 外力(スプラット + 回転トルク + 浮力)
        pass(sh.forces, vel.write, {
          u_vel: vel.read, u_dye: dye.read,
          u_texel: simTexel, u_dt: dt, u_aspect: aspect, u_time: preset._time,
          u_swirl: (0.15 + s.mid * 3.9) * preset._swirlDir,
          u_buoy: 6 + s.bass * 190,
          u_buoyDir: [Math.cos(preset._buoyAngle), Math.sin(preset._buoyAngle)],
          u_flow: 3 + s.mid * 22 + s.rms * 16,
          u_count: batch.length, u_splat: splatPos, u_splatF: splatF,
        });
        vel.swap();
        // ③ 渦度強化(treble で小渦が鋭く、強拍後はキック)
        pass(sh.curl, curl, { u_vel: vel.read, u_texel: simTexel });
        pass(sh.vort, vel.write, {
          u_vel: vel.read, u_curl: curl, u_texel: simTexel, u_dt: dt,
          u_eps: 6 + s.treble * 26 + preset._epsKick * 22,
        });
        vel.swap();
        // ④⑤⑥ 非圧縮化(発散 → Jacobi 圧力 → 勾配減算)
        pass(sh.dive, div, { u_vel: vel.read, u_texel: simTexel });
        for (let i = 0; i < JACOBI; i++) {
          pass(sh.press, pre.write, { u_pre: pre.read, u_div: div, u_texel: simTexel });
          pre.swap();
        }
        pass(sh.grad, vel.write, { u_vel: vel.read, u_pre: pre.read, u_texel: simTexel });
        vel.swap();
        // ⑦ 染料の移流(rms が高いほど色が残る)
        pass(sh.advect, dye.write, {
          u_vel: vel.read, u_src: dye.read,
          u_texel: dyeTexel, u_simTexel: simTexel,
          u_dt: dt, u_diss: Math.pow(0.9915 + s.rms * 0.006, f),
        });
        dye.swap();
        // ⑧ 染料スプラット
        if (batch.length > 0) {
          pass(sh.splat, dye.write, {
            u_dye: dye.read, u_texel: dyeTexel, u_aspect: aspect,
            u_count: batch.length, u_splat: splatPos, u_splatC: splatC,
          });
          dye.swap();
        }
        // ⑨ シェーディングして画面へ
        pass(sh.render, null, {
          u_dye: dye.read,
          u_texel: [1 / p.width, 1 / p.height], u_dyeTexel: dyeTexel,
          u_gain: 1.0 + preset.beatPulse * 0.35,
          u_time: preset._time,
        });
        p.resetShader();
      };
    }, container);
  }
}

// HSB → RGB(0..1)
function hsb2rgb(h, sat, br) {
  const i = Math.floor(h * 6);
  const fr = h * 6 - i;
  const pp = br * (1 - sat);
  const q = br * (1 - fr * sat);
  const t = br * (1 - (1 - fr) * sat);
  switch (i % 6) {
    case 0: return [br, t, pp];
    case 1: return [q, br, pp];
    case 2: return [pp, br, t];
    case 3: return [pp, q, br];
    case 4: return [t, pp, br];
    default: return [br, pp, q];
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['ink-vortex-gpu'] = InkVortexGpuPreset;
})();
