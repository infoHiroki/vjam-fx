(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class GlitchWavePreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.bands = [];
        this.maxBands = 30;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                preset._initBands(p);
            };

            p.draw = () => {
                p.background(5, 5, 15);
                preset.beatPulse *= 0.90;

                const displace = preset.beatPulse * 80 + preset.audio.treble * 20;
                const t = p.frameCount * 0.03;

                // Draw bands with RGB separation
                for (let i = 0; i < preset.bands.length; i++) {
                    const band = preset.bands[i];

                    // Update band position noise
                    const noiseVal = p.noise(i * 0.3, t) - 0.5;
                    const xOff = noiseVal * displace * 2;

                    const y = band.y;
                    const h = band.h;
                    const rgbSplit = displace * 0.3 + preset.beatPulse * 10;

                    // Jitter width on beat
                    const wJitter = preset.beatPulse > 0.1 ? (Math.random() - 0.5) * 40 : 0;

                    p.noStroke();

                    if (rgbSplit > 2) {
                        // RGB separation mode
                        p.blendMode(p.ADD);

                        // Cyan channel
                        p.fill(0, 255, 255, band.alpha * 0.6);
                        p.rect(xOff - rgbSplit + wJitter, y, p.width + rgbSplit * 2, h);

                        // Magenta channel
                        p.fill(255, 0, 255, band.alpha * 0.5);
                        p.rect(xOff + rgbSplit + wJitter, y, p.width + rgbSplit * 2, h);

                        // White core
                        p.fill(255, 255, 255, band.alpha * 0.3);
                        p.rect(xOff + wJitter, y, p.width, h);

                        p.blendMode(p.BLEND);
                    } else {
                        // Normal draw
                        const col = band.color;
                        p.fill(col[0], col[1], col[2], band.alpha);
                        p.rect(xOff + wJitter, y, p.width, h);
                    }
                }

                // Random glitch blocks on beat
                if (preset.beatPulse > 0.3) {
                    const blockCount = Math.floor(preset.beatPulse * 6);
                    p.blendMode(p.ADD);
                    for (let i = 0; i < blockCount; i++) {
                        const bx = Math.random() * p.width;
                        const by = Math.random() * p.height;
                        const bw = 20 + Math.random() * 150;
                        const bh = 2 + Math.random() * 15;
                        const colors = [[0, 255, 255], [255, 0, 255], [255, 255, 255]];
                        const c = colors[Math.floor(Math.random() * colors.length)];
                        p.fill(c[0], c[1], c[2], 60 + Math.random() * 80);
                        p.noStroke();
                        p.rect(bx, by, bw, bh);
                    }
                    p.blendMode(p.BLEND);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                preset._initBands(p);
            };
        }, container);
    }

    _initBands(p) {
        this.bands = [];
        let y = 0;
        while (y < p.height && this.bands.length < this.maxBands) {
            const h = 5 + Math.random() * (p.height / this.maxBands * 2);
            const colors = [
                [0, 255, 255],   // cyan
                [255, 0, 255],   // magenta
                [255, 255, 255], // white
            ];
            this.bands.push({
                y,
                h,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 20 + Math.random() * 40,
            });
            y += h + Math.random() * 10;
        }
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        // Shuffle some band colors on strong beat
        if (strength > 0.5 && this.bands.length > 0) {
            const colors = [[0, 255, 255], [255, 0, 255], [255, 255, 255]];
            for (let i = 0; i < 5; i++) {
                const idx = Math.floor(Math.random() * this.bands.length);
                this.bands[idx].color = colors[Math.floor(Math.random() * colors.length)];
                this.bands[idx].alpha = 40 + Math.random() * 60;
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['glitch-wave'] = GlitchWavePreset;
})();
