(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class VinylGroovePreset extends BasePreset {
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

            p.draw = () => {
                const speed = preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;

                // Bass affects spin speed
                const spinSpeed = 0.006 * speed + bass * 0.012;
                const rotation = p.frameCount * spinSpeed;

                const w = pg.width;
                const h = pg.height;
                const cx = w / 2;
                const cy = h / 2;
                const maxR = Math.min(w, h) * 0.44;

                p.background(0);
                pg.background(0);

                // === Vinyl disc body (dark circle) ===
                pg.noStroke();
                pg.fill(0, 0, 8);
                pg.ellipse(cx, cy, maxR * 2.05, maxR * 2.05);

                // === Groove rings — concentric circles with subtle variation ===
                const grooveCount = 55;
                const labelR = maxR * 0.18;
                const grooveStart = labelR + 2;
                const grooveEnd = maxR - 2;
                const grooveSpacing = (grooveEnd - grooveStart) / grooveCount;

                pg.noFill();
                for (let i = 0; i < grooveCount; i++) {
                    const r = grooveStart + i * grooveSpacing;
                    const normalI = i / grooveCount;

                    // Every few grooves, slightly brighter (track gaps)
                    const isGap = (i % 7 === 0);
                    const baseBri = isGap ? 22 : 14;
                    const shimmer = Math.sin(rotation * 3 + i * 0.5) * 4;
                    const audioBri = mid * 8 + treble * 5;
                    const bri = baseBri + shimmer + audioBri;

                    const alpha = 50 + normalI * 20 + treble * 15;

                    pg.stroke(240, 5, bri, alpha);
                    pg.strokeWeight(isGap ? 0.3 : 0.6);
                    pg.ellipse(cx, cy, r * 2, r * 2);
                }

                // === Reflective highlight sweeps (rotate with disc) ===
                // Main highlight — bright arc that sweeps as vinyl spins
                for (let hi = 0; hi < 2; hi++) {
                    const hlAngle = rotation + hi * p.PI;
                    const hlSpread = 0.35 + pulse * 0.1;

                    // Draw multiple thin arcs for smooth highlight
                    for (let ri = 0; ri < 15; ri++) {
                        const r = grooveStart + (ri / 15) * (grooveEnd - grooveStart);
                        const distFromMid = Math.abs(ri - 7.5) / 7.5;
                        const hlAlpha = (25 + pulse * 20) * (1 - distFromMid * 0.6);

                        pg.noFill();
                        pg.stroke(200, 10, 70 + treble * 20, hlAlpha);
                        pg.strokeWeight(grooveSpacing * 0.8);
                        pg.arc(cx, cy, r * 2, r * 2, hlAngle - hlSpread, hlAngle + hlSpread);
                    }
                }

                // === Secondary subtle highlight (offset) ===
                {
                    const hl2Angle = rotation * 0.97 + p.PI * 0.6;
                    for (let ri = 0; ri < 10; ri++) {
                        const r = grooveStart + (ri / 10) * (grooveEnd - grooveStart);
                        pg.noFill();
                        pg.stroke(30, 15, 50 + mid * 15, 12);
                        pg.strokeWeight(grooveSpacing * 0.6);
                        pg.arc(cx, cy, r * 2, r * 2, hl2Angle - 0.2, hl2Angle + 0.2);
                    }
                }

                // === Outer rim ===
                pg.noFill();
                pg.stroke(0, 0, 25, 70);
                pg.strokeWeight(1.5);
                pg.ellipse(cx, cy, maxR * 2.02, maxR * 2.02);

                // Inner edge of rim — slight bevel highlight
                pg.stroke(200, 10, 35, 40);
                pg.strokeWeight(0.5);
                pg.ellipse(cx, cy, maxR * 1.98, maxR * 1.98);

                // === Label area (center) — neon colored ===
                const labelHue = 310; // magenta/pink neon
                pg.noStroke();
                // Label disc
                pg.fill(labelHue, 65, 55, 90);
                pg.ellipse(cx, cy, labelR * 2, labelR * 2);

                // Label ring decoration
                pg.noFill();
                pg.stroke(labelHue, 50, 75, 60);
                pg.strokeWeight(0.5);
                pg.ellipse(cx, cy, labelR * 1.6, labelR * 1.6);
                pg.ellipse(cx, cy, labelR * 1.2, labelR * 1.2);

                // Label neon glow
                pg.noStroke();
                pg.fill(labelHue, 60, 80, 25 + pulse * 20);
                pg.ellipse(cx, cy, labelR * 2.5, labelR * 2.5);

                // Spindle hole
                pg.fill(0, 0, 5, 95);
                pg.ellipse(cx, cy, labelR * 0.3, labelR * 0.3);

                // Label text dots (simulated text lines)
                pg.fill(labelHue, 30, 85, 70);
                for (let li = 0; li < 3; li++) {
                    const ly = cy - labelR * 0.25 + li * (labelR * 0.25);
                    const lw = labelR * (0.8 - li * 0.15);
                    pg.rect(cx - lw / 2, ly, lw, 1);
                }

                // === Tonearm — STATIONARY ===
                const armBaseX = w * 0.82;
                const armBaseY = h * 0.1;
                const armAngle = p.PI * 0.72; // fixed angle pointing toward record
                const armLen = maxR * 1.1;
                const armEndX = armBaseX + Math.cos(armAngle) * armLen;
                const armEndY = armBaseY + Math.sin(armAngle) * armLen;

                // Headshell at end (wider piece)
                const headLen = maxR * 0.12;
                const headEndX = armEndX + Math.cos(armAngle) * headLen;
                const headEndY = armEndY + Math.sin(armAngle) * headLen;

                // Arm shadow
                pg.stroke(0, 0, 10, 25);
                pg.strokeWeight(2.5);
                pg.line(armBaseX + 1, armBaseY + 2, armEndX + 1, armEndY + 2);

                // Main arm tube
                pg.stroke(0, 0, 55, 80);
                pg.strokeWeight(1.2);
                pg.line(armBaseX, armBaseY, armEndX, armEndY);

                // Headshell
                pg.stroke(0, 0, 65, 85);
                pg.strokeWeight(2);
                pg.line(armEndX, armEndY, headEndX, headEndY);

                // Cartridge
                pg.noStroke();
                pg.fill(0, 0, 45, 90);
                pg.rect(headEndX - 1.5, headEndY - 1, 3.5, 2.5);

                // Stylus tip (tiny bright point)
                pg.fill(0, 0, 90, 80);
                pg.ellipse(headEndX + 1, headEndY + 2, 1, 1);

                // Pivot base
                pg.noStroke();
                pg.fill(0, 0, 40, 85);
                pg.ellipse(armBaseX, armBaseY, 5, 5);
                pg.fill(0, 0, 55, 70);
                pg.ellipse(armBaseX, armBaseY, 3, 3);

                // === Beat pulse ring ===
                if (pulse > 0.15) {
                    pg.noFill();
                    pg.stroke(labelHue, 60, 90, pulse * 35);
                    pg.strokeWeight(1.5 + pulse * 2);
                    const pulseR = labelR + (maxR - labelR) * pulse * 0.6;
                    pg.ellipse(cx, cy, pulseR * 2, pulseR * 2);
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
window.VJamFX.presets['vinyl-groove'] = VinylGroovePreset;
})();
