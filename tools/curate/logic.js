// 選択画面の判定・集計・書き出し(DOM を触らない部分)

// 必須条件の初期値(bench_fx.py の DEFAULT_THRESHOLDS と同じ)。flash はこれを超えると点滅系として初期値 OFF
export const DEFAULT_THRESHOLDS = { recLight: 0.6, recDark: 0.6, fps: 40, ms: 8, react: 0.35, flash: 0.5 };

// 'none' + 単体 8 種 + 複合(単体と同じ文字列は除く)。bench_fx.py の FILTERS と同じ順
export function filterList(defs) {
  const list = ['none', ...Object.values(defs.single)];
  for (const css of defs.compound) if (!list.includes(css)) list.push(css);
  return list;
}

export function filterLabel(css, defs) {
  if (css === 'none') return 'なし';
  const name = Object.keys(defs.single).find(k => defs.single[k] === css);
  return name ? `${name} — ${css}` : css;
}

// 音への反応: 無音→音楽での明るさ・動きの増え方(減ったら 0)+ ビート位相への同期(bench_fx.py の react と同じ)
export function reactScore(r) {
  return Math.max(r.energyGain || 0, 0) + Math.max(r.motionGain || 0, 0) + (r.beatLum || 0) + (r.beatMotion || 0);
}

export function recMin(r) {
  return Math.min(r.recLight, r.recDark);
}

export function hasError(r) {
  return !!(r.error || (r.errors && r.errors.length));
}

// プリセットが必須条件(しきい値)を満たすか。点滅系(flash が大きい)は数字が良くても提案しない(光過敏の安全のため)
export function presetChecks(r, th) {
  if (r.error) return { recLight: false, recDark: false, fps: false, ms: false, react: false, flash: false, ok: false };
  const c = {
    recLight: r.recLight >= th.recLight,
    recDark: r.recDark >= th.recDark,
    fps: r.fps >= th.fps,
    ms: r.msPerFrame <= th.ms,
    react: reactScore(r) >= th.react,
    flash: r.flash == null || r.flash <= th.flash,
  };
  c.ok = c.recLight && c.recDark && c.fps && c.ms && c.react && c.flash && !hasError(r);
  return c;
}

const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/**
 * Filter × Blend の計測を集計する。rep を渡すとその 1 本だけ、省くと代表全部の平均
 * - filter の白: 白ページで使う blend(lightPageBlends)だけ / 暗: blend 全部
 * - blend: フィルタなし('none')の行。白ページで使わない blend の白は null
 */
export function summarizeCombos(data, lightPageBlends, rep = null) {
  const rows = rep ? data.rows.filter(r => r.preset === rep) : data.rows;
  const pick = (pred) => rows.filter(pred);
  const agg = (rs) => rs.length ? { rec: mean(rs.map(r => r.rec)), fps: mean(rs.map(r => r.fps)), rows: rs } : null;

  const cells = {};
  for (const page of ['light', 'dark']) for (const b of data.blends) for (const f of data.filters) {
    cells[cellKey(page, b, f)] = agg(pick(r => r.page === page && r.blend === b && r.filter === f));
  }
  const filters = {};
  for (const f of data.filters) {
    const light = pick(r => r.filter === f && r.page === 'light' && lightPageBlends.includes(r.blend));
    const dark = pick(r => r.filter === f && r.page === 'dark');
    filters[f] = { recLight: mean(light.map(r => r.rec)), recDark: mean(dark.map(r => r.rec)),
      fps: mean(light.concat(dark).map(r => r.fps)) };
  }
  const blends = {};
  for (const b of data.blends) {
    const light = lightPageBlends.includes(b) ? pick(r => r.blend === b && r.filter === 'none' && r.page === 'light') : [];
    const dark = pick(r => r.blend === b && r.filter === 'none' && r.page === 'dark');
    blends[b] = { recLight: lightPageBlends.includes(b) ? mean(light.map(r => r.rec)) : null,
      recDark: mean(dark.map(r => r.rec)), fps: mean(light.concat(dark).map(r => r.fps)) };
  }
  return { cells, filters, blends };
}

export function cellKey(page, blend, filter) {
  return `${page}|${blend}|${filter}`;
}

// filter / blend の集計が必須条件を満たすか(白で使わない blend は白を見ない)
export function comboChecks(s, th) {
  if (!s || s.recDark == null) return { recLight: false, recDark: false, fps: false, ok: false };
  const c = {
    recLight: s.recLight == null || s.recLight >= th.recLight,
    recDark: s.recDark >= th.recDark,
    fps: s.fps >= th.fps,
  };
  c.ok = c.recLight && c.recDark && c.fps;
  return c;
}

// 手で切り替えたもの(overrides)を優先し、残りは提案
export function isSelected(overrides, key, suggested) {
  return Object.prototype.hasOwnProperty.call(overrides, key) ? !!overrides[key] : !!suggested;
}

// content/default-pool.json の形(#1)
export function buildPool({ presets, filters, blends }) {
  return {
    version: 1,
    presets: [...presets].sort(),
    filters: [...filters],
    blends: [...blends],
  };
}

export const SORT_KEYS = {
  name: { label: '名前', get: r => r.name, asc: true },
  recMin: { label: 'rec(白暗の低い方)', get: r => r.r.error ? null : recMin(r.r) },
  recLight: { label: 'rec 白', get: r => r.r.recLight },
  recDark: { label: 'rec 暗', get: r => r.r.recDark },
  fps: { label: 'fps', get: r => r.r.fps },
  msPerFrame: { label: 'ms/frame', get: r => r.r.msPerFrame, asc: true },
  react: { label: '反応', get: r => r.r.error ? null : reactScore(r.r) },
  cov: { label: '塗り面積', get: r => r.r.cov },
  flash: { label: '点滅', get: r => r.r.flash },
};

// 並び替え。値の無いもの(エラー)は向きに関係なく最後
export function sortRows(rows, key, desc) {
  const get = SORT_KEYS[key].get;
  return [...rows].sort((a, b) => {
    const va = get(a), vb = get(b);
    const na = va == null, nb = vb == null;
    if (na || nb) return na === nb ? a.name.localeCompare(b.name) : (na ? 1 : -1);
    const d = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
    return (desc ? -d : d) || a.name.localeCompare(b.name);
  });
}

// 一覧の絞り込み
export function matchesView(row, view, checks, selected) {
  if (view.source !== 'all' && row.source !== view.source) return false;
  if (view.onlyPass && !checks.ok) return false;
  if (view.onlySelected && !selected) return false;
  if (view.query && !row.name.includes(view.query.trim().toLowerCase())) return false;
  return true;
}
