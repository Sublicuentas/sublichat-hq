/* COBRO */
let cobroCtx=null;
function openCobro(id,servicio){
  const c=clientes.find(x=>x.id===id);if(!c)return;
  const svcs=Array.isArray(c.servicios)?c.servicios:[];
  const title=document.getElementById('cobroTitle');if(title)title.textContent=etiquetaMensajeRenovacion();
  cobroSub.textContent=nombreCli(c)+' · variedad infinita · 🎲 Otra para más';
  cobroTel=(c.telefono||c.telefono_norm||'').toString().replace(/\D/g,'');
  cobroWa.style.opacity=cobroTel?'1':'.5'; cobroWa.style.pointerEvents=cobroTel?'auto':'none';
  const seg=document.getElementById('cobroSeg');
  let html='';
  const multi = svcs.length>1 && servicio==='';
  if(svcs.length>1){
    html+=`<div class="seg service-seg" style="margin-bottom:10px">`;
    if(servicio===''){ html+=`<button class="on" onclick='fillCobroAll("${id}",this)'>📋 Todos</button>`; }
    html+=svcs.map((s,i)=>{const n=pick(s,CONFIG.campos.servicio)||('Servicio '+(i+1));
      const on=(servicio!==''&&i===0)?'on':'';
      return `<button class="${on}" onclick='fillCobro("${id}","${enc(n)}",this)'>${n}</button>`}).join('');
    html+=`</div>`;
  }
  html+=`<div class="seg variant-seg" style="margin-bottom:12px">
    ${['amable','hoy','vencido','ultimo','gracias'].map((v,i)=>`<button class="${i===0?'on':''}" onclick="setCobroVariante('${v}',this)">${({amable:'Amable',hoy:'Hoy vence',vencido:'Vencido',ultimo:'Último aviso',gracias:'Gracias'})[v]}</button>`).join('')}
  </div>`;
  seg.innerHTML=html;
  if(multi) fillCobroAll(id);
  else fillCobro(id,servicio||(pick(svcs[0]||{},CONFIG.campos.servicio)||''));
  cobroOverlay.classList.add('show');
}
function openCobroGrupo(id,servicioIndices=[]){
  const c=clientes.find(x=>x.id===id);if(!c)return;
  const wanted=new Set((servicioIndices||[]).map(Number));
  const svcs=(Array.isArray(c.servicios)?c.servicios:[]).filter((s,i)=>{
    const original=Number(s?.servicioIndexOriginal??s?._servicioIndexOriginal??i);
    return wanted.has(Number.isInteger(original)?original:i);
  });
  if(!svcs.length)return openCobro(id,'');
  const title=document.getElementById('cobroTitle');if(title)title.textContent=etiquetaMensajeRenovacion();
  cobroSub.textContent=nombreCli(c)+(svcs.length>1?` · ${svcs.length} servicios juntos`:` · ${pick(svcs[0],CONFIG.campos.servicio)||'Servicio'}`);
  cobroTel=(c.telefono||c.telefono_norm||'').toString().replace(/\D/g,'');
  cobroWa.style.opacity=cobroTel?'1':'.5';cobroWa.style.pointerEvents=cobroTel?'auto':'none';
  const seg=document.getElementById('cobroSeg');
  seg.innerHTML=`<div class="seg variant-seg" style="margin-bottom:12px">${['amable','hoy','vencido','ultimo','gracias'].map((v,i)=>`<button class="${i===0?'on':''}" onclick="setCobroVariante('${v}',this)">${({amable:'Amable',hoy:'Hoy vence',vencido:'Vencido',ultimo:'Último aviso',gracias:'Gracias'})[v]}</button>`).join('')}</div>`;
  const list=svcs.map((s,i)=>{const f=parseFecha(pick(s,CONFIG.campos.vencimiento));return {nm:pick(s,CONFIG.campos.servicio)||('Servicio '+(i+1)),fecha:f,dias:dias(f),precio:precioServicio(s)};});
  if(list.length===1)cobroCtx={id,cliente:c,servicio:list[0].nm,fecha:list[0].fecha,dias:list[0].dias,precio:list[0].precio};
  else cobroCtx={id,cliente:c,multi:list};
  setCobroVariante('amable');
  cobroOverlay.classList.add('show');
}
function fillCobroAll(id,btn){
  if(btn&&btn.closest('.service-seg')){btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('on'));btn.classList.add('on')}
  const c=clientes.find(x=>x.id===id);const svcs=Array.isArray(c?.servicios)?c.servicios:[];
  const list=svcs.map((s,i)=>{const f=parseFecha(pick(s,CONFIG.campos.vencimiento));
    return {nm:pick(s,CONFIG.campos.servicio)||('Servicio '+(i+1)),fecha:f,dias:dias(f),precio:precioServicio(s)};});
  cobroCtx={id,cliente:c,multi:list};
  setCobroVariante('amable');
}
function fillCobro(id,servicio,btn){
  if(btn&&btn.closest('.service-seg')){btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('on'));btn.classList.add('on')}
  const c=clientes.find(x=>x.id===id);const svcs=Array.isArray(c?.servicios)?c.servicios:[];
  const svc=svcs.find(s=>(pick(s,CONFIG.campos.servicio)||'')===servicio)||svcs[0]||{};
  const nm=pick(svc,CONFIG.campos.servicio)||servicio||'su servicio';
  const f=parseFecha(pick(svc,CONFIG.campos.vencimiento)),dr=dias(f);
  cobroCtx={id,cliente:c,servicio:nm,fecha:f,dias:dr,precio:precioServicio(svc)};
  setCobroVariante('amable');
}
let cobroTipo='amable';
function pickRnd(a){return a[Math.floor(Math.random()*a.length)]}
const bold=s=>'*'+s+'*';
function cobroMsg(tipo='amable'){
  cobroTipo=tipo;
  const c=cobroCtx?.cliente||{};
  const N=bold(nombreCli(c));

  const SALUDO=[
    `Hola ${N} 👋`,`Buen día ${N} ☀️`,`¿Qué tal, ${N}? 😊`,`Hola ${N}, ¿cómo está? 🙌`,
    `Saludos ${N} ✨`,`Buenas ${N} 👋`,`Hola ${N} 🎬`,`¡Hola ${N}! 📺`,
    `Hola de nuevo ${N} 💬`,`Que tenga buen día, ${N} 🌟`,`Hola ${N} 🤝`,`Buen día ${N} 🔔`,
    `Hola ${N} 🍿`,`¡Buenas ${N}! 🎉`,`Hola ${N}, espero esté bien 😊`,
  ];
  const CIERRE=[
    `Quedo atento para ayudarle 🙌`,`Estoy para servirle 🤝`,`Cualquier cosa, aquí estoy 💬`,
    `Avíseme y lo dejamos al día ✅`,`Con gusto le ayudo cuando guste 😊`,`Estoy pendiente de su mensaje 📲`,
    `Gracias por su preferencia 🙏`,`Aquí estoy para lo que necesite 🤝`,`Quedo a la orden 🙌`,
    `Escríbame cuando guste ✨`,`Será un gusto seguir atendiéndole 🌟`,`Mil gracias por su confianza 🙏`,
  ];

  /* ── Mensaje UNIFICADO: cliente con varios servicios ── */
  if(cobroCtx?.multi && cobroCtx.multi.length>1){
    const list=cobroCtx.multi;
    const lineaServicio=(s)=>{
      const F=bold(fmtFecha(s.fecha)); const d=s.dias; let est;
      if(s.fecha==null) est=`sin fecha registrada`;
      else if(d<0) est=`venció el ${F} 🔴`;
      else if(d===0) est=`vence ${bold('hoy')} (${F}) 🟠`;
      else if(d<=5) est=`vence el ${F} (en ${d}d) 🟡`;
      else est=`vence el ${F} 🟢`;
      const m=s.precio>0?` — ${bold(money(s.precio))}`:'';
      return `• ${bold(s.nm)}: ${est}${m}`;
    };
    const lineas=list.map(lineaServicio).join('\n');
    const total=list.reduce((a,s)=>a+(s.precio||0),0);
    const totalLn=total>0?`\n\n💵 Total a renovar: ${bold(money(total))}`:'';
    const INTRO={
      amable:[
        `Le recuerdo con tiempo las fechas de renovación de sus servicios 📅:`,
        `Pasando a recordarle el detalle de sus servicios y sus vencimientos 🗓️:`,
        `Aquí el resumen de sus servicios para que no se le pase ninguna fecha ✅:`,
        `Le comparto el estado de sus servicios con nosotros 📋:`,
      ],
      hoy:[
        `Le aviso que tiene servicios que se renuevan hoy ⚡. Este es el detalle:`,
        `Hoy toca revisar sus renovaciones 📅. Aquí el resumen de sus servicios:`,
        `Recordatorio del día: estos son sus servicios y sus fechas ⏰:`,
      ],
      vencido:[
        `Noté que tiene servicios pendientes de renovación 🚨. Este es el detalle:`,
        `Le comparto el estado de sus servicios; algunos ya vencieron ⏳:`,
        `Revisando su cuenta, estos son los servicios por reactivar 🔄:`,
      ],
      ultimo:[
        `${bold('Último aviso')} ⚠️ sobre la renovación de sus servicios. Detalle:`,
        `Este es el ${bold('recordatorio final')} de sus servicios pendientes ⏳:`,
        `Para no suspender el acceso, le dejo el detalle de sus servicios 🔕:`,
      ],
      gracias:[
        `¡Gracias por renovar! 🎉 Sus servicios quedaron al día ✅:`,
        `Todo en orden ✅ Aquí el resumen de sus servicios activos 🙌:`,
        `¡Listo! Sus servicios siguen activos. Gracias por su confianza 🙏:`,
      ],
    };
    const intro=pickRnd(INTRO[tipo]||INTRO.amable);
    return `${pickRnd(SALUDO)}\n\n${intro}\n\n${lineas}${totalLn}\n\n${pickRnd(CIERRE)}`;
  }

  /* ── Mensaje individual (un solo servicio) ── */
  const nm=cobroCtx?.servicio||'su servicio';
  const fecha=fmtFecha(cobroCtx?.fecha), precio=cobroCtx?.precio||0;
  const S=bold(nm), F=bold(fecha), M=precio>0?bold(money(precio)):'';
  const monto = M?` La renovación queda en ${M} 💵.`:'';

  const CORE={
    amable:[
      `Le recuerdo con tiempo que su servicio de ${S} se renueva el ${F} 📅.${monto}`,
      `Solo un recordatorio amable: su ${S} vence el ${F} ⏳.${monto} Cuando guste lo dejamos activo.`,
      `Su ${S} está por renovarse (vence el ${F}) 🔔.${monto} Si desea continuar, con gusto le ayudo.`,
      `Pasando a avisarle que su ${S} llega a su fecha el ${F} 📆.${monto}`,
      `Su ${S} sigue activo hasta el ${F} ✅.${monto} Para no perder el acceso, puede renovar cuando guste.`,
      `Le aviso con anticipación: su ${S} se vence el ${F} 🗓️.${monto} Así no se queda sin servicio.`,
    ],
    hoy:[
      `Su servicio de ${S} vence ${bold('hoy')} ⚡ (${F}).${monto} Para mantenerlo sin cortes, puede renovar enseguida.`,
      `${bold('Hoy')} es el día de renovación de su ${S} 📅.${monto} Avíseme y lo dejo activo al toque ⚡`,
      `Le recuerdo que ${S} se renueva ${bold('hoy')} 🔔.${monto} Así no pierde el acceso 👌`,
      `Hoy toca renovar su ${S} 🎬.${monto} Cuando guste lo activamos sin demora 🚀`,
      `¡Atención! Su ${S} vence ${bold('hoy')} mismo ⏰.${monto} Renovando ahora sigue viendo todo sin interrupción.`,
    ],
    vencido:[
      `Su ${S} aparece ${bold('vencido')} desde el ${F} 🚨.${monto} No se preocupe, lo reactivo apenas confirme.`,
      `Noté que su ${S} quedó ${bold('vencido')} (${F}) ⏳.${monto} Si desea seguir disfrutándolo, lo reactivo hoy mismo 🔄`,
      `Su servicio de ${S} ya está ${bold('vencido')} 🛑.${monto} Para reactivarlo solo me avisa 🙌`,
      `¡Ojo! Su ${S} venció el ${F} 📵.${monto} Lo dejamos al día en cuanto guste 🚀`,
      `Su ${S} se desactivó el ${F} 😕.${monto} Reactivarlo toma un momento, avíseme y lo resolvemos 🔧`,
    ],
    ultimo:[
      `${bold('Último aviso')} ⚠️ Su ${S} está pendiente de renovación (venció el ${F}).${monto} Para no suspender el acceso, hoy es buen momento.`,
      `Este es el ${bold('último recordatorio')} por su ${S} ⏳.${monto} Si no se renueva, el acceso se suspende. Lo resolvemos enseguida 🙏`,
      `Para no dejarlo pasar: su ${S} está por suspenderse 🔕.${monto} Si desea conservarlo, renueve hoy 🙌`,
      `No quiero que pierda su ${S} 😟 Es el aviso final antes del corte (${F}).${monto}`,
      `${bold('Importante')} ⚠️ Su ${S} se cancela si no renueva pronto.${monto} ¿Lo dejamos activo hoy? 🤝`,
    ],
    gracias:[
      `¡Gracias por renovar su ${S}! 🎉 Quedó activo y al día ✅.`,
      `Listo ✅ Su ${S} quedó renovado. ¡Gracias por su confianza! 🙌`,
      `Su ${S} ya está activo nuevamente 🎬 Gracias por preferirnos 🙏`,
      `¡Renovación confirmada! 🥳 Su ${S} quedó al día. Que lo disfrute muchísimo 🍿`,
      `Todo en orden ${N} ✅ Su ${S} sigue activo. ¡Gracias por seguir con nosotros! 💚`,
    ],
  };
  const core=pickRnd(CORE[tipo]||CORE.amable);
  return `${pickRnd(SALUDO)}\n\n${core}\n\n${pickRnd(CIERRE)}`;
}
function otraVariante(ev){
  if(!cobroCtx)return;
  cobroText.value=cobroMsg(cobroTipo);
  if(ev&&ev.target){const b=ev.target,o=b.textContent;b.textContent='🎲…';setTimeout(()=>b.textContent=o,400)}
}
function setCobroVariante(tipo,btn){
  if(btn&&btn.closest('.variant-seg')){btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('on'));btn.classList.add('on')}
  cobroText.value=cobroMsg(tipo);
}
/* ====== IA (Gemini/Claude vía backend /rev/ask) ====== */
let aiLastError='';
async function askGemini(prompt, fallback=''){
  aiLastError='';
  const paths=[CONFIG.aiPath,...(CONFIG.aiFallbackPaths||[])].filter((v,i,a)=>v&&a.indexOf(v)===i);
  for(const p of paths){
    try{
      const r=await API.call(p,{method:'POST',body:JSON.stringify({prompt})});
      if(r&&r.text&&r.text.trim()) return r.text.trim();
    }catch(e){
      if(e&&e.code==='auth'){location.reload();return fallback}
      aiLastError=(e&&(e.detail||e.error||e.message))||'sin_conexion';
      /* probar siguiente ruta */
    }
  }
  return fallback;
}
async function generateCobroIA(ev){
  if(!cobroCtx)return;
  const btn=ev.target,old=btn.textContent;btn.textContent='Pensando…';btn.disabled=true;
  let prompt;
  if(cobroCtx.multi && cobroCtx.multi.length>1){
    const detalle=cobroCtx.multi.map(s=>`- ${s.nm} (vence ${fmtFecha(s.fecha)})`).join('\n');
    prompt=`Escribí UN SOLO mensaje de WhatsApp de cobro para el cliente "${nombreCli(cobroCtx.cliente)}", que tiene varios servicios con estas fechas de renovación:\n${detalle}\nReglas: un único mensaje que mencione todos los servicios juntos (no uno por servicio), trato de usted, tono cálido y profesional hondureño, podés listar los servicios con viñetas, sin poner precios, con 1 o 2 emojis. Devolvé SOLO el mensaje, sin explicaciones.`;
  }else{
    prompt=`Escribí un mensaje de WhatsApp de cobro para el cliente "${nombreCli(cobroCtx.cliente)}", por el servicio "${cobroCtx.servicio}" con vencimiento ${fmtFecha(cobroCtx.fecha)}. Reglas: trato de usted, tono cálido y profesional hondureño, máximo 4 líneas, sin poner precio, con 1 o 2 emojis. Devolvé SOLO el mensaje, sin explicaciones.`;
  }
  const out=await askGemini(prompt,'');
  if(out) cobroText.value=out;
  else alert('La IA no respondió.\n\nDetalle: '+(aiLastError||'sin respuesta')+'\n\nRevisá la llave GEMINI_API_KEY en Render.');
  btn.textContent=old;btn.disabled=false;
}
function sendWa(){const u=waUrl(cobroTel,cobroText.value);if(u)window.open(u,'_blank','noopener,noreferrer')}
function copyCobro(ev){navigator.clipboard?.writeText(cobroText.value);const b=ev.target,o=b.textContent;b.textContent='¡Copiado!';setTimeout(()=>b.textContent=o,1200)}
function closeCobro(){cobroOverlay.classList.remove('show')}

