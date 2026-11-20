// R199b · Tema Lego móvil — Fase 3 (Clientes y Renovaciones) + Inicio sin «Registrar renovación».
// Solo piel: mismo HTML, mismos botones, mismos datos. Ejecutivo y escritorio intactos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const css = R('ui-lego.css'), html = R('index.html'), inicio = R('ui-v2-inicio.js'), app = R('sublichat-app.js');
const fase3 = css.slice(css.indexOf('R199b · FASE 3'), css.indexOf('R199c (solo celular): indicadores en 2 columnas'));
const P = 'html[data-ui="lego"]:not(#lgA):not(#lgB):not(#lgC):not(#lgD):not(#lgE):not(#lgF) body';

test('Inicio: sin botón «Registrar renovación» (celular y web); la acción sigue en Clientes/Agenda', () => {
  assert.doesNotMatch(inicio.replace(/\/\/[^\n]*/g, ''), /Registrar renovaci[oó]n/);
  assert.match(inicio, /R199b · sin botón «Registrar renovación» en Inicio/);
  assert.match(html, /\/ui-v2-inicio\.js\?v=20261120-r199b/);
  assert.match(app, /data-rbac-pagado=/, 'Pagado +30 de la agenda no se tocó');
  assert.match(app, /data-client-renew=/, 'Renovar de Clientes no se tocó');
});

test('Fase 3 vive dentro del bloque móvil y cada regla lleva el prefijo Lego de 6 IDs (gana a ui-v2 sin tocarlo)', () => {
  assert.ok(fase3.length > 3000);
  const inicioMedia = css.indexOf('@media (max-width: 767.98px) {'), finMedia = css.indexOf('/* ---------- Selector «Tema de interfaz»');
  assert.ok(css.indexOf('R199b · FASE 3') > inicioMedia && css.indexOf('R199b · FASE 3') < finMedia);
  const reglas = fase3.match(/^\s+html[^{]*\{/gm) || [];
  assert.ok(reglas.length > 40);
  for (const r of reglas) for (const sel of r.replace(/\{$/, '').split(/,\s*\n/)) assert.ok(sel.trim().startsWith(P), sel.trim().slice(0, 90));
  assert.match(html, /ui-lego\.css\?v=20261120-r199[b-z]/);
});

test('Clientes: hero con ícono y Sublirobot, CRM rojo 3D, pestaña activa roja, filtros 3D, tarjeta con tetones y Renovar verde', () => {
  assert.match(fase3, /url\("\/assets\/lego\/clientes\.webp"\)/);
  assert.match(fase3, /var\(--lgi-robot, url\("\/assets\/lego\/sublirobot\.webp"\)\)/);
  assert.match(fase3, /#clientesNuevaFicha \{[^}]*max-width: none !important[^}]*background-color: var\(--lg-red\)/s, 'anula el max-width heredado que lo encogía');
  assert.match(fase3, /\.clientes-tabs button\.active \{[^}]*var\(--lg-red\)/s);
  assert.match(fase3, /\.clientes-filters \{[^}]*repeat\(3, minmax\(0, 1fr\)\)/s);
  assert.match(fase3, /#tbody > tr::before \{[^}]*var\(--lg-stud2\)/s);
  assert.match(fase3, /\.client-renew-btn \{[^}]*var\(--lg-green\)/s);
  assert.match(fase3, /:has\(\.client-actions-menu\.show/, 'el menú ⋮ no queda recortado por la tarjeta');
  assert.doesNotMatch(fase3, /:is\(#screen-clientes, #screen-agenda\) > \.card \{[^}]*overflow: hidden/s, 'la tarjeta contenedora no recorta menús');
});

test('Renovaciones: KPIs con ícono por estado y filas con tira de color (venc rojo, hoy amarillo, próx azul); Pagado +30 rojo 3D', () => {
  assert.match(fase3, /url\("\/assets\/lego\/calendario\.webp"\)/);
  assert.match(fase3, /\.rbac-card \{[^}]*--lg-ico: url\("\/assets\/lego\/alerta\.webp"\)/s);
  assert.match(fase3, /\.rbac-card\.hoy \{[^}]*--lg-yellow/);
  assert.match(fase3, /\.rbac-card\.prox \{[^}]*--lg-blue/);
  assert.match(fase3, /\.rbac-row\.venc \{ --lg-c: var\(--lg-red\)/);
  assert.match(fase3, /\.rbac-row\.hoy \{ --lg-c: var\(--lg-yellow\)/);
  assert.match(fase3, /\.rbac-btn\.good \{[^}]*var\(--lg-red\)/s);
  assert.match(fase3, /#rbac-agenda \.rbac-grid/, 'los KPI de Mi perfil (.rbac-card) no se tocan: todo va bajo #rbac-agenda');
});

test('Solo presentación: no se crean textos, KPIs ni filtros nuevos; sin degradados lineales ni content con texto', () => {
  assert.doesNotMatch(fase3, /content:\s*"[^"]+"/, 'ningún pseudo-elemento escribe texto');
  assert.doesNotMatch(fase3, /linear-gradient/);
  assert.doesNotMatch(fase3, /display:\s*none[^;]*;[^}]*#(fRecPeriodo|fEstado)/);
});
