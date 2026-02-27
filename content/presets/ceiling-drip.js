(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class CeilingDripPreset extends BasePreset {
    constructor() {
        super();
        this.params = { dripCount: 18 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
        this.beatPulse = 0;
        this.drips = [];
        this.splats = [];
        this.stalactites = [];
    }

    setup(container) {
        this.destroy();
        const preset = this;
        preset.drips = [];
        preset.splats = [];
        preset.stalactites = [];

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.noStroke();

                const count = preset.params.dripCount;
                for (let i = 0; i < count; i++) {
                    preset._initDripPoint(p, i, count);
                }
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.92;

                const time = p.frameCount * 0.02;

                // Update and draw stalactites
                for (let i = 0; i < preset.stalactites.length; i++) {
                    const st = preset.stalactites[i];
                    st.length += 0.05 + preset.audio.bass * 0.1;
                    if (st.length > st.maxLength) st.length = st.maxLength;

                    const hue = st.hue;
                    const shimmer = Math.sin(p.frameCount * 0.05 + i) * 10;
                    for (let s = 0; s < 4; s++) {
                        const ratio = s / 4;
                        const w = st.baseWidth * (1 - ratio * 0.8);
                        const y = ratio * st.length;
                        const alpha = 60 - ratio * 30 + shimmer;
                        p.fill(hue, 70, 80, Math.max(alpha, 10));
                        p.ellipse(st.x, y, w, st.length * 0.3);
                    }
                }

                // Update drips
                for (let i = 0; i < preset.drips.length; i++) {
                    const d = preset.drips[i];
                    const hue = d.hue;

                    if (d.state === 'growing') {
                        d.length += 0.3 + preset.audio.mid * 0.5;
                        if (d.length > d.maxLength) {
                            d.length = d.maxLength;
                            d.state = 'hanging';
                            d.hangTimer = 60 + Math.floor(Math.random() * 120);
                        }

                        // Draw growing drip
                        preset._drawHangingDrip(p, d, hue);

                    } else if (d.state === 'hanging') {
                        d.hangTimer--;
                        d.wobble = Math.sin(p.frameCount * 0.1 + i * 2) * 2;
                        if (d.hangTimer <= 0) {
                            d.state = 'falling';
                            d.dropY = d.length;
                            d.dropSpeed = 2;
                        }

                        // Draw hanging drip with wobble
                        preset._drawHangingDrip(p, d, hue);

                    } else if (d.state === 'falling') {
                        d.dropSpeed += 0.4;
                        d.dropY += d.dropSpeed;

                        // Draw falling drop
                        const dropX = d.x + (d.wobble || 0);
                        p.fill(hue, 80, 95, 90);
                        p.ellipse(dropX, d.dropY, 6, 10 + d.dropSpeed * 0.5);

                        // Streak trail
                        for (let t = 1; t <= 5; t++) {
                            const ty = d.dropY - t * d.dropSpeed * 0.4;
                            const alpha = 70 - t * 14;
                            if (ty > 0 && alpha > 0) {
                                p.fill(hue, 60, 85, alpha);
                                p.ellipse(dropX, ty, 3 - t * 0.4, 8);
                            }
                        }

                        // Shrink the hanging part
                        d.length = Math.max(0, d.length - d.dropSpeed * 0.3);
                        if (d.length > 2) {
                            preset._drawHangingDrip(p, d, hue);
                        }

                        // Hit bottom
                        if (d.dropY >= p.height) {
                            preset._createSplat(p, dropX, p.height, hue);
                            preset._resetDrip(p, d);
                        }
                    }
                }

                // Update and draw splats
                for (let i = preset.splats.length - 1; i >= 0; i--) {
                    const s = preset.splats[i];
                    s.life -= 2;
                    if (s.life <= 0) {
                        preset.splats.splice(i, 1);
                        continue;
                    }

                    for (let j = 0; j < s.particles.length; j++) {
                        const pt = s.particles[j];
                        pt.x += pt.vx;
                        pt.y += pt.vy;
                        pt.vy += 0.15;
                        pt.vx *= 0.98;

                        const alpha = (s.life / s.maxLife) * 80;
                        p.fill(s.hue, 70, 90, alpha);
                        p.circle(pt.x, pt.y, pt.size * (s.life / s.maxLife));
                    }
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _initDripPoint(p, index, count) {
        const x = (index + 0.5) * (p.width / count) + (Math.random() - 0.5) * 20;
        const hue = (index * (360 / count) + Math.random() * 20) % 360;

        this.drips.push({
            x: x,
            hue: hue,
            state: 'growing',
            length: 0,
            maxLength: 30 + Math.random() * 50,
            hangTimer: 0,
            wobble: 0,
            dropY: 0,
            dropSpeed: 0,
            delay: Math.floor(Math.random() * 100)
        });

        this.stalactites.push({
            x: x,
            hue: hue,
            length: 5 + Math.random() * 10,
            maxLength: 20 + Math.random() * 30,
            baseWidth: 8 + Math.random() * 6
        });
    }

    _drawHangingDrip(p, d, hue) {
        const x = d.x + (d.wobble || 0);
        const tipY = d.length;

        // Main drip body
        p.fill(hue, 75, 90, 70);
        p.beginShape();
        p.vertex(x - 3, 0);
        p.bezierVertex(x - 4, tipY * 0.4, x - 5, tipY * 0.7, x, tipY);
        p.bezierVertex(x + 5, tipY * 0.7, x + 4, tipY * 0.4, x + 3, 0);
        p.endShape(p.CLOSE);

        // Bright core
        p.fill(hue, 50, 100, 50);
        p.ellipse(x, tipY - 3, 4, 6);

        // Glowing tip
        p.fill(hue, 80, 95, 80);
        p.ellipse(x, tipY, 5, 8);
    }

    _resetDrip(p, d) {
        d.state = 'growing';
        d.length = 0;
        d.maxLength = 30 + Math.random() * 50;
        d.hangTimer = 0;
        d.wobble = 0;
        d.dropY = 0;
        d.dropSpeed = 0;
    }

    _createSplat(p, x, y, hue) {
        const particles = [];
        const count = 8 + Math.floor(Math.random() * 6);
        for (let i = 0; i < count; i++) {
            const angle = -Math.PI * Math.random();
            const speed = 2 + Math.random() * 5;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                size: 2 + Math.random() * 4
            });
        }
        this.splats.push({
            hue: hue,
            particles: particles,
            life: 60,
            maxLife: 60
        });
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
        // Release several drips at once on beat
        let released = 0;
        for (let i = 0; i < this.drips.length && released < 4 + Math.floor(strength * 4); i++) {
            if (this.drips[i].state === 'hanging' || (this.drips[i].state === 'growing' && this.drips[i].length > 15)) {
                this.drips[i].state = 'falling';
                this.drips[i].dropY = this.drips[i].length;
                this.drips[i].dropSpeed = 2 + strength * 3;
                released++;
            }
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['ceiling-drip'] = CeilingDripPreset;
})();
