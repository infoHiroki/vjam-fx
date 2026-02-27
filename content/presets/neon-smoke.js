(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class NeonSmokePreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.particles = [];
    }

    setup(container) {
        this.destroy();
        this.particles = [];
        const preset = this;
        const RES = 3;

        this.p5 = new p5((p) => {
            let buf;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                buf = p.createGraphics(
                    Math.floor(p.width / RES),
                    Math.floor(p.height / RES)
                );
                buf.colorMode(p.HSB, 360, 100, 100, 100);
                preset._buf = buf;
            };

            p.draw = () => {
                const w = buf.width;
                const h = buf.height;
                buf.background(5 / RES, 5 / RES, 15 / RES, 0);
                buf.clear();
                buf.background(5, 5, 15, 40);

                preset.beatPulse *= 0.92;

                // Spawn particles
                const spawnCount = preset.beatPulse > 0.3 ? 8 : 1;
                for (let i = 0; i < spawnCount; i++) {
                    if (preset.particles.length < 100) {
                        const hue = p.random(1) < 0.5 ? p.random(280, 320) : p.random(170, 200);
                        preset.particles.push({
                            x: p.random(w * 0.2, w * 0.8),
                            y: h + p.random(10),
                            vx: 0,
                            vy: -p.random(0.5, 1.5),
                            size: p.random(15, 40) / RES,
                            hue: hue,
                            alpha: p.random(30, 60),
                            life: 1.0,
                            decay: p.random(0.003, 0.008),
                            noiseOff: p.random(1000)
                        });
                    }
                }

                // Update and draw particles
                for (let i = preset.particles.length - 1; i >= 0; i--) {
                    const pt = preset.particles[i];
                    pt.life -= pt.decay;
                    if (pt.life <= 0) {
                        preset.particles.splice(i, 1);
                        continue;
                    }

                    const drift = p.noise(pt.noiseOff + p.frameCount * 0.01) - 0.5;
                    pt.x += drift * 1.5;
                    pt.y += pt.vy;
                    pt.size *= 1.003;

                    const alpha = pt.alpha * pt.life;
                    buf.noStroke();
                    buf.fill(pt.hue, 80, 90, alpha);
                    buf.ellipse(pt.x, pt.y, pt.size, pt.size);

                    // Glow layer
                    buf.fill(pt.hue, 60, 100, alpha * 0.3);
                    buf.ellipse(pt.x, pt.y, pt.size * 1.8, pt.size * 1.8);
                }

                // Render buffer to main canvas
                p.background(5, 5, 15);
                p.image(buf, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (preset._buf) preset._buf.remove();
                buf = p.createGraphics(
                    Math.floor(p.width / RES),
                    Math.floor(p.height / RES)
                );
                buf.colorMode(p.HSB, 360, 100, 100, 100);
                preset._buf = buf;
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

    destroy() {
        if (this._buf) {
            this._buf.remove();
            this._buf = null;
        }
        this.particles = [];
        super.destroy();
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['neon-smoke'] = NeonSmokePreset;
})();
