/* sala-3d.js · R169/R172 — SubliStudio 3D: personajes 3D y Escenario C "Cálida Ejecutiva".
   R172: los personajes son modelos 3D reales (avatar-glb.js, CC0 Quaternius); crearPersonaje() queda solo como respaldo.
   Módulo ES que sala-juntas.js descarga SOLO al abrir "Mi personaje" o la vista de la sala (no pesa en otras pantallas).
   · crearPersonaje(cfg): personaje 3D construido en código (geometría + materiales), configurable con las opciones
     permitidas del servidor (api/_sala-juntas.js · AVATAR_OPC). Cuando existan modelos VRoid (.vrm) se podrán cargar
     con el mismo `config` (modelRef distinto) sin rehacer el editor.
   · montarEditor(canvas): vista 360° (arrastrar o flechas) + miniatura para guardar.
   · montarSala(contenedor): sala navegable con mesa ovalada, sillas, plantas, luces cálidas, pantalla con el logo,
     asientos Naara (centro) · Libni (izquierda) · Geisell (derecha) + 3 libres, y cámaras C1–C4 + manual.
   Sin audio todavía (Fase 4). Respeta "reducir movimiento" y baja la calidad sola en equipos lentos. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const reducido = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } })();
const movil = (() => { try { return matchMedia('(max-width: 767.98px)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent); } catch (_) { return false; } })();
export function soportaWebGL() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (_) { return false; } }

// ---------- materiales ----------
const cacheMat = new Map();
function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!cacheMat.has(k)) cacheMat.set(k, new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.65, metalness: o.m ?? 0, emissive: o.e || 0x000000, emissiveIntensity: o.ei ?? 1, side: o.doble ? THREE.DoubleSide : THREE.FrontSide }));
  return cacheMat.get(k);
}
const oscurecer = (hex, f) => { const c = new THREE.Color(hex); c.multiplyScalar(f); return c; };
function malla(geo, material, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }

// ---------- personaje ----------
// Medidas en metros (alto total ≈ 1.68 m). Estilo caricatura: cabeza un poco grande, ojos expresivos.
export function crearPersonaje(cfg = {}, { sentado = false } = {}) {
  const c = { genero: 'mujer', piel: '#EFC3A4', cabello: 'largo', colorCabello: '#3B2A20', cejas: 'suaves', ojos: '#4A2E1F', superior: 'blazer', colorSuperior: '#C62828', colorInterior: '#FFFFFF', inferior: 'pantalon', colorInferior: '#1F2430', calzado: '#1A1A1A', lentes: false, aretes: false, reloj: false, barba: false, logo: false, ...cfg };
  const mujer = c.genero === 'mujer';
  const g = new THREE.Group(); g.name = 'personaje';
  const piel = mat(c.piel, { r: 0.55 }), pelo = mat(c.colorCabello, { r: 0.5 }), sup = mat(c.colorSuperior, { r: c.superior === 'blazer' ? 0.6 : 0.75 });
  const inter = mat(c.colorInterior, { r: 0.8 }), inf = mat(c.colorInferior, { r: 0.7 }), zap = mat(c.calzado, { r: 0.4 });
  const anchoH = mujer ? 0.19 : 0.22, cad = mujer ? 0.17 : 0.18;

  // piernas / falda
  const piernas = new THREE.Group(); piernas.name = 'piernas';
  for (const lado of [-1, 1]) {
    const pierna = new THREE.Group(); pierna.position.set(lado * 0.09, 0.76, 0);
    const muslo = malla(new THREE.CapsuleGeometry(0.075, 0.28, 6, 12), c.inferior === 'falda' ? piel : inf, 0, -0.21, 0);
    const rodilla = new THREE.Group(); rodilla.position.set(0, -0.36, 0);
    const canilla = malla(new THREE.CapsuleGeometry(0.064, 0.28, 6, 12), c.inferior === 'falda' ? piel : inf, 0, -0.17, 0);
    const zapato = malla(new THREE.BoxGeometry(0.11, 0.07, 0.21), zap, 0, -0.36, 0.04); zapato.geometry.translate(0, 0, 0);
    rodilla.add(canilla, zapato); pierna.add(muslo, rodilla); pierna.userData = { rodilla };
    piernas.add(pierna);
  }
  g.add(piernas);
  if (c.inferior === 'falda') { const f = malla(new THREE.CylinderGeometry(cad + 0.02, cad + 0.1, 0.42, 20, 1, true), mat(c.colorInferior, { r: 0.7, doble: true }), 0, 0.62, 0); f.name = 'falda'; g.add(f); }
  else g.add(malla(new THREE.CylinderGeometry(cad, cad + 0.01, 0.16, 20), inf, 0, 0.8, 0));

  // torso
  const torso = new THREE.Group(); torso.name = 'torso'; torso.position.y = 0.88; g.add(torso);
  const pecho = malla(new THREE.CylinderGeometry(anchoH, cad, 0.5, 24), c.superior === 'blazer' ? inter : sup, 0, 0.25, 0); pecho.scale.z = 0.72; torso.add(pecho);
  if (mujer) { const b = malla(new THREE.SphereGeometry(0.075, 14, 10), c.superior === 'blazer' ? inter : sup, 0, 0.32, 0.08); b.scale.set(1.9, 0.75, 0.6); torso.add(b); }
  if (c.superior === 'blazer') { // chaqueta abierta al frente
    const saco = malla(new THREE.CylinderGeometry(anchoH + 0.018, cad + 0.022, 0.54, 24, 1, true, Math.PI * 0.18, Math.PI * 1.64), mat(c.colorSuperior, { r: 0.6, doble: true }), 0, 0.24, 0); saco.scale.z = 0.76; torso.add(saco); // abertura al frente (theta 0 = +z)
    for (const lado of [-1, 1]) { const solapa = malla(new THREE.BoxGeometry(0.05, 0.2, 0.012), mat(oscurecer(c.colorSuperior, 0.85).getStyle()), lado * 0.055, 0.38, 0.135); solapa.rotation.z = lado * 0.35; torso.add(solapa); }
  }
  if (c.superior === 'polo' || c.superior === 'camisa') { const cuello = malla(new THREE.TorusGeometry(0.06, 0.016, 6, 16, Math.PI * 1.4), sup, 0, 0.5, 0.02); cuello.rotation.set(Math.PI / 2, 0, Math.PI * 0.8); torso.add(cuello); }
  if (c.logo) { const l = malla(new THREE.BoxGeometry(0.05, 0.035, 0.01), mat('#E2231A', { e: 0x220000 }), -0.08, 0.36, 0.14); torso.add(l); }
  torso.add(malla(new THREE.SphereGeometry(anchoH + 0.01, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), c.superior === 'blazer' ? mat(c.colorSuperior) : sup, 0, 0.49, 0)).scale.set(1, 0.32, 0.74);

  // brazos
  const mangaLarga = c.superior !== 'polo';
  const brazos = [];
  for (const lado of [-1, 1]) {
    const hombro = new THREE.Group(); hombro.position.set(lado * (anchoH + 0.035), 0.44, 0); torso.add(hombro);
    const brazo = malla(new THREE.CapsuleGeometry(0.048, 0.25, 6, 12), sup, 0, -0.16, 0); hombro.add(brazo);
    const codo = new THREE.Group(); codo.position.y = -0.31; hombro.add(codo);
    const ante = malla(new THREE.CapsuleGeometry(0.042, 0.22, 6, 12), mangaLarga ? sup : piel, 0, -0.14, 0); codo.add(ante);
    const mano = malla(new THREE.SphereGeometry(0.045, 12, 10), piel, 0, -0.3, 0); mano.scale.set(0.9, 1.1, 0.7); codo.add(mano);
    if (c.reloj && lado === -1) codo.add(malla(new THREE.CylinderGeometry(0.047, 0.047, 0.03, 14), mat('#2B2B2B', { m: 0.6, r: 0.3 }), 0, -0.24, 0));
    hombro.rotation.z = lado * 0.12; brazos.push({ hombro, codo });
  }

  // cabeza
  const cuello = malla(new THREE.CylinderGeometry(0.048, 0.052, 0.12, 12), piel, 0, 0.56, 0); torso.add(cuello);
  const cabeza = new THREE.Group(); cabeza.name = 'cabeza'; cabeza.position.y = 0.76; cabeza.scale.setScalar(1.28); torso.add(cabeza);
  const cara = malla(new THREE.SphereGeometry(0.135, 32, 24), piel); cara.scale.set(0.95, 1.08, 0.98); cabeza.add(cara);
  for (const lado of [-1, 1]) {
    cabeza.add(malla(new THREE.SphereGeometry(0.028, 10, 8), piel, lado * 0.128, 0, -0.005)); // oreja
    const blanco = malla(new THREE.SphereGeometry(0.027, 14, 12), mat('#FFFFFF', { r: 0.2 }), lado * 0.048, 0.015, 0.112); blanco.scale.set(1, 1.15, 0.5); cabeza.add(blanco);
    const iris = malla(new THREE.SphereGeometry(0.017, 12, 10), mat(c.ojos, { r: 0.2 }), lado * 0.048, 0.012, 0.124); iris.scale.z = 0.4; cabeza.add(iris);
    cabeza.add(malla(new THREE.SphereGeometry(0.006, 6, 6), mat('#FFFFFF', { e: 0xffffff, ei: 0.4 }), lado * 0.044, 0.02, 0.131));
    const ceja = malla(new THREE.BoxGeometry(0.045, c.cejas === 'marcadas' ? 0.011 : 0.007, 0.01), pelo, lado * 0.05, 0.058, 0.121); ceja.rotation.z = -lado * 0.12; cabeza.add(ceja);
    if (c.aretes) cabeza.add(malla(new THREE.SphereGeometry(0.012, 8, 8), mat('#D4A437', { m: 0.8, r: 0.25 }), lado * 0.132, -0.04, 0.005));
    if (mujer) { const pest = malla(new THREE.BoxGeometry(0.04, 0.006, 0.006), mat('#1A1A1A'), lado * 0.05, 0.04, 0.124); pest.rotation.z = -lado * 0.25; cabeza.add(pest); }
  }
  const nariz = malla(new THREE.SphereGeometry(0.017, 10, 8), mat(oscurecer(c.piel, 0.94).getStyle(), { r: 0.55 }), 0, -0.022, 0.132); nariz.scale.set(0.9, 1.1, 0.8); cabeza.add(nariz);
  const boca = malla(new THREE.TorusGeometry(0.03, 0.007, 6, 16, Math.PI), mat(mujer ? '#B4473F' : '#8A4A3A', { r: 0.4 }), 0, -0.06, 0.118); boca.rotation.z = Math.PI; boca.name = 'boca'; cabeza.add(boca);
  if (c.barba && !mujer) { const b = malla(new THREE.SphereGeometry(0.128, 24, 16, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.55, Math.PI * 0.35), pelo); b.scale.set(1, 1.08, 1.05); b.rotation.y = Math.PI; b.rotation.y = 0; b.position.z = 0.006; cabeza.add(b); }
  if (c.lentes) {
    const montura = mat('#1A1A1A', { r: 0.3, m: 0.2 });
    for (const lado of [-1, 1]) { const aro = malla(new THREE.TorusGeometry(0.034, 0.005, 8, 20), montura, lado * 0.05, 0.012, 0.135); cabeza.add(aro); const pata = malla(new THREE.BoxGeometry(0.004, 0.004, 0.12), montura, lado * 0.118, 0.018, 0.075); cabeza.add(pata); }
    cabeza.add(malla(new THREE.BoxGeometry(0.03, 0.005, 0.005), montura, 0, 0.02, 0.138));
  }

  // cabello
  const casco = (escala = 1.06, corte = 0.52) => { const m = malla(new THREE.SphereGeometry(0.14, 30, 20, 0, Math.PI * 2, 0, Math.PI * corte), pelo, 0, 0.012, -0.004); m.scale.set(0.98 * escala, 1.05 * escala, 1.02 * escala); return m; };
  const nuca = (alto, ancho = 0.25, z = -0.07, y = -0.05) => malla(new THREE.BoxGeometry(ancho, alto, 0.1, 1, 1, 1), pelo, 0, y - alto / 2 + 0.05, z);
  const est = c.cabello;
  if (est === 'rapado') cabeza.add(casco(1.0, 0.48));
  else cabeza.add(casco());
  if (est === 'largo') { const l = malla(new THREE.CapsuleGeometry(0.13, 0.28, 8, 18), pelo, 0, -0.2, -0.055); l.scale.set(1.1, 1, 0.55); cabeza.add(l); for (const lado of [-1, 1]) { const m = malla(new THREE.CapsuleGeometry(0.04, 0.26, 6, 10), pelo, lado * 0.125, -0.13, 0.04); m.rotation.z = lado * 0.08; cabeza.add(m); } const fl = malla(new THREE.SphereGeometry(0.08, 14, 10), pelo, 0.05, 0.1, 0.09); fl.scale.set(1.3, 0.45, 0.6); fl.rotation.z = -0.4; cabeza.add(fl); }
  if (est === 'melena') { const l = malla(new THREE.CylinderGeometry(0.15, 0.16, 0.2, 24, 1, true, Math.PI * 0.34, Math.PI * 1.32), mat(c.colorCabello, { doble: true, r: 0.5 }), 0, -0.04, -0.005); cabeza.add(l); /* R170: abierta al frente (antes tapaba la cara) */ const fl = malla(new THREE.SphereGeometry(0.08, 14, 10), pelo, -0.04, 0.1, 0.09); fl.scale.set(1.4, 0.45, 0.6); fl.rotation.z = 0.35; cabeza.add(fl); }
  if (est === 'cola') { const nudo = malla(new THREE.SphereGeometry(0.04, 12, 10), pelo, 0, 0.06, -0.14); cabeza.add(nudo); const cola = malla(new THREE.CapsuleGeometry(0.045, 0.24, 6, 12), pelo, 0, -0.08, -0.17); cola.rotation.x = 0.25; cabeza.add(cola); }
  if (est === 'recogido') cabeza.add(malla(new THREE.SphereGeometry(0.07, 16, 12), pelo, 0, 0.11, -0.11));
  if (est === 'rizado') for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2, y = 0.03 + Math.sin(i * 1.7) * 0.06; const r = malla(new THREE.SphereGeometry(0.045, 10, 8), pelo, Math.cos(a) * 0.13, y, Math.sin(a) * 0.12 - 0.01); if (Math.sin(a) > 0.55 && y < 0.05) continue; cabeza.add(r); }
  if (est === 'corto') cabeza.add(nuca(0.08, 0.24, -0.08, -0.03));
  if (est === 'peinado') { const q = malla(new THREE.SphereGeometry(0.09, 16, 10), pelo, 0.02, 0.12, 0.06); q.scale.set(1.3, 0.6, 1); q.rotation.z = -0.2; cabeza.add(q); cabeza.add(nuca(0.08, 0.24, -0.08, -0.03)); }

  // pose
  if (sentado) {
    piernas.children.forEach((p) => { p.rotation.x = -Math.PI / 2 * 0.95; p.userData.rodilla.rotation.x = Math.PI / 2 * 0.95; });
    const f = g.getObjectByName('falda'); if (f) { f.rotation.x = -1.2; f.position.set(0, 0.76, 0.14); f.scale.set(1, 0.85, 1); }
    brazos.forEach(({ hombro, codo }) => { hombro.rotation.x = -0.35; codo.rotation.x = -1.1; });
    g.position.y = -0.24;
  } else brazos.forEach(({ hombro, codo }) => { codo.rotation.x = -0.15; });
  brazos.forEach((b) => { b.base = { hx: b.hombro.rotation.x, hz: b.hombro.rotation.z, cx: b.codo.rotation.x, cz: b.codo.rotation.z }; });
  g.userData = { torso, cabeza, boca, brazos, t0: Math.random() * 10, gesto: null, alza: 0 };
  return g;
}
function animarPersonaje(p, t, hablando = 0) {
  const u = p.userData; if (!u) return;
  if (u.glb) { u.glb.animar(t + (u.t0 || 0), hablando, u, reducido); return; }
  if (!u.torso) return; // todavía cargando
  const s = t + u.t0;
  if (!reducido) {
    u.torso.scale.y = 1 + Math.sin(s * 1.6) * 0.006;
    u.cabeza.rotation.y = Math.sin(s * 0.45) * 0.12; u.cabeza.rotation.x = Math.sin(s * 0.7) * 0.03;
    u.boca.scale.y = 1 + hablando * (0.6 + Math.sin(s * 18) * 0.6);
  } else u.boca.scale.y = 1 + hablando * 0.6;
  // R171 · mano levantada (se queda arriba) y saludo al recibir la palabra (2.4 s)
  const b = u.brazos && u.brazos[1]; if (!b || !b.base) return;
  const ahora = performance.now();
  const saluda = u.saludo && ahora - u.saludo < 2400;
  const meta = u.mano || saluda ? 1 : 0;
  u.alza = reducido ? meta : u.alza + (meta - u.alza) * 0.12;
  b.hombro.rotation.x = b.base.hx + (-2.55 - b.base.hx) * u.alza;
  b.hombro.rotation.z = b.base.hz + (0.18 - b.base.hz) * u.alza;
  b.codo.rotation.x = b.base.cx + (-0.35 - b.base.cx) * u.alza;
  b.codo.rotation.z = saluda && !reducido ? Math.sin(ahora / 120) * 0.45 * u.alza : 0;
}
function liberar(obj) { obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }

