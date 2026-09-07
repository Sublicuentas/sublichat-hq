(function catalogoRelojesAdmin(){
  'use strict';

  const API='/api/catalogo-relojes';
  const BUILD='20260907-8';
  const state={
    loaded:false,loading:false,saving:false,dirty:false,tab:'products',catalog:null,history:[],baseStatus:'Catálogo listo.',savebarObserver:null
  };
  const A={
    available:'Disponible',limited:'Pocas disponibles',on_request:'Bajo pedido',
    paused:'No disponible',maintenance:'Mantenimiento'
  };
  const BADGE_TONES={trend:'En tendencia',offer:'En oferta',new:'Nuevo',popular:'Popular',exclusive:'Exclusivo'};

  const host=()=>document.getElementById('rbac-catalogo-relojes');
  const $=(selector)=>host()?.querySelector(selector)||null;
  const esc=(value)=>String(value??'').replace(/[&<>"']/g,(char)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const clone=(value)=>JSON.parse(JSON.stringify(value));
  const uid=(prefix)=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

  function notify(message){
    try{if(typeof window.mostrarToast==='function')window.mostrarToast(message);}catch(_){}
  }

  function status(text,kind=''){
    const element=$('#crStatus');
    if(!element)return;
    element.textContent=String(text||'');
    element.className=`cr-status ${kind}`;
  }

  function ensureCatalogShape(input){
    const catalog=input&&typeof input==='object'?input:{};
    catalog.categories=Array.isArray(catalog.categories)?catalog.categories:[];
    catalog.products=Array.isArray(catalog.products)?catalog.products:[];
    catalog.promotions=Array.isArray(catalog.promotions)?catalog.promotions:[];
    catalog.carousel=Array.isArray(catalog.carousel)?catalog.carousel:[];
    catalog.settings=catalog.settings&&typeof catalog.settings==='object'?catalog.settings:{};
    if(!catalog.categories.length){
      catalog.categories.push({id:'general',name:'General',description:'',active:true,order:10,icon:'⌚'});
    }
    return catalog;
  }

  async function api(payload){
    const headers={'Content-Type':'application/json'};
    // El fetch general de Sublichat también adjunta esta sesión. Se agrega aquí
    // explícitamente para que el módulo no dependa del orden de los scripts.
    try{
      const user=typeof window.sublichatCurrentAuthUser==='function'
        ?await window.sublichatCurrentAuthUser():null;
      if(user&&typeof user.getIdToken==='function')headers.Authorization=`Bearer ${await user.getIdToken()}`;
    }catch(_){}
    const response=await fetch(API,{method:'POST',headers,body:JSON.stringify(payload||{})});
    const text=await response.text();
    let data={};
    try{data=JSON.parse(text);}catch(_){data={error:text};}
    if(!response.ok||!data.ok){
      if(response.status===401)throw new Error('La sesión venció. Recargue Sublichat e ingrese nuevamente.');
      throw new Error(data.error||`Error del catálogo (HTTP ${response.status}).`);
    }
    return data;
  }

  function setSaving(active){
    state.saving=!!active;
    const root=$('.cr-admin');
    if(root)root.classList.toggle('is-saving',state.saving);
    const saveButton=$('#crSave');
    const reloadButton=$('#crReload');
    if(saveButton)saveButton.disabled=state.saving;
    if(reloadButton)reloadButton.disabled=state.saving;
  }

  function closeModal(){
    const modal=$('#crModal');
    if(!modal)return;
    modal.hidden=true;
  }

  function enhanceModal(){
    const modal=$('#crModal');if(!modal)return;
    const sheet=modal.querySelector('.cr-sheet');if(!sheet||sheet.querySelector('.cr-modal-close'))return;
    const button=document.createElement('button');
    button.type='button';button.className='cr-modal-close';button.setAttribute('aria-label','Cerrar');button.textContent='✕';
    button.onclick=()=>{if(!state.saving)closeModal();};
    sheet.prepend(button);
  }

  function shell(){
    const target=host();
    if(!target)return;
    // Si otro render reconstruyó la pantalla pero dejó data-ready, se reparaba mal:
    // el módulo creía estar montado aunque el HTML ya no existía. Se valida el shell real.
    if(target.dataset.ready==='1'&&target.querySelector('.cr-admin'))return;
    target.dataset.ready='1';
    target.innerHTML=`<div class="cr-admin" data-build="${BUILD}">
      <div class="cr-hero">
        <div><b>⌚ Catálogo Relojes</b><span>Los productos y promociones se publican al guardarlos.</span></div>
        <span class="cr-version" id="crVersion">v—</span>
      </div>
      <div class="cr-tabs">
        <button class="cr-tab on" data-tab="products">Productos</button>
        <button class="cr-tab" data-tab="promotions">Promociones</button>
        <button class="cr-tab" data-tab="availability">Disponibilidad</button>
        <button class="cr-tab" data-tab="categories">Categorías</button>
        <button class="cr-tab" data-tab="carousel">Carrusel</button>
        <button class="cr-tab" data-tab="settings">Apariencia</button>
      </div>
      <div id="crBody"></div>
      <div class="cr-savebar">
        <span class="cr-status" id="crStatus">Cargando…</span>
        <div class="cr-save-actions">
          <button class="cr-btn ghost" id="crReload">↻ Recargar</button>
          <button class="cr-btn red" id="crSave">💾 Guardar ajustes</button>
        </div>
      </div>
      <div class="cr-modal" id="crModal" hidden></div>
    </div>`;
    target.querySelectorAll('[data-tab]').forEach((button)=>{
      button.onclick=()=>{
        state.tab=button.dataset.tab;
        target.querySelectorAll('[data-tab]').forEach((item)=>item.classList.toggle('on',item===button));
        render();
        syncSavebarGeometry();
        if(!state.dirty&&!state.saving)status(state.baseStatus,'good');
      };
    });
    $('#crSave').onclick=()=>saveCatalog({message:'Ajustes publicados.'});
    $('#crReload').onclick=()=>load(true);
    installSavebarSync();
    syncSavebarGeometry();
    const modal=$('#crModal');
    if(modal){
      modal.addEventListener('click',(event)=>{if(event.target===modal&&!state.saving)closeModal();});
      new MutationObserver(()=>enhanceModal()).observe(modal,{childList:true,subtree:false});
    }
  }

  function markDirty(message='Cambios generales pendientes de guardar.'){
    state.dirty=true;
    status(message,'dirty');
  }

  function categoryName(id){
    return state.catalog?.categories?.find((category)=>category.id===id)?.name||id||'Sin categoría';
  }

  function firstPrice(product){
    for(const plan of product.plans||[]){
      const option=(plan.options||[]).find((item)=>item.price!=null&&Number.isFinite(Number(item.price)));
      if(option)return Number(option.price);
      if(plan.price!=null&&Number.isFinite(Number(plan.price)))return Number(plan.price);
    }
    return null;
  }

  function money(value){
    return value==null?'Consultar':`Lps. ${Number(value).toLocaleString('es-HN')}`;
  }

  function validateCatalog(catalog,options={}){
    // Validación estructural global + validación comercial SOLO del elemento que el usuario edita.
    // Así un producto heredado (p. ej. Mubi sin precio) no bloquea borrar una categoría,
    // editar Netflix o guardar Apariencia/Disponibilidad.
    const errors=[];
    const strictProducts=new Set(options.productIds||[]);
    const strictPromotions=new Set(options.promotionIds||[]);
    const categories=new Set();
    (catalog.categories||[]).forEach((category)=>{
      if(categories.has(category.id))errors.push(`Categoría duplicada: ${category.id}.`);
      categories.add(category.id);
    });
    const productIds=new Set();
    (catalog.products||[]).forEach((product)=>{
      if(productIds.has(product.id))errors.push(`Producto duplicado: ${product.name||product.id}.`);
      productIds.add(product.id);
      if(!categories.has(product.categoryId))errors.push(`${product.name||product.id}: seleccione una categoría válida.`);
      if(strictProducts.has(product.id)){
        if(!String(product.name||'').trim())errors.push('El producto necesita nombre.');
        if(!(product.plans||[]).length)errors.push(`${product.name||'Producto'}: agregue al menos un plan.`);
        (product.plans||[]).forEach((plan)=>{
          const hasPrice=plan.price!=null&&Number.isFinite(Number(plan.price));
          const hasOptionPrice=(plan.options||[]).some((option)=>option.price!=null&&Number.isFinite(Number(option.price)));
          const hasPoints=plan.pointsCost!=null&&Number.isFinite(Number(plan.pointsCost))&&Number(plan.pointsCost)>0;
          if(plan.active!==false&&!product.redemptionOnly&&!hasPoints&&!['on_request','paused','maintenance'].includes(plan.availability)&&!hasPrice&&!hasOptionPrice){
            errors.push(`${product.name} / ${plan.name}: escriba un precio o marque “Bajo pedido”.`);
          }
        });
      }
    });
    (catalog.promotions||[]).forEach((promotion)=>{
      (promotion.productIds||[]).forEach((id)=>{
        if(!productIds.has(id))errors.push(`${promotion.title||promotion.id}: contiene un producto que ya no existe.`);
      });
      if(strictPromotions.has(promotion.id)){
        if(!String(promotion.title||'').trim())errors.push('La promoción necesita título.');
        const hasPrice=(promotion.options||[]).some((option)=>option.price!=null&&Number.isFinite(Number(option.price)));
        if(promotion.active!==false&&!hasPrice)errors.push(`${promotion.title||'Promoción'}: agregue al menos una opción con precio antes de activarla.`);
        const starts=promotion.startsAt?Date.parse(promotion.startsAt):NaN;
        const ends=promotion.endsAt?Date.parse(promotion.endsAt):NaN;
        if(Number.isFinite(starts)&&Number.isFinite(ends)&&starts>=ends){
          errors.push(`${promotion.title||'Promoción'}: la fecha final debe ser posterior al inicio.`);
        }
      }
    });
    const slideIds=new Set();
    (catalog.carousel||[]).forEach((slide)=>{
      if(slideIds.has(slide.id))errors.push(`Banner duplicado: ${slide.id}.`);
      slideIds.add(slide.id);
    });
    return [...new Set(errors)];
  }

  function syncSavebarGeometry(){
    const target=host();
    const bar=$('.cr-savebar');
    if(!target||!bar)return;
    const rect=target.getBoundingClientRect();
    if(!rect.width)return;
    const viewport=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);
    const left=Math.max(12,Math.round(rect.left));
    const right=Math.max(12,Math.round(viewport-rect.right));
    bar.style.setProperty('--cr-save-left',`${left}px`);
    bar.style.setProperty('--cr-save-right',`${right}px`);
  }

  function installSavebarSync(){
    if(document.documentElement.dataset.catalogSavebarSync==='1')return;
    document.documentElement.dataset.catalogSavebarSync='1';
    const sync=()=>requestAnimationFrame(syncSavebarGeometry);
    window.addEventListener('resize',sync,{passive:true});
    window.addEventListener('orientationchange',sync,{passive:true});
    if(typeof ResizeObserver==='function'){
      state.savebarObserver=new ResizeObserver(sync);
      const target=host();if(target)state.savebarObserver.observe(target);
    }
  }

  async function load(force=false){
    if(state.loading||(!force&&state.loaded))return;
    if(force&&state.dirty&&!confirm('Hay ajustes generales sin guardar. ¿Recargar y descartarlos?'))return;
    state.loading=true;
    status('Cargando catálogo…');
    try{
      const data=await api({accion:'cargar'});
      state.catalog=ensureCatalogShape(data.catalog);
      state.history=Array.isArray(data.history)?data.history:[];
      state.loaded=true;
      state.dirty=false;
      const version=$('#crVersion');
      if(version)version.textContent=`v${state.catalog.catalogVersion||1}`;
      render();
      state.baseStatus=data.source==='remote'
        ?'Conectado al catálogo público de Relojes.'
        :(data.exists?'Conectado a Firebase.':'Catálogo listo para configurar.');
      status(state.baseStatus,'good');
      syncSavebarGeometry();
    }catch(error){
      status(error.message,'bad');
      const body=$('#crBody');
      if(body)body.innerHTML=`<div class="cr-empty"><b>No se pudo abrir el catálogo.</b><span>${esc(error.message)}</span></div>`;
    }finally{
      state.loading=false;
    }
  }

  function render(){
    if(!state.catalog)return;
    const renderer={
      products:renderProducts,promotions:renderPromotions,availability:renderAvailability,
      categories:renderCategories,carousel:renderCarousel,settings:renderSettings
    }[state.tab]||renderProducts;
    try{renderer();syncSavebarGeometry();}
    catch(error){
      console.error('Catálogo Relojes render',error);
      const body=$('#crBody');
      if(body)body.innerHTML=`<div class="cr-empty"><b>No se pudo dibujar esta sección.</b><span>${esc(error&&error.message||'Error de interfaz.')}</span><button class="cr-btn ghost" id="crRenderRetry" type="button">↻ Reintentar</button></div>`;
      const retry=$('#crRenderRetry');if(retry)retry.onclick=()=>render();
      status('La sección tuvo un error de interfaz. Puede reintentar sin salir del catálogo.','bad');
    }
  }

  async function saveCatalog(options={}){
    if(!state.catalog||state.saving)return false;
    const errors=validateCatalog(state.catalog);
    if(errors.length){
      const message=errors[0]+(errors.length>1?` (+${errors.length-1} más)`:``);
      status(message,'bad');
      notify(`⚠️ ${message}`);
      return false;
    }
    setSaving(true);
    status(options.progress||'Publicando en el catálogo…');
    try{
      const data=await api({accion:'guardar',catalog:state.catalog});
      state.catalog=ensureCatalogShape(data.catalog);
      state.dirty=false;
      const version=$('#crVersion');
      if(version)version.textContent=`v${state.catalog.catalogVersion||1}`;
      const message=options.message||data.message||'Catálogo publicado.';
      state.baseStatus='Catálogo actualizado y conectado.';
      status(`✅ ${message}`,'good');
      notify(`✅ ${message}`);
      return true;
    }catch(error){
      status(error.message,'bad');
      notify(`⚠️ ${error.message}`);
      return false;
    }finally{
      setSaving(false);
    }
  }

  function productCard(product){
    const search=(`${product.name||''} ${categoryName(product.categoryId)}`).toLowerCase();
    return `<article class="cr-card" data-product-card data-search="${esc(search)}">
      <div class="cr-card-head">
        ${product.imageUrl?`<img class="cr-thumb" src="${esc(product.imageUrl)}" alt="" onerror="this.style.visibility='hidden'">`:`<div class="cr-thumb"></div>`}
        <div><h3>${esc(product.name)}</h3><small>${esc(categoryName(product.categoryId))}</small></div>
      </div>
      <div class="cr-row"><span class="cr-card-badges"><span class="cr-badge ${product.availability==='paused'?'paused':''}">${esc(A[product.availability]||product.availability)}</span>${product.badge?`<span class="cr-badge promo">${esc(product.badge)}</span>`:''}</span><span class="cr-price">${money(firstPrice(product))}</span></div>
      <div class="cr-row">
        <small>${(product.plans||[]).length} plan(es) · ${product.active!==false?'Visible':'Oculto'}</small>
        <span class="cr-card-actions"><button class="cr-btn ghost" data-edit-product="${esc(product.id)}">Editar</button><button class="cr-btn danger" data-delete-product="${esc(product.id)}">Eliminar</button></span>
      </div>
    </article>`;
  }

  function renderProducts(){
    const body=$('#crBody');
    if(!body)return;
    const items=state.catalog.products||[];
    body.innerHTML=`<div class="cr-tools"><input class="cr-search" id="crSearch" placeholder="Buscar producto o categoría"><button class="cr-btn red" id="crAddProduct">＋ Producto</button></div>
      <div class="cr-grid" id="crList">${items.map(productCard).join('')||'<div class="cr-empty">No hay productos.</div>'}</div>`;
    $('#crAddProduct').onclick=()=>editProduct('');
    $('#crSearch').oninput=(event)=>{
      const query=event.target.value.toLowerCase().trim();
      body.querySelectorAll('[data-product-card]').forEach((card)=>{card.hidden=!!query&&!card.dataset.search.includes(query);});
    };
    body.querySelectorAll('[data-edit-product]').forEach((button)=>{button.onclick=()=>editProduct(button.dataset.editProduct);});
    body.querySelectorAll('[data-delete-product]').forEach((button)=>{button.onclick=()=>deleteProduct(button.dataset.deleteProduct,button);});
  }

  async function deleteProduct(productId,button){
    if(state.saving)return;
    const product=state.catalog.products.find((item)=>item.id===productId);
    if(!product)return;
    if(!confirm(`¿Eliminar “${product.name}”?\n\nTambién se quitará de las promociones donde esté incluido.`))return;
    const before=clone(state.catalog);
    state.catalog.products=state.catalog.products.filter((item)=>item.id!==productId);
    state.catalog.promotions=(state.catalog.promotions||[]).map((promotion)=>({
      ...promotion,productIds:(promotion.productIds||[]).filter((id)=>id!==productId)
    }));
    if(button){button.disabled=true;button.textContent='Eliminando…';}
    const saved=await saveCatalog({progress:'Eliminando y publicando…',message:`Producto “${product.name}” eliminado.`});
    if(!saved)state.catalog=before;
    renderProducts();
  }

  function parseOptions(text,previous=[]){
    return String(text||'').split('\n').map((line,index)=>{
      const [label,rawPrice,bonus]=line.split('=');
      const trimmed=String(label||'').trim();
      if(!trimmed)return null;
      const numeric=String(rawPrice??'').trim();
      return {
        id:previous[index]?.id||uid('option'),label:trimmed,
        price:numeric===''?null:Number(numeric),bonus:String(bonus||'').trim()
      };
    }).filter(Boolean);
  }

  function editProduct(productId){
    const existing=state.catalog.products.find((item)=>item.id===productId);
    const product=existing?clone(existing):{
      id:uid('producto'),name:'Nuevo producto',categoryId:state.catalog.categories[0]?.id||'general',
      active:true,storeEnabled:true,redemptionOnly:false,availability:'available',
      order:(state.catalog.products.length+1)*10,accent:'#E2231A',imageUrl:'',summary:'',badge:'',badgeTone:'trend',productFeatures:[],
      plans:[{id:uid('plan'),name:'Precio a consultar',price:null,billingLabel:'',active:true,availability:'on_request',badge:'',pointsCost:null,features:[],options:[]}]
    };
    const modal=$('#crModal');
    modal.hidden=false;
    modal.innerHTML=`<div class="cr-sheet">
      <h2>${existing?'Editar':'Nuevo'} producto</h2>
      <div class="cr-form">
        <label class="cr-field">Nombre<input id="cpeName" value="${esc(product.name)}"></label>
        <label class="cr-field">Categoría<select id="cpeCat">${state.catalog.categories.map((category)=>`<option value="${esc(category.id)}" ${category.id===product.categoryId?'selected':''}>${esc(category.name)}</option>`).join('')}</select></label>
        <label class="cr-field">Disponibilidad<select id="cpeAv">${Object.entries(A).map(([key,label])=>`<option value="${key}" ${key===product.availability?'selected':''}>${label}</option>`).join('')}</select></label>
        <label class="cr-field">Orden<input id="cpeOrder" type="number" value="${Number(product.order)||0}"></label>
        <label class="cr-field">Badge / etiqueta<input id="cpeBadge" value="${esc(product.badge||'')}" placeholder="En tendencia"></label>
        <label class="cr-field">Tipo de badge<select id="cpeBadgeTone">${Object.entries(BADGE_TONES).map(([key,label])=>`<option value="${key}" ${key===(product.badgeTone||'trend')?'selected':''}>${label}</option>`).join('')}</select></label>
        <label class="cr-field wide">Imagen URL<input id="cpeImg" value="${esc(product.imageUrl||'')}" placeholder="https://... o /assets/..."></label>
        <label class="cr-field wide cr-upload-field">Subir imagen del producto<input id="cpeImgFile" type="file" accept="image/jpeg,image/png,image/webp"><span id="cpeUploadState" class="cr-upload-state">Puede subir JPG, PNG o WebP. Máximo 10 MB; se optimiza automáticamente.</span></label>
        <div class="cr-image-preview wide" id="cpeImgPreview">${product.imageUrl?`<img src="${esc(product.imageUrl)}" alt="Vista previa">`:'Sin imagen cargada'}</div>
        <label class="cr-field wide">Descripción<textarea id="cpeSummary">${esc(product.summary||'')}</textarea></label>
        <label class="cr-field wide">Características · una por línea<textarea id="cpeFeatures">${esc((product.productFeatures||[]).join('\n'))}</textarea></label>
        <label class="cr-check"><input id="cpeActive" type="checkbox" ${product.active!==false?'checked':''}> Visible en catálogo</label>
        <label class="cr-check"><input id="cpeStore" type="checkbox" ${product.storeEnabled!==false?'checked':''}> Disponible para compra</label>
        <label class="cr-check"><input id="cpeRedeem" type="checkbox" ${product.redemptionOnly?'checked':''}> Solo canje por puntos</label>
        <div class="cr-section">Planes y precios <button class="cr-btn ghost" id="cpeAddPlan" type="button">＋ Plan</button></div>
        <div id="cpePlans" class="cr-plan-list"></div>
      </div>
      <div class="cr-modal-error" id="cpeError" hidden></div>
      <div class="cr-actions"><button class="cr-btn ghost" id="cpeCancel">Cancelar</button><button class="cr-btn red" id="cpeOk">Guardar y publicar</button></div>
    </div>`;
    enhanceModal();

    function renderPlans(){
      const box=$('#cpePlans');
      box.innerHTML=(product.plans||[]).map((plan,index)=>`<div class="cr-plan" data-plan="${index}">
        <div class="cr-plan-grid">
          <input class="cr-mini" data-f="name" value="${esc(plan.name)}" placeholder="Plan">
          <input class="cr-mini" data-f="price" type="number" min="0" step="0.01" value="${plan.price??''}" placeholder="Precio">
          <select class="cr-mini" data-f="availability">${Object.entries(A).map(([key,label])=>`<option value="${key}" ${key===plan.availability?'selected':''}>${label}</option>`).join('')}</select>
          <button class="cr-btn danger" data-remove-plan="${index}" type="button">Eliminar</button>
        </div>
        <div class="cr-plan-grid">
          <input class="cr-mini" data-f="billingLabel" value="${esc(plan.billingLabel||'')}" placeholder="/mes">
          <input class="cr-mini" data-f="badge" value="${esc(plan.badge||'')}" placeholder="Etiqueta">
          <input class="cr-mini" data-f="pointsCost" type="number" min="0" value="${plan.pointsCost??''}" placeholder="Puntos">
          <label class="cr-check"><input data-f="active" type="checkbox" ${plan.active!==false?'checked':''}> Activo</label>
        </div>
        <input class="cr-mini" data-f="features" value="${esc((plan.features||[]).join(' | '))}" placeholder="Características separadas por |">
        <textarea class="cr-mini" data-f="optionsText" placeholder="Opciones: Nombre=Precio=Beneficio · una por línea">${esc((plan.options||[]).map((option)=>`${option.label||''}=${option.price??''}=${option.bonus||''}`).join('\n'))}</textarea>
      </div>`).join('')||'<div class="cr-empty">Agregue por lo menos un plan.</div>';
      box.querySelectorAll('[data-plan]').forEach((row)=>{
        row.querySelectorAll('[data-f]').forEach((input)=>{
          const update=()=>{
            const plan=product.plans[Number(row.dataset.plan)];
            if(!plan)return;
            const field=input.dataset.f;
            if(field==='price'||field==='pointsCost')plan[field]=input.value===''?null:Number(input.value);
            else if(field==='features')plan.features=input.value.split('|').map((item)=>item.trim()).filter(Boolean);
            else if(field==='optionsText')plan.options=parseOptions(input.value,plan.options||[]);
            else if(field==='active')plan.active=input.checked;
            else plan[field]=input.value;
          };
          input.oninput=update;input.onchange=update;
        });
      });
      box.querySelectorAll('[data-remove-plan]').forEach((button)=>{
        button.onclick=()=>{product.plans.splice(Number(button.dataset.removePlan),1);renderPlans();};
      });
    }

    const productFile=$('#cpeImgFile');
    if(productFile)productFile.onchange=async()=>{
      const file=productFile.files&&productFile.files[0];if(!file)return;
      const uploadState=$('#cpeUploadState');productFile.disabled=true;if(uploadState)uploadState.textContent='Subiendo y optimizando imagen…';
      try{
        const imageUrl=await uploadImageFile(file,'product');
        product.imageUrl=imageUrl;$('#cpeImg').value=imageUrl;
        const preview=$('#cpeImgPreview');if(preview)preview.innerHTML=`<img src="${esc(imageUrl)}" alt="Vista previa">`;
        if(uploadState)uploadState.textContent='✅ Imagen subida. Se publicará al guardar el producto.';
      }catch(error){if(uploadState)uploadState.textContent=`⚠️ ${error.message}`;}
      finally{productFile.disabled=false;productFile.value='';}
    };
    $('#cpeImg').oninput=()=>{const preview=$('#cpeImgPreview');if(preview){const url=$('#cpeImg').value.trim();preview.innerHTML=url?`<img src="${esc(url)}" alt="Vista previa">`:'Sin imagen cargada';}};

    renderPlans();
    $('#cpeAddPlan').onclick=()=>{
      product.plans.push({id:uid('plan'),name:'Nuevo plan',price:null,billingLabel:'',active:true,availability:'on_request',badge:'',pointsCost:null,features:[],options:[]});
      renderPlans();
    };
    $('#cpeCancel').onclick=()=>{if(!state.saving)modal.hidden=true;};
    $('#cpeOk').onclick=async()=>{
      if(state.saving)return;
      product.name=$('#cpeName').value.trim();
      product.categoryId=$('#cpeCat').value;
      product.availability=$('#cpeAv').value;
      product.order=Number($('#cpeOrder').value)||0;
      product.imageUrl=$('#cpeImg').value.trim();
      product.summary=$('#cpeSummary').value.trim();
      product.badge=$('#cpeBadge').value.trim();
      product.badgeTone=$('#cpeBadgeTone').value;
      product.productFeatures=$('#cpeFeatures').value.split('\n').map((item)=>item.trim()).filter(Boolean);
      product.active=$('#cpeActive').checked;
      product.storeEnabled=$('#cpeStore').checked;
      product.redemptionOnly=$('#cpeRedeem').checked;
      const before=clone(state.catalog);
      const current=state.catalog.products.find((item)=>item.id===product.id);
      if(current)Object.assign(current,clone(product));else state.catalog.products.push(clone(product));
      const errors=validateCatalog(state.catalog,{productIds:[product.id]});
      if(errors.length){
        state.catalog=before;
        const errorBox=$('#cpeError');errorBox.hidden=false;errorBox.textContent=errors[0];
        return;
      }
      const button=$('#cpeOk');button.disabled=true;button.textContent='Publicando…';
      const saved=await saveCatalog({progress:'Guardando producto…',message:`Producto “${product.name}” guardado.`});
      if(!saved){
        state.catalog=before;
        const errorBox=$('#cpeError');errorBox.hidden=false;errorBox.textContent=$('#crStatus')?.textContent||'No se pudo guardar.';
        button.disabled=false;button.textContent='Guardar y publicar';
        return;
      }
      closeModal();renderProducts();
    };
  }

  function renderAvailability(){
    const body=$('#crBody');
    body.innerHTML=`<div class="cr-note">Cambie estados y luego presione <b>Guardar ajustes</b>.</div><div class="cr-grid">${state.catalog.products.map((product)=>`<article class="cr-card">
      <h3>${esc(product.name)}</h3>
      <label class="cr-field">Estado del producto<select data-av-product="${esc(product.id)}">${Object.entries(A).map(([key,label])=>`<option value="${key}" ${key===product.availability?'selected':''}>${label}</option>`).join('')}</select></label>
      ${(product.plans||[]).map((plan)=>`<div class="cr-row"><small>${esc(plan.name)}</small><select class="cr-mini" data-av-plan="${esc(product.id)}|${esc(plan.id)}">${Object.entries(A).map(([key,label])=>`<option value="${key}" ${key===plan.availability?'selected':''}>${label}</option>`).join('')}</select></div>`).join('')}
    </article>`).join('')||'<div class="cr-empty">No hay productos.</div>'}</div>`;
    body.querySelectorAll('[data-av-product]').forEach((select)=>{
      select.onchange=()=>{const product=state.catalog.products.find((item)=>item.id===select.dataset.avProduct);if(product){product.availability=select.value;markDirty();}};
    });
    body.querySelectorAll('[data-av-plan]').forEach((select)=>{
      select.onchange=()=>{const [productId,planId]=select.dataset.avPlan.split('|');const plan=state.catalog.products.find((item)=>item.id===productId)?.plans.find((item)=>item.id===planId);if(plan){plan.availability=select.value;markDirty();}};
    });
  }

  function slugId(value){
    return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
  }

  function categoryCard(category){
    const count=(state.catalog.products||[]).filter((product)=>product.categoryId===category.id).length;
    return `<article class="cr-card" data-category-card="${esc(category.id)}">
      <div class="cr-card-head"><div class="cr-category-icon">${esc(category.icon||'⌚')}</div><div><h3>${esc(category.name)}</h3><small>ID: <b>${esc(category.id)}</b></small></div></div>
      <div class="cr-row"><span class="cr-badge ${category.active!==false?'':'paused'}">${category.active!==false?'Activa':'Oculta'}</span><small>${count} producto(s) · orden ${Number(category.order)||0}</small></div>
      <div class="cr-card-actions"><button class="cr-btn ghost" data-edit-category="${esc(category.id)}">Editar</button><button class="cr-btn danger" data-delete-category="${esc(category.id)}">Eliminar</button></div>
    </article>`;
  }

  function renderCategories(){
    const body=$('#crBody');
    const categories=state.catalog.categories||[];
    body.innerHTML=`<div class="cr-tools"><span class="cr-note-inline">Agregar, editar y eliminar categorías se publica de inmediato. El ID ahora siempre está visible.</span><button class="cr-btn red" id="crAddCat">＋ Categoría</button></div>
      <div class="cr-grid">${categories.map(categoryCard).join('')||'<div class="cr-empty">No hay categorías.</div>'}</div>`;
    $('#crAddCat').onclick=()=>editCategory('');
    body.querySelectorAll('[data-edit-category]').forEach((button)=>{button.onclick=()=>editCategory(button.dataset.editCategory);});
    body.querySelectorAll('[data-delete-category]').forEach((button)=>{button.onclick=()=>deleteCategory(button.dataset.deleteCategory,button);});
  }

  function editCategory(categoryId){
    const existing=state.catalog.categories.find((item)=>item.id===categoryId);
    const category=existing?clone(existing):{
      id:`categoria-${Date.now()}`,name:'Nueva categoría',icon:'⌚',order:(state.catalog.categories.length+1)*10,active:true
    };
    const originalId=existing?.id||'';
    const modal=$('#crModal');modal.hidden=false;
    modal.innerHTML=`<div class="cr-sheet cr-sheet-small">
      <h2>${existing?'Editar':'Nueva'} categoría</h2>
      <div class="cr-form">
        <label class="cr-field wide">Nombre<input id="catName" value="${esc(category.name)}" placeholder="Ej. Pase Flexible VIP"></label>
        <label class="cr-field wide">ID <input id="catId" value="${esc(category.id)}" placeholder="pase-flexible-vip"><span class="cr-field-help">Identificador interno. Puede editarlo; se ajustarán automáticamente los productos de esta categoría.</span></label>
        <label class="cr-field">Icono<input id="catIcon" value="${esc(category.icon||'')}" placeholder="🎟️"></label>
        <label class="cr-field">Orden<input id="catOrder" type="number" value="${Number(category.order)||0}"></label>
        <label class="cr-check"><input id="catActive" type="checkbox" ${category.active!==false?'checked':''}> Categoría activa</label>
      </div>
      <div class="cr-modal-error" id="catError" hidden></div>
      <div class="cr-actions"><button class="cr-btn ghost" id="catCancel">Cancelar</button><button class="cr-btn red" id="catOk">Guardar y publicar</button></div>
    </div>`;
    enhanceModal();
    const autoId=()=>{if($('#catId').dataset.auto==='1'){$('#catId').value=slugId($('#catName').value)||`categoria-${Date.now()}`;$('#catId').dataset.auto='1';}};
    if(!existing){$('#catId').dataset.auto='1';$('#catName').oninput=autoId;}
    $('#catId').oninput=()=>{$('#catId').dataset.auto='0';};
    $('#catCancel').onclick=()=>{if(!state.saving)modal.hidden=true;};
    $('#catOk').onclick=async()=>{
      if(state.saving)return;
      const newId=slugId($('#catId').value);
      const name=$('#catName').value.trim();
      const errorBox=$('#catError');
      if(!name||!newId){errorBox.hidden=false;errorBox.textContent='Escriba nombre e ID de la categoría.';return;}
      if(state.catalog.categories.some((item)=>item.id===newId&&item.id!==originalId)){errorBox.hidden=false;errorBox.textContent=`Ya existe una categoría con el ID “${newId}”.`;return;}
      const before=clone(state.catalog);
      category.id=newId;category.name=name;category.icon=$('#catIcon').value.trim();category.order=Number($('#catOrder').value)||0;category.active=$('#catActive').checked;
      if(existing){
        const current=state.catalog.categories.find((item)=>item.id===originalId);if(current)Object.assign(current,clone(category));
        if(originalId!==newId)state.catalog.products.forEach((product)=>{if(product.categoryId===originalId)product.categoryId=newId;});
      }else state.catalog.categories.unshift(clone(category));
      const button=$('#catOk');button.disabled=true;button.textContent='Publicando…';
      const saved=await saveCatalog({progress:'Guardando categoría…',message:`Categoría “${category.name}” guardada.`});
      if(!saved){state.catalog=before;errorBox.hidden=false;errorBox.textContent=$('#crStatus')?.textContent||'No se pudo guardar.';button.disabled=false;button.textContent='Guardar y publicar';return;}
      closeModal();renderCategories();
    };
  }

  async function deleteCategory(categoryId,button){
    if(state.saving)return;
    const category=state.catalog.categories.find((item)=>item.id===categoryId);if(!category)return;
    if(state.catalog.categories.length<=1){notify('⚠️ Debe quedar al menos una categoría.');return;}
    const replacement=state.catalog.categories.find((item)=>item.id!==categoryId);
    const used=(state.catalog.products||[]).filter((product)=>product.categoryId===categoryId);
    const detail=used.length?`\n\n${used.length} producto(s) se moverán automáticamente a “${replacement.name}”.`:'';
    if(!confirm(`¿Eliminar la categoría “${category.name}”?${detail}`))return;
    const before=clone(state.catalog);
    state.catalog.products.forEach((product)=>{if(product.categoryId===categoryId)product.categoryId=replacement.id;});
    state.catalog.categories=state.catalog.categories.filter((item)=>item.id!==categoryId);
    if(button){button.disabled=true;button.textContent='Eliminando…';}
    const saved=await saveCatalog({progress:'Eliminando categoría…',message:`Categoría “${category.name}” eliminada.`});
    if(!saved)state.catalog=before;
    renderCategories();
  }

  function promotionCard(promotion){
    return `<article class="cr-card">
      <div class="cr-row"><h3>${esc(promotion.title)}</h3><span class="cr-badge ${promotion.active?'':'paused'}">${promotion.active?'Activa':'Pausada'}</span></div>
      <small>${esc(promotion.description||'Sin descripción')}</small>
      <div class="cr-row"><span>${(promotion.productIds||[]).length} producto(s)</span><span class="cr-card-actions"><button class="cr-btn ghost" data-edit-promotion="${esc(promotion.id)}">Editar</button><button class="cr-btn danger" data-delete-promotion="${esc(promotion.id)}">Eliminar</button></span></div>
    </article>`;
  }

  function renderPromotions(){
    const body=$('#crBody');
    const promotions=state.catalog.promotions||[];
    body.innerHTML=`<div class="cr-tools"><span class="cr-note-inline">Agregar, editar y eliminar se publica de inmediato.</span><button class="cr-btn red" id="crAddPromotion">＋ Promoción</button></div>
      <div class="cr-grid">${promotions.map(promotionCard).join('')||'<div class="cr-empty">No hay promociones públicas.</div>'}</div>`;
    $('#crAddPromotion').onclick=()=>editPromotion('');
    body.querySelectorAll('[data-edit-promotion]').forEach((button)=>{button.onclick=()=>editPromotion(button.dataset.editPromotion);});
    body.querySelectorAll('[data-delete-promotion]').forEach((button)=>{button.onclick=()=>deletePromotion(button.dataset.deletePromotion,button);});
  }

  async function deletePromotion(promotionId,button,confirmed=false){
    if(state.saving)return;
    const promotion=state.catalog.promotions.find((item)=>item.id===promotionId);
    if(!promotion||(!confirmed&&!confirm(`¿Eliminar la promoción “${promotion.title}”?`)))return;
    const before=clone(state.catalog);
    state.catalog.promotions=state.catalog.promotions.filter((item)=>item.id!==promotionId);
    if(button){button.disabled=true;button.textContent='Eliminando…';}
    const saved=await saveCatalog({progress:'Eliminando promoción…',message:`Promoción “${promotion.title}” eliminada.`});
    if(!saved)state.catalog=before;
    renderPromotions();
  }

  function editPromotion(promotionId){
    const existing=state.catalog.promotions.find((item)=>item.id===promotionId);
    const promotion=existing?clone(existing):{
      id:uid('promocion'),title:'Nueva promoción',description:'',active:false,startsAt:'',endsAt:'',
      order:state.catalog.promotions.length*10,accent:'#E2231A',productIds:[],features:[],
      options:[{id:uid('option'),label:'Oferta',price:null,bonus:''}]
    };
    const modal=$('#crModal');
    modal.hidden=false;
    modal.innerHTML=`<div class="cr-sheet">
      <h2>${existing?'Editar':'Nueva'} promoción</h2>
      <div class="cr-form">
        <label class="cr-field wide">Título<input id="prTitle" value="${esc(promotion.title)}"></label>
        <label class="cr-field wide">Descripción<textarea id="prDesc">${esc(promotion.description||'')}</textarea></label>
        <label class="cr-field">Inicio<input id="prStart" type="datetime-local" value="${esc((promotion.startsAt||'').slice(0,16))}"></label>
        <label class="cr-field">Final<input id="prEnd" type="datetime-local" value="${esc((promotion.endsAt||'').slice(0,16))}"></label>
        <label class="cr-check"><input id="prActive" type="checkbox" ${promotion.active?'checked':''}> Promoción activa</label>
        <div class="cr-section">Productos incluidos</div>
        <div class="cr-checks wide">${state.catalog.products.map((product)=>`<label class="cr-check"><input type="checkbox" data-pr-product="${esc(product.id)}" ${(promotion.productIds||[]).includes(product.id)?'checked':''}> ${esc(product.name)}</label>`).join('')||'<span class="cr-note-inline">Primero agregue un producto.</span>'}</div>
        <label class="cr-field wide">Beneficios · uno por línea<textarea id="prFeatures">${esc((promotion.features||[]).join('\n'))}</textarea></label>
        <label class="cr-field wide">Precios / opciones · Nombre=Precio=Beneficio<textarea id="prOptions" placeholder="1 mes=110=Oferta especial">${esc((promotion.options||[]).map((option)=>`${option.label||''}=${option.price??''}=${option.bonus||''}`).join('\n'))}</textarea></label>
      </div>
      <div class="cr-modal-error" id="prError" hidden></div>
      <div class="cr-actions"><button class="cr-btn danger" id="prDelete" ${existing?'':'hidden'}>Eliminar</button><button class="cr-btn ghost" id="prCancel">Cancelar</button><button class="cr-btn red" id="prOk">Guardar y publicar</button></div>
    </div>`;
    enhanceModal();
    $('#prCancel').onclick=()=>{if(!state.saving)modal.hidden=true;};
    if(existing)$('#prDelete').onclick=async()=>{
      if(!confirm(`¿Eliminar la promoción “${promotion.title}”?`))return;
      modal.hidden=true;
      await deletePromotion(existing.id,null,true);
    };
    $('#prOk').onclick=async()=>{
      if(state.saving)return;
      promotion.title=$('#prTitle').value.trim();
      promotion.description=$('#prDesc').value.trim();
      promotion.startsAt=$('#prStart').value;
      promotion.endsAt=$('#prEnd').value;
      promotion.active=$('#prActive').checked;
      promotion.features=$('#prFeatures').value.split('\n').map((item)=>item.trim()).filter(Boolean);
      promotion.productIds=[...modal.querySelectorAll('[data-pr-product]:checked')].map((input)=>input.dataset.prProduct);
      promotion.options=parseOptions($('#prOptions').value,promotion.options||[]);
      const before=clone(state.catalog);
      const current=state.catalog.promotions.find((item)=>item.id===promotion.id);
      if(current)Object.assign(current,clone(promotion));else state.catalog.promotions.push(clone(promotion));
      const errors=validateCatalog(state.catalog,{promotionIds:[promotion.id]});
      if(errors.length){
        state.catalog=before;
        const errorBox=$('#prError');errorBox.hidden=false;errorBox.textContent=errors[0];
        return;
      }
      const button=$('#prOk');button.disabled=true;button.textContent='Publicando…';
      const saved=await saveCatalog({progress:'Guardando promoción…',message:`Promoción “${promotion.title}” guardada.`});
      if(!saved){
        state.catalog=before;
        const errorBox=$('#prError');errorBox.hidden=false;errorBox.textContent=$('#crStatus')?.textContent||'No se pudo guardar.';
        button.disabled=false;button.textContent='Guardar y publicar';
        return;
      }
      closeModal();renderPromotions();
    };
  }

  async function fileAsBase64(blob){
    return await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
      reader.onerror=()=>reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(blob);
    });
  }

  async function optimizeImage(file){
    if(!file||!/^image\/(jpeg|png|webp)$/i.test(file.type||''))throw new Error('Use una imagen JPG, PNG o WebP.');
    if(file.size>10*1024*1024)throw new Error('La imagen supera 10 MB.');
    if(file.size<=2.15*1024*1024)return {blob:file,filename:file.name||'imagen'};
    let bitmap=null,url='';
    try{
      if('createImageBitmap' in window)bitmap=await createImageBitmap(file);
      else{
        url=URL.createObjectURL(file);
        bitmap=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('No se pudo procesar la imagen.'));image.src=url;});
      }
      const width=bitmap.width||bitmap.naturalWidth,height=bitmap.height||bitmap.naturalHeight;
      const scale=Math.min(1,1900/Math.max(width,height));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('No se pudo preparar la imagen.');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      let blob=null;
      for(const quality of [0.86,0.76,0.66]){
        blob=await new Promise((resolve)=>canvas.toBlob(resolve,'image/webp',quality));
        if(blob&&blob.size<=2.2*1024*1024)break;
      }
      if(!blob||blob.size>2.8*1024*1024)throw new Error('No se pudo reducir la imagen a un tamaño seguro para subirla.');
      return {blob,filename:String(file.name||'imagen').replace(/\.[^.]+$/,'')+'.webp'};
    }finally{if(bitmap&&typeof bitmap.close==='function')bitmap.close();if(url)URL.revokeObjectURL(url);}
  }

  async function uploadImageFile(file,kind='carousel'){
    const optimized=await optimizeImage(file);
    const base64=await fileAsBase64(optimized.blob);
    const data=await api({accion:'subir_imagen',kind,filename:optimized.filename,mime:optimized.blob.type||file.type,base64});
    if(!data.imageUrl)throw new Error('El servidor no devolvió la URL de la imagen.');
    return data.imageUrl;
  }

  function carouselCard(slide){
    return `<article class="cr-card">
      <div class="cr-carousel-preview">${slide.imageUrl?`<img src="${esc(slide.imageUrl)}" alt="${esc(slide.title||'Banner')}">`:'<span>Sin imagen</span>'}</div>
      <div class="cr-row"><div><h3>${esc(slide.title||'Banner sin título')}</h3><small>ID: ${esc(slide.id)}</small></div><span class="cr-badge ${slide.active!==false?'':'paused'}">${slide.active!==false?'Activo':'Oculto'}</span></div>
      <small>Orden ${Number(slide.order)||0} · imagen ${esc(slide.imageFit||'cover')}</small>
      <div class="cr-card-actions"><button class="cr-btn ghost" data-edit-slide="${esc(slide.id)}">Editar</button><button class="cr-btn danger" data-delete-slide="${esc(slide.id)}">Eliminar</button></div>
    </article>`;
  }

  function renderCarousel(){
    const body=$('#crBody');const slides=state.catalog.carousel||[];
    body.innerHTML=`<div class="cr-tools"><span class="cr-note-inline">Suba aquí las nuevas imágenes del carrusel. JPG, PNG o WebP; se optimizan y se publican en el catálogo.</span><button class="cr-btn red" id="crAddSlide">＋ Banner</button></div>
      <div class="cr-grid">${slides.map(carouselCard).join('')||'<div class="cr-empty"><b>Aún no hay banners administrables.</b><span>Presione “＋ Banner” para subir la primera imagen.</span></div>'}</div>`;
    $('#crAddSlide').onclick=()=>editCarouselSlide('');
    body.querySelectorAll('[data-edit-slide]').forEach((button)=>{button.onclick=()=>editCarouselSlide(button.dataset.editSlide);});
    body.querySelectorAll('[data-delete-slide]').forEach((button)=>{button.onclick=()=>deleteCarouselSlide(button.dataset.deleteSlide,button);});
  }

  function editCarouselSlide(slideId){
    const existing=(state.catalog.carousel||[]).find((item)=>item.id===slideId);
    const slide=existing?clone(existing):{
      id:uid('banner'),title:'',subtitle:'',badge:'',buttonLabel:'',imageUrl:'',imageFit:'cover',active:true,
      order:(state.catalog.carousel.length+1)*10,actionType:'none',actionValue:'',accentFrom:'#E2231A',accentTo:'#7A0C08'
    };
    const modal=$('#crModal');modal.hidden=false;
    modal.innerHTML=`<div class="cr-sheet">
      <h2>${existing?'Editar':'Nuevo'} banner del carrusel</h2>
      <div class="cr-form">
        <label class="cr-field">ID<input id="carId" value="${esc(slide.id)}" ${existing?'disabled':''}></label>
        <label class="cr-field">Orden<input id="carOrder" type="number" value="${Number(slide.order)||0}"></label>
        <label class="cr-field wide cr-upload-field">Subir nueva imagen<input id="carFile" type="file" accept="image/jpeg,image/png,image/webp"><span class="cr-upload-state" id="carUploadState">Seleccione una imagen. Si pesa mucho, Sublichat la optimiza antes de subirla.</span></label>
        <label class="cr-field wide">Imagen URL<input id="carImage" value="${esc(slide.imageUrl||'')}" placeholder="También puede pegar una URL https://..."></label>
        <div class="cr-image-preview cr-carousel-large wide" id="carPreview">${slide.imageUrl?`<img src="${esc(slide.imageUrl)}" alt="Vista previa">`:'Sin imagen cargada'}</div>
        <label class="cr-field">Ajuste de imagen<select id="carFit"><option value="cover" ${slide.imageFit!=='contain'?'selected':''}>Cubrir (cover)</option><option value="contain" ${slide.imageFit==='contain'?'selected':''}>Completa (contain)</option></select></label>
        <label class="cr-field">Estado<label class="cr-check"><input id="carActive" type="checkbox" ${slide.active!==false?'checked':''}> Banner activo</label></label>
        <label class="cr-field wide">Título<input id="carTitle" value="${esc(slide.title||'')}" placeholder="Opcional si la imagen ya trae todo el texto"></label>
        <label class="cr-field wide">Subtítulo<textarea id="carSubtitle">${esc(slide.subtitle||'')}</textarea></label>
        <label class="cr-field">Badge<input id="carBadge" value="${esc(slide.badge||'')}" placeholder="OFERTA"></label>
        <label class="cr-field">Texto del botón<input id="carButton" value="${esc(slide.buttonLabel||'')}" placeholder="Ver oferta"></label>
        <label class="cr-field">Acción<select id="carActionType"><option value="none" ${slide.actionType==='none'?'selected':''}>Sin acción</option><option value="tab" ${slide.actionType==='tab'?'selected':''}>Abrir sección</option><option value="product" ${slide.actionType==='product'?'selected':''}>Abrir producto</option><option value="url" ${slide.actionType==='url'?'selected':''}>Abrir URL</option></select></label>
        <label class="cr-field">Valor de acción<input id="carActionValue" value="${esc(slide.actionValue||'')}" placeholder="promos, ID producto o https://..."></label>
        <label class="cr-field">Color inicial<input id="carAccentFrom" type="color" value="${esc(slide.accentFrom||'#E2231A')}"></label>
        <label class="cr-field">Color final<input id="carAccentTo" type="color" value="${esc(slide.accentTo||'#7A0C08')}"></label>
      </div>
      <div class="cr-modal-error" id="carError" hidden></div>
      <div class="cr-actions cr-sticky-actions"><button class="cr-btn ghost" id="carCancel">Cancelar</button><button class="cr-btn red" id="carOk">Guardar y publicar</button></div>
    </div>`;
    enhanceModal();
    const fileInput=$('#carFile');
    fileInput.onchange=async()=>{
      const file=fileInput.files&&fileInput.files[0];if(!file)return;
      const uploadState=$('#carUploadState');fileInput.disabled=true;if(uploadState)uploadState.textContent='Subiendo imagen…';
      try{const imageUrl=await uploadImageFile(file,'carousel');slide.imageUrl=imageUrl;$('#carImage').value=imageUrl;$('#carPreview').innerHTML=`<img src="${esc(imageUrl)}" alt="Vista previa">`;if(uploadState)uploadState.textContent='✅ Imagen subida correctamente.';}
      catch(error){if(uploadState)uploadState.textContent=`⚠️ ${error.message}`;}
      finally{fileInput.disabled=false;fileInput.value='';}
    };
    $('#carImage').oninput=()=>{const url=$('#carImage').value.trim();$('#carPreview').innerHTML=url?`<img src="${esc(url)}" alt="Vista previa">`:'Sin imagen cargada';};
    $('#carCancel').onclick=()=>{if(!state.saving)modal.hidden=true;};
    $('#carOk').onclick=async()=>{
      if(state.saving)return;
      const newId=slugId($('#carId').value)||uid('banner');
      if(!existing&&state.catalog.carousel.some((item)=>item.id===newId)){const e=$('#carError');e.hidden=false;e.textContent='Ese ID de banner ya existe.';return;}
      slide.id=newId;slide.order=Number($('#carOrder').value)||0;slide.imageUrl=$('#carImage').value.trim();slide.imageFit=$('#carFit').value;slide.active=$('#carActive').checked;
      slide.title=$('#carTitle').value.trim();slide.subtitle=$('#carSubtitle').value.trim();slide.badge=$('#carBadge').value.trim();slide.buttonLabel=$('#carButton').value.trim();slide.actionType=$('#carActionType').value;slide.actionValue=$('#carActionValue').value.trim();slide.accentFrom=$('#carAccentFrom').value;slide.accentTo=$('#carAccentTo').value;
      if(!slide.imageUrl&&!slide.title){const e=$('#carError');e.hidden=false;e.textContent='Suba una imagen o escriba un título.';return;}
      const before=clone(state.catalog);const current=state.catalog.carousel.find((item)=>item.id===slide.id);
      if(existing){const target=state.catalog.carousel.find((item)=>item.id===existing.id);if(target)Object.assign(target,clone(slide));}else if(current)Object.assign(current,clone(slide));else state.catalog.carousel.push(clone(slide));
      const button=$('#carOk');button.disabled=true;button.textContent='Publicando…';
      const saved=await saveCatalog({progress:'Guardando carrusel…',message:'Carrusel actualizado.'});
      if(!saved){state.catalog=before;const e=$('#carError');e.hidden=false;e.textContent=$('#crStatus')?.textContent||'No se pudo guardar.';button.disabled=false;button.textContent='Guardar y publicar';return;}
      closeModal();renderCarousel();
    };
  }

  async function deleteCarouselSlide(slideId,button){
    if(state.saving)return;const slide=state.catalog.carousel.find((item)=>item.id===slideId);if(!slide)return;
    if(!confirm(`¿Eliminar este banner${slide.title?` “${slide.title}”`:''}?`))return;
    const before=clone(state.catalog);state.catalog.carousel=state.catalog.carousel.filter((item)=>item.id!==slideId);
    if(button){button.disabled=true;button.textContent='Eliminando…';}
    const saved=await saveCatalog({progress:'Eliminando banner…',message:'Banner eliminado del carrusel.'});
    if(!saved)state.catalog=before;renderCarousel();
  }

  function renderSettings(){
    const body=$('#crBody');
    const settings=state.catalog.settings||{};
    body.innerHTML=`<div class="cr-note">Edite y luego presione <b>Guardar ajustes</b>.</div><div class="cr-settings">
      <label class="cr-field">Marca<input id="csBrand" value="${esc(settings.brand||'Sublicuentas')}"></label>
      <label class="cr-field">Moneda<input id="csCurrency" value="${esc(settings.currencyLabel||'Lps.')}"></label>
      <label class="cr-field wide">Eslogan<input id="csSlogan" value="${esc(settings.slogan||'')}"></label>
      <label class="cr-field">WhatsApp<input id="csWhatsapp" value="${esc(settings.whatsapp||'')}"></label>
      <label class="cr-field">Puntos por compra<input id="csPoints" type="number" value="${settings.pointsPerConfirmedPurchase??10}"></label>
      <label class="cr-field">Máximo apps en combo<input id="csMaxCombo" type="number" min="2" max="5" value="${settings.maxComboItems??5}"></label>
    </div>
    <div class="cr-section cr-history-title">Historial reciente</div>
    <div class="cr-history">${state.history.map((item)=>`<article><b>v${item.catalogVersion}</b> · ${esc(item.actor||'—')} · ${item.productCount} productos · ${item.promotionCount} promociones <small>${item.createdAt?new Date(item.createdAt).toLocaleString('es-HN'):'—'}</small></article>`).join('')||'<div class="cr-empty">Sin historial.</div>'}</div>`;
    [['csBrand','brand'],['csCurrency','currencyLabel'],['csSlogan','slogan'],['csWhatsapp','whatsapp']].forEach(([elementId,key])=>{
      $('#'+elementId).oninput=(event)=>{state.catalog.settings[key]=event.target.value;markDirty();};
    });
    $('#csPoints').oninput=(event)=>{state.catalog.settings.pointsPerConfirmedPurchase=Number(event.target.value)||0;markDirty();};
    $('#csMaxCombo').oninput=(event)=>{state.catalog.settings.maxComboItems=Math.max(2,Math.min(5,Number(event.target.value)||5));markDirty();};
  }

  function init(){
    shell();
    const screen=document.getElementById('screen-catalogo-relojes');
    if(screen?.classList.contains('active'))load();
    if(screen&&!screen.dataset.catalogObserver){
      screen.dataset.catalogObserver='1';
      new MutationObserver(()=>{
        if(screen.classList.contains('active')){shell();load();}
        else closeModal();
      }).observe(screen,{attributes:true,attributeFilter:['class']});
    }
    if(!document.documentElement.dataset.catalogEscape){
      document.documentElement.dataset.catalogEscape='1';
      document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!state.saving)closeModal();},true);
    }
  }

  window.SublichatCatalogoRelojes={open:()=>{shell();load();},reload:()=>load(true),close:()=>closeModal()};
  window.addEventListener('beforeunload',(event)=>{
    if(!state.dirty)return;
    event.preventDefault();event.returnValue='';
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
