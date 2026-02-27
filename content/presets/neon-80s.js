(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class Neon80sPreset extends BasePreset {
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

            const drawPalm = (x, y, scale, lean) => {
                // Trunk with slight curve
                pg.noFill();
                pg.stroke(0, 0, 6, 90);
                pg.strokeWeight(scale * 0.12);
                const topX = x + lean * scale * 0.2;
                const topY = y - scale;
                const midX = x + lean * scale * 0.08;
                const midY = y - scale * 0.5;
                pg.bezier(x, y, midX, midY, midX, midY - scale * 0.2, topX, topY);

                // Trunk highlight
                pg.stroke(30, 30, 15, 30);
                pg.strokeWeight(scale * 0.04);
                pg.bezier(x + 1, y, midX + 1, midY, midX + 1, midY - scale * 0.2, topX + 1, topY);

                // Fronds - more of them, with droop
                pg.noFill();
                pg.strokeWeight(scale * 0.035);
                pg.stroke(0, 0, 5, 90);
                const frondCount = 9;
                for (let i = 0; i < frondCount; i++) {
                    const angle = -p.PI * 0.15 + (i / (frondCount - 1)) * p.PI * 1.3;
                    const len = scale * (0.5 + p.noise(i * 2.3) * 0.25);
                    const droopFactor = 0.4 + Math.abs(Math.cos(angle)) * 0.3;
                    const ex = topX + Math.cos(angle) * len;
                    const ey = topY + Math.sin(angle) * len * droopFactor + len * 0.15;

                    pg.bezier(
                        topX, topY,
                        topX + Math.cos(angle) * len * 0.4, topY + Math.sin(angle) * len * 0.1,
                        topX + Math.cos(angle) * len * 0.7, ey - len * 0.05,
                        ex, ey
                    );

                    // Leaf details along frond
                    const leafCount = 5;
                    pg.strokeWeight(scale * 0.015);
                    for (let l = 1; l <= leafCount; l++) {
                        const lf = l / (leafCount + 1);
                        const lx = p.lerp(topX, ex, lf);
                        const ly = p.lerp(topY, ey, lf);
                        const leafLen = len * 0.12 * (1 - lf * 0.5);
                        const side = (l % 2 === 0) ? 1 : -1;
                        const leafAngle = angle + side * 0.6;
                        pg.line(lx, ly, lx + Math.cos(leafAngle) * leafLen, ly + Math.sin(leafAngle) * leafLen * 0.5 + leafLen * 0.3);
                    }
                    pg.strokeWeight(scale * 0.035);
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.01 * speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;

                const w = pg.width;
                const h = pg.height;
                const horizon = h * 0.52;

                // Sky gradient - richer sunset colors
                for (let y = 0; y < horizon; y++) {
                    const frac = y / horizon;
                    let hue, sat, bri;
                    if (frac < 0.4) {
                        // Deep navy to purple
                        hue = p.lerp(240, 270, frac / 0.4);
                        sat = p.lerp(70, 60, frac / 0.4);
                        bri = p.lerp(8, 20, frac / 0.4);
                    } else if (frac < 0.7) {
                        // Purple to magenta
                        const f2 = (frac - 0.4) / 0.3;
                        hue = p.lerp(270, 320, f2);
                        sat = p.lerp(60, 75, f2);
                        bri = p.lerp(20, 35, f2);
                    } else {
                        // Magenta to warm orange near horizon
                        const f3 = (frac - 0.7) / 0.3;
                        hue = p.lerp(320, 350, f3);
                        sat = p.lerp(75, 85, f3);
                        bri = p.lerp(35, 50 + pulse * 10, f3);
                    }
                    pg.stroke(hue, sat, bri, 100);
                    pg.line(0, y, w, y);
                }

                // Sun at horizon - bigger, more layers
                const sunX = w / 2;
                const sunY = horizon - 1;
                const sunR = 32 + pulse * 12 + bass * 10;

                // Sun glow rings
                pg.noStroke();
                for (let i = 5; i > 0; i--) {
                    const a = 15 / i;
                    pg.fill((350 + i * 8) % 360, 60, 80, a);
                    pg.ellipse(sunX, sunY, sunR * (1 + i * 0.7), sunR * (1 + i * 0.5));
                }

                // Sun body - smooth gradient with warm tones
                for (let r = sunR; r > 0; r -= 1) {
                    const frac = r / sunR;
                    const hue = p.lerp(50, 340, frac * frac);
                    const sat = p.lerp(90, 75, frac);
                    const bri = 95 + pulse * 5;
                    pg.fill(hue, sat, bri, 95);
                    pg.ellipse(sunX, sunY, r * 2, r * 2);
                }

                // Sun horizontal stripe cutouts (classic 80s look)
                pg.noStroke();
                for (let i = 0; i < 7; i++) {
                    const sy = sunY + (i - 3) * (sunR * 0.13);
                    const distFromCenter = Math.abs(sy - sunY);
                    const sw = Math.sqrt(Math.max(0, sunR * sunR - distFromCenter * distFromCenter)) * 2;
                    if (sw > 2 && i > 2) {
                        const gapH = 1 + (i - 2) * 0.4;
                        pg.fill(260, 60, 12, 90);
                        pg.rect(sunX - sw / 2, sy, sw, gapH);
                    }
                }

                // Ground
                pg.fill(260, 70, 6, 100);
                pg.noStroke();
                pg.rect(0, horizon, w, h - horizon);

                // Perspective grid - more detailed
                const gridScroll = (t * 3) % 1;
                const numH = 28;
                const numV = 20;

                // Horizontal lines with perspective compression
                for (let i = 0; i < numH; i++) {
                    const frac = (i / numH + gridScroll / numH) % 1;
                    const yFrac = frac * frac;
                    const y = horizon + yFrac * (h - horizon);
                    const alpha = 30 + yFrac * 60 + pulse * 25;
                    const bri = 75 + pulse * 20 + bass * 15;

                    // Glow
                    pg.stroke(320, 60, bri, alpha * 0.25);
                    pg.strokeWeight(2.5);
                    pg.line(0, y, w, y);
                    // Main
                    pg.stroke(320, 85, bri, alpha);
                    pg.strokeWeight(0.7);
                    pg.line(0, y, w, y);
                }

                // Vertical lines converging to vanishing point
                for (let i = -numV / 2; i <= numV / 2; i++) {
                    const bottomX = w / 2 + i * (w / numV) * 1.8;
                    const alpha = 30 + treble * 30 + pulse * 20;
                    const bri = 65 + treble * 25;

                    // Glow
                    pg.stroke(230, 50, bri, alpha * 0.25);
                    pg.strokeWeight(2.5);
                    pg.line(w / 2, horizon, bottomX, h);
                    // Main
                    pg.stroke(230, 80, bri, alpha);
                    pg.strokeWeight(0.7);
                    pg.line(w / 2, horizon, bottomX, h);
                }

                // Side glow at grid edges (neon effect)
                pg.noStroke();
                pg.fill(300, 70, 50, 8 + pulse * 10);
                pg.rect(0, horizon, w * 0.06, h - horizon);
                pg.rect(w * 0.94, horizon, w * 0.06, h - horizon);

                // Palm tree silhouettes - bigger, with more detail
                drawPalm(w * 0.06, horizon + 2, h * 0.32, -0.3);
                drawPalm(w * 0.94, horizon + 2, h * 0.26, 0.3);
                // Distant palm
                drawPalm(w * 0.18, horizon + 2, h * 0.14, -0.1);

                // Stars with twinkling
                pg.noStroke();
                for (let i = 0; i < 50; i++) {
                    const sx = p.noise(i * 3.7) * w;
                    const sy = p.noise(i * 5.1) * horizon * 0.6;
                    const twinkle = 25 + Math.sin(t * 4 + i * 1.7) * 20 + Math.sin(t * 7 + i * 3.1) * 10;
                    const size = 0.5 + p.noise(i * 2.1) * 0.8;
                    pg.fill(240, 15, 90, twinkle);
                    pg.ellipse(sx, sy, size, size);
                }

                // Shooting star (occasional)
                const shootCycle = (p.frameCount * 0.003) % 1;
                if (shootCycle < 0.05) {
                    const sf = shootCycle / 0.05;
                    const sx1 = w * 0.7 + sf * w * 0.25;
                    const sy1 = horizon * 0.1 + sf * horizon * 0.3;
                    pg.stroke(180, 20, 95, 60 * (1 - sf));
                    pg.strokeWeight(1);
                    pg.line(sx1, sy1, sx1 - 8, sy1 - 3);
                }

                // Mountain silhouette line at horizon
                pg.noFill();
                pg.stroke(270, 50, 18, 60);
                pg.strokeWeight(1);
                pg.beginShape();
                for (let x = 0; x <= w; x += 3) {
                    const mh = p.noise(x * 0.02 + 100) * h * 0.06;
                    pg.vertex(x, horizon - mh);
                }
                pg.endShape();

                // Beat grid flash
                if (pulse > 0.3) {
                    pg.noStroke();
                    pg.fill(320, 60, 85, pulse * 18);
                    pg.rect(0, horizon, w, h - horizon);
                }

                // Scanlines overlay (subtle)
                for (let y = 0; y < h; y += 3) {
                    pg.stroke(0, 0, 0, 8);
                    pg.strokeWeight(0.5);
                    pg.line(0, y, w, y);
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
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['neon-80s'] = Neon80sPreset;
})();
