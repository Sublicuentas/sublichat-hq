import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CRM_SELLERS,
  sellerForSession,
  groupRenewalsByClientDate,
  buildTraditionalFicha,
  buildChargeMessage,
  renewalDaysForPreset,
  crmStoredPlatform,
  crmAllowedMonths,
  crmDefaultPrice,
  normalizeChargeAiMessage,
  buildUrlDeliveryMessage,
  urlDeliveryVariantCount,
} from '../src/operations.js';
import {
  buildCrmUpsertPayload,
  buildRenewalPayload,
  buildNoRenewalPayload,
  buildEnsureLinksPayload,
  buildChargeAiPayload,
} from '../src/api.js';

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('CRM seller list matches Sublichat and seller stays editable', () => {
  for (const seller of ['Relojes','Sublicuentas','Sublicuentas 2','Geisell','Yami','Manuel','Heber','Abner','Jimena','Elizabeth','Lucy','WolfTeam']) {
    assert.equal(CRM_SELLERS.includes(seller), true, seller);
  }
  assert.equal(sellerForSession('asesor','libni'), 'Relojes');
  assert.equal(sellerForSession('asesor','naara'), 'Sublicuentas');
  assert.match(main, /Vendedor responsable de esta cuenta/);
  assert.match(main, /Agregar vendedor/);
  assert.doesNotMatch(main, /crm-seller[^]*<strong>\$\{esc\(seller\)\}/);
});

test('CRM payload preserves complete Sublichat fields including multiprofile and URL visibility', () => {
  const payload=buildCrmUpsertPayload({
    clienteId:'cli_1', nombrePerfil:'Amy', telefono:'31652323', plataforma:'netflix',
    vendedor:'Heber', vendedorTelefono:'32174922', beneficiarioTipo:'tercero', beneficiarioNombre:'María',
    precio:130, fechaRenovacion:'16/10/2026', mesesContratados:1,
    visibilidadUrl:{modo:'personalizado',campos:{correo:true,clave:false,pin:true}},
    perfiles:[
      {perfilId:'p1',nombre:'Amy',perfil:'Amy',correo:'a@b.com',clave:'x',pinPerfil:'1111',dispositivo:'tv',esRoku:true},
      {perfilId:'p2',nombre:'Marta',perfil:'Marta',correo:'a@b.com',clave:'x',pinPerfil:'2222',dispositivo:'cel',esRoku:false},
    ],
    fichaTexto:'Ficha completa', forzarNuevoServicio:true,
  }, {compraId:'cmp_1'});
  assert.equal(payload.clienteId,'cli_1');
  assert.equal(payload.forzarNuevoServicio,true);
  assert.equal(payload.cliente.vendedor,'Heber');
  assert.equal(payload.servicio.vendedorTelefono,'32174922');
  assert.equal(payload.servicio.beneficiarioTipo,'tercero');
  assert.equal(payload.servicio.beneficiarioNombre,'María');
  assert.equal(payload.servicio.perfiles.length,2);
  assert.equal(payload.servicio.perfiles[1].perfilId,'p2');
  assert.deepEqual(payload.servicio.visibilidadUrl,{modo:'personalizado',campos:{correo:true,clave:false,pin:true}});
  assert.equal(payload.fichaTexto,'Ficha completa');
});

test('CRM links and no-renewal actions use existing renovar API contracts', () => {
  assert.deepEqual(buildEnsureLinksPayload('cli_1','titular'), {accion:'asegurar_enlaces',clienteId:'cli_1',beneficiarioKey:'titular'});
  const row={clienteId:'cli_1',compraId:'cmp_1',servicioIndex:2,plataforma:'netflix',correo:'a@b.com',telefono:'9999',nombreNorm:'amy'};
  const p=buildNoRenewalPayload(row);
  assert.equal(p.accion,'no_renovo');
  assert.equal(p.compraId,'cmp_1');
  assert.equal(p.servicioIndex,2);
});

