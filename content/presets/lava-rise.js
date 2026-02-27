(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class LavaRisePreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.bubbles = [];
        this.spurts = [];
    }

    setup(container) {
        this.destroy();
        this.bubbles = [];
        this.spurts = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.noStroke();
            };

            p.draw = () => {
                p.background(0, 0, 0, 100);
                preset.beatPulse *= 0.92;

                const time = p.frameCount * 0.01;
                const w = p.width;
                const h = p.height;
                const baseLavaY = h * 0.7;
                const surgeOffset = preset.beatPulse * h * 0.12;
                const lavaTop = baseLavaY - surgeOffset;

                // Heat shimmer glow above lava
                for (let i = 0; i < 12; i++) {
                    const shimmerY = lavaTop - 20 - i * 8;
                    const shimmerAlpha = (12 - i) * 1.5 + preset.audio.bass * 5;
                    const shimmerX = Math.sin(time * 2 + i * 0.5) * 20;
                    p.fill(30, 90, 90, shimmerAlpha);
                    p.rect(shimmerX, shimmerY, w, 10);
                }

                // Lava body: gradient from deep red at bottom to bright orange at surface
                const lavaSlices = 30;
                const lavaHeight = h - lavaTop;
                for (let i = 0; i < lavaSlices; i++) {
                    const sliceRatio = i / lavaSlices;
                    const sliceY = lavaTop + sliceRatio * lavaHeight;
                    const sliceH = lavaHeight / lavaSlices + 1;

                    // Color gradient: yellow/orange at top -> deep red at bottom
                    const hue = 30 - sliceRatio * 25; // 30 (orange) -> 5 (deep red)
                    const sat = 85 + sliceRatio * 15;
                    const bri = 90 - sliceRatio * 45 + preset.audio.bass * 15;
                    const alpha = 70 + sliceRatio * 30;

                    p.fill(hue, sat, bri, alpha);
                    p.rect(0, sliceY, w, sliceH);
                }

                // Wavy lava surface line
                p.noFill();
                const surfacePoints = 80;
                // Bright surface glow
                for (let layer = 0; layer < 3; layer++) {
                    const sw = 4 - layer * 1.2;
                    const sa = 30 + layer * 20;
                    const hue = 40 - layer * 5;
                    p.stroke(hue, 80, 100, sa);
                    p.strokeWeight(sw);
                    p.beginShape();
                    for (let i = 0; i <= surfacePoints; i++) {
                        const t = i / surfacePoints;
                        const x = t * w;
                        const wave1 = Math.sin(t * 8 + time * 3) * 8;
                        const wave2 = Math.sin(t * 15 + time * 5) * 4;
                        const wave3 = p.noise(t * 3, time) * 12 - 6;
                        const y = lavaTop + wave1 + wave2 + wave3;
                        p.vertex(x, y);
                    }
                    p.endShape();
                }
                p.noStroke();

                // Lava bubbles
                // Spawn bubbles
                if (p.frameCount % 4 === 0) {
                    const count = 1 + Math.floor(preset.beatPulse * 3) + Math.floor(preset.audio.bass * 2);
                    for (let i = 0; i < count; i++) {
                        preset.bubbles.push({
                            x: Math.random() * w,
                            y: h - Math.random() * (h - lavaTop) * 0.5,
                            size: 4 + Math.random() * 12,
                            speed: 0.5 + Math.random() * 1.5,
                            wobble: Math.random() * 1000,
                            life: 1.0
                        });
                    }
                }

                // Update and draw bubbles
                for (let i = preset.bubbles.length - 1; i >= 0; i--) {
                    const b = preset.bubbles[i];
                    b.y -= b.speed;
                    b.x += Math.sin(p.frameCount * 0.05 + b.wobble) * 0.5;

                    // Pop when reaching surface
                    if (b.y < lavaTop - 5) {
                        b.life -= 0.1;
                    }
                    if (b.life <= 0 || b.y < lavaTop - 30) {
                        preset.bubbles.splice(i, 1);
                        continue;
                    }

                    const bubbleDepth = (b.y - lavaTop) / (h - lavaTop);
                    const hue = 35 - bubbleDepth * 20;
                    const bri = 100 - bubbleDepth * 30;
                    const alpha = 40 + b.life * 30;

                    // Bubble glow
                    p.fill(hue, 70, bri, alpha * 0.4);
                    p.circle(b.x, b.y, b.size * 2);
                    // Bubble body
                    p.fill(hue, 60, bri, alpha);
                    p.circle(b.x, b.y, b.size);
                    // Highlight
                    p.fill(50, 30, 100, alpha * 0.6);
                    p.circle(b.x - b.size * 0.15, b.y - b.size * 0.15, b.size * 0.3);
                }

                if (preset.bubbles.length > 80) {
                    preset.bubbles.splice(0, preset.bubbles.length - 80);
                }

                // Lava spurts
                if (p.frameCount % 60 === 0 || (preset.beatPulse > 0.5 && Math.random() < 0.3)) {
                    const sx = Math.random() * w;
                    const particles = 6 + Math.floor(Math.random() * 6);
                    for (let j = 0; j < particles; j++) {
                        preset.spurts.push({
                            x: sx + (Math.random() - 0.5) * 10,
                            y: lavaTop,
                            vx: (Math.random() - 0.5) * 3,
                            vy: -(3 + Math.random() * 5 + preset.beatPulse * 4),
                            size: 3 + Math.random() * 5,
                            life: 0.8 + Math.random() * 0.4
                        });
                    }
                }

                // Update and draw spurts
                for (let i = preset.spurts.length - 1; i >= 0; i--) {
                    const sp = preset.spurts[i];
                    sp.x += sp.vx;
                    sp.y += sp.vy;
                    sp.vy += 0.15; // gravity
                    sp.life -= 0.02;

                    if (sp.life <= 0 || sp.y > h) {
                        preset.spurts.splice(i, 1);
                        continue;
                    }

                    const alpha = sp.life * 60;
                    // Glowing droplet
                    p.fill(30, 80, 100, alpha * 0.4);
                    p.circle(sp.x, sp.y, sp.size * 2.5);
                    p.fill(35, 90, 100, alpha);
                    p.circle(sp.x, sp.y, sp.size);
                    p.fill(50, 50, 100, alpha * 0.7);
                    p.circle(sp.x, sp.y, sp.size * 0.4);
                }

                if (preset.spurts.length > 60) {
                    preset.spurts.splice(0, preset.spurts.length - 60);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
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
        // Spawn extra bubbles on beat
        if (this.p5) {
            const p = this.p5;
            const lavaTop = p.height * 0.7 - strength * p.height * 0.12;
            for (let i = 0; i < 5; i++) {
                this.bubbles.push({
                    x: Math.random() * p.width,
                    y: p.height - Math.random() * (p.height - lavaTop) * 0.3,
                    size: 6 + Math.random() * 15,
                    speed: 1 + Math.random() * 2,
                    wobble: Math.random() * 1000,
                    life: 1.0
                });
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['lava-rise'] = LavaRisePreset;
})();
