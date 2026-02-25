(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class GradientSweepPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.angleOffset = 0;
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
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;

                p.background(0);

                const rotSpeed = (0.005 + bass * 0.02) * preset.params.speed;
                preset.angleOffset += rotSpeed;

                const cx = p.width / 2;
                const cy = p.height / 2;
                const maxR = Math.sqrt(cx * cx + cy * cy) * 1.2;

                const bandCount = 12 + Math.floor(treble * 10);
                const sliceAngle = p.TWO_PI / bandCount;
                const ringCount = 8;
                const ringWidth = maxR / ringCount;

                p.push();
                p.translate(cx, cy);
                p.rotate(preset.angleOffset);

                // Draw from outermost ring to innermost
                for (let ring = ringCount - 1; ring >= 0; ring--) {
                    const dist = (ring + 0.5) / ringCount;
                    const r = (ring + 1) * ringWidth;

                    for (let i = 0; i < bandCount; i++) {
                        const angle = i * sliceAngle;
                        const hue = ((angle / p.TWO_PI) * 360 + mid * 120 + dist * 60 + pulse * 40 + p.frameCount * 0.5) % 360;
                        const sat = 60 + treble * 30 + Math.sin(angle * 3) * 15;
                        const bri = 30 + dist * 40 + bass * 25 + pulse * 20;

                        p.fill(((hue % 360) + 360) % 360, Math.min(100, sat), Math.min(100, bri));
                        p.arc(0, 0, r * 2, r * 2, angle, angle + sliceAngle + 0.02, p.PIE);
                    }
                }

                p.pop();
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
window.VJamFX.presets['gradient-sweep'] = GradientSweepPreset;
})();
