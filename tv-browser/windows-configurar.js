'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseEnv } = require('node:util');
const { spawnSync } = require('node:child_process');

function configure(directory, create = false) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Instale Node.js 24 LTS para Windows y vuelva a abrir este archivo.');
  const file = path.join(directory, '.env.windows');
  if (create && !fs.existsSync(file)) {
    fs.writeFileSync(file, [
      '# Configuracion privada de esta computadora. No subir a GitHub ni compartir.',
      'TV_BROWSER_SECRET=' + crypto.randomBytes(32).toString('hex'),
      'TV_LISTEN_HOST=127.0.0.1',
      'PORT=8080',
      'TV_MAX_SESSIONS=3',
      '# Netflix habilitado solo para la primera prueba. Compruebe cada plataforma.',
      'TV_ENABLED_PLATFORMS=netflix',
      ''
    ].join('\r\n'), { flag: 'wx', mode: 0o600 });
  }
  if (!fs.existsSync(file)) throw new Error('Primero abra 01_INSTALAR_WINDOWS.cmd.');
  const config = parseEnv(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if ((config.TV_BROWSER_SECRET || '').length < 32) throw new Error('La clave de .env.windows debe tener al menos 32 caracteres. No se ha reemplazado su configuracion.');
  if (config.TV_LISTEN_HOST !== '127.0.0.1' || config.PORT !== '8080') throw new Error('En .env.windows, use TV_LISTEN_HOST=127.0.0.1 y PORT=8080 para estos accesos de Windows.');
  const valid = new Set(require('../activar-tv-platforms').platforms.map(p => p.id));
  const enabled = (config.TV_ENABLED_PLATFORMS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (enabled.some(id => !valid.has(id))) throw new Error('Revise TV_ENABLED_PLATFORMS en .env.windows: disney,netflix,hbo,prime,crunchyroll,paramount.');
  return config;
}

async function main() {
  const action = process.argv[2];
  if (action === 'health') {
    const result = await fetch('http://127.0.0.1:8080/healthz', { signal: AbortSignal.timeout(4000) });
    if (!result.ok || !(await result.json()).ok) throw new Error('Primero abra 02_INICIAR_WINDOWS.cmd y mantenga esa ventana abierta.');
    console.log('Servicio local disponible.');
    return;
  }
  const config = configure(__dirname, action === 'configure');
  if (action === 'copy') {
    if (process.platform !== 'win32') throw new Error('Este acceso copia la clave en el portapapeles de Windows.');
    const clip = spawnSync('clip.exe', [], { input: config.TV_BROWSER_SECRET, encoding: 'utf8', windowsHide: true });
    if (clip.error || clip.status !== 0) throw new Error('No se pudo copiar. Abra .env.windows con el Bloc de notas y copie solo el valor de TV_BROWSER_SECRET.');
    console.log('Clave copiada. En Vercel, peguela como valor de TV_BROWSER_SECRET. No es la clave de Netflix ni de Sublichat.');
  } else if (['configure', 'check'].includes(action)) {
    console.log('Configuracion lista. Se conserva la misma clave para futuros inicios.');
  } else throw new Error('Accion no valida. Use los accesos .cmd incluidos.');
}
if (require.main === module) main().catch(error => {
  console.error(error.message === 'fetch failed' ? 'No se encontro el servicio. Abra primero 02_INICIAR_WINDOWS.cmd.' : error.message);
  process.exitCode = 1;
});
module.exports = { configure };
