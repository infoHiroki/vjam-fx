(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// Key 6 - Default: 墨汁が水中で広がる有機的な全面fill
class InkWashPreset extends BasePreset {
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
            let drops = [];

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.noSmooth();
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.noStroke();
                // Initial ink drops
                for (let i = 0; i < 5; i++) {
                    drops.push({
                        x: Math.random() * pg.width,
                        y: Math.random() * pg.height,
                        r: 2 + Math.random() * 5,
                        hue: 200 + Math.random() * 40,
                        speed: 0.3 + Math.random() * 0.4,
                        phase: Math.random() * Math.PI * 2,
                    });
                }
            };

            p.draw = () => {
                const t = p.frameCount * 0.006 * preset.params.speed;
                const bass = preset.audio.bass;
                preset.beatPulse *= 0.93;

                const w = pg.width;
                const h = pg.height;

                // Slow fade (ink persists)
                pg.background(0, 0, 0, 8);

                // Spawn new drops on beat
                if (preset.beatPulse > 0.3 && drops.length < 12) {
                    drops.push({
                        x: Math.random() * w,
                        y: Math.random() * h,
                        r: 3 + preset.beatPulse * 8,
                        hue: 180 + Math.random() * 60,
                        speed: 0.4 + Math.random() * 0.3,
                        phase: Math.random() * Math.PI * 2,
                    });
                }

                for (const d of drops) {
                    // Organic movement
                    const nx = d.x * 0.01 + t * d.speed;
                    const ny = d.y * 0.01 + t * d.speed * 0.7;
                    d.x += (pg.noise(nx, ny) - 0.5) * 2;
                    d.y += (pg.noise(ny + 100, nx + 100) - 0.5) * 2;

                    // Grow radius slowly
                    d.r += 0.02 + bass * 0.1;

                    // Wrap
                    if (d.x < -d.r) d.x = w + d.r;
                    if (d.x > w + d.r) d.x = -d.r;
                    if (d.y < -d.r) d.y = h + d.r;
                    if (d.y > h + d.r) d.y = -d.r;

                    // Draw ink blob with noise-distorted edge
                    const steps = 24;
                    const pulse = Math.sin(t * 2 + d.phase) * 0.2;
                    pg.fill(d.hue, 30 + bass * 20, 50 + pulse * 20, 25);
                    pg.beginShape();
                    for (let i = 0; i < steps; i++) {
                        const a = (i / steps) * Math.PI * 2;
                        const nr = d.r * (1 + 0.4 * pg.noise(
                            d.x * 0.05 + Math.cos(a) * 2,
                            d.y * 0.05 + Math.sin(a) * 2,
                            t
                        ));
                        pg.vertex(
                            d.x + Math.cos(a) * nr,
                            d.y + Math.sin(a) * nr
                        );
                    }
                    pg.endShape(p.CLOSE);

                    // Inner bright core
                    pg.fill(d.hue, 15, 70, 15);
                    pg.ellipse(d.x, d.y, d.r * 0.6, d.r * 0.6);
                }

                // Remove oversized drops
                for (let i = drops.length - 1; i >= 0; i--) {
                    if (drops[i].r > Math.max(w, h) * 0.5) {
                        drops[i] = {
                            x: Math.random() * w,
                            y: Math.random() * h,
                            r: 2 + Math.random() * 3,
                            hue: 180 + Math.random() * 60,
                            speed: 0.3 + Math.random() * 0.4,
                            phase: Math.random() * Math.PI * 2,
                        };
                    }
                }

                // Auto-spawn
                if (drops.length < 4) {
                    drops.push({
                        x: Math.random() * w,
                        y: Math.random() * h,
                        r: 2, hue: 200 + Math.random() * 40,
                        speed: 0.3, phase: Math.random() * Math.PI * 2,
                    });
                }

                p.image(pg, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.noStroke();
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
window.VJamFX.presets['ink-wash'] = InkWashPreset;
})();
