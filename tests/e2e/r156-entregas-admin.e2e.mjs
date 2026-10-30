// R156 · e2e Sublichat HQ → Catálogo Socios: Entregas por renglón, Buzón de socios y Entregas antiguas.
// La interfaz real (revendedores-admin.js) habla con las rutas REALES del Panel API (rev_entregas_api.js del bot)
// sobre un Firestore en memoria. Datos ficticios; no crea ventas.
// Uso: BOT_DIR=../sublicuentas-tg-bot node tests/e2e/r156-entregas-admin.e2e.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BOT_DIR = path.resolve(root, process.env.BOT_DIR || '../bot');
const express = require(path.join(BOT_DIR, 'node_modules/express'));
const { FakeDb } = require(path.join(BOT_DIR, 'tests/helpers/fake-firestore.js'));
const CS = require(path.join(BOT_DIR, 'lib_compra_socios.js'));
const OUT = process.env.E2E_OUT || path.join(root, 'tests/e2e/capturas');
fs.mkdirSync(OUT, { recursive: true });
const norm = (v) => String(v || '').toLowerCase().trim();

async function backend() {
  const db = new FakeDb(), app = express(); app.use(express.json());
  const revAdminAuth = (req, res, next) => { req.admin = { nombre: 'Admin', permissions: ['*'] }; next(); };
  require(path.join(BOT_DIR, 'rev_entregas_api.js')).registrar(app, {
    db, revAuth: (q, r, n) => { q.rev = { id: 'jimena', nombre_norm: 'jimena' }; n(); }, revAdminAuth, adminAnyPermission: () => (q, r, n) => n(), isFullAdmin: () => true, adminScopeProfile: () => 'sublicuentas',
    revLiveProfile: async (rev) => { const s = await db.collection('revendedores').doc(rev.id).get(); return { id: rev.id, ...(s.data() || {}) }; },
    revSocioAliases: (live) => [norm(live.nombre_norm || live.id)], revNormKey: norm,
    revFiltrarClientePorAliases: (c, a) => ({ ...c, servicios: (c.servicios || []).filter((x) => a.includes(norm(x.vendedor))) }),
    destinoInfo: (d) => ({ key: d || 'sublicuentas', label: '🟣 Sublicuentas' }), getDestinoChatIds: async () => ['900001'], bot: { getMe: async () => ({ username: 'SubliBotPrueba' }) },
    env: { ENTREGAS_CODIGOS_KEY: crypto.randomBytes(32).toString('base64'), SOCIOS_PANEL_URL: 'https://socios.ejemplo.test' },
  });
  // /rev/admin/compras vive en server_api.js: aquí se arma igual (campos que usa la tarjeta).
  app.get('/rev/admin/compras', async (req, res) => { const s = await db.collection('compras').get(); res.json(s.docs.map((d) => { const x = d.data(); return { id: d.id, ...x, ts: Date.now(), entregaResumen: CS.pedidoPublico(d.id, x).entregaResumen, historicoAnterior: CS.pedidoPublico(d.id, x).historicoAnterior }; })); });
  app.get('/rev/admin/precios', (q, r) => r.json([]));
  await db.collection('revendedores').doc('jimena').set({ nombre: 'Jimena', nombre_norm: 'jimena', telegramId: '700001', activo: true });
  await db.collection('clientes').doc('cli_juan').set({ nombre: 'Juan Pérez', telefono: '+50499998888', servicios: [
    { plataforma: 'Netflix', compraId: 'svc_nf', vendedor: 'jimena', fechaRenovacion: '30/11/2026' }, { plataforma: 'Prime Video', compraId: 'svc_pv', vendedor: 'jimena', fechaRenovacion: '30/11/2026' }] });
  await db.collection('compras').doc('web_juan2026A1').set({ version: 2, socio: 'Jimena', socio_norm: 'jimena', destino: 'sublicuentas', destinoLabel: '🟣 Sublicuentas', estado: 'pendiente', servicio: 'Combo 2 plataformas',
    clientePrincipal: { nombre: 'Juan', apellido: 'Pérez' }, productos: [{ renglonId: 'r1', servicio: 'Netflix · 1 perfil', clienteNombre: 'Juan Pérez', dispositivo: '📺 TV', modalidad: 'perfil' }, { renglonId: 'r2', servicio: 'Prime Video', clienteNombre: 'Juan Pérez', dispositivo: '📱 Celular', modalidad: 'perfil' }],
    monto: 190, banco: 'BAC', imagenUrl: 'x', pagoRevision: { motivo: 'posible_comprobante_repetido', pedidoRelacionadoRef: 'ABC123' }, createdAt: new Date() });
  await db.collection('compras').doc('viejoMaria01').set({ socio_norm: 'jimena', socio: 'Jimena', estado: 'entregado', servicio: 'Gemini', cliente: 'María Ruiz', productos: [{ servicio: 'Gemini', nombreCliente: 'María Ruiz' }], estadoHistorial: [{ estado: 'entregado', at: '2026-05-02T10:00:00Z' }] });
  const srv = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  return { db, srv, base: `http://127.0.0.1:${srv.address().port}` };
}

