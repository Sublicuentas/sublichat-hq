// R200f · Condiciones del servicio iguales en URL pública, ficha Web y APK (22/11/2026, pedido del dueño).
// Perfiles: Netflix Premium, HBO Max, Prime Video, Crunchyroll, Disney Premium, Disney Standard, ViX+.
// Netflix VIP: dispositivo de su preferencia, no en simultáneo. Cuenta completa: sin las condiciones de perfil.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { __r188: A } = await import('../api/acceso.js');

const CUATRO = ['!Cuenta solo para 1 dispositivo, no se permite acceder en otro.', 'No se modifica perfil.', 'Conexión válida en Honduras.', 'Garantía vigente al cumplir indicaciones.'];
const cliente = { nombre: 'Cliente Prueba', telefono: '99990000' };
const srv = (plataforma, extra = {}) => A.servicioPublico(cliente, { plataforma, fechaRenovacion: '04/12/2030', correo: 'x@prueba.test', clave: 'k', pin: '1234', ...extra });

test('1 · URL: las 7 plataformas de perfil llevan las 4 condiciones (la 1.ª destacada)', () => {
  for (const p of ['netflix', 'hbomax', 'primevideo', 'crunchyroll', 'disneyp', 'disneys', 'vix']) assert.deepEqual(srv(p).terminos.slice(0, 4), CUATRO, p);
  assert.ok(srv('primevideo').terminos.includes('Compras y rentas de películas no disponible.'), 'Prime conserva su nota');
});

test('2 · URL: Netflix VIP con su texto; cuenta completa SIN condiciones de perfil', () => {
  const vip = srv('vipnetflix').terminos;
  assert.deepEqual(vip, ['Puede usarla en el dispositivo de su preferencia.', '!No se puede usar en dos dispositivos en simultáneo.', 'Garantía vigente al cumplir indicaciones.']);
  for (const p of ['netflix', 'hbomax', 'disneyp']) {
    const t = srv(p, { tipoVenta: 'cuenta_completa' }).terminos.join(' | ');
    assert.doesNotMatch(t, /1 dispositivo|No se modifica perfil|Conexión válida en Honduras/, p);
    assert.match(t, /Cuenta completa de uso exclusivo/);
  }
});

test('3 · URL: clave en una sola línea y el PIN abajo (ya no van lado a lado)', () => {
  const h = fs.readFileSync(new URL('../acceso.html', import.meta.url), 'utf8');
  assert.doesNotMatch(h, /field-pair">\$\{fieldRow\("Clave"/);
  assert.match(h, /if\(p\.clave\)campos\+=fieldRow\("Clave",p\.clave,`\$\{prefix\}-clave`\);\n\s+if\(usaPin\)campos\+=infoRow\("PIN"/);
});

function plantillas(src, objeto) {
  const i = src.indexOf(objeto); const out = {};
  const re = /\n\s+([A-Za-z0-9]+):\s*\n?`((?:[^`\\]|\\.)*)`/g; re.lastIndex = i;
  let m; let n = 0;
  while ((m = re.exec(src)) && n++ < 60) { if (out[m[1]]) break; out[m[1]] = m[2]; }
  return out;
}
test('4 · ficha Web (WhatsApp): mismas condiciones; sin «No usar VPN» ni el aviso viejo en esas 7; VIP y completa aparte', () => {
  const w = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  const T = plantillas(w, 'const FICHA_TEMPLATES='), M = plantillas(w, 'const FICHA_REGLAS_MULTIPERFIL=');
  for (const p of ['netflix', 'hbomax', 'primevideo', 'crunchyroll', 'disneyp', 'disneys', 'vix']) {
    assert.match(T[p], /🚨 Condiciones del servicio:\n📌 Cuenta solo para 1 dispositivo, no se permite acceder en otro\.\n📌 No se modifica perfil\.\n📌 Conexión válida en Honduras\.\n📌 Garantía vigente al cumplir indicaciones\./, p);
    assert.match(M[p], /📌 Cada perfil es solo para 1 dispositivo, no se permite acceder en otro\.\n📌 No se modifican los perfiles\.\n📌 Conexión válida en Honduras\.\n📌 Garantía vigente al cumplir indicaciones\./, 'multiperfil ' + p);
    for (const x of [T[p], M[p]]) { assert.doesNotMatch(x, /No usar vpn|Prohibido usar VPN|IMPORTANTE: (CUENTA|CADA PERFIL) SOLO/i, p); assert.equal(x.match(/Condiciones del servicio/g).length, 1, p); }
  }
  assert.match(T.vipnetflix, /📌 Puede usarla en el dispositivo de su preferencia\.\n📌 No se puede usar en dos dispositivos en simultáneo\.\n📌 Garantía vigente al cumplir indicaciones\./);
  assert.match(T.cuentaCompleta, /Cuenta completa de uso exclusivo/); assert.doesNotMatch(T.cuentaCompleta, /No se modifica perfil/);
  assert.match(T.hbomax, /Código de hogar/); assert.match(T.netflix, /Aviso de Sistema/);
});
