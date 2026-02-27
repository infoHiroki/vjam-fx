(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class BioluminescencePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.organisms = [];
    }

    setup(container) {
        this.destroy();
        this.organisms = [];
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.background(210, 80, 4);

                // Create organisms
                for (let i = 0; i < 50; i++) {
                    preset.organisms.push(preset._createOrganism(p));
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;

                // Very dark trail for atmosphere
                pg.fill(210, 80, 4, 8);
                pg.noStroke();
                pg.rect(0, 0, pg.width, pg.height);

                for (const org of preset.organisms) {
                    // Update glow phase
                    org.phase += org.phaseSpeed * speed;
                    org.flashTimer *= 0.96;

                    // Drift slowly
                    org.x += Math.cos(org.driftAngle) * org.driftSpeed * speed;
                    org.y += Math.sin(org.driftAngle) * org.driftSpeed * speed;
                    org.driftAngle += (p.noise(org.x * 0.005, org.y * 0.005, p.frameCount * 0.003) - 0.5) * 0.1;

                    // Wrap around
                    if (org.x < -30) org.x = p.width + 30;
                    if (org.x > p.width + 30) org.x = -30;
                    if (org.y < -30) org.y = p.height + 30;
                    if (org.y > p.height + 30) org.y = -30;

                    // Glow intensity
                    const baseGlow = (Math.sin(org.phase) + 1) * 0.5;
                    const flashBoost = org.flashTimer;
                    const beatBoost = pulse * 0.8;
                    const glow = Math.min(1, baseGlow * 0.6 + flashBoost + beatBoost);

                    if (glow < 0.05) continue;

                    const size = org.size;
                    const hue = org.hue;

                    // 3 concentric circles: large dim -> small bright
                    pg.noStroke();

                    // Outer glow
                    pg.fill(hue, 50, 30 + glow * 40, glow * 12);
                    pg.ellipse(org.x, org.y, size * 6, size * 6);

                    // Mid glow
                    pg.fill(hue, 60, 40 + glow * 50, glow * 25);
                    pg.ellipse(org.x, org.y, size * 3, size * 3);

                    // Core
                    pg.fill(hue, 40, 60 + glow * 40, glow * 60);
                    pg.ellipse(org.x, org.y, size, size);
                }

                // Random flash events
                if (Math.random() < 0.02 + preset.audio.treble * 0.05) {
                    const idx = Math.floor(Math.random() * preset.organisms.length);
                    preset.organisms[idx].flashTimer = 1.0;
                }

                p.image(pg, 0, 0);

                // Ambient light rays from above
                if (preset.audio.mid > 0.2) {
                    p.noStroke();
                    const rayX = p.width * 0.3 + Math.sin(p.frameCount * 0.005) * p.width * 0.2;
                    p.fill(190, 20, 60, 3);
                    p.beginShape();
                    p.vertex(rayX - 20, 0);
                    p.vertex(rayX + 20, 0);
                    p.vertex(rayX + 80, p.height);
                    p.vertex(rayX - 80, p.height);
                    p.endShape(p.CLOSE);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                const oldPg = pg;
                if (pg) pg.remove();
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.image(oldPg, 0, 0, p.width, p.height);
                oldPg.remove();
            };
        }, container);
    }

    _createOrganism(p) {
        return {
            x: Math.random() * p.width,
            y: Math.random() * p.height,
            size: 3 + Math.random() * 6,
            hue: 170 + Math.random() * 30, // cyan/blue/green
            phase: Math.random() * Math.PI * 2,
            phaseSpeed: 0.02 + Math.random() * 0.03,
            driftAngle: Math.random() * Math.PI * 2,
            driftSpeed: 0.15 + Math.random() * 0.3,
            flashTimer: 0,
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
        // All organisms flash on beat
        for (const org of this.organisms) {
            org.flashTimer = Math.max(org.flashTimer, strength * 0.7);
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['bioluminescence'] = BioluminescencePreset;
})();
