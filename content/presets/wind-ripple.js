(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class WindRipplePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.phaseOffset = 0;
    }

    setup(container) {
        this.destroy();
        this.phaseOffset = 0;
        const preset = this;

        this.p5 = new p5((p) => {
            const lineCount = 60;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.94;

                // Beat causes phase jump
                preset.phaseOffset += pulse * 0.5;

                p.background(0, 0, 5);

                const t = p.frameCount * 0.008 * speed + preset.phaseOffset;
                const globalAmp = 8 + preset.audio.bass * 15 + pulse * 10;
                const spacing = p.height / (lineCount + 1);

                for (let i = 0; i < lineCount; i++) {
                    const baseY = spacing * (i + 1);
                    const lineRatio = i / lineCount;

                    // Alternate between sand and water colors
                    const isSand = lineRatio < 0.45;
                    const isWater = lineRatio > 0.55;
                    let hue, sat, bri;

                    if (isSand) {
                        hue = 35 + p.noise(i * 0.1, t * 0.3) * 15;
                        sat = 40 + lineRatio * 30;
                        bri = 45 + lineRatio * 20;
                    } else if (isWater) {
                        hue = 195 + p.noise(i * 0.1, t * 0.3) * 20;
                        sat = 50 + (1 - lineRatio) * 30;
                        bri = 35 + (1 - lineRatio) * 25;
                    } else {
                        // Transition zone
                        hue = 35 + (lineRatio - 0.45) / 0.1 * 160;
                        sat = 45;
                        bri = 50;
                    }

                    // Noise-modulated amplitude per line
                    const amp = p.noise(i * 0.1, t) * globalAmp;
                    const freq = 0.004 + p.noise(i * 0.15) * 0.003;
                    const phase = t * (1.5 + i * 0.02);

                    const alpha = 50 + preset.audio.rms * 30;

                    // Draw line as curve
                    p.noFill();
                    p.stroke(hue, sat, bri, alpha);
                    p.strokeWeight(1.2 + pulse * 0.5);
                    p.beginShape();
                    const step = 8;
                    for (let x = -step; x <= p.width + step; x += step) {
                        const noiseVal = p.noise(x * 0.003, i * 0.08, t * 0.5);
                        const y = baseY + amp * Math.sin(x * freq + phase) + (noiseVal - 0.5) * 6;
                        p.curveVertex(x, y);
                    }
                    p.endShape();

                    // Glow line (2nd draw, slightly offset)
                    p.stroke(hue, sat * 0.5, bri + 15, alpha * 0.25);
                    p.strokeWeight(3 + pulse);
                    p.beginShape();
                    for (let x = -step; x <= p.width + step; x += step) {
                        const noiseVal = p.noise(x * 0.003, i * 0.08, t * 0.5);
                        const y = baseY + amp * Math.sin(x * freq + phase) + (noiseVal - 0.5) * 6;
                        p.curveVertex(x, y);
                    }
                    p.endShape();
                }

                // Horizon accent line
                const horizonY = p.height * 0.5;
                p.stroke(40, 60, 70, 30 + pulse * 20);
                p.strokeWeight(1.5);
                p.beginShape();
                for (let x = 0; x <= p.width; x += 6) {
                    const y = horizonY + Math.sin(x * 0.01 + t * 2) * 3;
                    p.curveVertex(x, y);
                }
                p.endShape();
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
window.VJamFX.presets['wind-ripple'] = WindRipplePreset;
})();
