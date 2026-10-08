import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('R123: finanzas_reporte manda los anulados aparte y no los suma (Ingresos, Egresos, Planilla ni totales)', () => {
  const src = fs.readFileSync(new URL('../api/finanzas.js', import.meta.url), 'utf8');
  assert.match(src, /const vigentes = views\.filter\(\(v\) => !anuladoR123\(v\) && !v\.reversaDe\);/);
  assert.match(src, /const ingresos = agruparPagos\(vigentes\.filter\(\(v\) => v\.kind === "ingreso"\)\);/);
  assert.match(src, /const totales = cycleTotals\(all\.filter\(\(m\) => !\["anulado", "corregido"\]\.includes\(m\.estadoFinanciero\) && !m\.reversaDe\), desde, hasta\);/);
  assert.match(src, /egresos: vigentes\.filter\(\(v\) => v\.kind === "egreso"\), planillaMovs: vigentes\.filter\(\(v\) => v\.kind === "planilla"\), anulados,/);
  assert.match(src, /motivoAnulacion: m\.motivoAnulacion \|\| m\.motivoCorreccion \|\| "", anuladoPor: m\.anuladoPor \|\| "", anuladoAt: m\.anuladoAt \|\| ""/);
});
