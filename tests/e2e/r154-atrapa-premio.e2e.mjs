// R154 · e2e "Atrapa tu Premio" en el portal del cliente (Playwright, Chromium).
// Sirve acceso.html localmente y responde /api/sorteos con el MOTOR REAL (api/_juego-premios.js) sobre Firestore simulado.
// Uso: node tests/e2e/r154-atrapa-premio.e2e.mjs   (three.js se sirve desde /vendor del repo)
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as J from '../../api/_juego-premios.js';
import { fakeFirestore } from '../helpers/fake-firestore.mjs';

const { chromium } = createRequire(import.meta.url)('playwright'); // instalado global o local
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = process.env.E2E_OUT || path.join(root, 'tests/e2e/capturas');
fs.mkdirSync(OUT, { recursive: true });
const HOY = J.hoyDMY();

function nuevaDb() {
  return fakeFirestore({
    clientes: { c1: { nombrePerfil: 'Ana López', servicios: [
      { compraId: 'k1', plataforma: 'spotify', fechaRenovacion: J.sumarDiasDMY(HOY, 20) },
      { compraId: 'k2', plataforma: 'latintv1', fechaRenovacion: J.sumarDiasDMY(HOY, 200) },
    ] } },
    inventario: { i1: { plataforma: 'hbomax', capacidad: 5, clientes: [1] }, i2: { plataforma: 'primevideo', capacidad: 5, clientes: [1] }, i3: { plataforma: 'crunchyroll', capacidad: 5, clientes: [] } },
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = u.pathname.startsWith('/c/') ? '/acceso.html' : u.pathname;
  const f = path.join(root, decodeURIComponent(p));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('{}'); }
  const ext = path.extname(f);
  res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' }[ext] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

async function preparar(page, db, { fallaJugar = false, demora = 0 } = {}) {
  const llamadas = [];
  await page.route('**/cdn.jsdelivr.net/**', (r) => r.abort()); // debe cargar three.js local (/vendor), no del CDN
  // Portal real: acceso del cliente + secciones. sorteos:false → el mensual está apagado; la categoría se ve SOLO por el juego.
  await page.route('**/api/acceso**', (r) => r.request().url().includes('tok-ana')
    ? r.fulfill({ json: { ok: true, titular: 'Ana López', vendedor: 'Sublicuentas', vendedorTelefono: '89464277', plataforma: 'spotify', fechaRenovacion: J.sumarDiasDMY(HOY, 20), servicios: [{ plataforma: 'spotify', fechaRenovacion: J.sumarDiasDMY(HOY, 20), vendedor: 'Sublicuentas', vendedorTelefono: '89464277', correo: 'ana@correo.com', clave: '••••' }] } })
    : r.fulfill({ status: 404, json: { ok: false, error: 'Enlace no válido.' } }));
  await page.route('**/api/portal-cliente**', (r) => r.fulfill({ json: { ok: true, secciones: { sorteos: false, pagos: false }, promociones: [] } }));
  await page.route('**/api/sorteos**', async (r) => {
    if (r.request().method() !== 'POST') return r.fulfill({ json: { ok: true, habilitado: false } });
    const b = r.request().postDataJSON() || {};
    llamadas.push(b.accion);
    try {
      if (b.token !== 'tok-ana') return r.fulfill({ status: 404, json: { ok: false, error: 'Enlace no válido.' } });
      if (b.accion === 'juego_estado') return r.fulfill({ json: { ok: true, ...(await J.estadoCliente(db, { clienteId: 'c1' })) } });
      if (b.accion === 'juego_jugar') {
        if (fallaJugar) return r.fulfill({ status: 503, json: { ok: false, error: 'Sin conexión con el servidor. Su ficha sigue disponible.' } });
        if (demora) await new Promise((x) => setTimeout(x, demora));
        await J.sembrarPremios(db);
        const out = await J.jugar(db, { clienteId: 'c1', fichaId: b.fichaId });
        const est = await J.estadoCliente(db, { clienteId: 'c1' });
        const g = out.ganado;
        return r.fulfill({ json: { ok: true, repetido: !!out.repetido, ganado: { id: g.id, premio: g.premio, estado: g.estado, expiraAt: g.expiraAt, entrega: g.entrega || null }, disponibles: est.disponibles, fichas: est.fichas, historial: est.historial } });
      }
      return r.fulfill({ status: 400, json: { ok: false, error: 'acción' } });
    } catch (e) { return r.fulfill({ status: 400, json: { ok: false, error: e.message } }); }
  });
  return llamadas;
}

// Entrar como el cliente: categoría "Sorteos y premios" → tarjeta "Atrapa tu Premio"
async function entrar(page) {
  await page.waitForSelector('[data-portal-panel="sorteos"]:not([hidden])', { timeout: 10000 });
  await page.click('[data-portal-panel="sorteos"]');
  await page.click('.jp-entrada');
}
const resultados = [];
async function caso(nombre, fn) {
  try { await fn(); resultados.push(['OK', nombre]); console.log('✔', nombre); }
  catch (e) { resultados.push(['FALLA', nombre, e.message]); console.log('✖', nombre, '\n  ', e.message); }
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const movil = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

await caso('Móvil 3D (jp3d=1 fuerza 3D; el contenedor de pruebas tiene 2 CPU): numerito en "Sorteos y premios" → tarjeta del juego → palanca → jugar → premio revelado y guardado (1 sola jugada con doble toque)', async () => {
  const db = nuevaDb(); await J.sembrarPremios(db);
  await J.otorgarFichas(db, { clienteId: 'c1', fichas: 3, origen: 'renovacion', renovacion: { key: 'k1|x', compraId: 'k1', meses: 6 }, actor: 'sublicuentas' });
  const ctx = await browser.newContext(movil); const page = await ctx.newPage();
  const errores = []; page.on('pageerror', (e) => errores.push(e.message));
  const llamadas = await preparar(page, db, { demora: 400 });
  await page.goto(`${BASE}/c/tok-ana?jp3d=1`);
  await page.waitForSelector('.jp-badge'); assert.equal(await page.textContent('.jp-badge'), '3');
  assert.equal(await page.$('.jp-fab'), null, 'sin botón flotante');
  await page.screenshot({ path: `${OUT}/01-movil-categoria.png` });
  await page.click('[data-portal-panel="sorteos"]'); await page.waitForSelector('.jp-entrada');
  assert.match(await page.textContent('.jp-entrada'), /3 fichas/);
  await page.screenshot({ path: `${OUT}/01b-movil-tarjeta-juego.png` });
  await page.click('.jp-entrada');
  await page.waitForFunction(() => document.querySelector('.jp-root')?.dataset.motor);
  const motor = await page.evaluate(() => document.querySelector('.jp-root').dataset.motor);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/02-movil-maquina-${motor}.png` });
  await page.evaluate(() => { const b = document.querySelector('.jp-play'); b.click(); b.click(); b.click(); }); // triple toque
  // Palanca: arrastrar a la derecha y arriba; la garra se mueve y marca una cápsula
  await page.waitForSelector('.jp-mando:not([hidden])');
  const x0 = await page.evaluate(() => window.__atrapaTuPremio.estado().motor && 1);
  const caja = await page.locator('.jp-palanca').boundingBox();
  const cx = caja.x + caja.width / 2, cy = caja.y + caja.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 40, cy - 30, { steps: 5 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/03-movil-palanca.png` });
  await page.mouse.up(); assert.ok(x0);
  await page.click('.jp-soltar');
  await page.waitForTimeout(2400);
  await page.screenshot({ path: `${OUT}/03b-movil-agarrando.png` });
  await page.waitForTimeout(2300);
  await page.screenshot({ path: `${OUT}/03c-movil-capsula-abierta.png` });
  await page.waitForSelector('.jp-reveal', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/04-movil-revelacion.png` });
  assert.equal(llamadas.filter((x) => x === 'juego_jugar').length, 1, 'un solo juego_jugar');
  const ganados = await db.collection('juego_ganados').get(); assert.equal(ganados.size, 1);
  assert.match(await page.textContent('.jp-reveal'), /¡GANASTE!/); assert.match(await page.textContent('.jp-reveal'), /quedan 2/);
  await page.click('[data-r="ver"]'); await page.waitForSelector('.jp-item');
  await page.screenshot({ path: `${OUT}/05-movil-tus-premios.png` });
  assert.equal(errores.length, 0, errores.join(' | '));
  console.log('   motor usado:', motor);
  await ctx.close();
});

await caso('Recargar a mitad de la animación: no vuelve a sortear y muestra el premio ya guardado', async () => {
  const db = nuevaDb(); await J.sembrarPremios(db);
  await J.otorgarFichas(db, { clienteId: 'c1', fichas: 2, origen: 'promocion', requestId: 'p1', motivo: 'fidelidad', actor: 'sublicuentas' });
  const ctx = await browser.newContext(movil); const page = await ctx.newPage();
  const llamadas = await preparar(page, db);
  await page.goto(`${BASE}/c/tok-ana?jp25=1`); await entrar(page); await page.click('.jp-play');
  await page.waitForTimeout(900); await page.reload();
  await page.waitForSelector('.jp-reveal', { timeout: 8000 });
  assert.equal((await db.collection('juego_ganados').get()).size, 1);
  assert.equal(llamadas.filter((x) => x === 'juego_jugar').length, 1);
  assert.match(await page.textContent('.jp-reveal'), /quedan 1/);
  await ctx.close();
});

await caso('Error del servidor: la ficha sigue disponible y se muestra el mensaje', async () => {
  const db = nuevaDb(); await J.sembrarPremios(db);
  await J.otorgarFichas(db, { clienteId: 'c1', fichas: 1, origen: 'promocion', requestId: 'p2', motivo: 'compensación', actor: 'sublicuentas' });
  const ctx = await browser.newContext(movil); const page = await ctx.newPage();
  await preparar(page, db, { fallaJugar: true });
  await page.goto(`${BASE}/c/tok-ana`); await entrar(page); await page.click('.jp-play');
  await page.waitForSelector('.jp-status.err', { timeout: 8000 });
  assert.match(await page.textContent('.jp-status'), /ficha sigue disponible/);
  assert.equal(await page.isEnabled('.jp-play'), true);
  assert.equal((await db.collection('juego_ganados').get()).size, 0);
  await ctx.close();
});

await caso('Reducir movimiento → 2.5D, sin confeti y revelación rápida', async () => {
  const db = nuevaDb(); await J.sembrarPremios(db);
  await J.otorgarFichas(db, { clienteId: 'c1', fichas: 1, origen: 'promocion', requestId: 'p3', motivo: 'promo', actor: 'sublicuentas' });
  const ctx = await browser.newContext({ ...movil, reducedMotion: 'reduce' }); const page = await ctx.newPage();
  await preparar(page, db);
  await page.goto(`${BASE}/c/tok-ana`); await entrar(page);
  assert.equal(await page.evaluate(() => document.querySelector('.jp-root').dataset.motor), '25');
  const t0 = Date.now(); await page.click('.jp-play'); await page.waitForSelector('.jp-reveal', { timeout: 6000 });
  assert.ok(Date.now() - t0 < 2500, 'revelación rápida'); assert.equal(await page.$('.jp-confeti'), null);
  await page.screenshot({ path: `${OUT}/06-reduce-motion.png` });
  await ctx.close();
});

await caso('Escritorio 2.5D (jp25=1) y sin fichas: tarjeta "Ver premios"; enlace inválido: no aparece nada', async () => {
  const db = nuevaDb(); await J.sembrarPremios(db);
  await J.otorgarFichas(db, { clienteId: 'c1', fichas: 1, origen: 'promocion', requestId: 'p4', motivo: 'promo', actor: 'sublicuentas' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } }); const page = await ctx.newPage();
  await preparar(page, db);
  await page.goto(`${BASE}/c/tok-ana?jp25=1`); await entrar(page); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/07-escritorio-25d.png` });
  await page.click('.jp-play'); await page.waitForSelector('.jp-reveal', { timeout: 10000 });
  await page.screenshot({ path: `${OUT}/08-escritorio-revelacion.png` });
  await page.click('[data-r="ver"]'); await page.click('[data-jp="cerrar"]');
  await page.waitForSelector('.jp-entrada.sin-fichas'); assert.match(await page.textContent('.jp-entrada'), /Ver premios/);
  assert.equal(await page.$('.jp-badge'), null, 'sin fichas no hay numerito');
  const p2 = await ctx.newPage(); await preparar(p2, db); await p2.goto(`${BASE}/c/otro-token`); await p2.waitForTimeout(800);
  assert.equal(await p2.$('.jp-fab'), null); assert.equal(await p2.$('.jp-entrada'), null);
  await ctx.close();
});

