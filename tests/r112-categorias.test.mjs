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

test('R112 web: categorías antes de la plataforma, cuenta completa sin PIN y payload con categoría/tipo', () => {
  const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(app, /from "\.\/catalogo-categorias\.js\?v=/);
  assert.match(app, /data-ficha-cat="\$\{k\}"/);
  assert.match(app, /const fichaNeedsPin=plat=>!fichaEsCuentaCompleta\(\)&&/);
  assert.match(app, /categoria:fichaGetVal\("fichaCategoria"\)\|\|fichaCategoriaDe\(plat\), tipoVenta:fichaEsCuentaCompleta\(\)\?"cuenta_completa":""/);
  const web = fs.readFileSync(new URL('../catalogo-categorias.js', import.meta.url), 'utf8');
  const api = fs.readFileSync(new URL('../api/_catalogo-categorias.js', import.meta.url), 'utf8');
  assert.equal(web.split('\n').slice(1).join('\n'), api.split('\n').slice(1).join('\n'), 'copia web idéntica al contrato');
});

test('R114: movimientos agrupan un pago único por cliente y van en orden real de registro', () => {
  const f = fs.readFileSync(new URL('../api/finanzas.js', import.meta.url), 'utf8');
  const cuerpo = f.slice(f.indexOf('function agruparPagos('), f.indexOf('async function handleLibro('));
  const money = (n) => Math.round(Number(n || 0) * 100) / 100;
  const agruparPagos = new Function('money', `${cuerpo}; return agruparPagos;`)(money);
  const base = { kind: 'ingreso', cliente: 'Ana', clienteId: 'c1', bancoId: 'bac', usuario: 'Relojes', fecha: '2026-10-03' };
  const g = agruparPagos([{ ...base, id: 'a', monto: 75, plataforma: 'Netflix', createdAt: '2026-10-03T15:00:00Z' }, { ...base, id: 'b', monto: 75, plataforma: 'Disney', createdAt: '2026-10-03T15:00:20Z' }, { ...base, id: 'c', clienteId: 'c2', cliente: 'Luis', monto: 100, createdAt: '2026-10-03T15:01:00Z' }]);
  assert.equal(g.length, 2); assert.equal(g[0].monto, 150); assert.deepEqual(g[0].ids, ['a', 'b']); assert.equal(g[0].plataforma, 'Netflix + Disney');
  assert.match(f, /String\(b\.createdAt \|\| ""\)\.localeCompare\(String\(a\.createdAt \|\| ""\)\)/);
});
