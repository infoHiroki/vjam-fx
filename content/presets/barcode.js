import { BasePreset } from '../base-preset.js';

class BarcodePreset extends BasePreset {
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
            let bars = [];
            let scrollOffset = 0;

            function generateBars() {
                bars = [];
                let x = 0;
                while (x < p.width * 2) {
                    const w = Math.random() < 0.5
                        ? Math.floor(Math.random() * 3) + 1
                        : Math.floor(Math.random() * 8) + 3;
                    const isBlack = bars.length % 2 === 0;
                    bars.push({ x, w, black: isBlack });
                    x += w;
                }
            }

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.noStroke();
                generateBars();
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;

                // Scroll left to right
                scrollOffset += (1 + bass * 3 + pulse * 5) * speed;

                // Inversion flash on beat
                const invert = pulse > 0.5;

                p.background(invert ? 0 : 255);

                // Bar width modulation from audio
                const widthMod = 1 + mid * 0.5 + treble * 0.3;

                for (const bar of bars) {
                    const bx = ((bar.x * widthMod - scrollOffset) % (p.width * 2) + p.width * 2) % (p.width * 2) - p.width * 0.5;

                    if (bx > p.width + 20 || bx + bar.w * widthMod < -20) continue;

                    const drawBlack = invert ? !bar.black : bar.black;

                    if (drawBlack) {
                        // Color tinting from audio
                        let r = 0, g = 0, b = 0;
                        if (bass > 0.4) {
                            r = bass * 60;
                        }
                        if (treble > 0.4) {
                            b = treble * 60;
                        }
                        p.fill(r, g, b);
                    } else {
                        let r = 255, g = 255, b = 255;
                        if (bass > 0.4) {
                            g -= bass * 30;
                            b -= bass * 30;
                        }
                        p.fill(r, g, b);
                    }

                    p.rect(bx, 0, bar.w * widthMod + 1, p.height);
                }

                // Beat: regenerate bars for variety
                if (pulse > 0.6 && Math.random() < 0.3) {
                    generateBars();
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                generateBars();
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

export { BarcodePreset };
if (typeof window !== 'undefined') {
    window.VJamFX = window.VJamFX || { presets: {} };
    window.VJamFX.presets['barcode'] = BarcodePreset;
}
