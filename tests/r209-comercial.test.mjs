// R209 · GESTIÓN COMERCIAL — pruebas T01–T12 del documento maestro con datos SINTÉTICOS (Firestore simulado).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { handleComercial, _reiniciarCache } from '../api/comercial.js';
import * as G from '../api/_comercial.js';

const HOY = G.hoyHN();
const d = (n) => G.sumarDias(HOY, n);
const dmy = (ymd) => { const [y, m, dd] = ymd.split('-'); return `${dd}/${m}/${y}`; };
const U = { sub: { usuario: 'sublicuentas', uid: 'admin-sublicuentas' }, rel: { usuario: 'relojes', uid: 'asesor-relojes' }, gei: { usuario: 'geisell', uid: 'asesor-geisell' }, mag: { usuario: 'magdiel', uid: 'asesor-magdiel', role: 'auditor' } };
function res() { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; }
async function call(db, user, body) { const r = res(); await handleComercial(db, user, body, r); return r.body; }
const venta = (id, cid, fecha, subtipo = 'compra_nueva', extra = {}) => ({ tipo: 'venta', subtipo, clienteId: cid, fechaPago: fecha, monto: 150, operacionId: 'op_' + id, movimientoId: id + '_venta', compraId: 'cp_' + id, ...extra });
function semilla() {
  return {
    clientes: {
      // T01: un servicio vencido hace 8 días y otro vigente
      c1: { nombrePerfil: 'Carla Prueba', telefono: '9999-0001', servicios: [{ plataforma: 'netflix', fechaRenovacion: dmy(d(-8)), precio: 150, vendedor: 'Naara', correo: 'secreto@x.test', clave: 'NOSALE', pin: '1234', compraId: 'cp_v1' }, { plataforma: 'disneyp', fechaRenovacion: dmy(d(10)), precio: 100, vendedor: 'Naara', compraId: 'cp_v2' }] },
      // T02: UNA compra (desde octubre) y ya vencida (fin hace 10 días): Vencidos + Por fidelizar, una sola ficha
      c2: { nombrePerfil: 'Beto', telefono: '+504 9999-0002', servicios: [{ plataforma: 'hbomax', fechaRenovacion: dmy(d(-10)), precio: 80, vendedor: 'Libni', compraId: 'cp_f2' }] },
      // T03: primera compra VIGENTE
      c3: { nombrePerfil: 'Dina', telefono: '99990003', servicios: [{ plataforma: 'spotify', fechaRenovacion: dmy(d(20)), precio: 110, compraId: 'cp_f3' }] },
      // T04: sin fecha ni historial
      c4: { nombrePerfil: '', telefono: '', servicios: [{ plataforma: 'iptv', precio: 0 }] },
      // archivado «No renovó» sin nada vigente
      c5: { nombrePerfil: 'Elsa Archivada', telefono: '99990005', servicios: [] },
      // archivado «No renovó» pero CON algo vigente → no entra por el archivo
      c6: { nombrePerfil: 'Fito', telefono: '99990006', servicios: [{ plataforma: 'netflix', fechaRenovacion: dmy(d(5)) }] },
      c7: { nombrePerfil: 'Gina Dos Compras', telefono: '99990007', servicios: [{ plataforma: 'netflix', fechaRenovacion: dmy(d(3)), compraId: 'cp_g1' }] },
      alias: { nombrePerfil: 'Alias', consolidadoEn: 'c1', servicios: [{ plataforma: 'netflix', fechaRenovacion: dmy(d(-40)) }] },
    },
    finanzas_movimientos: {
      f2_venta: venta('f2', 'c2', d(-40)), f3_venta: venta('f3', 'c3', d(-10)),
      g1_venta: venta('g1', 'c7', d(-50)), g2_venta: venta('g2', 'c7', d(-20), 'renovacion'),
      anul_venta: venta('an', 'c3', d(-9), 'compra_nueva', { estadoFinanciero: 'anulado' }),
      viejo_venta: venta('vj', 'c1', '2026-09-15'),
    },
    auditoria_eventos: {
      nr5: { tipo: 'cliente_no_renovo', clienteId: 'c5', plataforma: 'netflix', precio: 150, fechaRenovacion: dmy(d(-20)), vendedor: 'Relojes', createdAt: new Date(Date.now() - 15 * 864e5).toISOString(), servicio: { correo: 'x@y', clave: 'NO' } },
      nr6: { tipo: 'cliente_no_renovo', clienteId: 'c6', plataforma: 'hbomax', fechaRenovacion: dmy(d(-20)), createdAt: new Date(Date.now() - 15 * 864e5).toISOString() },
    },
  };
}
async function nueva() { _reiniciarCache(); return fakeFirestore(semilla()); }
const lista = async (db, cat, extra = {}) => call(db, U.sub, { accion: 'lista', cat, porPagina: 3000, ...extra });

