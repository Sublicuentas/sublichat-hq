import test from 'node:test';
import assert from 'node:assert/strict';
import { bootApp } from './helpers/ui-harness.mjs';

test('R71 Inicio: "Próximos" muestra número y fecha (nunca undefined) e iguala a Cobros', async () => {
  const app = await bootApp({ role: 'sublicuentas' });
  try {
    await app.sleep(800);
    const card = app.$('.mcard-next');
    assert.ok(!/undefined|NaN/.test(card.textContent), 'la tarjeta no muestra undefined');
    const home = Number(app.$('.mcard-next strong').textContent);
    assert.ok(Number.isFinite(home), 'Próximos es un número');
    await app.click('.mcard-next', 400);
    const cobros = Number(app.$('.cb-t3 [data-filter="proximo"] b')?.textContent);
    assert.equal(home, cobros, 'Próximos (Inicio) = Próximo (Cobros)');
  } finally { app.close(); }
});
