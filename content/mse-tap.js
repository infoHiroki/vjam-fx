/**
 * VJam FX — MSE audio tap (Safari)
 * document_start / MAIN world で読み込む。MediaSource の音声 SourceBuffer に append されるデータの
 * コピーを取り(元のデータは変えずにそのまま渡す)、デコードして 20ms ごとの音量を再生時刻で持つ。
 * 先読みした音から BPM とビートのグリッドを出し、window.__vjamMse.frameAt(time) で返す。
 * エンジンの内部には触らない(エンジンが frameAt を呼ぶ)。
 * Uses IIFE pattern (no ESM) for CSP compatibility
 */
(function() {
  'use strict';

  if (window.__vjamMse) return;

  var HOP = 0.02;                // 20ms bins
  var WIN = 300;                 // テンポ推定の窓 ±6 秒(bin 数)
  var MIN_CONF = 0.08;           // これ未満のグリッドは使わずオンセットのしきい値で判定
  var SEEK = 0.5;                // 前回から 0.5 秒以上跳んだ(または戻った)らシーク扱い
  var BAND_DECAY = 0.89;         // 低/中/高の正規化用の最大値の減衰(1 秒あたり)
  var ON_DECAY = 0.94;           // オンセットの最大値の減衰(1 秒あたり)
  var MAX_PENDING = 8e6;         // 組み直し待ちのバイト数の上限
  var MAX_BINS = 90000;          // 30 分。超えたら再生位置から遠い bin を捨てる
  var EMPTY = new Uint8Array(0);

  // ---- bytes ----

  function u8(data) {
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  function concat() {
    var len = 0, i;
    for (i = 0; i < arguments.length; i++) len += arguments[i].length;
    var out = new Uint8Array(len), off = 0;
    for (i = 0; i < arguments.length; i++) { out.set(arguments[i], off); off += arguments[i].length; }
    return out;
  }

  function startsWith(b, sig, off) {
    off = off || 0;
    if (off + sig.length > b.length) return false;
    for (var i = 0; i < sig.length; i++) if (b[off + i] !== sig[i]) return false;
    return true;
  }

  function findSig(b, sig, from) {
    for (var i = from || 0; i + sig.length <= b.length; i++) if (startsWith(b, sig, i)) return i;
    return -1;
  }

  function readUint(b, off, len) {
    var v = 0;
    for (var i = 0; i < len; i++) v = v * 256 + b[off + i];
    return v;
  }

  // ---- WebM:append はクラスタ境界で切れていないので、つなぎ直して Cluster 単位で取り出す ----

  var EBML = [0x1A, 0x45, 0xDF, 0xA3];
  var CLUSTER = [0x1F, 0x43, 0xB6, 0x75];
  var TIMECODE_SCALE = [0x2A, 0xD7, 0xB1];

  // EBML vint → { len, value, unknown }(足りない・不正なら null)
  function vint(b, off) {
    if (off >= b.length) return null;
    var first = b[off], len = 1, mask = 0x80;
    while (len <= 8 && !(first & mask)) { len++; mask >>= 1; }
    if (len > 8 || off + len > b.length) return null;
    var value = first & (mask - 1), allOnes = value === mask - 1;
    for (var i = 1; i < len; i++) {
      value = value * 256 + b[off + i];
      if (b[off + i] !== 0xFF) allOnes = false;
    }
    return { len: len, value: value, unknown: allOnes };
  }

  // Cluster 先頭の Timecode(0xE7)。読めなければ NaN
  function clusterTimecode(c) {
    var sz = vint(c, 4);
    if (!sz) return NaN;
    var p = 4 + sz.len, end = Math.min(c.length, p + 64);
    while (p < end) {
      var idLen = c[p] >= 0x80 ? 1 : c[p] >= 0x40 ? 2 : c[p] >= 0x20 ? 3 : 4;
      var s = vint(c, p + idLen);
      if (!s) return NaN;
      if (idLen === 1 && c[p] === 0xE7) {
        if (p + idLen + s.len + s.value > c.length) return NaN;
        return readUint(c, p + idLen + s.len, s.value);
      }
      p += idLen + s.len + s.value;
    }
    return NaN;
  }

  // init の TimecodeScale(ns)。無ければ既定の 1ms
  function timecodeScale(init) {
    var p = findSig(init, TIMECODE_SCALE, 0);
    if (p < 0) return 1000000;
    var s = vint(init, p + 3);
    if (!s || p + 3 + s.len + s.value > init.length) return 1000000;
    return readUint(init, p + 3 + s.len, s.value) || 1000000;
  }

  // push(bytes) → [{ data: init + cluster, time: 秒(timestampOffset 抜き) }]
  function createWebmSplitter() {
    var init = null, scale = 1000000, pend = EMPTY, head = null;
    var self = { resyncs: 0 };

    function unknownSized(b) {
      var sz = vint(b, 4);
      return !!(sz && sz.unknown);
    }

    function emit(out, cluster) {
      var tc = clusterTimecode(cluster);
      out.push({ data: concat(init, cluster), time: tc * scale / 1e9 });
    }

    self.push = function(b) {
      var out = [];
      if (startsWith(b, EBML)) {
        // 新しい init(動画の頭・画質の切り替え)。init 自体が分かれて来てもよいように Cluster が出るまで溜める
        head = b; pend = EMPTY;
      } else if (head) {
        head = concat(head, b);
      } else if (pend.length && startsWith(b, CLUSTER)) {
        if (init && startsWith(pend, CLUSTER) && unknownSized(pend)) {
          emit(out, pend); // サイズ不明のクラスタは次のクラスタの頭で終わる
        } else {
          self.resyncs++;  // 途中のクラスタが終わらないうちに新しいクラスタ = 流し直し
        }
        pend = b;
      } else {
        pend = pend.length ? concat(pend, b) : b;
        if (!init && startsWith(pend, EBML)) { head = pend; pend = EMPTY; } // init が細切れで来た
      }

      if (head) {
        var ci = findSig(head, CLUSTER, 0);
        if (ci < 0) {
          if (head.length > MAX_PENDING) head = null;
          return out;
        }
        init = head.slice(0, ci);
        scale = timecodeScale(init);
        pend = head.slice(ci);
        head = null;
      }

      while (init && pend.length >= 12) {
        var idx = startsWith(pend, CLUSTER) ? 0 : findSig(pend, CLUSTER, 0);
        if (idx < 0) {
          if (pend.length > MAX_PENDING) pend = EMPTY;
          break;
        }
        if (idx > 0) { pend = pend.slice(idx); self.resyncs++; }
        var sz = vint(pend, 4);
        if (!sz) break;
        var endPos;
        if (sz.unknown) {
          endPos = findSig(pend, CLUSTER, 4 + sz.len);
          if (endPos < 0) break;
        } else {
          endPos = 4 + sz.len + sz.value;
          if (pend.length < endPos) break;
        }
        emit(out, pend.slice(0, endPos));
        pend = pend.slice(endPos);
      }
      return out;
    };

    // abort / シークなどの流し直し:途中のデータを捨てる
    self.reset = function() { pend = EMPTY; head = null; };
    return self;
  }

  // ---- MP4(fMP4 / AAC):box 単位で組み直し、init + moof + mdat を取り出す ----

  // box ヘッダ → { size, type, hdr }(足りなければ null)
  function boxAt(b, off) {
    if (off + 8 > b.length) return null;
    var size = readUint(b, off, 4), hdr = 8;
    var type = String.fromCharCode(b[off + 4], b[off + 5], b[off + 6], b[off + 7]);
    if (size === 1) {
      if (off + 16 > b.length) return null;
      size = readUint(b, off + 8, 8);
      hdr = 16;
    }
    return { size: size, type: type, hdr: hdr };
  }

  function validBox(h) {
    if (h.size < h.hdr) return false; // size 0(ファイル末尾まで)は流れの途中では扱えない
    for (var i = 0; i < 4; i++) {
      var c = h.type.charCodeAt(i);
      if (c < 0x20 || c > 0x7E) return false;
    }
    return true;
  }

  // [start, end) の子 box から type を探す → { start, end }(中身の範囲)
  function childBox(b, start, end, type) {
    var p = start;
    while (p + 8 <= end) {
      var h = boxAt(b, p);
      if (!h || !validBox(h) || p + h.size > end) return null;
      if (h.type === type) return { start: p + h.hdr, end: p + h.size };
      p += h.size;
    }
    return null;
  }

  function boxPath(b, path) {
    var r = { start: 0, end: b.length };
    for (var i = 0; i < path.length && r; i++) r = childBox(b, r.start, r.end, path[i]);
    return r;
  }

  // init(moov)の mdhd の timescale。無ければ 0
  function mp4Timescale(moov) {
    var r = boxPath(moov, ['moov', 'trak', 'mdia', 'mdhd']);
    if (!r) return 0;
    var off = r.start + 4 + (moov[r.start] === 1 ? 16 : 8);
    if (off + 4 > r.end) return 0;
    return readUint(moov, off, 4);
  }

  // moof/traf/tfdt の baseMediaDecodeTime(timescale 単位)。無ければ NaN
  function tfdtTime(moof) {
    var r = boxPath(moof, ['moof', 'traf', 'tfdt']);
    if (!r) return NaN;
    var len = moof[r.start] === 1 ? 8 : 4;
    if (r.start + 4 + len > r.end) return NaN;
    return readUint(moof, r.start + 4, len);
  }

  var SEGMENT_STARTS = ['moof', 'styp', 'ftyp'];

  function isSegmentStart(b) {
    var h = boxAt(b, 0);
    return !!(h && validBox(h) && SEGMENT_STARTS.indexOf(h.type) >= 0);
  }

  // from 以降で次のセグメントの頭(box の先頭位置)
  function findSegmentStart(b, from) {
    for (var i = from + 4; i + 4 <= b.length; i++) {
      var t = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
      if (SEGMENT_STARTS.indexOf(t) >= 0) return i - 4;
    }
    return -1;
  }

  // push(bytes) → [{ data: init + moof + mdat, time: 秒(timestampOffset 抜き) }]
  function createMp4Splitter() {
    var pend = EMPTY, ftyp = null, init = null, timescale = 0, moof = null;
    var self = { resyncs: 0 };

    self.push = function(b) {
      var out = [];
      if (pend.length && isSegmentStart(b)) {
        // 途中の box が終わらないうちに新しいセグメント = 流し直し
        pend = EMPTY; moof = null; self.resyncs++;
      }
      pend = pend.length ? concat(pend, b) : b;
      var p = 0;
      for (;;) {
        var h = boxAt(pend, p);
        if (!h) break;
        if (!validBox(h)) {
          var next = findSegmentStart(pend, p + 1);
          self.resyncs++; moof = null;
          if (next < 0) { p = pend.length; break; }
          p = next;
          continue;
        }
        if (p + h.size > pend.length) break;
        var box = pend.subarray(p, p + h.size);
        p += h.size;
        if (h.type === 'ftyp') {
          ftyp = box.slice(); init = null; moof = null;
        } else if (h.type === 'moov') {
          init = ftyp ? concat(ftyp, box) : box.slice();
          timescale = mp4Timescale(box);
        } else if (h.type === 'moof') {
          moof = box.slice();
        } else if (h.type === 'mdat') {
          if (moof && init && timescale > 0) {
            out.push({ data: concat(init, moof, box), time: tfdtTime(moof) / timescale });
          }
          moof = null;
        }
      }
      pend = p >= pend.length ? EMPTY : pend.slice(p);
      if (pend.length > MAX_PENDING) pend = EMPTY;
      return out;
    };

    self.reset = function() { pend = EMPTY; moof = null; };
    return self;
  }

  // ---- 解析 ----

  // 20ms ごとに 全体 / 低音(<150Hz)/ 中音(150Hz-4kHz)/ 高音(>4kHz)の RMS
  function bandEnvelope(ch, sr, hop) {
    var hopN = Math.max(1, Math.round(sr * hop));
    var aB = 1 - Math.exp(-2 * Math.PI * 150 / sr), aM = 1 - Math.exp(-2 * Math.PI * 4000 / sr);
    var lpB = 0, lpM = 0, out = [];
    for (var k = 0; k * hopN < ch.length; k++) {
      var s0 = 0, sB = 0, sM = 0, sT = 0, n = 0;
      var end = Math.min(ch.length, (k + 1) * hopN);
      for (var i = k * hopN; i < end; i++) {
        var x = ch[i];
        lpB += aB * (x - lpB); lpM += aM * (x - lpM);
        var mid = lpM - lpB, tr = x - lpM;
        s0 += x * x; sB += lpB * lpB; sM += mid * mid; sT += tr * tr; n++;
      }
      out.push({ rms: Math.sqrt(s0 / n), bass: Math.sqrt(sB / n), mid: Math.sqrt(sM / n), treble: Math.sqrt(sT / n) });
    }
    return out;
  }

  function lg(x) { return Math.log(1e-4 + x); }

  // オンセット(音の立ち上がり)の強さ。キック重視
  function onsetStrength(b, p) {
    return Math.max(0, lg(b.bass) - lg(p.bass)) +
      0.5 * Math.max(0, lg(b.mid) - lg(p.mid)) +
      0.25 * Math.max(0, lg(b.treble) - lg(p.treble));
  }

  function tempoPrior(bpm) { var z = Math.log2(bpm / 120) / 0.9; return Math.exp(-0.5 * z * z); }

  // 整数ラグ c の近くの極大を放物線補間で 1 bin 未満まで詰める
  function peakNear(ac, c) {
    var b = c;
    for (var k = c - 2; k <= c + 2; k++) {
      if (k > 0 && k < ac.length - 1 && ac[k] > ac[b]) b = k;
    }
    if (b <= 0 || b >= ac.length - 1) return b;
    var y0 = ac[b - 1], y1 = ac[b], y2 = ac[b + 1], den = y0 - 2 * y1 + y2;
    return den < 0 ? b + 0.5 * (y0 - y2) / den : b;
  }

  // オンセット列(hop 秒間隔)の自己相関から { period, phase, conf }(秒)。phase は列の先頭からの拍の位置
  function estimateTempo(onsets, hop) {
    var N = onsets.length, o = new Array(N), mean = 0, i;
    for (i = 0; i < N; i++) {
      o[i] = 0.25 * (onsets[i - 1] || 0) + 0.5 * onsets[i] + 0.25 * (onsets[i + 1] || 0);
      mean += o[i];
    }
    mean /= N;
    for (i = 0; i < N; i++) o[i] -= mean;

    var minL = 60 / 190 / hop, maxL = 60 / 60 / hop;
    var maxLag = Math.min(N - 1, Math.ceil(maxL * 4) + 2), ac = new Array(maxLag + 1);
    for (var L = 0; L <= maxLag; L++) {
      var a = 0;
      for (var m = 0; m + L < N; m++) a += o[m] * o[m + L];
      ac[L] = a / (N - L);
    }
    if (!(ac[0] > 0)) return null;

    var best = -1, bestScore = -Infinity;
    for (var L2 = Math.floor(minL); L2 <= Math.ceil(maxL) && L2 < maxLag; L2++) {
      var score = (ac[L2] + 0.5 * (ac[2 * L2] || 0)) * tempoPrior(60 / (L2 * hop));
      if (score > bestScore) { bestScore = score; best = L2; }
    }
    if (best < 0) return null;
    var Lf = peakNear(ac, best);
    // 2〜4 拍先のピークで周期を詰め直す(誤差が 1/k になる)
    var k = Math.min(4, Math.floor((maxLag - 2) / Lf));
    if (k > 1) Lf = peakNear(ac, Math.round(k * Lf)) / k;

    // 拍の位置:周期 Lf で一番オンセットが乗る位相(bin の間は線形補間)
    var bestPh = 0, bestSum = -Infinity;
    for (var ph = 0; ph < Lf; ph += 0.5) {
      var ps = 0;
      for (var q = ph; q < N - 1; q += Lf) {
        var f = Math.floor(q);
        ps += o[f] + (o[f + 1] - o[f]) * (q - f);
      }
      if (ps > bestSum) { bestSum = ps; bestPh = ph; }
    }
    return { period: Lf * hop, phase: bestPh * hop, conf: ac[best] / ac[0] };
  }

  // (t0, t1] にあるグリッドの線(最後の 1 本)。無ければ NaN
  function gridLineIn(grid, t0, t1) {
    var gb = grid.anchor + Math.floor((t1 - grid.anchor) / grid.period) * grid.period;
    return gb > t0 ? gb : NaN;
  }

  // 再生時刻ごとの bin を持ち、frameAt(t) でビート・BPM・音量を返す
  function createAnalyzer() {
    var bins = new Map(); // index(t / HOP)→ { rms, bass, mid, treble, on }
    var grid, lastEstT, lastT, lastBeatT, beatStrength, onMax, bMax, mMax, tMax;
    var self = { mode: '', bpm: 0 };

    function clearTracking() {
      grid = null; lastEstT = NaN; lastT = NaN; lastBeatT = -Infinity; beatStrength = 0;
    }

    function onsetAt(i) {
      var b = bins.get(i), p = bins.get(i - 1);
      if (!b || !p) return NaN;
      if (b.on === undefined) b.on = onsetStrength(b, p);
      return b.on;
    }

    function updateGrid(t) {
      var ic = Math.round(t / HOP), o = [], have = 0;
      for (var i = ic - WIN; i <= ic + WIN; i++) {
        var v = onsetAt(i);
        if (isNaN(v)) v = 0; else have++;
        o.push(v);
      }
      if (have < WIN) return;
      var g = estimateTempo(o, HOP);
      if (!g) return;
      var anchor = (ic - WIN) * HOP + g.phase;
      if (grid && Math.abs(g.period / grid.period - 1) < 0.04) {
        // テンポはなめらかに、位相は少しだけ寄せる(ガタつき防止)
        var period = 0.8 * grid.period + 0.2 * g.period;
        var d = ((anchor - grid.anchor) / period) % 1;
        if (d > 0.5) d -= 1;
        if (d < -0.5) d += 1;
        grid = { period: period, anchor: grid.anchor + (Math.abs(d) < 0.2 ? 0.3 * d : d) * period, conf: g.conf };
      } else {
        grid = { period: g.period, anchor: anchor, conf: g.conf };
      }
    }

    self.reset = function() {
      bins.clear();
      clearTracking();
      onMax = bMax = mMax = tMax = 1e-6;
      self.mode = ''; self.bpm = 0;
    };

    self.addEnvelope = function(start, env) {
      var i0 = Math.round(start / HOP);
      for (var k = 0; k < env.length; k++) bins.set(i0 + k, env[k]);
      // 後ろの bin のオンセットは前の bin が変わったので計算し直す
      var after = bins.get(i0 + env.length);
      if (after) after.on = undefined;
      if (bins.size > MAX_BINS) {
        var center = isFinite(lastT) ? lastT / HOP : i0;
        bins.forEach(function(v, key) { if (Math.abs(key - center) > MAX_BINS / 2) bins.delete(key); });
      }
    };

    // SourceBuffer.remove(start, end) に合わせて捨てる
    self.removeRange = function(start, end) {
      bins.forEach(function(v, key) {
        var t = key * HOP;
        if (t >= start && t < end) bins.delete(key);
      });
    };

    self.size = function() { return bins.size; };

    // 再生位置 t(秒)の { beat, bpm, strength, rms, bass, mid, treble }。データが無ければ null
    self.frameAt = function(t) {
      if (typeof t !== 'number' || !isFinite(t)) return null;
      var i = Math.round(t / HOP), bin = bins.get(i) || bins.get(i - 1) || bins.get(i + 1);
      if (!bin) return null;

      var dt = t - lastT;
      var jumped = !isFinite(dt) || dt < -SEEK || dt > SEEK;
      if (jumped && isFinite(dt)) { grid = null; lastEstT = NaN; lastBeatT = -Infinity; } // シーク
      if (!(Math.abs(t - lastEstT) < 1)) { lastEstT = t; updateGrid(t); } // 再生位置で 1 秒ごと

      var on = onsetAt(i) || 0, beat = false;
      var d = jumped || dt < 0 ? 0 : dt;
      onMax = Math.max(onMax * Math.pow(ON_DECAY, d), on);
      if (!jumped && dt > 0) {
        if (grid && grid.conf >= MIN_CONF) {
          self.mode = 'grid';
          var gb = gridLineIn(grid, lastT, t);
          if (gb > lastBeatT + 0.5 * grid.period) {
            beat = true; lastBeatT = gb;
            var peak = 0, gi = Math.round(gb / HOP);
            for (var k = -2; k <= 2; k++) peak = Math.max(peak, onsetAt(gi + k) || 0);
            beatStrength = Math.min(1, 0.4 + 0.6 * peak / onMax);
          }
        } else {
          // グリッドが取れない曲(テンポが曖昧)は、前回から今回までのオンセットをしきい値で
          self.mode = 'onset';
          var i0 = Math.round(lastT / HOP), cur = 0, mu = 0, sd = 0, n = 0, j, v;
          for (j = i0 + 1; j <= i; j++) cur = Math.max(cur, onsetAt(j) || 0);
          for (j = i0 - 74; j <= i0; j++) { v = onsetAt(j); if (!isNaN(v)) { mu += v; n++; } }
          if (n >= 10) {
            mu /= n;
            for (j = i0 - 74; j <= i0; j++) { v = onsetAt(j); if (!isNaN(v)) sd += (v - mu) * (v - mu); }
            sd = Math.sqrt(sd / n);
            if (cur > mu + 1.5 * sd && cur > 0.05 && t - lastBeatT > 0.25) {
              beat = true; lastBeatT = t;
              beatStrength = Math.min(1, 0.4 + 0.6 * cur / onMax);
            }
          }
        }
      }
      lastT = t;

      var bandDecay = Math.pow(BAND_DECAY, Math.min(d, 1));
      bMax = Math.max(bMax * bandDecay, bin.bass);
      mMax = Math.max(mMax * bandDecay, bin.mid);
      tMax = Math.max(tMax * bandDecay, bin.treble);
      var since = t - lastBeatT;
      self.bpm = grid ? 60 / grid.period : 120;
      return {
        beat: beat,
        bpm: self.bpm,
        strength: since >= 0 && since < 0.2 ? beatStrength * (1 - since / 0.2) : 0,
        rms: bin.rms,
        bass: Math.min(1, bin.bass / bMax),
        mid: Math.min(1, bin.mid / mMax),
        treble: Math.min(1, bin.treble / tMax),
      };
    };

    self.reset();
    return self;
  }

  // ---- MediaSource へのフック ----

  var analyzer = createAnalyzer();
  var stats = { appends: 0, segments: 0, decoded: 0, failed: 0, resyncs: 0, lastErr: '', bpm: 0, mode: '' };
  var gen = 0, dctx = null;

  function decode(bytes, start) {
    var myGen = gen;
    try {
      if (!dctx) {
        var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!OAC) return;
        dctx = new OAC(1, 1, 44100);
      }
      var buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      dctx.decodeAudioData(buf).then(function(ab) {
        stats.decoded++;
        if (myGen !== gen) return; // 動画が切り替わった後に届いた古いデータは捨てる
        analyzer.addEnvelope(start, bandEnvelope(ab.getChannelData(0), ab.sampleRate, HOP));
      }, function(e) {
        stats.failed++; stats.lastErr = String((e && e.message) || e);
      });
    } catch (e) {
      stats.failed++; stats.lastErr = String((e && e.message) || e);
    }
  }

  function createSplitter(type) {
    if (/webm/i.test(type)) return createWebmSplitter();
    if (/mp4/i.test(type)) return createMp4Splitter();
    return null;
  }

  function hookSourceBuffer(sb, type) {
    var splitter = createSplitter(type);
    var origAppend = sb.appendBuffer, origAbort = sb.abort, origRemove = sb.remove, origChangeType = sb.changeType;

    sb.appendBuffer = function(data) {
      try {
        stats.appends++;
        if (splitter) {
          var before = splitter.resyncs;
          var segs = splitter.push(u8(data).slice());
          stats.resyncs += splitter.resyncs - before;
          var offset = sb.timestampOffset || 0;
          for (var i = 0; i < segs.length; i++) {
            if (!isFinite(segs[i].time)) continue;
            stats.segments++;
            decode(segs[i].data, segs[i].time + offset);
          }
        }
      } catch (e) { stats.lastErr = 'append: ' + (e.message || e); }
      return origAppend.apply(this, arguments);
    };

    // abort は流し直しの合図。途中のデータを捨てる
    sb.abort = function() {
      if (splitter) splitter.reset();
      stats.resyncs++;
      return origAbort.apply(this, arguments);
    };

    sb.remove = function(start, end) {
      try { analyzer.removeRange(start, end); } catch (e) { /* ignore */ }
      return origRemove.apply(this, arguments);
    };

    if (typeof origChangeType === 'function') {
      sb.changeType = function(newType) {
        splitter = createSplitter(String(newType));
        return origChangeType.apply(this, arguments);
      };
    }
  }

  function patchAddSourceBuffer(proto) {
    var orig = proto.addSourceBuffer;
    if (typeof orig !== 'function') return;
    proto.addSourceBuffer = function(type) {
      var sb = orig.apply(this, arguments);
      try {
        if (/^audio\//i.test(String(type))) {
          // 新しい動画(YouTube は SPA なので同じページで MediaSource を作り直す)→ 前の解析を捨てる
          gen++;
          analyzer.reset();
          hookSourceBuffer(sb, String(type));
        }
      } catch (e) { stats.lastErr = 'add: ' + (e.message || e); }
      return sb;
    };
  }

  var msProto = window.MediaSource && window.MediaSource.prototype;
  if (msProto) patchAddSourceBuffer(msProto);
  // ManagedMediaSource:MediaSource が無い環境(iPhone)か、自前の addSourceBuffer を持つときだけ
  var mmsProto = window.ManagedMediaSource && window.ManagedMediaSource.prototype;
  if (mmsProto && mmsProto !== msProto &&
      (!msProto || Object.prototype.hasOwnProperty.call(mmsProto, 'addSourceBuffer'))) {
    patchAddSourceBuffer(mmsProto);
  }

  window.__vjamMse = {
    // 再生位置 time(秒)の { beat, bpm, strength, rms, bass, mid, treble }。データが無ければ null
    frameAt: function(time) {
      var f = analyzer.frameAt(time);
      stats.bpm = analyzer.bpm; stats.mode = analyzer.mode;
      return f;
    },
    stats: stats, // 実機確認用(読むだけ)
    // テスト用(純粋関数)
    _lib: {
      HOP: HOP,
      vint: vint,
      clusterTimecode: clusterTimecode,
      timecodeScale: timecodeScale,
      createWebmSplitter: createWebmSplitter,
      mp4Timescale: mp4Timescale,
      tfdtTime: tfdtTime,
      createMp4Splitter: createMp4Splitter,
      bandEnvelope: bandEnvelope,
      onsetStrength: onsetStrength,
      estimateTempo: estimateTempo,
      gridLineIn: gridLineIn,
      createAnalyzer: createAnalyzer,
    },
  };
})();
