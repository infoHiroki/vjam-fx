(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class HoneycombPulsePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.waves = [];
        this.hexGrid = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;
        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.background(0);
                preset._buildGrid(p);
                preset.waves.push({ x: p.width / 2, y: p.height / 2, t: 0 });
            };
            p.draw = () => {
                p.fill(0, 0, 0, p.lerp(15, 35, preset.audio.rms));
                p.noStroke();
                p.rect(0, 0, p.width, p.height);
                const time = p.frameCount * 0.02 * preset.params.speed;
                // Update waves
                for (let i = preset.waves.length - 1; i >= 0; i--) {
                    preset.waves[i].t += 0.015 * preset.params.speed;
                    if (preset.waves[i].t > 2.0) preset.waves.splice(i, 1);
                }
                if (preset.waves.length === 0) preset.waves.push({ x: p.width / 2, y: p.height / 2, t: 0 });
                const maxDist = Math.sqrt((p.width / 2) ** 2 + (p.height / 2) ** 2);
                // Draw hexagons
                for (const hex of preset.hexGrid) {
                    let brightness = 15;
                    let pulseStr = 0;
                    for (const w of preset.waves) {
                        const d = Math.sqrt((hex.x - w.x) ** 2 + (hex.y - w.y) ** 2);
                        const normD = d / maxDist;
                        const waveFront = Math.abs(normD - w.t);
                        if (waveFront < 0.12) {
                            const intensity = 1 - waveFront / 0.12;
                            pulseStr = Math.max(pulseStr, intensity * (1 - w.t / 2.0));
                        }
                    }
                    brightness += pulseStr * 75;
                    brightness += preset.audio.bass * 15;
                    const hue = 35 + pulseStr * 10 + p.noise(hex.col * 0.3, hex.row * 0.3, time * 0.5) * 10;
                    const sat = 60 + pulseStr * 25;
                    // Glow layer (outer)
                    if (pulseStr > 0.2) {
                        p.noFill();
                        p.stroke(hue, sat * 0.6, brightness, pulseStr * 25);
                        p.strokeWeight(3);
                        preset._drawHex(p, hex.x, hex.y, hex.size * 1.15);
                    }
                    // Main hex
                    p.noFill();
                    p.stroke(hue, sat, Math.min(brightness, 100), p.lerp(30, 90, pulseStr));
                    p.strokeWeight(p.lerp(1, 2.5, pulseStr));
                    preset._drawHex(p, hex.x, hex.y, hex.size);
                    // Inner fill for strong pulses
                    if (pulseStr > 0.5) {
                        p.noStroke();
                        p.fill(hue, sat * 0.8, brightness, (pulseStr - 0.5) * 40);
                        preset._drawHex(p, hex.x, hex.y, hex.size * 0.7);
                    }
                }
                // Floating honey particles between hexes
                if (!preset.honeyParts) preset.honeyParts = [];
                if (p.frameCount % 20 === 0 && preset.honeyParts.length < 15) {
                    preset.honeyParts.push({ x: Math.random() * p.width, y: Math.random() * p.height, vx: (Math.random() - 0.5) * 0.3, vy: -0.2 - Math.random() * 0.3, life: 1, size: 2 + Math.random() * 4 });
                }
                for (let i = preset.honeyParts.length - 1; i >= 0; i--) {
                    const hp = preset.honeyParts[i];
                    hp.x += hp.vx; hp.y += hp.vy; hp.life -= 0.008;
                    if (hp.life < 0) { preset.honeyParts.splice(i, 1); continue; }
                    p.noStroke();
                    p.fill(40, 70, 80, hp.life * 40);
                    p.ellipse(hp.x, hp.y, hp.size);
                }
                // Beat flash
                if (preset.beatPulse > 0) {
                    p.noStroke();
                    p.fill(40, 30, 100, preset.beatPulse * 20);
                    p.ellipse(p.width / 2, p.height / 2, preset.beatPulse * 200);
                    preset.beatPulse *= 0.88;
                }
            };
            p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); p.background(0); preset._buildGrid(p); };
        }, container);
    }

    _buildGrid(p) {
        this.hexGrid = [];
        const size = 28;
        const w = size * 1.5;
        const h = size * Math.sqrt(3);
        const cols = Math.ceil(p.width / w) + 2;
        const rows = Math.ceil(p.height / h) + 2;
        for (let col = -1; col < cols; col++) {
            for (let row = -1; row < rows; row++) {
                const x = col * w;
                const y = row * h + (col % 2 === 1 ? h / 2 : 0);
                this.hexGrid.push({ x, y, col, row, size });
            }
        }
    }

    _drawHex(p, cx, cy, size) {
        p.beginShape();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            p.vertex(cx + Math.cos(angle) * size, cy + Math.sin(angle) * size);
        }
        p.endShape(p.CLOSE);
    }

    updateAudio(ad) { this.audio.bass = ad.bass || 0; this.audio.mid = ad.mid || 0; this.audio.treble = ad.treble || 0; this.audio.rms = ad.rms || 0; }
    onBeat(s) {
        this.beatPulse = s;
        if (this.p5) {
            const p = this.p5;
            this.waves.push({ x: Math.random() * p.width, y: Math.random() * p.height, t: 0 });
            if (this.waves.length > 5) this.waves.shift();
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['honeycomb-pulse'] = HoneycombPulsePreset;
})();
