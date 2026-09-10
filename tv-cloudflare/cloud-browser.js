import platformBrowser from '../tv-browser/platform-browser.js';
import network from '../tv-browser/network.js';
import manager from '../tv-browser/manager.js';
const { PlatformBrowser } = platformBrowser;
const { requestGuard } = network;
const { TVError } = manager;

// Only hostnames are sent to the fixed DNS service; no credentials or page URLs.
export async function resolvePublicDns(host, fetcher = fetch) {
  if (typeof host !== 'string' || host.length > 253 || !/^[a-z0-9.-]+$/i.test(host)) throw new Error('DNS_HOST');
  const answers = await Promise.all(['A', 'AAAA'].map(async type => {
    const url = new URL('https://cloudflare-dns.com/dns-query');
    url.searchParams.set('name', host); url.searchParams.set('type', type);
    const response = await fetcher(url.href, {
      headers: { Accept: 'application/dns-json' }, redirect: 'error', signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error('DNS_FAILED');
    const result = await response.json();
    if (![0, 3].includes(result.Status)) throw new Error('DNS_FAILED');
    return (result.Answer || []).filter(a => a.type === 1 || a.type === 28).map(a => ({ address: a.data }));
  }));
  return answers.flat();
}

// launch() owns a Cloudflare session: closing this browser terminates it.
// connect() is intentionally not used (its close() only disconnects).
export function cloudBrowserFactory({ launch, binding, maxSessions = 3, resolve = resolvePublicDns }) {
  const leases = new Set();
  return async platform => {
    for (const lease of leases) if (lease.browser && !lease.browser.isConnected()) leases.delete(lease);
    if (leases.size >= maxSessions) throw new TVError(429, 'Activar TV está ocupado. Espere a que cierre otra sesión.');
    const lease = { browser: null }; leases.add(lease);
    let browser, context;
    const closeBrowser = async () => {
      try { if (context) { await context.clearCookies().catch(() => {}); await context.close(); } }
      finally {
        try { if (browser) await browser.close(); }
        finally { if (!browser || !browser.isConnected()) leases.delete(lease); }
      }
    };
    try {
      browser = await launch(binding, { keep_alive: 180000 }); lease.browser = browser;
      browser.on('disconnected', () => leases.delete(lease));
      context = await browser.newContext({
        viewport: { width: 1000, height: 760 }, locale: 'es-HN', timezoneId: 'America/Tegucigalpa',
        acceptDownloads: false, serviceWorkers: 'block', permissions: []
      });
      await context.route('**/*', requestGuard(platform, resolve));
      const page = await context.newPage(); page.setDefaultTimeout(4000);
      context.on('page', popup => { if (popup !== page) void popup.close().catch(() => {}); });
      page.on('dialog', dialog => void dialog.dismiss().catch(() => {}));
      const adapter = new PlatformBrowser(platform, context, page);
      let closing;
      adapter.alive = () => browser.isConnected();
      adapter.close = () => {
        if (!closing) { adapter.closed = true; closing = closeBrowser(); }
        return closing;
      };
      return adapter;
    } catch (error) {
      await closeBrowser().catch(() => {});
      if (error instanceof TVError) throw error;
      const detail = String(error?.message || error || '').toLowerCase();
      if (detail.includes('browser time limit exceeded') || detail.includes('time limit exceeded for today')) {
        throw new TVError(429, 'Cloudflare confirmó que se alcanzó el límite diario de Browser Run del plan Free. La cuota vuelve al iniciar el siguiente día UTC.', 'TV_CLOUD_DAILY_LIMIT');
      }
      if (detail.includes('rate limit exceeded') || detail.includes('too many requests') || Number(error?.status) === 429) {
        // A generic HTTP 429 does NOT prove that the daily browser-time quota was
        // exhausted. Cloudflare also uses 429 for creation/rate limits.
        throw new TVError(429, 'Cloudflare rechazó temporalmente una nueva sesión de navegador (429 Rate limit exceeded). Esto no confirma que su cuota diaria esté agotada. Espere unos segundos y reintente.', 'TV_CLOUD_RATE_LIMIT');
      }
      throw new TVError(503, 'Cloudflare no pudo abrir el navegador remoto. Reintente; si continúa, revise Browser Run.', 'TV_CLOUD_UNAVAILABLE');
    }
  };
}
