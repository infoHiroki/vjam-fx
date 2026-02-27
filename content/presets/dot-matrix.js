(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class DotMatrixPreset extends BasePreset {
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
            const RES = 6;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.noSmooth();
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.noStroke();
            };

            p.draw = () => {
                const t = p.frameCount * 0.008 * preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;

                const w = pg.width;
                const h = pg.height;
                const cellSize = 1; // Each pixel = one dot cell in low-res

                pg.background(0);

                // Beat wave distortion
                const waveAmp = pulse * 3;
                const waveFreq = 0.2 + treble * 0.3;

                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        // Perlin noise brightness
                        const nx = x * 0.04 + t * 1.2;
                        const ny = y * 0.04 + t * 0.6;
                        const nz = t * 0.4 + bass;
                        let bri = pg.noise(nx, ny, nz);

                        // Wave distortion on beat
                        if (waveAmp > 0.1) {
                            const wave = Math.sin(y * waveFreq + t * 10) * waveAmp;
                            bri += wave * 0.1;
                        }

                        bri = Math.max(0, Math.min(1, bri));

                        // Dot size proportional to brightness
                        const maxR = cellSize * 0.5;
                        const dotR = bri * maxR;

                        if (dotR < 0.05) continue;

                        // Color: white base, tinted by audio
                        let r = 220 + bri * 35;
                        let g = 220 + bri * 35;
                        let b = 220 + bri * 35;

                        // Audio color tinting
                        r += bass * 60;
                        g -= bass * 20;
                        b += treble * 50;

                        // Beat flash
                        if (pulse > 0.3) {
                            r = Math.min(255, r + pulse * 40);
                            g = Math.min(255, g + pulse * 40);
                            b = Math.min(255, b + pulse * 40);
                        }

                        pg.fill(
                            Math.min(255, Math.max(0, r)),
                            Math.min(255, Math.max(0, g)),
                            Math.min(255, Math.max(0, b))
                        );
                        pg.ellipse(
                            x + 0.5,
                            y + 0.5,
                            dotR * 2,
                            dotR * 2
                        );
                    }
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
window.VJamFX.presets['dot-matrix'] = DotMatrixPreset;
})();
