(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FilmReelPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.scrollSpeed = 1;
        this.frameCounter = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;
            const RES = 4;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.colorMode(pg.HSB, 360, 100, 100, 100);
            };

            const drawSprocketHole = (x, y, w, h) => {
                // Outer dark hole
                pg.fill(0, 0, 2, 95);
                pg.noStroke();
                pg.rect(x, y, w, h, 1.5);
                // Inner edge highlight (embossed look)
                pg.stroke(30, 20, 18, 35);
                pg.strokeWeight(0.5);
                pg.noFill();
                pg.rect(x + 0.5, y + 0.5, w - 1, h - 1, 1);
                // Tiny bright edge (light catching the hole rim)
                pg.stroke(35, 15, 30, 25);
                pg.line(x + 1, y + h - 0.5, x + w - 1, y + h - 0.5);
            };

            const drawFrameContent = (frameL, frameY, frameW, frameH, frameIdx, flicker, mid) => {
                // Determine scene type by frame index
                const sceneType = Math.abs(frameIdx) % 5;

                pg.noStroke();
                if (sceneType === 0) {
                    // Landscape: horizon + sky tones
                    const horizY = frameY + frameH * 0.55;
                    // Sky
                    for (let fy = 0; fy < frameH * 0.55; fy += 2) {
                        const n = p.noise(frameIdx * 5 + fy * 0.03);
                        const bri = (20 + n * 25) * flicker + mid * 10;
                        pg.fill(35, 40 + n * 15, bri, 75);
                        pg.rect(frameL, frameY + fy, frameW, 2);
                    }
                    // Ground
                    for (let fy = frameH * 0.55; fy < frameH; fy += 2) {
                        const n = p.noise(frameIdx * 7 + fy * 0.05);
                        const bri = (10 + n * 18) * flicker + mid * 8;
                        pg.fill(30, 50, bri, 75);
                        pg.rect(frameL, frameY + fy, frameW, 2);
                    }
                    // Horizon line
                    pg.stroke(35, 30, 40 * flicker, 40);
                    pg.strokeWeight(0.5);
                    pg.line(frameL, horizY, frameL + frameW, horizY);
                } else if (sceneType === 1) {
                    // Close-up: large circular shape (face/object)
                    const cx = frameL + frameW * 0.5;
                    const cy = frameY + frameH * 0.45;
                    const r = Math.min(frameW, frameH) * 0.3;
                    // Background
                    pg.fill(30, 35, 12 * flicker, 70);
                    pg.rect(frameL, frameY, frameW, frameH);
                    // Subject oval
                    for (let i = 3; i >= 0; i--) {
                        const bri = (15 + i * 8) * flicker + mid * 6;
                        pg.fill(32, 30, bri, 50);
                        pg.noStroke();
                        pg.ellipse(cx, cy, r * (1 + i * 0.3), r * (1.3 + i * 0.3));
                    }
                } else if (sceneType === 2) {
                    // Title card: bright with text-like lines
                    pg.fill(35, 20, 35 * flicker, 80);
                    pg.rect(frameL, frameY, frameW, frameH);
                    // Text-like horizontal bars
                    pg.fill(30, 25, 55 * flicker + mid * 12, 60);
                    const lineY = frameY + frameH * 0.35;
                    pg.rect(frameL + frameW * 0.15, lineY, frameW * 0.7, 2);
                    pg.rect(frameL + frameW * 0.2, lineY + 4, frameW * 0.6, 1.5);
                    pg.rect(frameL + frameW * 0.25, lineY + 8, frameW * 0.5, 1.5);
                } else if (sceneType === 3) {
                    // Action: diagonal streaks
                    pg.fill(28, 40, 10 * flicker, 70);
                    pg.rect(frameL, frameY, frameW, frameH);
                    pg.stroke(35, 30, 35 * flicker + mid * 10, 45);
                    pg.strokeWeight(1);
                    for (let d = 0; d < 6; d++) {
                        const dx = frameL + p.noise(frameIdx + d * 3) * frameW;
                        const dy = frameY + p.noise(frameIdx + d * 3 + 100) * frameH;
                        pg.line(dx, dy, dx + frameW * 0.3, dy + frameH * 0.15);
                    }
                } else {
                    // Abstract grain pattern
                    const cellSize = 3;
                    for (let fy = 0; fy < frameH; fy += cellSize) {
                        for (let fx = 0; fx < frameW; fx += cellSize) {
                            const n = p.noise(
                                fx * 0.06 + frameIdx * 10,
                                fy * 0.06 + frameIdx * 7
                            );
                            const bri = n * 40 * flicker + mid * 12;
                            pg.fill(30, 45, bri, 70);
                            pg.rect(frameL + fx, frameY + fy, cellSize, cellSize);
                        }
                    }
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.015 * speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.88;

                preset.scrollSpeed += (1 - preset.scrollSpeed) * 0.04;
                const scroll = t * preset.scrollSpeed * 12;

                const w = pg.width;
                const h = pg.height;

                pg.background(0, 0, 2);

                // Film strip dimensions
                const stripL = w * 0.12;
                const stripR = w * 0.88;
                const stripW = stripR - stripL;
                const sprocketW = stripW * 0.07;
                const frameH = stripW * 0.52;
                const sprocketH = frameH * 0.1;
                const sprocketGap = frameH * 0.065;
                const gapBetweenFrames = sprocketGap * 0.6;

                // Film strip background with subtle texture
                pg.noStroke();
                pg.fill(28, 35, 10, 85);
                pg.rect(stripL, 0, stripW, h);

                // Film strip edge highlights
                pg.stroke(30, 25, 18, 30);
                pg.strokeWeight(0.5);
                pg.line(stripL + 1, 0, stripL + 1, h);
                pg.line(stripR - 1, 0, stripR - 1, h);

                // Sprocket holes and frames
                const totalFrameH = frameH + sprocketGap * 2 + gapBetweenFrames;
                const startY = -(scroll % totalFrameH);

                for (let y = startY; y < h + totalFrameH; y += totalFrameH) {
                    // Sprocket holes (left side) - 4 holes per frame
                    const sprocketSpacing = frameH / 4;
                    for (let s = 0; s < 4; s++) {
                        const sy = y + sprocketGap + s * sprocketSpacing;
                        drawSprocketHole(
                            stripL + 2, sy,
                            sprocketW - 2, sprocketH
                        );
                    }

                    // Sprocket holes (right side) - 4 holes per frame
                    for (let s = 0; s < 4; s++) {
                        const sy = y + sprocketGap + s * sprocketSpacing;
                        drawSprocketHole(
                            stripR - sprocketW, sy,
                            sprocketW - 2, sprocketH
                        );
                    }

                    // Frame area
                    const frameL = stripL + sprocketW + 4;
                    const frameR = stripR - sprocketW - 4;
                    const frameFW = frameR - frameL;
                    const frameY = y + sprocketGap;

                    // Frame border (double line for authenticity)
                    pg.noFill();
                    pg.stroke(30, 35, 22, 55);
                    pg.strokeWeight(0.8);
                    pg.rect(frameL, frameY, frameFW, frameH);
                    pg.stroke(30, 30, 16, 30);
                    pg.strokeWeight(0.4);
                    pg.rect(frameL - 1, frameY - 1, frameFW + 2, frameH + 2);

                    // Frame content (varied scenes)
                    const frameIdx = Math.floor((scroll + y) / totalFrameH);
                    const flicker = 0.75 + Math.sin(p.frameCount * 0.3 + frameIdx) * 0.15 * (1 + pulse * 0.5);

                    drawFrameContent(frameL, frameY, frameFW, frameH, frameIdx, flicker, mid);

                    // Film gate vignette on frame edges
                    pg.noStroke();
                    pg.fill(0, 0, 0, 35);
                    pg.rect(frameL, frameY, frameFW, 3);
                    pg.rect(frameL, frameY + frameH - 3, frameFW, 3);
                    pg.rect(frameL, frameY, 3, frameH);
                    pg.rect(frameR - 3, frameY, 3, frameH);
                    // Corner darkening
                    pg.fill(0, 0, 0, 20);
                    pg.rect(frameL, frameY, 6, 6);
                    pg.rect(frameR - 6, frameY, 6, 6);
                    pg.rect(frameL, frameY + frameH - 6, 6, 6);
                    pg.rect(frameR - 6, frameY + frameH - 6, 6, 6);

                    // Frame number (bottom right, film-style)
                    pg.fill(35, 25, 45, 40);
                    pg.noStroke();
                    pg.textSize(2.5);
                    pg.textAlign(pg.RIGHT, pg.BOTTOM);
                    const dispNum = ((Math.abs(frameIdx) % 9999) + 1).toString().padStart(4, '0');
                    pg.text(dispNum, frameR - 4, frameY + frameH - 2);

                    // Keycode marker (left side, like real film)
                    if (Math.abs(frameIdx) % 8 === 0) {
                        pg.fill(35, 20, 40, 30);
                        pg.textAlign(pg.LEFT, pg.BOTTOM);
                        pg.text('KJ', frameL + 3, frameY + frameH - 2);
                    }

                    // Inter-frame gap marking
                    pg.stroke(30, 30, 14, 25);
                    pg.strokeWeight(0.3);
                    const gapY = y + sprocketGap + frameH + sprocketGap;
                    pg.line(frameL, gapY, frameR, gapY);
                }

                // Film strip edges (perforated border)
                pg.stroke(28, 25, 15, 50);
                pg.strokeWeight(0.8);
                pg.line(stripL, 0, stripL, h);
                pg.line(stripR, 0, stripR, h);

                // Outer border emboss
                pg.stroke(30, 20, 20, 25);
                pg.strokeWeight(0.4);
                pg.line(stripL - 1, 0, stripL - 1, h);
                pg.line(stripR + 1, 0, stripR + 1, h);

                // Projector light cone (sides)
                pg.noStroke();
                pg.fill(35, 15, 30, 4);
                pg.beginShape();
                pg.vertex(0, 0);
                pg.vertex(stripL, 0);
                pg.vertex(stripL, h);
                pg.vertex(0, h);
                pg.endShape(pg.CLOSE);
                pg.beginShape();
                pg.vertex(stripR, 0);
                pg.vertex(w, 0);
                pg.vertex(w, h);
                pg.vertex(stripR, h);
                pg.endShape(pg.CLOSE);

                // Projector flicker overlay
                if (Math.random() < 0.12 + pulse * 0.25) {
                    pg.noStroke();
                    pg.fill(30, 15, 55, 4 + Math.random() * 6);
                    pg.rect(stripL, 0, stripW, h);
                }

                // Film grain / dust particles
                pg.noStroke();
                for (let i = 0; i < 5; i++) {
                    const dx = stripL + Math.random() * stripW;
                    const dy = Math.random() * h;
                    const size = 0.5 + Math.random() * 1;
                    pg.fill(35, 10, 60, 15 + Math.random() * 15);
                    pg.ellipse(dx, dy, size, size);
                }

                // Scratches (vertical, semi-permanent)
                pg.stroke(30, 10, 45, 15);
                pg.strokeWeight(0.3);
                for (let i = 0; i < 2; i++) {
                    const sx = stripL + sprocketW + p.noise(i * 7.3 + Math.floor(p.frameCount * 0.003)) * (stripW - sprocketW * 2);
                    pg.line(sx, 0, sx + (p.noise(i * 3.1) - 0.5) * 3, h);
                }

                // Beat: warmth spike + speed
                if (pulse > 0.3) {
                    pg.noStroke();
                    pg.fill(35, 35, 70, pulse * 15);
                    pg.rect(stripL, 0, stripW, h);
                }

                p.image(pg, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.colorMode(pg.HSB, 360, 100, 100, 100);
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
        this.scrollSpeed = 1 + strength * 3;
        this.frameCounter++;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['film-reel'] = FilmReelPreset;
})();
