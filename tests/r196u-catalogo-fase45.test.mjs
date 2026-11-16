// R196u Fases 4 y 5 · AutoCAD (invitación, contraseña opcional), Eleven Reader (Música, correo + contraseña) e integración.
// Datos ficticios. PDF v2.0 · 07 y pruebas CAD-01/02, ELV-01, ALL-01/02.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../api/_entrega-plataforma.js');
const { __r188: R } = await import('../api/renovar.js');
const { __r188: A } = await import('../api/acceso.js');
const { clasificarServicio, normPlataformaKey } = await import('../api/_catalogo-categorias.js');
const { resolverProducto } = await import('../api/_productos-canonicos.js');
const T = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const cli = { nombre: 'Cliente Demo' };

test('CAD-01 · AutoCAD con solo correo: se guarda en Software, sin contraseña ni PIN, invitación pendiente; la URL no muestra contraseña', () => {
  const s = R.buildServicio({ plataforma: 'autocad', correo: 'cad.demo@ejemplo.com', fechaRenovacion: '20/12/2026' }, '', {}, 'Cliente Demo');
  assert.equal(s.clave, ''); assert.equal(s.categoria, 'software'); assert.equal(s.sinPinPerfil, true);
  assert.equal(s.estadoInvitacion, 'pendiente', 'sin dato = pendiente: no se afirma que ya se envió');
  const p = A.servicioPublico(cli, s);
  assert.equal(p.plataformaLabel, 'Autodesk AutoCAD'); assert.equal(p.correo, 'cad.demo@ejemplo.com'); assert.equal(p.clave, '');
  assert.match(JSON.stringify(p.avisos), /Aceptar invitación/);
  assert.deepEqual(E.fichaInvitacionLineas({ correo: 'cad.demo@ejemplo.com' }), ['📧 *Correo invitado:* cad.demo@ejemplo.com']);
  // el servidor NO exige contraseña para AutoCAD (las 3 validaciones de alta/edición)
  assert.equal((T('api/renovar.js').match(/!entrega\.claveOpcional\(nuevo\.plataforma\) \/\* R196u · AutoCAD \*\//g) || []).length, 3);
  assert.equal(clasificarServicio({ plataforma: 'Autodesk AutoCAD' }).categoria, 'software');
});

test('CAD-02 · AutoCAD con contraseña registrada: se guarda y solo sale en la entrega (URL / ficha), nunca inventada', () => {
  const s = R.buildServicio({ plataforma: 'autocad', correo: 'cad.demo@ejemplo.com', clave: 'ClaveCad9', estadoInvitacion: 'enviada', fechaRenovacion: '20/12/2026' }, '', {}, 'Cliente Demo');
  assert.equal(s.clave, 'ClaveCad9'); assert.equal(s.estadoInvitacion, 'enviada');
  assert.equal(A.servicioPublico(cli, s).clave, 'ClaveCad9');
  assert.deepEqual(E.fichaInvitacionLineas(s), ['📧 *Correo invitado:* cad.demo@ejemplo.com', '📌 *Estado:* Invitación enviada', '🔑 *Contraseña:* ClaveCad9']);
  const app = T('sublichat-app.js');
  assert.match(app, /const fichaClaveOpcional=plat=>!fichaEsCuentaCompleta\(\)&&fichaBaseRegla\(plat\)==="autocad";/);
  assert.match(app, /clave=fichaNeedsClave\(plat\)&&\(!fichaClaveOpcional\(plat\)\|\|!!String\(fichaGetVal\("fichaClave"\)\|\|""\)\.trim\(\)\)/, 'Web: no la exige si está vacía');
  assert.match(app, /const claveLine=fichaNeedsClave\(plat\)&&\(!fichaClaveOpcional\(plat\)\|\|String\(clave\|\|""\)\.trim\(\)\)\?/, 'Web: sin contraseña no hay línea «Clave: —»');
  assert.match(app, /id="fichaEstadoInvitacion"><option value="pendiente">Pendiente de enviar<\/option><option value="enviada">Invitación enviada<\/option><option value="aceptada">Invitación aceptada<\/option>/);
});

test('ELV-01 · Eleven Reader va en Música y entrega correo + contraseña (sin PIN)', () => {
  assert.equal(normPlataformaKey('Eleven Reader'), 'elevenreader');
  assert.equal(clasificarServicio({ plataforma: 'elevenreader' }).categoria, 'musica');
  const s = R.buildServicio({ plataforma: 'elevenreader', correo: 'er.demo@ejemplo.com', clave: 'ClaveEr7', fechaRenovacion: '20/12/2026' }, '', {}, 'Cliente Demo');
  assert.equal(s.clave, 'ClaveEr7'); assert.equal(s.categoria, 'musica'); assert.equal(s.sinPinPerfil, true);
  const p = A.servicioPublico(cli, s); assert.equal(p.correo, 'er.demo@ejemplo.com'); assert.equal(p.clave, 'ClaveEr7'); assert.equal(p.usaPin, false);
  const app = T('sublichat-app.js');
  assert.match(app, /\["deezer","Deezer Premium HiFi"\],\["elevenreader","Eleven Reader"\]/);
  assert.match(app, /"viki","deezer","crunchyroll","elevenreader"\]\); \/\* R196u \*\//, 'Web: correo y contraseña siempre');
  assert.match(app, /elevenreader:\n`\*🎧 Acceso: Eleven Reader 🎧\*/);
});

test('Catálogo · nombres, Finanzas y sin tarifa fija (precio por venta)', () => {
  assert.equal(resolverProducto('Autodesk AutoCAD').id, 'autocad'); assert.equal(resolverProducto('Eleven Reader').nombre, 'Eleven Reader');
  assert.match(T('sublichat-app.js'), /autocad:0, elevenreader:0 \/\* R196u · sin tarifa fija/);
  assert.match(T('sublichat-app.js'), /\["adobeexpress","Adobe Express"\],\["autocad","Autodesk AutoCAD"\],\["windows10"/);
  assert.match(T('acceso.html'), /autocad:\{logo:"",bg:"#ffffff",fallback:"CAD"/, 'sin logo oficial: ícono de respaldo (no se crea uno con IA)');
  for (const f of ['catalogo-categorias.js']) assert.equal(T(f).split('\n').slice(4).join('\n'), T('api/_catalogo-categorias.js').split('\n').slice(4).join('\n'), 'copia del navegador = API');
});

test('ALL-01/02 · venta de VIP: una unidad suspendida o en revisión no se puede elegir en la Web; Control Maestro sin cambios', () => {
  const app = T('sublichat-app.js');
  assert.match(app, /!\["suspendido","revision"\]\.includes\(String\(c\.estadoBodega\|\|""\)\.toLowerCase\(\)\) \/\* R196u · VIP suspendida o en revisión no se vende \*\//);
  assert.doesNotMatch(T('control-maestro.js'), /R196u|autocad|elevenreader/);
  assert.match(T('index.html'), /sublichat-app\.js\?v=20261\d{3}-r196[a-z]\d?/);
});
