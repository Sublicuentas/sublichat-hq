/* R196l · Nombres públicos (Sublichat HQ).
   Regla del negocio: en pantalla NUNCA aparecen los nombres de las personas detrás de las cuentas.
   «Naara» se muestra como «Sublicuentas» y «Libni» / «Libni Daniela» como «Relojes».
   Los usuarios internos (naara, libni) siguen iguales en la base de datos y en los permisos: aquí solo cambia lo que se VE.
   Excepción: el titular legal de una cuenta bancaria (ej. «… VELÁSQUEZ BLANCO») no se toca, porque el banco lo exige
   para transferir. Para excluir cualquier otro bloque a mano: atributo data-nombre-real. */
(function () {
  'use strict';
  const RE = /\b(naara|libni)\b(\s+(?:betzab[ée]|daniela))?/gi;
  const ES_TITULAR = /^\s+vel[aá]squez/i;
  function publico(texto) {
    const s = String(texto == null ? '' : texto);
    if (!/naara|libni/i.test(s)) return s;
    return s.replace(RE, (m, nombre, segundo, pos, todo) => {
      if (ES_TITULAR.test(todo.slice(pos + m.length))) return m; // titular bancario legal
      return nombre.toLowerCase() === 'naara' ? 'Sublicuentas' : 'Relojes';
    });
  }
  const SALTAR = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);
  function saltar(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (SALTAR.has(e.tagName) || e.isContentEditable || (e.hasAttribute && e.hasAttribute('data-nombre-real'))) return true;
    }
    return false;
  }
  function limpiarNodo(n) {
    if (n.nodeType === 3) {
      const v = n.nodeValue;
      if (v && /naara|libni/i.test(v) && !saltar(n.parentElement)) { const p = publico(v); if (p !== v) n.nodeValue = p; }
      return;
    }
    if (n.nodeType !== 1 || saltar(n)) return;
    for (const a of ['title', 'placeholder', 'aria-label', 'alt']) {
      const v = n.getAttribute && n.getAttribute(a);
      if (v && /naara|libni/i.test(v)) { const p = publico(v); if (p !== v) n.setAttribute(a, p); }
    }
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      if (t.nodeType === 3) limpiarNodo(t);
      else if (!saltar(t)) for (const a of ['title', 'placeholder', 'aria-label', 'alt']) { const v = t.getAttribute(a); if (v && /naara|libni/i.test(v)) { const p = publico(v); if (p !== v) t.setAttribute(a, p); } }
    }
  }
  window.nombrePublico = publico;
  if (typeof document === 'undefined' || typeof MutationObserver !== 'function') return;
  const iniciar = () => {
    limpiarNodo(document.body);
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'characterData') limpiarNodo(m.target);
        else if (m.type === 'attributes') limpiarNodo(m.target);
        else m.addedNodes.forEach(limpiarNodo);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label', 'alt'] });
    const t0 = document.title; if (/naara|libni/i.test(t0)) document.title = publico(t0);
  };
  if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
})();
