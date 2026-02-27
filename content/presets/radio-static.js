(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class RadioStaticPreset extends BasePreset {
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
            const BAND_COUNT = 50;
            let signalY = 0.5;
            let signalDir = 1;
            let lockTimer = 0;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(Math.ceil(p.width / RES), Math.ceil(p.height / RES));
                pg.colorMode(p.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.015 * speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const rms = preset.audio.rms;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.9;

                const w = pg.width;
                const h = pg.height;
                const bandH = h / BAND_COUNT;

                pg.background(0, 0, 3, 100);

                // Scanning signal position
                if (lockTimer > 0) {
                    lockTimer -= speed;
                } else {
                    signalY += signalDir * 0.003 * speed;
                    if (signalY > 0.85 || signalY < 0.15) signalDir *= -1;
                }

                // Beat: lock onto signal
                if (pulse > 0.3) {
                    lockTimer = 30;
                }

                const signalBand = Math.floor(signalY * BAND_COUNT);
                const signalWidth = 4 + Math.floor(bass * 3);

                // Draw horizontal bands
                for (let i = 0; i < BAND_COUNT; i++) {
                    const by = i * bandH;
                    const noiseVal = p.noise(i * 0.5, t + i * 0.1);
                    const distToSignal = Math.abs(i - signalBand);
                    const isSignal = distToSignal < signalWidth;

                    if (isSignal && lockTimer > 0) {
                        // Tuned signal: warm amber
                        const clarity = 1 - distToSignal / signalWidth;
                        const signalNoise = p.noise(i * 0.3, t * 0.5);
                        const bri = 50 + clarity * 40 + signalNoise * 15;
                        pg.noStroke();
                        pg.fill(35, 50 + clarity * 30, bri, 85 + clarity * 15);
                        pg.rect(0, by, w, bandH + 0.5);

                        // Signal waveform within tuned bands
                        pg.stroke(35, 60, 90, 70 * clarity);
                        pg.strokeWeight(0.8);
                        pg.noFill();
                        for (let x = 0; x < w; x += 2) {
                            const waveY = by + bandH / 2 + Math.sin(x * 0.1 + t * 3 + i) * bandH * 0.3 * clarity;
                            pg.point(x, waveY);
                        }
                    } else {
                        // Static noise
                        const bri = noiseVal * 30 + Math.random() * 15;
                        pg.noStroke();
                        pg.fill(0, 0, bri, 70);
                        pg.rect(0, by, w, bandH + 0.5);

                        // Noise speckles within band
                        const speckleCount = 3 + Math.floor(treble * 5);
                        for (let s = 0; s < speckleCount; s++) {
                            const sx = Math.random() * w;
                            const sy = by + Math.random() * bandH;
                            const sv = Math.random() * 40 + 10;
                            pg.fill(0, 0, sv, 50);
                            pg.rect(sx, sy, 1 + Math.random() * 2, 0.5);
                        }
                    }
                }

                // Occasional interference lines
                if (Math.random() < 0.05 + rms * 0.1) {
                    const iy = Math.random() * h;
                    pg.stroke(35, 30, 60, 40);
                    pg.strokeWeight(0.5);
                    pg.line(0, iy, w, iy);
                }

                // Signal strength meter (right side)
                const meterX = w - 8;
                const meterH = h * 0.6;
                const meterY = h * 0.2;
                pg.noStroke();
                pg.fill(0, 0, 15, 60);
                pg.rect(meterX - 1, meterY, 6, meterH);

                const signalStrength = lockTimer > 0 ? 0.7 + bass * 0.3 : 0.1 + rms * 0.2;
                const filledH = meterH * signalStrength;
                // Gradient meter bars
                const barCount = 15;
                for (let b = 0; b < barCount; b++) {
                    const frac = b / barCount;
                    if (frac < signalStrength) {
                        const hue = frac < 0.5 ? 0 : (frac < 0.8 ? 35 : 130);
                        pg.fill(hue, 60, 70 + frac * 30, 80);
                        const barY = meterY + meterH - (b + 1) * (meterH / barCount);
                        pg.rect(meterX, barY, 4, meterH / barCount - 0.5);
                    }
                }

                // Glow around signal region
                if (lockTimer > 0) {
                    const glowY = signalBand * bandH;
                    const glowH = signalWidth * bandH * 2;
                    for (let g = 2; g > 0; g--) {
                        pg.fill(35, 40, 50, 5 / g);
                        pg.noStroke();
                        pg.rect(0, glowY - glowH * g * 0.3, w, glowH * (1 + g * 0.3));
                    }
                }

                // Scanline effect
                pg.stroke(0, 0, 0, 15);
                pg.strokeWeight(0.3);
                for (let y = 0; y < h; y += 3) {
                    pg.line(0, y, w, y);
                }

                // Beat flash
                if (pulse > 0.5) {
                    pg.fill(35, 30, 80, pulse * 20);
                    pg.noStroke();
                    pg.rect(0, 0, w, h);
                }

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
window.VJamFX.presets['radio-static'] = RadioStaticPreset;
})();
