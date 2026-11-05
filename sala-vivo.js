/* R170 · SubliStudio 3D · Fase 4 — audio en tiempo real (LiveKit).
   Módulo ES que sala-juntas.js descarga SOLO al pulsar "Entrar a la Sala de Juntas 3D".
   · El token lo firma el servidor (/api/sala-juntas, accion token_tiempo_real); aquí no hay llaves ni secretos.
   · Audio con cancelación de eco / supresión de ruido; si el micrófono está bloqueado entra como oyente.
   · Chat y reacciones por el canal de datos de LiveKit (el remitente lo pone el servidor de LiveKit, no el mensaje).
   · Nada de grabación: requiere aprobación y tiene costo aparte. */
export const LK_URL = 'https://cdn.jsdelivr.net/npm/livekit-client@2.15.8/dist/livekit-client.esm.mjs';
const TEXTO = new TextEncoder(), LEER = new TextDecoder();
const REACCIONES = ['👍', '👏', '❤️', '😂', '🎉', '✅', '🙋'];

export async function conectar({ url, token, yo, on = {} }) {
  const LK = await import(LK_URL);
  const { Room, RoomEvent, Track, DisconnectReason } = LK;
  const emitir = (n, ...a) => { try { on[n] && on[n](...a); } catch (e) { console.warn('[sala-vivo]', n, e && e.message); } };
  const room = new Room({
    adaptiveStream: true, dynacast: true,
    audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    videoCaptureDefaults: { resolution: { width: 640, height: 360, frameRate: 24 } }, // cámara liviana: ahorra minutos y datos
  });
  const audios = new Map(); // sid → <audio>
  let cerrado = false;
  const presentes = () => { const s = new Set([yo]); room.remoteParticipants.forEach((p) => s.add(p.identity)); return s; };
  const micDe = (p) => !!p && p.isMicrophoneEnabled;
  const avisarPresencia = () => {
    const m = {}; m[yo] = micDe(room.localParticipant); room.remoteParticipants.forEach((p) => { m[p.identity] = micDe(p); });
    emitir('presencia', presentes(), m);
  };

  room
    .on(RoomEvent.ParticipantConnected, (p) => { avisarPresencia(); emitir('aviso', `${p.name || p.identity} entró a la sala.`); })
    .on(RoomEvent.ParticipantDisconnected, (p) => { avisarPresencia(); emitir('video', p.identity, null); emitir('pantalla', null, p.identity); emitir('aviso', `${p.name || p.identity} salió de la sala.`); })
    .on(RoomEvent.ActiveSpeakersChanged, (ps) => emitir('hablantes', ps.map((p) => p.identity)))
    .on(RoomEvent.TrackMuted, avisarPresencia).on(RoomEvent.TrackUnmuted, avisarPresencia)
    .on(RoomEvent.LocalTrackPublished, avisarPresencia).on(RoomEvent.LocalTrackUnpublished, (pub) => { avisarPresencia(); if (pub.source === Track.Source.ScreenShare) emitir('pantalla', null, yo); if (pub.source === Track.Source.Camera) emitir('video', yo, null); })
    .on(RoomEvent.TrackSubscribed, (track, pub, p) => {
      if (track.kind === Track.Kind.Audio) { const el = track.attach(); el.dataset.sjAudio = p.identity; el.style.display = 'none'; document.body.appendChild(el); audios.set(track.sid, el); }
      else if (pub.source === Track.Source.ScreenShare) emitir('pantalla', track, p.identity);
      else if (pub.source === Track.Source.Camera) emitir('video', p.identity, track);
      avisarPresencia();
    })
    .on(RoomEvent.TrackUnsubscribed, (track, pub, p) => {
      track.detach().forEach((el) => el.remove()); audios.delete(track.sid);
      if (pub.source === Track.Source.ScreenShare) emitir('pantalla', null, p.identity);
      if (pub.source === Track.Source.Camera) emitir('video', p.identity, null);
    })
    .on(RoomEvent.DataReceived, (payload, p, _k, topic) => {
      if (!p || payload.byteLength > 2000) return; // remitente verificado por LiveKit; mensajes cortos
      let d; try { d = JSON.parse(LEER.decode(payload)); } catch (_) { return; }
      if (topic === 'chat' && typeof d.t === 'string' && d.t.trim()) emitir('chat', { de: p.identity, nombre: p.name || p.identity, t: d.t.slice(0, 500), ms: Date.now() });
      if (topic === 'reaccion' && REACCIONES.includes(d.e)) emitir('reaccion', p.identity, d.e);
    })
    .on(RoomEvent.Reconnecting, () => emitir('estado', 'reconectando'))
    .on(RoomEvent.Reconnected, () => { emitir('estado', 'conectado'); avisarPresencia(); })
    .on(RoomEvent.AudioPlaybackStatusChanged, () => emitir('audioBloqueado', !room.canPlaybackAudio))
    .on(RoomEvent.Disconnected, (motivo) => {
      limpiar();
      if (cerrado) return;
      const m = motivo === DisconnectReason?.PARTICIPANT_REMOVED ? 'La anfitriona la sacó de la sala.'
        : motivo === DisconnectReason?.ROOM_DELETED ? 'La anfitriona terminó la reunión.'
        : motivo === DisconnectReason?.DUPLICATE_IDENTITY ? 'Entró a la sala desde otro dispositivo; esta ventana se desconectó.'
        : 'Se perdió la conexión con la sala.';
      emitir('estado', 'desconectado', m);
    });

  function limpiar() { audios.forEach((el) => el.remove()); audios.clear(); }

  emitir('estado', 'conectando');
  await room.connect(url, token, { autoSubscribe: true });
  emitir('estado', 'conectado');
  let microOk = true;
  try { await room.localParticipant.setMicrophoneEnabled(true); } catch (_) { microOk = false; emitir('aviso', 'No se pudo usar el micrófono: entró como oyente. Puede activarlo con el botón Micrófono.'); }
  if (!room.canPlaybackAudio) emitir('audioBloqueado', true);
  // quienes ya estaban en la sala
  room.remoteParticipants.forEach((p) => p.trackPublications.forEach((pub) => {
    if (pub.track && pub.isSubscribed && pub.source === Track.Source.ScreenShare) emitir('pantalla', pub.track, p.identity);
    if (pub.track && pub.isSubscribed && pub.source === Track.Source.Camera) emitir('video', p.identity, pub.track);
  }));
  avisarPresencia();

  const enviar = (topic, obj) => room.localParticipant.publishData(TEXTO.encode(JSON.stringify(obj)), { reliable: true, topic });
  const lp = room.localParticipant;
  return {
    microOk,
    get micro() { return lp.isMicrophoneEnabled; },
    get camara() { return lp.isCameraEnabled; },
    get compartiendo() { return lp.isScreenShareEnabled; },
    async setMicro(v) { await lp.setMicrophoneEnabled(v); avisarPresencia(); return lp.isMicrophoneEnabled; },
    async setCamara(v) {
      await lp.setCameraEnabled(v);
      const pub = lp.getTrackPublication(Track.Source.Camera); emitir('video', yo, v && pub?.track ? pub.track : null);
      return lp.isCameraEnabled;
    },
    async setCompartir(v) {
      await lp.setScreenShareEnabled(v, { audio: false, resolution: { width: 1920, height: 1080, frameRate: 15 } });
      const pub = lp.getTrackPublication(Track.Source.ScreenShare); emitir('pantalla', v && pub?.track ? pub.track : null, yo);
      return lp.isScreenShareEnabled;
    },
    async chat(t) { t = String(t || '').trim().slice(0, 500); if (!t) return; await enviar('chat', { t }); emitir('chat', { de: yo, nombre: lp.name || yo, t, ms: Date.now(), mio: true }); },
    async reaccion(e) { if (!REACCIONES.includes(e)) return; await enviar('reaccion', { e }); emitir('reaccion', yo, e); },
    async activarAudio() { await room.startAudio(); emitir('audioBloqueado', !room.canPlaybackAudio); },
    presentes,
    async salir() { cerrado = true; limpiar(); try { await room.disconnect(); } catch (_) {} },
  };
}
export { REACCIONES };
