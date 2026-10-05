import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clasificarServicio, normalizarServicioVenta, puedeSerCuentaCompleta, ORDEN_CATEGORIAS } from '../api/_catalogo-categorias.js';

test('R112: 5 categorías y clasificación por plataforma (servicios viejos)', () => {
  assert.deepEqual(ORDEN_CATEGORIAS, ['perfiles', 'tv_digital', 'musica', 'software', 'cuentas_completas']);
  assert.equal(clasificarServicio({ plataforma: 'netflix' }).categoria, 'perfiles');
  assert.equal(clasificarServicio({ plataforma: 'oleada' }).categoria, 'tv_digital');
  assert.equal(clasificarServicio({ plataforma: 'Spotify Premium' }).categoria, 'musica');
  assert.equal(clasificarServicio({ plataforma: 'office2021' }).categoria, 'software');
  const viki = clasificarServicio({ plataforma: 'Viki Rakuten' });
  assert.equal(viki.categoria, 'cuentas_completas'); assert.equal(viki.tipoVenta, 'cuenta_completa', 'Viki ya no es perfil');
});

test('R112: lo GUARDADO manda (Netflix como cuenta completa) y solo las 5 plataformas permitidas', () => {
  const c = clasificarServicio({ plataforma: 'netflix', tipoVenta: 'cuenta_completa' });
  assert.equal(c.categoria, 'cuentas_completas');
  for (const p of ['viki', 'disneys', 'hbomax', 'netflix', 'crunchyroll']) assert.ok(puedeSerCuentaCompleta(p), p);
  assert.equal(puedeSerCuentaCompleta('spotify'), false);
  assert.match(normalizarServicioVenta({ plataforma: 'spotify', tipoVenta: 'cuenta_completa', correo: 'a', clave: 'b' }).error, /no se vende/);
});

test('R112: cuenta completa exige correo + clave y quita el PIN', () => {
  assert.match(normalizarServicioVenta({ plataforma: 'hbomax', tipoVenta: 'cuenta_completa', correo: 'x@y.z' }).error, /correo y la clave/);
  const ok = normalizarServicioVenta({ plataforma: 'hbomax', tipoVenta: 'cuenta_completa', correo: 'x@y.z', clave: 'k', pinPerfil: '1234' });
  assert.equal(ok.error, ''); assert.equal(ok.servicio.pinPerfil, undefined); assert.equal(ok.servicio.sinPinPerfil, true); assert.equal(ok.servicio.categoria, 'cuentas_completas');
});

test('R112: el servidor guarda categoría/tipo en la compra y en Finanzas', () => {
  const r = fs.readFileSync(new URL('../api/renovar.js', import.meta.url), 'utf8');
  assert.match(r, /out\.categoria = cls\.categoria; out\.tipoVenta = cls\.tipoVenta;/);
  assert.match(r, /normalizarServicioVenta\(body\.servicio \|\| \{\}\)/);
  const o = fs.readFileSync(new URL('../api/_finanzas-operacion.js', import.meta.url), 'utf8');
  assert.match(o, /\.\.\.clasificacionVenta\(rel, prep\)/);
  const f = fs.readFileSync(new URL('../api/finanzas.js', import.meta.url), 'utf8');
  assert.match(f, /categoria: clsR112\.categoria, tipoVenta: clsR112\.tipoVenta/);
});
