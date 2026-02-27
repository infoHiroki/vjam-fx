(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// Matrix movie-style green code rain — ASCII only, no Japanese characters
class MatrixCodePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.columns = [];
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.flashAlpha = 0;
    }

    setup(container) {
        this.destroy();
        this.columns = [];
        const preset = this;

        this.p5 = new p5((p) => {
            // ASCII characters only — digits, uppercase, symbols (like the movie)
            const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%&*+-=<>?/\\|{}[]()~^';
            const COL_W = 16;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.background(0);
                p.textFont('monospace');
                preset._initColumns(p, COL_W, CHARS);
            };

            p.draw = () => {
                // Fade trail — slow fade for long persistence (movie look)
                p.fill(0, 0, 0, 18);
                p.noStroke();
                p.rect(0, 0, p.width, p.height);

                const speed = preset.params.speed * (1 + preset.audio.bass * 0.8);
                preset.flashAlpha *= 0.85;

                for (const col of preset.columns) {
                    col.y += speed * col.speed;

                    // Reset when off screen
                    if (col.y - col.length * COL_W > p.height) {
                        col.y = -Math.random() * p.height * 0.5;
                        col.speed = 0.4 + Math.random() * 1.2;
                        col.length = 10 + Math.floor(Math.random() * 25);
                        col.chars = preset._makeChars(col.length, CHARS);
                    }

                    // Random char change
                    if (Math.random() < 0.04 + preset.audio.treble * 0.06) {
                        const idx = Math.floor(Math.random() * col.chars.length);
                        col.chars[idx] = CHARS[Math.floor(Math.random() * CHARS.length)];
                    }

                    p.textSize(COL_W - 2);
                    p.textAlign(p.CENTER, p.TOP);

                    for (let i = 0; i < col.length; i++) {
                        const cy = col.y - i * COL_W;
                        if (cy < -COL_W || cy > p.height + COL_W) continue;

                        const ratio = i / col.length;

                        if (i === 0) {
                            // Head: bright white-green glow
                            p.fill(200, 255, 200, 240);
                        } else if (i < 3) {
                            // Near-head: bright green
                            p.fill(0, 255, 70, 200 - i * 20);
                        } else {
                            // Trail: fading green
                            const alpha = (1 - ratio) * 160;
                            const green = p.lerp(255, 80, ratio);
                            p.fill(0, green, 0, alpha);
                        }

                        p.text(col.chars[i], col.x + COL_W / 2, cy);
                    }
                }

                // Beat flash
                if (preset.flashAlpha > 1) {
                    p.fill(0, 255, 70, preset.flashAlpha);
                    p.rect(0, 0, p.width, p.height);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                p.background(0);
                preset._initColumns(p, COL_W, CHARS);
            };
        }, container);
    }

    _initColumns(p, colW, chars) {
        this.columns = [];
        const numCols = Math.ceil(p.width / colW);

        for (let i = 0; i < numCols; i++) {
            const length = 10 + Math.floor(Math.random() * 25);
            this.columns.push({
                x: i * colW,
                y: -Math.random() * p.height,
                speed: 0.4 + Math.random() * 1.2,
                length,
                chars: this._makeChars(length, chars),
            });
        }
    }

    _makeChars(count, chars) {
        const arr = [];
        for (let i = 0; i < count; i++) {
            arr.push(chars[Math.floor(Math.random() * chars.length)]);
        }
        return arr;
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        if (strength > 0.5) {
            this.flashAlpha = strength * 12;
        }
        for (const col of this.columns) {
            col.speed += strength * 0.5;
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['matrix-code'] = MatrixCodePreset;
})();
