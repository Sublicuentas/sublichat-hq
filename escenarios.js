/* escenarios.js · R174 — SubliStudio 3D · Fase 6: escenarios y editor común de estilos.
   5 escenarios (Sala de Juntas Cálida Ejecutiva, Sala de Socios, Subli Aula, Subli Live, Subli Cinema), cada uno con
   4 paredes/fondos, 4 asientos/sets, 5 paletas y 4 iluminaciones. Todo se arma con geometría ligera (sin descargas).
   El catálogo (ids) debe coincidir con api/_sala-juntas.js · ESCENARIOS (lo revisa tests/r174-escenarios.test.mjs). */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

export const ESCENARIOS = {
  'sala-c': {
    nombre: 'Sala de Juntas Cálida Ejecutiva', corto: 'Sala de Juntas', uso: 'Juntas de fundadoras, estrategia y seguimiento',
    paredes: [['madera', 'Madera cálida'], ['listones', 'Listones verticales'], ['grafito', 'Panel grafito'], ['logo', 'Panel con logo iluminado']],
    asientos: [['ejecutiva', 'Ejecutiva alta'], ['media', 'Ejecutiva media'], ['moderna', 'Moderna acolchada'], ['premium', 'Sillón premium']],
    paleta: [['beige-madera', 'Beige · Madera'], ['rojo-grafito', 'Rojo · Grafito'], ['negro-rojo', 'Negro · Rojo'], ['blanco-rojo', 'Blanco · Rojo'], ['gris-calido', 'Gris cálido']],
    luz: [['calida', 'Cálida'], ['neutra', 'Neutra'], ['led', 'LED'], ['indirecta', 'Indirecta suave']],
    base: { paredes: 'madera', asientos: 'ejecutiva', paleta: 'beige-madera', luz: 'calida', piso: 'madera', brillo: 'normal', deco: { plantas: true, cuadros: false, lamparas: false, mesas: false, paneles: false, logos: false, utileria: true } },
  },
  socios: {
    nombre: 'Sala de Socios', corto: 'Sala de Socios', uso: 'Estrategia, coordinación, seguimiento y junta mensual',
    paredes: [['madera', 'Madera cálida'], ['grafito', 'Panel grafito'], ['listones', 'Listones verticales'], ['logo', 'Panel con logo iluminado']],
    asientos: [['ejecutiva', 'Ejecutiva alta'], ['media', 'Ejecutiva media'], ['moderna', 'Moderna acolchada'], ['premium', 'Sillón premium']],
    paleta: [['rojo-grafito', 'Rojo · Grafito'], ['beige-madera', 'Beige · Madera'], ['negro-rojo', 'Negro · Rojo'], ['blanco-rojo', 'Blanco · Rojo'], ['gris-calido', 'Gris cálido']],
    luz: [['anillo', 'Anillo central'], ['led', 'Líneas LED'], ['indirecta', 'Luz cálida indirecta'], ['neutra', 'Luz corporativa neutra']],
    base: { paredes: 'madera', asientos: 'ejecutiva', paleta: 'beige-madera', luz: 'anillo', piso: 'madera', brillo: 'normal', deco: { plantas: true, cuadros: false, lamparas: false, mesas: false, paneles: true, logos: false, utileria: true } },
  },
  aula: {
    nombre: 'Subli Aula', corto: 'Subli Aula', uso: 'Cursos, onboarding, formación interna y talleres',
    paredes: [['madera', 'Madera clara'], ['blanco', 'Panel blanco minimalista'], ['grafito', 'Grafito con acento rojo'], ['mixto', 'Mixto madera-grafito']],
    asientos: [['pupitre', 'Pupitre clásico'], ['ejecutivo', 'Pupitre ejecutivo'], ['butaca', 'Butaca moderna'], ['mesas', 'Mesa de capacitación']],
    paleta: [['rojo-blanco', 'Rojo · Blanco'], ['rojo-madera', 'Rojo · Madera'], ['blanco-gris', 'Blanco · Gris'], ['negro-rojo', 'Negro · Rojo'], ['beige-calido', 'Beige cálido']],
    luz: [['calida', 'Cálida'], ['aula', 'Neutra de aula'], ['led', 'LED moderna'], ['auditorio', 'Auditorio suave']],
    base: { paredes: 'madera', asientos: 'pupitre', paleta: 'rojo-madera', luz: 'calida', piso: 'madera', brillo: 'normal', deco: { plantas: true, cuadros: false, lamparas: false, mesas: false, paneles: false, logos: false, utileria: true } },
  },
  live: {
    nombre: 'Subli Live', corto: 'Subli Live', uso: 'Anuncios, lanzamientos, promociones y presentaciones en vivo',
    paredes: [['led', 'LED rojo y grafito'], ['negro', 'Panel negro premium'], ['claro', 'Fondo corporativo limpio'], ['modular', 'Panel modular con pantallas']],
    asientos: [['talkshow', 'Butacas talk show'], ['altas', 'Sillas altas'], ['lounge', 'Sillones lounge'], ['entrevista', 'Mesa de entrevista']],
    paleta: [['rojo-negro', 'Rojo · Negro'], ['rojo-gris', 'Rojo · Gris'], ['rojo-blanco', 'Rojo · Blanco'], ['negro-grafito', 'Negro · Grafito'], ['rojo-dorado', 'Rojo · Dorado']],
    luz: [['aro', 'Aro de luz'], ['estudio', 'Spot de estudio'], ['led', 'LED perimetral'], ['calida', 'Luz cálida']],
    base: { paredes: 'led', asientos: 'talkshow', paleta: 'rojo-negro', luz: 'estudio', piso: 'madera', brillo: 'normal', deco: { plantas: false, cuadros: false, lamparas: false, mesas: false, paneles: false, logos: true, utileria: true } },
  },
  cinema: {
    nombre: 'Subli Cinema', corto: 'Subli Cinema', uso: 'Estrenos, recomendaciones, revisión de videos y contenido audiovisual',
    paredes: [['acustica', 'Acústicas negras'], ['rojo', 'Rojo grafito'], ['madera', 'Madera oscura'], ['paneles', 'Paneles decorativos con luz']],
    asientos: [['butaca', 'Butaca de cine'], ['sofa', 'Sofá lounge'], ['reclinable', 'Sillón reclinable'], ['doble', 'Asiento premium doble']],
    paleta: [['rojo-negro', 'Rojo · Negro'], ['grafito-dorado', 'Grafito · Dorado'], ['negro-rojo', 'Negro · Rojo'], ['beige-oscuro', 'Beige oscuro'], ['rojo-vino', 'Rojo vino']],
    luz: [['pasillo', 'Luces de pasillo'], ['tenue', 'Tenue de cine'], ['led', 'LED lateral'], ['lounge', 'Ambiente lounge']],
    base: { paredes: 'acustica', asientos: 'butaca', paleta: 'rojo-negro', luz: 'tenue', piso: 'madera', brillo: 'normal', deco: { plantas: false, cuadros: false, lamparas: false, mesas: false, paneles: false, logos: false, utileria: true } },
  },
};
export const PARAMS = [['paredes', 'Paredes / fondo'], ['asientos', 'Asientos / set'], ['paleta', 'Paleta de color'], ['luz', 'Iluminación']];
// R177 · ambiente editable (igual en api/_sala-juntas.js · AMBIENTE)
export const AMBIENTE = {
  piso: [['madera', 'Madera'], ['neutro', 'Neutro'], ['oscuro', 'Oscuro'], ['claro', 'Claro']],
  brillo: [['suave', 'Suave'], ['normal', 'Normal'], ['brillante', 'Más brillante']],
  deco: [['plantas', 'Plantas'], ['cuadros', 'Cuadros'], ['lamparas', 'Lámparas de pie'], ['mesas', 'Mesas auxiliares'], ['paneles', 'Paneles informativos'], ['utileria', 'Utilería del set']],
  marca: [['logos', 'Logo Sublicuentas iluminado']],
};
const DECO = ['plantas', 'cuadros', 'lamparas', 'mesas', 'paneles', 'logos', 'utileria'];
// Estilos sugeridos (se aplican al instante; se guardan solo si la persona pulsa Guardar)
export const SUGERIDOS = [['junta', 'Junta mensual'], ['sobria', 'Reunión sobria'], ['anuncio', 'Anuncio'], ['presentacion', 'Presentación'], ['grabacion', 'Grabación limpia']];
const LUZ_NEUTRA = { 'sala-c': 'neutra', socios: 'neutra', aula: 'aula', live: 'estudio', cinema: 'led' };
export function sugerido(id, clave) {
  const E = ESCENARIOS[id] || ESCENARIOS['sala-c']; const b = E.base; const no = Object.fromEntries(DECO.map((k) => [k, false]));
  const T = {
    junta: { ...b, deco: { ...b.deco, plantas: true, paneles: true, logos: true, cuadros: true } },
    sobria: { ...b, piso: 'neutro', luz: LUZ_NEUTRA[id], deco: { ...no, plantas: true } },
    anuncio: { ...b, piso: 'oscuro', brillo: 'brillante', deco: { ...no, logos: true, utileria: true, lamparas: true } },
    presentacion: { ...b, luz: LUZ_NEUTRA[id], deco: { ...b.deco, paneles: true, logos: true } },
    grabacion: { ...b, brillo: 'brillante', luz: LUZ_NEUTRA[id], deco: { ...no, logos: true } },
  }[clave];
  return estiloValido(id, T || b);
}

