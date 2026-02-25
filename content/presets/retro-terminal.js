(function() {
    'use strict';

    window.VJamFX = window.VJamFX || { presets: {} };
    const BasePreset = window.VJamFX.BasePreset;

    class RetroTerminalPreset extends BasePreset {
        constructor() {
            super();
            this.audio = { bass: 0, mid: 0, treble: 0, rms: 0, strength: 0 };
            this.beatPulse = 0;
            this.lines = [];
            this.currentLine = '';
            this.cursorVisible = true;
            this.charTimer = 0;
            this.maxLines = 30;
            this.charPool = '0123456789ABCDEF';
            this.commands = [
                '> INIT SYSTEM v4.2.1',
                '> LOAD 0xFF00CC SECTOR 7',
                '> PING 192.168.0.1 OK',
                '> SCAN PORT 8080...OPEN',
                '> GET /api/stream HTTP/1.1',
                '> chmod 755 /usr/bin/vj',
                '> ssh root@10.0.0.42',
                '> DECRYPT AES-256 BLOCK',
                '> CONNECT NODE 0xDEAD',
                '> TRACE ROUTE 6 HOPS',
                '> MEM 0x7FFF ALLOC 4096',
                '> SYNC BEAT_CLK 128BPM',
                '> RENDER FRAME 0x00FF',
                '> UPLOAD 99.7% COMPLETE',
                '> KERNEL PANIC AT 0xBEEF',
            ];
            this.typeSpeed = 3;
            this.cmdIndex = 0;
            this.cmdCharIndex = 0;
        }

        setup(container) {
            this.destroy();
            this.lines = [];
            this.currentLine = '';
            this.cmdIndex = 0;
            this.cmdCharIndex = 0;
            const preset = this;

            this.p5 = new p5((p) => {
                p.setup = () => {
                    p.createCanvas(container.clientWidth, container.clientHeight);
                    p.pixelDensity(1);
                    p.textFont('monospace');
                    p.textSize(14);
                    p.textAlign(p.LEFT, p.TOP);
                };

                p.draw = () => {
                    p.background(5, 5, 15);
                    preset.beatPulse *= 0.92;

                    const lineH = 18;
                    const marginX = 20;
                    const marginY = 20;
                    preset.maxLines = Math.floor((p.height - marginY * 2) / lineH);

                    // Typing speed
                    const speed = preset.beatPulse > 0.3 ? 1 : preset.typeSpeed;
                    if (p.frameCount % speed === 0) {
                        const cmd = preset.commands[preset.cmdIndex % preset.commands.length];
                        if (preset.cmdCharIndex < cmd.length) {
                            preset.currentLine += cmd[preset.cmdCharIndex];
                            preset.cmdCharIndex++;
                        } else {
                            preset.lines.push(preset.currentLine);
                            preset.currentLine = '';
                            preset.cmdCharIndex = 0;
                            preset.cmdIndex++;
                            if (preset.lines.length > preset.maxLines) {
                                preset.lines.shift();
                            }
                        }
                    }

                    // Draw completed lines
                    p.noStroke();
                    for (let i = 0; i < preset.lines.length; i++) {
                        const alpha = p.map(i, 0, preset.lines.length, 80, 200);
                        p.fill(0, 255, 0, alpha);
                        p.text(preset.lines[i], marginX, marginY + i * lineH);
                    }

                    // Draw current line with cursor
                    const cy = marginY + preset.lines.length * lineH;
                    p.fill(0, 255, 0, 220);
                    p.text(preset.currentLine, marginX, cy);

                    // Blinking cursor
                    if (Math.floor(p.frameCount / 30) % 2 === 0) {
                        const cursorX = marginX + p.textWidth(preset.currentLine);
                        p.fill(0, 255, 0, 240);
                        p.rect(cursorX + 2, cy, 8, 14);
                    }

                    // Scanlines
                    p.stroke(0, 0, 0, 40);
                    p.strokeWeight(1);
                    for (let y = 0; y < p.height; y += 3) {
                        p.line(0, y, p.width, y);
                    }

                    // Beat flash
                    if (preset.beatPulse > 0.2) {
                        p.noStroke();
                        p.fill(0, 255, 0, preset.beatPulse * 30);
                        p.rect(0, 0, p.width, p.height);
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
        }
    }

    window.VJamFX.presets['retro-terminal'] = RetroTerminalPreset;
})();
