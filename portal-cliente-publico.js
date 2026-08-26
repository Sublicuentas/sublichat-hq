(function sublichatPortalClientePublico(){
  'use strict';

  const state={
    data:null,
    error:false,
    sorteosData:null,
    sorteosError:false,
    enhanced:false,
    activePanel:'cuentas',
    paymentAllowed:false
  };

  const LOGO_KEYS=new Set(['tigo','atlantida','bac','ficohsa','davivienda','banpais','tengo','occidente']);
  const PAYMENT_VENDOR_KEYS=new Set(['relojes','sublicuentas']);
  const PORTAL_ICONS={
    cuentas:'/assets/portal-icono-mis-cuentas-transparent.png?v=20260816-4',
    promociones:'/assets/portal-icono-promociones-transparent.png?v=20260816-4',
    pagos:'/assets/portal-icono-metodos-pago-transparent.png?v=20260816-4',
    sorteos:'emoji:🎁',
    perfil:'/assets/portal-icono-perfil-transparent.png?v=20260816-4',
    correo:'/assets/portal-icono-correo-transparent.png?v=20260816-4',
    contrasena:'/assets/portal-icono-contrasena-transparent.png?v=20260816-4'
  };
  const MASCOT_SOURCES=[
    '/assets/portal-robot-transparent.png?v=20260816-4',
    '/assets/portal-robot.jpg?v=20260816-3',
    '/assets/sublicuentas-mascota-portal.jpg?v=20260816-2',
    '/assets/sublicuentas-mascota-portal.png?v=20260816-2',
    '/assets/sublicuentas-mascota.jpg?v=20260816-2'
  ];

  function tokenFromLocation(){
    const params=new URLSearchParams(window.location.search);
    let token=params.get('token')||'';
    if(!token){
      const match=window.location.pathname.match(/\/c\/([^/?#]+)/);
      if(match)token=decodeURIComponent(match[1]);
    }
    return token;
  }

  function element(tag,className,text){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  }

  function safeColor(value){
    return /^#[0-9a-fA-F]{6}$/.test(String(value||''))?String(value):'#E2231A';
  }

  function safeImage(value){
    const src=String(value||'').trim();
    return /^https:\/\//i.test(src)||src.startsWith('data:image/')?src:'';
  }

  function clampLogoValue(value,min,max,fallback){
    const number=Number(value);
    return Number.isFinite(number)?Math.max(min,Math.min(max,Math.round(number))):fallback;
  }

  function normalizeVendor(value){
    return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
  }

  function paymentsVisible(){
    return state.paymentAllowed&&state.data?.secciones?.pagos!==false;
  }

  function syncPaymentVisibility(){
    const visible=paymentsVisible();
    const button=document.querySelector('[data-portal-panel="pagos"]');
    const panel=document.getElementById('portal-panel-pagos');
    const nav=document.querySelector('.portal-categories');
    if(button)button.hidden=!visible;
    if(panel&&!visible)panel.hidden=true;
    if(nav){nav.classList.remove('two-categories');nav.classList.toggle('four-categories',visible);}
    if(!visible&&state.activePanel==='pagos')selectPanel('cuentas',false);
  }

  function loadMascot(image){
    if(!image)return;
    let sourceIndex=0;
    const nextSource=()=>{
      if(sourceIndex<MASCOT_SOURCES.length){
        image.src=MASCOT_SOURCES[sourceIndex++];
        return;
      }
      image.hidden=true;
      image.parentElement?.classList.add('mascot-fallback');
    };
    image.addEventListener('error',nextSource);
    nextSource();
  }

  function collapseAccounts(accessList){
    accessList.querySelectorAll('.multi-service').forEach(item=>{
      item.classList.remove('open');
      const trigger=item.querySelector('.multi-trigger');
      const details=item.querySelector('.multi-details');
      if(trigger)trigger.setAttribute('aria-expanded','false');
      if(details)details.hidden=true;
    });
  }

  function accessIconFor(label){
    const key=String(label||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(key.includes('perfil')||key.includes('usuario'))return PORTAL_ICONS.perfil;
    if(key.includes('correo'))return PORTAL_ICONS.correo;
    if(key.includes('clave')||key.includes('contrasena')||key.includes('pin')||key.includes('serial')||key.includes('licencia'))return PORTAL_ICONS.contrasena;
    return '';
  }

  function applyAccessIcons(accessList){
    accessList.querySelectorAll('.field').forEach(field=>{
      const icon=field.querySelector('.field-icon');
      const label=field.querySelector('.field-label')?.textContent||'';
      const source=accessIconFor(label);
      if(!icon||!source)return;
      const image=element('img','portal-field-icon-image');
      image.src=source;image.alt='';image.loading='lazy';image.decoding='async';
      icon.replaceChildren(image);icon.classList.add('has-portal-image');
    });
  }

  function showToast(message){
    const toast=document.getElementById('toast');
    if(!toast)return;
    toast.textContent=message||'¡Copiado!';
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer=setTimeout(()=>toast.classList.remove('show'),1700);
  }

  async function copyText(value){
    const text=String(value||'').trim();
    if(!text)return;
    try{
      await navigator.clipboard.writeText(text);
    }catch(_){
      const area=document.createElement('textarea');
      area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';
      document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
    }
    showToast('¡Número copiado!');
  }

  function serviceCount(accessList){
    const multiple=accessList.querySelectorAll('.multi-service').length;
    if(multiple)return multiple;
    const cards=accessList.querySelectorAll('.service-card').length;
    return cards||1;
  }

  function supportHref(message){
    const source=document.querySelector('.portal-account-panel a.cta[href*="wa.me"], .portal-account-panel a.cta[href*="whatsapp"]');
    if(!source)return '';
    try{
      const url=new URL(source.href,window.location.href);
      url.searchParams.set('text',String(message||'Hola, deseo información sobre esta promoción.'));
      return url.toString();
    }catch(_){
      return source.href||'';
    }
  }

  function categoryButton(panel,iconSource,title,subtitle){
    const button=element('button','portal-category');
    button.type='button';button.role='tab';button.dataset.portalPanel=panel;
    button.setAttribute('aria-controls',`portal-panel-${panel}`);
    button.setAttribute('aria-selected',panel===state.activePanel?'true':'false');
    button.classList.toggle('active',panel===state.activePanel);
    const icon=element('span','portal-category-icon');
    if(String(iconSource||'').startsWith('emoji:')){
      icon.classList.add('is-emoji');icon.textContent=String(iconSource).slice(6);
    }else{
      const iconImage=element('img','portal-category-icon-image');
      iconImage.src=iconSource;iconImage.alt='';iconImage.loading='eager';iconImage.decoding='async';icon.append(iconImage);
    }
    button.append(
      icon,
      element('b','',title),
      element('small','',subtitle)
    );
    button.addEventListener('click',()=>selectPanel(panel));
    return button;
  }

  function panelTitle(iconSource,title,highlight){
    const heading=element('h2','portal-panel-title');
    let icon;
    if(String(iconSource||'').startsWith('emoji:')){icon=element('span','portal-panel-title-icon is-emoji',String(iconSource).slice(6));}
    else{icon=element('img','portal-panel-title-icon');icon.src=iconSource;icon.alt='';icon.loading='lazy';icon.decoding='async';}
    heading.append(icon,document.createTextNode(title));
    if(highlight)heading.append(element('span','',` ${highlight}`));
    return heading;
  }

  function selectPanel(panel,scrollToPanel=true){
    if(panel==='pagos'&&!paymentsVisible())panel='cuentas';
    state.activePanel=panel;
    document.querySelectorAll('[data-portal-panel]').forEach(button=>{
      const selected=button.dataset.portalPanel===panel;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-selected',selected?'true':'false');
    });
    document.querySelectorAll('.portal-panel').forEach(section=>{
      section.hidden=section.dataset.panel!==panel;
    });
    const target=document.getElementById(`portal-panel-${panel}`);
    if(scrollToPanel&&target&&window.matchMedia('(max-width: 620px)').matches){
      target.scrollIntoView({behavior:'smooth',block:'start'});
    }
  }

  function emptyState(title,text){
    const box=element('div','portal-empty');
    box.append(element('b','',title),document.createTextNode(text));
    return box;
  }

  function renderPromotions(){
    const panel=document.getElementById('portal-panel-promociones');
    if(!panel)return;
    const old=panel.querySelector('.portal-promo-grid, .portal-empty');
    if(old)old.remove();
    if(!state.data){
      panel.append(emptyState(state.error?'Promociones no disponibles':'Cargando promociones…',state.error?' Sus cuentas continúan disponibles con normalidad.':' Un momento por favor.'));
      return;
    }
    const promotions=Array.isArray(state.data.promociones)?state.data.promociones:[];
    if(!promotions.length){
      panel.append(emptyState('No hay promociones activas',' Cuando publiquemos una oferta para usted, aparecerá en esta sección.'));
      return;
    }
    const grid=element('div','portal-promo-grid');
    promotions.forEach(promo=>{
      const card=element('article','portal-promo-card');
      const color=safeColor(promo.color);card.style.setProperty('--promo-color',color);
      const visual=element('div','portal-promo-image');
      const imageSrc=safeImage(promo.imagen);
      if(imageSrc){
        const image=element('img');image.src=imageSrc;image.alt=String(promo.titulo||'Promoción');image.loading='lazy';
        image.style.setProperty('--promo-fit',promo.imagenModo==='contain'?'contain':'cover');
        image.style.setProperty('--promo-zoom',String(clampLogoValue(promo.imagenZoom,100,250,100)/100));
        image.style.setProperty('--promo-x',`${clampLogoValue(promo.imagenX,0,100,50)}%`);
        image.style.setProperty('--promo-y',`${clampLogoValue(promo.imagenY,0,100,50)}%`);
        visual.append(image);
      }else visual.textContent='%';
      const body=element('div','portal-promo-body');
      const titleStyle=['clasico','degradado','brillo','deslizante'].includes(String(promo.tituloEstilo||''))?String(promo.tituloEstilo):'clasico';
      const titleWrap=element('div',`portal-promo-title-wrap is-${titleStyle}`);
      const title=element('h3','portal-promo-title',promo.titulo||'Promoción');
      if(titleStyle==='deslizante'){const track=element('div','portal-promo-title-track');track.append(title);titleWrap.append(track);}else titleWrap.append(title);
      body.append(
        element('span','portal-promo-tag',promo.etiqueta||'PROMOCIÓN'),
        titleWrap,
        element('p','',promo.descripcion||'Consulte los detalles de esta oferta con su vendedor.')
      );
      if(promo.precio||promo.precioAnterior){
        const price=element('div','portal-promo-price');
        if(promo.precio)price.append(element('strong','',promo.precio));
        if(promo.precioAnterior)price.append(element('del','',promo.precioAnterior));
        body.append(price);
      }
      if(promo.fechaFin)body.append(element('small','portal-promo-valid',`Disponible hasta ${promo.fechaFin}`));
      const href=supportHref(promo.ctaMensaje);
      if(href){
        const link=element('a','portal-promo-cta',promo.ctaTexto||'Solicitar promoción');
        link.href=href;link.target='_blank';link.rel='noopener';body.append(link);
      }else{
        const button=element('button','portal-promo-cta is-disabled','Consulte a su vendedor');
        button.type='button';button.disabled=true;body.append(button);
      }
      card.append(visual,body);grid.append(card);
    });
    panel.append(grid);
  }

  function paymentLogo(method){
    const logo=element('div','portal-payment-logo');
    const custom=safeImage(method.logoUrl);
    const key=String(method.logoKey||'');
    if(custom){
      const image=element('img');image.src=custom;image.alt=String(method.nombre||'Método de pago');image.loading='lazy';
      image.style.setProperty('--logo-zoom',String(clampLogoValue(method.logoZoom,60,250,100)/100));
      image.style.setProperty('--logo-x',`${clampLogoValue(method.logoX,-50,50,0)}%`);
      image.style.setProperty('--logo-y',`${clampLogoValue(method.logoY,-50,50,0)}%`);
      logo.append(image);
    }else if(LOGO_KEYS.has(key)){
      logo.classList.add('sprite',`logo-${key}`);logo.setAttribute('aria-label',String(method.nombre||'Método de pago'));
    }else{
      logo.textContent=String(method.nombre||'Pago').split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase()||'$';
    }
    return logo;
  }

  function renderPayments(){
    const panel=document.getElementById('portal-panel-pagos');
    if(!panel)return;
    panel.querySelectorAll('.portal-payment-list,.portal-payment-warning,.portal-empty').forEach(node=>node.remove());
    if(!state.data){
      panel.append(emptyState(state.error?'Métodos no disponibles':'Cargando métodos de pago…',state.error?' Consulte los datos directamente con su vendedor.':' Un momento por favor.'));
      return;
    }
    const methods=Array.isArray(state.data.metodosPago)?state.data.metodosPago:[];
    if(!methods.length){
      panel.append(emptyState('Sin métodos publicados',' Consulte con su vendedor la forma de pago disponible.'));
      return;
    }
    const list=element('div','portal-payment-list');
    methods.forEach(method=>{
      const row=element('article','portal-payment');
      const copy=element('div','portal-payment-copy');
      copy.append(
        element('span','portal-payment-name',method.nombre||'Método de pago'),
        element('span','portal-payment-holder',method.titular||'Sublicuentas'),
        element('span','portal-payment-account',method.cuenta||'—')
      );
      if(method.nota)copy.append(element('span','portal-payment-note',method.nota));
      const button=element('button','portal-payment-button','⧉');
      button.type='button';button.title='Copiar número';button.setAttribute('aria-label',`Copiar ${method.cuenta||'número'}`);
      button.addEventListener('click',()=>copyText(method.cuenta));
      row.append(paymentLogo(method),copy,button);list.append(row);
    });
    if(state.data.avisoPago){
      panel.append(element('div','portal-payment-warning',`⚠ ${state.data.avisoPago}`));
    }
    panel.append(list);
  }

  function raffleDate(value){
    if(!value)return 'Fecha por confirmar';
    const date=new Date(value);
    return Number.isNaN(date.getTime())?'Fecha por confirmar':date.toLocaleString('es-HN',{dateStyle:'medium',timeStyle:'short'});
  }

  function raffleCategory(value){
    return {general:'Todos participan',compras:'Compras nuevas',renovaciones:'Renovaciones',oro:'Club Oro'}[value]||'Sorteo especial';
  }

  function rafflePrizeIcon(type){
    return {perfil:'📺',descuento_porcentaje:'％',descuento_fijo:'🏷️',cine:'🎬',recarga:'📱',dias_extra:'🗓️',personalizado:'✨'}[type]||'🎁';
  }

  function raffleStatus(draw){
    if(draw.estado==='finalizado')return 'Resultado publicado';
    if(draw.estado==='cerrado')return 'Participación cerrada';
    return `Cierra ${raffleDate(draw.fechaFin)}`;
  }

  function renderGoldSummary(panel){
    const customer=state.sorteosData?.cliente||{};
    const cycles=Math.max(0,Number(customer.ciclos)||0);
    const isGold=customer.nivel==='oro';
    const summary=element('section',`portal-loyalty ${isGold?'is-gold':''}`);
    const badge=element('span','portal-loyalty-badge',isGold?'★':'♡');
    const copy=element('div','portal-loyalty-copy');
    copy.append(
      element('small','',isGold?'BENEFICIO ACTIVO':'SU CAMINO A CLUB ORO'),
      element('b','',isGold?'Cliente Oro':'Cliente frecuente'),
      element('span','',isGold?'Recibe boletos extra en los sorteos participantes.':`${Math.min(cycles,6)} de 6 ciclos completados`)
    );
    const progress=element('div','portal-loyalty-progress');
    const bar=element('i');bar.style.width=`${isGold?100:Math.min(100,(cycles/6)*100)}%`;progress.append(bar);
    summary.append(badge,copy,progress);panel.append(summary);
  }

  function renderTicketCodes(draw,body){
    const tickets=Array.isArray(draw.boletos)?draw.boletos:[];
    const ticketArea=element('div','portal-raffle-tickets');
    const heading=element('div','portal-raffle-ticket-head');
    heading.append(element('b','',`Mis boletos (${tickets.length})`),element('small','',tickets.length?'Cada número participa de forma individual.':'Compra o renueva para recibir números.'));
    ticketArea.append(heading);
    if(tickets.length){
      const codes=element('div','portal-ticket-codes');
      tickets.slice(0,8).forEach(ticket=>codes.append(element('span','',ticket.codigo||'Boleto')));
      if(tickets.length>8)codes.append(element('span','more',`+${tickets.length-8} más`));
      ticketArea.append(codes);
    }
    body.append(ticketArea);
  }

  function renderPrizeChoices(draw,body){
    const prizes=Array.isArray(draw.premios)?draw.premios:[];
    if(!prizes.length)return;
    const section=element('div','portal-raffle-prizes');
    section.append(element('small','portal-raffle-label','SI GANAS, PODRÁS ELEGIR UNO'));
    const grid=element('div','portal-raffle-prize-grid');
    prizes.forEach(prize=>{
      const item=element('div','portal-raffle-prize');item.style.setProperty('--raffle-prize-color',safeColor(prize.color));
      item.append(element('span','',rafflePrizeIcon(prize.tipo)),element('b','',prize.nombre||'Premio digital'));
      if(prize.descripcion)item.append(element('small','',prize.descripcion));
      grid.append(item);
    });
    section.append(grid);body.append(section);
  }

  function renderWinner(draw,body){
    if(!draw.ganador)return;
    const winner=element('section',`portal-raffle-winner ${draw.ganadorActual?'is-mine':''}`);
    winner.append(element('span','portal-raffle-crown','🏆'));
    const copy=element('div','portal-raffle-winner-copy');
    if(draw.ganadorActual){
      copy.append(element('small','','¡ESTE PREMIO ES TUYO!'),element('b','','¡Felicidades, ganaste!'));
      if(draw.eleccion){
        copy.append(element('span','',`Elegiste: ${draw.eleccion.premioNombre||'Premio digital'}`));
        const reward=draw.eleccion.codigo||draw.eleccion.cupon||'';
        if(reward){
          const code=element('button','portal-raffle-code',reward);code.type='button';code.title='Tocar para copiar';code.addEventListener('click',()=>copyText(reward));copy.append(code);
        }
        if(draw.eleccion.instrucciones)copy.append(element('p','',draw.eleccion.instrucciones));
        copy.append(element('em','',draw.eleccion.estado==='entregado'?'Premio entregado':'Elección confirmada'));
      }else{
        copy.append(element('span','','Escoge la opción digital que más te guste.'));
        const choose=element('button','portal-choose-prize','Elegir mi premio');choose.type='button';choose.addEventListener('click',()=>openPrizeChooser(draw));copy.append(choose);
      }
    }else{
      copy.append(element('small','','GANADOR DEL SORTEO'),element('b','',`${draw.ganador.nombre||'Cliente'} ${draw.ganador.telefono||''}`),element('span','',draw.ganador.codigo||''));
    }
    winner.append(copy);body.append(winner);
  }

  function raffleCard(draw){
    const card=element('article','portal-raffle-card');card.style.setProperty('--raffle-color',safeColor(draw.color));
    const header=element('header','portal-raffle-head');
    const labels=element('div');labels.append(element('span','portal-raffle-tag',raffleCategory(draw.categoria)),element('small','portal-raffle-state',raffleStatus(draw)));
    const count=element('div','portal-raffle-count');count.append(element('b','',String(Number(draw.totalBoletos)||0)),element('small','',Number(draw.totalBoletos)===1?'boleto':'boletos'));
    header.append(labels,count);
    const body=element('div','portal-raffle-body');
    body.append(element('h3','',draw.titulo||'Sorteo especial'),element('p','',draw.descripcion||'Participa automáticamente con tus compras y renovaciones.'));
    renderTicketCodes(draw,body);renderPrizeChoices(draw,body);renderWinner(draw,body);
    if(draw.estado==='cerrado'&&!draw.ganador)body.append(element('div','portal-raffle-wait','🎡 La participación cerró. Muy pronto giraremos la ruleta.'));
    card.append(header,body);return card;
  }

  function renderRaffles(){
    const panel=document.getElementById('portal-panel-sorteos');if(!panel)return;
    panel.querySelectorAll('.portal-loyalty,.portal-raffle-list,.portal-empty').forEach(node=>node.remove());
    if(!state.sorteosData){
      panel.append(emptyState(state.sorteosError?'Sorteos no disponibles':'Cargando sus boletos…',state.sorteosError?' Intente nuevamente más tarde.':' Estamos buscando sus números.'));
      return;
    }
    renderGoldSummary(panel);
    const draws=Array.isArray(state.sorteosData.sorteos)?state.sorteosData.sorteos:[];
    if(!draws.length){panel.append(emptyState('No hay sorteos activos',' Cuando publiquemos el próximo, sus boletos aparecerán aquí automáticamente.'));return;}
    const list=element('div','portal-raffle-list');draws.forEach(draw=>list.append(raffleCard(draw)));panel.append(list);
  }

  function closePrizeChooser(){document.getElementById('portalPrizeChooser')?.remove();}

  function openPrizeChooser(draw){
    closePrizeChooser();
    const modal=element('div','portal-prize-modal');modal.id='portalPrizeChooser';
    const sheet=element('section','portal-prize-sheet');
    const top=element('header');
    const heading=element('div');heading.append(element('small','','PREMIO DEL GANADOR'),element('h3','','Elegir mi premio'));
    const close=element('button','portal-prize-close','×');close.type='button';close.setAttribute('aria-label','Cerrar');close.addEventListener('click',closePrizeChooser);top.append(heading,close);
    sheet.append(top,element('p','portal-prize-intro','Elige una opción. Después de confirmarla, no podrá cambiarse.'));
    const choices=element('div','portal-prize-choices');let selected='';
    const confirmButton=element('button','portal-prize-confirm','Confirmar mi premio');confirmButton.type='button';confirmButton.disabled=true;
    (draw.premios||[]).forEach(prize=>{
      const button=element('button','portal-prize-option');button.type='button';button.dataset.prizeId=prize.id;
      button.append(element('span','',rafflePrizeIcon(prize.tipo)),element('b','',prize.nombre||'Premio digital'),element('small','',prize.descripcion||'Premio disponible para elegir'));
      button.addEventListener('click',()=>{
        selected=prize.id;choices.querySelectorAll('.portal-prize-option').forEach(item=>item.classList.toggle('selected',item===button));confirmButton.disabled=false;
      });choices.append(button);
    });
    const statusLine=element('div','portal-prize-status','');
    confirmButton.addEventListener('click',async()=>{
      const prize=(draw.premios||[]).find(item=>item.id===selected);if(!prize)return;
      if(!window.confirm(`¿Confirmas “${prize.nombre}” como tu premio? Esta elección no se puede cambiar.`))return;
      confirmButton.disabled=true;statusLine.textContent='Confirmando tu premio…';
      try{
        const response=await fetch('/api/sorteos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accion:'elegir_premio',token:tokenFromLocation(),sorteoId:draw.id,premioId:selected})});
        const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'No se pudo guardar la elección.');
        closePrizeChooser();showToast('¡Premio elegido correctamente!');await loadRaffles(true);selectPanel('sorteos',false);
      }catch(error){statusLine.textContent=error.message||'No se pudo confirmar.';confirmButton.disabled=false;}
    });
    sheet.append(choices,statusLine,confirmButton);modal.append(sheet);modal.addEventListener('click',event=>{if(event.target===modal)closePrizeChooser();});document.body.append(modal);
  }

  function enhance(){
    const stage=document.getElementById('stage');
    if(!stage||stage.dataset.portalEnhanced==='1')return;
    const title=stage.querySelector(':scope > .h1');
    const accessList=stage.querySelector(':scope > .access-list');
    if(!title||!accessList)return;
    collapseAccounts(accessList);
    applyAccessIcons(accessList);

    const introNodes=['.live-row','.h1','.hello','.sub'].map(selector=>stage.querySelector(`:scope > ${selector}`)).filter(Boolean);
    const count=serviceCount(accessList);
    state.paymentAllowed=PAYMENT_VENDOR_KEYS.has(normalizeVendor(stage.dataset.portalVendedor));
    stage.dataset.portalEnhanced='1';stage.classList.add('portal-enhanced');document.body.classList.add('portal-ready');

    const brand=element('header','portal-brand');
    const logo=element('img','portal-logo');logo.src='/assets/sublicuentas-logo.png';logo.alt='Sublicuentas';
    const mascotWrap=element('div','portal-mascot-wrap');
    const mascot=element('img','portal-mascot');mascot.alt='Mascota Sublicuentas';mascot.loading='eager';mascot.decoding='async';
    loadMascot(mascot);
    mascotWrap.append(mascot);brand.append(logo,mascotWrap);

    const intro=element('section','portal-existing-intro');intro.append(...introNodes);
    const nav=element('nav','portal-categories');nav.role='tablist';nav.setAttribute('aria-label','Categorías de su portal');
    nav.append(
      categoryButton('cuentas',PORTAL_ICONS.cuentas,'Mis cuentas','Administre sus accesos aquí'),
      categoryButton('promociones',PORTAL_ICONS.promociones,'Promociones','Descubra nuestras ofertas exclusivas'),
      categoryButton('sorteos',PORTAL_ICONS.sorteos,'Sorteos y premios','Vea sus boletos y elija si gana')
    );
    if(state.paymentAllowed){
      nav.append(categoryButton('pagos',PORTAL_ICONS.pagos,'Métodos de pago','Copie la forma de pago que prefiera'));
    }
    nav.classList.toggle('four-categories',state.paymentAllowed);

    const panels=element('main','portal-panels');
    const accounts=element('section','portal-panel portal-account-panel');accounts.id='portal-panel-cuentas';accounts.dataset.panel='cuentas';accounts.role='tabpanel';
    accounts.append(panelTitle(PORTAL_ICONS.cuentas,'Mis cuentas activas',`(${count} acceso${count===1?'':'s'})`),accessList);
    const promos=element('section','portal-panel');promos.id='portal-panel-promociones';promos.dataset.panel='promociones';promos.role='tabpanel';promos.hidden=true;
    promos.append(panelTitle(PORTAL_ICONS.promociones,'Promociones'),element('p','portal-panel-sub','Ofertas seleccionadas especialmente para usted.'));
    const raffles=element('section','portal-panel');raffles.id='portal-panel-sorteos';raffles.dataset.panel='sorteos';raffles.role='tabpanel';raffles.hidden=true;
    raffles.append(panelTitle(PORTAL_ICONS.sorteos,'Sorteos y premios'),element('p','portal-panel-sub','Sus compras, renovaciones y beneficios Oro se convierten en boletos.'));
    const payments=element('section','portal-panel');payments.id='portal-panel-pagos';payments.dataset.panel='pagos';payments.role='tabpanel';payments.hidden=true;
    payments.append(panelTitle(PORTAL_ICONS.pagos,'Métodos de pago'),element('p','portal-panel-sub','Toque el botón de copiar para usar el número exacto.'));
    panels.append(accounts,promos,raffles);
    if(state.paymentAllowed)panels.append(payments);

    stage.replaceChildren(brand,intro,nav,panels);
    state.enhanced=true;syncPaymentVisibility();renderPromotions();renderPayments();renderRaffles();selectPanel('cuentas',false);
  }

  async function loadPortal(){
    const token=tokenFromLocation();
    if(!token){state.error=true;renderPromotions();renderPayments();return;}
    try{
      const response=await fetch(`/api/portal-cliente?token=${encodeURIComponent(token)}&_=${Date.now()}`,{cache:'no-store'});
      const data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.error||'No se pudo cargar el portal.');
      state.data=data;
      if(data.secciones&&typeof data.secciones==='object')state.paymentAllowed=data.secciones.pagos===true;
    }catch(_){state.error=true;}
    syncPaymentVisibility();renderPromotions();renderPayments();
  }

  async function loadRaffles(force=false){
    const token=tokenFromLocation();
    if(!token){state.sorteosError=true;renderRaffles();return;}
    if(force){state.sorteosData=null;state.sorteosError=false;renderRaffles();}
    try{
      const response=await fetch(`/api/sorteos?token=${encodeURIComponent(token)}&_=${Date.now()}`,{cache:'no-store'});
      const data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.error||'No se pudieron cargar los sorteos.');
      state.sorteosData=data;state.sorteosError=false;
    }catch(_){state.sorteosError=true;}
    renderRaffles();
  }

  const stage=document.getElementById('stage');
  if(stage){
    const observer=new MutationObserver(()=>{
      if(stage.dataset.portalEnhanced==='1'){observer.disconnect();return;}
      enhance();
    });
    observer.observe(stage,{childList:true});
    enhance();
  }
  loadPortal();
  loadRaffles();
})();
