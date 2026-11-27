// R202 · Viki Rakuten: tarjeta, link/activación y monedas con PHP; producto automático al registrar pago.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fc = require("../api/_finanzas-cuentas.js");

test("Viki acepta PHP, tarjeta y link", () => {
  const P = fc.PLATAFORMAS.viki;
  for (const m of ["USD", "PHP", "HNL", "USDT"]) assert.ok(P.monedas.includes(m), m);
  for (const m of ["tarjeta", "link", "gift_card"]) assert.ok(P.modalidades.includes(m), m);
});
test("un producto sin clave se reconoce por el nombre", () => {
  assert.equal(fc.plataformaDe("Viki Rakuten · cuenta madre"), "viki");
  const s = fs.readFileSync(new URL("../api/_finanzas-panel.js", import.meta.url), "utf8");
  assert.match(s, /plataformaDe\(p\.plataformaKey\) \|\| finCuentas\.plataformaDe\(p\.nombre\)/);
});
test("Registrar pago sin producto lo crea solo y abre el pago", () => {
  const w = fs.readFileSync(new URL("../finanzas-web.js", import.meta.url), "utf8");
  assert.match(w, /if \(!prods\.length\) \{ productoAuto\(x, P, mod, plat, id\); return; \}/);
  assert.match(w, /async function productoAuto[\s\S]*?fin_producto_guardar[\s\S]*?ya existe[\s\S]*?abrirCuenta\('pago', plat, id\)/);
});
