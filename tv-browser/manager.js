'use strict';
const crypto = require('node:crypto');
const { get, code } = require('../activar-tv-platforms');

class TVError extends Error {
  constructor(status, message, code = 'TV_ERROR') { super(message); this.status = status; this.code = code; }
}
const fail = (status, message, code) => { throw new TVError(status, message, code); };
const normalizeEmail = value => String(value || '').trim().toLowerCase();

// No guarda claves, cookies, imágenes ni códigos en disco o en el CRM.
// Cada sesión vive en un contexto nuevo y sólo pertenece a un UID firmado.
class SessionManager {
  constructor({ createBrowser, enabled = [], now = Date.now, idleMs = 15 * 60000, lifetimeMs = 45 * 60000, maxSessions = 3 }) {
    this.createBrowser = createBrowser;
    this.enabled = enabled.filter(id => get(id));
    this.now = now; this.idleMs = idleMs; this.lifetimeMs = lifetimeMs; this.maxSessions = maxSessions;
    this.sessions = new Map(); this.starts = new Map();
  }
  available() { return { ok: true, available: this.enabled.length > 0, platforms: this.enabled, version: 2, build: 'tv-20260910-2' }; }
  view(s) {
    return { ok: true, sessionId: s.id, platform: s.platform.id, email: s.email, state: s.state,
      verifiedBy: s.verifiedBy || '', message: s.operationError || s.message || '', busy: !!s.busy && !s.refreshing,
      errorCode: s.errorCode || '', recoverable: !!s.browser && !!s.errorCode,
      frame: s.frame || null, expiresAt: Math.min(s.createdAt + this.lifetimeMs, s.lastActionAt + this.idleMs) };
  }
  find(owner, id) {
    const s = this.sessions.get(id);
    if (!s || s.owner !== owner) fail(404, 'La sesión del TV terminó. Vuelva a iniciar sesión.', 'TV_SESSION_GONE');
    if (this.now() - s.createdAt >= this.lifetimeMs || this.now() - s.lastActionAt >= this.idleMs) {
      void this.close(s); fail(410, 'La sesión del TV venció. Vuelva a iniciar sesión.', 'TV_SESSION_GONE');
    }
    return s;
  }
  async close(s) {
    if (!s || s.closed) return;
    s.closed = true; s.frame = null; this.sessions.delete(s.id);
    if (s.browser) await s.browser.close().catch(() => {});
  }
  async cleanup() {
    await Promise.all([...this.sessions.values()].filter(s => this.now() - s.createdAt >= this.lifetimeMs || this.now() - s.lastActionAt >= this.idleMs).map(s => this.close(s)));
    for (const [owner, times] of this.starts) {
      const recent = times.filter(t => this.now() - t < 60000);
      if (recent.length) this.starts.set(owner, recent); else this.starts.delete(owner);
    }
  }
  async shutdown() { await Promise.all([...this.sessions.values()].map(s => this.close(s))); }
  async refresh(s) {
    if (!s.browser || s.closed) return;
    const evidence = await s.browser.inspect(s.email);
    // A successful inspection supersedes a previous transient navigation error.
    // Reading a page outside the provider is never evidence of account access.
    s.operationError = ''; s.errorCode = '';
    if (evidence.external) {
      s.authDetected = false; s.confirmed = false; s.verifiedBy = ''; s.stage = 'login'; s.state = 'login';
      s.message = 'La plataforma abrió un acceso externo. Revise la página mostrada. El paso de TV estará disponible al regresar a la plataforma y confirmar la cuenta.';
    } else if (evidence.loginVisible && s.stage === 'activation') {
      s.stage = 'login'; s.confirmed = false; s.verifiedBy = ''; s.state = 'login';
      s.message = 'La plataforma pidió iniciar sesión otra vez. Complete el acceso antes del código del TV.';
    } else if (s.stage === 'activation' && s.activationAttempted && evidence.activationSuccess) {
      s.state = 'activated'; s.operationError = ''; s.message = 'La plataforma confirmó la activación del TV.';
    } else if (evidence.error) {
      s.state = s.stage === 'activation' ? 'activation' : 'login';
      if (s.stage === 'login') { s.confirmed = false; s.verifiedBy = ''; }
      s.message = evidence.error;
    } else if (s.stage === 'login') {
      s.authDetected = !!evidence.authenticated;
      if (evidence.authenticated && s.confirmed && s.verifiedBy === 'operator') {
        s.state = 'ready'; s.operationError = '';
      } else if (evidence.authenticated && evidence.emailMatches) {
        s.confirmed = true; s.verifiedBy = 'platform'; s.state = 'ready'; s.operationError = '';
        s.message = 'Sesión iniciada. Ya puede continuar con el código del TV.';
      } else if (evidence.authenticated) {
        // Algunas plataformas sólo muestran el selector de perfiles. No inventar
        // que su correo fue verificado: el operador debe revisar la página.
        s.confirmed = false; s.verifiedBy = ''; s.state = 'verify_account';
        s.message = 'Revise la cuenta en la página y confirme que corresponde al correo indicado.';
      } else {
        s.confirmed = false; s.verifiedBy = ''; s.state = 'login';
        s.message = evidence.challenge ? 'Complete la verificación solicitada en la página de la plataforma.' :
          'Complete el inicio de sesión en la página de la plataforma.';
      }
    } else if (s.state !== 'activated') {
      s.state = 'activation';
      s.message = evidence.challenge ? 'Complete la verificación que solicita la plataforma.' :
        'Ingrese el código que aparece en el TV. Si la página pide otro paso, complételo abajo.';
    }
    s.frame = await s.browser.frame();
  }
  launch(s, operation, { background = false } = {}) {
    if (s.busy) fail(409, 'Espere a que termine la operación actual.', 'TV_BUSY');
    s.busy = true; s.refreshing = background;
    s.task = (async () => {
      try { await operation(); if (!s.closed) await this.refresh(s); }
      catch (err) {
        if (!s.closed) {
          if (!background) s.state = s.browser ? (s.stage === 'activation' ? 'activation' : 'login') : 'error';
          s.message = err instanceof TVError ? err.message : 'La página no respondió. Puede reintentar o iniciar una sesión nueva.';
          s.operationError = s.message;
          s.errorCode = err instanceof TVError ? err.code : 'TV_PAGE_TIMEOUT';
          if (s.browser) s.frame = await s.browser.frame().catch(() => s.frame);
        }
      } finally { s.busy = false; s.refreshing = false; }
    })();
    return this.view(s);
  }
  async start(owner, input) {
    const p = get(input.platform);
    if (!p || !this.enabled.includes(p.id)) fail(503, 'Esta plataforma todavía no está habilitada en Activar TV.', 'TV_PLATFORM_DISABLED');
    const email = normalizeEmail(input.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fail(400, 'Escriba un correo válido. Puede usar uno que no esté guardado.');
    if (typeof input.password !== 'string' || input.password.length < 1 || input.password.length > 512) fail(400, 'Escriba la clave de la plataforma.');
    if (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId)) fail(400, 'Solicitud de inicio no válida.');
    await this.cleanup();
    const old = [...this.sessions.values()].find(s => s.owner === owner);
    if (old && old.requestId === input.requestId) {
      if (old.email !== email || old.platform.id !== p.id) fail(409, 'La cuenta cambió. Abra una solicitud nueva.');
      return this.view(old);
    }
    const attempts = (this.starts.get(owner) || []).filter(t => this.now() - t < 60000);
    if (attempts.length >= 5) fail(429, 'Espere un minuto antes de abrir otra sesión.');
    const activeOthers = [...this.sessions.values()].filter(s => s.owner !== owner &&
      !(s.state === 'activated' && !s.browser)).length;
    if (activeOthers >= this.maxSessions) fail(429, 'Activar TV está ocupado. Reintente al terminar otra sesión.');
    // Reserve synchronously before closing the old browser, so simultaneous
    // starts cannot allocate two sessions to one owner or exceed capacity.
    const s = { id: crypto.randomUUID(), requestId: input.requestId, owner, platform: p, email,
      state: 'connecting', stage: 'login', confirmed: false, authDetected: false,
      createdAt: this.now(), lastActionAt: this.now(), events: new Set(), frame: null,
      message: 'Abriendo una sesión nueva para esta cuenta…' };
    if (old) { old.closed = true; old.frame = null; this.sessions.delete(old.id); }
    this.sessions.set(s.id, s); attempts.push(this.now()); this.starts.set(owner, attempts);
    let password = input.password;
    return this.launch(s, async () => {
      try {
        if (old?.browser) await old.browser.close().catch(() => {});
        const browser = await this.createBrowser(p);
        if (s.closed) { await browser.close(); return; }
        s.browser = browser;
        await browser.login(email, password);
      } finally { password = ''; }
    });
  }
  async dispatch(owner, input) {
    if (!owner || typeof owner !== 'string' || owner.length > 200) fail(401, 'Sesión requerida.');
    if (input.action === 'availability') return this.available();
    if (input.action === 'start') return this.start(owner, input);
    const s = this.find(owner, input.sessionId);
    if (input.action === 'close') { await this.close(s); return { ok: true, closed: true }; }
    if (input.action === 'poll') {
      // Polls do not prolong the session and never run alongside input commands.
      if (!s.busy && s.browser && s.state !== 'activated') {
        s.busy = true;
        try { await this.refresh(s); }
        catch (_) { s.message = 'La página está cargando. Reintente en unos momentos.'; }
        finally { s.busy = false; }
      }
      return this.view(s);
    }
    // Background screenshots must not disable every button on each poll.
    // Serialize a click behind the pending read without submitting it twice.
    if (s.busy && s.refreshing) {
      await s.task;
      return this.dispatch(owner, input);
    }
    if (s.busy) fail(409, 'Espere a que termine la operación actual.', 'TV_BUSY');
    s.lastActionAt = this.now();
    s.operationError = '';
    s.errorCode = '';
    if (input.action === 'reload') {
      if (!s.browser || s.state === 'activated') fail(409, 'Inicie una sesión nueva para abrir la página.');
      s.activationAttempted = false;
      return this.launch(s, () => s.browser.reload());
    }
    if (input.action === 'interact') {
      const event = input.event;
      if (!event || !/^[a-zA-Z0-9-]{12,80}$/.test(event.id || '')) fail(400, 'Entrada no válida.');
      if (s.events.has(event.id)) return this.view(s);
      if (!s.browser || s.state === 'activated') fail(409, 'No hay una página disponible para esa acción.');
      s.events.add(event.id); if (s.events.size > 256) s.events.delete(s.events.values().next().value);
      return this.launch(s, () => s.browser.interact(event));
    }
    if (input.action === 'confirm_account') {
      if (s.state !== 'verify_account' || !s.authDetected) fail(409, 'Complete el inicio de sesión antes de confirmar la cuenta.');
      if (normalizeEmail(input.email) !== s.email) fail(409, 'El correo cambió. Inicie una sesión nueva con la cuenta correcta.');
      s.confirmed = true; s.verifiedBy = 'operator'; s.state = 'ready';
      s.message = 'Cuenta confirmada por usted. Continúe con el código del TV.';
      return this.view(s);
    }
    if (input.action === 'activation_page') {
      if (!s.confirmed || s.state !== 'ready') fail(409, 'Primero inicie sesión y confirme la cuenta.');
      s.stage = 'activation'; s.state = 'activation'; s.activationAttempted = false;
      return this.launch(s, () => s.browser.openActivation());
    }
    if (input.action === 'activate') {
      if (!s.confirmed || s.stage !== 'activation' || s.state !== 'activation') fail(409, 'Primero inicie sesión y abra el paso de código del TV.');
      const value = code(input.code, s.platform);
      if (!value) fail(400, 'Revise el código y cópielo tal como aparece en el TV.');
      s.activationAttempted = true; s.state = 'submitting';
      return this.launch(s, () => s.browser.activate(value));
    }
    fail(400, 'Acción no válida.');
  }
}
module.exports = { SessionManager, TVError };
