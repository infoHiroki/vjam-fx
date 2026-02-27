(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class HologramPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.fragments = [];
    }

    setup(container) {
        this.destroy();
        this.fragments = [];
        const preset = this;

        this.p5 = new p5((p) => {
            const RES = 3;
            let pg;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                pg = p.createGraphics(
                    Math.floor(p.width / RES),
                    Math.floor(p.height / RES)
                );
                pg.colorMode(pg.RGB, 255);
                // Init fragments
                for (let i = 0; i < 12; i++) {
                    preset.fragments.push(preset._makeFragment(pg));
                }
            };

            p.draw = () => {
                preset.beatPulse *= 0.9;
                const bass = preset.audio.bass;
                const distortion = preset.beatPulse * 0.6 + bass * 0.2;

                pg.background(5, 3, 15);

                // Scan lines moving up
                const scanY = (p.frameCount * 1.5) % pg.height;
                pg.noStroke();
                for (let y = 0; y < pg.height; y += 2) {
                    const scanDist = Math.abs(y - scanY);
                    const scanAlpha = Math.max(0, 30 - scanDist * 0.8);
                    pg.fill(0, 255, 255, scanAlpha + 5);
                    // Horizontal displacement on beat
                    const dx = scanDist < 20 ? distortion * (Math.random() - 0.5) * 15 : 0;
                    pg.rect(dx, y, pg.width, 1);
                }

                // Draw geometric fragments
                for (const frag of preset.fragments) {
                    frag.angle += frag.rotSpeed;
                    frag.y += frag.dy;
                    if (frag.y > pg.height + 20) {
                        Object.assign(frag, preset._makeFragment(pg));
                        frag.y = -20;
                    }

                    pg.push();
                    pg.translate(frag.x, frag.y);
                    pg.rotate(frag.angle);

                    // Occasional jitter displacement
                    if (distortion > 0.3 && Math.random() < 0.3) {
                        pg.translate((Math.random() - 0.5) * 10, 0);
                    }

                    // Glow
                    pg.noFill();
                    pg.stroke(0, 255, 255, 40 + preset.beatPulse * 60);
                    pg.strokeWeight(2);
                    preset._drawTriShape(pg, frag.size * 1.3);

                    // Core
                    pg.stroke(frag.cr, frag.cg, frag.cb, 120 + preset.beatPulse * 80);
                    pg.strokeWeight(1);
                    preset._drawTriShape(pg, frag.size);

                    pg.pop();
                }

                // Horizontal glitch bands on beat
                if (preset.beatPulse > 0.4) {
                    const numBands = Math.floor(preset.beatPulse * 5);
                    for (let i = 0; i < numBands; i++) {
                        const by = Math.random() * pg.height;
                        const bh = 1 + Math.random() * 3;
                        pg.fill(0, 255, 255, preset.beatPulse * 60);
                        pg.noStroke();
                        pg.rect(0, by, pg.width, bh);
                    }
                }

                // Render to main canvas
                p.image(pg, 0, 0, p.width, p.height);

                // Scanline overlay on main canvas for crispness
                p.stroke(0, 255, 255, 8);
                p.strokeWeight(1);
                for (let y = 0; y < p.height; y += 4) {
                    p.line(0, y, p.width, y);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                if (pg) pg.remove();
                pg = p.createGraphics(
                    Math.floor(p.width / RES),
                    Math.floor(p.height / RES)
                );
                pg.colorMode(pg.RGB, 255);
            };
        }, container);
    }

    _makeFragment(pg) {
        const isCyan = Math.random() > 0.4;
        return {
            x: Math.random() * pg.width,
            y: Math.random() * pg.height,
            size: 5 + Math.random() * 15,
            angle: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.03,
            dy: 0.2 + Math.random() * 0.5,
            cr: isCyan ? 0 : 180,
            cg: isCyan ? 255 : 0,
            cb: 255,
        };
    }

    _drawTriShape(g, size) {
        g.beginShape();
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
            g.vertex(Math.cos(a) * size, Math.sin(a) * size);
        }
        g.endShape(g.CLOSE);
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
window.VJamFX.presets['hologram'] = HologramPreset;
})();
