(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class SmokePreset extends BasePreset {
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
                let pg;
                const RES = 4; // draw at 1/4 resolution for performance

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
                    const step = 3;

                    pg.background(0, 0, 0, 100);

                    for (let y = 0; y < h; y += step) {
                        for (let x = 0; x < w; x += step) {
                            const nx = x * 0.02 + t;
                            const ny = y * 0.02 + t * 0.6;

                            const n1 = pg.noise(nx, ny);
                            const n2 = pg.noise(nx + 100, ny + 100, t * 0.5);

                            const val = (n1 + n2 * 0.5) / 1.5;
                            const bri = val * 40 + bass * 30 + pulse * 25;

                            if (bri < 3) continue; // skip dark pixels

                            const hue = (220 + mid * 120 + n2 * 60 + treble * 40) % 360;
                            const sat = 15 + treble * 30;

                            pg.fill(hue, sat, Math.min(100, bri), 70);
                            pg.rect(x, y, step, step);
                        }
                    }

                    // Upscale to canvas
                    p.image(pg, 0, 0, p.width, p.height);
                };

                p.windowResized = () => {
                    p.resizeCanvas(container.clientWidth, container.clientHeight);
                    if (pg) pg.remove();
                    pg = p.createGraphics(
                        Math.ceil(p.width / RES),
                        Math.ceil(p.height / RES)
                    );
                    pg.colorMode(p.HSB, 360, 100, 100, 100);
                    pg.noStroke();
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

    window.VJamFX.presets['smoke'] = SmokePreset;
})();
