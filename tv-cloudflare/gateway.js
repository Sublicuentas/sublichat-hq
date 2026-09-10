import { createHash, timingSafeEqual } from 'node:crypto';
import shared from '../tv-browser/manager.js';
const { TVError } = shared;
const actions = new Set(['availability', 'start', 'poll', 'interact', 'confirm_account', 'activation_page', 'activate', 'close']);
const fields = ['action', 'owner', 'sessionId', 'requestId', 'platform', 'email', 'password', 'code', 'event'];

export function authorized(header, secret) {
  if (typeof secret !== 'string' || secret.length < 32 || secret.length > 512 ||
      typeof header !== 'string' || header.length > 600) return false;
  const digest = s => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(header), digest('Bearer ' + secret));
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff'
  } });
}

async function readInput(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new TVError(415, 'Use JSON.');
  if (!request.body) throw new TVError(400, 'Solicitud vacía.');
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 24000) { await reader.cancel(); throw new TVError(413, 'Solicitud demasiado grande.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let at = 0;
  for (const part of chunks) { bytes.set(part, at); at += part.byteLength; }
  let input;
  try { input = JSON.parse(new TextDecoder().decode(bytes)); }
  catch (_) { throw new TVError(400, 'Solicitud no válida.'); }
  if (!input || Array.isArray(input) || !actions.has(input.action)) throw new TVError(400, 'Acción no válida.');
  if (typeof input.owner !== 'string' || !input.owner || input.owner.length > 200) throw new TVError(401, 'Sesión requerida.');
  const clean = {};
  for (const field of fields) if (Object.hasOwn(input, field)) clean[field] = input[field];
  return clean;
}

export async function serve(request, env, forward) {
  try {
    const url = new URL(request.url);
    if (url.pathname === '/healthz' && request.method === 'GET') return json({ ok: true, service: 'sublichat-activar-tv', version: 'cloudflare-1' });
    if (url.pathname !== '/v1/action') return json({ ok: false, error: 'No encontrado.' }, 404);
    if (request.method !== 'POST') return json({ ok: false, error: 'Use POST.' }, 405);
    if (!authorized(request.headers.get('authorization'), env.TV_BROWSER_SECRET)) return json({ ok: false, error: 'Acceso no autorizado.' }, 401);
    const result = await forward(await readInput(request));
    return result instanceof Response ? result : json(result);
  } catch (error) {
    if (error instanceof TVError) return json({ ok: false, code: error.code, error: error.message }, error.status);
    // Never return or log raw provider errors, request bodies or credentials.
    return json({ ok: false, code: 'TV_CLOUD_UNAVAILABLE', error: 'No se pudo contactar con Activar TV. Reintente en unos momentos.' }, 503);
  }
}
