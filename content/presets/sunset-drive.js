(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SunsetDrivePreset extends BasePreset {
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
            const RES = 3;
            let poles = [];
            let dashOffset = 0;
            let speedLines = [];
            let accelBoost = 0;

            const initPoles = (w, h, horizon) => {
                poles = [];
                for (let i = 0; i < 8; i++) {
                    poles.push({
                        z: i * 0.12 + Math.random() * 0.05,
                        side: i % 2 === 0 ? -1 : 1
                    });
                }
            };

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                initPoles(pg.width, pg.height, pg.height * 0.45);
                speedLines = [];
                for (let i = 0; i < 20; i++) {
                    speedLines.push({ x: Math.random(), y: 0.45 + Math.random() * 0.1, len: 5 + Math.random() * 15 });
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.01 * speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const rms = preset.audio.rms;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;

                const w = pg.width;
                const h = pg.height;
                const horizon = h * 0.45;
                const vanishX = w * 0.5;
                const baseSpeed = 1 + accelBoost;

                accelBoost *= 0.97;
                if (pulse > 0.3) accelBoost = 1.5 + pulse;

                pg.colorMode(p.HSB, 360, 100, 100, 100);

                // Sky gradient: sunset (hue 340->250, warm to cool)
                for (let y = 0; y < horizon; y++) {
                    const frac = y / horizon;
                    const hue = p.lerp(250, 340, frac * frac);
                    const sat = p.lerp(40, 70, frac);
                    const bri = p.lerp(15, 55, frac);
                    pg.stroke(hue, sat, bri, 100);
                    pg.line(0, y, w, y);
                }

                // Sun at horizon
                const sunR = w * 0.12 + bass * w * 0.02;
                const sunY = horizon + sunR * 0.1;
                // Sun glow
                pg.noStroke();
                for (let g = 3; g > 0; g--) {
                    pg.fill(40, 60, 70, 10 / g);
                    pg.ellipse(vanishX, sunY, sunR * (2 + g * 0.8), sunR * (1.2 + g * 0.5));
                }
                // Sun gradient body (top warm, bottom pink)
                for (let sy = -sunR / 2; sy < sunR / 2; sy += 1) {
                    const frac = (sy + sunR / 2) / sunR;
                    const hue = p.lerp(40, 340, frac);
                    const halfW = Math.sqrt(Math.max(0, (sunR / 2) ** 2 - sy * sy));
                    pg.stroke(hue, 70, 90, 90);
                    pg.line(vanishX - halfW, sunY + sy, vanishX + halfW, sunY + sy);
                }

                // Horizontal bands on sun (retro style)
                pg.noStroke();
                for (let i = 0; i < 5; i++) {
                    const bandY = sunY + (i - 2) * sunR * 0.15;
                    const bandW = Math.sqrt(Math.max(0, (sunR / 2) ** 2 - (bandY - sunY) ** 2)) * 2;
                    if (bandW > 0) {
                        pg.fill(260, 50, 20, 70);
                        pg.rect(vanishX - bandW / 2, bandY, bandW, 1);
                    }
                }

                // Ground/road
                pg.noStroke();
                pg.fill(270, 30, 8, 100);
                pg.rect(0, horizon, w, h - horizon);

                // Road edges (converging lines)
                const roadWidthBot = w * 0.5;
                const roadWidthTop = w * 0.02;
                pg.stroke(340, 50, 50, 60);
                pg.strokeWeight(1);
                pg.line(vanishX - roadWidthTop, horizon, vanishX - roadWidthBot / 2, h);
                pg.line(vanishX + roadWidthTop, horizon, vanishX + roadWidthBot / 2, h);

                // Dashed center line
                dashOffset = (dashOffset + 0.015 * baseSpeed * speed) % 1;
                const dashCount = 20;
                pg.stroke(55, 60, 90, 80);
                pg.strokeWeight(1);
                for (let i = 0; i < dashCount; i++) {
                    const frac = ((i / dashCount) + dashOffset) % 1;
                    const perspY = horizon + frac * frac * (h - horizon);
                    const nextFrac = ((i / dashCount) + dashOffset + 0.02) % 1;
                    const nextPerspY = horizon + nextFrac * nextFrac * (h - horizon);
                    if (i % 2 === 0 && perspY < h) {
                        const lineW = 0.5 + frac * 2;
                        pg.strokeWeight(lineW);
                        pg.line(vanishX, perspY, vanishX, Math.min(nextPerspY, h));
                    }
                }

                // Road-side poles
                for (let pole of poles) {
                    pole.z -= 0.004 * baseSpeed * speed;
                    if (pole.z < 0) pole.z += 1;
                    const frac = pole.z;
                    const perspY = horizon + frac * frac * (h - horizon);
                    const scale = frac * frac;
                    const poleX = vanishX + pole.side * (roadWidthTop + (roadWidthBot / 2 - roadWidthTop) * scale) * 1.1;
                    const poleH = 5 + scale * 25;

                    pg.stroke(270, 20, 30, 50 + scale * 40);
                    pg.strokeWeight(0.5 + scale * 1.5);
                    pg.line(poleX, perspY, poleX, perspY - poleH);
                }

                // Palm tree silhouettes (2 static, near horizon)
                const drawPalm = (px, groundY, size) => {
                    pg.stroke(270, 30, 5, 80);
                    pg.strokeWeight(size * 0.15);
                    pg.line(px, groundY, px + size * 0.1, groundY - size);
                    // Fronds
                    pg.strokeWeight(size * 0.06);
                    for (let f = 0; f < 5; f++) {
                        const angle = -p.PI * 0.15 + f * p.PI * 0.22 / 4 + Math.sin(t + f) * 0.05;
                        const fLen = size * (0.3 + f * 0.05);
                        const fx = px + size * 0.1 + Math.cos(angle) * fLen;
                        const fy = groundY - size + Math.sin(angle) * fLen * 0.3 - fLen * 0.4;
                        pg.noFill();
                        pg.bezier(
                            px + size * 0.1, groundY - size,
                            px + size * 0.1 + Math.cos(angle) * fLen * 0.3, groundY - size - fLen * 0.3,
                            fx - Math.cos(angle) * fLen * 0.1, fy + fLen * 0.1,
                            fx, fy + fLen * 0.3
                        );
                    }
                };
                drawPalm(w * 0.12, horizon + 2, w * 0.15);
                drawPalm(w * 0.82, horizon + 3, w * 0.12);

                // Speed lines (horizontal streaks near horizon)
                pg.strokeWeight(0.5);
                for (let sl of speedLines) {
                    const slLen = sl.len * baseSpeed;
                    const sx = sl.x * w;
                    const sy = sl.y * h;
                    const alpha = 15 + accelBoost * 15;
                    pg.stroke(340, 40, 60, alpha);
                    pg.line(sx, sy, sx + slLen, sy);
                    sl.x -= 0.002 * baseSpeed * speed;
                    if (sl.x < -0.1) { sl.x = 1.1; sl.y = 0.42 + Math.random() * 0.08; }
                }

                // Glow at horizon
                pg.noStroke();
                for (let g = 2; g > 0; g--) {
                    pg.fill(340, 50, 40, 6 / g);
                    pg.rect(0, horizon - g * 5, w, g * 10);
                }

                // Beat: acceleration flash
                if (pulse > 0.4) {
                    pg.fill(340, 40, 80, pulse * 12);
                    pg.noStroke();
                    pg.rect(0, horizon, w, h - horizon);
                }

                // Stars in upper sky
                pg.noStroke();
                for (let i = 0; i < 30; i++) {
                    const sx = p.noise(i * 20, 0) * w;
                    const sy = p.noise(i * 20, 100) * horizon * 0.6;
                    const twinkle = Math.sin(t * 2 + i * 3) * 0.3 + 0.7;
                    pg.fill(240, 10, 70 * twinkle, 50);
                    pg.ellipse(sx, sy, 0.8, 0.8);
                }

                p.image(pg, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                initPoles(pg.width, pg.height, pg.height * 0.45);
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
window.VJamFX.presets['sunset-drive'] = SunsetDrivePreset;
})();
