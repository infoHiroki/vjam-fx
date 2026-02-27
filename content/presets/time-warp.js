(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class TimeWarpPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.warpSpeed = 1;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;
            const RES = 3;

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
                const t = p.frameCount * 0.012 * speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;

                preset.warpSpeed += (1 - preset.warpSpeed) * 0.03;
                const warp = preset.warpSpeed;

                const w = pg.width;
                const h = pg.height;
                const cx = w / 2;
                const cy = h / 2;

                pg.background(0, 0, 3, 12);

                const shapeCount = 22;
                const maxR = Math.min(w, h) * 0.48;

                // Tunnel shapes zooming toward viewer
                for (let i = 0; i < shapeCount; i++) {
                    const phase = (t * warp * 0.5 + i / shapeCount) % 1;
                    const z = 1 - phase;
                    const radius = maxR * phase * phase;
                    const alpha = (1 - z * z) * 70 + mid * 20;

                    if (alpha < 5 || radius < 2) continue;

                    const hue = (30 + i * 2 + phase * 15) % 360;
                    const sat = 50 + bass * 20;
                    const bri = 50 + phase * 40 + treble * 15;
                    const sw = 0.8 + phase * 1.5;

                    pg.noFill();
                    pg.stroke(hue, sat, bri, alpha);
                    pg.strokeWeight(sw);

                    // Alternating circle / hexagon
                    if (i % 2 === 0) {
                        pg.ellipse(cx, cy, radius * 2, radius * 2);
                        // Glow
                        pg.stroke(hue, sat * 0.7, bri, alpha * 0.3);
                        pg.strokeWeight(sw * 2.5);
                        pg.ellipse(cx, cy, radius * 2, radius * 2);
                    } else {
                        pg.beginShape();
                        for (let v = 0; v < 6; v++) {
                            const angle = (v / 6) * p.TWO_PI - p.HALF_PI + t * 0.1;
                            pg.vertex(
                                cx + Math.cos(angle) * radius,
                                cy + Math.sin(angle) * radius
                            );
                        }
                        pg.endShape(p.CLOSE);
                        // Glow
                        pg.stroke(hue, sat * 0.7, bri, alpha * 0.3);
                        pg.strokeWeight(sw * 2.5);
                        pg.beginShape();
                        for (let v = 0; v < 6; v++) {
                            const angle = (v / 6) * p.TWO_PI - p.HALF_PI + t * 0.1;
                            pg.vertex(
                                cx + Math.cos(angle) * radius,
                                cy + Math.sin(angle) * radius
                            );
                        }
                        pg.endShape(p.CLOSE);
                    }
                }

                // Orbiting time numbers — digits spiral outward
                pg.textAlign(pg.CENTER, pg.CENTER);
                pg.textSize(3 + bass * 2);
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * p.TWO_PI + t * 0.3 * (i % 2 === 0 ? 1 : -1);
                    const dist = maxR * (0.08 + 0.12 * (i / 12) + Math.sin(t + i) * 0.03);
                    const nx = cx + Math.cos(a) * dist;
                    const ny = cy + Math.sin(a) * dist;
                    const numAlpha = 35 + Math.sin(t * 2 + i * 0.5) * 15 + mid * 15;
                    const numHue = (30 + i * 3 + t * 10) % 360;
                    pg.noStroke();
                    pg.fill(numHue, 50, 85, numAlpha);
                    pg.text((i + 1).toString(), nx, ny);
                }

                // Center warp vortex — pulsing core
                const coreR = 3 + pulse * 5 + bass * 3;
                pg.noStroke();
                pg.fill(35, 60, 90, 25);
                pg.ellipse(cx, cy, coreR * 3, coreR * 3);
                pg.fill(30, 50, 95, 50);
                pg.ellipse(cx, cy, coreR, coreR);

                // Radial streaks on beat
                if (pulse > 0.2) {
                    pg.stroke(35, 50, 80, pulse * 40);
                    pg.strokeWeight(1);
                    for (let i = 0; i < 16; i++) {
                        const a = (i / 16) * p.TWO_PI + t;
                        const r1 = maxR * 0.2;
                        const r2 = maxR * (0.5 + pulse * 0.4);
                        pg.line(
                            cx + Math.cos(a) * r1, cy + Math.sin(a) * r1,
                            cx + Math.cos(a) * r2, cy + Math.sin(a) * r2
                        );
                    }
                }

                // Floating time particles
                pg.noStroke();
                for (let i = 0; i < 15; i++) {
                    const angle = t * 0.3 + i * 0.42;
                    const dist = maxR * (0.2 + p.noise(i * 5, t * 0.15) * 0.7);
                    const px = cx + Math.cos(angle) * dist;
                    const py = cy + Math.sin(angle) * dist;
                    const pa = 20 + Math.sin(t * 2 + i) * 12;
                    pg.fill(35, 40, 70, pa);
                    pg.ellipse(px, py, 1.5, 1.5);
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
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        this.warpSpeed = 1 + strength * 2.5;
    }
}

window.VJamFX.presets['time-warp'] = TimeWarpPreset;
})();
