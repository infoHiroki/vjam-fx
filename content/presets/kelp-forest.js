(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class KelpForestPreset extends BasePreset {
    constructor() {
        super();
        this.params = {};
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.bubbles = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                preset.bubbles = [];
                for (let i = 0; i < 25; i++) {
                    preset._addBubble(p, false);
                }
            };

            preset._addBubble = (p, fromBottom) => {
                preset.bubbles.push({
                    x: Math.random() * p.width,
                    y: fromBottom ? p.height + 10 : Math.random() * p.height,
                    size: 2 + Math.random() * 5,
                    speed: 0.3 + Math.random() * 0.8,
                    wobble: Math.random() * Math.PI * 2
                });
            };

            p.draw = () => {
                const t = p.frameCount * 0.006;
                preset.beatPulse *= 0.92;

                // Deep water background
                p.background(195, 50, 8, 100);

                // --- God rays from surface ---
                p.noStroke();
                for (let r = 0; r < 8; r++) {
                    const baseX = p.noise(r * 10, t * 0.2) * p.width;
                    const rayWidth = 40 + p.noise(r * 20, t * 0.15) * 80 + preset.audio.treble * 40;
                    const rayBri = 0.7 + preset.beatPulse * 0.5;
                    for (let y = 0; y < p.height; y += 6) {
                        const yRatio = y / p.height;
                        const alpha = (1 - yRatio) * (1 - yRatio) * (4 + preset.audio.rms * 5) * rayBri;
                        const wobble = Math.sin(y * 0.008 + t * 1.2 + r * 2) * (20 + yRatio * 30);
                        const spread = rayWidth * (1 + yRatio * 0.8);
                        p.fill(175 + r * 3, 25, 75, alpha);
                        p.rect(baseX + wobble - spread / 2, y, spread, 8);
                    }
                }

                // --- Caustic light patterns on sea floor ---
                const floorY = p.height * 0.7;
                p.noStroke();
                for (let cx = 0; cx < p.width; cx += 12) {
                    for (let cy = floorY; cy < p.height; cy += 12) {
                        const n1 = p.noise(cx * 0.008, cy * 0.008, t * 0.8);
                        const n2 = p.noise(cx * 0.015 + 100, cy * 0.015, t * 0.6);
                        const caustic = n1 * n2;
                        if (caustic > 0.28) {
                            const bri = (caustic - 0.28) * 2.5;
                            const alpha = bri * (18 + preset.audio.bass * 12 + preset.beatPulse * 8);
                            const hue = 170 + n1 * 30;
                            p.fill(hue, 20, 85, Math.min(alpha, 35));
                            const sz = 10 + bri * 8;
                            p.ellipse(cx, cy, sz, sz * 0.6);
                        }
                    }
                }

                // --- Dancing light reflections (mid-water caustics) ---
                for (let i = 0; i < 12; i++) {
                    const nx = p.noise(i * 5.7, t * 0.4) * p.width;
                    const ny = p.noise(i * 8.3, t * 0.35) * p.height * 0.8;
                    const pulse = p.noise(i * 3.1, t * 1.2);
                    if (pulse > 0.45) {
                        const alpha = (pulse - 0.45) * (30 + preset.audio.mid * 20 + preset.beatPulse * 15);
                        const sz = 30 + pulse * 50 + preset.audio.rms * 30;
                        p.fill(180 + i * 4, 15, 80, Math.min(alpha, 25));
                        p.ellipse(nx, ny, sz, sz * 0.7);
                    }
                }

                // --- Surface shimmer at top ---
                for (let sx = 0; sx < p.width; sx += 8) {
                    const shimmer = p.noise(sx * 0.02, t * 2);
                    if (shimmer > 0.55) {
                        const alpha = (shimmer - 0.55) * (40 + preset.audio.treble * 25);
                        p.fill(185, 15, 90, Math.min(alpha, 20));
                        const sw = 6 + shimmer * 10;
                        p.rect(sx, 0, sw, 3 + shimmer * 8);
                    }
                }

                // --- Floating light spots (dappled sunlight) ---
                for (let i = 0; i < 20; i++) {
                    const phase = t * 0.3 + i * 1.7;
                    const lx = p.width * 0.5 + Math.sin(phase) * p.width * 0.4 * p.noise(i * 2, t * 0.1);
                    const ly = p.noise(i * 4.2, t * 0.25) * p.height * 0.6 + p.height * 0.05;
                    const brightness = p.noise(i * 6, t * 0.7);
                    if (brightness > 0.4) {
                        const alpha = (brightness - 0.4) * (15 + preset.audio.rms * 10);
                        const sz = 15 + brightness * 25;
                        p.fill(175 + i * 2, 20, 85, Math.min(alpha, 18));
                        p.ellipse(lx, ly, sz, sz);
                    }
                }

                // Bubbles
                p.noStroke();
                for (let i = preset.bubbles.length - 1; i >= 0; i--) {
                    const b = preset.bubbles[i];
                    b.y -= b.speed;
                    b.x += Math.sin(p.frameCount * 0.03 + b.wobble) * 0.4;
                    if (b.y < -10) {
                        preset.bubbles.splice(i, 1);
                        preset._addBubble(p, true);
                        continue;
                    }
                    p.fill(180, 20, 90, 20);
                    p.circle(b.x, b.y, b.size);
                    p.fill(180, 10, 100, 35);
                    p.circle(b.x - b.size * 0.15, b.y - b.size * 0.15, b.size * 0.3);
                }

                // Beat: bubble burst
                if (preset.beatPulse > 0.3) {
                    for (let i = 0; i < 6; i++) {
                        preset._addBubble(p, true);
                    }
                }
                p.noStroke();
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
    }

    onBeat(strength) {
        this.beatPulse = strength;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['kelp-forest'] = KelpForestPreset;
})();