test('acceso: Sublicuentas, Relojes y Geisell sí; otros no', async () => {
  const db = await nueva();
  for (const u of [U.sub, U.rel, U.gei]) assert.equal((await call(db, u, { accion: 'panel' })).ok, true);
  const r = res(); await handleComercial(db, U.mag, { accion: 'panel' }, r); assert.equal(r.code, 403);
});

test('T01 · servicio vencido + otro vigente: entra a Vencidos sin marcar la ficha inactiva; sin accesos', async () => {
  const db = await nueva(); const l = await lista(db, 'vencidos');
  const c1 = l.filas.find((f) => f.id === 'c1');
  assert.ok(c1); assert.equal(c1.vigentes, 1); assert.equal(c1.inactivo, '');
  assert.deepEqual(c1.servicios.map((s) => [s.plataforma, s.estado, s.dias]), [['netflix', 'vencido', 8], ['disneyp', 'vigente', -10]]);
  assert.equal(c1.servicios[0].vendedor, 'Sublicuentas'); // nunca el nombre personal
  assert.doesNotMatch(JSON.stringify(l), /NOSALE|secreto@|"pin"|"clave"|"correo"/);
  assert.ok(!l.filas.some((f) => f.id === 'alias'), 'ficha consolidada no se duplica');
});

test('T02 · una compra vencida: está en Vencidos y Por fidelizar con UNA ficha; un solo contacto al día', async () => {
  const db = await nueva();
  const v = (await lista(db, 'vencidos')).filas.find((f) => f.id === 'c2'), f = (await lista(db, 'fidelizar')).filas.find((x) => x.id === 'c2');
  assert.ok(v && f); assert.equal(v.key, f.key); assert.deepEqual(v.categorias.sort(), ['fidelizar', 'vencidos']);
  assert.equal(f.compras, 1); assert.equal(f.ciclo.elegible, true); // fin hace 10 días ≥ 7
  const e1 = await call(db, U.rel, { accion: 'evento', key: 'c_c2', categoria: 'vencidos', etapa: 'enviado', texto: 'Hola', resultado: 'contactado' });
  assert.equal(e1.ok, true);
  const e2 = await call(db, U.rel, { accion: 'evento', key: 'c_c2', categoria: 'fidelizar', etapa: 'enviado', texto: 'Hola' });
  assert.equal(e2.ok, false); assert.match(e2.error, /ya se le escribió hoy/);
});

test('T03 · primera compra vigente: en Por fidelizar pero sin agenda; dos compras lo retiran', async () => {
  const db = await nueva(); const l = await lista(db, 'fidelizar');
  const c3 = l.filas.find((f) => f.id === 'c3'); assert.ok(c3); assert.equal(c3.ciclo.estado, 'vigente'); assert.equal(c3.ciclo.elegible, false);
  assert.equal(c3.compras, 1, 'la venta anulada no cuenta');
  assert.ok(!l.filas.some((f) => f.id === 'c7'), 'compra + renovación = ya no es por fidelizar');
  assert.equal((await lista(db, 'fidelizar', { filtro: 'hoy' })).filas.some((f) => f.id === 'c3'), false);
});

