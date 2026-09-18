import { applyPercentage, evaluateExpression, pretty } from './calculatorUtils';

const operators = ['+', '−', '×', '÷'];
export const initialCalculatorState = { display: '0', expression: '', freshInput: true, completed: false };

export function visibleCalculatorValue(state) {
  if (!state.expression || state.completed || state.freshInput) return state.display;
  return String(evaluateExpression(state.expression));
}

function replaceOperand(state, display) {
  const tokens = state.completed ? [] : state.expression.trim().split(/\s+/).filter(Boolean);
  if (tokens.length && !operators.includes(tokens.at(-1))) tokens.pop();
  return { display, expression: [...tokens, display].join(' '), freshInput: false, completed: false };
}

export function pressCalculatorKey(state, key) {
  if (key === 'AC') return { ...initialCalculatorState };
  if (key === 'C') {
    if (state.display === 'Error') return { ...initialCalculatorState };
    const expression = (state.completed ? state.display : state.expression).trimEnd().slice(0, -1).trimEnd();
    if (!expression || expression === '-') return { ...initialCalculatorState };
    const tokens = expression.split(/\s+/);
    const pending = operators.includes(tokens.at(-1));
    const display = pending ? String(evaluateExpression(tokens.slice(0, -1).join(' '))) : tokens.at(-1);
    return { expression, display, freshInput: pending, completed: false };
  }
  if (key === '±') {
    if (state.display === 'Error') return state;
    const operand = state.freshInput && !state.completed ? '0' : state.display;
    return replaceOperand(state, operand.startsWith('-') ? operand.slice(1) : `-${operand}`);
  }
  if (key === '%') {
    const result = applyPercentage(state.expression, state.display);
    return result ? { ...result, freshInput: false, completed: false } : state;
  }
  if (operators.includes(key)) {
    if (state.display === 'Error') return state;
    const tokens = state.completed ? [state.display] : (state.expression || state.display).trim().split(/\s+/);
    if (operators.includes(tokens.at(-1))) tokens.pop();
    const result = evaluateExpression(tokens.join(' '));
    if (result === 'Error') return { ...state, display: 'Error', completed: true };
    return { display: state.display, expression: [...tokens, key].join(' '), freshInput: true, completed: false };
  }
  if (key === '=') {
    if (state.completed || !state.expression) return state;
    const formula = `${state.expression}${state.freshInput ? ` ${state.display}` : ''}`;
    const result = String(evaluateExpression(formula));
    return { display: result, expression: `${formula} = ${pretty(result)}`, freshInput: true, completed: true };
  }
  if (!/^\d$|^\.$/.test(key)) return state;
  if (state.display === 'Error') state = initialCalculatorState;
  let operand = state.freshInput || state.completed ? '' : state.display;
  if (key === '.' && operand.includes('.')) return state;
  if (key !== '.' && operand.replace(/[^0-9]/g, '').length >= 12) return state;
  if (key === '.') operand = operand ? `${operand}.` : '0.';
  else if (operand === '0' || operand === '-0') operand = `${operand.startsWith('-') ? '-' : ''}${key}`;
  else operand += key;
  return replaceOperand(state, operand);
}
