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
const texLogo = {}; let logosListos = null;
function texturaLogo(fondoClaro) { // fondo claro → logo con "Subli" oscuro; fondo oscuro → logo con "Subli" blanco
  const k = fondoClaro ? 'claro' : 'oscuro';
  if (!texLogo[k]) { texLogo[k] = new THREE.TextureLoader().load(`/assets/sublicuentas-logo-${k}-ui.webp`); texLogo[k].colorSpace = THREE.SRGBColorSpace; texLogo[k].anisotropy = 4; }
  return texLogo[k];
}
function precargarLogos() { // se espera antes de armar el avatar: el logo nunca sale vacío en la primera imagen
  if (!logosListos) logosListos = Promise.all(['claro', 'oscuro'].map((k) => new Promise((ok) => { const t = new THREE.TextureLoader().load(`/assets/sublicuentas-logo-${k}-ui.webp`, () => ok(), undefined, () => ok()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texLogo[k] = t; })));
  return logosListos;
}
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
const DEDO_EJE = new THREE.Vector3(1, 0, 0), DEDO_SIGNO = -1; // flexión de falanges (eje local X del rig Quaternius)
// Posturas: direcciones de cada segmento (x = izquierda del avatar +, y = arriba, z = al frente)
const POSTURA = {
  pie: { brazo: [v(0.2, -1, -0.03), v(0.06, -1, 0.32)], pierna: [v(0.035, -1, 0.0), v(0.0, -1, -0.03)], dedos: 0.42 },
  sentado: { brazo: [v(0.14, -0.86, 0.42), v(-0.22, -0.3, 1)], pierna: [v(0.07, -0.05, 1), v(0.02, -1, 0.06)], dedos: 0.5 },
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
  // R177 · Accesorios visibles y unidos al hueso con su transformación local (siguen la postura: de pie o sentada).
  accesorios(cfg) {
    const h = this.h; const quitar = (k) => { if (this.acc[k]) { this.acc[k].parent?.remove(this.acc[k]); this.acc[k].traverse((o) => { o.geometry?.dispose(); }); delete this.acc[k]; } };
    const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.4, metalness: o.m ?? 0.2, ...(o.t ? { transparent: true, opacity: o.t, depthWrite: false } : {}) });
    ['lentes', 'aretes', 'reloj', 'logo', 'collar'].forEach(quitar);
    if ((cfg.logo || cfg.collar) && !this.sentado && this.ANCLA) this.medirTorso();
    const oro = () => m('#D9AE4F', { m: 0.85, r: 0.22 });
    if (cfg.lentes && h.cabeza) { // montura ejecutiva rectangular redondeada, con micas
      const g = new THREE.Group(); const marco = m('#151515', { m: 0.35, r: 0.28 });
      const aro = (w, hh, e, r) => { const sh = new THREE.Shape(); const rr = (S, W, H, R) => { S.moveTo(-W / 2 + R, -H / 2); S.lineTo(W / 2 - R, -H / 2); S.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + R); S.lineTo(W / 2, H / 2 - R); S.quadraticCurveTo(W / 2, H / 2, W / 2 - R, H / 2); S.lineTo(-W / 2 + R, H / 2); S.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - R); S.lineTo(-W / 2, -H / 2 + R); S.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + R, -H / 2); }; rr(sh, w, hh, r); const hole = new THREE.Path(); rr(hole, w - 2 * e, hh - 2 * e, Math.max(0.002, r - e)); sh.holes.push(hole); return new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false, curveSegments: 6 }); };
      const W = 0.036, H = 0.026, sep = 0.0215;
      for (const lado of [-1, 1]) {
        const a = new THREE.Mesh(aro(W, H, 0.0045, 0.008), marco); a.position.set(lado * sep, 0, -0.002); g.add(a);
        const mica = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.006, H - 0.006), m('#9FC3D9', { m: 0.1, r: 0.05, t: 0.22 })); mica.position.set(lado * sep, 0, 0); g.add(mica);
        const pat = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.1), marco); pat.position.set(lado * (sep + W / 2 - 0.001), 0.005, -0.05); pat.rotation.y = lado * 0.06; g.add(pat);
      }
      const puente = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.0035, 0.004), marco); puente.position.set(0, 0.006, 0); g.add(puente);
      this.acc.lentes = this.colgar(g, 'lentes');
    }
    if (cfg.aretes && this.genero === 'mujer' && h.cabeza) { // aretes colgantes: aro + gota, visibles bajo el cabello
      const g = new THREE.Group();
      for (const lado of [-1, 1]) {
        const e = new THREE.Group(); e.position.set(lado * this.ANCLA.oreja.ancho, 0, 0);
        const boton = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 12, 10), oro()); e.add(boton);
        const aro = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0028, 8, 22), oro()); aro.position.set(0, -0.017, 0); aro.rotation.y = Math.PI / 2; e.add(aro);
        const gota = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 14, 12), m('#F2EEE6', { m: 0.25, r: 0.12 })); gota.scale.set(1, 1.35, 1); gota.position.set(0, -0.037, 0); e.add(gota);
        g.add(e);
      }
      this.acc.aretes = this.colgar(g, 'oreja');
    }
    if (cfg.reloj && h.antebrazoI) { // reloj en la muñeca izquierda, carátula hacia afuera
      const g = new THREE.Group(); const r = this.ANCLA.reloj.r;
      const correa = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 20, 1, true), m('#2A2420', { r: 0.7 })); correa.material.side = THREE.DoubleSide; g.add(correa);
      const caja = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.008, 24), m('#C9CED6', { m: 0.85, r: 0.2 })); caja.rotation.z = Math.PI / 2; caja.position.set(r + 0.003, 0, 0); g.add(caja);
      const cara = new THREE.Mesh(new THREE.CircleGeometry(0.0135, 24), m('#0F1B2D', { m: 0.2, r: 0.3 })); cara.rotation.y = Math.PI / 2; cara.position.set(r + 0.0075, 0, 0); g.add(cara);
      for (const ang of [0, Math.PI / 2]) { const ag = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.009, 0.0015), m('#F4F4F4', { m: 0.6 })); ag.rotation.x = ang; ag.position.set(r + 0.0082, 0.003 * Math.cos(ang), -0.003 * Math.sin(ang)); g.add(ag); }
      this.acc.reloj = this.colgar(g, 'reloj');
    }
    if (cfg.collar && (h.pecho || h.cuello)) { // cadena que cae sobre el pecho con dije
      const g = new THREE.Group(); const C = this.ANCLA.collarForma;
      const curva = new THREE.CatmullRomCurve3(C.map((p) => v(p[0], p[1], p[2])), true, 'centripetal');
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 80, 0.0022, 6, true), oro()));
      const fr = C[0]; const aro = new THREE.Mesh(new THREE.TorusGeometry(0.004, 0.0013, 6, 14), oro()); aro.position.set(fr[0], fr[1] - 0.004, fr[2]); g.add(aro);
      const dije = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 14, 12), m('#F3EEE4', { m: 0.3, r: 0.12 })); dije.scale.set(1, 1.3, 0.8); dije.position.set(fr[0], fr[1] - 0.016, fr[2] + 0.002); g.add(dije);
      this.acc.collar = this.colgar(g, 'collar');
    }
    if (cfg.logo && h.pecho) { // logo real de Sublicuentas sobre el pecho (blazer, blusa, camisa o polo)
      const claro = new THREE.Color(cfg.colorSuperior || '#222').getHSL({}).l > 0.55;
      const tex = texturaLogo(claro); const W = this.genero === 'mujer' ? 0.09 : 0.1;
      const g = new THREE.Mesh(new THREE.PlaneGeometry(W, W * 78 / 400), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      g.renderOrder = 2; this.acc.logo = this.colgar(g, 'logo');
    }
  }
  // R177 · mide la superficie real de la prenda elegida (rayos de frente) para que logo y collar queden ENCIMA de la ropa.
  medirTorso() {
    const R = this.raiz; R.updateMatrixWorld(true);
    const mallas = []; for (const [slot, ps] of Object.entries(this.piezas)) if (slot !== 'accesorio') for (const ms of Object.values(ps)) ms.forEach((o) => { if (o.visible) mallas.push(o); });
    mallas.forEach((o) => { if (o.isSkinnedMesh) { o.boundingSphere = null; o.boundingBox = null; } });
    const rc = new THREE.Raycaster(); const qR = R.getWorldQuaternion(new THREE.Quaternion()); const dir = v(0, 0, -1).applyQuaternion(qR);
    const z = (x, y, def) => { rc.set(R.localToWorld(v(x, y, 0.7)), dir); const hit = rc.intersectObjects(mallas, false)[0]; return hit ? R.worldToLocal(hit.point.clone()).z : def; };
    const A = this.ANCLA; const L = A.logoBase; const z0 = z(L.x, L.y, L.z);
    const zt = z(L.x, L.y + 0.012, z0), zb = z(L.x, L.y - 0.012, z0), zl = z(L.x - 0.03, L.y, z0), zr = z(L.x + 0.03, L.y, z0);
    A.logo = { x: L.x, y: L.y, z: Math.max(zt, zb, z0) + 0.004, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.max(-0.35, Math.min(0.35, Math.atan2(zt - zb, 0.024))), Math.max(-0.3, Math.min(0.3, Math.atan2(zl - zr, 0.06))), 0)) };
    const N = A.cuelloBase; const yN = N.y; const pts = [];
    for (const [x, dy] of [[0, -0.095], [0.022, -0.082], [0.038, -0.052], [0.048, -0.02]]) pts.push([x, yN + dy, z(x, yN + dy, N.z + 0.08) + 0.005]);
    const back = [[0.056, yN + 0.004, N.z - 0.004], [0.04, yN + 0.01, N.z - 0.045], [0, yN + 0.012, N.z - 0.058]];
    A.collarForma = [...pts, ...back, ...back.slice(0, 2).reverse().map((p) => [-p[0], p[1], p[2]]), ...pts.slice(1).reverse().map((p) => [-p[0], p[1], p[2]])];
    const lg = this.local?.logo; if (lg) { const mundo = new THREE.Matrix4().compose(v(A.logo.x, A.logo.y, A.logo.z), A.logo.q, v(1, 1, 1)).premultiply(R.matrixWorld); lg.m.copy(lg.hueso.matrixWorld).invert().multiply(mundo); }
  }
  // Mide una vez (de pie) dónde va cada accesorio respecto de su hueso; luego se cuelga con esa transformación local.
  calibrar() {
    const R = this.raiz; R.updateMatrixWorld(true); const A = this.ANCLA; const h = this.h;
    const huesos = { lentes: h.cabeza, oreja: h.cabeza, boca: h.cabeza, reloj: h.antebrazoI, collar: h.pecho || h.cuello, logo: h.pecho };
    this.local = {};
    for (const [k, hueso] of Object.entries(huesos)) {
      const a = A[k]; if (!a || !hueso) continue;
      const mundo = new THREE.Matrix4().compose(v(a.x, a.y, a.z), a.q || new THREE.Quaternion(), v(1, 1, 1)).premultiply(R.matrixWorld);
      this.local[k] = { hueso, m: new THREE.Matrix4().copy(hueso.matrixWorld).invert().multiply(mundo) };
    }
  }
  colgar(obj, k) { const L = this.local?.[k]; if (!L) return obj; const c = new THREE.Group(); c.name = 'acc__' + k; L.m.decompose(c.position, c.quaternion, c.scale); c.add(obj); L.hueso.add(c); return c; }
  // compatibilidad R172
  fijar(obj, hueso, pos) { this.raiz.updateMatrixWorld(true); obj.position.copy(this.raiz.localToWorld(v(pos.x, pos.y, pos.z))); hueso.attach(obj); }
  postura(nombre) {
    const P = POSTURA[nombre]; const h = this.h; const R = this.raiz;
    const lado = (s) => (s === 'I' ? 1 : -1);
    for (const s of ['I', 'D']) {
      const [b1, b2] = P.brazo; if (h['brazo' + s]) { apuntar(h['brazo' + s], h['antebrazo' + s], v(b1.x * lado(s), b1.y, b1.z), R); apuntar(h['antebrazo' + s], h['mano' + s], v(b2.x * lado(s), b2.y, b2.z), R); }
      const [p1, p2] = P.pierna; if (h['muslo' + s]) { apuntar(h['muslo' + s], h['pierna' + s], v(p1.x * lado(s), p1.y, p1.z), R); apuntar(h['pierna' + s], h['pie' + s], v(p2.x * lado(s), p2.y, p2.z), R); }
    }
    this.curvarDedos(P.dedos || 0);
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
  // R177 · manos relajadas: flexiona cada falange (no dedos estirados tipo "bloque")
  curvarDedos(k) {
    if (!this.dedos) { this.dedos = []; this.modelo.traverse((o) => { const m = /^(Index|Middle|Ring|Pinky|Thumb)(\d)([LR])$/.exec(o.name); if (m) this.dedos.push({ o, q: o.quaternion.clone(), pulgar: m[1] === 'Thumb', lado: m[3], meñique: m[1] === 'Pinky' }); }); }
    for (const d of this.dedos) { const a = k * (d.pulgar ? 0.35 : d.meñique ? 1.15 : 1) * DEDO_SIGNO; d.o.quaternion.copy(d.q).multiply(tmpQ.setFromAxisAngle(DEDO_EJE, a)); }
  }
  // t: segundos; hablando: 0..1; u: userData del contenedor (mano, saludo)
  animar(t, hablando = 0, u = {}, reducido = false) {
    const h = this.h; if (!h.cabeza || !this.base.cabeza) return;
    if (this.boca) { const ab = hablando > 0.04 ? hablando * (0.35 + 0.65 * Math.abs(Math.sin(t * 9.3) * Math.sin(t * 5.7 + 1))) : 0; this.boca.visible = ab > 0.05; this.boca.scale.y = 0.2 + 0.85 * ab; }
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
  const [cargadorGLTF, buf] = await Promise.all([obtenerCargador(), cargarKit(genero), precargarLogos()]);
  const gltf = await cargadorGLTF.parseAsync(buf, '');
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
  const L = (o) => raiz.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
  const manoI = av.h.manoI ? L(av.h.manoI) : v(0.2, 0.8, 0); const codoI = av.h.antebrazoI ? L(av.h.antebrazoI) : v(0.2, 1.05, 0);
  const pecho = av.h.pecho ? L(av.h.pecho) : v(0, 1.3, 0);
  const cuello = av.h.cuello ? L(av.h.cuello) : v(0, pecho.y + 0.15, 0);
  const mujer = genero === 'mujer';
  const caraZ = cab.z + Math.min(0.12, Math.max(0.07, frente - cab.z - 0.01));
  // reloj: 85 % del antebrazo, eje Y a lo largo del brazo y carátula (+X) hacia afuera del cuerpo
  const dirAnte = manoI.clone().sub(codoI).normalize();
  const fuera = v(1, 0, 0.35).normalize(); fuera.sub(dirAnte.clone().multiplyScalar(fuera.dot(dirAnte))).normalize();
  const qReloj = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(fuera, dirAnte, fuera.clone().cross(dirAnte).normalize()));
  const pReloj = codoI.clone().lerp(manoI, mujer ? 0.82 : 0.9);
  // collar: cadena alrededor del cuello que baja en "U" sobre el pecho (coordenadas de la sala, de pie)
  av.ANCLA = {
    lentes: { x: 0, y: ojosY - 0.01, z: caraZ },
    oreja: { x: 0, y: ojosY - 0.06, z: cab.z + 0.004, ancho: mujer ? 0.074 : 0.08 },
    boca: { x: 0, y: ojosY - (mujer ? 0.083 : 0.078), z: caraZ - (mujer ? 0.012 : 0.008) },
    reloj: { x: pReloj.x, y: pReloj.y, z: pReloj.z, q: qReloj, r: mujer ? 0.026 : 0.03 },
    logoBase: { x: mujer ? 0.072 : 0.082, y: pecho.y + (mujer ? 0.035 : 0.05), z: pecho.z + 0.12 },
    logo: { x: mujer ? 0.072 : 0.082, y: pecho.y + (mujer ? 0.035 : 0.05), z: pecho.z + 0.12 },
    cuelloBase: { y: cuello.y + (mujer ? 0.034 : 0.04), z: cuello.z },
    collar: { x: 0, y: 0, z: 0 },
    collarForma: [],
  };
  av.calibrar(); if (typeof window !== 'undefined' && window.__labAvatar) window.__labAvatar.push({ genero, cuello, pecho, cab, ojosY, caraZ });
  // boca: aparece solo al hablar (lip-sync sutil por volumen)
  if (av.h.cabeza) { const boca = new THREE.Mesh(new THREE.CircleGeometry(0.01, 20), new THREE.MeshStandardMaterial({ color: '#4A1F22', roughness: 0.9 })); boca.scale.set(1.5, 0.15, 1); boca.visible = false; av.colgar(boca, 'boca'); av.boca = boca; }
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
