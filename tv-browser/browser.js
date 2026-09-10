'use strict';
const dns = require('node:dns').promises;
const { PlatformBrowser, interpretEvidence } = require('./platform-browser');
const { publicAddress, requestGuard } = require('./network');

function browserFactory(chromium) {
  let browserPromise;
  const launch = () => {
    if (!browserPromise) browserPromise = chromium.launch({ headless: true, chromiumSandbox: true }).then(browser => {
      browser.on('disconnected', () => { browserPromise = null; }); return browser;
    }).catch(err => { browserPromise = null; throw err; });
    return browserPromise;
  };
  const factory = async platform => {
    const browser = await launch();
    const context = await browser.newContext({ viewport: { width: 1000, height: 760 }, locale: 'es-HN', timezoneId: 'America/Tegucigalpa',
      acceptDownloads: false, serviceWorkers: 'block', permissions: [] });
    try {
      await context.route('**/*', requestGuard(platform, host => dns.lookup(host, { all: true })));
      const page = await context.newPage(); page.setDefaultTimeout(4000);
      context.on('page', popup => { if (popup !== page) void popup.close(); });
      page.on('dialog', dialog => void dialog.dismiss());
      return new PlatformBrowser(platform, context, page);
    } catch (err) { await context.close().catch(() => {}); throw err; }
  };
  factory.shutdown = async () => { if (browserPromise) await (await browserPromise).close(); };
  return factory;
}
module.exports = { browserFactory, interpretEvidence, publicAddress };
