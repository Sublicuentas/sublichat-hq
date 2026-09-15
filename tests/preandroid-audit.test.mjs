import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = async (rel) => readFile(path.join(root, rel), 'utf8');
const exists = async (rel) => { try { await access(path.join(root, rel), constants.F_OK); return true; } catch { return false; } };

test('Chart.js externo no contiene JavaScript inline ignorado', async () => {
  const html = await text('index.html');
  const marker = '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js">';
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, 'No se encontró Chart.js');
  const bodyStart = start + marker.length;
  const end = html.indexOf('</script>', bodyStart);
  assert.notEqual(end, -1, 'Chart.js no tiene cierre');
  assert.equal(html.slice(bodyStart, end).trim(), '', 'Un script con src no debe contener código inline');
});

test('service worker no precachea archivos inexistentes', async () => {
  const sw = await text('service-worker.js');
  const matches = [...sw.matchAll(/['"](\.\/?[^'"]+)['"]/g)].map(m => m[1]);
  const candidates = matches.filter(v => /\.(?:html|css|js|png|jpg|jpeg|webp|webmanifest)(?:\?.*)?$/i.test(v));
  for (const raw of candidates) {
    const rel = raw.replace(/^\.\//, '').split('?')[0];
    assert.equal(await exists(rel), true, `service-worker.js referencia un archivo inexistente: ${raw}`);
  }
});

test('helpers y scripts de mantenimiento no se publican como endpoints Vercel', async () => {
  for (const rel of ['api/sorteos-lib.js', 'api/sorteos-eventos.js', 'api/detectar_clientes_fusionados.js']) {
    assert.equal(await exists(rel), false, `${rel} debe vivir fuera de /api`);
  }
  assert.equal(await exists('lib/sorteos-lib.js'), true);
  assert.equal(await exists('lib/sorteos-eventos.js'), true);
  assert.equal(await exists('scripts/detectar_clientes_fusionados.mjs'), true);
});

test('no queda la copia financiera v1 en la raíz', async () => {
  assert.equal(await exists('finanzas.js'), false, 'finanzas.js raíz es una copia legacy y puede confundir despliegues');
  assert.equal(await exists('api/finanzas.js'), true);
});


test('el núcleo principal sale del HTML y queda en un módulo versionable', async () => {
  const html = await text('index.html');
  assert.equal(html.includes('<script type="module">'), false, 'No debe quedar el megamódulo inline');
  assert.match(html, /<script type="module" src="\.\/sublichat-app\.js\?v=[^"]+"><\/script>/);
  const app = await text('sublichat-app.js');
  assert.ok(app.length > 500000, 'El núcleo extraído parece incompleto');
});


test('Vercel no cachea el núcleo ni el service worker durante estabilización', async () => {
  const cfg = JSON.parse(await text('vercel.json'));
  const map = new Map((cfg.headers || []).map(entry => [entry.source, entry.headers || []]));
  for (const source of ['/sublichat-app.js', '/service-worker.js']) {
    assert.equal(map.has(source), true, `Falta header para ${source}`);
    const cc = map.get(source).find(h => String(h.key).toLowerCase() === 'cache-control');
    assert.ok(cc && /no-cache|no-store/.test(cc.value), `${source} debe impedir caché viejo`);
  }
});
