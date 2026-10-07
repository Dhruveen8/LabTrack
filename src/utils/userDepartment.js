// Department names come from the saved assignment; ID codes can be ambiguous.
export const resolveUserDepartment = (user, departments = []) => {
  const departmentId = user?.departmentId ?? user?.department_id;
  if (departmentId != null) {
    return departments.find(department => String(department.id) === String(departmentId))?.name || 'Not assigned';
  }

  return 'Not assigned';
};
