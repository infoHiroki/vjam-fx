(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class DnaHelixPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
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
                preset.beatPulse *= 0.92;

                const time = p.frameCount * 0.03 * preset.params.speed;
                const cx = p.width / 2;
                const strands = 2;
                const nodeCount = 40;
                const amplitude = p.width * 0.25 * (1 + preset.audio.bass * 0.5 + preset.beatPulse * 0.3);
                const spacing = p.height / nodeCount;

                for (let s = 0; s < strands; s++) {
                    const phase = s * p.PI;
                    const hueBase = s === 0 ? 200 : 340;

                    // Draw strand
                    p.noFill();
                    p.strokeWeight(3 + preset.audio.rms * 3);

                    p.beginShape();
                    for (let i = 0; i <= nodeCount; i++) {
                        const y = i * spacing;
                        const wave = Math.sin(i * 0.3 + time + phase);
                        const x = cx + wave * amplitude;
                        const depth = (Math.cos(i * 0.3 + time + phase) + 1) / 2;
                        const alpha = 30 + depth * 50;
                        const hue = (hueBase + i * 3 + preset.audio.treble * 40) % 360;
                        p.stroke(hue, 70, 90, alpha);
                        p.vertex(x, y);
                    }
                    p.endShape();

                    // Draw nodes
                    for (let i = 0; i <= nodeCount; i++) {
                        const y = i * spacing;
                        const wave = Math.sin(i * 0.3 + time + phase);
                        const x = cx + wave * amplitude;
                        const depth = (Math.cos(i * 0.3 + time + phase) + 1) / 2;

                        if (depth > 0.4) {
                            const size = 4 + depth * 8 + preset.beatPulse * 4;
                            const hue = (hueBase + i * 3) % 360;
                            p.noStroke();
                            p.fill(hue, 60, 100, 50 + depth * 40);
                            p.circle(x, y, size);
                        }
                    }
                }

                // Cross-links
                for (let i = 0; i <= nodeCount; i += 2) {
                    const y = i * spacing;
                    const x1 = cx + Math.sin(i * 0.3 + time) * amplitude;
                    const x2 = cx + Math.sin(i * 0.3 + time + p.PI) * amplitude;
                    const depth1 = (Math.cos(i * 0.3 + time) + 1) / 2;
                    const depth2 = (Math.cos(i * 0.3 + time + p.PI) + 1) / 2;
                    const avgDepth = (depth1 + depth2) / 2;

                    if (avgDepth > 0.3) {
                        const hue = (270 + i * 5 + preset.audio.mid * 60) % 360;
                        p.stroke(hue, 50, 80, avgDepth * 40);
                        p.strokeWeight(1.5);
                        p.line(x1, y, x2, y);
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
window.VJamFX.presets['dna-helix'] = DnaHelixPreset;
})();