/* ── Comprobante de renovación (sube foto + puede renovar fecha) ── */
let compCtx=null, compImg='', compDestino='sublicuentas';
function dateInputValue(d){if(!d)return'';const x=new Date(d);x.setHours(12,0,0,0);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')}
function addMeses(d,m){const x=new Date(d||Date.now());x.setHours(12,0,0,0);const day=x.getDate();x.setMonth(x.getMonth()+m);if(x.getDate()!==day)x.setDate(0);return x}
function baseCompFecha(){return (compCtx&&compCtx.fecha&&dias(compCtx.fecha)>0)?compCtx.fecha:new Date()}
function setCompMeses(m){const inp=document.getElementById('compNuevaFecha');if(!inp)return;inp.value=dateInputValue(addMeses(baseCompFecha(),m));const info=document.getElementById('compFechaInfo');if(info)info.textContent='Se renovará hasta '+fmtFecha(parseFecha(inp.value))+'. También puede cambiar la fecha manualmente.'}
function clearCompFecha(){const inp=document.getElementById('compNuevaFecha');if(inp)inp.value='';const info=document.getElementById('compFechaInfo');if(info)info.textContent='Solo se guardará el comprobante; no se modificará la fecha del cliente.'}
function setCompDestino(d){const v=String(d||'').toLowerCase();compDestino=['sublicuentas','relojes','geisell'].includes(v)?v:'sublicuentas';document.querySelectorAll('#compDestinoSeg button').forEach(b=>b.classList.toggle('on',b.dataset.dest===compDestino))}
function openComprobante(id,servicio,servicioIndex){
  const c=clientes.find(x=>x.id===id); if(!c)return;
  const svcs=Array.isArray(c.servicios)?c.servicios:[];
  const originalIndex=s=>{const n=Number(s?.servicioIndexOriginal??s?._servicioIndexOriginal);return Number.isInteger(n)?n:-1};
  let ix=svcs.findIndex(s=>originalIndex(s)===Number(servicioIndex));
  if(ix<0) ix=svcs.findIndex(s=>(pick(s,CONFIG.campos.servicio)||'')===servicio);
  if(ix<0)ix=0;
  const svc=svcs[ix]||{};
  const idxOriginal=originalIndex(svc)>=0?originalIndex(svc):ix;
  const nm=pick(svc,CONFIG.campos.servicio)||servicio||'Servicio';
  const f=parseFecha(pick(svc,CONFIG.campos.vencimiento));
  compCtx={id, cliente:nombreCli(c), servicio:nm, servicioIndex:idxOriginal, compraId:String(svc.compraId||''), fecha:f, servicios:svcs.map((s,i)=>({servicioIndex:originalIndex(s)>=0?originalIndex(s):i,compraId:String(s.compraId||''),servicio:pick(s,CONFIG.campos.servicio)||`Servicio ${i+1}`,fecha:parseFecha(pick(s,CONFIG.campos.vencimiento))}))};
  compImg=''; compDestino='sublicuentas';
  document.getElementById('compSub').textContent=compCtx.cliente+' · '+compCtx.servicio;
  setCompDestino('sublicuentas');
  const sel=document.getElementById('compServices');
  sel.innerHTML=`<div class="multi-renew-head"><b>¿Qué servicios renovó?</b><button type="button" onclick="toggleAllCompServices(this)">Seleccionar todos</button></div>${compCtx.servicios.map(s=>`<label class="multi-service ${s.servicioIndex===idxOriginal?'on':''}"><input type="checkbox" value="${Number(s.servicioIndex)}" ${s.servicioIndex===idxOriginal?'checked':''} onchange="this.parentElement.classList.toggle('on',this.checked)"><span><b>${escHtml(s.servicio)}</b><small>${s.fecha?'Vence '+fmtFecha(s.fecha):'Sin fecha'}</small></span></label>`).join('')}`;
  ['compQuien','compCom','compMonto','compFile','compNuevaFecha'].forEach(k=>{const e=document.getElementById(k);if(e)e.value=''});
  const prev=document.getElementById('compPrev'), ph=document.getElementById('compPh');
  prev.style.display='none'; prev.src=''; ph.style.display='flex';
  const info=document.getElementById('compFechaInfo');
  if(info)info.textContent=f?`Fecha actual: ${fmtFecha(f)}. Elija +1m/+3m o ponga una fecha manual.`:'Sin fecha actual. Ponga la nueva fecha si desea renovar.';
  document.getElementById('compMsg').textContent='';
  document.getElementById('compOverlay').classList.add('show');
}
function openComprobanteGrupo(id,servicioIndices=[]){
  const c=clientes.find(x=>x.id===id);if(!c)return;
  const svcs=Array.isArray(c.servicios)?c.servicios:[];
  const wanted=new Set((servicioIndices||[]).map(Number));
  const first=svcs.find((s,i)=>{const original=Number(s?.servicioIndexOriginal??s?._servicioIndexOriginal??i);return wanted.has(Number.isInteger(original)?original:i);});
  const firstIx=first?Number(first.servicioIndexOriginal??first._servicioIndexOriginal??svcs.indexOf(first)):0;
  const firstName=first?(pick(first,CONFIG.campos.servicio)||'Servicio'):'Servicio';
  openComprobante(id,firstName,firstIx);
  document.querySelectorAll('#compServices input[type=checkbox]').forEach(ch=>{
    ch.checked=wanted.has(Number(ch.value));
    ch.parentElement.classList.toggle('on',ch.checked);
  });
  const chosen=selectedCompServices();
  const sub=document.getElementById('compSub');
  if(sub)sub.textContent=`${nombreCli(c)} · ${chosen.length} servicio${chosen.length===1?'':'s'} seleccionado${chosen.length===1?'':'s'}`;
}
function toggleAllCompServices(btn){const checks=[...document.querySelectorAll('#compServices input[type=checkbox]')],all=checks.every(x=>x.checked);checks.forEach(x=>{x.checked=!all;x.parentElement.classList.toggle('on',!all)});btn.textContent=all?'Seleccionar todos':'Quitar todos'}
function selectedCompServices(){return [...document.querySelectorAll('#compServices input[type=checkbox]:checked')].map(x=>compCtx.servicios.find(s=>s.servicioIndex===Number(x.value))).filter(Boolean)}
function closeComprobante(){document.getElementById('compOverlay').classList.remove('show')}
function compressImage(file,maxDim,q){
  return new Promise((resolve,reject)=>{
    const img=new Image(), url=URL.createObjectURL(file);
    img.onload=()=>{ let w=img.width,h=img.height;
      const sc=Math.min(1,maxDim/Math.max(w,h)); w=Math.round(w*sc); h=Math.round(h*sc);
      const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
      cv.getContext('2d').drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url); resolve(cv.toDataURL('image/jpeg',q));
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('img'))};
    img.src=url;
  });
}
async function pickComprobante(input){
  const f=input.files&&input.files[0]; if(!f)return;
  const msg=document.getElementById('compMsg'); msg.style.color='#6E8299'; msg.textContent='Procesando foto…';
  try{
    compImg=await compressImage(f,1280,0.7);
    const prev=document.getElementById('compPrev'), ph=document.getElementById('compPh');
    prev.src=compImg; prev.style.display='block'; ph.style.display='none'; msg.textContent='';
  }catch(e){ msg.style.color='#e54848'; msg.textContent='No pude leer la foto.'; }
}
async function refreshClientesPostRenew(){
  try{
    const data=await API.call('/rev/clientes');
    clientes=Array.isArray(data)?data:[];writeSocioCache('clientes',clientes);
    if(current==='renovar')renderRen();
    else if(current==='clientes')renderCli();
    else if(current==='inicio')vInicio();
  }catch(e){}
}
async function enviarComprobante(){
  const msg=document.getElementById('compMsg');
  const nuevaFecha=(document.getElementById('compNuevaFecha')?.value||'').trim();
  const servicios=selectedCompServices();
  if(!servicios.length){msg.style.color='#e54848';msg.textContent='Seleccione al menos un servicio.';return}
  if(!compImg && !nuevaFecha){ msg.style.color='#e54848'; msg.textContent='Suba una foto o elija nueva fecha para renovar.'; return }
  const btn=document.getElementById('compBtn'); btn.disabled=true; btn.textContent='Guardando…';
  try{
    const res=await API.call('/rev/renovacion',{method:'POST',body:JSON.stringify({
      clienteId:compCtx.id, cliente:compCtx.cliente, servicio:compCtx.servicio, servicioIndex:compCtx.servicioIndex,
      compraId:compCtx.compraId||'',
      servicios:servicios.map(s=>({servicioIndex:s.servicioIndex,compraId:s.compraId||'',servicio:s.servicio})),
      comentario:document.getElementById('compCom').value.trim(),
      quien:document.getElementById('compQuien').value.trim(),
      monto:document.getElementById('compMonto').value||0,
      destino:compDestino,
      nuevaFecha,
      imagen:compImg
    })});
    msg.style.color='#1aa15a'; msg.textContent=res.renovado?(`✅ ${res.renovadosCantidad||servicios.length} servicio(s) renovado(s) hasta ${fmtFecha(parseFecha(res.nuevaFecha))}. Enviado a ${res.destinoLabel|| ({relojes:'Relojes',geisell:'Geisell',sublicuentas:'Sublicuentas'}[compDestino]||'Sublicuentas')}.`): `✅ Comprobante guardado y enviado a ${res.destinoLabel|| ({relojes:'Relojes',geisell:'Geisell',sublicuentas:'Sublicuentas'}[compDestino]||'Sublicuentas')}.`;
    if(res.renovado) await refreshClientesPostRenew();
    setTimeout(closeComprobante,1100);
  }catch(e){
    msg.style.color='#e54848';
    const map={imagen_muy_grande:'La foto pesa mucho, probá otra.',servicio_no_existe:'No encontré ese servicio del cliente.',servicio_no_permitido:'Esa cuenta no pertenece a este socio.',cliente_no_permitido:'Ese cliente no pertenece a este socio.',fecha_invalida:'La fecha no es válida.',sin_permiso_renovar:'Su usuario no tiene permiso para registrar renovaciones.',destino_invalido:'El destinatario seleccionado no es válido.',destino_sin_configurar:'Ese destinatario no tiene Telegram configurado. No se envió a otra persona.',renovacion_no_confirmada:'La renovación no quedó confirmada en la ficha; no se registró como completada.'};
    msg.textContent=map[e&&e.error]||('No se pudo guardar. '+((e&&e.detail)||(e&&e.error)||'Reintentá.'));
  }finally{ btn.disabled=false; btn.textContent='Guardar'; }
}

