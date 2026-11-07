// R184 · Capturas antes/después: Inicio, Perfil, Control Maestro y menú superior, admin (naara) y limitado (relojes).
// Uso: node tests/visual/capturas-ui.mjs <carpeta> <prefijo> [ui=v2|v1|auto]
import fs from 'node:fs'; import path from 'node:path'; import { abrir } from './arnes.mjs';
const dir = process.argv[2]; const pre = process.argv[3] || 'x'; const ui = process.argv[4] || 'auto'; fs.mkdirSync(dir, { recursive: true });
for (const [usuario, ancho] of [['naara', 1440], ['relojes', 1440], ['relojes', 390]]) {
  const h = await abrir({ usuario, ui: ui === 'auto' ? undefined : ui, ancho, alto: ancho < 500 ? 844 : 900 }); const P = h.page;
  await P.waitForFunction(() => document.body.classList.contains('ready') && (document.querySelector('#v2Inicio .v2-kpis .v2k:not(.v2-esq)') || document.querySelector('#screen-inicio .kpi, #screen-inicio .card, #kpis')), null, { timeout: 60000 }).catch(() => {});
  await P.waitForTimeout(800);
  const n = (s) => path.join(dir, `${pre}-${usuario}-${ancho}-${s}.png`);
  await P.screenshot({ path: n('inicio') });
  const top = await P.$('.v2-top, #v2Shell header, header'); if (top && ancho > 500) await P.screenshot({ path: n('menu'), clip: { x: 0, y: 0, width: ancho, height: 150 } });
  await P.evaluate(() => window.SublichatRBAC && window.SublichatRBAC.ir('perfil')); await P.waitForTimeout(900); await P.screenshot({ path: n('perfil'), fullPage: true });
  if (usuario === 'naara') { await P.evaluate(() => window.SublichatRBAC.ir('control-cuentas')); await P.waitForTimeout(2500); await P.screenshot({ path: n('control') }); }
  const info = await P.evaluate(() => ({ ui: document.documentElement.classList.contains('ui-v2') ? 'v2' : 'v1', ancho: document.documentElement.scrollWidth, tema: !!document.getElementById('themeSwatchGrid') }));
  console.log(usuario, ancho, JSON.stringify(info));
  await h.cerrar();
}
