const SETTINGS_STORAGE_KEY = 'labtrack_settings';

const DEFAULT_SETTINGS = {
  studentBorrowLimitDays: 14,
  facultyBorrowLimitDays: 30,
  emailOverdueAlerts: true,
  transferAlerts: true,
  allowSelfRenewal: true
};

const getInitialSettings = () => {
  const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (saved) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) { /* fallback */ }
  }
  return { ...DEFAULT_SETTINGS };
};

let settingsStore = getInitialSettings();

const persist = () => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsStore));
  } catch (e) {
    console.error('Failed to persist settings to localStorage', e);
  }
};

export const settingsService = {
  get: async () => {
    return { ...settingsStore };
  },

  update: async (newSettings) => {
    settingsStore = {
      ...settingsStore,
      ...newSettings,
      studentBorrowLimitDays: parseInt(newSettings.studentBorrowLimitDays, 10) || DEFAULT_SETTINGS.studentBorrowLimitDays,
      facultyBorrowLimitDays: parseInt(newSettings.facultyBorrowLimitDays, 10) || DEFAULT_SETTINGS.facultyBorrowLimitDays
    };
    persist();
    return { ...settingsStore };
  }
};
