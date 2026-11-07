// R184 · Medición de carga de Inicio y Control Maestro (antes/después) con datos FICTICIOS de volumen real y latencia
// de red SIMULADA (no es producción). Uso: node tests/visual/medir-carga.mjs <etiqueta> [corridas=5] [usuario=naara]
import fs from 'node:fs';
import { abrir } from './arnes.mjs';
const etiqueta = process.argv[2] || 'medicion'; const DIRECTO = process.argv[5] === 'directo'; const N = Number(process.argv[3] || 5); const usuario = process.argv[4] || 'naara';
const DATOS = { clientes: 1500, inventario: 600, finanzas: 4000, latFs: 600, latApi: 450, msPorDoc: 0.3 };
const filas = [];
for (let i = 0; i < N; i++) {
  const h = await abrir({ usuario, ui: 'v2', ancho: 1440, alto: 900, datos: DATOS });
  const P = h.page;
  if (DIRECTO) { // abrir Control Maestro apenas entra (antes de que termine la carga)
    await P.waitForFunction(() => window.SublichatRBAC && document.body.classList.contains('ready'), null, { timeout: 60000 });
    const t0 = await P.evaluate(() => performance.now()); await P.evaluate(() => window.SublichatRBAC.ir('control-cuentas'));
    await P.waitForFunction(() => document.querySelector('#screen-control-cuentas .cm-shell, #screen-control-cuentas .cm-empty'), null, { timeout: 120000 });
    const fin = await P.evaluate(() => Math.round(performance.now())); filas.push({ inicio: fin, lcp: 0, control: Math.round(fin - t0), kpi: '', fs: '', api: 0 }); await h.cerrar(); continue;
  }
  await P.evaluate(() => { window.__lcp = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (_) {} });
  await P.waitForFunction(() => document.querySelector('#v2Inicio .v2-kpis .v2k:not(.v2-esq)'), null, { timeout: 120000 });
  const inicio = await P.evaluate(() => Math.round(performance.now()));
  const kpi = await P.evaluate(() => [...document.querySelectorAll('#v2Inicio .v2-kpis b, #v2Inicio .v2-kpis strong, #v2Inicio .v2-kpi-v')].map((e) => e.textContent.trim()).slice(0, 4).join(' | '));
  await P.waitForTimeout(300); const lcp = await P.evaluate(() => Math.round(window.__lcp || 0));
  let control = null;
  if (['naara', 'sublicuentas', 'geisell'].includes(usuario)) {
    const t0 = await P.evaluate(() => performance.now());
    await P.evaluate(() => window.SublichatRBAC.ir('control-cuentas'));
    await P.waitForFunction(() => document.querySelector('#screen-control-cuentas .cm-shell, #screen-control-cuentas .cm-empty'), null, { timeout: 120000 });
    control = Math.round((await P.evaluate(() => performance.now())) - t0);
    const desdeCarga = Math.round(await P.evaluate(() => performance.now()));
    filas.push({ inicio, lcp, control, controlDesdeCarga: desdeCarga, kpi, fs: await P.evaluate(() => (window.__fsLecturas || []).map((x) => x[0] + ':' + x[1]).join(',')), api: globalThis.__redArnes?.api || 0 });
  } else filas.push({ inicio, lcp, kpi, fs: await P.evaluate(() => (window.__fsLecturas || []).map((x) => x[0] + ':' + x[1]).join(',')), api: globalThis.__redArnes?.api || 0 });
  await h.cerrar();
}
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const res = { etiqueta, usuario, datos: DATOS, corridas: N, filas,
  inicio: { p50: pct(filas.map((f) => f.inicio), 0.5), p75: pct(filas.map((f) => f.inicio), 0.75) },
  lcp: { p50: pct(filas.map((f) => f.lcp), 0.5), p75: pct(filas.map((f) => f.lcp), 0.75) },
  control: filas[0].control != null ? { p50: pct(filas.map((f) => f.control), 0.5), p75: pct(filas.map((f) => f.control), 0.75) } : null };
fs.mkdirSync('/tmp/claude-0/med', { recursive: true }); fs.writeFileSync(`/tmp/claude-0/med/${etiqueta}-${usuario}.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ etiqueta, usuario, inicio: res.inicio, lcp: res.lcp, control: res.control, kpi: filas[0].kpi, fs: filas[0].fs, api: filas[0].api }));
