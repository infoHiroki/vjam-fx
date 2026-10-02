// デフォルトプールの選び直し画面。1 本ずつライブで動かして 採用 / ボツ を付け、content/default-pool.json の形で書き出す
import { filterList, filterLabel, reactScore, presetChecks, summarizeCombos, cellKey, DEFAULT_THRESHOLDS } from '../curate/logic.js';
import {
  FIXED_PRESETS, FLASH_WARN, VIEWS, presetItems, comboItems, poolSets, verdictOf, isManual, matchesView, counts,
  stepKey, nextAfterJudge, buildPool, metricsFor, parseListing,
} from './logic.js';
import { parseTrace } from './audio.js';
import { createStage } from './stage.js';

const STORE_KEY = 'vjam-fx-review/v1';
const OUT = 'bench/out/';
const VERDICT_LABEL = { yes: '採用', no: 'ボツ' };

const $ = sel => document.querySelector(sel);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter(k => k != null && k !== false));
  return el;
};
const fmt = (v, d = 2) => v == null || Number.isNaN(v) ? '—' : Number(v).toFixed(d);
const idOf = item => item.kind + ':' + item.key;

const state = {
  defs: null, filters: [], blends: [],
  items: { presets: [], combos: [] },
  pool: poolSets(null),
  saved: { presets: {}, filters: {}, blends: {} }, // 手で付けた判定
  results: { fx: null, candidates: null }, combos: null, comboSum: null,
  vjam: { reactivity: {}, adopted: new Set() },
  traces: [],
  view: { tab: 'presets', filter: 'all', cur: { presets: null, combos: null } },
  pv: { theme: 'light', blend: 'screen', filter: 'none', audio: '' },
  auto: false,
};

let stage;

// ---------- 保存 ----------

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!s) return;
    for (const k of ['presets', 'filters', 'blends']) Object.assign(state.saved[k], s.saved && s.saved[k]);
    Object.assign(state.view, s.view, { cur: { ...state.view.cur, ...(s.view && s.view.cur) } });
    Object.assign(state.pv, s.pv);
  } catch (e) { /* 保存なし・壊れていたら初期値 */ }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ saved: state.saved, view: state.view, pv: state.pv }));
  } catch (e) { /* プライベートモードなど */ }
}

// ---------- データ ----------

async function getJSON(path) {
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    return res.ok ? await res.json() : null;
  } catch (e) {
    return null;
  }
}

// http.server のディレクトリ一覧からファイル名を拾う。一覧が出ないサーバーなら null
async function listDir(path, ext) {
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok || !/html/.test(res.headers.get('content-type') || '')) return null;
    return parseListing(await res.text(), ext);
  } catch (e) {
    return null;
  }
}

async function loadTraces() {
  const names = await listDir('traces/', '.json') || [];
  const traces = await Promise.all(names.map(async n => parseTrace(await getJSON(`traces/${encodeURIComponent(n)}.json`), n)));
  return traces.filter(Boolean);
}

async function init() {
  load();
  const [defs, pool, fx, cand, combos, reactivity, review, fxNames, candNames, traces] = await Promise.all([
    getJSON('bench/filters.json'), getJSON('../content/default-pool.json'),
    getJSON(`${OUT}fx/results.json`), getJSON(`${OUT}candidates/results.json`), getJSON(`${OUT}combos/results.json`),
    getJSON('review/vjam-reactivity.json'), getJSON('review/vjam-review.json'),
    listDir('../content/presets/', '.js'), listDir('bench/candidates/', '.js'), loadTraces(),
  ]);
  if (!defs) throw new Error('tools/bench/filters.json が読めない');
  state.defs = defs;
  state.filters = filterList(defs);
  state.blends = defs.blends;
  state.pool = poolSets(pool);
  state.results = { fx, candidates: cand };
  // 一覧が取れないサーバーでは計測結果の名前で代わりにする
  state.items.presets = presetItems(fxNames || Object.keys(fx || {}), candNames || Object.keys(cand || {}));
  state.items.combos = comboItems(state.filters, state.blends);
  if (combos && combos.rows && combos.rows.length) {
    state.combos = combos;
    state.comboSum = summarizeCombos(combos, defs.lightPageBlends);
  }
  state.vjam = { reactivity: (reactivity && reactivity.presets) || {}, adopted: new Set((review && review.adopted) || []) };
  state.traces = traces;
  if (!state.blends.includes(state.pv.blend)) state.pv.blend = 'screen';
  if (!state.filters.includes(state.pv.filter)) state.pv.filter = 'none';
  if (!traces.some(t => t.name === state.pv.audio)) state.pv.audio = '';
  if (!pool) toast('content/default-pool.json が読めない: 全部「未判定」から始める');
  stage = createStage($('#frame'));
  stage.setAudio(currentTrace());
  setupControls();
  render();
  preview();
  setInterval(renderLive, 500);
}

