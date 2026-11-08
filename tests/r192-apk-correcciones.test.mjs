// R192 · Correcciones APK: mensaje del Baúl armado en backend, cobros del mes por plataforma, accesos directos de la Sala web.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { periodoHN, resumenMes } from '../api/_finanzas-mes.js';
const require = createRequire(import.meta.url);
const B = require('../api/_baul-apks.js');
const baul = { apps: B.SEMILLA.apps, enlaces: B.SEMILLA.enlaces };
const en = (plat, disp) => B.vistaPlataforma(baul, plat).dispositivos.find((d) => d.id === disp)?.enlaces || [];

test('Baúl: Oleada en Android TV lleva código Downloader y pasos; mismo registro que el bot', () => {
  const m = en('oleada', 'android_tv')[0].mensaje;
  assert.match(m, /^SUBLICUENTAS \| Instalación de Oleada TV/);
  assert.match(m, /Código Downloader: 9387291/);
  assert.match(m, /3\. En Downloader escriba el código 9387291/);
  const bot = fs.readFileSync('../bot-gh/lib_baul_apks.js', 'utf8').split('\n').slice(1).join('\n');
  assert.equal(bot, fs.readFileSync('api/_baul-apks.js', 'utf8').split('\n').slice(1).join('\n'), 'copia fiel');
});

test('Baúl: iPhone sin APK ni Downloader; SmartOne con nota L85; Smart TV sin URL inventada', () => {
  const ip = en('liontv', 'iphone')[0].mensaje;
  assert.match(ip, /App Store/); assert.doesNotMatch(ip, /Downloader|\.apk/i);
  const tv = en('liontv', 'smart_tv');
  const so = tv.find((e) => e.id === 'smartone-tv').mensaje;
  assert.match(so, /Importante: L85 para activar 12 meses POR DISPOSITIVO/);
  for (const e of tv) assert.doesNotMatch(e.mensaje, /Enlace:|https?:/, 'tienda del TV sin URL');
});

test('Finanzas: cobros del mes por plataforma suman exactamente lo cobrado; pago combinado aparte', () => {
  const movs = [
    { id: 'a', tipo: 'ingreso', monto: 150, fechaPago: '2026-11-03', operacionId: 'a', plataforma: 'Netflix' },
    { id: 'b', tipo: 'ingreso', monto: 70, fechaPago: '2026-11-04', operacionId: 'b', plataforma: 'Disney+ + Prime' },
    { id: 'c', tipo: 'ingreso', monto: 999, fechaPago: '2026-10-31', operacionId: 'c', plataforma: 'Netflix' },
  ];
  const r = resumenMes(movs, periodoHN(new Date(), '2026-11'));
  assert.equal(r.ingresos, 220);
  assert.equal(r.cobrosPorPlataforma.reduce((s, p) => s + p.centavos, 0), r.ingresosCentavos);
  assert.ok(r.cobrosPorPlataforma.some((p) => p.pendiente && p.centavos === 7000), 'R193: el pago combinado sin desglose queda pendiente de clasificar');
});

test('Sala web: ?sala=personaje y ?sala=escenarios abren esas vistas; ids de reunión siguen validados', () => {
  const s = fs.readFileSync('sala-juntas.js', 'utf8');
  assert.match(s, /\['personaje', 'escenarios'\]\.includes\(id\)/);
  assert.match(s, /if \(!vistaDirecta && !\/\^\[A-Za-z0-9_-\]\{6,60\}\$\/\.test\(id\)\) return;/);
});
