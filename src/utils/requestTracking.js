const normalized = value => (value || '').toUpperCase().replaceAll(' ', '_');
const latestDecision = (request, stage, itemId) => [...(request.approvalHistory || [])].reverse().find(entry =>
  entry.stage === stage && (itemId == null || entry.item_ids?.includes(itemId)));

export const requestTracking = request => {
  const items = request.items || [];
  const history = request.approvalHistory || [];
  const status = normalized(request.status);
  const terminal = items.length > 0 && items.every(item => ['REJECTED', 'CANCELLED'].includes(item.status));
  const steps = [{ id: 'submitted', label: 'Request submitted', state: 'done', person: request.requesterName, at: request.submittedAt }];

  const academicStep = (stage, id, label, person, approvedAt, previousComplete, required) => {
    const decision = latestDecision(request, stage);
    const state = approvedAt ? 'done' : decision?.decision === 'REJECTED' ? 'rejected'
      : !required ? 'skipped' : terminal ? 'stopped' : previousComplete ? 'active' : 'upcoming';
    return { id, label, person: decision?.actor_name || person, at: approvedAt || decision?.at,
      state, reason: decision?.decision === 'REJECTED' ? decision.reason || request.rejectionReason : null };
  };
  if (request.facultyId) steps.push(academicStep('FACULTY', 'faculty', 'Faculty approval', request.facultyName,
    request.facultyApprovedAt, true, true));
  const facultyComplete = !request.facultyId || !!request.facultyApprovedAt;
  const needsHod = items.some(item => item.requires_hod_approval) && !!request.hodId;
  steps.push(academicStep('HOD', 'hod', 'HOD approval', request.hodName,
    request.hodApprovedAt, facultyComplete, needsHod));

  const assistantGroups = new Map();
  for (const item of items) {
    const decision = latestDecision(request, 'ASSISTANT', item.id);
    const state = ['APPROVED', 'ISSUED', 'RETURNED'].includes(item.status) ? 'done'
      : decision?.decision === 'REJECTED' ? 'rejected'
      : ['REJECTED', 'CANCELLED'].includes(item.status) ? 'stopped'
      : item.approval_stage === 'ASSISTANT' ? 'active' : 'upcoming';
    const person = decision?.actor_name || (['done', 'rejected'].includes(state) ? null : item.assistant_name);
    const key = `${item.lab_id}-${state}-${decision?.actor_id || item.assistant_id || ''}-${decision?.at || ''}`;
    if (!assistantGroups.has(key)) assistantGroups.set(key, {
      id: `assistant-${key}`, label: 'Lab assistant approval', state, person,
      lab: item.lab_name, at: decision?.at, equipment: [],
      reason: decision?.decision === 'REJECTED' ? decision.reason || request.rejectionReason : null
    });
    assistantGroups.get(key).equipment.push(`${item.equipment_name} × ${item.quantity}`);
  }
  steps.push(...assistantGroups.values());

  const issued = items.reduce((sum, item) => sum + (item.issued_quantity || 0), 0);
  const returned = items.reduce((sum, item) => sum + (item.returned_quantity || 0), 0);
  const ready = items.filter(item => item.status === 'APPROVED')
    .reduce((sum, item) => sum + Math.max(0, item.quantity - (item.issued_quantity || 0)), 0);
  const outstanding = items.filter(item => ['PENDING', 'APPROVED'].includes(item.status))
    .reduce((sum, item) => sum + Math.max(0, item.quantity - (item.issued_quantity || 0)), 0);
  const collectionDates = items.filter(item => item.status === 'APPROVED' && item.collection_deadline)
    .map(item => item.collection_deadline).sort((a, b) => Date.parse(a) - Date.parse(b));
  steps.push({ id: 'pickup', label: issued && !outstanding ? 'Equipment issued' : 'Equipment collection',
    state: issued && !outstanding ? 'done' : ready ? 'active' : terminal ? 'stopped' : 'upcoming',
    detail: ready ? `${ready} ${ready === 1 ? 'unit' : 'units'} ready for pickup${issued ? ` · ${issued} already issued` : ''}`
      : issued ? `${issued} ${issued === 1 ? 'unit' : 'units'} issued` : null,
    deadline: collectionDates[0] });
  if (returned) steps.push({ id: 'returned', label: 'Equipment returned', state: returned === issued && !outstanding ? 'done' : 'active',
    detail: `${returned} of ${issued} issued units returned` });
  if (status === 'EXTENSION_PENDING') steps.push({ id: 'extension', label: 'Extension approval', state: 'active',
    detail: 'Awaiting lab assistant approval' });

  const waiting = [...new Set(items.filter(item => item.status === 'PENDING').map(item => ({
    FACULTY: 'faculty', HOD: 'HOD', ASSISTANT: 'lab assistant'
  })[item.approval_stage]).filter(Boolean))];
  let summary = waiting.length ? `Awaiting ${waiting.join(' / ')} approval`
    : ready ? 'Ready for collection' : status === 'RETURNED' ? 'Returned' : issued ? 'Equipment issued'
    : status === 'REJECTED' ? 'Request rejected' : status === 'CANCELLED' ? 'Request cancelled' : request.status;
  if (waiting.length && ready) summary += ' · Some items ready for pickup';
  if (status === 'EXTENSION_PENDING') summary = 'Extension awaiting lab assistant approval';
  return { summary, steps, hasRejection: history.some(entry => entry.decision === 'REJECTED') };
};
