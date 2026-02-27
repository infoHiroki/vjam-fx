(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class WaterSurfacePreset extends BasePreset {
    constructor() {
        super();
        this.params = { grids: 3 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.flashSpots = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.90;

                const w = p.width;
                const h = p.height;
                const time = p.frameCount * 0.015;
                const bassBoost = preset.audio.bass;
                const beat = preset.beatPulse;

                // Grid parameters for 3 overlapping wave layers
                const gridConfigs = [
                    { angle: 0.3, speed: 1.0, scale: 0.015, weight: 1.5 },
                    { angle: -0.5, speed: 0.7, scale: 0.012, weight: 1.2 },
                    { angle: 1.2, speed: 1.3, scale: 0.018, weight: 1.0 }
                ];

                p.noFill();

                // Draw each caustic wave grid
                for (let g = 0; g < gridConfigs.length; g++) {
                    const cfg = gridConfigs[g];
                    const cosA = Math.cos(cfg.angle);
                    const sinA = Math.sin(cfg.angle);
                    const t = time * cfg.speed;
                    const sc = cfg.scale * (1 + beat * 0.5);

                    // Caustic lines along one axis
                    const spacing = 30 + bassBoost * -8;
                    const numLines = Math.ceil(Math.max(w, h) * 2 / spacing);

                    for (let i = -numLines; i < numLines; i++) {
                        const baseOffset = i * spacing;

                        // Hue shifts between cyan and turquoise
                        const hue = 180 + g * 15 + Math.sin(i * 0.3 + t) * 10;
                        const brightness = 55 + bassBoost * 25 + beat * 20;
                        const alpha = 25 + preset.audio.rms * 20 + beat * 15;

                        p.stroke(hue, 60 - beat * 20, brightness, alpha);
                        p.strokeWeight(cfg.weight + bassBoost * 0.8 + beat * 1.0);

                        p.beginShape();
                        const steps = 40;
                        for (let s = 0; s <= steps; s++) {
                            const frac = s / steps;
                            // Parametric position along the line
                            const linePos = (frac - 0.5) * Math.max(w, h) * 2;

                            // Base position rotated by grid angle
                            const bx = linePos * cosA - baseOffset * sinA;
                            const by = linePos * sinA + baseOffset * cosA;

                            // Caustic distortion using sine waves
                            const wave1 = Math.sin(bx * sc + t * 1.1) * 15;
                            const wave2 = Math.sin(by * sc * 0.8 + t * 0.9) * 12;
                            const wave3 = Math.sin((bx + by) * sc * 0.5 + t * 1.4) * 8;
                            const distort = (wave1 + wave2 + wave3) * (1 + bassBoost * 0.5);

                            const fx = bx + distort * sinA + w * 0.5;
                            const fy = by - distort * cosA + h * 0.5;

                            p.curveVertex(fx, fy);
                        }
                        p.endShape();
                    }
                }

                // Bright caustic intersection highlights
                p.noStroke();
                const spotCount = 12 + Math.floor(bassBoost * 8);
                for (let i = 0; i < spotCount; i++) {
                    const sx = (p.noise(i * 3.7, time * 0.3) * 1.4 - 0.2) * w;
                    const sy = (p.noise(i * 3.7 + 100, time * 0.3) * 1.4 - 0.2) * h;
                    const sz = 3 + p.noise(i * 3.7 + 200, time * 0.5) * 8 + bassBoost * 6;
                    const alpha = 20 + p.noise(i * 3.7 + 300, time * 0.8) * 30 + beat * 25;

                    p.fill(185, 30, 95, alpha);
                    p.ellipse(sx, sy, sz, sz);
                    // Glow around bright spots
                    p.fill(185, 20, 90, alpha * 0.3);
                    p.ellipse(sx, sy, sz * 3, sz * 3);
                }

                // Sunlight flash spots (occasional)
                if (p.frameCount % 60 < 3 || beat > 0.5) {
                    const fx = w * (0.3 + 0.4 * p.noise(time * 0.1));
                    const fy = h * (0.2 + 0.3 * p.noise(time * 0.1 + 50));
                    const flashSize = 20 + beat * 40 + bassBoost * 20;
                    // Bright white core
                    p.fill(180, 10, 100, 50 + beat * 30);
                    p.ellipse(fx, fy, flashSize, flashSize);
                    p.fill(180, 5, 100, 20);
                    p.ellipse(fx, fy, flashSize * 3, flashSize * 3);
                }

                // Subtle overall water shimmer overlay
                const shimmerAlpha = 3 + preset.audio.rms * 5;
                p.fill(190, 40, 60, shimmerAlpha);
                p.rect(0, 0, w, h);
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
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['water-surface'] = WaterSurfacePreset;
})();
