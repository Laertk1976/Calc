const STORAGE_KEY = 'calculatorCalculations';

export function getSavedCalculations() {
  if (typeof globalThis.localStorage === 'undefined') return [];
  try {
    return JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveCalculation(expression, display) {
  if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.prompt !== 'function') return;
  const title = globalThis.prompt('Title for this calculation:');
  if (!title || !title.trim()) return;

  const savedCalculation = {
    createdAt: new Date().toISOString(),
    expression: expression || display,
    title: title.trim(),
    value: display,
  };
  const savedCalculations = getSavedCalculations();
  globalThis.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...savedCalculations, savedCalculation]),
  );
}
