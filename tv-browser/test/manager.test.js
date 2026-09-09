'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { SessionManager } = require('../manager');
const { interpretEvidence, publicAddress } = require('../browser');
const { platforms, canUse, get, match, code, allowsNavigation } = require('../../activar-tv-platforms');
const { authorized } = require('../server');

function fixture(options = {}) {
  const browsers = [];
  const createBrowser = async p => {
    const b = { platform:p.id, closed:false, calls:[], evidence:{ authenticated:false, loginVisible:true },
      login:async (email, password) => b.calls.push(['login',email,password]),
      inspect:async () => b.evidence, frame:async () => ({ image:'FAKE',host:p.domains[0],width:1000,height:760 }),
      openActivation:async () => { b.calls.push(['activation']); }, activate:async code => { b.calls.push(['activate',code]); },
      interact:async event => b.calls.push(['interact',event]), close:async () => { b.closed = true; } };
    browsers.push(b); return b;
  };
  return { manager:new SessionManager({ createBrowser, enabled:platforms.map(p => p.id), ...options }), browsers };
}
const input = (extra = {}) => ({ action:'start', platform:'netflix', email:'externa@example.test', password:' clave con espacios ', requestId:crypto.randomUUID(), ...extra });
async function settled(manager, view) {
  const session = manager.sessions.get(view.sessionId); if (session?.task) await session.task;
  return manager.view(session);
}
test('acceso para los tres usuarios y sus alias, sin ampliar los demás roles', () => {
  for (const name of ['geisell','geissel','relojes','libni','sublicuentas','naara']) assert(canUse(name));
  for (const name of ['','magdiel','admin','yami','daniela']) assert(!canUse(name));
  assert.equal(match('Netflix Premium VIP').id,'netflix');
  assert.equal(match('Disney Premium sin ESPN').id,'disney');
  assert.equal(match('Paramount+').id,'paramount');
});
test('correo externo no requiere inventario; clave conserva espacios; TV permanece bloqueado sin acceso', async () => {
  const {manager,browsers} = fixture(); const started = await manager.dispatch('uid-geisell',input());
  const view = await settled(manager,started); const b = browsers[0];
  assert.equal(view.email,'externa@example.test'); assert.equal(view.state,'login');
  assert.deepEqual(b.calls[0],['login','externa@example.test',' clave con espacios ']);
  assert(!JSON.stringify(view).includes('clave con espacios'));
  assert(!Object.hasOwn(manager.sessions.get(view.sessionId),'password'));
  await assert.rejects(manager.dispatch('uid-geisell',{action:'activate',sessionId:view.sessionId,code:'12345678'}),/Primero/);
  await assert.rejects(manager.dispatch('uid-geisell',{action:'confirm_account',sessionId:view.sessionId,email:view.email}),/Complete/);
  await manager.shutdown();
});
test('sesión, confirmación de cuenta y activación mantienen el mismo navegador para seis plataformas', async () => {
  for (const p of platforms) {
    const {manager,browsers} = fixture(); let view = await settled(manager, await manager.dispatch('uid-relojes',input({platform:p.id})));
    const b = browsers[0]; b.evidence = { authenticated:true, emailMatches:true, loginVisible:false };
    view = await manager.dispatch('uid-relojes',{action:'poll',sessionId:view.sessionId});
    assert.equal(view.state,'ready'); assert.equal(view.busy,false); assert.equal(view.verifiedBy,'platform');
    view = await settled(manager,await manager.dispatch('uid-relojes',{action:'activation_page',sessionId:view.sessionId}));
    assert.equal(view.state,'activation');
    const tvCode = '1'.repeat(p.codeLength || 6);
    view = await settled(manager,await manager.dispatch('uid-relojes',{action:'activate',sessionId:view.sessionId,code:tvCode}));
    assert.notEqual(view.state,'activated','un clic exitoso no equivale a TV activado');
    b.evidence = { activationSuccess:true, loginVisible:false };
    view = await manager.dispatch('uid-relojes',{action:'poll',sessionId:view.sessionId}); assert.equal(view.state,'activated');
    assert.equal(browsers.length,1); assert.deepEqual(b.calls.at(-1),['activate',tvCode]);
    await manager.shutdown();
  }
});
test('correo no visible exige confirmación explícita del operador y conserva esa distinción', async () => {
  const {manager,browsers} = fixture(); let view = await settled(manager,await manager.dispatch('uid-sublicuentas',input()));
  browsers[0].evidence = { authenticated:true, emailMatches:false, loginVisible:false };
  view = await manager.dispatch('uid-sublicuentas',{action:'poll',sessionId:view.sessionId}); assert.equal(view.state,'verify_account');
  await assert.rejects(manager.dispatch('uid-sublicuentas',{action:'activation_page',sessionId:view.sessionId}),/Primero/);
  await assert.rejects(manager.dispatch('uid-sublicuentas',{action:'confirm_account',sessionId:view.sessionId,email:'otra@example.test'}),/correo cambió/);
  view = await manager.dispatch('uid-sublicuentas',{action:'confirm_account',sessionId:view.sessionId,email:view.email});
  assert.equal(view.verifiedBy,'operator'); assert.equal(view.state,'ready');
  view = await manager.dispatch('uid-sublicuentas',{action:'poll',sessionId:view.sessionId}); assert.equal(view.state,'ready');
  await manager.shutdown();
});
test('aislamiento entre usuarios y cambio de cuenta destruye la sesión anterior', async () => {
  const {manager,browsers} = fixture();
  const a = await settled(manager,await manager.dispatch('uid-geisell',input()));
  const b = await settled(manager,await manager.dispatch('uid-relojes',input()));
  await assert.rejects(manager.dispatch('uid-relojes',{action:'poll',sessionId:a.sessionId}),/terminó/);
  await assert.rejects(manager.dispatch('uid-sublicuentas',{action:'close',sessionId:b.sessionId}),/terminó/);
  const next = await settled(manager,await manager.dispatch('uid-geisell',input({email:'otra@example.test'})));
  assert.notEqual(a.sessionId,next.sessionId); assert(browsers[0].closed); assert(!browsers[1].closed);
  assert.equal(manager.sessions.size,2); await manager.shutdown();
});
test('reintento no duplica contexto y solicitudes concurrentes respetan capacidad', async () => {
  const {manager,browsers} = fixture({maxSessions:2}); const data = input();
  const [a,b] = await Promise.all([manager.dispatch('owner',data),manager.dispatch('owner',data)]);
  await settled(manager,a); assert.equal(a.sessionId,b.sessionId); assert.equal(browsers.length,1);
  await assert.rejects(manager.dispatch('owner',{...data,email:'otra@example.test'}),/cuenta cambió/);
  await settled(manager,await manager.dispatch('other',input()));
  await assert.rejects(manager.dispatch('third',input()),/ocupado/);
  await manager.shutdown();
});
test('entrada repetida no vuelve a pulsar un botón', async () => {
  const {manager,browsers} = fixture(); const view = await settled(manager,await manager.dispatch('owner',input()));
  const event = { id:crypto.randomUUID(),type:'tap',x:10,y:20 };
  await settled(manager,await manager.dispatch('owner',{action:'interact',sessionId:view.sessionId,event}));
  await manager.dispatch('owner',{action:'interact',sessionId:view.sessionId,event});
  assert.equal(browsers[0].calls.filter(x => x[0] === 'interact').length,1); await manager.shutdown();
});
test('caducidad no se prolonga por consultas automáticas', async () => {
  let time = 1; const {manager,browsers} = fixture({ now:() => time,idleMs:1000,lifetimeMs:5000 });
  const view = await settled(manager,await manager.dispatch('owner',input())); time = 900;
  await manager.dispatch('owner',{action:'poll',sessionId:view.sessionId}); time = 1001;
  await assert.rejects(manager.dispatch('owner',{action:'poll',sessionId:view.sessionId}),/venció/);
  assert(browsers[0].closed); assert.equal(manager.sessions.size,0);
});
test('si la plataforma pide login otra vez, se bloquea el código', async () => {
  const {manager,browsers} = fixture(); let view = await settled(manager,await manager.dispatch('owner',input()));
  browsers[0].evidence = {authenticated:true,emailMatches:true};
  view = await manager.dispatch('owner',{action:'poll',sessionId:view.sessionId});
  browsers[0].evidence = {loginVisible:true,authenticated:false};
  view = await settled(manager,await manager.dispatch('owner',{action:'activation_page',sessionId:view.sessionId}));
  assert.equal(view.state,'login'); assert.equal(view.verifiedBy,'');
  await assert.rejects(manager.dispatch('owner',{action:'activate',sessionId:view.sessionId,code:'12345678'}),/Primero/);
  await manager.shutdown();
});
test('evidencia positiva, instrucciones y errores no se confunden', () => {
  const base = { text:'', headings:'', alerts:'', loginVisible:false, logoutVisible:false, profilePicker:false, emails:[] };
  for (const headings of ['TV activado','Tu dispositivo está vinculado','Your device has been activated','Device successfully registered']) {
    assert(interpretEvidence({...base,headings},'a@example.test').activationSuccess,headings);
  }
  for (const headings of ['Su dispositivo no está activado','Device not activated','Enter code to get your device activated','Cuando su TV esté activado','Continuar','Success']) {
    assert(!interpretEvidence({...base,headings},'a@example.test').activationSuccess,headings);
  }
  const negative = interpretEvidence({...base,headings:'TV activado',alerts:'Código incorrecto'},'a@example.test');
  assert(!negative.activationSuccess); assert(negative.error);
  assert(!interpretEvidence({...base,emails:['a@example.test']},'a@example.test').authenticated);
  assert(interpretEvidence({...base,logoutVisible:true,emails:['a@example.test']},'a@example.test').emailMatches);
  assert(!interpretEvidence({...base,logoutVisible:true,loginVisible:true,emails:['a@example.test']},'a@example.test').authenticated);
});
test('plataformas deshabilitadas, códigos y destinos permitidos', async () => {
  const {manager} = fixture({enabled:[]}); assert(!manager.available().available);
  await assert.rejects(manager.dispatch('owner',input()),/no está habilitada/);
  assert.equal(code('1234-5678',get('netflix')),'12345678'); assert.equal(code('abcdefgh',get('netflix')),'');
  assert.equal(code('ab12cd',get('crunchyroll')),'AB12CD');
  assert(allowsNavigation('https://auth.hbomax.com/link',get('hbo')));
  assert(!allowsNavigation('https://auth.hbomax.com.evil.test/link',get('hbo')));
  assert(!allowsNavigation('http://auth.hbomax.com/link',get('hbo')));
  assert(!allowsNavigation('https://user:password@auth.hbomax.com/link',get('hbo')));
  for (const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','192.168.1.1','::1','::ffff:127.0.0.1','fc00::1']) assert(!publicAddress(ip),ip);
  assert(publicAddress('8.8.8.8')); assert(publicAddress('2606:4700:4700::1111'));
  assert(authorized('Bearer '+'x'.repeat(40),'x'.repeat(40))); assert(!authorized('Bearer x','x'));
});
