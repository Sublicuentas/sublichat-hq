/* permisos-admin.js · R162 — Pantalla "Usuarios y permisos" (solo Sublicuentas).
   Sublicuentas activa o desactiva los módulos de cada usuario (Relojes, Geisell, Magdiel y los que se agreguen).
   Sublicuentas siempre tiene todos. Lo que no se toca queda como hasta hoy. El servidor (api/permisos.js) guarda
   y las APIs de cada módulo lo respetan. Funciona con el diseño actual y con el nuevo (ui-v2). */
(function () {
  'use strict';
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NOTAS = {
    'sorteos': 'Activado a otro usuario: verá y editará los sorteos de Relojes.',
    'portal-cliente': 'Activado a otro usuario: administra las promociones de Relojes.',
    'catalogo': 'Activado a otro usuario: edita el catálogo de Relojes.',
    'panel-socios': 'Acceso de administrador al Panel de Socios (precios, socios, entregas).',
    'finanzas': 'Libro, ingresos, egresos y cierre. También en la APK.',
    'codigos': 'Solo la APK: códigos de Netflix, Disney y demás.',
    'actividad': 'Bitácora completa de lo que hace cada usuario.',
  };
  const st = { cargando: false, error: '', data: null, edit: {}, guardando: '', msg: {} };

  function toast(t) {
    let el = document.getElementById('permToast');
    if (!el) { el = document.createElement('div'); el.id = 'permToast'; el.className = 'perm-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2800);
  }
  async function api(body) {
    const r = await fetch('/api/permisos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || 'No se pudo completar.');
    return j;
  }
  async function cargar() {
    st.cargando = true; st.error = ''; pintar();
    try { st.data = await api({ accion: 'listar' }); st.edit = {}; }
    catch (e) { st.error = e.message; }
    finally { st.cargando = false; pintar(); }
  }
  function valor(u, id) { const e = st.edit[u.usuario]; return e && id in e ? e[id] : !!u.modulos[id]; }
  function sucio(u) { const e = st.edit[u.usuario] || {}; return Object.keys(e).some((id) => e[id] !== !!u.modulos[id]); }

  function tarjeta(u, catalogo) {
    const grupos = [...new Set(catalogo.map((m) => m.grupo))];
    if (u.supervisor) {
      return `<article class="perm-card sup"><header><span class="perm-av">${esc((u.usuario[0] || '?').toUpperCase())}</span><div><b>${esc(u.usuario)}</b><small>${esc(u.rol)}</small></div><span class="perm-pill ok">Todos los módulos</span></header><p class="perm-help">Sublicuentas es el supervisor: tiene siempre todos los módulos y no se le pueden quitar.</p></article>`;
    }
    const cambios = Object.keys(u.cambios || {}).length;
    const filas = grupos.map((g) => `<fieldset class="perm-grupo"><legend>${esc(g)}</legend>${catalogo.filter((m) => m.grupo === g).map((m) => {
      const on = valor(u, m.id), def = !!u.porDefecto[m.id], cambiado = on !== def;
      const nota = NOTAS[m.id] && (on || cambiado) ? `<small class="perm-nota">${esc(NOTAS[m.id])}</small>` : '';
      return `<label class="perm-mod ${m.fijo ? 'fijo' : ''}"><span class="perm-mod-tx"><b>${esc(m.label)}</b>${cambiado ? `<em class="perm-pill warn">${on ? 'Activado' : 'Desactivado'} por Sublicuentas</em>` : ''}${nota}</span>
        <input type="checkbox" role="switch" class="perm-sw" data-u="${esc(u.usuario)}" data-m="${esc(m.id)}" ${on ? 'checked' : ''} ${m.fijo ? 'disabled' : ''} aria-label="${esc(m.label)} para ${esc(u.usuario)}"></label>`;
    }).join('')}</fieldset>`).join('');
    const msg = st.msg[u.usuario];
    return `<article class="perm-card" data-card="${esc(u.usuario)}"><header><span class="perm-av">${esc((u.usuario[0] || '?').toUpperCase())}</span><div><b>${esc(u.usuario)}</b><small>${esc(u.rol)}${cambios ? ` · ${cambios} cambio${cambios === 1 ? '' : 's'} de Sublicuentas` : ' · como siempre'}</small></div></header>
      <div class="perm-grid">${filas}</div>
      <footer><button type="button" class="perm-btn sec" data-reset="${esc(u.usuario)}" ${cambios || sucio(u) ? '' : 'disabled'}>Volver a lo de siempre</button>
        <button type="button" class="perm-btn pri" data-save="${esc(u.usuario)}" ${sucio(u) && st.guardando !== u.usuario ? '' : 'disabled'}>${st.guardando === u.usuario ? 'Guardando…' : 'Guardar cambios'}</button>
        ${msg ? `<span class="perm-msg ${msg.ok ? 'ok' : 'err'}" role="status">${esc(msg.t)}</span>` : ''}</footer></article>`;
  }

  function pintar() {
    const host = document.getElementById('rbac-permisos'); if (!host) return;
    if (!(window.SublichatRBAC && window.SublichatRBAC.esSupervisor())) { host.innerHTML = '<p class="perm-help">Solo Sublicuentas administra los permisos.</p>'; return; }
    if (st.cargando && !st.data) { host.innerHTML = '<div class="perm-empty">Cargando usuarios…</div>'; return; }
    if (st.error && !st.data) { host.innerHTML = `<div class="perm-empty err">${esc(st.error)} <button type="button" class="perm-btn sec" data-recargar>Reintentar</button></div>`; bind(host); return; }
    const d = st.data || { usuarios: [], catalogo: [] };
    host.innerHTML = `<div class="perm-top"><p class="perm-help">Active o desactive los módulos de cada usuario. Lo que no cambie queda como hasta hoy. Los módulos marcados también se bloquean en el servidor y en la APK.${d.actualizado ? ` Último cambio: ${esc(new Date(d.actualizado).toLocaleString('es-HN'))} por ${esc(d.actualizadoPor || '—')}.` : ''}</p>
      <button type="button" class="perm-btn sec" data-recargar>Actualizar</button></div>
      <div class="perm-list">${d.usuarios.map((u) => tarjeta(u, d.catalogo)).join('') || '<div class="perm-empty">No hay usuarios configurados.</div>'}</div>`;
    bind(host);
  }
  function usuario(id) { return (st.data?.usuarios || []).find((u) => u.usuario === id); }
  function bind(host) {
    host.querySelector('[data-recargar]')?.addEventListener('click', cargar);
    host.querySelectorAll('.perm-sw').forEach((i) => i.addEventListener('change', () => {
      const e = st.edit[i.dataset.u] || (st.edit[i.dataset.u] = {});
      e[i.dataset.m] = i.checked; st.msg[i.dataset.u] = null; pintar();
      host.querySelector(`.perm-sw[data-u="${CSS.escape(i.dataset.u)}"][data-m="${CSS.escape(i.dataset.m)}"]`)?.focus();
    }));
    host.querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', async () => {
      const u = usuario(b.dataset.reset); if (!u) return;
      if (!confirm(`¿Dejar a ${u.usuario} con sus módulos de siempre?`)) return;
      const modulos = Object.fromEntries(Object.keys(u.cambios || {}).map((k) => [k, null]));
      if (!Object.keys(modulos).length) { st.edit[u.usuario] = {}; pintar(); return; }
      await guardar(u, modulos);
    }));
    host.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', () => {
      const u = usuario(b.dataset.save); if (!u) return;
      const e = st.edit[u.usuario] || {}, modulos = {};
      for (const [id, v] of Object.entries(e)) modulos[id] = v === !!u.porDefecto[id] ? null : v; // igual a lo de siempre = sin cambio guardado
      guardar(u, modulos);
    }));
  }
  async function guardar(u, modulos) {
    st.guardando = u.usuario; pintar();
    try {
      const r = await api({ accion: 'guardar', usuario: u.usuario, modulos });
      u.cambios = r.cambios || {}; u.modulos = r.modulos || u.modulos; st.edit[u.usuario] = {};
      st.msg[u.usuario] = { ok: true, t: 'Guardado. El usuario lo verá al recargar o en un minuto.' };
      toast(`✅ Módulos de ${u.usuario} actualizados`);
    } catch (e) { st.msg[u.usuario] = { ok: false, t: e.message }; }
    finally { st.guardando = ''; pintar(); }
  }

  const css = `
  .perm-top{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;margin:4px 0 14px}
  .perm-help{margin:0;color:#707C8D;font-size:14px;line-height:1.5;max-width:760px}
  .perm-list{display:grid;gap:14px}
  .perm-card{background:#fff;border:1px solid #E7EAF0;border-radius:16px;padding:16px;box-shadow:0 6px 28px rgba(19,26,45,.045)}
  .perm-card header{display:flex;align-items:center;gap:12px;margin-bottom:10px}.perm-card header>div{flex:1;min-width:0}
  .perm-card header b{display:block;font-size:16px;color:#162031;text-transform:capitalize}.perm-card header small{color:#707C8D;font-size:13px}
  .perm-av{width:40px;height:40px;border-radius:12px;background:#FDEBEA;color:#E2231A;font-weight:800;display:grid;place-items:center;flex:none}
  .perm-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))}
  .perm-grupo{border:0;margin:0;padding:0;min-width:0}.perm-grupo legend{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#707C8D;margin-bottom:6px}
  .perm-mod{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px;padding:8px 10px;border:1px solid #E7EAF0;border-radius:12px;margin-bottom:6px;cursor:pointer;background:#fff}
  .perm-mod.fijo{opacity:.7;cursor:default}.perm-mod-tx{display:flex;flex-direction:column;gap:2px;min-width:0}.perm-mod-tx b{font-size:14px;color:#162031;font-weight:600}
  .perm-nota{font-size:12px;color:#707C8D;line-height:1.35}
  #rbac-permisos input.perm-sw{appearance:none!important;-webkit-appearance:none!important;flex:none!important;width:44px!important;min-width:44px!important;max-width:44px!important;height:26px!important;min-height:0!important;padding:0!important;margin:0!important;border:0!important;border-radius:999px!important;background:#D5DAE3!important;position:relative!important;cursor:pointer;transition:background .15s;box-shadow:none!important;opacity:1!important}
  #rbac-permisos input.perm-sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .15s}
  #rbac-permisos input.perm-sw:checked{background:#E2231A!important}#rbac-permisos input.perm-sw:checked::after{transform:translateX(18px)}#rbac-permisos input.perm-sw:disabled{cursor:default;background:#F0B4B0!important}
  .perm-sw:focus-visible{outline:3px solid #2879C7;outline-offset:2px}
  .perm-pill{display:inline-block;font-style:normal;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px;margin-top:2px;width:max-content}
  .perm-pill.warn{background:#FFF4DE;color:#8A5A00}.perm-pill.ok{background:#E6F6EE;color:#159B62}
  .perm-card footer{display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid #E7EAF0}
  .perm-btn{min-height:44px;padding:0 16px;border-radius:10px;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;border:1px solid #E7EAF0;background:#fff;color:#162031}
  .perm-btn.pri{background:#E2231A;border-color:#E2231A;color:#fff}.perm-btn.pri:hover{background:#C51E17}.perm-btn:disabled{opacity:.45;cursor:not-allowed}
  .perm-msg{font-size:13px;font-weight:600}.perm-msg.ok{color:#159B62}.perm-msg.err{color:#C93030}
  .perm-empty{padding:24px;text-align:center;color:#707C8D;background:#fff;border:1px dashed #E7EAF0;border-radius:16px}.perm-empty.err{color:#C93030}
  .perm-card.sup{border-color:#FBD5D2}
  .perm-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);opacity:0;background:#162031;color:#fff;padding:12px 18px;border-radius:12px;font:600 14px Inter,system-ui;z-index:99999;transition:.2s;pointer-events:none}
  .perm-toast.on{opacity:1;transform:translate(-50%,0)}`;
  function estilos() { if (document.getElementById('permAdminCss')) return; const s = document.createElement('style'); s.id = 'permAdminCss'; s.textContent = css; document.head.appendChild(s); }

  window.SublichatPermisos = { open() { estilos(); if (!st.data && !st.cargando) cargar(); else pintar(); }, _st: st };
})();
