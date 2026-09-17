import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api = fs.readFileSync(new URL('../src/api.js', import.meta.url), 'utf8');

test('Android login uses the original WebView fetch directly against /api/login', () => {
  assert.match(api, /loginWebFetch\(\)/);
  assert.match(api, /\$\{API_BASE\}\/api\/login/);
  assert.match(api, /loginEndpointRequest\(usuario, clave, fetchImpl = loginWebFetch\(\)\)/);
  assert.equal(/loginEndpointRequest[\s\S]{0,900}nativeJsonRequest/.test(api), false);
  assert.equal(api.includes('/api/mobile-core?action=login'), false);
});
