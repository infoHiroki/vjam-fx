import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

// Chrome ウェブストアのスクショとプロモーション画像を撮る(store/README.md)。npm run test:e2e には入れない
//   npx playwright test -c tests/e2e/store-screenshots.config.js
export default defineConfig({
  testDir: '.',
  testMatch: 'store-screenshots.shots.js',
  timeout: 300_000,
  workers: 1,
  reporter: 'list',
  outputDir: path.join(os.tmpdir(), 'vjam-fx-store-shots'),
});