test('T04 · sin historial: no se inventa compra ni días', async () => {
  const db = await nueva(); const l = await lista(db, 'vencidos');
  assert.ok(!l.filas.some((f) => f.id === 'c4'), 'sin fecha no es vencido');
  const c1 = l.filas.find((f) => f.id === 'c1'); assert.equal(c1.compras, null, 'venta de septiembre no es verificable');
  assert.ok(!(await lista(db, 'fidelizar')).filas.some((f) => f.id === 'c1'));
});

test('«No renovó» (90 días): entra solo si ya no tiene nada vigente', async () => {
  const db = await nueva(); const l = await lista(db, 'vencidos');
  const c5 = l.filas.find((f) => f.id === 'c5'); assert.ok(c5); assert.equal(c5.archivados[0].estado, 'no_renovo'); assert.equal(c5.archivados[0].precio, 150);
  assert.ok(!l.filas.some((f) => f.id === 'c6'));
  assert.doesNotMatch(JSON.stringify(c5), /"clave"|"correo"/);
});

test('T05 · potencial sin nombre: teléfono + servicio; detecta teléfono existente sin duplicar', async () => {
  const db = await nueva();
  const a = await call(db, U.gei, { accion: 'oportunidad_crear', telefono: '9999-0099', servicios: ['netflix'] });
  assert.equal(a.ok, true);
  const dup = await call(db, U.gei, { accion: 'oportunidad_crear', telefono: '+50499990099', servicios: ['hbomax'] });
  assert.equal(dup.ok, false); assert.match(dup.error, /Ya hay una oportunidad abierta/);
  const cli = await call(db, U.gei, { accion: 'oportunidad_crear', telefono: '9999-0001', servicios: ['netflix'] });
  assert.equal(cli.duplicado, true); assert.equal(cli.cliente.id, 'c1');
  assert.equal((await call(db, U.gei, { accion: 'oportunidad_crear', telefono: '99', servicios: ['netflix'] })).ok, false);
  assert.equal((await call(db, U.gei, { accion: 'oportunidad_crear', telefono: '99990088' })).ok, false);
  const p = (await lista(db, 'potenciales')).filas; assert.equal(p.length, 1); assert.equal(p[0].saludo, ''); assert.equal(p[0].responsable, 'geisell');
});

test('T06 · venta de potencial: se vincula UNA venta real; copiar mensaje no crea venta', async () => {
  const db = await nueva();
  const o = await call(db, U.gei, { accion: 'oportunidad_crear', telefono: '99990120', nombre: 'Hugo', servicios: ['netflix'] });
  const key = 'o_' + o.id;
  const sin = await call(db, U.gei, { accion: 'evento', key, categoria: 'potenciales', etapa: 'respuesta', resultado: 'compra_concretada', ventaId: 'nada' });
  assert.equal(sin.ok, false); assert.match(sin.error, /venta ya registrada/);
  // aparece el cliente con su primera venta
  db._data.set('clientes/c9', { v: 1, data: { nombrePerfil: 'Hugo', telefono: '99990120', servicios: [{ plataforma: 'netflix', fechaRenovacion: dmy(d(30)), compraId: 'cp_h' }] } });
  db._data.set('finanzas_movimientos/h_venta', { v: 1, data: venta('h', 'c9', HOY) });
  _reiniciarCache();
  const p = (await lista(db, 'potenciales')).filas[0]; assert.equal(p.ventaSugerida.id, 'h_venta');
  const okv = await call(db, U.gei, { accion: 'evento', key, categoria: 'potenciales', etapa: 'respuesta', resultado: 'compra_concretada', ventaId: 'h_venta' });
  assert.equal(okv.ok, true);
  const op = db._data.get('gc_oportunidades/' + o.id).data; assert.equal(op.estado, 'convertida'); assert.equal(op.clienteId, 'c9');
  assert.equal([...db._data.keys()].filter((k) => k.startsWith('finanzas_movimientos/')).length, 7, 'no se creó ninguna venta');
  const rep = await call(db, U.sub, { accion: 'reporte', desde: d(-1), hasta: HOY });
  assert.equal(rep.resumen.ventasVinculadas, 1); assert.equal(rep.resumen.ingresosVinculados, 150);
});

