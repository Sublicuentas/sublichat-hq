/* finanzas-excel.js · R200c · Libro Excel financiero interactivo (9 hojas) — Sublichat HQ
 * Mismo motor que la Web (finp_excel_financiero): cada mes se calcula igual que en Finanzas → ese mes, así los totales
 * coinciden con la pantalla. Interactividad SIN macros: tablas de Excel con filtros y orden, selectores de Mes y Plataforma
 * en el Panel (validación de datos) que recalculan con SUMAR.SI.CONJUNTO sobre las hojas de detalle, vínculos internos y
 * gráficos nativos de Excel (insertados como DrawingML). Sin teléfonos, PIN ni contraseñas.
 * Funciona en el navegador (ExcelJS + JSZip globales) y en Node (pruebas: se le pasan ExcelJS y JSZip).
 */
(function (root) {
  'use strict';
  var ROJO = 'FFE6211C', GRIS = 'FFF3F6FB', TXT = 'FF1F2430';
  var MONEY = '"L"#,##0.00;[Red]-"L"#,##0.00', PCT = '0.0%', FECHA = 'dd/mm/yyyy';
  var TIPO = { venta: 'Alta nueva', renovacion: 'Renovación cobrada', ingreso_manual: 'Otro cobro' };
  var REGLA = { cobertura: 'Por vigencia', cobertura_documentada: 'Cobertura documentada', activacion: 'Por activación', consumo: 'Por consumo (PEPS)', lote_sin_consumo: 'Lote sin consumo', mensual_acceso: 'Mensual por acceso', mensual_familia: 'Mensual por familia' };
  var HOJAS = ['01 Panel ejecutivo', '02 Ventas y renovaciones', '03 Compras e inversion', '04 Costos asignados', '05 Rentab por cuenta', '06 Rentab por plataforma', '07 Evolucion anual', '08 Pendientes', '09 Parametros'];

  function fechaX(ymd) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; }
  function colL(n) { var s = ''; while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
  function q(h) { return "'" + h + "'"; }
  function num(v) { var n = Number(v); return isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function nom(v) { return String(v || '').replace(/naara/ig, 'Sublicuentas').replace(/libni/ig, 'Relojes'); } // regla: nunca mostrar nombres personales de las dueñas
  function plat(v) { return String(v || '').trim() || 'Sin plataforma'; }
  function nombreMes(m) { var M = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']; var p = String(m || '').split('-'); return p.length === 2 ? M[+p[1] - 1] + ' ' + p[0] : String(m || ''); }

  // Tabla de Excel (filtros + orden) con encabezado rojo; devuelve el mapa columna→letra y el rango de datos.
  function tabla(ws, nombre, fila0, cols, filas) {
    var rows = filas.length ? filas : [cols.map(function () { return ''; })];
    ws.addTable({ name: nombre, ref: 'A' + fila0, headerRow: true, totalsRow: false, style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: cols.map(function (c) { return { name: c.h, filterButton: true }; }), rows: rows });
    cols.forEach(function (c, i) { var col = ws.getColumn(i + 1); col.width = c.w || 14; if (c.fmt) col.numFmt = c.fmt; });
    var mapa = {}; cols.forEach(function (c, i) { mapa[c.k || c.h] = colL(i + 1); });
    return { mapa: mapa, desde: fila0 + 1, hasta: fila0 + rows.length };
  }
  function rango(hoja, t, k) { return q(hoja) + '!$' + t.mapa[k] + '$' + t.desde + ':$' + t.mapa[k] + '$' + t.hasta; }

  function construir(ExcelJS, x, opts) {
    opts = opts || {};
    var wb = new ExcelJS.Workbook();
    wb.creator = 'Sublichat HQ'; wb.created = new Date(x.generado || Date.now()); wb.calcProperties = { fullCalcOnLoad: true };
    var ws = {}; HOJAS.forEach(function (h) { ws[h] = wb.addWorksheet(h, { properties: { tabColor: { argb: h.indexOf('01') === 0 ? ROJO : 'FF178EF1' } } }); });
    var meses = (x.meses || []).map(function (m) { return m.mes; });
    var plats = []; (x.meses || []).forEach(function (m) { (m.porPlataforma || []).forEach(function (p) { if (plats.indexOf(plat(p.nombre)) < 0) plats.push(plat(p.nombre)); }); }); plats.sort();

    // ---------- 02 Ventas y renovaciones
    var h2 = HOJAS[1], w2 = ws[h2];
    w2.getCell('A1').value = 'Ventas y renovaciones cobradas · una fila por servicio (un pago conjunto se reparte una sola vez)'; w2.getCell('A1').font = { bold: true, size: 13 };
    var c2 = [{ h: 'ID', w: 30 }, { h: 'Mes', w: 9 }, { h: 'Fecha', w: 11, fmt: FECHA }, { h: 'Tipo', w: 18 }, { h: 'Plataforma', w: 16 }, { h: 'Cuenta madre', w: 26 }, { h: 'Perfil', w: 10 }, { h: 'Beneficiario', w: 22 }, { h: 'Titular', w: 22 }, { h: 'Vendedor', w: 16 },
      { h: 'Valor', w: 11, fmt: MONEY }, { h: 'Descuento', w: 11, fmt: MONEY }, { h: 'Cobrado', w: 11, fmt: MONEY }, { h: 'Pendiente', w: 11, fmt: MONEY }, { h: 'Costo vinculado', w: 9 }, { h: 'Cobrado con costo', w: 12, fmt: MONEY }, { h: 'ID cobro', w: 26 }, { h: 'ID compra (servicio)', w: 20 }, { h: 'Combo', w: 7 }];
    var t2 = tabla(w2, 'tVentas', 3, c2, (x.ventas || []).map(function (v) { var cub = v.costoVinculado ? 'Sí' : 'No'; return [v.id, v.mes, fechaX(v.fecha), TIPO[v.tipo] || v.tipo, plat(v.plataforma), v.cuenta || '', v.perfil || '', v.beneficiario || '', v.titular || '', nom(v.vendedor), num(v.valor), num(v.descuento), num(v.cobrado), num(v.pendiente), cub, cub === 'Sí' ? num(v.cobrado) : 0, v.cobroId || '', v.compraId || '', v.combo ? 'Sí' : '']; }));
    for (var r = t2.desde; r <= t2.hasta && (x.ventas || []).length; r++) w2.getCell(t2.mapa['Cobrado con costo'] + r).value = { formula: 'IF(' + t2.mapa['Costo vinculado'] + r + '="Sí",' + t2.mapa.Cobrado + r + ',0)', result: w2.getCell(t2.mapa['Cobrado con costo'] + r).value };
    w2.views = [{ state: 'frozen', ySplit: 3 }];

    // ---------- 03 Compras e inversión (incluye anuladas, con su rastro)
    var h3 = HOJAS[2], w3 = ws[h3];
    w3.getCell('A1').value = 'Compras / inversión · tasa histórica de cada compra · las anuladas quedan con motivo, fecha y usuario'; w3.getCell('A1').font = { bold: true, size: 13 };
    var enCaja = {}; (x.desembolsos || []).forEach(function (d) { if (d.loteId) enCaja[d.loteId] = num((enCaja[d.loteId] || 0) + num(d.costoHnl)); });
    var c3 = [{ h: 'Folio', w: 10 }, { h: 'ID compra', w: 26 }, { h: 'Mes', w: 9 }, { h: 'Fecha', w: 11, fmt: FECHA }, { h: 'Activación', w: 11, fmt: FECHA }, { h: 'Producto', w: 24 }, { h: 'Proveedor', w: 20 }, { h: 'Plataforma', w: 14 }, { h: 'Cuenta', w: 20 }, { h: 'Cantidad', w: 9 }, { h: 'Unidad', w: 11 },
      { h: 'Moneda', w: 8 }, { h: 'Monto en moneda', w: 12 }, { h: 'Tasa histórica', w: 11 }, { h: 'Costo HNL', w: 12, fmt: MONEY }, { h: 'Medio de pago', w: 22 }, { h: 'Estado', w: 10 }, { h: 'Pagado en el período (caja)', w: 13, fmt: MONEY }, { h: 'Motivo de anulación', w: 30 }, { h: 'Anulada el', w: 18 }, { h: 'Anulada por', w: 14 }];
    var t3 = tabla(w3, 'tCompras', 3, c3, (x.compras || []).map(function (l) { return [l.folio, l.loteId, String(l.fecha || '').slice(0, 7), fechaX(l.fecha), fechaX(l.fechaActivacion), l.producto, l.proveedor, plat(l.plataforma), l.cuentaId, Number(l.cantidad) || 0, l.unidad, l.moneda, l.montoMoneda === '' ? '' : Number(l.montoMoneda), l.tasa === '' ? '' : Number(l.tasa), num(l.costoHnl), l.pago, l.estado === 'anulado' ? 'Anulada' : 'Vigente', l.estado !== 'anulado' ? (enCaja[l.loteId] || 0) : 0, l.motivoAnulacion || '', String(l.anuladoAt || '').replace('T', ' ').slice(0, 16), nom(l.anuladoPor)]; }));
    w3.views = [{ state: 'frozen', ySplit: 3 }];

    // ---------- 04 Costos asignados
    var h4 = HOJAS[3], w4 = ws[h4];
    w4.getCell('A1').value = 'Costos asignados · relación compra/lote/activación → servicio y período (la misma compra no se descuenta dos veces)'; w4.getCell('A1').font = { bold: true, size: 13 };
    var c4 = [{ h: 'Mes', w: 9 }, { h: 'Plataforma', w: 14 }, { h: 'Cuenta madre', w: 26 }, { h: 'ID compra / lote', w: 26 }, { h: 'Producto', w: 22 }, { h: 'Proveedor', w: 18 }, { h: 'Regla', w: 20 }, { h: 'Costo reconocido HNL', w: 13, fmt: MONEY }, { h: 'Moneda', w: 8 }, { h: 'Monto en moneda', w: 12 }, { h: 'Tasa histórica', w: 11 }, { h: 'Fecha de compra', w: 11, fmt: FECHA }, { h: 'Criterio', w: 60 }];
    var t4 = tabla(w4, 'tCostos', 3, c4, (x.costos || []).map(function (c) { return [c.mes, plat(c.plataforma), c.cuenta, c.loteId, c.producto, c.proveedor, REGLA[c.regla] || c.regla, num(c.costoHnl), c.moneda, c.montoMoneda === '' ? '' : Number(c.montoMoneda), c.tasa === '' ? '' : Number(c.tasa), fechaX(c.fechaCompra), c.criterio]; }));
    w4.views = [{ state: 'frozen', ySplit: 3 }];

    // ---------- 05 Rentabilidad por cuenta (por mes)
    var h5 = HOJAS[4], w5 = ws[h5];
    w5.getCell('A1').value = 'Rentabilidad por cuenta madre o acceso, por mes · «Pendiente» = sin costo vinculado (no es ganancia definitiva)'; w5.getCell('A1').font = { bold: true, size: 13 };
    var c5 = [{ h: 'Mes', w: 9 }, { h: 'Plataforma', w: 14 }, { h: 'Cuenta madre', w: 28 }, { h: 'Clientes', w: 9 }, { h: 'Perfiles ocupados', w: 9 }, { h: 'Capacidad', w: 9 }, { h: 'Cobrado', w: 12, fmt: MONEY }, { h: 'Cobrado con costo', w: 12, fmt: MONEY }, { h: 'Costo', w: 12, fmt: MONEY }, { h: 'Resultado', w: 12, fmt: MONEY }, { h: 'Margen', w: 9, fmt: PCT }, { h: 'Cobertura', w: 9, fmt: PCT }];
    var cm = x.cuentasMes || [];
    var t5 = tabla(w5, 'tCuentas', 3, c5, cm.map(function (c) { var res = c.costoHnl > 0 || c.cobradoCubiertoHnl > 0 ? num(c.cobradoCubiertoHnl - c.costoHnl) : 'Pendiente'; return [c.mes, plat(c.plataforma), c.cuenta, c.clientes, c.perfilesOcupados, c.capacidad, num(c.cobradoHnl), num(c.cobradoCubiertoHnl), num(c.costoHnl), res, typeof res === 'number' && c.cobradoCubiertoHnl > 0 ? res / c.cobradoCubiertoHnl : '', c.cobradoHnl > 0 ? c.cobradoCubiertoHnl / c.cobradoHnl : '']; }));
    for (var r5 = t5.desde; r5 <= t5.hasta && cm.length; r5++) {
      var M = t5.mapa, res0 = w5.getCell(M.Resultado + r5).value;
      w5.getCell(M.Resultado + r5).value = { formula: 'IF(OR(' + M.Costo + r5 + '>0,' + M['Cobrado con costo'] + r5 + '>0),' + M['Cobrado con costo'] + r5 + '-' + M.Costo + r5 + ',"Pendiente")', result: res0 };
      w5.getCell(M.Margen + r5).value = { formula: 'IF(AND(ISNUMBER(' + M.Resultado + r5 + '),' + M['Cobrado con costo'] + r5 + '>0),' + M.Resultado + r5 + '/' + M['Cobrado con costo'] + r5 + ',"")', result: w5.getCell(M.Margen + r5).value };
      w5.getCell(M.Cobertura + r5).value = { formula: 'IF(' + M.Cobrado + r5 + '>0,' + M['Cobrado con costo'] + r5 + '/' + M.Cobrado + r5 + ',"")', result: w5.getCell(M.Cobertura + r5).value };
    }
    w5.views = [{ state: 'frozen', ySplit: 3 }];

    // ---------- 06 Rentabilidad por plataforma (por mes) + ranking del período (fórmulas)
    var h6 = HOJAS[5], w6 = ws[h6];
    w6.getCell('A1').value = 'Rentabilidad por plataforma · por mes y ranking del período (las ganancias con cobertura incompleta se marcan «Parcial»)'; w6.getCell('A1').font = { bold: true, size: 13 };
    var c6 = [{ h: 'Mes', w: 9 }, { h: 'Plataforma', w: 16 }, { h: 'Altas', w: 7 }, { h: 'Renovaciones', w: 9 }, { h: 'Clientes', w: 8 }, { h: 'Cobrado', w: 12, fmt: MONEY }, { h: 'Cobrado con costo', w: 12, fmt: MONEY }, { h: 'Costo atribuido', w: 12, fmt: MONEY }, { h: 'Compras pagadas', w: 12, fmt: MONEY }, { h: 'Resultado', w: 12, fmt: MONEY }, { h: 'Margen', w: 8, fmt: PCT }, { h: 'Cobertura', w: 9, fmt: PCT }, { h: 'Estado', w: 16 }];
    var EST = { ok: 'Costo completo', cobertura_parcial: 'Cobertura parcial', costo_pendiente: 'Costo pendiente', sin_ingreso: 'Sin ingreso cobrado', sin_movimiento: 'Sin movimiento' };
    var filas6 = []; (x.meses || []).forEach(function (m) { (m.porPlataforma || []).forEach(function (p) { filas6.push([m.mes, plat(p.nombre), p.altas, p.renovaciones, p.clientes, num(p.cobradoHnl), num(p.cobradoCubiertoHnl), num(p.costoHnl), num(p.desembolsoHnl), p.resultadoHnl == null ? 'Pendiente' : num(p.resultadoHnl), p.margen == null ? '' : p.margen / 100, p.coberturaCostos == null ? '' : p.coberturaCostos / 100, EST[p.estado] || p.estado]); }); });
    var t6 = tabla(w6, 'tPlataformas', 3, c6, filas6);
    var r6 = t6.hasta + 3;
    w6.getCell('A' + r6).value = 'Ranking del período (suma de los meses) · ordene con los filtros'; w6.getCell('A' + r6).font = { bold: true, size: 12 };
    var tot = {}; plats.forEach(function (n) { tot[n] = { cob: 0, cub: 0, costo: 0 }; }); filas6.forEach(function (f) { var t = tot[f[1]]; t.cob += f[5]; t.cub += f[6]; t.costo += f[7]; });
    var orden = plats.slice().sort(function (a, b) { return (tot[b].cub - tot[b].costo) - (tot[a].cub - tot[a].costo); });
    var c6b = [{ h: 'Plataforma ', k: 'Plat', w: 16 }, { h: 'Cobrado ', k: 'Cob', fmt: MONEY }, { h: 'Cobrado con costo ', k: 'Cub', fmt: MONEY }, { h: 'Costo ', k: 'Costo', fmt: MONEY }, { h: 'Ganancia calculable', k: 'Res', fmt: MONEY }, { h: 'Margen ', k: 'Mg', fmt: PCT }, { h: 'Cobertura ', k: 'Cb', fmt: PCT }, { h: 'Calidad', k: 'Cal', w: 12 }];
    var t6b = tabla(w6, 'tRanking', r6 + 1, c6b, orden.map(function (n) { var t = tot[n]; var res = num(t.cub - t.costo); return [n, num(t.cob), num(t.cub), num(t.costo), res, t.cub > 0 ? res / t.cub : '', t.cob > 0 ? t.cub / t.cob : '', t.cob > 0 && t.cub / t.cob >= 0.995 ? 'Definitiva' : 'Parcial']; }));
    for (var rr = t6b.desde; rr <= t6b.hasta && orden.length; rr++) {
      var P = t6b.mapa, crit = P.Plat + rr;
      ['Cob', 'Cub', 'Costo'].forEach(function (k, i) { var src = ['Cobrado', 'Cobrado con costo', 'Costo atribuido'][i]; w6.getCell(P[k] + rr).value = { formula: 'SUMIFS(' + rango(h6, t6, src) + ',' + rango(h6, t6, 'Plataforma') + ',' + crit + ')', result: w6.getCell(P[k] + rr).value }; });
      w6.getCell(P.Res + rr).value = { formula: P.Cub + rr + '-' + P.Costo + rr, result: w6.getCell(P.Res + rr).value };
      w6.getCell(P.Mg + rr).value = { formula: 'IF(' + P.Cub + rr + '>0,' + P.Res + rr + '/' + P.Cub + rr + ',"")', result: w6.getCell(P.Mg + rr).value };
      w6.getCell(P.Cb + rr).value = { formula: 'IF(' + P.Cob + rr + '>0,' + P.Cub + rr + '/' + P.Cob + rr + ',"")', result: w6.getCell(P.Cb + rr).value };
      w6.getCell(P.Cal + rr).value = { formula: 'IF(AND(' + P.Cob + rr + '>0,' + P.Cb + rr + '>=0.995),"Definitiva","Parcial")', result: w6.getCell(P.Cal + rr).value };
    }
    w6.getColumn(1).width = 16;

    // ---------- 07 Evolución anual (fórmulas sobre el detalle: variación intermensual y acumulado del año)
    var h7 = HOJAS[6], w7 = ws[h7];
    w7.getCell('A1').value = 'Evolución mensual · cada cifra se recalcula desde las hojas 02, 03 y 04'; w7.getCell('A1').font = { bold: true, size: 13 };
    var c7 = [{ h: 'Mes', w: 9 }, { h: 'Nombre', w: 16 }, { h: 'Cobrado', fmt: MONEY }, { h: 'Cobrado con costo', fmt: MONEY }, { h: 'Costo atribuido', fmt: MONEY }, { h: 'Ganancia calculable', fmt: MONEY }, { h: 'Margen', fmt: PCT }, { h: 'Cobertura', fmt: PCT }, { h: 'Compras pagadas', fmt: MONEY }, { h: 'Variación cobrado', fmt: PCT }, { h: 'Cobrado acumulado del año', fmt: MONEY }];
    var t7 = tabla(w7, 'tEvolucion', 3, c7, (x.meses || []).map(function (m) { var res = num(m.cobradoCubiertoHnl - m.costoHnl); return [m.mes, nombreMes(m.mes), num(m.cobradoHnl), num(m.cobradoCubiertoHnl), num(m.costoHnl), res, m.cobradoCubiertoHnl > 0 ? res / m.cobradoCubiertoHnl : '', m.cobradoHnl > 0 ? m.cobradoCubiertoHnl / m.cobradoHnl : '', num(m.desembolsoHnl), '', 0]; }));
    var acum = {};
    (x.meses || []).forEach(function (m, i) {
      var r = t7.desde + i, E = t7.mapa, crit = E.Mes + r;
      var set = function (k, f, res) { w7.getCell(E[k] + r).value = { formula: f, result: res }; };
      set('Cobrado', 'SUMIFS(' + rango(h2, t2, 'Cobrado') + ',' + rango(h2, t2, 'Mes') + ',' + crit + ')', num(m.cobradoHnl));
      set('Cobrado con costo', 'SUMIFS(' + rango(h2, t2, 'Cobrado con costo') + ',' + rango(h2, t2, 'Mes') + ',' + crit + ')', num(m.cobradoCubiertoHnl));
      set('Costo atribuido', 'SUMIFS(' + rango(h4, t4, 'Costo reconocido HNL') + ',' + rango(h4, t4, 'Mes') + ',' + crit + ')', num(m.costoHnl));
      set('Ganancia calculable', E['Cobrado con costo'] + r + '-' + E['Costo atribuido'] + r, num(m.cobradoCubiertoHnl - m.costoHnl));
      set('Margen', 'IF(' + E['Cobrado con costo'] + r + '>0,' + E['Ganancia calculable'] + r + '/' + E['Cobrado con costo'] + r + ',"")', '');
      set('Cobertura', 'IF(' + E.Cobrado + r + '>0,' + E['Cobrado con costo'] + r + '/' + E.Cobrado + r + ',"")', '');
      set('Compras pagadas', 'SUMIFS(' + rango(h3, t3, 'Pagado en el período (caja)') + ',' + rango(h3, t3, 'Mes') + ',' + crit + ')', num(m.desembolsoHnl));
      if (i > 0) set('Variación cobrado', 'IF(' + E.Cobrado + (r - 1) + '>0,(' + E.Cobrado + r + '-' + E.Cobrado + (r - 1) + ')/' + E.Cobrado + (r - 1) + ',"")', '');
      var y = m.mes.slice(0, 4); acum[y] = num((acum[y] || 0) + num(m.cobradoHnl));
      set('Cobrado acumulado del año', 'SUMIFS(' + E.Cobrado + '$' + t7.desde + ':' + E.Cobrado + r + ',' + E.Mes + '$' + t7.desde + ':' + E.Mes + r + ',"' + y + '-*")', acum[y]);
    });

    // ---------- 08 Pendientes / conciliación
    var h8 = HOJAS[7], w8 = ws[h8];
    w8.getCell('A1').value = 'Pendientes y conciliación · nada se inventa: se muestra para revisar'; w8.getCell('A1').font = { bold: true, size: 13 };
    var BAND = { sin_coincidencia: 'Asignación pendiente', plan_sin_clasificar: 'Plan sin clasificar', pago_pendiente: 'Pago pendiente', costo_pendiente: 'Cobro sin costo vinculado', datos_incompletos: 'Datos incompletos', ingreso_sin_confirmar: 'Renovación sin cobro registrado' };
    var c8 = [{ h: 'Mes', w: 9 }, { h: 'Tipo', w: 26 }, { h: 'Detalle', w: 60 }, { h: 'Plataforma', w: 14 }, { h: 'Fecha', w: 11, fmt: FECHA }, { h: 'Beneficiario', w: 22 }, { h: 'Monto', w: 12, fmt: MONEY }, { h: 'Referencia', w: 26 }];
    var f8 = (x.pendientes || []).map(function (b) { return [b.mes, BAND[b.tipo] || b.tipo, b.texto, plat(b.plataforma), fechaX(b.fecha), b.beneficiario, num(b.monto), b.referencia]; });
    (x.compras || []).filter(function (l) { return l.estado === 'anulado'; }).forEach(function (l) { f8.push([String(l.fecha).slice(0, 7), 'Compra anulada (revisable)', l.producto + ' · ' + (l.motivoAnulacion || ''), plat(l.plataforma), fechaX(l.fecha), '', num(l.costoHnl), l.loteId]); });
    tabla(w8, 'tPendientes', 3, c8, f8);
    w8.views = [{ state: 'frozen', ySplit: 3 }];

    // ---------- 09 Parámetros y diccionario
    var h9 = HOJAS[8], w9 = ws[h9];
    w9.getColumn(1).width = 34; w9.getColumn(2).width = 90;
    var p9 = [['Generado', String(x.generado || '').replace('T', ' ').slice(0, 16) + ' UTC'], ['Generado por', nom(x.usuario)], ['Período', nombreMes(meses[0]) + ' → ' + nombreMes(meses[meses.length - 1]) + ' (' + x.desde + ' a ' + x.hasta + ')'], ['Zona horaria', x.zona || 'America/Tegucigalpa'], ['Origen de datos', 'Sublichat HQ · finp_excel_financiero (mismo motor que Finanzas Web; cada mes se calcula como al abrir ese mes)'],
      ['Moneda', 'Lempiras (HNL). Las compras conservan su moneda, monto y TASA HISTÓRICA; nunca se recalculan con la tasa de hoy.'], ['Ingresos cobrados', 'Altas y renovaciones con movimiento de dinero confirmado en el libro del período. Un pago conjunto se reparte una sola vez.'],
      ['Compra / inversión', 'Salida efectiva al proveedor en su fecha (hoja 03, columna «Pagado en el período»). No es lo mismo que el costo del mes.'], ['Costo atribuido', 'Asignación sustentada de compra, activación o período al servicio vendido (hoja 04). La misma compra no se descuenta dos veces.'],
      ['Ganancia calculable', 'Cobrado con costo vinculado − costo atribuido. Lo cobrado sin costo queda fuera y se marca pendiente.'], ['Cobertura', 'Porcentaje del ingreso cobrado que tiene costo vinculado. Menos de 99.5% = margen PARCIAL (no definitivo).'],
      ['Anulaciones', 'Una compra anulada queda en la hoja 03 con motivo, fecha y usuario, y en la 08 para revisión. Su pago se revirtió con asiento inverso.'], ['Totales del período', 'En el Panel, «Todo el período» es la SUMA de los meses. La Web muestra cada mes con el mismo cálculo.'],
      ['Privacidad', 'Sin teléfonos, PIN, claves ni tokens.'], ['Interactividad', 'Tablas con filtros/orden en cada hoja; en el Panel elija Mes y Plataforma (lista desplegable) y todo se recalcula. Sin macros.']];
    if (x.truncado) p9.push(['Aviso', 'Alguna hoja superó 20 000 filas: se exportaron las primeras 20 000. Elija un período más corto para el detalle completo.']);
    Object.keys(x.definiciones || {}).forEach(function (k) { p9.push(['Definición · ' + k, x.definiciones[k]]); });
    p9.forEach(function (p, i) { w9.getCell('A' + (i + 1)).value = p[0]; w9.getCell('A' + (i + 1)).font = { bold: true }; w9.getCell('B' + (i + 1)).value = p[1]; w9.getCell('B' + (i + 1)).alignment = { wrapText: true, vertical: 'top' }; });
    // listas para los selectores del Panel (columnas D y E)
    w9.getCell('D1').value = 'Meses'; w9.getCell('E1').value = 'Plataformas'; w9.getCell('D1').font = w9.getCell('E1').font = { bold: true };
    var listaM = ['Todo el período'].concat(meses), listaP = ['Todas'].concat(plats);
    listaM.forEach(function (m, i) { w9.getCell('D' + (i + 2)).value = m; }); listaP.forEach(function (p, i) { w9.getCell('E' + (i + 2)).value = p; });
    w9.getColumn(4).width = 16; w9.getColumn(5).width = 18;

    // ---------- 01 Panel ejecutivo (selectores + KPIs por fórmula + vínculos + gráficos)
    var h1 = HOJAS[0], w1 = ws[h1];
    w1.getColumn(1).width = 36; w1.getColumn(2).width = 20; w1.getColumn(3).width = 9; [4, 5, 6, 7, 8, 9, 10, 11, 12].forEach(function (c) { w1.getColumn(c).width = 14; });
    w1.getCell('A1').value = 'Sublichat · Panel financiero'; w1.getCell('A1').font = { bold: true, size: 18, color: { argb: TXT } };
    w1.getCell('A2').value = 'Período ' + nombreMes(meses[0]) + ' → ' + nombreMes(meses[meses.length - 1]) + ' · generado ' + String(x.generado || '').replace('T', ' ').slice(0, 16) + ' UTC'; w1.getCell('A2').font = { color: { argb: 'FF5B6472' } };
    w1.getCell('A4').value = 'Mes'; w1.getCell('A5').value = 'Plataforma';
    var ultimo = meses[meses.length - 1] || 'Todo el período';
    w1.getCell('B4').value = opts.mes && meses.indexOf(opts.mes) >= 0 ? opts.mes : ultimo; w1.getCell('B5').value = 'Todas';
    ['B4', 'B5'].forEach(function (c) { var cell = w1.getCell(c); cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4CC' } }; cell.font = { bold: true }; cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }; });
    w1.getCell('B4').dataValidation = { type: 'list', allowBlank: false, formulae: [q(h9) + '!$D$2:$D$' + (listaM.length + 1)], showErrorMessage: true, errorTitle: 'Mes', error: 'Elija un mes de la lista.' };
    w1.getCell('B5').dataValidation = { type: 'list', allowBlank: false, formulae: [q(h9) + '!$E$2:$E$' + (listaP.length + 1)], showErrorMessage: true, errorTitle: 'Plataforma', error: 'Elija una plataforma de la lista.' };
    w1.getCell('C4').value = '◀ elija'; w1.getCell('C5').value = '◀ elija'; w1.getCell('C4').font = w1.getCell('C5').font = { italic: true, color: { argb: 'FF8A93A0' } };
    var cM = 'IF($B$4="Todo el período","*",$B$4)', cP = 'IF($B$5="Todas","*",$B$5)';
    var sumV = function (k) { return 'SUMIFS(' + rango(h2, t2, k) + ',' + rango(h2, t2, 'Mes') + ',' + cM + ',' + rango(h2, t2, 'Plataforma') + ',' + cP + ')'; };
    var sumC = 'SUMIFS(' + rango(h4, t4, 'Costo reconocido HNL') + ',' + rango(h4, t4, 'Mes') + ',' + cM + ',' + rango(h4, t4, 'Plataforma') + ',' + cP + ')';
    var sumK = 'SUMIFS(' + rango(h3, t3, 'Pagado en el período (caja)') + ',' + rango(h3, t3, 'Mes') + ',' + cM + ',' + rango(h3, t3, 'Plataforma') + ',' + cP + ')';
    var cntV = function (tipo) { return 'COUNTIFS(' + rango(h2, t2, 'Mes') + ',' + cM + ',' + rango(h2, t2, 'Plataforma') + ',' + cP + ',' + rango(h2, t2, 'Tipo') + ',"' + tipo + '")'; };
    // valores precalculados para el mes inicial (Todas): así se ven aunque Excel no recalcule (vista previa)
    var mSel = (x.meses || []).filter(function (m) { return m.mes === w1.getCell('B4').value; })[0] || {};
    var kpis = [
      ['Ingresos cobrados', sumV('Cobrado'), num(mSel.cobradoHnl), MONEY, HOJAS[1]],
      ['Cobrado con costo vinculado', sumV('Cobrado con costo'), num(mSel.cobradoCubiertoHnl), MONEY, HOJAS[1]],
      ['Costo atribuido', sumC, num(mSel.costoHnl), MONEY, HOJAS[3]],
      ['Ganancia calculable', 'B8-B9', num((mSel.cobradoCubiertoHnl || 0) - (mSel.costoHnl || 0)), MONEY, HOJAS[5]],
      ['Margen (sobre cobrado con costo)', 'IF(B8>0,B10/B8,"—")', mSel.cobradoCubiertoHnl > 0 ? ((mSel.cobradoCubiertoHnl - mSel.costoHnl) / mSel.cobradoCubiertoHnl) : '—', PCT, HOJAS[5]],
      ['Cobertura de costos', 'IF(B7>0,B8/B7,"—")', mSel.cobradoHnl > 0 ? mSel.cobradoCubiertoHnl / mSel.cobradoHnl : '—', PCT, HOJAS[7]],
      ['Calidad del resultado', 'IF(AND(ISNUMBER(B12),B12>=0.995),"Definitivo","Parcial: faltan costos por vincular")', '', null, HOJAS[7]],
      ['Compras pagadas (inversión, caja)', sumK, num(mSel.desembolsoHnl), MONEY, HOJAS[2]],
      ['Altas nuevas (servicios)', cntV('Alta nueva'), '', '0', HOJAS[1]],
      ['Renovaciones cobradas (servicios)', cntV('Renovación cobrada'), '', '0', HOJAS[1]],
    ];
    kpis.forEach(function (k, i) {
      var r = 7 + i, a = w1.getCell('A' + r), b = w1.getCell('B' + r);
      a.value = { text: k[0] + '  ↗', hyperlink: '#' + q(k[4]) + '!A1' }; a.font = { bold: true, color: { argb: 'FF178EF1' }, underline: true };
      b.value = { formula: k[1], result: k[2] }; if (k[3]) b.numFmt = k[3]; b.font = { bold: true, size: 13 };
      b.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
    });
    w1.getCell('A18').value = 'Vínculos'; w1.getCell('A18').font = { bold: true };
    HOJAS.slice(1).forEach(function (h, i) { var c = w1.getCell('A' + (19 + i)); c.value = { text: h, hyperlink: '#' + q(h) + '!A1' }; c.font = { color: { argb: 'FF178EF1' }, underline: true }; });
    w1.getCell('A3').value = 'Elija Mes y Plataforma en las celdas amarillas: todas las cifras salen de las hojas de detalle. «Todo el período» suma los meses.'; w1.getCell('A3').font = { italic: true, color: { argb: 'FF5B6472' } };
    w1.views = [{ showGridLines: false }];
    w1.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9 };

    var evol = x.meses || [];
    var graficos = { evolucion: { hoja: h7, filas: [t7.desde, t7.hasta], cat: t7.mapa.Nombre, cats: evol.map(function (m) { return nombreMes(m.mes); }),
        vals: { 'Cobrado': evol.map(function (m) { return num(m.cobradoHnl); }), 'Costo atribuido': evol.map(function (m) { return num(m.costoHnl); }), 'Ganancia calculable': evol.map(function (m) { return num(m.cobradoCubiertoHnl - m.costoHnl); }) }, series: [['Cobrado', t7.mapa.Cobrado, '178EF1'], ['Costo atribuido', t7.mapa['Costo atribuido'], 'E6211C'], ['Ganancia calculable', t7.mapa['Ganancia calculable'], '13BD63']] },
      ranking: { hoja: h6, filas: [t6b.desde, t6b.hasta], cat: t6b.mapa.Plat, cats: orden,
        vals: { 'Ganancia calculable': orden.map(function (n) { return num(tot[n].cub - tot[n].costo); }), 'Cobrado': orden.map(function (n) { return num(tot[n].cob); }) }, series: [['Ganancia calculable', t6b.mapa.Res, '13BD63'], ['Cobrado', t6b.mapa.Cob, '178EF1']] }, vacio: !meses.length };
    return { wb: wb, graficos: graficos };
  }

  // ---------- Gráficos nativos (DrawingML) en el Panel: ExcelJS no escribe gráficos, se insertan en el .xlsx
  function serieXml(g, s, i, tipo) {
    var cat = q(g.hoja) + '!$' + g.cat + '$' + g.filas[0] + ':$' + g.cat + '$' + g.filas[1];
    var val = q(g.hoja) + '!$' + s[1] + '$' + g.filas[0] + ':$' + s[1] + '$' + g.filas[1];
    var esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&apos;'); };
    var color = '<c:spPr>' + (tipo === 'line' ? '<a:ln w="28575"><a:solidFill><a:srgbClr val="' + s[2] + '"/></a:solidFill></a:ln>' : '<a:solidFill><a:srgbClr val="' + s[2] + '"/></a:solidFill>') + '</c:spPr>';
    var n = g.filas[1] - g.filas[0] + 1, cats = g.cats || [], vals = (g.vals || {})[s[0]] || [];
    var strCache = '<c:strCache><c:ptCount val="' + n + '"/>' + cats.map(function (c, k) { return '<c:pt idx="' + k + '"><c:v>' + esc(c) + '</c:v></c:pt>'; }).join('') + '</c:strCache>';
    var numCache = '<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="' + n + '"/>' + vals.map(function (v, k) { return '<c:pt idx="' + k + '"><c:v>' + (Number(v) || 0) + '</c:v></c:pt>'; }).join('') + '</c:numCache>';
    return '<c:ser><c:idx val="' + i + '"/><c:order val="' + i + '"/><c:tx><c:v>' + esc(s[0]) + '</c:v></c:tx>' + color + (tipo === 'line' ? '<c:marker><c:symbol val="circle"/><c:size val="6"/></c:marker>' : '<c:invertIfNegative val="0"/>') +
      '<c:cat><c:strRef><c:f>' + esc(cat) + '</c:f>' + strCache + '</c:strRef></c:cat><c:val><c:numRef><c:f>' + esc(val) + '</c:f>' + numCache + '</c:numRef></c:val>' + (tipo === 'line' ? '<c:smooth val="0"/>' : '') + '</c:ser>';
  }
  function chartXml(g, tipo, titulo) {
    var ejes = '<c:axId val="5001"/><c:axId val="5002"/>';
    var cuerpo = tipo === 'line' ? '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>' + g.series.map(function (s, i) { return serieXml(g, s, i, 'line'); }).join('') + '<c:marker val="1"/>' + ejes + '</c:lineChart>'
      : '<c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:varyColors val="0"/>' + g.series.map(function (s, i) { return serieXml(g, s, i, 'bar'); }).join('') + '<c:gapWidth val="60"/>' + ejes + '</c:barChart>';
    var catAx = '<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="' + (tipo === 'bar' ? 'maxMin' : 'minMax') + '"/></c:scaling><c:delete val="0"/><c:axPos val="' + (tipo === 'bar' ? 'l' : 'b') + '"/><c:numFmt formatCode="General" sourceLinked="0"/><c:tickLblPos val="low"/><c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>';
    var valAx = '<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="' + (tipo === 'bar' ? 'b' : 'l') + '"/><c:majorGridlines><c:spPr><a:ln><a:solidFill><a:srgbClr val="E5E9F0"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="&quot;L&quot;#,##0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="5001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<c:roundedCorners val="0"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="es-HN" sz="1200" b="1"/><a:t>' + titulo + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>' + cuerpo + catAx + valAx + '</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>';
  }
  function anclaXml(id, col0, row0, col1, row1, nombre) {
    return '<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>' + col0 + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + row0 + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>' + col1 + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + row1 + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>' +
      '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="' + (id + 1) + '" name="' + nombre + '"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId' + id + '"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>';
  }
  async function insertarGraficos(JSZip, buffer, graficos) {
    if (graficos.vacio) return buffer;
    var zip = await JSZip.loadAsync(buffer);
    var wbXml = await zip.file('xl/workbook.xml').async('string');
    var wbRels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
    var rid = (/<sheet [^>]*name="01 Panel ejecutivo"[^>]*r:id="([^"]+)"/.exec(wbXml) || /<sheet [^>]*r:id="([^"]+)"[^>]*name="01 Panel ejecutivo"/.exec(wbXml) || [])[1];
    var target = (new RegExp('<Relationship [^>]*Id="' + rid + '"[^>]*Target="([^"]+)"').exec(wbRels) || new RegExp('<Relationship [^>]*Target="([^"]+)"[^>]*Id="' + rid + '"').exec(wbRels) || [])[1];
    if (!target) return buffer;
    var hojaPath = 'xl/' + target.replace(/^\/?xl\//, ''), hojaNombre = hojaPath.split('/').pop(), relsPath = 'xl/worksheets/_rels/' + hojaNombre + '.rels';
    zip.file('xl/charts/chart901.xml', chartXml(graficos.evolucion, 'line', 'Cobros, costos y ganancia por mes'));
    zip.file('xl/charts/chart902.xml', chartXml(graficos.ranking, 'bar', 'Ganancia por plataforma (período)'));
    zip.file('xl/drawings/drawing901.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      anclaXml(1, 3, 5, 12, 22, 'Evolucion') + anclaXml(2, 3, 23, 12, 42, 'Plataformas') + '</xdr:wsDr>');
    zip.file('xl/drawings/_rels/drawing901.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart901.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart902.xml"/></Relationships>');
    var rel = '<Relationship Id="rIdDw901" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing901.xml"/>';
    var rels = zip.file(relsPath) ? await zip.file(relsPath).async('string') : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    zip.file(relsPath, rels.replace('</Relationships>', rel + '</Relationships>'));
    var hoja = await zip.file(hojaPath).async('string');
    if (hoja.indexOf('xmlns:r=') < 0) hoja = hoja.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
    var tag = '<drawing r:id="rIdDw901"/>', antes = ['<legacyDrawing', '<legacyDrawingHF', '<picture', '<oleObjects', '<controls', '<webPublishItems', '<tableParts', '<extLst', '</worksheet>'];
    for (var i = 0; i < antes.length; i++) { var k = hoja.indexOf(antes[i]); if (k >= 0) { hoja = hoja.slice(0, k) + tag + hoja.slice(k); break; } }
    zip.file(hojaPath, hoja);
    var ct = await zip.file('[Content_Types].xml').async('string');
    ct = ct.replace('</Types>', '<Override PartName="/xl/charts/chart901.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/charts/chart902.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/drawings/drawing901.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');
    zip.file('[Content_Types].xml', ct);
    return zip.generateAsync({ type: typeof window === 'undefined' ? 'nodebuffer' : 'arraybuffer', compression: 'DEFLATE' });
  }

  async function generar(x, deps, opts) {
    var r = construir(deps.ExcelJS, x, opts);
    var buf = await r.wb.xlsx.writeBuffer();
    try { if (deps.JSZip) buf = await insertarGraficos(deps.JSZip, buf, r.graficos); } catch (e) { if (deps.avisar) deps.avisar('El libro se generó sin gráficos (' + (e && e.message) + ').'); }
    return buf;
  }
  var api = { construir: construir, insertarGraficos: insertarGraficos, generar: generar, HOJAS: HOJAS, chartXml: chartXml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SublichatExcelFinanciero = api;
})(typeof window !== 'undefined' ? window : globalThis);
