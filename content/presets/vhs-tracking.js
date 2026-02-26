(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class VhsTrackingPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;
            const RES = 4;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.noSmooth();
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.noSmooth();
            };

            p.draw = () => {
                const t = p.frameCount * 0.02 * preset.params.speed;
                const bass = preset.audio.bass;
                const treble = preset.audio.treble;
                const rms = preset.audio.rms;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.88;

                const w = pg.width;
                const h = pg.height;

                // Base content: horizontal color noise bands
                pg.background(10, 5, 15);
                pg.noStroke();

                const glitchIntensity = 0.3 + rms * 0.4 + pulse * 0.5;
                const bandH = 2;

                for (let y = 0; y < h; y += bandH) {
                    const n = pg.noise(y * 0.03 + t * 0.5, t * 0.2);
                    const r = n * 180 + bass * 80;
                    const g = n * 130 + treble * 60;
                    const b = n * 160;

                    // Horizontal displacement per row
                    let shift = 0;
                    const rowNoise = pg.noise(y * 0.1, t * 2);
                    if (rowNoise > (1 - glitchIntensity * 0.3)) {
                        shift = (Math.random() - 0.5) * w * glitchIntensity * 0.4;
                    }

                    pg.fill(r, g, b);
                    pg.rect(shift, y, w, bandH);

                    // Color fringing at displaced rows
                    if (Math.abs(shift) > 2) {
                        pg.fill(r * 0.5, 0, 0, 120);
                        pg.rect(shift - 3, y, w, bandH);
                        pg.fill(0, 0, b * 0.5, 120);
                        pg.rect(shift + 3, y, w, bandH);
                    }
                }

                // Noise band (scrolling distortion region)
                const noiseBandY = (t * 50) % h;
                const noiseBandH = 5 + bass * 15;
                for (let y = noiseBandY; y < noiseBandY + noiseBandH && y < h; y += 2) {
                    const shift = (Math.random() - 0.5) * w * 0.3;
                    const sv = 80 + Math.random() * 175;
                    pg.fill(sv * glitchIntensity, sv * glitchIntensity, sv * glitchIntensity);
                    pg.rect(shift, y, w, 2);
                }

                // Scanline darkening (every 3rd row)
                pg.fill(0, 0, 0, 70);
                for (let y = 0; y < h; y += 3) {
                    pg.rect(0, y, w, 1);
                }

                // Static noise spots on beat
                if (pulse > 0.2) {
                    const spotCount = Math.floor(pulse * 30);
                    for (let i = 0; i < spotCount; i++) {
                        const sx = Math.random() * w;
                        const sy = Math.random() * h;
                        const sv = Math.random() * 200;
                        pg.fill(sv, sv, sv);
                        pg.rect(sx, sy, 2, 1);
                    }
                }

                // Beat glitch: copy-shift horizontal strips
                if (pulse > 0.4) {
                    const strips = Math.floor(pulse * 4);
                    for (let i = 0; i < strips; i++) {
                        const sy = Math.floor(Math.random() * h);
                        const sh = 3 + Math.floor(Math.random() * 10);
                        const shift = Math.floor((Math.random() - 0.5) * w * pulse * 0.5);
                        const region = pg.get(0, sy, w, sh);
                        pg.image(region, shift, sy);
                    }
                }

                p.image(pg, 0, 0, p.width, p.height);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                pg = p.createGraphics(
                    Math.ceil(p.width / RES),
                    Math.ceil(p.height / RES)
                );
                pg.noSmooth();
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

window.VJamFX.presets['vhs-tracking'] = VhsTrackingPreset;
})();
