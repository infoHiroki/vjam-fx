(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

const FONT = {
    'A': [0x04,0x0A,0x11,0x1F,0x11],
    'B': [0x1E,0x11,0x1E,0x11,0x1E],
    'C': [0x0E,0x11,0x10,0x11,0x0E],
    'D': [0x1E,0x11,0x11,0x11,0x1E],
    'E': [0x1F,0x10,0x1E,0x10,0x1F],
    'F': [0x1F,0x10,0x1E,0x10,0x10],
    'G': [0x0E,0x11,0x17,0x11,0x0F],
    'H': [0x11,0x11,0x1F,0x11,0x11],
    'I': [0x0E,0x04,0x04,0x04,0x0E],
    'J': [0x01,0x01,0x01,0x11,0x0E],
    'K': [0x11,0x12,0x1C,0x12,0x11],
    'L': [0x10,0x10,0x10,0x10,0x1F],
    'M': [0x11,0x1B,0x15,0x11,0x11],
    'N': [0x11,0x19,0x15,0x13,0x11],
    'O': [0x0E,0x11,0x11,0x11,0x0E],
    'P': [0x1E,0x11,0x1E,0x10,0x10],
    'Q': [0x0E,0x11,0x15,0x12,0x0D],
    'R': [0x1E,0x11,0x1E,0x12,0x11],
    'S': [0x0F,0x10,0x0E,0x01,0x1E],
    'T': [0x1F,0x04,0x04,0x04,0x04],
    'U': [0x11,0x11,0x11,0x11,0x0E],
    'V': [0x11,0x11,0x11,0x0A,0x04],
    'W': [0x11,0x11,0x15,0x1B,0x11],
    'X': [0x11,0x0A,0x04,0x0A,0x11],
    'Y': [0x11,0x0A,0x04,0x04,0x04],
    'Z': [0x1F,0x02,0x04,0x08,0x1F],
    '0': [0x0E,0x13,0x15,0x19,0x0E],
    '1': [0x04,0x0C,0x04,0x04,0x0E],
    '2': [0x0E,0x01,0x06,0x08,0x1F],
    '3': [0x1E,0x01,0x0E,0x01,0x1E],
    '4': [0x12,0x12,0x1F,0x02,0x02],
    '5': [0x1F,0x10,0x1E,0x01,0x1E],
    '6': [0x0E,0x10,0x1E,0x11,0x0E],
    '7': [0x1F,0x01,0x02,0x04,0x04],
    '8': [0x0E,0x11,0x0E,0x11,0x0E],
    '9': [0x0E,0x11,0x0F,0x01,0x0E],
    ' ': [0x00,0x00,0x00,0x00,0x00],
    '.': [0x00,0x00,0x00,0x00,0x04],
    '!': [0x04,0x04,0x04,0x00,0x04],
    '-': [0x00,0x00,0x0E,0x00,0x00],
};

const MESSAGES = [
    'CYBER VJ SYSTEM ONLINE',
    'BEAT DROP INCOMING',
    'NEON DREAMS',
    '2026 FUTURE SOUND',
    'VISUALIZE THE BASS',
    'LETS GO',
    'FREQUENCY SHIFT',
];

// Pattern modes for the background LED animation
const PATTERN_WAVE = 0;
const PATTERN_RAIN = 1;
const PATTERN_DIAMOND = 2;
const PATTERN_PULSE = 3;
const PATTERN_CHECKER = 4;
const NUM_PATTERNS = 5;

class LedMatrixPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.scrollX = 0;
        this.msgIndex = 0;
        this.userMessages = [];
        this.patternMode = 0;
        this.hueShift = 0;
        this.beatCount = 0;
        this.flashAlpha = 0;
        // Color palettes: [primary, secondary, accent]
        this.palettes = [
            [[0, 255, 100], [0, 180, 255], [255, 255, 60]],
            [[255, 50, 200], [100, 50, 255], [255, 100, 50]],
            [[0, 255, 255], [255, 100, 200], [100, 255, 150]],
            [[255, 140, 0], [255, 60, 60], [255, 255, 100]],
            [[120, 80, 255], [0, 255, 180], [255, 200, 50]],
        ];
        this.paletteIdx = 0;
    }

    setup(container) {
        this.destroy();
        this.scrollX = 0;
        const preset = this;

        this.p5 = new p5((p) => {
            const spacing = 10;
            const dotRadius = 4;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.noStroke();
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.9;
                preset.flashAlpha *= 0.88;
                preset.hueShift += 0.3 + preset.audio.rms * 2;

                const cols = Math.floor(p.width / spacing);
                const rows = Math.floor(p.height / spacing);
                // If user text is set, use ONLY that text
                const msgs = preset.userMessages.length > 0
                    ? preset.userMessages
                    : MESSAGES;
                const msg = msgs[preset.msgIndex % msgs.length];
                const charWidth = 6;
                const totalWidth = msg.length * charWidth;
                const pal = preset.palettes[preset.paletteIdx % preset.palettes.length];
                const primary = pal[0];
                const secondary = pal[1];
                const accent = pal[2];

                // Scroll text
                preset.scrollX += 0.2 + preset.audio.rms * 0.5;
                if (preset.scrollX > totalWidth) {
                    preset.scrollX -= totalWidth;
                    preset.msgIndex++;
                }

                const brightMul = 1 + preset.beatPulse * 0.6;
                const textRowStart = Math.floor((rows - 7) / 2);
                const time = p.frameCount;

                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        const x = col * spacing + spacing / 2;
                        const y = row * spacing + spacing / 2;

                        // Check text band
                        const textRow = row - textRowStart;
                        let isTextLit = false;

                        if (textRow >= 0 && textRow < 5) {
                            const scrollCol = col + Math.floor(preset.scrollX);
                            const sc = ((scrollCol % (totalWidth)) + totalWidth) % totalWidth;
                            const charIdx = Math.floor(sc / charWidth);
                            const charCol = sc % charWidth;
                            if (charIdx < msg.length && charCol < 5) {
                                const ch = msg.charAt(charIdx);
                                const glyph = FONT[ch.toUpperCase()] || FONT[' '];
                                if (glyph[textRow] & (0x10 >> charCol)) {
                                    isTextLit = true;
                                }
                            }
                        }

                        if (isTextLit) {
                            // Scrolling rainbow on text LEDs
                            const hueT = ((col + time * 0.5) % 60) / 60;
                            const tr = preset._lerpColor(primary, accent, hueT);
                            const br = Math.min(255, brightMul * 255);
                            p.fill(
                                Math.min(255, tr[0] * brightMul),
                                Math.min(255, tr[1] * brightMul),
                                Math.min(255, tr[2] * brightMul),
                                br
                            );
                            p.ellipse(x, y, dotRadius * 2.2, dotRadius * 2.2);
                            // Glow halo
                            p.fill(tr[0], tr[1], tr[2], 35);
                            p.ellipse(x, y, dotRadius * 4.5, dotRadius * 4.5);
                        } else {
                            // Background pattern LEDs
                            const patBrightness = preset._getPatternBrightness(
                                col, row, cols, rows, time, preset.patternMode
                            );

                            if (patBrightness > 0.05) {
                                // Color based on position and pattern
                                const gradT = (col / cols + row / rows) * 0.5;
                                const pc = preset._lerpColor(secondary, primary, gradT);
                                const alpha = patBrightness * (80 + preset.audio.bass * 80);
                                const bMul = 0.4 + patBrightness * 0.6;
                                p.fill(
                                    Math.min(255, pc[0] * bMul),
                                    Math.min(255, pc[1] * bMul),
                                    Math.min(255, pc[2] * bMul),
                                    alpha
                                );
                                p.ellipse(x, y, dotRadius * 1.6 * patBrightness + 1, dotRadius * 1.6 * patBrightness + 1);
                            } else {
                                // Dim unlit LED
                                p.fill(15, 15, 25, 120);
                                p.ellipse(x, y, dotRadius * 0.7, dotRadius * 0.7);
                            }
                        }
                    }
                }

                // Top and bottom border bars (accent color, treble-reactive)
                const barH = 3;
                const barRows = Math.ceil(barH * 2 / spacing);
                for (let br = 0; br < barRows; br++) {
                    for (let col = 0; col < cols; col++) {
                        const wave = Math.sin(col * 0.15 + time * 0.08) * 0.5 + 0.5;
                        const trebleBoost = preset.audio.treble * 0.8;
                        const alpha = (wave * 0.6 + trebleBoost) * 200;
                        if (alpha > 30) {
                            p.fill(accent[0], accent[1], accent[2], alpha);
                            const x = col * spacing + spacing / 2;
                            p.ellipse(x, br * spacing + spacing / 2, dotRadius * 1.2, dotRadius * 1.2);
                            p.ellipse(x, p.height - br * spacing - spacing / 2, dotRadius * 1.2, dotRadius * 1.2);
                        }
                    }
                }

                // Beat flash overlay
                if (preset.flashAlpha > 5) {
                    p.fill(accent[0], accent[1], accent[2], preset.flashAlpha);
                    p.rect(0, 0, p.width, p.height);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _lerpColor(c1, c2, t) {
        t = Math.max(0, Math.min(1, t));
        return [
            c1[0] + (c2[0] - c1[0]) * t,
            c1[1] + (c2[1] - c1[1]) * t,
            c1[2] + (c2[2] - c1[2]) * t,
        ];
    }

    _getPatternBrightness(col, row, cols, rows, time, mode) {
        switch (mode) {
            case PATTERN_WAVE: {
                // Horizontal sine wave
                const wave = Math.sin(col * 0.2 - time * 0.04 + row * 0.1);
                return Math.max(0, wave);
            }
            case PATTERN_RAIN: {
                // Vertical rain drops
                const drop = Math.sin(row * 0.3 + col * 1.7 - time * 0.1);
                return drop > 0.6 ? (drop - 0.6) * 2.5 : 0;
            }
            case PATTERN_DIAMOND: {
                // Expanding diamond from center
                const cx = cols / 2;
                const cy = rows / 2;
                const dist = Math.abs(col - cx) + Math.abs(row - cy);
                const ring = (dist - time * 0.15) % 12;
                return ring > 0 && ring < 3 ? (3 - ring) / 3 : 0;
            }
            case PATTERN_PULSE: {
                // Radial pulse from center
                const dx = col - cols / 2;
                const dy = row - rows / 2;
                const d = Math.sqrt(dx * dx + dy * dy);
                const ring = Math.sin(d * 0.3 - time * 0.08);
                return Math.max(0, ring);
            }
            case PATTERN_CHECKER: {
                // Animated checker that shifts
                const shift = Math.floor(time * 0.03);
                const on = ((col + shift) % 4 < 2) !== ((row + shift) % 4 < 2);
                return on ? 0.7 : 0;
            }
            default:
                return 0;
        }
    }

    setParam(key, value) {
        super.setParam(key, value);
        if (key === 'text' && value) {
            this.userMessages = [value.toUpperCase()];
        }
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        this.beatCount++;
        this.flashAlpha = strength * 30;

        // Change pattern every 4 beats
        if (this.beatCount % 4 === 0) {
            this.patternMode = (this.patternMode + 1) % NUM_PATTERNS;
        }
        // Change palette every 8 beats
        if (this.beatCount % 8 === 0) {
            this.paletteIdx = (this.paletteIdx + 1) % this.palettes.length;
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['led-matrix'] = LedMatrixPreset;
})();
