// api/_sala-juntas.js · R167 — SubliStudio 3D · Sala de Juntas (Fase 1). Reglas puras, sin red: las usa api/sala-juntas.js.
// ACL FIJA por identidad verificada (claim `usuario` del token de Sublichat), NUNCA por rol admin:
//   Naara (anfitriona) = cuentas sublicuentas / naara · Libni = libni / relojes · Geisell = geisell / geissel.
// Cualquier otro usuario → sin acceso (aunque tenga el módulo activado en Permisos).
'use strict';

const norm = (v) => String(v == null ? '' : v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const FUNDADORAS = Object.freeze([
  { id: 'naara', nombre: 'Naara', cargo: 'Anfitriona · Super Admin', cuentas: ['sublicuentas', 'naara'], anfitriona: true, asiento: 'centro', chatEnv: 'TELEGRAM_CHAT_ID_SUBLICUENTAS' },
  { id: 'libni', nombre: 'Libni', cargo: 'Fundadora', cuentas: ['libni', 'relojes'], anfitriona: false, asiento: 'izquierda', chatEnv: 'TELEGRAM_CHAT_ID_RELOJES' },
  { id: 'geisell', nombre: 'Geisell', cargo: 'Fundadora', cuentas: ['geisell', 'geissel'], anfitriona: false, asiento: 'derecha', chatEnv: 'TELEGRAM_CHAT_ID_GEISELL' },
]);
const POR_ID = Object.fromEntries(FUNDADORAS.map((f) => [f.id, f]));
const TZ = 'America/Tegucigalpa';
const OFFSET_HORAS = 6; // Honduras: UTC-6 todo el año (sin horario de verano)
const ESTADOS = ['borrador', 'programada', 'en_curso', 'finalizada', 'cancelada'];
const RECORDATORIOS = Object.freeze({ h24: 24 * 60, h1: 60, m10: 10 });

function claveUsuario(user = {}) { return norm(user.usuario || String(user.uid || '').replace(/^(asesor|admin)-/, '')); }
function identidad(user = {}) {
  const k = claveUsuario(user);
  return FUNDADORAS.find((f) => f.cuentas.includes(k)) || null;
}
const puede = {
  ver: (id) => !!id,
  crear: (id) => !!(id && id.anfitriona),
  moderar: (id) => !!(id && id.anfitriona),
  rsvp: (id) => !!id,
};

// Fecha "AAAA-MM-DD" + hora "HH:MM" en Honduras → milisegundos UTC. Devuelve NaN si no es válida.
function aUTC(fecha, hora) {
  const f = String(fecha || '').match(/^(\d{4})-(\d{2})-(\d{2})$/), h = String(hora || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!f || !h) return NaN;
  const [y, mo, d, hh, mm] = [+f[1], +f[2], +f[3], +h[1], +h[2]];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return NaN;
  const ms = Date.UTC(y, mo - 1, d, hh + OFFSET_HORAS, mm);
  const back = new Date(ms - OFFSET_HORAS * 3600000);
  if (back.getUTCDate() !== d || back.getUTCMonth() !== mo - 1) return NaN; // 31/02 y similares
  return ms;
}
function partesHN(ms) {
  const d = new Date(ms - OFFSET_HORAS * 3600000);
  const p = (n) => String(n).padStart(2, '0');
  return { fecha: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`, hora: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` };
}

function limpiarTexto(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
// Valida lo que manda el formulario. `programar` exige fecha futura; un borrador puede quedar incompleto.
function validarConvocatoria(body = {}, { programar = true, ahora = Date.now() } = {}) {
  const titulo = limpiarTexto(body.titulo, 120);
  const agenda = (Array.isArray(body.agenda) ? body.agenda : String(body.agenda || '').split(/\n+/))
    .map((x) => limpiarTexto(String(x).replace(/^[\s•\-*]+/, ''), 200)).filter(Boolean).slice(0, 20);
  const inicioMs = aUTC(body.fecha, body.hora);
  const duracionMin = Math.max(15, Math.min(240, Math.round(Number(body.duracionMin) || 60)));
  const elegidas = new Set((Array.isArray(body.participantes) ? body.participantes : []).map(norm));
  elegidas.add('naara'); // la anfitriona siempre está
  const participantes = FUNDADORAS.map((f) => f.id).filter((id) => elegidas.has(id));
  const rec = body.recordatorios && typeof body.recordatorios === 'object' ? body.recordatorios : {};
  const recordatorios = { h24: rec.h24 !== false, h1: rec.h1 !== false, m10: rec.m10 !== false };
  const errores = [];
  if (programar || titulo) { if (titulo.length < 3) errores.push('Escriba el título de la reunión.'); }
  if (programar) {
    if (!Number.isFinite(inicioMs)) errores.push('Elija fecha y hora válidas.');
    else if (inicioMs < ahora + 2 * 60000) errores.push('La fecha y hora ya pasaron (hora de Honduras).');
    if (!agenda.length) errores.push('Agregue al menos un tema en la agenda.');
    if (participantes.length < 2) errores.push('Elija al menos una fundadora además de Naara.');
  } else if (body.fecha || body.hora) {
    if (!Number.isFinite(inicioMs)) errores.push('La fecha u hora no es válida.');
  }
  const escenario = escenarioValido(body.escenario) ? body.escenario : 'sala-c';
  const presetId = /^[a-z0-9]{4,16}$/.test(String(body.presetId || '')) ? String(body.presetId) : '';
  // R177 · tipo de sesión y estilo sugerido (sin preset guardado)
  const tipo = TIPOS_SESION.includes(body.tipo) ? body.tipo : 'junta';
  const sugerido = !presetId && SUGERIDOS.includes(body.sugerido) ? body.sugerido : '';
  return { ok: !errores.length, errores, datos: { titulo, agenda, inicioMs: Number.isFinite(inicioMs) ? inicioMs : null, duracionMin, participantes, recordatorios, escenario, presetId, tipo, sugerido } };
}

// Avisos de Telegram que corresponden a una reunión (solo los futuros). Ids deterministas = idempotentes.
function planAvisos(reunionId, datos, version, ahora = Date.now()) {
  const out = [];
  for (const u of datos.participantes) {
    out.push({ id: `${reunionId}_${u}_invitacion_v${version}`, usuario: u, tipo: 'invitacion', programadoMs: ahora });
    for (const [tipo, min] of Object.entries(RECORDATORIOS)) {
      if (!datos.recordatorios[tipo]) continue;
      const t = datos.inicioMs - min * 60000;
      if (t > ahora) out.push({ id: `${reunionId}_${u}_${tipo}_v${version}`, usuario: u, tipo, programadoMs: t });
    }
    if (datos.inicioMs > ahora) out.push({ id: `${reunionId}_${u}_inicio_v${version}`, usuario: u, tipo: 'inicio', programadoMs: datos.inicioMs });
  }
  return out;
}

// Una reunión pasa sola a "finalizada" cuando termina su duración (+30 min de gracia) y no está abierta.
function estadoVigente(r = {}, ahora = Date.now()) {
  if (!['programada', 'en_curso'].includes(r.estado)) return r.estado;
  const fin = Number(r.inicioMs || 0) + (Number(r.duracionMin || 60) + 30) * 60000;
  if (ahora > fin && !r.salaAbierta) return 'finalizada';
  return r.estado;
}

function roomIdOpaco(rnd = Math.random) {
  let s = ''; const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  for (let i = 0; i < 20; i++) s += abc[Math.floor(rnd() * abc.length)];
  return 'sj_' + s;
}

// ---------- R169 · Mi personaje (Fase 3) ----------
// Opciones permitidas del personaje 3D. Todo lo que no esté aquí se descarta (no se guarda texto libre ni URLs).
// R172 · Fase 3B: avatares 3D reales (modelos CC0 Quaternius). Cada base tiene sus propias piezas (mallas distintas).
const AVATAR_GENERO = Object.freeze({
  mujer: Object.freeze({ cabello: ['melena', 'recogido', 'lacio', 'corto', 'ondulado', 'largo'], superior: ['blazer', 'blusa', 'vestido', 'camiseta', 'chaqueta'], inferior: ['pantalon', 'falda', 'casual'], calzado: ['formal', 'tacon', 'casual', 'botas'] }),
  hombre: Object.freeze({ cabello: ['clasico', 'moderno', 'rizado', 'largoMedio', 'conBarba', 'cresta'], superior: ['traje', 'sueter', 'camiseta', 'chaleco'], inferior: ['pantalon', 'jeans', 'shorts'], calzado: ['formal', 'tenis', 'casual'] }),
});
const unir = (k) => [...new Set([...AVATAR_GENERO.mujer[k], ...AVATAR_GENERO.hombre[k]])];
const AVATAR_OPC = Object.freeze({
  genero: ['mujer', 'hombre'],
  piel: ['#F6D7C3', '#EFC3A4', '#E2A982', '#C98E66', '#A86F4C', '#7E5136', '#5A3825'],
  cabello: unir('cabello'),
  colorCabello: ['#1E1A18', '#3B2A20', '#6B4226', '#A0703F', '#D8B26E', '#8C8C8C', '#9E2B25'],
  ojos: ['#4A2E1F', '#2F5D3A', '#2F4E7A', '#1E1A18'],
  superior: unir('superior'),
  colorSuperior: ['#C62828', '#1F2430', '#FFFFFF', '#2B4C7E', '#5E6B7A', '#7A1F2B', '#E8E1D5'],
  colorInterior: ['#FFFFFF', '#1F2430', '#E8E1D5', '#C62828'],
  inferior: unir('inferior'),
  colorInferior: ['#1F2430', '#3E4A5C', '#5E4A3A', '#2B2B2B', '#C7B9A3'],
  calzado: unir('calzado'),
  colorCalzado: ['#1A1A1A', '#5E3B24', '#FFFFFF', '#7A1F2B'],
  lentes: [false, true], aretes: [false, true], collar: [false, true], reloj: [false, true], barba: [false, true], logo: [false, true],
});
const AVATAR_BASE = Object.freeze({
  naara: { genero: 'mujer', piel: '#EFC3A4', cabello: 'largo', colorCabello: '#3B2A20', ojos: '#4A2E1F', superior: 'blazer', colorSuperior: '#C62828', colorInterior: '#1F2430', inferior: 'pantalon', colorInferior: '#1F2430', calzado: 'tacon', colorCalzado: '#1A1A1A', lentes: false, aretes: true, collar: true, reloj: false, barba: false, logo: false },
  libni: { genero: 'mujer', piel: '#E2A982', cabello: 'melena', colorCabello: '#1E1A18', ojos: '#4A2E1F', superior: 'blazer', colorSuperior: '#1F2430', colorInterior: '#FFFFFF', inferior: 'pantalon', colorInferior: '#1F2430', calzado: 'formal', colorCalzado: '#1A1A1A', lentes: false, aretes: true, collar: false, reloj: true, barba: false, logo: false },
  geisell: { genero: 'mujer', piel: '#EFC3A4', cabello: 'recogido', colorCabello: '#3B2A20', ojos: '#4A2E1F', superior: 'blusa', colorSuperior: '#FFFFFF', colorInterior: '#FFFFFF', inferior: 'pantalon', colorInferior: '#3E4A5C', calzado: 'formal', colorCalzado: '#1A1A1A', lentes: true, aretes: true, collar: false, reloj: false, barba: false, logo: false },
});
// Personajes guardados con el editor anterior (R169): se traducen a las piezas nuevas sin perder colores.
const MIGRA = {
  mujer: { cabello: { cola: 'recogido', rizado: 'ondulado', peinado: 'melena', rapado: 'corto' }, superior: { camisa: 'blusa', polo: 'camiseta' } },
  hombre: { cabello: { largo: 'largoMedio', melena: 'largoMedio', cola: 'largoMedio', recogido: 'clasico', corto: 'clasico', peinado: 'clasico', rapado: 'clasico' }, superior: { blazer: 'traje', camisa: 'camiseta', polo: 'camiseta', blusa: 'camiseta' }, inferior: { falda: 'pantalon' } },
};
function migrarAvatar(cfg = {}) {
  const c = { ...(cfg || {}) };
  const g = c.genero === 'hombre' ? 'hombre' : 'mujer';
  if (typeof c.calzado === 'string' && c.calzado.startsWith('#')) { if (!c.colorCalzado) c.colorCalzado = c.calzado; c.calzado = 'formal'; }
  for (const k of ['cabello', 'superior', 'inferior']) if (MIGRA[g][k] && MIGRA[g][k][c[k]]) c[k] = MIGRA[g][k][c[k]];
  delete c.cejas;
  return c;
}
function limpiarAvatar(cfg = {}, base = AVATAR_BASE.naara) {
  const entrada = migrarAvatar(cfg);
  const out = {};
  for (const [k, opc] of Object.entries(AVATAR_OPC)) {
    let v = entrada && Object.prototype.hasOwnProperty.call(entrada, k) ? entrada[k] : base[k];
    if (typeof v === 'string' && v.startsWith('#')) v = v.toUpperCase();
    out[k] = opc.includes(v) ? v : base[k];
  }
  // cada pieza debe existir en la base elegida (mujer/hombre)
  const G = AVATAR_GENERO[out.genero];
  for (const k of ['cabello', 'superior', 'inferior', 'calzado']) if (!G[k].includes(out[k])) out[k] = G[k].includes(base[k]) ? base[k] : G[k][0];
  if (out.genero === 'mujer') out.barba = false;
  out.nombre = limpiarNombreVisible(entrada && entrada.nombre); // R177 · "Nombre visible" ('' = su nombre de usuaria)
  return out;
}
// R177 · nombre que se ve sobre el personaje y en la tarjeta de participante: texto simple, 24 caracteres.
function limpiarNombreVisible(t) { return String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f<>{}`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24); }
// Miniatura generada por el editor: solo imagen WebP/JPEG/PNG en data URL y de tamaño acotado.
function miniaturaValida(t) { return typeof t === 'string' && /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(t) && t.length <= 90000; }

// ---------- R174 · Escenarios (Fase 6). Mismos ids que escenarios.js (lo revisa tests/r174-escenarios.test.mjs) ----------
const ESCENARIOS = Object.freeze({
  'sala-c': { paredes: ['madera', 'listones', 'grafito', 'logo'], asientos: ['ejecutiva', 'media', 'moderna', 'premium'], paleta: ['beige-madera', 'rojo-grafito', 'negro-rojo', 'blanco-rojo', 'gris-calido'], luz: ['calida', 'neutra', 'led', 'indirecta'], base: { paredes: 'madera', asientos: 'ejecutiva', paleta: 'beige-madera', luz: 'calida' , piso: 'madera', brillo: 'normal', deco: { plantas: true, cuadros: false, lamparas: false, mesas: false, paneles: false, logos: false, utileria: true }} },
  socios: { paredes: ['madera', 'grafito', 'listones', 'logo'], asientos: ['ejecutiva', 'media', 'moderna', 'premium'], paleta: ['rojo-grafito', 'beige-madera', 'negro-rojo', 'blanco-rojo', 'gris-calido'], luz: ['anillo', 'led', 'indirecta', 'neutra'], base: { paredes: 'madera', asientos: 'ejecutiva', paleta: 'beige-madera', luz: 'anillo' , piso: 'madera', brillo: 'normal', deco: { plantas: true, cuadros: false, lamparas: false, mesas: false, paneles: true, logos: false, utileria: true }} },
  aula: { paredes: ['madera', 'blanco', 'grafito', 'mixto'], asientos: ['pupitre', 'ejecutivo', 'butaca', 'mesas'], paleta: ['rojo-blanco', 'rojo-madera', 'blanco-gris', 'negro-rojo', 'beige-calido'], luz: ['calida', 'aula', 'led', 'auditorio'], base: { paredes: 'madera', asientos: 'pupitre', paleta: 'rojo-madera', luz: 'calida' , piso: 'madera', brillo: 'normal', deco: { plantas: true, cuadros: false, lamparas: false, mesas: false, paneles: false, logos: false, utileria: true }} },
  live: { paredes: ['led', 'negro', 'claro', 'modular'], asientos: ['talkshow', 'altas', 'lounge', 'entrevista'], paleta: ['rojo-negro', 'rojo-gris', 'rojo-blanco', 'negro-grafito', 'rojo-dorado'], luz: ['aro', 'estudio', 'led', 'calida'], base: { paredes: 'led', asientos: 'talkshow', paleta: 'rojo-negro', luz: 'estudio' , piso: 'madera', brillo: 'normal', deco: { plantas: false, cuadros: false, lamparas: false, mesas: false, paneles: false, logos: true, utileria: true }} },
  cinema: { paredes: ['acustica', 'rojo', 'madera', 'paneles'], asientos: ['butaca', 'sofa', 'reclinable', 'doble'], paleta: ['rojo-negro', 'grafito-dorado', 'negro-rojo', 'beige-oscuro', 'rojo-vino'], luz: ['pasillo', 'tenue', 'led', 'lounge'], base: { paredes: 'acustica', asientos: 'butaca', paleta: 'rojo-negro', luz: 'tenue' , piso: 'madera', brillo: 'normal', deco: { plantas: false, cuadros: false, lamparas: false, mesas: false, paneles: false, logos: false, utileria: true }} },
});
const MAX_PRESETS = 12;
// R177 · tipos de sesión (la convocatoria sugiere escenario y estilo; se puede cambiar) y estilos sugeridos de escenarios.js
const TIPOS_SESION = ['junta', 'revision', 'clase', 'presentacion', 'grabacion', 'otra'];
const SUGERIDOS = ['junta', 'sobria', 'anuncio', 'presentacion', 'grabacion'];
// R177 · ambiente editable (igual en escenarios.js · AMBIENTE): piso, brillo y objetos de decoración encendidos/apagados
const AMBIENTE = Object.freeze({ piso: ['madera', 'neutro', 'oscuro', 'claro'], brillo: ['suave', 'normal', 'brillante'], deco: ['plantas', 'cuadros', 'lamparas', 'mesas', 'paneles', 'logos', 'utileria'] });
function estiloEscenario(id, estilo = {}) {
  const E = ESCENARIOS[id]; if (!E) return null; const out = {}; const e = estilo && typeof estilo === 'object' ? estilo : {};
  for (const k of ['paredes', 'asientos', 'paleta', 'luz']) out[k] = E[k].includes(e[k]) ? e[k] : E.base[k];
  out.piso = AMBIENTE.piso.includes(e.piso) ? e.piso : E.base.piso;
  out.brillo = AMBIENTE.brillo.includes(e.brillo) ? e.brillo : E.base.brillo;
  const d = e.deco && typeof e.deco === 'object' ? e.deco : {};
  out.deco = Object.fromEntries(AMBIENTE.deco.map((k) => [k, typeof d[k] === 'boolean' ? d[k] : E.base.deco[k]]));
  return out;
}
const escenarioValido = (id) => Object.prototype.hasOwnProperty.call(ESCENARIOS, id);

// ---------- R173 · Acta y acuerdos ----------
const limpiarTxt = (x, max) => String(x == null ? '' : x).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
function validarActa(b = {}) {
  const resumen = limpiarTxt(b.resumen, 4000);
  const decisiones = (Array.isArray(b.decisiones) ? b.decisiones : []).map((d) => limpiarTxt(d, 300)).filter(Boolean).slice(0, 30);
  const acuerdos = (Array.isArray(b.acuerdos) ? b.acuerdos : []).map((k, i) => ({
    id: /^[a-z0-9]{1,12}$/.test(String(k && k.id || '')) ? k.id : 'a' + (i + 1),
    texto: limpiarTxt(k && k.texto, 300),
    responsable: POR_ID[k && k.responsable] ? k.responsable : '',
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(k && k.fecha || '')) ? k.fecha : '',
    estado: k && k.estado === 'cumplido' ? 'cumplido' : 'pendiente',
  })).filter((k) => k.texto).slice(0, 30);
  if (!resumen && !decisiones.length && !acuerdos.length) { const m = 'Escriba al menos un resumen, una decisión o un acuerdo.'; throw Object.assign(new Error(m), { status: 400, publico: m }); }
  for (const k of acuerdos) if (!k.responsable) { const m = `El acuerdo "${k.texto.slice(0, 40)}" necesita responsable.`; throw Object.assign(new Error(m), { status: 400, publico: m }); }
  return { resumen, decisiones, acuerdos };
}

// ---------- R170 · Fase 4: tokens de LiveKit (firmados en el servidor; nunca viajan por Telegram) ----------
const crypto = require('crypto');
const b64u = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function jwtHS256(payload, secret) {
  const cab = b64u({ alg: 'HS256', typ: 'JWT' }), cuerpo = b64u(payload);
  const firma = crypto.createHmac('sha256', String(secret)).update(`${cab}.${cuerpo}`).digest('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${cab}.${cuerpo}.${firma}`;
}
// Token de participante: solo esa sala, solo esa identidad, permisos mínimos; la anfitriona además modera.
function tokenParticipante({ apiKey, apiSecret, identidad, nombre, sala, ttlSeg, anfitriona, ahora = Date.now() }) {
  const iat = Math.floor(ahora / 1000);
  return jwtHS256({ iss: apiKey, sub: identidad, name: nombre, nbf: iat - 5, iat, exp: iat + Math.max(60, Math.floor(ttlSeg)), jti: crypto.randomBytes(8).toString('hex'),
    metadata: JSON.stringify({ rol: anfitriona ? 'anfitriona' : 'fundadora' }),
    video: { room: sala, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, canPublishSources: ['microphone', 'camera', 'screen_share', 'screen_share_audio'], roomAdmin: !!anfitriona, canUpdateOwnMetadata: true } }, apiSecret);
}
// Token corto del servidor para la API de LiveKit (expulsar, cerrar la sala).
function tokenServidor({ apiKey, apiSecret, sala, ahora = Date.now() }) {
  const iat = Math.floor(ahora / 1000);
  return jwtHS256({ iss: apiKey, nbf: iat - 5, iat, exp: iat + 120, video: { room: sala, roomAdmin: true, roomCreate: true } }, apiSecret);
}
const httpDeLiveKit = (url) => String(url || '').trim().replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:').replace(/\/+$/, '');
// Ventana para entrar: desde 30 min antes del inicio hasta 60 min después del final previsto (tope de costo).
function ventanaSala(r = {}) { const ini = Number(r.inicioMs || 0), fin = ini + (Number(r.duracionMin) || 60) * 60000; return { desde: ini - 30 * 60000, hasta: fin + 60 * 60000 }; }

module.exports = {
  limpiarNombreVisible, AMBIENTE, TIPOS_SESION, SUGERIDOS, ESCENARIOS, MAX_PRESETS, estiloEscenario, escenarioValido, validarActa, AVATAR_GENERO, migrarAvatar, jwtHS256, tokenParticipante, tokenServidor, httpDeLiveKit, ventanaSala, AVATAR_OPC, AVATAR_BASE, limpiarAvatar, miniaturaValida, FUNDADORAS, POR_ID, TZ, ESTADOS, RECORDATORIOS, claveUsuario, identidad, puede, aUTC, partesHN, validarConvocatoria, planAvisos, estadoVigente, roomIdOpaco };
