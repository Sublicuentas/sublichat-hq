import './styles.css';
import { IntentLauncher, ActivityAction } from '@capgo/capacitor-intent-launcher';
import {
  clearSession,
  createCrmSale,
  ensureClientLinks,
  generateChargeMessageAI,
  loadMobileResource,
  getSession,
  loadCatalog,
  loadProfile,
  loadRaffles,
  loadTickets,
  loginUser,
  registerRenewalPayment,
  removeNonRenewingService,
  renewService,
} from './api.js';
import {
  dashboardSummary,
  coreCollectionsForRole,
  filterClients,
  filterOperationalRows,
  operationalFilterOptions,
  formatDateShort,
  money,
  operatorIdentity,
  parseDateDMY,
  roleCapabilities,
  roleLabel,
  serviceRowsFromClients,
} from './data.js';
import {
  CRM_SELLERS,
  buildChargeMessage,
  crmDefaultPrice,
  crmStoredPlatform,
  crmAllowedMonths,
  crmAllowedDevices,
  crmBasePlatform,
  crmStoredDeviceCount,
  buildTraditionalFicha,
  buildUrlDeliveryMessage,
  urlDeliveryVariantCount,
  groupRenewalsByClientDate,
  normalizeChargeAiMessage,
  renewalDaysForPreset,
  sellerForSession,
  sellerPhone,
  urlVisibilityFromMode,
} from './operations.js';

const svg = (body, size=22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
function icon(name, size=22) {
  const icons = {
    home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.3 2.5-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.7c2.9-.6 5 .9 5.5 4.3"/>',
    renew:'<path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/>',
    catalog:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    more:'<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    search:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    refresh:'<path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/>',
    box:'<path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M12 11v10"/>',
    finance:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h3M8 17h8"/>',
    ticket:'<path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V6Z"/><path d="M12 8v8"/>',
    gift:'<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M12 10v10M3 10h18v-3H3z"/><path d="M12 7c-1.5-4-6-4-6-1.5S9 7 12 7Zm0 0c1.5-4 6-4 6-1.5S15 7 12 7Z"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-4.4 3.3-6.5 7.5-6.5s6.7 2.1 7.5 6.5"/>',
    chevron:'<path d="m9 6 6 6-6 6"/>',
    back:'<path d="m15 6-6 6 6 6"/>',
    phone:'<path d="M6.5 3.5 10 7l-2 3c1.4 2.8 3.2 4.6 6 6l3-2 3.5 3.5-2.2 3c-.7 1-2 1.4-3.2 1C8.6 19.4 4.6 15.4 2.5 8.9c-.4-1.2 0-2.5 1-3.2l3-2.2Z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    logout:'<path d="M10 4H5v16h5"/><path d="m14 8 4 4-4 4M18 12H9"/>',
    cloud:'<path d="M7 18h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1A3.5 3.5 0 0 0 7 18Z"/>',
    alert:'<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
    add:'<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
    eye:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  };
  return svg(icons[name] || icons.more, size);
}

const BUILD_NUMBER = String(import.meta.env.VITE_BUILD_NUMBER || '1');

const CRM_PLATFORMS = [
  ['netflix','Netflix Premium'], ['vipnetflix','⭐ Netflix Premium VIP'], ['disneyp','Disney Premium'], ['disneys','Disney Premium sin ESPN'],
  ['hbomax','HBO Max'], ['primevideo','Prime Video'], ['crunchyroll','Crunchyroll'], ['paramount','Paramount+'], ['vix','ViX+'],
  ['appletv','Apple TV'], ['universal','Universal+'], ['spotify','Spotify Premium'], ['youtube','YouTube Premium'], ['deezer','Deezer Premium HiFi'],
  ['canva','Canva · 1 mes'], ['gemini','Gemini Pro'], ['chatgpt','ChatGPT'], ['duolingo','Duolingo'], ['viki','Viki Rakuten'], ['office','Office 365'], ['office2021','Office 2021'], ['adobeexpress','Adobe Express'],
  ['windows10','Windows 10'], ['windows11','Windows 11'], ['eset','ESET NOD32 · 1 año / 1 dispositivo'], ['stellatv','Stella TV'], ['oleada','Oleada TV'],
  ['latintv','LatinTV'], ['liontv','LionTV'], ['evoutouch4','EvouTouch']
];
const CRM_NO_PIN = new Set(['vipnetflix','spotify','deezer','youtube','office','paramount','vix','canva','gemini','chatgpt','duolingo','stellatv','oleada','latintv','liontv','evoutouch4','viki','windows10','windows11','adobeexpress','eset']);
const CRM_NO_PASSWORD = new Set(['canva','gemini','chatgpt','duolingo','adobeexpress']);
const CRM_NO_EMAIL = new Set(['windows10','windows11','eset']);
const CRM_DEVICE = new Set(['netflix','disneyp','disneys','hbomax','vix','universal','primevideo']);


const state = {
  active:'inicio',
  subview:null,
  theme:localStorage.getItem('sublicuentas-theme') || 'system',
  session:getSession(),
  loading:false,
  sync:'idle',
  clients:[],
  inventory:[],
  finances:[],
  catalog:null,
  tickets:null,
  raffles:null,
  controlInventory:null,
  profile:null,
  whatsappChooser:false,
  whatsappText:'',
  whatsappPhone:'',
  crmDraft:null,
  renewGroupKey:'',
  renewSelection:[],
  renewManage:false,
  renewMessage:'',
  renewMessageVariant:0,
  crmUrlVariant:0,
  search:'',
  clientStatusFilter:'vigentes',
  clientSellerFilter:'',
  clientPlatformFilter:'',
  clientLimit:100,
  clientActionKey:'',
  clientActionMode:'menu',
  clientActionLink:'',
  clientActionUrlVariant:0,
  renewFilter:'hoy',
  selectedClientId:'',
  renewKey:'',
  toast:'',
  errors:{},
};

function esc(value='') {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function applyTheme() { document.documentElement.dataset.theme = state.theme; }
function cap() { return roleCapabilities(state.session?.role || '', state.session?.usuario || ''); }
function todayISO() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function todayDMY() { const [y,m,d]=todayISO().split('-'); return `${d}/${m}/${y}`; }
function datePlusDaysDMY(days=30) { const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+Number(days||0)); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }
function crmSeller() { const id=operatorIdentity(state.session?.role || '', state.session?.usuario || ''); return id==='relojes' ? 'Relojes' : id==='sublicuentas' ? 'Sublicuentas' : ''; }
function crmRuleKey(value='') { return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,''); }
function crmRules(value='') { const key=crmRuleKey(value); return { key, email:!CRM_NO_EMAIL.has(key), password:!CRM_NO_PASSWORD.has(key), pin:!CRM_NO_PIN.has(key), device:CRM_DEVICE.has(key) }; }
function rowKey(row) { return `${row.clienteId}|${row.compraId || ''}|${row.servicioIndex}`; }
function allRows() { return serviceRowsFromClients(state.clients); }
function clientName(client) { return client?.nombrePerfil || client?.nombre || 'Cliente'; }
function avatarMarkup() {
  const avatar = state.profile?.avatar || '';
  if (avatar) return `<img src="${esc(avatar)}" class="avatar-img" alt="Perfil">`;
  return `<div class="avatar-fallback">${icon('user',22)}</div>`;
}

function showToast(message) {
  state.toast = message;
  render();
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(()=>{ state.toast=''; render(); }, 3200);
}

async function loadCoreData({force=false}={}) {
  if (!state.session || state.loading) return;
  state.loading = true; state.sync='syncing'; render();
  const collections = new Set(coreCollectionsForRole(state.session.role || '', state.session.usuario || ''));
  const tasks = [
    ['clients', () => loadMobileResource('clientes', {pageSize:250,maxPages:24})],
    ...(collections.has('inventario') ? [['inventory', () => loadMobileResource('inventario', {pageSize:250,maxPages:16})]] : []),
    ...(collections.has('finanzas_movimientos') ? [['finances', () => loadMobileResource('finanzas_movimientos', {pageSize:250,maxPages:16})]] : []),
    ['profile', () => loadProfile(state.session.usuario).then(x=>x.perfil || null)],
  ];
  if (!collections.has('inventario')) state.inventory = [];
  if (!collections.has('finanzas_movimientos')) state.finances = [];
  const results = await Promise.allSettled(tasks.map(([,fn])=>fn()));
  results.forEach((result,index)=>{
    const key = tasks[index][0];
    if (result.status === 'fulfilled') { state[key] = result.value; delete state.errors[key]; }
    else state.errors[key] = result.reason?.message || 'No disponible';
  });
  state.loading=false;
  state.sync = Object.keys(state.errors).length ? 'partial' : 'online';
  render();
}

async function ensureCatalog() {
  if (state.catalog || !cap().catalogo) return;
  try { const data=await loadCatalog(); state.catalog=data.catalog || {}; delete state.errors.catalog; }
  catch(e){ state.errors.catalog=e.message; }
  render();
}

async function ensureTickets() {
  if (state.tickets) return;
  try { const data=await loadTickets(100); state.tickets=data.items || []; delete state.errors.tickets; }
  catch(e){ state.errors.tickets=e.message; }
  render();
}

async function ensureRaffles() {
  if (state.raffles || !cap().sorteos) return;
  try { state.raffles=await loadRaffles(); delete state.errors.raffles; }
  catch(e){ state.errors.raffles=e.message; }
  render();
}

async function ensureControlMaster() {
  if (state.controlInventory || !cap().controlMaestro) return;
  try { state.controlInventory=await loadMobileResource('inventario', {pageSize:250,maxPages:16}); delete state.errors.controlMaster; }
  catch(e){ state.errors.controlMaster=e.message; }
  render();
}

function loginView() {
  return `<main class="login-shell">
    <section class="login-card">
      <div class="brand-mark"><span>Subli</span><b>cuentas</b></div>
      <div class="login-orb">${icon('cloud',30)}</div>
      <p class="eyebrow">ACCESO INTERNO</p>
      <h1>Centro de operaciones</h1>
      <p class="muted login-copy">Entre con el mismo usuario que utiliza en Sublichat.</p>
      <form id="loginForm" class="login-form">
        <label>Usuario<input id="loginUser" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="sublicuentas"></label>
        <label>Clave<div class="password-input"><input id="loginPassword" type="password" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="••••••••"><button type="button" id="toggleLoginPassword">Mostrar</button></div></label>
        <button class="primary" type="submit" ${state.loading?'disabled':''}>${state.loading?'Ingresando…':'Iniciar sesión'}</button>
      </form>
      ${state.errors.login?`<div class="error-box">${icon('alert',18)}<span>${esc(state.errors.login)}</span></div>`:''}
      <p class="version muted">Sublicuentas 1.0 · Android</p>
    </section>
  </main>`;
}

function syncPill() {
  const cfg = state.sync==='online' ? ['sync-ok','Sincronizado'] : state.sync==='syncing' ? ['syncing','Sincronizando'] : state.sync==='partial' ? ['sync-warn','Parcial'] : ['','Listo'];
  return `<span class="sync-pill ${cfg[0]}"><i></i>${cfg[1]}</span>`;
}

