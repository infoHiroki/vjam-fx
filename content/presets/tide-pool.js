(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class TidePoolPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.sources = [];
    }

    setup(container) {
        this.destroy();
        this.sources = [];
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;
            const RES = 4;

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
                // Seed initial wave sources
                for (let i = 0; i < 3; i++) {
                    preset.sources.push({
                        x: Math.random() * pg.width,
                        y: Math.random() * pg.height,
                        birth: 0,
                        freq: 0.08 + Math.random() * 0.04,
                        amp: 0.6 + Math.random() * 0.4,
                    });
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.93;
                const t = p.frameCount * 0.04 * speed;

                const w = pg.width;
                const h = pg.height;
                const step = 2;

                pg.background(200, 60, 10);

                for (let y = 0; y < h; y += step) {
                    for (let x = 0; x < w; x += step) {
                        let val = 0;

                        // Sum wave contributions from all sources
                        for (const src of preset.sources) {
                            const dx = x - src.x;
                            const dy = y - src.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            const age = t - src.birth;
                            if (age <= 0) continue;
                            // Expanding concentric wave
                            const wave = Math.sin(dist * src.freq - age * 2) * src.amp;
                            // Fade with distance and age
                            const distFade = 1 / (1 + dist * 0.02);
                            const ageFade = Math.max(0, 1 - age * 0.005);
                            val += wave * distFade * ageFade;
                        }

                        // Map wave value to color (water caustics)
                        const intensity = (val + 1) * 0.5; // normalize to 0-1
                        const hue = 190 + intensity * 30 + preset.audio.mid * 20;
                        const sat = 40 + intensity * 30;
                        const bri = 15 + intensity * 50 + pulse * 15;

                        // Caustic highlights
                        if (intensity > 0.7) {
                            pg.fill(185, 20, Math.min(100, bri + 30), 90);
                        } else {
                            pg.fill(hue, sat, Math.min(100, bri), 85);
                        }
                        pg.rect(x, y, step, step);
                    }
                }

                // Remove old sources
                preset.sources = preset.sources.filter(s => {
                    const age = t - s.birth;
                    return age < 200;
                });

                // Periodically add new sources
                if (p.frameCount % 90 === 0 && preset.sources.length < 8) {
                    preset.sources.push({
                        x: Math.random() * w,
                        y: Math.random() * h,
                        birth: t,
                        freq: 0.08 + Math.random() * 0.04,
                        amp: 0.4 + Math.random() * 0.3,
                    });
                }

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
                // Rescale sources
                for (const src of preset.sources) {
                    src.x = Math.min(src.x, pg.width);
                    src.y = Math.min(src.y, pg.height);
                }
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
        if (strength > 0.3 && this.p5) {
            const pg = this.p5;
            this.sources.push({
                x: Math.random() * (this.p5.width / 4),
                y: Math.random() * (this.p5.height / 4),
                birth: this.p5.frameCount * 0.04 * this.params.speed,
                freq: 0.06 + Math.random() * 0.06,
                amp: 0.5 + strength * 0.5,
            });
            // Cap sources
            if (this.sources.length > 12) {
                this.sources.splice(0, this.sources.length - 12);
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['tide-pool'] = TidePoolPreset;
})();
