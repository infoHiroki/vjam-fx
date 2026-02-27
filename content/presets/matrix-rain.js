(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class MatrixRainPreset extends BasePreset {
    constructor() {
        super();
        this.params = {
            columnWidth: 18,
            baseSpeed: 1.2,
        };
        this.columns = [];
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.flashAlpha = 0;
        this.userChars = [];
    }

    setup(container) {
        this.destroy();
        this.columns = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.background(0);
                p.textFont('monospace');
                preset._initColumns(p);
            };

            p.draw = () => {
                // Fade trail
                p.fill(0, 0, 0, 25);
                p.noStroke();
                p.rect(0, 0, p.width, p.height);

                const speed = preset.params.baseSpeed * (1 + preset.audio.bass * 1);
                const colW = preset.params.columnWidth;
                const hueBase = 120; // Green base

                preset.flashAlpha *= 0.88;

                for (const col of preset.columns) {
                    col.y += speed * col.speed;

                    // Reset when off screen
                    if (col.y - col.length * colW > p.height) {
                        col.y = -Math.random() * p.height * 0.5;
                        col.speed = 0.5 + Math.random() * 1.5;
                        col.length = 8 + Math.floor(Math.random() * 20);
                        col.chars = preset._randomChars(col.length);
                    }

                    // Randomly change characters
                    if (Math.random() < 0.05 + preset.audio.treble * 0.1) {
                        const idx = Math.floor(Math.random() * col.chars.length);
                        col.chars[idx] = preset._randomChar();
                    }

                    p.textSize(colW - 2);
                    p.textAlign(p.CENTER, p.TOP);

                    for (let i = 0; i < col.length; i++) {
                        const cy = col.y - i * colW;
                        if (cy < -colW || cy > p.height + colW) continue;

                        const ratio = i / col.length;
                        const alpha = (1 - ratio) * 80;

                        if (i === 0) {
                            // Head: bright white-green
                            p.fill(hueBase, 20, 100, 90);
                        } else {
                            // Trail: green gradient
                            const hue = (hueBase + preset.audio.mid * 40) % 360;
                            const bri = p.lerp(80, 20, ratio);
                            p.fill(hue, 70, bri, alpha);
                        }

                        p.text(col.chars[i], col.x + colW / 2, cy);
                    }
                }

                // Beat flash overlay
                if (preset.flashAlpha > 1) {
                    p.fill(120, 80, 100, preset.flashAlpha);
                    p.rect(0, 0, p.width, p.height);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                p.background(0);
                preset._initColumns(p);
            };
        }, container);
    }

    _initColumns(p) {
        this.columns = [];
        const colW = this.params.columnWidth;
        const numCols = Math.ceil(p.width / colW);

        for (let i = 0; i < numCols; i++) {
            const length = 8 + Math.floor(Math.random() * 20);
            this.columns.push({
                x: i * colW,
                y: -Math.random() * p.height,
                speed: 0.5 + Math.random() * 1.5,
                length,
                chars: this._randomChars(length),
            });
        }
    }

    _randomChars(count) {
        const chars = [];
        for (let i = 0; i < count; i++) {
            chars.push(this._randomChar());
        }
        return chars;
    }

    _randomChar() {
        // If user text is set, use ONLY those characters
        if (this.userChars.length > 0) {
            return this.userChars[Math.floor(Math.random() * this.userChars.length)];
        }
        const sets = [
            () => String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)), // Katakana
            () => String.fromCharCode(48 + Math.floor(Math.random() * 10)),      // Digits
            () => '~!@#$%^&*<>?'[Math.floor(Math.random() * 13)],               // Symbols
        ];
        return sets[Math.floor(Math.random() * sets.length)]();
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
        this.audio.strength = audioData.strength || 0;
    }

    setParam(key, value) {
        super.setParam(key, value);
        if (key === 'text' && value) {
            this.userChars = [...value];
            // Refresh all column chars to use new text immediately
            for (const col of this.columns) {
                col.chars = this._randomChars(col.length);
            }
        }
    }

    onBeat(strength) {
        if (strength > 0.5) {
            this.flashAlpha = strength * 15;
        }
        // Speed burst on beat
        for (const col of this.columns) {
            col.speed += strength * 0.8;
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['matrix-rain'] = MatrixRainPreset;
})();
