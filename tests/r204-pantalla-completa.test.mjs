// R204 · Pantalla completa y minimizar menú en toda la web, para todos los usuarios.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const R = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
test("botones en la barra superior y botón flotante para volver", () => {
  const js = R("ui-v2.js"), css = R("ui-v2.css");
  assert.match(js, /data-v2vista="min"/); assert.match(js, /data-v2vista="fs"/); assert.match(js, /data-v2vista="max"/);
  assert.match(js, /requestFullscreen/); assert.match(js, /fullscreenchange/);
  assert.match(js, /sublichat_menu_min/);
  assert.match(css, /html\.ui-v2\.v2-min \.v2-top,html\.ui-v2\.v2-min \.v2-nav\{display:none!important\}/);
  assert.doesNotMatch(css.slice(css.indexOf("R204")), /gradient/);
});
test("no depende del rol: se monta junto al encabezado de todos", () => {
  const js = R("ui-v2.js"); assert.match(js, /vistaTrabajo\(\);\n\s*construir\(\); usuario\(\); campana\(\);/);
});
