import { normalizeText, parseDateDMY } from './data.js';

export const CRM_SELLERS = Object.freeze([
  'Relojes','Sublicuentas','Sublicuentas 2','Geisell','Yami','Manuel','Heber','Abner','Jimena','Elizabeth','Lucy','WolfTeam'
]);

export const CRM_SELLER_PHONES = Object.freeze({
  relojes:'32126332', sublicuentas:'89464277', 'sublicuentas 2':'89464328', yami:'96877246', jimena:'88501036', heber:'32174922', abner:'94306551', manuel:'87989267'
});

const CRM_PRICES_GENERAL = Object.freeze({
  netflix:130, vipnetflix:150, disneyp:90, disneys:70, hbomax:75, primevideo:60,
  crunchyroll:75, universal:60, vix:80, paramount:60, spotify:100, deezer:60,
  youtube:90, canva:50, gemini:500, chatgpt:0, duolingo:0, office:350, stellatv:0,
  oleada:90, evoutouch:0, iptv:130, office2021:0, viki:0, appletv:0,
  adobeexpress:0, windows10:0, windows11:0, eset:0,
});

const CRM_PRICES_SPECIAL = Object.freeze({
  netflix:130, vipnetflix:150, disneyp:100, disneys:70, hbomax:80, primevideo:80,
  crunchyroll:80, vix:80, paramount:80, viki:80, spotify:110, deezer:90,
  canva:69, gemini:170, duolingo:89, office:449, office2021:449, eset:399,
  oleada1:90, oleada3:200, latintv1:99, latintv2:149, latintv3:199, latintv4:249,
  liontv1:250, liontv2:275, liontv3:300, liontv5:350, evoutouch4:0, evoutouch:0,
});
const CRM_SPECIAL_SELLERS = new Set(['sublicuentas','sublicuentas 2','sublicuentas2','relojes','geisell','geissel']);

function platformKey(value='') {
  const raw=normalizeText(value).replace(/[^a-z0-9]/g,'');
  const aliases={
    netflixpremium:'netflix', netflix:'netflix', vipnetflix:'vipnetflix', netflixvip:'vipnetflix', netflixpremiumvip:'vipnetflix',
    disneypremium:'disneyp', disneyp:'disneyp', disneystandard:'disneys', disneypremiumsinespn:'disneys', disneys:'disneys',
    hbomax:'hbomax', max:'hbomax', primevideo:'primevideo', crunchyroll:'crunchyroll', paramount:'paramount', paramountplus:'paramount',
    vix:'vix', vixplus:'vix', appletv:'appletv', universal:'universal', universalplus:'universal',
    spotify:'spotify', spotifypremium:'spotify', youtube:'youtube', youtubepremium:'youtube', deezer:'deezer', deezerpremiumhifi:'deezer',
    canva:'canva', gemini:'gemini', geminipro:'gemini', chatgpt:'chatgpt', duolingo:'duolingo', viki:'viki', vikirakuten:'viki',
    office365:'office', office:'office', office2021:'office2021', adobeexpress:'adobeexpress', windows10:'windows10', windows11:'windows11',
    eset:'eset', esetnod321anodispositivo:'eset', stellatv:'stellatv', oleadatv:'oleada', oleada:'oleada', latintv:'latintv', liontv:'liontv',
    evoutouch:'evoutouch', evoutouch4:'evoutouch4', iptv:'iptv'
  };
  return aliases[raw] || raw;
}

export function sellerForSession(role='', usuario='') {
  const u=normalizeText(usuario);
  if (['naara','sublicuentas'].includes(u)) return 'Sublicuentas';
  if (['libni','relojes','daniela','finanzas'].includes(u)) return 'Relojes';
  if (['geisell','geissel'].includes(u)) return 'Geisell';
  const r=normalizeText(role).replace(/\s+/g,'_');
  if (['admin','administrador','sublicuentas','owner'].includes(r)) return 'Sublicuentas';
  if (['relojes','finanzas'].includes(r)) return 'Relojes';
  return '';
}

export function sellerPhone(seller='') {
  return CRM_SELLER_PHONES[normalizeText(seller)] || '';
}

export function crmDefaultPrice(platform='', seller='') {
  let p=platformKey(platform);
  if(/^oleadatv[13]$/.test(p))p=p.replace('oleadatv','oleada');
  const special=CRM_SPECIAL_SELLERS.has(normalizeText(seller));
  const map=special ? CRM_PRICES_SPECIAL : CRM_PRICES_GENERAL;
  if (Object.prototype.hasOwnProperty.call(map,p)) return Number(map[p] || 0);
  return Number(CRM_PRICES_GENERAL[p] || 0);
}

const TV_MONTHS = Object.freeze({
  latintv:[1,4,8,12], liontv:[1,3,5,12], stellatv:[1,3,7], oleada:[1,3,7,14], evoutouch:[1,3]
});

export function crmBasePlatform(value='') {
  const p=platformKey(value);
  if(/^stellatv[123]$/.test(p)) return 'stellatv';
  if(/^oleadatv[13]$/.test(p)) return 'oleada';
  if(/^latintv[1234]$/.test(p)) return 'latintv';
  if(/^liontv[1235]$/.test(p)) return 'liontv';
  if(/^evoutouch4$/.test(p)) return 'evoutouch';
  return p;
}

export function crmStoredDeviceCount(value='') {
  const p=platformKey(value);
  const m=p.match(/^(?:stellatv|oleadatv|latintv|liontv)([1-5])$/);
  if(m)return Number(m[1]);
  if(p==='evoutouch4')return 4;
  return 1;
}