// Paletas: acento (marca), pared, piso, madera, tela de asientos, metal, cielo (fondo)
const PALETAS = {
  'beige-madera': { acento: '#C62828', pared: '#8A5A36', piso: '#6B4A33', madera: '#7B4A2A', tela: '#3A2A22', metal: '#2A2A2A', cielo: '#2A1C14', alfombra: '#5A3B2C' },
  'rojo-grafito': { acento: '#E2231A', pared: '#2B2F36', piso: '#3A3F47', madera: '#5A3A28', tela: '#B3150F', metal: '#1A1C20', cielo: '#14161A', alfombra: '#23262C' },
  'negro-rojo': { acento: '#E2231A', pared: '#16181C', piso: '#24272D', madera: '#3A2A22', tela: '#111215', metal: '#2A2D33', cielo: '#0C0D10', alfombra: '#7A1F2B' },
  'blanco-rojo': { acento: '#E2231A', pared: '#E9E6E1', piso: '#CFC8BE', madera: '#B08A66', tela: '#C62828', metal: '#8C9098', cielo: '#D8D2C8', alfombra: '#B9B1A6' },
  'gris-calido': { acento: '#C62828', pared: '#7D756D', piso: '#5E5650', madera: '#8A6A50', tela: '#4A4440', metal: '#33302D', cielo: '#2E2A27', alfombra: '#5A524C' },
  'rojo-blanco': { acento: '#E2231A', pared: '#F2EFEA', piso: '#C9B79F', madera: '#C49A6C', tela: '#E2231A', metal: '#5E6B7A', cielo: '#E6E1DA', alfombra: '#B04A3F' },
  'rojo-madera': { acento: '#C62828', pared: '#A57850', piso: '#7A5A3E', madera: '#9A6A42', tela: '#B3150F', metal: '#2A2A2A', cielo: '#3A2A20', alfombra: '#6E2A22' },
  'blanco-gris': { acento: '#5E6B7A', pared: '#ECEDEF', piso: '#B8BCC2', madera: '#C8C0B4', tela: '#5E6B7A', metal: '#7E8590', cielo: '#DADDE2', alfombra: '#9AA1AA' },
  'beige-calido': { acento: '#B5651D', pared: '#E3D2BA', piso: '#B89A78', madera: '#A97C50', tela: '#8C5A3A', metal: '#4A3A2E', cielo: '#D9C7AE', alfombra: '#A57B57' },
  'rojo-negro': { acento: '#E2231A', pared: '#141519', piso: '#1C1E23', madera: '#3A2A22', tela: '#B3150F', metal: '#0E0F12', cielo: '#08090B', alfombra: '#5A0E0E' },
  'rojo-gris': { acento: '#E2231A', pared: '#4A4F57', piso: '#3A3E45', madera: '#5A4A40', tela: '#C62828', metal: '#25282D', cielo: '#1E2126', alfombra: '#2F3238' },
  'negro-grafito': { acento: '#C9CED6', pared: '#1F2227', piso: '#2A2D33', madera: '#3A3A3A', tela: '#2B2F36', metal: '#0F1114', cielo: '#0D0E11', alfombra: '#202328' },
  'rojo-dorado': { acento: '#D4A64A', pared: '#2A1414', piso: '#2A1E1A', madera: '#5A3A22', tela: '#9E1B1B', metal: '#B8913E', cielo: '#140A0A', alfombra: '#5A1414' },
  'grafito-dorado': { acento: '#D4A64A', pared: '#23252A', piso: '#1B1C20', madera: '#4A3A2A', tela: '#2E3036', metal: '#B8913E', cielo: '#0E0F12', alfombra: '#2A2B30' },
  'beige-oscuro': { acento: '#C9A06A', pared: '#4A3C30', piso: '#2E251E', madera: '#6A5038', tela: '#8C6E52', metal: '#2A221C', cielo: '#16110D', alfombra: '#3A2E24' },
  'rojo-vino': { acento: '#C62828', pared: '#3A1218', piso: '#24100F', madera: '#4A2A22', tela: '#6E1420', metal: '#1C0E10', cielo: '#100608', alfombra: '#4A0E16' },
};
// Iluminaciones: hemisferio, puntos (color, intensidad), principal, exposición, tira emisiva
const LUCES = {
  calida: { cielo: 0xffe2bf, suelo: 0x5a4030, hemi: 1.15, punto: 0xffc98a, pi: 9, sol: 0xffe6c8, si: 1.3, exp: 1.05, tira: 0xff9a3c },
  neutra: { cielo: 0xf2f4f7, suelo: 0x5a5a5a, hemi: 1.25, punto: 0xffffff, pi: 7, sol: 0xffffff, si: 1.3, exp: 1.0, tira: 0xdfe6ee },
  led: { cielo: 0xdfe8ff, suelo: 0x2a2a35, hemi: 0.9, punto: 0xff3a30, pi: 6, sol: 0xe8eeff, si: 1.1, exp: 1.0, tira: 0xff2a1a },
  indirecta: { cielo: 0xffd9b0, suelo: 0x3a2a20, hemi: 0.95, punto: 0xffb070, pi: 6, sol: 0xffd0a0, si: 0.8, exp: 1.1, tira: 0xffb060 },
  anillo: { cielo: 0xfff0dc, suelo: 0x3a3030, hemi: 1.0, punto: 0xfff1d6, pi: 8, sol: 0xffffff, si: 1.1, exp: 1.05, tira: 0xffe2b0 },
  aula: { cielo: 0xf6f8fb, suelo: 0x6a6a6a, hemi: 1.35, punto: 0xffffff, pi: 7, sol: 0xffffff, si: 1.4, exp: 1.0, tira: 0xffffff },
  auditorio: { cielo: 0xffe8cc, suelo: 0x403530, hemi: 0.85, punto: 0xffd2a0, pi: 7, sol: 0xffe0c0, si: 0.9, exp: 1.05, tira: 0xffc080 },
  aro: { cielo: 0xffffff, suelo: 0x303035, hemi: 1.0, punto: 0xffffff, pi: 10, sol: 0xffffff, si: 1.6, exp: 1.08, tira: 0xff2a1a },
  estudio: { cielo: 0xf4f6ff, suelo: 0x202025, hemi: 0.75, punto: 0xfff4e6, pi: 12, sol: 0xffffff, si: 1.8, exp: 1.05, tira: 0xff2a1a },
  pasillo: { cielo: 0x7a6a60, suelo: 0x180c0c, hemi: 0.6, punto: 0xffb070, pi: 6, sol: 0xfff0e0, si: 0.7, exp: 1.05, tira: 0xffa040 },
  tenue: { cielo: 0x6a5a50, suelo: 0x180c0c, hemi: 0.55, punto: 0xffa070, pi: 6, sol: 0xffe0c0, si: 0.6, exp: 1.05, tira: 0xff5a2a },
  lounge: { cielo: 0x8a6a50, suelo: 0x201010, hemi: 0.6, punto: 0xffa060, pi: 5, sol: 0xffd0a0, si: 0.6, exp: 1.05, tira: 0xffa050 },
};

