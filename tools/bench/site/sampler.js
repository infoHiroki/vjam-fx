// 計測専用: p5 キャンバスを 64x40 に縮め、毎フレーム明るさ・塗り面積・動き・大きな明滅を記録する(harness.js の後に読む)
(() => {
  const H = window.__vjamBench;
  const L = [...window._vjamFxEngine.activeLayers.values()][0];
  const cv = L && L.container.querySelector('canvas');
  const small = document.createElement('canvas'); small.width = 64; small.height = 40;
  const sx = small.getContext('2d', { willReadFrequently: true });
  let prev = null;
  H.samples = [];
  H.sampling = false;
  function frame() {
    requestAnimationFrame(frame);
    if (!H.sampling || !cv) return;
    sx.clearRect(0, 0, 64, 40); sx.fillStyle = '#000'; sx.fillRect(0, 0, 64, 40);
    sx.drawImage(cv, 0, 0, 64, 40);
    const d = sx.getImageData(0, 0, 64, 40).data;
    let lum = 0, cov = 0, diff = 0, up = 0, down = 0; const cur = new Float32Array(64 * 40);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const y = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      cur[j] = y; lum += y; if (y > 0.15) cov++;
      if (prev) { const dy = y - prev[j]; diff += Math.abs(dy); if (dy >= 0.2) up++; else if (dy <= -0.2) down++; }
    }
    const n = 64 * 40, t = performance.now();
    // up / down: 前のフレームから輝度が 0.2 以上明るく / 暗くなった画素の割合(画面がそろって明滅するかを見る)
    H.samples.push({ m: H.mode, t, ph: ((t - H.beatT0) % 500) / 500,
      lum: lum / n, cov: cov / n, diff: prev ? diff / n : 0, up: up / n, down: down / n });
    prev = cur;
  }
  requestAnimationFrame(frame);
})();