export function crmStoredPlatform(platform='', devices=1) {
  const base=crmBasePlatform(platform);
  const n=Math.max(1,Math.round(Number(devices)||1));
  if(base==='stellatv')return `stellatv${[1,2,3].includes(n)?n:1}`;
  if(base==='oleada')return `oleadatv${[1,3].includes(n)?n:1}`;
  if(base==='latintv')return `latintv${[1,2,3,4].includes(n)?n:1}`;
  if(base==='liontv')return `liontv${[1,2,3,5].includes(n)?n:1}`;
  if(base==='evoutouch')return 'evoutouch4';
  return base;
}

export function crmAllowedMonths(platform='') {
  const base=crmBasePlatform(platform);
  return [...(TV_MONTHS[base] || [])];
}

export function crmAllowedDevices(platform='') {
  const base=crmBasePlatform(platform);
  if(base==='stellatv')return [1,2,3];
  if(base==='oleada')return [1,3];
  if(base==='latintv')return [1,2,3,4];
  if(base==='liontv')return [1,2,3,5];
  if(base==='evoutouch')return [4];
  return [];
}

export function renewalDaysForPreset(preset='30d') {
  return ({'30d':30,'31d':31,'2m':60,'3m':90})[preset] || 30;
}

function phoneKey(value='') { return String(value||'').replace(/\D/g,''); }
function clientIdentity(row={}) {
  const id=String(row.clienteId||'').trim();
  if(id)return `id:${id}`;
  const phone=phoneKey(row.telefono);
  const name=normalizeText(row.nombreNorm || row.nombre || '');
  return `legacy:${name}|${phone}`;
}
function groupKey(row={}) {
  return `${clientIdentity(row)}|${String(row.fechaRenovacion||'')}|${normalizeText(row.vendedor||'')}`;
}

export function groupRenewalsByClientDate(rows=[]) {
  const all=Array.isArray(rows)?rows:[];
  const allByClient=new Map();
  for (const row of all) {
    const key=clientIdentity(row);
    if (!allByClient.has(key)) allByClient.set(key,[]);
    allByClient.get(key).push(row);
  }
  const groups=new Map();
  for (const row of all) {
    const key=groupKey(row);
    const clientKey=clientIdentity(row);
    if (!groups.has(key)) groups.set(key,{
      key,clienteId:String(row.clienteId||''),nombre:String(row.nombre||'Cliente'),nombreNorm:String(row.nombreNorm||''),telefono:String(row.telefono||''),vendedor:String(row.vendedor||''),
      fechaRenovacion:String(row.fechaRenovacion||''),servicios:[],serviciosCliente:allByClient.get(clientKey)||[],total:0
    });
    const g=groups.get(key);
    g.servicios.push(row);
    g.total += Number(row.precio||0) || 0;
  }
  return [...groups.values()];
}

