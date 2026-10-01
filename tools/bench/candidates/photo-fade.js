(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PhotoFadePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            let photos = [];
            let dustParticles = [];
            let gfx;
            const MAX_PHOTOS = 6;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                gfx = p.createGraphics(p.width, p.height);
                gfx.colorMode(gfx.HSB, 360, 100, 100, 100);
                gfx.background(0, 0, 0, 0);
                initDust();
                spawnPhoto();
                spawnPhoto();
            };

            function initDust() {
                dustParticles = [];
                for (let i = 0; i < 25; i++) {
                    dustParticles.push({
                        x: Math.random() * p.width,
                        y: Math.random() * p.height,
                        size: Math.random() * 2.5 + 0.5,
                        speedX: (Math.random() - 0.5) * 0.3,
                        speedY: -0.1 - Math.random() * 0.2,
                        alpha: 10 + Math.random() * 20,
                        seed: Math.random() * 100
                    });
                }
            }

            function spawnPhoto() {
                const pw = p.width * (0.2 + Math.random() * 0.2);
                const ph = pw * (0.7 + Math.random() * 0.4);
                photos.push({
                    x: p.width * 0.1 + Math.random() * p.width * 0.6,
                    y: p.height * 0.1 + Math.random() * p.height * 0.5,
                    w: pw, h: ph,
                    angle: (Math.random() - 0.5) * 0.3,
                    seed: Math.random() * 1000,
                    phase: 0, // 0=fadeIn, 1=live, 2=aging, 3=fadeOut
                    phaseTimer: 0,
                    phaseDurations: [40, 120 + Math.random() * 100, 80, 50],
                    opacity: 0,
                    sepiaShift: 0,
                    tornEdge: []
                });
                // Generate torn edge vertices
                const photo = photos[photos.length - 1];
                const edgeSteps = 20;
                photo.tornEdge = {
                    top: [], bottom: [], left: [], right: []
                };
                for (let i = 0; i <= edgeSteps; i++) {
                    const f = i / edgeSteps;
                    photo.tornEdge.top.push({ f, d: (Math.random() - 0.5) * 4 });
                    photo.tornEdge.bottom.push({ f, d: (Math.random() - 0.5) * 4 });
                    photo.tornEdge.left.push({ f, d: (Math.random() - 0.5) * 4 });
                    photo.tornEdge.right.push({ f, d: (Math.random() - 0.5) * 4 });
                }
            }

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.01 * speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;

                p.background(25, 15, 8);

                // Aged paper texture background
                p.noStroke();
                for (let i = 0; i < 8; i++) {
                    const bx = p.noise(i * 5, t * 0.1) * p.width;
                    const by = p.noise(i * 5 + 50, t * 0.1) * p.height;
                    p.fill(30, 10, 15, 8);
                    p.ellipse(bx, by, 100 + p.noise(i, t) * 200, 100);
                }

                // Update and draw photos
                for (let i = photos.length - 1; i >= 0; i--) {
                    const photo = photos[i];
                    photo.phaseTimer++;

                    // Phase transitions
                    if (photo.phaseTimer >= photo.phaseDurations[photo.phase]) {
                        photo.phase++;
                        photo.phaseTimer = 0;
                        if (photo.phase > 3) {
                            photos.splice(i, 1);
                            if (photos.length < 2) spawnPhoto();
                            continue;
                        }
                    }

                    // Opacity based on phase
                    const pf = photo.phaseTimer / photo.phaseDurations[photo.phase];
                    if (photo.phase === 0) photo.opacity = pf;
                    else if (photo.phase === 3) photo.opacity = 1 - pf;
                    else photo.opacity = 1;

                    // Sepia aging in phase 2
                    if (photo.phase === 2) photo.sepiaShift = pf;
                    else if (photo.phase >= 2) photo.sepiaShift = 1;

                    p.push();
                    p.translate(photo.x + photo.w / 2, photo.y + photo.h / 2);
                    p.rotate(photo.angle);
                    p.translate(-photo.w / 2, -photo.h / 2);

                    const alpha = photo.opacity * 90;

                    // Shadow
                    p.noStroke();
                    p.fill(0, 0, 0, alpha * 0.15);
                    p.rect(3, 5, photo.w, photo.h);

                    // Photo border with torn edges
                    p.fill(35, 12, 85 - photo.sepiaShift * 15, alpha);
                    p.beginShape();
                    // Top edge
                    for (const v of photo.tornEdge.top) {
                        p.vertex(v.f * photo.w, v.d - 4);
                    }
                    // Right edge
                    for (const v of photo.tornEdge.right) {
                        p.vertex(photo.w + 4 + v.d, v.f * photo.h);
                    }
                    // Bottom edge (reversed)
                    for (let j = photo.tornEdge.bottom.length - 1; j >= 0; j--) {
                        const v = photo.tornEdge.bottom[j];
                        p.vertex(v.f * photo.w, photo.h + 4 + v.d);
                    }
                    // Left edge (reversed)
                    for (let j = photo.tornEdge.left.length - 1; j >= 0; j--) {
                        const v = photo.tornEdge.left[j];
                        p.vertex(v.d - 4, v.f * photo.h);
                    }
                    p.endShape(p.CLOSE);

                    // Photo content: noise-based sepia
                    const cellSize = 5;
                    const cols = Math.floor(photo.w / cellSize);
                    const rows = Math.floor(photo.h / cellSize);
                    for (let cy = 0; cy < rows; cy++) {
                        for (let cx = 0; cx < cols; cx++) {
                            const n = p.noise(cx * 0.12 + photo.seed, cy * 0.12, t * 0.15);
                            const hue = 30 + photo.sepiaShift * 5;
                            const sat = 30 + photo.sepiaShift * 15;
                            const bri = 20 + n * 55;
                            // Fade in from white
                            const whiteness = photo.phase === 0 ? (1 - pf) * 0.7 : 0;
                            p.fill(hue, sat * (1 - whiteness), bri + whiteness * 40, alpha);
                            p.rect(cx * cellSize, cy * cellSize, cellSize, cellSize);
                        }
                    }

                    p.pop();
                }

                // Dust particles
                p.noStroke();
                for (const d of dustParticles) {
                    d.x += d.speedX + Math.sin(t * 2 + d.seed) * 0.2;
                    d.y += d.speedY;
                    if (d.y < -5) { d.y = p.height + 5; d.x = Math.random() * p.width; }
                    if (d.x < -5) d.x = p.width + 5;
                    if (d.x > p.width + 5) d.x = -5;

                    p.fill(35, 15, 70, d.alpha);
                    p.ellipse(d.x, d.y, d.size, d.size);
                }

                // Accumulate dust on gfx
                gfx.fill(30, 10, 30, 1);
                gfx.noStroke();
                if (p.frameCount % 10 === 0) {
                    gfx.ellipse(Math.random() * p.width, Math.random() * p.height, 3, 3);
                }
                p.image(gfx, 0, 0);

                // Auto-spawn
                if (photos.length < 3 && p.frameCount % 100 === 0) spawnPhoto();

                // Beat: new photo
                if (pulse > 0.4 && photos.length < MAX_PHOTOS) {
                    spawnPhoto();
                }

                // Warm vignette (simple corner darken)
                p.noFill();
                p.stroke(20, 30, 5, 15);
                p.strokeWeight(40);
                p.rect(0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (gfx) gfx.remove();
                gfx = p.createGraphics(p.width, p.height);
                gfx.colorMode(gfx.HSB, 360, 100, 100, 100);
                initDust();
            };
        }, container);
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['photo-fade'] = PhotoFadePreset;
})();
