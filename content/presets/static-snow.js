(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// Key 6 - Set E: 古いTVの砂嵐ノイズ全面fill
class StaticSnowPreset extends BasePreset {
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
            let pg;
            const RES = 3;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.noSmooth();
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.noStroke();
            };

            p.draw = () => {
                const t = p.frameCount;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                preset.beatPulse *= 0.9;

                const w = pg.width;
                const h = pg.height;
                const step = 2;

                pg.background(0);

                // Rolling band of interference
                const bandY = (t * 2 * preset.params.speed) % (h + 40) - 20;
                const bandHeight = 15 + preset.beatPulse * 20;

                for (let y = 0; y < h; y += step) {
                    for (let x = 0; x < w; x += step) {
                        // Base static noise
                        let bri = Math.random() * 50;

                        // Brighter near interference band
                        const distToBand = Math.abs(y - bandY);
                        if (distToBand < bandHeight) {
                            bri += (1 - distToBand / bandHeight) * 40;
                        }

                        // Audio reactivity
                        bri += bass * 20 + mid * 10;
                        bri += preset.beatPulse * 30;

                        // Scanline darkening (every other line)
                        if (y % 4 < 2) bri *= 0.7;

                        // Occasional horizontal noise line
                        if (Math.random() < 0.003 + preset.beatPulse * 0.01) {
                            bri = 60 + Math.random() * 40;
                        }

                        bri = Math.min(100, bri);
                        if (bri < 5) continue;

                        // Slight color tint
                        const tint = Math.random();
                        if (tint < 0.02) {
                            // Rare color pixel
                            pg.fill(
                                Math.random() * 255,
                                Math.random() * 100,
                                bri * 2.55
                            );
                        } else {
                            const v = bri * 2.55;
                            pg.fill(v, v * 0.98, v * 0.95);
                        }
                        pg.rect(x, y, step, step);
                    }
                }

                // Horizontal sync glitch on beat
                if (preset.beatPulse > 0.4) {
                    const glitchY = Math.random() * h;
                    const glitchH = 3 + Math.random() * 8;
                    pg.fill(180, 180, 180, 100);
                    pg.rect(0, glitchY, w, glitchH);
                }

                p.image(pg, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.noStroke();
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
window.VJamFX.presets['static-snow'] = StaticSnowPreset;
})();
