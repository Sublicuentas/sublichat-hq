// R198c · Fase 3 del PDF «Sublichat APK: modo offline completo»: el SERVIDOR revisa lo que llega de la cola offline de
// la APK (colaOffline: true) antes de escribir. Web, Telegram y APKs anteriores no mandan la marca: nada cambia para ellos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
const { __r188: R } = await import('../api/renovar.js');
const venta = (extra = {}) => R.buildServicio({ plataforma: 'netflix', correo: 'madre.demo@ejemplo.com', clave: 'x', pinPerfil: '1234', fechaRenovacion: '20/12/2026', compraId: 'nueva1', ...extra }, '', {}, 'Cliente Nuevo');
const cli = (n) => Array.from({ length: n }, (_, i) => ({ clienteId: 'c' + i, compraId: 'k' + i, nombre: 'Cliente ' + i, slot: i + 1 }));
const bodega = (d) => fakeFirestore({ inventario: { n1: { plataforma: 'netflix', correo: 'madre.demo@ejemplo.com', estado: 'activa', capacidad: 5, ...d } } });
const COLA = { colaOffline: true };

test('09 · venta preparada sin señal en una cuenta que otro llenó por Telegram: conflicto «sin_cupo», no vende doble', async () => {
  await assert.rejects(R.validarColaOffline(bodega({ clientes: cli(5) }), COLA, venta(), null), (e) => e.conflicto?.codigo === 'sin_cupo' && /ma\*\*\*@ejemplo\.com ya no tiene cupo/.test(e.crmUserMessage));
  await R.validarColaOffline(bodega({ clientes: cli(4) }), COLA, venta(), null); // queda 1: pasa
  await R.validarColaOffline(bodega({ clientes: [...cli(4), { compraId: 'nueva1', nombre: 'Cliente Nuevo', slot: 5 }] }), COLA, venta(), null); // reintento de la MISMA venta: ya es suya
  await R.validarColaOffline(bodega({ clientes: cli(5) }), {}, venta(), null); // sin marca de cola (Web/TG/APK vieja): igual que antes
});

test('11 · ficha cambiada desde Web mientras la APK estaba sin señal: conflicto «ficha_cambio», no se pisa', async () => {
  const anterior = { ...venta(), updatedAt: '2026-11-18T15:00:00.000Z' };
  await assert.rejects(R.validarColaOffline(bodega({ clientes: cli(1) }), { ...COLA, esperado: { servicioUpdatedAt: '2026-11-18T10:00:00.000Z' } }, venta({ precio: 150 }), anterior), (e) => e.conflicto?.codigo === 'ficha_cambio');
  await R.validarColaOffline(bodega({ clientes: cli(1) }), { ...COLA, esperado: { servicioUpdatedAt: '2026-11-18T15:00:00.000Z' } }, venta({ precio: 150 }), anterior); // misma versión: pasa
});

test('Renovación de la cola con fecha distinta en el servidor: conflicto «fecha_cambio» (evita renovar dos veces)', () => {
  assert.throws(() => R.revisarFechaCola({ ...COLA, fechaEsperada: '20/11/2026' }, { plataforma: 'netflix', fechaRenovacion: '20/12/2026' }), (e) => e.conflicto?.codigo === 'fecha_cambio' && e.conflicto.fechaServidor === '20/12/2026');
  R.revisarFechaCola({ ...COLA, fechaEsperada: '20/11/2026' }, { fechaRenovacion: '20/11/2026' }); // misma fecha: sigue
  R.revisarFechaCola({ fechaEsperada: '20/11/2026' }, { fechaRenovacion: '20/12/2026' }); // sin marca de cola: igual que antes
});

test('El conflicto vuelve a la APK con su código y la revisión corre antes de escribir', () => {
  const src = fs.readFileSync(new URL('../api/renovar.js', import.meta.url), 'utf8');
  assert.match(src, /json\(\{ ok: false, error: e\.crmUserMessage, \.\.\.\(e\.conflicto \? \{ conflicto: e\.conflicto \} : \{\}\) \}\)/);
  assert.ok(src.indexOf('revisarFechaCola(body, s, plataforma);') < src.indexOf('fechaAnterior = s.fechaRenovacion || fechaActual || null;'));
  assert.ok(src.indexOf('await validarColaOffline(db, body, nuevo, servicioAnterior);') > src.indexOf('await validarHboServicio(db, nuevo, servicioAnterior);'));
});
