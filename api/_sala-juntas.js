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
  return { ok: !errores.length, errores, datos: { titulo, agenda, inicioMs: Number.isFinite(inicioMs) ? inicioMs : null, duracionMin, participantes, recordatorios } };
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

module.exports = { FUNDADORAS, POR_ID, TZ, ESTADOS, RECORDATORIOS, claveUsuario, identidad, puede, aUTC, partesHN, validarConvocatoria, planAvisos, estadoVigente, roomIdOpaco };
