(function controlMaestroSublicuentas(){
  'use strict';

  const API='/api/importar';
  const BUILD='CONTROL-MAESTRO-20260804-1';
  const state={
    booted:false,installed:false,loading:false,busy:false,status:'',statusType:'',meta:null,
    templateBase64:'',analysis:null,filter:'revision',query:'',visible:[],autoTried:false
  };

  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=(v)=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9@.+\s_-]/g,' ').replace(/\s+/g,' ').trim();
  const phone=(v)=>String(v??'').replace(/\D/g,'').replace(/^504(?=\d{8}$)/,'').slice(-8);
  const email=(v)=>String(v??'').trim().toLowerCase();
  const fileDate=()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const serverDateKey=()=>{
    try{
      const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Tegucigalpa',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
      const get=(type)=>parts.find(x=>x.type===type)?.value||'';
      return `${get('year')}-${get('month')}-${get('day')}`;
    }catch(_){return new Date().toISOString().slice(0,10);}
  };
  const root=()=>document.getElementById('rbac-control-cuentas');
  const screenActive=()=>!!document.getElementById('screen-control-cuentas')?.classList.contains('active');
  const activeUser=()=>{
    for(const k of ['sublichat_user','subli_usuario','usuario','subli_user','active_user']){
      const v=localStorage.getItem(k);if(v&&String(v).trim())return norm(v);
    }
    return '';
  };
  const isAdmin=()=>['sublicuentas','naara'].includes(activeUser());

  function source(){
    try{
      const x=typeof window.sublichatControlData==='function'?window.sublichatControlData():{};
      return {servicios:Array.isArray(x.servicios)?x.servicios:[],cuentas:Array.isArray(x.cuentas)?x.cuentas:[]};
    }catch(_){return {servicios:[],cuentas:[]};}
  }

  async function api(payload){
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{})});
    const j=await r.json().catch(()=>({ok:false,error:'Respuesta inválida del servidor.'}));
    if(!r.ok||!j.ok)throw new Error(j.error||`Error ${r.status}`);
    return j;
  }

  function setStatus(text,type){state.status=String(text||'');state.statusType=type||'';render();}

  function base64ToBuffer(raw){
    const binary=atob(String(raw||''));
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return bytes.buffer;
  }

  function bufferToBase64(buffer){
    const bytes=new Uint8Array(buffer);
    const step=0x8000;
    let out='';
    for(let i=0;i<bytes.length;i+=step)out+=String.fromCharCode.apply(null,bytes.subarray(i,i+step));
    return btoa(out);
  }

  function saveBuffer(buffer,filename){
    const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function valueText(v){
    if(v==null)return '';
    if(v instanceof Date)return v;
    if(typeof v==='object'){
      if(v.result!=null)return valueText(v.result);
      if(v.text!=null)return String(v.text);
      if(Array.isArray(v.richText))return v.richText.map(x=>x.text||'').join('');
      if(v.formula!=null&&v.result!=null)return valueText(v.result);
    }
    return String(v).trim();
  }

  function dateValue(v){
    if(v==null||v==='')return null;
    if(v instanceof Date&&!isNaN(v))return v;
    if(typeof v==='object'&&v.result!=null)return dateValue(v.result);
    if(typeof v==='number'&&v>20000&&v<90000){const d=new Date(Date.UTC(1899,11,30)+Math.round(v*86400000));return isNaN(d)?null:d;}
    const s=String(v).trim();
    let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);
    m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);if(m)return new Date(+m[3],+m[2]-1,+m[1]);
    const d=new Date(s);return isNaN(d)?null:d;
  }

  function dateKey(v){
    const d=dateValue(v);if(!d)return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function dateLabel(v){
    const d=dateValue(v);if(!d)return '—';
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  }

  function canonPlatform(v){
    const k=norm(v).replace(/[^a-z0-9]/g,'');
    const aliases={
      netflix:'netflix',netflixpremium:'netflix',netflixbelice:'netflix',extra:'netflix',extras:'netflix',
      vip:'vipnetflix',vipnetflix:'vipnetflix',netflixvip:'vipnetflix',
      disneyp:'disneyp',disneypremium:'disneyp',disneys:'disneys',disneystandard:'disneys',disney:'disney',
      hbomax:'hbomax',hbo:'hbomax',max:'hbomax',prime:'primevideo',primevideo:'primevideo',
      paramount:'paramount',paramountp:'paramount',crunchy:'crunchyroll',crunchyroll:'crunchyroll',
      vix:'vix',viki:'viki',vikirakuten:'viki',universal:'universal',universalp:'universal',
      spotify:'spotify',youtube:'youtube',youtubepremium:'youtube',canva:'canva',
      magis:'magis',magistv:'magis',oleada:'oleada',oleadatv:'oleada',iptv:'iptv'
    };
    if(aliases[k])return aliases[k];
    if(k.startsWith('oleada'))return 'oleada';
    if(k.startsWith('iptv'))return 'iptv';
    return k;
  }

  function platformsForSheet(name){
    const n=norm(name);
    if(n.includes('extra'))return ['netflix','vipnetflix'];
    if(n.includes('netflix vip'))return ['vipnetflix'];
    if(n.includes('netflix'))return ['netflix'];
    if(n.includes('disney'))return ['disneyp','disneys','disney'];
    if(n.includes('hbo')||n==='max')return ['hbomax'];
    if(n.includes('prime'))return ['primevideo'];
    if(n.includes('paramount'))return ['paramount'];
    if(n.includes('crunch'))return ['crunchyroll'];
    if(n.includes('vix')||n.includes('viki')||n.includes('universal'))return ['vix','viki','universal'];
    if(n.includes('spotify'))return ['spotify'];
    if(n.includes('youtube'))return ['youtube'];
    if(n.includes('canva'))return ['canva'];
    if(n.includes('magis'))return ['magis','oleada','iptv'];
    return [];
  }

  function headerKey(v){return norm(valueText(v)).replace(/[^a-z0-9]/g,'').toUpperCase();}
  function firstCol(map,names){for(const n of names){const a=map[n];if(a&&a.length)return a[0];}return 0;}

  function findHeader(ws){
    let best=null;
    const max=Math.min(Math.max(ws.rowCount||20,20),30);
    for(let r=1;r<=max;r++){
      const map={};
      ws.getRow(r).eachCell({includeEmpty:false},(cell,col)=>{const k=headerKey(cell.value);if(k)(map[k]||(map[k]=[])).push(col);});
      const score=(map.NOMBRE?3:0)+(map.CELULAR||map.TELEFONO?3:0)+(map.CORREO?2:0)+(map.PERFIL||map.PERFILES?1:0)+(map.EXPIRACION||map.RENOVACION?1:0);
      if(!best||score>best.score)best={row:r,map,score};
    }
    if(!best||best.score<4)return null;
    const m=best.map;
    return {
      row:best.row,map:m,
      name:firstCol(m,['NOMBRE']),seller:firstCol(m,['VENDEDOR']),phone:firstCol(m,['CELULAR','TELEFONO']),
      profile:firstCol(m,['PERFIL','PERFILES']),pin:firstCol(m,['PIN']),email:firstCol(m,['CORREO']),password:firstCol(m,['CLAVE']),
      price:firstCol(m,['PRECIO']),expiry:firstCol(m,['RENOVACION','EXPIRACION']),
      alert:firstCol(m,['ALERTA']),days:firstCol(m,['DIAS'])
    };
  }

  function buildInventoryMap(src){
    const byKey=new Map();
    const duplicates=new Set();
    (src.cuentas||[]).forEach((account)=>{
      const plat=canonPlatform(account.plataforma),acc=email(account.correo);
      (account.clientes||[]).forEach((p)=>{
        const key=`${plat}|${norm(p.nombre)}`;
        const item={account:acc,slot:p.slot??'',pin:p.pin||'',accountId:account.id||''};
        if(byKey.has(key))duplicates.add(key);else byKey.set(key,item);
      });
    });
    return {byKey,duplicates};
  }

  function parseWorkbook(workbook,src){
    const sheets=[];
    const excelRows=[];
    workbook.worksheets.forEach((ws)=>{
      if(['revision','__sublichat_ids'].includes(norm(ws.name).replace(/[^a-z0-9_]/g,'')))return;
      const platforms=platformsForSheet(ws.name);if(!platforms.length)return;
      const h=findHeader(ws);if(!h)return;
      const rows=[];
      let currentAccount='';
      const end=Math.min(Math.max(ws.rowCount||h.row+1,h.row+1),2200);
      for(let r=h.row+1;r<=end;r++){
        const row=ws.getRow(r);
        const directEmail=h.email?email(valueText(row.getCell(h.email).value)):'';
        if(directEmail)currentAccount=directEmail;
        const name=h.name?String(valueText(row.getCell(h.name).value)||'').trim():'';
        const tel=h.phone?phone(valueText(row.getCell(h.phone).value)):'';
        const profile=h.profile?String(valueText(row.getCell(h.profile).value)||'').trim():'';
        const record={
          ws,sheet:ws.name,row:r,header:h,platforms,accountEmail:directEmail||currentAccount,directEmail,
          name,tel,profile,pin:h.pin?String(valueText(row.getCell(h.pin).value)||'').trim():'',
          price:h.price?Number(valueText(row.getCell(h.price).value)||0)||0:0,
          expiry:h.expiry?dateKey(row.getCell(h.expiry).value):'',
          blank:!name&&!tel
        };
        rows.push(record);
        if(name||tel)excelRows.push(record);
      }
      sheets.push({ws,header:h,platforms,rows});
    });

    const inv=buildInventoryMap(src);
    const live=(src.servicios||[]).map((s,i)=>{
      const plat=canonPlatform(s.plataforma||s.plataformaLabel);
      const invKey=`${plat}|${norm(s.nombre)}`;
      const invItem=inv.byKey.get(invKey)||null;
      return {...s,_index:i,_used:false,_plat:plat,_name:norm(s.nombre),_phone:phone(s.telefono),_email:email(s.correo),_date:dateKey(s.fecha),_inv:invItem,_invDuplicate:inv.duplicates.has(invKey)};
    });
    const livePhoneCount=new Map();
    live.forEach(s=>{if(s._phone){const k=`${s._plat}|${s._phone}`;livePhoneCount.set(k,(livePhoneCount.get(k)||0)+1);}});

    const exactRows=new Set(excelRows.filter(row=>live.some(s=>row.platforms.includes(s._plat)&&row.accountEmail&&s._email===row.accountEmail&&((row.name&&norm(row.name)===s._name)||(row.tel&&row.tel===s._phone)))));
    const orderedExcelRows=[...excelRows].sort((a,b)=>Number(exactRows.has(b))-Number(exactRows.has(a)));
    const items=[];
    const matched=[];
    for(const row of orderedExcelRows){
      let best=null,bestScore=-1;
      for(const s of live){
        if(s._used||!row.platforms.includes(s._plat))continue;
        const nameMatch=!!row.name&&!!s._name&&norm(row.name)===s._name;
        const phoneMatch=!!row.tel&&!!s._phone&&row.tel===s._phone;
        if(!nameMatch&&!phoneMatch)continue;
        if(phoneMatch&&!nameMatch&&(livePhoneCount.get(`${s._plat}|${s._phone}`)||0)>1&&row.accountEmail!==s._email)continue;
        let score=100+(nameMatch?45:0)+(phoneMatch?38:0);
        if(row.accountEmail&&s._email&&row.accountEmail===s._email)score+=55;
        if(row.profile&&s.perfil&&norm(row.profile)===norm(s.perfil))score+=8;
        if(score>bestScore){best=s;bestScore=score;}
      }
      if(!best){
        items.push({kind:'solo_excel',level:'bad',status:'Solo en Excel',detail:'No aparece como servicio activo en la base actual.',name:row.name||'Sin nombre',phone:row.tel,platform:row.platforms[0]||'',excelAccount:row.accountEmail,liveAccount:'',inventoryAccount:'',excelDate:row.expiry,liveDate:'',row});
        continue;
      }
      best._used=true;
      const accountDiff=!!row.accountEmail&&!!best._email&&row.accountEmail!==best._email;
      const inventoryDiff=!!best._inv&&!!best._inv.account&&!!best._email&&best._inv.account!==best._email;
      const dateDiff=!!row.expiry&&!!best._date&&row.expiry!==best._date;
      const duplicate=best._invDuplicate;
      let kind='ok',level='ok',status='Correcto',detail='Cliente, cuenta y fecha coinciden.';
      if(duplicate){kind='duplicado';level='bad';status='Duplicado';detail='El cliente aparece asignado en más de una cuenta del inventario.';}
      else if(inventoryDiff||accountDiff){kind='cuenta';level='bad';status='Revisar cuenta';detail=inventoryDiff?'La cuenta del servicio no coincide con la asignación del inventario.':'La cuenta del Excel no coincide con Sublichat.';}
      else if(dateDiff){kind='fecha';level='warn';status='Actualizar fecha';detail='La fecha del Excel es diferente a la fecha vigente en Sublichat.';}
      const item={kind,level,status,detail,name:best.nombre||row.name,phone:best._phone||row.tel,platform:best.plataformaLabel||best.plataforma||best._plat,excelAccount:row.accountEmail,liveAccount:best._email,inventoryAccount:best._inv?.account||'',excelDate:row.expiry,liveDate:best._date,row,service:best};
      items.push(item);matched.push(item);
    }

    for(const s of live.filter(x=>!x._used)){
      const invDiff=!!s._inv&&!!s._inv.account&&!!s._email&&s._inv.account!==s._email;
      items.push({kind:'solo_sublichat',level:invDiff?'bad':'warn',status:'Falta en Excel',detail:invDiff?'Además, la cuenta del servicio difiere del inventario.':'El servicio actual todavía no está colocado en la plantilla.',name:s.nombre||'Sin nombre',phone:s._phone,platform:s.plataformaLabel||s.plataforma||s._plat,excelAccount:'',liveAccount:s._email,inventoryAccount:s._inv?.account||'',excelDate:'',liveDate:s._date,service:s});
    }

    const correct=items.filter(x=>x.kind==='ok').length;
    const metrics={
      clientes:new Set(live.map(x=>x.clienteId||`${x._name}|${x._phone}`)).size,
      servicios:live.length,cuentas:(src.cuentas||[]).length,filasExcel:excelRows.length,correctos:correct,
      revision:items.length-correct,soloExcel:items.filter(x=>x.kind==='solo_excel').length,
      soloSublichat:items.filter(x=>x.kind==='solo_sublichat').length,fechaDistinta:items.filter(x=>x.kind==='fecha').length,
      cuentaDistinta:items.filter(x=>['cuenta','duplicado'].includes(x.kind)).length
    };
    return {workbook,sheets,items,matched,metrics};
  }

  async function loadTemplateBase64(force){
    if(state.templateBase64&&!force)return state.templateBase64;
    const id=state.meta?.plantilla?.id;if(!id)throw new Error('Primero cargue su Excel actual como plantilla.');
    const j=await api({accion:'control_leer_archivo',id});
    state.templateBase64=j.base64||'';
    return state.templateBase64;
  }

  async function analyze(force){
    if(!window.ExcelJS)throw new Error('No cargó el lector de Excel. Revise la conexión e intente nuevamente.');
    const src=source();
    if(!src.servicios.length)throw new Error('La base actual de clientes todavía no terminó de cargar. Presione “Actualizar base”.');
    const raw=await loadTemplateBase64(force);
    const workbook=new ExcelJS.Workbook();
    await workbook.xlsx.load(base64ToBuffer(raw));
    state.analysis=parseWorkbook(workbook,src);
    return state.analysis;
  }

  function resultClass(item){return item.level==='ok'?'ok':(item.level==='warn'?'warn':'bad');}
  function resultFilter(item){
    if(state.filter==='all')return true;
    if(state.filter==='ok')return item.kind==='ok';
    if(state.filter==='revision')return item.kind!=='ok';
    if(state.filter==='solo_excel')return item.kind==='solo_excel';
    if(state.filter==='solo_sublichat')return item.kind==='solo_sublichat';
    if(state.filter==='cuenta')return ['cuenta','duplicado'].includes(item.kind);
    return true;
  }

  function maskAccount(v){return v||'—';}
  function filteredItems(){
    const q=norm(state.query);
    return (state.analysis?.items||[]).filter(resultFilter).filter(x=>!q||norm([x.name,x.phone,x.platform,x.excelAccount,x.liveAccount,x.inventoryAccount,x.status].join(' ')).includes(q));
  }

  function kpisHtml(){
    const m=state.analysis?.metrics||{};
    return `<div class="cm-kpis">
      <div class="cm-kpi"><b>${m.clientes??'—'}</b><span>Clientes actuales</span></div>
      <div class="cm-kpi"><b>${m.servicios??'—'}</b><span>Servicios en Sublichat</span></div>
      <div class="cm-kpi"><b>${m.cuentas??'—'}</b><span>Cuentas del inventario</span></div>
      <div class="cm-kpi good"><b>${m.correctos??'—'}</b><span>Asignaciones correctas</span></div>
      <div class="cm-kpi ${m.revision?'bad':'good'}"><b>${m.revision??'—'}</b><span>Registros para revisar</span></div>
    </div>`;
  }

  function templateHtml(){
    const t=state.meta?.plantilla;
    return `<section class="cm-panel">
      <div class="cm-panel-head"><div><h3>📘 Plantilla del respaldo</h3><p>Se conserva el diseño de su Excel. Solo Sublicuentas puede cargar, generar o descargar estos archivos.</p></div><span class="cm-template-state ${t?'ok':''}">${t?'✅ Plantilla activa':'⚠️ Falta plantilla'}</span></div>
      ${t?`<div class="cm-note"><b>${esc(t.filename)}</b> · ${Number(t.size||0).toLocaleString('es-HN')} bytes · cargado ${esc(String(t.createdAt||'').replace('T',' ').slice(0,16))}</div>`:'<div class="cm-note">Cargue una sola vez el Excel “Sublicuentas streaming”. No se publica dentro de la web; queda protegido para generar sus respaldos.</div>'}
      <div class="cm-actions" style="margin-top:11px">
        <label class="cm-file-btn ${state.busy?'off':''}">📤 ${t?'Reemplazar plantilla':'Cargar Excel actual'}<input id="cmTemplateFile" type="file" accept=".xlsx"></label>
        ${t?'<button class="cm-btn" data-cm-action="download-template">⬇️ Descargar plantilla</button>':''}
        <button class="cm-btn" data-cm-action="refresh-data">🔄 Actualizar base</button>
        ${t?'<button class="cm-btn primary" data-cm-action="review">🔎 Revisar ahora</button>':''}
      </div>
      <div class="cm-hint">Para corregir algo, abra el cliente o la cuenta desde la revisión. Después presione “Revisar ahora”; no necesita escribirlo otra vez en Excel.</div>
      <div class="cm-status ${state.statusType==='error'?'err':(state.statusType==='good'?'good':'')}">${esc(state.status)}</div>
    </section>`;
  }

  function reviewHtml(){
    if(!state.analysis)return `<section class="cm-panel"><div class="cm-empty">Cuando cargue la plantilla y presione <b>Revisar ahora</b>, aparecerán aquí las diferencias entre Excel, Clientes e Inventario.</div></section>`;
    const all=filteredItems();state.visible=all.slice(0,300);
    const filters=[['revision','Revisar'],['cuenta','Cuentas'],['solo_sublichat','Faltan en Excel'],['solo_excel','Solo Excel'],['ok','Correctos'],['all','Todos']];
    const rows=state.visible.map((x,i)=>`<tr>
      <td><div class="cm-client"><b>${esc(x.name||'Sin nombre')}</b><small>${esc(x.phone||'Sin teléfono')}</small></div></td>
      <td><span class="cm-platform">${esc(x.platform||'—')}</span></td>
      <td>${esc(maskAccount(x.excelAccount))}</td><td>${esc(maskAccount(x.liveAccount))}</td><td>${esc(maskAccount(x.inventoryAccount))}</td>
      <td>${esc(dateLabel(x.excelDate))}</td><td>${esc(dateLabel(x.liveDate))}</td>
      <td><span class="cm-result ${resultClass(x)}">${esc(x.status)}</span></td>
      <td><div class="cm-inline-actions"><button class="cm-mini" data-cm-client="${i}" title="Abrir cliente">👤</button><button class="cm-mini" data-cm-account="${i}" title="Abrir cuenta">📦</button></div></td>
    </tr>`).join('');
    return `<section class="cm-panel">
      <div class="cm-panel-head"><div><h3>🔍 Revisión de clientes y cuentas</h3><p>Compara la base actual, las asignaciones de inventario y las filas de su Excel.</p></div><span class="cm-template-state ${state.analysis.metrics.revision?'':'ok'}">${state.analysis.metrics.revision?state.analysis.metrics.revision+' por revisar':'✅ Todo coincide'}</span></div>
      <div class="cm-toolbar"><label class="cm-search"><span>⌕</span><input id="cmSearch" value="${esc(state.query)}" placeholder="Cliente, teléfono, plataforma o cuenta…"></label><div class="cm-filters">${filters.map(([k,l])=>`<button class="cm-filter ${state.filter===k?'on':''}" data-cm-filter="${k}">${l}</button>`).join('')}</div></div>
      <div class="cm-table-wrap">${rows?`<table class="cm-table"><thead><tr><th>Cliente</th><th>Plataforma</th><th>Cuenta Excel</th><th>Cuenta Sublichat</th><th>Cuenta inventario</th><th>Fecha Excel</th><th>Fecha actual</th><th>Resultado</th><th>Acciones</th></tr></thead><tbody>${rows}</tbody></table>`:'<div class="cm-empty">No hay registros con este filtro.</div>'}</div>
      ${all.length>state.visible.length?`<div class="cm-hint">Mostrando 300 de ${all.length} resultados. Use la búsqueda para encontrar un cliente específico.</div>`:''}
      <div class="cm-actions" style="margin-top:12px"><button class="cm-btn good" data-cm-action="generate-download">📥 Generar y descargar Excel</button><button class="cm-btn" data-cm-action="save-backup">🛡️ Guardar respaldo sin descargar</button></div>
    </section>`;
  }

  function backupsHtml(){
    const list=state.meta?.respaldos||[];
    return `<section class="cm-panel"><div class="cm-panel-head"><div><h3>🛡️ Respaldos privados</h3><p>Se guarda una copia al generar y una copia automática al abrir el módulo; máximo ${state.meta?.dailyLimit||2} por día.</p></div><span class="cm-template-state">${list.length} versiones</span></div>
      <div class="cm-backups">${list.length?list.slice(0,12).map((b)=>`<div class="cm-backup"><div><b>${esc(b.filename)}</b><small>${esc(String(b.createdAt||'').replace('T',' ').slice(0,16))} · ${b.metricas?.servicios??'—'} servicios · ${b.metricas?.revision??'—'} para revisar</small></div><div class="cm-backup-actions"><button class="cm-mini" data-cm-download="${esc(b.id)}" title="Descargar">⬇️</button><button class="cm-mini" data-cm-restore="${esc(b.id)}" title="Usar como plantilla">↩️</button></div></div>`).join(''):'<div class="cm-empty">Todavía no hay respaldos generados.</div>'}</div>
    </section>`;
  }

  function render(){
    const host=root();if(!host)return;
    if(!isAdmin()){host.innerHTML='<div class="cm-empty">Este módulo pertenece únicamente al usuario Sublicuentas.</div>';return;}
    if(state.loading&&!state.meta){host.innerHTML='<div class="cm-loading"><div><div class="cm-spinner"></div>Cargando Control Maestro…</div></div>';return;}
    host.innerHTML=`<div class="cm-shell" data-build="${BUILD}">
      <header class="cm-hero"><div class="cm-title"><div class="cm-title-icon">🗃️</div><div><h2>Control Maestro</h2><p>Clientes, cuentas asignadas y respaldo diario en el mismo formato de su Excel.</p></div></div><span class="cm-private">🔒 Solo Sublicuentas</span></header>
      ${kpisHtml()}${templateHtml()}${reviewHtml()}${backupsHtml()}
    </div>`;
    bind();
  }

  function bind(){
    const host=root();if(!host)return;
    host.querySelectorAll('[data-cm-action]').forEach(b=>b.onclick=()=>handleAction(b.dataset.cmAction));
    const file=host.querySelector('#cmTemplateFile');if(file)file.onchange=()=>uploadTemplate(file.files?.[0]);
    host.querySelectorAll('[data-cm-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.cmFilter;render();});
    const q=host.querySelector('#cmSearch');if(q)q.oninput=()=>{state.query=q.value;render();setTimeout(()=>document.getElementById('cmSearch')?.focus(),0);};
    host.querySelectorAll('[data-cm-client]').forEach(b=>b.onclick=()=>openClient(state.visible[Number(b.dataset.cmClient)]));
    host.querySelectorAll('[data-cm-account]').forEach(b=>b.onclick=()=>openAccount(state.visible[Number(b.dataset.cmAccount)]));
    host.querySelectorAll('[data-cm-download]').forEach(b=>b.onclick=()=>downloadStored(b.dataset.cmDownload));
    host.querySelectorAll('[data-cm-restore]').forEach(b=>b.onclick=()=>restoreStored(b.dataset.cmRestore));
  }

  async function refreshMeta(){
    state.loading=true;render();
    try{state.meta=await api({accion:'control_estado'});state.status='';state.statusType='';}
    catch(e){state.status=e.message||'No se pudo cargar Control Maestro.';state.statusType='error';}
    finally{state.loading=false;render();}
  }

  async function uploadTemplate(file){
    if(!file)return;
    if(!/\.xlsx$/i.test(file.name)){setStatus('Use su archivo Excel en formato .xlsx.','error');return;}
    state.busy=true;setStatus('Validando y guardando la plantilla privada…','');
    try{
      const buffer=await file.arrayBuffer();
      if(!window.ExcelJS)throw new Error('No cargó el lector de Excel.');
      const test=new ExcelJS.Workbook();await test.xlsx.load(buffer);
      if(!test.worksheets.length)throw new Error('El Excel no contiene hojas.');
      const j=await api({accion:'control_guardar_plantilla',filename:file.name,size:file.size,mime:file.type,base64:bufferToBase64(buffer),motivo:state.meta?.plantilla?'reemplazo_plantilla':'carga_inicial'});
      state.templateBase64=bufferToBase64(buffer);state.analysis=null;
      await refreshMeta();
      setStatus(`✅ Plantilla guardada: ${j.archivo?.filename||file.name}. Ahora revisando clientes…`,'good');
      setTimeout(()=>runReview(false),80);
    }catch(e){setStatus('⚠️ '+(e.message||'No se pudo guardar la plantilla.'),'error');}
    finally{state.busy=false;render();}
  }

  async function runReview(force){
    if(state.busy)return;
    state.busy=true;setStatus('Comparando clientes, cuentas, inventario y fechas…','');
    try{
      await analyze(!!force);
      const m=state.analysis.metrics;
      setStatus(`✅ Revisión terminada: ${m.correctos} correctos · ${m.revision} para revisar.`,'good');
      render();
      setTimeout(()=>maybeAutoBackup(),80);
    }catch(e){setStatus('⚠️ '+(e.message||'No se pudo revisar.'),'error');}
    finally{state.busy=false;render();}
  }

  function writeService(row,item){
    const h=row.header,ws=row.ws,s=item.service;if(!s)return;
    const excelRow=ws.getRow(row.row);
    if(h.name&&s.nombre)excelRow.getCell(h.name).value=s.nombre;
    if(h.phone&&s.telefono){excelRow.getCell(h.phone).value=String(s.telefono);excelRow.getCell(h.phone).numFmt='@';}
    if(h.pin&&s.pinPerfil)excelRow.getCell(h.pin).value=String(s.pinPerfil);
    if(h.price&&Number.isFinite(Number(s.precio)))excelRow.getCell(h.price).value=Number(s.precio)||0;
    if(h.expiry&&s.fecha){const d=dateValue(s.fecha);if(d){excelRow.getCell(h.expiry).value=d;excelRow.getCell(h.expiry).numFmt='dd/mm/yyyy';}}
    if(h.profile&&s.perfil&&String(s.perfil).trim())excelRow.getCell(h.profile).value=s.perfil;
  }

  function updateAccountCredentials(analysis,src){
    const accounts=(src.cuentas||[]).map(a=>({...a,_plat:canonPlatform(a.plataforma),_email:email(a.correo)}));
    analysis.sheets.forEach((sheet)=>{
      if(!sheet.header.password)return;
      sheet.rows.filter(r=>r.directEmail).forEach((row)=>{
        const account=accounts.find(a=>a._email===row.directEmail&&sheet.platforms.includes(a._plat));
        if(account&&account.clave!=null&&String(account.clave)!=='')row.ws.getRow(row.row).getCell(sheet.header.password).value=String(account.clave);
      });
    });
  }

  function fillMissingServices(analysis){
    const used=new Set();let added=0;
    analysis.items.filter(x=>x.kind==='solo_sublichat'&&x.service&&x.service._email).forEach((item)=>{
      const s=item.service;
      const candidates=[];
      analysis.sheets.filter(sh=>sh.platforms.includes(s._plat)).forEach(sh=>sh.rows.forEach(r=>{
        if(r.blank&&r.accountEmail&&r.accountEmail===s._email&&!used.has(`${r.sheet}|${r.row}`))candidates.push(r);
      }));
      if(!candidates.length)return;
      let target=candidates[0];
      if(s.perfil){const exact=candidates.find(r=>norm(r.profile)===norm(s.perfil));if(exact)target=exact;}
      used.add(`${target.sheet}|${target.row}`);writeService(target,{service:s});
      item.detail='Se agregó automáticamente en un espacio disponible de la cuenta.';item.status='Agregado al generar';item.level='warn';
      item.generatedRow=target;added++;
    });
    return added;
  }

  function removeSheet(workbook,name){const ws=workbook.getWorksheet(name);if(ws)workbook.removeWorksheet(ws.id);}

  function addReviewSheet(analysis){
    const wb=analysis.workbook;removeSheet(wb,'REVISIÓN');
    const ws=wb.addWorksheet('REVISIÓN',{views:[{state:'frozen',ySplit:3}]});
    ws.properties.defaultRowHeight=20;
    ws.mergeCells('A1:J1');ws.getCell('A1').value='CONTROL MAESTRO · REVISIÓN DE CLIENTES Y CUENTAS';
    ws.getCell('A1').font={name:'Arial',size:15,bold:true,color:{argb:'FFFFFFFF'}};ws.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF123052'}};ws.getCell('A1').alignment={vertical:'middle',horizontal:'left'};ws.getRow(1).height=30;
    ws.mergeCells('A2:J2');ws.getCell('A2').value=`Generado ${new Date().toLocaleString('es-HN')} · Corrija los casos marcados desde Sublichat y vuelva a generar.`;ws.getCell('A2').font={italic:true,color:{argb:'FF5F7082'}};
    const headers=['Estado','Cliente','Teléfono','Plataforma','Cuenta Excel','Cuenta Sublichat','Cuenta Inventario','Fecha Excel','Fecha Sublichat','Detalle'];
    ws.getRow(3).values=headers;ws.getRow(3).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(3).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE2231A'}};
    const review=analysis.items.filter(x=>x.kind!=='ok'||x.generatedRow);
    review.forEach((x)=>ws.addRow([x.status,x.name,x.phone,x.platform,x.excelAccount,x.liveAccount,x.inventoryAccount,dateLabel(x.excelDate),dateLabel(x.liveDate),x.detail]));
    [16,28,15,18,34,34,34,15,15,62].forEach((width,i)=>{ws.getColumn(i+1).width=width;});
    ws.autoFilter={from:'A3',to:'J3'};
    for(let r=4;r<=ws.rowCount;r++){
      const row=ws.getRow(r);row.alignment={vertical:'top',wrapText:false};
      const status=String(row.getCell(1).value||'');
      const color=/Correcto/i.test(status)?'FFE4F6EC':(/Actualizar|Agregado/i.test(status)?'FFFFF4D6':'FFFFE5E7');
      row.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:color}};row.getCell(1).font={bold:true};
    }
    if(!review.length){ws.addRow(['Correcto','','','','','','','','','No se detectaron diferencias.']);}
  }

  function addIdSheet(analysis){
    const wb=analysis.workbook;removeSheet(wb,'__SUBLICHAT_IDS');
    const ws=wb.addWorksheet('__SUBLICHAT_IDS');ws.state='veryHidden';
    ws.addRow(['clienteId','servicioIndex','hoja','fila','plataforma','cuenta','generadoAt']);
    analysis.matched.forEach((x)=>{if(x.service&&x.row)ws.addRow([x.service.clienteId||'',x.service.servicioIndex??'',x.row.sheet,x.row.row,x.service._plat,x.service._email,new Date().toISOString()]);});
    analysis.items.filter(x=>x.generatedRow&&x.service).forEach((x)=>ws.addRow([x.service.clienteId||'',x.service.servicioIndex??'',x.generatedRow.sheet,x.generatedRow.row,x.service._plat,x.service._email,new Date().toISOString()]));
  }

  function columnLetter(number){
    let n=Number(number)||0,out='';
    while(n>0){n--;out=String.fromCharCode(65+(n%26))+out;n=Math.floor(n/26);}
    return out;
  }

  function renewalRules(daysLetter,startRow){
    const days=`$${daysLetter}${startRow}`;
    const rule=(formula,fill,font)=>({
      type:'expression',formulae:[formula],
      style:{
        fill:{type:'pattern',pattern:'solid',fgColor:{argb:fill},bgColor:{argb:fill}},
        font:{bold:true,color:{argb:font}}
      }
    });
    return [
      rule(`AND(ISNUMBER(${days}),${days}<0)`,'FFFFE5E7','FFB4232E'),
      rule(`AND(ISNUMBER(${days}),${days}=0)`,'FFFFE8CC','FF9A4B00'),
      rule(`AND(ISNUMBER(${days}),${days}>0,${days}<4)`,'FFFFF4D6','FF8A6700'),
      rule(`AND(ISNUMBER(${days}),${days}>=4)`,'FFE4F6EC','FF176B45')
    ];
  }

  function rebuildConditionalFormatting(analysis){
    const workbook=analysis.workbook;
    // La plantilla histórica contiene miles de reglas duplicadas y varias con #REF!.
    // ExcelJS no puede volver a escribirlas; se sustituyen por un conjunto pequeño y válido.
    workbook.worksheets.forEach((ws)=>{ws.conditionalFormattings=[];});
    analysis.sheets.forEach((sheet)=>{
      const h=sheet.header;if(!h.days)return;
      const start=h.row+1,end=Math.max(start,Math.min(sheet.ws.rowCount||start,2200));
      const daysLetter=columnLetter(h.days);if(!daysLetter)return;
      const targetColumns=[h.alert,h.days].filter(Boolean);
      targetColumns.forEach((col)=>{
        const letter=columnLetter(col);if(!letter)return;
        sheet.ws.addConditionalFormatting({ref:`${letter}${start}:${letter}${end}`,rules:renewalRules(daysLetter,start)});
      });
    });
  }

  async function buildUpdatedWorkbook(){
    const raw=await loadTemplateBase64(false);
    const wb=new ExcelJS.Workbook();await wb.xlsx.load(base64ToBuffer(raw));
    wb.calcProperties.fullCalcOnLoad=true;
    const src=source();
    const analysis=parseWorkbook(wb,src);
    analysis.matched.forEach((item)=>writeService(item.row,item));
    fillMissingServices(analysis);updateAccountCredentials(analysis,src);addReviewSheet(analysis);addIdSheet(analysis);rebuildConditionalFormatting(analysis);
    const buffer=await wb.xlsx.writeBuffer();
    return {buffer,analysis,filename:`Sublicuentas_actual_${fileDate()}.xlsx`};
  }

  async function generate(options){
    if(state.busy)return;
    if(!state.analysis){await runReview(false);if(!state.analysis)return;}
    state.busy=true;setStatus('Generando el Excel con el mismo formato y la hoja de revisión…','');
    try{
      const out=await buildUpdatedWorkbook();
      if(options.save){
        const j=await api({accion:'control_guardar_respaldo',filename:out.filename,size:out.buffer.byteLength,mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',base64:bufferToBase64(out.buffer),motivo:options.auto?'automatico':'manual',metricas:out.analysis.metrics});
        const finalMessage=j.skipped?'✅ Excel generado. Ya existen los 2 respaldos permitidos de hoy.':'✅ Excel generado y respaldo privado guardado.';
        await refreshMeta();
        setStatus(finalMessage,'good');
      }else setStatus('✅ Excel generado correctamente.','good');
      if(options.download)saveBuffer(out.buffer,out.filename);
      state.analysis=out.analysis;render();
      return true;
    }catch(e){setStatus('⚠️ '+(e.message||'No se pudo generar el Excel.'),'error');return false;}
    finally{state.busy=false;render();}
  }

  async function downloadStored(id){
    if(!id)return;state.busy=true;setStatus('Preparando descarga…','');
    try{const j=await api({accion:'control_leer_archivo',id});const buffer=base64ToBuffer(j.base64);saveBuffer(buffer,j.archivo?.filename||'Sublicuentas.xlsx');setStatus('✅ Descarga preparada.','good');}
    catch(e){setStatus('⚠️ '+(e.message||'No se pudo descargar.'),'error');}
    finally{state.busy=false;render();}
  }

  async function restoreStored(id){
    if(!id||!confirm('¿Usar este respaldo como nueva plantilla base? La plantilla actual no se elimina y seguirá en el historial.'))return;
    state.busy=true;setStatus('Restaurando plantilla…','');
    try{await api({accion:'control_restaurar_plantilla',id});state.templateBase64='';state.analysis=null;await refreshMeta();setStatus('✅ Respaldo restaurado como plantilla.','good');setTimeout(()=>runReview(true),80);}
    catch(e){setStatus('⚠️ '+(e.message||'No se pudo restaurar.'),'error');}
    finally{state.busy=false;render();}
  }

  function openClient(item){
    if(!item)return;window.subliRBAC?.go?.('clientes');
    setTimeout(()=>{const q=document.getElementById('q');if(q){q.value=item.name||item.phone||'';q.dispatchEvent(new Event('input',{bubbles:true}));q.focus();}},180);
  }

  function openAccount(item){
    if(!item)return;window.subliRBAC?.go?.('inventario');
    setTimeout(()=>{const q=document.getElementById('invQ');if(q){q.value=item.inventoryAccount||item.liveAccount||item.excelAccount||item.platform||'';q.dispatchEvent(new Event('input',{bubbles:true}));q.focus();}},180);
  }

  async function handleAction(action){
    if(action==='review')return runReview(true);
    if(action==='refresh-data'){
      if(typeof window.sublichatControlReload!=='function')return setStatus('No encontré la función para actualizar la base.','error');
      state.busy=true;setStatus('Actualizando clientes e inventario desde la base…','');
      try{await window.sublichatControlReload();setStatus('✅ Base actualizada. Ejecutando revisión…','good');state.analysis=null;}
      catch(e){setStatus('⚠️ '+(e.message||'No se pudo actualizar.'),'error');}
      finally{state.busy=false;render();}
      return runReview(false);
    }
    if(action==='download-template')return downloadStored(state.meta?.plantilla?.id);
    if(action==='generate-download')return generate({save:true,download:true});
    if(action==='save-backup')return generate({save:true,download:false});
  }

  async function maybeAutoBackup(){
    if(state.autoTried||!state.analysis||!state.meta?.plantilla)return;
    state.autoTried=true;
    const key=`sublichat_control_auto_${serverDateKey()}`;
    if(localStorage.getItem(key))return;
    const today=(state.meta.respaldos||[]).filter(x=>x.dateKey===serverDateKey()).length;
    if(today>=(state.meta.dailyLimit||2)){localStorage.setItem(key,'limite');return;}
    localStorage.setItem(key,'intentando');
    const ok=await generate({save:true,download:false,auto:true});
    if(ok)localStorage.setItem(key,'guardado');else localStorage.removeItem(key);
  }

  async function boot(){
    if(!isAdmin()||!root())return;
    if(!state.booted){state.booted=true;await refreshMeta();}
    else render();
    if(state.meta?.plantilla&&!state.analysis&&!state.busy)runReview(false);
  }

  function install(){
    if(state.installed)return;state.installed=true;
    document.addEventListener('click',(ev)=>{if(ev.target?.closest?.('[data-screen="control-cuentas"]'))setTimeout(boot,90);},true);
    const observer=new MutationObserver(()=>{if(screenActive()&&!state.loading)boot();});
    const screen=document.getElementById('screen-control-cuentas');if(screen)observer.observe(screen,{attributes:true,attributeFilter:['class']});
    if(screenActive())boot();
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(document.getElementById('screen-control-cuentas')&&window.subliRBAC){clearInterval(timer);install();}
    else if(tries>120)clearInterval(timer);
  },100);
  if(document.readyState==='complete'||document.readyState==='interactive')setTimeout(()=>{if(document.getElementById('screen-control-cuentas'))install();},200);
})();
