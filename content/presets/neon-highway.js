(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// Key M - Default: Retrowave ネオンハイウェイ（synthwave scene）
class NeonHighwayPreset extends BasePreset {
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
            let RES = 3;
            let gRoad, gSky;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                gRoad = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                gRoad.colorMode(gRoad.HSB, 360, 100, 100, 100);
                gSky = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                gSky.colorMode(gSky.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.9;
                const t = p.frameCount * 0.02 * preset.params.speed;
                const bass = preset.audio.bass;
                const w = gRoad.width;
                const h = gRoad.height;
                const horizon = h * 0.4;

                // Sky: gradient + stars
                gSky.background(270, 80, 8);
                for (let i = 0; i < 30; i++) {
                    const sx = (i * 137.5 + t * 5) % w;
                    const sy = (i * 73.1) % horizon;
                    const twinkle = Math.sin(t * 3 + i) * 0.5 + 0.5;
                    gSky.noStroke();
                    gSky.fill(0, 0, 100, twinkle * 60);
                    gSky.circle(sx, sy, 1.5);
                }

                // Sun
                const sunY = horizon - 8 - Math.sin(t * 0.3) * 3;
                const sunPulse = 1 + preset.beatPulse * 0.3;
                for (let r = 20 * sunPulse; r > 0; r -= 3) {
                    const alpha = (1 - r / (20 * sunPulse)) * 80;
                    gSky.noStroke();
                    gSky.fill(340 + r * 0.5, 90, 90, alpha);
                    gSky.ellipse(w / 2, sunY, r * 2, r * 1.2);
                }

                // Road
                gRoad.background(0, 0, 0, 0);
                gRoad.clear();
                const roadLines = 20;
                for (let i = 0; i < roadLines; i++) {
                    const frac = i / roadLines;
                    const y = horizon + (h - horizon) * frac * frac;
                    const spread = 0.1 + frac * 0.9;
                    const lx = w / 2 - w * spread * 0.5;
                    const rx = w / 2 + w * spread * 0.5;

                    // Horizontal grid lines
                    const gridPhase = (frac + t * 0.5) % 0.15;
                    if (gridPhase < 0.02) {
                        gRoad.stroke(280, 70, 60 + bass * 40, 40 + frac * 30);
                        gRoad.strokeWeight(1);
                        gRoad.line(lx, y, rx, y);
                    }

                    // Side lines
                    if (i > 2) {
                        gRoad.stroke(320, 80, 80, 30 + frac * 40);
                        gRoad.strokeWeight(1);
                        gRoad.line(lx, y, lx + 2, y);
                        gRoad.line(rx - 2, y, rx, y);
                    }
                }

                // Center dashed line
                for (let i = 0; i < 12; i++) {
                    const frac = ((i / 12 + t * 0.8) % 1);
                    const y = horizon + (h - horizon) * frac * frac;
                    const dashLen = 2 + frac * 4;
                    gRoad.stroke(180, 60, 90, 40 + frac * 50);
                    gRoad.strokeWeight(1);
                    gRoad.line(w / 2, y, w / 2, y + dashLen);
                }

                // Vertical perspective lines
                for (let i = -3; i <= 3; i++) {
                    const x = w / 2 + i * w * 0.15;
                    gRoad.stroke(280, 60, 50, 20);
                    gRoad.strokeWeight(0.5);
                    gRoad.line(w / 2, horizon, x, h);
                }

                p.image(gSky, 0, 0, p.width, p.height);
                p.image(gRoad, 0, 0, p.width, p.height);

                // Horizon glow
                p.noStroke();
                for (let i = 0; i < 5; i++) {
                    p.fill(320, 80, 70, 8 - i);
                    const glowH = (10 + i * 8) * (1 + bass * 0.5);
                    p.rect(0, horizon * (p.height / h) - glowH / 2, p.width, glowH);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                gRoad.resizeCanvas(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                gSky.resizeCanvas(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
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
window.VJamFX.presets['neon-highway'] = NeonHighwayPreset;
})();
