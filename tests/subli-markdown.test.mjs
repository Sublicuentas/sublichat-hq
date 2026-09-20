import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const web = read('sublichat-app.js');
const block = web.slice(web.indexOf('/* SUBLI-MD:START'), web.indexOf('/* SUBLI-MD:END */'));
const { sbMdToHtml, sbMdToPlain, sbEscHtml } = new Function(`${block}\nreturn { sbMdToHtml, sbMdToPlain, sbEscHtml };`)();

// Texto real de las respuestas que se veían con asteriscos y sin orden.
const muestra = [
  'Como hoy es **domingo 20 de septiembre de 2026**, el total es **Lps. 5,094.00**.',
  '',
  '### **Lunes 21 de septiembre**',
  '* **Gisselle Fajardo** (8900-0958) - ViX: **Lps. 120.00**',
  '* **Isabella Orellana** (9905-4237) - Prime Video: **Lps. 90.00**',
].join('\n');

test('web: Subli muestra negritas, encabezados y viñetas (sin asteriscos)', () => {
  const html = sbMdToHtml(muestra);
  assert.match(html, /<strong>domingo 20 de septiembre de 2026<\/strong>/);
  assert.match(html, /<h4 class="md-h"><strong>Lunes 21 de septiembre<\/strong><\/h4>/);
  assert.match(html, /<ul><li><strong>Gisselle Fajardo<\/strong> \(8900-0958\) - ViX: <strong>Lps\. 120\.00<\/strong><\/li>/);
  assert.equal((html.match(/<li>/g) || []).length, 2);
  assert.doesNotMatch(html, /\*\*/);
  assert.doesNotMatch(sbMdToPlain(muestra), /[*#]/);
});

test('web: el HTML que venga de la IA se escapa (nunca se ejecuta)', () => {
  const html = sbMdToHtml('<img src=x onerror=alert(1)> y <script>alert(2)</script>');
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;img/);
  assert.equal(sbEscHtml('a<b>&"\''), 'a&lt;b&gt;&amp;&quot;&#39;');
});

test('web: listas largas se recogen ("Ver N más") y las tablas se dibujan', () => {
  const largo = Array.from({ length: 30 }, (_, i) => `- **Cliente ${i + 1}** · Lps. ${i + 1}.00`).join('\n');
  const html = sbMdToHtml(largo);
  assert.match(html, /<details class="md-more"><summary>Ver 15 más<\/summary>/);
  assert.equal((html.match(/<li>/g) || []).length, 30);
  const tabla = sbMdToHtml('| Plataforma | Total |\n|---|---|\n| Netflix | Lps. 100.00 |');
  assert.match(tabla, /<div class="md-table"><table>/);
  assert.match(tabla, /<th>Plataforma<\/th>/);
});

test('web: send() pinta la respuesta con formato y habla el texto limpio', () => {
  assert.match(web, /add\(conFormato\?sbMdToHtml\(resp\):sbEscHtml\(resp\),conFormato\?"bot md":"bot note"\)/);
  assert.match(web, /hablar\(conFormato\?sbMdToPlain\(resp\):resp\)/);
  const html = read('index.html');
  assert.match(html, /\.msg\.md\{white-space:normal/);
  assert.match(html, /\.msg\.md ul li:before/);
});

test('api/chat: cifras exactas, fecha de Honduras y formato profesional en el prompt', () => {
  const chat = read('api/chat.js');
  assert.match(chat, /function buildResumen\(clientes, hoyISO\)/);
  assert.match(chat, /RESUMEN PRECALCULADO \(cifras exactas, JSON\)/);
  assert.match(chat, /const TZ_HN = "America\/Tegucigalpa"/);
  assert.match(chat, /const hoyISO = fechaHN\(\)/);
  assert.match(chat, /FORMATO DE RESPUESTA \(obligatorio/);
  assert.match(chat, /Máximo 15 viñetas por lista/);
  assert.match(chat, /respuesta: isRewrite \? respuesta : normalizarRespuesta\(respuesta\)/);
});