test('renewal payload supports +30 +31 +2 months +3 months and exact calendar date', () => {
  const row={clienteId:'c',compraId:'x',servicioIndex:0,plataforma:'netflix',fechaRenovacion:'16/09/2026'};
  assert.equal(buildRenewalPayload(row,{days:30}).dias,30);
  assert.equal(buildRenewalPayload(row,{days:31}).dias,31);
  assert.equal(buildRenewalPayload(row,{days:renewalDaysForPreset('2m')}).dias,60);
  assert.equal(buildRenewalPayload(row,{days:renewalDaysForPreset('3m')}).dias,90);
  const exact=buildRenewalPayload(row,{exactDate:'31/12/2026'});
  assert.equal(exact.fechaExacta,'31/12/2026');
  assert.equal('dias' in exact,false);
});

test('renewals group services by client and date instead of one row per service', () => {
  const rows=[
    {clienteId:'c1',nombre:'Amy',fechaRenovacion:'16/09/2026',precio:130,compraId:'a',vendedor:'Relojes'},
    {clienteId:'c1',nombre:'Amy',fechaRenovacion:'16/09/2026',precio:70,compraId:'b',vendedor:'Relojes'},
    {clienteId:'c1',nombre:'Amy',fechaRenovacion:'20/09/2026',precio:80,compraId:'c',vendedor:'Relojes'},
  ];
  const groups=groupRenewalsByClientDate(rows);
  assert.equal(groups.length,2);
  const same=groups.find(x=>x.fechaRenovacion==='16/09/2026');
  assert.equal(same.servicios.length,2);
  assert.equal(same.total,200);
  assert.equal(same.serviciosCliente.length,3);
});

test('traditional ficha and charge message expose operational delivery data', () => {
  const ficha=buildTraditionalFicha({nombrePerfil:'Amy',plataforma:'Netflix Premium',fechaRenovacion:'16/10/2026',perfiles:[{nombre:'Amy',correo:'a@b.com',clave:'x',pinPerfil:'1234'}]});
  for (const token of ['Amy','a@b.com','1234','Próximo pago']) assert.match(ficha,new RegExp(token));
  const msg=buildChargeMessage({nombre:'Amy',servicios:[{plataforma:'Netflix',fechaRenovacion:'16/09/2026'}],total:130});
  assert.match(msg,/Amy/); assert.match(msg,/130/); assert.match(msg,/Netflix/);
  const ai=buildChargeAiPayload({nombre:'Amy',fechaRenovacion:'16/09/2026',servicios:[{plataforma:'Netflix',precio:130,fechaRenovacion:'16/09/2026'}],total:130},msg,'2026-09-16');
  assert.match(ai.pregunta,/exactamente 2 líneas/i);
  assert.match(ai.pregunta,/Amy/);
  assert.match(ai.pregunta,/Netflix/);
  assert.match(ai.pregunta,/130/);
  assert.equal(ai.mode,'rewrite');
  assert.deepEqual(ai.clientes,[]);
});