/* logos + auto-login */
document.getElementById('loginLogo').src=ROBOT_IMG;
(function(){
  const S=['¡Hola! 👋','¡Qué onda! 🤙','¡Buenas! 😎','¡Hey! 🙌','¡Bienvenido! ✨','¡Saludos! 🫡',
    '¡Qué tal! 😃','¡Arriba! 🚀','¡Hola hola! 👋','¡Listos! 💪','¡A darle! 🔥','¡Buen día! ☀️',
    '¡Qué gusto! 😄','¡Pura vida! 🌟','¡Vamos! ⚡'];
  const i=Math.floor(Date.now()/864e5)%S.length;
  const el=document.getElementById('loginBubble'); if(el) el.textContent=S[i];
})();
document.getElementById('brandLogo').src=LOGO;
document.getElementById('introRobot').src=ROBOT_IMG;


/* ===== PWA + ESTADO DE CONEXIÓN ===== */
let deferredInstallPrompt=null,netHideTimer=null;
async function enablePartnerNotifications(){
  if(typeof Notification==='undefined')return alert('Este dispositivo no admite notificaciones web.');
  try{
    const permission=await Notification.requestPermission();
    if(permission==='granted'){
      await showPartnerNotification('Sublicuentas','Notificaciones activadas. Le avisaremos de cambios importantes mientras la app pueda recibirlos.');
      if(current==='perfil')vPerfil();
    }else alert('Las notificaciones no quedaron autorizadas en este dispositivo.');
  }catch(_){alert('No se pudieron activar las notificaciones en este dispositivo.')}
}
async function showPartnerNotification(title,body){
  if(typeof Notification==='undefined'||Notification.permission!=='granted')return;
  try{
    if('serviceWorker' in navigator){
      const reg=await navigator.serviceWorker.ready;
      if(reg?.showNotification)return reg.showNotification(title,{body,icon:'./assets/icon-192.png',badge:'./assets/icon-192.png',tag:'sublicuentas-socio',renotify:true});
    }
    new Notification(title,{body,icon:'./assets/icon-192.png'});
  }catch(_){}
}
function notifyPartnerAvisos(rows=[]){
  if(typeof Notification==='undefined'||Notification.permission!=='granted')return;
  const relevantes=rows.filter(a=>['pedido_estado','promocion','aviso'].includes(String(a.tipo||'aviso')));
  if(!relevantes.length)return;
  const a=relevantes[0];
  showPartnerNotification(a.tipo==='pedido_estado'?'Actualización de pedido':'Sublicuentas',String(a.texto||'Tiene una novedad en su panel.').slice(0,180));
}

