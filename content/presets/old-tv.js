(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class OldTvPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.channelFlip = 0;
        this.holdOffset = 0;
        this.channelPattern = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            let pg, staticPg;
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
                staticPg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                staticPg.colorMode(staticPg.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.015 * speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.85;
                preset.channelFlip *= 0.9;
                preset.holdOffset *= 0.95;

                const w = pg.width;
                const h = pg.height;

                pg.background(0, 0, 2);

                // TV bezel
                const bezelT = 8;
                const bezelR = 4;
                const screenL = bezelT;
                const screenTop = bezelT;
                const screenW = w - bezelT * 2;
                const screenH = h - bezelT * 2;

                // Bezel
                pg.noStroke();
                pg.fill(30, 30, 18, 90);
                pg.rect(0, 0, w, h, bezelR);
                pg.fill(0, 0, 5, 95);
                pg.rect(screenL, screenTop, screenW, screenH, 2);

                // Screen content
                const isColorBars = preset.channelFlip > 0.5;

                if (isColorBars) {
                    // Classic color test bars
                    const barW = screenW / 7;
                    const barHues = [0, 60, 120, 180, 240, 300, 40];
                    const barSats = [0, 80, 80, 80, 80, 80, 0];
                    const barBris = [95, 90, 85, 80, 75, 80, 40];
                    for (let i = 0; i < 7; i++) {
                        pg.fill(barHues[i], barSats[i], barBris[i] * (0.8 + preset.channelFlip * 0.2), 85);
                        pg.rect(screenL + i * barW, screenTop, barW + 1, screenH);
                    }
                } else {
                    // Static noise pattern
                    const cellSize = 3;
                    const holdY = preset.holdOffset * screenH * 0.3;

                    for (let y = 0; y < screenH; y += cellSize) {
                        const shiftedY = (y + holdY) % screenH;
                        for (let x = 0; x < screenW; x += cellSize) {
                            const n = Math.random();
                            let bri = n * 40 + mid * 15;

                            // Channel moment: brief shape patterns
                            const channelMoment = Math.sin(t * 0.3) > 0.85;
                            if (channelMoment) {
                                const cx = screenW / 2;
                                const cy = screenH / 2;
                                const dx = x - cx;
                                const dy = shiftedY - cy;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (preset.channelPattern === 0) {
                                    // Circles
                                    if (Math.abs(dist % 20 - 10) < 3) bri += 30;
                                } else {
                                    // Lines
                                    if (Math.abs((x + shiftedY) % 15 - 7) < 2) bri += 25;
                                }
                            }

                            pg.noStroke();
                            pg.fill(0, 0, bri, 80);
                            pg.rect(screenL + x, screenTop + shiftedY, cellSize, cellSize);
                        }
                    }

                    // Horizontal hold line
                    if (Math.abs(holdY) > 5) {
                        pg.fill(0, 0, 50, 40);
                        pg.rect(screenL, screenTop + (holdY % screenH + screenH) % screenH, screenW, 3);
                    }
                }

                // Scanlines over everything
                pg.stroke(0, 0, 0, 20);
                pg.strokeWeight(0.5);
                for (let y = screenTop; y < screenTop + screenH; y += 2) {
                    pg.line(screenL, y, screenL + screenW, y);
                }

                // CRT warm glow around edges
                pg.noStroke();
                // Top/bottom glow
                for (let i = 0; i < 5; i++) {
                    const alpha = 8 - i * 1.5;
                    pg.fill(30, 40, 40, alpha);
                    pg.rect(screenL, screenTop + i, screenW, 2);
                    pg.rect(screenL, screenTop + screenH - i - 2, screenW, 2);
                    pg.rect(screenL + i, screenTop, 2, screenH);
                    pg.rect(screenL + screenW - i - 2, screenTop, 2, screenH);
                }

                // Screen reflection/glare
                pg.fill(0, 0, 60, 5 + treble * 5);
                pg.beginShape();
                pg.vertex(screenL + screenW * 0.1, screenTop);
                pg.vertex(screenL + screenW * 0.35, screenTop);
                pg.vertex(screenL + screenW * 0.15, screenTop + screenH * 0.5);
                pg.vertex(screenL + screenW * 0.05, screenTop + screenH * 0.3);
                pg.endShape(p.CLOSE);

                // TV knobs on bezel (right side)
                pg.fill(30, 20, 30, 60);
                pg.ellipse(w - bezelT * 0.5, h * 0.35, 4, 4);
                pg.ellipse(w - bezelT * 0.5, h * 0.55, 4, 4);

                // Power indicator
                const powerBri = 50 + Math.sin(t) * 10;
                pg.fill(130, 70, powerBri, 70);
                pg.ellipse(w - bezelT * 0.5, h * 0.75, 2, 2);

                // Random interference
                if (Math.random() < 0.08 + bass * 0.1) {
                    const iy = screenTop + Math.random() * screenH;
                    pg.stroke(0, 0, 50, 30);
                    pg.strokeWeight(1);
                    pg.line(screenL, iy, screenL + screenW, iy);
                }

                // Beat: channel flip
                if (pulse > 0.4) {
                    pg.fill(0, 0, 80, pulse * 30);
                    pg.noStroke();
                    pg.rect(screenL, screenTop, screenW, screenH);
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
                staticPg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                staticPg.colorMode(staticPg.HSB, 360, 100, 100, 100);
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
        this.channelFlip = strength > 0.6 ? 1 : 0;
        this.holdOffset = strength * 0.8;
        this.channelPattern = (this.channelPattern + 1) % 2;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['old-tv'] = OldTvPreset;
})();
