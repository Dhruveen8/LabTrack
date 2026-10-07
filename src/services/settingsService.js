import apiClient from '../api/client';

// Canonical key mapping: frontend camelCase <-> backend SCREAMING_SNAKE_CASE
// This is the single source of truth for how settings keys are translated.
const KEY_MAP = {
  studentBorrowLimitDays:  'STUDENT_MAX_BORROW_DAYS',
  facultyBorrowLimitDays:  'FACULTY_MAX_BORROW_DAYS',
  studentMaxItems:         'STUDENT_MAX_ITEMS',
  emailOverdueAlerts:      'EMAIL_OVERDUE_ALERTS',
  transferAlerts:          'TRANSFER_ALERTS',
  allowSelfRenewal:        'ALLOW_SELF_RENEWAL',
};

// Reverse map: SCREAMING_SNAKE_CASE -> camelCase
const REVERSE_KEY_MAP = Object.fromEntries(
  Object.entries(KEY_MAP).map(([camel, snake]) => [snake, camel])
);

// FIX: Parse typed values so booleans aren't stored/read as strings
// e.g. 'true' -> true, '14' -> 14, 'false' -> false
const parseValue = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!isNaN(num) && value !== '' && value !== null) return num;
  return value;
};

const DEFAULT_SETTINGS = {
  studentBorrowLimitDays: 14,
  facultyBorrowLimitDays: 30,
  studentMaxItems: 3,
  emailOverdueAlerts: true,
  transferAlerts: true,
  allowSelfRenewal: true,
};

export const settingsService = {
  get: async () => {
    try {
      const response = await apiClient.get('/settings/');
      const backendSettings = response.data.settings || {};

      // Translate SCREAMING_SNAKE keys -> camelCase, parse types
      const translated = {};
      for (const [backendKey, rawValue] of Object.entries(backendSettings)) {
        const camelKey = REVERSE_KEY_MAP[backendKey] || backendKey;
        translated[camelKey] = parseValue(rawValue);
      }

      return { ...DEFAULT_SETTINGS, ...translated };
    } catch (e) {
      console.error('Error fetching settings', e);
      return { ...DEFAULT_SETTINGS };
    }
  },

  update: async (newSettings) => {
    // Translate camelCase keys -> SCREAMING_SNAKE_CASE, stringify all values for backend
    const backendPayload = {};
    for (const [camelKey, value] of Object.entries(newSettings)) {
      const backendKey = KEY_MAP[camelKey] || camelKey;
      backendPayload[backendKey] = String(value);
    }

    await apiClient.put('/settings/', backendPayload);
    return await settingsService.get();
  },
};