test('mobile UI includes full CRM delivery and grouped renewal controls', () => {
  for (const text of [
    'Vendedor responsable de esta cuenta','Número del vendedor / soporte','¿Quién usará este acceso?',
    'Datos visibles en la ficha URL','Otro perfil/cuenta a esta compra (2x1)','Ficha para grupo WhatsApp / respaldo',
    'Guardar CRM','Entregar ficha de la cuenta','Entregar ficha URL','Agregar otra cuenta',
    'Mensaje IA corto','Gestionar servicios','+30 días','+31 días','+2 meses','+3 meses','Elegir fecha en calendario'
  ]) assert.match(main,new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(main,/no_renovo|removeNonRenewingService/);
  assert.match(main,/asegurar_enlaces|ensureClientLinks/);
});

test('CRM editing keeps the authoritative compraId from the selected Sublichat service', () => {
  assert.match(main, /compraId:String\(row\.compraId\|\|''\)/);
  const payload=buildCrmUpsertPayload({
    clienteId:'cli_1', compraId:'cmp_existing', servicioIndex:1,
    plataformaOriginal:'netflix', correoOriginal:'old@example.com',
    nombrePerfil:'Amy', telefono:'9999-9999', plataforma:'netflix', vendedor:'Relojes', precio:130,
    fechaRenovacion:'16/10/2026', perfiles:[{perfilId:'p_existing',nombre:'Amy',correo:'new@example.com',clave:'x',pinPerfil:'1111',dispositivo:'tv'}],
  });
  assert.equal(payload.servicio.compraId,'cmp_existing');
  assert.equal(payload.servicio.perfiles[0].perfilId,'p_existing');
});

test('Apple TV stores CRM credentials but traditional delivery exposes only its PIN', () => {
  const payload=buildCrmUpsertPayload({
    nombrePerfil:'Amy', telefono:'9999', plataforma:'appletv', vendedor:'Sublicuentas', precio:80,
    fechaRenovacion:'16/10/2026', perfiles:[{nombre:'Amy',correo:'apple@example.com',clave:'secreta',pinPerfil:'4321'}],
  }, {compraId:'cmp_apple',perfilId:'p_apple'});
  assert.equal(payload.servicio.correo,'apple@example.com');
  assert.equal(payload.servicio.clave,'secreta');
  assert.equal(payload.servicio.pinPerfil,'4321');
  const ficha=buildTraditionalFicha({nombrePerfil:'Amy',plataforma:'Apple TV',plataformaRaw:'appletv',fechaRenovacion:'16/10/2026',perfiles:payload.servicio.perfiles});
  assert.match(ficha,/4321/);
  assert.doesNotMatch(ficha,/apple@example\.com/);
  assert.doesNotMatch(ficha,/secreta/);
});

test('renewal grouping falls back to client identity when old rows have no clienteId', () => {
  const rows=[
    {clienteId:'',nombre:'Amy',nombreNorm:'amy',telefono:'1111',fechaRenovacion:'16/09/2026',precio:130,compraId:'a',vendedor:'Relojes'},
    {clienteId:'',nombre:'Bob',nombreNorm:'bob',telefono:'2222',fechaRenovacion:'16/09/2026',precio:80,compraId:'b',vendedor:'Relojes'},
  ];
  const groups=groupRenewalsByClientDate(rows);
  assert.equal(groups.length,2);
  assert.deepEqual(groups.map(g=>g.nombre).sort(),['Amy','Bob']);
});

test('charge message keeps the Sublichat two-line format with exact commercial data', () => {
  const msg=buildChargeMessage({nombre:'Amy',fechaRenovacion:'16/09/2026',servicios:[{plataforma:'Netflix Premium',fechaRenovacion:'16/09/2026',precio:130}],total:130},0);
  const lines=msg.split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length,2);
  assert.match(msg,/\*Amy\*/);
  assert.match(msg,/\*Netflix Premium\*/);
  assert.match(msg,/130/);
  assert.doesNotMatch(msg,/BAC|Ficohsa|cuenta bancaria|transferencia/i);
});

test('CRM UI uses Sublichat pricing defaults instead of one hard-coded price', () => {
  assert.match(main,/crmDefaultPrice/);
  assert.match(main,/crmPrecio/);
  assert.doesNotMatch(main,/plataforma:'netflix', precio:'130'/);
});


test('TV Digital CRM stores the same platform variants and plan months as Sublichat', () => {
  assert.equal(crmStoredPlatform('stellatv',3),'stellatv3');
  assert.equal(crmStoredPlatform('oleada',3),'oleadatv3');
  assert.equal(crmStoredPlatform('latintv',4),'latintv4');
  assert.equal(crmStoredPlatform('liontv',5),'liontv5');
  assert.equal(crmStoredPlatform('evoutouch4',4),'evoutouch4');
  assert.deepEqual(crmAllowedMonths('latintv'),[1,4,8,12]);
  assert.deepEqual(crmAllowedMonths('liontv'),[1,3,5,12]);
  assert.deepEqual(crmAllowedMonths('stellatv'),[1,3,7]);
  assert.deepEqual(crmAllowedMonths('oleada'),[1,3,7,14]);
  assert.equal(crmDefaultPrice('latintv3','Relojes'),199);
  assert.equal(crmDefaultPrice('oleadatv3','Sublicuentas'),200);
});

