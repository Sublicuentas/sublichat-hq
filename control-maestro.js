(function controlMaestroSublicuentas(){
  'use strict';

  const API='/api/importar';
  const BUILD='CONTROL-MAESTRO-CONCILIACION-TOTAL-20260805-4';
  const state={
    booted:false,installed:false,loading:false,busy:false,status:'',statusType:'',meta:null,
    templateBase64:'',analysis:null,filter:'revision',query:'',visible:[],autoTried:false,
    accountAudit:null,accountPlatform:'all',accountStatus:'all',accountQuery:'',accountVisible:[],accountLimit:220,revealedAccounts:new Set(),
    reviewSavingKey:'',accountFeedback:null
  };

  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=(v)=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9@.+\s_-]/g,' ').replace(/\s+/g,' ').trim();
  const phone=(v)=>String(v??'').replace(/\D/g,'').replace(/^504(?=\d{8}$)/,'').slice(-8);
  const email=(v)=>String(v??'').trim().toLowerCase().replace(/\s+/g,'');
  const excelEmail=(v)=>{const x=email(v);return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)?x:'';};
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
    if(n.includes('extra'))return ['vipnetflix','netflix'];
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

  const AUDIT_PLATFORM_LABELS={
    netflix:'Netflix',vipnetflix:'VIP Netflix',disney:'Disney+',hbomax:'HBO Max',primevideo:'Prime Video',
    paramount:'Paramount+',crunchyroll:'Crunchyroll',vix:'ViX',viki:'Viki Rakuten',universal:'Universal+',
    spotify:'Spotify',youtube:'YouTube',canva:'Canva',magis:'Magis TV',oleada:'Oleada TV',iptv:'IPTV',
    vixmix:'ViX / Viki / Universal+'
  };

  function auditFamily(v){
    const p=canonPlatform(v);
    if(['disneyp','disneys','disney'].includes(p))return 'disney';
    return p||'sin_plataforma';
  }

  function auditPlatformLabel(v){
    const p=auditFamily(v);
    return AUDIT_PLATFORM_LABELS[p]||String(v||p||'Sin plataforma').replace(/(^|\s)\S/g,x=>x.toUpperCase());
  }

  function daysSince(v){
    const d=new Date(v||'');if(isNaN(d))return 99999;
    const today=new Date();today.setHours(0,0,0,0);d.setHours(0,0,0,0);
    return Math.max(0,Math.floor((today-d)/86400000));
  }

  function isExpired(v){
    const d=dateValue(v);if(!d)return false;
    const today=new Date();today.setHours(0,0,0,0);d.setHours(0,0,0,0);
    return d<today;
  }

  function excelAuditFamily(sheet,row,item,src){
    if(item?.service)return auditFamily(item.service._plat||item.service.plataforma||item.service.plataformaLabel);
    const allowed=[...new Set((sheet.platforms||[]).map(auditFamily))];
    const mail=excelEmail(row.accountEmail);
    if(mail){
      const found=new Set();
      (src.servicios||[]).forEach((s)=>{if(email(s.correo)===mail&&allowed.includes(auditFamily(s.plataforma||s.plataformaLabel)))found.add(auditFamily(s.plataforma||s.plataformaLabel));});
      (src.cuentas||[]).forEach((a)=>{if(email(a.correo)===mail&&allowed.includes(auditFamily(a.plataforma)))found.add(auditFamily(a.plataforma));});
      if(found.size===1)return [...found][0];
    }
    const name=norm(sheet.ws?.name||row.sheet);
    if(name.includes('extra')||name.includes('netflix vip'))return 'vipnetflix';
    if(name.includes('netflix belice'))return 'netflix';
    if(name.includes('vix')&&name.includes('viki'))return 'vixmix';
    return allowed[0]||'sin_plataforma';
  }

  function buildAccountAudit(src,analysis){
    const groups=new Map();
    const hasExcelAudit=!!analysis?.sheets?.length;
    const allServices=(src.servicios||[]).map((s,i)=>({
      ...s,_auditIndex:i,_family:auditFamily(s.plataforma||s.plataformaLabel),_email:email(s.correo),
      _name:norm(s.nombre),_phone:phone(s.telefono),_date:dateKey(s.fecha)
    }));
    const assignmentCounts=new Map();
    (src.cuentas||[]).forEach((account)=>{
      const family=auditFamily(account.plataforma);
      (account.clientes||[]).forEach((p)=>{
        const name=norm(p.nombre);if(!name)return;
        const key=`${family}|${name}`;assignmentCounts.set(key,(assignmentCounts.get(key)||0)+1);
      });
    });

    const ensureGroup=(family,mail,key)=>{
      if(!groups.has(key))groups.set(key,{
        key,family,email:mail,platform:auditPlatformLabel(family),rawPlatforms:new Set(),inventoryAccounts:[],accountIds:[],
        clave:'',capacidad:0,disponibles:0,estado:'',invClients:[],services:[],excelRows:[],excelSheets:new Set()
      });
      return groups.get(key);
    };

    (src.cuentas||[]).forEach((account,i)=>{
      const family=auditFamily(account.plataforma),mail=email(account.correo);
      const key=mail?`${family}|${mail}`:`${family}|__sin_correo_inventario_${account.id||i}`;
      const g=ensureGroup(family,mail,key);
      g.rawPlatforms.add(canonPlatform(account.plataforma));g.inventoryAccounts.push(account);g.accountIds.push(account.id||'');
      if(!g.clave&&account.clave!=null)g.clave=String(account.clave);
      g.capacidad+=Math.max(0,Number(account.capacidad)||0);g.disponibles+=Math.max(0,Number(account.disponibles)||0);
      if(!g.estado&&account.estado)g.estado=String(account.estado);
      (account.clientes||[]).forEach((p)=>g.invClients.push({...p,_accountId:account.id||'',_family:family,_email:mail}));
    });

    allServices.forEach((s)=>{
      const key=s._email?`${s._family}|${s._email}`:`${s._family}|__sin_cuenta_clientes`;
      const g=ensureGroup(s._family,s._email,key);g.rawPlatforms.add(canonPlatform(s.plataforma||s.plataformaLabel));g.services.push(s);
      if(!g.clave&&s.clave!=null)g.clave=String(s.clave);
    });

    const itemByRow=new Map((analysis?.items||[]).filter((x)=>x.row).map((x)=>[x.row,x]));
    const allExcelRows=[];
    (analysis?.sheets||[]).forEach((sheet)=>{
      (sheet.rows||[]).filter((r)=>r.name||r.tel).forEach((row)=>{
        const item=itemByRow.get(row)||null;
        const family=excelAuditFamily(sheet,row,item,src);
        const mail=excelEmail(row.accountEmail);
        const entry={
          key:`${row.sheet}|${row.row}`,sheet:row.sheet,row:row.row,family,email:mail,
          name:String(row.name||'').trim(),phone:phone(row.tel),profile:String(row.profile||'').trim(),pin:String(row.pin||'').trim(),
          date:dateKey(row.expiry),password:String(row.accountPassword||'').trim(),item
        };
        allExcelRows.push(entry);
        const key=mail?`${family}|${mail}`:`${family}|__excel_${norm(row.sheet)}_${row.row}`;
        const g=ensureGroup(family,mail,key);g.rawPlatforms.add(family);g.excelRows.push(entry);g.excelSheets.add(row.sheet);
        if(!g.clave&&entry.password)g.clave=entry.password;
      });
    });

    const revisions=new Map((state.meta?.revisiones||[]).map((r)=>[String(r.accountKey||`${auditFamily(r.plataforma)}|${email(r.correo)}`),r]));
    const accounts=[];
    groups.forEach((g)=>{
      const used=new Set(),usedExcel=new Set(),roster=[];
      const takeExcel=(target)=>{
        const targetName=norm(target?.name),targetPhone=phone(target?.phone),targetProfile=norm(target?.profile);
        let best=-1,bestScore=0;
        g.excelRows.forEach((x,i)=>{
          if(usedExcel.has(i))return;
          let score=0;
          if(targetName&&norm(x.name)===targetName)score+=120;
          if(targetPhone&&x.phone===targetPhone)score+=105;
          if(targetProfile&&norm(x.profile)===targetProfile)score+=32;
          if(score>bestScore){best=i;bestScore=score;}
        });
        if(best<0)return null;usedExcel.add(best);return g.excelRows[best];
      };
      g.invClients.forEach((p,invIndex)=>{
        const name=norm(p.nombre),duplicate=(assignmentCounts.get(`${g.family}|${name}`)||0)>1;
        const matchIndex=g.services.findIndex((s,i)=>!used.has(i)&&name&&s._name===name);
        let service=null,status='solo_bodega',level='bad',detail=hasExcelAudit?'Está asignado en Bodega, pero no tiene servicio activo en Clientes ni fila coincidente en Excel.':'Está asignado en Bodega, pero no tiene servicio activo en Clientes.';
        if(matchIndex>=0){
          used.add(matchIndex);service=g.services[matchIndex];status='ok';level='ok';detail=hasExcelAudit?'Coincide entre Clientes, Bodega y Excel.':'Coincide entre Clientes y Bodega.';
          if(duplicate){status='duplicado';level='bad';detail='El cliente aparece asignado en más de una cuenta de esta plataforma.';}
          else if(isExpired(service.fecha)){status='vencido';level='warn';detail='El cliente coincide, pero su fecha está vencida.';}
        }else{
          const other=allServices.find((s)=>s._family===g.family&&name&&s._name===name);
          if(duplicate){status='duplicado';detail='La asignación está repetida en Bodega.';}
          else if(other){status='otra_cuenta';detail=`El servicio activo está registrado en ${other._email||'otra cuenta'}.`;service=other;}
        }
        const excel=takeExcel({name:p.nombre||service?.nombre,phone:service?._phone,profile:service?.perfil||p.slot});
        if(status==='ok'&&hasExcelAudit&&!excel){status='falta_excel';level='warn';detail='Coincide entre Clientes y Bodega, pero no aparece en el Excel cargado.';}
        else if(!service&&excel){status='excel_bodega';level='warn';detail='Aparece en Excel y Bodega, pero no tiene servicio activo en Clientes.';}
        roster.push({inv:p,service,excel,status,level,detail,name:p.nombre||service?.nombre||excel?.name||'Sin nombre',phone:service?._phone||excel?.phone||'',profile:service?.perfil||p.slot||excel?.profile||'',pin:service?.pinPerfil||p.pin||excel?.pin||'',date:service?._date||excel?.date||'',actualAccount:service?._email||'',invIndex});
      });
      g.services.forEach((service,i)=>{
        if(used.has(i))return;
        const excel=takeExcel({name:service.nombre,phone:service._phone,profile:service.perfil});
        const expired=isExpired(service.fecha);
        let status=expired?'vencido_sin_bodega':'falta_bodega';
        let detail=expired?'Servicio vencido y no asignado en Bodega.':(excel?'Coincide entre Clientes y Excel, pero falta en Bodega.':(hasExcelAudit?'Cliente activo, pero falta tanto en Bodega como en el Excel cargado.':'Cliente activo en esta cuenta, pero falta en Bodega.'));
        if(hasExcelAudit&&!excel&&!expired)status='falta_excel_bodega';
        roster.push({inv:null,service,excel,status,level:expired?'bad':'warn',detail,name:service.nombre||excel?.name||'Sin nombre',phone:service._phone||excel?.phone||'',profile:service.perfil||excel?.profile||'',pin:service.pinPerfil||excel?.pin||'',date:service._date||excel?.date||'',actualAccount:service._email||''});
      });
      g.excelRows.forEach((excel,i)=>{
        if(usedExcel.has(i))return;
        const expired=isExpired(excel.date);
        roster.push({inv:null,service:null,excel,status:expired?'solo_excel_vencido':'solo_excel',level:expired?'bad':'warn',detail:expired?'Permanece en el Excel con fecha vencida, pero ya no está en Clientes ni Bodega.':'Está en el Excel, pero no aparece en Clientes ni en Bodega.',name:excel.name||`Sin nombre · fila ${excel.row}`,phone:excel.phone||'',profile:excel.profile||'',pin:excel.pin||'',date:excel.date||'',actualAccount:''});
      });

      const missingInventory=!g.inventoryAccounts.length;
      const inventoryPlatformCounts={};
      g.inventoryAccounts.forEach((a)=>{const p=canonPlatform(a.plataforma);inventoryPlatformCounts[p]=(inventoryPlatformCounts[p]||0)+1;});
      const duplicateDocs=Object.values(inventoryPlatformCounts).some((n)=>n>1);
      const overCapacity=!!g.capacidad&&Math.max(g.invClients.length,g.services.length,g.excelRows.length)>g.capacidad;
      const rosterIssues=roster.filter((r)=>r.status!=='ok').length;
      const revisionKey=g.email?`${g.family}|${g.email}`:'';
      const revision=revisionKey?revisions.get(revisionKey)||null:null;
      const missingPassword=!String(g.clave||'').trim();
      const recordedIncident=revision?.resultado==='incidencia';
      const internalIssueCount=rosterIssues+Number(missingInventory)+Number(duplicateDocs)+Number(overCapacity)+Number(!g.email)+Number(missingPassword);
      const issueCount=internalIssueCount+Number(recordedIncident);
      const reviewAge=revision?daysSince(revision.revisadoAt):99999;
      const reviewDataChanged=!!revision&&(Number(revision.clientesEsperados)!==roster.length||Number(revision.diferencias)!==internalIssueCount);
      const reviewDue=!revision||reviewAge>=15||reviewDataChanged;
      const occupied=g.inventoryAccounts.length?g.invClients.length:(g.services.length||g.excelRows.length);
      const maxExcelProfile=Math.max(0,...g.excelRows.map((x)=>Number(x.profile)||0));
      const capacity=g.capacidad||Math.max(occupied,maxExcelProfile);
      accounts.push({
        ...g,rawPlatforms:[...g.rawPlatforms],excelSheets:[...g.excelSheets],roster,missingInventory,duplicateDocs,overCapacity,rosterIssues,issueCount,
        missingPassword,recordedIncident,internalIssueCount,revisionKey,revision,reviewAge,reviewDataChanged,reviewDue,occupied,capacity,free:Math.max(0,capacity-occupied),clean:issueCount===0
      });
    });

    accounts.sort((a,b)=>a.platform.localeCompare(b.platform)||Number(b.issueCount>0)-Number(a.issueCount>0)||String(a.email).localeCompare(String(b.email)));
    const clients=new Set(allServices.map(s=>s.clienteId||`${s._name}|${s._phone}`));
    const platforms={},platformRows={};accounts.forEach(a=>{platforms[a.family]=(platforms[a.family]||0)+1;platformRows[a.family]=(platformRows[a.family]||0)+a.roster.length;});
    return {
      accounts,platforms,platformRows,
      metrics:{clientes:clients.size,servicios:allServices.length,filasExcel:allExcelRows.length,registros:accounts.reduce((n,a)=>n+a.roster.length,0),cuentas:accounts.length,limpias:accounts.filter(a=>a.clean).length,conProblemas:accounts.filter(a=>a.issueCount>0).length,pendientes15:accounts.filter(a=>a.reviewDue).length}
    };
  }

  function parseWorkbook(workbook,src){
    const sheets=[];
    const excelRows=[];
    workbook.worksheets.forEach((ws)=>{
      if(['revision','__sublichat_ids'].includes(norm(ws.name).replace(/[^a-z0-9_]/g,'')))return;
      const platforms=platformsForSheet(ws.name);if(!platforms.length)return;
      const h=findHeader(ws);if(!h)return;
      const rows=[];
      let currentAccount='',currentPassword='';
      const end=Math.min(Math.max(ws.rowCount||h.row+1,h.row+1),2200);
      for(let r=h.row+1;r<=end;r++){
        const row=ws.getRow(r);
        const directEmail=h.email?excelEmail(valueText(row.getCell(h.email).value)):'';
        const directPassword=h.password?String(valueText(row.getCell(h.password).value)||'').trim():'';
        if(directEmail){currentAccount=directEmail;currentPassword=directPassword;}
        const name=h.name?String(valueText(row.getCell(h.name).value)||'').trim():'';
        const tel=h.phone?phone(valueText(row.getCell(h.phone).value)):'';
        const profile=h.profile?String(valueText(row.getCell(h.profile).value)||'').trim():'';
        const record={
          ws,sheet:ws.name,row:r,header:h,platforms,accountEmail:directEmail||currentAccount,directEmail,
          accountPassword:directPassword||currentPassword,
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
    state.analysis=parseWorkbook(workbook,src);state.accountAudit=null;
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

  const ROSTER_STATUS={
    ok:{label:'Coincide',icon:'✅',tone:'ok'},
    vencido:{label:'Vencido',icon:'⏰',tone:'warn'},
    duplicado:{label:'Duplicado',icon:'⛔',tone:'bad'},
    solo_bodega:{label:'Solo en Bodega',icon:'📦',tone:'bad'},
    otra_cuenta:{label:'Está en otra cuenta',icon:'↔️',tone:'bad'},
    falta_bodega:{label:'Falta en Bodega',icon:'⚠️',tone:'warn'},
    falta_excel:{label:'Falta en Excel',icon:'📘',tone:'warn'},
    excel_bodega:{label:'Excel + Bodega',icon:'🔄',tone:'warn'},
    falta_excel_bodega:{label:'Solo en Clientes',icon:'⚠️',tone:'warn'},
    solo_excel:{label:'Solo en Excel',icon:'📘',tone:'warn'},
    solo_excel_vencido:{label:'Excel vencido',icon:'🗑️',tone:'bad'},
    vencido_sin_bodega:{label:'Vencido y sin Bodega',icon:'🗑️',tone:'bad'}
  };

  function accountDateTime(v){
    const d=new Date(v||'');if(isNaN(d))return '—';
    try{return d.toLocaleString('es-HN',{timeZone:'America/Tegucigalpa',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}
    catch(_){return d.toLocaleString('es-HN');}
  }

  function filteredAccounts(){
    const q=norm(state.accountQuery);
    return (state.accountAudit?.accounts||[]).filter((a)=>{
      if(state.accountPlatform!=='all'&&a.family!==state.accountPlatform)return false;
      if(state.accountStatus==='problems'&&!a.issueCount)return false;
      if(state.accountStatus==='due'&&!a.reviewDue)return false;
      if(state.accountStatus==='clean'&&!a.clean)return false;
      if(state.accountStatus==='incident'&&!a.recordedIncident)return false;
      if(state.accountStatus==='missing'&&!a.missingInventory)return false;
      if(!q)return true;
      return norm([a.platform,a.email,...a.roster.flatMap((r)=>[r.name,r.phone,r.profile,r.pin,r.actualAccount])].join(' ')).includes(q);
    });
  }

  function accountIssuesHtml(a){
    const list=[];
    if(!a.email)list.push('⛔ Sin correo');
    if(a.missingPassword)list.push('🔑 Sin clave');
    if(a.missingInventory)list.push('📦 Falta en Bodega');
    if(a.duplicateDocs)list.push('📦 Cuenta repetida');
    if(a.overCapacity)list.push('🚨 Sobre capacidad');
    if(a.rosterIssues)list.push(`👥 ${a.rosterIssues} diferencia${a.rosterIssues===1?'':'s'}`);
    if(a.recordedIncident)list.push('⚠️ Incidencia manual abierta');
    if(a.reviewDataChanged)list.push('🔄 Cambió desde la última revisión');
    if(!list.length)list.push('✅ Base interna coincide');
    return list.map((x)=>`<span class="cm-account-issue ${a.issueCount?'bad':'ok'}">${esc(x)}</span>`).join('');
  }

  function rosterRowHtml(r,accountIndex,rowIndex){
    const s=ROSTER_STATUS[r.status]||{label:r.status||'Revisar',icon:'⚠️',tone:'bad'};
    const rawProfile=String(r.profile||'').trim();
    const profile=rawProfile?(/^perfil\b/i.test(rawProfile)?rawProfile:`Perfil ${rawProfile}`):'Perfil sin indicar';
    const sources=[r.excel?`📘 Excel · ${r.excel.sheet} fila ${r.excel.row}`:'',r.service?'👤 Clientes':'',r.inv?'📦 Bodega':''].filter(Boolean);
    return `<div class="cm-roster-row ${s.tone}" title="${esc(r.detail||'')}">
      <div class="cm-roster-slot"><b>${esc(profile)}</b><small>${r.pin?`PIN ${esc(r.pin)}`:'Sin PIN'}</small><div class="cm-roster-sources">${sources.map((x)=>`<i>${esc(x)}</i>`).join('')}</div></div>
      <button class="cm-roster-client" data-cm-audit-client="${accountIndex}:${rowIndex}" title="Abrir este cliente"><b>${esc(r.name||'Sin nombre')}</b><small>${esc(r.phone||'Sin teléfono')}</small></button>
      <div class="cm-roster-date"><b>${esc(dateLabel(r.date))}</b><small>Vencimiento</small></div>
      <div class="cm-roster-result"><span class="cm-roster-status ${s.tone}">${s.icon} ${esc(s.label)}</span><small>${esc(r.detail||'')}</small></div>
    </div>`;
  }

  function accountCardHtml(a,i){
    const revealed=state.revealedAccounts.has(a.key);
    const review=a.revision;
    const saving=state.reviewSavingKey===a.key;
    const savedCorrect=review?.resultado==='correcta'&&!a.reviewDue;
    const okLabel=saving?'⏳ Guardando…':(savedCorrect?'✅ Coincidencia guardada':'✅ Revisada: coincide');
    const feedback=state.accountFeedback?.key===a.key?state.accountFeedback:null;
    const reviewText=!review?'Sin revisión manual':(review.resultado==='incidencia'?`Incidencia · ${accountDateTime(review.revisadoAt)}`:`Revisada · ${accountDateTime(review.revisadoAt)}`);
    const reviewTone=!review||a.reviewDue?'due':(review.resultado==='incidencia'?'bad':'ok');
    const reviewAge=!review?'Nunca revisada':(a.reviewDataChanged?'Cambió la asignación · toca revisar':(a.reviewDue?`Hace ${a.reviewAge} días · toca revisar`:`Hace ${a.reviewAge} día${a.reviewAge===1?'':'s'}`));
    const password=a.clave?revealed?esc(a.clave):'••••••••':'Sin clave guardada';
    const roster=a.roster.map((r,j)=>rosterRowHtml(r,i,j)).join('');
    return `<article class="cm-account-card ${a.issueCount?'has-issues':'is-clean'}">
      <div class="cm-account-head">
        <div><span class="cm-platform cm-account-platform">${esc(a.platform)}</span><h4>${esc(a.email||'CUENTA SIN CORREO')}</h4><small>${a.excelRows.length} fila${a.excelRows.length===1?'':'s'} Excel · ${a.inventoryAccounts.length} registro${a.inventoryAccounts.length===1?'':'s'} en Bodega · ${a.services.length} servicio${a.services.length===1?'':'s'} activo${a.services.length===1?'':'s'}</small></div>
        <span class="cm-review-state ${reviewTone}"><b>${esc(reviewText)}</b><small>${esc(reviewAge)}</small></span>
      </div>
      <div class="cm-account-issues">${accountIssuesHtml(a)}</div>
      <div class="cm-credentials">
        <div class="cm-credential"><span>Correo de acceso</span><code>${esc(a.email||'—')}</code><button class="cm-copy" data-cm-copy-email="${i}" ${a.email?'':'disabled'}>📋 Copiar</button></div>
        <div class="cm-credential"><span>Clave de la cuenta</span><code class="cm-secret ${revealed?'shown':''}">${password}</code><div class="cm-secret-actions"><button class="cm-copy" data-cm-reveal-account="${i}" ${a.clave?'':'disabled'}>${revealed?'🙈 Ocultar':'👁️ Ver'}</button><button class="cm-copy" data-cm-copy-password="${i}" ${a.clave?'':'disabled'}>📋 Copiar</button></div></div>
      </div>
      <div class="cm-account-capacity">
        <span><b>${a.occupied}</b> ocupados</span><span><b>${a.free}</b> libres</span><span><b>${a.capacity||'—'}</b> capacidad</span><span><b>${a.roster.length}</b> filas esperadas</span>
      </div>
      <div class="cm-roster-head"><div><b>Clientes/perfiles que deben estar en esta cuenta</b><small>Abra ${esc(a.platform)} y compare esta lista con los perfiles reales.</small></div><button class="cm-btn" data-cm-open-audit="${i}">📦 Abrir en Bodega</button></div>
      <div class="cm-roster">${roster||'<div class="cm-empty cm-roster-empty">Esta cuenta no tiene clientes asignados.</div>'}</div>
      ${review?.nota?`<div class="cm-review-note"><b>Última nota:</b> ${esc(review.nota)}</div>`:''}
      ${feedback?`<div class="cm-review-note ${esc(feedback.type)}"><b>${esc(feedback.text)}</b></div>`:''}
      <div class="cm-account-review">
        <div><b>Revisión real del proveedor</b><small>La lista reúne Excel + Clientes + Bodega. Entre a la cuenta, compruebe que no haya perfiles de más y después marque el resultado.</small></div>
        <div class="cm-account-review-actions"><button class="cm-btn good" data-cm-review-ok="${esc(a.key)}" ${state.busy?'disabled':''}>${okLabel}</button><button class="cm-btn warn" data-cm-review-issue="${esc(a.key)}" ${state.busy?'disabled':''}>⚠️ Registrar incidencia</button></div>
      </div>
    </article>`;
  }

  function accountAuditHtml(){
    const audit=state.accountAudit;
    if(!audit?.accounts?.length)return `<section class="cm-panel"><div class="cm-empty">Todavía no cargaron las cuentas de Firebase. Presione <b>Actualizar base</b>.</div></section>`;
    const platforms=[['all','Todas',audit.accounts.length,audit.metrics.registros],...Object.entries(audit.platforms).sort((a,b)=>auditPlatformLabel(a[0]).localeCompare(auditPlatformLabel(b[0]))).map(([k,n])=>[k,auditPlatformLabel(k),n,audit.platformRows[k]||0])];
    const statuses=[['all','Todas'],['problems','Con diferencias'],['due','Toca revisar (15 días)'],['incident','Incidencias'],['missing','Fuera de Bodega'],['clean','Base interna correcta']];
    const all=filteredAccounts();state.accountVisible=all.slice(0,Math.max(1,state.accountLimit||220));
    return `<section class="cm-panel cm-accounts-panel">
      <div class="cm-panel-head"><div><h3>📧 Cuentas y perfiles por correo</h3><p>Esta es su mesa de revisión: correo, clave y los clientes que deberían existir dentro de cada cuenta.</p></div><span class="cm-template-state ${audit.metrics.conProblemas?'':'ok'}">${audit.metrics.conProblemas?audit.metrics.conProblemas+' cuentas con diferencias':'✅ Base interna correcta'}</span></div>
      <div class="cm-audit-callout"><b>Cómo usarla:</b> elija Disney+, abra cada correo en Disney y compare los perfiles reales con la lista de Sublichat. Si coincide, márquela revisada; si encuentra un perfil adicional o faltante, registre la incidencia.</div>
      <div class="cm-platform-filters">${platforms.map(([k,l,n,r])=>`<button class="cm-platform-filter ${state.accountPlatform===k?'on':''}" data-cm-audit-platform="${esc(k)}"><b>${esc(l)}</b><span>${n} ctas · ${r} filas</span></button>`).join('')}</div>
      <div class="cm-toolbar cm-account-toolbar"><label class="cm-search"><span>⌕</span><input id="cmAccountSearch" value="${esc(state.accountQuery)}" placeholder="Correo, cliente, teléfono, perfil o PIN…"></label><div class="cm-filters">${statuses.map(([k,l])=>`<button class="cm-filter ${state.accountStatus===k?'on':''}" data-cm-audit-status="${k}">${l}</button>`).join('')}</div></div>
      <div class="cm-account-count">Mostrando <b>${state.accountVisible.length}</b> de <b>${all.length}</b> cuentas encontradas.</div>
      <div class="cm-account-grid">${state.accountVisible.map(accountCardHtml).join('')||'<div class="cm-empty cm-account-no-results">No hay cuentas con este filtro.</div>'}</div>
      ${all.length>state.accountVisible.length?`<div class="cm-load-more"><button class="cm-btn primary" data-cm-action="show-all-accounts">Mostrar las ${all.length} cuentas</button><small>El conteo ya incluye todas; se cargan por partes para no trabar la computadora.</small></div>`:''}
    </section>`;
  }

  function kpisHtml(){
    const m=state.accountAudit?.metrics||{};
    return `<div class="cm-kpis">
      <div class="cm-kpi"><b>${m.clientes??'—'}</b><span>Clientes actuales</span></div>
      <div class="cm-kpi"><b>${m.servicios??'—'}</b><span>Servicios en Sublichat</span></div>
      <div class="cm-kpi"><b>${m.filasExcel??'—'}</b><span>Filas recuperadas del Excel</span></div>
      <div class="cm-kpi"><b>${m.cuentas??'—'}</b><span>Correos/cuentas agrupados</span></div>
      <div class="cm-kpi ${m.conProblemas?'bad':'good'}"><b>${m.conProblemas??'—'}</b><span>Cuentas con diferencias</span></div>
      <div class="cm-kpi ${m.pendientes15?'warn':'good'}"><b>${m.pendientes15??'—'}</b><span>Revisión quincenal pendiente</span></div>
    </div>`;
  }

  function templateHtml(){
    const t=state.meta?.plantilla;
    return `<section class="cm-panel">
      <div class="cm-panel-head"><div><h3>📘 Formato descargable del respaldo</h3><p>El Excel anterior queda únicamente como formato de salida. Su trabajo diario se hace arriba con la información viva de Firebase.</p></div><span class="cm-template-state ${t?'ok':''}">${t?'✅ Formato activo':'⚠️ Falta formato'}</span></div>
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
    if(!state.analysis)return `<details class="cm-panel cm-details"><summary><span><b>📎 Cruce histórico con el Excel</b><small>Opcional: cargue el formato y presione “Revisar ahora” para comparar también las filas antiguas.</small></span><i>Ver</i></summary></details>`;
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
    return `<details class="cm-panel cm-details">
      <summary><span><b>📎 Cruce histórico con el Excel</b><small>Comparación opcional entre el formato antiguo, Clientes y Bodega.</small></span><i>${state.analysis.metrics.revision?state.analysis.metrics.revision+' diferencias':'Todo coincide'} · Ver</i></summary>
      <div class="cm-details-body">
      <div class="cm-toolbar"><label class="cm-search"><span>⌕</span><input id="cmSearch" value="${esc(state.query)}" placeholder="Cliente, teléfono, plataforma o cuenta…"></label><div class="cm-filters">${filters.map(([k,l])=>`<button class="cm-filter ${state.filter===k?'on':''}" data-cm-filter="${k}">${l}</button>`).join('')}</div></div>
      <div class="cm-table-wrap">${rows?`<table class="cm-table"><thead><tr><th>Cliente</th><th>Plataforma</th><th>Cuenta Excel</th><th>Cuenta Sublichat</th><th>Cuenta inventario</th><th>Fecha Excel</th><th>Fecha actual</th><th>Resultado</th><th>Acciones</th></tr></thead><tbody>${rows}</tbody></table>`:'<div class="cm-empty">No hay registros con este filtro.</div>'}</div>
      ${all.length>state.visible.length?`<div class="cm-hint">Mostrando 300 de ${all.length} resultados. Use la búsqueda para encontrar un cliente específico.</div>`:''}
      <div class="cm-actions" style="margin-top:12px"><button class="cm-btn good" data-cm-action="generate-download">📥 Generar y descargar Excel</button><button class="cm-btn" data-cm-action="save-backup">🛡️ Guardar respaldo sin descargar</button></div>
      </div>
    </details>`;
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
    if(!state.accountAudit)state.accountAudit=buildAccountAudit(source(),state.analysis);
    const expanded=!!document.fullscreenElement||document.getElementById('screen-control-cuentas')?.classList.contains('cm-control-expanded');
    host.innerHTML=`<div class="cm-shell" data-build="${BUILD}">
      <header class="cm-hero"><div class="cm-title"><div class="cm-title-icon">🗃️</div><div><h2>Control Maestro</h2><p>Conciliación completa por correo entre Excel, Clientes y Bodega.</p></div></div><div class="cm-hero-actions"><button class="cm-btn cm-expand" data-cm-action="toggle-fullscreen">${expanded?'↙️ Salir de pantalla completa':'⛶ Pantalla completa'}</button><span class="cm-private">🔒 Solo Sublicuentas</span></div></header>
      ${kpisHtml()}${accountAuditHtml()}${templateHtml()}${reviewHtml()}${backupsHtml()}
    </div>`;
    bind();
  }

  function bind(){
    const host=root();if(!host)return;
    host.querySelectorAll('[data-cm-action]').forEach(b=>b.onclick=()=>handleAction(b.dataset.cmAction));
    const file=host.querySelector('#cmTemplateFile');if(file)file.onchange=()=>uploadTemplate(file.files?.[0]);
    host.querySelectorAll('[data-cm-audit-platform]').forEach(b=>b.onclick=()=>{state.accountPlatform=b.dataset.cmAuditPlatform;state.accountLimit=state.accountPlatform==='all'?220:5000;render();});
    host.querySelectorAll('[data-cm-audit-status]').forEach(b=>b.onclick=()=>{state.accountStatus=b.dataset.cmAuditStatus;state.accountLimit=1200;render();});
    const aq=host.querySelector('#cmAccountSearch');if(aq)aq.oninput=()=>{state.accountQuery=aq.value;state.accountLimit=5000;render();setTimeout(()=>{const el=document.getElementById('cmAccountSearch');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}},0);};
    host.querySelectorAll('[data-cm-reveal-account]').forEach(b=>b.onclick=()=>toggleAccountSecret(Number(b.dataset.cmRevealAccount)));
    host.querySelectorAll('[data-cm-copy-email]').forEach(b=>b.onclick=()=>copyAccountValue(Number(b.dataset.cmCopyEmail),'email'));
    host.querySelectorAll('[data-cm-copy-password]').forEach(b=>b.onclick=()=>copyAccountValue(Number(b.dataset.cmCopyPassword),'password'));
    host.querySelectorAll('[data-cm-open-audit]').forEach(b=>b.onclick=()=>openAuditAccount(Number(b.dataset.cmOpenAudit)));
    host.querySelectorAll('[data-cm-audit-client]').forEach(b=>b.onclick=()=>openAuditClient(b.dataset.cmAuditClient));
    host.querySelectorAll('[data-cm-review-ok]').forEach(b=>b.onclick=()=>saveAccountReview(b.dataset.cmReviewOk,'correcta'));
    host.querySelectorAll('[data-cm-review-issue]').forEach(b=>b.onclick=()=>saveAccountReview(b.dataset.cmReviewIssue,'incidencia'));
    host.querySelectorAll('[data-cm-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.cmFilter;render();});
    const q=host.querySelector('#cmSearch');if(q)q.oninput=()=>{state.query=q.value;render();setTimeout(()=>document.getElementById('cmSearch')?.focus(),0);};
    host.querySelectorAll('[data-cm-client]').forEach(b=>b.onclick=()=>openClient(state.visible[Number(b.dataset.cmClient)]));
    host.querySelectorAll('[data-cm-account]').forEach(b=>b.onclick=()=>openAccount(state.visible[Number(b.dataset.cmAccount)]));
    host.querySelectorAll('[data-cm-download]').forEach(b=>b.onclick=()=>downloadStored(b.dataset.cmDownload));
    host.querySelectorAll('[data-cm-restore]').forEach(b=>b.onclick=()=>restoreStored(b.dataset.cmRestore));
  }

  function toggleAccountSecret(index){
    const a=state.accountVisible[index];if(!a?.clave)return;
    if(state.revealedAccounts.has(a.key))state.revealedAccounts.delete(a.key);else state.revealedAccounts.add(a.key);
    render();
  }

  async function copyText(value,label){
    if(!value)return setStatus(`No hay ${label} para copiar.`,'error');
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(String(value));
      else{
        const area=document.createElement('textarea');area.value=String(value);area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
      }
      setStatus(`✅ ${label} copiado.`,'good');
    }catch(_){setStatus(`No se pudo copiar ${label}. Mantenga presionado sobre el dato para copiarlo.`,'error');}
  }

  function copyAccountValue(index,type){
    const a=state.accountVisible[index];if(!a)return;
    return copyText(type==='password'?a.clave:a.email,type==='password'?'Clave':'Correo');
  }

  function openAuditAccount(index){
    const a=state.accountVisible[index];if(!a)return;
    openAccount({inventoryAccount:a.email,liveAccount:a.email,platform:a.platform});
  }

  function openAuditClient(pointer){
    const [ai,ri]=String(pointer||'').split(':').map(Number);
    const r=state.accountVisible[ai]?.roster?.[ri];if(!r)return;
    openClient(r.service||{name:r.name,phone:r.phone});
  }

  function accountByKey(key){
    const wanted=String(key||'');
    return state.accountVisible.find((a)=>String(a.key||'')===wanted)||(state.accountAudit?.accounts||[]).find((a)=>String(a.key||'')===wanted)||null;
  }

  function mergeAccountRevision(revision){
    if(!revision)return;
    const revisionKey=String(revision.accountKey||`${auditFamily(revision.plataforma)}|${email(revision.correo)}`);
    const anteriores=Array.isArray(state.meta?.revisiones)?state.meta.revisiones:[];
    state.meta={...(state.meta||{}),revisiones:[revision,...anteriores.filter((r)=>String(r.accountKey||`${auditFamily(r.plataforma)}|${email(r.correo)}`)!==revisionKey)]};
    state.accountAudit=null;
  }

  async function saveAccountReview(accountKey,result){
    const a=accountByKey(accountKey);if(!a||state.busy)return;
    if(!a.email)return setStatus('Esta cuenta no tiene correo; corríjala primero en Bodega.','error');
    let nota='';
    if(result==='incidencia'){
      nota=prompt('Escriba qué encontró en la cuenta (por ejemplo: “hay un perfil extra llamado Juan”):','')??'';
      if(!String(nota).trim())return;
    }
    state.busy=true;state.reviewSavingKey=a.key;
    state.accountFeedback={key:a.key,type:'saving',text:result==='incidencia'?'Guardando incidencia en Firebase…':'Guardando revisión en Firebase…'};
    state.status=state.accountFeedback.text;state.statusType='';render();
    try{
      const saved=await api({accion:'control_guardar_revision_cuenta',accountId:a.accountIds.filter(Boolean).join(','),plataforma:a.family,correo:a.email,resultado,nota,clientesEsperados:a.roster.length,diferencias:a.internalIssueCount});
      if(!saved.revision)throw new Error('Firebase respondió sin confirmar la revisión.');
      mergeAccountRevision(saved.revision);
      const text=result==='incidencia'?'⚠️ Incidencia guardada en Firebase.':'✅ Revisión del proveedor guardada en Firebase. Las diferencias de Excel o Bodega seguirán visibles hasta corregirlas; esta revisión volverá a solicitarse dentro de 15 días.';
      state.accountFeedback={key:a.key,type:result==='incidencia'?'err':'good',text};state.status=text;state.statusType='good';
    }catch(e){
      const text='⚠️ '+(e.message||'No se pudo guardar la revisión.');
      state.accountFeedback={key:a.key,type:'err',text};state.status=text;state.statusType='error';
    }finally{state.busy=false;state.reviewSavingKey='';render();}
  }

  async function refreshMeta(){
    state.loading=true;render();
    try{state.meta=await api({accion:'control_estado'});state.accountAudit=null;state.status='';state.statusType='';}
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
      state.templateBase64=bufferToBase64(buffer);state.analysis=null;state.accountAudit=null;
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
      state.analysis=out.analysis;state.accountAudit=null;render();
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
    try{await api({accion:'control_restaurar_plantilla',id});state.templateBase64='';state.analysis=null;state.accountAudit=null;await refreshMeta();setStatus('✅ Respaldo restaurado como plantilla.','good');setTimeout(()=>runReview(true),80);}
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

  async function toggleFullscreen(){
    const screen=document.getElementById('screen-control-cuentas');if(!screen)return;
    try{
      if(document.fullscreenElement){await document.exitFullscreen();screen.classList.remove('cm-control-expanded');document.body.classList.remove('cm-control-no-scroll');}
      else if(screen.requestFullscreen){await screen.requestFullscreen();}
      else{screen.classList.toggle('cm-control-expanded');document.body.classList.toggle('cm-control-no-scroll',screen.classList.contains('cm-control-expanded'));}
    }catch(_){screen.classList.toggle('cm-control-expanded');document.body.classList.toggle('cm-control-no-scroll',screen.classList.contains('cm-control-expanded'));}
    render();
  }

  async function handleAction(action){
    if(action==='toggle-fullscreen')return toggleFullscreen();
    if(action==='show-all-accounts'){state.accountLimit=Number.MAX_SAFE_INTEGER;render();return;}
    if(action==='review')return runReview(true);
    if(action==='refresh-data'){
      if(typeof window.sublichatControlReload!=='function')return setStatus('No encontré la función para actualizar la base.','error');
      state.busy=true;setStatus('Actualizando clientes e inventario desde la base…','');
      try{await window.sublichatControlReload();state.analysis=null;state.accountAudit=null;setStatus(state.meta?.plantilla?'✅ Base actualizada. Ejecutando cruce con el Excel…':'✅ Base actualizada desde Firebase.','good');}
      catch(e){setStatus('⚠️ '+(e.message||'No se pudo actualizar.'),'error');}
      finally{state.busy=false;render();}
      if(state.meta?.plantilla)return runReview(false);
      return;
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
    else{state.accountAudit=null;render();}
    if(state.meta?.plantilla&&!state.analysis&&!state.busy)runReview(false);
  }

  function install(){
    if(state.installed)return;state.installed=true;
    document.addEventListener('click',(ev)=>{if(ev.target?.closest?.('[data-screen="control-cuentas"]'))setTimeout(boot,90);},true);
    const observer=new MutationObserver(()=>{if(screenActive()&&!state.loading)boot();});
    const screen=document.getElementById('screen-control-cuentas');if(screen)observer.observe(screen,{attributes:true,attributeFilter:['class']});
    document.addEventListener('fullscreenchange',()=>{if(screenActive())render();});
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
