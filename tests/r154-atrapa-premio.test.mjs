// R154 · "Atrapa tu Premio" — motor (api/_juego-premios.js) contra un Firestore simulado con transacciones.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as J from '../api/_juego-premios.js';
import { fakeFirestore } from './helpers/fake-firestore.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOY = J.hoyDMY();
const en = (dias) => J.sumarDiasDMY(HOY, dias);
function base(extra = {}) {
  return fakeFirestore({
    clientes: {
      c1: { nombrePerfil: 'Ana López', servicios: [
        { compraId: 'k1', plataforma: 'latintv1', fechaRenovacion: en(300) },
        { compraId: 'k2', plataforma: 'spotify', fechaRenovacion: en(10) },
        { compraId: 'k3', plataforma: 'netflix', fechaRenovacion: en(5) },
        { compraId: 'k4', plataforma: 'disneyp', fechaRenovacion: en(-4), beneficiarioTipo: 'tercero', beneficiarioNombre: 'Beto' },
      ] },
    },
    inventario: { i1: { plataforma: 'hbomax', capacidad: 5, clientes: [1, 2, 3] }, i2: { plataforma: 'primevideo', capacidad: 5, clientes: [1, 2, 3, 4, 5] } },
    sorteo_boletos: { b1: { clientId: 'c1', sorteoId: 's-oct', activo: true } },
    ...extra,
  });
}
const ren = (key = 'k1|' + en(300), meses = 12) => ({ key, compraId: 'k1', meses });

test('fichas sugeridas por meses: 1→1 · 2→2 · 3→2 · 4-6→3 · 7-12→4 (IPTV 12 meses = 4, no 12)', () => {
  assert.deepEqual([1, 2, 3, 4, 6, 7, 12, 24].map(J.fichasSugeridas), [1, 2, 2, 3, 3, 4, 4, 4]);
});

test('dar fichas: una renovación = un solo lote (recargar o reabrir no duplica); máximo 4; auditoría', async () => {
  const db = base();
  const a = await J.otorgarFichas(db, { clienteId: 'c1', fichas: 4, origen: 'renovacion', renovacion: ren(), actor: 'sublicuentas' });
  const b = await J.otorgarFichas(db, { clienteId: 'c1', fichas: 4, origen: 'renovacion', renovacion: ren(), actor: 'sublicuentas' });
  assert.equal(a.loteId, b.loteId); assert.equal(b.duplicado, true);
  assert.equal((await db.collection('juego_fichas').where('clienteId', '==', 'c1').get()).size, 4);
  await assert.rejects(J.otorgarFichas(db, { clienteId: 'c1', fichas: 5, origen: 'renovacion', renovacion: ren('otra'), actor: 'x' }), /Máximo 4/);
  await assert.rejects(J.otorgarFichas(db, { clienteId: 'c1', fichas: 2, origen: 'renovacion', renovacion: { key: 'z', compraId: 'NO-ES-SUYA', meses: 1 } }), /no pertenece/);
  await assert.rejects(J.otorgarFichas(db, { clienteId: 'c1', fichas: 1, origen: 'promocion', requestId: 'r1', motivo: '' }), /motivo/);
  const audit = (await db.collection('auditoria_eventos').get()).docs.map((d) => d.data()).filter((x) => x.tipo === 'juego_fichas_otorgadas');
  assert.equal(audit.length, 1); assert.equal(audit[0].usuario, 'sublicuentas'); assert.equal(audit[0].fichas, 4);
});

test('4 fichas = 4 premios distintos, nunca más de 1 Premium y respeta el tope de costo (200 lotes)', async () => {
  for (let r = 0; r < 200; r++) {
    const db = base();
    await db.collection('juego_config').doc('global').set({ ...J.CONFIG_DEFAULT, topeCostoLote: 120 });
    const { loteId } = await J.otorgarFichas(db, { clienteId: 'c1', fichas: 4, origen: 'promocion', requestId: 'r' + r, motivo: 'prueba lote' });
    const premios = [];
    for (let i = 1; i <= 4; i++) {
      try { const x = await J.jugar(db, { clienteId: 'c1', fichaId: `${loteId}_${i}` }); premios.push(x.ganado); }
      catch (e) { assert.match(e.message, /no hay premios disponibles/); }
    }
    const ids = premios.map((g) => g.premioId);
    assert.equal(new Set(ids).size, ids.length, 'sin repetidos');
    assert.ok(premios.filter((g) => g.tier === 'premium').length <= 1, 'máximo 1 Premium');
    assert.ok(premios.reduce((t, g) => t + g.costoHnl, 0) <= 120, 'tope de costo');
    assert.ok(!premios.some((g) => g.premio.plataforma === 'netflix'), 'Netflix nunca');
  }
});

