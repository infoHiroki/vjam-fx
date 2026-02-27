(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class AutumnFallPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.leaves = [];
        this.gustForce = 0;
    }

    setup(container) {
        this.destroy();
        this.leaves = [];
        this.gustForce = 0;
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.background(0);
                for (let i = 0; i < 70; i++) {
                    preset._spawnLeaf(p, true);
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.005 * speed;
                preset.beatPulse *= 0.9;
                preset.gustForce *= 0.95;

                // Black background for screen blend
                p.background(0);

                // Subtle warm ambient glow at bottom
                p.noStroke();
                p.fill(25, 40, 15, 10);
                p.rect(0, p.height * 0.8, p.width, p.height * 0.2);

                const windBase = Math.sin(t * 0.7) * 0.8;

                for (let i = preset.leaves.length - 1; i >= 0; i--) {
                    const lf = preset.leaves[i];

                    // Wind from noise + gust + global sway
                    const wind = (p.noise(lf.y * 0.005, t) * 3 - 1.5) + preset.gustForce + windBase;
                    lf.vx += wind * 0.02;
                    lf.vx *= 0.98;
                    lf.vy += 0.03 + lf.weight * 0.01;
                    lf.vy *= 0.99;

                    lf.x += lf.vx * speed;
                    lf.y += lf.vy * speed;

                    // Tumbling rotation — varies with speed
                    const tumbleSpeed = Math.abs(lf.vx) * 0.03 + Math.abs(lf.vy) * 0.02;
                    lf.rot += (lf.rotSpeed + tumbleSpeed * lf.rotDir) * speed;
                    lf.rotSpeed += (p.noise(lf.x * 0.01, lf.y * 0.01, t) - 0.5) * 0.008;

                    // Flutter — simulates leaf flipping in air
                    lf.flutter += lf.flutterSpeed * speed;
                    const flipScale = Math.cos(lf.flutter);

                    // Pile at bottom
                    if (lf.y > p.height - 18) {
                        lf.y = p.height - 18;
                        lf.vy = 0;
                        lf.vx *= 0.9;
                        lf.rotSpeed *= 0.9;
                        lf.piled = true;
                    }

                    // Wrap horizontal
                    if (lf.x > p.width + 40) lf.x = -40;
                    if (lf.x < -40) lf.x = p.width + 40;

                    // Draw realistic leaf using bezier curves
                    p.push();
                    p.translate(lf.x, lf.y);
                    p.rotate(lf.rot);
                    p.scale(flipScale, 1);

                    const sz = lf.size;
                    const bri = lf.piled ? lf.bri * 0.5 : lf.bri;
                    const alpha = lf.piled ? 50 : 75;

                    // Leaf body — two bezier lobes forming a leaf shape
                    p.noStroke();
                    p.fill(lf.hue, lf.sat, bri, alpha);
                    p.beginShape();
                    // Tip of leaf
                    p.vertex(sz * 0.9, 0);
                    // Upper edge curve
                    p.bezierVertex(
                        sz * 0.5, -sz * 0.35,
                        sz * 0.1, -sz * 0.25,
                        -sz * 0.3, 0
                    );
                    // Lower edge curve back to tip
                    p.bezierVertex(
                        sz * 0.1, sz * 0.25,
                        sz * 0.5, sz * 0.35,
                        sz * 0.9, 0
                    );
                    p.endShape(p.CLOSE);

                    // Secondary color overlay — vein area
                    p.fill((lf.hue + 10) % 360, lf.sat - 10, bri * 0.7, alpha * 0.5);
                    p.beginShape();
                    p.vertex(sz * 0.7, 0);
                    p.bezierVertex(
                        sz * 0.4, -sz * 0.15,
                        sz * 0.15, -sz * 0.1,
                        -sz * 0.15, 0
                    );
                    p.bezierVertex(
                        sz * 0.15, sz * 0.1,
                        sz * 0.4, sz * 0.15,
                        sz * 0.7, 0
                    );
                    p.endShape(p.CLOSE);

                    // Central vein
                    p.stroke(lf.hue - 10, 30, bri * 0.4, alpha * 0.6);
                    p.strokeWeight(0.5);
                    p.line(-sz * 0.3, 0, sz * 0.9, 0);

                    // Side veins
                    p.strokeWeight(0.3);
                    for (let v = 0; v < 3; v++) {
                        const vx = sz * (0.1 + v * 0.25);
                        p.line(vx, 0, vx + sz * 0.15, -sz * 0.12);
                        p.line(vx, 0, vx + sz * 0.15, sz * 0.12);
                    }

                    // Stem
                    p.stroke(25, 40, bri * 0.4, alpha * 0.7);
                    p.strokeWeight(0.7);
                    p.line(-sz * 0.3, 0, -sz * 0.6, sz * 0.05);

                    p.pop();
                }

                // Respawn
                let activeCount = 0;
                for (const lf of preset.leaves) {
                    if (!lf.piled) activeCount++;
                }
                while (activeCount < 45) {
                    preset._spawnLeaf(p, false);
                    activeCount++;
                }

                // Remove old piled leaves
                if (preset.leaves.length > 180) {
                    let removed = 0;
                    for (let i = 0; i < preset.leaves.length && removed < 30; i++) {
                        if (preset.leaves[i].piled) {
                            preset.leaves.splice(i, 1);
                            removed++;
                            i--;
                        }
                    }
                }

                // Beat: wind gust that sweeps leaves
                if (preset.beatPulse > 0.3) {
                    preset.gustForce = (Math.random() > 0.5 ? 1 : -1) * (3 + preset.beatPulse * 5);
                    let unpiled = 0;
                    for (const lf of preset.leaves) {
                        if (lf.piled && unpiled < 12) {
                            lf.piled = false;
                            lf.vy = -2 - Math.random() * 2.5;
                            lf.vx = preset.gustForce * 0.6;
                            lf.flutterSpeed = 0.08 + Math.random() * 0.06;
                            unpiled++;
                        }
                    }
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _spawnLeaf(p, randomY) {
        // Realistic autumn leaf colors: deep red, crimson, orange, amber, gold, brown
        const colorSets = [
            { hue: 0, sat: 75, bri: 55 },     // deep red
            { hue: 5, sat: 80, bri: 60 },     // crimson
            { hue: 15, sat: 85, bri: 65 },    // red-orange
            { hue: 25, sat: 80, bri: 70 },    // orange
            { hue: 35, sat: 75, bri: 75 },    // amber
            { hue: 45, sat: 70, bri: 70 },    // gold
            { hue: 30, sat: 50, bri: 40 },    // brown
            { hue: 10, sat: 60, bri: 45 },    // dark red-brown
        ];
        const c = colorSets[Math.floor(Math.random() * colorSets.length)];

        this.leaves.push({
            x: Math.random() * p.width,
            y: randomY ? Math.random() * p.height : -10 - Math.random() * 50,
            vx: (Math.random() - 0.5) * 0.5,
            vy: 0.3 + Math.random() * 0.8,
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.03,
            rotDir: Math.random() > 0.5 ? 1 : -1,
            size: 5 + Math.random() * 10,
            weight: Math.random(),
            hue: c.hue + (Math.random() - 0.5) * 6,
            sat: c.sat + (Math.random() - 0.5) * 10,
            bri: c.bri + (Math.random() - 0.5) * 10,
            piled: false,
            flutter: Math.random() * Math.PI * 2,
            flutterSpeed: 0.03 + Math.random() * 0.04,
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
window.VJamFX.presets['autumn-fall'] = AutumnFallPreset;
})();
