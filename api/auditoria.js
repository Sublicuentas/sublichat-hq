import admin from "firebase-admin";

function getApp(){
  if(admin.apps.length)return admin.app();
  const projectId=process.env.FIREBASE_PROJECT_ID;
  const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey=process.env.FIREBASE_PRIVATE_KEY||"";privateKey=privateKey.replace(/\\n/g,"\n");
  if(!projectId||!clientEmail||!privateKey)throw new Error("Faltan credenciales Firebase.");
  return admin.initializeApp({credential:admin.credential.cert({projectId,clientEmail,privateKey})});
}
async function requireUser(req,res){
  const auth=String(req.headers.authorization||"");const token=auth.startsWith("Bearer ")?auth.slice(7).trim():"";
  if(!token){res.status(401).json({ok:false,error:"Sesión requerida."});return null;}
  try{return await admin.auth().verifyIdToken(token);}catch(_){res.status(401).json({ok:false,error:"Sesión inválida o vencida."});return null;}
}
const clean=(v,n=160)=>String(v??"").trim().slice(0,n);
function identity(user={}){
  const raw=clean(user.usuario||user.uid||"usuario",80).toLowerCase();
  const role=clean(user.role||"usuario",80).toLowerCase();
  const usuario=raw==="geissel"?"geisell":raw;
  const actorLabel=(["naara","sublicuentas"].includes(usuario)?"Sublicuentas":(["libni","relojes","daniela"].includes(usuario)?"Relojes":(usuario==="geisell"?"Geisell":(usuario==="magdiel"?"Magdiel":clean(user.usuario||user.uid||"Usuario",80)))));
  const adminUser=["admin","administrador","sublicuentas","owner"].includes(role)||["naara","sublicuentas"].includes(usuario);
  return {usuario,role,actorLabel,admin:adminUser};
}
function safeDetail(obj){
  const out={};if(!obj||typeof obj!=="object"||Array.isArray(obj))return out;
  for(const k of ["clienteId","servicioIndex","servicioId","inventarioId","ticketId","id","sorteoId","plataforma","vendedor","seccion","tipo","motivo"]){
    if(obj[k]!=null&&typeof obj[k]!=="object")out[k]=clean(obj[k],160);
  }
  return out;
}
function detailText(det={}){return Object.entries(det).filter(([,v])=>v!=="").slice(0,3).map(([k,v])=>`${k}: ${v}`).join(" · ");}
function toIso(v){
  if(!v)return "";if(typeof v==="string")return v;
  if(v.toDate)try{return v.toDate().toISOString();}catch(_){}
  if(v._seconds!=null)return new Date(v._seconds*1000).toISOString();
  return "";
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  try{
    const db=getApp().firestore();const user=await requireUser(req,res);if(!user)return;const me=identity(user);
    if(req.method==="POST"){
      const body=req.body||{};const modulo=clean(body.modulo,80),accion=clean(body.accion,120),metodo=clean(body.metodo||"POST",12).toUpperCase(),ruta=clean(body.ruta,160);
      if(!modulo||!accion)return res.status(400).json({ok:false,error:"Falta módulo o acción."});
      const detalle=safeDetail(body.detalle);const now=new Date().toISOString();
      const ref=db.collection("actividad_usuarios").doc();
      await ref.set({
        usuario:me.usuario,actorLabel:me.actorLabel,rol:me.role,uid:user.uid||"",modulo,accion,metodo,ruta,detalle,detalleTexto:detailText(detalle),
        createdAt:admin.firestore.FieldValue.serverTimestamp(),createdAtIso:now
      });
      return res.status(200).json({ok:true,id:ref.id});
    }
    if(req.method==="GET"){
      if(!me.admin)return res.status(403).json({ok:false,error:"La bitácora completa es privada de Sublicuentas."});
      const limit=Math.max(50,Math.min(1000,Number(req.query?.limit||500)||500));
      const snap=await db.collection("actividad_usuarios").orderBy("createdAt","desc").limit(limit).get();
      const eventos=snap.docs.map(d=>{const x=d.data()||{};return {id:d.id,...x,createdAtIso:x.createdAtIso||toIso(x.createdAt),createdAt:undefined};});
      const now=Date.now(),day=86400000,startToday=new Date();startToday.setHours(0,0,0,0);
      const por=new Map();let hoy=0,ultimos7Dias=0,eliminaciones30Dias=0;
      for(const e of eventos){
        const t=Date.parse(e.createdAtIso||"")||0,age=now-t,a=String(e.accion||"").toLowerCase();
        if(t>=+startToday)hoy++;if(age>=0&&age<=7*day)ultimos7Dias++;
        const u=e.usuario||"usuario";if(age>=0&&age<=30*day){
          if(a.includes("elimin")||a.includes("borr")||a.includes("retir"))eliminaciones30Dias++;
          const row=por.get(u)||{usuario:u,actorLabel:e.actorLabel||u,total:0,eliminaciones:0,ediciones:0};row.total++;
          if(a.includes("elimin")||a.includes("borr")||a.includes("retir"))row.eliminaciones++;
          if(a.includes("edit")||a.includes("actualiz")||a.includes("guardar")||a.includes("renov")||a.includes("transfer"))row.ediciones++;
          por.set(u,row);
        }
      }
      const porUsuario=[...por.values()].sort((a,b)=>b.total-a.total||String(a.actorLabel).localeCompare(String(b.actorLabel)));
      return res.status(200).json({ok:true,eventos,resumen:{hoy,ultimos7Dias,eliminaciones30Dias,usuariosActivos30Dias:porUsuario.length,porUsuario}});
    }
    return res.status(405).json({ok:false,error:"Método no permitido."});
  }catch(e){console.error("AUDITORIA_USUARIOS_ERROR",e);return res.status(500).json({ok:false,error:e.message||"Error interno."});}
}
