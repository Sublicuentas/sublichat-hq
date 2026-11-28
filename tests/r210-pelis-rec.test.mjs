// R210 · Pelis y estrenos: recomendaciones del día (TMDB simulado, sin red ni claves).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as REC from '../api/_pelis-rec.js';
import { recomendacionesDelDia, detalleTitulo } from '../api/tmdb.js';

const peli = (id, extra = {}) => ({ id, title: 'Peli ' + id, release_date: '2024-03-01', genre_ids: [28], vote_average: 7.8, vote_count: 900, overview: 'Sinopsis ' + id, poster_path: '/p' + id + '.jpg', ...extra });
const serie = (id, extra = {}) => ({ id, name: 'Serie ' + id, first_air_date: '2022-01-01', genre_ids: [18], vote_average: 8.1, vote_count: 400, overview: 'Sinopsis ' + id, poster_path: '/s' + id + '.jpg', ...extra });
const PROV = {
  // id → providers HN
  1: { flatrate: [{ provider_name: 'Netflix' }] }, 2: { flatrate: [{ provider_name: 'Max' }, { provider_name: 'Amazon Prime Video' }] },
  3: { rent: [{ provider_name: 'Apple TV' }], buy: [{ provider_name: 'Google Play Movies' }] }, // SOLO alquiler/compra → no se recomienda
  4: { flatrate: [{ provider_name: 'Disney Plus' }] }, 5: { flatrate: [{ provider_name: 'Netflix basic with Ads' }] },
  101: { flatrate: [{ provider_name: 'Netflix' }] }, 102: { flatrate: [{ provider_name: 'Paramount Plus' }] }, 103: { flatrate: [{ provider_name: 'Crunchyroll' }] },
};
function fakeGet(log = []) {
  return async (path, params) => {
    log.push(path);
    if (path === '/genre/movie/list') return { genres: [{ id: 28, name: 'Acción' }] };
    if (path === '/genre/tv/list') return { genres: [{ id: 18, name: 'Drama' }] };
    if (path === '/discover/movie') { assert.equal(params.watch_region, 'HN'); assert.match(params.with_watch_monetization_types, /flatrate/); assert.doesNotMatch(params.with_watch_monetization_types, /rent|buy/); return { results: params.page === 1 ? [peli(1), peli(2), peli(3), peli(4), peli(6, { poster_path: null })] : [peli(5)] }; }
    if (path === '/discover/tv') return { results: params.page === 1 ? [serie(101), serie(102), serie(103)] : [] };
    let m = path.match(/^\/(movie|tv)\/(\d+)\/watch\/providers$/);
    if (m) return { results: PROV[m[2]] ? { HN: PROV[m[2]], US: { flatrate: [{ provider_name: 'Hulu' }] } } : { US: { flatrate: [{ provider_name: 'Hulu' }] } } };
    if (path === '/movie/now_playing') return { results: [{ id: 900, title: 'En cines', release_date: '2026-11-25', poster_path: '/c.jpg' }] };
    if (path === '/movie/upcoming') return { results: [{ id: 901, title: 'Pronto', release_date: '2026-12-20', poster_path: '/u.jpg' }, { id: 902, title: 'Viejo', release_date: '2026-10-01', poster_path: '/v.jpg' }] };
    m = path.match(/^\/(movie|tv)\/(\d+)$/);
    if (m) return m[1] === 'movie'
      ? { id: +m[2], title: 'Peli ' + m[2], release_date: '2024-03-01', overview: '', runtime: 125, genres: [{ name: 'Acción' }], vote_average: 7.8, vote_count: 900, release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'PG-13' }] }] }, 'watch/providers': { results: { HN: PROV[m[2]] || {} } } }
      : { id: +m[2], name: 'Serie ' + m[2], first_air_date: '2022-01-01', overview: 'Completa', number_of_seasons: 2, number_of_episodes: 16, status: 'Returning Series', genres: [], content_ratings: { results: [{ iso_3166_1: 'HN', rating: 'TV-14' }] }, 'watch/providers': { results: { HN: PROV[m[2]] || {} } } };
    throw new Error('ruta no simulada ' + path);
  };
}
const NOW = new Date('2026-11-28T18:43:00Z'); // 12:43 Honduras

test('solo títulos incluidos en Honduras: alquiler/compra y otros países no cuentan; mezcla películas y series', async () => {
  const p = await REC.calcularDelDia({ get: fakeGet(), fecha: '2026-11-28', now: NOW });
  assert.equal(p.fecha, '2026-11-28'); assert.equal(p.horaHN, '12:43'); assert.equal(p.visibles, 3);
  const ids = p.recomendaciones.map((r) => r.id);
  assert.ok(!ids.includes(3), 'solo alquiler/compra no se recomienda');
  assert.ok(!ids.includes(6), 'sin carátula no entra');
  assert.ok(p.recomendaciones.every((r) => r.proveedores.length && r.poster && r.sinopsis));
  assert.ok(p.recomendaciones.every((r) => !r.proveedores.includes('Hulu')), 'nada de otras regiones');
  const tres = p.recomendaciones.slice(0, 3).map((r) => r.tipo);
  assert.ok(tres.includes('movie') && tres.includes('tv'), 'combina películas y series');
  const p5 = p.recomendaciones.find((r) => r.id === 5); assert.deepEqual(p5.proveedores, ['Netflix'], 'nombres unificados');
  const p2 = p.recomendaciones.find((r) => r.id === 2); assert.deepEqual(p2.proveedores, ['Max', 'Prime Video']);
  assert.equal(p.recomendaciones.find((r) => r.id === 1).generos[0], 'Acción');
  assert.ok(!JSON.stringify(p).includes('api_key'));
});

