import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./calculatorUtils.js', import.meta.url), 'utf8');
const { applyPercentage, evaluateExpression } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

for (const [expression, operand, expectedExpression, result] of [
  ['50', '50', '0.5', 0.5],
  ['200 + 10', '10', '200 + 20', 220],
  ['200 − 10', '10', '200 − 20', 180],
  ['200 × 10', '10', '200 × 0.1', 20],
  ['200 ÷ 10', '10', '200 ÷ 0.1', 2000],
  ['100 + 100 + 10', '10', '100 + 100 + 20', 220],
  ['200 + 20 = 220', '220', '2.2', 2.2],
  ['0', '0', '0', 0],
  ['0.000001', '0.000001', '0.00000001', 0.00000001],
]) {
  test(`percentage updates the operand and formula: ${expression}`, () => {
    const percentage = applyPercentage(expression, operand);
    assert.equal(percentage.expression, expectedExpression);
    assert.equal(evaluateExpression(percentage.expression), result);
  });
}

test('invalid results cannot be converted into percentages', () => {
  assert.equal(applyPercentage('1 ÷ 0', 'Error'), null);
});
