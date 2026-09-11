import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'calculatorCalculations';

export async function getSavedCalculations() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const calculations = JSON.parse(stored || '[]');
    return Array.isArray(calculations) ? calculations : [];
  } catch {
    return [];
  }
}

export async function saveCalculation(expression, display, type = 'Add', titleOverride = '') {
  const title = (titleOverride || '').trim();
  if (!title) return false;

  const savedAt = new Date().toISOString();
  const savedCalculation = {
    createdAt: savedAt,
    savedAt,
    expression: expression || display,
    title: title.trim(),
    value: display,
    type,
  };
  const savedCalculations = await getSavedCalculations();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...savedCalculations, savedCalculation]));
  return true;
}

export async function updateSavedCalculations(calculations) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(calculations));
  } catch (error) {
    console.log('Storage update error:', error);
  }
}

