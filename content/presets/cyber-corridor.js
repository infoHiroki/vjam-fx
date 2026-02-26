(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class CyberCorridorPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;
        this.p5 = new p5((p) => {
            const panels = [];
            const NUM_PANELS = 24;

            function spawnPanel(z) {
                panels.push({
                    z: z,
                    side: p.random() > 0.5 ? 1 : -1,
                    hue: p.random() > 0.5 ? 190 : 310,
                    flash: 0
                });
            }

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                for (let i = 0; i < NUM_PANELS; i++) {
                    spawnPanel(i * 60 + 60);
                }
            };

            p.draw = () => {
                p.background(5, 30, 6);
                preset.beatPulse *= 0.92;

                const cx = p.width / 2;
                const cy = p.height / 2;
                const speed = 2 + preset.audio.bass * 3 + preset.beatPulse * 2;
                const vanishY_top = cy - p.height * 0.05;
                const vanishY_bot = cy + p.height * 0.05;

                // Floor and ceiling grid lines
                p.strokeWeight(0.8);
                for (let d = 50; d < 1200; d += 60) {
                    const s = 600 / d;
                    const floorY = p.lerp(cy, p.height + 50, s);
                    const ceilY = p.lerp(cy, -50, s);
                    const alpha = p.map(d, 50, 1200, 50, 10);

                    p.stroke(190, 60, 40, alpha);
                    p.line(0, floorY, p.width, floorY);
                    p.line(0, ceilY, p.width, ceilY);
                }

                // Vanishing point convergence lines
                p.stroke(190, 50, 30, 25);
                p.strokeWeight(0.5);
                for (let i = 0; i < 8; i++) {
                    const ex = (i / 7) * p.width;
                    p.line(cx, cy, ex, p.height);
                    p.line(cx, cy, ex, 0);
                }

                // Panels sorted by z (far first)
                panels.sort((a, b) => b.z - a.z);

                for (let i = panels.length - 1; i >= 0; i--) {
                    const panel = panels[i];
                    panel.z -= speed;
                    panel.flash *= 0.9;

                    if (panel.z <= 5) {
                        panels.splice(i, 1);
                        spawnPanel(1200 + p.random(100));
                        continue;
                    }

                    const scale = 500 / panel.z;
                    if (scale > 8) continue;

                    const panelW = 120 * scale;
                    const panelH = 80 * scale;
                    const wallX = panel.side > 0
                        ? cx + (p.width * 0.35) * scale
                        : cx - (p.width * 0.35) * scale - panelW;
                    const panelY = cy - panelH / 2;

                    const alpha = p.map(panel.z, 5, 1200, 85, 15);
                    const brightness = 50 + panel.flash * 50;

                    p.stroke(panel.hue, 80, brightness, alpha);
                    p.strokeWeight(p.map(panel.z, 5, 1200, 2, 0.5));
                    p.noFill();
                    p.rect(wallX, panelY, panelW, panelH);

                    // Inner glow bar
                    const barH = panelH * 0.3;
                    const barW = panelW * 0.7 * (0.5 + preset.audio.mid * 0.5);
                    p.fill(panel.hue, 70, brightness, alpha * 0.4);
                    p.noStroke();
                    p.rect(wallX + panelW * 0.15, panelY + panelH * 0.5, barW, barH);
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
        if (this.p5) {
            // Flash random panels on beat - handled via flash property
        }
    }
}

window.VJamFX.presets['cyber-corridor'] = CyberCorridorPreset;
})();