function dashboardView() {
  const rows = allRows();
  const summary = dashboardSummary(rows, new Date());
  const available = state.inventory.reduce((sum,item)=>sum + Math.max(0,Number(item?.disponibles || 0)),0);
  const income = state.finances.filter(m=>String(m?.tipo||'').toLowerCase()==='ingreso' && (String(m?.fechaPago||'')===todayISO() || String(m?.fecha||'')===todayDMY())).reduce((sum,m)=>sum+Number(m?.monto||0),0);
  const firstName = String(state.profile?.nombre || state.session?.usuario || 'Sublicuentas').split(/\s+/)[0];
  return `<section class="topbar">
      <div><p class="eyebrow">SUBLICUENTAS</p><h1>Hola, ${esc(firstName)}</h1><div class="top-meta">${syncPill()}<span>${esc(roleLabel(state.session?.role, state.session?.usuario))}</span></div></div>
      <button class="avatar-btn" data-open="perfil">${avatarMarkup()}</button>
    </section>
    <section class="metrics">
      <button class="metric danger-soft" data-renew-filter="hoy"><span>Vence hoy</span><strong>${summary.hoy}</strong></button>
      <button class="metric info-soft" data-renew-filter="proximo"><span>Próximo <small>${summary.proximo.label}</small></span><strong>${summary.proximo.count}</strong></button>
      <button class="metric warn-soft" data-renew-filter="vencidos"><span>Vencidos</span><strong>${summary.vencidos}</strong></button>
      ${cap().finanzas ? `<article class="metric"><span>Cobrado hoy</span><strong class="money-strong">${money(income)}</strong></article>` : ''}
      ${cap().inventario ? `<button class="metric wide" data-open="inventario"><span>Disponibles</span><strong>${available}</strong></button>` : ''}
    </section>
    <section class="panel compact-panel">
      <div class="section-head"><div><p class="eyebrow">OPERACIÓN</p><h2>Acciones rápidas</h2></div><button class="icon-btn" id="refreshData" aria-label="Actualizar datos">${icon('refresh')}</button></div>
      <div class="quick-grid">
        <button data-tab-jump="clientes">${icon('users')}<span>Clientes</span></button>
        ${cap().nuevoCrm?`<button data-tab-jump="nuevo-crm">${icon('add')}<span>Nuevo CRM</span></button>`:''}
        <button data-tab-jump="renovar">${icon('renew')}<span>Renovar</span></button>
        <button id="openWhatsApp" class="${cap().nuevoCrm?'':'quick-wide'}">${icon('phone')}<span>WhatsApp</span></button>
      </div>
    </section>
    ${state.errors.clients?`<div class="error-box">${icon('alert',18)}<span>Clientes: ${esc(state.errors.clients)}</span></div>`:''}`;
}

function currentOperationalRows() {
  return filterOperationalRows(allRows(), {
    query:state.search,
    status:state.clientStatusFilter,
    seller:state.clientSellerFilter,
    platform:state.clientPlatformFilter,
    today:new Date(),
  });
}

function clientFilterCounts() {
  const rows=allRows();
  const base={query:state.search,seller:state.clientSellerFilter,platform:state.clientPlatformFilter,today:new Date()};
  return {
    vigentes:filterOperationalRows(rows,{...base,status:'vigentes'}).length,
    hoy:filterOperationalRows(rows,{...base,status:'hoy'}).length,
    proximos:filterOperationalRows(rows,{...base,status:'proximos'}).length,
    vencidos:filterOperationalRows(rows,{...base,status:'vencidos'}).length,
  };
}

function operationalGroupsForClients() {
  return groupRenewalsByClientDate(currentOperationalRows());
}

