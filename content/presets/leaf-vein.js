(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class LeafVeinPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.flames = [];
    }

    setup(container) {
        this.destroy();
        this.flames = [];
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.background(0);
                // Seed initial flame sources along bottom
                for (let i = 0; i < 7; i++) {
                    preset._addFlameSource(p);
                }
            };

            p.draw = () => {
                p.background(0);
                const speed = preset.params.speed;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;

                // Fade trail for persistence
                pg.fill(0, 0, 0, 6 + preset.audio.bass * 4);
                pg.noStroke();
                pg.rect(0, 0, pg.width, pg.height);

                const growSteps = pulse > 0.3 ? 6 : 3;

                for (let step = 0; step < growSteps; step++) {
                    for (let i = preset.flames.length - 1; i >= 0; i--) {
                        const f = preset.flames[i];
                        if (!f.growing) continue;

                        const prevX = f.x;
                        const prevY = f.y;

                        // Fire rises upward with turbulent flickering
                        const noiseVal = p.noise(f.x * 0.008, f.y * 0.008, f.seed + p.frameCount * 0.003 * speed);
                        const turbulence = (noiseVal - 0.5) * 0.7;
                        // Flames tend upward with lateral flicker
                        f.angle += turbulence + f.flicker * 0.04;
                        // Upward bias — flames always rise
                        const upwardPull = -0.02;
                        f.angle = f.angle * 0.97 + upwardPull;

                        f.x += Math.cos(f.angle) * f.speed * speed;
                        f.y += Math.sin(f.angle) * f.speed * speed;
                        f.segments++;
                        f.life -= 0.005;

                        const thickness = Math.max(0.5, f.thickness * f.life);
                        // Fire color: deep red at base → orange → yellow at tips
                        const lifeHue = f.life > 0.6 ? 5 + (1 - f.life) * 20 : 15 + (1 - f.life) * 30;
                        const hue = (lifeHue + preset.audio.mid * 8) % 360;
                        const sat = 85 - f.life * 15;
                        const bri = 50 + f.life * 50 + preset.audio.bass * 10;
                        const alpha = Math.max(20, f.life * 80);

                        // Outer glow — wide, soft
                        pg.strokeWeight(thickness * 4);
                        pg.stroke(hue + 10, sat * 0.5, bri * 0.6, alpha * 0.15);
                        pg.line(prevX, prevY, f.x, f.y);

                        // Mid glow
                        pg.strokeWeight(thickness * 2.2);
                        pg.stroke(hue, sat * 0.7, bri * 0.8, alpha * 0.3);
                        pg.line(prevX, prevY, f.x, f.y);

                        // Core flame — bright hot center
                        pg.strokeWeight(thickness);
                        pg.stroke(hue + 15, sat * 0.4, Math.min(100, bri + 20), alpha);
                        pg.line(prevX, prevY, f.x, f.y);

                        // Ember particles at branching points
                        if (f.segments % 12 === 0 && f.life > 0.2) {
                            pg.noStroke();
                            pg.fill(30 + Math.random() * 20, 90, 90, alpha * 0.5);
                            const emberSize = 1 + thickness * 0.8;
                            pg.ellipse(f.x + (Math.random() - 0.5) * 6, f.y + (Math.random() - 0.5) * 6, emberSize);
                        }

                        // Major branch — fractal flame tendrils
                        const branchChance = 0.015 + pulse * 0.02;
                        if (Math.random() < branchChance && f.depth < 5 && f.life > 0.2) {
                            const branchAngle = f.angle + (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.5);
                            preset.flames.push({
                                x: f.x, y: f.y,
                                angle: branchAngle,
                                speed: f.speed * 0.8,
                                thickness: thickness * 0.6,
                                flicker: -f.flicker * 0.7,
                                life: f.life * 0.7,
                                segments: 0,
                                depth: f.depth + 1,
                                growing: true,
                                seed: Math.random() * 1000,
                            });
                        }

                        // Small sparking tendrils
                        if (f.segments % 6 === 0 && f.depth < 6 && f.life > 0.15 && Math.random() < 0.25) {
                            const sAngle = f.angle + (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.7);
                            preset.flames.push({
                                x: f.x, y: f.y, angle: sAngle,
                                speed: f.speed * 0.6,
                                thickness: Math.max(0.4, thickness * 0.35),
                                flicker: f.flicker * 0.5,
                                life: f.life * 0.4,
                                segments: 0, depth: f.depth + 2,
                                growing: true, seed: Math.random() * 1000,
                            });
                        }

                        // Stop conditions
                        if (f.life <= 0 || f.x < -30 || f.x > pg.width + 30 || f.y < -30 || f.y > pg.height + 30) {
                            f.growing = false;
                        }
                    }
                }

                // Cleanup dead flames
                if (preset.flames.length > 500) {
                    preset.flames = preset.flames.filter(f => f.growing);
                }

                // Continuously spawn new flame sources
                if (p.frameCount % 50 === 0) {
                    preset._addFlameSource(p);
                }

                // If nothing is burning, reseed
                if (!preset.flames.some(f => f.growing)) {
                    for (let i = 0; i < 5; i++) preset._addFlameSource(p);
                }

                // Beat: explosive burst of flames
                if (pulse > 0.3) {
                    const active = preset.flames.filter(f => f.growing && f.depth < 3);
                    if (active.length > 0) {
                        for (let b = 0; b < 4; b++) {
                            const tip = active[Math.floor(Math.random() * active.length)];
                            const bAngle = tip.angle + (Math.random() - 0.5) * 1.2;
                            preset.flames.push({
                                x: tip.x, y: tip.y, angle: bAngle,
                                speed: tip.speed * 1.1,
                                thickness: tip.thickness * 0.8,
                                flicker: (Math.random() > 0.5 ? 1 : -1) * 0.6,
                                life: 0.7 + Math.random() * 0.3,
                                segments: 0, depth: tip.depth + 1,
                                growing: true, seed: Math.random() * 1000,
                            });
                        }
                    }
                    // Also spawn new sources on beat
                    for (let i = 0; i < 2; i++) preset._addFlameSource(p);
                }

                p.image(pg, 0, 0);
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

    _addFlameSource(p) {
        // Flames originate from bottom area, spreading across width
        const x = p.width * (0.1 + Math.random() * 0.8);
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
        this.flames.push({
            x, y: p.height + 5,
            angle,
            speed: 1.5 + Math.random() * 1.0,
            thickness: 3 + Math.random() * 3,
            flicker: Math.random() > 0.5 ? 1 : -1,
            life: 1,
            segments: 0,
            depth: 0,
            growing: true,
            seed: Math.random() * 1000,
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
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['leaf-vein'] = LeafVeinPreset;
})();
