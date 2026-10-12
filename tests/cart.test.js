import test from 'node:test';
import assert from 'node:assert/strict';
import { cartFingerprint, cartError, requestHasLab, requestHasStage, matchingRequestItem } from '../src/utils/cart.js';
import { validateIssueLab } from '../src/utils/issueValidation.js';

const request = { labId: 11, status: 'Pending', items: [
  { id: 1, model_id: 20, lab_id: 11, status: 'PENDING', reserved_asset_ids: ['A'] },
  { id: 2, model_id: 21, lab_id: 12, status: 'APPROVED', reserved_asset_ids: ['B', 'C'] },
] };

test('combined requests are visible and actionable in their secondary lab', () => {
  assert.equal(requestHasLab(request, [12]), true);
  assert.equal(requestHasStage(request, 'APPROVED', [12]), true);
  assert.equal(requestHasStage(request, 'APPROVED', [11]), false);
  assert.equal(requestHasStage(request, 'PENDING', [12]), false);
});

test('scanner requires the exact allocated asset and approved item', () => {
  assert.equal(matchingRequestItem(request, { asset_id: 'B', model_id: 21, lab_id: 12 }).id, 2);
  assert.equal(matchingRequestItem(request, { asset_id: 'OTHER', model_id: 21, lab_id: 12 }), undefined);
  assert.equal(matchingRequestItem(request, { asset_id: 'A', model_id: 20, lab_id: 11 }), undefined);
});

test('multi-item scanner validates model lab and assistant scope', () => {
  assert.equal(validateIssueLab({ model_id: 21, lab_id: 12 }, request, { role: 'assistant', assignedLabIds: [12] }), '');
  assert.match(validateIssueLab({ model_id: 21, lab_id: 13 }, request, { role: 'assistant', assignedLabIds: [12, 13] }), /this request/);
});

test('stock or quantity changes invalidate a final cart review', () => {
  const cart = { items: [{ model_id: 20, lab_id: 11, quantity: 2, available_quantity: 3 }] };
  assert.notEqual(cartFingerprint(cart), cartFingerprint({ items: [{ ...cart.items[0], available_quantity: 1 }] }));
  assert.notEqual(cartFingerprint(cart), cartFingerprint({ items: [{ ...cart.items[0], quantity: 1 }] }));
});

test('structured stock and validation errors produce readable warnings', () => {
  assert.equal(cartError({ response: { data: { detail: { code: 'INSUFFICIENT_STOCK', message: 'Revise your cart' } } } }), 'Revise your cart');
  assert.equal(cartError({ response: { data: { detail: [{ msg: 'Quantity must be positive' }] } } }), 'Quantity must be positive');
});
