// R172 · Fase 3B: avatares 3D reales (CC0). Catálogo por base, migración de personajes guardados, kit GLB íntegro.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../api/_sala-juntas.js');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function jsonDeGlb(archivo) {
  const b = fs.readFileSync(archivo);
  assert.equal(b.toString('ascii', 0, 4), 'glTF'); assert.equal(b.readUInt32LE(4), 2);
  const largo = b.readUInt32LE(12); assert.equal(b.readUInt32LE(16), 0x4E4F534A);
  return JSON.parse(b.toString('utf8', 20, 20 + largo));
}

test('el catálogo del navegador (avatar-glb.js) es el mismo que valida el servidor', () => {
  const src = fs.readFileSync(path.join(ROOT, 'avatar-glb.js'), 'utf8');
  const m = src.match(/export const CATALOGO = (\{[\s\S]*?\n\});/); assert.ok(m);
  const CAT = Function('return ' + m[1])();
  assert.deepEqual(CAT, JSON.parse(JSON.stringify(S.AVATAR_GENERO)));
  for (const g of ['mujer', 'hombre']) { assert.ok(CAT[g].cabello.length >= 6, '6 peinados por base'); assert.ok(CAT[g].superior.length >= 4); assert.ok(CAT[g].calzado.length >= 3); }
  assert.ok(CAT.mujer.inferior.includes('falda') && CAT.mujer.inferior.includes('pantalon'));
});

test('cada pieza del catálogo existe como malla propia en el kit, con un solo esqueleto y compresión', () => {
  for (const g of ['mujer', 'hombre']) {
    const j = jsonDeGlb(path.join(ROOT, 'assets/avatares', g + '.glb'));
    const nombres = new Set(j.nodes.map((n) => n.name));
    for (const [slot, ids] of Object.entries(S.AVATAR_GENERO[g])) for (const id of ids) {
      const n = j.nodes.find((x) => x.name === `${slot}__${id}`); assert.ok(n, `${g}: falta ${slot}__${id}`);
      assert.equal(typeof n.mesh, 'number'); assert.deepEqual(j.skins[n.skin].joints, j.skins[0].joints, 'todas las piezas mueven los mismos huesos');
    }
    assert.ok(j.skins[0].joints.length >= 49);
    for (const h of ['Hips', 'Head', 'UpperArm.L', 'UpperArm.R', 'UpperLeg.L', 'LowerLeg.R']) assert.ok(nombres.has(h), `${g}: hueso ${h}`);
    // mallas distintas (no solo color): cada prenda tiene su propia geometría
    const mallasArriba = S.AVATAR_GENERO[g].superior.map((id) => j.nodes.find((x) => x.name === `superior__${id}`).mesh);
    assert.equal(new Set(mallasArriba).size, mallasArriba.length);
    assert.ok(j.extensionsUsed.includes('EXT_meshopt_compression'));
    assert.ok(j.materials.some((m) => m.name.startsWith('piel__')) && j.materials.some((m) => m.name.startsWith('cabello__')));
    assert.ok(fs.statSync(path.join(ROOT, 'assets/avatares', g + '.glb')).size < 1.2e6, 'kit liviano para Android');
  }
  const lic = fs.readFileSync(path.join(ROOT, 'assets/avatares/LICENCIAS.md'), 'utf8');
  assert.match(lic, /CC0 1\.0/); assert.match(lic, /c664c6f231d3dd522b38ba52fc39ec33028624e2/);
});

test('migración: personajes guardados con el editor anterior pasan a piezas reales sin perder colores', () => {
  const viejo = { genero: 'mujer', cabello: 'cola', superior: 'polo', inferior: 'falda', calzado: '#7A1F2B', colorSuperior: '#2B4C7E', cejas: 'suaves', lentes: true };
  const c = S.limpiarAvatar(viejo, S.AVATAR_BASE.geisell);
  assert.equal(c.cabello, 'recogido'); assert.equal(c.superior, 'camiseta'); assert.equal(c.inferior, 'falda');
  assert.equal(c.calzado, 'formal'); assert.equal(c.colorCalzado, '#7A1F2B'); assert.equal(c.colorSuperior, '#2B4C7E'); assert.equal(c.lentes, true);
  assert.equal(c.cejas, undefined);
  const h = S.limpiarAvatar({ genero: 'hombre', cabello: 'melena', superior: 'blazer', inferior: 'falda' }, S.AVATAR_BASE.naara);
  assert.equal(h.cabello, 'largoMedio'); assert.equal(h.superior, 'traje'); assert.equal(h.inferior, 'pantalon');
});

test('las piezas siempre corresponden a la base elegida; mujer sin bigote', () => {
  const c = S.limpiarAvatar({ genero: 'mujer', cabello: 'conBarba', superior: 'traje', calzado: 'tenis', barba: true }, S.AVATAR_BASE.libni);
  assert.ok(S.AVATAR_GENERO.mujer.cabello.includes(c.cabello)); assert.ok(S.AVATAR_GENERO.mujer.superior.includes(c.superior));
  assert.ok(S.AVATAR_GENERO.mujer.calzado.includes(c.calzado)); assert.equal(c.barba, false);
  for (const id of ['naara', 'libni', 'geisell']) assert.deepEqual(S.limpiarAvatar(S.AVATAR_BASE[id], S.AVATAR_BASE[id]), { ...S.AVATAR_BASE[id], nombre: '' }, 'base válida tal cual (R177: + nombre visible vacío)');
});
