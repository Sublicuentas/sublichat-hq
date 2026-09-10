import shared from '../tv-browser/manager.js';
import platforms from '../activar-tv-platforms.js';
const { SessionManager, TVError } = shared;

export function readConfig(env) {
  const enabled = [...new Set(String(env.TV_ENABLED_PLATFORMS || '').split(',').map(x => x.trim()).filter(Boolean))];
  const number = (name, fallback, min, max) => {
    const n = Number(env[name] ?? fallback);
    if (!Number.isInteger(n) || n < min || n > max) throw new TVError(503, 'Revise la configuración de Activar TV en Cloudflare.');
    return n;
  };
  if (enabled.some(id => !platforms.get(id))) throw new TVError(503, 'Revise los identificadores de plataformas de Activar TV.');
  const idleMs = number('TV_IDLE_MINUTES', 3, 1, 10) * 60000;
  const lifetimeMs = number('TV_LIFETIME_MINUTES', 30, 5, 60) * 60000;
  if (idleMs > lifetimeMs) throw new TVError(503, 'El tiempo de inactividad debe ser menor que el máximo de sesión.');
  return { enabled, idleMs, lifetimeMs, maxSessions: number('TV_MAX_SESSIONS', 3, 1, 3) };
}

export class CloudSessionManager extends SessionManager {
  async refresh(s) {
    try { await super.refresh(s); }
    catch (error) { if (s.state !== 'activated') throw error; }
    finally {
      if (s.state === 'activated' && s.browser) {
        const browser = s.browser; s.browser = null;
        // Keep the success receipt in memory for a retried poll, without billing
        // another browser minute while the operator reads the confirmation.
        await browser.close().catch(() => {});
      }
    }
  }
  async dispatch(owner, input) {
    if (input.action === 'poll') {
      const s = this.find(owner, input.sessionId);
      if (s.browser?.alive && !s.browser.alive()) {
        await this.close(s);
        throw new TVError(410, 'La sesión remota terminó. Vuelva a iniciar sesión.', 'TV_SESSION_GONE');
      }
      // Browser I/O continues in the Durable Object. The HTTP request returns
      // promptly, including while a platform asks for additional verification.
      if (!s.busy && s.browser && s.state !== 'activated') return this.launch(s, async () => {}, { background: true });
      return this.view(s);
    }
    return super.dispatch(owner, input);
  }
}

// One coordinator per installation enforces the shared three-browser limit.
// Storage contains only an alarm timestamp. Login data, cookies and screenshots
// live in memory; a process reset requires a fresh login in a new browser.
export class CloudController {
  constructor({ storage, env, createBrowser, now = Date.now }) {
    this.storage = storage; this.now = now; this.tail = Promise.resolve();
    this.manager = new CloudSessionManager({ ...readConfig(env), createBrowser, now });
  }
  serial(operation) {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => {});
    return result;
  }
  async schedule() {
    if (!this.manager.sessions.size) { await this.storage.deleteAlarm(); return; }
    const next = this.now() + 30000;
    const current = await this.storage.getAlarm();
    if (current === null || current > next || current <= this.now()) await this.storage.setAlarm(next);
  }
  action(input) {
    return this.serial(async () => {
      // Arm cleanup before allocating any browser, including an asynchronous
      // launch still in progress when a user closes the tab.
      if (input.action === 'start') await this.storage.setAlarm(this.now() + 30000);
      try { return await this.manager.dispatch(input.owner, input); }
      finally { if (input.action !== 'availability') await this.schedule(); }
    });
  }
  alarm() {
    return this.serial(async () => {
      try { await this.manager.cleanup(); }
      finally { await this.schedule(); }
    });
  }
}
