const STORAGE_KEY = 'calculatorCalculations';

export function getSavedCalculations() {
  if (typeof globalThis.localStorage === 'undefined') return [];
  try {
    return JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveCalculation(expression, display, type = 'Add', titleOverride = '') {
  if (typeof globalThis.localStorage === 'undefined') return;

  const title = (titleOverride || '').trim() || globalThis.prompt?.('Title for this calculation:') || '';
  if (!title || !title.trim()) return;

  const savedAt = new Date().toISOString();
  const savedCalculation = {
    createdAt: savedAt,
    savedAt,
    expression: expression || display,
    title: title.trim(),
    value: display,
    type,
  };
  const savedCalculations = getSavedCalculations();
  globalThis.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...savedCalculations, savedCalculation]),
  );
}
