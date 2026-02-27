import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('manifest.json', () => {
  let manifest;

  beforeAll(() => {
    const raw = readFileSync(resolve(__dirname, '../manifest.json'), 'utf-8');
    manifest = JSON.parse(raw);
  });

  it('should be Manifest V3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it('should have correct name', () => {
    expect(manifest.name).toContain('VJam FX');
  });

  it('should have valid version', () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should have action with popup', () => {
    expect(manifest.action).toBeDefined();
    expect(manifest.action.default_popup).toBe('popup/popup.html');
  });

  it('should have required icons', () => {
    expect(manifest.action.default_icon).toHaveProperty('16');
    expect(manifest.action.default_icon).toHaveProperty('48');
    expect(manifest.action.default_icon).toHaveProperty('128');
  });

  it('should have activeTab, scripting and webNavigation permissions', () => {
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).toContain('scripting');
    expect(manifest.permissions).toContain('webNavigation');
  });

  it('should have tabCapture and offscreen permissions', () => {
    expect(manifest.permissions).toContain('tabCapture');
    expect(manifest.permissions).toContain('offscreen');
  });

  it('should NOT have host_permissions (uses activeTab instead)', () => {
    expect(manifest.host_permissions).toBeUndefined();
  });

  it('should have web_accessible_resources for p5.js and content modules', () => {
    expect(manifest.web_accessible_resources).toBeDefined();
    const resources = manifest.web_accessible_resources[0].resources;
    expect(resources).toContain('lib/p5.min.js');
    expect(resources).toContain('content/content.js');
    expect(resources).toContain('content/base-preset.js');
    expect(resources).not.toContain('content/audio-analyzer.js');
  });

  it('should have audio-bridge content script', () => {
    expect(manifest.content_scripts.length).toBe(1);
    expect(manifest.content_scripts[0].js).toContain('content/audio-bridge.js');
    expect(manifest.content_scripts[0].matches).toContain('<all_urls>');
  });

  it('should have storage permission for SW state persistence', () => {
    expect(manifest.permissions).toContain('storage');
  });

  it('should only request required permissions', () => {
    expect(manifest.permissions.length).toBe(6);
  });

  it('should have service worker background script', () => {
    expect(manifest.background).toBeDefined();
    expect(manifest.background.service_worker).toBe('background/service-worker.js');
  });
});
