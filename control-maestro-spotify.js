/* control-maestro-spotify.js · R196 — Control Maestro › Spotify Premium Familiar.
   R196r · PDF «Correcciones aprobadas» (14/11/2026) · Bloque 01: CONSULTA + REVISIÓN de familias reales.
     · Lista: una tarjeta por familia real (spotify_familias: ID estable SP-xxx, correo madre, n/5, estado de revisión).
       Ya no salen las «cuentas» genéricas que mezclaban madres, invitados y filas viejas del Excel.
     · Detalle: 5 renglones fijos (# · correo del invitado o «Espacio libre» · cliente SOLO si la ficha lo comprueba ·
       verificación por CORREO contra la fuente operativa que usa Telegram). La madre nunca es un espacio ni un «perfil».
       Sin PIN/teléfono/fecha: su falta no es una falla. Si la consulta falla: «No se pudo verificar · Reintentar».
     · Controles: Verificar, Marcar revisada (solo si los 5 espacios coinciden y nada cambió), Registrar incidencia,
       Ver detalle de revisión, Reintentar sincronización y búsqueda. SIN agregar, mover, desvincular, sacar ni eliminar:
       eso vive en Telegram / Bodega web / APK y se refleja aquí solo.
   Fuente única: api/_spotify-familias.js por /api/inventario (spotifyPanel, spotifyVerificar, spotifyRevisarFamilia,
   spotifyResincronizar). El estado de revisión es propio de Control Maestro (spotify_familias_revisiones). */
