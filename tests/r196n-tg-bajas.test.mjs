// R196n · PDF «Correcciones puntuales» Fase 3 (T-01 a T-03). La prueba en navegador está en tests/visual/r196n-cm-bajas.mjs.
// Aquí: el registro compartido (Papelera de Integridad, por ID interno) llega a Control Maestro y se aplica al FINAL.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const R = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('servidor: cuentasBaja lee la Papelera (kind inventario_cuenta, status deleted, por ID de origen) sin escribir nada', () => {
  const s = R('api/inventario.js'), i = s.indexOf('if (accion === "cuentasBaja")'), blk = s.slice(i, s.indexOf('const usuarioAccion', i));
  assert.ok(i > 0);
  assert.match(blk, /collection\("papelera_operaciones"\)\.where\("kind", "==", "inventario_cuenta"\)/);
  assert.match(blk, /x\.status === "deleted" && x\.source && x\.source\.collection === "inventario" && x\.source\.id/);
  assert.doesNotMatch(blk, /\.(set|update|delete|add)\(/, 'solo lectura');
  assert.ok(s.indexOf('if (accion === "cuentasBaja")') > s.indexOf('if (!puedeInventario)'), 'mismos permisos de Control Maestro');
});

test('Control Maestro: la cuenta dada de baja deja de mostrarse como activa (sin tocar fichas) y nada la reconstruye', () => {
  const cm = R('control-maestro.js');
  assert.match(cm, /cuentasBaja:Array\.isArray\(x\.cuentasBaja\)\?x\.cuentasBaja:\[\]/);
  const filtro = cm.indexOf('if(bajas.size)groups.forEach((g,key)=>{if(!g.inventoryAccounts.length&&bajas.has(key))groups.delete(key);});');
  assert.ok(filtro > cm.indexOf('g.excelRows.push(entry)'), 'se aplica después de Clientes y del Excel de respaldo');
  assert.ok(filtro < cm.indexOf('const revisions=new Map'), 'antes de armar la lista visible');
  const app = R('sublichat-app.js');
  assert.match(app, /body:JSON\.stringify\(\{accion:'cuentasBaja'\}\)/);
  assert.match(app, /cuentasBaja:CUENTAS_BAJA\.map/);
  assert.match(R('index.html'), /control-maestro\.js\?v=20261112-r196n/);
});
