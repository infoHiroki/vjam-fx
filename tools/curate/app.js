// デフォルトプールを選ぶ画面。計測結果(tools/bench/out/)を読み、選んだものを content/default-pool.json の形で書き出す
import {
  DEFAULT_THRESHOLDS, filterList, filterLabel, reactScore, hasError, presetChecks, summarizeCombos, cellKey,
  comboChecks, isSelected, buildPool, SORT_KEYS, sortRows, matchesView,
} from './logic.js';
import { startPreview, applyPreview, stopPreview } from './preview.js';

const STORE_KEY = 'vjam-fx-curate/v1';
const OUT = 'bench/out/';
const SOURCES = ['fx', 'candidates'];
const BLEND_SHORT = { screen: 'scr', lighten: 'light', difference: 'diff', exclusion: 'excl', 'color-dodge': 'dodge' };

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

const state = {
  defs: null, filters: [], blends: [], lightBlends: [],
  presets: [], combos: null,
  th: { ...DEFAULT_THRESHOLDS },
  overrides: { presets: {}, filters: {}, blends: {} },
  view: { tab: 'presets', sort: 'recMin', desc: true, source: 'all', onlyPass: false, onlySelected: false, query: '', rep: '' },
  pv: { theme: 'light', blend: 'screen', filter: 'none', music: true },
  visible: [], current: null,
};

// ---------- 保存 ----------

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!s) return;
    Object.assign(state.th, s.th);
    for (const k of ['presets', 'filters', 'blends']) Object.assign(state.overrides[k], s.overrides && s.overrides[k]);
    Object.assign(state.view, s.view);
    Object.assign(state.pv, s.pv);
  } catch (e) { /* 保存なし・壊れていたら初期値 */ }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ th: state.th, overrides: state.overrides, view: state.view, pv: state.pv }));
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

async function init() {
  load();
  const [defs, ...sets] = await Promise.all([getJSON('bench/filters.json'), ...SOURCES.map(s => getJSON(`${OUT}${s}/results.json`))]);
  state.defs = defs;
  state.filters = filterList(defs);
  state.blends = defs.blends;
  state.lightBlends = defs.lightPageBlends;
  SOURCES.forEach((source, i) => {
    for (const [name, r] of Object.entries(sets[i] || {})) {
      state.presets.push({ name, source, r, img: { light: `${OUT}${source}/${name}_light.jpg`, dark: `${OUT}${source}/${name}_dark.jpg` } });
    }
  });
  state.combos = await getJSON(`${OUT}combos/results.json`);
  if (state.combos && !state.combos.reps.includes(state.view.rep)) state.view.rep = '';
  setupControls();
  buildCards();
  render();
}

// ---------- 選択 ----------

function comboSummary() {
  return state.combos && state.combos.rows.length ? summarizeCombos(state.combos, state.lightBlends) : null;
}

function presetSelected(row) {
  return isSelected(state.overrides.presets, row.name, presetChecks(row.r, state.th).ok);
}

function selection() {
  const sum = comboSummary();
  return {
    presets: state.presets.filter(presetSelected).map(r => r.name),
    filters: state.filters.filter(f => isSelected(state.overrides.filters, f, sum && comboChecks(sum.filters[f], state.th).ok)),
    blends: state.blends.filter(b => isSelected(state.overrides.blends, b, sum && comboChecks(sum.blends[b], state.th).ok)),
  };
}

function setOverride(kind, key, value) {
  state.overrides[kind][key] = value;
  save();
  render();
}

// ---------- 操作部 ----------

function segment(el, value, onPick) {
  for (const b of el.querySelectorAll('button')) {
    b.classList.toggle('on', b.dataset.v === value);
    b.onclick = () => onPick(b.dataset.v);
  }
}