test('misma fecha ⇒ misma selección; otro día puede cambiar; evita repetir lo de días anteriores', async () => {
  const a = await REC.calcularDelDia({ get: fakeGet(), fecha: '2026-11-28', now: NOW });
  const b = await REC.calcularDelDia({ get: fakeGet(), fecha: '2026-11-28', now: NOW });
  assert.deepEqual(a.recomendaciones.map((r) => r.id), b.recomendaciones.map((r) => r.id));
  const evitar = new Set(a.recomendaciones.slice(0, 3).map((r) => r.tipo + ':' + r.id));
  const c = await REC.calcularDelDia({ get: fakeGet(), fecha: '2026-11-29', evitar, now: NOW });
  assert.ok(c.recomendaciones.slice(0, 3).every((r) => !evitar.has(r.tipo + ':' + r.id)), 'las 3 de mañana no repiten las de hoy');
});

test('cartelera: etiquetas honestas por fecha y próximos con fecha', async () => {
  const p = await REC.calcularDelDia({ get: fakeGet(), fecha: '2026-11-28', now: NOW });
  const cine = p.cartelera.find((c) => c.id === 900); assert.equal(cine.estado, 'Nuevo estreno'); assert.equal(cine.nota, 'En cartelera');
  const pronto = p.cartelera.find((c) => c.id === 901); assert.equal(pronto.estado, 'Próximo estreno'); assert.equal(pronto.nota, '20/12/2026');
  assert.ok(!p.cartelera.some((c) => c.id === 902), 'un «próximo» ya pasado no se anuncia');
  assert.deepEqual(REC.estadoCartelera('2026-10-30', '2026-11-28'), { estado: 'Estreno reciente', nota: 'En cartelera' });
  assert.deepEqual(REC.estadoCartelera('2026-08-01', '2026-11-28'), { estado: 'En cartelera', nota: 'En cines' });
});

test('detalle: sinopsis completa, clasificación, duración/temporadas y aviso de solo alquiler', async () => {
  const d = await REC.detalle({ get: fakeGet(), id: '1', tipo: 'movie' });
  assert.equal(d.duracion, 125); assert.equal(d.clasificacion, 'PG-13 (US)'); assert.deepEqual(d.proveedores, ['Netflix']);
  const s = await REC.detalle({ get: fakeGet(), id: '101', tipo: 'tv' });
  assert.equal(s.temporadas, 2); assert.equal(s.clasificacion, 'TV-14'); assert.equal(s.estadoSerie, 'En emisión');
  const r = await REC.detalle({ get: fakeGet(), id: '3', tipo: 'movie' });
  assert.deepEqual(r.proveedores, []); assert.equal(r.soloAlquiler, true);
  await assert.rejects(() => REC.detalle({ get: fakeGet(), id: '1;drop', tipo: 'movie' }));
  await assert.rejects(() => REC.detalle({ get: fakeGet(), id: '1', tipo: 'person' }));
});

test('caché: Firestore guarda 1 selección por día y todas las instancias leen la misma; TMDB no se vuelve a consultar', async () => {
  const docs = new Map();
  const db = { collection: () => ({ doc: (id) => ({ get: async () => ({ exists: docs.has(id), data: () => docs.get(id) }), create: async (v) => { if (docs.has(id)) throw new Error('existe'); docs.set(id, v); } }) }) };
  const log = [];
  const a = await recomendacionesDelDia({ KEY: 'x', db, get: fakeGet(log), now: NOW });
  const n = log.length;
  const b = await recomendacionesDelDia({ KEY: 'x', db, get: fakeGet(log), now: NOW });
  assert.equal(log.length, n, 'segunda vez sale de caché');
  assert.deepEqual(a.recomendaciones, b.recomendaciones);
  assert.ok(docs.has('2026-11-28'));
  const d1 = await detalleTitulo({ KEY: 'x', id: '1', tipo: 'movie', get: fakeGet(log) }); const m = log.length;
  await detalleTitulo({ KEY: 'x', id: '1', tipo: 'movie', get: fakeGet(log) }); assert.equal(log.length, m); assert.equal(d1.id, 1);
});

test('la búsqueda de siempre sigue igual y el fallo de recomendaciones no la toca', async () => {
  const src = fs.readFileSync(new URL('../api/tmdb.js', import.meta.url), 'utf8');
  assert.match(src, /search\/multi/); assert.match(src, /const REGION = "HN"/);
  assert.match(src, /El buscador sigue funcionando/);
  const web = fs.readFileSync(new URL('../pelis-rec.js', import.meta.url), 'utf8');
  for (const t of ['Recomendaciones del día', 'Selección diaria', 'Dónde verla:', 'Cartelera y estrenos', 'Ver más', 'Reintentar', 'Actualizado ']) assert.ok(web.includes(t), t);
  assert.doesNotMatch(web, /api_key|TMDB_API_KEY/);
  const idx = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(idx, /id="pelisRec"/); assert.match(idx, /pelis-rec\.js\?v=20261128-r210/);
  const css = fs.readFileSync(new URL('../pelis-rec.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /gradient/);
});
