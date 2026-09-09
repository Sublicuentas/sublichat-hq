'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const platforms = require('../../activar-tv-platforms');
function fixture(user, env = {}, fetchResult = {ok:true,available:true,platforms:['netflix']}) {
  const forwarded = [], verified = [];
  const context = { module:{exports:{}}, exports:{}, URL, AbortController, Buffer, setTimeout, clearTimeout,
    process:{env:{ TV_BROWSER_URL:'https://tv.example.test',TV_BROWSER_SECRET:'x'.repeat(40), ...env }},
    require:name => name === 'firebase-admin' ? {apps:[{}],auth:() => ({verifyIdToken:async (token,checkRevoked) => {
      verified.push([token,checkRevoked]); if (!user) throw new Error('EXPIRED'); return user;
    }})} : platforms,
    fetch:async (url,init) => { forwarded.push({url,...init,body:JSON.parse(init.body)}); return {status:200,text:async () => JSON.stringify(fetchResult)}; }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../api/activar-tv.js'),'utf8'),context);
  async function request(body, headers = {authorization:'Bearer signed-token'}, method = 'POST') {
    const res = {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;}};
    await context.module.exports({body,headers,method},res); return res;
  }
  return {request,forwarded,verified};
}
test('API verifica token y revocación para Geisell, Relojes y Sublicuentas', async () => {
  for (const name of platforms.allowedUsers) {
    const f = fixture({uid:'uid-'+name,usuario:name,role:'asesor'});
    const res = await f.request({action:'availability'});
    assert.equal(res.statusCode,200); assert.deepEqual(f.verified,[['signed-token',true]]);
    assert.equal(f.forwarded[0].body.owner,'uid-'+name);
    assert.match(res.headers['Cache-Control'],/no-store/);
  }
});
test('API no confía en usuario, rol, propietario o URL enviados por el cliente', async () => {
  const denied = fixture({uid:'m',usuario:'magdiel',role:'admin'});
  const no = await denied.request({action:'availability',usuario:'sublicuentas',role:'admin',owner:'n'});
  assert.equal(no.statusCode,403); assert.equal(denied.forwarded.length,0);
  const allowed = fixture({uid:'g',usuario:'geisell'});
  await allowed.request({action:'start',platform:'netflix',email:'externa@example.test',password:'a&b',owner:'other',url:'http://127.0.0.1',requestId:'abcdefghijk123456'});
  const payload = allowed.forwarded[0]; assert.equal(payload.body.owner,'g'); assert(!Object.hasOwn(payload.body,'url'));
  assert.equal(payload.url,'https://tv.example.test/v1/action'); assert.equal(payload.body.password,'a&b');
  assert.equal(payload.redirect,'error');
});
test('sesión ausente o vencida bloquea el servicio', async () => {
  const f = fixture(null);
  assert.equal((await f.request({action:'availability'},{})).statusCode,401);
  assert.equal((await f.request({action:'availability'})).statusCode,401); assert.equal(f.forwarded.length,0);
});
test('sin servicio configurado no simula inicios ni recibe credenciales en el worker', async () => {
  const f = fixture({uid:'n',usuario:'sublicuentas'},{TV_BROWSER_URL:''});
  const availability = await f.request({action:'availability'}); assert.equal(availability.statusCode,200); assert(!availability.data.available);
  const start = await f.request({action:'start',email:'externa@example.test',password:'anything'});
  assert.equal(start.statusCode,503); assert.equal(start.data.code,'TV_NOT_CONFIGURED'); assert.equal(f.forwarded.length,0);
});
test('HTTP sin TLS, clave corta, acciones desconocidas y payload excesivo se rechazan', async () => {
  for (const env of [{TV_BROWSER_URL:'http://tv.example.test'},{TV_BROWSER_SECRET:'short'},{TV_BROWSER_URL:'https://user:key@tv.example.test'}]) {
    const f = fixture({uid:'r',usuario:'relojes'},env); const res = await f.request({action:'start'});
    assert.equal(res.statusCode,503); assert.equal(f.forwarded.length,0);
  }
  const f = fixture({uid:'r',usuario:'relojes'});
  assert.equal((await f.request({action:'eval'})).statusCode,400);
  assert.equal((await f.request({action:'start',password:'x'.repeat(30000)})).statusCode,413);
});
