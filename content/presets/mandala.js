(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class MandalaPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.rings = [];
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
                p.background(0, 0, 5, 20);
                preset.beatPulse *= 0.92;

                const cx = p.width / 2;
                const cy = p.height / 2;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const t = p.frameCount * 0.005 * preset.params.speed;

                // Expand existing rings
                for (let i = preset.rings.length - 1; i >= 0; i--) {
                    const ring = preset.rings[i];
                    ring.radius += ring.speed;
                    ring.life -= 0.005;
                    if (ring.life <= 0 || ring.radius > Math.max(p.width, p.height)) {
                        preset.rings.splice(i, 1);
                    }
                }

                // Draw rings
                p.noFill();
                for (const ring of preset.rings) {
                    const symmetry = ring.symmetry;
                    const alpha = ring.life * 60;

                    for (let s = 0; s < symmetry; s++) {
                        const baseAngle = (s / symmetry) * p.TWO_PI + t + ring.rotOffset;

                        p.push();
                        p.translate(cx, cy);
                        p.rotate(baseAngle);

                        const hue = (ring.hue + ring.radius * 0.5) % 360;
                        p.stroke(hue, ring.sat, Math.min(100, ring.bri + bass * 20), alpha);
                        p.strokeWeight(1.5 + bass);

                        // Draw petal shape
                        const r = ring.radius;
                        const wobble = Math.sin(t * 3 + ring.radius * 0.05) * 5 * treble;

                        p.beginShape();
                        for (let a = -0.3; a <= 0.3; a += 0.05) {
                            const rr = r + Math.sin(a * 10 + t * 2) * (5 + mid * 15) + wobble;
                            p.vertex(Math.cos(a) * rr, Math.sin(a) * rr);
                        }
                        p.endShape();

                        // Mirror
                        p.beginShape();
                        for (let a = -0.3; a <= 0.3; a += 0.05) {
                            const rr = r + Math.sin(a * 10 + t * 2) * (5 + mid * 15) + wobble;
                            p.vertex(Math.cos(-a) * rr, Math.sin(-a) * rr);
                        }
                        p.endShape();

                        p.pop();
                    }
                }

                // Continuous slow generation
                if (p.frameCount % 30 === 0) {
                    preset._addRing(p);
                }

                // Cap rings
                if (preset.rings.length > 30) {
                    preset.rings.splice(0, preset.rings.length - 30);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _addRing(p) {
        const symmetry = [6, 8, 10, 12][Math.floor(Math.random() * 4)];
        this.rings.push({
            radius: 5,
            speed: 0.5 + Math.random() * 1.5 + this.audio.bass * 2,
            life: 1,
            symmetry: symmetry,
            hue: Math.random() * 360,
            sat: 50 + Math.random() * 40,
            bri: 50 + Math.random() * 30,
            rotOffset: Math.random() * Math.PI * 2,
        });
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        // Spawn new ring on beat
        if (this.p5) this._addRing(this.p5);
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['mandala'] = MandalaPreset;
})();
