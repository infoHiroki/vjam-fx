#!/usr/bin/env node
/**
 * Convert VJam presets (ES module) to VJam FX format (IIFE + window.VJamFX.presets)
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = '/Users/hirokitakamura/Dev/VJ/web/static/js/presets';
const DEST_DIR = path.join(__dirname, '..', 'content', 'presets');
const PRESETS_FILE = '/tmp/presets_to_port.txt';

const presetFiles = fs.readFileSync(PRESETS_FILE, 'utf-8').trim().split('\n');

let converted = 0;
let skipped = 0;

for (const file of presetFiles) {
  const srcPath = path.join(SRC_DIR, file);
  const destPath = path.join(DEST_DIR, file);

  if (fs.existsSync(destPath)) {
    console.log(`SKIP (exists): ${file}`);
    skipped++;
    continue;
  }

  let code = fs.readFileSync(srcPath, 'utf-8');

  // Extract class name
  const classMatch = code.match(/class\s+(\w+)\s+extends\s+BasePreset/);
  if (!classMatch) {
    console.log(`SKIP (no class): ${file}`);
    skipped++;
    continue;
  }

  const className = classMatch[1];
  const presetId = file.replace('.js', '');

  // Remove import line
  code = code.replace(/import\s+BasePreset\s+from\s+['"]\.\/base-preset\.js['"];\s*\n?/, '');

  // Remove export default
  code = code.replace(/export\s+default\s+/, '');

  // Handle createGraphics leak: add .remove() before reassignment in windowResized
  // Pattern: pg = p.createGraphics(...) in windowResized should be preceded by if (pg) pg.remove();
  // We'll handle this with a regex that looks for createGraphics reassignments in windowResized
  code = code.replace(
    /(p\.windowResized\s*=\s*\(\)\s*=>\s*\{[^}]*?)((\w+)\s*=\s*p\.createGraphics\()/gm,
    (match, before, createCall, varName) => {
      if (before.includes(varName + '.remove()')) return match; // already handled
      return before + `if (${varName}) ${varName}.remove();\n                ` + createCall;
    }
  );

  // Wrap in IIFE
  const output = `(function() {
'use strict';
const BasePreset = window.VJamFX.BasePreset;

${code.trim()}

window.VJamFX = window.VJamFX || { presets: {} };
window.VJamFX.presets['${presetId}'] = ${className};
})();
`;

  fs.writeFileSync(destPath, output);
  converted++;
  console.log(`OK: ${file} → ${className}`);
}

console.log(`\nDone: ${converted} converted, ${skipped} skipped`);
