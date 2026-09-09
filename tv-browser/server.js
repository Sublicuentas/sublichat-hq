'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const { SessionManager, TVError } = require('./manager');
const { browserFactory } = require('./browser');

function authorized(header, secret) {
  const value = Buffer.from(String(header || ''));
  const expected = Buffer.from('Bearer ' + secret);
  return secret.length >= 32 && value.length === expected.length && crypto.timingSafeEqual(value, expected);
}
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}
function serverFor(manager, secret) {
  return http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') return send(res, 200, { ok: true });
    if (req.method !== 'POST' || req.url !== '/v1/action') return send(res, 404, { ok: false });
    if (!authorized(req.headers.authorization, secret)) return send(res, 401, { ok: false, error: 'Acceso no autorizado.' });
    try {
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new TVError(415, 'Use JSON.');
      let size = 0, chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 24000) throw new TVError(413, 'Solicitud demasiado grande.');
        chunks.push(chunk);
      }
      let payload;
      try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) { throw new TVError(400, 'JSON no válido.'); }
      chunks = [];
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TVError(400, 'Solicitud no válida.');
      const result = await manager.dispatch(payload.owner, payload);
      delete payload.password; delete payload.code; delete payload.event;
      return send(res, 200, result);
    } catch (err) {
      // Nunca imprimir el cuerpo, las URLs con tokens, credenciales ni imágenes.
      return send(res, err instanceof TVError ? err.status : 500, { ok: false, code: err.code || 'TV_ERROR',
        error: err instanceof TVError ? err.message : 'No se pudo completar la operación.' });
    }
  });
}
async function main() {
  const secret = process.env.TV_BROWSER_SECRET || '';
  if (secret.length < 32) throw new Error('Configure TV_BROWSER_SECRET con al menos 32 caracteres aleatorios.');
  const { chromium } = require('playwright');
  const factory = browserFactory(chromium);
  const enabled = (process.env.TV_ENABLED_PLATFORMS || '').split(',').map(x => x.trim()).filter(Boolean);
  const manager = new SessionManager({ createBrowser: factory, enabled, maxSessions: Math.max(1, Math.min(12, Number(process.env.TV_MAX_SESSIONS) || 3)) });
  const server = serverFor(manager, secret);
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  const timer = setInterval(() => void manager.cleanup(), 30000); timer.unref();
  const shutdown = () => {
    clearInterval(timer); server.close();
    void manager.shutdown().then(() => factory.shutdown()).finally(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
  server.listen(Number(process.env.PORT) || 8080, '0.0.0.0', () => console.log('Servicio Activar TV iniciado.'));
}
if (require.main === module) main().catch(err => { console.error(err.message); process.exit(1); });
module.exports = { serverFor, authorized };
