/* sala-grabacion.js · R193 — Plantilla de grabación de la Sala de Juntas (LiveKit Egress, «custom template»).
   LiveKit abre sala-grabacion.html?url=…&token=…&layout=<grabacionId> en su navegador de grabación.
   1) Pide al servidor SOLO la escena de esa grabación activa (nombres, avatares, escenario).
   2) Arma la MISMA sala 3D de Sublichat (sala-3d.js) y se conecta a la reunión como grabador oculto (no publica nada).
   3) Reproduce el audio real de todas, muestra quién habla, manos, reacciones y la presentación en la pantalla de la sala.
   4) Avisa a LiveKit START_RECORDING cuando la escena está lista y END_RECORDING cuando la reunión termina. */
const LK_URL = 'https://cdn.jsdelivr.net/npm/livekit-client@2.15.8/dist/livekit-client.esm.mjs';
const aviso = (t) => { const a = document.getElementById('aviso'); a.textContent = t; a.hidden = !t; };
let empezo = false, termino = false;
const empezar = () => { if (empezo) return; empezo = true; console.log('START_RECORDING'); };
const terminar = () => { if (termino) return; termino = true; console.log('END_RECORDING'); };

export function parametros(search = location.search) {
  const q = new URLSearchParams(search);
  return { url: q.get('url') || '', token: q.get('token') || '', grabacionId: q.get('layout') || '' };
}
export async function pedirEscena(grabacionId, f = fetch) {
  const r = await f('/api/sala-juntas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'grabacion_escena', grabacionId }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || 'No se pudo leer la escena.');
  return j.escena;
}
export async function estiloDe(e) {
  if (e.estilo) return e.estilo;
  if (e.sugerido) { try { const M = await import('/escenarios.js?v=20261105-r177'); return M.sugerido(e.escenario, e.sugerido); } catch (_) {} }
  return e.estiloPredeterminado || null;
}

async function main() {
  const P = parametros();
  if (!/^g[0-9a-f]{24}$/.test(P.grabacionId) || !P.url || !P.token) { aviso('Plantilla de grabación: faltan datos.'); empezar(); return; }
  let escena;
  try { escena = await pedirEscena(P.grabacionId); } catch (e) { aviso(e.message); empezar(); return; }
  document.getElementById('titulo').textContent = `${escena.titulo || 'Sala de Juntas'} · Grabando`;
  const S3 = await import('/sala-3d.js?v=20261106-r183');
  if (!S3.soportaWebGL()) { aviso('El grabador no tiene WebGL: se graba solo el audio con esta pantalla.'); }
  let sala = null;
  try {
    sala = await S3.montarSala(document.getElementById('escena'), { avatares: escena.avatares || {}, participantes: escena.participantes.map((p) => p.id), escenario: escena.escenario || 'sala-c', estilo: await estiloDe(escena) });
    await sala.listo;
  } catch (e) { aviso('No se pudo dibujar la sala 3D en el grabador: ' + (e.message || e)); }
  const LK = await import(LK_URL);
  const { Room, RoomEvent, Track } = LK;
  const room = new Room({ adaptiveStream: false, dynacast: false });
  const presentes = () => { const s = new Set(); room.remoteParticipants.forEach((p) => s.add(p.identity)); return s; };
  const pintarPresencia = () => { if (!sala) return; const s = presentes(); for (const p of escena.participantes) sala.setPresente && sala.setPresente(p.id, s.has(p.id)); };
  const manos = (p) => { if (sala) sala.setMano(p.identity, Number(p.attributes?.mano || 0) > 0); };
  let pres = null;
  room
    .on(RoomEvent.TrackSubscribed, (track, pub, p) => {
      if (track.kind === Track.Kind.Audio) { const el = track.attach(); el.autoplay = true; document.body.appendChild(el); }
      else if (pub.source === Track.Source.ScreenShare && sala) { pres = document.createElement('video'); pres.muted = true; pres.playsInline = true; track.attach(pres); pres.play().catch(() => {}); sala.setPantalla(pres); }
      pintarPresencia();
    })
    .on(RoomEvent.TrackUnsubscribed, (track, pub) => { track.detach().forEach((el) => el.remove()); if (pub.source === Track.Source.ScreenShare && sala) { sala.setPantalla(null); pres = null; } })
    .on(RoomEvent.ActiveSpeakersChanged, (ps) => { if (sala) sala.setHablante(ps[0] ? ps[0].identity : ''); })
    .on(RoomEvent.ParticipantConnected, pintarPresencia).on(RoomEvent.ParticipantDisconnected, pintarPresencia)
    .on(RoomEvent.ParticipantAttributesChanged, (_c, p) => manos(p))
    .on(RoomEvent.DataReceived, (payload, p, _k, topic) => { if (topic !== 'reaccion' || !p || !sala || payload.byteLength > 200) return; try { const d = JSON.parse(new TextDecoder().decode(payload)); if (typeof d.e === 'string' && d.e.length <= 4) sala.reaccion(p.identity, d.e); } catch (_) {} })
    .on(RoomEvent.Disconnected, terminar);
  try { await room.connect(P.url, P.token, { autoSubscribe: true }); } catch (e) { aviso('El grabador no pudo entrar a la reunión: ' + (e.message || e)); empezar(); return; }
  pintarPresencia(); room.remoteParticipants.forEach(manos);
  empezar();
  setTimeout(terminar, (Number(escena.maxMin) || 120) * 60000); // tope de costo
}
if (typeof document !== 'undefined' && !globalThis.__SALA_GRAB_TEST__) main().catch((e) => { aviso(String(e && e.message || e)); empezar(); });
