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

// R196u Fase 2 · Hogar de Netflix Premium en el detalle de la cuenta madre (Bodega web). Un Hogar por madre; reemplazar pide
// confirmación; es un dato de seguimiento en Sublichat (no cambia nada en Netflix).
(function () {
  'use strict';
  function api(body) { return fetch('/api/inventario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Respuesta inválida del servidor.' }; }); }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pintar(box, r) {
    if (!r.ok) { box.innerHTML = '<div class="cr-label">🏠 Hogar</div><p class="vip-err">' + esc(r.error || 'No se pudo leer el Hogar.') + '</p>'; return; }
    var h = r.hogar || {};
    var html = '<div class="cr-label">🏠 Hogar Netflix</div><p class="hg-estado ' + esc(h.estado || '') + '">' + esc(h.texto || 'Hogar sin asignar') + '</p>';
    html += '<div class="hg-list">' + (r.perfiles || []).map(function (p) {
      var puede = r.puedeEditar && p.clienteId && !p.hogar;
      return '<div class="hg-row' + (p.hogar ? ' on' : '') + '"><span>Perfil ' + p.perfil + ' · ' + esc(p.cliente) + (p.hogar ? ' <b>🏠 Hogar</b>' : '') + '</span>' +
        (puede ? '<button type="button" class="hg-btn" data-hg-cli="' + esc(p.clienteId) + '" data-hg-compra="' + esc(p.compraId) + '">Marcar Hogar</button>' : '') + '</div>';
    }).join('') + '</div>';
    if (r.puedeEditar && h.estado && h.estado !== 'sin_asignar') html += '<button type="button" class="hg-btn hg-quitar" data-hg-quitar="1">Quitar Hogar</button>';
    if (r.incidencia) html += '<p class="hg-incidencia">⚠️ ' + esc(r.incidencia) + '</p>'; // R196v · madre duplicada en Bodega
    if (r.puedeEditar) html += '<button type="button" class="hg-btn" data-hg-diag="1">Diagnóstico de Hogar (solo lectura)</button><div data-hg-diag-out></div>';
    html += '<p class="vip-muted">Seguimiento interno de Sublichat: no cambia la configuración de Netflix.</p>';
    box.innerHTML = html;
  }
  function montar(box) {
    if (!box) return; var id = box.getAttribute('data-inv-id'); if (!id) return;
    box.innerHTML = '<div class="cr-label">🏠 Hogar Netflix</div><p class="vip-muted">Cargando…</p>';
    api({ accion: 'hogarVer', docId: id }).then(function (r) { pintar(box, r); });
  }
  // R196v · Diagnóstico de solo lectura: cuentas madre duplicadas y Hogares pendientes (registros que decide una persona).
  function pintarDiag(out, r) {
    if (!r.ok) { out.innerHTML = '<p class="vip-err">' + esc(r.error || 'No se pudo leer el diagnóstico.') + '</p>'; return; }
    var h = '<p class="vip-muted">' + r.madres + ' cuentas madre · ' + r.conHogar + ' con Hogar · ' + r.duplicadas.length + ' duplicadas · ' + r.pendientes.length + ' Hogar pendiente.</p>';
    h += r.duplicadas.map(function (g) { return '<div class="hg-row"><span><b>' + esc(g.correo) + '</b> · ' + g.copias.length + ' copias: ' + g.copias.map(function (c) { return esc(c.id) + ' (' + c.ocupados + ' ocupados' + (c.hogar ? ' · ' + esc(c.hogar) : '') + ')'; }).join(' / ') + '</span></div>'; }).join('');
    h += r.pendientes.map(function (p) { return '<div class="hg-row"><span><b>' + esc(p.correo) + '</b> · ' + esc(p.texto) + '</span></div>'; }).join('');
    out.innerHTML = h;
  }
  document.addEventListener('click', function (e) {
    var dg = e.target.closest && e.target.closest('[data-hg-diag]');
    if (dg) { var out = dg.parentNode.querySelector('[data-hg-diag-out]'); out.innerHTML = '<p class="vip-muted">Revisando…</p>'; api({ accion: 'hogarDiagnostico' }).then(function (r) { pintarDiag(out, r); }); return; }
    var b = e.target.closest && e.target.closest('[data-hg-cli],[data-hg-quitar]'); if (!b) return;
    var box = b.closest('#invHogarBox'); if (!box) return; var id = box.getAttribute('data-inv-id');
    if (b.hasAttribute('data-hg-quitar')) { if (!confirm('¿Quitar el Hogar de esta cuenta madre?')) return; api({ accion: 'hogarQuitar', docId: id }).then(function () { montar(box); }); return; }
    var body = { accion: 'hogarAsignar', docId: id, clienteId: b.getAttribute('data-hg-cli'), compraId: b.getAttribute('data-hg-compra') };
    b.disabled = true;
    api(body).then(function (r) {
      if (!r.ok && r.code === 'requiere_confirmacion') {
        if (!confirm(r.error + '\n\n¿Reemplazar el Hogar?')) { b.disabled = false; return; }
        body.confirmarReemplazo = true; return api(body).then(function (r2) { if (!r2.ok) alert(r2.error); montar(box); });
      }
      if (!r.ok) alert(r.error || 'No se pudo asignar.'); montar(box);
    });
  });
  window.SublichatHogar = { montar: montar };
})();

