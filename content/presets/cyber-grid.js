(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CyberGridPreset extends BasePreset {
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
            const NUM_H_LINES = 20;
            const NUM_V_LINES = 16;
            let hLinePositions = [];

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.RGB, 255);
                for (let i = 0; i < NUM_H_LINES; i++) {
                    hLinePositions.push(i / NUM_H_LINES);
                }
            };

            p.draw = () => {
                p.background(5, 5, 15);
                preset.beatPulse *= 0.9;

                const cx = p.width * 0.5;
                const cy = p.height * 0.45;
                const bass = preset.audio.bass;
                const speed = 0.003 + bass * 0.008;
                const glowAdd = preset.beatPulse * 120;

                // Move horizontal lines toward viewer
                for (let i = 0; i < hLinePositions.length; i++) {
                    hLinePositions[i] += speed;
                    if (hLinePositions[i] > 1) hLinePositions[i] -= 1;
                }

                // Draw vertical lines (perspective)
                for (let i = 0; i < NUM_V_LINES; i++) {
                    const t = (i / (NUM_V_LINES - 1)) * 2 - 1; // -1 to 1
                    const topX = cx + t * p.width * 0.05;
                    const botX = cx + t * p.width * 0.7;
                    const alpha = 60 + Math.abs(t) * 40 + glowAdd * 0.3;
                    p.stroke(0, 180 + glowAdd * 0.3, 255, Math.min(alpha, 255));
                    p.strokeWeight(1);
                    p.line(topX, cy, botX, p.height);
                }

                // Draw horizontal lines with perspective
                const sorted = [...hLinePositions].sort((a, b) => a - b);
                for (const pos of sorted) {
                    const z = pos * pos; // non-linear depth
                    const y = cy + z * (p.height - cy);
                    const halfW = p.width * 0.05 + z * p.width * 0.65;
                    const alpha = 40 + z * 160 + glowAdd * 0.5;
                    const weight = 0.5 + z * 2;

                    p.stroke(0, 150 + z * 105 + glowAdd * 0.3, 255, Math.min(alpha, 255));
                    p.strokeWeight(weight);
                    p.line(cx - halfW, y, cx + halfW, y);
                }

                // Horizon glow
                const horizGlow = 30 + glowAdd * 0.5;
                p.noStroke();
                p.fill(0, 200, 255, horizGlow);
                p.ellipse(cx, cy, p.width * 0.6, 4);

                // Beat flash line at horizon
                if (preset.beatPulse > 0.3) {
                    p.stroke(0, 255, 255, preset.beatPulse * 200);
                    p.strokeWeight(2);
                    p.line(0, cy, p.width, cy);
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
window.VJamFX.presets['cyber-grid'] = CyberGridPreset;
})();
