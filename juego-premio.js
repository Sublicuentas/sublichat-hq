/* SUBLICUENTAS · "Atrapa tu Premio" en el portal del cliente (/c/…) · Oct-2026
   - El SERVIDOR decide el premio (api/sorteos.js · juego_jugar) y lo guarda antes de animar;
     este archivo solo anima el resultado autorizado. Si la animación falla o se recarga, el premio ya está guardado.
   - Máquina 3D real (three.js) con garra física; en teléfonos lentos, sin WebGL o con "reducir movimiento"
     usa una versión 2.5D liviana con el mismo storyboard.
   - Storyboard: IDLE → BÚSQUEDA → DESCENSO → AGARRE → SUBIDA → TRASLADO → CAÍDA → REVELACIÓN (≈5–6 s).
   - Sonido opcional (sin archivos, WebAudio) con botón para apagarlo. */
(function atrapaTuPremio(){
  'use strict';
  const API='/api/sorteos';
  const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
  const LOGOS={spotify:'/assets/platformas/spotify.jpg',primevideo:'/assets/platformas/prime.jpg',hbomax:'/assets/platformas/hbo.jpg',crunchyroll:'/assets/platformas/crunchyroll.jpg',canva:'/assets/platformas/canva.jpg',duolingo:'/assets/platformas/duolingo.jpg'};
  const PLAT_NOMBRE={spotify:'Spotify',primevideo:'Prime Video',hbomax:'Max',crunchyroll:'Crunchyroll',canva:'Canva',duolingo:'Duolingo'};
  const COLORES={comun:['#E2231A','#FFFFFF'],medio:['#111827','#FFFFFF'],premium:['#FFFFFF','#E2231A']};
  const reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S={token:'',estado:null,ocupado:false,tab:'jugar',motor:null,motorTipo:'',sonido:leerSonido(),root:null,vistos:new Set()};

  function token(){
    const p=new URLSearchParams(location.search);let t=p.get('token')||'';
    if(!t){const m=location.pathname.match(/\/c\/([^/?#]+)/);if(m)t=decodeURIComponent(m[1]);}
    return t;
  }
  function leerSonido(){try{return localStorage.getItem('jp-sonido')!=='0'}catch(_){return true}}
  function guardarSonido(v){try{localStorage.setItem('jp-sonido',v?'1':'0')}catch(_){}}
  function claveVistos(){return 'jp-vistos-'+String(S.token).slice(-12)}
  function cargarVistos(){try{S.vistos=new Set(JSON.parse(localStorage.getItem(claveVistos())||'[]'))}catch(_){S.vistos=new Set()}}
  function marcarVisto(id){S.vistos.add(id);try{localStorage.setItem(claveVistos(),JSON.stringify([...S.vistos].slice(-60)))}catch(_){}}
  const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n;};
  const fechaCorta=(iso)=>{const d=new Date(iso);return isNaN(d)?'':d.toLocaleDateString('es-HN',{day:'2-digit',month:'short',year:'numeric'})};

  async function api(body){
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,token:S.token}),cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.ok===false)throw Object.assign(new Error(j.error||'No se pudo conectar. Intente de nuevo.'),{status:r.status});
    return j;
  }

  /* ---------- Sonido (WebAudio, sin archivos) ---------- */
  let audio=null;
  function ctx(){if(!S.sonido)return null;try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();return audio}catch(_){return null}}
  function tono(freq,dur,{tipo='sine',vol=.08,hasta=null}={}){const a=ctx();if(!a)return;const o=a.createOscillator(),g=a.createGain();o.type=tipo;o.frequency.setValueAtTime(freq,a.currentTime);if(hasta)o.frequency.exponentialRampToValueAtTime(hasta,a.currentTime+dur);g.gain.setValueAtTime(vol,a.currentTime);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+dur);o.connect(g).connect(a.destination);o.start();o.stop(a.currentTime+dur)}
  let motorSonido=null;
  function motorOn(){const a=ctx();if(!a||motorSonido)return;const o=a.createOscillator(),f=a.createBiquadFilter(),g=a.createGain();o.type='sawtooth';o.frequency.value=70;f.type='lowpass';f.frequency.value=260;g.gain.value=.025;o.connect(f).connect(g).connect(a.destination);o.start();motorSonido={o,g}}
  function motorOff(){if(!motorSonido)return;try{motorSonido.g.gain.exponentialRampToValueAtTime(.0001,(audio?.currentTime||0)+.15);motorSonido.o.stop((audio?.currentTime||0)+.2)}catch(_){}motorSonido=null}
  const sClack=()=>{tono(900,.06,{tipo:'square',vol:.05});tono(420,.08,{tipo:'triangle',vol:.06})};
  const sCaida=()=>tono(180,.25,{hasta:55,vol:.12});
  const sPremio=()=>{tono(660,.16,{vol:.07});setTimeout(()=>tono(990,.28,{vol:.07}),140)};

  /* ---------- Utilidades de animación ---------- */
  const ease=(t)=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  function animar(ms,fn){return new Promise(res=>{const t0=performance.now();const paso=(t)=>{const e=Math.min(1,(t-t0)/ms);fn(ease(e),e);if(e<1)requestAnimationFrame(paso);else res();};requestAnimationFrame(paso);});}
  const esperar=(ms)=>new Promise(r=>setTimeout(r,ms));

  /* ---------- Texturas de las bolas ---------- */
  function cargarImg(src){return new Promise(res=>{if(!src)return res(null);const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src=src;});}
  async function lienzoBola(premio){
    const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');
    const [fondo,texto]=COLORES[premio.tier]||COLORES.comun;
    g.fillStyle=fondo;g.fillRect(0,0,512,256);
    g.fillStyle=premio.tier==='premium'?'#E2231A':'#FFFFFF';g.fillRect(0,118,512,20); // franja ecuatorial
    const img=premio.tipo==='mes_gratis'?await cargarImg(LOGOS[premio.plataforma]):null;
    for(const cx of [128,384]){
      g.save();g.beginPath();g.arc(cx,128,92,0,Math.PI*2);g.fillStyle='#FFFFFF';g.fill();g.clip();
      if(img){g.drawImage(img,cx-82,46,164,164);}
      else{g.fillStyle='#E2231A';g.font='900 54px system-ui, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(premio.etiqueta||'',cx,128,168);}
      g.restore();
    }
    return c;
  }
  function etiquetaPremio(p){return p.tipo==='mes_gratis'?(PLAT_NOMBRE[p.plataforma]||p.etiqueta):p.etiqueta}

  /* ---------- Motor 3D (three.js) ---------- */
  async function motor3D(host,premios,alSerLento){
    const THREE=await import(THREE_URL);
    const W=host.clientWidth||320,H=host.clientHeight||420;
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(W,H);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=W>380;
    host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#F5F7FA');
    const camera=new THREE.PerspectiveCamera(36,W/H,.1,100);camera.position.set(0,3.6,9.9);camera.lookAt(0,2.6,0);
    scene.add(new THREE.HemisphereLight(0xffffff,0xdfe6ee,1.05));
    const sol=new THREE.DirectionalLight(0xffffff,1.25);sol.position.set(3,8,6);sol.castShadow=true;sol.shadow.mapSize.set(1024,1024);scene.add(sol);
    const rojo=new THREE.MeshStandardMaterial({color:0xE2231A,roughness:.45,metalness:.1});
    const negro=new THREE.MeshStandardMaterial({color:0x111827,roughness:.5,metalness:.35});
    const cian=new THREE.LineBasicMaterial({color:0x12AEE6,transparent:true,opacity:.75});
    const Wm=3.4,Dm=2.4,piso=1.1,alto=3.4,techo=piso+alto;
    // Gabinete
    const gab=new THREE.Mesh(new THREE.BoxGeometry(Wm+.3,piso,Dm+.3),rojo);gab.position.y=piso/2;gab.receiveShadow=true;scene.add(gab);
    const suelo=new THREE.Mesh(new THREE.BoxGeometry(Wm,.04,Dm),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9}));suelo.position.y=piso+.02;suelo.receiveShadow=true;scene.add(suelo);
    for(const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const col=new THREE.Mesh(new THREE.BoxGeometry(.14,alto,.14),negro);col.position.set(x*Wm/2,piso+alto/2,z*Dm/2);scene.add(col);}
    const tapa=new THREE.Mesh(new THREE.BoxGeometry(Wm+.3,.36,Dm+.3),negro);tapa.position.y=techo+.18;scene.add(tapa);
    // Letrero
    const lc=document.createElement('canvas');lc.width=1024;lc.height=160;const lg=lc.getContext('2d');lg.fillStyle='#E2231A';lg.fillRect(0,0,1024,160);lg.fillStyle='#fff';lg.font='900 84px system-ui, sans-serif';lg.textAlign='center';lg.textBaseline='middle';lg.fillText('ATRAPA TU PREMIO',512,84);
    const ltex=new THREE.CanvasTexture(lc);ltex.colorSpace=THREE.SRGBColorSpace;
    const letrero=new THREE.Mesh(new THREE.PlaneGeometry(Wm+.3,.5),new THREE.MeshBasicMaterial({map:ltex}));letrero.position.set(0,techo+.62,Dm/2+.16);scene.add(letrero);
    const marco=new THREE.Mesh(new THREE.BoxGeometry(Wm+.4,.6,.1),negro);marco.position.set(0,techo+.62,Dm/2+.1);scene.add(marco);
    // Vidrio + bordes cian
    const vidrio=new THREE.MeshPhysicalMaterial({color:0xe9f8ff,transparent:true,opacity:.14,roughness:.05,metalness:0,side:THREE.DoubleSide,depthWrite:false});
    const caras=[[0,piso+alto/2,Dm/2,0,Wm],[0,piso+alto/2,-Dm/2,0,Wm],[Wm/2,piso+alto/2,0,Math.PI/2,Dm],[-Wm/2,piso+alto/2,0,Math.PI/2,Dm]];
    for(const [x,y,z,ry,w] of caras){const v=new THREE.Mesh(new THREE.PlaneGeometry(w,alto),vidrio);v.position.set(x,y,z);v.rotation.y=ry;scene.add(v);}
    const bordes=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(Wm,alto,Dm)),cian);bordes.position.y=piso+alto/2;scene.add(bordes);
    // Tolva (salida de premios) adelante a la izquierda
    const tolva={x:-Wm/2+.55,z:Dm/2-.5};
    const tMat=new THREE.MeshStandardMaterial({color:0x111827,roughness:.6});
    for(const [dx,dz,w,d] of [[0,-.42,.9,.06],[0,.42,.9,.06],[-.42,0,.06,.9],[.42,0,.06,.9]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,.7,d),tMat);m.position.set(tolva.x+dx,piso+.35,tolva.z+dz);scene.add(m);}
    const bandeja=new THREE.Mesh(new THREE.BoxGeometry(.9,.12,.5),tMat);bandeja.position.set(tolva.x,.28,Dm/2+.3);scene.add(bandeja);
    // Bolas
    const R=.3,bolas=[];
    const lista=[...premios];while(lista.length&&lista.length<14)lista.push(premios[lista.length%premios.length]);
    const geo=new THREE.SphereGeometry(R,32,24);
    const puestos=[];
    for(let capa=0;capa<2;capa++)for(let ix=0;ix<5;ix++)for(let iz=0;iz<3;iz++){const x=-Wm/2+.75+ix*.62+(capa?.31:0)+(iz%2?.12:0),z=-Dm/2+.45+iz*.62+(capa?.31:0);if(Math.hypot(x-tolva.x,z-tolva.z)<.85)continue;if(x>Wm/2-.35)continue;puestos.push([x,piso+R+.04+capa*R*1.55,z]);}
    for(let i=0;i<lista.length&&i<puestos.length;i++){
      const p=lista[i];const tex=new THREE.CanvasTexture(await lienzoBola(p));tex.colorSpace=THREE.SRGBColorSpace;
      const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:tex,roughness:.35,metalness:.05}));
      const [x,y,z]=puestos[i];m.position.set(x,y,z);m.rotation.set((Math.random()-.5)*.25,(Math.random()-.5)*.7,(Math.random()-.5)*.25);m.castShadow=true;
      m.userData={premio:p,base:new THREE.Vector3(x,y,z),fase:Math.random()*6};scene.add(m);bolas.push(m);
    }
    // Garra: carro sobre rieles, cable y 3 pinzas
    for(const z of [-.5,.5]){const riel=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,Wm,12),negro);riel.rotation.z=Math.PI/2;riel.position.set(0,techo-.12,z);scene.add(riel);}
    const carro=new THREE.Group();scene.add(carro);carro.position.set(.6,techo-.12,0);
    carro.add(new THREE.Mesh(new THREE.BoxGeometry(.5,.16,.5),negro));
    const cable=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,1,8),negro);carro.add(cable);
    const cabeza=new THREE.Group();carro.add(cabeza);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,.22,20),rojo);cabeza.add(hub);
    const pinzas=[];
    for(let k=0;k<3;k++){
      const piv=new THREE.Group();piv.rotation.y=k*2*Math.PI/3;cabeza.add(piv);
      const brazo=new THREE.Group();brazo.position.set(.14,-.08,0);piv.add(brazo);
      const a=new THREE.Mesh(new THREE.BoxGeometry(.05,.34,.05),negro);a.position.y=-.17;brazo.add(a);
      const b=new THREE.Mesh(new THREE.BoxGeometry(.05,.22,.05),negro);b.position.set(-.06,-.4,0);b.rotation.z=-.55;brazo.add(b);
      pinzas.push(brazo);
    }
    let largo=.55;
    const ponerCable=()=>{cable.scale.y=largo;cable.position.y=-largo/2;cabeza.position.y=-largo-.11;};
    const abrir=(t)=>pinzas.forEach(b=>{b.rotation.z=.55*(1-t)+(-.08)*t;});
    ponerCable();abrir(0);
    // Bucle de dibujo (idle suave)
    let vivo=true,atrapada=null,caida=null;const reloj=new THREE.Clock();
    let medidos=0,tPrev=0,suma=0; // si el teléfono no aguanta el 3D (≈<16 fps), se cambia solo a 2.5D
    const pos=new THREE.Vector3();
    function cuadro(){
      if(!vivo)return;requestAnimationFrame(cuadro);
      const t=reloj.getElapsedTime();
      if(medidos<=45){if(tPrev)suma+=t-tPrev;tPrev=t;if(++medidos===45&&suma/44>.062&&alSerLento)alSerLento();}
      for(const b of bolas){if(b===atrapada||b===caida)continue;b.position.y=b.userData.base.y+Math.sin(t*1.4+b.userData.fase)*.012;}
      if(atrapada){cabeza.getWorldPosition(pos);atrapada.position.set(pos.x,pos.y-.42,pos.z);}
      renderer.render(scene,camera);
    }
    cuadro();
    const ro=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});ro.observe(host);
    const moverCarro=(x,z,ms)=>{const x0=carro.position.x,z0=carro.position.z;motorOn();return animar(ms,e=>{carro.position.x=x0+(x-x0)*e;carro.position.z=z0+(z-z0)*e;}).then(motorOff);};
    let buscando=false,bucle=Promise.resolve();
    return {
      tipo:'3d',
      async buscar(){ // 02 BÚSQUEDA mientras el servidor responde
        if(buscando)return;buscando=true;
        bucle=(async()=>{while(buscando&&vivo){await moverCarro((Math.random()-.5)*(Wm-1),(Math.random()-.5)*(Dm-1),700);}})();
      },
      async atrapar(premio){
        buscando=false;await bucle;
        let bola=bolas.find(b=>b.userData.premio.id===premio.id);
        if(!bola){bola=bolas[Math.floor(Math.random()*bolas.length)];const tex=new THREE.CanvasTexture(await lienzoBola(premio));tex.colorSpace=THREE.SRGBColorSpace;bola.material.map=tex;bola.material.needsUpdate=true;}
        await moverCarro(bola.position.x,bola.position.z,1100);                                  // 02
        const l0=largo,l1=Math.max(.6,(techo-.12)-bola.position.y-.42-.11);
        motorOn();await animar(900,e=>{largo=l0+(l1-l0)*e;ponerCable();});motorOff();             // 03 DESCENSO
        sClack();if(navigator.vibrate)try{navigator.vibrate(30)}catch(_){}                        // 04 AGARRE
        await animar(320,e=>abrir(e));
        await animar(160,e=>{largo=l1+.05*Math.sin(e*Math.PI);ponerCable();});
        atrapada=bola;
        motorOn();await animar(850,e=>{largo=l1+(l0-l1)*e;ponerCable();});motorOff();             // 05 SUBIDA
        await moverCarro(tolva.x,tolva.z,1000);                                                   // 06 TRASLADO
        atrapada=null;caida=bola;await animar(180,e=>abrir(1-e));                                  // 07 CAÍDA
        const y0=bola.position.y,yf=piso-.55;
        await animar(520,(e,lin)=>{bola.position.y=y0-(y0-yf)*lin*lin;});
        sCaida();await animar(260,e=>{bola.position.y=yf+.18*Math.sin(e*Math.PI)*(1-e);});
        await animar(300,e=>{bola.position.z=tolva.z+(Dm/2+.3-tolva.z)*e;bola.position.y=yf+(.55-yf)*e;});
        sPremio();                                                                                // 08 REVELACIÓN
      },
      parar(){buscando=false;},
      async reiniciar(){ // deja la máquina lista para otra jugada
        buscando=false;await bucle;if(caida){const b=caida;caida=null;b.position.copy(b.userData.base);}
        await moverCarro(.6,0,500);
      },
      destruir(){vivo=false;ro.disconnect();renderer.dispose();renderer.domElement.remove();},
    };
  }

  /* ---------- Motor 2.5D (respaldo liviano) ---------- */
  async function motor25(host,premios){
    const raiz=el('div','jp-25');raiz.innerHTML='<div class="jp-25-box"></div><div class="jp-25-rail"></div><div class="jp-25-chute"></div>';
    const garra=el('div','jp-25-claw');garra.innerHTML='<div class="jp-25-cable"></div><div class="jp-25-head"></div>';raiz.append(garra);
    const lista=[...premios].slice(0,10);
    const bolas=lista.map((p,i)=>{const b=el('div','jp-25-ball');const x=32+(i%5)*11+(Math.floor(i/5)%2?4:0),y=58+Math.floor(i/5)*12;b.style.left=x+'%';b.style.top=y+'%';
      if(p.tipo==='mes_gratis'&&LOGOS[p.plataforma])b.style.backgroundImage=`url("${LOGOS[p.plataforma]}")`;else b.textContent=p.etiqueta;b.dataset.id=p.id;raiz.append(b);return b;});
    host.append(raiz);
    const cable=garra.querySelector('.jp-25-cable');
    const rapido=reduceMotion?.15:1;
    return {
      tipo:'25',
      async buscar(){},
      parar(){},
      async atrapar(premio){
        let b=bolas.find(x=>x.dataset.id===premio.id)||bolas[0];
        if(!bolas.some(x=>x.dataset.id===premio.id)){b.style.backgroundImage=premio.tipo==='mes_gratis'&&LOGOS[premio.plataforma]?`url("${LOGOS[premio.plataforma]}")`:'';b.textContent=premio.tipo==='mes_gratis'?'':premio.etiqueta;}
        const bx=parseFloat(b.style.left),by=parseFloat(b.style.top);
        garra.style.left=(bx+5.5)+'%';await esperar(950*rapido);
        cable.style.height=`${Math.max(30,(by-20)/100*host.clientHeight)}px`;await esperar(850*rapido);
        garra.classList.add('cerrada');sClack();await esperar(350*rapido);
        cable.style.height='30px';b.style.top='22%';await esperar(850*rapido);
        garra.style.left='21%';b.style.left='15.5%';await esperar(950*rapido);
        garra.classList.remove('cerrada');b.style.top='74%';sCaida();await esperar(700*rapido);
        sPremio();
      },
      async reiniciar(){garra.style.left='50%';},
      destruir(){raiz.remove();},
    };
  }

  function webglOk(){try{const c=document.createElement('canvas');return !!(window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl')))}catch(_){return false}}
  function telefonoLento(){let marcado=false;try{marcado=localStorage.getItem('jp-lento')==='1'}catch(_){}const mem=navigator.deviceMemory,cpu=navigator.hardwareConcurrency;return marcado||(mem&&mem<=2)||(cpu&&cpu<=2)}
  async function prepararMotor(host){
    if(S.motor)return S.motor;
    const premios=(S.estado?.premios||[]);
    const forzar3d=/[?&]jp3d=1/.test(location.search);
    const usar3d=!reduceMotion&&webglOk()&&!/[?&]jp25=1/.test(location.search)&&(forzar3d||!telefonoLento());
    const aLento=()=>{if(S.ocupado||!S.motor||S.motor.tipo!=='3d')return;try{localStorage.setItem('jp-lento','1')}catch(_){}S.motor.destruir();S.motor=null;host.innerHTML='';prepararMotor(host);};
    try{S.motor=usar3d?await motor3D(host,premios,aLento):await motor25(host,premios);}
    catch(e){console.warn('Atrapa tu Premio: 3D no disponible, se usa 2.5D',e);host.innerHTML='';S.motor=await motor25(host,premios);}
    S.motorTipo=S.motor.tipo;S.root?.setAttribute('data-motor',S.motorTipo);
    return S.motor;
  }

  /* ---------- Interfaz ---------- */
  function fab(){
    let b=document.querySelector('.jp-fab');
    const n=S.estado?.disponibles||0;
    if(!S.estado||(!n&&!(S.estado.historial||[]).length)){b?.remove();return;} // en pausa igual se ve: sus fichas siguen guardadas
    if(!b){b=el('button','jp-fab');b.type='button';b.addEventListener('click',abrir);S.root.append(b);}
    b.classList.toggle('jp-sin-fichas',!n);
    b.innerHTML=n?`🎮 Atrapa tu premio <b>${n}</b>`:'🎁 Tus premios';
    b.setAttribute('aria-label',n?`Atrapa tu premio: ${n} ficha${n===1?'':'s'} disponible${n===1?'':'s'}`:'Ver mis premios');
  }
  function overlay(){
    let o=S.root.querySelector('.jp-overlay');if(o)return o;
    o=el('div','jp-overlay');o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-label','Atrapa tu premio');o.hidden=true;
    o.innerHTML=`<header class="jp-head"><h2>ATRAPA <span>TU PREMIO</span></h2><div class="jp-head-actions"><button type="button" class="jp-icon-btn" data-jp="sonido"></button><button type="button" class="jp-icon-btn" data-jp="cerrar" aria-label="Cerrar">✕</button></div></header>
      <nav class="jp-tabs" role="tablist"><button type="button" role="tab" data-tab="jugar">🎮 Jugar</button><button type="button" role="tab" data-tab="premios">🎁 Tus premios</button></nav>
      <main class="jp-body"></main>`;
    o.querySelector('[data-jp="cerrar"]').addEventListener('click',()=>cerrar());
    o.querySelector('[data-jp="sonido"]').addEventListener('click',()=>{S.sonido=!S.sonido;guardarSonido(S.sonido);pintarSonido();if(!S.sonido)motorOff();});
    o.querySelectorAll('[data-tab]').forEach(t=>t.addEventListener('click',()=>{if(S.ocupado)return;S.tab=t.dataset.tab;pintar();}));
    S.root.append(o);return o;
  }
  function pintarSonido(){const b=S.root.querySelector('[data-jp="sonido"]');if(b){b.textContent=S.sonido?'🔊':'🔇';b.setAttribute('aria-label',S.sonido?'Apagar sonido':'Encender sonido');}}
  function abrir(){
    const o=overlay();if(!o.hidden)return;o.hidden=false;document.documentElement.style.overflow='hidden';
    try{history.pushState({jp:1},'')}catch(_){}
    S.tab=(S.estado?.disponibles||0)>0?'jugar':'premios';pintarSonido();pintar();revelarPendiente();
  }
  function cerrar(forzar){
    if(S.ocupado&&!forzar)return; // durante la jugada no se cierra (el premio igual queda guardado)
    const o=S.root.querySelector('.jp-overlay');if(!o||o.hidden)return;
    o.hidden=true;document.documentElement.style.overflow='';
    if(S.motor){S.motor.destruir();S.motor=null;}
    motorOff();fab();
  }
  window.addEventListener('popstate',()=>{const o=S.root?.querySelector('.jp-overlay');if(!o||o.hidden)return;if(S.ocupado){try{history.pushState({jp:1},'')}catch(_){}return;}cerrar();});

  function coins(){
    const f=S.estado?.fichas||[];if(!f.length)return '';
    return f.slice(-8).map((x,i)=>`<span class="jp-coin ${x.estado==='usada'?'usada':''}" title="${x.estado==='usada'?'Ficha usada':'Ficha disponible'}">${x.estado==='usada'?'✓':'★'}</span>`).join('');
  }
  async function pintar(){
    const o=overlay(),body=o.querySelector('.jp-body');
    o.querySelectorAll('[data-tab]').forEach(t=>t.setAttribute('aria-selected',String(t.dataset.tab===S.tab)));
    if(S.tab==='premios'){if(S.motor){S.motor.destruir();S.motor=null;}body.innerHTML='';body.append(listaPremios());return;}
    const n=S.estado?.disponibles||0;
    if(!body.querySelector('.jp-stage')){
      body.innerHTML=`<div class="jp-stage" aria-hidden="true"></div><div class="jp-status" role="status" aria-live="polite"></div>
        <div class="jp-fichas"></div><button type="button" class="jp-play">JUGAR</button>
        <p class="jp-nota">Cada ficha es una jugada y un premio. Jugar no cambia su boleto del sorteo mensual.</p>`;
      body.querySelector('.jp-play').addEventListener('click',jugar);
      await prepararMotor(body.querySelector('.jp-stage'));
    }
    body.querySelector('.jp-fichas').innerHTML=`${coins()}<span>Fichas disponibles: <b>${n}</b></span>`;
    const btn=body.querySelector('.jp-play');btn.disabled=S.ocupado||!n||S.estado?.activo===false;
    btn.textContent=S.ocupado?'JUGANDO…':'JUGAR';
    if(S.estado?.activo===false)estado('El juego está en pausa. Sus fichas siguen guardadas.',true);
    else if(!n&&!S.ocupado)estado('No tiene fichas disponibles. Su vendedor se las activa al renovar.');
  }
  function estado(t,err){const s=S.root.querySelector('.jp-status');if(s){s.textContent=t||'';s.classList.toggle('err',!!err);}}

  async function jugar(){
    if(S.ocupado)return;
    const ficha=(S.estado?.fichas||[]).find(f=>f.estado==='disponible');if(!ficha)return;
    S.ocupado=true;pintar();estado('Buscando su premio…');ctx();
    const motor=await prepararMotor(S.root.querySelector('.jp-stage'));
    motor.buscar();
    let r;
    try{r=await api({accion:'juego_jugar',fichaId:ficha.id});}
    catch(e){motor.parar?.();await motor.reiniciar?.();S.ocupado=false;estado(e.message,true);pintar();return;}
    S.estado={...S.estado,fichas:r.fichas,disponibles:r.disponibles,historial:r.historial};
    const g=r.ganado;
    try{await motor.atrapar(g.premio);}catch(_){/* la animación puede fallar; el premio ya está guardado */}
    S.ocupado=false;estado('');
    revelar(g);pintar();fab();
  }

  function textoEntrega(g){
    const p=g.premio||{};const hasta=g.expiraAt?fechaCorta(g.expiraAt):'';
    if(g.estado==='entregado'&&g.entrega?.fechaNueva)return `Ya se aplicó: su servicio ahora vence el ${g.entrega.fechaNueva}.`;
    if(g.estado==='entregado')return 'Premio entregado.';
    if(g.estado==='reservado')return `Le reservamos ${etiquetaPremio(p)} por 30 días. Su vendedor se lo entrega${hasta?`; reclámelo antes del ${hasta}`:''}.`;
    if(g.estado==='pendiente_entrega')return `Se aplica en su próximo pago${hasta?`, válido hasta el ${hasta}`:''}. No es canjeable por efectivo.`;
    if(g.estado==='vencido')return 'La fecha para reclamarlo ya pasó.';
    return 'Su premio quedó guardado; su vendedor lo aplicará.';
  }
  function bolaHtml(p,cls){const logo=p?.tipo==='mes_gratis'&&LOGOS[p.plataforma];return `<div class="${cls}" style="${logo?`background-image:url('${logo}')`:''}">${logo?'':(p?.etiqueta||'🎁')}</div>`}
  function confeti(){
    if(reduceMotion)return;const c=el('div','jp-confeti');const col=['#E2231A','#111827','#12AEE6','#F59E0B'];
    for(let i=0;i<46;i++){const p=el('i');p.style.left=Math.random()*100+'%';p.style.background=col[i%col.length];p.style.animationDelay=(Math.random()*.35)+'s';p.style.transform=`rotate(${Math.random()*180}deg)`;c.append(p);}
    document.body.append(c);setTimeout(()=>c.remove(),2200);
  }
  function revelar(g){
    if(!g)return;marcarVisto(g.id);
    const n=S.estado?.disponibles||0,p=g.premio||{};
    const r=el('div','jp-reveal');r.setAttribute('role','dialog');r.setAttribute('aria-modal','true');
    r.innerHTML=`<div class="jp-card"><small>¡GANASTE!</small>${bolaHtml(p,'jp-ball-big')}<div class="jp-premio"></div><span class="jp-tag"></span><p class="jp-entrega"></p>
      <button type="button" class="jp-btn" data-r="ver">VER MI PREMIO</button>${n?`<button type="button" class="jp-btn sec" data-r="otra">Seguir jugando (${n})</button>`:''}
      <p style="margin-top:10px;font-size:12px">Ficha usada • ${n?`quedan ${n}`:'no le quedan fichas'}</p></div>`;
    r.querySelector('.jp-premio').textContent=p.nombre||'Premio';
    r.querySelector('.jp-tag').textContent=p.tipo==='mes_gratis'?'1 MES GRATIS':p.tipo==='dias'?`+${p.valor} DÍAS`:p.tipo==='saldo'?'SALDO A FAVOR':'DESCUENTO';
    r.querySelector('.jp-entrega').textContent=textoEntrega(g);
    const quitar=async(tab)=>{r.remove();if(tab==='premios'){S.tab='premios';pintar();}else{await S.motor?.reiniciar?.();}};
    r.querySelector('[data-r="ver"]').addEventListener('click',()=>quitar('premios'));
    r.querySelector('[data-r="otra"]')?.addEventListener('click',()=>quitar('jugar'));
    S.root.append(r);confeti();r.querySelector('[data-r="ver"]').focus();
  }
  // Si la animación se cortó (recargó la página, se cerró), al volver se muestra el premio ya ganado.
  function revelarPendiente(){
    const g=(S.estado?.historial||[])[0];
    if(!g||S.vistos.has(g.id))return;
    if(Date.now()-Date.parse(g.ganadoAt||0)>30*60*1000){marcarVisto(g.id);return;}
    revelar(g);
  }
  const ESTADO_TXT={ganado:'Ganado',reservado:'Reservado',pendiente_entrega:'Pendiente de entrega',entregado:'Entregado',vencido:'Vencido'};
  function listaPremios(){
    const w=el('div','jp-lista');const h=S.estado?.historial||[];
    if(!h.length){w.append(el('div','jp-vacio','Todavía no ha ganado premios. ¡Use sus fichas en Jugar!'));return w;}
    for(const g of h){
      const it=el('div','jp-item');it.innerHTML=`${bolaHtml(g.premio,'jp-mini')}<div><b></b><small></small></div><span class="jp-estado ${g.estado}">${ESTADO_TXT[g.estado]||g.estado}</span>`;
      it.querySelector('b').textContent=g.premio?.nombre||'Premio';
      it.querySelector('small').textContent=`${fechaCorta(g.ganadoAt)} · ${textoEntrega(g)}`;
      w.append(it);
    }
    return w;
  }

  async function iniciar(){
    S.token=token();if(!S.token)return;cargarVistos();
    S.root=el('div','jp-root');document.body.append(S.root);
    try{S.estado=await api({accion:'juego_estado'});}catch(_){return;}
    fab();
    const pend=(S.estado.historial||[])[0];
    if(pend&&!S.vistos.has(pend.id)&&Date.now()-Date.parse(pend.ganadoAt||0)<30*60*1000)abrir();
  }
  window.__atrapaTuPremio={estado:()=>S,abrir,cerrar,etiquetaPremio};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
})();
