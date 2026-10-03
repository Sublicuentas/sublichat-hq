import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// Carga las funciones puras de api/acceso.js (normPlat → canonPlat → reglas IPTV) sin Firebase.
function reglas() {
  const a = read('api/acceso.js');
  const cut = (from, to, extra = 0) => { const i = a.indexOf(from); return a.slice(i, a.indexOf(to, i) + extra); };
  const code = cut('function normPlat(', '// Convierte también') + cut('function canonPlat(', '\n}\n', 3)
    + cut('function esFamiliaIptv(', 'function tvDigitalInfo(')
    + '\n;globalThis.r={iptvMuestraUrl,iptvSoloPlan};';
  const ctx = {}; vm.createContext(ctx); vm.runInContext(code, ctx); return ctx.r;
}

test('R83 TV digital: la URL del servidor sale solo si se eligió; con Max Player nunca', () => {
  const { iptvMuestraUrl } = reglas();
  const nano = (v, extra = {}) => ({ plataforma: 'evoutouch1', visibilidadUrl: v, ...extra });
  assert.equal(iptvMuestraUrl(nano({ modo: 'plataforma' })), false, 'por defecto solo datos del plan');
  assert.equal(iptvMuestraUrl(nano({ modo: 'todos' })), true, 'usuario, clave y URL');
  assert.equal(iptvMuestraUrl(nano({ modo: 'correo_clave' })), false, 'usuario y clave, sin URL');
  assert.equal(iptvMuestraUrl(nano({ modo: 'personalizado', campos: { correo: true, clave: true, url: true } })), true);
  assert.equal(iptvMuestraUrl(nano({ modo: 'personalizado', campos: { correo: true, clave: true, url: false } })), false);
  assert.equal(iptvMuestraUrl(nano({ modo: 'personalizado', campos: { correo: true, clave: true } })), true, 'fichas viejas sin casilla URL: como antes');
  assert.equal(iptvMuestraUrl(nano({ modo: 'todos' }, { maxPlayer: true })), false, 'Max Player: solo sus credenciales');
  assert.equal(iptvMuestraUrl({ plataforma: 'netflix', visibilidadUrl: { modo: 'plataforma' } }), true, 'otras plataformas no cambian');
});

test('R83 servidor guarda la casilla URL y la web tiene Max Player + URL en personalizado', () => {
  assert.match(read('api/renovar.js'), /typeof camposRaw\.url === "boolean" \? \{ url: camposRaw\.url \} : \{\}/);
  const w = read('sublichat-app.js');
  assert.match(w, /id="fichaMaxPlayer"/); assert.match(w, /id="fichaMpUsuario"/); assert.match(w, /id="fichaMpClave"/);
  assert.match(w, /id="fichaVerUrl"/);
  assert.match(w, /return modo==="personalizado"\?\{modo,campos:\{correo,clave,pin:false,url\}\}:\{modo\};/);
  assert.match(w, /servicio\.maxPlayer=fichaGetVal\("fichaMaxPlayer"\)==="si";/);
  assert.match(w, /\*🧾 URL: \{iptvurl\}\*\{maxplayer\}/, 'la ficha de WhatsApp lleva todo, también Max Player');
});

test('R83 íconos de Perfil/Usuario/Clave más pequeños en la ficha URL', () => {
  assert.match(read('portal-cliente-publico.css'), /\.field-icon\.has-portal-image\{width:28px;height:28px;flex:0 0 28px/);
  assert.match(read('acceso.html'), /portal-cliente-publico\.css\?v=[\w-]+/); // la versión cambia en cada ajuste del portal
});
