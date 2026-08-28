(function(){'use strict';
/* revendedores-admin.js · Categoría "Revendedores" en Sublichat HQ
   ------------------------------------------------------------------
   Edita precios, vendedores y clientes de TODA la red de revendedores
   sin salir de Sublichat. Habla con /api/revendedores-admin (puente que
   valida el usuario y reenvía al backend en Render). Solo visible para
   el usuario sublicuentas — ver can('revendedores') en index.html.

   Reusa las clases .cr-* de catalogo-relojes-admin.css (ya cargado en
   la página) para no repetir estilos. */

const API='/api/revendedores-admin';
const TARIFA_ESPECIAL='propietarios_2026';
const state={tab:'precios',tarifa:'general',precios:null,vendedores:null,clientes:null,recompensas:null,clienteQ:'',clienteSel:null,loading:false};
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const host=()=>document.getElementById('rbac-revendedores');
const money=v=>v==null?'—':`Lps. ${Number(v).toLocaleString('es-HN')}`;

async function api(method,ruta,body,params){
  const qs=new URLSearchParams({ruta,...(params||{}),_ts:String(Date.now())});
  const opts={method,cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'}};
  if(body!==undefined) opts.body=JSON.stringify(body);
  const r=await fetch(API+'?'+qs.toString(),opts);
  const t=await r.text();
  let d={}; try{d=JSON.parse(t)}catch(_){d={error:t}}
  if(!r.ok) throw new Error((d&&d.error)||`HTTP ${r.status}`);
  return d;
}

function shell(){
  const h=host(); if(!h||h.dataset.ready) return; h.dataset.ready='1';
  h.innerHTML=`
    <div class="cr-admin">
      <div class="cr-hero">
        <div><b>🤝 Catálogo Socios</b><span>Precios, vendedores y clientes de toda la red — conectado al Panel de Socios.</span></div>
      </div>
      <div class="cr-tabs">
        <button class="cr-tab on" data-rtab="precios">Precios</button>
        <button class="cr-tab" data-rtab="vendedores">Vendedores</button>
        <button class="cr-tab" data-rtab="clientes">Clientes</button>
        <button class="cr-tab" data-rtab="recompensas">Recompensas</button>
      </div>
      <div id="revBody"></div>
    </div>`;
  h.querySelectorAll('[data-rtab]').forEach(b=>b.onclick=()=>{
    state.tab=b.dataset.rtab;
    h.querySelectorAll('[data-rtab]').forEach(x=>x.classList.toggle('on',x===b));
    render();
  });
}

function status(msg,cls){
  const b=$('#revBody');
  if(b) b.insertAdjacentHTML('afterbegin',`<div class="cr-status ${cls||''}" style="margin-bottom:8px">${esc(msg)}</div>`);
}

function render(){
  ({precios:renderPrecios,vendedores:renderVendedores,clientes:renderClientes,recompensas:renderRecompensas}[state.tab]||renderPrecios)();
}

/* ═══════════ PRECIOS ═══════════ */
async function loadPrecios(force){
  if(state.precios&&!force) return render();
  const b=$('#revBody'); if(b) b.innerHTML='<div class="cr-empty">Cargando precios…</div>';
  try{ const d=await api('GET','precios',undefined,{tarifa:state.tarifa}); state.precios=d.precios||[]; render(); }
  catch(e){ if(b) b.innerHTML=`<div class="cr-empty">${esc(e.message)}</div>`; }
}
function renderPrecios(){
  const b=$('#revBody'); if(!state.precios) return loadPrecios();
  const grupos={};
  const orden=[];
  state.precios.forEach(p=>{
    const k=p.categoria||'Sin categoría';
    if(!grupos[k]){ grupos[k]=[]; orden.push(k); }
    grupos[k].push(p);
  });
  const vacio=!state.precios.length;
  b.innerHTML=`
    <div class="cr-tools" style="flex-wrap:wrap;gap:8px">
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="cr-btn ${state.tarifa==='general'?'red':'ghost'}" data-tarifa="general">Tarifa general</button>
        <button class="cr-btn ${state.tarifa===TARIFA_ESPECIAL?'red':'ghost'}" data-tarifa="${TARIFA_ESPECIAL}">Sublicuentas · Relojes · Geisell</button>
      </div>
      <button class="cr-btn red" id="revAddPrecio">＋ Ítem nuevo</button>
    </div>
    ${state.tarifa===TARIFA_ESPECIAL?`<div class="cr-card" style="margin-bottom:12px"><h3>Actualización de precios y vendedores</h3><small>Corrige Geissel → Geisell, actualiza sus clientes, asigna esta tarifa y crea Sublicuentas 2 con el teléfono 8946-4328.</small><div class="cr-row" style="margin-top:10px"><button class="cr-btn ghost" id="revPreviewActualizacion">Revisar cambios</button><button class="cr-btn red" id="revAplicarActualizacion">Aplicar actualización</button></div></div>`:''}
    ${vacio?`<div class="cr-empty">Catálogo vacío.<br><br>
      <button class="cr-btn red" id="revImportarInicial">📥 ${state.tarifa==='general'?'Importar catálogo inicial':'Cargar tarifa especial'}</button><br><br>
      <small>${state.tarifa==='general'?'Trae el catálogo general del Panel de Socios.':'Carga los 28 precios definidos para Sublicuentas, Relojes y Geisell.'}</small>
    </div>`:''}
    ${orden.map(cat=>`
      <div class="cr-section">${esc(cat)}</div>
      <div class="cr-grid">${grupos[cat].map(precioCard).join('')}</div>
    `).join('')}`;
  $('#revAddPrecio').onclick=nuevoPrecio;
  if(vacio) $('#revImportarInicial').onclick=importarPreciosIniciales;
  b.querySelectorAll('[data-tarifa]').forEach(x=>x.onclick=()=>{state.tarifa=x.dataset.tarifa;state.precios=null;loadPrecios(true)});
  if($('#revPreviewActualizacion'))$('#revPreviewActualizacion').onclick=previsualizarActualizacion;
  if($('#revAplicarActualizacion'))$('#revAplicarActualizacion').onclick=aplicarActualizacion;
  b.querySelectorAll('[data-save-precio]').forEach(x=>x.onclick=()=>guardarPrecio(x.dataset.savePrecio));
  b.querySelectorAll('[data-del-precio]').forEach(x=>x.onclick=()=>eliminarPrecio(x.dataset.delPrecio));
}
async function importarPreciosIniciales(){
  const btn=$('#revImportarInicial'); if(btn){ btn.disabled=true; btn.textContent='Importando…'; }
  try{
    const ruta=state.tarifa==='general'?'precios/importar-inicial':'precios/importar-especial';
    const d=await api('POST',ruta,undefined,{tarifa:state.tarifa});
    status(state.tarifa==='general'
      ?`✅ Catálogo importado: ${d.creados||0} nuevos, ${d.actualizados||0} actualizados.`
      :`✅ Tarifa especial cargada: ${d.actualizados||0} precios.`, 'good');
    await loadPrecios(true);
  }catch(e){ status(e.message,'bad'); if(btn){ btn.disabled=false; btn.textContent='📥 Importar catálogo inicial'; } }
}
async function previsualizarActualizacion(){
  try{
    const d=await api('GET','actualizaciones/precios-agosto-2026');
    const pendientes=(d.iptvPendientes||[]).reduce((n,x)=>n+Number(x.cantidad||0),0);
    alert(`Se actualizarán ${d.clientesAActualizar||0} clientes y ${d.serviciosConRegla||0} servicios.\nRegistros Geisell encontrados: ${d.registrosGeisellEncontrados||0}.\nIPTV antiguos pendientes de identificar: ${pendientes}.`);
  }catch(e){status(e.message,'bad')}
}
async function aplicarActualizacion(){
  if(!confirm('¿Aplicar los precios especiales, corregir Geisell y crear Sublicuentas 2? Se guardará un respaldo antes de cambiar clientes.'))return;
  const btn=$('#revAplicarActualizacion');if(btn){btn.disabled=true;btn.textContent='Aplicando…'}
  try{
    const d=await api('POST','actualizaciones/precios-agosto-2026',{});
    state.precios=null;state.vendedores=null;
    await loadPrecios(true);
    const pendientes=(d.iptvPendientes||[]).reduce((n,x)=>n+Number(x.cantidad||0),0);
    status(`✅ Actualización completa: ${d.clientesActualizados||0} clientes y ${d.serviciosConRegla||0} servicios revisados.${pendientes?' '+pendientes+' IPTV antiguos quedaron para identificar.':''}`,'good');
    if(d.sublicuentas2Pin)pinModal('Sublicuentas 2',d.sublicuentas2Pin,'Usuario: sublicuentas 2 · WhatsApp: 8946-4328');
  }catch(e){status(e.message,'bad');if(btn){btn.disabled=false;btn.textContent='Aplicar actualización'}}
}
function precioCard(p){
  const id=p.id;
  const titulo=p.nombre+(p.variante?' · '+p.variante:'');
  return `<article class="cr-card">
    <div class="cr-row"><h3>${esc(titulo)}</h3><span class="cr-badge ${p.precio!=null?'':'paused'}">${p.precio!=null?'Con precio':'Por comisión'}</span></div>
    <label class="cr-field">Nombre<input id="pxNombre-${esc(id)}" value="${esc(p.nombre||'')}"></label>
    <label class="cr-field">Variante (opcional)<input id="pxVariante-${esc(id)}" value="${esc(p.variante||'')}" placeholder="Ej. 3 dispositivos"></label>
    <label class="cr-field">Categoría<input id="pxCategoria-${esc(id)}" value="${esc(p.categoria||'')}" placeholder="Ej. 📺 Streaming"></label>
    <label class="cr-field">Precio (Lps.) — vacío = "Por comisión"<input type="number" min="0" step="1" id="pxPrecio-${esc(id)}" value="${p.precio??''}" placeholder="Ej. 130"></label>
    <label class="cr-field">Detalle (se muestra al socio)<textarea id="pxDetalle-${esc(id)}" rows="3">${esc(p.detalle||'')}</textarea></label>
    <label class="cr-check"><input type="checkbox" id="pxActivo-${esc(id)}" ${p.activo!==false?'checked':''}> Visible para los socios</label>
    <div class="cr-row">
      <button class="cr-btn danger" data-del-precio="${esc(id)}">Eliminar</button>
      <button class="cr-btn red" data-save-precio="${esc(id)}">💾 Guardar</button>
    </div>
  </article>`;
}
function leerFormPrecio(id){
  const precioRaw=$('#pxPrecio-'+id)?.value;
  return {
    nombre:$('#pxNombre-'+id)?.value.trim()||'',
    variante:$('#pxVariante-'+id)?.value.trim()||'',
    categoria:$('#pxCategoria-'+id)?.value.trim()||'',
    detalle:$('#pxDetalle-'+id)?.value.trim()||'',
    precio:precioRaw===''||precioRaw==null?null:Number(precioRaw),
    activo:$('#pxActivo-'+id)?.checked!==false,
  };
}
async function guardarPrecio(id){
  const datos=leerFormPrecio(id);
  if(!datos.nombre){ status('Ponele un nombre al ítem.','bad'); return; }
  try{
    const d=await api('PUT','precios/'+id,datos,{tarifa:state.tarifa});
    status(d.sincronizado?'✅ Guardado y sincronizado con el Panel de Socios.':'✅ Guardado.','good');
    await loadPrecios(true);
  }catch(e){ status(e.message,'bad'); }
}
async function eliminarPrecio(id){
  if(!confirm('¿Eliminar este ítem del catálogo? Ya no lo verán los socios.')) return;
  try{ await api('DELETE','precios/'+id,undefined,{tarifa:state.tarifa}); await loadPrecios(true); }
  catch(e){ status(e.message,'bad'); }
}
function nuevoPrecio(){
  const m=modal(`<h2>Nuevo ítem del catálogo</h2>
    <div class="cr-form">
      <label class="cr-field wide">Categoría<input id="npCategoria" placeholder="Ej. 📺 Streaming"></label>
      <label class="cr-field wide">Nombre<input id="npNombre" placeholder="Ej. Netflix"></label>
      <label class="cr-field wide">Variante (opcional)<input id="npVariante" placeholder="Ej. 3 dispositivos"></label>
      <label class="cr-field wide">Precio (Lps.) — vacío = "Por comisión"<input type="number" min="0" id="npPrecio"></label>
      <label class="cr-field wide">Detalle (se muestra al socio)<textarea id="npDetalle" rows="3"></textarea></label>
    </div>
    <div class="cr-actions"><button class="cr-btn ghost" id="npCancel">Cancelar</button><button class="cr-btn red" id="npOk">Crear</button></div>`);
  $('#npCancel').onclick=()=>m.remove();
  $('#npOk').onclick=async()=>{
    const categoria=$('#npCategoria').value.trim(), nombre=$('#npNombre').value.trim();
    if(!categoria||!nombre){ alert('Completá al menos categoría y nombre.'); return; }
    const precioRaw=$('#npPrecio').value;
    try{
      await api('POST','precios',{
        categoria, nombre,
        variante:$('#npVariante').value.trim(),
        detalle:$('#npDetalle').value.trim(),
        precio:precioRaw===''?null:Number(precioRaw),
        activo:true,tarifaId:state.tarifa,
      },{tarifa:state.tarifa});
      m.remove(); await loadPrecios(true);
    }catch(e){ alert(e.message); }
  };
}

/* ═══════════ VENDEDORES ═══════════ */
async function loadVendedores(force){
  if(state.vendedores&&!force) return render();
  const b=$('#revBody'); if(b) b.innerHTML='<div class="cr-empty">Cargando vendedores…</div>';
  try{
    const d=await api('GET','revendedores');
    state.vendedores=Array.isArray(d)?d:(d.revendedores||[]);
    render();
  }catch(e){ if(b) b.innerHTML=`<div class="cr-empty">${esc(e.message)}</div>`; }
}
function renderVendedores(){
  const b=$('#revBody'); if(!state.vendedores) return loadVendedores();
  b.innerHTML=`
    <div class="cr-tools"><span></span><button class="cr-btn red" id="revAddVendedor">＋ Vendedor</button></div>
    <div class="cr-grid">${state.vendedores.map(vendedorCard).join('')||'<div class="cr-empty">No hay vendedores.</div>'}</div>`;
  $('#revAddVendedor').onclick=nuevoVendedor;
  b.querySelectorAll('[data-edit-vend]').forEach(x=>x.onclick=()=>editarVendedor(x.dataset.editVend));
  b.querySelectorAll('[data-pin-vend]').forEach(x=>x.onclick=()=>resetPinVendedor(x.dataset.pinVend));
  b.querySelectorAll('[data-del-vend]').forEach(x=>x.onclick=()=>eliminarVendedor(x.dataset.delVend,x.dataset.nombre));
  b.querySelectorAll('[data-toggle-vend]').forEach(x=>x.onclick=()=>toggleActivoVendedor(x.dataset.toggleVend,x.dataset.activo==='1'));
}
function vendedorCard(r){
  const activo=r.activo!==false;
  return `<article class="cr-card">
    <div class="cr-row"><h3>${esc(r.nombre)}</h3><span class="cr-badge ${activo?'':'paused'}">${activo?'Activo':'Inactivo — no puede entrar'}</span></div>
    <small>Usuario: ${esc(r.nombre_norm||r.id)} · WhatsApp: ${esc(r.telefono||'—')} · TG: ${esc(r.telegramId||'—')}</small>
    <div class="cr-row"><small>${r.clientes||0} clientes · ${r.vencidos||0} vencidos</small></div>
    <div class="cr-row">
      <button class="cr-btn ghost" data-edit-vend="${esc(r.id)}">Editar</button>
      <button class="cr-btn ghost" data-pin-vend="${esc(r.id)}">🔐 Nuevo PIN</button>
    </div>
    <div class="cr-row">
      <button class="cr-btn ${activo?'danger':'red'}" data-toggle-vend="${esc(r.id)}" data-activo="${activo?'1':'0'}">${activo?'🔒 Desactivar acceso':'🔓 Reactivar acceso'}</button>
      <button class="cr-btn danger" data-del-vend="${esc(r.id)}" data-nombre="${esc(r.nombre)}">Eliminar</button>
    </div>
  </article>`;
}
async function toggleActivoVendedor(id,estabaActivo){
  const accion=estabaActivo?'desactivar':'reactivar';
  if(!confirm(estabaActivo?'¿Desactivar a este vendedor? No va a poder entrar al panel hasta que lo reactivés.':'¿Reactivar a este vendedor?')) return;
  try{ await api('PATCH','revendedores/'+id,{activo:!estabaActivo}); status(estabaActivo?'🔒 Acceso desactivado.':'🔓 Acceso reactivado.','good'); await loadVendedores(true); }
  catch(e){ alert(e.message); }
}
function nuevoVendedor(){
  const m=modal(`<h2>Nuevo vendedor</h2>
    <div class="cr-form">
      <label class="cr-field wide">Nombre<input id="nvNombre" placeholder="Ej. Juan Pérez"></label>
      <label class="cr-field wide">WhatsApp<input id="nvTelefono" inputmode="tel" placeholder="Ej. 8946-4328"></label>
      <label class="cr-field wide">ID de Telegram (opcional)<input id="nvTelegram" placeholder="Ej. 123456789"></label>
    </div>
    <div class="cr-actions"><button class="cr-btn ghost" id="nvCancel">Cancelar</button><button class="cr-btn red" id="nvOk">Crear</button></div>`);
  $('#nvCancel').onclick=()=>m.remove();
  $('#nvOk').onclick=async()=>{
    const nombre=$('#nvNombre').value.trim(), telegramId=$('#nvTelegram').value.trim(), telefono=$('#nvTelefono').value.trim();
    if(!nombre||(!telefono&&!telegramId)){ alert('Completá el nombre y al menos WhatsApp o ID de Telegram.'); return; }
    try{
      const d=await api('POST','revendedores',{nombre,telegramId,telefono});
      m.remove();
      pinModal(d.nombre,d.pin,`Usuario de acceso: ${d.nombre_norm}`);
      await loadVendedores(true);
    }catch(e){ alert(e.message); }
  };
}
function editarVendedor(id){
  const r=state.vendedores.find(x=>x.id===id); if(!r) return;
  const m=modal(`<h2>Editar vendedor</h2>
    <div class="cr-form">
      <label class="cr-field wide">Nombre<input id="evNombre" value="${esc(r.nombre)}"></label>
      <label class="cr-field wide">WhatsApp<input id="evTelefono" value="${esc(r.telefono||'')}"></label>
      <label class="cr-field wide">ID de Telegram (opcional)<input id="evTelegram" value="${esc(r.telegramId||'')}"></label>
      <label class="cr-check"><input type="checkbox" id="evActivo" ${r.activo!==false?'checked':''}> Cuenta activa</label>
      <small>Usuario de acceso (${esc(r.nombre_norm)}) no se puede cambiar acá — reasigná los clientes primero si hace falta.</small>
    </div>
    <div class="cr-actions"><button class="cr-btn ghost" id="evCancel">Cancelar</button><button class="cr-btn red" id="evOk">Guardar</button></div>`);
  $('#evCancel').onclick=()=>m.remove();
  $('#evOk').onclick=async()=>{
    try{
      await api('PATCH','revendedores/'+id,{nombre:$('#evNombre').value.trim(),telefono:$('#evTelefono').value.trim(),telegramId:$('#evTelegram').value.trim(),activo:$('#evActivo').checked});
      m.remove(); await loadVendedores(true);
    }catch(e){ alert(e.message); }
  };
}
async function resetPinVendedor(id){
  if(!confirm('¿Generar un PIN nuevo? La clave actual del vendedor queda invalidada.')) return;
  try{ const d=await api('POST','revendedores/'+id+'/resetpin'); pinModal(d.nombre,d.pin,'PIN reiniciado — la clave anterior ya no sirve.'); }
  catch(e){ alert(e.message); }
}
async function eliminarVendedor(id,nombre){
  if(!confirm(`¿Eliminar a ${nombre}? Sus clientes NO se borran, pero quedan sin vendedor asignado.`)) return;
  try{ await api('DELETE','revendedores/'+id); await loadVendedores(true); }
  catch(e){ alert(e.message); }
}
function pinModal(nombre,pin,nota){
  const m=modal(`<h2>👤 ${esc(nombre)}</h2>
    <p>PIN de configuración (de un solo uso) — pásaselo por un canal de confianza. Lo necesita la primera vez que entre al panel:</p>
    <div class="cr-price" style="font-size:32px;text-align:center;letter-spacing:4px">${esc(pin)}</div>
    <small>${esc(nota||'')}</small>
    <div class="cr-actions"><button class="cr-btn red" id="pinOk">Listo</button></div>`);
  $('#pinOk').onclick=()=>m.remove();
}

/* ═══════════ CLIENTES ═══════════ */
async function loadClientesList(){
  const b=$('#revBody');
  try{
    const d=await api('GET','clientes',undefined,state.clienteQ?{q:state.clienteQ}:{});
    state.clientes=d.clientes||[];
    renderClientesList();
  }catch(e){ if(b) b.innerHTML=`<div class="cr-empty">${esc(e.message)}</div>`; }
}
function renderClientes(){
  const b=$('#revBody');
  b.innerHTML=`
    <div class="cr-tools"><input class="cr-search" id="revCliSearch" placeholder="Buscar cliente por nombre o teléfono" value="${esc(state.clienteQ)}"></div>
    <div id="revCliList"><div class="cr-empty">Escribí para buscar, o dejá vacío y Enter para ver los últimos.</div></div>
    <div id="revCliDetalle"></div>`;
  const inp=$('#revCliSearch');
  inp.onkeydown=e=>{ if(e.key==='Enter'){ state.clienteQ=inp.value.trim(); loadClientesList(); } };
}
function renderClientesList(){
  const box=$('#revCliList'); if(!box) return;
  box.innerHTML=`<div class="cr-grid">${(state.clientes||[]).map(c=>`
    <article class="cr-card">
      <h3>${esc(c.nombre)}</h3>
      <small>${esc(c.telefono||'sin teléfono')} · vendedor: ${esc(c.vendedor_norm||'—')}</small>
      <div class="cr-row"><small>${c.servicios} servicio(s)</small><button class="cr-btn ghost" data-ver-cliente="${esc(c.id)}">Ver</button></div>
    </article>`).join('')||'<div class="cr-empty">Sin resultados.</div>'}</div>`;
  box.querySelectorAll('[data-ver-cliente]').forEach(x=>x.onclick=()=>verCliente(x.dataset.verCliente));
}
async function verCliente(id){
  const box=$('#revCliDetalle'); box.innerHTML='<div class="cr-empty">Cargando…</div>';
  try{
    const d=await api('GET','clientes/'+id);
    state.clienteSel=d.cliente;
    if(!state.vendedores) await loadVendedores(); // para el selector de reasignar
    renderClienteDetalle();
  }catch(e){ box.innerHTML=`<div class="cr-empty">${esc(e.message)}</div>`; }
}
function renderClienteDetalle(){
  const box=$('#revCliDetalle'); const c=state.clienteSel; if(!c) return;
  const servicios=Array.isArray(c.servicios)?c.servicios:[];
  const opcionesVendedor=(state.vendedores||[]).map(v=>`<option value="${esc(v.nombre_norm||v.id)}" ${(''+v.nombre_norm===''+c.vendedor_norm)?'selected':''}>${esc(v.nombre)}</option>`).join('');
  box.innerHTML=`<div class="cr-card" style="margin-top:12px">
    <h2>👤 ${esc(c.nombrePerfil||c.nombre||'Cliente')}</h2>
    <div class="cr-form">
      <label class="cr-field">Nombre<input id="cdNombre" value="${esc(c.nombrePerfil||c.nombre||'')}"></label>
      <label class="cr-field">Teléfono<input id="cdTelefono" value="${esc(c.telefono||'')}"></label>
      <label class="cr-field">Vendedor<select id="cdVendedor">${opcionesVendedor}</select></label>
    </div>
    <div class="cr-actions">
      <button class="cr-btn danger" id="cdDelete">Eliminar cliente</button>
      <button class="cr-btn red" id="cdSave">💾 Guardar datos</button>
    </div>
    <div class="cr-section">Servicios</div>
    <div class="cr-grid">${servicios.map((s,i)=>servicioCard(s,i)).join('')||'<div class="cr-empty">Sin servicios.</div>'}</div>
  </div>`;
  $('#cdSave').onclick=async()=>{
    try{
      await api('PATCH','clientes/'+c.id,{nombrePerfil:$('#cdNombre').value.trim(),telefono:$('#cdTelefono').value.trim(),vendedor_norm:$('#cdVendedor').value});
      status('✅ Datos guardados.','good'); await verCliente(c.id);
    }catch(e){ alert(e.message); }
  };
  $('#cdDelete').onclick=async()=>{
    if(!confirm('¿Eliminar este cliente por completo? No se puede deshacer.')) return;
    try{ await api('DELETE','clientes/'+c.id); box.innerHTML=''; state.clienteSel=null; await loadClientesList(); }
    catch(e){ alert(e.message); }
  };
  box.querySelectorAll('[data-save-servicio]').forEach(x=>x.onclick=()=>guardarServicio(c.id,x.dataset.saveServicio));
  box.querySelectorAll('[data-del-servicio]').forEach(x=>x.onclick=()=>eliminarServicio(c.id,x.dataset.delServicio));
}
function servicioCard(s,idx){
  return `<article class="cr-card">
    <h3>${esc(s.plataforma||'Servicio')}</h3>
    <label class="cr-field">Precio<input type="number" min="0" step="1" id="svPrecio-${idx}" value="${s.precio??''}"></label>
    <label class="cr-field">Vencimiento (DD/MM/AAAA)<input id="svFecha-${idx}" value="${esc(s.fechaRenovacion||'')}"></label>
    <label class="cr-field">Correo<input id="svCorreo-${idx}" value="${esc(s.correo||'')}"></label>
    <label class="cr-field">Clave<input id="svClave-${idx}" value="${esc(s.clave||'')}"></label>
    <label class="cr-field">PIN<input id="svPin-${idx}" value="${esc(s.pin||'')}"></label>
    <div class="cr-row">
      <button class="cr-btn danger" data-del-servicio="${idx}">Eliminar servicio</button>
      <button class="cr-btn red" data-save-servicio="${idx}">💾 Guardar</button>
    </div>
  </article>`;
}
async function guardarServicio(clienteId,idx){
  const patch={};
  const precio=Number($('#svPrecio-'+idx)?.value);
  if(Number.isFinite(precio)&&precio>0) patch.precio=precio;
  const fecha=$('#svFecha-'+idx)?.value.trim(); if(fecha) patch.fechaRenovacion=fecha;
  patch.correo=$('#svCorreo-'+idx)?.value.trim()||'';
  patch.clave=$('#svClave-'+idx)?.value.trim()||'';
  patch.pin=$('#svPin-'+idx)?.value.trim()||'';
  try{
    await api('PATCH',`clientes/${clienteId}/servicios/${idx}`,patch);
    status('✅ Servicio actualizado.','good');
    await verCliente(clienteId);
  }catch(e){ alert(e.message); }
}
async function eliminarServicio(clienteId,idx){
  if(!confirm('¿Eliminar este servicio del cliente?')) return;
  try{ await api('DELETE',`clientes/${clienteId}/servicios/${idx}`); await verCliente(clienteId); }
  catch(e){ alert(e.message); }
}

/* ═══════════ RECOMPENSAS ═══════════ */
async function loadRecompensas(force){
  if(state.recompensas&&!force)return renderRecompensas();
  const b=$('#revBody');if(b)b.innerHTML='<div class="cr-empty">Cargando recompensas…</div>';
  try{const d=await api('GET','recompensas');state.recompensas=d.recompensas||[];renderRecompensas()}catch(e){if(b)b.innerHTML=`<div class="cr-empty">${esc(e.message)}</div>`}
}
function renderRecompensas(){
  const b=$('#revBody');if(!state.recompensas)return loadRecompensas();
  b.innerHTML=`<div class="cr-tools"><span>Solicitudes de premios de los socios</span><button class="cr-btn ghost" id="rewardReload">Actualizar</button></div><div class="cr-grid">${state.recompensas.map(r=>`<article class="cr-card"><div class="cr-row"><h3>🎁 ${esc(r.recompensa||'Recompensa')}</h3><span class="cr-badge ${r.estado==='entregada'?'':r.estado==='rechazada'?'paused':''}">${esc(r.estado||'pendiente')}</span></div><small>Socio: ${esc(r.socio||r.socio_norm||'—')} · Nivel ${esc(r.nivel||'—')} · ${Number(r.ventas)||0} ventas</small><div class="cr-row"><button class="cr-btn danger" data-reward-status="rechazada" data-reward-id="${esc(r.id)}">Rechazar</button><button class="cr-btn red" data-reward-status="entregada" data-reward-id="${esc(r.id)}">✓ Marcar entregada</button></div></article>`).join('')||'<div class="cr-empty">No hay solicitudes de recompensa.</div>'}</div>`;
  $('#rewardReload').onclick=()=>loadRecompensas(true);
  b.querySelectorAll('[data-reward-id]').forEach(x=>x.onclick=()=>setRewardStatus(x.dataset.rewardId,x.dataset.rewardStatus));
}
async function setRewardStatus(id,estado){try{await api('PATCH','recompensas/'+id,{estado});await loadRecompensas(true)}catch(e){alert(e.message)}}

/* ═══════════ util modal ═══════════ */
function modal(innerHtml){
  const overlay=document.createElement('div');
  overlay.className='cr-modal'; overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px';
  overlay.innerHTML=`<div class="cr-sheet" style="background:#fff;border-radius:18px;padding:20px;max-width:460px;width:100%;max-height:85vh;overflow:auto">${innerHtml}</div>`;
  overlay.addEventListener('click',e=>{ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  return overlay;
}

/* ═══════════ init ═══════════ */
function init(){
  shell();
  const screen=document.getElementById('screen-revendedores');
  if(screen?.classList.contains('active')) loadPrecios();
}
window.SublichatRevendedores={open:()=>{ shell(); loadPrecios(); },reload:()=>{ state.precios=null; state.vendedores=null; state.clientes=null; state.recompensas=null; render(); }};
document.addEventListener('DOMContentLoaded',init);
new MutationObserver(()=>{
  const s=document.getElementById('screen-revendedores');
  if(s?.classList.contains('active')){ shell(); if(!state.precios) loadPrecios(); }
}).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
})();
