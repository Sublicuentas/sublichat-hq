// R159 · Netflix Hogar: "¿Solicitaste actualizar tu Hogar con Netflix?" es un ENLACE de aprobación, no un código.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const imap = require('../api/_codigos-imap.js');

const LINK = 'https://www.netflix.com/account/update-primary-location?nftoken=BgjStOvcAxKkAa9QFAKE&amp;g=5447AB&amp;lnktrk=EVO';
const html = `<html><body><img src="https://assets.nflxext.com/x.png" width="5447">
<h1>¿Solicitaste actualizar tu Hogar con Netflix?</h1><p>Hola, Imitatiko:</p>
<p>Recibimos una solicitud para actualizar el Hogar con Netflix de tu cuenta el 31 de octubre, 08:30 GMT-6.</p>
<table><tr><td>Solicitud de Yulisa Vasquez, enviada desde <b>Samsung - Smart TV</b>, el 31 de octubre, 08:30 GMT-6</td></tr>
<tr><td><a href="${LINK}" style="color:#fff">Sí, la envié yo</a></td></tr></table>
<p>* El enlace vence en 15 minutos.</p><p>Código postal 5447</p></body></html>`;
const e = { from: 'Netflix <info@account.netflix.com>', subject: 'Importante: Cómo actualizar tu Hogar con Netflix', text: '', html, date: new Date(), ts: Date.now(), uid: 9 };

test('Hogar (modo Netflix Hogar): devuelve el enlace "Sí, la envié yo", nunca un número', async () => {
  let abrio = false;
  const r = await imap.resolverHogar([e], 'bonjovi@sublicuentas.com', { scrap: async () => { abrio = true; return '5447'; } });
  assert.equal(r.tipo, 'link'); assert.equal(r.motivo, 'hogar'); assert.equal(r.aprobacion, true);
  assert.equal(r.link, LINK.replace(/&amp;/g, '&'));
  assert.deepEqual(r.solicitud, { quien: 'Yulisa Vasquez', dispositivo: 'Samsung - Smart TV' });
  assert.equal(abrio, false, 'el servidor no abre el enlace de aprobación');
});

test('Hogar desde /code: también entrega el enlace de aprobación', async () => {
  const r = await imap.resolverCodigo([e], 'bonjovi@sublicuentas.com', { scrap: async () => '5447' });
  assert.equal(r.tipo, 'link'); assert.equal(r.motivo, 'hogar');
});

test('enlace de aprobación por el texto del botón (sin update-primary-location en la URL)', () => {
  const h = '<a href="https://www.netflix.com/ilum?code=abc&amp;x=1">Sí, la envié yo</a>';
  assert.equal(imap.extraerLinkAprobacionHogar(h, ''), 'https://www.netflix.com/ilum?code=abc&x=1');
  assert.equal(imap.extraerLinkObtenerCodigo(`<a href="${LINK}">x</a>`), null, 'el enlace de aprobación no se trata como "obtener código"');
});

test('código de acceso temporal (viaje) sigue siendo código', async () => {
  const t = { ...e, subject: 'Tu código de acceso temporal de Netflix', html: '<a href="https://www.netflix.com/account/travel/verify?nftoken=abc">Obtener código</a>' };
  const r = await imap.resolverCodigo([t], 'bonjovi@sublicuentas.com', { scrap: async () => '8812' });
  assert.equal(r.tipo, 'codigo'); assert.equal(r.codigo, '8812');
});
