const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
const requestedApiBase = String(env.VITE_API_BASE_URL || 'https://sublichat.capuchino.lat').replace(/\/$/, '');
export const API_BASE = requestedApiBase === 'https://sublichat-hq.vercel.app'
  ? 'https://sublichat.capuchino.lat'
  : requestedApiBase;
export const FIREBASE_API_KEY = 'AIzaSyA_b1a0Zo4OIAj4KayD5ChtPWToANQ1nrA';
export const FIREBASE_PROJECT_ID = 'sublicuentasbot';
const SESSION_KEY = 'sublicuentas-session-v1';

const TRUSTED_API_HOSTS = new Set([
  'sublichat-hq.vercel.app',
  'sublichat.capuchino.lat',
  'sublicuentas.com',
  'www.sublicuentas.com',
]);

export function isRedirectStatus(status) {
  return [301, 302, 303, 307, 308].includes(Number(status));
}

export function resolveSafeRedirectUrl(currentUrl, location) {
  const target = new URL(String(location || ''), String(currentUrl || ''));
  if (target.protocol !== 'https:') throw new Error('El servidor intentó una redirección no segura.');
  if (!TRUSTED_API_HOSTS.has(target.hostname.toLowerCase())) {
    throw new Error(`El servidor intentó redirigir a un dominio no autorizado: ${target.hostname}`);
  }
  return target.href;
}

function headerValue(headers, wanted) {
  const entries = Object.entries(headers || {});
  const found = entries.find(([key]) => key.toLowerCase() === String(wanted).toLowerCase());
  return found ? String(found[1] || '') : '';
}

async function nativeJsonRequest(url, { method='GET', headers={}, body }={}, redirectsLeft=4) {
  let core;
  try { core = await import('@capacitor/core'); } catch (_) { return null; }
  if (!core?.Capacitor?.isNativePlatform?.()) return null;

  const response = await core.CapacitorHttp.request({
    url,
    method,
    headers: { Accept:'application/json', ...headers },
    data: body,
    disableRedirects: true,
    connectTimeout: 15000,
    readTimeout: 30000,
  });

  if (isRedirectStatus(response.status)) {
    if (redirectsLeft <= 0) throw new Error('El servidor redirigió demasiadas veces el acceso.');
    const location = headerValue(response.headers, 'location');
    if (!location) {
      const error = new Error(`El servidor redirigió el acceso (${response.status}) sin indicar destino.`);
      error.status = response.status;
      throw error;
    }
    const nextUrl = resolveSafeRedirectUrl(url, location);
    const nextMethod = Number(response.status) === 303 ? 'GET' : method;
    const nextBody = Number(response.status) === 303 ? undefined : body;
    return nativeJsonRequest(nextUrl, { method:nextMethod, headers, body:nextBody }, redirectsLeft - 1);
  }

  const data = typeof response.data === 'string'
    ? (() => { try { return JSON.parse(response.data); } catch (_) { return response.data ? { error:response.data.slice(0,300) } : {}; } })()
    : (response.data || {});
  return { status:Number(response.status || 0), ok:Number(response.status) >= 200 && Number(response.status) < 300, data };
}

function storage() {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch (_) { return null; }
}

export function getSession() {
  const s = storage();
  if (!s) return null;
  try { return JSON.parse(s.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; }
}

export function setSession(value) {
  const s = storage();
  if (!s) return;
  if (!value) s.removeItem(SESSION_KEY);
  else s.setItem(SESSION_KEY, JSON.stringify(value));
}

export function clearSession() { setSession(null); }

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch (_) { return { error:text.slice(0,300) }; }
}

async function requestJson(url, { method='GET', headers={}, body, retryAuth=true }={}) {
  const native = await nativeJsonRequest(url, { method, headers, body });
  let status, ok, data;
  if (native) {
    ({ status, ok, data } = native);
  } else {
    const response = await fetch(url, {
      method,
      headers: { Accept:'application/json', ...headers },
      body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
    });
    status = response.status;
    ok = response.ok;
    data = await readJson(response);
  }
  if (status === 401 && retryAuth && getSession()?.refreshToken) {
    await refreshSession();
    const session = getSession();
    const nextHeaders = { ...headers, ...(session?.idToken ? { Authorization:`Bearer ${session.idToken}` } : {}) };
    return requestJson(url, { method, headers:nextHeaders, body, retryAuth:false });
  }
  if (!ok || data?.ok === false) {
    const error = new Error(data?.error || `Solicitud falló (${status})`);
    error.status = status;
    error.data = data;
    throw error;
  }
  return data;
}

