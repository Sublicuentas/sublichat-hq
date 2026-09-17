import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDateDMY,
  serviceRowsFromClients,
  dashboardSummary,
  filterClients,
  roleCapabilities,
  coreCollectionsForRole,
  roleLabel,
} from '../src/data.js';

test('parseDateDMY accepts the existing DD/MM/YYYY contract', () => {
  const d = parseDateDMY('16/09/2026');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8);
  assert.equal(d.getDate(), 16);
  assert.equal(parseDateDMY('2026-09-16'), null);
});

test('service rows preserve stable clienteId and compraId', () => {
  const rows = serviceRowsFromClients([{ id:'cli-1', nombrePerfil:'Ana', telefono:'9999-0000', servicios:[{ compraId:'cmp-9', plataforma:'Netflix', fechaRenovacion:'16/09/2026', precio:130 }] }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].clienteId, 'cli-1');
  assert.equal(rows[0].compraId, 'cmp-9');
  assert.equal(rows[0].servicioIndex, 0);
});

test('dashboard summary uses next actual expiration date, not a seven-day bucket', () => {
  const rows = [
    { fechaRenovacion:'15/09/2026' },
    { fechaRenovacion:'16/09/2026' },
    { fechaRenovacion:'18/09/2026' },
    { fechaRenovacion:'18/09/2026' },
    { fechaRenovacion:'29/09/2026' },
  ];
  const summary = dashboardSummary(rows, new Date(2026, 8, 16));
  assert.equal(summary.vencidos, 1);
  assert.equal(summary.hoy, 1);
  assert.equal(summary.proximo.count, 2);
  assert.equal(summary.proximo.label, '18/09');
});

test('client filter searches name, phone and platform', () => {
  const clients = [{ nombrePerfil:'Samuel Munguía', telefono:'9999-1111', servicios:[{plataforma:'Prime Video'}] }];
  assert.equal(filterClients(clients, 'samuel').length, 1);
  assert.equal(filterClients(clients, '99991111').length, 1);
  assert.equal(filterClients(clients, 'prime').length, 1);
  assert.equal(filterClients(clients, 'netflix').length, 0);
});

test('Geisell keeps her current scope and does not receive catalog access', () => {
  const caps = roleCapabilities('geisell_admin');
  assert.equal(caps.catalogo, false);
  assert.equal(caps.tickets, true);
  assert.equal('activarTv' in caps, false);
  assert.equal(caps.inventario, false);
  assert.equal(caps.controlMaestro, true);
});


test('core reads are capability-gated so Geisell does not receive inventory or finance data', () => {
  assert.deepEqual(coreCollectionsForRole('geisell_admin'), ['clientes']);
  assert.deepEqual(coreCollectionsForRole('relojes'), ['clientes', 'finanzas_movimientos']);
  assert.deepEqual(coreCollectionsForRole('admin'), ['clientes', 'inventario', 'finanzas_movimientos']);
});


test('operator identity follows username before a generic backend role', () => {
  const relojes = roleCapabilities('asesor', 'libni');
  assert.equal(relojes.catalogo, false);
  assert.equal(relojes.finanzas, true);
  assert.equal(relojes.inventario, false);
  assert.equal(relojes.controlMaestro, false);
  assert.equal(roleLabel('asesor', 'libni'), 'Relojes · Libni');

  const sublicuentas = roleCapabilities('asesor', 'naara');
  assert.equal(sublicuentas.inventario, true);
  assert.equal(sublicuentas.controlMaestro, true);
  assert.equal(roleLabel('asesor', 'naara'), 'Sublicuentas · Naara');
});

test('Relojes and Sublicuentas prioritize Nuevo CRM while Relojes has no catalog access', () => {
  const relojes = roleCapabilities('asesor', 'libni');
  assert.equal(relojes.nuevoCrm, true);
  assert.equal(relojes.catalogo, false);

  const sublicuentas = roleCapabilities('asesor', 'naara');
  assert.equal(sublicuentas.nuevoCrm, true);

  const geisell = roleCapabilities('geisell_admin', 'geisell');
  assert.equal(geisell.nuevoCrm, false);
});

test('client operational filters support status seller platform and search together', async () => {
  const { filterOperationalRows } = await import('../src/data.js');
  const rows=[
    {clienteId:'c1',nombre:'Ana',telefono:'9999',vendedor:'Relojes',plataforma:'Netflix',correo:'ana@mail.com',fechaRenovacion:'16/09/2026'},
    {clienteId:'c2',nombre:'Beto',telefono:'8888',vendedor:'Sublicuentas',plataforma:'Disney',correo:'b@mail.com',fechaRenovacion:'17/09/2026'},
    {clienteId:'c3',nombre:'Carla',telefono:'7777',vendedor:'Relojes',plataforma:'Netflix',correo:'c@mail.com',fechaRenovacion:'15/09/2026'},
  ];
  const today=new Date(2026,8,16,12,0,0,0);
  assert.equal(filterOperationalRows(rows,{status:'hoy',seller:'Relojes',platform:'Netflix',query:'Ana',today}).length,1);
  assert.equal(filterOperationalRows(rows,{status:'proximos',today}).map(x=>x.nombre).join(','),'Beto');
  assert.equal(filterOperationalRows(rows,{status:'vencidos',today}).map(x=>x.nombre).join(','),'Carla');
  assert.equal(filterOperationalRows(rows,{status:'vigentes',today}).length,2);
});

test('client filter options preserve all sellers and platforms from current rows', async () => {
  const { operationalFilterOptions } = await import('../src/data.js');
  const rows=[
    {vendedor:'Relojes',plataforma:'Netflix'},
    {vendedor:'Sublicuentas 2',plataforma:'Oleada TV'},
    {vendedor:'Relojes',plataforma:'Netflix'},
  ];
  const opts=operationalFilterOptions(rows);
  assert.deepEqual(opts.sellers,['Relojes','Sublicuentas 2']);
  assert.deepEqual(opts.platforms,['Netflix','Oleada TV']);
});
