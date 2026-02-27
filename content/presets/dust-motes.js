(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// Key 6 - Set D: 木漏れ日の中の塵が浮遊する全面fill
class DustMotesPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.motes = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;
        preset.motes = [];

        this.p5 = new p5((p) => {
            let beams = [];

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.noStroke();
                // Light beams from upper-left with sway parameters
                for (let i = 0; i < 3; i++) {
                    beams.push({
                        baseX: Math.random() * p.width * 0.6,
                        width: 40 + Math.random() * 80,
                        baseAngle: 0.3 + Math.random() * 0.4,
                        hue: 40 + Math.random() * 15,
                        phase: Math.random() * Math.PI * 2,
                        swayPhase: Math.random() * Math.PI * 2,
                        swaySpeed: 0.003 + Math.random() * 0.004,
                        swayAmount: 30 + Math.random() * 50,
                        angleSwayAmount: 0.05 + Math.random() * 0.08,
                    });
                }
                for (let i = 0; i < 120; i++) {
                    preset.motes.push(preset._make(p));
                }
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.93;

                const t = p.frameCount * 0.005 * preset.params.speed;
                const bass = preset.audio.bass;
                const fc = p.frameCount;

                // Draw light beams with slow swaying movement
                for (const beam of beams) {
                    const sway = Math.sin(fc * beam.swaySpeed + beam.swayPhase) * beam.swayAmount;
                    const angleSway = Math.sin(fc * beam.swaySpeed * 0.7 + beam.phase) * beam.angleSwayAmount;
                    const bx = beam.baseX + sway;
                    const angle = beam.baseAngle + angleSway;
                    const bri = 15 + bass * 10 + preset.beatPulse * 8;

                    // Draw beam with gradient fade
                    for (let strip = 0; strip < 3; strip++) {
                        const expand = strip * 15;
                        const alpha = (8 - strip * 2.5);
                        p.fill(beam.hue, 20, bri, alpha);
                        p.beginShape();
                        p.vertex(bx - expand, 0);
                        p.vertex(bx + beam.width + expand, 0);
                        p.vertex(bx + beam.width + expand + p.height * angle, p.height);
                        p.vertex(bx - expand + p.height * angle, p.height);
                        p.endShape(p.CLOSE);
                    }
                }

                // Air current field that shifts over time
                const windAngle = Math.sin(fc * 0.002) * 0.5;
                const windStrength = 0.02 + bass * 0.02;

                // Update and draw motes
                for (let i = preset.motes.length - 1; i >= 0; i--) {
                    const m = preset.motes[i];
                    // Noise-driven drift + global air current
                    const noiseAngle = p.noise(m.nx, m.ny, t * 0.5) * p.TWO_PI * 2;
                    m.vx += Math.cos(noiseAngle) * 0.03 + Math.cos(windAngle) * windStrength;
                    m.vy += Math.sin(noiseAngle) * 0.03 + Math.sin(windAngle) * windStrength - 0.008;
                    // Gentle random wobble for natural float
                    m.vx += (Math.sin(fc * 0.05 + m.phase) * 0.008);
                    m.vy += (Math.cos(fc * 0.04 + m.phase * 1.3) * 0.006);
                    m.vx *= 0.97;
                    m.vy *= 0.97;
                    m.x += m.vx * preset.params.speed;
                    m.y += m.vy * preset.params.speed;
                    m.nx += 0.002;
                    m.life -= 0.001;

                    if (m.x < -10) m.x = p.width + 10;
                    if (m.x > p.width + 10) m.x = -10;
                    if (m.y < -10) m.y = p.height + 10;
                    if (m.y > p.height + 10) m.y = -10;

                    if (m.life <= 0) {
                        preset.motes[i] = preset._make(p);
                        continue;
                    }

                    // Check if mote is in a light beam
                    let inBeam = false;
                    for (const beam of beams) {
                        const sway = Math.sin(fc * beam.swaySpeed + beam.swayPhase) * beam.swayAmount;
                        const angleSway = Math.sin(fc * beam.swaySpeed * 0.7 + beam.phase) * beam.angleSwayAmount;
                        const angle = beam.baseAngle + angleSway;
                        const bLeft = beam.baseX + sway + m.y * angle;
                        const bRight = bLeft + beam.width;
                        if (m.x > bLeft && m.x < bRight) {
                            inBeam = true;
                            break;
                        }
                    }

                    const shimmer = 0.5 + Math.sin(fc * m.shimmerSpeed + m.phase) * 0.5;
                    const brightMul = inBeam ? 2.5 : 1;
                    const a = m.alpha * m.life * shimmer * brightMul;
                    const s = m.size * (1 + bass * 0.3);

                    if (inBeam) {
                        // Warm golden glow in beam — soft halo only, no center dot
                        p.fill(45, 40, 90, a * 0.12);
                        p.ellipse(m.x, m.y, s * 6, s * 6);
                        p.fill(45, 35, 85, a * 0.25);
                        p.ellipse(m.x, m.y, s * 3, s * 3);
                    } else {
                        // Faint soft glow only, no hard center dot
                        p.fill(m.hue, 25, 80, a * 0.3);
                        p.ellipse(m.x, m.y, s * 2, s * 2);
                    }
                }

                while (preset.motes.length < 100) {
                    preset.motes.push(preset._make(p));
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _make(p) {
        return {
            x: Math.random() * p.width,
            y: Math.random() * p.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            nx: Math.random() * 1000,
            ny: Math.random() * 1000,
            size: 2 + Math.random() * 4,
            hue: 35 + Math.random() * 25, // warm golden
            alpha: 40 + Math.random() * 40,
            life: 0.6 + Math.random() * 0.4,
            shimmerSpeed: 0.03 + Math.random() * 0.08,
            phase: Math.random() * Math.PI * 2,
        };
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
window.VJamFX.presets['dust-motes'] = DustMotesPreset;
})();
