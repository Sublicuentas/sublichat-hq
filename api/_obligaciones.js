// api/_obligaciones.js · R210 · Pendientes por cobrar: pago masivo con fecha real, conciliación y vista previa.
// Orden de trabajo 28/11/2026, puntos 06 y 07. Funciones PURAS (sin Firestore) para poder probarlas.
//
// Reglas:
//  - Se guarda por separado: período de origen (mes de la operación), fecha efectiva del pago (la real) y
//    fecha/hora del registro administrativo. La fecha del registro NUNCA sustituye la fecha efectiva.
//  - Si el pago ya existe en movimientos, se VINCULA (conciliación) y no se crea otro ingreso.
//  - Pago parcial: se aplica solo lo recibido, de la obligación más antigua a la más nueva; el resto queda pendiente.
//  - Nada se recalcula solo: la vista previa no escribe; la regla del 50% de Geisell es SOLO vista previa hasta
//    que administración confirme base elegible y fecha de inicio.

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
export const claveVendedor = (s) => { const k = norm(s).replace(/[^a-z0-9]/g, ""); return k === "geissel" ? "geisell" : k; };

// Mes de origen de la obligación (cuándo nació la deuda), no cuándo se paga.
export function periodoOrigen(c) {
  const f = String(c.fechaOperacion || c.fechaPago || c.fecha || c.createdAt || "");
  const m = f.match(/^(\d{4})-(\d{2})/) || f.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})/);
  if (!m) return "";
  return m[0].includes("/") ? `${m[2]}-${String(m[1]).padStart(2, "0")}` : `${m[1]}-${m[2]}`;
}

/** Reparte un pago entre obligaciones (más antigua primero). Devuelve el detalle por obligación. */
export function planPago(cuentas, monto) {
  const total = r2(cuentas.reduce((a, c) => a + r2(c.saldoPendiente), 0));
  const m = r2(monto);
  if (!(m > 0)) return { ok: false, error: "Escriba el importe del pago." };
  if (m > total + 0.001) return { ok: false, error: `El pago (L${m}) es mayor que lo seleccionado (L${total}).` };
  const orden = cuentas.slice().sort((a, z) => (periodoOrigen(a) + String(a.createdAt || "")).localeCompare(periodoOrigen(z) + String(z.createdAt || "")));
  let resta = m; const detalle = [];
  for (const c of orden) {
    const saldo = r2(c.saldoPendiente);
    const aplica = r2(Math.min(saldo, resta)); resta = r2(resta - aplica);
    const queda = r2(saldo - aplica);
    detalle.push({ cuentaId: c.id, periodo: periodoOrigen(c), antes: saldo, aplica, queda, estado: aplica <= 0 ? c.estado : queda <= 0 ? "pagado" : "parcial" });
  }
  return { ok: true, total, monto: m, parcial: m < total - 0.001, detalle };
}

/** Vista previa (solo lectura) de obligaciones por deudor y período, con posibles pagos ya registrados. */
export function vistaPrevia(cuentas, movimientos, { deudor = "" } = {}) {
  const k = deudor ? claveVendedor(deudor) : "";
  const sel = cuentas.filter((c) => (c.estado === "pendiente" || c.estado === "parcial") && (!k || claveVendedor(c.deudorId) === k || claveVendedor(c.deudorNombre) === k));
  const grupos = new Map();
  for (const c of sel) {
    const g = `${c.deudorTipo || "cliente"}|${claveVendedor(c.deudorId || c.deudorNombre)}`;
    if (!grupos.has(g)) grupos.set(g, { deudorTipo: c.deudorTipo || "cliente", deudorNombre: c.deudorNombre || c.deudorId || "", clave: claveVendedor(c.deudorId || c.deudorNombre), periodos: {}, total: 0, cuentas: 0 });
    const x = grupos.get(g), p = periodoOrigen(c) || "sin fecha";
    (x.periodos[p] = x.periodos[p] || { periodo: p, cuentas: [], total: 0 }).cuentas.push({ id: c.id, cliente: c.clienteNombre || "", plataforma: c.plataforma || "", total: r2(c.montoTotalOperacion), saldo: r2(c.saldoPendiente), estado: c.estado, creada: String(c.createdAt || "").slice(0, 10) });
    x.periodos[p].total = r2(x.periodos[p].total + r2(c.saldoPendiente)); x.total = r2(x.total + r2(c.saldoPendiente)); x.cuentas++;
  }
  // Posibles pagos ya contabilizados que NO están vinculados a ninguna obligación (para conciliar, no para sumar otra vez)
  const out = [...grupos.values()].map((x) => {
    const candidatos = (movimientos || []).filter((m) => m && m.tipo === "ingreso" && !m.anulado && !m.reversaDe && !m.cuentaId && !(m.conciliaCuentas || []).length && r2(m.monto) > 0 &&
      [m.deudorNombre, m.vendedorNombre, m.vendedor, m.beneficiario, m.descripcion, m.concepto, m.nota].some((t) => { const tx = norm(t).replace(/[^a-z0-9]/g, ""); return x.clave && (x.clave === "geisell" ? ["geisell", "geissel"] : [x.clave]).some((v) => tx.includes(v)); }))
      .map((m) => ({ movimientoId: m.movimientoId || m.id, fecha: String(m.fecha || m.fechaPago || m.createdAt || "").slice(0, 10), monto: r2(m.monto), banco: m.banco || "", detalle: m.descripcion || m.concepto || m.subtipo || "" }));
    return { ...x, periodos: Object.values(x.periodos).sort((a, z) => a.periodo.localeCompare(z.periodo)), posiblesPagos: candidatos };
  }).sort((a, z) => z.total - a.total);
  return { grupos: out, total: r2(out.reduce((a, g) => a + g.total, 0)) };
}

