(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ForestCanopyPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.windGust = 0;
        this.sunFlare = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            const RES = 3;
            let branchGfx, lightGfx;
            const branches = [];
            const leafClusters = [];
            const fallingLeaves = [];
            const motes = [];
            const lightSpots = [];
            let canopyBuilt = false;

            // --- Branch generation (recursive L-system inspired) ---
            function generateBranch(x, y, angle, length, depth, maxDepth, side) {
                if (depth > maxDepth || length < 4) return;
                const endX = x + Math.cos(angle) * length;
                const endY = y + Math.sin(angle) * length;
                branches.push({
                    x1: x, y1: y, x2: endX, y2: endY,
                    depth, thickness: Math.max(1, (maxDepth - depth) * 2.5),
                    side,
                });
                // Also place leaf clusters at branch tips and joints
                if (depth >= maxDepth - 2) {
                    const count = 2 + Math.floor(Math.random() * 3);
                    for (let i = 0; i < count; i++) {
                        leafClusters.push({
                            x: endX + (Math.random() - 0.5) * 30,
                            y: endY + (Math.random() - 0.5) * 20,
                            size: 12 + Math.random() * 22,
                            hue: 90 + Math.random() * 60,   // green range
                            sat: 45 + Math.random() * 35,
                            bri: 25 + Math.random() * 30,
                            noiseOff: Math.random() * 100,
                            swayPhase: Math.random() * p.TWO_PI,
                            swayAmp: 1.5 + Math.random() * 3,
                            leafCount: 3 + Math.floor(Math.random() * 4),
                            depth: depth,
                        });
                    }
                }
                // Branching
                const spread = 0.3 + Math.random() * 0.25;
                const shrink = 0.62 + Math.random() * 0.12;
                generateBranch(endX, endY, angle - spread, length * shrink, depth + 1, maxDepth, side);
                generateBranch(endX, endY, angle + spread, length * shrink, depth + 1, maxDepth, side);
                // Occasional third branch for fullness
                if (Math.random() < 0.3) {
                    generateBranch(endX, endY, angle + (Math.random() - 0.5) * 0.5, length * shrink * 0.8, depth + 1, maxDepth, side);
                }
            }

            function buildCanopy() {
                branches.length = 0;
                leafClusters.length = 0;
                lightSpots.length = 0;

                // Main trunks entering from edges and corners
                const trunks = [
                    // Left edge trunks
                    { x: -10, y: p.height * 0.8, angle: -0.9, len: p.height * 0.35, maxD: 5 },
                    { x: -10, y: p.height * 0.4, angle: -0.5, len: p.height * 0.28, maxD: 4 },
                    // Right edge trunks
                    { x: p.width + 10, y: p.height * 0.75, angle: Math.PI + 0.8, len: p.height * 0.35, maxD: 5 },
                    { x: p.width + 10, y: p.height * 0.35, angle: Math.PI + 0.5, len: p.height * 0.28, maxD: 4 },
                    // Bottom edge trunks (looking up = trunks from below)
                    { x: p.width * 0.2, y: p.height + 10, angle: -Math.PI / 2 - 0.15, len: p.height * 0.55, maxD: 6 },
                    { x: p.width * 0.5, y: p.height + 10, angle: -Math.PI / 2, len: p.height * 0.6, maxD: 6 },
                    { x: p.width * 0.8, y: p.height + 10, angle: -Math.PI / 2 + 0.15, len: p.height * 0.55, maxD: 6 },
                    // Corner trunks
                    { x: -10, y: p.height + 10, angle: -0.75, len: p.height * 0.45, maxD: 5 },
                    { x: p.width + 10, y: p.height + 10, angle: Math.PI + 0.75, len: p.height * 0.45, maxD: 5 },
                ];

                trunks.forEach((t, i) => {
                    generateBranch(t.x, t.y, t.angle, t.len, 0, t.maxD, i);
                });

                // Extra leaf clusters in upper canopy region for density
                for (let i = 0; i < 40; i++) {
                    leafClusters.push({
                        x: Math.random() * p.width,
                        y: Math.random() * p.height * 0.45,
                        size: 15 + Math.random() * 25,
                        hue: 85 + Math.random() * 65,
                        sat: 40 + Math.random() * 40,
                        bri: 20 + Math.random() * 25,
                        noiseOff: Math.random() * 100,
                        swayPhase: Math.random() * p.TWO_PI,
                        swayAmp: 2 + Math.random() * 3,
                        leafCount: 4 + Math.floor(Math.random() * 4),
                        depth: 3 + Math.floor(Math.random() * 3),
                    });
                }

                // Light spots (gaps in canopy where sky shows through)
                for (let i = 0; i < 18; i++) {
                    lightSpots.push({
                        x: Math.random() * p.width,
                        y: Math.random() * p.height * 0.5,
                        size: 20 + Math.random() * 60,
                        noiseOff: Math.random() * 200,
                        hue: 40 + Math.random() * 30,   // warm gold-green
                        flickerSpeed: 0.5 + Math.random() * 1,
                        intensity: 0.5 + Math.random() * 0.5,
                    });
                }

                canopyBuilt = true;
            }

            // Draw static branches to offscreen buffer
            function renderBranchBuffer() {
                const gw = Math.ceil(p.width / RES);
                const gh = Math.ceil(p.height / RES);
                branchGfx = p.createGraphics(gw, gh);
                branchGfx.colorMode(branchGfx.HSB, 360, 100, 100, 100);
                branchGfx.background(0, 0);

                for (const b of branches) {
                    const darkFactor = 1 - b.depth * 0.1;
                    const bri = 12 * darkFactor;
                    const sat = 25 + b.depth * 5;
                    branchGfx.stroke(30, sat, bri, 90);
                    branchGfx.strokeWeight(Math.max(0.5, b.thickness / RES));
                    branchGfx.line(b.x1 / RES, b.y1 / RES, b.x2 / RES, b.y2 / RES);
                }
                branchGfx.noStroke();
            }

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.noStroke();
                buildCanopy();
                renderBranchBuffer();
            };

            p.draw = () => {
                p.background(0);
                if (!canopyBuilt) return;

                const speed = preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const rms = preset.audio.rms;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.88;
                preset.windGust *= 0.93;
                preset.sunFlare *= 0.9;
                preset.sunFlare += pulse * 0.5;

                const t = p.frameCount * 0.006 * speed;
                const wind = Math.sin(t * 0.7) * 0.5 + preset.windGust;

                // ========================================
                // 1. SKY THROUGH CANOPY (subtle deep blue/teal at top center)
                // ========================================
                const skyCx = p.width * 0.5 + Math.sin(t * 0.2) * 40;
                const skyCy = p.height * 0.15;
                const skyR = p.width * 0.35 + bass * 30;
                for (let ring = 4; ring >= 0; ring--) {
                    const frac = ring / 4;
                    const r = skyR * (0.3 + frac * 0.7);
                    const bri = 18 - ring * 3 + rms * 8;
                    p.fill(200, 40 - ring * 5, bri, 15 + ring * 2);
                    p.ellipse(skyCx, skyCy, r * 2, r * 1.4);
                }

                // ========================================
                // 2. DAPPLED LIGHT (komorebi) — animated light spots
                // ========================================
                for (const spot of lightSpots) {
                    const sx = spot.x + Math.sin(t * spot.flickerSpeed + spot.noiseOff) * 15 + wind * 8;
                    const sy = spot.y + Math.cos(t * spot.flickerSpeed * 0.7 + spot.noiseOff) * 8;
                    const flicker = 0.5 + 0.5 * Math.sin(t * spot.flickerSpeed * 2 + spot.noiseOff);
                    const intensity = spot.intensity * flicker * (0.7 + mid * 0.5 + preset.sunFlare * 0.6);
                    const sz = spot.size * (0.8 + intensity * 0.4 + bass * 0.2);

                    // Outer warm glow
                    p.fill(spot.hue, 30, 50, intensity * 12);
                    p.ellipse(sx, sy, sz * 2.5, sz * 1.8);
                    // Mid glow
                    p.fill(spot.hue - 5, 20, 65, intensity * 18);
                    p.ellipse(sx, sy, sz * 1.4, sz);
                    // Bright center
                    p.fill(spot.hue - 10, 12, 80, intensity * 22);
                    p.ellipse(sx, sy, sz * 0.5, sz * 0.35);
                }

                // ========================================
                // 3. GOD RAYS — volumetric light shafts from canopy gaps
                // ========================================
                const rayCount = 5;
                for (let i = 0; i < rayCount; i++) {
                    const rayX = (i + 0.5) * (p.width / rayCount) + Math.sin(t * 0.4 + i * 2.3) * 40;
                    const rayW = 15 + Math.sin(t * 0.3 + i * 1.7) * 8 + bass * 12;
                    const rayAlpha = (4 + mid * 8 + preset.sunFlare * 14) *
                        (0.5 + 0.5 * Math.sin(t * 0.5 + i * 1.1));
                    const rayLen = p.height * (0.5 + 0.2 * Math.sin(t * 0.2 + i));
                    const hue = 45 + Math.sin(t * 0.15 + i) * 10;

                    // Draw as fading trapezoid segments
                    const segs = 8;
                    for (let s = 0; s < segs; s++) {
                        const y0 = (s / segs) * rayLen;
                        const y1 = ((s + 1) / segs) * rayLen;
                        const w0 = rayW * (0.3 + (s / segs) * 2);
                        const w1 = rayW * (0.3 + ((s + 1) / segs) * 2);
                        const fade = 1 - (s / segs) * 0.8;
                        const a = rayAlpha * fade;

                        p.fill(hue, 18, 60, a);
                        p.quad(
                            rayX - w0, y0,
                            rayX + w0, y0,
                            rayX + w1 + wind * s * 2, y1,
                            rayX - w1 + wind * s * 2, y1
                        );
                    }

                    // Ray source glow
                    p.fill(hue, 12, 75, rayAlpha * 1.2);
                    p.ellipse(rayX, 0, rayW * 2, rayW * 0.6);
                }

                // ========================================
                // 4. BRANCH STRUCTURE (from offscreen buffer)
                // ========================================
                if (branchGfx) {
                    // Slight sway on branches via offset
                    const bx = wind * 3;
                    const by = Math.sin(t * 0.3) * 2;
                    p.image(branchGfx, bx, by, p.width, p.height);
                }

                // ========================================
                // 5. LEAF CLUSTERS — organic swaying masses
                // ========================================
                p.noStroke();
                for (const cl of leafClusters) {
                    const swayX = Math.sin(t * cl.swayAmp * 0.5 + cl.swayPhase) * (3 + wind * 5);
                    const swayY = Math.cos(t * cl.swayAmp * 0.3 + cl.noiseOff) * 2;
                    const cx = cl.x + swayX;
                    const cy = cl.y + swayY;

                    // Audio-modulated brightness
                    const brightBoost = mid * 8 + preset.sunFlare * 5;
                    const baseBri = cl.bri + brightBoost;

                    // Draw cluster as overlapping leaf shapes
                    for (let j = 0; j < cl.leafCount; j++) {
                        const angle = (j / cl.leafCount) * p.TWO_PI + Math.sin(t * 0.4 + cl.noiseOff + j) * 0.3;
                        const dist = cl.size * 0.3 + Math.sin(t * 0.6 + j * 2) * 3;
                        const lx = cx + Math.cos(angle) * dist;
                        const ly = cy + Math.sin(angle) * dist * 0.6;
                        const lSize = cl.size * (0.5 + 0.3 * Math.sin(t * 0.3 + j));
                        const leafHue = cl.hue + Math.sin(t * 0.2 + j) * 10;
                        const alpha = 35 + cl.depth * 5 + rms * 15;

                        p.push();
                        p.translate(lx, ly);
                        p.rotate(angle + Math.sin(t * 0.5 + cl.swayPhase + j) * 0.2);

                        // Leaf body
                        p.fill(leafHue, cl.sat, baseBri, alpha);
                        p.beginShape();
                        p.vertex(0, -lSize * 0.45);
                        p.bezierVertex(lSize * 0.3, -lSize * 0.2, lSize * 0.3, lSize * 0.2, 0, lSize * 0.45);
                        p.bezierVertex(-lSize * 0.3, lSize * 0.2, -lSize * 0.3, -lSize * 0.2, 0, -lSize * 0.45);
                        p.endShape(p.CLOSE);

                        // Highlight on some leaves (catching light)
                        if (j % 2 === 0) {
                            p.fill(leafHue - 15, cl.sat * 0.5, baseBri + 15, alpha * 0.4);
                            p.ellipse(0, -lSize * 0.1, lSize * 0.3, lSize * 0.2);
                        }
                        p.pop();
                    }
                }

                // ========================================
                // 6. FOREGROUND DARK SILHOUETTE LEAVES (depth)
                // ========================================
                for (let i = 0; i < 12; i++) {
                    const fx = ((i * 137.5 + 50) % p.width);
                    const fy = ((i * 89.3 + 20) % (p.height * 0.3));
                    const fSize = 30 + (i % 5) * 10;
                    const fSway = Math.sin(t * (0.8 + i * 0.1) + i * 3) * 5 + wind * 8;

                    p.fill(120 + i * 5, 40, 6, 60);
                    p.push();
                    p.translate(fx + fSway, fy + Math.cos(t * 0.4 + i) * 3);
                    p.rotate(Math.sin(t * 0.3 + i * 2) * 0.15);
                    p.beginShape();
                    p.vertex(0, -fSize * 0.5);
                    p.bezierVertex(fSize * 0.4, -fSize * 0.2, fSize * 0.35, fSize * 0.3, 0, fSize * 0.5);
                    p.bezierVertex(-fSize * 0.35, fSize * 0.3, -fSize * 0.4, -fSize * 0.2, 0, -fSize * 0.5);
                    p.endShape(p.CLOSE);
                    p.pop();
                }

                // ========================================
                // 7. FLOATING DUST MOTES in light beams
                // ========================================
                if (p.frameCount % 2 === 0 && motes.length < 80) {
                    motes.push({
                        x: Math.random() * p.width,
                        y: Math.random() * p.height * 0.6,
                        vx: (Math.random() - 0.5) * 0.3 + wind * 0.2,
                        vy: -0.1 - Math.random() * 0.2,
                        size: 1 + Math.random() * 2,
                        life: 1,
                        hue: 35 + Math.random() * 30,
                        drift: Math.random() * p.TWO_PI,
                    });
                }

                for (let i = motes.length - 1; i >= 0; i--) {
                    const m = motes[i];
                    m.x += m.vx + Math.sin(t * 2 + m.drift) * 0.3 + wind * 0.5;
                    m.y += m.vy;
                    m.life -= 0.006;
                    if (m.life <= 0 || m.y < -10 || m.x < -10 || m.x > p.width + 10) {
                        motes.splice(i, 1);
                        continue;
                    }

                    const mAlpha = m.life * (15 + treble * 20 + preset.sunFlare * 10);
                    // Outer glow
                    p.fill(m.hue, 15, 80, mAlpha * 0.25);
                    p.ellipse(m.x, m.y, m.size * 5, m.size * 5);
                    // Core
                    p.fill(m.hue, 10, 90, mAlpha);
                    p.ellipse(m.x, m.y, m.size, m.size);
                }

                // ========================================
                // 8. FALLING LEAVES (beat triggered + ambient)
                // ========================================
                // Ambient slow spawn
                if (p.frameCount % 60 === 0 && fallingLeaves.length < 15) {
                    spawnFallingLeaf(false);
                }
                // Beat burst
                if (pulse > 0.3) {
                    const count = Math.floor(pulse * 6);
                    for (let i = 0; i < count && fallingLeaves.length < 25; i++) {
                        spawnFallingLeaf(true);
                    }
                }

                for (let i = fallingLeaves.length - 1; i >= 0; i--) {
                    const lf = fallingLeaves[i];
                    lf.x += Math.sin(t * lf.tumbleSpeed + lf.phase) * lf.tumbleAmp + wind * 2;
                    lf.y += lf.fallSpeed * speed;
                    lf.rot += lf.rotSpeed;
                    lf.life -= 0.003;

                    if (lf.life <= 0 || lf.y > p.height + 20) {
                        fallingLeaves.splice(i, 1);
                        continue;
                    }

                    const alpha = Math.min(lf.life * 100, 50);
                    p.push();
                    p.translate(lf.x, lf.y);
                    p.rotate(lf.rot);
                    // Leaf shape
                    p.fill(lf.hue, lf.sat, lf.bri, alpha);
                    p.beginShape();
                    p.vertex(0, -lf.size * 0.5);
                    p.bezierVertex(lf.size * 0.35, -lf.size * 0.15, lf.size * 0.3, lf.size * 0.25, 0, lf.size * 0.5);
                    p.bezierVertex(-lf.size * 0.3, lf.size * 0.25, -lf.size * 0.35, -lf.size * 0.15, 0, -lf.size * 0.5);
                    p.endShape(p.CLOSE);
                    // Vein
                    p.stroke(lf.hue - 10, lf.sat * 0.6, lf.bri + 10, alpha * 0.5);
                    p.strokeWeight(0.5);
                    p.line(0, -lf.size * 0.35, 0, lf.size * 0.35);
                    p.noStroke();
                    p.pop();
                }

                // ========================================
                // 9. BEAT FLASH — bright sunburst through canopy
                // ========================================
                if (preset.sunFlare > 0.05) {
                    const flareAlpha = preset.sunFlare * 15;
                    // Central bright burst
                    p.fill(48, 15, 85, flareAlpha);
                    p.ellipse(p.width * 0.5, p.height * 0.1, p.width * 0.5, p.height * 0.25);
                    // Wider warm wash
                    p.fill(50, 10, 70, flareAlpha * 0.4);
                    p.ellipse(p.width * 0.5, p.height * 0.15, p.width * 0.9, p.height * 0.4);
                }

                // ========================================
                // 10. SUBTLE EDGE DARKENING (frame the canopy opening)
                // ========================================
                const edgeAlpha = 25;
                // Top and bottom dark bars
                for (let i = 0; i < 4; i++) {
                    const a = edgeAlpha * (1 - i * 0.25);
                    p.fill(130, 30, 3, a);
                    p.rect(0, p.height - i * 20 - 20, p.width, 25);
                    p.rect(0, i * 15, p.width, 18);
                }
                // Side darkening
                for (let i = 0; i < 3; i++) {
                    const a = edgeAlpha * (1 - i * 0.3);
                    p.fill(130, 30, 3, a);
                    p.rect(0, 0, 15 + i * 10, p.height);
                    p.rect(p.width - 15 - i * 10, 0, 15 + i * 10, p.height);
                }
            };

            function spawnFallingLeaf(burst) {
                fallingLeaves.push({
                    x: Math.random() * p.width,
                    y: burst ? Math.random() * p.height * 0.3 : -10,
                    size: 6 + Math.random() * 10,
                    hue: 80 + Math.random() * 50, // green to yellow-green
                    sat: 50 + Math.random() * 30,
                    bri: 30 + Math.random() * 25,
                    fallSpeed: 0.3 + Math.random() * 0.7,
                    tumbleSpeed: 1 + Math.random() * 2,
                    tumbleAmp: 1 + Math.random() * 2,
                    phase: Math.random() * p.TWO_PI,
                    rot: Math.random() * p.TWO_PI,
                    rotSpeed: (Math.random() - 0.5) * 0.04,
                    life: 1,
                });
            }

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                buildCanopy();
                renderBranchBuffer();
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
        if (strength > 0.3) {
            this.windGust = (Math.random() - 0.3) * strength * 3;
        }
        if (strength > 0.5) {
            this.sunFlare = Math.min(this.sunFlare + strength * 0.4, 1);
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['forest-canopy'] = ForestCanopyPreset;
})();
