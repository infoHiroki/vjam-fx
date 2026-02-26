(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class WarpSpeedPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;
        this.p5 = new p5((p) => {
            const stars = [];
            const NUM_STARS = 300;

            function resetStar(s) {
                s.x = p.random(-p.width, p.width);
                s.y = p.random(-p.height, p.height);
                s.z = p.random(100, 1600);
                s.pz = s.z;
                s.hue = p.random(170, 210);
            }

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                for (let i = 0; i < NUM_STARS; i++) {
                    const s = {};
                    resetStar(s);
                    s.z = p.random(1, 1600);
                    s.pz = s.z;
                    stars.push(s);
                }
            };

            p.draw = () => {
                p.background(5, 30, 6);
                preset.beatPulse *= 0.92;

                const cx = p.width / 2;
                const cy = p.height / 2;
                const speed = 8 + preset.audio.bass * 20 + preset.beatPulse * 30;

                for (const s of stars) {
                    s.pz = s.z;
                    s.z -= speed;

                    if (s.z <= 1) {
                        resetStar(s);
                        s.z = p.random(800, 1600);
                        s.pz = s.z;
                        continue;
                    }

                    const sx = p.map(s.x / s.z, 0, 1, cx, p.width);
                    const sy = p.map(s.y / s.z, 0, 1, cy, p.height);
                    const px = p.map(s.x / s.pz, 0, 1, cx, p.width);
                    const py = p.map(s.y / s.pz, 0, 1, cy, p.height);

                    const brightness = p.map(s.z, 1, 1600, 100, 30);
                    const alpha = p.map(s.z, 1, 1600, 95, 20);
                    const weight = p.map(s.z, 1, 1600, 3, 0.5);

                    p.stroke(s.hue, 40, brightness, alpha);
                    p.strokeWeight(weight);
                    p.line(px, py, sx, sy);
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

window.VJamFX.presets['warp-speed'] = WarpSpeedPreset;
})();
