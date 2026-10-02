import { isWebglPreset, parseImports, skipReason, extractFunction, convert } from './convert-webgl.mjs';

// VJam のプリセットの形(ES module)
const preset = (body = '', imports = '') => `import BasePreset from '../base-preset.js';
${imports}
export default class FooPreset extends BasePreset {
  setup(container) {
    this.p5 = new p5((p) => {
      p.setup = () => { p.createCanvas(10, 10, p.WEBGL); };
      p.draw = () => { ${body} };
    }, container);
  }
}
`;

const TEXTURES = `// Shared texture loading + geometry helpers
export function loadTexture(name) {
  const img = new Image();
  return img;
}

function _sphPt(i, j, dx, dy) {
  return { x: i / dx, y: j / dy };
}

export function buildSphereVerts(detailX, detailY) {
  const tris = [];
  for (let j = 0; j < detailY; j++) {
    tris.push(_sphPt(0, j, detailX, detailY));
  }
  return tris;
}

export function drawSphere(p, radius, verts, useTex) {
  for (const v of verts) p.vertex(v.x * radius, v.y * radius);
}

export const texturesReady = Promise.resolve();
`;

describe('対象', () => {
  it('export default class があって WEBGL を使うものだけ', () => {
    expect(isWebglPreset(preset())).toBe(true);
    expect(isWebglPreset(preset().replace('p.WEBGL', 'p.P2D'))).toBe(false);
    expect(isWebglPreset('export function helper() { return p.WEBGL; }')).toBe(false);
  });

  it('import を拾う(default と名前付き)', () => {
    const list = parseImports(preset('', "import { buildSphereVerts, drawSphere } from './3d-textures.js';"));
    expect(list.map(i => [i.names, i.from])).toEqual([
      [['default'], '../base-preset.js'],
      [['buildSphereVerts', 'drawSphere'], './3d-textures.js'],
    ]);
    // 行末の改行は含めない(置き換えで前後の空行を食わない)
    expect(list[0].line).toBe("import BasePreset from '../base-preset.js';");
  });
});

describe('外すもの', () => {
  it('名前: learn-* / promo-* / cctv-* / tv-emergency', () => {
    for (const name of ['learn-3d-spin', 'promo-banner', 'cctv-grid', 'tv-emergency']) {
      expect(skipReason(name, preset())).toBe('name');
    }
    expect(skipReason('tv-emergency-2', preset())).toBe(null);
  });

  it('FX の content/presets に同じ名前があるもの', () => {
    expect(skipReason('aurora', preset(), new Set(['aurora']))).toBe('in-fx');
  });

  it('画像・動画が要るもの', () => {
    for (const body of ['p.loadImage(url);', 'p.createVideo(url);', 'p.createCapture(p.VIDEO);', 'const img = new Image();',
      "document.createElement('video');"]) {
      expect(skipReason('foo', preset(body))).toBe('image');
    }
    expect(skipReason('foo', preset('', "import { getP5Texture, texturesReady } from './3d-textures.js';"))).toBe('image');
    expect(skipReason('foo', preset('', "import { ImageCache } from '../../utils/image-cache.js';"))).toBe('image');
    expect(skipReason('foo', preset('', "import { FluidWarpCore } from './fluid-warp-core.js';"))).toBe('image');
  });

  it('three.js が要るもの', () => {
    expect(skipReason('foo', preset('', "import * as THREE from 'three';"))).toBe('three');
  });

  it('写し方の分からない import', () => {
    expect(skipReason('foo', preset('', "import { thing } from './other-core.js';"))).toBe('import');
  });

  it('3d-textures の画像を使わない形のヘルパーだけなら残す', () => {
    expect(skipReason('foo', preset('', "import { buildSphereVerts, drawSphere } from './3d-textures.js';"))).toBe(null);
    expect(skipReason('foo', preset('drawSphere(p, 1, verts, false);'))).toBe(null);
  });
});

describe('変換', () => {
  it('bench/candidates と同じ形: IIFE、BasePreset は window.VJamFX から、末尾でファイル名で登録', () => {
    const out = convert('foo-bar', preset('p.background(0);'));
    expect(out.startsWith("(function() {\n'use strict';\nconst BasePreset = window.VJamFX.BasePreset;\n\nclass FooPreset extends BasePreset {")).toBe(true);
    expect(out.endsWith("}\n\nwindow.VJamFX = window.VJamFX || { presets: {} };\nwindow.VJamFX.presets['foo-bar'] = FooPreset;\n})();\n")).toBe(true);
    expect(out).not.toMatch(/^\s*(import|export)\b/m);
  });

  it('動かすと window.VJamFX.presets に入る', () => {
    const win = { VJamFX: { presets: {}, BasePreset: class {} } };
    new Function('window', convert('foo-bar', preset()))(win);
    const Cls = win.VJamFX.presets['foo-bar'];
    expect(Object.getPrototypeOf(Cls)).toBe(win.VJamFX.BasePreset);
    expect(typeof Cls.prototype.setup).toBe('function');
  });

  it('3d-textures のヘルパーは中に写す(_sphPt も一緒に)', () => {
    const out = convert('sphere', preset('drawSphere(p, 1, buildSphereVerts(2, 2), false);',
      "import { buildSphereVerts, drawSphere } from './3d-textures.js';"), TEXTURES);
    expect(out).not.toContain('3d-textures.js\';');
    expect(out).toContain('function _sphPt(i, j, dx, dy) {');
    expect(out).toContain('function buildSphereVerts(detailX, detailY) {');
    expect(out).toContain('function drawSphere(p, radius, verts, useTex) {');
    expect(out).not.toContain('loadTexture');
    expect(out.indexOf('function _sphPt')).toBeLessThan(out.indexOf('function buildSphereVerts'));
    expect(out.indexOf('function drawSphere')).toBeLessThan(out.indexOf('class FooPreset'));
    const win = { VJamFX: { presets: {}, BasePreset: class {} } };
    expect(() => new Function('window', out)(win)).not.toThrow();
  });

  it('関数の抜き出しは閉じ括弧(行頭の })まで', () => {
    expect(extractFunction(TEXTURES, '_sphPt')).toBe('function _sphPt(i, j, dx, dy) {\n  return { x: i / dx, y: j / dy };\n}');
    expect(extractFunction(TEXTURES, 'drawSphere').startsWith('function drawSphere(')).toBe(true);
    expect(() => extractFunction(TEXTURES, 'missing')).toThrow();
  });

  it('写せないものは投げる', () => {
    expect(() => convert('foo', preset('', "import { thing } from './other-core.js';"))).toThrow(/other-core/);
    expect(() => convert('foo', 'class X {}')).toThrow(/export default class/);
  });
});
