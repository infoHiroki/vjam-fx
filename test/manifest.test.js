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

  it('should have activeTab and scripting permissions', () => {
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).toContain('scripting');
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
    expect(resources).toContain('content/audio-analyzer.js');
  });

  it('should have empty content_scripts (on-demand injection)', () => {
    expect(manifest.content_scripts).toEqual([]);
  });

  it('should only request minimal permissions', () => {
    expect(manifest.permissions.length).toBe(2);
  });
});
