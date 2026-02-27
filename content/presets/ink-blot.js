(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class InkBlotPreset extends BasePreset {
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
            const RES = 4;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.noSmooth();
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.noSmooth();
            };

            p.draw = () => {
                const t = p.frameCount * 0.004 * preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;

                const w = pg.width;
                const h = pg.height;
                const halfW = w / 2;
                const cy = h / 2;

                pg.loadPixels();

                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < halfW; x++) {
                        // Noise-based ink pattern
                        const nx = x * 0.03 + t;
                        const ny = y * 0.03 + t * 0.3;

                        const n1 = pg.noise(nx, ny, t * 0.5);
                        const n2 = pg.noise(nx * 2, ny * 2, t * 0.8);
                        const n3 = pg.noise(nx * 0.5, ny * 0.5, t * 0.2);

                        // Combine noise layers
                        let val = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

                        // Audio reactivity
                        val += bass * 0.2;
                        val += pulse * 0.15;

                        // Distance from center for vignette
                        const dx = (x - halfW) / halfW;
                        const dy = (y - cy) / cy;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        val -= dist * 0.2;

                        // Threshold for ink effect
                        const threshold = 0.45 - bass * 0.1 - pulse * 0.08;
                        let bri;
                        if (val > threshold + 0.1) {
                            // Solid ink
                            bri = 10 + treble * 20;
                        } else if (val > threshold) {
                            // Edge: ink wash
                            const edge = (val - threshold) / 0.1;
                            bri = 10 + (1 - edge) * 30 + mid * 10;
                        } else {
                            // Paper (dark background for VJ)
                            bri = 3;
                        }

                        // Slight warm tint
                        const r = bri;
                        const g = bri * 0.95;
                        const b = bri * 0.85;

                        // Set pixel on left side
                        const idx = (y * w + x) * 4;
                        pg.pixels[idx] = r;
                        pg.pixels[idx + 1] = g;
                        pg.pixels[idx + 2] = b;
                        pg.pixels[idx + 3] = 255;

                        // Mirror to right side (Rorschach symmetry)
                        const mirrorX = w - 1 - x;
                        const mirrorIdx = (y * w + mirrorX) * 4;
                        pg.pixels[mirrorIdx] = r;
                        pg.pixels[mirrorIdx + 1] = g;
                        pg.pixels[mirrorIdx + 2] = b;
                        pg.pixels[mirrorIdx + 3] = 255;
                    }
                }

                pg.updatePixels();
                p.image(pg, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.noSmooth();
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
window.VJamFX.presets['ink-blot'] = InkBlotPreset;
})();
