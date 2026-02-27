(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class AsciiArtPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.userChars = '';
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;
            const RES = 8;
            const DEFAULT_CHARS = ' .:-=+*#%@';
            let font;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                p.textFont('monospace');
                p.textAlign(p.LEFT, p.TOP);
                p.noStroke();
            };

            p.draw = () => {
                const t = p.frameCount * 0.01 * preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;

                const cols = pg.width;
                const rows = pg.height;

                // Generate brightness via Perlin noise
                pg.loadPixels();
                for (let y = 0; y < rows; y++) {
                    for (let x = 0; x < cols; x++) {
                        const nx = x * 0.05 + t * 0.8;
                        const ny = y * 0.05 + t * 0.3;
                        const nz = t * 0.5 + bass * 2;
                        const n = pg.noise(nx, ny, nz);
                        const bri = Math.floor(n * 255);
                        const idx = (y * cols + x) * 4;
                        pg.pixels[idx] = bri;
                        pg.pixels[idx + 1] = bri;
                        pg.pixels[idx + 2] = bri;
                        pg.pixels[idx + 3] = 255;
                    }
                }
                pg.updatePixels();

                p.background(0);

                // Character cell size
                const cellW = p.width / cols;
                const cellH = p.height / rows;
                const fontSize = Math.max(6, Math.min(cellW, cellH) * 1.2);
                p.textSize(fontSize);

                // Color: amber/green terminal style
                let baseR, baseG, baseB;
                if (mid > 0.5) {
                    // Green terminal
                    baseR = 30;
                    baseG = 255;
                    baseB = 60;
                } else {
                    // Amber terminal
                    baseR = 255;
                    baseG = 180;
                    baseB = 30;
                }

                // Beat flash: bright white
                if (pulse > 0.3) {
                    const flash = pulse * 0.6;
                    baseR = p.lerp(baseR, 255, flash);
                    baseG = p.lerp(baseG, 255, flash);
                    baseB = p.lerp(baseB, 255, flash);
                }

                const CHARS = preset.userChars.length > 2
                    ? ' ' + preset.userChars
                    : DEFAULT_CHARS;
                pg.loadPixels();
                for (let y = 0; y < rows; y++) {
                    for (let x = 0; x < cols; x++) {
                        const idx = (y * cols + x) * 4;
                        const bri = pg.pixels[idx] / 255;
                        const charIdx = Math.floor(bri * (CHARS.length - 1));
                        const ch = CHARS[charIdx];
                        if (ch === ' ') continue;

                        const alpha = 80 + bri * 175;
                        p.fill(baseR, baseG, baseB, alpha);
                        p.text(ch, x * cellW, y * cellH);
                    }
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
            };
        }, container);
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    setParam(key, value) {
        super.setParam(key, value);
        if (key === 'text' && value) {
            this.userChars = value;
        }
    }

    onBeat(strength) {
        this.beatPulse = strength;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['ascii-art'] = AsciiArtPreset;
})();