// ---------- 判定・一覧 ----------

const verdict = item => verdictOf(state.saved, state.pool, item);
const tabItems = () => state.items[state.view.tab];
const visible = () => tabItems().filter(item => matchesView(verdict(item), state.view.filter));
const currentTrace = () => state.traces.find(t => t.name === state.pv.audio) || null;

function current() {
  const id = state.view.cur[state.view.tab];
  const list = visible();
  return list.find(item => idOf(item) === id) || list[0] || null;
}

function go(item) {
  if (!item) return;
  state.view.cur[state.view.tab] = idOf(item);
  save();
  render();
  preview();
}

function step(d) {
  if (state.auto) return;
  const list = visible();
  const cur = current();
  const id = stepKey(list.map(idOf), cur && idOf(cur), d);
  go(list.find(item => idOf(item) === id));
}

function judge(v) {
  const item = current();
  if (state.auto || !item) return;
  const before = visible().map(idOf);
  state.saved[item.kind][item.key] = v;
  const after = visible();
  const next = nextAfterJudge(before, idOf(item), after.map(idOf));
  if (next) state.view.cur[state.view.tab] = next;
  save();
  render();
  if (next !== idOf(item)) preview();
}

// ---------- プレビュー ----------

function previewOpts(item) {
  const o = { theme: state.pv.theme, blend: state.pv.blend, filter: state.pv.filter };
  if (item && item.kind === 'filters') o.filter = item.key;
  if (item && item.kind === 'blends') o.blend = item.key;
  return o;
}

function stageMsg(text) {
  $('#stage-msg').hidden = !text;
  $('#stage-msg').textContent = text || '';
}

async function preview() {
  if (state.auto) return startAuto();
  const item = current();
  if (!item) {
    stage.stop();
    stageMsg(`「${VIEWS[state.view.filter]}」に入っているものが無い`);
    return;
  }
  const presets = item.kind === 'presets' ? [item] : FIXED_PRESETS.map(key => ({ key, source: 'fx' }));
  stageMsg('読み込み中…');
  try {
    const ok = await stage.show(presets, previewOpts(item));
    if (ok) stageMsg('');
  } catch (e) {
    stageMsg('プレビューできない: ' + e.message);
  }
  renderControls();
}

function autoPool() {
  const pool = buildPool(state.items.presets, state.filters, state.blends, verdict);
  return { pool, presets: state.items.presets.filter(item => verdict(item) === 'yes') };
}

async function startAuto() {
  const { pool, presets } = autoPool();
  if (!presets.length) {
    state.auto = false;
    render();
    toast('採用のプリセットが 0 本なので Auto は回せない');
    return preview();
  }
  stageMsg(`Auto の準備中… プリセット ${presets.length} 本を読み込んでいる`);
  try {
    const ok = await stage.startAuto(presets, { filters: pool.filters, blends: pool.blends }, previewOpts(null));
    if (ok) stageMsg('');
  } catch (e) {
    stageMsg('Auto を回せない: ' + e.message);
  }
  renderControls();
}

