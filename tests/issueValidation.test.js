import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIssueLab } from '../src/utils/issueValidation.js';

const unit = { asset_id: 'LT-IOT-MC-00002', lab_id: 12 };
const assistant = { role: 'assistant', assignedLabIds: [11, 12] };
const request = { labId: 11, labName: 'IoT Lab' };

test('transferred unit cannot fulfill its original lab request even when both labs are assigned', () => {
  const error = validateIssueLab(unit, request, assistant);
  assert.match(error, /Lab 12/);
  assert.match(error, /IoT Lab/);
  assert.match(error, /Scan an available unit/);
});

test('available unit in the request lab passes lab validation', () => {
  assert.equal(validateIssueLab({ ...unit, lab_id: 11 }, request, assistant), '');
});

test('walk-in uses the current owning lab after a transfer', () => {
  assert.equal(validateIssueLab(unit, 'WALKIN', assistant), '');
  assert.match(validateIssueLab(unit, 'WALKIN', { role: 'assistant', assignedLabIds: [11] }), /not assigned to you/);
});

test('assistant without assigned labs cannot issue a unit', () => {
  assert.match(validateIssueLab(unit, 'WALKIN', { role: 'assistant' }), /not assigned to you/);
});
