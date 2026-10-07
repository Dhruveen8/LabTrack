const patterns = {
  student: /^D?[0-9]{2}[A-Z]+[0-9]{3}$/,
  faculty: /^F[A-Z]+[0-9]{3}$/,
};

export const idExample = role => role === 'student' ? '24CE069 or D25CE150 (D2D)' : role === 'faculty' ? 'FCE001' : 'ASST001';

export const resolveInstitutionalId = (role, value, email) => {
  if (role === 'assistant') return null;
  const id = (value?.trim() || email?.split('@')[0] || '').toUpperCase();
  if (patterns[role] && (!patterns[role].test(id) || id.length > 32)) {
    throw new Error(`${role === 'student' ? 'Student' : 'Faculty'} ID must follow the format ${idExample(role)}.`);
  }
  return id || null;
};
