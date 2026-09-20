import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

// "Partidos" quedaba con los puntos animados para siempre: la función esperaba a la fuente ESPN más lenta.
test('api/partidos: tope global, reintento y diagnóstico de fuentes', () => {
  const api = read('api/partidos.js');
  assert.match(api, /PARTIDOS_TOPE_MS\) \|\| 12000/, 'tope global de espera');
  assert.match(api, /async function esperarFuentes\(jobs, hechos, topeMs\)/, 'responde con lo que ya llegó');
  assert.match(api, /soloProximos: !hoyList\.length/, 'las apps saben cuándo "Hoy" es solo próximos');
  assert.match(api, /parcial: cargaParcial \|\| fallas\.length > 0/);
  assert.match(api, /detalle: fallas\.slice\(0, 4\)/, 'si todo falla, el error trae el motivo');
  assert.match(api, /espnScoreboardDia\("soccer\/" \+ lg\.slug, ymd\)/, '"Hoy" pide un solo día por fuente');
  assert.match(api, /globalThis\.__partidosCache/, 'caché de la última respuesta buena');
  assert.match(api, /detalle,\s*\}\)|fallas: fallas\.length, detalle/, 'el diagnóstico llega a las apps');
  const cfg = JSON.parse(read('vercel.json'));
  assert.equal(cfg.functions['api/partidos.js']?.maxDuration, 30);
});

test('web: Partidos con tiempo límite y avisos (ya no queda cargando para siempre)', () => {
  const web = read('sublichat-app.js');
  assert.match(web, /new AbortController\(\); const timer=setTimeout\(\(\)=>ctrl\.abort\(\),25000\)/);
  assert.match(web, /Hoy no hay partidos disponibles: se muestran los próximos eventos\./);
});

// CAUSA RAÍZ de "Partidos no carga" en la web: el menú RBAC crea botones nuevos que llaman a rbacGo(); el clic original
// (que iniciaba Partidos) se perdía y quedaba el placeholder de puntos para siempre, sin llegar a pedir nada al servidor.
test('web: abrir Partidos desde el menú RBAC inicia la carga (rbacGo llama initPartidos)', () => {
  const web = read('sublichat-app.js');
  const i = web.indexOf('function rbacGo(screen)');
  const block = web.slice(i, web.indexOf('function resizeProfilePhoto', i));
  assert.match(block, /if\(screen==='partidos'\) initPartidos\(\);/);
  // y si la primera carga falla, al volver a entrar reintenta
  assert.match(web, /partidosCargados=false;matchResults\.innerHTML/);
});
