(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SineWavesPreset extends BasePreset {
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
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                p.background(0, 0, 5, 30);
                preset.beatPulse *= 0.92;

                const t = p.frameCount * 0.02 * preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                const cy = p.height / 2;

                const waveCount = 8;
                p.noFill();

                for (let w = 0; w < waveCount; w++) {
                    const freq = 0.005 + w * 0.003;
                    const isLow = w < 3;
                    const isHigh = w >= 5;

                    // Amplitude: bass controls low freq waves, treble controls high
                    let amp;
                    if (isLow) {
                        amp = 40 + bass * 120 + pulse * 40;
                    } else if (isHigh) {
                        amp = 20 + treble * 80 + pulse * 20;
                    } else {
                        amp = 30 + mid * 100 + pulse * 30;
                    }

                    const hue = (w * 45 + t * 10 + mid * 60) % 360;
                    const alpha = 40 + preset.audio.rms * 30;

                    p.stroke(hue, 60 + treble * 30, 60 + bass * 30, alpha);
                    p.strokeWeight(1.5 + bass);

                    p.beginShape();
                    for (let x = 0; x <= p.width; x += 3) {
                        const phase = t + w * 0.5;
                        const y1 = Math.sin(x * freq + phase) * amp;
                        const y2 = Math.sin(x * freq * 2.1 + phase * 1.3) * amp * 0.3;
                        const y3 = Math.sin(x * freq * 0.5 + phase * 0.7) * amp * 0.5;
                        const offset = (w - waveCount / 2) * 30;

                        p.vertex(x, cy + y1 + y2 + y3 + offset);
                    }
                    p.endShape();
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
window.VJamFX.presets['sine-waves'] = SineWavesPreset;
})();
