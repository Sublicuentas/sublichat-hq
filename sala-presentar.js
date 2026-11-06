/* sala-presentar.js · R173 — SubliStudio 3D · presentar imágenes, PDF y video SIN subir archivos.
   El archivo se abre en el navegador de quien presenta, se dibuja en un lienzo y ese lienzo se transmite por
   LiveKit como "pantalla compartida". No se guarda nada en ningún servidor (costo cero, privado).
   · Imágenes JPG/PNG/WebP (varias = páginas) · PDF (página por página, pdf.js) · Video MP4/WebM (con su audio). */
export const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
export const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
export const LIMITE_MB = 300;
const ANCHO = 1280, ALTO = 720;

export function tipoDe(archivos) {
  const fs = [...archivos];
  if (!fs.length) throw new Error('Elija un archivo.');
  for (const f of fs) if (f.size > LIMITE_MB * 1048576) throw new Error(`"${f.name}" pesa más de ${LIMITE_MB} MB.`);
  const t = (f) => (/^image\/(png|jpe?g|webp|gif)$/.test(f.type) ? 'imagen' : f.type === 'application/pdf' || /\.pdf$/i.test(f.name) ? 'pdf' : /^video\/(mp4|webm|ogg|quicktime)$/.test(f.type) ? 'video' : '');
  const tipos = fs.map(t);
  if (tipos.some((x) => !x)) throw new Error('Formato no admitido. Use JPG, PNG, PDF, MP4 o WebM.');
  if (tipos.every((x) => x === 'imagen')) return 'imagen';
  if (fs.length > 1) throw new Error('Para PDF o video elija un solo archivo.');
  return tipos[0];
}

export async function crearPresentador(archivos, { alCambiar = () => {} } = {}) {
  const tipo = tipoDe(archivos);
  const lienzo = document.createElement('canvas'); lienzo.width = ANCHO; lienzo.height = ALTO;
  const g = lienzo.getContext('2d');
  const fondo = () => { g.fillStyle = '#0F1218'; g.fillRect(0, 0, ANCHO, ALTO); };
  const encajar = (fuente, w, h) => { fondo(); const k = Math.min(ANCHO / w, ALTO / h); const dw = w * k, dh = h * k; g.drawImage(fuente, (ANCHO - dw) / 2, (ALTO - dh) / 2, dw, dh); };
  const urls = [];
  let pagina = 1, total = 1, vivo = true, refresco = null, video = null, audioCtx = null, pistaAudio = null, pdf = null, imagenes = [];

  async function pintar() {
    if (tipo === 'imagen') { const im = imagenes[pagina - 1]; encajar(im, im.naturalWidth, im.naturalHeight); }
    else if (tipo === 'pdf') {
      const p = await pdf.getPage(pagina); const v0 = p.getViewport({ scale: 1 }); const k = Math.min(ANCHO / v0.width, ALTO / v0.height) * 1.5;
      const vp = p.getViewport({ scale: k }); const tmp = document.createElement('canvas'); tmp.width = Math.ceil(vp.width); tmp.height = Math.ceil(vp.height);
      const t2 = tmp.getContext('2d'); t2.fillStyle = '#FFFFFF'; t2.fillRect(0, 0, tmp.width, tmp.height);
      await p.render({ canvasContext: t2, viewport: vp }).promise; if (vivo) encajar(tmp, tmp.width, tmp.height);
    }
    alCambiar(estado());
  }

  if (tipo === 'imagen') {
    imagenes = await Promise.all([...archivos].map((f) => new Promise((ok, mal) => { const u = URL.createObjectURL(f); urls.push(u); const im = new Image(); im.onload = () => ok(im); im.onerror = () => mal(new Error(`No se pudo abrir "${f.name}".`)); im.src = u; })));
    total = imagenes.length;
  } else if (tipo === 'pdf') {
    const pdfjs = await import(PDFJS); pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const datos = new Uint8Array(await archivos[0].arrayBuffer());
    pdf = await pdfjs.getDocument({ data: datos, isEvalSupported: false }).promise; total = pdf.numPages;
  } else {
    video = document.createElement('video'); const u = URL.createObjectURL(archivos[0]); urls.push(u);
    video.src = u; video.playsInline = true; video.preload = 'auto'; video.crossOrigin = 'anonymous';
    await new Promise((ok, mal) => { video.onloadedmetadata = ok; video.onerror = () => mal(new Error('Este navegador no puede reproducir ese video. Pruebe con MP4 (H.264).')); });
    // el audio del video va a la reunión y también se escucha aquí
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); const src = audioCtx.createMediaElementSource(video); const dest = audioCtx.createMediaStreamDestination(); src.connect(dest); src.connect(audioCtx.destination); pistaAudio = dest.stream.getAudioTracks()[0] || null; } catch (_) { pistaAudio = null; }
    const cuadro = () => { if (!vivo) return; if (video.videoWidth) encajar(video, video.videoWidth, video.videoHeight); if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(cuadro); else requestAnimationFrame(cuadro); };
    cuadro(); video.addEventListener('play', () => alCambiar(estado())); video.addEventListener('pause', () => alCambiar(estado())); video.addEventListener('ended', () => alCambiar(estado()));
    video.addEventListener('timeupdate', () => alCambiar(estado()));
  }
  const flujo = lienzo.captureStream(tipo === 'video' ? 30 : 5);
  const pistaVideo = flujo.getVideoTracks()[0];
  if (tipo !== 'video') { await pintar(); refresco = setInterval(() => { if (vivo) { g.globalAlpha = 0.999; g.drawImage(lienzo, 0, 0); g.globalAlpha = 1; } }, 700); } // imágenes quietas: refresca para quien entra tarde

  function estado() { return { tipo, pagina, total, nombre: archivos.length > 1 ? `${archivos.length} imágenes` : archivos[0].name, reproduciendo: !!video && !video.paused && !video.ended, segundo: video ? Math.floor(video.currentTime) : 0, duracion: video ? Math.floor(video.duration || 0) : 0 }; }
  return {
    tipo, lienzo, pistas: { video: pistaVideo, audio: pistaAudio }, estado,
    async ir(n) { if (tipo === 'video') return; const p = Math.min(total, Math.max(1, n)); if (p === pagina) return; pagina = p; await pintar(); },
    siguiente() { return this.ir(pagina + 1); }, anterior() { return this.ir(pagina - 1); },
    async play() { if (!video) return; if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume(); await video.play(); },
    pausa() { if (video) video.pause(); },
    saltar(seg) { if (video) video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seg)); },
    detener() { vivo = false; clearInterval(refresco); try { pistaVideo.stop(); } catch (_) {} try { pistaAudio && pistaAudio.stop(); } catch (_) {} if (video) { video.pause(); video.removeAttribute('src'); video.load(); } try { audioCtx && audioCtx.close(); } catch (_) {} urls.forEach((u) => URL.revokeObjectURL(u)); try { pdf && pdf.destroy(); } catch (_) {} },
  };
}
