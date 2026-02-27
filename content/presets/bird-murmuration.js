(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class BirdMurmurationPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.birds = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;
        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.background(0);
                preset._initBirds(p);
            };
            p.draw = () => {
                // Trail effect
                p.fill(0, 0, 0, p.lerp(12, 25, preset.audio.rms));
                p.noStroke();
                p.rect(0, 0, p.width, p.height);
                const sp = preset.params.speed;
                // Boids simulation
                for (const bird of preset.birds) {
                    let sepX = 0, sepY = 0, sepCount = 0;
                    let aliX = 0, aliY = 0, aliCount = 0;
                    let cohX = 0, cohY = 0, cohCount = 0;
                    for (const other of preset.birds) {
                        if (other === bird) continue;
                        const dx = other.x - bird.x, dy = other.y - bird.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        // Separation
                        if (dist < 25 && dist > 0) {
                            sepX -= dx / dist; sepY -= dy / dist; sepCount++;
                        }
                        // Alignment + Cohesion
                        if (dist < 80) {
                            aliX += other.vx; aliY += other.vy; aliCount++;
                            cohX += other.x; cohY += other.y; cohCount++;
                        }
                    }
                    let fx = 0, fy = 0;
                    if (sepCount > 0) { fx += sepX * 0.08; fy += sepY * 0.08; }
                    if (aliCount > 0) { fx += (aliX / aliCount - bird.vx) * 0.04; fy += (aliY / aliCount - bird.vy) * 0.04; }
                    if (cohCount > 0) { fx += (cohX / cohCount - bird.x) * 0.0005; fy += (cohY / cohCount - bird.y) * 0.0005; }
                    // Edge avoidance
                    const margin = 80;
                    if (bird.x < margin) fx += 0.1;
                    if (bird.x > p.width - margin) fx -= 0.1;
                    if (bird.y < margin) fy += 0.1;
                    if (bird.y > p.height - margin) fy -= 0.1;
                    // Gentle circular drift
                    const cx = p.width / 2, cy = p.height / 2;
                    const toCx = cx - bird.x, toCy = cy - bird.y;
                    const dCenter = Math.sqrt(toCx * toCx + toCy * toCy);
                    if (dCenter > 50) {
                        fx += (-toCy / dCenter) * 0.015;
                        fy += (toCx / dCenter) * 0.015;
                    }
                    // Audio influence
                    fx += (p.noise(bird.x * 0.005, bird.y * 0.005, p.frameCount * 0.01) - 0.5) * preset.audio.mid * 0.5;
                    fy += (p.noise(bird.y * 0.005, bird.x * 0.005, p.frameCount * 0.01) - 0.5) * preset.audio.mid * 0.5;
                    bird.vx += fx * sp;
                    bird.vy += fy * sp;
                    // Limit speed
                    const speed = Math.sqrt(bird.vx * bird.vx + bird.vy * bird.vy);
                    const maxSpeed = 3 + preset.audio.rms * 2;
                    if (speed > maxSpeed) { bird.vx = (bird.vx / speed) * maxSpeed; bird.vy = (bird.vy / speed) * maxSpeed; }
                    bird.x += bird.vx * sp;
                    bird.y += bird.vy * sp;
                    // Draw bird as triangle
                    const angle = Math.atan2(bird.vy, bird.vx);
                    const size = bird.size * (1 + preset.audio.bass * 0.3);
                    const hue = 20 + p.noise(bird.x * 0.01, bird.y * 0.01) * 25;
                    const bri = 60 + speed * 8;
                    // Glow
                    p.noStroke();
                    p.fill(hue, 40, bri, 15);
                    p.push();
                    p.translate(bird.x, bird.y);
                    p.rotate(angle);
                    p.triangle(-size * 1.8, -size * 0.8, -size * 1.8, size * 0.8, size * 1.5, 0);
                    p.pop();
                    // Main bird
                    p.fill(hue, 50, Math.min(bri, 90), 75);
                    p.push();
                    p.translate(bird.x, bird.y);
                    p.rotate(angle);
                    p.triangle(-size, -size * 0.5, -size, size * 0.5, size, 0);
                    p.pop();
                }
                // Beat: scatter burst
                if (preset.beatPulse > 0) {
                    if (preset.beatPulse > 0.9) {
                        for (const bird of preset.birds) {
                            bird.vx += (Math.random() - 0.5) * 6;
                            bird.vy += (Math.random() - 0.5) * 6;
                        }
                    }
                    // Subtle flash
                    p.noStroke();
                    p.fill(30, 20, 100, preset.beatPulse * 8);
                    p.rect(0, 0, p.width, p.height);
                    preset.beatPulse *= 0.85;
                }
            };
            p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); p.background(0); };
        }, container);
    }

    _initBirds(p) {
        this.birds = [];
        const cx = p.width / 2, cy = p.height / 2;
        for (let i = 0; i < 150; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 50 + Math.random() * 150;
            this.birds.push({
                x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r,
                vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
                size: 3 + Math.random() * 3
            });
        }
    }

    updateAudio(ad) { this.audio.bass = ad.bass || 0; this.audio.mid = ad.mid || 0; this.audio.treble = ad.treble || 0; this.audio.rms = ad.rms || 0; }
    onBeat(s) { this.beatPulse = s; }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['bird-murmuration'] = BirdMurmurationPreset;
})();