const PAGINA = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/catalogo-relojes-admin.css">
<style>body{margin:0;background:#F4F6F9;font-family:Inter,Arial,sans-serif;padding:14px}</style></head><body><section id="screen-revendedores" class="active"><div id="rbac-revendedores"></div></section>
<script src="/revendedores-admin.js"></script></body></html>`;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGINA); }
  const f = path.join(root, u.pathname);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': f.endsWith('.css') ? 'text/css' : 'text/javascript' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const resultados = [];
async function caso(nombre, fn) { try { await fn(); resultados.push(['OK', nombre]); console.log('✔', nombre); } catch (e) { resultados.push(['FALLA', nombre, e.message]); console.log('✖', nombre, '\n  ', e.message.split('\n').slice(0, 4).join('\n   ')); } }
async function abrir(B, viewport = { width: 1366, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage(); const errores = []; page.on('pageerror', (e) => errores.push(e.message));
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Pago rechazado por el banco' : undefined));
  // El puente /api/revendedores-admin reenvía ?ruta=… a /rev/admin/… con el usuario real como actor.
  await page.route('**/api/revendedores-admin?**', async (route) => {
    const req = route.request(), u = new URL(req.url()), ruta = u.searchParams.get('ruta'); u.searchParams.delete('ruta'); u.searchParams.delete('_ts');
    const r = await fetch(`${B.base}/rev/admin/${ruta}?${u.searchParams}`, { method: req.method(), headers: { 'Content-Type': 'application/json', 'X-Sublichat-Actor': 'naara' }, body: ['GET', 'DELETE'].includes(req.method()) ? undefined : req.postData() || undefined });
    route.fulfill({ status: r.status, contentType: 'application/json', body: await r.text() });
  });
  await page.goto(BASE); await page.waitForSelector('[data-rtab="pedidos"]');
  return { ctx, page, errores };
}

await caso('Entregas: preparar → vincular ficha → revisar → publicar renglón 1 (parcial) → renglón 2 (entregado); doble clic sin duplicar; reenviar y revocar', async () => {
  const B = await backend(); const { ctx, page, errores } = await abrir(B);
  await page.click('[data-rtab="pedidos"]'); await page.waitForSelector('[data-pedido-entregas="web_juan2026A1"]');
  assert.match(await page.textContent('.order-card'), /Posible comprobante repetido/);
  await page.click('[data-pedido-entregas="web_juan2026A1"]'); await page.waitForSelector('[data-rid="r1"] [data-ent="form"]');
  await page.click('[data-rid="r1"] [data-ent="form"]');
  await page.fill('[data-rid="r1"] [data-ef="q"]', 'Juan'); await page.waitForSelector('[data-rid="r1"] [data-ent="elegir-ficha"]');
  await page.click('[data-rid="r1"] [data-ent="elegir-ficha"][data-sid="svc_nf"]');
  await page.check('[data-rid="r1"] [data-ef="portalAutorizado"]');
  await page.fill('[data-rid="r1"] [data-ef="mensajeCliente"]', 'Hola Juan, su Netflix está listo.');
  assert.equal(await page.isDisabled('[data-rid="r1"] [data-ent="publicar"]'), true, 'publicar exige revisar antes');
  await page.click('[data-rid="r1"] [data-ent="revisar"]'); await page.waitForSelector('[data-rid="r1"] [data-ent="publicar"]:not([disabled])');
  assert.match(await page.textContent('[data-rid="r1"]'), /Pedido #JUAN2026A1|Pedido #2026A1/);
  assert.match(await page.textContent('[data-rid="r1"]'), /Telegram:[\s\S]*disponible/);
  await page.screenshot({ path: path.join(OUT, 'r156-admin-revisar-entrega.png'), fullPage: false });
  await page.dblclick('[data-rid="r1"] [data-ent="publicar"]');
  await page.waitForFunction(() => /Publicada · v1/.test(document.querySelector('[data-rid="r1"]')?.textContent || ''));
  assert.match(await page.textContent('.cr-sheet'), /Entrega parcial · 1 de 2 servicios/);
  const avisos = Object.keys(B.db.dump('telegram_outbox')); assert.equal(avisos.length, 1, 'un aviso por versión aunque se toque dos veces');
  await page.click('[data-rid="r2"] [data-ent="form"]'); await page.click('[data-rid="r2"] [data-ent="revisar"]'); await page.waitForSelector('[data-rid="r2"] [data-ent="publicar"]:not([disabled])');
  await page.click('[data-rid="r2"] [data-ent="publicar"]'); await page.waitForFunction(() => /Entregado al socio/.test(document.querySelector('.cr-sheet .cr-badge')?.textContent || ''));
  assert.equal(B.db.dump('compras').web_juan2026A1.estado, 'entregado');
  await page.screenshot({ path: path.join(OUT, 'r156-admin-entregas-publicadas.png'), fullPage: false });
  await page.click('[data-rid="r1"] [data-ent="reenviar"]'); await page.waitForFunction(() => /reenvío 1/.test(document.querySelector('[data-rid="r1"]')?.textContent || ''));
  await page.click('[data-rid="r2"] [data-ent="revocar"]'); await page.waitForFunction(() => /Acceso revocado/.test(document.querySelector('[data-rid="r2"]')?.textContent || ''));
  assert.equal(B.db.dump('entregas_socios').ent_web_juan2026A1_r2.motivoRevocacion, 'Pago rechazado por el banco');
  const ver = Object.values(B.db.dump('entregas_socios/ent_web_juan2026A1_r1/versiones'));
  assert.ok(ver.some((v) => v.accion === 'publicar' && /naara/.test(v.actor)), 'auditoría con el usuario de Sublichat');
  assert.deepEqual(errores, []); await ctx.close(); B.srv.close();
});

await caso('Buzón de socios: hilo con nota interna (no sale) y respuesta (sale por Telegram)', async () => {
  const B = await backend();
  const r = await fetch(`${B.base}/rev/consultas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asunto: 'Prime no abre', texto: 'Mi cliente no ve Prime en el celular', pedidoId: 'web_juan2026A1', opId: 'c1' }) }).then((x) => x.json());
  const { ctx, page, errores } = await abrir(B);
  await page.click('[data-rtab="buzon"]'); await page.waitForSelector('[data-bzsel]');
  await page.click('[data-bzsel]'); await page.waitForSelector('#bzTxt');
  await page.fill('#bzTxt', 'Revisar si tiene la app actualizada'); await page.check('#bzInt'); await page.click('#bzSend');
  await page.waitForFunction(() => /Nota interna/.test(document.body.textContent));
  await page.fill('#bzTxt', 'Pídale que actualice la app y vuelva a entrar.'); await page.click('#bzSend');
  await page.waitForFunction(() => /actualice la app/.test(document.body.textContent));
  await page.screenshot({ path: path.join(OUT, 'r156-admin-buzon.png'), fullPage: false });
  const salidas = Object.keys(B.db.dump('telegram_outbox')).filter((k) => k.endsWith('_so'));
  assert.equal(salidas.length, 1, 'solo la respuesta (no la nota interna) va al socio');
  assert.equal(B.db.dump('buzon_consultas')[r.consulta.id].estado, 'esperando_socio');
  assert.deepEqual(errores, []); await ctx.close(); B.srv.close();
});

