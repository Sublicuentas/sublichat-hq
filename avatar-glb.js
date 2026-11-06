/* avatar-glb.js · R172 — SubliStudio 3D · Fase 3B: avatares 3D reales (modelos glTF con esqueleto).
   Origen de los modelos: Quaternius "Ultimate Modular Women/Men" (CC0 1.0, uso comercial permitido) — ver
   /assets/avatares/LICENCIAS.md. Cada pieza (cabeza+cabello, superior, inferior, calzado, accesorio) es una malla
   propia enlazada al mismo esqueleto: cambiar de prenda cambia la FORMA, no solo el color.
   · cargarKit(genero): descarga una sola vez /assets/avatares/<mujer|hombre>.glb (comprimido con meshopt).
   · crearAvatar(cfg, { sentado }): devuelve un THREE.Group listo; group.userData.avatar = { aplicar(cfg), animar(...) }.
   · La postura (de pie, sentada, mano arriba, saludo) se calcula moviendo los huesos del esqueleto. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

export const KIT_VERSION = '20261105-r172';
export const ALTURA = 1.68; // metros, igual que los personajes anteriores (la sala está medida para eso)
const SLOTS = ['cabello', 'superior', 'inferior', 'calzado'];
// Catálogo por base (ids = nombres de nodo en el kit). Debe coincidir con api/_sala-juntas.js · AVATAR_GENERO.
export const CATALOGO = {
  mujer: { cabello: ['melena', 'recogido', 'lacio', 'corto', 'ondulado', 'largo'], superior: ['blazer', 'blusa', 'vestido', 'camiseta', 'chaqueta'], inferior: ['pantalon', 'falda', 'casual'], calzado: ['formal', 'tacon', 'casual', 'botas'] },
  hombre: { cabello: ['clasico', 'moderno', 'rizado', 'largoMedio', 'conBarba', 'cresta'], superior: ['traje', 'sueter', 'camiseta', 'chaleco'], inferior: ['pantalon', 'jeans', 'shorts'], calzado: ['formal', 'tenis', 'casual'] },
};

const kits = {};
let cargador = null;
function obtenerCargador() {
  if (!cargador) cargador = import('/vendor/three-gltf-0.160.0.js').then(async (m) => { await m.MeshoptDecoder.ready; const l = new m.GLTFLoader(); l.setMeshoptDecoder(m.MeshoptDecoder); return l; });
  return cargador;
}
export function cargarKit(genero) {
  const g = genero === 'hombre' ? 'hombre' : 'mujer';
  if (!kits[g]) kits[g] = fetch(`/assets/avatares/${g}.glb?v=${KIT_VERSION}`, { credentials: 'same-origin' }).then((r) => { if (!r.ok) throw new Error('No se pudo descargar el modelo 3D (' + r.status + ').'); return r.arrayBuffer(); }).catch((e) => { delete kits[g]; throw e; });
  return kits[g];
}

const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion();
// Gira un hueso para que el segmento hueso→hijo apunte en `dir` (dirección en el espacio del avatar).
function apuntar(hueso, hijo, dir, raiz) {
  raiz.updateMatrixWorld(true);
  const p = hueso.getWorldPosition(tmpV), c = hijo.getWorldPosition(tmpV2);
  const actual = c.sub(p).normalize();
  const objetivo = dir.clone().normalize().applyQuaternion(raiz.getWorldQuaternion(tmpQ2));
  const giro = new THREE.Quaternion().setFromUnitVectors(actual, objetivo);
  const mundo = hueso.getWorldQuaternion(new THREE.Quaternion());
  const nuevo = giro.multiply(mundo);
  const padre = hueso.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  hueso.quaternion.copy(padre.multiply(nuevo));
  hueso.updateMatrixWorld(true);
}

const v = (x, y, z) => new THREE.Vector3(x, y, z);
// Posturas: direcciones de cada segmento (x = izquierda del avatar +, y = arriba, z = al frente)
const POSTURA = {
  pie: { brazo: [v(0.16, -1, 0.02), v(0.1, -1, 0.18)], pierna: [v(0.02, -1, 0.0), v(0, -1, -0.02)] },
  sentado: { brazo: [v(0.12, -0.72, 0.62), v(-0.1, -0.12, 1)], pierna: [v(0.04, -0.05, 1), v(0.0, -1, 0.06)] },
};

class Avatar {
  constructor(raiz, modelo, genero) {
    this.raiz = raiz; this.modelo = modelo; this.genero = genero;
    this.piezas = {}; this.mats = []; this.acc = {};
    modelo.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        const [slot, id] = (o.parent && o.parent.name.includes('__') ? o.parent.name : o.name).split('__');
        (this.piezas[slot] = this.piezas[slot] || {})[id] = (this.piezas[slot][id] || []).concat(o);
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => { m.roughness = 0.78; m.metalness = 0; m.userData.base = m.color.clone(); this.mats.push({ m, rol: (m.name || '').split('__')[0], slot }); });
      }
    });
    const b = (n) => modelo.getObjectByName(n);
    this.h = { cadera: b('Hips'), pecho: b('Chest'), cuello: b('Neck'), cabeza: b('Head'), torso: b('Torso'),
      brazoI: b('UpperArmL'), antebrazoI: b('LowerArmL'), manoI: b('HandL'), brazoD: b('UpperArmR'), antebrazoD: b('LowerArmR'), manoD: b('HandR'),
      musloI: b('UpperLegL'), piernaI: b('LowerLegL'), pieI: b('FootL'), musloD: b('UpperLegR'), piernaD: b('LowerLegR'), pieD: b('FootR') };
    this.base = {}; this.anim = { alza: 0 };
  }
  aplicar(cfg = {}) {
    const C = CATALOGO[this.genero];
    const elegido = {};
    for (const s of SLOTS) { const id = C[s].includes(cfg[s]) ? cfg[s] : C[s][0]; elegido[s] = id; for (const [k, ms] of Object.entries(this.piezas[s] || {})) ms.forEach((m) => { m.visible = k === id; }); }
    const acc = this.piezas.accesorio || {};
    (acc.aretes || []).forEach((m) => { m.visible = !!cfg.aretes; });
    (acc.bigote || []).forEach((m) => { m.visible = !!cfg.barba && elegido.cabello !== 'conBarba'; });
    const col = (hex) => new THREE.Color(hex);
    for (const { m, rol, slot } of this.mats) {
      let c = null;
      if (rol === 'piel' && cfg.piel) c = col(cfg.piel);
      else if (rol === 'cabello' && cfg.colorCabello) c = col(cfg.colorCabello);
      else if (rol === 'cejas' && cfg.colorCabello) c = col(cfg.colorCabello).multiplyScalar(0.7);
      else if (rol === 'ojos' && cfg.ojos) c = col(cfg.ojos);
      else if (rol === 'principal' && slot === 'superior' && cfg.colorSuperior) c = col(cfg.colorSuperior);
      else if (rol === 'secundario' && slot === 'superior' && cfg.colorInterior) c = col(cfg.colorInterior);
      else if (rol === 'principal' && slot === 'inferior' && cfg.colorInferior) c = col(cfg.colorInferior);
      else if (rol === 'principal' && slot === 'calzado' && cfg.colorCalzado) c = col(cfg.colorCalzado);
      m.color.copy(c || m.userData.base);
    }
    this.cfg = cfg; this.elegido = elegido;
    this.accesorios(cfg);
  }
  // Accesorios pequeños unidos a los huesos (lentes, aretes de mujer, reloj, logo)
  accesorios(cfg) {
    const h = this.h; const quitar = (k) => { if (this.acc[k]) { this.acc[k].parent?.remove(this.acc[k]); this.acc[k].traverse((o) => o.geometry?.dispose()); delete this.acc[k]; } };
    const k = this.escalaHueso || 1;
    const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.4, metalness: o.m ?? 0.2 });
    quitar('lentes'); quitar('aretes'); quitar('reloj'); quitar('logo'); quitar('collar');
    if (cfg.lentes && h.cabeza) {
      const g = new THREE.Group(); const marco = m('#1A1A1A', { m: 0.4, r: 0.3 });
      for (const lado of [-1, 1]) { const aro = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0032, 8, 22), marco); aro.position.set(lado * 0.028, 0, 0); g.add(aro); const pat = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.09), marco); pat.position.set(lado * 0.047, 0.004, -0.045); g.add(pat); }
      const puente = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.003, 0.003), marco); g.add(puente);
      this.fijar(g, h.cabeza, this.ANCLA.lentes); this.acc.lentes = g;
    }
    if (cfg.aretes && this.genero === 'mujer' && h.cabeza) {
      const g = new THREE.Group(); const oro = m('#D4A64A', { m: 0.9, r: 0.25 });
      for (const lado of [-1, 1]) { const a = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0025, 8, 18), oro); a.position.set(lado * this.ANCLA.oreja.x, 0, 0); a.rotation.y = Math.PI / 2; g.add(a); }
      this.fijar(g, h.cabeza, { x: 0, y: this.ANCLA.oreja.y, z: this.ANCLA.oreja.z }); this.acc.aretes = g;
    }
    if (cfg.reloj && h.manoI) {
      const g = new THREE.Group(); const correa = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 20), m('#222222', { r: 0.6 })); correa.rotation.x = Math.PI / 2; g.add(correa);
      const cara = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 18), m('#C9CED6', { m: 0.8, r: 0.2 })); cara.position.set(0, 0, 0.032); cara.rotation.x = Math.PI / 2; g.add(cara);
      this.fijar(g, h.manoI, this.ANCLA.reloj); this.acc.reloj = g;
    }
    if (cfg.collar && (h.cuello || h.pecho)) { // R173 · collar fino con dije
      const g = new THREE.Group(); const oro = m('#D4A64A', { m: 0.9, r: 0.25 });
      const r = this.ANCLA.collar.r; const cad = new THREE.Mesh(new THREE.TorusGeometry(r, 0.003, 6, 48), oro); cad.rotation.set(Math.PI / 2 + 0.3, 0, 0); g.add(cad);
      const dije = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 10), m('#E8E1D5', { m: 0.3, r: 0.15 })); dije.position.set(0, -r * Math.sin(0.3) - 0.01, r * Math.cos(0.3) + 0.004); g.add(dije);
      this.fijar(g, h.cuello || h.pecho, this.ANCLA.collar); this.acc.collar = g;
    }
    if (cfg.logo && h.pecho) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.006), new THREE.MeshStandardMaterial({ color: '#E2231A', emissive: '#330000' }));
      this.fijar(g, h.pecho, this.ANCLA.logo); this.acc.logo = g;
    }
  }
  // Ubica un objeto en coordenadas del avatar (metros, de pie) y lo cuelga del hueso para que lo siga.
  fijar(obj, hueso, pos) {
    this.raiz.updateMatrixWorld(true);
    const ref = this.refPie || {};
    const mundo = this.raiz.localToWorld(v(pos.x, pos.y, pos.z));
    obj.position.copy(mundo); obj.quaternion.copy(this.raiz.getWorldQuaternion(new THREE.Quaternion()));
    obj.scale.setScalar(1);
    hueso.attach(obj);
    void ref;
  }
  postura(nombre) {
    const P = POSTURA[nombre]; const h = this.h; const R = this.raiz;
    const lado = (s) => (s === 'I' ? 1 : -1);
    for (const s of ['I', 'D']) {
      const [b1, b2] = P.brazo; if (h['brazo' + s]) { apuntar(h['brazo' + s], h['antebrazo' + s], v(b1.x * lado(s), b1.y, b1.z), R); apuntar(h['antebrazo' + s], h['mano' + s], v(b2.x * lado(s), b2.y, b2.z), R); }
      const [p1, p2] = P.pierna; if (h['muslo' + s]) { apuntar(h['muslo' + s], h['pierna' + s], v(p1.x * lado(s), p1.y, p1.z), R); apuntar(h['pierna' + s], h['pie' + s], v(p2.x * lado(s), p2.y, p2.z), R); }
    }
    this.sentado = nombre === 'sentado';
    // poses de la mano derecha (levantada y saludo) calculadas una vez
    if (h.brazoD) {
      const guardar = () => ({ b: h.brazoD.quaternion.clone(), a: h.antebrazoD.quaternion.clone() });
      this.base.mano = guardar();
      apuntar(h.brazoD, h.antebrazoD, v(-0.25, 1, 0.12), R); apuntar(h.antebrazoD, h.manoD, v(-0.05, 1, 0.05), R); this.base.arriba = guardar();
      apuntar(h.antebrazoD, h.manoD, v(-0.55, 0.85, 0.05), R); this.base.saludo1 = guardar();
      apuntar(h.antebrazoD, h.manoD, v(0.35, 0.95, 0.05), R); this.base.saludo2 = guardar();
      h.brazoD.quaternion.copy(this.base.mano.b); h.antebrazoD.quaternion.copy(this.base.mano.a);
    }
    if (h.cabeza) this.base.cabeza = h.cabeza.quaternion.clone();
    if (h.pecho) this.base.pecho = h.pecho.quaternion.clone();
  }
  // t: segundos; hablando: 0..1; u: userData del contenedor (mano, saludo)
  animar(t, hablando = 0, u = {}, reducido = false) {
    const h = this.h; if (!h.cabeza || !this.base.cabeza) return;
    const e = new THREE.Euler();
    if (!reducido) {
      e.set(Math.sin(t * 0.7) * 0.03 + hablando * Math.sin(t * 7.5) * 0.06, Math.sin(t * 0.45) * 0.12, hablando * Math.sin(t * 3.1) * 0.03);
      h.cabeza.quaternion.copy(this.base.cabeza).multiply(tmpQ.setFromEuler(e));
      if (h.pecho && this.base.pecho) h.pecho.quaternion.copy(this.base.pecho).multiply(tmpQ.setFromEuler(e.set(Math.sin(t * 1.6) * 0.012, 0, 0)));
    } else h.cabeza.quaternion.copy(this.base.cabeza).multiply(tmpQ.setFromEuler(e.set(hablando * 0.05, 0, 0)));
    if (!this.base.mano) return;
    const ahora = performance.now(); const saluda = u.saludo && ahora - u.saludo < 2400;
    const meta = u.mano || saluda ? 1 : 0;
    this.anim.alza = reducido ? meta : this.anim.alza + (meta - this.anim.alza) * 0.12;
    const k = this.anim.alza; const B = this.base;
    let destA = B.arriba.a;
    if (saluda && !reducido) { const w = (Math.sin(ahora / 140) + 1) / 2; destA = tmpQ2.copy(B.saludo1.a).slerp(B.saludo2.a, w); }
    h.brazoD.quaternion.copy(B.mano.b).slerp(B.arriba.b, k);
    h.antebrazoD.quaternion.copy(B.mano.a).slerp(destA, k);
  }
}

export async function crearAvatar(cfg = {}, { sentado = false } = {}) {
  const genero = cfg.genero === 'hombre' ? 'hombre' : 'mujer';
  const [L, buf] = await Promise.all([obtenerCargador(), cargarKit(genero)]);
  const gltf = await L.parseAsync(buf, '');
  const raiz = new THREE.Group(); raiz.name = 'avatar-' + genero;
  const modelo = gltf.scene; raiz.add(modelo);
  const av = new Avatar(raiz, modelo, genero);
  av.aplicar({ ...cfg, aretes: false, lentes: false, reloj: false, logo: false, collar: false });
  // escala y altura: de pie, pies en el suelo, alto = ALTURA
  av.postura('pie');
  raiz.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(modelo, true);
  const alto = caja.max.y - caja.min.y || 1;
  const k = ALTURA / alto; modelo.scale.multiplyScalar(k); modelo.position.y = -caja.min.y * k;
  raiz.updateMatrixWorld(true);
  // anclas de accesorios medidas sobre la cabeza real de esta base (en metros, avatar de pie)
  const cab = av.h.cabeza.getWorldPosition(new THREE.Vector3()); raiz.worldToLocal(cab);
  const cabezaCaja = new THREE.Box3();
  for (const ms of Object.values(av.piezas.cabello || {})) ms.forEach((m) => { if (m.visible) cabezaCaja.expandByObject(m, true); });
  const top = cabezaCaja.isEmpty() ? cab.y + 0.25 : raiz.worldToLocal(cabezaCaja.max.clone()).y;
  const alturaCabeza = Math.max(0.18, top - cab.y);
  const ojosY = cab.y + alturaCabeza * (genero === 'mujer' ? 0.49 : 0.46);
  const frente = cabezaCaja.isEmpty() ? 0.1 : (() => { let z = -1; raiz.updateMatrixWorld(true); for (const ms of Object.values(av.piezas.cabello || {})) ms.forEach((m) => { if (!m.visible) return; m.updateMatrixWorld(true); }); z = raiz.worldToLocal(cabezaCaja.max.clone()).z; return z; })();
  const manoI = av.h.manoI ? raiz.worldToLocal(av.h.manoI.getWorldPosition(new THREE.Vector3())) : v(0.2, 0.8, 0);
  const pecho = av.h.pecho ? raiz.worldToLocal(av.h.pecho.getWorldPosition(new THREE.Vector3())) : v(0, 1.3, 0);
  av.ANCLA = {
    lentes: { x: 0, y: ojosY, z: cab.z + Math.min(0.12, Math.max(0.07, frente - cab.z - 0.01)) },
    oreja: { x: 0.072, y: ojosY - 0.045, z: cab.z + 0.005 },
    reloj: { x: manoI.x, y: manoI.y + 0.06, z: manoI.z },
    logo: { x: -0.08, y: pecho.y + 0.02, z: pecho.z + 0.12 },
    collar: (() => { const c = av.h.cuello ? raiz.worldToLocal(av.h.cuello.getWorldPosition(new THREE.Vector3())) : v(0, pecho.y + 0.15, 0); return { x: c.x, y: c.y + 0.035, z: c.z + 0.006, r: genero === 'mujer' ? 0.043 : 0.051 }; })(),
  };
  av.aplicar(cfg);
  if (sentado) av.postura('sentado');
  av.sentadoAltura = 0;
  if (sentado) { // cadera a la altura del asiento (0.65 m) y un poco hacia atrás
    raiz.updateMatrixWorld(true);
    const cad = raiz.worldToLocal(av.h.cadera.getWorldPosition(new THREE.Vector3()));
    modelo.position.y += 0.66 - cad.y; modelo.position.z += -0.06 - cad.z;
  }
  raiz.userData.avatar = av;
  return raiz;
}
