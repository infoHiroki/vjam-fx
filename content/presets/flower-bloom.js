(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FlowerBloomPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.flowers = [];
    }

    setup(container) {
        this.destroy();
        this.flowers = [];
        const preset = this;

        // Bold "Do The Right Thing" palette — saturated primaries + hot pinks
        const PALETTE = [
            { h: 0, s: 85, b: 95 },     // hot red
            { h: 30, s: 90, b: 100 },    // orange
            { h: 55, s: 85, b: 100 },    // bold yellow
            { h: 160, s: 80, b: 90 },    // teal green
            { h: 200, s: 85, b: 100 },   // electric blue
            { h: 280, s: 75, b: 95 },    // purple
            { h: 330, s: 85, b: 100 },   // hot pink
            { h: 15, s: 95, b: 100 },    // deep orange
        ];

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                // Start with a few flowers at different stages
                for (let i = 0; i < 5; i++) {
                    preset._spawnFlower(p, i * 0.15);
                }
            };

            p.draw = () => {
                // Fade to black — rate tied to audio energy
                p.background(0, 0, 0, p.lerp(18, 35, preset.audio.rms));
                const speed = preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.88;
                const t = p.frameCount * 0.012 * speed;

                // --- Draw each flower ---
                for (let i = preset.flowers.length - 1; i >= 0; i--) {
                    const f = preset.flowers[i];
                    f.life += (0.003 + bass * 0.003) * speed;
                    if (f.life > 1.2) { preset.flowers.splice(i, 1); continue; }

                    // Bloom phases: bud (0-0.2), opening (0.2-0.5), full (0.5-0.85), wilt (0.85-1.2)
                    const bloom = f.life < 0.2 ? f.life / 0.2 * 0.3 :
                                  f.life < 0.5 ? 0.3 + (f.life - 0.2) / 0.3 * 0.7 :
                                  1.0;
                    const fade = f.life > 0.85 ? 1.0 - (f.life - 0.85) / 0.35 : 1.0;
                    const alpha = fade * 90;
                    if (alpha < 1) continue;

                    const radius = f.maxR * bloom * (1 + bass * 0.25);
                    f.rot += 0.002 * speed;

                    p.push();
                    p.translate(f.x, f.y);
                    p.rotate(f.rot);

                    // --- BOLD GEOMETRIC PETALS (Do The Right Thing style) ---
                    const petalCount = f.petalCount;
                    const angleStep = p.TWO_PI / petalCount;

                    // Outer glow ring
                    p.noStroke();
                    p.fill(f.color.h, f.color.s * 0.5, f.color.b, alpha * 0.15);
                    p.ellipse(0, 0, radius * 2.8, radius * 2.8);

                    // Draw petals as bold geometric shapes
                    for (let j = 0; j < petalCount; j++) {
                        const angle = j * angleStep + Math.sin(t + f.phase) * 0.08;
                        const petalOpen = bloom < 0.3 ? bloom / 0.3 : 1.0;
                        const petalLen = radius * (0.7 + petalOpen * 0.3);
                        const petalWid = radius * 0.35 * petalOpen;

                        // Each petal slightly different hue for boldness
                        const pH = (f.color.h + j * 8) % 360;
                        const pS = f.color.s;
                        const pB = f.color.b;

                        p.push();
                        p.rotate(angle);

                        // Petal shape: bold trapezoid/diamond hybrid
                        if (f.petalStyle === 0) {
                            // Diamond petals
                            p.noStroke();
                            p.fill(pH, pS, pB, alpha);
                            p.quad(0, -petalWid * 0.4, petalLen, 0, 0, petalWid * 0.4, petalLen * 0.15, 0);
                            // Bold black outline for graphic look
                            p.stroke(0, 0, 0, alpha * 0.7);
                            p.strokeWeight(2);
                            p.noFill();
                            p.quad(0, -petalWid * 0.4, petalLen, 0, 0, petalWid * 0.4, petalLen * 0.15, 0);
                        } else if (f.petalStyle === 1) {
                            // Rounded bold petals
                            p.noStroke();
                            p.fill(pH, pS, pB, alpha);
                            p.ellipse(petalLen * 0.5, 0, petalLen, petalWid * 1.4);
                            // Bold outline
                            p.stroke(0, 0, 0, alpha * 0.6);
                            p.strokeWeight(2);
                            p.noFill();
                            p.ellipse(petalLen * 0.5, 0, petalLen, petalWid * 1.4);
                        } else {
                            // Angular/pointed petals — more graphic
                            p.noStroke();
                            p.fill(pH, pS, pB, alpha);
                            p.beginShape();
                            p.vertex(0, 0);
                            p.vertex(petalLen * 0.3, -petalWid * 0.5);
                            p.vertex(petalLen, -petalWid * 0.15);
                            p.vertex(petalLen * 0.85, 0);
                            p.vertex(petalLen, petalWid * 0.15);
                            p.vertex(petalLen * 0.3, petalWid * 0.5);
                            p.endShape(p.CLOSE);
                            // Bold outline
                            p.stroke(0, 0, 0, alpha * 0.6);
                            p.strokeWeight(2);
                            p.noFill();
                            p.beginShape();
                            p.vertex(0, 0);
                            p.vertex(petalLen * 0.3, -petalWid * 0.5);
                            p.vertex(petalLen, -petalWid * 0.15);
                            p.vertex(petalLen * 0.85, 0);
                            p.vertex(petalLen, petalWid * 0.15);
                            p.vertex(petalLen * 0.3, petalWid * 0.5);
                            p.endShape(p.CLOSE);
                        }

                        // Highlight stripe on each petal (graphic style)
                        p.noStroke();
                        p.fill((pH + 15) % 360, pS - 15, Math.min(pB + 10, 100), alpha * 0.5);
                        p.ellipse(petalLen * 0.45, 0, petalLen * 0.5, petalWid * 0.3);

                        p.pop();
                    }

                    // --- Center disc (bold, graphic) ---
                    const cSize = radius * 0.3 * (1 + mid * 0.3);
                    // Outer ring of center
                    p.noStroke();
                    p.fill((f.color.h + 180) % 360, 70, 90, alpha);
                    p.ellipse(0, 0, cSize * 1.3, cSize * 1.3);
                    // Bold outline
                    p.stroke(0, 0, 0, alpha * 0.8);
                    p.strokeWeight(2.5);
                    p.noFill();
                    p.ellipse(0, 0, cSize * 1.3, cSize * 1.3);
                    // Inner center
                    p.noStroke();
                    p.fill((f.color.h + 40) % 360, 90, 100, alpha);
                    p.ellipse(0, 0, cSize * 0.7, cSize * 0.7);

                    // Center dots — bold graphic detail
                    const dotCount = f.petalCount;
                    for (let d = 0; d < dotCount; d++) {
                        const da = (d / dotCount) * p.TWO_PI + t * 0.5;
                        const dr = cSize * 0.45;
                        p.fill(0, 0, 0, alpha * 0.6);
                        p.ellipse(Math.cos(da) * dr, Math.sin(da) * dr, 3, 3);
                    }

                    p.pop();

                    // --- Bold stem line (graphic style) ---
                    if (f.y < p.height * 0.85) {
                        const stemBottom = Math.min(f.y + radius * 1.5 + 40, p.height);
                        p.stroke(130, 70, 50, alpha * 0.7);
                        p.strokeWeight(3);
                        p.line(f.x, f.y + radius * 0.3, f.x + Math.sin(t + f.phase) * 5, stemBottom);
                        p.noStroke();
                    }
                }

                // --- Spawn new flowers periodically ---
                if (p.frameCount % 90 === 0 && preset.flowers.length < 8) {
                    preset._spawnFlower(p, 0);
                }

                // --- Beat flash: bold color pop ---
                if (pulse > 0.1) {
                    const flashColor = PALETTE[Math.floor(Math.random() * PALETTE.length)];
                    p.noStroke();
                    p.fill(flashColor.h, flashColor.s * 0.3, flashColor.b, pulse * 10);
                    p.rect(0, 0, p.width, p.height);
                }

                // --- Graphic text-like bold shapes floating (Do The Right Thing vibe) ---
                const blockCount = 3 + Math.floor(treble * 4);
                for (let b = 0; b < blockCount; b++) {
                    const bx = p.noise(b * 3.1, t * 0.5) * p.width;
                    const by = p.noise(b * 3.1 + 100, t * 0.5) * p.height;
                    const bSize = 4 + p.noise(b * 2, t) * 12;
                    const bColor = PALETTE[b % PALETTE.length];
                    p.fill(bColor.h, bColor.s, bColor.b, 15 + treble * 15);
                    p.noStroke();
                    // Small geometric accents
                    if (b % 3 === 0) {
                        p.rectMode(p.CENTER);
                        p.rect(bx, by, bSize, bSize);
                        p.rectMode(p.CORNER);
                    } else if (b % 3 === 1) {
                        p.triangle(bx, by - bSize * 0.5, bx - bSize * 0.5, by + bSize * 0.5, bx + bSize * 0.5, by + bSize * 0.5);
                    } else {
                        p.ellipse(bx, by, bSize, bSize);
                    }
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _spawnFlower(p, initialLife = 0) {
        const PALETTE = [
            { h: 0, s: 85, b: 95 },
            { h: 30, s: 90, b: 100 },
            { h: 55, s: 85, b: 100 },
            { h: 160, s: 80, b: 90 },
            { h: 200, s: 85, b: 100 },
            { h: 280, s: 75, b: 95 },
            { h: 330, s: 85, b: 100 },
            { h: 15, s: 95, b: 100 },
        ];
        this.flowers.push({
            x: p.width * 0.1 + Math.random() * p.width * 0.8,
            y: p.height * 0.1 + Math.random() * p.height * 0.75,
            life: initialLife,
            maxR: 45 + Math.random() * 55,
            petalCount: 5 + Math.floor(Math.random() * 4), // 5-8 petals
            petalStyle: Math.floor(Math.random() * 3),
            color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
            rot: Math.random() * Math.PI * 2,
            phase: Math.random() * 10,
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
        if (this.p5 && this.flowers.length < 8) {
            this._spawnFlower(this.p5, 0);
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['flower-bloom'] = FlowerBloomPreset;
})();