function renderer(canvas, { alpha = false } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: !movil, alpha, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, movil ? 1.5 : 2));
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  return r;
}
function ajustar(r, cam, el) { const w = el.clientWidth || 600, h = el.clientHeight || 400; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }

// ---------- R172 · avatares reales (GLB) con respaldo ----------
let moduloGLB = null;
const avatarGLB = () => (moduloGLB = moduloGLB || import('/avatar-glb.js?v=20261105-r177'));
// Crea el avatar 3D real; si el modelo no carga (sin red, equipo sin soporte) usa el personaje anterior y lo avisa.
export async function crearAvatar3D(cfg = {}, opts = {}) {
  try { const M = await avatarGLB(); const g = await M.crearAvatar(cfg, opts); g.userData.glb = g.userData.avatar; g.userData.t0 = Math.random() * 10; return g; }
  catch (e) { console.warn('[sala-3d] avatar GLB no disponible:', e && e.message); const p = crearPersonaje(cfg, opts); p.userData.respaldo = true; return p; }
}
export function precargarAvatares(generos = ['mujer']) { avatarGLB().then((M) => generos.forEach((g) => M.cargarKit(g).catch(() => {}))).catch(() => {}); }

// ---------- editor ----------
export function montarEditor(canvas, cfg) {
  const r = renderer(canvas, { alpha: true });
  const escena = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50); let dist = 3.9, distObj = 3.9; const ponerCam = () => { const k = Math.min(1, (dist - 1.6) / (3.9 - 1.6)); cam.position.set(0, 0.9 + (1 - k) * 0.6, dist); cam.lookAt(0, 0.82 + (1 - k) * 0.66, 0); }; ponerCam();
  escena.add(new THREE.HemisphereLight(0xfff4e6, 0x8a7a6a, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2, 3, 3); escena.add(key);
  const rim = new THREE.DirectionalLight(0xffd9b0, 0.8); rim.position.set(-2, 2, -2); escena.add(rim);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.06, 40), mat('#E9ECF1', { r: 0.4 })); base.position.y = -0.03; escena.add(base);
  let p = new THREE.Group(); escena.add(p); let ficha = 0; let cfgActual = cfg;
  let giro = 0.35, objetivo = 0.35, vivo = true, t0 = performance.now(), arrastre = null, vuelta = false;
  const reconstruir = async (c) => {
    const yo = ++ficha; const nuevo = await crearAvatar3D(c);
    if (!vivo || yo !== ficha) { liberar(nuevo); return; }
    escena.remove(p); liberar(p); p = nuevo; p.rotation.y = giro; escena.add(p);
  };
  const listo = reconstruir(cfg);
  const loop = () => { if (!vivo) return; ajustar(r, cam, canvas); if (vuelta && !arrastre) objetivo += reducido ? 0 : 0.012; giro += (objetivo - giro) * (reducido ? 1 : 0.12); dist += (distObj - dist) * (reducido ? 1 : 0.15); ponerCam(); p.rotation.y = giro; animarPersonaje(p, (performance.now() - t0) / 1000); r.render(escena, cam); requestAnimationFrame(loop); };
  loop();
  const down = (e) => { vuelta = false; canvas.dispatchEvent(new CustomEvent('sj-giro', { detail: false })); arrastre = { x: e.clientX, g: objetivo }; canvas.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (arrastre) objetivo = arrastre.g + (e.clientX - arrastre.x) * 0.012; };
  const up = () => { arrastre = null; };
  const rueda = (e) => { e.preventDefault(); distObj = Math.min(3.9, Math.max(1.6, distObj + Math.sign(e.deltaY) * 0.35)); };
  canvas.addEventListener('wheel', rueda, { passive: false });
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  return {
    listo, respaldo: () => !!p.userData.respaldo,
    // misma base (mujer/hombre): cambia piezas y colores al instante; otra base: carga el otro modelo
    set(nueva) {
      const mismo = p.userData.glb && (nueva.genero === 'hombre' ? 'hombre' : 'mujer') === p.userData.glb.genero;
      cfgActual = nueva;
      if (mismo) { ficha++; p.userData.glb.aplicar(nueva); return Promise.resolve(); }
      return reconstruir(nueva);
    },
    rotar(d) { vuelta = false; objetivo += d; },
    // R177 · giro 360° continuo (se detiene al arrastrar o al elegir una vista)
    girar(on) { vuelta = on === undefined ? !vuelta : !!on; return vuelta; },
    // R172 · vistas fijas, acercar y restablecer cámara
    vista(n) { vuelta = false; const a = { frente: 0, tresCuartos: 0.8, lado: Math.PI / 2, espalda: Math.PI }[n]; if (a === undefined) return; const vueltas = Math.round((objetivo - a) / (Math.PI * 2)); objetivo = a + vueltas * Math.PI * 2; },
    zoom(d) { distObj = Math.min(3.9, Math.max(1.6, distObj - d)); },
    reiniciar() { vuelta = false; objetivo = 0.35; distObj = 3.9; },
    // Miniatura (busto, 160×160 WebP) para mostrar el personaje en listas sin cargar 3D.
    miniatura() {
      const c2 = document.createElement('canvas'); c2.width = 160; c2.height = 160;
      const r2 = new THREE.WebGLRenderer({ canvas: c2, antialias: true, alpha: false, preserveDrawingBuffer: true }); r2.outputColorSpace = THREE.SRGBColorSpace; r2.setClearColor(0xF2E7DC);
      const cam2 = new THREE.PerspectiveCamera(26, 1, 0.1, 20); cam2.position.set(0.2, 1.5, 1.15); cam2.lookAt(0, 1.47, 0);
      const rot = p.rotation.y; p.rotation.y = 0.25; base.visible = false; r2.render(escena, cam2); p.rotation.y = rot; base.visible = true;
      let url = ''; try { url = c2.toDataURL('image/webp', 0.82); if (!url.startsWith('data:image/webp')) url = c2.toDataURL('image/jpeg', 0.82); } catch (_) {}
      r2.dispose(); return url;
    },
    destruir() { vivo = false; canvas.removeEventListener('pointerdown', down); liberar(escena); r.dispose(); },
  };
}

