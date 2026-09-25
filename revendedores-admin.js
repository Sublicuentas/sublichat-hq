(function(){'use strict';
/* revendedores-admin.js · Categoría "Revendedores" en Sublichat HQ
   ------------------------------------------------------------------
   Edita precios, vendedores y clientes de TODA la red de revendedores
   sin salir de Sublichat. Habla con /api/revendedores-admin (puente que
   valida el usuario y reenvía al backend en Render). Solo visible para
   el usuario sublicuentas — ver can('revendedores') en index.html.

   Reusa las clases .cr-* de catalogo-relojes-admin.css (ya cargado en
   la página) para no repetir estilos. */

const API='/api/revendedores-admin';
const TARIFA_ESPECIAL='propietarios_2026';
const state={tab:'precios',tarifa:'general',precios:null,vendedores:null,clientes:null,recompensas:null,promociones:null,pedidos:null,pedidoFiltro:'todos',clienteQ:'',clienteSel:null,precioQ:'',loading:false};
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const host=()=>document.getElementById('rbac-revendedores');
const money=v=>v==null?'—':`Lps. ${Number(v).toLocaleString('es-HN')}`;

const fmtDate=v=>{if(!v)return'Sin vencimiento';const d=new Date(v);return Number.isNaN(d.getTime())?'Sin vencimiento':d.toLocaleString('es-HN',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})};
function promoTextLines(v){const raw=String(v||'').replace(/\r/g,'\n').trim();if(!raw)return[];const byLine=raw.split(/\n+/).map(x=>x.replace(/^[-•*\s]+/,'').trim()).filter(Boolean);if(byLine.length>1)return byLine.slice(0,5);return raw.replace(/\s+/g,' ').split(/(?:\.\s+|!\s+|\?\s+|;\s+)/).map(x=>x.replace(/^[-•*\s]+/,'').trim()).filter(Boolean).slice(0,5)}
function promoPreviewHtml(v){const lines=promoTextLines(v);return lines.length?`<ul class="promo-preview">${lines.map(line=>`<li>${esc(line)}</li>`).join('')}</ul>`:''}
function promoMetaHtml(p){const items=[];if(p.precioNormal)items.push(`🧾 <b>Normal:</b> ${money(p.precioNormal)}`);if(p.precioPromo)items.push(`💰 <b>Socio:</b> ${money(p.precioPromo)}`);if(p.cupos)items.push(`📦 <b>Cupos:</b> ${Number(p.cupos)}`);items.push(`⏳ <b>Vigencia:</b> ${esc(fmtDate(p.vigencia))}`);return `<div class="promo-meta">${items.map(item=>`<span>${item}</span>`).join('')}</div>`}
function promoLocalDateValue(v){if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return'';const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
function promoPayloadFromModal(m,imagenData,imagenUrl='',fallbackDestinatarios=[]){const all=[...m.querySelectorAll('[data-pr-dest]')];const destinatarios=all.length?[...m.querySelectorAll('[data-pr-dest]:checked')].map(x=>x.value):[...(fallbackDestinatarios||[])];return {titulo:m.querySelector('#prTitulo').value.trim(),plataforma:m.querySelector('#prPlataforma').value.trim(),precioNormal:Number(m.querySelector('#prNormal').value)||0,precioPromo:Number(m.querySelector('#prPromo').value)||0,cupos:Number(m.querySelector('#prCupos').value)||0,vigencia:m.querySelector('#prVigencia').value?new Date(m.querySelector('#prVigencia').value).toISOString():'',texto:m.querySelector('#prTexto').value.trim(),destinatarios,imagenData,imagenUrl}}

async function api(method,ruta,body,params){
  const qs=new URLSearchParams({ruta,...(params||{}),_ts:String(Date.now())});
  const opts={method,cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'}};
  if(body!==undefined) opts.body=JSON.stringify(body);
  const r=await fetch(API+'?'+qs.toString(),opts);
  const t=await r.text();
  let d={}; try{d=JSON.parse(t)}catch(_){d={error:t}}
  if(!r.ok){const e=new Error((d&&d.error)||`HTTP ${r.status}`);e.data=d;e.status=r.status;throw e;}
  return d;
}

function shell(){
  const h=host(); if(!h||h.dataset.ready) return; h.dataset.ready='1';
  h.innerHTML=`
    <style>
      #rbac-revendedores .promo-grid{grid-template-columns:repeat(auto-fill,minmax(320px,420px));align-items:start}
      #rbac-revendedores .promo-card{min-width:0}
      #rbac-revendedores .promo-summary{display:grid;grid-template-columns:112px minmax(0,1fr);gap:12px;align-items:start}
      #rbac-revendedores .promo-thumb{display:block;width:112px;height:112px;object-fit:contain;background:#f7f7f8;border:1px solid #ececf0;border-radius:14px}
      #rbac-revendedores .promo-copy{min-width:0;display:grid;gap:9px}
      #rbac-revendedores .promo-copy p{margin:0;overflow-wrap:anywhere}
      #rbac-revendedores .promo-platform{font-weight:800;color:#182230}
      #rbac-revendedores .promo-meta{display:grid;gap:6px}
      #rbac-revendedores .promo-meta span{display:block;padding:8px 10px;border-radius:11px;background:#f8fafc;color:#344054;font-size:13px;line-height:1.35;overflow-wrap:anywhere}
      #rbac-revendedores .promo-preview{margin:0;padding-left:18px;display:grid;gap:4px;color:#475467;font-size:13px;line-height:1.45}
      #rbac-revendedores .promo-preview li{margin:0}
      #rbac-revendedores .promo-preview-title{font-size:12px;color:#667085;font-weight:700;letter-spacing:.02em;text-transform:uppercase}
      #rbac-revendedores .promo-template-note{grid-column:1/-1;padding:12px 14px;border:1px solid #d9e2f2;background:#f8fbff;border-radius:14px;color:#344054;font-size:13px;line-height:1.45}
      #rbac-revendedores .promo-template-note b{display:block;color:#101828;margin-bottom:3px}
      #rbac-revendedores .promo-live{grid-column:1/-1;border:1px solid #e4e7ec;background:#fff;border-radius:16px;padding:14px;display:grid;gap:8px}
      #rbac-revendedores .promo-live-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      #rbac-revendedores .promo-live-box{background:#1f2937;color:#fff;border-radius:14px;padding:14px;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
      #rbac-revendedores .promo-existing-image{display:flex;gap:10px;align-items:center;margin-top:8px}
      #rbac-revendedores .promo-existing-image img{width:76px;height:76px;object-fit:contain;border:1px solid #e4e7ec;border-radius:12px;background:#f8fafc}
      #rbac-revendedores .order-grid{display:grid;gap:12px}
      #rbac-revendedores .order-card{border-left:4px solid #d92d20}
      #rbac-revendedores .order-card[data-status="entregado"]{border-left-color:#12b76a}
      #rbac-revendedores .order-card[data-status="en proceso"]{border-left-color:#2e90fa}
      #rbac-revendedores .order-card[data-status="falta información"]{border-left-color:#f79009}
      #rbac-revendedores .order-card[data-status="cancelado"]{border-left-color:#667085}
      #rbac-revendedores .order-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}
      #rbac-revendedores .order-metric{padding:9px 10px;border-radius:11px;background:#f8fafc;font-size:12px;color:#475467}
      #rbac-revendedores .order-metric b{display:block;color:#101828;font-size:14px}
      #rbac-revendedores .order-status-tools{display:grid;grid-template-columns:minmax(150px,210px) minmax(180px,1fr) auto;gap:8px;align-items:end}
      #rbac-revendedores .perm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 12px;padding:10px;border:1px solid #e4e7ec;border-radius:12px;background:#f9fafb}
      #rbac-revendedores .stock-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      #rbac-revendedores .price-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 14px}
      #rbac-revendedores .price-search{flex:1;min-width:240px;display:flex;align-items:center;gap:8px;border:1px solid #dce4ee;background:#fff;border-radius:14px;padding:0 12px}
      #rbac-revendedores .price-search input{width:100%;border:0;outline:0;background:transparent;padding:11px 0;font:inherit;color:#15264a}
      #rbac-revendedores .price-catalog-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}
      #rbac-revendedores .price-compact-card{background:#fff;border:1px solid #dfe7f1;border-radius:18px;padding:14px;box-shadow:0 5px 14px rgba(15,35,70,.07);min-width:0}
      #rbac-revendedores .price-summary{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:11px;align-items:center}
      #rbac-revendedores .price-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:14px;background:#f3f7fb;font-size:22px;border:1px solid #e2eaf3}
      #rbac-revendedores .price-title{min-width:0}#rbac-revendedores .price-title h3{margin:0!important;font-size:15px!important;line-height:1.15;color:#16345f}#rbac-revendedores .price-title small{display:block;margin-top:4px;color:#71839a;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #rbac-revendedores .price-amount{font-weight:950;color:#15915a;background:#edfbf4;border-radius:12px;padding:8px 10px;white-space:nowrap;font-size:13px}
      #rbac-revendedores .price-tags{display:flex;gap:6px;flex-wrap:wrap;margin:11px 0 8px}.price-tags span{display:inline-flex;align-items:center;gap:4px;padding:5px 8px;border-radius:999px;background:#f5f8fc;border:1px solid #e6edf5;color:#52677f;font-size:10.5px;font-weight:850}.price-tags span.on{background:#eefbf4;color:#148557;border-color:#d7f3e4}.price-tags span.off{background:#fff4f3;color:#c3362d;border-color:#f3d3cf}
      #rbac-revendedores .price-detail-preview{display:flex;gap:6px;flex-wrap:wrap;min-height:29px}.price-detail-preview span{display:inline-flex;align-items:center;max-width:100%;padding:6px 8px;border-radius:9px;background:#f8fafc;color:#4f647b;font-size:10.5px;font-weight:750;line-height:1.25}
      #rbac-revendedores .price-card-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:11px;padding-top:10px;border-top:1px solid #edf1f6}
      #rbac-revendedores .price-editor{display:none;margin-top:12px;padding-top:12px;border-top:1px solid #e5ebf3}#rbac-revendedores .price-editor.open{display:block}#rbac-revendedores .price-editor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}#rbac-revendedores .price-editor-grid .wide{grid-column:1/-1}
      #rbac-revendedores .detail-preset-row{display:flex;gap:6px;flex-wrap:wrap;margin:7px 0}.detail-preset-row button{border:1px solid #dbe5ef;background:#fff;border-radius:999px;padding:6px 9px;font:inherit;font-size:10px;font-weight:850;color:#425a73;cursor:pointer}.detail-preset-row button:hover{border-color:#e2231a;color:#c82018;background:#fff6f5}
      #rbac-revendedores .price-helper{display:block;color:#8493a6;font-size:10px;line-height:1.35;margin-top:4px}
      @media(max-width:600px){
        #rbac-revendedores .promo-grid{grid-template-columns:1fr}
        #rbac-revendedores .promo-summary{grid-template-columns:88px minmax(0,1fr)}
        #rbac-revendedores .promo-thumb{width:88px;height:88px}
        #rbac-revendedores .order-metrics,#rbac-revendedores .stock-row,#rbac-revendedores .perm-grid,#rbac-revendedores .price-catalog-grid,#rbac-revendedores .price-editor-grid{grid-template-columns:1fr}
        #rbac-revendedores .order-status-tools{grid-template-columns:1fr}
      }
      /* Editor de promociones: el modal vive fuera de #rbac-revendedores, por eso
         estos estilos son globales y no heredan el prefijo del módulo. */
      .promo-editor-modal{align-items:center!important;justify-content:center!important;padding:18px!important;overflow:hidden!important}
      .promo-editor-modal .cr-sheet.promo-editor-sheet{width:min(1180px,calc(100vw - 36px))!important;max-width:1180px!important;height:min(860px,calc(100dvh - 36px))!important;max-height:calc(100dvh - 36px)!important;padding:0!important;overflow:hidden!important;border-radius:24px!important;background:#f8fafc!important;box-shadow:0 30px 80px rgba(15,23,42,.28)!important;display:grid!important;grid-template-rows:auto minmax(0,1fr) auto!important}
      .promo-editor-modal .promo-editor-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 22px;background:#fff;border-bottom:1px solid #e7ebf1}
      .promo-editor-modal .promo-editor-title{min-width:0}
      .promo-editor-modal .promo-editor-kicker{display:block;margin-bottom:3px;color:#e2231a;font-size:10px;font-weight:950;letter-spacing:.11em;text-transform:uppercase}
      .promo-editor-modal .promo-editor-head h2{margin:0!important;color:#15264a;font-size:22px;line-height:1.1}
      .promo-editor-modal .promo-editor-head p{margin:5px 0 0;color:#667085;font-size:12px;line-height:1.35}
      .promo-editor-modal .promo-editor-close{width:40px;height:40px;flex:none;border:1px solid #dce3ec;border-radius:13px;background:#fff;color:#475467;font:900 20px/1 Arial;cursor:pointer;box-shadow:0 4px 14px rgba(15,23,42,.07)}
      .promo-editor-modal .promo-editor-close:hover{border-color:#e2231a;color:#e2231a}
      .promo-editor-modal .promo-editor-body{min-height:0;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(360px,.92fr);overflow:hidden}
      .promo-editor-modal .promo-editor-formpane{min-width:0;overflow:auto;padding:20px 22px 26px;background:#fff;scrollbar-gutter:stable}
      .promo-editor-modal .promo-editor-formpane .cr-form{gap:12px}
      .promo-editor-modal .promo-template-note{grid-column:1/-1;padding:12px 14px;border:1px solid #dbe5f3;background:#f7fbff;border-radius:14px;color:#475467;font-size:12px;line-height:1.45}
      .promo-editor-modal .promo-template-note b{display:block;color:#15264a;margin-bottom:3px}
      .promo-editor-modal .promo-template-library{grid-column:1/-1;padding:13px;border:1px solid #e6eaf0;background:#fff;border-radius:16px;box-shadow:0 4px 16px rgba(15,23,42,.04)}
      .promo-editor-modal .promo-template-library-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:9px}
      .promo-editor-modal .promo-template-library-head b{color:#15264a;font-size:13px}
      .promo-editor-modal .promo-template-library-head small{display:block;margin-top:2px;color:#7b8798;font-size:10px;font-weight:700}
      .promo-editor-modal .promo-template-chips{display:flex;gap:7px;flex-wrap:wrap}
      .promo-editor-modal .promo-template-chip{border:1px solid #dbe2eb;border-radius:999px;background:#fff;color:#344054;padding:7px 10px;font-family:inherit;font-size:11px;font-weight:850;line-height:1.1;cursor:pointer;transition:.16s ease}
      .promo-editor-modal .promo-template-chip:hover,.promo-editor-modal .promo-template-chip.on{border-color:#e2231a;background:#fff5f4;color:#c81f17;transform:translateY(-1px)}
      .promo-editor-modal .cr-field{font-size:11px;font-weight:900;color:#475467}
      .promo-editor-modal .cr-field input,.promo-editor-modal .cr-field select,.promo-editor-modal .cr-field textarea{box-sizing:border-box;width:100%;border:1px solid #d9e0e9;border-radius:12px;background:#fff;color:#15264a;padding:10px 11px;font:inherit;outline:none}
      .promo-editor-modal .cr-field input:focus,.promo-editor-modal .cr-field textarea:focus{border-color:#9bb8dc;box-shadow:0 0 0 3px rgba(32,113,196,.08)}
      .promo-editor-modal .cr-field textarea{min-height:118px;resize:vertical;line-height:1.45}
      .promo-editor-modal .cr-field small{color:#8491a3;font-size:9.5px;line-height:1.35;font-weight:700}
      .promo-editor-modal .promo-existing-image{display:flex;gap:10px;align-items:center;margin-top:8px}
      .promo-editor-modal .promo-existing-image img{width:64px;height:64px;object-fit:contain;border:1px solid #e4e7ec;border-radius:12px;background:#f8fafc}
      .promo-editor-modal .promo-dest-box{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:7px;margin-top:8px}
      .promo-editor-modal .promo-preview-pane{min-width:0;overflow:auto;padding:20px;background:#eef3f8;border-left:1px solid #dde5ef;scrollbar-gutter:stable}
      .promo-editor-modal .promo-preview-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}
      .promo-editor-modal .promo-preview-head b{display:block;color:#15264a;font-size:14px}
      .promo-editor-modal .promo-preview-head small{display:block;color:#7c8a9b;font-size:10px;margin-top:2px}
      .promo-editor-modal .promo-preview-tabs{display:flex;gap:5px;padding:4px;background:#e2e9f1;border-radius:12px}
      .promo-editor-modal .promo-preview-tab{border:0;border-radius:9px;background:transparent;color:#667085;padding:7px 9px;font-family:inherit;font-size:10px;font-weight:900;line-height:1;cursor:pointer}
      .promo-editor-modal .promo-preview-tab.on{background:#fff;color:#15264a;box-shadow:0 2px 8px rgba(15,23,42,.08)}
      .promo-editor-modal .promo-preview-canvas{display:grid;place-items:start center}
      .promo-editor-modal .promo-panel-mock{width:min(100%,390px);background:#fff;border:1px solid #e0e6ee;border-radius:20px;overflow:hidden;box-shadow:0 14px 32px rgba(15,23,42,.12)}
      .promo-editor-modal .promo-panel-media{aspect-ratio:1/1;background:linear-gradient(135deg,#f7f8fb,#e9eef5);display:grid;place-items:center;overflow:hidden;color:#8b98aa;font-size:11px;font-weight:850}
      .promo-editor-modal .promo-panel-media img{width:100%;height:100%;object-fit:contain;display:block}
      .promo-editor-modal .promo-panel-content{padding:15px;display:grid;gap:8px}
      .promo-editor-modal .promo-panel-title{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
      .promo-editor-modal .promo-panel-title h3{margin:0;color:#15264a;font-size:17px;line-height:1.18}
      .promo-editor-modal .promo-panel-badge{flex:none;border-radius:999px;background:#ecfdf3;color:#067647;padding:5px 7px;font-size:9px;font-weight:950}
      .promo-editor-modal .promo-panel-platform{color:#475467;font-size:11px;font-weight:900}
      .promo-editor-modal .promo-panel-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
      .promo-editor-modal .promo-panel-meta span{padding:8px 9px;border-radius:10px;background:#f6f8fb;color:#475467;font-size:10px;line-height:1.3}
      .promo-editor-modal .promo-panel-benefits{margin:0;padding-left:18px;color:#667085;font-size:10.5px;line-height:1.45;display:grid;gap:3px}
      .promo-editor-modal .promo-telegram-mock{width:min(100%,390px);padding:15px;border-radius:20px;background:#dfe9ef;box-shadow:inset 0 0 0 1px rgba(21,38,74,.05)}
      .promo-editor-modal .promo-tg-bubble{overflow:hidden;border-radius:16px 16px 16px 5px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.10)}
      .promo-editor-modal .promo-tg-media{aspect-ratio:1/1;background:#edf2f7;display:grid;place-items:center;color:#8b98aa;font-size:11px;font-weight:850;overflow:hidden}
      .promo-editor-modal .promo-tg-media img{width:100%;height:100%;object-fit:contain;display:block}
      .promo-editor-modal .promo-live-box{padding:13px 14px!important;background:#fff!important;color:#253858!important;border-radius:0!important;font:500 12px/1.48 Arial,sans-serif!important;white-space:pre-wrap;overflow-wrap:anywhere}
      .promo-editor-modal [data-promo-preview-view][hidden]{display:none!important}
      .promo-editor-modal .promo-preview-foot{margin-top:10px;padding:9px 10px;border-radius:11px;background:#fff;color:#758397;font-size:9.5px;line-height:1.35;border:1px solid #e1e7ee}
      .promo-editor-modal .promo-editor-actions{margin:0!important;padding:12px 18px!important;background:#fff!important;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:8px;align-items:center;position:static!important}
      .promo-editor-modal .promo-editor-actions .promo-action-note{margin-right:auto;color:#7d8a9a;font-size:10px;font-weight:750}
      @media(max-width:900px){
        .promo-editor-modal{padding:8px!important;align-items:flex-start!important;overflow:auto!important}
        .promo-editor-modal .cr-sheet.promo-editor-sheet{width:100%!important;max-width:none!important;height:auto!important;min-height:calc(100dvh - 16px)!important;max-height:none!important;overflow:visible!important;border-radius:18px!important;display:block!important}
        .promo-editor-modal .promo-editor-body{display:block;overflow:visible}
        .promo-editor-modal .promo-editor-formpane,.promo-editor-modal .promo-preview-pane{overflow:visible}
        .promo-editor-modal .promo-preview-pane{border-left:0;border-top:1px solid #dde5ef}
        .promo-editor-modal .promo-editor-actions{position:sticky!important;bottom:0!important;z-index:10}
      }
      @media(max-width:600px){
        .promo-editor-modal .promo-editor-head{padding:14px}
        .promo-editor-modal .promo-editor-head h2{font-size:19px}
        .promo-editor-modal .promo-editor-formpane,.promo-editor-modal .promo-preview-pane{padding:14px}
        .promo-editor-modal .promo-template-library-head,.promo-editor-modal .promo-preview-head{display:block}
        .promo-editor-modal .promo-preview-tabs{margin-top:8px;width:max-content}
        .promo-editor-modal .promo-panel-meta{grid-template-columns:1fr}
        .promo-editor-modal .promo-editor-actions{padding:10px!important}
        .promo-editor-modal .promo-editor-actions .promo-action-note{display:none}
        .promo-editor-modal .promo-editor-actions .cr-btn{flex:1}
      }
    </style>
    <div class="cr-admin">
      <div class="cr-hero">
        <div><b>🤝 Catálogo Socios</b><span>Precios, vendedores y clientes de toda la red — conectado al Panel de Socios.</span></div>
      </div>
      <div class="cr-tabs">
        <button class="cr-tab on" data-rtab="precios">Precios</button>
        <button class="cr-tab" data-rtab="vendedores">Vendedores</button>
        <button class="cr-tab" data-rtab="clientes">Clientes</button>
        <button class="cr-tab" data-rtab="pedidos">🛒 Pedidos</button>
        <button class="cr-tab" data-rtab="promociones">🔥 Promociones</button>
        <button class="cr-tab" data-rtab="recompensas">Recompensas</button>
      </div>
      <div id="revBody"></div>
    </div>`;
  h.querySelectorAll('[data-rtab]').forEach(b=>b.onclick=()=>{
    state.tab=b.dataset.rtab;
    h.querySelectorAll('[data-rtab]').forEach(x=>x.classList.toggle('on',x===b));
    render();
  });
}

function status(msg,cls){
  const b=$('#revBody');
  if(b) b.insertAdjacentHTML('afterbegin',`<div class="cr-status ${cls||''}" style="margin-bottom:8px">${esc(msg)}</div>`);
}

function render(){
  ({precios:renderPrecios,vendedores:renderVendedores,clientes:renderClientes,pedidos:renderPedidos,promociones:renderPromociones,recompensas:renderRecompensas}[state.tab]||renderPrecios)();
}

/* ═══════════ PEDIDOS DE SOCIOS ═══════════ */
async function loadPedidos(force){
  if(state.pedidos&&!force)return renderPedidos();
  const b=$('#revBody');if(b)b.innerHTML='<div class="cr-empty">Cargando pedidos…</div>';
  try{const d=await api('GET','compras',undefined,{limit:240});state.pedidos=Array.isArray(d)?d:(d.compras||d.items||[]);renderPedidos()}
  catch(e){if(b)b.innerHTML=`<div class="cr-empty">${esc(e.message)}</div>`}
}
function pedidoEstado(v){const s=String(v||'pendiente').trim().toLowerCase();return ['pendiente','en proceso','falta información','entregado','cancelado'].includes(s)?s:'pendiente'}
function pedidoFecha(v){if(!v)return'—';const d=new Date(typeof v==='number'?v:v._seconds?v._seconds*1000:v.seconds?v.seconds*1000:v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('es-HN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
function pedidoCard(p){
  const estado=pedidoEstado(p.estado),costo=Number(p.monto)||0;
  const productos=Array.isArray(p.productos)&&p.productos.length?p.productos.map(x=>x.servicio||x.nombre).filter(Boolean).join(' + '):(p.servicio||'Pedido');
  const flujo=entregaCanalLabel(p.entregaCanal||(Array.isArray(p.productos)&&p.productos[0]?.entregaCanal)||'manual');
  return `<article class="cr-card order-card" data-status="${esc(estado)}">
    <div class="cr-row"><h3>🛒 ${esc(productos)}</h3><span class="cr-badge ${estado==='entregado'?'':estado==='cancelado'?'paused':''}">${esc(estado)}</span></div>
    <small>Socio: <b>${esc(p.socio||p.socio_norm||'—')}</b> · ${esc(p.destinoLabel||p.destino||'')} · 🚚 ${esc(flujo)} · ${esc(pedidoFecha(p.ts||p.createdAt))} · Ref ${esc(String(p.id||'').slice(-6))}</small>
    <div class="order-metrics"><div class="order-metric">Pagado a Sublicuentas<b>${money(costo)}</b></div></div>
    ${p.detalleEstado?`<div class="cr-status" style="margin:0 0 10px">${esc(p.detalleEstado)}</div>`:''}
    <div class="order-status-tools">
      <label class="cr-field">Estado<select id="pedidoEstado-${esc(p.id)}"><option value="pendiente" ${estado==='pendiente'?'selected':''}>Pendiente</option><option value="en proceso" ${estado==='en proceso'?'selected':''}>En proceso</option><option value="falta información" ${estado==='falta información'?'selected':''}>Falta información</option><option value="entregado" ${estado==='entregado'?'selected':''}>Entregado</option><option value="cancelado" ${estado==='cancelado'?'selected':''}>Cancelado</option></select></label>
      <label class="cr-field">Mensaje al socio<input id="pedidoDetalle-${esc(p.id)}" maxlength="300" value="${esc(p.detalleEstado||'')}" placeholder="Ej. Listo, revise su correo"></label>
      <button class="cr-btn red" data-pedido-save="${esc(p.id)}">Actualizar</button>
    </div>
  </article>`;
}
function renderPedidos(){
  const b=$('#revBody');if(!state.pedidos)return loadPedidos();
  const counts={};state.pedidos.forEach(p=>{const e=pedidoEstado(p.estado);counts[e]=(counts[e]||0)+1});
  const filtros=[['todos','Todos'],['pendiente','Pendientes'],['en proceso','En proceso'],['falta información','Falta información'],['entregado','Entregados'],['cancelado','Cancelados']];
  const list=state.pedidoFiltro==='todos'?state.pedidos:state.pedidos.filter(p=>pedidoEstado(p.estado)===state.pedidoFiltro);
  b.innerHTML=`<div class="cr-tools" style="flex-wrap:wrap"><div><b>Seguimiento de pedidos</b><br><small>Cambie el estado aquí. El socio lo ve en su panel y recibe aviso en Buzón/Telegram.</small></div><button class="cr-btn ghost" id="pedidoReload">Actualizar</button></div>
    <div class="cr-tabs" style="margin-bottom:12px;overflow:auto">${filtros.map(([k,l])=>`<button class="cr-tab ${state.pedidoFiltro===k?'on':''}" data-pedido-filter="${k}">${l}${k==='todos'?` · ${state.pedidos.length}`:counts[k]?` · ${counts[k]}`:''}</button>`).join('')}</div>
    <div class="order-grid">${list.map(pedidoCard).join('')||'<div class="cr-empty">No hay pedidos en este filtro.</div>'}</div>`;
  $('#pedidoReload').onclick=()=>loadPedidos(true);
  b.querySelectorAll('[data-pedido-filter]').forEach(x=>x.onclick=()=>{state.pedidoFiltro=x.dataset.pedidoFilter;renderPedidos()});
  b.querySelectorAll('[data-pedido-save]').forEach(x=>x.onclick=()=>guardarEstadoPedido(x.dataset.pedidoSave,x));
}
async function guardarEstadoPedido(id,btn){
  const estado=$('#pedidoEstado-'+id)?.value||'pendiente',detalle=$('#pedidoDetalle-'+id)?.value.trim()||'';
  const old=btn.textContent;btn.disabled=true;btn.textContent='Guardando…';
  try{await api('PATCH',`compras/${id}/estado`,{estado,detalle});status('✅ Estado actualizado y socio notificado.','good');await loadPedidos(true)}
  catch(e){status(e.message,'bad');btn.disabled=false;btn.textContent=old}
}

/* ═══════════ PROMOCIONES PARA SOCIOS ═══════════ */
async function loadPromociones(force){
  if(state.promociones&&!force)return renderPromociones();
  const b=$('#revBody');if(b)b.innerHTML='<div class="cr-empty">Cargando promociones…</div>';
  try{const d=await api('GET','promociones');state.promociones=d.promociones||[];renderPromociones()}catch(e){if(b)b.innerHTML=`<div class="cr-empty">${esc(e.message)}</div>`}
}
function promoStatus(p){return p.estado==='publicada'?`Enviada a ${Number(p.enviados)||0}`:'Borrador'}
function renderPromociones(){
  const b=$('#revBody');if(!state.promociones)return loadPromociones();
  b.innerHTML=`<div class="cr-tools"><div><b>Campañas para revendedores</b><br><small>La misma promoción aparecerá en el Panel de Socios y puede enviarse con imagen por Telegram.</small></div><button class="cr-btn red" id="promoNueva">＋ Nueva promoción</button></div>
    <div class="cr-grid promo-grid">${state.promociones.map(p=>`<article class="cr-card promo-card"><div class="promo-summary">${p.imagenUrl?`<a href="${esc(p.imagenUrl)}" target="_blank" rel="noopener" title="Abrir imagen completa"><img class="promo-thumb" src="${esc(p.imagenUrl)}" alt="Imagen de ${esc(p.titulo)}"></a>`:'<div class="promo-thumb" aria-hidden="true"></div>'}<div class="promo-copy"><div class="cr-row"><h3>🔥 ${esc(p.titulo)}</h3><span class="cr-badge ${p.estado==='publicada'?'':'paused'}">${esc(promoStatus(p))}</span></div><div class="promo-platform">🎯 ${esc(p.plataforma)}</div>${promoMetaHtml(p)}${promoTextLines(p.texto).length?`<div class="promo-preview-title">✨ Vista previa del mensaje</div>${promoPreviewHtml(p.texto)}`:''}</div></div><div class="cr-row" style="flex-wrap:wrap"><button class="cr-btn ghost" data-promo-edit="${esc(p.id)}">✏️ Editar</button><button class="cr-btn danger" data-promo-del="${esc(p.id)}">Eliminar</button><button class="cr-btn red" data-promo-send="${esc(p.id)}">${p.estado==='publicada'?'📨 Reenviar Telegram':'🚀 Publicar y enviar'}</button></div>${p.fallidos?`<small style="color:#b42318;display:block">⚠️ ${Number(p.fallidos)} no recibieron Telegram.</small>${Array.isArray(p.erroresTelegram)&&p.erroresTelegram.length?`<div style="margin-top:6px;padding:9px 10px;border-radius:10px;background:#fff3f2;color:#912018;font-size:12px">${p.erroresTelegram.map(e=>`<b>${esc(e.nombre||'Socio')}</b> · TG ${esc(e.telegramId||'—')}<br>${esc(e.motivo||'Error Telegram')}<br><span>${esc(e.diagnostico||'')}</span>`).join('<hr style="border:0;border-top:1px solid #f1c0bc;margin:7px 0">')}</div>`:''}`:''}</article>`).join('')||'<div class="cr-empty">Aún no hay promociones para socios.</div>'}</div>`;
  $('#promoNueva').onclick=nuevaPromocion;
  b.querySelectorAll('[data-promo-edit]').forEach(x=>x.onclick=()=>editarPromocion(x.dataset.promoEdit));
  b.querySelectorAll('[data-promo-send]').forEach(x=>x.onclick=()=>enviarPromocion(x.dataset.promoSend,x));
  b.querySelectorAll('[data-promo-del]').forEach(x=>x.onclick=()=>eliminarPromocion(x.dataset.promoDel));
}

async function imageData(file){
  if(!file)return'';
  if(!/^image\/(jpeg|png|webp)$/i.test(file.type))throw new Error('Use una imagen JPG, PNG o WEBP.');
  const url=URL.createObjectURL(file),img=new Image();
  try{
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('No se pudo leer la imagen seleccionada.'));img.src=url});
    // Mantener el request muy por debajo del límite de Vercel. Antes una foto
    // podía acercarse a 4.7 MB en base64 y el proxy la rechazaba antes de llegar
    // al Panel de Socios, dejando el botón en “Procesando…”.
    const maxData=1650000;
    let maxSide=1280,quality=.82,data='';
    for(let intento=0;intento<6;intento+=1){
      const scale=Math.min(1,maxSide/Math.max(img.width,img.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('No se pudo preparar la imagen.');
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      data=canvas.toDataURL('image/jpeg',quality);
      if(data.length<=maxData)return data;
      maxSide=Math.max(760,Math.round(maxSide*.84));quality=Math.max(.62,quality-.05);
    }
    throw new Error('La imagen sigue demasiado pesada. Use una imagen menor de 5 MB.');
  }finally{URL.revokeObjectURL(url)}
}
const PROMO_APP_TEMPLATES=[
  {id:'netflix',icon:'🎬',name:'Netflix',titulo:'Netflix Premium · Promo para socios',plataforma:'Netflix Premium',texto:'Perfil Premium para 1 pantalla\nSeries, películas y estrenos\nUna opción de alta demanda para su catálogo'},
  {id:'disney',icon:'🏰',name:'Disney+',titulo:'Disney+ Premium · Promo para socios',plataforma:'Disney+ Premium',texto:'Disney, Pixar, Marvel y Star Wars\nPelículas, series y contenido familiar\nPerfil Premium listo para entregar'},
  {id:'max',icon:'🎞️',name:'Max',titulo:'Max · Promo para socios',plataforma:'Max',texto:'Series HBO, Warner Bros. y DC\nPelículas, documentales y estrenos\nExcelente opción para ampliar su catálogo'},
  {id:'prime',icon:'📺',name:'Prime Video',titulo:'Prime Video · Promo para socios',plataforma:'Prime Video',texto:'Series y películas internacionales\nCatálogo variado para toda la familia\nAcceso listo para asignar'},
  {id:'crunchyroll',icon:'🍥',name:'Crunchyroll',titulo:'Crunchyroll · Promo para socios',plataforma:'Crunchyroll',texto:'Anime y estrenos de temporada\nAmplio catálogo de series japonesas\nIdeal para clientes fanáticos del anime'},
  {id:'paramount',icon:'⛰️',name:'Paramount+',titulo:'Paramount+ · Promo para socios',plataforma:'Paramount+',texto:'Películas y series de Paramount\nContenido de entretenimiento internacional\nUna alternativa económica para su catálogo'},
  {id:'vix',icon:'⚽',name:'ViX',titulo:'ViX Premium · Promo para socios',plataforma:'ViX Premium',texto:'Series, películas y entretenimiento en español\nDeportes disponibles según el plan vigente\nIdeal para público latino'},
  {id:'canva',icon:'🎨',name:'Canva',titulo:'Canva Pro · Promo para socios',plataforma:'Canva Pro',texto:'Herramientas premium de diseño\nPlantillas y recursos avanzados\nIdeal para emprendedores, negocios y creadores'},
  {id:'duolingo',icon:'🦉',name:'Duolingo',titulo:'Duolingo Super · Promo para socios',plataforma:'Duolingo Super',texto:'Experiencia sin anuncios\nVidas ilimitadas\nAprendizaje de idiomas y otras materias'},
  {id:'gemini',icon:'✨',name:'Gemini',titulo:'Gemini Pro · Promo para socios',plataforma:'Gemini Pro',texto:'IA para productividad y creación de contenido\nApoyo para investigación, redacción e ideas\nIdeal para estudio y trabajo'},
  {id:'youtube',icon:'▶️',name:'YouTube',titulo:'YouTube Premium · Promo para socios',plataforma:'YouTube Premium',texto:'YouTube sin anuncios\nReproducción en segundo plano\nMúsica y video en una sola suscripción'},
  {id:'spotify',icon:'🎧',name:'Spotify',titulo:'Spotify Premium · Promo para socios',plataforma:'Spotify Premium',texto:'Música sin anuncios\nEscuche sus canciones y playlists favoritas\nProducto de alta rotación'},
  {id:'tv',icon:'📡',name:'TV Digital',titulo:'TV Digital · Promo para socios',plataforma:'TV Digital',texto:'Canales, películas y series\nContenido deportivo disponible según servicio\nOpciones para Android TV y dispositivos compatibles'}
];
function promoTemplateChips(){return PROMO_APP_TEMPLATES.map(t=>`<button type="button" class="promo-template-chip" data-promo-template="${esc(t.id)}">${t.icon} ${esc(t.name)}</button>`).join('')}
function promoDestinatariosHtml(selected=[]){
  const activos=(state.vendedores||[]).filter(v=>v.activo!==false);
  const sel=new Set((selected||[]).map(v=>String(v||'').trim().toLowerCase()));
  if(!activos.length)return '<small>No se encontraron socios activos. Si guarda así, se publicará para todos los socios activos.</small>';
  return activos.map(v=>{const value=String(v.nombre_norm||v.id||'');const checked=sel.has(value.toLowerCase())?' checked':'';return `<label class="cr-check"><input type="checkbox" data-pr-dest value="${esc(value)}"${checked}> ${esc(v.nombre||v.nombre_norm||v.id)}</label>`}).join('');
}
function promoPreviewText(m){
  const titulo=m.querySelector('#prTitulo')?.value.trim()||'PROMOCIÓN PARA SOCIOS';
  const plataforma=m.querySelector('#prPlataforma')?.value.trim()||'Plataforma';
  const normal=Number(m.querySelector('#prNormal')?.value)||0,promo=Number(m.querySelector('#prPromo')?.value)||0,cupos=Number(m.querySelector('#prCupos')?.value)||0;
  const vigencia=m.querySelector('#prVigencia')?.value?fmtDate(new Date(m.querySelector('#prVigencia').value).toISOString()):'';
  const lines=[`🔥 ${titulo}`,`🎯 Plataforma: ${plataforma}`,'','💎 Datos de la oferta'];
  if(normal)lines.push(`• 🧾 Precio normal: L ${normal}`);if(promo)lines.push(`• 💰 Precio socio: L ${promo}`);if(cupos)lines.push(`• 📦 Cupos disponibles: ${cupos}`);if(vigencia)lines.push(`• ⏳ Vigencia: ${vigencia}`);
  const details=promoTextLines(m.querySelector('#prTexto')?.value||'');if(details.length){lines.push('','✨ Detalles');details.forEach(x=>lines.push(`• ${x}`));}
  lines.push('','📲 Cómo solicitar','• Solicítela desde su Panel de Socios.','• Si necesita apoyo, escriba a Sublicuentas.');
  return lines.join('\n');
}
function promoPanelPreviewHtml(m){
  const titulo=m.querySelector('#prTitulo')?.value.trim()||'Título de la promoción';
  const plataforma=m.querySelector('#prPlataforma')?.value.trim()||'Plataforma';
  const normal=Number(m.querySelector('#prNormal')?.value)||0,promo=Number(m.querySelector('#prPromo')?.value)||0,cupos=Number(m.querySelector('#prCupos')?.value)||0;
  const vigencia=m.querySelector('#prVigencia')?.value?fmtDate(new Date(m.querySelector('#prVigencia').value).toISOString()):'Sin vencimiento';
  const details=promoTextLines(m.querySelector('#prTexto')?.value||'');
  const meta=[];if(normal)meta.push(`<span>🧾 <b>Normal:</b><br>${money(normal)}</span>`);if(promo)meta.push(`<span>💰 <b>Socio:</b><br>${money(promo)}</span>`);if(cupos)meta.push(`<span>📦 <b>Cupos:</b><br>${cupos}</span>`);meta.push(`<span>⏳ <b>Vigencia:</b><br>${esc(vigencia)}</span>`);
  return `<div class="promo-panel-content"><div class="promo-panel-title"><h3>🔥 ${esc(titulo)}</h3><span class="promo-panel-badge">PROMO</span></div><div class="promo-panel-platform">🎯 ${esc(plataforma)}</div><div class="promo-panel-meta">${meta.join('')}</div>${details.length?`<ul class="promo-panel-benefits">${details.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<small style="color:#98a2b3">Escriba los beneficios para verlos aquí.</small>'}</div>`;
}
function promoSetPreviewImage(m,src=''){
  const panel=m.querySelector('#prPanelMedia'),tg=m.querySelector('#prTgMedia');
  const html=src?`<img src="${esc(src)}" alt="Vista previa de la promoción">`:'<span>La imagen promocional aparecerá aquí</span>';
  if(panel)panel.innerHTML=html;if(tg)tg.innerHTML=html;
}
function refreshPromoPreview(m){
  const live=m.querySelector('#prLiveText');if(live)live.textContent=promoPreviewText(m);
  const panel=m.querySelector('#prPanelContent');if(panel)panel.innerHTML=promoPanelPreviewHtml(m);
}
function applyPromoTemplate(m,id){
  const t=PROMO_APP_TEMPLATES.find(x=>x.id===id);if(!t)return;
  const titulo=m.querySelector('#prTitulo'),plataforma=m.querySelector('#prPlataforma'),texto=m.querySelector('#prTexto');
  if(titulo)titulo.value=t.titulo;if(plataforma)plataforma.value=t.plataforma;if(texto)texto.value=t.texto;
  m.querySelectorAll('[data-promo-template]').forEach(x=>x.classList.toggle('on',x.dataset.promoTemplate===id));
  refreshPromoPreview(m);
}
function bindPromoPreviewTabs(m){m.querySelectorAll('[data-promo-view]').forEach(btn=>btn.onclick=()=>{const view=btn.dataset.promoView;m.querySelectorAll('[data-promo-view]').forEach(x=>x.classList.toggle('on',x===btn));m.querySelectorAll('[data-promo-preview-view]').forEach(x=>x.hidden=x.dataset.promoPreviewView!==view)})}
function editarPromocion(id){const p=(state.promociones||[]).find(x=>x.id===id);if(!p)return alert('Promoción no encontrada.');return abrirPromocion(p)}
function nuevaPromocion(){return abrirPromocion(null)}
async function abrirPromocion(p){
  const editing=!!p;
  const m=modal(`<div class="promo-editor-head"><div class="promo-editor-title"><span class="promo-editor-kicker">Catálogo Socios · promociones</span><h2>${editing?'✏️ Editar promoción':'🔥 Nueva promoción para socios'}</h2><p>Prepare una oferta mayorista para sus vendedores y vea cómo quedará antes de publicarla.</p></div><button type="button" class="promo-editor-close" id="prClose" aria-label="Cerrar">×</button></div>
  <div class="promo-editor-body">
    <section class="promo-editor-formpane">
      <div class="cr-form">
        <div class="promo-template-note"><b>💎 Plantilla Premium conectada a Telegram</b>El precio que coloca aquí es su precio para el socio. No controla ni solicita el precio final que el revendedor cobra a su cliente. Al enviar, la misma promoción se publica en el Panel de Socios y Telegram.</div>
        <div class="promo-template-library"><div class="promo-template-library-head"><div><b>⚡ Plantillas rápidas por app</b><small>Rellenan título, plataforma y beneficios. Los precios, cupos y vigencia quedan bajo su control.</small></div></div><div class="promo-template-chips">${promoTemplateChips()}</div></div>
        <label class="cr-field wide">Imagen promocional<input id="prImagen" type="file" accept="image/jpeg,image/png,image/webp"><small>${editing&&p.imagenUrl?'Si no selecciona otra imagen, se conserva la actual.':'Se optimiza automáticamente para el panel y Telegram.'}</small>${editing&&p.imagenUrl?`<div class="promo-existing-image"><img src="${esc(p.imagenUrl)}" alt="Imagen actual"><span>Imagen actual<br><small>Seleccione otra únicamente si desea reemplazarla.</small></span></div>`:''}</label>
        <label class="cr-field wide">Título<input id="prTitulo" maxlength="120" placeholder="Ej. Disney+ Premium · Promo para socios" value="${esc(p?.titulo||'')}"></label>
        <label class="cr-field wide">Plataforma<input id="prPlataforma" maxlength="100" placeholder="Ej. Disney+ Premium" value="${esc(p?.plataforma||'')}"></label>
        <label class="cr-field">Precio normal para socio<input id="prNormal" type="number" min="0" value="${Number(p?.precioNormal)||''}" placeholder="Ej. 100"></label><label class="cr-field">Precio promo para socio<input id="prPromo" type="number" min="0" value="${Number(p?.precioPromo)||''}" placeholder="Ej. 80"></label>
        <label class="cr-field">Cupos<input id="prCupos" type="number" min="0" value="${Number(p?.cupos)||''}" placeholder="Ej. 10"></label>
        <label class="cr-field">Vigente hasta<input id="prVigencia" type="datetime-local" value="${esc(promoLocalDateValue(p?.vigencia))}"></label>
        <label class="cr-field wide">Beneficios / condiciones<textarea id="prTexto" rows="7" maxlength="1200" placeholder="Una ventaja por línea. Ej.:&#10;Perfil Premium para 1 pantalla&#10;Series, películas y estrenos&#10;Disponibilidad limitada">${esc(p?.texto||'')}</textarea><small>Una línea = un punto limpio en Telegram y en el Panel de Socios.</small></label>
        <div class="cr-field wide"><b>Destinatarios</b><small>Si no marca nombres, se enviará a todos los socios activos.</small><div id="prDestinatarios" class="promo-dest-box"><small>Cargando socios…</small></div></div>
        <label class="cr-check wide"><input type="checkbox" id="prEnviar" ${editing?'':'checked'}> ${editing?'Reenviar por Telegram al guardar los cambios':'Publicar en el Panel de Socios y enviar ahora por Telegram'}</label>
        <div id="prEstado" class="cr-field wide" style="min-height:18px"><small></small></div>
      </div>
    </section>
    <aside class="promo-preview-pane">
      <div class="promo-preview-head"><div><b>👁️ Vista previa real</b><small>Cambie entre Panel de Socios y Telegram.</small></div><div class="promo-preview-tabs"><button type="button" class="promo-preview-tab on" data-promo-view="panel">Panel</button><button type="button" class="promo-preview-tab" data-promo-view="telegram">Telegram</button></div></div>
      <div class="promo-preview-canvas" data-promo-preview-view="panel"><article class="promo-panel-mock"><div class="promo-panel-media" id="prPanelMedia"><span>La imagen promocional aparecerá aquí</span></div><div id="prPanelContent"></div></article></div>
      <div class="promo-preview-canvas" data-promo-preview-view="telegram" hidden><div class="promo-telegram-mock"><div class="promo-tg-bubble"><div class="promo-tg-media" id="prTgMedia"><span>La imagen promocional aparecerá aquí</span></div><div class="promo-live-box" id="prLiveText"></div></div></div></div>
      <div class="promo-preview-foot">La vista de Telegram reproduce la estructura real del mensaje. Si tiene Custom Emoji Premium configurados en el bot, Telegram sustituirá algunos iconos automáticamente.</div>
    </aside>
  </div>
  <div class="cr-actions promo-editor-actions"><span class="promo-action-note">Los precios mostrados son exclusivamente precios de Sublicuentas para sus socios.</span><button class="cr-btn ghost" id="prCancel">Cancelar</button><button class="cr-btn red" id="prGuardar">${editing?'Guardar cambios':'Guardar y enviar'}</button></div>`,{className:'promo-editor-modal',sheetClass:'promo-editor-sheet',wide:true});
  const setEstado=(texto,tipo='')=>{const e=m.querySelector('#prEstado small');if(e){e.textContent=texto;e.style.color=tipo==='bad'?'#b42318':tipo==='good'?'#067647':'#667085'}};
  const btn=m.querySelector('#prGuardar'),enviarCheck=m.querySelector('#prEnviar');
  const closePromo=()=>{if(typeof m._modalClose==='function')m._modalClose();else m.remove()};
  m._modalCleanup=()=>{if(m._promoPreviewUrl)URL.revokeObjectURL(m._promoPreviewUrl)};
  m.querySelector('#prCancel').onclick=closePromo;m.querySelector('#prClose').onclick=closePromo;
  enviarCheck.onchange=()=>{btn.textContent=editing?(enviarCheck.checked?'Guardar y reenviar':'Guardar cambios'):(enviarCheck.checked?'Guardar y enviar':'Guardar promoción')};
  ['#prTitulo','#prPlataforma','#prNormal','#prPromo','#prCupos','#prVigencia','#prTexto'].forEach(sel=>{const el=m.querySelector(sel);if(el)el.addEventListener('input',()=>refreshPromoPreview(m))});
  m.querySelectorAll('[data-promo-template]').forEach(x=>x.onclick=()=>applyPromoTemplate(m,x.dataset.promoTemplate));
  bindPromoPreviewTabs(m);
  const imagenInput=m.querySelector('#prImagen');
  imagenInput.addEventListener('change',()=>{const file=imagenInput.files?.[0];if(m._promoPreviewUrl){URL.revokeObjectURL(m._promoPreviewUrl);m._promoPreviewUrl=''}if(file){m._promoPreviewUrl=URL.createObjectURL(file);promoSetPreviewImage(m,m._promoPreviewUrl)}else promoSetPreviewImage(m,p?.imagenUrl||'')});
  promoSetPreviewImage(m,p?.imagenUrl||'');
  refreshPromoPreview(m);

  (async()=>{
    const box=m.querySelector('#prDestinatarios');
    try{
      if(!state.vendedores){const d=await api('GET','revendedores');state.vendedores=Array.isArray(d)?d:(d.revendedores||[])}
      if(box&&m.isConnected)box.innerHTML=promoDestinatariosHtml(p?.destinatarios||[]);
    }catch(e){
      if(box&&m.isConnected)box.innerHTML='<small>No se pudo cargar la lista. Puede guardar sin marcar nombres para enviar a todos los socios activos.</small>';
      setEstado(`Aviso: ${e.message}`,'bad');
    }
  })();

  btn.onclick=async()=>{
    btn.disabled=true;btn.textContent='Preparando…';setEstado('Validando información…');
    try{
      const titulo=m.querySelector('#prTitulo').value.trim(),plataforma=m.querySelector('#prPlataforma').value.trim();
      if(!titulo||!plataforma)throw new Error('Complete título y plataforma.');
      const imagenData=await imageData(m.querySelector('#prImagen').files[0]);
      const payload=promoPayloadFromModal(m,imagenData,p?.imagenUrl||'',p?.destinatarios||[]);
      setEstado(editing?'Guardando cambios…':'Guardando promoción…');btn.textContent='Guardando…';
      let promoId='';
      if(editing){
        await api('PUT',`promociones/${p.id}`,payload);promoId=p.id;setEstado('✅ Cambios guardados.','good');
      }else{
        const d=await api('POST','promociones',payload);promoId=d.id;setEstado('✅ Promoción guardada.','good');
      }
      if(!enviarCheck.checked){closePromo();await loadPromociones(true);return;}
      btn.textContent='Enviando Telegram…';setEstado(editing?'Cambios guardados. Reenviando promoción…':'Promoción guardada. Enviando a Telegram…','good');
      try{
        const sent=await api('POST',`promociones/${promoId}/enviar`,{});
        closePromo();await loadPromociones(true);
        alert(`${editing?'Promoción actualizada y reenviada':'Promoción publicada'}.\nTelegram enviados: ${sent.enviados||0}${sent.encolados?`\nPor bot principal: ${sent.encolados}`:''}\nPendientes/fallidos: ${sent.fallidos||0}${sent.fallbackTexto?`\nEnvíos recuperados como texto: ${sent.fallbackTexto}`:''}${sent.sinTelegram?.length?'\nSin Telegram: '+sent.sinTelegram.join(', '):''}${Array.isArray(sent.erroresTelegram)&&sent.erroresTelegram.length?'\n\nDetalle Telegram:\n'+sent.erroresTelegram.map(e=>`${e.nombre||'Socio'} (${e.telegramId||'sin ID'}): ${e.motivo||'Error'}\n${e.diagnostico||''}`).join('\n\n'):''}`);
      }catch(sendError){
        closePromo();await loadPromociones(true);
        alert(`✅ Los cambios sí quedaron guardados.\n⚠️ No se pudo completar el envío por Telegram: ${sendError.message}\nPuede usar “Reenviar Telegram” para reintentarlo.`);
      }
    }catch(e){
      alert(e.message);setEstado(e.message,'bad');btn.disabled=false;btn.textContent=editing?(enviarCheck.checked?'Guardar y reenviar':'Guardar cambios'):(enviarCheck.checked?'Guardar y enviar':'Guardar promoción');
    }
  };
}
async function enviarPromocion(id,button){if(!confirm('¿Publicar esta promoción en el panel y enviarla por Telegram?'))return;button.disabled=true;try{const d=await api('POST',`promociones/${id}/enviar`,{});alert(`Enviados: ${d.enviados||0}${d.encolados?`\nPor bot principal: ${d.encolados}`:''}\nPendientes/fallidos: ${d.fallidos||0}${d.sinTelegram?.length?'\nSin Telegram: '+d.sinTelegram.join(', '):''}${Array.isArray(d.erroresTelegram)&&d.erroresTelegram.length?'\n\nDetalle Telegram:\n'+d.erroresTelegram.map(e=>`${e.nombre||'Socio'} (${e.telegramId||'sin ID'}): ${e.motivo||'Error'}\n${e.diagnostico||''}`).join('\n\n'):''}`);await loadPromociones(true)}catch(e){alert(e.message);button.disabled=false}}
async function eliminarPromocion(id){if(!confirm('¿Eliminar esta promoción? Dejará de aparecer en el Panel de Socios.'))return;try{await api('DELETE',`promociones/${id}`);await loadPromociones(true)}catch(e){alert(e.message)}}

/* ═══════════ PRECIOS ═══════════ */
async function loadPrecios(force){
  if(state.precios&&!force) return render();
  const b=$('#revBody'); if(b) b.innerHTML='<div class="cr-empty">Cargando precios…</div>';
  try{ const d=await api('GET','precios',undefined,{tarifa:state.tarifa}); state.precios=d.precios||[]; render(); }
  catch(e){ if(b) b.innerHTML=`<div class="cr-empty">${esc(e.message)}</div>`; }
}
function precioSearchText(p){return [p.nombre,p.variante,p.categoria,p.detalle,p.entregaTipo,p.entregaCanal].filter(Boolean).join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function filterPrecioCards(value){
  state.precioQ=String(value||'');const q=state.precioQ.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  document.querySelectorAll('#revBody [data-price-card]').forEach(card=>{card.style.display=!q||String(card.dataset.search||'').includes(q)?'':'none'});
  document.querySelectorAll('#revBody [data-price-group]').forEach(group=>{const visible=[...group.querySelectorAll('[data-price-card]')].some(x=>x.style.display!=='none');group.style.display=visible?'':'none'});
}
function renderPrecios(){
  const b=$('#revBody'); if(!state.precios) return loadPrecios();
  const grupos={};
  const orden=[];
  state.precios.forEach(p=>{
    const k=p.categoria||'Sin categoría';
    if(!grupos[k]){ grupos[k]=[]; orden.push(k); }
    grupos[k].push(p);
  });
  const vacio=!state.precios.length;
  b.innerHTML=`
    <div class="cr-tools" style="flex-wrap:wrap;gap:8px">
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="cr-btn ${state.tarifa==='general'?'red':'ghost'}" data-tarifa="general">Tarifa general</button>
        <button class="cr-btn ${state.tarifa===TARIFA_ESPECIAL?'red':'ghost'}" data-tarifa="${TARIFA_ESPECIAL}">Sublicuentas · Relojes · Geisell</button>
      </div>
      <button class="cr-btn red" id="revAddPrecio">＋ Ítem nuevo</button>
    </div>
    <div class="price-toolbar"><label class="price-search">🔎 <input id="revPrecioSearch" value="${esc(state.precioQ||'')}" placeholder="Buscar Netflix, Stella, IPTV, Canva…"></label><small>Vista compacta · abra solo el producto que desea editar.</small></div>
    ${state.tarifa===TARIFA_ESPECIAL?`<div class="cr-card" style="margin-bottom:12px"><h3>Actualización de precios y vendedores</h3><small>Corrige Geissel → Geisell, actualiza sus clientes, asigna esta tarifa y crea Sublicuentas 2 con el teléfono 8946-4328.</small><div class="cr-row" style="margin-top:10px"><button class="cr-btn ghost" id="revPreviewActualizacion">Revisar cambios</button><button class="cr-btn red" id="revAplicarActualizacion">Aplicar actualización</button></div></div>`:''}
    ${vacio?`<div class="cr-empty">Catálogo vacío.<br><br>
      <button class="cr-btn red" id="revImportarInicial">📥 ${state.tarifa==='general'?'Importar catálogo inicial':'Cargar tarifa especial'}</button><br><br>
      <small>${state.tarifa==='general'?'Trae el catálogo general del Panel de Socios.':'Carga los 28 precios definidos para Sublicuentas, Relojes y Geisell.'}</small>
    </div>`:''}
    ${orden.map(cat=>`<section data-price-group><div class="cr-section">${esc(cat)} · ${grupos[cat].length}</div><div class="price-catalog-grid">${grupos[cat].map(precioCard).join('')}</div></section>`).join('')}`;
  $('#revAddPrecio').onclick=nuevoPrecio;
  if(vacio) $('#revImportarInicial').onclick=importarPreciosIniciales;
  b.querySelectorAll('[data-tarifa]').forEach(x=>x.onclick=()=>{state.tarifa=x.dataset.tarifa;state.precios=null;state.precioQ='';loadPrecios(true)});
  if($('#revPreviewActualizacion'))$('#revPreviewActualizacion').onclick=previsualizarActualizacion;
  if($('#revAplicarActualizacion'))$('#revAplicarActualizacion').onclick=aplicarActualizacion;
  b.querySelectorAll('[data-save-precio]').forEach(x=>x.onclick=()=>guardarPrecio(x.dataset.savePrecio));
  b.querySelectorAll('[data-del-precio]').forEach(x=>x.onclick=()=>eliminarPrecio(x.dataset.delPrecio));
  b.querySelectorAll('[data-toggle-precio]').forEach(x=>x.onclick=()=>togglePrecioEditor(x.dataset.togglePrecio));
  b.querySelectorAll('[data-detail-preset]').forEach(x=>x.onclick=()=>addDetallePreset(x.dataset.detailTarget,x.dataset.detailPreset));
  const q=$('#revPrecioSearch');if(q){q.oninput=()=>filterPrecioCards(q.value);filterPrecioCards(state.precioQ)}
}
async function importarPreciosIniciales(){
  const btn=$('#revImportarInicial'); if(btn){ btn.disabled=true; btn.textContent='Importando…'; }
  try{
    const ruta=state.tarifa==='general'?'precios/importar-inicial':'precios/importar-especial';
    const d=await api('POST',ruta,undefined,{tarifa:state.tarifa});
    status(state.tarifa==='general'
      ?`✅ Catálogo importado: ${d.creados||0} nuevos, ${d.actualizados||0} actualizados.`
      :`✅ Tarifa especial cargada: ${d.actualizados||0} precios.`, 'good');
    await loadPrecios(true);
  }catch(e){ status(e.message,'bad'); if(btn){ btn.disabled=false; btn.textContent='📥 Importar catálogo inicial'; } }
}
async function previsualizarActualizacion(){
  try{
    const d=await api('GET','actualizaciones/precios-agosto-2026');
    const pendientes=(d.iptvPendientes||[]).reduce((n,x)=>n+Number(x.cantidad||0),0);
    alert(`Se actualizarán ${d.clientesAActualizar||0} clientes y ${d.serviciosConRegla||0} servicios.\nRegistros Geisell encontrados: ${d.registrosGeisellEncontrados||0}.\nIPTV antiguos pendientes de identificar: ${pendientes}.`);
  }catch(e){status(e.message,'bad')}
}
async function aplicarActualizacion(){
  if(!confirm('¿Aplicar los precios especiales, corregir Geisell y crear Sublicuentas 2? Se guardará un respaldo antes de cambiar clientes.'))return;
  const btn=$('#revAplicarActualizacion');if(btn){btn.disabled=true;btn.textContent='Aplicando…'}
  try{
    const d=await api('POST','actualizaciones/precios-agosto-2026',{});
    state.precios=null;state.vendedores=null;
    await loadPrecios(true);
    const pendientes=(d.iptvPendientes||[]).reduce((n,x)=>n+Number(x.cantidad||0),0);
    status(`✅ Actualización completa: ${d.clientesActualizados||0} clientes y ${d.serviciosConRegla||0} servicios revisados.${pendientes?' '+pendientes+' IPTV antiguos quedaron para identificar.':''}`,'good');
    if(d.sublicuentas2Pin)pinModal('Sublicuentas 2',d.sublicuentas2Pin,'Usuario: sublicuentas 2 · WhatsApp: 8946-4328');
  }catch(e){status(e.message,'bad');if(btn){btn.disabled=false;btn.textContent='Aplicar actualización'}}
}
const PRICE_DETAIL_PRESETS=[
  ['👤','Perfil'],['📱','Dispositivo'],['🤖','Bot TG / código'],['🛡️','Garantía'],['📧','Correo y clave'],['🔐','PIN'],['✉️','Invitación correo'],['📡','IPTV'],['🔑','Serial / key'],['⚡','Entrega']
];
const ENTREGA_TIPOS=[['','Automático según producto'],['perfil','Perfil / nombre del cliente'],['correo','Correo del cliente'],['acceso','Usuario / acceso'],['serial','Serial / licencia'],['serial_key','Key / serial'],['detalle','Detalle manual']];
const ENTREGA_CANALES=[['manual','Manual'],['bot_tg','Bot Telegram / código'],['inventario','Inventario Sublichat'],['invitacion','Invitación al correo'],['iptv','TV Digital / IPTV']];
function adminProductIcon(p){const t=(String(p.nombre||'')+' '+String(p.categoria||'')).toLowerCase();if(t.includes('netflix'))return'🍿';if(t.includes('disney'))return'🏰';if(t.includes('max')||t.includes('hbo'))return'🎬';if(t.includes('prime'))return'📦';if(t.includes('crunchy'))return'🍥';if(t.includes('iptv')||t.includes('oleada')||t.includes('stella')||t.includes('nanotech')||t.includes('lion')||t.includes('latin'))return'📡';if(t.includes('spotify')||t.includes('deezer'))return'🎵';if(t.includes('canva'))return'🎨';if(t.includes('gemini')||t.includes('chatgpt'))return'🤖';if(t.includes('office'))return'💼';if(t.includes('antivirus')||t.includes('eset')||t.includes('mcafee'))return'🛡️';return'🧩'}
function detalleLineas(raw){return String(raw||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
function detalleIconLine(line){const x=String(line||'').trim();if(!x)return'';if(/^[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(x))return x;const t=x.toLowerCase();let i='ℹ️';if(/perfil/.test(t))i='👤';else if(/dispositivo|pantalla|reproduce/.test(t))i='📱';else if(/bot|c[oó]digo/.test(t))i='🤖';else if(/garant|ca[ií]da/.test(t))i='🛡️';else if(/invitaci[oó]n/.test(t))i='✉️';else if(/correo/.test(t))i='📧';else if(/pin/.test(t))i='🔐';else if(/iptv|tv digital|usuario/.test(t))i='📡';else if(/serial|key|licencia/.test(t))i='🔑';else if(/acceso/.test(t))i='🔐';return `${i} ${x}`}
function detallePreview(raw){const ls=detalleLineas(raw);return ls.length?ls.slice(0,4).map(x=>`<span>${esc(detalleIconLine(x))}</span>`).join(''):'<span>➕ Sin detalles configurados</span>'}
function entregaTipoLabel(v){return ({perfil:'Perfil',correo:'Correo',acceso:'Acceso',serial:'Serial',serial_key:'Key / serial',detalle:'Detalle'})[v]||'Según producto'}
function entregaCanalLabel(v){return ({manual:'Manual',bot_tg:'Bot TG',inventario:'Inventario',invitacion:'Invitación',iptv:'TV Digital'})[v]||'Manual'}
function selectOptions(rows,value){return rows.map(([v,l])=>`<option value="${esc(v)}" ${String(value||'')===v?'selected':''}>${esc(l)}</option>`).join('')}
function detailPresetButtons(target){return PRICE_DETAIL_PRESETS.map(([ico,label])=>`<button type="button" data-detail-target="${esc(target)}" data-detail-preset="${esc(ico+' '+label+': ')}">${ico} ${esc(label)}</button>`).join('')}
function addDetallePreset(target,text){const ta=document.getElementById(target);if(!ta)return;const current=ta.value.trimEnd();ta.value=(current?current+'\n':'')+String(text||'');ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length)}
function togglePrecioEditor(id,force){const el=document.getElementById('pxEditor-'+id);if(!el)return;const open=force==null?!el.classList.contains('open'):!!force;el.classList.toggle('open',open);const btn=document.querySelector(`[data-toggle-precio="${CSS.escape(id)}"]`);if(btn)btn.textContent=open?'Cerrar':'✏️ Editar'}
function precioCard(p){
  const id=p.id;
  const titulo=p.nombre+(p.variante?' · '+p.variante:'');
  const stock=p.stockModo==='manual'?(p.stockCantidad!=null?`📦 ${Number(p.stockCantidad)} manual`:'📦 Manual'):'🏬 Bodega';
  const activo=p.activo!==false;
  const canal=p.entregaCanal||'manual';
  return `<article class="price-compact-card" data-price-card data-search="${esc(precioSearchText(p))}">
    <div class="price-summary"><span class="price-icon">${adminProductIcon(p)}</span><div class="price-title"><h3>${esc(p.nombre||'Producto')}</h3><small>${esc(p.variante||p.categoria||'Sin variante')}</small></div><div class="price-amount">${p.precio==null?'Comisión':money(p.precio)}</div></div>
    <div class="price-tags"><span class="${activo?'on':'off'}">${activo?'👁 Visible':'🙈 Oculto'}</span><span>${stock}</span><span>🚚 ${esc(entregaCanalLabel(canal))}</span></div>
    <div class="price-detail-preview">${detallePreview(p.detalle)}</div>
    <div class="price-card-actions"><button class="cr-btn ghost" data-toggle-precio="${esc(id)}">✏️ Editar</button><button class="cr-btn danger" data-del-precio="${esc(id)}">Eliminar</button></div>
    <div class="price-editor" id="pxEditor-${esc(id)}"><div class="price-editor-grid">
      <label class="cr-field">Nombre<input id="pxNombre-${esc(id)}" value="${esc(p.nombre||'')}"></label>
      <label class="cr-field">Variante<input id="pxVariante-${esc(id)}" value="${esc(p.variante||'')}" placeholder="Ej. 3 dispositivos"></label>
      <label class="cr-field">Categoría<input id="pxCategoria-${esc(id)}" value="${esc(p.categoria||'')}" placeholder="Ej. 📺 Streaming"></label>
      <label class="cr-field">Precio (Lps.)<input type="number" min="0" step="1" id="pxPrecio-${esc(id)}" value="${p.precio??''}" placeholder="Vacío = Por comisión"></label>
      <label class="cr-field">Datos para procesar<select id="pxEntregaTipo-${esc(id)}">${selectOptions(ENTREGA_TIPOS,p.entregaTipo||'')}</select><small class="price-helper">Evita que el Panel de Socios tenga que adivinar si debe pedir perfil, correo, serial, etc.</small></label>
      <label class="cr-field">Flujo de entrega<select id="pxEntregaCanal-${esc(id)}">${selectOptions(ENTREGA_CANALES,canal)}</select><small class="price-helper">Este dato viaja a Panel de Socios y Bot TG. No envía credenciales automáticamente todavía.</small></label>
      <label class="cr-field wide">Detalles que verá el socio<div class="detail-preset-row">${detailPresetButtons('pxDetalle-'+id)}</div><textarea id="pxDetalle-${esc(id)}" rows="4">${esc(p.detalle||'')}</textarea><small class="price-helper">Use una línea por dato. Los iconos quedan visibles en el catálogo del socio.</small></label>
      <label class="cr-field">Inventario<select id="pxStockModo-${esc(id)}"><option value="auto" ${String(p.stockModo||'auto')==='auto'?'selected':''}>Automático · Bodega</option><option value="manual" ${String(p.stockModo||'auto')==='manual'?'selected':''}>Manual</option></select></label>
      <label class="cr-field">Estado manual<select id="pxStockEstado-${esc(id)}"><option value="" ${!p.stockEstado?'selected':''}>Según cantidad / consultar</option><option value="disponible" ${p.stockEstado==='disponible'?'selected':''}>Disponible</option><option value="bajo" ${p.stockEstado==='bajo'?'selected':''}>Poco inventario</option><option value="agotado" ${p.stockEstado==='agotado'?'selected':''}>Agotado</option><option value="consultar" ${p.stockEstado==='consultar'?'selected':''}>Consultar</option></select></label>
      <label class="cr-field">Cantidad manual<input type="number" min="0" step="1" id="pxStockCantidad-${esc(id)}" value="${p.stockCantidad??''}" placeholder="Opcional"></label>
      <label class="cr-check" style="align-self:end"><input type="checkbox" id="pxActivo-${esc(id)}" ${activo?'checked':''}> Visible para los socios</label>
    </div><div class="cr-row" style="justify-content:flex-end;margin-top:10px"><button class="cr-btn ghost" type="button" onclick="togglePrecioEditor('${esc(id)}',false)">Cancelar</button><button class="cr-btn red" data-save-precio="${esc(id)}">💾 Guardar cambios</button></div></div>
  </article>`;
}
function leerFormPrecio(id){
  const precioRaw=$('#pxPrecio-'+id)?.value;
  return {
    nombre:$('#pxNombre-'+id)?.value.trim()||'',
    variante:$('#pxVariante-'+id)?.value.trim()||'',
    categoria:$('#pxCategoria-'+id)?.value.trim()||'',
    detalle:$('#pxDetalle-'+id)?.value.trim()||'',
    precio:precioRaw===''||precioRaw==null?null:Number(precioRaw),
    entregaTipo:$('#pxEntregaTipo-'+id)?.value||'',
    entregaCanal:$('#pxEntregaCanal-'+id)?.value||'manual',
    stockModo:$('#pxStockModo-'+id)?.value||'auto',
    stockEstado:$('#pxStockEstado-'+id)?.value||'',
    stockCantidad:($('#pxStockCantidad-'+id)?.value??'')===''?null:Number($('#pxStockCantidad-'+id)?.value),
    activo:$('#pxActivo-'+id)?.checked!==false,
  };
}
async function guardarPrecio(id){
  const datos=leerFormPrecio(id);
  if(!datos.nombre){ status('Ponele un nombre al ítem.','bad'); return; }
  try{
    const d=await api('PUT','precios/'+id,datos,{tarifa:state.tarifa});
    status(d.sincronizado?'✅ Guardado y sincronizado con el Panel de Socios.':'✅ Guardado.','good');
    await loadPrecios(true);
  }catch(e){ status(e.message,'bad'); }
}
async function eliminarPrecio(id){
  if(!confirm('¿Eliminar este ítem del catálogo? Ya no lo verán los socios.')) return;
  try{ await api('DELETE','precios/'+id,undefined,{tarifa:state.tarifa}); await loadPrecios(true); }
  catch(e){ status(e.message,'bad'); }
}
function nuevoPrecio(){
  const m=modal(`<h2>Nuevo ítem del catálogo</h2>
    <div class="cr-form">
      <label class="cr-field wide">Categoría<input id="npCategoria" placeholder="Ej. 📺 Streaming"></label>
      <label class="cr-field wide">Nombre<input id="npNombre" placeholder="Ej. Netflix"></label>
      <label class="cr-field wide">Variante (opcional)<input id="npVariante" placeholder="Ej. 3 dispositivos"></label>
      <label class="cr-field wide">Precio (Lps.) — vacío = "Por comisión"<input type="number" min="0" id="npPrecio"></label>
      <label class="cr-field wide">Datos para procesar<select id="npEntregaTipo">${selectOptions(ENTREGA_TIPOS,'')}</select></label>
      <label class="cr-field wide">Flujo de entrega<select id="npEntregaCanal">${selectOptions(ENTREGA_CANALES,'manual')}</select></label>
      <label class="cr-field wide">Detalles que verá el socio<div class="detail-preset-row">${detailPresetButtons('npDetalle')}</div><textarea id="npDetalle" rows="4"></textarea></label>
      <label class="cr-field wide">Inventario<select id="npStockModo"><option value="auto">Automático · Bodega</option><option value="manual">Manual</option></select></label>
      <label class="cr-field wide">Estado manual<select id="npStockEstado"><option value="">Según cantidad / consultar</option><option value="disponible">Disponible</option><option value="bajo">Poco inventario</option><option value="agotado">Agotado</option><option value="consultar">Consultar</option></select></label>
      <label class="cr-field wide">Cantidad manual (opcional)<input type="number" min="0" id="npStockCantidad"></label>
    </div>
    <div class="cr-actions"><button class="cr-btn ghost" id="npCancel">Cancelar</button><button class="cr-btn red" id="npOk">Crear</button></div>`);
  m.querySelectorAll('[data-detail-preset]').forEach(x=>x.onclick=()=>addDetallePreset(x.dataset.detailTarget,x.dataset.detailPreset));
  $('#npCancel').onclick=()=>m.remove();
  $('#npOk').onclick=async()=>{
    const categoria=$('#npCategoria').value.trim(), nombre=$('#npNombre').value.trim();
    if(!categoria||!nombre){ alert('Completá al menos categoría y nombre.'); return; }
    const precioRaw=$('#npPrecio').value;
    try{
      await api('POST','precios',{
        categoria, nombre,
        variante:$('#npVariante').value.trim(),
        detalle:$('#npDetalle').value.trim(),
        precio:precioRaw===''?null:Number(precioRaw),
        entregaTipo:$('#npEntregaTipo').value||'',entregaCanal:$('#npEntregaCanal').value||'manual',
        stockModo:$('#npStockModo').value||'auto',stockEstado:$('#npStockEstado').value||'',
        stockCantidad:$('#npStockCantidad').value===''?null:Number($('#npStockCantidad').value),
        activo:true,tarifaId:state.tarifa,
      },{tarifa:state.tarifa});
      m.remove(); await loadPrecios(true);
    }catch(e){ alert(e.message); }
  };
}

/* ═══════════ VENDEDORES ═══════════ */
async function loadVendedores(force){
  if(state.vendedores&&!force) return render();
  const b=$('#revBody'); if(b) b.innerHTML='<div class="cr-empty">Cargando vendedores…</div>';
  try{
    const d=await api('GET','revendedores');
    state.vendedores=Array.isArray(d)?d:(d.revendedores||[]);
    render();
  }catch(e){ if(b) b.innerHTML=`<div class="cr-empty">${esc(e.message)}</div>`; }
}
function renderVendedores(){
  const b=$('#revBody'); if(!state.vendedores) return loadVendedores();
  b.innerHTML=`
    <div class="cr-tools"><span></span><button class="cr-btn red" id="revAddVendedor">＋ Vendedor</button></div>
    <div class="cr-grid">${state.vendedores.map(vendedorCard).join('')||'<div class="cr-empty">No hay vendedores.</div>'}</div>`;
  $('#revAddVendedor').onclick=nuevoVendedor;
  b.querySelectorAll('[data-edit-vend]').forEach(x=>x.onclick=()=>editarVendedor(x.dataset.editVend));
  b.querySelectorAll('[data-pin-vend]').forEach(x=>x.onclick=()=>resetPinVendedor(x.dataset.pinVend));
  b.querySelectorAll('[data-test-tg]').forEach(x=>x.onclick=()=>probarTelegramVendedor(x.dataset.testTg,x));
  b.querySelectorAll('[data-del-vend]').forEach(x=>x.onclick=()=>eliminarVendedor(x.dataset.delVend,x.dataset.nombre));
  b.querySelectorAll('[data-toggle-vend]').forEach(x=>x.onclick=()=>toggleActivoVendedor(x.dataset.toggleVend,x.dataset.activo==='1'));
}
function vendedorCard(r){
  const activo=r.activo!==false;
  return `<article class="cr-card">
    <div class="cr-row"><h3>${esc(r.nombre)}</h3><span class="cr-badge ${activo?'':'paused'}">${activo?'Activo':'Inactivo — no puede entrar'}</span></div>
    <small>Usuario: ${esc(r.nombre_norm||r.id)} · WhatsApp: ${esc(r.telefono||'—')} · TG: ${esc(r.telegramId||'—')}</small>
    <div class="cr-row"><small>${r.clientes||0} clientes · ${r.vencidos||0} vencidos · Tarifa: ${esc(r.tarifaId||'general')}</small></div>
    <div class="cr-row"><small>Permisos: ${(r.capabilities?.canViewClients??true)?'Clientes ✓':'Clientes —'} · ${(r.capabilities?.canRenew??true)?'Renovar ✓':'Renovar —'} · ${(r.capabilities?.canBuy??!r.sinCompras)?'Comprar ✓':'Comprar —'} · ${(r.capabilities?.canUseAI??true)?'IA ✓':'IA —'}</small></div>
    <div class="cr-row">
      <button class="cr-btn ghost" data-edit-vend="${esc(r.id)}">Editar</button>
      <button class="cr-btn ghost" data-pin-vend="${esc(r.id)}">🔐 Nuevo PIN</button>
      <button class="cr-btn ghost" data-test-tg="${esc(r.id)}">📨 Probar TG</button>
    </div>
    <div class="cr-row">
      <button class="cr-btn ${activo?'danger':'red'}" data-toggle-vend="${esc(r.id)}" data-activo="${activo?'1':'0'}">${activo?'🔒 Desactivar acceso':'🔓 Reactivar acceso'}</button>
      <button class="cr-btn danger" data-del-vend="${esc(r.id)}" data-nombre="${esc(r.nombre)}">Eliminar</button>
    </div>
  </article>`;
}
async function probarTelegramVendedor(id,button){
  const r=state.vendedores.find(x=>x.id===id);
  if(!r)return;
  if(!r.telegramId){alert(`${r.nombre} no tiene Telegram ID guardado.`);return;}
  const original=button.textContent;button.disabled=true;button.textContent='Probando…';
  try{
    const d=await api('POST',`revendedores/${id}/testtelegram`,{});
    if(d.queued){
      alert(`📨 Prueba enviada al bot principal para ${d.nombre||r.nombre}.\nID: ${d.telegramId||r.telegramId}\n\n${d.diagnostico||'La prueba quedó en cola y debe llegar en segundos.'}`);
    }else{
      alert(`✅ Telegram correcto para ${d.nombre||r.nombre}.\nID: ${d.telegramId||r.telegramId}${d.telegramNombre?`\nCuenta: ${d.telegramNombre}`:''}${d.username?` (@${d.username})`:''}\n\n${d.diagnostico||'Puede recibir mensajes del bot.'}`);
    }
  }catch(e){
    const d=e.data||{};
    const authFail=Number(d.codigo||0)===401||/unauthorized|token/i.test(String(d.error||e.message||''));
    alert(`❌ Telegram de ${r.nombre} falló.\nID guardado: ${d.telegramId||r.telegramId}\n${d.error||e.message}${d.diagnostico?`\n\n${d.diagnostico}`:''}${authFail?'\n\n⚠️ Este error es del BOT_TOKEN, no del ID del vendedor.':'\n\nPídale escribir /id al MISMO bot de Sublicuentas y compare el número con el que aparece aquí.'}`);
  }finally{button.disabled=false;button.textContent=original;}
}

async function toggleActivoVendedor(id,estabaActivo){
  const accion=estabaActivo?'desactivar':'reactivar';
  if(!confirm(estabaActivo?'¿Desactivar a este vendedor? No va a poder entrar al panel hasta que lo reactivés.':'¿Reactivar a este vendedor?')) return;
  try{ await api('PATCH','revendedores/'+id,{activo:!estabaActivo}); status(estabaActivo?'🔒 Acceso desactivado.':'🔓 Acceso reactivado.','good'); await loadVendedores(true); }
  catch(e){ alert(e.message); }
}
function nuevoVendedor(){
  const m=modal(`<h2>Nuevo vendedor</h2>
    <div class="cr-form">
      <label class="cr-field wide">Nombre<input id="nvNombre" placeholder="Ej. Juan Pérez"></label>
      <label class="cr-field wide">WhatsApp<input id="nvTelefono" inputmode="tel" placeholder="Ej. 8946-4328"></label>
      <label class="cr-field wide">ID de Telegram (opcional)<input id="nvTelegram" placeholder="Ej. 123456789"></label>
    </div>
    <div class="cr-actions"><button class="cr-btn ghost" id="nvCancel">Cancelar</button><button class="cr-btn red" id="nvOk">Crear</button></div>`);
  $('#nvCancel').onclick=()=>m.remove();
  $('#nvOk').onclick=async()=>{
    const nombre=$('#nvNombre').value.trim(), telegramId=$('#nvTelegram').value.trim(), telefono=$('#nvTelefono').value.trim();
    if(!nombre||(!telefono&&!telegramId)){ alert('Completá el nombre y al menos WhatsApp o ID de Telegram.'); return; }
    try{
      const d=await api('POST','revendedores',{nombre,telegramId,telefono});
      m.remove();
      pinModal(d.nombre,d.pin,`Usuario de acceso: ${d.nombre_norm}`);
      await loadVendedores(true);
    }catch(e){ alert(e.message); }
  };
}
function editarVendedor(id){
  const r=state.vendedores.find(x=>x.id===id); if(!r) return;
  const c=r.capabilities||r.permisos||{};
  const checked=(k,def=true)=>(typeof c[k]==='boolean'?c[k]:def)?'checked':'';
  const m=modal(`<h2>Editar vendedor</h2>
    <div class="cr-form">
      <label class="cr-field wide">Nombre<input id="evNombre" value="${esc(r.nombre)}"></label>
      <label class="cr-field wide">WhatsApp<input id="evTelefono" value="${esc(r.telefono||'')}"></label>
      <label class="cr-field wide">ID de Telegram (opcional)<input id="evTelegram" value="${esc(r.telegramId||'')}"></label>
      <label class="cr-field wide">Tarifa<select id="evTarifa"><option value="general" ${(r.tarifaId||'general')==='general'?'selected':''}>General</option><option value="${TARIFA_ESPECIAL}" ${r.tarifaId===TARIFA_ESPECIAL?'selected':''}>Sublicuentas · Relojes · Geisell</option></select></label>
      <label class="cr-field wide">Texto del botón de renovación (opcional)<input id="evEtiqueta" maxlength="60" value="${esc(r.etiquetaRenovacion||'')}" placeholder="Ej. Mensaje de renovación"></label>
      <label class="cr-check"><input type="checkbox" id="evActivo" ${r.activo!==false?'checked':''}> Cuenta activa</label>
      <div class="wide"><b style="font-size:13px">Permisos del panel</b><div class="perm-grid" style="margin-top:7px">
        <label class="cr-check"><input type="checkbox" id="evCanClients" ${checked('canViewClients',true)}> Ver clientes</label>
        <label class="cr-check"><input type="checkbox" id="evCanRenew" ${checked('canRenew',true)}> Renovar clientes</label>
        <label class="cr-check"><input type="checkbox" id="evCanBuy" ${checked('canBuy',!r.sinCompras)}> Realizar compras</label>
        <label class="cr-check"><input type="checkbox" id="evCanAI" ${checked('canUseAI',true)}> Subli IA / Aula</label>
        <label class="cr-check"><input type="checkbox" id="evCanRewards" ${checked('recompensas',true)}> Recompensas</label>
        <label class="cr-check"><input type="checkbox" id="evCanInbox" ${checked('buzon',true)}> Buzón</label>
      </div></div>
      <small>Los permisos nuevos se reflejan en sesiones abiertas cuando el panel sincroniza el perfil. El usuario de acceso (${esc(r.nombre_norm)}) no se cambia aquí.</small>
    </div>
    <div class="cr-actions"><button class="cr-btn ghost" id="evCancel">Cancelar</button><button class="cr-btn red" id="evOk">Guardar</button></div>`);
  $('#evCancel').onclick=()=>m.remove();
  $('#evOk').onclick=async()=>{
    const canViewClients=$('#evCanClients').checked,canRenew=$('#evCanRenew').checked,canBuy=$('#evCanBuy').checked,canUseAI=$('#evCanAI').checked;
    const capabilities={inicio:true,clientes:canViewClients,catalogo:true,renovar:canRenew,comprar:canBuy,aula:canUseAI,perfil:true,recompensas:$('#evCanRewards').checked,buzon:$('#evCanInbox').checked,canViewClients,canRenew,canBuy,canUseAI};
    try{
      await api('PATCH','revendedores/'+id,{nombre:$('#evNombre').value.trim(),telefono:$('#evTelefono').value.trim(),telegramId:$('#evTelegram').value.trim(),activo:$('#evActivo').checked,tarifaId:$('#evTarifa').value,etiquetaRenovacion:$('#evEtiqueta').value.trim(),capabilities});
      m.remove(); await loadVendedores(true);
    }catch(e){ alert(e.message); }
  };
}
async function resetPinVendedor(id){
  if(!confirm('¿Generar un PIN nuevo? La clave actual del vendedor queda invalidada.')) return;
  try{ const d=await api('POST','revendedores/'+id+'/resetpin'); pinModal(d.nombre,d.pin,'PIN reiniciado — la clave anterior ya no sirve.'); }
  catch(e){ alert(e.message); }
}
async function eliminarVendedor(id,nombre){
  if(!confirm(`¿Eliminar a ${nombre}? Sus clientes NO se borran, pero quedan sin vendedor asignado.`)) return;
  try{ await api('DELETE','revendedores/'+id); await loadVendedores(true); }
  catch(e){ alert(e.message); }
}
function pinModal(nombre,pin,nota){
  const m=modal(`<h2>👤 ${esc(nombre)}</h2>
    <p>PIN de configuración (de un solo uso) — pásaselo por un canal de confianza. Lo necesita la primera vez que entre al panel:</p>
    <div class="cr-price" style="font-size:32px;text-align:center;letter-spacing:4px">${esc(pin)}</div>
    <small>${esc(nota||'')}</small>
    <div class="cr-actions"><button class="cr-btn red" id="pinOk">Listo</button></div>`);
  $('#pinOk').onclick=()=>m.remove();
}

/* ═══════════ CLIENTES ═══════════ */
async function loadClientesList(){
  const b=$('#revBody');
  try{
    const d=await api('GET','clientes',undefined,state.clienteQ?{q:state.clienteQ}:{});
    state.clientes=d.clientes||[];
    renderClientesList();
  }catch(e){ if(b) b.innerHTML=`<div class="cr-empty">${esc(e.message)}</div>`; }
}
function renderClientes(){
  const b=$('#revBody');
  b.innerHTML=`
    <div class="cr-tools"><input class="cr-search" id="revCliSearch" placeholder="Buscar cliente por nombre o teléfono" value="${esc(state.clienteQ)}"></div>
    <div class="cr-card" style="margin-bottom:12px"><h3>Vendedor por cuenta</h3><small>La migración copia el vendedor actual a cada servicio antiguo y crea un respaldo. Después podrá transferir cuentas individuales sin mover las demás.</small><div class="cr-row" style="margin-top:10px"><button class="cr-btn ghost" id="revPreviewVendedoresServicio">Revisar migración</button><button class="cr-btn red" id="revAplicarVendedoresServicio">Aplicar migración</button></div></div>
    <div id="revCliList"><div class="cr-empty">Escribí para buscar, o dejá vacío y Enter para ver los últimos.</div></div>
    <div id="revCliDetalle"></div>`;
  const inp=$('#revCliSearch');
  inp.onkeydown=e=>{ if(e.key==='Enter'){ state.clienteQ=inp.value.trim(); loadClientesList(); } };
  $('#revPreviewVendedoresServicio').onclick=previsualizarVendedoresServicio;
  $('#revAplicarVendedoresServicio').onclick=aplicarVendedoresServicio;
}
async function previsualizarVendedoresServicio(){
  try{
    const d=await api('GET','actualizaciones/vendedores-por-servicio');
    alert(`Clientes a actualizar: ${d.clientesAActualizar||0}.\nServicios que heredarán vendedor: ${d.serviciosQueHeredaranVendedor||0}.\nServicios sin vendedor para revisión manual: ${d.serviciosSinVendedor||0}.`);
  }catch(e){status(e.message,'bad')}
}
async function aplicarVendedoresServicio(){
  if(!confirm('¿Aplicar el vendedor por cuenta? Se guardará un respaldo antes de modificar cada ficha.'))return;
  const btn=$('#revAplicarVendedoresServicio');if(btn){btn.disabled=true;btn.textContent='Aplicando…'}
  try{
    const d=await api('POST','actualizaciones/vendedores-por-servicio',{});
    status(`✅ Migración completa: ${d.clientesActualizados||0} clientes actualizados. ${d.serviciosSinVendedor||0} servicios quedaron para revisión manual.`,'good');
    await loadClientesList();
  }catch(e){status(e.message,'bad');if(btn){btn.disabled=false;btn.textContent='Aplicar migración'}}
}
function renderClientesList(){
  const box=$('#revCliList'); if(!box) return;
  box.innerHTML=`<div class="cr-grid">${(state.clientes||[]).map(c=>`
    <article class="cr-card">
      <h3>${esc(c.nombre)}</h3>
      <small>${esc(c.telefono||'sin teléfono')} · ${c.clienteCompartido?'🔀 compartido: ':'vendedor: '}${esc(c.vendedor||(Array.isArray(c.vendedores)?c.vendedores.join(' + '):c.vendedor_norm)||'—')}</small>
      <div class="cr-row"><small>${c.servicios} servicio(s)</small><button class="cr-btn ghost" data-ver-cliente="${esc(c.id)}">Ver</button></div>
    </article>`).join('')||'<div class="cr-empty">Sin resultados.</div>'}</div>`;
  box.querySelectorAll('[data-ver-cliente]').forEach(x=>x.onclick=()=>verCliente(x.dataset.verCliente));
}
async function verCliente(id){
  const box=$('#revCliDetalle'); box.innerHTML='<div class="cr-empty">Cargando…</div>';
  try{
    const d=await api('GET','clientes/'+id);
    state.clienteSel=d.cliente;
    if(!state.vendedores) await loadVendedores(); // para el selector de reasignar
    renderClienteDetalle();
  }catch(e){ box.innerHTML=`<div class="cr-empty">${esc(e.message)}</div>`; }
}
function renderClienteDetalle(){
  const box=$('#revCliDetalle'); const c=state.clienteSel; if(!c) return;
  const servicios=Array.isArray(c.servicios)?c.servicios:[];
  const vendedoresResumen=[...new Set(servicios.map(s=>s.vendedor).filter(Boolean))];
  box.innerHTML=`<div class="cr-card" style="margin-top:12px">
    <h2>👤 ${esc(c.nombrePerfil||c.nombre||'Cliente')}</h2>
    <small>${vendedoresResumen.length>1?'🔀 Cliente compartido · ':''}Vendedores por cuenta: ${esc(vendedoresResumen.join(' + ')||c.vendedor||'—')}</small>
    <div class="cr-form">
      <label class="cr-field">Nombre<input id="cdNombre" value="${esc(c.nombrePerfil||c.nombre||'')}"></label>
      <label class="cr-field">Teléfono<input id="cdTelefono" value="${esc(c.telefono||'')}"></label>
    </div>
    <div class="cr-actions">
      <button class="cr-btn danger" id="cdDelete">Eliminar cliente</button>
      <button class="cr-btn red" id="cdSave">💾 Guardar datos</button>
    </div>
    <div class="cr-section">Servicios</div>
    <div class="cr-grid">${servicios.map((s,i)=>servicioCard(s,i,c)).join('')||'<div class="cr-empty">Sin servicios.</div>'}</div>
  </div>`;
  $('#cdSave').onclick=async()=>{
    try{
      await api('PATCH','clientes/'+c.id,{nombrePerfil:$('#cdNombre').value.trim(),telefono:$('#cdTelefono').value.trim()});
      status('✅ Datos guardados.','good'); await verCliente(c.id);
    }catch(e){ alert(e.message); }
  };
  $('#cdDelete').onclick=async()=>{
    if(!confirm('¿Eliminar este cliente por completo? No se puede deshacer.')) return;
    try{ await api('DELETE','clientes/'+c.id); box.innerHTML=''; state.clienteSel=null; await loadClientesList(); }
    catch(e){ alert(e.message); }
  };
  box.querySelectorAll('[data-save-servicio]').forEach(x=>x.onclick=()=>guardarServicio(c.id,x.dataset.saveServicio));
  box.querySelectorAll('[data-del-servicio]').forEach(x=>x.onclick=()=>eliminarServicio(c.id,x.dataset.delServicio));
}
function servicioCard(s,idx,c){
  const actualRaw=String(s.vendedor_norm||s.vendedor||c?.vendedor_norm||c?.vendedor||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  const actual=actualRaw==='geissel'?'geisell':actualRaw;
  const conocidos=state.vendedores||[];
  const tieneActual=conocidos.some(v=>String(v.nombre_norm||v.id||'')===actual);
  const opciones=(tieneActual?'':`<option value="${esc(actual)}" selected>${esc(s.vendedor||actual||'Sin vendedor')}</option>`)+conocidos.map(v=>{
    const vn=String(v.nombre_norm||v.id||'');
    return `<option value="${esc(vn)}" ${vn===actual?'selected':''}>${esc(v.nombre||vn)}</option>`;
  }).join('');
  return `<article class="cr-card">
    <h3>${esc(s.plataforma||'Servicio')}</h3>
    <label class="cr-field">Vendedor responsable<select id="svVendedor-${idx}">${opciones}</select></label>
    <label class="cr-field">Precio<input type="number" min="0" step="1" id="svPrecio-${idx}" value="${s.precio??''}"></label>
    <label class="cr-field">Vencimiento (DD/MM/AAAA)<input id="svFecha-${idx}" value="${esc(s.fechaRenovacion||'')}"></label>
    <label class="cr-field">Correo<input id="svCorreo-${idx}" value="${esc(s.correo||'')}"></label>
    <label class="cr-field">Clave<input id="svClave-${idx}" value="${esc(s.clave||'')}"></label>
    <label class="cr-field">PIN<input id="svPin-${idx}" value="${esc(s.pin||'')}"></label>
    <div class="cr-row">
      <button class="cr-btn danger" data-del-servicio="${idx}">Eliminar servicio</button>
      <button class="cr-btn red" data-save-servicio="${idx}">💾 Guardar</button>
    </div>
  </article>`;
}
async function guardarServicio(clienteId,idx){
  const patch={};
  const precio=Number($('#svPrecio-'+idx)?.value);
  if(Number.isFinite(precio)&&precio>0) patch.precio=precio;
  const fecha=$('#svFecha-'+idx)?.value.trim(); if(fecha) patch.fechaRenovacion=fecha;
  patch.correo=$('#svCorreo-'+idx)?.value.trim()||'';
  patch.clave=$('#svClave-'+idx)?.value.trim()||'';
  patch.pin=$('#svPin-'+idx)?.value.trim()||'';
  patch.vendedor_norm=$('#svVendedor-'+idx)?.value||'';
  const vendedor=(state.vendedores||[]).find(v=>String(v.nombre_norm||v.id)===patch.vendedor_norm);
  patch.vendedor=vendedor?.nombre||patch.vendedor_norm;
  patch.compraId=String(state.clienteSel?.servicios?.[idx]?.compraId||'');
  try{
    await api('PATCH',`clientes/${clienteId}/servicios/${idx}`,patch);
    status('✅ Servicio actualizado.','good');
    await verCliente(clienteId);
  }catch(e){ alert(e.message); }
}
async function eliminarServicio(clienteId,idx){
  if(!confirm('¿Eliminar este servicio del cliente?')) return;
  try{ await api('DELETE',`clientes/${clienteId}/servicios/${idx}`,undefined,{compraId:String(state.clienteSel?.servicios?.[idx]?.compraId||'')}); await verCliente(clienteId); }
  catch(e){ alert(e.message); }
}

/* ═══════════ RECOMPENSAS ═══════════ */
async function loadRecompensas(force){
  if(state.recompensas&&!force)return renderRecompensas();
  const b=$('#revBody');if(b)b.innerHTML='<div class="cr-empty">Cargando recompensas…</div>';
  try{const d=await api('GET','recompensas');state.recompensas=d.recompensas||[];renderRecompensas()}catch(e){if(b)b.innerHTML=`<div class="cr-empty">${esc(e.message)}</div>`}
}
function renderRecompensas(){
  const b=$('#revBody');if(!state.recompensas)return loadRecompensas();
  b.innerHTML=`<div class="cr-tools"><span>Solicitudes de premios de los socios</span><button class="cr-btn ghost" id="rewardReload">Actualizar</button></div><div class="cr-grid">${state.recompensas.map(r=>`<article class="cr-card"><div class="cr-row"><h3>🎁 ${esc(r.recompensa||'Recompensa')}</h3><span class="cr-badge ${r.estado==='entregada'?'':r.estado==='rechazada'?'paused':''}">${esc(r.estado||'pendiente')}</span></div><small>Socio: ${esc(r.socio||r.socio_norm||'—')} · Nivel ${esc(r.nivel||'—')} · ${Number(r.ventas)||0} ventas</small><div class="cr-row"><button class="cr-btn danger" data-reward-status="rechazada" data-reward-id="${esc(r.id)}">Rechazar</button><button class="cr-btn red" data-reward-status="entregada" data-reward-id="${esc(r.id)}">✓ Marcar entregada</button></div></article>`).join('')||'<div class="cr-empty">No hay solicitudes de recompensa.</div>'}</div>`;
  $('#rewardReload').onclick=()=>loadRecompensas(true);
  b.querySelectorAll('[data-reward-id]').forEach(x=>x.onclick=()=>setRewardStatus(x.dataset.rewardId,x.dataset.rewardStatus));
}
async function setRewardStatus(id,estado){try{await api('PATCH','recompensas/'+id,{estado});await loadRecompensas(true)}catch(e){alert(e.message)}}

/* ═══════════ util modal ═══════════ */
function modal(innerHtml,opts={}){
  const overlay=document.createElement('div');
  overlay.className=`cr-modal${opts.className?' '+opts.className:''}`;overlay.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.48);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px';
  const sheetClass=`cr-sheet${opts.sheetClass?' '+opts.sheetClass:''}`;
  const widthStyle=opts.wide?'max-width:1180px;':'max-width:460px;';
  overlay.innerHTML=`<div class="${sheetClass}" style="background:#fff;border-radius:18px;padding:20px;${widthStyle}width:100%;max-height:85vh;overflow:auto">${innerHtml}</div>`;
  const close=()=>{try{overlay._modalCleanup?.()}catch(_){ }document.removeEventListener('keydown',onKey);overlay.remove()};
  const onKey=e=>{if(e.key==='Escape'&&overlay.isConnected)close()};
  overlay._modalClose=close;
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  document.addEventListener('keydown',onKey);
  document.body.appendChild(overlay);
  return overlay;
}

/* ═══════════ init ═══════════ */
function init(){
  shell();
  const screen=document.getElementById('screen-revendedores');
  if(screen?.classList.contains('active')) loadPrecios();
}
window.SublichatRevendedores={open:()=>{ shell(); loadPrecios(); },reload:()=>{ state.precios=null; state.vendedores=null; state.clientes=null; state.recompensas=null; state.promociones=null; state.pedidos=null; render(); }};
document.addEventListener('DOMContentLoaded',init);
new MutationObserver(()=>{
  const s=document.getElementById('screen-revendedores');
  if(s?.classList.contains('active')){ shell(); if(!state.precios) loadPrecios(); }
}).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
})();