// R196u Fase 3 · Plan HBO por cuenta (Platinum 5 / Standard 3). Bajar de plan con más ocupados que la nueva capacidad se bloquea.
(function () {
  'use strict';
  function api(body) { return fetch('/api/inventario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Respuesta inválida del servidor.' }; }); }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var alCambiar = null;
  function montar(box, cb) {
    if (!box) return; alCambiar = cb || null;
    api({ accion: 'hboResumen' }).then(function (r) {
      if (!r.ok) return;
      var id = box.getAttribute('data-inv-id'); var c = (r.cuentas || []).filter(function (x) { return x.id === id; })[0];
      var html = '<div class="cr-label">📦 Plan HBO</div><p class="hg-estado' + (c && !c.plan ? ' sin_asignar' : '') + '">' + esc(c ? c.etiqueta : 'Plan sin definir') + (c && c.sobreocupada ? ' · ⚠️ sobreocupada' : '') + '</p>';
      if (r.puedeEditar) html += '<div class="vip-row"><button type="button" class="hg-btn" data-hbo-plan="platinum"' + (c && c.plan === 'platinum' ? ' disabled' : '') + '>Platinum · 5 perfiles</button><button type="button" class="hg-btn" data-hbo-plan="standard"' + (c && c.plan === 'standard' ? ' disabled' : '') + '>Standard · 3 perfiles</button></div>';
      var k = r.contadores || null; // R196v · contadores separados por plan y modalidad
      if (k) html += '<div class="hbo-cont">' + ['standard', 'platinum'].map(function (p) { var o = k[p]; return '<div><b>HBO ' + (p === 'standard' ? 'Standard · 3' : 'Platinum · 5') + '</b><span>' + o.compartidas + ' compartidas · ' + o.libres + ' perfiles libres</span><span>' + o.completas + ' vendidas completas · ' + o.completasLibres + ' libres para completa</span></div>'; }).join('') + '</div><p class="vip-muted">' + k.sinPlan + ' cuenta(s) HBO Max sin plan: defínalas aquí (no se migran solas).</p>';
      else html += '<p class="vip-muted">Bodega: ' + r.platinum.cuentas + ' Platinum (' + r.platinum.libres + ' libres) · ' + r.standard.cuentas + ' Standard (' + r.standard.libres + ' libres) · ' + r.sinPlan + ' sin plan.</p>';
      box.innerHTML = html;
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-hbo-plan]'); if (!b) return;
    var box = b.closest('#invHboBox'); if (!box) return;
    var plan = b.getAttribute('data-hbo-plan');
    if (!confirm('¿Cambiar esta cuenta a HBO Max ' + (plan === 'platinum' ? 'Platinum (5 perfiles)' : 'Standard (3 perfiles)') + '?')) return;
    b.disabled = true;
    api({ accion: 'hboPlan', docId: box.getAttribute('data-inv-id'), plan: plan }).then(function (r) { if (!r.ok) alert(r.error || 'No se pudo cambiar el plan.'); montar(box, alCambiar); if (r.ok && alCambiar) alCambiar(); });
  });
  window.SublichatHbo = { montar: montar };
})();
