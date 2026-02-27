/**
 * VJam FX — 3D Presets (p5.js WEBGL)
 * 10 audio-reactive 3D visualizations using p5.js WEBGL mode.
 * No Three.js required — p5.js handles all 3D rendering.
 */
(function() {
  'use strict';

  const BasePreset = window.VJamFX.BasePreset;
  if (!BasePreset) return;

  // Shared sphere vertex builder
  function buildSphereVerts(detailX, detailY) {
    const tris = [];
    for (let j = 0; j < detailY; j++) {
      for (let i = 0; i < detailX; i++) {
        const v00 = sphPt(i, j, detailX, detailY);
        const v10 = sphPt(i + 1, j, detailX, detailY);
        const v01 = sphPt(i, j + 1, detailX, detailY);
        const v11 = sphPt(i + 1, j + 1, detailX, detailY);
        tris.push(v00, v10, v11, v00, v11, v01);
      }
    }
    return tris;
  }

  function sphPt(i, j, dx, dy) {
    const phi = Math.PI * j / dy;
    const theta = 2 * Math.PI * i / dx;
    return {
      x: Math.sin(phi) * Math.cos(theta),
      y: -Math.cos(phi),
      z: Math.sin(phi) * Math.sin(theta),
    };
  }

  // ==========================================================
  // 3D Sphere — Wireframe neon sphere
  // ==========================================================
  class ThreeDSphere extends BasePreset {
    constructor() {
      super();
      this.audio = { bass: 0, mid: 0, treble: 0 };
      this._beatPulse = 0;
      this._rotX = 0; this._rotY = 0; this._rotZ = 0;
      this._sphereVerts = null;
    }
    setup(container) {
      this.destroy();
      const preset = this;
      this._sphereVerts = buildSphereVerts(24, 16);
      this.p5 = new p5((p) => {
        p.setup = () => { p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL); };
        p.draw = () => {
          p.background(0);
          preset._beatPulse *= 0.85;
          const bass = preset.audio.bass;
          const r = Math.min(p.width, p.height) * 0.38;
          const spd = 0.005 + bass * 0.015 + preset._beatPulse * 0.05;
          preset._rotX += spd * 0.5; preset._rotY += spd; preset._rotZ += spd * 0.3;
          const pulse = 1 + bass * 0.1 + preset._beatPulse * 0.2;
          p.push(); p.rotateX(preset._rotX); p.rotateY(preset._rotY); p.rotateZ(preset._rotZ); p.scale(pulse);
          p.noFill(); p.stroke(0, 255, 220); p.strokeWeight(1.0 + preset._beatPulse * 2);
          p.beginShape(p.TRIANGLES);
          for (const v of preset._sphereVerts) p.vertex(v.x * r, v.y * r, v.z * r);
          p.endShape();
          p.pop();
        };
        p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
      }, container);
    }
    updateAudio(d) { this.audio.bass = d.bass || 0; this.audio.mid = d.mid || 0; this.audio.treble = d.treble || 0; }
    onBeat(s) { this._beatPulse = s; }
  }

  // ==========================================================
  // 3D Wave — Neon wireframe wave mesh
  // ==========================================================
  class ThreeDWave extends BasePreset {
    constructor() {
      super();
      this.audio = { bass: 0, mid: 0, treble: 0 };
      this._beatPulse = 0;
      this._waveTime = 0;
    }
    setup(container) {
      this.destroy();
      const preset = this;
      this.p5 = new p5((p) => {
        p.setup = () => { p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL); };
        p.draw = () => {
          p.background(0);
          preset._beatPulse *= 0.85;
          const bass = preset.audio.bass;
          const treble = preset.audio.treble;
          preset._waveTime += 0.02 + bass * 0.03;
          const amp = 80 + bass * 120 + preset._beatPulse * 100;
          const freq = 0.03 + treble * 0.04;
          p.push(); p.rotateX(-0.9); p.translate(0, 60, 0);
          p.noFill(); p.colorMode(p.HSB, 360, 100, 100, 255);
          const hue = (p.frameCount * 0.5 + bass * 60) % 360;
          p.stroke(hue, 70, 90, 200 + preset._beatPulse * 55);
          p.strokeWeight(1.0 + preset._beatPulse * 2 + bass * 1.5);
          // Draw wave mesh
          const cols = 25, rows = 18;
          const cw = p.width * 1.6 / cols, ch = p.height * 1.6 / rows;
          const ox = -p.width * 0.8, oy = -p.height * 0.8;
          for (let gy = 0; gy < rows; gy++) {
            p.beginShape(p.TRIANGLE_STRIP);
            for (let gx = 0; gx <= cols; gx++) {
              for (let dy = 0; dy <= 1; dy++) {
                const px = ox + gx * cw, py = oy + (gy + dy) * ch;
                const d = Math.sqrt(px * px + py * py);
                const z = Math.sin(d * freq - preset._waveTime) * amp;
                p.vertex(px, py, z);
              }
            }
            p.endShape();
          }
          p.colorMode(p.RGB, 255); p.pop();
        };
        p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
      }, container);
    }
    updateAudio(d) { this.audio.bass = d.bass || 0; this.audio.mid = d.mid || 0; this.audio.treble = d.treble || 0; }
    onBeat(s) { this._beatPulse = s; }
  }

  // ==========================================================
  // 3D Bubble — Bouncing semi-transparent spheres
  // ==========================================================
  class ThreeDBubble extends BasePreset {
    constructor() {
      super();
      this.audio = { bass: 0, mid: 0, treble: 0 };
      this._beatPulse = 0;
      this._bubbles = null;
      this._lightAngle = 0;
    }
    _initBubbles() {
      const bubbles = [];
      const a = () => (Math.random() - 0.5) * 2;
      for (let i = 0; i < 12; i++) {
        const spd = 0.7 + Math.random() * 1.3;
        const ang = Math.random() * Math.PI * 2;
        bubbles.push({
          x: a() * 0.8, y: a() * 0.8, z: a() * 0.4,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, vz: a() * 0.5,
          r: 0.08 + Math.random() * 0.18, hue: Math.random() * 360, spin: Math.random() * Math.PI * 2,
        });
      }
      return bubbles;
    }
    setup(container) {
      this.destroy();
      const preset = this;
      this.p5 = new p5((p) => {
        p.setup = () => { p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL); };
        p.draw = () => {
          p.background(0);
          preset._beatPulse *= 0.85;
          if (!preset._bubbles) preset._bubbles = preset._initBubbles();
          const bass = preset.audio.bass, mid = preset.audio.mid;
          const t = p.frameCount * 0.01;
          const hw = p.width * 0.5, hh = p.height * 0.5, hd = Math.min(hw, hh) * 0.6;
          preset._lightAngle += 0.01;
          p.ambientLight(60 + preset._beatPulse * 40);
          p.directionalLight(180, 180, 200, Math.cos(preset._lightAngle), -0.4, Math.sin(preset._lightAngle));
          const kick = preset._beatPulse * 2;
          for (const b of preset._bubbles) {
            if (kick > 1.2) { b.vx += (Math.random() - 0.5) * kick; b.vy += (Math.random() - 0.5) * kick; }
            b.vx *= 0.97; b.vy *= 0.97; b.vz *= 0.97;
            const speed = 1 + bass * 0.5;
            b.x += b.vx * speed * 0.005; b.y += b.vy * speed * 0.005; b.z += b.vz * speed * 0.003;
            const wall = 0.92;
            if (b.x > wall) { b.x = wall; b.vx = -Math.abs(b.vx); }
            if (b.x < -wall) { b.x = -wall; b.vx = Math.abs(b.vx); }
            if (b.y > wall) { b.y = wall; b.vy = -Math.abs(b.vy); }
            if (b.y < -wall) { b.y = -wall; b.vy = Math.abs(b.vy); }
            if (b.z > 0.5) { b.z = 0.5; b.vz = -Math.abs(b.vz); }
            if (b.z < -0.5) { b.z = -0.5; b.vz = Math.abs(b.vz); }
            const radius = b.r * Math.min(hw, hh) * (1 + bass * 0.4 + preset._beatPulse * 0.6);
            const hue = (b.hue + t * 40 + mid * 200) % 360;
            b.spin += 0.02 + bass * 0.05;
            p.push(); p.translate(b.x * hw, b.y * hh, b.z * hd); p.rotateY(b.spin); p.rotateX(b.spin * 0.6);
            p.colorMode(p.HSB, 360, 100, 100, 255);
            p.fill(hue, 30, 90, 25); p.stroke(hue, 50, 100, 120 + preset._beatPulse * 135);
            p.strokeWeight(0.8 + preset._beatPulse * 2); p.sphere(radius, 16, 12);
            p.colorMode(p.RGB, 255); p.pop();
          }
        };
        p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
      }, container);
    }
    updateAudio(d) { this.audio.bass = d.bass || 0; this.audio.mid = d.mid || 0; this.audio.treble = d.treble || 0; }
    onBeat(s) { this._beatPulse = s; }
  }

  // ==========================================================
  // 3D Tunnel — Neon ring tunnel flight
  // ==========================================================
  class ThreeDTunnel extends BasePreset {
    constructor() {
      super();
      this.audio = { bass: 0, mid: 0, treble: 0 };
      this._beatPulse = 0;
      this._tunnelRings = null;
      this._tunnelOffset = 0;
    }
    _initRings() {
      const rings = [];
      for (let i = 0; i < 28; i++) {
        rings.push({
          z: -i * 100, hue: (i * 13) % 360, radius: 0.85 + Math.random() * 0.3,
          wobblePhase: Math.random() * Math.PI * 2, wobbleAmp: 0.02 + Math.random() * 0.04,
        });
      }
      return rings;
    }
    setup(container) {
      this.destroy();
      const preset = this;
      this.p5 = new p5((p) => {
        p.setup = () => { p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL); };
        p.draw = () => {
          p.background(0);
          preset._beatPulse *= 0.85;
          if (!preset._tunnelRings) preset._tunnelRings = preset._initRings();
          const bass = preset.audio.bass, treble = preset.audio.treble;
          const speed = 4 + bass * 12 + preset._beatPulse * 25;
          preset._tunnelOffset += speed;
          const maxZ = -28 * 100, scale = Math.min(p.width, p.height) * 0.4;
          p.colorMode(p.HSB, 360, 100, 100, 255);
          for (const ring of preset._tunnelRings) {
            ring.z += speed;
            if (ring.z > 400) { ring.z = maxZ + (ring.z - 400); ring.hue = Math.random() * 360; }
            const zRange = -maxZ + 400;
            const zNorm = (ring.z - maxZ) / zRange;
            const alpha = Math.pow(zNorm, 0.5) * 255 * Math.min(1, (400 - ring.z) / 500);
            if (alpha < 3) continue;
            const beatR = 1 + preset._beatPulse * 0.5;
            const r = scale * ring.radius * beatR;
            const tubeR = r * (0.03 + preset._beatPulse * 0.04);
            const hue = (ring.hue + preset._tunnelOffset * 0.02 + treble * 100) % 360;
            const wobX = Math.sin(ring.wobblePhase + preset._tunnelOffset * 0.001) * ring.wobbleAmp * scale;
            const wobY = Math.cos(ring.wobblePhase * 1.3 + preset._tunnelOffset * 0.0008) * ring.wobbleAmp * scale;
            p.push(); p.translate(wobX, wobY, ring.z);
            p.noFill(); p.stroke(hue, 85, 95, alpha);
            p.strokeWeight(2.0 + preset._beatPulse * 4 + bass * 1.5);
            p.torus(r, tubeR, 20, 8);
            if (alpha > 60) { p.stroke(hue, 20, 100, alpha * 0.4); p.strokeWeight(0.8); p.torus(r * 0.92, tubeR * 0.5, 20, 6); }
            p.pop();
          }
          p.colorMode(p.RGB, 255);
        };
        p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
      }, container);
    }
    updateAudio(d) { this.audio.bass = d.bass || 0; this.audio.mid = d.mid || 0; this.audio.treble = d.treble || 0; }
    onBeat(s) { this._beatPulse = s; }
  }

  // ==========================================================
  // 3D Worm — Vortex warp tunnel with light streaks
  // ==========================================================
  class ThreeDWorm extends BasePreset {
    constructor() {
      super();
      this.audio = { bass: 0, mid: 0, treble: 0 };
      this._beatPulse = 0;
      this._wormOffset = 0;
    }
    setup(container) {
      this.destroy();
      const preset = this;
      this.p5 = new p5((p) => {
        p.setup = () => { p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL); };
        p.draw = () => {
          p.background(0);
          preset._beatPulse *= 0.85;
          const bass = preset.audio.bass, mid = preset.audio.mid, treble = preset.audio.treble;
          const fc = p.frameCount, scale = Math.min(p.width, p.height);
          preset._wormOffset += 0.03 + bass * 0.06 + preset._beatPulse * 0.15;
          const t = preset._wormOffset;
          const ringCount = 35, tunnelLen = scale * 2.0, maxR = scale * 0.65, pts = 24;
          p.colorMode(p.HSB, 360, 100, 100, 255);
          // Warp streaks
          p.noFill();
          for (let i = 0; i < 60; i++) {
            const sa = (i / 60) * Math.PI * 2 + t * 0.3;
            const sr = maxR * (0.3 + (i % 7) * 0.1);
            const sx = Math.cos(sa) * sr, sy = Math.sin(sa) * sr;
            const sz1 = ((t * 80 + i * 57) % tunnelLen) - tunnelLen;
            const sz2 = sz1 + 30 + bass * 40 + preset._beatPulse * 60;
            const sHue = (i * 17 + fc * 0.8) % 360;
            p.strokeWeight(1.0 + preset._beatPulse * 1.5);
            p.stroke(sHue, 50, 95, 100 + preset._beatPulse * 100 + bass * 55);
            p.line(sx, sy, sz1, sx, sy, sz2);
          }
          // Tunnel rings
          for (let r = 0; r < ringCount; r++) {
            const rawZ = ((t * 60 + r * (tunnelLen / ringCount)) % tunnelLen) - tunnelLen;
            const zNorm = 1 - (rawZ + tunnelLen) / tunnelLen;
            const ringR = maxR * (0.15 + (1 - zNorm) * 0.85);
            const distort = bass * 0.3 + preset._beatPulse * 0.4;
            const hue = (r * 25 + fc * 0.6 + treble * 80) % 360;
            const alpha = 50 + (1 - zNorm) * 180 + preset._beatPulse * 25;
            const sw = 1.5 + (1 - zNorm) * 2.5 + preset._beatPulse * 2;
            p.strokeWeight(sw); p.stroke(hue, 70 + mid * 20, 70 + (1 - zNorm) * 30 + preset._beatPulse * 20, alpha);
            p.noFill();
            const spin = t * 0.8 + r * 0.15;
            p.beginShape();
            for (let i = 0; i <= pts; i++) {
              const a = (i / pts) * Math.PI * 2 + spin;
              const noise = Math.sin(a * 3 + t * 2 + r) * distort + Math.sin(a * 5 + t * 3) * distort * 0.5;
              const cr = ringR * (1 + noise);
              p.vertex(Math.cos(a) * cr, Math.sin(a) * cr, rawZ);
            }
            p.endShape(p.CLOSE);
          }
          // Center glow
          p.push(); p.translate(0, 0, -tunnelLen); p.noStroke();
          p.emissiveMaterial(255, 220, 255);
          p.sphere(scale * (0.06 + preset._beatPulse * 0.08 + bass * 0.04));
          p.pop();
          p.colorMode(p.RGB, 255);
        };
        p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
      }, container);
    }
    updateAudio(d) { this.audio.bass = d.bass || 0; this.audio.mid = d.mid || 0; this.audio.treble = d.treble || 0; }
    onBeat(s) { this._beatPulse = s; }
  }

  // ==========================================================
  // 3D Terrain — Neon wireframe terrain flight
  // ==========================================================
  class ThreeDTerrain extends BasePreset {
    constructor() {
      super();
      this.audio = { bass: 0, mid: 0, treble: 0 };
      this._beatPulse = 0;
      this._terrainOffset = 0;
      this._terrainQuake = 0;
    }
    setup(container) {
      this.destroy();
      const preset = this;
      this.p5 = new p5((p) => {
        p.setup = () => { p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL); };
        p.draw = () => {
          p.background(0);
          preset._beatPulse *= 0.85;
          const bass = preset.audio.bass, mid = preset.audio.mid, treble = preset.audio.treble;
          preset._terrainQuake *= 0.8;
          preset._terrainQuake += preset._beatPulse * 120;
          preset._terrainOffset += 0.02 + mid * 0.06 + bass * 0.02;
          const cols = 35, rows = 25;
          const scl = Math.min(p.width, p.height) * 0.055;
          const halfW = cols * scl * 0.5, halfH = rows * scl * 0.5;
          const ampBase = 80 + bass * 200 + preset._terrainQuake;
          p.push(); p.rotateX(-1.05); p.translate(0, 100, 0);
          p.colorMode(p.HSB, 360, 100, 100, 255);
          const heights = new Float32Array((cols + 1) * (rows + 1));
          for (let y = 0; y <= rows; y++) {
            for (let x = 0; x <= cols; x++) {
              const nx = x * 0.1, nz = (y + preset._terrainOffset * 12) * 0.1;
              heights[y * (cols + 1) + x] = (p.noise(nx, nz) - 0.3) * ampBase;
            }
          }
          // Filled terrain
          const hueBase = p.frameCount * 0.4 + mid * 60;
          p.noStroke();
          p.beginShape(p.TRIANGLES);
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              const px0 = x * scl - halfW, px1 = (x + 1) * scl - halfW;
              const py0 = y * scl - halfH, py1 = (y + 1) * scl - halfH;
              const z00 = heights[y * (cols + 1) + x], z10 = heights[y * (cols + 1) + x + 1];
              const z01 = heights[(y + 1) * (cols + 1) + x], z11 = heights[(y + 1) * (cols + 1) + x + 1];
              const hN = Math.max(0, Math.min(1, ((z00 + z10 + z11) / 3 + ampBase * 0.3) / (ampBase * 1.2)));
              p.fill((hueBase + hN * 200) % 360, 75 - hN * 20, 25 + hN * 55, 200);
              p.vertex(px0, py0, z00); p.vertex(px1, py0, z10); p.vertex(px1, py1, z11);
              const hN2 = Math.max(0, Math.min(1, ((z00 + z11 + z01) / 3 + ampBase * 0.3) / (ampBase * 1.2)));
              p.fill((hueBase + hN2 * 200) % 360, 75 - hN2 * 20, 25 + hN2 * 55, 200);
              p.vertex(px0, py0, z00); p.vertex(px1, py1, z11); p.vertex(px0, py1, z01);
            }
          }
          p.endShape();
          // Wire overlay
          const wireHue = (180 + p.frameCount * 0.3) % 360;
          p.stroke(wireHue, 80, 90, 100 + treble * 80 + preset._beatPulse * 100);
          p.strokeWeight(0.6 + preset._beatPulse * 1.0); p.noFill();
          for (let y = 0; y <= rows; y += 2) {
            p.beginShape();
            for (let x = 0; x <= cols; x++) p.vertex(x * scl - halfW, y * scl - halfH, heights[y * (cols + 1) + x] + 1);
            p.endShape();
          }
          for (let x = 0; x <= cols; x += 2) {
            p.beginShape();
            for (let y = 0; y <= rows; y++) p.vertex(x * scl - halfW, y * scl - halfH, heights[y * (cols + 1) + x] + 1);
            p.endShape();
          }
          p.colorMode(p.RGB, 255); p.pop();
        };
        p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
      }, container);
    }
    updateAudio(d) { this.audio.bass = d.bass || 0; this.audio.mid = d.mid || 0; this.audio.treble = d.treble || 0; }
    onBeat(s) { this._beatPulse = s; }
  }

  // ==========================================================
  // 3D Mirrorball — Disco mirror ball with light rays
  // ==========================================================
  class ThreeDMirrorball extends BasePreset {
    constructor() {
      super();
      this.audio = { bass: 0, mid: 0, treble: 0 };
      this._beatPulse = 0;
      this._mirrorFaces = null;
      this._rotY = 0;
    }
    _initFaces() {
      const verts = buildSphereVerts(12, 10);
      const faces = [];
      for (let i = 0; i < verts.length; i += 3) {
        faces.push({ v: [verts[i], verts[i + 1], verts[i + 2]], hue: Math.random() * 360, flash: 0 });
      }
      return faces;
    }
    setup(container) {
      this.destroy();
      const preset = this;
      this.p5 = new p5((p) => {
        p.setup = () => { p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL); };
        p.draw = () => {
          p.background(0);
          preset._beatPulse *= 0.85;
          if (!preset._mirrorFaces) preset._mirrorFaces = preset._initFaces();
          const bass = preset.audio.bass, mid = preset.audio.mid, treble = preset.audio.treble;
          const r = Math.min(p.width, p.height) * 0.38;
          preset._rotY += 0.008 + bass * 0.03 + preset._beatPulse * 0.08;
          const tiltX = 0.2 + Math.sin(p.frameCount * 0.008) * 0.1;
          if (preset._beatPulse > 0.2) {
            const count = Math.floor(8 + preset._beatPulse * 20);
            for (let i = 0; i < count; i++) {
              preset._mirrorFaces[Math.floor(Math.random() * preset._mirrorFaces.length)].flash = 0.7 + Math.random() * 0.3;
            }
          }
          p.push(); p.rotateX(tiltX); p.rotateY(preset._rotY); p.scale(1 + preset._beatPulse * 0.15);
          p.colorMode(p.HSB, 360, 100, 100, 255);
          p.stroke(0, 0, 30, 100); p.strokeWeight(0.4);
          p.beginShape(p.TRIANGLES);
          for (const face of preset._mirrorFaces) {
            face.flash *= 0.82;
            const hue = (face.hue + p.frameCount * 0.5) % 360;
            if (face.flash > 0.05) p.fill(hue, 15 * (1 - face.flash), 70 + face.flash * 30, 250);
            else p.fill(hue, 55, 40 + mid * 30 + bass * 15, 220);
            for (const v of face.v) p.vertex(v.x * r, v.y * r, v.z * r);
          }
          p.endShape();
          // Light rays
          const rayCount = Math.floor(8 + mid * 16 + preset._beatPulse * 15);
          for (let i = 0; i < rayCount; i++) {
            const a1 = p.frameCount * 0.025 + i * 6.2832 / rayCount;
            const a2 = p.frameCount * 0.012 + i * 2.3;
            const dx = Math.cos(a1) * Math.sin(a2), dy = Math.sin(a1) * Math.sin(a2), dz = Math.cos(a2);
            p.stroke((i * 30 + p.frameCount * 0.8) % 360, 40, 100, 40 + preset._beatPulse * 140 + treble * 40);
            p.strokeWeight(0.5 + preset._beatPulse * 2.5);
            const len = r * (1.8 + preset._beatPulse * 2.0 + bass * 0.5);
            p.line(dx * r * 0.95, dy * r * 0.95, dz * r * 0.95, dx * len, dy * len, dz * len);
          }
          p.colorMode(p.RGB, 255); p.pop();
        };
        p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
      }, container);
    }
    updateAudio(d) { this.audio.bass = d.bass || 0; this.audio.mid = d.mid || 0; this.audio.treble = d.treble || 0; }
    onBeat(s) { this._beatPulse = s; }
  }

  // ==========================================================
  // 3D Particles — Swirling particle constellation
  // ==========================================================
  class ThreeDParticles extends BasePreset {
    constructor() {
      super();
      this.audio = { bass: 0, mid: 0, treble: 0 };
      this._beatPulse = 0;
      this._particles = null;
    }
    _initParticles() {
      const particles = [];
      for (let i = 0; i < 400; i++) {
        particles.push({
          angle: Math.random() * Math.PI * 2, radius: 0.15 + Math.random() * 0.85,
          baseRadius: 0.15 + Math.random() * 0.85, y: (Math.random() - 0.5) * 2, baseY: (Math.random() - 0.5) * 2,
          speed: 0.2 + Math.random() * 0.8, hue: Math.random() * 360, size: 0.8 + Math.random() * 1.2,
          explode: 0, explodeDir: Math.random() * Math.PI * 2, yDir: (Math.random() - 0.5) * 2,
        });
      }
      return particles;
    }
    setup(container) {
      this.destroy();
      const preset = this;
      this.p5 = new p5((p) => {
        p.setup = () => { p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL); };
        p.draw = () => {
          p.background(0);
          preset._beatPulse *= 0.85;
          if (!preset._particles) preset._particles = preset._initParticles();
          const bass = preset.audio.bass, mid = preset.audio.mid, treble = preset.audio.treble;
          const scale = Math.min(p.width, p.height) * 0.42;
          const hueShift = treble * 250, swirl = 0.015 + bass * 0.06, fc = p.frameCount;
          if (preset._beatPulse > 0.3) {
            for (const pt of preset._particles) {
              pt.explode = preset._beatPulse;
              pt.explodeDir = Math.random() * Math.PI * 2; pt.yDir = (Math.random() - 0.5) * 2;
            }
          }
          p.colorMode(p.HSB, 360, 100, 100, 255);
          p.push(); p.rotateY(fc * 0.004 + bass * 0.01); p.rotateX(Math.sin(fc * 0.002) * 0.15);
          p.beginShape(p.POINTS);
          for (const pt of preset._particles) {
            pt.angle += swirl * pt.speed; pt.explode *= 0.94;
            const expR = pt.explode * 2.0, currentR = pt.baseRadius + expR;
            const x = Math.cos(pt.angle) * currentR * scale + Math.cos(pt.explodeDir) * expR * scale * 0.3;
            const z = Math.sin(pt.angle) * currentR * scale + Math.sin(pt.explodeDir) * expR * scale * 0.3;
            const yWave = Math.sin(pt.angle * 2.5 + fc * 0.025) * 0.25;
            const y = (pt.baseY + yWave) * scale + pt.explode * pt.yDir * scale * 0.7;
            const depthFactor = 1 + z / (scale * 2);
            const sz = pt.size * (3 + mid * 6 + preset._beatPulse * 4) * Math.max(0.4, depthFactor);
            p.strokeWeight(sz);
            p.stroke((pt.hue + hueShift + fc * 0.6) % 360, 65, 75 + preset._beatPulse * 25 + mid * 10, 170 + preset._beatPulse * 85);
            p.vertex(x, y, z);
          }
          p.endShape();
          p.colorMode(p.RGB, 255); p.pop();
        };
        p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
      }, container);
    }
    updateAudio(d) { this.audio.bass = d.bass || 0; this.audio.mid = d.mid || 0; this.audio.treble = d.treble || 0; }
    onBeat(s) { this._beatPulse = s; }
  }

  // ==========================================================
  // 3D Solar — Solar system (procedural colors, no textures)
  // ==========================================================
  class ThreeDSolar extends BasePreset {
    constructor() {
      super();
      this.audio = { bass: 0, mid: 0, treble: 0 };
      this._beatPulse = 0;
      this._solarTime = 0;
      this._solarStars = null;
    }
    _initStars() {
      const stars = [];
      for (let i = 0; i < 200; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 900 + Math.random() * 500;
        stars.push({ x: Math.sin(phi) * Math.cos(theta) * r, y: Math.sin(phi) * Math.sin(theta) * r, z: Math.cos(phi) * r, bri: 0.3 + Math.random() * 0.7 });
      }
      return stars;
    }
    setup(container) {
      this.destroy();
      const preset = this;
      this.p5 = new p5((p) => {
        p.setup = () => { p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL); };
        p.draw = () => {
          p.background(0);
          preset._beatPulse *= 0.85;
          if (!preset._solarStars) preset._solarStars = preset._initStars();
          const bass = preset.audio.bass, treble = preset.audio.treble;
          const fc = p.frameCount, scale = Math.min(p.width, p.height);
          preset._solarTime += 0.005 + bass * 0.01 + preset._beatPulse * 0.04;
          const t = preset._solarTime;
          const planets = [
            { dist: 0.10, speed: 4.1, size: 0.010, col: [160, 150, 140] },
            { dist: 0.14, speed: 1.6, size: 0.015, col: [220, 190, 120] },
            { dist: 0.19, speed: 1.0, size: 0.016, col: [40, 80, 200] },
            { dist: 0.25, speed: 0.53, size: 0.013, col: [200, 80, 40] },
            { dist: 0.34, speed: 0.15, size: 0.042, col: [200, 160, 100] },
            { dist: 0.44, speed: 0.10, size: 0.034, col: [210, 190, 140] },
            { dist: 0.53, speed: 0.07, size: 0.022, col: [140, 210, 220] },
            { dist: 0.60, speed: 0.05, size: 0.020, col: [50, 80, 220] },
          ];
          p.push(); p.rotateX(-0.45); p.rotateY(t * 0.1);
          // Stars
          p.strokeWeight(1.5 + preset._beatPulse * 1.5);
          for (const s of preset._solarStars) {
            const b = Math.floor(120 + s.bri * 135 + preset._beatPulse * 50);
            p.stroke(b, b, Math.min(255, b + 20)); p.point(s.x, s.y, s.z);
          }
          // Lighting
          p.ambientLight(80 + preset._beatPulse * 50);
          p.pointLight(255, 240, 200, 0, 0, 0);
          // Sun
          const sunR = scale * (0.065 + preset._beatPulse * 0.015 + bass * 0.01);
          p.push(); p.noStroke(); p.emissiveMaterial(255, 200, 60); p.sphere(sunR, 20, 14); p.pop();
          // Planets
          for (const planet of planets) {
            const orbitR = scale * planet.dist;
            const angle = t * planet.speed;
            const pr = scale * planet.size * (1 + preset._beatPulse * 0.12);
            p.noFill(); p.stroke(80, 80, 120, 60 + treble * 40); p.strokeWeight(0.5);
            p.push(); p.rotateX(Math.PI * 0.5); p.circle(0, 0, orbitR * 2); p.pop();
            const px = Math.cos(angle) * orbitR, pz = Math.sin(angle) * orbitR;
            p.push(); p.translate(px, 0, pz); p.rotateY(-angle * 3);
            p.noStroke(); p.emissiveMaterial(...planet.col);
            p.sphere(pr, 14, 10); p.pop();
          }
          p.pop();
        };
        p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
      }, container);
    }
    updateAudio(d) { this.audio.bass = d.bass || 0; this.audio.mid = d.mid || 0; this.audio.treble = d.treble || 0; }
    onBeat(s) { this._beatPulse = s; }
  }

  // ==========================================================
  // 3D Flat Earth — Flat disc with orbiting sun and moon
  // ==========================================================
  class ThreeDFlatEarth extends BasePreset {
    constructor() {
      super();
      this.audio = { bass: 0, mid: 0, treble: 0 };
      this._beatPulse = 0;
      this._rotY = 0;
      this._moonAngle = 0;
      this._sunAngle = Math.PI;
      this._stars = null;
    }
    _initStars() {
      const stars = [];
      for (let i = 0; i < 250; i++) {
        const theta = Math.random() * Math.PI * 2;
        const spread = 600 + Math.random() * 500;
        stars.push({
          x: Math.cos(theta) * spread * (0.3 + Math.random()),
          y: (Math.random() - 0.5) * spread * 1.5,
          z: -Math.random() * 2000,
          bri: 0.4 + Math.random() * 0.6,
        });
      }
      return stars;
    }
    setup(container) {
      this.destroy();
      const preset = this;
      this.p5 = new p5((p) => {
        p.setup = () => { p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL); };
        p.draw = () => {
          p.background(0);
          preset._beatPulse *= 0.85;
          if (!preset._stars) preset._stars = preset._initStars();
          const bass = preset.audio.bass, mid = preset.audio.mid;
          const fc = p.frameCount, scale = Math.min(p.width, p.height);
          const discR = scale * 0.24, discH = discR * 0.18;
          preset._rotY += 0.003 + bass * 0.008 + preset._beatPulse * 0.03;
          preset._moonAngle += 0.008 + mid * 0.01;
          preset._sunAngle += 0.005 + bass * 0.006;
          p.push(); p.translate(0, -discR * 0.2, discR * 1.5); p.rotateX(-0.4);
          // Stars
          p.strokeWeight(1.5 + preset._beatPulse * 1.5);
          for (const s of preset._stars) {
            const twinkle = (Math.sin(fc * 0.05 * s.bri * 3) * 0.3 + 0.7) * s.bri;
            const b = Math.floor(100 + twinkle * 155 + preset._beatPulse * 50);
            p.stroke(b, b, Math.min(255, b + 40)); p.point(s.x, s.y, s.z);
          }
          // Sun
          const sunDist = discR * 1.8;
          p.push(); p.translate(Math.cos(preset._sunAngle) * sunDist, -discR * 0.7, Math.sin(preset._sunAngle) * sunDist);
          p.noStroke(); p.emissiveMaterial(255, 200, 60); p.sphere(discR * 0.14, 20, 14); p.pop();
          // Lighting
          p.ambientLight(100 + preset._beatPulse * 40);
          p.directionalLight(200, 190, 160, 0, -0.5, -1);
          // Disc
          p.push(); p.rotateY(preset._rotY); p.scale(1 + preset._beatPulse * 0.05);
          p.noStroke();
          // Top face (blue-green earth)
          p.push(); p.emissiveMaterial(40, 80, 160); p.translate(0, -discH * 0.5, 0); p.rotateX(Math.PI * 0.5);
          p.circle(0, 0, discR * 2); p.pop();
          // Side (ice wall)
          p.beginShape(p.TRIANGLE_STRIP);
          for (let i = 0; i <= 48; i++) {
            const a = (i / 48) * Math.PI * 2;
            const cx = Math.cos(a) * discR, cz = Math.sin(a) * discR;
            p.fill(200, 220, 255); p.vertex(cx, -discH * 0.5, cz);
            p.fill(30, 50, 100); p.vertex(cx * 0.95, discH * 0.5, cz * 0.95);
          }
          p.endShape();
          // Bottom
          p.fill(25, 20, 18);
          p.beginShape(p.TRIANGLE_FAN); p.vertex(0, discH * 0.5, 0);
          for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI * 2; p.vertex(Math.cos(a) * discR * 0.95, discH * 0.5, Math.sin(a) * discR * 0.95); }
          p.endShape(); p.pop();
          // Moon
          p.push(); p.translate(Math.cos(preset._moonAngle) * discR * 1.5, -discR * 0.1 + Math.sin(preset._moonAngle * 0.5) * discR * 0.3, Math.sin(preset._moonAngle) * discR * 1.5);
          p.noStroke(); p.ambientLight(150); p.emissiveMaterial(180, 180, 170); p.sphere(discR * 0.1, 16, 12); p.pop();
          p.pop();
        };
        p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
      }, container);
    }
    updateAudio(d) { this.audio.bass = d.bass || 0; this.audio.mid = d.mid || 0; this.audio.treble = d.treble || 0; }
    onBeat(s) { this._beatPulse = s; }
  }

  // Register all 3D presets
  window.VJamFX.presets['3d-sphere'] = ThreeDSphere;
  window.VJamFX.presets['3d-wave'] = ThreeDWave;
  window.VJamFX.presets['3d-bubble'] = ThreeDBubble;
  window.VJamFX.presets['3d-tunnel'] = ThreeDTunnel;
  window.VJamFX.presets['3d-worm'] = ThreeDWorm;
  window.VJamFX.presets['3d-terrain'] = ThreeDTerrain;
  window.VJamFX.presets['3d-mirrorball'] = ThreeDMirrorball;
  window.VJamFX.presets['3d-particles'] = ThreeDParticles;
  window.VJamFX.presets['3d-solar'] = ThreeDSolar;
  window.VJamFX.presets['3d-flatearth'] = ThreeDFlatEarth;
})();
