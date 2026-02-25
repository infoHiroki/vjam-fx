import { BasePreset } from '../base-preset.js';

class MoirePreset extends BasePreset {
    constructor() {
        super();
        this.params = { lineCount: 60 };
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
                const maxR = Math.max(p.width, p.height) * 0.7;
                const time = p.frameCount * 0.01;
                const lines = preset.params.lineCount;

                // Pattern 1: centered circles
                const offset1x = Math.sin(time * 0.7) * 100 * (1 + preset.audio.bass);
                const offset1y = Math.cos(time * 0.5) * 80 * (1 + preset.audio.bass);

                p.noFill();
                for (let i = 1; i <= lines; i++) {
                    const r = (i / lines) * maxR;
                    const hue = (i * 6 + p.frameCount * 0.3) % 360;
                    p.stroke(hue, 50, 80, 25 + preset.beatPulse * 15);
                    p.strokeWeight(1.5);
                    p.circle(cx + offset1x, cy + offset1y, r * 2);
                }

                // Pattern 2: offset circles (creates moire)
                const offset2x = Math.sin(time * 0.5 + 2) * 120 * (1 + preset.audio.mid);
                const offset2y = Math.cos(time * 0.8 + 1) * 90 * (1 + preset.audio.mid);

                for (let i = 1; i <= lines; i++) {
                    const r = (i / lines) * maxR;
                    const hue = (i * 6 + 180 + p.frameCount * 0.3) % 360;
                    p.stroke(hue, 50, 80, 25 + preset.beatPulse * 15);
                    p.strokeWeight(1.5);
                    p.circle(cx + offset2x, cy + offset2y, r * 2);
                }

                // Pattern 3: radial lines (optional treble layer)
                if (preset.audio.treble > 0.1) {
                    const lineCount = 30;
                    const rotSpeed = time * 0.3 + preset.audio.treble;
                    for (let i = 0; i < lineCount; i++) {
                        const angle = (i / lineCount) * p.TWO_PI + rotSpeed;
                        const hue = (i * 12 + 90) % 360;
                        p.stroke(hue, 40, 70, preset.audio.treble * 30);
                        p.strokeWeight(1);
                        p.line(cx, cy, cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
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

export { MoirePreset };
if (typeof window !== 'undefined') {
    window.VJamFX = window.VJamFX || { presets: {} };
    window.VJamFX.presets['moire'] = MoirePreset;
}
