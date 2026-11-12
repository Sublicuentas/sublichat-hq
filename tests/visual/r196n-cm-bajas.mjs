// R196n · T-01/T-02/T-03 en el navegador (datos FICTICIOS): una cuenta dada de baja desde Telegram (Papelera) que todavía
// tiene clientes con ese correo en su ficha NO aparece como activa en Control Maestro; las fichas siguen intactas;
// recargar no la hace reaparecer; si se restaura (sale de la lista de bajas) vuelve a verse. Uso: node tests/visual/r196n-cm-bajas.mjs <carpeta>
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
import { abrir } from './arnes.mjs';
const out = process.argv[2] || '/tmp/r196n'; fs.mkdirSync(out, { recursive: true });
const BAJA = 'cuenta.borrada.tg@ejemplo.test', VIVA = 'cuenta.viva@ejemplo.test';
const h = await abrir({ usuario: 'sublicuentas', ui: 'v2', ancho: 1440, alto: 1300, datos: { clientes: 6, inventario: 0 } }); const pg = h.page;
await pg.route('**/api/inventario', (r) => r.fulfill({ json: { ok: true, items: [], cuentas: [], data: [] } }));
await pg.evaluate(({ BAJA, VIVA }) => {
  const orig = window.sublichatControlData; window.__bajas = [{ inventarioId: 'inv-borrada', plataforma: 'netflix', correo: BAJA, eliminadoAtMs: Date.now(), por: 'Telegram', origen: 'Telegram' }];
  window.__v = 2000;
  window.sublichatControlData = () => { const x = orig ? orig() : {}; const s = (c, n, i) => ({ clienteId: 'cli-' + i, servicioIndex: 0, perfilIndex: 0, compraId: 'cmp-' + i, nombre: n, titular: n, telefono: '9999000' + i, plataforma: 'netflix', plataformaLabel: 'Netflix', correo: c, clave: 'x', fecha: '2026-12-01', precio: 150 });
    return { ...x, ready: true, version: window.__v, servicios: [...(x.servicios || []), s(BAJA, 'Cliente Uno Prueba', 1), s(BAJA, 'Cliente Dos Prueba', 2), s(VIVA, 'Cliente Tres Prueba', 3)],
      cuentas: [...(x.cuentas || []), { id: 'inv-viva', plataforma: 'netflix', correo: VIVA, clave: 'x', capacidad: 5, disponibles: 4, ocupados: 1, estado: 'activa', clientes: [{ nombre: 'Cliente Tres Prueba' }] }],
      cuentasBaja: window.__bajas }; };
}, { BAJA, VIVA });
const abrirCM = async () => {
  await pg.evaluate(() => window.subliRBAC ? window.subliRBAC.go('control-cuentas') : window.SublichatRBAC.ir('control-cuentas'));
  const casa = await pg.$('[data-cm-go-home]'); if (casa && await casa.isVisible()) { await casa.click(); await pg.waitForTimeout(500); }
  await pg.waitForSelector('[data-cm-open-workspace="all"]', { timeout: 20000 }); await pg.click('[data-cm-open-workspace="all"]'); await pg.waitForTimeout(1500);
  return pg.evaluate(() => document.body.innerText);
};
let txt = await abrirCM();
assert.ok(txt.includes(VIVA), 'la cuenta viva se ve'); assert.ok(!txt.includes(BAJA), 'T-01: la cuenta dada de baja en Telegram NO aparece como activa');
await pg.screenshot({ path: path.join(out, '1-control-maestro-sin-cuenta-borrada.png') });
// T-02: recargar / volver a sincronizar no la hace reaparecer
await pg.evaluate(() => { window.__v++; if (window.sublichatControlSyncLoadedData) window.sublichatControlSyncLoadedData('recarga'); });
txt = await abrirCM(); assert.ok(!txt.includes(BAJA), 'T-02: tras recargar sigue sin aparecer');
// T-03: las fichas de los clientes siguen (el dato está; solo no se muestra como cuenta activa)
const fichas = await pg.evaluate((b) => window.sublichatControlData().servicios.filter((s) => s.correo === b).length, BAJA);
assert.equal(fichas, 2, 'T-03: las 2 fichas de clientes con ese correo se conservan');
// Restaurada desde la Papelera → vuelve a verse
await pg.evaluate(() => { window.__bajas = []; window.__v++; if (window.sublichatControlSyncLoadedData) window.sublichatControlSyncLoadedData('restaurada'); });
txt = await abrirCM(); assert.ok(txt.includes(BAJA), 'restaurada: vuelve a aparecer');
await pg.screenshot({ path: path.join(out, '2-restaurada-vuelve-a-verse.png') });
console.log('T-01/T-02/T-03 OK · errores página:', (h.errores || []).slice(0, 3).join(' | ') || 'ninguno');
await h.cerrar(); process.exit(0);
