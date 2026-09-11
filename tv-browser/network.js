'use strict';
const net = require('node:net');
const { allowsNavigation } = require('../activar-tv-platforms');

function publicAddress(address) {
  const a = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (net.isIPv4(a)) {
    const [x, y] = a.split('.').map(Number);
    return !(x === 0 || x === 10 || x === 127 || x >= 224 || (x === 169 && y === 254) ||
      (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168) || (x === 100 && y >= 64 && y <= 127) ||
      (x === 198 && (y === 18 || y === 19)));
  }
  if (net.isIPv6(a)) return !(/^(?:::|fc|fd|fe[89ab]|ff)/.test(a));
  return false;
}

// Inject the resolver: the local service uses the OS; Cloudflare uses public DoH.
// A failed lookup blocks the request. Never turn a lookup failure into access.
function requestGuard(platform, resolve, now = Date.now) {
  const addresses = new Map();
  return async route => {
    try {
      const request = route.request(); const url = new URL(request.url());
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
          (url.port && !['80', '443'].includes(url.port))) return route.abort();
      const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
      if (/^(?:localhost|metadata\.google\.internal)$|\.(?:localhost|local|internal)$/.test(host)) return route.abort();

      // Always reject literal private IPs, including subresources.
      if (net.isIP(host) && !publicAddress(host)) return route.abort();

      // DNS validation is needed for navigations, not every image/font/script.
      // The previous implementation made two Worker fetches (A + AAAA) for each
      // new asset hostname. Large streaming login pages can use many CDN hosts,
      // which needlessly burns the Worker's external-subrequest budget and slows
      // page loading. Provider subresources now load normally; top-level/iframe
      // navigations still must resolve exclusively to public addresses.
      const isNavigation = typeof request.isNavigationRequest === 'function' && request.isNavigationRequest();
      if (!isNavigation || net.isIP(host)) return route.continue();

      let entry = addresses.get(host);
      if (!entry || now() - entry.at >= 60000) {
        if (addresses.size >= 128) addresses.delete(addresses.keys().next().value);
        entry = { at: now(), pending: (async () => {
          const values = await resolve(host);
          return values.length > 0 && values.every(x => publicAddress(x.address));
        })().catch(() => false) };
        addresses.set(host, entry);
      }
      if (!(await entry.pending)) return route.abort();
      return route.continue();
    } catch (_) { return route.abort(); }
  };
}

module.exports = { publicAddress, requestGuard };
