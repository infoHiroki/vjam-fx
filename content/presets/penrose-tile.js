(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PenroseTilePreset extends BasePreset {
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
            // Penrose rhombus tiles
            let tiles = [];
            let maxGeneration = 3;
            const PHI = (1 + Math.sqrt(5)) / 2;

            function subdivide(triangles) {
                const result = [];
                for (const tri of triangles) {
                    const [type, a, b, c] = tri;
                    if (type === 0) {
                        // Thin rhombus half (type 0)
                        const d = [
                            a[0] + (b[0] - a[0]) / PHI,
                            a[1] + (b[1] - a[1]) / PHI
                        ];
                        result.push([0, c, d, a]);
                        result.push([1, c, d, b]);
                    } else {
                        // Thick rhombus half (type 1)
                        const e = [
                            b[0] + (a[0] - b[0]) / PHI,
                            b[1] + (a[1] - b[1]) / PHI
                        ];
                        const f = [
                            b[0] + (c[0] - b[0]) / PHI,
                            b[1] + (c[1] - b[1]) / PHI
                        ];
                        result.push([1, f, e, a]);
                        result.push([1, f, e, b]); // fix: was missing
                        result.push([0, c, f, a]);
                    }
                }
                return result;
            }

            function generateTiles(gen) {
                // Start with a wheel of triangles
                let triangles = [];
                const cx = 0;
                const cy = 0;
                const r = Math.min(p.width, p.height) * 0.6;
                for (let i = 0; i < 10; i++) {
                    const angle1 = (Math.PI * 2 / 10) * i - Math.PI / 2;
                    const angle2 = (Math.PI * 2 / 10) * (i + 1) - Math.PI / 2;
                    const p1 = [cx + Math.cos(angle1) * r, cy + Math.sin(angle1) * r];
                    const p2 = [cx + Math.cos(angle2) * r, cy + Math.sin(angle2) * r];
                    if (i % 2 === 0) {
                        triangles.push([0, [cx, cy], p1, p2]);
                    } else {
                        triangles.push([0, [cx, cy], p2, p1]);
                    }
                }

                for (let g = 0; g < gen; g++) {
                    triangles = subdivide(triangles);
                }
                return triangles;
            }

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                tiles = generateTiles(maxGeneration);
            };

            p.draw = () => {
                const t = p.frameCount * 0.003 * preset.params.speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.92;

                p.background(0, 0, 5);

                p.push();
                p.translate(p.width / 2, p.height / 2);
                p.rotate(t * 0.2);

                const scale = 1 + pulse * 0.05;
                p.scale(scale);

                for (let i = 0; i < tiles.length; i++) {
                    const [type, a, b, c] = tiles[i];

                    // Color by type
                    let hue, sat, bri;
                    if (type === 0) {
                        hue = (200 + i * 0.1 + t * 20) % 360;
                        sat = 60 + bass * 30;
                        bri = 40 + mid * 30 + pulse * 20;
                    } else {
                        hue = (30 + i * 0.1 + t * 20) % 360;
                        sat = 50 + bass * 30;
                        bri = 50 + mid * 20 + pulse * 20;
                    }

                    p.fill(hue, sat, Math.min(100, bri), 70);
                    p.stroke(0, 0, 100, 15 + pulse * 20);
                    p.strokeWeight(0.5);

                    p.triangle(a[0], a[1], b[0], b[1], c[0], c[1]);
                }

                p.pop();

                // Increase detail on beat
                if (pulse > 0.5 && maxGeneration < 6) {
                    maxGeneration = Math.min(6, maxGeneration + 1);
                    tiles = generateTiles(maxGeneration);
                }
                // Slowly decrease
                if (p.frameCount % 300 === 0 && maxGeneration > 3) {
                    maxGeneration--;
                    tiles = generateTiles(maxGeneration);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                tiles = generateTiles(maxGeneration);
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
window.VJamFX.presets['penrose-tile'] = PenroseTilePreset;
})();
