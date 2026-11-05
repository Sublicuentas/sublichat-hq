// Doble de prueba de livekit-client (misma superficie que usa sala-vivo.js). Sin red: window.__lk simula a las demás socias.
const ev = (n) => n;
export const RoomEvent = Object.fromEntries(['ParticipantConnected', 'ParticipantDisconnected', 'ActiveSpeakersChanged', 'TrackMuted', 'TrackUnmuted', 'LocalTrackPublished', 'LocalTrackUnpublished', 'TrackSubscribed', 'TrackUnsubscribed', 'DataReceived', 'Reconnecting', 'Reconnected', 'AudioPlaybackStatusChanged', 'Disconnected'].map((k) => [k, ev(k)]));
export const Track = { Source: { Microphone: 'microphone', Camera: 'camera', ScreenShare: 'screen_share' }, Kind: { Audio: 'audio', Video: 'video' } };
export const DisconnectReason = { CLIENT_INITIATED: 1, DUPLICATE_IDENTITY: 2, PARTICIPANT_REMOVED: 4, ROOM_DELETED: 5 };
let sid = 0;
function pista(kind, dibujo) {
  const t = { sid: 'TR_' + (++sid), kind, els: [] };
  t.attach = () => {
    if (kind === 'audio') { const a = document.createElement('audio'); t.els.push(a); return a; }
    const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d'); let f = 0;
    const pinta = () => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 640, 360); g.fillStyle = '#C62828'; g.fillRect(0, 0, 640, 54); g.fillStyle = '#fff'; g.font = 'bold 26px sans-serif'; g.fillText(dibujo, 24, 36); g.fillStyle = '#1F2430'; g.font = '22px sans-serif'; g.fillText('Ventas octubre  L48,300', 40, 120); g.fillText('Renovaciones  212', 40, 160); g.fillStyle = '#2B4C7E'; [120, 180, 150, 230].forEach((h, i) => g.fillRect(360 + i * 60, 320 - h, 40, h)); f++; };
    pinta(); const id = setInterval(pinta, 200);
    const v = document.createElement('video'); v.muted = true; v.autoplay = true; v.srcObject = c.captureStream(10); v._t = id; t.els.push(v); return v;
  };
  t.detach = () => { const e = t.els; t.els = []; e.forEach((x) => clearInterval(x._t)); return e; };
  return t;
}
class Emisor { constructor() { this._h = {}; } on(n, f) { (this._h[n] = this._h[n] || []).push(f); return this; } emit(n, ...a) { (this._h[n] || []).forEach((f) => f(...a)); } }
class Participante {
  constructor(identity, name) { this.identity = identity; this.name = name; this.trackPublications = new Map(); this.isMicrophoneEnabled = true; this.isCameraEnabled = false; this.isScreenShareEnabled = false; }
}
export class Room extends Emisor {
  constructor(op) { super(); this.op = op; this.remoteParticipants = new Map(); this.canPlaybackAudio = true; window.__lk = this; this.enviados = []; }
  async connect(url, token) {
    if (!/^wss:/.test(url) || token.split('.').length !== 3) throw new Error('token inválido');
    const c = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    this.claims = c; const room = this;
    this.localParticipant = Object.assign(new Participante(c.sub, c.name), { isMicrophoneEnabled: false,
      async setMicrophoneEnabled(v) { this.isMicrophoneEnabled = v; room.emit(RoomEvent.LocalTrackPublished, { source: 'microphone' }); },
      async setCameraEnabled(v) { this.isCameraEnabled = v; if (v) this.trackPublications.set('camera', { source: 'camera', track: pista('video', 'Cámara ' + c.name) }); else { this.trackPublications.delete('camera'); room.emit(RoomEvent.LocalTrackUnpublished, { source: 'camera' }); } },
      async setScreenShareEnabled(v) { this.isScreenShareEnabled = v; if (v) this.trackPublications.set('screen_share', { source: 'screen_share', track: pista('video', 'Pantalla de ' + c.name) }); else { this.trackPublications.delete('screen_share'); room.emit(RoomEvent.LocalTrackUnpublished, { source: 'screen_share' }); } },
      getTrackPublication(s) { return this.trackPublications.get(s); },
      async publishData(data, o) { room.enviados.push({ topic: o.topic, d: JSON.parse(new TextDecoder().decode(data)) }); },
    });
    // simulación
    this.sim = {
      entra: (id, nombre) => { const p = new Participante(id, nombre); this.remoteParticipants.set(id, p); this.emit(RoomEvent.ParticipantConnected, p); const t = pista('audio'); const pub = { source: 'microphone', track: t, isSubscribed: true }; p.trackPublications.set('mic', pub); this.emit(RoomEvent.TrackSubscribed, t, pub, p); },
      sale: (id) => { const p = this.remoteParticipants.get(id); this.remoteParticipants.delete(id); this.emit(RoomEvent.ParticipantDisconnected, p); },
      habla: (ids) => this.emit(RoomEvent.ActiveSpeakersChanged, ids.map((i) => this.remoteParticipants.get(i) || this.localParticipant)),
      silencia: (id, v) => { const p = this.remoteParticipants.get(id); p.isMicrophoneEnabled = !v; this.emit(v ? RoomEvent.TrackMuted : RoomEvent.TrackUnmuted, {}, p); },
      chat: (id, t) => this.emit(RoomEvent.DataReceived, new TextEncoder().encode(JSON.stringify({ t })), this.remoteParticipants.get(id), 0, 'chat'),
      reaccion: (id, e) => this.emit(RoomEvent.DataReceived, new TextEncoder().encode(JSON.stringify({ e })), this.remoteParticipants.get(id), 0, 'reaccion'),
      pantalla: (id) => { const p = this.remoteParticipants.get(id); const t = pista('video', 'Presentación de ' + p.name); const pub = { source: 'screen_share', track: t, isSubscribed: true }; p.trackPublications.set('ss', pub); this.emit(RoomEvent.TrackSubscribed, t, pub, p); },
      quitaPantalla: (id) => { const p = this.remoteParticipants.get(id); const pub = p.trackPublications.get('ss'); p.trackPublications.delete('ss'); this.emit(RoomEvent.TrackUnsubscribed, pub.track, pub, p); },
      reconecta: () => { this.emit(RoomEvent.Reconnecting); setTimeout(() => this.emit(RoomEvent.Reconnected), 800); },
      expulsar: () => this.emit(RoomEvent.Disconnected, DisconnectReason.PARTICIPANT_REMOVED),
    };
  }
  async startAudio() { this.canPlaybackAudio = true; }
  async disconnect() { this.desconectada = true; }
}
