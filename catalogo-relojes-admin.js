(function catalogoRelojesAdmin(){
  'use strict';

  const API='/api/catalogo-relojes';
  const BUILD='20260907-3';
  const state={
    loaded:false,loading:false,saving:false,dirty:false,tab:'products',catalog:null,history:[]
  };
  const A={
    available:'Disponible',limited:'Pocas disponibles',on_request:'Bajo pedido',
    paused:'No disponible',maintenance:'Mantenimiento'
  };

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

  function shell(){
    const target=host();
    if(!target||target.dataset.ready)return;
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
      };
    });
    $('#crSave').onclick=()=>saveCatalog({message:'Ajustes publicados.'});
    $('#crReload').onclick=()=>load(true);
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

  function validateCatalog(catalog){
    const errors=[];
    const categories=new Set((catalog.categories||[]).map((item)=>item.id));
    const productIds=new Set();
    (catalog.products||[]).forEach((product)=>{
      if(!String(product.name||'').trim())errors.push('Hay un producto sin nombre.');
      if(productIds.has(product.id))errors.push(`Producto duplicado: ${product.name||product.id}.`);
      productIds.add(product.id);
      if(!categories.has(product.categoryId))errors.push(`${product.name}: seleccione una categoría válida.`);
      if(!(product.plans||[]).length)errors.push(`${product.name}: agregue al menos un plan.`);
      (product.plans||[]).forEach((plan)=>{
        const hasPrice=plan.price!=null&&Number.isFinite(Number(plan.price));
        const hasOptionPrice=(plan.options||[]).some((option)=>option.price!=null&&Number.isFinite(Number(option.price)));
        if(plan.active!==false&&!['on_request','paused','maintenance'].includes(plan.availability)&&!hasPrice&&!hasOptionPrice){
          errors.push(`${product.name} / ${plan.name}: escriba un precio o marque “Bajo pedido”.`);
        }
      });
    });
    (catalog.promotions||[]).forEach((promotion)=>{
      if(!String(promotion.title||'').trim())errors.push('Hay una promoción sin título.');
      (promotion.productIds||[]).forEach((id)=>{
        if(!productIds.has(id))errors.push(`${promotion.title}: contiene un producto que ya no existe.`);
      });
      const hasPrice=(promotion.options||[]).some((option)=>option.price!=null&&Number.isFinite(Number(option.price)));
      if(promotion.active!==false&&!hasPrice)errors.push(`${promotion.title}: agregue al menos una opción con precio antes de activarla.`);
      const starts=promotion.startsAt?Date.parse(promotion.startsAt):NaN;
      const ends=promotion.endsAt?Date.parse(promotion.endsAt):NaN;
      if(Number.isFinite(starts)&&Number.isFinite(ends)&&starts>=ends){
        errors.push(`${promotion.title}: la fecha final debe ser posterior al inicio.`);
      }
    });
    return [...new Set(errors)];
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
      status(data.source==='remote'
        ?'Conectado al catálogo público de Relojes.'
        :(data.exists?'Conectado a Firebase.':'Catálogo listo para configurar.'),'good');
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
      categories:renderCategories,settings:renderSettings
    }[state.tab]||renderProducts;
    renderer();
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
      <div class="cr-row"><span class="cr-badge ${product.availability==='paused'?'paused':''}">${esc(A[product.availability]||product.availability)}</span><span class="cr-price">${money(firstPrice(product))}</span></div>
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
      order:(state.catalog.products.length+1)*10,accent:'#E2231A',imageUrl:'',summary:'',productFeatures:[],
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
        <label class="cr-field wide">Imagen URL<input id="cpeImg" value="${esc(product.imageUrl||'')}" placeholder="https://... o /assets/..."></label>
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
      product.productFeatures=$('#cpeFeatures').value.split('\n').map((item)=>item.trim()).filter(Boolean);
      product.active=$('#cpeActive').checked;
      product.storeEnabled=$('#cpeStore').checked;
      product.redemptionOnly=$('#cpeRedeem').checked;
      const before=clone(state.catalog);
      const current=state.catalog.products.find((item)=>item.id===product.id);
      if(current)Object.assign(current,clone(product));else state.catalog.products.push(clone(product));
      const errors=validateCatalog(state.catalog);
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
      modal.hidden=true;renderProducts();
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

  function renderCategories(){
    const body=$('#crBody');
    body.innerHTML=`<div class="cr-tools"><span class="cr-note-inline">Los cambios de categorías se confirman con “Guardar ajustes”.</span><button class="cr-btn red" id="crAddCat">＋ Categoría</button></div>
      <div class="cr-grid">${state.catalog.categories.map((category,index)=>`<article class="cr-card">
        <label class="cr-field">Nombre<input data-cat-name="${index}" value="${esc(category.name)}"></label>
        <label class="cr-field">ID<input value="${esc(category.id)}" disabled></label>
        <label class="cr-field">Icono<input data-cat-icon="${index}" value="${esc(category.icon||'')}" placeholder="⌚"></label>
        <label class="cr-field">Orden<input type="number" data-cat-order="${index}" value="${Number(category.order)||0}"></label>
        <label class="cr-check"><input type="checkbox" data-cat-active="${index}" ${category.active!==false?'checked':''}> Activa</label>
      </article>`).join('')}</div>`;
    $('#crAddCat').onclick=()=>{
      state.catalog.categories.push({id:uid('categoria'),name:'Nueva categoría',description:'',active:true,order:state.catalog.categories.length*10,icon:'⌚'});
      markDirty();renderCategories();
    };
    body.querySelectorAll('[data-cat-name]').forEach((input)=>{input.oninput=()=>{state.catalog.categories[Number(input.dataset.catName)].name=input.value;markDirty();};});
    body.querySelectorAll('[data-cat-icon]').forEach((input)=>{input.oninput=()=>{state.catalog.categories[Number(input.dataset.catIcon)].icon=input.value;markDirty();};});
    body.querySelectorAll('[data-cat-order]').forEach((input)=>{input.oninput=()=>{state.catalog.categories[Number(input.dataset.catOrder)].order=Number(input.value)||0;markDirty();};});
    body.querySelectorAll('[data-cat-active]').forEach((input)=>{input.onchange=()=>{state.catalog.categories[Number(input.dataset.catActive)].active=input.checked;markDirty();};});
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
      const errors=validateCatalog(state.catalog);
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
      modal.hidden=true;renderPromotions();
    };
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
      new MutationObserver(()=>{if(screen.classList.contains('active')){shell();load();}})
        .observe(screen,{attributes:true,attributeFilter:['class']});
    }
  }

  window.SublichatCatalogoRelojes={open:()=>{shell();load();},reload:()=>load(true)};
  window.addEventListener('beforeunload',(event)=>{
    if(!state.dirty)return;
    event.preventDefault();event.returnValue='';
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
