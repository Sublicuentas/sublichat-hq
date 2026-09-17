export function normalizeText(value='') {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePhone(value='') {
  return String(value ?? '').replace(/\D/g, '');
}

export function parseDateDMY(value='') {
  const m = String(value ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  const date = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

export function formatDateShort(value='') {
  const d = parseDateDMY(value);
  if (!d) return '—';
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

export function dateKey(date) {
  const d = new Date(date);
  d.setHours(12,0,0,0);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function serviceRowsFromClients(clients=[]) {
  const rows = [];
  for (const client of Array.isArray(clients) ? clients : []) {
    const services = Array.isArray(client?.servicios) ? client.servicios : [];
    services.forEach((service, servicioIndex) => {
      rows.push({
        clienteId: String(client?.id || ''),
        compraId: String(service?.compraId || ''),
        servicioIndex,
        nombre: String(client?.nombrePerfil || client?.nombre || 'Cliente'),
        nombreNorm: String(client?.nombre_norm || ''),
        telefono: String(client?.telefono || ''),
        vendedor: String(service?.vendedor || client?.vendedor || ''),
        plataforma: String(service?.plataforma || 'Servicio'),
        correo: String(service?.correo || ''),
        fechaRenovacion: String(service?.fechaRenovacion || ''),
        precio: Number(service?.precio || 0) || 0,
        perfiles: Array.isArray(service?.perfiles) ? service.perfiles : [],
        raw: service,
      });
    });
  }
  return rows;
}

export function dashboardSummary(rows=[], today=new Date()) {
  const base = new Date(today);
  base.setHours(12,0,0,0);
  let vencidos = 0, hoy = 0;
  const future = new Map();
  for (const row of rows) {
    const date = parseDateDMY(row?.fechaRenovacion);
    if (!date) continue;
    const delta = Math.round((date - base) / 86400000);
    if (delta < 0) vencidos += 1;
    else if (delta === 0) hoy += 1;
    else {
      const key = dateKey(date);
      future.set(key, { date, count:(future.get(key)?.count || 0) + 1 });
    }
  }
  const next = [...future.values()].sort((a,b)=>a.date-b.date)[0] || null;
  return {
    vencidos,
    hoy,
    proximo: next ? { count: next.count, label: formatDateShort(`${String(next.date.getDate()).padStart(2,'0')}/${String(next.date.getMonth()+1).padStart(2,'0')}/${next.date.getFullYear()}`), date: next.date } : { count:0, label:'—', date:null }
  };
}

export function filterClients(clients=[], query='') {
  const q = normalizeText(query);
  const digits = normalizePhone(query);
  if (!q && !digits) return clients;
  return (Array.isArray(clients) ? clients : []).filter(client => {
    const name = normalizeText(client?.nombrePerfil || client?.nombre || '');
    const phone = normalizePhone(client?.telefono || '');
    const platforms = (Array.isArray(client?.servicios) ? client.servicios : []).map(s=>normalizeText(s?.plataforma || '')).join(' ');
    return (q && (name.includes(q) || platforms.includes(q))) || (digits && phone.includes(digits));
  });
}


export function serviceDateStatus(row={}, today=new Date()) {
  const base=new Date(today); base.setHours(12,0,0,0);
  const date=parseDateDMY(row?.fechaRenovacion);
  if(!date) return 'sin_fecha';
  const delta=Math.round((date-base)/86400000);
  if(delta<0) return 'vencidos';
  if(delta===0) return 'hoy';
  return 'proximos';
}

export function filterOperationalRows(rows=[], {query='',status='vigentes',seller='',platform='',today=new Date()}={}) {
  const q=normalizeText(query);
  const digits=normalizePhone(query);
  const sellerKey=normalizeText(seller);
  const platformKey=normalizeText(platform);
  return (Array.isArray(rows)?rows:[]).filter(row=>{
    const bucket=serviceDateStatus(row,today);
    if(status==='vigentes' && !['hoy','proximos'].includes(bucket)) return false;
    if(status==='hoy' && bucket!=='hoy') return false;
    if(status==='proximos' && bucket!=='proximos') return false;
    if(status==='vencidos' && bucket!=='vencidos') return false;
    if(sellerKey && sellerKey!=='todos' && normalizeText(row?.vendedor)!==sellerKey) return false;
    if(platformKey && platformKey!=='todas' && platformKey!=='todos' && normalizeText(row?.plataforma)!==platformKey) return false;
    if(q || digits){
      const haystack=normalizeText([row?.nombre,row?.plataforma,row?.correo,row?.vendedor].filter(Boolean).join(' '));
      const phone=normalizePhone(row?.telefono||'');
      if(!((q && haystack.includes(q)) || (digits && phone.includes(digits)))) return false;
    }
    return true;
  });
}

export function operationalFilterOptions(rows=[]) {
  const sellers=[...new Set((Array.isArray(rows)?rows:[]).map(r=>String(r?.vendedor||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const platforms=[...new Set((Array.isArray(rows)?rows:[]).map(r=>String(r?.plataforma||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  return {sellers,platforms};
}

export function operatorIdentity(role='', usuario='') {
  const u = normalizeText(usuario).replace(/\s+/g,'_');
  const r = normalizeText(role).replace(/\s+/g,'_');

  // Igual que Sublichat Web: el usuario autenticado manda por encima de un rol
  // genérico como "asesor". Evita que libni herede permisos de Sublicuentas.
  if (['geisell','geissel'].includes(u)) return 'geisell';
  if (['libni','relojes','daniela','finanzas'].includes(u)) return 'relojes';
  if (['naara','sublicuentas'].includes(u)) return 'sublicuentas';

  if (['geisell_admin','control_admin'].includes(r)) return 'geisell';
  if (['finanzas','relojes'].includes(r)) return 'relojes';
  if (['admin','administrador','sublicuentas','owner'].includes(r)) return 'sublicuentas';
  return 'limited';
}

export function roleCapabilities(role='', usuario='') {
  const identity = operatorIdentity(role, usuario);
  if (identity === 'geisell') return {
    inicio:true, clientes:true, renovar:true, nuevoCrm:false, catalogo:false, inventario:false, controlMaestro:true, finanzas:false, tickets:true, sorteos:false, perfil:true
  };
  if (identity === 'relojes') return {
    inicio:true, clientes:true, renovar:true, nuevoCrm:true, catalogo:false, inventario:false, controlMaestro:false, finanzas:true, tickets:true, sorteos:true, perfil:true
  };
  if (identity === 'sublicuentas') return {
    inicio:true, clientes:true, renovar:true, nuevoCrm:true, catalogo:true, inventario:true, controlMaestro:true, finanzas:true, tickets:true, sorteos:true, perfil:true
  };
  // Un rol genérico/desconocido nunca escala a administrador por defecto.
  return {
    inicio:true, clientes:true, renovar:true, nuevoCrm:false, catalogo:false, inventario:false, controlMaestro:false, finanzas:false, tickets:true, sorteos:false, perfil:true
  };
}

export function coreCollectionsForRole(role='', usuario='') {
  const caps = roleCapabilities(role, usuario);
  const collections = ['clientes'];
  if (caps.inventario) collections.push('inventario');
  if (caps.finanzas) collections.push('finanzas_movimientos');
  return collections;
}

export function roleLabel(role='', usuario='') {
  const identity = operatorIdentity(role, usuario);
  if (identity === 'geisell') return 'Geisell · Control';
  if (identity === 'relojes') return 'Relojes · Libni';
  if (identity === 'sublicuentas') return 'Sublicuentas · Naara';
  return 'Acceso interno';
}

export function money(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('es-HN', { style:'currency', currency:'HNL', maximumFractionDigits:2 }).format(Number.isFinite(n) ? n : 0).replace('HNL','L');
}
