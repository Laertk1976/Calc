export const HISTORY_KEY = 'calc.localCalculationHistory.v1';

// Serialize hydration and mutations so fast calculations/deletions cannot overwrite each other.
export function createLocalCalculationHistory(storage) {
  let entries;
  let queue = Promise.resolve();
  let sequence = 0;
  const listeners = new Set();
  const run = change => {
    const task = queue.then(async () => {
      if (!entries) {
        const raw = await storage.getItem(HISTORY_KEY);
        let parsed;
        try { parsed = JSON.parse(raw || '[]'); } catch { parsed = []; }
        entries = (Array.isArray(parsed) ? parsed : []).filter(item =>
          item && typeof item.id === 'string' && typeof item.expression === 'string'
          && typeof item.result === 'string').slice(0, 100);
      }
      if (change) {
        const next = change(entries);
        await storage.setItem(HISTORY_KEY, JSON.stringify(next));
        entries = next;
      }
      listeners.forEach(listener => listener(entries));
      return entries;
    });
    queue = task.catch(() => {});
    return task;
  };
  return {
    load: () => run(),
    subscribe(listener) { listeners.add(listener); if (entries) listener(entries); return () => listeners.delete(listener); },
    add(expression, result) {
      if (!expression || !Number.isFinite(Number(result))) return run();
      return run(current => [{ id: `${Date.now()}-${++sequence}`, expression, result: String(result) }, ...current].slice(0, 100));
    },
    remove: id => run(current => current.filter(item => item.id !== id)),
  };
}