function setupControls() {
  for (const b of document.querySelectorAll('.tabs button')) b.onclick = () => { state.view.tab = b.dataset.tab; save(); render(); };
  for (const input of document.querySelectorAll('[data-th]')) {
    input.oninput = () => {
      const v = parseFloat(input.value);
      if (!Number.isFinite(v)) return;
      state.th[input.dataset.th] = v;
      save(); render();
    };
  }
  $('#reset-th').onclick = () => { state.th = { ...DEFAULT_THRESHOLDS }; save(); render(); };
  $('#reset-sel').onclick = () => {
    state.overrides = { presets: {}, filters: {}, blends: {} };
    save(); render(); toast('選択を提案に戻した');
  };
  $('#sort').append(...Object.entries(SORT_KEYS).map(([k, s]) => h('option', { value: k }, s.label)));
  $('#sort').onchange = e => {
    state.view.sort = e.target.value;
    state.view.desc = !SORT_KEYS[state.view.sort].asc;
    save(); render();
  };
  $('#sort-dir').onclick = () => { state.view.desc = !state.view.desc; save(); render(); };
  $('#only-pass').onchange = e => { state.view.onlyPass = e.target.checked; save(); render(); };
  $('#only-selected').onchange = e => { state.view.onlySelected = e.target.checked; save(); render(); };
  $('#query').oninput = e => { state.view.query = e.target.value; render(); };
  $('#export').onclick = exportPool;

  $('#pv-blend').append(...state.blends.map(b => h('option', { value: b }, b)));
  $('#pv-filter').append(...state.filters.map(f => h('option', { value: f }, filterLabel(f, state.defs))));
  $('#pv-blend').onchange = e => { state.pv.blend = e.target.value; previewChanged(); };
  $('#pv-filter').onchange = e => { state.pv.filter = e.target.value; previewChanged(); };
  $('#pv-close').onclick = () => $('#preview').close();
  $('#preview').addEventListener('close', () => { stopPreview($('#pv-frame')); state.current = null; });
  $('#pv-prev').onclick = () => stepPreview(-1);
  $('#pv-next').onclick = () => stepPreview(1);
  $('#pv-default').onchange = e => { if (state.current) setOverride('presets', state.current.name, e.target.checked); };
  $('#cell-close').onclick = () => $('#cell').close();
  document.addEventListener('keydown', e => {
    if (!$('#preview').open || e.target.tagName === 'SELECT') return;
    if (e.key === 'ArrowLeft') stepPreview(-1);
    if (e.key === 'ArrowRight') stepPreview(1);
  });
}

// ---------- プリセット ----------

const cards = new Map();

function metric(key, label, value, digits) {
  return h('span', { class: 'm', 'data-k': key }, `${label} ${fmt(value, digits)}`);
}

function buildCards() {
  for (const row of state.presets) {
    const r = row.r;
    const thumb = (src, alt) => r.error && !r.recLight ? h('div', { class: 'noimg' }, 'エラー') : h('img', { src, alt, loading: 'lazy' });
    const box = h('input', { type: 'checkbox', onclick: e => e.stopPropagation(), onchange: e => setOverride('presets', row.name, e.target.checked) });
    const manual = h('span', { class: 'manual', title: '手で切り替えた' }, '手動');
    const tip = r.error ? `error: ${r.error}` : [
      `rec 白 ${r.recLight} / 暗 ${r.recDark}`, `fps ${r.fps} / ${r.msPerFrame} ms/frame`, `塗り ${r.cov} (90% ${r.cov90})`,
      `energyGain ${r.energyGain} / motionGain ${r.motionGain}`, `beatLum ${r.beatLum} / beatMotion ${r.beatMotion}`,
      `点滅 ${r.flash ?? '—'} 回/秒`,
    ].join('\n') + (r.errors && r.errors.length ? `\nerrors: ${r.errors.join(' / ')}` : '');
    const el = h('article', { class: 'card', title: tip, onclick: () => openPreview(row) },
      h('div', { class: 'thumbs' }, thumb(row.img.light, '白ページ'), thumb(row.img.dark, '暗いページ')),
      h('div', { class: 'meta' },
        h('div', { class: 'name' }, row.name,
          row.source === 'candidates' && h('span', { class: 'badge cand' }, '候補'),
          hasError(r) && h('span', { class: 'badge err' }, 'エラー'),
          h('span', { class: 'badge flash', hidden: true, title: '点滅系(光過敏の安全のため初期値 OFF)' }, '点滅')),
        r.error ? h('div', { class: 'nums' }, h('span', { class: 'm fail' }, String(r.error).slice(0, 80))) : h('div', { class: 'nums' },
          metric('recLight', '白', r.recLight), metric('recDark', '暗', r.recDark),
          metric('fps', 'fps', r.fps, 0), metric('ms', 'ms', r.msPerFrame, 1), metric('react', '反応', reactScore(r)))),
      h('label', { class: 'pick', onclick: e => e.stopPropagation() }, box, 'デフォルト', manual));
    cards.set(row.name + '@' + row.source, { el, box, manual, flash: el.querySelector('.badge.flash'), row });
  }
}

