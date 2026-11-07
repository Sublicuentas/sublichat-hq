// api/_permisos.js · R162 — Módulos por usuario que define Sublicuentas (supervisor).
// --------------------------------------------------------------------------------------------------------------
// · Sublicuentas tiene SIEMPRE todos los módulos (no se le pueden quitar).
// · Para cualquier otro usuario (Relojes, Geisell, Magdiel o los que se agreguen en AUTH_USERS_JSON) Sublicuentas
//   puede ACTIVAR o DESACTIVAR cada módulo. Lo que no se toque queda como hasta hoy (reglas por rol de siempre).
// · Lo guardado vive en Firestore config/sublichat_permisos { usuarios: { <usuario>: { modulos: { <id>: true|false } } } }.
//   Solo se guardan las DIFERENCIAS que eligió Sublicuentas; borrar una diferencia = volver a lo de siempre.
// · El servidor lo respeta en los módulos que tienen control propio (marcados `servidor: true`): un módulo
//   desactivado responde 403 aunque alguien llame la API directo; uno activado da acceso aunque el rol no lo tenía.
// Sin Firestore ni red en este archivo: recibe `db`. Lo usan api/permisos.js y las APIs de cada módulo.
'use strict';

const DOC = ['config', 'sublichat_permisos'];
const norm = (v) => String(v == null ? '' : v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Catálogo de módulos. `pantallas` = ids de pantalla de la web (data-screen). `fijo` = siempre activo para todos.
const MODULOS = Object.freeze([
  { id: 'inicio', label: 'Inicio', grupo: 'Principal', pantallas: ['inicio'], fijo: true },
  { id: 'clientes', label: 'Clientes', grupo: 'Principal', pantallas: ['clientes'] },
  { id: 'renovaciones', label: 'Renovaciones', grupo: 'Principal', pantallas: ['agenda'] },
  { id: 'control-maestro', label: 'Control Maestro', grupo: 'Principal', pantallas: ['control-cuentas'], servidor: true },
  { id: 'portal-cliente', label: 'Portal Cliente', grupo: 'Principal', pantallas: ['portal-cliente'], servidor: true },
  { id: 'catalogo', label: 'Catálogo', grupo: 'Principal', pantallas: ['catalogo-relojes'], servidor: true },
  { id: 'sala-juntas', label: 'Sala de Juntas (SubliStudio 3D)', grupo: 'Principal', pantallas: ['sala-juntas'], servidor: true }, // R179 · antes ACL fija
  { id: 'sorteos', label: 'Sorteos', grupo: 'Principal', pantallas: ['sorteos'], servidor: true },
  { id: 'tickets', label: 'Tickets / Avisos', grupo: 'Principal', pantallas: ['tickets'] },
  { id: 'panel-socios', label: 'Panel de Socios', grupo: 'Principal', pantallas: ['revendedores'], servidor: true },
  { id: 'perfil', label: 'Perfil', grupo: 'Principal', pantallas: ['perfil'], fijo: true },
  { id: 'mesas', label: 'Mesas de trabajo / Flujo diario', grupo: 'Operación', pantallas: ['importar'], servidor: true },
  { id: 'bodega', label: 'Bodega', grupo: 'Operación', pantallas: ['inventario'], servidor: true },
  { id: 'finanzas', label: 'Finanzas (egresos, cierre y libro)', grupo: 'Operación', pantallas: ['egresos', 'cierre'], servidor: true },
  { id: 'codigos', label: 'Códigos de plataformas (APK)', grupo: 'Operación', pantallas: [], servidor: true },
  { id: 'baul-apks', label: 'Baúl de APKs de TV Digital (APK y bot)', grupo: 'Operación', pantallas: [], servidor: true }, // R187
  { id: 'spotify-familias', label: 'Spotify Familiar (familias e invitados)', grupo: 'Operación', pantallas: [], servidor: true }, // R188
  { id: 'actividad', label: 'Actividad del sistema', grupo: 'Supervisión', pantallas: ['actividad'], servidor: true },
  { id: 'auditoria', label: 'Cuadre y auditoría', grupo: 'Supervisión', pantallas: ['auditoria'] },
  { id: 'crm-master', label: 'CRM Master', grupo: 'Supervisión', pantallas: ['crm-master'] },
  { id: 'metricas', label: 'Métricas', grupo: 'Supervisión', pantallas: ['estadisticas'] },
  { id: 'objetivos', label: 'Objetivos', grupo: 'Extras', pantallas: ['objetivos'] },
  { id: 'chat', label: 'Subli (asistente)', grupo: 'Extras', pantallas: ['chat'] },
  { id: 'pelis', label: 'Pelis', grupo: 'Extras', pantallas: ['pelis'] },
  { id: 'partidos', label: 'Partidos', grupo: 'Extras', pantallas: ['partidos'] },
]);
const IDS = new Set(MODULOS.map((m) => m.id));

// Mismo criterio de identidad que la web (sublichat-app.js · subliRBAC): el usuario manda sobre el rol genérico.
const ALIAS = {
  relojes: 'finanzas', libni: 'finanzas', daniela: 'finanzas', finanzas: 'finanzas',
  sublicuentas: 'admin', naara: 'admin', admin: 'admin', administrador: 'admin', owner: 'admin',
  magdiel: 'auditor', auditor: 'auditor', auditoria: 'auditor',
  geisell: 'geisell_admin', geissel: 'geisell_admin', geisell_admin: 'geisell_admin', control_admin: 'geisell_admin',
};
function claveUsuario(user = {}) {
  const k = norm(user.usuario || String(user.uid || '').replace(/^(asesor|admin)-/, ''));
  return k === 'geissel' ? 'geisell' : k;
}
function rolDe(user = {}) {
  const u = claveUsuario(user), r = norm(user.role);
  if (ALIAS[u]) return ALIAS[u];
  if (ALIAS[r] && !['asesor', 'user', 'usuario', 'staff'].includes(r)) return ALIAS[r];
  return 'finanzas'; // usuario nuevo o genérico: vista operativa de menor privilegio (igual que la web)
}
function esSupervisor(user = {}) { return ['sublicuentas', 'naara'].includes(claveUsuario(user)) || rolDe(user) === 'admin'; }

const SALA_DEFECTO = ['sublicuentas', 'naara', 'libni', 'relojes', 'geisell'];
// Lo que cada usuario tiene HOY sin que Sublicuentas cambie nada (copia de las reglas de la web y de cada API).
const MENU_ROL = {
  finanzas: ['inicio', 'clientes', 'portal-cliente', 'catalogo-relojes', 'sorteos', 'agenda', 'objetivos', 'importar', 'tickets', 'pelis', 'partidos', 'chat', 'perfil'],
  admin: ['inicio', 'clientes', 'portal-cliente', 'control-cuentas', 'catalogo-relojes', 'sorteos', 'revendedores', 'agenda', 'objetivos', 'importar', 'tickets', 'inventario', 'egresos', 'pelis', 'partidos', 'chat', 'actividad', 'perfil'],
  auditor: ['inicio', 'crm-master', 'objetivos', 'importar', 'auditoria', 'estadisticas', 'tickets', 'clientes', 'chat', 'perfil'],
  geisell_admin: ['inicio', 'clientes', 'control-cuentas', 'tickets', 'perfil'],
};
function porDefecto(user = {}) {
  if (esSupervisor(user)) return Object.fromEntries(MODULOS.map((m) => [m.id, true]));
  const u = claveUsuario(user), rol = rolDe(user), menu = new Set(MENU_ROL[rol] || []);
  const relojes = ['relojes', 'libni'].includes(u), geisell = u === 'geisell';
  const out = {};
  for (const m of MODULOS) {
    let v = m.fijo || m.pantallas.some((p) => menu.has(p));
    if (m.id === 'control-maestro') v = geisell;
    if (m.id === 'panel-socios' || m.id === 'actividad') v = false;
    if (['portal-cliente', 'sorteos', 'catalogo'].includes(m.id)) v = relojes;
    if (m.id === 'finanzas') v = rol === 'finanzas' && relojes;
    if (m.id === 'codigos') v = relojes || geisell;
    if (m.id === 'baul-apks') v = relojes || geisell; // R187 · fundadoras; a los demás lo activa Sublicuentas
    if (m.id === 'spotify-familias') v = relojes || geisell; // R188 · igual que el Baúl
    if (m.id === 'bodega') v = false;
    if (m.id === 'sala-juntas') v = SALA_DEFECTO.includes(u); // las fundadoras la tienen; a los demás la activa Sublicuentas
    out[m.id] = !!v;
  }
  return out;
}

// --- Lectura con caché corta (cada instancia del servidor) ---
const CACHE_MS = 20000;
let cache = { at: 0, data: null };
async function leerConfig(db, { fresco = false } = {}) {
  if (!fresco && cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  let data = {};
  try { const s = await db.collection(DOC[0]).doc(DOC[1]).get(); data = s.exists ? (s.data() || {}) : {}; } catch (e) { if (cache.data) return cache.data; throw e; }
  cache = { at: Date.now(), data };
  return data;
}
function invalidar() { cache = { at: 0, data: null }; }
function overridesDe(config = {}, clave = '') {
  const raw = config?.usuarios?.[clave]?.modulos || {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) if (IDS.has(k) && typeof v === 'boolean') out[k] = v;
  return out;
}

// Para las APIs: contexto del usuario (una lectura por petición, con caché).
async function contexto(db, user = {}) {
  const clave = claveUsuario(user);
  if (esSupervisor(user)) return { clave, supervisor: true, overrides: {} };
  let overrides = {}, retirado = false;
  try { const cfg = await leerConfig(db); overrides = overridesDe(cfg, clave); retirado = esRetirado(cfg, user); } catch (_) { overrides = {}; } // si Firestore falla: reglas de siempre
  return { clave, supervisor: false, overrides, retirado };
}
// permitidoHoy = la regla que la API ya tenía. Sublicuentas: sin cambios. Otros: manda lo que eligió Sublicuentas.
function aplicar(ctx, modulo, permitidoHoy) {
  if (!ctx || ctx.supervisor) return !!permitidoHoy;
  if (ctx.retirado) return false; // R180 · retirado: ningún módulo en ninguna API que use decidir()
  const v = ctx.overrides?.[modulo];
  return typeof v === 'boolean' ? v : !!permitidoHoy;
}
async function decidir(db, user, modulo, permitidoHoy) { return aplicar(await contexto(db, user), modulo, permitidoHoy); }

// Para la web: mapa final de módulos del usuario y de pantallas visibles.
// R180 · usuario retirado por Sublicuentas (config.retirados[clave]): pierde TODO acceso, aunque siga en AUTH_USERS_JSON.
// Se identifica por la clave de usuario + UID de Firebase guardado al retirarlo; nunca por coincidencia de nombre.
function esRetirado(config = {}, user = {}) {
  const r = config && config.retirados ? config.retirados[claveUsuario(user)] : null;
  return !!(r && !r.reactivadoAt) && !esSupervisor(user);
}
function efectivos(user = {}, config = {}) {
  const base = porDefecto(user);
  if (esSupervisor(user)) return base;
  if (esRetirado(config, user)) return Object.fromEntries(MODULOS.map((m) => [m.id, false]));
  const ov = overridesDe(config, claveUsuario(user));
  const out = { ...base, ...ov };
  for (const m of MODULOS) if (m.fijo) out[m.id] = true;
  return out;
}
// Pantallas del menú. Sin cambios de Sublicuentas, cada usuario ve EXACTAMENTE lo de siempre; un módulo activado
// agrega todas sus pantallas y uno desactivado las quita. Sublicuentas ve todos los módulos.
function pantallasVisibles(user = {}, config = {}) {
  const mods = efectivos(user, config);
  if (esSupervisor(user)) return MODULOS.flatMap((m) => m.pantallas);
  if (esRetirado(config, user)) return [];
  const base = porDefecto(user), ov = overridesDe(config, claveUsuario(user));
  const menu = new Set(MENU_ROL[rolDe(user)] || []);
  const out = [];
  for (const m of MODULOS) {
    if (!mods[m.id]) continue;
    if (m.id === 'sala-juntas') { out.push('sala-juntas'); continue; } // R179 · módulo seleccionable: activo = se ve
    const todas = ov[m.id] === true && !base[m.id];
    for (const p of m.pantallas) if (todas || m.fijo || menu.has(p) || ov[m.id] === true) out.push(p);
  }
  return out;
}
// Normaliza lo que manda Sublicuentas al guardar: { id: true | false | null }. null = volver a lo de siempre.
function limpiarCambios(cambios = {}) {
  const out = {};
  for (const [k, v] of Object.entries(cambios || {})) {
    if (!IDS.has(k)) continue;
    const m = MODULOS.find((x) => x.id === k);
    if (m.fijo) continue;
    if (v === true || v === false || v === null) out[k] = v;
  }
  return out;
}

module.exports = { esRetirado, MODULOS, DOC, claveUsuario, rolDe, esSupervisor, porDefecto, leerConfig, invalidar, overridesDe, contexto, aplicar, decidir, efectivos, pantallasVisibles, limpiarCambios };
