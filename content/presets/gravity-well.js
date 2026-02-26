(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class GravityWellPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.particles = [];
        this.centerGlow = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                for (let i = 0; i < 180; i++) {
                    preset.particles.push(preset._makeOrbital(p));
                }
            };

            p.draw = () => {
                // Semi-transparent background for trails
                p.background(0, 0, 0, 18);
                preset.beatPulse *= 0.92;
                preset.centerGlow *= 0.94;

                const cx = p.width * 0.5;
                const cy = p.height * 0.5;
                const gravStrength = 0.4 + preset.audio.bass * 0.6;

                // Central glow
                const glowSize = 40 + preset.centerGlow * 80 + preset.audio.bass * 30;
                p.noStroke();
                p.fill(200, 60, 80, 4 + preset.centerGlow * 10);
                p.ellipse(cx, cy, glowSize * 3, glowSize * 3);
                p.fill(200, 40, 90, 8 + preset.centerGlow * 15);
                p.ellipse(cx, cy, glowSize * 1.5, glowSize * 1.5);
                p.fill(200, 20, 100, 12 + preset.centerGlow * 20);
                p.ellipse(cx, cy, glowSize * 0.5, glowSize * 0.5);

                for (let i = preset.particles.length - 1; i >= 0; i--) {
                    const pt = preset.particles[i];

                    // Gravity toward center
                    const dx = cx - pt.x;
                    const dy = cy - pt.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) + 1;
                    const force = gravStrength / (dist * 0.08 + 1);
                    pt.vx += (dx / dist) * force * 0.15;
                    pt.vy += (dy / dist) * force * 0.15;

                    // Update position
                    pt.x += pt.vx * preset.params.speed;
                    pt.y += pt.vy * preset.params.speed;
                    pt.life -= 0.0015;

                    // Too close to center - respawn
                    if (dist < 8) {
                        preset.particles[i] = preset._makeOrbital(p);
                        continue;
                    }

                    if (pt.life <= 0 || pt.x < -50 || pt.x > p.width + 50 ||
                        pt.y < -50 || pt.y > p.height + 50) {
                        preset.particles[i] = preset._makeOrbital(p);
                        continue;
                    }

                    // Speed for color mapping
                    const speed = Math.sqrt(pt.vx * pt.vx + pt.vy * pt.vy);
                    // slow=cyan(180), fast=magenta(300)
                    const hue = p.map(Math.min(speed, 8), 0, 8, 180, 300);
                    const brightness = 70 + Math.min(speed * 5, 30);
                    const alpha = 60 + Math.min(speed * 8, 35);

                    // Draw streak (short line showing velocity)
                    const tailLen = Math.min(speed * 3, 20);
                    const nx = pt.vx / (speed + 0.01);
                    const ny = pt.vy / (speed + 0.01);

                    p.stroke(hue, 70, brightness, alpha * pt.life);
                    p.strokeWeight(1.8);
                    p.line(pt.x, pt.y, pt.x - nx * tailLen, pt.y - ny * tailLen);

                    // Bright head
                    p.noStroke();
                    p.fill(hue, 40, 100, alpha * pt.life * 0.8);
                    p.ellipse(pt.x, pt.y, 3, 3);
                }

                // Maintain population
                while (preset.particles.length < 150) {
                    preset.particles.push(preset._makeOrbital(p));
                }
                if (preset.particles.length > 250) {
                    preset.particles.splice(0, preset.particles.length - 250);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _makeOrbital(p) {
        // Spawn on random edge with angular momentum
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        switch (edge) {
            case 0: x = Math.random() * p.width; y = -10; break;
            case 1: x = p.width + 10; y = Math.random() * p.height; break;
            case 2: x = Math.random() * p.width; y = p.height + 10; break;
            default: x = -10; y = Math.random() * p.height; break;
        }

        // Direction toward center with perpendicular offset for orbit
        const cx = p.width * 0.5;
        const cy = p.height * 0.5;
        const dx = cx - x;
        const dy = cy - y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 1;
        const nx = dx / dist;
        const ny = dy / dist;

        // Add perpendicular component for angular momentum
        const perpDir = Math.random() > 0.5 ? 1 : -1;
        const angularSpeed = 1.5 + Math.random() * 2.5;
        const radialSpeed = 0.5 + Math.random() * 1.5;

        return {
            x, y,
            vx: nx * radialSpeed + (-ny) * perpDir * angularSpeed,
            vy: ny * radialSpeed + nx * perpDir * angularSpeed,
            life: 0.7 + Math.random() * 0.3,
        };
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
        this.centerGlow = Math.max(this.centerGlow, strength);
        if (this.p5 && strength > 0.2) {
            const p = this.p5;
            const count = Math.floor(strength * 12) + 5;
            for (let i = 0; i < count; i++) {
                const pt = this._makeOrbital(p);
                // Fast injection
                pt.vx *= 1.8;
                pt.vy *= 1.8;
                this.particles.push(pt);
            }
        }
    }
}

window.VJamFX.presets['gravity-well'] = GravityWellPreset;
})();
