// Arnés visual (R162): abre Sublichat HQ con Firebase y /api simulados (datos FICTICIOS) para tomar capturas
// antes/después y probar el menú por permisos. No se conecta a Firebase ni a la base real.
// Uso: node tests/visual/arnes.mjs <salida> [usuario] [ui=v1|v2] [anchos=1440,390]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { crearApp } = await import(path.join(ROOT, 'server.mjs'));

const PLATS = [['Netflix', 150], ['Disney Premium', 110], ['HBO Max', 90], ['Prime Video', 90], ['Crunchyroll', 90], ['Spotify', 70], ['YouTube Premium', 60]];
const dmy = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
export function clientesFicticios(n = 36) {
  const out = []; const hoy = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(hoy); d.setDate(d.getDate() + ((i * 5) % 40) - 8);
    const [p, precio] = PLATS[i % PLATS.length];
    out.push({ id: `c${i}`, data: { nombre: `Cliente ${String(i + 1).padStart(3, '0')}`, nombrePerfil: `Cliente ${String(i + 1).padStart(3, '0')}`, telefono: `5049${String(1000000 + i * 7).slice(0, 7)}`, vendedor: i % 3 ? 'Sublicuentas' : 'Relojes', servicios: [{ plataforma: p, fechaRenovacion: dmy(d), precio, vendedor: i % 3 ? 'Sublicuentas' : 'Relojes', correo: `cuenta${i}@ejemplo.test`, perfil: `Perfil ${1 + (i % 5)}` }] } });
  }
  return out;
}

