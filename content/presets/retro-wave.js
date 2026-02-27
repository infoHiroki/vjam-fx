(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class RetroWavePreset extends BasePreset {
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
            let stars = [];

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                // Generate stars
                stars = [];
                for (let i = 0; i < 120; i++) {
                    stars.push({
                        x: Math.random() * p.width,
                        y: Math.random() * p.height * 0.45,
                        size: Math.random() * 2 + 0.5,
                        bri: Math.random() * 150 + 105
                    });
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.01 * speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;

                const w = p.width;
                const h = p.height;
                const horizon = h * 0.5;

                // --- Sky gradient (top half) ---
                for (let y = 0; y < horizon; y++) {
                    const frac = y / horizon;
                    // Dark purple at top -> orange at horizon
                    const r = p.lerp(20, 255, frac * frac);
                    const g = p.lerp(5, 100, frac * frac * frac);
                    const b = p.lerp(60, 40, frac);
                    p.stroke(r, g, b);
                    p.line(0, y, w, y);
                }

                // --- Stars ---
                p.noStroke();
                for (const star of stars) {
                    const twinkle = Math.sin(t * 3 + star.x * 0.1) * 30;
                    p.fill(255, 255, 255, star.bri + twinkle);
                    p.ellipse(star.x, star.y, star.size, star.size);
                }

                // --- Sun ---
                const sunY = horizon - 10;
                const sunR = 60 + pulse * 20 + bass * 15;
                // Sun glow
                p.noStroke();
                for (let i = 3; i > 0; i--) {
                    const alpha = 30 / i;
                    p.fill(255, 100, 50, alpha);
                    p.ellipse(w / 2, sunY, sunR * (1 + i * 0.5), sunR * (1 + i * 0.5));
                }
                // Sun body with horizontal stripe cutouts
                p.fill(255, 80, 30);
                p.ellipse(w / 2, sunY, sunR, sunR);
                // Stripe cutouts
                p.fill(0, 0, 0, 0);
                const stripeCount = 5;
                for (let i = 0; i < stripeCount; i++) {
                    const sy = sunY + (i - stripeCount / 2) * (sunR / stripeCount) * 0.6;
                    const sw = Math.sqrt(Math.max(0, (sunR / 2) ** 2 - (sy - sunY) ** 2)) * 2;
                    if (sw > 0) {
                        p.fill(20, 5, 60); // match sky bottom color
                        p.rect(w / 2 - sw / 2, sy, sw, 2);
                    }
                }

                // --- Ground (bottom half): perspective grid ---
                p.fill(10, 5, 30);
                p.noStroke();
                p.rect(0, horizon, w, h - horizon);

                const gridSpeed = (t * 2 + pulse * 3) % 1;
                const numHLines = 20;
                const vanishX = w / 2;

                // Horizontal grid lines (perspective)
                p.stroke(255, 0, 180, 120 + bass * 80);
                p.strokeWeight(1);
                for (let i = 0; i < numHLines; i++) {
                    const frac = (i / numHLines + gridSpeed / numHLines) % 1;
                    // Exponential spacing for perspective
                    const yFrac = frac * frac;
                    const y = horizon + yFrac * (h - horizon);
                    const alpha = 60 + yFrac * 160;
                    p.stroke(255, 0, 180, alpha);
                    p.line(0, y, w, y);
                }

                // Vertical grid lines (converge at vanishing point)
                const numVLines = 16;
                p.stroke(0, 200, 255, 100 + treble * 80);
                for (let i = -numVLines / 2; i <= numVLines / 2; i++) {
                    const bottomX = vanishX + i * (w / numVLines) * 1.5;
                    p.line(vanishX, horizon, bottomX, h);
                }

                // Beat: grid flash
                if (pulse > 0.3) {
                    p.noStroke();
                    p.fill(255, 0, 180, pulse * 30);
                    p.rect(0, horizon, w, h - horizon);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                // Regenerate stars for new size
                stars = [];
                for (let i = 0; i < 120; i++) {
                    stars.push({
                        x: Math.random() * p.width,
                        y: Math.random() * p.height * 0.45,
                        size: Math.random() * 2 + 0.5,
                        bri: Math.random() * 150 + 105
                    });
                }
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
window.VJamFX.presets['retro-wave'] = RetroWavePreset;
})();
