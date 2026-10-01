import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

// 拡張の実機スモーク(tests/e2e/*.e2e.js)。vitest の *.test.js とは混ざらない
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.js',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
  // 結果はリポの外へ(test-results/ を作らない)
  outputDir: path.join(os.tmpdir(), 'vjam-fx-e2e-results'),
});
