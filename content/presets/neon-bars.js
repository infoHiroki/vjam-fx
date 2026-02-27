(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class NeonBarsPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;
        this.p5 = new p5((p) => {
            const NUM_BARS = 32;
            let barHeights = new Array(NUM_BARS).fill(0);

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.noStroke();
            };

            p.draw = () => {
                p.background(5, 5, 15);
                preset.beatPulse *= 0.9;

                const cx = p.width / 2;
                const cy = p.height / 2;
                const barW = p.width / NUM_BARS;
                const maxH = p.height * 0.45;

                for (let i = 0; i < NUM_BARS; i++) {
                    const t = i / (NUM_BARS - 1);

                    // Target height from audio or frameCount animation
                    let target;
                    if (preset.audio.rms > 0.01) {
                        const bassW = preset.audio.bass * (1 - t);
                        const midW = preset.audio.mid * (t < 0.5 ? t * 2 : (1 - t) * 2);
                        const trebW = preset.audio.treble * t;
                        target = (bassW + midW + trebW) * maxH;
                    } else {
                        target = (0.3 + 0.25 * p.sin(p.frameCount * 0.04 + i * 0.3)
                            + 0.15 * p.sin(p.frameCount * 0.07 + i * 0.5)) * maxH;
                    }
                    barHeights[i] += (target - barHeights[i]) * 0.15;

                    const h = barHeights[i];

                    // Color gradient: cyan -> magenta -> yellow
                    let r, g, b;
                    if (t < 0.5) {
                        const s = t * 2;
                        r = p.lerp(0, 255, s);
                        g = p.lerp(255, 0, s);
                        b = 255;
                    } else {
                        const s = (t - 0.5) * 2;
                        r = 255;
                        g = p.lerp(0, 255, s);
                        b = p.lerp(255, 0, s);
                    }

                    const flash = preset.beatPulse * 200;
                    const dr = p.min(255, r + flash);
                    const dg = p.min(255, g + flash);
                    const db = p.min(255, b + flash);

                    const x = i * barW;

                    // Glow layer (wider, dimmer)
                    p.fill(dr, dg, db, 40);
                    p.rect(x - 2, cy - h - 4, barW + 4, h + 4);
                    p.rect(x - 2, cy, barW + 4, h + 4);

                    // Main bar — upward from center
                    p.fill(dr, dg, db, 180);
                    p.rect(x + 1, cy - h, barW - 2, h);

                    // Mirror bar — downward from center
                    p.rect(x + 1, cy, barW - 2, h);

                    // Bright core
                    p.fill(dr, dg, db, 255);
                    const coreW = barW * 0.4;
                    const coreX = x + (barW - coreW) / 2;
                    p.rect(coreX, cy - h, coreW, h);
                    p.rect(coreX, cy, coreW, h);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
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
window.VJamFX.presets['neon-bars'] = NeonBarsPreset;
})();
