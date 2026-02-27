(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class SmokeStackPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.columns = [];
        this.embers = [];
    }

    setup(container) {
        this.destroy();
        this.columns = [];
        this.embers = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.noStroke();
                preset._initColumns(p);
            };

            p.draw = () => {
                p.background(0, 0, 0, 100);
                preset.beatPulse *= 0.9;

                const time = p.frameCount * 0.01;

                // Update and draw each smoke column
                for (const col of preset.columns) {
                    preset._updateColumn(p, col, time);
                    preset._drawColumn(p, col, time);
                }

                // Embers
                // Spawn embers occasionally
                if (p.frameCount % 10 === 0) {
                    const col = preset.columns[Math.floor(Math.random() * preset.columns.length)];
                    preset.embers.push({
                        x: col.baseX + (Math.random() - 0.5) * 20,
                        y: p.height,
                        vx: (Math.random() - 0.5) * 0.5,
                        vy: -(1 + Math.random() * 2),
                        life: 0.7 + Math.random() * 0.5,
                        hue: col.hue,
                        size: 1.5 + Math.random() * 2
                    });
                }

                // Update and draw embers
                for (let i = preset.embers.length - 1; i >= 0; i--) {
                    const em = preset.embers[i];
                    em.x += em.vx + Math.sin(p.frameCount * 0.03 + em.life * 10) * 0.3;
                    em.y += em.vy;
                    em.life -= 0.015;
                    if (em.life <= 0) {
                        preset.embers.splice(i, 1);
                        continue;
                    }
                    const alpha = em.life * 60;
                    p.fill(em.hue, 70, 100, alpha);
                    p.circle(em.x, em.y, em.size);
                    p.fill(em.hue, 30, 100, alpha * 0.5);
                    p.circle(em.x, em.y, em.size * 2);
                }

                if (preset.embers.length > 60) {
                    preset.embers.splice(0, preset.embers.length - 60);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                preset._initColumns(p);
            };
        }, container);
    }

    _initColumns(p) {
        this.columns = [];
        const columnColors = [
            { hue: 185, name: 'cyan' },
            { hue: 300, name: 'magenta' },
            { hue: 130, name: 'green' },
            { hue: 30,  name: 'orange' },
            { hue: 270, name: 'purple' }
        ];
        const count = columnColors.length;
        const spacing = p.width / (count + 1);

        for (let i = 0; i < count; i++) {
            const puffs = [];
            // Pre-populate some puffs
            for (let j = 0; j < 20; j++) {
                puffs.push(this._createPuff(p, spacing * (i + 1), p.height - Math.random() * p.height * 0.6));
            }
            this.columns.push({
                baseX: spacing * (i + 1),
                hue: columnColors[i].hue,
                puffs: puffs,
                noiseOffset: Math.random() * 1000
            });
        }
    }

    _createPuff(p, baseX, y) {
        return {
            x: baseX + (Math.random() - 0.5) * 15,
            y: y || p.height + Math.random() * 10,
            size: 15 + Math.random() * 20,
            speed: 0.5 + Math.random() * 1.0,
            noiseX: Math.random() * 1000,
            alpha: 30 + Math.random() * 20,
            age: y ? (p.height - y) / p.height : 0
        };
    }

    _updateColumn(p, col, time) {
        const thicken = this.beatPulse * 15;

        // Spawn new puffs from bottom
        if (p.frameCount % 3 === 0) {
            col.puffs.push(this._createPuff(p, col.baseX));
        }
        // Extra puffs on beat
        if (this.beatPulse > 0.3 && p.frameCount % 2 === 0) {
            const puff = this._createPuff(p, col.baseX);
            puff.size += thicken;
            puff.alpha += 15;
            col.puffs.push(puff);
        }

        // Update puffs
        for (let i = col.puffs.length - 1; i >= 0; i--) {
            const puff = col.puffs[i];
            puff.y -= puff.speed + this.audio.bass * 0.5;
            puff.age += 0.003;

            // Noise-based horizontal drift
            const drift = (p.noise(puff.noiseX, time * 0.5) - 0.5) * 3;
            puff.x += drift;

            // Expand as it rises
            puff.size += 0.3 + this.audio.rms * 0.2;

            // Fade as it rises
            puff.alpha -= 0.15;

            if (puff.alpha <= 0 || puff.y < -puff.size) {
                col.puffs.splice(i, 1);
            }
        }

        // Cap puff count per column
        if (col.puffs.length > 50) {
            col.puffs.splice(0, col.puffs.length - 50);
        }
    }

    _drawColumn(p, col, time) {
        // Sort puffs by y (draw bottom-up so upper smoke overlaps)
        const sorted = col.puffs.slice().sort((a, b) => b.y - a.y);

        for (const puff of sorted) {
            const riseRatio = Math.max(0, 1 - (p.height - puff.y) / p.height);
            const sat = 60 + riseRatio * 20;
            const bri = 70 + riseRatio * 20;
            const alpha = Math.max(0, puff.alpha);

            // Outer glow
            p.fill(col.hue, sat * 0.6, bri, alpha * 0.25);
            p.ellipse(puff.x, puff.y, puff.size * 1.8, puff.size * 1.5);

            // Main smoke body
            p.fill(col.hue, sat, bri, alpha * 0.5);
            p.ellipse(puff.x, puff.y, puff.size * 1.2, puff.size);

            // Bright core
            p.fill(col.hue, sat * 0.4, 100, alpha * 0.3);
            p.ellipse(puff.x, puff.y, puff.size * 0.5, puff.size * 0.4);
        }
    }

    updateAudio(audioData) {
        this.audio.bass = audioData.bass || 0;
        this.audio.mid = audioData.mid || 0;
        this.audio.treble = audioData.treble || 0;
        this.audio.rms = audioData.rms || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        // Burst of embers on beat
        if (this.p5) {
            for (const col of this.columns) {
                if (Math.random() < 0.6) {
                    for (let i = 0; i < 3; i++) {
                        this.embers.push({
                            x: col.baseX + (Math.random() - 0.5) * 30,
                            y: this.p5.height - Math.random() * 20,
                            vx: (Math.random() - 0.5) * 2,
                            vy: -(2 + Math.random() * 3),
                            life: 0.6 + Math.random() * 0.5,
                            hue: col.hue,
                            size: 2 + Math.random() * 2.5
                        });
                    }
                }
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['smoke-stack'] = SmokeStackPreset;
})();
