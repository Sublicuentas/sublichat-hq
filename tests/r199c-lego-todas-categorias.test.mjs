// R199c · Tema Lego móvil — Fases 4 y 5 (Anexo Maestro V2): biblioteca global para todas las categorías,
// Finanzas (5 pestañas + Productos), Mi perfil (visual 05) y Catálogo fuera del menú. Solo presentación.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const css = R('ui-lego.css'), html = R('index.html'), v2 = R('ui-v2.js'), app = R('sublichat-app.js');
const capa = css.slice(css.indexOf('R199c · FASES 4 y 5'), css.indexOf('/* ---------- Selector «Tema de interfaz»')); // R199d · ahora es común a PC y celular
const movil = css.slice(css.indexOf('@media (max-width: 767.98px) {'), css.indexOf('R199d · COMPONENTES LEGO COMUNES'));

test('Capa global común (PC y celular), bajo data-ui="lego", sin tocar Inicio', () => {
  assert.ok(capa.length > 8000);
  assert.ok(css.indexOf('R199d · COMPONENTES LEGO COMUNES') < css.indexOf('R199c · FASES 4 y 5'));
  const reglas = capa.match(/^\s+html[^{]*\{/gm) || [];
  assert.ok(reglas.length > 60);
  for (const r of reglas) for (const sel of r.replace(/\{$/, '').split(/,\s*\n/)) assert.match(sel.trim(), /^html\[data-ui="lego"\]:not\(#lgA\):not\(#lgB\):not\(#lgC\):not\(#lgD\)/, sel.trim().slice(0, 100));
  assert.match(capa, /\.screen:not\(#screen-inicio\)/, 'Inicio conserva el diseño aprobado');
  assert.match(html, /ui-lego\.css\?v=20261120-r199[c-z]/);
});

test('Biblioteca de componentes: Hero, Card, Button, Tabs, KPI, ListRow, Form, Badge, Empty, Modal y tablas con scroll interno', () => {
  for (const c of ['LegoHero', 'LegoCard', 'LegoButton', 'LegoTabs', 'LegoKPI', 'LegoListRow', 'LegoFormSection', 'LegoStatusBadge', 'LegoEmptyState', 'LegoModal']) assert.ok(capa.includes(c), c);
  assert.match(capa, /:where\(\.cr-tabs, \.sr-tabs, \.sj-tabs, \.pc-admin-tabs, \.ligas-chips, \.vip-chips, \.fz-tabs\) \{[^}]*overflow-x: auto/s, 'pestañas con scroll interno, nunca de la página');
  assert.match(capa, /:where\(\.tbl-wrap, \.fz-tw, \.cm-table-wrap, \.rbac-table-wrap\) \{[^}]*overflow-x: auto/s);
  assert.match(capa, /min-height: 44px/, 'altura táctil mínima');
  assert.match(capa, /:focus-visible \{ outline: 3px solid var\(--lg-blue\)/);
  assert.match(capa, /\[disabled\] \{ opacity: \.55/);
});

test('Cada módulo del menú tiene su ícono 3D (renders del kit) y existen los archivos', () => {
  for (const s of ['control-cuentas', 'sala-juntas', 'portal-cliente', 'sorteos', 'tickets', 'revendedores', 'importar', 'egresos', 'cierre', 'actividad', 'auditoria', 'permisos', 'crm-master', 'estadisticas', 'objetivos', 'pelis', 'partidos', 'perfil', 'inventario']) assert.match(capa, new RegExp('#screen-' + s + '\\b'), s);
  for (const f of (capa.match(/\/assets\/lego\/[a-z-]+\.webp/g) || [])) assert.ok(fs.existsSync(new URL('..' + f, import.meta.url)), f);
});

test('Finanzas: hero con Sublirobot, mes + Actualizar costos + Productos, 5 pestañas reales (Productos sigue siendo botón)', () => {
  assert.match(movil, /#screen-finanzas \.fz-head::after \{[^}]*sublirobot\.webp/s);
  assert.match(movil, /#screen-finanzas \.fz-head-acc \{ display: grid !important; grid-template-columns: 1fr 1fr/);
  const fz = R('finanzas-web.js');
  for (const t of ['Resumen', 'Proveedores', 'Compras', 'Ganancias', 'Reportes']) assert.ok(fz.includes(t), t);
  assert.doesNotMatch(capa, /fz-tab[^{]*Productos/);
});

test('Mi perfil: portada con el banner del usuario (solo marco), tema arriba, cifras en 3 columnas; Ejecutivo sigue por defecto', () => {
  assert.match(movil, /#rbac-perfil > #profTemaUi \{ order: 2; \}/);
  assert.match(movil, /\.profile-summary-grid \{ display: grid !important; grid-template-columns: repeat\(3/);
  assert.doesNotMatch(css, /\.profile-cover \{[^}]*background-image/s, 'no se reemplaza el banner personal por un render');
  assert.match(app, /function temaUiActual\(\)\{ return String\(readProfile\(\)\.temaUi\|\|''\)==='lego'\?'lego':'ejecutivo'; \}/);
});

test('Catálogo (proyecto Relojes) fuera del menú de Sublichat; su pantalla, permisos y datos siguen existiendo', () => {
  const nav = v2.slice(v2.indexOf('var NAV = ['), v2.indexOf('];', v2.indexOf('var NAV = [')));
  assert.doesNotMatch(nav, /catalogo-relojes/);
  assert.match(nav, /\{ s: 'portal-cliente' \}, \{ s: 'sala-juntas' \}, \{ s: 'finanzas' \}/);
  assert.match(v2, /conocidos\['catalogo-relojes'\] = 1; \/\/ R199c/, 'tampoco reaparece dentro de «Más»');
  assert.match(app, /ensureScreen\('catalogo-relojes'/);
  assert.ok(fs.existsSync(new URL('../api/catalogo-relojes.js', import.meta.url)) || /catalogo-relojes/.test(app));
  assert.match(html, /\/ui-v2\.js\?v=(20261120-r199[c-z]|202611(2[7-9]|30)-r2\d\d)/);
});

test('Solo presentación: sin textos nuevos, sin degradados lineales, sin tocar endpoints', () => {
  assert.doesNotMatch(capa, /content:\s*"[^"]+"/);
  assert.doesNotMatch(capa, /linear-gradient/);
  for (const f of ['api/finanzas.js', 'api/renovar.js', 'api/inventario.js', 'api/perfil.js']) assert.doesNotMatch(R(f), /R199c/);
});
