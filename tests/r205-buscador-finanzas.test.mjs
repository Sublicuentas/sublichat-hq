// R205 · Buscador de correo/cuenta/cliente en todas las tablas de Finanzas; Ganancias encuentra la plataforma por el correo.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const R = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
test("buscador universal montado en cada tabla (también en modales)", () => {
  const js = R("finanzas-web.js");
  assert.match(js, /function busMontar/); assert.match(js, /'\.fz \.fz-tw, \.fz-modal \.fz-tw'/);
  assert.match(js, /Buscar correo, cuenta, cliente, banco/);
  assert.match(js, /new MutationObserver\(function \(ms\) \{\n\s*if \(busPend\) return;/);
});
test("Ganancias: filas con el índice de correos y el servidor lo manda", () => {
  assert.match(R("finanzas-web.js"), /data-busca="' \+ esc\(busIndice\(x, p\.plataforma\)\)/);
  assert.match(R("api/_finanzas-panel.js"), /const indice = plat \? undefined : r\.filas\.map/);
});
