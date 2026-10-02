(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// VJam の 3d-textures.js から(画像を使わない形のヘルパー)
function _sphPt(i, j, dx, dy) {
  const phi = Math.PI * j / dy;
  const theta = 2 * Math.PI * i / dx;
  return {
    x: Math.sin(phi) * Math.cos(theta),
    y: -Math.cos(phi),
    z: Math.sin(phi) * Math.sin(theta),
    u: i / dx,
    v: j / dy,
  };
}

function buildSphereVerts(detailX, detailY) {
  const tris = [];
  for (let j = 0; j < detailY; j++) {
    for (let i = 0; i < detailX; i++) {
      const v00 = _sphPt(i, j, detailX, detailY);
      const v10 = _sphPt(i + 1, j, detailX, detailY);
      const v01 = _sphPt(i, j + 1, detailX, detailY);
      const v11 = _sphPt(i + 1, j + 1, detailX, detailY);
      tris.push(v00, v10, v11, v00, v11, v01);
    }
  }
  return tris;
}

function drawSphere(p, radius, verts, useTex) {
  p.beginShape(p.TRIANGLES);
  for (const v of verts) {
    if (useTex) p.vertex(v.x * radius, v.y * radius, v.z * radius, v.u, v.v);
    else p.vertex(v.x * radius, v.y * radius, v.z * radius);
  }
  p.endShape();
}

class Sphere3dPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._rotX = 0;
    this._rotY = 0;
    this._rotZ = 0;
    this._sphereVerts = null;
  }

  setup(container) {
    this.destroy();
    const preset = this;
    if (!this._sphereVerts) this._sphereVerts = buildSphereVerts(24, 16);

    this.p5 = new p5((p) => {
      p.setup = () => {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        p.createCanvas(w, h, p.WEBGL);
        p.pixelDensity(1);
      };
      p.draw = () => {
        p.background(0);
        preset.beatPulse *= 0.9;

        const bass = preset.audio.bass;
        const r = Math.min(p.width, p.height) * 0.38;
        p.camera(0, 0, (Math.min(p.width, p.height) / 2) / Math.tan(Math.PI / 6) * 1.3, 0, 0, 0, 0, 1, 0);
        const spd = 0.005 + bass * 0.015 + preset.beatPulse * 0.05;
        preset._rotX += spd * 0.5;
        preset._rotY += spd;
        preset._rotZ += spd * 0.3;
        const pulse = 1 + bass * 0.1 + preset.beatPulse * 0.2;

        p.push();
        p.rotateX(preset._rotX);
        p.rotateY(preset._rotY);
        p.rotateZ(preset._rotZ);
        p.scale(pulse);

        p.noFill();
        p.stroke(0, 255, 220);
        p.strokeWeight(1.0 + preset.beatPulse * 2);
        drawSphere(p, r, preset._sphereVerts, false);
        p.pop();
      };
      p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
    }, container);
  }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
  }

  onBeat(strength) {
    if (strength > 0.2) this.beatPulse = Math.min(1, strength);
  }

  destroy() {
    this._rotX = 0;
    this._rotY = 0;
    this._rotZ = 0;
    super.destroy();
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['3d-sphere'] = Sphere3dPreset;
})();
