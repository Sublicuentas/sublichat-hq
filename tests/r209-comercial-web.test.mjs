// R209 · Gestión comercial en la Web: menú, permiso, pantalla y archivos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('menú y permisos: Sublicuentas, Relojes y Geisell; el servidor lo valida', () => {
  assert.match(R('ui-v2.js'), /\{ s: 'agenda' \}, \{ s: 'comercial' \}/);
  const app = R('sublichat-app.js');
  assert.match(app, /if\(screen==='comercial'\)return pv\?pv\.pantallas\.includes\('comercial'\):esFundadoraSala\(\)/);
  assert.match(app, /ensureScreen\('comercial','Gestión comercial'/);
  assert.match(R('api/_permisos.js'), /id: 'comercial'/);
  assert.match(R('index.html'), /comercial-web\.js\?v=20261127-r209/);
  assert.equal(JSON.parse(R('vercel.json')).functions['api/comercial.js'].maxDuration, 60);
});
test('pantalla: buscador, filtros, checklist, WhatsApp manual confirmado y Excel de 10 hojas; sin degradados', () => {
  const w = R('comercial-web.js'), c = R('comercial-web.css');
  for (const x of ['data-gc-f="q"', 'data-gc-sel=', 'data-gc="asignar-sel"', 'Sí, lo envié · registrar', 'Otra variante', 'excel-lista']) assert.ok(w.includes(x), x);
  for (const h of ['Resumen ejecutivo', 'Clientes vencidos', 'Clientes por fidelizar', 'Clientes potenciales', 'Rendimiento de vendedores', 'Historial comercial', 'Motivos de abandono', 'Crecimiento de cartera', 'Efectividad de mensajes', 'Rendimiento por plataforma']) assert.ok(w.includes("'" + h + "'"), h);
  assert.doesNotMatch(c, /gradient/i);
  assert.doesNotMatch(w, /Naara|Libni/);
});

test('R209b · pantalla igual a los renders: tarjetas, pie «Iniciar seguimiento», agenda/rendimiento y generador', () => {
  const js = R('comercial-web.js'), css = R('comercial-web.css');
  for (const t of ['gc-mini', 'Agenda comercial de hoy', 'Iniciar seguimiento', 'Pendientes hoy', 'Generador de mensajes', 'Historial reciente', 'Enviar por WhatsApp', 'Última renovación: ', 'Más filtros y Excel']) assert.ok(js.includes(t), t);
  assert.match(js, /\{\{\s\*precio\\s\*\\\}\\\}|\\\{\\\{\\s\*precio/);
  assert.match(css, /\.gc-tarjetas\{display:flex\}/);
  assert.ok(!/linear-gradient|radial-gradient/.test(css.split('R209b')[1] || ''), 'sin degradados');
  assert.ok(!/Naara|Libni/.test(js));
});
