(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class IceFormationPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.tips = [];
    }

    setup(container) {
        this.destroy();
        this.tips = [];
        const preset = this;

        this.p5 = new p5((p) => {
            let pg;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                pg = p.createGraphics(p.width, p.height);
                pg.colorMode(p.HSB, 360, 100, 100, 100);
                pg.background(210, 15, 5);

                preset._seedCrystals(p);
            };

            preset._seedCrystals = (p) => {
                // Multiple seed points spread across the canvas
                const seeds = [
                    { x: p.width * 0.5, y: p.height * 0.5 },
                    { x: p.width * 0.15, y: p.height * 0.2 },
                    { x: p.width * 0.85, y: p.height * 0.2 },
                    { x: p.width * 0.15, y: p.height * 0.8 },
                    { x: p.width * 0.85, y: p.height * 0.8 },
                    { x: p.width * 0.5, y: p.height * 0.1 },
                    { x: p.width * 0.5, y: p.height * 0.9 },
                ];

                for (const seed of seeds) {
                    const branches = seed === seeds[0] ? 6 : 4;
                    for (let i = 0; i < branches; i++) {
                        const angle = (Math.PI * 2 / branches) * i + Math.random() * 0.3;
                        preset.tips.push({
                            x: seed.x + Math.cos(angle) * 3,
                            y: seed.y + Math.sin(angle) * 3,
                            cx: seed.x,
                            cy: seed.y,
                            angle,
                            speed: 0.8 + Math.random() * 0.5,
                            depth: 0,
                            steps: 0,
                            maxSteps: 140 + Math.floor(Math.random() * 100),
                            hue: 195 + Math.random() * 15,
                            done: false,
                        });
                    }
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                preset.beatPulse *= 0.93;

                // Grow crystal tips
                for (let i = preset.tips.length - 1; i >= 0; i--) {
                    const tip = preset.tips[i];
                    if (tip.done) continue;

                    const prevX = tip.x;
                    const prevY = tip.y;

                    // Biased random walk outward from seed with wobble
                    const outAngle = Math.atan2(tip.y - tip.cy, tip.x - tip.cx);
                    const wobble = (p.noise(tip.x * 0.015, tip.y * 0.015, p.frameCount * 0.003) - 0.5) * 0.5;
                    tip.angle = outAngle + wobble;
                    tip.x += Math.cos(tip.angle) * tip.speed * speed;
                    tip.y += Math.sin(tip.angle) * tip.speed * speed;
                    tip.steps++;

                    // Thickness decreases with depth
                    const thick = Math.max(0.5, 2.8 - tip.depth * 0.35);
                    const bri = 78 - tip.depth * 7;

                    // Draw on 6 symmetry axes around seed center
                    for (let s = 0; s < 6; s++) {
                        const sAngle = (Math.PI * 2 / 6) * s;
                        const rpx = tip.cx + (prevX - tip.cx) * Math.cos(sAngle) - (prevY - tip.cy) * Math.sin(sAngle);
                        const rpy = tip.cy + (prevX - tip.cx) * Math.sin(sAngle) + (prevY - tip.cy) * Math.cos(sAngle);
                        const rnx = tip.cx + (tip.x - tip.cx) * Math.cos(sAngle) - (tip.y - tip.cy) * Math.sin(sAngle);
                        const rny = tip.cy + (tip.x - tip.cx) * Math.sin(sAngle) + (tip.y - tip.cy) * Math.cos(sAngle);

                        pg.stroke(tip.hue, 30, bri, 60);
                        pg.strokeWeight(thick);
                        pg.line(rpx, rpy, rnx, rny);

                        // Mirror for 12-fold
                        const mx = tip.cx + (prevX - tip.cx) * Math.cos(sAngle) + (prevY - tip.cy) * Math.sin(sAngle);
                        const my = tip.cy - (prevX - tip.cx) * Math.sin(sAngle) + (prevY - tip.cy) * Math.cos(sAngle);
                        const mnx = tip.cx + (tip.x - tip.cx) * Math.cos(sAngle) + (tip.y - tip.cy) * Math.sin(sAngle);
                        const mny = tip.cy - (tip.x - tip.cx) * Math.sin(sAngle) + (tip.y - tip.cy) * Math.cos(sAngle);
                        pg.stroke(tip.hue, 25, bri * 0.9, 45);
                        pg.strokeWeight(thick * 0.75);
                        pg.line(mx, my, mnx, mny);
                    }

                    // Branch — more aggressive branching for fuller coverage
                    if (tip.steps > 6 && Math.random() < 0.035 + preset.beatPulse * 0.03 && tip.depth < 6) {
                        const branchDir = Math.random() > 0.5 ? 1 : -1;
                        preset.tips.push({
                            x: tip.x,
                            y: tip.y,
                            cx: tip.cx,
                            cy: tip.cy,
                            angle: tip.angle + branchDir * (0.4 + Math.random() * 0.5),
                            speed: tip.speed * 0.85,
                            depth: tip.depth + 1,
                            steps: 0,
                            maxSteps: tip.maxSteps * 0.55,
                            hue: tip.hue + (Math.random() - 0.5) * 6,
                            done: false,
                        });
                    }

                    // Stop when off-screen or max steps
                    const offScreen = tip.x < -20 || tip.x > p.width + 20 ||
                                      tip.y < -20 || tip.y > p.height + 20;
                    if (tip.steps >= tip.maxSteps || offScreen) {
                        tip.done = true;
                    }
                }

                // Remove done tips if too many
                if (preset.tips.length > 600) {
                    preset.tips = preset.tips.filter(t => !t.done);
                }

                // If no active tips, restart crystals
                if (!preset.tips.some(t => !t.done)) {
                    // Slow fade
                    pg.fill(210, 15, 5, 4);
                    pg.noStroke();
                    pg.rect(0, 0, pg.width, pg.height);
                    // New seeds
                    preset._seedCrystals(p);
                }

                // Beat: new growth tips at random positions
                if (preset.beatPulse > 0.3) {
                    for (let i = 0; i < 4; i++) {
                        const bx = Math.random() * p.width;
                        const by = Math.random() * p.height;
                        const angle = Math.random() * Math.PI * 2;
                        preset.tips.push({
                            x: bx + Math.cos(angle) * 5,
                            y: by + Math.sin(angle) * 5,
                            cx: bx,
                            cy: by,
                            angle,
                            speed: 0.8 + Math.random() * 0.5,
                            depth: 1,
                            steps: 0,
                            maxSteps: 60 + Math.floor(Math.random() * 50),
                            hue: 198 + Math.random() * 12,
                            done: false,
                        });
                    }
                }

                // Render
                p.background(210, 15, 5);
                p.image(pg, 0, 0);

                // Glow at each seed point
                p.noStroke();
                const seeds = [
                    [0.5, 0.5], [0.15, 0.2], [0.85, 0.2],
                    [0.15, 0.8], [0.85, 0.8], [0.5, 0.1], [0.5, 0.9]
                ];
                for (const [sx, sy] of seeds) {
                    p.fill(200, 20, 45, 3 + preset.audio.mid * 4);
                    p.ellipse(sx * p.width, sy * p.height, 60, 60);
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
window.VJamFX.presets['ice-formation'] = IceFormationPreset;
})();
