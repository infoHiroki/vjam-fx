(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SpirographPreset extends BasePreset {
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
            let curves = [];
            let trailCanvas;

            function newCurve() {
                const R = Math.min(p.width, p.height) * (0.15 + Math.random() * 0.2);
                const rRatio = 0.2 + Math.random() * 0.6;
                const r = R * rRatio;
                const d = r * (0.3 + Math.random() * 1.2);
                return {
                    R, r, d,
                    angle: 0,
                    hue: Math.random() * 360,
                    prevX: null,
                    prevY: null,
                    offsetX: (Math.random() - 0.5) * p.width * 0.2,
                    offsetY: (Math.random() - 0.5) * p.height * 0.2
                };
            }

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                trailCanvas = p.createGraphics(p.width, p.height);
                trailCanvas.colorMode(p.HSB, 360, 100, 100, 100);
                trailCanvas.background(0, 0, 0);

                // Start with 3 curves
                for (let i = 0; i < 3; i++) {
                    curves.push(newCurve());
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const bass = preset.audio.bass;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.93;

                // Fade trail
                trailCanvas.fill(0, 0, 0, 3);
                trailCanvas.noStroke();
                trailCanvas.rect(0, 0, trailCanvas.width, trailCanvas.height);

                const cx = p.width / 2;
                const cy = p.height / 2;

                for (const c of curves) {
                    const angleStep = 0.05 * speed * (1 + treble * 0.5);
                    c.angle += angleStep;
                    c.hue = (c.hue + 0.3) % 360;

                    // Hypotrochoid: x = (R-r)*cos(t) + d*cos((R-r)/r * t)
                    const t = c.angle;
                    const diff = c.R - c.r;
                    const ratio = diff / c.r;
                    const x = cx + c.offsetX + diff * Math.cos(t) + c.d * Math.cos(ratio * t);
                    const y = cy + c.offsetY + diff * Math.sin(t) - c.d * Math.sin(ratio * t);

                    if (c.prevX !== null) {
                        const bri = 70 + bass * 20 + pulse * 10;
                        const alpha = 60 + pulse * 30;
                        const sw = 1 + bass * 1.5 + pulse * 2;
                        trailCanvas.stroke(c.hue, 70, Math.min(100, bri), alpha);
                        trailCanvas.strokeWeight(sw);
                        trailCanvas.line(c.prevX, c.prevY, x, y);
                    }

                    c.prevX = x;
                    c.prevY = y;
                }

                p.image(trailCanvas, 0, 0);

                // Beat: change parameters of a random curve or add new one
                if (pulse > 0.5) {
                    if (curves.length < 6) {
                        curves.push(newCurve());
                    } else {
                        // Mutate a random curve
                        const c = curves[Math.floor(Math.random() * curves.length)];
                        c.r = c.R * (0.2 + Math.random() * 0.6);
                        c.d = c.r * (0.3 + Math.random() * 1.2);
                    }
                }

                // Remove oldest if too many
                if (curves.length > 6) {
                    curves.shift();
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (trailCanvas) trailCanvas.remove();
                trailCanvas = p.createGraphics(p.width, p.height);
                trailCanvas.colorMode(p.HSB, 360, 100, 100, 100);
                trailCanvas.background(0, 0, 0);
                curves.forEach(c => { c.prevX = null; c.prevY = null; });
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
window.VJamFX.presets['spirograph'] = SpirographPreset;
})();