export function estiloValido(id, estilo = {}) {
  const E = ESCENARIOS[id] || ESCENARIOS['sala-c']; const out = {}; estilo = estilo || {};
  for (const [k] of PARAMS) out[k] = E[k].some(([v]) => v === estilo[k]) ? estilo[k] : E.base[k];
  out.piso = AMBIENTE.piso.some(([v]) => v === estilo.piso) ? estilo.piso : E.base.piso;
  out.brillo = AMBIENTE.brillo.some(([v]) => v === estilo.brillo) ? estilo.brillo : E.base.brillo;
  const d = estilo.deco && typeof estilo.deco === 'object' ? estilo.deco : {};
  out.deco = Object.fromEntries(DECO.map((k) => [k, typeof d[k] === 'boolean' ? d[k] : E.base.deco[k]]));
  return out;
}

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.6, metalness: o.m ?? 0, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, transparent: !!o.t, opacity: o.t ?? 1 });
const malla = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
const caja = (w, h, d, m, x, y, z) => malla(new THREE.BoxGeometry(w, h, d), m, x, y, z);
const textura = (dibujo, w = 512, h = 512) => { const c = document.createElement('canvas'); c.width = w; c.height = h; dibujo(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
function maderaTex(base, vetas) { return textura((x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { x.strokeStyle = vetas; x.globalAlpha = 0.07 + Math.random() * 0.12; x.lineWidth = 1 + Math.random() * 2.5; x.beginPath(); const y = Math.random() * h; x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + 8, w * 0.65, y - 8, w, y + 4); x.stroke(); } }, 256, 256); }
const oscurecer = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

// ---------- asientos: un modelo paramétrico por tipo (asiento siempre a 0.56 m para que los avatares calcen) ----------
const TIPO_ASIENTO = {
  ejecutiva: { resp: 0.86, brazos: true, base: 'estrella', cojin: 'caja' }, media: { resp: 0.55, brazos: true, base: 'estrella', cojin: 'caja' },
  moderna: { resp: 0.6, brazos: false, base: 'estrella', cojin: 'redondo' }, premium: { resp: 0.8, brazos: 'anchos', base: 'bloque', cojin: 'caja', ancho: 0.78 },
  pupitre: { resp: 0.5, brazos: false, base: 'patas', cojin: 'caja', ancho: 0.48, mesa: 'pupitre' }, ejecutivo: { resp: 0.62, brazos: true, base: 'estrella', cojin: 'caja', mesa: 'escritorio' },
  butaca: { resp: 0.7, brazos: 'anchos', base: 'bloque', cojin: 'redondo', ancho: 0.62 }, mesas: { resp: 0.55, brazos: false, base: 'patas', cojin: 'caja', ancho: 0.5, mesa: 'larga' },
  talkshow: { resp: 0.62, brazos: 'curvos', base: 'pedestal', cojin: 'redondo', ancho: 0.78 }, altas: { resp: 0.9, brazos: false, base: 'patas', cojin: 'redondo', ancho: 0.5, alto: true },
  lounge: { resp: 0.55, brazos: 'anchos', base: 'bloque', cojin: 'caja', ancho: 0.9 }, entrevista: { resp: 0.7, brazos: true, base: 'estrella', cojin: 'caja', mesa: 'entrevista' },
  'butaca-cine': { resp: 0.9, brazos: 'anchos', base: 'bloque', cojin: 'caja', ancho: 0.66 }, sofa: { resp: 0.6, brazos: 'anchos', base: 'bloque', cojin: 'caja', ancho: 0.82 },
  reclinable: { resp: 0.95, brazos: 'anchos', base: 'bloque', cojin: 'caja', ancho: 0.74, reclina: true }, doble: { resp: 0.85, brazos: 'anchos', base: 'bloque', cojin: 'caja', ancho: 0.78, doble: true },
};
export function asiento(tipo, P) {
  const T = TIPO_ASIENTO[tipo] || TIPO_ASIENTO.ejecutiva; const g = new THREE.Group();
  const tela = mat(P.tela, { r: 0.55 }), metal = mat(P.metal, { m: 0.6, r: 0.35 }), acento = mat(P.acento, { r: 0.5 });
  const w = T.ancho || 0.56;
  if (T.cojin === 'redondo') { const c = malla(new THREE.CylinderGeometry(w / 2, w / 2, 0.12, 28), tela, 0, 0.5, 0); g.add(c); } else g.add(caja(w, 0.12, 0.54, tela, 0, 0.5, 0));
  if (T.resp) { const rp = caja(w * (T.cojin === 'redondo' ? 0.92 : 1), T.resp, 0.12, tela, 0, 0.56 + T.resp / 2, -0.26); rp.rotation.x = T.reclina ? -0.32 : -0.1; g.add(rp); if (T.resp > 0.8) g.add(caja(w * 0.7, 0.04, 0.02, acento, 0, 0.62 + T.resp * 0.85, -0.2)); }
  if (T.brazos === true) for (const l of [-1, 1]) g.add(caja(0.06, 0.06, 0.4, metal, l * (w / 2 + 0.02), 0.68, -0.02));
  if (T.brazos === 'anchos') for (const l of [-1, 1]) g.add(caja(0.12, 0.3, 0.56, tela, l * (w / 2 + 0.06), 0.62, 0));
  if (T.brazos === 'curvos') { const b = malla(new THREE.TorusGeometry(w / 2 + 0.04, 0.07, 10, 28, Math.PI * 1.1), tela, 0, 0.64, -0.02); b.rotation.set(Math.PI / 2, 0, Math.PI * 0.95); g.add(b); }
  if (T.base === 'estrella') { g.add(malla(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 10), metal, 0, 0.25, 0)); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, pata = caja(0.04, 0.04, 0.32, metal, Math.sin(a) * 0.15, 0.05, Math.cos(a) * 0.15); pata.rotation.y = a; g.add(pata); } }
  if (T.base === 'patas') for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(malla(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 8), metal, x * (w / 2 - 0.05), 0.22, z * 0.22));
  if (T.base === 'bloque') g.add(caja(w + (T.brazos === 'anchos' ? 0.24 : 0), 0.44, 0.56, mat(oscurecer(P.tela, 0.75), { r: 0.6 }), 0, 0.22, 0));
  if (T.base === 'pedestal') { g.add(malla(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 12), metal, 0, 0.23, 0)); g.add(malla(new THREE.CylinderGeometry(0.3, 0.32, 0.03, 28), metal, 0, 0.015, 0)); }
  if (T.alto) { { const _m = malla(new THREE.TorusGeometry(0.2, 0.012, 6, 24), metal, 0, 0.18, 0); _m.rotation.x = Math.PI / 2; g.add(_m); } }
  if (T.doble) g.add(caja(0.05, 0.12, 0.5, metal, w / 2 + 0.2, 0.58, 0)); // posavasos central
  if (T.mesa === 'pupitre') { g.add(caja(0.6, 0.03, 0.38, mat(P.madera, { r: 0.45 }), 0, 0.76, 0.42)); g.add(malla(new THREE.CylinderGeometry(0.015, 0.015, 0.74, 8), metal, 0.26, 0.37, 0.42)); }
  if (T.mesa === 'escritorio') { g.add(caja(0.9, 0.04, 0.48, mat(P.madera, { r: 0.4 }), 0, 0.76, 0.5)); g.add(caja(0.9, 0.7, 0.04, mat(oscurecer(P.madera, 0.7)), 0, 0.4, 0.72)); }
  if (T.mesa === 'larga') { g.add(caja(1.1, 0.04, 0.5, mat('#F2F0EC', { r: 0.4 }), 0, 0.76, 0.5)); for (const l of [-1, 1]) g.add(caja(0.04, 0.74, 0.44, metal, l * 0.52, 0.37, 0.5)); }
  return g;
}

