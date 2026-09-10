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
      try { if (context) await context.close(); }
      finally {
        try { if (browser) await browser.close(); }
        finally { if (!browser || !browser.isConnected()) leases.delete(lease); }
      }
    };
    try {
      browser = await launch(binding, { keep_alive: 60000 }); lease.browser = browser;
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
      throw new TVError(503, 'Cloudflare no pudo abrir el navegador. Revise Browser Run, su cuota y reintente.', 'TV_CLOUD_UNAVAILABLE');
    }
  };
}
