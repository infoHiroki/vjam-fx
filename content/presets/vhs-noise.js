(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class VhsNoisePreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.pendingBeats = [];
        this.bands = [];
        this.trackingY = 0;
        this.glitchAmount = 0;
        this.noisePatches = [];
        this.chromaGfx = null;
    }

    setup(container) {
        this.destroy();
        this.pendingBeats = [];
        this.glitchAmount = 0;
        this.trackingY = 0;
        this.noisePatches = [];
        const preset = this;

        // Initialize 30 horizontal bands
        this.bands = [];
        for (let i = 0; i < 30; i++) {
            this.bands.push({ offset: 0, targetOffset: 0 });
        }

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                preset.chromaGfx = p.createGraphics(p.width, p.height);
                preset.chromaGfx.colorMode(preset.chromaGfx.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                p.background(0);
                const t = p.frameCount * 0.03;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const bandH = p.height / 30;

                // Process beats
                for (const beat of preset.pendingBeats) {
                    preset.glitchAmount = beat.strength;
                    // Randomize noise patches
                    preset.noisePatches = [];
                    const count = 3 + Math.floor(beat.strength * 5);
                    for (let i = 0; i < count; i++) {
                        preset.noisePatches.push({
                            x: Math.random() * p.width,
                            y: Math.random() * p.height,
                            w: 30 + Math.random() * 100,
                            h: 5 + Math.random() * 20,
                            life: 1.0
                        });
                    }
                }
                preset.pendingBeats = [];

                // Update band offsets
                for (let i = 0; i < 30; i++) {
                    const n = p.noise(i * 0.3, t) - 0.5;
                    preset.bands[i].targetOffset = n * (20 + bass * 40 + preset.glitchAmount * 80);
                    preset.bands[i].offset += (preset.bands[i].targetOffset - preset.bands[i].offset) * 0.15;
                }

                // Draw content on chromaGfx for chromatic aberration
                const cg = preset.chromaGfx;
                cg.colorMode(cg.HSB, 360, 100, 100, 100);
                cg.background(0, 0, 0, 100);

                // Draw displaced bands with noise pattern
                cg.noStroke();
                for (let i = 0; i < 30; i++) {
                    const y = i * bandH;
                    const ox = preset.bands[i].offset;
                    const n = p.noise(i * 0.2, t * 0.5);
                    const bri = 15 + n * 30 + mid * 20;
                    cg.fill(240, 50, bri, 70);
                    cg.rect(ox, y, p.width, bandH);

                    // Secondary pattern within band
                    const n2 = p.noise(i * 0.5, t * 0.8);
                    if (n2 > 0.5) {
                        cg.fill(330, 60, bri + 15, 40);
                        cg.rect(ox + n2 * 50, y, p.width * 0.3, bandH);
                    }
                }

                // Chromatic aberration: draw 3 offset copies
                const chromaOff = 3 + bass * 5 + preset.glitchAmount * 10;
                p.blendMode(p.SCREEN);

                // Red channel
                p.tint(0, 80, 70, 60);
                p.image(cg, chromaOff, 0);
                // Green channel
                p.tint(130, 80, 70, 60);
                p.image(cg, 0, 0);
                // Blue channel
                p.tint(240, 80, 70, 60);
                p.image(cg, -chromaOff, 0);

                p.blendMode(p.BLEND);
                p.noTint();

                // Tracking line
                preset.trackingY += 0.8;
                if (preset.trackingY > p.height + 20) preset.trackingY = -20;
                p.noStroke();
                p.fill(0, 0, 100, 30);
                p.rect(0, preset.trackingY, p.width, 3);
                p.fill(0, 0, 100, 15);
                p.rect(0, preset.trackingY - 5, p.width, 15);

                // Static noise patches
                for (let i = preset.noisePatches.length - 1; i >= 0; i--) {
                    const np = preset.noisePatches[i];
                    if (np.life > 0) {
                        const pxSize = 3;
                        const cx = Math.floor(np.w / pxSize);
                        const cy = Math.floor(np.h / pxSize);
                        for (let py = 0; py < cy; py++) {
                            for (let px = 0; px < cx; px++) {
                                const bri = Math.random() * 60 * np.life;
                                p.fill(240, 20, bri, 70 * np.life);
                                p.noStroke();
                                p.rect(np.x + px * pxSize, np.y + py * pxSize, pxSize, pxSize);
                            }
                        }
                        np.life -= 0.03;
                    } else {
                        preset.noisePatches.splice(i, 1);
                    }
                }

                // Horizontal jitter lines
                p.stroke(330, 50, 50, 12);
                p.strokeWeight(1);
                for (let i = 0; i < 5; i++) {
                    const ly = (p.frameCount * 2.3 + i * 137) % p.height;
                    p.line(0, ly, p.width, ly);
                }

                // Decay glitch
                preset.glitchAmount *= 0.92;
                if (preset.glitchAmount < 0.01) preset.glitchAmount = 0;

                // VHS blue/pink tint
                p.noStroke();
                p.fill(260, 40, 20, 10);
                p.rect(0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (preset.chromaGfx) preset.chromaGfx.remove();
                preset.chromaGfx = p.createGraphics(p.width, p.height);
                preset.chromaGfx.colorMode(preset.chromaGfx.HSB, 360, 100, 100, 100);
            };
        }, container);
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) {
        this.pendingBeats.push({ strength });
    }
}

window.VJamFX.presets['vhs-noise'] = VhsNoisePreset;
})();