// ---------- Escenario C ----------
function texturaMadera(base = '#8A5A36', vetas = '#6E4428') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) { x.strokeStyle = vetas; x.globalAlpha = 0.08 + Math.random() * 0.12; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); const y = Math.random() * 256; x.moveTo(0, y); x.bezierCurveTo(80, y + 6, 170, y - 6, 256, y + 3); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function texturaPantalla(logo) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#0D0E12'; x.fillRect(0, 0, 1024, 512);
  x.fillStyle = '#B3150F'; x.beginPath(); x.moveTo(1024, 300); x.bezierCurveTo(800, 330, 640, 520, 420, 512); x.lineTo(1024, 512); x.fill();
  x.fillStyle = '#E2231A'; x.globalAlpha = 0.7; x.beginPath(); x.moveTo(1024, 360); x.bezierCurveTo(840, 380, 700, 520, 560, 512); x.lineTo(1024, 512); x.fill(); x.globalAlpha = 1;
  if (logo && logo.width) { const w = 640, h = (logo.height / logo.width) * w; x.drawImage(logo, (1024 - w) / 2, 150, w, h); }
  x.fillStyle = '#FFFFFF'; x.font = '600 30px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.fillText('Conectamos emociones, creamos experiencias.', 512, 340);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function planta(x, z, alto = 1.1, escala = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(escala);
  g.add(malla(new THREE.CylinderGeometry(0.2, 0.16, 0.38, 18), mat('#E8E2D8', { r: 0.5 }), 0, 0.19, 0));
  const hoja = mat('#2F6B3A', { r: 0.6 }), hoja2 = mat('#3E8A47', { r: 0.6 });
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, h = malla(new THREE.SphereGeometry(0.16, 10, 8), i % 2 ? hoja : hoja2, Math.cos(a) * 0.14, 0.4 + alto * (0.35 + (i % 4) * 0.15), Math.sin(a) * 0.14); h.scale.set(0.7, 1.6, 0.35); h.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5); g.add(h); }
  return g;
}
function silla() {
  const g = new THREE.Group(); const cuero = mat('#3A2A22', { r: 0.45 }), metal = mat('#2A2A2A', { m: 0.7, r: 0.35 });
  g.add(malla(new THREE.BoxGeometry(0.56, 0.12, 0.54), cuero, 0, 0.5, 0));
  const resp = malla(new THREE.BoxGeometry(0.56, 0.78, 0.12), cuero, 0, 0.92, -0.26); resp.rotation.x = -0.1; g.add(resp);
  for (const l of [-1, 1]) g.add(malla(new THREE.BoxGeometry(0.06, 0.06, 0.4), metal, l * 0.3, 0.66, -0.02));
  g.add(malla(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 10), metal, 0, 0.25, 0));
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, pata = malla(new THREE.BoxGeometry(0.04, 0.04, 0.32), metal, Math.sin(a) * 0.15, 0.05, Math.cos(a) * 0.15); pata.rotation.y = a; g.add(pata); }
  return g;
}
function laptop() {
  const g = new THREE.Group(); const cuerpo = mat('#1C1D22', { r: 0.4, m: 0.3 });
  g.add(malla(new THREE.BoxGeometry(0.36, 0.015, 0.25), cuerpo, 0, 0.008, 0));
  const tapa = new THREE.Group(); tapa.position.set(0, 0.015, -0.12); tapa.rotation.x = -1.85; g.add(tapa);
  tapa.add(malla(new THREE.BoxGeometry(0.36, 0.25, 0.012), cuerpo, 0, 0.125, 0));
  tapa.add(malla(new THREE.BoxGeometry(0.05, 0.05, 0.002), mat('#E2231A', { e: 0x440000 }), 0, 0.13, 0.007));
  return g;
}