const FICHA_TEMPLATES = Object.freeze({
    default:
`*🎬 Entrega de su acceso {plat} 🎬*

👤 Perfil: *_{perfil}_*
*📧 Correo: {correo}*{claveLine}{pinLine}
*📅 Renovación: {renovTexto}*

🚨 Condiciones del servicio:
📌 No se modifica perfil
📌 Acceso solo para un dispositivo
📌 Uso solo en Honduras
📌 No usar vpn
📌 Garantía vigente

🚀 Sublicuentas`,
    netflix:
`*🌟 ¡Bienvenido/a a su acceso Netflix Premium! 🌟*

Le compartimos sus credenciales exclusivas:

👤 Su Perfil: *_{perfil}_*
*📧 Correo: {correo}*
*🔑 Clave: {clave}*
*📎 Pin de acceso: {pin}*
*📅 Próximo pago: {fecha}*

🚨 Reglas de su cuenta:
📌 Acceso solo para un dispositivo.
📌 El perfil no debe ser modificado.
📌 Servicio exclusivo para Honduras.
📌 Cuenta con garantía total activa.

⚠️ Aviso de Sistema:
Es posible que en 15 días o más el sistema solicite un código temporal. Cuando le aparezca, notifíquenos y se lo daremos al instante.

🚀 El equipo de Sublicuentas`,
    vipnetflix:
`*⭐ ¡Bienvenido/a a Netflix Premium VIP! ⭐*

Hola, *_{nombre}_*. Le hacemos entrega oficial de sus credenciales de acceso:

*👤 Perfil / cliente: {perfil}*
*📧 Correo: {correo}*
*🔑 Contraseña: {clave}*

📺 Puede iniciar sesión en el dispositivo que prefiera (celular, TV, tablet, etc.), pero la reproducción es en UNO a la vez — no se puede ver en varios dispositivos al mismo tiempo.
*⏳ Próximo pago: {fecha}*

✅ Garantía activa por todo el periodo contratado.

🚀 Sublicuentas`,
    disneyp:
`*🏰 ¡Bienvenido/a a la magia de Disney Premium! 🏰*

Le hacemos entrega oficial de sus credenciales de acceso:

👤 Su Perfil: *_{perfil}_*
*📧 Correo: {correo}*
*🔑 Clave: {clave}*
*📎 PIN de acceso: {pin}*
*📅 Renovación: {fecha}*

🚨 Reglas de su cuenta:
📌 Acceso solo para un dispositivo.
📌 No se modifica el perfil.
📌 Uso exclusivo en Honduras (No usar VPN).

✅ Garantía activa sujeta al estricto cumplimiento de estas condiciones.

🚀 El equipo de Sublicuentas`,
    disneys:
`*🍿🏰 Entrega de su acceso Disney Premium sin ESPN 🏰🍿*

👤 Perfil: *_{perfil}_*
*📧 Correo: {correo}*{claveLine}{pinLine}
*📅 Renovación: {renovTexto}*

🚨 Condiciones del servicio:
📌 No se modifica perfil
📌 Acceso solo para un dispositivo
📌 Uso solo en Honduras
📌 No usar vpn
📌 Garantía vigente

🚀 Sublicuentas`,
    hbomax:
`*🍿 Acceso Exclusivo: Hbo Max 🍿*

Aquí tiene los datos para disfrutar de su contenido:

👤 Perfil asignado: *_{perfil}_*
*📧 Correo: {correo}*
*🔑 Contraseña: {clave}*
*🔏 PIN: {pin}*
*⏳ Próximo pago: {fecha}*

⚠️ Condiciones del servicio:
📌 Acceso solo para un dispositivo.
📌 No se modifica perfil.
📌 Conexión válida únicamente para Honduras.

✔️ Garantía vigente durante todo el periodo adquirido.

🚀 Sublicuentas`,
    primevideo:
`*🍿🎬 Entrega de su acceso Prime Video 🎬🍿*

👤 Perfil: *_{perfil}_*
*📧 Correo: {correo}*{claveLine}{pinLine}
*📅 Renovación: {renovTexto}*

🚨 Condiciones del servicio:
📌 No modificar perfil
📌 Acceso solo para un dispositivo
📌 Uso solo en Honduras
📌 Garantía vigente

⚠️ Importante
📌 Compras y rentas de películas no disponible.
📌 Acceso exclusivo al catálogo oficial de Prime Video.

🚀 Sublicuentas`,
    crunchyroll:
`*🌀 Entrega de su acceso Crunchyroll 🌀*

👤 Perfil: *_{perfil}_*
*📧 Correo: {correo}*{claveLine}{pinLine}
*📅 Renovación: {renovTexto}*

🚨 Condiciones del servicio:
📌 Acceso solo para un dispositivo
📌 Uso solo en Honduras
📌 No usar vpn
📌 Garantía vigente

🚀 Sublicuentas`,
    universal:
`*🌐 Acceso Exclusivo: Universal+ 🎬*

Aquí tiene los datos para disfrutar de su contenido:

👤 Perfil asignado: *_{perfil}_*
*📧 Correo: {correo}*
*🔑 Clave: {clave}*
*🔐 PIN: {pin}*
*⏳ Próximo pago: {fecha}*

⚠️ Condiciones del servicio:
📌 Válido para 1 dispositivo.
📌 No se modifica el perfil.
📌 Conexión válida únicamente para Honduras.

✔️ Garantía vigente durante todo el periodo adquirido.

🚀 Sublicuentas`,
    vix:
`*✅ Acceso Exclusivo: ViX Premium 🍿*

Aquí tiene los datos para disfrutar de su contenido:

👤 Perfil asignado: *_{perfil}_*
*📧 Correo: {correo}*
*🔒 Clave: {clave}*
*⏳ Próximo pago: {fecha}*

⚠️ Detalles del servicio:
📌 Acceso solo para un dispositivo.
🎬 Acceso a Pelis, Series y Novelas.
⚽ Deportes: Liga Española.
📺 Compatible con TV, Celular, Tablet y Web.

✔️ Garantía vigente durante todo el periodo adquirido.

🚀 Sublicuentas`,
    appletv:
`*🍎 Entrega de su acceso Apple TV 🍎*

👤 Perfil: *_{perfil}_*
*🔐 PIN de acceso: {pin}*
*📅 Renovación: {renovTexto}*

🚨 Condiciones del servicio:
📌 Acceso únicamente mediante el PIN entregado.
📌 No modificar el perfil.
📌 Acceso solo para un dispositivo.
📌 Garantía vigente durante el periodo contratado.

🚀 Sublicuentas`,
    oleada:
`*🌊 Entrega de acceso Oleada TV 🌊*

👤 Cliente: *_{perfil}_*
*👤 Usuario: {correo}*
*🔑 Clave: {clave}*
*🗓️ Plan contratado: {planmeses}*
*📅 Renovación: {fecha}*

🚨 Condiciones del servicio:
📌 Límite autorizado: {oleadalimite}.
📌 No compartir usuario ni clave.
📌 Garantía vigente durante su tiempo adquirido.

🚀 Sublicuentas`,
    stellatv:
`*🔥 Entrega de acceso Stella TV 🔥*

👤 Cliente: *_{perfil}_*
*👤 Usuario: {correo}*
*🔑 Contraseña: {clave}*
*📺 Plan: {stellalimite}*
*🗓️ Vigencia contratada: {planmeses}*
*📅 Renovación: {fecha}*

🚨 Condiciones del servicio:
📌 Uso autorizado en {stellalimite}.
📌 Uso solo en Honduras.
📌 Garantía vigente durante el periodo contratado.

🚀 Sublicuentas`,
    iptv:
`*ACCESO {plat} | {planmeses} - {iptvpantallas}* 🎬🎬

📲 Compatible con: TV, Celular (iPhone o Android), Smarters Pro y SmartOne.

Ingrese estos datos manualmente en su app:
*👤 Cliente: {perfil}*
*📲 Lista: {iptvlista}*
*👤 Usuario: {correo}*
*🔒 Contraseña: {clave}*
*🧾 URL: {iptvurl}*

*⏳ Duración: {fecha} {iptvhora}*

🚀 Sublicuentas`,
    canva:
`*🎨 Acceso Exclusivo: Canva EduPro 🎨*

👤 Usuario: *_{perfil}_*
*📧 Correo activado: {correo}*
*⏳ Próximo pago: {fecha}*

⚠️ Condiciones del servicio:
📌 Acceso vinculado únicamente al correo indicado.

✔️ Garantía vigente durante todo el periodo adquirido.

🚀 Sublicuentas`,
    gemini:
`*🤖 Acceso Exclusivo: Gemini Pro ✨*

*👤 Cliente: {perfil}*
*📧 Invitación enviada a:*
*{correo}*
*⏳ Próximo pago: {fecha}*

⚠️ Condiciones del servicio:
📌 Acceso vinculado únicamente al correo indicado.
📌 Recuerde aceptar la invitación de Google en su correo para activar las funciones avanzadas.

✔️ Garantía vigente durante todo el periodo adquirido.

🚀 Sublicuentas`,
    chatgpt:
`*🤖 Entrega de acceso ChatGPT 🤖*

Estimad@ *_{nombre}_*, le comparto su acceso:

*👤 Perfil / cliente: {perfil}*
*📧 Correo: {correo}*
*📅 Renovación: {renovTexto}*

🚨 Condiciones del servicio:
📌 Acceso únicamente para el correo indicado
📌 No modificar datos internos
📌 Garantía vigente durante su tiempo adquirido

🚀 Sublicuentas`,
    spotify:
`*Estos son los datos de acceso 📱*
💻
Plataforma: 🎧 Spotify Premium
🎶 30 Días

🪩🎶 Reproduce tu música sin anuncios ni interrupciones
⬇️ Descargar ilimitadamente y reproduce sin conexión
📗 Crea playlist Spotify
🔥 Y mucho más

Cliente: *_{perfil}_*
*Correo 📧 {correo}*{claveLine}
*🗓️ {fecha}*

¡Gracias por su compra!`,

    youtube:
`*▶️ ENTREGA YOUTUBE PREMIUM ▶️*

*👤 Perfil: {perfil}*
*📧 Correo: {correo}*{claveLine}
*📅 Renovación: {fecha}*

✅ YouTube sin anuncios
✅ YouTube Music incluido
✅ Descargas para ver sin conexión
✅ Uso en 1 dispositivo/cuenta asignada

🚨 Condiciones del servicio:
📌 No cambiar datos de la cuenta
📌 Uso solo en Honduras
📌 No usar VPN
📌 Garantía vigente

🚀 Sublicuentas`,

    deezer:
`*🎧 CUENTA DEEZER PREMIUM HiFi 🎧*
¡Bienvenido a la mejor calidad de sonido! Su suscripción ya está activa. 🎼

*👤 Perfil: {perfil}*
*📧 Correo: {correo}*{claveLine}
*📅 Renovación: {fecha}*

🛡️ REGLAS DE ORO:
🚫 No cambiar el correo ni la contraseña.
👤 Uso exclusivo: Solo un dispositivo a la vez, puede usarlo en el de su preferencia.

🚀 Sublicuentas`,

    office:
`*💻 Acceso Exclusivo: Office 365 💻*

Aquí tiene los datos de su cuenta oficial lista para usar:
*👤 Cliente: {perfil}*
*📧 Correo: {correo}*
*🔑 Contraseña: {clave}*
*⏳ Vencimiento: {fecha}*

⚙️ Pasos exactos de instalación:
1️⃣ Ingrese desde su navegador a www.office.com e inicie sesión.
2️⃣ En la pantalla principal, busque el botón en la esquina superior derecha que dice "Instalar aplicaciones" (o "Instalar Office") y haga clic.
3️⃣ Se descargará el instalador oficial. Ábralo y siga las instrucciones en pantalla.
4️⃣ Al terminar de instalar, abra cualquier programa (como Word o Excel). Si le pide activar, inicie sesión nuevamente con estos mismos datos.

⚠️ Condiciones del servicio:
📌 ESTRICTAMENTE PROHIBIDO: No se debe cambiar la contraseña ni alterar la información de la cuenta.
📌 Compatible con Windows, Mac, Android e iOS.

✔️ Garantía vigente durante todo el año adquirido, sujeta al cumplimiento de estas normativas.

🚀 Sublicuentas`,

    duolingo:
`*📚 Activación Duolingo Plus 📖*

¡Su invitación premium ya fue enviada! Revise su bandeja de correo para aceptar y activar el acceso.

*👤 Cliente: {perfil}*
*📧 Correo activado: {correo}*
🎉 Beneficio: 1 mes de funciones Plus activas 📕
*🔄 Renovable hasta: {fecha}*

🚀 Sublicuentas`,
    viki:
`*💙 Entrega de su acceso Viki Rakuten 💙*

*👤 Perfil: {perfil}*
*📧 Correo: {correo}*
*🔑 Clave: {clave}*
*📅 Renovación: {fecha}*

🚨 Condiciones del servicio:
📌 No se modifica perfil
📌 Acceso solo para un dispositivo
📌 Uso solo en Honduras
📌 No usar vpn
📌 Garantía vigente

🚀 Sublicuentas`,
    windows10:
`*🪟 Licencia Windows 10*

*👤 Cliente: {perfil}*
*🔐 Serial / licencia: {clave}*
*📅 Vigencia: {fecha}*

🚨 Condiciones del servicio:
📌 No se modifica perfil
📌 Acceso solo para un dispositivo
📌 Uso solo en Honduras
📌 No usar vpn
📌 Garantía vigente

🚀 Sublicuentas`,
    windows11:
`*🪟 Licencia Windows 11*

*👤 Cliente: {perfil}*
*🔐 Serial / licencia: {clave}*
*📅 Vigencia: {fecha}*

🚨 Condiciones del servicio:
📌 No se modifica perfil
📌 Acceso solo para un dispositivo
📌 Uso solo en Honduras
📌 No usar vpn
📌 Garantía vigente

🚀 Sublicuentas`,
    eset:
`*🛡️ Licencia ESET*

*👤 Cliente: {perfil}*
*🔐 Serial / licencia: {clave}*
*📅 Vigencia: {fecha}*

🚨 Condiciones del servicio:
📌 No se modifica perfil
📌 Acceso solo para un dispositivo
📌 Uso solo en Honduras
📌 No usar vpn
📌 Garantía vigente

🚀 Sublicuentas`
  });

