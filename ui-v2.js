/* ui-v2.js · R164 — Diseño nuevo de Sublichat Web: NAVEGACIÓN SUPERIOR (sin menú lateral).
   Guía "Sublichat Web · Rediseño integral" (05/11/2026): encabezado grafito con logo, buscador, avisos y perfil;
   fila clara de categorías con el activo en rojo y grupos desplegables; área de trabajo a ancho fluido.
   Apagado por defecto. Se enciende con ?ui=v2 (queda guardado) o localStorage sublichat_ui_v2=1.
   Se apaga con ?ui=v1 o con "Diseño anterior" en el menú del perfil.
   El menú sale de window.SublichatRBAC.pantallas(): respeta los módulos que Sublicuentas activa o desactiva.
   Solo presentación: no toca datos, APIs, Firebase, APK ni bot. Las pantallas se abren con SublichatRBAC.ir(). */
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

  // Mapa de navegación (guía p. 7). Los grupos son visuales: cada destino abre su pantalla de siempre.
  var NAV = [
    { s: 'inicio' }, { s: 'clientes' }, { s: 'agenda' }, { s: 'control-cuentas' }, { s: 'portal-cliente' }, { s: 'catalogo-relojes' },
    { g: 'Operación', items: ['importar', 'inventario', 'egresos', 'cierre'] },
    { g: 'Supervisión', items: ['actividad', 'auditoria', 'crm-master', 'estadisticas', 'permisos'] },
    { g: 'Más', items: ['sorteos', 'tickets', 'revendedores', 'chat', 'objetivos', 'pelis', 'partidos'] }
  ];
  var NOMBRE = {
    inicio: 'Inicio', clientes: 'Clientes', agenda: 'Renovaciones', 'control-cuentas': 'Control Maestro', 'portal-cliente': 'Portal Cliente',
    'catalogo-relojes': 'Catálogo', sorteos: 'Sorteos', tickets: 'Tickets / Avisos', revendedores: 'Panel de Socios', perfil: 'Mi perfil',
    importar: 'Mesas de trabajo', inventario: 'Bodega', egresos: 'Egresos', cierre: 'Cierre', actividad: 'Actividad', auditoria: 'Auditoría',
    'crm-master': 'CRM Master', estadisticas: 'Métricas', permisos: 'Usuarios y permisos', objetivos: 'Objetivos', chat: 'Subli', pelis: 'Pelis', partidos: 'Partidos'
  };
  var DESC = {
    importar: 'Documentos y flujo diario', inventario: 'Cuentas y cupos', egresos: 'Gastos del periodo', cierre: 'Cierre de caja',
    actividad: 'Bitácora del sistema', auditoria: 'Cuadre y revisiones', 'crm-master': 'Base maestra de clientes', estadisticas: 'Indicadores por periodo',
    permisos: 'Módulos por usuario', sorteos: 'Campañas y premios', tickets: 'Soporte interno y avisos', revendedores: 'Socios y entregas',
    chat: 'Asistente', objetivos: 'Metas diarias, semanales y mensuales', pelis: 'Estrenos', partidos: 'Agenda deportiva'
  };
  var P = { // íconos de línea 24x24 (estilo Lucide, licencia ISC), mismo trazo en todo el menú
    inicio: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    clientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    agenda: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
    'control-cuentas': '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    'portal-cliente': '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    'catalogo-relojes': '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    sorteos: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
    tickets: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
    revendedores: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
    perfil: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    importar: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    inventario: '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/>',
    egresos: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    cierre: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    actividad: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
    auditoria: '<path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M4.27 21a2 2 0 0 0 1.73 1H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3"/><path d="m9 18-1.5-1.5"/><circle cx="5" cy="14" r="3"/>',
    'crm-master': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
    estadisticas: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    permisos: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    objetivos: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    chat: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
    pelis: '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    partidos: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>', buscar: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    campana: '<path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"/>',
    mas: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>', atras: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'
  };
  function ico(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (P[k] || P.mas) + '</svg>'; }
  P.flecha = '<path d="m6 9 6 6 6-6"/>';
  P.op = '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>';
  P.puntos = '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>';
  P.cerrar = '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rbac() { return window.SublichatRBAC || null; }
  function pantallas() { var r = rbac(); try { return r ? r.pantallas() : ['inicio', 'clientes']; } catch (_) { return ['inicio', 'clientes']; } }
  function puede(s) { var r = rbac(); try { return r ? !!r.can(s) : s === 'inicio'; } catch (_) { return false; } }
  function actual() { var a = document.querySelector('.wrap > .screen.active'); return a ? a.id.replace(/^screen-/, '') : 'inicio'; }
  var reducido = false; try { reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}

  function ir(s) {
    cerrarTodo();
    var r = rbac(); if (r && r.ir) r.ir(s); else if (window.subliRBAC) window.subliRBAC.go(s);
    marcar(s); animarEntrada();
    try { window.scrollTo({ top: 0, behavior: reducido ? 'auto' : 'smooth' }); } catch (_) { window.scrollTo(0, 0); }
    var main = document.getElementById('v2Main'); if (main) try { main.focus({ preventScroll: true }); } catch (_) {}
  }
  function animarEntrada() {
    if (reducido) return;
    var a = document.querySelector('.wrap > .screen.active'); if (!a) return;
    a.classList.remove('v2-entra'); void a.offsetWidth; a.classList.add('v2-entra');
  }

  var shell, filaEl, tituloDoc, popUser, panelMovil, puntoEl;
  function montar() {
    if (shell) return;
    shell = document.createElement('div'); shell.id = 'v2Shell';
    shell.innerHTML =
      '<a class="v2-salto" href="#v2Main">Saltar al contenido</a>' +
      '<header class="v2-top" role="banner">' +
        '<div class="v2-top-in">' +
          '<a class="v2-logo" href="#" data-s="inicio" aria-label="Sublicuentas · Inicio"><img src="/assets/sublicuentas-logo-oscuro-ui.webp" alt="Sublicuentas" width="154" height="30"></a>' +
          '<label class="v2-buscar" id="v2BuscarBox">' + ico('buscar') + '<input id="v2Buscar" type="search" placeholder="Buscar cliente o teléfono" autocomplete="off" aria-label="Buscar cliente o teléfono"></label>' +
          '<div class="v2-top-der">' +
            '<button class="v2-ico-btn v2-solo-movil" id="v2BuscarMovil" type="button" aria-label="Buscar">' + ico('buscar') + '</button>' +
            '<button class="v2-ico-btn" id="v2Avisos" type="button" aria-label="Tickets y avisos">' + ico('campana') + '<span class="v2-punto" id="v2Punto"></span></button>' +
            '<div class="v2-user-box">' +
              '<button class="v2-user" id="v2User" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="v2PopUser"><img src="/assets/sublirobot-96.webp" alt=""><span class="v2-who"><b id="v2Nombre"></b><small id="v2Rol"></small></span>' + ico('flecha') + '</button>' +
              '<div class="v2-pop v2-pop-user" id="v2PopUser" role="menu" hidden>' +
                '<button type="button" role="menuitem" data-v2a="perfil">' + ico('perfil') + 'Mi perfil</button>' +
                '<button type="button" role="menuitem" data-v2a="anterior">' + ico('atras') + 'Diseño anterior</button>' +
                '<hr><button type="button" role="menuitem" data-v2a="salir" class="v2-peligro">' + ico('salir') + 'Cerrar sesión</button>' +
              '</div>' +
            '</div>' +
            '<button class="v2-ico-btn v2-solo-movil" id="v2Menu" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="v2Panel">' + ico('menu') + '</button>' +
          '</div>' +
        '</div>' +
      '</header>' +
      '<nav class="v2-nav" aria-label="Secciones"><div class="v2-nav-in" id="v2Fila"></div></nav>' +
      '<div class="v2-panel" id="v2Panel" hidden><div class="v2-panel-in" role="dialog" aria-label="Navegación"><div class="v2-panel-tit">Navegación</div>' +
        '<label class="v2-panel-buscar">' + ico('buscar') + '<input id="v2BuscarDrawer" type="search" placeholder="Buscar cliente o teléfono" autocomplete="off" aria-label="Buscar cliente o teléfono"></label>' +
        '<div id="v2PanelIn"></div></div></div>';
    document.body.insertBefore(shell, document.body.firstChild);
    filaEl = shell.querySelector('#v2Fila'); popUser = shell.querySelector('#v2PopUser'); panelMovil = shell.querySelector('#v2Panel'); puntoEl = shell.querySelector('#v2Punto');
    var wrap = document.querySelector('.wrap'); if (wrap) { wrap.id = wrap.id || 'v2Main'; wrap.setAttribute('tabindex', '-1'); wrap.setAttribute('role', 'main'); }

    shell.addEventListener('click', function (e) {
      var d = e.target.closest('[data-s]');
      if (d) { e.preventDefault(); return ir(d.getAttribute('data-s')); }
      var g = e.target.closest('[data-v2g]');
      if (g) { e.stopPropagation(); return alternarGrupo(g); }
      var a = e.target.closest('[data-v2a]');
      if (a) {
        var acc = a.getAttribute('data-v2a'); cerrarTodo();
        if (acc === 'perfil') ir('perfil');
        else if (acc === 'anterior') window.SublichatUI.usarAnterior();
        else if (acc === 'salir') { var lo = document.getElementById('logoutBtn'); if (lo) lo.click(); }
      }
    });
    shell.querySelector('#v2User').addEventListener('click', function (e) { e.stopPropagation(); var abierto = !popUser.hidden; cerrarTodo(); if (!abierto) abrirPop(popUser, this); });
    shell.querySelector('#v2Avisos').addEventListener('click', function () { if (puede('tickets')) ir('tickets'); });
    var abrirDrawer = function (foco) { var b = shell.querySelector('#v2Menu'); var ab = panelMovil.hidden; cerrarTodo(); if (!ab) return; panelMovil.hidden = false; b.setAttribute('aria-expanded', 'true'); document.documentElement.classList.add('v2-panel-abierto'); var f = foco ? shell.querySelector('#v2BuscarDrawer') : panelMovil.querySelector('.v2-tab'); if (f) try { f.focus({ preventScroll: true }); } catch (_) {} };
    shell.querySelector('#v2Menu').addEventListener('click', function (e) { e.stopPropagation(); abrirDrawer(false); });
    shell.querySelector('#v2BuscarMovil').addEventListener('click', function (e) { e.stopPropagation(); abrirDrawer(true); });
    panelMovil.addEventListener('click', function (e) { // secciones plegables del drawer (no cierran el drawer)
      if (e.target === panelMovil) { cerrarTodo(); return; }
      var m = e.target.closest('[data-v2m]'); if (!m) return; e.stopPropagation();
      var lista = document.getElementById(m.getAttribute('aria-controls')); var ab = m.getAttribute('aria-expanded') === 'true';
      m.setAttribute('aria-expanded', ab ? 'false' : 'true'); if (lista) lista.hidden = ab;
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('#v2Shell .v2-pop, #v2Shell .v2-panel')) cerrarTodo(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var origen = document.querySelector('#v2Shell [aria-expanded="true"]');
      cerrarTodo(); if (origen) origen.focus();
    });
    var t;
    var pasar = function (valor) {
      if (!puede('clientes')) return;
      if (actual() !== 'clientes') ir('clientes');
      var qi = document.getElementById('q'); if (!qi) return;
      qi.value = valor; qi.dispatchEvent(new Event('input', { bubbles: true }));
    };
    [shell.querySelector('#v2Buscar'), shell.querySelector('#v2BuscarDrawer')].forEach(function (buscar) {
      buscar.addEventListener('input', function () { if (buscar.id === 'v2BuscarDrawer') return; clearTimeout(t); t = setTimeout(function () { pasar(buscar.value); }, 250); });
      buscar.addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(t); pasar(buscar.value); } });
    });
    window.addEventListener('resize', function () { clearTimeout(t2); t2 = setTimeout(ajustarFila, 120); });
    var t2;
    construir(); usuario(); campana();
  }
  function abrirPop(pop, origen) {
    pop.hidden = false; origen.setAttribute('aria-expanded', 'true');
    if (pop.classList.contains('v2-pop-g')) { // debajo de su categoría, sin salirse de la pantalla
      var r = origen.getBoundingClientRect(), w = pop.offsetWidth || 360;
      pop.style.top = (r.bottom + 10) + 'px';
      pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 12)) + 'px';
    } var f = pop.querySelector('button,[data-s]'); if (f) try { f.focus({ preventScroll: true }); } catch (_) {} }
  function cerrarTodo() {
    if (!shell) return;
    shell.querySelectorAll('.v2-pop').forEach(function (p) { p.hidden = true; });
    shell.querySelectorAll('[aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    if (panelMovil) panelMovil.hidden = true;
    document.documentElement.classList.remove('v2-panel-abierto');
  }
  function alternarGrupo(btn) {
    var pop = document.getElementById(btn.getAttribute('aria-controls'));
    var abierto = pop && !pop.hidden; cerrarTodo();
    if (pop && !abierto) abrirPop(pop, btn);
  }

  // Grupos con solo los destinos que el usuario puede ver. Un grupo vacío no se muestra.
  function estructura() {
    var vis = pantallas(), set = {}; vis.forEach(function (s) { set[s] = 1; });
    var conocidos = {}; NAV.forEach(function (n) { if (n.s) conocidos[n.s] = 1; else n.items.forEach(function (s) { conocidos[s] = 1; }); }); conocidos.perfil = 1;
    var out = [];
    NAV.forEach(function (n) {
      if (n.s) { if (set[n.s]) out.push({ s: n.s }); return; }
      var items = n.items.filter(function (s) { return set[s]; });
      if (n.g === 'Más') vis.forEach(function (s) { if (!conocidos[s]) items.push(s); }); // destinos nuevos que aún no tienen grupo
      if (items.length) out.push({ g: n.g, items: items });
    });
    return out;
  }
  function nombreDe(s) { return NOMBRE[s] || ((rbac() && rbac().meta(s)[1]) || s); }
  var GRUPO_INFO = { 'Operación': ['op', 'Accesos agrupados por función'], 'Supervisión': ['permisos', 'Control, auditoría y permisos'], 'Más': ['puntos', 'Herramientas y extras'] };
  function itemMenu(s) { return '<button type="button" role="menuitem" class="v2-mi" data-s="' + esc(s) + '"><span class="v2-mi-ico">' + ico(s) + '</span><span class="v2-mi-t"><b>' + esc(nombreDe(s)) + '</b>' + (DESC[s] ? '<small>' + esc(DESC[s]) + '</small>' : '') + '</span>' + (s === 'tickets' ? '<i class="v2-cuenta" hidden></i>' : '') + '<svg class="v2-mi-flecha" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></button>'; }
  function chev() { return '<svg class="v2-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'; }
  function construir() {
    if (!filaEl) return;
    var est = estructura(), html = '', movil = '';
    est.forEach(function (n, i) {
      if (n.s) {
        html += '<button type="button" class="v2-tab" data-s="' + n.s + '">' + ico(n.s) + '<span>' + esc(nombreDe(n.s)) + '</span></button>';
        movil += '<button type="button" class="v2-tab" data-s="' + n.s + '">' + ico(n.s) + '<span>' + esc(nombreDe(n.s)) + '</span></button>';
      } else {
        var id = 'v2G' + i;
        var gi = GRUPO_INFO[n.g] || ['puntos', ''];
        html += '<div class="v2-grupo" data-grupo="' + esc(n.g) + '"><button type="button" class="v2-tab v2-tab-g" data-v2g="1" aria-haspopup="menu" aria-expanded="false" aria-controls="' + id + '">' + ico(gi[0]) + '<span>' + esc(n.g) + '</span>' + chev() + '</button>' +
          '<div class="v2-pop v2-pop-g" id="' + id + '" role="menu" aria-label="' + esc(n.g) + '" hidden><div class="v2-pop-h"><b>' + esc(n.g) + '</b><small>' + esc(gi[1]) + '</small></div>' + n.items.map(itemMenu).join('') + '</div></div>';
        movil += '<div class="v2-panel-g"><button type="button" class="v2-tab v2-tab-g" data-v2m="1" aria-expanded="false" aria-controls="' + id + 'm">' + ico(gi[0]) + '<span>' + esc(n.g) + '</span>' + chev() + '</button><div class="v2-panel-lista" id="' + id + 'm" hidden>' + n.items.map(itemMenu).join('') + '</div></div>';
      }
    });
    html += '<div class="v2-grupo v2-desborde" hidden><button type="button" class="v2-tab v2-tab-g" data-v2g="1" aria-haspopup="menu" aria-expanded="false" aria-controls="v2GDes">' + ico('puntos') + '<span>Más secciones</span>' + chev() + '</button><div class="v2-pop v2-pop-g v2-pop-der" id="v2GDes" role="menu" hidden></div></div>';
    filaEl.innerHTML = html;
    shell.querySelector('#v2PanelIn').innerHTML = movil + '<button type="button" class="v2-tab" data-s="perfil">' + ico('perfil') + '<span>Mi perfil</span></button>';
    shell.querySelector('#v2Avisos').hidden = !pantallas().includes('tickets');
    ajustarFila(); marcar(actual()); campana();
  }
  // Pantallas medianas: lo que no cabe pasa a "Secciones" con nombres completos (sin achicar la letra).
  function ajustarFila() {
    if (!filaEl) return;
    var des = filaEl.querySelector('.v2-desborde'), popDes = des && des.querySelector('.v2-pop');
    var hijos = [].slice.call(filaEl.children).filter(function (c) { return c !== des; });
    hijos.forEach(function (c) { c.hidden = false; });
    if (!des) return;
    des.hidden = true; popDes.innerHTML = '';
    if (filaEl.scrollWidth <= filaEl.clientWidth + 1) return;
    des.hidden = false;
    var movidos = [];
    for (var i = hijos.length - 1; i > 1 && filaEl.scrollWidth > filaEl.clientWidth + 1; i--) { hijos[i].hidden = true; movidos.unshift(hijos[i]); }
    popDes.innerHTML = movidos.map(function (c) {
      if (c.matches('.v2-tab')) return itemMenu(c.getAttribute('data-s'));
      return '<div class="v2-pop-sub"><small>' + esc(c.getAttribute('data-grupo')) + '</small>' + [].slice.call(c.querySelectorAll('[data-s]')).map(function (b) { return itemMenu(b.getAttribute('data-s')); }).join('') + '</div>';
    }).join('');
    marcar(actual());
  }
  function marcar(s) {
    if (!shell) return;
    shell.querySelectorAll('[data-s]').forEach(function (b) { var on = b.getAttribute('data-s') === s && !b.classList.contains('v2-logo'); b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    shell.querySelectorAll('.v2-grupo').forEach(function (g) { var t = g.querySelector('.v2-tab-g'); if (t) t.classList.toggle('v2-hijo', !!g.querySelector('[data-s="' + s + '"]')); });
    try { document.title = nombreDe(s) + ' · Sublichat'; } catch (_) {}
  }
  function usuario() {
    var r = rbac(); if (!r || !shell) return;
    var u = r.usuario() || ''; var nombre = r.esSupervisor() ? 'Sublicuentas' : (u === 'libni' ? 'Relojes' : u);
    shell.querySelector('#v2Nombre').textContent = nombre || 'Usuario';
    // R166 · El avatar de arriba es la MISMA foto de Perfil (mismo registro del usuario). Sin foto: Sublirobot.
    var img = shell.querySelector('#v2User img'), src = '';
    try { src = r.avatar ? r.avatar() : ''; } catch (_) {}
    if (img) { if (src && img.getAttribute('src') !== src) img.setAttribute('src', src); else if (!src) img.setAttribute('src', '/assets/sublirobot-96.webp'); img.alt = 'Foto de ' + (nombre || 'usuario'); }
    shell.querySelector('#v2Rol').textContent = r.esSupervisor() ? 'Supervisor' : r.rolEtiqueta();
  }
  function campana() {
    if (!shell) return;
    var b = document.querySelector('.nav-btn[data-screen="tickets"] .ticket-nav-notify');
    var n = b && b.style.display !== 'none' ? String(b.textContent || '').trim() : '';
    puntoEl.textContent = n; puntoEl.style.display = n ? 'grid' : 'none';
    shell.querySelectorAll('.v2-cuenta').forEach(function (c) { c.textContent = n; c.hidden = !n; });
  }

  // Perfil (guía p. 16): datos personales primero; la galería de temas sale de la vista principal y queda en
  // "Apariencia avanzada" (plegada). Solo se MUEVEN nodos: mismos IDs, mismos botones y el tema guardado no cambia.
  function ordenarPerfil() {
    var raiz = document.getElementById('rbac-perfil'); if (!raiz || raiz.dataset.v2Orden) return;
    var grid = document.getElementById('themeSwatchGrid'); if (!grid) return;
    var cardTema = grid.closest('.rbac-card'); var form = raiz.querySelector('.profile-form');
    var cardForm = form && form.closest('.rbac-card'); var resumen = raiz.querySelector('.profile-summary-grid');
    raiz.dataset.v2Orden = '1';
    if (cardForm && resumen) resumen.insertAdjacentElement('afterend', cardForm);
    if (cardTema) {
      var det = document.createElement('details'); det.className = 'rbac-card v2-apariencia';
      det.innerHTML = '<summary><b>Apariencia avanzada</b><small>Tema de color guardado en este navegador. El diseño nuevo usa la identidad Sublicuentas.</small></summary>';
      cardTema.parentNode.insertBefore(det, cardTema); det.appendChild(cardTema); cardTema.classList.add('v2-apariencia-in');
      raiz.appendChild(det);
    }
  }

  window.addEventListener('sublichat:nav', function () { construir(); usuario(); });
  window.addEventListener('sublichat:profile-changed', function () { setTimeout(usuario, 30); }); // guardar foto, cargar del servidor
  window.addEventListener('storage', function (e) { if (e.key && e.key.indexOf('sublichat_profile_') === 0) usuario(); }); // otra pestaña
  window.addEventListener('sublichat:screen', function (e) { if (((e.detail && e.detail.screen) || '') === 'perfil') setTimeout(ordenarPerfil, 60); });
  window.addEventListener('sublichat:screen', function (e) { marcar((e.detail && e.detail.screen) || actual()); });
  function iniciar() {
    montar();
    var wrap = document.querySelector('.wrap'); var pend = 0, ultima = '';
    var revisar = function () { if (pend) return; pend = 1; setTimeout(function () { pend = 0; var s = actual(); if (s !== ultima) { ultima = s; marcar(s); } campana(); }, 300); };
    if (wrap) new MutationObserver(revisar).observe(wrap, { childList: true, attributes: true, attributeFilter: ['class'], subtree: true });
    var nav = document.querySelector('.nav.focus-nav');
    if (nav) new MutationObserver(revisar).observe(nav, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style'] });
    var obsP = document.getElementById('screen-perfil'); if (obsP) new MutationObserver(function () { if (obsP.querySelector('#themeSwatchGrid')) ordenarPerfil(); }).observe(obsP, { childList: true, subtree: true });
    var tries = 0, iv = setInterval(function () { tries++; if (rbac()) { construir(); usuario(); } if (rbac() || tries > 60) clearInterval(iv); }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