test('T07 · importar la biblioteca dos veces: 120 únicas, 40 por categoría, variables resueltas', async () => {
  const db = await nueva();
  const a = await call(db, U.sub, { accion: 'plantillas_importar' }); assert.equal(a.nuevas, 120);
  const b = await call(db, U.sub, { accion: 'plantillas_importar' }); assert.equal(b.nuevas, 0); assert.equal(b.iguales, 120);
  const l = await call(db, U.rel, { accion: 'plantillas' }); assert.equal(l.plantillas.length, 120);
  for (const c of ['vencidos', 'fidelizar', 'potenciales']) assert.equal(l.plantillas.filter((p) => p.categoria === c).length, 40);
  for (const p of l.plantillas) { const r = G.resolverPlantilla(p.mensaje, { nombre: 'carla prueba', servicio: 'Netflix' }); assert.equal(r.ok, true, p.id); assert.doesNotMatch(r.texto, /\{\{/); }
  assert.match(G.resolverPlantilla('{{saludo}} x', { nombre: '' }).texto, /^¡Hola! 👋/);
  assert.equal(G.resolverPlantilla('{{saludo}} {{servicio}}', { nombre: 'Ana' }).ok, false);
  const ed = await call(db, U.sub, { accion: 'plantilla_guardar', id: 'GC-VENCIDOS-001', categoria: 'vencidos', situacion: 'consulta_experiencia', mensaje: '{{saludo}}\n\nEditada {{servicio}}.' });
  assert.equal(ed.version, 2);
  const c = await call(db, U.sub, { accion: 'plantillas_importar' }); assert.deepEqual(c.conCambiosLocales, ['GC-VENCIDOS-001']);
  assert.equal((await call(db, U.rel, { accion: 'plantillas_importar' })).ok, false, 'solo Sublicuentas importa');
});

test('T08 · «No contactar» bloquea; quitarlo solo Sublicuentas', async () => {
  const db = await nueva();
  await call(db, U.rel, { accion: 'no_contactar', key: 'c_c1' });
  const e = await call(db, U.rel, { accion: 'evento', key: 'c_c1', categoria: 'vencidos', etapa: 'enviado', texto: 'x' });
  assert.equal(e.ok, false); assert.match(e.error, /bloqueado/);
  assert.equal((await call(db, U.rel, { accion: 'no_contactar', key: 'c_c1', valor: false })).ok, false);
  assert.equal((await lista(db, 'vencidos', { filtro: 'bloqueados' })).filas.length, 1);
});

test('T09 · dos vendedores toman la misma tarea: solo uno; reasignación auditada', async () => {
  const db = await nueva();
  const [a, b] = await Promise.all([call(db, U.rel, { accion: 'tomar', key: 'c_c2' }), call(db, U.gei, { accion: 'tomar', key: 'c_c2' })]);
  assert.equal([a, b].filter((x) => x.ok).length, 1);
  const quien = db._data.get('gc_seguimiento/c_c2').data.responsable;
  const otro = quien === 'relojes' ? U.gei : U.rel;
  const e = await call(db, otro, { accion: 'evento', key: 'c_c2', categoria: 'vencidos', etapa: 'enviado', texto: 'x' });
  assert.equal(e.ok, false); assert.match(e.error, /lo atiende/);
  assert.equal((await call(db, U.rel, { accion: 'asignar', keys: ['c_c2'], usuario: 'geisell' })).ok, false);
  const r = await call(db, U.sub, { accion: 'asignar', keys: ['c_c2'], usuario: quien === 'relojes' ? 'geisell' : 'relojes' });
  assert.equal(r.hechos.length, 1);
  assert.ok([...db._data.values()].some((x) => x.data.accion === 'gc_reasignar'));
});

test('T10 · WhatsApp abierto no cuenta como enviado; el ciclo avanza solo al confirmar', async () => {
  const db = await nueva();
  await call(db, U.rel, { accion: 'evento', key: 'c_c1', categoria: 'vencidos', etapa: 'abierto' });
  let p = await call(db, U.rel, { accion: 'panel' }); assert.equal(p.hoyRend.contactos, 0);
  const v0 = (await lista(db, 'vencidos')).filas.find((f) => f.id === 'c1'); assert.equal(v0.ciclo.paso, 0); assert.equal(v0.ciclo.elegible, true);
  const e = await call(db, U.rel, { accion: 'evento', key: 'c_c1', categoria: 'vencidos', etapa: 'enviado', texto: 'Hola', plantillaId: 'GC-VENCIDOS-001', resultado: 'no_responde' });
  assert.equal(e.paso, 1);
  p = await call(db, U.rel, { accion: 'panel' }); assert.equal(p.hoyRend.contactos, 1);
  const v1 = (await lista(db, 'vencidos')).filas.find((f) => f.id === 'c1');
  assert.equal(v1.ciclo.sugerida, G.sumarDias(v1.ciclo.ancla, 15)); assert.equal(v1.ciclo.elegible, false);
  // fecha acordada manda sobre el intervalo
  await call(db, U.rel, { accion: 'evento', key: 'c_c1', categoria: 'vencidos', etapa: 'respuesta', resultado: 'pendiente_salario', proximo: d(2) });
  const v2 = (await lista(db, 'vencidos')).filas.find((f) => f.id === 'c1'); assert.equal(v2.ciclo.sugerida, d(2)); assert.equal(v2.ciclo.acordada, true);
  const bad = await call(db, U.rel, { accion: 'evento', key: 'c_c3', categoria: 'fidelizar', etapa: 'enviado', texto: '{{saludo}}', plantillaId: 'X' });
  assert.equal(bad.ok, false);
});

test('T12 · reporte: totales por venta/cliente únicos y fechas locales', async () => {
  const db = await nueva();
  await call(db, U.rel, { accion: 'panel' }); // foto de apertura
  await call(db, U.rel, { accion: 'evento', key: 'c_c2', categoria: 'vencidos', etapa: 'enviado', texto: 'Hola', plantillaId: 'GC-VENCIDOS-002', resultado: 'interesado' });
  const r = await call(db, U.sub, { accion: 'reporte', desde: HOY, hasta: HOY, usuario: 'relojes' });
  assert.equal(r.ok, true); assert.equal(r.resumen.contactosConfirmados, 1); assert.equal(r.resumen.personasContactadas, 1); assert.equal(r.resumen.respondieron, 1);
  assert.equal(r.historial.length, 1); assert.equal(r.historial[0].fecha, HOY); assert.equal(r.zona, 'America/Tegucigalpa');
  assert.equal(r.efectividad[0].plantillaId, 'GC-VENCIDOS-002'); assert.equal(r.efectividad[0].respuestas, 1);
  assert.equal(G.celdaSegura('=HYPERLINK("x")'), '\'=HYPERLINK("x")');
  const filtrado = await call(db, U.sub, { accion: 'reporte', desde: HOY, hasta: HOY, usuario: 'geisell' }); assert.equal(filtrado.resumen.contactosConfirmados, 0);
});

test('utilidades: teléfono internacional, saludo verificado y foto diaria', () => {
  assert.equal(G.normTel('9999-0001'), '+50499990001'); assert.equal(G.normTel('+1 (305) 555-0100'), '+13055550100'); assert.equal(G.normTel('12'), '');
  assert.equal(G.primerNombre('carla prueba'), 'Carla'); assert.equal(G.primerNombre('cliente 23'), ''); assert.equal(G.primerNombre('J.'), '');
  const m = G.movimientosCartera(['a', 'b', 'c'], ['b', 'c', 'd', 'e'], new Set(['e']));
  assert.deepEqual([m.nuevos, m.recuperados, m.perdidos, m.neto], [['e'], ['d'], ['a'], 1]);
});