const FICHA_REGLAS_MULTIPERFIL = Object.freeze({
    default:
`🚨 Condiciones del servicio:
📌 No se modifica el perfil.
📌 Acceso solo para un dispositivo por perfil.
📌 Uso solo en Honduras.
📌 No usar VPN.
📌 Garantía vigente.`,
    netflix:
`🚨 Reglas de su cuenta:
📌 Acceso solo para un dispositivo por perfil.
📌 Los perfiles no deben ser modificados.
📌 Servicio exclusivo para Honduras.
📌 Cuenta con garantía total activa.

⚠️ Aviso de Sistema:
Es posible que en 15 días o más el sistema solicite un código temporal. Cuando le aparezca, notifíquenos y se lo daremos al instante.`,
    vipnetflix:
`📺 Puede iniciar sesión en el dispositivo que prefiera (celular, TV o tableta), pero cada acceso reproduce en UNO a la vez.

✅ Garantía activa por todo el periodo contratado.`,
    disneyp:
`🚨 Reglas de su cuenta:
📌 Acceso solo para un dispositivo por perfil.
📌 No se modifican los perfiles.
📌 Uso exclusivo en Honduras (No usar VPN).

✅ Garantía activa sujeta al estricto cumplimiento de estas condiciones.`,
    disneys:
`🚨 Condiciones del servicio:
📌 No se modifican los perfiles.
📌 Acceso solo para un dispositivo por perfil.
📌 Uso solo en Honduras.
📌 No usar VPN.
📌 Garantía vigente.`,
    hbomax:
`⚠️ Condiciones del servicio:
📌 Acceso solo para un dispositivo por perfil.
📌 No se modifican los perfiles.
📌 Conexión válida únicamente para Honduras.

✔️ Garantía vigente durante todo el periodo adquirido.`,
    primevideo:
`🚨 Condiciones del servicio:
📌 No modificar los perfiles.
📌 Acceso solo para un dispositivo por perfil.
📌 Uso solo en Honduras.
📌 Garantía vigente.

⚠️ Importante:
📌 Compras y rentas de películas no disponibles.
📌 Acceso exclusivo al catálogo oficial de Prime Video.`,
    crunchyroll:
`🚨 Condiciones del servicio:
📌 Acceso solo para un dispositivo por perfil.
📌 Uso solo en Honduras.
📌 No usar VPN.
📌 Garantía vigente.`,
    universal:
`⚠️ Condiciones del servicio:
📌 Válido para 1 dispositivo por perfil.
📌 No se modifican los perfiles.
📌 Conexión válida únicamente para Honduras.

✔️ Garantía vigente durante todo el periodo adquirido.`,
    vix:
`⚠️ Detalles del servicio:
📌 Acceso solo para un dispositivo por perfil.
🎬 Acceso a Pelis, Series y Novelas.
⚽ Deportes: Liga Española.
📺 Compatible con TV, Celular, Tablet y Web.

✔️ Garantía vigente durante todo el periodo adquirido.`,
    paramount:
`🚨 Condiciones del servicio:
📌 No se modifican los perfiles.
📌 Acceso solo para un dispositivo por perfil.
📌 Uso solo en Honduras.
📌 No usar VPN.
📌 Garantía vigente.`,
    spotify:
`🪩🎶 Reproduce música sin anuncios ni interrupciones.
⬇️ Descargas y reproducción sin conexión.
📗 Creación de playlists incluida.
📌 Un dispositivo a la vez por acceso.`,
    youtube:
`✅ YouTube sin anuncios.
✅ YouTube Music incluido.
✅ Descargas para ver sin conexión.
✅ Uso en 1 dispositivo/cuenta asignada.

🚨 Condiciones del servicio:
📌 No cambiar datos de la cuenta.
📌 Uso solo en Honduras.
📌 No usar VPN.
📌 Garantía vigente.`,
    deezer:
`🛡️ REGLAS DE ORO:
🚫 No cambiar el correo ni la contraseña.
👤 Uso exclusivo: solo un dispositivo a la vez por acceso.`,
    office:
`⚙️ Pasos exactos de instalación:
1️⃣ Ingrese desde su navegador a www.office.com e inicie sesión.
2️⃣ Presione "Instalar aplicaciones" o "Instalar Office".
3️⃣ Abra el instalador descargado y siga las instrucciones.
4️⃣ Si una aplicación solicita activación, inicie sesión con los mismos datos.

⚠️ Condiciones del servicio:
📌 No cambiar la contraseña ni alterar la información de la cuenta.
📌 Compatible con Windows, Mac, Android e iOS.

✔️ Garantía vigente durante todo el año adquirido, sujeta al cumplimiento de estas normativas.`,
    canva:
`⚠️ Condiciones del servicio:
📌 Acceso vinculado únicamente al correo indicado.

✔️ Garantía vigente durante todo el periodo adquirido.`,
    gemini:
`⚠️ Condiciones del servicio:
📌 Acceso vinculado únicamente al correo indicado.
📌 Cada persona debe aceptar la invitación de Google en su correo.

✔️ Garantía vigente durante todo el periodo adquirido.`,
    chatgpt:
`🚨 Condiciones del servicio:
📌 Acceso únicamente para el correo indicado.
📌 No modificar datos internos.
📌 Garantía vigente durante su tiempo adquirido.`,
    duolingo:
`📌 Cada persona debe aceptar la invitación enviada a su correo para activar las funciones Plus.
📌 La garantía permanece vigente durante el periodo adquirido.`,
    oleada:
`🚨 Condiciones del servicio:
📌 Límite autorizado: {oleadalimite} por acceso.
📌 No compartir usuario ni clave.
📌 Garantía vigente durante su tiempo adquirido.`,
    stellatv:
`🚨 Condiciones del servicio:
📌 Uso autorizado en {stellalimite} por acceso.
📌 Uso solo en Honduras.
📌 Garantía vigente durante el periodo contratado.`,
    iptv:
`📲 Compatible con TV, Celular (iPhone o Android), Smarters Pro y SmartOne.
📌 Ingrese manualmente la lista, usuario, contraseña y URL proporcionados.
📌 No comparta sus accesos fuera de los dispositivos contratados.`
  });