function toggleAuto() {
  state.auto = !state.auto;
  render();
  preview();
}

function previewChanged() {
  save();
  stage.apply(previewOpts(state.auto ? null : current()));
  renderControls();
  renderInfo();
}

function togglePause() {
  stage.setPaused(!stage.paused);
  renderControls();
}

// Auto で見ているときに出たものへ飛ぶ
function jumpTo(tab, kind, key) {
  state.auto = false;
  state.view.tab = tab;
  const item = state.items[tab].find(i => i.kind === kind && i.key === key);
  if (item && !matchesView(verdict(item), state.view.filter)) state.view.filter = 'all';
  if (item) state.view.cur[tab] = idOf(item);
  save();
  render();
  preview();
}

// ---------- 操作部 ----------

function segment(el, value, onPick) {
  for (const b of el.querySelectorAll('button')) {
    b.classList.toggle('on', b.dataset.v === value);
    b.onclick = () => onPick(b.dataset.v);
  }
}

function setupControls() {
  $('#view').append(...Object.entries(VIEWS).map(([v, label]) => h('button', { 'data-v': v }, label, h('b', { 'data-count': v }))));
  $('#blend').append(...state.blends.map(b => h('option', { value: b }, b)));
  $('#filter').append(...state.filters.map(f => h('option', { value: f }, filterLabel(f, state.defs))));
  $('#audio').append(h('option', { value: '' }, '擬似 120 BPM'),
    ...state.traces.map(t => h('option', { value: t.name }, `${t.name}${t.bpm ? `(${Math.round(t.bpm)} BPM)` : ''}`)));
  $('#blend').onchange = e => { state.pv.blend = e.target.value; previewChanged(); };
  $('#filter').onchange = e => { state.pv.filter = e.target.value; previewChanged(); };
  $('#audio').onchange = e => { state.pv.audio = e.target.value; stage.setAudio(currentTrace()); save(); renderControls(); };
  $('#prev').onclick = () => step(-1);
  $('#next').onclick = () => step(1);
  $('#yes').onclick = () => judge('yes');
  $('#no').onclick = () => judge('no');
  $('#theme-btn').onclick = () => { state.pv.theme = state.pv.theme === 'dark' ? 'light' : 'dark'; previewChanged(); };
  $('#pause').onclick = togglePause;
  $('#auto').onclick = toggleAuto;
  $('#export').onclick = exportPool;
  $('#copy').onclick = copyPool;
  $('#reset').onclick = () => {
    if (!confirm('手で付けた判定を全部消して、今の default-pool.json の状態に戻す?')) return;
    state.saved = { presets: {}, filters: {}, blends: {} };
    save(); render(); toast('最初の状態に戻した');
  };
  // ボタン・select を使った後に Space / ←→ がそれに吸われないように(キーは画面全体の操作に使う)
  document.addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.blur(); });
  for (const sel of document.querySelectorAll('select')) sel.addEventListener('change', () => sel.blur());
  document.addEventListener('keyup', e => { if (e.key === ' ' && e.target.tagName === 'BUTTON') e.preventDefault(); });
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (['SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const act = {
      ArrowLeft: () => step(-1), ArrowRight: () => step(1),
      y: () => judge('yes'), 1: () => judge('yes'), n: () => judge('no'), 0: () => judge('no'),
      d: () => $('#theme-btn').click(), ' ': togglePause, a: toggleAuto,
    }[k];
    if (!act) return;
    e.preventDefault();
    act();
  });
}

// ---------- 表示 ----------

