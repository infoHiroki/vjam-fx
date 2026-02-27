(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class PetalStormPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.petals = [];
        this.windDir = 1;
    }

    setup(container) {
        this.destroy();
        this.petals = [];
        this.windDir = 1;
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                for (let i = 0; i < 200; i++) {
                    preset.petals.push(preset._makePetal(p));
                }
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.006 * speed;
                preset.beatPulse *= 0.92;
                const cx = p.width / 2;
                const cy = p.height / 2;

                // Trail
                p.background(0);

                const windStr = 1.5 + preset.audio.bass * 2;

                for (const pt of preset.petals) {
                    // Spiral wind field
                    const dx = pt.x - cx;
                    const dy = pt.y - cy;
                    const angle = Math.atan2(dy, dx) + (Math.PI / 2) * preset.windDir;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const force = windStr / (1 + dist * 0.003);

                    // Wind + noise turbulence + slight gravity
                    const nx = p.noise(pt.x * 0.003, pt.y * 0.003, t) - 0.5;
                    const ny = p.noise(pt.x * 0.003 + 100, pt.y * 0.003, t) - 0.5;

                    pt.vx += (Math.cos(angle) * force * 0.08 + nx * 0.8) * speed;
                    pt.vy += (Math.sin(angle) * force * 0.08 + ny * 0.8 + 0.02) * speed;
                    pt.vx *= 0.97;
                    pt.vy *= 0.97;

                    pt.x += pt.vx * speed;
                    pt.y += pt.vy * speed;
                    pt.rot += pt.rotSpeed * speed;
                    pt.flutter += pt.flutterSpeed * speed;

                    // Wrap edges
                    if (pt.x < -20) pt.x = p.width + 20;
                    if (pt.x > p.width + 20) pt.x = -20;
                    if (pt.y < -20) pt.y = p.height + 20;
                    if (pt.y > p.height + 20) pt.y = -20;

                    // Draw petal with bezier shape
                    p.push();
                    p.translate(pt.x, pt.y);
                    p.rotate(pt.rot);
                    // 3D-like flutter by scaling x
                    const flutterScale = 0.5 + Math.abs(Math.sin(pt.flutter)) * 0.5;
                    p.scale(flutterScale, 1);
                    p.noStroke();

                    const sz = pt.size;

                    // Outer glow
                    p.fill(pt.hue, pt.sat * 0.4, 50, 6);
                    p.ellipse(0, 0, sz * 3, sz * 2);

                    // Bezier petal shape
                    p.fill(pt.hue, pt.sat, pt.bri, 50);
                    p.beginShape();
                    p.vertex(0, -sz * 0.6);
                    p.bezierVertex(sz * 0.5, -sz * 0.5, sz * 0.6, -sz * 0.1, sz * 0.15, sz * 0.4);
                    p.bezierVertex(sz * 0.05, sz * 0.55, -sz * 0.05, sz * 0.55, -sz * 0.15, sz * 0.4);
                    p.bezierVertex(-sz * 0.6, -sz * 0.1, -sz * 0.5, -sz * 0.5, 0, -sz * 0.6);
                    p.endShape(p.CLOSE);

                    // Inner highlight vein
                    p.fill(pt.hue - 10, pt.sat * 0.5, pt.bri + 15, 30);
                    p.beginShape();
                    p.vertex(0, -sz * 0.4);
                    p.bezierVertex(sz * 0.15, -sz * 0.2, sz * 0.12, sz * 0.1, 0, sz * 0.35);
                    p.bezierVertex(-sz * 0.12, sz * 0.1, -sz * 0.15, -sz * 0.2, 0, -sz * 0.4);
                    p.endShape(p.CLOSE);

                    p.pop();
                }

                // Beat: reverse wind briefly
                if (preset.beatPulse > 0.4) {
                    preset.windDir = -preset.windDir;
                    // Scatter some petals outward
                    for (let i = 0; i < 30; i++) {
                        const pt = preset.petals[Math.floor(Math.random() * preset.petals.length)];
                        const a = Math.random() * Math.PI * 2;
                        pt.vx += Math.cos(a) * 3 * preset.beatPulse;
                        pt.vy += Math.sin(a) * 3 * preset.beatPulse;
                    }
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _makePetal(p) {
        // Variety of petal colors: pinks, whites, reds, light magentas
        const colorType = Math.random();
        let hue, sat, bri;
        if (colorType < 0.35) {
            // Pink
            hue = 330 + Math.random() * 20;
            sat = 50 + Math.random() * 25;
            bri = 65 + Math.random() * 25;
        } else if (colorType < 0.55) {
            // White / very pale pink
            hue = 340 + Math.random() * 15;
            sat = 10 + Math.random() * 15;
            bri = 80 + Math.random() * 20;
        } else if (colorType < 0.75) {
            // Deep red / crimson
            hue = 350 + Math.random() * 15;
            sat = 60 + Math.random() * 25;
            bri = 50 + Math.random() * 30;
        } else {
            // Light magenta / sakura
            hue = 315 + Math.random() * 20;
            sat = 35 + Math.random() * 20;
            bri = 70 + Math.random() * 25;
        }

        return {
            x: Math.random() * p.width,
            y: Math.random() * p.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.06,
            flutter: Math.random() * Math.PI * 2,
            flutterSpeed: 0.03 + Math.random() * 0.05,
            size: 5 + Math.random() * 10,
            hue: hue,
            sat: sat,
            bri: bri,
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
window.VJamFX.presets['petal-storm'] = PetalStormPreset;
})();
