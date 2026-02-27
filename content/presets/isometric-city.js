(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class IsometricCityPreset extends BasePreset {
    constructor() {
        super();
        this.params = { cols: 10, rows: 10, cellSize: 42 };
        this.buildings = [];
        this.cars = [];
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.beatFlash = 0;
        this.time = 0;
        this.scanY = 0;
        this.lightningAlpha = 0;
        this.lightningX = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.noStroke();
                preset._initCity(p);
            };

            p.draw = () => {
                p.background(0);
                preset.time = p.frameCount * 0.015;

                const cx = p.width * 0.5;
                const cy = p.height * 0.28;
                const cell = preset.params.cellSize;
                const cols = preset.params.cols;
                const rows = preset.params.rows;

                // Isometric projection helpers
                const isoX = (gx, gy) => cx + (gx - gy) * cell * 0.5;
                const isoY = (gx, gy) => cy + (gx + gy) * cell * 0.25;

                // === SKY GRADIENT ===
                const skyPulse = preset.audio.rms * 0.4;
                for (let sy = 0; sy < 5; sy++) {
                    const frac = sy / 5;
                    const yy = frac * p.height * 0.35;
                    const hh = p.height * 0.35 / 5 + 1;
                    const r = 8 + frac * 15 + skyPulse * 20;
                    const g = 4 + frac * 8;
                    const b = 25 + frac * 30 + skyPulse * 30;
                    p.fill(r, g, b, 180);
                    p.rect(0, yy, p.width, hh);
                }

                // === GROUND PLANE with roads ===
                for (let gy = 0; gy < rows; gy++) {
                    for (let gx = 0; gx < cols; gx++) {
                        const bx = isoX(gx, gy);
                        const by = isoY(gx, gy);
                        const hw = cell * 0.5;
                        const hh = cell * 0.25;

                        const isRoadX = gx % 4 === 0;
                        const isRoadY = gy % 4 === 0;

                        if (isRoadX || isRoadY) {
                            // Asphalt
                            p.fill(18, 18, 28, 210);
                            p.quad(bx, by, bx + hw, by - hh, bx, by - hh * 2, bx - hw, by - hh);

                            // Animated lane markings
                            const scroll = (p.frameCount * 0.06 + gx * 0.3 + gy * 0.3) % 2;
                            if (scroll < 1) {
                                p.fill(255, 200, 50, 50 + preset.audio.mid * 40);
                                p.ellipse(bx, by - hh, 4, 2);
                            }

                            // Intersection glow
                            if (isRoadX && isRoadY) {
                                const intPulse = Math.sin(preset.time * 2 + gx) * 0.5 + 0.5;
                                p.fill(0, 255, 200, 15 + intPulse * 20 + preset.beatPulse * 30);
                                p.ellipse(bx, by - hh, hw * 1.4, hh * 1.4);
                            }
                        } else {
                            // Sidewalk / lot
                            p.fill(10, 6, 18, 190);
                            p.quad(bx, by, bx + hw, by - hh, bx, by - hh * 2, bx - hw, by - hh);
                        }
                    }
                }

                // === DRAW BUILDINGS back to front ===
                for (let gy = 0; gy < rows; gy++) {
                    for (let gx = 0; gx < cols; gx++) {
                        const idx = gy * cols + gx;
                        const b = preset.buildings[idx];
                        if (!b) continue;

                        // Smooth height lerp
                        b.currentH = p.lerp(b.currentH, b.targetH, 0.05);

                        const bx = isoX(gx, gy);
                        const by = isoY(gx, gy);
                        const bassBoost = 1 + preset.audio.bass * 0.2;
                        const h = b.currentH * bassBoost;
                        const hw = cell * 0.48 * b.widthScale;
                        const hh = cell * 0.24 * b.widthScale;

                        // Building glow intensity from audio
                        const glow = preset.audio.rms * 35;

                        // --- Left face ---
                        const lc = b.colorLeft;
                        p.fill(lc[0] + glow * 0.2, lc[1] + glow * 0.15, lc[2] + glow * 0.5, 230);
                        p.quad(
                            bx - hw, by - hh,
                            bx, by - hh * 2,
                            bx, by - hh * 2 - h,
                            bx - hw, by - hh - h
                        );

                        // --- Right face ---
                        const rc = b.colorRight;
                        p.fill(rc[0] + glow * 0.15, rc[1] + glow * 0.1, rc[2] + glow * 0.4, 230);
                        p.quad(
                            bx, by - hh * 2,
                            bx + hw, by - hh,
                            bx + hw, by - hh - h,
                            bx, by - hh * 2 - h
                        );

                        // --- Top face ---
                        const tc = b.colorTop;
                        p.fill(tc[0] + glow * 0.6, tc[1] + glow * 0.3, tc[2] + glow * 0.6, 240);
                        p.quad(
                            bx, by - hh * 2 - h,
                            bx + hw, by - hh - h,
                            bx, by - h,
                            bx - hw, by - hh - h
                        );

                        // --- Neon edge lines (left top edge) ---
                        const nc = b.neonColor;
                        const edgePulse = 0.6 + Math.sin(preset.time * 1.5 + b.phase) * 0.4;
                        const edgeAlpha = (120 + preset.beatPulse * 80) * edgePulse;
                        p.stroke(nc[0], nc[1], nc[2], edgeAlpha);
                        p.strokeWeight(1.2);
                        // Top edge outline
                        p.line(bx - hw, by - hh - h, bx, by - hh * 2 - h);
                        p.line(bx, by - hh * 2 - h, bx + hw, by - hh - h);
                        // Vertical edges
                        p.line(bx - hw, by - hh, bx - hw, by - hh - h);
                        p.line(bx + hw, by - hh, bx + hw, by - hh - h);
                        p.noStroke();

                        // --- Windows on left face ---
                        const winRows = Math.max(2, Math.floor(h / 16));
                        const winCols = Math.max(1, Math.floor(hw / 7));
                        for (let wr = 0; wr < winRows; wr++) {
                            const rowFrac = (wr + 0.5) / winRows;
                            const wy = by - hh - rowFrac * h;
                            const xShift = rowFrac * hh;
                            for (let wc = 0; wc < winCols; wc++) {
                                const colFrac = (wc + 0.5) / (winCols + 0.5);
                                const wx = bx - hw * 0.92 + colFrac * hw * 0.85 - xShift;

                                const litVal = Math.sin(b.windowSeed * 17.3 + wr * 3.7 + wc * 2.1 + p.frameCount * 0.012);
                                const flickerOnBeat = preset.beatPulse > 0.4 ? Math.sin(p.frameCount * 0.5 + wr + wc) > 0 : false;

                                if (litVal > 0.1 || flickerOnBeat) {
                                    const brightness = 0.7 + Math.sin(preset.time * 2 + wr * 0.5) * 0.3;
                                    const beatBoost = preset.beatPulse > 0.3 ? 1.4 : 1;
                                    // Window glow (soft halo)
                                    p.fill(nc[0], nc[1], nc[2], 25 * brightness);
                                    p.ellipse(wx, wy, 5, 5);
                                    // Window light
                                    p.fill(
                                        nc[0] * brightness * beatBoost,
                                        nc[1] * brightness * beatBoost,
                                        nc[2] * brightness * beatBoost,
                                        180
                                    );
                                    p.rect(wx - 1.2, wy - 1.5, 2.5, 3);
                                } else {
                                    p.fill(12, 10, 25, 130);
                                    p.rect(wx - 1.2, wy - 1.5, 2.5, 3);
                                }
                            }
                        }

                        // --- Windows on right face ---
                        for (let wr = 0; wr < winRows; wr++) {
                            const rowFrac = (wr + 0.5) / winRows;
                            const wy = by - hh * 2 - rowFrac * h + hh;
                            const xShift = rowFrac * hh * 0.5;
                            for (let wc = 0; wc < winCols; wc++) {
                                const colFrac = (wc + 0.5) / (winCols + 0.5);
                                const wx = bx + colFrac * hw * 0.85 + xShift + 1;

                                const litVal = Math.sin(b.windowSeed * 13.1 + wr * 5.3 + wc * 1.7 + p.frameCount * 0.01);
                                const flickerOnBeat = preset.beatPulse > 0.4 ? Math.sin(p.frameCount * 0.5 + wr * 2 + wc) > 0 : false;

                                if (litVal > 0.05 || flickerOnBeat) {
                                    const brightness = 0.7 + Math.sin(preset.time * 1.8 + wr * 0.4 + 1) * 0.3;
                                    const beatBoost = preset.beatPulse > 0.3 ? 1.4 : 1;
                                    p.fill(nc[0], nc[1], nc[2], 25 * brightness);
                                    p.ellipse(wx, wy, 5, 5);
                                    p.fill(
                                        nc[0] * brightness * beatBoost,
                                        nc[1] * brightness * beatBoost,
                                        nc[2] * brightness * beatBoost,
                                        170
                                    );
                                    p.rect(wx - 1.2, wy - 1.5, 2.5, 3);
                                } else {
                                    p.fill(10, 8, 22, 130);
                                    p.rect(wx - 1.2, wy - 1.5, 2.5, 3);
                                }
                            }
                        }

                        // --- Antenna with blinking light ---
                        if (b.hasAntenna) {
                            p.stroke(80, 80, 120, 160);
                            p.strokeWeight(1);
                            p.line(bx, by - hh * 2 - h, bx, by - hh * 2 - h - 16);
                            p.noStroke();
                            const blink = Math.sin(p.frameCount * 0.1 + b.phase) > 0.2;
                            if (blink) {
                                p.fill(255, 30, 30, 200);
                                p.ellipse(bx, by - hh * 2 - h - 17, 3, 3);
                                // Blink glow
                                p.fill(255, 30, 30, 40);
                                p.ellipse(bx, by - hh * 2 - h - 17, 10, 8);
                            }
                        }

                        // --- Neon sign (side-mounted) ---
                        if (b.hasNeonSign) {
                            const signY = by - hh - h * 0.55;
                            const signX = bx + hw * 0.6;
                            const pulse = (Math.sin(p.frameCount * 0.07 + b.phase * 3) + 1) * 0.5;
                            // Flicker effect: occasionally off
                            const flicker = Math.sin(p.frameCount * 0.3 + b.phase * 7) > -0.85;
                            if (flicker) {
                                const alpha = 150 + pulse * 105;
                                // Glow halo
                                p.fill(nc[0], nc[1], nc[2], alpha * 0.2);
                                p.ellipse(signX, signY, 20, 12);
                                // Sign body
                                p.fill(nc[0], nc[1], nc[2], alpha);
                                p.rect(signX - 5, signY - 2.5, 10, 5, 1);
                                // Reflection on building face
                                p.fill(nc[0], nc[1], nc[2], alpha * 0.08);
                                p.quad(
                                    bx, by - hh * 2 - h * 0.3,
                                    bx + hw, by - hh - h * 0.3,
                                    bx + hw, by - hh - h * 0.7,
                                    bx, by - hh * 2 - h * 0.7
                                );
                            }
                        }

                        // --- Rooftop structure ---
                        if (b.hasRooftop) {
                            const rtH = 6;
                            const rtW = hw * 0.35;
                            const rtHH = hh * 0.35;
                            const topY = by - hh * 2 - h;
                            // Small box on roof
                            p.fill(tc[0] * 0.6, tc[1] * 0.6, tc[2] * 0.6, 200);
                            p.quad(
                                bx - rtW, topY - rtHH,
                                bx, topY - rtHH * 2,
                                bx, topY - rtHH * 2 - rtH,
                                bx - rtW, topY - rtHH - rtH
                            );
                            p.fill(tc[0] * 0.8, tc[1] * 0.8, tc[2] * 0.8, 200);
                            p.quad(
                                bx, topY - rtHH * 2,
                                bx + rtW, topY - rtHH,
                                bx + rtW, topY - rtHH - rtH,
                                bx, topY - rtHH * 2 - rtH
                            );
                        }
                    }
                }

                // === CARS on roads ===
                for (const car of preset.cars) {
                    car.pos += car.speed * (1 + preset.audio.mid * 0.6);
                    if (car.pos > cols + 2) car.pos = -2;
                    if (car.pos < -2) car.pos = cols + 2;

                    let carX, carY;
                    if (car.axis === 'x') {
                        carX = isoX(car.pos, car.lane);
                        carY = isoY(car.pos, car.lane);
                    } else {
                        carX = isoX(car.lane, car.pos);
                        carY = isoY(car.lane, car.pos);
                    }

                    // Car body with glow
                    p.fill(car.color[0], car.color[1], car.color[2], 35);
                    p.ellipse(carX, carY - 3, 16, 8);
                    p.fill(car.color[0], car.color[1], car.color[2], 220);
                    p.ellipse(carX, carY - 3, 8, 4);

                    // Headlights with beam
                    const headDir = car.axis === 'x' ? 1 : -1;
                    p.fill(255, 255, 220, 200);
                    p.ellipse(carX + headDir * 5, carY - 3, 2.5, 2);
                    p.fill(255, 255, 200, 30);
                    p.ellipse(carX + headDir * 10, carY - 3, 12, 4);

                    // Tail lights
                    p.fill(255, 20, 20, 200);
                    p.ellipse(carX - headDir * 5, carY - 3, 2, 2);
                    p.fill(255, 20, 20, 40);
                    p.ellipse(carX - headDir * 8, carY - 3, 8, 3);
                }

                // === HORIZONTAL SCAN LINE (cyberpunk aesthetic) ===
                preset.scanY = (preset.scanY + 0.8 + preset.audio.treble * 1.5) % p.height;
                p.fill(0, 255, 200, 12 + preset.audio.treble * 15);
                p.rect(0, preset.scanY, p.width, 2);
                p.fill(0, 255, 200, 4);
                p.rect(0, preset.scanY - 8, p.width, 18);

                // === FLOATING PARTICLES (dust/light) ===
                const particleCount = 8 + Math.floor(preset.audio.treble * 8);
                for (let i = 0; i < particleCount; i++) {
                    const px = (Math.sin(preset.time * 0.4 + i * 1.7) * 0.45 + 0.5) * p.width;
                    const py = (Math.cos(preset.time * 0.3 + i * 2.3) * 0.4 + 0.5) * p.height;
                    const pSize = 1.5 + Math.sin(preset.time + i) * 0.8;
                    const pAlpha = 40 + Math.sin(preset.time * 2 + i * 0.7) * 25;
                    p.fill(180, 220, 255, pAlpha);
                    p.ellipse(px, py, pSize, pSize);
                }

                // === LIGHTNING on strong beats ===
                if (preset.lightningAlpha > 2) {
                    p.stroke(200, 180, 255, preset.lightningAlpha);
                    p.strokeWeight(1.5);
                    let lx = preset.lightningX;
                    let ly = 0;
                    for (let seg = 0; seg < 8; seg++) {
                        const nx = lx + (Math.random() - 0.5) * 60;
                        const ny = ly + p.height * 0.06 + Math.random() * 20;
                        p.line(lx, ly, nx, ny);
                        lx = nx;
                        ly = ny;
                    }
                    p.noStroke();
                    preset.lightningAlpha *= 0.75;
                }

                // === BEAT FLASH OVERLAY ===
                if (preset.beatFlash > 0.03) {
                    const flashR = 120 + preset.audio.bass * 80;
                    const flashB = 200 + preset.audio.treble * 55;
                    p.fill(flashR, 140, flashB, preset.beatFlash * 35);
                    p.rect(0, 0, p.width, p.height);
                    preset.beatFlash *= 0.82;
                }

                // === REFLECTION on bottom (mirrored city glow) ===
                const refY = p.height * 0.85;
                for (let i = 0; i < 6; i++) {
                    const rx = (i / 6 + 0.08) * p.width;
                    const rw = 30 + preset.audio.bass * 20;
                    const rAlpha = 10 + preset.audio.rms * 15;
                    const nc = preset.buildings[Math.floor(i * 15) % preset.buildings.length];
                    if (nc && nc.neonColor) {
                        p.fill(nc.neonColor[0], nc.neonColor[1], nc.neonColor[2], rAlpha);
                        p.ellipse(rx, refY + i * 5, rw, 3);
                    }
                }

                preset.beatPulse *= 0.86;
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _initCity(p) {
        this.buildings = [];
        const cols = this.params.cols;
        const rows = this.params.rows;

        // Cyberpunk neon palette
        const neonColors = [
            [0, 255, 220],    // cyan
            [255, 40, 180],   // magenta
            [180, 50, 255],   // purple
            [50, 255, 120],   // neon green
            [255, 100, 50],   // neon orange
            [80, 140, 255],   // electric blue
            [255, 255, 60],   // neon yellow
        ];

        // Dark building surface palettes
        const palettes = [
            { left: [22, 18, 50], right: [32, 28, 65], top: [48, 42, 82] },
            { left: [18, 28, 45], right: [28, 40, 60], top: [42, 58, 78] },
            { left: [35, 15, 42], right: [48, 25, 55], top: [62, 40, 72] },
            { left: [15, 22, 38], right: [25, 35, 52], top: [38, 50, 68] },
            { left: [28, 18, 32], right: [42, 28, 48], top: [58, 42, 62] },
            { left: [20, 25, 55], right: [30, 38, 70], top: [45, 55, 88] },
        ];

        for (let i = 0; i < cols * rows; i++) {
            const gx = i % cols;
            const gy = Math.floor(i / cols);
            const isRoad = gx % 4 === 0 || gy % 4 === 0;

            if (isRoad) {
                this.buildings.push(null);
                continue;
            }

            // Vary height: center buildings taller, edges shorter
            const cx = Math.abs(gx - cols * 0.5) / (cols * 0.5);
            const cy = Math.abs(gy - rows * 0.5) / (rows * 0.5);
            const centerBonus = (1 - (cx + cy) * 0.4) * 60;
            const baseH = 20 + Math.random() * 80 + centerBonus;

            const pal = palettes[Math.floor(Math.random() * palettes.length)];
            const neon = neonColors[Math.floor(Math.random() * neonColors.length)];

            this.buildings.push({
                targetH: baseH,
                currentH: 0,
                widthScale: 0.72 + Math.random() * 0.28,
                colorLeft: pal.left,
                colorRight: pal.right,
                colorTop: pal.top,
                neonColor: neon,
                windowSeed: Math.random() * 100,
                hasAntenna: Math.random() < 0.2,
                hasNeonSign: Math.random() < 0.35,
                hasRooftop: Math.random() < 0.3,
                phase: Math.random() * Math.PI * 2,
            });
        }

        // Init cars across road lanes
        this.cars = [];
        const carNeonColors = [
            [255, 255, 255], [0, 220, 255], [255, 60, 180],
            [120, 255, 100], [255, 200, 50], [180, 100, 255],
        ];

        for (let lane = 0; lane < rows; lane += 4) {
            const numCars = 2 + Math.floor(Math.random() * 3);
            for (let c = 0; c < numCars; c++) {
                this.cars.push({
                    lane: lane + 0.5,
                    pos: Math.random() * cols,
                    speed: 0.015 + Math.random() * 0.035,
                    axis: Math.random() < 0.5 ? 'x' : 'y',
                    color: carNeonColors[Math.floor(Math.random() * carNeonColors.length)],
                });
            }
        }
        for (let lane = 0; lane < cols; lane += 4) {
            const numCars = 1 + Math.floor(Math.random() * 2);
            for (let c = 0; c < numCars; c++) {
                this.cars.push({
                    lane: lane + 0.5,
                    pos: Math.random() * rows,
                    speed: 0.015 + Math.random() * 0.03,
                    axis: Math.random() < 0.5 ? 'y' : 'x',
                    color: carNeonColors[Math.floor(Math.random() * carNeonColors.length)],
                });
            }
        }
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        this.beatFlash = strength;

        // Lightning on strong beats
        if (strength > 0.6 && this.p5) {
            this.lightningAlpha = strength * 200;
            this.lightningX = Math.random() * (this.p5.width || 800);
        }

        // Randomize building heights on beat for organic movement
        const changeChance = 0.15 + strength * 0.15;
        for (const b of this.buildings) {
            if (!b) continue;
            if (Math.random() < changeChance) {
                b.targetH = 20 + Math.random() * 110;
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['isometric-city'] = IsometricCityPreset;
})();
