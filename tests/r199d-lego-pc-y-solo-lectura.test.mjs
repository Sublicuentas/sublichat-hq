// R199d · Tema Lego en PC (≥768) + Control Maestro móvil solo consulta + Catálogo retirado de Sublichat.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const css = R('ui-lego.css'), html = R('index.html'), app = R('sublichat-app.js'), cm = R('control-maestro.js'), cmCss = R('control-maestro.css'), v2 = R('ui-v2.js');
const pc = css.slice(css.indexOf('R199d · TEMA LEGO EN PC'));

test('PC: bloque ≥768 bajo data-ui="lego"; barra de pestañas horizontal (sin barra lateral) con activa roja y submenús', () => {
  assert.ok(pc.length > 6000);
  assert.match(pc, /@media \(min-width: 768px\) \{/);
  for (const r of pc.match(/^\s*html[^{]*\{/gm) || []) assert.match(r.trim(), /^html\[data-ui="lego"\]/);
  assert.match(pc, /#v2Fila \.v2-tab:is\(\.on, \[aria-expanded="true"\]\) \{[^}]*var\(--lg-red\)/s);
  assert.match(pc, /\.v2-pop \.v2-mi \{/);
  assert.doesNotMatch(pc, /position:\s*fixed[^}]*left:\s*0[^}]*height:\s*100/s, 'no se inventa barra lateral fija');
  assert.match(pc, /max-width: 1279\.98px/, 'portátil: pestañas compactas para no esconder Finanzas');
});

test('PC: portadas con Sublirobot solo en Inicio y Finanzas; Clientes, Renovaciones y Mi perfil con piezas 3D', () => {
  assert.match(pc, /#v2Inicio \.v2-cab::after \{[^}]*sublirobot\.webp/s);
  assert.match(pc, /#screen-finanzas \.fz-head::after \{[^}]*sublirobot\.webp/s);
  assert.equal((pc.match(/sublirobot\.webp/g) || []).length, 2, 'no repetir la mascota en cada subpágina');
  assert.match(pc, /#screen-clientes #tbody \.client-renew-btn \{[^}]*var\(--lg-green\)/s);
  assert.match(pc, /#rbac-agenda \.rbac-btn\.good \{[^}]*var\(--lg-red\)/s);
  assert.match(pc, /#rbac-perfil > \.profile-cover \{[^}]*border: 3px solid var\(--lg-red\)/s);
});

test('Tokens y componentes comunes valen en PC y celular; la preferencia es la misma en ambos (perfil del usuario)', () => {
  assert.ok(css.indexOf('/* ---------- Tokens del tema (PC y celular)') < css.indexOf('@media (max-width: 767.98px) {'));
  assert.ok(css.indexOf('R199d · COMPONENTES LEGO COMUNES') > 0);
  assert.match(app, /Personalice la apariencia de Sublichat en PC y celular\. Solo cambia para usted\./);
  assert.match(app, /function temaUiActual\(\)\{ return String\(readProfile\(\)\.temaUi\|\|''\)==='lego'\?'lego':'ejecutivo'; \}/, 'Ejecutivo por defecto');
  assert.match(app, /temaUi:p\.temaUi\|\|''/, 'se guarda en el perfil del servidor: PC y celular la leen igual');
  assert.match(html, /ui-lego\.css\?v=20261120-r199d/);
});

test('Control Maestro en celular: solo consulta (ambos temas). Se bloquean las acciones que escriben; la PC conserva todo', () => {
  assert.match(cm, /function cmSoloLecturaMovil\(\)\{try\{return window\.matchMedia\('\(max-width: 767\.98px\)'\)\.matches;/);
  for (const a of ['data-cm-review-ok', 'data-cm-review-issue', 'data-cm-delete-account', 'data-cm-delete-service', 'data-cm-edit-service', 'data-cm-remove-assignment', 'data-cm-action="save-backup"', 'data-cm-action="review"', 'data-sp-revisada', 'data-sp-incidencia']) {
    assert.ok(cm.includes('[' + a + ']'), a); assert.ok(cmCss.includes('[' + a + ']'), a + ' oculto en celular');
  }
  assert.match(cm, /event\.preventDefault\(\);event\.stopImmediatePropagation\(\);/);
  assert.match(cm, /\},true\);\n    screen\.addEventListener\('click',controlDelegatedClick,false\);/, 'en captura: corre antes que cualquier acción');
  assert.ok(!/data-cm-action="generate-download"|data-cm-open-workspace|data-cm-audit-platform/.test(cm.slice(cm.indexOf('const CM_ACCIONES_ESCRITURA'), cm.indexOf('function cmSoloLecturaMovil'))), 'consultar, abrir plataformas y descargar siguen');
  assert.match(cmCss, /@media \(max-width: 767\.98px\)/);
  assert.match(html, /control-maestro\.js\?v=20261120-r199d/);
});

test('Catálogo de Relojes retirado de Sublichat (menú y ruta) en ambos temas; su página y API siguen intactas', () => {
  assert.match(app, /function can\(screen\)\{\n    if\(screen==='catalogo-relojes'\)return false; \/\/ R199d/);
  assert.doesNotMatch(v2.slice(v2.indexOf('var NAV = ['), v2.indexOf('];', v2.indexOf('var NAV = ['))), /catalogo-relojes/);
  assert.ok(fs.existsSync(new URL('../api/catalogo-relojes.js', import.meta.url)));
  assert.doesNotMatch(R('api/catalogo-relojes.js'), /R199d/);
});
