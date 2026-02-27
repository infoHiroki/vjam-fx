(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

// Key b - Set E: レトロな紙吹雪が舞うパーティクル
class ConfettiBurstPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.confetti = [];
        this._beatTriggered = false;
    }

    setup(container) {
        this.destroy();
        const preset = this;
        preset.confetti = [];
        preset._beatTriggered = false;

        this.p5 = new p5((p) => {
            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                // Small initial set drifting in
                for (let i = 0; i < 20; i++) {
                    preset.confetti.push(preset._make(p, false, 0, 0));
                }
            };

            p.draw = () => {
                p.background(0, 0, 0, 20);
                preset.beatPulse *= 0.92;

                const t = p.frameCount * 0.005 * preset.params.speed;

                // Beat burst: spawn 30-50 pieces from random position
                if (preset._beatTriggered) {
                    preset._beatTriggered = false;
                    const count = 30 + Math.floor(Math.random() * 21);
                    const cx = p.width * 0.15 + Math.random() * p.width * 0.7;
                    const cy = p.height * 0.15 + Math.random() * p.height * 0.4;
                    for (let i = 0; i < count; i++) {
                        preset.confetti.push(preset._make(p, true, cx, cy));
                    }
                }

                // Autonomous burst every ~180 frames (3 sec at 60fps) if no audio
                if (p.frameCount % 180 === 0 && preset.audio.rms < 0.05) {
                    const count = 20 + Math.floor(Math.random() * 15);
                    const cx = p.width * 0.2 + Math.random() * p.width * 0.6;
                    const cy = p.height * 0.2 + Math.random() * p.height * 0.3;
                    for (let i = 0; i < count; i++) {
                        preset.confetti.push(preset._make(p, true, cx, cy));
                    }
                }

                for (let i = preset.confetti.length - 1; i >= 0; i--) {
                    const c = preset.confetti[i];

                    // Gravity pulls down slowly
                    c.vy += 0.04;
                    // Gentle wind drift
                    c.vx += Math.sin(t + c.phase) * 0.015;
                    c.vx *= 0.99;
                    c.vy *= 0.99;
                    c.x += c.vx * preset.params.speed;
                    c.y += c.vy * preset.params.speed;
                    c.rotX += c.rotSpeedX;
                    c.rotY += c.rotSpeedY;
                    c.life -= 0.004;

                    // Wrap horizontally
                    if (c.x < -20) c.x = p.width + 20;
                    if (c.x > p.width + 20) c.x = -20;

                    // Remove if off bottom or dead
                    if (c.y > p.height + 30 || c.life <= 0) {
                        preset.confetti.splice(i, 1);
                        continue;
                    }

                    // 3D rotation simulation
                    const scaleX = Math.cos(c.rotX);
                    const scaleY = Math.cos(c.rotY);
                    const w = c.w * Math.abs(scaleX);
                    const h = c.h * Math.abs(scaleY);
                    if (w < 0.5 || h < 0.5) continue;

                    const a = c.alpha * Math.min(c.life * 2, 1);

                    p.push();
                    p.translate(c.x, c.y);
                    p.rotate(c.rot);
                    p.noStroke();

                    // Shadow
                    p.fill(0, 0, 0, a * 0.1);
                    p.rect(1, 1, w, h);

                    // Main piece
                    p.fill(c.hue, c.sat, c.bri, a);
                    p.rect(0, 0, w, h);

                    // Highlight
                    p.fill(c.hue, c.sat - 20, Math.min(100, c.bri + 20), a * 0.3);
                    p.rect(0, 0, w * 0.5, h * 0.5);

                    p.pop();
                }

                // Keep a small ambient amount drifting
                while (preset.confetti.length < 15) {
                    preset.confetti.push(preset._make(p, false, 0, 0));
                }
                // Cap
                if (preset.confetti.length > 300) {
                    preset.confetti.splice(0, preset.confetti.length - 300);
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(container.clientWidth, container.clientHeight);
            };
        }, container);
    }

    _make(p, burst, cx, cy) {
        const hues = [0, 30, 50, 120, 200, 280, 330];
        if (burst) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 6;
            return {
                x: cx + (Math.random() - 0.5) * 30,
                y: cy + (Math.random() - 0.5) * 30,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                w: 5 + Math.random() * 9,
                h: 4 + Math.random() * 6,
                hue: hues[Math.floor(Math.random() * hues.length)] + Math.random() * 20,
                sat: 70 + Math.random() * 25,
                bri: 80 + Math.random() * 20,
                alpha: 70 + Math.random() * 25,
                life: 0.8 + Math.random() * 0.2,
                rot: Math.random() * Math.PI * 2,
                rotX: Math.random() * Math.PI * 2,
                rotY: Math.random() * Math.PI * 2,
                rotSpeedX: 0.04 + Math.random() * 0.1,
                rotSpeedY: 0.03 + Math.random() * 0.08,
                phase: Math.random() * Math.PI * 2,
            };
        }
        // Ambient drift from top
        return {
            x: Math.random() * p.width,
            y: -10 - Math.random() * 40,
            vx: (Math.random() - 0.5) * 0.8,
            vy: 0.3 + Math.random() * 0.8,
            w: 4 + Math.random() * 7,
            h: 3 + Math.random() * 5,
            hue: hues[Math.floor(Math.random() * hues.length)] + Math.random() * 15,
            sat: 70 + Math.random() * 20,
            bri: 80 + Math.random() * 20,
            alpha: 50 + Math.random() * 30,
            life: 0.7 + Math.random() * 0.3,
            rot: Math.random() * Math.PI * 2,
            rotX: Math.random() * Math.PI * 2,
            rotY: Math.random() * Math.PI * 2,
            rotSpeedX: 0.03 + Math.random() * 0.08,
            rotSpeedY: 0.02 + Math.random() * 0.06,
            phase: Math.random() * Math.PI * 2,
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
        if (strength > 0.2) {
            this._beatTriggered = true;
        }
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['confetti-burst'] = ConfettiBurstPreset;
})();
