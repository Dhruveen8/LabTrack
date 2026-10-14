export const countUnits = (units) => ({
  quantity: units.length,
  availableQuantity: units.filter(unit => unit.status === 'Available').length,
  borrowedQuantity: units.filter(unit => unit.status === 'Issued').length,
  maintenanceQuantity: units.filter(unit => unit.status === 'Maintenance').length,
});

export const filterEquipmentByLabs = (equipment, labIds) => {
  if (labIds === null) return equipment;
  const allowed = new Set(labIds.map(String));
  return equipment.flatMap(model => {
    const units = (model.units || []).filter(unit => allowed.has(String(unit.labId)));
    if (!units.length && !allowed.has(String(model.labId))) return [];
    const counts = countUnits(units);
    return [{ ...model, ...counts, units, status: counts.availableQuantity > 0 ? 'Available' : 'Unavailable' }];
  });
};

export const getLabInventory = (labs, equipment) => {
  const units = equipment.flatMap(model => model.units || []);
  return labs.map(lab => {
    const counts = countUnits(units.filter(unit => String(unit.labId) === String(lab.id)));
    return { ...lab, totalEquipment: counts.quantity, available: counts.availableQuantity,
      borrowed: counts.borrowedQuantity, maintenance: counts.maintenanceQuantity };
  });
};
