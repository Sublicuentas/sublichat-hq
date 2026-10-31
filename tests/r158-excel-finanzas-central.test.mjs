// R158 · La Web no arma el Excel de finanzas: pide el archivo al exportador central (backend del bot) y lo entrega tal cual.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('api/_rev-api: inicia sesión con el admin del backend, pide /rev/admin/finanzas/excel y devuelve la respuesta sin tocarla', async () => {
  process.env.REV_ADMIN_USER = 'admin_prueba'; process.env.REV_ADMIN_PASSWORD = 'clave_prueba'; process.env.REV_API_BASE = 'https://backend.ejemplo.test';
  const llamadas = [];
  const payload = { ok: true, filename: 'Sublicuentas_Finanzas_2026-10-01_a_2026-10-31.xlsx', version: 'plataformas-1.0', base64: 'UEsDBAo=' };
  globalThis.fetch = async (url, opts = {}) => {
    llamadas.push({ url: String(url), opts });
    if (String(url).endsWith('/rev/login')) return new Response(JSON.stringify({ token: 'tok123' }), { status: 200 });
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  const { revAdminGet } = await import('../api/_rev-api.js?t=' + Date.now());
  const r = await revAdminGet('finanzas/excel', { desde: '2026-10-01', hasta: '2026-10-31' }, 'sublicuentas');
  assert.equal(r.status, 200); assert.deepEqual(r.data, payload);
  const pedido = llamadas.find((l) => l.url.includes('/rev/admin/finanzas/excel'));
  assert.equal(pedido.url, 'https://backend.ejemplo.test/rev/admin/finanzas/excel?desde=2026-10-01&hasta=2026-10-31');
  assert.equal(pedido.opts.headers.Authorization, 'Bearer tok123');
  assert.ok(!pedido.url.includes('clave_prueba') && !pedido.url.includes('tok123'), 'credenciales nunca en la URL');
});

test('api/finanzas.js: exportar_excel_finanzas exige permiso de Finanzas y solo reenvía (no recalcula); la Web usa esa acción', () => {
  const api = fs.readFileSync(new URL('../api/finanzas.js', import.meta.url), 'utf8');
  const bloque = api.slice(api.indexOf('if (accion === "exportar_excel_finanzas")'), api.indexOf('if (["finanzas_reporte", "finanzas_metodos",'));
  assert.match(bloque, /canUseLibro\(identity\)/);
  assert.match(bloque, /revAdminGet\("finanzas\/excel"/);
  assert.doesNotMatch(bloque, /ExcelJS|movementsQuery|monto/, 'sin cálculos financieros en la Web');
  const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(app, /finXlsBtn\.addEventListener\("click",\(\)=>finExcelCentral\(\)\)/);
  assert.match(app, /accion:"exportar_excel_finanzas"/);
});
