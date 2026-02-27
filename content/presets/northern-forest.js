(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class NorthernForestPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.treeLayers = [];
        this.fireflies = [];
        this.moonBeams = [];
        this.auroraPhase = 0;
        this.mistPhase = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            let gAurora, gMist;

            p.setup = () => {
                const W = container.clientWidth;
                const H = container.clientHeight;
                p.createCanvas(W, H);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);

                // Off-screen buffers (RES=4 → quarter resolution)
                const RES = 4;
                gAurora = p.createGraphics(Math.ceil(W / RES), Math.ceil(H / RES));
                gAurora.colorMode(gAurora.HSB, 360, 100, 100, 100);
                gMist = p.createGraphics(Math.ceil(W / RES), Math.ceil(H / RES));
                gMist.colorMode(gMist.HSB, 360, 100, 100, 100);

                preset._generateTrees(p);
                preset._initFireflies(p, 50);
                preset._initMoonBeams(p);
            };

            p.draw = () => {
                p.background(0);

                const speed = preset.params.speed;
                const t = p.frameCount * 0.008 * speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const rms = preset.audio.rms;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.88;

                const W = p.width;
                const H = p.height;
                const RES = 4;
                const gW = gAurora.width;
                const gH = gAurora.height;

                // === AURORA (off-screen) ===
                gAurora.clear();
                gAurora.noStroke();
                preset.auroraPhase += 0.003 * speed;

                const auroraBright = 1 + bass * 0.6 + pulse * 0.8;
                for (let band = 0; band < 5; band++) {
                    const bandY = gH * (0.05 + band * 0.06);
                    const hue = (130 + band * 25 + mid * 30) % 360;
                    const alpha = (6 + rms * 10 + pulse * 12) * auroraBright;
                    const thick = 12 + band * 4;

                    for (let x = 0; x < gW; x += 2) {
                        const n1 = p.noise(x * 0.008 + preset.auroraPhase + band * 7, band * 3.3, t * 0.3);
                        const n2 = p.noise(x * 0.015 + preset.auroraPhase * 1.3, band * 5.1, t * 0.15);
                        const y = bandY + (n1 * 0.7 + n2 * 0.3) * gH * 0.25 - gH * 0.08;
                        const curtainAlpha = alpha * (0.4 + n1 * 0.6);
                        const h = thick * (0.6 + n2 * 0.8 + pulse * 0.4);

                        // Vertical curtain stroke
                        gAurora.fill(hue, 50 + band * 5, 60 + n1 * 30, curtainAlpha);
                        gAurora.rect(x, y, 2, h);

                        // Bright core
                        if (n1 > 0.55) {
                            gAurora.fill(hue, 30, 90, curtainAlpha * 0.5);
                            gAurora.rect(x, y + h * 0.3, 2, h * 0.4);
                        }
                    }
                }

                p.push();
                p.blendMode(p.SCREEN);
                p.image(gAurora, 0, 0, W, H);
                p.pop();

                // === STARS ===
                p.noStroke();
                for (let i = 0; i < 100; i++) {
                    const sx = ((i * 137.508 + 31.7) % W);
                    const sy = ((i * 97.31 + 17.3) % (H * 0.45));
                    const twinkle = p.noise(i * 0.5, t * 0.4) * 0.7 + 0.3;
                    const sz = 1 + (i % 3) * 0.5;
                    const starBri = 55 + twinkle * 45;
                    p.fill(45 + (i % 40), 8, starBri, 30 + twinkle * 35);
                    p.ellipse(sx, sy, sz * twinkle, sz * twinkle);
                }

                // === MOON ===
                const moonX = W * 0.78;
                const moonY = H * 0.12;
                const moonR = Math.min(W, H) * 0.045;
                const moonGlow = 1 + pulse * 0.3 + treble * 0.2;

                // Outer glow layers
                p.noStroke();
                p.fill(50, 10, 50, 3 * moonGlow);
                p.ellipse(moonX, moonY, moonR * 10, moonR * 10);
                p.fill(50, 10, 60, 5 * moonGlow);
                p.ellipse(moonX, moonY, moonR * 6, moonR * 6);
                p.fill(50, 8, 80, 8 * moonGlow);
                p.ellipse(moonX, moonY, moonR * 3.5, moonR * 3.5);
                // Moon disc
                p.fill(48, 6, 95, 65);
                p.ellipse(moonX, moonY, moonR * 2, moonR * 2);
                // Bright center
                p.fill(50, 3, 100, 40);
                p.ellipse(moonX, moonY, moonR * 1.4, moonR * 1.4);

                // === MOON BEAMS through trees ===
                p.push();
                p.blendMode(p.SCREEN);
                p.noStroke();
                for (const beam of preset.moonBeams) {
                    const sway = Math.sin(t * 0.5 + beam.phase) * 8;
                    const bAlpha = (3 + treble * 4 + pulse * 5) * beam.alpha;
                    const bx = beam.x + sway;
                    // Tapered beam from moon
                    p.fill(50, 8, 70, bAlpha);
                    p.beginShape();
                    p.vertex(moonX - 2, moonY + moonR);
                    p.vertex(moonX + 2, moonY + moonR);
                    p.vertex(bx + beam.width, H);
                    p.vertex(bx - beam.width, H);
                    p.endShape(p.CLOSE);
                }
                p.pop();

                // === TREE LAYERS (back to front) with mist between ===
                const groundY = H * 0.92;

                for (let li = 0; li < preset.treeLayers.length; li++) {
                    const layer = preset.treeLayers[li];
                    const depth = layer.depth; // 0=far, 1=near

                    // Draw mist BETWEEN layers (after the first)
                    if (li > 0 && li < preset.treeLayers.length - 1) {
                        preset._drawMistBand(p, gMist, layer, t, li, bass, rms, pulse, W, H, RES);
                    }

                    // Tree color: dark silhouettes, slightly green-tinted for far layers
                    const hue = 150 + depth * 15;
                    const sat = 25 - depth * 15;
                    const bri = 3 + (1 - depth) * 4;
                    const alpha = 80 + depth * 15;

                    p.noStroke();

                    for (const tree of layer.trees) {
                        const tx = tree.x;
                        const treeBase = groundY - depth * H * 0.02;
                        const h = tree.height * (0.7 + depth * 0.6);
                        const w = tree.width * (0.5 + depth * 0.7);

                        // Trunk
                        p.fill(25, 20, bri * 0.6, alpha);
                        const trunkW = w * 0.12;
                        p.rect(tx - trunkW / 2, treeBase - h * 0.25, trunkW, h * 0.25);

                        // Pine tree: layered triangles (narrowing upward)
                        p.fill(hue, sat, bri, alpha);
                        const tiers = tree.tiers;
                        for (let ti = 0; ti < tiers; ti++) {
                            const frac = ti / tiers;
                            const tierBottom = treeBase - h * 0.15 - frac * h * 0.7;
                            const tierTop = tierBottom - h / tiers * 0.9;
                            const tierW = w * (1 - frac * 0.55) * (1 + (1 - frac) * 0.3);

                            p.triangle(
                                tx, tierTop,
                                tx - tierW / 2, tierBottom,
                                tx + tierW / 2, tierBottom
                            );
                        }

                        // Snow on branches (far trees only)
                        if (depth < 0.4 && tree.hasSnow) {
                            p.fill(200, 5, 60, 15);
                            for (let si = 0; si < 3; si++) {
                                const sf = (si + 1) / (tiers + 1);
                                const snowY = treeBase - h * 0.15 - sf * h * 0.7;
                                const snowW = w * (1 - sf * 0.5) * 0.5;
                                p.ellipse(tx, snowY, snowW, 3);
                            }
                        }
                    }
                }

                // Ground: dark forest floor
                p.noStroke();
                p.fill(140, 15, 3, 90);
                p.rect(0, groundY, W, H - groundY);
                // Ground mist
                for (let x = 0; x < W; x += 30) {
                    const n = p.noise(x * 0.005, t * 0.3);
                    const mAlpha = 5 + n * 6 + bass * 3;
                    p.fill(160, 15, 30, mAlpha);
                    p.ellipse(x + Math.sin(t + x * 0.01) * 10, groundY - 5, 60 + n * 40, 12 + n * 8);
                }

                // === FOREGROUND MIST ===
                preset.mistPhase += 0.002 * speed;
                gMist.clear();
                gMist.noStroke();
                const mistGW = gMist.width;
                const mistGH = gMist.height;
                for (let i = 0; i < 8; i++) {
                    const mx = (p.noise(i * 3.7, preset.mistPhase) * mistGW * 1.4) - mistGW * 0.2;
                    const my = mistGH * (0.5 + i * 0.05) + p.noise(i * 7.1, preset.mistPhase * 0.7) * mistGH * 0.15;
                    const mw = mistGW * (0.3 + p.noise(i * 5, preset.mistPhase * 0.5) * 0.3);
                    const mh = mistGH * 0.06;
                    const mAlpha = 4 + bass * 3 + pulse * 2;
                    gMist.fill(160, 15, 40, mAlpha);
                    gMist.ellipse(mx, my, mw, mh);
                }
                p.push();
                p.blendMode(p.SCREEN);
                p.image(gMist, 0, 0, W, H);
                p.pop();

                // === FIREFLIES / BIOLUMINESCENT PARTICLES ===
                p.push();
                p.blendMode(p.SCREEN);
                p.noStroke();
                for (const ff of preset.fireflies) {
                    ff.phase += ff.speed * speed;
                    ff.x += Math.sin(ff.phase * 0.7 + ff.drift) * 0.4;
                    ff.y += Math.cos(ff.phase * 0.5) * 0.3 - 0.1;

                    // Wrap around
                    if (ff.x < -20) ff.x = W + 20;
                    if (ff.x > W + 20) ff.x = -20;
                    if (ff.y < H * 0.2) ff.y = H * 0.85;

                    // Pulsing glow
                    const glow = (Math.sin(ff.phase * 2) * 0.5 + 0.5);
                    const ffAlpha = (8 + glow * 20 + treble * 10 + pulse * 15) * ff.brightness;
                    const ffSize = ff.size * (1 + glow * 0.5 + pulse * 0.5);

                    // Outer glow
                    p.fill(ff.hue, 40, 70, ffAlpha * 0.3);
                    p.ellipse(ff.x, ff.y, ffSize * 4, ffSize * 4);
                    // Core
                    p.fill(ff.hue, 25, 100, ffAlpha);
                    p.ellipse(ff.x, ff.y, ffSize, ffSize);
                }
                p.pop();

                // === BEAT FLASH: aurora brightening burst ===
                if (pulse > 0.2) {
                    p.push();
                    p.blendMode(p.SCREEN);
                    p.noStroke();
                    const flashAlpha = pulse * 6;
                    p.fill(140, 30, 50, flashAlpha);
                    p.rect(0, 0, W, H * 0.4);
                    p.pop();
                }
            };

            p.windowResized = () => {
                const W = container.clientWidth;
                const H = container.clientHeight;
                p.resizeCanvas(W, H);
                const RES = 4;
                gAurora.resizeCanvas(Math.ceil(W / RES), Math.ceil(H / RES));
                gMist.resizeCanvas(Math.ceil(W / RES), Math.ceil(H / RES));
                preset._generateTrees(p);
                preset._initMoonBeams(p);
            };
        }, container);
    }

    _generateTrees(p) {
        this.treeLayers = [];
        const layerCount = 5;

        for (let li = 0; li < layerCount; li++) {
            const depth = li / (layerCount - 1); // 0=far, 1=near
            const count = 6 + li * 5;
            const trees = [];

            for (let i = 0; i < count; i++) {
                const spacing = p.width / count;
                trees.push({
                    x: spacing * i + (Math.random() - 0.5) * spacing * 0.8,
                    height: 60 + depth * 100 + Math.random() * 50,
                    width: 18 + depth * 35 + Math.random() * 15,
                    tiers: 4 + Math.floor(Math.random() * 3),
                    hasSnow: Math.random() > 0.5,
                });
            }

            this.treeLayers.push({ trees, depth });
        }
    }

    _initFireflies(p, count) {
        this.fireflies = [];
        for (let i = 0; i < count; i++) {
            this.fireflies.push({
                x: Math.random() * p.width,
                y: p.height * (0.3 + Math.random() * 0.6),
                size: 2 + Math.random() * 3,
                phase: Math.random() * Math.PI * 2,
                speed: 0.01 + Math.random() * 0.02,
                drift: Math.random() * 10,
                hue: 80 + Math.random() * 80, // green to cyan
                brightness: 0.4 + Math.random() * 0.6,
            });
        }
    }

    _initMoonBeams(p) {
        this.moonBeams = [];
        for (let i = 0; i < 6; i++) {
            this.moonBeams.push({
                x: p.width * (0.15 + Math.random() * 0.7),
                width: 15 + Math.random() * 25,
                alpha: 0.3 + Math.random() * 0.7,
                phase: Math.random() * Math.PI * 2,
            });
        }
    }

    _drawMistBand(p, gMist, layer, t, li, bass, rms, pulse, W, H, RES) {
        const bandY = H * (0.45 + layer.depth * 0.35);
        p.push();
        p.blendMode(p.SCREEN);
        p.noStroke();
        for (let x = 0; x < W; x += 25) {
            const n = p.noise(x * 0.004, t * 0.2 + li * 5);
            const mAlpha = (3 + n * 5 + bass * 2 + pulse * 2) * (1 - layer.depth * 0.5);
            const my = bandY + Math.sin(t * 0.3 + x * 0.005) * 10;
            p.fill(160, 12, 35, mAlpha);
            p.ellipse(x, my, 50 + n * 30, 10 + n * 6);
        }
        p.pop();
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        // Spawn extra fireflies on strong beats
        if (strength > 0.5 && this.p5 && this.fireflies.length < 70) {
            const p = this.p5;
            for (let i = 0; i < 5; i++) {
                this.fireflies.push({
                    x: Math.random() * p.width,
                    y: p.height * (0.3 + Math.random() * 0.5),
                    size: 3 + Math.random() * 3,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.015 + Math.random() * 0.025,
                    drift: Math.random() * 10,
                    hue: 100 + Math.random() * 60,
                    brightness: 0.6 + Math.random() * 0.4,
                });
            }
        }
        // Cap fireflies
        while (this.fireflies.length > 70) {
            this.fireflies.shift();
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['northern-forest'] = NorthernForestPreset;
})();
