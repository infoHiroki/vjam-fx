(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class OilSpillPreset extends BasePreset {
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
                const BLOB_COUNT = 20;

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

                    // Initialize blobs
                    preset.blobs = [];
                    for (let i = 0; i < BLOB_COUNT; i++) {
                        preset.blobs.push({
                            x: Math.random() * pg.width,
                            y: Math.random() * pg.height,
                            r: 30 + Math.random() * 60,
                            hueBase: Math.random() * 360,
                            speed: 0.3 + Math.random() * 0.7,
                            noiseOff: Math.random() * 1000,
                        });
                    }
                };

                p.draw = () => {
                    const t = p.frameCount * 0.008 * preset.params.speed;
                    const bass = preset.audio.bass;
                    const mid = preset.audio.mid;
                    const treble = preset.audio.treble;
                    const pulse = preset.beatPulse;
                    preset.beatPulse *= 0.92;

                    const w = pg.width;
                    const h = pg.height;

                    // Dark iridescent base
                    pg.background(0, 0, 3);

                    // Draw flowing oil blobs with rainbow sheen
                    for (const blob of preset.blobs) {
                        // Move blobs with noise-based flow
                        const nx = pg.noise(blob.noiseOff, t * blob.speed);
                        const ny = pg.noise(blob.noiseOff + 500, t * blob.speed);
                        blob.x = nx * w * 1.4 - w * 0.2;
                        blob.y = ny * h * 1.4 - h * 0.2;

                        // Rainbow sheen: multiple overlapping translucent ellipses
                        const layers = 4;
                        const baseR = blob.r * (1 + bass * 0.5 + pulse * 0.3);

                        for (let layer = layers - 1; layer >= 0; layer--) {
                            const layerT = layer / layers;
                            const r = baseR * (1 - layerT * 0.3);

                            // Cycling rainbow hue (thin-film interference simulation)
                            const hue = (blob.hueBase + layerT * 120 + mid * 80 + t * 30 + pulse * 40) % 360;
                            const sat = 60 + treble * 30;
                            const bri = 8 + layerT * 15 + mid * 12 + pulse * 10;
                            const alpha = 15 + layerT * 10;

                            pg.fill(hue, sat, bri, alpha);
                            pg.ellipse(
                                blob.x + Math.sin(t * 2 + layer) * 3,
                                blob.y + Math.cos(t * 2 + layer) * 3,
                                r * 2, r * 1.6
                            );
                        }
                    }

                    // Surface shimmer highlights
                    const shimmerCount = 6 + Math.floor(treble * 8);
                    for (let i = 0; i < shimmerCount; i++) {
                        const sx = pg.noise(i * 10, t * 0.5) * w;
                        const sy = pg.noise(i * 10 + 100, t * 0.5) * h;
                        const shimmerHue = (i * 60 + t * 20 + mid * 100) % 360;
                        const shimmerR = 10 + bass * 20 + pulse * 15;

                        pg.fill(shimmerHue, 80, 25 + pulse * 15, 20);
                        pg.ellipse(sx, sy, shimmerR * 2, shimmerR);
                    }

                    p.image(pg, 0, 0, p.width, p.height);
                };

                p.windowResized = () => {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
                    const oldBlobs = preset.blobs;
                    pg = p.createGraphics(
                        Math.ceil(p.width / RES),
                        Math.ceil(p.height / RES)
                    );
                    pg.colorMode(p.HSB, 360, 100, 100, 100);
                    pg.noStroke();
                    preset.blobs = oldBlobs;
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

    window.VJamFX.presets['oil-spill'] = OilSpillPreset;
})();
