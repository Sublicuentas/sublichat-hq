// R208 · Extras VIP PROPIOS por Excel (USD con tarjeta BAC → Lempiras, con su cuenta madre Netflix Premium) y miembros extra
// por cuenta madre en Finanzas › Netflix Premium. Datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { handlePanel, PLANTILLAS_SIMPLES, detectarPlantilla, docIdVipCorreo } from '../api/_finanzas-panel.js';

function mkRes() { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; }
const deps = { hoyYmdHN: () => '2026-11-27', auditar: (tx, db, identity, ev) => tx.set(db.collection('auditoria_eventos').doc(), { ...ev, actor: identity.usuario }) };
const ident = { usuario: 'sublicuentas', role: 'sublicuentas', admin: true };
async function call(db, accion, body) { const res = mkRes(); await handlePanel(db, accion, body, ident, {}, res, deps); return res.body; }
const enc = PLANTILLAS_SIMPLES.vip_propio;
const semilla = () => ({
  inventario: { 'nf-1': { plataforma: 'netflix', correo: 'madre1@prueba.test', capacidad: 5, clientes: [] }, 'vip-1': { plataforma: 'vipnetflix', correo: 'extra1@prueba.test', capacidad: 1, clientes: [{ nombre: 'Cliente Uno' }] } },
  clientes: { c2: { nombre: 'Cliente Dos', servicios: [{ plataforma: 'vipnetflix', correo: 'extra2@prueba.test' }] } },
  fin_vip_extras: {}, fin_proveedores: {},
});
const filas = [
  { _fila: 2, v: ['extra1@prueba.test', 'madre1@prueba.test', '2026-12-15', 5.99, 155.5, '1234'] },
  { _fila: 3, v: ['extra2@prueba.test', 'MADRE1@prueba.test', '2026-12-16', 5.99, null, ''] },
  { _fila: 4, v: ['extra3@prueba.test', 'noexiste@prueba.test', '2026-12-16', 5.99, 150, ''] },
];

test('la plantilla de propios se reconoce y no se confunde con la VIP de 4 columnas', () => {
  assert.equal(detectarPlantilla(enc), 'vip_propio'); assert.equal(detectarPlantilla(PLANTILLAS_SIMPLES.vip), 'vip');
});
test('vista previa y confirmar: USD, cargo BAC en L, cuenta madre; sin cuenta madre válida = error', async () => {
  const db = fakeFirestore(semilla());
  const pv = await call(db, 'finp_simple_preview', { encabezados: enc, filas, tasa: 26 });
  const [a, b, c] = pv.filas;
  assert.equal(a.estado, 'nuevo'); assert.equal(a.datos.costoMensualHnl, 155.5); assert.equal(a.datos.madreId, 'nf-1'); assert.equal(a.datos.ultimos4, '1234'); assert.equal(a.datos.grupo, 'propio');
  assert.equal(b.estado, 'nuevo'); assert.equal(b.datos.costoMensualHnl, 155.74); assert.equal(b.vinculo, 'telegram');
  assert.equal(c.estado, 'error'); assert.match(c.errores.join(' '), /cuenta madre no está registrada/);
  const r = await call(db, 'finp_simple_confirmar', { encabezados: enc, filas, tasa: 26, hash: pv.hash, confirmo: true });
  assert.equal(r.aplicados, 2);
  const lista = await call(db, 'finp_vip_lista', { tab: 'propio' });
  assert.equal(lista.conteo.propio, 2);
  const f1 = lista.filas.find((x) => x.correo === 'extra1@prueba.test'); assert.equal(f1.madre, 'madre1@prueba.test'); assert.equal(f1.moneda, 'USD'); assert.equal(f1.costoMensualUsd, 5.99);
  const ct = await call(db, 'finp_cuentas_lista', { plataforma: 'netflix' });
  const m = ct.filas.find((x) => x.cuentaId === 'nf-1'); assert.equal(m.extras.length, 2); assert.equal(m.extrasCostoHnl, 311.24);
});