function render() {
  const v = state.view;
  segment($('#tabs'), v.tab, t => { v.tab = t; save(); render(); preview(); });
  segment($('#view'), v.filter, f => { v.filter = f; save(); render(); preview(); });
  const all = tabItems();
  const c = counts(all, verdict);
  for (const el of document.querySelectorAll('[data-count]')) {
    const k = el.dataset.count;
    el.textContent = k === 'all' ? c.total : c[k];
  }
  const p = counts(state.items.presets, verdict);
  $('#count-presets').textContent = `${p.yes}/${p.total}`;
  const f = counts(state.items.combos.filter(i => i.kind === 'filters'), verdict);
  const b = counts(state.items.combos.filter(i => i.kind === 'blends'), verdict);
  $('#count-combos').textContent = `${f.yes}・${b.yes}`;

  const list = visible();
  const cur = current();
  const i = cur ? list.indexOf(cur) + 1 : 0;
  $('#progress').replaceChildren(
    h('strong', {}, state.auto ? 'Auto で見ている' : `${i} / ${list.length}`),
    state.auto ? '' : (v.filter === 'all' ? ' 本目' : ` 本目(${VIEWS[v.filter]}だけ)`),
    ` ・ 採用 ${c.yes} ・ 未判定 ${c.undecided} ・ ボツ ${c.no}`,
  );
  $('#auto').classList.toggle('on', state.auto);
  $('#auto').firstChild.textContent = state.auto ? '■ Auto を止める' : '▶ Auto で見る';
  const verdictNow = cur && verdict(cur);
  for (const id of ['prev', 'next', 'yes', 'no']) $('#' + id).disabled = state.auto || !cur;
  $('#yes').classList.toggle('cur', !state.auto && verdictNow === 'yes');
  $('#no').classList.toggle('cur', !state.auto && verdictNow === 'no');
  renderInfo();
  renderControls();
}

function renderControls() {
  const item = state.auto ? null : current();
  const o = previewOpts(item);
  segment($('#theme'), state.pv.theme, t => { state.pv.theme = t; previewChanged(); });
  $('#blend').value = o.blend;
  $('#filter').value = o.filter;
  // Auto 中はエンジンの Rnd が決める(今出ているものは下に出す)。Filter・Blend タブでは見ているものの側は固定
  $('#blend-row').hidden = $('#filter-row').hidden = state.auto;
  $('#blend').disabled = !!(item && item.kind === 'blends');
  $('#filter').disabled = !!(item && item.kind === 'filters');
  $('#audio').value = state.pv.audio;
  const t = currentTrace();
  $('#audio-note').textContent = t ? `${t.source || t.name}・${t.frames.length} フレーム(${fmt(t.frames.length / t.fps, 0)} 秒で頭に戻る)` :
    state.traces.length ? '' : 'tools/traces/*.json が無いので擬似音声だけ';
  $('#pause').firstChild.textContent = stage && stage.paused ? '▶ 再開' : '⏸ 停止';
  $('#paused-badge').hidden = !(stage && stage.paused);
}

function badge(cls, text, title) {
  return h('span', { class: 'badge ' + cls, title }, text);
}

function verdictBadges(item) {
  const v = verdict(item);
  return [
    badge(v || 'undecided', v ? VERDICT_LABEL[v] : '未判定'),
    isManual(state.saved, item) ? badge('', '手で付けた') : (state.pool[item.kind].has(item.key) ? badge('', '今のプール') : null),
  ];
}

function kv(rows) {
  return h('dl', { class: 'kv' }, ...rows.filter(Boolean).flatMap(([k, v, cls]) => [h('dt', {}, k), h('dd', { class: cls || '' }, v)]));
}

const passCls = ok => ok ? 'pass' : 'fail';

