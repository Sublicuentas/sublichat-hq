// Laboratorio: renderiza avatares (frente/lado/sentado) para revisar postura y accesorios. Uso: node tests/visual/lab-avatar.mjs <salida.png> [json cfgs]
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { crearApp } = await import(path.join(ROOT, 'server.mjs'));
const app = await crearApp(); const srv = app.listen(0); await new Promise((r) => srv.once('listening', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const out = process.argv[2] || '/tmp/lab.png';
const cfgs = JSON.parse(process.argv[3] || '[{"genero":"mujer","lentes":true,"aretes":true,"collar":true,"reloj":true,"logo":true,"superior":"blazer","colorSuperior":"#1F2A44","colorInterior":"#FFFFFF"},{"genero":"hombre","lentes":true,"reloj":true,"logo":true,"superior":"traje","colorSuperior":"#2B2F36"}]');
const vistas = JSON.parse(process.argv[4] || '["frente","lado","cerca","sentado"]');
const html = `<!doctype html><body style="margin:0;background:#fff"><canvas id=c></canvas><script>window.__labAvatar=[];window.__sinProf=1</script><script type=module>
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
import { crearAvatar } from '/avatar-glb.js?x=${Date.now()}';
const cfgs=${JSON.stringify(cfgs)}, vistas=${JSON.stringify(vistas)}; const W=360,H=520;
const r=new THREE.WebGLRenderer({canvas:c,antialias:true,preserveDrawingBuffer:true}); r.setSize(W*vistas.length,H*cfgs.length); r.setClearColor('#F4F1EC'); r.outputColorSpace=THREE.SRGBColorSpace; r.setScissorTest(true);
for (let i=0;i<cfgs.length;i++) for (let j=0;j<vistas.length;j++){ const vv=vistas[j];
  const e=new THREE.Scene(); e.add(new THREE.HemisphereLight('#ffffff','#776655',1.3)); const d=new THREE.DirectionalLight('#fff',1.6); d.position.set(1.5,3,3); e.add(d);
  const a=await crearAvatar(cfgs[i],{sentado:vv==='sentado'}); e.add(a); a.userData.avatar.animar(vv==='habla'?0.3:0,vv==='habla'?1:0,{});
  const cam=new THREE.PerspectiveCamera(vv==='cerca'?22:(vv.startsWith('mano')?20:30),W/H,0.05,50);
  if(vv==='habla'){cam.position.set(0,1.5,0.9);cam.lookAt(0,1.45,0);} else if(vv==='frente'){cam.position.set(0,1.0,3.6);cam.lookAt(0,0.88,0);} else if(vv==='lado'){cam.position.set(3.4,1.0,1.2);cam.lookAt(0,0.88,0);} else if(vv==='tres'){cam.position.set(-2.2,1.2,2.6);cam.lookAt(0,0.88,0);} else if(vv==='busto'){cam.position.set(0,1.4,1.25);cam.lookAt(0,1.38,0);} else if(vv==='mano'){cam.position.set(0.9,0.85,0.9);cam.lookAt(0.22,0.8,0.05);} else if(vv==='manoF'){cam.position.set(0.25,0.85,1.1);cam.lookAt(0.22,0.8,0.0);} else if(vv==='cerca'){cam.position.set(0.5,1.5,1.0);cam.lookAt(0,1.4,0);} else {cam.position.set(1.6,1.2,2.8);cam.lookAt(0,0.75,0);}
  const y=(cfgs.length-1-i)*H; r.setViewport(j*W,y,W,H); r.setScissor(j*W,y,W,H); r.render(e,cam);}
window.__ok=1; </script>`;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage();
await p.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(ROOT, 'tests/visual/vendor/three-0.160.0.module.min.js'), 'utf8') }));
await p.route(base + '/__lab', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' ? errs.push(m.text()) : console.log(m.text().slice(0,900)));
await p.goto(base + '/__lab'); await p.waitForFunction(() => window.__ok, null, { timeout: 90000 }).catch(() => {});
await (await p.$('#c')).screenshot({ path: out }); console.log(errs.length ? errs : 'ok', out);
await b.close(); srv.close();