const FICHA_MENSAJES_CLIENTE = Object.freeze([
    {
      cuerpo:
`🚀 ¡Todo su entretenimiento centralizado en un solo lugar!

Hola, *{nombre}*. Hemos enlazado su servicio a nuestro panel inteligente para que su experiencia sea rápida, privada y segura.

*🎯 Acceda a su plataforma tocando su enlace personal:*

{link}

*⚡ Su servicio incluye soporte prioritario activo.*`,
      despedida: "¡Conectamos emociones, creamos experiencias con Sublicuentas!"
    },
    {
      cuerpo:
`🎬 Su entretenimiento comienza ahora, *{nombre}*.

Le damos la bienvenida a su servicio de {servicio}.

*📲 Abra el siguiente enlace para ver sus credenciales:*

{link}

*🛠️ Soporte y respaldo continuo durante todo su período.*`,
      despedida: "¡Gracias por confiar en el equipo de Sublicuentas!"
    },
    {
      cuerpo:
`✨ ¡Acceso Confirmado!

Estimado(a) *{nombre}*, su suscripción a {servicio} se encuentra activa y lista para ser utilizada.

*🔑 Consulte los datos de su cuenta aquí:*

{link}

*🛡️ Cuenta con garantía y soporte técnico garantizado durante toda su vigencia.*`,
      despedida: "¡Gracias por formar parte de Sublicuentas!"
    },
    {
      cuerpo:
`🎉 ¡Su acceso está confirmado, *{nombre}*!

Ya puede disfrutar de {servicio} sin contratiempos.

*🔐 Ingrese al siguiente enlace para ver los datos de su cuenta:*

{link}

*📞 Soporte disponible durante toda su vigencia.*`,
      despedida: "¡Gracias por elegir Sublicuentas!"
    },
    {
      cuerpo:
`🍿 ¡Su pase directo al mejor entretenimiento está listo!

Hola, *{nombre}*. Hemos preparado su experiencia para que desconecte de la rutina y disfrute sin interrupciones.

*👉 Desbloquee su entretenimiento tocando su enlace VIP seguro:*

{link}

*⚡ Su servicio incluye soporte prioritario activo.*`,
      despedida: "¡Gracias por elegir a Sublicuentas! Conectamos emociones, creamos experiencias."
    },
    {
      cuerpo:
`🌟 ¡Bienvenido a su espacio VIP de diversión!

Hola, *{nombre}*. Su perfil exclusivo ya está configurado con la mayor seguridad para brindarle una experiencia fluida.

*🚀 Ingrese a su panel personal tocando el siguiente enlace:*

{link}

*⚡ Su servicio incluye soporte prioritario activo.*`,
      despedida: "¡Agradecemos su confianza! Conectamos tu entretenimiento."
    }
  ]);