// ---------- paredes / fondos ----------
function pared(tipo, P, L, ancho, alto, logo) {
  const g = new THREE.Group();
  const panel = (c, o) => caja(ancho, alto, 0.2, mat(c, o), 0, alto / 2, -0.1);
  if (tipo === 'madera' || tipo === 'mixto') { const t = maderaTex(P.pared, oscurecer(P.pared, 0.75)); t.repeat.set(3, 1); g.add(caja(ancho, alto, 0.2, new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), 0, alto / 2, -0.1)); const n = Math.floor(ancho / 0.26); for (let i = -n / 2; i <= n / 2; i++) g.add(caja(0.1, alto - 0.2, 0.08, mat(i % 2 ? oscurecer(P.pared, 0.85) : P.pared, { r: 0.6 }), i * 0.26, alto / 2, 0.03)); if (tipo === 'mixto') g.add(caja(ancho, alto * 0.4, 0.06, mat(P.metal, { r: 0.5 }), 0, alto * 0.2, 0.08)); }
  else if (tipo === 'listones') { g.add(panel(oscurecer(P.pared, 0.6))); const n = Math.floor(ancho / 0.18); for (let i = -n / 2; i <= n / 2; i++) g.add(caja(0.08, alto - 0.3, 0.1, mat(P.madera, { r: 0.55 }), i * 0.18, alto / 2, 0.05)); g.add(caja(ancho, 0.04, 0.05, mat('#fff', { e: L.tira, ei: 1.4 }), 0, 0.12, 0.02)); }
  else if (tipo === 'grafito' || tipo === 'negro' || tipo === 'acustica') { g.add(panel(tipo === 'grafito' ? P.pared : '#121316', { r: tipo === 'acustica' ? 0.95 : 0.5 })); const cw = tipo === 'acustica' ? 0.6 : 1.2, ch = tipo === 'acustica' ? 0.6 : 0.9; for (let x = -ancho / 2 + cw / 2; x < ancho / 2; x += cw) for (let y = ch / 2; y < alto; y += ch) g.add(caja(cw - 0.03, ch - 0.03, 0.05, mat(tipo === 'acustica' ? '#1A1B1F' : oscurecer(P.pared, 1.15), { r: tipo === 'acustica' ? 1 : 0.45 }), x, y, 0.03)); if (tipo === 'grafito') g.add(caja(ancho, 0.03, 0.04, mat('#fff', { e: P.acento, ei: 1.2 }), 0, alto - 0.25, 0.08)); }
  else if (tipo === 'logo' || tipo === 'claro' || tipo === 'blanco') { g.add(panel(tipo === 'logo' ? oscurecer(P.pared, 0.7) : '#F1EEE9', { r: 0.5 })); }
  else if (tipo === 'led' || tipo === 'rojo') { g.add(panel(tipo === 'rojo' ? '#3A1216' : '#101114', { r: 0.4 })); for (let i = 0; i < 7; i++) { const b = caja(0.06, alto * 0.9, 0.04, mat('#fff', { e: P.acento, ei: tipo === 'rojo' ? 0.6 : 1.6 }), -ancho / 2 + 0.6 + i * (ancho - 1.2) / 6, alto / 2, 0.05); b.rotation.z = (i % 2 ? 1 : -1) * 0.18; g.add(b); } }
  else if (tipo === 'modular') { g.add(panel('#141519', { r: 0.4 })); for (let x = -2; x <= 2; x++) for (let y = 0; y < 3; y++) if (!(Math.abs(x) <= 1 && y === 1)) g.add(caja(0.95, 0.55, 0.04, mat('#0B0C0F', { e: (x + y) % 2 ? P.acento : 0x223044, ei: 0.5 }), x * 1.05, 0.7 + y * 0.65, 0.05)); }
  else if (tipo === 'paneles') { g.add(panel(oscurecer(P.pared, 0.8), { r: 0.6 })); for (let x = -ancho / 2 + 1; x < ancho / 2; x += 1.6) { g.add(caja(1.2, alto * 0.7, 0.06, mat(P.pared, { r: 0.55 }), x, alto / 2, 0.04)); g.add(caja(1.24, 0.03, 0.04, mat('#fff', { e: L.tira, ei: 1.3 }), x, alto * 0.86, 0.09)); } }
  if (tipo === 'logo' && logo) { const t = textura((x, w, h) => { x.clearRect(0, 0, w, h); const k = Math.min(w / logo.width, h / logo.height) * 0.9; x.drawImage(logo, (w - logo.width * k) / 2, (h - logo.height * k) / 2, logo.width * k, logo.height * k); }, 1024, 256); const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false })); m.position.set(0, alto - 0.6, 0.06); g.add(m); }
  return g;
}

