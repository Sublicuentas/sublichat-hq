/* SUBLICHAT HQ · "Atrapa tu Premio" — administración (Oct-2026)
   - Pestaña 🎮 dentro de Sorteos: KPIs, encender/pausar, premios (activo/peso/costo/inventario), reglas por lote,
     dar fichas manuales, pendientes de entrega y lotes (quién dio, por qué y cuándo).
   - Modal "🎮 Dar fichas de juego" después de una renovación confirmada con pago (sublichat-app.js).
   - Config y premios: solo Sublicuentas (el servidor lo valida). Dar fichas y entregar: Sublicuentas y Relojes.
   - Las fichas NO tocan el boleto del sorteo mensual. */
(function sublichatJuegoAdmin(){
  'use strict';
  const API='/api/sorteos';
  const S={data:null,loading:false,body:null,status:()=>{}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const L=n=>`L${Math.round(Number(n)||0).toLocaleString('es-HN')}`;
  const TIER={comun:'Común',medio:'Medio',premium:'Premium'};
  const ORIGEN={renovacion:'Renovación',fidelidad:'Fidelidad',promocion:'Promoción',compensacion:'Compensación'};
  const ESTADO={ganado:'Ganado',reservado:'Reservado',pendiente_entrega:'Pendiente de entrega',entregado:'Entregado',vencido:'Vencido'};
  const INV={ilimitado:'Ilimitado',stock:'Stock',bodega:'Bodega'};
  const fecha=iso=>{const d=new Date(iso);return isNaN(d)?'—':d.toLocaleString('es-HN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})};
  // Igual que api/_juego-premios.js fichasSugeridas (1→1 · 2-3→2 · 4-6→3 · 7-12→4)
  const sugeridas=m=>{m=Math.max(1,Math.round(Number(m)||1));return m<=1?1:m<=3?2:m<=6?3:4;};
  const reqId=()=>(crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`);

  async function api(payload){
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{})});
    const t=await r.text();let j={};try{j=t?JSON.parse(t):{};}catch(_){j={ok:false,error:t||'Respuesta inválida.'};}
    if(!r.ok||!j.ok)throw new Error(j.error||`Error HTTP ${r.status}`);
    return j;
  }
  async function cargar(){
    if(S.loading)return;S.loading=true;
    try{S.data=await api({accion:'juego_cargar'});}
    finally{S.loading=false;}
  }

  /* ---------- Pestaña ---------- */
  async function render(body,ctx={}){
    S.body=body;S.status=ctx.status||(()=>{});
    if(!body)return;
    if(!S.data){body.innerHTML='<div class="sr-empty">Cargando Atrapa tu Premio…</div>';
      try{await cargar();}catch(e){body.innerHTML=`<div class="sr-empty"><b>No se pudo cargar el juego.</b><br>${esc(e.message)}</div>`;return;}}
    pintar();
  }
  function pintar(){
    const body=S.body,d=S.data;if(!body||!d)return;
    const admin=d.permisos?.config===true,cfg=d.config||{},k=d.kpis||{};
    const pend=(d.ganados||[]).filter(g=>['ganado','reservado','pendiente_entrega'].includes(g.estado));
    body.innerHTML=`<div class="jpa">
      <div class="sr-toolbar"><div><b>🎮 Atrapa tu Premio</b><span>Minijuego del portal del cliente. Separado del sorteo mensual: no crea ni cambia boletos.</span></div>
        <div class="sr-toolbar-actions">
          <label class="jpa-switch ${cfg.activo!==false?'on':''}" title="${admin?'Encender o pausar el juego para todos':'Solo Sublicuentas'}"><input type="checkbox" id="jpaActivo" ${cfg.activo!==false?'checked':''} ${admin?'':'disabled'}><span></span>${cfg.activo!==false?'Juego activo':'Juego en pausa'}</label>
          <button type="button" class="sr-btn primary" id="jpaDar">🎮 Dar fichas</button>
          <button type="button" class="sr-btn ghost" id="jpaRef">↻</button></div></div>
      <section class="jpa-kpis">
        <article><b>${Number(k.fichasActivas)||0}</b><small>fichas activas</small></article>
        <article class="${k.pendientes?'warn':''}"><b>${Number(k.pendientes)||0}</b><small>premios pendientes</small></article>
        <article><b>${Number(k.premiumEntregadosMes)||0}</b><small>Premium entregados del mes</small></article>
        <article><b>${L(k.costoMes)}</b><small>costo interno del mes</small></article>
      </section>
      <section class="jpa-card"><h4>Pendientes de entrega <span>${pend.length}</span></h4>
        ${pend.length?`<div class="jpa-list">${pend.map(g=>`<article class="jpa-row">
          <div><b>${esc(g.clienteNombre||g.clienteId)}</b><small>${esc(g.premio?.nombre||g.premioId)} · ${esc(TIER[g.tier]||g.tier||'')}${g.reservaBodega?` · cupo reservado en ${esc(g.reservaBodega)}`:''}</small>
            <small>Ganó ${fecha(g.ganadoAt)}${g.expiraAt?` · vence ${fecha(g.expiraAt)}`:''}${g.entregaError?` · ⚠️ ${esc(g.entregaError)}`:''}</small></div>
          <span class="jpa-estado ${esc(g.estado)}">${esc(ESTADO[g.estado]||g.estado)}</span>
          <div class="jpa-acciones">${g.estado==='ganado'&&g.entregaModo==='automatica'?`<button type="button" class="sr-btn ghost" data-jpa-reint="${esc(g.id)}">Reintentar</button>`:''}<button type="button" class="sr-btn primary" data-jpa-ent="${esc(g.id)}">Marcar entregado</button></div>
        </article>`).join('')}</div>`:'<div class="sr-empty">No hay premios pendientes.</div>'}
      </section>
      <section class="jpa-card"><h4>Reglas por lote ${admin?'':'<em>solo Sublicuentas</em>'}</h4>
        <div class="jpa-reglas">
          <label>Máx. Premium por lote<input type="number" id="jpaMaxPrem" min="0" max="4" value="${Number(cfg.maxPremiumPorLote??1)}" ${admin?'':'disabled'}></label>
          <label>Tope de costo por lote (L)<input type="number" id="jpaTope" min="0" step="1" value="${Number(cfg.topeCostoLote??200)}" ${admin?'':'disabled'}></label>
          <label>Días para reclamar<input type="number" id="jpaDias" min="1" max="60" value="${Number(cfg.diasReclamo??7)}" ${admin?'':'disabled'}></label>
          ${admin?'<button type="button" class="sr-btn primary" id="jpaGuardarCfg">Guardar reglas</button>':''}
        </div></section>
      <section class="jpa-card"><h4>Premios</h4><div class="jpa-tabla-wrap"><table class="jpa-tabla">
        <thead><tr><th>Premio</th><th>Nivel</th><th>Activo</th><th>Peso</th><th>Costo L</th><th>Inventario</th><th>Stock</th>${admin?'<th></th>':''}</tr></thead>
        <tbody>${(d.premios||[]).map(p=>`<tr data-jpa-premio="${esc(p.id)}">
          <td><b>${esc(p.nombre)}</b><small>${esc(p.etiqueta||'')}${p.plataforma?` · ${esc(p.plataforma)}`:''}</small></td>
          <td><span class="jpa-tier ${esc(p.tier)}">${esc(TIER[p.tier]||p.tier)}</span></td>
          <td><input type="checkbox" data-f="activo" ${p.activo!==false?'checked':''} ${admin?'':'disabled'}></td>
          <td><input type="number" data-f="peso" min="0" step="1" value="${Number(p.peso)||0}" ${admin?'':'disabled'}></td>
          <td><input type="number" data-f="costoHnl" min="0" step="1" value="${Number(p.costoHnl)||0}" ${admin?'':'disabled'}></td>
          <td><select data-f="inventarioModo" ${admin?'':'disabled'}>${Object.entries(INV).filter(([m])=>p.tipo==='mes_gratis'||m==='ilimitado').map(([m,t])=>`<option value="${m}" ${p.inventarioModo===m?'selected':''}>${t}</option>`).join('')}</select></td>
          <td><input type="number" data-f="stock" min="0" step="1" value="${Number(p.stock)||0}" ${admin&&p.inventarioModo==='stock'?'':'disabled'}></td>
          ${admin?`<td><button type="button" class="sr-btn ghost" data-jpa-gp="${esc(p.id)}">Guardar</button></td>`:''}
        </tr>`).join('')}</tbody></table></div>
        <p class="jpa-nota">El peso es la probabilidad relativa entre premios válidos. Netflix nunca es premio de 1 mes gratis. Bodega = usa cupos libres de Bodega cuando el cliente no tiene la plataforma.</p></section>
      <section class="jpa-card"><h4>Lotes recientes · auditoría</h4>
        ${(d.lotes||[]).length?`<div class="jpa-list">${d.lotes.slice(0,30).map(l=>`<article class="jpa-row">
          <div><b>${esc(l.clienteNombre||l.clienteId)}</b><small>${esc(ORIGEN[l.origen]||l.origen)} · ${esc(l.motivo||'')}${l.renovacion?.meses?` · ${l.renovacion.meses} mes(es) → sugerido ${l.fichasSugeridas}`:''}</small>
          <small>Dio: ${esc(l.otorgadoPor||'—')} · ${fecha(l.otorgadoAt)} · ${(l.premiosGanados||[]).length?`ganó: ${esc((l.premiosGanados||[]).join(', '))} · ${L(l.costoTotal)}`:'sin jugar'}</small></div>
          <span class="jpa-fichas">${Number(l.fichasUsadas)||0}/${Number(l.fichas)||0}</span></article>`).join('')}</div>`:'<div class="sr-empty">Todavía no se han dado fichas.</div>'}
      </section></div>`;
    const q=s=>body.querySelector(s);
    q('#jpaRef').onclick=async()=>{S.data=null;await render(body,{status:S.status});};
    q('#jpaDar').onclick=()=>abrirDarFichas({});
    q('#jpaActivo').onchange=async e=>{
      const on=e.target.checked;
      if(!on&&!confirm('¿Pausar el juego para todos los clientes? Las fichas quedan guardadas.')){e.target.checked=true;return;}
      await guardarCfg({...cfg,activo:on});
    };
    q('#jpaGuardarCfg')?.addEventListener('click',()=>guardarCfg({...cfg,maxPremiumPorLote:Number(q('#jpaMaxPrem').value),topeCostoLote:Number(q('#jpaTope').value),diasReclamo:Number(q('#jpaDias').value)}));
    body.querySelectorAll('[data-jpa-premio] [data-f="inventarioModo"]').forEach(sel=>sel.addEventListener('change',()=>{const st=sel.closest('tr').querySelector('[data-f="stock"]');st.disabled=sel.value!=='stock';}));
    body.querySelectorAll('[data-jpa-gp]').forEach(b=>b.addEventListener('click',()=>guardarPremio(b.dataset.jpaGp,b)));
    body.querySelectorAll('[data-jpa-ent]').forEach(b=>b.addEventListener('click',()=>entregar(b.dataset.jpaEnt,'marcar',b)));
    body.querySelectorAll('[data-jpa-reint]').forEach(b=>b.addEventListener('click',()=>entregar(b.dataset.jpaReint,'reintentar',b)));
  }
  async function refrescar(msg){S.data=null;await render(S.body,{status:S.status});if(msg)S.status(msg,'good');}
  async function guardarCfg(config){
    try{S.status('Guardando…');await api({accion:'juego_guardar_config',config});await refrescar(config.activo===false?'Juego en pausa. Las fichas quedan guardadas.':'Reglas guardadas.');}
    catch(e){S.status(e.message,'bad');pintar();}
  }
  async function guardarPremio(id,btn){
    const p=(S.data?.premios||[]).find(x=>x.id===id);const tr=S.body.querySelector(`[data-jpa-premio="${CSS.escape(id)}"]`);if(!p||!tr)return;
    const v=f=>tr.querySelector(`[data-f="${f}"]`);
    const premio={...p,activo:v('activo').checked,peso:Number(v('peso').value)||0,costoHnl:Number(v('costoHnl').value)||0,inventarioModo:v('inventarioModo').value,stock:Number(v('stock').value)||0};
    btn.disabled=true;
    try{await api({accion:'juego_guardar_premio',premio});await refrescar(`${p.nombre}: guardado.`);}
    catch(e){S.status(e.message,'bad');btn.disabled=false;}
  }
  async function entregar(id,modo,btn){
    let nota='';
    if(modo==='marcar'){nota=prompt('Nota de entrega (opcional): ej. "perfil 3 de la cuenta X" o "aplicado en compra del 30/10"','');if(nota===null)return;}
    btn.disabled=true;
    try{await api({accion:'juego_entregar',id,modo,nota});await refrescar(modo==='reintentar'?'Premio aplicado.':'Premio marcado como entregado.');}
    catch(e){S.status(e.message,'bad');btn.disabled=false;}
  }

  /* ---------- Modal Dar fichas (manual o después de renovar) ---------- */
  function clientes(){
    // DATA es la lista global de Sublichat (una fila por servicio). Se agrupa por cliente + beneficiario.
    const fuente=Array.isArray(window.__sublichatClientes)?window.__sublichatClientes:((typeof DATA!=='undefined'&&Array.isArray(DATA))?DATA:[]);
    const rows=fuente;const m=new Map();
    for(const r of rows){if(!r.clienteId)continue;const key=`${r.clienteId}|${r.beneficiarioKey||'titular'}`;
      const x=m.get(key)||{clienteId:r.clienteId,beneficiarioKey:r.beneficiarioKey||'titular',nombre:r.beneficiarioTipo==='tercero'?`${r.beneficiarioNombre} (de ${r.nombre})`:r.nombre,telefono:r.telefono||'',plats:new Set()};
      x.plats.add(r.plataforma);x.buscar=`${r.nombre||''} ${r.beneficiarioNombre||''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');m.set(key,x);}
    return [...m.values()];
  }
  function modal(){
    let el=document.getElementById('jpaModal');
    if(!el){el=document.createElement('div');el.id='jpaModal';el.className='sr-modal';el.hidden=true;document.body.appendChild(el);}
    return el;
  }
  const cerrarModal=()=>{const el=document.getElementById('jpaModal');if(el){el.hidden=true;el.innerHTML='';}};
  /* opts: { clienteId, beneficiarioKey, nombre, meses, renovacion:{key,compraId,meses,pagoOperacionId}, alTerminar } */
  function abrirDarFichas(opts={}){
    const ren=opts.renovacion||null,sug=ren?sugeridas(ren.meses):1;
    const el=modal();el.hidden=false;
    el.innerHTML=`<form class="sr-sheet jpa-dar" id="jpaDarForm"><div class="sr-modal-head"><div><small>ATRAPA TU PREMIO</small><h3>🎮 Dar fichas de juego</h3></div><button type="button" class="sr-close" aria-label="Cerrar">×</button></div>
      ${ren?`<div class="jpa-ren"><b>${esc(opts.nombre||'Cliente')}</b><span>Renovación confirmada · ${Number(ren.meses)} mes(es) → sugerido <b>${sug}</b> ficha${sug>1?'s':''}</span></div>`
        :`<label class="sr-field wide">Cliente<input id="jpaBuscar" placeholder="Nombre o teléfono" autocomplete="off"></label><div class="jpa-resultados" id="jpaRes"></div>`}
      <div class="sr-field wide">Fichas<div class="jpa-num" id="jpaNum">${[1,2,3,4].map(n=>`<button type="button" data-n="${n}" class="${n===sug?'on':''}">${n}${n===sug&&ren?' ★':''}</button>`).join('')}</div><small>1 ficha = 1 jugada = 1 premio. Máximo 4 por lote.</small></div>
      ${ren?'':`<label class="sr-field">Motivo<select id="jpaOrigen"><option value="fidelidad">Fidelidad</option><option value="promocion">Promoción</option><option value="compensacion">Compensación</option></select></label>`}
      <label class="sr-field wide">${ren?'Nota (opcional)':'Detalle del motivo'}<input id="jpaMotivo" maxlength="200" placeholder="${ren?'Renovación confirmada':'Ej. cliente frecuente, error en entrega del 20/10…'}"></label>
      <p class="jpa-nota">Las fichas no cambian el boleto del sorteo mensual.</p>
      <div class="sr-modal-actions"><span id="jpaMsg" class="jpa-msg"></span><button type="button" class="sr-btn ghost" id="jpaNo">${ren?'Ahora no':'Cancelar'}</button><button type="submit" class="sr-btn primary" id="jpaSi">Dar fichas</button></div></form>`;
    let fichas=sug,elegido=ren?{clienteId:opts.clienteId,beneficiarioKey:opts.beneficiarioKey||'titular',nombre:opts.nombre}:null;
    const requestId=reqId(); // reabrir o doble clic dentro del mismo modal no crea otro lote
    el.querySelector('.sr-close').onclick=cerrarModal;el.querySelector('#jpaNo').onclick=cerrarModal;
    el.querySelectorAll('#jpaNum [data-n]').forEach(b=>b.onclick=()=>{fichas=Number(b.dataset.n);el.querySelectorAll('#jpaNum [data-n]').forEach(x=>x.classList.toggle('on',x===b));});
    const buscar=el.querySelector('#jpaBuscar');
    if(buscar){
      const lista=clientes();
      const pintarRes=()=>{const t=buscar.value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');const dig=t.replace(/\D/g,'');
        const res=t.length<2?[]:lista.filter(c=>c.buscar.includes(t)||(dig.length>=4&&String(c.telefono).replace(/\D/g,'').includes(dig))).slice(0,8);
        el.querySelector('#jpaRes').innerHTML=res.map((c,i)=>`<button type="button" data-i="${i}" class="${elegido&&elegido.clienteId===c.clienteId&&elegido.beneficiarioKey===c.beneficiarioKey?'on':''}"><b>${esc(c.nombre)}</b><small>${esc(c.telefono)} · ${esc([...c.plats].join(', '))}</small></button>`).join('')||(t.length>=2?'<small>Sin resultados.</small>':'');
        el.querySelectorAll('#jpaRes [data-i]').forEach(b=>b.onclick=()=>{elegido=res[Number(b.dataset.i)];buscar.value=elegido.nombre;pintarRes();});};
      buscar.addEventListener('input',()=>{elegido=null;pintarRes();});buscar.focus();
    }
    el.querySelector('#jpaDarForm').onsubmit=async e=>{
      e.preventDefault();const msg=el.querySelector('#jpaMsg'),btn=el.querySelector('#jpaSi');
      if(!elegido){msg.textContent='Elija un cliente.';return;}
      const motivo=el.querySelector('#jpaMotivo').value.trim();
      if(!ren&&motivo.length<4){msg.textContent='Escriba el motivo.';return;}
      btn.disabled=true;msg.textContent='Dando fichas…';
      try{
        const r=await api({accion:'juego_dar_fichas',clienteId:elegido.clienteId,beneficiarioKey:elegido.beneficiarioKey,fichas,
          origen:ren?'renovacion':el.querySelector('#jpaOrigen').value,motivo:motivo||(ren?'Renovación confirmada':''),renovacion:ren,requestId});
        const lote=r.lote||{};
        cerrarModal();
        const txt=lote.duplicado?`Esta renovación ya tenía ${lote.fichas} ficha(s); no se duplicaron.`:`✅ ${fichas} ficha${fichas>1?'s':''} para ${elegido.nombre}. Las ve en su enlace del portal.`;
        if(typeof window.mostrarToast==='function')window.mostrarToast(txt);else if(typeof mostrarToast==='function')mostrarToast(txt);S.status(txt,'good');
        if(S.body&&document.body.contains(S.body))await refrescar();
        opts.alTerminar?.(lote);
      }catch(err){msg.textContent=err.message;btn.disabled=false;}
    };
  }

  /* Llamado por sublichat-app.js al confirmar una renovación con pago.
     confirmadas: [{servicio, resultado}] · duracion: {unidad, cantidad} | null · fechaExacta: 'aaaa-mm-dd' | null */
  function ofrecerTrasRenovar({g,confirmadas=[],duracion=null,pagoOperacionId=''}={}){
    if(!g||!confirmadas.length)return;
    const dmy=s=>{const m=String(s||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return m?new Date(+m[3],+m[2]-1,+m[1]):null;};
    let meses=1;
    if(duracion&&duracion.unidad==='meses')meses=Number(duracion.cantidad)||1;
    else{const a=dmy(confirmadas[0].resultado?.fechaAnterior),b=dmy(confirmadas[0].resultado?.fechaNueva);
      if(a&&b){const dias=Math.max(1,Math.round((b-a)/864e5));meses=Math.max(1,Math.round(dias/30.4));}}
    // Una renovación = un lote por beneficiario (titular o tercero). Se ofrece para el primero; el resto aparece al cerrar.
    const grupos=new Map();
    for(const x of confirmadas){const bk=x.servicio?.beneficiarioKey||'titular';const arr=grupos.get(bk)||[];arr.push(x);grupos.set(bk,arr);}
    const cola=[...grupos.entries()];
    const siguiente=()=>{const item=cola.shift();if(!item)return;const [bk,lista]=item;
      const compraIds=lista.map(x=>x.resultado?.compraId||x.servicio?.compraId||'').filter(Boolean);
      const fechaNueva=lista[0].resultado?.fechaNueva||'';
      const nombre=lista[0].servicio?.beneficiarioTipo==='tercero'?`${lista[0].servicio.beneficiarioNombre} (de ${g.nombre})`:g.nombre;
      abrirDarFichas({clienteId:g.clienteId||lista[0].servicio?.clienteId,beneficiarioKey:bk,nombre,
        renovacion:{key:`${compraIds.sort().join(',')}|${fechaNueva}`,compraId:compraIds[0]||'',meses,pagoOperacionId},
        alTerminar:()=>setTimeout(siguiente,200)});
      if(cola.length){const no=document.querySelector('#jpaNo');if(no)no.addEventListener('click',()=>setTimeout(siguiente,200),{once:true});}
    };
    siguiente();
  }

  window.SublichatJuegoAdmin={render,abrirDarFichas,ofrecerTrasRenovar,sugeridas};
})();
