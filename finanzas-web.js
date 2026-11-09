/* finanzas-web.js · R196 — Sublichat Web › FINANZAS (pestaña nueva, navegación horizontal).
   Resumen · Proveedores · Compras · Ganancias · Reportes. «Productos» se abre en contexto (no es pestaña).
   · Diseño claro (referencia panel_de_finanzas_ganancias_y_rentabilidad.png): tarjetas blancas, rojo suave, sin sidebar ni neón.
   · NO modifica Control Maestro: solo lee los accesos VIP y escribe el vínculo financiero en colecciones propias (servidor).
   · Sin costo registrado = «Pendiente de costo» (nunca L0).
   · Importación Netflix VIP: el navegador SOLO lee el archivo (hojas EXTRAS_VIP y LOTES_COMPRAS, columnas A–L / editables);
     el servidor recalcula todo, previsualiza, confirma en una transacción y audita. */
(function () {
  'use strict';
  if (window.SublichatFinanzas) return;
  var HOST_ID = 'rbac-finanzas';
  var TABS = [['resumen', 'Resumen', 'bar'], ['proveedores', 'Proveedores', 'users'], ['compras', 'Compras', 'cart'], ['ganancias', 'Ganancias', 'trend'], ['reportes', 'Reportes', 'doc']];
  var I = {
    bar: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 16v-4"/><path d="M12 16V8"/><path d="M17 16v-7"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13H8"/><path d="M16 17H8"/>',
    coins: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    pct: '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    cols: '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    up: '<path d="m5 15 7-7 7 7"/>', down: '<path d="m19 9-7 7-7-7"/>', dots: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>', dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', plus: '<path d="M5 12h14"/><path d="M12 5v14"/>'
  };
  function ico(k, c) { return '<svg class="fz-i ' + (c || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (I[k] || '') + '</svg>'; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function L(v, dec) { var n = Number(v); if (!isFinite(n)) return '—'; var neg = n < 0; n = Math.abs(n); var s = n.toLocaleString('en-US', { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : (n < 100 && n % 1 ? 2 : 0) }); return (neg ? '−L' : 'L') + s; }
  function P(v) { return v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1) + '%'; }
  function U(v) { var n = Number(v); return isFinite(n) && v !== '' && v != null ? n.toLocaleString('en-US', { maximumFractionDigits: 4 }) + ' USDT' : '—'; }
  function fecha(ymd) { if (!ymd) return '—'; var p = String(ymd).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ymd; }
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function nombreMes(m) { var p = String(m || '').split('-'); return p.length === 2 ? MESES[Number(p[1]) - 1] + ' ' + p[0] : m; }
  function opId() { return 'fz-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
  var LOGOS = [[/netflix/i, 'netflix'], [/disney/i, 'disney'], [/prime/i, 'prime'], [/hbo|max\b/i, 'hbo'], [/spotify/i, 'spotify'], [/youtube/i, 'youtube'], [/canva/i, 'canva'], [/office/i, 'office365'], [/gemini/i, 'gemini'],
    [/duolingo/i, 'duolingo'], [/crunchy/i, 'crunchyroll'], [/paramount/i, 'paramount'], [/stella/i, 'stella-tv'], [/oleada/i, 'oleada-tv'], [/latin/i, 'latin-tv'], [/chatgpt|openai/i, 'chatgpt'], [/apple/i, 'appletv'],
    [/vix/i, 'vix'], [/viki/i, 'viki'], [/deezer/i, 'deezer'], [/eset|antivirus/i, 'eset'], [/windows ?11/i, 'windows11'], [/windows/i, 'windows10'], [/iptv|lion|nanotech|tv digital/i, 'iptv'], [/adobe/i, 'adobeexpress']];
  function logo(nombre) {
    var n = String(nombre || ''), f = ''; for (var i = 0; i < LOGOS.length; i++) if (LOGOS[i][0].test(n)) { f = LOGOS[i][1]; break; }
    var ini = esc(n.replace(/[^A-Za-zÁÉÍÓÚÑ0-9 ]/g, '').trim().slice(0, 1).toUpperCase() || '•');
    return f ? '<span class="fz-logo"><img src="/assets/platformas/' + f + '.jpg" alt="" loading="lazy" onerror="this.parentNode.classList.add(\'sin\');this.remove()"><i>' + ini + '</i></span>' : '<span class="fz-logo sin"><i>' + ini + '</i></span>';
  }
  var ESTADO_PROD = { rentable: ['Rentable', 'ok'], margen_bajo: ['Margen bajo', 'warn'], pendiente_costo: ['Pendiente de costo', 'pend'], parcial: ['Costo parcial', 'pend'] };
  var ESTADO_VIP = { activo: ['Activo', 'ok'], pendiente: ['Pendiente', 'warn'], baja: ['Baja', 'gris'], sin_registro: ['Sin registro', 'pend'], reemplazado: ['Reemplazado', 'gris'] };
  function pill(map, k) { var x = map[k] || [k, 'gris']; return '<span class="fz-pill ' + x[1] + '">' + esc(x[0]) + '</span>'; }

  var st = { tab: 'ganancias', mes: '', data: null, cargando: false, error: '', sub: 'registradas', vip: { tab: 'trap', q: '', pagina: 1, res: null }, imp: null, jobs: null, rep: { desde: '', hasta: '' }, chart: null };

  async function api(accion, body) {
    var r = await fetch('/api/finanzas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ accion: accion, origen: 'web' }, body || {})) });
    var j = null; try { j = await r.json(); } catch (_) {}
    if (!r.ok || !j || j.ok === false) throw new Error((j && j.error) || (r.status === 403 ? 'Su usuario no tiene Finanzas.' : 'No se pudo completar.'));
    return j;
  }
  function toast(msg, mal) { var t = document.createElement('div'); t.className = 'fz-toast' + (mal ? ' mal' : ''); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.classList.add('on'); }, 10); setTimeout(function () { t.remove(); }, 3600); }
  function host() { return document.getElementById(HOST_ID); }

  async function cargar(forzar) {
    if (st.cargando) return; st.cargando = true; st.error = ''; if (!st.data || forzar) pintar();
    try { st.data = await api('finp_panel', { mes: st.mes || undefined }); st.mes = st.data.mes; } catch (e) { st.error = e.message; }
    st.cargando = false; pintar();
  }

  // ---------------------------------------------------------------------------------------------------- pintado
  function pintar() {
    var h = host(); if (!h) return;
    var scr = document.getElementById('screen-finanzas'); if (scr) scr.classList.add('fz-screen');
    if (st.chart) { try { st.chart.destroy(); } catch (_) {} st.chart = null; }
    var d = st.data;
    var mesSel = '<label class="fz-mes"><span>Mes</span><input type="month" data-fz-mes value="' + esc(st.mes || '') + '"></label>';
    var cab = '<div class="fz-head"><div><h1>Finanzas</h1><p>Ganancias, margen y rendimiento por producto</p></div><div class="fz-head-acc">' + mesSel +
      '<button type="button" class="fz-btn sec" data-fz="productos">' + ico('box') + 'Productos</button></div></div>' +
      '<nav class="fz-tabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" role="tab" class="fz-tab' + (st.tab === t[0] ? ' on' : '') + '" data-fz-tab="' + t[0] + '" aria-selected="' + (st.tab === t[0]) + '">' + ico(t[2]) + t[1] + '</button>'; }).join('') + '</nav>';
    var cuerpo;
    if (st.error && !d) cuerpo = '<div class="fz-card fz-vacio"><b>No se pudo abrir Finanzas</b><span>' + esc(st.error) + '</span><button type="button" class="fz-btn" data-fz="reintentar">Reintentar</button></div>';
    else if (!d) cuerpo = '<div class="fz-card fz-vacio"><span class="fz-spin"></span><b>Cargando Finanzas…</b></div>';
    else cuerpo = ({ resumen: vResumen, proveedores: vProveedores, compras: vCompras, ganancias: vGanancias, reportes: vReportes }[st.tab] || vGanancias)(d);
    h.innerHTML = '<div class="fz">' + cab + (st.cargando && d ? '<div class="fz-cargando">Actualizando…</div>' : '') + cuerpo + '</div>';
    if (d && (st.tab === 'ganancias' || st.tab === 'resumen')) dibujarChart(d);
    if (d && st.tab === 'compras' && st.sub === 'vip' && !st.vip.res) cargarVip();
    if (d && st.tab === 'compras' && st.sub === 'importar' && !st.jobs) cargarJobs();
    if (d && st.tab === 'compras' && st.sub === 'spotify' && !st.spf) cargarSpf();
  }

  function kpis(d) {
    var k = d.kpis, v = d.variacion || {};
    function delta(x, inverso, pp) { if (x == null) return '<em class="fz-delta n">sin dato del mes anterior</em>'; var bueno = inverso ? x <= 0 : x >= 0; return '<em class="fz-delta ' + (bueno ? 'ok' : 'mal') + '">' + ico(x >= 0 ? 'up' : 'down') + (x > 0 ? '+' : '') + x + (pp ? ' pp' : '%') + ' <span>vs. mes anterior</span></em>'; }
    function card(ic, cls, t, val, dl, extra) { return '<div class="fz-card fz-kpi"><span class="fz-kpi-i ' + cls + '">' + ico(ic) + '</span><div><small>' + t + '</small><strong>' + val + '</strong>' + dl + (extra || '') + '</div></div>'; }
    var sinCosto = k.ingresoSinCostoHnl > 0 ? '<em class="fz-nota">' + L(k.ingresoSinCostoHnl) + ' en ventas pendientes de costo (fuera del margen)</em>' : '';
    return '<div class="fz-kpis">' + card('coins', 'v', 'Ingresos del mes', L(k.ingresosHnl), delta(v.ingresos)) + card('layers', 'r', 'Costos del mes', L(k.costosHnl), delta(v.costos, true)) +
      card('cols', 'v', 'Ganancia después de costos registrados', L(k.gananciaHnl), delta(v.ganancia), sinCosto) + card('pct', 'a', 'Margen', P(k.margen), delta(v.margenPp, false, true)) + '</div>';
  }
  function alertasHtml(d, max) {
    var a = d.alertas || []; var lst = max ? a.slice(0, max) : a;
    return '<div class="fz-card fz-alertas"><div class="fz-cab">' + ico('alert', 'am') + '<h3>Alertas</h3><span class="fz-badge">' + a.length + ' alerta' + (a.length === 1 ? '' : 's') + '</span></div>' +
      '<p class="fz-sub">Margen por debajo del objetivo (' + esc(d.config.umbralMargen) + '%), ventas sin costo y pagos a proveedores. <button type="button" class="fz-link" data-fz="umbral">Cambiar objetivo</button></p>' +
      (lst.length ? lst.map(function (x) { return '<div class="fz-alerta ' + esc(x.nivel) + '">' + logo(x.producto) + '<div><b>' + esc(x.producto || '') + '</b><span>' + esc(x.texto) + '</span></div>' + (x.tipo === 'sin_costo' || x.tipo === 'stock' ? '<button type="button" class="fz-btn sec sm" data-fz="compra" data-prod="' + esc(x.productoId || '') + '">Registrar compra</button>' : x.tipo === 'spf_renovacion' ? '<button type="button" class="fz-btn sec sm" data-fz-tab="compras" data-sub="spotify">Ver cuentas</button>' : x.tipo.indexOf('vip') === 0 ? '<button type="button" class="fz-btn sec sm" data-fz-tab="compras" data-sub="vip">Ver VIP</button>' : '<button type="button" class="fz-btn sec sm" data-fz="productos">Gestionar</button>') + '</div>'; }).join('') : '<div class="fz-ok">Sin alertas este mes.</div>') + '</div>';
  }
  function topHtml(d) {
    return '<div class="fz-card fz-top"><div class="fz-cab">' + ico('trophy') + '<h3>Top productos más rentables</h3><span class="fz-sub r">Por ganancia</span></div>' +
      (d.top.length ? d.top.map(function (p, i) { return '<div class="fz-top-f"><span class="fz-n n' + (i + 1) + '">' + (i + 1) + '</span>' + logo(p.producto) + '<b>' + esc(p.producto) + '</b><strong>' + L(p.gananciaHnl) + '</strong><small>Margen: ' + P(p.margen) + '</small></div>'; }).join('') : '<div class="fz-vacio-s">Aún no hay ventas con costo registrado este mes.</div>') + '</div>';
  }
  function chartHtml(titulo) { return '<div class="fz-card fz-chart"><div class="fz-cab"><h3>' + titulo + '</h3><span class="fz-sub r">' + esc(nombreMes(st.mes)) + '</span></div><div class="fz-chart-box"><canvas id="fzChart" aria-label="Ganancia por categoría"></canvas></div><div class="fz-chart-alt" id="fzChartAlt"></div></div>'; }
  function dibujarChart(d) {
    var cv = document.getElementById('fzChart'); if (!cv) return;
    var cats = (d.categorias || []).filter(function (c) { return c.gananciaHnl !== 0 || c.ingresoHnl > 0; }).slice(0, 8);
    if (!cats.length) { cv.parentNode.innerHTML = '<div class="fz-vacio-s">Sin ventas con costo registrado en ' + esc(nombreMes(st.mes)) + '.</div>'; return; }
    var colores = ['#E2231A', '#EF5350', '#F28B82', '#F6A9A3', '#F9C6C1', '#FBD9D5', '#FCE5E2', '#FDEDEB'];
    if (!window.Chart) { // respaldo: barras CSS
      var max = Math.max.apply(null, cats.map(function (c) { return Math.max(0, c.gananciaHnl); })) || 1;
      cv.parentNode.innerHTML = '<div class="fz-barras">' + cats.map(function (c, i) { return '<div class="fz-barra"><b>' + L(c.gananciaHnl) + '</b><i style="height:' + Math.max(2, Math.round(Math.max(0, c.gananciaHnl) / max * 160)) + 'px;background:' + colores[i] + '"></i><span>' + esc(c.label) + '</span></div>'; }).join('') + '</div>'; return;
    }
    st.chart = new window.Chart(cv, { type: 'bar', data: { labels: cats.map(function (c) { return c.label; }), datasets: [{ data: cats.map(function (c) { return c.gananciaHnl; }), backgroundColor: cats.map(function (_, i) { return colores[i]; }), borderRadius: 4, maxBarThickness: 120 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, layout: { padding: { top: 24 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return 'Ganancia ' + L(c.raw); } } } },
        scales: { x: { grid: { display: false }, ticks: { color: '#5B6472', font: { size: 12 } } }, y: { grid: { color: '#EEF1F5' }, border: { display: false }, ticks: { color: '#8A93A0', callback: function (v) { return L(v); } } } } },
      plugins: [{ id: 'fzEtiquetas', afterDatasetsDraw: function (ch) { var ctx = ch.ctx; ctx.save(); ctx.font = '700 13px Inter,system-ui,sans-serif'; ctx.fillStyle = '#1F2430'; ctx.textAlign = 'center'; ch.getDatasetMeta(0).data.forEach(function (b, i) { ctx.fillText(L(ch.data.datasets[0].data[i]), b.x, b.y - 8); }); ctx.restore(); } }] });
  }
  function tablaRent(d) {
    var f = d.productos || [];
    return '<div class="fz-card fz-rent"><div class="fz-cab">' + ico('layers') + '<h3>Rentabilidad por producto</h3><span class="fz-sub r">' + esc(nombreMes(st.mes)) + '</span></div>' +
      (f.length ? '<div class="fz-tw"><table class="fz-t"><thead><tr><th>Producto</th><th class="n">Ventas</th><th class="n">Ingresos</th><th class="n">Costos</th><th class="n">Ganancia</th><th class="c">Margen</th><th class="c">Estado</th></tr></thead><tbody>' +
        f.map(function (p) {
          var gan = p.gananciaHnl == null ? '<span class="fz-pend">Pendiente de costo</span>' : '<b class="' + (p.gananciaHnl >= 0 ? 'vd' : 'rj') + '">' + L(p.gananciaHnl) + '</b>';
          var costo = p.ingresoCosteadoHnl > 0 ? L(p.costoHnl) : '<span class="fz-pend">Pendiente</span>';
          var mg = p.margen == null ? '—' : '<span class="fz-mg ' + (p.estado === 'margen_bajo' ? 'warn' : 'ok') + '">' + P(p.margen) + '</span>';
          var nota = p.ingresoPendienteHnl > 0 && p.ingresoCosteadoHnl > 0 ? '<small class="fz-pend">' + L(p.ingresoPendienteHnl) + ' sin costo</small>' : '';
          return '<tr><td><div class="fz-prod">' + logo(p.producto) + '<b>' + esc(p.producto) + '</b></div></td><td class="n">' + p.ventas + '</td><td class="n">' + L(p.ingresoHnl) + '</td><td class="n">' + costo + '</td><td class="n">' + gan + nota + '</td><td class="c">' + mg + '</td><td class="c">' + pill(ESTADO_PROD, p.estado) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="fz-vacio-s">Sin ventas en ' + esc(nombreMes(st.mes)) + '.</div>') + '</div>';
  }
  function vGanancias(d) {
    return kpis(d) + '<div class="fz-g2">' + chartHtml('Ganancia por categoría') + topHtml(d) + '</div><div class="fz-g2 b">' + tablaRent(d) + alertasHtml(d) + '</div>' + notaCosteo(d);
  }
  function notaCosteo(d) {
    var k = d.kpis; return '<p class="fz-pie">Ganancia = ingresos con costo registrado − costo asignado (PEPS) de esas ventas. ' + (k.ventasSinCosto ? k.ventasSinCosto + ' venta(s) quedan «Pendiente de costo» y no entran al margen. ' : '') + 'No incluye gastos operativos: esos van en Egresos/Cierre.</p>';
  }
  function vResumen(d) {
    var v = d.vip || {}, pv = v.porProveedor || {};
    var vip = '<div class="fz-card"><div class="fz-cab">' + logo('Netflix') + '<h3>Netflix VIP alquilado</h3><button type="button" class="fz-btn sec sm" data-fz-tab="compras" data-sub="vip">Abrir lista</button></div><div class="fz-mini">' +
      [['Trap', pv.trap], ['Deku', pv.deku], ['Propios', pv.propio], ['Sin proveedor', pv.sin]].map(function (x) { return '<div><small>' + x[0] + '</small><b>' + (x[1] || 0) + '</b></div>'; }).join('') + '</div><p class="fz-sub">' + (v.proximos7 || 0) + ' con cobro del proveedor en 7 días · ' + (v.lotes || 0) + ' lotes pagados registrados</p></div>';
    var compras = '<div class="fz-card"><div class="fz-cab">' + ico('cart') + '<h3>Últimas compras</h3><button type="button" class="fz-btn sm" data-fz="compra">' + ico('plus') + 'Registrar compra</button></div>' +
      ((d.lotes || []).slice(0, 6).map(function (l) { return '<div class="fz-lin">' + logo(l.producto) + '<div><b>' + esc(l.producto) + '</b><small>' + fecha(l.fecha) + ' · ' + esc(l.proveedor || 'Sin proveedor') + ' · ' + esc(l.cuentaPagoNombre || l.pago || '') + '</small></div><strong>' + L(l.costoTotalHnl) + '</strong></div>'; }).join('') || '<div class="fz-vacio-s">Sin compras registradas.</div>') + '</div>';
    return kpis(d) + '<div class="fz-g2">' + chartHtml('Ganancia por categoría') + alertasHtml(d, 4) + '</div><div class="fz-g2 c">' + compras + vip + '</div>' + notaCosteo(d);
  }
  function vProveedores(d) {
    var cp = d.costosProveedor || [], rp = d.rentProveedores || [];
    var rows = (d.proveedores || []).map(function (p) {
      var mios = cp.filter(function (c) { return String(c.proveedor).toLowerCase() === String(p.alias).toLowerCase(); });
      var r = rp.find(function (x) { return String(x.nombre).toLowerCase() === String(p.alias).toLowerCase(); });
      var gastado = mios.reduce(function (a, c) { return a + c.costoHnl; }, 0);
      return '<tr><td><div class="fz-prod"><span class="fz-logo sin"><i>' + esc(p.alias.slice(0, 1)) + '</i></span><div><b>' + esc(p.alias) + '</b><small>' + esc([p.pais, p.metodoPago, p.moneda].filter(Boolean).join(' · ')) + '</small></div></div></td>' +
        '<td>' + (mios.map(function (c) { return '<span class="fz-chip' + (c.masEconomico ? ' ok' : '') + '">' + esc(c.producto) + ' · ' + L(c.promedioHnl, true) + '/u' + (c.masEconomico ? ' · más económico' : '') + '</span>'; }).join('') || '<span class="fz-sub">Sin compras</span>') + '</td>' +
        '<td class="n">' + (mios.reduce(function (a, c) { return a + c.compras; }, 0)) + '</td><td class="n">' + L(gastado) + '</td><td class="n">' + (r ? L(r.utilidadBrutaHnl) : '—') + '</td><td class="c">' + (p.activo ? pill({ a: ['Activo', 'ok'] }, 'a') : pill({ i: ['Inactivo', 'gris'] }, 'i')) + '</td>' +
        '<td class="c"><button type="button" class="fz-btn sec sm" data-fz="prov" data-id="' + esc(p.id) + '">Editar</button></td></tr>';
    }).join('');
    var pv = (d.vip || {}).porProveedor || {};
    return '<div class="fz-g3">' + [['Trap colombiano', pv.trap, 'Netflix VIP'], ['Deku peruano', pv.deku, 'Netflix VIP'], ['Sin proveedor', pv.sin, 'Extras VIP sin vincular']].map(function (x) { return '<div class="fz-card fz-kpi"><span class="fz-kpi-i r">' + ico('users') + '</span><div><small>' + x[0] + '</small><strong>' + (x[1] || 0) + '</strong><em class="fz-delta n">' + x[2] + '</em></div></div>'; }).join('') + '</div>' +
      '<div class="fz-card"><div class="fz-cab">' + ico('users') + '<h3>Proveedores</h3><button type="button" class="fz-btn sm" data-fz="prov">' + ico('plus') + 'Nuevo proveedor</button></div>' +
      '<div class="fz-tw"><table class="fz-t"><thead><tr><th>Proveedor</th><th>Costo promedio por producto</th><th class="n">Compras</th><th class="n">Total comprado</th><th class="n">Ganancia (' + esc(nombreMes(st.mes)) + ')</th><th class="c">Estado</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="7" class="fz-vacio-s">Sin proveedores.</td></tr>') + '</tbody></table></div>' +
      '<p class="fz-pie">El proveedor de un extra VIP se toma del NOMBRE (Trap/Deku), nunca del precio. Los valores 2.50/2.70 USDT son solo referencia.</p></div>';
  }
  function vCompras(d) {
    var subs = [['registradas', 'Compras registradas'], ['spotify', 'Spotify Familiar'], ['vip', 'Netflix VIP'], ['importar', 'Importar Excel VIP']];
    var nav = '<div class="fz-subtabs">' + subs.map(function (s) { return '<button type="button" class="' + (st.sub === s[0] ? 'on' : '') + '" data-fz-sub="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>';
    if (st.sub === 'vip') return nav + vVip();
    if (st.sub === 'importar') return nav + vImportar();
    if (st.sub === 'spotify') return nav + vSpotify();
    var rows = (d.lotes || []).map(function (l) {
      return '<tr><td>' + fecha(l.fecha) + '</td><td><div class="fz-prod">' + logo(l.producto) + '<b>' + esc(l.producto) + '</b></div></td><td>' + esc(l.proveedor || '—') + '</td><td class="n">' + esc(l.cantidad) + ' ' + esc(l.unidad || '') + '</td>' +
        '<td class="n">' + (l.moneda === 'HNL' ? L(l.costoTotalMoneda, true) : esc(l.costoTotalMoneda) + ' ' + esc(l.moneda)) + '</td><td class="n">' + (l.moneda === 'HNL' ? '—' : esc(l.tasa)) + '</td><td class="n"><b>' + L(l.costoTotalHnl, true) + '</b></td><td>' + esc(l.cuentaPagoNombre || l.pago) + '</td><td class="n">' + esc(l.disponible) + '</td></tr>';
    }).join('');
    return nav + '<div class="fz-card"><div class="fz-cab">' + ico('cart') + '<h3>Compras registradas</h3><button type="button" class="fz-btn sm" data-fz="compra">' + ico('plus') + 'Registrar compra</button></div>' +
      '<p class="fz-sub">Cada compra crea un lote con su tasa guardada (no cambia después). Spotify Familiar: UNA compra por familia y mes, aunque tenga 5 invitaciones.</p>' +
      '<div class="fz-tw"><table class="fz-t"><thead><tr><th>Fecha</th><th>Producto</th><th>Proveedor</th><th class="n">Cantidad</th><th class="n">Monto</th><th class="n">Tasa</th><th class="n">Costo HNL</th><th>Pago</th><th class="n">Disponible</th></tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="fz-vacio-s">Sin compras registradas.</td></tr>') + '</tbody></table></div></div>';
  }

  // ---------------------------------------------------------------------------------------------------- R196f · Spotify Familiar
  // Las cuentas llegan solas desde /spotifyf (bot) y Control Maestro. Aquí solo se anota cuánto se paga al mes y cuándo renueva la cuenta principal.
  async function cargarSpf() { try { st.spf = await api('finp_spf_lista'); } catch (e) { st.spf = { error: e.message }; } if (st.tab === 'compras' && st.sub === 'spotify') pintar(); }
  function vSpotify() {
    var r = st.spf;
    var cab = '<div class="fz-card"><div class="fz-cab">' + logo('Spotify') + '<h3>Spotify Familiar · cuentas principales</h3></div><p class="fz-sub">Se agregan solas desde /spotifyf o Control Maestro. Aquí solo anote cuánto paga al mes y la renovación de la cuenta principal. «Registrar pago» crea UNA compra del mes (la tasa y el costo quedan guardados).</p>';
    if (!r) return cab + '<div class="fz-vacio-s"><span class="fz-spin"></span> Cargando…</div></div>';
    if (r.error) return cab + '<div class="fz-vacio-s">' + esc(r.error) + '</div></div>';
    var mini = '<div class="fz-mini"><div><small>Cuentas</small><b>' + r.filas.length + '</b></div><div><small>Pago mensual total</small><b>' + L(r.totalMensualHnl) + '</b></div><div><small>Sin datos</small><b>' + r.sinDatos + '</b></div><div><small>Renuevan en 7 días</small><b>' + r.pronto + '</b></div></div>';
    var rows = r.filas.map(function (f) {
      var ren = f.proximaRenovacion ? fecha(f.proximaRenovacion) + (f.vencida ? ' <span class="fz-pill warn">vencida</span>' : f.pronto ? ' <span class="fz-pill warn">pronto</span>' : '') : '<span class="fz-pend">Pendiente</span>';
      return '<tr><td><b>' + esc(f.codigo) + '</b></td><td>' + esc(f.madreCorreo) + '</td><td class="n">' + f.ocupados + '/' + f.capacidad + '</td><td class="n">' + (f.costoMensualHnl == null ? '<span class="fz-pend">Pendiente</span>' : L(f.costoMensualHnl, true)) + '</td><td>' + ren + '</td><td>' + (f.ultimoPago ? fecha(f.ultimoPago) : '—') + '</td>' +
        '<td class="c"><button type="button" class="fz-btn sm" data-fz-spf="pago" data-id="' + esc(f.familiaId) + '">Registrar pago</button> <button type="button" class="fz-btn sec sm" data-fz-spf="editar" data-id="' + esc(f.familiaId) + '">Editar</button></td></tr>';
    }).join('');
    return cab + mini + '<div class="fz-tw" style="margin-top:12px"><table class="fz-t"><thead><tr><th>Cuenta</th><th>Correo principal</th><th class="n">Invitados</th><th class="n">Pago mensual</th><th>Renovación</th><th>Último pago</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="7" class="fz-vacio-s">Aún no hay cuentas. Créelas con /spotifyf en el bot.</td></tr>') + '</tbody></table></div></div>';
  }
  function masUnMes(ymd) { var p = String(ymd || '').split('-').map(Number); if (p.length !== 3) return ''; var d = new Date(Date.UTC(p[0], p[1], p[2], 12)); if (d.getUTCDate() !== p[2]) d = new Date(Date.UTC(p[0], p[1] + 1, 0, 12)); return d.toISOString().slice(0, 10); }
  function abrirSpf(acc, id) {
    var f = ((st.spf && st.spf.filas) || []).find(function (x) { return x.familiaId === id; }); if (!f) return;
    var d = st.data, hoy = d.hoy;
    if (acc === 'editar') {
      modal('Editar · ' + f.codigo, '<div class="fz-form"><label>Pago mensual (L)<input type="number" step="any" min="0" name="costo" value="' + esc(f.costoMensualHnl == null ? '' : f.costoMensualHnl) + '"></label><label>Renovación cuenta principal<input type="date" name="ren" value="' + esc(f.proximaRenovacion || '') + '"></label></div><p class="fz-sub">Solo guarda los datos; no registra una compra.</p>',
        async function (m) { await api('finp_spf_guardar', { familiaId: id, costoMensualHnl: val(m, 'costo'), proximaRenovacion: val(m, 'ren') }); toast('Guardado.'); st.spf = null; pintar(); });
      return;
    }
    var prod = (d.productosCatalogo || []).find(function (p) { return p.id === 'SPOTIFY-FAM' || (/spotify/i.test(p.nombre) && p.modelo === 'cuenta_madre'); });
    var html = '<div class="fz-form"><label>Monto pagado (L)<input type="number" step="any" min="0" name="monto" value="' + esc(f.costoMensualHnl == null ? '' : f.costoMensualHnl) + '"></label><label>Fecha del pago<input type="date" name="fecha" value="' + esc(hoy) + '" max="' + esc(hoy) + '"></label>' +
      '<label>Pagado con<select name="bancoId"><option value="">— elegir banco/tarjeta —</option>' + (d.metodos || []).map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.nombre) + '</option>'; }).join('') + '</select></label>' +
      '<label>Próxima renovación<input type="date" name="ren" value="' + esc(masUnMes(f.proximaRenovacion && f.proximaRenovacion >= hoy ? f.proximaRenovacion : hoy)) + '"></label></div>' +
      '<p class="fz-sub">' + (prod ? 'Se registra UNA compra de «' + esc(prod.nombre) + '» (1 cuenta, este mes). Las invitaciones no se pagan aparte.' : 'No hay producto «Spotify Familiar» en el catálogo: se guarda el pago y la renovación, sin compra. Créelo en Productos para que cuente en Ganancias.') + '</p>';
    var opid = opId();
    modal('Registrar pago · ' + f.codigo + ' · ' + f.madreCorreo, html, async function (m) {
      var monto = Number(val(m, 'monto')); if (!(monto > 0)) throw new Error('Escriba el monto pagado en Lempiras.');
      var loteId = '';
      if (prod) {
        if (!val(m, 'bancoId')) throw new Error('Elija con qué banco o tarjeta se pagó.');
        var r = await api('fin_compra_registrar', { operationId: opid, compra: { productoId: prod.id, fecha: val(m, 'fecha'), cantidad: 1, costoTotal: monto, moneda: 'HNL', pago: 'banco', bancoId: val(m, 'bancoId'), referencia: 'Spotify Familiar ' + f.codigo + ' · ' + f.madreCorreo } });
        loteId = r.loteId || '';
      }
      await api('finp_spf_guardar', { familiaId: id, costoMensualHnl: monto, proximaRenovacion: val(m, 'ren'), ultimoPago: val(m, 'fecha'), loteId: loteId });
      toast(prod ? 'Pago registrado (1 compra) y renovación guardada.' : 'Pago y renovación guardados.'); st.spf = null; cargar(true);
    }, 'Registrar pago');
  }

  // ---------------------------------------------------------------------------------------------------- Netflix VIP (lista)
  async function cargarVip() {
    try { st.vip.res = await api('finp_vip_lista', { tab: st.vip.tab, q: st.vip.q, pagina: st.vip.pagina }); } catch (e) { st.vip.res = { error: e.message }; }
    if (st.tab === 'compras' && st.sub === 'vip') pintar();
  }
  function vVip() {
    var r = st.vip.res;
    var c = (r && r.conteo) || {};
    var tabs = [['trap', 'Trap'], ['deku', 'Deku'], ['propio', 'Propios'], ['sin', 'Sin proveedor']];
    var cab = '<div class="fz-card"><div class="fz-cab">' + logo('Netflix') + '<h3>Netflix VIP</h3><input class="fz-in" type="search" placeholder="Buscar correo, cliente o cuenta madre" data-fz-vipq value="' + esc(st.vip.q) + '"></div>' +
      '<div class="fz-subtabs in">' + tabs.map(function (t) { return '<button type="button" class="' + (st.vip.tab === t[0] ? 'on' : '') + '" data-fz-viptab="' + t[0] + '">' + t[1] + ' <span>' + (c[t[0]] || 0) + '</span></button>'; }).join('') + '</div>';
    if (!r) return cab + '<div class="fz-vacio-s"><span class="fz-spin"></span> Cargando…</div></div>';
    if (r.error) return cab + '<div class="fz-vacio-s">' + esc(r.error) + '</div></div>';
    var rows = r.filas.map(function (f) {
      return '<tr><td><b>' + esc(f.correo) + '</b><small>' + esc(f.madre || '') + '</small></td><td>' + esc(f.cliente || '—') + '</td><td>' + esc(f.proveedor || '—') + '</td><td class="n">' + U(f.costoMensualUsdt) + '<small>' + (f.costoMensualHnl ? L(f.costoMensualHnl, true) : '') + '</small></td>' +
        '<td>' + fecha(f.proximoPagoProveedor) + '</td><td>' + esc(f.loteId || '—') + '</td><td class="c">' + pill(ESTADO_VIP, f.estado) + '</td><td class="c"><div class="fz-menu"><button type="button" class="fz-ib" data-fz-menu aria-label="Opciones">' + ico('dots') + '</button>' +
        '<div class="fz-menu-l"><button type="button" data-fz-vip="editar" data-id="' + esc(f.cmId) + '">Editar</button><button type="button" data-fz-vip="reemplazar" data-id="' + esc(f.cmId) + '"' + (f.estado === 'sin_registro' ? ' disabled' : '') + '>Reemplazar</button><button type="button" data-fz-vip="baja" data-id="' + esc(f.cmId) + '"' + (f.estado === 'sin_registro' || f.estado === 'baja' ? ' disabled' : '') + '>Dar de baja</button><button type="button" data-fz-vip="historial" data-id="' + esc(f.cmId) + '">Historial</button></div></div></td></tr>';
    }).join('');
    var pag = '<div class="fz-pag"><span>' + r.total + ' extra(s) · página ' + r.pagina + ' de ' + r.paginas + '</span><button type="button" class="fz-btn sec sm" data-fz-pag="-1"' + (r.pagina <= 1 ? ' disabled' : '') + '>Anterior</button><button type="button" class="fz-btn sec sm" data-fz-pag="1"' + (r.pagina >= r.paginas ? ' disabled' : '') + '>Siguiente</button></div>';
    return cab + '<div class="fz-tw"><table class="fz-t"><thead><tr><th>Correo / ID extra</th><th>Cliente (Control Maestro)</th><th>Proveedor</th><th class="n">Costo mensual</th><th>Próximo cobro proveedor</th><th>Lote</th><th class="c">Estado</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="8" class="fz-vacio-s">Sin extras en esta pestaña.</td></tr>') + '</tbody></table></div>' + pag + '<p class="fz-pie">El cliente y su vencimiento se leen de Control Maestro: Finanzas no los cambia. «Reemplazar» mueve solo el vínculo financiero a otro acceso VIP existente.</p></div>';
  }
  function filaVip(id) { return ((st.vip.res && st.vip.res.filas) || []).find(function (f) { return f.cmId === id; }); }

  // ---------------------------------------------------------------------------------------------------- importación Excel VIP
  async function cargarJobs() { try { st.jobs = (await api('finp_importaciones')).jobs; } catch (e) { st.jobs = []; } if (st.sub === 'importar') pintar(); }
  function vImportar() {
    var imp = st.imp;
    var zona = '<label class="fz-drop" data-fz-drop><input type="file" accept=".xlsx" data-fz-file hidden>' + ico('upload') + '<b>Arrastre aquí «Sublichat_Netflix_VIP_Importacion.xlsx»</b><span>o toque para elegirlo · se leen solo EXTRAS_VIP y LOTES_COMPRAS · EJEMPLOS_NO_IMPORTAR y columnas _NO_IMPORTAR se ignoran</span></label>';
    var cuerpo = '';
    if (imp && imp.error) cuerpo = '<div class="fz-err">' + esc(imp.error) + '</div>';
    if (imp && imp.cargando) cuerpo = '<div class="fz-vacio-s"><span class="fz-spin"></span> Revisando el archivo…</div>';
    if (imp && imp.pv) {
      var r = imp.pv.resumen;
      var cont = [['Nuevos', r.nuevos, 'ok'], ['Actualizados', r.actualizados, 'ok'], ['Sin cambios', r.sinCambios, 'gris'], ['Ambiguos', r.ambiguos, 'warn'], ['Sin coincidencia', r.sinCoincidencia, 'mal'], ['Duplicados', r.duplicados, 'mal'], ['Costo inválido', r.costoInvalido, 'mal'], ['Fecha inválida', r.fechaInvalida, 'mal'], ['Lote sin referencia', r.loteSinReferencia, 'mal'], ['Proveedor desconocido', r.proveedorDesconocido, 'mal']];
      var amb = imp.pv.extras.filter(function (x) { return x.estado === 'ambiguo'; });
      var problemas = imp.pv.extras.filter(function (x) { return x.errores.length || x.avisos.length; });
      cuerpo = '<div class="fz-cab sub"><h3>Vista previa · ' + esc(imp.archivo.nombre) + '</h3><span class="fz-sub r">' + r.filasExtras + ' filas de extras · ' + imp.pv.lotes.length + ' lotes</span></div>' +
        '<div class="fz-cont">' + cont.map(function (c) { return '<div class="' + (c[1] ? c[2] : 'gris') + '"><b>' + c[1] + '</b><span>' + c[0] + '</span></div>'; }).join('') + '</div>' +
        '<div class="fz-cont lot"><div class="ok"><b>' + r.pagosUnicos + '</b><span>Pagos únicos (lotes nuevos)</span></div><div class="gris"><b>' + r.lotesActualizados + '</b><span>Lotes que cambian</span></div><div class="' + (r.lotesConError ? 'mal' : 'gris') + '"><b>' + r.lotesConError + '</b><span>Lotes con error</span></div><div class="gris"><b>0</b><span>Ventas, cuentas o clientes creados</span></div></div>' +
        (amb.length ? '<h4 class="fz-h4">Revisión manual · correo repetido en Control Maestro</h4>' + amb.map(function (x) { return '<div class="fz-amb"><span>Fila ' + x.fila + ' · <b>' + esc(x.correo) + '</b></span><select data-fz-res="' + x.fila + '"><option value="">— elegir acceso —</option>' + x.candidatos.map(function (c) { return '<option value="' + esc(c.id) + '"' + (imp.res[x.fila] === c.id ? ' selected' : '') + '>' + esc(c.id + ' · madre ' + (c.madre || '?') + ' · ' + (c.cliente || 'sin cliente')) + '</option>'; }).join('') + '</select></div>'; }).join('') + '<button type="button" class="fz-btn sec sm" data-fz="reprevia">Aplicar selección y revisar de nuevo</button>' : '') +
        (problemas.length ? '<h4 class="fz-h4">Filas bloqueadas o con aviso (solo esas filas)</h4><div class="fz-tw"><table class="fz-t sm"><thead><tr><th>Fila</th><th>Correo</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>' + problemas.slice(0, 60).map(function (x) { return '<tr><td>' + x.fila + '</td><td>' + esc(x.correo || '—') + '</td><td>' + esc(x.estado) + '</td><td>' + esc(x.errores.concat(x.avisos).join(' · ')) + '</td></tr>'; }).join('') + '</tbody></table></div>' + (problemas.length > 60 ? '<p class="fz-sub">… y ' + (problemas.length - 60) + ' más (vienen en el Excel de errores).</p>' : '') : '') +
        imp.pv.lotes.filter(function (l) { return l.errores.length || (l.avisos || []).length; }).map(function (l) { return '<div class="fz-err">Lote ' + esc(l.idLote || ('fila ' + l.fila)) + ': ' + esc(l.errores.concat(l.avisos || []).join(' · ')) + '</div>'; }).join('') +
        '<label class="fz-check"><input type="checkbox" data-fz-confirmo' + (imp.confirmo ? ' checked' : '') + '> Confirmo la conciliación: solo vincula proveedor, costo y lote a accesos VIP que ya existen. No crea ventas, cuentas ni renovaciones.</label>' +
        '<div class="fz-acc"><button type="button" class="fz-btn" data-fz="importar"' + (!(r.nuevos + r.actualizados + r.lotesNuevos + r.lotesActualizados) ? ' disabled' : '') + '>Confirmar importación</button><button type="button" class="fz-btn sec" data-fz="errores"' + (!problemas.length ? ' disabled' : '') + '>' + ico('dl') + 'Descargar errores (Excel)</button><button type="button" class="fz-btn sec" data-fz="cancelarimp">Cancelar</button></div>';
    }
    var jobs = st.jobs || [];
    var ultimoAplicado = jobs.find(function (j) { return j.estado === 'aplicado'; });
    var hist = '<div class="fz-card"><div class="fz-cab">' + ico('doc') + '<h3>Importaciones</h3></div>' + (jobs.length ? '<div class="fz-tw"><table class="fz-t sm"><thead><tr><th>Fecha</th><th>Archivo</th><th>Usuario</th><th class="n">Vínculos</th><th class="n">Lotes</th><th>Estado</th><th></th></tr></thead><tbody>' + jobs.map(function (j) {
      return '<tr><td>' + esc(String(j.createdAt || '').slice(0, 16).replace('T', ' ')) + '</td><td>' + esc((j.archivo && j.archivo.nombre) || '') + '</td><td>' + esc(j.actor) + '</td><td class="n">' + ((j.resumen && j.resumen.aplicadosExtras) || 0) + '</td><td class="n">' + ((j.resumen && j.resumen.aplicadosLotes) || 0) + '</td><td>' + (j.estado === 'aplicado' ? pill({ a: ['Aplicada', 'ok'] }, 'a') : pill({ d: ['Deshecha', 'gris'] }, 'd')) + '</td><td>' + (ultimoAplicado && ultimoAplicado.id === j.id ? '<button type="button" class="fz-btn sec sm" data-fz="deshacer" data-id="' + esc(j.id) + '">Deshacer</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="fz-vacio-s">Aún no hay importaciones.</div>') + '</div>';
    return '<div class="fz-card"><div class="fz-cab">' + ico('upload') + '<h3>Importar Excel Netflix VIP</h3></div>' + zona + cuerpo + '</div>' + hist;
  }
  function leerHoja(ws, cols) {
    var filas = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    if (!filas.length) return [];
    var head = (filas[0] || []).map(function (h) { return String(h == null ? '' : h).trim(); });
    var idx = cols.map(function (c) { return head.indexOf(c); });
    var out = [];
    for (var i = 1; i < filas.length; i++) {
      var f = filas[i] || [], o = { _fila: i + 1 }, algo = false;
      cols.forEach(function (c, k) { var v = idx[k] >= 0 ? f[idx[k]] : null; if (typeof v === 'string') v = v.trim(); if (v === '') v = null; if (v != null) algo = true; o[c] = v; });
      if (algo) out.push(o);
    }
    return out;
  }
  var COLS_EXTRAS = ['ID_acceso_Control_Maestro', 'Correo_o_ID_extra', 'Cuenta_madre_Netflix', 'Proveedor', 'Costo_mensual_USDT', 'Fecha_proximo_cobro_proveedor', 'Fecha_ultimo_pago_proveedor', 'Estado', 'ID_lote_compra', 'Tasa_Binance_HNL_USDT', 'Renovar_proximo_mes', 'Notas'];
  var COLS_LOTES = ['ID_lote', 'Proveedor', 'Fecha_pago_proveedor', 'Cantidad_extras_pagados', 'Total_pagado_USDT', 'Tasa_Binance_HNL_por_USDT', 'Comisiones_adicionales_HNL', 'Comprobante_o_referencia', 'Observaciones'];
  async function hashArchivo(buf) { try { var h = await crypto.subtle.digest('SHA-256', buf); return Array.from(new Uint8Array(h)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('').slice(0, 40); } catch (_) { return ''; } }
  async function leerArchivo(file) {
    if (!/\.xlsx$/i.test(file.name)) { st.imp = { error: 'Use la plantilla .xlsx «Sublichat_Netflix_VIP_Importacion.xlsx».' }; pintar(); return; }
    if (file.size > 5 * 1024 * 1024) { st.imp = { error: 'El archivo pesa más de 5 MB: no parece la plantilla.' }; pintar(); return; }
    if (!window.XLSX) { st.imp = { error: 'No cargó el lector de Excel. Recargue la página.' }; pintar(); return; }
    st.imp = { cargando: true }; pintar();
    try {
      var buf = await file.arrayBuffer();
      var wb = window.XLSX.read(buf, { type: 'array', cellDates: false });
      var hojas = wb.SheetNames.slice();
      if (hojas.indexOf('EXTRAS_VIP') < 0 || hojas.indexOf('LOTES_COMPRAS') < 0) throw new Error('Faltan las hojas EXTRAS_VIP y LOTES_COMPRAS: no es la plantilla.');
      var payload = { hojas: hojas, extras: leerHoja(wb.Sheets.EXTRAS_VIP, COLS_EXTRAS), lotes: leerHoja(wb.Sheets.LOTES_COMPRAS, COLS_LOTES), archivo: { nombre: file.name, bytes: file.size, hash: await hashArchivo(buf) } };
      st.imp = { payload: payload, archivo: payload.archivo, res: {}, cargando: true }; pintar();
      await previa();
    } catch (e) { st.imp = { error: e.message }; pintar(); }
  }
  async function previa() {
    var imp = st.imp; imp.cargando = true; imp.error = '';
    try { var r = await api('finp_vip_preview', Object.assign({}, imp.payload, { resoluciones: imp.res })); imp.pv = { resumen: r.resumen, extras: r.extras, lotes: r.lotes }; imp.hash = r.hash; imp.confirmo = false; }
    catch (e) { imp.error = e.message; }
    imp.cargando = false; pintar();
  }
  async function confirmarImport() {
    var imp = st.imp; if (!imp || !imp.pv) return;
    if (!imp.confirmo) { toast('Marque «Confirmo la conciliación».', true); return; }
    try {
      var r = await api('finp_vip_confirmar', Object.assign({}, imp.payload, { resoluciones: imp.res, hash: imp.hash, confirmo: true }));
      toast('Importado: ' + r.extras + ' vínculo(s) VIP y ' + r.lotes + ' lote(s). 0 ventas creadas.');
      st.imp = null; st.jobs = null; st.vip.res = null; cargar(true);
    } catch (e) { toast(e.message, true); }
  }
  function descargarErrores() {
    var imp = st.imp; if (!imp || !imp.pv || !window.XLSX) return;
    var rows = [['Hoja', 'Fila', 'Correo / ID lote', 'Estado', 'Errores', 'Avisos']];
    imp.pv.extras.forEach(function (x) { if (x.errores.length || x.avisos.length) rows.push(['EXTRAS_VIP', x.fila, x.correo, x.estado, x.errores.join(' · '), x.avisos.join(' · ')]); });
    imp.pv.lotes.forEach(function (l) { if (l.errores.length || (l.avisos || []).length) rows.push(['LOTES_COMPRAS', l.fila, l.idLote, l.estado, l.errores.join(' · '), (l.avisos || []).join(' · ')]); });
    var wb = window.XLSX.utils.book_new(); var ws = window.XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 15 }, { wch: 6 }, { wch: 34 }, { wch: 16 }, { wch: 70 }, { wch: 50 }];
    window.XLSX.utils.book_append_sheet(wb, ws, 'ERRORES'); window.XLSX.writeFile(wb, 'Sublichat_Netflix_VIP_errores.xlsx');
  }

  // ---------------------------------------------------------------------------------------------------- Reportes (Excel real)
  function vReportes() {
    var m = st.mes || ''; if (!st.rep.desde) st.rep.desde = m; if (!st.rep.hasta) st.rep.hasta = m;
    var hojas = ['Resumen por mes', 'Rentabilidad por producto', 'Ganancia por categoría', 'Compras y lotes', 'Proveedores', 'Ventas pendientes de costo', 'Netflix VIP', 'Lotes VIP pagados', 'Importaciones'];
    return '<div class="fz-card"><div class="fz-cab">' + ico('doc') + '<h3>Reportes</h3></div><p class="fz-sub">Descarga un Excel real con varias hojas. Máximo 12 meses por archivo.</p>' +
      '<div class="fz-form in"><label>Desde<input type="month" data-fz-rep="desde" value="' + esc(st.rep.desde) + '"></label><label>Hasta<input type="month" data-fz-rep="hasta" value="' + esc(st.rep.hasta) + '"></label><button type="button" class="fz-btn" data-fz="excel">' + ico('dl') + 'Descargar Excel</button></div>' +
      '<div class="fz-hojas">' + hojas.map(function (h) { return '<span class="fz-chip">' + h + '</span>'; }).join('') + '</div></div>';
  }
  async function descargarExcel(btn) {
    if (!window.ExcelJS) { toast('No cargó el generador de Excel. Recargue la página.', true); return; }
    btn.disabled = true; var txtB = btn.innerHTML; btn.textContent = 'Generando…';
    try {
      var r = await api('finp_reporte', { desde: st.rep.desde, hasta: st.rep.hasta });
      var wb = new window.ExcelJS.Workbook(); wb.creator = 'Sublichat'; wb.created = new Date();
      var ROJO = 'FFE2231A';
      function hoja(nombre, cols, filas, fmt) {
        var ws = wb.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] });
        ws.columns = cols.map(function (c) { return { header: c[0], key: c[1], width: c[2] || 16 }; });
        filas.forEach(function (f) { ws.addRow(f); });
        var h = ws.getRow(1); h.font = { bold: true, color: { argb: 'FFFFFFFF' } }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROJO } }; h.alignment = { vertical: 'middle' }; h.height = 20;
        (fmt || []).forEach(function (k) { ws.getColumn(k[0]).numFmt = k[1]; });
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
        return ws;
      }
      var LMP = '"L"#,##0.00', PCT = '0.0"%"';
      hoja('Resumen', [['Mes', 'mes', 14], ['Ingresos', 'ing', 14], ['Ingresos con costo', 'ingc', 18], ['Costos', 'cos', 14], ['Ganancia', 'gan', 14], ['Margen %', 'mg', 11], ['Ingresos pendientes de costo', 'pend', 26], ['Ventas', 'v', 9], ['Ventas sin costo', 'vs', 15]],
        r.porMes.map(function (m) { var k = m.kpis; return { mes: m.mes, ing: k.ingresosHnl, ingc: k.ingresoCosteadoHnl, cos: k.costosHnl, gan: k.gananciaHnl, mg: k.margen, pend: k.ingresoSinCostoHnl, v: k.ventas, vs: k.ventasSinCosto }; }),
        [['ing', LMP], ['ingc', LMP], ['cos', LMP], ['gan', LMP], ['mg', PCT], ['pend', LMP]]);
      var est = { rentable: 'Rentable', margen_bajo: 'Margen bajo', pendiente_costo: 'Pendiente de costo', parcial: 'Costo parcial' };
      hoja('Rentabilidad', [['Mes', 'mes', 10], ['Producto', 'p', 28], ['Categoría', 'c', 18], ['Ventas', 'v', 8], ['Ingresos', 'i', 13], ['Costos', 'co', 13], ['Ganancia', 'g', 13], ['Margen %', 'm', 10], ['Pendiente de costo', 'pc', 18], ['Estado', 'e', 18]],
        r.porMes.flatMap(function (m) { return m.productos.map(function (p) { return { mes: m.mes, p: p.producto, c: (st.data.categoriasLabel || {})[p.categoria] || p.categoria, v: p.ventas, i: p.ingresoHnl, co: p.ingresoCosteadoHnl > 0 ? p.costoHnl : 'Pendiente de costo', g: p.gananciaHnl == null ? 'Pendiente de costo' : p.gananciaHnl, m: p.margen, pc: p.ingresoPendienteHnl, e: est[p.estado] || p.estado }; }); }),
        [['i', LMP], ['co', LMP], ['g', LMP], ['m', PCT], ['pc', LMP]]);
      hoja('Categorías', [['Mes', 'mes', 10], ['Categoría', 'c', 22], ['Ingresos', 'i', 13], ['Costos', 'co', 13], ['Ganancia', 'g', 13], ['Pendiente de costo', 'p', 18]],
        r.porMes.flatMap(function (m) { return m.categorias.map(function (c) { return { mes: m.mes, c: c.label, i: c.ingresoHnl, co: c.costoHnl, g: c.gananciaHnl, p: c.pendienteHnl }; }); }), [['i', LMP], ['co', LMP], ['g', LMP], ['p', LMP]]);
      hoja('Compras', [['Fecha', 'f', 11], ['Producto', 'p', 24], ['Proveedor', 'pr', 18], ['Cantidad', 'c', 9], ['Unidad', 'u', 11], ['Moneda', 'mo', 8], ['Monto moneda', 'mm', 13], ['Tasa (guardada)', 't', 13], ['Costo HNL', 'h', 13], ['Pago', 'pa', 18], ['Referencia', 'r', 18], ['Consumido', 'co', 10], ['Disponible', 'd', 10]],
        r.compras.map(function (c) { return { f: c.fecha, p: c.producto, pr: c.proveedor, c: c.cantidad, u: c.unidad, mo: c.moneda, mm: c.montoMoneda, t: c.tasa || '', h: c.costoHnl, pa: c.pago, r: c.referencia, co: c.consumido, d: c.disponible }; }), [['h', LMP]]);
      hoja('Proveedores', [['Proveedor', 'pr', 20], ['Producto', 'p', 24], ['Compras', 'c', 9], ['Unidades', 'u', 10], ['Total HNL', 't', 13], ['Promedio por unidad', 'pm', 18], ['Último costo unitario', 'ul', 18], ['Más económico', 'me', 14]],
        r.proveedores.map(function (p) { return { pr: p.proveedor, p: p.producto, c: p.compras, u: p.unidades, t: p.costoHnl, pm: p.promedioHnl, ul: p.ultimo, me: p.masEconomico ? 'Sí' : '' }; }), [['t', LMP], ['pm', LMP], ['ul', LMP]]);
      hoja('Pendiente de costo', [['Fecha', 'f', 11], ['Cliente', 'c', 24], ['Servicio', 's', 26], ['Producto', 'p', 22], ['Ingreso HNL', 'i', 13], ['Motivo', 'm', 26]],
        r.sinCosto.map(function (x) { return { f: x.fecha, c: x.cliente, s: x.servicio, p: x.producto, i: x.ingresoHnl, m: x.motivo }; }), [['i', LMP]]);
      hoja('Netflix VIP', [['ID Control Maestro', 'id', 24], ['Correo / ID extra', 'co', 30], ['Cliente', 'cl', 22], ['Proveedor', 'p', 16], ['Costo USDT', 'u', 11], ['Costo HNL', 'h', 12], ['Próximo cobro proveedor', 'f', 20], ['Estado', 'e', 12], ['Lote', 'l', 16]],
        r.vipExtras.map(function (x) { return { id: x.cmId, co: x.correo, cl: x.cliente, p: x.proveedor, u: x.costoMensualUsdt, h: x.costoMensualHnl, f: x.proximoPagoProveedor, e: x.estado, l: x.loteId }; }), [['h', LMP]]);
      hoja('Lotes VIP', [['ID lote', 'id', 18], ['Proveedor', 'p', 16], ['Fecha de pago', 'f', 13], ['Extras pagados', 'c', 13], ['Total USDT', 'u', 11], ['Tasa', 't', 9], ['Comisiones HNL', 'co', 14], ['Costo total HNL', 'h', 15], ['Costo por extra HNL', 'pe', 17], ['Comprobante', 'r', 18]],
        r.vipLotes.map(function (l) { return { id: l.idLote || l.id, p: l.proveedor, f: l.fechaPago, c: l.cantidad, u: l.totalUsdt, t: l.tasa, co: l.comisionesHnl, h: l.costoTotalHnl, pe: l.costoPorExtraHnl, r: l.comprobante }; }), [['co', LMP], ['h', LMP], ['pe', LMP]]);
      hoja('Importaciones', [['Fecha', 'f', 18], ['Archivo', 'a', 34], ['Usuario', 'u', 14], ['Estado', 'e', 11], ['Vínculos', 'v', 10], ['Lotes', 'l', 8], ['Hash', 'h', 34]],
        r.importaciones.map(function (j) { return { f: String(j.fecha || '').slice(0, 16).replace('T', ' '), a: j.archivo, u: j.actor, e: j.estado, v: j.vinculos, l: j.lotes, h: j.hash }; }));
      var buf = await wb.xlsx.writeBuffer();
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = 'Sublichat_Finanzas_' + r.desde + (r.hasta !== r.desde ? '_a_' + r.hasta : '') + '.xlsx'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      toast('Excel descargado.');
    } catch (e) { toast(e.message, true); }
    btn.disabled = false; btn.innerHTML = txtB;
  }

  // ---------------------------------------------------------------------------------------------------- modales (compra, proveedor, productos, VIP)
  function modal(titulo, html, onOk, okTxt) {
    var m = document.createElement('div'); m.className = 'fz-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', titulo);
    m.innerHTML = '<div class="fz-modal-c"><div class="fz-modal-h"><h3>' + esc(titulo) + '</h3><button type="button" class="fz-ib" data-x aria-label="Cerrar">' + ico('x') + '</button></div><div class="fz-modal-b">' + html + '</div><div class="fz-err" data-merr hidden></div>' +
      (onOk ? '<div class="fz-acc"><button type="button" class="fz-btn" data-ok>' + esc(okTxt || 'Guardar') + '</button><button type="button" class="fz-btn sec" data-x>Cancelar</button></div>' : '') + '</div>';
    document.body.appendChild(m);
    function cerrar() { m.remove(); }
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-x]')) cerrar(); });
    var ok = m.querySelector('[data-ok]');
    if (ok) ok.addEventListener('click', async function () {
      var er = m.querySelector('[data-merr]'); er.hidden = true; ok.disabled = true;
      try { await onOk(m); cerrar(); } catch (e) { er.textContent = e.message; er.hidden = false; ok.disabled = false; }
    });
    return m;
  }
  function val(m, k) { var el = m.querySelector('[name="' + k + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; }
  function abrirCompra(prodId) {
    var d = st.data; var hoy = d.hoy;
    var prods = (d.productosCatalogo || []).filter(function (p) { return p.activo; });
    var html = '<div class="fz-form">' +
      '<label class="w2">Producto<select name="productoId"><option value="">— elegir —</option>' + prods.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === prodId ? ' selected' : '') + '>' + esc(p.nombre) + ' · ' + esc((d.modelos[p.modelo] || {}).label || p.modelo) + '</option>'; }).join('') + '</select></label>' +
      '<label>Proveedor<select name="proveedorId"><option value="">— sin proveedor —</option>' + (d.proveedores || []).filter(function (p) { return p.activo; }).map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.alias) + '</option>'; }).join('') + '</select></label>' +
      '<label>Fecha<input type="date" name="fecha" value="' + esc(hoy) + '" max="' + esc(hoy) + '"></label>' +
      '<label>Cantidad<input type="number" name="cantidad" min="0" step="any" placeholder="Ej. 1 familia, 25 extras"></label>' +
      '<label>Costo total<input type="number" name="costoTotal" min="0" step="any"></label>' +
      '<label>Moneda<select name="moneda">' + (d.monedas || ['HNL']).map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') + '</select></label>' +
      '<label>Pagado con<select name="pago"><option value="banco">Banco (Lempiras)</option><option value="binance">Binance (USDT)</option><option value="credito">A crédito (por pagar)</option><option value="inicial">Inventario inicial (ya lo tenía)</option></select></label>' +
      '<label>Banco<select name="bancoId"><option value="">—</option>' + (d.metodos || []).map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.nombre) + '</option>'; }).join('') + '</select></label>' +
      '<label>Cargo real en HNL<input type="number" name="cargoHnl" min="0" step="any" placeholder="USD, EUR, PHP: obligatorio"></label>' +
      '<label class="w2">Referencia<input name="referencia" maxlength="120" placeholder="Comprobante o nota"></label></div>' +
      '<p class="fz-sub">La tasa queda guardada en el lote y no cambia después. Spotify Familiar: registre 1 (una familia) por mes; las 5 invitaciones salen de ese único pago.</p>';
    var opid = opId();
    modal('Registrar compra', html, async function (m) {
      var r = await api('fin_compra_registrar', { operationId: opid, compra: { productoId: val(m, 'productoId'), proveedorId: val(m, 'proveedorId'), fecha: val(m, 'fecha'), cantidad: Number(val(m, 'cantidad')), costoTotal: Number(val(m, 'costoTotal')), moneda: val(m, 'moneda'), pago: val(m, 'pago'), bancoId: val(m, 'bancoId'), cargoHnl: Number(val(m, 'cargoHnl')) || 0, referencia: val(m, 'referencia') } });
      toast(r.duplicado ? 'Esa compra ya estaba registrada (no se duplicó).' : 'Compra registrada.'); cargar(true);
    }, 'Registrar compra');
  }
  function abrirProveedor(id) {
    var p = (st.data.proveedores || []).find(function (x) { return x.id === id; }) || { alias: '', pais: '', moneda: 'USDT', metodoPago: '', activo: true, notas: '' };
    var html = '<div class="fz-form"><label>Nombre<input name="alias" maxlength="60" value="' + esc(p.alias) + '"></label><label>País<input name="pais" maxlength="40" value="' + esc(p.pais) + '"></label>' +
      '<label>Moneda<select name="moneda">' + (st.data.monedas || []).map(function (m) { return '<option' + (m === p.moneda ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '</select></label><label>Método de pago<input name="metodoPago" maxlength="40" value="' + esc(p.metodoPago) + '"></label>' +
      '<label class="w2">Notas<input name="notas" maxlength="300" value="' + esc(p.notas) + '"></label><label class="fz-check w2"><input type="checkbox" name="activo"' + (p.activo ? ' checked' : '') + '> Activo</label></div>';
    modal(id ? 'Editar proveedor' : 'Nuevo proveedor', html, async function (m) {
      await api('fin_proveedor_guardar', { proveedor: { id: id || undefined, alias: val(m, 'alias'), pais: val(m, 'pais'), moneda: val(m, 'moneda'), metodoPago: val(m, 'metodoPago'), notas: val(m, 'notas'), activo: val(m, 'activo') } });
      toast('Proveedor guardado.'); cargar(true);
    });
  }
  function abrirProductos() {
    var d = st.data, cats = d.categoriasLabel || {};
    var html = '<div class="fz-tw"><table class="fz-t sm"><thead><tr><th>Producto</th><th>Categoría</th><th>Modelo</th><th class="n">Capacidad</th><th>Costo de referencia</th><th></th></tr></thead><tbody>' +
      (d.productosCatalogo || []).map(function (p) { return '<tr><td><div class="fz-prod">' + logo(p.nombre) + '<b>' + esc(p.nombre) + '</b></div></td><td>' + esc(cats[p.categoria] || p.categoria) + '</td><td>' + esc((d.modelos[p.modelo] || {}).label || p.modelo) + '</td><td class="n">' + esc(p.capacidad) + '</td><td>' + (p.costoRef && p.costoRef.monto ? esc(p.costoRef.monto + ' ' + p.costoRef.moneda) : '<span class="fz-pend">Pendiente de costo</span>') + '</td><td><button type="button" class="fz-btn sec sm" data-fz="compra" data-prod="' + esc(p.id) + '">Comprar</button></td></tr>'; }).join('') +
      '</tbody></table></div><h4 class="fz-h4">Producto nuevo (sin programar)</h4><div class="fz-form"><label>Nombre<input name="nombre" maxlength="80" placeholder="Ej. Free Fire 100 diamantes"></label>' +
      '<label>Categoría<select name="categoria">' + Object.keys(cats).filter(function (k) { return k !== 'sin_clasificar'; }).map(function (k) { return '<option value="' + esc(k) + '">' + esc(cats[k]) + '</option>'; }).join('') + '</select></label>' +
      '<label>Modelo<select name="modelo">' + Object.keys(d.modelos || {}).map(function (k) { return '<option value="' + esc(k) + '">' + esc(d.modelos[k].label || k) + '</option>'; }).join('') + '</select></label>' +
      '<label>Capacidad<input type="number" name="capacidad" min="1" value="1"></label><label>Duración (días)<input type="number" name="duracionDias" min="0" value="30"></label><label>Plataforma (clave)<input name="plataformaKey" maxlength="30" placeholder="ej. freefire"></label></div>' +
      '<p class="fz-sub">Sin costo de referencia queda «Pendiente de costo» hasta registrar la primera compra.</p>';
    var m = modal('Productos', html, async function (mm) {
      if (!val(mm, 'nombre')) throw new Error('Escriba el nombre del producto nuevo (o cierre).');
      await api('fin_producto_guardar', { producto: { nombre: val(mm, 'nombre'), categoria: val(mm, 'categoria'), modelo: val(mm, 'modelo'), capacidad: Number(val(mm, 'capacidad')) || 1, duracionDias: Number(val(mm, 'duracionDias')) || 0, plataformaKey: val(mm, 'plataformaKey') } });
      toast('Producto creado.'); cargar(true);
    }, 'Crear producto');
    m.classList.add('ancho');
    m.addEventListener('click', function (e) { var b = e.target.closest('[data-fz="compra"]'); if (b) { m.remove(); abrirCompra(b.dataset.prod); } });
  }
  function abrirVip(acc, id) {
    var f = filaVip(id); if (!f) return;
    if (acc === 'historial') {
      modal('Historial · ' + f.correo, (f.historial || []).length ? '<ul class="fz-hist">' + f.historial.slice().reverse().map(function (h) { return '<li><b>' + esc(String(h.at || '').slice(0, 16).replace('T', ' ')) + '</b> · ' + esc(h.por || '') + ' · ' + esc(h.origen || '') + (h.cambios ? ' · ' + esc(h.cambios.join(', ')) : '') + (h.despues ? ' · ' + esc(JSON.stringify(h.despues)) : '') + (h.de ? ' · ' + esc(h.de + ' → ' + h.a) : '') + '</li>'; }).join('') + '</ul>' : '<div class="fz-vacio-s">Sin historial en Finanzas.</div>');
      return;
    }
    if (acc === 'baja') {
      modal('Dar de baja · ' + f.correo, '<p>Marca el extra como <b>Baja</b> en Finanzas (deja de contarse como costo mensual). No toca la cuenta ni al cliente en Control Maestro.</p>', async function () { await api('finp_vip_editar', { cmId: id, cambios: { estadoSeguimiento: 'baja' } }); toast('Extra dado de baja en Finanzas.'); st.vip.res = null; pintar(); }, 'Dar de baja');
      return;
    }
    if (acc === 'reemplazar') {
      modal('Reemplazar · ' + f.correo, '<div class="fz-form"><label class="w2">ID del acceso VIP de reemplazo (ya existente en Control Maestro)<input name="a" maxlength="80"></label><label class="fz-check w2"><input type="checkbox" name="pagado"> El reemplazo se pagó (registrar luego la compra en Compras)</label></div><p class="fz-sub">El cliente y su vencimiento no cambian.</p>',
        async function (m) { var r = await api('finp_vip_reemplazar', { de: id, a: val(m, 'a'), pagado: val(m, 'pagado') }); toast(r.aviso || 'Reemplazo registrado.'); st.vip.res = null; pintar(); }, 'Reemplazar');
      return;
    }
    var provs = [['Trap colombiano', 'trap'], ['Deku peruano', 'deku'], ['VIP propio', 'propio']];
    var html = '<div class="fz-form"><label>Proveedor<select name="proveedor"><option value="">—</option>' + provs.map(function (p) { return '<option' + (f.grupo === p[1] ? ' selected' : '') + '>' + p[0] + '</option>'; }).join('') + '</select></label>' +
      '<label>Costo mensual USDT<input type="number" step="any" name="costo" value="' + esc(f.costoMensualUsdt == null ? '' : f.costoMensualUsdt) + '"></label><label>Tasa HNL por USDT<input type="number" step="any" name="tasa" value="' + esc(f.tasa == null ? '' : f.tasa) + '"></label>' +
      '<label>Próximo cobro del proveedor<input type="date" name="prox" value="' + esc(f.proximoPagoProveedor || '') + '"></label><label>Estado<select name="estado">' + ['Activo', 'Pendiente', 'Baja'].map(function (x) { return '<option' + (String(f.estado).toLowerCase() === x.toLowerCase() ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
      '<label class="w2">Notas<input name="notas" maxlength="300" value="' + esc(f.notas || '') + '"></label></div>';
    modal('Editar · ' + f.correo, html, async function (m) {
      var c = {}; if (val(m, 'proveedor')) c.proveedor = val(m, 'proveedor'); if (val(m, 'costo')) c.costoMensualUsdt = val(m, 'costo'); if (val(m, 'tasa')) c.tasa = val(m, 'tasa'); if (val(m, 'prox')) c.proximoPagoProveedor = val(m, 'prox'); c.estadoSeguimiento = val(m, 'estado'); c.notas = val(m, 'notas');
      await api('finp_vip_editar', { cmId: id, cambios: c }); toast('Extra actualizado.'); st.vip.res = null; pintar();
    });
  }

  // ---------------------------------------------------------------------------------------------------- eventos
  function enlazar(h) {
    if (h.dataset.fzOn) return; h.dataset.fzOn = '1';
    h.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-fz-tab]'))) { st.tab = t.dataset.fzTab; if (t.dataset.sub) st.sub = t.dataset.sub; pintar(); return; }
      if ((t = e.target.closest('[data-fz-sub]'))) { st.sub = t.dataset.fzSub; pintar(); return; }
      if ((t = e.target.closest('[data-fz-viptab]'))) { st.vip.tab = t.dataset.fzViptab; st.vip.pagina = 1; st.vip.res = null; pintar(); return; }
      if ((t = e.target.closest('[data-fz-pag]'))) { st.vip.pagina += Number(t.dataset.fzPag); st.vip.res = null; pintar(); return; }
      if ((t = e.target.closest('[data-fz-menu]'))) { var mm = t.parentNode; var abierto = mm.classList.contains('on'); h.querySelectorAll('.fz-menu.on').forEach(function (x) { x.classList.remove('on'); }); if (!abierto) mm.classList.add('on'); e.stopPropagation(); return; }
      if ((t = e.target.closest('[data-fz-spf]'))) { abrirSpf(t.dataset.fzSpf, t.dataset.id); return; }
      if ((t = e.target.closest('[data-fz-vip]'))) { h.querySelectorAll('.fz-menu.on').forEach(function (x) { x.classList.remove('on'); }); abrirVip(t.dataset.fzVip, t.dataset.id); return; }
      h.querySelectorAll('.fz-menu.on').forEach(function (x) { x.classList.remove('on'); });
      if (!(t = e.target.closest('[data-fz]'))) return;
      var a = t.dataset.fz;
      if (a === 'reintentar') cargar(true);
      else if (a === 'productos') abrirProductos();
      else if (a === 'compra') abrirCompra(t.dataset.prod || '');
      else if (a === 'prov') abrirProveedor(t.dataset.id || '');
      else if (a === 'umbral') modal('Objetivo de margen', '<div class="fz-form"><label class="w2">Alertar cuando el margen de un producto sea menor a (%)<input type="number" name="u" min="0" max="95" step="0.5" value="' + esc(st.data.config.umbralMargen) + '"></label></div>', async function (m) { await api('finp_config', { umbralMargen: Number(val(m, 'u')) }); toast('Objetivo guardado.'); cargar(true); });
      else if (a === 'importar') confirmarImport();
      else if (a === 'errores') descargarErrores();
      else if (a === 'cancelarimp') { st.imp = null; pintar(); }
      else if (a === 'reprevia') previa();
      else if (a === 'deshacer') modal('Deshacer importación', '<p>Restaura los vínculos y lotes VIP a como estaban antes de esa importación. Solo se puede deshacer la última.</p>', async function () { var r = await api('finp_vip_deshacer', { jobId: t.dataset.id }); toast('Deshecha: ' + r.extras + ' vínculo(s), ' + r.lotes + ' lote(s).'); st.jobs = null; st.vip.res = null; cargar(true); }, 'Deshacer');
      else if (a === 'excel') descargarExcel(t);
    });
    h.addEventListener('change', function (e) {
      var t = e.target;
      if (t.matches('[data-fz-mes]')) { if (/^\d{4}-\d{2}$/.test(t.value)) { st.mes = t.value; st.rep.desde = st.rep.hasta = ''; cargar(true); } }
      else if (t.matches('[data-fz-file]') && t.files[0]) leerArchivo(t.files[0]);
      else if (t.matches('[data-fz-res]')) { st.imp.res[t.dataset.fzRes] = t.value; }
      else if (t.matches('[data-fz-confirmo]')) { st.imp.confirmo = t.checked; }
      else if (t.matches('[data-fz-rep]')) { st.rep[t.dataset.fzRep] = t.value; }
    });
    var tq; h.addEventListener('input', function (e) { if (e.target.matches('[data-fz-vipq]')) { clearTimeout(tq); var v = e.target.value; tq = setTimeout(function () { st.vip.q = v; st.vip.pagina = 1; st.vip.res = null; cargarVip().then(function () { var i = h.querySelector('[data-fz-vipq]'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }); }, 350); } });
    h.addEventListener('dragover', function (e) { var z = e.target.closest('[data-fz-drop]'); if (z) { e.preventDefault(); z.classList.add('on'); } });
    h.addEventListener('dragleave', function (e) { var z = e.target.closest('[data-fz-drop]'); if (z) z.classList.remove('on'); });
    h.addEventListener('drop', function (e) { var z = e.target.closest('[data-fz-drop]'); if (z) { e.preventDefault(); z.classList.remove('on'); var f = e.dataTransfer.files[0]; if (f) leerArchivo(f); } });
  }

  function open() {
    var h = host(); if (!h) return;
    enlazar(h);
    if (!st.data) cargar(); else { pintar(); cargar(); }
  }
  window.SublichatFinanzas = { open: open, recargar: function () { return cargar(true); }, _st: st };
  window.addEventListener('sublichat:screen', function (e) { if (e.detail && e.detail.screen === 'finanzas') open(); });
})();
