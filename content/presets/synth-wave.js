(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SynthWavePreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.RGB, 255);
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.92;

                const w = p.width;
                const h = p.height;
                const t = p.frameCount;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                const horizon = h * 0.5;

                // --- Large sunset gradient (fills upper half) ---
                // Deep purple top -> magenta -> warm orange at horizon
                p.noStroke();
                const skySteps = 30;
                for (let i = 0; i < skySteps; i++) {
                    const frac = i / skySteps;
                    const y1 = frac * horizon;
                    const y2 = (frac + 1 / skySteps) * horizon + 1;
                    let r, g, b;
                    if (frac < 0.5) {
                        // Top half: deep indigo to magenta
                        const f = frac * 2;
                        r = p.lerp(8, 120, f);
                        g = p.lerp(2, 20, f);
                        b = p.lerp(40, 80, f);
                    } else {
                        // Bottom half: magenta to warm orange
                        const f = (frac - 0.5) * 2;
                        r = p.lerp(120, 255, f);
                        g = p.lerp(20, 80 + bass * 30, f);
                        b = p.lerp(80, 20, f);
                    }
                    p.fill(r, g, b);
                    p.rect(0, y1, w, y2 - y1);
                }

                // --- Large sunset circle (clipped to above horizon) ---
                const sunX = w / 2;
                const sunRadius = h * 0.22 + pulse * 10;
                const sunY = horizon - sunRadius * 0.3;

                // Outer glow
                p.noStroke();
                for (let i = 3; i >= 0; i--) {
                    const glowR = sunRadius + i * 25;
                    p.fill(255, 60, 150, 12 - i * 2);
                    p.ellipse(sunX, sunY, glowR * 2, glowR * 2);
                }

                // Sun body drawn as horizontal lines (clipped to above horizon)
                for (let y = -sunRadius; y <= sunRadius; y += 2) {
                    const sy = sunY + y;
                    if (sy >= horizon || sy < 0) continue;
                    const halfW = Math.sqrt(Math.max(0, sunRadius * sunRadius - y * y));
                    const frac = (y + sunRadius) / (sunRadius * 2);
                    const r = 255;
                    const g = p.lerp(240, 40, frac);
                    const b = p.lerp(80, 180, frac);
                    p.stroke(r, g, b, 230);
                    p.strokeWeight(2);
                    p.line(sunX - halfW, sy, sunX + halfW, sy);
                }

                // Sun horizontal stripe cutouts
                p.noStroke();
                const stripeCount = 7;
                for (let i = 0; i < stripeCount; i++) {
                    const frac = (i + 1) / (stripeCount + 1);
                    const sy = sunY - sunRadius + frac * sunRadius * 2;
                    if (sy >= horizon) continue;
                    const stripeH = 2 + i * 1.2;
                    // Match sky color at that Y position
                    const skyFrac = sy / horizon;
                    let sr, sg, sb;
                    if (skyFrac < 0.5) {
                        const f = skyFrac * 2;
                        sr = p.lerp(8, 120, f);
                        sg = p.lerp(2, 20, f);
                        sb = p.lerp(40, 80, f);
                    } else {
                        const f = (skyFrac - 0.5) * 2;
                        sr = p.lerp(120, 255, f);
                        sg = p.lerp(20, 80, f);
                        sb = p.lerp(80, 20, f);
                    }
                    p.fill(sr, sg, sb);
                    p.rect(sunX - sunRadius, sy, sunRadius * 2, stripeH);
                }

                // --- Cityscape silhouette along horizon ---
                p.fill(5, 2, 15);
                p.noStroke();
                // Seed-based buildings so they stay consistent
                const buildingCount = 24;
                for (let i = 0; i < buildingCount; i++) {
                    const bx = (i / buildingCount) * w - w * 0.02;
                    const bw = w / buildingCount * 1.1;
                    // Pseudo-random height from index
                    const seed = Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5;
                    const bh = 15 + seed * 70 + (i % 3 === 0 ? 30 : 0);
                    p.rect(bx, horizon - bh, bw, bh + 2);
                    // Window lights on taller buildings
                    if (bh > 40) {
                        const winHue = Math.sin(i * 43.1) > 0 ? 180 : 40;
                        for (let wy = horizon - bh + 6; wy < horizon - 4; wy += 8) {
                            for (let wx = bx + 3; wx < bx + bw - 3; wx += 6) {
                                const lit = Math.sin(i * 17 + wx * 3 + wy * 7) > 0.2;
                                if (lit) {
                                    const wAlpha = 120 + Math.sin(t * 0.02 + wx + wy) * 40;
                                    p.fill(255, winHue, 50, wAlpha);
                                    p.rect(wx, wy, 3, 4);
                                }
                            }
                        }
                        p.fill(5, 2, 15);
                    }
                }

                // --- Ground fill ---
                p.fill(5, 2, 15);
                p.noStroke();
                p.rect(0, horizon, w, h - horizon);

                // --- Scrolling perspective grid ---
                const gridScroll = (t * 0.015 + pulse * 0.3) % 1;

                // Horizontal lines — scrolling toward viewer
                const hLineCount = 18;
                for (let i = 0; i < hLineCount; i++) {
                    const rawFrac = (i / hLineCount + gridScroll / hLineCount) % 1;
                    const perspFrac = rawFrac * rawFrac;
                    const y = horizon + perspFrac * (h - horizon);
                    const alpha = 50 + perspFrac * 150 + pulse * 50;
                    p.stroke(255, 0, 220, Math.min(255, alpha));
                    p.strokeWeight(1);
                    p.line(0, y, w, y);
                }

                // Vertical lines converging to vanishing point
                const vLineCount = 18;
                for (let i = -vLineCount / 2; i <= vLineCount / 2; i++) {
                    const bottomX = w / 2 + i * (w / (vLineCount * 0.7));
                    const topX = w / 2 + i * 8;
                    const alpha = 100 - Math.abs(i) * 3 + pulse * 30;
                    p.stroke(0, 220, 255, Math.min(255, Math.max(0, alpha)));
                    p.strokeWeight(1);
                    p.line(topX, horizon, bottomX, h);
                }

                // Horizon glow line
                p.stroke(0, 255, 255, 80 + pulse * 60);
                p.strokeWeight(2);
                p.line(0, horizon, w, horizon);

                // Beat flash on ground
                if (pulse > 0.3) {
                    p.noStroke();
                    p.fill(255, 0, 200, pulse * 25);
                    p.rect(0, horizon, w, h - horizon);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
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
window.VJamFX.presets['synth-wave'] = SynthWavePreset;
})();