function presetInfo(item) {
  const r = metricsFor(item, state.results);
  const react = state.vjam.reactivity[item.key];
  const flashWarn = r && r.flash != null && r.flash > FLASH_WARN;
  const checks = r && !r.error ? presetChecks(r, DEFAULT_THRESHOLDS) : null;
  const metrics = !r ? h('p', { class: 'note' }, state.results.fx ? '計測なし' : '計測結果が無い(python3 tools/bench/bench_fx.py all)') :
    r.error ? h('p', { class: 'fail' }, '計測で落ちた: ' + r.error) :
    kv([
      ['元のページ', h('span', {}, h('span', { class: passCls(checks.recLight) }, `白 ${fmt(r.recLight)}`), ' / ',
        h('span', { class: passCls(checks.recDark) }, `暗 ${fmt(r.recDark)}`))],
      ['fps', fmt(r.fps, 1), passCls(checks.fps)],
      ['ms', fmt(r.msPerFrame, 1), passCls(checks.ms)],
      ['反応', fmt(reactScore(r)), passCls(checks.react)],
      ['点滅', `${flashWarn ? '⚠️ ' : ''}${fmt(r.flash, 1)} 回/秒`, flashWarn ? 'warn' : ''],
      r.errors && r.errors.length ? ['エラー', r.errors.join(' / '), 'fail'] : null,
    ]);
  const beat = react ? react.beat + react.isBeat : 0;
  return [
    h('h2', {}, item.key),
    h('div', { class: 'badges' }, ...verdictBadges(item),
      item.source === 'candidates' ? badge('cand', '候補', 'tools/bench/candidates(まだ content/presets に無い)') : badge('', 'FX'),
      state.vjam.adopted.has(item.key) ? badge('vjam', 'VJam 採用', 'VJam 本体の人のレビュー(seed-review.md)で採用') : null,
      flashWarn ? badge('warn', '⚠️ 点滅', `点滅が ${FLASH_WARN} 回/秒を超える`) : null),
    h('h3', {}, '計測(1280×800・CPU 4 倍スロットル・擬似 120 BPM)'),
    metrics,
    h('h3', {}, 'VJam 本体の音の反応(使っている回数)'),
    react ? kv([
      ['低音・中音・高音', `${react.bass} ・ ${react.mid} ・ ${react.treble}`],
      ['音量', String(react.rms)],
      ['ビート', `${beat}${react.onBeat ? '(onBeat あり)' : ''}`],
    ]) : h('p', { class: 'note' }, 'VJam 本体の表に無い'),
  ];
}

function comboInfo(item) {
  const isFilter = item.kind === 'filters';
  const s = state.comboSum && (isFilter ? state.comboSum.filters[item.key] : state.comboSum.blends[item.key]);
  const o = previewOpts(item);
  const cell = state.comboSum && state.comboSum.cells[cellKey(o.theme, o.blend, o.filter)];
  const th = DEFAULT_THRESHOLDS;
  const light = state.defs.lightPageBlends;
  return [
    h('h2', {}, isFilter ? filterLabel(item.key, state.defs) : item.key),
    h('div', { class: 'badges' }, ...verdictBadges(item), badge('', isFilter ? 'Filter' : 'Blend')),
    h('p', { class: 'note' }, `${FIXED_PRESETS.join(' / ')} を重ねて見ている(製品の Auto と同じ見え方)`),
    !isFilter && !light.includes(item.key) ? h('p', { class: 'note' },
      item.key === 'screen' ? '白ページでは difference で描く' : '白ページの Rnd では使わない(difference / exclusion だけ)') : null,
    h('h3', {}, `計測(代表 ${state.combos ? state.combos.reps.length : 0} 本の平均)`),
    !s ? h('p', { class: 'note' }, 'Filter・Blend の計測結果が無い(python3 tools/bench/bench_fx.py combos)') : kv([
      ['元のページ 白', s.recLight == null ? '使わない' : fmt(s.recLight), s.recLight == null ? '' : passCls(s.recLight >= th.recLight)],
      ['元のページ 暗', fmt(s.recDark), passCls(s.recDark >= th.recDark)],
      ['fps', fmt(s.fps, 1), passCls(s.fps >= th.fps)],
      cell ? [`今の組み合わせ`, `${fmt(cell.rec)}(${o.theme === 'dark' ? '暗' : '白'} / ${o.blend} / ${filterLabel(o.filter, state.defs)})`] : null,
    ]),
    s ? h('p', { class: 'note' }, isFilter ? '白 = difference / exclusion、暗 = blend 全部の平均' : 'フィルタなしの行') : null,
  ];
}

