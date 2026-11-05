/* sala-juntas.js · R167 — SubliStudio 3D · Sala de Juntas (Fase 1).
   Pantallas: Panel principal · Crear/editar convocatoria (solo Naara) · Antesala virtual · Calendario · Mis reuniones ·
   Historial · Configuración. Datos reales de /api/sala-juntas (que repite TODA la autorización).
   Mi personaje (Fase 3) y la sala 3D con audio (Fase 4) se muestran como lo que son: todavía no habilitadas.
   Se carga en index.html pero solo dibuja cuando se abre la pantalla. No toca ningún otro módulo. */
(function () {
  'use strict';
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const COLOR = { naara: '#E2231A', libni: '#2879C7', geisell: '#159B62' };
  const st = { data: null, cargando: false, error: '', vista: 'inicio', editar: null, sel: null, ante: null, guardando: '', mic: { estado: 'sin_probar', nivel: 0 }, audio: 'sin_probar', cam: 'sin_probar', mesCal: null };
  let host = null, poll = null, micStream = null, micRaf = 0;

  const I = {
    sala: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    cal: '<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    calPlus: '<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18M12 14v4M10 16h4"/>',
    grupo: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    check: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>',
    reloj: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    persona: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    lista: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
    config: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
    auri: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
    cam: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>', salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    enviar: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
    guardar: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7"/>',
    campana: '<path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"/>',
    corona: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/>',
    atras: '<path d="m12 19-7-7 7-7M19 12H5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', puerta: '<path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9M10 12v.01M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/>',
  };
  const ico = (k, c = '') => `<svg class="sj-i ${c}" viewBox="0 0 24 24" aria-hidden="true">${I[k] || ''}</svg>`;

  async function api(body) {
    const r = await fetch('/api/sala-juntas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || 'No se pudo completar.');
    return j;
  }
  function toast(t, malo) {
    let el = document.getElementById('sjToast');
    if (!el) { el = document.createElement('div'); el.id = 'sjToast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.className = 'on' + (malo ? ' malo' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => { el.className = ''; }, 3200);
  }
  const fechaLarga = (r) => { if (!r || !r.inicioMs) return 'Sin fecha'; const d = new Date(r.inicioMs - 6 * 3600000); return `${DIAS[d.getUTCDay()].replace(/^./, (x) => x.toUpperCase())}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`; };
  const horaHN = (r) => { if (!r || !r.hora) return ''; const [h, m] = r.hora.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`; };
  const diaCorto = (r) => { const d = new Date(r.inicioMs - 6 * 3600000); return `${String(d.getUTCDate()).padStart(2, '0')} ${MESES[d.getUTCMonth()].slice(0, 3).replace(/^./, (x) => x.toUpperCase())}.`; };
  const ESTADO = { borrador: ['Borrador', 'gris'], programada: ['Confirmada', 'verde'], en_curso: ['En curso', 'rojo'], finalizada: ['Finalizada', 'gris'], cancelada: ['Cancelada', 'gris'] };
  const pill = (e) => { const x = ESTADO[e] || [e, 'gris']; return `<span class="sj-pill sj-${x[1]}">${esc(x[0])}</span>`; };
  const RSVP = { aceptada: ['Confirmó', 'verde'], rechazada: ['No asistirá', 'rojo'], pendiente: ['Pendiente', 'ambar'] };
  const funda = (id) => (st.data?.fundadoras || []).find((f) => f.id === id) || { id, nombre: id };
  function cara(id, tam = 40) {
    const f = funda(id); let src = '';
    if (st.data && id === st.data.yo.id) { try { src = window.SublichatRBAC?.avatar?.() || ''; } catch (_) {} }
    const ini = String(f.nombre || '?').slice(0, 1).toUpperCase();
    return src ? `<img class="sj-cara" style="width:${tam}px;height:${tam}px" src="${esc(src)}" alt="">`
      : `<span class="sj-cara sj-ini" style="width:${tam}px;height:${tam}px;background:${COLOR[id] || '#58616D'}">${esc(ini)}</span>`;
  }

  // ---------- carga ----------
  async function cargar(silencioso) {
    if (st.cargando) return; st.cargando = true; if (!silencioso) { st.error = ''; pintar(); }
    try { st.data = await api({ accion: 'panel' }); st.error = ''; }
    catch (e) { st.error = e.message; }
    st.cargando = false; pintar();
  }
  function open() {
    host = document.getElementById('rbac-sala-juntas'); if (!host) return;
    estilos();
    const sec = document.getElementById('screen-sala-juntas'); if (sec) sec.classList.add('sj-pantalla');
    st.vista = 'inicio'; st.editar = null; cargar();
    clearInterval(poll); poll = setInterval(() => { const a = document.getElementById('screen-sala-juntas'); if (!a || !a.classList.contains('active')) { clearInterval(poll); detenerMic(); return; } if (!st.guardando && st.vista !== 'form') cargar(true); }, 30000);
  }

  // ---------- pintar ----------
  function pintar() {
    if (!host) return;
    if (!st.data) { host.innerHTML = cab() + (st.error ? `<div class="sj-card sj-vacio"><b>No se pudo abrir la Sala de Juntas.</b><p>${esc(st.error)}</p><button class="sj-btn sj-sec" data-sj="recargar">Reintentar</button></div>` : `<div class="sj-card sj-vacio sj-cargando">Cargando Sala de Juntas…</div>`); return; }
    let cuerpo = '';
    if (st.vista === 'form') cuerpo = formulario();
    else if (st.vista === 'antesala') cuerpo = antesala();
    else if (st.vista === 'calendario') cuerpo = volver('Calendario de reuniones') + calendario();
    else if (st.vista === 'mis') cuerpo = volver('Mis reuniones') + listaReuniones((r) => ['programada', 'en_curso'].includes(r.estado), 'No tiene reuniones próximas.');
    else if (st.vista === 'historial') cuerpo = volver('Historial y acuerdos') + listaReuniones((r) => ['finalizada', 'cancelada'].includes(r.estado), 'Todavía no hay reuniones terminadas.') + `<div class="sj-card sj-nota">${ico('doc')}<div><b>Actas y acuerdos</b><p>El registro de actas y acuerdos con responsables se agrega en la Fase 5. Por ahora el historial muestra las reuniones realizadas y canceladas.</p></div></div>`;
    else if (st.vista === 'config') cuerpo = volver('Configuración de la sala') + configuracion();
    else if (st.vista === 'personaje') cuerpo = volver('Mi personaje (Avatar)') + personaje();
    else cuerpo = inicio();
    host.innerHTML = cab() + (st.error ? `<div class="sj-alerta">${esc(st.error)}</div>` : '') + cuerpo;
    if (st.vista === 'antesala') pintarMedidor();
  }
  function cab() {
    return `<div class="sj-cab"><span class="sj-cab-ico">${ico('sala')}</span><div><h2>Sala de Juntas</h2><p>SubliStudio 3D · Reuniones, convocatorias y acuerdos del equipo</p></div></div>`;
  }
  function volver(t) { return `<div class="sj-volver"><button class="sj-btn sj-sec sj-mini" data-sj="inicio">${ico('atras')} Volver</button><h3>${esc(t)}</h3></div>`; }

  function inicio() {
    const d = st.data, k = d.kpis, p = d.proxima, puedeCrear = d.permisos.crear;
    const kpis = [
      ['cal', 'verde', 'Reuniones<br>de este mes', k.reunionesMes],
      ['grupo', 'ambar', 'Convocatorias<br>activas', k.convocatoriasActivas],
      ['check', 'rojo', 'Acuerdos<br>pendientes', k.acuerdosPendientes],
      ['reloj', 'azul', 'Próxima<br>reunión', p ? `<span class="sj-k-fecha">${esc(diaCorto(p))}</span><small>${esc(horaHN(p))}</small>` : '<span class="sj-k-fecha">—</span>'],
    ].map(([i, c, t, v]) => `<div class="sj-card sj-kpi"><span class="sj-k-ico sj-${c}">${ico(i)}</span><div><small>${t}</small><b>${v}</b></div></div>`).join('');
    const mia = p ? (p.invitaciones || {})[d.yo.id] : null;
    const prox = p ? `<div class="sj-card sj-prox">
        <div class="sj-prox-t"><div class="sj-prox-h">${ico('cal')}<b>Próxima reunión</b>${pill(p.estado)}</div>
          <h4>${esc(p.titulo)}</h4>
          <div class="sj-meta"><span>${ico('cal')}${esc(fechaLarga(p))}</span><span>${ico('reloj')}${esc(horaHN(p))} (Honduras)</span><span>${ico('grupo')}Socias fundadoras (${p.participantes.length})</span></div>
          ${mia && mia.estado === 'pendiente' && p.estado === 'programada' ? `<div class="sj-rsvp-mini">¿Asistirá? <button class="sj-btn sj-ok sj-mini" data-sj="rsvp" data-id="${p.id}" data-r="aceptada">Confirmar</button><button class="sj-btn sj-sec sj-mini" data-sj="rsvp" data-id="${p.id}" data-r="rechazada">No asistiré</button></div>` : ''}
        </div>
        <img class="sj-prox-img" src="/assets/sala/sala-escenario-c.webp" alt="Sala de Juntas · Escenario C" loading="lazy">
        <div class="sj-prox-acc"><button class="sj-btn sj-rojo" data-sj="antesala" data-id="${p.id}">${ico('sala')}Entrar a la reunión</button><button class="sj-btn sj-sec" data-sj="detalle" data-id="${p.id}">${ico('doc')}Ver detalles</button></div>
      </div>` : `<div class="sj-card sj-prox sj-prox-vacia"><div class="sj-prox-t"><div class="sj-prox-h">${ico('cal')}<b>Próxima reunión</b></div><p>No hay reuniones programadas.${puedeCrear ? ' Cree la primera convocatoria.' : ' Cuando Naara convoque, aparecerá aquí y le llegará por Telegram.'}</p></div>${puedeCrear ? `<div class="sj-prox-acc"><button class="sj-btn sj-rojo" data-sj="nueva">${ico('calPlus')}Crear convocatoria</button></div>` : ''}</div>`;
    const acc = [
      puedeCrear ? ['nueva', 'calPlus', 'Crear<br>convocatoria', true] : null,
      ['calendario', 'cal', 'Calendario<br>de reuniones'], ['mis', 'grupo', 'Mis reuniones<br><small>(agenda)</small>'], ['personaje', 'persona', 'Mi personaje<br><small>(Avatar)</small>'],
      ['historial', 'lista', 'Historial y<br>acuerdos'], puedeCrear ? ['config', 'config', 'Configuración<br>de la sala'] : null,
    ].filter(Boolean).map(([v, i, t, rojo]) => `<button class="sj-acc${rojo ? ' sj-acc-rojo' : ''}" data-sj="${v}">${ico(i)}<span>${t}</span></button>`).join('');
    const borradores = puedeCrear ? d.reuniones.filter((r) => r.estado === 'borrador') : [];
    return `<div class="sj-top"><div class="sj-hero"><img src="/assets/sala/sala-hero.webp" alt="SubliStudio 3D · Nuestra sala virtual de fundadores"></div>
        <div class="sj-der"><div class="sj-kpis">${kpis}</div>${prox}</div></div>
      <div class="sj-accs sj-n${puedeCrear ? 6 : 4}">${acc}</div>
      ${borradores.length ? `<div class="sj-card sj-borr"><b>Borradores</b>${borradores.map((r) => `<button class="sj-fila" data-sj="editar" data-id="${r.id}"><span>${esc(r.titulo || 'Sin título')}</span><small>${r.inicioMs ? esc(fechaLarga(r)) : 'Sin fecha'}</small>${pill('borrador')}</button>`).join('')}</div>` : ''}
      <div class="sj-dos">${puedeCrear ? formulario(true) : misInvitaciones()}${p ? antesala(true) : `<div class="sj-card sj-vacio">${ico('puerta')}<b>Antesala virtual</b><p>Se activa cuando haya una reunión programada.</p></div>`}</div>`;
  }

  function misInvitaciones() {
    const lista = st.data.reuniones.filter((r) => ['programada', 'en_curso'].includes(r.estado));
    return `<div class="sj-card sj-pn"><div class="sj-ph">${ico('campana')}<b>Mis invitaciones</b></div>${lista.length ? lista.map(filaReunion).join('') : '<p class="sj-p">No tiene invitaciones pendientes.</p>'}</div>`;
  }
  function filaReunion(r) {
    const mia = (r.invitaciones || {})[st.data.yo.id] || { estado: 'pendiente' }, x = RSVP[mia.estado] || RSVP.pendiente;
    const puedeResp = r.estado === 'programada' && st.data.yo.id !== 'naara';
    return `<div class="sj-reu"><div class="sj-reu-f"><b>${esc(diaCorto(r))}</b><small>${esc(horaHN(r))}</small></div>
      <div class="sj-reu-t"><b>${esc(r.titulo)}</b><small>${esc(fechaLarga(r))} · ${r.participantes.map((u) => esc(funda(u).nombre)).join(', ')}</small>
        <div class="sj-chips">${r.participantes.map((u) => { const e = (r.invitaciones || {})[u]?.estado || 'pendiente'; const y = RSVP[e]; return `<span class="sj-chip sj-${y[1]}">${esc(funda(u).nombre)}: ${y[0]}</span>`; }).join('')}</div></div>
      <div class="sj-reu-a">${pill(r.estado)}${puedeResp ? `<span class="sj-pill sj-${x[1]}">Usted: ${x[0]}</span><div class="sj-fila-btn"><button class="sj-btn sj-ok sj-mini" data-sj="rsvp" data-id="${r.id}" data-r="aceptada"${mia.estado === 'aceptada' ? ' disabled' : ''}>Confirmar</button><button class="sj-btn sj-sec sj-mini" data-sj="rsvp" data-id="${r.id}" data-r="rechazada"${mia.estado === 'rechazada' ? ' disabled' : ''}>No asistiré</button></div>` : ''}
        ${['programada', 'en_curso'].includes(r.estado) ? `<button class="sj-btn sj-rojo sj-mini" data-sj="antesala" data-id="${r.id}">Antesala</button>` : ''}
        ${st.data.permisos.crear && ['programada', 'borrador'].includes(r.estado) ? `<button class="sj-btn sj-sec sj-mini" data-sj="editar" data-id="${r.id}">Editar</button>` : ''}</div></div>`;
  }
  function listaReuniones(filtro, vacio) {
    const l = st.data.reuniones.filter(filtro);
    return `<div class="sj-card sj-pn">${l.length ? l.map(filaReunion).join('') : `<p class="sj-p">${esc(vacio)}</p>`}</div>`;
  }

  // ---------- formulario ----------
  function formulario(embebido) {
    const r = st.editar || { titulo: '', fecha: '', hora: '', agenda: [], participantes: ['naara', 'libni', 'geisell'], recordatorios: { h24: true, h1: true, m10: true }, duracionMin: 60 };
    const ed = !!r.id;
    const parts = st.data.fundadoras.map((f) => `<label class="sj-part"><input type="checkbox" name="sjPart" value="${f.id}" ${r.participantes.includes(f.id) ? 'checked' : ''} ${f.anfitriona ? 'disabled' : ''}>${cara(f.id, 34)}<span><b>${esc(f.nombre)} ${f.anfitriona ? ico('corona', 'sj-corona') : ''}</b><small>${esc(f.anfitriona ? 'Super Admin' : 'Fundadora')}</small></span></label>`).join('');
    const rec = [['h24', '24 horas antes'], ['h1', '1 hora antes'], ['m10', '10 minutos antes']].map(([k, t]) => `<label class="sj-rec">${ico('campana')}<span>${t}</span><input type="checkbox" role="switch" class="sj-sw" name="sjRec" value="${k}" ${r.recordatorios[k] !== false ? 'checked' : ''}></label>`).join('');
    return `<form class="sj-card sj-pn sj-form" id="sjForm" novalidate>
      <div class="sj-ph">${ico('calPlus')}<b>${ed ? 'Editar convocatoria' : 'Crear nueva convocatoria'}</b>${ed ? pill(r.estado) : ''}</div>
      <div class="sj-form-g">
        <img class="sj-form-img" src="/assets/sala/sala-escenario-c.webp" alt="" loading="lazy">
        <div class="sj-form-c">
          <label class="sj-f"><span>Título de la reunión *</span><input name="titulo" maxlength="120" required value="${esc(r.titulo)}" placeholder="Ej.: Revisión mensual y próximos objetivos"></label>
          <div class="sj-f2"><label class="sj-f"><span>Fecha *</span><input type="date" name="fecha" value="${esc(r.fecha)}" required></label>
            <label class="sj-f"><span>Hora (Honduras) *</span><input type="time" name="hora" value="${esc(r.hora)}" step="300" required></label></div>
          <label class="sj-f"><span>Duración</span><select name="duracionMin">${[30, 45, 60, 90, 120].map((m) => `<option value="${m}"${Number(r.duracionMin) === m ? ' selected' : ''}>${m < 60 ? m + ' minutos' : (m / 60) + (m === 60 ? ' hora' : ' horas')}</option>`).join('')}</select></label>
          <label class="sj-f"><span>Agenda / Temas a tratar * <small>(un tema por línea)</small></span><textarea name="agenda" rows="4" placeholder="Resultados de ventas del mes&#10;Campañas y promociones&#10;Objetivos y responsables">${esc((r.agenda || []).join('\n'))}</textarea></label>
        </div>
        <div class="sj-form-d"><b class="sj-sub">Participantes (Socias fundadoras)</b>${parts}
          <b class="sj-sub">Recordatorios automáticos (Telegram)</b>${rec}
          <p class="sj-hint">Hora de Honduras (UTC-6). Los avisos de Telegram se activan en la Fase 2; la convocatoria ya queda guardada.</p></div>
      </div>
      <div class="sj-form-acc">
        <button type="button" class="sj-btn sj-sec" data-sj="${embebido ? 'limpiar' : 'inicio'}">Cancelar</button>
        <button type="button" class="sj-btn sj-sec" data-sj="borrador">${ico('guardar')}Guardar borrador</button>
        ${ed && r.estado !== 'borrador' ? `<button type="button" class="sj-btn sj-peligro" data-sj="cancelarReu" data-id="${r.id}">Cancelar reunión</button>` : ''}
        <button type="submit" class="sj-btn sj-rojo sj-grande">${ico('enviar')}${ed && r.estado !== 'borrador' ? 'Guardar y reprogramar' : 'Programar y enviar convocatoria'}</button>
      </div></form>`;
  }
  function leerForm() {
    const f = document.getElementById('sjForm'); const q = (n) => f.querySelector(`[name="${n}"]`);
    const rec = {}; f.querySelectorAll('[name="sjRec"]').forEach((x) => { rec[x.value] = x.checked; });
    return { titulo: q('titulo').value, fecha: q('fecha').value, hora: q('hora').value, duracionMin: Number(q('duracionMin').value), agenda: q('agenda').value,
      participantes: ['naara', ...[...f.querySelectorAll('[name="sjPart"]:checked')].map((x) => x.value)], recordatorios: rec };
  }
  async function guardar(borrador) {
    if (st.guardando) return; // evita doble clic
    const datos = leerForm(); const ed = st.editar && st.editar.id;
    st.guardando = 'form'; marcarOcupado(true);
    try {
      const r = await api({ ...datos, accion: ed ? 'editar' : 'crear', id: ed || undefined, borrador });
      toast(borrador ? 'Borrador guardado.' : (ed ? 'Reunión reprogramada. Las invitadas deben confirmar de nuevo si cambió la hora.' : 'Convocatoria programada. Quedó lista para enviarse por Telegram.'));
      st.editar = null; st.vista = 'inicio'; st.guardando = ''; await cargar(true);
      return r;
    } catch (e) { st.guardando = ''; marcarOcupado(false); toast(e.message, true); }
  }
  function marcarOcupado(on) { host.querySelectorAll('.sj-form-acc .sj-btn').forEach((b) => { b.disabled = on; }); const s = host.querySelector('.sj-form-acc .sj-grande'); if (s) s.classList.toggle('sj-cargando-btn', on); }

  // ---------- antesala ----------
  function antesala(embebido) {
    const r = embebido ? st.data.proxima : st.ante; if (!r) return '';
    const yo = st.data.yo, mia = (r.invitaciones || {})[yo.id] || {}, tr = st.data.tiempoReal;
    const est = (e) => ({ activo: ['Activo', 'verde'], denegado: ['Bloqueado', 'rojo'], no_disponible: ['No disponible', 'gris'], sin_probar: ['Sin probar', 'gris'], probando: ['Probando…', 'ambar'] }[e] || ['—', 'gris']);
    const dispo = [['mic', 'Micrófono', st.mic.estado], ['auri', 'Audio', st.audio], ['cam', 'Cámara', st.cam]].map(([i, t, e]) => { const x = est(e); return `<div class="sj-disp">${ico(i)}<b>${t}</b><span class="sj-dot sj-${x[1]}">${x[0]}</span></div>`; }).join('');
    const todoOk = st.mic.estado === 'activo' && st.audio === 'activo';
    const puedeEntrar = r.salaAbierta && tr;
    const motivo = !r.salaAbierta ? (yo.id === 'naara' ? 'Abra la sala para que las demás puedan entrar.' : 'Esperando que la anfitriona abra la sala.') : !tr ? 'La sala 3D con audio en tiempo real se habilita en la Fase 4.' : '';
    let avatar = ''; try { avatar = window.SublichatRBAC?.avatar?.() || ''; } catch (_) {}
    return `<div class="sj-card sj-pn sj-ante">
      <div class="sj-ph">${ico('grupo')}<b>Antesala virtual</b>${embebido ? '' : `<button class="sj-btn sj-sec sj-mini sj-der-btn" data-sj="inicio">${ico('atras')}Volver</button>`}</div>
      <div class="sj-ante-g">
        <div class="sj-ante-av">${avatar ? `<img src="${esc(avatar)}" alt="Su foto de perfil">` : ''}<span>Su personaje 3D se crea en <b>Mi personaje</b> (Fase 3). Mientras tanto se usa su foto de Perfil.</span></div>
        <div class="sj-ante-c"><b class="sj-ante-tit">Reunión: ${esc(r.titulo)}</b>
          <div class="sj-meta sj-meta-col"><span>${ico('cal')}${esc(fechaLarga(r))}</span><span>${ico('reloj')}${esc(horaHN(r))} (Honduras)</span><span>${ico('grupo')}Socias fundadoras (${r.participantes.length})</span></div>
          <div class="sj-listo ${todoOk ? 'sj-listo-ok' : ''}"><b>${todoOk ? ico('check') + 'Todo listo para ingresar' : 'Revise su micrófono y audio'}</b><div class="sj-disps">${dispo}</div>
            ${st.mic.estado === 'activo' ? '<div class="sj-nivel" aria-label="Nivel del micrófono"><i id="sjNivel"></i></div>' : ''}
            ${st.mic.estado === 'denegado' ? '<p class="sj-hint">El navegador bloqueó el micrófono. Toque el candado junto a la dirección, permita "Micrófono" y vuelva a probar. Puede entrar como oyente.</p>' : ''}
            <button class="sj-btn sj-sec sj-mini" data-sj="probar">${ico('play')}Probar audio y micrófono</button></div>
        </div>
        <div class="sj-ante-p"><b class="sj-sub">Participantes (${r.participantes.length})</b>${r.participantes.map((u) => { const e = (r.invitaciones || {})[u]?.estado || 'pendiente', x = RSVP[e]; return `<div class="sj-pp">${cara(u, 36)}<span><b>${esc(funda(u).nombre)}${u === yo.id ? ' (Tú)' : ''}</b><small class="sj-dot sj-${x[1]}">${x[0]}</small></span>${u === 'naara' ? ico('corona', 'sj-corona') : ''}</div>`; }).join('')}
          ${mia.estado === 'pendiente' && yo.id !== 'naara' ? `<div class="sj-fila-btn"><button class="sj-btn sj-ok sj-mini" data-sj="rsvp" data-id="${r.id}" data-r="aceptada">Confirmar</button><button class="sj-btn sj-sec sj-mini" data-sj="rsvp" data-id="${r.id}" data-r="rechazada">No asistiré</button></div>` : ''}
        </div>
      </div>
      <div class="sj-ante-acc">
        <button class="sj-btn sj-rojo sj-grande" data-sj="entrar" data-id="${r.id}" ${puedeEntrar ? '' : 'disabled'}>${ico('sala')}Entrar a la Sala de Juntas 3D</button>
        ${st.data.permisos.moderar ? `<button class="sj-btn ${r.salaAbierta ? 'sj-sec' : 'sj-ok'}" data-sj="${r.salaAbierta ? 'cerrar' : 'abrir'}" data-id="${r.id}">${r.salaAbierta ? 'Cerrar sala' : 'Abrir sala'}</button>` : ''}
        <button class="sj-btn sj-sec" data-sj="salirAnte">${ico('salir')}Salir</button>
      </div>${motivo ? `<p class="sj-hint sj-motivo">${esc(motivo)}</p>` : ''}</div>`;
  }
  async function probarDispositivos() {
    detenerMic(); st.mic.estado = 'probando'; st.audio = 'probando'; pintar();
    // 1) micrófono real
    if (!navigator.mediaDevices?.getUserMedia) st.mic.estado = 'no_disponible';
    else {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        st.mic.estado = 'activo';
        const Ctx = window.AudioContext || window.webkitAudioContext; const ctx = new Ctx(); const an = ctx.createAnalyser(); an.fftSize = 512;
        ctx.createMediaStreamSource(micStream).connect(an); const buf = new Uint8Array(an.fftSize); st.mic.ctx = ctx;
        const loop = () => { an.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128)); st.mic.nivel = Math.min(1, m / 60); const el = document.getElementById('sjNivel'); if (el) el.style.width = Math.round(st.mic.nivel * 100) + '%'; micRaf = requestAnimationFrame(loop); };
        loop();
      } catch (e) { st.mic.estado = (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) ? 'denegado' : 'no_disponible'; }
    }
    // 2) salida de audio: tono corto
    try { const Ctx = window.AudioContext || window.webkitAudioContext; const c = new Ctx(); const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 660; g.gain.value = 0.06; o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.35); st.audio = 'activo'; setTimeout(() => c.close().catch(() => {}), 600); } catch (_) { st.audio = 'no_disponible'; }
    // 3) cámara: solo se revisa si existe (no se enciende)
    try { const ds = await navigator.mediaDevices.enumerateDevices(); st.cam = ds.some((d) => d.kind === 'videoinput') ? 'activo' : 'no_disponible'; } catch (_) { st.cam = 'no_disponible'; }
    pintar();
  }
  function pintarMedidor() { const el = document.getElementById('sjNivel'); if (el) el.style.width = Math.round(st.mic.nivel * 100) + '%'; }
  function detenerMic() { cancelAnimationFrame(micRaf); if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; } if (st.mic.ctx) { st.mic.ctx.close().catch(() => {}); st.mic.ctx = null; } }

  // ---------- otras vistas ----------
  function calendario() {
    const ahoraHN = new Date((st.data.ahora || Date.now()) - 6 * 3600000);
    if (!st.mesCal) st.mesCal = { y: ahoraHN.getUTCFullYear(), m: ahoraHN.getUTCMonth() };
    const { y, m } = st.mesCal, primero = new Date(Date.UTC(y, m, 1)).getUTCDay(), dias = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const porDia = {}; st.data.reuniones.filter((r) => r.inicioMs && r.estado !== 'borrador').forEach((r) => { const d = new Date(r.inicioMs - 6 * 3600000); if (d.getUTCFullYear() === y && d.getUTCMonth() === m) (porDia[d.getUTCDate()] = porDia[d.getUTCDate()] || []).push(r); });
    let celdas = ''; for (let i = 0; i < primero; i++) celdas += '<div class="sj-dia sj-vacio-d"></div>';
    for (let d = 1; d <= dias; d++) { const hoy = y === ahoraHN.getUTCFullYear() && m === ahoraHN.getUTCMonth() && d === ahoraHN.getUTCDate(); celdas += `<div class="sj-dia${hoy ? ' sj-hoy' : ''}"><span>${d}</span>${(porDia[d] || []).map((r) => `<button class="sj-ev sj-ev-${r.estado}" data-sj="detalle" data-id="${r.id}">${esc(horaHN(r))} · ${esc(r.titulo)}</button>`).join('')}</div>`; }
    return `<div class="sj-card sj-pn"><div class="sj-cal-h"><button class="sj-btn sj-sec sj-mini" data-sj="mesAnt" aria-label="Mes anterior">‹</button><b>${MESES[m].replace(/^./, (x) => x.toUpperCase())} ${y}</b><button class="sj-btn sj-sec sj-mini" data-sj="mesSig" aria-label="Mes siguiente">›</button></div>
      <div class="sj-cal">${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((x) => `<div class="sj-dsem">${x}</div>`).join('')}${celdas}</div></div>`;
  }
  function configuracion() {
    const d = st.data;
    return `<div class="sj-dos"><div class="sj-card sj-pn"><div class="sj-ph">${ico('grupo')}<b>Acceso</b></div><p class="sj-p">Solo las tres socias fundadoras entran a la Sala. Nadie más puede abrirla aunque tenga rol de administrador o un enlace reenviado.</p>
        ${d.fundadoras.map((f) => `<div class="sj-pp">${cara(f.id, 36)}<span><b>${esc(f.nombre)}</b><small>${esc(f.cargo)} · asiento ${esc(f.asiento)}</small></span>${f.anfitriona ? ico('corona', 'sj-corona') : ''}</div>`).join('')}</div>
      <div class="sj-card sj-pn"><div class="sj-ph">${ico('config')}<b>Estado de la sala</b></div>
        <div class="sj-estado"><span>Escenario</span><b>C · Cálida Ejecutiva</b></div>
        <div class="sj-estado"><span>Zona horaria</span><b>Honduras (UTC-6)</b></div>
        <div class="sj-estado"><span>Recordatorios Telegram</span><b class="sj-ambar-t">Fase 2</b></div>
        <div class="sj-estado"><span>Personajes 3D (VRoid)</span><b class="sj-ambar-t">Fase 3</b></div>
        <div class="sj-estado"><span>Audio en tiempo real (LiveKit)</span><b class="${d.tiempoReal ? 'sj-verde-t' : 'sj-ambar-t'}">${d.tiempoReal ? 'Configurado' : 'Fase 4 · falta configurar'}</b></div></div></div>`;
  }
  function personaje() {
    let avatar = ''; try { avatar = window.SublichatRBAC?.avatar?.() || ''; } catch (_) {}
    return `<div class="sj-card sj-pn sj-pers">${avatar ? `<img src="${esc(avatar)}" alt="">` : ''}<div><b>Mi personaje 3D llega en la Fase 3</b>
      <p class="sj-p">Cada fundadora tendrá un personaje 3D (hecho en VRoid Studio) que podrá ajustar: tono de piel, cabello y color, ropa y accesorios, con vista previa en la sala. Se guardará en su cuenta, así lo verá igual en cualquier navegador.</p>
      <p class="sj-p">Por ahora la antesala usa su foto de Perfil.</p></div></div>`;
  }

  // ---------- eventos ----------
  document.addEventListener('click', async (e) => {
    if (!host || !host.contains(e.target)) return;
    const b = e.target.closest('[data-sj]'); if (!b || b.disabled) return;
    const a = b.dataset.sj, id = b.dataset.id;
    const reu = () => st.data.reuniones.find((r) => r.id === id) || (st.data.proxima && st.data.proxima.id === id ? st.data.proxima : null);
    if (a === 'recargar') return cargar();
    if (a === 'inicio' || a === 'salirAnte') { detenerMic(); st.vista = 'inicio'; st.editar = null; return pintar(); }
    if (['calendario', 'mis', 'historial', 'config', 'personaje'].includes(a)) { st.vista = a; pintar(); return window.scrollTo({ top: 0 }); }
    if (a === 'nueva') { st.editar = null; st.vista = 'form'; pintar(); return window.scrollTo({ top: 0 }); }
    if (a === 'limpiar') { st.editar = null; return pintar(); }
    if (a === 'editar') { st.editar = { ...reu() }; st.vista = 'form'; pintar(); return window.scrollTo({ top: 0 }); }
    if (a === 'borrador') return guardar(true);
    if (a === 'mesAnt' || a === 'mesSig') { const d = new Date(Date.UTC(st.mesCal.y, st.mesCal.m + (a === 'mesSig' ? 1 : -1), 1)); st.mesCal = { y: d.getUTCFullYear(), m: d.getUTCMonth() }; return pintar(); }
    if (a === 'detalle' || a === 'antesala') {
      const r = reu(); if (!r) return;
      if (['cancelada', 'finalizada', 'borrador'].includes(r.estado)) { if (st.data.permisos.crear && r.estado === 'borrador') { st.editar = { ...r }; st.vista = 'form'; } else { toast(r.estado === 'cancelada' ? 'Esa reunión fue cancelada.' : 'Esa reunión ya terminó.'); return; } return pintar(); }
      st.guardando = 'ante';
      try { const j = await api({ accion: 'antesala', id }); st.ante = j.reunion; st.data.tiempoReal = j.tiempoReal; st.vista = 'antesala'; pintar(); window.scrollTo({ top: 0 }); } catch (err) { toast(err.message, true); }
      st.guardando = ''; return;
    }
    if (a === 'probar') return probarDispositivos();
    if (a === 'rsvp' || a === 'abrir' || a === 'cerrar' || a === 'cancelarReu') {
      if (st.guardando) return;
      if (a === 'cancelarReu' && !confirm('¿Cancelar esta reunión? Se avisará a las invitadas y se anularán los recordatorios.')) return;
      st.guardando = a; b.disabled = true;
      try {
        if (a === 'rsvp') { await api({ accion: 'rsvp', id, respuesta: b.dataset.r }); toast(b.dataset.r === 'aceptada' ? 'Asistencia confirmada.' : 'Se registró que no asistirá.'); }
        else if (a === 'cancelarReu') { await api({ accion: 'cancelar', id }); toast('Reunión cancelada.'); st.vista = 'inicio'; st.editar = null; }
        else { await api({ accion: a === 'abrir' ? 'abrir_sala' : 'cerrar_sala', id }); toast(a === 'abrir' ? 'Sala abierta.' : 'Sala cerrada.'); }
        st.guardando = ''; await cargar(true);
        if (st.vista === 'antesala' && st.ante) { try { const j = await api({ accion: 'antesala', id: st.ante.id }); st.ante = j.reunion; pintar(); } catch (_) { st.vista = 'inicio'; pintar(); } }
      } catch (err) { st.guardando = ''; b.disabled = false; toast(err.message, true); }
      return;
    }
    if (a === 'entrar') toast('La sala 3D con audio en tiempo real se habilita en la Fase 4.');
  });
  document.addEventListener('submit', (e) => { if (e.target && e.target.id === 'sjForm') { e.preventDefault(); guardar(false); } });

  function estilos() {
    if (document.getElementById('sjCss')) return;
    const s = document.createElement('style'); s.id = 'sjCss';
    s.textContent = `
#rbac-sala-juntas{--r:#E2231A;--ra:#B91C1C;--g:#141920;--t:#20242B;--m:#6B7380;--b:#E2E7EF;--f:#F4F6F9;--h:#FFF0EF;font-family:Inter,system-ui,sans-serif;color:var(--t);display:flex;flex-direction:column;gap:16px}
html body #screen-sala-juntas.sj-pantalla.sj-pantalla>.card>h2,html body #screen-sala-juntas.sj-pantalla.sj-pantalla>.card>.count,html.ui-v2:not(#a):not(#b):not(#c):not(#d):not(#e):not(#f) body #screen-sala-juntas>.card>h2{display:none!important}
#rbac-sala-juntas *{box-sizing:border-box}
#rbac-sala-juntas .sj-i{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;flex:none}
#rbac-sala-juntas .sj-card{background:#fff!important;border:1px solid var(--b)!important;border-radius:16px!important;box-shadow:0 6px 24px rgba(20,25,32,.05)!important;min-width:0}
.sj-cab{display:flex;align-items:center;gap:14px}.sj-cab h2{margin:0!important;font-size:26px!important;font-weight:800!important;letter-spacing:-.02em;color:var(--t)!important}.sj-cab p{margin:2px 0 0;color:var(--m);font-size:13.5px}
.sj-cab-ico{width:48px;height:48px;border-radius:12px;background:var(--r);color:#fff;display:grid;place-items:center;box-shadow:0 6px 16px rgba(226,35,26,.3)}.sj-cab-ico .sj-i{width:26px;height:26px}
.sj-top{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:16px}
.sj-hero{border-radius:16px;overflow:hidden;background:#1b1b1f;min-height:220px;box-shadow:0 8px 28px rgba(20,25,32,.12)}.sj-hero{display:flex;align-items:center}.sj-hero img{width:100%;height:100%;object-fit:contain;display:block}
.sj-der{display:flex;flex-direction:column;gap:12px;min-width:0}
.sj-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.sj-kpi{display:flex;gap:10px;align-items:flex-start;padding:14px}.sj-kpi small{display:block;font-size:12px;color:var(--m);line-height:1.25}.sj-kpi b{display:block;font-size:26px;font-weight:800;margin-top:2px;line-height:1.1}
.sj-k-fecha{font-size:20px!important}.sj-kpi b small{display:block;font-size:12px;font-weight:600;color:var(--t)}
.sj-k-ico{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;flex:none}
.sj-verde{background:#E5F5EE;color:#127F51}.sj-ambar{background:#FDF3E2;color:#9A630B}.sj-rojo{background:var(--h);color:#C51E17}.sj-azul{background:#EAF1FB;color:#2B5FA8}.sj-gris{background:#EEF0F4;color:#58616D}
.sj-verde-t{color:#127F51}.sj-ambar-t{color:#9A630B}
.sj-prox{display:grid;grid-template-columns:minmax(0,1fr) 150px auto;gap:14px;align-items:center;padding:16px}
.sj-prox-h{display:flex;align-items:center;gap:8px;font-size:14px}.sj-prox-h .sj-pill{margin-left:6px}
.sj-prox h4{margin:8px 0 6px!important;font-size:17px!important;font-weight:700!important;color:var(--t)!important}
.sj-prox-img{width:150px;height:96px;object-fit:cover;border-radius:10px}
.sj-prox-acc{display:flex;flex-direction:column;gap:8px}.sj-prox-vacia{grid-template-columns:1fr auto}.sj-prox-vacia p{margin:8px 0 0;color:var(--m);font-size:13.5px}
.sj-meta{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12.5px;color:var(--m)}.sj-meta span{display:inline-flex;align-items:center;gap:6px}.sj-meta .sj-i{width:15px;height:15px}.sj-meta-col{flex-direction:column;gap:6px}
.sj-pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap}
.sj-accs{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.sj-accs.sj-n4{grid-template-columns:repeat(4,minmax(0,1fr))}
.sj-acc{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:12px 16px;min-height:58px;border-radius:12px;background:#fff;border:1px solid var(--b);box-shadow:0 3px 0 rgba(20,25,32,.06);cursor:pointer;font-size:13.5px;font-weight:600;color:var(--t);line-height:1.2;transition:transform .09s,box-shadow .18s,border-color .18s,background .18s}
.sj-acc small{font-weight:500;color:var(--m)}.sj-acc .sj-i{width:24px;height:24px}
.sj-acc:hover{border-color:#F6C9C6;background:var(--h);box-shadow:0 6px 14px rgba(226,35,26,.1)}.sj-acc:active{transform:scale(.98)}
.sj-acc-rojo{background:var(--r);color:#fff;border-color:var(--r);box-shadow:0 3px 0 #8E1410}.sj-acc-rojo:hover{background:#C51E17;color:#fff}.sj-acc-rojo small{color:#fff}
.sj-acc:focus-visible,.sj-btn:focus-visible{outline:2px solid #2879C7;outline-offset:2px}
.sj-dos{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:16px;align-items:start}
.sj-pn{padding:18px}.sj-ph{display:flex;align-items:center;gap:10px;margin:0 0 14px;font-size:16px}.sj-ph>.sj-i{width:30px;height:30px;padding:6px;border-radius:8px;background:var(--r);color:#fff}.sj-der-btn{margin-left:auto}
.sj-form-g{display:grid;grid-template-columns:150px minmax(0,1fr) minmax(0,.9fr);gap:16px}
.sj-form-img{width:150px;height:150px;object-fit:cover;border-radius:12px}
.sj-f{display:flex;flex-direction:column;gap:6px;margin:0 0 12px;font-size:12.5px;font-weight:700;color:var(--t)}.sj-f small{font-weight:500;color:var(--m)}
.sj-f input,.sj-f select,.sj-f textarea{font:inherit;font-weight:500;font-size:14px;padding:10px 12px;border:1px solid var(--b)!important;border-radius:10px!important;background:#fff!important;color:var(--t)!important;width:100%}
.sj-f textarea{resize:vertical;min-height:96px}
.sj-f2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sj-sub{display:block;font-size:12.5px;margin:0 0 8px}
.sj-part{display:flex;align-items:center;gap:10px;padding:6px 4px;font-size:13px;cursor:pointer}.sj-part small{display:block;color:var(--m);font-size:11.5px}
.sj-part input{width:18px;height:18px;accent-color:var(--r)}
.sj-cara{border-radius:50%!important;object-fit:cover;flex:0 0 auto!important;aspect-ratio:1;display:inline-grid;place-items:center;color:#fff;font-weight:800;font-size:14px}
.sj-corona{width:16px!important;height:16px!important;color:#E0A100;fill:#FFC93C}
.sj-rec{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px}.sj-rec .sj-i{width:17px;height:17px;color:var(--r)}.sj-rec span{flex:1}
#rbac-sala-juntas input.sj-sw{appearance:none!important;-webkit-appearance:none!important;width:40px!important;height:22px!important;min-height:0!important;padding:0!important;border:0!important;border-radius:999px!important;background:#D5DAE3!important;position:relative;cursor:pointer;flex:none}
#rbac-sala-juntas input.sj-sw::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}
#rbac-sala-juntas input.sj-sw:checked{background:var(--r)!important}#rbac-sala-juntas input.sj-sw:checked::after{transform:translateX(18px)}
.sj-hint{font-size:12px;color:var(--m);margin:8px 0 0}
.sj-form-acc{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;margin-top:6px}
#rbac-sala-juntas .sj-btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 16px;border-radius:10px!important;font-size:13.5px;font-weight:700;cursor:pointer;white-space:nowrap;transition:background .18s,transform .09s,box-shadow .18s}
#rbac-sala-juntas .sj-btn .sj-i{width:17px;height:17px}
#rbac-sala-juntas .sj-btn:active{transform:scale(.98)}#rbac-sala-juntas .sj-btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
#rbac-sala-juntas .sj-rojo.sj-btn{background:var(--r)!important;color:#fff!important;box-shadow:0 3px 0 #8E1410}#rbac-sala-juntas .sj-rojo.sj-btn:hover:not(:disabled){background:#C51E17!important}
#rbac-sala-juntas .sj-sec{background:#fff!important;color:var(--t)!important;border:1px solid var(--b)!important;box-shadow:0 2px 0 rgba(20,25,32,.06)}#rbac-sala-juntas .sj-sec:hover:not(:disabled){background:var(--f)!important}
#rbac-sala-juntas .sj-ok{background:#159B62!important;color:#fff!important}#rbac-sala-juntas .sj-peligro{background:#fff!important;color:#B91C1C!important;border:1px solid #F3C3C0!important}
#rbac-sala-juntas .sj-mini{height:32px;padding:0 12px;font-size:12.5px}#rbac-sala-juntas .sj-grande{height:44px;padding:0 20px;font-size:14px}
.sj-cargando-btn{opacity:.7}
.sj-ante-g{display:grid;grid-template-columns:150px minmax(0,1fr) 200px;gap:16px}
.sj-ante-av{border-radius:12px;background:#1b1b1f;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;min-height:180px;position:relative}
.sj-ante-av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.sj-ante-av span{position:relative;background:rgba(20,25,32,.78);color:#fff;font-size:11px;padding:8px;line-height:1.35}
.sj-ante-tit{display:block;font-size:14.5px;margin:0 0 8px}
.sj-listo{margin-top:12px;border:1px solid var(--b);border-radius:12px;padding:12px;background:var(--f)}.sj-listo>b{display:flex;align-items:center;gap:8px;font-size:13.5px}
.sj-listo-ok{background:#ECF8F2;border-color:#BFE6D2}.sj-listo-ok>b{color:#127F51}
.sj-disps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
.sj-disp{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:12px;text-align:center}.sj-disp b{font-weight:600}
.sj-dot{background:none!important;font-size:11.5px;font-weight:600}.sj-dot::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:1px}
.sj-nivel{height:6px;border-radius:6px;background:#DDE2E8;overflow:hidden;margin:0 0 10px}.sj-nivel i{display:block;height:100%;width:0;background:#159B62;transition:width .08s}
.sj-pp{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--b)}.sj-pp:last-of-type{border-bottom:0}.sj-pp>span:not(.sj-cara){flex:1;min-width:0}.sj-pp b{display:block;font-size:13px}.sj-pp small{display:block;font-size:11.5px;color:var(--m)}
.sj-ante-acc{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.sj-ante-acc .sj-grande{flex:1;min-width:240px}
.sj-motivo{text-align:center}
.sj-fila-btn{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.sj-rsvp-mini{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;font-weight:600}
.sj-reu{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--b)}.sj-reu:last-child{border-bottom:0}
.sj-reu-f{text-align:center;background:var(--f);border-radius:10px;padding:8px 4px}.sj-reu-f b{display:block;font-size:14px}.sj-reu-f small{font-size:11px;color:var(--m)}
.sj-reu-t b{display:block;font-size:14px}.sj-reu-t small{display:block;font-size:12px;color:var(--m);margin-top:2px}
.sj-reu-a{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.sj-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.sj-chip{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px}
.sj-volver{display:flex;align-items:center;gap:12px}.sj-volver h3{margin:0!important;font-size:18px!important}
.sj-cal-h{display:flex;align-items:center;justify-content:space-between;margin:0 0 12px}.sj-cal-h b{font-size:16px}
.sj-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.sj-dsem{font-size:11.5px;font-weight:700;color:var(--m);text-align:center;padding:4px 0}
.sj-dia{min-height:86px;border:1px solid var(--b);border-radius:10px;padding:6px;display:flex;flex-direction:column;gap:4px;font-size:12px}.sj-dia>span{font-weight:700}.sj-vacio-d{border:0}
.sj-hoy{border-color:var(--r);background:var(--h)}
.sj-ev{all:unset;cursor:pointer;font-size:11px;font-weight:600;padding:3px 6px;border-radius:6px;background:var(--h);color:#B91C1C;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sj-ev-cancelada,.sj-ev-finalizada{background:#EEF0F4;color:#58616D;text-decoration:line-through}
.sj-estado{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--b);font-size:13.5px}.sj-estado:last-child{border-bottom:0}.sj-estado span{color:var(--m)}
.sj-p{color:var(--m);font-size:13.5px;line-height:1.5;margin:0 0 10px}
.sj-pers{display:flex;gap:18px;align-items:flex-start}.sj-pers img{width:140px;height:140px;border-radius:14px;object-fit:cover}.sj-pers b{display:block;font-size:16px;margin:0 0 8px}
.sj-vacio{padding:28px;text-align:center;color:var(--m);display:flex;flex-direction:column;align-items:center;gap:8px}.sj-vacio b{color:var(--t)}.sj-vacio .sj-i{width:30px;height:30px}
.sj-nota{display:flex;gap:12px;padding:16px}.sj-nota p{margin:4px 0 0;font-size:13px;color:var(--m)}
.sj-alerta{background:#FFF4F3;border:1px solid #F3C3C0;color:#B91C1C;border-radius:12px;padding:10px 14px;font-size:13px}
.sj-borr{padding:14px 18px}.sj-borr>b{display:block;margin:0 0 6px}
.sj-fila{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;padding:9px 0;border-top:1px solid var(--b);cursor:pointer;font-size:13.5px}.sj-fila span{flex:1;font-weight:600}.sj-fila small{color:var(--m)}
#sjToast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);opacity:0;background:#141920;color:#fff;padding:12px 18px;border-radius:12px;font:600 14px Inter,system-ui,sans-serif;z-index:3000;transition:all .22s;pointer-events:none;max-width:90vw}
#sjToast.on{opacity:1;transform:translateX(-50%)}#sjToast.malo{background:#B91C1C}
#rbac-sala-juntas>*{animation:sjEntra .3s cubic-bezier(.2,.8,.2,1)}@keyframes sjEntra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#rbac-sala-juntas *{animation:none!important;transition:none!important}}
@media (max-width:1279.98px){.sj-top{grid-template-columns:1fr}.sj-hero{min-height:0;aspect-ratio:3/1}.sj-accs{grid-template-columns:repeat(3,minmax(0,1fr))}.sj-dos{grid-template-columns:1fr}}
@media (max-width:767.98px){.sj-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.sj-prox{grid-template-columns:1fr}.sj-prox-img{width:100%;height:140px}.sj-accs,.sj-accs.sj-n4{grid-template-columns:repeat(2,minmax(0,1fr))}
  .sj-form-g{grid-template-columns:1fr}.sj-form-img{display:none}.sj-ante-g{grid-template-columns:1fr}.sj-ante-av{min-height:160px}.sj-form-acc .sj-btn{flex:1 1 100%}.sj-cab h2{font-size:22px!important}
  .sj-reu{grid-template-columns:56px minmax(0,1fr)}.sj-reu-a{grid-column:1/-1;align-items:flex-start}.sj-cal{gap:3px}.sj-dia{min-height:60px;padding:3px}.sj-ev{font-size:9.5px;padding:2px 3px}
  #rbac-sala-juntas .sj-btn{min-height:44px}}
`;
    document.head.appendChild(s);
  }

  window.SublichatSala = { open, recargar: () => cargar(true) };
})();
