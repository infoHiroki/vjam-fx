(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ElectricCityPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.buildings = [];
        this.signs = [];
        this.cars = [];
        this.sparks = [];
    }

    setup(container) {
        this.destroy();
        this.buildings = [];
        this.signs = [];
        this.cars = [];
        this.sparks = [];
        const preset = this;

        this.p5 = new p5((p) => {
            const NEON_COLORS = [
                [0, 255, 255],
                [255, 0, 255],
                [0, 255, 100],
                [255, 255, 0],
                [255, 60, 120],
                [100, 180, 255],
            ];

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.RGB, 255);
                preset._generateCity(p, NEON_COLORS);
            };

            p.draw = () => {
                p.background(0);

                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                preset.beatPulse *= 0.88;
                const bp = preset.beatPulse;
                const fc = p.frameCount;

                // === Skyline gradient (subtle dark blue to black) ===
                p.noStroke();
                for (let i = 0; i < 6; i++) {
                    const t = i / 6;
                    p.fill(2 + t * 8, 2 + t * 4, 10 + t * 18, 60);
                    p.rect(0, t * p.height * 0.35, p.width, p.height * 0.06 + 2);
                }

                // === Draw buildings back to front ===
                for (const b of preset.buildings) {
                    const cr = b.color[0];
                    const cg = b.color[1];
                    const cb = b.color[2];
                    const glowIntensity = 0.6 + bp * 0.4 + bass * 0.3;

                    // Building body
                    p.noStroke();
                    p.fill(6, 6, 14);
                    p.rect(b.x, b.y, b.w, b.h);

                    // Vertical accent stripes on building
                    const stripeCount = Math.floor(b.w / 15);
                    for (let s = 0; s < stripeCount; s++) {
                        const sx = b.x + (s + 1) * b.w / (stripeCount + 1);
                        const stripeAlpha = 25 + bp * 30 + Math.sin(fc * 0.02 + s) * 10;
                        p.stroke(cr, cg, cb, stripeAlpha * glowIntensity);
                        p.strokeWeight(1);
                        p.line(sx, b.y, sx, b.y + b.h);
                    }

                    // Neon outline - outer glow
                    p.noFill();
                    const outerAlpha = (40 + bp * 80) * glowIntensity;
                    p.stroke(cr, cg, cb, outerAlpha * 0.25);
                    p.strokeWeight(6);
                    p.rect(b.x, b.y, b.w, b.h);

                    // Neon outline - inner
                    p.stroke(cr, cg, cb, outerAlpha * 0.8);
                    p.strokeWeight(1.5);
                    p.rect(b.x, b.y, b.w, b.h);

                    // Horizontal floor lines
                    const floorH = 18 + b.floorOffset;
                    p.stroke(cr, cg, cb, 15 + bp * 20);
                    p.strokeWeight(0.5);
                    for (let fy = b.y + floorH; fy < b.y + b.h; fy += floorH) {
                        p.line(b.x + 2, fy, b.x + b.w - 2, fy);
                    }

                    // Windows
                    p.noStroke();
                    const winW = 3;
                    const winH = 4;
                    const gapX = 8;
                    const gapY = 10;
                    for (let wy = b.y + 6; wy < b.y + b.h - gapY; wy += gapY) {
                        for (let wx = b.x + 5; wx < b.x + b.w - gapX; wx += gapX) {
                            const pIdx = (Math.floor((wy - b.y) / gapY) * 12 + Math.floor((wx - b.x) / gapX)) % b.windowPattern.length;
                            const isOn = b.windowPattern[pIdx];
                            if (!isOn) continue;

                            // Window color varies: warm yellow/white or building neon
                            const useNeon = pIdx % 5 === 0;
                            const flicker = Math.sin(fc * 0.04 + wx * 0.15 + wy * 0.1) * 0.15 + 0.85;
                            const winAlpha = (130 + bp * 100) * flicker;

                            if (useNeon) {
                                p.fill(cr, cg, cb, Math.min(winAlpha, 220));
                            } else {
                                const warmth = 180 + Math.sin(wx * 0.3) * 40;
                                p.fill(warmth, warmth * 0.85, warmth * 0.5, Math.min(winAlpha * 0.7, 200));
                            }
                            p.rect(wx, wy, winW, winH);
                        }
                    }

                    // Rooftop detail
                    if (b.hasRooftop) {
                        p.fill(cr, cg, cb, 30 + bp * 50);
                        p.rect(b.x + b.w * 0.3, b.y - 6, b.w * 0.4, 6);
                        // Antenna blink
                        const blink = Math.sin(fc * 0.08 + b.x) > 0.5;
                        if (blink) {
                            p.fill(255, 40, 40, 180 + bp * 70);
                            p.ellipse(b.x + b.w * 0.5, b.y - 8, 3, 3);
                        }
                    }
                }

                // === Neon signs ===
                for (const s of preset.signs) {
                    // Flicker logic
                    const flickerChance = s.flickerRate || 0.04;
                    if (Math.random() < flickerChance) s.flickerState = 1 - s.flickerState;
                    if (!s.flickerState) continue;

                    const cr = s.color[0];
                    const cg = s.color[1];
                    const cb = s.color[2];
                    const signAlpha = 160 + bp * 80;
                    const breathe = Math.sin(fc * 0.06 + s.x * 0.1) * 0.15 + 0.85;

                    // Large glow halo
                    p.noStroke();
                    p.fill(cr, cg, cb, 18 * breathe);
                    p.ellipse(s.x, s.y, s.size * 4, s.size * 2.5);

                    // Sign body
                    p.fill(cr, cg, cb, signAlpha * breathe);
                    if (s.shape === 0) {
                        // Rectangle sign
                        p.rect(s.x - s.size * 0.5, s.y - 4, s.size, 8, 1);
                    } else if (s.shape === 1) {
                        // Vertical sign
                        p.rect(s.x - 4, s.y - s.size * 0.3, 8, s.size * 0.6, 1);
                    } else {
                        // Circle sign
                        p.ellipse(s.x, s.y, s.size * 0.6, s.size * 0.6);
                    }

                    // White hot center
                    p.fill(255, 255, 255, signAlpha * 0.4 * breathe);
                    p.rect(s.x - s.size * 0.3, s.y - 1, s.size * 0.6, 2);
                }

                // === Street / ground level ===
                const streetY = p.height * 0.92;
                // Street base
                p.noStroke();
                p.fill(8, 8, 12);
                p.rect(0, streetY, p.width, p.height - streetY);

                // Road lane markings
                p.stroke(60, 60, 50, 80);
                p.strokeWeight(2);
                const laneY = streetY + (p.height - streetY) * 0.4;
                for (let lx = (fc * 2) % 40 - 40; lx < p.width; lx += 40) {
                    p.line(lx, laneY, lx + 18, laneY);
                }

                // === Car lights ===
                for (let i = preset.cars.length - 1; i >= 0; i--) {
                    const car = preset.cars[i];
                    car.x += car.speed;

                    // Remove offscreen cars
                    if (car.speed > 0 && car.x > p.width + 30) {
                        preset.cars.splice(i, 1);
                        continue;
                    }
                    if (car.speed < 0 && car.x < -30) {
                        preset.cars.splice(i, 1);
                        continue;
                    }

                    const cy = streetY + car.lane;

                    if (car.speed > 0) {
                        // Tail lights (red) going right
                        p.noStroke();
                        p.fill(255, 20, 20, 40);
                        p.ellipse(car.x, cy, 16, 8);
                        p.fill(255, 30, 20, 180);
                        p.ellipse(car.x, cy - 2, 4, 3);
                        p.ellipse(car.x, cy + 2, 4, 3);
                        // Light trail
                        p.stroke(255, 20, 20, 50);
                        p.strokeWeight(1.5);
                        p.line(car.x - 20, cy, car.x - 4, cy);
                    } else {
                        // Headlights (white/yellow) going left
                        p.noStroke();
                        p.fill(255, 240, 180, 35);
                        p.ellipse(car.x, cy, 22, 10);
                        p.fill(255, 250, 200, 200);
                        p.ellipse(car.x, cy - 2, 4, 3);
                        p.ellipse(car.x, cy + 2, 4, 3);
                        // Light beam
                        p.stroke(255, 240, 180, 30);
                        p.strokeWeight(1.5);
                        p.line(car.x + 4, cy, car.x + 25, cy);
                    }
                }

                // Spawn cars
                if (fc % 8 === 0) {
                    const goRight = Math.random() > 0.5;
                    preset.cars.push({
                        x: goRight ? -20 : p.width + 20,
                        lane: 6 + Math.random() * (p.height - streetY - 14),
                        speed: goRight ? (1.5 + Math.random() * 2.5) : -(1.5 + Math.random() * 2.5),
                    });
                }
                // Limit cars
                if (preset.cars.length > 30) preset.cars.splice(0, 5);

                // === Wet ground reflections ===
                const reflY = streetY + 2;
                p.noStroke();
                for (const b of preset.buildings) {
                    const cr = b.color[0];
                    const cg = b.color[1];
                    const cb = b.color[2];
                    const reflAlpha = 8 + bp * 12;
                    // Reflection stripe
                    const reflH = Math.min(20, p.height - reflY);
                    for (let ry = 0; ry < reflH; ry += 3) {
                        const fade = 1 - ry / reflH;
                        p.fill(cr, cg, cb, reflAlpha * fade);
                        const rx = b.x + Math.sin(fc * 0.03 + ry * 0.2) * 2;
                        p.rect(rx, reflY + ry, b.w, 2);
                    }
                }

                // Horizontal neon reflection line
                p.stroke(0, 220, 255, 25 + bp * 50);
                p.strokeWeight(1.5);
                p.line(0, streetY, p.width, streetY);

                // === Sparks on beat ===
                for (let i = preset.sparks.length - 1; i >= 0; i--) {
                    const sp = preset.sparks[i];
                    sp.x += sp.vx;
                    sp.y += sp.vy;
                    sp.vy += 0.12; // gravity
                    sp.life -= 0.025;

                    if (sp.life <= 0) {
                        preset.sparks.splice(i, 1);
                        continue;
                    }

                    const alpha = sp.life * 255;
                    p.noStroke();
                    p.fill(sp.cr, sp.cg, sp.cb, alpha);
                    p.ellipse(sp.x, sp.y, 2.5 * sp.life, 2.5 * sp.life);
                    // Spark trail
                    p.stroke(sp.cr, sp.cg, sp.cb, alpha * 0.4);
                    p.strokeWeight(0.8);
                    p.line(sp.x, sp.y, sp.x - sp.vx * 2, sp.y - sp.vy * 2);
                }
                // Limit sparks
                if (preset.sparks.length > 120) preset.sparks.splice(0, 30);

                // === Atmospheric scan lines (subtle) ===
                p.stroke(255, 255, 255, 5 + treble * 8);
                p.strokeWeight(0.5);
                const scanY = (fc * 1.5) % p.height;
                p.line(0, scanY, p.width, scanY);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                preset._generateCity(p, NEON_COLORS);
            };
        }, container);
    }

    _generateCity(p, colors) {
        this.buildings = [];
        this.signs = [];

        const streetY = p.height * 0.92;

        // Back layer (distant, short, many)
        const backCount = 10 + Math.floor(p.width / 60);
        for (let i = 0; i < backCount; i++) {
            const w = 20 + Math.random() * 35;
            const h = 40 + Math.random() * (streetY * 0.3);
            const x = (i / backCount) * (p.width + 40) - 20 + (Math.random() - 0.5) * 15;
            const pattern = [];
            for (let j = 0; j < 60; j++) pattern.push(Math.random() > 0.5);
            this.buildings.push({
                x, y: streetY - h, w, h,
                color: colors[Math.floor(Math.random() * colors.length)],
                windowPattern: pattern,
                hasRooftop: false,
                floorOffset: Math.floor(Math.random() * 6),
            });
        }

        // Mid layer
        const midCount = 8 + Math.floor(p.width / 90);
        for (let i = 0; i < midCount; i++) {
            const w = 35 + Math.random() * 55;
            const h = 100 + Math.random() * (streetY * 0.45);
            const x = (i / midCount) * (p.width + 30) - 15 + (Math.random() - 0.5) * 25;
            const pattern = [];
            for (let j = 0; j < 60; j++) pattern.push(Math.random() > 0.35);
            this.buildings.push({
                x, y: streetY - h, w, h,
                color: colors[Math.floor(Math.random() * colors.length)],
                windowPattern: pattern,
                hasRooftop: Math.random() < 0.4,
                floorOffset: Math.floor(Math.random() * 6),
            });

            // Neon signs on mid buildings
            if (Math.random() < 0.5) {
                this.signs.push({
                    x: x + w * (0.2 + Math.random() * 0.6),
                    y: streetY - h + 15 + Math.random() * Math.min(40, h * 0.3),
                    size: 14 + Math.random() * 22,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    flickerState: 1,
                    flickerRate: 0.02 + Math.random() * 0.04,
                    shape: Math.floor(Math.random() * 3),
                });
            }
        }

        // Front layer (big towers)
        const frontCount = 5 + Math.floor(p.width / 150);
        for (let i = 0; i < frontCount; i++) {
            const w = 50 + Math.random() * 80;
            const h = 150 + Math.random() * (streetY * 0.55);
            const x = (i / frontCount) * (p.width + 50) - 25 + (Math.random() - 0.5) * 40;
            const pattern = [];
            for (let j = 0; j < 60; j++) pattern.push(Math.random() > 0.3);
            this.buildings.push({
                x, y: streetY - h, w, h,
                color: colors[Math.floor(Math.random() * colors.length)],
                windowPattern: pattern,
                hasRooftop: Math.random() < 0.6,
                floorOffset: Math.floor(Math.random() * 6),
            });

            // More signs on front buildings
            if (Math.random() < 0.6) {
                this.signs.push({
                    x: x + w * (0.2 + Math.random() * 0.6),
                    y: streetY - h + 20 + Math.random() * Math.min(60, h * 0.25),
                    size: 18 + Math.random() * 28,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    flickerState: 1,
                    flickerRate: 0.02 + Math.random() * 0.05,
                    shape: Math.floor(Math.random() * 3),
                });
            }
            // Second sign on some tall buildings
            if (Math.random() < 0.3) {
                this.signs.push({
                    x: x + w * (0.3 + Math.random() * 0.4),
                    y: streetY - h * 0.5 + Math.random() * 30,
                    size: 12 + Math.random() * 16,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    flickerState: 1,
                    flickerRate: 0.03 + Math.random() * 0.05,
                    shape: Math.floor(Math.random() * 3),
                });
            }
        }

        // Sort by height ascending (shortest first = back)
        this.buildings.sort((a, b) => a.h - b.h);
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        // Shuffle some window states
        for (const b of this.buildings) {
            if (Math.random() < 0.35) {
                const idx = Math.floor(Math.random() * b.windowPattern.length);
                b.windowPattern[idx] = !b.windowPattern[idx];
            }
        }

        // Spawn sparks from random sign or building top
        if (this.p5 && strength > 0.3) {
            const p = this.p5;
            const sparkCount = Math.floor(strength * 15);
            const sourceX = Math.random() * p.width;
            const sourceY = Math.random() * p.height * 0.5;
            const color = [
                [0, 255, 255], [255, 0, 255], [255, 255, 0], [255, 180, 50]
            ][Math.floor(Math.random() * 4)];

            for (let i = 0; i < sparkCount; i++) {
                this.sparks.push({
                    x: sourceX + (Math.random() - 0.5) * 20,
                    y: sourceY + (Math.random() - 0.5) * 10,
                    vx: (Math.random() - 0.5) * 5,
                    vy: -Math.random() * 4 - 1,
                    life: 0.6 + Math.random() * 0.4,
                    cr: color[0], cg: color[1], cb: color[2],
                });
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['electric-city'] = ElectricCityPreset;
})();
