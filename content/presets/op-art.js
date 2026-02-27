(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class OpArtPreset extends BasePreset {
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
            const RES = 3;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.noSmooth();
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
            };

            p.draw = () => {
                const t = p.frameCount * 0.008 * preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;

                const w = pg.width;
                const h = pg.height;
                const cx = w / 2;
                const cy = h / 2;
                const cellSize = 6;

                pg.background(0);
                pg.noStroke();

                // Distortion amount driven by bass
                const distortion = 0.3 + bass * 0.8 + pulse * 0.4;
                // Wave pulse from beat
                const wavePulse = pulse * 15;

                for (let y = 0; y < h; y += cellSize) {
                    for (let x = 0; x < w; x += cellSize) {
                        // Normalized coordinates from center
                        const nx = (x - cx) / cx;
                        const ny = (y - cy) / cy;
                        const dist = Math.sqrt(nx * nx + ny * ny);

                        // Warped checkerboard using sin/cos distortion
                        const warpX = nx + Math.sin(ny * 5 + t) * distortion * 0.3
                            + Math.cos(dist * 8 - t * 2) * distortion * 0.15;
                        const warpY = ny + Math.cos(nx * 5 + t * 1.3) * distortion * 0.3
                            + Math.sin(dist * 8 - t * 2) * distortion * 0.15;

                        // Beat wave ripple from center
                        const ripple = wavePulse > 0.1
                            ? Math.sin(dist * 20 - p.frameCount * 0.3) * wavePulse * 0.02
                            : 0;

                        // Checkerboard pattern
                        const freq = 4 + treble * 3;
                        const check = Math.sin((warpX + ripple) * freq * Math.PI)
                            * Math.sin((warpY + ripple) * freq * Math.PI);

                        // Sharp black/white threshold with slight mid-driven softness
                        const threshold = mid * 0.2;
                        let brightness;
                        if (check > threshold) {
                            brightness = 240 + pulse * 15;
                        } else if (check > -threshold && threshold > 0.01) {
                            // Gradient edge
                            const blend = (check + threshold) / (threshold * 2);
                            brightness = blend * 240;
                        } else {
                            brightness = 10 + pulse * 5;
                        }

                        pg.fill(brightness);
                        pg.rect(x, y, cellSize, cellSize);
                    }
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
window.VJamFX.presets['op-art'] = OpArtPreset;
})();
