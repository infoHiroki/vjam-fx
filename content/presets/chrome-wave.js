(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ChromeWavePreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.waveAmplitude = 30;
    }

    setup(container) {
        this.destroy();
        this.waveAmplitude = 30;
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
            };

            p.draw = () => {
                p.background(5, 5, 15);
                preset.beatPulse *= 0.92;

                // Beat amplitude boost
                const ampTarget = 30 + preset.beatPulse * 80 + preset.audio.bass * 40;
                preset.waveAmplitude += (ampTarget - preset.waveAmplitude) * 0.15;

                const numWaves = 12;
                const spacing = p.height / (numWaves + 1);
                const t = p.frameCount * 0.02;

                for (let w = 0; w < numWaves; w++) {
                    const baseY = spacing * (w + 1);
                    const wavePhase = w * 0.4;
                    const amp = preset.waveAmplitude * (0.5 + (w / numWaves) * 0.5);
                    const freq1 = 0.008 + w * 0.001;
                    const freq2 = 0.015 + w * 0.0005;

                    // Multiple glow layers for chrome effect
                    const layers = [
                        { weight: 10, r: 80, g: 120, b: 200, a: 25 },
                        { weight: 5,  r: 150, g: 180, b: 230, a: 50 },
                        { weight: 2,  r: 220, g: 235, b: 255, a: 140 },
                        { weight: 1,  r: 255, g: 255, b: 255, a: 200 },
                    ];

                    for (const layer of layers) {
                        p.noFill();
                        p.stroke(layer.r, layer.g, layer.b, layer.a);
                        p.strokeWeight(layer.weight);

                        p.beginShape();
                        for (let x = 0; x <= p.width; x += 4) {
                            const y = baseY
                                + Math.sin(x * freq1 + t + wavePhase) * amp
                                + Math.sin(x * freq2 - t * 0.7 + wavePhase * 2) * amp * 0.4
                                + Math.sin(x * 0.003 + t * 1.5) * amp * 0.2;
                            p.vertex(x, y);
                        }
                        p.endShape();
                    }

                    // Cyan highlight on wave peaks
                    p.stroke(0, 255, 255, 40 + preset.beatPulse * 60);
                    p.strokeWeight(1);
                    p.beginShape();
                    for (let x = 0; x <= p.width; x += 4) {
                        const y = baseY
                            + Math.sin(x * freq1 + t + wavePhase) * amp
                            + Math.sin(x * freq2 - t * 0.7 + wavePhase * 2) * amp * 0.4
                            + Math.sin(x * 0.003 + t * 1.5) * amp * 0.2
                            - 2; // slight offset for highlight
                        p.vertex(x, y);
                    }
                    p.endShape();
                }

                // Beat flash
                if (preset.beatPulse > 0.3) {
                    p.noStroke();
                    p.fill(100, 150, 255, preset.beatPulse * 20);
                    p.rect(0, 0, p.width, p.height);
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
window.VJamFX.presets['chrome-wave'] = ChromeWavePreset;
})();