function plantaSimple(x, z, h = 1.1) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(malla(new THREE.CylinderGeometry(0.2, 0.16, 0.38, 18), mat('#E8E2D8', { r: 0.5 }), 0, 0.19, 0));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, hh = malla(new THREE.SphereGeometry(0.16, 10, 8), mat(i % 2 ? '#2F6B3A' : '#3E8A47'), Math.cos(a) * 0.14, 0.4 + h * (0.35 + (i % 4) * 0.15), Math.sin(a) * 0.14); hh.scale.set(0.7, 1.6, 0.35); hh.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5); g.add(hh); }
  return g;
}


// ---------- R177 · ambiente: piso, cuadros, lámparas, mesas auxiliares, paneles, logo ----------
function pisoMaterial(tipo, P) {
  if (tipo === 'neutro') { const t = textura((x, w, h) => { x.fillStyle = '#A39E96'; x.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, 256, 256); t.repeat.set(6, 6); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.78 }); }
  if (tipo === 'oscuro' || tipo === 'claro') { const os = tipo === 'oscuro'; const t = textura((x, w, h) => { x.fillStyle = os ? '#1A1B1F' : '#E6DFD3'; x.fillRect(0, 0, w, h); x.strokeStyle = os ? '#2A2C32' : '#CDC4B6'; x.lineWidth = 4; x.strokeRect(2, 2, w - 4, h - 4); }, 256, 256); t.repeat.set(9, 8); return new THREE.MeshStandardMaterial({ map: t, roughness: os ? 0.26 : 0.45, metalness: os ? 0.15 : 0 }); }
  const t = maderaTex(P.piso, oscurecer(P.piso, 0.75)); t.repeat.set(7, 7); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 });
}
function cuadro(P, i, w = 1.1, h = 1.4) {
  const g = new THREE.Group(); g.add(caja(w + 0.08, h + 0.08, 0.05, mat('#1C1C1E', { r: 0.4 }), 0, 0, 0));
  const t = textura((x, W, H) => { x.fillStyle = i % 2 ? '#EFEAE2' : '#F4F1EC'; x.fillRect(0, 0, W, H); const c = [P.acento, P.madera, oscurecer(P.pared, 0.8), '#D9C9AE']; for (let k = 0; k < 4; k++) { x.fillStyle = c[(k + i) % 4]; x.globalAlpha = 0.85; if ((k + i) % 2) { x.beginPath(); x.arc(W * (0.3 + 0.15 * k), H * (0.3 + 0.12 * ((k * 3 + i) % 4)), W * (0.12 + 0.04 * k), 0, Math.PI * 2); x.fill(); } else x.fillRect(W * 0.12 * (k + 1), H * (0.15 + 0.17 * k), W * 0.45, H * 0.1); } x.globalAlpha = 1; }, 256, 320);
  const lienzo = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })); lienzo.position.z = 0.03; g.add(lienzo); return g;
}
function lampara(L) {
  const g = new THREE.Group(); const metal = mat('#1E1E21', { m: 0.6, r: 0.35 });
  g.add(malla(new THREE.CylinderGeometry(0.17, 0.19, 0.03, 24), metal, 0, 0.015, 0)); g.add(malla(new THREE.CylinderGeometry(0.014, 0.014, 1.5, 8), metal, 0, 0.76, 0));
  const pant = malla(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#F3E9D8', emissive: L.punto, emissiveIntensity: 0.55, side: THREE.DoubleSide, roughness: 0.9 }), 0, 1.58, 0); g.add(pant);
  return g;
}
function mesaAux(P) {
  const g = new THREE.Group(); const m = mat(P.madera, { r: 0.4 });
  g.add(malla(new THREE.CylinderGeometry(0.28, 0.28, 0.035, 28), m, 0, 0.56, 0)); g.add(malla(new THREE.CylinderGeometry(0.03, 0.05, 0.54, 10), mat(P.metal, { m: 0.5 }), 0, 0.28, 0)); g.add(malla(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 24), mat(P.metal, { m: 0.5 }), 0, 0.015, 0));
  g.add(malla(new THREE.CylinderGeometry(0.06, 0.045, 0.2, 14), mat('#F2EEE6', { r: 0.3 }), 0.06, 0.68, 0)); for (let i = 0; i < 4; i++) { const h = malla(new THREE.SphereGeometry(0.05, 8, 6), mat('#3E8A47'), 0.06 + Math.cos(i * 1.6) * 0.04, 0.82 + (i % 2) * 0.04, Math.sin(i * 1.6) * 0.04); h.scale.set(0.6, 1.4, 0.4); g.add(h); }
  g.add(caja(0.16, 0.035, 0.22, mat(P.acento, { r: 0.5 }), -0.1, 0.595, 0.02));
  return g;
}
function panelInfo(P) {
  const kpi = textura((x, w, h) => { x.fillStyle = '#0F1114'; x.fillRect(0, 0, w, h); x.fillStyle = P.acento; x.fillRect(0, 0, w, 8); x.fillStyle = '#fff'; x.font = '700 64px Inter, Arial'; x.fillText('+32%', 40, 140); x.font = '28px Inter, Arial'; x.fillStyle = '#AEB6C2'; x.fillText('crecimiento', 40, 185); x.fillStyle = '#fff'; x.font = '700 64px Inter, Arial'; x.fillText('125', 300, 140); x.font = '28px Inter, Arial'; x.fillStyle = '#AEB6C2'; x.fillText('nuevos', 300, 185); x.strokeStyle = P.acento; x.lineWidth = 6; x.beginPath(); [[40, 420], [140, 380], [240, 400], [340, 320], [440, 300]].forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke(); }, 512, 512);
  return new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: kpi, toneMapped: false }));
}
function letrero(logo, w, h) {
  const t = textura((x, W, H) => { x.clearRect(0, 0, W, H); if (logo) { const k = Math.min(W / logo.width, H / logo.height) * 0.92; x.drawImage(logo, (W - logo.width * k) / 2, (H - logo.height * k) / 2, logo.width * k, logo.height * k); } else { x.fillStyle = '#fff'; x.font = '800 150px Inter, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Sublicuentas', W / 2, H / 2); } }, 1024, 256);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }));
}
const sec = (o) => { o.userData.secundario = true; return o; }; // R177 · se oculta en Modo grabación
function laptop() { const g = new THREE.Group(); const m = mat('#2A2D33', { m: 0.5, r: 0.35 }); g.add(caja(0.34, 0.015, 0.24, m, 0, 0.008, 0)); const pa = caja(0.34, 0.22, 0.012, m, 0, 0.11, -0.12); pa.rotation.x = -0.25; g.add(pa); const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), mat('#0E1A2B', { e: 0x2a4a7a, ei: 0.5 })); sc.position.set(0, 0.11, -0.112); sc.rotation.x = -0.25; g.add(sc); return g; }

/* Arma el escenario (sin la Sala C, que vive en sala-3d.js con su diseño aprobado original cuando su estilo es el base).
   Devuelve: pantalla (malla para la presentación), asientos {naara, libni, geisell} y libres, vistas y centro. */
