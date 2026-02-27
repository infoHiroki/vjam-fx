(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FilmCountdownPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;
            const RES = 4;
            let currentNum = 10;
            let numTimer = 0;
            let flashAlpha = 0;
            // Scratches persist across frames
            let scratches = [];
            for (let i = 0; i < 8; i++) {
                scratches.push({
                    x: Math.random(),
                    y: Math.random(),
                    len: 0.1 + Math.random() * 0.4,
                    alpha: 20 + Math.random() * 30,
                    drift: (Math.random() - 0.5) * 0.002
                });
            }

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.85;

                const w = pg.width;
                const h = pg.height;
                const cx = w / 2;
                const cy = h / 2;
                const minDim = Math.min(w, h);

                // Timer: count down 10 → 1, loop
                numTimer += speed * 0.5;
                if (numTimer > 60) {
                    numTimer = 0;
                    currentNum--;
                    if (currentNum < 1) currentNum = 10;
                    flashAlpha = 90;
                }
                flashAlpha *= 0.88;

                // Fraction through current number (0→1)
                const numFrac = numTimer / 60;

                // === Background: dark sepia film base ===
                pg.colorMode(pg.HSB, 360, 100, 100, 100);
                pg.background(35, 30, 6, 100);

                // === Film grain ===
                pg.noStroke();
                for (let i = 0; i < 60; i++) {
                    const gx = Math.random() * w;
                    const gy = Math.random() * h;
                    const gb = Math.random() * 20 + 3;
                    pg.fill(35, 10, gb, 35);
                    pg.rect(gx, gy, 1, 1);
                }

                // === Vertical film scratches ===
                pg.stroke(35, 15, 30, 20);
                pg.strokeWeight(0.5);
                for (const s of scratches) {
                    s.x += s.drift;
                    if (s.x < 0 || s.x > 1) s.drift *= -1;
                    const sx = s.x * w;
                    pg.stroke(35, 15, 30, s.alpha);
                    pg.line(sx, s.y * h, sx, (s.y + s.len) * h);
                }

                // === Sprocket side bands ===
                const bandW = w * 0.07;
                pg.fill(35, 20, 10, 70);
                pg.noStroke();
                pg.rect(0, 0, bandW, h);
                pg.rect(w - bandW, 0, bandW, h);

                // === Sprocket holes ===
                pg.fill(0, 0, 0, 85);
                const holeW = minDim * 0.022;
                const holeH = holeW * 1.5;
                const holeSpacing = h / 10;
                for (let i = 0; i < 10; i++) {
                    const hy2 = holeSpacing * i + holeSpacing * 0.5;
                    pg.rect(bandW * 0.3, hy2 - holeH / 2, holeW, holeH, 1);
                    pg.rect(w - bandW * 0.3 - holeW, hy2 - holeH / 2, holeW, holeH, 1);
                }

                // === Outer circle ===
                const circR = minDim * 0.40 + bass * minDim * 0.02;
                pg.noFill();
                pg.stroke(40, 35, 85, 80);
                pg.strokeWeight(2.5);
                pg.ellipse(cx, cy, circR * 2, circR * 2);

                // === Tick marks at each second (numbers 1-10 around circle) ===
                pg.strokeWeight(1);
                for (let i = 1; i <= 10; i++) {
                    // Marks at positions like a clock, starting from top
                    const ang = -p.HALF_PI + (i / 10) * p.TWO_PI;
                    const r1 = circR * 0.92;
                    const r2 = circR * 0.82;
                    // Highlight current number's mark
                    if (i === currentNum) {
                        pg.stroke(50, 70, 95, 90);
                        pg.strokeWeight(2);
                    } else {
                        pg.stroke(40, 30, 60, 50);
                        pg.strokeWeight(1);
                    }
                    pg.line(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1,
                            cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
                }

                // Small tick subdivisions
                pg.stroke(40, 25, 50, 30);
                pg.strokeWeight(0.5);
                for (let i = 0; i < 60; i++) {
                    const ang = (i / 60) * p.TWO_PI - p.HALF_PI;
                    const r1 = circR * 0.95;
                    const r2 = circR * 0.92;
                    pg.line(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1,
                            cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
                }

                // === Rotating sweep arm (clock hand) ===
                // Sweeps from current number to next number position
                const startAng = -p.HALF_PI + (currentNum / 10) * p.TWO_PI;
                const endAng = startAng + (1 / 10) * p.TWO_PI;
                const sweepAngle = startAng + numFrac * (endAng - startAng);

                pg.stroke(50, 60, 95, 80);
                pg.strokeWeight(1.5);
                pg.line(cx, cy, cx + Math.cos(sweepAngle) * circR * 0.88, cy + Math.sin(sweepAngle) * circR * 0.88);

                // Sweep dot at tip
                pg.fill(50, 70, 100, 90);
                pg.noStroke();
                pg.ellipse(cx + Math.cos(sweepAngle) * circR * 0.88,
                           cy + Math.sin(sweepAngle) * circR * 0.88, 3, 3);

                // === Inner circle ===
                pg.noFill();
                pg.stroke(40, 30, 55, 40);
                pg.strokeWeight(1);
                pg.ellipse(cx, cy, circR * 1.3, circR * 1.3);

                // === Cross-hairs ===
                pg.stroke(40, 25, 55, 35);
                pg.strokeWeight(0.5);
                pg.line(cx - circR * 0.12, cy, cx + circR * 0.12, cy);
                pg.line(cx, cy - circR * 0.12, cx, cy + circR * 0.12);

                // === Large centered number ===
                const numStr = String(currentNum);
                const fontSize = minDim * 0.45;
                pg.textAlign(pg.CENTER, pg.CENTER);
                pg.textSize(fontSize);
                pg.textStyle(pg.BOLD);

                // Number shadow
                pg.fill(35, 40, 20, 40);
                pg.noStroke();
                pg.text(numStr, cx + 1.5, cy + 1.5);

                // Number main — warm cream/amber color
                const numBrightness = 90 + pulse * 10;
                pg.fill(45, 35, numBrightness, 95);
                pg.text(numStr, cx, cy);

                // Number glow
                pg.fill(45, 50, 80, 10);
                pg.textSize(fontSize * 1.05);
                pg.text(numStr, cx, cy);
                pg.textStyle(pg.NORMAL);

                // === Corner registration marks ===
                const markLen = minDim * 0.06;
                const markOff = minDim * 0.03;
                pg.stroke(40, 30, 65, 50);
                pg.strokeWeight(1);
                // Top-left
                pg.line(bandW + markOff, markOff, bandW + markOff + markLen, markOff);
                pg.line(bandW + markOff, markOff, bandW + markOff, markOff + markLen);
                // Top-right
                pg.line(w - bandW - markOff, markOff, w - bandW - markOff - markLen, markOff);
                pg.line(w - bandW - markOff, markOff, w - bandW - markOff, markOff + markLen);
                // Bottom-left
                pg.line(bandW + markOff, h - markOff, bandW + markOff + markLen, h - markOff);
                pg.line(bandW + markOff, h - markOff, bandW + markOff, h - markOff - markLen);
                // Bottom-right
                pg.line(w - bandW - markOff, h - markOff, w - bandW - markOff - markLen, h - markOff);
                pg.line(w - bandW - markOff, h - markOff, w - bandW - markOff, h - markOff - markLen);

                // === Transition flash on number change ===
                if (flashAlpha > 1) {
                    pg.fill(45, 20, 100, flashAlpha);
                    pg.noStroke();
                    pg.rect(0, 0, w, h);
                }

                // === Beat flash ===
                if (pulse > 0.15) {
                    pg.fill(40, 15, 95, pulse * 30);
                    pg.noStroke();
                    pg.rect(0, 0, w, h);
                }

                // === Horizontal frame line flicker ===
                if (Math.random() < 0.03) {
                    const fy = Math.random() * h;
                    pg.stroke(35, 10, 50, 30);
                    pg.strokeWeight(1);
                    pg.line(0, fy, w, fy);
                }

                // === Render to main canvas ===
                p.background(0);
                p.image(pg, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
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
window.VJamFX.presets['film-countdown'] = FilmCountdownPreset;
})();