export function buildLoginPayload(usuario, clave) {
  return {
    usuario:String(usuario || '').trim().toLowerCase(),
    clave:String(clave ?? ''),
  };
}

export function loginWebFetch() {
  const original = globalThis.CapacitorWebFetch;
  if (typeof original === 'function') return original.bind(globalThis);
  const regular = globalThis.fetch;
  return typeof regular === 'function' ? regular.bind(globalThis) : null;
}

export async function loginEndpointRequest(usuario, clave, fetchImpl = loginWebFetch()) {
  if (typeof fetchImpl !== 'function') throw new Error('No hay transporte web disponible para iniciar sesión.');
  const url = `${API_BASE}/api/login`;
  const response = await fetchImpl(url, {
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify(buildLoginPayload(usuario, clave)),
  });
  const data = await readJson(response);
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error || `Solicitud falló (${response.status})`);
    error.status = Number(response.status || 0);
    error.data = data;
    throw error;
  }
  return data;
}

export async function loginUser(usuario, clave) {
  const first = await loginEndpointRequest(usuario, clave);
  if (!first?.token) throw new Error('El servidor no devolvió una sesión válida.');
  const auth = await requestJson(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:{ token:first.token, returnSecureToken:true }, retryAuth:false
  });
  const session = {
    usuario:first.usuario,
    role:first.role,
    uid:auth.localId || '',
    idToken:auth.idToken,
    refreshToken:auth.refreshToken,
    expiresAt:Date.now() + Math.max(60, Number(auth.expiresIn || 3600) - 60) * 1000,
  };
  setSession(session);
  return session;
}

export async function refreshSession() {
  const current = getSession();
  if (!current?.refreshToken) throw new Error('La sesión venció. Inicie sesión nuevamente.');
  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:`grant_type=refresh_token&refresh_token=${encodeURIComponent(current.refreshToken)}`,
  });
  const data = await readJson(response);
  if (!response.ok || !data.id_token) {
    clearSession();
    throw new Error('La sesión venció. Inicie sesión nuevamente.');
  }
  const next = {
    ...current,
    idToken:data.id_token,
    refreshToken:data.refresh_token || current.refreshToken,
    uid:data.user_id || current.uid,
    expiresAt:Date.now() + Math.max(60, Number(data.expires_in || 3600) - 60) * 1000,
  };
  setSession(next);
  return next;
}

async function validSession() {
  let session = getSession();
  if (!session) throw new Error('Inicie sesión.');
  if (Number(session.expiresAt || 0) <= Date.now()) session = await refreshSession();
  return session;
}

export async function authPost(path, body={}) {
  const session = await validSession();
  return requestJson(`${API_BASE}${path}`, {
    method:'POST',
    headers:{'Content-Type':'application/json', Authorization:`Bearer ${session.idToken}`},
    body,
  });
}

export function decodeFirestoreValue(value={}) {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeFirestoreValue);
  if ('mapValue' in value) {
    return Object.fromEntries(Object.entries(value.mapValue?.fields || {}).map(([k,v])=>[k,decodeFirestoreValue(v)]));
  }
  return undefined;
}

export function decodeFirestoreDocument(doc={}) {
  const fields = Object.fromEntries(Object.entries(doc.fields || {}).map(([k,v])=>[k,decodeFirestoreValue(v)]));
  return { id:String(doc.name || '').split('/').pop() || '', ...fields };
}

