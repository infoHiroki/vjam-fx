(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class LichenSpreadPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.colonies = [];
    }

    setup(container) {
        this.destroy();
        this.colonies = [];
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.background(120, 8, 5);

                // Seed colonies
                for (let i = 0; i < 6; i++) {
                    preset.colonies.push({
                        cx: p.width * 0.15 + Math.random() * p.width * 0.7,
                        cy: p.height * 0.15 + Math.random() * p.height * 0.7,
                        radius: 5 + Math.random() * 10,
                        growSpeed: 0.08 + Math.random() * 0.06,
                        hue: 80 + Math.random() * 80, // greens to grays
                        sat: 15 + Math.random() * 25,
                        bri: 30 + Math.random() * 25,
                        noiseOff: Math.random() * 1000,
                        dotDensity: 20 + Math.floor(Math.random() * 15),
                    });
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.003 * speed;
                preset.beatPulse *= 0.94;

                const growMult = 1 + preset.beatPulse * 3 + preset.audio.bass * 0.5;
                const maxR = Math.max(p.width, p.height) * 0.45;

                // Grow colonies
                for (const col of preset.colonies) {
                    if (col.radius >= maxR) continue;
                    col.radius += col.growSpeed * speed * growMult;

                    // Draw edge dots
                    pg.noStroke();
                    const count = col.dotDensity;
                    for (let i = 0; i < count; i++) {
                        const angle = (Math.PI * 2 / count) * i + t * 0.1;
                        // Noise-modulated radius for organic edge
                        const nVal = p.noise(
                            Math.cos(angle) * 2 + col.noiseOff,
                            Math.sin(angle) * 2 + col.noiseOff,
                            t * 0.5
                        );
                        const r = col.radius * (0.85 + nVal * 0.3);
                        const dotX = col.cx + Math.cos(angle) * r;
                        const dotY = col.cy + Math.sin(angle) * r;

                        // Skip if out of bounds
                        if (dotX < 0 || dotX > p.width || dotY < 0 || dotY > p.height) continue;

                        const dotSize = 1.5 + nVal * 3;
                        const hueVar = col.hue + (p.noise(angle * 3, t) - 0.5) * 20;
                        const briVar = col.bri + nVal * 15;

                        pg.fill(hueVar, col.sat, briVar, 25);
                        pg.ellipse(dotX, dotY, dotSize, dotSize);

                        // Occasional brighter spore dot
                        if (Math.random() < 0.05) {
                            pg.fill(hueVar + 10, col.sat + 10, briVar + 20, 15);
                            pg.ellipse(dotX + (Math.random() - 0.5) * 4,
                                       dotY + (Math.random() - 0.5) * 4,
                                       dotSize * 0.6, dotSize * 0.6);
                        }
                    }

                    // Inner texture dots (sparse, slow)
                    if (p.frameCount % 3 === 0) {
                        for (let j = 0; j < 5; j++) {
                            const ia = Math.random() * Math.PI * 2;
                            const ir = Math.random() * col.radius * 0.8;
                            const ix = col.cx + Math.cos(ia) * ir;
                            const iy = col.cy + Math.sin(ia) * ir;
                            if (ix < 0 || ix > p.width || iy < 0 || iy > p.height) continue;
                            pg.fill(col.hue + Math.random() * 10, col.sat - 5, col.bri - 5, 6);
                            pg.ellipse(ix, iy, 1 + Math.random() * 2, 1 + Math.random() * 2);
                        }
                    }
                }

                // Very slow fade for renewal
                if (p.frameCount % 300 === 0) {
                    pg.fill(120, 8, 5, 2);
                    pg.noStroke();
                    pg.rect(0, 0, pg.width, pg.height);
                }

                // If all colonies maxed, reset one
                if (preset.colonies.every(c => c.radius >= maxR)) {
                    const idx = Math.floor(Math.random() * preset.colonies.length);
                    preset.colonies[idx].cx = p.width * 0.15 + Math.random() * p.width * 0.7;
                    preset.colonies[idx].cy = p.height * 0.15 + Math.random() * p.height * 0.7;
                    preset.colonies[idx].radius = 5;
                    preset.colonies[idx].noiseOff = Math.random() * 1000;
                    preset.colonies[idx].hue = 80 + Math.random() * 80;
                }

                // Render
                p.background(0);
                p.image(pg, 0, 0);

                // Subtle ambient glow at colony centers
                p.noStroke();
                for (const col of preset.colonies) {
                    if (col.radius < 20) continue;
                    p.fill(col.hue, col.sat * 0.3, col.bri * 0.4, 3 + preset.audio.mid * 4);
                    p.ellipse(col.cx, col.cy, col.radius * 0.5, col.radius * 0.5);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                const oldPg = pg;
                if (pg) pg.remove();
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.image(oldPg, 0, 0, p.width, p.height);
                oldPg.remove();
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
window.VJamFX.presets['lichen-spread'] = LichenSpreadPreset;
})();
