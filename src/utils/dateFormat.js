const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata'
});

export function formatDate(value) {
  if (!value) return '—';
  // Calendar inputs have no timezone: keep their selected day unchanged.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}-${month}-${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date).replaceAll('/', '-');
}

export const isDateColumn = accessor => /(?:Date|At|_date|_at)$/.test(accessor || '') ||
  ['requiredFrom', 'requiredUntil', 'timestamp'].includes(accessor);