test('AI charge response is constrained like Sublichat before it reaches WhatsApp', () => {
  const group={nombre:'Amy',servicios:[{plataforma:'Netflix Premium'}],total:130};
  const valid=normalizeChargeAiMessage('🎬 Hola *Amy* ✨\n📅 *Netflix Premium* renueva hoy · *Lps 130*. ¿Renovamos? ✅',group);
  assert.equal(valid.split(/\r?\n/).length,2);
  assert.throws(()=>normalizeChargeAiMessage('Hola Amy\nTransfiera a BAC 123',group),/pago|permitidos/i);
  assert.throws(()=>normalizeChargeAiMessage('una sola línea',group),/dos líneas/i);
});

test('mobile CRM applies TV Digital platform/device/month rules before saving', () => {
  assert.match(main,/crmStoredPlatform/);
  assert.match(main,/crmAllowedMonths/);
  assert.match(main,/crmAllowedDevices/);
  assert.match(main,/crmTvDispositivos/);
  assert.match(main,/plataforma:crmStoredPlatform/);
});

test('mobile charge AI validates the API reply and falls back to local Sublichat copy', () => {
  assert.match(main,/normalizeChargeAiMessage/);
  assert.match(main,/Mensaje IA actualizado/);
  assert.match(main,/buildChargeMessage\(g/);
});


test('URL delivery exposes the same six Sublichat variants', () => {
  assert.equal(urlDeliveryVariantCount(),6);
  const first=buildUrlDeliveryMessage({nombre:'Amy',servicio:'Netflix Premium',link:'https://sublichat.capuchino.lat/c/abc',variante:0});
  assert.match(first,/Todo su entretenimiento centralizado en un solo lugar/);
  assert.match(first,/panel inteligente/);
  assert.match(first,/https:\/\/sublichat\.capuchino\.lat\/c\/abc/);
  assert.doesNotMatch(first,/8946|3212|Vendedor/);
  const sixth=buildUrlDeliveryMessage({nombre:'Amy',servicio:'Netflix Premium',link:'https://sublichat.capuchino.lat/c/abc',variante:5});
  assert.match(sixth,/espacio VIP de diversión/);
  assert.match(sixth,/panel personal/);
});

test('traditional ficha uses Sublichat platform templates and backup footer', () => {
  const netflix=buildTraditionalFicha({
    nombrePerfil:'Amy',telefono:'31652323',plataforma:'Netflix Premium',plataformaRaw:'netflix',fechaRenovacion:'16/10/2026',precio:130,
    perfiles:[{nombre:'Amy',correo:'a@b.com',clave:'x',pinPerfil:'1234'}],vendedor:'Relojes'
  });
  assert.match(netflix,/¡Bienvenido\/a a su acceso Netflix Premium!/);
  assert.match(netflix,/Aviso de Sistema/);
  assert.match(netflix,/31652323/);
  assert.match(netflix,/⌚ Vendedor Relojes/);
  assert.doesNotMatch(netflix,/32126332/);
  const canva=buildTraditionalFicha({nombrePerfil:'Amy',plataforma:'Canva · 1 mes',plataformaRaw:'canva',fechaRenovacion:'16/10/2026',perfiles:[{nombre:'Amy',correo:'a@b.com',clave:'NO-DEBE-SALIR'}]});
  assert.match(canva,/Canva EduPro/);
  assert.match(canva,/a@b\.com/);
  assert.doesNotMatch(canva,/NO-DEBE-SALIR/);
});

test('mobile CRM renders and sends the six URL variants instead of a generic link message', () => {
  assert.match(main,/data-crm-url-variant/);
  assert.match(main,/urlDeliveryVariantCount\(\)/);
  assert.match(main,/Variante \$\{i\+1\}/);
  assert.match(main,/buildUrlDeliveryMessage/);
  assert.match(main,/crmCopyUrlVariant/);
  assert.match(main,/crmOpenUrlVariant/);
  assert.doesNotMatch(main,/Aquí tiene su acceso permanente de Sublicuentas/);
});