function renderInfo() {
  if (state.auto) {
    const { pool, presets } = autoPool();
    $('#info').replaceChildren(
      h('h2', {}, 'Auto で見る'),
      h('p', { class: 'note' }, '採用中のプールで、製品の Auto ON(Blend Rnd・Filter Rnd も ON)と同じに回している。出ているものを押すとそこへ飛ぶ'),
      kv([['プリセット', `${presets.length} 本`], ['Filter', `${pool.filters.length} 種`], ['Blend', `${pool.blends.length} 種`]]),
    );
    return;
  }
  const item = current();
  if (!item) {
    $('#info').replaceChildren(h('p', { class: 'note' }, `「${VIEWS[state.view.filter]}」に入っているものが無い`));
    return;
  }
  $('#info').replaceChildren(...(item.kind === 'presets' ? presetInfo(item) : comboInfo(item)).filter(Boolean));
}

// 動いているものの様子(Auto のレイヤー・blend・filter、読み込めなかったもの)。変わったときだけ描き直す(押している途中のボタンを消さない)
let liveSig = '';
function renderLive() {
  const s = stage && stage.status();
  const box = $('#live');
  const sig = JSON.stringify([s, state.auto, state.view, $('#stage-msg').textContent]);
  if (sig === liveSig) return;
  liveSig = sig;
  if (!s) { box.replaceChildren(); return; }
  const kids = [];
  if (state.auto) {
    const link = (tab, kind, key, label) => h('button', { class: 'linkish', onclick: () => jumpTo(tab, kind, key) }, label || key);
    kids.push(h('h3', {}, '今出ているもの'), kv([
      ['レイヤー', s.layers.length ? h('span', {}, ...s.layers.flatMap((n, i) => [i ? ' / ' : '', link('presets', 'presets', n)])) : '(休み)'],
      ['Blend', h('span', {}, link('combos', 'blends', s.blend), s.drawnBlend !== s.blend ? `(${s.drawnBlend} で描く)` : '')],
      ['Filter', link('combos', 'filters', s.filter, filterLabel(s.filter, state.defs))],
    ]));
  } else {
    const item = current();
    const want = item && item.kind === 'presets' ? [item.key] : FIXED_PRESETS;
    const missing = want.filter(n => !s.layers.includes(n));
    if (item && missing.length && !$('#stage-msg').textContent) kids.push(h('p', { class: 'fail' }, `動いていない: ${missing.join(', ')}`));
  }
  if (s.errors.length) kids.push(h('h3', {}, 'ページのエラー'), h('p', { class: 'fail' }, s.errors.slice(-3).join(' / ')));
  box.replaceChildren(...kids);
}

// ---------- 書き出し ----------

function poolJSON() {
  const pool = buildPool(state.items.presets, state.filters, state.blends, verdict);
  return { pool, text: JSON.stringify(pool, null, 2) + '\n' };
}

function summary(pool) {
  const cand = pool.presets.filter(n => state.items.presets.some(i => i.key === n && i.source === 'candidates')).length;
  const empty = ['presets', 'filters', 'blends'].filter(k => !pool[k].length);
  return `プリセット ${pool.presets.length}(うち候補 ${cand})/ filter ${pool.filters.length} / blend ${pool.blends.length}` +
    (empty.length ? ` ⚠ 空: ${empty.join(', ')}` : '');
}

function exportPool() {
  const { pool, text } = poolJSON();
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: 'default-pool.json' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('書き出した: ' + summary(pool));
}

async function copyPool() {
  const { pool, text } = poolJSON();
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch (e) {
    // http://<Mac の IP> で開いた iPad など(安全なページでないと clipboard が使えない)
    const ta = h('textarea', { style: 'position:fixed;left:-9999px;top:0', readonly: true });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    ta.remove();
  }
  toast(ok ? 'コピーした: ' + summary(pool) : 'コピーできない。書き出しを使う');
}

let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

init().catch(e => {
  stageMsg('読み込めない: ' + e.message + '(リポのルートで python3 -m http.server を立てて /tools/review.html を開く)');
});
