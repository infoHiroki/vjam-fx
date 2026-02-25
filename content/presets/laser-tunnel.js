(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class LaserTunnelPreset extends BasePreset {
        constructor() {
            super();
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.beatPulse = 0;
        }

        setup(container) {
            this.destroy();
            const preset = this;
            this.p5 = new p5((p) => {
                const frames = [];
                const NUM_FRAMES = 20;
                const GRID_LINES = 6;
                let shakeX = 0, shakeY = 0;

                function spawnFrame(z) {
                    frames.push({ z: z, hue: p.random(160, 200) });
                }

                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.colorMode(p.HSB, 360, 100, 100, 100);
                    for (let i = 0; i < NUM_FRAMES; i++) {
                        spawnFrame(i * 50 + 50);
                    }
                };

                p.draw = () => {
                    p.background(5, 30, 6);
                    preset.beatPulse *= 0.92;

                    shakeX *= 0.9;
                    shakeY *= 0.9;

                    const cx = p.width / 2 + shakeX;
                    const cy = p.height / 2 + shakeY;
                    const speed = 2 + preset.audio.bass * 4 + preset.beatPulse * 3;

                    p.noFill();

                    let w = 0;
                    for (let i = 0; i < frames.length; i++) {
                        const f = frames[i];
                        f.z -= speed;

                        if (f.z <= 1) {
                            spawnFrame(1000);
                            continue;
                        }

                        frames[w++] = f;

                        const scale = 800 / f.z;
                        const hw = (p.width * 0.6) * scale;
                        const hh = (p.height * 0.6) * scale;

                        if (hw > p.width * 3) continue;

                        const alpha = p.map(f.z, 1, 1000, 90, 20);
                        const brightness = 70 + preset.beatPulse * 30;

                        p.stroke(f.hue, 80, brightness, alpha);
                        p.strokeWeight(p.map(f.z, 1, 1000, 2.5, 0.5));

                        const x1 = cx - hw;
                        const y1 = cy - hh;
                        const x2 = cx + hw;
                        const y2 = cy + hh;

                        p.rect(x1, y1, hw * 2, hh * 2);

                        for (let g = 1; g < GRID_LINES; g++) {
                            const t = g / GRID_LINES;
                            const gx = p.lerp(x1, x2, t);
                            const gy = p.lerp(y1, y2, t);
                            p.line(gx, y1, gx, y2);
                            p.line(x1, gy, x2, gy);
                        }
                    }
                    frames.length = w;

                    if (preset.beatPulse > 0.3) {
                        shakeX = p.random(-8, 8) * preset.beatPulse;
                        shakeY = p.random(-8, 8) * preset.beatPulse;
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

    window.VJamFX.presets['laser-tunnel'] = LaserTunnelPreset;
})();