await caso('Juego en pausa: botón JUGAR desactivado y fichas conservadas', async () => {
  const db = nuevaDb(); await J.sembrarPremios(db);
  await J.otorgarFichas(db, { clienteId: 'c1', fichas: 2, origen: 'promocion', requestId: 'p5', motivo: 'promo', actor: 'sublicuentas' });
  await J.guardarConfig(db, { activo: false }, { actor: 'sublicuentas' });
  const ctx = await browser.newContext(movil); const page = await ctx.newPage();
  await preparar(page, db);
  await page.goto(`${BASE}/c/tok-ana`); await entrar(page);
  await page.waitForSelector('.jp-play:disabled'); assert.match(await page.textContent('.jp-status'), /pausa/);
  await ctx.close();
});

await caso('Cliente sin fichas ni premios (y sin sorteo mensual): no ve la categoría ni el juego', async () => {
  const db = nuevaDb(); await J.sembrarPremios(db);
  const ctx = await browser.newContext(movil); const page = await ctx.newPage();
  await preparar(page, db);
  await page.goto(`${BASE}/c/tok-ana`); await page.waitForSelector('.portal-categories'); await page.waitForTimeout(1500);
  assert.equal(await page.isHidden('[data-portal-panel="sorteos"]'), true);
  assert.equal(await page.$('.jp-fab'), null); assert.equal(await page.$('.jp-badge'), null);
  await ctx.close();
});

await browser.close(); server.close();
const fallas = resultados.filter((r) => r[0] !== 'OK');
console.log(`\n${resultados.length - fallas.length}/${resultados.length} casos OK · capturas en ${OUT}`);
process.exit(fallas.length ? 1 : 0);
