import test from 'node:test';
import assert from 'node:assert/strict';
import { financeMetadata } from '../lib/finance-schema.mjs';

test('financeMetadata identifica movimiento originado en Sublichat', () => {
  const meta = financeMetadata({ docId: 'mov1', usuario: 'naara', userId: 'uid1' });
  assert.deepEqual(meta, {
    movimientoId: 'mov1',
    origen: 'sublichat',
    registradoPor: 'naara',
    registradoPorId: 'uid1'
  });
});