/**
 * Regla exclusiva de Geisell (SOLO VISTA PREVIA). Obligación = base elegible × 50 %; pendiente = obligación − pagos
 * válidos, nunca negativo. Si el registro ya parece neto al 50 % no se vuelve a dividir. No escribe nada.
 */
export function previaGeisell(cuentas, { claveGeisell = "geisell", porcentaje = 0.5 } = {}) {
  // R211 · base elegible = lo que quedó en manos de Geisell (pendiente original, bruto). Las deudas creadas con la
  // regla (reglaVendedor) ya son netas: no se vuelven a dividir. Pagos = lo que ella entregó después.
  const suyas = cuentas.filter((c) => c.deudorTipo === "vendedor" && (claveVendedor(c.deudorId) === claveGeisell || claveVendedor(c.deudorNombre) === claveGeisell));
  const filas = suyas.map((c) => {
    const inicial = Number(c.montoRecibidoInicial) || 0, pagado = r2(c.montoRecibidoPosterior);
    const original = r2(c.montoOriginalPendiente != null ? c.montoOriginalPendiente : (Number(c.montoTotalOperacion) || 0) - inicial);
    const conRegla = !!c.reglaVendedor;
    // registro viejo que alguien ya cargó al 50 % a mano: original + inicial = mitad del total
    const netoManual = !conRegla && Number(c.montoTotalOperacion) > 0 && Math.abs(r2(original + inicial) - r2(Number(c.montoTotalOperacion) * porcentaje)) < 0.01;
    const yaNeto = conRegla || netoManual;
    const base = conRegla ? r2(c.montoBaseVendedor ?? c.reglaVendedor.base) : netoManual ? r2(Number(c.montoTotalOperacion) - inicial) : original;
    const obligacion = yaNeto ? original : r2(base * porcentaje);
    const propuesto = r2(Math.max(0, obligacion - pagado));
    return { cuentaId: c.id, periodo: periodoOrigen(c), cliente: c.clienteNombre || "", plataforma: c.plataforma || "", estado: c.estado, base, obligacion, pagado, saldoActual: r2(c.saldoPendiente), saldoPropuesto: propuesto, diferencia: r2(propuesto - r2(c.saldoPendiente)), yaNeto, conRegla, excedente: r2(Math.max(0, pagado - obligacion)) };
  });
  const tot = (k) => r2(filas.reduce((a, f) => a + f[k], 0));
  return { clave: claveGeisell, porcentaje, filas, porAjustar: filas.filter((f) => !f.yaNeto && Math.abs(f.diferencia) > 0.009).length, totales: { base: tot("base"), obligacion: tot("obligacion"), pagado: tot("pagado"), saldoActual: tot("saldoActual"), saldoPropuesto: tot("saldoPropuesto"), diferencia: tot("diferencia") },
    preguntas: ["¿Desde qué fecha se ajustan los saldos VIEJOS de Geisell (incluye octubre)? Las deudas nuevas ya nacen al 50 %.", "¿Algún saldo viejo ya estaba calculado al 50 % aunque el sistema no lo marque?"] };
}

// Fecha real del pago para registros históricos autorizados: AAAA-MM-DD válida, no futura, máximo 180 días atrás.
export function fechaHistoricaValida(f, hoy) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(f || ""))) return "Escriba la fecha real del pago.";
  const [y, m, d] = f.split("-").map(Number), dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "La fecha del pago no es válida.";
  const dias = Math.round((Date.parse(hoy + "T00:00:00Z") - dt.getTime()) / 86400000);
  if (dias < 0) return "La fecha del pago no puede ser futura.";
  if (dias > 180) return "La fecha del pago no puede ser de hace más de 180 días.";
  return "";
}
