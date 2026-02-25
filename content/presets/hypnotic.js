(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class HypnoticPreset extends BasePreset {
    constructor() {
        super();
        this.params = { ringCount: 15, speed: 1 };
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
            };

            p.draw = () => {
                p.background(0, 0, 0, 100);
                preset.beatPulse *= 0.93;

                const cx = p.width / 2;
                const cy = p.height / 2;
                const maxR = Math.max(p.width, p.height) * 0.6;
                const time = p.frameCount * 0.015 * preset.params.speed;
                const rings = preset.params.ringCount;

                for (let i = 0; i < rings; i++) {
                    const ratio = i / rings;
                    const baseR = ratio * maxR;
                    const r = baseR + Math.sin(time * 2 + i * 0.5) * 20 * (1 + preset.audio.bass);

                    // Spiral rotation per ring
                    const rotation = time * (1 + i * 0.1) * (i % 2 === 0 ? 1 : -1);

                    const hue = (i * 25 + p.frameCount * 0.5 + preset.audio.mid * 60) % 360;
                    const thickness = 2 + preset.audio.rms * 4 + preset.beatPulse * 3;

                    // Distorted ring
                    p.noFill();
                    p.stroke(hue, 70, 85, 50 - ratio * 20);
                    p.strokeWeight(thickness);

                    const points = 60;
                    p.beginShape();
                    for (let v = 0; v <= points; v++) {
                        const angle = (v / points) * p.TWO_PI + rotation;
                        const distort = Math.sin(angle * 3 + time + i) * preset.audio.treble * 30;
                        const wobble = Math.sin(angle * 5 + time * 2) * preset.beatPulse * 15;
                        const pr = r + distort + wobble;
                        p.vertex(cx + Math.cos(angle) * pr, cy + Math.sin(angle) * pr);
                    }
                    p.endShape(p.CLOSE);

                    // Glow for inner rings
                    if (ratio < 0.5) {
                        p.stroke(hue, 50, 100, 15);
                        p.strokeWeight(thickness * 3);
                        p.beginShape();
                        for (let v = 0; v <= points; v++) {
                            const angle = (v / points) * p.TWO_PI + rotation;
                            const distort = Math.sin(angle * 3 + time + i) * preset.audio.treble * 30;
                            p.vertex(cx + Math.cos(angle) * (r + distort), cy + Math.sin(angle) * (r + distort));
                        }
                        p.endShape(p.CLOSE);
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

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['hypnotic'] = HypnoticPreset;
})();
