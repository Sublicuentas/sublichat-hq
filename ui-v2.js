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