function clientsView() {
  if (state.selectedClientId) return clientDetailView();
  const rows=allRows();
  const options=operationalFilterOptions(rows);
  const filtered=currentOperationalRows();
  const groups=groupRenewalsByClientDate(filtered);
  const limit=Number(state.clientLimit)||100;
  const visible=groups.slice(0,limit);
  const uniqueClients=new Set(filtered.map(r=>r.clienteId||`${r.nombre}|${r.telefono}`)).size;
  const counts=clientFilterCounts();
  const statusTabs=[['vigentes','Vigentes',counts.vigentes],['hoy','Hoy',counts.hoy],['proximos','Próximos',counts.proximos],['vencidos','Vencidos',counts.vencidos]];
  return `<section class="page-head"><div><p class="eyebrow">CRM</p><h1>Clientes</h1><p class="muted">Cartera, cobros y renovaciones</p></div><button class="icon-btn" id="refreshData">${icon('refresh')}</button></section>
    ${cap().nuevoCrm?`<button class="primary clients-crm-cta" data-tab-jump="nuevo-crm">${icon('add',18)} <span>Nuevo CRM · Registrar venta</span></button>`:''}
    <div class="search-box">${icon('search',20)}<input id="clientSearch" value="${esc(state.search)}" placeholder="Buscar cliente, teléfono o plataforma"></div>
    <div class="client-status-tabs">${statusTabs.map(([id,label,count])=>`<button data-client-status="${id}" class="${state.clientStatusFilter===id?'active':''}"><span>${label}</span><b>${count}</b></button>`).join('')}</div>
    <section class="client-filter-panel panel-soft">
      <label><span>Plataformas</span><select id="clientPlatformFilter"><option value="">Todas</option>${options.platforms.map(v=>`<option value="${esc(v)}" ${state.clientPlatformFilter===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
      <label><span>Vendedores</span><select id="clientSellerFilter"><option value="">Todos</option>${options.sellers.map(v=>`<option value="${esc(v)}" ${state.clientSellerFilter===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
      <label><span>Mostrar</span><select id="clientLimit"><option value="50" ${limit===50?'selected':''}>50</option><option value="100" ${limit===100?'selected':''}>100</option><option value="250" ${limit===250?'selected':''}>250</option><option value="1000" ${limit===1000?'selected':''}>Todos</option></select></label>
      <button class="secondary client-today-btn" id="clientCobrosHoy">${icon('calendar',17)} Cobros de hoy</button>
    </section>
    <p class="client-result-count">Mostrando <b>${visible.length}</b> de <b>${groups.length}</b> registros · <b>${uniqueClients}</b> clientes</p>
    <section class="client-ops-list">
      ${visible.length ? visible.map(g=>{
        const first=g.servicios[0]||g.serviciosCliente[0];
        const key=rowKey(first);
        const client=state.clients.find(c=>String(c.id)===String(first?.clienteId));
        const plats=g.servicios.map(s=>s.plataforma).filter(Boolean);
        return `<article class="client-op-card">
          <button class="client-op-main" data-client-id="${esc(first?.clienteId||'')}"><div class="client-avatar">${esc(String(g.nombre||'C').slice(0,2).toUpperCase())}</div><div class="grow"><strong>${esc(g.nombre)}</strong><span>${esc(first?.telefono||client?.telefono||'Sin teléfono')}</span><small>${plats.map(p=>esc(p)).join(' · ')}</small></div><span class="client-due ${state.clientStatusFilter}">${esc(g.fechaRenovacion||'Sin fecha')}</span></button>
          <div class="client-op-meta"><span>${money(g.total)}</span><span>${esc(first?.vendedor||'Sin vendedor')}</span></div>
          <div class="client-op-actions"><button class="renew-action" data-renew-group="${esc(g.key)}">${icon('renew',17)} Renovar</button><button class="wa-action" data-client-whatsapp="${esc(key)}">${icon('phone',18)} WhatsApp</button><button class="more-action" data-client-actions="${esc(key)}" aria-label="Acciones">${icon('more',20)}</button></div>
        </article>`;
      }).join('') : `<div class="empty-state">${icon('search',28)}<strong>Sin resultados</strong><span>Revise búsqueda, vendedor, plataforma o estado.</span></div>`}
    </section>`;
}

function clientDetailView() {
  const client = state.clients.find(c=>c.id===state.selectedClientId);
  if (!client) { state.selectedClientId=''; return clientsView(); }
  const rows = allRows().filter(r=>r.clienteId===client.id);
  return `<section class="page-head detail-head"><button class="back-btn" id="backClients">${icon('back')}</button><div class="grow"><p class="eyebrow">FICHA</p><h1>${esc(clientName(client))}</h1><p class="muted">${esc(client.telefono || 'Sin teléfono')}</p></div></section>
    <section class="panel identity-card"><div>${icon('user',22)}</div><div><span>ID cliente</span><strong>${esc(client.id)}</strong></div></section>
    ${cap().nuevoCrm?`<button class="secondary full client-add-service" data-client-add-service="${esc(rows[0]?rowKey(rows[0]):client.id)}">➕ Agregar otra cuenta al mismo cliente</button>`:''}
    <section class="list-stack service-list">
      ${rows.length ? rows.map(row=>`<article class="service-card"><div class="service-top"><div><strong>${esc(row.plataforma)}</strong><span>${esc(row.correo || 'Sin correo')}</span><small>${esc(row.vendedor||'Sin vendedor')}</small></div><span class="date-chip">${esc(row.fechaRenovacion || 'Sin fecha')}</span></div><div class="service-bottom"><span>${row.precio?money(row.precio):'Sin precio'}${row.compraId?` · ${esc(row.compraId.slice(0,10))}`:''}</span></div><div class="service-actions"><button class="mini-primary" data-renew-key="${esc(rowKey(row))}">${icon('renew',16)} Renovar</button><button class="wa-action mini" data-client-whatsapp="${esc(rowKey(row))}">${icon('phone',17)} WhatsApp</button><button class="secondary mini" data-client-actions="${esc(rowKey(row))}">⋮ Acciones</button></div></article>`).join('') : `<div class="empty-state"><strong>Sin servicios</strong><span>Esta ficha no tiene servicios activos.</span></div>`}
    </section>`;
}

function crmDefaultDraft() {
  const vendedor=sellerForSession(state.session?.role || '', state.session?.usuario || '');
  return {
    clienteId:'', forzarNuevoServicio:false, servicioIndex:null, plataformaOriginal:'', correoOriginal:'',
    nombrePerfil:'', telefono:'', vendedor, vendedorTelefono:sellerPhone(vendedor),
    beneficiarioTipo:'titular', beneficiarioNombre:'', plataforma:'netflix', precio:String(crmDefaultPrice('netflix',vendedor)||''), fechaRenovacion:datePlusDaysDMY(30),
    mesesContratados:1, visibilidadModo:'plataforma', visCorreo:true, visClave:true, visPin:true,
    perfiles:[{nombre:'',correo:'',clave:'',pinPerfil:'',dispositivo:'',esRoku:false}],
    fichaTexto:'', tvDispositivos:'1', iptvProveedor:'', iptvPantallas:'1', iptvLista:'', iptvHora:'', oleadaDispositivos:'1', stellaDispositivos:'1',
    savedClientId:'', savedLink:'', savedBeneficiarioKey:'titular',
  };
}

function crmDraft() { return state.crmDraft || (state.crmDraft=crmDefaultDraft()); }
function crmPlatformLabel(value='') { return CRM_PLATFORMS.find(([v])=>v===value)?.[1] || value || 'Servicio'; }
function crmIsTvDigital(value='') { return ['stellatv','oleada','latintv','liontv','evoutouch'].includes(crmBasePlatform(value)); }

function readCrmDraftFromDom() {
  const d={...crmDraft()};
  const val=id=>String(document.querySelector(`#${id}`)?.value ?? '').trim();
  d.nombrePerfil=val('crmNombre'); d.telefono=val('crmTelefono'); d.plataforma=val('crmPlataforma');
  const sellerSel=val('crmVendedor'); d.vendedor=sellerSel==='__nuevo__'?val('crmVendedorNuevo'):sellerSel;
  d.vendedorTelefono=val('crmVendedorTelefono'); d.beneficiarioTipo=val('crmBeneficiarioTipo')==='tercero'?'tercero':'titular'; d.beneficiarioNombre=val('crmBeneficiarioNombre');
  d.precio=val('crmPrecio'); d.fechaRenovacion=val('crmFecha'); d.mesesContratados=Number(val('crmMeses')||1)||1;
  d.visibilidadModo=val('crmVisibilidadUrl')||'plataforma';
  d.visCorreo=document.querySelector('#crmVisCorreo')?.checked ?? true; d.visClave=document.querySelector('#crmVisClave')?.checked ?? true; d.visPin=document.querySelector('#crmVisPin')?.checked ?? true;
  const fichaEl=document.querySelector('#crmFichaTexto'); d.fichaTexto=fichaEl?.dataset.auto==='1' ? '' : String(fichaEl?.value ?? d.fichaTexto ?? '');
  d.tvDispositivos=val('crmTvDispositivos') || d.tvDispositivos || '1';
  d.iptvProveedor=val('crmIptvProveedor'); d.iptvPantallas=d.tvDispositivos; d.iptvLista=val('crmIptvLista'); d.iptvHora=val('crmIptvHora');
  d.oleadaDispositivos=d.tvDispositivos; d.stellaDispositivos=d.tvDispositivos;
  d.perfiles=[...document.querySelectorAll('[data-crm-profile]')].map((node,index)=>({
    perfilId:String(node.dataset.perfilId||d.perfiles?.[index]?.perfilId||''),
    nombre:String(node.querySelector('[data-p-name]')?.value || '').trim() || d.nombrePerfil,
    correo:String(node.querySelector('[data-p-email]')?.value || '').trim(),
    clave:String(node.querySelector('[data-p-password]')?.value || ''),
    pinPerfil:String(node.querySelector('[data-p-pin]')?.value || '').trim(),
    dispositivo:String(node.querySelector('[data-p-device]')?.value || '').trim(),
    esRoku:String(node.querySelector('[data-p-roku]')?.value || 'no')==='si',
  }));
  if(!d.perfiles.length)d.perfiles=[{nombre:d.nombrePerfil,correo:'',clave:'',pinPerfil:'',dispositivo:'',esRoku:false}];
  return d;
}

function crmFichaFromDraft(d=crmDraft()) {
  return buildTraditionalFicha({
    nombrePerfil:d.nombrePerfil, plataforma:crmPlatformLabel(d.plataforma), plataformaRaw:d.plataforma, fechaRenovacion:d.fechaRenovacion,
    perfiles:d.perfiles, vendedor:d.vendedor, vendedorTelefono:d.vendedorTelefono, telefono:d.telefono, precio:Number(d.precio||0), mesesContratados:Number(d.mesesContratados||1), iptvProveedor:d.iptvProveedor, iptvPantallas:Number(d.tvDispositivos||d.iptvPantallas||1), iptvLista:d.iptvLista, iptvHora:d.iptvHora, oleadaDispositivos:Number(d.tvDispositivos||d.oleadaDispositivos||1), stellaDispositivos:Number(d.tvDispositivos||d.stellaDispositivos||1),
  });
}

function crmProfileBlock(profile,index,rules) {
  const p=profile||{};
  return `<section class="crm-profile panel-soft" data-crm-profile="${index}" data-perfil-id="${esc(p.perfilId||'')}">
    <div class="crm-profile-head"><strong>Perfil ${index+1}</strong>${index>0?`<button type="button" class="text-danger" data-remove-crm-profile="${index}">Quitar</button>`:''}</div>
    <label class="crm-field"><span>Perfil ${index+1} · Nombre de la persona/perfil</span><input data-p-name value="${esc(p.nombre||p.perfil||'')}" placeholder="Ej. María"></label>
    <label class="crm-field" ${rules.email?'':'hidden'}><span>Perfil ${index+1} · Correo / usuario</span><input data-p-email value="${esc(p.correo||'')}" autocomplete="off" autocapitalize="none" placeholder="correo@ejemplo.com"></label>
    <label class="crm-field" ${rules.password?'':'hidden'}><span>Perfil ${index+1} · Clave / serial / contraseña</span><input data-p-password value="${esc(p.clave||'')}" autocomplete="off" autocapitalize="none" placeholder="Clave de acceso"></label>
    <label class="crm-field" ${rules.pin?'':'hidden'}><span>Perfil ${index+1} · PIN individual</span><input data-p-pin value="${esc(p.pinPerfil||'')}" inputmode="numeric" placeholder="0000"></label>
    <label class="crm-field" ${rules.device?'':'hidden'}><span>📺📱 Perfil ${index+1} · ¿Dónde va a usar este perfil?</span><select data-p-device><option value="">Pregunte al cliente…</option><option value="tv" ${p.dispositivo==='tv'?'selected':''}>TV</option><option value="cel" ${p.dispositivo==='cel'?'selected':''}>Celular</option></select></label>
    <label class="crm-field" ${rules.device?'':'hidden'}><span>Perfil ${index+1} · ¿El TV es Roku?</span><select data-p-roku><option value="no">No es Roku</option><option value="si" ${p.esRoku?'selected':''}>Sí, es Roku</option></select></label>
  </section>`;
}

function crmView() {
  if (!cap().nuevoCrm) return `<div class="empty-state page-empty">${icon('alert',30)}<strong>Nuevo CRM no disponible</strong><span>Su usuario no tiene permiso para registrar ventas.</span></div>`;
  const d=crmDraft(); const rules=crmRules(d.plataforma); const day=parseDateDMY(d.fechaRenovacion)?.getDate() || '';
  const sellerHit=CRM_SELLERS.includes(d.vendedor)?d.vendedor:'__nuevo__';
  const tvDigital=crmIsTvDigital(d.plataforma);
  const tvDevices=crmAllowedDevices(d.plataforma);
  const tvMonths=crmAllowedMonths(d.plataforma);
  const ficha=d.fichaTexto || crmFichaFromDraft(d);
  return `<section class="page-head"><div><p class="eyebrow">VENTA NUEVA</p><h1>Nuevo CRM</h1><p class="muted">CRM + ficha WhatsApp · misma operación de Sublichat</p></div></section>
    <form id="crmForm" class="crm-form">
      <section class="panel crm-card">
        <div class="crm-grid">
          <label class="crm-field"><span>Cliente titular</span><input id="crmNombre" value="${esc(d.nombrePerfil)}" autocomplete="name" placeholder="Nombre de quien compra" required></label>
          <label class="crm-field"><span>Teléfono</span><input id="crmTelefono" value="${esc(d.telefono)}" inputmode="tel" autocomplete="tel" placeholder="Ej. 9999-9999" required></label>
          <label class="crm-field"><span>Vendedor responsable de esta cuenta</span><select id="crmVendedor"><option value="">Seleccione vendedor</option>${CRM_SELLERS.map(v=>`<option value="${esc(v)}" ${sellerHit===v?'selected':''}>${esc(v)}</option>`).join('')}<option value="__nuevo__" ${sellerHit==='__nuevo__'?'selected':''}>➕ Agregar vendedor</option></select><small>Cambiarlo transfiere únicamente la cuenta seleccionada.</small></label>
          <label class="crm-field" id="crmVendedorNuevoBox" ${sellerHit==='__nuevo__'?'':'hidden'}><span>Nuevo vendedor</span><input id="crmVendedorNuevo" value="${sellerHit==='__nuevo__'?esc(d.vendedor):''}" placeholder="Escriba el vendedor"></label>
          <label class="crm-field"><span>Número del vendedor / soporte</span><input id="crmVendedorTelefono" value="${esc(d.vendedorTelefono)}" inputmode="tel" placeholder="Solo el número autorizado"></label>
          <label class="crm-field"><span>¿Quién usará este acceso?</span><select id="crmBeneficiarioTipo"><option value="titular" ${d.beneficiarioTipo!=='tercero'?'selected':''}>El cliente titular</option><option value="tercero" ${d.beneficiarioTipo==='tercero'?'selected':''}>Otra persona / tercero</option></select></label>
          <label class="crm-field" id="crmBeneficiarioBox" ${d.beneficiarioTipo==='tercero'?'':'hidden'}><span>Nombre del beneficiario</span><input id="crmBeneficiarioNombre" value="${esc(d.beneficiarioNombre)}" placeholder="Ej. María López"></label>
          <div class="crm-info wide">🔗 Todas las plataformas de este cliente se reunirán en una sola URL permanente, aunque compre o renueve en fechas distintas.</div>
          <label class="crm-field"><span>Plataforma</span><select id="crmPlataforma">${CRM_PLATFORMS.map(([value,label])=>`<option value="${value}" ${d.plataforma===value?'selected':''}>${label}</option>`).join('')}</select></label>
        </div>
        <section class="crm-url-box">
          <strong>👁️ Datos visibles en la ficha URL</strong><small>Se configura solo para este servicio. No borra datos del CRM ni cambia la ficha tradicional.</small>
          <select id="crmVisibilidadUrl"><option value="plataforma" ${d.visibilidadModo==='plataforma'?'selected':''}>Según plataforma y dispositivo (actual)</option><option value="todos" ${d.visibilidadModo==='todos'?'selected':''}>Todos los datos guardados</option><option value="correo_clave" ${d.visibilidadModo==='correo_clave'?'selected':''}>Correo y clave</option><option value="solo_correo" ${d.visibilidadModo==='solo_correo'?'selected':''}>Solo correo / usuario</option><option value="solo_pin" ${d.visibilidadModo==='solo_pin'?'selected':''}>Solo PIN</option><option value="personalizado" ${d.visibilidadModo==='personalizado'?'selected':''}>Personalizado</option></select>
          <div class="crm-url-custom" id="crmVisCustom" ${d.visibilidadModo==='personalizado'?'':'hidden'}><label><input id="crmVisCorreo" type="checkbox" ${d.visCorreo?'checked':''}> Correo</label><label><input id="crmVisClave" type="checkbox" ${d.visClave?'checked':''}> Clave</label><label><input id="crmVisPin" type="checkbox" ${d.visPin?'checked':''}> PIN</label></div>
        </section>
        <div class="crm-grid crm-sale-meta">
          <label class="crm-field"><span>Precio Lps.</span><input id="crmPrecio" value="${esc(d.precio)}" inputmode="decimal" placeholder="130" required></label>
          <label class="crm-field"><span>Fecha de renovación</span><input id="crmFecha" value="${esc(d.fechaRenovacion)}" inputmode="numeric" placeholder="00/00/0000" required></label>
          <label class="crm-field"><span>Día de cada mes</span><input id="crmDiaMes" value="${esc(day)}" readonly></label>
          <label class="crm-field"><span>Meses contratados</span>${tvMonths.length?`<select id="crmMeses">${tvMonths.map(n=>`<option value="${n}" ${Number(d.mesesContratados)===n?'selected':''}>${n} mes${n===1?'':'es'}</option>`).join('')}</select>`:`<input id="crmMeses" value="${esc(d.mesesContratados)}" type="number" min="1" max="24">`}</label>
        </div>
        <section id="crmTvDigitalBox" ${tvDigital?'':'hidden'} class="panel-soft crm-tv-box"><strong>TV Digital / IPTV</strong><div class="crm-grid"><label class="crm-field"><span>Dispositivos autorizados</span><select id="crmTvDispositivos">${(tvDevices.length?tvDevices:[1]).map(n=>`<option value="${n}" ${Number(d.tvDispositivos||1)===n?'selected':''}>${n} dispositivo${n===1?'':'s'}</option>`).join('')}</select></label><label class="crm-field"><span>Proveedor / lista</span><input id="crmIptvProveedor" value="${esc(d.iptvProveedor)}" placeholder="Proveedor si aplica"></label><label class="crm-field"><span>Lista / servidor</span><input id="crmIptvLista" value="${esc(d.iptvLista)}" placeholder="Opcional"></label><label class="crm-field"><span>Hora / nota</span><input id="crmIptvHora" value="${esc(d.iptvHora)}" placeholder="Opcional"></label></div></section>
        <section class="crm-profiles-box"><div class="crm-profile-summary"><div><strong>Perfiles incluidos en esta compra</strong><small>Use esta opción para promociones 2x1 o varios perfiles de la misma app. Un solo precio y una sola renovación.</small></div><b>${d.perfiles.length} perfil${d.perfiles.length===1?'':'es'}</b></div>${d.perfiles.map((p,i)=>crmProfileBlock(p,i,rules)).join('')}<button type="button" class="secondary full" id="crmAddProfile">➕ Otro perfil/cuenta a esta compra (2x1)</button></section>
        <label class="crm-field crm-ficha-preview"><span>Ficha para grupo WhatsApp / respaldo</span><textarea id="crmFichaTexto" rows="10" data-auto="${d.fichaTexto?'0':'1'}">${esc(ficha)}</textarea></label>
        ${d.savedLink?(()=>{const count=urlDeliveryVariantCount();const variant=Math.max(0,Math.min(count-1,Number(state.crmUrlVariant)||0));const beneficiary=d.beneficiarioTipo==='tercero'?(d.beneficiarioNombre||d.nombrePerfil):d.nombrePerfil;const urlMsg=buildUrlDeliveryMessage({nombre:beneficiary,servicio:crmPlatformLabel(d.plataforma),link:d.savedLink,variante:variant});return `<section class="crm-link-box"><strong>🔗 Enlace para el cliente</strong><div class="crm-link-row"><input value="${esc(d.savedLink)}" readonly><button type="button" class="secondary" id="crmCopyLink">📋 Enlace</button></div><div class="crm-url-variants"><span>💬 Elija una de las ${count} variantes para entregar la URL</span><div class="crm-variant-tabs">${Array.from({length:count},(_,i)=>`<button type="button" data-crm-url-variant="${i}" class="${i===variant?'active':''}">Variante ${i+1}</button>`).join('')}</div><textarea id="crmUrlVariantPreview" rows="9" readonly>${esc(urlMsg)}</textarea><div class="crm-variant-actions"><button type="button" class="secondary" id="crmCopyUrlVariant">📋 Copiar variante</button><button type="button" class="wa-blue" id="crmOpenUrlVariant">💬 Abrir WhatsApp</button></div></div></section>`})():''}
        <div class="crm-actions-grid"><button type="button" class="secondary" id="crmNewFicha">🆕 Ficha nueva</button><button type="button" class="secondary" id="crmAddService">➕ Agregar otra cuenta</button><button class="primary" id="crmSubmit" type="submit">💾 Guardar CRM</button><button type="button" class="secondary" id="crmCopyFicha">📋 Copiar</button></div>
        <div class="crm-delivery-title">¿Cómo desea entregarlo por WhatsApp?</div><p class="muted note">Las dos opciones guardan primero el CRM. Nada se envía automáticamente.</p>
        <div class="crm-delivery-actions"><button type="button" class="wa-green" id="crmDeliverTraditional">💬 Entregar ficha de la cuenta</button><button type="button" class="wa-blue" id="crmDeliverUrl">🔗 Entregar ficha URL</button></div>
      </section>
    </form>`;
}

function syncCrmRequirementVisibility() {
  const select=document.querySelector('#crmPlataforma'); if(!select)return;
  const rules=crmRules(select.value);
  document.querySelectorAll('[data-crm-profile]').forEach(node=>{
    const field=(sel,show)=>{const input=node.querySelector(sel);const label=input?.closest('.crm-field');if(label)label.hidden=!show;};
    field('[data-p-email]',rules.email); field('[data-p-password]',rules.password); field('[data-p-pin]',rules.pin); field('[data-p-device]',rules.device); field('[data-p-roku]',rules.device);
  });
  const tv=document.querySelector('#crmTvDigitalBox'); if(tv)tv.hidden=!crmIsTvDigital(select.value);
}

function renewalGroups() {
  const groups=groupRenewalsByClientDate(allRows());
  const base=new Date();base.setHours(12,0,0,0);
  const parsed=groups.map(g=>({g,d:parseDateDMY(g.fechaRenovacion)})).filter(x=>x.d);
  if(state.renewFilter==='hoy')return parsed.filter(x=>Math.round((x.d-base)/86400000)===0).map(x=>x.g);
  if(state.renewFilter==='vencidos')return parsed.filter(x=>x.d<base).sort((a,b)=>a.d-b.d).map(x=>x.g);
  const future=parsed.filter(x=>x.d>base).sort((a,b)=>a.d-b.d); if(!future.length)return[];
  const first=future[0].d.toDateString();return future.filter(x=>x.d.toDateString()===first).map(x=>x.g);
}

function renewView() {
  const groups=renewalGroups();
  return `<section class="page-head"><div><p class="eyebrow">RENOVACIONES</p><h1>Renovar</h1><p class="muted">Cobro + gestión de servicios + renovación conectada a Sublichat</p></div><button class="icon-btn" id="refreshData">${icon('refresh')}</button></section>
    <div class="segmented"><button data-filter="hoy" class="${state.renewFilter==='hoy'?'active':''}">Hoy</button><button data-filter="proximo" class="${state.renewFilter==='proximo'?'active':''}">Próximo</button><button data-filter="vencidos" class="${state.renewFilter==='vencidos'?'active':''}">Vencidos</button></div>
    <section class="list-stack renew-list">${groups.length?groups.slice(0,120).map(g=>`<button class="renew-row" data-renew-group="${esc(g.key)}"><div class="renew-date">${formatDateShort(g.fechaRenovacion)}</div><div class="grow"><strong>${esc(g.nombre)}</strong><span>${esc(g.servicios.map(s=>s.plataforma).join(' + '))} · ${money(g.total)}</span><small>${g.servicios.length} servicio${g.servicios.length===1?'':'s'} en esta fecha · ${g.serviciosCliente.length} total</small></div>${icon('chevron',18)}</button>`).join(''):`<div class="empty-state">${icon('calendar',30)}<strong>Todo al día</strong><span>No hay registros en esta sección.</span></div>`}</section>`;
}

function catalogView() {
  if (!cap().catalogo) return `<div class="empty-state page-empty">${icon('catalog',34)}<strong>Catálogo no disponible</strong><span>Su usuario conserva los mismos permisos de Sublichat.</span></div>`;
  if (!state.catalog && !state.errors.catalog) return `<div class="loading-card"><span class="spinner"></span><strong>Cargando catálogo…</strong></div>`;
  if (state.errors.catalog) return `<div class="error-box">${icon('alert',18)}<span>${esc(state.errors.catalog)}</span></div>`;
  const products=(state.catalog?.products || []).filter(p=>p.active!==false);
  return `<section class="page-head"><div><p class="eyebrow">CATÁLOGO RELOJES</p><h1>Catálogo</h1><p class="muted">${products.length} productos activos</p></div></section>
    <section class="catalog-grid">${products.slice(0,100).map(product=>{
      const plans=Array.isArray(product.plans)?product.plans.filter(p=>p.active!==false):[];
      const price=plans.map(p=>Number(p.price)).filter(Number.isFinite).sort((a,b)=>a-b)[0];
      return `<article class="product-card">${product.imageUrl?`<img src="${esc(product.imageUrl)}" alt="">`:`<div class="product-icon">${icon('catalog',24)}</div>`}<div><strong>${esc(product.name||'Producto')}</strong><span>${esc(product.categoryId||'')}</span>${Number.isFinite(price)?`<b>${money(price)}</b>`:''}</div></article>`;
    }).join('')}</section>`;
}

function inventoryView() {
  const rows=state.inventory.slice().sort((a,b)=>String(a.plataforma||'').localeCompare(String(b.plataforma||'')));
  return subPage('Inventario', 'Disponibilidad de cuentas', `${rows.length?`<section class="list-stack">${rows.slice(0,160).map(item=>`<article class="inventory-row"><div><strong>${esc(item.plataforma||'Cuenta')}</strong><span>${esc(item.correo||'')}</span></div><div class="stock"><b>${Number(item.disponibles||0)}</b><small>libres</small></div></article>`).join('')}</section>`:`<div class="empty-state"><strong>Sin cuentas</strong><span>No se encontraron cuentas de inventario.</span></div>`}`);
}

function ticketsView() {
  if (!state.tickets && !state.errors.tickets) return subPage('Tickets','Bandeja interna','<div class="loading-card"><span class="spinner"></span><strong>Cargando tickets…</strong></div>');
  const items=state.tickets || [];
  return subPage('Tickets','Bandeja interna', state.errors.tickets?`<div class="error-box">${icon('alert',18)}<span>${esc(state.errors.tickets)}</span></div>`:`<section class="list-stack">${items.slice(0,100).map(t=>`<article class="ticket-row"><div class="ticket-num">#${esc(t.numero||'—')}</div><div class="grow"><strong>${esc(t.titulo||'Ticket')}</strong><span>${esc(t.estado||'abierto')} · ${esc(t.creadoPor||'')}</span></div></article>`).join('')||'<div class="empty-state"><strong>Sin tickets</strong><span>No hay tickets en la bandeja.</span></div>'}</section>`);
}

function controlMasterView() {
  if (!state.controlInventory && !state.errors.controlMaster) return subPage('Control Maestro','Cuentas y asignaciones','<div class="loading-card"><span class="spinner"></span><strong>Cargando cuentas…</strong></div>');
  if (state.errors.controlMaster) return subPage('Control Maestro','Cuentas y asignaciones',`<div class="error-box">${icon('alert',18)}<span>${esc(state.errors.controlMaster)}</span></div>`);
  const rows=(state.controlInventory || []).slice().sort((a,b)=>String(a.plataforma||'').localeCompare(String(b.plataforma||'')) || String(a.correo||'').localeCompare(String(b.correo||'')));
  const total=rows.length;
  const libres=rows.reduce((sum,item)=>sum+Math.max(0,Number(item.disponibles||0)),0);
  const ocupados=rows.reduce((sum,item)=>sum+Math.max(0,Number(item.ocupados ?? (Array.isArray(item.clientes)?item.clientes.length:0))),0);
  const content=`<section class="finance-grid control-summary"><article><span>Cuentas</span><strong>${total}</strong></article><article><span>Libres</span><strong>${libres}</strong></article><article class="wide"><span>Asignaciones</span><strong>${ocupados}</strong></article></section>
    <section class="list-stack control-list">${rows.slice(0,180).map(item=>{
      const clients=Array.isArray(item.clientes)?item.clientes:[];
      const used=Number(item.ocupados ?? clients.length) || 0;
      const capacity=Number(item.capacidad || (used + Number(item.disponibles||0))) || 0;
      return `<article class="inventory-row control-row"><div class="grow"><strong>${esc(item.plataforma||'Cuenta')}</strong><span>${esc(item.correo||'Sin correo')}</span><small>${used}/${capacity || '—'} ocupados · ${clients.length} asignados</small></div><div class="stock"><b>${Math.max(0,Number(item.disponibles||0))}</b><small>libres</small></div></article>`;
    }).join('') || '<div class="empty-state"><strong>Sin cuentas</strong><span>No hay cuentas disponibles en Control Maestro.</span></div>'}</section>`;
  return subPage('Control Maestro','Cuentas y asignaciones',content);
}

function rafflesView() {
  if (!state.raffles && !state.errors.raffles) return subPage('Sorteos','Premios y boletos','<div class="loading-card"><span class="spinner"></span><strong>Cargando sorteos…</strong></div>');
  if (state.errors.raffles) return subPage('Sorteos','Premios y boletos',`<div class="error-box">${icon('alert',18)}<span>${esc(state.errors.raffles)}</span></div>`);
  const draws=Array.isArray(state.raffles?.sorteos)?state.raffles.sorteos:[];
  const prizes=Array.isArray(state.raffles?.premios)?state.raffles.premios:[];
  const active=draws.filter(d=>String(d.estado||'').toLowerCase()==='activo').length;
  const tickets=draws.reduce((sum,d)=>sum+Math.max(0,Number(d.totalBoletos||0)),0);
  const content=`<section class="finance-grid raffle-summary"><article><span>Activos</span><strong>${active}</strong></article><article><span>Premios</span><strong>${prizes.length}</strong></article><article class="wide"><span>Boletos visibles</span><strong>${tickets}</strong></article></section>
    <section class="list-stack raffle-list">${draws.slice(0,100).map(draw=>{
      const winner=draw?.ganador?.clienteNombre || draw?.ganador?.nombre || '';
      const end=draw.fechaFin ? new Date(draw.fechaFin) : null;
      const endLabel=end && !Number.isNaN(end.getTime()) ? end.toLocaleDateString('es-HN',{day:'2-digit',month:'2-digit',year:'numeric'}) : 'Sin fecha';
      return `<article class="service-card raffle-card"><div class="service-top"><div><strong>${esc(draw.titulo||'Sorteo')}</strong><span>${esc(draw.categoria||'general')} · termina ${esc(endLabel)}</span></div><span class="date-chip raffle-state">${esc(draw.estado||'borrador')}</span></div><div class="service-bottom"><span>${Number(draw.totalBoletos||0)} boletos</span><strong>${winner?`Ganador: ${esc(winner)}`:'Sin ganador'}</strong></div></article>`;
    }).join('') || '<div class="empty-state"><strong>Sin sorteos</strong><span>No hay campañas visibles para este usuario.</span></div>'}</section>`;
  return subPage('Sorteos','Premios y boletos',content);
}

function profileView() {
  const p=state.profile || {};
  return subPage('Perfil','Cuenta y preferencias', `<section class="profile-card"><div class="profile-avatar-large">${avatarMarkup()}</div><h2>${esc(p.nombre || state.session?.usuario || 'Sublicuentas')}</h2><p>${esc(roleLabel(state.session?.role, state.session?.usuario))}</p>${p.telefono?`<span>${esc(p.telefono)}</span>`:''}</section>
    <section class="panel settings-panel"><label class="theme-row"><span><strong>Tema</strong><small>Claro, oscuro o sistema</small></span><select id="themeSelect"><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label><div class="setting-line"><span><strong>Versión</strong><small>Android interno</small></span><b>1.0 · build ${esc(BUILD_NUMBER)}</b></div><div class="setting-line"><span><strong>Paquete</strong><small>Identidad Android</small></span><b>com.sublicuentas.app</b></div></section>
    <button class="danger-button" id="logoutBtn">${icon('logout',20)} Cerrar sesión</button>`);
}

function financeView() {
  const today=state.finances.filter(m=>(String(m.fechaPago||'')===todayISO() || String(m.fecha||'')===todayDMY()));
  const ingresos=today.filter(m=>String(m.tipo||'').toLowerCase()==='ingreso').reduce((s,m)=>s+Number(m.monto||0),0);
  const egresos=today.filter(m=>String(m.tipo||'').toLowerCase()==='egreso').reduce((s,m)=>s+Number(m.monto||0),0);
  return subPage('Finanzas','Resumen de hoy',`<section class="finance-grid"><article><span>Ingresos</span><strong>${money(ingresos)}</strong></article><article><span>Egresos</span><strong>${money(egresos)}</strong></article><article class="wide"><span>Neto</span><strong>${money(ingresos-egresos)}</strong></article></section><p class="muted note">Los movimientos se leen de la misma colección financiera de Sublichat.</p>`);
}

function subPage(title, subtitle, content) {
  return `<section class="page-head detail-head"><button class="back-btn" id="backMore">${icon('back')}</button><div><p class="eyebrow">SUBLICUENTAS</p><h1>${esc(title)}</h1><p class="muted">${esc(subtitle)}</p></div></section>${content}`;
}

function moreView() {
  if (state.subview==='inventario') return inventoryView();
  if (state.subview==='control-maestro') return controlMasterView();
  if (state.subview==='finanzas') return financeView();
  if (state.subview==='tickets') return ticketsView();
  if (state.subview==='sorteos') return rafflesView();
  if (state.subview==='perfil') return profileView();
  const c=cap();
  const items=[
    c.inventario&&['inventario','Inventario','box'], c.controlMaestro&&['control-maestro','Control Maestro','box'], c.finanzas&&['finanzas','Finanzas','finance'], c.tickets&&['tickets','Tickets','ticket'], c.sorteos&&['sorteos','Sorteos','gift'], c.perfil&&['perfil','Perfil','user']
  ].filter(Boolean);
  return `<section class="page-head"><div><p class="eyebrow">MÓDULOS</p><h1>Más</h1><p class="muted">Herramientas según su permiso</p></div></section><section class="module-grid">${items.map(([id,label,ico])=>`<button data-open="${id}"><span class="module-icon">${icon(ico,24)}</span><strong>${label}</strong>${icon('chevron',18)}</button>`).join('')}</section><section class="panel settings-mini"><div><span>Sesión</span><strong>${esc(roleLabel(state.session?.role, state.session?.usuario))}</strong></div><div><span>Estado</span>${syncPill()}</div></section>`;
}

function currentView() {
  if (state.active==='inicio') return dashboardView();
  if (state.active==='clientes') return clientsView();
  if (state.active==='nuevo-crm') return crmView();
  if (state.active==='renovar') return renewView();
  if (state.active==='catalogo') return catalogView();
  return moreView();
}

function navTabs() {
  const c=cap();
  return [
    ['inicio','Inicio','home'],
    ['clientes','Clientes','users'],
    ...(c.nuevoCrm?[['nuevo-crm','Nuevo CRM','add']]:[]),
    ['renovar','Renovar','renew'],
    ['mas','Más','more'],
  ];
}

function activeRenewGroup() {
  if(!state.renewGroupKey)return null;
  return groupRenewalsByClientDate(allRows()).find(g=>g.key===state.renewGroupKey) || null;
}

function renewalSheet() {
  const g=activeRenewGroup(); if(!g)return '';
  const selected=new Set(state.renewSelection.length?state.renewSelection:g.servicios.map(rowKey));
  const msg=state.renewMessage || buildChargeMessage(g,state.renewMessageVariant);
  return `<div class="sheet-backdrop renew-backdrop" id="closeSheet"><section class="bottom-sheet renewal-full-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()"><div class="sheet-handle"></div>
    <p class="eyebrow">COBRO Y RENOVACIÓN</p><h2>${esc(g.nombre)}</h2><p class="sheet-service">${esc(g.servicios.map(s=>s.plataforma).join(' + '))} · ${esc(g.fechaRenovacion||'—')} · ${money(g.total)}</p>
    <label class="charge-editor"><span>Mensaje de cobro</span><textarea id="renewChargeText" rows="5">${esc(msg)}</textarea></label>
    <div class="charge-actions"><button class="secondary" id="renewAnotherStyle">🎨 Otro estilo</button><button class="secondary" id="renewAiMessage">✨ Mensaje IA corto</button><button class="secondary" id="renewCopyMessage">📋 Copiar</button><button class="wa-green" id="renewOpenWhatsApp">💬 Abrir WhatsApp</button></div>
    <button class="crm-group-btn" id="renewOpenCrm">✅ Ficha CRM + WhatsApp grupo</button>
    <button class="secondary full" id="toggleRenewManage">⚙️ ${state.renewManage?'Ocultar gestión':'Gestionar servicios'}</button>
    ${state.renewManage?`<section class="renew-manage"><p class="muted note">Quite con “No renovó” los servicios que ya no continuarán. Deje marcados los que sí se renovarán.</p>${g.serviciosCliente.map(row=>`<article class="manage-service"><label><input type="checkbox" data-renew-select="${esc(rowKey(row))}" ${selected.has(rowKey(row))?'checked':''}><span><strong>${esc(row.plataforma)}</strong><small>${money(row.precio)} · ${esc(row.fechaRenovacion||'sin fecha')} · ${row.perfiles?.length||1} perfil${(row.perfiles?.length||1)===1?'':'es'} · ${esc(row.vendedor||'Sin vendedor')}</small></span></label><div><button class="secondary mini" data-edit-service="${esc(rowKey(row))}">✏️ Editar</button><button class="danger-btn mini" data-no-renew="${esc(rowKey(row))}">🗑️ No renovó</button></div></article>`).join('')}</section>`:''}
    <section class="renew-options"><p>¿Ya pagó? Elija cuánto renovar:</p><div class="renew-preset-grid"><button data-renew-days="30">+30 días</button><button data-renew-days="31">+31 días</button><button data-renew-days="60">+2 meses</button><button data-renew-days="90">+3 meses</button></div><label class="calendar-renew"><span>📅 Elegir fecha en calendario</span><input id="renewExactDate" type="date"><button class="secondary" id="renewExactApply">Renovar a fecha elegida</button></label></section>
    <div class="sheet-actions"><button class="secondary" id="cancelRenew">Cerrar</button></div>
  </section></div>`;
}

function whatsappSheet() {
  if (!state.whatsappChooser) return '';
  return `<div class="sheet-backdrop" id="closeWhatsAppChooser"><section class="bottom-sheet whatsapp-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()"><div class="sheet-handle"></div><p class="eyebrow">ABRIR WHATSAPP</p><h2>¿Cuál desea usar?</h2><p class="muted note">Seleccione la aplicación que quiere abrir.</p><div class="whatsapp-choices"><button class="whatsapp-choice" data-whatsapp-package="com.whatsapp">${icon('phone')}<span><strong>WhatsApp normal</strong><small>Aplicación personal</small></span></button><button class="whatsapp-choice" data-whatsapp-package="com.whatsapp.w4b">${icon('phone')}<span><strong>WhatsApp Business</strong><small>Aplicación de negocio</small></span></button></div><button class="secondary whatsapp-cancel" id="cancelWhatsApp">Cancelar</button></section></div>`;
}

function normalizeWhatsAppPhone(value='') {
  let digits=String(value||'').replace(/\D/g,'');
  if(!digits)return '';
  if(digits.startsWith('00'))digits=digits.slice(2);
  if(digits.length===8)digits=`504${digits}`;
  return digits;
}
function requestWhatsApp(text='', phone='') { state.whatsappText=String(text||''); state.whatsappPhone=normalizeWhatsAppPhone(phone); state.whatsappChooser=true; render(); }
function requestClientWhatsApp(row) {
  if(!row)return;
  const client=clientById(row.clienteId);
  const phone=String(client?.telefono||row.telefono||'');
  if(!normalizeWhatsAppPhone(phone)){showToast('Este cliente no tiene un teléfono válido.');return;}
  requestWhatsApp('',phone);
}
async function launchWhatsApp(packageName) {
  const allowed = new Set(['com.whatsapp','com.whatsapp.w4b']);
  if (!allowed.has(packageName)) return;
  const text=String(state.whatsappText||'');
  const phone=String(state.whatsappPhone||'');
  state.whatsappChooser=false; state.whatsappText=''; state.whatsappPhone=''; render();
  try {
    await IntentLauncher.startActivityAsync({
      action:ActivityAction.VIEW,
      packageName,
      data:phone?`https://wa.me/${phone}${text?`?text=${encodeURIComponent(text)}`:''}`:`https://wa.me/?text=${encodeURIComponent(text)}`,
    });
  } catch (error) {
    try {
      await IntentLauncher.startActivityAsync({
        action:ActivityAction.VIEW,
        data:phone?`https://wa.me/${phone}${text?`?text=${encodeURIComponent(text)}`:''}`:`https://wa.me/?text=${encodeURIComponent(text)}`,
      });
    } catch (_) {
      showToast(packageName==='com.whatsapp.w4b'?'No se pudo abrir WhatsApp Business.':'No se pudo abrir WhatsApp.');
    }
  }
}

function findRowByKey(key='') { return allRows().find(r=>rowKey(r)===String(key||'')) || null; }
function crmDraftFromRow(row) {
  if(!row)return null;
  const client=state.clients.find(c=>String(c.id)===String(row.clienteId)); const s=row.raw||{};
  const profiles=(Array.isArray(s.perfiles)&&s.perfiles.length?s.perfiles:[{nombre:s.perfil||clientName(client),correo:s.correo||'',clave:s.clave||s.contrasena||s.password||'',pinPerfil:s.pinPerfil||s.pin_perfil||'',dispositivo:s.dispositivo||'',esRoku:!!s.esRoku}]).map(p=>({
    perfilId:String(p.perfilId||p.id||''), nombre:String(p.nombre||p.nombrePerfil||p.perfil||clientName(client)), correo:String(p.correo??s.correo??''), clave:String(p.clave??p.contrasena??p.password??s.clave??''), pinPerfil:String(p.pinPerfil??p.pin_perfil??p.pin??s.pinPerfil??''), dispositivo:String(p.dispositivo??s.dispositivo??''), esRoku:p.esRoku!=null?!!p.esRoku:!!s.esRoku
  }));
  const vis=s.visibilidadUrl||{modo:'plataforma'};
  return {...crmDefaultDraft(),clienteId:String(row.clienteId||''),savedClientId:String(row.clienteId||''),compraId:String(row.compraId||''),forzarNuevoServicio:false,servicioIndex:Number(row.servicioIndex),plataformaOriginal:String(s.plataforma||row.plataforma||''),correoOriginal:String(s.correo||row.correo||''),nombrePerfil:clientName(client),telefono:String(client?.telefono||row.telefono||''),vendedor:String(s.vendedor||client?.vendedor||row.vendedor||crmSeller()),vendedorTelefono:String(s.vendedorTelefono||client?.vendedorTelefono||''),beneficiarioTipo:String(s.beneficiarioTipo||'titular'),beneficiarioNombre:String(s.beneficiarioNombre||''),plataforma:crmBasePlatform(String(s.plataforma||row.plataforma||'netflix')),tvDispositivos:String(crmStoredDeviceCount(String(s.plataforma||row.plataforma||''))),precio:String(s.precio??row.precio??''),fechaRenovacion:String(s.fechaRenovacion||row.fechaRenovacion||''),mesesContratados:Number(s.mesesContratados||1),visibilidadModo:String(vis.modo||'plataforma'),visCorreo:vis.campos?.correo!==false,visClave:vis.campos?.clave!==false,visPin:vis.campos?.pin!==false,perfiles,fichaTexto:String(s.fichaTexto||''),iptvProveedor:String(s.iptvProveedor||''),iptvPantallas:String(s.iptvPantallas||''),iptvLista:String(s.iptvLista||''),iptvHora:String(s.iptvHora||''),oleadaDispositivos:String(s.oleadaDispositivos||''),stellaDispositivos:String(s.stellaDispositivos||'')};
}
function openCrmForRow(row) {
  const draft=crmDraftFromRow(row); if(!draft)return;
  state.crmDraft=draft; state.clientActionKey=''; state.clientActionMode='menu'; state.renewGroupKey=''; state.active='nuevo-crm'; render();
}
function traditionalFichaForRow(row) {
  const draft=crmDraftFromRow(row); if(!draft)return '';
  return String(draft.fichaTexto||'').trim() || crmFichaFromDraft(draft);
}
function addServiceForRow(row) {
  if(!row||!cap().nuevoCrm)return;
  const base=crmDraftFromRow(row); if(!base)return;
  state.crmDraft={...crmDefaultDraft(),clienteId:base.savedClientId||base.clienteId,savedClientId:base.savedClientId||base.clienteId,nombrePerfil:base.nombrePerfil,telefono:base.telefono,vendedor:base.vendedor,vendedorTelefono:base.vendedorTelefono,beneficiarioTipo:'titular',beneficiarioNombre:'',forzarNuevoServicio:true};
  state.clientActionKey=''; state.active='nuevo-crm'; render();
}
function rowBeneficiaryKey(row) {
  const draft=crmDraftFromRow(row); if(!draft)return 'titular';
  return crmBeneficiaryKey(draft);
}
async function openClientUrlVariants(row) {
  if(!row?.clienteId){showToast('Esta ficha no tiene ID de cliente.');return;}
  try {
    const result=await ensureClientLinks(row.clienteId,rowBeneficiaryKey(row));
    if(!result?.ok)throw new Error(result?.error||'No se pudo recuperar el enlace.');
    const relative=String(result.linkPublico||'').trim();
    state.clientActionLink=relative.startsWith('http')?relative:`https://sublichat.capuchino.lat${relative.startsWith('/')?'':'/'}${relative}`;
    state.clientActionMode='url'; state.clientActionUrlVariant=0; render();
  } catch(error) { showToast(error?.message||'No se pudo abrir la ficha URL.'); }
}
function clientActionsSheet() {
  if(!state.clientActionKey)return '';
  const row=findRowByKey(state.clientActionKey); if(!row)return '';
  if(state.clientActionMode==='url'){
    const beneficiary=row.raw?.beneficiarioTipo==='tercero'?(row.raw?.beneficiarioNombre||row.nombre):row.nombre;
    const variant=buildUrlDeliveryMessage({nombre:beneficiary,servicio:row.plataforma,link:state.clientActionLink,variante:state.clientActionUrlVariant});
    return `<div class="sheet-backdrop client-actions-backdrop" id="closeClientActions"><section class="bottom-sheet client-actions-sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><p class="eyebrow">ACCESO URL Y 6 VARIANTES</p><h2>${esc(row.nombre)}</h2><p class="muted note">${esc(row.plataforma)}</p><label class="charge-editor"><span>Enlace permanente</span><textarea rows="2" readonly>${esc(state.clientActionLink)}</textarea></label><div class="url-variant-grid">${Array.from({length:urlDeliveryVariantCount()},(_,i)=>`<button data-client-url-variant="${i}" class="${state.clientActionUrlVariant===i?'active':''}">Variante ${i+1}</button>`).join('')}</div><label class="charge-editor"><span>Mensaje para el cliente</span><textarea id="clientUrlMessage" rows="7">${esc(variant)}</textarea></label><div class="charge-actions"><button class="secondary" id="clientCopyUrlMessage">📋 Copiar</button><button class="wa-green" id="clientOpenUrlWhatsApp">💬 Abrir WhatsApp</button></div><div class="sheet-actions"><button class="secondary" id="clientActionBack">Volver</button><button class="secondary" id="closeClientActionsBtn">Cerrar</button></div></section></div>`;
  }
  return `<div class="sheet-backdrop client-actions-backdrop" id="closeClientActions"><section class="bottom-sheet client-actions-sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><p class="eyebrow">ACCIONES DEL CLIENTE</p><h2>${esc(row.nombre)}</h2><p class="sheet-service">${esc(row.plataforma)} · ${esc(row.fechaRenovacion||'Sin fecha')} · ${money(row.precio)}</p><div class="client-action-menu"><button data-client-action="renew">🔄 Renovar</button><button data-client-action="charge">💬 Mensaje de cobro / WhatsApp</button>${cap().nuevoCrm?`<button data-client-action="add-service">➕ Agregar otra cuenta al mismo cliente</button>`:''}<button data-client-action="edit">✏️ Editar cliente / ficha CRM</button><button data-client-action="ficha">✅ Entregar ficha de la cuenta</button><button data-client-action="url">🔗 Acceso URL y 6 variantes</button><button class="danger-action" data-client-action="no-renew">❌ No renovó</button></div><div class="sheet-actions"><button class="secondary" id="closeClientActionsBtn">Cerrar</button></div></section></div>`;
}

function appShell() {
  const tabs=navTabs();
  return `<main class="app-main">${currentView()}</main><nav class="bottom-nav" style="--nav-count:${tabs.length}">${tabs.map(([id,label,ico])=>`<button data-tab="${id}" class="${state.active===id?'active':''}"><span>${icon(ico,22)}</span><small>${label}</small></button>`).join('')}</nav>${clientActionsSheet()}${renewalSheet()}${whatsappSheet()}${state.toast?`<div class="toast">${esc(state.toast)}</div>`:''}`;
}

function render() {
  applyTheme();
  const root=document.querySelector('#app');
  root.innerHTML=state.session?appShell():loginView();
  bindEvents();
}

function openRenewGroup(key) {
  const g=groupRenewalsByClientDate(allRows()).find(x=>x.key===key); if(!g)return;
  state.renewGroupKey=g.key; state.renewSelection=g.servicios.map(rowKey); state.renewManage=false; state.renewMessageVariant=0; state.renewMessage=buildChargeMessage(g,0); render();
}

function openRenewForRow(row) {
  if(!row)return;
  const g=groupRenewalsByClientDate(allRows()).find(x=>x.clienteId===row.clienteId && x.fechaRenovacion===row.fechaRenovacion && String(x.vendedor||'')===String(row.vendedor||''));
  if(g)openRenewGroup(g.key);
}

function crmBeneficiaryKey(d) {
  if(d.beneficiarioTipo!=='tercero')return 'titular';
  const slug=String(d.beneficiarioNombre||'persona').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'persona';
  return `tercero-${slug}`;
}

function validateCrmDraft(d) {
  const rules=crmRules(d.plataforma);
  if(!d.nombrePerfil||!d.telefono||!d.plataforma) return 'Complete cliente, teléfono y plataforma.';
  if(!d.vendedor) return 'Seleccione el vendedor responsable de esta cuenta.';
  if(d.beneficiarioTipo==='tercero'&&!d.beneficiarioNombre) return 'Escriba el nombre de la persona que usará este acceso.';
  if(!parseDateDMY(d.fechaRenovacion)) return 'Use la fecha en formato DD/MM/AAAA.';
  if(!Number.isFinite(Number(d.precio))||Number(d.precio)<=0)return 'Ingrese el precio de la venta.';
  for(let i=0;i<d.perfiles.length;i+=1){const p=d.perfiles[i]||{};const label=`Perfil ${i+1}`;if(!String(p.nombre||'').trim())return `${label}: falta el nombre de la persona/perfil.`;if(rules.email&&!String(p.correo||'').trim())return `${label}: falta el correo o usuario asignado.`;if(rules.password&&!String(p.clave||'').trim())return `${label}: falta la clave, serial o licencia.`;if(rules.pin&&!String(p.pinPerfil||'').trim())return `${label}: falta el PIN individual.`;if(rules.device&&!['tv','cel'].includes(p.dispositivo))return `${label}: seleccione TV o celular.`;}
  return '';
}

async function saveCrm({delivery='' }={}) {
  const d=readCrmDraftFromDom();
  if(!d.fichaTexto.trim())d.fichaTexto=crmFichaFromDraft(d);
  const error=validateCrmDraft(d); if(error){showToast(error);return null;}
  const button=document.querySelector(delivery==='tradicional'?'#crmDeliverTraditional':delivery==='url'?'#crmDeliverUrl':'#crmSubmit');
  if(button){button.disabled=true;button.dataset.old=button.textContent;button.textContent='Guardando…';}
  try{
    const form={...d,plataforma:crmStoredPlatform(d.plataforma,d.tvDispositivos||d.iptvPantallas||1),precio:Number(d.precio),visibilidadUrl:urlVisibilityFromMode(d.visibilidadModo,{correo:d.visCorreo,clave:d.visClave,pin:d.visPin}),clienteId:d.clienteId||d.savedClientId||'',perfiles:d.perfiles,forzarNuevoServicio:d.forzarNuevoServicio===true,fichaTexto:d.fichaTexto};
    const result=await createCrmSale(form);
    if(!result?.ok||result?.guardadoEnFirebase!==true||!result?.clienteId)throw new Error(result?.error||'Firebase no confirmó la ficha.');
    d.clienteId=String(result.clienteId); d.savedClientId=String(result.clienteId); d.forzarNuevoServicio=false;
    if(result.compraId)d.compraId=String(result.compraId);
    state.crmDraft=d;
    let link='';
    try{const links=await ensureClientLinks(result.clienteId,crmBeneficiaryKey(d));link=String(links?.linkPublico||'');if(link&&link.startsWith('/'))link=`https://sublichat.capuchino.lat${link}`;d.savedLink=link;state.crmDraft=d;}catch(_){}
    await loadCoreData({force:true});
    if(delivery==='tradicional'){requestWhatsApp(d.fichaTexto||crmFichaFromDraft(d));return result;}
    if(delivery==='url'){if(!link){showToast('CRM guardado, pero no se pudo recuperar la URL del cliente.');return result;}const beneficiary=d.beneficiarioTipo==='tercero'?(d.beneficiarioNombre||d.nombrePerfil):d.nombrePerfil;requestWhatsApp(buildUrlDeliveryMessage({nombre:beneficiary,servicio:crmPlatformLabel(d.plataforma),link,variante:state.crmUrlVariant}));return result;}
    state.toast='CRM guardado y confirmado en Firebase.';render();clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>{state.toast='';render();},3200);return result;
  }catch(e){showToast(e?.message||'No se pudo guardar el CRM.');return null;}
  finally{if(button&&document.body.contains(button)){button.disabled=false;button.textContent=button.dataset.old||'Guardar CRM';}}
}

function bindEvents() {
  const login=document.querySelector('#loginForm');
  if(login)login.addEventListener('submit',async e=>{e.preventDefault();const usuario=document.querySelector('#loginUser').value.trim();const clave=document.querySelector('#loginPassword').value;if(!usuario||!clave){state.errors.login='Escriba usuario y clave.';render();return;}state.loading=true;delete state.errors.login;render();try{state.session=await loginUser(usuario,clave);state.loading=false;state.active='inicio';state.crmDraft=null;render();await loadCoreData({force:true});}catch(err){state.loading=false;const base=err.message||'No se pudo iniciar sesión.';state.errors.login=err.status===401?`Acceso no autorizado para ${usuario}. Verifique la clave exacta.`:base;render();}return;});
  document.querySelector('#toggleLoginPassword')?.addEventListener('click',()=>{const input=document.querySelector('#loginPassword'),btn=document.querySelector('#toggleLoginPassword');if(!input||!btn)return;const show=input.type==='password';input.type=show?'text':'password';btn.textContent=show?'Ocultar':'Mostrar';input.focus();});
  document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',async()=>{state.active=btn.dataset.tab;state.subview=null;state.selectedClientId='';if(state.active==='nuevo-crm'&&!state.crmDraft)state.crmDraft=crmDefaultDraft();render();if(state.active==='catalogo')await ensureCatalog();}));
  document.querySelectorAll('[data-tab-jump]').forEach(btn=>btn.addEventListener('click',()=>{state.active=btn.dataset.tabJump;state.subview=null;if(state.active==='nuevo-crm'&&!state.crmDraft)state.crmDraft=crmDefaultDraft();render();}));
  document.querySelectorAll('[data-open]').forEach(btn=>btn.addEventListener('click',async()=>{const id=btn.dataset.open;state.active='mas';state.subview=id;render();if(id==='tickets')await ensureTickets();if(id==='sorteos')await ensureRaffles();if(id==='control-maestro')await ensureControlMaster();}));
  document.querySelectorAll('[data-renew-filter]').forEach(btn=>btn.addEventListener('click',()=>{state.active='renovar';state.renewFilter=btn.dataset.renewFilter;render();}));
  document.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{state.renewFilter=btn.dataset.filter;render();}));
  document.querySelectorAll('[data-client-id]').forEach(btn=>btn.addEventListener('click',()=>{state.selectedClientId=btn.dataset.clientId;render();}));
  document.querySelectorAll('[data-renew-group]').forEach(btn=>btn.addEventListener('click',()=>openRenewGroup(btn.dataset.renewGroup)));
  document.querySelectorAll('[data-renew-key]').forEach(btn=>btn.addEventListener('click',()=>openRenewForRow(findRowByKey(btn.dataset.renewKey))));
  document.querySelectorAll('[data-client-status]').forEach(btn=>btn.addEventListener('click',()=>{state.clientStatusFilter=btn.dataset.clientStatus||'vigentes';render();}));
  document.querySelector('#clientPlatformFilter')?.addEventListener('change',e=>{state.clientPlatformFilter=e.target.value;render();});
  document.querySelector('#clientSellerFilter')?.addEventListener('change',e=>{state.clientSellerFilter=e.target.value;render();});
  document.querySelector('#clientLimit')?.addEventListener('change',e=>{state.clientLimit=Number(e.target.value)||100;render();});
  document.querySelector('#clientCobrosHoy')?.addEventListener('click',()=>{state.clientStatusFilter='hoy';render();});
  document.querySelectorAll('[data-client-whatsapp]').forEach(btn=>btn.addEventListener('click',()=>requestClientWhatsApp(findRowByKey(btn.dataset.clientWhatsapp))));
  document.querySelectorAll('[data-client-actions]').forEach(btn=>btn.addEventListener('click',()=>{state.clientActionKey=btn.dataset.clientActions||'';state.clientActionMode='menu';state.clientActionLink='';render();}));
  document.querySelectorAll('[data-client-add-service]').forEach(btn=>btn.addEventListener('click',()=>{const row=findRowByKey(btn.dataset.clientAddService);if(row)addServiceForRow(row);}));
  document.querySelectorAll('.bottom-sheet').forEach(sheet=>sheet.addEventListener('click',e=>e.stopPropagation()));
  document.querySelector('#closeClientActions')?.addEventListener('click',()=>{state.clientActionKey='';state.clientActionMode='menu';state.clientActionLink='';render();});
  document.querySelector('#closeClientActionsBtn')?.addEventListener('click',()=>{state.clientActionKey='';state.clientActionMode='menu';state.clientActionLink='';render();});
  document.querySelector('#clientActionBack')?.addEventListener('click',()=>{state.clientActionMode='menu';state.clientActionLink='';render();});
  document.querySelectorAll('[data-client-action]').forEach(btn=>btn.addEventListener('click',async()=>{
    const action=btn.dataset.clientAction; const row=findRowByKey(state.clientActionKey); if(!row)return;
    if(action==='renew'||action==='charge'){state.clientActionKey='';state.clientActionMode='menu';openRenewForRow(row);return;}
    if(action==='add-service'){addServiceForRow(row);return;}
    if(action==='edit'){openCrmForRow(row);return;}
    if(action==='ficha'){const text=traditionalFichaForRow(row);state.clientActionKey='';state.clientActionMode='menu';requestWhatsApp(text);return;}
    if(action==='url'){await openClientUrlVariants(row);return;}
    if(action==='no-renew'){const key=state.clientActionKey;state.clientActionKey='';state.clientActionMode='menu';render();await handleNoRenew(key);}
  }));
  document.querySelectorAll('[data-client-url-variant]').forEach(btn=>btn.addEventListener('click',()=>{state.clientActionUrlVariant=Number(btn.dataset.clientUrlVariant)||0;render();}));
  document.querySelector('#clientCopyUrlMessage')?.addEventListener('click',async()=>{const text=String(document.querySelector('#clientUrlMessage')?.value||'');try{await navigator.clipboard.writeText(text);showToast('Mensaje URL copiado.');}catch(_){showToast('No se pudo copiar el mensaje.');}});
  document.querySelector('#clientOpenUrlWhatsApp')?.addEventListener('click',()=>requestWhatsApp(String(document.querySelector('#clientUrlMessage')?.value||'')));

  const crmPlatform=document.querySelector('#crmPlataforma');
  crmPlatform?.addEventListener('change',()=>{state.crmDraft=readCrmDraftFromDom();state.crmDraft.plataforma=crmPlatform.value;state.crmDraft.tvDispositivos=String(crmAllowedDevices(crmPlatform.value)[0]||1);state.crmDraft.mesesContratados=crmAllowedMonths(crmPlatform.value)[0]||1;state.crmDraft.precio=String(crmDefaultPrice(crmStoredPlatform(crmPlatform.value,state.crmDraft.tvDispositivos),state.crmDraft.vendedor)||'');state.crmDraft.fichaTexto='';render();});
  syncCrmRequirementVisibility();
  document.querySelector('#crmVendedor')?.addEventListener('change',e=>{const box=document.querySelector('#crmVendedorNuevoBox');if(box)box.hidden=e.target.value!=='__nuevo__';if(e.target.value!=='__nuevo__'){const phone=sellerPhone(e.target.value);if(phone)document.querySelector('#crmVendedorTelefono').value=phone;const price=document.querySelector('#crmPrecio');if(price){const next=crmDefaultPrice(document.querySelector('#crmPlataforma')?.value||'',e.target.value);if(next)price.value=String(next);}}});
  document.querySelector('#crmBeneficiarioTipo')?.addEventListener('change',e=>{const box=document.querySelector('#crmBeneficiarioBox');if(box)box.hidden=e.target.value!=='tercero';});
  document.querySelector('#crmVisibilidadUrl')?.addEventListener('change',e=>{const box=document.querySelector('#crmVisCustom');if(box)box.hidden=e.target.value!=='personalizado';});
  document.querySelector('#crmTvDispositivos')?.addEventListener('change',e=>{const price=document.querySelector('#crmPrecio');if(price){const plat=document.querySelector('#crmPlataforma')?.value||'';const seller=document.querySelector('#crmVendedor')?.value||'';const next=crmDefaultPrice(crmStoredPlatform(plat,e.target.value),seller);if(next)price.value=String(next);}});
  document.querySelector('#crmFecha')?.addEventListener('input',e=>{const d=parseDateDMY(e.target.value);const day=document.querySelector('#crmDiaMes');if(day)day.value=d?String(d.getDate()).padStart(2,'0'):'';});
  const previewEl=document.querySelector('#crmFichaTexto');
  previewEl?.addEventListener('input',()=>{previewEl.dataset.auto='0';});
  document.querySelectorAll('#crmForm input,#crmForm select').forEach(el=>el.addEventListener('input',()=>{if(!previewEl||previewEl.dataset.auto!=='1')return;const d=readCrmDraftFromDom();previewEl.value=crmFichaFromDraft(d);}));
  document.querySelector('#crmForm')?.addEventListener('submit',async e=>{e.preventDefault();await saveCrm();});
  document.querySelector('#crmAddProfile')?.addEventListener('click',()=>{const d=readCrmDraftFromDom();d.perfiles.push({nombre:d.nombrePerfil,correo:'',clave:'',pinPerfil:'',dispositivo:'',esRoku:false});d.fichaTexto='';state.crmDraft=d;render();});
  document.querySelectorAll('[data-remove-crm-profile]').forEach(btn=>btn.addEventListener('click',()=>{const d=readCrmDraftFromDom();d.perfiles.splice(Number(btn.dataset.removeCrmProfile),1);if(!d.perfiles.length)d.perfiles=[{nombre:d.nombrePerfil,correo:'',clave:'',pinPerfil:'',dispositivo:'',esRoku:false}];d.fichaTexto='';state.crmDraft=d;render();}));
  document.querySelector('#crmNewFicha')?.addEventListener('click',()=>{if(window.confirm('¿Iniciar una ficha nueva? Los datos no guardados se perderán.')){state.crmUrlVariant=0;state.crmDraft=crmDefaultDraft();render();}});
  document.querySelector('#crmAddService')?.addEventListener('click',async()=>{let d=readCrmDraftFromDom();if(!d.savedClientId&&!d.clienteId){const r=await saveCrm();if(!r)return;d=state.crmDraft;}d={...crmDefaultDraft(),clienteId:d.savedClientId||d.clienteId,savedClientId:d.savedClientId||d.clienteId,nombrePerfil:d.nombrePerfil,telefono:d.telefono,vendedor:d.vendedor,vendedorTelefono:d.vendedorTelefono,beneficiarioTipo:d.beneficiarioTipo,beneficiarioNombre:d.beneficiarioNombre,forzarNuevoServicio:true};state.crmDraft=d;render();});
  document.querySelector('#crmCopyFicha')?.addEventListener('click',async()=>{const d=readCrmDraftFromDom();const text=d.fichaTexto.trim()||crmFichaFromDraft(d);try{await navigator.clipboard.writeText(text);showToast('Ficha copiada.');}catch(_){showToast('No se pudo copiar la ficha.');}});
  document.querySelector('#crmCopyLink')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(crmDraft().savedLink||'');showToast('Enlace copiado.');}catch(_){}});
  document.querySelectorAll('[data-crm-url-variant]').forEach(btn=>btn.addEventListener('click',()=>{state.crmUrlVariant=Number(btn.dataset.crmUrlVariant)||0;render();}));
  document.querySelector('#crmCopyUrlVariant')?.addEventListener('click',async()=>{const d=crmDraft();const beneficiary=d.beneficiarioTipo==='tercero'?(d.beneficiarioNombre||d.nombrePerfil):d.nombrePerfil;const text=buildUrlDeliveryMessage({nombre:beneficiary,servicio:crmPlatformLabel(d.plataforma),link:d.savedLink,variante:state.crmUrlVariant});try{await navigator.clipboard.writeText(text);showToast('Variante copiada.');}catch(_){showToast('No se pudo copiar la variante.');}});
  document.querySelector('#crmOpenUrlVariant')?.addEventListener('click',()=>{const d=crmDraft();const beneficiary=d.beneficiarioTipo==='tercero'?(d.beneficiarioNombre||d.nombrePerfil):d.nombrePerfil;requestWhatsApp(buildUrlDeliveryMessage({nombre:beneficiary,servicio:crmPlatformLabel(d.plataforma),link:d.savedLink,variante:state.crmUrlVariant}));});
  document.querySelector('#crmDeliverTraditional')?.addEventListener('click',()=>saveCrm({delivery:'tradicional'}));
  document.querySelector('#crmDeliverUrl')?.addEventListener('click',()=>saveCrm({delivery:'url'}));

  document.querySelector('#clientSearch')?.addEventListener('input',e=>{state.search=e.target.value;const pos=e.target.selectionStart;render();const input=document.querySelector('#clientSearch');input?.focus();input?.setSelectionRange(pos,pos);});
  document.querySelector('#backClients')?.addEventListener('click',()=>{state.selectedClientId='';render();});
  document.querySelector('#backMore')?.addEventListener('click',()=>{state.subview=null;render();});
  document.querySelector('#refreshData')?.addEventListener('click',()=>loadCoreData({force:true}));
  document.querySelector('#openWhatsApp')?.addEventListener('click',()=>requestWhatsApp(''));
  document.querySelector('#closeWhatsAppChooser')?.addEventListener('click',()=>{state.whatsappChooser=false;render();});
  document.querySelector('#cancelWhatsApp')?.addEventListener('click',()=>{state.whatsappChooser=false;render();});
  document.querySelectorAll('[data-whatsapp-package]').forEach(btn=>btn.addEventListener('click',()=>launchWhatsApp(btn.dataset.whatsappPackage)));

  document.querySelector('#closeSheet')?.addEventListener('click',()=>{state.renewGroupKey='';state.renewSelection=[];render();});
  document.querySelector('#cancelRenew')?.addEventListener('click',()=>{state.renewGroupKey='';state.renewSelection=[];render();});
  document.querySelector('#renewChargeText')?.addEventListener('input',e=>{state.renewMessage=e.target.value;});
  document.querySelector('#renewAnotherStyle')?.addEventListener('click',()=>{const g=activeRenewGroup();if(!g)return;state.renewMessageVariant+=1;state.renewMessage=buildChargeMessage(g,state.renewMessageVariant);render();});
  document.querySelector('#renewAiMessage')?.addEventListener('click',async()=>{const g=activeRenewGroup();if(!g)return;const current=String(document.querySelector('#renewChargeText')?.value||state.renewMessage||'');const btn=document.querySelector('#renewAiMessage');if(btn){btn.disabled=true;btn.textContent='Generando…';}try{const r=await generateChargeMessageAI(g,current,todayISO());const raw=String(r?.respuesta||r?.text||r?.response||'').trim();let next=normalizeChargeAiMessage(raw,g);if(next.toLowerCase().replace(/\s+/g,' ').trim()===current.toLowerCase().replace(/\s+/g,' ').trim())next=buildChargeMessage(g,state.renewMessageVariant+1);state.renewMessage=next;state.renewMessageVariant+=1;render();showToast('✨ Mensaje IA actualizado.');}catch(e){state.renewMessageVariant+=1;state.renewMessage=buildChargeMessage(g,state.renewMessageVariant);render();showToast('🎨 IA no respondió; se aplicó otro estilo automáticamente.');}});
  document.querySelector('#renewCopyMessage')?.addEventListener('click',async()=>{const text=String(document.querySelector('#renewChargeText')?.value||state.renewMessage||'');try{await navigator.clipboard.writeText(text);showToast('Mensaje de cobro copiado.');}catch(_){}});
  document.querySelector('#renewOpenWhatsApp')?.addEventListener('click',()=>requestWhatsApp(String(document.querySelector('#renewChargeText')?.value||state.renewMessage||'')));
  document.querySelector('#renewOpenCrm')?.addEventListener('click',()=>{const g=activeRenewGroup();const row=g?.servicios?.[0]||g?.serviciosCliente?.[0];openCrmForRow(row);});
  document.querySelector('#toggleRenewManage')?.addEventListener('click',()=>{state.renewManage=!state.renewManage;render();});
  document.querySelectorAll('[data-renew-select]').forEach(box=>box.addEventListener('change',()=>{const set=new Set(state.renewSelection);if(box.checked)set.add(box.dataset.renewSelect);else set.delete(box.dataset.renewSelect);state.renewSelection=[...set];}));
  document.querySelectorAll('[data-edit-service]').forEach(btn=>btn.addEventListener('click',()=>openCrmForRow(allRows().find(r=>rowKey(r)===btn.dataset.editService))));
  document.querySelectorAll('[data-no-renew]').forEach(btn=>btn.addEventListener('click',()=>handleNoRenew(btn.dataset.noRenew)));
  document.querySelectorAll('[data-renew-days]').forEach(btn=>btn.addEventListener('click',()=>handleRenewalOption({days:Number(btn.dataset.renewDays)})));
  document.querySelector('#renewExactApply')?.addEventListener('click',()=>{const iso=String(document.querySelector('#renewExactDate')?.value||'');if(!iso){showToast('Seleccione una fecha.');return;}const [y,m,d]=iso.split('-');handleRenewalOption({exactDate:`${d}/${m}/${y}`});});

  document.querySelector('#logoutBtn')?.addEventListener('click',()=>{clearSession();state.session=null;state.clients=[];state.inventory=[];state.finances=[];state.profile=null;state.catalog=null;state.tickets=null;state.raffles=null;state.controlInventory=null;state.crmDraft=null;state.active='inicio';state.subview=null;state.renewGroupKey='';render();});
  const sel=document.querySelector('#themeSelect');if(sel){sel.value=state.theme;sel.addEventListener('change',()=>{state.theme=sel.value;localStorage.setItem('sublicuentas-theme',state.theme);render();});}
}

