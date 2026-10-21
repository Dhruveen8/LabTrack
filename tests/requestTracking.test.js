import test from 'node:test';
import assert from 'node:assert/strict';
import { requestTracking } from '../src/utils/requestTracking.js';

const item = (changes = {}) => ({ id: 1, lab_id: 1, lab_name: 'CE Lab 1', equipment_name: 'Cable', quantity: 1,
  status: 'PENDING', approval_stage: 'FACULTY', requires_hod_approval: false,
  assistant_id: 30, assistant_name: 'Vivek Parmar', issued_quantity: 0, returned_quantity: 0, ...changes });
const request = (changes = {}) => ({ id: 87, status: 'Pending', requesterName: 'Student', facultyId: 10,
  facultyName: 'Rohan Shah', hodId: 20, hodName: 'Dr. Nikita Bhatt', approvalHistory: [], items: [item()], ...changes });

test('unapproved request names the faculty and leaves later stages unreached', () => {
  const result = requestTracking(request());
  assert.equal(result.summary, 'Awaiting faculty approval');
  assert.equal(result.steps.find(step => step.id === 'faculty').state, 'active');
  assert.equal(result.steps.find(step => step.id === 'faculty').person, 'Rohan Shah');
  assert.equal(result.steps.find(step => step.id === 'hod').state, 'skipped');
  assert.equal(result.steps.find(step => step.id.startsWith('assistant')).state, 'upcoming');
});

test('mixed carts keep all assistant stages unreached while waiting for the HOD decision', () => {
  const result = requestTracking(request({ facultyApprovedAt: '2026-10-21T10:00:00Z', items: [
    item({ approval_stage: 'HOD' }),
    item({ id: 2, equipment_name: 'Oscilloscope', requires_hod_approval: true, approval_stage: 'HOD' })
  ] }));
  assert.equal(result.summary, 'Awaiting HOD approval');
  assert.equal(result.steps.find(step => step.id === 'faculty').state, 'done');
  assert.equal(result.steps.find(step => step.id === 'hod').state, 'active');
  assert.deepEqual(result.steps.filter(step => step.id.startsWith('assistant')).map(step => step.state), ['upcoming']);
});

test('assistant decision shows the actual approver rather than a later replacement assignment', () => {
  const result = requestTracking(request({ facultyApprovedAt: '2026-10-21T10:00:00Z',
    approvalHistory: [{ stage: 'ASSISTANT', decision: 'APPROVED', actor_id: 29, actor_name: 'Original Assistant', item_ids: [1], at: '2026-10-21T11:00:00Z' }],
    items: [item({ status: 'APPROVED', approval_stage: 'COLLECTION', assistant_name: 'Replacement Assistant' })] }));
  const assistant = result.steps.find(step => step.id.startsWith('assistant'));
  assert.equal(assistant.person, 'Original Assistant');
  assert.equal(assistant.state, 'done');
  assert.equal(result.summary, 'Ready for collection');
});

test('faculty rejection stops downstream stages and preserves the reason and actor', () => {
  const result = requestTracking(request({ status: 'Rejected',
    approvalHistory: [{ stage: 'FACULTY', decision: 'REJECTED', actor_name: 'Rohan Shah', reason: 'Project not supervised', at: '2026-10-21T11:00:00Z' }],
    items: [item({ status: 'REJECTED', approval_stage: 'REJECTED', requires_hod_approval: true })] }));
  assert.equal(result.summary, 'Request rejected');
  assert.equal(result.steps.find(step => step.id === 'faculty').state, 'rejected');
  assert.equal(result.steps.find(step => step.id === 'faculty').reason, 'Project not supervised');
  assert.equal(result.steps.find(step => step.id === 'hod').state, 'stopped');
  assert.equal(result.steps.find(step => step.id.startsWith('assistant')).state, 'stopped');
});

test('partial HOD rejection keeps approved small equipment ready for collection', () => {
  const result = requestTracking(request({ facultyApprovedAt: '2026-10-21T10:00:00Z',
    approvalHistory: [{ stage: 'HOD', decision: 'REJECTED', actor_name: 'Dr. Nikita Bhatt', reason: 'Not needed' }],
    items: [item({ status: 'APPROVED', approval_stage: 'COLLECTION' }),
      item({ id: 2, requires_hod_approval: true, status: 'REJECTED', approval_stage: 'REJECTED' })] }));
  assert.equal(result.summary, 'Ready for collection');
  assert.equal(result.hasRejection, true);
  assert.equal(result.steps.find(step => step.id === 'hod').state, 'rejected');
});

test('HOD and quick-borrow requests do not invent faculty or HOD approval requirements', () => {
  const result = requestTracking(request({ facultyId: null, hodId: null,
    items: [item({ approval_stage: 'ASSISTANT' })] }));
  assert.equal(result.steps.some(step => step.id === 'faculty'), false);
  assert.equal(result.steps.find(step => step.id === 'hod').state, 'skipped');
  assert.equal(result.summary, 'Awaiting lab assistant approval');
});

test('partial pickups and returns reflect issued quantities without completing outstanding items', () => {
  const result = requestTracking(request({ facultyApprovedAt: '2026-10-21T10:00:00Z',
    items: [item({ quantity: 3, issued_quantity: 1, returned_quantity: 1, status: 'APPROVED', approval_stage: 'COLLECTION' })] }));
  assert.equal(result.steps.find(step => step.id === 'pickup').state, 'active');
  assert.equal(result.steps.find(step => step.id === 'pickup').detail, '2 units ready for pickup · 1 already issued');
  assert.equal(result.steps.find(step => step.id === 'returned').state, 'active');
});

test('cancelled requests do not show pending approvals or pickup readiness', () => {
  const result = requestTracking(request({ status: 'Cancelled', items: [item({ status: 'CANCELLED', approval_stage: 'CANCELLED' })] }));
  assert.equal(result.summary, 'Request cancelled');
  assert.equal(result.steps.some(step => step.state === 'active'), false);
});

test('missing historical approver is not replaced with the currently assigned assistant', () => {
  const result = requestTracking(request({ facultyApprovedAt: '2026-10-21T10:00:00Z',
    items: [item({ status: 'APPROVED', approval_stage: 'COLLECTION' })] }));
  assert.equal(result.steps.find(step => step.id.startsWith('assistant')).person, null);
});

test('after HOD rejection the remaining items are routed to the lab assistant', () => {
  const result = requestTracking(request({ facultyApprovedAt: '2026-10-21T10:00:00Z',
    approvalHistory: [{ stage: 'HOD', decision: 'REJECTED', actor_name: 'Dr. Nikita Bhatt', reason: 'Not needed', item_ids: [2] }],
    items: [item({ approval_stage: 'ASSISTANT' }),
      item({ id: 2, requires_hod_approval: true, status: 'REJECTED', approval_stage: 'REJECTED' })] }));
  assert.equal(result.summary, 'Awaiting lab assistant approval');
  assert.equal(result.steps.find(step => step.id === 'hod').state, 'rejected');
  assert.deepEqual(result.steps.filter(step => step.id.startsWith('assistant')).map(step => step.state), ['active', 'stopped']);
});
