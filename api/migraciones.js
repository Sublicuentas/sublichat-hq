import admin from "firebase-admin";
function getApp(){
  if(admin.apps.length)return admin.app();
  const projectId=process.env.FIREBASE_PROJECT_ID,clientEmail=process.env.FIREBASE_CLIENT_EMAIL;let privateKey=process.env.FIREBASE_PRIVATE_KEY||"";privateKey=privateKey.replace(/\\n/g,"\n");
  if(!projectId||!clientEmail||!privateKey)throw new Error("Faltan credenciales Firebase.");
  return admin.initializeApp({credential:admin.credential.cert({projectId,clientEmail,privateKey})});
}
async function requireUser(req,res){const auth=String(req.headers.authorization||"");const token=auth.startsWith("Bearer ")?auth.slice(7).trim():"";if(!token){res.status(401).json({ok:false,error:"Sesión requerida."});return null;}try{return await admin.auth().verifyIdToken(token);}catch(_){res.status(401).json({ok:false,error:"Sesión inválida."});return null;}}
const norm=v=>String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
const isGeisell=v=>["geisell","geissel"].includes(norm(v));
const canonName=v=>isGeisell(v)?"Geisell":String(v||"").trim();
const canonNorm=v=>norm(v)==="geissel"?"geisell":norm(v);
function canonList(arr){const out=[],seen=new Set();for(const v of Array.isArray(arr)?arr:[]){const name=canonName(v),k=canonNorm(name);if(!name||!k||seen.has(k))continue;seen.add(k);out.push(name);}return out;}
function canonNormList(arr){const out=[],seen=new Set();for(const v of Array.isArray(arr)?arr:[]){const k=canonNorm(v);if(!k||seen.has(k))continue;seen.add(k);out.push(k);}return out;}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function isAdmin(user={}){const role=norm(user.role),u=norm(user.usuario||user.uid);return ["admin","administrador","sublicuentas","owner"].includes(role)||["naara","sublicuentas"].includes(u);}
async function commitOps(db,ops){for(let i=0;i<ops.length;i+=400){const batch=db.batch();ops.slice(i,i+400).forEach(({ref,patch})=>batch.set(ref,patch,{merge:true}));await batch.commit();}}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");if(req.method!=="POST")return res.status(405).json({ok:false,error:"Método no permitido."});
  try{
    const db=getApp().firestore(),user=await requireUser(req,res);if(!user)return;if(!isAdmin(user))return res.status(403).json({ok:false,error:"Solo Sublicuentas puede ejecutar migraciones."});
    const accion=String(req.body?.accion||"").trim();if(accion!=="unificar_geisell")return res.status(400).json({ok:false,error:"Migración no reconocida."});
    const markerRef=db.collection("migraciones_sistema").doc("geisell_nombre_20260924");const marker=await markerRef.get();
    if(marker.exists)return res.status(200).json({ok:true,yaAplicada:true,actualizados:0,revisados:Number(marker.data()?.revisados||0)});
    const snap=await db.collection("clientes").get(),ops=[];let revisados=0,actualizados=0,serviciosCorregidos=0;
    for(const doc of snap.docs){revisados++;const d=doc.data()||{},patch={};
      if(isGeisell(d.vendedor)&&d.vendedor!=="Geisell")patch.vendedor="Geisell";
      if((isGeisell(d.vendedor)||isGeisell(d.vendedor_norm))&&d.vendedor_norm!=="geisell")patch.vendedor_norm="geisell";
      if(Array.isArray(d.vendedores)){const x=canonList(d.vendedores);if(!same(x,d.vendedores))patch.vendedores=x;}
      if(Array.isArray(d.vendedores_norm)){const x=canonNormList(d.vendedores_norm);if(!same(x,d.vendedores_norm))patch.vendedores_norm=x;}
      // Si la lista normalizada no existía pero la lista visible sí contiene a Geisell,
      // créela ya unificada para que ningún filtro futuro vuelva a separar ambas grafías.
      if(!Array.isArray(d.vendedores_norm)&&Array.isArray(d.vendedores)){const x=canonNormList(d.vendedores);if(x.length)patch.vendedores_norm=x;}
      if(Array.isArray(d.servicios)){
        let changed=false;const servicios=d.servicios.map(s=>{if(!s||typeof s!=="object")return s;const n={...s};
          const geisellServicio=isGeisell(n.vendedor)||isGeisell(n.vendedor_norm);
          if(geisellServicio&&n.vendedor!=="Geisell"){n.vendedor="Geisell";changed=true;serviciosCorregidos++;}
          if(geisellServicio&&n.vendedor_norm!=="geisell"){n.vendedor_norm="geisell";changed=true;}
          return n;});if(changed)patch.servicios=servicios;
      }
      if(Object.keys(patch).length){patch.migracionGeisellAt=new Date().toISOString();ops.push({ref:doc.ref,patch});actualizados++;}
    }
    await commitOps(db,ops);
    await markerRef.set({accion,actualizados,revisados,serviciosCorregidos,usuario:String(user.usuario||user.uid||"sublicuentas"),createdAt:admin.firestore.FieldValue.serverTimestamp(),createdAtIso:new Date().toISOString()});
    return res.status(200).json({ok:true,actualizados,revisados,serviciosCorregidos});
  }catch(e){console.error("MIGRACION_GEISELL_ERROR",e);return res.status(500).json({ok:false,error:e.message||"Error interno."});}
}
