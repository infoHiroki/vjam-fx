(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class AuroraPreset extends BasePreset {
    constructor() {
        super();
        this.params = { layers: 5 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
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
                p.noStroke();
            };

            p.draw = () => {
                p.background(240, 30, 5, 100);
                preset.beatPulse *= 0.94;

                const layers = preset.params.layers;
                const time = p.frameCount * 0.008;

                for (let l = 0; l < layers; l++) {
                    const baseY = p.height * (0.2 + l * 0.12);
                    const hue = (120 + l * 30 + preset.audio.mid * 40 + p.frameCount * 0.2) % 360;
                    const amplitude = 60 + preset.audio.bass * 80 + preset.beatPulse * 40;
                    const speed = time * (0.8 + l * 0.3);

                    // Draw aurora curtain as vertical strips
                    const strips = 80;
                    for (let i = 0; i <= strips; i++) {
                        const x = (i / strips) * p.width;
                        const nx = i * 0.05 + l * 3;

                        const wave1 = p.noise(nx, speed) * amplitude;
                        const wave2 = Math.sin(i * 0.08 + speed * 2 + l) * amplitude * 0.5;
                        const y = baseY - wave1 - wave2;

                        const curtainHeight = 80 + p.noise(nx + 100, speed) * 150
                            + preset.audio.rms * 80 + preset.beatPulse * 60;

                        // Vertical gradient strip
                        const segments = 8;
                        for (let s = 0; s < segments; s++) {
                            const segRatio = s / segments;
                            const segY = y + segRatio * curtainHeight;
                            const segH = curtainHeight / segments;

                            const alpha = (1 - segRatio) * (15 + preset.audio.rms * 10);
                            const bri = 70 + (1 - segRatio) * 30;
                            const sat = 50 + segRatio * 30;

                            p.fill(hue, sat, bri, alpha);
                            p.rect(x, segY, p.width / strips + 1, segH);
                        }
                    }
                }

                // Stars in background
                if (p.frameCount % 2 === 0) {
                    p.fill(0, 0, 100, 40 + Math.random() * 40);
                    for (let i = 0; i < 3; i++) {
                        const sx = Math.random() * p.width;
                        const sy = Math.random() * p.height * 0.4;
                        p.circle(sx, sy, 1 + Math.random() * 2);
                    }
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
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
    }
}

window.VJamFX.presets['aurora'] = AuroraPreset;
})();
