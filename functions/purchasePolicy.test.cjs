const test = require('node:test');
const assert = require('node:assert/strict');
const { assessPurchase, accountId, PRODUCT_ID } = require('./purchasePolicy.cjs');
const purchase = () => ({
  obfuscatedExternalAccountId: accountId('alice'),
  productLineItem: [{ productId: PRODUCT_ID, productOfferDetails: { refundableQuantity: 1 } }],
  purchaseStateContext: { purchaseState: 'PURCHASED' },
});
test('only a purchased matching product bound to the signed-in account unlocks Pro', () => {
  assert.equal(assessPurchase(purchase(), 'alice'), 'active');
  assert.equal(assessPurchase(purchase(), 'bob'), 'wrong-account');
  assert.equal(assessPurchase({ ...purchase(), obfuscatedExternalAccountId: undefined }, 'alice'), 'wrong-account');
  assert.equal(assessPurchase({ ...purchase(), productLineItem: [{ productId: 'other' }] }, 'alice'), 'wrong-product');
});
test('pending, cancelled, refunded, unknown and rental purchases never unlock Pro', () => {
  for (const state of ['PENDING', 'CANCELLED', undefined]) {
    assert.notEqual(assessPurchase({ ...purchase(), purchaseStateContext: { purchaseState: state } }, 'alice'), 'active');
  }
  const refunded = purchase(); refunded.productLineItem[0].productOfferDetails.refundableQuantity = 0;
  assert.equal(assessPurchase(refunded, 'alice'), 'revoked');
  const consumed = purchase(); consumed.productLineItem[0].productOfferDetails.consumptionState = 'CONSUMPTION_STATE_CONSUMED';
  assert.equal(assessPurchase(consumed, 'alice'), 'revoked');
  const rental = purchase(); rental.productLineItem[0].productOfferDetails.rentOfferDetails = {};
  assert.equal(assessPurchase(rental, 'alice'), 'wrong-product');
});
