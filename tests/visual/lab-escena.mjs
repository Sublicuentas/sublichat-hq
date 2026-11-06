// Laboratorio: renderiza escenarios con estilos de ambiente. Uso: node tests/visual/lab-escena.mjs <salida.png> '<json [[id, estilo], ...]>'
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { crearApp } = await import(path.join(ROOT, 'server.mjs'));
const app = await crearApp(); const srv = app.listen(0); await new Promise((r) => srv.once('listening', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const out = process.argv[2]; const lista = JSON.parse(process.argv[3]);
const html = `<!doctype html><body style="margin:0;background:#fff"><canvas id=c></canvas><script type=module>
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
import { construir } from '/escenarios.js?x=${Date.now()}';
const L=${JSON.stringify(lista)}; const W=640,H=400, cols=Math.min(2,L.length), rows=Math.ceil(L.length/cols);
const logo=await new Promise(ok=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>ok(null);i.src='/assets/sublicuentas-logo.png';});
const r=new THREE.WebGLRenderer({canvas:c,antialias:true,preserveDrawingBuffer:true}); r.setSize(W*cols,H*rows); r.outputColorSpace=THREE.SRGBColorSpace; r.toneMapping=THREE.ACESFilmicToneMapping; r.setScissorTest(true);
L.forEach(([id,est],i)=>{ const e=new THREE.Scene(); const E=construir(e,id,est,{logo}); r.toneMappingExposure=E.exp||1.05; const cam=new THREE.PerspectiveCamera(46,W/H,0.1,60); const v=E.vistas.general; cam.position.set(...v.pos); cam.lookAt(...v.mira);
 const x=(i%cols)*W, y=(rows-1-Math.floor(i/cols))*H; r.setViewport(x,y,W,H); r.setScissor(x,y,W,H); r.render(e,cam); });
window.__ok=1;</script>`;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage();
await p.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(ROOT, 'tests/visual/vendor/three-0.160.0.module.min.js'), 'utf8') }));
await p.route(base + '/__lab', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(base + '/__lab'); await p.waitForFunction(() => window.__ok, null, { timeout: 120000 }).catch(() => errs.push('timeout'));
await (await p.$('#c')).screenshot({ path: out }); console.log(errs.length ? errs : 'ok', out); await b.close(); srv.close();
