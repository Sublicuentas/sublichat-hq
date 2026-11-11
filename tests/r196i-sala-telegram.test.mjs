// R196i · Sala: el nombre del bot sale de sala_config/telegram (lo publica el bot de Render) si Vercel no tiene TELEGRAM_BOT_USERNAME.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('Sala usa el nombre publicado por el bot y ya no pide la variable de Vercel', () => {
  const api = fs.readFileSync(new URL('../api/sala-juntas.js', import.meta.url), 'utf8');
  assert.match(api, /async function botUsernameDe\(db, env\)/);
  assert.match(api, /collection\('sala_config'\)\.doc\('telegram'\)/);
  assert.match(api, /botTelegram: !!\(await botUsernameDe\(db, env\)\)/);
  assert.match(api, /const bot = await botUsernameDe\(db, env\);/);
  const web = fs.readFileSync(new URL('../sala-juntas.js', import.meta.url), 'utf8');
  assert.doesNotMatch(web, /Falta configurar el bot en Vercel/);
});
