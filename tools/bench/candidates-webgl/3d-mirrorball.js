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

class Mirrorball3dPreset extends BasePreset {
  constructor() {
    super();
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this._rotY = 0;
    this._mirrorFaces = null;
  }

  _initMirrorBall() {
    const verts = buildSphereVerts(12, 10);
    const faces = [];
    for (let i = 0; i < verts.length; i += 3) {
      faces.push({
        v: [verts[i], verts[i + 1], verts[i + 2]],
        hue: Math.random() * 360,
        flash: 0,
      });
    }
    return faces;
  }

  setup(container) {
    this.destroy();
    const preset = this;

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

        if (!preset._mirrorFaces) preset._mirrorFaces = preset._initMirrorBall();

        const bass = preset.audio.bass;
        const mid = preset.audio.mid;
        const treble = preset.audio.treble;
        const r = Math.min(p.width, p.height) * 0.38;
        p.camera(0, 0, (Math.min(p.width, p.height) / 2) / Math.tan(Math.PI / 6) * 1.3, 0, 0, 0, 0, 1, 0);
        const spd = 0.008 + bass * 0.03 + preset.beatPulse * 0.08;
        preset._rotY += spd;
        const tiltX = 0.2 + Math.sin(p.frameCount * 0.008) * 0.1;

        // Beat flash random faces
        if (preset.beatPulse > 0.2) {
          const count = Math.floor(8 + preset.beatPulse * 20);
          for (let i = 0; i < count; i++) {
            const idx = Math.floor(Math.random() * preset._mirrorFaces.length);
            preset._mirrorFaces[idx].flash = 0.7 + Math.random() * 0.3;
          }
        }

        p.push();
        p.rotateX(tiltX);
        p.rotateY(preset._rotY);
        p.scale(1 + preset.beatPulse * 0.15);

        p.colorMode(p.HSB, 360, 100, 100, 255);

        // Draw faces with separators
        p.stroke(0, 0, 30, 100);
        p.strokeWeight(0.4);
        p.beginShape(p.TRIANGLES);
        for (const face of preset._mirrorFaces) {
          face.flash *= 0.82;
          const hue = (face.hue + p.frameCount * 0.5) % 360;

          if (face.flash > 0.05) {
            const sat = 15 * (1 - face.flash);
            const bri = 70 + face.flash * 30;
            p.fill(hue, sat, bri, 250);
          } else {
            p.fill(hue, 55, 40 + mid * 30 + bass * 15, 220);
          }
          for (const v of face.v) {
            p.vertex(v.x * r, v.y * r, v.z * r);
          }
        }
        p.endShape();

        // Radial light rays
        const rayCount = Math.floor(8 + mid * 16 + preset.beatPulse * 15);
        for (let i = 0; i < rayCount; i++) {
          const a1 = p.frameCount * 0.025 + i * 6.2832 / rayCount;
          const a2 = p.frameCount * 0.012 + i * 2.3;
          const dx = Math.cos(a1) * Math.sin(a2);
          const dy = Math.sin(a1) * Math.sin(a2);
          const dz = Math.cos(a2);
          const rayHue = (i * 30 + p.frameCount * 0.8) % 360;
          const rayAlpha = 40 + preset.beatPulse * 140 + treble * 40;
          p.stroke(rayHue, 40, 100, rayAlpha);
          p.strokeWeight(0.5 + preset.beatPulse * 2.5 + Math.sin(i * 1.7) * 0.5);
          const len = r * (1.8 + preset.beatPulse * 2.0 + bass * 0.5);
          p.line(dx * r * 0.95, dy * r * 0.95, dz * r * 0.95,
                 dx * len, dy * len, dz * len);
        }

        p.colorMode(p.RGB, 255);
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
    this._rotY = 0;
    this._mirrorFaces = null;
    super.destroy();
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['3d-mirrorball'] = Mirrorball3dPreset;
})();
