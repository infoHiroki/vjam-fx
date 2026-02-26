(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class HelixTunnelPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.offset = 0;
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
            };

            p.draw = () => {
                p.background(0, 0, 0, p.lerp(15, 40, preset.audio.rms));

                const cx = p.width / 2;
                const cy = p.height / 2;
                const speedMult = p.lerp(0.8, 3, preset.audio.rms) * preset.params.speed;
                preset.offset += 0.03 * speedMult;

                const totalPoints = 600;
                const turns = 8;
                const maxDepth = 30;
                const tunnelRadius = Math.min(p.width, p.height) * 0.4;

                // Two helices (double helix)
                for (let helix = 0; helix < 2; helix++) {
                    const helixOffset = helix * p.PI;

                    let prevX = null;
                    let prevY = null;

                    for (let i = 0; i < totalPoints; i++) {
                        const t = i / totalPoints; // 0 = near, 1 = far
                        const depth = 1 + t * maxDepth;
                        const perspective = 1 / depth;

                        // Helix angle
                        const angle = t * turns * p.TWO_PI + preset.offset + helixOffset;

                        // Radius shrinks with perspective
                        const r = tunnelRadius * perspective;

                        // Helix wobble from audio
                        const wobble = preset.audio.bass * 0.3;
                        const rx = r * (1 + wobble * Math.sin(angle * 2));
                        const ry = r * (1 + wobble * Math.cos(angle * 2));

                        const x = cx + Math.cos(angle) * rx;
                        const y = cy + Math.sin(angle) * ry;

                        // Color: neon gradient along depth
                        const hue = (helix * 120 + t * 180 + p.frameCount * 0.5) % 360;
                        const sat = p.lerp(60, 100, preset.audio.treble);
                        const bri = p.lerp(50, 100, perspective);
                        const alpha = p.lerp(5, 85, perspective);

                        const pointSize = p.lerp(0.5, 6, perspective) * (1 + preset.beatPulse * 2);

                        // Draw point
                        p.noStroke();
                        p.fill(hue, sat, bri, alpha);
                        p.ellipse(x, y, pointSize, pointSize);

                        // Connect nearby points with lines
                        if (prevX !== null && i % 2 === 0) {
                            p.stroke(hue, sat, bri, alpha * 0.5);
                            p.strokeWeight(pointSize * 0.3);
                            p.line(prevX, prevY, x, y);
                        }

                        prevX = x;
                        prevY = y;
                    }
                }

                // Cross-connects between helices (rungs)
                const rungCount = 24;
                for (let i = 0; i < rungCount; i++) {
                    const t = i / rungCount;
                    const depth = 1 + t * maxDepth;
                    const perspective = 1 / depth;
                    const angle = t * turns * p.TWO_PI + preset.offset;
                    const r = tunnelRadius * perspective;

                    const x1 = cx + Math.cos(angle) * r;
                    const y1 = cy + Math.sin(angle) * r;
                    const x2 = cx + Math.cos(angle + p.PI) * r;
                    const y2 = cy + Math.sin(angle + p.PI) * r;

                    const hue = (t * 180 + p.frameCount * 0.5) % 360;
                    const alpha = p.lerp(3, 30, perspective) * (1 + preset.audio.mid);

                    p.stroke(hue, 40, 80, alpha);
                    p.strokeWeight(p.lerp(0.3, 2, perspective));
                    p.line(x1, y1, x2, y2);
                }

                // Beat center glow
                if (preset.beatPulse > 0) {
                    p.noStroke();
                    p.fill(180, 50, 100, preset.beatPulse * 25);
                    p.ellipse(cx, cy, preset.beatPulse * 120, preset.beatPulse * 120);
                    preset.beatPulse *= 0.88;
                    if (preset.beatPulse < 0.01) preset.beatPulse = 0;
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                p.background(0);
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

window.VJamFX.presets['helix-tunnel'] = HelixTunnelPreset;
})();
