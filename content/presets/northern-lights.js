(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class NorthernLightsPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            const NUM_CURTAINS = 9;
            const STAR_COUNT = 60;
            let stars = [];

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                initStars();
            };

            function initStars() {
                stars = [];
                for (let i = 0; i < STAR_COUNT; i++) {
                    stars.push({
                        x: Math.random() * p.width,
                        y: Math.random() * p.height * 0.5,
                        size: 0.5 + Math.random() * 2,
                        twinkleSpeed: 1 + Math.random() * 3,
                        twinkleOffset: Math.random() * p.TWO_PI,
                    });
                }
            }

            p.draw = () => {
                p.background(0);
                const t = p.frameCount * 0.008 * preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;

                const w = p.width;
                const h = p.height;

                // --- Dim stars in background ---
                p.noStroke();
                for (const s of stars) {
                    const twinkle = 0.3 + 0.7 * ((Math.sin(t * s.twinkleSpeed + s.twinkleOffset) + 1) * 0.5);
                    p.fill(200, 10, 70 * twinkle, 40 * twinkle);
                    p.ellipse(s.x, s.y, s.size, s.size);
                }

                // --- Aurora curtains ---
                // Each curtain is a filled shape using curveVertex for smooth flowing
                const curtainConfigs = [
                    { baseHue: 130, yCenter: 0.22, speed: 1.0, amp: 0.7, alpha: 20 },
                    { baseHue: 160, yCenter: 0.28, speed: 0.7, amp: 0.9, alpha: 16 },
                    { baseHue: 270, yCenter: 0.18, speed: 1.3, amp: 0.6, alpha: 18 },
                    { baseHue: 300, yCenter: 0.33, speed: 0.5, amp: 1.0, alpha: 14 },
                    { baseHue: 190, yCenter: 0.25, speed: 0.9, amp: 0.8, alpha: 18 },
                    { baseHue: 140, yCenter: 0.15, speed: 1.1, amp: 0.8, alpha: 16 },
                    { baseHue: 220, yCenter: 0.30, speed: 0.6, amp: 0.7, alpha: 14 },
                    { baseHue: 280, yCenter: 0.20, speed: 1.4, amp: 0.5, alpha: 16 },
                    { baseHue: 170, yCenter: 0.35, speed: 0.8, amp: 0.9, alpha: 14 },
                ];

                for (let c = 0; c < NUM_CURTAINS; c++) {
                    const cfg = curtainConfigs[c];
                    const segments = 50;

                    // Draw multiple vertical bands per curtain for vertical structure
                    const bandCount = 3;
                    for (let b = 0; b < bandCount; b++) {
                        const bandOffset = (b - 1) * 0.03;

                        p.noStroke();
                        p.beginShape();

                        // Top edge: flowing curve
                        for (let i = 0; i <= segments; i++) {
                            const frac = i / segments;
                            const x = frac * w;

                            // Multi-octave noise for organic wave
                            const n1 = p.noise(frac * 2 + c * 3.7 + bandOffset, t * cfg.speed * 0.3);
                            const n2 = p.noise(frac * 4 + c * 1.3 + bandOffset, t * cfg.speed * 0.7 + 100);
                            const wave = (n1 * 0.7 + n2 * 0.3 - 0.5) * cfg.amp;

                            // Bass affects amplitude, pulse pushes curtain lower
                            const yDisp = wave * h * 0.25 * (1 + bass * 0.8 + pulse * 0.3);
                            const y = h * cfg.yCenter + yDisp;

                            // Vertical extent of curtain at this x
                            const curtainHeight = h * (0.3 + 0.25 * p.noise(frac * 1.5 + c * 2, t * 0.2) +
                                bass * 0.15 + pulse * 0.1);

                            // Color shift along x
                            const hue = (cfg.baseHue + frac * 30 + treble * 25 +
                                Math.sin(t * 0.5 + frac * 4) * 15) % 360;
                            const sat = 55 + mid * 30 + b * 5;
                            const bri = 35 + 30 * p.noise(frac * 3 + c, t * 0.4) +
                                pulse * 25 + bass * 15;
                            const alpha = cfg.alpha + pulse * 12 + b * (-3);

                            // Draw vertical band as thin rect at each segment
                            const bandW = (w / segments) * 1.4;
                            p.fill(hue, Math.min(100, sat), Math.min(100, bri), Math.min(60, alpha));
                            p.rect(x - bandW * 0.5, y - curtainHeight * 0.3, bandW, curtainHeight);
                        }

                        p.endShape();
                    }

                    // Bright edge line along the top of curtain (characteristic aurora feature)
                    p.noFill();
                    p.strokeWeight(1.5 + pulse * 1.5 + bass * 1);
                    const edgeHue = (cfg.baseHue + treble * 20) % 360;
                    p.stroke(edgeHue, 50, 70 + pulse * 25, 30 + pulse * 15);
                    p.beginShape();
                    for (let i = 0; i <= segments; i++) {
                        const frac = i / segments;
                        const x = frac * w;
                        const n1 = p.noise(frac * 2 + c * 3.7, t * cfg.speed * 0.3);
                        const n2 = p.noise(frac * 4 + c * 1.3, t * cfg.speed * 0.7 + 100);
                        const wave = (n1 * 0.7 + n2 * 0.3 - 0.5) * cfg.amp;
                        const yDisp = wave * h * 0.25 * (1 + bass * 0.8 + pulse * 0.3);
                        const y = h * cfg.yCenter + yDisp;

                        const curtainHeight = h * (0.15 + 0.15 * p.noise(frac * 1.5 + c * 2, t * 0.2) +
                            bass * 0.1 + pulse * 0.05);

                        p.curveVertex(x, y - curtainHeight * 0.3);
                    }
                    p.endShape();
                    p.noStroke();
                }

                // --- Vertical rays (characteristic aurora vertical streaks) ---
                const rayCount = 25 + Math.floor(bass * 15);
                for (let i = 0; i < rayCount; i++) {
                    const rx = p.noise(i * 0.7, t * 0.15) * w;
                    const rayTop = h * (0.1 + p.noise(i * 1.3, t * 0.2) * 0.2);
                    const rayBot = rayTop + h * (0.25 + p.noise(i * 0.9, t * 0.3) * 0.35 + bass * 0.15);
                    const rayW = 2 + p.noise(i * 2, t * 0.5) * 6 + pulse * 3;

                    const hue = (130 + p.noise(i * 0.5, t * 0.1) * 170) % 360;
                    const bri = 25 + p.noise(i * 1.7, t * 0.6) * 30 + pulse * 15;
                    const alpha = 6 + p.noise(i * 0.3, t * 0.4) * 10 + pulse * 5;

                    // Gradient from bright top to fading bottom
                    const gradSteps = 6;
                    for (let g = 0; g < gradSteps; g++) {
                        const gFrac = g / gradSteps;
                        const gy = rayTop + (rayBot - rayTop) * gFrac;
                        const gH = (rayBot - rayTop) / gradSteps * 1.3;
                        const fadeAlpha = alpha * (1 - gFrac * 0.7);
                        const fadeBri = bri * (1 - gFrac * 0.4);
                        p.fill(hue, 60, Math.min(100, fadeBri), Math.min(40, fadeAlpha));
                        p.rect(rx - rayW * 0.5, gy, rayW, gH);
                    }
                }

                // --- Beat: bright surge across the aurora ---
                if (pulse > 0.3) {
                    const surgeY = h * 0.3;
                    const surgeH = h * 0.2 * pulse;
                    for (let i = 0; i < 3; i++) {
                        const sHue = [140, 270, 190][i];
                        const sx = w * 0.1 + Math.random() * w * 0.8;
                        p.fill(sHue, 40, 80, pulse * 10);
                        p.ellipse(sx, surgeY, w * 0.4 * pulse, surgeH);
                    }
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                initStars();
            };
        }, container);
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
    }
}

window.VJamFX.presets['northern-lights'] = NorthernLightsPreset;
})();
