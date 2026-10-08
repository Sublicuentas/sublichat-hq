import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cycleTotals, bankBalances, publicMethods, anuladoOReversa } from '../api/_finanzas-libro.js';

const dia = [
  { tipo: 'ingreso', monto: 6269, fechaPago: '2026-10-01', bancoId: 'bac' },
  { tipo: 'ingreso', monto: 270, fechaPago: '2026-10-01', bancoId: 'bac', estadoFinanciero: 'anulado' },
  { tipo: 'egreso', monto: 224, fechaPago: '2026-10-01', bancoId: 'bac' },
];
const reversa = { tipo: 'ingreso', monto: -270, fechaPago: '2026-10-07', bancoId: 'bac', reversaDe: 'x' };

test('R125: el cierre del 01/10 ya no suma el voucher anulado (antes L270 de más hasta incluir el día de la anulación)', () => {
  assert.equal(cycleTotals(dia, '2026-10-01', '2026-10-01').ingresos, 6269);
  assert.equal(cycleTotals([...dia, reversa], '2026-10-01', '2026-10-07').ingresos, 6269);
  assert.equal(cycleTotals([...dia, reversa], '2026-10-07', '2026-10-07').ingresos, 0, 'la reversa ya no resta el día que se anuló');
  assert.equal(anuladoOReversa({ estadoFinanciero: 'corregido' }), true);
  assert.equal(anuladoOReversa({ tipo: 'ingreso' }), false);
});

test('R125: saldo de bancos igual que antes (anulado + reversa se cancelaban); ingresos del banco sin inflar', () => {
  const methods = publicMethods([{ id: 'bac', nombre: 'BAC', logoKey: 'bac' }]);
  const b = bankBalances([...dia, reversa], { bases: {} }, methods).bancos.find((x) => x.id === 'bac');
  assert.equal(b.saldo, 6269 - 224); assert.equal(b.ingresos, 6269);
});

test('R125 web: Control financiero filtra anulados, reversas, transferencias, saldos/ajustes y copias viejas desde el 01/10', () => {
  const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  const src = ['finYmdR125', 'finVigenteR125'].map((n) => { const i = app.indexOf(`function ${n}(`); let d = 0; const j = app.indexOf('{', app.indexOf(')', i)); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}') { d--; if (!d) return app.slice(i, k + 1); } } }).join('\n');
  const vig = new Function(`${src}; return finVigenteR125;`)();
  assert.equal(vig({ tipo: 'ingreso', monto: 100, fecha: '01/10/2026' }), true);
  assert.equal(vig({ tipo: 'ingreso', estadoFinanciero: 'anulado' }), false);
  assert.equal(vig({ tipo: 'ingreso', reversaDe: 'x' }), false);
  assert.equal(vig({ tipo: 'transferencia' }), false);
  assert.equal(vig({ tipo: 'ajuste_saldo', subtipo: 'ajuste_saldo' }), false);
  assert.equal(vig({ tipo: 'ingreso', _source: 'finanzas', fecha: '01/10/2026' }), false);
  assert.equal(vig({ tipo: 'ingreso', _source: 'finanzas', fecha: '30/09/2026' }), true, 'el histórico anterior sigue');
  assert.match(app, /FINANZAS=\[\.\.\.finPorId\.values\(\)\]\.filter\(finVigenteR125\);/);
});

test('R126: el servidor manda la plataforma sin ⭐ (APK y web la muestran limpia)', () => {
  const src = fs.readFileSync(new URL('../api/finanzas.js', import.meta.url), 'utf8');
  const i = src.indexOf('function sinAdornosR126('); const fn = new Function(`${src.slice(i, src.indexOf('\n', i))}; return sinAdornosR126;`)();
  assert.equal(fn('⭐ Netflix Premium VIP'), 'Netflix Premium VIP');
  assert.equal(fn('Disney Premium + ⭐ Netflix Premium VIP'), 'Disney Premium + Netflix Premium VIP');
  assert.equal(fn('Canva · 1 mes'), 'Canva · 1 mes');
  assert.match(src, /plataforma: sinAdornosR126\(m\.plataforma\),/);
});

test('R127: un pago vigente nunca se junta con uno anulado (Yelson: 75 anulado + 75 vigente ≠ "150 anulado")', () => {
  const src = fs.readFileSync(new URL('../api/finanzas.js', import.meta.url), 'utf8');
  const i = src.indexOf('function agruparPagos('); let d = 0; const j = src.indexOf('{', src.indexOf(')', i)); let fin = j;
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) { fin = k; break; } } }
  const agrupar = new Function('money', `${src.slice(i, fin + 1)}; return agruparPagos;`)((n) => Math.round(Number(n || 0) * 100) / 100);
  const base = { kind: 'ingreso', cliente: 'Yelson Toledo', bancoId: 'bac', usuario: 'Sublicuentas', fecha: '2026-10-04', plataforma: 'Crunchyroll' };
  const out = agrupar([{ ...base, id: 'a', monto: 75, createdAt: '2026-10-04T18:00:00Z', estadoFinanciero: 'anulado' }, { ...base, id: 'b', monto: 75, createdAt: '2026-10-04T18:02:00Z' }]);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((x) => [x.monto, x.estadoFinanciero || 'vigente']), [[75, 'anulado'], [75, 'vigente']]);
  const dos = agrupar([{ ...base, id: 'c', monto: 75, createdAt: '2026-10-04T18:00:00Z' }, { ...base, id: 'd', monto: 75, createdAt: '2026-10-04T18:02:00Z' }]);
  assert.equal(dos.length, 1); assert.equal(dos[0].monto, 150, 'dos vigentes juntos siguen siendo un solo pago');
});