export async function abrir({ usuario = 'naara', ui = 'v1', ancho = 1440, alto = 900, permisos = null, salida = null, salaDb = null, ahora = null, salaEnv = {}, video = null, datos = null } = {}) {
  const { crearFakeDb } = require(path.join(ROOT, 'tests/helpers/fake-firestore.cjs'));
  const dbSala = salaDb || crearFakeDb(); const salaHandler = require(path.join(ROOT, 'api/sala-juntas.js'));
  const app = await crearApp(); const srv = app.listen(0); await new Promise((r) => srv.once('listening', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1, ...(video ? { recordVideo: { dir: video, size: { width: ancho, height: alto } } } : {}) }); // R183: video opcional
  // R184 · volumen y latencia simulados para medir Inicio / Control Maestro (datos FICTICIOS; la latencia es una suposición)
  const D = datos ? { clientes: 36, inventario: 0, finanzas: 0, latFs: 0, latApi: 0, msPorDoc: 0, ...datos } : null;
  const docs = clientesFicticios(D ? D.clientes : 36);
  const invDocs = D ? Array.from({ length: D.inventario }, (_, i) => ({ id: `inv${i}`, data: { plataforma: PLATS[i % PLATS.length][0], correo: `cuenta${i}@ejemplo.test`, capacidad: 5, perfiles: [] } })) : [];
  const finDocs = D ? Array.from({ length: D.finanzas }, (_, i) => ({ id: `fin${i}`, data: { tipo: i % 4 ? 'venta' : 'egreso', monto: 100 + (i % 9) * 10, fecha: new Date(Date.now() - (i % 60) * 86400000).toISOString().slice(0, 10), banco: 'BAC' } })) : [];
  const espera = (n, extra = 0) => new Promise((ok) => setTimeout(ok, n + extra));
  const red = { fs: 0, api: 0, bytes: 0 }; if (D) globalThis.__redArnes = red;
  const fakeApp = `export const initializeApp=(c)=>({name:'[DEFAULT]',options:c});export const getApps=()=>[{}];export const getApp=()=>({name:'[DEFAULT]'});`;
  const fakeAuth = `const user={uid:'asesor-${usuario}',getIdToken:async()=>'token-ficticio',getIdTokenResult:async()=>({claims:{usuario:'${usuario}',role:'asesor'}})};
    export const getAuth=()=>({currentUser:user});export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(user),10);return()=>{}};
    export const signInWithCustomToken=async()=>({user});export const signOut=async()=>{};`;
  const fakeFs = `const DOCS=${JSON.stringify(docs)};const FIN=${JSON.stringify(finDocs)};const LAT=${D ? D.latFs : 0},MSD=${D ? D.msPorDoc : 0};const col=(n)=>n==='clientes'?DOCS:(n==='finanzas_movimientos'?FIN:[]);const esp=(n)=>new Promise(r=>setTimeout(r,LAT?LAT+col(n).length*MSD:0));window.__fsLecturas=window.__fsLecturas||[];const snap=(n)=>({docs:col(n).map(d=>({id:d.id,data:()=>d.data})),size:col(n).length,empty:!col(n).length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}});
    export const getFirestore=()=>({});export const collection=(db,n)=>({n});export const getDocs=async(r)=>{window.__fsLecturas.push(['get',r.n,performance.now()]);await esp(r.n);return snap(r.n)};export const getDocsFromServer=async(r)=>{window.__fsLecturas.push(['get',r.n,performance.now()]);await esp(r.n);return snap(r.n)};
    export const onSnapshot=(r,a,b)=>{const cb=typeof a==='function'?a:b;window.__fsLecturas.push(['live',r.n,performance.now()]);esp(r.n).then(()=>setTimeout(()=>cb(snap(r.n)),20));return()=>{}};export const doc=()=>({});export const getDoc=async()=>({exists:()=>false,data:()=>({})});`;
  await ctx.route('https://www.gstatic.com/firebasejs/**', (r) => {
    const u = r.request().url(); const body = u.includes('firebase-auth') ? fakeAuth : u.includes('firebase-firestore') ? fakeFs : fakeApp;
    r.fulfill({ status: 200, contentType: 'text/javascript', body });
  });
  await ctx.route(`${base}/api/**`, async (r) => {
    const u = new URL(r.request().url()); const nombre = u.pathname.split('/')[2];
    let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (_) {}
    if (nombre === 'permisos') {
      if (permisos === false) return r.fulfill({ json: { ok: false } });
      if (permisos === 'real') { // R180 · API real de Permisos con la misma Firestore en memoria (retirar / reactivar)
        const ph = require(path.join(ROOT, 'api/permisos.js'));
        const out = await new Promise((resolve) => { const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
          ph({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res, { auth: () => ({ verifyIdToken: async () => ({ uid: 'asesor-' + usuario, usuario, role: 'asesor' }), revokeRefreshTokens: async () => {}, updateUser: async () => {} }), db: () => dbSala, env: salaEnv }); });
        return r.fulfill({ status: out.code, json: out.body });
      }
      if (typeof permisos === 'function') return r.fulfill({ json: permisos(body) });
      const P = require(path.join(ROOT, 'api/_permisos.js')); const u = { usuario, role: 'asesor' }; const cfg = permisos || {};
      const catalogo = P.MODULOS.map(({ id, label, grupo, fijo, servidor }) => ({ id, label, grupo, fijo: !!fijo, servidor: !!servidor }));
      if (body.accion === 'listar') return r.fulfill({ json: { ok: true, catalogo, usuarios: ['sublicuentas', 'geisell', 'prueba', 'relojes'].map((x) => { const ux = { usuario: x, role: 'asesor' }; return { usuario: x, rol: P.esSupervisor(ux) ? 'Supervisor' : x === 'geisell' ? 'Admin Control' : x === 'prueba' ? 'Auditor' : 'Operativo · Finanzas', supervisor: P.esSupervisor(ux), porDefecto: P.porDefecto(ux), cambios: P.overridesDe(cfg, x), modulos: P.efectivos(ux, cfg) }; }) } });
      return r.fulfill({ json: { ok: true, usuario, supervisor: P.esSupervisor(u), modulos: P.efectivos(u, cfg), pantallas: P.pantallasVisibles(u, cfg), catalogo } });
    }
    if (nombre === 'sala-juntas') { // API real de la Sala con Firestore en memoria
      const out = await new Promise((resolve) => { const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
        salaHandler({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res, { auth: () => ({ verifyIdToken: async () => ({ uid: 'asesor-' + usuario, usuario, role: 'asesor' }) }), db: () => dbSala, env: salaEnv, fetch: async () => ({ ok: true, status: 200 }), ahora: ahora ? () => ahora : undefined }); });
      return r.fulfill({ status: out.code, json: out.body });
    }
    if (D) red.api++;
    const pagina = (lista, cursor, tam = 200) => { const i = cursor ? lista.findIndex((d) => d.id === cursor) + 1 : 0; const trozo = lista.slice(i, i + tam); return { trozo, next: i + tam < lista.length ? trozo[trozo.length - 1].id : '' }; };
    if (nombre === 'mobile-core') { if (!D) return r.fulfill({ json: { ok: true, items: [], nextCursor: '' } }); const pg = pagina(invDocs, body.cursor); await espera(D.latApi, pg.trozo.length * D.msPorDoc); return r.fulfill({ json: { ok: true, items: pg.trozo.map((d) => ({ id: d.id, ...d.data })), nextCursor: pg.next } }); }
    if (nombre === 'importar' && body.accion === 'control_datos') { const lista = body.coleccion === 'clientes' ? docs : body.coleccion === 'inventario' ? invDocs : []; if (!D) return r.fulfill({ json: { ok: true, coleccion: body.coleccion, documentos: lista.map((d) => ({ id: d.id, data: d.data })), nextCursor: '' } }); const pg = pagina(lista, body.cursor, Math.max(50, Math.min(500, Number(body.pageSize) || 200))); await espera(D.latApi, pg.trozo.length * D.msPorDoc); const json = { ok: true, coleccion: body.coleccion, documentos: pg.trozo.map((d) => ({ id: d.id, data: d.data })), nextCursor: pg.next }; red.bytes += JSON.stringify(json).length; return r.fulfill({ json }); }
    if (D) await espera(Math.round(D.latApi / 2));
    return r.fulfill({ json: { ok: true, items: [], data: [], tickets: [], avisos: [] } });
  });
  await ctx.route(/open-meteo|api\.|fonts\.g|cdn|unsplash|picsum/i, (r) => { const u = r.request().url(); if (u.startsWith(base)) return r.continue(); if (/cdnjs|jsdelivr|unpkg/.test(u)) return r.continue(); r.fulfill({ status: 200, body: '' }); });
  // three.js para la sala 3D (R169): copia local de la misma versión que pide sala-3d.js (sin red en pruebas)
  await ctx.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(ROOT, 'tests/visual/vendor/three-0.160.0.module.min.js'), 'utf8') }));
  // R173 · pdf.js (presentar PDF) servido desde una copia local de prueba
  await ctx.route('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/**', (r) => { const f = r.request().url().split('/').pop().split('?')[0]; const p = path.join(ROOT, 'tests/visual/vendor/pdfjs', f); if (!fs.existsSync(p)) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(p) }); });
  // R170 · livekit-client simulado (no se conecta a LiveKit Cloud en pruebas)
  await ctx.route('https://cdn.jsdelivr.net/npm/livekit-client@2.15.8/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(ROOT, 'tests/visual/vendor/livekit-mock.mjs'), 'utf8') }));
  await ctx.addInitScript(({ usuario, ui }) => {
    try { localStorage.setItem('sublichat_user', usuario); localStorage.setItem('sublichat_role', 'asesor'); sessionStorage.setItem('sublichat_intro_seen', '1');
      if (!sessionStorage.getItem('__arnes_ui')) { sessionStorage.setItem('__arnes_ui', '1'); if (ui === 'v2') localStorage.setItem('sublichat_ui_v2', '1'); else localStorage.removeItem('sublichat_ui_v2'); } } catch (_) {}
  }, { usuario, ui });
  const page = await ctx.newPage();
  const errores = []; page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(base + '/');
  await page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  return { page, ctx, browser, srv, errores, base, dbSala, async cerrar() { if (video) await ctx.close(); await browser.close(); srv.close(); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [salida = '/tmp/capturas', usuario = 'naara', ui = 'v1', anchos = '1440,390', pantallas = 'inicio'] = process.argv.slice(2);
  fs.mkdirSync(salida, { recursive: true });
  for (const ancho of anchos.split(',').map(Number)) {
    const h = await abrir({ usuario, ui, ancho, alto: ancho < 800 ? 844 : 900 });
    for (const s of pantallas.split(',')) {
      await h.page.evaluate((s) => window.subliRBAC && window.subliRBAC.go(s), s).catch(() => {});
      await h.page.waitForTimeout(900);
      await h.page.screenshot({ path: path.join(salida, `${ui}-${usuario}-${ancho}-${s}.png`) });
    }
    if (h.errores.length) console.log('ERRORES', ancho, h.errores.slice(0, 5));
    await h.cerrar();
  }
}