function renderPresets() {
  const v = state.view;
  const rows = sortRows(state.presets, v.sort, v.desc);
  state.visible = [];
  for (const row of rows) {
    const c = cards.get(row.name + '@' + row.source);
    const checks = presetChecks(row.r, state.th);
    const sel = presetSelected(row);
    c.el.classList.toggle('sel', sel);
    c.box.checked = sel;
    c.manual.hidden = !Object.prototype.hasOwnProperty.call(state.overrides.presets, row.name);
    c.flash.hidden = !!row.r.error || checks.flash;
    for (const m of c.el.querySelectorAll('.m[data-k]')) {
      m.classList.toggle('pass', checks[m.dataset.k]);
      m.classList.toggle('fail', !checks[m.dataset.k]);
    }
    if (matchesView(row, v, checks, sel)) state.visible.push(row);
  }
  $('#grid').replaceChildren(...state.visible.map(row => cards.get(row.name + '@' + row.source).el));
  $('#shown').textContent = `${state.visible.length} / ${state.presets.length} 本`;
  $('#sort').value = v.sort;
  $('#sort-dir').textContent = v.desc ? '大きい順' : '小さい順';
  segment($('#source'), v.source, s => { v.source = s; save(); render(); });
  $('#only-pass').checked = v.onlyPass;
  $('#only-selected').checked = v.onlySelected;
  if ($('#query').value !== v.query) $('#query').value = v.query;
}

// ---------- Filter / Blend ----------

function recColor(rec) {
  return `hsl(${Math.round(Math.max(0, Math.min(1, rec)) * 120)} 45% 30%)`;
}

function numCell(value, pass, digits = 2) {
  return h('td', { class: 'num ' + (value == null ? '' : pass ? 'pass' : 'fail') }, fmt(value, digits));
}

function pickCell(kind, key, suggested) {
  const sel = isSelected(state.overrides[kind], key, suggested);
  const manual = Object.prototype.hasOwnProperty.call(state.overrides[kind], key);
  return h('td', {},
    h('input', { type: 'checkbox', checked: sel, 'aria-label': 'デフォルトに入れる', onchange: e => setOverride(kind, key, e.target.checked) }),
    manual && h('span', { class: 'manual', title: '手で切り替えた' }, ' 手動'));
}

