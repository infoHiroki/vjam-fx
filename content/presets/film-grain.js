(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FilmGrainPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.pendingBeats = [];
        this.scratches = [];
        this.dust = [];
        this.flashAlpha = 0;
        this.scratchGfx = null;
    }

    setup(container) {
        this.destroy();
        this.pendingBeats = [];
        this.scratches = [];
        this.flashAlpha = 0;
        const preset = this;

        // Initialize dust particles
        this.dust = [];
        for (let i = 0; i < 15; i++) {
            this.dust.push({
                x: Math.random(), y: Math.random(),
                vx: (Math.random() - 0.5) * 0.0003,
                vy: Math.random() * 0.0002 + 0.0001,
                len: Math.random() * 25 + 8,
                angle: Math.random() * Math.PI,
                curve: Math.random() * 16 - 8
            });
        }

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                preset.scratchGfx = p.createGraphics(p.width, p.height);
                preset.scratchGfx.colorMode(preset.scratchGfx.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                p.background(0);
                const t = p.frameCount * 0.04;
                const bass = preset.audio.bass;

                // Grain cell size — slightly larger for softer look
                const cellSize = 5;
                const cols = Math.ceil(p.width / cellSize);
                const rows = Math.ceil(p.height / cellSize);

                // Process beats
                for (const beat of preset.pendingBeats) {
                    // Softer flash: lower base alpha, gentler scaling
                    preset.flashAlpha = 12 + beat.strength * 20;
                    for (let s = 0; s < 1 + Math.floor(beat.strength * 2); s++) {
                        preset.scratches.push({
                            x: Math.random() * p.width,
                            speed: Math.random() * 0.3 + 0.1,
                            weight: Math.random() * 1.2 + 0.3,
                            life: 1.0
                        });
                    }
                }
                preset.pendingBeats = [];

                // Warm-tinted noise grain (softer alpha, warm hue)
                p.noStroke();
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        const n = p.noise(col * 0.12, row * 0.12, t);
                        // Warmer tint: sepia/amber hue range 25-40
                        const hue = 28 + n * 12;
                        const sat = 25 + n * 15;
                        // Lower brightness and alpha for gentler grain
                        const bri = n * 22 + bass * 12;
                        const alpha = 35 + n * 25;
                        p.fill(hue, sat, bri, alpha);
                        p.rect(col * cellSize, row * cellSize, cellSize, cellSize);
                    }
                }

                // Scratch layer with slow fade
                const sg = preset.scratchGfx;
                sg.colorMode(sg.HSB, 360, 100, 100, 100);
                sg.fill(0, 0, 0, 3);
                sg.noStroke();
                sg.rect(0, 0, sg.width, sg.height);
                for (const s of preset.scratches) {
                    if (s.life > 0) {
                        sg.stroke(32, 15, 55, s.life * 40);
                        sg.strokeWeight(s.weight);
                        const wobble = Math.sin(p.frameCount * s.speed) * 2;
                        sg.line(s.x + wobble, 0, s.x + wobble * 0.5, sg.height);
                    }
                }
                p.image(sg, 0, 0);

                // Dust particles (bezier hair-like fibers)
                p.noFill();
                for (const d of preset.dust) {
                    d.x += d.vx;
                    d.y += d.vy;
                    if (d.y > 1.1) { d.y = -0.05; d.x = Math.random(); }
                    if (d.x < -0.05 || d.x > 1.05) d.vx *= -1;

                    const dx = d.x * p.width;
                    const dy = d.y * p.height;
                    const ex = dx + Math.cos(d.angle) * d.len;
                    const ey = dy + Math.sin(d.angle) * d.len;
                    p.stroke(32, 12, 40, 25);
                    p.strokeWeight(0.6);
                    p.bezier(dx, dy, dx + d.curve, dy + d.len * 0.3,
                             ex - d.curve, ey - d.len * 0.3, ex, ey);
                }

                // Film edge darkening (gradient rects from edges)
                p.noStroke();
                const edgeW = p.width * 0.12;
                const edgeH = p.height * 0.1;
                const steps = 8;
                for (let i = 0; i < steps; i++) {
                    const a = (1 - i / steps) * 30;
                    p.fill(0, 0, 0, a);
                    const d = i * (edgeW / steps);
                    p.rect(d, 0, edgeW / steps, p.height);
                    p.rect(p.width - d - edgeW / steps, 0, edgeW / steps, p.height);
                    const dh = i * (edgeH / steps);
                    p.rect(0, dh, p.width, edgeH / steps);
                    p.rect(0, p.height - dh - edgeH / steps, p.width, edgeH / steps);
                }

                // Beat flash — much gentler: warm tint, low alpha, faster decay
                if (preset.flashAlpha > 0) {
                    p.fill(35, 25, 70, preset.flashAlpha);
                    p.rect(0, 0, p.width, p.height);
                    preset.flashAlpha *= 0.8;
                    if (preset.flashAlpha < 0.5) preset.flashAlpha = 0;
                }

                // Flicker — reduced intensity
                const flicker = (Math.random() - 0.5) * 5;
                if (Math.abs(flicker) > 2.5) {
                    p.fill(32, 8, 35, Math.abs(flicker) * 0.6);
                    p.rect(0, 0, p.width, p.height);
                }

                // Decay scratches
                for (let i = preset.scratches.length - 1; i >= 0; i--) {
                    preset.scratches[i].life -= 0.008;
                    if (preset.scratches[i].life <= 0) preset.scratches.splice(i, 1);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (preset.scratchGfx) preset.scratchGfx.remove();
                preset.scratchGfx = p.createGraphics(p.width, p.height);
                preset.scratchGfx.colorMode(preset.scratchGfx.HSB, 360, 100, 100, 100);
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
        this.pendingBeats.push({ strength });
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['film-grain'] = FilmGrainPreset;
})();