await caso('Entregas antiguas: simular, importar un socio (oculto, sin avisos), habilitar y revertir', async () => {
  const B = await backend(); const { ctx, page, errores } = await abrir(B);
  await page.click('[data-rtab="historial"]'); await page.click('#hsSim'); await page.waitForSelector('#hsUno');
  assert.match(await page.textContent('#hsOut'), /Encontradas\s*1/);
  await page.screenshot({ path: path.join(OUT, 'r156-admin-historial-simulacion.png'), fullPage: false });
  assert.equal(Object.keys(B.db.dump('entregas_socios')).length, 0, 'simular no escribe');
  await page.click('#hsUno'); await page.waitForSelector('[data-hs="habilitar"]');
  const imp = Object.values(B.db.dump('entregas_socios'));
  assert.equal(imp.length, 1); assert.equal(imp[0].visibleSocio, false); assert.equal(Object.keys(B.db.dump('telegram_outbox')).length, 0);
  await page.click('[data-hs="habilitar"]'); await page.waitForFunction(() => /Visible para los socios/.test(document.getElementById('hsLotes').textContent));
  assert.equal(Object.values(B.db.dump('entregas_socios'))[0].visibleSocio, true);
  await page.click('[data-hs="revertir"]'); await page.waitForFunction(() => /Revertido/.test(document.getElementById('hsLotes').textContent));
  assert.equal(Object.keys(B.db.dump('entregas_socios')).length, 0);
  assert.equal(B.db.dump('compras').viejoMaria01.estado, 'entregado', 'la fuente original no se toca');
  assert.deepEqual(errores, []); await ctx.close(); B.srv.close();
});

await caso('Puente HQ: solo recursos permitidos (entregas, consultas) y actor de Sublichat en la cabecera', async () => {
  const src = fs.readFileSync(path.join(root, 'api/revendedores-admin.js'), 'utf8');
  assert.match(src, /"compras", "entregas", "consultas"\]/); assert.match(src, /"X-Sublichat-Actor": actor/);
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /revendedores-admin\.js\?v=20261030-r156/);
});

await browser.close(); server.close();
const fallas = resultados.filter((r) => r[0] !== 'OK');
console.log(`\n${resultados.length - fallas.length}/${resultados.length} casos OK · capturas en ${OUT}`);
process.exit(fallas.length ? 1 : 0);