function renderCombos() {
  const data = state.combos;
  const v = state.view;
  if (!data || !data.rows.length) {
    $('#rep').replaceChildren();
    $('#blend-table').replaceChildren(h('tr', {}, h('td', {}, 'Filter / Blend の計測結果がない(bench_fx.py combos を回す)')));
    $('#filter-table').replaceChildren();
    return;
  }
  $('#rep').replaceChildren(...['', ...data.reps].map(r => h('button', { 'data-v': r }, r || '平均')));
  segment($('#rep'), v.rep, r => { v.rep = r; save(); render(); });
  const all = summarizeCombos(data, state.lightBlends);
  const shown = v.rep ? summarizeCombos(data, state.lightBlends, v.rep) : all;

  // Blend
  $('#blend-table').replaceChildren(
    h('tr', {}, h('th', {}, 'デフォルト'), h('th', {}, 'Blend'), h('th', {}, 'rec 白'), h('th', {}, 'rec 暗'), h('th', {}, 'fps'), h('th', {}, '')),
    ...data.blends.map(b => {
      const s = shown.blends[b], c = comboChecks(s, state.th);
      const sel = isSelected(state.overrides.blends, b, comboChecks(all.blends[b], state.th).ok);
      return h('tr', { class: sel ? 'sel' : '' },
        pickCell('blends', b, comboChecks(all.blends[b], state.th).ok),
        h('td', { class: 'label' }, b),
        numCell(s.recLight, c.recLight), numCell(s.recDark, c.recDark), numCell(s.fps, c.fps, 0),
        h('td', { class: 'label note' }, state.lightBlends.includes(b) ? '白でも使う' : (b === 'screen' ? '白では difference で描く' : '白では使わない')));
    }));

  // Filter
  const pages = [['light', '白ページ'], ['dark', '暗いページ']];
  $('#filter-table').replaceChildren(
    h('tr', {}, h('th', { rowspan: 2 }, 'デフォルト'), h('th', { rowspan: 2 }, 'Filter'), h('th', { colspan: 3 }, '集計'),
      ...pages.map(([, label]) => h('th', { colspan: data.blends.length, class: 'grp' }, label))),
    h('tr', {}, h('th', {}, '白'), h('th', {}, '暗'), h('th', {}, 'fps'),
      ...pages.flatMap(() => data.blends.map((b, i) => h('th', { class: i === 0 ? 'grp' : '', title: b }, BLEND_SHORT[b] || b)))),
    ...data.filters.map(f => {
      const s = shown.filters[f], c = comboChecks(s, state.th);
      const suggested = comboChecks(all.filters[f], state.th).ok;
      const sel = isSelected(state.overrides.filters, f, suggested);
      return h('tr', { class: sel ? 'sel' : '' },
        pickCell('filters', f, suggested),
        h('td', { class: 'label' }, filterLabel(f, state.defs)),
        numCell(s.recLight, c.recLight), numCell(s.recDark, c.recDark), numCell(s.fps, c.fps, 0),
        ...pages.flatMap(([page]) => data.blends.map((b, i) => {
          const cell = shown.cells[cellKey(page, b, f)];
          const unused = page === 'light' && !state.lightBlends.includes(b);
          const pass = cell && cell.rec >= (page === 'light' ? state.th.recLight : state.th.recDark);
          return h('td', { class: 'cell' + (i === 0 ? ' grp' : '') + (unused ? ' unused' : '') },
            cell ? h('button', {
              style: `background:${recColor(cell.rec)}`,
              title: `${page} / ${b} / ${f}\nrec ${fmt(cell.rec)}${pass ? '' : '(しきい値未満)'} / fps ${fmt(cell.fps, 0)}${unused ? '\n白ページでは使わない' : ''}`,
              onclick: () => openCell(page, b, f, cell),
            }, fmt(cell.rec)) : '—');
        })));
    }));
}

function openCell(page, blend, filter, cell) {
  $('#cell-title').textContent = `${page === 'light' ? '白ページ' : '暗いページ'} / ${blend} / ${filterLabel(filter, state.defs)}`;
  $('#cell-shots').replaceChildren(...cell.rows.map(r => {
    const row = state.presets.find(p => p.name === r.preset);
    return h('figure', {},
      h('img', { src: OUT + 'combos/' + r.img, alt: r.preset, loading: 'lazy' }),
      h('figcaption', {}, h('span', {}, `${r.preset} — rec ${fmt(r.rec)} / fps ${fmt(r.fps, 0)}`),
        row && h('button', { onclick: () => { $('#cell').close(); Object.assign(state.pv, { theme: page, blend, filter }); openPreview(row); } }, 'ライブで見る')));
  }));
  $('#cell').showModal();
}

