const { createHash } = require('node:crypto');
const PRODUCT_ID = 'calc_pro_lifetime';
const PACKAGE_NAME = 'com.example.calc';
const hash = value => createHash('sha256').update(value).digest('hex');
const accountId = uid => hash(`calc-pro:${uid}`);

function assessPurchase(purchase, uid) {
  if (purchase.obfuscatedExternalAccountId !== accountId(uid)) return 'wrong-account';
  const item = purchase.productLineItem?.find(item => item.productId === PRODUCT_ID);
  if (!item || item.productOfferDetails?.rentOfferDetails) return 'wrong-product';
  const state = purchase.purchaseStateContext?.purchaseState;
  if (state === 'PENDING') return 'pending';
  if (state !== 'PURCHASED' || item.productOfferDetails?.refundableQuantity === 0
    || item.productOfferDetails?.consumptionState === 'CONSUMPTION_STATE_CONSUMED') return 'revoked';
  return 'active';
}
module.exports = { PRODUCT_ID, PACKAGE_NAME, hash, accountId, assessPurchase };
