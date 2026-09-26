import './styles.css';
import { IntentLauncher, ActivityAction } from '@capgo/capacitor-intent-launcher';
import { StatusBar } from '@capacitor/status-bar';

StatusBar.hide().catch(()=>{});
import { canonicalSeller } from './data.js';
import {
  authPost,
  clearSession,
  touchSession,
  hydrateSession,
  newOperationId,
  setCompatibility,
  COMPAT,
  APP_BUILD,
  createCrmSale,
  ensureClientLinks,
  generateChargeMessageAI,
  loadMobileResource,
  getSession,
  loadCatalog,
  loadProfile,
  saveProfile,
  loadRaffles,
  loadTickets,
  ticketAction,
  deleteTicket,
  loadAcademiaProgress,
  completeAcademiaLesson,
  loginUser,
  registerRenewalPayment,
  removeNonRenewingService,
  renewService,
  saveAcademiaSettings,
  searchMovies,
  loadMatches,
  askSubli,
  registerFinanceExpense,
  saveFinanceClosing,
  raffleAction,
  juegosResumen, juegosRegistrar, juegosRanking,
} from './api.js';
import { COURSES } from './academia-data.js';
import { createBasketGame, resolveCurrentShot, setAngle as bqSetAngle, setPower as bqSetPower, bqPause, bqResume, bqTimeUp, bqPlayedMs, bqRemainingMs, basketProSubmission, bqSave, bqLoad, bqClear, bqGetCharacter, bqSetCharacter, basketSelectHtml, basketPlayHtml, BQ } from './basquet.js';
import { hangmanNewGame, pressLetter as hgPress, useHint as hgHint, nextRound as hgNext, finishGame as hgFinish, checkTimeUp as hgTimeUp, pauseHang, resumeHang, hangPlayedMs, hangRemainingMs, hangRound, hangmanProSubmission, hangSave, hangLoad, hangRecent, hangRememberWords, hangmanProScreenHtml } from './ahorcado.js';
import { createMemoryGame, openCard as memOpen, evaluateOpenPair as memEval, closeMismatch as memClose, removeMatchedPair as memRemove, checkTimeout as memTimeout, pauseGame as memPause, resumeGame as memResume, memoryRemainingMs, memorySubmission as memSubmission, memoryLastAssets, memorySaveLastAssets, memoriaScreenHtml, MEMORY_MODE_CONFIG } from './memoria.js';
import { sopaCreate, sopaResolve, sopaHint, sopaPause, sopaResume, sopaSubmission, sopaSave, sopaLoad, sopaElapsed, sopaScreenHtml, attachSopaControls, fmtMs as sopaFmt, SOPA_LEVELS } from './sopa.js';
import { dartsTimeUp, dartsTimeLeft, dartsGameCreate, applyHit as dartsApplyHit, dartsGameSubmission, dartsProScreenHtml, attachDartsControls, hitLabel as dartsHitLabel } from './dardos.js';
import { aulaDashboardHtml, aulaLessonHtml, aulaSettingsHtml, aulaLoadingHtml, aulaErrorHtml, aulaDefaultAvatar } from './aula.js';
import { cierreDelMes, mergeFinanceSources, parseAllFinance, financeContentHtml, periodRange, filterMovs, totalsOf, weekRange, buildFinanceWorkbook, financeFileName, isoDay } from './finanzas.js';
import { saveAndShareXlsx, saveAndShareFile, XLSX_MIME } from './finanzas-file.js';
import { buildExportDataset, buildExportWorkbook, servicesToCsv, servicesToTxt, exportFileName, exportSheetHtml } from './exportar.js';
import { mdToPlain } from './markdown.js';
import { calcScreenHtml, calcSummaryHtml, calcHintsHtml, effectiveCatalog, computeTotals, calcInitialState, calcAddCatalog, calcAddManual, calcStep, calcRemove, quoteText, pushCalcHistory, loadCalcPrices, saveCalcPrices, sanitizePrices, parseAmount, remoteBaseCatalog } from './calculadora.js';
import { prepareAvatarImage } from './image.js';
import { platformLogoHtml } from './screens2.js';
import { cobrosScreenHtml, ticketsScreenHtml, ticketRowHtml, ticketNeedsAttention, isAviso, inventoryScreenHtml, inventoryDetailHtml, inventoryCopyText, inventoryStats, platformCanon } from './screens2.js';
import { juegosHubHtml, leaderboardHtml, memoryScreenHtml, hangmanScreenHtml, wordSearchScreenHtml, basketballScreenHtml, dartsScreenHtml, colorScreenHtml, resultSheetHtml, fmtClock, GAME_META } from './juegos.js';
import { memoryCreate, memoryFlip, memoryResolveMismatch, memorySubmission, hangmanCreate, hangmanGuess, hangmanHint, hangmanSubmission, wordSearchCreate, wordSearchSelect, wordSearchHint, wordSearchSubmission, genRoundId, basketballCreate, basketballShoot, basketballSubmission, dartsCreate, dartsAimAt, dartsThrow, dartsSubmission, colorCreate, colorPick, colorFill, colorFinishNow, colorSubmission, COLOR_DESIGNS } from './juegos-engine.js';
import { WORDSEARCH_SETS } from './juegos-data.js';
import { drawMenuSheetHtml, sorteosScreenHtml, prizeSheetHtml, drawSheetHtml, ticketsSheetHtml, wheelSheetHtml, confirmSheetHtml, readPrizeForm, readDrawForm, backfillPreviewText, auditText, PRESETS as RAFFLE_PRESETS } from './sorteos.js';
import { masHomeHtml, clientsScreenHtml, clientTone, clientInitials, dueStatus, sortClientGroups, clientCardHtml } from './screens.js';
import { moviesContentHtml, matchesContentHtml, subliContentHtml, subliClientsPayload } from './more.js';
import {
  dashboardSummary,
  coreCollectionsForRole,
  filterClients,
  filterOperationalRows,
  operationalFilterOptions,
  formatDateShort,
  money,
  operatorIdentity,
  parseDateDMY,
  roleCapabilities,
  roleModules,
  roleLabel,
  serviceRowsFromClients,
} from './data.js';
import {
  CRM_SELLERS,
  buildChargeMessage,
  crmDefaultPrice,
  crmStoredPlatform,
  crmAllowedMonths,
  crmAllowedDevices,
  crmBasePlatform,
  crmStoredDeviceCount,
  buildTraditionalFicha,
  buildUrlDeliveryMessage,
  urlDeliveryVariantCount,
  groupRenewalsByClientDate, groupClientsByFicha, sameClient,
  servicesForRenewalDate,
  normalizeChargeAiMessage,
  splitChargeAiLines,
  iptvProviderKey,
  iptvDefaultUrl,
  iptvDefaultList,
  iptvUsesMaxPlayer,
  chargePlatformName,
  randomChargeVariant,
  renewalDaysForPreset,
  renewalDateForMonths,
  sellerForSession,
  sellerPhone,
  ticketActorLabel,
  urlVisibilityFromMode,
  platformLabel,
  telegramDelivered,
  telegramSummary,
  telegramShouldAutoRetry,
  telegramToast,
  telegramRoleLabel,
  setSellerPhones,
} from './operations.js';

const svg = (body, size=22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
function icon(name, size=22) {
  const icons = {
    home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.3 2.5-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.7c2.9-.6 5 .9 5.5 4.3"/>',
    renew:'<path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/>',
    catalog:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    more:'<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    search:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    refresh:'<path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/>',
    box:'<path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M12 11v10"/>',
    finance:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h3M8 17h8"/>',
    ticket:'<path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V6Z"/><path d="M12 8v8"/>',
    gift:'<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M12 10v10M3 10h18v-3H3z"/><path d="M12 7c-1.5-4-6-4-6-1.5S9 7 12 7Zm0 0c1.5-4 6-4 6-1.5S15 7 12 7Z"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-4.4 3.3-6.5 7.5-6.5s6.7 2.1 7.5 6.5"/>',
    chevron:'<path d="m9 6 6 6-6 6"/>',
    back:'<path d="m15 6-6 6 6 6"/>',
    close:'<path d="M6 6l12 12M18 6 6 18"/>',
    phone:'<path d="M6.5 3.5 10 7l-2 3c1.4 2.8 3.2 4.6 6 6l3-2 3.5 3.5-2.2 3c-.7 1-2 1.4-3.2 1C8.6 19.4 4.6 15.4 2.5 8.9c-.4-1.2 0-2.5 1-3.2l3-2.2Z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    logout:'<path d="M10 4H5v16h5"/><path d="m14 8 4 4-4 4M18 12H9"/>',
    cloud:'<path d="M7 18h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1A3.5 3.5 0 0 0 7 18Z"/>',
    alert:'<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
    add:'<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
    eye:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  };
  return svg(icons[name] || icons.more, size);
}

function metricIcon(name) {
  const icons = {
    calendar:`<svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true"><rect x="4" y="9" width="40" height="34" rx="10" fill="#e2231a"/><rect x="9" y="18" width="30" height="20" rx="5" fill="#fff"/><rect x="12.5" y="22" width="6" height="6" rx="2" fill="#8f93da"/><rect x="21" y="22" width="6" height="6" rx="2" fill="#c48fd6"/><rect x="29.5" y="22" width="6" height="6" rx="2" fill="#c48fd6"/><rect x="12.5" y="29.5" width="6" height="6" rx="2" fill="#c48fd6"/><rect x="21" y="29.5" width="6" height="6" rx="2" fill="#e79bab"/><rect x="29.5" y="29.5" width="6" height="6" rx="2" fill="#f2b23c"/><rect x="14" y="4" width="5" height="10" rx="2.5" fill="#9aa0a6"/><rect x="29" y="4" width="5" height="10" rx="2.5" fill="#9aa0a6"/></svg>`,
    clock:`<svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="#1f88e6"/><circle cx="24" cy="24" r="14.5" fill="#fff"/><path d="M24 15.5v9.2l6.4 3.6" stroke="#1f88e6" stroke-width="3.3" stroke-linecap="round" fill="none"/></svg>`,
    alert:`<svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true"><path d="M24 5 45 41H3Z" fill="#f5a623"/><rect x="21.3" y="17" width="5.4" height="13" rx="2.7" fill="#fff"/><circle cx="24" cy="34.5" r="2.8" fill="#fff"/></svg>`,
    target:`<svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="#e2231a"/><circle cx="24" cy="24" r="13.5" fill="#fff"/><circle cx="24" cy="24" r="8" fill="#e2231a"/><circle cx="24" cy="24" r="3" fill="#fff"/><path d="M35 8 24 24" stroke="#1f88e6" stroke-width="4" stroke-linecap="round"/><path d="M35 8 29.5 7.2 34.2 3Z" fill="#1f88e6"/></svg>`,
  };
  return icons[name] || '';
}
const metricWave = () => `<svg class="mcard-wave" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><path fill="currentColor" d="M0,16 C18,30 34,2 52,14 C70,26 84,6 100,16 L100,32 L0,32 Z"/></svg>`;

const NAV_ICON_ASSET = { home:'nav-inicio.png', users:'nav-clientes.png', renew:'nav-cobros.png', ticket:'nav-tickets.png', more:'nav-mas.png' };
function navIcon(key) {
  const asset = NAV_ICON_ASSET[key];
  if (!asset) return icon(key, 22);
  return `<img class="bottom-nav-icon" src="/assets/${asset}" alt="" aria-hidden="true">`;
}

// Frase motivadora del día -- misma fuente y misma lógica que Sublichat HQ (web):
// rota por fecha, misma frase todo el día, cambia al siguiente.
const FRASES=[
  ['🚀','Hoy se vende, se cobra y *se celebra*.'],
  ['💪','Cada cobro de hoy es un *paso* hacia tu meta.'],
  ['🔥','Tu negocio no se detiene: ¡*tú tampoco*!'],
  ['🌟','Sonríe: hoy vas a cerrar *más ventas*.'],
  ['🎯','Enfoque + constancia = *resultados*.'],
  ['☕','Un café, una sonrisa y a *renovar cuentas*.'],
  ['🏆','Los campeones cobran *a tiempo*.'],
  ['😎','Hoy te toca brillar, *jefe*.'],
  ['💸','Cliente bien atendido, cliente que *regresa*.'],
  ['🌈','Después de cada renovación viene *un buen día*.'],
  ['⚡','Rápido, amable y confiable: *así se vende*.'],
  ['🎉','¡Vamos con todo! Hoy *sí se puede*.'],
  ['🤝','Un buen trato vale más que *mil anuncios*.'],
  ['🧠','Piensa en grande y cobra *a tiempo*.'],
  ['🌞','Nuevo día, nuevos clientes, *nuevas ganancias*.'],
  ['📈','Pequeños pasos, *grandes resultados*.'],
  ['🥇','Hoy vas por el *primer lugar*.'],
  ['💙','Trata bien a tu cliente y él *hará el resto*.'],
  ['🛠️','Los problemas son *oportunidades* disfrazadas.'],
  ['🍀','La suerte le sonríe a quien *trabaja duro*.'],
  ['🔔','¡Suena la campana! Hoy toca *renovar y ganar*.'],
  ['🌱','Lo que hoy siembras, *mañana lo cobras*.'],
  ['🙌','Gracias por hacer que todo *funcione*.'],
  ['✨','Tu actitud es tu *mejor plan de ventas*.'],
  ['🧩','Cada cliente es una pieza de *tu gran plan*.'],
  ['🎶','Pon buena música y *vende con ganas*.'],
  ['🦸','Hoy tú eres *el héroe del día*.'],
  ['📞','Una llamada a tiempo *salva* una renovación.'],
  ['💡','Buena idea + acción = *negocio*.'],
  ['🚦','Luz verde: hoy todo *fluye*.'],
  ['🎁','Sorprende a un cliente hoy: *vale oro*.'],
  ['🧡','Lo haces mejor de lo que crees, *sigue así*.'],
  ['🌄','Las mejores ventas empiezan *temprano*.'],
  ['🥳','¡Meta a la vista! Falta *poquito*.'],
  ['🔑','La clave del éxito se llama *constancia*.'],
  ['🦁','Con buen servicio *nadie te para*.'],
  ['🍉','Trabaja con ganas, descansa *con más ganas*.'],
  ['🎈','Cada "gracias" de un cliente *cuenta doble*.'],
  ['🏅','Hoy también *vas ganando*.'],
  ['🌻','Buena vibra, buenas ventas, *buen día*.'],
];
function mottoHtml(f) {
  const [emoji,text]=Array.isArray(f)?f:['✨',String(f||'')];
  return `<div class="visual-motto"><i>${emoji}</i><span>${esc(text).replace(/\*([^*]+)\*/g,'<em>$1</em>')}</span></div>`;
}
function dailyPhrase() {
  const start = new Date(2026,0,1);
  const dias = Math.floor((new Date() - start) / 86400000);
  const idx = ((dias % FRASES.length) + FRASES.length) % FRASES.length;
  return FRASES[idx];
}

const BUILD_NUMBER = String(import.meta.env.VITE_BUILD_NUMBER || '1');

const CRM_PLATFORMS = [
  ['netflix','Netflix Premium'], ['vipnetflix','⭐ Netflix Premium VIP'], ['disneyp','Disney Premium'], ['disneys','Disney Premium sin ESPN'],
  ['hbomax','HBO Max'], ['primevideo','Prime Video'], ['crunchyroll','Crunchyroll'], ['paramount','Paramount+'], ['vix','ViX+'],
  ['appletv','Apple TV'], ['universal','Universal+'], ['spotify','Spotify Premium'], ['youtube','YouTube Premium'], ['deezer','Deezer Premium HiFi'],
  ['canva','Canva · 1 mes'], ['gemini','Gemini Pro'], ['chatgpt','ChatGPT'], ['duolingo','Duolingo'], ['viki','Viki Rakuten'], ['office','Office 365'], ['office2021','Office 2021'], ['adobeexpress','Adobe Express'],
  ['windows10','Windows 10'], ['windows11','Windows 11'], ['eset','ESET NOD32 · 1 año / 1 dispositivo'], ['stellatv','Stella TV'], ['oleada','Oleada TV'],
  ['latintv','LatinTV'], ['liontv','LionTV'], ['evoutouch','Nanotech']
];
const CRM_NO_PIN = new Set(['vipnetflix','spotify','deezer','youtube','office','paramount','vix','canva','gemini','chatgpt','duolingo','stellatv','oleada','latintv','liontv','evoutouch','evoutouch1','evoutouch2','evoutouch3','evoutouch4','viki','windows10','windows11','adobeexpress','eset']);
const CRM_NO_PASSWORD = new Set(['canva','gemini','chatgpt','duolingo','adobeexpress']);
const CRM_NO_EMAIL = new Set(['windows10','windows11','eset']);
const CRM_DEVICE = new Set(['netflix','disneyp','disneys','hbomax','vix','universal','primevideo']);


// R53: la app arranca SIEMPRE en claro. Oscuro o "Predeterminado del sistema" solo si el usuario los elige
// en Perfil (antes el valor por defecto era "sistema" y en teléfonos en modo oscuro salía todo oscuro).
function initialTheme() {
  try {
    if (localStorage.getItem('sublicuentas-theme-v2') !== '1') {
      const prev=localStorage.getItem('sublicuentas-theme');
      localStorage.setItem('sublicuentas-theme', prev==='dark'?'dark':'light');
      localStorage.setItem('sublicuentas-theme-v2','1');
    }
    const t=localStorage.getItem('sublicuentas-theme');
    return ['light','dark','system'].includes(t)?t:'light';
  } catch(_) { return 'light'; }
}
const state = {
  active:'inicio',
  subview:null,
  theme:initialTheme(),
  session:getSession(),
  loading:false,
  sync:'idle',
  clients:[],
  inventory:[],
  finances:[],
  catalog:null,
  tickets:null,
  ticketsLoaded:false,
  ticketRecipients:[],
  ticketNoticeMode:'all',
  ticketNoticeDestinos:[],
  ticketImage:'',
  ticketNoticeImage:'',
  ticketReplyFor:'',
  ticketReplyImage:'',
  raffles:null,
  controlInventory:null,
  academia:null,
  academiaLesson:null,
  academiaCat:'Todos',
  academiaSel:{},
  academiaAvatar:null, academiaMascot:null, academiaSettings:false, aulaDraft:null, aulaSaving:false,
  clientFiltersOpen:true, clientSort:'recientes',
  subliCat:'', subliSugOffset:0, subliMenuOpen:false, moviesMenuOpen:false,
  rafflesTab:'sorteos', raffleStatus:null, raffleBusy:false,
  juegos:{screen:'hub', resumen:null, resumenError:'', rankingScope:'general', ranking:{}, rankingLoading:false, rankingError:'', gameCode:null, engine:null, timeLimitSec:0, deadlineAt:0, timeUp:false, paused:false, pausedRemaining:0, result:null},
  calc:calcInitialState(), calcPrices:loadCalcPrices(localStorage),
  ticketsTab:'avisos', ticketQuery:'', ticketStatusFilter:'', ticketFiltersOpen:false, ticketHistoryOpen:false, ticketExpanded:{}, ticketThreadOpen:{}, ticketDraft:{},
  invQuery:'', invPlat:'', invSort:'recientes', invCupo:'', invFiltersOpen:false,
  renewSeller:'', ticketsFetching:false, ticketsSig:'', ticketReplyText:'', backTo:'',
  movieQuery:'', movieResults:null, movieLoading:false, movieError:'',
  matchMode:'hoy', matchQuery:'', matches:null, matchMeta:null, matchLoading:false, matchError:'',
  subliMessages:[], subliLoading:false,
  finPeriod:'mes', finDesde:'', finHasta:'', finTipo:'todos', finShown:60, finBusy:false, finParsedFor:null, finParsed:[],
  profile:null,
  profileEditing:false,
  profileAvatarDraft:'',
  whatsappChooser:false, whatsappPickOnly:false,
  whatsappText:'',
  whatsappPhone:'',
  crmDraft:null,
  renewGroupKey:'',
  renewSelection:[],
  splash:true,
  renewManage:false,
  renewMessage:'',
  renewMessageVariant:0,
  renewMessageHistory:[],
  crmUrlVariant:0, crmSheet:'', crmClientQuery:'', crmFichaOpen:false, crmSaving:false,
  search:'',
  clientStatusFilter:'vigentes',
  clientSellerFilter:'',
  clientPlatformFilter:'',
  clientLimit:100,
  clientActionKey:'',
  clientActionMode:'menu',
  clientActionLink:'',
  clientActionUrlVariant:0,
  renewFilter:'hoy',
  selectedClientId:'',
  renewKey:'',
  toast:'',
  errors:{},
};

function esc(value='') {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

const DARK_MQ = typeof window!=='undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function effectiveTheme() { return state.theme==='dark' || (state.theme==='system' && !!DARK_MQ?.matches) ? 'dark' : 'light'; }
function applyTheme() {
  const root=document.documentElement; root.dataset.theme = state.theme;
  const dark=effectiveTheme()==='dark';
  root.classList.toggle('theme-dark', dark);
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta)meta.setAttribute('content', dark?'#0b0d12':'#f7fbfe');
}
try { DARK_MQ?.addEventListener?.('change', ()=>{ if(state.theme==='system') applyTheme(); }); } catch(_) {}
function cap() { return roleCapabilities(state.session?.role || '', state.session?.usuario || ''); }
function todayISO() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function todayDMY() { const [y,m,d]=todayISO().split('-'); return `${d}/${m}/${y}`; }
function datePlusDaysDMY(days=30) { const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+Number(days||0)); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }
function crmSeller() { const id=operatorIdentity(state.session?.role || '', state.session?.usuario || ''); return id==='relojes' ? 'Relojes' : id==='sublicuentas' ? 'Sublicuentas' : ''; }
function crmRuleKey(value='') { return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,''); }
function crmRules(value='') { const key=crmRuleKey(value); return { key, email:!CRM_NO_EMAIL.has(key), password:!CRM_NO_PASSWORD.has(key), pin:!CRM_NO_PIN.has(key), device:CRM_DEVICE.has(key) }; }
function rowKey(row) { return `${row.clienteId}|${row.compraId || ''}|${row.servicioIndex}`; }
function allRows() {
  const rows=serviceRowsFromClients(state.clients);
  const identity=operatorIdentity(state.session?.role || '', state.session?.usuario || '');
  return identity==='geisell' ? rows.filter(row=>canonicalSeller(row?.vendedor)==='geisell') : rows; // R69: incluye registros viejos "Geissel"
}
function clientName(client) { return client?.nombrePerfil || client?.nombre || 'Cliente'; }
function avatarMarkup() {
  const avatar = state.profile?.avatar || '';
  if (avatar) return `<img src="${esc(avatar)}" class="avatar-img" alt="Perfil">`;
  return `<div class="avatar-fallback">${icon('user',22)}</div>`;
}

function showToast(message) {
  state.toast = message;
  render();
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(()=>{ state.toast=''; render(); }, 3200);
}

// R69 · Paquete B — el caché del teléfono NUNCA guarda secretos: sin claves, PIN, correos de acceso, credenciales
// IPTV/Max Player ni tokens. Inventario y finanzas detalladas no se guardan (se piden al servidor al abrir).
const CORE_CACHE_KEY='sublicuentas-core-cache-r69';
const LEGACY_CORE_CACHE_KEYS=['sublicuentas-core-cache-r21-1'];
export const SENSITIVE_KEY_RE=/^(clave|claves|password|pass|passwd|contrasena|contraseña|pin|pinperfil|pinPerfil|maxplayerclave|maxPlayerClave|maxplayerusuario|maxPlayerUsuario|iptvclave|iptvClave|iptvusuario|token|idtoken|idToken|refreshtoken|refreshToken|cookie|cookies|secret|correo|email|usuarioacceso|codigo|code)$/i;
function redactSecrets(v, depth=0) {
  if (depth>8||v==null) return v;
  if (Array.isArray(v)) return v.map(x=>redactSecrets(x,depth+1));
  if (typeof v==='object') { const o={}; for (const [k,val] of Object.entries(v)) { if (SENSITIVE_KEY_RE.test(k)) continue; o[k]=redactSecrets(val,depth+1); } return o; }
  return v;
}
try { LEGACY_CORE_CACHE_KEYS.forEach(k=>localStorage.removeItem(k)); } catch(_) {} // cachés viejos con secretos
function restoreCoreCache() {
  if (!state.session) return false;
  try {
    const cached=JSON.parse(localStorage.getItem(CORE_CACHE_KEY)||'null');
    if (!cached || cached.usuario!==state.session.usuario) return false;
    if (Array.isArray(cached.clients)) state.clients=cached.clients;
    if (cached.profile && typeof cached.profile==='object') state.profile=cached.profile;
    return Boolean(state.clients?.length || state.profile);
  } catch (_) { return false; }
}
function persistCoreCache() {
  if (!state.session) return;
  try { localStorage.setItem(CORE_CACHE_KEY,JSON.stringify({usuario:state.session.usuario,clients:redactSecrets(state.clients||[]),profile:redactSecrets(state.profile||null),savedAt:Date.now()})); } catch (_) {}
}
const TICKETS_CACHE_KEY='sublicuentas-tickets-cache-r29';
function restoreTicketsCache() {
  if (!state.session) return false;
  try {
    const cached=JSON.parse(localStorage.getItem(TICKETS_CACHE_KEY)||'null');
    if (!cached || cached.usuario!==state.session.usuario || !Array.isArray(cached.tickets)) return false;
    state.tickets=cached.tickets;
    state.ticketRecipients=Array.isArray(cached.recipients)?cached.recipients:[];
    return true;
  } catch (_) { return false; }
}
function persistTicketsCache() {
  if (!state.session) return;
  try { localStorage.setItem(TICKETS_CACHE_KEY,JSON.stringify({usuario:state.session.usuario,tickets:state.tickets||[],recipients:state.ticketRecipients||[],savedAt:Date.now()})); } catch (_) {}
}
function lockLoginScreenHeight() {
  const h=Math.max(Number(window.screen?.availHeight||0),Number(window.innerHeight||0));
  if (h>0) document.documentElement.style.setProperty('--login-screen-height',`${h}px`);
}

// R69 · Paquete A — sincronización POR RECURSO (clients, inventory, finances, profile). Cada recurso tiene su
// propia carga, su cola (si se pide Reload durante una carga, se vuelve a cargar al terminar: nunca se ignora)
// y su lastSuccessfulSyncAt. Ya no hay un state.loading global que bloquee todo.
const SYNC={inflight:{},queued:{},lastOk:{},seq:0};
const syncHHMM=d=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
function coreTasks() {
  const collections=new Set(coreCollectionsForRole(state.session?.role||'',state.session?.usuario||''));
  return {
    clients:()=>loadMobileResource('clientes',{pageSize:1000,maxPages:24}),
    ...(collections.has('inventario')?{inventory:()=>loadMobileResource('inventario',{pageSize:250,maxPages:16})}:{}),
    ...(collections.has('finanzas_movimientos')?{finances:async()=>{const [actual,historico]=await Promise.all([loadMobileResource('finanzas_movimientos',{pageSize:250,maxPages:16}),loadMobileResource('finanzas',{pageSize:250,maxPages:24}).catch(()=>[])]);return mergeFinanceSources(historico, actual);}}:{}),
    profile:()=>loadProfile(state.session.usuario).then(x=>x.perfil||null),
  };
}
function syncStatusUpdate() {
  const busy=Object.keys(SYNC.inflight).length>0;
  const errs=['clients','inventory','finances','profile'].filter(k=>state.errors[k]);
  state.loadingCore=busy;
  if (busy) { state.sync='syncing'; state.syncLabel='Actualizando…'; }
  else if (errs.length) {
    const names={clients:'Clientes',inventory:'Inventario',finances:'Finanzas',profile:'Perfil'};
    state.sync=errs.includes('clients')?'offline':'partial';
    state.syncLabel=errs.includes('clients')?'Sin conexión - mostrando datos guardados':`${errs.map(k=>names[k]).join(' y ')} sin actualizar · reintentando`;
    // R70: reintento automático SOLO de lo que falló (una vez cada 8 s, máximo 3 veces seguidas)
    clearTimeout(syncStatusUpdate.retryT); SYNC.retries=(SYNC.retries||0)+1;
    if (SYNC.retries<=3) syncStatusUpdate.retryT=setTimeout(()=>{ if(state.session)loadCoreData({only:errs}); },8000);
    else state.syncLabel=`${errs.map(k=>names[k]).join(' y ')} sin actualizar · toque ↻ para reintentar`;
  }
  else { state.sync='online'; state.syncLabel=`Actualizado ${syncHHMM(new Date())}`; SYNC.retries=0; }
  if (!busy) { state.syncChipUntil=Date.now()+2600; clearTimeout(syncStatusUpdate.t); syncStatusUpdate.t=setTimeout(()=>{ if(!state.loadingCore)safeRenderSync(); },2700); }
  try { document.querySelectorAll('#refreshData').forEach(b=>{ b.classList.toggle('spin',busy); b.disabled=false; }); } catch(_) {}
}
const safeRenderSync=()=>{ if(!(state.active==='nuevo-crm'&&document.activeElement?.closest?.('#crmForm')))render(); else state.pendingRender=true; }; // nunca interrumpe a quien está escribiendo la ficha
function syncResource(key) {
  if (!state.session) return Promise.resolve();
  const fn=coreTasks()[key]; if(!fn){ if(key==='inventory')state.inventory=[]; if(key==='finances')state.finances=[]; return Promise.resolve(); }
  if (SYNC.inflight[key]) { SYNC.queued[key]=true; return SYNC.inflight[key]; } // la segunda intención queda en cola
  const seq=++SYNC.seq;
  const run=(async()=>{
    try { const data=await fn(); if(!state.session)return; state[key]=data; delete state.errors[key]; SYNC.lastOk[key]=Date.now(); persistCoreCache(); }
    catch(error){ state.errors[key]=error?.message||'No disponible'; }
    finally { delete SYNC.inflight[key]; syncStatusUpdate(); safeRenderSync(); }
    if (SYNC.queued[key]) { SYNC.queued[key]=false; await syncResource(key); }
  })();
  SYNC.inflight[key]=run; SYNC.lastSeq=seq; syncStatusUpdate();
  return run;
}
// Qué recarga cada sección visible (el Reload no dispara colecciones ajenas).
function resourcesForVisible() {
  if (state.subview==='inventario'||state.subview==='control'||state.subview==='control-maestro') return ['inventory'];
  if (state.subview==='finanzas') return ['finances'];
  if (state.subview) return [];
  if (state.active==='inicio') return ['clients','profile'];
  if (state.active==='perfil') return ['profile'];
  if (['clientes','cobros','nuevo-crm'].includes(state.active)) return ['clients'];
  return [];
}
async function loadCoreData({force=false,only=null}={}) {
  if (!state.session) return;
  if (!state.clients?.length) restoreCoreCache();
  const all=Object.keys(coreTasks());
  const keys=Array.isArray(only)?only.filter(k=>all.includes(k)):all;
  if (!all.includes('inventory')) state.inventory=[];
  if (!all.includes('finances')) state.finances=[];
  if (!Array.isArray(only)) render();
  await Promise.allSettled(keys.map(k=>syncResource(k)));
}
function refreshVisible({silent=false}={}) {
  const keys=resourcesForVisible();
  if (state.active==='tickets') return ensureTickets(true);
  if (!keys.length) return loadCoreData({only:['clients']});
  if (silent) { const stale=(state.remoteConfig?.syncStaleSeconds||15)*1000; const due=keys.filter(k=>Date.now()-(SYNC.lastOk[k]||0)>stale); if(!due.length)return; return loadCoreData({only:due}); }
  return loadCoreData({only:keys});
}
// Al volver de segundo plano: refresco silencioso del módulo visible si el último éxito tiene más de 15 s (sin polling).
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&state.session)refreshVisible({silent:true}); });
window.addEventListener?.('focus',()=>{ if(state.session)refreshVisible({silent:true}); });

async function ensureCatalog() {
  if (state.catalog || !cap().catalogo) return;
  try { const data=await loadCatalog(); state.catalog=data.catalog || {}; delete state.errors.catalog; }
  catch(e){ state.errors.catalog=e.message; }
  render();
}

async function ensureTickets(force=false) {
  if (state.ticketsFetching) return;
  if (state.ticketsLoaded && !force) return;
  state.ticketsFetching=true;
  if (!state.tickets && restoreTicketsCache()) render();
  try {
    const data=await loadTickets(100);
    state.tickets=data.items || []; state.ticketRecipients=Array.isArray(data.recipients)?data.recipients:[];
    state.ticketsSig=ticketsSignature(state.tickets);
    delete state.errors.tickets; state.ticketsLoaded=true; persistTicketsCache();
  }
  catch(e){ if (!state.tickets) state.errors.tickets=e?.message || 'No se pudieron cargar los tickets.'; else if (force) showToast(e?.message || 'No se pudo actualizar.'); }
  state.ticketsFetching=false;
  render();
}

