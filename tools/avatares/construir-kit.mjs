// R172 · SubliStudio 3D · Fase 3B — arma los kits de avatar (uno por base) a partir de modelos CC0 de Quaternius.
// Uso (solo desarrollo, no corre en Vercel):
//   node tools/avatares/construir-kit.mjs <carpeta con modular_women/ y modular_men/> <salida assets/avatares>
// Requiere @gltf-transform/core y @gltf-transform/functions (dev). Origen y licencia: assets/avatares/LICENCIAS.md
//
// Cada pieza (cabeza+cabello, superior, inferior, calzado, accesorio) queda como un nodo con malla propia, todas
// enlazadas al MISMO esqueleto de su base; los materiales se renombran por rol para poder recolorear:
//   piel__… · cabello__… · ojos__… · cejas__… · principal__… · secundario__… · fijo__…
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, quantize, unpartition, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

const [orig, salida] = process.argv.slice(2);
if (!orig || !salida) { console.error('uso: construir-kit.mjs <origen> <salida>'); process.exit(1); }

// pieza: [id, archivo, nodo, { ocultar: [materiales a quitar], cabello: [materiales que son cabello], solo: [materiales a conservar] }]
export const CATALOGO = {
  mujer: {
    carpeta: 'modular_women', base: 'Suit',
    cabello: [
      ['melena', 'Suit', 'Suit_Head', { cabello: ['Hair_Blond', 'Hair_Brown'] }],
      ['recogido', 'Formal', 'Formal_Head', { cabello: ['Red'] }],
      ['lacio', 'Soldier', 'Soldier_Head', { cabello: ['*hair'] }],
      ['corto', 'SciFi', 'SciFi_Head', { cabello: ['*hair', 'Blue'] }],
      ['ondulado', 'Worker', 'Worker_Head', { ocultar: ['Worker_Yellow'], cabello: ['DarkBrown'] }],
      ['largo', 'Witch', 'Witch_Head', { ocultar: ['Purple', 'Gold'], cabello: ['Hair_Black'] }],
    ],
    superior: [
      ['blazer', 'Suit', 'Suit_Body'], ['blusa', 'Casual', 'Casual_Body'], ['vestido', 'Formal', 'Formal_Body'],
      ['camiseta', 'Soldier', 'Soldier_Body'], ['chaqueta', 'SciFi', 'SciFi_Body'],
    ],
    inferior: [['pantalon', 'Suit', 'Suit_Legs'], ['falda', 'Formal', 'Formal_Legs'], ['casual', 'Casual', 'Casual_Legs']],
    calzado: [['formal', 'Suit', 'Suit_Feet'], ['tacon', 'Formal', 'Formal_Feet'], ['casual', 'Casual', 'Casual_Feet'], ['botas', 'Soldier', 'Soldier_Feet']],
    accesorio: [],
  },
  hombre: {
    carpeta: 'modular_men', base: 'Suit',
    cabello: [
      ['clasico', 'Suit', 'Suit_Head', { cabello: ['Hair'] }],
      ['moderno', 'Beach', 'Beach_Head', { ocultar: ['Earrings'], cabello: ['Hair'] }],
      ['rizado', 'Casual', 'Casual_Head', { cabello: ['Hair'] }],
      ['largoMedio', 'Casual2', 'Casual2_Head', { cabello: ['Hair'] }],
      ['conBarba', 'Adventurer', 'Adventurer_Head', { cabello: ['Hair'] }],
      ['cresta', 'Punk', 'Punk_Head', { cabello: ['*hair', 'Red'] }],
    ],
    superior: [['traje', 'Suit', 'Suit_Body'], ['sueter', 'Casual', 'Casual_Body'], ['camiseta', 'Casual2', 'Casual2_Body'], ['chaleco', 'Punk', 'Punk_Body']],
    inferior: [['pantalon', 'Suit', 'Suit_Legs'], ['jeans', 'Casual2', 'Casual2_Legs'], ['shorts', 'Casual', 'Casual_Legs']],
    calzado: [['formal', 'Suit', 'Suit_Feet'], ['tenis', 'Casual', 'Casual_Feet'], ['casual', 'Casual2', 'Casual2_Feet']],
    accesorio: [['aretes', 'Beach', 'Beach_Head', { solo: ['Earrings'] }], ['bigote', 'Worker', 'Worker_Head', { solo: ['Moustache'], cabello: ['Moustache'] }]],
  },
};

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const esCabello = (nombre, reglas = []) => reglas.some((r) => (r === '*hair' ? /hair/i.test(nombre) : r === nombre));

