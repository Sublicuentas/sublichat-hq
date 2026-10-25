// R154 · e2e administración "Atrapa tu Premio" (juego-premio-admin.js) con el MOTOR REAL sobre Firestore simulado.
// Uso: node tests/e2e/r154-atrapa-premio-admin.e2e.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as J from '../../api/_juego-premios.js';
import { fakeFirestore } from '../helpers/fake-firestore.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = process.env.E2E_OUT || path.join(root, 'tests/e2e/capturas');
fs.mkdirSync(OUT, { recursive: true });
const HOY = J.hoyDMY();

const PAGINA = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/sorteos-admin.css"><link rel="stylesheet" href="/juego-premio-admin.css">
<style>body{margin:0;background:#F4F6F9;font-family:Inter,Arial,sans-serif}.sr-admin{padding:14px}</style></head>
<body><div class="sr-admin"><section id="srBody"></section><div class="sr-status" id="srStatus"></div></div>
<script>
// Igual que sublichat-app.js (módulo): DATA no es global; se lee por window.__sublichatClientes
const __D=[
 {clienteId:'c1',nombre:'Ana López',telefono:'+504 9999-1111',plataforma:'Spotify',beneficiarioKey:'titular',beneficiarioTipo:'titular',compraId:'k1'},
 {clienteId:'c1',nombre:'Ana López',telefono:'+504 9999-1111',plataforma:'LatinTV',beneficiarioKey:'titular',beneficiarioTipo:'titular',compraId:'k2'},
 {clienteId:'c2',nombre:'Carlos Mejía',telefono:'+1 305 555 0101',plataforma:'Max',beneficiarioKey:'titular',beneficiarioTipo:'titular',compraId:'m1'},
 {clienteId:'c2',nombre:'Carlos Mejía',telefono:'+1 305 555 0101',plataforma:'Spotify',beneficiarioKey:'tercero-heber',beneficiarioTipo:'tercero',beneficiarioNombre:'Héber Díaz',compraId:'m2'}];
Object.defineProperty(window,'__sublichatClientes',{get:()=>__D});
window.toasts=[];window.mostrarToast=t=>window.toasts.push(t);
</script><script src="/juego-premio-admin.js"></script>
<script>const st=(m,t)=>{const e=document.getElementById('srStatus');e.textContent=m;e.className='sr-status '+(t||'');};
window.SublichatJuegoAdmin.render(document.getElementById('srBody'),{status:st});</script></body></html>`;

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGINA); }
  const f = path.join(root, u.pathname);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': f.endsWith('.css') ? 'text/css' : 'text/javascript' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

function nuevaDb() {
  return fakeFirestore({
    clientes: {
      c1: { nombrePerfil: 'Ana López', servicios: [{ compraId: 'k1', plataforma: 'spotify', fechaRenovacion: J.sumarDiasDMY(HOY, 30) }, { compraId: 'k2', plataforma: 'latintv1', fechaRenovacion: J.sumarDiasDMY(HOY, 200) }] },
      c2: { nombrePerfil: 'Carlos Mejía', servicios: [{ compraId: 'm1', plataforma: 'hbomax', fechaRenovacion: J.sumarDiasDMY(HOY, 12) }] },
    },
    inventario: { i1: { plataforma: 'crunchyroll', capacidad: 5, clientes: [] } },
  });
}
async function preparar(page, db, { kind = 'admin', actor = 'sublicuentas' } = {}) {
  const llamadas = [];
  await page.route('**/api/sorteos', async (r) => {
    const b = r.request().postDataJSON() || {}; llamadas.push(b);
    const ok = (x) => r.fulfill({ json: { ok: true, ...x } });
    const soloAdmin = () => { if (kind !== 'admin') throw Object.assign(new Error('Solo Sublicuentas puede cambiar la configuración del juego.'), { status: 403 }); };
    try {
      if (b.accion === 'juego_cargar') { await J.sembrarPremios(db); return ok({ ...(await J.cargarAdmin(db)), permisos: { config: kind === 'admin' } }); }
      if (b.accion === 'juego_guardar_config') { soloAdmin(); return ok({ config: await J.guardarConfig(db, b.config, { actor }) }); }
      if (b.accion === 'juego_guardar_premio') { soloAdmin(); return ok({ premio: await J.guardarPremio(db, b.premio, { actor }) }); }
      if (b.accion === 'juego_dar_fichas') return ok({ lote: await J.otorgarFichas(db, { ...b, actor }) });
      if (b.accion === 'juego_entregar') return ok({ ganado: b.modo === 'reintentar' ? await J.entregarAutomatico(db, b.id, { actor }) : await J.marcarEntregado(db, b.id, { actor, nota: b.nota }) });
      return r.fulfill({ status: 400, json: { ok: false, error: 'acción' } });
    } catch (e) { return r.fulfill({ status: e.status || 400, json: { ok: false, error: e.message } }); }
  });
  return llamadas;
}
const resultados = [];
async function caso(nombre, fn) {
  try { await fn(); resultados.push(['OK', nombre]); console.log('✔', nombre); }
  catch (e) { resultados.push(['FALLA', nombre, e.message]); console.log('✖', nombre, '\n  ', e.message); }
}
const browser = await chromium.launch();

await caso('Admin web: KPIs, tabla de premios, dar fichas manuales (motivo obligatorio, doble clic = 1 lote)', async () => {
  const db = nuevaDb();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('dialog', (d) => d.accept('perfil 2 cuenta Crunchy'));
  const llamadas = await preparar(page, db);
  await page.goto(BASE); await page.waitForSelector('.jpa-tabla');
  assert.equal(await page.locator('.jpa-tabla tbody tr').count(), 11);
  assert.doesNotMatch(await page.textContent('.jpa-tabla'), /netflix/i);
  await page.screenshot({ path: `${OUT}/10-admin-web.png`, fullPage: true });
  await page.click('#jpaDar'); await page.fill('#jpaBuscar', 'heber');
  assert.match(await page.textContent('#jpaRes'), /Héber Díaz \(de Carlos Mejía\)/, 'busca beneficiario sin tilde');
  await page.fill('#jpaBuscar', '9999'); assert.match(await page.textContent('#jpaRes'), /Ana López/, 'busca por teléfono');
  await page.fill('#jpaBuscar', 'ana');
  await page.click('#jpaRes [data-i="0"]'); await page.click('#jpaNum [data-n="3"]');
  await page.click('#jpaSi'); assert.match(await page.textContent('#jpaMsg'), /motivo/);
  await page.selectOption('#jpaOrigen', 'compensacion'); await page.fill('#jpaMotivo', 'Error en entrega del 20/10');
  await page.screenshot({ path: `${OUT}/11-admin-dar-fichas.png` });
  await page.evaluate(() => { const b = document.querySelector('#jpaSi'); b.click(); b.click(); });
  await page.waitForFunction(() => /fichas activas/.test(document.body.textContent) && document.querySelector('.jpa-kpis b')?.textContent === '3');
  assert.equal((await db.collection('juego_lotes').get()).size, 1);
  const lote = (await db.collection('juego_lotes').get()).docs[0].data();
  assert.equal(lote.origen, 'compensacion'); assert.equal(lote.otorgadoPor, 'sublicuentas'); assert.equal(lote.fichas, 3);
  assert.ok(llamadas.filter((x) => x.accion === 'juego_dar_fichas').length <= 2);
  await page.close();
});

await caso('Admin: editar peso/stock de un premio, reglas por lote y pausar el juego (auditoría)', async () => {
  const db = nuevaDb();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('dialog', (d) => d.accept());
  await preparar(page, db);
  await page.goto(BASE); await page.waitForSelector('.jpa-tabla');
  const fila = page.locator('[data-jpa-premio="canva"]');
  await fila.locator('[data-f="peso"]').fill('20'); await fila.locator('[data-f="stock"]').fill('3');
  await fila.locator('[data-jpa-gp]').click();
  await page.waitForFunction(() => /guardado/.test(document.getElementById('srStatus').textContent));
  const canva = (await db.collection('juego_premios').doc('canva').get()).data();
  assert.equal(canva.peso, 20); assert.equal(canva.stock, 3);
  await page.fill('#jpaTope', '150'); await page.click('#jpaGuardarCfg');
  await page.waitForFunction(() => /Reglas guardadas/.test(document.getElementById('srStatus').textContent));
  assert.equal((await db.collection('juego_config').doc('global').get()).data().topeCostoLote, 150);
  await page.click('.jpa-switch');
  await page.waitForFunction(() => /pausa/.test(document.getElementById('srStatus').textContent));
  const cfg = (await db.collection('juego_config').doc('global').get()).data();
  assert.equal(cfg.activo, false); assert.equal(cfg.topeCostoLote, 150, 'pausar no borra las reglas');
  const audit = (await db.collection('auditoria_eventos').get()).docs.map((d) => d.data().tipo);
  assert.ok(audit.includes('juego_premio_editado') && audit.includes('juego_config'));
  await page.close();
});

await caso('Pendientes: premio nuevo reservado → "Marcar entregado" con nota libera el cupo', async () => {
  const db = nuevaDb(); await J.sembrarPremios(db);
  for (const id of ['saldo10', 'desc20', 'dias3', 'dias5', 'saldo50', 'canva', 'duolingo', 'spotify', 'prime', 'max']) await J.guardarPremio(db, { ...J.PREMIOS_INICIALES.find((p) => p.id === id), activo: false });
  const { loteId } = await J.otorgarFichas(db, { clienteId: 'c2', fichas: 1, origen: 'promocion', requestId: 'x1', motivo: 'promo', actor: 'relojes' });
  await J.jugar(db, { clienteId: 'c2', fichaId: `${loteId}_1` }); // Crunchyroll nuevo → reservado
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  page.on('dialog', (d) => d.accept('perfil 2 cuenta Crunchy'));
  await preparar(page, db, { kind: 'relojes', actor: 'relojes' });
  await page.goto(BASE); await page.waitForSelector('[data-jpa-ent]');
  assert.equal(await page.isDisabled('#jpaActivo'), true, 'Relojes no cambia la configuración');
  assert.equal(await page.isDisabled('[data-jpa-premio="canva"] [data-f="peso"]'), true);
  await page.screenshot({ path: `${OUT}/12-admin-movil-pendiente.png`, fullPage: true });
  await page.click('[data-jpa-ent]');
  await page.waitForFunction(() => /entregado/.test(document.getElementById('srStatus').textContent));
  const g = (await db.collection('juego_ganados').doc(`${loteId}_1`).get()).data();
  assert.equal(g.estado, 'entregado'); assert.equal(g.entrega.nota, 'perfil 2 cuenta Crunchy'); assert.equal(g.reservaBodega, '');
  await page.close();
});

await caso('Después de renovar con pago: modal con fichas sugeridas por meses; reabrir la misma renovación no duplica', async () => {
  const db = nuevaDb();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await preparar(page, db);
  await page.goto(BASE); await page.waitForSelector('.jpa-tabla');
  const ofrecer = (dur) => page.evaluate((dur) => window.SublichatJuegoAdmin.ofrecerTrasRenovar({
    g: { clienteId: 'c1', nombre: 'Ana López' }, duracion: dur, pagoOperacionId: 'op-1',
    confirmadas: [{ servicio: { compraId: 'k2', beneficiarioKey: 'titular' }, resultado: { compraId: 'k2', fechaAnterior: '01/11/2026', fechaNueva: '01/11/2027' } }],
  }), dur);
  await ofrecer({ unidad: 'meses', cantidad: 12 });
  await page.waitForSelector('#jpaDarForm');
  assert.match(await page.textContent('.jpa-ren'), /12 mes\(es\) → sugerido 4/);
  assert.equal(await page.textContent('#jpaNum .on'), '4 ★');
  await page.screenshot({ path: `${OUT}/13-renovacion-dar-fichas.png` });
  await page.click('#jpaSi'); await page.waitForSelector('#jpaDarForm', { state: 'detached' });
  await ofrecer({ unidad: 'meses', cantidad: 12 }); await page.click('#jpaSi'); await page.waitForSelector('#jpaDarForm', { state: 'detached' });
  const toasts = await page.evaluate(() => window.toasts);
  assert.match(toasts.at(-1), /no se duplicaron/);
  assert.equal((await db.collection('juego_fichas').get()).size, 4);
  const lote = (await db.collection('juego_lotes').get()).docs[0].data();
  assert.equal(lote.origen, 'renovacion'); assert.equal(lote.renovacion.meses, 12); assert.equal(lote.fichasSugeridas, 4);
  // +31 días (sin unidad meses) → 1 mes → 1 ficha sugerida
  await page.evaluate(() => window.SublichatJuegoAdmin.ofrecerTrasRenovar({ g: { clienteId: 'c2', nombre: 'Carlos' }, duracion: { unidad: 'dias', cantidad: 31 },
    confirmadas: [{ servicio: { compraId: 'm1' }, resultado: { compraId: 'm1', fechaAnterior: '10/11/2026', fechaNueva: '11/12/2026' } }] }));
  assert.equal(await page.textContent('#jpaNum .on'), '1 ★');
  await page.click('#jpaNo'); await page.close();
});

await browser.close(); server.close();
const fallas = resultados.filter((r) => r[0] !== 'OK');
console.log(`\n${resultados.length - fallas.length}/${resultados.length} casos OK · capturas en ${OUT}`);
process.exit(fallas.length ? 1 : 0);
