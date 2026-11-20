// R199 · Tema Lego (opcional por usuario, solo celular) — Fases 1 y 2 + Inicio.
// Solo presentación: ni rutas, ni endpoints de negocio, ni datos cambian.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = R('sublichat-app.js'), css = R('ui-lego.css'), html = R('index.html'), perfil = R('api/perfil.js');

test('A/E · Ejecutivo por defecto: sin preferencia o sin sesión el atributo es «ejecutivo»; la preferencia es POR USUARIO', () => {
  assert.match(app, /function temaUiActual\(\)\{ return String\(readProfile\(\)\.temaUi\|\|''\)==='lego'\?'lego':'ejecutivo'; \}/);
  assert.match(app, /const t=currentUser\(\)\?temaUiActual\(\):'ejecutivo';/);
  assert.match(app, /function profileKey\(\)\{return 'sublichat_profile_'\+norm\(currentUser\(\)/, 'el perfil local va por usuario: otro usuario no hereda el tema');
});

test('B/C · se guarda en el perfil del usuario (servidor) y se vuelve a aplicar al cargar; al cerrar sesión vuelve a Ejecutivo', () => {
  assert.match(app, /temaUi:p\.temaUi\|\|'',banner:/);
  assert.match(perfil, /if \(body\.temaUi === 'lego' \|\| body\.temaUi === 'ejecutivo'\) update\.temaUi = body\.temaUi;/, 'solo dos valores; vacío no borra lo guardado en otro equipo');
  assert.match(app, /function updateTopAdvisor\(\)\{\n    aplicarTemaUi\(\); \/\/ R199/);
  assert.match(app, /window\.addEventListener\('sublichat:profile-changed',aplicarTemaUi\);/);
  assert.match(app, /document\.documentElement\.dataset\.ui='ejecutivo'; \/\/ R199 · el login siempre se ve Ejecutivo/);
});

test('Mi perfil: selector de dos opciones (Clásico / Ejecutivo y Tema Lego) con radio accesible', () => {
  assert.match(app, /id="profTemaUi"/);
  assert.match(app, /role="radiogroup" aria-label="Tema de interfaz"/);
  assert.equal((app.match(/data-tema-ui="(ejecutivo|lego)"/g) || []).length, 2);
  assert.match(app, /elegirTemaUi\(t\);renderPerfil\(\);/);
});

test('D · todo el tema vive bajo html[data-ui="lego"]: sin el atributo (Ejecutivo) nada cambia, en PC ni en celular', () => {
  const sinSelector = css.slice(0, css.indexOf('/* ---------- Selector «Tema de interfaz»'));
  assert.ok(sinSelector.length > 1000);
  const reglas = sinSelector.match(/^\s*[^@\s/}][^{;]*\{/gm) || [];
  const fuera = reglas.filter((r) => !/html\[data-ui="lego"\]/.test(r) && !/^\s+(to|from|\d+%)/.test(r));
  assert.deepEqual(fuera, [], 'ninguna regla del tema fuera del atributo lego');
  assert.match(css, /@media \(max-width: 767\.98px\) \{/, 'bloque celular');
  assert.match(css, /@media \(min-width: 768px\) \{/, 'bloque PC (R199d)');
  assert.match(html, /<link rel="stylesheet" href="\.\/ui-lego\.css\?v=20261120-r199[a-z]">/);
});

test('Recursos: Sublirobot original y renders en WebP livianos; respeta reduced-motion; sin colores neón', () => {
  for (const f of ['sublirobot', 'calendario', 'reloj', 'alerta', 'campana', 'clientes-panel', 'cartera', 'grafica', 'popcorn', 'ticket', 'casa', 'clientes', 'renovacion', 'mensajes', 'mas', 'robot-saludando']) {
    const st = fs.statSync(new URL(`../assets/lego/${f}.webp`, import.meta.url)); assert.ok(st.size > 1000 && st.size < 60000, f);
  }
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /url\("\/assets\/lego\/sublirobot\.webp"\)/);
});

test('P · sin cambios de negocio: el tema no agrega acciones a ningún endpoint de datos', () => {
  for (const f of ['api/finanzas.js', 'api/renovar.js', 'api/inventario.js']) assert.doesNotMatch(R(f), /temaUi|data-ui/);
});
