/* pendientes-web.js · R211 — Sublichat Web › Finanzas › Pendientes.
   Lo mismo que Control financiero › Pendientes de la APK, contra las MISMAS acciones de /api/finanzas:
   listar_pendientes (resumen + detalle paginado, filtro en servidor), registrar_abono, registrar_pago_masivo
   (fecha REAL, banco o «ya está registrado» sin duplicar ingreso, transacción + idempotencia) y
   listar_obligaciones_previa (solo lectura; incluye la regla del 50 % de Geisell).
   Lo que se liquida aquí se ve igual en la APK y en el bot (misma colección cuentas_por_cobrar). */
(function () {
  'use strict';
  if (window.SublichatPendientesWeb) return;
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function L(n) { var v = r2(n); return 'L' + v.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }); }
  function periodoDe(c) { var m = String(c.fechaOperacion || c.fechaPago || c.createdAt || '').match(/^(\d{4})-(\d{2})/); return m ? m[1] + '-' + m[2] : ''; }
  function perTxt(p) { var x = String(p).split('-'); return x.length === 2 ? MESES[+x[1] - 1] + ' ' + x[0] : 'sin fecha'; }
  function hoyHN() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tegucigalpa' }); }
  function opId() { return 'pw-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }

  var st = { filtro: '', periodo: '', datos: null, cargando: false, error: '', sel: {}, metodos: null, masivo: null, previa: null, enviando: false, seq: 0 };
  var api = null, host = null;

  function cargar(mas) {
    var seq = ++st.seq, prev = mas && st.datos && !st.error ? st.datos : null, pagina = prev ? prev.pagina + 1 : 1;
    st.cargando = true; st.error = ''; if (!prev) st.datos = null; pintar();
    var limite = new Promise(function (_, no) { setTimeout(function () { no(new Error('La cartera tardó demasiado en responder. Toque Reintentar.')); }, 20000); });
    Promise.race([api('listar_pendientes', Object.assign({ pagina: pagina, porPagina: 50 }, st.filtro ? { deudorTipo: st.filtro } : {})), limite]).then(function (r) {
      if (seq !== st.seq) return;
      st.datos = { rows: (prev ? prev.rows : []).concat(r.cuentas || []), total: r.total, pagina: r.pagina || 1, paginas: r.paginas || 1, importe: r.importeFiltro, cartera: r.cartera, ms: r.ms };
    }).catch(function (e) { if (seq === st.seq) st.error = e.message || 'No se pudo leer la cartera.'; })
      .then(function () { if (seq === st.seq) { st.cargando = false; pintar(); } });
  }
  function metodos() { if (st.metodos) return Promise.resolve(st.metodos); return api('finanzas_metodos').then(function (r) { st.metodos = r.metodos || []; return st.metodos; }); }
  function seleccion() { var rows = ((st.datos && st.datos.rows) || []).filter(function (c) { return st.sel[c.id]; }); return { rows: rows, total: r2(rows.reduce(function (a, c) { return a + r2(c.saldoPendiente); }, 0)) }; }

  function pintar() {
    if (!host || !host.isConnected) return;
    var d = st.datos, c = (d && d.cartera) || null, h = '';
    h += '<div class="fz-card pw-tot"><div class="pw-row"><b>Pendiente total</b><b class="pw-neg">' + (c ? L(c.pendienteTotal) : '—') + '</b></div><p class="fz-sub">' +
      (c ? 'Clientes ' + L(c.pendienteClientes) + ' · Vendedores ' + L(c.pendienteVendedores) + ' · ' : '') + 'no suma a bancos ni al disponible hasta que se cobre.</p>' +
      '<div class="pw-chips">' + [['', 'Todos'], ['cliente', 'Clientes'], ['vendedor', 'Vendedores']].map(function (x) { return '<button type="button" class="fz-tab' + (st.filtro === x[0] ? ' on' : '') + '" data-pw-f="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    var ps = []; ((d && d.rows) || []).forEach(function (x) { var p = periodoDe(x); if (p && ps.indexOf(p) < 0) ps.push(p); }); ps.sort();
    if (ps.length > 1) h += '<div class="pw-chips">' + [''].concat(ps).map(function (p) { return '<button type="button" class="pw-chip' + (st.periodo === p ? ' on' : '') + '" data-pw-per="' + esc(p) + '">' + (p ? esc(perTxt(p)) : 'Todos los meses') + '</button>'; }).join('') + '</div>';
    h += '</div>';
    h += masivoHtml();
    if (!d && st.cargando) h += '<div class="fz-card fz-vacio"><span class="fz-spin"></span><b>Cargando el detalle…</b></div>';
    else if (st.error && !d) h += '<div class="fz-card fz-vacio"><b>No se pudo leer la cartera</b><span>' + esc(st.error) + '</span><button type="button" class="fz-btn" data-pw="reintentar">Reintentar</button></div>';
    else if (d) {
      var lista = d.rows.filter(function (x) { return !st.periodo || periodoDe(x) === st.periodo; });
      h += '<p class="fz-sub">' + d.total + ' cuenta' + (d.total === 1 ? '' : 's') + ' · ' + L(d.importe) + (d.ms != null ? ' · ' + (d.ms / 1000).toFixed(1) + ' s' : '') + '</p>';
      h += lista.length ? '<div class="fz-card pw-lista"><table class="pw-t"><thead><tr><th></th><th>Deudor</th><th>Origen</th><th>Detalle</th><th class="n">Total</th><th class="n">Pagado</th><th class="n">Pendiente</th><th>Estado</th></tr></thead><tbody>' + lista.map(fila).join('') + '</tbody></table></div>' : '<div class="fz-card fz-vacio"><b>✅ No hay pendientes' + (st.filtro ? (st.filtro === 'cliente' ? ' de clientes' : ' de vendedores') : '') + '.</b></div>';
      if (d.pagina < d.paginas) h += '<button type="button" class="fz-btn sec" data-pw="mas">' + (st.cargando ? 'Cargando…' : 'Ver más (' + (d.total - d.rows.length) + ' restantes)') + '</button>';
    }
    h += previaHtml();
    host.innerHTML = '<div class="pw">' + h + '</div>';
  }
  function fila(c) {
    var pagado = r2((Number(c.montoRecibidoInicial) || 0) + (Number(c.montoRecibidoPosterior) || 0));
    return '<tr class="' + (st.sel[c.id] ? 'sel' : '') + '"><td><input type="checkbox" data-pw-sel="' + esc(c.id) + '"' + (st.sel[c.id] ? ' checked' : '') + ' aria-label="Seleccionar"></td>' +
      '<td><b>' + (c.deudorTipo === 'vendedor' ? '🧑‍💼 ' : '👤 ') + esc(c.deudorNombre || '—') + '</b>' + (c.reglaVendedor ? '<small class="pw-regla">🤝 50 % · de ' + L(c.reglaVendedor.base) + '</small>' : '') + '</td>' +
      '<td>' + esc(perTxt(periodoDe(c))) + '</td><td>' + esc((c.tipoOrigen === 'compra' ? 'Compra ' : 'Renovación ') + (c.plataforma || '')) + (c.deudorTipo === 'vendedor' && c.clienteNombre ? '<small>cliente ' + esc(c.clienteNombre) + '</small>' : '') + '</td>' +
      '<td class="n">' + L(c.montoTotalOperacion) + '</td><td class="n">' + L(pagado) + '</td><td class="n"><b class="pw-neg">' + L(c.saldoPendiente) + '</b></td><td><span class="fz-pill ' + (c.estado === 'parcial' ? 'warn' : 'pend') + '">' + esc(c.estado) + '</span></td></tr>';
  }
  function masivoHtml() {
    var s = seleccion(), M = st.masivo, h = '';
    if (s.rows.length && !M) h += '<div class="fz-card pw-selbar"><span><b>' + s.rows.length + '</b> seleccionada' + (s.rows.length === 1 ? '' : 's') + ' · <b>' + L(s.total) + '</b></span><button type="button" class="fz-btn" data-pw="abrir">' + (s.rows.length > 1 ? 'Registrar pago masivo' : 'Registrar pago') + '</button><button type="button" class="fz-btn sec" data-pw="limpiar">Quitar selección</button></div>';
    if (M && !M.resultado) {
      var deud = {}; s.rows.forEach(function (c) { deud[c.deudorTipo + '|' + c.deudorNombre] = 1; }); var varios = Object.keys(deud).length > 1;
      var cand = []; ((M.previa && M.previa.grupos) || []).forEach(function (g) { cand = cand.concat(g.posiblesPagos || []); });
      h += '<div class="fz-card pw-form"><h3>' + (s.rows.length > 1 ? 'Pago masivo' : 'Registrar pago') + ' · ' + esc((s.rows[0] || {}).deudorNombre || '') + '</h3>' +
        (varios ? '<p class="fz-err">Elija obligaciones de un solo cliente o vendedor por pago.</p>' : '') +
        '<p class="fz-sub">' + s.rows.length + ' obligación(es) · ' + s.rows.map(function (c) { return perTxt(periodoDe(c)); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') + ' · seleccionado ' + L(s.total) + '</p>' +
        '<div class="pw-grid"><label>Fecha REAL del pago<input type="date" data-pw-in="fecha" value="' + esc(M.fecha) + '" max="' + hoyHN() + '"></label><label>Importe recibido<input type="number" min="0" step="0.01" data-pw-in="monto" value="' + esc(M.monto) + '"></label></div>' +
        '<div class="pw-chips"><button type="button" class="fz-tab' + (M.modo !== 'vincular' ? ' on' : '') + '" data-pw-modo="nuevo">Entró a un banco</button><button type="button" class="fz-tab' + (M.modo === 'vincular' ? ' on' : '') + '" data-pw-modo="vincular">Ya está registrado</button></div>' +
        (M.modo === 'vincular' ? (M.cargando ? '<p class="fz-sub">Buscando pagos ya registrados…</p>' : cand.length ? '<p class="fz-sub">Se vincula al movimiento existente: NO se crea otro ingreso.</p><div class="pw-chips">' + cand.map(function (m) { return '<button type="button" class="pw-chip' + (M.vincular === m.movimientoId ? ' on' : '') + '" data-pw-vinc="' + esc(m.movimientoId) + '">' + esc(m.fecha) + ' · ' + L(m.monto) + (m.banco ? ' · ' + esc(m.banco) : '') + '</button>'; }).join('') + '</div>' : '<p class="fz-sub">No hay un pago registrado sin vincular para este deudor. Use «Entró a un banco».</p>')
          : '<div class="pw-chips">' + (st.metodos || []).map(function (m) { return '<button type="button" class="pw-chip' + (M.bancoId === m.id ? ' on' : '') + '" data-pw-banco="' + esc(m.id) + '">' + esc(m.nombre) + '</button>'; }).join('') + '</div>') +
        '<div class="pw-grid"><label>Referencia (opcional)<input data-pw-in="referencia" maxlength="80" value="' + esc(M.referencia || '') + '"></label><label>Observaciones (opcional)<input data-pw-in="obs" maxlength="300" value="' + esc(M.obs || '') + '"></label></div>' +
        '<p class="fz-sub">Se aplica a lo más antiguo primero; si el importe es menor, el resto queda pendiente. La fecha del registro no reemplaza la fecha real.</p>' +
        (M.error ? '<p class="fz-err">' + esc(M.error) + '</p>' : '') +
        '<div class="pw-acc"><button type="button" class="fz-btn" data-pw="confirmar"' + (st.enviando || varios ? ' disabled' : '') + '>' + (st.enviando ? 'Guardando…' : M.error ? 'Reintentar' : 'Confirmar pago') + '</button><button type="button" class="fz-btn sec" data-pw="cancelar">Cancelar</button></div></div>';
    }
    if (M && M.resultado) {
      var r = M.resultado;
      h += '<div class="fz-card pw-form ok"><h3>✅ ' + (r.duplicado ? 'Ese pago ya estaba registrado (no se repitió).' : r.vinculado ? 'Pago conciliado con el movimiento existente' : 'Pago registrado') + '</h3><p class="fz-sub">' + L(r.monto) + ' · pago real ' + esc(r.fechaPagoEfectiva || '') + (r.parcial ? ' · pago parcial' : '') + '</p>' +
        (r.resultados || []).map(function (x) { return '<div class="pw-row"><span>' + esc(perTxt(x.periodo)) + ' · ' + L(x.antes) + ' → ' + L(x.queda) + '</span><span class="fz-pill ' + (x.queda <= 0 ? 'ok' : 'warn') + '">' + (x.aplica > 0 ? (x.queda <= 0 ? 'pagado' : 'parcial') : 'sin cambio') + '</span></div>'; }).join('') +
        '<button type="button" class="fz-btn sec" data-pw="listo">Listo</button></div>';
    }
    return h;
  }
  function previaHtml() {
    var V = st.previa;
    if (!V) return '<button type="button" class="fz-btn sec" data-pw="previa">Vista previa de obligaciones (solo lectura)</button>';
    if (V.cargando) return '<div class="fz-card fz-vacio"><span class="fz-spin"></span><b>Armando la vista previa…</b></div>';
    if (V.error) return '<div class="fz-card fz-vacio"><b>No se pudo armar la vista previa</b><span>' + esc(V.error) + '</span><button type="button" class="fz-btn" data-pw="previa">Reintentar</button></div>';
    var g = (V.grupos || []).map(function (x) {
      return '<div class="pw-grupo"><div class="pw-row"><b>' + (x.deudorTipo === 'vendedor' ? '🧑‍💼 ' : '👤 ') + esc(x.deudorNombre) + '</b><b class="pw-neg">' + L(x.total) + '</b></div>' +
        x.periodos.map(function (p) { return '<small>' + esc(perTxt(p.periodo)) + ': ' + p.cuentas.length + ' obligación(es) · ' + L(p.total) + '</small>'; }).join('') +
        (x.posiblesPagos.length ? '<p class="pw-aviso">Posibles pagos ya registrados sin vincular: ' + x.posiblesPagos.map(function (m) { return esc(m.fecha) + ' ' + L(m.monto); }).join(' · ') + '. Concílielos con «Ya está registrado»; no se suman otra vez.</p>' : '') + '</div>';
    }).join('');
    var G = V.geisell, gh = '';
    if (G && G.filas.length) gh = '<div class="fz-card"><h3>Regla del 50 % de Geisell · vista previa de saldos VIEJOS</h3><p class="fz-sub">Las deudas nuevas ya nacen al 50 %. Esto NO cambia ningún saldo: muestra cómo quedarían los registros anteriores.</p>' +
      '<table class="pw-t"><thead><tr><th>Origen</th><th>Cliente</th><th class="n">Base</th><th class="n">Obligación</th><th class="n">Pagado</th><th class="n">Actual</th><th class="n">Con la regla</th></tr></thead><tbody>' +
      G.filas.map(function (f) { return '<tr><td>' + esc(perTxt(f.periodo)) + '</td><td>' + esc(f.cliente) + (f.yaNeto ? ' <span class="fz-pill ok">ya al 50 %</span>' : '') + '</td><td class="n">' + L(f.base) + '</td><td class="n">' + L(f.obligacion) + '</td><td class="n">' + L(f.pagado) + '</td><td class="n">' + L(f.saldoActual) + '</td><td class="n"><b>' + L(f.saldoPropuesto) + '</b></td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td colspan="5">Totales</td><td class="n">' + L(G.totales.saldoActual) + '</td><td class="n"><b>' + L(G.totales.saldoPropuesto) + '</b></td></tr></tfoot></table>' +
      '<p class="pw-aviso">Para ajustar los saldos viejos falta que Sublicuentas confirme:<br>' + G.preguntas.map(function (q) { return '• ' + esc(q); }).join('<br>') + '</p></div>';
    return '<div class="fz-card"><div class="pw-row"><h3>Vista previa (solo lectura)</h3><b>' + L(V.total) + '</b></div>' + (g || '<p class="fz-sub">Sin obligaciones pendientes.</p>') + '<button type="button" class="fz-btn sec" data-pw="cerrar-previa">Cerrar vista previa</button></div>' + gh;
  }

  function leerForm() { var M = st.masivo; if (!M || !host) return; host.querySelectorAll('[data-pw-in]').forEach(function (i) { M[i.getAttribute('data-pw-in')] = i.value; }); }
  function eventos() {
    if (host.__pw) return; host.__pw = true;
    host.addEventListener('change', function (e) { var t = e.target; if (t.matches('[data-pw-sel]')) { st.sel[t.getAttribute('data-pw-sel')] = t.checked; pintar(); } else if (t.matches('[data-pw-in]')) leerForm(); });
    host.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t || !host.contains(t)) return;
      if (t.hasAttribute('data-pw-f')) { st.filtro = t.getAttribute('data-pw-f'); st.sel = {}; st.periodo = ''; return cargar(); }
      if (t.hasAttribute('data-pw-per')) { st.periodo = t.getAttribute('data-pw-per'); return pintar(); }
      if (t.hasAttribute('data-pw-banco')) { leerForm(); st.masivo.bancoId = t.getAttribute('data-pw-banco'); return pintar(); }
      if (t.hasAttribute('data-pw-vinc')) { leerForm(); st.masivo.vincular = t.getAttribute('data-pw-vinc'); return pintar(); }
      if (t.hasAttribute('data-pw-modo')) {
        leerForm(); var M = st.masivo; M.modo = t.getAttribute('data-pw-modo');
        if (M.modo === 'vincular' && !M.previa) { M.cargando = true; pintar(); var c0 = seleccion().rows[0] || {}; api('listar_obligaciones_previa', { deudor: c0.deudorId || c0.deudorNombre || '' }).then(function (r) { M.previa = r; }).catch(function () { M.previa = { grupos: [] }; }).then(function () { M.cargando = false; pintar(); }); return; }
        return pintar();
      }
      var a = t.getAttribute('data-pw');
      if (a === 'reintentar') return cargar();
      if (a === 'mas') return cargar(true);
      if (a === 'limpiar') { st.sel = {}; return pintar(); }
      if (a === 'abrir') { var s = seleccion(); st.masivo = { op: opId(), modo: 'nuevo', fecha: hoyHN(), monto: s.total }; metodos().then(pintar, function (er) { st.masivo.error = er.message; pintar(); }); return pintar(); }
      if (a === 'cancelar') { st.masivo = null; return pintar(); }
      if (a === 'listo') { st.masivo = null; st.sel = {}; return cargar(); }
      if (a === 'confirmar') {
        leerForm(); var M2 = st.masivo, sx = seleccion(), monto = Number(M2.monto);
        M2.error = '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(M2.fecha || '')) M2.error = 'Escriba la fecha real del pago.';
        else if (!(monto > 0) || monto > sx.total + 0.001) M2.error = 'El importe debe ser mayor que L0 y no pasar de ' + L(sx.total) + '.';
        else if (M2.modo === 'vincular' ? !M2.vincular : !M2.bancoId) M2.error = M2.modo === 'vincular' ? 'Elija el pago ya registrado.' : 'Elija el banco donde entró el pago.';
        if (M2.error) return pintar();
        st.enviando = true; pintar();
        // mismo operationId en cada reintento: si el primero sí llegó, el servidor responde «ya estaba registrado»
        api('registrar_pago_masivo', Object.assign({ cuentas: sx.rows.map(function (c) { return c.id; }), monto: monto, fechaPago: M2.fecha, referencia: M2.referencia || '', observaciones: M2.obs || '', operationId: M2.op }, M2.modo === 'vincular' ? { vincularMovimientoId: M2.vincular } : { bancoId: M2.bancoId }))
          .then(function (r) { M2.resultado = r; }).catch(function (er) { M2.error = (er.message || 'No se pudo guardar') + ' · Puede reintentar: no se duplica.'; })
          .then(function () { st.enviando = false; pintar(); });
        return;
      }
      if (a === 'previa') { st.previa = { cargando: true }; pintar(); api('listar_obligaciones_previa').then(function (r) { st.previa = r; }).catch(function (er) { st.previa = { error: er.message }; }).then(pintar); return; }
      if (a === 'cerrar-previa') { st.previa = null; return pintar(); }
    });
  }
  window.SublichatPendientesWeb = {
    montar: function (el, apiFn) { if (!el) return; host = el; api = apiFn; eventos(); if (!st.datos && !st.cargando && !st.error) cargar(); else pintar(); },
    _estado: st,
  };
})();
