import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const cap = JSON.parse(fs.readFileSync(new URL('../capacitor.config.json', import.meta.url), 'utf8'));

test('mobile UI removes bootstrap/debug placeholder copy', () => {
  for (const banned of ['Shell Android listo', 'CRM móvil por clienteId', 'La escritura autoritativa seguirá en Core', 'Debug interno']) {
    assert.equal(main.includes(banned), false, `found banned copy: ${banned}`);
  }
});

test('top content respects Android safe area', () => {
  assert.match(css, /safe-area-inset-top/);
});

test('navigation uses vector icons instead of people emoji', () => {
  assert.equal(main.includes('👥'), false);
  assert.match(main, /icon\(/);
});

test('Capacitor native HTTP patch is enabled for cross-origin Core calls', () => {
  assert.equal(cap.plugins?.CapacitorHttp?.enabled, true);
});

test('login and real data views are present', () => {
  for (const word of ['Iniciar sesión','Buscar cliente','Vence hoy','Actualizar datos']) assert.match(main, new RegExp(word));
});


test('debug build number is injected by GitHub Actions instead of being hard-coded', () => {
  assert.match(main, /VITE_BUILD_NUMBER/);
  assert.equal(main.includes('1.0 · build 1</b>'), false);
});


test('Sorteos and Control Maestro are real read views, not coming-soon placeholders', () => {
  assert.match(main, /loadRaffles/);
  assert.match(main, /ensureControlMaster/);
  assert.equal(main.includes("simpleComing('Sorteos'"), false);
  assert.equal(main.includes("simpleComing('Control Maestro'"), false);
});

test('Nuevo CRM is a real mobile sale form and Catalog is not a bottom-nav destination', () => {
  for (const field of ['Cliente titular','Teléfono','Plataforma','Correo / usuario','Clave / serial','Precio','Fecha de renovación']) assert.match(main, new RegExp(field.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')));
  assert.match(main, /Registrar venta/);
  assert.match(main, /\['nuevo-crm','Nuevo CRM','add'\]/);
  assert.equal(/\['catalogo','Catálogo','catalog'\]/.test(main), false);
});

test('Clientes keeps Sublichat operational filters and actions on mobile', () => {
  for (const text of ['Vigentes','Hoy','Próximos','Vencidos','Plataformas','Vendedores','Mostrar','Cobros de hoy','Editar cliente / ficha CRM','Acceso URL y 6 variantes','No renovó']) {
    assert.match(main, new RegExp(text.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')));
  }
  assert.match(main,/data-client-whatsapp/);
  assert.match(main,/data-client-actions/);
});

test('WhatsApp uses a native Android intent launcher instead of window.location intent URLs', () => {
  assert.match(main, /capacitor-intent-launcher/);
  assert.match(main, /ActivityAction\.VIEW/);
  assert.match(main, /packageName/);
  assert.equal(main.includes('window.location.href=`intent://send'), false);
});


test('Clientes WhatsApp opens the selected client phone directly instead of renewal', () => {
  assert.match(main, /function requestClientWhatsApp\(row/);
  assert.match(main, /normalizeWhatsAppPhone/);
  assert.match(main, /data-client-whatsapp.*requestClientWhatsApp/);
  assert.match(main, /wa\.me\/\$\{phone\}/);
  assert.equal(/data-client-whatsapp.*openRenewForRow/.test(main), false);
});
