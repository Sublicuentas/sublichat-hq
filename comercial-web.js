/* comercial-web.js · R209 — GESTIÓN COMERCIAL en Sublichat Web (Sublicuentas, Relojes y Geisell).
   Panel (meta, 3 categorías, agenda de hoy, rendimiento) · listas con buscador, filtros y checklist · ficha por servicio ·
   biblioteca de 120 plantillas con vista previa editable · registrar contacto/resultado · reportes y Excel de 10 hojas.
   Reglas: nunca envía mensajes (abre WhatsApp y el vendedor CONFIRMA), nunca registra ventas (vincula una venta de
   Finanzas), no muestra correos, claves ni PIN, y no toca Control Maestro, Cobros, Recordatorios ni Finanzas. */
(function () {
  'use strict';
  var HOST_ID = 'rbac-comercial';
  var IMG = function (k) { return '/assets/comercial/' + k + '.webp'; };
  var CAT = { vencidos: { n: 'Clientes vencidos', c: 'Recuperar renovaciones', ico: 'vencidos', tono: 'r' }, fidelizar: { n: 'Clientes por fidelizar', c: 'Convertir en recurrentes', ico: 'fidelizar', tono: 'a' }, potenciales: { n: 'Clientes potenciales', c: 'Cotizaciones pendientes', ico: 'potenciales', tono: 'y' } };
  var ORD = ['vencidos', 'fidelizar', 'potenciales'];
  var USU = { sublicuentas: 'Sublicuentas', relojes: 'Relojes', geisell: 'Geisell' };
  var CICLO = { toca: ['Toca hoy', 'r'], programado: ['Programado', 'a'], vigente: ['Aún vigente', 'v'], cerrado: ['Cerrado', 'g'], revision: ['Revisión manual', 'y'], bloqueado: ['No contactar', 'g'], no_verificable: ['No verificable', 'y'] };
  var st = { vista: 'panel', panel: null, cat: 'vencidos', f: { filtro: 'todos', q: '', plataforma: '', vendedor: '', responsable: '', dias: '', estado: '' }, pagina: 1, lista: null, sel: {}, cargando: false, pl: null, plF: { cat: '', sit: '', q: '' }, rep: { periodo: 'mes', desde: '', hasta: '', usuario: '', plataforma: '', categoria: '' }, repData: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function L(v) { var n = Number(v); return isFinite(n) && v !== null && v !== '' ? 'L' + n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'; }
  function fecha(ymd) { if (!ymd) return '—'; var p = String(ymd).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : esc(ymd); }
  function hoy() { return (st.panel && st.panel.hoy) || new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10); }
  function sumar(ymd, n) { return new Date(Date.parse(ymd + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
  function host() { return document.getElementById(HOST_ID); }
  function toast(m, malo) { try { if (window.mostrarToast) return window.mostrarToast((malo ? '⚠️ ' : '') + m); } catch (_) {} var t = document.createElement('div'); t.className = 'gc-toast' + (malo ? ' mal' : ''); t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3800); }
  // APK: la app inyecta window.ComercialConfig { post, abrir } (su sesión y su forma de abrir WhatsApp). Web: fetch normal.
  function cfg() { return window.ComercialConfig || null; }
  async function api(accion, body) {
    var c = cfg(); if (c && c.post) return c.post(Object.assign({ accion: accion }, body || {}));
    var r, j; for (var i = 0; i < 3; i++) { try { r = await fetch('/api/comercial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ accion: accion, origen: 'web' }, body || {})) }); break; } catch (e) { if (i === 2) throw new Error('Sin conexión con el servidor. Intente de nuevo.'); await new Promise(function (ok) { setTimeout(ok, 600 * (i + 1)); }); } }
    j = await r.json().catch(function () { return {}; }); if (!j.ok) throw new Error(j.error || 'No se pudo completar.'); return j;
  }
  function pill(map, k) { var x = map[k] || [k || '—', 'g']; return '<span class="gc-pill ' + x[1] + '">' + esc(x[0]) + '</span>'; }
  function estLabel(k) { var E = (st.panel && st.panel.estados) || {}; return (E[k] && E[k].label) || k || ''; }
  function waLink(tel, texto) { var d = String(tel || '').replace(/\D/g, ''); return d ? 'https://wa.me/' + d + (texto ? '?text=' + encodeURIComponent(texto) : '') : ''; }

  // ------------------------------------------------------------------------------------------------ marco
  function pintar() {
    var h = host(); if (!h) return;
    var tabs = [['panel', 'Panel'], ['vencidos', 'Vencidos'], ['fidelizar', 'Por fidelizar'], ['potenciales', 'Potenciales'], ['biblioteca', 'Biblioteca de mensajes'], ['reportes', 'Reportes']];
    var actual = st.vista === 'lista' ? st.cat : st.vista;
    h.innerHTML = '<div class="gc">' +
      '<div class="gc-head"><img class="gc-head-ico" src="' + IMG('megafono') + '" alt=""><div><h1>Gestión comercial</h1><p>Crecimiento y fidelización · ' + esc((st.panel && st.panel.nombreUsuario) || '') + '</p></div><img class="gc-bot" src="/assets/sublirobot-96.webp" alt="Sublirobot"></div>' +
      '<nav class="gc-tabs" role="tablist">' + tabs.map(function (t) { var n = st.panel && st.panel.conteos && st.panel.conteos[t[0]]; return '<button type="button" role="tab" aria-selected="' + (actual === t[0]) + '" class="' + (actual === t[0] ? 'on' : '') + '" data-gc-ir="' + t[0] + '">' + esc(t[1]) + (n != null ? ' <span>' + n + '</span>' : '') + '</button>'; }).join('') + '</nav>' +
      '<div class="gc-cuerpo">' + cuerpo() + '</div></div>';
  }
  function cuerpo() {
    if (st.error) return '<div class="gc-vacio mal">' + esc(st.error) + ' <button type="button" class="gc-btn sec sm" data-gc="recargar">Reintentar</button></div>';
    if (st.vista === 'panel') return vPanel();
    if (st.vista === 'lista') return vLista();
    if (st.vista === 'biblioteca') return vBiblioteca();
    if (st.vista === 'reportes') return vReportes();
    return '';
  }
  function cargando() { return '<div class="gc-vacio"><span class="gc-spin"></span> Cargando…</div>'; }

  // ------------------------------------------------------------------------------------------------ PANEL
  function vPanel() {
    var p = st.panel; if (!p) return cargando();
    var m = p.meta || {}, pct = m.objetivo ? Math.min(100, Math.round((m.actual / m.objetivo) * 100)) : 0, r = p.hoyRend || {};
    return '<section class="gc-meta"><img src="' + IMG('diana') + '" alt=""><div class="gc-meta-t"><b>Meta ' + esc(mesNombre(m.mes)) + '</b><div class="gc-meta-n"><strong>' + m.actual + '</strong> / ' + (m.objetivo || '—') + ' clientes vigentes</div><div class="gc-bar"><i style="width:' + pct + '%"></i></div><small>' + (m.referencia ? 'Referencia ' + m.referencia + ' · ' : '') + 'Faltan ' + Math.max(0, (m.objetivo || 0) - m.actual) + ' · la meta no es un resultado: se cuenta con las fichas reales de hoy.</small></div>' + (p.esAdmin ? '<button type="button" class="gc-btn sec sm" data-gc="meta">Editar meta</button>' : '') + '</section>' +
      '<section class="gc-cards">' + ORD.map(function (k) { return '<button type="button" class="gc-card ' + CAT[k].tono + '" data-gc-ir="' + k + '"><img src="' + IMG(CAT[k].ico) + '" alt=""><span><b>' + CAT[k].n + '</b><small>' + CAT[k].c + '</small></span><strong>' + (p.conteos[k] || 0) + '</strong></button>'; }).join('') + '</section>' +
      '<section class="gc-box"><div class="gc-box-h"><h2>Agenda comercial de hoy</h2><button type="button" class="gc-ib" data-gc="recargar" title="Actualizar">↻</button></div><ul class="gc-agenda">' +
      p.agenda.map(function (a) { var lista = Math.min(a.meta, a.pendientes + a.hechos), hecho = lista > 0 && a.hechos >= lista; return '<li class="' + CAT[a.cat].tono + (hecho ? ' hecho' : '') + '"><span class="gc-check" aria-label="' + (hecho ? 'Completado' : 'Pendiente') + '">' + (hecho ? '✓' : '') + '</span><time>' + hora12(a.hora) + '</time><b>' + esc(a.nombre) + '</b><span class="gc-ag-n">' + a.hechos + ' / ' + a.meta + ' contactos · ' + a.pendientes + ' por atender</span><button type="button" class="gc-btn sm" data-gc-ir="' + a.cat + '" data-gc-filtro="hoy">Abrir</button></li>'; }).join('') +
      '</ul><p class="gc-nota">Las metas dependen de los contactos elegibles: no obligan a escribir a quien no toca. 10–12 y 7 p.&nbsp;m. siguen en Cobros; el cierre de las 9 p.&nbsp;m. es provisional.</p></section>' +
      '<section class="gc-accesos"><button type="button" class="gc-acc" data-gc-ir="biblioteca"><img src="' + IMG('mensajes') + '" alt=""><b>Biblioteca de mensajes</b></button><button type="button" class="gc-acc y" data-gc-ir="reportes"><img src="' + IMG('reportes') + '" alt=""><b>Reportes y Excel</b></button></section>' +
      '<section class="gc-box"><h2>Rendimiento de hoy</h2><div class="gc-kpis">' +
      kpi('contactos', 'Contactos confirmados', r.contactos + ' <small>/ ' + r.metaNominal + '</small>', 'Meta disponible hoy: ' + r.metaDisponible) +
      kpi('recuperados', 'Recuperados', r.recuperados == null ? '—' : r.recuperados, 'Desde la foto de apertura' + (p.fotoApertura ? ' (' + p.fotoApertura.total + ' vigentes)' : '')) +
      kpi('ventas', 'Ventas vinculadas', r.ventas, 'Equipo: ' + (r.equipo ? r.equipo.ventas : 0) + ' · contactos ' + (r.equipo ? r.equipo.enviados : 0)) +
      '<div class="gc-kpi-mini"><span>Nuevos hoy <b>' + (r.nuevos == null ? '—' : r.nuevos) + '</b></span><span>Perdidos hoy <b>' + (r.perdidos == null ? '—' : r.perdidos) + '</b></span><span>Compras verificables desde <b>' + fecha(p.desdeVerificable) + '</b></span></div></div></section>';
  }
  function kpi(ico, t, v, s) { return '<div class="gc-kpi"><img src="' + IMG(ico) + '" alt=""><div><small>' + esc(t) + '</small><b>' + v + '</b><em>' + esc(s) + '</em></div></div>'; }
  function hora12(h) { var p = String(h || '').split(':'), n = +p[0]; return (n % 12 || 12) + ':' + (p[1] || '00') + (n < 12 ? ' a. m.' : ' p. m.'); }
  function mesNombre(m) { var M = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']; var p = String(m || '').split('-'); return p.length === 2 ? M[+p[1] - 1] + ' ' + p[0] : ''; }

  // ------------------------------------------------------------------------------------------------ LISTAS
  function vLista() {
    var r = st.lista, c = (r && r.conteo) || {}, cat = st.cat;
    var chips = [['todos', 'Todos'], ['hoy', 'Toca hoy'], ['programados', 'Programados']].concat(cat === 'fidelizar' ? [['vigente', 'Aún vigentes']] : []).concat([['mios', 'Mis clientes'], ['sin_asignar', 'Sin asignar'], ['cerrados', 'Cerrados / revisión'], ['bloqueados', 'No contactar']]);
    var sel = Object.keys(st.sel).filter(function (k) { return st.sel[k]; });
    var h = '<section class="gc-lhead ' + CAT[cat].tono + '"><img src="' + IMG(cat === 'vencidos' ? 'cal_alerta' : CAT[cat].ico) + '" alt=""><div><b>' + (r ? r.total : '…') + (cat === 'potenciales' ? ' oportunidades' : ' clientes') + '</b><small>' + (cat === 'vencidos' ? 'Algún servicio vencido, o «No renovó» en los últimos 90 días sin nada vigente' : cat === 'fidelizar' ? 'Una sola compra verificable desde el ' + fecha((st.panel && st.panel.desdeVerificable) || '2026-10-01') + '; el seguimiento empieza 7 días después de que termina' : 'Cotizaron o pidieron datos de pago y aún no compran') + '</small></div>' + (cat === 'potenciales' ? '<button type="button" class="gc-btn" data-gc="nuevo-pot">+ Nuevo potencial</button>' : '') + '</section>' +
      '<div class="gc-chips">' + chips.map(function (x) { return '<button type="button" class="' + (st.f.filtro === x[0] ? 'on' : '') + '" data-gc-filtro="' + x[0] + '">' + x[1] + (c[x[0]] != null ? ' <span>' + c[x[0]] + '</span>' : '') + '</button>'; }).join('') + '</div>' +
      '<div class="gc-filtros"><label class="gc-busca"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" data-gc-f="q" value="' + esc(st.f.q) + '" placeholder="Buscar nombre, número o plataforma"></label>' +
      sel_('plataforma', 'Plataforma', (r && r.plataformas || []).map(function (p) { return [p, p]; })) +
      (cat !== 'potenciales' ? sel_('vendedor', 'Atendido por', (r && r.vendedores || []).map(function (v) { return [v, v]; })) : '') +
      sel_('responsable', 'Responsable', [['_sin', 'Sin asignar']].concat(Object.keys(USU).map(function (k) { return [k, USU[k]]; }))) +
      (cat === 'vencidos' ? sel_('dias', 'Días vencido', [['3', '+3 días'], ['15', '+15 días'], ['30', '+30 días'], ['90', '+90 días']]) : '') +
      sel_('estado', 'Último resultado', Object.keys((st.panel && st.panel.estados) || {}).map(function (k) { return [k, estLabel(k)]; })) +
      '<button type="button" class="gc-btn sec sm" data-gc="excel-lista">Excel de esta lista</button></div>' +
      (sel.length ? '<div class="gc-bulk"><b>' + sel.length + ' seleccionado(s)</b><button type="button" class="gc-btn sm" data-gc="tomar-sel">Tomarlos</button>' + (st.panel && st.panel.esAdmin ? '<select data-gc="asignar-sel"><option value="">Asignar a…</option>' + Object.keys(USU).map(function (k) { return '<option value="' + k + '">' + USU[k] + '</option>'; }).join('') + '<option value="_sin">Sin asignar</option></select>' : '') + '<button type="button" class="gc-btn sec sm" data-gc="excel-sel">Excel de la selección</button><button type="button" class="gc-link" data-gc="limpiar-sel">Quitar selección</button></div>' : '');
    if (!r) return h + cargando();
    if (!r.filas.length) return h + '<div class="gc-vacio">' + (st.f.filtro === 'hoy' ? 'No hay contactos que toquen hoy en esta categoría.' : 'Sin resultados con esos filtros.') + '</div>';
    var todos = r.filas.every(function (f) { return st.sel[f.key]; });
    h += '<div class="gc-tw"><table class="gc-t"><thead><tr><th class="ck"><input type="checkbox" data-gc="sel-todos" ' + (todos ? 'checked' : '') + ' aria-label="Seleccionar la página"></th><th>Cliente</th><th>Servicios</th>' + (cat === 'potenciales' ? '<th>Cotización</th>' : '<th>Compras</th><th>Atendido por</th>') + '<th>Responsable</th><th>Seguimiento</th><th>Último contacto</th><th></th></tr></thead><tbody>' +
      r.filas.map(fila).join('') + '</tbody></table></div>' +
      '<div class="gc-pag"><span>' + r.total + ' en total · página ' + r.pagina + ' de ' + r.paginas + '</span><button type="button" class="gc-btn sec sm" data-gc-pag="-1"' + (r.pagina <= 1 ? ' disabled' : '') + '>Anterior</button><button type="button" class="gc-btn sec sm" data-gc-pag="1"' + (r.pagina >= r.paginas ? ' disabled' : '') + '>Siguiente</button></div>';
    return h;
  }
  function sel_(k, t, ops) { return '<select data-gc-f="' + k + '" aria-label="' + t + '"><option value="">' + t + '</option>' + ops.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (st.f[k] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }
  function svcChips(f) {
    return f.servicios.concat(f.archivados || []).map(function (s) {
      var est = s.estado === 'vencido' ? '<em class="r">' + s.dias + ' día' + (s.dias === 1 ? '' : 's') + ' vencido</em>' : s.estado === 'no_renovo' ? '<em class="r">No renovó · ' + (s.dias != null && s.dias > 0 ? s.dias + ' días' : fecha(s.noRenovoAt)) + '</em>' : s.estado === 'vigente' ? '<em class="v">Vence ' + fecha(s.vence) + '</em>' : s.estado === 'cotizado' ? '<em class="a">Cotizado</em>' : '<em class="y">Fecha no verificable</em>';
      return '<span class="gc-svc"><b>' + esc(s.servicio || s.plataforma) + '</b>' + (s.precio ? ' · ' + L(s.precio) : '') + est + '</span>';
    }).join('');
  }
  function fila(f) {
    var ci = f.ciclo || {}, cat = st.cat;
    var seg = pill(CICLO, f.noContactar ? 'bloqueado' : ci.estado) + '<small>' + (ci.estado === 'cerrado' ? esc(estLabel(ci.motivo)) : ci.sugerida ? (ci.acordada ? 'Acordado ' : ci.elegible && ci.sugerida < hoy() ? 'Toca desde ' : 'Próximo ') + fecha(ci.sugerida) : '') + (ci.total ? ' · contacto ' + Math.min(ci.paso + (ci.elegible ? 1 : 0), ci.total) + ' de ' + ci.total : '') + '</small>';
    return '<tr class="' + (st.sel[f.key] ? 'sel' : '') + '"><td class="ck"><input type="checkbox" data-gc-sel="' + esc(f.key) + '" ' + (st.sel[f.key] ? 'checked' : '') + ' aria-label="Seleccionar"></td>' +
      '<td><button type="button" class="gc-nom" data-gc-ficha="' + esc(f.key) + '">' + esc(f.nombre || 'Sin nombre') + '</button><small>' + (f.telefono ? esc(f.telefono) : '<span class="y">Sin teléfono válido</span>') + (f.categorias.length > 1 ? ' · también en ' + f.categorias.filter(function (x) { return x !== cat; }).map(function (x) { return CAT[x].n.replace('Clientes ', ''); }).join(', ') : '') + (f.inactivo ? ' · ' + (f.inactivo === 'inactivo_prolongado' ? 'Inactivo +90 días' : 'Inactivo +30 días') : '') + '</small></td>' +
      '<td class="svcs">' + svcChips(f) + '</td>' +
      (cat === 'potenciales' ? '<td data-l="Cotización">' + (f.precioCotizado ? L(f.precioCotizado) : '—') + '<small>' + fecha(String(f.creadoAt).slice(0, 10)) + ' · ' + esc(f.creadoPor || '') + '</small>' + (f.ventaSugerida ? '<small class="v">Venta detectada ' + fecha(f.ventaSugerida.fecha) + '</small>' : '') + '</td>' :
        '<td data-l="Compras">' + (f.compras == null ? '<span class="gc-pill y" title="Antes del 01/10/2026 no hay ventas registradas">No verificable</span>' : f.compras) + (f.primeraCompra ? '<small>1.ª: ' + fecha(f.primeraCompra.fecha) + '</small>' : '') + '</td><td data-l="Atendido por">' + esc((f.vendedores || []).join(', ') || 'Sin asignar') + '</td>') +
      '<td data-l="Responsable">' + (f.responsable ? esc(USU[f.responsable] || f.responsable) : '<span class="gc-sub">Sin asignar</span>') + '</td><td data-l="Seguimiento">' + seg + '</td>' +
      '<td data-l="Último contacto">' + (f.ultimoContacto ? fecha(f.ultimoContacto) + '<small>' + esc(estLabel(f.estado)) + '</small>' : '<span class="gc-sub">Nunca</span>') + '</td>' +
      '<td class="acc"><button type="button" class="gc-btn wa sm" data-gc-contactar="' + esc(f.key) + '"' + (f.noContactar || !f.telefono ? ' disabled title="' + (f.noContactar ? 'No desea mensajes' : 'Sin teléfono') + '"' : '') + '>WhatsApp</button><button type="button" class="gc-btn az sm" data-gc-registrar="' + esc(f.key) + '">Registrar</button></td></tr>';
  }
  async function cargarLista() {
    st.lista = null; pintar();
    try { st.lista = await api('lista', Object.assign({ cat: st.cat, pagina: st.pagina, porPagina: 30 }, st.f)); } catch (e) { st.error = e.message; }
    pintar();
  }
  function filaDe(key) { return ((st.lista && st.lista.filas) || []).find(function (f) { return f.key === key; }); }

  // ------------------------------------------------------------------------------------------------ FICHA
  async function abrirFicha(key) {
    var m = modal('Ficha comercial', '<div class="gc-vacio"><span class="gc-spin"></span> Cargando ficha…</div>');
    try {
      var r = await api('ficha', { key: key }), f = r.ficha, p = st.panel || {};
      var cats = (f.categorias || []).map(function (c) { var ci = f.ciclos[c] || {}; return '<div class="gc-ciclo ' + CAT[c].tono + '"><b>' + CAT[c].n + '</b>' + pill(CICLO, f.noContactar ? 'bloqueado' : ci.estado) + '<small>Ancla: ' + fecha(ci.ancla) + ' · contacto ' + (ci.paso || 0) + ' de ' + (ci.total || 3) + (ci.sugerida ? ' · próximo ' + fecha(ci.sugerida) : '') + '</small></div>'; }).join('');
      m.querySelector('.gc-modal-b').innerHTML =
        '<div class="gc-fi-h"><div><h3>' + esc(f.nombre || 'Sin nombre') + '</h3><p>' + esc(f.telefono || 'Sin teléfono válido') + (f.tipo === 'oportunidad' ? ' · Potencial registrado por ' + esc(f.creadoPor || '—') : '') + '</p></div><div class="gc-fi-acc">' +
        (f.tipo === 'cliente' || f.tipo === 'oportunidad' ? '<button type="button" class="gc-btn wa sm" data-gc-contactar="' + esc(f.key) + '"' + (f.noContactar || !f.telefono ? ' disabled' : '') + '>WhatsApp</button><button type="button" class="gc-btn az sm" data-gc-registrar="' + esc(f.key) + '">Registrar resultado</button>' : '') +
        (f.responsable ? (f.responsable === p.usuario || p.esAdmin ? '<button type="button" class="gc-btn sec sm" data-gc-soltar="' + esc(f.key) + '">Soltar</button>' : '') : '<button type="button" class="gc-btn sec sm" data-gc-tomar="' + esc(f.key) + '">Tomar</button>') +
        (f.noContactar ? (p.esAdmin ? '<button type="button" class="gc-btn sec sm" data-gc-nocontactar="' + esc(f.key) + '" data-v="0">Quitar «No contactar»</button>' : '') : '<button type="button" class="gc-btn sec sm" data-gc-nocontactar="' + esc(f.key) + '" data-v="1">No contactar</button>') +
        (f.tipo === 'oportunidad' && f.estadoOportunidad === 'abierta' ? '<button type="button" class="gc-btn sec sm" data-gc-editpot="' + esc(f.id) + '">Editar</button>' : '') + '</div></div>' +
        '<div class="gc-fi-g"><div><small>Responsable</small><b>' + esc(USU[f.responsable] || f.responsable || 'Sin asignar') + '</b></div><div><small>Atendido por</small><b>' + esc((f.vendedores || []).join(', ') || 'Sin asignar') + '</b></div><div><small>Compras verificables</small><b>' + (f.tipo === 'oportunidad' ? '0' : f.compras == null ? 'No verificable' : f.compras) + '</b></div><div><small>Servicios vigentes</small><b>' + (f.vigentes || 0) + '</b></div></div>' +
        (cats ? '<div class="gc-ciclos">' + cats + '</div>' : '') +
        '<h4>Servicios</h4><div class="gc-tw"><table class="gc-t sm"><thead><tr><th>Servicio</th><th>Precio</th><th>Vencimiento</th><th>Días</th><th>Atendido por</th><th>Estado</th></tr></thead><tbody>' +
        (f.servicios || []).concat(f.archivados || []).map(function (s) { return '<tr><td><b>' + esc(s.servicio || s.plataforma) + '</b></td><td>' + (s.precio ? L(s.precio) : f.precioCotizado ? L(f.precioCotizado) + ' cotizado' : '—') + '</td><td>' + (s.vence ? fecha(s.vence) : s.estado === 'cotizado' ? '—' : 'No verificable') + '</td><td>' + (s.dias != null && s.dias > 0 ? s.dias : '—') + '</td><td>' + esc(s.vendedor || 'Sin asignar') + '</td><td>' + ({ vencido: 'Vencido', vigente: 'Vigente', no_renovo: 'No renovó (' + fecha(s.noRenovoAt) + ')', cotizado: 'Cotizado', sin_fecha: 'Sin fecha' }[s.estado] || s.estado) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        ((f.ventas || []).length ? '<h4>Compras verificables (desde ' + fecha(f.comprasDesde || '2026-10-01') + ')</h4><ul class="gc-ventas">' + f.ventas.map(function (v) { return '<li>' + fecha(v.fecha) + ' · ' + (v.subtipo === 'compra_nueva' ? 'Compra nueva' : 'Renovación') + ' · ' + L(v.monto) + '</li>'; }).join('') + '</ul>' : '') +
        (f.notas ? '<h4>Observaciones</h4><p class="gc-notas">' + esc(f.notas) + '</p>' : '') +
        '<h4>Historial comercial</h4>' + (r.historial.length ? '<ul class="gc-hist">' + r.historial.map(function (e) { return '<li><time>' + esc(String(e.at).replace('T', ' ').slice(0, 16)) + '</time><b>' + esc((r.etapas && r.etapas[e.etapa]) || e.etapa) + '</b> · ' + esc(CAT[e.categoria] ? CAT[e.categoria].n : e.categoria) + ' · ' + esc(USU[e.autor] || e.autor) + (e.resultado ? ' · <i>' + esc(estLabel(e.resultado)) + '</i>' : '') + (e.plantillaId ? ' · ' + esc(e.plantillaId) : '') + (e.proximo ? ' · próximo ' + fecha(e.proximo) : '') + (e.ventaId ? ' · venta ' + L(e.monto) : '') + (e.notas ? '<p>' + esc(e.notas) + '</p>' : '') + (e.texto ? '<details><summary>Texto enviado</summary><pre>' + esc(e.texto) + '</pre></details>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="gc-sub">Sin contactos registrados.</p>');
      m._ficha = f;
    } catch (e) { m.querySelector('.gc-modal-b').innerHTML = '<div class="gc-vacio mal">' + esc(e.message) + '</div>'; }
  }

  // ------------------------------------------------------------------------------------------------ COMPOSITOR (plantilla → vista previa → WhatsApp → confirmar)
  async function plantillas(key) { var r = await api('plantillas', key ? { key: key } : {}); if (!key) st.pl = r; return r; }
  async function abrirContacto(key) {
    var m = modal('Contactar por WhatsApp', '<div class="gc-vacio"><span class="gc-spin"></span> Preparando…</div>');
    try {
      var fr = await api('ficha', { key: key }), f = fr.ficha, pr = await plantillas(key);
      var cats = f.categorias.length ? f.categorias : ['vencidos'];
      var recientes = (pr.recientes || []).map(function (x) { return x.id; });
      var svcs = (f.servicios || []).concat(f.archivados || []);
      var porDefecto = svcs.find(function (s) { return s.estado === 'vencido' || s.estado === 'no_renovo'; }) || svcs[0] || {};
      var s0 = { cat: cats.indexOf(st.cat) >= 0 ? st.cat : cats[0], sit: '', id: '', servicio: porDefecto.servicio || '' };
      function opciones() { return pr.plantillas.filter(function (p) { return p.activa !== false && p.categoria === s0.cat && (!s0.sit || p.situacion === s0.sit); }); }
      function elegir(saltar) { var o = opciones(); var libres = o.filter(function (p) { return recientes.indexOf(p.id) < 0 && p.id !== saltar; }); var x = (libres.length ? libres : o.filter(function (p) { return p.id !== saltar; }))[0] || o[0]; s0.id = x ? x.id : ''; }
      function resolver(t) { var n = f.saludo || ''; var out = String(t || '').replace(/\{\{\s*saludo\s*\}\}/g, n ? '¡Hola, ' + n + '! 👋' : '¡Hola! 👋').replace(/\{\{\s*servicio\s*\}\}/g, s0.servicio || '{{servicio}}'); return out; }
      elegir();
      function pint() {
        var o = opciones(), p = pr.plantillas.find(function (x) { return x.id === s0.id; }) || {};
        var sits = pr.situaciones.filter(function (x) { return x.categoria === s0.cat; });
        m.querySelector('.gc-modal-b').innerHTML = '<div class="gc-gen"><img src="' + IMG('sobre') + '" alt=""><div><b>' + esc(f.nombre || 'Sin nombre') + '</b><small>' + esc(f.telefono) + ' · ' + (f.compras == null ? 'compras no verificables' : f.compras + ' compra(s)') + '</small></div></div>' +
          '<div class="gc-form"><label>Categoría comercial<select data-c="cat">' + cats.map(function (c) { return '<option value="' + c + '"' + (s0.cat === c ? ' selected' : '') + '>' + CAT[c].n + '</option>'; }).join('') + '</select></label>' +
          '<label>Situación<select data-c="sit"><option value="">Todas</option>' + sits.map(function (x) { return '<option value="' + esc(x.situacion) + '"' + (s0.sit === x.situacion ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select></label>' +
          '<label>Plantilla<select data-c="id">' + o.map(function (x) { return '<option value="' + esc(x.id) + '"' + (s0.id === x.id ? ' selected' : '') + '>' + esc(x.id.replace(/^GC-[A-Z]+-/, 'Mensaje ') + ' · ' + (x.situacion_label || x.situacion)) + (recientes.indexOf(x.id) >= 0 ? ' (ya usado con este cliente)' : '') + '</option>'; }).join('') + '</select></label>' +
          '<label>Servicio<input data-c="servicio" list="gcSvcs" value="' + esc(s0.servicio) + '"><datalist id="gcSvcs">' + svcs.map(function (s) { return '<option value="' + esc(s.servicio) + '">'; }).join('') + '</datalist></label></div>' +
          '<label class="gc-prev">Vista previa (puede editarla)<textarea data-c="texto" rows="7">' + esc(resolver(p.mensaje)) + '</textarea></label>' +
          '<p class="gc-nota">Si va a mencionar un precio, use uno vigente o cotizado y confirmado. «Abrir WhatsApp» no cuenta como enviado: cuando lo envíe, confírmelo abajo.</p>' +
          '<div class="gc-acc-row"><button type="button" class="gc-btn sec" data-c="otra">Otra variante</button><button type="button" class="gc-btn sec" data-c="copiar">Copiar mensaje</button><button type="button" class="gc-btn wa" data-c="wa">Abrir WhatsApp</button></div>' +
          '<div class="gc-confirmar" hidden><b>¿Envió el mensaje?</b>' + formResultado(f, fr.ventasVinculables, s0.cat) + '<div class="gc-acc-row"><button type="button" class="gc-btn sec" data-c="noenvie">No lo envié</button><button type="button" class="gc-btn" data-c="confirmar">Sí, lo envié · registrar</button></div></div>';
        var tx = m.querySelector('[data-c="texto"]');
        m.querySelectorAll('select[data-c],input[data-c="servicio"]').forEach(function (el) { el.addEventListener('change', function () { s0[el.dataset.c] = el.value; if (el.dataset.c === 'cat' || el.dataset.c === 'sit') elegir(); pint(); }); });
        m.querySelector('[data-c="otra"]').onclick = function () { elegir(s0.id); pint(); };
        m.querySelector('[data-c="copiar"]').onclick = async function () { if (/\{\{/.test(tx.value)) return toast('Complete el servicio: el mensaje tiene variables sin resolver.', true); try { await navigator.clipboard.writeText(tx.value); toast('Mensaje copiado. Copiar no cuenta como enviado.'); } catch (_) { tx.select(); } api('evento', { key: key, categoria: s0.cat, etapa: 'preparado', plantillaId: s0.id }).catch(function () {}); };
        m.querySelector('[data-c="wa"]').onclick = function () { if (/\{\{/.test(tx.value)) return toast('Complete el servicio: el mensaje tiene variables sin resolver.', true); var u = waLink(f.telefono, tx.value); if (!u) return toast('Sin teléfono válido.', true); var c = cfg(); if (c && c.abrir) c.abrir(u); else window.open(u, '_blank', 'noopener'); api('evento', { key: key, categoria: s0.cat, etapa: 'abierto', plantillaId: s0.id }).catch(function () {}); m.querySelector('.gc-confirmar').hidden = false; };
        m.querySelector('[data-c="noenvie"]').onclick = function () { m.querySelector('.gc-confirmar').hidden = true; };
        m.querySelector('[data-c="confirmar"]').onclick = async function (ev) {
          var b = ev.target; b.disabled = true;
          try { var d = leerResultado(m); var p2 = pr.plantillas.find(function (x) { return x.id === s0.id; }) || {};
            await api('evento', Object.assign({ key: key, categoria: s0.cat, etapa: 'enviado', plantillaId: s0.id, plantillaVersion: p2.version || 1, texto: tx.value, servicio: s0.servicio }, d));
            toast('Contacto registrado.'); cerrar(m); refrescar(); } catch (e) { toast(e.message, true); b.disabled = false; }
        };
        enlazarResultado(m);
      }
      pint();
    } catch (e) { m.querySelector('.gc-modal-b').innerHTML = '<div class="gc-vacio mal">' + esc(e.message) + '</div>'; }
  }
  function formResultado(f, ventas, cat) {
    var E = (st.panel && st.panel.estados) || {};
    var sug = (f.ciclos && f.ciclos[cat] && f.ciclos[cat].sugerida) || '';
    return '<div class="gc-form"><label>Resultado<select data-r="resultado"><option value="contactado">Contactado (sin respuesta aún)</option>' + Object.keys(E).filter(function (k) { return k !== 'pendiente' && k !== 'contactado'; }).map(function (k) { return '<option value="' + k + '">' + esc(E[k].label) + '</option>'; }).join('') + '</select></label>' +
      '<label>Próximo seguimiento (fecha acordada)<input type="date" data-r="proximo" min="' + hoy() + '" placeholder="' + esc(sug) + '"><small>Vacío = la sugiere el ciclo.</small></label>' +
      '<label class="w2" data-r-venta hidden>Venta ya registrada en Finanzas<select data-r="ventaId"><option value="">— elegir —</option>' + (ventas || []).map(function (v) { return '<option value="' + esc(v.id) + '">' + fecha(v.fecha) + ' · ' + (v.subtipo === 'compra_nueva' ? 'Compra nueva' : 'Renovación') + ' · ' + L(v.monto) + '</option>'; }).join('') + '</select><small>' + ((ventas || []).length ? '' : 'No hay ventas recientes de este cliente: regístrela primero en Cobros / Finanzas.') + '</small></label>' +
      '<p class="w2 gc-nota" data-r-ticket hidden>Derive el problema en <b>Tickets</b> para que soporte lo atienda.</p>' +
      '<label class="w2">Observaciones<textarea data-r="notas" rows="2" maxlength="500"></textarea></label></div>';
  }
  function enlazarResultado(m) { var s = m.querySelector('[data-r="resultado"]'); if (!s) return; var up = function () { m.querySelector('[data-r-venta]').hidden = s.value !== 'compra_concretada'; m.querySelector('[data-r-ticket]').hidden = s.value !== 'problema_servicio'; }; s.addEventListener('change', up); up(); }
  function leerResultado(m) { var g = function (k) { var e = m.querySelector('[data-r="' + k + '"]'); return e ? e.value : ''; }; return { resultado: g('resultado'), proximo: g('proximo'), ventaId: g('ventaId'), notas: g('notas') }; }
  async function abrirRegistrar(key) {
    var m = modal('Registrar resultado', '<div class="gc-vacio"><span class="gc-spin"></span> Cargando…</div>');
    try {
      var fr = await api('ficha', { key: key }), f = fr.ficha; var cats = f.categorias.length ? f.categorias : [st.cat];
      var cat = cats.indexOf(st.cat) >= 0 ? st.cat : cats[0];
      m.querySelector('.gc-modal-b').innerHTML = '<p><b>' + esc(f.nombre || 'Sin nombre') + '</b> · ' + esc(f.telefono || '') + '</p><div class="gc-form"><label>Categoría<select data-r="cat">' + cats.map(function (c) { return '<option value="' + c + '"' + (c === cat ? ' selected' : '') + '>' + CAT[c].n + '</option>'; }).join('') + '</select></label>' +
        '<label>¿Qué pasó?<select data-r="etapa"><option value="respuesta">Registrar respuesta (sin nuevo mensaje)</option><option value="enviado">Le escribí (confirmo el envío)</option></select></label></div>' + formResultado(f, fr.ventasVinculables, cat) +
        '<div class="gc-acc-row"><button type="button" class="gc-btn" data-r-ok>Guardar</button></div>';
      enlazarResultado(m);
      m.querySelector('[data-r-ok]').onclick = async function (ev) { ev.target.disabled = true; try { var d = leerResultado(m); await api('evento', Object.assign({ key: key, categoria: m.querySelector('[data-r="cat"]').value, etapa: m.querySelector('[data-r="etapa"]').value, texto: '' }, d)); toast('Resultado guardado.'); cerrar(m); refrescar(); } catch (e) { toast(e.message, true); ev.target.disabled = false; } };
    } catch (e) { m.querySelector('.gc-modal-b').innerHTML = '<div class="gc-vacio mal">' + esc(e.message) + '</div>'; }
  }
  function formPotencial(o) {
    o = o || {};
    var plats = ['netflix', 'vipnetflix', 'disneyp', 'disneys', 'hbomax', 'primevideo', 'paramount', 'spotify', 'youtube', 'crunchyroll', 'vix', 'viki', 'iptv', 'canva', 'deezer', 'gemini', 'oleada'];
    var NOM = { netflix: 'Netflix', vipnetflix: 'Netflix VIP', disneyp: 'Disney Premium', disneys: 'Disney sin ESPN', hbomax: 'HBO Max', primevideo: 'Prime Video', paramount: 'Paramount+', spotify: 'Spotify', youtube: 'YouTube', crunchyroll: 'Crunchyroll', vix: 'ViX', viki: 'Viki Rakuten', iptv: 'IPTV', canva: 'Canva', deezer: 'Deezer', gemini: 'Gemini Pro', oleada: 'Oleada TV' };
    var m = modal(o.id ? 'Editar potencial' : 'Nuevo cliente potencial', '<div class="gc-form"><label>Teléfono *<input data-p="telefono" inputmode="tel" value="' + esc(o.telefono || '') + '" placeholder="9999-9999 o +1 305…"></label><label>Nombre (opcional)<input data-p="nombre" value="' + esc(o.nombre || '') + '" maxlength="80"></label>' +
      '<fieldset class="w2 gc-plats"><legend>Servicios cotizados *</legend>' + plats.map(function (p) { return '<label><input type="checkbox" value="' + p + '"' + ((o.servicios || []).some(function (s) { return s.plataforma === p; }) ? ' checked' : '') + '> ' + NOM[p] + '</label>'; }).join('') + '</fieldset>' +
      '<label>Precio cotizado (L, opcional)<input data-p="precio" type="number" min="0" step="any" value="' + esc(o.precioCotizado || '') + '"></label><label>Próximo seguimiento<input data-p="proximo" type="date" min="' + hoy() + '"></label><label class="w2">Observaciones<textarea data-p="notas" rows="2" maxlength="500">' + esc(o.notas || '') + '</textarea></label></div>' +
      '<p class="gc-nota">Si el número ya es de un cliente, se le avisa para no duplicarlo.</p><div class="gc-acc-row"><button type="button" class="gc-btn" data-p-ok>' + (o.id ? 'Guardar' : 'Crear potencial') + '</button></div>');
    m.querySelector('[data-p-ok]').onclick = async function (ev) {
      var g = function (k) { return m.querySelector('[data-p="' + k + '"]').value; };
      var servicios = [].map.call(m.querySelectorAll('.gc-plats input:checked'), function (x) { return x.value; });
      if (!g('telefono').trim()) return toast('Escriba el teléfono.', true); if (!servicios.length) return toast('Marque al menos un servicio.', true);
      ev.target.disabled = true;
      try {
        var body = { id: o.id, telefono: g('telefono'), nombre: g('nombre'), servicios: servicios, precio: g('precio'), proximo: g('proximo'), notas: g('notas') };
        var r = await api(o.id ? 'oportunidad_editar' : 'oportunidad_crear', body);
        if (r.duplicado) { ev.target.disabled = false; if (!confirm(r.aviso + '\n\nCliente: ' + r.cliente.nombre + '\n\n¿Registrarlo igual como potencial de otro servicio?')) return; r = await api('oportunidad_crear', Object.assign(body, { confirmarCliente: true })); }
        toast(r.vinculado ? 'Potencial creado y vinculado a la ficha existente.' : 'Potencial guardado.'); cerrar(m); refrescar();
      } catch (e) { toast(e.message, true); ev.target.disabled = false; }
    };
  }

  // ------------------------------------------------------------------------------------------------ BIBLIOTECA
  function vBiblioteca() {
    var r = st.pl; if (!r) return cargando();
    var q = st.plF.q.toLowerCase(), adm = st.panel && st.panel.esAdmin;
    var lista = r.plantillas.filter(function (p) { return (!st.plF.cat || p.categoria === st.plF.cat) && (!st.plF.sit || p.situacion === st.plF.sit) && (!q || (p.id + ' ' + p.mensaje + ' ' + p.situacion_label).toLowerCase().indexOf(q) >= 0); });
    var sits = r.situaciones.filter(function (x) { return !st.plF.cat || x.categoria === st.plF.cat; });
    return '<section class="gc-lhead b"><img src="' + IMG('sobre') + '" alt=""><div><b>Generador de mensajes</b><small>' + r.plantillas.length + ' plantillas · ' + (r.importadas ? 'importadas a Sublichat' : 'biblioteca original (todavía no importada)') + ' · variables {{saludo}} y {{servicio}}</small></div>' +
      (adm ? '<button type="button" class="gc-btn sec" data-gc="importar">' + (r.importadas ? 'Revisar importación' : 'Importar las ' + r.totalOrigen) + '</button><button type="button" class="gc-btn" data-gc="pl-nueva">+ Nueva plantilla</button>' : '') + '</section>' +
      '<div class="gc-filtros"><select data-gc-pl="cat"><option value="">Todas las categorías</option>' + ORD.map(function (c) { return '<option value="' + c + '"' + (st.plF.cat === c ? ' selected' : '') + '>' + CAT[c].n + '</option>'; }).join('') + '</select><select data-gc-pl="sit"><option value="">Todas las situaciones</option>' + sits.map(function (x) { return '<option value="' + esc(x.situacion) + '"' + (st.plF.sit === x.situacion ? ' selected' : '') + '>' + esc(x.label) + ' (' + x.n + ')</option>'; }).join('') + '</select><label class="gc-busca"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" data-gc-pl="q" value="' + esc(st.plF.q) + '" placeholder="Buscar en los mensajes"></label></div>' +
      '<div class="gc-pls">' + lista.map(function (p) { return '<article class="gc-pl ' + CAT[p.categoria].tono + (p.activa === false ? ' off' : '') + '"><header><b>' + esc(p.id) + '</b><span>' + esc(p.situacion_label || p.situacion) + '</span><em>v' + (p.version || 1) + (p.activa === false ? ' · inactiva' : '') + (p.editadaLocal ? ' · editada' : '') + '</em></header><pre>' + esc(p.mensaje) + '</pre>' + (adm ? '<footer><button type="button" class="gc-link" data-gc-pled="' + esc(p.id) + '">Editar</button><button type="button" class="gc-link" data-gc-pldup="' + esc(p.id) + '">Duplicar</button><button type="button" class="gc-link" data-gc-plact="' + esc(p.id) + '">' + (p.activa === false ? 'Activar' : 'Desactivar') + '</button></footer>' : '') + '</article>'; }).join('') + '</div>' +
      '<p class="gc-nota">La biblioteca reduce la monotonía; no es para evadir filtros de WhatsApp. Nada se envía solo.</p>';
  }
  function editarPlantilla(p, dup) {
    p = p || { categoria: st.plF.cat || 'vencidos', situacion: '', situacion_label: '', mensaje: '{{saludo}}\n\n' };
    if (!r_importadas() && p.id && !dup) return toast('Primero importe la biblioteca para poder editarla.', true);
    var m = modal(dup ? 'Duplicar plantilla' : p.id ? 'Editar ' + p.id : 'Nueva plantilla', '<div class="gc-form"><label>Categoría<select data-e="categoria">' + ORD.map(function (c) { return '<option value="' + c + '"' + (p.categoria === c ? ' selected' : '') + '>' + CAT[c].n + '</option>'; }).join('') + '</select></label><label>Situación (clave)<input data-e="situacion" value="' + esc(p.situacion) + '"></label><label class="w2">Nombre de la situación<input data-e="situacion_label" value="' + esc(p.situacion_label || '') + '"></label><label class="w2">Mensaje (use {{saludo}} y {{servicio}})<textarea data-e="mensaje" rows="8">' + esc(p.mensaje) + '</textarea></label><label><input type="checkbox" data-e="activa"' + (p.activa === false ? '' : ' checked') + '> Activa</label></div><div class="gc-acc-row"><button type="button" class="gc-btn" data-e-ok>Guardar versión</button></div>' + (p.historial && p.historial.length ? '<h4>Versiones</h4><ul class="gc-hist">' + p.historial.slice().reverse().map(function (h) { return '<li><time>' + esc(String(h.at).slice(0, 16).replace('T', ' ')) + '</time> v' + h.version + ' · ' + esc(h.accion) + ' · ' + esc(USU[h.por] || h.por) + '</li>'; }).join('') + '</ul>' : ''));
    m.querySelector('[data-e-ok]').onclick = async function (ev) { var g = function (k) { return m.querySelector('[data-e="' + k + '"]'); }; ev.target.disabled = true;
      try { await api('plantilla_guardar', { id: dup ? '' : p.id, duplicar: !!dup, categoria: g('categoria').value, situacion: g('situacion').value, situacion_label: g('situacion_label').value, mensaje: g('mensaje').value, activa: g('activa').checked }); toast('Plantilla guardada.'); cerrar(m); st.pl = null; pintar(); await plantillas(); pintar(); } catch (e) { toast(e.message, true); ev.target.disabled = false; } };
  }
  function r_importadas() { return st.pl && st.pl.importadas; }

  // ------------------------------------------------------------------------------------------------ REPORTES + EXCEL
  function rango() { var h = hoy(), r = st.rep; if (r.periodo === 'dia') return [h, h]; if (r.periodo === 'semana') return [sumar(h, -6), h]; if (r.periodo === 'mes') return [h.slice(0, 8) + '01', h]; return [r.desde || h, r.hasta || h]; }
  function vReportes() {
    var r = st.repData, rg = rango(), R = st.rep;
    var h = '<section class="gc-lhead y"><img src="' + IMG('reportes') + '" alt=""><div><b>Reportes comerciales</b><small>Día, semana, mes o rango · por usuario, plataforma y categoría · Excel de 10 hojas</small></div><button type="button" class="gc-btn" data-gc="excel" ' + (r ? '' : 'disabled') + '>Descargar Excel</button></section>' +
      '<div class="gc-filtros">' + ['dia', 'semana', 'mes', 'rango'].map(function (p) { return '<button type="button" class="gc-chipb' + (R.periodo === p ? ' on' : '') + '" data-gc-per="' + p + '">' + { dia: 'Hoy', semana: '7 días', mes: 'Este mes', rango: 'Rango' }[p] + '</button>'; }).join('') +
      (R.periodo === 'rango' ? '<input type="date" data-gc-rep="desde" value="' + esc(R.desde) + '"><input type="date" data-gc-rep="hasta" value="' + esc(R.hasta) + '">' : '<span class="gc-sub">' + fecha(rg[0]) + ' – ' + fecha(rg[1]) + '</span>') +
      '<select data-gc-rep="usuario"><option value="">Todo el equipo</option>' + Object.keys(USU).map(function (k) { return '<option value="' + k + '"' + (R.usuario === k ? ' selected' : '') + '>' + USU[k] + '</option>'; }).join('') + '</select>' +
      '<select data-gc-rep="categoria"><option value="">Todas las categorías</option>' + ORD.map(function (c) { return '<option value="' + c + '"' + (R.categoria === c ? ' selected' : '') + '>' + CAT[c].n + '</option>'; }).join('') + '</select>' +
      '<input data-gc-rep="plataforma" placeholder="Plataforma (clave)" value="' + esc(R.plataforma) + '" size="12"><button type="button" class="gc-btn sec sm" data-gc="rep">Ver</button></div>';
    if (!r) return h + (st.cargando ? cargando() : '<div class="gc-vacio">Elija el período y toque «Ver».</div>');
    var s = r.resumen;
    h += '<div class="gc-kpis k6">' + [['Clientes vigentes', s.meta.actual + ' / ' + (s.meta.objetivo || '—')], ['Nuevos', s.nuevos], ['Recuperados', s.recuperados], ['Perdidos', s.perdidos], ['Crecimiento neto', (s.neto > 0 ? '+' : '') + s.neto], ['Contactos confirmados', s.contactosConfirmados + ' <small>(' + s.personasContactadas + ' personas)</small>'], ['Respondieron', s.respondieron], ['Ventas vinculadas', s.ventasVinculadas + ' · ' + L(s.ingresosVinculados)], ['Conversión', s.conversion == null ? '—' : s.conversion + '% <small>de ' + s.denominador + '</small>']].map(function (x) { return '<div class="gc-kpi s"><div><small>' + x[0] + '</small><b>' + x[1] + '</b></div></div>'; }).join('') + '</div>' +
      (s.fotosDisponibles < 2 ? '<p class="gc-nota">Nuevos / recuperados / perdidos salen de la foto diaria de la cartera, que empieza el primer día que se usa el módulo: con pocas fotos todavía son parciales.</p>' : '') +
      '<h4>Rendimiento por usuario</h4>' + tabla(['Usuario', 'Contactos', 'Personas', 'Respondieron', 'Ventas', 'Vencidos', 'Fidelizar', 'Potenciales', 'WhatsApp abiertos'], r.rendimiento.map(function (x) { return [x.nombre, x.enviados, x.unicos, x.respondieron, x.ventas, x.porCat.vencidos, x.porCat.fidelizar, x.porCat.potenciales, x.abiertos]; })) +
      '<h4>Crecimiento de cartera</h4>' + tabla(['Fecha', 'Vigentes', 'Nuevos', 'Recuperados', 'Perdidos', 'Neto'], r.crecimiento.map(function (x) { return [x.fecha, x.activos, x.nuevos, x.recuperados, x.perdidos, x.neto]; })) +
      '<h4>Motivos y resultados</h4>' + tabla(['Resultado', 'Veces'], Object.keys(r.motivos).map(function (k) { return [estLabel(k), r.motivos[k]]; })) +
      '<h4>Efectividad de mensajes</h4>' + tabla(['Plantilla', 'Categoría', 'Usos confirmados', 'Respondieron', 'Ventas', 'Ingresos'], r.efectividad.map(function (x) { return [x.plantillaId, CAT[x.categoria] ? CAT[x.categoria].n : x.categoria, x.usos, x.respuestas, x.ventas, L(x.ingresos)]; })) +
      '<h4>Por plataforma</h4>' + tabla(['Plataforma', 'Compras', 'Renovaciones', 'Ingresos', 'Vencidos ahora'], r.plataformas.map(function (x) { return [x.nombre || x.plataforma, x.compras, x.renovaciones, L(x.ingresos), x.vencidosAhora]; })) +
      '<p class="gc-nota">Una venta cuenta una vez aunque el cliente esté en dos categorías. Asociar una venta a un mensaje no prueba que el mensaje la causó.</p>';
    return h;
  }
  function tabla(enc, filas) { return filas.length ? '<div class="gc-tw"><table class="gc-t sm"><thead><tr>' + enc.map(function (e) { return '<th>' + esc(e) + '</th>'; }).join('') + '</tr></thead><tbody>' + filas.map(function (f) { return '<tr>' + f.map(function (c, i) { return '<td' + (i && typeof c === 'number' ? ' class="n"' : '') + '>' + (typeof c === 'string' && c.indexOf('L') === 0 && /^L[\d,.]+$/.test(c) ? c : esc(c)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' : '<p class="gc-sub">Sin datos en el período.</p>'; }
  async function cargarReporte() { var rg = rango(); st.cargando = true; st.repData = null; pintar(); try { st.repData = await api('reporte', { desde: rg[0], hasta: rg[1], usuario: st.rep.usuario, plataforma: st.rep.plataforma, categoria: st.rep.categoria }); } catch (e) { toast(e.message, true); } st.cargando = false; pintar(); }

  // Excel: fechas y números nativos, texto protegido contra fórmulas, filtros y fecha de generación. Sin accesos.
  function seguro(v) { return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) && !/^\+\d{8,15}$/.test(v) ? "'" + v : v; }
  function fechaX(ymd) { if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return ymd || ''; var p = ymd.slice(0, 10).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)); }
  function hoja(wb, nombre, enc, filas) { var X = window.XLSX; var ws = X.utils.aoa_to_sheet([enc].concat(filas.map(function (f) { return f.map(seguro); })), { cellDates: true, dateNF: 'dd/mm/yyyy' }); ws['!cols'] = enc.map(function (e) { return { wch: Math.max(12, Math.min(40, e.length + 4)) }; }); ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: enc.length - 1 } }) }; X.utils.book_append_sheet(wb, ws, nombre.slice(0, 31)); }
  function filasClientes(lista, cat) {
    var out = []; (lista || []).forEach(function (f) { var svcs = (f.servicios || []).concat(f.archivados || []); (svcs.length ? svcs : [{}]).forEach(function (s) {
      out.push([f.tipo === 'oportunidad' ? 'P-' + f.id : f.id, f.nombre || 'Sin nombre', f.telefono || '', s.servicio || s.plataforma || '', s.precio != null ? s.precio : (f.precioCotizado || ''), fechaX(s.vence), s.dias != null && s.dias > 0 ? s.dias : '', ({ vencido: 'Vencido', vigente: 'Vigente', no_renovo: 'No renovó', cotizado: 'Cotizado', sin_fecha: 'Sin fecha' })[s.estado] || '', s.vendedor || 'Sin asignar',
        f.compras == null ? 'No verificable' : f.compras, f.primeraCompra ? fechaX(f.primeraCompra.fecha) : '', USU[f.responsable] || f.responsable || 'Sin asignar', CICLO[f.ciclo && f.ciclo.estado] ? CICLO[f.ciclo.estado][0] : '', f.ciclo ? f.ciclo.paso : '', fechaX(f.ciclo && f.ciclo.sugerida), fechaX(f.ultimoContacto), estLabel(f.estado), f.noContactar ? 'Sí' : 'No', cat === 'potenciales' ? (f.estadoOportunidad || '') : '', f.notas || '']); }); });
    return out;
  }
  var ENC_CLI = ['ID cliente', 'Nombre', 'Teléfono', 'Servicio', 'Precio (L)', 'Vencimiento', 'Días vencido', 'Estado del servicio', 'Atendido por', 'Compras verificables', 'Primera compra', 'Responsable', 'Seguimiento', 'Contactos del ciclo', 'Próximo', 'Último contacto', 'Último resultado', 'No contactar', 'Oportunidad', 'Observaciones'];
  function excelReporte() {
    var r = st.repData; if (!window.XLSX) return toast('El Excel se descarga desde Sublichat Web.', true); if (!r) return toast('Cargue el reporte primero.', true);
    var X = window.XLSX, wb = X.utils.book_new(), s = r.resumen, F = r.filtros;
    hoja(wb, 'Resumen ejecutivo', ['Concepto', 'Valor'], [['Generado', r.generadoAt.replace('T', ' ').slice(0, 19) + ' (UTC)'], ['Zona horaria', r.zona], ['Moneda', 'HNL (L)'], ['Desde', fechaX(F.desde)], ['Hasta', fechaX(F.hasta)], ['Usuario', USU[F.usuario] || 'Todo el equipo'], ['Plataforma', F.plataforma || 'Todas'], ['Categoría', F.categoria || 'Todas'],
      ['Meta (objetivo)', s.meta.objetivo], ['Referencia', s.meta.referencia || ''], ['Clientes vigentes hoy', s.meta.actual], ['Nuevos', s.nuevos], ['Recuperados', s.recuperados], ['Perdidos', s.perdidos], ['Crecimiento neto', s.neto], ['Contactos confirmados', s.contactosConfirmados], ['Personas contactadas', s.personasContactadas], ['Respondieron', s.respondieron],
      ['Ventas vinculadas (únicas)', s.ventasVinculadas], ['Ingresos vinculados (L, ventas confirmadas)', s.ingresosVinculados], ['Conversión %', s.conversion == null ? '' : s.conversion], ['Denominador conversión (personas contactadas)', s.denominador], ['Compras verificables desde', fechaX(s.desdeVerificable)], ['Fotos diarias de cartera en el período', s.fotosDisponibles], ['Nota', 'Las cotizaciones y promesas no son ingresos. Una venta cuenta una vez aunque esté en dos categorías.']]);
    hoja(wb, 'Clientes vencidos', ENC_CLI, filasClientes(r.vencidos, 'vencidos'));
    hoja(wb, 'Clientes por fidelizar', ENC_CLI, filasClientes(r.fidelizar, 'fidelizar'));
    hoja(wb, 'Clientes potenciales', ENC_CLI, filasClientes(r.potenciales, 'potenciales'));
    hoja(wb, 'Rendimiento de vendedores', ['Usuario', 'Meta diaria vencidos', 'Meta diaria fidelizar', 'Meta diaria potenciales', 'Contactos confirmados', 'Personas únicas', 'Respondieron', 'Ventas vinculadas', 'Vencidos', 'Fidelizar', 'Potenciales', 'WhatsApp abiertos sin confirmar'], r.rendimiento.map(function (x) { var mt = x.metas || {}; return [x.nombre, mt.vencidos, mt.fidelizar, mt.potenciales, x.enviados, x.unicos, x.respondieron, x.ventas, x.porCat.vencidos, x.porCat.fidelizar, x.porCat.potenciales, x.abiertos]; }));
    hoja(wb, 'Historial comercial', ['Fecha', 'Hora (UTC)', 'Cliente / prospecto', 'Nombre', 'Categoría', 'Etapa', 'Resultado', 'Plantilla', 'Versión', 'Servicio', 'Responsable', 'Próximo', 'Venta vinculada', 'Monto venta (L)', 'Observaciones', 'Texto enviado'], r.historial.map(function (e) { return [fechaX(e.fecha), String(e.at).slice(11, 19), e.sujeto, e.nombre || '', CAT[e.categoria] ? CAT[e.categoria].n : e.categoria, e.etapa, estLabel(e.resultado), e.plantillaId || '', e.plantillaVersion || '', e.servicio || '', USU[e.autor] || e.autor, fechaX(e.proximo), e.ventaId || '', e.monto || '', e.notas || '', e.texto || '']; }));
    var totRes = Object.keys(r.motivos).reduce(function (a, k) { return a + r.motivos[k]; }, 0);
    hoja(wb, 'Motivos de abandono', ['Resultado', 'Veces', '% del total de resultados', 'Tipo'], Object.keys(r.motivos).map(function (k) { return [estLabel(k), r.motivos[k], totRes ? Math.round(r.motivos[k] / totRes * 1000) / 10 : '', ['no_responde', 'contactado'].indexOf(k) >= 0 ? 'Sin respuesta (aparte)' : ['no_interesado', 'otro_proveedor', 'no_contactar'].indexOf(k) >= 0 ? 'Abandono' : 'Otro']; }));
    hoja(wb, 'Crecimiento de cartera', ['Fecha', 'Vigentes', 'Nuevos', 'Recuperados', 'Perdidos', 'Neto'], r.crecimiento.map(function (x) { return [String(x.fecha).length === 10 ? fechaX(x.fecha) : x.fecha, x.activos, x.nuevos, x.recuperados, x.perdidos, x.neto]; }));
    hoja(wb, 'Efectividad de mensajes', ['Plantilla', 'Categoría', 'Usos confirmados', 'Personas que respondieron', 'Ventas asociadas', 'Ingresos asociados (L)'], r.efectividad.map(function (x) { return [x.plantillaId, CAT[x.categoria] ? CAT[x.categoria].n : x.categoria, x.usos, x.respuestas, x.ventas, x.ingresos]; }));
    hoja(wb, 'Rendimiento por plataforma', ['Plataforma', 'Compras nuevas', 'Renovaciones', 'Ingresos (L)', 'Vencidos ahora'], r.plataformas.map(function (x) { return [x.nombre || x.plataforma, x.compras, x.renovaciones, x.ingresos, x.vencidosAhora]; }));
    X.writeFile(wb, 'Sublichat_Gestion_Comercial_' + F.desde + '_a_' + F.hasta + '.xlsx', { cellDates: true });
  }
  async function excelLista(soloSel) {
    if (!window.XLSX) return toast(cfg() ? 'El Excel se descarga desde Sublichat Web.' : 'No cargó el lector de Excel. Recargue la página.', true);
    try { var r = await api('lista', Object.assign({ cat: st.cat, pagina: 1, porPagina: 3000 }, st.f)); var filas = soloSel ? r.filas.filter(function (f) { return st.sel[f.key]; }) : r.filas;
      var wb = window.XLSX.utils.book_new(); hoja(wb, CAT[st.cat].n, ENC_CLI, filasClientes(filas, st.cat)); hoja(wb, 'Filtros', ['Filtro', 'Valor'], [['Generado', new Date().toISOString().replace('T', ' ').slice(0, 19) + ' (UTC)'], ['Zona horaria', 'America/Tegucigalpa'], ['Vista', st.f.filtro], ['Búsqueda', st.f.q], ['Plataforma', st.f.plataforma], ['Atendido por', st.f.vendedor], ['Responsable', st.f.responsable], ['Días', st.f.dias], ['Resultado', st.f.estado], ['Filas', filas.length]]);
      window.XLSX.writeFile(wb, 'Sublichat_' + st.cat + '_' + hoy() + '.xlsx', { cellDates: true }); } catch (e) { toast(e.message, true); }
  }

  // ------------------------------------------------------------------------------------------------ modal
  function modal(titulo, html) {
    var w = document.createElement('div'); w.className = 'gc-modal-w';
    w.innerHTML = '<div class="gc-modal" role="dialog" aria-modal="true" aria-label="' + esc(titulo) + '"><div class="gc-modal-h"><h3>' + esc(titulo) + '</h3><button type="button" class="gc-ib" data-x aria-label="Cerrar">✕</button></div><div class="gc-modal-b">' + html + '</div></div>';
    document.body.appendChild(w); var m = w.querySelector('.gc-modal');
    w.addEventListener('click', function (e) { if (e.target === w || e.target.closest('[data-x]')) cerrar(m); });
    w.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(m); });
    w.addEventListener('click', clicGlobal);
    setTimeout(function () { var f = m.querySelector('[data-x]'); if (f) f.focus(); }, 30);
    return m;
  }
  function cerrar(m) { var w = m && m.closest('.gc-modal-w'); if (w) w.remove(); }
  function refrescar() { if (st.vista === 'lista') cargarLista(); api('panel').then(function (p) { st.panel = p; if (st.vista === 'panel') pintar(); }).catch(function () {}); }

  // ------------------------------------------------------------------------------------------------ eventos
  async function clicGlobal(e) {
    var t;
    if ((t = e.target.closest('[data-gc-ficha]'))) { abrirFicha(t.dataset.gcFicha); return; }
    if ((t = e.target.closest('[data-gc-contactar]'))) { var mm = t.closest('.gc-modal'); if (mm) cerrar(mm); abrirContacto(t.dataset.gcContactar); return; }
    if ((t = e.target.closest('[data-gc-registrar]'))) { var m2 = t.closest('.gc-modal'); if (m2) cerrar(m2); abrirRegistrar(t.dataset.gcRegistrar); return; }
    if ((t = e.target.closest('[data-gc-tomar],[data-gc-soltar]'))) { var tomar = !!t.dataset.gcTomar; try { await api(tomar ? 'tomar' : 'soltar', { key: t.dataset.gcTomar || t.dataset.gcSoltar }); toast(tomar ? 'Ahora usted lo atiende.' : 'Quedó sin asignar.'); var m3 = t.closest('.gc-modal'); if (m3) { cerrar(m3); abrirFicha(t.dataset.gcTomar || t.dataset.gcSoltar); } refrescar(); } catch (er) { toast(er.message, true); } return; }
    if ((t = e.target.closest('[data-gc-nocontactar]'))) { var v = t.dataset.v === '1'; if (v && !confirm('¿Marcar «No desea recibir mensajes»? Se bloquean todos los contactos comerciales.')) return; try { await api('no_contactar', { key: t.dataset.gcNocontactar, valor: v }); toast(v ? 'Bloqueado: no se le escribirá.' : 'Bloqueo quitado.'); cerrar(t.closest('.gc-modal')); refrescar(); } catch (er) { toast(er.message, true); } return; }
    if ((t = e.target.closest('[data-gc-editpot]'))) { var fi = (t.closest('.gc-modal') || {})._ficha; cerrar(t.closest('.gc-modal')); formPotencial(fi); return; }
  }
  function enlazar(h) {
    if (h.dataset.gcOn) return; h.dataset.gcOn = '1';
    h.addEventListener('click', async function (e) {
      var t;
      if ((t = e.target.closest('[data-gc-ir]'))) { var k = t.dataset.gcIr; st.error = '';
        if (CAT[k]) { st.vista = 'lista'; st.cat = k; st.pagina = 1; st.sel = {}; st.f = { filtro: t.dataset.gcFiltro || 'todos', q: '', plataforma: '', vendedor: '', responsable: '', dias: '', estado: '' }; cargarLista(); return; }
        st.vista = k; pintar(); if (k === 'biblioteca' && !st.pl) { await plantillas().catch(function (er) { st.error = er.message; }); pintar(); } return; }
      if ((t = e.target.closest('[data-gc-filtro]'))) { st.f.filtro = t.dataset.gcFiltro; st.pagina = 1; cargarLista(); return; }
      if ((t = e.target.closest('[data-gc-pag]'))) { st.pagina += Number(t.dataset.gcPag); cargarLista(); return; }
      if ((t = e.target.closest('[data-gc-per]'))) { st.rep.periodo = t.dataset.gcPer; if (st.rep.periodo !== 'rango') cargarReporte(); else pintar(); return; }
      if ((t = e.target.closest('[data-gc-pled],[data-gc-pldup]'))) { var id = t.dataset.gcPled || t.dataset.gcPldup; editarPlantilla(st.pl.plantillas.find(function (p) { return p.id === id; }), !!t.dataset.gcPldup); return; }
      if ((t = e.target.closest('[data-gc-plact]'))) { var p = st.pl.plantillas.find(function (x) { return x.id === t.dataset.gcPlact; }); if (!st.pl.importadas) return toast('Primero importe la biblioteca.', true); try { await api('plantilla_guardar', { id: p.id, categoria: p.categoria, situacion: p.situacion, situacion_label: p.situacion_label, mensaje: p.mensaje, activa: p.activa === false }); await plantillas(); pintar(); } catch (er) { toast(er.message, true); } return; }
      if ((t = e.target.closest('[data-gc]'))) {
        var a = t.dataset.gc;
        if (a === 'recargar') { st.error = ''; await cargarPanel(true); if (st.vista === 'lista') cargarLista(); return; }
        if (a === 'nuevo-pot') return formPotencial();
        if (a === 'tomar-sel') { var ks = Object.keys(st.sel).filter(function (x) { return st.sel[x]; }); var ok = 0, oc = 0; for (var i = 0; i < ks.length; i++) { try { await api('tomar', { key: ks[i] }); ok++; } catch (_) { oc++; } } toast(ok + ' tomado(s)' + (oc ? ' · ' + oc + ' ya los atiende otra persona' : '')); st.sel = {}; cargarLista(); return; }
        if (a === 'limpiar-sel') { st.sel = {}; pintar(); return; }
        if (a === 'excel-lista') return excelLista(false);
        if (a === 'excel-sel') return excelLista(true);
        if (a === 'importar') { try { var r = await api('plantillas_importar'); toast(r.nuevas + ' nuevas · ' + r.iguales + ' iguales' + (r.conCambiosLocales.length ? ' · ' + r.conCambiosLocales.length + ' con cambios locales (no se tocaron)' : '') + (r.pendientesActualizar ? ' · ' + r.pendientesActualizar + ' distintas al original' : '')); await plantillas(); pintar(); } catch (er) { toast(er.message, true); } return; }
        if (a === 'pl-nueva') return editarPlantilla(null);
        if (a === 'rep') return cargarReporte();
        if (a === 'excel') return excelReporte();
        if (a === 'meta') return editarMeta();
      }
    });
    h.addEventListener('change', async function (e) {
      var t = e.target;
      if (t.matches('[data-gc-sel]')) { st.sel[t.dataset.gcSel] = t.checked; pintar(); return; }
      if (t.matches('[data-gc="sel-todos"]')) { (st.lista.filas || []).forEach(function (f) { st.sel[f.key] = t.checked; }); pintar(); return; }
      if (t.matches('[data-gc="asignar-sel"]') && t.value) { var ks = Object.keys(st.sel).filter(function (x) { return st.sel[x]; }); try { var r = await api('asignar', { keys: ks, usuario: t.value === '_sin' ? '' : t.value }); toast(r.hechos.length + ' asignado(s).'); st.sel = {}; cargarLista(); } catch (er) { toast(er.message, true); } return; }
      if (t.matches('select[data-gc-f]')) { st.f[t.dataset.gcF] = t.value; st.pagina = 1; cargarLista(); return; }
      if (t.matches('[data-gc-pl]') && t.tagName === 'SELECT') { st.plF[t.dataset.gcPl] = t.value; if (t.dataset.gcPl === 'cat') st.plF.sit = ''; pintar(); return; }
      if (t.matches('[data-gc-rep]')) { st.rep[t.dataset.gcRep] = t.value; return; }
    });
    var tq; h.addEventListener('input', function (e) { var t = e.target;
      if (t.matches('input[data-gc-f="q"]')) { clearTimeout(tq); tq = setTimeout(function () { st.f.q = t.value; st.pagina = 1; cargarLista().then(function () { var i = host().querySelector('input[data-gc-f="q"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 350); }
      if (t.matches('input[data-gc-pl="q"]')) { clearTimeout(tq); tq = setTimeout(function () { st.plF.q = t.value; pintar(); var i = host().querySelector('input[data-gc-pl="q"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); }
    });
    h.addEventListener('click', clicGlobal);
  }
  function editarMeta() {
    var p = st.panel, mt = p.meta || {};
    var m = modal('Meta comercial', '<div class="gc-form"><label>Mes (AAAA-MM)<input data-m="mes" value="' + esc(mt.mes || '') + '"></label><label>Referencia (vigentes al empezar)<input type="number" data-m="referencia" value="' + esc(mt.referencia || '') + '"></label><label>Objetivo de clientes vigentes<input type="number" data-m="objetivo" value="' + esc(mt.objetivo || '') + '"></label>' + p.agenda.map(function (a) { return '<label>Meta diaria · ' + esc(a.nombre) + '<input type="number" min="0" data-md="' + a.cat + '" value="' + a.meta + '"></label>'; }).join('') + '</div><div class="gc-acc-row"><button type="button" class="gc-btn" data-m-ok>Guardar</button></div>');
    m.querySelector('[data-m-ok]').onclick = async function () { var md = {}; m.querySelectorAll('[data-md]').forEach(function (i) { md[i.dataset.md] = Number(i.value); }); try { await api('meta_guardar', { mes: m.querySelector('[data-m="mes"]').value, referencia: m.querySelector('[data-m="referencia"]').value, objetivo: m.querySelector('[data-m="objetivo"]').value, metasDiarias: md }); toast('Meta guardada.'); cerrar(m); cargarPanel(true); } catch (e) { toast(e.message, true); } };
  }
  async function cargarPanel(fresco) { try { st.panel = await api('panel', fresco ? { fresco: true } : {}); st.error = ''; } catch (e) { st.error = e.message; } pintar(); }
  function open() { var h = host(); if (!h) return; var sc = document.getElementById('screen-comercial'); if (sc) sc.classList.add('gc-screen'); enlazar(h); pintar(); cargarPanel(); }
  window.SublichatComercial = { open: open, _st: st };
  window.addEventListener('sublichat:screen', function (e) { if (e.detail && e.detail.screen === 'comercial') open(); });
})();