function setNetworkStatus(online,announce=true){
  const el=document.getElementById('netStatus');if(!el)return;
  clearTimeout(netHideTimer);
  el.className='net-status show '+(online?'online':'offline');
  el.textContent=online?'✅ Conexión restablecida':'📡 Sin conexión · mostrando datos disponibles';
  if(online&&announce)netHideTimer=setTimeout(()=>el.classList.remove('show'),2200);
}
window.addEventListener('offline',()=>setNetworkStatus(false,false));
window.addEventListener('online',()=>{setNetworkStatus(true,true);if(API.token){loadClientes();loadPrecios();loadMetricas();loadInventario();if(!socioSinCompras())loadMisCompras()}});
if(typeof navigator!=='undefined'&&!navigator.onLine)setNetworkStatus(false,false);
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();deferredInstallPrompt=e;
  document.getElementById('installAppBtn')?.classList.remove('hide');
});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;document.getElementById('installAppBtn')?.classList.add('hide')});
async function installPwa(){
  if(!deferredInstallPrompt)return;
  deferredInstallPrompt.prompt();
  try{await deferredInstallPrompt.userChoice}catch(_){}
  deferredInstallPrompt=null;document.getElementById('installAppBtn')?.classList.add('hide');
}
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
}

/* ===== INTRO ===== */
let introDone=false;
function closeIntro(){
  if(introDone)return; introDone=true;
  const v=document.getElementById('introVid');
  try{v.pause()}catch(e){}
  const ov=document.getElementById('intro');
  ov.classList.add('out');
  setTimeout(()=>ov.remove(),550);
}
function startIntro(){
  const ov=document.getElementById('intro');
  if(!ov)return;
  let seen=false;try{seen=sessionStorage.getItem('socios_intro_seen')==='1'}catch(_){}
  if(API.token||seen){introDone=true;ov.remove();return}
  try{sessionStorage.setItem('socios_intro_seen','1')}catch(_){}
  const vid=document.getElementById('introVid');
  const brand=document.getElementById('introBrand');
  // La marca acompaña el arranque, pero nunca bloquea el panel más de 1.4 s.
  const ms=Math.min(CONFIG.introDuracion||900,1400);
  if(CONFIG.introVideo){
    brand.classList.add('hide');
    vid.classList.remove('hide');
    vid.src=CONFIG.introVideo;
    let t=setTimeout(closeIntro,5000); // nunca pasar de 5s
    vid.addEventListener('ended',()=>{clearTimeout(t);closeIntro()});
    vid.addEventListener('error',()=>{clearTimeout(t);
      vid.classList.add('hide'); brand.classList.remove('hide'); setTimeout(closeIntro,ms);});
    const p=vid.play();
    if(p&&p.catch)p.catch(()=>{clearTimeout(t);
      vid.classList.add('hide'); brand.classList.remove('hide'); setTimeout(closeIntro,ms);});
  }else{
    setTimeout(closeIntro,ms);
  }
}
startIntro();

