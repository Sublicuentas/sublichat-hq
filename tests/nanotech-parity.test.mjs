import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

// Nanotech (antes EvouTouch) debe tener la MISMA tabla de planes en el CRM web,
// el servidor y la acceso pública; el bot y la app Android usan también 1/3/6/12.
test('Nanotech: planes 1/3/6/12 meses en CRM web, renovar.js y acceso.js', () => {
  for (const file of ['sublichat-app.js', 'api/renovar.js', 'api/acceso.js']) {
    assert.match(read(file), /evoutouch:\s*\[1,\s*3,\s*6,\s*12\]/, `${file} debe usar evoutouch:[1,3,6,12]`);
  }
});

test('Nanotech: el CRM web guarda evoutouch1/2/3 según dispositivos (ya no evoutouch4)', () => {
  const web = read('sublichat-app.js');
  assert.doesNotMatch(web, /return\s+"evoutouch4"/, 'la clave guardada/de precio ya no puede ser evoutouch4');
  assert.match(web, /plat==="evoutouch"\?\[1,2,3\]/, 'dispositivos permitidos de Nanotech: 1, 2 y 3');
  assert.match(web, /evoutouch2:"Nanotech \(2 dispositivos\)"/, 'etiqueta visible Nanotech');
});


test('Nanotech: una compra creada en TG se abre como Nanotech y nunca cae al fallback Netflix', () => {
  const web = read('sublichat-app.js');
  assert.match(web, /n\.includes\("evoutouch"\).*n\.includes\("nanotech"\).*return "evoutouch"/s);
  assert.match(web, /nanotech\|iptv\)\(\[1-5\]\)\$\//, 'debe recuperar también la cantidad desde alias Nanotech');
});

test('Nanotech: si la visibilidad personalizada no muestra credenciales, tampoco expone URL/servidor', () => {
  const api = read('api/acceso.js');
  assert.match(api, /function tvDigitalOcultaServidor\(servicio = \{\}\)/);
  assert.match(api, /urlServidor: \(tvDigitalOcultaServidor\(servicio\) \|\| iptvSoloPlan\(servicio\)\) \? "" : \(tvDigital\.urlServidor \|\| ""\)/); // R58: IPTV por defecto solo plan
});