test('R128 web: movimientos tienen "Corregir monto o banco" (bancos registrados, motivo, mismo corregir_movimiento)', () => {
  const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(app, /data-fin-corregir="\$\{finEscape\(m\.id\)\}"/);
  assert.match(app, /async function finCorregirMovimientoR128\(id\)/);
  assert.match(app, /accion:"corregir_movimiento",movimientoId:id,monto,bancoId,motivo,operationId:opId,origen:"web"/);
  assert.match(app, /if\(motivo\.length<4\)return err\("Escriba el motivo de la corrección\."\);/);
});

test('R129: un cliente paga UNA vez — mismo cliente + banco + día = un pago, aunque se registre a horas distintas o por otro usuario', () => {
  const src = fs.readFileSync(new URL('../api/finanzas.js', import.meta.url), 'utf8');
  const i = src.indexOf('function agruparPagos('); let d = 0; const j = src.indexOf('{', src.indexOf(')', i)); let fin = j;
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) { fin = k; break; } } }
  const agrupar = new Function('money', `${src.slice(i, fin + 1)}; return agruparPagos;`)((n) => Math.round(Number(n || 0) * 100) / 100);
  const base = { kind: 'ingreso', clienteId: 'cli-juan', cliente: 'Juan de Dios', bancoId: 'bac', fecha: '2026-10-04', plataforma: 'Prime Video' };
  const out = agrupar([{ ...base, id: 'j1', monto: 80, usuario: 'Relojes', createdAt: '2026-10-04T15:00:00Z' }, { ...base, id: 'j2', monto: 80, usuario: 'Sublicuentas', createdAt: '2026-10-04T19:30:00Z' }]);
  assert.equal(out.length, 1); assert.equal(out[0].monto, 160); assert.deepEqual(out[0].partes, ['j1', 'j2']); assert.equal(out[0].id, 'grp:j1,j2');
  const otroBanco = agrupar([{ ...base, id: 'a', monto: 80, createdAt: '2026-10-04T15:00:00Z' }, { ...base, id: 'b', monto: 80, bancoId: 'tigo', createdAt: '2026-10-04T15:01:00Z' }]);
  assert.equal(otroBanco.length, 2, 'si entró a bancos distintos son dos pagos');
});

