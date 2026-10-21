export const pendingApprovalItems = (request, user) => {
  if (user?.role !== 'faculty') return [];
  return (request.items || []).filter(item => item.status === 'PENDING' && (
    (item.approval_stage === 'FACULTY' && request.facultyId === user.id) ||
    (item.approval_stage === 'HOD' && user.is_hod && request.hodId === user.id)
  ));
};

export const approvalQueue = (requests, user) => requests
  .map(request => ({ request, items: pendingApprovalItems(request, user) }))
  .filter(entry => entry.items.length)
  .sort((left, right) => (Date.parse(left.request.approvalDeadline) || Infinity) -
    (Date.parse(right.request.approvalDeadline) || Infinity));
