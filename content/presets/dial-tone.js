(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class DialTonePreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
        this.dialAngle = 0;
        this.dialVel = 0;
        this.pulseRings = [];
        this.dialReturnAngle = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            let vibX = 0;
            let vibY = 0;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
            };

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.015 * speed;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;
                const rms = preset.audio.rms;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.88;

                // Spring physics for dial rotation
                preset.dialVel += (-preset.dialAngle) * 0.04;
                preset.dialVel *= 0.92;
                preset.dialAngle += preset.dialVel;

                // Autonomous gentle rotation
                const autoRot = Math.sin(t * 0.3) * 0.15 + Math.sin(t * 0.7) * 0.05;

                // Bass vibration offset
                const vibTarget = bass * 3 + pulse * 5;
                vibX = vibX * 0.85 + (Math.sin(t * 17) * vibTarget) * 0.15;
                vibY = vibY * 0.85 + (Math.cos(t * 13) * vibTarget) * 0.15;

                const w = p.width;
                const h = p.height;
                const cx = w / 2 + vibX;
                const cy = h / 2 + vibY;
                const dialR = Math.min(w, h) * 0.38;

                p.background(0);

                // Outer ambient glow
                p.noStroke();
                p.fill(0, 255, 200, 8 + pulse * 15);
                p.ellipse(cx, cy, dialR * 3.2, dialR * 3.2);
                p.fill(0, 255, 180, 5 + pulse * 10);
                p.ellipse(cx, cy, dialR * 2.8, dialR * 2.8);

                // Pulse rings emanating outward
                for (let i = preset.pulseRings.length - 1; i >= 0; i--) {
                    const ring = preset.pulseRings[i];
                    ring.r += 2.5;
                    ring.alpha -= 2;
                    if (ring.alpha <= 0) {
                        preset.pulseRings.splice(i, 1);
                        continue;
                    }
                    p.noFill();
                    // Cyan ring
                    p.stroke(0, 255, 220, ring.alpha);
                    p.strokeWeight(2);
                    p.ellipse(cx, cy, ring.r * 2, ring.r * 2);
                    // Wider glow
                    p.stroke(0, 255, 200, ring.alpha * 0.3);
                    p.strokeWeight(6);
                    p.ellipse(cx, cy, ring.r * 2, ring.r * 2);
                }

                // Outer dial ring — thick metallic
                p.noFill();
                p.stroke(200, 210, 200, 180);
                p.strokeWeight(dialR * 0.06);
                p.ellipse(cx, cy, dialR * 2.15, dialR * 2.15);

                // Outer ring neon edge
                p.stroke(0, 255, 200, 60 + mid * 60);
                p.strokeWeight(2);
                p.ellipse(cx, cy, dialR * 2.22, dialR * 2.22);

                // Dial body — dark circle
                p.noStroke();
                p.fill(20, 22, 25);
                p.ellipse(cx, cy, dialR * 2.05, dialR * 2.05);

                // Finger stop (metal arc at bottom-right)
                p.stroke(150, 155, 145, 200);
                p.strokeWeight(dialR * 0.04);
                p.noFill();
                const stopStart = -0.3;
                const stopEnd = 0.45;
                p.arc(cx, cy, dialR * 1.55, dialR * 1.55, stopStart, stopEnd);

                // Rotating part angle
                const rotAngle = preset.dialAngle + autoRot;

                // Finger holes — 10 positions arranged in arc (like real rotary dial)
                const holeR = dialR * 0.09;
                const holeOrbitR = dialR * 0.72;
                const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

                // The holes span about 270 degrees
                const holeArcSpan = p.PI * 1.5;
                const holeStartAngle = -p.HALF_PI - 0.2;

                for (let i = 0; i < 10; i++) {
                    const frac = i / 10;
                    const holeAngle = holeStartAngle + frac * holeArcSpan + rotAngle;
                    const hx = cx + Math.cos(holeAngle) * holeOrbitR;
                    const hy = cy + Math.sin(holeAngle) * holeOrbitR;

                    // Hole cutout — dark with depth
                    p.noStroke();
                    p.fill(5, 5, 8);
                    p.ellipse(hx, hy, holeR * 2, holeR * 2);

                    // Hole inner rim — subtle cyan glow
                    p.noFill();
                    p.stroke(0, 255, 200, 80 + treble * 80);
                    p.strokeWeight(1.5);
                    p.ellipse(hx, hy, holeR * 2, holeR * 2);

                    // Outer glow ring on hole
                    p.stroke(0, 255, 180, 20 + mid * 30);
                    p.strokeWeight(3);
                    p.ellipse(hx, hy, holeR * 2.5, holeR * 2.5);

                    // Number inside hole
                    p.noStroke();
                    p.fill(200, 255, 220, 160 + treble * 60);
                    p.textSize(Math.max(10, holeR * 1.1));
                    p.textAlign(p.CENTER, p.CENTER);
                    p.text(digits[i], hx, hy);
                }

                // Number labels outside the dial (fixed, don't rotate)
                const labelOrbitR = dialR * 0.92;
                p.textSize(Math.max(12, dialR * 0.08));
                for (let i = 0; i < 10; i++) {
                    const frac = i / 10;
                    const labelAngle = holeStartAngle + frac * holeArcSpan;
                    const lx = cx + Math.cos(labelAngle) * labelOrbitR;
                    const ly = cy + Math.sin(labelAngle) * labelOrbitR;
                    p.noStroke();
                    p.fill(150, 200, 170, 140);
                    p.text(digits[i], lx, ly);
                }

                // Center hub — layered circles
                p.noStroke();
                // Outer hub ring
                p.fill(30, 35, 32);
                p.ellipse(cx, cy, dialR * 0.55, dialR * 0.55);
                // Inner hub
                p.fill(15, 18, 16);
                p.ellipse(cx, cy, dialR * 0.4, dialR * 0.4);
                // Center neon dot
                const centerGlow = 120 + Math.sin(t * 2) * 40 + rms * 80;
                p.fill(0, 255, 200, centerGlow);
                p.ellipse(cx, cy, dialR * 0.08, dialR * 0.08);
                // Center dot bright core
                p.fill(180, 255, 230, centerGlow + 30);
                p.ellipse(cx, cy, dialR * 0.04, dialR * 0.04);

                // Radial tick marks around outer edge (like clock markings)
                p.stroke(100, 200, 150, 60);
                p.strokeWeight(1);
                for (let i = 0; i < 60; i++) {
                    const tickAngle = (i / 60) * p.TWO_PI;
                    const innerTick = dialR * 1.04;
                    const outerTick = dialR * (i % 5 === 0 ? 1.1 : 1.06);
                    p.line(
                        cx + Math.cos(tickAngle) * innerTick,
                        cy + Math.sin(tickAngle) * innerTick,
                        cx + Math.cos(tickAngle) * outerTick,
                        cy + Math.sin(tickAngle) * outerTick
                    );
                }

                // Connector cord at bottom
                p.noFill();
                p.stroke(80, 85, 75, 120);
                p.strokeWeight(3);
                p.beginShape();
                p.curveVertex(cx, cy + dialR * 1.1);
                p.curveVertex(cx, cy + dialR * 1.1);
                p.curveVertex(cx + Math.sin(t * 0.8) * 15, cy + dialR * 1.3);
                p.curveVertex(cx - Math.sin(t * 0.6 + 1) * 20, cy + dialR * 1.55);
                p.curveVertex(cx + Math.sin(t * 0.4 + 2) * 10, h);
                p.curveVertex(cx + Math.sin(t * 0.4 + 2) * 10, h);
                p.endShape();

                // Beat flash overlay
                if (pulse > 0.3) {
                    p.noStroke();
                    p.fill(0, 255, 200, pulse * 20);
                    p.ellipse(cx, cy, dialR * 2.5, dialR * 2.5);
                }

                // Floating particles around dial
                p.noStroke();
                for (let i = 0; i < 12; i++) {
                    const pAngle = t * 0.3 + i * 0.52;
                    const pDist = dialR * (1.2 + Math.sin(t * 0.5 + i * 1.7) * 0.3);
                    const px = cx + Math.cos(pAngle) * pDist;
                    const py = cy + Math.sin(pAngle) * pDist;
                    const pAlpha = 40 + treble * 60 + Math.sin(t + i) * 20;
                    const pSize = 2 + Math.sin(t * 0.8 + i) * 1.5;
                    p.fill(100, 255, 200, pAlpha);
                    p.ellipse(px, py, pSize, pSize);
                }

                // Subtle scanline overlay
                p.stroke(0, 0, 0, 8);
                p.strokeWeight(1);
                for (let sy = 0; sy < h; sy += 3) {
                    p.line(0, sy, w, sy);
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
        // Trigger dial rotation on beat — like someone spinning the dial
        this.dialAngle += strength * 1.2;
        this.dialVel += strength * 0.3;
        // Pulse ring
        this.pulseRings.push({ r: 15, alpha: 80 * strength });
        if (this.pulseRings.length > 10) this.pulseRings.shift();
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['dial-tone'] = DialTonePreset;
})();
