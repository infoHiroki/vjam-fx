(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

class FloatingUiPreset extends BasePreset {
    constructor() {
        super();
        this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
        this.beatPulse = 0;
    }

    setup(container) {
        this.destroy();
        const preset = this;

        this.p5 = new p5((p) => {
            const windows = [];
            const NUM_WINDOWS = 14;

            const TYPES = [
                'terminal', 'browser', 'dialog', 'chart', 'code',
                'file-manager', 'music', 'settings', 'alert', 'chat'
            ];

            const TITLES = {
                'terminal': ['bash — 80x24', 'zsh — ~/dev', 'node — REPL', 'ssh — remote'],
                'browser': ['https://127.0.0.1', 'localhost:8080', 'WebGL Demo', 'API Docs'],
                'dialog': ['Warning', 'Confirm Delete?', 'Save Changes', 'System Alert'],
                'chart': ['CPU Monitor', 'Network I/O', 'Memory Usage', 'Disk Activity'],
                'code': ['main.js', 'shader.glsl', 'index.html', 'style.css'],
                'file-manager': ['~/Documents', '/usr/local', 'Downloads', 'Projects'],
                'music': ['Now Playing', 'Playlist', 'Equalizer', 'Library'],
                'settings': ['Display', 'Audio', 'Network', 'System'],
                'alert': ['ERROR 0x3F', 'CRITICAL', 'OVERFLOW', 'TIMEOUT'],
                'chat': ['#general', '@admin', 'DM — user42', 'Broadcast']
            };

            const HUES = [190, 280, 310, 140, 30, 200, 50, 170, 0, 260];

            function createWindow(i) {
                const type = TYPES[i % TYPES.length];
                const minW = p.width * 0.18;
                const maxW = p.width * 0.35;
                const w = p.random(minW, maxW);
                const h = w * p.random(0.55, 0.85);
                return {
                    x: p.random(-w * 0.2, p.width - w * 0.8),
                    y: p.random(-h * 0.2, p.height - h * 0.8),
                    w, h,
                    vx: p.random(-0.4, 0.4),
                    vy: p.random(-0.3, 0.3),
                    angle: p.random(-0.06, 0.06),
                    rotSpeed: p.random(-0.002, 0.002),
                    hue: HUES[i % HUES.length],
                    type,
                    title: p.random(TITLES[type]),
                    dataValues: Array.from({ length: 6 }, () => p.random(0.1, 1.0)),
                    targetValues: Array.from({ length: 6 }, () => p.random(0.1, 1.0)),
                    flash: 0,
                    depth: p.random(0.7, 1.0),
                    scatterVx: 0,
                    scatterVy: 0,
                    textLines: Array.from({ length: 8 }, () => generateCodeLine(p)),
                    scrollOffset: 0
                };
            }

            function generateCodeLine(p) {
                const keywords = ['const', 'let', 'if', 'return', 'for', 'while', 'import', 'export', 'function', 'class'];
                const vars = ['data', 'buf', 'ctx', 'gl', 'res', 'tmp', 'val', 'ptr', 'src', 'out'];
                const ops = [' = ', ' += ', ' => ', ' !== ', ' === ', ' || ', ' && '];
                return p.random(keywords) + ' ' + p.random(vars) + p.random(ops) + p.random(vars) + ';';
            }

            p.setup = () => {
                p.createCanvas(container.clientWidth, container.clientHeight);
                p.pixelDensity(1);
                p.colorMode(p.HSB, 360, 100, 100, 100);
                p.textFont('monospace');
                for (let i = 0; i < NUM_WINDOWS; i++) {
                    windows.push(createWindow(i));
                }
            };

            p.draw = () => {
                p.background(0);
                preset.beatPulse *= 0.92;
                const bass = preset.audio.bass;
                const mid = preset.audio.mid;
                const treble = preset.audio.treble;

                // Beat scatter effect
                if (preset.beatPulse > 0.5) {
                    for (const w of windows) {
                        w.scatterVx = p.random(-4, 4) * preset.beatPulse;
                        w.scatterVy = p.random(-4, 4) * preset.beatPulse;
                        w.flash = preset.beatPulse;
                    }
                }

                for (const win of windows) {
                    // Drift + scatter
                    win.scatterVx *= 0.94;
                    win.scatterVy *= 0.94;
                    win.x += win.vx + win.scatterVx;
                    win.y += win.vy + win.scatterVy;
                    win.angle += win.rotSpeed;
                    win.flash *= 0.9;
                    win.scrollOffset += 0.02;

                    // Wrap around screen
                    if (win.x > p.width + win.w * 0.3) win.x = -win.w * 0.8;
                    if (win.x < -win.w * 0.8) win.x = p.width + win.w * 0.3;
                    if (win.y > p.height + win.h * 0.3) win.y = -win.h * 0.8;
                    if (win.y < -win.h * 0.8) win.y = p.height + win.h * 0.3;

                    // Animate data values
                    for (let i = 0; i < win.dataValues.length; i++) {
                        win.dataValues[i] += (win.targetValues[i] - win.dataValues[i]) * 0.04;
                        if (p.abs(win.dataValues[i] - win.targetValues[i]) < 0.02) {
                            win.targetValues[i] = p.random(0.05, 1.0);
                        }
                    }

                    p.push();
                    p.translate(win.x + win.w / 2, win.y + win.h / 2);
                    p.rotate(win.angle + p.sin(p.frameCount * 0.008 + windows.indexOf(win)) * 0.02);
                    p.translate(-win.w / 2, -win.h / 2);

                    const bright = 55 + win.flash * 45 + bass * 15;
                    const alpha = 65 + win.depth * 30;
                    const headerH = win.h * 0.1;
                    const hue = win.hue;

                    // Window shadow / glow
                    p.noStroke();
                    p.fill(hue, 60, 30, alpha * 0.15);
                    p.rect(4, 4, win.w, win.h, 4);

                    // Window background
                    p.fill(hue, 30, 8, alpha * 0.7);
                    p.stroke(hue, 60, bright, alpha);
                    p.strokeWeight(1.5);
                    p.rect(0, 0, win.w, win.h, 4);

                    // Title bar
                    p.noStroke();
                    p.fill(hue, 50, bright * 0.6, alpha * 0.9);
                    p.rect(0, 0, win.w, headerH, 4, 4, 0, 0);

                    // Title bar buttons (close, minimize, maximize)
                    const btnR = headerH * 0.22;
                    const btnY = headerH / 2;
                    p.fill(0, 80, 80, alpha);
                    p.ellipse(btnR * 2.5, btnY, btnR * 2, btnR * 2);
                    p.fill(45, 80, 80, alpha);
                    p.ellipse(btnR * 6, btnY, btnR * 2, btnR * 2);
                    p.fill(120, 70, 70, alpha);
                    p.ellipse(btnR * 9.5, btnY, btnR * 2, btnR * 2);

                    // Title text
                    p.fill(0, 0, 100, alpha);
                    p.textSize(p.max(9, headerH * 0.55));
                    p.textAlign(p.CENTER, p.CENTER);
                    p.text(win.title, win.w / 2, btnY);

                    // Content area
                    const contentY = headerH + 4;
                    const contentH = win.h - headerH - 8;

                    if (win.type === 'terminal' || win.type === 'code') {
                        drawTerminalContent(p, win, contentY, contentH, hue, bright, alpha);
                    } else if (win.type === 'chart' || win.type === 'music') {
                        drawChartContent(p, win, contentY, contentH, hue, bright, alpha, bass);
                    } else if (win.type === 'dialog' || win.type === 'alert') {
                        drawDialogContent(p, win, contentY, contentH, hue, bright, alpha);
                    } else if (win.type === 'browser') {
                        drawBrowserContent(p, win, contentY, contentH, hue, bright, alpha, mid);
                    } else {
                        drawListContent(p, win, contentY, contentH, hue, bright, alpha);
                    }

                    p.pop();
                }

                // Scanline overlay
                p.stroke(0, 0, 100, 3);
                p.strokeWeight(1);
                for (let y = 0; y < p.height; y += 4) {
                    p.line(0, y, p.width, y);
                }
            };

            function drawTerminalContent(p, win, cy, ch, hue, bright, alpha) {
                p.textSize(p.max(8, win.w * 0.028));
                p.textAlign(p.LEFT, p.TOP);
                const lineH = p.max(10, ch / 8);
                const numLines = p.floor(ch / lineH);
                for (let i = 0; i < numLines; i++) {
                    const lineIdx = (i + p.floor(win.scrollOffset)) % win.textLines.length;
                    const lineAlpha = alpha * (0.5 + 0.5 * p.sin(p.frameCount * 0.03 + i));
                    if (i === numLines - 1) {
                        // Cursor blink
                        p.fill(120, 80, bright, alpha * (p.sin(p.frameCount * 0.1) > 0 ? 0.9 : 0.2));
                        p.text('> _', 8, cy + i * lineH);
                    } else {
                        p.fill(hue, 30, bright, lineAlpha * 0.8);
                        p.text(win.textLines[lineIdx], 8, cy + i * lineH);
                    }
                }
            }

            function drawChartContent(p, win, cy, ch, hue, bright, alpha, bass) {
                const barCount = win.dataValues.length;
                const barW = (win.w - 20) / barCount - 4;
                const maxBarH = ch - 20;
                for (let i = 0; i < barCount; i++) {
                    const val = win.dataValues[i] + bass * 0.2;
                    const bH = maxBarH * p.min(val, 1.0);
                    const x = 10 + i * (barW + 4);
                    const barHue = (hue + i * 30) % 360;
                    // Bar bg
                    p.fill(barHue, 20, 15, alpha * 0.3);
                    p.noStroke();
                    p.rect(x, cy + ch - maxBarH - 4, barW, maxBarH);
                    // Bar value
                    p.fill(barHue, 70, bright, alpha * 0.85);
                    p.rect(x, cy + ch - bH - 4, barW, bH);
                    // Value label
                    p.fill(0, 0, 100, alpha * 0.6);
                    p.textSize(p.max(7, barW * 0.3));
                    p.textAlign(p.CENTER, p.BOTTOM);
                    p.text(p.nf(val * 100, 2, 0), x + barW / 2, cy + ch - bH - 6);
                }
            }

            function drawDialogContent(p, win, cy, ch, hue, bright, alpha) {
                // Icon
                const iconSize = p.min(ch * 0.35, win.w * 0.12);
                const centerX = win.w / 2;
                const iconY = cy + ch * 0.3;
                p.noFill();
                p.stroke(hue, 80, bright, alpha);
                p.strokeWeight(2);
                p.triangle(centerX, iconY - iconSize / 2, centerX - iconSize / 2, iconY + iconSize / 2, centerX + iconSize / 2, iconY + iconSize / 2);
                p.fill(hue, 80, bright, alpha);
                p.noStroke();
                p.textSize(iconSize * 0.5);
                p.textAlign(p.CENTER, p.CENTER);
                p.text('!', centerX, iconY + iconSize * 0.1);

                // Message
                p.fill(0, 0, 90, alpha * 0.8);
                p.textSize(p.max(9, win.w * 0.035));
                p.text(win.title, centerX, iconY + iconSize * 0.9);

                // Buttons
                const btnW = win.w * 0.28;
                const btnH = ch * 0.15;
                const btnY = cy + ch - btnH - 8;
                // OK button
                p.fill(hue, 50, bright * 0.4, alpha * 0.7);
                p.stroke(hue, 60, bright, alpha * 0.5);
                p.strokeWeight(1);
                p.rect(centerX - btnW - 6, btnY, btnW, btnH, 3);
                p.noStroke();
                p.fill(0, 0, 100, alpha);
                p.textSize(p.max(8, btnH * 0.5));
                p.text('OK', centerX - btnW / 2 - 6, btnY + btnH / 2);
                // Cancel button
                p.fill(0, 0, 20, alpha * 0.5);
                p.stroke(hue, 40, bright * 0.5, alpha * 0.5);
                p.strokeWeight(1);
                p.rect(centerX + 6, btnY, btnW, btnH, 3);
                p.noStroke();
                p.fill(0, 0, 80, alpha * 0.7);
                p.text('Cancel', centerX + btnW / 2 + 6, btnY + btnH / 2);
            }

            function drawBrowserContent(p, win, cy, ch, hue, bright, alpha, mid) {
                // URL bar
                const urlH = p.max(14, ch * 0.1);
                p.fill(0, 0, 15, alpha * 0.6);
                p.noStroke();
                p.rect(8, cy + 4, win.w - 16, urlH, 3);
                p.fill(0, 0, 70, alpha * 0.6);
                p.textSize(p.max(7, urlH * 0.55));
                p.textAlign(p.LEFT, p.CENTER);
                p.text('https://' + win.title.replace('https://', ''), 14, cy + 4 + urlH / 2);

                // Fake page content - animated lines
                const lineY = cy + urlH + 10;
                const lineCount = p.floor((ch - urlH - 14) / 10);
                for (let i = 0; i < lineCount; i++) {
                    const lw = win.w * (0.3 + 0.6 * p.noise(i * 0.3 + p.frameCount * 0.005));
                    const lAlpha = alpha * (0.3 + mid * 0.3);
                    p.fill(hue, 20, bright * 0.4, lAlpha);
                    p.noStroke();
                    p.rect(8, lineY + i * 10, p.min(lw, win.w - 16), 6, 2);
                }
            }

            function drawListContent(p, win, cy, ch, hue, bright, alpha) {
                const itemH = p.max(14, ch / 6);
                const items = ['Documents', 'Images', 'system.cfg', 'backup.tar', 'README.md', 'node_modules'];
                const icons = ['📁', '🖼', '⚙', '📦', '📄', '📂'];
                for (let i = 0; i < p.min(items.length, p.floor(ch / itemH)); i++) {
                    const y = cy + i * itemH;
                    // Hover highlight
                    if (i === p.floor((p.frameCount * 0.02) % items.length)) {
                        p.fill(hue, 30, bright * 0.2, alpha * 0.3);
                        p.noStroke();
                        p.rect(4, y, win.w - 8, itemH);
                    }
                    p.fill(0, 0, 90, alpha * 0.75);
                    p.textSize(p.max(8, itemH * 0.5));
                    p.textAlign(p.LEFT, p.CENTER);
                    p.text(icons[i] + ' ' + items[i], 12, y + itemH / 2);
                }
            }

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
window.VJamFX.presets['floating-ui'] = FloatingUiPreset;
})();
