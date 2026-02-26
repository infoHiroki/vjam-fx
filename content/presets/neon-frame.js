(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;


class NeonFramePreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.sparks = [];
        this.flickerSegments = [];
    }

    setup(container) {
        this.destroy();
        this.sparks = [];
        this.flickerSegments = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
            };

            p.draw = () => {
                p.background(0, 0, 0, 100);
                preset.beatPulse *= 0.9;

                const time = p.frameCount * 0.02;
                const w = p.width;
                const h = p.height;
                const borderW = 35 + preset.beatPulse * 25;
                const pulseInward = preset.beatPulse * 40;

                // Glow layers: outer dim to inner bright
                const glowLayers = 5;
                for (let gl = 0; gl < glowLayers; gl++) {
                    const layerRatio = gl / (glowLayers - 1);
                    const alpha = 8 + layerRatio * 25 + preset.audio.rms * 10;
                    const brightness = 40 + layerRatio * 60;
                    const extend = (glowLayers - gl) * 12 + pulseInward * (1 - layerRatio);

                    // Draw each edge as a series of segments for rainbow chase
                    const segments = 60;

                    p.noStroke();

                    // Top edge
                    for (let i = 0; i < segments; i++) {
                        const t = i / segments;
                        const hue = (t * 360 + time * 80 + preset.audio.mid * 60) % 360;
                        p.fill(hue, 80, brightness, alpha);
                        const sx = t * w;
                        const sw = w / segments + 1;
                        p.rect(sx, 0 - extend + borderW, sw, borderW + extend);
                    }

                    // Bottom edge
                    for (let i = 0; i < segments; i++) {
                        const t = i / segments;
                        const hue = (t * 360 + time * 80 + 180 + preset.audio.mid * 60) % 360;
                        p.fill(hue, 80, brightness, alpha);
                        const sx = t * w;
                        const sw = w / segments + 1;
                        p.rect(sx, h - borderW - pulseInward * layerRatio, sw, borderW + extend);
                    }

                    // Left edge
                    for (let i = 0; i < segments; i++) {
                        const t = i / segments;
                        const hue = (t * 360 + time * 60 + 90 + preset.audio.treble * 40) % 360;
                        p.fill(hue, 80, brightness, alpha);
                        const sy = t * h;
                        const sh = h / segments + 1;
                        p.rect(0 - extend + borderW, sy, borderW + extend, sh);
                    }

                    // Right edge
                    for (let i = 0; i < segments; i++) {
                        const t = i / segments;
                        const hue = (t * 360 + time * 60 + 270 + preset.audio.treble * 40) % 360;
                        p.fill(hue, 80, brightness, alpha);
                        const sy = t * h;
                        const sh = h / segments + 1;
                        p.rect(w - borderW - pulseInward * layerRatio, sy, borderW + extend, sh);
                    }
                }

                // Bright inner edge line (the sharpest glow)
                p.strokeWeight(2 + preset.beatPulse * 3);
                const innerOffset = borderW - pulseInward * 0.3;

                // Top line
                for (let i = 0; i < 40; i++) {
                    const t = i / 40;
                    const hue = (t * 360 + time * 80 + preset.audio.mid * 60) % 360;
                    p.stroke(hue, 70, 100, 60 + preset.beatPulse * 30);
                    const x1 = t * w;
                    const x2 = (t + 1 / 40) * w;
                    p.line(x1, innerOffset, x2, innerOffset);
                }
                // Bottom line
                for (let i = 0; i < 40; i++) {
                    const t = i / 40;
                    const hue = (t * 360 + time * 80 + 180 + preset.audio.mid * 60) % 360;
                    p.stroke(hue, 70, 100, 60 + preset.beatPulse * 30);
                    const x1 = t * w;
                    const x2 = (t + 1 / 40) * w;
                    p.line(x1, h - innerOffset, x2, h - innerOffset);
                }
                // Left line
                for (let i = 0; i < 40; i++) {
                    const t = i / 40;
                    const hue = (t * 360 + time * 60 + 90 + preset.audio.treble * 40) % 360;
                    p.stroke(hue, 70, 100, 60 + preset.beatPulse * 30);
                    const y1 = t * h;
                    const y2 = (t + 1 / 40) * h;
                    p.line(innerOffset, y1, innerOffset, y2);
                }
                // Right line
                for (let i = 0; i < 40; i++) {
                    const t = i / 40;
                    const hue = (t * 360 + time * 60 + 270 + preset.audio.treble * 40) % 360;
                    p.stroke(hue, 70, 100, 60 + preset.beatPulse * 30);
                    const y1 = t * h;
                    const y2 = (t + 1 / 40) * h;
                    p.line(w - innerOffset, y1, w - innerOffset, y2);
                }

                // Spark / flicker effect on random segments
                if (p.frameCount % 8 === 0 && Math.random() < 0.6) {
                    const edge = Math.floor(Math.random() * 4);
                    const pos = Math.random();
                    let sx, sy;
                    if (edge === 0) { sx = pos * w; sy = borderW * 0.5; }
                    else if (edge === 1) { sx = pos * w; sy = h - borderW * 0.5; }
                    else if (edge === 2) { sx = borderW * 0.5; sy = pos * h; }
                    else { sx = w - borderW * 0.5; sy = pos * h; }
                    for (let s = 0; s < 5; s++) {
                        preset.sparks.push({
                            x: sx, y: sy,
                            vx: (Math.random() - 0.5) * 4,
                            vy: (Math.random() - 0.5) * 4,
                            life: 0.6 + Math.random() * 0.4,
                            hue: (pos * 360 + time * 80) % 360
                        });
                    }
                }

                // Update and draw sparks
                p.noStroke();
                for (let i = preset.sparks.length - 1; i >= 0; i--) {
                    const sp = preset.sparks[i];
                    sp.x += sp.vx;
                    sp.y += sp.vy;
                    sp.life -= 0.03;
                    if (sp.life <= 0) {
                        preset.sparks.splice(i, 1);
                        continue;
                    }
                    p.fill(sp.hue, 60, 100, sp.life * 80);
                    p.circle(sp.x, sp.y, 3 + sp.life * 3);
                    p.fill(sp.hue, 20, 100, sp.life * 50);
                    p.circle(sp.x, sp.y, 1.5);
                }

                // Keep spark count reasonable
                if (preset.sparks.length > 100) {
                    preset.sparks.splice(0, preset.sparks.length - 100);
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
        this.audio.strength = audioData.strength || 0;
    }

    onBeat(strength) {
        this.beatPulse = strength;
        // Extra sparks on beat at corners
        if (this.p5) {
            const p = this.p5;
            const corners = [
                { x: 35, y: 35 },
                { x: p.width - 35, y: 35 },
                { x: 35, y: p.height - 35 },
                { x: p.width - 35, y: p.height - 35 }
            ];
            for (const c of corners) {
                for (let s = 0; s < 4; s++) {
                    this.sparks.push({
                        x: c.x, y: c.y,
                        vx: (Math.random() - 0.5) * 6,
                        vy: (Math.random() - 0.5) * 6,
                        life: 0.7 + Math.random() * 0.3,
                        hue: Math.random() * 360
                    });
                }
            }
        }
    }
}

window.VJamFX.presets['neon-frame'] = NeonFramePreset;
})();
