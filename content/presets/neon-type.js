(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

const QWERTY = [
  '1234567890',
  'QWERTYUIOP',
  'ASDFGHJKL',
  'ZXCVBNM',
];

class NeonTypePreset extends BasePreset {
  constructor() {
    super();
    this.params = { speed: 1 };
    this.audio = { bass: 0, mid: 0, treble: 0, rms: 0 };
    this.beatPulse = 0;
    this.userText = '';
  }

  setup(container) {
    this.destroy();
    const preset = this;

    this.p5 = new p5((p) => {
      let keys = [];
      let keyMap = {};
      let typedLines = [];    // array of strings (completed lines)
      let currentLine = '';   // line being typed
      let textIdx = 0;       // position in user text (loops)
      let activeBar = null;
      let strikeFrame = -999;

      // Layout
      let paperX, paperW, paperY, paperH, platenY, platenH;
      let kbStartY, keyR;
      let lineHeight, maxCharsPerLine, maxVisibleLines, fontSize;

      p.setup = () => {
        p.createCanvas(container.clientWidth, container.clientHeight);
        p.pixelDensity(1);
        buildLayout();
      };

      function buildLayout() {
        const W = p.width;
        const H = p.height;
        keyR = W / 40;

        paperX = W * 0.1;
        paperW = W * 0.8;
        paperY = H * 0.02;
        paperH = H * 0.4;

        // Text sizing for paper
        fontSize = Math.max(10, Math.min(16, H * 0.022));
        lineHeight = fontSize * 1.6;
        maxCharsPerLine = Math.floor(paperW / (fontSize * 0.62)) - 2;
        maxVisibleLines = Math.floor((paperH - 20) / lineHeight);

        platenH = keyR * 1.4;
        platenY = paperY + paperH + H * 0.01;
        kbStartY = platenY + platenH + H * 0.04;

        // Build QWERTY keys
        keys = [];
        keyMap = {};
        const rowOffsets = [0, 0.3, 0.7, 1.5];
        for (let r = 0; r < QWERTY.length; r++) {
          const row = QWERTY[r];
          const spacing = keyR * 2.5;
          const rowW = row.length * spacing;
          const startX = (W - rowW) / 2 + spacing / 2 + rowOffsets[r] * keyR;
          const y = kbStartY + r * (keyR * 2.4);
          for (let c = 0; c < row.length; c++) {
            const ch = row[c];
            const key = {
              x: startX + c * spacing, y, r: keyR, ch,
              depression: 0, active: 0,
            };
            keys.push(key);
            keyMap[ch] = key;
          }
        }
        const spaceKey = {
          x: W / 2, y: kbStartY + 4 * (keyR * 2.4),
          r: keyR, ch: ' ', depression: 0, active: 0, isSpace: true,
        };
        keys.push(spaceKey);
        keyMap[' '] = spaceKey;
      }

      p.draw = () => {
        p.background(0);
        const text = (preset.userText || 'YOU ARE ALREADY FALLING NO NEED TO JUMP') + '          ';
        const bass = preset.audio.bass;
        const pulse = preset.beatPulse;
        preset.beatPulse *= 0.9;

        const neonColors = [
          [0, 255, 136], [255, 0, 102], [0, 204, 255],
          [255, 204, 0], [255, 0, 255], [136, 255, 0],
        ];
        const ci = Math.floor(p.frameCount / 300) % neonColors.length;
        const nc = neonColors[ci];
        const ncs = `rgb(${nc[0]},${nc[1]},${nc[2]})`;

        // Type a character every N frames
        const typeSpeed = Math.max(3, 8 - Math.floor(pulse * 4));
        if (p.frameCount % typeSpeed === 0) {
          const ch = text[textIdx % text.length];
          textIdx++;

          // Add char to current line
          currentLine += ch;
          strikeFrame = p.frameCount;

          // Activate matching key
          const uch = ch.toUpperCase();
          const matchKey = keyMap[uch];
          if (matchKey) {
            matchKey.active = 1.0;
            activeBar = { fromX: matchKey.x, fromY: matchKey.y, progress: 0 };
          }

          // Line wrap
          if (currentLine.length >= maxCharsPerLine) {
            typedLines.push(currentLine);
            currentLine = '';
            // Scroll if too many lines
            while (typedLines.length >= maxVisibleLines) {
              typedLines.shift();
            }
          }
        }

        // Typebar animation
        if (activeBar) {
          activeBar.progress += 0.25;
          if (activeBar.progress > 1.2) activeBar = null;
        }

        const ctx = p.drawingContext;

        // === PAPER ===
        // Dark paper with subtle warm tint
        p.noStroke();
        p.fill(12, 11, 10);
        p.rect(paperX, paperY, paperW, paperH, 3);

        // Paper border
        ctx.save();
        ctx.shadowColor = ncs;
        ctx.shadowBlur = 4 + pulse * 6;
        ctx.strokeStyle = `rgba(${nc[0]},${nc[1]},${nc[2]},0.15)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(paperX, paperY, paperW, paperH, 3);
        ctx.stroke();
        ctx.restore();

        // Draw typed text on paper
        ctx.save();
        ctx.font = `400 ${fontSize}px "Courier New", monospace`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        const textStartX = paperX + 12;
        const textStartY = paperY + 10;

        // Completed lines
        for (let i = 0; i < typedLines.length; i++) {
          const ly = textStartY + i * lineHeight;
          ctx.shadowColor = ncs;
          ctx.shadowBlur = 3 + bass * 5;
          ctx.fillStyle = `rgba(${nc[0]},${nc[1]},${nc[2]},0.7)`;
          ctx.fillText(typedLines[i], textStartX, ly);
        }

        // Current line (being typed)
        const curLineY = textStartY + typedLines.length * lineHeight;
        if (currentLine.length > 0) {
          // Each char with possible flash on newest
          for (let i = 0; i < currentLine.length; i++) {
            const cx = textStartX + i * fontSize * 0.6;
            const isNewest = (i === currentLine.length - 1) &&
                     (p.frameCount - strikeFrame < 6);

            if (isNewest) {
              // Flash on newest char
              ctx.shadowColor = '#fff';
              ctx.shadowBlur = 12;
              ctx.fillStyle = '#fff';
              ctx.globalAlpha = 1;
            } else {
              ctx.shadowColor = ncs;
              ctx.shadowBlur = 3 + bass * 5;
              ctx.fillStyle = `rgba(${nc[0]},${nc[1]},${nc[2]},0.7)`;
              ctx.globalAlpha = 1;
            }
            ctx.fillText(currentLine[i], cx, curLineY);
          }
        }

        // Blinking cursor
        const cursorX = textStartX + currentLine.length * fontSize * 0.6;
        if (Math.sin(p.frameCount * 0.12) > -0.3) {
          ctx.shadowColor = ncs;
          ctx.shadowBlur = 10;
          ctx.fillStyle = ncs;
          ctx.globalAlpha = 0.8;
          ctx.fillRect(cursorX, curLineY, fontSize * 0.55, fontSize * 1.1);
        }
        ctx.restore();

        // === PLATEN (roller) ===
        const grad = ctx.createLinearGradient(0, platenY, 0, platenY + platenH);
        grad.addColorStop(0, '#181820');
        grad.addColorStop(0.35, '#28283a');
        grad.addColorStop(0.65, '#181820');
        grad.addColorStop(1, '#0c0c12');
        ctx.fillStyle = grad;
        ctx.fillRect(paperX - 12, platenY, paperW + 24, platenH);

        // Roller knobs
        p.fill(18, 18, 25);
        p.ellipse(paperX - 18, platenY + platenH / 2, keyR * 1.6, keyR * 1.6);
        p.ellipse(paperX + paperW + 18, platenY + platenH / 2, keyR * 1.6, keyR * 1.6);
        ctx.save();
        ctx.shadowColor = ncs;
        ctx.shadowBlur = 5;
        ctx.strokeStyle = `rgba(${nc[0]},${nc[1]},${nc[2]},0.25)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(paperX - 18, platenY + platenH / 2, keyR * 0.65, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(paperX + paperW + 18, platenY + platenH / 2, keyR * 0.65, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // === TYPEBAR ===
        const strikeTargetX = cursorX;
        const strikeTargetY = platenY + platenH * 0.3;
        if (activeBar && activeBar.progress <= 1.0) {
          const prog = Math.min(1, activeBar.progress);
          const bx = p.lerp(activeBar.fromX, strikeTargetX, prog);
          const by = p.lerp(activeBar.fromY - keyR, strikeTargetY, prog);
          ctx.save();
          ctx.shadowColor = ncs;
          ctx.shadowBlur = 6 + prog * 10;
          ctx.strokeStyle = `rgba(${nc[0]},${nc[1]},${nc[2]},${0.5 * (1 - prog * 0.4)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(activeBar.fromX, activeBar.fromY - keyR);
          ctx.lineTo(bx, by);
          ctx.stroke();
          if (prog > 0.7) {
            ctx.fillStyle = '#fff';
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(bx, by, 2 * (1 - prog) * 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // === KEYBOARD BODY ===
        p.noStroke();
        p.fill(5, 5, 8);
        const kbBodyY = kbStartY - keyR * 1.6;
        p.rect(p.width * 0.04, kbBodyY, p.width * 0.92, p.height - kbBodyY - 2, 8);

        // Ambient key activations
        if (p.frameCount % (pulse > 0.3 ? 4 : 16) === 0) {
          const idx = Math.floor(Math.random() * keys.length);
          keys[idx].active = Math.max(keys[idx].active, 0.2);
        }

        // === ROUND KEYS ===
        for (const key of keys) {
          if (key.active > 0) {
            key.depression = p.lerp(key.depression, 4, 0.35);
            key.active -= 0.04;
          } else {
            key.depression = p.lerp(key.depression, 0, 0.12);
          }

          const dep = key.depression;
          const isActive = key.active > 0.05;
          const kx = key.x;
          const ky = key.y + dep;
          const kr = key.r;

          if (key.isSpace) {
            const sw = kr * 7;
            const sh = kr * 1.1;
            p.fill(0, 0, 0, 70);
            p.rect(kx - sw / 2 + 2, ky - sh / 2 + 3, sw, sh, sh / 2);
            p.fill(isActive ? 32 : 20, isActive ? 32 : 20, isActive ? 36 : 24);
            p.rect(kx - sw / 2, ky - sh / 2, sw, sh, sh / 2);
            if (isActive && key.active > 0.2) {
              ctx.save();
              ctx.shadowColor = ncs;
              ctx.shadowBlur = 8 * key.active;
              ctx.strokeStyle = `rgba(${nc[0]},${nc[1]},${nc[2]},${key.active * 0.35})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.roundRect(kx - sw / 2, ky - sh / 2, sw, sh, sh / 2);
              ctx.stroke();
              ctx.restore();
            }
            continue;
          }

          // Shadow
          p.fill(0, 0, 0, 60);
          p.ellipse(kx + 1, ky + 2.5, kr * 2, kr * 2);

          // Key cap
          const bri = 16 + bass * 8 + (isActive ? 16 : 0);
          p.fill(bri, bri, bri + 3);
          p.ellipse(kx, ky, kr * 1.9, kr * 1.9);

          // Rim
          p.noFill();
          p.stroke(35 + (isActive ? 15 : 0));
          p.strokeWeight(1);
          p.ellipse(kx, ky, kr * 1.95, kr * 1.95);
          p.noStroke();

          // Neon glow on active
          if (isActive && key.active > 0.15) {
            ctx.save();
            ctx.shadowColor = ncs;
            ctx.shadowBlur = 10 * key.active;
            ctx.strokeStyle = `rgba(${nc[0]},${nc[1]},${nc[2]},${key.active * 0.5})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(kx, ky, kr * 0.95, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          // Letter
          ctx.save();
          ctx.font = `700 ${kr * 0.85}px "Courier New", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (isActive && key.active > 0.3) {
            ctx.shadowColor = ncs;
            ctx.shadowBlur = 6;
            ctx.fillStyle = ncs;
          } else {
            ctx.fillStyle = 'rgba(160,160,170,0.45)';
          }
          ctx.fillText(key.ch, kx, ky);
          ctx.restore();
        }

        // Strike flash
        const sf = Math.max(0, 1 - (p.frameCount - strikeFrame) / 6);
        if (sf > 0.05) {
          p.fill(nc[0], nc[1], nc[2], sf * 12);
          p.rect(0, 0, p.width, p.height);
        }

        // Beat flash
        if (pulse > 0.3) {
          p.fill(nc[0], nc[1], nc[2], pulse * 8);
          p.rect(0, 0, p.width, p.height);
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
        buildLayout();
      };
    }, container);
  }

  updateAudio(audioData) {
    this.audio.bass = audioData.bass || 0;
    this.audio.mid = audioData.mid || 0;
    this.audio.treble = audioData.treble || 0;
    this.audio.rms = audioData.rms || 0;
  }

  setParam(key, value) {
    super.setParam(key, value);
    if (key === 'text' && value) {
      this.userText = value;
    }
  }

  onBeat(strength) {
    this.beatPulse = strength;
  }
}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['neon-type'] = NeonTypePreset;
})();
