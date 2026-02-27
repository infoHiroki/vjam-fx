(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class LightSwarmPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.boids = [];
        this.scatterTimer = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                for (let i = 0; i < 100; i++) {
                    preset.boids.push(preset._makeBoid(p));
                }
            };

            p.draw = () => {
                // Semi-transparent background for light trails
                p.background(0, 0, 0, 22);
                preset.beatPulse *= 0.92;
                if (preset.scatterTimer > 0) preset.scatterTimer--;

                const isScattering = preset.scatterTimer > 0;

                for (let i = 0; i < preset.boids.length; i++) {
                    const b = preset.boids[i];
                    let sepX = 0, sepY = 0;
                    let aliX = 0, aliY = 0;
                    let cohX = 0, cohY = 0;
                    let sepCount = 0, aliCount = 0, cohCount = 0;

                    for (let j = 0; j < preset.boids.length; j++) {
                        if (i === j) continue;
                        const other = preset.boids[j];
                        const dx = other.x - b.x;
                        const dy = other.y - b.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        // Separation (< 30px)
                        if (dist < 30 && dist > 0) {
                            sepX -= dx / dist;
                            sepY -= dy / dist;
                            sepCount++;
                        }
                        // Alignment (< 80px)
                        if (dist < 80) {
                            aliX += other.vx;
                            aliY += other.vy;
                            aliCount++;
                        }
                        // Cohesion (< 120px)
                        if (dist < 120) {
                            cohX += other.x;
                            cohY += other.y;
                            cohCount++;
                        }
                    }

                    // Apply forces
                    const sepForce = isScattering ? 0.25 : 0.08;
                    const aliForce = isScattering ? 0.01 : 0.05;
                    const cohForce = isScattering ? -0.02 : 0.03;

                    if (sepCount > 0) {
                        b.vx += (sepX / sepCount) * sepForce;
                        b.vy += (sepY / sepCount) * sepForce;
                    }
                    if (aliCount > 0) {
                        b.vx += ((aliX / aliCount) - b.vx) * aliForce;
                        b.vy += ((aliY / aliCount) - b.vy) * aliForce;
                    }
                    if (cohCount > 0) {
                        const avgX = cohX / cohCount;
                        const avgY = cohY / cohCount;
                        b.vx += (avgX - b.x) * cohForce * 0.01;
                        b.vy += (avgY - b.y) * cohForce * 0.01;
                    }

                    // Scatter: add random burst velocity
                    if (isScattering && preset.scatterTimer > 50) {
                        b.vx += (Math.random() - 0.5) * 3;
                        b.vy += (Math.random() - 0.5) * 3;
                    }

                    // Speed limit
                    const maxSpd = isScattering ? 5 : 3;
                    const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
                    if (spd > maxSpd) {
                        b.vx = (b.vx / spd) * maxSpd;
                        b.vy = (b.vy / spd) * maxSpd;
                    }
                    // Min speed
                    if (spd < 0.5) {
                        b.vx += (Math.random() - 0.5) * 0.5;
                        b.vy += (Math.random() - 0.5) * 0.5;
                    }

                    b.x += b.vx * preset.params.speed;
                    b.y += b.vy * preset.params.speed;

                    // Wrap edges
                    if (b.x < -20) b.x = p.width + 20;
                    if (b.x > p.width + 20) b.x = -20;
                    if (b.y < -20) b.y = p.height + 20;
                    if (b.y > p.height + 20) b.y = -20;

                    // Color based on x position
                    const hue = p.map(b.x, 0, p.width, 0, 360) % 360;
                    const brightness = 75 + preset.audio.mid * 20;
                    const alpha = 55 + preset.beatPulse * 20;

                    // Outer glow
                    p.noStroke();
                    p.fill(hue, 60, brightness, alpha * 0.15);
                    p.ellipse(b.x, b.y, 22, 22);

                    // Inner glow
                    p.fill(hue, 50, Math.min(100, brightness + 15), alpha * 0.35);
                    p.ellipse(b.x, b.y, 10, 10);

                    // Core
                    p.fill(hue, 25, 100, alpha * 0.7);
                    p.ellipse(b.x, b.y, 4, 4);
                }

                // Maintain population
                while (preset.boids.length < 80) {
                    preset.boids.push(preset._makeBoid(p));
                }
                if (preset.boids.length > 120) {
                    preset.boids.splice(0, preset.boids.length - 120);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _makeBoid(p) {
        return {
            x: Math.random() * p.width,
            y: Math.random() * p.height,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
        };
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        if (strength > 0.3) {
            this.scatterTimer = 60;
        }
        if (this.p5 && strength > 0.4) {
            const p = this.p5;
            const count = Math.floor(strength * 6) + 2;
            for (let i = 0; i < count; i++) {
                this.boids.push(this._makeBoid(p));
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['light-swarm'] = LightSwarmPreset;
})();
