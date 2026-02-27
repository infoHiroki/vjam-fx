(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PondLifePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.ripples = [];
        this.bugs = [];
        this.lilyPads = [];
        this.fish = null;
    }

    setup(container) {
        this.destroy();
        this.ripples = [];
        this.bugs = [];
        this.lilyPads = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);

                // Multiple lily pads with flowers at varied positions
                const padPositions = [
                    { rx: 0.15, ry: 0.25 }, { rx: 0.7, ry: 0.2 },
                    { rx: 0.35, ry: 0.55 }, { rx: 0.8, ry: 0.65 },
                    { rx: 0.2, ry: 0.75 }, { rx: 0.55, ry: 0.35 },
                    { rx: 0.9, ry: 0.4 },
                ];
                for (let i = 0; i < padPositions.length; i++) {
                    const pos = padPositions[i];
                    preset.lilyPads.push({
                        x: pos.rx * p.width + (Math.random() - 0.5) * 40,
                        y: pos.ry * p.height + (Math.random() - 0.5) * 40,
                        size: 35 + Math.random() * 30,
                        rot: Math.random() * Math.PI * 2,
                        hue: 115 + Math.random() * 30,
                        hasFlower: i < 4,
                        flowerHue: [340, 30, 310, 10][i % 4],
                        flowerPhase: Math.random() * Math.PI * 2,
                    });
                }

                // Water striders
                for (let i = 0; i < 8; i++) {
                    preset.bugs.push({
                        x: Math.random() * p.width,
                        y: Math.random() * p.height,
                        vx: (Math.random() - 0.5) * 2,
                        vy: (Math.random() - 0.5) * 2,
                        legAngle: Math.random() * Math.PI * 2,
                    });
                }

                // Fish shadow
                preset.fish = {
                    x: Math.random() * p.width,
                    y: p.height * 0.5,
                    vx: 0.8 + Math.random() * 0.5,
                    angle: 0,
                };
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.01 * speed;
                preset.beatPulse *= 0.92;

                p.background(0);

                // Full-screen water surface with layered waves
                p.noStroke();
                // Deep water base
                for (let y = 0; y < p.height; y += 20) {
                    const waveBri = 8 + Math.sin(y * 0.02 + t * 1.5) * 3
                        + Math.sin(y * 0.008 + t * 0.7) * 2
                        + preset.audio.bass * 5;
                    p.fill(200, 50, waveBri, 80);
                    p.rect(0, y, p.width, 22);
                }

                // Full-screen ripple pattern (concentric waves from multiple origins)
                const origins = [
                    { ox: p.width * 0.2, oy: p.height * 0.3 },
                    { ox: p.width * 0.7, oy: p.height * 0.6 },
                    { ox: p.width * 0.5, oy: p.height * 0.15 },
                    { ox: p.width * 0.85, oy: p.height * 0.25 },
                    { ox: p.width * 0.3, oy: p.height * 0.8 },
                ];
                for (const orig of origins) {
                    for (let r = 0; r < 5; r++) {
                        const radius = ((t * 40 + r * 60) % 300) + 10;
                        const alpha = p.map(radius, 10, 310, 18, 0);
                        if (alpha <= 0) continue;
                        p.noFill();
                        p.stroke(190, 25, 50 + preset.audio.mid * 20, alpha);
                        p.strokeWeight(1.2);
                        p.ellipse(orig.ox, orig.oy, radius * 2, radius * 1.2);
                    }
                }

                // Water caustic light patches across full screen
                p.noStroke();
                for (let i = 0; i < 14; i++) {
                    const cx = p.noise(i * 3.7, t * 0.25) * p.width;
                    const cy = p.noise(i * 3.7 + 100, t * 0.25) * p.height;
                    const sz = 50 + p.noise(i * 7, t * 0.4) * 140;
                    p.fill(185, 25, 25 + preset.audio.mid * 15, 12);
                    p.ellipse(cx, cy, sz, sz * 0.55);
                }

                // Fish shadow
                const f = preset.fish;
                f.x += f.vx * speed;
                f.angle = Math.sin(t * 2) * 0.15;
                if (f.x > p.width + 60) { f.x = -60; f.y = p.height * 0.3 + Math.random() * p.height * 0.4; }
                p.push();
                p.translate(f.x, f.y);
                p.rotate(f.angle);
                p.noStroke();
                p.fill(200, 30, 15, 22);
                p.ellipse(0, 0, 55, 20);
                p.triangle(27, 0, 42, -12, 42, 12);
                p.pop();

                // Dynamic ripples
                for (let i = preset.ripples.length - 1; i >= 0; i--) {
                    const r = preset.ripples[i];
                    r.radius += (1.0 + preset.audio.bass * 0.6) * speed;
                    r.alpha -= 0.7 * speed;
                    if (r.alpha <= 0) { preset.ripples.splice(i, 1); continue; }
                    p.noFill();
                    p.strokeWeight(1.2);
                    p.stroke(190, 20, 65, r.alpha);
                    p.ellipse(r.cx, r.cy, r.radius * 2, r.radius * 1.3);
                    if (r.radius > 12) {
                        p.stroke(195, 15, 55, r.alpha * 0.4);
                        p.ellipse(r.cx, r.cy, r.radius * 1.5, r.radius * 0.95);
                    }
                }

                // Spawn ripples across entire screen
                if (p.frameCount % 25 === 0) {
                    preset.ripples.push({
                        cx: Math.random() * p.width,
                        cy: Math.random() * p.height,
                        radius: 2, alpha: 45,
                    });
                }

                // Lily pads with proper bezier water lilies
                for (const lp of preset.lilyPads) {
                    const bob = Math.sin(t * 1.2 + lp.x * 0.01) * 3;
                    p.push();
                    p.translate(lp.x, lp.y + bob);
                    p.rotate(lp.rot + Math.sin(t * 0.5 + lp.y * 0.01) * 0.05);

                    // Pad shadow on water
                    p.noStroke();
                    p.fill(200, 30, 8, 25);
                    p.ellipse(2, 3, lp.size * 1.1, lp.size * 0.9);

                    // Lily pad (notched circle)
                    p.fill(lp.hue, 55, 30, 65);
                    p.arc(0, 0, lp.size, lp.size, 0.15, Math.PI * 2 - 0.15, p.PIE);

                    // Pad veins
                    p.stroke(lp.hue, 40, 22, 35);
                    p.strokeWeight(0.7);
                    for (let v = 0; v < 5; v++) {
                        const va = 0.15 + v * (Math.PI * 2 - 0.3) / 5;
                        p.line(0, 0, Math.cos(va) * lp.size * 0.42, Math.sin(va) * lp.size * 0.42);
                    }

                    // Water lily flower with bezier petals
                    if (lp.hasFlower) {
                        const bloom = 0.7 + Math.sin(t * 0.8 + lp.flowerPhase) * 0.3;
                        const fSize = lp.size * 0.4 * bloom;
                        const petalCount = 8;

                        // Outer petals
                        p.noStroke();
                        for (let pe = 0; pe < petalCount; pe++) {
                            const pa = pe * (Math.PI * 2 / petalCount) + Math.sin(t * 0.3) * 0.1;
                            const petalLen = fSize * 1.1;
                            p.push();
                            p.rotate(pa);
                            p.fill(lp.flowerHue, 50, 85, 60 * bloom);
                            p.beginShape();
                            p.vertex(0, 0);
                            p.bezierVertex(
                                petalLen * 0.3, -petalLen * 0.25,
                                petalLen * 0.7, -petalLen * 0.2,
                                petalLen, 0
                            );
                            p.bezierVertex(
                                petalLen * 0.7, petalLen * 0.2,
                                petalLen * 0.3, petalLen * 0.25,
                                0, 0
                            );
                            p.endShape(p.CLOSE);
                            p.pop();
                        }

                        // Inner petals (smaller, brighter)
                        for (let pe = 0; pe < petalCount; pe++) {
                            const pa = pe * (Math.PI * 2 / petalCount) + Math.PI / petalCount;
                            const petalLen = fSize * 0.7;
                            p.push();
                            p.rotate(pa);
                            p.fill(lp.flowerHue, 35, 95, 70 * bloom);
                            p.beginShape();
                            p.vertex(0, 0);
                            p.bezierVertex(
                                petalLen * 0.25, -petalLen * 0.18,
                                petalLen * 0.6, -petalLen * 0.15,
                                petalLen, 0
                            );
                            p.bezierVertex(
                                petalLen * 0.6, petalLen * 0.15,
                                petalLen * 0.25, petalLen * 0.18,
                                0, 0
                            );
                            p.endShape(p.CLOSE);
                            p.pop();
                        }

                        // Center pistil
                        p.fill(45, 80, 90, 70 * bloom);
                        p.ellipse(0, 0, fSize * 0.3, fSize * 0.3);
                    }

                    p.pop();
                }

                // Water striders
                for (const b of preset.bugs) {
                    b.vx += (p.noise(b.x * 0.01, t) - 0.5) * 0.3;
                    b.vy += (p.noise(b.y * 0.01, t + 50) - 0.5) * 0.3;
                    b.vx *= 0.96; b.vy *= 0.96;
                    b.x += b.vx * speed; b.y += b.vy * speed;
                    if (b.x < 10 || b.x > p.width - 10) b.vx *= -1;
                    if (b.y < 10 || b.y > p.height - 10) b.vy *= -1;
                    b.x = p.constrain(b.x, 5, p.width - 5);
                    b.y = p.constrain(b.y, 5, p.height - 5);
                    b.legAngle += 0.03 * speed;

                    // Dimple shadow
                    p.noStroke();
                    p.fill(195, 30, 35, 10);
                    p.ellipse(b.x, b.y, 22, 15);

                    // Body
                    p.fill(180, 20, 60, 70);
                    p.ellipse(b.x, b.y, 4, 3);
                    p.stroke(180, 15, 50, 50);
                    p.strokeWeight(0.7);
                    for (let l = 0; l < 6; l++) {
                        const la = b.legAngle + l * Math.PI / 3;
                        const legLen = 11 + Math.sin(la * 2) * 2;
                        const side = l < 3 ? 1 : -1;
                        const angle = (l % 3 - 1) * 0.6 + Math.atan2(b.vy, b.vx);
                        p.line(b.x, b.y,
                            b.x + Math.cos(angle + side * 0.5) * legLen,
                            b.y + Math.sin(angle + side * 0.5) * legLen);
                    }
                }

                // Beat: new ripples + scatter bugs
                if (preset.beatPulse > 0.3) {
                    for (let r = 0; r < 3; r++) {
                        preset.ripples.push({
                            cx: Math.random() * p.width,
                            cy: Math.random() * p.height,
                            radius: 3, alpha: 55 + preset.beatPulse * 20,
                        });
                    }
                    for (const b of preset.bugs) {
                        b.vx += (Math.random() - 0.5) * 4;
                        b.vy += (Math.random() - 0.5) * 4;
                    }
                }

                if (preset.ripples.length > 40) preset.ripples.splice(0, preset.ripples.length - 40);
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
window.VJamFX.presets['pond-life'] = PondLifePreset;
})();
