(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class BoomboxMeterPreset extends BasePreset {
    constructor() {
        super();
        this.params = { speed: 1 };
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            // Needle angles (0 = left rest, PI = max right)
            let needleL = 0;
            let needleR = 0;
            let needleTargetL = 0;
            let needleTargetR = 0;
            // Peak LED
            let peakL = 0;
            let peakR = 0;
            let peakDecayL = 0;
            let peakDecayR = 0;
            // Glow intensity
            let glowIntensity = 0;

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
            };

            function drawMeter(x, y, w, h, needleAngle, peakOn, label, t) {
                // Meter panel background — dark with warm tint
                p.noStroke();
                // Panel shadow
                p.fill(0, 0, 0, 80);
                p.rect(x + 3, y + 3, w, h, 8);
                // Panel body
                p.fill(15, 12, 8);
                p.rect(x, y, w, h, 8);

                // Inner bezel
                p.stroke(60, 50, 30, 150);
                p.strokeWeight(2);
                p.noFill();
                p.rect(x + 4, y + 4, w - 8, h - 8, 6);

                // Backlit panel (warm amber glow)
                const panelX = x + w * 0.08;
                const panelY = y + h * 0.08;
                const panelW = w * 0.84;
                const panelH = h * 0.65;

                // Backlight glow — brighter with beat
                const glowAlpha = 30 + glowIntensity * 40;
                p.noStroke();
                p.fill(40, 30, 10, glowAlpha);
                p.rect(panelX - 4, panelY - 4, panelW + 8, panelH + 8, 8);
                // Main panel face — cream/off-white
                p.fill(45, 40, 30);
                p.rect(panelX, panelY, panelW, panelH, 6);

                // VU markings — arc scale
                const pivotX = x + w / 2;
                const pivotY = panelY + panelH * 0.85;
                const arcR = panelH * 0.7;
                const arcStart = p.PI + 0.4; // left bound
                const arcEnd = -0.4;         // right bound
                const totalArc = p.TWO_PI - 0.8;

                // Scale markings: -20 to +3 dB
                const dbValues = [-20, -10, -7, -5, -3, -1, 0, 1, 2, 3];
                const dbPositions = [0, 0.35, 0.47, 0.55, 0.63, 0.72, 0.77, 0.82, 0.87, 0.92];

                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(Math.max(8, w * 0.032));

                for (let i = 0; i < dbValues.length; i++) {
                    const frac = dbPositions[i];
                    const ang = arcStart + frac * totalArc;
                    const isRed = dbValues[i] >= 0;

                    // Tick marks
                    const innerR = arcR * 0.88;
                    const outerR = arcR * (isRed ? 1.02 : 0.98);
                    const tx1 = pivotX + Math.cos(ang) * innerR;
                    const ty1 = pivotY + Math.sin(ang) * innerR;
                    const tx2 = pivotX + Math.cos(ang) * outerR;
                    const ty2 = pivotY + Math.sin(ang) * outerR;

                    p.stroke(isRed ? p.color(200, 50, 40) : p.color(30, 25, 20));
                    p.strokeWeight(isRed ? 2 : 1.5);
                    p.line(tx1, ty1, tx2, ty2);

                    // Labels
                    const labelR = arcR * 0.78;
                    const lx = pivotX + Math.cos(ang) * labelR;
                    const ly = pivotY + Math.sin(ang) * labelR;
                    p.noStroke();
                    p.fill(isRed ? p.color(200, 50, 40) : p.color(30, 25, 20));
                    p.text(dbValues[i], lx, ly);
                }

                // Minor ticks between major ones
                p.stroke(30, 25, 20, 100);
                p.strokeWeight(0.8);
                for (let i = 0; i < 30; i++) {
                    const frac = i / 30;
                    const ang = arcStart + frac * totalArc;
                    const innerR2 = arcR * 0.92;
                    const outerR2 = arcR * 0.96;
                    p.line(
                        pivotX + Math.cos(ang) * innerR2,
                        pivotY + Math.sin(ang) * innerR2,
                        pivotX + Math.cos(ang) * outerR2,
                        pivotY + Math.sin(ang) * outerR2
                    );
                }

                // Red zone arc
                const redStart = arcStart + 0.77 * totalArc;
                const redEnd = arcStart + 0.95 * totalArc;
                p.noFill();
                p.stroke(200, 50, 40, 180);
                p.strokeWeight(3);
                p.arc(pivotX, pivotY, arcR * 1.95, arcR * 1.95, redStart, redEnd);

                // "VU" text
                p.noStroke();
                p.fill(30, 25, 20);
                p.textSize(Math.max(10, w * 0.045));
                p.text('VU', pivotX, panelY + panelH * 0.4);

                // Needle
                const needleAng = arcStart + needleAngle * totalArc;
                const needleLen = arcR * 1.05;
                const needleTipX = pivotX + Math.cos(needleAng) * needleLen;
                const needleTipY = pivotY + Math.sin(needleAng) * needleLen;

                // Needle shadow
                p.stroke(0, 0, 0, 40);
                p.strokeWeight(3);
                p.line(pivotX + 2, pivotY + 2, needleTipX + 2, needleTipY + 2);

                // Needle body
                p.stroke(20, 15, 10);
                p.strokeWeight(2.5);
                p.line(pivotX, pivotY, needleTipX, needleTipY);

                // Needle tip (bright)
                p.stroke(255, 80, 30);
                p.strokeWeight(2);
                const tipStartX = pivotX + Math.cos(needleAng) * needleLen * 0.7;
                const tipStartY = pivotY + Math.sin(needleAng) * needleLen * 0.7;
                p.line(tipStartX, tipStartY, needleTipX, needleTipY);

                // Pivot screw
                p.noStroke();
                p.fill(50, 45, 35);
                p.ellipse(pivotX, pivotY, 10, 10);
                p.fill(70, 60, 45);
                p.ellipse(pivotX, pivotY, 6, 6);

                // Peak LED indicator
                const ledX = x + w * 0.82;
                const ledY = panelY + panelH * 0.2;
                if (peakOn > 0.5) {
                    // LED glow
                    p.fill(255, 30, 20, 40);
                    p.ellipse(ledX, ledY, 16, 16);
                    p.fill(255, 50, 30);
                    p.ellipse(ledX, ledY, 8, 8);
                    p.fill(255, 150, 100);
                    p.ellipse(ledX, ledY, 4, 4);
                } else {
                    p.fill(60, 20, 15);
                    p.ellipse(ledX, ledY, 8, 8);
                }

                // Channel label at bottom
                p.fill(180, 170, 140);
                p.noStroke();
                p.textSize(Math.max(12, w * 0.05));
                p.text(label, x + w / 2, y + h - h * 0.08);

                // Screws in corners
                const screwR = 4;
                const screwInset = 10;
                p.fill(55, 50, 40);
                for (const [sx, sy] of [
                    [x + screwInset, y + screwInset],
                    [x + w - screwInset, y + screwInset],
                    [x + screwInset, y + h - screwInset],
                    [x + w - screwInset, y + h - screwInset]
                ]) {
                    p.ellipse(sx, sy, screwR * 2, screwR * 2);
                    p.stroke(40, 35, 25);
                    p.strokeWeight(1);
                    p.line(sx - 2, sy, sx + 2, sy);
                    p.noStroke();
                }
            }

            p.draw = () => {
                const speed = preset.params.speed;
                const t = p.frameCount * 0.02 * speed;
                const bass = preset.audio.bass;
                const treble = preset.audio.treble;
                const rms = preset.audio.rms;
                const pulse = preset.beatPulse;
                preset.beatPulse *= 0.88;

                const w = p.width;
                const h = p.height;
                p.background(0);

                // Glow decay
                glowIntensity = glowIntensity * 0.92 + pulse * 0.3;

                // Autonomous sway when no audio
                const autoSwayL = Math.sin(t * 0.7) * 0.04 + Math.sin(t * 1.1) * 0.02;
                const autoSwayR = Math.sin(t * 0.9 + 1.5) * 0.04 + Math.sin(t * 1.3 + 0.8) * 0.02;

                // Target needle positions: bass drives left, treble drives right
                needleTargetL = Math.min(0.95, bass * 0.75 + pulse * 0.25 + 0.05 + autoSwayL);
                needleTargetR = Math.min(0.95, treble * 0.75 + pulse * 0.25 + 0.05 + autoSwayR);

                // Beat slam — overshoot then spring back
                if (pulse > 0.5) {
                    needleTargetL = Math.min(0.98, needleTargetL + pulse * 0.3);
                    needleTargetR = Math.min(0.98, needleTargetR + pulse * 0.3);
                }

                // Smooth needle physics (fast attack, slower release)
                const attackL = needleTargetL > needleL ? 0.35 : 0.08;
                const attackR = needleTargetR > needleR ? 0.35 : 0.08;
                needleL += (needleTargetL - needleL) * attackL;
                needleR += (needleTargetR - needleR) * attackR;

                // Peak tracking
                if (needleL > 0.77) { peakL = 1; peakDecayL = 60; }
                if (needleR > 0.77) { peakR = 1; peakDecayR = 60; }
                if (peakDecayL > 0) peakDecayL--;
                else peakL *= 0.95;
                if (peakDecayR > 0) peakDecayR--;
                else peakR *= 0.95;

                // Meter dimensions — large and centered
                const meterGap = w * 0.03;
                const meterW = Math.min(w * 0.44, h * 0.7);
                const meterH = meterW * 0.75;
                const totalW = meterW * 2 + meterGap;
                const startX = (w - totalW) / 2;
                const startY = (h - meterH) / 2;

                // Background panel behind both meters
                p.noStroke();
                p.fill(8, 6, 4);
                p.rect(startX - 20, startY - 30, totalW + 40, meterH + 80, 12);
                // Brushed metal top strip
                p.fill(35, 30, 22);
                p.rect(startX - 15, startY - 25, totalW + 30, 14, 4);

                // Brand text
                p.fill(140, 120, 80);
                p.noStroke();
                p.textSize(Math.max(10, meterW * 0.04));
                p.textAlign(p.CENTER, p.CENTER);
                p.text('STEREO LEVEL METER', w / 2, startY - 16);

                // Draw both meters
                drawMeter(startX, startY, meterW, meterH, needleL, peakL, 'L', t);
                drawMeter(startX + meterW + meterGap, startY, meterW, meterH, needleR, peakR, 'R', t);

                // Ambient glow behind meters on beat
                if (glowIntensity > 0.05) {
                    p.noStroke();
                    p.fill(255, 160, 40, glowIntensity * 25);
                    p.ellipse(w / 2, h / 2, totalW * 1.2, meterH * 1.5);
                }

                // Subtle scanlines for vintage feel
                p.stroke(0, 0, 0, 12);
                p.strokeWeight(1);
                for (let sy = 0; sy < h; sy += 4) {
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
    }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['boombox-meter'] = BoomboxMeterPreset;
})();
