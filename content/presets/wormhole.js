(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class WormholePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.streaks = [];
        this.rings = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.background(0);
                preset._initStreaks(p);
            };

            p.draw = () => {
                p.fill(0, 0, 0, p.lerp(10, 30, preset.audio.rms));
                p.noStroke();
                p.rect(0, 0, p.width, p.height);

                const cx = p.width / 2;
                const cy = p.height / 2;
                const maxR = Math.sqrt(cx * cx + cy * cy);
                const time = p.frameCount * 0.02 * preset.params.speed;

                // Draw spiral rings converging inward
                const ringCount = 12;
                for (let i = 0; i < ringCount; i++) {
                    const phase = (time * 0.5 + i / ringCount) % 1;
                    const r = maxR * phase;
                    const alpha = p.map(phase, 0, 1, 80, 5);
                    const hue = (240 + i * 15 + p.frameCount * 0.5) % 360;
                    const weight = p.lerp(4, 0.5, phase);

                    p.noFill();
                    p.stroke(hue, 60, 90, alpha);
                    p.strokeWeight(weight * (1 + preset.audio.bass * 2));

                    p.beginShape();
                    for (let a = 0; a < p.TWO_PI; a += 0.1) {
                        const wobble = p.sin(a * 3 + time * 2) * 10 * preset.audio.mid;
                        const px = cx + Math.cos(a) * (r + wobble);
                        const py = cy + Math.sin(a) * (r + wobble);
                        p.vertex(px, py);
                    }
                    p.endShape(p.CLOSE);
                }

                // Draw light streaks converging toward center
                for (let i = 0; i < preset.streaks.length; i++) {
                    const s = preset.streaks[i];
                    const speedMult = p.lerp(1, 4, preset.audio.rms) * preset.params.speed;

                    // Move inward
                    s.r -= s.speed * speedMult;

                    // Spiral rotation
                    s.angle += s.rotSpeed;

                    if (s.r < 5) {
                        // Respawn at edge
                        s.r = maxR + Math.random() * 50;
                        s.angle = Math.random() * p.TWO_PI;
                        s.speed = 1.5 + Math.random() * 2.5;
                    }

                    const x = cx + Math.cos(s.angle) * s.r;
                    const y = cy + Math.sin(s.angle) * s.r;
                    const tailLen = s.speed * speedMult * 8;
                    const tx = cx + Math.cos(s.angle) * (s.r + tailLen);
                    const ty = cy + Math.sin(s.angle) * (s.r + tailLen);

                    const proximity = 1 - s.r / maxR;
                    const hue = (260 + proximity * 60) % 360;
                    const bri = p.lerp(40, 100, proximity);
                    const alpha = p.lerp(20, 90, proximity);

                    p.stroke(hue, 50, bri, alpha);
                    p.strokeWeight(p.lerp(0.5, 3, proximity));
                    p.line(x, y, tx, ty);
                }

                // Beat burst: spawn extra streaks toward center
                if (preset.beatPulse > 0) {
                    p.noStroke();
                    const burstAlpha = preset.beatPulse * 40;
                    const burstR = (1 - preset.beatPulse) * 100;
                    p.fill(270, 30, 100, burstAlpha);
                    p.ellipse(cx, cy, burstR, burstR);
                    preset.beatPulse *= 0.9;
                    if (preset.beatPulse < 0.01) preset.beatPulse = 0;
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                p.background(0);
            };
        }, container);
    }

    _initStreaks(p) {
        this.streaks = [];
        const maxR = Math.sqrt((p.width / 2) ** 2 + (p.height / 2) ** 2);
        for (let i = 0; i < 200; i++) {
            this.streaks.push({
                r: Math.random() * maxR,
                angle: Math.random() * Math.PI * 2,
                speed: 1.5 + Math.random() * 2.5,
                rotSpeed: (Math.random() - 0.5) * 0.02,
            });
        }
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

window.VJamFX.presets['wormhole'] = WormholePreset;
})();