/* ── Sesión: persiste hasta cerrar usuario o 30 días de inactividad ── */
const IDLE_MS=30*24*60*60*1000; // 30 días: solo vuelve a pedir clave al vencer sesión o cerrar usuario
// Los navegadores limitan setTimeout a ~24.8 días. Si se manda directamente
// 30 días, algunos lo convierten en 1 ms y cierran la sesión apenas entra.
const MAX_TIMEOUT_MS=2147483000;
let idleTimer=null;
function expireIdle(){ if(API.token){ API.clear(); st('del','rev_admin'); st('del','rev_last'); location.reload(); } }
function resetIdle(){
  clearTimeout(idleTimer);
  if(!API.token)return;
  const last=+(st('get','rev_last')||Date.now());
  const remaining=IDLE_MS-(Date.now()-last);
  if(remaining<=0){expireIdle();return}
  // Al llegar al máximo permitido se vuelve a calcular lo que falta; de esta
  // forma la sesión sí dura 30 días sin desbordar el temporizador del navegador.
  idleTimer=setTimeout(resetIdle,Math.min(remaining,MAX_TIMEOUT_MS));
}
function touchActivity(){ if(API.token){ st('set','rev_last',String(Date.now())); resetIdle(); } }
['click','keydown','touchstart','scroll','mousemove'].forEach(ev=>window.addEventListener(ev,touchActivity,{passive:true}));

function resumeSession(){
  if(!API.token)return;
  const last=+(st('get','rev_last')||0);
  if(last && Date.now()-last>IDLE_MS){ API.clear(); st('del','rev_admin'); st('del','rev_last'); return; } // vencida por inactividad
  if(st('get','rev_admin')==='1'){ isAdmin=true; adminToken=API.token; enterAdmin(); }
  else { try{rev=JSON.parse(st('get','rev_data'))}catch(e){}; if(rev)enterApp(); }
  touchActivity();
}
// El script está al final del body: no esperamos imágenes ni fuentes para abrir la sesión.
resumeSession();