async function handleNoRenew(key) {
  const row=allRows().find(r=>rowKey(r)===key);if(!row)return;
  if(!window.confirm(`¿Confirmar que ${row.plataforma} de ${row.nombre} no renovó? Se liberará su cupo de inventario.`))return;
  try{const result=await removeNonRenewingService(row);if(!result?.ok)throw new Error(result?.error||'No se pudo dar de baja.');state.renewSelection=state.renewSelection.filter(x=>x!==key);await loadCoreData({force:true});const still=activeRenewGroup();if(!still){state.renewGroupKey='';state.renewSelection=[];}render();showToast(result.clienteEliminado?'Cliente eliminado: no renovó.':'Servicio dado de baja y cupo liberado.');}catch(e){showToast(e?.message||'No se pudo dar de baja el servicio.');}
}

async function handleRenewalOption(options={days:30}) {
  const g=activeRenewGroup();if(!g||state.loading)return;
  const selected=new Set(state.renewSelection.length?state.renewSelection:g.servicios.map(rowKey));
  const rows=g.serviciosCliente.filter(r=>selected.has(rowKey(r)));if(!rows.length){showToast('Marque al menos un servicio para renovar.');return;}
  const label=options.exactDate?`hasta ${options.exactDate}`:`+${Number(options.days||30)} días`;
  if(!window.confirm(`Renovar ${rows.length} servicio${rows.length===1?'':'s'} de ${g.nombre} ${label}?`))return;
  state.loading=true;render();let ok=0,fail=0,financeWarnings=0,lastDate='';
  for(const row of rows){try{const result=await renewService(row,options);if(!result?.ok||result?.verified!==true)throw new Error(result?.error||'Firebase no confirmó la fecha.');ok+=1;lastDate=result.fechaNueva||lastDate;try{await registerRenewalPayment(row,row.precio);}catch(_){financeWarnings+=1;}}catch(_){fail+=1;}}
  state.loading=false;state.renewGroupKey='';state.renewSelection=[];state.renewManage=false;state.renewMessage='';await loadCoreData({force:true});showToast(`${ok} renovación${ok===1?'':'es'} confirmada${ok===1?'':'s'}${lastDate?` · ${lastDate}`:''}${fail?` · ${fail} falló${fail===1?'':'aron'}`:''}${financeWarnings?' · revise Finanzas':''}.`);
}

render();
if (state.session) loadCoreData({force:true});
