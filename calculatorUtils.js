export function pretty(value) {
  if (value === 'Error') return value;
  const [whole, decimal] = value.split('.');
  const formatted = Number(whole).toLocaleString('en-US');
  return decimal === undefined ? formatted : `${formatted}.${decimal}`;
}

export function formatSavedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

export function evaluateExpression(value) {
  const tokens = value.replace(/,/g, '').match(/-?\d*\.?\d+|[÷×−+]/g) || [];
  if (!tokens.length) return 'Error';

  const values = [Number(tokens[0])];
  const pendingOperators = [];
  for (let index = 1; index < tokens.length; index += 2) {
    const nextOperator = tokens[index];
    const nextValue = Number(tokens[index + 1]);
    if (!Number.isFinite(nextValue)) return 'Error';
    if (nextOperator === '×' || nextOperator === '÷') {
      const previousValue = values.pop();
      const result = nextOperator === '×'
        ? previousValue * nextValue
        : nextValue === 0 ? 'Error' : previousValue / nextValue;
      if (result === 'Error') return result;
      values.push(result);
    } else {
      pendingOperators.push(nextOperator);
      values.push(nextValue);
    }
  }

  return values.slice(1).reduce((result, valueToAdd, index) => (
    pendingOperators[index] === '+' ? result + valueToAdd : result - valueToAdd
  ), values[0]);
}
