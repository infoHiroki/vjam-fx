(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SeedBurstPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.bursts = [];
        this.particles = [];
    }

    setup(container) {
        this.destroy();
        this.bursts = [];
        this.particles = [];
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.background(0, 0, 3);
                // Initial burst
                preset._triggerBurst(p);
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.93;

                // Trail fade
                pg.fill(0, 0, 3, 15);
                pg.noStroke();
                pg.rect(0, 0, pg.width, pg.height);

                // Auto-trigger bursts periodically
                if (p.frameCount % 90 === 0 && preset.bursts.length < 5) {
                    preset._triggerBurst(p);
                }

                // Update and draw particles
                for (let i = preset.particles.length - 1; i >= 0; i--) {
                    const pt = preset.particles[i];
                    pt.vy += 0.08; // gravity
                    pt.vx *= 0.995; // air resistance
                    pt.vy *= 0.995;
                    pt.x += pt.vx * speed;
                    pt.y += pt.vy * speed;
                    pt.life -= 0.008 * speed;

                    if (pt.life <= 0 || pt.y > p.height + 20) {
                        preset.particles.splice(i, 1);
                        continue;
                    }

                    const alpha = pt.life * 80;
                    const sz = pt.size * pt.life;

                    // Glow: outer then inner
                    pg.noStroke();
                    pg.fill(pt.hue, pt.sat * 0.5, pt.bri, alpha * 0.3);
                    pg.ellipse(pt.x, pt.y, sz * 3, sz * 3);
                    pg.fill(pt.hue, pt.sat, pt.bri, alpha);
                    pg.ellipse(pt.x, pt.y, sz, sz);

                    // Trail line
                    pg.stroke(pt.hue, pt.sat, pt.bri * 0.7, alpha * 0.4);
                    pg.strokeWeight(0.5);
                    pg.line(pt.x, pt.y, pt.x - pt.vx * 3, pt.y - pt.vy * 3);
                }

                p.image(pg, 0, 0);

                // Burst origin flash
                for (let i = preset.bursts.length - 1; i >= 0; i--) {
                    const b = preset.bursts[i];
                    b.flash *= 0.88;
                    if (b.flash > 0.05) {
                        p.noStroke();
                        p.fill(b.hue, 30, 95, b.flash * 40);
                        p.ellipse(b.x, b.y, b.flash * 60, b.flash * 60);
                    } else {
                        preset.bursts.splice(i, 1);
                    }
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                const oldPg = pg;
                if (pg) pg.remove();
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.image(oldPg, 0, 0, p.width, p.height);
                oldPg.remove();
            };
        }, container);
    }

    _triggerBurst(p) {
        const x = 100 + Math.random() * (p.width - 200);
        const y = 100 + Math.random() * (p.height - 200);
        const hue = 30 + Math.random() * 90; // amber to green
        const count = 25 + Math.floor(Math.random() * 15);

        this.bursts.push({ x, y, hue, flash: 1.0 });

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            const vel = 2 + Math.random() * 4;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * vel,
                vy: Math.sin(angle) * vel - 1.5,
                size: 3 + Math.random() * 5,
                hue: (hue + Math.random() * 30 - 15 + 360) % 360,
                sat: 60 + Math.random() * 30,
                bri: 60 + Math.random() * 30,
                life: 1.0,
            });
        }

        // Cap particles
        if (this.particles.length > 400) {
            this.particles.splice(0, this.particles.length - 400);
        }
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        if (this.p5) {
            this._triggerBurst(this.p5);
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['seed-burst'] = SeedBurstPreset;
})();