export function construir(escena, id, estiloIn, { logo, texturaPantalla, extras = 0 } = {}) {
  const st = estiloValido(id, estiloIn); const P = PALETAS[st.paleta] || PALETAS['rojo-grafito']; const L0 = LUCES[st.luz] || LUCES.neutra;
  const D = st.deco; const K = { suave: 0.7, normal: 1, brillante: 1.4 }[st.brillo] || 1; const L = { ...L0, hemi: L0.hemi * K, si: L0.si * K, pi: L0.pi * K };
  escena.background = new THREE.Color(P.cielo); escena.fog = new THREE.Fog(P.cielo, 14, 26);
  escena.add(new THREE.HemisphereLight(L.cielo, L.suelo, L.hemi));
  const sol = new THREE.DirectionalLight(L.sol, L.si); sol.position.set(3, 6, 5); sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024); Object.assign(sol.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); escena.add(sol);
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(18, 16), pisoMaterial(st.piso, P)); piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; escena.add(piso);
  const techo = new THREE.Mesh(new THREE.PlaneGeometry(18, 16), mat(oscurecer(P.cielo, 1.4), { r: 0.95 })); techo.rotation.x = Math.PI / 2; techo.position.y = 3.8; escena.add(techo);
  const puntos = (lista) => lista.forEach(([x, z, y = 3.3]) => { const l = new THREE.PointLight(L.punto, L.pi, 9, 1.5); l.position.set(x, y, z); escena.add(l); const f = new THREE.Mesh(new THREE.CircleGeometry(0.12, 18), mat('#fff', { e: L.punto, ei: 1.2 })); f.rotation.x = Math.PI / 2; f.position.set(x, 3.79, z); escena.add(f); });
  const pantallaMat = new THREE.MeshBasicMaterial({ map: texturaPantalla ? texturaPantalla(logo) : null, toneMapped: false });
  const out = { estilo: st, asientos: {}, libres: [], vistas: {}, centro: new THREE.Vector3(0, 0.9, 0), exp: L.exp * ({ suave: 0.9, brillante: 1.1 }[st.brillo] || 1) };
  // utilería común del ambiente (posiciones por escenario)
  const POS = {
    'sala-c': { cuadros: [-5.4, 5.4], panel: 3.4, lamp: [[-4.9, -3.7], [4.9, -3.7]], mesas: [[-3.3, 2.2], [3.3, 2.2]], logoY: 3.42, plantas: [[-3.6, -3.4], [3.6, -3.4], [-5.4, 0.6], [5.4, 0.6]] },
    socios: { cuadros: [-5.4, 5.4], panel: 3.4, lamp: [[-4.9, -3.7], [4.9, -3.7]], mesas: [[-3.3, 1.8], [3.3, 1.8]], logoY: 3.42, plantas: [[-3.6, -3.4], [3.6, -3.4], [-5.4, 0.6], [5.4, 0.6]] },
    aula: { cuadros: [-5.3, 5.3], panel: 3.7, lamp: [[-4.2, -4.0], [4.2, -4.0]], mesas: [[-4.4, -2.4], [4.4, -2.4]], logoY: 3.52, plantas: [[-5.5, -3.8], [5.5, -3.8]] },
    live: { cuadros: [-4.7, 4.7], panel: 3.2, lamp: [[-5.2, -3.0], [5.2, -3.0]], mesas: [[-2.5, -1.7, 0.12], [2.5, -1.7, 0.12]], logoY: null, plantas: [[-5.2, -3.2], [5.2, -3.2]] },
    cinema: { cuadros: null, panel: 6.4, lamp: [[-6.8, 3.6], [6.8, 3.6]], mesas: [[-4.2, 0.6, 0.3], [4.2, 0.6, 0.3]], logoY: 0.42, plantas: [[-6.6, -5.4], [6.6, -5.4]] },
  }[id];
  const ambiente = (f) => {
    if (D.plantas) POS.plantas.forEach(([x, z]) => escena.add(sec(plantaSimple(x, z, id === 'aula' ? 1.3 : 1.1))));
    if (D.cuadros) { if (POS.cuadros) POS.cuadros.forEach((x, i) => { const c = cuadro(P, i); c.position.set(x, 1.95, 0.14); f.add(sec(c)); }); else for (const l of [-1, 1]) for (const [z, i] of [[-2.6, 0], [1.6, 1]]) { const c = cuadro(P, i + (l > 0 ? 2 : 0)); c.position.set(l * 7.45, 2.3, z); c.rotation.y = -l * Math.PI / 2; escena.add(sec(c)); } }
    if (D.lamparas) POS.lamp.forEach(([x, z]) => { const l = lampara(L); l.position.set(x, 0, z); escena.add(sec(l)); });
    if (D.mesas) POS.mesas.forEach(([x, z, y = 0]) => { const m = mesaAux(P); m.position.set(x, y, z); escena.add(sec(m)); });
    if (D.paneles) { const m = panelInfo(P); m.position.set(POS.panel, id === 'cinema' ? 2.2 : 1.9, 0.17); f.add(sec(m)); }
    if (D.logos && POS.logoY && st.paredes !== 'logo') { const m = letrero(logo, id === 'cinema' ? 2.4 : 2.0, id === 'cinema' ? 0.6 : 0.5); m.position.set(0, POS.logoY, 0.16); f.add(m); }
  };
  const fondo = (z, ancho, alto) => { const g = pared(st.paredes, P, L, ancho, alto, logo); g.position.z = z; escena.add(g); return g; };
  const ponerAsiento = (pos, atras = 0.12) => { const s = asiento(st.asientos === 'butaca' && id === 'cinema' ? 'butaca-cine' : st.asientos, P); s.position.set(pos.x - Math.sin(pos.ry) * atras, pos.y || 0, pos.z - Math.cos(pos.ry) * atras); s.rotation.y = pos.ry; escena.add(s); return s; };
  const pantallaEn = (g, w, h, y, z = 0.17) => { g.add(caja(w + 0.2, h + 0.2, 0.08, mat('#111216', { r: 0.3 }), 0, y, z - 0.05)); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), pantallaMat); m.position.set(0, y, z); g.add(m); out.pantalla = m; return m; };

  if (id === 'socios' || id === 'sala-c') {
    const f = fondo(-4.4, 14, 3.8); pantallaEn(f, 4.1, 2.05, 1.95); ambiente(f);
    if (id === 'socios') { // el panel de indicadores ahora es "Paneles informativos" del ambiente
      if (st.luz === 'anillo') { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.05, 10, 64), mat('#fff', { e: L.punto, ei: 1.6 })); ring.rotation.x = Math.PI / 2; ring.position.y = 3.5; escena.add(ring); }
    }
    if (st.luz === 'led') for (const x of [-2.5, 0, 2.5]) escena.add(caja(2, 0.04, 0.08, mat('#fff', { e: L.tira, ei: 1.6 }), x, 3.6, 0));
    puntos([[-2.5, -1], [0, -0.5], [2.5, -1], [0, 2]]);
    const alf = new THREE.Mesh(new THREE.CircleGeometry(3.4, 48), mat(P.alfombra, { r: 0.95 })); alf.rotation.x = -Math.PI / 2; alf.position.y = 0.005; alf.receiveShadow = true; escena.add(alf);
    const mesa = new THREE.Group(); escena.add(mesa);
    const tab = malla(new THREE.CylinderGeometry(1.0, 1.0, 0.08, 64), new THREE.MeshStandardMaterial({ map: maderaTex(P.madera, oscurecer(P.madera, 0.7)), roughness: 0.35 }), 0, 0.78, 0); tab.scale.set(id === 'socios' ? 1.6 : 1.95, 1, id === 'socios' ? 1.6 : 1.2); mesa.add(tab);
    mesa.add(caja(0.9, 0.72, 0.6, mat(oscurecer(P.madera, 0.55)), 0, 0.38, 0));
    const r = id === 'socios' ? 2.15 : null;
    const enCirc = (t) => ({ x: Math.sin(t) * r, z: Math.cos(t) * r, ry: 0 });
    const A = id === 'socios'
      ? { naara: enCirc(Math.PI), libni: enCirc(Math.PI + 2 * Math.PI / 3), geisell: enCirc(Math.PI - 2 * Math.PI / 3) }
      : { naara: { x: 0, z: -1.55, ry: 0 }, libni: { x: -2.15, z: -0.1, ry: Math.PI / 2 * 0.82 }, geisell: { x: 2.15, z: -0.1, ry: -Math.PI / 2 * 0.82 } };
    const libres = id === 'socios' ? [Math.PI + Math.PI / 3, Math.PI - Math.PI / 3].map(enCirc) : [{ x: -1.25, z: 1.6, ry: Math.PI * 0.92 }, { x: 0, z: 1.75, ry: Math.PI }, { x: 1.25, z: 1.6, ry: -Math.PI * 0.92 }];
    // la silla debe mirar al centro de la mesa
    for (const p of [...Object.values(A), ...libres]) p.ry = Math.atan2(-p.x, -p.z);
    Object.values(A).forEach((p) => ponerAsiento(p)); libres.forEach((p) => ponerAsiento(p));
    out.asientos = A; out.libres = libres;
    if (D.utileria) Object.values(A).forEach((p) => { const l = laptop(); const k = (Math.hypot(p.x, p.z) - 0.75) / Math.hypot(p.x, p.z); l.position.set(p.x * k, 0.82, p.z * k); l.rotation.y = p.ry + Math.PI; escena.add(sec(l)); });
    out.vistas = { general: { pos: [0, 3.05, 5.4], mira: [0, 1.05, -0.9] }, presentacion: { pos: [0, 1.85, 1.6], mira: [0, 1.85, -4.4] }, panoramica: { radio: 5.4, y: 2.9 } };
  } else if (id === 'aula') {
    const f = fondo(-4.6, 14, 3.8); pantallaEn(f, 4.6, 2.3, 2.0); ambiente(f);
    f.add(caja(14, 0.6, 0.05, mat(P.acento, { r: 0.5 }), 0, 0.3, 0.06));
    if (D.utileria) { const podio = new THREE.Group(); podio.position.set(-2.9, 0, -3.3); podio.add(caja(0.7, 1.1, 0.5, mat(P.madera, { r: 0.4 }), 0, 0.55, 0)); podio.add(caja(0.74, 0.06, 0.06, mat(P.acento), 0, 0.9, 0.26)); escena.add(sec(podio)); }
    puntos([[-3, -1.5], [0, -1.5], [3, -1.5], [-3, 1.5], [0, 1.5], [3, 1.5]]);
    // Naara al frente (mesa de quien dirige) y las demás en la primera fila; resto de filas vacías
    const A = { naara: { x: 0, z: -2.7, ry: Math.PI }, libni: { x: -1.0, z: -0.6, ry: Math.PI }, geisell: { x: 1.0, z: -0.6, ry: Math.PI } };
    // pupitres miran a la pantalla (hacia -z): ry = π significa espalda a la cámara general; se corrige con ry = π - π = 0 → miran a -z
    A.libni.ry = Math.PI; A.geisell.ry = Math.PI; A.naara.ry = 0;
    const filas = []; for (let f2 = 0; f2 < 3; f2++) for (const x of [-3, -1, 1, 3]) { const p = { x, z: -0.6 + f2 * 1.5, ry: Math.PI }; if (!(f2 === 0 && Math.abs(x) === 1)) filas.push(p); }
    const dirigir = { ...A.naara }; ponerAsiento({ ...dirigir, ry: 0 }, 0.12);
    escena.add(caja(1.4, 0.05, 0.6, mat(P.madera, { r: 0.4 }), 0, 0.76, -2.15)); escena.add(caja(1.4, 0.72, 0.05, mat(oscurecer(P.madera, 0.7)), 0, 0.38, -1.88));
    for (const p of [A.libni, A.geisell, ...filas]) { const s = asiento(st.asientos, P); s.position.set(p.x, 0, p.z + 0.12); s.rotation.y = Math.PI; escena.add(s); }
    out.asientos = { naara: { x: 0, z: -2.7, ry: 0 }, libni: { x: -1.0, z: -0.65, ry: Math.PI }, geisell: { x: 1.0, z: -0.65, ry: Math.PI } };
    out.libres = filas.map((p) => ({ x: p.x, z: p.z - 0.05, ry: Math.PI })); // R179 · invitados en los pupitres de las filas
    out.vistas = { general: { pos: [1.2, 2.5, 5.6], mira: [0, 1.25, -3.2] }, presentacion: { pos: [0, 1.9, 1.2], mira: [0, 1.95, -4.6] }, panoramica: { radio: 5.8, y: 3.0 } };
  } else if (id === 'live') {
    const f = fondo(-3.8, 12, 3.8); pantallaEn(f, 3.6, 1.8, 2.05); ambiente(f);
    if (D.logos) { const marca = textura((x, w, h) => { x.fillStyle = P.acento; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = '800 120px Inter, Arial'; x.textAlign = 'center'; x.fillText('▶ Subli Live', w / 2, 160); }, 1024, 256);
    const cartel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: marca, toneMapped: false })); cartel.position.set(0, 3.35, 0.18); f.add(cartel); }
    // tarima y mesa redonda baja
    const tarima = malla(new THREE.CylinderGeometry(3.2, 3.3, 0.12, 64), mat(oscurecer(P.piso, 0.8), { r: 0.4 }), 0, 0.06, -0.6); escena.add(tarima);
    { const _m = malla(new THREE.TorusGeometry(3.25, 0.025, 8, 80), mat('#fff', { e: P.acento, ei: 1.6 }), 0, 0.12, -0.6); _m.rotation.x = Math.PI / 2; escena.add(_m); }
    const mesaR = st.asientos === 'entrevista' ? caja(2.0, 0.06, 0.7, mat(P.madera, { r: 0.35 }), 0, 0.78, -0.4) : malla(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 32), mat(P.madera, { r: 0.35 }), 0, 0.52, -0.4); escena.add(mesaR);
    escena.add(malla(new THREE.CylinderGeometry(0.06, 0.08, st.asientos === 'entrevista' ? 0.76 : 0.5, 12), mat(P.metal, { m: 0.6 }), 0, st.asientos === 'entrevista' ? 0.38 : 0.25, -0.4));
    const A = { naara: { x: 0, z: -1.55, ry: 0 }, libni: { x: -1.45, z: -0.55, ry: Math.PI * 0.42 }, geisell: { x: 1.45, z: -0.55, ry: -Math.PI * 0.42 } };
    if (st.asientos === 'entrevista') { A.naara = { x: 0, z: -1.25, ry: 0 }; A.libni = { x: -0.75, z: 0.4, ry: Math.PI }; A.geisell = { x: 0.75, z: 0.4, ry: Math.PI }; }
    Object.values(A).forEach((p) => ponerAsiento({ ...p, y: 0.12 }, 0.12));
    out.asientos = Object.fromEntries(Object.entries(A).map(([k, p]) => [k, { ...p, y: 0.12 }]));
    // R179 · invitados: butacas extra en la tarima (se arman solo si hay invitados)
    out.libres = [{ x: -2.45, z: 0.25, ry: Math.PI * 0.62 }, { x: 2.45, z: 0.25, ry: -Math.PI * 0.62 }, { x: -1.1, z: 1.25, ry: Math.PI * 0.86 }, { x: 1.1, z: 1.25, ry: -Math.PI * 0.86 }, { x: 0, z: 1.55, ry: Math.PI }].slice(0, Math.max(0, extras)).map((p) => ({ ...p, y: 0.12 }));
    out.libres.forEach((p) => ponerAsiento(p, 0.12));
    // cámaras de estudio y aros de luz (utilería)
    if (D.utileria) for (const [x, z, ry] of [[-3.6, 2.4, 0.7], [3.6, 2.4, -0.7]]) { const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; for (let i = 0; i < 3; i++) { const p = caja(0.03, 1.4, 0.03, mat('#111'), Math.sin(i * 2.1) * 0.25, 0.7, Math.cos(i * 2.1) * 0.25); p.rotation.set(Math.cos(i * 2.1) * 0.18, 0, -Math.sin(i * 2.1) * 0.18); c.add(p); } c.add(caja(0.3, 0.22, 0.42, mat('#18191C', { r: 0.4 }), 0, 1.45, 0)); { const _m = malla(new THREE.CylinderGeometry(0.07, 0.08, 0.18, 16), mat('#0A0A0A'), 0, 1.45, -0.28); _m.rotation.x = Math.PI / 2; c.add(_m); } c.add(malla(new THREE.SphereGeometry(0.025, 8, 6), mat('#f00', { e: 0xff0000 }), 0.1, 1.58, -0.1)); escena.add(sec(c)); }
    if (D.utileria && (st.luz === 'aro' || st.luz === 'estudio')) for (const x of [-4.2, 4.2]) { const a = new THREE.Group(); a.position.set(x, 0, -0.2); a.add(caja(0.03, 1.6, 0.03, mat('#111'), 0, 0.8, 0)); const ring = malla(new THREE.TorusGeometry(0.32, 0.03, 8, 40), mat('#fff', { e: 0xffffff, ei: 1.8 }), 0, 1.8, 0); ring.rotation.y = x < 0 ? -0.7 : 0.7; a.add(ring); escena.add(sec(a)); }
    if (st.luz === 'led') for (const x of [-5.8, 5.8]) escena.add(caja(0.05, 3.4, 0.05, mat('#fff', { e: L.tira, ei: 1.8 }), x, 1.7, -2));
    puntos([[-2, -1], [2, -1], [0, 1.5]]);
    const sp = new THREE.SpotLight(0xffffff, st.luz === 'estudio' ? 60 : 30, 12, 0.6, 0.5, 1.5); sp.position.set(0, 4.5, 3.5); sp.target.position.set(0, 0.8, -0.8); escena.add(sp); escena.add(sp.target);
    out.vistas = { general: { pos: [0, 2.2, 5.0], mira: [0, 1.15, -0.8] }, presentacion: { pos: [0, 2.0, 0.8], mira: [0, 2.05, -3.8] }, panoramica: { radio: 4.6, y: 2.4 } };
    out.centro.set(0, 0.9, -0.6);
  } else if (id === 'cinema') {
    const f = fondo(-6.4, 16, 4.6); pantallaEn(f, 8.0, 3.4, 2.4, 0.2); ambiente(f);
    if (D.utileria) for (const l of [-1, 1]) { const tel = caja(1.2, 4.4, 0.25, mat(st.paleta === 'grafito-dorado' ? '#2A2B30' : '#7A0F14', { r: 0.95 }), l * 4.7, 2.2, -6.1); escena.add(tel); }
    for (const l of [-1, 1]) { const lat = pared(st.paredes, P, L, 13, 4.6, null); lat.rotation.y = -l * Math.PI / 2; lat.position.set(l * 7.6, 0, 0); escena.add(lat); }
    // 3 filas escalonadas mirando a la pantalla (-z); las fundadoras en la segunda fila, al centro
    const filas = [{ z: -1.2, y: 0 }, { z: 0.6, y: 0.3 }, { z: 2.4, y: 0.6 }];
    filas.forEach((fl, i) => { if (fl.y) escena.add(caja(14, fl.y, 1.8, mat(oscurecer(P.piso, 0.85), { r: 0.8 }), 0, fl.y / 2, fl.z)); for (let k = -3; k <= 3; k++) { if (i === 1 && Math.abs(k) <= 1) continue; ponerAsiento({ x: k * 1.05, z: fl.z, y: fl.y, ry: Math.PI }, 0.12); } if (st.luz === 'pasillo') escena.add(caja(13, 0.02, 0.04, mat('#fff', { e: L.tira, ei: 1.6 }), 0, fl.y + 0.02, fl.z - 0.85)); });
    const A = { naara: { x: 0, z: 0.6, y: 0.3, ry: Math.PI }, libni: { x: -1.05, z: 0.6, y: 0.3, ry: Math.PI }, geisell: { x: 1.05, z: 0.6, y: 0.3, ry: Math.PI } };
    Object.values(A).forEach((p) => ponerAsiento(p, 0.12));
    // las fundadoras miran a la pantalla: su "frente" es -z
    out.asientos = Object.fromEntries(Object.entries(A).map(([k, p]) => [k, { ...p, ry: Math.PI, mira: -1 }]));
    out.libres = [[1, 2], [1, -2], [1, 3], [1, -3], [2, 0], [2, -1], [2, 1], [0, 0]].map(([f, k]) => ({ x: k * 1.05, z: filas[f].z, y: filas[f].y, ry: Math.PI, mira: -1 }));
    puntos(st.luz === 'tenue' ? [[0, 1], [0, -3]] : [[-4, 0], [4, 0], [0, 2.5], [0, -3]]);
    if (st.luz === 'led') for (const l of [-1, 1]) escena.add(caja(0.05, 0.05, 11, mat('#fff', { e: L.tira, ei: 1.6 }), l * 7.4, 3.2, 0));
    out.vistas = { general: { pos: [0, 3.3, 5.6], mira: [0, 1.7, -6.0] }, presentacion: { pos: [0, 2.2, 3.4], mira: [0, 2.3, -6.2] }, panoramica: { radio: 6.4, y: 3.4 } };
    out.centro.set(0, 1.2, -1.5);
  }
  return out;
}
