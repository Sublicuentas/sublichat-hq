/* SUBLICUENTAS · "Atrapa tu Premio" en el portal del cliente (/c/…) · Oct-2026
   - El SERVIDOR decide el premio (api/sorteos.js · juego_jugar) y lo guarda antes de animar;
     este archivo solo anima el resultado autorizado. Si la animación falla o se recarga, el premio ya está guardado.
   - Máquina 3D real (three.js) con garra física; en teléfonos lentos, sin WebGL o con "reducir movimiento"
     usa una versión 2.5D liviana con el mismo storyboard.
   - 3D: el cliente mueve la garra con la PALANCA y presiona SOLTAR (20 s; si no, se suelta sola). Agarra la cápsula
     marcada y al abrirse sale el premio ya decidido. 2.5D: jugada automática.
   - Storyboard: IDLE → MANDO → DESCENSO → AGARRE → SUBIDA → TRASLADO → CAÍDA → CÁPSULA SE ABRE → REVELACIÓN.
   - Sonido opcional (sin archivos, WebAudio) con botón para apagarlo. */
(function atrapaTuPremio(){
  'use strict';
  const API='/api/sorteos';
  const THREE_LOCAL='/vendor/three-0.160.0.module.min.js'; // mismo dominio: carga más rápida que el CDN
  const THREE_CDN='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
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
  const sMoneda=()=>{tono(1320,.07,{tipo:'square',vol:.035});setTimeout(()=>tono(1760,.12,{tipo:'square',vol:.03}),70)};
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

  /* ---------- Motor 3D (three.js) ----------
     El cliente maneja la garra con la palanca y presiona SOLTAR. Dentro hay cápsulas sorpresa:
     la garra siempre agarra la cápsula marcada (la más cercana) y al abrirse muestra el premio que
     el servidor YA decidió. Así cada ficha = 1 premio y nadie ve un logo y recibe otro. */
  async function cargarThree(){
    try{return await import(THREE_LOCAL);}catch(e){console.warn('three local no cargó, uso CDN',e);return await import(THREE_CDN);}
  }
  async function motor3D(host,premios,alSerLento){
    const THREE=await cargarThree();
    const W=host.clientWidth||320,H=host.clientHeight||420;
    const tactil=window.matchMedia&&window.matchMedia('(pointer: coarse)').matches;
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,tactil?1.6:2));renderer.setSize(W,H);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
    host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#F5F7FA');
    const camera=new THREE.PerspectiveCamera(36,W/H,.1,100);camera.position.set(0,3.6,9.9);camera.lookAt(0,2.6,0);
    scene.add(new THREE.HemisphereLight(0xffffff,0xdfe6ee,1.05));
    const sol=new THREE.DirectionalLight(0xffffff,1.25);sol.position.set(2.5,9,5);sol.castShadow=true;sol.shadow.mapSize.set(tactil?512:1024,tactil?512:1024);
    Object.assign(sol.shadow.camera,{left:-2.5,right:2.5,top:2.5,bottom:-2.5,near:1,far:20});scene.add(sol);
    const rojo=new THREE.MeshStandardMaterial({color:0xE2231A,roughness:.45,metalness:.1});
    const negro=new THREE.MeshStandardMaterial({color:0x111827,roughness:.5,metalness:.35});
    const metal=new THREE.MeshStandardMaterial({color:0x9AA4B2,roughness:.3,metalness:.8});
    const cian=new THREE.LineBasicMaterial({color:0x12AEE6,transparent:true,opacity:.75});
    const Wm=3.4,Dm=2.4,piso=1.1,alto=3.4,techo=piso+alto;
    // Gabinete
    const gab=new THREE.Mesh(new THREE.BoxGeometry(Wm+.3,piso,Dm+.3),rojo);gab.position.y=piso/2;scene.add(gab);
    const suelo=new THREE.Mesh(new THREE.BoxGeometry(Wm,.04,Dm),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9}));suelo.position.y=piso+.02;suelo.receiveShadow=true;scene.add(suelo);
    for(const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const col=new THREE.Mesh(new THREE.BoxGeometry(.14,alto,.14),negro);col.position.set(x*Wm/2,piso+alto/2,z*Dm/2);scene.add(col);}
    const tapa=new THREE.Mesh(new THREE.BoxGeometry(Wm+.3,.36,Dm+.3),negro);tapa.position.y=techo+.18;scene.add(tapa);
    // Letrero
    const lc=document.createElement('canvas');lc.width=1024;lc.height=160;const lg=lc.getContext('2d');lg.fillStyle='#E2231A';lg.fillRect(0,0,1024,160);lg.fillStyle='#fff';lg.font='900 84px system-ui, sans-serif';lg.textAlign='center';lg.textBaseline='middle';lg.fillText('ATRAPA TU PREMIO',512,84);
    const ltex=new THREE.CanvasTexture(lc);ltex.colorSpace=THREE.SRGBColorSpace;
    const letrero=new THREE.Mesh(new THREE.PlaneGeometry(Wm+.3,.5),new THREE.MeshBasicMaterial({map:ltex}));letrero.position.set(0,techo+.62,Dm/2+.16);scene.add(letrero);
    const marco=new THREE.Mesh(new THREE.BoxGeometry(Wm+.4,.6,.1),negro);marco.position.set(0,techo+.62,Dm/2+.1);scene.add(marco);
    // Cartel del fondo con los premios posibles (se dibuja ya y los logos llegan después, sin frenar la carga)
    const pc=document.createElement('canvas');pc.width=1024;pc.height=512;const pg=pc.getContext('2d');
    const ptex=new THREE.CanvasTexture(pc);ptex.colorSpace=THREE.SRGBColorSpace;
    const visibles=premios.slice(0,12);
    const dibujarCartel=(imgs={})=>{
      pg.fillStyle='#FFFFFF';pg.fillRect(0,0,1024,512);pg.fillStyle='#111827';pg.fillRect(0,0,1024,74);
      pg.fillStyle='#fff';pg.font='900 44px system-ui, sans-serif';pg.textAlign='center';pg.textBaseline='middle';pg.fillText('PREMIOS DENTRO DE LAS CÁPSULAS',512,40,980);
      visibles.forEach((p,i)=>{const cx=90+(i%6)*169,cy=180+Math.floor(i/6)*190;
        pg.save();pg.beginPath();pg.arc(cx,cy,64,0,Math.PI*2);pg.fillStyle='#fff';pg.fill();pg.lineWidth=8;pg.strokeStyle=p.tier==='premium'?'#E2231A':'#111827';pg.stroke();pg.clip();
        const im=imgs[p.plataforma];if(im)pg.drawImage(im,cx-56,cy-56,112,112);else{pg.fillStyle='#E2231A';pg.font='900 30px system-ui, sans-serif';pg.fillText(p.etiqueta||'',cx,cy,112);}
        pg.restore();});
      ptex.needsUpdate=true;
    };
    dibujarCartel();
    Promise.all(visibles.filter(p=>p.tipo==='mes_gratis'&&LOGOS[p.plataforma]).map(p=>cargarImg(LOGOS[p.plataforma]).then(im=>[p.plataforma,im])))
      .then(par=>dibujarCartel(Object.fromEntries(par.filter(x=>x[1])))).catch(()=>{});
    const cartel=new THREE.Mesh(new THREE.PlaneGeometry(Wm-.1,(Wm-.1)/2),new THREE.MeshBasicMaterial({map:ptex}));cartel.position.set(0,piso+alto*.62,-Dm/2+.03);scene.add(cartel);
    // Vidrio + bordes cian
    const vidrio=new THREE.MeshPhysicalMaterial({color:0xe9f8ff,transparent:true,opacity:.12,roughness:.05,metalness:0,side:THREE.DoubleSide,depthWrite:false});
    for(const [x,y,z,ry,w] of [[0,piso+alto/2,Dm/2,0,Wm],[Wm/2,piso+alto/2,0,Math.PI/2,Dm],[-Wm/2,piso+alto/2,0,Math.PI/2,Dm]]){const v=new THREE.Mesh(new THREE.PlaneGeometry(w,alto),vidrio);v.position.set(x,y,z);v.rotation.y=ry;scene.add(v);}
    const bordes=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(Wm,alto,Dm)),cian);bordes.position.y=piso+alto/2;scene.add(bordes);
    // Tolva (salida) adelante a la izquierda + bandeja donde se abre la cápsula
    const tolva={x:-Wm/2+.55,z:Dm/2-.5};
    const tMat=new THREE.MeshStandardMaterial({color:0x111827,roughness:.6});
    for(const [dx,dz,w,d] of [[0,-.42,.9,.06],[0,.42,.9,.06],[-.42,0,.06,.9],[.42,0,.06,.9]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,.7,d),tMat);m.position.set(tolva.x+dx,piso+.35,tolva.z+dz);scene.add(m);}
    const bandeja=new THREE.Mesh(new THREE.BoxGeometry(.9,.12,.5),tMat);bandeja.position.set(tolva.x,.28,Dm/2+.3);scene.add(bandeja);
    // Cápsulas sorpresa
    const R=.3,capsulas=[];
    const COLS=[0xE2231A,0x12AEE6,0xF59E0B,0x7C3AED,0x16A34A,0xEC4899];
    const gTop=new THREE.SphereGeometry(R,28,14,0,Math.PI*2,0,Math.PI/2),gBot=new THREE.SphereGeometry(R,28,14,0,Math.PI*2,Math.PI/2,Math.PI/2);
    const gAro=new THREE.TorusGeometry(R*.995,.02,8,40);
    // Cápsula tipo "gashapon": mitad de arriba plástico transparente, mitad de abajo de color (sin franja negra)
    const transparente=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.08,clearcoat:1,transparent:true,opacity:.38,depthWrite:false});
    const mats=COLS.map(c=>new THREE.MeshPhysicalMaterial({color:c,roughness:.22,clearcoat:.9}));
    const puestos=[];
    for(let capa=0;capa<2;capa++)for(let ix=0;ix<5;ix++)for(let iz=0;iz<3;iz++){const x=-Wm/2+.75+ix*.62+(capa?.31:0)+(iz%2?.12:0),z=-Dm/2+.45+iz*.62+(capa?.31:0);if(Math.hypot(x-tolva.x,z-tolva.z)<.85)continue;if(x>Wm/2-.35)continue;puestos.push([x,piso+R+.04+capa*R*1.55,z]);}
    const nuevaCapsula=(i,[x,y,z])=>{
      const m=mats[i%mats.length];const g=new THREE.Group();const top=new THREE.Mesh(gTop,transparente),bot=new THREE.Mesh(gBot,m),aro=new THREE.Mesh(gAro,m);aro.rotation.x=Math.PI/2;
      bot.castShadow=true;g.add(top,bot,aro);g.position.set(x,y,z);g.rotation.set((Math.random()-.5)*.9,Math.random()*6,(Math.random()-.5)*.9);
      g.userData={top,bot,base:new THREE.Vector3(x,y,z),rotBase:g.rotation.clone(),fase:Math.random()*6,i};scene.add(g);return g;
    };
    puestos.slice(0,14).forEach((p,i)=>capsulas.push(nuevaCapsula(i,p)));
    // Garra: rieles a los lados, puente que corre en X, carro que corre en Z, cable y 3 pinzas
    for(const z of [-Dm/2+.12,Dm/2-.12]){const riel=new THREE.Mesh(new THREE.BoxGeometry(Wm,.07,.07),negro);riel.position.set(0,techo-.05,z);scene.add(riel);}
    const puente=new THREE.Mesh(new THREE.BoxGeometry(.12,.08,Dm-.2),metal);puente.position.y=techo-.05;scene.add(puente);
    const carro=new THREE.Group();scene.add(carro);carro.position.set(.6,techo-.12,0);
    carro.add(new THREE.Mesh(new THREE.BoxGeometry(.42,.16,.42),negro));
    const cable=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,1,8),metal);carro.add(cable);
    const cabeza=new THREE.Group();carro.add(cabeza);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,.22,20),rojo);cabeza.add(hub);
    const pinzas=[];
    for(let k=0;k<3;k++){
      const piv=new THREE.Group();piv.rotation.y=k*2*Math.PI/3;cabeza.add(piv);
      const brazo=new THREE.Group();brazo.position.set(.14,-.08,0);piv.add(brazo);
      const a=new THREE.Mesh(new THREE.BoxGeometry(.05,.34,.05),metal);a.position.y=-.17;brazo.add(a);
      const b=new THREE.Mesh(new THREE.BoxGeometry(.05,.22,.05),metal);b.position.set(-.06,-.4,0);b.rotation.z=-.55;brazo.add(b);
      a.castShadow=b.castShadow=true;pinzas.push(brazo);
    }
    let largo=.55;
    const ponerCable=()=>{cable.scale.y=largo;cable.position.y=-largo/2;cabeza.position.y=-largo-.11;};
    const abrir=(t)=>pinzas.forEach(b=>{b.rotation.z=.55*(1-t)+(-.08)*t;});
    ponerCable();abrir(0);
    // Mira: aro rojo sobre la cápsula que va a agarrar + sombra de la garra
    const mira=new THREE.Mesh(new THREE.RingGeometry(.3,.38,36),new THREE.MeshBasicMaterial({color:0xE2231A,transparent:true,opacity:.9,side:THREE.DoubleSide,depthTest:false}));
    mira.rotation.x=-Math.PI/2;mira.renderOrder=5;mira.visible=false;scene.add(mira);
    const LIM={x0:-Wm/2+.35,x1:Wm/2-.35,z0:-Dm/2+.3,z1:Dm/2-.3};
    let vivo=true,modo='idle',atrapada=null,abierta=null,objetivo=null;const vel={x:0,z:0},balanceo={x:0,z:0};
    const reloj=new THREE.Clock();let frames=0,suma=0;
    const pos=new THREE.Vector3();
    const masCercana=()=>{let best=null,d=1e9;for(const c of capsulas){if(c===atrapada||c===abierta)continue;const dd=Math.hypot(c.position.x-carro.position.x,c.position.z-carro.position.z)-c.position.y*.15;if(dd<d){d=dd;best=c;}}return best;};
    let sonandoMando=false;
    function cuadro(){
      if(!vivo)return;requestAnimationFrame(cuadro);
      const dt=Math.min(.05,reloj.getDelta()),t=reloj.elapsedTime;
      if(++frames>15&&frames<=60){suma+=dt;if(frames===60&&suma/45>.062&&alSerLento)alSerLento();} // ≈<16 fps → 2.5D
      if(modo==='mando'){
        carro.position.x=Math.max(LIM.x0,Math.min(LIM.x1,carro.position.x+vel.x*dt*1.7));
        carro.position.z=Math.max(LIM.z0,Math.min(LIM.z1,carro.position.z+vel.z*dt*1.4));
        const mov=Math.hypot(vel.x,vel.z)>.08;
        if(mov&&!sonandoMando){motorOn();sonandoMando=true;}else if(!mov&&sonandoMando){motorOff();sonandoMando=false;}
        const o=masCercana();if(o!==objetivo){objetivo=o;if(o&&navigator.vibrate)try{navigator.vibrate(6)}catch(_){}}
        if(objetivo){mira.visible=true;mira.position.set(objetivo.position.x,objetivo.position.y+R+.03,objetivo.position.z);mira.scale.setScalar(1+.08*Math.sin(t*6));}
      }
      puente.position.x=carro.position.x;
      // balanceo de la garra por inercia (se ve "colgando" del cable)
      balanceo.x+=((modo==='mando'?-vel.x*.22:0)-balanceo.x)*Math.min(1,dt*5);balanceo.z+=((modo==='mando'?vel.z*.22:0)-balanceo.z)*Math.min(1,dt*5);
      cabeza.rotation.z=balanceo.x+Math.sin(t*3.1)*.01;cabeza.rotation.x=balanceo.z;
      for(const c of capsulas){if(c===atrapada||c===abierta)continue;c.position.y=c.userData.base.y+Math.sin(t*1.3+c.userData.fase)*.008;}
      if(atrapada){cabeza.getWorldPosition(pos);atrapada.position.set(pos.x,pos.y-.42,pos.z);}
      renderer.render(scene,camera);
    }
    cuadro();
    const ro=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});ro.observe(host);
    const moverCarro=(x,z,ms)=>{const x0=carro.position.x,z0=carro.position.z;motorOn();return animar(ms,e=>{carro.position.x=x0+(x-x0)*e;carro.position.z=z0+(z-z0)*e;}).then(motorOff);};
    let texPremio=null;
    const prepararPremio=(premio)=>{texPremio=lienzoBola(premio).then(c=>{const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;return tx;}).catch(()=>null);};
    let premioBola=null;
    return {
      tipo:'3d',mando:true,
      buscar(){},parar(){modo='idle';mira.visible=false;vel.x=vel.z=0;if(sonandoMando){motorOff();sonandoMando=false;}},
      iniciarMando(premio){prepararPremio(premio);modo='mando';objetivo=null;},
      mover(x,z){vel.x=Math.max(-1,Math.min(1,x||0));vel.z=Math.max(-1,Math.min(1,z||0));},
      async atrapar(premio){
        if(!texPremio)prepararPremio(premio);
        const cap=objetivo||masCercana();
        modo='anim';vel.x=vel.z=0;if(sonandoMando){motorOff();sonandoMando=false;}
        await moverCarro(cap.position.x,cap.position.z,380);                                       // alinear
        mira.visible=false;
        const l0=largo,l1=Math.max(.6,(techo-.12)-cap.position.y-.42-.11);
        motorOn();await animar(900,e=>{largo=l0+(l1-l0)*e;ponerCable();});motorOff();              // DESCENSO
        sClack();if(navigator.vibrate)try{navigator.vibrate([25,30,25])}catch(_){}                  // AGARRE
        await animar(320,e=>abrir(e));
        await animar(160,e=>{largo=l1+.05*Math.sin(e*Math.PI);ponerCable();});
        atrapada=cap;
        motorOn();await animar(850,e=>{largo=l1+(l0-l1)*e;ponerCable();});motorOff();              // SUBIDA
        await moverCarro(tolva.x,tolva.z,1000);                                                    // TRASLADO
        atrapada=null;abierta=cap;await animar(180,e=>abrir(1-e));                                  // CAÍDA
        const y0=cap.position.y,yf=piso-.55;
        await animar(520,(e,lin)=>{cap.position.y=y0-(y0-yf)*lin*lin;});
        sCaida();if(navigator.vibrate)try{navigator.vibrate(40)}catch(_){}
        await animar(260,e=>{cap.position.y=yf+.18*Math.sin(e*Math.PI)*(1-e);});
        await animar(320,e=>{cap.position.z=tolva.z+(Dm/2+.45-tolva.z)*e;cap.position.y=yf+(.62-yf)*e;cap.rotation.set(cap.userData.rotBase.x*(1-e),cap.rotation.y,cap.userData.rotBase.z*(1-e));});
        // La cápsula se abre y sale el premio
        const tx=await texPremio;
        premioBola=new THREE.Mesh(new THREE.SphereGeometry(R*.85,32,24),new THREE.MeshStandardMaterial({map:tx||null,color:tx?0xffffff:0xE2231A,roughness:.35}));
        premioBola.position.copy(cap.position);premioBola.scale.setScalar(.2);scene.add(premioBola);
        const {top,bot}=cap.userData;
        sPremio();
        await animar(650,e=>{top.position.y=e*.42;top.rotation.x=-e*1.2;bot.position.y=-e*.12;
          premioBola.scale.setScalar(.2+.95*e);premioBola.position.y=cap.position.y+e*.35;premioBola.position.z=cap.position.z+e*.25;premioBola.rotation.y=e*Math.PI*2;});
        await esperar(650); // que se vea el premio salir de la cápsula antes de la tarjeta
      },
      async reiniciar(){ // cápsula nueva en su lugar y la garra vuelve al inicio
        modo='idle';mira.visible=false;texPremio=null;
        if(premioBola){scene.remove(premioBola);premioBola.geometry.dispose();premioBola.material.dispose();premioBola=null;}
        if(abierta){const c=abierta;abierta=null;c.userData.top.position.set(0,0,0);c.userData.top.rotation.set(0,0,0);c.userData.bot.position.set(0,0,0);c.position.copy(c.userData.base);c.rotation.copy(c.userData.rotBase);}
        await moverCarro(.6,0,500);
      },
      destruir(){vivo=false;motorOff();ro.disconnect();renderer.dispose();renderer.domElement.remove();},
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
    const cargando=el('div','jp-cargando');cargando.innerHTML='<span></span>Preparando la máquina…';host.append(cargando);
    try{S.motor=usar3d?await motor3D(host,premios,aLento):await motor25(host,premios);}
    catch(e){console.warn('Atrapa tu Premio: 3D no disponible, se usa 2.5D',e);host.innerHTML='';S.motor=await motor25(host,premios);}
    cargando.remove();
    S.motorTipo=S.motor.tipo;S.root?.setAttribute('data-motor',S.motorTipo);
    return S.motor;
  }

  /* ---------- Interfaz ---------- */
  /* Entrada al juego: tarjeta dentro de "Sorteos y premios" del portal + numerito en esa categoría.
     Si la página no tiene ese apartado (portal viejo), se usa el botón flotante de respaldo. */
  let esperaSlot=null;
  function entrada(){
    const n=S.estado?.disponibles||0,h=(S.estado?.historial||[]).length;
    const visible=!!S.estado&&(n>0||h>0); // en pausa igual se ve: sus fichas siguen guardadas
    window.__jpVisible=visible;window.dispatchEvent(new CustomEvent('jp:estado',{detail:{visible,fichas:n,premios:h}}));
    // numerito en la categoría
    const cat=document.querySelector('[data-portal-panel="sorteos"]');
    if(cat){let b=cat.querySelector('.jp-badge');if(n>0){if(!b){b=el('span','jp-badge');cat.append(b);}b.textContent=n;b.setAttribute('aria-label',`${n} ficha${n===1?'':'s'} para jugar`);}else b?.remove();}
    const slot=document.getElementById('portal-juego-slot');
    if(slot){
      document.querySelector('.jp-fab')?.remove();clearTimeout(esperaSlot);
      if(!visible){slot.innerHTML='';return;}
      slot.innerHTML=`<article class="jp-entrada${n?'':' sin-fichas'}">
        <div class="jp-entrada-icono" aria-hidden="true"><span class="jp-mini-garra"></span></div>
        <div class="jp-entrada-txt"><b>Atrapa tu Premio</b><small>${n?`Tiene <strong>${n}</strong> ficha${n===1?'':'s'} · cada ficha = 1 premio seguro`:`${h} premio${h===1?'':'s'} ganado${h===1?'':'s'}`}</small></div>
        <button type="button" class="jp-entrada-btn">${n?'JUGAR':'Ver premios'}</button></article>`;
      slot.querySelector('.jp-entrada').addEventListener('click',abrir);
      return;
    }
    // Respaldo: el portal todavía no armó sus categorías → esperar un momento antes de usar el flotante
    if(!visible){document.querySelector('.jp-fab')?.remove();return;}
    clearTimeout(esperaSlot);esperaSlot=setTimeout(()=>{if(!document.getElementById('portal-juego-slot'))fab();},4000);
  }
  window.addEventListener('portal:sorteos-listo',()=>{if(S.estado)entrada();});
  function fab(){
    let b=document.querySelector('.jp-fab');
    const n=S.estado?.disponibles||0;
    if(!S.estado||(!n&&!(S.estado.historial||[]).length)){b?.remove();return;}
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
    motorOff();entrada();
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
        <div class="jp-mando" hidden>
          <div class="jp-palanca" role="application" aria-label="Palanca: mueva la garra"><span class="jp-palanca-base"></span><span class="jp-palanca-bola"></span></div>
          <div class="jp-tiempo" aria-live="off"><b>20</b><small>segundos</small></div>
          <button type="button" class="jp-soltar" aria-label="Soltar la garra">SOLTAR</button>
        </div>
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
    S.ocupado=true;pintar();estado('Insertando ficha…');ctx();sMoneda();
    const motor=await prepararMotor(S.root.querySelector('.jp-stage'));
    let r;
    try{r=await api({accion:'juego_jugar',fichaId:ficha.id});}   // el servidor decide y guarda el premio aquí
    catch(e){S.ocupado=false;estado(e.message,true);pintar();return;}
    S.estado={...S.estado,fichas:r.fichas,disponibles:r.disponibles,historial:r.historial};
    const g=r.ganado;pintar();
    if(motor.mando){try{await usarMando(motor,g.premio);}catch(_){}}
    estado('');
    try{await motor.atrapar(g.premio);}catch(e){console.warn(e);/* la animación puede fallar; el premio ya está guardado */}
    S.ocupado=false;
    revelar(g);pintar();entrada();
  }

  /* Palanca + SOLTAR. Funciona con el dedo (teléfono), mouse y teclado (flechas/WASD + espacio). */
  function usarMando(motor,premio){
    return new Promise(resolve=>{
      const body=S.root.querySelector('.jp-body');const panel=body.querySelector('.jp-mando'),pal=panel.querySelector('.jp-palanca'),bola=panel.querySelector('.jp-palanca-bola'),
        soltarBtn=panel.querySelector('.jp-soltar'),reloj=panel.querySelector('.jp-tiempo b'),play=body.querySelector('.jp-play');
      play.hidden=true;panel.hidden=false;soltarBtn.disabled=false;
      estado('Mueva la palanca y presione SOLTAR');
      motor.iniciarMando(premio);
      let restante=20,listo=false,puntero=null;const teclas=new Set();
      reloj.textContent=restante;
      const tic=setInterval(()=>{restante--;reloj.textContent=Math.max(0,restante);panel.classList.toggle('apurado',restante<=5);if(restante<=5&&restante>0)tono(880,.05,{tipo:'square',vol:.03});if(restante<=0)fin();},1000);
      const ponerBola=(x,y)=>{bola.style.transform=`translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;};
      const desdePuntero=(e)=>{const r=pal.getBoundingClientRect(),rad=r.width*.34;let dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);const l=Math.hypot(dx,dy);if(l>rad){dx*=rad/l;dy*=rad/l;}
        ponerBola(dx,dy);motor.mover(dx/rad,dy/rad);};
      const suelta=()=>{puntero=null;ponerBola(0,0);motor.mover(0,0);pal.classList.remove('activa');};
      const pd=(e)=>{if(listo)return;e.preventDefault();puntero=e.pointerId;try{pal.setPointerCapture(e.pointerId)}catch(_){}pal.classList.add('activa');desdePuntero(e);};
      const pm=(e)=>{if(e.pointerId===puntero)desdePuntero(e);};
      const pu=(e)=>{if(e.pointerId===puntero)suelta();};
      const deTeclas=()=>{const x=(teclas.has('ArrowRight')||teclas.has('d')?1:0)-(teclas.has('ArrowLeft')||teclas.has('a')?1:0),z=(teclas.has('ArrowDown')||teclas.has('s')?1:0)-(teclas.has('ArrowUp')||teclas.has('w')?1:0);motor.mover(x,z);ponerBola(x*28,z*28);};
      const kd=(e)=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(k===' '||k==='Enter'){e.preventDefault();fin();return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'].includes(k)){e.preventDefault();teclas.add(k);deTeclas();}};
      const ku=(e)=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(teclas.delete(k))deTeclas();};
      function fin(){
        if(listo)return;listo=true;clearInterval(tic);suelta();
        pal.removeEventListener('pointerdown',pd);pal.removeEventListener('pointermove',pm);pal.removeEventListener('pointerup',pu);pal.removeEventListener('pointercancel',pu);
        window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);soltarBtn.onclick=null;
        soltarBtn.disabled=true;sClack();if(navigator.vibrate)try{navigator.vibrate(15)}catch(_){}
        setTimeout(()=>{panel.hidden=true;panel.classList.remove('apurado');play.hidden=false;},250);
        resolve();
      }
      pal.addEventListener('pointerdown',pd);pal.addEventListener('pointermove',pm);pal.addEventListener('pointerup',pu);pal.addEventListener('pointercancel',pu);
      window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);
      soltarBtn.onclick=fin;
    });
  }

  function textoEntrega(g){
    const p=g.premio||{};const hasta=g.expiraAt?fechaCorta(g.expiraAt):'';
    if(g.estado==='entregado'&&g.entrega?.fechaNueva)return `Ya se aplicó: su servicio ahora vence el ${g.entrega.fechaNueva}.`;
    if(g.estado==='entregado')return 'Premio entregado.';
    if(g.estado==='reservado')return `Le reservamos ${etiquetaPremio(p)} por 30 días. Su vendedor se lo entrega${hasta?`; reclámelo antes del ${hasta}`:''}.`;
    if(g.estado==='pendiente_entrega'&&p.tipo==='mes_gratis')return `Su vendedor le entregará ${etiquetaPremio(p)}${hasta?`; reclámelo antes del ${hasta}`:''}.`;
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
    entrada();
    if((S.estado.disponibles||0)>0&&!reduceMotion){ // adelanta la descarga del 3D mientras el cliente ve su portal
      const pre=()=>{if(document.querySelector('link[data-jp-three]'))return;const l=document.createElement('link');l.rel='modulepreload';l.href=THREE_LOCAL;l.dataset.jpThree='1';document.head.append(l);};
      (window.requestIdleCallback||((f)=>setTimeout(f,1500)))(pre);
    }
    const pend=(S.estado.historial||[])[0];
    if(pend&&!S.vistos.has(pend.id)&&Date.now()-Date.parse(pend.ganadoAt||0)<30*60*1000)abrir();
  }
  window.__atrapaTuPremio={estado:()=>S,abrir,cerrar,etiquetaPremio};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
})();
