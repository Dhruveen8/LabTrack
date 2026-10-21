import test from 'node:test';
import assert from 'node:assert/strict';
import { approvalQueue, pendingApprovalItems } from '../src/utils/approvalQueue.js';

const request = {
  id: 87, facultyId: 10, hodId: 20, approvalDeadline: '2026-10-28T12:00:00Z',
  items: [
    { id: 1, status: 'PENDING', approval_stage: 'ASSISTANT' },
    { id: 2, status: 'PENDING', approval_stage: 'HOD' },
    { id: 3, status: 'PENDING', approval_stage: 'FACULTY' },
    { id: 4, status: 'REJECTED', approval_stage: 'HOD' }
  ]
};

test('HOD review lists only pending items assigned to that HOD, excluding items already at the assistant', () => {
  assert.deepEqual(pendingApprovalItems(request, { id: 20, role: 'faculty', is_hod: true }).map(item => item.id), [2]);
  assert.deepEqual(pendingApprovalItems(request, { id: 21, role: 'faculty', is_hod: true }), []);
  assert.deepEqual(pendingApprovalItems(request, { id: 20, role: 'faculty', is_hod: false }), []);
});

test('faculty see their own supervision items, including when the faculty member also has HOD duties', () => {
  assert.deepEqual(pendingApprovalItems(request, { id: 10, role: 'faculty' }).map(item => item.id), [3]);
  assert.deepEqual(pendingApprovalItems(request, { id: 10, role: 'faculty', is_hod: true }).map(item => item.id), [3]);
  assert.deepEqual(pendingApprovalItems(request, { id: 10, role: 'student' }), []);
});

test('requests with the soonest approval deadline appear first; unrelated and legacy requests do not appear', () => {
  const earlier = { ...request, id: 88, approvalDeadline: '2026-10-23T12:00:00Z' };
  const unrelated = { ...request, id: 89, hodId: 21 };
  const legacy = { id: 90, hodId: 20 };
  assert.deepEqual(approvalQueue([request, unrelated, legacy, earlier], { id: 20, role: 'faculty', is_hod: true })
    .map(entry => entry.request.id), [88, 87]);
});
