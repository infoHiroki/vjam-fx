(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class ErosionLinePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.lines = [];
    }

    setup(container) {
        this.destroy();
        this.lines = [];
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.background(0, 0, 0);

                // Spawn initial frame lines along all four edges
                for (let i = 0; i < 40; i++) {
                    preset._spawnLine(p);
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.002 * speed;
                preset.beatPulse *= 0.93;

                const margin = Math.min(p.width, p.height) * 0.22;

                // Slow pg fade for long trails
                if (p.frameCount % 40 === 0) {
                    pg.fill(0, 0, 0, 3);
                    pg.noStroke();
                    pg.rect(0, 0, pg.width, pg.height);
                }

                // Update flow lines
                for (let i = preset.lines.length - 1; i >= 0; i--) {
                    const ln = preset.lines[i];
                    if (ln.done) continue;

                    const prevX = ln.x;
                    const prevY = ln.y;

                    // Flow along the edge — direction depends on which edge
                    const n = p.noise(ln.x * 0.005, ln.y * 0.005, t);
                    const turbulence = (n - 0.5) * 2;

                    // Move along edge with inward/outward turbulence
                    let moveX = 0, moveY = 0;
                    const edgeSpeed = 0.8 + preset.audio.mid * 0.5;

                    if (ln.edge === 0) { // top — move right, turbulence pushes down
                        moveX = edgeSpeed * ln.dir;
                        moveY = turbulence * 1.5;
                        // Keep near top edge
                        moveY += (margin * 0.5 - ln.y) * 0.003;
                    } else if (ln.edge === 1) { // bottom — move left, turbulence pushes up
                        moveX = edgeSpeed * ln.dir;
                        moveY = turbulence * 1.5;
                        moveY += (p.height - margin * 0.5 - ln.y) * 0.003;
                    } else if (ln.edge === 2) { // left — move down, turbulence pushes right
                        moveY = edgeSpeed * ln.dir;
                        moveX = turbulence * 1.5;
                        moveX += (margin * 0.5 - ln.x) * 0.003;
                    } else { // right — move up, turbulence pushes left
                        moveY = edgeSpeed * ln.dir;
                        moveX = turbulence * 1.5;
                        moveX += (p.width - margin * 0.5 - ln.x) * 0.003;
                    }

                    ln.x += moveX * speed;
                    ln.y += moveY * speed;
                    ln.steps++;

                    // Hue: organic tones — greens, browns, teals, oxidized copper
                    const progress = ln.steps / ln.maxSteps;
                    const hue = (ln.baseHue + progress * 40) % 360;
                    const sat = 30 + preset.audio.treble * 15;
                    const bri = 40 + (1 - progress) * 30 + preset.audio.bass * 12;
                    const thick = Math.max(0.3, ln.thickness * (1 - progress * 0.6));

                    // Draw segment
                    pg.stroke(hue, sat, bri, 35);
                    pg.strokeWeight(thick);
                    pg.line(prevX, prevY, ln.x, ln.y);

                    // Glow
                    pg.stroke(hue, sat * 0.4, bri * 0.5, 8);
                    pg.strokeWeight(thick * 3);
                    pg.line(prevX, prevY, ln.x, ln.y);

                    // Fork into decorative branch toward center
                    if (ln.steps > 10 && Math.random() < 0.012 + preset.beatPulse * 0.02 && ln.forks < 2) {
                        const branchDir = (ln.edge <= 1)
                            ? { x: 0, y: ln.edge === 0 ? 1 : -1 }
                            : { x: ln.edge === 2 ? 1 : -1, y: 0 };
                        preset.lines.push({
                            x: ln.x,
                            y: ln.y,
                            edge: ln.edge,
                            dir: ln.dir,
                            thickness: thick * 0.6,
                            steps: 0,
                            maxSteps: Math.floor(ln.maxSteps * 0.3),
                            baseHue: ln.baseHue + 20,
                            forks: ln.forks + 1,
                            done: false,
                            branchX: branchDir.x,
                            branchY: branchDir.y,
                            isBranch: true,
                        });
                    }

                    // Branch lines grow inward then curl
                    if (ln.isBranch) {
                        const curlAmount = Math.sin(ln.steps * 0.15) * 0.8;
                        ln.x += ln.branchX * 0.5 * speed;
                        ln.y += ln.branchY * 0.5 * speed;
                        ln.x += curlAmount * ln.branchY * speed;
                        ln.y += curlAmount * -ln.branchX * speed;
                    }

                    // Erosion texture dots along edges
                    if (Math.random() < 0.1) {
                        pg.noStroke();
                        pg.fill(hue - 10, sat + 10, bri * 0.5, 12);
                        const ox = (Math.random() - 0.5) * 8;
                        const oy = (Math.random() - 0.5) * 8;
                        pg.ellipse(ln.x + ox, ln.y + oy, 1.5 + Math.random() * 2.5, 1.5 + Math.random() * 2.5);
                    }

                    // Stop condition
                    if (ln.steps >= ln.maxSteps || ln.x < -30 || ln.x > p.width + 30 ||
                        ln.y < -30 || ln.y > p.height + 30) {
                        ln.done = true;
                    }
                }

                // Remove done lines
                if (preset.lines.length > 300) {
                    preset.lines = preset.lines.filter(l => !l.done);
                }

                // Respawn if too few active
                const activeCount = preset.lines.filter(l => !l.done).length;
                if (activeCount < 15) {
                    for (let i = 0; i < 8; i++) {
                        preset._spawnLine(p);
                    }
                }

                // Beat: spawn burst along edges
                if (preset.beatPulse > 0.3) {
                    const count = Math.floor(4 + preset.beatPulse * 6);
                    for (let i = 0; i < count; i++) {
                        preset._spawnLine(p);
                    }
                }

                // Render
                p.background(0);
                p.image(pg, 0, 0);

                // Corner accent glows
                p.noStroke();
                const cornerGlow = 6 + preset.audio.rms * 10 + preset.beatPulse * 5;
                const cornerSize = margin * 0.8;
                const corners = [
                    [0, 0], [p.width, 0],
                    [0, p.height], [p.width, p.height],
                ];
                for (let ci = 0; ci < corners.length; ci++) {
                    const [cx, cy] = corners[ci];
                    const cHue = (120 + ci * 30 + p.frameCount * 0.1) % 360;
                    p.fill(cHue, 20, 30, cornerGlow * 0.3);
                    p.ellipse(cx, cy, cornerSize, cornerSize);
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

    _spawnLine(p) {
        const margin = Math.min(p.width, p.height) * 0.22;
        // Pick a random edge: 0=top, 1=bottom, 2=left, 3=right
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        const jitter = (Math.random() - 0.5) * margin * 0.6;

        if (edge === 0) { // top
            x = Math.random() * p.width;
            y = jitter + margin * 0.15;
        } else if (edge === 1) { // bottom
            x = Math.random() * p.width;
            y = p.height + jitter - margin * 0.15;
        } else if (edge === 2) { // left
            x = jitter + margin * 0.15;
            y = Math.random() * p.height;
        } else { // right
            x = p.width + jitter - margin * 0.15;
            y = Math.random() * p.height;
        }

        // Organic hues: greens, teals, browns, copper
        const hueOptions = [80, 120, 160, 30, 45, 180];
        const baseHue = hueOptions[Math.floor(Math.random() * hueOptions.length)] + Math.random() * 20;

        this.lines.push({
            x: x,
            y: y,
            edge: edge,
            dir: Math.random() < 0.5 ? 1 : -1,
            thickness: 0.6 + Math.random() * 1.5,
            steps: 0,
            maxSteps: 80 + Math.floor(Math.random() * 120),
            baseHue: baseHue,
            forks: 0,
            done: false,
            isBranch: false,
            branchX: 0,
            branchY: 0,
        });
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
window.VJamFX.presets['erosion-line'] = ErosionLinePreset;
})();