// ---------- ライブプレビュー ----------

function openPreview(row) {
  state.current = row;
  if (!$('#preview').open) $('#preview').showModal();
  renderPreviewHead();
  $('#pv-metrics').textContent = '読み込み中…';
  startPreview($('#pv-frame'), row, previewOpts())
    .then(ok => { if (ok) renderPreviewHead(); })
    .catch(e => { $('#pv-metrics').textContent = 'プレビューできない: ' + e.message; });
}

function previewOpts() {
  return { ...state.pv };
}

function previewChanged() {
  save();
  applyPreview($('#pv-frame'), previewOpts());
  renderPreviewHead();
}

function stepPreview(d) {
  if (!state.current || !state.visible.length) return;
  const i = state.visible.indexOf(state.current);
  openPreview(state.visible[(i + d + state.visible.length) % state.visible.length]);
}

function renderPreviewHead() {
  const row = state.current;
  if (!row) return;
  const r = row.r;
  $('#pv-name').textContent = row.name + (row.source === 'candidates' ? '(候補)' : '');
  $('#pv-default').checked = presetSelected(row);
  segment($('#pv-theme'), state.pv.theme, t => { state.pv.theme = t; previewChanged(); });
  segment($('#pv-sound'), state.pv.music ? 'music' : 'silent', m => { state.pv.music = m === 'music'; previewChanged(); });
  $('#pv-blend').value = state.pv.blend;
  $('#pv-filter').value = state.pv.filter;
  $('#pv-metrics').textContent = r.error ? `error: ${r.error}` :
    `rec 白 ${r.recLight} / 暗 ${r.recDark} ・ fps ${r.fps}(${r.msPerFrame} ms/frame)・ 反応 ${fmt(reactScore(r))}` +
    `(energy ${r.energyGain} / motion ${r.motionGain} / beatLum ${r.beatLum} / beatMotion ${r.beatMotion})・ 塗り ${r.cov}` +
    ` ・ 点滅 ${r.flash ?? '—'} 回/秒` +
    (r.errors && r.errors.length ? ` ・ errors: ${r.errors.join(' / ')}` : '');
}

// ---------- 全体 ----------

function render() {
  const v = state.view;
  for (const input of document.querySelectorAll('[data-th]')) {
    if (document.activeElement !== input) input.value = state.th[input.dataset.th];
  }
  for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === v.tab);
  const empty = !state.presets.length;
  $('#empty').hidden = !empty;
  if (empty) $('#empty').innerHTML = '計測結果がない。<code>python3 tools/bench/bench_fx.py all</code> を回してから開き直す(tools/README.md)';
  $('#tab-presets').hidden = empty || v.tab !== 'presets';
  $('#tab-combos').hidden = empty || v.tab !== 'combos';
  renderPresets();
  renderCombos();
  const sel = selection();
  $('#count-presets').textContent = `${sel.presets.length}/${state.presets.length}`;
  $('#count-combos').textContent = `${sel.filters.length}・${sel.blends.length}`;
  if (state.current) $('#pv-default').checked = presetSelected(state.current);
}

function exportPool() {
  const sel = selection();
  const pool = buildPool(sel);
  const blob = new Blob([JSON.stringify(pool, null, 2) + '\n'], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: 'default-pool.json' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  const cand = sel.presets.filter(n => state.presets.some(p => p.name === n && p.source === 'candidates')).length;
  const empty = ['presets', 'filters', 'blends'].filter(k => !pool[k].length);
  toast(`書き出した: プリセット ${pool.presets.length}(うち候補 ${cand})/ filter ${pool.filters.length} / blend ${pool.blends.length}` +
    (empty.length ? ` ⚠ 空: ${empty.join(', ')}` : ''));
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
  $('#empty').hidden = false;
  $('#empty').textContent = '読み込めない: ' + e.message + '(リポのルートで http.server を立てて /tools/curate.html を開く)';
});
