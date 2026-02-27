(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CassetteReelPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.pendingBeats = [];
        this.reelAngle = 0;
        this.reelSpeed = 0.02;
        this.targetSpeed = 0.02;
        this.counter = 0;
        this.tapeParticles = [];
        this.ffEffect = 0;
        this.trailGfx = null;
        this.tapeProgress = 0.35; // 0=full left, 1=full right
    }

    setup(container) {
        this.destroy();
        this.pendingBeats = [];
        this.reelAngle = 0;
        this.reelSpeed = 0.02;
        this.targetSpeed = 0.02;
        this.counter = 0;
        this.ffEffect = 0;
        this.tapeProgress = 0.35;
        const preset = this;

        this.tapeParticles = [];
        for (let i = 0; i < 20; i++) {
            this.tapeParticles.push({ t: Math.random(), speed: 0.002 + Math.random() * 0.003 });
        }

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                preset.trailGfx = p.createGraphics(p.width, p.height);
                preset.trailGfx.colorMode(preset.trailGfx.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const cx = p.width / 2;
                const cy = p.height / 2;
                // Scale to fill most of the screen
                const scale = Math.min(p.width, p.height) / 320;

                // Process beats
                for (const beat of preset.pendingBeats) {
                    preset.ffEffect = beat.strength;
                    preset.targetSpeed = 0.08 + beat.strength * 0.15;
                }
                preset.pendingBeats = [];

                // Speed interpolation — bass drives base spin
                preset.reelSpeed += (preset.targetSpeed - preset.reelSpeed) * 0.05;
                preset.targetSpeed += (0.02 - preset.targetSpeed) * 0.02;
                const spinSpeed = preset.reelSpeed + bass * 0.04;
                preset.reelAngle += spinSpeed;
                preset.counter += spinSpeed * 2;
                preset.tapeProgress += spinSpeed * 0.001;
                if (preset.tapeProgress > 0.75) preset.tapeProgress = 0.25;

                // Trail fade
                const tg = preset.trailGfx;
                tg.colorMode(tg.HSB, 360, 100, 100, 100);
                tg.fill(0, 0, 0, 25);
                tg.noStroke();
                tg.rect(0, 0, tg.width, tg.height);

                // === Cassette housing — large, fills screen ===
                const housingW = 380 * scale;
                const housingH = 245 * scale;
                const hx = cx - housingW / 2;
                const hy = cy - housingH / 2;
                const cornerR = 12 * scale;

                // Housing body
                tg.stroke(30, 50, 65, 70);
                tg.strokeWeight(2.5 * scale);
                tg.noFill();
                tg.rect(hx, hy, housingW, housingH, cornerR);

                // Inner bevel line
                const bev = 6 * scale;
                tg.stroke(30, 40, 45, 35);
                tg.strokeWeight(1 * scale);
                tg.rect(hx + bev, hy + bev, housingW - bev * 2, housingH - bev * 2, cornerR * 0.7);

                // === Label area (top) ===
                const labelW = 260 * scale;
                const labelH = 40 * scale;
                const labelX = cx - labelW / 2;
                const labelY = hy + 15 * scale;
                tg.fill(30, 35, 18, 60);
                tg.stroke(30, 40, 35, 40);
                tg.strokeWeight(1 * scale);
                tg.rect(labelX, labelY, labelW, labelH, 3 * scale);

                // Label lines
                tg.stroke(30, 30, 40, 30);
                tg.strokeWeight(0.5 * scale);
                for (let i = 1; i <= 3; i++) {
                    const ly = labelY + labelH * (i / 4);
                    tg.line(labelX + 10 * scale, ly, labelX + labelW - 10 * scale, ly);
                }

                // Label text
                tg.fill(180, 60, 80, 50);
                tg.noStroke();
                tg.textSize(9 * scale);
                tg.textAlign(tg.LEFT, tg.TOP);
                tg.text('SIDE A', labelX + 10 * scale, labelY + 4 * scale);

                // === Tape window — large transparent area ===
                const winW = 260 * scale;
                const winH = 110 * scale;
                const wx = cx - winW / 2;
                const wy = labelY + labelH + 10 * scale;
                tg.stroke(30, 40, 50, 55);
                tg.strokeWeight(2 * scale);
                tg.fill(0, 0, 3, 85);
                tg.rect(wx, wy, winW, winH, 5 * scale);

                // Window shine
                tg.noStroke();
                tg.fill(0, 0, 100, 3);
                tg.rect(wx + 3 * scale, wy + 3 * scale, winW - 6 * scale, winH * 0.35, 3 * scale);

                // === Reel positions ===
                const reelY = wy + winH / 2;
                const reelSpacing = 80 * scale;
                const leftReelX = cx - reelSpacing;
                const rightReelX = cx + reelSpacing;

                // Tape amount determines reel size
                const tp = preset.tapeProgress;
                const leftTapeR = 50 * scale * (1.0 - tp * 0.5);
                const rightTapeR = 50 * scale * (0.5 + tp * 0.5);
                const hubR = 14 * scale;

                // Draw reel function
                const drawReel = (rx, ry, angle, tapeRadius, speedMul) => {
                    // Tape spool (concentric rings for tape layers)
                    const neonHue = 180 + mid * 40;
                    for (let r = hubR + 4 * scale; r < tapeRadius; r += 2.5 * scale) {
                        const alpha = 25 + (r / tapeRadius) * 20;
                        tg.noFill();
                        tg.stroke(30, 50, 35, alpha);
                        tg.strokeWeight(1.5 * scale);
                        tg.ellipse(rx, ry, r * 2, r * 2);
                    }

                    // Outer ring of reel
                    tg.noFill();
                    tg.stroke(neonHue, 50, 70, 65);
                    tg.strokeWeight(2 * scale);
                    tg.ellipse(rx, ry, tapeRadius * 2, tapeRadius * 2);

                    // Hub outer ring
                    tg.stroke(neonHue, 60, 80, 80);
                    tg.strokeWeight(2 * scale);
                    tg.noFill();
                    tg.ellipse(rx, ry, hubR * 2, hubR * 2);

                    // Hub fill
                    tg.fill(0, 0, 10, 90);
                    tg.noStroke();
                    tg.ellipse(rx, ry, hubR * 1.6, hubR * 1.6);

                    // Hub teeth (6 teeth around hub)
                    const a0 = angle * speedMul;
                    tg.fill(neonHue, 50, 75, 75);
                    tg.noStroke();
                    for (let i = 0; i < 6; i++) {
                        const a = a0 + (i * Math.PI * 2 / 6);
                        const tx = rx + Math.cos(a) * hubR * 0.55;
                        const ty = ry + Math.sin(a) * hubR * 0.55;
                        tg.rect(tx - 2 * scale, ty - 2 * scale, 4 * scale, 4 * scale);
                    }

                    // Spokes (3 lines from hub to tape edge)
                    tg.stroke(neonHue, 40, 60, 45);
                    tg.strokeWeight(1.5 * scale);
                    for (let i = 0; i < 3; i++) {
                        const a = a0 + (i * Math.PI * 2 / 3);
                        tg.line(
                            rx + Math.cos(a) * hubR * 0.8,
                            ry + Math.sin(a) * hubR * 0.8,
                            rx + Math.cos(a) * (tapeRadius - 3 * scale),
                            ry + Math.sin(a) * (tapeRadius - 3 * scale)
                        );
                    }

                    // Center dot
                    tg.fill(neonHue, 70, 90, 90);
                    tg.noStroke();
                    tg.ellipse(rx, ry, 4 * scale, 4 * scale);
                };

                drawReel(leftReelX, reelY, preset.reelAngle, leftTapeR, 1.0);
                drawReel(rightReelX, reelY, preset.reelAngle, rightTapeR, -0.8);

                // === Tape path between reels ===
                const tapeColor = [180 + mid * 30, 55, 60, 60];

                // Tape from left reel → down to guide → across → up to right reel
                const guideY = wy + winH - 12 * scale;
                const guideLeftX = leftReelX - 5 * scale;
                const guideRightX = rightReelX + 5 * scale;
                const guideMidY = guideY + 8 * scale;

                tg.noFill();
                tg.stroke(...tapeColor);
                tg.strokeWeight(1.8 * scale);

                // Left reel bottom → left guide post
                tg.line(leftReelX, reelY + leftTapeR, guideLeftX, guideY);
                // Left guide → head area (center bottom dip)
                tg.bezier(guideLeftX, guideY, cx - 30 * scale, guideMidY,
                          cx + 30 * scale, guideMidY, guideRightX, guideY);
                // Right guide → right reel bottom
                tg.line(guideRightX, guideY, rightReelX, reelY + rightTapeR);

                // Guide posts
                tg.fill(0, 0, 60, 80);
                tg.noStroke();
                tg.ellipse(guideLeftX, guideY, 5 * scale, 5 * scale);
                tg.ellipse(guideRightX, guideY, 5 * scale, 5 * scale);
                // Center head
                tg.fill(0, 0, 50, 70);
                tg.rect(cx - 8 * scale, guideY - 3 * scale, 16 * scale, 8 * scale, 2 * scale);

                // Tape particles along path
                for (const tp2 of preset.tapeParticles) {
                    tp2.t += tp2.speed * (1 + spinSpeed * 5);
                    if (tp2.t > 1) tp2.t -= 1;
                    const t = tp2.t;
                    const px = p.bezierPoint(guideLeftX, cx - 30 * scale, cx + 30 * scale, guideRightX, t);
                    const py = p.bezierPoint(guideY, guideMidY, guideMidY, guideY, t);
                    tg.fill(180 + mid * 30, 70, 80, 55);
                    tg.noStroke();
                    tg.ellipse(px, py, 3 * scale, 3 * scale);
                }

                // === Tape counter ===
                const counterStr = String(Math.floor(preset.counter) % 10000).padStart(4, '0');
                const counterY = wy + winH + 18 * scale;
                // Counter box
                tg.fill(0, 0, 8, 80);
                tg.stroke(30, 40, 45, 50);
                tg.strokeWeight(1 * scale);
                tg.rect(cx - 30 * scale, counterY - 8 * scale, 60 * scale, 16 * scale, 2 * scale);
                // Counter digits
                tg.fill(50, 80, 90, 85);
                tg.noStroke();
                tg.textSize(11 * scale);
                tg.textAlign(tg.CENTER, tg.CENTER);
                tg.text(counterStr, cx, counterY);

                // === Screw holes (4 corners) ===
                const screwOff = 14 * scale;
                tg.fill(30, 30, 20, 55);
                tg.noStroke();
                const screws = [
                    [hx + screwOff, hy + screwOff],
                    [hx + housingW - screwOff, hy + screwOff],
                    [hx + screwOff, hy + housingH - screwOff],
                    [hx + housingW - screwOff, hy + housingH - screwOff]
                ];
                for (const [sx, sy] of screws) {
                    tg.ellipse(sx, sy, 6 * scale, 6 * scale);
                    // Screw slot
                    tg.stroke(30, 30, 35, 40);
                    tg.strokeWeight(0.8 * scale);
                    tg.line(sx - 2 * scale, sy, sx + 2 * scale, sy);
                    tg.noStroke();
                }

                // === Bottom teeth / edge ===
                const teethY = hy + housingH - 8 * scale;
                tg.fill(30, 40, 35, 40);
                tg.noStroke();
                for (let i = 0; i < 20; i++) {
                    const tx = hx + 30 * scale + i * (housingW - 60 * scale) / 20;
                    tg.rect(tx, teethY, 4 * scale, 6 * scale, 1 * scale);
                }

                // === Render ===
                p.background(0);
                p.image(tg, 0, 0);

                // FF effect glow on beat
                if (preset.ffEffect > 0) {
                    p.noStroke();
                    const glowHue = 180 + mid * 40;
                    p.colorMode(p.HSB, 360, 100, 100, 100);
                    p.fill(glowHue, 60, 80, preset.ffEffect * 12);
                    p.ellipse(leftReelX, reelY, leftTapeR * 3, leftTapeR * 3);
                    p.ellipse(rightReelX, reelY, rightTapeR * 3, rightTapeR * 3);
                    preset.ffEffect *= 0.9;
                    if (preset.ffEffect < 0.01) preset.ffEffect = 0;
                }

                // Subtle scanline overlay
                p.stroke(0, 0, 0, 8);
                p.strokeWeight(1);
                for (let y = 0; y < p.height; y += 4) {
                    p.line(0, y, p.width, y);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (preset.trailGfx) preset.trailGfx.remove();
                preset.trailGfx = p.createGraphics(p.width, p.height);
                preset.trailGfx.colorMode(preset.trailGfx.HSB, 360, 100, 100, 100);
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
        this.pendingBeats.push({ strength });
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['cassette-reel'] = CassetteReelPreset;
})();
