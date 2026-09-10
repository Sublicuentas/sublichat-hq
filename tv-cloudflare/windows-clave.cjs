'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

function readOrCreate(dir) {
  const file = path.join(dir, '.env.cloudflare');
  try {
    const key = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(file, 'TV_BROWSER_SECRET=' + key + '\n', { flag: 'wx', mode: 0o600 });
  } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const match = /^TV_BROWSER_SECRET=([a-f0-9]{64})\r?\n?$/.exec(fs.readFileSync(file, 'utf8'));
  if (!match) throw new Error('La clave local no es valida. No se cambio ni sobrescribio el archivo existente.');
  return match[1];
}

if (require.main === module) {
  try {
    if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Instale Node.js 24 LTS para Windows.');
    for (const file of ['../activar-tv-platforms.js', '../tv-browser/manager.js', '../tv-browser/platform-browser.js', '../tv-browser/network.js']) {
      if (!fs.existsSync(path.resolve(__dirname, file))) throw new Error('Extraiga el ZIP completo, conservando las carpetas juntas. Falta: ' + file);
    }
    const action = process.argv[2];
    if (action === 'copy') {
      if (process.platform !== 'win32') throw new Error('La copia al portapapeles requiere Windows.');
      const key = readOrCreate(__dirname);
      const result = spawnSync('clip.exe', { input: key, encoding: 'utf8', windowsHide: true });
      if (result.error || result.status !== 0) throw new Error('No se pudo copiar al portapapeles de Windows.');
      console.log('Clave copiada al portapapeles. Use la misma en Cloudflare y Vercel.');
      console.log('La clave local se conserva; ejecutar este paso otra vez no la cambia.');
    } else if (action !== 'check') throw new Error('Use check o copy.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { readOrCreate };