// Huella de la bandeja: solo se vuelve a dibujar si cambió algo (respuesta nueva, estado, aviso nuevo).
function ticketsSignature(items=[]) {
  return JSON.stringify((Array.isArray(items)?items:[]).map(t=>[t.id||t._id,t.estado,t.updatedAt||'',(t.respuestas||[]).length,t.telegramOk]));
}
async function refreshTicketsSilently() {
  if (state.ticketsFetching) return;
  state.ticketsFetching=true;
  try {
    const data=await loadTickets(100); const items=data.items || [];
    const sig=ticketsSignature(items);
    if (sig!==state.ticketsSig) { state.ticketsSig=sig; state.tickets=items; state.ticketRecipients=Array.isArray(data.recipients)?data.recipients:state.ticketRecipients; state.ticketsLoaded=true; persistTicketsCache(); state.ticketsFetching=false; render(); return; }
  } catch (_) {}
  state.ticketsFetching=false;
}
// Mientras se ve Tickets se revisan respuestas nuevas (p. ej. las que llegan desde Telegram) sin tocar lo que se está escribiendo.
setInterval(()=>{
  if (!state.session || state.ticketsFetching || document.visibilityState==='hidden') return;
  const onTickets=state.active==='tickets'||(state.active==='mas'&&state.subview==='tickets'); if (!onTickets) return;
  const ae=document.activeElement; if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
  if (state.ticketReplyFor) return;
  refreshTicketsSilently();
},15000);
setInterval(()=>{ if (state.session && state.subview==='materia') juegosTick(); },1000);
// R55: la sesión dura hasta "Cerrar sesión" o 1 día sin actividad. Cualquier toque o tecla cuenta como actividad.
function logoutNow(reason='') {clearSession();wipePrivateCaches();state.session=null;state.clients=[];state.inventory=[];state.finances=[];state.profile=null;state.catalog=null;state.tickets=null;state.raffles=null;state.controlInventory=null;state.crmDraft=null;state.crmSheet='';state.active='inicio';state.subview=null;state.renewGroupKey='';render();if(reason)showToast(reason);}
// Cerrar sesión borra la sesión segura y todo caché con información privada; solo quedan preferencias inocuas (tema, app de WhatsApp).
function wipePrivateCaches() {
  try { const keep=/^(sublicuentas-theme|sublicuentas-theme-v2|sublicuentas-whatsapp-app)$/; const kill=[]; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k&&!keep.test(k)&&/(core-cache|tickets-cache|crm|draft|borrador|sublicuentas-session|ficha)/i.test(k))kill.push(k);} kill.forEach(k=>localStorage.removeItem(k)); localStorage.removeItem(CORE_CACHE_KEY); localStorage.removeItem(TICKETS_CACHE_KEY); } catch(_) {}
  try { sessionStorage.clear(); } catch(_) {}
  SYNC.lastOk={};
}
// Mostrar/ocultar secretos (delegado, una sola vez): claves y PIN salen ocultos por defecto.
document.addEventListener('click',e=>{
  const rv=e.target.closest?.('[data-reveal]'); if(rv){ const box=rv.parentElement; const sec=box?.querySelector('[data-secret]'); if(sec){ const shown=sec.dataset.shown==='1'; sec.textContent=shown?(sec.dataset.secret?'••••••••':'—'):sec.dataset.secret; sec.dataset.shown=shown?'0':'1'; rv.textContent=shown?'Mostrar':'Ocultar'; } }
  const eye=e.target.closest?.('[data-pw-eye]'); if(eye){ const inp=eye.parentElement?.querySelector('input'); if(inp){ inp.type=inp.type==='password'?'text':'password'; eye.textContent=inp.type==='password'?'👁':'🙈'; } }
});
// R69 · configuración remota no sensible (versión de API, build mínimo, teléfonos, precios base, reglas).
const REMOTE_CFG_KEY='sublicuentas-remote-config';
function sanitizeRemoteConfig(cfg){ if(!cfg||typeof cfg!=='object')return null; const out={}; for(const k of ['configVersion','apiVersion','minAppBuild','syncStaleSeconds','sellerPhones','calculatorBasePrices','tvDigitalRules','featureFlags'])if(k in cfg)out[k]=cfg[k]; return JSON.stringify(out).match(/token|secret|password|private_key/i)?null:out; }
function applyRemoteConfig(cfg){ if(!cfg)return; state.remoteConfig=cfg; setCompatibility(cfg); if(cfg.sellerPhones)setSellerPhones(cfg.sellerPhones); }
try{ applyRemoteConfig(sanitizeRemoteConfig(JSON.parse(localStorage.getItem(REMOTE_CFG_KEY)||'null'))); }catch(_){}
let remoteCfgAt=0;
async function loadRemoteConfig(force=false){
  if(!state.session||(!force&&Date.now()-remoteCfgAt<10*60*1000))return; remoteCfgAt=Date.now();
  try{ const r=await authPost('/api/mobile-core',{action:'config',appBuild:APP_BUILD}); const cfg=sanitizeRemoteConfig(r?.config||r); if(cfg&&cfg.configVersion!=null&&cfg.configVersion!==state.remoteConfig?.configVersion){ applyRemoteConfig(cfg); localStorage.setItem(REMOTE_CFG_KEY,JSON.stringify(cfg)); render(); } else if(cfg) setCompatibility(cfg); }catch(_){ /* servidor sin configuración todavía: se usan los valores guardados */ }
}
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible')loadRemoteConfig(); });
function checkSessionAlive() { if (state.session && !getSession()) logoutNow('La sesión se cerró por 1 día sin actividad.'); }
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,()=>{ if(state.session) touchSession(); },{passive:true,capture:true}));
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') checkSessionAlive(); });
document.addEventListener('visibilitychange',()=>{ const j=state.juegos; if(document.visibilityState==='hidden'&&j?.screen==='game'&&j.gameCode==='WORD_SEARCH'&&j.engine?.status==='playing'){ j.engine=sopaPause(j.engine); sopaPersist(j.engine); render(); } if(document.visibilityState==='hidden'&&j?.screen==='game'&&j.gameCode==='MEMORY_PAIRS'&&j.engine?.status==='PLAYING'){ j.engine=memPause(j.engine); render(); } if(document.visibilityState==='hidden'&&j?.screen==='game'&&j.gameCode==='HANGMAN'&&j.engine?.status==='PLAYING'&&!j.engine.paused){ j.engine=pauseHang(j.engine); hgPersist(j.engine); render(); } if(document.visibilityState==='hidden'&&j?.screen==='game'&&j.gameCode==='BASKETBALL'&&j.engine?.status==='PLAYING'&&!j.engine.paused&&!j.bqFlying){ j.engine=bqPause(j.engine); bqPersist(j.engine); render(); } });
setInterval(checkSessionAlive,60000);

async function ensureAcademia() {
  if (Array.isArray(state.academia)) return;
  try { const data=await loadAcademiaProgress(); state.academia=Array.isArray(data.progress)?data.progress:[]; state.academiaAvatar=Number.isInteger(data.avatar)?data.avatar:null; state.academiaMascot=Number.isInteger(data.mascot)?data.mascot:null; delete state.errors.academia; }
  catch(e){ state.errors.academia=e.message; }
  render();
}
function academiaDone(){ return Array.isArray(state.academia)?state.academia:[]; }
function academiaUnlocked(){ return academiaDone().length; }
function academiaCategories(){ return ['Todos', ...Array.from(new Set(COURSES.map(c=>c.cat)))]; }

function academiaListView(){
  const usuario=state.session?.usuario || '';
  if (state.academiaSettings) return aulaSettingsHtml({usuario,avatar:state.aulaDraft?.avatar ?? state.academiaAvatar,mascot:state.aulaDraft?.mascot ?? state.academiaMascot,saving:state.aulaSaving});
  if (!state.academia && !state.errors.academia) return aulaLoadingHtml();
  if (state.errors.academia) return aulaErrorHtml(state.errors.academia);
  return aulaDashboardHtml({done:academiaDone(),cat:state.academiaCat,usuario,avatar:state.academiaAvatar,mascot:state.academiaMascot});
}

function academiaLessonView(i){
  return aulaLessonHtml({i,done:academiaDone(),sel:state.academiaSel,usuario:state.session?.usuario || '',mascot:state.academiaMascot});
}

function celebrateAula(){
  const box=document.createElement('div'); box.className='aula-confetti';
  const emojis=['⭐','💎','🎉','🚀','🏆','✨'];
  for(let k=0;k<26;k+=1){const el=document.createElement('i');el.textContent=emojis[k%emojis.length];el.style.left=`${Math.random()*100}%`;el.style.animationDelay=`${Math.random()*.6}s`;el.style.fontSize=`${16+Math.random()*20}px`;box.appendChild(el);}
  document.body.appendChild(box); setTimeout(()=>box.remove(),2600);
}

async function academiaMarkComplete(i){
  if (academiaDone().includes(i)) { state.academiaLesson=null; render(); return; }
  if (state.mutating) return;
  state.mutating=true;
  try { const data=await completeAcademiaLesson(i); state.academia=Array.isArray(data.progress)?data.progress:[...academiaDone(),i]; state.academiaLesson=null; celebrateAula(); showToast((i+1)%10===0?`🏆 Logro desbloqueado: ${COURSES[i].badge}`:'+50 XP · nuevo nivel desbloqueado'); }
  catch(e){ showToast(e?.message||'No se pudo guardar el progreso.'); }
  state.mutating=false; render();
}

async function ensureRaffles(force=false) {
  if ((state.raffles && !force) || !cap().sorteos) return;
  try { state.raffles=await loadRaffles(); delete state.errors.raffles; }
  catch(e){ if(!state.raffles) state.errors.raffles=e.message; else showToast(e?.message||'No se pudo actualizar Sorteos.'); }
  render();
}

/* ───────── Sorteos: crear, editar, eliminar, cerrar, girar ruleta, auditar, entregas ───────── */
function setRaffleStatus(text,type='') { state.raffleStatus=text?{text,type}:null; if(state.subview==='sorteos') render(); }
async function reloadRaffles() { state.raffles=await loadRaffles(); delete state.errors.raffles; }
async function raffleRun(label,fn) {
  if (state.raffleBusy) return;
  state.raffleBusy=true; setRaffleStatus(label);
  try { await fn(); } catch(e) { setRaffleStatus(e?.message||'No se pudo completar la acción.','bad'); }
  finally { state.raffleBusy=false; render(); }
}
/* ─────────── R65 · Exportar Clientes / Cobros (Excel · CSV · TXT) ─────────── */
const uniqueClients = rows => new Set(rows.map(r=>r.clienteId||`${String(r.nombre||'').toLowerCase()}|${String(r.telefono||'').replace(/\D/g,'')}`)).size;
function exportRowsFor(section, scope) {
  if (scope==='all') return allRows(); // allRows ya aplica el alcance del usuario (p. ej. Geisell solo lo suyo)
  if (section==='COBROS') return renewalGroups().flatMap(g=>g.servicios||[]);
  return currentOperationalRows(); // mismos filtros de la pantalla, SIN el límite "Mostrar 100"
}
function exportFilters(section) {
  const sortLabel={recientes:'Más recientes',vence:'Próximo vencimiento',nombre:'Nombre A-Z',monto:'Mayor monto'};
  if (section==='COBROS') return {seccion:'Cobros',estado:{hoy:'Hoy',proximo:'Próximo',vencidos:'Vencidos'}[state.renewFilter]||state.renewFilter,vendedor:state.renewSeller||'Todos',plataforma:'Todas',busqueda:'',orden:'Por fecha'};
  return {seccion:'Clientes',estado:{vigentes:'Vigentes',hoy:'Hoy',proximos:'Próximos',vencidos:'Vencidos'}[state.clientStatusFilter]||state.clientStatusFilter,vendedor:state.clientSellerFilter||'Todos',plataforma:state.clientPlatformFilter?platformLabel(state.clientPlatformFilter):'Todas',busqueda:state.search||'',orden:sortLabel[state.clientSort]||''};
}
function openExportSheet(section) {
  const ex=state.exportUi={section,scope:'filtered',format:'xlsx',busy:false,error:'',file:null};
  const draw=()=>{
    const f=exportRowsFor(section,'filtered'), a=exportRowsFor(section,'all');
    const html=exportSheetHtml({section,scope:ex.scope,format:ex.format,busy:ex.busy,error:ex.error,estadoLabel:exportFilters(section).estado,filteredCount:{clientes:uniqueClients(f),servicios:f.length},allCount:{clientes:uniqueClients(a),servicios:a.length}})
      +(ex.file&&ex.error?'<div class="ex-actions"><button type="button" class="primary" id="exRetry">Reintentar compartir</button></div>':'');
    const host=document.getElementById('srSheetHost'); if(host){host.querySelector('.sr-sheet').innerHTML=html;host.querySelectorAll('.sr-sheet [data-sr-cancel]').forEach(b=>b.addEventListener('click',closeSheet));} else openSheet(html);
    document.querySelectorAll('input[name="exScope"]').forEach(i=>i.addEventListener('change',()=>{ex.scope=i.value;ex.error='';draw();}));
    document.querySelectorAll('input[name="exFormat"]').forEach(i=>i.addEventListener('change',()=>{ex.format=i.value;ex.error='';draw();}));
    document.getElementById('exGo')?.addEventListener('click',run);
    document.getElementById('exRetry')?.addEventListener('click',share);
  };
  const share=async()=>{ if(!ex.file)return; ex.busy=true; ex.error=''; draw(); try{ await saveAndShareFile(ex.file.name,ex.file.data,ex.file.mime,`Reporte de ${section==='COBROS'?'cobros':'clientes'} · Sublichat`); ex.busy=false; closeSheet(); showToast(`Reporte listo: ${ex.file.name}`);}catch(e){ ex.busy=false; ex.error=`Se generó el archivo pero no se pudo compartir (${String(e?.message||'').slice(0,60)}).`; draw(); } };
  const run=async()=>{
    if(ex.busy)return; ex.busy=true; ex.error=''; draw();
    try{
      const rows=exportRowsFor(section,ex.scope); // una sola consulta estable: resumen y detalle salen de las mismas filas
      if(!rows.length) throw new Error('No hay datos para exportar con estos filtros.');
      const status=ex.scope==='all'?'todos':(section==='COBROS'?state.renewFilter:state.clientStatusFilter);
      const data=buildExportDataset(rows,{platformLabel,today:new Date(),scope:ex.scope,filtros:ex.scope==='all'?{seccion:exportFilters(section).seccion,estado:'Todos'}:exportFilters(section)});
      if(ex.format==='xlsx'){ const mod=await import('exceljs/dist/exceljs.min.js'); const ExcelJS=mod.default||mod; const wb=buildExportWorkbook(ExcelJS,data,{titulo:`SUBLICHAT - ${section==='COBROS'?'COBROS':'CLIENTES'}`}); ex.file={name:exportFileName(section,status,'xlsx'),data:new Uint8Array(await wb.xlsx.writeBuffer()),mime:XLSX_MIME}; }
      else if(ex.format==='csv') ex.file={name:exportFileName(section,status,'csv'),data:servicesToCsv(data.services),mime:'text/csv;charset=utf-8'};
      else ex.file={name:exportFileName(section,status,'txt'),data:servicesToTxt(data.services),mime:'text/plain;charset=utf-8'};
      ex.busy=false; await share();
    }catch(e){ ex.busy=false; if(!ex.file)ex.error=String(e?.message||'No se pudo generar el reporte.'); draw(); }
  };
  draw();
}
function openSheet(html) {
  closeSheet();
  const host=document.createElement('div'); host.id='srSheetHost'; host.className='sr-host';
  host.innerHTML=`<div class="sr-backdrop" data-sr-cancel></div><div class="sr-sheet">${html}</div>`;
  document.body.appendChild(host);
  host.querySelectorAll('[data-sr-cancel]').forEach(b=>b.addEventListener('click',closeSheet));
  return host;
}
function closeSheet() { document.getElementById('srSheetHost')?.remove(); }
function askConfirm(opts) {
  return new Promise(resolve=>{
    const host=openSheet(confirmSheetHtml(opts));
    const done=v=>{closeSheet();resolve(v);};
    host.querySelector('[data-sr-yes]').addEventListener('click',()=>done(true));
    host.querySelectorAll('[data-sr-no]').forEach(b=>b.addEventListener('click',()=>done(false)));
    host.querySelectorAll('[data-sr-cancel]').forEach(b=>b.addEventListener('click',()=>resolve(false)));
  });
}
const raffleDraw=id=>(state.raffles?.sorteos||[]).find(d=>String(d.id)===String(id));
async function saveAndReload(payload,tab,okText) {
  await raffleAction(payload); closeSheet(); await reloadRaffles(); state.rafflesTab=tab; setRaffleStatus(okText,'good');
}
function openPrizeSheet(id='') {
  const prize=(state.raffles?.premios||[]).find(p=>String(p.id)===String(id))||null;
  const host=openSheet(prizeSheetHtml({prize,permisos:state.raffles?.permisos||{alcance:'todos'}}));
  host.querySelector('#srPrizeType').addEventListener('change',e=>{const it=RAFFLE_PRESETS[e.target.value]; if(!it) return; host.querySelector('#srPrizeValue').value=it[0]; host.querySelector('#srPrizeUnit').value=it[1]; host.querySelector('#srPrizeDelivery').value=it[2];});
  host.querySelector('#srPrizeForm').addEventListener('submit',async e=>{
    e.preventDefault(); const btn=e.submitter||e.currentTarget.querySelector('[type=submit]'); btn.disabled=true;
    try { await raffleRun('Guardando premio…',()=>saveAndReload({accion:'guardar_premio',id:prize?.id||'',premio:readPrizeForm(host)},'premios','Premio guardado y disponible para futuros sorteos.')); }
    finally { btn.disabled=false; }
  });
}
function openDrawSheet(id='') {
  const draw=id?raffleDraw(id):null;
  if (!draw && (state.raffles?.premios||[]).filter(p=>p.activo!==false).length<1) { state.rafflesTab='premios'; setRaffleStatus('Crea al menos un premio antes de publicar un sorteo.','bad'); return; }
  const host=openSheet(drawSheetHtml({draw,premios:state.raffles?.premios||[],permisos:state.raffles?.permisos||{alcance:'todos'}}));
  host.querySelector('#srDrawCategory').addEventListener('change',e=>{host.querySelector('#srVipConditions').hidden=e.target.value!=='club_vip';});
  const choices=[...host.querySelectorAll('[data-sr-prize-choice]')];
  choices.forEach(c=>c.addEventListener('change',()=>{const n=choices.filter(x=>x.checked).length; if(n>5){c.checked=false;showToast('Máximo cinco premios.');} host.querySelector('#srDrawHint').textContent=`${choices.filter(x=>x.checked).length} premio(s) seleccionado(s)`;}));
  host.querySelector('#srDrawForm').addEventListener('submit',async e=>{
    e.preventDefault(); const btn=e.submitter||e.currentTarget.querySelector('[type=submit]');
    let payload; try { payload=readDrawForm(host); } catch(err) { showToast(err.message); return; }
    btn.disabled=true;
    try { await raffleRun('Guardando sorteo…',()=>saveAndReload({accion:'guardar_sorteo',id:draw?.id||'',sorteo:payload},'sorteos','Sorteo guardado. Los próximos eventos válidos generarán boletos automáticamente.')); }
    finally { btn.disabled=false; }
  });
}
function openDrawMenu(id) {
  const draw=raffleDraw(id); if(!draw) return;
  const host=openSheet(drawMenuSheetHtml(draw,{busy:state.raffleBusy}));
  const go={spin:openWheelSheet,close:raffleClose,tickets:openTicketsSheet,edit:openDrawSheet,audit:raffleAudit,backfill:raffleBackfill,delete:raffleDelete};
  host.querySelectorAll('[data-srm]').forEach(b=>b.addEventListener('click',()=>{const fn=go[b.dataset.srm]; closeSheet(); if(fn) fn(id);}));
}
function openTicketsSheet(id) {
  const draw=raffleDraw(id); if(!draw) return;
  openSheet(ticketsSheetHtml({draw,tickets:(state.raffles?.participantes||[]).filter(t=>String(t.sorteoId)===String(id))}));
}
async function raffleDelete(id) {
  const draw=raffleDraw(id); if(!draw) return;
  if (!await askConfirm({title:'Eliminar sorteo',body:`¿Eliminar definitivamente “${draw.titulo}”?\n\nSe borrarán también sus ${Number(draw.totalBoletos)||0} boleto(s). Esta acción no se puede deshacer.`,ok:'Eliminar',danger:true})) return;
  await raffleRun('Eliminando sorteo y sus registros…',async()=>{const r=await raffleAction({accion:'eliminar_sorteo',id}); await reloadRaffles(); setRaffleStatus(`Sorteo eliminado. Se limpiaron ${Number(r.registrosEliminados)||0} registros relacionados.`,'good');});
}
async function raffleDeletePrize(id) {
  const p=(state.raffles?.premios||[]).find(x=>String(x.id)===String(id)); if(!p) return;
  if (!await askConfirm({title:'Eliminar premio',body:`¿Eliminar el premio “${p.nombre}”?\n\nSolo se permite si no está ligado a ningún sorteo ni entrega.`,ok:'Eliminar',danger:true})) return;
  await raffleRun('Eliminando premio…',async()=>{await raffleAction({accion:'eliminar_premio',id}); await reloadRaffles(); state.rafflesTab='premios'; setRaffleStatus('Premio eliminado correctamente.','good');});
}
async function raffleVip() {
  if (!await askConfirm({title:'Club VIP',body:'¿Crear o actualizar los 3 premios oficiales del Club VIP?',ok:'Preparar'})) return;
  await raffleRun('Preparando premios Club VIP…',async()=>{await raffleAction({accion:'preparar_club_vip'}); await reloadRaffles(); state.rafflesTab='premios'; setRaffleStatus('Club VIP preparado con sus 3 premios oficiales.','good');});
}
async function raffleClose(id) {
  const draw=raffleDraw(id); if(!draw) return;
  if (!await askConfirm({title:'Cerrar participación',body:`¿Cerrar la participación de “${draw.titulo}”? Después podrás girar la ruleta.`,ok:'Cerrar participación'})) return;
  await raffleRun('Cerrando participación…',async()=>{await raffleAction({accion:'cerrar_sorteo',id}); await reloadRaffles(); setRaffleStatus('Participación cerrada. La ruleta ya está lista.','good');});
}
async function raffleDeliver(id) {
  if (!await askConfirm({title:'Entrega',body:'¿Confirmas que el premio ya fue entregado al cliente?',ok:'Sí, entregado'})) return;
  await raffleRun('Registrando entrega…',async()=>{await raffleAction({accion:'marcar_entregado',id}); await reloadRaffles(); state.rafflesTab='ganadores'; setRaffleStatus('Premio marcado como entregado.','good');});
}
async function raffleBackfill(id) {
  const draw=raffleDraw(id); if(!draw) return;
  await raffleRun('Preparando auditoría de agosto…',async()=>{
    const preview=await raffleAction({accion:'cargar_agosto_2026',id,previsualizar:true});
    if (!await askConfirm({title:'Auditoría previa · desde 01/08/2026',body:backfillPreviewText(preview,draw.titulo),ok:'Emitir boletos'})) { setRaffleStatus(''); return; }
    let reset=true,last=null;
    do { last=await raffleAction({accion:'cargar_agosto_2026',id,reiniciar:reset}); reset=false; setRaffleStatus(`Carga de agosto: ${Number(last.procesados)||0} de ${Number(last.totalTareas)||0} operaciones revisadas · ${Number(last.boletosCreados)||0} boletos creados.`); } while(last&&!last.completado);
    await reloadRaffles(); const errors=Number(last?.errores)||0;
    setRaffleStatus(`Agosto cargado: ${Number(last?.clientesDetectados)||0} cliente(s) y ${Number(last?.boletosCreados)||0} boleto(s) nuevos.${errors?` ${errors} registro(s) requieren revisión.`:' Sin duplicados.'}`,errors?'bad':'good');
  });
}
async function raffleAudit(id) {
  const draw=raffleDraw(id); if(!draw) return;
  await raffleRun('Auditando sin cambiar ningún boleto…',async()=>{
    const rep=auditText(await raffleAction({accion:'auditar_boletos',id}));
    if (!rep.needsRepair) { await askConfirm({title:'Auditoría',body:`${rep.text}\n\nNo se modificó nada. Los boletos comprobables ya cumplen la regla estricta.`,ok:'Entendido',cancel:'Cerrar'}); setRaffleStatus(`Auditoría lista: ${rep.boletosEsperados} boletos comprobados; sin faltantes ni sobrantes.`,'good'); return; }
    if (draw.estado!=='activo') { await askConfirm({title:'Auditoría',body:`${rep.text}\n\nNo se modificó nada: este sorteo ya cerró su participación; la corrección solo se permite mientras esté activo y antes de girar la ruleta.`,ok:'Entendido',cancel:'Cerrar'}); setRaffleStatus('Auditoría terminada sin cambios: el sorteo está cerrado.','bad'); return; }
    if (!await askConfirm({title:'¿Reconstruir el padrón?',body:`${rep.text}\n\nSe eliminarán los boletos actuales de este sorteo y se crearán solo los respaldados por operaciones exactas: compra = 1, renovación = 2. Los ambiguos quedan sin emitir para no inflar números.`,ok:'Reconstruir',danger:true})) { setRaffleStatus('Auditoría terminada sin modificar boletos.','good'); return; }
    setRaffleStatus('Reconstruyendo únicamente desde operaciones verificadas…');
    const result=await raffleAction({accion:'corregir_boletos',id,reiniciar:true}); let reset=false,last=null;
    do { last=await raffleAction({accion:'cargar_agosto_2026',id,reiniciar:reset}); reset=false; setRaffleStatus(`Recalculando: ${Number(last.procesados)||0} de ${Number(last.totalTareas)||0} operaciones…`); } while(last&&!last.completado);
    const after=await raffleAction({accion:'auditar_boletos',id}); await reloadRaffles();
    const bad=Number(after?.resumen?.faltantes)||Number(after?.resumen?.sobrantesOSinRespaldo)||0;
    setRaffleStatus(`Boletos reconstruidos: ${Number(result.antes)||0} anteriores retirados · ${Number(last?.boletosCreados)||0} estrictos creados · ${Number(after?.resumen?.faltantes)||0} faltante(s) al verificar.`,bad?'bad':'good');
  });
}
function openWheelSheet(id) {
  const draw=raffleDraw(id); if(!draw) return;
  const tickets=(state.raffles?.participantes||[]).filter(t=>String(t.sorteoId)===String(id));
  const host=openSheet(wheelSheetHtml({draw,tickets}));
  const $=q=>host.querySelector(q);
  $('#srWheelGo').addEventListener('click',async e=>{
    const go=e.currentTarget; go.disabled=true; $('#srWheelCancel').disabled=true; $('#srWheel').classList.add('spinning');
    $('#srWheelResult').innerHTML='<span>Mezclando todos los boletos…</span>';
    try {
      const data=await raffleAction({accion:'girar_ruleta',id}); const winner=data.ganador||{}; const pool=Array.isArray(data.ruleta)?data.ruleta:[];
      let pos=0; const live=$('#srWheelLive');
      await new Promise(resolve=>{const timer=setInterval(()=>{const t=pool[pos%Math.max(1,pool.length)]; if(t&&live) live.innerHTML=`<b>${esc(t.codigo)}</b><span>${esc(t.clienteNombre)}</span>`; pos+=1; if(pos>=Math.max(pool.length,36)){clearInterval(timer);resolve();}},Math.max(28,Math.min(75,2200/Math.max(1,pool.length))));});
      $('#srWheel').classList.remove('spinning'); $('#srWheel').classList.add('done');
      if(live) live.innerHTML=`<b>${esc(winner.codigo||'')}</b><span>${esc(winner.clienteNombre||'Cliente')}</span>`;
      $('#srWheelResult').innerHTML=`<small>🏆 GANADOR</small><b>${esc(winner.clienteNombre||'Cliente')}</b><strong>${esc(winner.codigo||'')}</strong><span>${Number(data.totalParticipantes)||pool.length} boletos incluidos · prueba ${esc((data.auditoria?.hashParticipantes||'').slice(0,12))}</span>`;
      go.hidden=true; $('#srWheelCancel').disabled=false; $('#srWheelCancel').textContent='Cerrar';
      await reloadRaffles(); setRaffleStatus('Ganador guardado correctamente.','good');
    } catch(err) {
      $('#srWheel').classList.remove('spinning'); go.disabled=false; $('#srWheelCancel').disabled=false; $('#srWheelResult').innerHTML=`<span>${esc(err.message)}</span>`;
    }
  });
}

async function ensureControlMaster() {
  if (state.controlInventory || !cap().controlMaestro) return;
  try { state.controlInventory=await loadMobileResource('inventario', {pageSize:250,maxPages:16}); delete state.errors.controlMaster; }
  catch(e){ state.errors.controlMaster=e.message; }
  render();
}

function splashView() {
  return `<main class="splash-screen"><div class="splash-stage"><img class="splash-art" src="/assets/intro-clean-loader.png" alt="Sublichat"><span class="splash-loader" aria-label="Cargando"></span></div></main>`;
}

function loginView() {
  return `<main class="visual-login-shell"><div class="visual-login-stage">
    <img class="visual-login-bg" src="/assets/login-clean-bg.png" alt="Sublichat">
    <form id="loginForm" class="visual-login-form">
      <div class="visual-field"><input id="loginUser" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Usuario o correo" aria-label="Usuario o correo"></div>
      <div class="visual-field visual-password"><input id="loginPassword" type="password" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Contraseña" aria-label="Contraseña"><button type="button" id="toggleLoginPassword" aria-label="Mostrar contraseña">Mostrar</button></div>
      <button class="visual-login-submit" type="submit" ${state.loading?'disabled':''}>${state.loading?'Ingresando…':'Iniciar sesión  →'}</button>
      ${state.errors.login?`<div class="visual-login-error">${esc(state.errors.login)}</div>`:''}
    </form>
  </div></main>`;
}

function syncPill() {
  const cfg = state.sync==='online' ? ['sync-ok',state.syncLabel||'Sincronizado'] : state.sync==='syncing' ? ['syncing','Actualizando…'] : state.sync==='partial' ? ['sync-warn',state.syncLabel||'Parcial'] : state.sync==='offline' ? ['sync-warn','Sin conexión'] : ['','Listo'];
  return `<span class="sync-pill ${cfg[0]}"><i></i>${cfg[1]}</span>`;
}

function dashboardView() {
  const rows = allRows();
  const summary = dashboardSummary(rows, new Date());
  // R70: las tarjetas de Inicio abren Cobros → cuentan EXACTAMENTE lo mismo que Cobros (clientes por fecha, sin filtro de vendedor).
  { const keep=state.renewSeller; state.renewSeller=''; try { const g={hoy:renewalGroups('hoy'),proximo:renewalGroups('proximo'),vencidos:renewalGroups('vencidos')}; summary.hoy=g.hoy.length; summary.proximo={count:g.proximo.length,label:g.proximo.length?formatDateShort(g.proximo[0].fechaRenovacion):'—'}; summary.vencidos=g.vencidos.length; } finally { state.renewSeller=keep; } }
  const firstName = String(state.profile?.nombre || state.session?.usuario || 'Sublicuentas').split(/\s+/)[0];
  const tool=(tone,asset,open,title)=>`<button class="home-tool-card ${tone}" data-open="${open}" aria-label="${title}"><img class="home-card-art" src="/assets/${asset}" alt="${title}"></button>`;
  return `<section class="visual-home-hero">
      <div class="visual-home-brand"><img class="visual-brand-logo-mini" src="/assets/sublicuentas-logo-oficial.png" alt="Sublicuentas"><h1>Hola, ${esc(firstName)}</h1>${mottoHtml(dailyPhrase())}</div>
      <div class="visual-home-actions"><button class="visual-bell" data-open="tickets" aria-label="Tickets y avisos"><svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true"><path d="M24 8c-6.6 0-10.8 4.9-10.8 11v6.4L10 30.6v2.4h28v-2.4l-3.2-5.2V19c0-6.1-4.2-11-10.8-11Z" fill="#0d3ba6"/><path d="M20 34a4 4 0 0 0 8 0Z" fill="#0d3ba6"/><circle cx="35" cy="12" r="6" fill="#e2231a"/></svg></button><button class="avatar-btn" data-open="perfil">${avatarMarkup()}</button></div>
      <div class="visual-sync">${syncPill()}<span>${esc(roleLabel(state.session?.role, state.session?.usuario))}</span><b>›</b></div>
      <img class="visual-bot" src="/assets/sublirobot-oficial.png" alt="Sublibot">
    </section>
    <section class="visual-metrics">
      <button class="mcard mcard-today" data-renew-filter="hoy"><span class="mcard-icon">${metricIcon('calendar')}</span><span class="mcard-copy"><em>Vencen hoy</em><strong>${summary.hoy}</strong></span>${metricWave()}</button>
      <button class="mcard mcard-next" data-renew-filter="proximo"><span class="mcard-icon">${metricIcon('clock')}</span><span class="mcard-copy"><em>Próximos</em><small>${esc(summary.proximo.label)}</small><strong>${summary.proximo.count}</strong></span>${metricWave()}</button>
      <button class="mcard mcard-expired" data-renew-filter="vencidos"><span class="mcard-icon">${metricIcon('alert')}</span><span class="mcard-copy"><em>Vencidos</em><strong>${summary.vencidos}</strong></span>${metricWave()}</button>
    </section>
    <section class="visual-workspace">
      <div class="section-head"><div><p class="eyebrow">HERRAMIENTAS</p><h2>Su espacio de trabajo</h2></div><button class="icon-btn" id="refreshData" aria-label="Actualizar datos">${icon('refresh')}</button></div>
      <div class="visual-module-grid">
        ${roleModules(state.session?.role || '', state.session?.usuario || '').home.map(id=>({aula:['tool-aula','10_aula_de_clases.png','aula','Aula de clases'],finanzas:['tool-finance','11_control_financiero.png','finanzas','Control financiero'],materia:['tool-brain','12_materia_cerebral.png','materia','Materia cerebral'],clientes:['tool-clients','13_clientes.png','clientes','Clientes'],tickets:['tool-tickets','15_tickets_y_avisos.png','tickets','Tickets y avisos']}[id])).filter(Boolean).map(t=>tool(...t)).join('')}
      </div>
    </section>
    ${state.errors.clients?`<div class="error-box">${icon('alert',18)}<span>Clientes: ${esc(state.errors.clients)}</span></div>`:''}`;
}
const clientKeyOf = r => r.clienteId||`${String(r.nombre||'').trim().toLowerCase()}|${String(r.telefono||'').replace(/\D/g,'')}`;
// R63: cada cliente vigente cuenta en UNA sola casilla: "Hoy" si tiene algún servicio que vence hoy; si no, "Próximos".
// Así Vigentes = Hoy + Próximos siempre (antes un cliente con un servicio hoy y otro más adelante contaba en las dos).
function clientsWithTodayService(base) { return new Set(filterOperationalRows(allRows(),{...base,status:'hoy'}).map(clientKeyOf)); }
function currentOperationalRows() {
  const base={query:state.search,seller:state.clientSellerFilter,platform:state.clientPlatformFilter,today:new Date()};
  const rows=filterOperationalRows(allRows(), {...base,status:state.clientStatusFilter});
  if (state.clientStatusFilter!=='proximos') return rows;
  const hoy=clientsWithTodayService(base);
  return rows.filter(r=>!hoy.has(clientKeyOf(r)));
}
function uniqueClientCount(rows=[]) {
  return new Set(rows.map(clientKeyOf)).size;
}

