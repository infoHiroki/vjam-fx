(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class CrtMonitorPreset extends BasePreset {
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
                    pg.colorMode(p.RGB, 255);
                };

                p.draw = () => {
                    const t = p.frameCount;
                    const bass = preset.audio.bass;
                    const mid = preset.audio.mid;
                    const treble = preset.audio.treble;
                    const pulse = preset.beatPulse;
                    preset.beatPulse *= 0.9;

                    const w = pg.width;
                    const h = pg.height;

                    // Dark background with slight phosphor glow
                    pg.background(5, 8, 5);

                    // Scrolling content: colored noise bands using rects
                    const bandH = 3 + Math.floor(mid * 5);
                    pg.noStroke();

                    for (let y = 0; y < h; y += bandH) {
                        const noiseVal = pg.noise(y * 0.05, t * 0.01);
                        const r = noiseVal * (80 + bass * 155);
                        const g = noiseVal * (60 + mid * 175) * 1.2;
                        const b = noiseVal * (60 + treble * 155);

                        // Chromatic aberration offset
                        const offset = Math.floor((0.5 + treble * 2 + pulse * 3));

                        pg.fill(r, 0, 0, 180);
                        pg.rect(-offset, y, w + offset * 2, bandH);
                        pg.fill(0, g, 0, 180);
                        pg.rect(0, y, w, bandH);
                        pg.fill(0, 0, b, 180);
                        pg.rect(offset, y, w - offset, bandH);
                    }

                    // Moving scanline (bright horizontal bar)
                    const scanlineY = (t * 2) % h;
                    pg.fill(80 + mid * 80, 255, 80 + treble * 80, 120);
                    pg.rect(0, scanlineY, w, 2);
                    pg.fill(40, 120, 40, 60);
                    pg.rect(0, scanlineY - 3, w, 8);

                    // Horizontal scanlines (darken every other row)
                    pg.fill(0, 0, 0, 80);
                    for (let y = 0; y < h; y += 2) {
                        pg.rect(0, y, w, 1);
                    }

                    // Glitch: horizontal displacement on beat
                    if (pulse > 0.3) {
                        const glitchCount = Math.floor(pulse * 6);
                        for (let i = 0; i < glitchCount; i++) {
                            const gy = Math.floor(Math.random() * h);
                            const gh = 2 + Math.floor(Math.random() * 6);
                            const shift = Math.floor((Math.random() - 0.5) * w * pulse * 0.3);
                            const region = pg.get(0, gy, w, gh);
                            pg.image(region, shift, gy);
                        }
                    }

                    // Barrel distortion border (rounded rect mask)
                    pg.stroke(0);
                    pg.strokeWeight(3);
                    pg.noFill();
                    pg.rect(0, 0, w, h, 4);
                    pg.noStroke();

                    // Corner vignette using corner rects
                    const vigSize = Math.floor(w * 0.15);
                    for (let i = 0; i < vigSize; i++) {
                        const alpha = (1 - i / vigSize) * 100;
                        pg.fill(0, 0, 0, alpha);
                        pg.rect(0, 0, i, h);
                        pg.rect(w - i, 0, i, h);
                        pg.rect(0, 0, w, i);
                        pg.rect(0, h - i, w, i);
                    }

                    // Phosphor flicker
                    const flicker = Math.sin(t * 0.3) * 0.05;
                    if (flicker < 0) {
                        pg.fill(0, 0, 0, Math.abs(flicker) * 255);
                        pg.rect(0, 0, w, h);
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
                    pg.noSmooth();
                    pg.colorMode(p.RGB, 255);
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

    window.VJamFX.presets['crt-monitor'] = CrtMonitorPreset;
})();
