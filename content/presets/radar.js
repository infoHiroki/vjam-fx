(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class RadarPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.blips = [];
        this.pendingBeats = [];
    }

    setup(container) {
        this.destroy();
        this.blips = [];
        this.pendingBeats = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                p.background(0, 0, 0, 100);

                const cx = p.width / 2;
                const cy = p.height / 2;
                const maxR = Math.min(p.width, p.height) * 0.45;
                const sweepAngle = p.frameCount * 0.02 * preset.params.speed * (1 + preset.audio.bass);
                const hue = 120; // Green radar

                // Spawn blips on beat
                for (const beat of preset.pendingBeats) {
                    const count = Math.floor(3 + beat.strength * 8);
                    for (let i = 0; i < count; i++) {
                        preset.blips.push({
                            angle: Math.random() * p.TWO_PI,
                            dist: 0.1 + Math.random() * 0.9,
                            life: 1.0,
                            size: 3 + Math.random() * 5 * beat.strength,
                        });
                    }
                }
                preset.pendingBeats = [];

                // Ambient blips
                if (Math.random() < 0.05) {
                    preset.blips.push({
                        angle: Math.random() * p.TWO_PI,
                        dist: 0.1 + Math.random() * 0.9,
                        life: 1.0,
                        size: 2 + Math.random() * 3,
                    });
                }

                // Concentric rings
                p.noFill();
                for (let i = 1; i <= 4; i++) {
                    const r = maxR * i / 4;
                    p.stroke(hue, 40, 40, 25);
                    p.strokeWeight(1);
                    p.circle(cx, cy, r * 2);
                }

                // Cross lines
                p.stroke(hue, 30, 30, 20);
                p.line(cx - maxR, cy, cx + maxR, cy);
                p.line(cx, cy - maxR, cx, cy + maxR);

                // Sweep trail (gradient arc)
                const trailLength = p.PI * 0.6;
                const segments = 60;
                for (let i = 0; i < segments; i++) {
                    const ratio = i / segments;
                    const angle = sweepAngle - ratio * trailLength;
                    const alpha = (1 - ratio) * 30 * (1 + preset.audio.rms);

                    p.stroke(hue, 60, 80, alpha);
                    p.strokeWeight(2);
                    const x1 = cx + Math.cos(angle) * 10;
                    const y1 = cy + Math.sin(angle) * 10;
                    const x2 = cx + Math.cos(angle) * maxR;
                    const y2 = cy + Math.sin(angle) * maxR;
                    p.line(x1, y1, x2, y2);
                }

                // Sweep line
                p.stroke(hue, 50, 100, 70);
                p.strokeWeight(2);
                p.line(cx, cy, cx + Math.cos(sweepAngle) * maxR, cy + Math.sin(sweepAngle) * maxR);

                // Draw blips
                for (let i = preset.blips.length - 1; i >= 0; i--) {
                    const blip = preset.blips[i];
                    blip.life -= 0.008;
                    if (blip.life <= 0) {
                        preset.blips.splice(i, 1);
                        continue;
                    }

                    const bx = cx + Math.cos(blip.angle) * blip.dist * maxR;
                    const by = cy + Math.sin(blip.angle) * blip.dist * maxR;
                    const alpha = blip.life * 80;

                    // Glow
                    p.noStroke();
                    p.fill(hue, 50, 100, alpha * 0.3);
                    p.circle(bx, by, blip.size * 3);

                    // Blip
                    p.fill(hue, 40, 100, alpha);
                    p.circle(bx, by, blip.size);
                }

                // Center dot
                p.fill(hue, 30, 100, 60);
                p.noStroke();
                p.circle(cx, cy, 6);
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
        this.pendingBeats.push({ strength });
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['radar'] = RadarPreset;
})();
