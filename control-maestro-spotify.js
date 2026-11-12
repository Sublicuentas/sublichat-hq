/* control-maestro-spotify.js · R196 — Control Maestro › Spotify Premium Familiar (autorización expresa, 08/11/2026).
   Cada cuenta familiar: 1 correo administrador (no vendible) + EXACTAMENTE 5 espacios por CORREO invitado.
   Muestra quién ocupa cada espacio, su ficha y su vencimiento LEÍDO de la ficha (no guarda otra fecha).
   Fuente única: api/_spotify-familias.js (la misma que Bodega, APK y bot) por /api/inventario. No toca Netflix ni otras
   plataformas: Control Maestro solo monta este bloque cuando la plataforma elegida es Spotify.
   R196m · Alta por correo DENTRO de la cuenta madre: «Correo del invitado [ ] [Agregar]» (sin listas de cuentas).
   Espacio elegido = el que tocó o el primero libre. Varias fichas con ese correo → se elige solo entre esas.
   Quitar Spotify / «No renovó» → el espacio queda «Retiro en Spotify pendiente»: se libera al confirmar que se retiró. */
(function () {
  'use strict';
  var st = { familias: [], hoy: '', q: '', filtro: 'todas', cargando: false, error: '', abierto: '' , el: null, slot: {}, msg: {}, elegir: null, enviando: '' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(body) {
    return fetch('/api/inventario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Respuesta inválida del servidor.' }; }); });
  }
  var ESTADO = { disponible: ['Disponible', 'sp-disp'], pendiente: ['Invitación pendiente', 'sp-pend'], ocupado: ['Ocupado', 'sp-ocup'], retiro_pendiente: ['Retiro en Spotify pendiente', 'sp-ret'] };
  var MOTIVO = { no_renovo: 'No renovó', quitar_servicio: 'Se quitó Spotify' };
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function fecha(ymd) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || ''); return m ? (Number(m[3]) + ' ' + MES[Number(m[2]) - 1] + ' ' + m[1]) : '—'; }
  function coincide(f) {
    var q = st.q.trim().toLowerCase();
    if (q && !(f.madreCorreo.toLowerCase().indexOf(q) >= 0 || f.codigo.toLowerCase().indexOf(q) >= 0 || f.espacios.some(function (e) { return (e.correo || '').toLowerCase().indexOf(q) >= 0 || (e.cliente || '').toLowerCase().indexOf(q) >= 0; }))) return false;
    if (st.filtro === 'libres') return f.libres > 0;
    if (st.filtro === 'ocupados') return f.libres === 0;
    if (st.filtro === 'pendientes') return f.espacios.some(function (e) { return e.estado === 'pendiente' || e.estado === 'retiro_pendiente'; });
    if (st.filtro === 'vencidos') return f.espacios.some(function (e) { return e.vencido; });
    return true;
  }
  function filaHtml(f, e) {
    var est = ESTADO[e.estado] || ESTADO.disponible;
    var cliente = e.estado === 'disponible' ? '<span class="sp-mute">Sin asignar</span>' : e.sinFicha ? '<span class="sp-warn">Sin ficha vinculada</span>' : esc(e.cliente || '—') + (e.fichaEncontrada ? '' : ' <small class="sp-warn">(servicio no encontrado)</small>');
    var vence = e.estado === 'disponible' ? '—' : (e.vence ? fecha(e.vence) + (e.vencido ? ' <small class="sp-venc">vencido</small>' : '') : '—');
    if (e.estado === 'retiro_pendiente' && e.retiroMotivo) cliente = '<span class="sp-warn">' + esc(MOTIVO[e.retiroMotivo] || e.retiroMotivo) + (e.retiroAt ? ' · ' + fecha(String(e.retiroAt).slice(0, 10)) : '') + '</span>' + (e.cliente ? '<br><small class="sp-mute">' + esc(e.cliente) + '</small>' : '');
    if (e.estado === 'disponible') {
      var elegido = Number(st.slot[f.id] || 0) === Number(e.posicion);
      return '<div class="sp-fila sp-libre' + (elegido ? ' sp-elegido' : '') + '" role="row"><span class="sp-n" role="cell">' + String(e.posicion).padStart(2, '0') + '</span>' +
        '<span class="sp-correo" role="cell"><span class="sp-mute">—</span></span><span role="cell"><span class="sp-mute">Sin asignar</span></span><span class="sp-vence" role="cell">—</span>' +
        '<span role="cell"><b class="sp-pill sp-disp">Disponible</b></span><span role="cell"><button type="button" class="sp-mas" data-sp-slot="' + esc(f.id) + '|' + e.posicion + '" aria-label="Usar el espacio ' + e.posicion + '" title="Usar este espacio">' + (elegido ? '✓' : '+') + '</button></span></div>';
    }
    return '<div class="sp-fila" role="row"><span class="sp-n" role="cell">' + String(e.posicion).padStart(2, '0') + '</span>' +
      '<span class="sp-correo" role="cell">' + (e.correo ? esc(e.correo) : '—') + (e.historialCorreos && e.historialCorreos.length ? ' <small class="sp-mute" title="' + esc(e.historialCorreos.map(function (h) { return h.antes + ' → ' + h.despues; }).join('\n')) + '">(correo corregido)</small>' : '') + '</span>' +
      '<span role="cell">' + cliente + '</span><span class="sp-vence" role="cell">' + vence + '</span>' +
      '<span role="cell"><b class="sp-pill ' + est[1] + '">' + est[0] + '</b></span>' +
      '<span role="cell"><button type="button" class="sp-mas" data-sp-menu="' + esc(f.id) + '|' + e.posicion + '" aria-label="Opciones del espacio ' + e.posicion + '">⋮</button></span></div>' +
      (st.abierto === f.id + '|' + e.posicion ? menuHtml(f, e) : '');
  }
  function menuHtml(f, e) {
    var b = function (acc, txt, peligro) { return '<button type="button" class="' + (peligro ? 'sp-peligro' : '') + '" data-sp-acc="' + acc + '" data-f="' + esc(f.id) + '" data-p="' + e.posicion + '" data-c="' + esc(e.correo || '') + '">' + txt + '</button>'; };
    return '<div class="sp-menu">' +
      (e.sinFicha || !e.fichaEncontrada ? b('ficha', 'Vincular ficha del cliente') : '') +
      (e.estado === 'pendiente' ? b('aceptada', 'Marcar invitación aceptada') : '') +
      b('correo', 'Corregir correo (mismo cliente)') +
      (e.estado === 'retiro_pendiente' ? b('quitar_retiro', 'Quitar «pendiente de retirada»') : b('retiro', 'Marcar «pendiente de retirada»')) +
      b('mover', 'Mover a otra familia') +
      b('liberar', e.estado === 'retiro_pendiente' ? 'Ya lo retiré en Spotify · liberar espacio' : 'Retirar invitado (ya lo quité en Spotify)', true) + '</div>';
  }
  function familiaHtml(f) {
    return '<article class="sp-fam"><div class="sp-fam-cab"><div><small>Cuenta familiar · ' + esc(f.codigo) + '</small><b>' + esc(f.madreCorreo) + '</b><small class="sp-mute">Administrador: no es un espacio vendible.' + ((f.madreClientes || []).length ? ' · Cliente de la cuenta madre: ' + f.madreClientes.map(function (x) { return esc(x.cliente || x.clienteId) + (x.vence ? ' (vence ' + fecha(x.vence) + (x.vencido ? ', vencido' : '') + ')' : ''); }).join(', ') : '') + (f.tieneClave ? ' · 🔒 clave guardada' : '') + '</small></div>' + // R196d
      '<span class="sp-cupo ' + (f.libres ? '' : 'llena') + '">' + f.ocupados + ' de ' + f.capacidad + ' espacios</span></div>' +
      '<div class="sp-tabla" role="table" aria-label="Invitaciones de ' + esc(f.madreCorreo) + '"><div class="sp-fila sp-th" role="row"><span role="columnheader">N.º</span><span role="columnheader">Correo invitado</span><span role="columnheader">Cliente vinculado</span><span role="columnheader">Vence</span><span role="columnheader">Estado</span><span></span></div>' +
      f.espacios.map(function (e) { return filaHtml(f, e); }).join('') + '</div>' + altaHtml(f) + '</article>';
  }
  // R196m · Alta directa: 1 correo + Agregar. Sin selector de cuentas.
  function slotDe(f) { var s = Number(st.slot[f.id] || 0); var libre = f.espacios.filter(function (e) { return e.estado === 'disponible'; }); if (libre.some(function (e) { return e.posicion === s; })) return s; return libre.length ? libre[0].posicion : 0; }
  function altaHtml(f) {
    var m = st.msg[f.id], el = st.elegir && st.elegir.familiaId === f.id ? st.elegir : null;
    var msg = m ? '<div class="sp-msg ' + (m.tipo || '') + '" role="' + (m.tipo === 'err' ? 'alert' : 'status') + '">' + esc(m.txt) + '</div>' : '';
    if (!f.libres) return '<div class="sp-alta llena"><span>Cuenta llena: ' + f.ocupados + ' de ' + f.capacidad + ' espacios. Para agregar, primero retire a un invitado.</span></div>' + msg;
    var s = slotDe(f), env = st.enviando === f.id;
    return '<form class="sp-alta" data-sp-alta="' + esc(f.id) + '"><label for="spAlta_' + esc(f.id) + '">Correo del invitado <small class="sp-mute">· espacio ' + s + ' de ' + f.capacidad + '</small></label>' +
      '<div class="sp-alta-fila"><input id="spAlta_' + esc(f.id) + '" type="email" inputmode="email" autocomplete="off" placeholder="cliente@gmail.com" value="' + esc((st.borrador || {})[f.id] || '') + '"' + (env ? ' disabled' : '') + '>' +
      '<button type="submit" class="cm-btn primary"' + (env ? ' disabled' : '') + '>' + (env ? 'Agregando…' : 'Agregar') + '</button></div></form>' +
      (el ? '<div class="sp-elegir" role="dialog" aria-label="Elegir ficha"><b>Ese correo está en ' + el.opciones.length + ' fichas. ¿Cuál es?</b>' + el.opciones.map(function (o, i) { return '<button type="button" data-sp-elegir="' + i + '">' + esc(o.clienteNombre || o.clienteId) + (o.vence ? ' · vence ' + fecha(o.vence) : '') + '</button>'; }).join('') + '<button type="button" class="sp-mute" data-sp-elegir="x">Cancelar</button></div>' : '') + msg;
  }
  function pintar() {
    if (!st.el) return;
    var lista = st.familias.filter(coincide);
    var tot = st.familias.reduce(function (a, f) { a.c += f.capacidad; a.o += f.ocupados; return a; }, { c: 0, o: 0 });
    st.el.innerHTML = '<section class="sp-cm"><div class="sp-cm-cab"><div><h3>Spotify Premium Familiar</h3><p>' + st.familias.length + ' cuentas familiares · ' + tot.o + ' de ' + tot.c + ' espacios ocupados · cada espacio es un <b>correo invitado</b>.</p></div>' +
      '<button type="button" class="cm-btn primary" data-sp-acc="crear">+ Cuenta familiar</button></div>' +
      '<div class="sp-filtros"><input type="search" id="spBuscar" placeholder="Buscar correo administrador, invitado o cliente…" value="' + esc(st.q) + '" aria-label="Buscar en Spotify Familiar">' +
      ['todas:Todas', 'libres:Con espacios libres', 'ocupados:Llenas', 'pendientes:Pendientes', 'vencidos:Con vencidos'].map(function (x) { var p = x.split(':'); return '<button type="button" class="sp-chip ' + (st.filtro === p[0] ? 'on' : '') + '" data-sp-filtro="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
      (st.error ? '<div class="cm-status err" role="alert">' + esc(st.error) + '</div>' : '') +
      '<div class="sp-grid"><div class="sp-lista">' + (st.cargando && !st.familias.length ? '<div class="cm-empty">Cargando familias…</div>' : lista.length ? lista.map(familiaHtml).join('') : '<div class="cm-empty">No hay familias con este filtro.</div>') + '</div>' +
      '<aside class="sp-rel"><h4>Relación con Sublichat</h4>' +
      '<div><b>1 Administrador</b><small>No es un espacio vendible.</small></div><div><b>5 Correos invitados</b><small>Cinco espacios, identificados por correo.</small></div>' +
      '<div><b>Cliente y servicio existente</b><small>Se usa la ficha registrada; no se crea otra venta.</small></div><div><b>Renovaciones</b><small>El vencimiento sale de la ficha del cliente.</small></div>' +
      '<div><b>Sincronización</b><small>Bodega, APK y bot usan los mismos datos.</small></div><div><b>Finanzas</b><small>El costo familiar mensual se registra una sola vez por familia.</small></div></aside></div></section>';
    var q = st.el.querySelector('#spBuscar');
    if (q) q.addEventListener('input', function () { st.q = q.value; var pos = q.selectionStart; pintar(); var n = st.el.querySelector('#spBuscar'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } });
  }
  function cargar() {
    st.cargando = true; st.error = ''; pintar();
    return api({ accion: 'spotifyPanel' }).then(function (j) {
      st.cargando = false;
      if (!j || !j.ok) { st.error = (j && j.error) || 'No se pudo leer Spotify Familiar.'; return pintar(); }
      st.familias = j.familias || []; st.hoy = j.hoy || ''; pintar();
    }).catch(function () { st.cargando = false; st.error = 'Sin conexión con el servidor.'; pintar(); });
  }
  function agregar(fid, correo, extra) {
    var f = st.familias.filter(function (x) { return x.id === fid; })[0]; if (!f || st.enviando) return;
    correo = String(correo || '').trim();
    st.borrador = st.borrador || {}; st.borrador[fid] = correo;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) { st.msg[fid] = { tipo: 'err', txt: 'Escriba un correo válido (ej. cliente@gmail.com).' }; return pintar(); }
    var dup = st.familias.some(function (x) { return x.espacios.some(function (e) { return e.estado !== 'disponible' && String(e.correo || '').toLowerCase() === correo.toLowerCase(); }); });
    if (dup && !extra) { st.msg[fid] = { tipo: 'err', txt: 'Ese correo ya ocupa un espacio activo. Use «Mover» si debe cambiar de familia.' }; return pintar(); }
    st.enviando = fid; st.msg[fid] = null; pintar();
    api(Object.assign({ accion: 'spotifyAgregarCorreo', familiaId: fid, correo: correo, posicion: slotDe(f) }, extra || {})).then(function (j) {
      st.enviando = '';
      if (!j || !j.ok) { st.msg[fid] = { tipo: 'err', txt: (j && j.error) || 'No se pudo agregar.' }; return pintar(); }
      if (j.requiereElegir) { st.elegir = { familiaId: fid, correo: correo, opciones: j.opciones || [] }; return pintar(); }
      st.elegir = null; st.borrador[fid] = ''; st.slot[fid] = 0;
      st.msg[fid] = j.pendienteVincular ? { tipo: 'warn', txt: j.aviso } : { tipo: 'ok', txt: 'Agregado y vinculado con la ficha de ' + ((j.ficha && j.ficha.clienteNombre) || 'el cliente') + '.' };
      if (j.familia && j.familia.idempotente) st.msg[fid] = { tipo: 'ok', txt: 'Ese correo ya estaba en esta cuenta: no se duplicó.' };
      cargar();
    }).catch(function () { st.enviando = ''; st.msg[fid] = { tipo: 'err', txt: 'Sin conexión: no se agregó. Intente de nuevo.' }; pintar(); });
  }
  function hecho(j, okMsg) {
    if (!j || !j.ok) { alert((j && j.error) || 'No se pudo completar.'); return; }
    if (okMsg) st.error = '';
    st.abierto = ''; cargar();
  }
  function elegirFicha(correoSug) {
    var q = prompt('Buscar la ficha Spotify EXISTENTE del cliente (correo, ID de cliente o de compra):', correoSug || '');
    if (!q) return Promise.resolve(null);
    return api({ accion: 'spotifyBuscar', q: q }).then(function (j) {
      var l = (j && j.servicios) || [];
      if (!l.length) { alert('No hay fichas Spotify con ese dato. Registre primero el servicio en la ficha del cliente (sin crear otra venta aquí).'); return null; }
      var txt = l.map(function (s, i) { return (i + 1) + ') ' + s.clienteNombre + ' · ' + (s.correo || 'sin correo') + ' · vence ' + (s.fechaRenovacion || '—') + (s.spotifyFamiliaId ? ' · ya en una familia' : ''); }).join('\n');
      var n = Number(prompt('Elija el número de la ficha:\n\n' + txt, '1'));
      return l[n - 1] || null;
    });
  }
  function accion(b) {
    var acc = b.dataset.spAcc, fid = b.dataset.f, pos = Number(b.dataset.p) || 0, correo = b.dataset.c || '';
    if (acc === 'crear') { var m = prompt('Correo ADMINISTRADOR de la cuenta familiar (no ocupa espacio vendible):'); if (m) api({ accion: 'spotifyCrear', madreCorreo: m }).then(function (j) { hecho(j, true); }); return; }
    if (acc === 'vincular' || acc === 'pendiente') {
      var c = prompt('Correo INVITADO exacto para el espacio ' + pos + ':'); if (!c) return;
      if (acc === 'pendiente') { api({ accion: 'spotifyVincularEspacio', familiaId: fid, correo: c, posicion: pos, pendiente: true }).then(function (j) { hecho(j, true); }); return; }
      elegirFicha(c).then(function (s) { if (!s) return; api({ accion: 'spotifyVincularEspacio', familiaId: fid, correo: c, posicion: pos, clienteId: s.clienteId, compraId: s.compraId }).then(function (j) { hecho(j, true); }); });
      return;
    }
    if (acc === 'ficha') { elegirFicha(correo).then(function (s) { if (!s) return; api({ accion: 'spotifyVincularFicha', correo: correo, clienteId: s.clienteId, compraId: s.compraId }).then(function (j) { hecho(j, true); }); }); return; }
    if (acc === 'correo') { var n = prompt('Correo NUEVO para este espacio (se conserva el mismo cliente, ficha y vencimiento):', correo); if (n && n !== correo) api({ accion: 'spotifyCambiarCorreo', correoActual: correo, correoNuevo: n }).then(function (j) { hecho(j, true); }); return; }
    if (acc === 'aceptada') { api({ accion: 'spotifyMarcar', correo: correo, estadoInvitacion: 'aceptada' }).then(function (j) { hecho(j, true); }); return; }
    if (acc === 'retiro' || acc === 'quitar_retiro') { api({ accion: 'spotifyMarcar', correo: correo, retiroPendiente: acc === 'retiro' }).then(function (j) { hecho(j, true); }); return; }
    if (acc === 'mover') {
      var otras = st.familias.filter(function (f) { return f.id !== fid && f.libres > 0; });
      if (!otras.length) { alert('No hay otra familia con espacios libres.'); return; }
      var k = Number(prompt('Mover ' + correo + ' a:\n\n' + otras.map(function (f, i) { return (i + 1) + ') ' + f.codigo + ' · ' + f.madreCorreo + ' · ' + f.libres + ' libres'; }).join('\n'), '1'));
      var d = otras[k - 1]; if (!d) return;
      api({ accion: 'spotifyMover', correo: correo, destinoId: d.id }).then(function (j) { hecho(j, true); }); return;
    }
    if (acc === 'liberar') {
      if (!confirm('¿Ya RETIRÓ a ' + correo + ' de la familia en la app de Spotify?\n\nSublichat no puede hacerlo por usted. Solo así se libera el espacio. La ficha y el historial del cliente NO se borran y los demás invitados no cambian.')) return;
      api({ accion: 'spotifyLiberar', correo: correo, confirmoRetiro: true }).then(function (j) { if (j && j.advertencia) alert(j.advertencia); hecho(j, true); });
    }
  }
  function montar(el) {
    if (!el) return;
    var nuevo = st.el !== el; st.el = el;
    if (!el.dataset.spBind) {
      el.dataset.spBind = '1';
      el.addEventListener('input', function (ev) { var fm = ev.target.closest && ev.target.closest('[data-sp-alta]'); if (fm) { st.borrador = st.borrador || {}; st.borrador[fm.dataset.spAlta] = ev.target.value; } });
      el.addEventListener('submit', function (ev) { var fm = ev.target.closest('[data-sp-alta]'); if (!fm) return; ev.preventDefault(); var inp = fm.querySelector('input'); agregar(fm.dataset.spAlta, inp ? inp.value : ''); });
      el.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-sp-menu],[data-sp-acc],[data-sp-filtro],[data-sp-slot],[data-sp-elegir]'); if (!t) return;
        if (t.dataset.spSlot) { var ps = t.dataset.spSlot.split('|'); st.slot[ps[0]] = Number(ps[1]); pintar(); var inp = st.el.querySelector('#spAlta_' + (window.CSS && CSS.escape ? CSS.escape(ps[0]) : ps[0])); if (inp) inp.focus(); return; }
        if (t.dataset.spElegir) { var e2 = st.elegir; if (!e2) return; if (t.dataset.spElegir === 'x') { st.elegir = null; return pintar(); } var o = e2.opciones[Number(t.dataset.spElegir)]; st.elegir = null; return agregar(e2.familiaId, e2.correo, { clienteId: o.clienteId, compraId: o.compraId }); }
        if (t.dataset.spMenu) { st.abierto = st.abierto === t.dataset.spMenu ? '' : t.dataset.spMenu; return pintar(); }
        if (t.dataset.spFiltro) { st.filtro = t.dataset.spFiltro; return pintar(); }
        accion(t);
      });
    }
    if (nuevo || !st.familias.length) cargar(); else pintar();
  }
  window.SublichatSpotifyCM = { montar: montar, recargar: cargar, _st: st };
})();
