/**
 * VJam FX — Image Effects (3 modes)
 * Cycle: crossfade rotation with audio-reactive zoom/hue
 * Glitch: RGB split + block displacement
 * Cyber: cyan glow + scan lines
 *
 * Images loaded from popup via base64 data URLs (no server API).
 * Registered as window.VJamFX.presets['image-cycle'], etc.
 */
(function() {
  'use strict';

  const BasePreset = window.VJamFX.BasePreset;
  if (!BasePreset) return;

  // --- Shared image loading helper ---
  function loadImages(preset, dataUrls) {
    preset.loadedImages = [];
    preset.currentIndex = 0;
    const p = preset.p5;
    if (!p) return;
    for (const url of dataUrls) {
      const img = new Image();
      img.onload = () => {
        const p5Img = p.createImage(img.naturalWidth, img.naturalHeight);
        p5Img.drawingContext.drawImage(img, 0, 0);
        preset.loadedImages.push(p5Img);
      };
      img.src = url;
    }
  }

  function drawPlaceholder(p, label) {
    p.fill(30);
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(16);
    p.text(label + ': upload images', p.width / 2, p.height / 2);
  }

  function coverScale(p, img) {
    return Math.max(p.width / img.width, p.height / img.height);
  }

  // ==========================================================
  // Image Cycle — crossfade with audio-reactive zoom/hue/brightness
  // ==========================================================
  class ImageCyclePreset extends BasePreset {
    constructor() {
      super();
      this.loadedImages = [];
      this.currentIndex = 0;
      this.nextIndex = 1;
      this.crossfadeProgress = 1;
      this.crossfading = false;
      this.crossfadeDuration = 0.2;
      this.audio = { bass: 0, mid: 0, treble: 0 };
      this.zoom = 1;
      this.targetZoom = 1;
      this.hueShift = 0;
      this.brightness = 1;
    }

    setup(container) {
      this.destroy();
      const preset = this;
      this.p5 = new p5((p) => {
        p.setup = () => {
          p.createCanvas(container.clientWidth, container.clientHeight);
          p.imageMode(p.CENTER);
          p.colorMode(p.HSB, 360, 100, 100, 100);
        };
        p.draw = () => {
          p.background(0);
          if (preset.loadedImages.length === 0) { drawPlaceholder(p, 'Cycle'); return; }

          preset.zoom = p.lerp(preset.zoom, preset.targetZoom, 0.08);
          preset.targetZoom = 1 + preset.audio.bass * 0.15;
          preset.hueShift = p.lerp(preset.hueShift, preset.audio.treble * 60, 0.1);
          preset.brightness = p.lerp(preset.brightness, 0.7 + preset.audio.mid * 0.3, 0.15);

          if (preset.crossfading) {
            const fadeSpeed = 1.0 / (preset.crossfadeDuration * 60);
            preset.crossfadeProgress -= fadeSpeed;
            if (preset.crossfadeProgress <= 0) {
              preset.crossfadeProgress = 1;
              preset.currentIndex = preset.nextIndex;
              preset.crossfading = false;
            }
          }

          const cx = p.width / 2, cy = p.height / 2;
          const cur = preset.loadedImages[preset.currentIndex % preset.loadedImages.length];
          if (cur) {
            const a = preset.crossfading
              ? p.map(preset.crossfadeProgress, 1, 0, 100, 0) * preset.brightness
              : 100 * preset.brightness;
            const s = coverScale(p, cur) * preset.zoom;
            p.push(); p.translate(cx, cy); p.scale(s);
            p.tint(0, 0, 100, a); p.image(cur, 0, 0);
            p.pop();
          }

          if (preset.crossfading && preset.loadedImages.length > 1) {
            const nxt = preset.loadedImages[preset.nextIndex % preset.loadedImages.length];
            if (nxt) {
              const a = p.map(preset.crossfadeProgress, 1, 0, 0, 100) * preset.brightness;
              const s = coverScale(p, nxt) * preset.zoom;
              p.push(); p.translate(cx, cy); p.scale(s);
              p.tint(0, 0, 100, a); p.image(nxt, 0, 0);
              p.pop();
            }
          }

          if (preset.hueShift > 2) {
            p.blendMode(p.ADD);
            p.noStroke(); p.fill(preset.hueShift % 360, 60, 15, 20);
            p.rect(0, 0, p.width, p.height);
            p.blendMode(p.BLEND);
          }
        };
        p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
      }, container);
    }

    updateAudio(audioData) {
      this.audio.bass = audioData.bass || 0;
      this.audio.mid = audioData.mid || 0;
      this.audio.treble = audioData.treble || 0;
    }

    onBeat(strength) {
      if (strength > 0.2 && this.loadedImages.length > 1) {
        this.nextIndex = (this.currentIndex + 1) % this.loadedImages.length;
        this.crossfadeProgress = 1;
        this.crossfading = true;
      }
    }

    setParam(key, value) {
      super.setParam(key, value);
      if (key === 'localImages' && value) loadImages(this, value);
    }
  }

  // ==========================================================
  // Image Glitch — RGB split + block displacement + scanlines
  // ==========================================================
  class ImageGlitchPreset extends BasePreset {
    constructor() {
      super();
      this.loadedImages = [];
      this.currentIndex = 0;
      this.audio = { bass: 0, mid: 0, treble: 0 };
      this.beatPulse = 0;
      this.glitchBlocks = [];
      this.scanlineOffset = 0;
    }

    setup(container) {
      this.destroy();
      const preset = this;
      this.p5 = new p5((p) => {
        let buf;
        p.setup = () => {
          p.createCanvas(container.clientWidth, container.clientHeight);
          p.imageMode(p.CENTER);
          buf = p.createGraphics(p.width, p.height);
          buf.imageMode(p.CENTER);
        };
        p.draw = () => {
          p.background(0);
          if (preset.loadedImages.length === 0) { drawPlaceholder(p, 'Glitch'); return; }
          const img = preset.loadedImages[preset.currentIndex % preset.loadedImages.length];
          if (!img) return;

          preset.beatPulse *= 0.92;
          const scale = coverScale(p, img);
          const cx = p.width / 2, cy = p.height / 2;

          buf.background(0);
          buf.push(); buf.imageMode(p.CENTER); buf.translate(cx, cy); buf.scale(scale);
          buf.image(img, 0, 0); buf.pop();

          const splitAmount = (preset.audio.treble * 8 + preset.beatPulse * 20) | 0;
          if (splitAmount > 1) {
            p.blendMode(p.ADD);
            p.tint(255, 0, 0, 200); p.image(buf, cx - splitAmount, cy, p.width, p.height);
            p.tint(0, 255, 0, 200); p.image(buf, cx, cy, p.width, p.height);
            p.tint(0, 0, 255, 200); p.image(buf, cx + splitAmount, cy, p.width, p.height);
            p.blendMode(p.BLEND); p.noTint();
          } else {
            p.image(buf, cx, cy, p.width, p.height);
          }

          for (let i = preset.glitchBlocks.length - 1; i >= 0; i--) {
            const b = preset.glitchBlocks[i];
            b.life -= 0.05;
            if (b.life <= 0) { preset.glitchBlocks.splice(i, 1); continue; }
            p.tint(255, b.life * 255);
            const sx = Math.max(0, b.x), sy = Math.max(0, b.y);
            const sw = Math.min(b.w, p.width - sx), sh = Math.min(b.h, p.height - sy);
            if (sw > 0 && sh > 0) {
              const chunk = buf.get(sx, sy, sw, sh);
              p.image(chunk, b.x + b.ox + sw / 2, b.y + b.oy + sh / 2);
            }
          }
          p.noTint();

          p.stroke(0, 40 + preset.audio.bass * 60); p.strokeWeight(1);
          preset.scanlineOffset = (preset.scanlineOffset + 1 + preset.beatPulse * 3) % 4;
          for (let y = preset.scanlineOffset; y < p.height; y += 4) p.line(0, y, p.width, y);
        };
        p.windowResized = () => {
          p.resizeCanvas(container.clientWidth, container.clientHeight);
          if (buf) buf.remove();
          buf = p.createGraphics(p.width, p.height);
          buf.imageMode(p.CENTER);
        };
      }, container);
    }

    updateAudio(audioData) {
      this.audio.bass = audioData.bass || 0;
      this.audio.mid = audioData.mid || 0;
      this.audio.treble = audioData.treble || 0;
    }

    onBeat(strength) {
      this.beatPulse = strength;
      if (strength > 0.2) {
        const count = 3 + Math.floor(Math.random() * 5);
        const w = this.p5 ? this.p5.width : 800;
        const h = this.p5 ? this.p5.height : 600;
        for (let i = 0; i < count; i++) {
          this.glitchBlocks.push({
            x: Math.random() * w, y: Math.random() * h,
            w: 30 + Math.random() * 200, h: 10 + Math.random() * 60,
            ox: (Math.random() - 0.5) * 100, oy: (Math.random() - 0.5) * 30,
            life: 1,
          });
        }
      }
      if (strength > 0.5 && this.loadedImages.length > 1) {
        this.currentIndex = (this.currentIndex + 1) % this.loadedImages.length;
      }
    }

    setParam(key, value) {
      super.setParam(key, value);
      if (key === 'localImages' && value) loadImages(this, value);
    }
  }

  // ==========================================================
  // Image Cyber — cyan glow + RGB split + scan lines
  // ==========================================================
  class ImageCyberPreset extends BasePreset {
    constructor() {
      super();
      this.loadedImages = [];
      this.currentIndex = 0;
      this.audio = { bass: 0, mid: 0, treble: 0 };
      this.beatPulse = 0;
      this.scanBurst = 0;
    }

    setup(container) {
      this.destroy();
      const preset = this;
      this.p5 = new p5((p) => {
        p.setup = () => {
          p.createCanvas(container.clientWidth, container.clientHeight);
          p.imageMode(p.CENTER);
        };
        p.draw = () => {
          p.background(5, 5, 15);
          if (preset.loadedImages.length === 0) { drawPlaceholder(p, 'Cyber'); return; }
          const img = preset.loadedImages[preset.currentIndex % preset.loadedImages.length];
          if (!img) return;

          preset.beatPulse *= 0.92;
          preset.scanBurst *= 0.95;
          const scale = coverScale(p, img);
          const cx = p.width / 2, cy = p.height / 2;
          const dw = img.width * scale, dh = img.height * scale;

          const glowOff = 2 + preset.beatPulse * 4;
          p.blendMode(p.ADD);
          p.tint(0, 255, 255, 40 + preset.beatPulse * 60);
          p.image(img, cx - glowOff, cy, dw, dh);
          p.image(img, cx + glowOff, cy, dw, dh);
          p.blendMode(p.BLEND); p.noTint();

          p.image(img, cx, cy, dw, dh);

          const splitAmt = (preset.beatPulse * 15) | 0;
          if (splitAmt > 1) {
            p.blendMode(p.ADD);
            p.tint(255, 0, 80, 80); p.image(img, cx - splitAmt, cy, dw, dh);
            p.tint(0, 255, 200, 80); p.image(img, cx + splitAmt, cy, dw, dh);
            p.blendMode(p.BLEND); p.noTint();
          }

          p.stroke(0, 255, 255, 15 + preset.scanBurst * 40); p.strokeWeight(1);
          const off = p.frameCount % 3;
          for (let y = off; y < p.height; y += 3) p.line(0, y, p.width, y);

          const sweepY = (p.frameCount * 2 + preset.beatPulse * 100) % (p.height + 40) - 20;
          p.stroke(0, 255, 255, 60 + preset.beatPulse * 100); p.strokeWeight(2);
          p.line(0, sweepY, p.width, sweepY);
        };
        p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); };
      }, container);
    }

    updateAudio(audioData) {
      this.audio.bass = audioData.bass || 0;
      this.audio.mid = audioData.mid || 0;
      this.audio.treble = audioData.treble || 0;
    }

    onBeat(strength) {
      this.beatPulse = strength;
      this.scanBurst = strength;
      if (strength > 0.5 && this.loadedImages.length > 1) {
        this.currentIndex = (this.currentIndex + 1) % this.loadedImages.length;
      }
    }

    setParam(key, value) {
      super.setParam(key, value);
      if (key === 'localImages' && value) loadImages(this, value);
    }
  }

  // Register as presets
  window.VJamFX.presets['image-cycle'] = ImageCyclePreset;
  window.VJamFX.presets['image-glitch'] = ImageGlitchPreset;
  window.VJamFX.presets['image-cyber'] = ImageCyberPreset;
})();
