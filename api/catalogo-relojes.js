const admin = require('firebase-admin');

function credentialFrom(prefix=''){
  const projectId=process.env[prefix+'FIREBASE_PROJECT_ID'];
  const clientEmail=process.env[prefix+'FIREBASE_CLIENT_EMAIL'];
  let privateKey=process.env[prefix+'FIREBASE_PRIVATE_KEY']||'';
  privateKey=String(privateKey).replace(/\\n/g,'\n');
  if(!projectId||!clientEmail||!privateKey)return null;
  return {projectId,clientEmail,privateKey};
}
function getAuthApp(){
  const existing=admin.apps.find(a=>a.name==='[DEFAULT]');if(existing)return existing;
  const cred=credentialFrom('');if(!cred)throw new Error('Faltan variables Firebase de Sublichat.');
  return admin.initializeApp({credential:admin.credential.cert(cred)});
}
function getCatalogDb(){
  const dedicated=credentialFrom('CATALOGO_');
  if(!dedicated){
    if(String(process.env.CATALOGO_USE_SUBLICHAT_FIREBASE||'')==='1'){getAuthApp();return admin.firestore();}
    throw new Error('Catálogo Relojes no está enlazado. Configure CATALOGO_REMOTE_URL + CATALOGO_SYNC_SECRET (recomendado) o las credenciales CATALOGO_FIREBASE_* del catálogo.');
  }
  let app=admin.apps.find(a=>a.name==='catalogo-relojes');
  if(!app)app=admin.initializeApp({credential:admin.credential.cert(dedicated)},'catalogo-relojes');
  return app.firestore();
}
const clean=(v,max=500)=>String(v==null?'':v).replace(/[\u0000-\u001F]/g,' ').trim().slice(0,max);
const norm=v=>clean(v,120).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
function editorKind(user){const u=norm(user&&(user.usuario||user.name||''));if(['sublicuentas','naara'].includes(u))return'admin';if(['relojes','libni'].includes(u))return'relojes';return'';}
async function requireEditor(req,res){
  const auth=clean(req.headers.authorization||'',4000),token=auth.startsWith('Bearer ')?auth.slice(7).trim():'';
  if(!token){res.status(401).json({ok:false,error:'Sesión requerida.'});return null;}
  try{const user=await admin.auth().verifyIdToken(token);const kind=editorKind(user);if(!kind){res.status(403).json({ok:false,error:'Catálogo Relojes está disponible únicamente para Sublicuentas y Relojes.'});return null;}return{user,kind,actor:norm(user.usuario||user.name||kind)};}catch(_){res.status(401).json({ok:false,error:'Sesión inválida o vencida.'});return null;}
}
function id(v,fallback='item'){return clean(v,90).toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'')||fallback;}
const price=v=>v===''||v==null?null:(Number.isFinite(Number(v))?Math.max(0,Math.round(Number(v)*100)/100):null);
const availability=v=>['available','limited','on_request','paused','maintenance'].includes(v)?v:'available';
function option(o={},i=0){return{id:id(o.id,`opcion-${i+1}`),label:clean(o.label,120)||`Opción ${i+1}`,price:price(o.price),bonus:clean(o.bonus,120)};}
function plan(p={},i=0){return{id:id(p.id,`plan-${i+1}`),name:clean(p.name,120)||`Plan ${i+1}`,price:price(p.price),billingLabel:clean(p.billingLabel,60),active:p.active!==false,availability:availability(p.availability),badge:clean(p.badge,60),pointsCost:price(p.pointsCost),features:(Array.isArray(p.features)?p.features:[]).map(x=>clean(x,240)).filter(Boolean).slice(0,12),options:(Array.isArray(p.options)?p.options:[]).map(option)};}
function product(p={},i=0){return{id:id(p.id,`producto-${i+1}`),name:clean(p.name,120)||`Producto ${i+1}`,categoryId:id(p.categoryId,'streaming'),active:p.active!==false,storeEnabled:p.storeEnabled!==false,redemptionOnly:Boolean(p.redemptionOnly),availability:availability(p.availability),order:Number.isFinite(Number(p.order))?Number(p.order):i*10,accent:/^#[0-9a-f]{6}$/i.test(String(p.accent||''))?p.accent:'#E2231A',visual:clean(p.visual,20),imageUrl:clean(p.imageUrl,1200),summary:clean(p.summary,360),productFeatures:(Array.isArray(p.productFeatures)?p.productFeatures:[]).map(x=>clean(x,240)).filter(Boolean).slice(0,12),plans:(Array.isArray(p.plans)?p.plans:[]).map(plan)};}
function category(c={},i=0){return{id:id(c.id,`categoria-${i+1}`),name:clean(c.name,100)||`Categoría ${i+1}`,active:c.active!==false,order:Number.isFinite(Number(c.order))?Number(c.order):i*10,icon:clean(c.icon,30)};}
function promo(p={},i=0){return{id:id(p.id,`promocion-${i+1}`),title:clean(p.title,160)||`Promoción ${i+1}`,description:clean(p.description,420),active:p.active!==false,startsAt:clean(p.startsAt,40),endsAt:clean(p.endsAt,40),order:Number.isFinite(Number(p.order))?Number(p.order):i*10,accent:/^#[0-9a-f]{6}$/i.test(String(p.accent||''))?p.accent:'#E2231A',productIds:(Array.isArray(p.productIds)?p.productIds:[]).map(x=>id(x,'')).filter(Boolean).slice(0,20),features:(Array.isArray(p.features)?p.features:[]).map(x=>clean(x,220)).filter(Boolean).slice(0,10),options:(Array.isArray(p.options)?p.options:[]).map(option)};}
function normalizeCatalog(raw={}){
  const settings=raw.settings&&typeof raw.settings==='object'?raw.settings:{};
  const methods=Array.isArray(settings.paymentMethods)?settings.paymentMethods.map((m,i)=>({id:id(m&&m.id,`payment-${i+1}`),name:clean(m&&m.name,100)||`Método ${i+1}`,active:m&&m.active!==false,instructions:clean(m&&m.instructions,500),accountName:clean(m&&m.accountName,140),accountNumber:clean(m&&m.accountNumber,140)})):[];
  const discounts=Array.isArray(settings.comboDiscounts)?settings.comboDiscounts.map(d=>({itemCount:Math.max(2,Math.min(5,Number(d&&d.itemCount)||2)),amount:price(d&&d.amount)||0})):[];
  return{
    schemaVersion:1,
    catalogVersion:Math.max(1,Number(raw.catalogVersion)||1),
    updatedAt:clean(raw.updatedAt,60),
    categories:(Array.isArray(raw.categories)?raw.categories:[]).map(category),
    products:(Array.isArray(raw.products)?raw.products:[]).map(product),
    promotions:(Array.isArray(raw.promotions)?raw.promotions:[]).map(promo),
    settings:{
      brand:clean(settings.brand||settings.brandName||'Sublicuentas',100),
      slogan:clean(settings.slogan||settings.tagline||'',180),
      currency:clean(settings.currency||'HNL',10),
      currencyLabel:clean(settings.currencyLabel||'Lps.',20),
      locale:clean(settings.locale||'es-HN',20),
      whatsapp:clean(settings.whatsapp||'',30).replace(/\D/g,''),
      pointsPerConfirmedPurchase:price(settings.pointsPerConfirmedPurchase)??10,
      maxComboItems:Math.max(2,Math.min(5,Number(settings.maxComboItems)||5)),
      comboDiscounts:discounts,
      paymentMethods:methods
    }
  };
}
function remoteConfig(){
  const base=clean(process.env.CATALOGO_REMOTE_URL||process.env.CATALOGO_PUBLIC_URL||'',1000).replace(/\/$/,'');
  const secret=clean(process.env.CATALOGO_SYNC_SECRET||'',1000);
  return base&&secret?{url:`${base}/api/catalog-sync`,secret}:null;
}
async function remoteCall(action,payload={}){
  const cfg=remoteConfig();if(!cfg)return null;
  const r=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'application/json','x-catalog-sync-secret':cfg.secret},body:JSON.stringify({action,...payload})});
  const txt=await r.text();let data={};try{data=JSON.parse(txt)}catch(_){data={error:txt}};
  if(!r.ok||!data.ok)throw new Error(data.error||`Catálogo remoto HTTP ${r.status}`);
  return data;
}
function validate(c){
  const errors=[];const cats=new Set(c.categories.map(x=>x.id));const prod=new Set();
  c.products.forEach(p=>{if(prod.has(p.id))errors.push(`Producto duplicado: ${p.id}`);prod.add(p.id);if(!cats.has(p.categoryId))errors.push(`${p.name}: categoría inexistente.`);});
  c.promotions.forEach(p=>p.productIds.forEach(x=>{if(!prod.has(x))errors.push(`${p.title}: producto ${x} no existe.`);}));
  return errors;
}
async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Método no permitido.'});
  try{
    getAuthApp();const editor=await requireEditor(req,res);if(!editor)return;
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),action=clean(body.accion||body.action,40);
    const remote=remoteConfig();
    if(action==='cargar'&&remote){
      const data=await remoteCall('load');
      return res.status(200).json({ok:true,catalog:normalizeCatalog(data.catalog||{}),exists:true,editor:editor.kind,history:data.history||[],source:'remote'});
    }
    if(action==='guardar'&&remote){
      const catalog=normalizeCatalog(body.catalog||{}),errors=validate(catalog);if(errors.length)return res.status(400).json({ok:false,error:errors.join('\n')});
      const data=await remoteCall('save',{catalog,actor:editor.actor||editor.kind});
      return res.status(200).json({ok:true,catalog:normalizeCatalog(data.catalog||catalog),message:data.message||'Catálogo remoto publicado.',source:'remote'});
    }
    const db=getCatalogDb(),ref=db.collection(process.env.CATALOG_COLLECTION||'catalogo').doc(process.env.CATALOG_DOCUMENT||'publico');
    if(action==='cargar'){
      const [snap,hist]=await Promise.all([ref.get(),db.collection('catalogoHistorial').orderBy('createdAt','desc').limit(15).get().catch(()=>null)]);
      return res.status(200).json({ok:true,catalog:normalizeCatalog(snap.exists?snap.data():{}),exists:snap.exists,editor:editor.kind,source:'firestore',history:hist?hist.docs.map(d=>{const x=d.data()||{};return{id:d.id,actor:x.actor||'',catalogVersion:x.catalogVersion||0,productCount:x.productCount||0,promotionCount:x.promotionCount||0,createdAt:x.createdAt&&x.createdAt.toDate?x.createdAt.toDate().toISOString():''};}):[]});
    }
    if(action==='guardar'){
      const catalog=normalizeCatalog(body.catalog||{}),errors=validate(catalog);if(errors.length)return res.status(400).json({ok:false,error:errors.join('\n')});
      const before=await ref.get(),prev=before.exists?normalizeCatalog(before.data()):null;
      catalog.catalogVersion=Math.max(catalog.catalogVersion,prev?prev.catalogVersion:0)+1;catalog.updatedAt=new Date().toISOString();
      await db.runTransaction(async tx=>{tx.set(ref,catalog,{merge:false});const h=db.collection('catalogoHistorial').doc();tx.set(h,{actor:editor.actor||editor.kind,catalogVersion:catalog.catalogVersion,previousVersion:prev?prev.catalogVersion:null,productCount:catalog.products.length,promotionCount:catalog.promotions.length,createdAt:admin.firestore.FieldValue.serverTimestamp()});});
      return res.status(200).json({ok:true,catalog,message:`Catálogo publicado · versión ${catalog.catalogVersion}`,source:'firestore'});
    }
    return res.status(400).json({ok:false,error:'Acción no válida.'});
  }catch(e){return res.status(500).json({ok:false,error:String(e&&e.message||e||'Error interno.')});}
}
module.exports=handler;