test('inventario: stock 0 y Bodega sin cupos quedan fuera; si ya tiene el servicio, el mes gratis NO se aplica solo (queda para el administrador)', async () => {
  const P = J.PREMIOS_INICIALES.map((p) => ({ ...p, activo: true }));
  const lista = J.candidatos({ premios: P.map((p) => (p.id === 'canva' ? { ...p, stock: 0 } : p)), lote: {}, disponibilidadBodega: { hbomax: 2, primevideo: 0, crunchyroll: 0, spotify: 0 }, clienteTiene: (pl) => pl === 'spotify' });
  const ids = lista.map((p) => p.id);
  assert.ok(!ids.includes('canva'), 'stock 0'); assert.ok(!ids.includes('prime'), 'Bodega sin cupos'); assert.ok(!ids.includes('crunchy'));
  assert.ok(ids.includes('max'), 'Bodega con cupos'); assert.ok(ids.includes('spotify'), 'ya tiene Spotify: no gasta Bodega');
  const db = base();
  const { loteId } = await J.otorgarFichas(db, { clienteId: 'c1', fichas: 1, origen: 'fidelidad', requestId: 'f1', motivo: 'cliente fiel' });
  const spot = J.PREMIOS_INICIALES.find((p) => p.id === 'spotify');
  await db.collection('juego_premios').doc('spotify').set({ ...spot, activo: true });
  const r = await J.jugar(db, { clienteId: 'c1', fichaId: `${loteId}_1`, rnd: () => 0 });
  assert.equal(r.ganado.premioId, 'spotify'); assert.equal(r.ganado.estado, 'pendiente_entrega'); assert.equal(r.ganado.entregaModo, 'admin');
  const c = (await db.collection('clientes').doc('c1').get()).data();
  assert.equal(c.servicios.find((s) => s.compraId === 'k2').fechaRenovacion, en(10), 'la fecha NO cambia sola');
  assert.equal(((await db.collection('juego_reservas').doc('spotify').get()).data() || {}).reservados || 0, 0, 'no reserva Bodega');
  const e = await J.marcarEntregado(db, r.ganado.id, { actor: 'admin', nota: 'aplicado a mano' });
  assert.equal(e.estado, 'entregado');
});

test('mes gratis de un servicio que NO tiene: reserva cupo de Bodega, queda pendiente; entregar o vencer libera la reserva', async () => {
  const db = base();
  await db.collection('juego_premios').doc('max').set({ ...J.PREMIOS_INICIALES.find((p) => p.id === 'max'), activo: true });
  const { loteId } = await J.otorgarFichas(db, { clienteId: 'c1', fichas: 2, origen: 'promocion', requestId: 'p1', motivo: 'promo max' });
  const r = await J.jugar(db, { clienteId: 'c1', fichaId: `${loteId}_1`, rnd: () => 0 });
  assert.equal(r.ganado.premioId, 'max'); assert.equal(r.ganado.estado, 'reservado'); assert.equal(r.ganado.entregaModo, 'admin');
  assert.equal((await db.collection('juego_reservas').doc('hbomax').get()).data().reservados, 1);
  await J.marcarEntregado(db, r.ganado.id, { actor: 'sublicuentas', nota: 'acceso creado' });
  assert.equal((await db.collection('juego_reservas').doc('hbomax').get()).data().reservados, 0);
  assert.equal((await db.collection('juego_ganados').doc(r.ganado.id).get()).data().estado, 'entregado');
  // vencido
  const db2 = base();
  await db2.collection('juego_premios').doc('max').set({ ...J.PREMIOS_INICIALES.find((p) => p.id === 'max'), activo: true });
  const l2 = await J.otorgarFichas(db2, { clienteId: 'c1', fichas: 1, origen: 'promocion', requestId: 'p2', motivo: 'promo max' });
  const g2 = (await J.jugar(db2, { clienteId: 'c1', fichaId: `${l2.loteId}_1`, rnd: () => 0 })).ganado;
  assert.equal(await J.vencerPremios(db2, { ahora: new Date(Date.now() + 8 * 86400000) }), 1);
  assert.equal((await db2.collection('juego_ganados').doc(g2.id).get()).data().estado, 'vencido');
  assert.equal((await db2.collection('juego_reservas').doc('hbomax').get()).data().reservados, 0);
});