const IPTV_URLS = Object.freeze({latintv:'http://latgt.com:8080',latintv2:'http://enlatv.com',liontv:'http://liontv.es:80',evoutouch:'http://smarterstv99.dyndns.tv:25461/'});

function fichaLine(label,value){
  const clean=String(value??'').trim();
  return `${label} ${clean || '—'}`;
}

function deliveryFields(platform='') {
  const p=crmBasePlatform(platform);
  if (['windows10','windows11','eset'].includes(p)) return {email:false,password:true,pin:false,serial:true};
  // Apple TV keeps email/password in CRM but its traditional delivery exposes only PIN.
  if (p==='appletv') return {email:false,password:false,pin:true,serial:false};
  const noPin=new Set(['vipnetflix','paramount','vix','viki','spotify','deezer','youtube','canva','gemini','chatgpt','duolingo','office','office2021','stellatv','oleada','latintv','liontv','evoutouch','evoutouch4','iptv','windows10','windows11','adobeexpress','eset']);
  const noPassword=new Set(['canva','gemini','chatgpt','duolingo','adobeexpress']);
  const noEmail=new Set(['windows10','windows11','eset']);
  return {email:!noEmail.has(p),password:!noPassword.has(p),pin:!noPin.has(p),serial:false};
}

function templateKey(platform='') {
  const p=crmBasePlatform(platform);
  if(p==='office2021')return 'office';
  if(['latintv','liontv','evoutouch','iptv'].includes(p))return 'iptv';
  return p;
}

function platformEmoji(platform='') {
  const p=crmBasePlatform(platform);
  if(p==='stellatv')return '🔥';
  if(p.includes('netflix'))return '🎬';
  if(p.includes('disney'))return '🏰';
  if(p.includes('hbo'))return '🍿';
  if(['spotify','deezer'].includes(p))return '🎧';
  if(p==='youtube')return '▶️';
  if(p==='crunchyroll')return '🌀';
  if(p==='viki')return '💙';
  if(p==='appletv')return '';
  if(p==='canva')return '🎨';
  if(['gemini','chatgpt'].includes(p))return '🤖';
  if(p.includes('office')||p.includes('windows'))return '🪟';
  if(p==='adobeexpress')return '🅰️';
  if(p==='eset')return '🛡️';
  if(['oleada','latintv','liontv','evoutouch','iptv'].includes(p))return '📺';
  return '📱';
}

function sellerIcon(seller='') {
  const n=normalizeText(seller);
  if(n==='relojes')return '⌚';
  if(n==='sublicuentas')return '💻';
  return '🌟';
}

function replaceVariables(text='', vars={}) {
  let out=String(text||'');
  for(const [key,value] of Object.entries(vars))out=out.replaceAll(`{${key}}`,String(value??''));
  return out;
}

function planMonthsText(months=1) {
  const n=Math.max(1,Math.round(Number(months)||1));
  return `${n} mes${n===1?'':'es'}`;
}

