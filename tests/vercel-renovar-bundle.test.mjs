import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = rel => readFile(path.join(root, rel), 'utf8');

test('api/renovar incluye los helpers compartidos lib en el bundle de Vercel', async () => {
  const renovar = await text('api/renovar.js');
  assert.match(renovar, /from\s+["']\.\.\/lib\/sorteos-eventos\.js["']/,
    'La prueba espera que renovar use el helper compartido de sorteos');

  const cfg = JSON.parse(await text('vercel.json'));
  const rule = cfg.functions?.['api/renovar.js'];
  assert.ok(rule, 'Falta configuración de Vercel específica para api/renovar.js');
  const includes = Array.isArray(rule.includeFiles) ? rule.includeFiles : [rule.includeFiles].filter(Boolean);
  assert.ok(includes.some(v => /^lib\/(?:\*\*|sorteos-)/.test(String(v))),
    'api/renovar.js debe incluir lib/** (o los helpers sorteos-*) en su bundle');
});