export const ASIENTOS = { naara: { x: 0, z: -1.55, ry: 0 }, libni: { x: -2.15, z: -0.1, ry: Math.PI / 2 * 0.82 }, geisell: { x: 2.15, z: -0.1, ry: -Math.PI / 2 * 0.82 } };
const LIBRES = [{ x: -1.25, z: 1.6, ry: Math.PI * 0.92 }, { x: 0, z: 1.75, ry: Math.PI }, { x: 1.25, z: 1.6, ry: -Math.PI * 0.92 }];

const MOD_ESC = '/escenarios.js?v=20261105-r177';
// R177 · la Sala C original se usa solo si TODO el ambiente es el base (piso, brillo y decoración incluidos)
const DECO_C = { plantas: true, cuadros: false, lamparas: false, mesas: false, paneles: false, logos: false, utileria: true };
const esBase = (e = {}) => !e || ((!e.paredes || e.paredes === 'madera') && (!e.asientos || e.asientos === 'ejecutiva') && (!e.paleta || e.paleta === 'beige-madera') && (!e.luz || e.luz === 'calida')
  && (!e.piso || e.piso === 'madera') && (!e.brillo || e.brillo === 'normal') && (!e.deco || Object.entries(DECO_C).every(([k, v]) => e.deco[k] === undefined || e.deco[k] === v)));
