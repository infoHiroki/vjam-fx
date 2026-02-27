(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class OscilloscopePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.freqA = 3;
        this.freqB = 2;
        this.phase = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.background(0);
            };

            p.draw = () => {
                // Phosphor fade
                p.fill(0, 0, 0, 18);
                p.noStroke();
                p.rect(0, 0, p.width, p.height);

                const cx = p.width / 2;
                const cy = p.height / 2;
                const amp = Math.min(p.width, p.height) * 0.3 * (0.5 + preset.audio.rms * 1.5);

                preset.phase += 0.015 * preset.params.speed * (1 + preset.audio.mid);

                const steps = 600;
                const greenBright = 160 + preset.audio.rms * 95;

                // Draw Lissajous curve
                p.noFill();
                p.strokeWeight(1.5);

                let prevX = null, prevY = null;
                for (let i = 0; i <= steps; i++) {
                    const t = (i / steps) * Math.PI * 2 * 4;
                    const x = cx + Math.sin(preset.freqA * t + preset.phase) * amp;
                    const y = cy + Math.sin(preset.freqB * t) * amp * 0.8;

                    if (prevX !== null) {
                        const alpha = 120 + (i / steps) * 80;
                        p.stroke(30, greenBright, 50, alpha);
                        p.line(prevX, prevY, x, y);
                    }
                    prevX = x;
                    prevY = y;
                }

                // Glow center dot
                p.noStroke();
                p.fill(50, greenBright, 80, 60);
                p.ellipse(cx, cy, 6 + preset.beatPulse * 20, 6 + preset.beatPulse * 20);

                // Scanline overlay
                p.stroke(30, greenBright * 0.3, 30, 8);
                p.strokeWeight(1);
                for (let y = 0; y < p.height; y += 3) {
                    p.line(0, y, p.width, y);
                }

                preset.beatPulse *= 0.9;
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                p.background(0);
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
        // Change frequency ratios on beat
        const ratios = [[3, 2], [3, 4], [5, 4], [5, 3], [2, 3], [1, 2], [4, 3], [7, 4]];
        const pair = ratios[Math.floor(Math.random() * ratios.length)];
        this.freqA = pair[0];
        this.freqB = pair[1];
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['oscilloscope'] = OscilloscopePreset;
})();
