/* pelis-rec.js · R210 · «Recomendaciones del día» y «Cartelera y estrenos» de Pelis y estrenos.
   Un solo código para Sublichat Web y la APK (copia fiel en public/ de la APK).
   Uso: window.SublichatPelisRec.montar(elemento, { post: (body) => Promise<json>, actualizado: elemento opcional })
   - Lee /api/tmdb {accion:'recomendaciones'} (misma selección para todos ese día, hora de Honduras).
   - Si falla, muestra error + Reintentar; el buscador de títulos no depende de esto.
   - Sin logos de terceros: cada plataforma es una pastilla con su nombre y color. */
(function () {
  'use strict';
  var BASE = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/pelis-rec\.js.*$/, '') : '/'; })();
  var IMG = function (n) { return BASE + 'assets/pelis/' + n + '.webp'; };
  var st = { data: null, cargando: false, error: '', mas: false, tipo: '', plat: '', cartelera: false, detalle: null, detCargando: false, detError: '' };
  var cfg = null, host = null, pidiendo = null;
  var COLOR = { 'Netflix': ['#E50914', '#fff'], 'Prime Video': ['#1A98FF', '#fff'], 'Disney+': ['#0B1F6B', '#fff'], 'Max': ['#002BE7', '#fff'], 'HBO Max': ['#002BE7', '#fff'], 'Paramount+': ['#0064FF', '#fff'], 'Apple TV+': ['#111827', '#fff'], 'Crunchyroll': ['#F47521', '#fff'], 'ViX': ['#F05A28', '#fff'], 'Universal+': ['#1E3A8A', '#fff'], 'MUBI': ['#0F172A', '#fff'], 'Tubi': ['#7408FF', '#fff'], 'Pluto TV': ['#FFE14D', '#111'], 'Star+': ['#1F2A44', '#fff'], 'Claro video': ['#DA291C', '#fff'], 'Viki': ['#1EB7E5', '#fff'] };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hoyHN() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tegucigalpa' }); }
  function pastilla(p) { var c = COLOR[p] || ['#475569', '#fff']; return '<span class="plr-prov" style="background:' + c[0] + ';color:' + c[1] + '">' + esc(p) + '</span>'; }
  function guardar(d) { try { localStorage.setItem('plRec', JSON.stringify(d)); } catch (_) {} }
  function leerGuardado() { try { var d = JSON.parse(localStorage.getItem('plRec') || 'null'); return d && d.fecha === hoyHN() ? d : null; } catch (_) { return null; } }

  function cargar(forzar) {
    if (pidiendo && !forzar) return pidiendo;
    st.cargando = true; st.error = ''; pintar();
    pidiendo = Promise.resolve().then(function () { return cfg.post({ accion: 'recomendaciones' }); }).then(function (j) {
      if (!j || j.error) throw new Error((j && j.error) || 'Sin respuesta del servidor.');
      st.data = j; guardar(j);
    }).catch(function (e) { st.error = (e && e.message) || 'No se pudieron cargar las recomendaciones.'; })
      .then(function () { st.cargando = false; pidiendo = null; pintar(); });
    return pidiendo;
  }

  function tarjeta(r, i) {
    return '<article class="plr-card" data-plr-det="' + esc(r.tipo + ':' + r.id) + '" tabindex="0" role="button" aria-label="Ver detalle de ' + esc(r.titulo) + '">' +
      '<img class="plr-poster" src="' + esc(r.poster) + '" alt="" loading="' + (i < 3 ? 'eager' : 'lazy') + '"><span class="plr-div"></span>' +
      '<div class="plr-info"><div class="plr-top"><h3>' + esc(r.titulo) + '</h3>' + (r.rating ? '<span class="plr-rate"><img src="' + IMG('estrella') + '" alt="">' + r.rating.toFixed(1) + '</span>' : '') + '</div>' +
      '<div class="plr-meta"><span class="plr-tipo"><img src="' + IMG(r.tipo === 'tv' ? 'tipo_serie' : 'tipo_peli') + '" alt="">' + esc(r.tipoTxt) + '</span>' + (r.anio ? '<span>' + esc(r.anio) + '</span>' : '') + (r.generos && r.generos.length ? '<span>' + esc(r.generos.join(' · ')) + '</span>' : '') + '</div>' +
      '<p class="plr-sin">' + esc(r.sinopsis) + '</p>' +
      '<div class="plr-donde"><b>Dónde verla:</b>' + r.proveedores.map(pastilla).join('') + '</div></div></article>';
  }
  function cartel(c) {
    return '<article class="plr-cine" data-plr-det="movie:' + esc(c.id) + '" tabindex="0" role="button" aria-label="Ver detalle de ' + esc(c.titulo) + '"><img src="' + esc(c.poster) + '" alt="" loading="lazy"><span class="plr-div"></span><div><h3>' + esc(c.titulo) + '</h3><span class="plr-est">' + esc(c.estado) + '</span><small><img src="' + IMG('mini_cal') + '" alt="">' + esc(c.nota) + '</small></div></article>';
  }

  function pintar() {
    if (!host || !host.isConnected) return;
    var d = st.data, upd = cfg && cfg.actualizado && (typeof cfg.actualizado === 'function' ? cfg.actualizado() : cfg.actualizado);
    if (upd) { upd.hidden = !d; upd.textContent = d ? 'Actualizado ' + d.horaHN : ''; }
    var h = '<section class="plr-sec"><header class="plr-head"><img class="plr-star" src="' + IMG('estrella') + '" alt=""><h2>Recomendaciones del día</h2><span class="plr-sel"><img src="' + IMG('selec_cal') + '" alt=""><span>Selección diaria<br>para ti</span></span></header>';
    if (!d && st.cargando) h += '<div class="plr-list">' + [0, 1, 2].map(function () { return '<div class="plr-card plr-skel"><i></i><span class="plr-div"></span><div><b></b><b></b><b></b></div></div>'; }).join('') + '</div><p class="plr-msg">Cargando las recomendaciones de hoy…</p>';
    else if (!d && st.error) h += '<div class="plr-err"><span>' + esc(st.error) + '</span><button type="button" class="plr-btn" data-plr="reintentar">Reintentar</button></div>';
    else if (d && !d.recomendaciones.length) h += '<div class="plr-err"><span>Hoy no hay títulos confirmados en Honduras.</span><button type="button" class="plr-btn" data-plr="reintentar">Reintentar</button></div>';
    else if (d) {
      var vis = d.visibles || 3, lista = d.recomendaciones;
      if (st.mas) lista = lista.filter(function (r) { return (!st.tipo || r.tipo === st.tipo) && (!st.plat || r.proveedores.indexOf(st.plat) >= 0); });
      else lista = lista.slice(0, vis);
      if (st.mas) {
        var plats = []; d.recomendaciones.forEach(function (r) { r.proveedores.forEach(function (p) { if (plats.indexOf(p) < 0) plats.push(p); }); });
        h += '<div class="plr-filtros"><div>' + [['', 'Todo'], ['movie', 'Películas'], ['tv', 'Series']].map(function (x) { return '<button type="button" class="' + (st.tipo === x[0] ? 'on' : '') + '" data-plr-tipo="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
          '<div>' + [''].concat(plats).map(function (p) { return '<button type="button" class="' + (st.plat === p ? 'on' : '') + '" data-plr-plat="' + esc(p) + '">' + (p ? esc(p) : 'Todas las plataformas') + '</button>'; }).join('') + '</div></div>';
      }
      h += '<div class="plr-list">' + (lista.length ? lista.map(tarjeta).join('') : '<p class="plr-msg">No hay recomendaciones de hoy con ese filtro.</p>') + '</div>';
      if (d.recomendaciones.length > vis) h += '<button type="button" class="plr-mas" data-plr="mas">' + (st.mas ? 'Ver solo las ' + vis + ' del día' : 'Ver más recomendaciones (' + d.recomendaciones.length + ')') + '</button>';
      if (st.error) h += '<p class="plr-msg">No se pudo actualizar: se muestran las de hoy guardadas. <button type="button" class="plr-link" data-plr="reintentar">Reintentar</button></p>';
    }
    h += '</section>';
    if (d && d.cartelera && d.cartelera.length) {
      var cs = st.cartelera ? d.cartelera : d.cartelera.slice(0, 2);
      h += '<section class="plr-sec"><header class="plr-head2"><img src="' + IMG('claqueta') + '" alt=""><h2>Cartelera y estrenos</h2>' + (d.cartelera.length > 2 ? '<button type="button" class="plr-vermas" data-plr="cartelera">' + (st.cartelera ? 'Ver menos' : 'Ver más') + ' <i>›</i></button>' : '') + '</header><div class="plr-cines">' + cs.map(cartel).join('') + '</div><p class="plr-fuente">Cines y plataformas en Honduras según TMDB/JustWatch. Solo se muestra lo incluido en la suscripción; alquiler o compra no cuenta.</p></section>';
    }
    if (st.detalle || st.detCargando || st.detError) h += modal();
    host.innerHTML = h;
  }
  function modal() {
    var x = st.detalle, cuerpo;
    if (st.detCargando) cuerpo = '<div class="plr-msg"><span class="plr-spin"></span> Cargando detalle…</div>';
    else if (st.detError) cuerpo = '<div class="plr-err"><span>' + esc(st.detError) + '</span><button type="button" class="plr-btn" data-plr="det-reintentar">Reintentar</button></div>';
    else {
      var datos = [x.tipoTxt, x.anio, x.clasificacion ? 'Clasificación ' + x.clasificacion : '', x.duracion ? Math.floor(x.duracion / 60) + ' h ' + (x.duracion % 60) + ' min' : '', x.temporadas ? x.temporadas + ' temporada' + (x.temporadas === 1 ? '' : 's') + (x.episodios ? ' · ' + x.episodios + ' episodios' : '') : '', x.estadoSerie].filter(Boolean);
      cuerpo = '<div class="plr-det-top">' + (x.poster ? '<img src="' + esc(x.poster) + '" alt="">' : '') + '<div><h2>' + esc(x.titulo) + '</h2>' + (x.tagline ? '<em>' + esc(x.tagline) + '</em>' : '') +
        '<div class="plr-meta">' + datos.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' + (x.generos.length ? '<p class="plr-gen">' + esc(x.generos.join(' · ')) + '</p>' : '') +
        (x.rating ? '<span class="plr-rate"><img src="' + IMG('estrella') + '" alt="">' + x.rating.toFixed(1) + '</span>' : '') + '</div></div>' +
        '<p class="plr-sin full">' + esc(x.sinopsis || 'Sin sinopsis disponible.') + '</p>' +
        '<div class="plr-donde"><b>Dónde verla en Honduras:</b>' + (x.proveedores.length ? x.proveedores.map(pastilla).join('') : '<em>' + (x.soloAlquiler ? 'Solo en alquiler o compra: no está incluida en ninguna suscripción.' : 'Sin plataforma confirmada en Honduras.') + '</em>') + '</div>';
    }
    return '<div class="plr-modal" role="dialog" aria-modal="true" aria-label="Detalle"><button type="button" class="plr-velo" data-plr="cerrar" aria-label="Cerrar"></button><div class="plr-caja"><button type="button" class="plr-x" data-plr="cerrar" aria-label="Cerrar">×</button>' + cuerpo + '<button type="button" class="plr-btn plr-cerrar" data-plr="cerrar">Cerrar</button></div></div>';
  }
  var ultimoDet = null;
  function abrirDetalle(k) {
    var p = String(k).split(':'); ultimoDet = k;
    st.detalle = null; st.detError = ''; st.detCargando = true; pintar();
    Promise.resolve().then(function () { return cfg.post({ accion: 'detalle', tipo: p[0], id: p[1] }); }).then(function (j) {
      if (!j || j.error || !j.detalle) throw new Error((j && j.error) || 'No se pudo cargar el detalle.');
      if (ultimoDet === k) st.detalle = j.detalle;
    }).catch(function (e) { if (ultimoDet === k) st.detError = (e && e.message) || 'No se pudo cargar el detalle.'; })
      .then(function () { if (ultimoDet === k) { st.detCargando = false; pintar(); } });
  }
  function cerrarDetalle() { ultimoDet = null; st.detalle = null; st.detError = ''; st.detCargando = false; pintar(); }

  function eventos(el) {
    if (el.__plr) return; el.__plr = true;
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-plr],[data-plr-tipo],[data-plr-plat],[data-plr-det]'); if (!t || !el.contains(t)) return;
      if (t.hasAttribute('data-plr-tipo')) { st.tipo = t.getAttribute('data-plr-tipo'); return pintar(); }
      if (t.hasAttribute('data-plr-plat')) { st.plat = t.getAttribute('data-plr-plat'); return pintar(); }
      if (t.hasAttribute('data-plr-det')) return abrirDetalle(t.getAttribute('data-plr-det'));
      var a = t.getAttribute('data-plr');
      if (a === 'reintentar') return cargar(true);
      if (a === 'mas') { st.mas = !st.mas; if (!st.mas) { st.tipo = ''; st.plat = ''; } return pintar(); }
      if (a === 'cartelera') { st.cartelera = !st.cartelera; return pintar(); }
      if (a === 'cerrar') return cerrarDetalle();
      if (a === 'det-reintentar') return abrirDetalle(ultimoDet);
    });
    el.addEventListener('keydown', function (e) { var t = e.target.closest && e.target.closest('[data-plr-det]'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirDetalle(t.getAttribute('data-plr-det')); } if (e.key === 'Escape' && (st.detalle || st.detCargando || st.detError)) cerrarDetalle(); });
  }

  // montar() se puede llamar en cada render de la APK: usa lo que ya está en memoria y solo consulta 1 vez al día.
  function montar(el, c) {
    if (!el) return; host = el; cfg = c || cfg; eventos(el);
    if (!st.data) st.data = leerGuardado();
    if (st.data && st.data.fecha !== hoyHN()) st.data = null;
    pintar();
    if (!st.data && !st.cargando && !st.error) cargar();
  }
  window.SublichatPelisRec = { montar: montar, recargar: function () { return cargar(true); }, _estado: st };
})();