test('R130: el pago de varios servicios se corrige/anula/cambia de fecha COMPLETO (APK sin actualizar: id "grp:...")', async () => {
  const { __pruebas } = await import('../api/finanzas.js');
  const { handleCentro, agruparPagos } = __pruebas;
  const store = new Map();
  const ref = (c, id) => ({ id, _k: `${c}/${id}`, async get() { const d = store.get(`${c}/${id}`); return { id, exists: !!d, data: () => d }; } });
  let n = 0;
  const db = { collection: (c) => ({ doc: (id) => ref(c, id || `a${++n}`), where: () => ({ get: async () => ({ docs: [] }) }) }),
    async runTransaction(fn) { const buf = []; const tx = { get: (r) => r.get(), set: (r, d, o) => buf.push([r._k, d, o]), update: (r, d) => buf.push([r._k, d, { merge: true }]) }; const out = await fn(tx); for (const [k, d, o] of buf) store.set(k, o?.merge ? { ...(store.get(k) || {}), ...d } : d); return out; } };
  store.set('portal_cliente/configuracion', { metodos: [{ id: 'ficohsa', nombre: 'Ficohsa', logoKey: 'ficohsa', activo: true }, { id: 'bac', nombre: 'BAC Credomatic', logoKey: 'bac', activo: true }] });
  const base = { tipo: 'ingreso', subtipo: 'cobro_renovacion', clienteId: 'cli-yo', clienteNombre: 'Yohana Padilla', bancoId: 'ficohsa', banco: 'Ficohsa', fechaPago: '2026-10-05', fecha: '05/10/2026' };
  store.set('finanzas_movimientos/y1', { ...base, monto: 120, compraId: 'c1', createdAt: '2026-10-05T15:00:00Z' });
  store.set('finanzas_movimientos/y2', { ...base, monto: 120, compraId: 'c2', createdAt: '2026-10-05T18:00:00Z' });
  const view = (id) => ({ id, kind: 'ingreso', ...store.get(`finanzas_movimientos/${id}`), cliente: 'Yohana Padilla', fecha: '2026-10-05' });
  const fila = agruparPagos([view('y1'), view('y2')])[0];
  assert.equal(fila.monto, 240); assert.equal(fila.id, 'grp:y1,y2'); assert.deepEqual(fila.ids, ['grp:y1,y2']); assert.deepEqual(fila.partes, ['y1', 'y2']);
  const llamar = async (body) => { let out; const res = { status: () => ({ json: (j) => { out = j; return j; } }) }; await handleCentro(db, body.accion, body, { usuario: 'relojes', role: 'relojes' }, { uid: 'u1' }, res); return out; };
  // corregir banco y monto del pago completo
  const r = await llamar({ accion: 'corregir_movimiento', movimientoId: fila.id, monto: 260, bancoId: 'bac', motivo: 'Entró a BAC y fueron 260', operationId: 'op-grp-0001', origen: 'apk' });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.partes, 2);
  assert.equal(store.get('finanzas_movimientos/y1').estadoFinanciero, 'corregido'); assert.equal(store.get('finanzas_movimientos/y2').estadoFinanciero, 'corregido');
  const sus = [...store.entries()].filter(([k, v]) => k.startsWith('finanzas_movimientos/') && v.sustituyeA).map(([, v]) => v);
  assert.equal(sus.length, 2); assert.deepEqual(sus.map((x) => x.bancoId), ['bac', 'bac']); assert.equal(sus.reduce((a, x) => a + x.monto, 0), 260);
  assert.deepEqual(sus.map((x) => x.fechaPago), ['2026-10-05', '2026-10-05'], 'conserva la fecha real del pago');
  assert.deepEqual([...store.keys()].filter((k) => k.endsWith('_rev')).length, 2);
  assert.equal((await llamar({ accion: 'corregir_movimiento', movimientoId: fila.id, monto: 260, bancoId: 'bac', motivo: 'Entró a BAC y fueron 260', operationId: 'op-grp-0001' })).duplicado, true);
  // anular un pago agrupado completo
  store.set('finanzas_movimientos/z1', { ...base, clienteId: 'cli-z', monto: 80 }); store.set('finanzas_movimientos/z2', { ...base, clienteId: 'cli-z', monto: 80 });
  const a = await llamar({ accion: 'anular_movimiento', movimientoId: 'grp:z1,z2', motivo: 'No entró ese dinero', operationId: 'op-grp-0002' });
  assert.equal(a.ok, true); assert.equal(store.get('finanzas_movimientos/z2').estadoFinanciero, 'anulado');
  // partes de pagos distintos no se pueden mezclar
  store.set('finanzas_movimientos/w1', { ...base, clienteId: 'cli-w', monto: 50 }); store.set('finanzas_movimientos/w2', { ...base, clienteId: 'otro', monto: 50 });
  assert.match((await llamar({ accion: 'anular_movimiento', movimientoId: 'grp:w1,w2', motivo: 'prueba mezcla', operationId: 'op-grp-0003' })).error, /no son el mismo pago/);
  // fecha del pago completo
  store.set('finanzas_movimientos/f1', { ...base, clienteId: 'cli-f', monto: 70 }); store.set('finanzas_movimientos/f2', { ...base, clienteId: 'cli-f', monto: 70 });
  const fe = await llamar({ accion: 'ajustar_fecha_movimiento', movimientoId: 'grp:f1,f2', fechaPago: '2026-10-04', motivo: 'Entró el 4' });
  assert.equal(fe.ok, true, JSON.stringify(fe)); assert.equal(store.get('finanzas_movimientos/f2').fechaPago, '2026-10-04');
});
