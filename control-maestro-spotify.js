/* control-maestro-spotify.js · R196 — Control Maestro › Spotify Premium Familiar.
   R196p · PDF «Spotify · eliminar correos y Control Maestro» (13/11/2026): esta vista es SOLO DE CONSULTA.
   Por cada familia: código (SP-00X), cuenta madre, contador n/5 y los 5 correos invitados (un espacio libre dice
   «Espacio libre»). Sin formularios, botones +, menús ⋮, Agregar, Mover, Desvincular, Eliminar ni el panel
   «Relación con Sublichat». Altas y bajas se hacen en Telegram (/spotify), Bodega › Spotify (web) y la APK, y «No renovó»
   en la ficha libera el espacio solo. Fuente única: api/_spotify-familias.js por /api/inventario (acción de solo lectura
   «spotifyPanel»), la misma que leen Bodega, APK y bot. No toca Netflix ni otras plataformas. */
(function () {
  'use strict';
  var st = { familias: [], q: '', cargando: false, error: '', el: null };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(body) {
    return fetch('/api/inventario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Respuesta inválida del servidor.' }; }); });
  }
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function coincide(f) {
    var q = String(st.q || '').trim().toLowerCase(); if (!q) return true;
    return f.madreCorreo.toLowerCase().indexOf(q) >= 0 || f.codigo.toLowerCase().indexOf(q) >= 0 ||
      f.espacios.some(function (e) { return (e.correo || '').toLowerCase().indexOf(q) >= 0; });
  }
  function familiaHtml(f) {
    var esp = f.espacios.slice().sort(function (a, b) { return a.posicion - b.posicion; });
    return '<article class="sp-fam"><div class="sp-fam-cab"><div><small>Spotify Premium Familiar · ' + esc(f.codigo) + '</small>' +
      '<b>Cuenta madre: ' + esc(f.madreCorreo) + '</b></div><span class="sp-cupo' + (f.libres ? '' : ' llena') + '">' + f.ocupados + '/' + f.capacidad + '</span></div>' +
      '<div class="sp-correos"><small>Correos de la cuenta familiar</small><ol>' +
      esp.map(function (e) {
        var libre = e.estado === 'disponible' || !e.correo;
        return '<li class="' + (libre ? 'libre' : '') + '"><span class="sp-n">' + dos(e.posicion) + '.</span> ' + (libre ? 'Espacio libre' : esc(e.correo)) + '</li>';
      }).join('') + '</ol></div></article>';
  }
  function pintar() {
    if (!st.el) return;
    var lista = st.familias.filter(coincide);
    var tot = st.familias.reduce(function (a, f) { a.c += f.capacidad; a.o += f.ocupados; return a; }, { c: 0, o: 0 });
    st.el.innerHTML = '<section class="sp-cm"><div class="sp-cm-cab"><h3>Spotify Premium Familiar</h3><p>' + st.familias.length + ' cuentas familiares · ' + tot.o + ' de ' + tot.c + ' espacios ocupados · solo consulta</p></div>' +
      '<div class="sp-filtros"><input type="search" id="spBuscar" placeholder="Buscar SP-00X, cuenta madre o correo…" value="' + esc(st.q) + '" aria-label="Buscar en Spotify Familiar"></div>' +
      (st.error ? '<div class="cm-status err" role="alert">' + esc(st.error) + '</div>' : '') +
      '<div class="sp-lista">' + (st.cargando && !st.familias.length ? '<div class="cm-empty">Cargando familias…</div>' : lista.length ? lista.map(familiaHtml).join('') : '<div class="cm-empty">No hay familias con esa búsqueda.</div>') + '</div></section>';
    var q = st.el.querySelector('#spBuscar');
    if (q) q.addEventListener('input', function () { st.q = q.value; var pos = q.selectionStart; pintar(); var n = st.el.querySelector('#spBuscar'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } });
  }
  function cargar() {
    st.cargando = true; st.error = ''; pintar();
    return api({ accion: 'spotifyPanel' }).then(function (j) {
      st.cargando = false;
      if (!j || !j.ok) { st.error = (j && j.error) || 'No se pudo leer Spotify Familiar.'; return pintar(); }
      st.familias = j.familias || []; pintar();
    }).catch(function () { st.cargando = false; st.error = 'Sin conexión con el servidor.'; pintar(); });
  }
  function montar(el) {
    if (!el) return;
    var nuevo = st.el !== el; st.el = el;
    if (nuevo || !st.familias.length) cargar(); else pintar();
  }
  window.SublichatSpotifyCM = { montar: montar, recargar: cargar, _st: st };
})();
