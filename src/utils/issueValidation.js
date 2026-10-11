export const validateIssueLab = (unit, request, user, labs = []) => {
  const labName = (id) => labs.find(lab => lab.id === id)?.name || `Lab ${id}`;
  if (request !== 'WALKIN' && unit.lab_id !== request.labId) {
    return `Unit ${unit.asset_id} currently belongs to ${labName(unit.lab_id)}, but this request is for ${request.labName || labName(request.labId)}. Scan an available unit from the request's lab.`;
  }
  if (user?.role === 'assistant' && !(user.assignedLabIds || []).includes(unit.lab_id)) {
    return `Unit ${unit.asset_id} belongs to ${labName(unit.lab_id)}, which is not assigned to you. Scan a unit from one of your assigned labs.`;
  }
  return '';
};
