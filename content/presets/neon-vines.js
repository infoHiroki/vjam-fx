(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class NeonVinesPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.vines = [];
    }

    setup(container) {
        this.destroy();
        this.vines = [];
        const preset = this;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.RGB, 255);
                // Spawn staggered initial vines at different growth stages
                for (let i = 0; i < 8; i++) {
                    preset._spawnVine(p, i * 0.12);
                }
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.92;

                // Continuous spawning — always keep many vines alive
                const targetCount = 10 + Math.floor(preset.audio.bass * 6);
                if (preset.vines.length < targetCount && p.frameCount % 15 === 0) {
                    preset._spawnVine(p, 0);
                }

                for (let i = preset.vines.length - 1; i >= 0; i--) {
                    const vine = preset.vines[i];

                    // Phase 0: growing, Phase 1: fading
                    if (vine.phase === 0) {
                        // Grow every frame for snappy growth
                        const growSpeed = 1 + preset.audio.bass * 2 + preset.beatPulse * 3;
                        const segmentsToAdd = Math.max(1, Math.floor(growSpeed));
                        for (let g = 0; g < segmentsToAdd && vine.segments.length < vine.maxSegments; g++) {
                            const last = vine.segments[vine.segments.length - 1];
                            const noiseVal = p.noise(vine.noiseOff + vine.segments.length * 0.12);
                            const angle = vine.baseAngle +
                                (noiseVal - 0.5) * (1.2 + preset.audio.mid * 1.5);
                            const len = 6 + p.random(5) + preset.audio.bass * 4;
                            const nx = last.x + Math.cos(angle) * len;
                            const ny = last.y + Math.sin(angle) * len;
                            vine.segments.push({ x: nx, y: ny });

                            // Branch nodes
                            if (vine.segments.length % 10 === 0 && p.random() < 0.5) {
                                vine.nodes.push({
                                    x: nx, y: ny,
                                    size: p.random(3, 7),
                                    bloom: 0
                                });
                            }
                        }
                        // Once fully grown, immediately start fading
                        if (vine.segments.length >= vine.maxSegments) {
                            vine.phase = 1;
                            vine.fadeStart = vine.life;
                        }
                    } else {
                        // Fading phase — decay faster
                        vine.life -= 0.02 + preset.audio.rms * 0.01;
                    }

                    // Always decay life slowly even while growing (keeps things cycling)
                    if (vine.phase === 0) vine.life -= 0.002;

                    if (vine.life <= 0) {
                        preset.vines.splice(i, 1);
                        // Immediately replace with new vine
                        if (preset.vines.length < targetCount) {
                            preset._spawnVine(p, 0);
                        }
                        continue;
                    }

                    // Draw vine segments
                    const alpha = Math.min(255, vine.life * 350);
                    const tipGlow = vine.phase === 0 ? 1 : 0;

                    for (let j = 1; j < vine.segments.length; j++) {
                        const s0 = vine.segments[j - 1];
                        const s1 = vine.segments[j];
                        const segProgress = j / vine.segments.length;
                        const segAlpha = alpha * Math.min(1, j / 4);
                        const isTip = j > vine.segments.length - 4;

                        // Glow layer
                        p.strokeWeight(5 + (isTip && tipGlow ? preset.beatPulse * 4 : 0));
                        p.stroke(vine.color[0], vine.color[1], vine.color[2],
                            segAlpha * 0.15);
                        p.line(s0.x, s0.y, s1.x, s1.y);

                        // Core
                        const coreWeight = 1.5 + segProgress * 0.8;
                        p.strokeWeight(coreWeight);
                        p.stroke(vine.color[0], vine.color[1], vine.color[2], segAlpha);
                        p.line(s0.x, s0.y, s1.x, s1.y);
                    }

                    // Draw tip spark while growing
                    if (vine.phase === 0 && vine.segments.length > 1) {
                        const tip = vine.segments[vine.segments.length - 1];
                        const sparkSize = 3 + preset.beatPulse * 6 + preset.audio.treble * 4;
                        p.noStroke();
                        p.fill(255, 255, 255, 120 + preset.beatPulse * 80);
                        p.ellipse(tip.x, tip.y, sparkSize, sparkSize);
                    }

                    // Draw nodes (leaf/buds)
                    p.noStroke();
                    for (const node of vine.nodes) {
                        node.bloom = Math.min(1, node.bloom + 0.03);
                        const pulse = 1 + preset.beatPulse * 0.6 + preset.audio.treble * 0.3;
                        const nodeAlpha = alpha * node.bloom;
                        // Outer glow
                        p.fill(vine.color[0], vine.color[1], vine.color[2], nodeAlpha * 0.15);
                        p.ellipse(node.x, node.y, node.size * 4 * pulse, node.size * 4 * pulse);
                        // Core
                        p.fill(255, 220, 255, Math.min(255, nodeAlpha * 0.8));
                        p.ellipse(node.x, node.y, node.size * pulse, node.size * pulse);
                    }
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _spawnVine(p, ageOffset) {
        const edge = Math.floor(p.random(4));
        let x, y, angle;
        switch (edge) {
            case 0: x = 0; y = p.random(p.height); angle = p.random(-0.4, 0.4); break;
            case 1: x = p.width; y = p.random(p.height); angle = p.PI + p.random(-0.4, 0.4); break;
            case 2: x = p.random(p.width); y = 0; angle = p.HALF_PI + p.random(-0.4, 0.4); break;
            default: x = p.random(p.width); y = p.height; angle = -p.HALF_PI + p.random(-0.4, 0.4); break;
        }

        const vineColors = [
            [0, 255, 120],   // neon green
            [0, 255, 200],   // teal
            [80, 255, 180],  // lime
            [0, 230, 255],   // cyan
            [160, 255, 140], // spring
        ];

        this.vines.push({
            segments: [{ x, y }],
            nodes: [],
            baseAngle: angle,
            noiseOff: p.random(10000),
            color: vineColors[Math.floor(p.random(vineColors.length))],
            life: 1.0 - (ageOffset || 0),
            maxSegments: Math.floor(p.random(35, 70)),
            phase: 0, // 0 = growing, 1 = fading
            fadeStart: 1,
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
        // Spawn 1-2 new vines on beat
        if (this.p5 && this.vines.length < 18) {
            this._spawnVine(this.p5, 0);
            if (strength > 0.6) this._spawnVine(this.p5, 0);
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['neon-vines'] = NeonVinesPreset;
})();
