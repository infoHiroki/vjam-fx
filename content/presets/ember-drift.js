(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class EmberDriftPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.embers = [];
    }

    setup(container) {
        this.destroy();
        this.embers = [];
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.background(0, 0, 0);
                for (let i = 0; i < 100; i++) {
                    preset._spawnEmber(p);
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.008 * speed;
                preset.beatPulse *= 0.92;

                // Fade trail on pg
                pg.noStroke();
                pg.fill(0, 0, 0, 8);
                pg.rect(0, 0, pg.width, pg.height);

                // Update and draw embers
                for (let i = preset.embers.length - 1; i >= 0; i--) {
                    const e = preset.embers[i];
                    // Noise-based horizontal drift
                    e.vx = (p.noise(e.x * 0.005, e.y * 0.003, t) - 0.5) * 2.5;
                    e.x += e.vx * speed;
                    e.y += e.vy * speed;
                    e.life -= e.decay * speed;

                    // Flicker
                    const flicker = 0.7 + Math.random() * 0.3;

                    if (e.life <= 0 || e.y < -20 || e.x < -30 || e.x > p.width + 30) {
                        preset.embers.splice(i, 1);
                        preset._spawnEmber(p);
                        continue;
                    }

                    const lifeRatio = Math.max(0, e.life);
                    const hue = 15 + e.hueOff + lifeRatio * 25;
                    const bri = lifeRatio * 90 * flicker;
                    const sz = e.size * (0.5 + lifeRatio * 0.5);

                    // Draw trail on pg (small hot core)
                    pg.noStroke();
                    pg.fill(hue, 80, bri * 0.4, 15);
                    pg.ellipse(e.x, e.y, sz * 0.8, sz * 0.8);

                    // Glow layers on main canvas: large dim -> medium -> small bright
                    p.noStroke();
                    // Outer glow
                    p.fill(hue, 60, bri * 0.3, 8 + preset.audio.bass * 5);
                    p.ellipse(e.x, e.y, sz * 5, sz * 5);
                    // Mid glow
                    p.fill(hue, 70, bri * 0.6, 20);
                    p.ellipse(e.x, e.y, sz * 2.5, sz * 2.5);
                    // Core
                    p.fill(hue - 5, 90, bri, 60);
                    p.ellipse(e.x, e.y, sz, sz);
                }

                // Respawn to maintain count
                while (preset.embers.length < 100) {
                    preset._spawnEmber(p);
                }

                // Draw trail layer behind
                p.background(0, 0, 0);
                p.image(pg, 0, 0);

                // Redraw embers on top with glow
                for (const e of preset.embers) {
                    const lifeRatio = Math.max(0, e.life);
                    const flicker = 0.7 + Math.random() * 0.3;
                    const hue = 15 + e.hueOff + lifeRatio * 25;
                    const bri = lifeRatio * 90 * flicker;
                    const sz = e.size * (0.5 + lifeRatio * 0.5);

                    p.noStroke();
                    p.fill(hue, 50, bri * 0.25, 6);
                    p.ellipse(e.x, e.y, sz * 6, sz * 6);
                    p.fill(hue, 65, bri * 0.5, 18);
                    p.ellipse(e.x, e.y, sz * 2.8, sz * 2.8);
                    p.fill(hue - 5, 85, bri, 55);
                    p.ellipse(e.x, e.y, sz, sz);
                }

                // Beat: burst from bottom
                if (preset.beatPulse > 0.3) {
                    const count = Math.floor(10 + preset.beatPulse * 15);
                    for (let i = 0; i < count; i++) {
                        const e = preset._spawnEmber(p);
                        e.y = p.height + Math.random() * 10;
                        e.vy = -2.5 - Math.random() * 3;
                        e.size *= 1.3;
                    }
                }

                if (preset.embers.length > 200) {
                    preset.embers.splice(0, preset.embers.length - 200);
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

    _spawnEmber(p) {
        const e = {
            x: Math.random() * p.width,
            y: p.height * 0.5 + Math.random() * p.height * 0.5,
            vx: 0,
            vy: -0.5 - Math.random() * 1.8,
            life: 1,
            decay: 0.003 + Math.random() * 0.005,
            size: 3 + Math.random() * 6,
            hueOff: Math.random() * 25,
        };
        this.embers.push(e);
        return e;
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
window.VJamFX.presets['ember-drift'] = EmberDriftPreset;
})();
