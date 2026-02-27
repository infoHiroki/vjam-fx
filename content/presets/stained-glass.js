(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class StainedGlassPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.panels = [];
        this.lightAngle = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;
        preset.panels = [];

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                preset._buildPanels(p);
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.88;

                const time = p.frameCount * 0.005;
                const bassGlow = preset.audio.bass;
                const flash = preset.beatPulse;

                // Wandering backlight position
                const lightX = p.width * 0.5 + Math.sin(time * 0.7) * p.width * 0.25;
                const lightY = p.height * 0.4 + Math.cos(time * 0.5) * p.height * 0.2;

                // Draw panels as filled polygons
                for (let i = 0; i < preset.panels.length; i++) {
                    const panel = preset.panels[i];
                    const hue = (panel.hue + time * 20) % 360;

                    // Distance from backlight affects brightness
                    const dx = panel.cx - lightX;
                    const dy = panel.cy - lightY;
                    const distFromLight = Math.sqrt(dx * dx + dy * dy);
                    const lightInfluence = Math.max(0, 1 - distFromLight / (p.width * 0.6));

                    const sat = 70 + preset.audio.mid * 15 - flash * 40;
                    const bri = 35 + lightInfluence * 35 + bassGlow * 20 + flash * 30;
                    const alpha = 85 + flash * 15;

                    // Panel fill
                    p.fill(hue, Math.max(sat, 10), Math.min(bri, 100), alpha);
                    p.noStroke();
                    p.beginShape();
                    for (const v of panel.vertices) {
                        p.vertex(v.x, v.y);
                    }
                    p.endShape(p.CLOSE);

                    // Leading (dark border)
                    p.noFill();
                    p.stroke(0, 0, 10 + bassGlow * 8, 90);
                    p.strokeWeight(2.5 + preset.audio.treble * 1.5);
                    p.beginShape();
                    for (const v of panel.vertices) {
                        p.vertex(v.x, v.y);
                    }
                    p.endShape(p.CLOSE);

                    // Inner glow along edges
                    p.stroke(hue, 40, bri + 10, 15 + lightInfluence * 15);
                    p.strokeWeight(1);
                    p.beginShape();
                    for (const v of panel.vertices) {
                        p.vertex(v.x, v.y);
                    }
                    p.endShape(p.CLOSE);
                }

                // Light shaft glow overlay
                p.noStroke();
                const shaftR = 180 + bassGlow * 120;
                p.fill(45, 20, 100, 6 + bassGlow * 8);
                p.ellipse(lightX, lightY, shaftR * 2, shaftR * 2);
                p.fill(45, 15, 100, 3 + bassGlow * 4);
                p.ellipse(lightX, lightY, shaftR * 3.5, shaftR * 3.5);
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
                preset._buildPanels(p);
            };
        }, container);
    }

    _buildPanels(p) {
        // Generate irregular polygonal panels using a grid-jitter approach
        this.panels = [];
        const cols = 6;
        const rows = 5;
        const cellW = p.width / cols;
        const cellH = p.height / rows;

        // Create jittered grid points
        const points = [];
        for (let r = 0; r <= rows; r++) {
            const row = [];
            for (let c = 0; c <= cols; c++) {
                const isEdge = r === 0 || r === rows || c === 0 || c === cols;
                const jitterX = isEdge ? 0 : (Math.random() - 0.5) * cellW * 0.6;
                const jitterY = isEdge ? 0 : (Math.random() - 0.5) * cellH * 0.6;
                row.push({
                    x: c * cellW + jitterX,
                    y: r * cellH + jitterY
                });
            }
            points.push(row);
        }

        // Create quads from grid
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const tl = points[r][c];
                const tr = points[r][c + 1];
                const br = points[r + 1][c + 1];
                const bl = points[r + 1][c];
                const cx = (tl.x + tr.x + br.x + bl.x) / 4;
                const cy = (tl.y + tr.y + br.y + bl.y) / 4;

                this.panels.push({
                    vertices: [tl, tr, br, bl],
                    cx, cy,
                    hue: Math.random() * 360
                });
            }
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
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['stained-glass'] = StainedGlassPreset;
})();
