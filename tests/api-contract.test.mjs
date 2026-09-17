import test from 'node:test';
import assert from 'node:assert/strict';
import { API_BASE, decodeFirestoreValue, decodeFirestoreDocument, buildRenewalPayload, raffleLoadPayload, isRedirectStatus, resolveSafeRedirectUrl, buildLoginPayload, loginEndpointRequest } from '../src/api.js';

test('Firestore REST values decode into normal JavaScript data', () => {
  const value = decodeFirestoreValue({ mapValue:{ fields:{ name:{stringValue:'Ana'}, active:{booleanValue:true}, amount:{integerValue:'130'}, tags:{arrayValue:{values:[{stringValue:'vip'}]}} } } });
  assert.deepEqual(value, { name:'Ana', active:true, amount:130, tags:['vip'] });
});

test('Firestore document preserves document id', () => {
  const doc = decodeFirestoreDocument({ name:'projects/x/databases/(default)/documents/clientes/abc123', fields:{ nombrePerfil:{stringValue:'Ana'} } });
  assert.equal(doc.id, 'abc123');
  assert.equal(doc.nombrePerfil, 'Ana');
});

test('renewal payload prioritizes clienteId and compraId and keeps DD/MM/YYYY', () => {
  const payload = buildRenewalPayload({ clienteId:'c1', compraId:'cmp1', servicioIndex:4, plataforma:'Netflix', correo:'a@b.com', fechaRenovacion:'16/09/2026', telefono:'9999-0000', nombreNorm:'ana' }, 30);
  assert.equal(payload.accion, 'renovar');
  assert.equal(payload.clienteId, 'c1');
  assert.equal(payload.compraId, 'cmp1');
  assert.equal(payload.fechaActual, '16/09/2026');
  assert.equal(payload.dias, 30);
});


test('raffle load uses the current sorteos API accion contract', () => {
  assert.deepEqual(raffleLoadPayload(), { accion:'cargar' });
});


test('login transport recognizes 307 and 308 as redirects', () => {
  assert.equal(isRedirectStatus(307), true);
  assert.equal(isRedirectStatus(308), true);
  assert.equal(isRedirectStatus(401), false);
});

test('login transport only follows HTTPS redirects to trusted Sublicuentas hosts', () => {
  assert.equal(
    resolveSafeRedirectUrl('https://sublichat-hq.vercel.app/api/login', 'https://sublicuentas.com/api/login'),
    'https://sublicuentas.com/api/login'
  );
  assert.equal(
    resolveSafeRedirectUrl('https://sublichat-hq.vercel.app/api/login', '/api/login'),
    'https://sublichat-hq.vercel.app/api/login'
  );
  assert.throws(() => resolveSafeRedirectUrl('https://sublichat-hq.vercel.app/api/login', 'http://sublicuentas.com/api/login'), /segura/i);
  assert.throws(() => resolveSafeRedirectUrl('https://sublichat-hq.vercel.app/api/login', 'https://evil.example/api/login'), /autorizado/i);
});


test('Android Core base uses the canonical Sublichat domain and trusts its redirect host', () => {
  assert.equal(API_BASE, 'https://sublichat.capuchino.lat');
  assert.equal(
    resolveSafeRedirectUrl('https://sublichat-hq.vercel.app/api/login', 'https://sublichat.capuchino.lat/api/login'),
    'https://sublichat.capuchino.lat/api/login'
  );
});


test('Android login sends the same normalized credentials directly to /api/login', async () => {
  const calls=[];
  const fakeFetch=async (url, init)=>{
    calls.push({url,init});
    return { ok:true, status:200, text:async()=>JSON.stringify({token:'t',usuario:'sublicuentas',role:'admin'}) };
  };
  const payload=buildLoginPayload('  SubliCuentas  ', ' Clave con espacios ');
  assert.deepEqual(payload, { usuario:'sublicuentas', clave:' Clave con espacios ' });
  const data=await loginEndpointRequest('  SubliCuentas  ', ' Clave con espacios ', fakeFetch);
  assert.equal(data.token, 't');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${API_BASE}/api/login`);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].init.body, JSON.stringify({ usuario:'sublicuentas', clave:' Clave con espacios ' }));
});

test('new CRM payload creates a stable new purchase/profile through ficha_upsert', async () => {
  const api = await import('../src/api.js');
  assert.equal(typeof api.buildCrmUpsertPayload, 'function');
  const payload = api.buildCrmUpsertPayload({
    nombrePerfil:'Amy Pastrana', telefono:'31652323', plataforma:'netflix',
    correo:'dojo.us@onlybasic.xyz', clave:'secret', pinPerfil:'1234', perfil:'Amy',
    precio:130, fechaRenovacion:'16/10/2026', dispositivo:'tv', vendedor:'Relojes'
  }, { compraId:'compra_test', perfilId:'perfil_test' });
  assert.equal(payload.accion, 'ficha_upsert');
  assert.equal(payload.clienteId, '');
  assert.equal(payload.cliente.nombrePerfil, 'Amy Pastrana');
  assert.equal(payload.servicio.compraId, 'compra_test');
  assert.equal(payload.servicio.perfiles[0].perfilId, 'perfil_test');
  assert.equal(payload.servicio.fechaRenovacion, '16/10/2026');
  assert.equal(payload.servicio.vendedor, 'Relojes');
});
