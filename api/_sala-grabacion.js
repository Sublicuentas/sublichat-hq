// api/_sala-grabacion.js · R193 — Grabación COMPLETA de la Sala de Juntas en el SERVIDOR (LiveKit Egress).
// · Graba la sala 3D (escena, avatares, presentación) + el audio real de todas, con una plantilla web propia
//   (sala-grabacion.html) que LiveKit abre en su navegador de grabación. No es un MP3 ni una grabación local.
// · La inicia/detiene SOLO la anfitriona, desde el servidor. El archivo va a un bucket PRIVADO; se ve con un
//   enlace firmado que vence en 15 minutos (nunca una URL pública perpetua).
// · Las credenciales del bucket (cuenta de servicio dedicada) viven SOLO en variables de entorno de Vercel:
//   nunca en la APK, en la respuesta, en registros ni en la URL.
'use strict';
const crypto = require('crypto');

const COLECCION = 'sala_grabaciones';
const MAX_MIN = 120; // tope de costo/tamaño
const FIRMA_MIN = 15; // vigencia del enlace de reproducción

// Qué falta configurar (nombres de variables, nunca valores).
function configGrabacion(env = {}) {
  const faltan = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'SALA_GRAB_BUCKET', 'SALA_GRAB_GCP_CREDENTIALS', 'SALA_PUBLIC_BASE']
    .filter((k) => !String(env[k] || '').trim());
  let credOk = true;
  if (!faltan.includes('SALA_GRAB_GCP_CREDENTIALS')) { try { const j = JSON.parse(env.SALA_GRAB_GCP_CREDENTIALS); credOk = !!(j && j.client_email && j.private_key); } catch (_) { credOk = false; } }
  if (!credOk) faltan.push('SALA_GRAB_GCP_CREDENTIALS (JSON inválido)');
  const base = String(env.SALA_PUBLIC_BASE || '').trim().replace(/\/+$/, '');
  if (base && !/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(base)) faltan.push('SALA_PUBLIC_BASE (debe ser https://dominio)');
  return { ok: faltan.length === 0, faltan, base };
}

const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function jwt(payload, secret) {
  const cab = b64u({ alg: 'HS256', typ: 'JWT' }), cuerpo = b64u(payload);
  const firma = crypto.createHmac('sha256', String(secret)).update(`${cab}.${cuerpo}`).digest('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${cab}.${cuerpo}.${firma}`;
}
// Token SOLO para la API de grabación de esa sala (2 minutos).
function tokenEgress({ apiKey, apiSecret, sala, ahora = Date.now() }) {
  const iat = Math.floor(ahora / 1000);
  return jwt({ iss: apiKey, nbf: iat - 5, iat, exp: iat + 120, video: { room: sala, roomRecord: true } }, apiSecret);
}

// Id público de la grabación (va en «layout»: LiveKit se lo pasa a la plantilla). Aleatorio, no adivinable, sin datos.
const nuevoId = () => 'g' + crypto.randomBytes(12).toString('hex');
const idValido = (id) => /^g[0-9a-f]{24}$/.test(String(id || ''));

// Solicitud a LiveKit: composición de la sala con NUESTRA plantilla 3D → MP4 en el bucket privado.
function cuerpoInicio({ sala, base, bucket, credenciales, reunionId, grabacionId }) {
  return {
    roomName: sala,
    layout: grabacionId, // la plantilla lo recibe como ?layout= y pide SOLO la escena (nombres, avatares, escenario)
    customBaseUrl: `${base}/sala-grabacion.html`,
    audioOnly: false, videoOnly: false,
    preset: 'H264_720P_30',
    fileOutputs: [{ fileType: 'MP4', filepath: `sala-juntas/${reunionId}/${grabacionId}.mp4`, gcp: { credentials: credenciales, bucket } }],
  };
}

async function twirp(fetchFn, env, metodo, cuerpo, sala, ahora) {
  const url = `${String(env.LIVEKIT_URL).trim().replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:').replace(/\/+$/, '')}/twirp/livekit.Egress/${metodo}`;
  const r = await fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEgress({ apiKey: env.LIVEKIT_API_KEY, apiSecret: env.LIVEKIT_API_SECRET, sala, ahora })}` }, body: JSON.stringify(cuerpo) });
  let j = {}; try { j = await r.json(); } catch (_) {}
  if (!r.ok) { const e = new Error(`LiveKit Egress respondió ${r.status}${j && j.msg ? `: ${String(j.msg).slice(0, 160)}` : ''}`); e.status = 502; throw e; }
  return j;
}

// Estado de LiveKit → estado nuestro.
const ns = (v) => { const n = Number(v || 0); return n > 1e15 ? Math.round(n / 1e6) : n; }; // ns → ms
function estadoDeEgress(info = {}) {
  const s = String(info.status || '');
  const f = (info.fileResults && info.fileResults[0]) || info.file || {};
  const base = { egressId: info.egressId || '', inicioMs: ns(info.startedAt) || 0, finMs: ns(info.endedAt) || 0 };
  if (s === 'EGRESS_COMPLETE') return { ...base, estado: 'lista', duracionSeg: Math.round(Number(f.duration || 0) / 1e9) || 0 /* LiveKit: nanosegundos */, bytes: Number(f.size || 0), storageKey: String(f.filename || '').replace(/^\/+/, '') };
  if (s === 'EGRESS_FAILED' || s === 'EGRESS_ABORTED' || s === 'EGRESS_LIMIT_REACHED') return { ...base, estado: s === 'EGRESS_LIMIT_REACHED' ? 'lista_parcial' : 'fallida', error: String(info.error || s).slice(0, 200), storageKey: String(f.filename || '').replace(/^\/+/, '') };
  if (s === 'EGRESS_ENDING') return { ...base, estado: 'procesando' };
  if (s === 'EGRESS_ACTIVE') return { ...base, estado: 'grabando' };
  return { ...base, estado: 'iniciando' };
}

// Lo que ve una participante (sin bucket, sin credenciales, sin rutas internas).
function publicaGrabacion(id, g = {}) {
  return { id, reunionId: g.reunionId, estado: g.estado, inicio: g.inicio || '', fin: g.fin || '', duracionSeg: g.duracionSeg || 0, bytes: g.bytes || 0,
    iniciadaPor: g.iniciadaPor || '', participantes: g.participantes || [], presentes: (g.consentimiento && g.consentimiento.presentes) || [], error: g.estado === 'fallida' ? (g.error || 'La grabación falló.') : '',
    reproducible: (g.estado === 'lista' || g.estado === 'lista_parcial') && !!g.storageKey };
}

module.exports = { COLECCION, MAX_MIN, FIRMA_MIN, configGrabacion, tokenEgress, nuevoId, idValido, cuerpoInicio, twirp, estadoDeEgress, publicaGrabacion };
