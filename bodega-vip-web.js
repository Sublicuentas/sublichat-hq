// bodega-vip-web.js · R196u — Bodega › ⭐ Netflix VIP (Web). Lee y carga la MISMA colección `inventario` que el bot (/addextra)
// y la APK. Sin claves en pantalla: la vista previa y el listado nunca las traen. Cargar lotes: solo Sublicuentas
// (el servidor lo vuelve a validar). Fondo blanco, sin degradados.
(function () {
  'use strict';
  var st = { abierto: false, data: null, filtro: '', prev: null };
  function api(body) {
    return fetch('/api/inventario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Respuesta inválida del servidor.' }; }); });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var CHIP = { disponible: 'ok', reservado: 'info', asignado: 'pend', suspendido: 'err', revision: 'warn' };
  function box() { return document.getElementById('invVipBox'); }
  function pintar() {
    var b = box(); if (!b) return;
    if (!st.abierto) { b.style.display = 'none'; b.innerHTML = ''; return; }
    b.style.display = '';
    var d = st.data;
    if (!d) { b.innerHTML = '<p class="vip-muted">Cargando Bodega VIP…</p>'; return; }
    if (!d.ok) { b.innerHTML = '<p class="vip-err">⚠️ ' + esc(d.error || 'No se pudo cargar.') + '</p>'; return; }
    var c = d.conteo || {};
    var chips = [['', 'Todas', d.unidades.length]].concat([['disponible', 'Disponibles'], ['asignado', 'Asignadas'], ['reservado', 'Reservadas'], ['suspendido', 'Suspendidas'], ['revision', 'Revisión']].map(function (x) { return [x[0], x[1], c[x[0]] || 0]; }));
    var filas = d.unidades.filter(function (u) { return !st.filtro || u.estado === st.filtro; });
    var h = '<div class="vip-head"><b>⭐ Bodega Netflix VIP</b><small>Una unidad = un acceso VIP/Extra. Cargar aquí no es una venta.</small></div>';
    h += '<div class="vip-chips">' + chips.map(function (x) { return '<button type="button" class="vip-chip' + (st.filtro === x[0] ? ' on' : '') + '" data-vip-f="' + x[0] + '">' + esc(x[1]) + ' · ' + x[2] + '</button>'; }).join('') + '</div>';
    if (d.puedeCargar) {
      h += '<details class="vip-carga"' + (st.prev ? ' open' : '') + '><summary>➕ Cargar lote VIP</summary>' +
        '<label>Proveedor<select id="vipProv">' + (d.proveedores || []).map(function (p) { return '<option>' + esc(p) + '</option>'; }).join('') + '<option value="__otro">Otro…</option></select></label>' +
        '<input id="vipProvOtro" placeholder="Nombre del proveedor" style="display:none">' +
        '<div class="vip-row"><label>Lote<input id="vipLote" placeholder="compra del día"></label><label>Costo USDT<input id="vipCosto" inputmode="decimal" placeholder="opcional"></label><label>Vence proveedor<input id="vipVenc" placeholder="dd/mm/aaaa"></label></div>' +
        '<label>Cuentas (una por línea: correo clave)<textarea id="vipTexto" rows="5" autocomplete="off" spellcheck="false" placeholder="demo.vip01@ejemplo.com | clave"></textarea></label>' +
        '<div class="vip-row"><button type="button" class="cobro-btn" id="vipPrevBtn">Revisar</button>' + (st.prev && st.prev.nuevas.length ? '<button type="button" class="cobro-btn renew" id="vipOkBtn">✅ Confirmar ' + st.prev.nuevas.length + '</button>' : '') + '</div>' +
        (st.prev ? '<p class="vip-prev">Total ' + st.prev.total + ' · Nuevas ' + st.prev.nuevas.length + ' · Repetidas ' + st.prev.repetidas.length + ' · Ya existentes ' + st.prev.yaExistentes.length + ' · Ya asignadas ' + st.prev.yaAsignadas.length + ' · Inválidas ' + st.prev.invalidas.length + '</p>' +
          (st.prev.invalidas.length ? '<ul class="vip-fallas">' + st.prev.invalidas.map(function (f) { return '<li>Línea ' + f.linea + (f.correo ? ' · ' + esc(f.correo) : '') + ': ' + esc(f.motivo) + '</li>'; }).join('') + '</ul>' : '') : '') +
        '<p class="vip-muted">Las claves no se muestran en la revisión ni en el listado.</p></details>';
    }
    h += filas.length ? '<div class="vip-list">' + filas.map(function (u) {
      return '<div class="vip-item"><div><b>' + esc(u.correo) + '</b><small>' + esc(u.proveedor) + (u.lote ? ' · ' + esc(u.lote) : '') + (u.costoUsdt != null ? ' · ' + esc(u.costoUsdt) + ' USDT' : '') + ' · vence prov. ' + esc(u.vencimientoProveedor) + '</small>' +
        (u.cliente ? '<small>👤 ' + esc(u.cliente) + '</small>' : '') + '</div><span class="vip-st ' + (CHIP[u.estado] || '') + '">' + esc(u.etiqueta) + '</span></div>';
    }).join('') + '</div>' : '<p class="vip-muted">No hay unidades en este filtro.</p>';
    b.innerHTML = h;
  }
  function cargar() { st.data = null; pintar(); return api({ accion: 'vipListar' }).then(function (r) { st.data = r; pintar(); }); }
  function meta() {
    var sel = document.getElementById('vipProv'); var prov = sel && sel.value === '__otro' ? (document.getElementById('vipProvOtro').value || '') : (sel ? sel.value : '');
    return { proveedor: prov, lote: (document.getElementById('vipLote') || {}).value || '', costoUsdt: (document.getElementById('vipCosto') || {}).value || '', vencimientoProveedor: (document.getElementById('vipVenc') || {}).value || '', texto: (document.getElementById('vipTexto') || {}).value || '' };
  }
  var guardado = null;
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest && t.closest('#invVipBtn')) { st.abierto = !st.abierto; st.prev = null; if (st.abierto) cargar(); else pintar(); return; }
    var f = t.closest && t.closest('[data-vip-f]'); if (f) { st.filtro = f.getAttribute('data-vip-f'); pintar(); return; }
    if (t.id === 'vipPrevBtn') { guardado = meta(); api({ accion: 'vipPrevisualizar', texto: guardado.texto }).then(function (r) { if (!r.ok) { alert(r.error || 'No se pudo revisar.'); return; } st.prev = r; pintar(); restaurar(); }); return; }
    if (t.id === 'vipOkBtn') {
      var m = guardado || meta(); t.disabled = true;
      api(Object.assign({ accion: 'vipImportar' }, m)).then(function (r) {
        if (!r.ok) { t.disabled = false; alert(r.error || 'No se pudo cargar.'); return; }
        guardado = null; st.prev = null; alert('Bodega VIP: ' + r.resumen); cargar();
      });
    }
  });
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'vipProv') { var o = document.getElementById('vipProvOtro'); if (o) o.style.display = e.target.value === '__otro' ? '' : 'none'; } });
  // Al repintar tras «Revisar» se conserva lo escrito (las claves solo viven en el textarea del navegador).
  function restaurar() { if (!guardado) return; ['vipLote', 'vipCosto', 'vipVenc', 'vipTexto'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = guardado[{ vipLote: 'lote', vipCosto: 'costoUsdt', vipVenc: 'vencimientoProveedor', vipTexto: 'texto' }[id]]; }); var s = document.getElementById('vipProv'); if (s && guardado.proveedor) { var hay = [].some.call(s.options, function (o) { return o.value === guardado.proveedor; }); s.value = hay ? guardado.proveedor : '__otro'; var o = document.getElementById('vipProvOtro'); if (!hay && o) { o.style.display = ''; o.value = guardado.proveedor; } } }
  window.SublichatBodegaVip = { cargar: cargar, _st: st };
})();
