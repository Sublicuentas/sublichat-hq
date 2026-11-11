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
    micOff: '<path d="M2 2l20 20M18.89 13.23A7 7 0 0 0 19 12v-2M5 10v2a7 7 0 0 0 12 5M15 9.34V5a3 3 0 0 0-5.68-1.33M9 9v3a3 3 0 0 0 5.12 2.12M12 19v3"/>',
    manoI: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    expandir: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    contraer: '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>',
    ojo: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    pantalla: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>', sonrisa: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    cuadro: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    paleta: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.6-.75 1.6-1.7 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C21.97 6.01 17.46 2 12 2Z"/>',
    planta: '<path d="M7 20h10M10 20c5.5-2.5.8-6.4 3-10M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8zM14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
    atras: '<path d="m12 19-7-7 7-7M19 12H5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', puerta: '<path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9M10 12v.01M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/>',
  };
  const ico = (k, c = '') => `<svg class="sj-i ${c}" viewBox="0 0 24 24" aria-hidden="true">${I[k] || ''}</svg>`;

  // R193 · Misma sala dentro de la APK: la APK define window.SalaJuntasConfig = { post, embebida, descargar } antes de cargar
  // este archivo. post() usa la sesión vigente de la APK (sin segundo inicio de sesión). En la Web no existe y todo sigue igual.
  const CFG = (typeof window !== 'undefined' && window.SalaJuntasConfig) || {};
  async function api(body) {
    if (typeof CFG.post === 'function') { const j = await CFG.post(body); if (!j || !j.ok) throw new Error((j && j.error) || 'No se pudo completar.'); return j; }
    const r = await fetch('/api/sala-juntas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || 'No se pudo completar.');
    return j;
  }
  function toast(t, malo) {
    let el = document.getElementById('sjToast');
    if (!el) { el = document.createElement('div'); el.id = 'sjToast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    const raiz = document.fullscreenElement || document.webkitFullscreenElement || document.body; if (el.parentNode !== raiz) raiz.appendChild(el);
    el.textContent = t; el.className = 'on' + (malo ? ' malo' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => { el.className = ''; }, 3200);
  }
  const fechaLarga = (r) => { if (!r || !r.inicioMs) return 'Sin fecha'; const d = new Date(r.inicioMs - 6 * 3600000); return `${DIAS[d.getUTCDay()].replace(/^./, (x) => x.toUpperCase())}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`; };
  const horaHN = (r) => { if (!r || !r.hora) return ''; const [h, m] = r.hora.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`; };
  const diaCorto = (r) => { const d = new Date(r.inicioMs - 6 * 3600000); return `${String(d.getUTCDate()).padStart(2, '0')} ${MESES[d.getUTCMonth()].slice(0, 3).replace(/^./, (x) => x.toUpperCase())}.`; };
  const ESTADO = { borrador: ['Borrador', 'gris'], programada: ['Confirmada', 'verde'], en_curso: ['En curso', 'rojo'], finalizada: ['Finalizada', 'gris'], cancelada: ['Cancelada', 'gris'] };
  const pill = (e) => { const x = ESTADO[e] || [e, 'gris']; return `<span class="sj-pill sj-${x[1]}">${esc(x[0])}</span>`; };
  const RSVP = { aceptada: ['Confirmó', 'verde'], rechazada: ['No asistirá', 'rojo'], pendiente: ['Pendiente', 'ambar'] };
  const funda = (id) => (st.data?.fundadoras || []).find((f) => f.id === id) || { id, nombre: id };
  // R177 · "Nombre visible" del personaje (si no lo eligió, su nombre de usuaria)
  const nomVis = (id) => String((st.pers && id === st.data?.yo?.id && st.pers.config?.nombre) || st.data?.avatares?.[id]?.config?.nombre || '').trim() || funda(id).nombre;
  function cara(id, tam = 40) {
    const f = funda(id); let src = st.data?.avatares?.[id]?.miniatura || '';
    if (!src && st.data && id === st.data.yo.id) { try { src = window.SublichatRBAC?.avatar?.() || ''; } catch (_) {} }
    const ini = String(f.nombre || '?').slice(0, 1).toUpperCase();
    return src ? `<img class="sj-cara" style="width:${tam}px;height:${tam}px" src="${esc(src)}" alt="">`
      : `<span class="sj-cara sj-ini" style="width:${tam}px;height:${tam}px;background:${COLOR[id] || '#58616D'}">${esc(ini)}</span>`;
  }

  // ---------- carga ----------
  async function cargar(silencioso, forzar) {
    if (st.cargando) return; st.cargando = true; if (!silencioso) { st.error = ''; pintar(); }
    try { st.data = await api({ accion: 'panel' }); st.error = ''; if (!st.esc && !st.escCargando) { st.escCargando = true; cargarEscenarios().then(() => { st.escCargando = false; const c = document.getElementById('sjEscCampos'); if (c && !c.innerHTML.trim()) c.innerHTML = escenarioCampos(st.editar || {}); else if (puedeRepintarSolo()) pintar(); }); } }
    catch (e) { if (!silencioso) st.error = e.message; }
    st.cargando = false;
    // R176: la actualización automática NUNCA repinta si hay algo a medio llenar o con foco (antes borraba lo elegido)
    if (silencioso && !forzar && !puedeRepintarSolo()) { st.pendienteRepintar = true; return; }
    pintar();
  }
  function puedeRepintarSolo() {
    if (!host || st.guardando || st.tocado) return false;
    if (['form', 'personaje', 'sala3d', 'acta', 'escenarios'].includes(st.vista)) return false;
    if (host.querySelector('form, textarea, input:not([type=hidden]), select')) return false; // formulario embebido en Inicio
    if (host.contains(document.activeElement) && document.activeElement !== host) return false;
    return true;
  }
  function open() {
    host = document.getElementById('rbac-sala-juntas'); if (!host) return;
    estilos();
    const sec = document.getElementById('screen-sala-juntas'); if (sec) sec.classList.add('sj-pantalla');
    st.vista = 'inicio'; st.editar = null; cargar();
    if (!host.dataset.sjTocado) { host.dataset.sjTocado = '1'; ['input', 'change'].forEach((ev) => host.addEventListener(ev, () => { st.tocado = true; }, true)); }
    clearInterval(poll); poll = setInterval(() => { const a = document.getElementById('screen-sala-juntas'); if (!a || !a.classList.contains('active')) { clearInterval(poll); detenerMic(); if (st.vivo) salirVivo(); return; } if (!st.guardando && !['form', 'personaje', 'sala3d', 'acta', 'escenarios'].includes(st.vista)) cargar(true); }, 30000);
  }

  // ---------- pintar ----------
  function pintar() {
    if (!host) return;
    st.tocado = false; st.pendienteRepintar = false;
    if (!st.data) { host.innerHTML = cab() + (st.error ? `<div class="sj-card sj-vacio"><b>No se pudo abrir la Sala de Juntas.</b><p>${esc(st.error)}</p><button class="sj-btn sj-sec" data-sj="recargar">Reintentar</button></div>` : `<div class="sj-card sj-vacio sj-cargando">Cargando Sala de Juntas…</div>`); return; }
    let cuerpo = '';
    if (st.vista === 'form') cuerpo = formulario();
    else if (st.vista === 'antesala') cuerpo = antesala();
    else if (st.vista === 'calendario') cuerpo = volver('Calendario de reuniones') + calendario();
    else if (st.vista === 'mis') cuerpo = volver('Mis reuniones') + listaReuniones((r) => ['programada', 'en_curso'].includes(r.estado), 'No tiene reuniones próximas.');
    else if (st.vista === 'historial') cuerpo = volver('Historial y acuerdos') + historial();
    else if (st.vista === 'acta') cuerpo = volver('Acta de la reunión') + actaHtml();
    else if (st.vista === 'escenarios') cuerpo = volver('Escenarios y estilos') + escenariosHtml();
    else if (st.vista === 'config') cuerpo = volver('Configuración de la sala') + configuracion();
    else if (st.vista === 'personaje') cuerpo = volver('Mi personaje (Avatar)') + personaje();
    else if (st.vista === 'sala3d') cuerpo = sala3dHtml();
    else cuerpo = inicio();
    desmontar3D();
    if (st.vivo && st.vista !== 'sala3d') salirVivo();
    if (st.vistaPintada !== st.vista) { st.vistaPintada = st.vista; try { CFG.alCambiarVista && CFG.alCambiarVista(st.vista); } catch (_) {} } // R193 · la APK sube su vista interna al inicio
    document.documentElement.classList.toggle('sj-en-sala', st.vista === 'sala3d');
    document.documentElement.classList.toggle('sj-en-editor', st.vista === 'personaje');
    if (st.vista !== 'sala3d') salirPantallaCompleta();
    host.innerHTML = cab() + (st.error ? `<div class="sj-alerta">${esc(st.error)}</div>` : '') + cuerpo;
    if (st.vista === 'antesala') pintarMedidor();
    if (st.vista === 'personaje') montarEditor3D();
    if (st.vista === 'sala3d') montarSala3D();
    if (st.vista === 'escenarios') montarEsc3D();
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
          <div class="sj-meta"><span>${ico('cal')}${esc(fechaLarga(p))}</span><span>${ico('reloj')}${esc(horaHN(p))} (Honduras)</span><span>${ico('grupo')}Participantes (${p.participantes.length})</span></div>
          ${avisosTxt(st.data.reuniones.find((x) => x.id === p.id) || {})}
          ${mia && mia.estado === 'pendiente' && p.estado === 'programada' ? `<div class="sj-rsvp-mini">¿Asistirá? <button class="sj-btn sj-ok sj-mini" data-sj="rsvp" data-id="${p.id}" data-r="aceptada">Confirmar</button><button class="sj-btn sj-sec sj-mini" data-sj="rsvp" data-id="${p.id}" data-r="rechazada">No asistiré</button></div>` : ''}
        </div>
        <img class="sj-prox-img" src="/assets/sala/sala-escenario-c.webp" alt="Sala de Juntas · Escenario C" loading="lazy">
        <div class="sj-prox-acc"><button class="sj-btn sj-rojo" data-sj="antesala" data-id="${p.id}">${ico('sala')}Entrar a la reunión</button><button class="sj-btn sj-sec" data-sj="detalle" data-id="${p.id}">${ico('doc')}Ver detalles</button></div>
      </div>` : `<div class="sj-card sj-prox sj-prox-vacia"><div class="sj-prox-t"><div class="sj-prox-h">${ico('cal')}<b>Próxima reunión</b></div><p>No hay reuniones programadas.${puedeCrear ? ' Cree la primera convocatoria.' : ' Cuando Naara convoque, aparecerá aquí y le llegará por Telegram.'}</p></div>${puedeCrear ? `<div class="sj-prox-acc"><button class="sj-btn sj-rojo" data-sj="nueva">${ico('calPlus')}Crear convocatoria</button></div>` : ''}</div>`;
    const acc = [
      puedeCrear ? ['nueva', 'calPlus', 'Crear<br>convocatoria', true] : null,
      ['calendario', 'cal', 'Calendario<br>de reuniones'], ['mis', 'grupo', 'Mis reuniones<br><small>(agenda)</small>'], ['personaje', 'persona', 'Mi personaje<br><small>(Avatar)</small>'],
      ['historial', 'lista', 'Historial y<br>acuerdos'], ['escenarios', 'pantalla', 'Escenarios<br>y estilos'], puedeCrear ? ['config', 'config', 'Configuración<br>de la sala'] : null,
    ].filter(Boolean).map(([v, i, t, rojo]) => `<button class="sj-acc${rojo ? ' sj-acc-rojo' : ''}" data-sj="${v}">${ico(i)}<span>${t}</span></button>`).join('');
    const borradores = puedeCrear ? d.reuniones.filter((r) => r.estado === 'borrador') : [];
    return `<div class="sj-top"><div class="sj-hero"><img src="/assets/sala/sala-hero.webp" alt="SubliStudio 3D · Nuestra sala virtual de fundadores"></div>
        <div class="sj-der">${miTelegram()}<div class="sj-kpis">${kpis}</div>${prox}</div></div>
      <div class="sj-accs sj-n${puedeCrear ? 6 : 4}">${acc}</div>
      ${borradores.length ? `<div class="sj-card sj-borr"><b>Borradores</b>${borradores.map((r) => `<button class="sj-fila" data-sj="editar" data-id="${r.id}"><span>${esc(r.titulo || 'Sin título')}</span><small>${r.inicioMs ? esc(fechaLarga(r)) : 'Sin fecha'}</small>${pill('borrador')}</button>`).join('')}</div>` : ''}
      <div class="sj-dos">${puedeCrear ? formulario(true) : misInvitaciones()}${p ? antesala(true) : `<div class="sj-card sj-vacio">${ico('puerta')}<b>Antesala virtual</b><p>Se activa cuando haya una reunión programada.</p></div>`}</div>`;
  }

  function misInvitaciones() {
    const lista = st.data.reuniones.filter((r) => ['programada', 'en_curso'].includes(r.estado));
    return `<div class="sj-card sj-pn"><div class="sj-ph">${ico('campana')}<b>Mis invitaciones</b></div>${lista.length ? lista.map(filaReunion).join('') : '<p class="sj-p">No tiene invitaciones pendientes.</p>'}</div>`;
  }
  // R182 · estado de la convocatoria por persona: lo que respondió la API de Telegram (enviado ≠ leído)
  function avisosTxt(r) {
    if (!r.avisos) return '';
    const a = r.avisos, pu = a.porUsuario || {}, tg = st.data.telegram || {};
    const tipo = { invitacion: 'invitación', h24: 'aviso 24 h', h1: 'aviso 1 h', m10: 'aviso 10 min', inicio: 'aviso de inicio', cancelacion: 'aviso de cancelación' };
    const otros = r.participantes.filter((u) => u !== 'naara');
    const E = { enviado: ['verde', 'ENVIADO'], pendiente: ['gris', 'EN COLA'], enviando: ['gris', 'EN COLA'], sin_vinculo: ['ambar', 'PENDIENTE · sin Telegram'], fallido: ['rojo', 'NO ENTREGADO'], anulado: ['gris', 'anulado'] };
    const chips = otros.map((u) => { const e = (pu[u] || {}).estado || (tg[u] && tg[u].estado !== 'listo' ? 'sin_vinculo' : 'pendiente'); const x = E[e] || ['gris', e]; return `<span class="sj-chip sj-${x[0]}" title="${esc((pu[u] || {}).error || '')}">${esc(nomVis(u))}: ${x[1]}</span>`; }).join('');
    const faltan = otros.filter((u) => ((pu[u] || {}).estado || '') === 'sin_vinculo' || (tg[u] && tg[u].estado !== 'listo' && !(pu[u] || {}).estado));
    const completo = otros.length && otros.every((u) => (pu[u] || {}).estado === 'enviado');
    return `<div class="sj-avisos">${ico('enviar')}<span>Telegram: ${completo ? '<b class="sj-bien">convocatoria enviada a todas las personas</b>' : `<b class="sj-mal">envío incompleto</b>`} · ${a.enviado} enviado${a.enviado === 1 ? '' : 's'} · ${a.pendiente} programado${a.pendiente === 1 ? '' : 's'}${a.fallido ? ` · ${a.fallido} sin entregar` : ''}</span></div><div class="sj-chips sj-chips-tg">${chips}</div>` +
      (faltan.length ? `<div class="sj-falla">${esc(faltan.map(nomVis).join(', '))}: debe${faltan.length > 1 ? 'n' : ''} abrir Sublichat → Sala de Juntas → <b>Vincular Telegram</b> y tocar Iniciar en el bot. <button class="sj-btn sj-sec sj-mini" data-sj="reintentarAvisos" data-id="${r.id}">Reintentar envío</button></div>` : '') +
      (a.fallas || []).filter((f) => !faltan.includes(f.usuario)).slice(0, 4).map((f) => `<div class="sj-falla">${esc(nomVis(f.usuario))} · ${esc(tipo[f.tipo] || f.tipo)}: ${esc(/blocked|403|initiate|chat not found/i.test(f.error) ? 'bloqueó al bot o no lo ha iniciado (debe tocar Iniciar en el bot)' : 'Telegram no lo aceptó')}</div>`).join('');
  }
  // R182 · tarjeta "Mi Telegram" para cualquier participante
  function miTelegram() {
    const yo = st.data.yo.id, t = (st.data.telegram || {})[yo] || { estado: 'sin_vincular' };
    if (t.estado === 'listo') return `<div class="sj-tg sj-tg-ok">${ico('enviar')}<span><b>Telegram vinculado</b><small>Aquí le llegan convocatorias y recordatorios.${t.fuente === 'vercel' ? ' (Configurado por Sublicuentas)' : ''}</small></span></div>`;
    const txt = t.estado === 'bloqueado' ? 'Telegram rechazó el mensaje: desbloquee el bot y vuelva a vincular.' : t.estado === 'pendiente' ? 'Abrió el enlace pero falta tocar Iniciar en el bot.' : 'Vincule su Telegram para recibir convocatorias y recordatorios.';
    return `<div class="sj-tg sj-tg-no" role="status">${ico('enviar')}<span><b>Telegram ${t.estado === 'bloqueado' ? 'bloqueado' : 'sin vincular'}</b><small>${esc(txt)}</small></span><div class="sj-fila-btn">${st.data.botTelegram ? `<button class="sj-btn sj-rojo sj-mini" data-sj="tgVincular">Vincular Telegram</button>` : '<small>El bot de Telegram (Render) todavía no publicó su nombre: debe estar encendido. Toque «Ya lo hice» en 1 minuto.</small>'}<button class="sj-btn sj-sec sj-mini" data-sj="tgComprobar">Ya lo hice</button></div></div>`;
  }
  function filaReunion(r) {
    const mia = (r.invitaciones || {})[st.data.yo.id] || { estado: 'pendiente' }, x = RSVP[mia.estado] || RSVP.pendiente;
    const puedeResp = r.estado === 'programada' && st.data.yo.id !== 'naara';
    return `<div class="sj-reu"><div class="sj-reu-f"><b>${esc(diaCorto(r))}</b><small>${esc(horaHN(r))}</small></div>
      <div class="sj-reu-t"><b>${esc(r.titulo)}</b><small>${esc(fechaLarga(r))} · ${r.participantes.map((u) => esc(funda(u).nombre)).join(', ')}</small>${avisosTxt(r)}
        <div class="sj-chips">${r.participantes.map((u) => { const e = (r.invitaciones || {})[u]?.estado || 'pendiente'; const y = RSVP[e]; return `<span class="sj-chip sj-${y[1]}">${esc(funda(u).nombre)}: ${y[0]}</span>`; }).join('')}</div></div>
      <div class="sj-reu-a">${pill(r.estado)}${puedeResp ? `<span class="sj-pill sj-${x[1]}">Usted: ${x[0]}</span><div class="sj-fila-btn"><button class="sj-btn sj-ok sj-mini" data-sj="rsvp" data-id="${r.id}" data-r="aceptada"${mia.estado === 'aceptada' ? ' disabled' : ''}>Confirmar</button><button class="sj-btn sj-sec sj-mini" data-sj="rsvp" data-id="${r.id}" data-r="rechazada"${mia.estado === 'rechazada' ? ' disabled' : ''}>No asistiré</button></div>` : ''}
        ${['programada', 'en_curso'].includes(r.estado) ? `<button class="sj-btn sj-rojo sj-mini" data-sj="antesala" data-id="${r.id}">Antesala</button>` : ''}
        ${st.data.permisos.crear && ['programada', 'borrador'].includes(r.estado) ? `<button class="sj-btn sj-sec sj-mini" data-sj="editar" data-id="${r.id}">Editar</button>` : ''}
        ${r.estado === 'finalizada' ? `<button class="sj-btn sj-sec sj-mini" data-sj="verActa" data-id="${r.id}">${(st.actasIdx || {})[r.id] ? 'Ver acta' : (st.data.permisos.moderar ? 'Escribir acta' : 'Acta')}</button>` : ''}
        ${['finalizada', 'cancelada'].includes(r.estado) && st.data.permisos.crear ? `<button class="sj-btn sj-sec sj-mini" data-sj="repetir" data-id="${r.id}" title="Nueva convocatoria con el mismo escenario, estilo y participantes">Repetir con este escenario</button>` : ''}</div></div>`;
  }
  function listaReuniones(filtro, vacio) {
    const l = st.data.reuniones.filter(filtro);
    return `<div class="sj-card sj-pn">${l.length ? l.map(filaReunion).join('') : `<p class="sj-p">${esc(vacio)}</p>`}</div>`;
  }

  // ---------- R174 · escenarios y editor de estilos ----------
  let esc3 = null, escMod = null, escFicha = 0;
  const modEsc = () => (escMod = escMod || import('/escenarios.js?v=20261105-r177'));
  async function cargarEscenarios() { try { const [j, M] = await Promise.all([api({ accion: 'escenarios' }), modEsc()]); st.esc = j.escenarios; st.escCat = M.ESCENARIOS; st.escParams = M.PARAMS; st.escM = M; } catch (e) { toast(e.message || 'No se pudieron cargar los escenarios.', true); } }
  // estilo de una reunión: su preset; si se borró, la copia guardada (R177); estilo sugerido; el oficial; el base
  function estiloDeReunion(r) {
    const id = r.escenario || 'sala-c'; const D = (st.esc || {})[id] || { presets: [] };
    const p = r.presetId && D.presets.find((x) => x.id === r.presetId);
    if (p) return { escenario: id, estilo: p.estilo, nombre: p.nombre };
    if (r.presetId && r.estiloUsado) return { escenario: id, estilo: r.estiloUsado, nombre: 'estilo usado' };
    if (r.sugerido && st.escM) return { escenario: id, estilo: st.escM.sugerido(id, r.sugerido), nombre: ((st.escM.SUGERIDOS.find(([k]) => k === r.sugerido) || [])[1] || '') };
    const of = D.presets.find((x) => x.id === D.predeterminado);
    return { escenario: id, estilo: of ? of.estilo : null, nombre: of ? of.nombre : '' };
  }
  function escenariosHtml() {
    if (!st.esc || !st.escCat) return `<div class="sj-card sj-pn"><p class="sj-p">Cargando escenarios…</p></div>`;
    const C = st.escCat; if (!st.escSel) { const D = st.esc['sala-c']; const of = D.presets.find((x) => x.id === D.predeterminado); st.escSel = { id: 'sala-c', estilo: { ...(of ? of.estilo : C['sala-c'].base) }, presetId: of ? of.id : '' }; }
    const S = st.escSel, E = C[S.id], D = st.esc[S.id] || { presets: [] }, mod = st.data.permisos.moderar, yo = st.data.yo.id;
    const tabs = Object.entries(C).map(([id, x]) => `<button type="button" class="sj-chip-op${id === S.id ? ' on' : ''}" data-sj="escTab" data-e="${id}">${esc(x.corto)}</button>`).join('');
    // R177 · editor de ambiente por secciones: Iluminación, Piso, Paredes, Asientos, Paleta, Decoración, Logo/branding
    const AM = st.escM.AMBIENTE; const ES = st.escM.estiloValido(S.id, S.estilo); S.estilo = ES;
    const chipsEsc = (k, lista) => `<div class="sj-op-v">${lista.map(([v, n]) => `<button type="button" class="sj-chip-op${ES[k] === v ? ' on' : ''}" data-sj="escOp" data-k="${k}" data-v="${v}" aria-pressed="${ES[k] === v}">${esc(n)}</button>`).join('')}</div>`;
    const sw = (k, t) => `<label class="sj-rec sj-acc-op sj-esc-sw"><span>${esc(t)}</span><input type="checkbox" role="switch" class="sj-sw" data-sj="escDeco" data-d="${k}" ${ES.deco[k] ? 'checked' : ''}></label>`;
    const sec = (t, i, html) => `<section class="sj-esc-sec"><h4>${ico(i)}${t}</h4>${html}</section>`;
    const filas = `<div class="sj-esc-sug"><b>Estilos sugeridos</b><div class="sj-op-v">${st.escM.SUGERIDOS.map(([k, n]) => `<button type="button" class="sj-chip-op" data-sj="escSug" data-s="${k}">${esc(n)}</button>`).join('')}</div></div>`
      + sec('Iluminación', 'sol', `<small class="sj-hint">Tipo de luz</small>${chipsEsc('luz', E.luz)}<small class="sj-hint">Intensidad</small>${chipsEsc('brillo', AM.brillo)}`)
      + sec('Piso', 'cuadro', chipsEsc('piso', AM.piso))
      + sec('Paredes / fondo', 'pantalla', chipsEsc('paredes', E.paredes))
      + sec('Asientos / set', 'grupo', chipsEsc('asientos', E.asientos))
      + sec('Paleta de color', 'paleta', chipsEsc('paleta', E.paleta))
      + sec('Decoración', 'planta', `<div class="sj-esc-sws">${AM.deco.map(([k, t]) => sw(k, t)).join('')}</div>`)
      + sec('Logo / branding', 'check', `<div class="sj-esc-sws">${AM.marca.map(([k, t]) => sw(k, t)).join('')}</div><small class="sj-hint">También puede elegir la pared "${esc((E.paredes.find(([v]) => /logo|led/.test(v)) || ['', 'con logo'])[1])}" en Paredes.</small>`);
    const pres = D.presets.length ? D.presets.map((p) => `<div class="sj-esc-p${p.id === S.presetId ? ' on' : ''}"><button type="button" class="sj-esc-pn" data-sj="escPreset" data-p="${p.id}"><b>${esc(p.nombre)}</b><small>${p.id === D.predeterminado ? '⭐ Oficial · ' : ''}${esc(funda(p.creadoPor).nombre)}</small></button>
        ${mod ? `<button type="button" class="sj-btn sj-sec sj-mini" data-sj="escOficial" data-p="${p.id === D.predeterminado ? '' : p.id}">${p.id === D.predeterminado ? 'Quitar oficial' : 'Hacer oficial'}</button>` : ''}
        ${p.creadoPor === yo || mod ? `<button type="button" class="sj-btn sj-sec sj-mini" data-sj="escBorrar" data-p="${p.id}" aria-label="Borrar ${esc(p.nombre)}">${ico('x')}</button>` : ''}</div>`).join('') : '<p class="sj-hint">Todavía no hay estilos guardados en este escenario.</p>';
    const sel = D.presets.find((p) => p.id === S.presetId);
    return `<div class="sj-card sj-pn sj-esc">
      <div class="sj-ph">${ico('pantalla')}<b>${esc(E.nombre)}</b></div><p class="sj-hint">${esc(E.uso)}</p>
      <div class="sj-esc-tabs" role="tablist">${tabs}</div>
      <div class="sj-esc-g"><div class="sj-esc-3d" id="sjEsc3d"><div class="sj-ed-carga" id="sjEscCarga">Armando el escenario…</div></div>
        <div class="sj-esc-ops">${filas}
          <div class="sj-op"><b>Estilos guardados</b><div class="sj-esc-ps">${pres}</div></div>
          <form class="sj-esc-guardar" id="sjEscF"><input name="nombre" maxlength="40" placeholder="Nombre del estilo (ej.: Junta mensual)" value="${esc(sel && (sel.creadoPor === yo || mod) ? sel.nombre : '')}" aria-label="Nombre del estilo">
            <button type="submit" class="sj-btn sj-rojo sj-mini">${sel && (sel.creadoPor === yo || mod) ? 'Actualizar estilo' : 'Guardar estilo'}</button>${sel ? `<button type="button" class="sj-btn sj-sec sj-mini" data-sj="escNuevo">Guardar como nuevo</button>` : ''}
            <button type="button" class="sj-btn sj-sec sj-mini" data-sj="escReset">Restablecer</button></form>
          <p class="sj-hint">Cambiar el estilo no borra reuniones, personajes ni actas. ${mod ? 'El estilo marcado como oficial es el que se usa si la convocatoria no elige otro.' : 'Naara aprueba el estilo oficial de cada escenario.'}</p>
        </div></div></div>`;
  }
  async function montarEsc3D() {
    const cont = document.getElementById('sjEsc3d'); if (!cont || !st.escSel) return;
    const yo = ++escFicha;
    if (esc3) { try { esc3.destruir(); } catch (_) {} esc3 = null; }
    cont.querySelectorAll('canvas,.sj3d-nombres').forEach((x) => x.remove());
    let c = document.getElementById('sjEscCarga'); if (!c) { c = document.createElement('div'); c.className = 'sj-ed-carga'; c.id = 'sjEscCarga'; cont.appendChild(c); } c.textContent = 'Armando el escenario…';
    try {
      const M = await modulo3D(); if (yo !== escFicha || !document.getElementById('sjEsc3d')) return;
      if (!M.soportaWebGL()) throw new Error('Este equipo no puede mostrar escenas 3D (WebGL).');
      const s3 = await M.montarSala(cont, { avatares: st.data.avatares || {}, escenario: st.escSel.id, estilo: st.escSel.estilo, participantes: ['naara', 'libni', 'geisell'] });
      if (yo !== escFicha) { s3.destruir(); return; }
      esc3 = s3; await s3.listo; const cc = document.getElementById('sjEscCarga'); if (cc && yo === escFicha) cc.remove();
    } catch (e) { const cc = document.getElementById('sjEscCarga'); if (cc) cc.textContent = e.message || 'No se pudo armar el escenario.'; }
  }
  let escTimer = null; const remontarEsc = () => { clearTimeout(escTimer); escTimer = setTimeout(montarEsc3D, 250); };
  function repintarEscOps() { // repinta solo los controles; la escena se rearma aparte
    const g = host.querySelector('.sj-esc'); if (!g) return pintar(); const tmp = document.createElement('div'); tmp.innerHTML = escenariosHtml();
    g.querySelector('.sj-esc-ops').replaceWith(tmp.querySelector('.sj-esc-ops')); g.querySelector('.sj-esc-tabs').replaceWith(tmp.querySelector('.sj-esc-tabs'));
    g.querySelector('.sj-ph').replaceWith(tmp.querySelector('.sj-ph')); g.querySelector('.sj-hint').replaceWith(tmp.querySelector('.sj-hint'));
  }
  async function accionEsc(a, b) {
    const S = st.escSel, C = st.escCat;
    if (a === 'escTab') { const id = b.dataset.e; const D = st.esc[id]; const of = D.presets.find((x) => x.id === D.predeterminado); st.escSel = { id, estilo: { ...(of ? of.estilo : C[id].base) }, presetId: of ? of.id : '' }; repintarEscOps(); return remontarEsc(); }
    if (a === 'escOp') { S.estilo = { ...S.estilo, [b.dataset.k]: b.dataset.v }; repintarEscOps(); return remontarEsc(); }
    if (a === 'escDeco') { S.estilo = { ...S.estilo, deco: { ...(S.estilo.deco || {}), [b.dataset.d]: !!b.checked } }; return remontarEsc(); }
    if (a === 'escSug') { S.estilo = st.escM.sugerido(S.id, b.dataset.s); S.presetId = ''; repintarEscOps(); const i = host.querySelector('#sjEscF [name=nombre]'); if (i && !i.value) i.value = (st.escM.SUGERIDOS.find(([k]) => k === b.dataset.s) || [])[1] || ''; return remontarEsc(); }
    if (a === 'escPreset') { const p = st.esc[S.id].presets.find((x) => x.id === b.dataset.p); if (p) { S.estilo = { ...p.estilo }; S.presetId = p.id; } repintarEscOps(); return remontarEsc(); }
    if (a === 'escReset') { S.estilo = { ...C[S.id].base }; S.presetId = ''; repintarEscOps(); return remontarEsc(); }
    if (a === 'escNuevo') { S.presetId = ''; repintarEscOps(); const i = host.querySelector('#sjEscF [name=nombre]'); if (i) { i.value = ''; i.focus(); } return; }
    try {
      if (a === 'escBorrar') { if (!confirm('¿Borrar este estilo guardado?')) return; const j = await api({ accion: 'preset_borrar', escenario: S.id, presetId: b.dataset.p }); st.esc[S.id] = j; if (S.presetId === b.dataset.p) S.presetId = ''; toast('Estilo borrado.'); }
      if (a === 'escOficial') { const j = await api({ accion: 'preset_oficial', escenario: S.id, presetId: b.dataset.p }); st.esc[S.id] = j; toast(b.dataset.p ? 'Ahora es el estilo oficial de este escenario.' : 'Se quitó el estilo oficial.'); }
    } catch (e) { toast(e.message, true); }
    repintarEscOps();
  }
  async function guardarEsc(f) {
    if (st.guardando) return; const S = st.escSel; const D = st.esc[S.id]; const sel = D.presets.find((p) => p.id === S.presetId);
    const editar = sel && (sel.creadoPor === st.data.yo.id || st.data.permisos.moderar);
    st.guardando = 'esc';
    try { const j = await api({ accion: 'preset_guardar', escenario: S.id, nombre: f.nombre.value, estilo: S.estilo, presetId: editar ? sel.id : '' }); st.esc[S.id] = j; S.presetId = editar ? sel.id : j.presets[j.presets.length - 1].id; toast('Estilo guardado.'); }
    catch (e) { toast(e.message, true); }
    finally { st.guardando = ''; }
    repintarEscOps();
  }

  // ---------- R173 · historial, acta y acuerdos ----------
  function historial() {
    const idx = st.actasIdx || {};
    const mis = Object.values(idx).reduce((a, x) => a + (x.misPendientes || 0), 0);
    const nota = mis ? `<div class="sj-card sj-nota">${ico('check')}<div><b>Tiene ${mis} acuerdo${mis === 1 ? '' : 's'} pendiente${mis === 1 ? '' : 's'}</b><p>Ábralos desde "Ver acta" para marcarlos como cumplidos.</p></div></div>` : '';
    return nota + listaReuniones((r) => ['finalizada', 'cancelada'].includes(r.estado), 'Todavía no hay reuniones terminadas.');
  }
  async function cargarActas() { try { const j = await api({ accion: 'actas' }); st.actasIdx = Object.fromEntries(j.actas.map((x) => [x.reunionId, x])); if (st.vista === 'historial') pintar(); } catch (_) {} }
  async function abrirActa(id, editar) {
    st.acta = { id, cargando: true, editar: !!editar }; st.vista = 'acta'; pintar(); window.scrollTo({ top: 0 });
    try { const j = await api({ accion: 'acta', id }); st.acta = { id, ...j, editar: !!editar || (!j.acta && st.data.permisos.moderar) }; }
    catch (e) { st.acta = { id, error: e.message }; }
    pintar();
    try { const g = await api({ accion: 'grabaciones', id }); if (st.acta && st.acta.id === id) { st.acta.grabs = g.grabaciones || []; st.acta.grabCfg = g.configurada; if (st.vista === 'acta' && !st.acta.editar) pintar(); } } catch (_) {}
  }
  // R193 · Grabaciones de la reunión (servidor). Estado, duración, quiénes estaban; reproducir/descargar con enlace de 15 min.
  const ESTADO_G = { iniciando: 'Iniciando', grabando: 'Grabando', procesando: 'Procesando el video…', lista: 'Lista', lista_parcial: 'Lista (llegó al tope)', fallida: 'Falló' };
  function grabacionesHtml(A) {
    if (!A || !Array.isArray(A.grabs)) return '';
    if (!A.grabs.length) return '';
    const dur = (s2) => s2 ? `${Math.floor(s2 / 60)} min ${s2 % 60} s` : '—';
    return `<div class="sj-card sj-pn sj-grabs"><div class="sj-ph">${ico('cam')}<b>Grabaciones de la reunión</b></div>${A.grabs.map((g) => `<div class="sj-grab">
      <div><b>${esc(new Date(g.inicio).toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</b> · ${esc(ESTADO_G[g.estado] || g.estado)} · ${dur(g.duracionSeg)}${g.bytes ? ` · ${(g.bytes / 1048576).toFixed(1)} MB` : ''}
      <small>Presentes al iniciar: ${(g.presentes || []).map((u) => esc(funda(u).nombre)).join(', ') || '—'}${g.error ? ` · ${esc(g.error)}` : ''}</small></div>
      ${g.reproducible ? `<div class="sj-grab-a"><button type="button" class="sj-btn sj-mini" data-sj="grabVer" data-id="${esc(A.id)}" data-g="${esc(g.id)}">${ico('play')}Reproducir</button>${CFG.embebida && typeof CFG.descargar !== 'function' ? '' : `<button type="button" class="sj-btn sj-sec sj-mini" data-sj="grabBajar" data-id="${esc(A.id)}" data-g="${esc(g.id)}">Descargar</button>`}</div>` : ''}
      ${A.video && A.video.g === g.id ? `<video class="sj-grab-v" controls playsinline preload="metadata" src="${esc(A.video.url)}"></video><small>El enlace vence en 15 minutos.</small>` : ''}</div>`).join('')}</div>`;
  }
  function actaHtml() {
    const A = st.acta; if (!A) return '';
    if (A.cargando) return `<div class="sj-card sj-pn"><p class="sj-p">Cargando acta…</p></div>`;
    if (A.error) return `<div class="sj-card sj-pn"><p class="sj-p">${esc(A.error)}</p></div>`;
    const r = A.reunion, a = A.acta, mod = st.data.permisos.moderar, yo = st.data.yo.id;
    const grabsHtml = grabacionesHtml(A);
    const cabA = `<div class="sj-ph">${ico('doc')}<b>${esc(r.titulo)}</b>${pill(r.estado)}</div>
      <div class="sj-acta-meta"><span>${ico('cal')}${esc(new Date(r.inicioMs).toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Tegucigalpa' }))}</span>
      <span>${ico('reloj')}${A.duracionMin != null ? `Duración ${A.duracionMin} min` : 'Duración no registrada'}</span>
      <span>${ico('grupo')}Asistieron: ${A.asistentes.length ? A.asistentes.map((u) => esc(funda(u).nombre)).join(', ') : 'sin registro de entrada'}</span>${A.grabada ? `<span>${ico('reloj')}Grabada (${Math.round(A.grabacionSeg / 60)} min) · el video quedó en el equipo de Naara</span>` : ''}</div>`;
    if (A.editar && mod) {
      const k = (a && a.acuerdos && a.acuerdos.length ? a.acuerdos : [{ id: 'a1', texto: '', responsable: '', fecha: '' }]);
      const opR = (sel) => `<option value="">Responsable…</option>` + (r.participantes || []).map((u) => `<option value="${u}"${u === sel ? ' selected' : ''}>${esc(funda(u).nombre)}</option>`).join('');
      return `<form class="sj-card sj-pn sj-form" id="sjActaF" novalidate>${cabA}
        <label class="sj-f"><span>Resumen de la reunión</span><textarea name="resumen" rows="5" maxlength="4000" placeholder="Qué se habló, en pocas líneas">${esc(a ? a.resumen : '')}</textarea></label>
        <label class="sj-f"><span>Decisiones (una por línea)</span><textarea name="decisiones" rows="4" maxlength="6000" placeholder="Ej.: Subir el precio de Netflix a L300 desde diciembre">${esc(a ? (a.decisiones || []).join('\n') : '')}</textarea></label>
        <div class="sj-f"><span>Acuerdos y tareas</span></div>
        <div id="sjAcuerdos">${k.map((x) => `<div class="sj-acu-f" data-k="${esc(x.id)}" data-e="${x.estado || 'pendiente'}"><input name="kt" maxlength="300" placeholder="Tarea" value="${esc(x.texto)}"><select name="kr">${opR(x.responsable)}</select><input type="date" name="kf" value="${esc(x.fecha || '')}"><button type="button" class="sj-btn sj-sec sj-mini" data-sj="acuQuitar" aria-label="Quitar">${ico('x')}</button></div>`).join('')}</div>
        <button type="button" class="sj-btn sj-sec sj-mini" data-sj="acuMas">+ Agregar acuerdo</button>
        <div class="sj-form-acc"><button type="submit" class="sj-btn sj-rojo sj-grande">${ico('check')}Guardar acta</button>${a ? `<button type="button" class="sj-btn sj-sec" data-sj="actaCancelar">Cancelar</button>` : ''}</div></form>`;
    }
    if (!a) return `<div class="sj-card sj-pn">${cabA}<p class="sj-p">La anfitriona todavía no ha escrito el acta de esta reunión.</p></div>${grabsHtml}`;
    const acu = (a.acuerdos || []).map((x) => { const puede = x.responsable === yo || mod; return `<li class="sj-acu ${x.estado === 'cumplido' ? 'sj-acu-ok' : ''}"><label><input type="checkbox" data-sj="acuEstado" data-k="${esc(x.id)}" ${x.estado === 'cumplido' ? 'checked' : ''} ${puede ? '' : 'disabled'}><span><b>${esc(x.texto)}</b><small>${esc(funda(x.responsable).nombre)}${x.fecha ? ' · para el ' + esc(x.fecha.split('-').reverse().join('/')) : ''}${x.estado === 'cumplido' ? ' · cumplido' : ''}</small></span></label></li>`; }).join('');
    return `<div class="sj-card sj-pn sj-acta">${cabA}
      ${a.resumen ? `<h4>Resumen</h4><p class="sj-p sj-pre">${esc(a.resumen)}</p>` : ''}
      ${(a.decisiones || []).length ? `<h4>Decisiones</h4><ul class="sj-dec">${a.decisiones.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
      ${(a.acuerdos || []).length ? `<h4>Acuerdos y tareas</h4><ul class="sj-acus">${acu}</ul>` : ''}
      <p class="sj-hint">Actualizada ${esc(new Date(a.actualizadoAt).toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa' }))} por ${esc(funda(a.actualizadoPor).nombre)}.</p>
      ${mod ? `<div class="sj-form-acc"><button type="button" class="sj-btn sj-sec" data-sj="actaEditar">Editar acta</button></div>` : ''}</div>${grabsHtml}`;
  }
  async function guardarActa(f) {
    if (st.guardando) return; const A = st.acta;
    const filas = [...f.querySelectorAll('.sj-acu-f')].map((d) => ({ id: d.dataset.k, texto: d.querySelector('[name=kt]').value, responsable: d.querySelector('[name=kr]').value, fecha: d.querySelector('[name=kf]').value, estado: d.dataset.e }));
    const body = { accion: 'acta_guardar', id: A.id, version: A.acta ? A.acta.version : 0, resumen: f.resumen.value, decisiones: f.decisiones.value.split('\n'), acuerdos: filas.filter((x) => x.texto.trim()) };
    st.guardando = 'acta';
    try { const j = await api(body); st.acta = { ...A, acta: j.acta, editar: false }; toast('Acta guardada.'); cargarActas(); }
    catch (e) { toast(e.message, true); }
    finally { st.guardando = ''; }
    pintar();
  }

  // ---------- formulario ----------
  function formulario(embebido) {
    const r = st.editar || { titulo: '', fecha: '', hora: '', agenda: [], participantes: ['naara', 'libni', 'geisell'], recordatorios: { h24: true, h1: true, m10: true }, duracionMin: 60 };
    const ed = !!r.id;
    const parts = st.data.fundadoras.map((f) => `<label class="sj-part"><input type="checkbox" name="sjPart" value="${f.id}" ${r.participantes.includes(f.id) ? 'checked' : ''} ${f.anfitriona ? 'disabled' : ''}>${cara(f.id, 34)}<span><b>${esc(f.nombre)} ${f.anfitriona ? ico('corona', 'sj-corona') : ''}</b><small>${esc(f.anfitriona ? 'Anfitriona · Super Admin' : f.invitado ? (f.cargo || 'Invitado') : 'Socia fundadora')}</small><small class="sj-perm">${f.anfitriona ? 'Modera, da la palabra, graba y cierra la sala' : 'Voz, cámara, chat, mano y presentar'}</small>${(() => { if (f.anfitriona) return ''; const t = (st.data.telegram || {})[f.id]; return t ? `<small class="sj-tgchip sj-tg-${t.estado === 'listo' ? 'listo' : 'pend'}">Telegram: ${t.estado === 'listo' ? 'LISTO' : t.estado === 'bloqueado' ? 'BLOQUEADO' : 'PENDIENTE · sin vincular'}</small>` : ''; })()}</span></label>`).join('');
    const rec = [['h24', '24 horas antes'], ['h1', '1 hora antes'], ['m10', '10 minutos antes']].map(([k, t]) => `<label class="sj-rec">${ico('campana')}<span>${t}</span><input type="checkbox" role="switch" class="sj-sw" name="sjRec" value="${k}" ${r.recordatorios[k] !== false ? 'checked' : ''}></label>`).join('');
    return `<form class="sj-card sj-pn sj-form" id="sjForm" novalidate>
      <div class="sj-ph">${ico('calPlus')}<b>${ed ? 'Editar convocatoria' : 'Crear nueva convocatoria'}</b>${ed ? pill(r.estado) : ''}</div>
      <div class="sj-form-g">
        <img class="sj-form-img" src="/assets/sala/sala-escenario-c.webp" alt="" loading="lazy">
        <div class="sj-form-c">
          <label class="sj-f"><span>Título de la reunión *</span><input name="titulo" maxlength="120" required value="${esc(r.titulo)}" placeholder="Ej.: Revisión mensual y próximos objetivos"></label>
          <div class="sj-f2"><label class="sj-f"><span>Fecha *</span><input type="date" name="fecha" value="${esc(r.fecha || ahoraHN().fecha)}" required></label>
            <div class="sj-f"><span>Hora (Honduras) *</span>${campoHora(r.hora)}</div></div>
          <label class="sj-f"><span>Tipo de sesión</span><select name="tipo" data-sj-tipo="1">${TIPOS.map(([k, t]) => `<option value="${k}"${(r.tipo || 'junta') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="sj-f"><span>Duración</span><select name="duracionMin">${[15, 30, 45, 60, 90, 120].map((m) => `<option value="${m}"${Number(r.duracionMin) === m ? ' selected' : ''}>${m < 60 ? m + ' minutos' : (m / 60) + (m === 60 ? ' hora' : ' horas')}</option>`).join('')}</select></label>
          <div id="sjEscCampos">${escenarioCampos(r)}</div>
          <label class="sj-f"><span>Agenda / Temas a tratar * <small>(un tema por línea)</small></span><textarea name="agenda" rows="4" placeholder="Resultados de ventas del mes&#10;Campañas y promociones&#10;Objetivos y responsables">${esc((r.agenda || []).join('\n'))}</textarea></label>
        </div>
        <div class="sj-form-d"><b class="sj-sub">¿Con quién es la reunión?</b><p class="sj-hint">Marque a quién invita. Naara siempre entra como anfitriona.</p>${parts}<p class="sj-hint">${st.data.fundadoras.some((f) => f.invitado) ? 'Las personas marcadas "Invitado" tienen el módulo Sala de Juntas activado; reciben la convocatoria en Sublichat (Telegram solo llega a las fundadoras).' : '¿Falta alguien? Sublicuentas activa el módulo "Sala de Juntas" a cualquier usuario en Permisos y aparece aquí.'}</p>
          <b class="sj-sub">Recordatorios automáticos (Telegram)</b>${rec}
          <p class="sj-hint">Hora de Honduras (UTC-6). Al programar, cada invitada recibe la convocatoria por Telegram con botones Confirmar / No asistiré.</p></div>
      </div>
      <div class="sj-form-acc">
        <button type="button" class="sj-btn sj-sec" data-sj="${embebido ? 'limpiar' : 'inicio'}">Cancelar</button>
        <button type="button" class="sj-btn sj-sec" data-sj="borrador">${ico('guardar')}Guardar borrador</button>
        ${ed && r.estado !== 'borrador' ? `<button type="button" class="sj-btn sj-peligro" data-sj="cancelarReu" data-id="${r.id}">Cancelar reunión</button>` : ''}
        <button type="submit" class="sj-btn sj-rojo sj-grande">${ico('enviar')}${ed && r.estado !== 'borrador' ? 'Guardar y reprogramar' : 'Programar y enviar convocatoria'}</button>
      </div></form>`;
  }
  // R174 · escenario y estilo de la convocatoria
  // R178 · hora sin confusión: hora 1–12, minutos 00–59 y a. m./p. m. explícito (el reloj nativo mostraba 24 h en algunos navegadores)
  const ahoraHN = () => { const d = new Date(Date.now() - 6 * 3600000); const p = (n) => String(n).padStart(2, '0'); return { fecha: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`, h: d.getUTCHours(), m: d.getUTCMinutes() }; };
  function campoHora(hhmm) {
    let h, m; if (/^\d{2}:\d{2}$/.test(hhmm || '')) [h, m] = hhmm.split(':').map(Number); else { const a = ahoraHN(); h = a.h; m = a.m; } // nueva: sugiere la hora actual (se puede cambiar)
    const h12 = ((h + 11) % 12) + 1, pm = h >= 12; const p = (n) => String(n).padStart(2, '0');
    return `<div class="sj-hora" role="group" aria-label="Hora de la reunión"><select name="h12" aria-label="Hora">${Array.from({ length: 12 }, (_, i) => i + 1).map((x) => `<option value="${x}"${x === h12 ? ' selected' : ''}>${x}</option>`).join('')}</select><b>:</b>
      <select name="min" aria-label="Minutos">${Array.from({ length: 60 }, (_, i) => i).map((x) => `<option value="${x}"${x === m ? ' selected' : ''}>${p(x)}</option>`).join('')}</select>
      <select name="ampm" aria-label="a. m. o p. m."><option value="am"${pm ? '' : ' selected'}>a. m.</option><option value="pm"${pm ? ' selected' : ''}>p. m.</option></select>
      <button type="button" class="sj-btn sj-sec sj-mini" data-sj="horaAhora" title="Poner fecha y hora de este momento">Ahora</button>
      <input type="hidden" name="hora" value="${p(h)}:${p(m)}"></div>`;
  }
  function syncHora(f) { const q = (n) => f.querySelector(`[name="${n}"]`); if (!q('h12')) return; let h = Number(q('h12').value) % 12; if (q('ampm').value === 'pm') h += 12; q('hora').value = `${String(h).padStart(2, '0')}:${String(q('min').value).padStart(2, '0')}`; }
  // R177 · tipo de sesión: sugiere escenario y estilo (se pueden cambiar)
  const TIPOS = [['junta', 'Junta', 'socios', 'junta'], ['revision', 'Revisión', 'sala-c', 'sobria'], ['clase', 'Clase / capacitación', 'aula', ''], ['presentacion', 'Presentación', 'sala-c', 'presentacion'], ['grabacion', 'Grabación de anuncio', 'live', 'grabacion'], ['otra', 'Otra', '', '']];
  function escenarioCampos(r) {
    const C = st.escCat; if (!C) return '';
    const id = st.formEsc || r.escenario || 'sala-c'; const D = (st.esc || {})[id] || { presets: [] };
    const elegido = st.formSug !== undefined && st.formSug !== null ? st.formSug : (r.escenario === id || !r.escenario ? (r.presetId || (r.sugerido ? 's:' + r.sugerido : '')) : '');
    const presets = D.presets.map((p) => `<option value="${p.id}"${p.id === elegido ? ' selected' : ''}>${esc(p.nombre)}${p.id === D.predeterminado ? ' (oficial)' : ''}</option>`).join('');
    const sug = (st.escM?.SUGERIDOS || []).map(([k, n]) => `<option value="s:${k}"${'s:' + k === elegido ? ' selected' : ''}>${esc(n)}</option>`).join('');
    const tipo = TIPOS.find(([k]) => k === (st.formTipo || r.tipo)) || null;
    const nota = tipo && tipo[2] ? `<p class="sj-hint sj-sug-nota">${ico('check')}Para <b>${esc(tipo[1])}</b> se sugiere <b>${esc(C[tipo[2]].corto)}</b>${tipo[3] ? ` con estilo <b>${esc((st.escM.SUGERIDOS.find(([k]) => k === tipo[3]) || [])[1] || '')}</b>` : ''}. Puede cambiarlo.</p>` : '';
    return `<div class="sj-f2"><label class="sj-f"><span>Escenario</span><select name="escenario" data-sj-esc="1">${Object.entries(C).map(([k, x]) => `<option value="${k}"${k === id ? ' selected' : ''}>${esc(x.corto)}</option>`).join('')}</select></label>
      <label class="sj-f"><span>Estilo</span><select name="presetId"><option value="">${D.predeterminado ? 'Oficial del escenario' : 'Estilo base aprobado'}</option>${presets ? `<optgroup label="Estilos guardados">${presets}</optgroup>` : ''}${sug ? `<optgroup label="Estilos sugeridos">${sug}</optgroup>` : ''}</select></label></div>${nota}`;
  }
  function leerForm() {
    const f = document.getElementById('sjForm'); const q = (n) => f.querySelector(`[name="${n}"]`);
    const rec = {}; f.querySelectorAll('[name="sjRec"]').forEach((x) => { rec[x.value] = x.checked; });
    syncHora(f);
    return { titulo: q('titulo').value, fecha: q('fecha').value, hora: q('hora').value, duracionMin: Number(q('duracionMin').value), agenda: q('agenda').value,
      participantes: ['naara', ...[...f.querySelectorAll('[name="sjPart"]:checked')].map((x) => x.value)], recordatorios: rec,
      escenario: q('escenario') ? q('escenario').value : 'sala-c', ...(() => { const v = q('presetId') ? q('presetId').value : ''; return v.startsWith('s:') ? { presetId: '', sugerido: v.slice(2) } : { presetId: v, sugerido: '' }; })(),
      tipo: q('tipo') ? q('tipo').value : 'junta' };
  }
  async function guardar(borrador) {
    if (st.guardando) return; // evita doble clic
    const datos = leerForm(); const ed = st.editar && st.editar.id;
    st.guardando = 'form'; marcarOcupado(true);
    try {
      const r = await api({ ...datos, accion: ed ? 'editar' : 'crear', id: ed || undefined, borrador });
      const inc = (r && r.envioIncompleto) || [];
      toast(borrador ? 'Borrador guardado.' : inc.length ? `Convocatoria guardada. Envío INCOMPLETO: ${inc.map(nomVis).join(', ')} no tiene${inc.length > 1 ? 'n' : ''} Telegram vinculado.` : (ed ? 'Reunión reprogramada. Las invitadas deben confirmar de nuevo si cambió la hora.' : 'Convocatoria programada. Sale por Telegram a todas las personas; el estado de cada una aparece en la reunión.'), !!inc.length);
      st.editar = null; st.formEsc = ''; st.formSug = null; st.formTipo = ''; st.vista = 'inicio'; st.guardando = ''; await cargar(true, true);
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
    const puedeEntrar = tr && (r.salaAbierta || st.data.permisos.moderar) && ['programada', 'en_curso'].includes(r.estado);
    const motivo = !tr ? 'El audio en tiempo real todavía no está configurado en el servidor.' : !r.salaAbierta ? (st.data.permisos.moderar ? 'Al entrar, la sala se abre para las demás.' : 'Esperando que la anfitriona abra la sala.') : '';
    const miAv = st.data.avatares?.[yo.id] || {};
    let avatar = miAv.miniatura || ''; if (!avatar) { try { avatar = window.SublichatRBAC?.avatar?.() || ''; } catch (_) {} }
    return `<div class="sj-card sj-pn sj-ante">
      <div class="sj-ph">${ico('grupo')}<b>Antesala virtual</b>${embebido ? '' : `<button class="sj-btn sj-sec sj-mini sj-der-btn" data-sj="inicio">${ico('atras')}Volver</button>`}</div>
      <div class="sj-ante-g">
        <div class="sj-ante-av${miAv.guardado ? ' sj-ante-ok' : ''}">${avatar ? `<img src="${esc(avatar)}" alt="Su personaje">` : ''}<span>${miAv.guardado ? 'Su personaje 3D está listo.' : 'Todavía no ha creado su personaje 3D.'} <button class="sj-btn sj-sec sj-mini" data-sj="personajeAnte">${miAv.guardado ? 'Cambiar' : 'Crear mi personaje'}</button></span></div>
        <div class="sj-ante-c"><b class="sj-ante-tit">Reunión: ${esc(r.titulo)}</b>${st.escCat ? `<small class="sj-ante-esc">${ico('pantalla')}${esc(st.escCat[r.escenario || 'sala-c']?.nombre || '')}${(() => { const e = estiloDeReunion(r); return e.nombre ? ' · ' + esc(e.nombre) : ''; })()}</small>` : ''}
          <div class="sj-meta sj-meta-col"><span>${ico('cal')}${esc(fechaLarga(r))}</span><span>${ico('reloj')}${esc(horaHN(r))} (Honduras)</span><span>${ico('grupo')}Participantes (${r.participantes.length})</span></div>
          <div class="sj-listo ${todoOk ? 'sj-listo-ok' : ''}"><b>${todoOk ? ico('check') + 'Todo listo para ingresar' : 'Revise su micrófono y audio'}</b><div class="sj-disps">${dispo}</div>
            ${st.mic.estado === 'activo' ? '<div class="sj-nivel" aria-label="Nivel del micrófono"><i id="sjNivel"></i></div>' : ''}
            ${st.mic.estado === 'denegado' ? '<p class="sj-hint">El navegador bloqueó el micrófono. Toque el candado junto a la dirección, permita "Micrófono" y vuelva a probar. Puede entrar como oyente.</p>' : ''}
            <button class="sj-btn sj-sec sj-mini" data-sj="probar">${ico('play')}Probar audio y micrófono</button></div>
        </div>
        <div class="sj-ante-p"><b class="sj-sub">Participantes (${r.participantes.length})</b>${r.participantes.map((u) => { const e = (r.invitaciones || {})[u]?.estado || 'pendiente', x = RSVP[e]; return `<div class="sj-pp">${cara(u, 36)}<span><b>${esc(funda(u).nombre)}${u === yo.id ? ' (Tú)' : ''}</b><small class="sj-dot sj-${x[1]}">${x[0]}</small></span>${u === 'naara' ? ico('corona', 'sj-corona') : ''}</div>`; }).join('')}
          ${mia.estado === 'pendiente' && yo.id !== 'naara' ? `<div class="sj-fila-btn"><button class="sj-btn sj-ok sj-mini" data-sj="rsvp" data-id="${r.id}" data-r="aceptada">Confirmar</button><button class="sj-btn sj-sec sj-mini" data-sj="rsvp" data-id="${r.id}" data-r="rechazada">No asistiré</button></div>` : ''}
        </div>
      </div>
      ${esperaHtml(r)}
      <div class="sj-ante-acc"${st.espera && st.espera.id === r.id ? ' hidden' : ''}>
        <button class="sj-btn sj-rojo sj-grande" data-sj="entrar" data-id="${r.id}" ${puedeEntrar ? '' : 'disabled'}>${ico('sala')}Entrar a la Sala de Juntas 3D</button>
        <button class="sj-btn sj-sec" data-sj="verSala" data-id="${r.id}">${ico('play')}Ver la sala 3D (vista previa)</button>
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
    return `<div class="sj-dos"><div class="sj-card sj-pn"><div class="sj-ph">${ico('grupo')}<b>Acceso</b></div><p class="sj-p">Entran las socias fundadoras y los usuarios a quienes Sublicuentas les active el módulo "Sala de Juntas" en Permisos. Nadie más puede abrirla aunque tenga un enlace reenviado; solo ven las reuniones a las que están invitados.</p>
        ${d.fundadoras.map((f) => `<div class="sj-pp">${cara(f.id, 36)}<span><b>${esc(f.nombre)}</b><small>${esc(f.cargo)}${f.asiento ? ' · asiento ' + esc(f.asiento) : ''}</small></span>${f.anfitriona ? ico('corona', 'sj-corona') : ''}</div>`).join('')}</div>
      <div class="sj-card sj-pn"><div class="sj-ph">${ico('config')}<b>Estado de la sala</b></div>
        <div class="sj-estado"><span>Escenario</span><b>C · Cálida Ejecutiva</b></div>
        <div class="sj-estado"><span>Zona horaria</span><b>Honduras (UTC-6)</b></div>
        <div class="sj-estado"><span>Invitaciones y recordatorios Telegram</span><b class="sj-verde-t">Activos (24 h · 1 h · 10 min · inicio)</b></div>
        <div class="sj-estado"><span>Personajes 3D</span><b class="sj-verde-t">${Object.values(d.avatares || {}).filter((x) => x.guardado).length} de 3 guardados</b></div>
        <div class="sj-estado"><span>Audio en tiempo real (LiveKit)</span><b class="${d.tiempoReal ? 'sj-verde-t' : 'sj-ambar-t'}">${d.tiempoReal ? 'Configurado' : 'Fase 4 · falta configurar'}</b></div></div></div>`;
  }
  // ---------- R169 · Mi personaje (editor 3D) ----------
  const ETQ = {
    genero: { mujer: 'Mujer', hombre: 'Hombre' },
    cabello: { melena: 'Melena', recogido: 'Recogido', lacio: 'Lacio', corto: 'Corto moderno', ondulado: 'Ondulado', largo: 'Largo', clasico: 'Clásico', moderno: 'Moderno', rizado: 'Rizado', largoMedio: 'Largo medio', conBarba: 'Con barba', cresta: 'Cresta' },
    superior: { blazer: 'Blazer', blusa: 'Blusa', vestido: 'Vestido', camiseta: 'Camiseta', chaqueta: 'Chamarra', traje: 'Traje', sueter: 'Suéter', chaleco: 'Chaleco' },
    inferior: { pantalon: 'Pantalón formal', falda: 'Falda', casual: 'Pantalón casual', jeans: 'Jeans', shorts: 'Shorts' },
    calzado: { formal: 'Formal', tacon: 'Tacones', casual: 'Casual', botas: 'Botas', tenis: 'Tenis' },
  };
  // R172 · piezas por base (mismas listas que api/_sala-juntas.js · AVATAR_GENERO)
  const PIEZAS = {
    mujer: { cabello: ['melena', 'recogido', 'lacio', 'corto', 'ondulado', 'largo'], superior: ['blazer', 'blusa', 'vestido', 'camiseta', 'chaqueta'], inferior: ['pantalon', 'falda', 'casual'], calzado: ['formal', 'tacon', 'casual', 'botas'] },
    hombre: { cabello: ['clasico', 'moderno', 'rizado', 'largoMedio', 'conBarba', 'cresta'], superior: ['traje', 'sueter', 'camiseta', 'chaleco'], inferior: ['pantalon', 'jeans', 'shorts'], calzado: ['formal', 'tenis', 'casual'] },
  };
  const CON_INTERIOR = ['blazer', 'traje'];
  const ACC = [['lentes', 'Lentes'], ['aretes', 'Aretes'], ['collar', 'Collar'], ['reloj', 'Reloj'], ['barba', 'Bigote'], ['logo', 'Logo Sublicuentas en la ropa']];
  let M3 = null, ed3 = null, sala3 = null;
  async function modulo3D() {
    if (M3) return M3;
    M3 = await import('/sala-3d.js?v=20261106-r183');
    return M3;
  }
  function desmontar3D() { if (esc3) { try { esc3.destruir(); } catch (_) {} esc3 = null; } if (ed3) { try { ed3.destruir(); } catch (_) {} ed3 = null; } if (sala3) { try { sala3.destruir(); } catch (_) {} sala3 = null; } }
  const OPC = { genero: ['mujer', 'hombre'], piel: ['#F6D7C3', '#EFC3A4', '#E2A982', '#C98E66', '#A86F4C', '#7E5136', '#5A3825'], colorCabello: ['#1E1A18', '#3B2A20', '#6B4226', '#A0703F', '#D8B26E', '#8C8C8C', '#9E2B25'], ojos: ['#4A2E1F', '#2F5D3A', '#2F4E7A', '#1E1A18'], colorSuperior: ['#C62828', '#1F2430', '#FFFFFF', '#2B4C7E', '#5E6B7A', '#7A1F2B', '#E8E1D5'], colorInterior: ['#FFFFFF', '#1F2430', '#E8E1D5', '#C62828'], colorInferior: ['#1F2430', '#3E4A5C', '#5E4A3A', '#2B2B2B', '#C7B9A3'], colorCalzado: ['#1A1A1A', '#5E3B24', '#FFFFFF', '#7A1F2B'] };
  const opcDe = (k, c) => (PIEZAS[c.genero === 'hombre' ? 'hombre' : 'mujer'][k] || OPC[k]);
  function personaje() {
    const yo = st.data.yo.id, av = st.data.avatares?.[yo] || { config: {}, version: 0 };
    if (!st.pers) st.pers = { config: { ...av.config }, version: av.version, tab: 'apariencia' };
    const c = st.pers.config, tab = st.pers.tab;
    const fila = (t, html) => `<div class="sj-op"><b>${t}</b><div class="sj-op-v">${html}</div></div>`;
    const chips = (k) => opcDe(k, c).map((v) => `<button type="button" class="sj-chip-op${c[k] === v ? ' on' : ''}" data-op="${k}" data-v="${v}" aria-pressed="${c[k] === v}">${esc((ETQ[k] || {})[v] || v)}</button>`).join('');
    const colores = (k) => OPC[k].map((v) => `<button type="button" class="sj-sw-col${c[k] === v ? ' on' : ''}" style="--c:${v}" data-op="${k}" data-v="${v}" aria-label="Color ${v}" aria-pressed="${c[k] === v}"></button>`).join('');
    let panel = '';
    const nomDef = funda(yo).nombre || yo;
    if (tab === 'apariencia') panel = `<label class="sj-op sj-op-nom"><b>Nombre visible</b><input type="text" id="sjNomVis" maxlength="24" autocomplete="off" placeholder="${esc(nomDef)}" value="${esc(c.nombre || '')}" aria-describedby="sjNomAyuda"><small id="sjNomAyuda">Se ve sobre su personaje y en la lista de participantes. Vacío = ${esc(nomDef)}.</small></label>` + fila('Género', chips('genero')) + fila('Tono de piel', colores('piel')) + fila('Estilo de cabello', chips('cabello')) + fila('Color de cabello', colores('colorCabello')) + fila('Color de ojos', colores('ojos'));
    if (tab === 'ropa') panel = fila('Parte de arriba', chips('superior')) + fila('Color', colores('colorSuperior')) + (CON_INTERIOR.includes(c.superior) ? fila('Camisa interior', colores('colorInterior')) : '') + fila('Parte de abajo', chips('inferior')) + fila('Color', colores('colorInferior')) + fila('Calzado', chips('calzado')) + fila('Color del calzado', colores('colorCalzado'));
    if (tab === 'accesorios') panel = ACC.filter(([k]) => k !== 'barba' || c.genero === 'hombre').map(([k, t]) => `<label class="sj-rec sj-acc-op"><span>${t}</span><input type="checkbox" role="switch" class="sj-sw" data-op="${k}" ${c[k] ? 'checked' : ''}></label>`).join('');
    const tabs = [['apariencia', 'Apariencia', 'persona'], ['ropa', 'Ropa', 'lista'], ['accesorios', 'Accesorios', 'check']].map(([k, t, i]) => `<button type="button" class="sj-tab${tab === k ? ' on' : ''}" data-sj="tabPers" data-t="${k}" role="tab" aria-selected="${tab === k}">${ico(i)}${t}</button>`).join('');
    return `<div class="sj-card sj-pn sj-editor">
      <div class="sj-ed-h"><span class="sj-ed-tit">${ico('persona')}<b>Mi Personaje</b> <small>(Avatar)</small></span><div class="sj-tabs" role="tablist">${tabs}</div></div>
      <div class="sj-ed-g">
        <div class="sj-ed-mini">${av.miniatura ? `<img src="${esc(av.miniatura)}" alt="Personaje guardado">` : '<div class="sj-ed-vacio">Aún no ha guardado su personaje</div>'}<small>${av.guardado ? `Guardado · versión ${av.version}` : 'Sin guardar'}</small></div>
        <div class="sj-ed-op" id="sjOps">${panel}</div>
        <div class="sj-ed-3d"><canvas id="sjEdCanvas" aria-label="Vista 360° de su personaje. Arrastre para girar."></canvas><span class="sj-ed-nom" id="sjEdNom">${esc((c.nombre || '').trim() || nomDef)}</span>
          <button type="button" class="sj-rot sj-rot-i" data-sj="rotar" data-d="-0.6" aria-label="Girar a la izquierda">‹</button><button type="button" class="sj-rot sj-rot-d" data-sj="rotar" data-d="0.6" aria-label="Girar a la derecha">›</button>
          <div class="sj-ed-cam" role="group" aria-label="Cámara del personaje">${[['frente', 'Frente'], ['lado', 'Lateral'], ['tresCuartos', '3/4'], ['espalda', 'Espalda']].map(([v, t]) => `<button type="button" data-sj="vistaPers" data-v="${v}">${t}</button>`).join('')}<button type="button" data-sj="giro360" aria-pressed="false">360°</button><span class="sj-ed-sep"></span>${[['rostro', 'Rostro'], ['torso', 'Torso'], ['cuerpo', 'Cuerpo']].map(([v, t]) => `<button type="button" data-sj="enfoquePers" data-v="${v}">${t}</button>`).join('')}<button type="button" data-sj="zoomPers" data-d="0.6" aria-label="Acercar">+</button><button type="button" data-sj="zoomPers" data-d="-0.6" aria-label="Alejar">−</button><button type="button" data-sj="camReset" aria-label="Restablecer cámara">↺</button></div>
          <div class="sj-ed-carga" id="sjEdCarga">Cargando 3D…</div></div>
      </div>
      <div class="sj-form-acc sj-ed-acc">
        <button type="button" class="sj-btn sj-rojo sj-grande" data-sj="guardarPers">${ico('check')}Guardar personaje</button>
        <button type="button" class="sj-btn sj-sec" data-sj="verSalaPers">${ico('play')}Vista previa en sala</button>
        <button type="button" class="sj-btn sj-sec" data-sj="restablecer">Restablecer</button>
      </div></div>`;
  }
  async function montarEditor3D() {
    const cv = document.getElementById('sjEdCanvas'); if (!cv) return;
    try {
      const M = await modulo3D(); if (!document.getElementById('sjEdCanvas')) return;
      if (!M.soportaWebGL()) throw new Error('Este navegador no puede mostrar 3D (WebGL). Pruebe con Chrome actualizado.');
      const c0 = document.getElementById('sjEdCarga'); if (c0) c0.textContent = 'Cargando su personaje 3D…';
      ed3 = M.montarEditor(cv, st.pers.config);
      await ed3.listo;
      const c = document.getElementById('sjEdCarga'); if (c) c.remove();
      if (ed3.respaldo && ed3.respaldo()) toast('No se pudo cargar el modelo 3D; se muestra la versión simple. Revise su internet.', true);
    } catch (e) { const c = document.getElementById('sjEdCarga'); if (c) c.textContent = e.message || 'No se pudo cargar el 3D.'; }
  }
  function cambiarOpcion(k, v) {
    const c = st.pers.config;
    if (['lentes', 'aretes', 'reloj', 'barba', 'logo'].includes(k)) c[k] = !!v; else c[k] = v;
    if (k === 'genero') { if (v === 'mujer') c.barba = false; const P = PIEZAS[v === 'hombre' ? 'hombre' : 'mujer']; for (const s of ['cabello', 'superior', 'inferior', 'calzado']) if (!P[s].includes(c[s])) c[s] = P[s][0]; }
    if (ed3) ed3.set(c);
    const necesitaRepintar = k === 'superior' || k === 'genero';
    if (necesitaRepintar) { const ops = document.getElementById('sjOps'); if (ops) { const t = document.createElement('div'); t.innerHTML = personaje(); ops.innerHTML = t.querySelector('#sjOps').innerHTML; } return; }
    document.querySelectorAll(`#sjOps [data-op="${k}"]`).forEach((b) => { if (b.type === 'checkbox') return; const on = b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }
  async function guardarPersonaje() {
    if (st.guardando) return; st.guardando = 'pers';
    const btn = host.querySelector('[data-sj="guardarPers"]'); if (btn) btn.disabled = true;
    try {
      const miniatura = ed3 ? ed3.miniatura() : '';
      const r = await api({ accion: 'avatar_guardar', config: st.pers.config, version: st.pers.version, miniatura });
      st.data.avatares[st.data.yo.id] = { config: r.config, version: r.version, miniatura, guardado: true };
      st.pers = null; st.guardando = '';
      toast('Personaje guardado. Lo verá igual en cualquier navegador.');
      if (st.volverAnte && st.ante) { st.volverAnte = false; st.vista = 'antesala'; } else st.vista = 'personaje';
      pintar();
    } catch (e) { st.guardando = ''; if (btn) btn.disabled = false; toast(e.message, true); }
  }

  // ---------- R169 · Sala 3D (vista previa, sin audio hasta la Fase 4) ----------
  function sala3dHtml() {
    const r = st.sala3dReu, parts = r ? r.participantes : ['naara', 'libni', 'geisell'];
    const V = st.vivo;
    const ctr = V ? [['lkMic', 'mic', 'Micrófono'], ['lkCam', 'cam', 'Cámara'], ['lkVer', 'ojo', 'Ver'], ['lkPant', 'pantalla', 'Compartir'], ['lkPresentar', 'doc', 'Presentar'], ['lkMano', 'manoI', 'Mano'], ['lkReac', 'sonrisa', 'Reacciones'], ['lkPart', 'grupo', 'Participantes'], ['lkChat', 'chat', 'Chat'], ['lkAju', 'config', 'Ajustes']]
      .map(([a, i, t]) => `<button type="button" class="sj3d-ctl" data-sj="${a}" id="sj3d-${a}">${ico(i)}<span>${t}</span></button>`).join('') + (st.data.permisos.moderar ? `<button type="button" class="sj3d-ctl" data-sj="lkGrabar" id="sj3d-lkGrabar" title="Graba en este equipo; se avisa a todas">${ico('reloj')}<span>Grabar</span></button>` : `<button type="button" class="sj3d-ctl" disabled title="Solo la anfitriona puede grabar">${ico('reloj')}<span>Grabar</span></button>`)
      : [['mic', 'Micrófono'], ['cam', 'Cámara'], ['doc', 'Compartir'], ['grupo', `Participantes (${parts.length})`], ['lista', 'Chat'], ['check', 'Reacciones'], ['reloj', 'Grabar']]
      .map(([i, t]) => `<button type="button" class="sj3d-ctl" disabled title="Disponible al entrar a la reunión en vivo">${ico(i)}<span>${t}</span></button>`).join('');
    const terminar = V && st.data.permisos.moderar ? `<button type="button" class="sj3d-ctl sj3d-salir sj3d-fin" data-sj="lkTerminar">${ico('x')}<span>Terminar</span></button>` : '';
    const vistas = [...(V ? [['auto', 'Automática', 'Sigue a quien habla']] : []), ['general', 'Vista general', 'Toda la sala'], ...parts.map((u) => [u, `Plano de ${nomVis(u)}`, 'Enfoca a quien habla']), ['presentacion', 'Vista presentación', 'Prioriza la pantalla'], ['panoramica', 'Vista panorámica', 'Recorrido lento de la sala']]
      .map(([v, t, d]) => `<button type="button" class="sj3d-vista${v === (V ? 'auto' : 'general') ? ' on' : ''}" data-sj="vista3d" data-v="${v}"><b>${esc(t)}</b><small>${esc(d)}</small></button>`).join('');
    return `<div class="sj3d${V ? ' sj3d-vivo' : ''}" id="sj3dRaiz">
      <div class="sj3d-top"><img src="/assets/sublicuentas-logo-oscuro-ui.webp" alt="Sublicuentas"><span class="sj3d-sep"></span><b>SubliStudio <i>3D</i></b><span class="sj3d-sala">${ico('grupo')}Sala de Juntas</span>
        <span class="sj3d-chip" id="sj3dChip">${r ? esc(r.titulo) : 'Vista previa'} · ${V ? '<i class="sj3d-led"></i>En vivo' : 'vista previa sin audio'}</span>
        <button type="button" class="sj3d-full" data-sj="pantallaCompleta" id="sj3dFull" title="Pantalla completa (tecla F)">${ico('expandir')}<span>Pantalla completa</span></button></div>
      <div class="sj3d-g"><div class="sj3d-escena" id="sj3dEscena"><div class="sj-ed-carga" id="sj3dCarga">Cargando Escenario C…</div>
        ${V ? '<div class="sj3d-estado" id="sj3dEstado" hidden></div><div class="sj3d-rec" id="sj3dRec" role="status" aria-live="polite" hidden><i></i>Grabando <b id="sj3dRecT">0:00</b></div><div class="sj3d-videos" id="sj3dVideos"></div><div class="sj3d-panel" id="sj3dPanel" hidden></div><div class="sj3d-pres" id="sj3dPres" hidden></div><input type="file" id="sj3dArchivo" accept="image/png,image/jpeg,image/webp,application/pdf,video/mp4,video/webm" multiple hidden><button type="button" class="sj3d-verpres" data-sj="lkVerPres" id="sj3dVerPres" hidden>' + ico('pantalla') + 'Ver presentación en grande</button><button type="button" class="sj-btn sj-rojo sj3d-audio" data-sj="lkAudio" id="sj3dAudio" hidden>Toque aquí para escuchar la reunión</button>' : ''}</div>
        <aside class="sj3d-vistas"><b>${ico('cam')}Vistas de cámara</b>${vistas}</aside></div>
      <div class="sj3d-barra">${ctr}<button type="button" class="sj3d-ctl sj3d-salir" data-sj="salirSala">${ico('salir')}<span>Salir</span></button>${terminar}</div>
    </div>`;
  }
  async function montarSala3D() {
    const cont = document.getElementById('sj3dEscena'); if (!cont) return;
    try {
      const M = await modulo3D(); if (!document.getElementById('sj3dEscena')) return;
      if (!M.soportaWebGL()) throw new Error('Este equipo no puede mostrar la sala 3D (WebGL). Puede seguir la reunión con audio cuando se habilite.');
      const avatares = { ...(st.data.avatares || {}) };
      if (st.pers) avatares[st.data.yo.id] = { config: st.pers.config }; // vista previa del personaje sin guardar
      if (st.sala3dReu && st.sala3dReu.escenario && st.sala3dReu.escenario !== 'sala-c' && !st.esc) await cargarEscenarios();
      const E = st.sala3dReu ? estiloDeReunion(st.sala3dReu) : { escenario: 'sala-c', estilo: null };
      sala3 = await M.montarSala(cont, { avatares, escenario: E.escenario, estilo: E.estilo, participantes: st.sala3dReu ? st.sala3dReu.participantes : ['naara', 'libni', 'geisell'],
        alCambiarVista: (v) => host.querySelectorAll('.sj3d-vista').forEach((b) => b.classList.toggle('on', b.dataset.v === v)) });
      await sala3.listo;
      const c = document.getElementById('sj3dCarga'); if (c) c.remove();
      if (st.vivo) aplicarVivo3D();
    } catch (e) { const c = document.getElementById('sj3dCarga'); if (c) c.textContent = e.message || 'No se pudo cargar la sala 3D.'; }
  }

  // ---------- R170 · Fase 4: reunión en vivo (LiveKit) ----------
  // st.vivo = { id, ctl, estado, presentes:Set, mics:{}, hablantes:[], auto, chat:[], panel, pantalla:{track,de}, videos:{}, expira }
  // ---------- R181 · sala de espera (invitado que llega tarde) y aprobación exclusiva de Sublicuentas ----------
  let esperaTimer = null;
  function pararEspera() { clearInterval(esperaTimer); esperaTimer = null; }
  function seguirEspera() {
    pararEspera();
    esperaTimer = setInterval(async () => {
      const E = st.espera; if (!E) return pararEspera();
      if (!E.sol || E.sol.estado !== 'pendiente') return;
      try { const j = await api({ accion: 'solicitud_estado', id: E.id, requestId: E.sol.requestId }); if (st.espera !== E) return; E.sol = j.solicitud;
        if (E.sol && E.sol.estado === 'aprobada') { pararEspera(); toast('Sublicuentas aprobó su ingreso.'); st.espera = null; return entrarVivo(E.id); }
        if (!E.sol || E.sol.estado !== 'pendiente') pararEspera();
        pintarEspera(); } catch (_) {}
    }, 3000);
  }
  function esperaHtml(r) {
    const E = st.espera; if (!E || E.id !== r.id) return '';
    const s = E.sol; const est = !s ? 'sin' : s.estado;
    const T = { sin: ['SIN SOLICITAR', 'Pida permiso para entrar. Mientras tanto no puede escuchar ni ver nada de la reunión.'], pendiente: ['ESPERANDO', 'Su solicitud llegó a Sublicuentas. Aún no puede escuchar ni ver contenido privado.'], rechazada: ['RECHAZADA', 'Sublicuentas no aprobó su ingreso a esta reunión.'], vencida: ['VENCIDA', 'Nadie respondió en 2 minutos. Puede solicitar de nuevo.'], expulsado: ['FUERA DE LA SALA', 'La anfitriona lo sacó de esta reunión. Para volver necesita una nueva convocatoria.'] }[est] || ['—', ''];
    const seg = s && s.estado === 'pendiente' ? Math.max(0, Math.round((s.expiraMs - Date.now()) / 1000)) : 0;
    return `<div class="sj-espera" id="sjEspera" role="status" aria-live="polite"><b class="sj-espera-t">${ico('reloj')}La junta ya comenzó</b><p>${esc(T[1])}</p>
      <div class="sj-espera-e"><span>Estado: <b class="sj-est-${est}">${T[0]}</b>${seg ? ` <small>(vence en ${seg} s)</small>` : ''}</span><span>Anfitriona: Sublicuentas</span></div>
      <div class="sj-fila-btn">${['sin', 'rechazada', 'vencida'].includes(est) ? `<button class="sj-btn sj-rojo" data-sj="solicitarIngreso" data-id="${r.id}">${est === 'sin' ? 'Solicitar ingreso' : 'Solicitar de nuevo'}</button>` : ''}<button class="sj-btn sj-sec" data-sj="cancelarEspera">Cancelar</button></div></div>`;
  }
  function pintarEspera() { const el = document.getElementById('sjEspera'); const r = st.ante; if (el && r) el.outerHTML = esperaHtml(r); }
  async function revisarSolicitudes(V) {
    if (st.vivo !== V || V.solOcupado) return; V.solOcupado = true;
    try {
      const j = await api({ accion: 'solicitudes', id: V.id }); if (st.vivo !== V) return;
      const lista = j.solicitudes || []; const antes = new Set((V.sol || []).map((x) => x.requestId)); V.sol = lista;
      lista.filter((x) => !antes.has(x.requestId)).forEach((x) => toast(`🔔 ${x.nombre} pide entrar a la reunión.`));
      let el = document.getElementById('sj3dSol');
      if (!lista.length) { el?.remove(); return; }
      if (!el) { el = document.createElement('div'); el.id = 'sj3dSol'; el.className = 'sj3d-sol'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Solicitudes de acceso'); (document.getElementById('sj3dEscena') || host).appendChild(el); }
      const clave = lista.map((x) => x.requestId).join(',');
      if (el.dataset.clave === clave) { lista.forEach((x) => { const c = el.querySelector(`[data-req="${CSS.escape(x.requestId)}"] .sj3d-sol-vence`); if (c) c.textContent = `vence en ${Math.max(0, Math.round((x.expiraMs - Date.now()) / 1000))} s`; }); return; } // no rehace los botones (no se mueven bajo el dedo)
      el.dataset.clave = clave;
      el.innerHTML = lista.map((x) => `<div class="sj3d-sol-c" data-req="${esc(x.requestId)}"><b>${ico('grupo')}Solicitud de acceso</b><p><b>${esc(nomVis(x.usuario) || x.nombre)}</b> intenta entrar a la reunión iniciada.</p>
        <small>${ico('check')}Identidad verificada · Sala: ${esc(st.sala3dReu?.titulo || '')}</small><small>Estado: solicitud pendiente · <span class="sj3d-sol-vence">vence en ${Math.max(0, Math.round((x.expiraMs - Date.now()) / 1000))} s</span></small>
        <div class="sj-fila-btn"><button class="sj-btn sj-ok sj-mini" data-sj="resolverSol" data-u="${esc(x.usuario)}" data-req="${esc(x.requestId)}" data-ok="1">Aceptar</button><button class="sj-btn sj-sec sj-mini" data-sj="resolverSol" data-u="${esc(x.usuario)}" data-req="${esc(x.requestId)}" data-ok="0">Rechazar</button></div></div>`).join('');
    } catch (_) {} finally { V.solOcupado = false; }
  }
  async function entrarVivo(id) {
    if (st.vivo || st.guardando) return;
    const r = st.ante && st.ante.id === id ? st.ante : (st.data.proxima && st.data.proxima.id === id ? st.data.proxima : null); if (!r) return;
    st.ante = r;
    st.guardando = 'entrar'; detenerMic();
    let j; try { j = await api({ accion: 'token_tiempo_real', id }); } catch (e) { st.guardando = ''; return toast(e.message, true); }
    st.guardando = '';
    if (j.espera) { st.espera = { id, sol: j.solicitud }; pintar(); seguirEspera(); return; } // R181 · la junta ya empezó: sala de espera
    pararEspera(); st.espera = null;
    st.vivo = { id, ctl: null, estado: 'conectando', presentes: new Set([st.data.yo.id]), mics: {}, hablantes: [], auto: true, chat: [], noLeidos: 0, panel: '', pantalla: null, videos: {}, expira: j.expiraMs, ultimoCorte: 0, candidato: null, desde: 0 };
    st.sala3dReu = r; st.volver3d = 'antesala'; st.vista = 'sala3d'; pintar(); window.scrollTo({ top: 0 });
    const V = st.vivo;
    if (st.data.yo.id === 'naara') { V.solTimer = setInterval(() => revisarSolicitudes(V), 4000); setTimeout(() => revisarSolicitudes(V), 600); } // R181
    try {
      const L = await import('/sala-vivo.js?v=20261106-r183');
      V.ctl = await L.conectar({ url: j.url, token: j.token, yo: st.data.yo.id, on: {
        estado: (e, m) => { if (st.vivo !== V) return; V.estado = e; pintarEstado(); if (e === 'desconectado') { toast(m || 'Salió de la sala.', true); salirVivo(true); } },
        presencia: (set, mics) => { if (st.vivo !== V) return; V.presentes = set; V.mics = mics; aplicarVivo3D(); },
        hablantes: (ids) => { if (st.vivo !== V) return; const antes = (V.hablantes || []).join(); V.hablantes = ids; if (sala3) sala3.setHablante(ids[0] || null); camaraAuto(); if (V.panel === 'part' && antes !== ids.join()) pintarPanel(); },
        pantalla: (track, de) => { if (st.vivo !== V) return; ponerPantalla(track, de); },
        video: (quien, track) => { if (st.vivo !== V) return; ponerVideo(quien, track); },
        chat: (m) => { if (st.vivo !== V) return; V.chat.push(m); if (V.chat.length > 200) V.chat.shift(); if (V.panel !== 'chat' && !m.mio) V.noLeidos++; pintarPanel(); pintarBarra(); },
        reaccion: (quien, e) => { if (sala3 && st.vivo === V) sala3.reaccion(quien, e); },
        manos: (m) => { if (st.vivo !== V) return; const antes = new Set((V.manos?.cola || []).map((x) => x.id)); V.manos = m;
          if (st.data.permisos.moderar) m.cola.filter((x) => !antes.has(x.id) && x.id !== st.data.yo.id).forEach((x) => toast(`✋ ${funda(x.id).nombre} pidió la palabra.`));
          if (sala3) (st.sala3dReu?.participantes || []).forEach((u) => sala3.setMano(u, m.cola.some((x) => x.id === u)));
          pintarPanel(); pintarBarra(); pintarPres(); },
        grabacion: (desde) => { if (st.vivo !== V) return; const antes = V.grabandoDesde; V.grabandoDesde = desde || 0; pintarRec(); if (desde && !antes && !V.grab) toast('Naara empezó a grabar la reunión.'); if (!desde && antes && !V.grab) toast('Terminó la grabación.'); },
        turno: (quien) => { if (st.vivo !== V) return; if (sala3) sala3.saludar(quien); toast(quien === st.data.yo.id ? 'Naara le dio la palabra.' : `${funda(quien).nombre} tiene la palabra.`); },
        aviso: (t) => toast(t),
        audioBloqueado: (b) => { const x = document.getElementById('sj3dAudio'); if (x) x.hidden = !b; },
      } });
      if (st.vivo !== V) { V.ctl.salir(); return; } // salió mientras conectaba
      pintarBarra();
      // la duración es un objetivo, no un corte: avisa 5 min antes y al llegar la hora de fin (no saca a nadie)
      const fin = Number(r.inicioMs || 0) + (Number(r.duracionMin) || 60) * 60000, aFin = fin - Date.now();
      if (aFin - 5 * 60000 > 0) V.avisoTope = setTimeout(() => toast('Quedan 5 minutos de la hora prevista.'), aFin - 5 * 60000);
      if (aFin > 0) V.tope = setTimeout(() => toast('Llegaron a la hora prevista de fin. Pueden cerrar cuando terminen.'), aFin);
      V.cuenta = setInterval(camaraAuto, 1000);
    } catch (e) {
      if (st.vivo !== V) return;
      toast(/permission|denied|NotAllowed/i.test(e && e.message) ? 'El navegador no dejó usar el micrófono.' : 'No se pudo conectar a la sala. Revise su internet e intente de nuevo.', true);
      salirVivo(true);
    }
  }
  function salirVivo(volver) {
    const V = st.vivo; if (!V) return; st.vivo = null;
    clearInterval(V.solTimer); document.getElementById('sj3dSol')?.remove();
    clearTimeout(V.tope); clearTimeout(V.avisoTope); clearInterval(V.cuenta);
    Object.values(V.videos).forEach((el) => el.remove());
    if (V.pantallaEl) V.pantallaEl.remove();
    if (V.ctl) V.ctl.salir();
    if (V.presEl) V.presEl.remove();
    if (V.presentador) { try { V.presentador.detener(); } catch (_) {} V.presentador = null; }
    if (V.grab) { try { V.grab.g.detener(); } catch (_) {} }
    if (V.grabSrv) { api({ accion: 'grabacion_servidor', op: 'detener', id: V.id, grabacionId: V.grabSrv.id }).catch(() => {}); V.grabSrv = null; } // R193: al salir la anfitriona se detiene
    clearInterval(V.recReloj);
    salirPantallaCompleta();
    if (volver && st.vista === 'sala3d') { st.vista = 'antesala'; pintar(); }
  }
  function aplicarVivo3D() {
    const V = st.vivo; if (!V || !sala3) return;
    if (V.modoGrab) sala3.modoGrabacion(true);
    if (V.ctl && V.ctl.nivel && sala3.setFuenteNivel) sala3.setFuenteNivel((id) => (st.vivo === V && V.ctl ? V.ctl.nivel(id) : 0)); // R183 · boca por nivel de voz real
    (st.sala3dReu?.participantes || []).forEach((u) => { sala3.setPresente(u, V.presentes.has(u)); sala3.setMicro(u, V.mics[u] !== false); sala3.setMano(u, (V.manos?.cola || []).some((x) => x.id === u)); });
    pintarPres();
    pintarPanel(); pintarBarra();
  }
  // cámara automática: corta a quien habla si lleva ~1.5 s hablando y pasaron 4 s del último corte; pantalla compartida manda
  function camaraAuto() {
    const V = st.vivo; if (!V || !V.auto || !sala3) return;
    const ahora = Date.now(), top = V.hablantes[0] || null;
    if (top !== V.candidato) { V.candidato = top; V.desde = ahora; }
    let dest = V.pantalla ? 'presentacion' : null;
    if (!dest && top && ahora - V.desde >= 1500) dest = top;
    if (!dest && !top && ahora - V.desde >= 6000) dest = 'general';
    if (dest && dest !== V.vistaAuto && ahora - V.ultimoCorte >= 4000) { V.vistaAuto = dest; V.ultimoCorte = ahora; sala3.setVista(dest); marcarVista('auto'); }
  }
  const marcarVista = (v) => host.querySelectorAll('.sj3d-vista').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  function ponerPantalla(track, de) {
    const V = st.vivo; if (!V) return;
    if (V.pantallaEl) { V.pantallaEl.remove(); V.pantallaEl = null; }
    if (!track) { if (V.pantalla && V.pantalla.de !== de) return; V.pantalla = null; V.verPres = false; if (sala3) sala3.setPantalla(null); pintarPres(); return; }
    const el = track.attach(); el.muted = true; el.playsInline = true; el.className = 'sj3d-oculto'; document.body.appendChild(el); try { el.play(); } catch (_) {}
    V.pantalla = { de, track }; V.pantallaEl = el; if (sala3) sala3.setPantalla(el);
    V.verPres = de !== st.data.yo.id || !!V.presentador; V.presDe = null; pintarPres(); // compartir pantalla propia no se ve en grande (efecto espejo); un archivo sí
    if (de !== st.data.yo.id && V.presentador) terminarPresentacion();
    if (de !== st.data.yo.id) toast(`${funda(de).nombre} está presentando.`);
    V.vistaAuto = null; V.ultimoCorte = 0; camaraAuto();
  }
  function ponerVideo(quien, track) {
    const V = st.vivo; if (!V) return; const cont = document.getElementById('sj3dVideos');
    if (V.videos[quien]) { V.videos[quien].remove(); delete V.videos[quien]; }
    if (!track || !cont) return;
    const fig = document.createElement('figure'); fig.className = 'sj3d-video'; const el = track.attach(); el.muted = true; el.playsInline = true;
    if (quien === st.data.yo.id) el.style.transform = 'scaleX(-1)';
    fig.appendChild(el); const c = document.createElement('figcaption'); c.textContent = funda(quien).nombre + (quien === st.data.yo.id ? ' (Tú)' : ''); fig.appendChild(c);
    cont.appendChild(fig); V.videos[quien] = fig;
  }
  // Modo presentación: la pantalla compartida ocupa ~78 % y las fundadoras quedan en una banda lateral
  function pintarPres() {
    const V = st.vivo, o = document.getElementById('sj3dPres'), b = document.getElementById('sj3dVerPres'); if (!V || !o) return;
    if (b) b.hidden = !(V.pantalla && !V.verPres);
    const raiz = document.getElementById('sj3dRaiz'); if (raiz) raiz.classList.toggle('sj3d-presentando', !!(V.pantalla && V.verPres));
    if (!(V.pantalla && V.verPres)) { o.hidden = true; if (V.presEl) { V.presEl.remove(); V.presEl = null; } return; }
    o.hidden = false;
    if (!V.presEl || V.presDe !== V.pantalla.de) {
      if (V.presEl) V.presEl.remove();
      const el = V.pantalla.track.attach(); el.muted = true; el.playsInline = true; el.autoplay = true; el.className = 'sj3d-presv'; V.presEl = el; V.presDe = V.pantalla.de;
      const mia = V.pantalla.de === st.data.yo.id;
      o.innerHTML = `<div class="sj3d-presm"></div><aside class="sj3d-presb"></aside><div class="sj3d-presc"><span>${ico('pantalla')}${mia ? 'Usted está presentando' : esc(funda(V.pantalla.de).nombre) + ' está presentando'}</span><div class="sj3d-presctl" id="sj3dPresCtl"></div><button type="button" class="sj-btn sj-sec sj-mini" data-sj="lkVolverSala">Volver a la sala</button></div>`;
      o.querySelector('.sj3d-presm').appendChild(el); try { el.play(); } catch (_) {}
    }
    pintarCtlPres();
    const band = o.querySelector('.sj3d-presb'); const habla = new Set(V.hablantes || []), cola = (V.manos?.cola || []).map((x) => x.id);
    band.innerHTML = `<b>Participantes (${V.presentes.size})</b>` + (st.sala3dReu?.participantes || []).map((u) => `<div class="sj3d-presp${habla.has(u) ? ' sj3d-habla' : ''}${V.presentes.has(u) ? '' : ' sj3d-ausente'}">${cara(u, 36)}<span><b>${esc(funda(u).nombre)}</b><small>${!V.presentes.has(u) ? 'No ha entrado' : V.manos?.turno === u ? 'Tiene la palabra' : cola.includes(u) ? `✋ Turno ${cola.indexOf(u) + 1}` : u === 'naara' ? 'Anfitriona' : 'Fundadora'}</small></span>${V.presentes.has(u) ? ico(V.mics[u] !== false ? 'mic' : 'micOff', 'sj3d-pmic') : ''}</div>`).join('');
  }
  // R175 · grabación local (Fase 7)
  function pintarRec() {
    const V = st.vivo, e = document.getElementById('sj3dRec'); if (!V || !e) return;
    const desde = V.grabSrv ? V.grabSrv.desde : V.grab ? V.grab.desde : V.grabandoDesde; e.hidden = !desde;
    clearInterval(V.recReloj); if (!desde) return;
    const tic = () => { const s2 = Math.max(0, Math.round((Date.now() - desde) / 1000)); const t = document.getElementById('sj3dRecT'); if (t) t.textContent = `${Math.floor(s2 / 60)}:${String(s2 % 60).padStart(2, '0')}`; };
    tic(); V.recReloj = setInterval(tic, 1000);
    const b = document.getElementById('sj3d-lkGrabar'); if (b) { b.classList.toggle('sj3d-on', !!(V.grab || V.grabSrv)); b.innerHTML = `${ico('reloj')}<span>${V.grab || V.grabSrv ? 'Detener' : 'Grabar'}</span>`; }
  }
  // R193 · GRABACIÓN COMPLETA EN EL SERVIDOR (LiveKit Egress + plantilla 3D): escena, avatares, presentación y audio real.
  // La inicia/detiene solo la anfitriona; todas ven «Grabando»; el video queda privado y se ve desde el acta con permiso.
  async function grabacionServidor() {
    const V = st.vivo; if (!V) return;
    if (V.grabSrv) {
      try { await api({ accion: 'grabacion_servidor', op: 'detener', id: V.id, grabacionId: V.grabSrv.id }); toast('Grabación detenida. El video estará en el acta cuando termine de procesarse.'); }
      catch (e) { toast(e.message, true); return; }
      V.grabSrv = null; try { await V.ctl.setGrabando(false); } catch (_) {} pintarRec(); return;
    }
    if (!confirm('¿Grabar la reunión COMPLETA?\n\nSe graba la sala 3D, los avatares, la presentación y el audio de todas. Todas verán el aviso «Grabando».\nEl video queda privado y solo lo ven las participantes desde el acta.')) return;
    try {
      const j = await api({ accion: 'grabacion_servidor', op: 'iniciar', id: V.id, consentimiento: true, presentes: [...(V.presentes || [])], origen: CFG.embebida ? 'android' : 'web' });
      V.grabSrv = { id: j.grabacion.id, desde: Date.now() };
      try { await V.ctl.setGrabando(true); } catch (_) {}
      pintarRec(); toast('Grabando en el servidor. Todas ven el aviso.');
    } catch (e) { toast(e.message || 'No se pudo empezar a grabar.', true); }
  }
  async function alternarGrabacion() {
    const V = st.vivo; if (!V?.ctl || !st.data.permisos.moderar) return;
    if (st.data.grabacionServidor || V.grabSrv) return grabacionServidor();
    // R196j · APK: graba en el TELÉFONO igual que la web (MediaRecorder del WebView) y la guarda en Documentos/Sublichat.
    const guardarApk = CFG.embebida && typeof CFG.guardarGrabacion === 'function';
    if (CFG.embebida && !guardarApk) return toast('Esta versión de la APK no puede grabar. Actualice la APK.', true);
    if (V.grab) { V.grab.g.detener(); return; }
    if (!confirm('¿Grabar la reunión?\n\nSe avisará a todas que se está grabando. ' + (guardarApk ? 'El video se guarda en este teléfono (Documentos/Sublichat) al detener; no se sube a internet.' : 'El video se descarga solo en este equipo al detener (no se sube a internet).') + (V.modoGrab ? '' : '\n\nPara anuncios: active "Modo grabación" en Ajustes (plano frontal y escena limpia).'))) return;
    const lienzo = document.querySelector('#sj3dEscena canvas.sj3d-canvas'); if (!lienzo) return toast('La sala 3D todavía no está lista.', true);
    try {
      const M = await import('/sala-grabar.js?v=20261111-r196j');
      const titulo = (st.sala3dReu && st.sala3dReu.titulo) || 'reunion';
      const g = M.crearGrabadora(lienzo, { pistasAudio: () => (V.ctl ? V.ctl.pistasAudio() : []), alAvisar: (t) => toast(t, true),
        alTerminar: async (r) => {
          const base = `${titulo} ${new Date().toLocaleDateString('es-HN', { timeZone: 'America/Tegucigalpa' }).replace(/\//g, '-')}`;
          if (guardarApk) {
            try { const donde = await CFG.guardarGrabacion(r, base); toast(`Grabación lista (${(r.bytes / 1048576).toFixed(1)} MB). Quedó en ${donde}.`); }
            catch (e) { toast('No se pudo guardar la grabación en el teléfono: ' + (e && e.message ? e.message : 'error'), true); }
          } else {
            const nombre = M.descargar(r, base);
            toast(`Grabación lista: ${nombre} (${(r.bytes / 1048576).toFixed(1)} MB). Quedó en Descargas.`);
          }
          try { await api({ accion: 'grabacion', id: V.id, estado: 'fin', duracionSeg: r.duracionSeg }); } catch (_) {}
        } });
      V.grab = { g, desde: Date.now() };
      try { await V.ctl.setGrabando(true); } catch (_) {}
      try { await api({ accion: 'grabacion', id: V.id, estado: 'inicio' }); } catch (_) {}
      const fin = g.detener; g.detener = () => { if (!V.grab) return; V.grab = null; fin(); V.ctl && V.ctl.setGrabando(false).catch(() => {}); pintarRec(); };
      pintarRec(); toast('Grabando. Todas ven el aviso.');
    } catch (e) { toast(e.message || 'No se pudo empezar a grabar.', true); }
  }

  // R173 · controles de quien presenta un archivo (páginas o reproducción)
  function pintarCtlPres() {
    const V = st.vivo, c = document.getElementById('sj3dPresCtl'); if (!V || !c) return;
    const P = V.presentador; if (!P || V.pantalla?.de !== st.data.yo.id) { c.innerHTML = ''; return; }
    const e = P.estado(); const mm = (x) => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;
    c.innerHTML = (e.tipo === 'video'
      ? `<button type="button" class="sj-btn sj-sec sj-mini" data-sj="lkPresAtras">−10 s</button><button type="button" class="sj-btn sj-rojo sj-mini" data-sj="lkPresPlay">${e.reproduciendo ? 'Pausa' : 'Reproducir'}</button><button type="button" class="sj-btn sj-sec sj-mini" data-sj="lkPresAdelante">+10 s</button><b>${mm(e.segundo)} / ${mm(e.duracion)}</b>`
      : `<button type="button" class="sj-btn sj-sec sj-mini" data-sj="lkPresAnt" ${e.pagina <= 1 ? 'disabled' : ''}>‹ Anterior</button><b>${e.tipo === 'pdf' ? 'Página' : 'Imagen'} ${e.pagina} de ${e.total}</b><button type="button" class="sj-btn sj-sec sj-mini" data-sj="lkPresSig" ${e.pagina >= e.total ? 'disabled' : ''}>Siguiente ›</button>`)
      + `<button type="button" class="sj-btn sj-rojo sj-mini" data-sj="lkPresFin">Dejar de presentar</button>`;
  }
  async function empezarPresentacion(archivos) {
    const V = st.vivo; if (!V?.ctl || !archivos || !archivos.length) return;
    if (V.pantalla && V.pantalla.de !== st.data.yo.id) return toast(`${funda(V.pantalla.de).nombre} ya está presentando.`, true);
    let P = null;
    try {
      toast('Preparando la presentación…');
      const M = await import('/sala-presentar.js?v=20261105-r173');
      P = await M.crearPresentador(archivos, { alCambiar: () => { if (st.vivo === V) pintarCtlPres(); } });
      if (V.presentador) { await V.ctl.dejarDePresentar(); V.presentador.detener(); }
      V.presentador = P; await V.ctl.presentar(P);
      V.verPres = true; pintarPres(); pintarBarra();
      if (P.tipo === 'video') toast('Toque Reproducir cuando quiera iniciar el video.');
    } catch (e) { if (P) P.detener(); if (V.presentador === P) V.presentador = null; toast(e.message || 'No se pudo presentar ese archivo.', true); }
  }
  async function terminarPresentacion() {
    const V = st.vivo; if (!V?.presentador) return;
    const P = V.presentador; V.presentador = null;
    try { await V.ctl.dejarDePresentar(); } catch (_) {}
    P.detener(); pintarBarra();
  }
  const enPantallaCompleta = () => !!(document.fullscreenElement || document.webkitFullscreenElement) || !!document.querySelector('.sj3d-expandido');
  async function pantallaCompleta() {
    const raiz = document.getElementById('sj3dRaiz'); if (!raiz) return;
    if (enPantallaCompleta()) return salirPantallaCompleta();
    const pedir = raiz.requestFullscreen || raiz.webkitRequestFullscreen;
    let ok = false;
    if (pedir) { try { await pedir.call(raiz, { navigationUI: 'hide' }); ok = true; } catch (_) {} }
    if (!ok) { raiz.classList.add('sj3d-expandido'); document.documentElement.classList.add('sj-sala-expandida'); } // celulares sin Fullscreen API: modo expandido
    marcarFull();
  }
  function salirPantallaCompleta() {
    const raiz = document.getElementById('sj3dRaiz');
    if (raiz) raiz.classList.remove('sj3d-expandido'); document.documentElement.classList.remove('sj-sala-expandida');
    const fe = document.fullscreenElement || document.webkitFullscreenElement;
    if (fe) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (_) {} }
    marcarFull();
  }
  function marcarFull() {
    const b = document.getElementById('sj3dFull'); const on = enPantallaCompleta();
    if (b) { b.innerHTML = `${ico(on ? 'contraer' : 'expandir')}<span>${on ? 'Salir del modo' : 'Pantalla completa'}</span>`; b.classList.toggle('sj3d-full-on', on); }
  }
  document.addEventListener('fullscreenchange', marcarFull); document.addEventListener('webkitfullscreenchange', marcarFull);
  function pintarEstado() {
    const V = st.vivo, e = document.getElementById('sj3dEstado'); if (!e || !V) return;
    e.hidden = V.estado === 'conectado'; e.textContent = V.estado === 'reconectando' ? 'Reconectando… no cierre esta ventana.' : V.estado === 'conectando' ? 'Conectando a la sala…' : '';
    const ch = document.getElementById('sj3dChip'); if (ch) ch.classList.toggle('sj3d-reconecta', V.estado === 'reconectando');
  }
  function pintarBarra() {
    const V = st.vivo; if (!V) return; const c = V.ctl;
    const set = (a, on, txt, icoOn, icoOff) => { const b = document.getElementById('sj3d-' + a); if (!b) return; b.classList.toggle('sj3d-on', !!on); b.disabled = !c; if (icoOn) b.innerHTML = `${ico(on ? icoOn : icoOff)}<span>${txt}</span>`; b.setAttribute('aria-pressed', on ? 'true' : 'false'); };
    set('lkMic', c && c.micro, c && c.micro ? 'Silenciar' : 'Activar mic', 'mic', 'micOff');
    const bm = document.getElementById('sj3d-lkMic'); if (bm) bm.classList.toggle('sj3d-mute', !!c && !c.micro);
    set('lkCam', c && c.camara, c && c.camara ? 'Apagar cámara' : 'Cámara', 'cam', 'cam');
    const presento = !!V.presentador;
    set('lkPant', c && c.compartiendo && !presento, c && c.compartiendo && !presento ? 'Dejar de compartir' : 'Compartir', 'pantalla', 'pantalla');
    set('lkPresentar', presento, presento ? 'Dejar de presentar' : 'Presentar', 'doc', 'doc');
    set('lkPart', V.panel === 'part', `Participantes (${V.presentes.size})`, 'grupo', 'grupo');
    set('lkChat', V.panel === 'chat', V.noLeidos ? `Chat (${V.noLeidos})` : 'Chat', 'chat', 'chat');
    set('lkReac', V.panel === 'reac', 'Reacciones', 'sonrisa', 'sonrisa');
    set('lkVer', V.panel === 'ver', 'Ver', 'ojo', 'ojo');
    set('lkAju', V.panel === 'aju', 'Ajustes', 'config', 'config');
    const tengoMano = !!(V.manos?.cola || []).find((x) => x.id === st.data.yo.id), nCola = (V.manos?.cola || []).length;
    set('lkMano', tengoMano, tengoMano ? 'Bajar mano' : (st.data.permisos.moderar && nCola ? `Mano (${nCola})` : 'Mano'), 'manoI', 'manoI');
    const bm2 = document.getElementById('sj3d-lkMano'); if (bm2) bm2.classList.toggle('sj3d-alerta', st.data.permisos.moderar && nCola > 0 && !tengoMano);
  }
  function pintarPanel() {
    const V = st.vivo, p = document.getElementById('sj3dPanel'); if (!V || !p) return;
    p.hidden = !V.panel; if (!V.panel) return;
    const cab = (t) => `<div class="sj3d-pcab"><b>${t}</b><button type="button" class="sj3d-px" data-sj="lkCerrarPanel" aria-label="Cerrar">${ico('x')}</button></div>`;
    if (V.panel === 'part') {
      const M = V.manos || { cola: [], turno: '' }, mod = st.data.permisos.moderar, yo = st.data.yo.id;
      const cola = `<div class="sj3d-cola"><b>${ico('manoI')}Pedir la palabra</b>${M.turno ? `<div class="sj3d-turno">🎙️ Tiene la palabra: <b>${esc(nomVis(M.turno))}</b>${mod ? `<button type="button" class="sj-btn sj-sec sj-mini" data-sj="lkFinTurno">Terminar turno</button>` : ''}</div>` : ''}
        ${M.cola.length ? `<ol>${M.cola.map((x) => `<li><span>${esc(nomVis(x.id))}${x.id === yo ? ' (Tú)' : ''}${M.turno === x.id ? ' · con la palabra' : ''}</span>${mod && M.turno !== x.id ? `<button type="button" class="sj-btn sj-rojo sj-mini" data-sj="lkDarTurno" data-u="${x.id}">Dar la palabra</button>` : ''}${x.id === yo ? `<button type="button" class="sj-btn sj-sec sj-mini" data-sj="lkMano">Retirar</button>` : ''}</li>`).join('')}</ol>` : '<p class="sj-hint">Nadie ha pedido la palabra.</p>'}
        ${mod && (M.cola.length || M.turno) ? `<button type="button" class="sj-btn sj-sec sj-mini" data-sj="lkLimpiarCola">Limpiar cola</button>` : ''}<p class="sj-hint">La cola no apaga micrófonos: todas se siguen escuchando.</p></div>`;
      p.innerHTML = cab('Participantes') + cola + (st.sala3dReu?.participantes || []).map((u) => { const en = V.presentes.has(u), mic = V.mics[u] !== false;
        const habla = en && (V.hablantes || []).includes(u), mano = (M.cola || []).some((x) => x.id === u);
        const est = [en ? ['verde', 'En la sala'] : ['gris', 'No ha entrado'], habla && ['habla', 'Hablando'], mano && ['ambar', '✋ Mano levantada'], en && !mic && ['rojo', '🔇 Micrófono apagado']].filter(Boolean).map(([c, t]) => `<i class="sj3d-est sj3d-est-${c}">${t}</i>`).join('');
        return `<div class="sj3d-pp${habla ? ' sj3d-pp-habla' : ''}" data-u="${u}">${cara(u, 32)}<span><b>${esc(nomVis(u))}${u === st.data.yo.id ? ' (Tú)' : ''}${u === 'naara' ? ' 👑' : ''}</b><small class="sj3d-ests">${est}</small></span>
          ${en ? ico(mic ? 'mic' : 'micOff', 'sj3d-pmic') : ''}${st.data.permisos.moderar && en && u !== st.data.yo.id ? `<button type="button" class="sj-btn sj-sec sj-mini" data-sj="lkSacar" data-u="${u}">Sacar</button>` : ''}</div>`; }).join('');
    } else if (V.panel === 'chat') {
      const yo = st.data.yo.id;
      p.innerHTML = cab('Chat de la reunión') + `<div class="sj3d-msgs" id="sj3dMsgs">${V.chat.length ? V.chat.map((m) => `<div class="sj3d-msg${m.de === yo ? ' sj3d-mio' : ''}"><small>${esc(nomVis(m.de))} · ${new Date(m.ms).toLocaleTimeString('es-HN', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Tegucigalpa' })}</small><p>${enlazar(m.t)}</p></div>`).join('') : '<p class="sj-hint">Todavía no hay mensajes. El chat no se guarda al terminar.</p>'}</div>
        <form class="sj3d-chatf" id="sj3dChatF"><input id="sj3dChatT" maxlength="500" autocomplete="off" placeholder="Escriba un mensaje…" aria-label="Mensaje"><button type="submit" class="sj-btn sj-rojo sj-mini" aria-label="Enviar">${ico('enviar')}</button></form>`;
      const m = document.getElementById('sj3dMsgs'); if (m) m.scrollTop = m.scrollHeight;
    } else if (V.panel === 'reac') {
      p.innerHTML = cab('Reacciones') + `<div class="sj3d-reacs">${REAC.map(([e, n], i) => `<button type="button" class="sj3d-re" data-sj="lkReaccion" data-e="${e}" aria-label="${n} (tecla ${i + 1})" title="${n} · tecla ${i + 1}">${e}<small>${n}</small></button>`).join('')}</div><p class="sj-hint">Aparece 2-3 segundos sobre su personaje. Atajos: teclas 1 a 6.</p>`;
    } else if (V.panel === 'aju') {
      p.innerHTML = cab('Ajustes') + `<div class="sj3d-aju sj3d-modo"><label class="sj-rec"><span><b>Modo grabación (anuncios)</b><small>Cámara frontal, luz más limpia y sin plantas, cuadros, utilería ni nombres en pantalla. Solo cambia su vista.</small></span><input type="checkbox" role="switch" class="sj-sw" id="sj3dModoGrab" ${V.modoGrab ? 'checked' : ''}></label></div><div class="sj3d-aju" id="sj3dAju"><p class="sj-hint">Buscando dispositivos…</p></div>`;
      V.ctl?.dispositivos().then((d) => { const c = document.getElementById('sj3dAju'); if (!c || V.panel !== 'aju') return;
        const sel = (tipo, l, act, t) => `<label class="sj-f"><span>${t}</span><select data-aju="${tipo}">${l.map((x) => `<option value="${esc(x.id)}"${x.id === act ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('') || '<option>Predeterminado</option>'}</select></label>`;
        c.innerHTML = sel('audioinput', d.mic, d.micActual, 'Micrófono') + (d.salida.length ? sel('audiooutput', d.salida, d.salidaActual, 'Escuchar por') : '<p class="sj-hint">Este navegador usa la salida de audio del sistema.</p>') + `<p class="sj-hint">Si no la escuchan, revise que el micrófono correcto esté elegido y que el botón Micrófono no esté en rojo.</p>`; });
    } else if (V.panel === 'ver') {
      const parts = st.sala3dReu?.participantes || [];
      p.innerHTML = cab('Vistas de cámara') + `<div class="sj3d-verl">${[['auto', 'Automática', 'Sigue a quien habla'], ['general', 'Vista general', 'Toda la sala'], ...parts.map((u) => [u, `Plano de ${funda(u).nombre}`, '']), ['presentacion', 'Vista presentación', 'La pantalla de la sala'], ['panoramica', 'Vista panorámica', 'Recorrido lento'], ['libre', 'Cámara libre', 'Arrastre para mirar']].map(([v, t, d]) => `<button type="button" class="sj3d-vista${(V.auto ? 'auto' : V.vistaManual) === v ? ' on' : ''}" data-sj="vista3d" data-v="${v}"><b>${esc(t)}</b>${d ? `<small>${esc(d)}</small>` : ''}</button>`).join('')}</div>`;
    }
  }
  // R173 · enlaces del chat (solo http/https, se abren aparte y sin acceso a esta página)
  const enlazar = (t) => { const re = /\bhttps?:\/\/[^\s<>"'`]{3,300}/g; let out = '', k = 0, m; while ((m = re.exec(t))) { const u = m[0].replace(/[.,;:!?)]+$/, ''); out += esc(t.slice(k, m.index)) + `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow">${esc(u)}</a>`; k = m.index + u.length; re.lastIndex = k; } return out + esc(t.slice(k)); };
  const REAC = [['👏', 'Aplausos'], ['👍', 'Me gusta'], ['❤️', 'Corazón'], ['😂', 'Risa'], ['😮', 'Sorpresa'], ['🎉', 'Fiesta']];
  async function reaccionar(e) {
    const V = st.vivo; if (!V?.ctl) return;
    try { if (!(await V.ctl.reaccion(e))) toast('Espere un momento antes de enviar otra reacción.'); } catch (_) {}
  }
  async function accionVivo(a, b) {
    const V = st.vivo; if (!V) return;
    if (a === 'lkGrabar') return alternarGrabacion();
    if (a === 'lkVerPres') { V.verPres = true; return pintarPres(); }
    if (a === 'lkPresentar') { if (V.presentador) return terminarPresentacion(); const f = document.getElementById('sj3dArchivo'); if (f) { f.value = ''; f.click(); } return; }
    if (a === 'lkPresFin') return terminarPresentacion();
    if (V.presentador && /^lkPres(Sig|Ant|Play|Atras|Adelante)$/.test(a)) {
      const P = V.presentador;
      try { if (a === 'lkPresSig') await P.siguiente(); else if (a === 'lkPresAnt') await P.anterior(); else if (a === 'lkPresPlay') { if (P.estado().reproduciendo) P.pausa(); else await P.play(); } else if (a === 'lkPresAtras') P.saltar(-10); else if (a === 'lkPresAdelante') P.saltar(10); } catch (e) { toast(e.message || 'No se pudo.', true); }
      return pintarCtlPres();
    }
    if (a === 'lkVolverSala') { V.verPres = false; return pintarPres(); }
    if (a === 'lkPart' || a === 'lkChat' || a === 'lkReac' || a === 'lkVer' || a === 'lkAju' || a === 'lkCerrarPanel') {
      const k = { lkPart: 'part', lkChat: 'chat', lkReac: 'reac', lkVer: 'ver', lkAju: 'aju' }[a] || '';
      V.panel = V.panel === k ? '' : k; if (V.panel === 'chat') V.noLeidos = 0; pintarPanel(); pintarBarra();
      if (V.panel === 'chat') { const t = document.getElementById('sj3dChatT'); if (t) t.focus(); }
      return;
    }
    if (a === 'lkAudio') { try { await V.ctl.activarAudio(); } catch (_) {} return; }
    if (!V.ctl) return;
    if (a === 'lkReaccion') return reaccionar(b.dataset.e);
    b.disabled = true;
    try {
      if (a === 'lkMic') await V.ctl.setMicro(!V.ctl.micro);
      else if (a === 'lkMano') { const sube = !V.ctl.mano; await V.ctl.setMano(sube); if (sube) toast('Levantó la mano. Naara verá su turno en la cola.'); }
      else if (a === 'lkDarTurno') await V.ctl.darTurno(b.dataset.u);
      else if (a === 'lkFinTurno') { const sig = (V.manos?.cola || []).find((x) => x.id !== V.manos.turno); await V.ctl.darTurno(''); if (sig) toast(`Siguiente en la cola: ${funda(sig.id).nombre}.`); }
      else if (a === 'lkLimpiarCola') await V.ctl.limpiarCola();
      else if (a === 'lkCam') await V.ctl.setCamara(!V.ctl.camara);
      else if (a === 'lkPant') {
        if (!navigator.mediaDevices?.getDisplayMedia && !V.ctl.compartiendo) throw new Error('Este dispositivo no permite compartir pantalla (en celular use una computadora).');
        if (!V.ctl.compartiendo && V.pantalla && V.pantalla.de !== st.data.yo.id) throw new Error(`${funda(V.pantalla.de).nombre} ya está compartiendo pantalla.`);
        if (V.presentador) await terminarPresentacion();
        await V.ctl.setCompartir(!V.ctl.compartiendo);
      } else if (a === 'lkSacar') {
        if (!confirm(`¿Sacar a ${funda(b.dataset.u).nombre} de la sala?`)) return;
        await api({ accion: 'expulsar', id: V.id, usuario: b.dataset.u }); toast(`${funda(b.dataset.u).nombre} salió de la sala.`);
      } else if (a === 'lkTerminar') {
        if (!confirm('¿Terminar la reunión para todas? Se cierra la sala.')) return;
        const rid = V.id; await api({ accion: 'cerrar_sala', id: rid }); toast('Reunión terminada. Escriba el acta.'); salirVivo(false); await cargar(true, true); return abrirActa(rid, true);
      }
    } catch (e) {
      const m = String(e && e.message || '');
      toast(/NotAllowed|Permission|denied/i.test(m) ? (a === 'lkPant' ? 'Se canceló compartir pantalla.' : 'El navegador bloqueó el permiso. Toque el candado junto a la dirección para permitirlo.') : (m || 'No se pudo completar.'), true);
    } finally { b.disabled = false; pintarBarra(); }
  }

  // ---------- eventos ----------
  document.addEventListener('click', async (e) => {
    if (!host || !host.contains(e.target)) return;
    const b = e.target.closest('[data-sj]'); if (!b || b.disabled) return;
    const a = b.dataset.sj, id = b.dataset.id;
    const reu = () => st.data.reuniones.find((r) => r.id === id) || (st.data.proxima && st.data.proxima.id === id ? st.data.proxima : null);
    if (a === 'recargar') return cargar();
    if (a === 'inicio' || a === 'salirAnte') { detenerMic(); if (st.vista === 'personaje' && st.volverAnte && st.ante) { st.volverAnte = false; st.vista = 'antesala'; return pintar(); } st.vista = 'inicio'; st.editar = null; return pintar(); }
    if (a === 'historial') cargarActas();
    if (/^esc[A-Z]/.test(a)) return accionEsc(a, b);
    if (a === 'verActa') return abrirActa(id);
    if (a === 'grabVer' || a === 'grabBajar') { // R193
      try {
        const j = await api({ accion: 'grabacion_ver', id, grabacionId: b.dataset.g, descargar: a === 'grabBajar' });
        if (a === 'grabBajar') { if (typeof CFG.descargar === 'function') await CFG.descargar(j.url, 'reunion-sala-juntas.mp4'); else { const l = document.createElement('a'); l.href = j.url; l.rel = 'noopener'; document.body.appendChild(l); l.click(); l.remove(); } return; }
        if (st.acta && st.acta.id === id) { st.acta.video = { g: b.dataset.g, url: j.url }; pintar(); }
      } catch (err) { toast(err.message, true); }
      return;
    }
    if (a === 'actaEditar') { st.acta.editar = true; return pintar(); }
    if (a === 'actaCancelar') { st.acta.editar = false; return pintar(); }
    if (a === 'acuMas') { const c = document.getElementById('sjAcuerdos'); if (c && c.children.length < 30) { const n = c.firstElementChild.cloneNode(true); n.dataset.k = 'a' + Date.now().toString(36).slice(-6); n.dataset.e = 'pendiente'; n.querySelectorAll('input').forEach((x) => { x.value = ''; }); n.querySelector('select').value = ''; c.appendChild(n); n.querySelector('input').focus(); } return; }
    if (a === 'acuQuitar') { const c = document.getElementById('sjAcuerdos'); const fila = b.closest('.sj-acu-f'); if (c.children.length > 1) fila.remove(); else fila.querySelectorAll('input').forEach((x) => { x.value = ''; }); return; }
    if (a === 'escenarios') { await cargarEscenarios(); }
    if (['calendario', 'mis', 'historial', 'config', 'personaje', 'escenarios'].includes(a)) { if (a === 'personaje') { st.pers = null; st.volverAnte = false; } st.vista = a; pintar(); return window.scrollTo({ top: 0 }); }
    if (a === 'nueva') { st.editar = null; st.formEsc = ''; st.formSug = null; st.formTipo = ''; if (!st.esc) await cargarEscenarios(); st.vista = 'form'; pintar(); return window.scrollTo({ top: 0 }); }
    if (a === 'horaAhora') { const f = document.getElementById('sjForm'); if (!f) return; const n = ahoraHN(); f.querySelector('[name=fecha]').value = n.fecha; f.querySelector('[name=h12]').value = String(((n.h + 11) % 12) + 1); f.querySelector('[name=min]').value = String(n.m); f.querySelector('[name=ampm]').value = n.h >= 12 ? 'pm' : 'am'; syncHora(f); st.tocado = true; return; }
    if (a === 'repetir') { const o = reu(); if (!o) return; if (!st.esc) await cargarEscenarios(); st.formEsc = ''; st.formSug = null; st.formTipo = '';
      st.editar = { titulo: o.titulo, agenda: o.agenda || [], participantes: o.participantes || ['naara'], duracionMin: o.duracionMin, recordatorios: o.recordatorios || {}, tipo: o.tipo, escenario: o.escenario, presetId: o.presetId, sugerido: o.sugerido, fecha: '', hora: '' };
      st.vista = 'form'; pintar(); toast('Elija la nueva fecha y hora. Se usará el mismo escenario y estilo.'); return window.scrollTo({ top: 0 }); }
    if (a === 'limpiar') { st.editar = null; st.formEsc = ''; st.formSug = null; st.formTipo = ''; return pintar(); }
    if (a === 'editar') { st.formEsc = ''; st.formSug = null; st.formTipo = ''; if (!st.esc) await cargarEscenarios(); st.editar = { ...reu() }; st.vista = 'form'; pintar(); return window.scrollTo({ top: 0 }); }
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
        st.guardando = ''; await cargar(true, true);
        if (st.vista === 'antesala' && st.ante) { try { const j = await api({ accion: 'antesala', id: st.ante.id }); st.ante = j.reunion; pintar(); } catch (_) { st.vista = 'inicio'; pintar(); } }
      } catch (err) { st.guardando = ''; b.disabled = false; toast(err.message, true); }
      return;
    }
    if (a === 'entrar') return entrarVivo(id);
    if (a === 'tgVincular') { const w = window.open('about:blank', '_blank'); try { const j = await api({ accion: 'telegram_vincular' }); if (w) w.location.href = j.url; else location.href = j.url; toast('Se abrió el bot de Sublicuentas: toque «Iniciar». Luego vuelva y toque «Ya lo hice».'); } catch (e) { if (w) w.close(); toast(e.message, true); } return; }
    if (a === 'tgComprobar') { try { const j = await api({ accion: 'telegram_estado' }); st.data.telegram = { ...(st.data.telegram || {}), [st.data.yo.id]: j.telegram }; pintar(); toast(j.telegram.estado === 'listo' ? '✅ Telegram vinculado.' : 'Todavía no aparece vinculado. Abra el enlace y toque Iniciar en el bot.', j.telegram.estado !== 'listo'); } catch (e) { toast(e.message, true); } return; }
    if (a === 'reintentarAvisos') { try { const j = await api({ accion: 'reintentar_avisos', id }); toast(j.reactivados ? `Se reenvían ${j.reactivados} aviso(s).` + (j.faltan.length ? ` Aún sin Telegram: ${j.faltan.map(nomVis).join(', ')}.` : '') : `Aún sin Telegram: ${j.faltan.map(nomVis).join(', ') || '—'}.`, !!j.faltan.length); await cargar(true, true); } catch (e) { toast(e.message, true); } return; }
    if (a === 'solicitarIngreso') { try { const j = await api({ accion: 'solicitar_ingreso', id }); if (!st.espera) st.espera = { id }; st.espera.sol = j.solicitud; pintarEspera(); seguirEspera(); toast('Solicitud enviada a Sublicuentas.'); } catch (e) { toast(e.message, true); } return; }
    if (a === 'cancelarEspera') { pararEspera(); st.espera = null; return pintar(); }
    if (a === 'resolverSol') { const V = st.vivo; if (!V) return; b.disabled = true; try { await api({ accion: 'resolver_solicitud', id: V.id, usuario: b.dataset.u, requestId: b.dataset.req, aprobar: b.dataset.ok === '1' }); toast(b.dataset.ok === '1' ? `✅ ${nomVis(b.dataset.u)} puede entrar.` : `Solicitud de ${nomVis(b.dataset.u)} rechazada.`); } catch (e) { toast(e.message, true); } V.sol = []; return revisarSolicitudes(V); }
    if (a.startsWith('lk')) return accionVivo(a, b);
    if (a === 'tabPers') { st.pers.tab = b.dataset.t; const ed = ed3; ed3 = null; const cfg = st.pers; const t = document.createElement('div'); t.innerHTML = personaje(); host.querySelector('#sjOps').innerHTML = t.querySelector('#sjOps').innerHTML; host.querySelectorAll('.sj-tab').forEach((x) => { const on = x.dataset.t === cfg.tab; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); }); ed3 = ed; return; }
    if (a === 'rotar') { if (ed3) ed3.rotar(Number(b.dataset.d)); return; }
    if (a === 'guardarPers') return guardarPersonaje();
    if (a === 'vistaPers') { if (ed3) ed3.vista(b.dataset.v); host.querySelector('[data-sj="giro360"]')?.setAttribute('aria-pressed', 'false'); return; }
    if (a === 'enfoquePers') { if (ed3 && ed3.enfocar) ed3.enfocar(b.dataset.v); return; }
    if (a === 'giro360') { if (ed3) b.setAttribute('aria-pressed', String(ed3.girar())); return; }
    if (a === 'zoomPers') { if (ed3) ed3.zoom(Number(b.dataset.d)); return; }
    if (a === 'camReset') { if (ed3) ed3.reiniciar(); return; }
    if (a === 'restablecer') { const av = st.data.avatares[st.data.yo.id]; st.pers.config = { ...av.config }; if (ed3) ed3.set(st.pers.config); const t = document.createElement('div'); t.innerHTML = personaje(); host.querySelector('#sjOps').innerHTML = t.querySelector('#sjOps').innerHTML; return toast('Se restableció el último personaje guardado.'); }
    if (a === 'personajeAnte') { st.volverAnte = true; st.pers = null; st.vista = 'personaje'; pintar(); return window.scrollTo({ top: 0 }); }
    if (a === 'verSala' || a === 'verSalaPers') { st.sala3dReu = a === 'verSala' ? (st.ante || reu()) : null; st.volver3d = st.vista; st.vista = 'sala3d'; detenerMic(); pintar(); return window.scrollTo({ top: 0 }); }
    if (a === 'vista3d') {
      if (st.vivo) { st.vivo.auto = b.dataset.v === 'auto'; if (st.vivo.auto) { st.vivo.vistaAuto = null; st.vivo.ultimoCorte = 0; marcarVista('auto'); camaraAuto(); return; } }
      if (st.vivo) st.vivo.vistaManual = b.dataset.v;
      if (sala3) sala3.setVista(b.dataset.v); if (st.vivo?.panel === 'ver') pintarPanel(); return;
    }
    if (a === 'pantallaCompleta') return pantallaCompleta();
    if (a === 'salirSala') { if (st.vivo) { salirVivo(false); st.vista = 'antesala'; return pintar(); } st.vista = st.volver3d || 'inicio'; return pintar(); }
  });
  document.addEventListener('click', (e) => { const b = host && host.contains(e.target) && e.target.closest('[data-op]'); if (!b || b.type === 'checkbox' || !st.pers) return; cambiarOpcion(b.dataset.op, b.dataset.v); });
  document.addEventListener('input', (e) => { if (!st.pers || !host || e.target.id !== 'sjNomVis') return; st.pers.config.nombre = e.target.value.replace(/[<>{}`\\]/g, '').slice(0, 24); const n = document.getElementById('sjEdNom'); if (n) n.textContent = st.pers.config.nombre.trim() || funda(st.data.yo.id).nombre; });
  document.addEventListener('change', (e) => { const b = host && host.contains(e.target) && e.target.closest('input[data-op]'); if (!b || !st.pers) return; cambiarOpcion(b.dataset.op, b.checked); });
  document.addEventListener('submit', (e) => {
    if (e.target && e.target.id === 'sjForm') { e.preventDefault(); guardar(false); }
    if (e.target && e.target.id === 'sjActaF') { e.preventDefault(); guardarActa(e.target); }
    if (e.target && e.target.id === 'sjEscF') { e.preventDefault(); guardarEsc(e.target); }
    if (e.target && e.target.id === 'sj3dChatF') { e.preventDefault(); const t = document.getElementById('sj3dChatT'); const v = t ? t.value : ''; if (t) t.value = ''; if (st.vivo?.ctl && v.trim()) st.vivo.ctl.chat(v).catch(() => toast('No se pudo enviar el mensaje.', true)); }
  });
  window.addEventListener('pagehide', () => { if (st.vivo) salirVivo(false); });
  document.addEventListener('change', async (e) => {
    if (e.target && e.target.id === 'sj3dArchivo') empezarPresentacion(e.target.files);
    if (e.target && e.target.dataset && e.target.dataset.sjEsc) { st.formEsc = e.target.value; st.formSug = ''; const c = document.getElementById('sjEscCampos'); if (c) c.innerHTML = escenarioCampos({ escenario: '', presetId: '' }); }
    if (e.target && ['h12', 'min', 'ampm'].includes(e.target.name)) { const f = e.target.closest('form'); if (f) syncHora(f); }
    if (e.target && e.target.dataset && e.target.dataset.sjTipo) { const T = TIPOS.find(([k]) => k === e.target.value); st.formTipo = e.target.value; if (T && T[2]) { st.formEsc = T[2]; st.formSug = T[3] ? 's:' + T[3] : ''; } const c = document.getElementById('sjEscCampos'); if (c) c.innerHTML = escenarioCampos({ escenario: '', presetId: '' }); }
    if (e.target && e.target.id === 'sj3dModoGrab' && st.vivo) { const V = st.vivo; V.modoGrab = e.target.checked; V.auto = !V.modoGrab; if (sala3) sala3.modoGrabacion(V.modoGrab); host.querySelectorAll('.sj3d-vista').forEach((b) => b.classList.toggle('on', V.modoGrab ? false : b.dataset.v === 'auto')); toast(V.modoGrab ? 'Modo grabación activo: plano frontal y escena limpia.' : 'Modo grabación apagado.'); return; }
    if (e.target && e.target.dataset && e.target.dataset.aju && st.vivo?.ctl) { try { await st.vivo.ctl.usarDispositivo(e.target.dataset.aju, e.target.value); toast('Listo, cambiado.'); } catch (err) { toast('No se pudo cambiar: ' + (err.message || ''), true); } }
    if (e.target && e.target.dataset && e.target.dataset.sj === 'acuEstado' && st.acta) {
      const cb = e.target; cb.disabled = true;
      try { const j = await api({ accion: 'acuerdo_estado', id: st.acta.id, acuerdo: cb.dataset.k, estado: cb.checked ? 'cumplido' : 'pendiente' }); st.acta.acta.acuerdos = j.acuerdos; toast(cb.checked ? 'Acuerdo marcado como cumplido.' : 'Acuerdo pendiente otra vez.'); cargarActas(); }
      catch (err) { cb.checked = !cb.checked; toast(err.message, true); }
      pintar();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (st.vista !== 'sala3d' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' && document.querySelector('.sj3d-expandido')) { salirPantallaCompleta(); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); pantallaCompleta(); return; }
    if (!st.vivo?.ctl) return;
    if (/^[1-6]$/.test(e.key)) { e.preventDefault(); reaccionar(REAC[Number(e.key) - 1][0]); }
    if (st.vivo.presentador && (e.key === 'ArrowRight' || e.key === 'PageDown')) { e.preventDefault(); st.vivo.presentador.siguiente().then(pintarCtlPres); }
    if (st.vivo.presentador && (e.key === 'ArrowLeft' || e.key === 'PageUp')) { e.preventDefault(); st.vivo.presentador.anterior().then(pintarCtlPres); }
    if (e.key === 'h' || e.key === 'H') { const b = document.getElementById('sj3d-lkMano'); if (b) b.click(); }
  });

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
.sj-avisos{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:#58616D}.sj-avisos .sj-i{width:14px;height:14px;color:#2879C7}.sj-mal{color:#B91C1C}
.sj-falla{font-size:11.5px;color:#B91C1C;margin-top:3px;padding-left:20px}
.sj-editor{padding:18px}.sj-ed-h{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:0 0 14px}.sj-ed-tit{display:flex;align-items:center;gap:8px;font-size:17px}.sj-ed-tit small{color:var(--m);font-weight:500}
.sj-tabs{display:flex;gap:6px;flex-wrap:wrap}#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj-tab{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:999px!important;font-size:13px;font-weight:700;background:var(--f)!important;color:var(--t)!important}.sj-tab .sj-i{width:16px;height:16px}#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj-tab.on{background:var(--r)!important;color:#fff!important}
.sj-ed-g{display:grid;grid-template-columns:200px minmax(0,1fr) minmax(260px,320px);gap:18px;align-items:stretch}
.sj-ed-mini{display:flex;flex-direction:column;gap:8px;align-items:center}.sj-ed-mini img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:14px;background:#F2E7DC}.sj-ed-mini small{color:var(--m);font-size:12px}
.sj-ed-vacio{width:100%;aspect-ratio:1;border-radius:14px;border:1px dashed var(--b);display:grid;place-items:center;text-align:center;color:var(--m);font-size:12.5px;padding:12px}
.sj-op{margin:0 0 14px}.sj-op>b{display:block;font-size:12.5px;margin:0 0 7px}.sj-op-v{display:flex;flex-wrap:wrap;gap:8px}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj-chip-op{all:unset;cursor:pointer;padding:7px 13px;border-radius:999px!important;border:1px solid var(--b)!important;font-size:13px;font-weight:600;background:#fff!important;color:var(--t)!important}#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj-chip-op.on{background:var(--r)!important;border-color:var(--r)!important;color:#fff!important}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj-sw-col{all:unset;cursor:pointer;width:30px;height:30px;border-radius:50%!important;background:var(--c)!important;border:0!important;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)!important}#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj-sw-col.on{background:var(--c)!important;box-shadow:0 0 0 2px #fff,0 0 0 4px #E2231A!important}
.sj-chip-op:focus-visible,.sj-sw-col:focus-visible,.sj-tab:focus-visible,.sj-rot:focus-visible{outline:2px solid #2879C7;outline-offset:2px}
.sj-acc-op{padding:10px 0;border-bottom:1px solid var(--b)}
.sj-grabs{display:grid;gap:10px}.sj-grab{display:grid;gap:8px;padding:10px 0;border-top:1px solid var(--b)}.sj-grab small{display:block;color:var(--m);margin-top:3px}.sj-grab-a{display:flex;gap:8px;flex-wrap:wrap}.sj-grab-v{width:100%;border-radius:12px;background:#000}
.sj-ed-3d{position:relative;border-radius:14px;background:#F4F1EC;min-height:420px;overflow:hidden}.sj-ed-3d canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj-rot{all:unset;border-radius:50%!important;background:#20242B!important;cursor:pointer;position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:#20242B;color:#fff;display:grid;place-items:center;font-size:22px;line-height:1}#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj-rot-i{left:10px}#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj-rot-d{right:10px;left:auto}
.sj-ed-carga{position:absolute;inset:0;display:grid;place-items:center;color:var(--m);font-size:13px;text-align:center;padding:20px}
.sj-ante-ok span{background:rgba(21,155,98,.85)!important}.sj-ante-av .sj-btn{margin-top:6px}
.sj3d{background:#141920;border-radius:18px;overflow:hidden;color:#fff;box-shadow:0 10px 40px rgba(20,25,32,.25)}
.sj3d-top{display:flex;align-items:center;gap:14px;padding:12px 18px;flex-wrap:wrap}.sj3d-top img{height:24px}.sj3d-sep{width:1px;height:24px;background:#3A404B}.sj3d-top b{font-size:18px}.sj3d-top b i{font-style:normal;background:var(--r);border-radius:6px;padding:0 6px;margin-left:4px}
.sj3d-sala{display:inline-flex;align-items:center;gap:6px;font-weight:600}.sj3d-chip{margin-left:auto;font-size:12px;background:#222833;border:1px solid #2F3744;border-radius:999px;padding:6px 12px}
.sj3d-g{display:grid;grid-template-columns:minmax(0,1fr) 230px}.sj3d-escena{position:relative;min-height:540px;aspect-ratio:16/9;background:#2A1C14}.sj3d-canvas{position:absolute;inset:0;width:100%;height:100%}
.sj3d-nombres{position:absolute;inset:0;pointer-events:none}.sj3d-nombre{position:absolute;left:0;top:0;background:rgba(20,25,32,.85);color:#fff;font:600 13px Inter,sans-serif;padding:5px 10px;border-radius:999px;white-space:nowrap}.sj3d-anf{background:rgba(20,25,32,.9);border:1px solid #E0A100}
.sj3d-vistas{background:#1B2028;padding:14px;display:flex;flex-direction:column;gap:8px;overflow:auto}.sj3d-vistas>b{display:flex;align-items:center;gap:8px;font-size:14px;margin-bottom:4px}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj3d-vista{all:unset;cursor:pointer;padding:10px 12px;border-radius:10px!important;background:#222833!important;border:1px solid #2F3744!important;color:#fff!important}.sj3d-vista b{display:block;font-size:13px}.sj3d-vista small{display:block;font-size:11.5px;color:#AEB6C2;margin-top:2px}#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj3d-vista.on{border-color:#E2231A!important;background:#3A1F22!important}
.sj3d-barra{display:flex;justify-content:center;gap:4px;flex-wrap:wrap;padding:10px;background:#0F1318}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj3d-ctl{all:unset;background:transparent!important;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:72px;padding:8px 6px;border-radius:10px;font-size:11.5px;color:#E9EBEF}.sj3d-ctl .sj-i{width:22px;height:22px}.sj3d-ctl:disabled{opacity:.45;cursor:not-allowed}.sj3d-ctl:not(:disabled):hover{background:#222833}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj3d-salir{background:#C62828!important;color:#fff!important}
/* R170 · en vivo */
.sj3d-led{display:inline-block;width:8px;height:8px;border-radius:50%;background:#2ECC71;margin-right:6px;vertical-align:1px;box-shadow:0 0 0 3px rgba(46,204,113,.25)}.sj3d-chip.sj3d-reconecta .sj3d-led{background:#F5A623}
.sj3d-estado{position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:4;background:#F5A623;color:#141920;font:600 13px Inter,sans-serif;padding:7px 14px;border-radius:999px}
.sj3d-oculto{position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none}
.sj3d-videos{position:absolute;left:12px;bottom:12px;z-index:3;display:flex;gap:8px;flex-wrap:wrap;max-width:60%}
.sj3d-video{margin:0;position:relative;width:170px;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#000;border:2px solid #2F3744}.sj3d-video video{width:100%;height:100%;object-fit:cover}
.sj3d-video figcaption{position:absolute;left:6px;bottom:5px;font:600 11px Inter,sans-serif;background:rgba(20,25,32,.8);padding:2px 7px;border-radius:999px}
.sj3d-panel{position:absolute;right:12px;top:12px;bottom:12px;width:300px;max-width:calc(100% - 24px);z-index:5;background:#fff;color:#1F2430;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}
.sj3d-pcab{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #ECEEF2}.sj3d-pcab b{font-size:15px}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj3d-px{all:unset;cursor:pointer;display:grid;place-items:center;width:30px;height:30px;border-radius:8px;color:#5E6B7A}.sj3d-px .sj-i{width:18px;height:18px}
.sj3d-pp{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #F2F3F6}.sj3d-pp span{flex:1;display:flex;flex-direction:column}.sj3d-pp small{color:#6B7380;font-size:12px}.sj3d-pmic{width:18px;height:18px;color:#5E6B7A}
.sj3d-msgs{flex:1;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:8px}.sj3d-msg{background:#F4F5F8;border-radius:10px;padding:7px 10px;max-width:88%}.sj3d-msg small{color:#6B7380;font-size:11px}.sj3d-msg p{margin:2px 0 0;white-space:pre-wrap;word-break:break-word;font-size:14px}
.sj3d-mio{align-self:flex-end;background:#FDECEC}
.sj3d-chatf{display:flex;gap:8px;padding:10px;border-top:1px solid #ECEEF2}.sj3d-chatf input{flex:1;min-width:0;border:1px solid #DADDE3;border-radius:10px;padding:9px 11px;font:14px Inter,sans-serif}
.sj3d-reacs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:14px}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj3d-re{all:unset;cursor:pointer;text-align:center;font-size:28px;padding:10px 0;border-radius:12px;background:#F4F5F8}#rbac-sala-juntas button.sj3d-re:hover{background:#ECEEF2}
.sj3d-reacs+.sj-hint{padding:0 14px}
.sj3d-reac{position:absolute;left:50%;bottom:100%;font-size:30px;animation:sj3dSube 2.6s ease-out forwards;pointer-events:none}
@keyframes sj3dSube{0%{transform:translate(-50%,0) scale(.6);opacity:0}15%{transform:translate(-50%,-10px) scale(1.1);opacity:1}100%{transform:translate(-50%,-90px) scale(1);opacity:0}}
@media (prefers-reduced-motion:reduce){.sj3d-reac{animation-duration:1.4s}}
.sj-esc-sec{border-top:1px solid #EEF0F3;padding:10px 0 4px}.sj-esc-sec h4{display:flex;align-items:center;gap:6px;margin:0 0 6px;font:700 13px Inter,sans-serif;color:#1F2430}.sj-esc-sec h4 .sj-i{width:16px;height:16px;color:#E2231A}.sj-esc-sec .sj-hint{display:block;margin:4px 0 2px}
.sj-esc-sws{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:4px 12px}.sj-esc-sug{padding:4px 0 10px}.sj-esc-sug b{display:block;font:700 13px Inter,sans-serif;margin-bottom:6px}
.sj3d-limpio{display:none!important}.sj3d-modo{border-bottom:1px solid #EEF0F3}.sj3d-modo .sj-rec span{display:flex;flex-direction:column;gap:2px}.sj3d-modo small{color:#6B7280;font-size:12px;font-weight:400}
.sj-hora{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.sj-hora b{font-weight:700;color:#1F2430}#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) .sj-hora select{width:auto;min-width:64px;padding:9px 8px}#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) .sj-hora select[name=ampm]{min-width:96px}
.sj-tg{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-radius:14px;padding:10px 14px;margin-bottom:12px;border:1px solid #E7EAF0;background:#fff}.sj-tg>span{display:flex;flex-direction:column;flex:1;min-width:180px}.sj-tg small{color:#6B7280;font-size:12px}.sj-tg .sj-i{width:18px;height:18px}.sj-tg-ok .sj-i{color:#1C7C45}.sj-tg-no{border-color:#F5D48A;background:#FFFBF0}.sj-tg-no .sj-i{color:#8A5A00}
.sj-tgchip{display:inline-block;margin-top:3px;font-size:11px!important;font-weight:700;padding:1px 7px;border-radius:999px}.sj-tg-listo{background:#E6F6EC;color:#1C7C45!important}.sj-tg-pend{background:#FFF3D6;color:#8A5A00!important}.sj-bien{color:#1C7C45}.sj-chips-tg{margin-top:4px}
.sj-espera{border:1px solid #F5C2BE;background:#FFF7F6;border-radius:14px;padding:14px 16px;margin:12px 0;display:grid;gap:8px}.sj-espera p{margin:0;color:#4A5565;font-size:14px}.sj-espera-t{display:flex;gap:6px;align-items:center;font-size:16px}.sj-espera-t .sj-i{width:18px;height:18px;color:#E2231A}
.sj-espera-e{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px}.sj-est-pendiente{color:#8A5A00}.sj-est-rechazada,.sj-est-expulsado{color:#B42318}.sj-est-vencida{color:#58616D}
.sj3d-sol{position:absolute;top:64px;right:12px;z-index:30;display:grid;gap:8px;width:min(340px,calc(100% - 24px))}.sj3d-sol-c{background:#fff;border:1px solid #E7EAF0;border-radius:14px;padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.18);display:grid;gap:4px;color:#1F2430}.sj3d-sol-c b{display:flex;gap:6px;align-items:center}.sj3d-sol-c p{margin:0;font-size:14px}.sj3d-sol-c small{color:#6B7280;font-size:12px;display:flex;gap:4px;align-items:center}.sj3d-sol-c .sj-i{width:14px;height:14px}
.sj-perm{display:block;color:#8A919C;font-size:11px;margin-top:1px}
.sj-sug-nota{display:flex;gap:6px;align-items:flex-start;background:#F6F7F9;border-radius:10px;padding:8px 10px;margin:2px 0 6px}.sj-sug-nota .sj-i{width:15px;height:15px;color:#1C7C45;flex:none;margin-top:1px}
.sj-ed-nom{position:absolute;left:50%;top:12px;transform:translateX(-50%);background:rgba(20,25,32,.88);color:#fff;font:600 13px Inter,sans-serif;padding:5px 12px;border-radius:999px;white-space:nowrap;max-width:80%;overflow:hidden;text-overflow:ellipsis;z-index:2;pointer-events:none}
.sj-op-nom{display:grid;gap:6px}.sj-op-nom input{font:500 14px Inter,sans-serif;padding:9px 11px;border:1px solid #D5D9E0;border-radius:10px;background:#fff;color:#1F2430;width:100%;box-sizing:border-box}.sj-op-nom input:focus{outline:2px solid #E2231A;outline-offset:1px}.sj-op-nom small{color:#6B7280;font-size:12px}
.sj3d-nombre.sj3d-ausente{opacity:.55!important;font-style:italic}
.sj3d-ests{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}.sj3d-est{font:600 11px Inter,sans-serif;font-style:normal;padding:2px 7px;border-radius:999px;background:#EEF0F3;color:#58616D}.sj3d-est-verde{background:#E6F6EC;color:#1C7C45}.sj3d-est-habla{background:#2FD27A;color:#0B3B20}.sj3d-est-ambar{background:#FFF3D6;color:#8A5A00}.sj3d-est-rojo{background:#FDE8E7;color:#B42318}.sj3d-pp-habla{box-shadow:inset 3px 0 0 #2FD27A}
.sj3d-ondas{display:none;align-items:flex-end;gap:2px;height:12px;margin-left:6px;vertical-align:-1px}.sj3d-ondas b{display:block;width:3px;height:4px;border-radius:2px;background:#2FD27A;animation:sjOnda .9s ease-in-out infinite}.sj3d-ondas b:nth-child(2){animation-delay:.15s}.sj3d-ondas b:nth-child(3){animation-delay:.3s}
.sj3d-nombre.sj3d-hablando{box-shadow:0 0 0 2px #2FD27A,0 0 14px rgba(47,210,122,.55)}.sj3d-nombre.sj3d-hablando .sj3d-ondas{display:inline-flex}
@keyframes sjOnda{0%,100%{height:4px}50%{height:12px}}@media (prefers-reduced-motion:reduce){.sj3d-ondas b{animation:none;height:9px}}
.sj3d-audio{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:6}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj3d-ctl.sj3d-on{background:#2B3340!important}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj3d-ctl.sj3d-mute{color:#FF8A80!important}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj3d-fin{background:#7A1F2B!important}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) [hidden]{display:none!important}
.sj-acta-meta{display:flex;flex-wrap:wrap;gap:8px 18px;color:#5E6B7A;font-size:13.5px;margin:4px 0 12px}.sj-acta-meta span{display:inline-flex;align-items:center;gap:6px}.sj-acta-meta .sj-i{width:16px;height:16px}
.sj-acta h4{margin:16px 0 6px;font-size:14px;color:#1F2430}.sj-pre{white-space:pre-wrap}.sj-dec{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px}
.sj-acus{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}.sj-acu label{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid #ECEEF2;border-radius:12px;cursor:pointer}.sj-acu input{margin-top:3px;width:18px;height:18px;accent-color:#2E9E5A}
.sj-acu span{display:flex;flex-direction:column}.sj-acu small{color:#6B7380}.sj-acu-ok b{text-decoration:line-through;color:#6B7380}
.sj-acu-f{display:grid;grid-template-columns:minmax(0,1fr) 150px 150px auto;gap:8px;margin-bottom:8px}.sj-acu-f input,.sj-acu-f select{border:1px solid #DADDE3;border-radius:10px;padding:9px 10px;font:14px Inter,sans-serif;min-width:0;background:#fff}
@media (max-width:760px){.sj-acu-f{grid-template-columns:1fr 1fr auto}.sj-acu-f [name=kt]{grid-column:1/-1}}
.sj-ante-esc{display:flex;align-items:center;gap:6px;color:#5E6B7A;font-size:13px;margin:2px 0 6px}.sj-ante-esc .sj-i{width:15px;height:15px}
.sj-esc-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}
.sj-esc-g{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(300px,1fr);gap:18px;align-items:start}
.sj-esc-3d{position:relative;aspect-ratio:16/10;border-radius:14px;overflow:hidden;background:#1B1F26}@media (min-width:901px){.sj-esc-3d{position:sticky;top:84px}}.sj-esc-3d canvas{width:100%;height:100%;display:block}
.sj-esc-ops{display:flex;flex-direction:column;gap:12px}.sj-esc-ps{display:flex;flex-direction:column;gap:6px}
.sj-esc-p{display:flex;align-items:center;gap:6px;border:1px solid #ECEEF2;border-radius:12px;padding:4px 6px 4px 4px}.sj-esc-p.on{border-color:#E2231A;background:#FDF2F2}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj-esc-pn{all:unset;cursor:pointer;flex:1;display:flex;flex-direction:column;padding:6px 8px;border-radius:9px}.sj-esc-pn small{color:#6B7380;font-size:12px}
.sj-esc-guardar{display:flex;gap:8px;flex-wrap:wrap}.sj-esc-guardar input{flex:1 1 200px;min-width:0;border:1px solid #DADDE3;border-radius:10px;padding:9px 11px;font:14px Inter,sans-serif}
@media (max-width:900px){.sj-esc-g{grid-template-columns:1fr}}
.sj3d-rec{position:absolute;top:12px;right:12px;z-index:5;display:flex;align-items:center;gap:7px;background:#C62828;color:#fff;font:700 12.5px Inter,sans-serif;padding:6px 12px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.3)}
.sj3d-rec i{width:9px;height:9px;border-radius:50%;background:#fff;animation:sj3dLat 1.2s infinite}@keyframes sj3dLat{50%{opacity:.25}}@media (prefers-reduced-motion:reduce){.sj3d-rec i{animation:none}}
/* R172 · cámara del editor */
.sj-ed-cam{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:flex;gap:4px;background:rgba(255,255,255,.92);border:1px solid #E3E6EB;border-radius:999px;padding:4px;z-index:2}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) .sj-ed-cam button{all:unset;cursor:pointer;font:600 12px Inter,sans-serif;color:#1F2430;padding:6px 10px;border-radius:999px;min-width:16px;text-align:center}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) .sj-ed-cam button:hover{background:#F2F3F6}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) .sj-ed-cam button[aria-pressed=true]{background:#E2231A;color:#fff}
.sj-ed-sep{width:1px;align-self:stretch;background:#E7EAF0;margin:0 2px;flex:none}.sj-ed-cam{max-width:calc(100% - 16px);overflow-x:auto;scrollbar-width:none}#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) .sj-ed-cam button{flex:none;white-space:nowrap}
@media (max-width:520px){#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) .sj-ed-cam button{padding:6px 7px;font-size:11px}}
/* R171 · Fase 5: pantalla completa, mano/turnos, reacciones, modo presentación */
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj3d-full{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:7px;font:600 13px Inter,sans-serif;color:#fff;background:#222833;border:1px solid #2F3744;border-radius:999px;padding:7px 13px}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj3d-full.sj3d-full-on{background:#C62828;border-color:#C62828}.sj3d-full .sj-i{width:16px;height:16px}
#sj3dRaiz:fullscreen,#sj3dRaiz:-webkit-full-screen,.sj3d.sj3d-expandido{display:flex;flex-direction:column;width:100vw;height:100vh;height:100dvh;border-radius:0;box-shadow:none}
.sj3d.sj3d-expandido{position:fixed;inset:0;z-index:2147483000}
#sj3dRaiz:fullscreen .sj3d-g,.sj3d-expandido .sj3d-g{flex:1;min-height:0;grid-template-columns:minmax(0,1fr)}
#sj3dRaiz:fullscreen .sj3d-escena,.sj3d-expandido .sj3d-escena{aspect-ratio:auto;min-height:0;height:100%}
#sj3dRaiz:fullscreen .sj3d-vistas,.sj3d-expandido .sj3d-vistas{display:none}
#sj3dRaiz:fullscreen .sj3d-barra,.sj3d-expandido .sj3d-barra{padding-bottom:max(12px,env(safe-area-inset-bottom))}
#sj3dRaiz:fullscreen #sjToast{z-index:2147483647}
html.sj-sala-expandida,html.sj-sala-expandida body{overflow:hidden!important}
/* un ancestro con transform (animación de entrada) rompe position:fixed: se anula mientras haga falta */
html.sj-sala-expandida #screen-sala-juntas,html.sj-sala-expandida .screen-sala-juntas,html.sj-sala-expandida .sj-card{transform:none!important;animation:none!important;filter:none!important}
@media (max-width:760px){html.sj-en-editor #screen-sala-juntas,html.sj-en-editor .screen-sala-juntas,html.sj-en-editor .sj-editor{transform:none!important;animation:none!important;filter:none!important}}
.sj3d-presentando .sj3d-g{grid-template-columns:minmax(0,1fr)}.sj3d-presentando .sj3d-vistas{display:none}
.sj3d-pres{position:absolute;inset:0;z-index:4;background:#141920;display:grid;grid-template-columns:minmax(0,1fr) 220px;grid-template-rows:minmax(0,1fr) auto;gap:10px;padding:10px}
.sj3d-presm{min-width:0;min-height:0;border-radius:12px;overflow:hidden;background:#000;display:grid;place-items:center}.sj3d-presv{width:100%;height:100%;object-fit:contain}
.sj3d-presb{background:#1B2028;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;overflow:auto}.sj3d-presb>b{font-size:13px;letter-spacing:.02em}
.sj3d-presp{display:flex;align-items:center;gap:9px;background:#222833;border:1px solid #2F3744;border-radius:10px;padding:8px}.sj3d-presp span{flex:1;display:flex;flex-direction:column;min-width:0}.sj3d-presp b{font-size:13px}.sj3d-presp small{font-size:11.5px;color:#AEB6C2}
.sj3d-presp.sj3d-habla{border-color:#2ECC71;box-shadow:0 0 0 2px rgba(46,204,113,.35)}.sj3d-presp.sj3d-ausente{opacity:.5}.sj3d-presp .sj3d-pmic{color:#AEB6C2}
.sj3d-presc{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px;font:600 13px Inter,sans-serif;flex-wrap:wrap}
.sj3d-presctl{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.sj3d-presctl b{font:600 13px Inter,sans-serif;color:#E9ECF1;min-width:110px;text-align:center}.sj3d-presc span{display:inline-flex;align-items:center;gap:7px}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj3d-verpres{all:unset;cursor:pointer;position:absolute;left:12px;top:12px;z-index:3;display:inline-flex;align-items:center;gap:7px;background:#C62828;color:#fff;font:600 13px Inter,sans-serif;padding:8px 13px;border-radius:999px}.sj3d-verpres .sj-i{width:16px;height:16px}
.sj3d-cola{padding:12px 14px;border-bottom:1px solid #ECEEF2;display:flex;flex-direction:column;gap:8px}.sj3d-cola>b{display:flex;align-items:center;gap:7px;font-size:14px}.sj3d-cola>b .sj-i{width:17px;height:17px}
.sj3d-cola ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px}.sj3d-cola li{font-size:14px}.sj3d-cola li span{margin-right:8px}.sj3d-cola li .sj-btn{margin:2px 4px 0 0}
.sj3d-turno{background:#E9F8EF;border:1px solid #BFE8CF;border-radius:10px;padding:8px 10px;font-size:13.5px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.sj3d-reacs{grid-template-columns:repeat(3,1fr)!important}.sj3d-re small{display:block;font:600 11px Inter,sans-serif;color:#5E6B7A;margin-top:4px}
.sj3d-aju{padding:12px 14px;display:flex;flex-direction:column;gap:10px}.sj3d-aju select{width:100%;border:1px solid #DADDE3;border-radius:10px;padding:9px 10px;font:14px Inter,sans-serif;background:#fff}
.sj3d-verl{padding:12px;display:flex;flex-direction:column;gap:8px;overflow:auto}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) .sj3d-verl button.sj3d-vista{background:#F4F5F8!important;border-color:#E3E6EB!important;color:#1F2430!important}.sj3d-verl .sj3d-vista small{color:#6B7380}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) .sj3d-verl button.sj3d-vista.on{background:#FDECEC!important;border-color:#E2231A!important}
#rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) button.sj3d-ctl.sj3d-alerta{box-shadow:inset 0 0 0 2px #F5A623}
@media (max-width:900px){html.sj-en-sala:not(#x1):not(#x2) body .nav,html.sj-en-sala:not(#x1):not(#x2) body .rbac-nav-arrow{display:none!important}}
@media (max-width:760px){
  .sj3d-vivo .sj3d-vistas{display:none}
  .sj3d-pres{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto auto}.sj3d-presb{flex-direction:row;overflow-x:auto;padding:8px}.sj3d-presb>b{display:none}.sj3d-presp{flex:0 0 auto}.sj3d-presp small{display:none}
  .sj3d-full span{display:none}
  .sj-ed-acc{position:fixed;left:10px;right:10px;bottom:calc(var(--sj-pie,12px) + env(safe-area-inset-bottom,0px));z-index:10000;background:#fff;padding:10px!important;margin:0!important;border:1px solid #ECEEF2;box-shadow:0 -6px 20px rgba(20,25,32,.12);border-radius:14px;display:grid!important;grid-template-columns:1fr 1fr;gap:8px}
  #rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) .sj-ed-acc button[data-sj="guardarPers"]{grid-column:1/-1;width:100%}
  #rbac-sala-juntas:not(#x1):not(#x2):not(#x3):not(#x4) .sj-ed-acc button{min-height:44px;margin:0}
  html.sj-en-editor #rbac-sala-juntas{padding-bottom:calc(var(--sj-pie,12px) + 150px)}
  html:not(.ui-v2) #rbac-sala-juntas{--sj-pie:104px}
}
.sj-alerta{background:#FFF4F3;border:1px solid #F3C3C0;color:#B91C1C;border-radius:12px;padding:10px 14px;font-size:13px}
.sj-borr{padding:14px 18px}.sj-borr>b{display:block;margin:0 0 6px}
.sj-fila{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;padding:9px 0;border-top:1px solid var(--b);cursor:pointer;font-size:13.5px}.sj-fila span{flex:1;font-weight:600}.sj-fila small{color:var(--m)}
#sjToast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);opacity:0;background:#141920;color:#fff;padding:12px 18px;border-radius:12px;font:600 14px Inter,system-ui,sans-serif;z-index:3000;transition:all .22s;pointer-events:none;max-width:90vw}
#sjToast.on{opacity:1;transform:translateX(-50%)}#sjToast.malo{background:#B91C1C}
#rbac-sala-juntas>*{animation:sjEntra .3s cubic-bezier(.2,.8,.2,1)}@keyframes sjEntra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#rbac-sala-juntas *{animation:none!important;transition:none!important}}
@media (max-width:1279.98px){.sj-ed-g{grid-template-columns:160px minmax(0,1fr)}.sj-ed-3d{grid-column:1/-1}.sj3d-g{grid-template-columns:1fr}.sj3d-vistas{flex-direction:row;flex-wrap:wrap}.sj3d-vistas>b{width:100%}.sj-top{grid-template-columns:1fr}.sj-hero{min-height:0;aspect-ratio:3/1}.sj-accs{grid-template-columns:repeat(3,minmax(0,1fr))}.sj-dos{grid-template-columns:1fr}}
@media (max-width:767.98px){.sj-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.sj-prox{grid-template-columns:1fr}.sj-prox-img{width:100%;height:140px}.sj-accs,.sj-accs.sj-n4{grid-template-columns:repeat(2,minmax(0,1fr))}
  .sj3d-panel{left:8px;right:8px;top:auto;bottom:8px;width:auto;max-height:62%}.sj3d-msgs{min-height:120px}.sj3d-video{width:110px}
  .sj-ed-g{grid-template-columns:1fr}.sj-ed-mini{flex-direction:row}.sj-ed-mini img,.sj-ed-vacio{width:90px}.sj-ed-3d{min-height:360px}.sj3d-escena{min-height:0;aspect-ratio:4/5}.sj3d-ctl{min-width:56px;font-size:10px}.sj3d-chip{margin-left:0}
  .sj-form-g{grid-template-columns:1fr}.sj-form-img{display:none}.sj-ante-g{grid-template-columns:1fr}.sj-ante-av{min-height:160px}.sj-form-acc .sj-btn{flex:1 1 100%}.sj-cab h2{font-size:22px!important}
  .sj-reu{grid-template-columns:56px minmax(0,1fr)}.sj-reu-a{grid-column:1/-1;align-items:flex-start}.sj-cal{gap:3px}.sj-dia{min-height:60px;padding:3px}.sj-ev{font-size:9.5px;padding:2px 3px}
  #rbac-sala-juntas .sj-btn{min-height:44px}}
`;
    document.head.appendChild(s);
  }

  // R168 · Enlace de Telegram: /?sala=<id> abre la Sala (con el login normal de Sublichat) y la antesala de esa reunión.
  (function enlace() {
    let id = ''; try { id = new URLSearchParams(location.search).get('sala') || ''; } catch (_) {}
    // R192 · desde la APK: «Mi avatar» y «Escenarios» abren esas vistas sin entrar a ninguna reunión (mismos permisos).
    const vistaDirecta = ['personaje', 'escenarios'].includes(id) ? id : '';
    if (!vistaDirecta && !/^[A-Za-z0-9_-]{6,60}$/.test(id)) return;
    let n = 0; const iv = setInterval(async () => {
      n++; const R = window.SublichatRBAC;
      if (n > 240) return clearInterval(iv);
      if (!R || !document.body.classList.contains('ready') || !R.can('sala-juntas')) return;
      clearInterval(iv);
      try { const u = new URL(location.href); u.searchParams.delete('sala'); history.replaceState(null, '', u.toString()); } catch (_) {}
      R.ir('sala-juntas');
      for (let i = 0; i < 40 && !st.data; i++) await new Promise((r) => setTimeout(r, 250));
      if (!st.data) return;
      if (vistaDirecta) { if (vistaDirecta === 'escenarios') await cargarEscenarios(); if (vistaDirecta === 'personaje') { st.pers = null; st.volverAnte = false; } st.vista = vistaDirecta; pintar(); return; }
      try { const j = await api({ accion: 'antesala', id }); st.ante = j.reunion; st.data.tiempoReal = j.tiempoReal; st.vista = 'antesala'; pintar(); }
      catch (e) { toast(e.message, true); }
    }, 250);
  })();
  // R193 · Para la APK (sala embebida): abrir una vista concreta sin pasar por el enlace de la Web, y cerrar liberando
  // micrófono, cámara, LiveKit y la escena 3D (al salir o al girar/volver no queda audio abierto).
  async function abrir(vista = 'inicio', id = '') {
    open();
    for (let i = 0; i < 60 && !st.data && !st.error; i++) await new Promise((r) => setTimeout(r, 200));
    if (!st.data) return;
    if (vista === 'escenarios') { await cargarEscenarios(); st.vista = 'escenarios'; return pintar(); }
    if (vista === 'personaje') { st.pers = null; st.volverAnte = false; st.vista = 'personaje'; return pintar(); }
    if (vista === 'nueva' && st.data.permisos.crear) { st.editar = null; st.formEsc = ''; st.formSug = null; st.formTipo = ''; if (!st.esc) await cargarEscenarios(); st.vista = 'form'; return pintar(); }
    if (vista === 'historial') { st.vista = 'historial'; cargarActas(); return pintar(); }
    if (vista === 'acta' && /^[A-Za-z0-9_-]{6,60}$/.test(id)) return abrirActa(id);
    if (vista === 'antesala' && /^[A-Za-z0-9_-]{6,60}$/.test(id)) {
      try { const j = await api({ accion: 'antesala', id }); st.ante = j.reunion; st.data.tiempoReal = j.tiempoReal; st.vista = 'antesala'; pintar(); } catch (e) { toast(e.message, true); }
    }
  }
  function cerrar() {
    clearInterval(poll); detenerMic();
    if (st.vivo) salirVivo(false);
    try { desmontar3D(); } catch (_) {}
    document.documentElement.classList.remove('sj-en-sala', 'sj-en-editor');
    st.vista = 'inicio'; host = null;
  }
  window.SublichatSala = { open, abrir, cerrar, recargar: () => cargar(true) };
})();
