(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class PolaroidFlashPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            let photos = [];
            let flashAlpha = 0;
            let gfx;
            const MAX_PHOTOS = 6;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                gfx = p.createGraphics(Math.ceil(p.width / 3), Math.ceil(p.height / 3));
                gfx.colorMode(gfx.HSB, 360, 100, 100, 100);
                spawnPhoto();
            };

            function spawnPhoto() {
                const pw = p.width * (0.2 + Math.random() * 0.15);
                const ph = pw * 1.2;
                photos.push({
                    x: p.width * 0.15 + Math.random() * p.width * 0.6,
                    y: p.height * 0.15 + Math.random() * p.height * 0.5,
                    w: pw, h: ph,
                    angle: (Math.random() - 0.5) * 0.4,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: (Math.random() - 0.5) * 0.2,
                    vr: (Math.random() - 0.5) * 0.002,
                    developProgress: 0,
                    age: 0,
                    seed: Math.random() * 1000,
                    hueBase: Math.random() * 60 + 10,
                    fadeOut: 0
                });
                if (photos.length > MAX_PHOTOS) {
                    photos[0].fadeOut = 1;
                }
                flashAlpha = 95;
            }

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.01 * speed;
                const bass = preset.audio.bass;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;

                // Dark warm background
                p.background(25, 25, 10);

                // Subtle dust particles
                p.noStroke();
                for (let i = 0; i < 15; i++) {
                    const dx = p.noise(i * 10, t) * p.width;
                    const dy = p.noise(i * 10 + 50, t * 0.7) * p.height;
                    p.fill(40, 15, 60, 15);
                    p.ellipse(dx, dy, 2, 2);
                }

                // Draw photos
                for (let i = photos.length - 1; i >= 0; i--) {
                    const photo = photos[i];
                    photo.age++;
                    photo.x += photo.vx;
                    photo.y += photo.vy;
                    photo.angle += photo.vr;

                    // Development: gradually reveal content
                    if (photo.developProgress < 1) {
                        photo.developProgress += 0.004 * speed;
                    }

                    // Fade out old photos
                    if (photo.fadeOut > 0) {
                        photo.fadeOut += 0.02;
                        if (photo.fadeOut > 1) { photos.splice(i, 1); continue; }
                    }

                    const alpha = photo.fadeOut > 0 ? (1 - photo.fadeOut) * 100 : 100;
                    const dev = Math.min(photo.developProgress, 1);
                    const ageFactor = Math.min(photo.age / 300, 1);

                    p.push();
                    p.translate(photo.x, photo.y);
                    p.rotate(photo.angle);

                    // Shadow
                    p.noStroke();
                    p.fill(0, 0, 0, 15 * (alpha / 100));
                    p.rect(4, 6, photo.w, photo.h, 2);

                    // White border
                    const border = photo.w * 0.08;
                    p.fill(40, 5, 95, alpha);
                    p.rect(-border, -border, photo.w + border * 2, photo.h + border * 2.5, 2);

                    // Photo content: noise-based abstract image
                    if (dev > 0.05) {
                        const cellSize = 6;
                        const cols = Math.floor(photo.w / cellSize);
                        const rows = Math.floor(photo.h / cellSize);
                        for (let cy = 0; cy < rows; cy++) {
                            for (let cx = 0; cx < cols; cx++) {
                                const n = p.noise(cx * 0.15 + photo.seed, cy * 0.15 + photo.seed, t * 0.2);
                                // Sepia tone that shifts with age
                                const hue = p.lerp(photo.hueBase, 35, ageFactor);
                                const sat = p.lerp(40, 25, ageFactor) * n;
                                const bri = (30 + n * 60) * dev;
                                const contentAlpha = dev * (alpha / 100) * 90;
                                // White → content transition
                                const whiteness = Math.max(0, 1 - dev * 2);
                                p.fill(hue, sat * (1 - whiteness), bri + whiteness * 40, contentAlpha);
                                p.rect(cx * cellSize, cy * cellSize, cellSize, cellSize);
                            }
                        }
                    } else {
                        // Undeveloped: white
                        p.fill(40, 3, 98, alpha * 0.9);
                        p.rect(0, 0, photo.w, photo.h);
                    }

                    p.pop();
                }

                // Auto-spawn if too few
                if (photos.length < 2 && p.frameCount % 90 === 0) spawnPhoto();

                // Flash effect
                if (flashAlpha > 0) {
                    p.noStroke();
                    // Radial flash
                    for (let r = 3; r > 0; r--) {
                        p.fill(45, 5, 100, flashAlpha / r);
                        p.ellipse(p.width / 2, p.height / 2, p.width * r * 0.5, p.height * r * 0.5);
                    }
                    p.fill(0, 0, 100, flashAlpha);
                    p.rect(0, 0, p.width, p.height);
                    flashAlpha *= 0.85;
                    if (flashAlpha < 1) flashAlpha = 0;
                }

                // Beat: spawn new photo with flash
                if (pulse > 0.5 && photos.length < MAX_PHOTOS + 2) {
                    spawnPhoto();
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (gfx) gfx.remove();
                gfx = p.createGraphics(Math.ceil(p.width / 3), Math.ceil(p.height / 3));
                gfx.colorMode(gfx.HSB, 360, 100, 100, 100);
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
        this.beatPulse = strength;
    }
}

window.VJamFX.presets['polaroid-flash'] = PolaroidFlashPreset;
})();
