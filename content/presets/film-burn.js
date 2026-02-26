(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class FilmBurnPreset extends BasePreset {
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
            let gfx;
            let blobs = [];
            const MAX_BLOBS = 4;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                gfx = p.createGraphics(p.width, p.height);
                gfx.colorMode(gfx.HSB, 360, 100, 100, 100);
                gfx.background(0, 0, 0);
                spawnBlob();
                spawnBlob();
            };

            function spawnBlob() {
                // Spawn from edges or corners
                const edge = Math.floor(Math.random() * 4);
                let x, y;
                if (edge === 0) { x = Math.random() * p.width; y = -20; }
                else if (edge === 1) { x = p.width + 20; y = Math.random() * p.height; }
                else if (edge === 2) { x = Math.random() * p.width; y = p.height + 20; }
                else { x = -20; y = Math.random() * p.height; }

                blobs.push({
                    x, y,
                    baseR: 30 + Math.random() * 40,
                    expansion: 1,
                    maxExpansion: 4 + Math.random() * 3,
                    growRate: 0.008 + Math.random() * 0.005,
                    seed: Math.random() * 1000,
                    hue: 20 + Math.random() * 25,
                    age: 0,
                    fadeOut: 0,
                    vx: (p.width / 2 - x) * 0.002 + (Math.random() - 0.5) * 0.5,
                    vy: (p.height / 2 - y) * 0.002 + (Math.random() - 0.5) * 0.5
                });
            }

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.01 * speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.93;

                // Slow fade on createGraphics for persistence
                gfx.fill(0, 0, 0, 3);
                gfx.noStroke();
                gfx.rect(0, 0, gfx.width, gfx.height);

                // Update and draw blobs
                for (let i = blobs.length - 1; i >= 0; i--) {
                    const blob = blobs[i];
                    blob.age++;
                    blob.x += blob.vx;
                    blob.y += blob.vy;

                    // Grow
                    blob.expansion += blob.growRate * speed * (1 + pulse * 2);
                    if (blob.expansion > blob.maxExpansion) {
                        blob.fadeOut += 0.01 * speed;
                        if (blob.fadeOut > 1) {
                            blobs.splice(i, 1);
                            if (blobs.length < MAX_BLOBS) spawnBlob();
                            continue;
                        }
                    }

                    const alpha = blob.fadeOut > 0 ? (1 - blob.fadeOut) : 1;
                    const currentR = blob.baseR * blob.expansion;

                    // Draw organic blob shape using noise-displaced vertices
                    const steps = 36;
                    // Outer layer: warm amber/orange
                    for (let layer = 3; layer >= 0; layer--) {
                        const layerR = currentR * (0.4 + layer * 0.2);
                        const layerHue = blob.hue + layer * 3;
                        const layerSat = 70 - layer * 10;
                        const layerBri = 50 + layer * 15 + bass * 10;
                        const layerAlpha = alpha * (20 + layer * 8);

                        gfx.noStroke();
                        gfx.fill(layerHue, layerSat, Math.min(layerBri, 100), layerAlpha);
                        gfx.beginShape();
                        for (let s = 0; s <= steps; s++) {
                            const angle = (s / steps) * p.TWO_PI;
                            const noiseVal = p.noise(
                                Math.cos(angle) * 1.5 + blob.seed,
                                Math.sin(angle) * 1.5 + blob.seed,
                                t * 0.5 + layer * 0.5
                            );
                            const r = layerR + noiseVal * layerR * 0.6;
                            gfx.vertex(blob.x + Math.cos(angle) * r, blob.y + Math.sin(angle) * r);
                        }
                        gfx.endShape(p.CLOSE);
                    }

                    // White-hot core
                    const coreR = currentR * 0.15;
                    gfx.fill(40, 10, 100, alpha * 25);
                    gfx.ellipse(blob.x, blob.y, coreR * 2, coreR * 2);
                    gfx.fill(40, 5, 100, alpha * 15);
                    gfx.ellipse(blob.x, blob.y, coreR, coreR);
                }

                // Auto-spawn
                if (blobs.length < 2 && p.frameCount % 60 === 0) spawnBlob();

                // Draw gfx to main canvas
                p.image(gfx, 0, 0);

                // Film grain overlay
                p.noStroke();
                for (let i = 0; i < 40; i++) {
                    const gx = Math.random() * p.width;
                    const gy = Math.random() * p.height;
                    const gb = Math.random() * 40;
                    p.fill(30, 10, gb, 15);
                    p.rect(gx, gy, 2, 1);
                }

                // Sprocket holes (film strip edge detail)
                p.fill(0, 0, 0, 30);
                for (let sy = 0; sy < p.height; sy += 40) {
                    const drift = Math.sin(t + sy * 0.01) * 2;
                    p.rect(2 + drift, sy, 8, 12, 2);
                    p.rect(p.width - 12 + drift, sy, 8, 12, 2);
                }

                // Edge darkening (film frame)
                p.noFill();
                p.stroke(0, 0, 0, 25);
                p.strokeWeight(30);
                p.rect(0, 0, p.width, p.height);

                // Beat: expansion burst on all blobs
                if (pulse > 0.4) {
                    for (const blob of blobs) {
                        blob.expansion += 0.3;
                        blob.growRate *= 1.1;
                    }
                    if (blobs.length < MAX_BLOBS) spawnBlob();
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (gfx) gfx.remove();
                gfx = p.createGraphics(p.width, p.height);
                gfx.colorMode(gfx.HSB, 360, 100, 100, 100);
                gfx.background(0, 0, 0);
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

window.VJamFX.presets['film-burn'] = FilmBurnPreset;
})();