function clientFilterCounts() {
  const rows=allRows();
  const base={query:state.search,seller:state.clientSellerFilter,platform:state.clientPlatformFilter,today:new Date()};
  const vig=new Set(filterOperationalRows(rows,{...base,status:'vigentes'}).map(clientKeyOf));
  const hoy=new Set([...clientsWithTodayService(base)].filter(k=>vig.has(k)));
  return {
    vigentes:vig.size,
    hoy:hoy.size,
    proximos:vig.size-hoy.size,
    vencidos:uniqueClientCount(filterOperationalRows(rows,{...base,status:'vencidos'})),
  };
}

function operationalGroupsForClients() {
  return groupRenewalsByClientDate(currentOperationalRows());
}

function computeClientListData() {
  const rows=allRows();
  const filtered=currentOperationalRows();
  const groups=groupClientsByFicha(filtered);
  const limit=Number(state.clientLimit)||100;
  const clientMap=new Map((state.clients||[]).map(c=>[String(c.id),c]));
  const sorted=sortClientGroups(groups,state.clientSort||'recientes',{clientById:id=>clientMap.get(String(id)),parse:parseDateDMY});
  const visible=sorted.slice(0,limit);
  const today=new Date();
  const cards=visible.map(g=>{
    const first=g.primero||g.servicios[0];
    const st=dueStatus(g.fechaRenovacion,parseDateDMY,today);
    return {clienteId:first?.clienteId||'',actionKey:rowKey(first),nombre:g.nombre,telefono:first?.telefono||clientMap.get(String(first?.clienteId))?.telefono||'',plataformas:g.servicios.map(x=>x.plataforma).filter(Boolean),fecha:g.fechaRenovacion,total:money(g.total),vendedor:g.vendedores.join(' + '),statusTone:st.tone,statusLabel:st.label,tone:clientTone(g.nombre),initials:clientInitials(g.nombre)};
  });
  return {cards,shown:visible.length,total:groups.length,uniqueClients:filtered.length};
}
function clientsView() {
  if (state.selectedClientId) return clientDetailView();
  const options=operationalFilterOptions(allRows());
  const {cards,shown,total,uniqueClients}=computeClientListData();
  return clientsScreenHtml({counts:clientFilterCounts(),statusFilter:state.clientStatusFilter,search:state.search,filtersOpen:state.clientFiltersOpen!==false,platforms:options.platforms,sellers:options.sellers,platformFilter:state.clientPlatformFilter,sellerFilter:state.clientSellerFilter,limit:Number(state.clientLimit)||100,sort:state.clientSort||'recientes',shown,total,uniqueClients,cards,canNewCrm:Boolean(cap().nuevoCrm),platformLabel});
}
// Actualización quirúrgica de la lista de Clientes: solo cambia las tarjetas y el contador, sin tocar
// el resto de la pantalla (el buscador nunca pierde el foco ni se redibuja "toda la pantalla" al escribir,
// que era lo que causaba el salto/parpadeo mientras se tecleaba).
function refreshClientList() {
  const list=document.querySelector('.cli-list'); if(!list) return;
  const {cards,shown,total,uniqueClients}=computeClientListData();
  list.innerHTML = cards.length ? cards.map(clientCardHtml).join('') : `<div class="empty-state"><strong>Sin resultados</strong><span>Revise búsqueda, vendedor, plataforma o estado.</span></div>`;
  const metaB=document.querySelectorAll('.cli-meta b'); if(metaB[0])metaB[0].textContent=String(shown); if(metaB[1])metaB[1].textContent=String(total); if(metaB[2])metaB[2].textContent=String(uniqueClients);
  document.querySelectorAll('[data-client-id]').forEach(btn=>btn.addEventListener('click',()=>{state.selectedClientId=btn.dataset.clientId;render();}));
  document.querySelectorAll('[data-client-actions]').forEach(btn=>btn.addEventListener('click',()=>{state.clientActionKey=btn.dataset.clientActions||'';state.clientActionMode='menu';state.clientActionLink='';render();}));
}

function clientDetailView() {
  const client = state.clients.find(c=>c.id===state.selectedClientId);
  if (!client) { state.selectedClientId=''; return clientsView(); }
  const rows = allRows().filter(r=>r.clienteId===client.id);
  return `<section class="page-head detail-head"><button class="back-btn" id="backClients">${icon('back')}</button><div class="grow"><p class="eyebrow">FICHA</p><h1>${esc(clientName(client))}</h1><p class="muted">${esc(client.telefono || 'Sin teléfono')}</p></div></section>
    <section class="panel identity-card"><div>${icon('user',22)}</div><div><span>ID cliente</span><strong>${esc(client.id)}</strong></div></section>
    ${cap().nuevoCrm?`<button class="secondary full client-add-service" data-client-add-service="${esc(rows[0]?rowKey(rows[0]):client.id)}">➕ Agregar otra cuenta al mismo cliente</button>`:''}
    <section class="list-stack service-list">
      ${rows.length ? rows.map(row=>`<article class="service-card"><div class="service-top"><div><strong>${esc(platformLabel(row.plataforma))}</strong><span>${esc(row.correo || 'Sin correo')}</span><small>${esc(row.vendedor||'Sin vendedor')}</small></div><span class="date-chip">${esc(row.fechaRenovacion || 'Sin fecha')}</span></div><div class="service-bottom"><span>${row.precio?money(row.precio):'Sin precio'}${row.compraId?` · ${esc(row.compraId.slice(0,10))}`:''}</span></div><div class="service-actions"><button class="mini-primary" data-client-service-detail="${esc(rowKey(row))}">${icon('eye',16)} Ver ficha</button><button class="mini-primary" data-renew-key="${esc(rowKey(row))}">${icon('renew',16)} Renovar</button><button class="wa-action mini" data-client-charge="${esc(rowKey(row))}">${icon('phone',17)} Mensaje de cobro</button><button class="secondary mini" data-client-actions="${esc(rowKey(row))}">⋮ Acciones</button></div></article>`).join('') : `<div class="empty-state"><strong>Sin servicios</strong><span>Esta ficha no tiene servicios activos.</span></div>`}
    </section>`;
}

// R70: "Nuevo CRM" abre una ficha LIMPIA si la anterior ya se guardó o era una edición; solo conserva un borrador sin guardar.
function crmDraftForNew() {
  const d=state.crmDraft;
  const saved=d&&(d.savedClientId||d.compraId||d.plataformaOriginal);
  const blank=d&&!String(d.nombrePerfil||'').trim()&&!String(d.telefono||'').trim();
  if(!d||saved||blank){ state.crmUrlVariant=0; state.crmFichaOpen=false; state.crmSheet=''; return crmDefaultDraft(); }
  return crmDraftFixSeller(d);
}
function crmDraftFixSeller(d) { if (d && !d.vendedor && state.session) { d.vendedor=sellerForSession(state.session.role||'',state.session.usuario||''); d.vendedorTelefono=d.vendedorTelefono||sellerPhone(d.vendedor); } return d; }
function crmDefaultDraft() {
  const vendedor=sellerForSession(state.session?.role || '', state.session?.usuario || '');
  return {
    clienteId:'', forzarNuevoServicio:false, servicioIndex:null, plataformaOriginal:'', correoOriginal:'',
    nombrePerfil:'', telefono:'', vendedor, vendedorTelefono:sellerPhone(vendedor),
    beneficiarioTipo:'titular', beneficiarioNombre:'', plataforma:'netflix', precio:String(crmDefaultPrice('netflix',vendedor)||''), fechaRenovacion:datePlusDaysDMY(30),
    mesesContratados:1, visibilidadModo:'plataforma', visCorreo:true, visClave:true, visPin:true,
    perfiles:[{nombre:'',correo:'',clave:'',pinPerfil:'',dispositivo:'',esRoku:false}],
    fichaTexto:'', tvDispositivos:'1', iptvProveedor:'', iptvPantallas:'1', iptvLista:'', iptvHora:crmNowHour(), maxPlayer:false, maxPlayerUsuario:'', maxPlayerClave:'', oleadaDispositivos:'1', stellaDispositivos:'1',
    savedClientId:'', savedLink:'', savedBeneficiarioKey:'titular',
  };
}

function crmDraft() { return crmDraftFixSeller(state.crmDraft || (state.crmDraft=crmDefaultDraft())); }
function crmPlatformLabel(value='') { return CRM_PLATFORMS.find(([v])=>v===value)?.[1] || value || 'Servicio'; }
// R69 · credenciales Max Player ya usadas con el MISMO proveedor (no se muestran contraseñas en la lista).
function maxPlayerSavedCreds(plat='') {
  const base=crmBasePlatform(plat); const map=new Map();
  const add=(u,c)=>{ u=String(u||'').trim(); c=String(c||''); if(!u||!c)return; const k=u.toLowerCase(); const x=map.get(k)||{usuario:u,clave:c,count:0}; x.count+=1; map.set(k,x); };
  for (const client of state.clients||[]) for (const sv of (Array.isArray(client.servicios)?client.servicios:[])) if (sv?.maxPlayer===true && crmBasePlatform(sv.plataforma)===base) add(sv.maxPlayerUsuario,sv.maxPlayerClave);
  for (const it of state.inventory||[]) if (/max\s*player/i.test(String(it?.plataforma||it?.tipo||'')) && (!it.proveedor||crmBasePlatform(it.proveedor)===base)) add(it.correo||it.usuario,it.clave);
  return [...map.values()].sort((a,b)=>b.count-a.count||a.usuario.localeCompare(b.usuario));
}
function crmIsIptvFamily(value='') { return iptvUsesMaxPlayer(value); }
function crmNowHour() { const n=new Date(); return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`; }
function crmIsTvDigital(value='') { return ['stellatv','oleada','latintv','liontv','evoutouch'].includes(crmBasePlatform(value)); }

function readCrmDraftFromDom() {
  const d={...crmDraft()};
  const val=id=>String(document.querySelector(`#${id}`)?.value ?? '').trim();
  d.nombrePerfil=val('crmNombre'); d.telefono=val('crmTelefono'); d.plataforma=val('crmPlataforma');
  const sellerSel=val('crmVendedor'); d.vendedor=sellerSel==='__nuevo__'?val('crmVendedorNuevo'):sellerSel;
  d.vendedorTelefono=val('crmVendedorTelefono'); d.beneficiarioTipo=val('crmBeneficiarioTipo')==='tercero'?'tercero':'titular'; d.beneficiarioNombre=val('crmBeneficiarioNombre');
  d.precio=val('crmPrecio'); d.fechaRenovacion=val('crmFecha'); d.mesesContratados=Number(val('crmMeses')||1)||1;
  d.visibilidadModo=val('crmVisibilidadUrl')||'plataforma';
  d.visCorreo=document.querySelector('#crmVisCorreo')?.checked ?? true; d.visClave=document.querySelector('#crmVisClave')?.checked ?? true; d.visPin=document.querySelector('#crmVisPin')?.checked ?? true;
  const fichaEl=document.querySelector('#crmFichaTexto'); d.fichaTexto=fichaEl?.dataset.auto==='1' ? '' : String(fichaEl?.value ?? d.fichaTexto ?? '');
  d.tvDispositivos=val('crmTvDispositivos') || d.tvDispositivos || '1';
  d.iptvProveedor=val('crmIptvProveedor'); d.iptvPantallas=d.tvDispositivos; d.iptvLista=val('crmIptvLista'); d.iptvHora=val('crmIptvHora'); if(document.querySelector('#crmMaxPlayer'))d.maxPlayer=val('crmMaxPlayer')==='si'; if(document.querySelector('#crmMaxUser'))d.maxPlayerUsuario=val('crmMaxUser'); if(document.querySelector('#crmMaxPass'))d.maxPlayerClave=val('crmMaxPass');
  d.oleadaDispositivos=d.tvDispositivos; d.stellaDispositivos=d.tvDispositivos;
  d.perfiles=[...document.querySelectorAll('[data-crm-profile]')].map((node,index)=>({
    perfilId:String(node.dataset.perfilId||d.perfiles?.[index]?.perfilId||''),
    nombre:String(node.querySelector('[data-p-name]')?.value || '').trim() || d.nombrePerfil,
    correo:String(node.querySelector('[data-p-email]')?.value || '').trim(),
    clave:String(node.querySelector('[data-p-password]')?.value || ''),
    pinPerfil:String(node.querySelector('[data-p-pin]')?.value || '').trim(),
    dispositivo:String(node.querySelector('[data-p-device]')?.value || '').trim(),
    esRoku:String(node.querySelector('[data-p-device]')?.value || '')==='tv' && String(node.querySelector('[data-p-roku]')?.value || 'no')==='si',
  }));
  if(!d.perfiles.length)d.perfiles=[{nombre:d.nombrePerfil,correo:'',clave:'',pinPerfil:'',dispositivo:'',esRoku:false}];
  return d;
}

function crmFichaFromDraft(d=crmDraft()) {
  return buildTraditionalFicha({
    nombrePerfil:d.nombrePerfil, plataforma:crmPlatformLabel(d.plataforma), plataformaRaw:d.plataforma, fechaRenovacion:d.fechaRenovacion,
    perfiles:d.perfiles, vendedor:d.vendedor, vendedorTelefono:d.vendedorTelefono, telefono:d.telefono, precio:Number(d.precio||0), mesesContratados:Number(d.mesesContratados||1), iptvProveedor:d.iptvProveedor, iptvPantallas:Number(d.tvDispositivos||d.iptvPantallas||1), iptvLista:d.iptvLista, iptvHora:d.iptvHora, maxPlayer:d.maxPlayer===true, maxPlayerUsuario:d.maxPlayerUsuario, maxPlayerClave:d.maxPlayerClave, oleadaDispositivos:Number(d.tvDispositivos||d.oleadaDispositivos||1), stellaDispositivos:Number(d.tvDispositivos||d.stellaDispositivos||1),
  });
}

/* ═════════════ NUEVA VENTA · ficha CRM (diseño R50) ═════════════ */
const CRM_ICO = {
  user:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-4.4 3.3-6.5 7.5-6.5s6.7 2.1 7.5 6.5"/>',
  phone:'<path d="M6.5 3.5 10 7l-2 3c1.4 2.8 3.2 4.6 6 6l3-2 3.5 3.5-2.2 3c-.7 1-2 1.4-3.2 1C8.6 19.4 4.6 15.4 2.5 8.9c-.4-1.2 0-2.5 1-3.2l3-2.2Z"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.3 2.5-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.7c2.9-.6 5 .9 5.5 4.3"/>',
  store:'<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12v8h13v-8"/><path d="M10 20v-4.5h4V20"/>',
  box:'<path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M12 11v10"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  eye:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  dollar:'<circle cx="12" cy="12" r="9"/><path d="M15 8.8c-.6-.9-1.7-1.4-3-1.4-1.8 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.3-3.1 2.3-1.4 0-2.6-.6-3.2-1.6M12 5.5v13"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M7.5 3v4M16.5 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
  refresh:'<path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16.5 6.5 19 9M14 9l2 2"/>',
  mail:'<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
  link:'<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  copy:'<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
  doc:'<path d="M14 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V9L14 3.5Z"/><path d="M14 3.5V9h5.5M8.5 13h7M8.5 16.5h5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  save:'<path d="M5 3.5h11l3.5 3.5v11A2.5 2.5 0 0 1 17 20.5H7A2.5 2.5 0 0 1 4.5 18V6"/><path d="M8 3.5v5h7v-5M8 20.5v-6h8v6"/>',
  send:'<path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-7.5L3 9.5 21 3Z"/>',
  list:'<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="17.5" r="1" fill="currentColor"/>',
  hash:'<path d="M9 3.5 7 20.5M17 3.5l-2 17M4 9h16.5M3.5 15H20"/>',
  tv:'<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
  wa:'<path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.3-4.3a8.5 8.5 0 1 1 15.7-4.5Z"/><path d="M9 8.5c.2 3.4 2.9 6.2 6.5 6.6l1-1.6-1.9-1-.9.8c-1-.4-1.9-1.3-2.4-2.4l.8-.9-.9-1.9-1.7.9"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  trash:'<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
};
function crmIco(name,size=18){ return svg(CRM_ICO[name]||'',size); }
function crmNorm(s=''){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); }
function crmWaBold(text=''){ return esc(text).replace(/\*([^*\n]+)\*/g,'<b>$1</b>').replace(/_([^_\n]+)_/g,'<i>$1</i>'); }
function crmBeneficiaryName(d){ return d.beneficiarioTipo==='tercero'?(d.beneficiarioNombre||d.nombrePerfil):d.nombrePerfil; }
function crmUrlMessage(d,link=d.savedLink){ return buildUrlDeliveryMessage({nombre:crmBeneficiaryName(d),servicio:crmPlatformLabel(d.plataforma),link,variante:state.crmUrlVariant}); }
function crmNeedsSellerPhone(d){ const known=CRM_SELLERS.includes(d.vendedor); return !known || !sellerPhone(d.vendedor) || (d.vendedorTelefono && d.vendedorTelefono!==sellerPhone(d.vendedor)); }

function crmField(label,{req=false,ico='',control='',cls='',attrs='',select=false,help=''}={}) {
  return `<label class="crm-field crm2-field ${cls}" ${attrs}>${label?`<span>${label}${req?' <i class="crm2-req">*</i>':''}</span>`:''}<div class="crm2-input${select?' is-select':''}${ico?' has-ico':''}">${ico?`<em class="crm2-lead">${crmIco(ico,18)}</em>`:''}${control}</div>${help?`<small>${help}</small>`:''}</label>`;
}

function crmProfileBlock(profile,index,rules,total=1) {
  const p=profile||{}; const n=index+1;
  const showRoku=rules.device && p.dispositivo==='tv';
  const extra=rules.pin || rules.device;
  return `<section class="crm-profile crm2-profile" data-crm-profile="${index}" data-perfil-id="${esc(p.perfilId||'')}">
    ${total>1?`<div class="crm-profile-head crm2-profile-head"><b>Perfil ${n}</b>${index>0?`<button type="button" class="text-danger crm2-remove" data-remove-crm-profile="${index}" aria-label="Quitar perfil ${n}">${crmIco('trash',15)} Quitar</button>`:''}</div>`:''}
    <div class="crm2-profile-row">
      ${crmField('',{cls:'crm2-p-name',ico:'user',control:`<input data-p-name value="${esc(p.nombre||p.perfil||'')}" aria-label="Perfil ${n} · Nombre de la persona/perfil" placeholder="Nombre del perfil">`})}
      ${crmField('',{cls:'crm2-p-email',ico:rules.iptv?'user':'mail',attrs:rules.email?'':'hidden',control:`<input data-p-email value="${esc(p.correo||'')}" autocomplete="off" autocapitalize="none" aria-label="Perfil ${n} · ${rules.iptv?'Usuario':'Correo / usuario'}" placeholder="${rules.iptv?'Usuario':'Correo / usuario'}">`})}
      ${crmField('',{cls:'crm2-p-pass',ico:'key',attrs:rules.password?'':'hidden',control:`<input type="password" data-p-password value="${esc(p.clave||'')}" autocomplete="off" autocapitalize="none" aria-label="Perfil ${n} · Clave / serial / contraseña" placeholder="Clave"><button type="button" class="pw-eye" data-pw-eye aria-label="Mostrar u ocultar">👁</button>`})}
    </div>
    <div class="crm2-profile-row crm2-profile-extra" ${extra?'':'hidden'}>
      ${crmField('',{cls:'crm2-p-pin',ico:'hash',attrs:rules.pin?'':'hidden',control:`<input type="password" data-p-pin value="${esc(p.pinPerfil||'')}" inputmode="numeric" aria-label="Perfil ${n} · PIN individual" placeholder="PIN"><button type="button" class="pw-eye" data-pw-eye aria-label="Mostrar u ocultar">👁</button>`})}
      ${crmField('',{cls:'crm2-p-device',ico:'tv',select:true,attrs:rules.device?'':'hidden',control:`<select data-p-device aria-label="Perfil ${n} · ¿Dónde va a usar este perfil?"><option value="">TV o celular</option><option value="tv" ${p.dispositivo==='tv'?'selected':''}>📺 TV</option><option value="cel" ${p.dispositivo==='cel'?'selected':''}>📱 Celular</option></select>`})}
      ${crmField('',{cls:'crm2-p-roku',select:true,attrs:showRoku?'':'hidden',control:`<select data-p-roku aria-label="Perfil ${n} · ¿El TV es Roku?"><option value="no">No es Roku</option><option value="si" ${p.esRoku?'selected':''}>Sí, es Roku</option></select>`})}
    </div>
  </section>`;
}

function crmCatalogSheet(d) {
  const seller=d.vendedor||'';
  return `<div class="sheet-backdrop crm2-sheet-bg" id="crmSheetBackdrop"><section class="bottom-sheet crm2-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()"><div class="sheet-handle"></div>
    <p class="eyebrow">CATÁLOGO</p><h2>Elija el servicio</h2>
    <div class="search-box crm2-sheet-search">${crmIco('search',18)}<input id="crmCatalogQuery" placeholder="Buscar plataforma…" autocomplete="off"></div>
    <div class="crm2-cat-grid" id="crmCatalogGrid">${CRM_PLATFORMS.map(([value,label])=>{const price=crmDefaultPrice(crmStoredPlatform(value,crmAllowedDevices(value)[0]||1),seller);return `<button type="button" class="crm2-cat-item ${value===d.plataforma?'on':''}" data-crm-pick-platform="${esc(value)}" data-q="${esc(crmNorm(label+' '+value))}">${platformLogoHtml(value,label,'crm2-cat-logo')}<span>${esc(label)}</span><small>${price?money(price):'Precio manual'}</small></button>`;}).join('')}</div>
    <div class="sheet-actions"><button type="button" class="secondary" id="crmSheetCancel">Cerrar</button></div>
  </section></div>`;
}

function crmClientResultsHtml(query='') {
  const q=crmNorm(query); const digits=String(query||'').replace(/\D/g,'');
  const list=(state.clients||[]);
  if(!list.length)return `<div class="crm2-empty">Los clientes aún se están cargando…</div>`;
  if(!q)return `<div class="crm2-empty">Escriba el nombre o el teléfono del cliente.</div>`;
  const hits=list.filter(c=>crmNorm(c.nombrePerfil||c.nombre).includes(q)||(digits.length>=3&&String(c.telefono||'').replace(/\D/g,'').includes(digits))).slice(0,30);
  if(!hits.length)return `<div class="crm2-empty">No se encontró “${esc(query)}”. Puede cerrar y registrarlo como cliente nuevo.</div>`;
  return hits.map(c=>{const servs=Array.isArray(c.servicios)?c.servicios:[];const plats=[...new Set(servs.map(s=>platformLabel(s.plataforma)).filter(Boolean))];return `<button type="button" class="crm2-client-hit" data-crm-pick-client="${esc(c.id||'')}"><span class="crm2-client-av">${esc(String(clientName(c)).trim().charAt(0).toUpperCase()||'?')}</span><span class="crm2-client-txt"><b>${esc(clientName(c))}</b><small>${esc(c.telefono||'Sin teléfono')}${plats.length?` · ${esc(plats.slice(0,3).join(', '))}${plats.length>3?'…':''}`:''}</small></span>${crmIco('plus',18)}</button>`;}).join('');
}

function crmClientSheet() {
  const q=state.crmClientQuery||'';
  return `<div class="sheet-backdrop crm2-sheet-bg" id="crmSheetBackdrop"><section class="bottom-sheet crm2-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()"><div class="sheet-handle"></div>
    <p class="eyebrow">CLIENTE EXISTENTE</p><h2>Buscar cliente</h2>
    <div class="search-box crm2-sheet-search">${crmIco('search',18)}<input id="crmClientQuery" value="${esc(q)}" placeholder="Nombre o teléfono" autocomplete="off"></div>
    <div class="crm2-client-results" id="crmClientResults">${crmClientResultsHtml(q)}</div>
    <div class="sheet-actions"><button type="button" class="secondary" id="crmSheetCancel">Cerrar</button></div>
  </section></div>`;
}

function crmView() {
  if (!cap().nuevoCrm) return `<div class="empty-state page-empty">${icon('alert',30)}<strong>Nuevo CRM no disponible</strong><span>Su usuario no tiene permiso para registrar ventas.</span></div>`;
  const d=crmDraft(); const rules=crmRules(d.plataforma); const dayNum=parseDateDMY(d.fechaRenovacion)?.getDate(); const day=dayNum?String(dayNum).padStart(2,'0'):'';
  const sellerHit=CRM_SELLERS.includes(d.vendedor)?d.vendedor:(d.vendedor?'__nuevo__':'');
  const tvDigital=crmIsTvDigital(d.plataforma);
  const tvDevices=crmAllowedDevices(d.plataforma);
  const tvMonths=crmAllowedMonths(d.plataforma);
  const ficha=d.fichaTexto || crmFichaFromDraft(d);
  const editing=!!d.plataformaOriginal;
  const count=urlDeliveryVariantCount(); const variant=Math.max(0,Math.min(count-1,Number(state.crmUrlVariant)||0)); state.crmUrlVariant=variant;
  const preview=crmUrlMessage(d,d.savedLink||'🔗 (el enlace se genera al guardar el CRM)');
  const card=(tone,ico,title,sub,extra,body)=>`<section class="panel crm-step crm2-card t-${tone}"><header class="crm2-card-head"><span class="crm2-ico">${crmIco(ico,24)}</span><div class="crm2-card-title"><b>${title}</b>${sub?`<small>${sub}</small>`:''}</div>${extra||''}</header><div class="crm2-card-body">${body}</div></section>`;
  const showSellerPhone=sellerHit==='__nuevo__'||crmNeedsSellerPhone(d);
  const nProf=d.perfiles.length;
  return `<section class="crm2-head"><button class="back-btn close-btn crm2-close" id="backMore" aria-label="Cerrar Nuevo CRM">${icon('close')}</button><div class="crm2-title"><h1>${editing?'Editar':'Nueva'} <em>Venta</em></h1><p>${editing?'Actualiza la cuenta de tu cliente':'Registra la compra de tu cliente'}</p></div><span class="crm2-head-gap" aria-hidden="true"></span></section>
    <form id="crmForm" class="crm-form crm-v2" novalidate>
      ${card('red','user','Datos del cliente','',`<button type="button" class="crm2-pill" id="crmSearchClient">${crmIco('search',16)} Buscar</button>`,`<div class="crm2-grid">
        ${crmField('Nombre del cliente',{req:true,ico:'user',control:`<input id="crmNombre" value="${esc(d.nombrePerfil)}" autocomplete="name" placeholder="Cliente titular" required>`})}
        ${crmField('Teléfono',{req:true,ico:'phone',control:`<input id="crmTelefono" value="${esc(d.telefono)}" inputmode="tel" autocomplete="tel" placeholder="9999-9999" required>`})}
        ${crmField('¿Quién usará el acceso?',{ico:'users',select:true,control:`<select id="crmBeneficiarioTipo" aria-label="¿Quién usará este acceso?"><option value="titular" ${d.beneficiarioTipo!=='tercero'?'selected':''}>El cliente titular</option><option value="tercero" ${d.beneficiarioTipo==='tercero'?'selected':''}>Otra persona</option></select>`})}
        ${crmField('Vendedor responsable',{ico:'store',select:true,help:editing?'Cambiarlo transfiere únicamente esta cuenta.':'',control:`<select id="crmVendedor" aria-label="Vendedor responsable de esta cuenta"><option value="">Seleccione</option>${CRM_SELLERS.map(v=>`<option value="${esc(v)}" ${sellerHit===v?'selected':''}>${esc(v)}</option>`).join('')}<option value="__nuevo__" ${sellerHit==='__nuevo__'?'selected':''}>➕ Agregar vendedor</option></select>`})}
        ${crmField('Nombre del beneficiario',{req:true,ico:'user',cls:'wide',attrs:`id="crmBeneficiarioBox" ${d.beneficiarioTipo==='tercero'?'':'hidden'}`,control:`<input id="crmBeneficiarioNombre" value="${esc(d.beneficiarioNombre)}" placeholder="Ej. María López">`})}
        ${crmField('Nuevo vendedor',{ico:'store',attrs:`id="crmVendedorNuevoBox" ${sellerHit==='__nuevo__'?'':'hidden'}`,control:`<input id="crmVendedorNuevo" value="${sellerHit==='__nuevo__'?esc(d.vendedor):''}" placeholder="Nombre del vendedor">`})}
        ${crmField('Número del vendedor / soporte',{ico:'phone',attrs:`id="crmVendedorTelefonoBox" ${showSellerPhone?'':'hidden'}`,control:`<input id="crmVendedorTelefono" value="${esc(d.vendedorTelefono)}" inputmode="tel" placeholder="Número autorizado">`})}
      </div>`)}
      ${card('blue','box','Servicio','',`<button type="button" class="crm2-pill" id="crmOpenCatalog">${crmIco('search',16)} Ver catálogo</button>`,`
        <div class="crm2-service"><span class="crm2-logo">${platformLogoHtml(d.plataforma,crmPlatformLabel(d.plataforma),'crm2-logo-img')}</span><div class="crm2-input is-select"><select id="crmPlataforma" aria-label="Plataforma">${CRM_PLATFORMS.map(([value,label])=>`<option value="${value}" ${d.plataforma===value?'selected':''}>${label}</option>`).join('')}</select></div></div>
        <section class="crm-url-box crm2-vis"><span class="crm2-vis-ico">${crmIco('eye',26)}</span><div class="crm2-vis-txt"><strong>Datos visibles en la ficha URL</strong><small>Se configura solo para este servicio.</small></div><div class="crm2-input is-select crm2-vis-sel"><select id="crmVisibilidadUrl" aria-label="Datos visibles en la ficha URL"><option value="plataforma" ${d.visibilidadModo==='plataforma'?'selected':''}>Según plataforma</option><option value="todos" ${d.visibilidadModo==='todos'?'selected':''}>Todos los datos</option><option value="correo_clave" ${d.visibilidadModo==='correo_clave'?'selected':''}>Correo y clave</option><option value="solo_correo" ${d.visibilidadModo==='solo_correo'?'selected':''}>Solo correo / usuario</option><option value="solo_pin" ${d.visibilidadModo==='solo_pin'?'selected':''}>Solo PIN</option><option value="personalizado" ${d.visibilidadModo==='personalizado'?'selected':''}>Personalizado</option></select></div>
          <div class="crm-url-custom crm2-vis-custom" id="crmVisCustom" ${d.visibilidadModo==='personalizado'?'':'hidden'}><label><input id="crmVisCorreo" type="checkbox" ${d.visCorreo?'checked':''}> Correo</label><label><input id="crmVisClave" type="checkbox" ${d.visClave?'checked':''}> Clave</label><label><input id="crmVisPin" type="checkbox" ${d.visPin?'checked':''}> PIN</label></div>
        </section>`)}
      ${card('green','calendar','Detalles de la compra','','',`<div class="crm2-grid crm2-grid-4">
        ${crmField('Precio (Lps.)',{req:true,ico:'dollar',control:`<input id="crmPrecio" value="${esc(d.precio)}" inputmode="decimal" placeholder="130" required>`})}
        ${crmField('Meses',{ico:'calendar',select:!!tvMonths.length,control:tvMonths.length?`<select id="crmMeses" aria-label="Meses contratados">${tvMonths.map(n=>`<option value="${n}" ${Number(d.mesesContratados)===n?'selected':''}>${n}</option>`).join('')}</select>`:`<input id="crmMeses" value="${esc(d.mesesContratados)}" type="number" min="1" max="24" inputmode="numeric" aria-label="Meses contratados">`})}
        ${crmField('Fecha de renovación',{ico:'calendar',control:`<input id="crmFecha" value="${esc(d.fechaRenovacion)}" inputmode="numeric" maxlength="10" placeholder="DD/MM/AAAA" required>`})}
        ${crmField('Día de cada mes',{ico:'calendar',control:`<input id="crmDiaMes" value="${esc(day)}" readonly tabindex="-1">`})}
      </div>
      <div class="crm-info crm2-note">${crmIco('refresh',22)}<span>La renovación se generará automáticamente cada mes en el día seleccionado.</span></div>
      <section id="crmTvDigitalBox" ${tvDigital?'':'hidden'} class="panel-soft crm-tv-box crm2-tv"><strong>📺 TV Digital / IPTV</strong><div class="crm2-grid">
        ${crmField('Dispositivos autorizados',{ico:'tv',select:true,control:`<select id="crmTvDispositivos">${(tvDevices.length?tvDevices:[1]).map(n=>`<option value="${n}" ${Number(d.tvDispositivos||1)===n?'selected':''}>${n} dispositivo${n===1?'':'s'}</option>`).join('')}</select>`})}
        ${crmIsIptvFamily(d.plataforma)?crmField('¿Usa Max Player?',{ico:'tv',select:true,control:`<select id="crmMaxPlayer" aria-label="¿Usa Max Player?"><option value="no" ${d.maxPlayer?'':'selected'}>No</option><option value="si" ${d.maxPlayer?'selected':''}>Sí, Max Player</option></select>`}):''}
        ${crmIsIptvFamily(d.plataforma)&&d.maxPlayer?(()=>{const creds=maxPlayerSavedCreds(d.plataforma);const mode=d.maxPlayerMode||(creds.length?'saved':'manual');return crmField('Credencial Max Player',{ico:'key',select:true,cls:'wide',control:`<select id="crmMaxMode" aria-label="Credencial Max Player"><option value="manual" ${mode==='manual'?'selected':''}>✍️ Escribir manualmente</option>${creds.length?`<optgroup label="Seleccionar credencial guardada">${creds.map((c,i)=>`<option value="saved:${i}" ${d.maxPlayerUsuario===c.usuario&&mode==='saved'?'selected':''}>${esc(c.usuario)} · ${c.count} servicio${c.count===1?'':'s'}</option>`).join('')}</optgroup>`:'<option disabled>No hay credenciales guardadas de este proveedor</option>'}</select>`});})():''}
        ${crmIsIptvFamily(d.plataforma)&&d.maxPlayer?crmField('Usuario Max Player',{req:true,ico:'user',control:`<input id="crmMaxUser" value="${esc(d.maxPlayerUsuario||'')}" autocomplete="off" autocapitalize="none" placeholder="Usuario de Max Player">`}):''}
        ${crmIsIptvFamily(d.plataforma)&&d.maxPlayer?crmField('Contraseña Max Player',{req:true,ico:'key',control:`<input type="password" id="crmMaxPass" value="${esc(d.maxPlayerClave||'')}" autocomplete="off" autocapitalize="none" placeholder="Contraseña de Max Player"><button type="button" class="pw-eye" data-pw-eye aria-label="Mostrar u ocultar">👁</button>`}):''}
        ${crmField('Lista',{control:`<input id="crmIptvLista" value="${esc(d.iptvLista)}" placeholder="${esc(iptvDefaultList(d.plataforma,d.iptvProveedor))}">`})}
        ${crmField('Hora',{control:`<input id="crmIptvHora" type="time" value="${esc(d.iptvHora)}">`})}
        ${crmBasePlatform(d.plataforma)==='latintv'?crmField('Servidor',{select:true,control:`<select id="crmIptvProveedor"><option value="latintv" ${iptvProviderKey(d.plataforma,d.iptvProveedor)==='latintv2'?'':'selected'}>LatinTV · latgt.com</option><option value="latintv2" ${iptvProviderKey(d.plataforma,d.iptvProveedor)==='latintv2'?'selected':''}>LatinTV 2 · enlatv.com</option></select>`}):`<input id="crmIptvProveedor" type="hidden" value="${esc(d.iptvProveedor||iptvProviderKey(d.plataforma,''))}">`}
      </div>${crmIsIptvFamily(d.plataforma)?`<p class="crm2-iptv-url">🧾 URL de la lista: <b>${esc(iptvDefaultUrl(d.plataforma,d.iptvProveedor))}</b><br>🔗 En el enlace del cliente: <b>${d.maxPlayer?'usuario y contraseña de Max Player + dispositivos y fecha':d.visibilidadModo==='plataforma'?'solo dispositivos y fecha de renovación':'los datos que usted eligió arriba + dispositivos y fecha'}</b></p>`:''}</section>`)}
      ${card('purple','users','Perfiles incluidos','',`<b class="crm2-badge">${nProf} perfil${nProf===1?'':'es'}</b>`,`
        <div class="crm-profiles-box crm2-profiles">${d.perfiles.map((p,i)=>crmProfileBlock(p,i,{...rules,iptv:crmIsTvDigital(d.plataforma)},nProf)).join('')}</div>
        <button type="button" class="crm2-add-profile" id="crmAddProfile">${crmIco('plus',17)} Otro perfil/cuenta a esta compra (2x1)</button>
        <small class="crm2-hint">Promos 2x1 o varios perfiles de la misma app: un solo precio y una sola renovación.</small>`)}
      ${card('red','list','Guardar y entregar','Revisa la información y entrégala a su cliente','',`
        <section class="crm-link-box crm2-urlcard">
          <header class="crm2-urlcard-head"><span class="crm2-urlcard-ico">${crmIco('link',24)}</span><div><b>Ficha URL de entrega</b><small>Enlace personalizado para tu cliente</small></div></header>
          <div class="crm-link-row crm2-link-row"><div class="crm2-input"><input id="crmLinkInput" value="${esc(d.savedLink||'')}" placeholder="Se genera al guardar el CRM" readonly></div><button type="button" class="secondary crm2-copy" id="crmCopyLink">${crmIco('copy',18)} Copiar</button></div>
          <div class="crm-url-variants crm2-variants"><span>Elige una variante para el mensaje</span>
            <div class="crm-variant-tabs crm2-tabs">${Array.from({length:count},(_,i)=>`<button type="button" data-crm-url-variant="${i}" class="${i===variant?'active':''}">Variante ${i+1}</button>`).join('')}</div>
            <div class="crm2-msg" id="crmUrlVariantPreview">${crmWaBold(preview)}</div>
            <div class="crm-variant-actions crm2-variant-actions"><button type="button" class="secondary" id="crmCopyUrlVariant">${crmIco('doc',18)} Copiar variante</button><button type="button" class="wa-blue crm2-wa-blue" id="crmOpenUrlVariant">${crmIco('wa',19)} Abrir WhatsApp</button></div>
          </div>
        </section>
        <div class="crm-actions-grid crm2-actions"><button type="button" class="secondary" id="crmNewFicha">${crmIco('doc',18)} Ficha nueva</button><button type="button" class="secondary" id="crmAddService">${crmIco('plus',18)} Agregar otra cuenta</button><button type="button" class="secondary crm2-save" id="crmSubmit">${crmIco('save',18)} Guardar CRM</button><button type="button" class="secondary" id="crmCopyFicha">${crmIco('copy',18)} Copiar</button></div>
        <div class="crm-info crm2-note crm2-note-blue">${crmIco('link',22)}<span>Todas las plataformas de este cliente se reunirán en una sola URL permanente, aunque compre o renueve en fechas distintas.</span></div>
        <details class="crm2-ficha" id="crmFichaDetails" ${state.crmFichaOpen?'open':''}><summary>${crmIco('doc',17)} Ver / editar ficha de la cuenta</summary><label class="crm-field crm-ficha-preview"><span>Ficha para grupo WhatsApp / respaldo</span><textarea id="crmFichaTexto" rows="10" data-auto="${d.fichaTexto?'0':'1'}">${esc(ficha)}</textarea></label></details>
        <div class="crm-delivery-actions crm2-deliver"><button type="button" class="wa-green" id="crmDeliverTraditional">${crmIco('wa',20)} Entregar ficha de la cuenta</button><button type="button" class="wa-blue crm2-deliver-url" id="crmDeliverUrl">${crmIco('send',20)} Entregar ficha URL</button></div>
        <p class="crm2-foot">Ambas opciones guardan primero el CRM. Nada se envía automáticamente.</p>`)}
    </form>
    ${state.crmSheet==='catalog'?crmCatalogSheet(d):''}${state.crmSheet==='client'?crmClientSheet():''}`;
}

