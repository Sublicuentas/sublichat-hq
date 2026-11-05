// R162 · Prueba de navegador: el menú (diseño nuevo y anterior) respeta los módulos que define Sublicuentas.
// Datos y API simulados (arnes.mjs). Uso: node tests/visual/r162-menu.mjs [carpetaCapturas]
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { abrir } from './arnes.mjs';

const salida = process.argv[2] || '';
if (salida) fs.mkdirSync(salida, { recursive: true });
const cfg = (u, modulos) => ({ usuarios: { [u]: { modulos } } });
const casos = [
  { usuario: 'naara', ui: 'v2', tiene: ['inicio', 'clientes', 'agenda', 'control-cuentas', 'revendedores', 'inventario', 'egresos', 'cierre', 'actividad', 'auditoria', 'crm-master', 'estadisticas', 'permisos', 'chat'], no: [] },
  { usuario: 'relojes', ui: 'v2', tiene: ['inicio', 'clientes', 'sorteos', 'portal-cliente', 'catalogo-relojes', 'importar'], no: ['control-cuentas', 'permisos', 'revendedores', 'actividad', 'inventario'] },
  { usuario: 'relojes', ui: 'v2', permisos: cfg('relojes', { sorteos: false, 'control-maestro': true, pelis: false }), tiene: ['control-cuentas', 'portal-cliente'], no: ['sorteos', 'pelis', 'permisos'] },
  { usuario: 'geisell', ui: 'v2', tiene: ['inicio', 'clientes', 'control-cuentas', 'tickets'], no: ['sorteos', 'permisos', 'importar', 'pelis'] },
  { usuario: 'geisell', ui: 'v2', permisos: cfg('geisell', { 'control-maestro': false, bodega: true }), tiene: ['inventario', 'clientes'], no: ['control-cuentas'] },
  { usuario: 'relojes', ui: 'v1', permisos: cfg('relojes', { sorteos: false, 'control-maestro': true }), tiene: ['control-cuentas'], no: ['sorteos', 'permisos'] },
];
let n = 0;
for (const c of casos) {
  const h = await abrir({ usuario: c.usuario, ui: c.ui, ancho: c.ui === 'v2' ? 1366 : 1366, permisos: c.permisos || null });
  try {
    await h.page.waitForTimeout(800);
    const items = await h.page.evaluate((ui) => ui === 'v2'
      ? [...new Set([...document.querySelectorAll('#v2Fila [data-s], #v2PanelIn [data-s]')].map((b) => b.dataset.s))].filter((x) => x !== 'perfil')
      : [...document.querySelectorAll('.nav-btn[data-screen]')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.dataset.screen), c.ui);
    for (const s of c.tiene) assert.ok(items.includes(s), `${c.usuario}/${c.ui}: falta ${s} · menú=${items.join(',')}`);
    for (const s of c.no) assert.ok(!items.includes(s), `${c.usuario}/${c.ui}: sobra ${s} · menú=${items.join(',')}`);
    assert.ok(!items.some((s) => /activar/i.test(s)), 'Activar TV no debe salir');
    if (c.ui === 'v2') {
      const tv = await h.page.evaluate(() => /activar\s*tv/i.test(document.getElementById('v2Shell').textContent));
      const lateral = await h.page.evaluate(() => !!document.querySelector('.v2-side, #sidebarWrap:not([style*="none"]) .nav') && getComputedStyle(document.getElementById('sidebarWrap')).display !== 'none');
      assert.equal(lateral, false, 'sin menú lateral');
      assert.equal(tv, false, 'Activar TV no debe salir');
      // Pantalla no permitida: ir a ella no la abre.
      for (const s of c.no.filter((x) => x !== 'permisos')) {
        await h.page.evaluate((s) => window.SublichatRBAC.ir(s), s);
        await h.page.waitForTimeout(150);
        const act = await h.page.evaluate(() => document.querySelector('.wrap > .screen.active')?.id);
        assert.notEqual(act, 'screen-' + s, `${c.usuario}: abrió ${s} sin permiso`);
      }
    }
    assert.deepEqual(h.errores, [], 'errores JS: ' + h.errores.join(' | '));
    n++; console.log('ok', c.usuario, c.ui, c.permisos ? '(con cambios)' : '', '→', items.length, 'pantallas');
  } finally { await h.cerrar(); }
}
if (salida) { // menú móvil abierto y menú del usuario
  const h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 390, alto: 844 });
  await h.page.click('#v2Menu'); await h.page.waitForTimeout(400);
  await h.page.screenshot({ path: path.join(salida, 'v2-naara-390-menu-abierto.png') });
  await h.cerrar();
  const k = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1366 });
  await k.page.click('#v2User'); await k.page.waitForTimeout(300);
  await k.page.screenshot({ path: path.join(salida, 'v2-naara-1366-menu-usuario.png') });
  await k.page.click('[data-v2a="anterior"]'); await k.page.waitForTimeout(3000);
  const v = await k.page.evaluate(() => ({ clase: document.documentElement.classList.contains('ui-v2'), flag: localStorage.getItem('sublichat_ui_v2') }));
  assert.deepEqual(v, { clase: false, flag: null }, '"Diseño anterior" debe volver al diseño actual');
  console.log('ok Diseño anterior vuelve al diseño actual');
  await k.cerrar();
}
console.log(`R162 menú por permisos: ${n}/${casos.length} casos OK`);
