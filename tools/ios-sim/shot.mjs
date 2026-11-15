// App Store のスクショ: シミュレータの Safari で撮影ページ(store/appstore/demo)を開き、
// Play を押して(ミュート)指定のエフェクトを入れ、待ってから simctl で撮る(拡張は入れない)
//   node tools/ios-sim/shot.mjs <URL> <出力.png> <プリセット,...> [待つ秒(既定 6)]
//   例: node tools/ios-sim/shot.mjs "http://localhost:8000/#en" build/shots/01.png neon-tunnel,fireflies,neon-frame
// シミュレータの名前は SIM(既定 booted)、プロキシの番号は SIMPORT
import { readFileSync, mkdirSync, copyFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { dirname, resolve } from 'path';
import { connect, startEngine, sleep } from './sim.mjs';

const [url, out, list, wait = '6'] = process.argv.slice(2);
if (!url || !out || !list) { console.error('usage: shot.mjs <URL> <out.png> <presets> [wait]'); process.exit(1); }
const B = new URL('../../build/safari-ext', import.meta.url).pathname;
const s = await connect();
// 同じページの hash だけ違うと読み直されないので、一度 about:blank を挟む
await s.ev(`location.href = 'about:blank'; 'nav'`).catch(() => {}); await sleep(1500);
s.close();
const p = await connect();
await p.ev(`location.href = ${JSON.stringify(url)}; 'nav'`).catch(() => {}); await sleep(5000);
const q = await connect();
const mute = `;(function(){const P=HTMLMediaElement.prototype;const op=P.play;P.play=function(){this.muted=true;this.volume=0;return op.apply(this,arguments)};})();`;
await q.ev(mute + readFileSync(`${B}/content/mse-tap.js`, 'utf8') + `\n;'tap'`);
console.log('play:', await q.ev(`(() => { const b = document.getElementById('play'); if (!b) return 'no button'; b.click(); return 'ok'; })()`, true));
await sleep(3000);
await startEngine(q, list.split(','));
await sleep(Number(wait) * 1000);
console.log('layers:', await q.ev(`window._vjamFxEngine.getActiveLayerNames()`));
// シミュレータは外付けのボリュームに直接書けないことがあるので、一時フォルダに撮ってから写す
const tmp = `${tmpdir()}/vjam-shot-${Date.now()}.png`;
execFileSync('xcrun', ['simctl', 'io', process.env.SIM || 'booted', 'screenshot', '--type=png', tmp]);
mkdirSync(dirname(resolve(out)), { recursive: true }); copyFileSync(tmp, out);
console.log('saved', out);
q.close();
process.exit(0);
