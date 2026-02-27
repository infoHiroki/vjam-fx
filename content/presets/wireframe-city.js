(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class WireframeCityPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;
        this.p5 = new p5((p) => {
            let buildings = [];
            let camZ = 0;

            // Perspective projection parameters
            const VANISH_Y = 0.38; // vanishing point Y ratio
            const ROAD_BOTTOM = 0.95;
            const NUM_ROWS = 14;
            const BUILDINGS_PER_SIDE = 2;

            function projectPoint(worldX, worldY, worldZ) {
                // Simple perspective: objects at greater Z are closer to vanishing point
                const vx = p.width * 0.5;
                const vy = p.height * VANISH_Y;
                const depth = Math.max(worldZ, 0.1);
                const scale = 1 / (1 + depth * 0.08);
                const sx = vx + (worldX - vx) * scale;
                const sy = vy + (worldY - vy) * scale;
                return { x: sx, y: sy, scale };
            }

            function generateBuildings() {
                buildings = [];
                const totalDepth = NUM_ROWS;

                for (let row = 0; row < NUM_ROWS; row++) {
                    const z = row * 1.2; // depth
                    const rowSeed = row * 137.5;

                    for (let side = -1; side <= 1; side += 2) {
                        for (let col = 0; col < BUILDINGS_PER_SIDE; col++) {
                            const baseX = p.width * 0.5 + side * (p.width * 0.15 + col * p.width * 0.18);
                            const widthRange = p.width * (0.08 + col * 0.04);
                            const bw = widthRange * (0.6 + pseudoRandom(rowSeed + col * 73 + side * 31) * 0.8);
                            const floors = 2 + Math.floor(pseudoRandom(rowSeed + col * 53 + side * 17) * 7);
                            const floorH = 18 + pseudoRandom(rowSeed + col * 91) * 12;
                            const bh = floors * floorH;

                            buildings.push({
                                x: baseX - bw * 0.5 + (pseudoRandom(rowSeed + col * 200 + side * 50) - 0.5) * p.width * 0.06,
                                w: bw,
                                h: bh,
                                z: z,
                                floors: floors,
                                floorH: floorH,
                                side: side,
                                hue: 140 + pseudoRandom(rowSeed + col) * 80,
                                flash: 0,
                                hasAntenna: floors > 5 && pseudoRandom(rowSeed + col * 47) > 0.5,
                                windowSeed: rowSeed + col * 300 + side * 99,
                            });
                        }
                    }
                }

                // Sort by depth (far first)
                buildings.sort((a, b) => b.z - a.z);
            }

            function pseudoRandom(seed) {
                const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
                return x - Math.floor(x);
            }

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                generateBuildings();
            };

            p.draw = () => {
                p.background(0, 0, 0);
                preset.beatPulse *= 0.9;

                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const bp = preset.beatPulse;
                const fc = p.frameCount;

                // Slow camera drift
                camZ = Math.sin(fc * 0.003) * 0.5;

                const vx = p.width * 0.5;
                const vy = p.height * VANISH_Y;
                const glowBase = 35 + bass * 35 + bp * 30;

                // === Ground grid (perspective road) ===
                p.strokeWeight(0.5);
                const gridRows = 30;
                for (let i = 0; i <= gridRows; i++) {
                    const t = i / gridRows;
                    const rowY = vy + (p.height * ROAD_BOTTOM - vy) * t;
                    const spread = t;
                    const alpha = 12 + t * 15 + bp * 10;

                    // Horizontal grid line
                    p.stroke(160, 60, glowBase * 0.6, alpha);
                    const leftX = vx - p.width * 0.6 * spread;
                    const rightX = vx + p.width * 0.6 * spread;
                    p.line(leftX, rowY, rightX, rowY);
                }

                // Vertical converging lines (road lanes)
                const vertLines = 12;
                for (let i = 0; i <= vertLines; i++) {
                    const t = i / vertLines;
                    const worldX = vx + (t - 0.5) * p.width * 1.2;
                    p.stroke(160, 60, glowBase * 0.5, 10 + bp * 8);
                    p.strokeWeight(0.5);
                    p.line(vx, vy, worldX, p.height * ROAD_BOTTOM);
                }

                // Central road line (bright)
                p.stroke(180, 80, glowBase * 1.2, 30 + bp * 20);
                p.strokeWeight(1);
                p.line(vx, vy, vx, p.height * ROAD_BOTTOM);

                // === Buildings ===
                p.noFill();
                for (const b of buildings) {
                    b.flash *= 0.92;

                    const effectiveZ = b.z + camZ;
                    const groundY = p.height * (VANISH_Y + (ROAD_BOTTOM - VANISH_Y) * 0.75);

                    // Project building base and top
                    const baseLeft = projectPoint(b.x, groundY, effectiveZ);
                    const baseRight = projectPoint(b.x + b.w, groundY, effectiveZ);
                    const topLeft = projectPoint(b.x, groundY - b.h, effectiveZ);
                    const topRight = projectPoint(b.x + b.w, groundY - b.h, effectiveZ);

                    // Skip if too small or off screen
                    const screenW = baseRight.x - baseLeft.x;
                    if (screenW < 2) continue;
                    if (baseRight.x < -20 || baseLeft.x > p.width + 20) continue;

                    const depthFade = Math.max(0, 1 - effectiveZ * 0.06);
                    const brightness = (glowBase + b.flash * 50) * depthFade;
                    const alpha = (30 + b.flash * 45 + bp * 15) * depthFade;
                    const hue = b.hue + Math.sin(fc * 0.01 + b.z) * 10;

                    // Outer glow
                    p.stroke(hue, 70, brightness * 0.7, alpha * 0.3);
                    p.strokeWeight(2 + b.flash);
                    p.beginShape();
                    p.vertex(baseLeft.x, baseLeft.y);
                    p.vertex(topLeft.x, topLeft.y);
                    p.vertex(topRight.x, topRight.y);
                    p.vertex(baseRight.x, baseRight.y);
                    p.endShape(p.CLOSE);

                    // Sharp wireframe
                    p.stroke(hue, 70, brightness, alpha);
                    p.strokeWeight(0.8 + b.flash * 0.3);
                    p.beginShape();
                    p.vertex(baseLeft.x, baseLeft.y);
                    p.vertex(topLeft.x, topLeft.y);
                    p.vertex(topRight.x, topRight.y);
                    p.vertex(baseRight.x, baseRight.y);
                    p.endShape(p.CLOSE);

                    // Horizontal floor lines
                    const screenH = baseLeft.y - topLeft.y;
                    const visibleFloors = Math.min(b.floors, Math.floor(screenH / 4));
                    for (let f = 1; f < visibleFloors; f++) {
                        const ft = f / b.floors;
                        const floorLeftY = baseLeft.y - (baseLeft.y - topLeft.y) * ft;
                        const floorRightY = baseRight.y - (baseRight.y - topRight.y) * ft;
                        const floorLeftX = baseLeft.x + (topLeft.x - baseLeft.x) * ft;
                        const floorRightX = baseRight.x + (topRight.x - baseRight.x) * ft;

                        p.stroke(hue, 50, brightness * 0.6, alpha * 0.5);
                        p.strokeWeight(0.4);
                        p.line(floorLeftX, floorLeftY, floorRightX, floorRightY);
                    }

                    // Windows (small dots on floors)
                    if (screenW > 8 && depthFade > 0.3) {
                        const winCols = Math.min(6, Math.floor(screenW / 5));
                        const winRows = Math.min(8, visibleFloors);
                        for (let wr = 0; wr < winRows; wr++) {
                            const ft = (wr + 0.5) / b.floors;
                            for (let wc = 0; wc < winCols; wc++) {
                                const wt = (wc + 0.5) / winCols;
                                const isLit = pseudoRandom(b.windowSeed + wr * 13 + wc * 7 + Math.floor(fc * 0.005)) > 0.45;
                                if (!isLit && b.flash < 0.3) continue;

                                const wy = baseLeft.y - (baseLeft.y - topLeft.y) * ft;
                                const rowLeftX = baseLeft.x + (topLeft.x - baseLeft.x) * ft;
                                const rowRightX = baseRight.x + (topRight.x - baseRight.x) * ft;
                                const wx = rowLeftX + (rowRightX - rowLeftX) * wt;

                                const winAlpha = (isLit ? 40 : 15) + b.flash * 35;
                                p.stroke(hue, 50, 80, winAlpha * depthFade);
                                p.strokeWeight(1.5 + b.flash);
                                p.point(wx, wy);
                            }
                        }
                    }

                    // Antenna
                    if (b.hasAntenna && screenW > 6) {
                        const antX = (topLeft.x + topRight.x) * 0.5;
                        const antY = topLeft.y;
                        const antH = (baseLeft.y - topLeft.y) * 0.15;
                        p.stroke(hue, 60, brightness * 0.8, alpha * 0.7);
                        p.strokeWeight(0.6);
                        p.line(antX, antY, antX, antY - antH);

                        // Blinking light
                        const blink = Math.sin(fc * 0.12 + b.z * 5) > 0.6;
                        if (blink) {
                            p.stroke(0, 80, 100, 70 + bp * 20);
                            p.strokeWeight(2.5);
                            p.point(antX, antY - antH);
                        }
                    }
                }

                // === Beat flash: light up random buildings ===
                if (bp > 0.2) {
                    const count = Math.floor(bp * 10);
                    for (let i = 0; i < count; i++) {
                        const idx = Math.floor(Math.random() * buildings.length);
                        buildings[idx].flash = Math.max(buildings[idx].flash, bp);
                    }
                }

                // === Vanishing point glow ===
                p.noStroke();
                const vpGlow = 15 + bass * 20 + bp * 25;
                p.fill(170, 60, vpGlow, 8);
                p.ellipse(vx, vy, 120 + bp * 60, 50 + bp * 20);
                p.fill(170, 70, vpGlow * 1.5, 5);
                p.ellipse(vx, vy, 60 + bp * 30, 25 + bp * 10);

                // === Horizontal scan line ===
                const scanY = (fc * 0.8) % p.height;
                p.stroke(160, 50, 50 + treble * 30, 8 + mid * 6);
                p.strokeWeight(1);
                p.line(0, scanY, p.width, scanY);

                // === Edge neon accent lines (framing) ===
                const edgeAlpha = 8 + bp * 15 + bass * 10;
                p.stroke(180, 80, 50, edgeAlpha);
                p.strokeWeight(1);
                // Bottom horizon glow line
                const horizonY = p.height * ROAD_BOTTOM;
                p.line(0, horizonY, p.width, horizonY);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                generateBuildings();
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
window.VJamFX.presets['wireframe-city'] = WireframeCityPreset;
})();
