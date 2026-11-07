/* ui-v2-inicio.js · R162 Fase 2 — Inicio del diseño nuevo (Panel general).
   Solo con el diseño nuevo encendido. Usa los MISMOS datos y reglas de Sublichat (window.SublichatDatos, que
   publica sublichat-app.js al terminar de cargar): nada inventado, sin correos/claves/PIN.
   · Clientes activos = regla canónica de cartera vigente (igual que Clientes y la APK).
   · Por vencer = servicios que renuevan hoy o en los próximos 7 días (estado "Renueva hoy"/"En N días").
   · Vencidos del mes = servicios de este mes cuya fecha ya pasó (igual que "Pendiente / vencido").
   · Esperado del mes = suma de precios que renuevan este mes (igual que "Esperado este mes").
   Las acciones (renovar, cobrar, No renovó) siguen en Clientes: aquí solo se abre el cliente. */
(function () {
  'use strict';
  if (!document.documentElement.classList.contains('ui-v2')) return;

  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var LOGO = { netflix: 'netflix', disney: 'disney', hbo: 'hbo', max: 'hbo', prime: 'prime', amazon: 'prime', crunchyroll: 'crunchyroll', spotify: 'spotify', youtube: 'youtube', vix: 'vix', paramount: 'paramount', deezer: 'deezer', viki: 'viki', canva: 'canva', gemini: 'gemini', iptv: 'iptv', oleada: 'oleada-tv', stella: 'stella-tv', apple: 'appletv', chatgpt: 'chatgpt', universal: 'universal', latin: 'latin-tv', icomplay: 'icomplay' };
  function logo(p) { var k = String(p || '').toLowerCase(); for (var x in LOGO) if (k.indexOf(x) >= 0) return '/assets/platformas/' + LOGO[x] + '.jpg'; return ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function L(n) { return 'L' + Math.round(Number(n) || 0).toLocaleString('es-HN'); }
  function dias(f, hoy) { return Math.round((f - hoy) / 86400000); }
  function fechaCorta(f) { return f.getDate() + ' ' + MES[f.getMonth()] + ' ' + f.getFullYear(); }
  function ini(n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '')[0] || '?') + ((p[1] || '')[0] || ''); }
  var IC = {
    clientes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 19.5c.8-3.4 3.4-5.2 6.5-5.2s5.7 1.8 6.5 5.2"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.6c1.8.7 3 2.3 3.5 4.9"/>',
    vencer: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    vencido: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
    dinero: '<ellipse cx="12" cy="6.5" rx="7" ry="2.8"/><path d="M5 6.5v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5M5 11.5v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    flecha: '<path d="m9 6 6 6-6 6"/>', mas: '<path d="M12 5v14M5 12h14"/>'
  };
  function ico(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + IC[k] + '</svg>'; }
  function puede(s) { try { return !window.SublichatRBAC || window.SublichatRBAC.can(s); } catch (_) { return true; } }
  function ir(s) { try { window.SublichatRBAC ? window.SublichatRBAC.ir(s) : window.subliRBAC.go(s); } catch (_) {} }
  function abrirCliente(nombre) {
    ir('clientes');
    setTimeout(function () {
      var tabs = document.querySelector('[data-client-status=""]') || document.querySelector('[data-client-status="vigente"]');
      var q = document.getElementById('q'); if (!q) return;
      q.value = nombre; q.dispatchEvent(new Event('input', { bubbles: true }));
      try { window.scrollTo({ top: 0 }); } catch (_) {}
    }, 200);
  }

  function calcular(D) {
    var hoy = new Date(D.hoy); hoy.setHours(0, 0, 0, 0);
    var sv = D.servicios.filter(function (s) { return s.fecha; });
    var y = hoy.getFullYear(), m = hoy.getMonth();
    var enMes = function (f, off) { var r = new Date(y, m + off, 1); return f.getFullYear() === r.getFullYear() && f.getMonth() === r.getMonth(); };
    var porVencer = sv.filter(function (s) { var d = dias(s.fecha, hoy); return d >= 0 && d <= 7; });
    var hoyL = porVencer.filter(function (s) { return dias(s.fecha, hoy) === 0; });
    var vencMes = sv.filter(function (s) { return enMes(s.fecha, 0) && dias(s.fecha, hoy) < 0; });
    var mes = sv.filter(function (s) { return enMes(s.fecha, 0); });
    var prev = sv.filter(function (s) { return enMes(s.fecha, -1); });
    var suma = function (a) { return a.reduce(function (t, s) { return t + s.precio; }, 0); };
    // Cartera vigente por plataforma (valor que se cobra en cada renovación)
    var porP = {};
    sv.forEach(function (s) { if (dias(s.fecha, hoy) >= 0) porP[s.plataforma] = (porP[s.plataforma] || 0) + s.precio; });
    var plat = Object.keys(porP).map(function (k) { return [k, porP[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    // Cobros por semana: próximas 6 semanas (lunes a domingo) por fecha de renovación
    var lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    var semanas = [];
    for (var i = 0; i < 6; i++) {
      var a = new Date(lunes); a.setDate(lunes.getDate() + i * 7); var b = new Date(a); b.setDate(a.getDate() + 7);
      var lista = sv.filter(function (s) { return s.fecha >= a && s.fecha < b; });
      semanas.push({ etiqueta: a.getDate() + ' ' + MES[a.getMonth()], monto: suma(lista), n: lista.length });
    }
    var proximos = porVencer.slice().sort(function (a, b) { return a.fecha - b.fecha || a.nombre.localeCompare(b.nombre); });
    return {
      hoy: hoy, activos: D.resumen.clientes, servicios: D.resumen.servicios,
      porVencer: porVencer.length, porVencerMonto: suma(porVencer), hoyN: hoyL.length, hoyMonto: suma(hoyL),
      vencMes: vencMes.length, vencMesMonto: suma(vencMes),
      esperado: suma(mes), anterior: suma(prev), nombreMes: hoy.toLocaleDateString('es-HN', { month: 'long' }),
      plat: plat, semanas: semanas, proximos: proximos
    };
  }

  function tarjeta(tipo, icono, titulo, valor, pie) {
    return '<div class="v2k v2k-' + tipo + '"><span class="v2k-ico">' + ico(icono) + '</span><div><small>' + esc(titulo) + '</small><b>' + esc(valor) + '</b><em>' + pie + '</em></div></div>';
  }
  function barras(plat) {
    var top = plat.slice(0, 6); if (plat.length > 6) top.push(['Otras', plat.slice(6).reduce(function (t, x) { return t + x[1]; }, 0)]);
    if (!top.length) return '<p class="v2-vacio">Sin servicios vigentes.</p>';
    var max = Math.max.apply(null, top.map(function (x) { return x[1]; })) || 1;
    return '<div class="v2-barras">' + top.map(function (x, i) {
      var h = Math.max(4, Math.round(x[1] / max * 100));
      return '<div class="v2-barra"><span class="v2-barra-v">' + L(x[1]) + '</span><i style="height:' + h + '%;opacity:' + (1 - i * 0.1).toFixed(2) + '"></i><span class="v2-barra-l">' + esc(x[0]) + '</span></div>';
    }).join('') + '</div>';
  }
  function linea(sem) {
    var W = 520, H = 190, pl = 52, pr = 14, pt = 16, pb = 30;
    var max = Math.max.apply(null, sem.map(function (s) { return s.monto; })) || 1;
    var paso = (W - pl - pr) / (sem.length - 1);
    var pts = sem.map(function (s, i) { return [pl + i * paso, pt + (H - pt - pb) * (1 - s.monto / max)]; });
    var grid = '';
    for (var g = 0; g <= 4; g++) { var yy = pt + (H - pt - pb) * g / 4; grid += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '"/><text x="' + (pl - 8) + '" y="' + (yy + 4) + '" text-anchor="end">' + L(max * (1 - g / 4)) + '</text>'; }
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var area = d + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (H - pb) + ' L' + pl + ' ' + (H - pb) + 'Z';
    return '<svg class="v2-linea" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Cobros por semana"><g class="v2-grid">' + grid + '</g>' +
      '<path class="v2-area" d="' + area + '"/><path class="v2-trazo" d="' + d + '"/>' +
      pts.map(function (p, i) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4"><title>Semana del ' + esc(sem[i].etiqueta) + ': ' + L(sem[i].monto) + ' · ' + sem[i].n + ' servicios</title></circle><text class="v2-x" x="' + p[0].toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(sem[i].etiqueta) + '</text>'; }).join('') + '</svg>';
  }
  function estado(d) {
    if (d === 0) return '<span class="v2-pill v2-pill-rojo">Renueva hoy</span>';
    if (d === 1) return '<span class="v2-pill v2-pill-ambar">Mañana</span>';
    return '<span class="v2-pill v2-pill-ambar">En ' + d + ' días</span>';
  }
  function tabla(c, limite) {
    var filas = c.proximos.slice(0, limite);
    if (!filas.length) return '<p class="v2-vacio">No hay servicios por vencer en los próximos 7 días.</p>';
    return '<div class="v2-tabla-wrap"><table class="v2-tabla"><thead><tr><th>Cliente</th><th>Servicio</th><th>Vence</th><th>Estado</th><th class="r">Precio</th><th class="r">Acción</th></tr></thead><tbody>' +
      filas.map(function (s) {
        var lg = logo(s.plataforma), d = dias(s.fecha, c.hoy);
        return '<tr><td><span class="v2-av">' + esc(ini(s.nombre).toUpperCase()) + '</span><b>' + esc(s.nombre) + '</b></td>' +
          '<td><span class="v2-plat">' + (lg ? '<img src="' + lg + '" alt="" loading="lazy">' : '') + esc(s.plataforma) + (s.perfiles > 1 ? ' <small>· ' + s.perfiles + ' perfiles</small>' : '') + '</span></td>' +
          '<td>' + fechaCorta(s.fecha) + '</td><td>' + estado(d) + '</td><td class="r">' + L(s.precio) + '</td>' +
          '<td class="r"><button type="button" class="v2-btn-sec" data-v2cli="' + esc(s.nombre) + '">Gestionar</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="v2-lista-movil">' + filas.map(function (s) {
        var lg = logo(s.plataforma), d = dias(s.fecha, c.hoy);
        return '<button type="button" class="v2-fila" data-v2cli="' + esc(s.nombre) + '">' + (lg ? '<img src="' + lg + '" alt="">' : '<span class="v2-av">' + esc(ini(s.nombre).toUpperCase()) + '</span>') +
          '<span class="v2-fila-t"><b>' + esc(s.nombre) + '</b><small>' + esc(s.plataforma) + ' · ' + fechaCorta(s.fecha) + '</small></span>' + estado(d) + ico('flecha') + '</button>';
      }).join('') + '</div>';
  }

  var host, limite = 8, errorCarga = '';
  function pintar() {
    var D = window.SublichatDatos; var sec = document.getElementById('screen-inicio');
    if (!sec) return;
    if (!host) {
      host = document.createElement('div'); host.id = 'v2Inicio';
      sec.insertBefore(host, sec.firstChild);
      host.addEventListener('click', function (e) {
        var b = e.target.closest('[data-v2cli]'); if (b) return abrirCliente(b.getAttribute('data-v2cli'));
        var g = e.target.closest('[data-v2go]'); if (g) { var dest = g.getAttribute('data-v2go'); if (dest === '__recargar') { location.reload(); return; } if (dest === '__todos') { limite = limite === 8 ? 50 : 8; pintar(); } else ir(dest); }
      });
    }
    // R184 · mientras llegan los datos: esqueleto (nunca ceros provisionales); si falla: error claro con reintento
    if (!D) {
      host.innerHTML = errorCarga ? '<div class="v2-card v2-carga-error" role="alert"><b>No se pudieron cargar los datos de Inicio.</b><p>' + esc(errorCarga) + '</p><button type="button" class="v2-btn" data-v2go="__recargar">Reintentar</button></div>'
        : '<div class="v2-cab"><div><h2>Panel general</h2><p>Cargando cartera vigente…</p></div></div><div class="v2-kpis" aria-busy="true" aria-label="Cargando indicadores">' + [0, 1, 2, 3].map(function () { return '<div class="v2k v2-esq"><span class="v2k-ico"></span><div><small></small><b></b><em></em></div></div>'; }).join('') + '</div>' +
          '<div class="v2-graficas"><section class="v2-card v2-esq v2-esq-g"></section><section class="v2-card v2-esq v2-esq-g"></section></div>';
      return;
    }
    var c = calcular(D);
    var delta = c.anterior > 0 ? Math.round((c.esperado - c.anterior) / c.anterior * 100) : null;
    var nombre = (window.SublichatRBAC && window.SublichatRBAC.esSupervisor && window.SublichatRBAC.esSupervisor()) ? 'Sublicuentas' : ((window.SublichatRBAC && window.SublichatRBAC.usuario()) || '');
    var h = new Date().getHours(); var saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    host.innerHTML =
      '<div class="v2-cab"><div><h2>Panel general</h2><p>' + saludo + (nombre ? ', <span class="v2-cap">' + esc(nombre) + '</span>' : '') + ' · control de suscripciones y renovaciones</p></div>' +
      (puede('clientes') ? '<button type="button" class="v2-btn" data-v2go="agenda">' + ico('mas') + 'Registrar renovación</button>' : '') + '</div>' +
      '<div class="v2-kpis">' +
        tarjeta('neutro', 'clientes', 'Clientes activos', c.activos.toLocaleString('es-HN'), c.servicios.toLocaleString('es-HN') + ' servicios vigentes') +
        tarjeta('ambar', 'vencer', 'Por vencer · 7 días', c.porVencer.toLocaleString('es-HN'), (c.hoyN ? '<strong>' + c.hoyN + ' hoy</strong> · ' : '') + L(c.porVencerMonto)) +
        tarjeta('rojo', 'vencido', 'Vencidos este mes', c.vencMes.toLocaleString('es-HN'), L(c.vencMesMonto) + ' sin renovar') +
        tarjeta('verde', 'dinero', 'Esperado en ' + c.nombreMes, L(c.esperado), delta == null ? 'renovaciones del mes' : '<strong class="' + (delta >= 0 ? 'sube' : 'baja') + '">' + (delta >= 0 ? '↗ +' : '↘ ') + delta + '%</strong> vs. mes anterior') +
      '</div>' +
      '<div class="v2-graficas">' +
        '<section class="v2-card"><header><h3>Cartera vigente por plataforma</h3><span>valor por renovación</span></header>' + barras(c.plat) + '</section>' +
        '<section class="v2-card"><header><h3>Cobros próximos por semana</h3><span>por fecha de renovación</span></header>' + linea(c.semanas) + '</section>' +
      '</div>' +
      '<section class="v2-card v2-proximos"><header><h3>' + ico('cal') + 'Próximos vencimientos</h3>' +
        (c.proximos.length > 8 ? '<button type="button" class="v2-btn-sec" data-v2go="__todos">' + (limite === 8 ? 'Ver todos (' + c.proximos.length + ')' : 'Ver menos') + '</button>' : '') + '</header>' + tabla(c, limite) + '</section>';
  }
  var t;
  window.addEventListener('sublichat:datos', function () { clearTimeout(t); t = setTimeout(pintar, 60); });
  window.addEventListener('sublichat:datos-error', function (e) { if (!window.SublichatDatos) { errorCarga = (e.detail && e.detail.error) || 'Error de conexión.'; pintar(); } });
  function arrancar() { pintar(); } // R184: pinta el esqueleto de inmediato
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
  setInterval(function () { if (host && document.getElementById('screen-inicio').classList.contains('active')) pintar(); }, 60000); // cambio de día
})();
