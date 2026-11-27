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
    // R201 · «Failed to fetch» = la conexión se cortó antes de llegar al servidor. Se reintenta solo (2 veces) y, si sigue,
    // se muestra un mensaje claro con «Reintentar» en vez del texto técnico del navegador.
    var cuerpo = JSON.stringify(Object.assign({ accion: accion, origen: 'web' }, body || {})), r = null, ultimoErr = null;
    for (var intento = 0; intento < 3 && !r; intento++) {
      try { r = await fetch('/api/finanzas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo }); }
      catch (e) { ultimoErr = e; if (intento < 2) await new Promise(function (ok) { setTimeout(ok, 1200 * (intento + 1)); }); }
    }
    if (!r) throw new Error(navigator.onLine === false ? 'Sin internet en este equipo. Revise la conexión y toque Reintentar.' : 'No se pudo conectar con el servidor de Finanzas (' + (ultimoErr && ultimoErr.message || 'conexión cortada') + '). Toque Reintentar.');
    var j = null; try { j = await r.json(); } catch (_) {}
    // R196i · error con causa visible (antes salía solo «No se pudo completar.»)
    if (r.status === 403) throw new Error((j && j.error) || 'Sin autorización para Finanzas. Sublicuentas lo activa en Permisos.');
    if (!j) throw new Error(r.status === 504 || r.status === 502 ? 'El servidor tardó demasiado (HTTP ' + r.status + '). Toque Reintentar.' : 'El servidor no respondió bien (HTTP ' + r.status + ').');
    if (!r.ok || j.ok === false) throw new Error((j.error || 'No se pudo completar') + ' (HTTP ' + r.status + ', ' + accion + ')');
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
    (st.charts || []).forEach(function (c) { try { c.destroy(); } catch (_) {} }); st.charts = []; // R200b
    var d = st.data;
    var mesSel = '<label class="fz-mes"><span>Mes</span><input type="month" data-fz-mes value="' + esc(st.mes || '') + '"></label>';
    var cab = '<div class="fz-head"><div><h1>Finanzas</h1><p>Ganancias, margen y rendimiento por producto</p></div><div class="fz-head-acc">' + mesSel +
      '<button type="button" class="fz-btn sec" data-fz="costear" title="Asigna el costo de las ventas nuevas con las compras registradas">' + ico('layers') + 'Actualizar costos</button>' +
      '<button type="button" class="fz-btn sec" data-fz="productos">' + ico('box') + 'Productos</button></div></div>' +
      '<nav class="fz-tabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" role="tab" class="fz-tab' + (st.tab === t[0] ? ' on' : '') + '" data-fz-tab="' + t[0] + '" aria-selected="' + (st.tab === t[0]) + '">' + ico(t[2]) + t[1] + '</button>'; }).join('') + '</nav>';
    var cuerpo;
    if (st.error && !d) cuerpo = '<div class="fz-card fz-vacio"><b>No se pudo abrir Finanzas</b><span>' + esc(st.error) + '</span><button type="button" class="fz-btn" data-fz="reintentar">Reintentar</button></div>';
    else if (!d) cuerpo = '<div class="fz-card fz-vacio"><span class="fz-spin"></span><b>Cargando Finanzas…</b></div>';
    else cuerpo = ({ resumen: vResumen, proveedores: vProveedores, compras: vCompras, ganancias: vGanancias, reportes: vReportes }[st.tab] || vGanancias)(d);
    var fallas = d && d.fallas && d.fallas.length ? '<div class="fz-err">Algunas partes no cargaron: ' + d.fallas.map(function (f) { return esc(f.seccion.replace(/_/g, ' ')); }).join(', ') + '. El resto está al día. <button type="button" class="fz-link" data-fz="reintentar">Reintentar</button></div>' : '';
    h.innerHTML = '<div class="fz">' + cab + (st.cargando && d ? '<div class="fz-cargando">Actualizando…</div>' : '') + fallas + cuerpo + '</div>';
    if (d && (st.tab === 'ganancias' || st.tab === 'resumen')) dibujarChart(d);
    if (d && st.tab === 'resumen') { var gg = st.gan[ganClave()]; if (gg && gg.graficos) dibujarGraficos(gg); } // R200b
    if (d && st.tab === 'compras' && st.sub === 'vip' && !st.vip.res) cargarVip();
    if (d && st.tab === 'compras' && st.sub === 'importar' && !st.jobs) cargarJobs();
    if (d && st.tab === 'compras' && st.sub === 'spotify' && !st.spf) cargarSpf();
    if (d && st.tab === 'compras' && st.sub === 'hbo' && !st.hbo) cargarHbo();
    if (d && st.tab === 'compras' && CUENTAS_SUB[st.sub] && !(st.cta[st.sub])) cargarCuentas(st.sub);
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

  // ---------------------------------------------------------------------------------------------- R200h · DASHBOARD INTERACTIVO
  // Filtros arriba (período, plataforma, vendedor, banco): tarjetas y gráficos cambian al instante, sin recargar.
  // Mismas cifras que Ganancias (finp_ganancias). Reglas: con filtro de PLATAFORMA el costo y la ganancia salen de esa
  // plataforma (mismo motor). Con filtro de VENDEDOR o BANCO se muestran solo ingresos: el costo es por cuenta/plataforma
  // y repartirlo por vendedor sería una cifra inventada. Pantalla completa / TV con actualización cada 5 minutos.
  st.dash = st.dash || { periodo: 'mes', plat: '', vend: '', banco: '', tv: false };
  var DIAS_SEM = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  function dashRango(per) {
    var hoy = (st.data && st.data.hoy) || new Date().toISOString().slice(0, 10), y = +hoy.slice(0, 4), m = +hoy.slice(5, 7);
    var ini = function (yy, mm) { var d = new Date(Date.UTC(yy, mm - 1, 1)); return d.toISOString().slice(0, 10); };
    var fin = function (yy, mm) { return new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10); };
    if (per === 'anterior') return { desde: ini(y, m - 1), hasta: fin(y, m - 1) };
    if (per === '3m') return { desde: ini(y, m - 2), hasta: hoy };
    if (per === '6m') return { desde: ini(y, m - 5), hasta: hoy };
    if (per === 'anio') return { desde: y + '-01-01', hasta: hoy };
    return null; // 'mes' = el mes elegido arriba; 'rango' = desde/hasta escritos
  }
  function dashDatos(g) {
    var F = st.dash, gr = g.graficos || {}, todas = gr.transacciones || [];
    var tx = todas.filter(function (t) { return (!F.plat || t.plataforma === F.plat) && (!F.vend || t.vendedor === F.vend) && (!F.banco || String(t.banco || '').split(' + ').indexOf(F.banco) >= 0); });
    var hay = !!(F.plat || F.vend || F.banco), soloIngresos = !!(F.vend || F.banco);
    var sum = function (arr, k) { return Math.round(arr.reduce(function (a, t) { return a + (Number(t[k]) || 0); }, 0) * 100) / 100; };
    var pRow = F.plat ? (g.porPlataforma || []).find(function (p) { return p.plataforma === F.plat; }) || null : null;
    var clientes = {}; tx.forEach(function (t) { if (t.beneficiario) clientes[t.beneficiario] = 1; });
    var cub = sum(tx.filter(function (t) { return t.costoCubierto; }), 'cobrado');
    var D = { tx: tx, hay: hay, soloIngresos: soloIngresos, pRow: pRow, incompleto: (gr.transaccionesTotal || 0) > todas.length,
      cobrado: sum(tx, 'cobrado'), pendiente: sum(tx, 'pendiente'), cubierto: cub, altas: tx.filter(function (t) { return t.tipo === 'venta'; }).length, renov: tx.filter(function (t) { return t.tipo === 'renovacion'; }).length, clientes: Object.keys(clientes).length };
    if (!soloIngresos && pRow) { D.cobrado = pRow.cobradoHnl; D.cubierto = pRow.cobradoCubiertoHnl; D.pendiente = pRow.pendienteHnl || 0; D.altas = pRow.altas; D.renov = pRow.renovaciones; D.clientes = pRow.clientes; D.incompleto = false; } // solo plataforma: cifras exactas del motor
    return D;
  }
  function dashOpciones(g) {
    var todas = (g.graficos || {}).transacciones || [], v = {}, b = {};
    todas.forEach(function (t) { if (t.vendedor) v[t.vendedor] = 1; String(t.banco || '').split(' + ').forEach(function (x) { if (x) b[x] = 1; }); });
    var plats = (g.porPlataforma || []).filter(function (p) { return p.cobradoHnl > 0 || p.costoHnl > 0; }).map(function (p) { return [p.plataforma, p.nombre]; });
    return { plats: plats, vends: Object.keys(v).sort(), bancos: Object.keys(b).sort() };
  }
  function dashFiltrosHtml(g) {
    var F = st.dash, o = dashOpciones(g), r = ganRango();
    var sel = function (k, vacio, lista) { return '<select data-fz-dash="' + k + '" aria-label="' + vacio + '"><option value="">' + vacio + '</option>' + lista.map(function (x) { var v = Array.isArray(x) ? x[0] : x, t = Array.isArray(x) ? x[1] : x; return '<option value="' + esc(v) + '"' + (F[k] === v ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>'; };
    var per = '<select data-fz-dash="periodo" aria-label="Período">' + [['mes', 'Mes elegido (' + nombreMes(st.mes) + ')'], ['anterior', 'Mes anterior'], ['3m', 'Últimos 3 meses'], ['6m', 'Últimos 6 meses'], ['anio', 'Este año'], ['rango', 'Personalizado']].map(function (x) { return '<option value="' + x[0] + '"' + (F.periodo === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>';
    var rango = F.periodo === 'rango' ? '<label>Desde<input type="date" data-fz-dash="desde" value="' + esc(r.desde) + '"></label><label>Hasta<input type="date" data-fz-dash="hasta" value="' + esc(r.hasta) + '"></label>' : '';
    var chips = [['plat', 'Plataforma', (o.plats.find(function (p) { return p[0] === F.plat; }) || [])[1]], ['vend', 'Vendedor', F.vend], ['banco', 'Banco', F.banco]].filter(function (c) { return st.dash[c[0]]; })
      .map(function (c) { return '<button type="button" class="fz-chip-f" data-fz-dashq="' + c[0] + '">' + c[1] + ': <b>' + esc(c[2] || st.dash[c[0]]) + '</b> ✕</button>'; }).join('');
    return '<div class="fz-card fz-dash-f"><div class="fz-dash-fr">' + per + rango + sel('plat', 'Todas las plataformas', o.plats) + sel('vend', 'Todos los vendedores', o.vends) + sel('banco', 'Todos los bancos', o.bancos) +
      '<div class="fz-dash-acc">' + (chips ? '<button type="button" class="fz-btn sec sm" data-fz-dashq="todo">Limpiar filtros</button>' : '') + '<button type="button" class="fz-btn sec sm" data-fz-tv>' + ico('cols') + (st.dash.tv ? 'Salir de pantalla completa' : 'Pantalla completa / TV') + '</button></div></div>' +
      (chips ? '<div class="fz-dash-chips">' + chips + '</div>' : '') + '<p class="fz-sub">Período: <b>' + fecha(r.desde) + ' al ' + fecha(r.hasta) + '</b> · toque una barra (plataforma, vendedor o banco) para filtrar todo el tablero.' + (st.dash.tv ? ' Se actualiza solo cada 5 minutos.' : '') + '</p></div>';
  }
  function dashKpis(g, D) {
    if (!D.hay) return ganKpis(g);
    var card = function (ic, cls, t, val, extra) { return '<div class="fz-card fz-kpi"><span class="fz-kpi-i ' + cls + '">' + ico(ic) + '</span><div><small>' + t + '</small><strong>' + val + '</strong>' + (extra || '') + '</div></div>'; };
    var p = D.pRow, res, costo, mg;
    if (D.soloIngresos || !p) { costo = '<span class="fz-pend">No aplica</span>'; res = '<span class="fz-pend">No aplica</span>'; mg = '<span class="fz-pend">—</span>'; }
    else { costo = L(p.costoHnl); res = p.resultadoHnl == null ? '<span class="fz-pend">Pendiente · costo incompleto</span>' : L(p.resultadoHnl); mg = p.margen == null ? '—' : P(p.margen); }
    if (!D.soloIngresos && p) { D = Object.assign({}, D, { cobrado: p.cobradoHnl, cubierto: p.cobradoCubiertoHnl, pendiente: p.pendienteHnl || 0, altas: p.altas, renov: p.renovaciones, clientes: p.clientes, incompleto: false }); } // solo plataforma: cifras exactas del motor
    var nota = D.soloIngresos ? '<em class="fz-nota">Con filtro de vendedor o banco se muestran solo ingresos: el costo es por cuenta y plataforma (no se reparte por vendedor).</em>' : '<em class="fz-nota">Costo y ganancia de esta plataforma (mismo cálculo que Ganancias).</em>';
    return '<div class="fz-kpis">' +
      card('coins', 'v', 'Ingresos cobrados (filtrado)', L(D.cobrado), '<em class="fz-nota">' + D.altas + ' alta(s) · ' + D.renov + ' renovación(es) · ' + D.clientes + ' cliente(s)</em><em class="fz-nota">Pendiente ' + L(D.pendiente) + '</em>' + (D.incompleto ? '<em class="fz-nota">Período muy grande: se filtraron las ' + ((g.graficos || {}).transacciones || []).length + ' transacciones más recientes.</em>' : '')) +
      card('layers', 'r', 'Costos directos', costo, nota) + card('cols', 'v', 'Resultado después de costos', res, '') +
      card('pct', 'a', 'Margen', mg, '<em class="fz-nota">Cobrado con costo vinculado: ' + L(D.cubierto) + '</em>') + '</div>';
  }
  async function cargarProximos(forzar) {
    if (st.dashProx && !forzar) return; st.dashProx = { cargando: true };
    try { st.dashProx = await api('finp_cuentas_lista', { plataforma: 'proximos' }); } catch (e) { st.dashProx = { error: e.message }; }
    if (st.tab === 'resumen') pintar();
  }
  function proximosHtml() {
    var r = st.dashProx; if (!r) { cargarProximos(); r = { cargando: true }; }
    var cab = '<div class="fz-card"><div class="fz-cab">' + ico('alert', 'am') + '<h3>Pagos a proveedores por vencer (7 días)</h3><button type="button" class="fz-btn sec sm" data-fz-tab="compras" data-sub="pendientes">Ir a Compras</button></div>';
    if (r.cargando) return cab + '<div class="fz-vacio-s"><span class="fz-spin"></span> Cargando…</div></div>';
    if (r.error) return cab + '<div class="fz-vacio-s">' + esc(r.error) + '</div></div>';
    var f = (r.filas || []).filter(function (x) { return !st.dash.plat || x.plataforma === st.dash.plat || (st.dash.plat === 'hbomax_standard' || st.dash.plat === 'hbomax_platinum') && x.plataforma === 'hbomax'; });
    return cab + (f.length ? '<div class="fz-tw"><table class="fz-t sm"><thead><tr><th>Cuenta madre</th><th>Próximo pago</th><th class="n">Último costo</th><th></th></tr></thead><tbody>' + f.slice(0, 12).map(function (x) {
      return '<tr><td><b>' + esc(x.correo) + '</b><small>' + esc(x.plataformaNombre) + '</small></td><td>' + (x.proximoPago ? fecha(x.proximoPago) : '—') + (x.vencido ? ' <span class="fz-pill mal">vencido</span>' : ' <span class="fz-pill warn">pronto</span>') + '</td><td class="n">' + (x.costo ? L(x.costo.costoHnl, true) : '<span class="fz-pend">Pendiente</span>') + '</td><td class="c"><button type="button" class="fz-btn sec sm" data-fz-hist="cuenta" data-id="' + esc(x.cuentaId) + '" data-titulo="' + esc(x.correo) + '">Historial</button></td></tr>';
    }).join('') + '</tbody></table></div>' + (f.length > 12 ? '<p class="fz-sub">Y ' + (f.length - 12) + ' más en Compras.</p>' : '') : '<div class="fz-vacio-s">Ningún pago a proveedor vence en los próximos 7 días.</div>') + '</div>';
  }
  function tvIniciar(on) {
    st.dash.tv = on; clearInterval(st.dashTvT);
    var el = document.querySelector('#rbac-finanzas') || host();
    if (on) {
      try { if (el && el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(function () {}); } catch (_) {}
      st.dashTvT = setInterval(function () { if (st.tab === 'resumen' && st.dash.tv) { st.dashProx = null; cargarGan(true); } }, 5 * 60 * 1000);
    } else { try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (_) {} }
    document.documentElement.classList.toggle('fz-tv', on); pintar();
  }
  document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement && st.dash.tv) tvIniciar(false); });

  // ---------------------------------------------------------------------------------------------- R200b · GRÁFICOS CONCILIADOS
  // Salen de la MISMA respuesta que las tarjetas (finp_ganancias): mismos filtros, mismos totales. Nada de cifras decorativas.
  // «Ganancia por categoría» quedaba vacío porque leía otra fuente (fin_consumos/PEPS) mientras las tarjetas usan el motor único.
  st.graf = st.graf || { tend: 'mes', orden: 'ganancia', inv: 'proveedor' };
  var COL = { cobrado: '#178EF1', costo: '#E6211C', resultado: '#13BD63', pend: '#C7CDD6', amarillo: '#F5B800', morado: '#8B5CF6' };
  function graficosHtml(g) {
    var G = st.graf, gr = g.graficos, r = g.resumen || {}, D = dashDatos(g);
    var sel = function (k, opts) { return '<select class="fz-gsel" data-fz-graf="' + k + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (G[k] === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; };
    var caja = function (id, titulo, extra, alto, pie) { return '<div class="fz-card fz-chart"><div class="fz-cab"><h3>' + titulo + '</h3>' + (extra || '') + '</div><div class="fz-chart-box" style="height:' + (alto || 250) + 'px"><canvas id="' + id + '" role="img" aria-label="' + esc(titulo) + '"></canvas></div>' + (pie || '') + '</div>'; };
    var cobC = D.hay ? D.cubierto : (gr.cobertura || {}).cubiertoHnl || 0, totCob = D.hay ? D.cobrado : (gr.cobertura || {}).cubiertoHnl + (gr.cobertura || {}).sinCostoHnl || 0;
    var nComp = function (t) { return D.tx.filter(function (x) { return x.tipo === t; }).length; };
    var nPlat = D.soloIngresos ? Object.keys(D.tx.reduce(function (a, t) { a[t.plataforma] = 1; return a; }, {})).length : (g.porPlataforma || []).filter(function (p) { return p.cobradoHnl > 0 || p.costoHnl > 0; }).length;
    return '<div class="fz-g2">' +
        caja('fzGTend', D.hay ? 'Tendencia del filtro: cobrado' : 'Tendencia: cobros, costos y ganancia', D.hay ? '' : sel('tend', [['mes', 'Por mes'], ['dia', 'Por día']]), 260, '<p class="fz-sub">' + (D.hay ? 'Con filtros se grafica lo cobrado (por día o por mes según el período).' : 'Toque un punto para ver sus transacciones' + (G.tend === 'mes' ? ' (abre ese mes)' : '') + '. «Pendiente» = mes con costo incompleto: no se grafica como ganancia.') + '</p>') +
        caja('fzGPlat', D.soloIngresos ? 'Cobrado por plataforma (filtro)' : 'Rentabilidad por plataforma', D.soloIngresos ? '' : sel('orden', [['ganancia', 'Mayor ganancia'], ['ingreso', 'Mayor ingreso'], ['margen', 'Peor margen']]), Math.max(220, Math.min(520, 34 * (nPlat + 1))), '<p class="fz-sub">Toque una barra para filtrar todo el tablero por esa plataforma.' + (D.soloIngresos ? '' : ' Gris = resultado pendiente (faltan costos por vincular).') + '</p>') +
      '</div><div class="fz-g3">' +
        caja('fzGComp', 'Altas nuevas vs. renovaciones', '', 220, '<p class="fz-sub">' + nComp('venta') + ' alta(s) · ' + nComp('renovacion') + ' renovación(es) · ' + nComp('ingreso_manual') + ' otro(s) cobro(s).</p>') +
        caja('fzGCob', 'Cobertura de costos', '<button type="button" class="fz-btn sec sm" data-fz-graf-pend>Ver pendientes</button>', 220, '<p class="fz-sub">' + (totCob ? P(Math.round(cobC / totCob * 1000) / 10) + ' del ingreso cobrado tiene costo vinculado.' : 'Sin cobros en el período.') + '</p>') +
        caja('fzGInv', 'Inversión y compras (caja)', sel('inv', [['proveedor', 'Por proveedor'], ['pago', 'Por método de pago'], ['moneda', 'Por moneda']]), 220, '<p class="fz-sub">Pagos a proveedores del período (' + L(r.desembolsoHnl) + '). No es lo mismo que el costo atribuido (' + L(r.costoHnl) + ').' + (D.soloIngresos ? ' No cambia con vendedor/banco.' : '') + '</p>') +
      '</div><div class="fz-g3">' +
        caja('fzGVend', 'Top vendedores', '', 240, '<p class="fz-sub">Cobrado por vendedor. Toque uno para filtrar.</p>') +
        caja('fzGBanco', 'Cobros por banco', '', 240, '<p class="fz-sub">A qué banco entró el dinero. Toque uno para filtrar.</p>') +
        caja('fzGSem', 'Ventas por día de la semana', '', 240, '<p class="fz-sub">Cobrado y cantidad de ventas según el día.</p>') +
      '</div><div class="fz-g2">' +
        caja('fzGCli', 'Top 10 clientes', '', 300, '<p class="fz-sub">Por monto cobrado en el período (beneficiario del servicio).</p>') + proximosHtml() +
      '</div><div class="fz-acc-graf"><button type="button" class="fz-btn sec sm" data-fz-trans="">' + ico('doc') + 'Ver transacciones (' + (D.hay ? D.tx.length : gr.transaccionesTotal || 0) + ')</button></div>';
  }
  function dibujarGraficos(g) {
    if (!window.Chart) return;
    var gr = g.graficos, G = st.graf, D = dashDatos(g), nuevo = function (id, cfg) { var cv = document.getElementById(id); if (!cv) return; var ch = new window.Chart(cv, cfg); st.charts.push(ch); return ch; };
    var grande = st.dash.tv ? 15 : 12;
    var base = { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: grande } } }, tooltip: { callbacks: { label: function (c) { return (c.dataset.label ? c.dataset.label + ': ' : '') + (c.raw == null ? 'Pendiente' : L(c.raw)); } } } } };
    var ejeL = { grid: { color: '#EEF1F5' }, border: { display: false }, ticks: { color: '#8A93A0', callback: function (v) { return L(v); } } };
    var agrupar = function (key) { var m = {}; D.tx.forEach(function (t) { var k = key(t); if (!k) return; var x = m[k] || (m[k] = { k: k, cobrado: 0, n: 0 }); x.cobrado = Math.round((x.cobrado + (Number(t.cobrado) || 0)) * 100) / 100; x.n++; }); return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.cobrado - a.cobrado; }); };
    var filtrarPor = function (k, v) { st.dash[k] = st.dash[k] === v ? '' : v; pintar(); };
    // Tendencia
    if (D.hay) {
      var r = ganRango(), largo = (Date.parse(r.hasta) - Date.parse(r.desde)) / 864e5 > 62;
      var serie = agrupar(function (t) { return largo ? String(t.fecha).slice(0, 7) : t.fecha; }).sort(function (a, b) { return a.k.localeCompare(b.k); });
      nuevo('fzGTend', { type: 'bar', data: { labels: serie.map(function (x) { return largo ? nombreMes(x.k) : x.k.slice(8) + '/' + x.k.slice(5, 7); }), datasets: [{ label: 'Cobrado', data: serie.map(function (x) { return x.cobrado; }), backgroundColor: COL.cobrado, borderRadius: 3 }] },
        options: Object.assign({}, base, { scales: { x: { grid: { display: false } }, y: ejeL }, onClick: function (e, el) { if (el.length && !largo) abrirTransacciones({ fecha: serie[el[0].index].k }); } }) });
    } else if (G.tend === 'dia') {
      var dd = gr.porDia || [];
      nuevo('fzGTend', { type: 'bar', data: { labels: dd.map(function (x) { return x.fecha.slice(8) + '/' + x.fecha.slice(5, 7); }), datasets: [{ label: 'Cobrado', data: dd.map(function (x) { return x.cobradoHnl; }), backgroundColor: COL.cobrado, borderRadius: 3 }, { label: 'Pagos a proveedores', data: dd.map(function (x) { return x.desembolsoHnl || 0; }), backgroundColor: COL.costo, borderRadius: 3 }] },
        options: Object.assign({}, base, { scales: { x: { grid: { display: false } }, y: ejeL }, onClick: function (e, el) { if (el.length) abrirTransacciones({ fecha: dd[el[0].index].fecha }); } }) });
    } else {
      var ms = g.meses || [];
      nuevo('fzGTend', { type: 'line', data: { labels: ms.map(function (m) { return nombreMes(m.mes); }), datasets: [
        { label: 'Cobrado', data: ms.map(function (m) { return m.cobradoHnl; }), borderColor: COL.cobrado, backgroundColor: COL.cobrado, tension: .25 },
        { label: 'Costo atribuido', data: ms.map(function (m) { return m.costoHnl; }), borderColor: COL.costo, backgroundColor: COL.costo, tension: .25 },
        { label: 'Ganancia calculable', data: ms.map(function (m) { return m.resultadoHnl == null ? null : m.resultadoHnl; }), borderColor: COL.resultado, backgroundColor: COL.resultado, tension: .25, spanGaps: false }] },
        options: Object.assign({}, base, { scales: { x: { grid: { display: false } }, y: ejeL }, onClick: function (e, el) { if (!el.length) return; var mg = ms[el[0].index].mes, pg = mg.split('-'); st.mes = mg; st.dash.periodo = 'mes'; st.ganR = { desde: mg + '-01', hasta: mg + '-' + String(new Date(Date.UTC(+pg[0], +pg[1], 0)).getUTCDate()).padStart(2, '0') }; cargar(true); } }) });
    }
    // Plataformas: con vendedor/banco = cobrado por plataforma; si no, rentabilidad (la elegida resaltada)
    if (D.soloIngresos) {
      var pc = agrupar(function (t) { return t.plataforma; }), nom = {}; D.tx.forEach(function (t) { nom[t.plataforma] = t.nombre; });
      nuevo('fzGPlat', { type: 'bar', data: { labels: pc.map(function (x) { return nom[x.k] || x.k; }), datasets: [{ label: 'Cobrado', data: pc.map(function (x) { return x.cobrado; }), backgroundColor: pc.map(function (x) { return !st.dash.plat || st.dash.plat === x.k ? COL.cobrado : 'rgba(23,142,241,.25)'; }), borderRadius: 4 }] },
        options: Object.assign({}, base, { indexAxis: 'y', plugins: Object.assign({}, base.plugins, { legend: { display: false } }), scales: { x: ejeL, y: { grid: { display: false } } }, onClick: function (e, el) { if (el.length) filtrarPor('plat', pc[el[0].index].k); } }) });
    } else {
      var pl = (g.porPlataforma || []).filter(function (p) { return p.cobradoHnl > 0 || p.costoHnl > 0; }).slice();
      pl.sort(G.orden === 'ingreso' ? function (a, b) { return b.cobradoHnl - a.cobradoHnl; } : G.orden === 'margen' ? function (a, b) { return (a.margen == null ? 1e9 : a.margen) - (b.margen == null ? 1e9 : b.margen); } : function (a, b) { return (b.resultadoHnl == null ? -1e12 : b.resultadoHnl) - (a.resultadoHnl == null ? -1e12 : a.resultadoHnl); });
      var apagado = function (p, c) { return st.dash.plat && st.dash.plat !== p.plataforma ? c.replace(/^#(..)(..)(..)$/, function (_, r, g2, b) { return 'rgba(' + parseInt(r, 16) + ',' + parseInt(g2, 16) + ',' + parseInt(b, 16) + ',.25)'; }) : c; };
      nuevo('fzGPlat', { type: 'bar', data: { labels: pl.map(function (p) { return p.nombre + (p.resultadoHnl == null ? ' · pendiente' : ''); }), datasets: [
        { label: 'Ganancia calculable', data: pl.map(function (p) { return p.resultadoHnl == null ? 0 : p.resultadoHnl; }), backgroundColor: pl.map(function (p) { return apagado(p, p.resultadoHnl == null ? COL.pend : p.resultadoHnl >= 0 ? COL.resultado : COL.costo); }), borderRadius: 4 },
        { label: 'Cobrado', data: pl.map(function (p) { return p.cobradoHnl; }), backgroundColor: 'rgba(23,142,241,.25)', borderRadius: 4 }] },
        options: Object.assign({}, base, { indexAxis: 'y', scales: { x: ejeL, y: { grid: { display: false } } },
          plugins: Object.assign({}, base.plugins, { tooltip: { callbacks: { label: function (c) { var p = pl[c.dataIndex]; if (c.datasetIndex === 0) return p.resultadoHnl == null ? 'Resultado pendiente · cobertura ' + (p.coberturaCostos == null ? '—' : p.coberturaCostos + '%') : 'Ganancia ' + L(p.resultadoHnl) + (p.margen == null ? '' : ' · margen ' + p.margen + '%') + (p.margenDefinitivo ? '' : ' (parcial)'); return 'Cobrado ' + L(p.cobradoHnl); } } } }),
          onClick: function (e, el) { if (el.length) filtrarPor('plat', pl[el[0].index].plataforma); } }) });
    }
    // Composición y cobertura (del filtro)
    var cs = function (t) { return Math.round(D.tx.filter(function (x) { return x.tipo === t; }).reduce(function (a, x) { return a + x.cobrado; }, 0) * 100) / 100; };
    var cp = D.hay ? { a: cs('venta'), r: cs('renovacion'), o: cs('ingreso_manual') } : { a: gr.composicion.venta.cobradoHnl, r: gr.composicion.renovacion.cobradoHnl, o: gr.composicion.ingreso_manual.cobradoHnl };
    nuevo('fzGComp', { type: 'doughnut', data: { labels: ['Altas nuevas', 'Renovaciones', 'Otros cobros'], datasets: [{ data: [cp.a, cp.r, cp.o], backgroundColor: [COL.cobrado, COL.resultado, COL.amarillo] }] },
      options: Object.assign({}, base, { cutout: '58%', onClick: function (e, el) { if (el.length) abrirTransacciones({ tipo: ['venta', 'renovacion', 'ingreso_manual'][el[0].index] }); } }) });
    var cb = D.hay ? { c: D.cubierto, s: Math.round((D.cobrado - D.cubierto) * 100) / 100 } : { c: gr.cobertura.cubiertoHnl, s: gr.cobertura.sinCostoHnl };
    nuevo('fzGCob', { type: 'doughnut', data: { labels: ['Con costo vinculado', 'Sin costo (pendiente)'], datasets: [{ data: [cb.c, cb.s], backgroundColor: [COL.resultado, COL.pend] }] },
      options: Object.assign({}, base, { cutout: '58%', onClick: function (e, el) { if (el.length) abrirTransacciones({ cubierto: el[0].index === 0 }); } }) });
    // Inversión (caja)
    var inv = (G.inv === 'pago' ? gr.inversionPago : G.inv === 'moneda' ? gr.inversionMoneda : gr.inversionProveedor) || [];
    nuevo('fzGInv', { type: 'bar', data: { labels: inv.slice(0, 8).map(function (x) { return x.clave; }), datasets: [{ label: 'Pagado', data: inv.slice(0, 8).map(function (x) { return x.costoHnl; }), backgroundColor: COL.morado, borderRadius: 4 }] },
      options: Object.assign({}, base, { plugins: Object.assign({}, base.plugins, { legend: { display: false } }), scales: { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: ejeL } }) });
    // Vendedores / bancos / día de semana / clientes
    var barras = function (id, lista, color, clave, maxN, horizontal) {
      var l = lista.slice(0, maxN || 10);
      nuevo(id, { type: 'bar', data: { labels: l.map(function (x) { return x.k; }), datasets: [{ label: 'Cobrado', data: l.map(function (x) { return x.cobrado; }), backgroundColor: l.map(function (x) { return !clave || !st.dash[clave] || st.dash[clave] === x.k ? color : 'rgba(150,160,175,.35)'; }), borderRadius: 4 }] },
        options: Object.assign({}, base, { indexAxis: horizontal ? 'y' : 'x', plugins: Object.assign({}, base.plugins, { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return L(c.raw) + ' · ' + l[c.dataIndex].n + ' venta(s)'; } } } }), scales: horizontal ? { x: ejeL, y: { grid: { display: false } } } : { x: { grid: { display: false } }, y: ejeL },
          onClick: function (e, el) { if (el.length && clave) filtrarPor(clave, l[el[0].index].k); } }) });
    };
    barras('fzGVend', agrupar(function (t) { return t.vendedor; }), COL.resultado, 'vend', 8, true);
    var bancos = {}; D.tx.forEach(function (t) { String(t.banco || 'Sin banco').split(' + ').forEach(function (b) { var x = bancos[b] || (bancos[b] = { k: b, cobrado: 0, n: 0 }); x.cobrado = Math.round((x.cobrado + t.cobrado) * 100) / 100; x.n++; }); });
    barras('fzGBanco', Object.keys(bancos).map(function (k) { return bancos[k]; }).sort(function (a, b) { return b.cobrado - a.cobrado; }), COL.cobrado, 'banco', 8, true);
    var sem = DIAS_SEM.map(function (dn) { return { k: dn, cobrado: 0, n: 0 }; }); D.tx.forEach(function (t) { var i = new Date(t.fecha + 'T12:00:00Z').getUTCDay(); if (isNaN(i)) return; sem[i].cobrado = Math.round((sem[i].cobrado + t.cobrado) * 100) / 100; sem[i].n++; });
    var semL = sem.slice(1).concat(sem.slice(0, 1)); // lunes primero
    nuevo('fzGSem', { type: 'bar', data: { labels: semL.map(function (x) { return x.k.slice(0, 3); }), datasets: [{ label: 'Cobrado', data: semL.map(function (x) { return x.cobrado; }), backgroundColor: COL.amarillo, borderRadius: 4, yAxisID: 'y' }, { type: 'line', label: 'Ventas', data: semL.map(function (x) { return x.n; }), borderColor: COL.costo, backgroundColor: COL.costo, yAxisID: 'y2', tension: .3 }] },
      options: Object.assign({}, base, { plugins: Object.assign({}, base.plugins, { tooltip: { callbacks: { label: function (c) { return c.datasetIndex ? c.raw + ' venta(s)' : 'Cobrado ' + L(c.raw); } } } }), scales: { x: { grid: { display: false } }, y: ejeL, y2: { position: 'right', grid: { display: false }, beginAtZero: true, ticks: { precision: 0 } } } }) });
    barras('fzGCli', agrupar(function (t) { return t.beneficiario; }), COL.morado, '', 10, true);
  }
  // Transacciones (drill-down): mismas líneas del cálculo; filtros por plataforma, tipo, vendedor y texto.
  function abrirTransacciones(filtro) {
    var g = st.gan[ganClave()]; if (!g || !g.graficos) return;
    filtro = filtro || {};
    var TIPO = { venta: 'Alta nueva', renovacion: 'Renovación cobrada', ingreso_manual: 'Otro cobro' };
    var DF = st.dash || {}; // R200h · respeta los filtros del dashboard
    var todas = (g.graficos.transacciones || []).filter(function (t) { return (!DF.plat || t.plataforma === DF.plat) && (!DF.vend || t.vendedor === DF.vend) && (!DF.banco || String(t.banco || '').split(' + ').indexOf(DF.banco) >= 0); });
    var plats = []; todas.forEach(function (t) { if (plats.indexOf(t.nombre) < 0) plats.push(t.nombre); }); plats.sort();
    var vends = []; todas.forEach(function (t) { if (vends.indexOf(t.vendedor) < 0) vends.push(t.vendedor); }); vends.sort();
    var html = '<div class="fz-filtros fz-comp-f"><input type="search" data-tf="q" placeholder="Cliente, cuenta o referencia"><select data-tf="plat"><option value="">Todas las plataformas</option>' + plats.map(function (p) { return '<option>' + esc(p) + '</option>'; }).join('') + '</select>' +
      '<select data-tf="tipo"><option value="">Todos los tipos</option>' + Object.keys(TIPO).map(function (k) { return '<option value="' + k + '"' + (filtro.tipo === k ? ' selected' : '') + '>' + TIPO[k] + '</option>'; }).join('') + '</select>' +
      '<select data-tf="vend"><option value="">Todos los vendedores</option>' + vends.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('') + '</select>' +
      '<input type="date" data-tf="fecha" value="' + esc(filtro.fecha || '') + '" aria-label="Fecha"><select data-tf="cub"><option value="">Con y sin costo</option><option value="1"' + (filtro.cubierto === true ? ' selected' : '') + '>Con costo vinculado</option><option value="0"' + (filtro.cubierto === false ? ' selected' : '') + '>Sin costo (pendiente)</option></select></div><div data-tlista></div>';
    var m = modal('Transacciones · ' + nombreMes(st.mes), html); var mc = m.querySelector('.fz-modal-c'); if (mc) mc.style.maxWidth = 'min(1180px, 96vw)';
    function pintarT() {
      var v = function (k) { var x = m.querySelector('[data-tf="' + k + '"]'); return x ? x.value : ''; };
      var q = v('q').toLowerCase(), lst = todas.filter(function (t) {
        return (!v('plat') || t.nombre === v('plat')) && (!v('tipo') || t.tipo === v('tipo')) && (!v('vend') || t.vendedor === v('vend')) && (!v('fecha') || t.fecha === v('fecha')) && (v('cub') === '' || String(t.costoCubierto ? 1 : 0) === v('cub')) &&
          (!q || (t.beneficiario + ' ' + t.titular + ' ' + t.cuenta + ' ' + t.referencia).toLowerCase().indexOf(q) >= 0);
      });
      var tot = lst.reduce(function (a, t) { return a + t.cobrado; }, 0);
      m.querySelector('[data-tlista]').innerHTML = '<p class="fz-sub"><b>' + lst.length + '</b> transacción(es) · cobrado <b>' + L(Math.round(tot * 100) / 100, true) + '</b>' + (g.graficos.transaccionesTotal > todas.length ? ' · se muestran las ' + todas.length + ' más recientes' : '') + '</p>' +
        '<div class="fz-tw"><table class="fz-t sm"><thead><tr><th>Fecha</th><th>Tipo</th><th>Plataforma</th><th>Beneficiario</th><th>Titular</th><th>Cuenta</th><th>Vendedor</th><th class="n">Valor</th><th class="n">Cobrado</th><th class="c">Costo</th><th>Referencia</th></tr></thead><tbody>' +
        lst.slice(0, 400).map(function (t) { return '<tr><td>' + fecha(t.fecha) + '</td><td>' + TIPO[t.tipo] + '</td><td>' + esc(t.nombre) + '</td><td>' + esc(t.beneficiario) + '</td><td>' + esc(t.titular) + '</td><td>' + (t.cuentaId ? '<button type="button" class="fz-link" data-fz-gancta="' + esc(t.cuentaId) + '">' + esc(t.cuenta || 'Cuenta') + '</button>' : '—') + '</td><td>' + esc(t.vendedor) + '</td><td class="n">' + L(t.monto, true) + (t.descuento > 0 ? '<small class="fz-pend"> −' + L(t.descuento, true) + '</small>' : '') + '</td><td class="n">' + L(t.cobrado, true) + '</td><td class="c">' + (t.costoCubierto ? '<span class="fz-pill ok">Vinculado</span>' : '<span class="fz-pill warn">Pendiente</span>') + '</td><td><small>' + esc(String(t.referencia).slice(-10)) + '</small></td></tr>'; }).join('') +
        '</tbody></table></div>' + (lst.length > 400 ? '<p class="fz-sub">Se muestran 400; use los filtros o el Excel para el resto.</p>' : '');
    }
    m.addEventListener('input', pintarT); m.addEventListener('change', pintarT);
    m.addEventListener('click', function (e) { var b = e.target.closest('[data-fz-gancta]'); if (b) { m.remove(); abrirGanCuenta(b.dataset.fzGancta); } });
    pintarT();
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
  // ---------------------------------------------------------------------------------------------- R197 · GANANCIAS (motor único)
  // Todo sale de finp_ganancias (api/_finanzas-ganancias.js): ingresos COBRADOS del libro, pendientes y ESPERADOS (renovaciones
  // de las fichas, que no son dinero), costos reales según la forma de compra de cada producto y el detalle por cuenta madre.
  // Solo lectura: no crea ni cambia ventas, clientes, cuentas ni compras.
  st.gan = st.gan || {}; st.ganF = st.ganF || { plat: '', cuentas: '' };
  function ganRango() { if (st.ganR && st.ganR.desde) return st.ganR; var m = st.mes || ''; var p = m.split('-'); var ult = new Date(Date.UTC(+p[0], +p[1], 0)).getUTCDate(); return { desde: m + '-01', hasta: m + '-' + String(ult).padStart(2, '0') }; }
  function ganClave() { var r = ganRango(); return r.desde + '_' + r.hasta; }
  async function cargarGan(forzar) {
    var k = ganClave(); if (st.gan[k] && !forzar) return; st.gan[k] = { cargando: true };
    try { var r = ganRango(); st.gan[k] = await api('finp_ganancias', { desde: r.desde, hasta: r.hasta }); } catch (e) { st.gan[k] = { error: e.message }; }
    if (st.tab === 'ganancias' || st.tab === 'resumen' || st.tab === 'reportes') pintar();
  }
  var EST_PLAT = { ok: ['Costo completo', 'ok'], cobertura_parcial: ['Cobertura parcial', 'warn'], costo_pendiente: ['Costo pendiente', 'warn'], sin_ingreso: ['Sin ingreso cobrado', 'gris'], sin_movimiento: ['Sin movimiento', 'gris'] };
  var EST_CART = { alta_cobrada: ['Alta cobrada', 'ok'], renovacion_cobrada: ['Renovación cobrada', 'ok'], parcial: ['Pago parcial', 'warn'], pendiente: ['Pendiente', 'warn'], sin_movimiento: ['Sin movimiento en el período', 'gris'] };
  var AVISO = { sin_cuenta: 'Asignación pendiente de conciliar', plan_sin_clasificar: 'Plan HBO sin clasificar', combo: 'Parte de un combo', servicio_sin_ficha: 'Servicio ya no está en la ficha', sin_identificador: 'Sin identificador de servicio' };
  var BAND = { sin_coincidencia: 'Asignación pendiente', plan_sin_clasificar: 'Plan sin clasificar', pago_pendiente: 'Pago pendiente', costo_pendiente: 'Costo pendiente', datos_incompletos: 'Datos incompletos', ingreso_sin_confirmar: 'Ingreso sin confirmar' };
  var REGLA = { cobertura: 'Por vigencia', activacion: 'Por activación', consumo: 'Por consumo', lote_sin_consumo: 'Lote sin consumo', mensual_acceso: 'Mensual por acceso', mensual_familia: 'Mensual por familia' };
  function ganKpis(g) {
    var r = g.resumen, a = g.anterior || {};
    function dl(x, y) { if (!(y > 0) || x == null) return '<em class="fz-delta n">sin dato comparable del período anterior</em>'; var v = Math.round((x - y) / Math.abs(y) * 1000) / 10; return '<em class="fz-delta ' + (v >= 0 ? 'ok' : 'mal') + '">' + ico(v >= 0 ? 'up' : 'down') + (v > 0 ? '+' : '') + v + '% <span>vs. ' + esc(nombreMes(a.mes)) + '</span></em>'; }
    function card(ic, cls, t, val, extra) { return '<div class="fz-card fz-kpi"><span class="fz-kpi-i ' + cls + '">' + ico(ic) + '</span><div><small>' + t + '</small><strong>' + val + '</strong>' + (extra || '') + '</div></div>'; }
    var sinDatos = r.estado === 'sin_datos';
    var res = sinDatos ? '<span class="fz-pend">Sin datos</span>' : r.resultadoHnl == null ? '<span class="fz-pend">No calculable · costo incompleto</span>' : L(r.resultadoHnl);
    return '<div class="fz-kpis">' +
      card('coins', 'v', 'Ingresos cobrados', sinDatos ? '<span class="fz-pend">Sin ventas registradas</span>' : L(r.cobradoHnl), dl(r.cobradoHnl, a.cobradoHnl) + '<em class="fz-nota">' + r.altas + ' alta(s) · ' + r.renovaciones + ' renovación(es) cobradas · ' + r.clientesUnicos + ' cliente(s)</em><em class="fz-nota">Pendiente ' + L(r.pendienteHnl) + ' · Esperado sin confirmar ' + L(r.esperadoHnl) + '</em>') +
      card('layers', 'r', 'Costos directos del período', L(r.costoHnl), '<em class="fz-nota">Pagos a proveedores (caja): ' + L(r.desembolsoHnl) + ' · Flujo de caja: ' + L(r.flujoCajaHnl) + '</em>') +
      card('cols', 'v', 'Resultado después de costos directos', res, '<em class="fz-nota">Sobre ' + L(r.cobradoCubiertoHnl) + ' cobrados con costo registrado' + (r.cobradoSinCostoHnl > 0 ? ' · ' + L(r.cobradoSinCostoHnl) + ' cobrados SIN costo quedan fuera (costo incompleto)' : '') + '</em>' + dl(r.resultadoHnl, a.resultadoHnl)) +
      card('pct', 'a', 'Margen' + (r.margenDefinitivo ? '' : ' (no definitivo)'), P(r.margen), '<em class="fz-nota">Cobertura de costos: ' + P(r.coberturaCostos) + (r.margenDefinitivo ? '' : ' · faltan costos por vincular') + '</em>') + '</div>';
  }
  function ganDefs(g) {
    var d = g.definiciones || {}, c = (g.resumen || {}).cuadre || {};
    return '<details class="fz-card fz-defs"><summary>' + ico('doc') + ' Qué significa cada columna y cuadre de cobros</summary><div class="fz-g2 b" style="margin-top:10px"><div>' +
      Object.keys(d).map(function (k) { return '<p class="fz-sub"><b>' + esc(k.charAt(0).toUpperCase() + k.slice(1)) + ':</b> ' + esc(d[k]) + '</p>'; }).join('') + '</div><div>' +
      '<div class="fz-lin"><div><b>Cobros originales del período</b><small>Ingresos registrados en el libro (caja)</small></div><strong>' + L(c.cobrosOriginalesHnl, true) + '</strong></div>' +
      '<div class="fz-lin"><div><b>Asignado a servicios</b><small>Altas, renovaciones y combos repartidos</small></div><strong>' + L(c.asignadoServiciosHnl, true) + '</strong></div>' +
      '<div class="fz-lin"><div><b>Abonos a ventas anteriores</b><small>Saldos de cuentas por cobrar</small></div><strong>' + L(c.abonosVentasAnterioresHnl, true) + '</strong></div>' +
      '<div class="fz-lin"><div><b>No asignado a un servicio</b><small>Cobros cuya venta es de otro período o sin servicio</small></div><strong>' + L(c.noAsignadoHnl, true) + '</strong></div>' +
      '<div class="fz-lin"><div><b>Diferencia</b><small>' + (Math.abs(c.diferenciaHnl || 0) < 0.01 ? 'Cuadra' : 'Revisar') + '</small></div><strong class="' + (Math.abs(c.diferenciaHnl || 0) < 0.01 ? 'vd' : 'rj') + '">' + L(c.diferenciaHnl, true) + '</strong></div>' +
      '<p class="fz-sub">Calculado ' + esc(String((g.resumen || {}).calculadoAt || '').replace('T', ' ').slice(0, 16)) + ' UTC · solo lectura.</p></div></div></details>';
  }
  function ganPeriodo(g) {
    var r = ganRango();
    return '<div class="fz-card"><div class="fz-cab">' + ico('trend') + '<h3>Período</h3><span class="fz-sub r">' + fecha(r.desde) + ' → ' + fecha(r.hasta) + '</span></div>' +
      '<div class="fz-filtros">' + (g && g.meses ? g.meses.map(function (m) { var on = r.desde === m.mes + '-01' && r.hasta.slice(0, 7) === m.mes; return '<button type="button" class="' + (on ? 'on' : '') + '" data-fz-ganmes="' + esc(m.mes) + '">' + esc(nombreMes(m.mes)) + '</button>'; }).join('') : '') +
      '<button type="button" data-fz-gantri="1">Últimos 3 meses</button></div>' +
      '<div class="fz-form in" style="margin-top:10px"><label>Desde<input type="date" data-fz-ganr="desde" value="' + esc(r.desde) + '"></label><label>Hasta<input type="date" data-fz-ganr="hasta" value="' + esc(r.hasta) + '"></label><button type="button" class="fz-btn sec" data-fz="ganrango">Ver rango</button><button type="button" class="fz-btn" data-fz="excelfin">' + ico('dl') + 'Excel financiero (9 hojas)</button><button type="button" class="fz-btn sec" data-fz="ganexcel">' + ico('dl') + 'Detalle plano</button><button type="button" class="fz-btn sec" data-fz="ganaud">' + ico('alert') + 'Auditoría de cartera</button></div>' +
      (g && g.meses ? '<div class="fz-tw" style="margin-top:12px"><table class="fz-t"><thead><tr><th>Mes</th><th class="n">Cobrado</th><th class="n">Pendiente</th><th class="n">Esperado</th><th class="n">Costos</th><th class="n">Pagos a proveedores</th><th class="n">Resultado</th><th class="c">Margen</th><th class="c">Cobertura</th></tr></thead><tbody>' +
        g.meses.map(function (m) { return '<tr><td><b>' + esc(nombreMes(m.mes)) + '</b><small>' + m.altas + ' altas · ' + m.renovaciones + ' renov.</small></td><td class="n">' + L(m.cobradoHnl) + '</td><td class="n">' + L(m.pendienteHnl) + '</td><td class="n">' + L(m.esperadoHnl) + '</td><td class="n">' + L(m.costoHnl) + '</td><td class="n">' + L(m.desembolsoHnl) + '</td><td class="n">' + (m.estado === 'sin_datos' ? '<span class="fz-pend">Sin datos</span>' : m.resultadoHnl == null ? '<span class="fz-pend">No calculable</span>' : '<b class="' + (m.resultadoHnl >= 0 ? 'vd' : 'rj') + '">' + L(m.resultadoHnl) + '</b>') + '</td><td class="c">' + P(m.margen) + (m.margenDefinitivo ? '' : '<small class="fz-pend">no definitivo</small>') + '</td><td class="c">' + P(m.coberturaCostos) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') + '</div>';
  }
  function ganPlataformas(g) {
    var f = (g.porPlataforma || []).filter(function (p) { return p.estado !== 'sin_movimiento' || p.esperadoHnl > 0; });
    return '<div class="fz-card fz-rent"><div class="fz-cab">' + ico('layers') + '<h3>Rentabilidad por plataforma</h3><span class="fz-sub r">Toque «Cuentas» para ver de dónde sale cada cifra</span></div>' +
      (f.length ? '<div class="fz-tw"><table class="fz-t"><thead><tr><th>Plataforma</th><th class="n">Pagaron</th><th class="n">Altas</th><th class="n">Renov.</th><th class="n">Cobrado</th><th class="n">Pendiente</th><th class="n">Esperado</th><th class="n">Costo</th><th class="c">Cobertura</th><th class="n">Resultado</th><th class="c">Margen</th><th class="c">Estado</th><th></th></tr></thead><tbody>' +
        f.map(function (p) { return '<tr><td style="min-width:240px"><div class="fz-prod">' + logo(p.nombre) + '<b>' + esc(p.nombre) + '</b></div>' + (p.carteraCuentas ? '<small title="Cartera Control Maestro: cuentas y perfiles ocupados hoy">Control Maestro: <b>' + p.carteraCuentas + ' cuentas · ' + p.carteraPerfiles + ' perfiles</b></small>' : '') + '<small>Con cobro: ' + p.cuentas + ' cuentas · ' + p.servicios + ' servicios' + (p.sinCuenta ? ' · <span class="fz-pend">' + p.sinCuenta + ' cobro(s) sin cuenta madre</span>' : '') + '</small></td><td class="n">' + p.clientes + (p.carteraClientes ? '<small>de ' + p.carteraClientes + '</small>' : '') + '</td><td class="n">' + p.altas + '</td><td class="n">' + p.renovaciones + '</td><td class="n">' + L(p.cobradoHnl) + '</td><td class="n">' + L(p.pendienteHnl) + '</td><td class="n">' + L(p.esperadoHnl) + '</td><td class="n">' + (p.costoHnl > 0 ? L(p.costoHnl) : p.cobradoCicloHnl > 0 ? 'L0' : '<span class="fz-pend">Costo pendiente</span>') + (p.cuentasCiclo ? '<small>' + p.cuentasCiclo + ' cuenta(s) cubierta(s) por activación</small>' : '') + '</td><td class="c">' + P(p.coberturaCostos) + '</td><td class="n">' + (p.resultadoHnl == null ? '<span class="fz-pend">No calculable</span>' : '<b class="' + (p.resultadoHnl >= 0 ? 'vd' : 'rj') + '">' + L(p.resultadoHnl) + '</b>') + '</td><td class="c">' + P(p.margen) + (p.margen != null && !p.margenDefinitivo ? '<small class="fz-pend">parcial</small>' : '') + '</td><td class="c">' + pill(EST_PLAT, p.estado) + '</td><td class="c"><button type="button" class="fz-btn sec sm" data-fz-ganplat="' + esc(p.plataforma) + '">Cuentas</button></td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="fz-vacio-s">No hay ventas ni costos registrados en este período.</div>') + '</div>';
  }
  // R197b · Botón «Cuentas»: abre TODAS las cuentas/accesos de la plataforma (con o sin movimiento) y la conciliación de cartera
  // (vigentes del CRM vs. cobros del período, fila por fila). Solo lectura.
  // R198h · COSTO POR CUENTA: por qué sí o no tiene costo en el período (nunca un «Pendiente» sin explicación)
  var EC_PILL = { atribuido: 'ok', ciclo_vigente: 'ok', cobertura_desconocida: 'warn', fuera_periodo: 'gris', sin_compra: 'pend' };
  // R198i · ciclo de activación: costo una vez en la activación; ganancia = todo lo cobrado hasta la próxima activación
  function cicloTxt(k) {
    if (!k) return '';
    return '<small>Activada ' + fecha(k.fechaActivacion) + ' · costó ' + L(k.costoHnl) + (k.moneda === 'USDT' ? ' (' + esc(k.montoMoneda) + ' USDT)' : '') + '</small>' +
      (k.cobradoHnl != null ? '<small>Ciclo: cobrado ' + L(k.cobradoHnl) + ' → <b class="' + (k.resultadoHnl >= 0 ? 'vd' : 'rj') + '">' + L(k.resultadoHnl, true) + '</b>' + (k.recuperado ? ' · recuperada' : ' · por recuperar') + (k.completo === false ? ' · parcial (más de 400 días)' : '') + '</small>' : '');
  }
  function costoCeldaG(c) {
    if (c.costoHnl > 0) return L(c.costoHnl) + '<small>' + esc(c.estadoCostoTxt || '') + '</small>';
    if (!c.estadoCosto) return c.conCosto ? 'General' : '<span class="fz-pend">Pendiente</span>';
    var u = c.ultimaCompra;
    if (c.estadoCosto === 'ciclo_vigente') return 'L0<small><span class="fz-pill ok" title="' + esc(c.motivoCosto || '') + '">' + esc(c.estadoCostoTxt) + '</span></small>' + cicloTxt(c.cicloActual);
    return '<span class="fz-pill ' + (EC_PILL[c.estadoCosto] || 'gris') + '" title="' + esc(c.motivoCosto || '') + '">' + esc(c.estadoCostoTxt) + '</span>' + (u && c.estadoCosto !== 'atribuido' ? '<small>Última compra ' + fecha(u.fecha) + ' · ' + L(u.costoHnl) + (u.moneda === 'USDT' ? ' (' + u.montoMoneda + ' USDT)' : '') + '</small>' : '');
  }
  var REL_PILL = { imputado: 'ok', ciclo_vigente: 'ok', ciclo_cerrado: 'gris', cobertura_desconocida: 'warn', cobertura_terminada: 'gris', cobertura_posterior: 'gris', posterior: 'gris' };
  var VINC_TXT = { por_id: 'Vinculada por ID', conciliado: 'Conciliada', sin_vinculo: 'Sin cuenta (pendiente de vínculo)' };
  function comprasConciliacionHtml(x, filtro) {
    var cc = x.compras || { filas: [], resumen: {} }, rs = cc.resumen || {}, cf = filtro.cf || '';
    var filas = cc.filas.filter(function (c) { return !cf || (cf === 'sin_vinculo' ? c.vinculo === 'sin_vinculo' : cf === 'no_acred' ? c.cantidadNoAcreditada : cf === 'plan' ? c.productoPlanDistinto : c.relacion === cf); });
    var mini = '<div class="fz-mini" style="margin-top:10px"><div><small>Compras registradas</small><b>' + (rs.compras || 0) + '</b></div><div><small>Imputadas a este período</small><b>' + (rs.imputadas || 0) + ' · ' + L(rs.costoImputadoHnl || 0) + '</b></div><div><small>Anteriores · cobertura desconocida</small><b>' + (rs.coberturaDesconocida || 0) + '</b></div><div><small>Sin cuenta</small><b>' + (rs.sinVinculo || 0) + '</b></div></div>';
    var nota = '<p class="fz-sub">Cada compra se muestra UNA vez con su fecha, moneda, tasa y Lempiras originales (no se cambian). Una activación anterior sin duración documentada NO se imputa al período: queda «cobertura desconocida». ' +
      ((rs.cantidadNoAcreditada || 0) ? '<b>' + rs.cantidadNoAcreditada + ' compra(s) con «perfil-mes» no acreditado</b> (la cantidad salió del catálogo 365 días × 5 perfiles, no de la compra): no se usan como existencia ni como meses de costo. ' : '') +
      ((rs.productoPlanDistinto || 0) ? '<b>' + rs.productoPlanDistinto + ' compra(s) registrada(s) como «HBO Platinum» en cuentas Standard</b> (el botón «Registrar activación» elegía ese producto): el plan real es el de Control Maestro. ' : '') + '</p>';
    var sel = '<div class="fz-form in"><label>Ver<select data-pcf><option value="">Todas</option>' + [['imputado', 'Imputadas al período'], ['cobertura_desconocida', 'Cobertura desconocida'], ['sin_vinculo', 'Sin cuenta'], ['no_acred', '«perfil-mes» no acreditado'], ['plan', 'Producto ≠ plan'], ['posterior', 'Posteriores al período']].map(function (o) { return '<option value="' + o[0] + '"' + (cf === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label><button type="button" class="fz-btn sec" data-concil-csv>' + ico('dl') + 'Exportar conciliación</button></div>';
    var t = '<div class="fz-tw" style="margin-top:8px"><table class="fz-t"><thead><tr><th>Fecha</th><th>Producto</th><th class="n">Cantidad</th><th class="n">Monto</th><th class="n">Tasa</th><th class="n">Costo L</th><th>Cuenta</th><th>Relación con el período</th><th class="n">Imputado</th><th></th></tr></thead><tbody>' +
      filas.slice(0, 500).map(function (c) {
        return '<tr><td>' + fecha(c.fecha) + (c.fechaActivacion && c.fechaActivacion !== c.fecha ? '<small>Activación ' + fecha(c.fechaActivacion) + '</small>' : '') + '</td><td><b>' + esc(c.producto) + '</b><small>' + esc(c.pago || '') + '</small>' + (c.productoPlanDistinto ? '<small class="fz-pend">Plan real: ' + esc(c.plan) + '</small>' : '') + '</td>' +
          '<td class="n">' + c.cantidad + ' ' + esc(c.unidad || '') + (c.cantidadNoAcreditada ? '<small class="fz-pend">no acreditado</small>' : '') + '</td><td class="n">' + esc(String(c.montoMoneda)) + ' ' + esc(c.moneda) + '</td><td class="n">' + (c.tasa || '—') + '</td><td class="n">' + L(c.costoHnl) + '</td>' +
          '<td>' + (c.correo ? esc(c.correo) : '<span class="fz-pend">—</span>') + '<small>' + esc(VINC_TXT[c.vinculo] || c.vinculo) + '</small>' + (c.propuesta && c.propuesta.correo ? '<small>Propuesta: ' + esc(c.propuesta.correo) + ' · ' + esc(c.propuesta.evidencia) + '</small>' : c.propuesta && c.propuesta.ambigua ? '<small class="fz-pend">Coincidencia ambigua: requiere decisión</small>' : '') + '</td>' +
          '<td><span class="fz-pill ' + (REL_PILL[c.relacion] || 'gris') + '">' + esc(c.relacionTxt || c.relacion) + '</span>' + (c.ciclo ? '<small>Cobertura documentada ' + fecha(c.ciclo.desde) + ' → ' + fecha(c.ciclo.hasta) + ' · ' + esc(c.ciclo.evidencia) + '</small>' : '') + '</td><td class="n">' + (c.imputadoHnl > 0 ? L(c.imputadoHnl) : '—') + '</td>' +
          '<td class="c">' + (x.puedeConciliar ? '<button type="button" class="fz-btn sec sm" data-concil="' + esc(c.loteId) + '">Conciliar</button>' + ((c.vinculo === 'conciliado' || c.ciclo) ? ' <button type="button" class="fz-btn sec sm" data-concil-quitar="' + esc(c.loteId) + '">Quitar</button>' : '') : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return mini + nota + sel + (filas.length ? t : '<div class="fz-vacio-s">Ninguna compra cumple el filtro.</div>');
  }
  function abrirConciliar(x, loteId, alListo) {
    var c = ((x.compras || {}).filas || []).find(function (k) { return k.loteId === loteId; }); if (!c) return;
    var cuentas = (x.cuentas || []).filter(function (k) { return k.acceso !== 'acceso_individual'; });
    var html = '<p class="fz-sub">Compra del ' + fecha(c.fecha) + ' · ' + esc(c.producto) + ' · ' + esc(String(c.montoMoneda)) + ' ' + esc(c.moneda) + (c.tasa ? ' a ' + c.tasa : '') + ' = ' + L(c.costoHnl) + '. <b>La compra no cambia</b>: aquí solo se anota a qué cuenta pertenece y, si hay respaldo, qué período cubre.</p>' +
      '<div class="fz-form">' + (c.vinculo === 'por_id' ? '<p class="fz-sub w2">Cuenta original: <b>' + esc(c.correo) + '</b> (no se cambia).</p>' : '<label class="w2">Cuenta madre<select name="cuenta"><option value="">— elegir —</option>' + cuentas.map(function (k) { return '<option value="' + esc(k.cuentaId) + '"' + ((c.cuentaId === k.cuentaId || (c.propuesta && c.propuesta.cuentaId === k.cuentaId)) ? ' selected' : '') + '>' + esc(k.correo) + (k.plan ? ' · ' + esc(k.plan) : '') + '</option>'; }).join('') + '</select></label>') +
      '<label>Cobertura desde<input type="date" name="cd" value="' + esc(c.ciclo ? c.ciclo.desde : '') + '"></label><label>Cobertura hasta<input type="date" name="ch" value="' + esc(c.ciclo ? c.ciclo.hasta : '') + '"></label>' +
      '<p class="fz-sub w2">Deje la cobertura vacía si no hay respaldo: la compra queda en su fecha y los meses siguientes «cobertura desconocida». Nunca se inventa duración.</p>' +
      '<label class="w2">Evidencia (obligatoria)<input name="ev" maxlength="300" placeholder="Ej.: activación del 07/10 vence el 06/11 según el correo del proveedor" value="' + esc(c.ciclo ? c.ciclo.evidencia : '') + '"></label></div>';
    modal('Conciliar compra con cuenta y período', html, function (m) {
      var b = { loteId: loteId, cuentaInventarioId: (m.querySelector('[name="cuenta"]') || {}).value || '', coberturaDesde: m.querySelector('[name="cd"]').value, coberturaHasta: m.querySelector('[name="ch"]').value, evidencia: m.querySelector('[name="ev"]').value };
      return api('finp_costo_conciliar', b).then(function () { toast('Conciliación guardada. La compra original no se modificó.'); alListo(); });
    }, 'Guardar conciliación');
  }
  function quitarConciliacion(loteId, alListo) {
    modal('Quitar conciliación', '<p class="fz-sub">Se quita el vínculo/cobertura anotados. La compra original sigue igual; el cambio queda en el historial.</p><div class="fz-form"><label class="w2">Motivo<input name="mo" maxlength="200"></label></div>', function (m) {
      return api('finp_costo_conciliar_quitar', { loteId: loteId, motivo: m.querySelector('[name="mo"]').value }).then(function () { toast('Conciliación quitada.'); alListo(); });
    }, 'Quitar');
  }
  function csvConciliacion(x) {
    var cc = x.compras || { filas: [] }, q = function (v) { var t = String(v == null ? '' : v); if (/^[=+\-@]/.test(t)) t = "'" + t; return /[",;\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    var rows = [['Fecha', 'Activación', 'Producto', 'Cantidad', 'Unidad', 'Cantidad no acreditada', 'Moneda', 'Monto', 'Tasa', 'Costo L', 'Pago', 'Cuenta', 'Plan real', 'Producto ≠ plan', 'Vínculo', 'Relación con el período', 'Imputado L', 'Cobertura documentada', 'Evidencia', 'Propuesta', 'Compra (ID corto)']].concat(cc.filas.map(function (c) {
      return [c.fecha, c.fechaActivacion, c.producto, c.cantidad, c.unidad, c.cantidadNoAcreditada ? 'Sí' : '', c.moneda, c.montoMoneda, c.tasa, c.costoHnl, c.pago, c.correo, c.plan, c.productoPlanDistinto ? 'Sí' : '', VINC_TXT[c.vinculo] || c.vinculo, c.relacionTxt, c.imputadoHnl, c.ciclo ? c.ciclo.desde + ' → ' + c.ciclo.hasta : '', c.ciclo ? c.ciclo.evidencia : '', c.propuesta && c.propuesta.correo ? c.propuesta.correo : c.propuesta && c.propuesta.ambigua ? 'ambigua' : '', String(c.loteId).slice(-8)];
    }));
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(function (r) { return r.map(q).join(','); }).join('\n')], { type: 'text/csv;charset=utf-8' })); a.download = 'Sublichat_Conciliacion_' + x.plataforma + '_' + x.desde + '_' + x.hasta + '.csv'; a.click();
  }
  function abrirPlataforma(plat) {
    var r = ganRango(), filtro = { vista: 'cuentas', sinMov: false, costoPend: false, vendedor: '', estado: '', q: '' }, datos = null;
    var mm = modal('Cuentas · cargando…', '<div class="fz-vacio-s"><span class="fz-spin"></span> Cargando cuentas, clientes y cobros…</div>'); mm.classList.add('ancho');
    function dibujar() {
      var b = mm.querySelector('.fz-modal-b'), h3 = mm.querySelector('.fz-modal-h h3'); if (!b) return;
      var x = datos, pr = x.plataformaResumen || {}, cr = x.cartera.resumen;
      if (h3) h3.textContent = 'Cuentas · ' + x.nombre;
      var tabs = '<div class="fz-filtros">' + [['cuentas', 'Cuentas y accesos (' + x.cuentas.length + ')'], ['cartera', 'Cartera vs. cobros (' + x.cartera.filas.length + ')'], ['compras', 'Compras y conciliación (' + ((x.compras || {}).filas || []).length + ')']].map(function (t) { return '<button type="button" class="' + (filtro.vista === t[0] ? 'on' : '') + '" data-pv="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
      var mini = '<div class="fz-mini" style="margin-top:10px"><div><small>Cobrado</small><b>' + L(pr.cobradoHnl || 0) + '</b></div><div><small>Altas / renov.</small><b>' + (pr.altas || 0) + ' / ' + (pr.renovaciones || 0) + '</b></div><div><small>Costo</small><b>' + (pr.costoHnl > 0 ? L(pr.costoHnl) : 'Pendiente') + '</b></div><div><small>Cobertura</small><b>' + P(pr.coberturaCostos) + '</b></div></div>';
      var cuerpo;
      if (filtro.vista === 'cuentas') {
        var q = filtro.q.toLowerCase();
        var f = x.cuentas.filter(function (c) { return (!filtro.sinMov || c.sinMovimiento) && (!filtro.costoPend || (!c.conCosto && c.cobradoHnl > 0)) && (!filtro.ec || c.estadoCosto === filtro.ec) && (!q || c.correo.toLowerCase().indexOf(q) >= 0); });
        var cuentaEC = {}; x.cuentas.forEach(function (c) { cuentaEC[c.estadoCosto] = (cuentaEC[c.estadoCosto] || 0) + 1; });
        cuerpo = '<div class="fz-form in" style="margin-top:10px"><label>Buscar correo<input data-pq value="' + esc(filtro.q) + '"></label><label class="fz-chk"><input type="checkbox" data-pf="sinMov"' + (filtro.sinMov ? ' checked' : '') + '> Ver sin movimiento</label><label class="fz-chk"><input type="checkbox" data-pf="costoPend"' + (filtro.costoPend ? ' checked' : '') + '> Ver costos pendientes</label><label>Estado del costo<select data-pec><option value="">Todos</option>' + Object.keys(x.estadosCosto || {}).map(function (k) { return '<option value="' + k + '"' + (filtro.ec === k ? ' selected' : '') + '>' + esc(x.estadosCosto[k]) + ' (' + (cuentaEC[k] || 0) + ')</option>'; }).join('') + '</select></label></div>' +
          (f.length ? '<div class="fz-tw" style="margin-top:8px"><table class="fz-t"><thead><tr><th>Cuenta / acceso</th><th class="c">Ocupados</th><th class="n">Clientes</th><th class="n">Altas</th><th class="n">Renov.</th><th class="n">Cobrado</th><th class="n">Esperado</th><th class="n">Costo</th><th class="n">Resultado</th><th></th></tr></thead><tbody>' +
            f.slice(0, 400).map(function (c) { return '<tr><td><b>' + esc(c.correo || c.cuentaId) + '</b><small>' + (c.acceso === 'acceso_individual' ? 'Acceso individual' + (c.proveedor ? ' · ' + esc(c.proveedor) : '') : 'Cuenta madre') + (c.plan ? ' · ' + esc(c.plan) : '') + (c.planSinClasificar ? ' · <span class="fz-pend">plan sin clasificar</span>' : '') + '</small></td><td class="c">' + c.ocupados + '/' + c.capacidad + '</td><td class="n">' + c.clientes + '</td><td class="n">' + c.altas + '</td><td class="n">' + c.renovaciones + '</td><td class="n">' + L(c.cobradoHnl) + '</td><td class="n">' + L(c.esperadoHnl) + '</td><td class="n">' + costoCeldaG(c) + '</td><td class="n">' + (c.resultadoHnl == null ? '—' : L(c.resultadoHnl)) + '</td><td class="c"><button type="button" class="fz-btn sec sm" data-pc="' + esc(c.cuentaId) + '">Ver clientes</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="fz-vacio-s">' + (x.cuentas.length ? 'Ninguna cuenta cumple el filtro.' : 'Esta plataforma no tiene cuentas madre ni accesos registrados: sus ventas se ven en «Cartera vs. cobros».') + '</div>');
      } else if (filtro.vista === 'compras') {
        cuerpo = comprasConciliacionHtml(x, filtro);
      } else {
        var f2 = x.cartera.filas.filter(function (c) { return !filtro.estado || c.estado === filtro.estado || (filtro.estado === 'aviso' && c.avisos.length); });
        cuerpo = '<div class="fz-mini" style="margin-top:10px"><div><small>Servicios vigentes al ' + fecha(cr.corte) + '</small><b>' + cr.serviciosVigentes + '</b></div><div><small>Clientes vigentes</small><b>' + cr.clientesVigentes + '</b></div><div><small>Clientes con cobro</small><b>' + cr.clientesConCobro + '</b></div><div><small>Vigentes sin movimiento</small><b>' + cr.vigentesSinMovimiento + '</b></div></div>' +
          '<p class="fz-sub">Altas cobradas ' + cr.altas + ' · Renovaciones cobradas ' + cr.renovaciones + ' · Pendientes/parciales ' + cr.pendientesOParciales + ' · Sin cuenta madre ' + cr.sinCuenta + ' · Plan sin clasificar ' + cr.planSinClasificar + '. Un cliente vigente sin pago del mes NO suma a cobrado.</p>' +
          '<div class="fz-form in"><label>Vendedor<select data-pvend><option value="">Todos</option>' + x.vendedores.map(function (v) { return '<option' + (v === filtro.vendedor ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') + '</select></label><label>Estado<select data-pest><option value="">Todos</option>' + Object.keys(EST_CART).map(function (k) { return '<option value="' + k + '"' + (filtro.estado === k ? ' selected' : '') + '>' + EST_CART[k][0] + '</option>'; }).join('') + '<option value="aviso"' + (filtro.estado === 'aviso' ? ' selected' : '') + '>Con avisos</option></select></label></div>' +
          '<div class="fz-tw" style="margin-top:8px"><table class="fz-t"><thead><tr><th>Beneficiario</th><th>Titular</th><th>Vendedor</th><th>Cuenta</th><th class="n">Precio</th><th>Estado</th><th class="n">Cobrado</th><th>Recibos</th><th>Último cobro</th><th>Vence</th></tr></thead><tbody>' +
          f2.slice(0, 600).map(function (c) { return '<tr><td><b>' + esc(c.beneficiario || '—') + '</b>' + c.avisos.map(function (a) { return '<small class="fz-pend">' + esc(AVISO[a] || a) + '</small>'; }).join('') + '</td><td>' + esc(c.titular || '—') + '</td><td>' + esc(c.vendedor) + '</td><td>' + esc(c.cuentaCorreo || '—') + (c.perfil ? '<small>' + esc(c.perfil) + '</small>' : '') + '</td><td class="n">' + L(c.precio) + '</td><td>' + pill(EST_CART, c.estado) + '</td><td class="n">' + L(c.cobradoHnl) + (c.pendienteHnl > 0 ? '<small class="fz-pend">' + L(c.pendienteHnl) + ' pend.</small>' : '') + '</td><td>' + (c.movimientos.length ? c.movimientos.map(function (m) { return '<small>' + fecha(m.fecha) + ' · ' + esc(m.banco || '—') + ' · ' + esc(m.fuente || '') + ' · ref ' + esc(String(m.referencia).slice(-10)) + '</small>'; }).join('') : '—') + '</td><td>' + (c.ultimoCobro ? fecha(c.ultimoCobro.fecha) + '<small>' + esc(c.ultimoCobro.tipo) + ' · ' + L(c.ultimoCobro.monto) + '</small>' : '—') + '</td><td>' + fecha(c.proximaRenovacion) + '</td></tr>'; }).join('') + '</tbody></table></div>' + (x.cartera.truncado ? '<p class="fz-sub">Se muestran las primeras 1 500 filas.</p>' : '');
      }
      b.innerHTML = '<p class="fz-sub">' + fecha(x.desde) + ' → ' + fecha(x.hasta) + ' · solo lectura: aquí no se crean ventas ni se cambian cuentas o perfiles.</p>' + mini + tabs + cuerpo;
    }
    mm.addEventListener('click', function (e) { var t;
      if ((t = e.target.closest('[data-pv]'))) { filtro.vista = t.dataset.pv; dibujar(); }
      else if ((t = e.target.closest('[data-pc]'))) abrirGanCuenta(t.dataset.pc);
      else if ((t = e.target.closest('[data-concil]'))) abrirConciliar(datos, t.dataset.concil, cargarP);
      else if ((t = e.target.closest('[data-concil-quitar]'))) quitarConciliacion(t.dataset.conciliQuitar || t.dataset.concilQuitar, cargarP);
      else if ((t = e.target.closest('[data-concil-csv]'))) csvConciliacion(datos); });
    mm.addEventListener('change', function (e) { var t = e.target;
      if (t.matches('[data-pf]')) { filtro[t.dataset.pf] = t.checked; dibujar(); }
      else if (t.matches('[data-pq]')) { filtro.q = t.value; dibujar(); }
      else if (t.matches('[data-pest]')) { filtro.estado = t.value; dibujar(); }
      else if (t.matches('[data-pec]')) { filtro.ec = t.value; dibujar(); }
      else if (t.matches('[data-pcf]')) { filtro.cf = t.value; dibujar(); }
      else if (t.matches('[data-pvend]')) { filtro.vendedor = t.value; cargarP(); } });
    function cargarP() {
      api('finp_ganancias_plataforma', { plataforma: plat, desde: r.desde, hasta: r.hasta, vendedor: filtro.vendedor }).then(function (x) { datos = x; dibujar(); })
        .catch(function (e) { var b = mm.querySelector('.fz-modal-b'); if (b) b.innerHTML = '<div class="fz-vacio-s"><b>No se pudo abrir</b> ' + esc(e.message) + '</div>'; });
    }
    cargarP();
  }
  // R197c · AUDITORÍA DE CARTERA (solo lectura): cada servicio vigente o con evento en el período, clasificado sin inferir.
  // Vigente ≠ cobrado · fecha movida ≠ pago · precio de ficha ≠ ingreso. Descarga CSV enmascarado (sin teléfonos ni PIN).
  var CLASE_AUD = { alta_cobrada: ['Alta cobrada', 'ok'], renovacion_cobrada: ['Renovación cobrada', 'ok'], cobro_socios: ['Cobro por Socios', 'ok'], ajuste_sin_pago: ['Ajuste sin pago', 'gris'], renovacion_sin_cobro: ['Renovada sin cobro (por conciliar)', 'warn'], sin_movimiento: ['Sin movimiento', 'gris'], datos_insuficientes: ['Datos insuficientes', 'pend'], cobro_sin_servicio: ['Cobro sin servicio', 'pend'] };
  function abrirAuditoria() {
    var r = ganRango(), f = { plataforma: '', vendedor: '', clase: '', pagina: 1 }, x = null;
    var mm = modal('Auditoría de cartera', '<div class="fz-vacio-s"><span class="fz-spin"></span> Cruzando CRM, Control Maestro, libro y costos…</div>'); mm.classList.add('ancho');
    function dibujar() {
      var b = mm.querySelector('.fz-modal-b'); if (!b) return; var rs = x.resumen, cl = Object.keys(CLASE_AUD);
      var mini = '<div class="fz-mini"><div><small>Servicios vigentes al ' + fecha(rs.corte) + '</small><b>' + rs.serviciosVigentes + '</b></div><div><small>Vigentes con cobro en el período</small><b>' + rs.vigentesConCobro + '</b></div><div><small>Vigentes solo vigentes</small><b>' + rs.vigentesSoloVigentes + '</b></div><div><small>Cobrado a servicios</small><b>' + L(rs.cobradoServiciosHnl) + '</b></div></div>';
      var cu = rs.cuadre || {};
      var cuadre = '<p class="fz-sub">Cuadre del libro: cobros originales ' + L(cu.cobrosOriginalesHnl || 0) + ' = asignado a servicios ' + L(cu.asignadoServiciosHnl || 0) + ' + abonos ' + L(cu.abonosVentasAnterioresHnl || 0) + ' + no asignado ' + L(cu.noAsignadoHnl || 0) + ' → diferencia <b>' + L(cu.diferenciaHnl || 0) + '</b>' +
        (rs.sociosSinFicha ? ' · ' + rs.sociosSinFicha + ' pago(s) de Socios sin ficha (' + L(rs.sociosSinFichaHnl) + ')' : '') + (rs.sociosCompartidosHnl ? ' · Socios compartidos sin repartir ' + L(rs.sociosCompartidosHnl) : '') + '</p>';
      var tabla = '<div class="fz-tw"><table class="fz-t"><thead><tr><th>Plataforma</th><th class="n">Vigentes</th><th class="n">Cuentas</th><th class="n">Clientes</th><th class="n">Con cobro</th>' + cl.map(function (k) { return '<th class="n">' + esc(CLASE_AUD[k][0]) + '</th>'; }).join('') + '<th class="n">Cobrado</th><th class="n">Sin costo</th></tr></thead><tbody>' +
        x.porPlataforma.map(function (p) { return '<tr><td><b>' + esc(p.nombre) + '</b></td><td class="n">' + p.vigentes + '</td><td class="n">' + p.cuentas + '</td><td class="n">' + p.clientes + '</td><td class="n">' + p.clientesConCobro + '</td>' + cl.map(function (k) { return '<td class="n">' + (p[k] || '') + '</td>'; }).join('') + '<td class="n">' + L(p.cobradoHnl) + '</td><td class="n">' + p.sinCosto + '</td></tr>'; }).join('') + '</tbody></table></div>';
      var filtros = '<div class="fz-form in" style="margin-top:10px"><label>Plataforma<select data-af="plataforma"><option value="">Todas</option>' + (x.plataformas || x.porPlataforma).map(function (p) { return '<option value="' + esc(p.plataforma) + '"' + (p.plataforma === f.plataforma ? ' selected' : '') + '>' + esc(p.nombre) + '</option>'; }).join('') + '</select></label>' +
        '<label>Vendedor<select data-af="vendedor"><option value="">Todos</option>' + (x.vendedores || []).map(function (v) { return '<option' + (v === f.vendedor ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') + '</select></label>' +
        '<label>Clase<select data-af="clase"><option value="">Todas</option>' + cl.map(function (k) { return '<option value="' + k + '"' + (k === f.clase ? ' selected' : '') + '>' + esc(CLASE_AUD[k][0]) + ' (' + (rs.porClase[k] || 0) + ')</option>'; }).join('') + '</select></label>' +
        '<button type="button" class="fz-btn sec" data-acsv>' + ico('dl') + 'CSV enmascarado</button></div>';
      var filas = '<div class="fz-tw" style="margin-top:8px"><table class="fz-t"><thead><tr><th>Clase</th><th>Beneficiario</th><th>Titular</th><th>Vendedor</th><th>Cuenta</th><th class="n">Precio</th><th>Fecha anterior → nueva</th><th class="n">Cobrado</th><th>Movimientos</th><th>Último cobro</th><th>Faltantes</th></tr></thead><tbody>' +
        x.filas.map(function (c) {
          var k = CLASE_AUD[c.clase] || [c.clase, 'gris'];
          return '<tr><td><span class="fz-pill ' + k[1] + '">' + esc(k[0]) + '</span><small>' + esc(String(c.compraId || 'sin ID').slice(-10)) + '</small></td><td><b>' + esc(c.beneficiario || '—') + '</b></td><td>' + esc(c.titular || '—') + '</td><td>' + esc(c.vendedor) + '</td><td>' + esc(c.cuentaCorreo || '—') + (c.perfil ? '<small>' + esc(c.perfil) + '</small>' : '') + '</td><td class="n">' + L(c.precioFicha || 0) + '</td>' +
            '<td>' + (c.fechaNueva ? fecha(c.fechaAnterior) + ' → ' + fecha(c.fechaNueva) + '<small>' + esc(c.renovadoPor || '') + (c.origenRenovacion ? ' · ' + esc(c.origenRenovacion) : '') + (c.motivoAjuste ? ' · ' + esc(c.motivoAjuste) : '') + '</small>' : '—') + '</td><td class="n">' + L(c.cobradoHnl) + '</td>' +
            '<td>' + (c.movimientos.length ? c.movimientos.map(function (m) { return '<small>' + fecha(m.fecha) + ' · ' + esc(m.tipo) + ' · ' + (m.cobrado == null ? 'compartido' : L(m.cobrado)) + (m.banco ? ' · ' + esc(m.banco) : '') + ' · ref ' + esc(String(m.movimientoId).slice(-10)) + '</small>'; }).join('') : '—') + '</td>' +
            '<td>' + (c.ultimoCobro ? fecha(c.ultimoCobro.fecha) + '<small>' + esc(c.ultimoCobro.tipo) + '</small>' : '—') + '</td><td>' + c.ausencias.map(function (a) { return '<small class="fz-pend">' + esc(a) + '</small>'; }).join('') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      var pags = Math.max(1, Math.ceil(x.total / x.porPagina));
      var pag = '<div class="fz-filtros" style="margin-top:8px">' + (x.pagina > 1 ? '<button type="button" data-apag="-1">← Anterior</button>' : '') + '<span class="fz-sub">Página ' + x.pagina + ' de ' + pags + ' · ' + x.total + ' servicio(s)</span>' + (x.pagina < pags ? '<button type="button" data-apag="1">Siguiente →</button>' : '') + '</div>';
      b.innerHTML = '<p class="fz-sub">' + fecha(x.desde) + ' → ' + fecha(x.hasta) + ' · SOLO LECTURA: no crea cobros ni cambia fechas, cuentas o perfiles. «Renovada sin cobro» = por conciliar, no «impagada».</p>' + mini + cuadre + tabla + filtros + filas + pag +
        '<details><summary>Limitaciones de esta consulta</summary>' + (x.limitaciones || []).map(function (t) { return '<p class="fz-sub">' + esc(t) + '</p>'; }).join('') + '</details>';
    }
    function cargarA() {
      var b = mm.querySelector('.fz-modal-b'); if (b && x) b.style.opacity = '.55';
      api('finp_auditoria_cartera', { desde: r.desde, hasta: r.hasta, plataforma: f.plataforma, vendedor: f.vendedor, clase: f.clase, pagina: f.pagina }).then(function (j) { if (!x || !f.plataforma) j.plataformas = j.porPlataforma; else j.plataformas = x.plataformas; x = j; if (b) b.style.opacity = ''; dibujar(); })
        .catch(function (e) { var bb = mm.querySelector('.fz-modal-b'); if (bb) { bb.style.opacity = ''; bb.innerHTML = '<div class="fz-vacio-s"><b>No se pudo abrir la auditoría</b> ' + esc(e.message) + '</div>'; } });
    }
    mm.addEventListener('change', function (e) { var t = e.target; if (t.matches('[data-af]')) { f[t.dataset.af] = t.value; f.pagina = 1; cargarA(); } });
    mm.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-apag]'))) { f.pagina = Math.max(1, f.pagina + Number(t.dataset.apag)); cargarA(); }
      else if ((t = e.target.closest('[data-acsv]'))) {
        var btn = t; btn.disabled = true;
        api('finp_auditoria_cartera', { desde: r.desde, hasta: r.hasta, plataforma: f.plataforma, vendedor: f.vendedor, clase: f.clase, formato: 'csv' }).then(function (j) {
          var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + j.csv], { type: 'text/csv;charset=utf-8' })); a.download = 'Sublichat_Auditoria_' + r.desde + '_' + r.hasta + (f.plataforma ? '_' + f.plataforma : '') + '.csv'; a.click();
          toast('CSV enmascarado: ' + j.filas + ' fila(s).');
        }).catch(function (e2) { toast(e2.message, true); }).then(function () { btn.disabled = false; });
      }
    });
    cargarA();
  }
  function ganCuentas(g) {
    var fp = st.ganF.plat, q = (st.ganF.cuentas || '').toLowerCase();
    var plats = []; (g.cuentas || []).forEach(function (c) { if (plats.indexOf(c.plataforma) < 0) plats.push(c.plataforma); });
    var f = (g.cuentas || []).filter(function (c) { return (!fp || c.plataforma === fp) && (!q || String(c.correo).toLowerCase().indexOf(q) >= 0); });
    return '<div class="fz-card"><div class="fz-cab">' + ico('users') + '<h3>Cuentas madre y accesos</h3><span class="fz-sub r">' + f.length + ' de ' + (g.cuentas || []).length + '</span></div>' +
      '<div class="fz-form in"><label>Plataforma<select data-fz-ganf="plat"><option value="">Todas</option>' + plats.map(function (p) { var x = (g.porPlataforma || []).find(function (y) { return y.plataforma === p; }); return '<option value="' + esc(p) + '"' + (p === fp ? ' selected' : '') + '>' + esc(x ? x.nombre : p) + '</option>'; }).join('') + '</select></label><label>Buscar correo<input data-fz-ganf="cuentas" value="' + esc(st.ganF.cuentas || '') + '" placeholder="correo de la cuenta"></label></div>' +
      (f.length ? '<div class="fz-tw" style="margin-top:10px"><table class="fz-t"><thead><tr><th>Cuenta</th><th class="n">Clientes</th><th class="n">Cobrado</th><th class="n">Pendiente</th><th class="n">Esperado</th><th class="n">Costo</th><th class="n">Resultado</th><th></th></tr></thead><tbody>' +
        f.slice(0, 300).map(function (c) { return '<tr><td><b>' + esc(c.correo || c.cuentaId) + '</b><small>' + esc(c.nombre) + '</small></td><td class="n">' + c.clientes + '</td><td class="n">' + L(c.cobradoHnl) + '</td><td class="n">' + L(c.pendienteHnl) + '</td><td class="n">' + L(c.esperadoHnl) + '</td><td class="n">' + (c.costoHnl > 0 ? L(c.costoHnl) : '<span class="fz-pend">Costo pendiente</span>') + '</td><td class="n">' + (c.resultadoHnl == null ? '—' : '<b class="' + (c.resultadoHnl >= 0 ? 'vd' : 'rj') + '">' + L(c.resultadoHnl) + '</b>') + '</td><td class="c"><button type="button" class="fz-btn sec sm" data-fz-gancta="' + esc(c.cuentaId) + '">Ver clientes</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="fz-vacio-s">Sin cuentas con movimiento en este período.</div>') + '</div>';
  }
  function ganBandeja(g) {
    var c = g.bandejaConteo || {}, b = g.bandeja || [];
    return '<div class="fz-card fz-alertas"><div class="fz-cab">' + ico('alert', 'am') + '<h3>Bandeja de conciliación</h3><span class="fz-badge">' + b.length + '</span></div>' +
      '<div class="fz-hojas">' + Object.keys(BAND).map(function (k) { return '<span class="fz-chip">' + BAND[k] + ': ' + (c[k] || 0) + '</span>'; }).join('') + '</div>' +
      (g.costeo && !g.costeo.activo ? '<p class="fz-sub">El cálculo de consumo (créditos y licencias) no tiene fecha de inicio: esos costos se toman por lote hasta activarlo.</p>' : '') +
      (b.length ? b.slice(0, 60).map(function (x) { return '<div class="fz-alerta warn"><div><b>' + esc(BAND[x.tipo] || x.tipo) + '</b><span>' + [esc(x.texto), esc(x.beneficiario || ''), x.fecha ? fecha(x.fecha) : '', L(x.monto)].filter(Boolean).join(' · ') + '</span></div></div>'; }).join('') : '<div class="fz-ok">Todo conciliado en este período.</div>') +
      '<p class="fz-sub">Nada se inventa ni se corrige solo: aquí se ve lo que falta para que el resultado sea completo.</p></div>';
  }
  // R198j · GANANCIA POR CUENTA (regla del dueño): lo que pagué por la cuenta vs. lo que me pagan sus clientes.
  // Activación: se paga una vez y cubre la cuenta hasta la próxima → todo lo que pagan los clientes cada mes es ganancia.
  async function cargarRent(forzar) {
    if (st.rent && !forzar) return; st.rent = { cargando: true };
    try { st.rent = await api('finp_rentabilidad', {}); } catch (e) { st.rent = { error: e.message }; }
    if (st.tab === 'ganancias') pintar();
  }
  function compraTxt(k) {
    if (!k) return '<span class="fz-pend">Sin pago registrado</span>';
    return '<b>' + L(k.costoHnl) + '</b><small>' + (k.tipo === 'activacion' ? '' : k.tipo === 'mensual' ? 'Mensual · desde ' : 'Pagada ') + fecha(k.fecha) + (k.moneda === 'USDT' ? ' · ' + esc(k.montoMoneda) + ' USDT' : '') + (k.tipo === 'activacion' ? ' · activación' : '') + (k.tipo === 'vigencia' ? ' · ' + k.dias + ' días (L' + Math.round(k.costoMensualHnl) + '/mes)' : '') + '</small>';
  }
  function ganPorCuenta() {
    var x = st.rent;
    if (!x || x.cargando) { cargarRent(); return '<div class="fz-card fz-vacio"><span class="fz-spin"></span><b>Calculando la ganancia de cada cuenta…</b></div>'; }
    if (x.error) return '<div class="fz-card fz-vacio"><b>No se pudo calcular la ganancia por cuenta</b><span>' + esc(x.error) + '</span><button type="button" class="fz-btn" data-fz-rentre="1">Reintentar</button></div>';
    var t = x.total || {};
    function k(tit, val, nota) { return '<div class="fz-card fz-kpi"><div><small>' + tit + '</small><strong>' + val + '</strong>' + (nota ? '<em class="fz-nota">' + nota + '</em>' : '') + '</div></div>'; }
    return '<div class="fz-kpis">' +
      k('Me pagan los clientes al mes', L(t.meMensualHnl), t.perfiles + ' perfil(es) en ' + t.cuentas + ' cuenta(s)') +
      k('Ganancia neta al mes', '<span class="vd">' + L(t.gananciaMesHnl) + '</span>', 'Lo que pagan los clientes menos lo que cuesta la cuenta cada mes (la activación se paga una sola vez)') +
      k('Ganancia desde ' + fecha(x.desdeControl || '2026-10-01'), '<span class="' + (t.gananciaDesdeCompraHnl >= 0 ? 'vd' : 'rj') + '">' + L(t.gananciaDesdeCompraHnl) + '</span>', 'Solo octubre en adelante: cuota de cada cliente por los días desde el 01/10 − la parte de cada compra que cae en ese período') +
      k('Cuentas sin pago registrado', t.sinCompra ? '<span class="rj">' + t.sinCompra + '</span>' : '0', t.sinCompra ? 'Cobran ' + L(t.sinCompraMensualHnl) + ' al mes: registre cuánto pagó para ver su ganancia' : 'Todas tienen su pago') + '</div>' +
      '<div class="fz-card"><div class="fz-cab">' + ico('layers') + '<h3>Ganancia por cuenta</h3><span class="fz-sub r">Calculado desde ' + fecha(x.desdeControl || '2026-10-01') + ' · lo que pagué por la cuenta vs. lo que pagan sus clientes</span></div>' +
      '<div class="fz-tw"><table class="fz-t"><thead><tr><th>Plataforma</th><th class="n">Cuentas</th><th class="n">Perfiles</th><th class="n">Me pagan al mes</th><th class="n">Pagué (última compra)</th><th class="n">Ganancia neta al mes</th><th class="n">Ganancia desde ' + fecha(x.desdeControl || '2026-10-01') + '</th><th></th></tr></thead><tbody>' +
      (x.plataformas || []).map(function (p) { return '<tr><td><div class="fz-prod">' + logo(p.nombre) + '<b>' + esc(p.nombre) + '</b></div>' + (p.sinCompra ? '<small class="fz-pend">' + p.sinCompra + ' cuenta(s) sin pago registrado</small>' : '') + (p.vacias ? '<small class="fz-pend">' + p.vacias + ' cuenta(s) sin clientes</small>' : '') + '</td><td class="n">' + p.cuentas + '</td><td class="n">' + p.perfiles + (p.libres ? '<small>' + p.libres + ' libre(s)</small>' : '') + '</td><td class="n"><b>' + L(p.meMensualHnl) + '</b></td><td class="n">' + L(p.pagueHnl) + '</td><td class="n"><b class="' + (p.gananciaMesHnl >= 0 ? 'vd' : 'rj') + '">' + L(p.gananciaMesHnl) + '</b></td><td class="n"><b class="' + (p.gananciaDesdeCompraHnl >= 0 ? 'vd' : 'rj') + '">' + L(p.gananciaDesdeCompraHnl) + '</b></td><td class="c"><button type="button" class="fz-btn sec sm" data-fz-rentplat="' + esc(p.plataforma) + '">Ver cuentas</button></td></tr>'; }).join('') +
      '</tbody></table></div><p class="fz-sub">Cuenta por activación (link): se paga una vez y la cuenta sigue hasta la próxima activación; todo lo que pagan los clientes después es ganancia. Cuenta con vigencia (30 días, mensual): su costo se resta cada mes. Una cuenta sin pago registrado no se calcula: no se inventan costos.</p></div>';
  }
  var EST_RENT = { ganando: ['Ganando', 'ok'], por_recuperar: ['Por recuperar', 'warn'], vacia: ['Sin clientes', 'warn'], sin_compra: ['Sin pago registrado', 'pend'] };
  function abrirRentPlat(plat) {
    var mm = modal('Ganancia por cuenta', '<div class="fz-vacio-s"><span class="fz-spin"></span> Cargando…</div>'); mm.classList.add('ancho');
    api('finp_rentabilidad', { plataforma: plat }).then(function (x) {
      var b = mm.querySelector('.fz-modal-b'); if (!b) return; var h = mm.querySelector('.fz-modal-h h3, .fz-modal-h b'); if (h) h.textContent = 'Ganancia por cuenta · ' + x.nombre;
      var p = (x.plataformas || [])[0] || {};
      b.innerHTML = '<div class="fz-mini"><div><small>Me pagan al mes</small><b>' + L(p.meMensualHnl) + '</b></div><div><small>Pagué (últimas compras)</small><b>' + L(p.pagueHnl) + '</b></div><div><small>Ganancia neta al mes</small><b class="vd">' + L(p.gananciaMesHnl) + '</b></div><div><small>Ganancia desde ' + fecha(x.desdeControl || '2026-10-01') + '</small><b class="' + (p.gananciaDesdeCompraHnl >= 0 ? 'vd' : 'rj') + '">' + L(p.gananciaDesdeCompraHnl) + '</b></div></div>' +
        '<div class="fz-tw" style="margin-top:10px"><table class="fz-t"><thead><tr><th>Cuenta</th><th class="c">Perfiles</th><th class="n">Pagué</th><th class="n">Me pagan /mes</th><th class="n">Ganancia /mes</th><th class="n">Desde ' + fecha(x.desdeControl || '2026-10-01') + '</th></tr></thead><tbody>' +
        x.cuentas.map(function (c) {
          var det = c.perfiles.length ? '<tr class="fz-rent-det"><td colspan="6"><details><summary>Ver ' + c.perfiles.length + ' cliente(s) de ' + esc(c.correo) + (c.registradoCajaHnl != null ? ' · registrado en caja desde la activación: ' + L(c.registradoCajaHnl) : '') + '</summary><table class="fz-t"><thead><tr><th>Perfil</th><th>Cliente</th><th class="n">Paga al mes</th><th>Desde</th><th class="c">Meses desde 01/10</th><th>Pagado hasta</th><th class="n">Estimado</th></tr></thead><tbody>' + c.perfiles.map(function (q) { return '<tr><td>' + esc(q.perfil) + '</td><td><b>' + esc(q.cliente || '—') + '</b></td><td class="n">' + L(q.cuotaMesHnl) + '</td><td>' + fecha(q.inicio) + '</td><td class="c">' + q.mesesPagados + '</td><td>' + fecha(q.vence) + '</td><td class="n">' + L(q.estimadoHnl) + '</td></tr>'; }).join('') + '</tbody></table></details></td></tr>' : '';
          return '<tr><td><b>' + esc(c.correo) + '</b><small>' + (c.plan ? esc(c.plan) + ' · ' : '') + (c.completa ? 'CUENTA COMPLETA' : 'Perfiles') + '</small>' + (c.estado === 'vacia' || c.estado === 'por_recuperar' ? pill(EST_RENT, c.estado) : '') + '</td><td class="c">' + c.ocupados + '/' + c.capacidad + (c.libres ? '<small>' + c.libres + ' libre(s)</small>' : '') + '</td><td class="n">' + compraTxt(c.compra) + '</td><td class="n"><b>' + L(c.meMensualHnl) + '</b></td><td class="n">' + (c.gananciaMesHnl == null ? '<span class="fz-pend">Registre el pago</span>' : '<b class="' + (c.gananciaMesHnl >= 0 ? 'vd' : 'rj') + '">' + L(c.gananciaMesHnl) + '</b>') + '</td><td class="n">' + (c.gananciaDesdeCompraHnl == null ? '—' : '<b class="' + (c.gananciaDesdeCompraHnl >= 0 ? 'vd' : 'rj') + '">' + L(c.gananciaDesdeCompraHnl) + '</b>') + '</td></tr>' + det;
        }).join('') + '</tbody></table></div><p class="fz-sub">La ganancia se calcula solo desde ' + fecha(x.desdeControl || '2026-10-01') + ': cuota de cada cliente por los días pagados desde esa fecha − la parte de cada compra que cae en el período (una compra anual cuenta solo sus días de oct–nov; una activación pagada antes de octubre no se vuelve a restar). «Registrado en caja» es lo que de verdad quedó anotado como cobrado; si es menor, faltan cobros por registrar.</p>';
    }).catch(function (e) { var b = mm.querySelector('.fz-modal-b'); if (b) b.textContent = e.message; });
  }
  function vGanancias(d) {
    return ganPorCuenta() + '<details class="fz-card fz-avz"><summary><b>Detalle contable por mes (avanzado)</b> <small>cobros, costos del período, cartera y conciliación</small></summary>' + vGananciasDetalle(d) + '</details>';
  }
  function vGananciasDetalle(d) {
    var g = st.gan[ganClave()];
    if (!g || g.cargando) { cargarGan(); return ganPeriodo(null) + '<div class="fz-card fz-vacio"><span class="fz-spin"></span><b>Calculando ganancias con ventas, cobros y compras…</b></div>'; }
    if (g.error) return ganPeriodo(null) + '<div class="fz-card fz-vacio"><b>No se pudo calcular</b><span>' + esc(g.error) + '</span><button type="button" class="fz-btn" data-fz="ganrecargar">Reintentar</button></div>';
    var vend = (g.vendedores || []).slice(0, 10);
    return ganKpis(g) + ganPeriodo(g) + ganDefs(g) + ganPlataformas(g) + '<div class="fz-g2 b">' + ganCuentas(g) + ganBandeja(g) + '</div>' +
      '<div class="fz-card"><div class="fz-cab">' + ico('trophy') + '<h3>Por vendedor</h3></div>' + (vend.length ? vend.map(function (v) { return '<div class="fz-lin"><div><b>' + esc(v.vendedor) + '</b><small>' + v.ventas + ' servicio(s)</small></div><strong>' + L(v.cobradoHnl) + '</strong></div>'; }).join('') : '<div class="fz-vacio-s">Sin ventas.</div>') + '</div>' +
      '<p class="fz-pie">Resultado = ingresos cobrados − costos directos asignados al período. Los pagos a proveedores (caja) se muestran aparte y no se descuentan dos veces. Una renovación programada no cuenta como cobrada. Activaciones sin vigencia: un desembolso en su fecha (no se inventan meses). Gastos operativos van en Egresos/Cierre.</p>';
  }
  function abrirGanCuenta(id) {
    var r = ganRango();
    var mm = modal('Cuenta · detalle financiero', '<div class="fz-vacio-s"><span class="fz-spin"></span> Cargando…</div>'); mm.classList.add('ancho');
    api('finp_ganancias_cuenta', { cuentaId: id, desde: r.desde, hasta: r.hasta }).then(function (x) {
      var c = x.cuenta, b = mm.querySelector('.fz-modal-b'); if (!b) return;
      var cab = '<div class="fz-cuenta-ro"><small>' + esc(c.nombre) + (c.plan ? ' · ' + esc(c.plan) : '') + ' · ' + c.ocupados + '/' + c.capacidad + ' ocupados · ' + c.disponibles + ' libres</small><b>' + esc(c.correo) + '</b><span>' + fecha(r.desde) + ' → ' + fecha(r.hasta) + '</span></div>';
      var mini = '<div class="fz-mini" style="margin-top:10px"><div><small>Cobrado</small><b>' + L(c.cobradoHnl) + '</b></div><div><small>Pendiente</small><b>' + L(c.pendienteHnl) + '</b></div><div><small>Esperado</small><b>' + L(c.esperadoHnl) + '</b></div><div><small>Costo del período</small><b>' + (c.costos.length ? L(c.costoPeriodoHnl) : c.estadoCosto === 'ciclo_vigente' ? 'L0 · ya pagado' : 'Sin atribuir') + '</b></div></div>' + (c.estadoCosto ? '<div class="fz-defs"><p><span class="fz-pill ' + (EC_PILL[c.estadoCosto] || 'gris') + '">' + esc(c.estadoCostoTxt) + '</span> ' + esc(c.motivoCosto || '') + (c.historicoNoImputadoHnl > 0 ? ' Costo histórico no imputado a este período: <b>' + L(c.historicoNoImputadoHnl) + '</b>.' : '') + '</p></div>' : '') +
        '<p class="fz-sub">Resultado del período: <b>' + (c.resultadoPeriodoHnl == null ? 'No calculable (sin costo atribuido)' : L(c.resultadoPeriodoHnl, true)) + '</b>' + (c.margen != null ? ' · margen ' + P(c.margen) : '') + (c.costoCicloHnl != null && c.estadoCosto === 'atribuido' && !c.cicloActual ? ' · Resultado del ciclo de la última compra (' + L(c.costoCicloHnl, true) + '): <b>' + L(c.resultadoCicloHnl, true) + '</b>' : '') + '</p>';
      var k = c.cicloActual; if (k) mini += '<div class="fz-defs"><p><b>Ciclo de activación actual</b> · activada el ' + fecha(k.fechaActivacion) + ' por <b>' + L(k.costoHnl) + '</b>' + (k.moneda === 'USDT' ? ' (' + esc(k.montoMoneda) + ' USDT × ' + esc(k.tasa) + ')' : '') + ' · cobrado desde entonces hasta ' + fecha(k.hastaFecha) + ': <b>' + L(k.cobradoHnl) + '</b> (' + k.cobros + ' cobro(s), ' + k.clientes + ' cliente(s)) · resultado del ciclo: <b class="' + (k.resultadoHnl >= 0 ? 'vd' : 'rj') + '">' + L(k.resultadoHnl, true) + '</b> · ' + (k.recuperado ? 'costo recuperado' : 'costo aún no recuperado') + '. Sigue cubierta hasta la próxima activación.</p></div>';
      var per = '<div class="fz-tw"><table class="fz-t"><thead><tr><th>Perfil</th><th>Beneficiario</th><th>Titular de ficha</th><th>Vendedor</th><th class="n">Precio</th><th>Última venta</th><th>Vence</th><th class="n">Cobrado</th><th class="n">Pendiente</th><th class="n">Esperado</th></tr></thead><tbody>' +
        c.perfiles.map(function (p) { return '<tr><td>' + esc(p.perfil) + '</td><td><b>' + esc(p.beneficiario || '—') + '</b></td><td>' + esc(p.titular || '—') + '</td><td>' + esc(p.vendedor) + '</td><td class="n">' + (p.precio == null ? '—' : L(p.precio)) + '</td><td>' + (p.ultimaVenta ? fecha(p.ultimaVenta) + '<small>' + esc(p.ultimoTipo) + '</small>' : '—') + '</td><td>' + fecha(p.proximoVencimiento) + '</td><td class="n">' + L(p.cobradoHnl) + (p.descuentoHnl > 0 ? '<small class="fz-pend">descuento ' + L(p.descuentoHnl) + '</small>' : '') + (p.recibos || []).map(function (rc) { return '<small>' + fecha(rc.fecha) + ' · ' + esc(rc.banco || '—') + ' · ' + esc(rc.fuente || '') + (rc.combo ? ' · combo' : '') + '</small>'; }).join('') + '</td><td class="n">' + L(p.pendienteHnl) + '</td><td class="n">' + L(p.esperadoHnl) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      var cos = c.costos.length ? '<div class="fz-tw"><table class="fz-t"><thead><tr><th>Compra</th><th>Regla</th><th class="n">Costo del período</th><th>Criterio</th></tr></thead><tbody>' + c.costos.map(function (k) { return '<tr><td>' + esc(k.producto) + '<small>' + (k.fechaCompra ? fecha(k.fechaCompra) : '') + (k.moneda && k.moneda !== 'HNL' ? ' · ' + esc(k.montoMoneda) + ' ' + esc(k.moneda) + ' × ' + esc(k.tasa) : '') + '</small></td><td>' + esc(REGLA[k.regla] || k.regla) + '</td><td class="n">' + L(k.costoHnl, true) + '</td><td><small>' + esc(k.criterio) + '</small></td></tr>'; }).join('') + '</tbody></table></div>' : (c.estadoCosto === 'ciclo_vigente' ? '<p class="fz-sub">Sin costo nuevo en este período: la cuenta está cubierta por su activación (ver «Ciclo de activación actual»).</p>' : '<p class="fz-pend">' + (c.estadoCosto === 'cobertura_desconocida' ? 'Sin costo atribuido a este período: la compra anterior no tiene duración documentada (ver abajo).' : c.estadoCosto === 'fuera_periodo' ? 'Sus compras no cubren este período.' : 'Costo pendiente: esta cuenta no tiene compra registrada.') + '</p>');
      var compras = c.compras.length ? c.compras.map(function (k) { return '<div class="fz-lin"><div><b>' + esc(k.producto) + '</b><small>Pago ' + fecha(k.fecha) + (k.fechaActivacion ? ' · activación ' + fecha(k.fechaActivacion) : '') + ' · ' + esc(k.montoMoneda) + ' ' + esc(k.moneda) + (k.moneda !== 'HNL' ? ' × ' + esc(k.tasa) : '') + ' · ' + esc(k.pago) + '</small>' + (k.relacionTxt ? '<small><span class="fz-pill ' + (REL_PILL[k.relacion] || 'gris') + '">' + esc(k.relacionTxt) + '</span>' + (k.imputadoHnl > 0 ? ' · imputado ' + L(k.imputadoHnl) : '') + (k.vinculo === 'conciliado' ? ' · conciliada' : '') + (k.cantidadNoAcreditada ? ' · «' + esc(k.cantidad + ' ' + k.unidad) + '» no acreditado' : '') + '</small>' : '') + (k.ciclo ? '<small>Cobertura documentada ' + fecha(k.ciclo.desde) + ' → ' + fecha(k.ciclo.hasta) + ' · ' + esc(k.ciclo.evidencia) + '</small>' : '') + '</div><strong>' + L(k.costoHnl, true) + '</strong></div>'; }).join('') : '<div class="fz-vacio-s">Sin compras vinculadas a esta cuenta.</div>';
      var movs = c.lineas.length ? c.lineas.map(function (l) { return '<div class="fz-lin"><div><b>' + esc(l.beneficiario) + '</b><small>' + fecha(l.fecha) + ' · ' + esc(l.tipo) + (l.combo ? ' · parte de un combo' : '') + ' · ref ' + esc(String(l.referencia).slice(-12)) + '</small></div><strong>' + L(l.cobrado, true) + (l.pendiente > 0 ? '<small class="fz-pend">' + L(l.pendiente, true) + ' pendiente</small>' : '') + '</strong></div>'; }).join('') : '<div class="fz-vacio-s">Sin cobros en el período.</div>';
      b.innerHTML = cab + mini + '<h4>Clientes y beneficiarios</h4>' + per + '<h4>Costos asignados</h4>' + cos + '<h4>Compras de proveedor vinculadas</h4>' + compras + '<details><summary>Movimientos que explican el ingreso</summary>' + movs + '</details>';
    }).catch(function (e) { var b = mm.querySelector('.fz-modal-b'); if (b) b.textContent = e.message; });
  }
  // R200c · Libro Excel financiero (9 hojas): mismo motor que esta pantalla, mes por mes. Tablas con filtros, Panel con
  // selectores de Mes y Plataforma (fórmulas), vínculos internos y gráficos nativos. Sin teléfonos, PIN ni claves.
  async function excelFinanciero(btn) {
    if (!window.ExcelJS || !window.SublichatExcelFinanciero) { toast('No cargó el generador de Excel. Recargue la página.', true); return; }
    var r = ganRango(); var desde = String(r.desde).slice(0, 7) + '-01', hasta = r.hasta;
    var n = (Number(hasta.slice(0, 4)) - Number(desde.slice(0, 4))) * 12 + Number(hasta.slice(5, 7)) - Number(desde.slice(5, 7)) + 1;
    if (n === 1) { var d0 = new Date(Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 12, 1)); desde = d0.toISOString().slice(0, 10); n = 12; } // un solo mes elegido → los 12 meses que terminan en él (hoja de evolución)
    if (n > 13) { toast('El libro admite hasta 13 meses. Elija un rango más corto.', true); return; }
    btn.disabled = true; var t0 = btn.innerHTML; btn.textContent = 'Generando libro…';
    try {
      var x = await api('finp_excel_financiero', { desde: desde, hasta: hasta });
      var buf = await window.SublichatExcelFinanciero.generar(x, { ExcelJS: window.ExcelJS, JSZip: window.JSZip, avisar: function (m) { toast(m, true); } }, { mes: (st.mes || '').slice(0, 7) });
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = 'Sublichat_Finanzas_' + desde.slice(0, 7) + '_a_' + hasta.slice(0, 7) + '.xlsx'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      toast('Libro listo: 9 hojas' + (x.truncado ? ' (detalle recortado a 20 000 filas por hoja)' : '') + '.');
    } catch (e) { toast(e.message, true); }
    btn.disabled = false; btn.innerHTML = t0;
  }
  async function ganExcel(btn) {
    if (!window.ExcelJS) { toast('No cargó el generador de Excel. Recargue la página.', true); return; }
    btn.disabled = true; var t0 = btn.innerHTML; btn.textContent = 'Generando…';
    try {
      var r = ganRango(); var x = await api('finp_ganancias_excel', { desde: r.desde, hasta: r.hasta });
      var wb = new window.ExcelJS.Workbook(); var ws = wb.addWorksheet('Detalle de ganancias', { views: [{ state: 'frozen', ySplit: 1 }] });
      var cols = x.filas.length ? Object.keys(x.filas[0]) : ['Fecha'];
      ws.columns = cols.map(function (k) { return { header: k, key: k, width: Math.max(12, Math.min(30, k.length + 6)) }; });
      x.filas.forEach(function (f) { ws.addRow(f); });
      var h = ws.getRow(1); h.font = { bold: true, color: { argb: 'FFFFFFFF' } }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2231A' } };
      ['Ingreso cobrado', 'Ingreso pendiente', 'Costo imputado'].forEach(function (k) { var i = cols.indexOf(k); if (i >= 0) ws.getColumn(i + 1).numFmt = '"L"#,##0.00'; });
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
      var buf = await wb.xlsx.writeBuffer(); var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = 'Sublichat_Ganancias_' + r.desde + '_' + r.hasta + '.xlsx'; a.click();
      toast('Excel listo' + (x.truncado ? ' (primeras 20 000 filas)' : '') + '.');
    } catch (e) { toast(e.message, true); }
    btn.disabled = false; btn.innerHTML = t0;
  }
  function notaCosteo(d) {
    var k = d.kpis; return '<p class="fz-pie">Ganancia = ingresos con costo registrado − costo asignado (PEPS) de esas ventas. ' + (k.ventasSinCosto ? k.ventasSinCosto + ' venta(s) quedan «Pendiente de costo» y no entran al margen. ' : '') + 'No incluye gastos operativos: esos van en Egresos/Cierre.</p>';
  }
  function vResumen(d) {
    var v = d.vip || {}, pv = v.porProveedor || {};
    var vip = '<div class="fz-card"><div class="fz-cab">' + logo('Netflix') + '<h3>Netflix VIP alquilado</h3><button type="button" class="fz-btn sec sm" data-fz-tab="compras" data-sub="vip">Abrir lista</button></div><div class="fz-mini">' +
      [['Trap', pv.trap], ['Deku', pv.deku], ['Propios', pv.propio], ['Sin proveedor', pv.sin]].map(function (x) { return '<div><small>' + x[0] + '</small><b>' + (x[1] || 0) + '</b></div>'; }).join('') + '</div><p class="fz-sub">' + (v.proximos7 || 0) + ' con cobro del proveedor en 7 días · ' + (v.lotes || 0) + ' lotes pagados registrados</p></div>';
    var compras = '<div class="fz-card"><div class="fz-cab">' + ico('cart') + '<h3>Últimas compras</h3><button type="button" class="fz-btn sm" data-fz="compra">' + ico('plus') + 'Registrar compra</button></div>' +
      ((d.lotes || []).filter(function (l) { return l.estado !== 'anulado'; }).slice(0, 6).map(function (l) { return '<div class="fz-lin">' + logo(l.producto) + '<div><b>' + esc(l.producto) + '</b><small>' + fecha(l.fecha) + ' · ' + esc(l.proveedor || 'Sin proveedor') + ' · ' + esc(l.cuentaPagoNombre || l.pago || '') + '</small></div><strong>' + L(l.costoTotalHnl) + '</strong></div>'; }).join('') || '<div class="fz-vacio-s">Sin compras registradas.</div>') + '</div>';
    var g = st.gan[ganClave()]; if (!g) cargarGan(); // R197 · mismas cifras que Ganancias
    if (g && g.error) return '<div class="fz-card fz-vacio"><b>No se pudo calcular</b><span>' + esc(g.error) + '</span></div>';
    if (!g || !g.resumen) return '<div class="fz-card fz-vacio"><span class="fz-spin"></span><b>Calculando…</b></div>';
    var dash = '<div class="fz-dash' + (st.dash.tv ? ' tv' : '') + '" id="fzDash">' + (g.graficos ? dashFiltrosHtml(g) + dashKpis(g, dashDatos(g)) + graficosHtml(g) : ganKpis(g)) + '</div>'; // R200h · dashboard interactivo
    return dash + (st.dash.tv ? '' : '<div class="fz-g2">' + alertasHtml(d, 4) + compras + '</div><div class="fz-g2 c">' + vip + '</div>' + notaCosteo(d));
  }
  function vProveedores(d) {
    var cp = d.costosProveedor || [], rp = d.rentProveedores || [];
    var rows = (d.proveedores || []).map(function (p) {
      var mios = cp.filter(function (c) { return String(c.proveedor).toLowerCase() === String(p.alias).toLowerCase(); });
      var r = rp.find(function (x) { return String(x.nombre).toLowerCase() === String(p.alias).toLowerCase(); });
      var gastado = mios.reduce(function (a, c) { return a + c.costoHnl; }, 0);
      return '<tr><td><div class="fz-prod"><span class="fz-logo sin"><i>' + esc(String(p.alias || '?').slice(0, 1)) + '</i></span><div><b>' + esc(p.alias) + '</b><small>' + esc([p.pais, p.metodoPago, p.moneda].filter(Boolean).join(' · ')) + '</small></div></div></td>' +
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
    var subs = [['registradas', 'Compras registradas'], ['pendientes', 'Cuentas por configurar'], ['spotify', 'Spotify Familiar'], ['hbomax', 'HBO Max'], ['netflix', 'Netflix Premium'], ['paramount', 'Paramount+'], ['crunchyroll', 'Crunchyroll'], ['primevideo', 'Prime Video'], ['disneyp', 'Disney Premium'], ['disneys', 'Disney Standard'], ['viki', 'Viki Rakuten'], ['vip', 'Netflix VIP'], ['importar', 'Importar Excel']];
    var nav = '<div class="fz-subtabs">' + subs.map(function (s) { return '<button type="button" class="' + (st.sub === s[0] ? 'on' : '') + '" data-fz-sub="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>';
    if (st.sub === 'vip') return nav + vVip();
    if (st.sub === 'importar') return nav + vImportar();
    if (st.sub === 'spotify') return nav + vSpotify();
    if (st.sub === 'hbo') st.sub = 'hbomax'; // R201 · HBO Max ya usa la vista de cuentas madre
    if (CUENTAS_SUB[st.sub]) return nav + vCuentas(st.sub);
    // R200a · filtros por fecha, proveedor, producto y estado + menú por fila (Ver detalle / Eliminar compra)
    var F = st.compF = st.compF || { q: '', prov: '', estado: 'vigentes', desde: '', hasta: '' };
    var todas = d.lotes || [];
    var anuladas = todas.filter(function (l) { return l.estado === 'anulado'; }).length;
    var provsL = []; todas.forEach(function (l) { if (l.proveedor && provsL.indexOf(l.proveedor) < 0) provsL.push(l.proveedor); }); provsL.sort();
    var lista = todas.filter(function (l) {
      if (F.estado === 'vigentes' && l.estado === 'anulado') return false;
      if (F.estado === 'anuladas' && l.estado !== 'anulado') return false;
      if (F.prov && l.proveedor !== F.prov) return false;
      if (F.desde && String(l.fecha) < F.desde) return false;
      if (F.hasta && String(l.fecha) > F.hasta) return false;
      if (F.q && String(l.producto || '').toLowerCase().indexOf(F.q.toLowerCase()) < 0) return false;
      return true;
    });
    var rows = lista.map(function (l) {
      var an = l.estado === 'anulado';
      var menu = '<div class="fz-menu"><button type="button" class="fz-ib" data-fz-menu aria-label="Acciones de la compra">' + ico('dots') + '</button><div class="fz-menu-l">' +
        '<button type="button" data-fz-compra="ver" data-id="' + esc(l.id) + '">Ver detalle</button>' +
        (an ? '' : '<button type="button" class="fz-danger-t" data-fz-compra="eliminar" data-id="' + esc(l.id) + '">Eliminar compra</button>') + '</div></div>';
      return '<tr class="' + (an ? 'fz-anulada' : '') + '"><td>' + fecha(l.fecha) + '</td><td><div class="fz-prod">' + logo(l.producto) + '<b>' + esc(l.producto) + '</b>' + (an ? ' <span class="fz-pill mal" title="' + esc(l.motivoAnulacion || '') + '">Anulada</span>' : '') + '</div></td><td>' + esc(l.proveedor || '—') + '</td><td class="n">' + esc(l.cantidad) + ' ' + esc(l.unidad || '') + '</td>' +
        '<td class="n">' + (l.moneda === 'HNL' ? L(l.costoTotalMoneda, true) : esc(l.costoTotalMoneda) + ' ' + esc(l.moneda)) + '</td><td class="n">' + (l.moneda === 'HNL' ? '—' : esc(l.tasa)) + '</td><td class="n"><b>' + L(l.costoTotalHnl, true) + '</b></td><td>' + esc(l.cuentaPagoNombre || l.pago) + '</td><td class="n">' + (an ? '—' : esc(l.disponible)) + '</td><td class="c">' + menu + '</td></tr>';
    }).join('');
    var filtros = '<div class="fz-filtros fz-comp-f"><input type="search" data-fz-compf="q" placeholder="Buscar producto" value="' + esc(F.q) + '" aria-label="Buscar producto">' +
      '<select data-fz-compf="prov" aria-label="Proveedor"><option value="">Todos los proveedores</option>' + provsL.map(function (p) { return '<option' + (p === F.prov ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select>' +
      '<label>Desde<input type="date" data-fz-compf="desde" value="' + esc(F.desde) + '"></label><label>Hasta<input type="date" data-fz-compf="hasta" value="' + esc(F.hasta) + '"></label>' +
      '<select data-fz-compf="estado" aria-label="Estado"><option value="vigentes"' + (F.estado === 'vigentes' ? ' selected' : '') + '>Vigentes</option><option value="anuladas"' + (F.estado === 'anuladas' ? ' selected' : '') + '>Anuladas (' + anuladas + ')</option><option value="todas"' + (F.estado === 'todas' ? ' selected' : '') + '>Todas</option></select></div>';
    return nav + '<div class="fz-card"><div class="fz-cab">' + ico('cart') + '<h3>Compras registradas</h3><button type="button" class="fz-btn sm" data-fz="compra">' + ico('plus') + 'Registrar compra</button></div>' +
      '<p class="fz-sub">Cada compra crea un lote con su tasa guardada (no cambia después). Spotify Familiar: UNA compra por familia y mes, aunque tenga 5 invitaciones. Una compra anulada queda aquí con su motivo (nunca se borra en silencio).</p>' + filtros +
      '<div class="fz-tw"><table class="fz-t"><thead><tr><th>Fecha</th><th>Producto</th><th>Proveedor</th><th class="n">Cantidad</th><th class="n">Monto</th><th class="n">Tasa</th><th class="n">Costo HNL</th><th>Pago</th><th class="n">Disponible</th><th class="c">Acciones</th></tr></thead><tbody>' + (rows || '<tr><td colspan="10" class="fz-vacio-s">' + (todas.length ? 'Ninguna compra coincide con los filtros.' : 'Sin compras registradas.') + '</td></tr>') + '</tbody></table></div></div>';
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
        '<td class="c"><button type="button" class="fz-btn sm" data-fz-spf="pago" data-id="' + esc(f.familiaId) + '">Registrar pago</button> <button type="button" class="fz-btn sec sm" data-fz-spf="editar" data-id="' + esc(f.familiaId) + '">Editar</button> <button type="button" class="fz-btn sec sm" data-fz-hist="spotify" data-id="' + esc(f.familiaId) + '" data-titulo="' + esc(f.codigo + ' · ' + f.madreCorreo) + '">Historial</button></td></tr>';
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

  // ---------------------------------------------------------------------------------------------------- R196n · HBO Max
  // Por cuenta: «Activación USDT · Binance» (la de siempre, por activación, sin costo mensual) o «Tarjeta bancaria»
  // (banco, titular y últimos 4; cargos reales). Cada cargo = UNA compra real con su costo en HNL; los meses viejos no cambian.
  async function cargarHbo() { try { st.hbo = await api('finp_hbo_lista'); } catch (e) { st.hbo = { error: e.message }; } if (st.tab === 'compras' && st.sub === 'hbo') pintar(); }
  function tjTxt(t) { return t ? esc(t.banco) + ' · ' + esc(t.titular) + ' · •••• ' + esc(t.ultimos4) : '<span class="fz-pend">Sin tarjeta</span>'; }
  function vHbo() {
    var r = st.hbo;
    var cab = '<div class="fz-card"><div class="fz-cab">' + logo('HBO Max') + '<h3>HBO Max · cuentas madre</h3></div><p class="fz-sub">Las cuentas vienen de Control Maestro con su plan real (Standard 3 perfiles · Platinum 5; las antiguas sin plan conservan su capacidad). Aquí solo se elige cómo se paga cada una: <b>Activación USDT · Binance</b> (cada activación es una compra con su costo real) o <b>Tarjeta bancaria</b> (cargos reales del banco). De la tarjeta solo se guarda banco, titular y últimos 4.</p>';
    if (!r) return cab + '<div class="fz-vacio-s"><span class="fz-spin"></span> Cargando…</div></div>';
    if (r.error) return cab + '<div class="fz-vacio-s">' + esc(r.error) + '</div></div>';
    var rows = r.filas.map(function (f) {
      var tj = f.modalidad === 'tarjeta';
      var ult = f.cargos && f.cargos[0] ? fecha(f.cargos[0].fecha) + ' · ' + L(f.cargos[0].cargoHnl, true) + (f.cargos[0].moneda !== 'HNL' ? ' <small>(' + esc(f.cargos[0].monto) + ' ' + esc(f.cargos[0].moneda) + (f.cargos[0].tipo === 'activacion' ? ' · activación' + (f.cargos[0].fechaActivacion ? ' ' + fecha(f.cargos[0].fechaActivacion) : '') : '') + ')</small>' : '') : '—';
      return '<tr><td><b>' + esc(f.correo) + '</b><small>' + esc(f.nombrePlan || '') + (f.capacidad ? ' · ' + f.ocupados + '/' + f.capacidad + ' perfiles' : '') + '</small></td><td>' + (tj ? '<span class="fz-pill">Tarjeta</span>' : '<span class="fz-pill sec">Activación USDT</span>') + '</td><td>' + (tj ? tjTxt(f.tarjeta) : '<small>Binance · por activación</small>') + '</td>' +
        '<td>' + (tj ? esc(f.periodicidad === 'puntual' ? 'Pago puntual' : 'Mensual') + (f.proximoCobro ? ' · ' + fecha(f.proximoCobro) + (f.pronto ? ' <span class="fz-pill warn">pronto</span>' : '') : '') : '—') + '</td><td>' + ult + '</td>' +
        '<td class="c">' + (tj ? '<button type="button" class="fz-btn sm" data-fz-hbo="cargo" data-id="' + esc(f.cuentaId) + '">Registrar cargo</button> ' : '<button type="button" class="fz-btn sm" data-fz-hbo="activacion" data-id="' + esc(f.cuentaId) + '">Registrar activación</button> ') +
        '<button type="button" class="fz-btn sec sm" data-fz-hbo="config" data-id="' + esc(f.cuentaId) + '">Cómo se paga</button> <button type="button" class="fz-btn sec sm" data-fz-hist="cuenta" data-id="' + esc(f.cuentaId) + '" data-titulo="' + esc(f.correo) + '">Historial</button></td></tr>';
    }).join('');
    var mini = '<div class="fz-mini"><div><small>Cuentas</small><b>' + r.filas.length + '</b></div><div><small>Con tarjeta</small><b>' + r.porTarjeta + '</b></div><div><small>Por activación USDT</small><b>' + (r.filas.length - r.porTarjeta) + '</b></div></div>';
    return cab + mini + '<div class="fz-tw" style="margin-top:12px"><table class="fz-t"><thead><tr><th>Cuenta madre</th><th>Modalidad</th><th>Medio de pago</th><th>Cobro</th><th>Último cargo</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="6" class="fz-vacio-s">No hay cuentas HBO Max en Control Maestro.</td></tr>') + '</tbody></table></div></div>';
  }
  function abrirHbo(acc, id) {
    var r = st.hbo || {}, f = (r.filas || []).find(function (x) { return x.cuentaId === id; }); if (!f) return;
    var d = st.data, hoy = d.hoy;
    var prod = (d.productosCatalogo || []).find(function (p) { return p.activo !== false && p.plataformaKey === 'hbomax' && p.modelo === 'cuenta_madre'; }) || (d.productosCatalogo || []).find(function (p) { return /hbo/i.test(p.nombre) && p.modelo === 'cuenta_madre'; });
    if (acc === 'activacion') { // R196z · ligada a ESTA cuenta y a su plan; Binance USDT, sin caducidad inventada
      var prodsHbo = (d.productosCatalogo || []).filter(function (p) { return p.activo !== false && (p.plataformaKey === 'hbomax' || /hbo/i.test(p.nombre)); });
      // R198h · una activación es un LINK/activación (sin duración inventada). Antes caía en «HBO Platinum» (cuenta madre 365 d × 5) y la
      // compra salía como «60 perfil-mes» aun en cuentas Standard.
      var pAct = prodsHbo.find(function (p) { return p.modelo === 'link'; }) || prodsHbo.find(function (p) { return p.modelo === 'cuenta_madre' && (f.plan === 'standard' ? /standard/i.test(p.nombre) : /platinum/i.test(p.nombre)); }) || prod || prodsHbo[0] || {};
      abrirCompra(pAct.id || '', { titulo: 'Registrar activación · HBO Max', cuentaId: id, correo: f.correo, plan: String(f.nombrePlan || '').replace(/^HBO Max /, '') + (f.capacidad ? ' · ' + f.capacidad + ' perfiles' : ''), plataforma: 'hbomax', plataformaNombre: 'HBO Max', pago: 'binance_hist', moneda: 'USDT', frecuencia: 'puntual', productos: prodsHbo, monedas: ['USDT', 'USD', 'HNL'],
        despues: async function (rr, compra) { if (rr.duplicado || compra.moneda !== 'USDT') return; await api('finp_hbo_guardar', { cuentaId: id, cargo: { fecha: compra.fecha, fechaActivacion: compra.fechaActivacion || '', moneda: 'USDT', monto: compra.costoTotal, cargoHnl: rr.costoTotalHnl, tasa: rr.tasa, loteId: rr.loteId, operationId: rr.loteId, activacion: true } }); },
        alGuardar: function () { st.hbo = null; } });
      return;
    }
    if (acc === 'config') {
      var ops = (r.tarjetas || []).map(function (t) { return '<option value="' + esc(t.id) + '"' + (f.tarjeta && f.tarjeta.id === t.id ? ' selected' : '') + '>' + esc(t.banco + ' · ' + t.titular + ' · •••• ' + t.ultimos4) + '</option>'; }).join('');
      var html = '<div class="fz-form"><label class="w2">Modalidad<select name="modalidad"><option value="activacion"' + (f.modalidad !== 'tarjeta' ? ' selected' : '') + '>Activación USDT · Binance (por activación)</option><option value="tarjeta"' + (f.modalidad === 'tarjeta' ? ' selected' : '') + '>Tarjeta de banco hondureño</option></select></label>' +
        '<label class="w2">Tarjeta<select name="tarjetaId"><option value="">— nueva tarjeta —</option>' + ops + '</select></label>' +
        '<label>Banco<input name="banco" maxlength="60" placeholder="Ej. BAC, Ficohsa"></label><label>Titular<input name="titular" maxlength="80"></label><label>Últimos 4 dígitos<input name="ultimos4" inputmode="numeric" maxlength="4" placeholder="1234"></label>' +
        '<label>Cobro<select name="periodicidad"><option value="mensual"' + (f.periodicidad !== 'puntual' ? ' selected' : '') + '>Mensual</option><option value="puntual"' + (f.periodicidad === 'puntual' ? ' selected' : '') + '>Pago puntual</option></select></label><label>Próximo cobro<input type="date" name="prox" value="' + esc(f.proximoCobro || '') + '"></label></div>' +
        '<p class="fz-sub">Solo banco, titular y los últimos 4 dígitos. Nunca escriba el número completo, el CVV ni claves. Una misma tarjeta puede pagar varias cuentas. Cambiar esto no modifica cargos ya registrados.</p>';
      modal('Cómo se paga · ' + f.correo, html, async function (m) {
        var mod = val(m, 'modalidad'), b = { cuentaId: id, modalidad: mod, periodicidad: val(m, 'periodicidad'), proximoCobro: val(m, 'prox') };
        if (mod === 'tarjeta') { if (val(m, 'tarjetaId')) b.tarjetaId = val(m, 'tarjetaId'); else b.tarjetaNueva = { banco: val(m, 'banco'), titular: val(m, 'titular'), ultimos4: val(m, 'ultimos4') }; }
        await api('finp_hbo_guardar', b); toast('Guardado.'); st.hbo = null; pintar();
      });
      return;
    }
    if (!prod) { toast('No hay producto «HBO Max» de cuenta madre en el catálogo: créelo en Productos para que el cargo cuente en Ganancias.'); return; }
    var html2 = '<div class="fz-form"><label>Fecha del cargo<input type="date" name="fecha" value="' + esc(hoy) + '" max="' + esc(hoy) + '"></label><label>Moneda del cargo<select name="moneda"><option>USD</option><option>HNL</option></select></label>' +
      '<label>Monto<input type="number" step="any" min="0" name="monto"></label><label>Cargo real en HNL<input type="number" step="any" min="0" name="cargoHnl" placeholder="Se calcula con la tasa BAC (USD)"></label><p class="fz-sub w2" data-tasa-bac></p>' +
      '<label class="w2">Debitado de<select name="bancoId"><option value="">— banco del libro —</option>' + (d.metodos || []).map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.nombre) + '</option>'; }).join('') + '</select></label>' +
      '<label>Próximo cobro<input type="date" name="prox" value="' + esc(f.periodicidad === 'puntual' ? '' : masUnMes(f.proximoCobro && f.proximoCobro >= hoy ? f.proximoCobro : hoy)) + '"></label></div>' +
      '<p class="fz-sub">Tarjeta: ' + tjTxt(f.tarjeta) + '. Se registra UNA compra de «' + esc(prod.nombre) + '» con el costo real en Lempiras (la tasa queda guardada y no cambia después). El mismo cargo no se puede registrar dos veces.</p>';
    var opid = opId();
    modal('Registrar cargo · ' + f.correo, html2, async function (m) {
      var mon = val(m, 'moneda'), monto = Number(val(m, 'monto')), hnl = mon === 'HNL' ? monto : Number(val(m, 'cargoHnl'));
      if (!(monto > 0)) throw new Error('Escriba el monto del cargo.');
      if (!(hnl > 0)) throw new Error('Escriba el cargo real en Lempiras que cobró el banco.');
      if (!val(m, 'bancoId')) throw new Error('Elija de qué banco del libro salió el pago.');
      var cargo = { fecha: val(m, 'fecha'), moneda: mon, monto: monto, cargoHnl: hnl, operationId: opid };
      await api('finp_hbo_guardar', { cuentaId: id, cargo: cargo }); // comprueba que no esté repetido (no escribe)
      var c = await api('fin_compra_registrar', { operationId: opid, compra: { productoId: prod.id, fecha: cargo.fecha, cantidad: 1, costoTotal: monto, moneda: mon, cargoHnl: mon === 'HNL' ? 0 : hnl, pago: 'banco', bancoId: val(m, 'bancoId'), duracionDias: f.periodicidad === 'puntual' ? undefined : 30, cuentaInventarioId: id, referencia: 'HBO Max · tarjeta •••• ' + ((f.tarjeta || {}).ultimos4 || '') + ' · ' + f.correo } });
      await api('finp_hbo_guardar', { cuentaId: id, cargo: Object.assign({}, cargo, { loteId: c.loteId || '' }), proximoCobro: val(m, 'prox') });
      toast(c.duplicado ? 'Ese cargo ya estaba registrado (no se duplicó).' : 'Cargo registrado (1 compra).'); st.hbo = null; cargar(true);
    }, 'Guardar compra', { alAbrir: function (m) { var ir = function () { usarTasaBac(m, { monto: 'monto' }); }; ir(); m.addEventListener('change', ir); m.addEventListener('input', function (e) { if (e.target.name === 'monto') ir(); }); } }); // R200g · USD → L con tasa BAC
  }

  // ---------------------------------------------------------------------------------------------------- R196z · cuentas madre automáticas
  // Netflix Premium, Paramount+, Crunchyroll, Prime Video (y «Cuentas por configurar» de todas, HBO incluido) se LEEN de Control
  // Maestro: aquí no se crean cuentas. Sin compra real = «Costo pendiente de configurar» (nunca L0). «Registrar pago» abre la
  // compra con la cuenta ya elegida; «Cómo se paga» guarda modalidad, moneda, frecuencia y tarjeta mínima (solo Finanzas).
  var CUENTAS_SUB = { pendientes: 'Cuentas por configurar', hbomax: 'HBO Max', netflix: 'Netflix Premium', paramount: 'Paramount+', crunchyroll: 'Crunchyroll', primevideo: 'Prime Video', disneyp: 'Disney Premium', disneys: 'Disney Standard', viki: 'Viki Rakuten' }; // R200g · + Disney y Viki
  var NOTA_PLAT = {
    pendientes: 'Cuentas madre de Control Maestro que todavía no tienen un pago registrado. Configure cómo se paga cada una y registre su pago real.',
    hbomax: 'Standard 3 perfiles · Platinum 5. Por cuenta: activación por link de pago o USDT · Binance (cada activación es una compra con su costo real y su fecha de vencimiento) o tarjeta bancaria (cargo mensual real). Los cargos que ya tenía registrados siguen en el historial.',
    netflix: 'Cada cuenta madre con su modalidad real: tarjeta de banco hondureño (cargo USD y Lempiras reales, mensual) o saldo / gift card pagada en USDT (sin cobro mensual inventado).',
    paramount: 'Tarjeta local en Lempiras, mensual. Cada cuenta lleva su propio costo (L150 es solo un ejemplo, no un costo fijo).',
    crunchyroll: 'Mega Fan en pesos filipinos (PHP), mensual o anual por cuenta, con el cargo real en Lempiras (BAC / PayPal). El anual se reparte en 12 meses en reportes; el pago queda en su fecha.',
    primevideo: 'Cuenta de Arabia Saudita pagada con gift card en SAR (comprada en USD en Eneba con BAC Honduras). Por cuenta: saldo SAR, renovación mensual o anual con su fecha y vencimiento de la gift card (botón «Gift cards»).',
    disneyp: 'Generalmente se paga por link / activación (USDT). También tarjeta o gift card. Cada pago queda en el historial de la cuenta.',
    disneys: 'Disney Standard (sin ESPN). Generalmente por link / activación (USDT). También tarjeta o gift card.',
    viki: 'Viki Rakuten: tarjeta en USD (se convierte a Lempiras con la tasa de BAC del día), gift card o activación.'
  };
  st.cta = st.cta || {}; st.ctaF = st.ctaF || {};
  async function cargarCuentas(plat) { try { st.cta[plat] = await api('finp_cuentas_lista', { plataforma: plat }); } catch (e) { st.cta[plat] = { error: e.message }; } if (st.tab === 'compras' && st.sub === plat) pintar(); }
  function costoTxt(c) { if (!c) return '<span class="fz-pend">Costo pendiente de configurar</span>'; return (c.moneda === 'HNL' ? L(c.costoHnl, true) : esc(c.montoMoneda) + ' ' + esc(c.moneda) + '<small>' + L(c.costoHnl, true) + (c.tasa ? ' · tasa ' + esc(c.tasa) : '') + '</small>'); }
  function vCuentas(plat) {
    var r = st.cta[plat], f = st.ctaF[plat] || 'todas';
    var cab = '<div class="fz-card"><div class="fz-cab">' + (plat === 'pendientes' ? ico('layers') : logo(CUENTAS_SUB[plat])) + '<h3>' + esc(CUENTAS_SUB[plat]) + (plat === 'pendientes' ? '' : ' · cuentas madre') + '</h3></div><p class="fz-sub">' + esc(NOTA_PLAT[plat]) + ' Las cuentas vienen de Control Maestro (solo consulta).</p>';
    if (!r) return cab + '<div class="fz-vacio-s"><span class="fz-spin"></span> Cargando…</div></div>';
    if (r.error) return cab + '<div class="fz-vacio-s">' + esc(r.error) + ' <button type="button" class="fz-btn sec sm" data-fz-cta-retry="' + esc(plat) + '">Reintentar</button></div></div>';
    var rs = r.resumen || {};
    var mini = '<div class="fz-mini"><div><small>Cuentas</small><b>' + rs.cuentas + '</b></div><div><small>Con costo</small><b>' + rs.conCosto + '</b></div><div><small>Costo pendiente</small><b>' + rs.pendientes + '</b></div><div><small>Pago en 7 días</small><b>' + rs.proximos + '</b></div></div>';
    var filtros = plat === 'pendientes' ? '' : '<div class="fz-filtros">' + [['todas', 'Todas'], ['sin', 'Sin costo'], ['con', 'Con costo'], ['proximo', 'Próximo pago']].map(function (x) { return '<button type="button" class="' + (f === x[0] ? 'on' : '') + '" data-fz-ctaf="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    var lista = (r.filas || []).filter(function (x) { return f === 'sin' ? x.estadoCosto === 'pendiente' : f === 'con' ? x.estadoCosto === 'con_costo' : f === 'proximo' ? x.pronto : true; });
    var MOD = r.modalidades || {}, FR = r.frecuencias || {};
    var rows = lista.map(function (x) {
      var modo = x.configurada ? esc(MOD[x.modalidad] || x.modalidad) + '<small>' + esc(x.moneda) + ' · ' + esc((FR[x.frecuencia] || {}).label || x.frecuencia) + (x.tarjeta ? ' · ' + esc(x.tarjeta.banco) + ' •••• ' + esc(x.tarjeta.ultimos4) : '') + '</small>' : '<span class="fz-pend">Sin configurar</span>';
      var prox = x.proximoPago ? fecha(x.proximoPago) + (x.vencido ? ' <span class="fz-pill warn">vencido</span>' : x.pronto ? ' <span class="fz-pill warn">pronto</span>' : '') : '—';
      return '<tr><td><b>' + esc(x.correo) + '</b><small>' + (plat === 'pendientes' ? esc(x.plataformaNombre) + ' · ' : '') + (x.plan ? esc(x.plan) + ' · ' : '') + x.ocupados + '/' + x.capacidad + ' perfiles</small></td><td>' + modo + '</td><td class="n">' + costoTxt(x.costo) + '</td><td>' + (x.ultimaCompra ? fecha(x.ultimaCompra) + (x.compras > 1 ? '<small>' + x.compras + ' compras</small>' : '') : '—') + '</td><td>' + prox + '</td>' + (plat === 'primevideo' ? gcCelda(x) : '') +
        '<td class="c"><button type="button" class="fz-btn sm" data-fz-cta="pago" data-plat="' + esc(plat) + '" data-id="' + esc(x.cuentaId) + '">' + (x.estadoCosto === 'pendiente' ? 'Registrar pago' : 'Nuevo pago') + '</button> <button type="button" class="fz-btn sec sm" data-fz-cta="config" data-plat="' + esc(plat) + '" data-id="' + esc(x.cuentaId) + '">Cómo se paga</button> <button type="button" class="fz-btn sec sm" data-fz-hist="cuenta" data-id="' + esc(x.cuentaId) + '" data-titulo="' + esc(x.correo) + '">Historial</button>' + (plat === 'primevideo' ? ' <button type="button" class="fz-btn sec sm" data-fz-gc="' + esc(x.cuentaId) + '">Gift cards</button>' : '') + '</td></tr>'; // R200g · historial en todas · R200i gift cards
    }).join('');
    var vacio = plat === 'pendientes' ? 'Todas las cuentas madre tienen su pago registrado.' : 'No hay cuentas de ' + esc(CUENTAS_SUB[plat]) + ' en Control Maestro.';
    return cab + mini + filtros + '<div class="fz-tw" style="margin-top:12px"><table class="fz-t"><thead><tr><th>Cuenta madre</th><th>Cómo se paga</th><th class="n">Último costo</th><th>Última compra</th><th>Próximo pago</th>' + (plat === 'primevideo' ? '<th>Saldo gift card</th><th>Renovación</th><th>Vence gift card</th>' : '') + '<th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="fz-vacio-s">' + vacio + '</td></tr>') + '</tbody></table></div>' +
      '<p class="fz-pie">Los costos pendientes NO cuentan como L0: la ganancia de esas cuentas sale como «pendiente de costo» hasta registrar su pago.</p></div>';
  }
  // R200i · Prime Video con gift card SAR: tabla por cuenta (saldo SAR, renovación mensual/anual y su fecha, gift cards
  // compradas con su valor SAR, costo USD en Eneba, cargo real en Lempiras de BAC y fecha de vencimiento de cada gift card).
  function gcCelda(x) {
    var saldo = x.saldoSar == null ? '<span class="fz-pend">Sin saldo anotado</span>' : '<b>' + esc(Number(x.saldoSar).toFixed(2)) + ' SAR</b>' + (x.saldoAl ? '<small>al ' + fecha(x.saldoAl) + '</small>' : '');
    var ren = (x.planRenovacion ? (x.planRenovacion === 'anual' ? 'Anual' : 'Mensual') : '<span class="fz-pend">Plan sin anotar</span>') + (x.proximoPago ? '<small>renueva ' + fecha(x.proximoPago) + '</small>' : '');
    var vence = x.giftcardVence ? fecha(x.giftcardVence) + (x.giftcardVencida ? ' <span class="fz-pill mal">vencida</span>' : x.giftcardVencePronto ? ' <span class="fz-pill warn">vence pronto</span>' : '') : '<span class="fz-pend">Sin fecha</span>';
    return '<td>' + saldo + '</td><td>' + ren + '</td><td>' + vence + '</td>';
  }
  function abrirGiftcards(id) {
    var r = st.cta.primevideo || {}, x = (r.filas || []).find(function (y) { return y.cuentaId === id; }); if (!x) return;
    var d = st.data, hoy = d.hoy;
    var prods = (r.productos || []).filter(function (p) { return p.plataforma === 'primevideo'; });
    var prod = prods.find(function (p) { return p.modelo === 'gift_card'; }) || prods[0];
    var gcs = x.giftcards || [];
    var tabla = gcs.length ? '<div class="fz-tw"><table class="fz-t sm"><thead><tr><th>Comprada</th><th class="n">Valor SAR</th><th class="n">Costo USD</th><th class="n">Lempiras (BAC)</th><th>Tienda</th><th>Vence la gift card</th><th>Por</th></tr></thead><tbody>' + gcs.map(function (g) {
      var venc = g.vence ? fecha(g.vence) + (g.vence < hoy ? ' <span class="fz-pill mal">vencida</span>' : '') : '—';
      return '<tr><td>' + fecha(g.fechaCompra) + '</td><td class="n"><b>' + esc(g.montoSar) + '</b></td><td class="n">' + esc(g.costoUsd) + '</td><td class="n">' + (g.cargoHnl ? L(g.cargoHnl, true) : '—') + '</td><td>' + esc(g.tienda || '') + '</td><td>' + venc + '</td><td>' + esc(g.por || '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="fz-vacio-s">Todavía no hay gift cards anotadas en esta cuenta.</div>';
    var resumen = '<div class="fz-mini"><div><small>Saldo actual</small><b>' + (x.saldoSar == null ? '—' : esc(Number(x.saldoSar).toFixed(2)) + ' SAR') + '</b></div><div><small>Renovación</small><b>' + (x.planRenovacion ? (x.planRenovacion === 'anual' ? 'Anual' : 'Mensual') : '—') + '</b></div><div><small>Próxima renovación</small><b>' + (x.proximoPago ? fecha(x.proximoPago) : '—') + '</b></div><div><small>Vence la gift card</small><b>' + (x.giftcardVence ? fecha(x.giftcardVence) : '—') + '</b></div></div>';
    var html = resumen + '<h4 class="fz-h4">Gift cards de esta cuenta</h4>' + tabla +
      '<h4 class="fz-h4">Registrar gift card nueva</h4><div class="fz-form">' +
      '<label>Fecha de compra<input type="date" name="fechaCompra" value="' + esc(hoy) + '" max="' + esc(hoy) + '">' + fe('fechaCompra') + '</label><label>Valor de la gift card (SAR)<input type="number" step="any" min="0" name="montoSar" placeholder="Ej. 50">' + fe('montoSar') + '</label>' +
      '<label>Costo en USD (Eneba)<input type="number" step="any" min="0" name="costoUsd" placeholder="Ej. 13.97">' + fe('costoUsd') + '</label><label>Cargo real en Lempiras (BAC)<input type="number" step="any" min="0" name="cargoHnl" placeholder="Se calcula con la tasa BAC">' + fe('cargoHnl') + '</label>' +
      '<p class="fz-sub w2" data-tasa-bac></p><input type="hidden" name="moneda" value="USD">' +
      '<label>Banco del libro<select name="bancoId"><option value="">— elegir —</option>' + (d.metodos || []).map(function (b) { return '<option value="' + esc(b.id) + '"' + (/bac/i.test(b.nombre) ? ' selected' : '') + '>' + esc(b.nombre) + '</option>'; }).join('') + '</select>' + fe('bancoId') + '</label><label>Tienda<input name="tienda" maxlength="40" value="Eneba"></label>' +
      '<label>Vence la gift card<input type="date" name="vence">' + fe('vence') + '</label><label class="fz-check"><input type="checkbox" name="sumar" checked> Sumar al saldo de la cuenta</label></div>' +
      '<h4 class="fz-h4">Saldo y renovación de la cuenta</h4><div class="fz-form"><label>Saldo actual (SAR) <small>(si lo corrige)</small><input type="number" step="any" min="0" name="saldoSar" placeholder="' + (x.saldoSar == null ? '' : esc(x.saldoSar)) + '"></label>' +
      '<label>Plan de renovación<select name="plan"><option value="">— sin cambio —</option><option value="mensual"' + (x.planRenovacion === 'mensual' ? ' selected' : '') + '>Mensual</option><option value="anual"' + (x.planRenovacion === 'anual' ? ' selected' : '') + '>Anual</option></select></label>' +
      '<label>Próxima renovación<input type="date" name="prox" value="' + esc(x.proximoPago || '') + '"></label></div>' +
      '<p class="fz-sub">La gift card se registra como compra real de Prime Video (USD → Lempiras con la tasa de BAC, editable). El saldo SAR y las fechas son solo de Finanzas: no tocan Control Maestro.</p>';
    var opid = opId();
    var m = modal('Gift cards · ' + x.correo, html, async function (mm) {
      var hayGc = Number(val(mm, 'montoSar')) > 0 || Number(val(mm, 'costoUsd')) > 0;
      if (hayGc) {
        if (!prod) throw new Error('No hay producto de Prime Video en el catálogo: créelo en Productos.');
        if (!(Number(val(mm, 'montoSar')) > 0) || !(Number(val(mm, 'costoUsd')) > 0)) throw new Error('Escriba el valor en SAR y el costo en USD de la gift card.');
        if (!(Number(val(mm, 'cargoHnl')) > 0)) throw new Error('Falta el cargo en Lempiras (escríbalo si la tasa BAC no cargó).');
        if (!val(mm, 'bancoId')) throw new Error('Elija de qué banco salió el pago.');
        var c = await api('fin_compra_registrar', { operationId: opid, compra: { productoId: prod.id, fecha: val(mm, 'fechaCompra'), cantidad: 1, costoTotal: Number(val(mm, 'costoUsd')), moneda: 'USD', cargoHnl: Number(val(mm, 'cargoHnl')), pago: 'banco', bancoId: val(mm, 'bancoId'), cuentaInventarioId: id, duracionDias: x.planRenovacion === 'anual' ? 365 : 30, referencia: ('Gift card ' + val(mm, 'montoSar') + ' SAR · ' + (val(mm, 'tienda') || 'Eneba')).slice(0, 80) } });
        await api('finp_giftcard_guardar', { cuentaId: id, operationId: opid, sumarSaldo: !!val(mm, 'sumar'), giftcard: { fechaCompra: val(mm, 'fechaCompra'), montoSar: Number(val(mm, 'montoSar')), costoUsd: Number(val(mm, 'costoUsd')), cargoHnl: Number(val(mm, 'cargoHnl')), tienda: val(mm, 'tienda'), vence: val(mm, 'vence'), loteId: c.loteId || '' } });
      }
      if (val(mm, 'saldoSar') !== '' || val(mm, 'plan') || val(mm, 'prox') !== (x.proximoPago || '')) {
        var P = (r.plataformas || {}).primevideo || {}, def = P.defecto || {};
        await api('finp_cuenta_config', { cuentaId: id, modalidad: x.modalidad || def.modalidad, moneda: x.moneda || def.moneda, frecuencia: x.frecuencia || def.frecuencia, proximoPago: val(mm, 'prox'), tarjetaId: x.tarjeta ? x.tarjeta.id : undefined, saldoSar: val(mm, 'saldoSar'), planRenovacion: val(mm, 'plan') || undefined });
      }
      toast(hayGc ? 'Gift card registrada (1 compra) y saldo actualizado.' : 'Guardado.'); st.cta = {}; cargar(true);
    }, 'Guardar', { alAbrir: function (mm) { var ir = function () { usarTasaBac(mm, { monto: 'costoUsd' }); }; ir(); mm.addEventListener('input', function (e) { if (e.target.name === 'costoUsd') ir(); }); mm.addEventListener('change', function (e) { if (e.target.name === 'bancoId') ir(); }); } });
    m.classList.add('ancho');
  }
  function abrirCuenta(acc, plat, id) {
    var r = st.cta[plat] || {}, x = (r.filas || []).find(function (y) { return y.cuentaId === id; }); if (!x) return;
    var P = (r.plataformas || {})[x.plataforma] || {}, MOD = r.modalidades || {}, FR = r.frecuencias || {};
    var recargar = function () { st.cta = {}; st.hbo = null; };
    if (acc === 'pago') {
      var def = P.defecto || {}, mod = x.modalidad || def.modalidad, mon = x.moneda || def.moneda, fr = x.frecuencia || def.frecuencia;
      var prods = (r.productos || []).filter(function (p) { return p.plataforma === x.plataforma; });
      var pSel = (prods.find(function (p) { return p.modelo === 'cuenta_madre'; }) || prods[0] || {}).id || '';
      if (!prods.length) { crearProductoPlataforma(x.plataforma, P.nombre || x.plataforma, recargar); return; }
      abrirCompra(pSel, { titulo: 'Registrar pago · ' + (P.nombre || ''), cuentaId: x.cuentaId, correo: x.correo, plan: x.plan, plataforma: x.plataforma, plataformaNombre: P.nombre, tarjeta: x.tarjeta, productos: prods, monedas: P.monedas, frecuencia: fr, moneda: (mod === 'binance' || mod === 'link') && (P.monedas || []).indexOf('USDT') >= 0 ? 'USDT' : mon, pago: mon === 'USDT' || mod === 'binance' || mod === 'link' ? 'binance_hist' : 'banco', alGuardar: recargar }); // R200i · activación/link = Binance ya pagado (USDT + Lempiras)
      return;
    }
    if (acc === 'hist') { verHistorial({ cuentaId: id }, x.correo); return; }
    // config: modalidad, moneda, frecuencia, tarjeta (solo banco, titular, últimos 4) y próximo pago
    var def2 = P.defecto || {};
    var ops = (r.tarjetas || []).map(function (t) { return '<option value="' + esc(t.id) + '"' + (x.tarjeta && x.tarjeta.id === t.id ? ' selected' : '') + '>' + esc(t.banco + ' · ' + t.titular + ' · •••• ' + t.ultimos4) + '</option>'; }).join('');
    var sel = function (name, lista, actual, labels) { return '<select name="' + name + '">' + lista.map(function (k) { return '<option value="' + esc(k) + '"' + (k === actual ? ' selected' : '') + '>' + esc(labels ? (labels[k] && (labels[k].label || labels[k])) || k : k) + '</option>'; }).join('') + '</select>'; };
    var html = '<div class="fz-form"><div class="fz-cuenta-ro w2"><small>Cuenta (Control Maestro · solo lectura)</small><b>' + esc(x.correo) + '</b><span>' + esc(P.nombre || '') + (x.plan ? ' · ' + esc(x.plan) : '') + ' · ' + x.ocupados + '/' + x.capacidad + ' perfiles</span></div>' +
      '<label>Cómo se paga' + sel('modalidad', P.modalidades || [], x.modalidad || def2.modalidad, MOD) + '</label><label>Moneda' + sel('moneda', P.monedas || [], x.moneda || def2.moneda) + '</label>' +
      '<label>Frecuencia' + sel('frecuencia', P.frecuencias || [], x.frecuencia || def2.frecuencia, FR) + '</label><label>Próximo pago<input type="date" name="proximoPago" value="' + esc(x.proximoPago || '') + '"></label>' +
      '<label class="w2" data-si="tj">Tarjeta<select name="tarjetaId"><option value="">— nueva tarjeta —</option>' + ops + '</select></label>' +
      '<label data-si="tjn">Banco<input name="banco" maxlength="60" placeholder="Ej. BAC, Ficohsa"></label><label data-si="tjn">Titular<input name="titular" maxlength="80"></label><label data-si="tjn">Últimos 4 dígitos<input name="ultimos4" inputmode="numeric" maxlength="4" placeholder="1234"></label>' +
      '<label class="w2">Notas<input name="notas" maxlength="200" value=""></label></div>' +
      '<p class="fz-sub">Solo banco, titular y últimos 4 dígitos: nunca el número completo, CVV ni claves. Esto no cambia compras ya registradas ni nada de Control Maestro.</p>';
    function ajustar(m) { var tj = val(m, 'modalidad') === 'tarjeta'; m.querySelector('[data-si="tj"]').hidden = !tj; m.querySelectorAll('[data-si="tjn"]').forEach(function (l) { l.hidden = !(tj && !val(m, 'tarjetaId')); }); }
    modal('Cómo se paga · ' + x.correo, html, async function (m) {
      var b = { cuentaId: id, modalidad: val(m, 'modalidad'), moneda: val(m, 'moneda'), frecuencia: val(m, 'frecuencia'), proximoPago: val(m, 'proximoPago'), notas: val(m, 'notas') };
      if (b.modalidad === 'tarjeta') { if (val(m, 'tarjetaId')) b.tarjetaId = val(m, 'tarjetaId'); else b.tarjetaNueva = { banco: val(m, 'banco'), titular: val(m, 'titular'), ultimos4: val(m, 'ultimos4') }; }
      await api('finp_cuenta_config', b); toast('Guardado.'); recargar(); pintar();
    }, 'Guardar', { alAbrir: function (m) { ajustar(m); m.addEventListener('change', function () { ajustar(m); }); } });
  }

  // R200g · Historial de pagos de UNA cuenta (todas las plataformas, Spotify Familiar incluido): cuándo se pagó, cuándo se
  // volvió a pagar (días entre pagos), hasta cuándo cubre, monto original, tasa guardada y Lempiras. Las anuladas se ven tachadas.
  function verHistorial(peticion, titulo) {
    var mm = modal('Historial de pagos · ' + titulo, '<div class="fz-vacio-s"><span class="fz-spin"></span> Cargando…</div>'); mm.classList.add('ancho');
    api('finp_cuenta_historial', peticion).then(function (h) {
      var b = mm.querySelector('.fz-modal-b'); if (!b) return;
      var cs = h.compras || [], vig = cs.filter(function (c) { return c.estado !== 'anulado'; });
      if (!cs.length) { b.innerHTML = '<div class="fz-vacio-s">Esta cuenta todavía no tiene pagos registrados. Use «Nuevo pago» / «Registrar pago».</div>'; return; }
      var dias = function (a, z) { return Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(z + 'T12:00:00Z')) / 86400000); };
      var rows = cs.map(function (c) {
        var an = c.estado === 'anulado', i = vig.indexOf(c), prev = i >= 0 ? vig[i + 1] : null;
        var entre = an ? '—' : prev ? dias(c.fecha, prev.fecha) + ' días <small>después del ' + fecha(prev.fecha) + '</small>' : '<small>primer pago</small>';
        var cubre = c.vigenciaHasta ? fecha(c.vigenciaHasta) : c.duracionDias ? c.duracionDias + ' días' : 'puntual';
        return '<tr class="' + (an ? 'fz-anulada' : '') + '"><td><b>' + fecha(c.fecha) + '</b>' + (an ? ' <span class="fz-pill mal" title="' + esc(c.motivoAnulacion || '') + '">Anulada</span>' : '') + '</td><td>' + entre + '</td><td>' + cubre + '</td><td>' + esc(c.producto) + '<small>' + esc(folio(c.loteId)) + '</small></td>' +
          '<td class="n">' + (c.moneda === 'HNL' ? L(c.montoMoneda, true) : esc(c.montoMoneda) + ' ' + esc(c.moneda)) + '</td><td class="n">' + (c.moneda === 'HNL' ? '—' : esc(c.tasa)) + '</td><td class="n"><b>' + L(c.costoHnl, true) + '</b></td><td>' + esc(c.pago) + (c.referencia ? '<small>' + esc(c.referencia) + '</small>' : '') + '</td><td>' + esc(c.por) + '</td></tr>';
      }).join('');
      var total = vig.reduce(function (s, c) { return s + (Number(c.costoHnl) || 0); }, 0);
      var prom = vig.length > 1 ? Math.round(dias(vig[0].fecha, vig[vig.length - 1].fecha) / (vig.length - 1)) : 0;
      b.innerHTML = '<div class="fz-mini"><div><small>Pagos</small><b>' + vig.length + '</b></div><div><small>Total pagado</small><b>' + L(total, true) + '</b></div><div><small>Primer pago</small><b>' + (vig.length ? fecha(vig[vig.length - 1].fecha) : '—') + '</b></div><div><small>Último pago</small><b>' + (vig.length ? fecha(vig[0].fecha) : '—') + '</b></div>' + (prom ? '<div><small>Cada cuánto paga</small><b>' + prom + ' días</b></div>' : '') + '</div>' +
        '<div class="fz-tw" style="margin-top:10px"><table class="fz-t"><thead><tr><th>Fecha de pago</th><th>Se volvió a pagar</th><th>Cubre hasta</th><th>Producto</th><th class="n">Monto</th><th class="n">Tasa</th><th class="n">Lempiras</th><th>Cómo se pagó</th><th>Por</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<p class="fz-sub">Cada fila es un pago real con su tasa guardada: no cambia aunque cambie la tasa del día.</p>';
    }).catch(function (e) { var b = mm.querySelector('.fz-modal-b'); if (b) b.textContent = e.message; });
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
      return '<tr><td><b>' + esc(f.correo) + '</b><small>' + esc(f.madre || '') + '</small></td><td>' + esc(f.cliente || '—') + (f.sinInventario ? '<small>' + (f.estadoCM === 'sin_asignacion' ? 'Sin asignación comercial' : 'Asignada en Telegram · sin unidad en Bodega') + '</small>' : '') + '</td><td>' + esc(f.proveedor || '—') + '</td><td class="n">' + U(f.costoMensualUsdt) + '<small>' + (f.costoMensualHnl ? L(f.costoMensualHnl, true) : '') + '</small></td>' +
        '<td>' + fecha(f.proximoPagoProveedor) + '</td><td>' + esc(f.loteId || '—') + '</td><td class="c">' + pill(ESTADO_VIP, f.estado) + '</td><td class="c"><div class="fz-menu"><button type="button" class="fz-ib" data-fz-menu aria-label="Opciones">' + ico('dots') + '</button>' +
        '<div class="fz-menu-l"><button type="button" data-fz-vip="editar" data-id="' + esc(f.cmId) + '">Editar</button><button type="button" data-fz-vip="reemplazar" data-id="' + esc(f.cmId) + '"' + (f.estado === 'sin_registro' || f.sinInventario ? ' disabled' : '') + '>Reemplazar</button><button type="button" data-fz-vip="baja" data-id="' + esc(f.cmId) + '"' + (f.estado === 'sin_registro' || f.estado === 'baja' ? ' disabled' : '') + '>Dar de baja</button><button type="button" data-fz-vip="historial" data-id="' + esc(f.cmId) + '">Historial</button></div></div></td></tr>';
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
    var zona = '<label class="fz-drop" data-fz-drop><input type="file" accept=".xlsx" data-fz-file hidden>' + ico('upload') + '<b>Arrastre aquí el Excel (VIP 4 columnas, Premium 6 columnas o plantilla de 5 hojas)</b><span>o toque para elegirlo · se reconoce solo por los encabezados · solo vincula cuentas que ya existen en Control Maestro</span></label>';
    var cuerpo = '';
    if (imp && imp.error) cuerpo = '<div class="fz-err">' + esc(imp.error) + '</div>';
    if (imp && imp.cargando) cuerpo = '<div class="fz-vacio-s"><span class="fz-spin"></span> Revisando el archivo…</div>';
    if (imp && imp.simple && !imp.cargando) cuerpo = vSimple(imp);
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
      if (hojas.indexOf('EXTRAS_VIP') < 0 || hojas.indexOf('LOTES_COMPRAS') < 0) { // R196i · plantillas sencillas (primera hoja)
        var aoa = window.XLSX.utils.sheet_to_json(wb.Sheets[hojas[0]], { header: 1, raw: true, defval: null, blankrows: false });
        var enc = (aoa[0] || []).map(function (h) { return h == null ? '' : String(h).trim(); });
        var tipo = tipoSimple(enc);
        if (!tipo) throw new Error('No reconozco el Excel. VIP: CORREO DEL EXTRA VIP · PROVEEDOR · FECHA DE RENOVACIÓN · PAGO POR CUENTA (USDT). Premium: CORREO NETFLIX PREMIUM · BANCO HONDUREÑO · NOMBRE TITULAR TARJETA · ÚLTIMOS 4 DÍGITOS TARJETA · FECHA DE COBRO / RENOVACIÓN · PAGO POR CUENTA (USD).');
        var filas = aoa.slice(1).map(function (f, i) { return { _fila: i + 2, v: (f || []).slice(0, tipo === 'vip' ? 4 : 6) }; }).filter(function (f) { return f.v.some(function (x) { return x != null && String(x).trim() !== ''; }); });
        st.imp = { simple: true, tipo: tipo, payload: { encabezados: enc, filas: filas, archivo: { nombre: file.name, bytes: file.size } }, archivo: { nombre: file.name }, res: {}, tasa: '' };
        if (tipo === 'premium') await previaSimple(); else pintar(); // VIP pide primero la tasa Binance
        return;
      }
      var payload = { hojas: hojas, extras: leerHoja(wb.Sheets.EXTRAS_VIP, COLS_EXTRAS), lotes: leerHoja(wb.Sheets.LOTES_COMPRAS, COLS_LOTES), archivo: { nombre: file.name, bytes: file.size, hash: await hashArchivo(buf) } };
      st.imp = { payload: payload, archivo: payload.archivo, res: {}, cargando: true }; pintar();
      await previa();
    } catch (e) { st.imp = { error: e.message }; pintar(); }
  }
  // ---------------- R196i · Excel sencillo VIP (4 col.) / Premium (6 col.)
  function nh(h) { return String(h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9/() ]/g, '').replace(/\s+/g, ' ').trim(); }
  var SIMPLES = { vip: ['CORREO DEL EXTRA VIP', 'PROVEEDOR', 'FECHA DE RENOVACIÓN', 'PAGO POR CUENTA (USDT)'], premium: ['CORREO NETFLIX PREMIUM', 'BANCO HONDUREÑO', 'NOMBRE TITULAR TARJETA', 'ÚLTIMOS 4 DÍGITOS TARJETA', 'FECHA DE COBRO / RENOVACIÓN', 'PAGO POR CUENTA (USD)'] };
  function tipoSimple(enc) { var h = enc.map(nh); for (var k in SIMPLES) { if (SIMPLES[k].every(function (c, i) { return h[i] === nh(c); })) return k; } return null; }
  async function previaSimple() {
    var imp = st.imp; imp.cargando = true; imp.error = ''; pintar();
    try { var r = await api('finp_simple_preview', Object.assign({}, imp.payload, { tasa: Number(imp.tasa) || 0, resoluciones: imp.res })); imp.pvs = r; imp.hash = r.hash; imp.confirmo = false; }
    catch (e) { imp.error = e.message; }
    imp.cargando = false; pintar();
  }
  async function confirmarSimple() {
    var imp = st.imp; if (!imp || !imp.pvs) return;
    if (!imp.confirmo) { toast('Marque la confirmación.', true); return; }
    try { var r = await api('finp_simple_confirmar', Object.assign({}, imp.payload, { tasa: Number(imp.tasa) || 0, resoluciones: imp.res, hash: imp.hash, confirmo: true })); toast(r.tipo === 'vip' ? 'Importado: ' + r.aplicados + ' registro(s) VIP · ' + (r.vinculadas || 0) + ' vinculados · ' + (r.sinAsignacion || 0) + ' sin asignación comercial. 0 ventas y 0 clientes creados.' : 'Importado: ' + r.aplicados + ' cuenta(s) existentes. 0 ventas y 0 clientes creados.'); st.imp = null; st.jobs = null; st.vip.res = null; cargar(true); }
    catch (e) { toast(e.message, true); }
  }
  function vSimple(imp) {
    var vip = imp.tipo === 'vip';
    var html = '<div class="fz-cab sub"><h3>' + (vip ? 'Netflix EXTRA VIP · 4 columnas' : 'Netflix PREMIUM madre · 6 columnas') + ' · ' + esc(imp.archivo.nombre) + '</h3><span class="fz-sub r">' + imp.payload.filas.length + ' fila(s)</span></div>' +
      '<div class="fz-form in"><label>' + (vip ? 'Tasa Binance HNL por USDT (obligatoria)' : 'Tipo de cambio HNL por USD (opcional: si falta, el costo en L queda pendiente)') + '<input type="number" step="any" min="0" data-fz-tasa value="' + esc(imp.tasa) + '"></label><button type="button" class="fz-btn sec" data-fz="previasimple">Revisar</button></div>';
    if (imp.error) html += '<div class="fz-err">' + esc(imp.error) + '</div>';
    var r = imp.pvs; if (!r) return html;
    var c = r.resumen;
    html += '<div class="fz-cont">' + [['Nuevos', c.nuevos, 'ok'], ['Actualizados', c.actualizados, 'ok'], ['Sin cambios', c.sinCambios, 'gris'], ['Ambiguos', c.ambiguos, 'warn'], ['Sin coincidencia', c.sinCoincidencia, 'mal'], ['Duplicados', c.duplicados, 'mal'], ['Con error', c.conError, 'mal']].concat(vip ? [['En Control Maestro', c.enControlMaestro || 0, 'ok'], ['En Bodega VIP', c.enBodega || 0, 'ok'], ['Asignadas en Telegram', c.enTelegram || 0, 'ok'], ['Sin asignación comercial', c.sinAsignacion || 0, 'warn']] : []).concat([['Ventas/clientes creados', 0, 'gris']]).map(function (x) { return '<div class="' + (x[1] ? x[2] : 'gris') + '"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('') + '</div>';
    var amb = r.filas.filter(function (x) { return x.estado === 'ambiguo'; });
    if (amb.length) html += '<h4 class="fz-h4">Correo repetido en Control Maestro: elija la cuenta</h4>' + amb.map(function (x) { return '<div class="fz-amb"><span>Fila ' + x.fila + ' · <b>' + esc(x.correo) + '</b></span><select data-fz-res="' + x.fila + '"><option value="">— elegir —</option>' + x.candidatos.map(function (k) { return '<option value="' + esc(k.id) + '"' + (imp.res[x.fila] === k.id ? ' selected' : '') + '>' + esc(k.id + ' · ' + (k.cliente || 'sin cliente')) + '</option>'; }).join('') + '</select></div>'; }).join('') + '<button type="button" class="fz-btn sec sm" data-fz="previasimple">Aplicar y revisar de nuevo</button>';
    var VINC = { control_maestro: 'Control Maestro', bodega: 'Bodega VIP', telegram: 'Asignada en Telegram (solo Finanzas)', sin_asignacion: 'Sin asignación comercial' };
    var est = { nuevo: ['Nuevo', 'ok'], actualiza: ['Actualiza', 'ok'], sin_cambios: ['Sin cambios', 'gris'], ambiguo: ['Ambiguo', 'warn'], sin_coincidencia: ['Sin coincidencia', 'pend'], duplicado: ['Duplicado', 'pend'], error: ['Error', 'pend'] };
    html += '<div class="fz-tw"><table class="fz-t sm"><thead><tr><th>Fila</th><th>Correo</th><th>' + (vip ? 'Vínculo / cliente' : 'Cliente (Control Maestro)') + '</th>' + (vip ? '<th>Proveedor</th><th>Renovación</th><th class="n">USDT</th><th class="n">L</th>' : '<th>Banco</th><th>Tarjeta</th><th>Cobro</th><th class="n">USD</th><th class="n">L</th>') + '<th>Estado</th><th>Detalle</th></tr></thead><tbody>' +
      r.filas.slice(0, 200).map(function (x) { var d = x.datos || {}; return '<tr><td>' + x.fila + '</td><td>' + esc(x.correo) + '</td><td>' + (vip && x.vinculo ? '<b>' + esc(VINC[x.vinculo] || '') + (x.bodega ? ' · ' + esc(x.bodega) : '') + '</b>' + (x.cliente ? '<small>' + esc(x.cliente) + '</small>' : '') : esc(x.cliente || '—')) + '</td>' + (vip ? '<td>' + esc(d.proveedor || '—') + '</td><td>' + (d.proximoPagoProveedor ? fecha(d.proximoPagoProveedor) : '—') + '</td><td class="n">' + (d.costoMensualUsdt != null ? esc(d.costoMensualUsdt) : '—') + '</td><td class="n">' + (d.costoMensualHnl != null ? L(d.costoMensualHnl, true) : '—') + '</td>' : '<td>' + esc(d.banco || '—') + '</td><td>' + (d.ultimos4 ? '•••• ' + esc(d.ultimos4) : '—') + '</td><td>' + (d.fechaCobro ? fecha(d.fechaCobro) : '—') + '</td><td class="n">' + (d.pagoUsd != null ? esc(d.pagoUsd) : '—') + '</td><td class="n">' + (d.cargoHnl != null ? L(d.cargoHnl, true) : '<span class="fz-pend">Pendiente</span>') + '</td>') + '<td>' + pill(est, x.estado) + '</td><td>' + esc(x.errores.concat(x.avisos).join(' · ')) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    var hay = c.nuevos + c.actualizados;
    html += '<label class="fz-check"><input type="checkbox" data-fz-confirmo' + (imp.confirmo ? ' checked' : '') + '> Confirmo: ' + (vip ? 'se guardan solo proveedor, renovación y costo USDT en Finanzas. Las cuentas que ya existen se vinculan sin duplicarse; las demás quedan como «Sin asignación comercial». No se crean clientes, ventas ni cuentas en Control Maestro.' : 'solo se guardan datos de Finanzas en cuentas que YA existen. No se crean clientes ni ventas y Control Maestro no cambia.') + '</label>' +
      '<div class="fz-acc"><button type="button" class="fz-btn" data-fz="importarsimple"' + (hay ? '' : ' disabled') + '>Confirmar (' + hay + ')</button><button type="button" class="fz-btn sec" data-fz="cancelarimp">Cancelar</button></div>';
    return html;
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
      '<div class="fz-hojas">' + hojas.map(function (h) { return '<span class="fz-chip">' + h + '</span>'; }).join('') + '</div></div>' + repCuentas();
  }
  function repCuentas() { // R197b · «Cuentas» también desde Reportes (mismo motor y mismo detalle que Ganancias)
    var g = st.gan[ganClave()]; if (!g) { cargarGan(); return '<div class="fz-card fz-vacio-s"><span class="fz-spin"></span> Cargando plataformas…</div>'; }
    if (g.error || !g.porPlataforma) return '';
    var f = g.porPlataforma.filter(function (p) { return p.estado !== 'sin_movimiento' || p.esperadoHnl > 0; });
    return '<div class="fz-card"><div class="fz-cab">' + ico('users') + '<h3>Detalle por plataforma</h3><span class="fz-sub r">' + fecha(g.desde) + ' → ' + fecha(g.hasta) + '</span><button type="button" class="fz-btn sec sm" data-fz="excelfin">' + ico('dl') + 'Excel financiero</button></div>' +
      f.map(function (p) { return '<div class="fz-lin">' + logo(p.nombre) + '<div><b>' + esc(p.nombre) + '</b><small>' + p.altas + ' altas · ' + p.renovaciones + ' renov. · cobrado ' + L(p.cobradoHnl) + ' · cobertura ' + P(p.coberturaCostos) + '</small></div><button type="button" class="fz-btn sec sm" data-fz-ganplat="' + esc(p.plataforma) + '">Cuentas</button></div>'; }).join('') + '</div>';
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
  // R196z · El modal se agrega a <body>, FUERA de #rbac-finanzas: antes no heredaba los colores (--r) y el botón principal
  // quedaba blanco sobre blanco (invisible: solo se veía «Cancelar»). Ahora .fz-modal define sus propios colores (CSS) y el
  // pie (Cancelar · Guardar) queda fijo abajo, visible también en celular. Guardar: valida, «Guardando…», sin doble envío;
  // solo se cierra si el servidor confirmó; si falla, los datos escritos se quedan.
  function modal(titulo, html, onOk, okTxt, opts) {
    opts = opts || {};
    var m = document.createElement('div'); m.className = 'fz-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', titulo);
    m.innerHTML = '<div class="fz-modal-c"><div class="fz-modal-h"><h3>' + esc(titulo) + '</h3><button type="button" class="fz-ib" data-x aria-label="Cerrar">' + ico('x') + '</button></div><div class="fz-modal-b">' + html + '</div>' +
      (onOk ? '<div class="fz-modal-pie"><div class="fz-err" data-merr role="alert" hidden></div><div class="fz-acc"><button type="button" class="fz-btn sec" data-x>Cancelar</button><button type="button" class="fz-btn" data-ok>' + esc(okTxt || 'Guardar') + '</button></div></div>' : '') + '</div>';
    document.body.appendChild(m);
    var enviando = false;
    function cerrar() { if (!enviando) m.remove(); }
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-x]')) cerrar(); });
    var ok = m.querySelector('[data-ok]');
    function revisar(mostrar) { // devuelve true si el formulario es válido; marca cada campo con su mensaje
      if (!opts.validar || !ok) return true;
      var errs = opts.validar(m) || {}, hay = false;
      m.querySelectorAll('[data-fe]').forEach(function (x) { var msg = errs[x.dataset.fe] || ''; x.textContent = mostrar ? msg : ''; x.hidden = !(mostrar && msg); var inp = m.querySelector('[name="' + x.dataset.fe + '"]'); if (inp) inp.classList.toggle('fz-inv', !!(mostrar && msg)); });
      Object.keys(errs).forEach(function (k) { if (errs[k]) hay = true; });
      if (!enviando) ok.disabled = hay;
      return !hay;
    }
    if (opts.validar) { var tocado = false; m.addEventListener('input', function () { tocado = true; revisar(true); }); m.addEventListener('change', function () { tocado = true; revisar(true); }); revisar(false); }
    if (ok) ok.addEventListener('click', async function () {
      if (enviando) return;
      var er = m.querySelector('[data-merr]'); er.hidden = true;
      if (!revisar(true)) { er.textContent = 'Revise los campos marcados.'; er.hidden = false; return; }
      enviando = true; ok.disabled = true; var txtOk = ok.textContent; ok.innerHTML = '<span class="fz-spin"></span> Guardando…';
      try { await onOk(m); enviando = false; m.remove(); }
      catch (e) { enviando = false; er.textContent = e.message || 'No se pudo guardar. Intente de nuevo.'; er.hidden = false; ok.textContent = txtOk; ok.disabled = false; revisar(true); }
    });
    if (opts.alAbrir) opts.alAbrir(m);
    return m;
  }
  function val(m, k) { var el = m.querySelector('[name="' + k + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; }
  function fe(k) { return '<small class="fz-fe" data-fe="' + k + '" hidden></small>'; }
  function folio(id) { return String(id || '').replace(/^.*[_-]/, '').slice(-8).toUpperCase(); }
  var FREC_DIAS = { mensual: 30, trimestral: 90, anual: 365, puntual: 0 };
  // Registrar compra. `ctx` (opcional) = cuenta madre de Control Maestro ya elegida: { cuentaId, correo, plan, plataforma,
  // pago, moneda, frecuencia, monedas, tarjeta, despues(r, compra) }. Los campos se muestran según el método de pago y la moneda.
  // R200g · USD → Lempiras automático con la tasa de VENTA de BAC Honduras del día. Se llena el «Cargo real en Lempiras»;
  // si el banco cobró otro monto, se escribe el real y ese manda. La tasa queda guardada en la compra y no cambia después.
  function tasaBacHoy() {
    if (st.tasaBac && st.tasaBac.dia === (st.data && st.data.hoy)) return st.tasaBac.p;
    var p = api('finp_tasa_bac').catch(function (e) { return { disponible: false, error: e.message }; });
    st.tasaBac = { dia: st.data && st.data.hoy, p: p }; return p;
  }
  function usarTasaBac(m, nombres) {
    nombres = nombres || {}; var nMon = nombres.moneda || 'moneda', nMonto = nombres.monto || 'costoTotal', nCargo = nombres.cargo || 'cargoHnl';
    var info = m.querySelector('[data-tasa-bac]'), cargo = m.querySelector('[name="' + nCargo + '"]');
    if (!info || !cargo) return;
    if (!cargo.dataset.bacListo) { cargo.dataset.bacListo = '1'; cargo.addEventListener('input', function () { cargo.dataset.manual = cargo.value ? '1' : ''; }); }
    var mon = val(m, nMon), monto = Number(val(m, nMonto));
    if (mon !== 'USD' || (nombres.soloSi && !nombres.soloSi())) { info.textContent = ''; return; }
    info.textContent = 'Consultando la tasa de BAC Honduras…';
    tasaBacHoy().then(function (t) {
      if (val(m, nMon) !== 'USD') { info.textContent = ''; return; }
      if (!t || !t.disponible) { info.textContent = (t && t.error) || 'No se pudo leer la tasa de BAC. Escriba el cargo en Lempiras.'; return; }
      var hnl = monto > 0 ? Math.round(monto * t.venta * 100) / 100 : 0;
      if (hnl > 0 && cargo.dataset.manual !== '1' && cargo.value !== hnl.toFixed(2)) { cargo.value = hnl.toFixed(2); cargo.dispatchEvent(new Event('change', { bubbles: true })); } // revalida el formulario
      var bsel = m.querySelector('[name="bancoId"]'), bnom = bsel && bsel.selectedIndex > 0 ? bsel.options[bsel.selectedIndex].text : '';
      var otroBanco = bnom && !/bac|credomatic/i.test(bnom); // R200j · tarjeta de otro banco (ej. Atlántida): la tasa BAC es solo un estimado
      info.innerHTML = 'Tasa BAC Honduras ' + esc(t.deHoy ? 'de hoy' : 'del ' + fecha(t.fecha)) + ': venta <b>L' + esc(t.venta) + '</b> · compra L' + esc(t.compra) + (hnl > 0 ? ' → ' + esc(monto) + ' USD = <b>' + L(hnl, true) + '</b>' + (otroBanco ? ' (estimado)' : '') : '') + (cargo.dataset.manual === '1' ? ' · <i>usted escribió otro cargo: se usa el suyo</i>' : '') +
        (otroBanco ? '<br><b>Pagado con ' + esc(bnom) + ':</b> escriba el cargo en Lempiras que sale en el estado de cuenta de ese banco (la tasa BAC es solo referencia).' : '') + (t.aviso ? '<br><small>' + esc(t.aviso) + '</small>' : '');
    });
  }
  function abrirCompra(prodId, ctx) {
    ctx = ctx || {};
    var d = st.data; var hoy = d.hoy;
    var prods = (d.productosCatalogo || []).filter(function (p) { return p.activo; });
    if (ctx.productos && ctx.productos.length) { var ids = ctx.productos.map(function (p) { return p.id; }); prods = prods.filter(function (p) { return ids.indexOf(p.id) >= 0; }); }
    var monedas = ctx.monedas && ctx.monedas.length ? ctx.monedas : (d.monedas || ['HNL']);
    var monSel = ctx.moneda && monedas.indexOf(ctx.moneda) >= 0 ? ctx.moneda : monedas[0];
    var pagoSel = ctx.pago || 'banco';
    var dur = ctx.frecuencia != null ? FREC_DIAS[ctx.frecuencia] : null;
    var cuenta = ctx.cuentaId ? '<div class="fz-cuenta-ro w2"><small>Cuenta vinculada (Control Maestro · solo lectura)</small><b>' + esc(ctx.correo || '') + '</b><span>' + esc(ctx.plataformaNombre || '') + (ctx.plan ? ' · ' + esc(ctx.plan) : '') + (ctx.tarjeta ? ' · ' + esc(ctx.tarjeta.banco) + ' •••• ' + esc(ctx.tarjeta.ultimos4) : '') + '</span></div>' : '';
    var html = '<div class="fz-form">' + cuenta +
      '<label class="w2">Producto<select name="productoId"><option value="">— elegir —</option>' + prods.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === prodId ? ' selected' : '') + '>' + esc(p.nombre) + ' · ' + esc((d.modelos[p.modelo] || {}).label || p.modelo) + '</option>'; }).join('') + '</select>' + fe('productoId') + '</label>' +
      '<label>Fecha de pago<input type="date" name="fecha" value="' + esc(hoy) + '" max="' + esc(hoy) + '">' + fe('fecha') + '</label>' +
      '<label>Fecha de activación <small>(opcional)</small><input type="date" name="fechaActivacion" max="' + esc(hoy) + '">' + fe('fechaActivacion') + '</label>' +
      (ctx.cuentaId ? '<label>Próximo pago <small>(cubre hasta · puede cambiarlo)</small><input type="date" name="vigenciaHasta">' + fe('vigenciaHasta') + '</label>' // R201 · se calcula con la frecuencia y se puede editar
        : '<label>Vence / cubre hasta <small>(opcional)</small><input type="date" name="vigenciaHasta">' + fe('vigenciaHasta') + '</label>') + // R200i · activación: no se vuelve a pagar hasta que venza
      (ctx.cuentaId ? '<input type="hidden" name="cantidad" value="1">' : '<label>Cantidad<input type="number" name="cantidad" min="1" step="1" value="1" placeholder="Ej. 1">' + fe('cantidad') + '</label>') +
      '<label>Pagado con<select name="pago">' + [['banco', 'Banco / tarjeta (Lempiras o divisa)'], ['binance_hist', 'Binance USDT · ya pagado (histórico)'], ['binance', 'Binance USDT · descontar del saldo en Sublichat'], ['credito', 'A crédito (por pagar)'], ['inicial', 'Inventario inicial (ya lo tenía)']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === pagoSel ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
      '<label>Proveedor<select name="proveedorId"><option value="">— sin proveedor —</option>' + (d.proveedores || []).filter(function (p) { return p.activo; }).map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.alias) + '</option>'; }).join('') + '</select>' + fe('proveedorId') + '</label>' +
      '<label>Moneda<select name="moneda">' + monedas.map(function (x) { return '<option' + (x === monSel ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>' + fe('moneda') + '</label>' +
      '<label>Costo total<input type="number" name="costoTotal" min="0" step="any" inputmode="decimal">' + fe('costoTotal') + '</label>' +
      '<label data-si="banco">Banco del libro<select name="bancoId"><option value="">— elegir —</option>' + (d.metodos || []).map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.nombre) + '</option>'; }).join('') + '</select>' + fe('bancoId') + '</label>' +
      '<label data-si="hist">Tasa HNL por USDT<input type="number" name="tasa" min="0" step="any" inputmode="decimal" placeholder="Ej. 28.00">' + fe('tasa') + '</label>' +
      '<label data-si="hist">o Lempiras que pagó<input type="number" name="hnlHist" min="0" step="any" inputmode="decimal" placeholder="Ej. 280">' + fe('hnlHist') + '</label>' +
      '<div class="fz-cuenta-ro" data-si="hist"><small>Equivalente en Lempiras</small><b data-equiv>—</b><span>Gasto ya pagado: no descuenta saldo de Binance ni de bancos.</span></div>' +
      '<label data-si="divisa">Cargo real en Lempiras<input type="number" name="cargoHnl" min="0" step="any" inputmode="decimal" placeholder="Se calcula con la tasa BAC (USD)">' + fe('cargoHnl') + '</label>' +
      '<p class="fz-sub w2" data-si="divisa" data-tasa-bac></p>' +
      (dur != null ? '<input type="hidden" name="duracionDias" value="' + dur + '">' : '') +
      '<label class="w2">Referencia<input name="referencia" maxlength="80" placeholder="Comprobante o nota (opcional)"></label></div>' +
      '<p class="fz-sub" data-nota></p>';
    function ajustar(m) { // muestra solo los campos compatibles
      var pago = val(m, 'pago'), mon = val(m, 'moneda'), bin = pago === 'binance' || pago === 'binance_hist';
      if (bin && monedas.indexOf('USDT') >= 0 && mon !== 'USDT') { m.querySelector('[name="moneda"]').value = 'USDT'; mon = 'USDT'; }
      m.querySelector('[data-si="banco"]').hidden = pago !== 'banco';
      m.querySelectorAll('[data-si="hist"]').forEach(function (x) { x.hidden = pago !== 'binance_hist'; });
      var eq = m.querySelector('[data-equiv]'), cu = Number(val(m, 'costoTotal')), ta = Number(val(m, 'tasa')), hh = Number(val(m, 'hnlHist')); if (eq) eq.textContent = hh > 0 ? L(hh, true) + (cu > 0 ? ' (tasa ' + (Math.round(hh / cu * 10000) / 10000) + ')' : '') : cu > 0 && ta > 0 ? L(Math.round(cu * ta * 100) / 100, true) + ' (' + cu + ' USDT × ' + ta + ')' : '—';
      m.querySelectorAll('[data-si="divisa"]').forEach(function (x) { x.hidden = !(pago === 'banco' && mon !== 'HNL'); }); // R200i · USDT pagado con banco también pide los Lempiras
      if (pago === 'banco' && mon === 'USD') usarTasaBac(m); // R200g
      var n = m.querySelector('[data-nota]');
      n.textContent = (pago === 'binance_hist' ? 'Compra ya pagada en Binance: se guarda USDT, fecha real, tasa y Lempiras una sola vez, sin tocar saldos.' : mon === 'HNL' ? 'Costo en Lempiras: no necesita conversión.' : mon === 'USDT' ? 'USDT: se descuenta de la billetera Binance a su tasa del día; la tasa queda guardada en esta compra y no cambia después.' : (mon === 'USD' ? 'Dólares: el cargo en Lempiras se calcula solo con la tasa de venta de BAC Honduras del día; si el banco cobró otro monto, escriba el real. La tasa queda guardada en esta compra.' : 'Divisa: escriba el cargo REAL en Lempiras que cobró el banco; esa tasa queda guardada en esta compra y no cambia después.')) +
        (ctx.frecuencia ? ' Período: ' + ({ mensual: '1 mes', trimestral: '3 meses (se reparte en los 3 meses en reportes; el pago queda en su fecha)', anual: '12 meses (se reparte en reportes; el pago queda en su fecha)', puntual: 'por activación, sin cobro mensual' }[ctx.frecuencia] || '') + '.' : '');
    }
    function validar(m) {
      var e = {}, pago = val(m, 'pago'), mon = val(m, 'moneda'), costo = Number(val(m, 'costoTotal'));
      if (!val(m, 'productoId')) e.productoId = 'Elija el producto.';
      if (!val(m, 'fecha') || val(m, 'fecha') > hoy) e.fecha = 'Fecha inválida (no puede ser futura).';
      if (!ctx.cuentaId && !(Number(val(m, 'cantidad')) > 0)) e.cantidad = 'Cantidad mayor que 0.';
      if (!(costo > 0) && pago !== 'inicial') e.costoTotal = 'Escriba el costo (mayor que 0).';
      if (ctx.plataforma === 'primevideo' && mon === 'USDT') e.moneda = 'Prime Video se paga en USD (no USDT).';
      if ((pago === 'binance' || pago === 'binance_hist') && mon !== 'USDT') e.moneda = 'Binance se paga en USDT.';
      if (pago === 'binance_hist' && !(Number(val(m, 'tasa')) > 0) && !(Number(val(m, 'hnlHist')) > 0)) e.tasa = 'Escriba la tasa HNL/USDT o los Lempiras que pagó.';
      if (val(m, 'vigenciaHasta') && val(m, 'vigenciaHasta') < (val(m, 'fechaActivacion') || val(m, 'fecha'))) e.vigenciaHasta = 'No puede vencer antes de la activación/pago.';
      if (val(m, 'fechaActivacion') && val(m, 'fechaActivacion') > hoy) e.fechaActivacion = 'No puede ser futura.';
      if (pago === 'banco' && !val(m, 'bancoId')) e.bancoId = 'Elija de qué banco salió el pago.';
      if (pago === 'banco' && mon !== 'HNL' && !(Number(val(m, 'cargoHnl')) > 0)) e.cargoHnl = 'Escriba el cargo real en Lempiras.';
      if (pago === 'credito' && !val(m, 'proveedorId')) e.proveedorId = 'A crédito: elija a qué proveedor se le debe.';
      return e;
    }
    // R201 · Próximo pago de la cuenta madre: fecha de pago (o de activación) + 1 mes / 3 meses / 12 meses según la frecuencia.
    // Si es por activación (puntual) queda vacío para que se escriba la fecha real de vencimiento. El usuario siempre puede cambiarla.
    var MESES_FREC = { mensual: 1, trimestral: 3, anual: 12 };
    function sumarMeses(ymd, n) { if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '') || !n) return ''; var p = ymd.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1 + n, 1, 12)), fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).getUTCDate(); d.setUTCDate(Math.min(p[2], fin)); return d.toISOString().slice(0, 10); }
    function proponerVence(m) {
      if (!ctx.cuentaId) return; var inp = m.querySelector('[name="vigenciaHasta"]'); if (!inp || inp.dataset.editado === '1') return;
      var n = MESES_FREC[ctx.frecuencia]; inp.value = n ? sumarMeses(val(m, 'fechaActivacion') || val(m, 'fecha'), n) : '';
    }
    var opid = opId();
    modal(ctx.titulo || 'Registrar compra', html, async function (m) {
      var pago = val(m, 'pago'), mon = val(m, 'moneda');
      var hist = pago === 'binance_hist'; if (hist) pago = 'binance';
      var compra = { productoId: val(m, 'productoId'), proveedorId: val(m, 'proveedorId'), fecha: val(m, 'fecha'), fechaActivacion: val(m, 'fechaActivacion'), cantidad: Number(val(m, 'cantidad')) || 1, costoTotal: Number(val(m, 'costoTotal')), moneda: mon, pago: pago, binanceHistorico: hist, tasa: hist && Number(val(m, 'tasa')) > 0 ? Number(val(m, 'tasa')) : undefined, bancoId: pago === 'banco' ? val(m, 'bancoId') : '', cargoHnl: hist ? Number(val(m, 'hnlHist')) || 0 : pago === 'banco' && mon !== 'HNL' ? Number(val(m, 'cargoHnl')) || 0 : 0, referencia: val(m, 'referencia') || (ctx.cuentaId ? (ctx.plataformaNombre || '') + ' · ' + (ctx.correo || '') : '') };
      if (ctx.cuentaId) compra.cuentaInventarioId = ctx.cuentaId;
      if (val(m, 'duracionDias') !== '') compra.duracionDias = Number(val(m, 'duracionDias'));
      if (val(m, 'vigenciaHasta')) { var ini = val(m, 'fechaActivacion') || val(m, 'fecha'); compra.vigenciaHasta = val(m, 'vigenciaHasta'); compra.duracionDias = Math.max(1, Math.round((Date.parse(compra.vigenciaHasta + 'T12:00:00Z') - Date.parse(ini + 'T12:00:00Z')) / 864e5)); } // R200i
      var r = await api('fin_compra_registrar', { operationId: opid, compra: compra });
      if (ctx.despues) await ctx.despues(r, compra);
      toast(r.duplicado ? 'Esa compra ya estaba registrada (no se duplicó).' : 'Compra guardada · folio ' + folio(r.loteId) + (r.costoTotalHnl != null ? ' · ' + L(r.costoTotalHnl, true) : '') + '.');
      if (ctx.alGuardar) ctx.alGuardar(r); cargar(true);
    }, 'Guardar compra', { validar: validar, alAbrir: function (m) { proponerVence(m); m.addEventListener('input', function (e) { if (e.target.name === 'vigenciaHasta') e.target.dataset.editado = '1'; if (e.target.name === 'fecha' || e.target.name === 'fechaActivacion') proponerVence(m); }); m.addEventListener('change', function (e) { if (e.target.name === 'fecha' || e.target.name === 'fechaActivacion') proponerVence(m); }); ajustar(m); m.addEventListener('change', function () { ajustar(m); }); m.addEventListener('input', function (e) { if (e.target.name === 'costoTotal' || e.target.name === 'tasa' || e.target.name === 'hnlHist') ajustar(m); }); } });
  }
  // R200g · plataforma sin producto en el catálogo: se ofrece crearlo (sin costo de referencia: nunca una tarifa fija).
  function crearProductoPlataforma(plat, nombre, alListo) {
    var link = plat === 'disneyp' || plat === 'disneys' || plat === 'hbomax';
    var html = '<p>No hay producto de <b>' + esc(nombre) + '</b> en el catálogo de Finanzas. Créelo para que sus pagos cuenten en Ganancias.</p>' +
      '<div class="fz-form"><label class="w2">Nombre<input name="nombre" maxlength="80" value="' + esc(nombre + (link ? ' (link)' : ' · cuenta madre')) + '"></label>' +
      '<label>Modelo<select name="modelo"><option value="link"' + (link ? ' selected' : '') + '>Link / activación</option><option value="cuenta_madre"' + (link ? '' : ' selected') + '>Cuenta madre / perfiles</option></select></label>' +
      '<label>Duración (días)<input type="number" name="dur" min="0" value="30"></label></div><p class="fz-sub">Sin costo de referencia: el costo real sale de cada pago que registre.</p>';
    modal('Crear producto · ' + nombre, html, async function (m) {
      await api('fin_producto_guardar', { producto: { nombre: val(m, 'nombre'), categoria: 'perfiles', modelo: val(m, 'modelo'), capacidad: 1, duracionDias: Number(val(m, 'dur')) || 0, plataformaKey: plat } });
      toast('Producto creado. Ya puede registrar el pago.'); if (alListo) alListo(); cargar(true);
    }, 'Crear producto');
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

  // ---------------------------------------------------------------------------------------------------- R200a · Eliminar / anular compra
  // Muestra producto, fecha, importe original, moneda, tasa, proveedor, cuenta, pago y DEPENDENCIAS (ventas ya costeadas,
  // conciliación, cuenta por pagar). Motivo obligatorio. Con ventas costeadas pide una segunda confirmación explícita.
  // Un solo operationId por apertura: dos clics o un reintento de red no anulan dos veces.
  async function abrirAnularCompra(id, modo) {
    var cargando = modal(modo === 'ver' ? 'Detalle de la compra' : 'Eliminar compra', '<div class="fz-vacio-s"><span class="fz-spin"></span> Revisando dependencias…</div>');
    var r;
    try { r = await api('fin_compra_dependencias', { loteId: id }); } catch (e) { cargando.remove(); toast(e.message, true); return; }
    cargando.remove();
    var c = r.compra, dp = r.dependencias, ventas = dp.ventasCosteadas || [];
    var fila = function (k, v) { return '<div class="fz-lin"><div><b>' + k + '</b></div><strong>' + v + '</strong></div>'; };
    var det = '<div class="fz-detalle-compra">' + fila('Folio', esc(c.folio)) + fila('Producto', esc(c.producto)) + fila('Fecha de la compra', fecha(c.fecha)) +
      fila('Importe original', (c.moneda === 'HNL' ? L(c.costoTotalMoneda, true) : esc(c.costoTotalMoneda) + ' ' + esc(c.moneda))) + fila('Tasa guardada', c.moneda === 'HNL' ? '—' : esc(c.tasa)) +
      fila('Costo en Lempiras', L(c.costoTotalHnl, true)) + fila('Proveedor', esc(c.proveedor || '—')) + fila('Pagado con', esc(c.pago || '—')) + fila('Cuenta madre', esc(c.cuentaInventarioId || 'Sin cuenta madre')) + fila('Cantidad', esc(c.cantidad) + ' ' + esc(c.unidad || '')) +
      fila('Usado / disponible', esc(c.consumido) + ' / ' + esc(c.disponible)) + fila('Estado', c.estado === 'anulado' ? '<span class="fz-pill mal">Anulada</span>' : '<span class="fz-pill ok">Vigente</span>') + '</div>';
    var depHtml = '<h4 class="fz-h4">Dependencias</h4>' +
      (ventas.length ? '<p class="fz-sub"><b>' + ventas.length + ' venta(s) ya tomaron su costo de esta compra (' + L(dp.costoVentasHnl, true) + ').</b> Al anular, ese costo se reversa en el mes de cada venta y quedan «pendientes de costo» hasta registrarse otra compra real.</p><div class="fz-tw"><table class="fz-t sm"><thead><tr><th>Fecha</th><th>Cliente</th><th>Plataforma</th><th class="n">Unidades</th><th class="n">Costo</th></tr></thead><tbody>' +
        ventas.slice(0, 50).map(function (v) { return '<tr><td>' + fecha(v.fecha) + '</td><td>' + esc(v.cliente || '—') + '</td><td>' + esc(v.plataforma || '') + '</td><td class="n">' + esc(v.unidades) + '</td><td class="n">' + L(v.costoHnl, true) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="fz-sub">Ninguna venta ha usado esta compra.</p>') +
      (dp.ciclo ? '<p class="fz-sub">Conciliada con la cuenta ' + esc(dp.ciclo.cuentaInventarioId) + (dp.ciclo.coberturaDesde ? ' (cobertura ' + fecha(dp.ciclo.coberturaDesde) + ' – ' + fecha(dp.ciclo.coberturaHasta) + ')' : '') + ': la conciliación quedará anulada.</p>' : '') +
      (dp.cxp ? '<p class="fz-sub">Compra a crédito: saldo ' + esc(dp.cxp.saldo) + ' de ' + esc(dp.cxp.total) + (dp.cxp.pagos ? ' · ' + dp.cxp.pagos + ' pago(s) hechos' : '') + '.</p>' : '') +
      (dp.pagoContabilizado ? '<p class="fz-sub">El pago se anula con su <b>reversa</b> en el libro (el banco o Binance vuelven exactos y queda el rastro). La tasa y el costo originales no cambian.</p>' : '');
    var bloq = (r.bloqueos || []).length ? '<div class="fz-alerta alta"><div><b>No se puede anular todavía</b><span>' + esc(r.bloqueos.join(' ')) + '</span></div></div>' : '';
    if (modo === 'ver' || c.estado === 'anulado') { modal('Detalle de la compra', det + depHtml); return; }
    var accion = r.modo === 'eliminar' ? 'Eliminar borrador' : 'Anular compra';
    var form = '<div class="fz-form"><label class="w2">Motivo (obligatorio)<input name="motivo" maxlength="300" placeholder="Ej. registrada dos veces; monto equivocado"><span class="fz-fe" data-fe="motivo" hidden></span></label>' +
      (ventas.length ? '<label class="fz-check w2"><input type="checkbox" name="confirmarDep"> Entiendo: el costo de ' + ventas.length + ' venta(s) se reversa y quedan pendientes de costo.</label>' : '') + '</div>';
    var opid = opId();
    var m = modal(accion + ' · ' + c.producto, bloq + det + depHtml + (r.bloqueos && r.bloqueos.length ? '' : form), (r.bloqueos && r.bloqueos.length) ? null : async function (mm) {
      var x = await api('fin_compra_anular', { loteId: id, motivo: val(mm, 'motivo'), confirmarDependencias: !!(mm.querySelector('[name="confirmarDep"]') || {}).checked, operationId: opid });
      toast(x.duplicado || x.yaAnulada ? 'Esa compra ya estaba anulada (no se repitió).' : x.modo === 'eliminar' ? 'Borrador eliminado. Quedó copia en la auditoría.' : 'Compra anulada' + (x.ventasPendientes ? ' · ' + x.ventasPendientes + ' venta(s) quedan pendientes de costo' : '') + '.');
      delete st.gan[ganClave()]; cargar(true);
    }, accion, { validar: function (mm) {
      var e = {}; if (String(val(mm, 'motivo') || '').trim().length < 8) e.motivo = 'Escriba el motivo (mínimo 8 letras).';
      if (ventas.length && !(mm.querySelector('[name="confirmarDep"]') || {}).checked) e.motivo = e.motivo || 'Marque la confirmación de las ventas afectadas.';
      return e; } });
    var okb = m && m.querySelector('[data-ok]'); if (okb) okb.classList.add('fz-btn-peligro');
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
      if ((t = e.target.closest('[data-fz-dashq]'))) { if (t.dataset.fzDashq === 'todo') { st.dash.plat = st.dash.vend = st.dash.banco = ''; } else st.dash[t.dataset.fzDashq] = ''; pintar(); return; } // R200h
      if ((t = e.target.closest('[data-fz-tv]'))) { tvIniciar(!st.dash.tv); return; }
      if ((t = e.target.closest('[data-fz-trans]'))) { abrirTransacciones({}); return; } // R200b
      if ((t = e.target.closest('[data-fz-graf-pend]'))) { abrirTransacciones({ cubierto: false }); return; }
      if ((t = e.target.closest('[data-fz-compra]'))) { h.querySelectorAll('.fz-menu.on').forEach(function (x) { x.classList.remove('on'); }); abrirAnularCompra(t.dataset.id, t.dataset.fzCompra); return; } // R200a
      if ((t = e.target.closest('[data-fz-spf]'))) { abrirSpf(t.dataset.fzSpf, t.dataset.id); return; }
      if ((t = e.target.closest('[data-fz-hbo]'))) { abrirHbo(t.dataset.fzHbo, t.dataset.id); return; }
      if ((t = e.target.closest('[data-fz-ganmes]'))) { var mg = t.dataset.fzGanmes, pg = mg.split('-'); st.ganR = { desde: mg + '-01', hasta: mg + '-' + String(new Date(Date.UTC(+pg[0], +pg[1], 0)).getUTCDate()).padStart(2, '0') }; pintar(); return; }
      if ((t = e.target.closest('[data-fz-gantri]'))) { var gm = (st.gan[ganClave()] || {}).meses || []; if (gm.length >= 3) { var u = gm[gm.length - 1].mes, pu = u.split('-'); st.ganR = { desde: gm[gm.length - 3].mes + '-01', hasta: u + '-' + String(new Date(Date.UTC(+pu[0], +pu[1], 0)).getUTCDate()).padStart(2, '0') }; pintar(); } return; }
      if ((t = e.target.closest('[data-fz-rentplat]'))) { abrirRentPlat(t.dataset.fzRentplat); return; } // R198j
      if ((t = e.target.closest('[data-fz-rentre]'))) { cargarRent(true); return; }
      if ((t = e.target.closest('[data-fz-ganplat]'))) { abrirPlataforma(t.dataset.fzGanplat); return; } // R197b · antes solo filtraba la tabla de abajo (parecía no abrir)
      if ((t = e.target.closest('[data-fz-gancta]'))) { abrirGanCuenta(t.dataset.fzGancta); return; }
      if ((t = e.target.closest('[data-fz-hist]'))) { verHistorial(t.dataset.fzHist === 'spotify' ? { spotifyFamiliaId: t.dataset.id } : { cuentaId: t.dataset.id }, t.dataset.titulo || ''); return; } // R200g
      if ((t = e.target.closest('[data-fz-gc]'))) { abrirGiftcards(t.dataset.fzGc); return; } // R200i
      if ((t = e.target.closest('[data-fz-cta]'))) { abrirCuenta(t.dataset.fzCta, t.dataset.plat, t.dataset.id); return; }
      if ((t = e.target.closest('[data-fz-ctaf]'))) { st.ctaF[st.sub] = t.dataset.fzCtaf; pintar(); return; }
      if ((t = e.target.closest('[data-fz-cta-retry]'))) { delete st.cta[t.dataset.fzCtaRetry]; pintar(); return; } // R201
      if ((t = e.target.closest('[data-fz-vip]'))) { h.querySelectorAll('.fz-menu.on').forEach(function (x) { x.classList.remove('on'); }); abrirVip(t.dataset.fzVip, t.dataset.id); return; }
      h.querySelectorAll('.fz-menu.on').forEach(function (x) { x.classList.remove('on'); });
      if (!(t = e.target.closest('[data-fz]'))) return;
      var a = t.dataset.fz;
      if (a === 'reintentar') cargar(true);
      else if (a === 'ganrango') { var dd = (document.querySelector('[data-fz-ganr="desde"]') || {}).value, hh = (document.querySelector('[data-fz-ganr="hasta"]') || {}).value; if (/^\d{4}-\d{2}-\d{2}$/.test(dd) && /^\d{4}-\d{2}-\d{2}$/.test(hh)) { st.ganR = { desde: dd, hasta: hh }; pintar(); } }
      else if (a === 'ganexcel') ganExcel(t);
      else if (a === 'excelfin') excelFinanciero(t); // R200c
      else if (a === 'ganaud') abrirAuditoria(); // R197c · auditoría solo lectura (vigente ≠ cobrado)
      else if (a === 'ganrecargar') { delete st.gan[ganClave()]; pintar(); }
      else if (a === 'costear') { t.disabled = true; t.textContent = 'Calculando…'; api('finp_costear', { limite: 40 }).then(function (r) { var c = r.costeo || {}; toast(c.activo === false ? (c.motivo || 'Costeo apagado.') : 'Costos al día: ' + (c.costeadas || 0) + ' venta(s) costeadas.'); cargar(true); }).catch(function (e) { toast(e.message, true); cargar(true); }); }
      else if (a === 'productos') abrirProductos();
      else if (a === 'compra') abrirCompra(t.dataset.prod || '');
      else if (a === 'prov') abrirProveedor(t.dataset.id || '');
      else if (a === 'umbral') modal('Objetivo de margen', '<div class="fz-form"><label class="w2">Alertar cuando el margen de un producto sea menor a (%)<input type="number" name="u" min="0" max="95" step="0.5" value="' + esc(st.data.config.umbralMargen) + '"></label></div>', async function (m) { await api('finp_config', { umbralMargen: Number(val(m, 'u')) }); toast('Objetivo guardado.'); cargar(true); });
      else if (a === 'importar') confirmarImport();
      else if (a === 'errores') descargarErrores();
      else if (a === 'cancelarimp') { st.imp = null; pintar(); }
      else if (a === 'reprevia') previa();
      else if (a === 'previasimple') previaSimple();
      else if (a === 'importarsimple') confirmarSimple();
      else if (a === 'deshacer') modal('Deshacer importación', '<p>Restaura los vínculos y lotes VIP a como estaban antes de esa importación. Solo se puede deshacer la última.</p>', async function () { var r = await api('finp_vip_deshacer', { jobId: t.dataset.id }); toast('Deshecha: ' + r.extras + ' vínculo(s), ' + r.lotes + ' lote(s).'); st.jobs = null; st.vip.res = null; cargar(true); }, 'Deshacer');
      else if (a === 'excel') descargarExcel(t);
    });
    h.addEventListener('change', function (e) {
      var t = e.target;
      if (t.matches('[data-fz-mes]')) { if (/^\d{4}-\d{2}$/.test(t.value)) { st.mes = t.value; st.ganR = null; st.rep.desde = st.rep.hasta = ''; cargar(true); } }
      if (t.matches('[data-fz-ganf]')) { st.ganF[t.dataset.fzGanf] = t.value; pintar(); }
      if (t.matches('[data-fz-graf]')) { st.graf[t.dataset.fzGraf] = t.value; pintar(); return; } // R200b
      if (t.matches('[data-fz-dash]')) { // R200h · filtros del dashboard
        var k = t.dataset.fzDash;
        if (k === 'periodo') { st.dash.periodo = t.value; var rg = dashRango(t.value); if (t.value === 'mes') st.ganR = null; else if (rg) st.ganR = rg; else st.ganR = ganRango(); st.dashProx = st.dashProx; cargarGan(); pintar(); return; }
        if (k === 'desde' || k === 'hasta') { var cur = ganRango(); var nr = { desde: cur.desde, hasta: cur.hasta }; nr[k] = t.value; if (/^\d{4}-\d{2}-\d{2}$/.test(nr.desde) && /^\d{4}-\d{2}-\d{2}$/.test(nr.hasta) && nr.desde <= nr.hasta) { st.ganR = nr; cargarGan(); pintar(); } return; }
        st.dash[k] = t.value; pintar(); return;
      }
      if (t.matches('[data-fz-compf]') && t.dataset.fzCompf !== 'q') { st.compF[t.dataset.fzCompf] = t.value; pintar(); } // R200a
      else if (t.matches('[data-fz-file]') && t.files[0]) leerArchivo(t.files[0]);
      else if (t.matches('[data-fz-res]')) { st.imp.res[t.dataset.fzRes] = t.value; }
      else if (t.matches('[data-fz-confirmo]')) { st.imp.confirmo = t.checked; }
      else if (t.matches('[data-fz-tasa]')) { st.imp.tasa = t.value; }
      else if (t.matches('[data-fz-rep]')) { st.rep[t.dataset.fzRep] = t.value; }
    });
    var tcq; h.addEventListener('input', function (e) { if (e.target.matches('[data-fz-compf="q"]')) { clearTimeout(tcq); var v = e.target.value; tcq = setTimeout(function () { st.compF.q = v; pintar(); var i = h.querySelector('[data-fz-compf="q"]'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 300); } }); // R200a
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
