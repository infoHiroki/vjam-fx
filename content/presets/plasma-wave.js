(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class PlasmaWavePreset extends BasePreset {
    constructor() {
        super();
        this.params = {
            resolution: 8,
        };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.noStroke();
            };

            p.draw = () => {
                const res = preset.params.resolution;
                const time = p.frameCount * 0.02;
                const bassBoost = preset.audio.bass * 3;
                const midBoost = preset.audio.mid * 2;
                const trebleBoost = preset.audio.treble * 4;

                preset.beatPulse *= 0.92;

                for (let x = 0; x < p.width; x += res) {
                    for (let y = 0; y < p.height; y += res) {
                        const nx = x / p.width;
                        const ny = y / p.height;

                        // Classic plasma formula with audio modulation
                        const v1 = Math.sin(nx * 10 + time * (1 + bassBoost));
                        const v2 = Math.sin(ny * 8 + time * 0.7);
                        const v3 = Math.sin((nx + ny) * 6 + time * 0.5 + midBoost);
                        const v4 = Math.sin(Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 12 + time + trebleBoost);

                        const v = (v1 + v2 + v3 + v4) / 4; // -1 to 1

                        const hue = ((v * 180 + time * 20 + preset.beatPulse * 60) % 360 + 360) % 360;
                        const sat = 60 + preset.audio.rms * 30;
                        const bri = 30 + (v + 1) * 30 + preset.beatPulse * 20;

                        p.fill(hue, sat, Math.min(100, bri), 100);
                        p.rect(x, y, res, res);
                    }
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
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
    }
}

window.VJamFX.presets['plasma-wave'] = PlasmaWavePreset;
})();
