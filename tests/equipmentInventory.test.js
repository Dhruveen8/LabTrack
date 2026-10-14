import test from 'node:test';
import assert from 'node:assert/strict';
import { countUnits, filterEquipmentByLabs, getLabInventory } from '../src/utils/equipmentInventory.js';

const equipment = [{ id: 1, labId: 10, units: [
  { assetId: 'A', labId: 10, status: 'Available' },
  { assetId: 'B', labId: 20, status: 'Available' },
  { assetId: 'C', labId: 20, status: 'Issued' },
  { assetId: 'D', labId: 10, status: 'In Transit' },
  { assetId: 'E', labId: 10, status: 'Retired' },
  { assetId: 'F', labId: 10, status: 'Maintenance' },
] }];

test('transferred units are counted in their current lab and match the visible unit list', () => {
  const models = filterEquipmentByLabs(equipment, ['20']);
  assert.equal(models.length, 1);
  assert.deepEqual(models[0].units.map(unit => unit.assetId), ['B', 'C']);
  assert.equal(models[0].quantity, 2);
  assert.equal(models[0].availableQuantity, 1);
  assert.equal(models[0].borrowedQuantity, 1);
  assert.equal(models[0].availableQuantity, models[0].units.filter(unit => unit.status === 'Available').length);
});

test('unassigned assistants have no equipment; all-lab view keeps every unit', () => {
  assert.deepEqual(filterEquipmentByLabs(equipment, []), []);
  assert.equal(filterEquipmentByLabs(equipment, null), equipment);
});

test('lab totals and overall unit totals agree, excluding transit and retired from maintenance', () => {
  const labs = getLabInventory([{ id: 10 }, { id: 20 }], equipment);
  const totals = countUnits(equipment[0].units);
  assert.equal(labs.reduce((sum, lab) => sum + lab.available, 0), totals.availableQuantity);
  assert.equal(labs.reduce((sum, lab) => sum + lab.totalEquipment, 0), totals.quantity);
  assert.equal(labs[0].maintenance, 1);
  assert.equal(labs[1].borrowed, 1);
});

test('counts update after stock removal or a return', () => {
  const returned = [{ ...equipment[0], units: [{ assetId: 'C', labId: 20, status: 'Available' }] }];
  assert.equal(getLabInventory([{ id: 20 }], returned)[0].available, 1);
  assert.equal(getLabInventory([{ id: 20 }], [])[0].available, 0);
});
