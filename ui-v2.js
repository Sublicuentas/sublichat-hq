/* ui-v2.js · R162 — Base del diseño nuevo de Sublichat HQ (menú lateral, encabezado, barra inferior).
   Apagado por defecto. Se enciende con ?ui=v2 (queda guardado) o localStorage sublichat_ui_v2=1.
   Se apaga con ?ui=v1 o con "Diseño anterior" en el menú del usuario.
   El menú sale de window.SublichatRBAC.pantallas(): respeta los módulos que Sublicuentas activa o desactiva.
   No toca datos, APIs ni la APK. */
(function () {
  'use strict';
  var KEY = 'sublichat_ui_v2';
  function leer() { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } }
  function guardar(v) { try { v ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch (_) {} }
  try {
    var q = new URLSearchParams(location.search).get('ui');
    if (q === 'v2') guardar(true); else if (q === 'v1') guardar(false);
  } catch (_) {}
  var activo = leer();
  window.SublichatUI = {
    version: activo ? 'v2' : 'v1',
    usarNuevo: function () { guardar(true); location.reload(); },
    usarAnterior: function () { guardar(false); var u = new URL(location.href); u.searchParams.delete('ui'); location.replace(u.toString()); }
  };
  if (!activo) return;
  document.documentElement.classList.add('ui-v2');

  var GRUPOS = [
    ['Principal', ['inicio', 'clientes', 'agenda', 'control-cuentas', 'portal-cliente', 'catalogo-relojes', 'sorteos', 'tickets', 'revendedores', 'perfil']],
    ['Operación', ['importar', 'inventario', 'egresos', 'cierre']],
    ['Supervisión', ['actividad', 'auditoria', 'crm-master', 'estadisticas', 'permisos']],
    ['Extras', ['objetivos', 'chat', 'pelis', 'partidos']]
  ];
  var NOMBRE = {
    inicio: 'Inicio', clientes: 'Clientes', agenda: 'Renovaciones', 'control-cuentas': 'Control Maestro', 'portal-cliente': 'Portal Cliente',
    'catalogo-relojes': 'Catálogo', sorteos: 'Sorteos', tickets: 'Tickets / Avisos', revendedores: 'Panel de Socios', perfil: 'Perfil',
    importar: 'Mesas de trabajo', inventario: 'Bodega', egresos: 'Egresos', cierre: 'Cierre', actividad: 'Actividad', auditoria: 'Auditoría',
    'crm-master': 'CRM Master', estadisticas: 'Métricas', permisos: 'Usuarios y permisos', objetivos: 'Objetivos', chat: 'Subli', pelis: 'Pelis', partidos: 'Partidos'
  };
  var SUB = {
    inicio: 'Resumen del día', clientes: 'Cartera y servicios', agenda: 'Cobros y vencimientos', 'control-cuentas': 'Cuentas, perfiles y accesos',
    'portal-cliente': 'Enlaces y portal de clientes', 'catalogo-relojes': 'Productos y precios', sorteos: 'Sorteos y premios', tickets: 'Soporte interno y avisos',
    revendedores: 'Socios y entregas', perfil: 'Tu cuenta', importar: 'Flujo diario', inventario: 'Inventario', egresos: 'Gastos', cierre: 'Cierre de caja',
    actividad: 'Bitácora del sistema', auditoria: 'Cuadre y auditoría', 'crm-master': 'Base maestra', estadisticas: 'Indicadores', permisos: 'Módulos por usuario',
    objetivos: 'Metas', chat: 'Asistente', pelis: 'Estrenos', partidos: 'Agenda deportiva'
  };
  var P = { // íconos de línea (24x24)
    inicio: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
    clientes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 19.5c.8-3.4 3.4-5.2 6.5-5.2s5.7 1.8 6.5 5.2"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.6c1.8.7 3 2.3 3.5 4.9"/>',
    agenda: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="m9 14.5 2 2 4-4"/>',
    'control-cuentas': '<rect x="3.5" y="4" width="17" height="5" rx="1.5"/><rect x="3.5" y="11" width="17" height="9" rx="1.5"/><path d="M7 6.5h.01M7 15.5h6"/>',
    'portal-cliente': '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5S9.6 5.9 12 3.5"/>',
    'catalogo-relojes': '<path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
    sorteos: '<rect x="3.5" y="9" width="17" height="11.5" rx="1.5"/><path d="M2.5 9h19v-3h-19zM12 6v14.5"/><path d="M12 6c-1.5-3.5-5.5-3.5-5.5-1S10 6 12 6c2 0 5.5.5 5.5-1s-4-2.5-5.5 1"/>',
    tickets: '<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5z"/><path d="M14 5v14" stroke-dasharray="2 2.2"/>',
    revendedores: '<path d="m7.5 12.5 3 3a2 2 0 0 0 2.8 0l5.2-5.2"/><path d="M2.5 9.5 7 5l4 2 2.5-1.5L21.5 9 18 16.5l-3 1.5-7-4.5-5.5-4z"/>',
    perfil: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/>',
    importar: '<path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 15.5v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    inventario: '<path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8"/>',
    egresos: '<rect x="3" y="6" width="18" height="12.5" rx="2"/><path d="M3 10h18M7 15h3"/>',
    cierre: '<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8.5h6M9 12h6"/>',
    actividad: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
    auditoria: '<circle cx="11" cy="11" r="6.5"/><path d="m20.5 20.5-4.8-4.8M8.5 11l2 2 3.5-3.5"/>',
    'crm-master': '<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6"/>',
    estadisticas: '<path d="M4 20.5V10M10 20.5V4M16 20.5v-7M21 20.5H3"/>',
    permisos: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
    objetivos: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    chat: '<rect x="4.5" y="7.5" width="15" height="11" rx="3"/><path d="M12 7.5V4M9 12.5h.01M15 12.5h.01M9.5 15.5h5"/>',
    pelis: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 9.5h17M8 5 6.5 9.5M13 5l-1.5 4.5M18 5l-1.5 4.5"/>',
    partidos: '<circle cx="12" cy="12" r="8.5"/><path d="m12 7.5 4 3-1.5 4.5h-5L8 10.5z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', buscar: '<circle cx="11" cy="11" r="6.5"/><path d="m20.5 20.5-4.8-4.8"/>',
    campana: '<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
    mas: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
    salir: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h12"/>', atras: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'
  };
  function ico(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (P[k] || P.mas) + '</svg>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rbac() { return window.SublichatRBAC || null; }
  function pantallas() { var r = rbac(); try { return r ? r.pantallas() : ['inicio', 'clientes']; } catch (_) { return ['inicio', 'clientes']; } }
  function puede(s) { var r = rbac(); try { return r ? !!r.can(s) : s === 'inicio'; } catch (_) { return false; } }
  function ir(s) {
    cerrarDrawer(); cerrarPop();
    var r = rbac(); if (r && r.ir) r.ir(s); else if (window.subliRBAC) window.subliRBAC.go(s);
    marcar(s); try { window.scrollTo({ top: 0 }); } catch (_) {}
  }
  function actual() { var a = document.querySelector('.wrap > .screen.active'); return a ? a.id.replace(/^screen-/, '') : 'inicio'; }

  var shell, menuEl, tituloEl, subEl, puntoEl, popEl, abajoEl;
  function montar() {
    if (shell) return;
    shell = document.createElement('div'); shell.id = 'v2Shell';
    shell.innerHTML =
      '<aside class="v2-side" aria-label="Menú principal">' +
        '<div class="v2-brand"><img src="/assets/sublicuentas-logo-claro-ui.webp" alt="Sublicuentas" width="154" height="30"></div>' +
        '<nav class="v2-menu" id="v2Menu"></nav>' +
        '<button class="v2-robot" id="v2Robot" type="button"><img src="/assets/sublirobot-96.webp" alt="" width="46" height="46"><div><b>Subli</b><span>Pregúntele lo que necesite</span></div></button>' +
      '</aside>' +
      '<div class="v2-velo" id="v2Velo"></div>' +
      '<header class="v2-head">' +
        '<button class="v2-burger" id="v2Burger" type="button" aria-label="Abrir menú">' + ico('menu') + '</button>' +
        '<div class="v2-title"><h1 id="v2Titulo">Inicio</h1><p id="v2Sub"></p></div>' +
        '<label class="v2-search">' + ico('buscar') + '<input id="v2Buscar" type="search" placeholder="Buscar cliente, teléfono…" autocomplete="off"></label>' +
        '<button class="v2-icon" id="v2Campana" type="button" aria-label="Tickets y avisos">' + ico('campana') + '<span class="v2-dot" id="v2Punto"></span></button>' +
        '<div class="v2-userbox" id="v2UserBox"><button class="v2-user" id="v2User" type="button" aria-haspopup="menu"><img src="/assets/sublirobot-96.webp" alt=""><div class="v2-who"><b id="v2Nombre"></b><span id="v2Rol"></span></div></button>' +
          '<div class="v2-pop" id="v2Pop" role="menu">' +
            '<button type="button" data-v2="perfil">' + ico('perfil') + 'Perfil</button>' +
            '<button type="button" data-v2="anterior">' + ico('atras') + 'Diseño anterior</button><hr>' +
            '<button type="button" data-v2="salir" class="peligro">' + ico('salir') + 'Salir</button>' +
          '</div></div>' +
      '</header>' +
      '<nav class="v2-bottom" id="v2Abajo" aria-label="Accesos rápidos"></nav>';
    document.body.appendChild(shell);
    menuEl = shell.querySelector('#v2Menu'); tituloEl = shell.querySelector('#v2Titulo'); subEl = shell.querySelector('#v2Sub');
    puntoEl = shell.querySelector('#v2Punto'); popEl = shell.querySelector('#v2Pop'); abajoEl = shell.querySelector('#v2Abajo');

    menuEl.addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (b) ir(b.getAttribute('data-s')); });
    abajoEl.addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b) return; var s = b.getAttribute('data-s'); if (s === '__mas') abrirDrawer(); else ir(s); });
    shell.querySelector('#v2Robot').addEventListener('click', function () { ir('chat'); });
    shell.querySelector('#v2Burger').addEventListener('click', abrirDrawer);
    shell.querySelector('#v2Velo').addEventListener('click', cerrarDrawer);
    shell.querySelector('#v2Campana').addEventListener('click', function () { if (puede('tickets')) ir('tickets'); });
    shell.querySelector('#v2UserBox').addEventListener('click', function (e) {
      var b = e.target.closest('[data-v2]');
      if (!b) { popEl.classList.toggle('on'); e.stopPropagation(); return; }
      e.stopPropagation(); var a = b.getAttribute('data-v2'); cerrarPop();
      if (a === 'perfil') ir('perfil');
      else if (a === 'anterior') window.SublichatUI.usarAnterior();
      else if (a === 'salir') { var lo = document.getElementById('logoutBtn'); if (lo) lo.click(); }
    });
    document.addEventListener('click', cerrarPop);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { cerrarPop(); cerrarDrawer(); } });
    var buscar = shell.querySelector('#v2Buscar');
    var pasarBusqueda = function () {
      if (!puede('clientes')) return;
      if (actual() !== 'clientes') ir('clientes');
      var qi = document.getElementById('q'); if (!qi) return;
      qi.value = buscar.value; qi.dispatchEvent(new Event('input', { bubbles: true }));
    };
    var t; buscar.addEventListener('input', function () { clearTimeout(t); t = setTimeout(pasarBusqueda, 250); });
    buscar.addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(t); pasarBusqueda(); } });
    construir(); marcar(actual()); usuario(); campana();
  }
  function abrirDrawer() { document.documentElement.classList.add('v2-abierto'); }
  function cerrarDrawer() { document.documentElement.classList.remove('v2-abierto'); }
  function cerrarPop() { if (popEl) popEl.classList.remove('on'); }

  function construir() {
    if (!menuEl) return;
    var vis = pantallas(), set = {}, usados = {};
    vis.forEach(function (s) { set[s] = 1; });
    var html = '';
    GRUPOS.forEach(function (g) {
      var items = g[1].filter(function (s) { return set[s]; });
      if (g[0] === 'Extras') vis.forEach(function (s) { if (!NOMBRE[s] && items.indexOf(s) < 0) items.push(s); }); // pantallas futuras
      if (!items.length) return;
      html += '<div class="v2-grupo"><small>' + esc(g[0]) + '</small>' + items.map(function (s) {
        usados[s] = 1;
        var nom = NOMBRE[s] || ((rbac() && rbac().meta(s)[1]) || s);
        return '<button type="button" class="v2-item" data-s="' + esc(s) + '">' + ico(s) + '<span>' + esc(nom) + '</span>' + (s === 'tickets' ? '<i class="v2-num" style="display:none"></i>' : '') + '</button>';
      }).join('') + '</div>';
    });
    menuEl.innerHTML = html;
    shell.querySelector('#v2Robot').style.display = set.chat ? '' : 'none';
    shell.querySelector('#v2Campana').style.display = set.tickets ? '' : 'none';
    var rapidos = [['inicio', 'Inicio', 'inicio'], ['clientes', 'Clientes', 'clientes'], ['agenda', 'Renovar', 'agenda']].filter(function (x) { return set[x[0]]; });
    abajoEl.innerHTML = rapidos.concat([['__mas', 'Más', 'mas']]).map(function (x) {
      return '<button type="button" data-s="' + x[0] + '">' + ico(x[2]) + '<span>' + x[1] + '</span></button>';
    }).join('');
    marcar(actual()); campana();
  }
  function marcar(s) {
    if (!shell) return;
    shell.querySelectorAll('[data-s]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-s') === s); });
    var nom = NOMBRE[s] || ((rbac() && rbac().meta(s)[1]) || 'Sublichat');
    tituloEl.textContent = nom; subEl.textContent = SUB[s] || '';
    try { document.title = nom + ' · Sublichat'; } catch (_) {}
  }
  function usuario() {
    var r = rbac(); if (!r || !shell) return;
    var u = r.usuario() || ''; var nombre = r.esSupervisor() ? 'Sublicuentas' : (u === 'libni' ? 'Relojes' : u);
    shell.querySelector('#v2Nombre').textContent = nombre || 'Usuario';
    shell.querySelector('#v2Rol').textContent = r.esSupervisor() ? 'Supervisor' : r.rolEtiqueta();
  }
  function campana() {
    if (!shell) return;
    var b = document.querySelector('.nav-btn[data-screen="tickets"] .ticket-nav-notify');
    var n = b && b.style.display !== 'none' ? String(b.textContent || '').trim() : '';
    puntoEl.textContent = n; puntoEl.style.display = n ? 'grid' : 'none';
    var num = shell.querySelector('.v2-item[data-s="tickets"] .v2-num'); if (num) { num.textContent = n; num.style.display = n ? 'grid' : 'none'; }
  }

  window.addEventListener('sublichat:nav', function () { construir(); usuario(); });
  window.addEventListener('sublichat:screen', function (e) { marcar((e.detail && e.detail.screen) || actual()); });
  function iniciar() {
    montar();
    // La pantalla activa también puede cambiar por botones internos (atajos de Inicio): se sigue la clase .active.
    var wrap = document.querySelector('.wrap');
    var pend = 0, ultima = '';
    var revisar = function () { if (pend) return; pend = 1; setTimeout(function () { pend = 0; var s = actual(); if (s !== ultima) { ultima = s; marcar(s); } campana(); }, 300); };
    if (wrap) new MutationObserver(revisar).observe(wrap, { childList: true, attributes: true, attributeFilter: ['class'], subtree: true });
    var nav = document.querySelector('.nav.focus-nav');
    if (nav) new MutationObserver(revisar).observe(nav, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style'] });
    var tries = 0, iv = setInterval(function () { tries++; if (rbac()) { construir(); usuario(); } if (rbac() || tries > 60) clearInterval(iv); }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
