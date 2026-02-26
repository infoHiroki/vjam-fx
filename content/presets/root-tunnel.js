(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class RootTunnelPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.roots = [];
        this.rings = [];
    }

    setup(container) {
        this.destroy();
        this.roots = [];
        this.rings = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.background(0);
                preset._initRings();
                preset._initRoots(p);
            };

            p.draw = () => {
                p.background(0);
                // Semi-transparent black for trails
                p.fill(0, 0, 0, 15 + preset.audio.rms * 10);
                p.noStroke();
                p.rect(0, 0, p.width, p.height);

                const cx = p.width / 2;
                const cy = p.height / 2;
                const maxR = Math.sqrt(cx * cx + cy * cy);
                const time = p.frameCount * 0.008 * preset.params.speed;
                const speedMult = (1 + preset.audio.rms * 2) * preset.params.speed;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;

                // === TUNNEL RINGS (background depth cue) ===
                preset.rings.sort((a, b) => a.z - b.z);
                for (const ring of preset.rings) {
                    ring.z -= 0.006 * speedMult;
                    if (ring.z < 0.02) {
                        ring.z = 1.0;
                        ring.noiseSeed = Math.random() * 100;
                    }
                    const radius = maxR * 0.7 * ring.z;
                    const proximity = 1 - ring.z;
                    const hue = p.lerp(25, 40, proximity);
                    const sat = p.lerp(30, 50, proximity);
                    const bri = p.lerp(10, 35, proximity);
                    const alpha = p.lerp(10, 40, proximity);
                    const wobbleAmt = p.lerp(3, 25, proximity);

                    p.noFill();
                    p.stroke(hue, sat, bri, alpha);
                    p.strokeWeight(p.lerp(0.5, 2, proximity));
                    p.beginShape();
                    for (let a = 0; a <= p.TWO_PI + 0.1; a += 0.12) {
                        const wobble = p.noise(a * 2, ring.noiseSeed, time) * wobbleAmt;
                        p.vertex(cx + Math.cos(a) * (radius + wobble), cy + Math.sin(a) * (radius + wobble));
                    }
                    p.endShape();
                }

                // === MAIN ROOTS — thick, textured, clear structure ===
                for (const root of preset.roots) {
                    root.phase += 0.005 * speedMult;

                    const segments = 30;
                    const baseAngle = root.angle;
                    // Root grows from edge toward center
                    const startR = maxR * 0.95;
                    const endR = 30 + preset.audio.bass * 20;

                    for (let s = 0; s < segments; s++) {
                        const frac = s / segments;
                        const nextFrac = (s + 1) / segments;
                        const r1 = p.lerp(startR, endR, frac);
                        const r2 = p.lerp(startR, endR, nextFrac);

                        // Root curves via noise
                        const noiseOffset1 = p.noise(frac * 3, root.seed, time * 0.5) * 0.3 - 0.15;
                        const noiseOffset2 = p.noise(nextFrac * 3, root.seed, time * 0.5) * 0.3 - 0.15;
                        const ang1 = baseAngle + noiseOffset1 + Math.sin(root.phase + frac * 2) * 0.08;
                        const ang2 = baseAngle + noiseOffset2 + Math.sin(root.phase + nextFrac * 2) * 0.08;

                        const x1 = cx + Math.cos(ang1) * r1;
                        const y1 = cy + Math.sin(ang1) * r1;
                        const x2 = cx + Math.cos(ang2) * r2;
                        const y2 = cy + Math.sin(ang2) * r2;

                        // Root thickness: thick at edge, thinner toward center
                        const thickness = p.lerp(root.thickness, root.thickness * 0.15, frac);
                        // Proximity-based color: amber/brown
                        const proximity = frac;
                        const hue = p.lerp(25, 35, proximity);
                        const sat = p.lerp(50, 70, proximity);
                        const bri = p.lerp(30, 65, proximity) + preset.audio.bass * 10;
                        const alpha = p.lerp(40, 85, proximity);

                        // Outer glow (bioluminescence)
                        p.strokeWeight(thickness + 6);
                        p.stroke(hue + 10, sat * 0.3, bri * 0.5, alpha * 0.15 + pulse * 10);
                        p.line(x1, y1, x2, y2);

                        // Main root body
                        p.strokeWeight(thickness);
                        p.stroke(hue, sat, bri, alpha);
                        p.line(x1, y1, x2, y2);

                        // Bark texture lines along the root
                        if (s % 3 === 0 && thickness > 2) {
                            const perpAng = ang1 + Math.PI / 2;
                            const barkLen = thickness * 0.4;
                            for (let b = -1; b <= 1; b += 2) {
                                const bx1 = x1 + Math.cos(perpAng) * barkLen * b;
                                const by1 = y1 + Math.sin(perpAng) * barkLen * b;
                                const bx2 = x1 + Math.cos(perpAng) * barkLen * b * 0.3;
                                const by2 = y1 + Math.sin(perpAng) * barkLen * b * 0.3;
                                p.strokeWeight(0.8);
                                p.stroke(hue - 5, sat + 10, bri * 0.6, alpha * 0.5);
                                p.line(bx1, by1, bx2, by2);
                            }
                        }

                        // Rootlets branching off at intervals
                        if (s % 5 === 0 && s > 3 && s < segments - 3) {
                            for (let rl = 0; rl < root.rootletCount; rl++) {
                                const rlAngle = ang1 + (rl % 2 === 0 ? 1 : -1) * (0.2 + rl * 0.15 + p.noise(s, root.seed + rl, time * 0.3) * 0.3);
                                const rlLen = thickness * (1.5 + Math.random() * 1.5);
                                const rlEndX = x1 + Math.cos(rlAngle) * rlLen;
                                const rlEndY = y1 + Math.sin(rlAngle) * rlLen;

                                // Rootlet
                                p.strokeWeight(Math.max(0.5, thickness * 0.15));
                                p.stroke(hue + 5, sat * 0.8, bri * 0.7, alpha * 0.6);
                                p.line(x1, y1, rlEndX, rlEndY);

                                // Tiny hair roots at rootlet tips
                                if (Math.random() < 0.5) {
                                    const hairAngle = rlAngle + (Math.random() - 0.5) * 1.0;
                                    const hairLen = rlLen * 0.5;
                                    p.strokeWeight(0.4);
                                    p.stroke(hue + 10, sat * 0.5, bri * 0.5, alpha * 0.3);
                                    p.line(rlEndX, rlEndY, rlEndX + Math.cos(hairAngle) * hairLen, rlEndY + Math.sin(hairAngle) * hairLen);
                                }
                            }
                        }
                    }

                    // Bioluminescent glow spots along root
                    if (p.frameCount % 4 === 0) {
                        const glowFrac = 0.3 + Math.random() * 0.5;
                        const glowR = p.lerp(startR, endR, glowFrac);
                        const glowNoiseOff = p.noise(glowFrac * 3, root.seed, time * 0.5) * 0.3 - 0.15;
                        const glowAng = baseAngle + glowNoiseOff;
                        const gx = cx + Math.cos(glowAng) * glowR;
                        const gy = cy + Math.sin(glowAng) * glowR;
                        const glowSize = 4 + Math.random() * 6 + pulse * 8;
                        p.noStroke();
                        // Outer glow
                        p.fill(80 + Math.random() * 40, 40, 70, 15 + pulse * 15);
                        p.ellipse(gx, gy, glowSize * 2.5);
                        // Inner bright spot
                        p.fill(90, 35, 90, 30 + pulse * 20);
                        p.ellipse(gx, gy, glowSize);
                    }
                }

                // === CENTER LIGHT (tunnel vanishing point) ===
                const centerBri = 25 + preset.audio.rms * 20 + pulse * 30;
                p.noStroke();
                p.fill(40, 30, 80, centerBri * 0.2);
                p.ellipse(cx, cy, 80 + preset.audio.bass * 50);
                p.fill(50, 25, 95, centerBri * 0.5);
                p.ellipse(cx, cy, 30 + preset.audio.bass * 20);
                p.fill(60, 15, 100, centerBri * 0.8);
                p.ellipse(cx, cy, 10 + preset.audio.bass * 8);

                // === FLOATING SPORES ===
                if (!preset.spores) preset.spores = [];
                if (p.frameCount % 8 === 0 && preset.spores.length < 25) {
                    const sAngle = Math.random() * p.TWO_PI;
                    const sR = 20 + Math.random() * 40;
                    preset.spores.push({
                        x: cx + Math.cos(sAngle) * sR,
                        y: cy + Math.sin(sAngle) * sR,
                        vx: Math.cos(sAngle) * (0.3 + Math.random() * 0.7),
                        vy: Math.sin(sAngle) * (0.3 + Math.random() * 0.7),
                        life: 1, size: 1.5 + Math.random() * 2.5,
                    });
                }
                for (let i = preset.spores.length - 1; i >= 0; i--) {
                    const sp = preset.spores[i];
                    sp.x += sp.vx * preset.params.speed;
                    sp.y += sp.vy * preset.params.speed;
                    sp.life -= 0.005;
                    if (sp.life < 0) { preset.spores.splice(i, 1); continue; }
                    p.noStroke();
                    p.fill(85, 45, 75, sp.life * 50);
                    p.ellipse(sp.x, sp.y, sp.size * sp.life);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                p.background(0);
                preset._initRoots(p);
            };
        }, container);
    }

    _initRings() {
        this.rings = [];
        for (let i = 0; i < 18; i++) {
            this.rings.push({ z: i / 18, noiseSeed: Math.random() * 100 });
        }
    }

    _initRoots(p) {
        this.roots = [];
        const rootCount = 6 + Math.floor(Math.random() * 3);
        for (let i = 0; i < rootCount; i++) {
            const angle = (i / rootCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
            this.roots.push({
                angle,
                thickness: 6 + Math.random() * 8,
                seed: Math.random() * 100,
                phase: Math.random() * Math.PI * 2,
                rootletCount: 2 + Math.floor(Math.random() * 2),
            });
        }
    }

    updateAudio(ad) {
        this.audio.bass = ad.bass || 0;
        this.audio.mid = ad.mid || 0;
        this.audio.treble = ad.treble || 0;
        this.audio.rms = ad.rms || 0;
        this.audio.strength = ad.strength || 0;
    }

    onBeat(s) {
        this.beatPulse = s;
    }
}

window.VJamFX.presets['root-tunnel'] = RootTunnelPreset;
})();