function traditionalFooter(telefono='',vendedor='') {
  const lines=[];
  if(String(telefono||'').trim())lines.push(String(telefono).trim());
  if(String(vendedor||'').trim())lines.push(`${sellerIcon(vendedor)} Vendedor ${String(vendedor).trim()}`);
  return lines.length?`\n\n${lines.join('\n')}`:'';
}

export function buildTraditionalFicha({
  nombrePerfil='',telefono='',plataforma='',plataformaRaw='',fechaRenovacion='',precio=0,perfiles=[],vendedor='',vendedorTelefono='',
  mesesContratados=1,iptvProveedor='',iptvPantallas=1,iptvLista='',iptvHora='',oleadaDispositivos=1,stellaDispositivos=1
}={}) {
  const list=Array.isArray(perfiles)&&perfiles.length?perfiles:[{}];
  const base=crmBasePlatform(plataformaRaw || plataforma);
  const key=templateKey(base);
  const first=list[0]||{};
  const fields=deliveryFields(base);
  const fecha=String(fechaRenovacion||'—').trim()||'—';
  const provider=String(iptvProveedor||'').trim() || (base==='liontv'?'liontv':base==='evoutouch'?'evoutouch':'latintv');
  const url=IPTV_URLS[provider] || IPTV_URLS.latintv;
  const deviceCount=Math.max(1,Math.round(Number(iptvPantallas||crmStoredDeviceCount(plataformaRaw||plataforma)||1)));
  const oleadaCount=Math.max(1,Math.round(Number(oleadaDispositivos||crmStoredDeviceCount(plataformaRaw||plataforma)||1)));
  const stellaCount=Math.max(1,Math.round(Number(stellaDispositivos||crmStoredDeviceCount(plataformaRaw||plataforma)||1)));
  const vars={
    plat:plataforma || base || 'Servicio', nombre:nombrePerfil||'Cliente', perfil:first.nombre||first.perfil||nombrePerfil||'Cliente',
    correo:first.correo||'—', clave:first.clave||'—', pin:first.pinPerfil||'—',
    claveLine:fields.password?`\n*🔑 Clave: ${first.clave||'—'}*`:'', pinLine:fields.pin?`\n*📎 Pin: ${first.pinPerfil||'—'}*`:'',
    iptvurl:url, iptvlista:iptvLista||'—', iptvhora:iptvHora||'', iptvpantallas:`${deviceCount} DISPOSITIVO${deviceCount===1?'':'S'}`,
    oleadalimite:`${oleadaCount} dispositivo${oleadaCount===1?'':'s'}`, stellalimite:`${stellaCount} dispositivo${stellaCount===1?'':'s'}`,
    planmeses:planMonthsText(mesesContratados), renovTexto:fecha, dia:fecha.split('/')[0]||'—', fecha, precio:Number(precio||0)||'—'
  };
  let text='';
  if(list.length>1){
    const detail=list.map((p,index)=>{
      const access=[`*${index+1}. ${p.nombre||p.perfil||`Perfil ${index+1}`}*`];
      if(p.dispositivo)access.push(p.dispositivo==='tv'?`📺 Instalación: TV${p.esRoku?' (Roku)':' (No Roku)'}`:'📱 Instalación: Celular');
      if(fields.email)access.push(`📧 Correo: ${p.correo||'—'}`);
      if(fields.password)access.push(`${fields.serial?'🔐 Serial':'🔑 Clave'}: ${p.clave||'—'}`);
      if(fields.pin)access.push(`🔐 PIN ${p.pinPerfil||'—'}`);
      return access.join('\n');
    }).join('\n\n');
    const iptvBlock=key==='iptv'?`\n📲 Lista: *${vars.iptvlista}*\n🧾 URL: *${vars.iptvurl}*\n📺 Plan: *${vars.iptvpantallas}*\n🗓️ Vigencia contratada: *${vars.planmeses}*\n`:'';
    const ruleTemplate=FICHA_REGLAS_MULTIPERFIL[key] || FICHA_REGLAS_MULTIPERFIL.default;
    const rules=replaceVariables(ruleTemplate,vars);
    text=`*${platformEmoji(base)} ${plataforma||base} · ${list.length} PERFILES*\nTitular: *${nombrePerfil||'Cliente'}*\n\n${detail}${iptvBlock}\n📅 Renovación conjunta: *${fecha}*\n💰 Precio total de la compra: *Lps ${Number(precio||0)||'—'}*\n\n${rules}\n\n🚀 Sublicuentas`;
  }else{
    text=replaceVariables(FICHA_TEMPLATES[key] || FICHA_TEMPLATES.default,vars);
  }
  return (text+traditionalFooter(telefono,vendedor)).trim();
}

export function urlDeliveryVariantCount() { return FICHA_MENSAJES_CLIENTE.length; }

export function buildUrlDeliveryMessage({nombre='',servicio='',link='',variante=0}={}) {
  const index=Math.max(0,Math.min(FICHA_MENSAJES_CLIENTE.length-1,Number(variante)||0));
  const item=FICHA_MENSAJES_CLIENTE[index];
  return `${item.cuerpo}\n\n${item.despedida}`
    .replaceAll('{nombre}',nombre||'Cliente')
    .replaceAll('{servicio}',servicio||'su servicio')
    .replaceAll('{link}',link||'');
}