export async function firestoreListCollection(collection, { pageSize=500, maxPages=12 }={}) {
  let session = await validSession();
  let pageToken = '';
  const rows = [];
  for (let page=0; page<maxPages; page += 1) {
    const qs = new URLSearchParams({ pageSize:String(pageSize) });
    if (pageToken) qs.set('pageToken', pageToken);
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${encodeURIComponent(collection)}?${qs}`;
    let response = await fetch(url, { headers:{Authorization:`Bearer ${session.idToken}`, Accept:'application/json'} });
    if (response.status === 401 && session.refreshToken) {
      session = await refreshSession();
      response = await fetch(url, { headers:{Authorization:`Bearer ${session.idToken}`, Accept:'application/json'} });
    }
    const data = await readJson(response);
    if (!response.ok) throw new Error(data?.error?.message || data?.error || `No se pudo leer ${collection}.`);
    rows.push(...(data.documents || []).map(decodeFirestoreDocument));
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return rows;
}


function crmId(prefix='id') {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}_${uuid.replace(/-/g,'')}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
}

function crmPlatformKey(value='') {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
}

function crmPlatformNoPin(plataforma='') {
  const p=crmPlatformKey(plataforma);
  return p.includes('netflixvip') || p==='vipnetflix' || p.includes('spotify') || p.includes('deezer') || p.includes('youtube') || p.includes('office') || p.includes('paramount') || p.includes('vix') || p.includes('canva') || p.includes('gemini') || p.includes('chatgpt') || p.includes('duolingo') || p.includes('stella') || p.includes('oleada') || p.includes('latintv') || p.includes('liontv') || p.includes('evoutouch') || p.includes('iptv') || p.includes('viki') || p.includes('windows') || p.includes('adobe') || p.includes('eset');
}

function crmPlatformNoPassword(plataforma='') {
  const p=crmPlatformKey(plataforma);
  return p.includes('canva') || p.includes('gemini') || p.includes('chatgpt') || p.includes('duolingo') || p.includes('adobeexpress');
}

function crmPlatformNoEmail(plataforma='') {
  const p=crmPlatformKey(plataforma);
  return ['windows10','windows11','eset','esetnod32'].includes(p);
}

export function buildCrmUpsertPayload(form={}, ids={}) {
  const nombrePerfil=String(form.nombrePerfil || form.nombre || '').trim();
  const telefono=String(form.telefono || '').trim();
  const plataforma=String(form.plataforma || '').trim();
  const vendedor=String(form.vendedor || '').trim();
  const vendedorTelefono=String(form.vendedorTelefono || '').trim();
  const meses=Math.max(1, Math.min(24, Math.round(Number(form.mesesContratados || 1) || 1)));
  const precio=Number(form.precio || 0);
  const fechaRenovacion=String(form.fechaRenovacion || '').trim();
  const compraId=String(ids.compraId || form.compraId || crmId('compra'));
  const inputProfiles=Array.isArray(form.perfiles) && form.perfiles.length ? form.perfiles : [{
    perfilId:ids.perfilId || form.perfilId,
    nombre:form.perfil || nombrePerfil || 'Perfil 1', perfil:form.perfil || nombrePerfil || 'Perfil 1',
    correo:form.correo, clave:form.clave, pinPerfil:form.pinPerfil,
    dispositivo:form.dispositivo, esRoku:form.esRoku===true,
  }];
  const perfiles=inputProfiles.map((p,index)=>{
    const correo=crmPlatformNoEmail(plataforma) ? '' : String(p?.correo ?? form.correo ?? '').trim();
    const clave=crmPlatformNoPassword(plataforma) ? '' : String(p?.clave ?? form.clave ?? '').trim();
    const pinPerfil=crmPlatformNoPin(plataforma) ? '' : String(p?.pinPerfil ?? form.pinPerfil ?? '').trim();
    const dispositivo=['tv','cel'].includes(String(p?.dispositivo ?? form.dispositivo ?? '')) ? String(p?.dispositivo ?? form.dispositivo) : '';
    const nombre=String(p?.nombre || p?.perfil || form.perfil || nombrePerfil || `Perfil ${index+1}`).trim();
    const out={
      perfilId:String(p?.perfilId || (index===0 ? ids.perfilId : '') || crmId('perfil')),
      nombre, perfil:nombre, correo, clave, dispositivo,
      esRoku:dispositivo==='tv' && (p?.esRoku===true || form.esRoku===true),
    };
    if(pinPerfil) out.pinPerfil=pinPerfil;
    return out;
  });
  const principal=perfiles[0] || {};
  const servicio={
    compraId,
    modalidad:perfiles.length>1?'multiperfil':'individual',
    plataforma,
    precio:Number.isFinite(precio) ? precio : 0,
    fechaRenovacion,
    mesesContratados:meses,
    visibilidadUrl:form.visibilidadUrl && typeof form.visibilidadUrl==='object' ? form.visibilidadUrl : {modo:'plataforma'},
    correo:principal.correo || '',
    clave:principal.clave || '',
    perfil:principal.perfil || nombrePerfil,
    perfiles,
    vendedor,
    vendedor_norm:String(vendedor||'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' '),
    vendedorTelefono,
    beneficiarioTipo:String(form.beneficiarioTipo || 'titular')==='tercero'?'tercero':'titular',
    beneficiarioNombre:String(form.beneficiarioNombre || '').trim(),
    dispositivo:principal.dispositivo || '',
    esRoku:principal.dispositivo==='tv' && principal.esRoku===true,
    ...(form.iptvProveedor ? {iptvProveedor:String(form.iptvProveedor)} : {}),
    ...(Number(form.iptvPantallas||0) ? {iptvPantallas:Number(form.iptvPantallas)} : {}),
    ...(form.iptvLista ? {iptvLista:String(form.iptvLista)} : {}),
    ...(form.iptvHora ? {iptvHora:String(form.iptvHora)} : {}),
    ...(Number(form.oleadaDispositivos||0) ? {oleadaDispositivos:Number(form.oleadaDispositivos)} : {}),
    ...(Number(form.stellaDispositivos||0) ? {stellaDispositivos:Number(form.stellaDispositivos)} : {}),
  };
  if (crmPlatformNoPassword(plataforma)) servicio.sinClave=true;
  if (crmPlatformNoPin(plataforma)) servicio.sinPinPerfil=true;
  else if (principal.pinPerfil) servicio.pinPerfil=principal.pinPerfil;
  return {
    accion:'ficha_upsert',
    clienteId:String(form.clienteId || ''),
    forzarNuevoServicio:form.forzarNuevoServicio===true,
    servicioIndex:Number.isInteger(Number(form.servicioIndex)) ? Number(form.servicioIndex) : null,
    plataformaOriginal:String(form.plataformaOriginal || ''),
    correoOriginal:String(form.correoOriginal || ''),
    cliente:{ nombrePerfil, telefono, vendedor, vendedorTelefono },
    servicio,
    fichaTexto:String(form.fichaTexto || ''),
  };
}

export async function createCrmSale(form={}) {
  return authPost('/api/renovar', buildCrmUpsertPayload(form));
}

export function buildEnsureLinksPayload(clienteId='', beneficiarioKey='titular') {
  return { accion:'asegurar_enlaces', clienteId:String(clienteId||''), beneficiarioKey:String(beneficiarioKey||'titular') };
}

export async function ensureClientLinks(clienteId='', beneficiarioKey='titular') {
  return authPost('/api/renovar', buildEnsureLinksPayload(clienteId, beneficiarioKey));
}

export function buildNoRenewalPayload(row={}) {
  return {
    accion:'no_renovo',
    clienteId:String(row?.clienteId || ''),
    clienteNorm:String(row?.nombreNorm || ''),
    telefono:String(row?.telefono || ''),
    plataforma:String(row?.plataforma || ''),
    correo:String(row?.correo || ''),
    servicioIndex:Number.isInteger(Number(row?.servicioIndex)) ? Number(row.servicioIndex) : null,
    compraId:String(row?.compraId || ''),
  };
}

export async function removeNonRenewingService(row={}) {
  return authPost('/api/renovar', buildNoRenewalPayload(row));
}

export function buildRenewalPayload(row, options=30) {
  const opt=typeof options==='number' ? {days:options} : (options || {});
  const payload={
    accion:'renovar',
    clienteId:String(row?.clienteId || ''),
    clienteNorm:String(row?.nombreNorm || ''),
    telefono:String(row?.telefono || ''),
    plataforma:String(row?.plataforma || ''),
    correo:String(row?.correo || ''),
    servicioIndex:Number.isInteger(Number(row?.servicioIndex)) ? Number(row.servicioIndex) : null,
    compraId:String(row?.compraId || ''),
    fechaActual:String(row?.fechaRenovacion || ''),
  };
  if (String(opt.exactDate || '').trim()) payload.fechaExacta=String(opt.exactDate).trim();
  else payload.dias=Math.max(1,Number(opt.days || 30));
  return payload;
}

export async function renewService(row, options=30) {
  return authPost('/api/renovar', buildRenewalPayload(row, options));
}

export async function registerRenewalPayment(row, amount) {
  const monto = Number(amount || row?.precio || 0);
  if (!monto) return { ok:true, skipped:true };
  const now = new Date();
  const yyyy = now.getFullYear(), mm=String(now.getMonth()+1).padStart(2,'0'), dd=String(now.getDate()).padStart(2,'0');
  return authPost('/api/finanzas', {
    accion:'registrar_cobro',
    clienteNombre:row?.nombre || '',
    clienteNorm:row?.nombreNorm || '',
    telefono:row?.telefono || '',
    plataforma:row?.plataforma || '',
    monto,
    metodoPago:'No especificado',
    vendedor:row?.vendedor || '',
    fechaPago:`${yyyy}-${mm}-${dd}`,
  });
}

export function buildChargeAiPayload(group={}, currentText='', today='') {
  const services=Array.isArray(group?.servicios)&&group.servicios.length?group.servicios:[group];
  const names=services.map(s=>String(s?.plataforma||'Servicio')).filter(Boolean).join(' + ') || 'Servicio';
  const total=Number(group?.total ?? services.reduce((sum,s)=>sum+Number(s?.precio||0),0)) || 0;
  const date=String(group?.fechaRenovacion || services[0]?.fechaRenovacion || 'fecha por confirmar');
  const prompt=`Genere un mensaje NUEVO de renovación de entretenimiento premium para WhatsApp.
REGLA OBLIGATORIA: exactamente 2 líneas cortas y máximo 300 caracteres en total.
Use "usted", español natural de Honduras, tono bonito, cordial y comercial, con 2 a 4 emojis.
Use negrita de WhatsApp con asteriscos en cliente, servicios y costo.
La primera línea debe saludar y emocionar; la segunda debe incluir servicio, fecha, costo y una pregunta breve para renovar.
PROHIBIDO agregar cuentas bancarias, transferencias, depósitos, tarjetas, comprobantes o cualquier método/detalle de pago.
No invente precios, fechas, servicios ni promociones. No escriba explicaciones, listas ni párrafos adicionales.
Cliente: "${String(group?.nombre||'Cliente')}".
Servicios: ${names}.
Total: Lps ${total.toLocaleString('es-HN',{maximumFractionDigits:2})}.
Fecha: ${date}.
VERSIÓN ACTUAL QUE NO DEBE REPETIR:
${String(currentText||'')}
Devuelva SOLO el nuevo mensaje, sin explicación.`;
  return {pregunta:prompt,hoy:String(today || new Date().toISOString().slice(0,10)),clientes:[],mode:'rewrite'};
}

export async function generateChargeMessageAI(group={}, currentText='', today='') {
  return authPost('/api/chat', buildChargeAiPayload(group,currentText,today));
}

export async function loadMobileResource(resource, { pageSize=250, maxPages=24 }={}) {
  const items=[];
  let cursor='';
  for (let page=0; page<maxPages; page += 1) {
    const data=await authPost('/api/mobile-core', { action:'list', resource, limit:pageSize, cursor });
    items.push(...(Array.isArray(data?.items)?data.items:[]));
    cursor=String(data?.nextCursor || '');
    if (!cursor) break;
  }
  return items;
}

export async function loadCatalog() { return authPost('/api/catalogo-relojes', { accion:'cargar' }); }
export async function loadTickets(limit=80) { return authPost('/api/tickets', { accion:'listar', limit }); }
export async function loadProfile(usuario) { return authPost('/api/perfil', { accion:'obtener', usuario }); }
export function raffleLoadPayload() { return { accion:'cargar' }; }
export async function loadRaffles() { return authPost('/api/sorteos', raffleLoadPayload()); }
