/* sala-grabar.js · R175 — SubliStudio 3D · Fase 7: grabación de la reunión en el navegador de la anfitriona.
   · Graba lo que muestra la sala 3D (incluye la pantalla/presentación) + el audio de todas, mezclado aquí.
   · El archivo se descarga en el equipo de quien graba; no se sube a ningún servidor (sin costo de LiveKit Egress).
   · Todas ven el aviso "● Grabando" mientras dura (lo controla sala-vivo.js con el atributo de la anfitriona). */
export const MAX_MIN = 120;
export function soportaGrabar() { return typeof window.MediaRecorder === 'function' && typeof HTMLCanvasElement.prototype.captureStream === 'function'; }
function tipoArchivo() {
  const op = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a', 'video/mp4'];
  for (const t of op) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
  return '';
}
export function crearGrabadora(lienzo3D, { pistasAudio = () => [], alTerminar = () => {}, alAvisar = () => {} } = {}) {
  if (!soportaGrabar()) throw new Error('Este navegador no puede grabar la reunión. Use Chrome o Edge en computadora.');
  const tipo = tipoArchivo(); if (!tipo) throw new Error('Este navegador no tiene un formato de video para grabar.');
  const ctx = new (window.AudioContext || window.webkitAudioContext)(); const destino = ctx.createMediaStreamDestination();
  const fuentes = new Map(); // id de pista → nodo
  const sincronizar = () => {
    const vivas = new Set();
    for (const t of pistasAudio()) { if (!t || t.readyState === 'ended') continue; vivas.add(t.id); if (!fuentes.has(t.id)) { try { const n = ctx.createMediaStreamSource(new MediaStream([t])); n.connect(destino); fuentes.set(t.id, n); } catch (_) {} } }
    for (const [id, n] of fuentes) if (!vivas.has(id)) { try { n.disconnect(); } catch (_) {} fuentes.delete(id); }
  };
  sincronizar(); const reloj = setInterval(sincronizar, 2000); // entra o sale alguien: se ajusta la mezcla
  const video = lienzo3D.captureStream(30).getVideoTracks()[0];
  const flujo = new MediaStream([video, ...destino.stream.getAudioTracks()]);
  const rec = new MediaRecorder(flujo, { mimeType: tipo, videoBitsPerSecond: 2500000, audioBitsPerSecond: 128000 });
  const trozos = []; let bytes = 0; const inicio = Date.now(); let parada = false;
  rec.ondataavailable = (e) => { if (e.data && e.data.size) { trozos.push(e.data); bytes += e.data.size; if (bytes > 1.8e9) { alAvisar('La grabación llegó al tamaño máximo y se detuvo.'); detener(); } } };
  rec.onstop = () => {
    clearInterval(reloj); clearTimeout(tope); try { video.stop(); } catch (_) {} try { ctx.close(); } catch (_) {}
    const blob = new Blob(trozos, { type: tipo.split(';')[0] });
    alTerminar({ blob, extension: tipo.startsWith('video/mp4') ? 'mp4' : 'webm', duracionSeg: Math.round((Date.now() - inicio) / 1000), bytes: blob.size });
  };
  rec.start(1000);
  const tope = setTimeout(() => { alAvisar(`La grabación se detuvo a los ${MAX_MIN} minutos.`); detener(); }, MAX_MIN * 60000);
  function detener() { if (parada) return; parada = true; try { rec.state !== 'inactive' ? rec.stop() : rec.onstop(); } catch (_) { rec.onstop(); } }
  return { detener, segundos: () => Math.round((Date.now() - inicio) / 1000), tipo };
}
export function descargar({ blob, extension }, nombreBase) {
  const limpio = String(nombreBase || 'reunion').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'reunion';
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${limpio}.${extension}`; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
  return a.download;
}