test('+N días: van al servicio de la renovación, contando desde su vencimiento', async () => {
  const db = base();
  for (const p of J.PREMIOS_INICIALES) await db.collection('juego_premios').doc(p.id).set({ ...p, activo: p.id === 'dias5' });
  const { loteId } = await J.otorgarFichas(db, { clienteId: 'c1', fichas: 1, origen: 'renovacion', renovacion: ren() });
  const r = await J.jugar(db, { clienteId: 'c1', fichaId: `${loteId}_1` });
  assert.equal(r.ganado.premioId, 'dias5'); assert.equal(r.ganado.estado, 'entregado');
  assert.equal(r.ganado.entrega.compraId, 'k1'); assert.equal(r.ganado.entrega.fechaNueva, en(305));
  assert.equal(J.extenderFecha(en(-4), 3, HOY), en(3), 'vencido → desde hoy');
});

test('una ficha se usa una sola vez: recargar devuelve el mismo premio y dos teléfonos a la vez no crean dos premios', async () => {
  const db = base();
  const { loteId } = await J.otorgarFichas(db, { clienteId: 'c1', fichas: 2, origen: 'promocion', requestId: 'cc', motivo: 'concurrencia' });
  const fid = `${loteId}_1`;
  const [a, b] = await Promise.all([J.jugar(db, { clienteId: 'c1', fichaId: fid }), J.jugar(db, { clienteId: 'c1', fichaId: fid })]);
  assert.equal([a, b].filter((x) => x.repetido).length, 1, 'uno gana, el otro recibe el resultado existente');
  assert.equal(a.ganado.premioId, b.ganado.premioId);
  const otra = await J.jugar(db, { clienteId: 'c1', fichaId: fid });
  assert.equal(otra.repetido, true); assert.equal(otra.ganado.premioId, a.ganado.premioId);
  assert.equal((await db.collection('juego_ganados').get()).size, 1);
  assert.equal((await db.collection('juego_lotes').doc(loteId).get()).data().fichasUsadas, 1);
});

test('el juego nunca toca el boleto mensual; pausa global; ficha de un tercero no se juega desde el titular', async () => {
  const db = base();
  const antes = JSON.stringify((await db.collection('sorteo_boletos').get()).docs.map((d) => d.data()));
  const { loteId } = await J.otorgarFichas(db, { clienteId: 'c1', fichas: 2, origen: 'promocion', requestId: 'bol', motivo: 'boleto intacto' });
  await J.jugar(db, { clienteId: 'c1', fichaId: `${loteId}_1` });
  assert.equal(JSON.stringify((await db.collection('sorteo_boletos').get()).docs.map((d) => d.data())), antes, 'boleto intacto (ni nuevo, ni consumido)');
  await db.collection('juego_config').doc('global').set({ ...J.CONFIG_DEFAULT, activo: false });
  await assert.rejects(J.jugar(db, { clienteId: 'c1', fichaId: `${loteId}_2` }), /pausa/);
  assert.equal((await db.collection('juego_fichas').doc(`${loteId}_2`).get()).data().estado, 'disponible', 'la ficha sigue guardada');
  await db.collection('juego_config').doc('global').set({ ...J.CONFIG_DEFAULT });
  const t = await J.otorgarFichas(db, { clienteId: 'c1', beneficiarioKey: 'tercero-beto', fichas: 1, origen: 'promocion', requestId: 't', motivo: 'tercero' });
  await assert.rejects(J.jugar(db, { clienteId: 'c1', beneficiarioKey: 'titular', fichaId: `${t.loteId}_1` }), /no es suya/);
});

test('sin premios válidos: no se fuerza ninguno y la ficha queda disponible', async () => {
  const db = base();
  for (const p of J.PREMIOS_INICIALES) await db.collection('juego_premios').doc(p.id).set({ ...p, activo: false });
  const { loteId } = await J.otorgarFichas(db, { clienteId: 'c1', fichas: 1, origen: 'promocion', requestId: 'v', motivo: 'vacío' });
  await assert.rejects(J.jugar(db, { clienteId: 'c1', fichaId: `${loteId}_1` }), /no hay premios disponibles/);
  assert.equal((await db.collection('juego_fichas').doc(`${loteId}_1`).get()).data().estado, 'disponible');
});