function syncCrmRequirementVisibility() {
  const select=document.querySelector('#crmPlataforma'); if(!select)return;
  const rules=crmRules(select.value);
  document.querySelectorAll('[data-crm-profile]').forEach(node=>{
    const field=(sel,show)=>{const input=node.querySelector(sel);const label=input?.closest('.crm-field');if(label)label.hidden=!show;};
    const device=node.querySelector('[data-p-device]')?.value||'';
    field('[data-p-email]',rules.email); field('[data-p-password]',rules.password); field('[data-p-pin]',rules.pin); field('[data-p-device]',rules.device); field('[data-p-roku]',rules.device&&device==='tv');
    const extra=node.querySelector('.crm2-profile-extra'); if(extra)extra.hidden=!(rules.pin||rules.device);
  });
  const tv=document.querySelector('#crmTvDigitalBox'); if(tv)tv.hidden=!crmIsTvDigital(select.value);
}

function crmSetPlatform(value) {
  const d=readCrmDraftFromDom();
  d.plataforma=value; d.tvDispositivos=String(crmAllowedDevices(value)[0]||1); d.mesesContratados=crmAllowedMonths(value)[0]||1;
  d.precio=String(crmDefaultPrice(crmStoredPlatform(value,d.tvDispositivos),d.vendedor)||''); d.fichaTexto='';
  state.crmDraft=d; state.crmSheet=''; render();
}

function crmApplyClient(match) {
  if(!match)return;
  const d=readCrmDraftFromDom();
  d.nombrePerfil=String(match.nombrePerfil||match.nombre||''); d.telefono=String(match.telefono||''); d.savedClientId=String(match.id||''); d.clienteId=String(match.id||'');
  const firstService=Array.isArray(match.servicios)?match.servicios[0]:null;
  if(firstService?.vendedor){d.vendedor=String(firstService.vendedor);const phone=sellerPhone(d.vendedor);if(phone)d.vendedorTelefono=phone;}
  d.perfiles=d.perfiles.map(p=>({...p,nombre:String(p.nombre||'').trim()||d.nombrePerfil}));
  d.fichaTexto=''; d.savedLink='';
  state.crmDraft=d; state.crmSheet=''; state.crmClientQuery='';
  showToast(`Cliente encontrado: ${d.nombrePerfil}. Datos precargados.`);
}

function renewalGroups(filter=state.renewFilter) {
  const sellerNorm=canonicalSeller(state.renewSeller||'');
  const rows=sellerNorm ? allRows().filter(r=>canonicalSeller(r.vendedor)===sellerNorm) : allRows();
  const groups=groupRenewalsByClientDate(rows);
  const base=new Date();base.setHours(12,0,0,0);
  const parsed=groups.map(g=>({g,d:parseDateDMY(g.fechaRenovacion)})).filter(x=>x.d);
  if(filter==='hoy')return parsed.filter(x=>Math.round((x.d-base)/86400000)===0).map(x=>x.g);
  if(filter==='vencidos')return parsed.filter(x=>x.d<base).sort((a,b)=>a.d-b.d).map(x=>x.g);
  const future=parsed.filter(x=>x.d>base).sort((a,b)=>a.d-b.d); if(!future.length)return[];
  const first=future[0].d.toDateString();return future.filter(x=>x.d.toDateString()===first).map(x=>x.g);
}

function renewalCounts() { return {hoy:renewalGroups('hoy').length,proximo:renewalGroups('proximo').length,vencidos:renewalGroups('vencidos').length}; }
function renewView() {
  const groups=renewalGroups();
  const long=d=>{const t=d.toLocaleDateString('es-HN',{weekday:'long',day:'numeric',month:'long'});return t.charAt(0).toUpperCase()+t.slice(1);};
  const first=groups[0]?parseDateDMY(groups[0].fechaRenovacion):null;
  const heading=state.renewFilter==='hoy'?long(new Date()):state.renewFilter==='vencidos'?'Vencidos':(first?long(first):'Próximo');
  const rows=groups.slice(0,120).map(g=>{const d=parseDateDMY(g.fechaRenovacion);return {key:g.key,day:d?d.getDate():'—',mon:d?d.toLocaleDateString('es-HN',{month:'short'}).replace('.','').toUpperCase():'',nombre:g.nombre,plataformas:g.servicios.map(x=>platformLabel(x.plataforma)||x.plataforma).join(' + '),nServicios:g.servicios.length,nTotal:g.serviciosCliente.length,total:money(g.total)};});
  return cobrosScreenHtml({counts:renewalCounts(),filter:state.renewFilter,seller:state.renewSeller,sellers:operationalFilterOptions(allRows()).sellers,groups:rows,heading,headingCount:groups.length});
}

function catalogView() {
  if (!cap().catalogo) return `<div class="empty-state page-empty">${icon('catalog',34)}<strong>Catálogo no disponible</strong><span>Su usuario conserva los mismos permisos de Sublichat.</span></div>`;
  if (!state.catalog && !state.errors.catalog) return `<div class="loading-card"><span class="spinner"></span><strong>Cargando catálogo…</strong></div>`;
  if (state.errors.catalog) return `<div class="error-box">${icon('alert',18)}<span>${esc(state.errors.catalog)}</span></div>`;
  const products=(state.catalog?.products || []).filter(p=>p.active!==false);
  return `<section class="page-head detail-head"><button class="back-btn close-btn" id="backMore" aria-label="Cerrar catálogo">${icon('close')}</button><div><p class="eyebrow">CATÁLOGO RELOJES</p><h1>Catálogo</h1><p class="muted">${products.length} productos activos</p></div></section>
    <section class="catalog-grid">${products.slice(0,100).map(product=>{
      const plans=Array.isArray(product.plans)?product.plans.filter(p=>p.active!==false):[];
      const price=plans.map(p=>Number(p.price)).filter(Number.isFinite).sort((a,b)=>a-b)[0];
      return `<article class="product-card">${product.imageUrl?`<img src="${esc(product.imageUrl)}" alt="">`:`<div class="product-icon">${icon('catalog',24)}</div>`}<div><strong>${esc(product.name||'Producto')}</strong><span>${esc(product.categoryId||'')}</span>${Number.isFinite(price)?`<b>${money(price)}</b>`:''}</div></article>`;
    }).join('')}</section>`;
}

function inventoryDecorated() {
  return (state.inventory||[]).map((raw,i)=>({raw,id:String(raw.id||raw.docId||`i${i}`),label:platformLabel(raw.plataforma)||'Cuenta',canon:platformCanon(raw.plataforma)}));
}
function inventoryView() {
  const all=inventoryDecorated();
  const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const q=norm(state.invQuery).trim();
  const map=new Map(); all.forEach(d=>{const e=map.get(d.canon)||{key:d.canon,label:d.label,count:0}; e.count+=1; map.set(d.canon,e);});
  const platforms=[...map.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'es'));
  let list=all.filter(d=>(!state.invPlat||d.canon===state.invPlat)&&(!q||norm(`${d.label} ${d.raw.correo} ${d.raw.plataforma}`).includes(q))&&(!state.invCupo||(state.invCupo==='libres'?inventoryStats(d.raw).free>0:inventoryStats(d.raw).free===0)));
  const by={libres:(a,b)=>inventoryStats(b.raw).free-inventoryStats(a.raw).free,correo:(a,b)=>String(a.raw.correo||'').localeCompare(String(b.raw.correo||''),'es'),plataforma:(a,b)=>a.label.localeCompare(b.label,'es')||String(a.raw.correo||'').localeCompare(String(b.raw.correo||''),'es'),recientes:(a,b)=>String(b.raw.updatedAt||'').localeCompare(String(a.raw.updatedAt||''))};
  list=list.slice().sort(by[state.invSort]||by.recientes);
  const items=list.slice(0,200);
  return inventoryScreenHtml({platforms,total:all.length,plat:state.invPlat,query:state.invQuery,sort:state.invSort,cupo:state.invCupo,filtersOpen:state.invFiltersOpen,items,shown:items.length,all:list.length});
}
async function copyText(text,okMsg='Copiado.') { try { await navigator.clipboard.writeText(String(text||'')); showToast(okMsg); } catch(_) { showToast('No se pudo copiar.'); } }
function openInventoryDetail(id) {
  const d=inventoryDecorated().find(x=>x.id===String(id)); if(!d) return;
  const host=openSheet(inventoryDetailHtml({item:d.raw,label:d.label}));
  host.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',()=>copyText(b.dataset.copy)));
  host.querySelector('[data-copy-all]')?.addEventListener('click',()=>copyText(inventoryCopyText({item:d.raw,label:d.label}),'Datos copiados.'));
}