const CHARGE_OPENINGS=[
  '🎬 Hola, {n}. *Que continúe su entretenimiento premium* ✨',
  '🌟 {n}, siga disfrutando *entretenimiento premium sin pausas* 🍿',
  '☀️ Hola, {n}. *Su diversión merece continuar* 🎬',
  '✨ {n}, tenemos lista su próxima renovación 🎞️',
  '🍿 Hola, {n}. *Sus historias favoritas pueden continuar* ✨',
  '📺 {n}, mantenga activo su mejor entretenimiento 🎬',
  '💫 Hola, {n}. *Su entretenimiento premium está por renovarse* 🍿',
  '🙌 {n}, que no se detenga lo que más disfruta 🎬'
];
const CHARGE_CLOSINGS=['¿Desea renovar? ✅','¿Confirmamos la renovación? ✨','¿Continuamos? 🎬','¿Le ayudamos a renovar? 💫','¿Renovamos hoy? ✅','¿Quiere seguir disfrutando? 🍿','Respóndanos *SÍ* y renovamos 🙌','¿Damos continuidad? 📺'];
const CHARGE_LINES=['📅 {detalle} · {monto}. {cierre}','🍿 {detalle} · Renovación {monto}. {cierre}','💫 {detalle} · {monto} de renovación. {cierre}','🎬 {detalle} · Valor {monto}. {cierre}'];

function formatMoney(value=0){ return `Lps ${Number(value||0).toLocaleString('es-HN',{minimumFractionDigits:0,maximumFractionDigits:2})}`; }
function dateMoment(raw='', plural=false){
  const date=parseDateDMY(raw);
  if(!date)return plural?'tienen fecha por confirmar':'tiene fecha por confirmar';
  const today=new Date();today.setHours(12,0,0,0);
  const diff=Math.round((date-today)/86400000);
  const dateLabel=`*${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}*`;
  if(diff<0)return plural?`vencieron el ${dateLabel}`:`venció el ${dateLabel}`;
  if(diff===0)return plural?'vencen *hoy*':'vence *hoy*';
  if(diff===1)return plural?'vencen *mañana*':'vence *mañana*';
  return plural?`renuevan el ${dateLabel}`:`renueva el ${dateLabel}`;
}
function chargeServiceLabel(services=[]){
  if(services.length===1){const s=services[0]||{};const qty=Number(s.perfiles?.length||s.cantidadPerfiles||1);return `${s.plataforma||'Servicio'}${qty>1?` · ${qty} perfiles`:''}`;}
  const count=new Map();for(const s of services){const name=s?.plataforma||'Servicio';count.set(name,(count.get(name)||0)+1);}return [...count.entries()].map(([name,n])=>n>1?`${n} ${name}`:name).join(' + ');
}

export function buildChargeMessage(group={}, variant=0) {
  const services=(Array.isArray(group.servicios)&&group.servicios.length?group.servicios:[group]).filter(Boolean);
  const total=Number(group.total ?? services.reduce((sum,s)=>sum+Number(s.precio||0),0)) || 0;
  const n=Math.abs(Number(variant)||0);
  const opening=CHARGE_OPENINGS[n%CHARGE_OPENINGS.length].replaceAll('{n}',`*${String(group.nombre||'Cliente')}*`);
  const detail=`*${chargeServiceLabel(services)}* ${dateMoment(group.fechaRenovacion || services[0]?.fechaRenovacion || '',services.length>1)}`;
  const second=CHARGE_LINES[n%CHARGE_LINES.length]
    .replaceAll('{detalle}',detail)
    .replaceAll('{monto}',`*${formatMoney(total)}*`)
    .replaceAll('{cierre}',CHARGE_CLOSINGS[n%CHARGE_CLOSINGS.length]);
  return `${opening}\n${second}`;
}


function boldIfMissing(text,value){
  const raw=String(value||'').trim();
  if(!raw)return text;
  const already=[...String(text).matchAll(/\*([^*\n]+)\*/g)].some(m=>m[1].includes(raw));
  if(already)return text;
  const safe=raw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return String(text).replace(new RegExp(safe),`*${raw}*`);
}

export function normalizeChargeAiMessage(text='', group={}) {
  const clean=String(text||'').replace(/```(?:\w+)?/g,'').replace(/^\s*(?:mensaje|versi[oó]n)\s*:\s*/i,'').trim();
  const lines=clean.split(/\r?\n/).map(x=>x.replace(/^\s*[-•]\s*/,'').trim()).filter(Boolean);
  if(lines.length!==2)throw new Error('La IA no respetó el límite de dos líneas.');
  let out=lines.join('\n');
  if(out.length>300)throw new Error('La IA devolvió un mensaje demasiado largo.');
  const payment=/\b(?:BAC|Ficohsa|Banpa[ií]s|Atl[aá]ntida|Lafise|Davivienda|PayPal|Binance|Tigo\s*Money|transferencia|dep[oó]sito|cuenta\s+bancaria|n[uú]mero\s+de\s+cuenta|m[eé]todo(?:s)?\s+de\s+pago|tarjeta|comprobante|billetera|pague\s+a|env[ií]e\s+el\s+pago)\b/i;
  if(payment.test(out))throw new Error('La IA agregó detalles de pago no permitidos.');
  const emojis=out.match(/\p{Extended_Pictographic}/gu)||[];
  if(emojis.length<2)throw new Error('La IA no agregó suficientes emojis.');
  out=boldIfMissing(out,group?.nombre);
  const services=(Array.isArray(group?.servicios)?group.servicios:[]).map(s=>String(s?.plataforma||'')).filter(Boolean);
  for(const service of services)out=boldIfMissing(out,service);
  const total=Number(group?.total ?? 0);
  if(total){
    const candidates=[formatMoney(total),`L ${total.toFixed(2)}`,String(total)];
    for(const value of candidates){if(out.includes(value)){out=boldIfMissing(out,value);break;}}
  }
  return out;
}

export function urlVisibilityFromMode(mode='plataforma', fields={}) {
  if(mode==='personalizado') return {modo:'personalizado',campos:{correo:fields.correo!==false,clave:fields.clave!==false,pin:fields.pin!==false}};
  return {modo:mode || 'plataforma'};
}
