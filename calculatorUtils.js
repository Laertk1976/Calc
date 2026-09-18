export function pretty(value) {
  value = String(value);
  if (value === 'Error') return value;
  if (/[eE]/.test(value)) return Number(value).toLocaleString('en-US', { maximumSignificantDigits: 15 });
  const [whole, decimal] = value.split('.');
  const formatted = whole === '-0' ? '-0' : Number(whole).toLocaleString('en-US');
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
  let remaining = String(value).trim().replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  const readNumber = () => {
    const match = remaining.match(/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
    if (!match) return NaN;
    remaining = remaining.slice(match[0].length).trimStart();
    return Number(match[0].replace(/,/g, ''));
  };
  let term = readNumber();
  let total = 0;
  let sign = 1;
  if (!Number.isFinite(term)) return 'Error';
  while (remaining) {
    const operator = remaining[0];
    if (!['+', '-', '*', '/'].includes(operator)) return 'Error';
    remaining = remaining.slice(1).trimStart();
    const operand = readNumber();
    if (!Number.isFinite(operand) || (operator === '/' && operand === 0)) return 'Error';
    if (operator === '*') term *= operand;
    else if (operator === '/') term /= operand;
    else {
      total += sign * term;
      sign = operator === '+' ? 1 : -1;
      term = operand;
    }
    if (!Number.isFinite(total) || !Number.isFinite(term)) return 'Error';
  }
  const result = total + sign * term;
  return Number.isFinite(result) ? Number(result.toPrecision(15)) : 'Error';
}

export function applyPercentage(expression, display) {
  const operand = Number(String(display).replace(/,/g, ''));
  if (!Number.isFinite(operand)) return null;
  const tokens = expression.includes('=') ? [] : expression.trim().split(/\s+/).filter(Boolean);
  const isOperator = (token) => ['+', '−', '×', '÷'].includes(token);
  if (tokens.length && !isOperator(tokens.at(-1))) tokens.pop();
  const operator = tokens.at(-1);
  const base = operator === '+' || operator === '−'
    ? evaluateExpression(tokens.slice(0, -1).join(' '))
    : 1;
  if (base === 'Error') return null;
  const percentage = Number(base) * operand / 100;
  if (!Number.isFinite(percentage)) return null;
  const value = percentage.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 15 });
  return { display: value, expression: [...tokens, value].join(' ') };
}