function ticketRecipientRows() {
  const own=String(state.session?.usuario||'sublicuentas').toLowerCase();
  const base=[{key:'sublicuentas',label:'Sublicuentas'},{key:'relojes',label:'Relojes'},{key:'geisell',label:'Geisell'},{key:'magdiel',label:'Magdiel'}];
  for(const r of state.ticketRecipients||[]){const key=String(r.key||'').toLowerCase();if(key&&!base.some(x=>x.key===key))base.push({key,label:r.label||r.key});}
  return base.filter(x=>x.key!==own);
}
function ticketPhotoPicker(kind,value){return `<div class="ticket-photo"><input type="file" accept="image/jpeg,image/png,image/webp" data-ticket-photo="${kind}" hidden><button type="button" class="secondary" data-ticket-photo-open="${kind}">📷 ${value?'Cambiar foto':'Adjuntar foto / evidencia'}</button>${value?`<span>✓ Imagen preparada <button type="button" class="text-danger" data-ticket-photo-remove="${kind}">Quitar</button></span>`:''}</div>`;}
// "Sublicuentas · Sublichat → Sublicuentas": quién responde (por su rol, no por el usuario "naara") y a quién va:
// la respuesta desde la app va a quien respondió por Telegram.
function ticketMsgWho(m,thread,index){
  const tg=m.origen==='telegram';
  const who=tg?(m.por||telegramRoleLabel(m.porRol)):(m.porRol?telegramRoleLabel(m.porRol):(m.por||m.autor||m.usuario||'Respuesta'));
  let para='';
  if(!tg){
    para=m.paraLabel||'';
    if(!para){const prev=[...thread.slice(0,index)].reverse().find(x=>x?.origen==='telegram'&&x?.porRol);if(prev)para=telegramRoleLabel(prev.porRol);}
  }
  return `${who} · ${tg?'Telegram':'Sublichat'}${para?` → ${para}`:''}`;
}
function ticketTime(iso){const d=new Date(iso);return Number.isNaN(d.getTime())?'':d.toLocaleString('es-HN',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'});}
function ticketCard(t){const id=esc(t.id||t._id||'');const estado=String(t.estado||'abierto').toLowerCase(),done=['resuelto','finalizado'].includes(estado);const thread=Array.isArray(t.respuestas)?t.respuestas:[];const threadOpen=Boolean(state.ticketThreadOpen[String(t.id||t._id||'')]);const threadBlock=thread.length?`<button type="button" class="tk-thread-toggle" data-tk-thread="${id}">💬 ${thread.length} respuesta${thread.length===1?'':'s'} · ${threadOpen?'Ocultar':'Ver historial'}</button>${threadOpen?`<div class="tk-thread">${thread.map((m,mi)=>`<div class="ticket-message ${m.origen==='telegram'?'from-telegram':''}"><b>${esc(ticketMsgWho(m,thread,mi))}</b><span>${esc(m.texto||m.respuesta||'')}</span>${m.at?`<small>${esc(ticketTime(m.at))}</small>`:''}${m.imagenUrl?`<img class="ticket-evidence" src="${esc(m.imagenUrl)}" alt="Adjunto">`:''}</div>`).join('')}</div>`:''}`:'';const tgKnown=t.telegramOk===true||t.telegramOk===false;const tgDelivered=telegramDelivered(t.telegramInfo);const tgStatus=t.telegramOk===true?`<div class="ticket-telegram ok">✓ Telegram${tgDelivered.length?` · llegó a ${esc(tgDelivered.join(', '))}`:' enviado'}</div>`:t.telegramOk===false?`<div class="ticket-telegram pending">⚠ Telegram ${t.telegramInfo?.partial?'llegó parcialmente':'no enviado'}: ${esc(telegramSummary(t.telegramInfo))} <button type="button" class="secondary mini" data-ticket-retry-telegram="${id}">Reintentar Telegram</button></div>`:'';return `<article class="ticket-full-card"><div class="ticket-head"><div><b>#${esc(t.numero||'—')} · ${esc(t.titulo||'Ticket')}</b><small>${esc(estado)} · ${esc(ticketActorLabel(t))}</small></div><span>${esc(t.prioridad||'normal')}</span><button type="button" class="tk-delete" data-ticket-delete="${id}" aria-label="Eliminar aviso" title="Eliminar aviso">🗑️</button></div><p>${esc(t.detalle||'')}</p>${tgKnown?tgStatus:''}${t.imagenUrl?`<img class="ticket-evidence" src="${esc(t.imagenUrl)}" alt="Evidencia">`:''}${threadBlock}${!done?`<div class="ticket-actions"><button class="secondary mini" data-ticket-process="${id}">En proceso</button><button class="secondary mini" data-ticket-reply="${id}">Responder</button><button class="primary mini" data-ticket-resolve="${id}">Finalizar</button></div>`:''}${state.ticketReplyFor===String(t.id||t._id||'')?`<div class="ticket-reply"><textarea id="ticketReplyText" placeholder="Escriba la respuesta…">${esc(state.ticketReplyText||'')}</textarea>${ticketPhotoPicker('reply',state.ticketReplyImage)}<button class="primary" data-ticket-send="${id}">Enviar respuesta</button></div>`:''}</article>`;}
function captureTicketDraft(e) {
  const map={ticketTitle:'title',ticketDetail:'detail',ticketDest:'dest',ticketPriority:'priority',ticketNoticeTitle:'ntitle',ticketNoticeDetail:'ndetail'};
  const k=map[e.target?.id]; if(!k) return;
  state.ticketDraft={...state.ticketDraft,[k]:e.target.value};
  const c=document.querySelector(`[data-count-for="${e.target.id}"]`); if(c) c.textContent=`${e.target.value.length}/500`;
}
document.addEventListener('input',captureTicketDraft); document.addEventListener('change',captureTicketDraft);
function ticketsView() {
  if (!state.tickets && !state.errors.tickets) return subPage('Tickets y avisos','Gestión completa','<div class="loading-card"><span class="spinner"></span><strong>Cargando tickets…</strong></div>');
  if(state.errors.tickets)return subPage('Tickets y avisos','Gestión completa',`<div class="error-box">${icon('alert',18)}<span>${esc(state.errors.tickets)}</span></div><button class="primary" id="ticketsRetry" type="button">Reintentar</button>`);
  const items=state.tickets||[], recipients=ticketRecipientRows(), d=state.ticketDraft||{};
  const selected=new Set(state.ticketNoticeMode==='all'?recipients.map(r=>r.key):state.ticketNoticeDestinos);
  const noticeFormHtml=`<div class="tk-form"><input id="ticketNoticeTitle" placeholder="Título del aviso" value="${esc(d.ntitle||'')}"><label class="tk-area"><textarea id="ticketNoticeDetail" maxlength="500" placeholder="Contenido del aviso">${esc(d.ndetail||'')}</textarea><small class="tk-count" data-count-for="ticketNoticeDetail">${(d.ndetail||'').length}/500</small></label><p class="tk-label">Destinatarios</p><div class="ticket-mode"><button type="button" class="${state.ticketNoticeMode==='all'?'active':''}" data-ticket-mode="all">Todos</button><button type="button" class="${state.ticketNoticeMode==='custom'?'active':''}" data-ticket-mode="custom">Personalizar</button></div>${state.ticketNoticeMode==='custom'?`<div class="ticket-recipients">${recipients.map(r=>`<label><input type="checkbox" data-ticket-dest="${esc(r.key)}" ${selected.has(r.key)?'checked':''}> ${esc(r.label)}</label>`).join('')}</div>`:''}${ticketPhotoPicker('notice',state.ticketNoticeImage)}<button class="primary" id="ticketSendNotice">Enviar aviso</button></div>`;
  const ticketFormHtml=`<div class="tk-form"><input id="ticketTitle" placeholder="Asunto / título" value="${esc(d.title||'')}"><div class="ticket-form-row"><select id="ticketDest">${recipients.map(r=>`<option value="${esc(r.key)}" ${d.dest===r.key?'selected':''}>Para ${esc(r.label)}</option>`).join('')}</select><select id="ticketPriority">${[['normal','Normal'],['alta','Alta'],['urgente','Urgente']].map(([v,l])=>`<option value="${v}" ${d.priority===v?'selected':''}>${l}</option>`).join('')}</select></div><label class="tk-area"><textarea id="ticketDetail" maxlength="500" placeholder="Detalle del ticket">${esc(d.detail||'')}</textarea><small class="tk-count" data-count-for="ticketDetail">${(d.detail||'').length}/500</small></label>${ticketPhotoPicker('ticket',state.ticketImage)}<button class="primary" id="ticketCreate">Enviar ticket</button></div>`;
  const tab=state.ticketsTab==='tickets'?'tickets':'avisos';
  const pool=items.filter(t=>tab==='avisos'?isAviso(t):!isAviso(t));
  const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const q=norm(state.ticketQuery).trim(), st=state.ticketStatusFilter, searching=Boolean(q||st);
  const stateOf=t=>String(t.estado||'abierto').toLowerCase();
  const match=t=>(!q||norm(`${t.numero} ${t.titulo} ${t.detalle} ${ticketActorLabel(t)}`).includes(q))&&(!st||stateOf(t)===st||(st==='resuelto'&&stateOf(t)==='finalizado'));
  const visible=(searching?pool.filter(match):pool.filter(ticketNeedsAttention)).slice(0,100);
  const history=searching?[]:pool.filter(t=>!ticketNeedsAttention(t)).slice(0,100);
  const rowHtml=t=>{const id=String(t.id||t._id||'');return ticketRowHtml(t,{expanded:Boolean(state.ticketExpanded[id])||state.ticketReplyFor===id,cardHtml:ticketCard(t),when:ticketTime(t.createdAt),actor:ticketActorLabel(t)});};
  return ticketsScreenHtml({tab,counts:{history:pool.filter(t=>!ticketNeedsAttention(t)).length},noticeFormHtml,ticketFormHtml,visible,history,query:state.ticketQuery,filter:st,filtersOpen:state.ticketFiltersOpen,historyOpen:state.ticketHistoryOpen,rowHtml,searching});
}
function controlMasterView() {
  if (!state.controlInventory && !state.errors.controlMaster) return subPage('Control Maestro','Cuentas y asignaciones','<div class="loading-card"><span class="spinner"></span><strong>Cargando cuentas…</strong></div>');
  if (state.errors.controlMaster) return subPage('Control Maestro','Cuentas y asignaciones',`<div class="error-box">${icon('alert',18)}<span>${esc(state.errors.controlMaster)}</span></div>`);
  const rows=(state.controlInventory || []).slice().sort((a,b)=>String(a.plataforma||'').localeCompare(String(b.plataforma||'')) || String(a.correo||'').localeCompare(String(b.correo||'')));
  const total=rows.length;
  const libres=rows.reduce((sum,item)=>sum+Math.max(0,Number(item.disponibles||0)),0);
  const ocupados=rows.reduce((sum,item)=>sum+Math.max(0,Number(item.ocupados ?? (Array.isArray(item.clientes)?item.clientes.length:0))),0);
  const content=`<section class="finance-grid control-summary"><article><span>Cuentas</span><strong>${total}</strong></article><article><span>Libres</span><strong>${libres}</strong></article><article class="wide"><span>Asignaciones</span><strong>${ocupados}</strong></article></section>
    <section class="list-stack control-list">${rows.slice(0,180).map(item=>{
      const clients=Array.isArray(item.clientes)?item.clientes:[];
      const used=Number(item.ocupados ?? clients.length) || 0;
      const capacity=Number(item.capacidad || (used + Number(item.disponibles||0))) || 0;
      return `<article class="inventory-row control-row"><div class="grow"><strong>${esc(platformLabel(item.plataforma)||'Cuenta')}</strong><span>${esc(item.correo||'Sin correo')}</span><small>${used}/${capacity || '—'} ocupados · ${clients.length} asignados</small></div><div class="stock"><b>${Math.max(0,Number(item.disponibles||0))}</b><small>libres</small></div></article>`;
    }).join('') || '<div class="empty-state"><strong>Sin cuentas</strong><span>No hay cuentas disponibles en Control Maestro.</span></div>'}</section>`;
  return subPage('Control Maestro','Cuentas y asignaciones',content);
}

function calcBase() { return remoteBaseCatalog(state.remoteConfig?.calculatorBasePrices); }
function calculatorView() { return calcScreenHtml({st:state.calc,catalog:effectiveCatalog(state.calcPrices,calcBase())}); }
function rafflesView() {
  return sorteosScreenHtml({data:state.raffles,tab:state.rafflesTab,status:state.raffleStatus,busy:state.raffleBusy,error:state.errors.raffles});
}

function profileView() {
  const p=state.profile || {};
  const commercial=roleLabel(state.session?.role, state.session?.usuario);
  const editing=state.profileEditing;
  const avatar=state.profileAvatarDraft || p.avatar || '';
  const avatarView=avatar?`<img src="${esc(avatar)}" class="avatar-img" alt="Perfil">`:avatarMarkup();
  const editBlock=editing?`<section class="panel profile-edit-panel"><h3>Editar perfil</h3><p class="muted">Los cambios se guardan en el mismo perfil de Sublichat web.</p><label class="crm-field"><span>Nombre visible</span><input id="profileName" value="${esc(p.nombre||commercial)}" maxlength="80"></label><label class="crm-field"><span>Teléfono</span><input id="profilePhone" value="${esc(p.telefono||'')}" inputmode="tel" maxlength="40"></label><label class="crm-field"><span>Foto de perfil</span><input id="profileAvatar" type="file" accept="image/*"></label><div class="profile-avatar-preview">${avatarView}</div><div class="profile-edit-actions"><button class="secondary" id="cancelProfileEdit">Cancelar</button><button class="primary" id="saveProfileBtn">Guardar perfil</button></div></section>`:'';
  return subPage('Perfil','Cuenta y preferencias', `<section class="profile-card"><div class="profile-avatar-large">${avatarMarkup()}</div><h2>${esc(p.nombre || commercial)}</h2><p>${esc(commercial)}</p>${p.telefono?`<span>${esc(p.telefono)}</span>`:''}<button class="secondary" id="editProfileBtn">Editar perfil</button></section>${editBlock}
    <section class="panel settings-panel"><label class="theme-row"><span><strong>Tema</strong><small>Claro por defecto</small></span><select id="themeSelect"><option value="light">Claro</option><option value="dark">Oscuro</option><option value="system">Predeterminado del sistema</option></select></label><div class="setting-line"><span><strong>App de WhatsApp</strong><small>${localStorage.getItem('sublicuentas-whatsapp-app')==='com.whatsapp.w4b'?'WhatsApp Business':localStorage.getItem('sublicuentas-whatsapp-app')==='com.whatsapp'?'WhatsApp normal':'Se preguntará la próxima vez'}</small></span><button type="button" class="secondary mini" id="whatsappAppReset">Cambiar</button></div><div class="setting-line"><span><strong>Versión</strong><small>Android interno</small></span><b>1.0 · build ${esc(BUILD_NUMBER)}</b></div><div class="setting-line"><span><strong>Paquete</strong><small>Identidad Android</small></span><b>com.sublicuentas.app</b></div></section>
    <button class="danger-button" id="logoutBtn">${icon('logout',20)} Cerrar sesión</button>`);
}

function financeParsed() {
  if (state.finParsedFor!==state.finances) { state.finParsed=parseAllFinance(state.finances); state.finParsedFor=state.finances; }
  return state.finParsed;
}
function financeView() {
  return subPage('Control financiero','Ingresos, egresos, bancos y Excel',financeContentHtml({
    movs:financeParsed(),period:state.finPeriod,desde:state.finDesde,hasta:state.finHasta,tipo:state.finTipo,shown:state.finShown,
    busy:state.finBusy,today:new Date(),canWrite:Boolean(cap().finanzas),errorText:state.errors.finances||'',cierreMes:cierreDelMes(allRows(),new Date()),
  }));
}

async function exportFinanceExcel(scope) {
  if (state.finBusy) return;
  const all=financeParsed();
  const range=periodRange(state.finPeriod,new Date(),{desde:state.finDesde,hasta:state.finHasta});
  const list=scope==='todo'?all:filterMovs(all,{desde:range.desde,hasta:range.hasta});
  if (!list.length) { showToast('No hay movimientos para exportar.'); return; }
  state.finBusy=true; render();
  try {
    const mod=await import('exceljs/dist/exceljs.min.js'); const ExcelJS=mod.default||mod;
    const wb=buildFinanceWorkbook(ExcelJS,list,{label:scope==='todo'?'Todo':range.label,now:new Date(),cierre:cierreDelMes(allRows(),new Date())});
    const buffer=await wb.xlsx.writeBuffer();
    const out=await saveAndShareXlsx(financeFileName(scope,new Date()),buffer);
    showToast(out.mode==='native'?'📊 Excel listo: elija dónde guardarlo o enviarlo.':'📊 Excel descargado.');
  } catch (e) { showToast(e?.message||'No se pudo generar el Excel.'); }
  state.finBusy=false; render();
}

function subPage(title, subtitle, content) {
  return `<section class="page-head detail-head"><button class="back-btn" id="backMore">${icon('back')}</button><div><p class="eyebrow">SUBLICUENTAS</p><h1>${esc(title)}</h1><p class="muted">${esc(subtitle)}</p></div></section>${content}`;
}

const JG_TIME_LIMIT={WORD_SEARCH:360000,HANGMAN:360000,MEMORY_PAIRS:360000,BASKETBALL:360000,DARTS:3600,COLOR_CHALLENGE:300};
function juegosView() {
  const j=state.juegos;
  if (j.screen==='ranking') { const rk=juegosRankKey(j.rankingScope); return leaderboardHtml({scope:j.rankingScope,data:j.ranking[rk]||null,loading:j.rankingLoading,error:j.rankingError,me:state.session?.usuario||'',myTotals:j.resumen,meLabel:juegosMeLabel(),avatar:state.profile?.avatar||'',gameCode:j.rankGame||'MEMORY_PAIRS'}); }
  if (j.screen==='game' && (j.engine || j.gameCode==='BASKETBALL')) {
    if (j.gameCode==='BASKETBALL' && (j.bqStage==='select'||!j.engine)) return basketSelectHtml({selectedId:j.bqChar||'boy_2'});
    const finished=Boolean(j.engine.finishedAt)||j.timeUp;
    const timeLeftSec=Math.max(0,Math.ceil((j.deadlineAt-Date.now())/1000));
    if (j.gameCode==='MEMORY_PAIRS') return memoriaScreenHtml({game:j.engine,message:j.memMsg||'',saving:j.result?.status==='loading'});
    if (j.gameCode==='HANGMAN') return hangmanProScreenHtml({game:j.engine,flash:j.hgFlash||'',saving:j.result?.status==='loading'});
    if (j.gameCode==='WORD_SEARCH') return sopaScreenHtml({round:j.engine,totalSP:j.resumen?.totalPoints||0,levelMenu:j.sopaMenu===true,message:j.sopaMsg||'',saving:j.result?.status==='loading'});
    if (j.gameCode==='BASKETBALL') return j.bqStage==='select'||!j.engine ? basketSelectHtml({selectedId:j.bqChar||'boy_2'}) : basketPlayHtml({game:j.engine,flying:!!j.bqFlying,hoopX:j.bqFlying?j.engine.lastShot?.hoopX:undefined,saving:j.result?.status==='loading'});
    if (j.gameCode==='DARTS') return dartsProScreenHtml({game:j.engine,totalSP:j.resumen?.totalPoints||0,message:j.dartsMsg||''});
    if (j.gameCode==='COLOR_CHALLENGE') return colorScreenHtml({state:j.engine,timeLeftSec,finished});
  }
  return juegosHubHtml({resumen:j.resumen,error:j.resumenError});
}
async function ensureJuegosResumen(force=false) {
  const j=state.juegos; if (j.resumen && !force) return;
  try { const r=await juegosResumen(); j.resumen={totalPoints:r.totalPoints||0,byGame:r.byGame||{},streak:r.streak||{current:0,best:0},badge:r.badge||{code:'EXPLORADOR',name:'Explorador'}}; j.resumenError=''; }
  catch(e){ if(!j.resumen) j.resumenError=e?.message||'No se pudo cargar tus puntos.'; }
  render();
}
function juegosStart(code) {
  const j=state.juegos; const limit=JG_TIME_LIMIT[code]||120;
  j.gameCode=code; j.timeLimitSec=limit; j.deadlineAt=Date.now()+limit*1000; j.timeUp=false; j.paused=false; j.screen='game'; j.result=null;
  j.engine = code==='MEMORY_PAIRS' ? memoryCreate(12) : code==='HANGMAN' ? hangmanCreate(5,7,2) : code==='BASKETBALL' ? basketballCreate(5) : code==='DARTS' ? dartsGameCreate({userId:state.session?.usuario||'yo',displayName:juegosMeLabel()}) : code==='COLOR_CHALLENGE' ? colorCreate(j.colorDesign=(Number(j.colorDesign)||0)) : wordSearchCreate(12, Math.floor(Math.random()*WORDSEARCH_SETS.length));
  try{window.scrollTo(0,0);}catch(_){}
  if (code==='BASKETBALL') { const u=state.session?.usuario||'yo'; j.bqChar=bqGetCharacter(u); j.bqFlying=false; const saved=bqLoad(u);
    if(saved&&(saved.status==='PLAYING'||(saved.status==='FINISHED'&&!saved.submitted))){ j.engine=saved.status==='PLAYING'?{...saved,paused:false,resumedAt:Date.now(),lastShot:saved.lastShot?{...saved.lastShot,path:[]}:null}:saved; j.bqStage='play'; if(saved.status==='FINISHED')setTimeout(()=>{if(state.juegos.engine===j.engine)juegosFinish();},300); }
    else { j.engine=null; j.bqStage='select'; }
    if(!j.resumen)ensureJuegosResumen(); }
  if (code==='HANGMAN') { j.engine=hgOpenGame(); j.hgFlash=''; if(!j.resumen)ensureJuegosResumen(); if(j.engine.status==='COMPLETED'&&!j.engine.submitted)setTimeout(()=>{if(state.juegos.engine===j.engine)juegosFinish();},300); }
  if (code==='MEMORY_PAIRS') { const u=state.session?.usuario||'yo'; j.engine=createMemoryGame(j.memMode||'EASY',{userId:u,lastAssetIds:memoryLastAssets(u)}); memorySaveLastAssets(u,j.engine); j.memMsg=''; if(!j.resumen)ensureJuegosResumen(); }
  if (code==='WORD_SEARCH') { j.engine=sopaOpenRound(); j.sopaMenu=false; j.sopaMsg=''; if(!j.resumen)ensureJuegosResumen(); if(j.engine.status==='completed'&&!j.engine.submitted)setTimeout(()=>{if(state.juegos.engine===j.engine)juegosFinish();},300); }
  render();
}
// Sopa de Letras PRO: la ronda se guarda en el teléfono y se reanuda (sin contar el tiempo con la app cerrada).
const sopaUser=()=>state.session?.usuario||'yo';
function sopaOpenRound(levelId) {
  const saved=levelId?null:sopaLoad(sopaUser());
  if (saved && (saved.status==='playing'||saved.status==='paused'||(saved.status==='completed'&&!saved.submitted))) {
    let r=saved; if (r.status==='playing') r={...r,elapsedMs:Number(r._elapsedAtSave??r.elapsedMs)||0,status:'paused'};
    if (r.status==='paused') r=sopaResume(r);
    sopaPersist(r); return r;
  }
  const r=sopaCreate(levelId||state.juegos.sopaLevel||'atencion'); sopaPersist(r); return r;
}
function sopaPersist(r) { if(!r)return; sopaSave(sopaUser(), {...r,_elapsedAtSave:sopaElapsed(r)}); }
// Ahorcado PRO: partida guardada en el teléfono; al reabrir se reanuda sin contar el tiempo con la app cerrada.
const hgUser=()=>state.session?.usuario||'yo';
function hgPersist(g){ if(g)hangSave(hgUser(),{...g,playedMs:hangPlayedMs(g),resumedAt:g.status==='PLAYING'&&!g.paused?Date.now():null}); }
function hgOpenGame(){
  const saved=hangLoad(hgUser());
  if(saved&&(saved.status==='PLAYING'||(saved.status==='COMPLETED'&&!saved.submitted))){ const g=saved.status==='PLAYING'?{...saved,paused:false,resumedAt:Date.now()}:saved; hgPersist(g); return g; }
  const g=hangmanNewGame({userId:hgUser(),recentIds:hangRecent(hgUser())}); hangRememberWords(hgUser(),g); hgPersist(g); return g;
}
function hgUpdate(g){ const j=state.juegos; j.engine=g; hgPersist(g); render(); if(g.status==='COMPLETED'&&!g.submitted&&!j.result)setTimeout(()=>{if(state.juegos.engine===g)juegosFinish();},350); }
// Básquet PRO: guardado local y vuelo de la pelota animado sobre la trayectoria simulada.
const bqUser=()=>state.session?.usuario||'yo';
function bqPersist(g){ if(g)bqSave(bqUser(),{...g,playedMs:bqPlayedMs(g),resumedAt:g.status==='PLAYING'&&!g.paused?Date.now():null}); }
function bqUpdate(g){ const j=state.juegos; j.engine=g; bqPersist(g); render(); if(g.status==='FINISHED'&&!g.submitted&&!j.result&&!j.bqFlying)setTimeout(()=>{if(state.juegos.engine===g)juegosFinish();},500); }
function bqShoot(){
  const j=state.juegos; const before=j.engine; if(!before||before.status!=='PLAYING'||before.paused||j.bqFlying)return;
  const g=resolveCurrentShot(before); j.engine=g; j.bqFlying=true; bqPersist(g); render();
  const ball=document.getElementById('bqBallG'), path=g.lastShot?.path||[];
  let finished=false;
  const done=()=>{ if(finished)return; finished=true; j.bqFlying=false; j.bqSlideFrom=g.lastShot.hoopX; render(); try{ if(g.lastShot.scored)navigator.vibrate?.(g.lastShot.swish?[30,40,30]:30); }catch(_){} if(g.status==='FINISHED'&&!g.submitted)setTimeout(()=>{if(state.juegos.engine===g)juegosFinish();},700); };
  if(!ball||path.length<2||typeof requestAnimationFrame!=='function'){ done(); return; }
  // R68: el reloj del cuadro (rAF) puede ser un poco ANTERIOR a t0 en Android → k negativo → path[-1] reventaba
  // y se quedaba en "Lanzando…". Ahora se usa el mismo reloj, se limita k a [0,1] y hay un seguro que siempre termina.
  const dur=Math.min(1300,Math.max(700,path.length*14)), t0=Date.now();
  const safety=setTimeout(done,dur+900);
  const step=()=>{ try{ const k=Math.max(0,Math.min(1,(Date.now()-t0)/dur)), f=k*(path.length-1), i=Math.max(0,Math.min(path.length-1,Math.floor(f))), r=f-i; const a=path[i], b=path[Math.min(path.length-1,i+1)]; const el=document.getElementById('bqBallG')||ball; el.setAttribute('transform',`translate(${(a[0]+(b[0]-a[0])*r).toFixed(1)} ${(a[1]+(b[1]-a[1])*r).toFixed(1)}) rotate(${Math.round(k*540)})`); if(k<1&&!finished)requestAnimationFrame(step); else { clearTimeout(safety); setTimeout(done,180); } }catch(_){ clearTimeout(safety); done(); } };
  requestAnimationFrame(step);
}
function juegosTick() {
  const j=state.juegos; if (j.screen!=='game' || !j.engine || j.paused || j.result) return;
  if (j.gameCode==='BASKETBALL') { const e=j.engine; if(!e||j.bqStage!=='play'||e.status!=='PLAYING'||e.paused||j.bqFlying)return; const rem=bqRemainingMs(e); const t=document.getElementById('bqTimer'); if(t){const x=Math.ceil(rem/1000);t.textContent=`${String(Math.floor(x/60)).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`;t.classList.toggle('low',rem<=15000);} const nx=bqTimeUp(e); if(nx!==e)bqUpdate(nx); else if(Date.now()-(j._bqSavedAt||0)>5000){j._bqSavedAt=Date.now();bqPersist(e);} return; }
  if (j.gameCode==='HANGMAN') { const e=j.engine; if(e.status!=='PLAYING'||e.paused)return; const t=document.getElementById('hgTimer'); const rem=hangRemainingMs(e); if(t){const x=Math.ceil(rem/1000);t.textContent=`${String(Math.floor(x/60)).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`;t.classList.toggle('low',rem<=30000);} const nx=hgTimeUp(e); if(nx!==e)hgUpdate(nx); else if(Date.now()-(j._hgSavedAt||0)>5000){j._hgSavedAt=Date.now();hgPersist(e);} return; }
  if (j.gameCode==='MEMORY_PAIRS') { const e=j.engine; if(e.status!=='PLAYING')return; const rem=memoryRemainingMs(e); const t=document.getElementById('mcTimer'); if(t){const x=Math.ceil(rem/1000);t.textContent=`${String(Math.floor(x/60)).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`;} const bar=document.getElementById('mcBar'); if(bar)bar.style.width=`${Math.round(rem/(e.secondsInitial*1000)*100)}%`; const nx=memTimeout(e); if(nx!==e){j.engine=nx;j.memMsg='';render();setTimeout(()=>{if(state.juegos.engine===nx)juegosFinish();},300);} return; }
  if (j.gameCode==='DARTS') { const e=j.engine; if(e.status!=='PLAYING')return; const left=dartsTimeLeft(e); const el=document.getElementById('dtTimer'); if(el){el.textContent=sopaFmt(left);el.parentElement?.classList.toggle('low',left<=20000);} if(left<=0){j.engine=dartsTimeUp(e);j.dartsMsg='';render();} return; }
  if (j.gameCode==='WORD_SEARCH') { const el=document.getElementById('sopaTimer'); if(el)el.textContent=sopaFmt(sopaElapsed(j.engine)); if(j.engine.hintCell&&j.engine.hintUntil&&Date.now()>j.engine.hintUntil){j.engine={...j.engine,hintUntil:0};render();} if(j.engine.status==='playing'&&Date.now()-(j._sopaSavedAt||0)>5000){j._sopaSavedAt=Date.now();sopaPersist(j.engine);} return; }
  const left=Math.max(0,Math.ceil((j.deadlineAt-Date.now())/1000));
  if (left<=0 && !j.timeUp) { j.timeUp=true; render(); return; } // transición única: sí conviene un render completo (bloquea el tablero)
  const el=document.getElementById('jgTimer'); if (el) el.textContent=fmtClock(left); // cada segundo normal: solo el número, nunca toda la pantalla (evita el parpadeo)
}
async function juegosFinish() {
  const j=state.juegos; if (!j.engine || j.result) return;
  const sub = j.gameCode==='MEMORY_PAIRS'?memSubmission(j.engine):j.gameCode==='HANGMAN'?hangmanProSubmission(j.engine):j.gameCode==='BASKETBALL'?basketProSubmission(j.engine):j.gameCode==='DARTS'?dartsGameSubmission(j.engine):j.gameCode==='COLOR_CHALLENGE'?colorSubmission(j.engine,j.timeLimitSec):sopaSubmission(j.engine);
  j.result={status:'loading'};
  const host=openSheet(resultSheetHtml(j.result));
  try {
    const r=await juegosRegistrar(j.gameCode, j.gameCode==='WORD_SEARCH'?j.engine.roundId:(j.gameCode==='MEMORY_PAIRS'||j.gameCode==='HANGMAN'||j.gameCode==='BASKETBALL')?j.engine.gameId:genRoundId(), sub); // Sopa: mismo roundId en reintentos = nunca acredita dos veces
    if (j.gameCode==='MEMORY_PAIRS') j.engine={...j.engine,submitted:true};
    if (j.gameCode==='HANGMAN') { j.engine={...j.engine,submitted:true}; hgPersist(j.engine); }
    if (j.gameCode==='BASKETBALL') { j.engine={...j.engine,submitted:true}; bqClear(bqUser()); }
    if (j.gameCode==='WORD_SEARCH') { j.engine={...j.engine,submitted:true,submitResult:{awardedPoints:r.awardedPoints||0,totalPoints:r.totalPoints||0}}; sopaPersist(j.engine); }
    j.result={status:'done',awardedPoints:r.awardedPoints||0,totalPoints:r.totalPoints||0,streak:r.streak,badge:r.badge,repetido:Boolean(r.repetido)};
    j.resumen={totalPoints:r.totalPoints||0,byGame:{...(j.resumen?.byGame||{}),[j.gameCode]:(j.resumen?.byGame?.[j.gameCode]||0)+(r.repetido?0:(r.awardedPoints||0))},streak:r.streak||j.resumen?.streak,badge:r.badge||j.resumen?.badge};
  } catch(e) { const msg=String(e?.message||''); const unknown=['BASKETBALL','DARTS','COLOR_CHALLENGE'].includes(j.gameCode)&&/(juego|game|c[oó]digo|code|inv[aá]lid|desconocid|no soportad|unsupported)/i.test(msg); j.result={status:'error',error:unknown?'El servidor aún no tiene activado este juego para sumar puntos oficiales (falta actualizar api/juegos.js en Vercel). Su partida no se perdió de la pantalla, pero no sumó puntos.':(msg||'No se pudo guardar. Revise su conexión.')}; }
  if (document.body.contains(host)) host.querySelector('.sr-sheet').innerHTML=resultSheetHtml(j.result);
  document.querySelectorAll('[data-sr-cancel]').forEach(b=>b.addEventListener('click',()=>{ closeSheet(); if(j.result?.status==='done'&&(j.gameCode==='WORD_SEARCH'||j.gameCode==='MEMORY_PAIRS'||j.gameCode==='HANGMAN'||j.gameCode==='BASKETBALL')){ j.result=null; render(); } else if(j.result?.status==='done') juegosQuit(); else if(j.result?.status==='error'){ j.result=null; render(); } }));
}
// Mira de Dardos: se mueve con requestAnimationFrame tocando SOLO su transform (sin redibujar la pantalla).
let jgDartsRaf=0;
function jgDartsLoop() {
  if (typeof requestAnimationFrame!=='function') return;
  cancelAnimationFrame(jgDartsRaf);
  const j=state.juegos; if (j.screen!=='game'||j.gameCode!=='DARTS'||!j.engine||j.engine.finishedAt) return;
  const step=()=>{const el=document.getElementById('jgAim');const jj=state.juegos;if(!el||jj.gameCode!=='DARTS'||!jj.engine||jj.engine.finishedAt)return;if(!jj.paused&&!jj.timeUp){const p=dartsAimAt(jj.engine,Date.now()-jj.engine.startedAt);el.setAttribute('transform',`translate(${(p.x*100).toFixed(1)} ${(p.y*100).toFixed(1)})`);}jgDartsRaf=requestAnimationFrame(step);};
  jgDartsRaf=requestAnimationFrame(step);
}
function juegosQuit() { const j=state.juegos; j.screen='ranking'; j.ranking={}; j.engine=null; j.gameCode=null; j.result=null; render(); }
function juegosRankKey(scope) { return scope==='porJuego'?`porJuego:${state.juegos.rankGame||'MEMORY_PAIRS'}`:scope; }
function juegosMeLabel() { return sellerForSession(state.session?.role||'',state.session?.usuario||'') || 'Mi acceso'; }
async function juegosLoadRanking(scope, force=false) {
  const j=state.juegos; j.rankingScope=scope; const key=juegosRankKey(scope); if (j.ranking[key] && !force) { render(); return; }
  j.rankingLoading=true; j.rankingError=''; render();
  try { const extra=scope==='porJuego'?{gameCode:j.rankGame||'MEMORY_PAIRS'}:{}; j.ranking={...j.ranking,[key]:await juegosRanking(scope,extra)}; }
  catch(e){ j.rankingError=e?.message||'No se pudo cargar el ranking.'; }
  j.rankingLoading=false; render();
}
function preservedModuleView(id) {
  const meta=id==='aula'?['Aula de clases','Formación de Sublichat','🏫']:id==='objetivos'?['Objetivos','Metas y progreso diario','🎯']:['Materia cerebral','Entrenamiento y juegos de Sublichat','🧠'];
  return subPage(meta[0],meta[1],`<section class="panel preserved-module"><div class="preserved-module-hero"><span>${meta[2]}</span><div><h2>${meta[0]}</h2><p class="muted">La reestructuración conserva este módulo. Su contenido funcional se mantiene separado del rediseño para no romper la lógica existente.</p></div></div></section>`);
}

function moviesView() { return moviesContentHtml({query:state.movieQuery,results:state.movieResults,loading:state.movieLoading,error:state.movieError,menuOpen:state.moviesMenuOpen}); }
function matchesView() { return subPage('Partidos','Calendario deportivo · hora Honduras',matchesContentHtml({mode:state.matchMode,query:state.matchQuery,matches:state.matches,loading:state.matchLoading,error:state.matchError,meta:state.matchMeta})); }
function subliView() { return subliContentHtml({messages:state.subliMessages,loading:state.subliLoading,cat:state.subliCat,sugOffset:state.subliSugOffset,menuOpen:state.subliMenuOpen}); }

async function loadMatchesFor(mode='hoy',q='') {
  state.matchMode=mode; state.matchQuery=q; state.matchLoading=true; state.matchError=''; render();
  try {
    const data=await loadMatches(mode==='equipo'?{modo:'equipo',q}:{modo:mode});
    if (data?.error) throw new Error(`${data.error}${Array.isArray(data.detalle)&&data.detalle.length?` (${data.detalle[0]})`:''}`);
    state.matches=Array.isArray(data?.partidos)?data.partidos:[];
    state.matchMeta={hoy:String(data?.hoy||''),soloProximos:Boolean(data?.soloProximos),parcial:Boolean(data?.parcial),detalle:Array.isArray(data?.detalle)?data.detalle.slice(0,3).map(String):[]};
  } catch (e) { state.matchError=e?.message||'No se pudo cargar el calendario.'; state.matches=null; }
  state.matchLoading=false; render();
}

async function sendSubli(text) {
  const q=String(text||'').trim(); if (!q || state.subliLoading) return;
  state.subliMenuOpen=false; state.subliMessages=[...state.subliMessages,{role:'user',text:q}]; state.subliLoading=true; render();
  try {
    const data=await askSubli(q,subliClientsPayload(state.clients,new Date()));
    state.subliMessages=[...state.subliMessages,{role:'bot',text:String(data?.respuesta||'No obtuve respuesta.')}];
  } catch (e) { state.subliMessages=[...state.subliMessages,{role:'bot',text:`⚠️ ${e?.message||'No pude responder ahora.'}`,error:true}]; }
  state.subliLoading=false; render();
}

function moreView() {
  if (state.subview==='pelis') return moviesView();
  if (state.subview==='partidos') return matchesView();
  if (state.subview==='subli') return subliView();
  if (state.subview==='inventario') return inventoryView();
  if (state.subview==='control-maestro') return controlMasterView();
  if (state.subview==='finanzas') return financeView();
  if (state.subview==='tickets') return ticketsView();
  if (state.subview==='sorteos') return rafflesView();
  if (state.subview==='calculadora') return calculatorView();
  if (state.subview==='perfil') return profileView();
  if (state.subview==='aula') return state.academiaLesson!=null ? academiaLessonView(state.academiaLesson) : academiaListView();
  if (state.subview==='objetivos') return preservedModuleView(state.subview);
  if (state.subview==='materia') return juegosView();
  const items=roleModules(state.session?.role || '', state.session?.usuario || '').more.map(id=>[id]);
  const syncText=state.sync==='online'?'En línea':state.sync==='syncing'?'Sincronizando':state.sync==='partial'?'Parcial':'Listo';
  return masHomeHtml({modules:items.map(x=>x[0]),sessionLabel:roleLabel(state.session?.role, state.session?.usuario),online:state.sync==='online',syncText,version:'1.0'});
}

function currentView() {
  if (state.active!=='nuevo-crm') state.crmSheet='';
  if (state.active==='inicio') return dashboardView();
  if (state.active==='clientes') return clientsView();
  if (state.active==='nuevo-crm') return crmView();
  if (state.active==='renovar' || state.active==='cobros') return renewView();
  if (state.active==='tickets') return ticketsView();
  if (state.active==='perfil') return profileView();
  if (state.active==='catalogo') return catalogView();
  return moreView();
}

const NAV_META={inicio:['Inicio','home'],clientes:['Clientes','users'],cobros:['Cobros','renew'],tickets:['Tickets','ticket'],mas:['Más','more']};
function navTabs() {
  return roleModules(state.session?.role || '', state.session?.usuario || '').tabs.map(id=>[id,...NAV_META[id]]);
}
function hasCobrosTab() { return navTabs().some(t=>t[0]==='cobros'); }

function activeRenewGroup() {
  if(!state.renewGroupKey)return null;
  return groupRenewalsByClientDate(allRows()).find(g=>g.key===state.renewGroupKey) || null;
}

const RENEW_MONTHS=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEPT','OCT','NOV','DIC'];
function renewPickLabel(p={}) { return p.exactDate?`hasta ${p.exactDate}`:p.months?`+${p.months} meses`:`+${p.days||30} días`; }
function renewPreviewDate(fecha='',p={}) {
  if(p.exactDate)return p.exactDate;
  if(p.months)return renewalDateForMonths(fecha,p.months)||'';
  const d=parseDateDMY(fecha); if(!d)return '';
  d.setDate(d.getDate()+Number(p.days||30));
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function renewPickEquals(a={},b={}) { return (a.exactDate||'')===(b.exactDate||'') && Number(a.months||0)===Number(b.months||0) && Number(a.days||0)===Number(b.days||0); }
function renewChargeGroup() { // el mismo grupo que se ve en pantalla: solo los servicios de esa fecha
  const raw=activeRenewGroup(); if(!raw)return null;
  const due=servicesForRenewalDate(raw.servicios,raw.fechaRenovacion);
  return {...raw,servicios:due,total:due.reduce((sum,row)=>sum+(Number(row.precio)||0),0)};
}
function renewalSheet() {
  const raw=activeRenewGroup(); if(!raw)return '';
  const dueServices=servicesForRenewalDate(raw.servicios,raw.fechaRenovacion);
  const g={...raw,servicios:dueServices,total:dueServices.reduce((sum,row)=>sum+(Number(row.precio)||0),0)};
  const selected=new Set(state.renewSelection.length?state.renewSelection:g.servicios.map(rowKey));
  const msg=state.renewMessage || buildChargeMessage(g,state.renewMessageVariant);
  const pick=state.renewPick||{days:30};
  const date=parseDateDMY(g.fechaRenovacion);
  const today=new Date(); today.setHours(12,0,0,0);
  const diff=date?Math.round((date-today)/86400000):null;
  const tone=diff===null?'blue':diff<0?'red':diff===0?'orange':'blue';
  const first=g.servicios[0]||{};
  const names=g.servicios.map(s=>chargePlatformName(s.plataforma)).join(' + ');
  const preview=renewPreviewDate(g.fechaRenovacion,pick);
  const busy=state.mutating;
  const ico={
    back:'<path d="m15 5-7 7 7 7"/>', dots:'<circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/>',
    chat:'<path d="M20 12a8 8 0 0 1-11.8 7L4 20l1.1-3.8A8 8 0 1 1 20 12Z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>',
    copy:CRM_ICO.copy, doc:CRM_ICO.doc, wa:CRM_ICO.wa, cal:CRM_ICO.calendar, refresh:'<path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/>',
    ban:'<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>', gear:'<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
    check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>', edit:'<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>'
  };
  const presets=[[{days:30},'+30 días',ico.refresh],[{days:31},'+31 días',ico.cal],[{months:2},'+2 meses',ico.cal],[{months:3},'+3 meses',ico.cal]];
  const presetBtn=([p,label,path])=>`<button type="button" class="rn-preset ${renewPickEquals(pick,p)?'on':''}" ${p.days?`data-renew-days="${p.days}"`:`data-renew-months="${p.months}"`} ${busy?'disabled':''}>${svg(path,20)}<span>${label}</span></button>`;
  return `<div class="sheet-backdrop renew-backdrop" id="closeSheet"><section class="bottom-sheet renewal-full-sheet rn-sheet" role="dialog" aria-modal="true" aria-label="Cobro y Renovación" onclick="event.stopPropagation()">
    <header class="rn-top"><button type="button" class="rn-iconbtn" id="renewBack" aria-label="Volver">${svg(ico.back,22)}</button><h2>Cobro y Renovación</h2><button type="button" class="rn-iconbtn" id="renewMenuBtn" aria-label="Más opciones" aria-expanded="${state.renewMenu?'true':'false'}">${svg(ico.dots,22)}</button>
      ${state.renewMenu?`<div class="rn-menu" role="menu"><button type="button" id="renewOpenCrm" role="menuitem">${svg(ico.check,18)} Ficha CRM + WhatsApp grupo</button><button type="button" id="renewEditService" role="menuitem">${svg(ico.edit,18)} Editar ficha del servicio</button><button type="button" id="toggleRenewManage" role="menuitem">${svg(ico.gear,18)} ${state.renewManage?'Ocultar gestión':'Gestionar servicios'}</button></div>`:''}
    </header>
    <section class="rn-client t-${tone}">
      <div class="rn-cal"><i></i><b>${date?date.getDate():'—'}</b><small>${date?RENEW_MONTHS[date.getMonth()]:'SIN FECHA'}</small></div>
      <div class="rn-client-txt"><h3>${esc(g.nombre)}</h3><p>${esc(names||'—')} · ${esc(g.fechaRenovacion||'sin fecha')}</p><b>${money(g.total)}</b>${diff!==null?`<em class="rn-due">${diff<0?`Vencido hace ${-diff} día${diff===-1?'':'s'}`:diff===0?'Vence hoy':diff===1?'Vence mañana':`Vence en ${diff} días`}</em>`:''}</div>
      <div class="rn-logo">${platformLogoHtml(first.plataforma,platformLabel(first.plataforma),'rn-logo-img')}${g.servicios.length>1?`<span class="rn-count">+${g.servicios.length-1}</span>`:''}</div>
    </section>
    ${state.renewManage?`<section class="renew-manage rn-manage"><p class="muted note">Quite con “No renovó” los servicios que ya no continuarán. Deje marcados los que sí se renovarán.</p>${g.serviciosCliente.map(row=>`<article class="manage-service"><label><input type="checkbox" data-renew-select="${esc(rowKey(row))}" ${selected.has(rowKey(row))?'checked':''}><span><strong>${esc(platformLabel(row.plataforma))}</strong><small>${money(row.precio)} · ${esc(row.fechaRenovacion||'sin fecha')} · ${row.perfiles?.length||1} perfil${(row.perfiles?.length||1)===1?'':'es'} · ${esc(row.vendedor||'Sin vendedor')}</small></span></label><div><button type="button" class="secondary mini" data-edit-service="${esc(rowKey(row))}">✏️ Editar</button><button type="button" class="danger-btn mini" data-no-renew="${esc(rowKey(row))}">🗑️ No renovó</button></div></article>`).join('')}</section>`:''}
    <section class="rn-msgcard">
      <header><span class="rn-msg-ico">${svg(ico.chat,22)}</span><b>Mensaje de cobro</b><button type="button" class="rn-pill" id="renewCopyPill">${svg(ico.copy,16)} Copiar</button></header>
      <textarea id="renewChargeText" rows="5" aria-label="Mensaje de cobro">${esc(msg)}</textarea>
    </section>
    <div class="charge-actions rn-actions">
      <button type="button" class="rn-btn rn-style" id="renewAnotherStyle"><span class="rn-emoji">🎨</span>Otro estilo</button>
      <button type="button" class="rn-btn rn-ai" id="renewAiMessage"><span class="rn-emoji">✨</span>Mensaje IA corto</button>
      <button type="button" class="rn-btn rn-copy" id="renewCopyMessage">${svg(ico.doc,22)}Copiar</button>
      <button type="button" class="rn-btn rn-wa" id="renewOpenWhatsApp">${svg(ico.wa,24)}Abrir WhatsApp</button>
    </div>
    <section class="renew-options rn-renew">
      <p class="rn-renew-title"><span class="rn-dollar">$</span>¿Ya pagó? Elija cuánto renovar:</p>
      <div class="renew-preset-grid rn-presets">${presets.map(presetBtn).join('')}</div>
      <details class="rn-calendar" ${pick.exactDate||state.renewCalOpen?'open':''} id="renewCalDetails"><summary>${svg(ico.cal,22)}<span>${pick.exactDate?`Fecha elegida: ${esc(pick.exactDate)}`:'Elegir fecha en calendario'}</span></summary><input id="renewExactDate" type="date" value="${pick.exactDate?pick.exactDate.split('/').reverse().join('-'):''}" aria-label="Fecha exacta de renovación"></details>
      <p class="rn-preview">${preview?`Nueva fecha: <b>${esc(preview)}</b> · ${esc(renewPickLabel(pick))}`:`Se renovará ${esc(renewPickLabel(pick))}`}${selected.size>1?` · ${selected.size} servicios`:''}</p>
    </section>
    <button type="button" class="rn-big rn-go" id="renewApply" ${busy?'disabled':''}>${svg(ico.refresh,24)}${busy?'Renovando…':'Renovar a fecha elegida'}</button>
    <button type="button" class="rn-big rn-no" id="renewNoRenewAll" ${busy?'disabled':''}>${svg(ico.ban,24)}No renovó</button>
    <button type="button" class="rn-big rn-close" id="cancelRenew">Cerrar</button>
  </section></div>`;
}

async function handleNoRenewGroup() {
  const g=activeRenewGroup(); if(!g||state.mutating)return;
  const due=servicesForRenewalDate(g.servicios,g.fechaRenovacion);
  const selected=new Set(state.renewSelection.length?state.renewSelection:due.map(rowKey));
  const rows=g.serviciosCliente.filter(r=>selected.has(rowKey(r)));
  if(!rows.length){showToast('Marque al menos un servicio.');return;}
  if(!window.confirm(`¿Confirmar que ${g.nombre} NO renovó ${rows.map(r=>platformLabel(r.plataforma)).join(', ')}? Se dará de baja solo ${rows.length===1?'ese servicio':'esos servicios'} y se liberará su cupo. La ficha del cliente se conserva.`))return;
  state.mutating=true; render(); let ok=0, fail=0;
  for(const row of rows){try{const r=await removeNonRenewingService(row);if(!r?.ok)throw new Error(r?.error||'');if(r.clienteEliminado===true)throw new Error('SEGURIDAD');ok+=1;}catch(_){fail+=1;}}
  state.mutating=false; state.renewGroupKey=''; state.renewSelection=[]; state.renewManage=false; state.renewMenu=false; state.renewMessage=''; render();
  showToast(`${ok} servicio${ok===1?'':'s'} dado${ok===1?'':'s'} de baja${fail?` · ${fail} falló${fail===1?'':'aron'}`:''}. La ficha del cliente se conserva.`);
  loadCoreData({force:true});
}

function whatsappSheet() {
  if (!state.whatsappChooser) return '';
  return `<div class="sheet-backdrop" id="closeWhatsAppChooser"><section class="bottom-sheet whatsapp-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()"><div class="sheet-handle"></div><p class="eyebrow">${state.whatsappPickOnly?'APP DE WHATSAPP':'ABRIR WHATSAPP'}</p><h2>¿Cuál desea usar?</h2><p class="muted note">${state.whatsappPickOnly?'Cobros, fichas y entregas se abrirán siempre en la que elija.':'Seleccione la aplicación que quiere abrir.'}</p><div class="whatsapp-choices"><button class="whatsapp-choice" data-whatsapp-package="com.whatsapp">${icon('phone')}<span><strong>WhatsApp normal</strong><small>Aplicación personal</small></span></button><button class="whatsapp-choice" data-whatsapp-package="com.whatsapp.w4b">${icon('phone')}<span><strong>WhatsApp Business</strong><small>Aplicación de negocio</small></span></button>${state.whatsappPickOnly?`<button class="whatsapp-choice" data-whatsapp-package="ask">${icon('refresh')}<span><strong>Preguntar cada vez</strong><small>Elegir al momento de enviar</small></span></button>`:''}</div><button class="secondary whatsapp-cancel" id="cancelWhatsApp">Cancelar</button></section></div>`;
}

function normalizeWhatsAppPhone(value='') {
  let digits=String(value||'').replace(/\D/g,'');
  if(!digits)return '';
  if(digits.startsWith('00'))digits=digits.slice(2);
  if(digits.length===8)digits=`504${digits}`;
  return digits;
}
function requestWhatsApp(text='', phone='') {
  state.whatsappText=String(text||''); state.whatsappPhone=normalizeWhatsAppPhone(phone);
  const saved=localStorage.getItem('sublicuentas-whatsapp-app');
  if (saved==='com.whatsapp' || saved==='com.whatsapp.w4b') { launchWhatsApp(saved); return; } // ya eligió una vez: no se vuelve a preguntar
  state.whatsappPickOnly=false; state.whatsappChooser=true; render();
}
function requestClientWhatsApp(row) {
  if(!row)return;
  const client=clientById(row.clienteId);
  const phone=String(client?.telefono||row.telefono||'');
  if(!normalizeWhatsAppPhone(phone)){showToast('Este cliente no tiene un teléfono válido.');return;}
  requestWhatsApp('',phone);
}
async function launchWhatsApp(packageName) {
  const allowed = new Set(['com.whatsapp','com.whatsapp.w4b']);
  if (!allowed.has(packageName)) return;
  localStorage.setItem('sublicuentas-whatsapp-app', packageName); // se recuerda la elección: no se vuelve a preguntar la próxima vez
  const text=String(state.whatsappText||'');
  const phone=String(state.whatsappPhone||'');
  const hadSheet=state.whatsappChooser;
  state.whatsappChooser=false; state.whatsappText=''; state.whatsappPhone='';
  if (hadSheet) render(); // solo se redibuja si había selector abierto: WhatsApp se abre al instante
  try {
    await IntentLauncher.startActivityAsync({
      action:ActivityAction.VIEW,
      packageName,
      data:phone?`whatsapp://send?phone=${phone}${text?`&text=${encodeURIComponent(text)}`:''}`:`whatsapp://send${text?`?text=${encodeURIComponent(text)}`:''}`,
    });
  } catch (error) {
    try {
      await IntentLauncher.startActivityAsync({
        action:ActivityAction.VIEW,
        data:phone?`https://wa.me/${phone}${text?`?text=${encodeURIComponent(text)}`:''}`:`https://wa.me/?text=${encodeURIComponent(text)}`,
      });
    } catch (_) {
      showToast(packageName==='com.whatsapp.w4b'?'No se pudo abrir WhatsApp Business.':'No se pudo abrir WhatsApp.');
    }
  }
}

function findRowByKey(key='') { return allRows().find(r=>rowKey(r)===String(key||'')) || null; }
function crmDraftFromRow(row) {
  if(!row)return null;
  const client=state.clients.find(c=>String(c.id)===String(row.clienteId)); const s=row.raw||{};
  const profiles=(Array.isArray(s.perfiles)&&s.perfiles.length?s.perfiles:[{nombre:s.perfil||clientName(client),correo:s.correo||'',clave:s.clave||s.contrasena||s.password||'',pinPerfil:s.pinPerfil||s.pin_perfil||'',dispositivo:s.dispositivo||'',esRoku:!!s.esRoku}]).map(p=>({
    perfilId:String(p.perfilId||p.id||''), nombre:String(p.nombre||p.nombrePerfil||p.perfil||clientName(client)), correo:String(p.correo??s.correo??''), clave:String(p.clave??p.contrasena??p.password??s.clave??''), pinPerfil:String(p.pinPerfil??p.pin_perfil??p.pin??s.pinPerfil??''), dispositivo:String(p.dispositivo??s.dispositivo??''), esRoku:p.esRoku!=null?!!p.esRoku:!!s.esRoku
  }));
  const vis=s.visibilidadUrl||{modo:'plataforma'};
  return {...crmDefaultDraft(),clienteId:String(row.clienteId||''),savedClientId:String(row.clienteId||''),compraId:String(row.compraId||''),forzarNuevoServicio:false,servicioIndex:Number(row.servicioIndex),plataformaOriginal:String(s.plataforma||row.plataforma||''),correoOriginal:String(s.correo||row.correo||''),nombrePerfil:clientName(client),telefono:String(client?.telefono||row.telefono||''),vendedor:String(s.vendedor||client?.vendedor||row.vendedor||crmSeller()),vendedorTelefono:String(s.vendedorTelefono||client?.vendedorTelefono||''),beneficiarioTipo:String(s.beneficiarioTipo||'titular'),beneficiarioNombre:String(s.beneficiarioNombre||''),plataforma:crmBasePlatform(String(s.plataforma||row.plataforma||'netflix')),tvDispositivos:String(crmStoredDeviceCount(String(s.plataforma||row.plataforma||''))),precio:String(s.precio??row.precio??''),fechaRenovacion:String(s.fechaRenovacion||row.fechaRenovacion||''),mesesContratados:Number(s.mesesContratados||1),visibilidadModo:String(vis.modo||'plataforma'),visCorreo:vis.campos?.correo!==false,visClave:vis.campos?.clave!==false,visPin:vis.campos?.pin!==false,perfiles:profiles,fichaTexto:String(s.fichaTexto||''),iptvProveedor:String(s.iptvProveedor||''),iptvPantallas:String(s.iptvPantallas||''),iptvLista:String(s.iptvLista||''),iptvHora:String(s.iptvHora||''),maxPlayer:s.maxPlayer===true,maxPlayerUsuario:String(s.maxPlayerUsuario||''),maxPlayerClave:String(s.maxPlayerClave||''),oleadaDispositivos:String(s.oleadaDispositivos||''),stellaDispositivos:String(s.stellaDispositivos||'')};
}
function openCrmForRow(row) {
  const draft=crmDraftFromRow(row); if(!draft)return;
  state.crmDraft=draft; state.clientActionKey=''; state.clientActionMode='menu'; state.renewGroupKey=''; state.backTo=state.active; state.active='nuevo-crm'; render();
}
function traditionalFichaForRow(row) {
  const draft=crmDraftFromRow(row); if(!draft)return '';
  return String(draft.fichaTexto||'').trim() || crmFichaFromDraft(draft);
}
function addServiceForRow(row) {
  if(!row||!cap().nuevoCrm)return;
  const base=crmDraftFromRow(row); if(!base)return;
  state.crmDraft={...crmDefaultDraft(),clienteId:base.savedClientId||base.clienteId,savedClientId:base.savedClientId||base.clienteId,nombrePerfil:base.nombrePerfil,telefono:base.telefono,vendedor:base.vendedor,vendedorTelefono:base.vendedorTelefono,beneficiarioTipo:'titular',beneficiarioNombre:'',forzarNuevoServicio:true};
  state.clientActionKey=''; state.backTo=state.active; state.active='nuevo-crm'; render();
}
function rowBeneficiaryKey(row) {
  const draft=crmDraftFromRow(row); if(!draft)return 'titular';
  return crmBeneficiaryKey(draft);
}
async function openClientUrlVariants(row) {
  if(!row?.clienteId){showToast('Esta ficha no tiene ID de cliente.');return;}
  try {
    const result=await ensureClientLinks(row.clienteId,rowBeneficiaryKey(row));
    if(!result?.ok)throw new Error(result?.error||'No se pudo recuperar el enlace.');
    const relative=String(result.linkPublico||'').trim();
    state.clientActionLink=relative.startsWith('http')?relative:`https://sublichat.capuchino.lat${relative.startsWith('/')?'':'/'}${relative}`;
    state.clientActionMode='url'; state.clientActionUrlVariant=0; render();
  } catch(error) { showToast(error?.message||'No se pudo abrir la ficha URL.'); }
}
function clientActionsSheet() {
  if(!state.clientActionKey)return '';
  const row=findRowByKey(state.clientActionKey); if(!row)return '';
  if(state.clientActionMode==='detail'){
    const raw=row.raw||{}; const profiles=Array.isArray(raw.perfiles)&&raw.perfiles.length?raw.perfiles:[raw]; const first=profiles[0]||{};
    const profileName=first.nombre||first.nombrePerfil||first.perfil||raw.perfil||row.nombre||'—';
    const email=first.correo??raw.correo??row.correo??''; const password=first.clave??first.contrasena??first.password??raw.clave??raw.contrasena??raw.password??''; const pin=first.pinPerfil??first.pin_perfil??first.pin??raw.pinPerfil??raw.pin_perfil??'';
    return `<div class="sheet-backdrop client-actions-backdrop" id="closeClientActions"><section class="bottom-sheet client-actions-sheet service-detail-sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><p class="eyebrow">FICHA CRM</p><h2>Detalle del servicio</h2><p class="sheet-service">${esc(row.nombre)} · ${esc(platformLabel(row.plataforma))}</p><div class="service-detail-grid"><div><span>Fecha de renovación</span><strong>${esc(row.fechaRenovacion||'Sin fecha')}</strong></div><div><span>Vendedor</span><strong>${esc(row.vendedor||'Sin vendedor')}</strong></div><div><span>Precio</span><strong>${row.precio?money(row.precio):'Sin precio'}</strong></div><div><span>Perfil</span><strong>${esc(profileName)}</strong></div><div><span>Correo</span><strong>${esc(email||'Sin correo')}</strong></div>${password?`<div><span>Clave</span><strong>${esc(password)}</strong></div>`:''}${pin?`<div><span>PIN</span><strong>${esc(pin)}</strong></div>`:''}</div><div class="service-detail-actions"><button class="secondary" data-client-action="edit">✏️ Editar servicio</button><button class="secondary" data-client-action="ficha">✅ Entregar ficha</button><button class="secondary" data-client-action="url">🔗 Acceso URL</button><button class="danger-btn" data-client-action="no-renew">❌ No renovó este servicio</button></div><div class="sheet-actions"><button class="secondary" id="clientActionBack">Volver</button><button class="secondary" id="closeClientActionsBtn">Cerrar</button></div></section></div>`;
  }
  if(state.clientActionMode==='url'){
    const beneficiary=row.raw?.beneficiarioTipo==='tercero'?(row.raw?.beneficiarioNombre||row.nombre):row.nombre;
    const variant=buildUrlDeliveryMessage({nombre:beneficiary,servicio:row.plataforma,link:state.clientActionLink,variante:state.clientActionUrlVariant});
    return `<div class="sheet-backdrop client-actions-backdrop" id="closeClientActions"><section class="bottom-sheet client-actions-sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><p class="eyebrow">ACCESO URL Y 6 VARIANTES</p><h2>${esc(row.nombre)}</h2><p class="muted note">${esc(platformLabel(row.plataforma))}</p><label class="charge-editor"><span>Enlace permanente</span><textarea rows="2" readonly>${esc(state.clientActionLink)}</textarea></label><div class="url-variant-grid">${Array.from({length:urlDeliveryVariantCount()},(_,i)=>`<button data-client-url-variant="${i}" class="${state.clientActionUrlVariant===i?'active':''}">Variante ${i+1}</button>`).join('')}</div><label class="charge-editor"><span>Mensaje para el cliente</span><textarea id="clientUrlMessage" rows="7">${esc(variant)}</textarea></label><div class="charge-actions"><button class="secondary" id="clientCopyUrlMessage">📋 Copiar</button><button class="wa-green" id="clientOpenUrlWhatsApp">💬 Abrir WhatsApp</button></div><div class="sheet-actions"><button class="secondary" id="clientActionBack">Volver</button><button class="secondary" id="closeClientActionsBtn">Cerrar</button></div></section></div>`;
  }
  return `<div class="sheet-backdrop client-actions-backdrop" id="closeClientActions"><section class="bottom-sheet client-actions-sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><p class="eyebrow">ACCIONES DEL CLIENTE</p><h2>${esc(row.nombre)}</h2><p class="sheet-service">${esc(platformLabel(row.plataforma))} · ${esc(row.fechaRenovacion||'Sin fecha')} · ${money(row.precio)}</p>${(()=>{const mine=allRows().filter(r=>sameClient(r,row)).sort((a,b)=>(parseDateDMY(a.fechaRenovacion)?.getTime()||9e15)-(parseDateDMY(b.fechaRenovacion)?.getTime()||9e15));return mine.length>1?`<div class="client-svc-picker"><small>Este cliente tiene ${mine.length} cuentas. Elige a cuál aplicar la acción:</small>${mine.map(r=>`<button type="button" class="${rowKey(r)===state.clientActionKey?'on':''}" data-client-svc="${esc(rowKey(r))}">${esc(platformLabel(r.plataforma))} · ${esc(r.fechaRenovacion||'Sin fecha')}</button>`).join('')}</div>`:'';})()}<div class="client-action-menu"><button data-client-action="renew">🔄 Renovar</button><button data-client-action="charge">💬 Mensaje de cobro / WhatsApp</button>${cap().nuevoCrm?`<button data-client-action="add-service">➕ Agregar otra cuenta al mismo cliente</button>`:''}${cap().nuevoCrm?`<button data-client-action="edit">✏️ Editar cliente / ficha CRM</button>`:''}<button data-client-action="ficha">✅ Entregar ficha de la cuenta</button><button data-client-action="url">🔗 Acceso URL y 6 variantes</button><button class="danger-action" data-client-action="no-renew">❌ No renovó</button></div><div class="sheet-actions"><button class="secondary" id="closeClientActionsBtn">Cerrar</button></div></section></div>`;
}

function appShell() {
  const tabs=navTabs();
  const upd=COMPAT.blocked?`<div class="update-banner" role="alert">⬆️ ${esc(COMPAT.message)}</div>`:'';
  const chip=(state.loadingCore||state.sync==='offline'||Date.now()<(state.syncChipUntil||0))&&state.syncLabel?`<div class="sync-chip ${state.loadingCore?'busy':state.sync==='offline'?'off':state.sync==='partial'?'warn':'ok'}" id="syncChip" role="status" aria-live="polite">${state.loadingCore?'<i class="sync-spin"></i>':''}${esc(state.syncLabel)}</div>`:'';
  return `${upd}${chip}<main class="app-main" data-active="${state.subview==='materia'&&state.juegos?.screen==='game'?'juego':state.active}">${currentView()}</main><nav class="bottom-nav" style="--nav-count:${tabs.length}">${tabs.map(([id,label,ico])=>`<button data-tab="${id}" class="${state.active===id?'active':''}"><span>${navIcon(ico)}</span><small>${label}</small></button>`).join('')}</nav>${clientActionsSheet()}${renewalSheet()}${whatsappSheet()}${state.toast?`<div class="toast">${esc(state.toast)}</div>`:''}`;
}

function render() {
  applyTheme();
  const root=document.querySelector('#app');
  try {
    root.innerHTML=state.splash?splashView():(state.session?appShell():loginView());
  } catch (e) {
    console.error('Error de render, se recupera mostrando el login:', e);
    try {
      state.splash=false; state.session=null; state.active='inicio'; state.subview=null;
      root.innerHTML=loginView();
    } catch (e2) {
      root.innerHTML='<main style="position:fixed;inset:0;display:grid;place-items:center;padding:32px;text-align:center;font-family:system-ui,sans-serif;background:#fff"><div><p style="font-weight:800;font-size:17px;color:#0a2f5f;margin:0 0 14px">Ocurrió un error al cargar la app.</p><button id="reloadAppBtn" style="padding:12px 26px;border-radius:14px;background:#ed1717;color:#fff;border:0;font-weight:800;font-size:15px">Reintentar</button></div></main>';
      document.querySelector('#reloadAppBtn')?.addEventListener('click',()=>location.reload());
      return;
    }
  }
  bindEvents();
  afterRender();
}

let lastViewKey='';
function afterRender() {
  const viewKey=[state.session?1:0,state.active,state.subview,state.academiaLesson,state.academiaSettings,state.selectedClientId].join('|');
  if (viewKey!==lastViewKey) { lastViewKey=viewKey; window.scrollTo(0,0); }
  // Inicio no se mueve: si todo cabe en pantalla el <main> queda fijo. La clase vive en el <main> de ESTE render,
  // así que jamás se queda pegada al cambiar de pantalla (antes bloqueaba el scroll de Clientes, Cobros, etc.).
  document.body.classList.remove('home-lock');
  const shell=document.querySelector('.app-main');
  if (shell && state.session && !state.splash && state.active==='inicio') {
    // Inicio NUNCA se desplaza: siempre queda fijo y, si en algún teléfono no cabe, se reduce un poco la escala.
    window.scrollTo(0,0); shell.classList.add('home-fixed');
    const nav=document.querySelector('.bottom-nav');
    const limit=nav ? nav.getBoundingClientRect().top+window.scrollY : window.innerHeight;
    const top=shell.getBoundingClientRect().top+window.scrollY;
    const contentBottom=Math.max(0,...[...shell.children].map(k=>k.getBoundingClientRect().bottom+window.scrollY));
    if (contentBottom>limit+2 && contentBottom>top) shell.style.zoom=String(Math.max(0.68,Math.min(1,(limit-top)/(contentBottom-top))));
  }
  // Tickets: cualquier camino que llegue a la pantalla dispara la carga (la pestaña inferior no lo hacía).
  const onTickets=state.active==='tickets'||(state.active==='mas'&&state.subview==='tickets');
  if (state.session && onTickets && !state.ticketsLoaded && !state.ticketsFetching && !state.errors.tickets) ensureTickets();
}

function openRenewGroup(key) {
  const g=groupRenewalsByClientDate(allRows()).find(x=>x.key===key); if(!g)return;
  state.renewGroupKey=g.key; state.renewSelection=g.servicios.map(rowKey); state.renewManage=false; state.renewMenu=false; state.renewCalOpen=false; state.renewPick={days:30}; state.renewMessageVariant=randomChargeVariant(); state.renewMessageHistory=[]; state.renewMessage=buildChargeMessage(renewChargeGroup()||g,state.renewMessageVariant); render();
}

function openRenewForRow(row) {
  if(!row)return;
  const g=groupRenewalsByClientDate(allRows()).find(x=>x.clienteId===row.clienteId && x.fechaRenovacion===row.fechaRenovacion && String(x.vendedor||'')===String(row.vendedor||''));
  if(g)openRenewGroup(g.key);
}

function crmBeneficiaryKey(d) {
  if(d.beneficiarioTipo!=='tercero')return 'titular';
  const slug=String(d.beneficiarioNombre||'persona').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'persona';
  return `tercero-${slug}`;
}

function validateCrmDraft(d) {
  if(crmIsIptvFamily(d.plataforma)&&d.maxPlayer&&(!String(d.maxPlayerUsuario||'').trim()||!String(d.maxPlayerClave||'').trim()))return 'Falta el usuario o la contraseña de Max Player.';
  const rules=crmRules(d.plataforma);
  if(!d.nombrePerfil||!d.telefono||!d.plataforma) return 'Complete cliente, teléfono y plataforma.';
  if(!d.vendedor) return 'Seleccione el vendedor responsable de esta cuenta.';
  if(d.beneficiarioTipo==='tercero'&&!d.beneficiarioNombre) return 'Escriba el nombre de la persona que usará este acceso.';
  if(!parseDateDMY(d.fechaRenovacion)) return 'Use la fecha en formato DD/MM/AAAA.';
  if(!Number.isFinite(Number(d.precio))||Number(d.precio)<=0)return 'Ingrese el precio de la venta.';
  for(let i=0;i<d.perfiles.length;i+=1){const p=d.perfiles[i]||{};const label=`Perfil ${i+1}`;if(!String(p.nombre||'').trim())return `${label}: falta el nombre de la persona/perfil.`;if(rules.email&&!String(p.correo||'').trim())return `${label}: falta el correo o usuario asignado.`;if(rules.password&&!String(p.clave||'').trim())return `${label}: falta la clave, serial o licencia.`;if(rules.pin&&!String(p.pinPerfil||'').trim())return `${label}: falta el PIN individual.`;if(rules.device&&!['tv','cel'].includes(p.dispositivo))return `${label}: seleccione TV o celular.`;}
  return '';
}

function crmSearchClient() {
  state.crmDraft=readCrmDraftFromDom();
  if(!state.clients?.length)loadCoreData().catch(()=>{});
  state.crmSheet='client'; render();
}
async function saveCrm({delivery='' }={}) {
  const d=readCrmDraftFromDom();
  if(!d.fichaTexto.trim())d.fichaTexto=crmFichaFromDraft(d);
  state.crmDraft=d; // si el guardado falla, la ficha NO se reinicia (antes se perdía todo lo escrito)
  const error=validateCrmDraft(d); if(error){showToast(error);return null;}
  if(state.crmSaving)return null; // evita doble guardado por doble toque
  state.crmSaving=true;
  if(!d._opId)d._opId=newOperationId(); state.crmDraft=d; // R69: el MISMO operationId si el usuario reintenta tras un error/timeout
  const button=document.querySelector(delivery==='tradicional'?'#crmDeliverTraditional':delivery==='url'?'#crmDeliverUrl':'#crmSubmit');
  if(button){button.disabled=true;button.dataset.old=button.innerHTML;button.textContent='Guardando…';}
  try{
    const form={...d,operationId:d._opId,plataforma:crmStoredPlatform(d.plataforma,d.tvDispositivos||d.iptvPantallas||1),precio:Number(d.precio),visibilidadUrl:crmIsIptvFamily(d.plataforma)&&(d.maxPlayer||d.visibilidadModo==='plataforma')?{modo:'personalizado',campos:{correo:false,clave:false,pin:false}}:urlVisibilityFromMode(d.visibilidadModo,{correo:d.visCorreo,clave:d.visClave,pin:d.visPin}),clienteId:d.clienteId||d.savedClientId||'',perfiles:d.perfiles,forzarNuevoServicio:d.forzarNuevoServicio===true,fichaTexto:d.fichaTexto};
    const result=await createCrmSale(form);
    if(!result?.ok||result?.guardadoEnFirebase!==true||!result?.clienteId)throw new Error(result?.error||'Firebase no confirmó la ficha.');
    d.clienteId=String(result.clienteId); d.savedClientId=String(result.clienteId); d.forzarNuevoServicio=false; d._opId=''; // confirmada: la próxima acción es otra operación
    if(result.compraId)d.compraId=String(result.compraId);
    state.crmDraft=d;
    // El servidor ya devuelve el enlace del beneficiario en la misma respuesta: solo se pide aparte si no vino.
    let link=String(result?.linkPublico||'');
    if(!link&&delivery!=='tradicional'){try{const links=await ensureClientLinks(result.clienteId,crmBeneficiaryKey(d));link=String(links?.linkPublico||'');}catch(_){}}
    if(link&&link.startsWith('/'))link=`https://sublichat.capuchino.lat${link}`;
    if(link){d.savedLink=link;d.savedBeneficiarioKey=crmBeneficiaryKey(d);}
    state.crmDraft=d;
    state.crmSaving=false;
    setTimeout(()=>loadCoreData({force:true,only:['clients']}),1500); // la lista se refresca en segundo plano, sin hacer esperar
    if(delivery==='tradicional'){requestWhatsApp(d.fichaTexto||crmFichaFromDraft(d));return result;}
    if(delivery==='url'){if(!link){showToast('CRM guardado, pero no se pudo recuperar la URL del cliente.');return result;}requestWhatsApp(crmUrlMessage(d,link),d.telefono);return result;}
    if(delivery==='silent')return result;
    state.toast='CRM guardado y confirmado en Firebase.';render();clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>{state.toast='';render();},3200);return result;
  }catch(e){showToast(e?.message||'No se pudo guardar el CRM.');return null;}
  finally{state.crmSaving=false;if(button&&document.body.contains(button)){button.disabled=false;button.innerHTML=button.dataset.old||'Guardar CRM';}}
}

// Devuelve el enlace permanente del cliente; si la ficha aún no está guardada, la guarda primero.
async function crmEnsureLink() {
  const d=readCrmDraftFromDom(); state.crmDraft=d;
  if(d.savedLink&&d.savedBeneficiarioKey===crmBeneficiaryKey(d))return d.savedLink;
  if(d.savedClientId){
    try{const links=await ensureClientLinks(d.savedClientId,crmBeneficiaryKey(d));let link=String(links?.linkPublico||'');if(link&&link.startsWith('/'))link=`https://sublichat.capuchino.lat${link}`;if(link){d.savedLink=link;d.savedBeneficiarioKey=crmBeneficiaryKey(d);state.crmDraft=d;render();return link;}}catch(_){}
  }
  showToast('Guardando el CRM para generar el enlace…');
  const r=await saveCrm({delivery:'silent'}); if(!r)return '';
  const link=crmDraft().savedLink||'';
  if(!link)showToast('CRM guardado, pero no se pudo recuperar la URL del cliente.'); else render();
  return link;
}
async function crmCopyText(text,ok,fail){ try{await navigator.clipboard.writeText(text);showToast(ok);}catch(_){showToast(fail);} }

function bindEvents() {
  const login=document.querySelector('#loginForm');
  if(login)login.addEventListener('submit',async e=>{e.preventDefault();const usuario=document.querySelector('#loginUser').value.trim();const clave=document.querySelector('#loginPassword').value;if(!usuario||!clave){state.errors.login='Escriba usuario y clave.';render();return;}state.loading=true;delete state.errors.login;render();try{state.session=await loginUser(usuario,clave);state.loading=false;state.active='inicio';state.crmDraft=null;restoreCoreCache();render();loadRemoteConfig(true);await loadCoreData({force:true});}catch(err){state.loading=false;const base=err.message||'No se pudo iniciar sesión.';state.errors.login=err.status===401?`Acceso no autorizado para ${usuario}. Verifique la clave exacta.`:base;render();}return;});
  document.querySelector('#toggleLoginPassword')?.addEventListener('click',()=>{const input=document.querySelector('#loginPassword'),btn=document.querySelector('#toggleLoginPassword');if(!input||!btn)return;const show=input.type==='password';input.type=show?'text':'password';btn.textContent=show?'Ocultar':'Mostrar';input.focus();});
  document.querySelectorAll('.visual-login-form input').forEach(input=>input.addEventListener('focus',()=>setTimeout(()=>input.scrollIntoView({block:'center',behavior:'smooth'}),180)));

  document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',async()=>{state.backTo='';state.active=btn.dataset.tab;state.subview=null;state.selectedClientId='';if(state.active==='nuevo-crm'&&!state.crmDraft)state.crmDraft=crmDefaultDraft();render();if(state.active==='catalogo')await ensureCatalog();if(state.active==='tickets')await ensureTickets(true);}));
  document.querySelectorAll('[data-tab-jump]').forEach(btn=>btn.addEventListener('click',()=>{state.backTo=state.active;state.active=btn.dataset.tabJump;state.subview=null;if(state.active==='nuevo-crm')state.crmDraft=crmDraftForNew();render();}));
  document.querySelectorAll('[data-open]').forEach(btn=>btn.addEventListener('click',async()=>{const id=btn.dataset.open;if(id==='nuevo-crm'){state.backTo=state.active;state.active='nuevo-crm';state.subview=null;state.crmDraft=crmDraftForNew();render();return;}const directRoutes=['tickets','perfil','clientes'];if(directRoutes.includes(id))state.backTo=state.active;if(directRoutes.includes(id)){state.active=id;state.subview=null;if(id==='clientes')state.selectedClientId='';}else{state.active='mas';state.subview=id;}if(id==='aula'){state.academiaLesson=null;state.academiaSel={};state.academiaSettings=false;}render();if(id==='tickets')await ensureTickets(true);if(id==='sorteos')await ensureRaffles(true);if(id==='materia'){state.juegos.screen='ranking';state.juegos.engine=null;ensureJuegosResumen();await juegosLoadRanking(state.juegos.rankingScope||'general');}if(id==='control-maestro')await ensureControlMaster();if(id==='aula')await ensureAcademia();if(id==='partidos'&&!state.matches&&!state.matchLoading)await loadMatchesFor('hoy');}));
  document.querySelectorAll('[data-renew-filter]').forEach(btn=>btn.addEventListener('click',()=>{if(hasCobrosTab()){state.active='renovar';state.renewFilter=btn.dataset.renewFilter;render();return;}state.clientStatusFilter=({hoy:'hoy',proximo:'proximos',vencidos:'vencidos'})[btn.dataset.renewFilter]||'vigentes';state.active='clientes';state.subview=null;state.selectedClientId='';render();}));
  document.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{state.renewFilter=btn.dataset.filter;render();}));
  document.querySelectorAll('[data-client-id]').forEach(btn=>btn.addEventListener('click',()=>{state.selectedClientId=btn.dataset.clientId;render();}));
  document.querySelectorAll('[data-renew-group]').forEach(btn=>btn.addEventListener('click',()=>openRenewGroup(btn.dataset.renewGroup)));
  document.querySelectorAll('[data-renew-key]').forEach(btn=>btn.addEventListener('click',()=>openRenewForRow(findRowByKey(btn.dataset.renewKey))));
  document.querySelectorAll('[data-client-status]').forEach(btn=>btn.addEventListener('click',()=>{state.clientStatusFilter=btn.dataset.clientStatus||'vigentes';render();}));
  document.querySelector('#clientPlatformFilter')?.addEventListener('change',e=>{state.clientPlatformFilter=e.target.value;render();});
  document.querySelector('#clientSellerFilter')?.addEventListener('change',e=>{state.clientSellerFilter=e.target.value;render();});
  document.querySelector('#clientLimit')?.addEventListener('change',e=>{state.clientLimit=Number(e.target.value)||100;render();});
  document.querySelector('#clientFiltersToggle')?.addEventListener('click',()=>{state.clientFiltersOpen=state.clientFiltersOpen===false;render();});
  document.querySelector('#clientSort')?.addEventListener('change',e=>{state.clientSort=e.target.value;render();});
  document.querySelector('#exportClients')?.addEventListener('click',()=>openExportSheet('CLIENTES'));
  document.querySelector('#exportCobros')?.addEventListener('click',()=>openExportSheet('COBROS'));
  document.querySelector('#clientCobrosHoy')?.addEventListener('click',()=>{state.clientStatusFilter='hoy';render();});
  document.querySelectorAll('[data-client-charge]').forEach(btn=>btn.addEventListener('click',()=>openRenewForRow(findRowByKey(btn.dataset.clientCharge))));
  document.querySelectorAll('[data-client-actions]').forEach(btn=>btn.addEventListener('click',()=>{state.clientActionKey=btn.dataset.clientActions||'';state.clientActionMode='menu';state.clientActionLink='';render();}));
  document.querySelectorAll('[data-client-service-detail]').forEach(btn=>btn.addEventListener('click',()=>{state.clientActionKey=btn.dataset.clientServiceDetail||'';state.clientActionMode='detail';state.clientActionLink='';render();}));
  document.querySelectorAll('[data-client-add-service]').forEach(btn=>btn.addEventListener('click',()=>{const row=findRowByKey(btn.dataset.clientAddService);if(row)addServiceForRow(row);}));
  document.querySelectorAll('.bottom-sheet').forEach(sheet=>sheet.addEventListener('click',e=>e.stopPropagation()));
  document.querySelector('#closeClientActions')?.addEventListener('click',()=>{state.clientActionKey='';state.clientActionMode='menu';state.clientActionLink='';render();});
  document.querySelector('#closeClientActionsBtn')?.addEventListener('click',()=>{state.clientActionKey='';state.clientActionMode='menu';state.clientActionLink='';render();});
  document.querySelector('#clientActionBack')?.addEventListener('click',()=>{state.clientActionMode='menu';state.clientActionLink='';render();});
  document.querySelectorAll('[data-client-action]').forEach(btn=>btn.addEventListener('click',async()=>{ try {
    const action=btn.dataset.clientAction; const row=findRowByKey(state.clientActionKey); if(!row)return;
    if(action==='renew'||action==='charge'){state.clientActionKey='';state.clientActionMode='menu';openRenewForRow(row);return;}
    if(action==='add-service'){addServiceForRow(row);return;}
    if(action==='edit'){openCrmForRow(row);return;}
    if(action==='ficha'){const text=traditionalFichaForRow(row);state.clientActionKey='';state.clientActionMode='menu';requestWhatsApp(text);return;}
    if(action==='url'){await openClientUrlVariants(row);return;}
    if(action==='no-renew'){const key=state.clientActionKey;state.clientActionKey='';state.clientActionMode='menu';render();await handleNoRenew(key);}
  } catch (e) { console.error(e); showToast(e?.message||'No se pudo completar la acción.'); } }));
  document.querySelectorAll('[data-client-svc]').forEach(btn=>btn.addEventListener('click',()=>{state.clientActionKey=btn.dataset.clientSvc;state.clientActionMode='menu';render();}));
  document.querySelectorAll('[data-client-url-variant]').forEach(btn=>btn.addEventListener('click',()=>{state.clientActionUrlVariant=Number(btn.dataset.clientUrlVariant)||0;render();}));
  document.querySelector('#clientCopyUrlMessage')?.addEventListener('click',async()=>{const text=String(document.querySelector('#clientUrlMessage')?.value||'');try{await navigator.clipboard.writeText(text);showToast('Mensaje URL copiado.');}catch(_){showToast('No se pudo copiar el mensaje.');}});
  document.querySelector('#clientOpenUrlWhatsApp')?.addEventListener('click',()=>requestWhatsApp(String(document.querySelector('#clientUrlMessage')?.value||'')));

  const crmFormEl=document.querySelector('#crmForm');
  // Sincroniza en vivo: cualquier re-render (avisos, variantes, catálogo) ya no borra lo que se estaba escribiendo.
  const crmLiveSync=()=>{if(state.active==='nuevo-crm'&&document.querySelector('#crmForm'))state.crmDraft=readCrmDraftFromDom();};
  crmFormEl?.addEventListener('input',crmLiveSync); crmFormEl?.addEventListener('change',crmLiveSync);
  const crmPlatform=document.querySelector('#crmPlataforma');
  crmPlatform?.addEventListener('change',()=>crmSetPlatform(crmPlatform.value));
  syncCrmRequirementVisibility();
  document.querySelector('#crmVendedor')?.addEventListener('change',e=>{const v=e.target.value;const box=document.querySelector('#crmVendedorNuevoBox');if(box)box.hidden=v!=='__nuevo__';const telBox=document.querySelector('#crmVendedorTelefonoBox');const tel=document.querySelector('#crmVendedorTelefono');if(v!=='__nuevo__'){const phone=sellerPhone(v);if(phone&&tel)tel.value=phone;if(telBox)telBox.hidden=!!phone;const price=document.querySelector('#crmPrecio');if(price){const plat=document.querySelector('#crmPlataforma')?.value||'';const dev=document.querySelector('#crmTvDispositivos')?.value||crmAllowedDevices(plat)[0]||1;const next=crmDefaultPrice(crmStoredPlatform(plat,dev),v);if(next)price.value=String(next);}}else{if(telBox)telBox.hidden=false;document.querySelector('#crmVendedorNuevo')?.focus();}crmLiveSync();});
  document.querySelector('#crmBeneficiarioTipo')?.addEventListener('change',e=>{const box=document.querySelector('#crmBeneficiarioBox');if(box)box.hidden=e.target.value!=='tercero';if(e.target.value==='tercero')document.querySelector('#crmBeneficiarioNombre')?.focus();});
  document.querySelector('#crmMaxMode')?.addEventListener('change',e=>{ const d=readCrmDraftFromDom(); const v=e.target.value; if(v.startsWith('saved:')){ const c=maxPlayerSavedCreds(d.plataforma)[Number(v.slice(6))]; if(c){ d.maxPlayerUsuario=c.usuario; d.maxPlayerClave=c.clave; d.maxPlayerMode='saved'; } } else { d.maxPlayerMode='manual'; } d.fichaTexto=''; state.crmDraft=d; render(); });
  ['#crmMaxPlayer','#crmIptvProveedor'].concat(state.crmDraft&&crmIsIptvFamily(state.crmDraft.plataforma)?['#crmVisibilidadUrl']:[]).forEach(sel=>document.querySelector(sel)?.addEventListener('change',()=>{const d=readCrmDraftFromDom();d.fichaTexto='';state.crmDraft=d;render();}));
  document.querySelector('#crmVisibilidadUrl')?.addEventListener('change',e=>{const box=document.querySelector('#crmVisCustom');if(box)box.hidden=e.target.value!=='personalizado';});
  document.querySelector('#crmTvDispositivos')?.addEventListener('change',e=>{const price=document.querySelector('#crmPrecio');if(price){const plat=document.querySelector('#crmPlataforma')?.value||'';const seller=document.querySelector('#crmVendedor')?.value||'';const next=crmDefaultPrice(crmStoredPlatform(plat,e.target.value),seller);if(next)price.value=String(next);crmLiveSync();}});
  document.querySelector('#crmFecha')?.addEventListener('input',e=>{let v=e.target.value;if(/^\d{3,8}$/.test(v)){v=v.slice(0,2)+'/'+v.slice(2,4)+(v.length>4?'/'+v.slice(4):'');e.target.value=v;}const d=parseDateDMY(e.target.value);const day=document.querySelector('#crmDiaMes');if(day)day.value=d?String(d.getDate()).padStart(2,'0'):'';});
  document.querySelectorAll('[data-p-device]').forEach(sel=>sel.addEventListener('change',()=>syncCrmRequirementVisibility()));
  const previewEl=document.querySelector('#crmFichaTexto');
  previewEl?.addEventListener('input',()=>{previewEl.dataset.auto='0';});
  document.querySelectorAll('#crmForm input,#crmForm select').forEach(el=>el.addEventListener('input',()=>{if(!previewEl||previewEl.dataset.auto!=='1')return;const d=readCrmDraftFromDom();previewEl.value=crmFichaFromDraft(d);}));
  const variantEl=document.querySelector('#crmUrlVariantPreview');
  if(variantEl){const upd=()=>{const d=readCrmDraftFromDom();variantEl.innerHTML=crmWaBold(crmUrlMessage(d,d.savedLink||'🔗 (el enlace se genera al guardar el CRM)'));};document.querySelectorAll('#crmNombre,#crmBeneficiarioNombre').forEach(el=>el.addEventListener('input',upd));document.querySelector('#crmBeneficiarioTipo')?.addEventListener('change',upd);}
  document.querySelector('#crmFichaDetails')?.addEventListener('toggle',e=>{state.crmFichaOpen=e.target.open;});
  crmFormEl?.addEventListener('submit',async e=>{e.preventDefault();await saveCrm();});
  document.querySelector('#crmAddProfile')?.addEventListener('click',()=>{const d=readCrmDraftFromDom();d.perfiles.push({nombre:d.nombrePerfil,correo:'',clave:'',pinPerfil:'',dispositivo:'',esRoku:false});d.fichaTexto='';state.crmDraft=d;render();setTimeout(()=>{const rows=document.querySelectorAll('[data-crm-profile]');const input=rows[rows.length-1]?.querySelector('[data-p-name]');input?.scrollIntoView({block:'center',behavior:'smooth'});input?.focus();},60);});
  document.querySelector('#crmSearchClient')?.addEventListener('click',crmSearchClient);
  document.querySelector('#crmOpenCatalog')?.addEventListener('click',()=>{state.crmDraft=readCrmDraftFromDom();state.crmSheet='catalog';render();});
  document.querySelector('#crmSheetBackdrop')?.addEventListener('click',()=>{state.crmSheet='';render();});
  document.querySelector('#crmSheetCancel')?.addEventListener('click',()=>{state.crmSheet='';render();});
  document.querySelectorAll('[data-crm-pick-platform]').forEach(btn=>btn.addEventListener('click',()=>crmSetPlatform(btn.dataset.crmPickPlatform)));
  document.querySelector('#crmCatalogQuery')?.addEventListener('input',e=>{const q=crmNorm(e.target.value);document.querySelectorAll('#crmCatalogGrid [data-crm-pick-platform]').forEach(b=>{b.hidden=!!q&&!String(b.dataset.q||'').includes(q);});});
  const clientQ=document.querySelector('#crmClientQuery');
  if(clientQ){clientQ.addEventListener('input',()=>{state.crmClientQuery=clientQ.value;const box=document.querySelector('#crmClientResults');if(box)box.innerHTML=crmClientResultsHtml(clientQ.value);});setTimeout(()=>{clientQ.focus();const n=clientQ.value.length;clientQ.setSelectionRange?.(n,n);},60);}
  document.querySelector('#crmClientResults')?.addEventListener('click',e=>{const btn=e.target.closest('[data-crm-pick-client]');if(!btn)return;crmApplyClient((state.clients||[]).find(c=>String(c.id||'')===btn.dataset.crmPickClient));});
  document.querySelectorAll('[data-remove-crm-profile]').forEach(btn=>btn.addEventListener('click',()=>{const d=readCrmDraftFromDom();d.perfiles.splice(Number(btn.dataset.removeCrmProfile),1);if(!d.perfiles.length)d.perfiles=[{nombre:d.nombrePerfil,correo:'',clave:'',pinPerfil:'',dispositivo:'',esRoku:false}];d.fichaTexto='';state.crmDraft=d;render();}));
  document.querySelector('#crmNewFicha')?.addEventListener('click',()=>{if(window.confirm('¿Iniciar una ficha nueva? Los datos no guardados se perderán.')){state.crmUrlVariant=0;state.crmFichaOpen=false;state.crmDraft=crmDefaultDraft();render();window.scrollTo(0,0);}});
  document.querySelector('#crmAddService')?.addEventListener('click',async()=>{let d=readCrmDraftFromDom();if(!d.savedClientId&&!d.clienteId){const r=await saveCrm({delivery:'silent'});if(!r)return;d=state.crmDraft;}d={...crmDefaultDraft(),clienteId:d.savedClientId||d.clienteId,savedClientId:d.savedClientId||d.clienteId,nombrePerfil:d.nombrePerfil,telefono:d.telefono,vendedor:d.vendedor,vendedorTelefono:d.vendedorTelefono,beneficiarioTipo:d.beneficiarioTipo,beneficiarioNombre:d.beneficiarioNombre,savedLink:d.savedLink||'',savedBeneficiarioKey:d.savedBeneficiarioKey||'titular',forzarNuevoServicio:true};d.perfiles=[{nombre:crmBeneficiaryName(d),correo:'',clave:'',pinPerfil:'',dispositivo:'',esRoku:false}];state.crmDraft=d;state.crmFichaOpen=false;render();showToast('Cuenta anterior guardada. Registre la nueva cuenta del mismo cliente.');setTimeout(()=>document.querySelector('#crmPlataforma')?.closest('.crm2-card')?.scrollIntoView({block:'start',behavior:'smooth'}),80);});
  document.querySelector('#crmCopyFicha')?.addEventListener('click',async()=>{const d=readCrmDraftFromDom();state.crmDraft=d;await crmCopyText(d.fichaTexto.trim()||crmFichaFromDraft(d),'Ficha de la cuenta copiada.','No se pudo copiar la ficha.');});
  document.querySelector('#crmCopyLink')?.addEventListener('click',async()=>{const link=await crmEnsureLink();if(link)await crmCopyText(link,'Enlace copiado.','No se pudo copiar el enlace.');});
  document.querySelectorAll('[data-crm-url-variant]').forEach(btn=>btn.addEventListener('click',()=>{state.crmDraft=readCrmDraftFromDom();state.crmUrlVariant=Number(btn.dataset.crmUrlVariant)||0;render();}));
  document.querySelector('#crmCopyUrlVariant')?.addEventListener('click',async()=>{const link=await crmEnsureLink();if(!link)return;await crmCopyText(crmUrlMessage(crmDraft(),link),'Variante copiada.','No se pudo copiar la variante.');});
  document.querySelector('#crmOpenUrlVariant')?.addEventListener('click',async()=>{const link=await crmEnsureLink();if(!link)return;const d=crmDraft();requestWhatsApp(crmUrlMessage(d,link),d.telefono);});
  document.querySelector('#crmSubmit')?.addEventListener('click',()=>saveCrm({delivery:''}));
  document.querySelector('#crmDeliverTraditional')?.addEventListener('click',()=>saveCrm({delivery:'tradicional'}));
  document.querySelector('#crmDeliverUrl')?.addEventListener('click',()=>saveCrm({delivery:'url'}));

  document.querySelector('#clientSearch')?.addEventListener('input',e=>{state.search=e.target.value;refreshClientList();});
  document.querySelector('#backClients')?.addEventListener('click',()=>{state.selectedClientId='';render();});
  document.querySelectorAll('[data-ticket-mode]').forEach(b=>b.addEventListener('click',()=>{state.ticketNoticeMode=b.dataset.ticketMode;render();}));
  document.querySelectorAll('[data-ticket-dest]').forEach(i=>i.addEventListener('change',()=>{const set=new Set(state.ticketNoticeDestinos);i.checked?set.add(i.dataset.ticketDest):set.delete(i.dataset.ticketDest);state.ticketNoticeDestinos=[...set];}));
  document.querySelectorAll('[data-ticket-photo-open]').forEach(b=>b.addEventListener('click',()=>document.querySelector(`[data-ticket-photo="${b.dataset.ticketPhotoOpen}"]`)?.click()));
  document.querySelectorAll('[data-ticket-photo]').forEach(i=>i.addEventListener('change',()=>{const f=i.files?.[0];if(!f)return;if(f.size>3*1024*1024){showToast('La imagen supera 3 MB.');return;}const reader=new FileReader();reader.onload=()=>{if(i.dataset.ticketPhoto==='notice')state.ticketNoticeImage=String(reader.result||'');else if(i.dataset.ticketPhoto==='reply')state.ticketReplyImage=String(reader.result||'');else state.ticketImage=String(reader.result||'');render();};reader.readAsDataURL(f);}));
  document.querySelectorAll('[data-ticket-photo-remove]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.ticketPhotoRemove==='notice')state.ticketNoticeImage='';else if(b.dataset.ticketPhotoRemove==='reply')state.ticketReplyImage='';else state.ticketImage='';render();}));
  document.querySelector('#ticketCreate')?.addEventListener('click',async()=>{const titulo=document.querySelector('#ticketTitle')?.value.trim(),detalle=document.querySelector('#ticketDetail')?.value.trim();if(!titulo||!detalle){showToast('Escriba título y detalle.');return;}try{const result=await ticketAction({accion:'crear',titulo,detalle,destino:document.querySelector('#ticketDest')?.value||'sublicuentas',prioridad:document.querySelector('#ticketPriority')?.value||'normal',seccion:'tickets',imagen:state.ticketImage||''});state.ticketImage='';state.ticketDraft={...state.ticketDraft,title:'',detail:''};state.tickets=null;state.ticketsLoaded=false;await ensureTickets();showToast(telegramToast(result,'Ticket guardado'));}catch(e){showToast(e.message);}});
  document.querySelector('#ticketSendNotice')?.addEventListener('click',async()=>{const titulo=document.querySelector('#ticketNoticeTitle')?.value.trim(),detalle=document.querySelector('#ticketNoticeDetail')?.value.trim(),rows=ticketRecipientRows(),destinos=state.ticketNoticeMode==='all'?rows.map(r=>r.key):state.ticketNoticeDestinos;if(!titulo||!detalle){showToast('Escriba título y contenido del aviso.');return;}if(!destinos.length){showToast('Seleccione destinatarios.');return;}try{const result=await ticketAction({accion:'crear',tipo:'aviso',titulo:`AVISO · ${titulo}`,detalle,prioridad:'alta',seccion:'avisos',destino:state.ticketNoticeMode==='all'?'todos':destinos[0],destinos,destinosLabel:destinos.map(k=>rows.find(r=>r.key===k)?.label||k).join(' + '),imagen:state.ticketNoticeImage||''});state.ticketNoticeImage='';state.ticketDraft={...state.ticketDraft,ntitle:'',ndetail:''};state.tickets=null;state.ticketsLoaded=false;await ensureTickets();if(result?.telegramOk===false&&result?.id&&telegramShouldAutoRetry(result.telegramInfo)){const retry=await ticketAction({accion:'reenviar_telegram',id:result.id}).catch(()=>null);state.tickets=null;state.ticketsLoaded=false;await ensureTickets();showToast(retry?telegramToast(retry,'Aviso guardado'):telegramToast(result,'Aviso guardado'));}else showToast(telegramToast(result,'Aviso guardado'));}catch(e){showToast(e.message);}});
  document.querySelectorAll('[data-ticket-retry-telegram]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{const result=await ticketAction({accion:'reenviar_telegram',id:b.dataset.ticketRetryTelegram});state.tickets=null;state.ticketsLoaded=false;await ensureTickets();showToast(result?.telegramOk===true?telegramToast(result,'Telegram'):`Telegram no enviado: ${telegramSummary(result?.telegramInfo)}.`);}catch(e){showToast(e?.message||'No se pudo reenviar a Telegram.');}}));
  document.querySelectorAll('[data-ticket-reply]').forEach(b=>b.addEventListener('click',()=>{state.ticketReplyFor=b.dataset.ticketReply;state.ticketReplyImage='';state.ticketReplyText='';render();}));
  document.querySelector('#ticketReplyText')?.addEventListener('input',e=>{state.ticketReplyText=e.target.value;});
  document.querySelectorAll('[data-ticket-send]').forEach(b=>b.addEventListener('click',async()=>{const respuesta=(document.querySelector('#ticketReplyText')?.value||state.ticketReplyText||'').trim();if(!respuesta&&!state.ticketReplyImage){showToast('Escriba respuesta o adjunte foto.');return;}b.disabled=true;b.textContent='Enviando…';try{const result=await ticketAction({accion:'responder',id:b.dataset.ticketSend,respuesta,imagen:state.ticketReplyImage||''});state.ticketReplyFor='';state.ticketReplyImage='';state.ticketReplyText='';showToast(telegramToast(result,'Respuesta enviada'));state.ticketsLoaded=false;await ensureTickets(true);}catch(e){b.disabled=false;b.textContent='Enviar respuesta';showToast(e?.message||'No se pudo enviar la respuesta.');}}));
  document.querySelectorAll('[data-ticket-process]').forEach(b=>b.addEventListener('click',async()=>{try{await ticketAction({accion:'proceso',id:b.dataset.ticketProcess});state.tickets=null;state.ticketsLoaded=false;await ensureTickets();}catch(e){showToast(e.message);}}));
  document.querySelectorAll('[data-ticket-resolve]').forEach(b=>b.addEventListener('click',async()=>{const resolucion=prompt('¿Cómo se resolvió?');if(!resolucion?.trim())return;try{await ticketAction({accion:'resolver',id:b.dataset.ticketResolve,resolucion:resolucion.trim()});state.tickets=null;state.ticketsLoaded=false;await ensureTickets();}catch(e){showToast(e.message);}}));
  document.querySelectorAll('[data-ticket-delete]').forEach(b=>b.addEventListener('click',async()=>{if(!window.confirm('¿Eliminar este aviso? No se puede deshacer.'))return;try{await deleteTicket(b.dataset.ticketDelete);state.tickets=null;state.ticketsLoaded=false;await ensureTickets();showToast('Aviso eliminado.');}catch(e){showToast(e.message||'No se pudo eliminar el aviso.');}}));
  document.querySelector('#backMore')?.addEventListener('click',()=>{if(state.subview==='materia'&&state.juegos.screen==='game'){juegosQuit();return;}if(!state.subview&&['perfil','tickets','catalogo','nuevo-crm'].includes(state.active)){if(state.active==='perfil'&&state.profileEditing){state.profileEditing=false;state.profileAvatarDraft='';render();return;}state.active=(state.backTo&&state.backTo!==state.active)?state.backTo:(state.active==='nuevo-crm'?'clientes':'inicio');state.backTo='';render();return;}if(state.subview==='aula'&&state.academiaSettings){state.academiaSettings=false;state.aulaDraft=null;render();return;}if(state.subview==='aula'&&state.academiaLesson!=null){state.academiaLesson=null;render();return;}state.subview=null;state.profileEditing=false;state.profileAvatarDraft='';render();});
  document.querySelectorAll('[data-academia-cat]').forEach(b=>b.addEventListener('click',()=>{state.academiaCat=b.dataset.academiaCat;render();}));
  document.querySelectorAll('[data-academia-open]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.academiaOpen);if(i>academiaUnlocked())return;state.academiaLesson=i;state.academiaSel={};render();}));
  document.querySelectorAll('[data-academia-answer]').forEach(b=>b.addEventListener('click',()=>{const [key,oi]=b.dataset.academiaAnswer.split(':');if(state.academiaSel[key]!=null)return;state.academiaSel[key]=Number(oi);render();}));
  document.querySelectorAll('[data-fin-period]').forEach(b=>b.addEventListener('click',()=>{state.finPeriod=b.dataset.finPeriod;state.finShown=60;render();}));
  document.querySelector('#finApplyRange')?.addEventListener('click',()=>{state.finDesde=document.querySelector('#finDesde')?.value||'';state.finHasta=document.querySelector('#finHasta')?.value||'';state.finShown=60;render();});
  document.querySelectorAll('[data-fin-tipo]').forEach(b=>b.addEventListener('click',()=>{state.finTipo=b.dataset.finTipo;state.finShown=60;render();}));
  document.querySelector('#finMore')?.addEventListener('click',()=>{state.finShown+=60;render();});
  document.querySelector('#finXlsAll')?.addEventListener('click',()=>exportFinanceExcel('todo'));
  document.querySelector('#finXlsPeriod')?.addEventListener('click',()=>exportFinanceExcel('periodo'));
  document.querySelector('#finEgSave')?.addEventListener('click',async()=>{const motivo=document.querySelector('#finEgMotivo')?.value.trim()||'',monto=Number(document.querySelector('#finEgMonto')?.value||0),banco=document.querySelector('#finEgBanco')?.value.trim()||'',fecha=document.querySelector('#finEgFecha')?.value||'';if(!motivo||!monto){showToast('Ponga motivo y monto.');return;}const btn=document.querySelector('#finEgSave');btn.disabled=true;btn.textContent='Guardando…';try{await registerFinanceExpense({motivo,monto,banco,fecha});showToast('Egreso guardado.');await loadCoreData({force:true});}catch(e){showToast(e?.message||'No se pudo guardar el egreso.');btn.disabled=false;btn.textContent='Guardar egreso';}});
  document.querySelector('#finCierreSave')?.addEventListener('click',async()=>{const week=weekRange(new Date());const t=totalsOf(filterMovs(financeParsed(),{desde:week.start,hasta:week.end}));const btn=document.querySelector('#finCierreSave');btn.disabled=true;btn.textContent='Guardando…';try{await saveFinanceClosing({fechaInicio:isoDay(week.start),fechaFin:isoDay(week.end),ingresos:t.ing,egresos:t.egr,neto:t.neto});showToast('Cierre semanal guardado.');}catch(e){showToast(e?.message||'No se pudo guardar el cierre.');}btn.disabled=false;btn.textContent='Guardar cierre de la semana';});
  document.querySelector('#aulaSettings')?.addEventListener('click',()=>{state.academiaSettings=true;state.aulaDraft={avatar:state.academiaAvatar ?? aulaDefaultAvatar(state.session?.usuario),mascot:state.academiaMascot ?? 0};render();});
  document.querySelector('#aulaSettings2')?.addEventListener('click',()=>document.querySelector('#aulaSettings')?.click());
  document.querySelector('#aulaGoHome')?.addEventListener('click',()=>{state.active='inicio';state.subview=null;state.academiaLesson=null;render();});
  document.querySelector('#aulaBackRoute')?.addEventListener('click',()=>{state.academiaLesson=null;render();});
  document.querySelector('#aulaRetry')?.addEventListener('click',()=>{state.academia=null;delete state.errors.academia;render();ensureAcademia();});
  document.querySelector('#aulaSettingsBack')?.addEventListener('click',()=>{state.academiaSettings=false;state.aulaDraft=null;render();});
  document.querySelectorAll('[data-aula-avatar]').forEach(b=>b.addEventListener('click',()=>{state.aulaDraft={...(state.aulaDraft||{}),avatar:Number(b.dataset.aulaAvatar)};render();}));
  document.querySelectorAll('[data-aula-mascot]').forEach(b=>b.addEventListener('click',()=>{state.aulaDraft={...(state.aulaDraft||{}),mascot:Number(b.dataset.aulaMascot)};render();}));
  document.querySelector('#aulaSaveSettings')?.addEventListener('click',async()=>{const d=state.aulaDraft||{};state.aulaSaving=true;render();try{const r=await saveAcademiaSettings(d.avatar ?? aulaDefaultAvatar(state.session?.usuario),d.mascot ?? 0);state.academiaAvatar=r.avatar;state.academiaMascot=r.mascot;state.academiaSettings=false;state.aulaDraft=null;showToast('Ajustes guardados');}catch(e){showToast(e?.message||'No se pudieron guardar los ajustes.');}state.aulaSaving=false;render();});
  document.querySelectorAll('[data-aula-wave]').forEach(el=>el.addEventListener('click',()=>{el.classList.remove('wave');void el.offsetWidth;el.classList.add('wave');}));
  document.querySelector('#ticketsRefresh')?.addEventListener('click',()=>ensureTickets(true));
  document.querySelector('#ticketsRetry')?.addEventListener('click',()=>{delete state.errors.tickets;state.ticketsLoaded=false;state.tickets=null;render();});
  document.querySelector('#renewSellerFilter')?.addEventListener('change',e=>{state.renewSeller=e.target.value;render();});
  document.querySelector('#movieForm')?.addEventListener('submit',async e=>{e.preventDefault();const q=document.querySelector('#movieQuery')?.value.trim()||'';state.movieQuery=q;if(!q){showToast('Escriba una película o serie.');return;}state.movieLoading=true;state.movieError='';render();try{const data=await searchMovies(q);if(data?.error)throw new Error(data.error);state.movieResults=Array.isArray(data?.resultados)?data.resultados:[];}catch(err){state.movieError=err?.message||'No se pudo buscar.';state.movieResults=null;}state.movieLoading=false;render();});
  document.querySelectorAll('[data-match-mode]').forEach(b=>b.addEventListener('click',()=>loadMatchesFor(b.dataset.matchMode)));
  document.querySelector('#matchForm')?.addEventListener('submit',e=>{e.preventDefault();const q=document.querySelector('#matchQuery')?.value.trim()||'';if(!q){showToast('Escriba el nombre de un equipo.');return;}loadMatchesFor('equipo',q);});
  document.querySelector('#subliForm')?.addEventListener('submit',e=>{e.preventDefault();sendSubli(document.querySelector('#subliInput')?.value||'');});
  document.querySelectorAll('[data-subli-suggest]').forEach(b=>b.addEventListener('click',()=>sendSubli(b.dataset.subliSuggest)));
  { const last=document.querySelector('.subli-msgs .sb-msg:last-child'); if(last&&state.subview==='subli'&&state.subliMessages.length)last.scrollIntoView({block:'end'}); }
  document.querySelectorAll('[data-subli-cat]').forEach(b=>b.addEventListener('click',()=>{state.subliCat=state.subliCat===b.dataset.subliCat?'':b.dataset.subliCat;state.subliSugOffset=0;render();}));
  document.querySelectorAll('[data-sr-tab]').forEach(b=>b.addEventListener('click',()=>{state.rafflesTab=b.dataset.srTab;render();}));
  document.querySelector('#rafflesRefresh')?.addEventListener('click',()=>raffleRun('Actualizando…',async()=>{await reloadRaffles();setRaffleStatus('');}));
  document.querySelector('#rafflesRetry')?.addEventListener('click',()=>{delete state.errors.raffles;state.raffles=null;render();ensureRaffles(true);});
  document.querySelector('#srNewDraw')?.addEventListener('click',()=>openDrawSheet(''));
  document.querySelectorAll('[data-sr-menu]').forEach(b=>b.addEventListener('click',()=>openDrawMenu(b.dataset.srMenu)));
  document.querySelector('#srNewPrize')?.addEventListener('click',()=>openPrizeSheet(''));
  document.querySelector('#srPrepareVip')?.addEventListener('click',raffleVip);
  document.querySelectorAll('[data-sr-edit-draw]').forEach(b=>b.addEventListener('click',()=>openDrawSheet(b.dataset.srEditDraw)));
  document.querySelectorAll('[data-sr-edit-prize]').forEach(b=>b.addEventListener('click',()=>openPrizeSheet(b.dataset.srEditPrize)));
  document.querySelectorAll('[data-sr-delete-prize]').forEach(b=>b.addEventListener('click',()=>raffleDeletePrize(b.dataset.srDeletePrize)));
  document.querySelectorAll('[data-sr-tickets]').forEach(b=>b.addEventListener('click',()=>openTicketsSheet(b.dataset.srTickets)));
  document.querySelectorAll('[data-sr-spin]').forEach(b=>b.addEventListener('click',()=>openWheelSheet(b.dataset.srSpin)));
  document.querySelectorAll('[data-sr-close]').forEach(b=>b.addEventListener('click',()=>raffleClose(b.dataset.srClose)));
  document.querySelectorAll('[data-sr-delete]').forEach(b=>b.addEventListener('click',()=>raffleDelete(b.dataset.srDelete)));
  document.querySelectorAll('[data-sr-backfill]').forEach(b=>b.addEventListener('click',()=>raffleBackfill(b.dataset.srBackfill)));
  document.querySelectorAll('[data-sr-audit]').forEach(b=>b.addEventListener('click',()=>raffleAudit(b.dataset.srAudit)));
  document.querySelectorAll('[data-sr-deliver]').forEach(b=>b.addEventListener('click',()=>raffleDeliver(b.dataset.srDeliver)));
  document.querySelectorAll('[data-tk-tab]').forEach(b=>b.addEventListener('click',()=>{state.ticketsTab=b.dataset.tkTab;state.ticketQuery='';state.ticketStatusFilter='';state.ticketFiltersOpen=false;render();}));
  document.querySelector('#ticketSearch')?.addEventListener('input',e=>{state.ticketQuery=e.target.value;const pos=e.target.selectionStart;render();const i=document.querySelector('#ticketSearch');i?.focus();i?.setSelectionRange(pos,pos);});
  document.querySelector('#ticketFilterBtn')?.addEventListener('click',()=>{state.ticketFiltersOpen=!state.ticketFiltersOpen;render();});
  document.querySelectorAll('[data-tk-status]').forEach(b=>b.addEventListener('click',()=>{state.ticketStatusFilter=b.dataset.tkStatus;render();}));
  document.querySelector('#ticketHistoryToggle')?.addEventListener('click',()=>{state.ticketHistoryOpen=!state.ticketHistoryOpen;render();});
  document.querySelectorAll('[data-tk-toggle]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.tkToggle;state.ticketExpanded={...state.ticketExpanded,[id]:!state.ticketExpanded[id]};render();}));
  document.querySelectorAll('[data-tk-thread]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.tkThread;state.ticketThreadOpen={...state.ticketThreadOpen,[id]:!state.ticketThreadOpen[id]};render();}));
  document.querySelector('#invSearch')?.addEventListener('input',e=>{state.invQuery=e.target.value;const pos=e.target.selectionStart;render();const i=document.querySelector('#invSearch');i?.focus();i?.setSelectionRange(pos,pos);});
  document.querySelectorAll('[data-inv-plat]').forEach(b=>b.addEventListener('click',()=>{state.invPlat=b.dataset.invPlat;render();}));
  document.querySelector('#invSort')?.addEventListener('change',e=>{state.invSort=e.target.value;render();});
  document.querySelector('#invFilterBtn')?.addEventListener('click',()=>{state.invFiltersOpen=!state.invFiltersOpen;render();});
  document.querySelectorAll('[data-inv-cupo]').forEach(b=>b.addEventListener('click',()=>{state.invCupo=b.dataset.invCupo;render();}));
  document.querySelectorAll('[data-inv-open]').forEach(b=>b.addEventListener('click',()=>openInventoryDetail(b.dataset.invOpen)));
  // ───────── Juegos PRO (Materia cerebral) ─────────
  document.querySelectorAll('[data-jg-open]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.jgOpen)juegosStart(b.dataset.jgOpen);}));
  document.querySelector('#jgOpenRanking')?.addEventListener('click',()=>{state.juegos.screen='ranking';juegosLoadRanking(state.juegos.rankingScope||'general');});
  document.querySelector('#jgRankBack')?.addEventListener('click',()=>{state.juegos.screen='ranking';juegosLoadRanking(state.juegos.rankingScope||'general');});
  document.querySelectorAll('[data-jg-scope]').forEach(b=>b.addEventListener('click',()=>juegosLoadRanking(b.dataset.jgScope,!!state.juegos.rankingError)));
  document.querySelector('#jgRetry')?.addEventListener('click',()=>ensureJuegosResumen(true));
  document.querySelectorAll('[data-jg-rankgame]').forEach(b=>b.addEventListener('click',()=>{state.juegos.rankGame=b.dataset.jgRankgame;juegosLoadRanking('porJuego');}));
  document.querySelectorAll('[data-jg-play]').forEach(b=>b.addEventListener('click',()=>juegosStart(b.dataset.jgPlay)));
  document.querySelector('#jgGoHub')?.addEventListener('click',()=>{state.juegos.screen='hub';render();});
  document.querySelector('#jgQuit')?.addEventListener('click',()=>{if(state.juegos.gameCode==='BASKETBALL'){const j=state.juegos;if(j.engine&&j.engine.status==='PLAYING'){j.engine=bqPause(j.engine);bqPersist(j.engine);}juegosQuit();return;}if(state.juegos.gameCode==='HANGMAN'&&state.juegos.engine){const j=state.juegos;j.engine=pauseHang(j.engine);hgPersist(j.engine);juegosQuit();return;}if(state.juegos.gameCode==='WORD_SEARCH'&&state.juegos.engine){const j=state.juegos;j.engine=sopaPause(j.engine);sopaPersist(j.engine);juegosQuit();return;}if(state.juegos.screen==='game'&&state.juegos.engine&&!state.juegos.engine.finishedAt&&!(state.juegos.gameCode==='MEMORY_PAIRS'&&['READY','COMPLETED','TIMEOUT'].includes(state.juegos.engine.status))&&!state.juegos.timeUp&&!state.juegos.result){if(!confirm('¿Salir de la partida? Se perderá el progreso sin puntos.'))return;}juegosQuit();});
  if (state.subview==='materia'&&state.juegos.screen==='game'&&state.juegos.gameCode==='WORD_SEARCH'&&state.juegos.engine) {
    const j=state.juegos, n=j.engine.gridSize;
    attachSopaControls({ size:n, isBlocked:()=>state.juegos.engine?.status!=='playing', onCells:cells=>{
      const {round,result}=sopaResolve(state.juegos.engine,cells); const jj=state.juegos; jj.engine=round;
      if(result.type==='hit'){ jj.sopaMsg=`✅ ¡${result.word}! +20`; try{navigator.vibrate?.(30);}catch(_){} sopaPersist(round); render(); if(round.status==='completed')setTimeout(()=>juegosFinish(),250); }
      else if(result.type==='miss'){ const m=document.getElementById('sopaMsg'); if(m){m.textContent='Esa no es una de las palabras. Intente de nuevo.';} }
    }});
    document.querySelector('#sopaPause')?.addEventListener('click',()=>{j.engine=j.engine.status==='paused'?sopaResume(j.engine):sopaPause(j.engine);sopaPersist(j.engine);render();});
    document.querySelector('#sopaResume')?.addEventListener('click',()=>{j.engine=sopaResume(j.engine);sopaPersist(j.engine);render();});
    document.querySelector('#sopaHint')?.addEventListener('click',()=>{if(j.engine.status!=='playing')return;j.engine=sopaHint(j.engine);j.sopaMsg=`💡 Pista: la letra marcada es el inicio de una palabra (−10 SP de la ronda).`;sopaPersist(j.engine);render();});
    document.querySelector('#sopaLevel')?.addEventListener('click',()=>{j.sopaMenu=!j.sopaMenu;render();});
    document.querySelectorAll('[data-sopa-level]').forEach(b=>b.addEventListener('click',()=>{const lvl=b.dataset.sopaLevel;const active=j.engine.status!=='completed'&&j.engine.foundWordIds.length>0;if(active&&!confirm('¿Cambiar de nivel? La ronda actual se abandona sin SP.'))return;j.sopaLevel=lvl;j.sopaMenu=false;j.sopaMsg='';j.engine=sopaOpenRound(lvl);render();}));
    document.querySelector('#sopaNew')?.addEventListener('click',()=>{const active=j.engine.status!=='completed'&&j.engine.foundWordIds.length>0;if(active&&!confirm('¿Empezar una ronda nueva? La actual se abandona sin SP.'))return;if(j.engine.status==='completed'&&!j.engine.submitted&&!confirm('Esta ronda aún no guardó sus SP. ¿Descartarla?'))return;j.sopaMsg='';j.engine=sopaOpenRound(j.sopaLevel||j.engine.levelId);render();});
    document.querySelector('#sopaSubmit')?.addEventListener('click',()=>{j.result=null;juegosFinish();});
  }
  document.querySelector('#jgPause')?.addEventListener('click',()=>{const j=state.juegos;j.paused=!j.paused;if(j.paused){j.pausedRemaining=j.deadlineAt-Date.now();}else{j.deadlineAt=Date.now()+Math.max(0,j.pausedRemaining);}render();});
  document.querySelector('#jgRestart')?.addEventListener('click',()=>{if(state.juegos.gameCode)juegosStart(state.juegos.gameCode);});
  document.querySelector('#jgFinish')?.addEventListener('click',()=>{const j=state.juegos;if(j.gameCode==='COLOR_CHALLENGE'&&j.engine&&!j.engine.finishedAt)j.engine=colorFinishNow(j.engine);juegosFinish();});
  const jgAngle=document.querySelector('#jgAngle'), jgPower=document.querySelector('#jgPower');
  const bkAim=()=>{const aim=document.querySelector('#jgBkAim');if(!aim||!jgAngle||!jgPower)return;const a=Number(jgAngle.value)*Math.PI/180,L=22+Number(jgPower.value)*0.55;const x1=Number(aim.getAttribute('x1')),y1=Number(aim.getAttribute('y1'));aim.setAttribute('x2',String(x1+L*Math.cos(a)));aim.setAttribute('y2',String(y1-L*Math.sin(a)));};
  jgAngle?.addEventListener('input',()=>{const v=document.querySelector('#jgAngleVal');if(v)v.textContent=`${jgAngle.value}°`;if(state.juegos.engine)state.juegos.engine.angle=Number(jgAngle.value);bkAim();});
  jgPower?.addEventListener('input',()=>{const v=document.querySelector('#jgPowerVal');if(v)v.textContent=jgPower.value;if(state.juegos.engine)state.juegos.engine.power=Number(jgPower.value);bkAim();});
  document.querySelector('#jgShoot')?.addEventListener('click',()=>{const j=state.juegos;if(!j.engine||j.paused||j.timeUp)return;j.engine=basketballShoot(j.engine,Number(jgAngle?.value||j.engine.angle),Number(jgPower?.value||j.engine.power));render();});
  if (state.subview==='materia'&&state.juegos.screen==='game'&&state.juegos.gameCode==='DARTS'&&state.juegos.engine&&!state.juegos.result) {
    attachDartsControls({
      isBlocked:()=>state.juegos.paused||state.juegos.engine?.status!=='PLAYING',
      onInvalid:()=>{const h=document.getElementById('dtHint');if(h){h.textContent='Lance hacia ARRIBA y con más fuerza: deslice rápido y suelte.';h.classList.add('warn');}},
      onHit:hit=>{const j=state.juegos;if(!j.engine||j.engine.status!=='PLAYING')return;const before=j.engine;j.engine=dartsApplyHit(j.engine,hit);const e=j.engine;
        const turnEnded=e.status==='PLAYING'&&e.currentTurnThrows.length===0;
        j.dartsMsg=e.lastBust?`¡Bust! Se pasó (${hit.score}). Vuelve a ${e.players[0].remaining}.`:hit.zone==='MISS'?'Fuera del tablero. Controle la fuerza del gesto.':e.status==='FINISHED'?'':turnEnded?`Fin del turno · Ronda ${e.round}`:`${dartsHitLabel(hit)} · ${e.dartsLeft===1?'le queda 1 dardo':`le quedan ${e.dartsLeft} dardos`} en este turno`;
        if(turnEnded){e._showPrevUntil=Date.now()+1100;setTimeout(()=>{if(state.juegos.engine===e)render();},1150);}
        render();}
    });
  }
  document.querySelectorAll('[data-jg-color]').forEach(b=>b.addEventListener('click',()=>{const j=state.juegos;if(!j.engine)return;j.engine=colorPick(j.engine,b.dataset.jgColor);document.querySelectorAll('[data-jg-color]').forEach(x=>x.classList.toggle('on',x===b));}));
  document.querySelectorAll('[data-jg-region]').forEach(r=>r.addEventListener('click',()=>{const j=state.juegos;if(!j.engine||j.paused||j.timeUp)return;j.engine=colorFill(j.engine,Number(r.dataset.jgRegion));render();}));
  document.querySelector('#jgNextDesign')?.addEventListener('click',()=>{const j=state.juegos;j.colorDesign=((Number(j.colorDesign)||0)+1)%COLOR_DESIGNS.length;juegosStart('COLOR_CHALLENGE');});
  document.querySelector('#jgHint')?.addEventListener('click',()=>{const j=state.juegos;if(!j.engine||j.paused)return;j.engine=j.gameCode==='HANGMAN'?hangmanHint(j.engine):j.gameCode==='WORD_SEARCH'?wordSearchHint(j.engine):j.engine;render();});
  if (state.subview==='materia'&&state.juegos.screen==='game'&&state.juegos.gameCode==='BASKETBALL') {
    const j=state.juegos, u=bqUser();
    document.querySelectorAll('[data-bq-char]').forEach(b=>b.addEventListener('click',()=>{ j.bqChar=b.dataset.bqChar; bqSetCharacter(u,j.bqChar); render(); }));
    document.querySelector('#bqStart')?.addEventListener('click',()=>{ j.bqStage='play'; j.bqFlying=false; bqUpdate(createBasketGame(u,j.bqChar||'boy_2')); });
    const ang=document.querySelector('#bqAngle'), pow=document.querySelector('#bqPower');
    const guide=()=>{ const el=document.getElementById('bqGuide'); if(!el||!j.engine)return; const sx=0.12*360, sy=0.78*220, a=j.engine.currentAngle*Math.PI/180, L=20+j.engine.currentPower*0.45; el.setAttribute('points',[0,1,2,3,4,5].map(i=>{const xw=i*L/5;return `${(sx+xw).toFixed(1)},${(sy-xw*Math.tan(a)*0.9).toFixed(1)}`;}).join(' ')); };
    ang?.addEventListener('input',()=>{ j.engine=bqSetAngle(j.engine,Number(ang.value)); document.getElementById('bqAngleVal').textContent=`${j.engine.currentAngle} °`; ang.style.setProperty('--p',`${(j.engine.currentAngle-BQ.ANGLE_MIN)/(BQ.ANGLE_MAX-BQ.ANGLE_MIN)*100}%`); guide(); });
    pow?.addEventListener('input',()=>{ j.engine=bqSetPower(j.engine,Number(pow.value)); document.getElementById('bqPowerVal').textContent=String(j.engine.currentPower); pow.style.setProperty('--p',`${(j.engine.currentPower-BQ.POWER_MIN)/(BQ.POWER_MAX-BQ.POWER_MIN)*100}%`); guide(); });
    ang?.addEventListener('change',()=>bqPersist(j.engine)); pow?.addEventListener('change',()=>bqPersist(j.engine));
    document.querySelector('#bqShoot')?.addEventListener('click',bqShoot);
    document.querySelector('#bqPause')?.addEventListener('click',()=>bqUpdate(j.engine.paused?bqResume(j.engine):bqPause(j.engine)));
    document.querySelector('#bqResume')?.addEventListener('click',()=>bqUpdate(bqResume(j.engine)));
    document.querySelector('#bqRestart')?.addEventListener('click',()=>{ if(j.engine?.status==='PLAYING'&&j.engine.shotsTaken>0&&!confirm('¿Reiniciar? La partida actual se pierde sin SP.'))return; j.bqFlying=false; bqUpdate(createBasketGame(u,j.engine?.selectedCharacterId||j.bqChar)); });
    document.querySelector('#bqAgain')?.addEventListener('click',()=>{ j.bqFlying=false; bqUpdate(createBasketGame(u,j.engine?.selectedCharacterId||j.bqChar)); });
    document.querySelector('#bqChange')?.addEventListener('click',()=>{ if(j.engine&&!j.engine.submitted&&j.engine.shotsTaken>0&&!confirm('Esta partida aún no guardó sus SP. ¿Cambiar de jugador igual?'))return; bqClear(u); j.engine=null; j.bqStage='select'; render(); });
    document.querySelector('#bqSave')?.addEventListener('click',()=>{ j.result=null; juegosFinish(); });
    if (j.bqSlideFrom!=null && j.engine) { const hoop=document.getElementById('bqHoop'); const from=j.bqSlideFrom*360, to=j.engine.currentHoopX*360; j.bqSlideFrom=null; if(hoop&&Math.abs(from-to)>1&&typeof requestAnimationFrame==='function'){ hoop.style.transition='none'; hoop.style.transform=`translate(${to.toFixed(1)}px,0) translateX(${(from-to).toFixed(1)}px)`; requestAnimationFrame(()=>requestAnimationFrame(()=>{ hoop.style.transition='transform .6s cubic-bezier(.3,1.3,.5,1)'; hoop.style.transform=`translate(${to.toFixed(1)}px,0)`; })); } }
  }
  if (state.subview==='materia'&&state.juegos.screen==='game'&&state.juegos.gameCode==='HANGMAN'&&state.juegos.engine) {
    const j=state.juegos;
    document.querySelectorAll('[data-hg-key]').forEach(b=>b.addEventListener('click',()=>{ const before=j.engine; const g=hgPress(before,b.dataset.hgKey); if(g===before)return; const r0=hangRound(before), r1=hangRound(g); j.hgFlash=r1.wrongLetters.length>r0.wrongLetters.length?'shake':''; if(r1.status==='WON'){try{navigator.vibrate?.(30);}catch(_){}} hgUpdate(g); }));
    document.querySelector('#hgHint')?.addEventListener('click',()=>{ const {game,letter}=hgHint(j.engine); if(!letter)return; j.hgFlash='pop'; showToast(`💡 Pista: la letra ${letter}`); hgUpdate(game); });
    document.querySelector('#hgPause')?.addEventListener('click',()=>{ hgUpdate(j.engine.paused?resumeHang(j.engine):pauseHang(j.engine)); });
    document.querySelector('#hgResume')?.addEventListener('click',()=>hgUpdate(resumeHang(j.engine)));
    document.querySelector('#hgNext')?.addEventListener('click',()=>{ j.hgFlash=''; hgUpdate(hgNext(j.engine)); });
    document.querySelector('#hgAgain')?.addEventListener('click',()=>{ const g=hangmanNewGame({userId:hgUser(),recentIds:hangRecent(hgUser())}); hangRememberWords(hgUser(),g); j.hgFlash=''; hgUpdate(g); });
    document.querySelector('#hgSave')?.addEventListener('click',()=>{ const g=j.engine; if(g.submitted)return; if(g.status==='PLAYING'){ if(!confirm('¿Terminar la partida y guardar los SP ganados hasta ahora? Las rondas que faltan cuentan como perdidas.'))return; hgUpdate(hgFinish(g)); return; } j.result=null; juegosFinish(); });
    document.onkeydown=e=>{ if(state.juegos.gameCode!=='HANGMAN'||state.juegos.screen!=='game')return; const k=String(e.key||'').toUpperCase(); if(/^[A-ZÑ]$/.test(k))document.querySelector(`[data-hg-key="${k}"]`)?.click(); };
  }
  if (state.subview==='materia'&&state.juegos.screen==='game'&&state.juegos.gameCode==='MEMORY_PAIRS'&&state.juegos.engine) {
    const j=state.juegos;
    document.querySelectorAll('[data-mc-card]').forEach(b=>b.addEventListener('click',()=>{
      const before=j.engine; let g=memOpen(before,b.dataset.mcCard); if(g===before)return;
      const cfg=MEMORY_MODE_CONFIG[g.mode];
      if(g.selectedIds.length===2){ const r=memEval(g); g=r.state;
        if(r.result==='MATCH'){ j.memMsg='✅ ¡Par encontrado!'; try{navigator.vibrate?.(25);}catch(_){} j.engine=g; render();
          setTimeout(()=>{ const cur=state.juegos.engine; if(!cur||cur.gameId!==g.gameId)return; state.juegos.engine=memRemove(cur,r.matchedPairId); render(); if(state.juegos.engine.status==='COMPLETED')setTimeout(()=>juegosFinish(),200); },cfg.matchedRemoveMs+350);
          return; }
        j.memMsg='Casi… memoriza dónde estaban.'; j.engine=g; render();
        setTimeout(()=>{ const cur=state.juegos.engine; if(!cur||cur.gameId!==g.gameId)return; state.juegos.engine=memClose(cur); render(); },cfg.mismatchRevealMs);
        return; }
      j.engine=g; render();
    }));
    document.querySelectorAll('[data-mc-mode]').forEach(b=>b.addEventListener('click',()=>{const m=b.dataset.mcMode;if(m===j.engine.mode&&j.engine.status==='READY')return;if(j.engine.status==='PLAYING'&&j.engine.pairsFound>0&&!confirm('¿Cambiar de modo? La partida actual se pierde.'))return;j.memMode=m;juegosStart('MEMORY_PAIRS');}));
    document.querySelector('#mcPause')?.addEventListener('click',()=>{j.engine=j.engine.status==='PAUSED'?memResume(j.engine):memPause(j.engine);render();});
    document.querySelector('#mcResume')?.addEventListener('click',()=>{j.engine=memResume(j.engine);render();});
    document.querySelector('#mcAgain')?.addEventListener('click',()=>{if(!j.engine.submitted&&(j.engine.pairsFound>0)&&!confirm('Esta partida aún no guardó sus SP. ¿Jugar otra de todos modos?'))return;juegosStart('MEMORY_PAIRS');});
    document.querySelector('#mcSubmit')?.addEventListener('click',()=>{j.result=null;juegosFinish();});
  }
  document.querySelectorAll('[data-jg-letter]').forEach(b=>b.addEventListener('click',()=>{const j=state.juegos;if(!j.engine||j.paused||j.timeUp)return;j.engine=hangmanGuess(j.engine,b.dataset.jgLetter);render();}));
  document.querySelectorAll('[data-jg-cell]').forEach(b=>b.addEventListener('click',()=>{const j=state.juegos;if(!j.engine||j.paused||j.timeUp)return;const [r,c]=b.dataset.jgCell.split(',').map(Number);j.engine=wordSearchSelect(j.engine,r,c);render();}));
  { // ── Calculadora de venta: todo se recalcula en tiempo real; el estado guarda solo lo que elige la persona ──
    const cc=()=>effectiveCatalog(state.calcPrices,calcBase());
    const refocus=(sel,pos)=>{const i=document.querySelector(sel);i?.focus();try{i?.setSelectionRange(pos,pos);}catch(_){}};
    const calcRefresh=()=>{const t=computeTotals(state.calc,cc());const s=document.querySelector('#calcSummary');if(s)s.innerHTML=calcSummaryHtml(t);const hh=document.querySelector('#calcHints');if(hh)hh.innerHTML=calcHintsHtml(t);};
    document.querySelectorAll('[data-calc-mode]').forEach(b=>b.addEventListener('click',()=>{state.calc.mode=b.dataset.calcMode;render();}));
    document.querySelector('#calcSearch')?.addEventListener('input',e=>{state.calc.query=e.target.value;const p=e.target.selectionStart;render();refocus('#calcSearch',p);});
    document.querySelector('#calcShow')?.addEventListener('change',e=>{state.calc.show=e.target.value;render();});
    document.querySelectorAll('[data-calc-cat]').forEach(b=>b.addEventListener('click',()=>{state.calc.cat=b.dataset.calcCat;render();}));
    document.querySelector('#calcEdit')?.addEventListener('click',()=>{state.calc.editing=!state.calc.editing;render();});
    document.querySelectorAll('[data-calc-price]').forEach(i=>i.addEventListener('change',()=>{const a=parseAmount(i.value);if(!a.ok||a.value==null){showToast('Precio no válido.');render();return;}state.calcPrices=sanitizePrices({...state.calcPrices,[i.dataset.calcPrice]:a.value});saveCalcPrices(localStorage,state.calcPrices);render();showToast('Precio guardado.');}));
    document.querySelectorAll('[data-calc-add]').forEach(b=>b.addEventListener('click',()=>{calcAddCatalog(state.calc,b.dataset.calcAdd);render();}));
    document.querySelectorAll('[data-calc-minus]').forEach(b=>b.addEventListener('click',()=>{calcStep(state.calc,b.dataset.calcMinus,-1);render();}));
    document.querySelectorAll('[data-calc-plus]').forEach(b=>b.addEventListener('click',()=>{calcStep(state.calc,b.dataset.calcPlus,1);render();}));
    document.querySelectorAll('[data-calc-del]').forEach(b=>b.addEventListener('click',()=>{calcRemove(state.calc,b.dataset.calcDel);render();}));
    document.querySelectorAll('[data-calc-dmode]').forEach(b=>b.addEventListener('click',()=>{state.calc.discountMode=b.dataset.calcDmode;state.calc.discountValue='';render();}));
    document.querySelectorAll('[data-calc-quick]').forEach(b=>b.addEventListener('click',()=>{state.calc.discountValue=b.dataset.calcQuick;state.calc.finalPrice='';render();}));
    document.querySelector('#calcDiscount')?.addEventListener('input',e=>{state.calc.discountValue=e.target.value;calcRefresh();});
    document.querySelector('#calcFinal')?.addEventListener('input',e=>{const was=state.calc.finalPrice!=='';state.calc.finalPrice=e.target.value;if(was!==(e.target.value!=='')){const p=e.target.selectionStart;render();refocus('#calcFinal',p);}else calcRefresh();});
    document.querySelector('#calcManualName')?.addEventListener('input',e=>{state.calc.manualName=e.target.value;});
    document.querySelector('#calcManualPrice')?.addEventListener('input',e=>{state.calc.manualPrice=e.target.value;});
    document.querySelector('#calcManualAdd')?.addEventListener('click',()=>{const r=calcAddManual(state.calc,state.calc.manualName,state.calc.manualPrice);if(!r.ok){state.calc.manualError=r.error;render();return;}Object.assign(state.calc,{manualName:'',manualPrice:'',manualError:''});render();showToast('Producto agregado a la venta.');});
    document.querySelector('#calcUseSaved')?.addEventListener('click',()=>{state.calc.mode='catalog';render();});
    document.querySelector('#calcClear')?.addEventListener('click',()=>{Object.assign(state.calc,{items:[],nextUid:1,discountValue:'',finalPrice:'',manualName:'',manualPrice:'',manualError:''});render();showToast('Calculadora limpia.');});
    document.querySelector('#calcSave')?.addEventListener('click',async()=>{const t=computeTotals(state.calc,cc());if(!t.count)return;const text=quoteText(t);pushCalcHistory(localStorage,{at:Date.now(),total:t.total,text});try{await navigator.clipboard.writeText(text);showToast('Cotización copiada y guardada.');}catch(_){showToast('Cotización guardada (no se pudo copiar).');}});
  }
  document.querySelector('#moviesMenuBtn')?.addEventListener('click',()=>{state.moviesMenuOpen=!state.moviesMenuOpen;render();});
  document.querySelector('#moviesMenuClose')?.addEventListener('click',()=>{state.moviesMenuOpen=false;render();});
  document.querySelector('#movieClear')?.addEventListener('click',()=>{state.movieQuery='';state.movieResults=null;state.movieError='';state.moviesMenuOpen=false;render();});
  document.querySelector('#subliRefresh')?.addEventListener('click',()=>{state.subliSugOffset+=1;render();});
  document.querySelector('#subliMenuBtn')?.addEventListener('click',()=>{state.subliMenuOpen=!state.subliMenuOpen;render();});
  document.querySelector('#subliMenuClose')?.addEventListener('click',()=>{state.subliMenuOpen=false;render();});
  document.querySelector('#subliNewChat')?.addEventListener('click',()=>{state.subliMessages=[];state.subliCat='';state.subliSugOffset=0;state.subliMenuOpen=false;render();});
  document.querySelector('#subliCopyLast')?.addEventListener('click',async()=>{const last=[...state.subliMessages].reverse().find(m=>m.role==='bot'&&!m.error);state.subliMenuOpen=false;render();if(!last){showToast('Todavía no hay respuesta para copiar.');return;}try{await navigator.clipboard.writeText(mdToPlain(last.text));showToast('Respuesta copiada.');}catch(_){showToast('No se pudo copiar.');}});
  { const box=document.querySelector('#subliInput'); if(box){box.addEventListener('input',()=>{box.style.height='auto';box.style.height=`${Math.min(box.scrollHeight,112)}px`;});box.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendSubli(box.value);}});} }
  document.querySelector('#academiaComplete')?.addEventListener('click',()=>{if(state.academiaLesson!=null)academiaMarkComplete(state.academiaLesson);});
  document.querySelectorAll('#refreshData').forEach(b=>b.addEventListener('click',()=>refreshVisible()));
  document.querySelector('#editProfileBtn')?.addEventListener('click',()=>{state.profileEditing=true;state.profileAvatarDraft='';render();});
  document.querySelector('#cancelProfileEdit')?.addEventListener('click',()=>{state.profileEditing=false;state.profileAvatarDraft='';render();});
  document.querySelector('#profileAvatar')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;showToast('Preparando la foto…');try{state.profileAvatarDraft=await prepareAvatarImage(f);render();}catch(err){showToast(err?.message||'No se pudo preparar la foto.');}});
  document.querySelector('#saveProfileBtn')?.addEventListener('click',async()=>{const nombre=String(document.querySelector('#profileName')?.value||'').trim(),telefono=String(document.querySelector('#profilePhone')?.value||'').trim();if(!nombre){showToast('Escriba el nombre visible.');return;}try{const changes={nombre,telefono};if(state.profileAvatarDraft)changes.avatar=state.profileAvatarDraft;await saveProfile(state.session.usuario,changes);const fresh=await loadProfile(state.session.usuario);state.profile=fresh?.perfil||{...state.profile,...changes};state.profileEditing=false;state.profileAvatarDraft='';render();showToast('Perfil actualizado en Sublichat.');}catch(e){showToast(e?.message||'No se pudo guardar el perfil.');}});
  document.querySelector('#openWhatsApp')?.addEventListener('click',()=>requestWhatsApp(''));
  document.querySelector('#closeWhatsAppChooser')?.addEventListener('click',()=>{state.whatsappChooser=false;state.whatsappPickOnly=false;render();});
  document.querySelector('#cancelWhatsApp')?.addEventListener('click',()=>{state.whatsappChooser=false;state.whatsappPickOnly=false;render();});
  document.querySelectorAll('[data-whatsapp-package]').forEach(btn=>btn.addEventListener('click',()=>{
    const pkg=btn.dataset.whatsappPackage;
    if(state.whatsappPickOnly){ // elegido desde Perfil: solo se guarda la preferencia
      state.whatsappPickOnly=false; state.whatsappChooser=false;
      if(pkg==='ask'){localStorage.removeItem('sublicuentas-whatsapp-app');showToast('Listo. Se le preguntará cada vez qué WhatsApp abrir.');return;}
      localStorage.setItem('sublicuentas-whatsapp-app', pkg);
      showToast(pkg==='com.whatsapp.w4b'?'Listo. Cobros y fichas se abrirán en WhatsApp Business.':'Listo. Cobros y fichas se abrirán en WhatsApp normal.');
      return;
    }
    launchWhatsApp(pkg);
  }));

  const closeRenew=()=>{state.renewGroupKey='';state.renewSelection=[];state.renewMenu=false;state.renewCalOpen=false;render();};
  document.querySelector('#closeSheet')?.addEventListener('click',closeRenew);
  document.querySelector('#cancelRenew')?.addEventListener('click',closeRenew);
  document.querySelector('#renewBack')?.addEventListener('click',closeRenew);
  document.querySelector('#renewMenuBtn')?.addEventListener('click',()=>{state.renewMenu=!state.renewMenu;render();});
  document.querySelector('#renewChargeText')?.addEventListener('input',e=>{state.renewMessage=e.target.value;});
  const renewText=()=>String(document.querySelector('#renewChargeText')?.value||state.renewMessage||'');
  const renewRemember=text=>{state.renewMessageHistory=[...(state.renewMessageHistory||[]),text].slice(-6);};
  document.querySelector('#renewAnotherStyle')?.addEventListener('click',()=>{const g=renewChargeGroup();if(!g)return;const used=new Set([renewText(),...(state.renewMessageHistory||[])]);let next='';for(let tries=0;tries<8;tries++){state.renewMessageVariant=randomChargeVariant();next=buildChargeMessage(g,state.renewMessageVariant);if(!used.has(next))break;}state.renewMessage=next;renewRemember(next);render();});
  document.querySelector('#renewAiMessage')?.addEventListener('click',async()=>{const g=renewChargeGroup();if(!g)return;const current=renewText();const btn=document.querySelector('#renewAiMessage');if(btn){btn.disabled=true;btn.innerHTML='<span class="rn-emoji">⏳</span>Generando…';}try{const r=await generateChargeMessageAI(g,current,todayISO(),state.renewMessageHistory||[]);if(r?.error)throw new Error(r.error);const raw=String(r?.respuesta||r?.text||r?.response||'').trim();if(!raw||/^(No obtuve respuesta|Gemini cortó)/i.test(raw))throw new Error('la IA no devolvió texto');let next=normalizeChargeAiMessage(splitChargeAiLines(raw),g);const norm=t=>t.toLowerCase().replace(/\s+/g,' ').trim();const usedBefore=[current,...(state.renewMessageHistory||[])].map(norm);if(usedBefore.includes(norm(next))){state.renewMessageVariant=randomChargeVariant();next=buildChargeMessage(g,state.renewMessageVariant);}state.renewMessage=next;state.renewMessageHistory=[...(state.renewMessageHistory||[]),next].slice(-6);render();showToast('✨ Mensaje IA actualizado.');}catch(e){state.renewMessageVariant=randomChargeVariant();state.renewMessage=buildChargeMessage(g,state.renewMessageVariant);renewRemember(state.renewMessage);render();showToast(`IA no disponible (${String(e?.message||'sin respuesta').slice(0,80)}). Se aplicó otro estilo.`);}});
  const renewCopy=async()=>{try{await navigator.clipboard.writeText(renewText());showToast('Mensaje de cobro copiado.');}catch(_){showToast('No se pudo copiar el mensaje.');}};
  document.querySelector('#renewCopyMessage')?.addEventListener('click',renewCopy);
  document.querySelector('#renewCopyPill')?.addEventListener('click',renewCopy);
  document.querySelector('#renewOpenWhatsApp')?.addEventListener('click',()=>{const g=activeRenewGroup();const row=g?.servicios?.[0]||g?.serviciosCliente?.[0];requestWhatsApp(renewText(),g?.telefono||row?.telefono||'');});
  document.querySelector('#renewOpenCrm')?.addEventListener('click',()=>{const g=activeRenewGroup();const row=g?.servicios?.[0]||g?.serviciosCliente?.[0];state.renewMenu=false;openCrmForRow(row);});
  document.querySelector('#renewEditService')?.addEventListener('click',()=>{const g=activeRenewGroup();const row=g?.servicios?.[0]||g?.serviciosCliente?.[0];state.renewMenu=false;if(row)openCrmForRow(row);});
  document.querySelector('#toggleRenewManage')?.addEventListener('click',()=>{state.renewManage=!state.renewManage;state.renewMenu=false;render();});
  document.querySelectorAll('[data-renew-select]').forEach(box=>box.addEventListener('change',()=>{const set=new Set(state.renewSelection);if(box.checked)set.add(box.dataset.renewSelect);else set.delete(box.dataset.renewSelect);state.renewSelection=[...set];render();}));
  document.querySelectorAll('[data-edit-service]').forEach(btn=>btn.addEventListener('click',()=>openCrmForRow(allRows().find(r=>rowKey(r)===btn.dataset.editService))));
  document.querySelectorAll('[data-no-renew]').forEach(btn=>btn.addEventListener('click',()=>handleNoRenew(btn.dataset.noRenew)));
  document.querySelectorAll('[data-renew-days]').forEach(btn=>btn.addEventListener('click',()=>{state.renewMessage=renewText();state.renewPick={days:Number(btn.dataset.renewDays)};render();}));
  document.querySelectorAll('[data-renew-months]').forEach(btn=>btn.addEventListener('click',()=>{state.renewMessage=renewText();state.renewPick={months:Number(btn.dataset.renewMonths)};render();}));
  document.querySelector('#renewCalDetails')?.addEventListener('toggle',e=>{state.renewCalOpen=e.target.open;});
  document.querySelector('#renewExactDate')?.addEventListener('change',e=>{const iso=String(e.target.value||'');if(!iso)return;const [y,m,d]=iso.split('-');state.renewMessage=renewText();state.renewPick={exactDate:`${d}/${m}/${y}`};render();});
  document.querySelector('#renewApply')?.addEventListener('click',()=>handleRenewalOption(state.renewPick||{days:30}));
  document.querySelector('#renewNoRenewAll')?.addEventListener('click',handleNoRenewGroup);

  document.querySelector('#logoutBtn')?.addEventListener('click',()=>logoutNow());
  const sel=document.querySelector('#themeSelect');if(sel){sel.value=state.theme;sel.addEventListener('change',()=>{state.theme=sel.value;localStorage.setItem('sublicuentas-theme',state.theme);render();});}
  document.querySelector('#whatsappAppReset')?.addEventListener('click',()=>{state.whatsappPickOnly=true;state.whatsappChooser=true;render();});
}

async function handleNoRenew(key) {
  const row=allRows().find(r=>rowKey(r)===key);if(!row)return;
  if(!window.confirm(`¿Confirmar que ${row.plataforma} de ${row.nombre} no renovó? Solo se dará de baja ESTE servicio y se liberará su cupo. La ficha del cliente debe conservarse.`))return;
  try{const result=await removeNonRenewingService(row);if(!result?.ok)throw new Error(result?.error||'No se pudo dar de baja.');if(result.clienteEliminado===true)throw new Error('SEGURIDAD: Core intentó eliminar la ficha completa. Acción detenida.');state.renewSelection=state.renewSelection.filter(x=>x!==key);await loadCoreData({force:true});const still=activeRenewGroup();if(!still){state.renewGroupKey='';state.renewSelection=[];}render();showToast('Servicio dado de baja y cupo liberado. La ficha del cliente se conserva.');}catch(e){showToast(e?.message||'No se pudo dar de baja el servicio.');}
}

async function handleRenewalOption(options={days:30}) {
  const g=activeRenewGroup();if(!g||state.mutating)return;
  const selected=new Set(state.renewSelection.length?state.renewSelection:g.servicios.map(rowKey));
  const rows=g.serviciosCliente.filter(r=>selected.has(rowKey(r)));if(!rows.length){showToast('Marque al menos un servicio para renovar.');return;}
  const label=options.exactDate?`hasta ${options.exactDate}`:options.months?`+${Number(options.months)} mes${Number(options.months)===1?'':'es'}`:`+${Number(options.days||30)} días`;
  if(!window.confirm(`Renovar ${rows.length} servicio${rows.length===1?'':'s'} de ${g.nombre} ${label}?`))return;
  state.mutating=true;render();let ok=0,fail=0,financeWarnings=0,lastDate='';const renewedRows=[];
  for(const row of rows){try{const rowOptions=options.months?{exactDate:renewalDateForMonths(row.fechaRenovacion,options.months)}:options;if(options.months&&!rowOptions.exactDate)throw new Error('Fecha actual inválida.');const result=await renewService(row,rowOptions);if(!result?.ok||result?.verified!==true)throw new Error(result?.error||'Firebase no confirmó la fecha.');ok+=1;lastDate=result.fechaNueva||lastDate;if(result.fechaNueva)renewedRows.push([row,result.fechaNueva]);try{await registerRenewalPayment(row,row.precio);}catch(_){financeWarnings+=1;}}catch(_){fail+=1;}}
  // Actualiza al instante lo que YA se confirmó en el servidor (row.raw es la misma referencia dentro de
  // state.clients), en vez de esperar una recarga completa de todo el CRM antes de avisar — eso era lo que
  // hacía sentir la renovación lenta. La recarga completa igual se hace, pero después, sin bloquear el aviso.
  for(const [row,fecha] of renewedRows){if(row?.raw)row.raw.fechaRenovacion=fecha;}
  if(renewedRows.length)persistCoreCache();
  state.mutating=false;state.renewGroupKey='';state.renewSelection=[];state.renewManage=false;state.renewMessage='';render();
  showToast(`${ok} renovación${ok===1?'':'es'} confirmada${ok===1?'':'s'}${lastDate?` · ${lastDate}`:''}${fail?` · ${fail} falló${fail===1?'':'aron'}`:''}${financeWarnings?' · revise Finanzas':''}.`);
  loadCoreData({force:true});
}

function spinSplashLoaderWithJS() {
  // Gira el aro del splash escribiendo el transform directamente por JS en cada
  // frame, sin depender de @keyframes/CSS animation. Así el giro se ve aunque el
  // teléfono tenga desactivadas las animaciones del sistema (Ajustes o modo
  // ahorro de batería), que en algunos WebView de Android congelan las
  // animaciones CSS pero nunca bloquean una escritura directa a .style.
  let raf = 0;
  const start = performance.now();
  const spinMs = 800; // una vuelta completa cada 0.8s, igual que antes
  function tick(now) {
    const el = document.querySelector('.splash-loader');
    if (!el || !state.splash) { cancelAnimationFrame(raf); return; }
    const deg = ((now - start) % spinMs) / spinMs * 360;
    el.style.transform = `rotate(${deg}deg)`;
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
}

lockLoginScreenHeight();
spinSplashLoaderWithJS();
setTimeout(()=>{state.splash=false;render();},2800);
render();
// R69: la sesión se restaura desde el almacén seguro (Keystore) antes de pedir datos.
hydrateSession().then(sess=>{ state.session=sess||null; if(state.session){ restoreCoreCache(); render(); loadCoreData({force:true}); loadRemoteConfig(true); } else render(); }).catch(()=>{ state.session=null; render(); });