async function construir(genero) {
  const C = CATALOGO[genero];
  const dir = path.join(orig, C.carpeta);
  const doc = await io.read(path.join(dir, C.base + '.glb'));
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const escena = root.listScenes()[0];
  const armadura = escena.listChildren().find((n) => n.listChildren().some((c) => c.getName() === 'Root') || n.getName() === 'Root') || escena.listChildren()[0];
  // quitar las mallas originales de la base (se vuelven a agregar como piezas)
  const originales = root.listNodes().filter((n) => n.getMesh());
  const fuentes = {};
  const piezas = [];
  for (const slot of ['cabello', 'superior', 'inferior', 'calzado', 'accesorio']) for (const [id, archivo, nodo, op = {}] of C[slot]) piezas.push({ slot, id, archivo, nodo, op });
  for (const p of piezas) {
    if (!fuentes[p.archivo]) {
      const src = await io.read(path.join(dir, p.archivo + '.glb'));
      const mapa = mergeDocuments(doc, src);
      fuentes[p.archivo] = { mapa, src };
    }
    const { mapa, src } = fuentes[p.archivo];
    const nSrc = src.getRoot().listNodes().find((n) => n.getName() === p.nodo);
    if (!nSrc) throw new Error(`${genero}: no existe ${p.nodo} en ${p.archivo}`);
    const n = mapa.get(nSrc);
    // copia propia de la malla (la misma cabeza puede dar dos piezas: peinado y accesorio)
    const malla = doc.createMesh(`${p.slot}_${p.id}`);
    for (const prim of n.getMesh().listPrimitives()) {
      const mat = prim.getMaterial(); const mn = mat ? mat.getName() : '';
      if (p.op.ocultar && p.op.ocultar.includes(mn)) continue;
      if (p.op.solo && !p.op.solo.includes(mn)) continue;
      const pr = prim.clone();
      const rol = mn === 'Skin' ? 'piel' : esCabello(mn, p.op.cabello) ? 'cabello' : mn === 'Eye' || (p.slot === 'cabello' && mn === 'Brown' && prim.getAttribute('POSITION').getCount() <= 64) ? 'ojos' : mn === 'Eyebrows' ? 'cejas' : null;
      const m2 = mat.clone().setName(`${rol || 'ropa'}__${p.slot}_${p.id}__${mn}`);
      pr.setMaterial(m2); malla.addPrimitive(pr);
    }
    // en ropa: el material no-piel con más vértices es "principal", el segundo "secundario"
    if (['superior', 'inferior', 'calzado'].includes(p.slot)) {
      const ropa = malla.listPrimitives().filter((pr) => pr.getMaterial().getName().startsWith('ropa__')).sort((a, b) => b.getAttribute('POSITION').getCount() - a.getAttribute('POSITION').getCount());
      ropa.forEach((pr, i) => pr.getMaterial().setName(pr.getMaterial().getName().replace(/^ropa__/, i === 0 ? 'principal__' : i === 1 ? 'secundario__' : 'fijo__')));
    }
    doc.getRoot().listMaterials().forEach((m) => { if (m.getName().startsWith('ropa__')) m.setName(m.getName().replace(/^ropa__/, 'fijo__')); });
    const nuevo = doc.createNode(`${p.slot}__${p.id}`).setMesh(malla).setSkin(skin).setExtras({ slot: p.slot, id: p.id, origen: `Quaternius · ${C.carpeta}/${p.archivo}.glb · ${p.nodo}` });
    armadura.addChild(nuevo);
  }
  originales.forEach((n) => n.dispose());
  // quitar escenas y esqueletos importados (todo quedó enlazado al esqueleto de la base)
  root.listScenes().filter((s) => s !== escena).forEach((s) => s.dispose());
  root.listSkins().filter((s) => s !== skin).forEach((s) => s.dispose());
  root.setDefaultScene(escena);
  await doc.transform(prune(), dedup({ propertyTypes: ['Accessor'] }), quantize({ quantizePosition: 14, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }), unpartition());
  const archivo = path.join(salida, `${genero}.glb`);
  await io.write(archivo, doc);
  const resumen = { genero, bytes: fs.statSync(archivo).size, piezas: piezas.map((p) => `${p.slot}:${p.id}`), materiales: doc.getRoot().listMaterials().map((m) => m.getName()) };
  console.log(JSON.stringify(resumen));
  return resumen;
}
fs.mkdirSync(salida, { recursive: true });
const out = {};
for (const g of ['mujer', 'hombre']) out[g] = await construir(g);
fs.writeFileSync(path.join(salida, 'catalogo.json'), JSON.stringify(Object.fromEntries(Object.entries(CATALOGO).map(([g, c]) => [g, Object.fromEntries(['cabello', 'superior', 'inferior', 'calzado', 'accesorio'].map((s) => [s, c[s].map((x) => x[0])]))])), null, 1));