(function () {
  'use strict';
  var st = { familias: [], q: '', cargando: false, error: '', el: null, abierta: '', ver: {}, verificando: '', guardando: '', msg: {}, detalle: {} };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(body) {
    return fetch('/api/inventario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Respuesta inválida del servidor.' }; }); });
  }
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function fechaHora(iso) { var t = Date.parse(String(iso || '')); if (!isFinite(t)) return ''; var d = new Date(t - 6 * 3600000).toISOString(); return d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) + ' ' + d.slice(11, 16); }
  var RES = {
    coincide: ['ok', 'Coincide'], libre: ['libre', 'Libre'], falta_en_origen: ['err', 'Falta en origen'], falta_en_cm: ['err', 'Falta en Control Maestro'],
    otra_familia: ['err', 'Otra familia'], duplicado: ['err', 'Duplicado'], no_verificable: ['warn', 'No se pudo verificar']
  };
  var REV = { sin_revisar: 'pend', revisada: 'ok', desactualizada: 'warn', con_incidencia: 'err', en_revision: 'info' };
  function chip(clase, texto) { return '<span class="sp-chip ' + esc(clase) + '">' + esc(texto) + '</span>'; }
  function revChip(f) {
    var r = f.revision || { codigo: 'sin_revisar', texto: 'Sin revisar' };
    if (st.ver[f.id] && r.codigo !== 'revisada' && r.codigo !== 'con_incidencia') return chip('info', 'En revisión');
    return chip(REV[r.codigo] || 'pend', r.codigo === 'desactualizada' ? 'Pendiente de revisar' : r.texto);
  }
  function coincide(f) {
    var q = String(st.q || '').trim().toLowerCase(); if (!q) return true;
    return f.madreCorreo.toLowerCase().indexOf(q) >= 0 || f.codigo.toLowerCase().indexOf(q) >= 0 ||
      f.espacios.some(function (e) { return (e.correo || '').toLowerCase().indexOf(q) >= 0; });
  }
  function tarjeta(f) {
    var on = st.abierta === f.id;
    return '<button type="button" class="sp-fam-row' + (on ? ' sp-sel' : '') + '" data-sp-abrir="' + esc(f.id) + '" aria-expanded="' + on + '">' +
      '<span class="sp-fam-id">' + esc(f.codigo) + '</span><span class="sp-fam-main"><b>' + esc(f.madreCorreo) + '</b><small>Cuenta madre · ' + f.ocupados + '/' + f.capacidad + ' ocupados</small></span>' +
      '<span class="sp-fam-side">' + revChip(f) + '<i aria-hidden="true">›</i></span></button>';
  }
  function detalle(f) {
    var v = st.ver[f.id], busy = st.verificando === f.id, guard = st.guardando === f.id, m = st.msg[f.id];
    var porPos = {}; ((v && v.espacios) || []).forEach(function (e) { porPos[e.posicion] = e; });
    var esp = f.espacios.slice().sort(function (a, b) { return a.posicion - b.posicion; });
    var filas = esp.map(function (e) {
      var r = porPos[e.posicion]; var libre = e.estado === 'disponible' || !e.correo;
      var res = libre ? chip('libre', 'Libre') : busy && !r ? chip('info', 'Verificando…') : r ? chip(RES[r.resultado] ? RES[r.resultado][0] : 'warn', RES[r.resultado] ? RES[r.resultado][1] : r.resultado) : chip('pend', 'Sin verificar');
      return '<li class="sp-slot' + (libre ? ' libre' : '') + '"><span class="sp-n">' + dos(e.posicion) + '</span><span class="sp-slot-main"><b>' + (libre ? 'Espacio libre' : esc(e.correo)) + '</b>' +
        (r && r.cliente ? '<small>Cliente: ' + esc(r.cliente) + '</small>' : '') + (r && r.detalle && r.resultado !== 'coincide' ? '<small class="sp-det">' + esc(r.detalle) + '</small>' : '') +
        (e.estado === 'retiro_pendiente' ? '<small class="sp-det">Retiro en Spotify pendiente</small>' : '') + '</span>' + res + '</li>';
    }).join('');
    var extra = v ? (v.sobrantes || []).map(function (x) { return '<li class="sp-slot extra"><span class="sp-n">!</span><span class="sp-slot-main"><b>' + esc(x.correo) + '</b><small class="sp-det">' + esc(x.detalle) + '</small></span>' + chip('err', 'Falta en Control Maestro') + '</li>'; }).join('') : '';
    var avisos = v && (v.avisos || []).length ? '<div class="sp-avisos" role="alert">' + v.avisos.map(function (a) { return '<div>⚠️ ' + esc(a) + '</div>'; }).join('') + '</div>' : '';
    var pend = (f.pendientesSpotify || []).length ? '<div class="sp-quitar"><b>Acceso pendiente de retirar en la app de Spotify</b> <small>(ya no ocupa espacio)</small>: ' + f.pendientesSpotify.map(function (p) { return esc(p.correo); }).join(', ') + '</div>' : '';
    var puedeRevisar = !!(v && v.ok && v.huella === f.huella) && !busy && !guard;
    var r = f.revision || {};
    var det = st.detalle[f.id] ? '<div class="sp-rev-det"><b>Detalle de revisión</b>' +
      '<div>Estado: ' + esc(r.texto || 'Sin revisar') + (r.por ? ' · por ' + esc(r.por) : '') + (r.at ? ' · ' + esc(fechaHora(r.at)) : '') + '</div>' + (r.nota ? '<div>Nota: ' + esc(r.nota) + '</div>' : '') +
      (v ? '<div>Última verificación: ' + esc(fechaHora(v.verificadoAt)) + ' · versión ' + esc(v.version) + ' · ' + (v.ok ? 'todo coincide' : 'con diferencias') + '</div>' : '<div>Sin verificar en esta sesión.</div>') + '</div>' : '';
    return '<section class="sp-det-card" aria-label="Detalle ' + esc(f.codigo) + '">' +
      '<header class="sp-det-head"><div><small>Spotify Premium Familiar</small><h4>' + esc(f.codigo) + ' · ' + esc(f.madreCorreo) + '</h4><p>Cuenta madre (administradora: no ocupa espacio) · <b>' + f.ocupados + '/' + f.capacidad + ' ocupados</b></p></div>' + revChip(f) + '</header>' +
      '<ol class="sp-slots">' + filas + extra + '</ol>' + avisos + pend +
      (m ? '<div class="sp-msg ' + esc(m.tipo) + '" role="status">' + esc(m.txt) + '</div>' : '') +
      '<div class="sp-acciones">' +
      '<button type="button" class="cm-btn" data-sp-verificar="' + esc(f.id) + '"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Verificando…' : (v ? '↻ Verificar otra vez' : 'Verificar correos')) + '</button>' +
      '<button type="button" class="cm-btn good" data-sp-revisada="' + esc(f.id) + '"' + (puedeRevisar ? '' : ' disabled') + ' title="' + (puedeRevisar ? 'Los 5 espacios coinciden' : 'Se habilita cuando los 5 espacios coinciden') + '">✅ Marcar revisada</button>' +
      '<button type="button" class="cm-btn warn" data-sp-incidencia="' + esc(f.id) + '"' + (guard ? ' disabled' : '') + '>⚠️ Registrar incidencia</button>' +
      (v && (!v.ok) ? '<button type="button" class="cm-btn" data-sp-resync="' + esc(f.id) + '"' + (busy ? ' disabled' : '') + '>Reintentar sincronización</button>' : '') +
      '<button type="button" class="cm-btn" data-sp-detalle="' + esc(f.id) + '">' + (st.detalle[f.id] ? 'Ocultar detalle' : 'Ver detalle de revisión') + '</button>' +
      '</div>' + det + '</section>';
  }
  function pintar() {
    if (!st.el) return;
    var lista = st.familias.filter(coincide);
    var tot = st.familias.reduce(function (a, f) { a.c += f.capacidad; a.o += f.ocupados; if (f.revision && f.revision.codigo === 'revisada') a.r++; return a; }, { c: 0, o: 0, r: 0 });
    var abierta = st.familias.find(function (f) { return f.id === st.abierta; });
    st.el.innerHTML = '<section class="sp-cm"><div class="sp-cm-cab"><h3>Spotify Premium Familiar</h3><p>' + st.familias.length + ' familias · ' + tot.o + ' de ' + tot.c + ' espacios ocupados · ' + tot.r + ' revisadas · consulta y revisión</p></div>' +
      '<div class="sp-filtros"><input type="search" id="spBuscar" placeholder="Buscar SP-00X, cuenta madre o correo invitado…" value="' + esc(st.q) + '" aria-label="Buscar en Spotify Familiar"></div>' +
      (st.error ? '<div class="cm-status err" role="alert">' + esc(st.error) + ' <button type="button" class="cm-btn" data-sp-recargar>Reintentar</button></div>' : '') +
      '<div class="sp-grid"><div class="sp-lista">' + (st.cargando && !st.familias.length ? '<div class="cm-empty">Cargando familias…</div>' : lista.length ? lista.map(tarjeta).join('') : '<div class="cm-empty">No hay familias con esa búsqueda.</div>') + '</div>' +
      '<div class="sp-detalle">' + (abierta ? detalle(abierta) : '<div class="cm-empty">Seleccione una familia para ver sus 5 espacios y revisarla.</div>') + '</div></div></section>';
    var q = st.el.querySelector('#spBuscar');
    if (q) q.addEventListener('input', function () { st.q = q.value; var pos = q.selectionStart; pintar(); var n = st.el.querySelector('#spBuscar'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } });
  }
  function verificar(id) {
    st.verificando = id; st.msg[id] = null; pintar();
    return api({ accion: 'spotifyVerificar', familiaId: id }).then(function (j) {
      st.verificando = '';
      if (!j || !j.ok) { delete st.ver[id]; st.msg[id] = { tipo: 'warn', txt: 'No se pudo verificar: ' + ((j && j.error) || 'error del servidor') + '. Reintente; esto NO significa que falte en Telegram.' }; return pintar(); }
      st.ver[id] = j.verificacion;
      var f = st.familias.find(function (x) { return x.id === id; });
      if (f && f.huella !== j.verificacion.huella) { st.msg[id] = { tipo: 'warn', txt: 'La familia cambió mientras la veía: se recargan los datos.' }; return cargar(); }
      pintar();
    }).catch(function () { st.verificando = ''; delete st.ver[id]; st.msg[id] = { tipo: 'warn', txt: 'No se pudo verificar (sin conexión). Reintente; esto NO significa que falte en Telegram.' }; pintar(); });
  }
  function revisar(id, resultado) {
    var v = st.ver[id]; var nota = '';
    if (resultado === 'incidencia') { nota = prompt('Escriba qué encontró en esta familia (por ejemplo: «el correo X está en otra familia en Spotify»):', '') || ''; if (nota.trim().length < 4) return; }
    st.guardando = id; pintar();
    api({ accion: 'spotifyRevisarFamilia', familiaId: id, resultado: resultado, nota: nota, huella: v ? v.huella : '' }).then(function (j) {
      st.guardando = '';
      if (!j || !j.ok) { st.msg[id] = { tipo: 'err', txt: '⚠️ ' + ((j && j.error) || 'No se pudo guardar.') }; return pintar(); }
      st.ver[id] = j.verificacion; st.msg[id] = { tipo: resultado === 'revisada' ? 'ok' : 'warn', txt: resultado === 'revisada' ? '✅ Familia revisada. Si cambia algo después, volverá a «Pendiente de revisar».' : '⚠️ Incidencia registrada.' };
      return cargar();
    }).catch(function () { st.guardando = ''; st.msg[id] = { tipo: 'err', txt: 'Sin conexión: no se guardó.' }; pintar(); });
  }
  function bind() {
    if (!st.el || st.el.__spBound) return; st.el.__spBound = true;
    st.el.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-sp-abrir],[data-sp-verificar],[data-sp-revisada],[data-sp-incidencia],[data-sp-resync],[data-sp-detalle],[data-sp-recargar]'); if (!t || t.disabled) return;
      if (t.dataset.spAbrir) { st.abierta = st.abierta === t.dataset.spAbrir ? '' : t.dataset.spAbrir; pintar(); if (st.abierta && !st.ver[st.abierta]) verificar(st.abierta); return; }
      if (t.dataset.spVerificar) return verificar(t.dataset.spVerificar);
      if (t.dataset.spRevisada) return revisar(t.dataset.spRevisada, 'revisada');
      if (t.dataset.spIncidencia) return revisar(t.dataset.spIncidencia, 'incidencia');
      if (t.dataset.spDetalle) { st.detalle[t.dataset.spDetalle] = !st.detalle[t.dataset.spDetalle]; return pintar(); }
      if (t.dataset.spResync) { var id = t.dataset.spResync; st.verificando = id; pintar(); return api({ accion: 'spotifyResincronizar', familiaId: id }).then(function (j) { st.verificando = ''; if (j && j.ok) st.ver[id] = j.verificacion; else st.msg[id] = { tipo: 'warn', txt: 'No se pudo reintentar: ' + ((j && j.error) || 'error') }; return cargar(); }).catch(function () { st.verificando = ''; pintar(); }); }
      if (t.hasAttribute('data-sp-recargar')) return cargar();
    });
  }
  function cargar() {
    st.cargando = true; st.error = ''; pintar();
    return api({ accion: 'spotifyPanel' }).then(function (j) {
      st.cargando = false;
      if (!j || !j.ok) { st.error = (j && j.error) || 'No se pudo leer Spotify Familiar.'; return pintar(); }
      st.familias = j.familias || [];
      st.familias.forEach(function (f) { var v = st.ver[f.id]; if (v && v.huella !== f.huella) delete st.ver[f.id]; }); // nada viejo: si cambió, se verifica de nuevo
      pintar();
      if (window.SublichatSpotifyCM.onResumen) try { window.SublichatSpotifyCM.onResumen(resumen()); } catch (_) {}
    }).catch(function () { st.cargando = false; st.error = 'Sin conexión con el servidor.'; pintar(); });
  }
  function resumen() { var n = st.familias.length, r = st.familias.filter(function (f) { return f.revision && f.revision.codigo === 'revisada'; }).length; return { total: n, revisadas: r, percent: n ? Math.round((r / n) * 100) : 0 }; }
  function montar(el) {
    if (!el) return;
    var nuevo = st.el !== el; st.el = el; bind();
    if (nuevo || !st.familias.length) cargar(); else pintar();
  }
  window.SublichatSpotifyCM = { montar: montar, recargar: cargar, resumen: resumen, _st: st };
})();
