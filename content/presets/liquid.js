(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class LiquidPreset extends BasePreset {
        constructor() {
            super();
            this.params = { speed: 1 };
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.beatPulse = 0;
            this.blobs = [];
        }

        setup(container) {
            this.destroy();
            const preset = this;

            this.p5 = new p5((p) => {
                let pg;
                const RES = 4;
                const BLOB_COUNT = 8;

                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.noSmooth();
                    pg = p.createGraphics(
                        Math.ceil(p.width / RES),
                        Math.ceil(p.height / RES)
                    );
                    pg.colorMode(p.HSB, 360, 100, 100, 100);
                    pg.noStroke();

                    // Init blobs
                    preset.blobs = [];
                    for (let i = 0; i < BLOB_COUNT; i++) {
                        preset.blobs.push({
                            x: Math.random() * pg.width,
                            y: Math.random() * pg.height,
                            vx: (Math.random() - 0.5) * 1.5,
                            vy: (Math.random() - 0.5) * 1.5,
                            radius: 15 + Math.random() * 20,
                            hue: Math.random() * 360,
                        });
                    }
                };

                p.draw = () => {
                    const bass = preset.audio.bass;
                    const mid = preset.audio.mid;
                    const pulse = preset.beatPulse;
                    preset.beatPulse *= 0.92;

                    const w = pg.width;
                    const h = pg.height;
                    const step = 2;

                    pg.background(0, 0, 0, 100);

                    // Update blobs
                    for (const blob of preset.blobs) {
                        blob.x += blob.vx * preset.params.speed;
                        blob.y += blob.vy * preset.params.speed;

                        // Bounce
                        if (blob.x < 0 || blob.x > w) blob.vx *= -1;
                        if (blob.y < 0 || blob.y > h) blob.vy *= -1;
                        blob.x = p.constrain(blob.x, 0, w);
                        blob.y = p.constrain(blob.y, 0, h);

                        // Beat: repel from center
                        if (pulse > 0.3) {
                            const cx = w / 2;
                            const cy = h / 2;
                            const dx = blob.x - cx;
                            const dy = blob.y - cy;
                            const dist = Math.sqrt(dx * dx + dy * dy) + 1;
                            blob.vx += (dx / dist) * pulse * 2;
                            blob.vy += (dy / dist) * pulse * 2;
                        }

                        // Damping
                        blob.vx *= 0.98;
                        blob.vy *= 0.98;
                    }

                    // Metaball field
                    for (let y = 0; y < h; y += step) {
                        for (let x = 0; x < w; x += step) {
                            let sum = 0;
                            let hueSum = 0;
                            let hueWeight = 0;

                            for (const blob of preset.blobs) {
                                const dx = x - blob.x;
                                const dy = y - blob.y;
                                const r = blob.radius * (1 + bass * 0.8);
                                const d2 = dx * dx + dy * dy;
                                const influence = (r * r) / (d2 + 1);
                                sum += influence;
                                hueSum += blob.hue * influence;
                                hueWeight += influence;
                            }

                            if (sum < 0.8) continue;

                            const hue = (hueWeight > 0 ? hueSum / hueWeight : 200) % 360;
                            const bri = Math.min(100, sum * 40 + pulse * 20);
                            const sat = 60 + mid * 30;

                            pg.fill(hue, sat, bri, 80);
                            pg.rect(x, y, step, step);
                        }
                    }

                    p.image(pg, 0, 0, p.width, p.height);
                };

                p.windowResized = () => {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
                    if (pg) pg.remove();
                    const oldBlobs = preset.blobs;
                    pg = p.createGraphics(
                        Math.ceil(p.width / RES),
                        Math.ceil(p.height / RES)
                    );
                    pg.colorMode(p.HSB, 360, 100, 100, 100);
                    pg.noStroke();
                    // Rescale blob positions
                    for (const blob of oldBlobs) {
                        blob.x = Math.min(blob.x, pg.width);
                        blob.y = Math.min(blob.y, pg.height);
                    }
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

    window.VJamFX.presets['liquid'] = LiquidPreset;
})();