export async function montarSala(contenedor, { avatares = {}, participantes = ['naara', 'libni', 'geisell'], alCambiarVista, escenario = 'sala-c', estilo = null } = {}) {
  const canvas = document.createElement('canvas'); canvas.className = 'sj3d-canvas'; contenedor.appendChild(canvas);
  const r = renderer(canvas); let calidad = movil ? 'baja' : 'alta';
  r.shadowMap.enabled = calidad === 'alta'; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const escena = new THREE.Scene(); escena.background = new THREE.Color('#2A1C14'); escena.fog = new THREE.Fog('#2A1C14', 12, 22);
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 60);

  const logo = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = '/assets/sublicuentas-logo.png'; });
  // R174: Sala C con su estilo base = el diseño original aprobado; cualquier otro escenario/estilo lo arma escenarios.js
  const original = escenario === 'sala-c' && esBase(estilo);
  let A = ASIENTOS, pantalla = null, VIS0 = null, centro = new THREE.Vector3(0, 1.0, -0.4), mesa = null;
  if (!original) {
    const M = await import(MOD_ESC);
    const E = M.construir(escena, escenario, estilo || {}, { logo, texturaPantalla });
    A = E.asientos; pantalla = E.pantalla; centro = E.centro; r.toneMappingExposure = E.exp || 1.05;
    const v3a = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    VIS0 = { general: { pos: v3a(E.vistas.general.pos), mira: v3a(E.vistas.general.mira) }, presentacion: { pos: v3a(E.vistas.presentacion.pos), mira: v3a(E.vistas.presentacion.mira) }, panoramica: { pos: v3a(E.vistas.general.pos), mira: centro.clone() }, radio: E.vistas.panoramica.radio, alto: E.vistas.panoramica.y };
  } else {
  // luces cálidas
  escena.add(new THREE.HemisphereLight(0xffe2bf, 0x5a4030, 1.15));
  const sol = new THREE.DirectionalLight(0xffe6c8, 1.3); sol.position.set(3, 6, 5); sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024); sol.shadow.camera.left = -5; sol.shadow.camera.right = 5; sol.shadow.camera.top = 5; sol.shadow.camera.bottom = -5; escena.add(sol);
  for (const [x, z] of [[-2.5, -1], [0, -0.5], [2.5, -1], [0, 2]]) { const l = new THREE.PointLight(0xffc98a, 9, 8, 1.5); l.position.set(x, 3.15, z); escena.add(l); }

  // sala
  const madera = texturaMadera(); madera.repeat.set(3, 3);
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), new THREE.MeshStandardMaterial({ map: texturaMadera('#6B4A33', '#4E3423'), roughness: 0.55 })); piso.material.map.repeat.set(6, 6); piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; escena.add(piso);
  const alfombra = new THREE.Mesh(new THREE.CircleGeometry(3.3, 48), mat('#5A3B2C', { r: 0.95 })); alfombra.scale.set(1.25, 0.95, 1); alfombra.rotation.x = -Math.PI / 2; alfombra.position.y = 0.005; alfombra.receiveShadow = true; escena.add(alfombra);
  const fondo = new THREE.Group(); fondo.position.z = -4.2; escena.add(fondo);
  fondo.add(malla(new THREE.BoxGeometry(14, 3.6, 0.2), new THREE.MeshStandardMaterial({ map: madera, roughness: 0.6 }), 0, 1.8, -0.1));
  for (let i = -26; i <= 26; i++) fondo.add(malla(new THREE.BoxGeometry(0.1, 3.4, 0.08), mat(i % 2 ? '#7A4E2E' : '#8A5A36', { r: 0.6 }), i * 0.26, 1.8, 0.03));
  const marco = malla(new THREE.BoxGeometry(4.3, 2.25, 0.08), mat('#111216', { r: 0.3 }), 0, 1.95, 0.12); fondo.add(marco);
  pantalla = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 2.05), new THREE.MeshBasicMaterial({ map: texturaPantalla(logo), toneMapped: false })); pantalla.position.set(0, 1.95, 0.17); fondo.add(pantalla);
  fondo.add(malla(new THREE.BoxGeometry(14, 0.06, 0.3), mat('#FFC27A', { e: 0xff9a3c, ei: 0.9 }), 0, 3.5, 0.1)); // tira de luz cálida
  for (const lado of [-1, 1]) { // libreros laterales
    const lib = new THREE.Group(); lib.position.set(lado * 5.2, 0, -2.4); lib.rotation.y = -lado * 0.5; lib.userData.secundario = true; escena.add(lib);
    lib.add(malla(new THREE.BoxGeometry(1.6, 3, 0.4), mat('#5E3B24', { r: 0.6 }), 0, 1.5, 0));
    for (let f = 0; f < 4; f++) { lib.add(malla(new THREE.BoxGeometry(1.5, 0.04, 0.38), mat('#7A4E2E'), 0, 0.5 + f * 0.7, 0.02)); for (let b = 0; b < 6; b++) lib.add(malla(new THREE.BoxGeometry(0.12, 0.3 + (b % 3) * 0.05, 0.25), mat(['#7A1F2B', '#2B4C7E', '#E8E1D5', '#1F2430', '#9E6B3C', '#3E6B47'][(b + f) % 6]), -0.55 + b * 0.2, 0.68 + f * 0.7, 0.05)); }
  }
  [[-3.6, -3.4, 1.3], [3.6, -3.4, 1.3], [-5.4, 0.6, 1.1], [5.4, 0.6, 1.1]].forEach(([x, z, h]) => { const pl = planta(x, z, h); pl.userData.secundario = true; escena.add(pl); });
  const techo = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), mat('#3B2A20', { r: 0.9 })); techo.rotation.x = Math.PI / 2; techo.position.y = 3.6; escena.add(techo);
  for (const [x, z] of [[-2.5, -1], [0, -0.5], [2.5, -1], [-2.5, 1.8], [2.5, 1.8], [0, 2]]) { const f = new THREE.Mesh(new THREE.CircleGeometry(0.12, 20), mat('#FFF1D6', { e: 0xffd9a0, ei: 1.2 })); f.rotation.x = Math.PI / 2; f.position.set(x, 3.59, z); escena.add(f); }

  // mesa ovalada
  mesa = new THREE.Group(); escena.add(mesa);
  const tablero = malla(new THREE.CylinderGeometry(1.0, 1.0, 0.08, 64), new THREE.MeshStandardMaterial({ map: texturaMadera('#7B4A2A', '#5A331C'), roughness: 0.35, metalness: 0.05 }), 0, 0.78, 0); tablero.scale.set(1.95, 1, 1.2); mesa.add(tablero);
  const pie = malla(new THREE.CylinderGeometry(0.5, 0.6, 0.72, 32), mat('#3A2416', { r: 0.5 }), 0, 0.38, 0); pie.scale.set(1.8, 1, 0.9); mesa.add(pie);
  const centro = planta(0, 0, 0.2, 0.42); centro.position.y = 0.8; mesa.add(centro);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; mesa.add(malla(new THREE.SphereGeometry(0.05, 10, 8), mat('#C62828', { r: 0.5 }), Math.cos(a) * 0.14, 1.02 + (i % 3) * 0.03, Math.sin(a) * 0.1)); }
  const tazaG = new THREE.Group(); tazaG.position.set(-1.25, 0.82, -0.15); tazaG.add(malla(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 16), mat('#FFFFFF', { r: 0.2 }), 0, 0.045, 0)); mesa.add(tazaG);

  const colocar = (pos, atras = 0) => { const s = silla(); s.position.set(pos.x - Math.sin(pos.ry) * atras, 0, pos.z - Math.cos(pos.ry) * atras); s.rotation.y = pos.ry; escena.add(s); return s; };
  for (const id of ['naara', 'libni', 'geisell']) {
    const pos = ASIENTOS[id]; colocar(pos, 0.12);
    const lap = laptop(); lap.position.set(pos.x * 0.7 + Math.cos(pos.ry) * 0.28, 0.82, pos.z * 0.66 - Math.sin(pos.ry) * 0.28); lap.rotation.y = pos.ry; lap.scale.setScalar(0.85); mesa.add(lap);
  }
  LIBRES.forEach((pos) => colocar(pos));
  }

  // personajes en sus asientos
  const personajes = {}; const etiquetas = {}; const cargas = [];
  for (const id of ['naara', 'libni', 'geisell']) {
    const pos = A[id]; if (!pos || !participantes.includes(id)) continue;
    const p = new THREE.Group(); p.position.set(pos.x - Math.sin(pos.ry) * 0.05, pos.y || 0, pos.z - Math.cos(pos.ry) * 0.05); p.rotation.y = pos.ry; escena.add(p); personajes[id] = p;
    // R177 · aro luminoso en la base: se enciende solo mientras la persona habla
    const aro = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.56, 56), new THREE.MeshBasicMaterial({ color: '#2FD27A', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    aro.rotation.x = -Math.PI / 2; aro.position.y = 0.02; aro.renderOrder = 3; aro.userData.sjMat = true; aro.name = 'aroVoz'; p.add(aro); p.userData.aro = aro;
    cargas.push(crearAvatar3D(avatares[id]?.config || {}, { sentado: true }).then((a) => {
      if (!vivo) { liberar(a); return; }
      p.add(a); Object.assign(p.userData, { glb: a.userData.glb || null, t0: a.userData.t0 || 0 });
      if (!a.userData.glb) Object.assign(p.userData, a.userData); // respaldo: el personaje anterior se anima como antes
      if (est[id] && est[id].presente === false) setPresente(id, false);
    }));
  }

  // cámaras virtuales
  const VISTAS = VIS0 ? { general: VIS0.general, presentacion: VIS0.presentacion, panoramica: VIS0.panoramica } : {
    general: { pos: new THREE.Vector3(0, 3.05, 5.2), mira: new THREE.Vector3(0, 1.05, -0.9) },
    presentacion: { pos: new THREE.Vector3(0, 1.85, 1.6), mira: new THREE.Vector3(0, 1.85, -4) },
    panoramica: { pos: new THREE.Vector3(0, 3.0, 5.6), mira: new THREE.Vector3(0, 1.0, -0.5) },
  };
  const PAN = VIS0 ? { radio: VIS0.radio, alto: VIS0.alto } : { radio: 5.2, alto: 2.9 };
  const vistaDe = (id) => { const a = A[id]; const y0 = a.y || 0; const frente = new THREE.Vector3(Math.sin(a.ry), 0, Math.cos(a.ry)); return { pos: new THREE.Vector3(a.x, 1.6 + y0, a.z).add(frente.multiplyScalar(2.3)), mira: new THREE.Vector3(a.x, 1.2 + y0, a.z) }; };
  // R177 · Modo grabación: plano frontal de la anfitriona (o de quien graba)
  const vistaGrab = () => { const id = A.naara ? 'naara' : Object.keys(A)[0]; const a = A[id]; const y0 = a.y || 0; const f = new THREE.Vector3(Math.sin(a.ry), 0, Math.cos(a.ry)); return { pos: new THREE.Vector3(a.x, 1.32 + y0, a.z).add(f.multiplyScalar(2.1)), mira: new THREE.Vector3(a.x, 1.12 + y0, a.z) }; };
  VISTAS.grabacion = vistaGrab();
  let actual = { pos: VISTAS.general.pos.clone(), mira: VISTAS.general.mira.clone() }, desde = null, hacia = null, tIni = 0, dur = 900, modo = 'general', panT = 0;
  cam.position.copy(actual.pos); cam.lookAt(actual.mira);
  try { contenedor.__sj3d = { cam, escena }; } catch (_) {}
  // R173 · cámara libre: arrastrar para girar alrededor de la mesa, rueda o pellizco para acercar
  const libre = { az: 0, el: 0.42, dist: 5.4 };
  void mesa;
  const posLibre = () => new THREE.Vector3(centro.x + Math.sin(libre.az) * Math.cos(libre.el) * libre.dist, 0.9 + Math.sin(libre.el) * libre.dist, centro.z + Math.cos(libre.az) * Math.cos(libre.el) * libre.dist);
  VISTAS.libre = { get pos() { return posLibre(); }, mira: new THREE.Vector3(centro.x, 0.9, centro.z) };
  let arr = null; const pts = new Map();
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => { if (modo !== 'libre') return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); arr = { x: e.clientX, y: e.clientY, d: null }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (modo !== 'libre' || !arr || !pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (arr.d) libre.dist = Math.min(8, Math.max(2.2, libre.dist * arr.d / d)); arr.d = d; return; }
    libre.az -= (e.clientX - arr.x) * 0.006; libre.el = Math.min(1.25, Math.max(0.08, libre.el + (e.clientY - arr.y) * 0.004)); arr.x = e.clientX; arr.y = e.clientY;
  });
  const soltar = (e) => { pts.delete(e.pointerId); if (!pts.size) arr = null; else if (arr) arr.d = null; };
  canvas.addEventListener('pointerup', soltar); canvas.addEventListener('pointercancel', soltar);
  canvas.addEventListener('wheel', (e) => { if (modo !== 'libre') return; e.preventDefault(); libre.dist = Math.min(8, Math.max(2.2, libre.dist + Math.sign(e.deltaY) * 0.4)); }, { passive: false });
  function setVista(v) {
    modo = v; const dest = VISTAS[v] || (A[v] ? vistaDe(v) : VISTAS.general);
    desde = { pos: cam.position.clone(), mira: actual.mira.clone() }; hacia = { pos: dest.pos.clone(), mira: dest.mira.clone() }; tIni = performance.now(); if (reducido) tIni -= dur;
    alCambiarVista && alCambiarVista(v);
  }
  // nombres sobre cada personaje
  const capa = document.createElement('div'); capa.className = 'sj3d-nombres'; contenedor.appendChild(capa);
  // R177 · "Nombre visible" elegido en Mi personaje (si no hay, el nombre de usuaria)
  const nombreBase = (id) => { const n = String(avatares[id]?.config?.nombre || '').trim() || (id.charAt(0).toUpperCase() + id.slice(1)); return id === 'naara' ? `👑 ${n} (Anfitriona)` : n; };
  for (const id of Object.keys(personajes)) { const e = document.createElement('span'); e.className = 'sj3d-nombre' + (id === 'naara' ? ' sj3d-anf' : ''); e.dataset.id = id; e.textContent = nombreBase(id); const o = document.createElement('i'); o.className = 'sj3d-ondas'; o.setAttribute('aria-hidden', 'true'); o.innerHTML = '<b></b><b></b><b></b>'; e.appendChild(o); capa.appendChild(e); etiquetas[id] = e; }

  let vivo = true, frames = 0, tMed = performance.now(), hablando = null; const t0 = performance.now(); const v3 = new THREE.Vector3();
  const loop = () => {
    if (!vivo) return; ajustar(r, cam, contenedor); const ahora = performance.now();
    if (hacia) { const k = Math.min(1, (ahora - tIni) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; cam.position.lerpVectors(desde.pos, hacia.pos, e); actual.mira.lerpVectors(desde.mira, hacia.mira, e); if (k >= 1) hacia = null; }
    else if (modo === 'libre') { cam.position.lerp(posLibre(), reducido ? 1 : 0.2); actual.mira.copy(VISTAS.libre.mira); }
    else if (modo === 'panoramica' && !reducido) { panT += 0.0018; cam.position.set(centro.x + Math.sin(panT) * PAN.radio, PAN.alto, centro.z + Math.cos(panT) * PAN.radio); actual.mira.copy(centro); }
    cam.lookAt(actual.mira);
    const t = (ahora - t0) / 1000; for (const [id, p] of Object.entries(personajes)) { const hb = hablando === id; animarPersonaje(p, t, hb ? 1 : 0); const a = p.userData.aro; if (a) { const meta = hb ? (reducido ? 0.7 : 0.55 + Math.sin(t * 6) * 0.25) : 0; a.material.opacity += (meta - a.material.opacity) * (reducido ? 1 : 0.2); a.visible = a.material.opacity > 0.02; } }
    r.render(escena, cam);
    const w = contenedor.clientWidth, h = contenedor.clientHeight;
    for (const [id, p] of Object.entries(personajes)) { v3.set(p.position.x, (p.userData.glb ? 1.46 : 1.95) + p.position.y, p.position.z).project(cam); const e = etiquetas[id]; e.style.transform = `translate(-50%,-100%) translate(${(v3.x * 0.5 + 0.5) * w}px,${(-v3.y * 0.5 + 0.5) * h}px)`; e.style.opacity = v3.z < 1 ? 1 : 0; }
    frames++; if (ahora - tMed > 3000) { const fps = frames / ((ahora - tMed) / 1000); frames = 0; tMed = ahora; if (fps < 28 && calidad === 'alta') { calidad = 'baja'; r.setPixelRatio(1); r.shadowMap.enabled = false; escena.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); } }
    requestAnimationFrame(loop);
  };
  loop();
  // R170 · presencia, micrófono, pantalla compartida y reacciones (Fase 4)
  const matLogo = pantalla.material.map; let texVideo = null;
  const est = {}; // id → { presente, mic }
  const pintarEtq = (id) => { const e = etiquetas[id]; if (!e) return; const x = est[id] || {}; const txt = (x.mano ? '✋ ' : '') + nombreBase(id) + (x.presente === false ? ' · no ha entrado' : x.mic === false ? ' 🔇' : ''); if (e.firstChild && e.firstChild.nodeType === 3) e.firstChild.nodeValue = txt; else e.prepend(txt); e.classList.toggle('sj3d-ausente', x.presente === false); };
  function setPresente(id, presente) {
    const p = personajes[id]; if (!p) return; (est[id] = est[id] || {}).presente = presente;
    p.traverse((o) => { if (o.name === 'aroVoz') return; if (o.material && !o.userData.sjMat) { o.material = o.material.clone(); o.userData.sjMat = true; } if (o.material) { o.material.transparent = !presente; o.material.opacity = presente ? 1 : 0.22; o.material.depthWrite = presente; } });
    pintarEtq(id);
  }
  const caer = []; // reacciones flotando
  let expBase = 0;
  return {
    listo: Promise.all(cargas),
    setVista, vistas: ['general', 'presentacion', 'panoramica', 'libre'],
    setHablante(id) { if (hablando === id) return; if (etiquetas[hablando]) etiquetas[hablando].classList.remove('sj3d-hablando'); hablando = id; if (etiquetas[id]) etiquetas[id].classList.add('sj3d-hablando'); }, calidad: () => calidad,
    setMano(id, on) { const p = personajes[id]; if (!p) return; p.userData.mano = !!on; (est[id] = est[id] || {}).mano = !!on; pintarEtq(id); },
    saludar(id) { const p = personajes[id]; if (p) p.userData.saludo = performance.now(); },
    setPresente, setMicro(id, on) { (est[id] = est[id] || {}).mic = !!on; pintarEtq(id); },
    setPantalla(video) {
      if (texVideo) { texVideo.dispose(); texVideo = null; }
      if (video) { texVideo = new THREE.VideoTexture(video); texVideo.colorSpace = THREE.SRGBColorSpace; pantalla.material.map = texVideo; }
      else pantalla.material.map = matLogo;
      pantalla.material.needsUpdate = true;
    },
    reaccion(id, emoji) {
      const e = etiquetas[id]; if (!e) return; const b = document.createElement('span'); b.className = 'sj3d-reac'; b.textContent = emoji;
      e.appendChild(b); caer.push(b); setTimeout(() => { b.remove(); caer.splice(caer.indexOf(b), 1); }, 2600);
    },
    modoGrabacion(on) {
      escena.traverse((o) => { if (o.userData && o.userData.secundario) o.visible = !on; });
      if (on && !expBase) expBase = r.toneMappingExposure; r.toneMappingExposure = on ? expBase * 1.12 : (expBase || r.toneMappingExposure); if (!on) expBase = 0;
      capa.classList.toggle('sj3d-limpio', !!on); setVista(on ? 'grabacion' : 'general');
    },
    foto() { try { return canvas.toDataURL('image/jpeg', 0.85); } catch (_) { return ''; } },
    destruir() { vivo = false; if (texVideo) texVideo.dispose(); pantalla.material.map = matLogo; liberar(escena); r.dispose(); canvas.remove(); capa.remove(); },
  };
}
