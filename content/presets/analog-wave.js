(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class AnalogWavePreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.freqSpike = 0;
    }

    setup(container) {
        this.destroy();
        this.freqSpike = 0;
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;
            const RES = 3;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.colorMode(p.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                const t = p.frameCount * 0.02;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.88;
                preset.freqSpike *= 0.92;

                const w = pg.width;
                const h = pg.height;

                // Phosphor trail
                pg.colorMode(pg.RGB);
                pg.noStroke();
                pg.fill(0, 0, 0, 20);
                pg.rect(0, 0, w, h);
                pg.colorMode(pg.HSB, 360, 100, 100, 100);

                // Graticule grid
                pg.stroke(130, 20, 18, 15);
                pg.strokeWeight(0.5);
                for (let gx = 0; gx < w; gx += w / 10) {
                    pg.line(gx, 0, gx, h);
                }
                for (let gy = 0; gy < h; gy += h / 8) {
                    pg.line(0, gy, w, gy);
                }

                // 4 waveforms
                const freq = 2 + preset.audio.mid * 4 + preset.freqSpike;
                const amp = 0.3 + preset.audio.bass * 0.4 + pulse * 0.3;
                const waveTypes = ['sine', 'square', 'sawtooth', 'triangle'];
                const bandH = h / 4;

                for (let wi = 0; wi < 4; wi++) {
                    const centerY = bandH * wi + bandH / 2;
                    const waveAmp = bandH * 0.35 * amp;

                    // Glow layer (thick, dim)
                    pg.noFill();
                    pg.stroke(130, 90, 70, 30 + pulse * 15);
                    pg.strokeWeight(3);
                    pg.beginShape();
                    for (let x = 0; x < w; x += 2) {
                        const phase = (x / w) * freq * p.TWO_PI + t * 2;
                        const y = centerY + preset._waveValue(waveTypes[wi], phase) * waveAmp;
                        pg.vertex(x, y);
                    }
                    pg.endShape();

                    // Core layer (thin, bright)
                    pg.stroke(130, 100, 100, 65 + pulse * 25);
                    pg.strokeWeight(1);
                    pg.beginShape();
                    for (let x = 0; x < w; x += 2) {
                        const phase = (x / w) * freq * p.TWO_PI + t * 2;
                        const y = centerY + preset._waveValue(waveTypes[wi], phase) * waveAmp;
                        pg.vertex(x, y);
                    }
                    pg.endShape();

                    // Label dot at left
                    pg.noStroke();
                    pg.fill(130, 60, 80, 40);
                    pg.ellipse(4, centerY, 3, 3);
                }

                // Center crosshair
                pg.stroke(130, 40, 40, 20);
                pg.strokeWeight(0.5);
                pg.line(w / 2, 0, w / 2, h);
                pg.line(0, h / 2, w, h / 2);

                p.image(pg, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
            };
        }, container);
    }

    _waveValue(type, phase) {
        switch (type) {
            case 'sine':
                return Math.sin(phase);
            case 'square':
                return Math.sin(phase) > 0 ? 1 : -1;
            case 'sawtooth':
                return ((phase % (Math.PI * 2)) / Math.PI) - 1;
            case 'triangle': {
                const norm = ((phase % (Math.PI * 2)) / (Math.PI * 2));
                return norm < 0.5 ? norm * 4 - 1 : 3 - norm * 4;
            }
            default:
                return 0;
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
        this.freqSpike = strength * 3;
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['analog-wave'] = AnalogWavePreset;
})();
