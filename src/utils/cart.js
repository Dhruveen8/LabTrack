export const cartFingerprint = (cart) => JSON.stringify(cart.items.map(item =>
  [item.model_id, item.lab_id, item.quantity, item.available_quantity]));

export const cartError = (error) => {
  const detail = error.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map(item => item.msg).join('; ');
  return typeof detail === 'string' ? detail : detail?.message || error.message || 'Unable to update cart';
};

export const requestHasLab = (request, labs) => request.items?.length
  ? request.items.some(item => labs.includes(item.lab_id)) : labs.includes(request.labId);

export const requestHasStage = (request, stage, labs) => request.items?.length
  ? request.items.some(item => item.status === stage && (!labs || labs.includes(item.lab_id)))
  : request.status?.toUpperCase() === stage;

export const matchingRequestItem = (request, unit) => request.items?.find(item =>
  item.model_id === unit.model_id && item.lab_id === unit.lab_id &&
  item.status === 'APPROVED' && item.reserved_asset_ids.includes(unit.asset_id));
