(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CrtScanPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.scanY = 0;
    }

    setup(container) {
        this.destroy();
        this.scanY = 0;
        this.beatPulse = 0;
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                p.background(0);
                const t = p.frameCount * 0.015;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;

                const w = p.width;
                const h = p.height;

                // Subtle phosphor glow background — very dim green noise
                p.noStroke();
                const gridSize = 12;
                const colCount = Math.ceil(w / gridSize);
                const rowCount = Math.ceil(h / gridSize);
                for (let r = 0; r < rowCount; r++) {
                    for (let c = 0; c < colCount; c++) {
                        const n = p.noise(c * 0.15, r * 0.15, t * 0.3);
                        const bri = n * 12 + bass * 8;
                        if (bri > 3) {
                            p.fill(130, 60, bri, 40);
                            p.rect(c * gridSize, r * gridSize, gridSize, gridSize);
                        }
                    }
                }

                // CRT scan line — smooth bright band scrolling down
                const scanSpeed = 1.0 + mid * 1.5;
                preset.scanY += scanSpeed;
                if (preset.scanY > h + 80) preset.scanY = -80;

                const bandCenter = preset.scanY;
                const bandWidth = 30 + bass * 10;

                // Draw scan band with smooth gaussian-like falloff
                for (let dy = -bandWidth; dy <= bandWidth; dy += 2) {
                    const y = bandCenter + dy;
                    if (y < 0 || y > h) continue;
                    const dist = Math.abs(dy) / bandWidth;
                    const intensity = Math.exp(-dist * dist * 4); // gaussian falloff
                    const alpha = intensity * (18 + mid * 8 + pulse * 5);
                    p.fill(130, 40, 80, Math.min(alpha, 30));
                    p.rect(0, y, w, 2);
                }

                // Bright core of scan line
                const coreAlpha = 12 + mid * 6 + pulse * 4;
                p.fill(130, 30, 95, Math.min(coreAlpha, 22));
                p.rect(0, bandCenter - 1, w, 3);

                // Trail behind scan line — fading phosphor persistence
                const trailLen = 60 + bass * 20;
                for (let dy = 1; dy < trailLen; dy += 3) {
                    const y = bandCenter - dy;
                    if (y < 0) break;
                    const fade = 1 - dy / trailLen;
                    const alpha = fade * fade * (8 + bass * 4);
                    p.fill(130, 50, 40, alpha);
                    p.rect(0, y, w, 3);
                }

                // Horizontal scanlines overlay (subtle CRT lines)
                p.stroke(0, 0, 0, 15);
                p.strokeWeight(1);
                for (let y = 0; y < h; y += 4) {
                    p.line(0, y, w, y);
                }
                p.noStroke();

                // CRT edge darkening (vignette via corner rects, no loop abuse)
                const edgeW = w * 0.06;
                const edgeH = h * 0.05;
                p.fill(0, 0, 0, 15);
                p.rect(0, 0, edgeW, h);
                p.rect(w - edgeW, 0, edgeW, h);
                p.rect(0, 0, w, edgeH);
                p.rect(0, h - edgeH, w, edgeH);

                // Very subtle overall green tint
                p.fill(130, 60, 20, 5 + bass * 3);
                p.rect(0, 0, w, h);

                // Beat: gentle brief brightening (not a full-screen flash)
                if (pulse > 0.1) {
                    const beatAlpha = pulse * 8;
                    p.fill(130, 30, 60, Math.min(beatAlpha, 10));
                    p.rect(0, 0, w, h);
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
window.VJamFX.presets['crt-scan'] = CrtScanPreset;
})();
