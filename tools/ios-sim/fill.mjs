// iPhone シミュレータで、フルスクリーンの代わりの「画面いっぱい表示」(#51)を確かめる(常にミュート)
//   1. ページの JS が webkitEnterFullscreen を呼ぶ → 本物のフルスクリーンにならず画面いっぱい・再生が続く → × で戻る
//   2. 元のメソッドで本物のフルスクリーンに入れる(標準の全画面ボタンの代わり)→ 抜けて画面いっぱいに戻ってくる・再生が続く → × で戻る
//   3. 画面いっぱいのままエンジンを OFF → 戻る・webkitEnterFullscreen も元に戻る
//   4. 画面いっぱいの間にページが width を書き直す → 画面いっぱいのまま・× でページの値に戻る
// usage: node tools/ios-sim/fill.mjs [url=http://localhost:8823/native.html] [outDir=build/ios-sim] [presets=neon-rain,sonar-ping]
//   url を http://localhost:8823/trap.html にすると、祖先に transform と低い z-index があり、上に固定ヘッダーが被るページで試す
//   先に bash scripts/build-safari-ext.sh。スクショは outDir/<ページ名>-fill-*.png(端末は SIMDEVICE、既定 "VJam iPhone")
import { execFileSync } from 'child_process';
import { copyFileSync, mkdirSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { connect, openPage, startEngine, sleep } from './sim.mjs';
const [url = 'http://localhost:8823/native.html', outDir = 'build/ios-sim', presetArg = 'neon-rain,sonar-ping'] = process.argv.slice(2);
const DEVICE = process.env.SIMDEVICE || 'VJam iPhone';
const c = await connect();
const { ev } = c;

let failed = 0;
const check = (label, ok, detail) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : '  ' + JSON.stringify(detail)}`);
};
// シミュレータは外付けのボリュームなどに直接書けないことがあるので、一時フォルダに撮ってからコピーする
const tmp = mkdtempSync(join(tmpdir(), 'vjam-fill-'));
const prefix = new URL(url).pathname.replace(/^.*\//, '').replace(/\.html$/, '');
const shot = (name) => {
  name = `${prefix}-${name}`;
  mkdirSync(outDir, { recursive: true });
  const file = resolve(outDir, name);
  execFileSync('xcrun', ['simctl', 'io', DEVICE, 'screenshot', '--type=png', join(tmp, name)], { stdio: 'ignore' });
  copyFileSync(join(tmp, name), file);
  console.log('shot:', file);
};
const clickExit = () => ev(`window._vjamFxEngine.overlay.shadowRoot.querySelector('[data-vjam-fill-exit]').click(); 'ok'`, true);

await openPage(c, url);
// 差し替えられる前の webkitEnterFullscreen(本物のフルスクリーンに入れる)と、戻ったか比べる元の inline の style(全部の要素)
await ev(`window.__origEnter = HTMLVideoElement.prototype.webkitEnterFullscreen;
  document.querySelector('video').style.cssText = 'width: 90%; margin: 8px auto; border-radius: 12px;';
  window.__styles0 = new Map([...document.querySelectorAll('*')].map(el => [el, el.getAttribute('style')])); 'ok'`);
await startEngine(c, presetArg.split(','));

// 本物のフルスクリーンか・矩形と画面・再生・画面の真ん中や端の一番上が video か(overlay は pointer-events: none で数えない。
// www/trap.html の固定ヘッダーと帯の位置も見る)・
// × があって押せるか(真ん中を指したときに当たるのが ×。ホストは pointer-events: none なので、当たらなければ下の video になる)
const state = async () => JSON.parse(await ev(`JSON.stringify((() => {
  const v = document.querySelector('video'), r = v.getBoundingClientRect(), e = window._vjamFxEngine;
  const b = e.overlay && e.overlay.shadowRoot.querySelector('[data-vjam-fill-exit]');
  const br = b && b.getBoundingClientRect(), bx = b && br.x + br.width / 2, by = b && br.y + br.height / 2;
  return { native: v.webkitDisplayingFullscreen, rect: [r.x, r.y, r.width, r.height].map(Math.round), view: [innerWidth, innerHeight],
    paused: v.paused, t: +v.currentTime.toFixed(2),
    top: [[innerWidth / 2, innerHeight / 2], [5, 5], [innerWidth / 2, 30], [innerWidth / 2, 360], [5, innerHeight - 5]].every(p => document.elementFromPoint(p[0], p[1]) === v),
    exit: !!b && (br.width === 44 && document.elementFromPoint(bx, by) === e.overlay && b.contains(e.overlay.shadowRoot.elementFromPoint(bx, by)) ? 'tappable' : 'not tappable'),
    changed: [...window.__styles0].filter(([el, st]) => el.getAttribute('style') !== st).map(([el]) => el.nodeName.toLowerCase() + (el.className ? '.' + el.className : '')), blend: e.overlay && e.overlay.style.mixBlendMode, layers: e.getActiveLayerNames().length };
})())`));
const filled = (s) => !s.native && s.rect[0] === 0 && s.rect[1] === 0 && s.rect[2] === s.view[0] && Math.abs(s.rect[3] - s.view[1]) <= 1 && s.top && s.exit === 'tappable';
const keepsPlaying = async (s) => {
  await sleep(1500);
  const s2 = await state();
  return !s2.paused && s2.t > s.t;
};

const env = JSON.parse(await ev(`JSON.stringify({ requestFullscreen: typeof Element.prototype.requestFullscreen,
  webkitRequestFullscreen: typeof Element.prototype.webkitRequestFullscreen,
  replaced: HTMLVideoElement.prototype.webkitEnterFullscreen !== window.__origEnter })`));
check('0. iPhone (no element fullscreen) → webkitEnterFullscreen replaced',
  env.requestFullscreen === 'undefined' && env.webkitRequestFullscreen === 'undefined' && env.replaced, env);

// 1. ページの JS が webkitEnterFullscreen を呼ぶ
await ev(`document.querySelector('video').webkitEnterFullscreen(); 'ok'`, true);
await sleep(1500);
let s = await state();
check('1. webkitEnterFullscreen() → full view, not native', filled(s), s);
check('1. keeps playing', await keepsPlaying(s));
shot('fill-js.png');
await clickExit();
await sleep(500);
s = await state();
check('1. × → inline style restored', s.changed.length === 0 && !s.exit && s.rect[3] < s.view[1], s);

// 2. 元のメソッドで本物のフルスクリーン(標準の全画面ボタンの代わり)
await ev(`window.__origEnter.call(document.querySelector('video')); 'ok'`, true);
await sleep(300);
const during = await state();
await sleep(3500);
s = await state();
check('2. native fullscreen → comes back to full view', during.native && filled(s), { during: during.native, after: s });
check('2. keeps playing', await keepsPlaying(s));
shot('fill-native.png');
await clickExit();
await sleep(500);
s = await state();
check('2. × → inline style restored', s.changed.length === 0 && !s.exit, s);

// 3. 画面いっぱいのままエンジンを OFF
await ev(`document.querySelector('video').webkitEnterFullscreen(); 'ok'`, true);
await sleep(1000);
await ev(`window._vjamFxEngine.handleMessage({ action: 'stop' }); 'ok'`);
await sleep(500);
s = await state();
const method = await ev(`HTMLVideoElement.prototype.webkitEnterFullscreen === window.__origEnter`);
check('3. engine OFF → inline style and webkitEnterFullscreen restored', s.changed.length === 0 && !s.exit && method, { ...s, method });
shot('fill-off.png');

// 4. 画面いっぱいの間にページが大きさを書き直す(プレーヤーが向きの変化で width を書くなど)→ 画面いっぱいのまま・× でページの値に戻る
await ev(`window._vjamFxEngine.handleMessage({ action: 'addLayer', preset: ${JSON.stringify(presetArg.split(',')[0])} }); 'ok'`);
await ev(`document.querySelector('video').webkitEnterFullscreen(); 'ok'`, true);
await sleep(500);
await ev(`document.querySelector('video').style.width = '200px'; 'ok'`);
await sleep(500);
s = await state();
check('4. the page rewrites width → stays full view', filled(s), s);
await clickExit();
await sleep(500);
const after = JSON.parse(await ev(`JSON.stringify((() => { const v = document.querySelector('video'); return { style: v.getAttribute('style'), width: Math.round(v.getBoundingClientRect().width) }; })())`));
check('4. × → the page value is kept, the rest restored', after.style === 'width: 200px; margin: 8px auto; border-radius: 12px;' && after.width === 200, after);
await ev(`window._vjamFxEngine.handleMessage({ action: 'stop' }); 'ok'`);

c.close();
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