test('Netflix nunca como mes gratis; el cliente no ve costos ni pesos', async () => {
  assert.throws(() => J.validarPremio({ id: 'nf', nombre: 'Netflix gratis', tipo: 'mes_gratis', plataforma: 'netflix' }), /Netflix nunca/);
  assert.throws(() => J.validarPremio({ id: 'nf', nombre: 'VIP', tipo: 'mes_gratis', plataforma: 'vipnetflix' }), /Netflix nunca/);
  const db = base();
  await J.otorgarFichas(db, { clienteId: 'c1', fichas: 1, origen: 'promocion', requestId: 'e', motivo: 'estado' });
  const e = await J.estadoCliente(db, { clienteId: 'c1' });
  assert.equal(e.disponibles, 1);
  assert.doesNotMatch(JSON.stringify(e), /costoHnl|peso|stock|inventarioModo|"ip"/);
});

test('API: acciones públicas por enlace y de administración conectadas en api/sorteos.js', () => {
  const s = fs.readFileSync(path.join(root, 'api/sorteos.js'), 'utf8');
  assert.match(s, /action === "juego_estado" \|\| action === "juego_jugar"/);
  assert.match(s, /if \(action\.startsWith\("juego_"\)\) return res\.status\(200\)\.json\(await juegoAdmin/);
  assert.ok(s.indexOf('juego_jugar') < s.indexOf('const editor = await requireEditor'), 'jugar no exige sesión de Sublichat (usa el enlace del cliente)');
});

test('anular lote de prueba: desaparece del portal, libera cupo y stock, avisa días ya sumados, queda auditado', async () => {
  const db = base();
  await J.sembrarPremios(db);
  // Solo Max (bodega, nuevo → reservado) y +5 días (automático) activos
  for (const p of J.PREMIOS_INICIALES) if (!['max', 'dias5', 'canva'].includes(p.id)) await J.guardarPremio(db, { ...p, activo: false });
  const { loteId } = await J.otorgarFichas(db, { clienteId: 'c1', fichas: 3, origen: 'promocion', requestId: 'prueba-1', motivo: 'prueba', actor: 'sublicuentas' });
  for (let i = 1; i <= 2; i++) await J.jugar(db, { clienteId: 'c1', fichaId: `${loteId}_${i}` });
  const antes = await J.estadoCliente(db, { clienteId: 'c1' });
  assert.equal(antes.historial.length, 2); assert.equal(antes.disponibles, 1);
  const stockAntes = (await db.collection('juego_premios').doc('canva').get()).data().stock;
  const ganados = (await db.collection('juego_ganados').get()).docs.map((d) => d.data());
  await assert.rejects(J.anularLote(db, loteId, { actor: 'sublicuentas', motivo: '' }), /motivo/);
  const r = await J.anularLote(db, loteId, { actor: 'sublicuentas', motivo: 'prueba del dueño' });
  const despues = await J.estadoCliente(db, { clienteId: 'c1' });
  assert.equal(despues.historial.length, 0); assert.equal(despues.disponibles, 0); assert.equal(despues.fichas.length, 0);
  if (ganados.some((g) => g.premioId === 'max')) assert.equal((await db.collection('juego_reservas').doc('hbomax').get()).data().reservados, 0);
  if (ganados.some((g) => g.premioId === 'canva' && g.estado !== 'entregado')) assert.equal((await db.collection('juego_premios').doc('canva').get()).data().stock, stockAntes + 1);
  if (ganados.some((g) => g.premioId === 'dias5')) assert.match(r.avisos.join(' '), /Corrija esa fecha/);
  const lote = (await db.collection('juego_lotes').doc(loteId).get()).data();
  assert.equal(lote.estado, 'anulado'); assert.equal(lote.anuladoPor, 'sublicuentas');
  const audit = (await db.collection('auditoria_eventos').get()).docs.map((d) => d.data()).filter((x) => x.tipo === 'juego_lote_anulado');
  assert.equal(audit.length, 1);
  assert.equal((await J.anularLote(db, loteId, { actor: 'x', motivo: 'otra vez' })).yaAnulado, true);
  await assert.rejects(J.jugar(db, { clienteId: 'c1', fichaId: `${loteId}_3` }));
  assert.equal((await db.collection('sorteo_boletos').doc('b1').get()).data().activo, true, 'boleto mensual intacto');
});
