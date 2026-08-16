(function sublichatPortalClienteAdmin(){
  'use strict';
  const API='/api/portal-cliente';
  const LOGOS=[
    ['tigo','Tigo Money'],['atlantida','Banco Atlántida'],['bac','BAC Credomatic'],
    ['ficohsa','Ficohsa'],['davivienda','Davivienda'],['banpais','Logo amarillo · cuenta de cheques'],
    ['tengo','Tengo'],['occidente','Banco de Occidente'],['custom','Iniciales / otro']
  ];
  const MASCOT_SOURCES=[
    '/assets/portal-robot-transparent.png?v=20260816-4',
    '/assets/sublicuentas-mascota-portal.jpg?v=20260816-2',
    '/assets/sublicuentas-mascota-portal.png?v=20260816-2',
    '/assets/sublicuentas-mascota.jpg?v=20260816-2'
  ];
  const state={loaded:false,loading:false,tab:'promociones',promociones:[],metodosPago:[],avisoPago:'',clientes:[],vendedores:[],editingId:'',editingImage:'',modalKeyHandler:null};

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const idSafe=value=>String(value||'').replace(/[^a-zA-Z0-9_-]/g,'');
  const host=()=>document.getElementById('rbac-portal-cliente');
  const screenActive=()=>document.getElementById('screen-portal-cliente')?.classList.contains('active');

  function loadMascot(image){
    if(!image)return;
    let sourceIndex=0;
    const nextSource=()=>{
      if(sourceIndex<MASCOT_SOURCES.length){image.src=MASCOT_SOURCES[sourceIndex++];return;}
      image.hidden=true;image.parentElement?.classList.add('mascot-fallback');
    };
    image.addEventListener('error',nextSource);
    nextSource();
  }

  async function api(payload){
    const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{})});
    const text=await response.text();
    let data={};
    try{data=text?JSON.parse(text):{};}catch(_){data={ok:false,error:text||'Respuesta inválida del servidor.'};}
    if(!response.ok||!data.ok)throw new Error(data.error||`Error HTTP ${response.status}`);
    return data;
  }

  function shell(){
    const root=host();
    if(!root||root.dataset.portalReady==='1')return;
    root.dataset.portalReady='1';
    root.innerHTML=`
      <div class="pc-admin">
        <section class="pc-admin-hero">
          <div class="pc-admin-hero-copy">
            <img class="pc-admin-logo" src="/assets/sublicuentas-logo.png" alt="Sublicuentas">
            <b>Contenido exclusivo de las URL de acceso</b>
            <span>Lo que guarde aquí aparecerá en Promociones y Métodos de pago. No modifica cuentas, fichas, renovaciones ni condiciones.</span>
          </div>
          <div class="pc-admin-mascot-wrap"><img class="pc-admin-mascot" alt="Mascota Sublicuentas" loading="eager" decoding="async"></div>
        </section>
        <div class="pc-admin-tabs" role="tablist" aria-label="Secciones del Portal del cliente">
          <button type="button" class="pc-admin-tab active" data-pc-tab="promociones">🏷️ Promociones</button>
          <button type="button" class="pc-admin-tab" data-pc-tab="pagos">💳 Métodos de pago</button>
        </div>
        <section class="pc-admin-panel" data-pc-panel="promociones">
          <div class="pc-admin-toolbar">
            <div class="pc-admin-toolbar-copy"><b>Promociones segmentadas</b><span>Publique para todos, por vendedor o para clientes específicos.</span></div>
            <button type="button" class="pc-btn primary" id="pcNuevaPromo">＋ Nueva promoción</button>
          </div>
          <div id="pcPromoList"><div class="pc-empty">Cargando promociones…</div></div>
        </section>
        <section class="pc-admin-panel" data-pc-panel="pagos" hidden>
          <div class="pc-admin-toolbar">
            <div class="pc-admin-toolbar-copy"><b>Métodos de pago</b><span>Edite banco, titular, número y aviso. El cliente podrá copiar los datos.</span></div>
            <button type="button" class="pc-btn" id="pcAgregarPago">＋ Agregar método</button>
          </div>
          <div class="pc-payment-warning-editor">
            <div class="pc-payment-warning-copy">
              <b>⚠ Aviso importante para todos los pagos</b>
              <span>Este mensaje aparece arriba de los bancos para que el cliente lo lea primero.</span>
            </div>
            <input id="pcAvisoPago" maxlength="220" aria-label="Aviso importante para todos los pagos" placeholder="¡No escribir en detalle o asunto!">
          </div>
          <div class="pc-payment-list" id="pcPaymentList"></div>
          <div class="pc-payment-savebar">
            <span>Use las flechas para cambiar el orden en que aparecen los métodos.</span>
            <button type="button" class="pc-btn primary" id="pcGuardarPagos">💾 Guardar métodos</button>
          </div>
        </section>
        <div class="pc-status" id="pcStatus" aria-live="polite"></div>
        <div class="pc-modal" id="pcPromoModal" hidden></div>
      </div>`;
    loadMascot(root.querySelector('.pc-admin-mascot'));
    bindShell(root);
  }

  function status(message,type=''){
    const el=document.getElementById('pcStatus');
    if(!el)return;
    el.textContent=message||'';
    el.className='pc-status'+(type?` ${type}`:'');
  }

  function bindShell(root){
    root.querySelectorAll('[data-pc-tab]').forEach(button=>button.addEventListener('click',()=>{
      state.tab=button.dataset.pcTab;
      root.querySelectorAll('[data-pc-tab]').forEach(item=>item.classList.toggle('active',item===button));
      root.querySelectorAll('[data-pc-panel]').forEach(panel=>panel.hidden=panel.dataset.pcPanel!==state.tab);
      status('');
    }));
    root.querySelector('#pcNuevaPromo')?.addEventListener('click',()=>openPromotion(''));
    root.querySelector('#pcAgregarPago')?.addEventListener('click',addPayment);
    root.querySelector('#pcGuardarPagos')?.addEventListener('click',savePayments);
  }

  async function load(){
    if(state.loading)return;
    state.loading=true;status('Cargando Portal del cliente…');
    try{
      const data=await api({accion:'cargar'});
      state.promociones=Array.isArray(data.promociones)?data.promociones:[];
      state.metodosPago=Array.isArray(data.metodosPago)?data.metodosPago:[];
      state.avisoPago=data.avisoPago||'¡No escribir en detalle o asunto!';
      state.clientes=Array.isArray(data.clientes)?data.clientes:[];
      state.vendedores=Array.isArray(data.vendedores)?data.vendedores:[];
      state.loaded=true;
      renderPromotions();renderPayments();status('Portal del cliente actualizado.','good');
    }catch(error){
      status(error.message||'No se pudo cargar el portal.','bad');
      const list=document.getElementById('pcPromoList');
      if(list)list.innerHTML=`<div class="pc-empty">No se pudo cargar el contenido.<br>${esc(error.message||'Intente nuevamente.')}</div>`;
    }finally{state.loading=false;}
  }

  function targetLabel(promo){
    const target=promo?.alcance||{};
    if(target.tipo==='clientes')return `${(target.clientes||[]).length} cliente${(target.clientes||[]).length===1?'':'s'}`;
    if(target.tipo==='vendedores')return `${(target.vendedores||[]).length} vendedor${(target.vendedores||[]).length===1?'':'es'}`;
    return 'Todos los clientes';
  }

  function renderPromotions(){
    const list=document.getElementById('pcPromoList');if(!list)return;
    if(!state.promociones.length){
      list.innerHTML='<div class="pc-empty"><b>No hay promociones creadas.</b><br>Cuando publique una, aparecerá únicamente a la audiencia que seleccione.</div>';
      return;
    }
    list.innerHTML=`<div class="pc-promo-list">${state.promociones.map(promo=>{
      const thumb=promo.imagen?`<img src="${esc(promo.imagen)}" alt="">`:'%';
      return `<article class="pc-promo-item">
        <div class="pc-promo-thumb" style="--promo-color:${esc(promo.color||'#E2231A')}">${thumb}</div>
        <div class="pc-promo-info">
          <div class="pc-promo-head"><b title="${esc(promo.titulo)}">${esc(promo.titulo||'Promoción')}</b><span class="pc-promo-badge ${promo.activa!==false?'on':''}">${promo.activa!==false?'Activa':'Oculta'}</span></div>
          <p>${esc(promo.descripcion||'Sin descripción')}</p>
          <span class="pc-promo-badge">◎ ${esc(targetLabel(promo))}</span>
          <div class="pc-promo-actions">
            <button type="button" class="pc-btn ghost" data-pc-edit="${esc(promo.id)}">Editar</button>
            <button type="button" class="pc-btn danger" data-pc-delete="${esc(promo.id)}">Eliminar</button>
          </div>
        </div>
      </article>`;
    }).join('')}</div>`;
    list.querySelectorAll('[data-pc-edit]').forEach(button=>button.addEventListener('click',()=>openPromotion(button.dataset.pcEdit)));
    list.querySelectorAll('[data-pc-delete]').forEach(button=>button.addEventListener('click',()=>deletePromotion(button.dataset.pcDelete)));
  }

  function logoOptions(selected){
    return LOGOS.map(([id,label])=>`<option value="${id}" ${id===selected?'selected':''}>${esc(label)}</option>`).join('');
  }

  function safePaymentLogo(value){
    const source=String(value||'').trim();
    return /^https:\/\//i.test(source)||/^data:image\/(?:png|webp);base64,/i.test(source)?source:'';
  }

  function paymentRow(method,index){
    const id=idSafe(method.id)||`pago-${Date.now()}-${index}`;
    const logoUrl=safePaymentLogo(method.logoUrl);
    return `<article class="pc-payment-row" data-payment-id="${esc(id)}" data-logo-url="${esc(logoUrl)}">
      <div class="pc-payment-row-head">
        <span class="pc-payment-order">${index+1}</span>
        <div class="pc-payment-row-title"><b>Método de pago ${index+1}</b><span>Complete los datos tal como debe verlos el cliente.</span></div>
        <div class="pc-payment-row-actions">
          <button type="button" class="pc-payment-move" data-payment-move="-1" title="Subir un lugar" aria-label="Subir método">↑</button>
          <button type="button" class="pc-payment-move" data-payment-move="1" title="Bajar un lugar" aria-label="Bajar método">↓</button>
          <button type="button" class="pc-payment-delete" title="Eliminar método" aria-label="Eliminar método">×</button>
        </div>
      </div>
      <div class="pc-payment-fields">
        <label class="pc-payment-field"><span>Banco o billetera</span><input data-field="nombre" maxlength="80" value="${esc(method.nombre||'')}" placeholder="Ej. Banco Atlántida"></label>
        <label class="pc-payment-field"><span>Titular</span><input data-field="titular" maxlength="130" value="${esc(method.titular||'')}" placeholder="Nombre del titular"></label>
        <label class="pc-payment-field"><span>Número o usuario</span><input data-field="cuenta" maxlength="100" value="${esc(method.cuenta||'')}" placeholder="Número de cuenta o teléfono"></label>
        <label class="pc-payment-field"><span>Nota opcional</span><input data-field="nota" maxlength="120" value="${esc(method.nota||'')}" placeholder="Nota opcional"></label>
      </div>
      <div class="pc-payment-options">
        <label class="pc-payment-field"><span>Logo predeterminado</span><select data-field="logoKey" aria-label="Logo predeterminado">${logoOptions(method.logoKey||'custom')}</select></label>
        <label class="pc-payment-field"><span>Visibilidad</span><select data-field="activo" aria-label="Visibilidad"><option value="true" ${method.activo!==false?'selected':''}>Visible</option><option value="false" ${method.activo===false?'selected':''}>Oculto</option></select></label>
        <div class="pc-payment-logo-editor">
          <div class="pc-payment-logo-preview">${logoUrl?`<img src="${esc(logoUrl)}" alt="Logo de ${esc(method.nombre||'método de pago')}">`:'<span>Logo predeterminado</span>'}</div>
          <div class="pc-payment-logo-actions">
            <label class="pc-btn ghost">🖼️ Subir logo PNG<input class="pc-payment-logo-file" type="file" accept="image/png,image/webp,.png,.webp" hidden></label>
            <button type="button" class="pc-btn ghost pc-payment-logo-remove" ${logoUrl?'':'disabled'}>Quitar logo subido</button>
            <small>Use un PNG transparente. La imagen se ajusta automáticamente; si no sube una, se usa el logo predeterminado seleccionado.</small>
          </div>
        </div>
      </div>
    </article>`;
  }

  function renderPayments(){
    const list=document.getElementById('pcPaymentList');if(!list)return;
    list.innerHTML=state.metodosPago.map(paymentRow).join('');
    list.querySelectorAll('.pc-payment-delete').forEach(button=>button.addEventListener('click',()=>{
      const row=button.closest('.pc-payment-row');
      if(row)row.remove();
      renumberPayments();
    }));
    list.querySelectorAll('[data-payment-move]').forEach(button=>button.addEventListener('click',()=>{
      const row=button.closest('.pc-payment-row');if(!row)return;
      const direction=Number(button.dataset.paymentMove)||0;
      if(direction<0&&row.previousElementSibling)list.insertBefore(row,row.previousElementSibling);
      if(direction>0&&row.nextElementSibling)list.insertBefore(row.nextElementSibling,row);
      renumberPayments();
    }));
    list.querySelectorAll('.pc-payment-logo-file').forEach(input=>input.addEventListener('change',async event=>{
      const row=event.target.closest('.pc-payment-row');
      const file=event.target.files&&event.target.files[0];
      if(!row||!file)return;
      status('Preparando logo del banco…');
      try{
        row.dataset.logoUrl=await resizePaymentLogo(file);
        renderPaymentLogoPreview(row);
        status('Logo listo. Presione “Guardar métodos” para publicarlo.','good');
      }catch(error){status(error.message||'No se pudo preparar el logo.','bad');}
      finally{event.target.value='';}
    }));
    list.querySelectorAll('.pc-payment-logo-remove').forEach(button=>button.addEventListener('click',()=>{
      const row=button.closest('.pc-payment-row');if(!row)return;
      row.dataset.logoUrl='';renderPaymentLogoPreview(row);
      status('Logo subido retirado. Se usará el predeterminado al guardar.');
    }));
    const warning=document.getElementById('pcAvisoPago');if(warning)warning.value=state.avisoPago||'';
    renumberPayments();
  }

  function renderPaymentLogoPreview(row){
    const preview=row?.querySelector('.pc-payment-logo-preview');if(!preview)return;
    const source=safePaymentLogo(row.dataset.logoUrl);
    if(source){
      const image=document.createElement('img');image.src=source;image.alt='Vista previa del logo';preview.replaceChildren(image);
    }else preview.innerHTML='<span>Logo predeterminado</span>';
    const remove=row.querySelector('.pc-payment-logo-remove');if(remove)remove.disabled=!source;
  }

  function renumberPayments(){
    const rows=[...document.querySelectorAll('#pcPaymentList .pc-payment-row')];
    rows.forEach((row,index)=>{
      const el=row.querySelector('.pc-payment-order');if(el)el.textContent=String(index+1);
      const title=row.querySelector('.pc-payment-row-title b');if(title)title.textContent=`Método de pago ${index+1}`;
      const moves=row.querySelectorAll('[data-payment-move]');
      if(moves[0])moves[0].disabled=index===0;
      if(moves[1])moves[1].disabled=index===rows.length-1;
    });
  }

  function readPayments(){
    return [...document.querySelectorAll('#pcPaymentList .pc-payment-row')].map((row,index)=>{
      const value=field=>row.querySelector(`[data-field="${field}"]`)?.value||'';
      return {
        id:row.dataset.paymentId||`pago-${Date.now()}-${index}`,
        nombre:value('nombre'),titular:value('titular'),cuenta:value('cuenta'),nota:value('nota'),
        logoKey:value('logoKey'),logoUrl:safePaymentLogo(row.dataset.logoUrl),activo:value('activo')!=='false',orden:index
      };
    });
  }

  function addPayment(){
    const methods=readPayments();
    methods.push({id:`pago-${Date.now()}`,nombre:'',titular:'',cuenta:'',nota:'',logoKey:'custom',logoUrl:'',activo:true});
    state.metodosPago=methods;renderPayments();
    const rows=document.querySelectorAll('#pcPaymentList .pc-payment-row');
    rows[rows.length-1]?.querySelector('[data-field="nombre"]')?.focus();
  }

  async function savePayments(){
    const button=document.getElementById('pcGuardarPagos');
    const methods=readPayments();
    if(!methods.length){status('Agregue al menos un método de pago.','bad');return;}
    button.disabled=true;status('Guardando métodos de pago…');
    try{
      const data=await api({accion:'guardar_metodos',metodosPago:methods,avisoPago:document.getElementById('pcAvisoPago')?.value||''});
      state.metodosPago=data.metodosPago||methods;
      state.avisoPago=document.getElementById('pcAvisoPago')?.value||'';
      renderPayments();status('Métodos de pago guardados. Ya aparecen en las URL de acceso.','good');
    }catch(error){status(error.message||'No se pudieron guardar los métodos.','bad');}
    finally{button.disabled=false;}
  }

  function pickerHtml(type,selected){
    const values=new Set(Array.isArray(selected)?selected:[]);
    if(type==='vendedores'){
      return `<div class="pc-picker" id="pcVendorPicker">${state.vendedores.map(item=>`<label class="pc-check"><input type="checkbox" value="${esc(item.id)}" ${values.has(item.id)?'checked':''}><span>${esc(item.nombre)}</span></label>`).join('')||'<div class="pc-empty">No hay vendedores.</div>'}</div>`;
    }
    return `<div class="pc-picker" id="pcClientPicker">
      <input class="pc-picker-search" id="pcClientSearch" placeholder="Buscar cliente, teléfono o vendedor">
      <div id="pcClientOptions">${state.clientes.map(item=>`<label class="pc-check" data-search="${esc(`${item.nombre} ${item.telefono} ${item.vendedor}`.toLowerCase())}"><input type="checkbox" value="${esc(item.id)}" ${values.has(item.id)?'checked':''}><span>${esc(item.nombre)}</span><small>${esc(item.vendedor||'—')}</small></label>`).join('')||'<div class="pc-empty">No hay clientes.</div>'}</div>
    </div>`;
  }

  function openPromotion(id){
    const promo=state.promociones.find(item=>item.id===id)||{
      titulo:'',descripcion:'',etiqueta:'PROMOCIÓN',precio:'',precioAnterior:'',imagen:'',color:'#E2231A',
      ctaTexto:'Solicitar promoción',ctaMensaje:'',fechaInicio:'',fechaFin:'',activa:true,orden:0,
      alcance:{tipo:'todos',vendedores:[],clientes:[]}
    };
    state.editingId=id||'';state.editingImage=promo.imagen||'';
    const target=promo.alcance||{tipo:'todos'};
    const modal=document.getElementById('pcPromoModal');if(!modal)return;
    document.body.classList.add('pc-modal-open');
    modal.hidden=false;
    modal.innerHTML=`<div class="pc-modal-card" role="dialog" aria-modal="true" aria-labelledby="pcPromoTitle">
      <div class="pc-modal-head"><b id="pcPromoTitle">${id?'Editar':'Nueva'} promoción</b><button type="button" class="pc-modal-close" aria-label="Cerrar">×</button></div>
      <form class="pc-form" id="pcPromoForm">
        <div class="pc-form-grid">
          <label class="pc-label wide">Título<input name="titulo" maxlength="100" required value="${esc(promo.titulo||'')}" placeholder="Ej. Disney + HBO Max"></label>
          <label class="pc-label wide">Descripción<textarea name="descripcion" maxlength="500" placeholder="Explique brevemente la oferta">${esc(promo.descripcion||'')}</textarea></label>
          <label class="pc-label">Etiqueta<input name="etiqueta" maxlength="40" value="${esc(promo.etiqueta||'PROMOCIÓN')}"></label>
          <label class="pc-label">Color principal<input name="color" type="color" value="${esc(promo.color||'#E2231A')}"></label>
          <label class="pc-label">Precio actual<input name="precio" maxlength="60" value="${esc(promo.precio||'')}" placeholder="Ej. Lps. 120"></label>
          <label class="pc-label">Precio anterior opcional<input name="precioAnterior" maxlength="60" value="${esc(promo.precioAnterior||'')}" placeholder="Ej. Lps. 160"></label>
          <label class="pc-label">Fecha inicial<input name="fechaInicio" type="date" value="${esc(promo.fechaInicio||'')}"></label>
          <label class="pc-label">Fecha final<input name="fechaFin" type="date" value="${esc(promo.fechaFin||'')}"></label>
          <label class="pc-label">Texto del botón<input name="ctaTexto" maxlength="50" value="${esc(promo.ctaTexto||'Solicitar promoción')}"></label>
          <label class="pc-label">Orden<input name="orden" type="number" min="0" max="9999" value="${Number(promo.orden)||0}"></label>
          <label class="pc-label wide">Mensaje de WhatsApp<input name="ctaMensaje" maxlength="300" value="${esc(promo.ctaMensaje||'')}" placeholder="Hola, deseo información sobre esta promoción."></label>
        </div>
        <div class="pc-image-box">
          <div class="pc-image-preview" id="pcPromoImagePreview">${promo.imagen?`<img src="${esc(promo.imagen)}" alt="Vista previa">`:'%'}</div>
          <div class="pc-image-actions">
            <label class="pc-btn ghost">🖼️ Elegir imagen<input id="pcPromoImageFile" type="file" accept="image/*" hidden></label>
            <button type="button" class="pc-btn ghost" id="pcPromoImageRemove">Quitar imagen</button>
            <small>La imagen se optimiza antes de guardarse. Las cuentas y fichas no se alteran.</small>
          </div>
        </div>
        <div class="pc-target-box">
          <b>¿Quién verá esta promoción?</b>
          <div class="pc-target-options">
            <label class="pc-target-option"><input type="radio" name="alcanceTipo" value="todos" ${target.tipo==='todos'||!target.tipo?'checked':''}> Todos los clientes</label>
            <label class="pc-target-option"><input type="radio" name="alcanceTipo" value="vendedores" ${target.tipo==='vendedores'?'checked':''}> Por vendedor</label>
            <label class="pc-target-option"><input type="radio" name="alcanceTipo" value="clientes" ${target.tipo==='clientes'?'checked':''}> Clientes específicos</label>
          </div>
          <div class="pc-pickers">
            ${pickerHtml('vendedores',target.vendedores||[])}
            ${pickerHtml('clientes',target.clientes||[])}
          </div>
        </div>
        <label class="pc-target-option"><input type="checkbox" name="activa" ${promo.activa!==false?'checked':''}> Promoción visible</label>
        <div class="pc-status" id="pcModalStatus"></div>
      </form>
      <div class="pc-form-actions"><button type="button" class="pc-btn ghost" id="pcPromoCancel">Cancelar</button><button type="submit" form="pcPromoForm" class="pc-btn primary" id="pcPromoSave">💾 Guardar promoción</button></div>
    </div>`;
    bindPromotionModal(modal);
    requestAnimationFrame(()=>modal.querySelector('.pc-modal-close')?.focus());
  }

  function modalStatus(message,type=''){
    const el=document.getElementById('pcModalStatus');if(!el)return;
    el.textContent=message||'';el.className='pc-status'+(type?` ${type}`:'');
  }

  function closePromotion(){
    const modal=document.getElementById('pcPromoModal');
    if(modal){modal.hidden=true;modal.innerHTML='';}
    document.body.classList.remove('pc-modal-open');
    if(state.modalKeyHandler)document.removeEventListener('keydown',state.modalKeyHandler);
    state.modalKeyHandler=null;
    state.editingId='';state.editingImage='';
  }

  function updateTargetPickers(){
    const type=document.querySelector('input[name="alcanceTipo"]:checked')?.value||'todos';
    const vendor=document.getElementById('pcVendorPicker');
    const client=document.getElementById('pcClientPicker');
    if(vendor)vendor.hidden=type!=='vendedores';
    if(client)client.hidden=type!=='clientes';
  }

  function bindPromotionModal(modal){
    modal.querySelector('.pc-modal-close')?.addEventListener('click',closePromotion);
    modal.querySelector('#pcPromoCancel')?.addEventListener('click',closePromotion);
    modal.onclick=event=>{if(event.target===modal)closePromotion();};
    if(state.modalKeyHandler)document.removeEventListener('keydown',state.modalKeyHandler);
    state.modalKeyHandler=event=>{if(event.key==='Escape')closePromotion();};
    document.addEventListener('keydown',state.modalKeyHandler);
    modal.querySelectorAll('input[name="alcanceTipo"]').forEach(input=>input.addEventListener('change',updateTargetPickers));
    updateTargetPickers();
    modal.querySelector('#pcClientSearch')?.addEventListener('input',event=>{
      const query=String(event.target.value||'').trim().toLowerCase();
      modal.querySelectorAll('#pcClientOptions .pc-check').forEach(label=>label.hidden=query&&!String(label.dataset.search||'').includes(query));
    });
    modal.querySelector('#pcPromoImageRemove')?.addEventListener('click',()=>{
      state.editingImage='';const preview=document.getElementById('pcPromoImagePreview');if(preview)preview.textContent='%';
    });
    modal.querySelector('#pcPromoImageFile')?.addEventListener('change',async event=>{
      const file=event.target.files&&event.target.files[0];if(!file)return;
      modalStatus('Optimizando imagen…');
      try{
        state.editingImage=await resizeImage(file);
        const preview=document.getElementById('pcPromoImagePreview');
        if(preview)preview.innerHTML=`<img src="${esc(state.editingImage)}" alt="Vista previa">`;
        modalStatus('Imagen lista.','good');
      }catch(error){modalStatus(error.message||'No se pudo preparar la imagen.','bad');}
    });
    modal.querySelector('#pcPromoForm')?.addEventListener('submit',savePromotion);
  }

  function resizeImage(file){
    return new Promise((resolve,reject)=>{
      if(!file||!String(file.type||'').startsWith('image/'))return reject(new Error('Seleccione una imagen válida.'));
      const image=new Image();const url=URL.createObjectURL(file);
      image.onload=()=>{
        try{
          const max=1100,scale=Math.min(1,max/Math.max(image.width,image.height));
          const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
          canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);
          let quality=.82,data=canvas.toDataURL('image/jpeg',quality);
          while(data.length>590000&&quality>.48){quality-=.08;data=canvas.toDataURL('image/jpeg',quality);}
          if(data.length>610000)return reject(new Error('La imagen todavía pesa mucho. Seleccione otra más liviana.'));
          resolve(data);
        }catch(error){URL.revokeObjectURL(url);reject(error);}
      };
      image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('No se pudo leer la imagen.'));};
      image.src=url;
    });
  }

  function resizePaymentLogo(file){
    return new Promise((resolve,reject)=>{
      if(!file||!['image/png','image/webp'].includes(String(file.type||'').toLowerCase()))return reject(new Error('Seleccione un logo PNG o WebP, preferiblemente sin fondo.'));
      const image=new Image();const url=URL.createObjectURL(file);
      image.onload=()=>{
        try{
          const max=320,scale=Math.min(1,max/Math.max(image.width,image.height));
          const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
          const context=canvas.getContext('2d');context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);
          let data=canvas.toDataURL('image/png');
          if(data.length>80000){
            let quality=.88;data=canvas.toDataURL('image/webp',quality);
            while(data.length>85000&&quality>.56){quality-=.08;data=canvas.toDataURL('image/webp',quality);}
          }
          if(data.length>90000)return reject(new Error('El logo todavía pesa mucho. Use un PNG más pequeño.'));
          resolve(data);
        }catch(error){URL.revokeObjectURL(url);reject(error);}
      };
      image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('No se pudo leer el logo.'));};
      image.src=url;
    });
  }

  async function savePromotion(event){
    event.preventDefault();
    const form=event.currentTarget,button=document.getElementById('pcPromoSave');
    const value=name=>form.elements[name]?.value||'';
    const type=value('alcanceTipo')||'todos';
    const vendedores=[...form.querySelectorAll('#pcVendorPicker input:checked')].map(input=>input.value);
    const clientes=[...form.querySelectorAll('#pcClientPicker input:checked')].map(input=>input.value);
    const promotion={
      titulo:value('titulo'),descripcion:value('descripcion'),etiqueta:value('etiqueta'),precio:value('precio'),precioAnterior:value('precioAnterior'),
      imagen:state.editingImage,color:value('color'),ctaTexto:value('ctaTexto'),ctaMensaje:value('ctaMensaje'),
      fechaInicio:value('fechaInicio'),fechaFin:value('fechaFin'),orden:Number(value('orden'))||0,activa:!!form.elements.activa?.checked,
      alcance:{tipo:type,vendedores,clientes}
    };
    if(type==='vendedores'&&!vendedores.length){modalStatus('Seleccione al menos un vendedor.','bad');return;}
    if(type==='clientes'&&!clientes.length){modalStatus('Seleccione al menos un cliente.','bad');return;}
    button.disabled=true;modalStatus('Guardando promoción…');
    try{
      await api({accion:'guardar_promocion',id:state.editingId,promocion:promotion});
      closePromotion();state.loaded=false;await load();status('Promoción guardada con su audiencia seleccionada.','good');
    }catch(error){modalStatus(error.message||'No se pudo guardar la promoción.','bad');}
    finally{button.disabled=false;}
  }

  async function deletePromotion(id){
    const promo=state.promociones.find(item=>item.id===id);
    if(!window.confirm(`¿Eliminar la promoción “${promo?.titulo||'seleccionada'}”?`))return;
    status('Eliminando promoción…');
    try{await api({accion:'eliminar_promocion',id});state.promociones=state.promociones.filter(item=>item.id!==id);renderPromotions();status('Promoción eliminada.','good');}
    catch(error){status(error.message||'No se pudo eliminar la promoción.','bad');}
  }

  function renderPortal(){
    if(!screenActive())return;
    shell();
    if(!state.loaded&&!state.loading)load();
  }

  window.sublichatPortalClienteRender=renderPortal;
  document.addEventListener('click',event=>{
    if(event.target.closest?.('[data-screen="portal-cliente"]'))setTimeout(renderPortal,40);
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(renderPortal,120),{once:true});
  else setTimeout(renderPortal,120);
})();
