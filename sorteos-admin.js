(function sublichatSorteosAdmin(){
  'use strict';

  const API='/api/sorteos';
  const state={
    loaded:false,loading:false,tab:'sorteos',sorteos:[],premios:[],entregas:[],participantes:[],
    permisos:{alcance:'todos'}
  };
  const TIPO_PREMIO={
    perfil:['📺','Perfil de streaming'],descuento_porcentaje:['％','Descuento de renovación'],
    descuento_fijo:['🏷️','Descuento fijo'],cine:['🎬','Boleto de cine'],recarga:['📱','Recarga telefónica'],
    dias_extra:['🗓️','Días extra de servicio'],personalizado:['✨','Premio digital personalizado']
  };
  const CATEGORIAS={general:'Todos los clientes',compras:'Compras nuevas',renovaciones:'Renovaciones',club_vip:'👑 Club VIP',oro:'👑 Club VIP'};
  const ESTADOS={borrador:'Borrador',activo:'Activo',cerrado:'Participación cerrada',finalizado:'Finalizado'};
  const ALCANCES={sublicuentas:'Sublicuentas',relojes:'Relojes',ambos:'Ambos negocios'};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const host=()=>document.getElementById('rbac-sorteos');
  const byId=id=>document.getElementById(id);
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const HEX_COLOR=/^#[0-9a-f]{6}$/i;

  function safeHex(value,fallback='#2A5FD9'){
    const candidate=String(value||'').trim();
    return HEX_COLOR.test(candidate)?candidate:String(fallback||'#2A5FD9');
  }
  function themeAccent(){
    const css=getComputedStyle(document.documentElement);
    return safeHex(css.getPropertyValue('--theme-accent').trim()||css.getPropertyValue('--accent').trim());
  }
  function contrastColor(value){
    const hex=safeHex(value).slice(1);
    const channels=[0,2,4].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(channel=>channel<=.04045?channel/12.92:Math.pow((channel+.055)/1.055,2.4));
    const luminance=.2126*channels[0]+.7152*channels[1]+.0722*channels[2];
    const white=1.05/(luminance+.05),dark=(luminance+.05)/.055;
    return white>=dark?'#FFFFFF':'#111827';
  }
  function syncThemeTokens(){
    const accent=themeAccent();
    document.documentElement.style.setProperty('--sorteos-on-accent',contrastColor(accent));
  }
  let themeObserver=null;
  function watchTheme(){
    syncThemeTokens();
    if(themeObserver)return;
    themeObserver=new MutationObserver(syncThemeTokens);
    themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  }

  function dateObject(value){
    if(!value)return null;
    if(value instanceof Date)return value;
    if(typeof value?.toDate==='function')return value.toDate();
    if(Number.isFinite(Number(value?._seconds)))return new Date(Number(value._seconds)*1000);
    if(Number.isFinite(Number(value?.seconds)))return new Date(Number(value.seconds)*1000);
    const parsed=new Date(value);return Number.isNaN(parsed.getTime())?null:parsed;
  }
  function dateText(value){
    const date=dateObject(value);return date?date.toLocaleString('es-HN',{dateStyle:'medium',timeStyle:'short'}):'—';
  }
  function localInput(value){
    const date=dateObject(value);if(!date)return '';
    const shifted=new Date(date.getTime()-date.getTimezoneOffset()*60000);
    return shifted.toISOString().slice(0,16);
  }
  function defaultLocal(days=0){
    const date=new Date(Date.now()+days*86400000);date.setMinutes(Math.ceil(date.getMinutes()/5)*5,0,0);
    return localInput(date);
  }
  function prizeLabel(prize){
    const type=TIPO_PREMIO[prize?.tipo]||TIPO_PREMIO.personalizado;
    if(prize?.tipo==='descuento_porcentaje'&&prize.valor)return `${prize.valor}% de descuento`;
    if(prize?.tipo==='descuento_fijo'&&prize.valor)return `L ${Number(prize.valor).toLocaleString('es-HN')} de descuento`;
    if(prize?.tipo==='dias_extra'&&prize.valor)return `${prize.valor} días extra`;
    if(prize?.tipo==='perfil'&&prize.valor)return `${prize.valor} mes${Number(prize.valor)===1?'':'es'} de ${prize.plataforma||'streaming'}`;
    return type[1];
  }
  function stockText(prize){
    if(prize.entregaModo==='codigo')return `${Number(prize.codigosDisponibles)||0} código(s)`;
    if(prize.entregaModo==='cupon')return 'Cupón automático';
    const free=Math.max(0,(Number(prize.stock)||0)-(Number(prize.reservados)||0)-(Number(prize.entregados)||0));
    return `${free} disponible${free===1?'':'s'}`;
  }
  async function api(payload){
    const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{})});
    const text=await response.text();let data={};
    try{data=text?JSON.parse(text):{};}catch(_){data={ok:false,error:text||'Respuesta inválida.'};}
    if(!response.ok||!data.ok)throw new Error(data.error||`Error HTTP ${response.status}`);
    return data;
  }
  function status(message,type=''){
    const element=byId('srStatus');if(!element)return;
    element.textContent=message||'';element.className=`sr-status${type?` ${type}`:''}`;
  }
  function closeModal(){const modal=byId('srModal');if(modal){modal.hidden=true;modal.innerHTML='';}}

  function shell(){
    const root=host();if(!root||root.dataset.sorteosReady==='1')return;
    root.dataset.sorteosReady='1';
    root.innerHTML=`
      <div class="sr-admin">
        <div class="sr-layout">
          <div class="sr-main">
            <section class="sr-hero">
              <div class="sr-hero-copy">
                <small>FIDELIDAD QUE SE SIENTE</small>
                <h3>Premios que hacen volver</h3>
                <p>Convierta cada compra y renovación en boletos para ganar beneficios digitales.</p>
                <div class="sr-hero-actions">
                  <button type="button" class="sr-hero-btn primary" data-sr-hero-tab="premios">Ver premios</button>
                  <button type="button" class="sr-hero-btn" id="srHeroNewDraw">Crear sorteo</button>
                </div>
                <div class="sr-rule-strip" aria-label="Reglas predeterminadas">
                  <span><b>+1</b> compra</span><span><b>+2</b> renovación</span><span><b>Sin bonos</b> por nivel</span>
                </div>
              </div>
              <div class="sr-hero-art" aria-hidden="true"><img src="/assets/portal-icono-sorteos-premios-transparent.png" alt=""></div>
            </section>
            <section class="sr-metrics" id="srMetrics"></section>
            <nav class="sr-tabs" aria-label="Administración de sorteos">
              <button type="button" class="sr-tab on" data-sr-tab="sorteos">🎟️ Sorteos</button>
              <button type="button" class="sr-tab" data-sr-tab="premios">🎁 Premios digitales</button>
              <button type="button" class="sr-tab" data-sr-tab="ganadores">🏆 Ganadores</button>
            </nav>
            <section id="srBody"><div class="sr-empty">Cargando sorteos…</div></section>
            <div class="sr-status" id="srStatus" aria-live="polite"></div>
          </div>
          <aside class="sr-rail">
            <div class="sr-rail-panel sr-live-winner" id="srLiveWinner"></div>
            <button type="button" class="sr-btn primary pulse sr-rail-cta" id="srQuickSpin" hidden>🎡 Girar próxima ruleta</button>
            <div class="sr-rail-panel">
              <h4>🏆 Ganadores recientes</h4>
              <div class="sr-rail-list" id="srRecentList"></div>
            </div>
          </aside>
        </div>
      </div>
      <div class="sr-modal" id="srModal" hidden></div>`;
    const modal=root.querySelector('#srModal');
    if(modal&&document.body&&modal.parentElement!==document.body)document.body.appendChild(modal);
    root.querySelectorAll('[data-sr-tab]').forEach(button=>button.addEventListener('click',()=>{
      state.tab=button.dataset.srTab;
      root.querySelectorAll('[data-sr-tab]').forEach(item=>item.classList.toggle('on',item===button));
      render();status('');
    }));
    root.querySelectorAll('[data-sr-hero-tab]').forEach(button=>button.addEventListener('click',()=>{
      state.tab=button.dataset.srHeroTab;syncTab();render();status('');
    }));
    byId('srHeroNewDraw')?.addEventListener('click',()=>openDraw(''));
  }

  async function load(force=false){
    if(state.loading||(state.loaded&&!force))return;
    state.loading=true;status('Actualizando sorteos…');
    try{
      const data=await api({accion:'cargar'});
      state.sorteos=Array.isArray(data.sorteos)?data.sorteos:[];
      state.premios=Array.isArray(data.premios)?data.premios:[];
      state.entregas=Array.isArray(data.entregas)?data.entregas:[];
      state.participantes=Array.isArray(data.participantes)?data.participantes:[];
      state.permisos=data.permisos||{alcance:'todos'};state.loaded=true;
      render();status(state.permisos.alcance==='relojes'?'Mostrando únicamente sorteos y premios de Relojes.':'Sorteos actualizados.','good');
    }catch(error){
      const body=byId('srBody');if(body)body.innerHTML=`<div class="sr-empty"><b>No se pudo cargar el módulo.</b><br>${esc(error.message)}</div>`;
      status(error.message,'bad');
    }finally{state.loading=false;}
  }

  function renderMetrics(){
    const target=byId('srMetrics');if(!target)return;
    const active=state.sorteos.filter(item=>item.estado==='activo').length;
    const tickets=state.sorteos.reduce((sum,item)=>sum+Number(item.totalBoletos||0),0);
    const pending=state.sorteos.filter(item=>item.ganador&&!state.entregas.some(delivery=>String(delivery.sorteoId)===String(item.id))) .length+
      state.entregas.filter(item=>!['entregado','listo'].includes(item.estado)).length;
    target.innerHTML=`
      <article><span class="sr-metric-icon red">🎟️</span><div><b>${tickets.toLocaleString('es-HN')}</b><small>boletos emitidos</small></div></article>
      <article><span class="sr-metric-icon blue">◉</span><div><b>${active}</b><small>sorteos activos</small></div></article>
      <article><span class="sr-metric-icon gold">🎁</span><div><b>${state.premios.filter(item=>item.activo!==false).length}</b><small>premios disponibles</small></div></article>
      <article><span class="sr-metric-icon green">✓</span><div><b>${pending}</b><small>elecciones pendientes</small></div></article>`;
  }
  function render(){
    renderMetrics();
    renderLiveWinner();
    renderRecentList();
    renderQuickSpin();
    if(state.tab==='premios')renderPrizes();
    else if(state.tab==='ganadores')renderWinners();
    else renderDraws();
  }

  function timeAgo(value){
    const date=dateObject(value);if(!date)return '';
    const diff=Math.max(0,Date.now()-date.getTime());
    const min=Math.floor(diff/60000);
    if(min<1)return 'justo ahora';
    if(min<60)return `hace ${min} min`;
    const hr=Math.floor(min/60);if(hr<24)return `hace ${hr}h`;
    return `hace ${Math.floor(hr/24)}d`;
  }
  function recentWinners(limit=6){
    return state.sorteos.filter(item=>item.ganador).sort((a,b)=>{
      const ta=dateObject(a.sorteadoAt||a.ganador?.elegidoAt)?.getTime()||0;
      const tb=dateObject(b.sorteadoAt||b.ganador?.elegidoAt)?.getTime()||0;
      return tb-ta;
    }).slice(0,limit);
  }
  function renderLiveWinner(){
    const target=byId('srLiveWinner');if(!target)return;
    const [latest]=recentWinners(1);
    if(!latest){
      target.classList.remove('is-live');
      target.innerHTML=`<div class="sr-live-empty"><span>🎡</span><b>Sin ganadores todavía</b><small>Cuando gire una ruleta, aparecerá aquí al instante.</small></div>`;
      return;
    }
    const winner=latest.ganador||{},delivery=deliveryFor(latest);
    const recent=(Date.now()-(dateObject(latest.sorteadoAt)?.getTime()||0))<180000;
    target.classList.toggle('is-live',recent);
    const stateLabel=!delivery?'Esperando que elija premio':(delivery.estado==='entregado'?'✔ Premio entregado':delivery.estado==='listo'?'Código listo':'Preparar entrega');
    target.innerHTML=`
      ${recent?'<span class="sr-live-badge">● EN VIVO</span>':'<span class="sr-live-badge muted">ÚLTIMO GANADOR</span>'}
      <span class="sr-live-crown">🏆</span>
      <b>${esc(winner.clienteNombre||'Cliente')}</b>
      <span class="sr-live-draw">${esc(latest.titulo||'Sorteo')}</span>
      <em>${esc(winner.codigo||'')}${winner.codigo&&latest.sorteadoAt?' · ':''}${esc(timeAgo(latest.sorteadoAt))}</em>
      <div class="sr-live-status">${esc(stateLabel)}</div>`;
  }
  function renderRecentList(){
    const target=byId('srRecentList');if(!target)return;
    const winners=recentWinners(6);
    target.innerHTML=winners.map(draw=>{
      const winner=draw.ganador||{},initial=esc((winner.clienteNombre||'C').trim().charAt(0).toUpperCase()||'C');
      return `<article><span class="sr-rail-avatar">${initial}</span><div><b>${esc(winner.clienteNombre||'Cliente')}</b><small>${esc(draw.titulo||'Sorteo')} · ${esc(timeAgo(draw.sorteadoAt))}</small></div></article>`;
    }).join('')||'<div class="sr-empty small">Aún no hay historial de ganadores.</div>';
  }
  function renderQuickSpin(){
    const button=byId('srQuickSpin');if(!button)return;
    const ready=state.sorteos.find(item=>item.estado==='cerrado'&&!item.ganador);
    button.hidden=!ready;
    button.onclick=ready?()=>openWheel(ready.id):null;
  }

  let pollTimer=null;
  function startPolling(){
    stopPolling();
    pollTimer=setInterval(()=>{
      if(document.getElementById('screen-sorteos')?.classList.contains('active'))load(true);
      else stopPolling();
    },25000);
  }
  function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}

  function drawPrizeNames(draw){
    return (draw.premioIds||[]).map(id=>state.premios.find(item=>item.id===id)?.nombre).filter(Boolean);
  }
  function drawCard(draw){
    const winner=draw.ganador;
    const prizes=drawPrizeNames(draw);
    const canEdit=!winner&&['borrador','activo'].includes(draw.estado);
    const canClose=!winner&&draw.estado==='activo';
    const canSpin=!winner&&draw.estado==='cerrado';
    const canBackfill=!winner&&draw.estado==='activo'&&['general','club_vip','oro'].includes(draw.categoria);
    const canDelete=!winner&&draw.estado!=='finalizado';
    const canAudit=!winner&&['activo','cerrado'].includes(draw.estado);
    const cardColor=safeHex(draw.color,themeAccent());
    return `<article class="sr-draw-card" style="--sr-item-accent:${esc(cardColor)}">
      <header><div><span class="sr-state ${esc(draw.estado||'borrador')}">${esc(ESTADOS[draw.estado]||draw.estado)}</span><span class="sr-scope">${esc(ALCANCES[draw.alcance]||draw.alcance)}</span></div><b class="sr-ticket-total">${Number(draw.totalBoletos)||0} <small>boletos</small></b></header>
      <h4>${esc(draw.titulo||'Sorteo')}</h4><p>${esc(draw.descripcion||'Los clientes participan automáticamente con sus compras y renovaciones.')}</p>
      <div class="sr-draw-meta"><span>◎ ${esc(CATEGORIAS[draw.categoria]||draw.categoria)}</span><span>⌛ ${dateText(draw.fechaFin)}</span></div>
      <div class="sr-prize-pills">${prizes.map(name=>`<span>🎁 ${esc(name)}</span>`).join('')||'<span>Sin premios visibles</span>'}</div>
      ${winner?`<div class="sr-winner-mini"><span>🏆</span><div><small>GANADOR</small><b>${esc(winner.clienteNombre||'Cliente')}</b><em>${esc(winner.codigo||'')}</em></div></div>`:''}
      <footer>
        <button type="button" class="sr-btn ghost" data-sr-tickets="${esc(draw.id)}">Ver boletos</button>
        ${canEdit?`<button type="button" class="sr-btn ghost" data-sr-edit-draw="${esc(draw.id)}">Editar</button>`:''}
        ${canBackfill?`<button type="button" class="sr-btn ghost" data-sr-backfill="${esc(draw.id)}">Cargar desde agosto 2026</button>`:''}
        ${canAudit?`<button type="button" class="sr-btn ghost" data-sr-audit="${esc(draw.id)}">✅ Recalcular boletos</button>`:''}
        ${canClose?`<button type="button" class="sr-btn dark" data-sr-close="${esc(draw.id)}">Cerrar participación</button>`:''}
        ${canSpin?`<button type="button" class="sr-btn primary pulse" data-sr-spin="${esc(draw.id)}">🎡 Girar ruleta</button>`:''}
        ${canDelete?`<button type="button" class="sr-btn danger" data-sr-delete="${esc(draw.id)}">🗑 Eliminar</button>`:''}
      </footer>
    </article>`;
  }
  function renderDraws(){
    const body=byId('srBody');if(!body)return;
    body.innerHTML=`<div class="sr-toolbar"><div><b>Campañas de premios</b><span>El ganador recibe o elige entre 1 y 5 premios digitales.</span></div><button type="button" class="sr-btn primary" id="srNewDraw">＋ Nuevo sorteo</button></div>
      <div class="sr-draw-grid">${state.sorteos.map(drawCard).join('')||'<div class="sr-empty"><b>Todavía no hay sorteos.</b><br>Cree al menos un premio y publique su primera campaña.</div>'}</div>`;
    byId('srNewDraw')?.addEventListener('click',()=>openDraw(''));
    body.querySelectorAll('[data-sr-edit-draw]').forEach(button=>button.addEventListener('click',()=>openDraw(button.dataset.srEditDraw)));
    body.querySelectorAll('[data-sr-backfill]').forEach(button=>button.addEventListener('click',()=>backfillAugust(button.dataset.srBackfill,button)));
    body.querySelectorAll('[data-sr-audit]').forEach(button=>button.addEventListener('click',()=>auditTickets(button.dataset.srAudit,button)));
    body.querySelectorAll('[data-sr-close]').forEach(button=>button.addEventListener('click',()=>closeDraw(button.dataset.srClose)));
    body.querySelectorAll('[data-sr-spin]').forEach(button=>button.addEventListener('click',()=>openWheel(button.dataset.srSpin)));
    body.querySelectorAll('[data-sr-tickets]').forEach(button=>button.addEventListener('click',()=>openTickets(button.dataset.srTickets)));
    body.querySelectorAll('[data-sr-delete]').forEach(button=>button.addEventListener('click',()=>deleteDraw(button.dataset.srDelete)));
  }

  function prizeCard(prize){
    const type=TIPO_PREMIO[prize.tipo]||TIPO_PREMIO.personalizado;
    const cardColor=safeHex(prize.color,themeAccent());
    return `<article class="sr-prize-card sr-prize-${esc(prize.tipo||'personalizado')}" style="--sr-prize:${esc(cardColor)};--sr-prize-on:${contrastColor(cardColor)}">
      <div class="sr-prize-top"><span class="sr-state ${prize.activo!==false?'activo':'borrador'}">${prize.activo!==false?'Disponible':'Oculto'}</span><span class="sr-scope">${esc(prize.ownerVendor==='relojes'?'Relojes':'Sublicuentas')}</span></div>
      <div class="sr-prize-icon" aria-hidden="true">${type[0]}</div>
      <div class="sr-prize-copy"><h4>${esc(prize.nombre)}</h4><p>${esc(prize.descripcion||prizeLabel(prize))}</p><small>${esc(stockText(prize))} · ${esc(type[1])}</small></div>
      <div class="sr-prize-actions"><button type="button" class="sr-btn ghost" data-sr-edit-prize="${esc(prize.id)}">Editar premio</button><button type="button" class="sr-btn danger" data-sr-delete-prize="${esc(prize.id)}">🗑 Eliminar</button></div>
    </article>`;
  }
  function renderPrizes(){
    const body=byId('srBody');if(!body)return;
    body.innerHTML=`<div class="sr-toolbar"><div><b>Catálogo de premios digitales</b><span>Perfiles, descuentos, cine, recargas, días extra o una opción personalizada.</span></div><div class="sr-toolbar-actions"><button type="button" class="sr-btn vip" id="srPrepareVip">👑 Preparar Club VIP</button><button type="button" class="sr-btn primary" id="srNewPrize">＋ Nuevo premio</button></div></div>
      <div class="sr-prize-grid">${state.premios.map(prizeCard).join('')||'<div class="sr-empty"><b>No hay premios todavía.</b><br>Agregue al menos uno para crear un sorteo.</div>'}</div>`;
    byId('srNewPrize')?.addEventListener('click',()=>openPrize(''));
    byId('srPrepareVip')?.addEventListener('click',prepareClubVip);
    body.querySelectorAll('[data-sr-edit-prize]').forEach(button=>button.addEventListener('click',()=>openPrize(button.dataset.srEditPrize)));
    body.querySelectorAll('[data-sr-delete-prize]').forEach(button=>button.addEventListener('click',()=>deletePrize(button.dataset.srDeletePrize)));
  }

  function deliveryFor(draw){return state.entregas.find(item=>String(item.sorteoId||'')===String(draw.id||''));}
  function renderWinners(){
    const body=byId('srBody');if(!body)return;
    const draws=state.sorteos.filter(item=>item.ganador);
    body.innerHTML=`<div class="sr-toolbar"><div><b>Ganadores y entregas</b><span>El cliente elige su premio desde su URL; aquí se completa la entrega manual.</span></div><button type="button" class="sr-btn ghost" id="srRefresh">↻ Actualizar</button></div>
      <div class="sr-winner-list">${draws.map(draw=>{
        const winner=draw.ganador||{},delivery=deliveryFor(draw);
        const stateLabel=!delivery?'Esperando elección':(delivery.estado==='entregado'?'Entregado':delivery.estado==='listo'?'Código listo':'Preparar entrega');
        return `<article class="sr-winner-row"><span class="sr-winner-crown">🏆</span><div class="sr-winner-person"><small>${esc(draw.titulo)}</small><b>${esc(winner.clienteNombre||'Cliente')}</b><span>${esc(winner.telefono||'Sin teléfono')} · ${esc(winner.codigo||'')}</span></div><div class="sr-winner-choice"><small>PREMIO ELEGIDO</small><b>${esc(delivery?.premioNombre||'Aún no ha elegido')}</b><span class="sr-delivery-state ${esc(delivery?.estado||'espera')}">${esc(stateLabel)}</span></div>${delivery&&delivery.estado!=='entregado'?`<button type="button" class="sr-btn primary" data-sr-deliver="${esc(delivery.id)}">Marcar entregado</button>`:''}</article>`;
      }).join('')||'<div class="sr-empty"><b>Aún no hay ganadores.</b><br>Cuando gire una ruleta, el resultado aparecerá aquí.</div>'}</div>`;
    byId('srRefresh')?.addEventListener('click',()=>load(true));
    body.querySelectorAll('[data-sr-deliver]').forEach(button=>button.addEventListener('click',()=>markDelivered(button.dataset.srDeliver)));
  }

  function typeOptions(selected){return Object.entries(TIPO_PREMIO).map(([value,item])=>`<option value="${value}" ${value===selected?'selected':''}>${item[0]} ${esc(item[1])}</option>`).join('');}
  function openPrize(id){
    const current=state.premios.find(item=>item.id===id);
    const accent=themeAccent();
    const prize=current?{...current}:{nombre:'',descripcion:'',tipo:'perfil',valor:1,unidad:'mes',plataforma:'',entregaModo:'manual',instrucciones:'',stock:1,activo:true,color:accent,ownerVendor:state.permisos.alcance==='relojes'?'relojes':'sublicuentas'};
    const modal=byId('srModal');if(!modal)return;modal.hidden=false;
    modal.innerHTML=`<form class="sr-sheet" id="srPrizeForm"><div class="sr-modal-head"><div><small>PREMIO DIGITAL</small><h3>${current?'Editar premio':'Nuevo premio'}</h3></div><button type="button" class="sr-close" aria-label="Cerrar">×</button></div>
      <div class="sr-form">
        <label class="sr-field wide">Nombre del premio<input id="srPrizeName" maxlength="120" required value="${esc(prize.nombre)}" placeholder="Ej. 1 mes de Netflix"></label>
        <label class="sr-field">Tipo<select id="srPrizeType">${typeOptions(prize.tipo)}</select></label>
        ${state.permisos.alcance==='todos'?`<label class="sr-field">Lo administra<select id="srPrizeOwner"><option value="sublicuentas" ${prize.ownerVendor!=='relojes'?'selected':''}>Sublicuentas</option><option value="relojes" ${prize.ownerVendor==='relojes'?'selected':''}>Relojes</option></select></label>`:''}
        <label class="sr-field">Valor<input id="srPrizeValue" type="number" min="0" step="1" value="${Number(prize.valor)||0}"></label>
        <label class="sr-field">Unidad<input id="srPrizeUnit" maxlength="40" value="${esc(prize.unidad||'')}" placeholder="mes, %, Lps., días"></label>
        <label class="sr-field wide">Plataforma o proveedor<input id="srPrizePlatform" maxlength="100" value="${esc(prize.plataforma||'')}" placeholder="Netflix, Cinemark, Tigo…"></label>
        <label class="sr-field wide">Descripción<textarea id="srPrizeDesc" maxlength="500" placeholder="Qué recibirá el ganador">${esc(prize.descripcion||'')}</textarea></label>
        <label class="sr-field">Forma de entrega<select id="srPrizeDelivery"><option value="manual" ${prize.entregaModo==='manual'?'selected':''}>Preparación manual</option><option value="codigo" ${prize.entregaModo==='codigo'?'selected':''}>Código / QR digital</option><option value="cupon" ${prize.entregaModo==='cupon'?'selected':''}>Cupón automático</option></select></label>
        <label class="sr-field">Existencias manuales<input id="srPrizeStock" type="number" min="0" max="9999" value="${Number(prize.stock)||0}"></label>
        <label class="sr-field wide">Nuevos códigos digitales · uno por línea<textarea id="srPrizeCodes" placeholder="CINE-ABC-123&#10;CINE-XYZ-456"></textarea><small>${current&&prize.entregaModo==='codigo'?`Ya hay ${Number(prize.codigosDisponibles)||0} código(s) guardados. Los nuevos se agregarán sin mostrarlos aquí.`:'Para boletos de cine u otros códigos virtuales.'}</small></label>
        <label class="sr-field wide">Instrucciones para el ganador<textarea id="srPrizeInstructions" maxlength="500" placeholder="Cómo usar o reclamar el premio">${esc(prize.instrucciones||'')}</textarea></label>
        <label class="sr-field color">Color<input id="srPrizeColor" type="color" value="${esc(safeHex(prize.color,accent))}"></label>
        <label class="sr-switch"><input id="srPrizeActive" type="checkbox" ${prize.activo!==false?'checked':''}><span></span> Premio disponible</label>
      </div><div class="sr-modal-actions"><button type="button" class="sr-btn ghost" id="srPrizeCancel">Cancelar</button><button type="submit" class="sr-btn primary">Guardar premio</button></div></form>`;
    modal.querySelector('.sr-close').onclick=closeModal;byId('srPrizeCancel').onclick=closeModal;
    byId('srPrizeType').addEventListener('change',event=>{
      const presets={perfil:['1','mes','manual'],descuento_porcentaje:['10','%','cupon'],descuento_fijo:['50','Lps.','cupon'],cine:['1','boleto','codigo'],recarga:['100','Lps.','manual'],dias_extra:['7','días','manual'],personalizado:['1','','manual']};
      const item=presets[event.target.value];if(!item)return;
      byId('srPrizeValue').value=item[0];byId('srPrizeUnit').value=item[1];byId('srPrizeDelivery').value=item[2];
    });
    byId('srPrizeForm').addEventListener('submit',async event=>{
      event.preventDefault();const button=event.submitter||event.currentTarget.querySelector('[type="submit"]');if(button)button.disabled=true;status('Guardando premio…');
      const payload={
        nombre:byId('srPrizeName').value.trim(),tipo:byId('srPrizeType').value,valor:Number(byId('srPrizeValue').value)||0,
        unidad:byId('srPrizeUnit').value.trim(),plataforma:byId('srPrizePlatform').value.trim(),descripcion:byId('srPrizeDesc').value.trim(),
        entregaModo:byId('srPrizeDelivery').value,stock:Number(byId('srPrizeStock').value)||0,
        codigos:byId('srPrizeCodes').value.split(/\r?\n/).map(item=>item.trim()).filter(Boolean),
        instrucciones:byId('srPrizeInstructions').value.trim(),color:byId('srPrizeColor').value,activo:byId('srPrizeActive').checked,
        ownerVendor:byId('srPrizeOwner')?.value||'relojes'
      };
      try{await api({accion:'guardar_premio',id:current?.id||'',premio:payload});closeModal();await load(true);state.tab='premios';render();status('Premio guardado y disponible para futuros sorteos.','good');}
      catch(error){status(error.message,'bad');if(button)button.disabled=false;}
    });
  }
  async function deletePrize(id){
    const prize=state.premios.find(item=>item.id===id);if(!prize)return;
    if(!confirm(`¿Eliminar el premio “${prize.nombre}”?\n\nSolo se permitirá si no está ligado a ningún sorteo ni entrega.`))return;
    status('Eliminando premio…');
    try{await api({accion:'eliminar_premio',id});await load(true);state.tab='premios';render();status('Premio eliminado correctamente.','good');}
    catch(error){status(error.message,'bad');}
  }
  async function prepareClubVip(){
    if(!confirm('¿Crear o actualizar los 3 premios oficiales del Club VIP?'))return;
    status('Preparando premios Club VIP…');
    try{await api({accion:'preparar_club_vip'});await load(true);state.tab='premios';render();status('Club VIP preparado con sus 3 premios oficiales.','good');}
    catch(error){status(error.message,'bad');}
  }

  function scopeOptions(selected){
    if(state.permisos.alcance==='relojes')return '<option value="relojes">Relojes</option>';
    return Object.entries(ALCANCES).map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${label}</option>`).join('');
  }
  function openDraw(id){
    const current=state.sorteos.find(item=>item.id===id);
    if(!current&&state.premios.filter(item=>item.activo!==false).length<1){state.tab='premios';syncTab();render();status('Cree al menos un premio antes de publicar un sorteo.','bad');return;}
    const accent=themeAccent();
    const draw=current?{...current}:{titulo:'',descripcion:'',categoria:'general',alcance:state.permisos.alcance==='relojes'?'relojes':'sublicuentas',estado:'activo',fechaInicio:defaultLocal(),fechaFin:defaultLocal(7),premioIds:[],reglas:{compra:1,renovacion:2,bonoNivel:false,limitePorCliente:30},color:accent};
    const rules={compra:1,renovacion:2,bonoNivel:false,limitePorCliente:30,...(draw.reglas||{})};
    const modal=byId('srModal');if(!modal)return;modal.hidden=false;
    modal.innerHTML=`<form class="sr-sheet wide" id="srDrawForm"><div class="sr-modal-head"><div><small>CAMPAÑA DE FIDELIDAD</small><h3>${current?'Editar sorteo':'Nuevo sorteo'}</h3></div><button type="button" class="sr-close" aria-label="Cerrar">×</button></div>
      <div class="sr-form">
        <label class="sr-field wide">Nombre del sorteo<input id="srDrawTitle" maxlength="140" required value="${esc(draw.titulo)}" placeholder="Ej. Gran sorteo de septiembre"></label>
        <label class="sr-field wide">Mensaje para los clientes<textarea id="srDrawDesc" maxlength="600" placeholder="Renueva a tiempo y gana más oportunidades…">${esc(draw.descripcion||'')}</textarea></label>
        <label class="sr-field">Categoría<select id="srDrawCategory">${Object.entries(CATEGORIAS).filter(([value])=>value!=='oro').map(([value,label])=>`<option value="${value}" ${value===(draw.categoria==='oro'?'club_vip':draw.categoria)?'selected':''}>${esc(label)}</option>`).join('')}</select></label>
        <label class="sr-field">Clientes de<select id="srDrawScope">${scopeOptions(draw.alcance)}</select></label>
        <label class="sr-field">Inicio<input id="srDrawStart" type="datetime-local" required value="${esc(localInput(draw.fechaInicio)||draw.fechaInicio||defaultLocal())}"></label>
        <label class="sr-field">Cierre<input id="srDrawEnd" type="datetime-local" required value="${esc(localInput(draw.fechaFin)||draw.fechaFin||defaultLocal(7))}"></label>
        <label class="sr-field">Publicación<select id="srDrawState"><option value="activo" ${draw.estado==='activo'?'selected':''}>Publicar ahora</option><option value="borrador" ${draw.estado==='borrador'?'selected':''}>Guardar borrador</option></select></label>
        <label class="sr-field color">Color<input id="srDrawColor" type="color" value="${esc(safeHex(draw.color,accent))}"></label>
        <div class="sr-form-section"><b>Boletos automáticos</b><span>La misma compra o renovación nunca se cuenta dos veces.</span></div>
        <label class="sr-field">Compra nueva<input id="srRuleBuy" type="number" value="1" disabled></label>
        <label class="sr-field">Renovación puntual<input id="srRuleRenew" type="number" value="2" disabled></label>
        <label class="sr-field">Bonos por nivel<input type="text" value="No aplican" disabled></label>
        <div class="sr-form-section"><b>6 niveles de fidelidad</b><span>Los niveles conservan sus beneficios y acceso Club VIP, pero no agregan boletos.</span></div>
        <div class="sr-vip-conditions wide" id="srVipConditions" ${['club_vip','oro'].includes(draw.categoria)?'':'hidden'}><b>👑 Condiciones Club VIP</b><span>Solo participan clientes Oro, Diamante y Élite que estén vigentes. El premio debe reclamarse en 72 horas, no se cambia por efectivo, no es transferible ni acumulable con otras promociones. Un ganador no repite durante 60 días.</span></div>
        <label class="sr-field">Máximo por cliente<input id="srRuleLimit" type="number" min="1" max="200" value="${Number(rules.limitePorCliente)}"></label>
        <div></div>
        <div class="sr-form-section"><b>Premio del ganador</b><span>Seleccione de 1 a 5 opciones. Con una opción, ese será el premio directo.</span></div>
        <div class="sr-prize-picker wide">${state.premios.filter(item=>item.activo!==false||(draw.premioIds||[]).includes(item.id)).map(prize=>`<label><input type="checkbox" data-sr-prize-choice value="${esc(prize.id)}" ${(draw.premioIds||[]).includes(prize.id)?'checked':''}><span class="sr-picker-icon">${(TIPO_PREMIO[prize.tipo]||TIPO_PREMIO.personalizado)[0]}</span><b>${esc(prize.nombre)}</b><small>${esc(stockText(prize))}</small></label>`).join('')}</div>
      </div><div class="sr-modal-actions"><span id="srDrawHint">Elija entre 1 y 5 premios.</span><button type="button" class="sr-btn ghost" id="srDrawCancel">Cancelar</button><button type="submit" class="sr-btn primary">Guardar sorteo</button></div></form>`;
    modal.querySelector('.sr-close').onclick=closeModal;byId('srDrawCancel').onclick=closeModal;
    byId('srDrawCategory').addEventListener('change',event=>{byId('srVipConditions').hidden=event.target.value!=='club_vip';});
    const choices=[...modal.querySelectorAll('[data-sr-prize-choice]')];
    choices.forEach(choice=>choice.addEventListener('change',()=>{
      const selected=choices.filter(item=>item.checked);
      if(selected.length>5){choice.checked=false;status('Puede ofrecer un máximo de cinco premios.','bad');}
      byId('srDrawHint').textContent=`${choices.filter(item=>item.checked).length} premio(s) seleccionado(s)`;
    }));
    byId('srDrawForm').addEventListener('submit',async event=>{
      event.preventDefault();const selected=choices.filter(item=>item.checked).map(item=>item.value);
      if(selected.length<1||selected.length>5){status('Seleccione entre 1 y 5 premios para el ganador.','bad');return;}
      const button=event.submitter||event.currentTarget.querySelector('[type="submit"]');if(button)button.disabled=true;status('Guardando sorteo…');
      const startValue=byId('srDrawStart').value,endValue=byId('srDrawEnd').value;
      const payload={titulo:byId('srDrawTitle').value.trim(),descripcion:byId('srDrawDesc').value.trim(),categoria:byId('srDrawCategory').value,
        alcance:byId('srDrawScope').value,estado:byId('srDrawState').value,fechaInicio:startValue?new Date(startValue).toISOString():'',fechaFin:endValue?new Date(endValue).toISOString():'',
        color:byId('srDrawColor').value,premioIds:selected,reglas:{compra:1,renovacion:2,
          bonoNivel:false,limitePorCliente:Number(byId('srRuleLimit').value)}};
      try{await api({accion:'guardar_sorteo',id:current?.id||'',sorteo:payload});closeModal();await load(true);state.tab='sorteos';render();status('Sorteo guardado. Los próximos eventos válidos generarán boletos automáticamente.','good');}
      catch(error){status(error.message,'bad');if(button)button.disabled=false;}
    });
  }

  function syncTab(){
    host()?.querySelectorAll('[data-sr-tab]').forEach(item=>item.classList.toggle('on',item.dataset.srTab===state.tab));
  }
  async function backfillAugust(id,button){
    const draw=state.sorteos.find(item=>item.id===id);if(!draw)return;
    if(button)button.disabled=true;
    status('Preparando auditoría de agosto…');
    let reset=true,last=null;
    try{
      const preview=await api({accion:'cargar_agosto_2026',id,previsualizar:true});
      const approved=confirm(`AUDITORÍA PREVIA · DESDE AGOSTO 2026\n\nClientes detectados: ${Number(preview.clientesDetectados)||0}\nCompras: ${Number(preview.compras)||0}\nRenovaciones por servicio: ${Number(preview.renovaciones)||0}\nBoletos estimados: ${Number(preview.boletosEstimados)||0}\n\n¿Autoriza emitir estos boletos en “${draw.titulo}”?`);
      if(!approved)return;
      status('Emitiendo boletos auditados de agosto…');
      do{
        last=await api({accion:'cargar_agosto_2026',id,reiniciar:reset});
        reset=false;
        status(`Carga de agosto: ${Number(last.procesados)||0} de ${Number(last.totalTareas)||0} operaciones revisadas · ${Number(last.boletosCreados)||0} boletos creados.`);
      }while(last&&!last.completado);
      await load(true);
      const errors=Number(last?.errores)||0;
      status(`Agosto cargado: ${Number(last?.clientesDetectados)||0} cliente(s) detectados y ${Number(last?.boletosCreados)||0} boleto(s) nuevos.${errors?` ${errors} registro(s) requieren revisión.`:' Sin duplicados.'}`,errors?'bad':'good');
    }catch(error){
      status(error.message,'bad');
    }finally{if(button&&document.body.contains(button))button.disabled=false;}
  }
  async function closeDraw(id){
    const draw=state.sorteos.find(item=>item.id===id);if(!draw)return;
    if(!confirm(`¿Cerrar la participación de “${draw.titulo}”? Después podrá girar la ruleta.`))return;
    status('Cerrando participación…');
    try{await api({accion:'cerrar_sorteo',id});await load(true);status('Participación cerrada. La ruleta ya está lista.','good');}
    catch(error){status(error.message,'bad');}
  }
  async function auditTickets(id,button){
    const draw=state.sorteos.find(item=>item.id===id);if(!draw)return;
    if(!confirm(`Se reconstruirán todos los boletos de “${draw.titulo}” usando únicamente operaciones comprobadas desde agosto: 1 por compra y 2 por renovación, sin bonos por nivel. ¿Continuar?`))return;
    if(button)button.disabled=true;status('Corrigiendo boletos con la regla estricta…');
    try{
      const result=await api({accion:'corregir_boletos',id,reiniciar:true});let reset=true,last=null;
      do{last=await api({accion:'cargar_agosto_2026',id,reiniciar:reset});reset=false;status(`Recalculando: ${Number(last.procesados)||0} de ${Number(last.totalTareas)||0} operaciones…`);}while(last&&!last.completado);
      await load(true);status(`Boletos reconstruidos: ${Number(result.antes)||0} anteriores eliminados · ${Number(last?.boletosCreados)||0} boletos estrictos creados.`,'good');
    }
    catch(error){status(error.message,'bad');}
    finally{if(button&&document.body.contains(button))button.disabled=false;}
  }
  async function deleteDraw(id){
    const draw=state.sorteos.find(item=>item.id===id);if(!draw)return;
    const total=Number(draw.totalBoletos)||0;
    if(!confirm(`¿Eliminar definitivamente “${draw.titulo}”?\n\nSe borrarán también sus ${total} boleto(s). Esta acción no se puede deshacer.`))return;
    status('Eliminando sorteo de prueba y sus registros…');
    try{const result=await api({accion:'eliminar_sorteo',id});await load(true);status(`Sorteo eliminado. Se limpiaron ${Number(result.registrosEliminados)||0} registros relacionados.`,'good');}
    catch(error){status(error.message,'bad');}
  }
  function openWheel(id){
    const draw=state.sorteos.find(item=>item.id===id),modal=byId('srModal');if(!draw||!modal)return;
    const tickets=state.participantes.filter(item=>String(item.sorteoId)===String(id));
    const people=new Map();tickets.forEach(ticket=>{const key=String(ticket.clientId||ticket.clienteNombre||ticket.id);const person=people.get(key)||{nombre:ticket.clienteNombre||'Cliente',boletos:0,codigos:[]};person.boletos+=1;person.codigos.push(ticket.codigo);people.set(key,person);});
    const rows=[...people.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map((person,index)=>`<article><i>${index+1}</i><div><b>${esc(person.nombre)}</b><span>${person.boletos} boleto${person.boletos===1?'':'s'}</span></div><small>${esc(person.codigos.join(', '))}</small></article>`).join('');
    modal.hidden=false;modal.innerHTML=`<div class="sr-sheet sr-wheel-sheet"><div class="sr-modal-head"><div><small>🔴 SORTEO EN VIVO · AUDITABLE</small><h3>${esc(draw.titulo)}</h3></div><button type="button" class="sr-close" aria-label="Cerrar">×</button></div>
      <div class="sr-wheel-layout"><section class="sr-wheel-visual"><div class="sr-wheel-stage"><span class="sr-wheel-pointer">▼</span><div class="sr-wheel" id="srWheel"><div><b>${tickets.length}</b><span>boletos<small>participan</small></span></div></div></div><div class="sr-wheel-live" id="srWheelLive">Al girar verá pasar cada boleto participante.</div></section>
      <section class="sr-wheel-panel"><p class="sr-wheel-note">Todos los boletos vigentes participan. La elección es aleatoria, se realiza una sola vez y queda registrada.</p><div class="sr-wheel-facts"><span>👥 <b>${people.size}</b> clientes vigentes</span><span>🎟️ <b>${tickets.length}</b> boletos</span><span>🔀 Selección <b>aleatoria</b></span></div>
      <details class="sr-participants" open><summary>Ver lista completa de participantes <b>${people.size}</b></summary><div class="sr-participant-list">${rows||'<div class="sr-empty">No hay participantes vigentes.</div>'}</div></details><div class="sr-wheel-result" id="srWheelResult"><span>🏆 Todo listo para conocer al ganador.</span></div><div class="sr-modal-actions"><button type="button" class="sr-btn ghost" id="srWheelCancel">Cancelar</button><button type="button" class="sr-btn primary pulse" id="srWheelGo">🎡 INICIAR SORTEO</button></div></section></div></div>`;
    modal.querySelector('.sr-close').onclick=closeModal;byId('srWheelCancel').onclick=closeModal;
    byId('srWheelGo').onclick=async event=>{
      event.currentTarget.disabled=true;byId('srWheelCancel').disabled=true;byId('srWheel').classList.add('spinning');
      byId('srWheelResult').innerHTML='<span>Mezclando todos los boletos…</span>';status('Realizando sorteo seguro…');
      try{
        const data=await api({accion:'girar_ruleta',id}),winner=data.ganador||{},pool=Array.isArray(data.ruleta)?data.ruleta:[];
        let pos=0;const live=byId('srWheelLive');
        await new Promise(resolve=>{const timer=setInterval(()=>{const ticket=pool[pos%Math.max(1,pool.length)];if(ticket&&live)live.innerHTML=`<b>${esc(ticket.codigo)}</b><span>${esc(ticket.clienteNombre)}</span>`;pos+=1;if(pos>=Math.max(pool.length,36)){clearInterval(timer);resolve();}},Math.max(28,Math.min(75,2200/Math.max(1,pool.length))));});
        byId('srWheel').classList.remove('spinning');byId('srWheel').classList.add('done');
        if(live)live.innerHTML=`<b>${esc(winner.codigo||'')}</b><span>${esc(winner.clienteNombre||'Cliente')}</span>`;
        byId('srWheelResult').innerHTML=`<small>🏆 GANADOR</small><b>${esc(winner.clienteNombre||'Cliente')}</b><strong>${esc(winner.codigo||'')}</strong><span>${Number(data.totalParticipantes)||pool.length} boletos incluidos · prueba ${esc((data.auditoria?.hashParticipantes||'').slice(0,12))}</span>`;
        event.currentTarget.hidden=true;byId('srWheelCancel').disabled=false;byId('srWheelCancel').textContent='Cerrar';await load(true);status('Ganador guardado correctamente.','good');
      }catch(error){byId('srWheel').classList.remove('spinning');event.currentTarget.disabled=false;byId('srWheelCancel').disabled=false;byId('srWheelResult').innerHTML=`<span>${esc(error.message)}</span>`;status(error.message,'bad');}
    };
  }
  function openTickets(id){
    const draw=state.sorteos.find(item=>item.id===id),tickets=state.participantes.filter(item=>String(item.sorteoId)===String(id)),modal=byId('srModal');if(!draw||!modal)return;
    modal.hidden=false;modal.innerHTML=`<div class="sr-sheet wide"><div class="sr-modal-head"><div><small>BOLETOS PARTICIPANTES</small><h3>${esc(draw.titulo)}</h3></div><button type="button" class="sr-close" aria-label="Cerrar">×</button></div>
      <div class="sr-ticket-list">${tickets.map(ticket=>`<article><b>${esc(ticket.codigo)}</b><span>${esc(ticket.clienteNombre||'Cliente')}</span><small>${esc(ticket.tipo==='renovacion'?'Renovación':ticket.tipo==='oro'?'Bono Oro':'Compra nueva')}</small></article>`).join('')||'<div class="sr-empty">No hay boletos emitidos todavía.</div>'}</div>
      ${Number(draw.totalBoletos)>tickets.length?`<p class="sr-list-note">Mostrando los boletos recientes disponibles en esta vista. Total registrado: ${Number(draw.totalBoletos)}.</p>`:''}<div class="sr-modal-actions"><button type="button" class="sr-btn primary" id="srTicketClose">Cerrar</button></div></div>`;
    modal.querySelector('.sr-close').onclick=closeModal;byId('srTicketClose').onclick=closeModal;
  }
  async function markDelivered(id){
    if(!confirm('¿Confirma que el premio ya fue entregado al cliente?'))return;
    status('Registrando entrega…');
    try{await api({accion:'marcar_entregado',id});await load(true);state.tab='ganadores';render();status('Premio marcado como entregado.','good');}
    catch(error){status(error.message,'bad');}
  }

  let visibilityObserver=null;
  function watchVisibility(){
    const screen=document.getElementById('screen-sorteos');if(!screen||visibilityObserver)return;
    let wasActive=screen.classList.contains('active');
    visibilityObserver=new MutationObserver(()=>{
      const active=screen.classList.contains('active');
      if(active&&!wasActive){shell();load();startPolling();}
      if(!active&&wasActive)stopPolling();
      wasActive=active;
    });
    visibilityObserver.observe(screen,{attributes:true,attributeFilter:['class']});
  }
  function init(){watchTheme();shell();watchVisibility();if(document.getElementById('screen-sorteos')?.classList.contains('active')){load();startPolling();}}
  window.SublichatSorteos={open:()=>{watchTheme();shell();watchVisibility();load();startPolling();},reload:()=>load(true)};
  document.addEventListener('DOMContentLoaded',init);
})();
